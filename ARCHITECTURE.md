# Architecture and maintenance guide

This file explains how the site is wired together so it is easy to modify later.

## 1. High-level mental model

There are only three kinds of files in the project:

### A. Page shells
These are the actual HTML pages:

- `index.html`
- `notes/index.html`
- `notes/view.html`
- `resources/index.html`

Each shell is intentionally thin. It mostly provides containers like `#personal-information` or `#note-content` that JavaScript fills in.

### B. Content/data files
These hold the content you actually edit:

- `content/profile.json`
- `content/site.json`
- `content/resources/index.json`
- `content/notes/index.json`
- `content/notes/*.md`
- `docs/*.pdf`

Think of this folder as the source of truth for the site.

### C. Rendering/build logic
These files transform content into the final UI:

- `assets/common.js`
- `assets/site.js`
- `assets/note.js`
- `assets/style.css`
- `tools/build_notes.py`
- `tools/build_typst_snippets.py`

## 2. How the homepage works

`index.html` is mostly layout scaffolding.

When the page loads:

1. `assets/site.js` runs.
2. It calls `initAppearance()` from `assets/common.js`.
3. `initAppearance()` loads `content/site.json`.
4. The selected font stacks, palette tokens, and theme are applied to CSS variables.
5. `assets/site.js` then loads:
   - `content/profile.json`
   - `content/notes/index.json`
   - `content/resources/index.json`
6. It renders those into the homepage containers.

Important: the homepage does **not** load full note markdown files. It only loads note metadata from `content/notes/index.json`.

## 3. How the notes archive works

`notes/index.html` also runs `assets/site.js`.

That page only needs `content/notes/index.json`, so it renders quickly and stays simple.

## 4. How an individual note works

`notes/view.html` is different from the archive pages.

It loads:

- `assets/note.js`
- self-hosted MathJax
- self-hosted Prism

Then `assets/note.js` fetches:

- `content/rendered/<slug>.json`

That rendered JSON contains:

- the title
- the date
- the tags
- the already-built HTML body
- the table-of-contents entries
- a flag saying whether Mermaid is present

This means the browser no longer has to parse the raw markdown file at runtime.

## 5. Why notes are pre-rendered now

Earlier versions fetched the raw markdown and parsed it in the browser.
That had two downsides:

1. large notes felt slow
2. pages depended on more runtime libraries/CDNs

The current version moves markdown parsing to `tools/build_notes.py`.

So the browser now only:

- fetches a JSON payload
- inserts ready HTML
- typesets math
- highlights code
- optionally renders Mermaid if needed

## 6. How `tools/build_notes.py` works

This is the most important build helper in the project.

For every `content/notes/*.md` file it:

1. reads frontmatter
2. reads matching metadata from `content/notes/index.json`
3. converts markdown to HTML with custom rules
4. turns top-level `##` headings into collapsible `<details>` sections
5. builds a table of contents from those sections
6. injects Typst preview images if they exist
7. writes the result to `content/rendered/<slug>.json`

So after editing markdown, you should always run:

```bash
python tools/build_notes.py
```

## 7. How Typst previews work

Typst is handled separately from ordinary markdown.

`tools/build_typst_snippets.py`:

1. scans note markdown for fenced `typst` blocks
2. writes each block into a temporary `.typ` file
3. asks the Typst CLI to compile that block to SVG
4. stores the SVG in `assets/generated/`
5. records the SVG path in `content/typst-manifest.json`

Then `tools/build_notes.py` reads that manifest and inserts the corresponding preview image into the rendered note payload.

So the full Typst workflow is:

```bash
python tools/build_typst_snippets.py
python tools/build_notes.py
```

## 8. How Mermaid is handled

Mermaid is the one intentionally lazy dependency.

Why:

- many notes do not need it
- loading it on every note page is wasteful
- making it lazy keeps ordinary notes fast

So the process is:

1. the note body is rendered immediately
2. `assets/note.js` checks whether `.mermaid` blocks exist
3. only then does it try to load Mermaid
4. if Mermaid cannot load, the diagram source still remains visible as readable text

## 9. Where to change the fonts

There are two font-related places:

### A. Actual font files
Stored in:

- `assets/fonts/`

### B. Which font stacks the site uses
Configured in:

- `content/site.json`

The CSS variable wiring happens in:

- `assets/common.js`
- `assets/style.css`

So if you want to swap fonts later, the usual steps are:

1. add the font files to `assets/fonts/`
2. update `@font-face` blocks in `assets/style.css`
3. update `content/site.json`

## 10. Where to change colors

The simple color blocks are controlled by CSS variables:

- `--rose`
- `--violet`
- `--blue`
- `--teal`
- `--amber`

Default values live in:

- `assets/style.css`

Runtime overrides come from:

- `content/site.json`

And are applied by:

- `assets/common.js`

## 11. Where to change homepage sections

### About box
Edit `content/profile.json`

### Now box
Edit `content/profile.json`

### Projects section
Edit `content/profile.json`

### Elsewhere links
Edit `content/profile.json`

### Home page notes preview
Edit `content/notes/index.json`

### Home page papers/resources preview
Edit `content/resources/index.json`

## 12. Safe maintenance workflow

When making changes later, this sequence is the least error-prone:

1. edit content files first
2. rebuild rendered notes if markdown changed
3. run `python -m http.server`
4. check the site locally
5. commit both source files and generated files

## 13. Files that are generated and should usually be committed

These are build outputs, but they are part of the deployable static site:

- `content/rendered/*.json`
- `content/typst-manifest.json`
- `assets/generated/*.svg` (when Typst previews exist)

Committing them is useful because GitHub Pages and similar hosts can then serve the site without any build step.
