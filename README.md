# Minimal personal site

A static personal site inspired by the structure of neil.computer, but kept intentionally lightweight and maintainable.

This version is built around two ideas:

1. **The site stays static** — plain HTML, CSS, JavaScript, JSON, Markdown, and PDFs.
2. **Long notes are pre-rendered** — the browser loads prepared HTML instead of parsing large markdown files on every page visit.

That second change is what fixes the slow note-loading issue from the previous version.

## Features

- No backend
- Static HTML/CSS/JS only
- Easy deploy to GitHub Pages / Netlify / Cloudflare Pages
- Personal information box with PDF links for:
  - **CV**
  - **Technical Thesis**
  - **Bachelor Thesis**
  - **PhD Thesis**
- Notes archive and single-note pages
- Separate **Papers / talks / etc** archive
- Home page tabbed preview for notes vs. papers/resources
- Collapsible sections + sticky table of contents for long notes like the reading list
- Collapsible sections + thumbnails for the resources archive page
- Light/dark mode toggle
- Fonts controlled in code only through `content/site.json`
- Self-hosted Mozilla Text webfonts
- Markdown notes with:
  - LaTeX via self-hosted MathJax
  - syntax highlighting via self-hosted Prism
  - optional Mermaid runtime loading only when a note actually needs it
  - optional Typst preview blocks via precompiled SVG

## Fastest way to run it locally

From the project root:

```bash
python -m http.server
```

Then open:

```text
http://localhost:8000
```

Do not open `index.html` directly with `file://`, because the site fetches JSON files and rendered note payloads.

## Editing workflow

### 1) Personal/site-wide info

Edit these files:

- `content/profile.json` — homepage bio, links, documents, projects
- `content/site.json` — fonts, default theme, color palette
- `content/resources/index.json` — papers / talks / external resources list
- `content/notes/index.json` — note titles, dates, tags shown in the archive

### 2) Note content

Write your note in:

- `content/notes/<slug>.md`

Then rebuild rendered note payloads:

```bash
python tools/build_notes.py
```

This writes pre-rendered files into:

- `content/rendered/<slug>.json`

The note viewer reads those rendered JSON files directly. That is why notes now load much faster.

### 3) Typst blocks inside notes

If a note contains fenced `typst` blocks, run:

```bash
python tools/build_typst_snippets.py
python tools/build_notes.py
```

The first command creates SVG previews, and the second command rebuilds the note payload so those previews appear in the page.

## Fonts

Fonts are configured only in code.

Edit `content/site.json`:

```json
{
  "fonts": {
    "body": "'Mozilla Text', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    "heading": "'Mozilla Text', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    "mono": "ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace"
  }
}
```

The actual Mozilla font files live in `assets/fonts/` and are loaded by `assets/style.css` using `@font-face`.

## PDFs

Place your PDFs here:

- `docs/cv.pdf`
- `docs/technical-thesis.pdf`
- `docs/bachelor-thesis.pdf`
- `docs/phd-thesis.pdf`

The homepage document links come from `content/profile.json`.

## Notes authoring guide

Supported note content:

- normal Markdown
- inline math: `$a^2+b^2=c^2$`
- display math:

```text
$$
\int_0^1 x^2\,dx = 1/3
$$
```

- Mermaid blocks:

~~~markdown
```mermaid
graph TD
  A --> B
```
~~~

- callouts:

~~~markdown
```tip
Short note to self.
```
~~~

- Typst blocks:

~~~markdown
```typst
#set page(width: auto, height: auto)
$ integral_0^1 x^2 dif x = 1/3 $
```
~~~

Top-level `##` headings become collapsible sections automatically and populate the sticky contents panel.

## Project structure

Read `ARCHITECTURE.md` first if you want the maintainability overview.

Quick summary:

- `index.html` — homepage shell
- `notes/index.html` — notes archive shell
- `notes/view.html` — single-note shell
- `resources/index.html` — papers/resources archive shell
- `assets/common.js` — shared theme/font bootstrap
- `assets/site.js` — homepage + archive rendering
- `assets/note.js` — note-page rendering logic
- `assets/style.css` — all styling + font-face declarations
- `content/` — editable data/content
- `tools/` — build helpers for rendered notes and Typst previews

## Deployment

Because everything is static, deployment is simply “upload the folder.”

Good options:

- GitHub Pages
- Netlify
- Cloudflare Pages

The only thing to remember is: after editing notes, commit the regenerated `content/rendered/*.json` files too.
