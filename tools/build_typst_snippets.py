#!/usr/bin/env python3
"""
Compile ```typst fenced blocks inside content/notes/*.md into SVG files.

Requirements:
  - Python 3.10+
  - Typst CLI installed and available as `typst`

Usage:
  python tools/build_typst_snippets.py

After it finishes, rebuild the rendered note payloads as well:
  python tools/build_notes.py
"""

from __future__ import annotations

import json
import re
import shutil
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
NOTES_DIR = ROOT / "content" / "notes"
OUT_DIR = ROOT / "assets" / "generated"
MANIFEST_PATH = ROOT / "content" / "typst-manifest.json"
BLOCK_RE = re.compile(r"```typst\n(.*?)```", re.DOTALL)


def ensure_typst() -> str:
    binary = shutil.which("typst")
    if not binary:
        raise SystemExit(
            "Typst CLI was not found. Install it first, then rerun this script.\n"
            "Docs: https://typst.app/docs/reference/"
        )
    return binary


def main() -> None:
    typst_bin = ensure_typst()
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    manifest: dict[str, str] = {}

    for note_path in sorted(NOTES_DIR.glob("*.md")):
        slug = note_path.stem
        text = note_path.read_text(encoding="utf-8")
        blocks = BLOCK_RE.findall(text)

        for i, block in enumerate(blocks, start=1):
            src_path = OUT_DIR / f"{slug}-{i}.typ"
            svg_path = OUT_DIR / f"{slug}-{i}.svg"
            src_path.write_text(block.strip() + "\n", encoding="utf-8")

            command = [typst_bin, "compile", str(src_path), str(svg_path), "--format", "svg"]
            result = subprocess.run(command, capture_output=True, text=True)
            if result.returncode != 0:
                print(f"[warn] Failed to compile {src_path.name}:\n{result.stderr.strip()}\n")
                continue

            manifest[f"{slug}#{i}"] = f"assets/generated/{svg_path.name}"
            print(f"[ok] {svg_path.name}")

    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(f"Wrote manifest to {MANIFEST_PATH}")


if __name__ == "__main__":
    main()
