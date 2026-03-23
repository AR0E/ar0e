#!/usr/bin/env python3
"""
Pre-render markdown notes into JSON payloads consumed by notes/view.html.

Why this script exists
----------------------
The first version of the site rendered markdown in the browser. That worked, but
large notes and CDN-hosted dependencies made some pages feel slow. This script
moves the heavy markdown parsing step to build time while keeping the site fully
static.

What it reads
-------------
- content/notes/*.md             -> source markdown notes
- content/notes/index.json       -> note metadata (title/date/tags shown in archives)
- content/typst-manifest.json    -> optional map of precompiled Typst previews

What it writes
--------------
- content/rendered/<slug>.json   -> pre-rendered HTML + table of contents metadata

Typical workflow
----------------
1. Edit markdown in content/notes/
2. (Optional) rebuild Typst previews with python tools/build_typst_snippets.py
3. Rebuild note payloads with python tools/build_notes.py
4. Refresh the browser
"""

from __future__ import annotations

import html
import json
import re
from pathlib import Path
from typing import Any

import mistune
import yaml
from mistune.plugins.math import math as math_plugin
from bs4 import BeautifulSoup
from bs4.element import NavigableString, Tag

ROOT = Path(__file__).resolve().parents[1]
NOTES_DIR = ROOT / 'content' / 'notes'
NOTES_INDEX_PATH = ROOT / 'content' / 'notes' / 'index.json'
TYPST_MANIFEST_PATH = ROOT / 'content' / 'typst-manifest.json'
OUT_DIR = ROOT / 'content' / 'rendered'

FRONTMATTER_RE = re.compile(r'^\s*---\n(.*?)\n---\n?', re.DOTALL)


def slugify(value: str) -> str:
    """Create stable DOM ids from section headings."""
    value = value.strip().lower()
    value = value.encode('ascii', 'ignore').decode('ascii')
    value = re.sub(r'[^a-z0-9]+', '-', value)
    return value.strip('-') or 'section'


class SiteRenderer(mistune.HTMLRenderer):
    """Custom markdown renderer tailored to this site."""

    def __init__(self, typst_manifest: dict[str, str], note_slug: str):
        super().__init__()
        self.typst_manifest = typst_manifest
        self.note_slug = note_slug
        self.typst_index = 0

    def block_code(self, code: str, info: str | None = None) -> str:
        """Render fenced code blocks.

        Supported special cases:
        - mermaid  -> diagram container with readable source fallback
        - tip/note/warning -> simple callout box
        - typst    -> preview image (if precompiled) + collapsible source view
        - anything else -> standard pre/code block with language class
        """
        language = (info or '').strip().split()[0].lower() if info else ''
        escaped = html.escape(code)

        if language == 'mermaid':
            return f'<div class="mermaid">{escaped}</div>'

        if language in {'tip', 'warning', 'note'}:
            title = language.capitalize()
            content = '<br />'.join(html.escape(line) for line in code.strip().splitlines())
            return f'<div class="callout"><strong>{title}</strong><div>{content}</div></div>'

        if language == 'typst':
            self.typst_index += 1
            key = f'{self.note_slug}#{self.typst_index}'
            preview_path = self.typst_manifest.get(key)
            if preview_path:
                # JSON is injected inside notes/view.html, so the image path must be
                # relative to that page rather than to the JSON file itself.
                preview = f'<div class="typst-preview"><img src="../{preview_path}" alt="Rendered Typst block" /></div>'
            else:
                preview = (
                    '<p class="muted">No compiled Typst preview found for this block yet. '
                    'Run <code>python tools/build_typst_snippets.py</code> and then '
                    '<code>python tools/build_notes.py</code>.</p>'
                )

            return (
                '<div class="typst-block">'
                f'{preview}'
                '<details class="typst-source">'
                '<summary>Show Typst source</summary>'
                f'<pre><code class="language-markdown">{escaped}</code></pre>'
                '</details>'
                '</div>'
            )

        safe_lang = language or 'plaintext'
        return f'<pre><code class="language-{safe_lang}">{escaped}</code></pre>'


