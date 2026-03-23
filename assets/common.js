// Shared utilities used by the homepage, archive pages, and note viewer.
//
// The site is intentionally tiny: JSON content files live under /content,
// the pages fetch those files directly, and this module centralizes the
// appearance bootstrap so every page behaves the same way.

const CONTENT_ROOT = new URL('../content/', import.meta.url);

/**
 * Fetch a JSON file from /content.
 *
 * Keeping all content under one root makes the site easy to reason about:
 * pages only need to know the relative content path they want to load.
 */
export async function loadJson(relativePath) {
  const url = new URL(relativePath, CONTENT_ROOT);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load ${relativePath}`);
  }
  return response.json();
}

/**
 * Push configured font stacks into CSS custom properties.
 *
 * Fonts are controlled in content/site.json instead of a UI picker, which keeps
 * the visual configuration in code and makes the homepage cleaner.
 */
function applyFonts(config) {
  const fonts = config.fonts || {};
  if (fonts.body) {
    document.documentElement.style.setProperty('--font-body', fonts.body);
  }
  if (fonts.heading) {
    document.documentElement.style.setProperty('--font-heading', fonts.heading);
  }
  if (fonts.mono) {
    document.documentElement.style.setProperty('--font-mono', fonts.mono);
  }
}

/**
 * Allow the accent palette to be configured alongside fonts and theme defaults.
 */
function applyPalette(config) {
  const palette = config.palette || {};
  for (const [token, value] of Object.entries(palette)) {
    document.documentElement.style.setProperty(`--${token}`, value);
  }
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  document.dispatchEvent(new CustomEvent('site-theme-change', { detail: { theme } }));
}

/**
 * Turn a human heading into a stable DOM id.
 */
export function slugify(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Boot the theme/fonts for the current page and wire up the light/dark toggle.
 */
export async function initAppearance() {
  const config = await loadJson('site.json');
  const themeToggle = document.getElementById('theme-toggle');

  applyFonts(config);
  applyPalette(config);

  const theme = localStorage.getItem('site-theme') || config.defaults?.theme || 'light';
  applyTheme(theme);

  if (themeToggle) {
    themeToggle.textContent = theme === 'dark' ? 'Light mode' : 'Dark mode';
    themeToggle.addEventListener('click', () => {
      const nextTheme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      localStorage.setItem('site-theme', nextTheme);
      applyTheme(nextTheme);
      themeToggle.textContent = nextTheme === 'dark' ? 'Light mode' : 'Dark mode';
    });
  }

  return { theme: document.documentElement.dataset.theme, config };
}
