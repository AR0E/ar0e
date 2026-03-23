import { initAppearance } from './common.js';

// Note viewer.
//
// Important design change:
// notes are now pre-rendered to JSON by tools/build_notes.py.
// That means the browser no longer downloads and parses large markdown files on
// every visit, which fixes the sluggish note loading the user reported.

const params = new URLSearchParams(window.location.search);
const slug = params.get('slug') || 'minimal-static-site';
const renderedPath = new URL(`../content/rendered/${slug}.json`, import.meta.url);

async function loadRenderedNote(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load rendered note: ${url}`);
  }
  return response.json();
}

async function waitForMathJax(timeoutMs = 4000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (window.MathJax?.typesetPromise) {
      return window.MathJax;
    }
    await new Promise((resolve) => window.setTimeout(resolve, 25));
  }
  return null;
}

async function renderMath(container) {
  const mathJax = await waitForMathJax();
  if (!mathJax) {
    console.warn('MathJax did not become available in time.');
    return;
  }
  await mathJax.typesetPromise([container]);
}

function renderToc(toc) {
  if (!Array.isArray(toc) || !toc.length) {
    return '';
  }
  return toc.map((item) => `<a href="#${item.id}">${item.label}</a>`).join('');
}

function applySyntaxHighlighting(container) {
  if (window.Prism?.highlightAllUnder) {
    window.Prism.highlightAllUnder(container);
  }
}

function addMermaidFallbackNotice(block) {
  if (block.previousElementSibling?.classList?.contains('mermaid-status')) {
    return;
  }
  const note = document.createElement('p');
  note.className = 'muted mermaid-status';
  note.textContent = 'Mermaid could not be loaded, so the diagram source is shown instead.';
  block.before(note);
}

function loadExternalScript(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[data-src="${src}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.dataset.src = src;
    script.addEventListener('load', () => resolve(), { once: true });
    script.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)), { once: true });
    document.head.appendChild(script);
  });
}

/**
 * Mermaid is the only runtime dependency that remains remote.
 * It now loads lazily and only for notes that actually contain diagrams, so
 * ordinary markdown notes no longer wait on it.
 */
async function renderMermaid(container) {
  const blocks = Array.from(container.querySelectorAll('.mermaid'));
  if (!blocks.length) {
    return;
  }

  try {
    if (!window.mermaid) {
      await loadExternalScript('https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js');
    }
    const theme = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'default';
    window.mermaid.initialize({ startOnLoad: false, theme });
    await window.mermaid.run({ nodes: blocks });
  } catch (error) {
    console.warn(error);
    blocks.forEach(addMermaidFallbackNotice);
  }
}

async function main() {
  await initAppearance();
  const rendered = await loadRenderedNote(renderedPath);

  document.title = rendered.title;
  document.getElementById('note-title').textContent = rendered.title;
  const tags = rendered.tags?.length ? ` · ${rendered.tags.join(' · ')}` : '';
  document.getElementById('note-meta').textContent = `${rendered.date || ''}${tags}`;

  const container = document.getElementById('note-content');
  container.innerHTML = rendered.html;

  const tocMarkup = renderToc(rendered.toc || []);
  const tocPanel = document.getElementById('note-toc-panel');
  const tocContainer = document.getElementById('note-toc');
  if (tocPanel && tocContainer && tocMarkup) {
    tocContainer.innerHTML = tocMarkup;
    tocPanel.hidden = false;
  }

  await renderMath(container);
  applySyntaxHighlighting(container);
  await renderMermaid(container);

  // Mermaid themes are chosen at render time, so a theme switch is simplest if
  // it re-renders the page once.
  document.addEventListener(
    'site-theme-change',
    () => {
      if (container.querySelector('.mermaid')) {
        window.location.reload();
      }
    },
    { once: true },
  );
}

main().catch((error) => {
  console.error(error);
  document.getElementById('note-content').innerHTML = `
    <p>Failed to load this note.</p>
    <p class="muted">If you recently edited a markdown file, rebuild the rendered notes first:</p>
    <pre><code>python tools/build_notes.py</code></pre>
  `;
});