def parse_frontmatter(raw_text: str) -> tuple[dict[str, Any], str]:
    """Split a markdown file into frontmatter metadata and body."""
    match = FRONTMATTER_RE.match(raw_text)
    if not match:
        return {}, raw_text

    metadata = yaml.safe_load(match.group(1)) or {}
    body = raw_text[match.end() :]
    return metadata, body


def load_note_index() -> dict[str, dict[str, Any]]:
    """Load per-note metadata keyed by slug for quick lookups."""
    if not NOTES_INDEX_PATH.exists():
        return {}
    data = json.loads(NOTES_INDEX_PATH.read_text(encoding='utf-8'))
    return {entry['slug']: entry for entry in data}


def load_typst_manifest() -> dict[str, str]:
    """Load the optional Typst preview manifest."""
    if not TYPST_MANIFEST_PATH.exists():
        return {}
    return json.loads(TYPST_MANIFEST_PATH.read_text(encoding='utf-8'))


def build_markdown(note_slug: str, body: str, typst_manifest: dict[str, str]) -> str:
    """Convert markdown into HTML using Mistune and the custom renderer."""
    renderer = SiteRenderer(typst_manifest=typst_manifest, note_slug=note_slug)
    markdown = mistune.create_markdown(
        renderer=renderer,
        plugins=['strikethrough', 'table', 'url', 'task_lists', math_plugin],
    )
    return markdown(body)


def wrap_top_level_sections(rendered_html: str) -> tuple[str, list[dict[str, str]], bool]:
    """Turn top-level H2 sections into collapsible <details> blocks.

    The reading list and other long notes use H2 headings as primary buckets.
    Wrapping them here keeps the runtime JavaScript small and predictable.
    """
    soup = BeautifulSoup(rendered_html, 'html.parser')
    root = soup.new_tag('div')
    toc: list[dict[str, str]] = []
    current_body: Tag | None = None

    for node in list(soup.contents):
        if isinstance(node, NavigableString) and not node.strip():
            continue

        if isinstance(node, Tag) and node.name == 'h2':
            label = node.get_text(' ', strip=True) or 'Section'
            section_id = f'section-{slugify(label)}'

            details = soup.new_tag('details', attrs={'class': 'note-section', 'id': section_id, 'open': ''})
            summary = soup.new_tag('summary')
            summary.string = label
            body = soup.new_tag('div', attrs={'class': 'note-section-body'})

            details.append(summary)
            details.append(body)
            root.append(details)
            current_body = body
            toc.append({'id': section_id, 'label': label})
            continue

        target = current_body or root
        target.append(node.extract() if hasattr(node, 'extract') else node)

    html_out = ''.join(str(child) for child in root.contents)
    requires_mermaid = 'class="mermaid"' in html_out
    return html_out, toc, requires_mermaid


def build_note_payload(note_path: Path, note_index: dict[str, dict[str, Any]], typst_manifest: dict[str, str]) -> dict[str, Any]:
    """Build the JSON payload consumed by the browser note viewer."""
    slug = note_path.stem
    raw_text = note_path.read_text(encoding='utf-8')
    frontmatter, body = parse_frontmatter(raw_text)
    archive_meta = note_index.get(slug, {})

    rendered_html = build_markdown(slug, body, typst_manifest)
    wrapped_html, toc, requires_mermaid = wrap_top_level_sections(rendered_html)

    return {
        'slug': slug,
        'title': frontmatter.get('title') or archive_meta.get('title') or slug,
        'date': str(frontmatter.get('date') or archive_meta.get('date') or ''),
        'tags': archive_meta.get('tags', []),
        'html': wrapped_html,
        'toc': toc,
        'requiresMermaid': requires_mermaid,
    }


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    note_index = load_note_index()
    typst_manifest = load_typst_manifest()

    built = 0
    for note_path in sorted(NOTES_DIR.glob('*.md')):
        payload = build_note_payload(note_path, note_index, typst_manifest)
        output_path = OUT_DIR / f'{note_path.stem}.json'
        output_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding='utf-8')
        built += 1
        print(f'[ok] {output_path.relative_to(ROOT)}')

    print(f'Built {built} rendered note payload(s).')


if __name__ == '__main__':
    main()
