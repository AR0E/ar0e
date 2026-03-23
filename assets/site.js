import { initAppearance, loadJson, slugify } from './common.js';

// Homepage and archive page renderer.
//
// Philosophy:
// - keep content in JSON
// - keep templates in this file
// - keep HTML pages very small and declarative

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function toneClass(tone) {
  return tone ? `tone-${tone}` : 'tone-blue';
}

/**
 * Small abstract thumbnail used only in archive/detail contexts.
 * The homepage intentionally no longer shows thumbnails.
 */
function buildThumbMarkup({ title, subtitle = '', tone = 'blue', type = 'item' }) {
  const initial = (title || type || '?').trim().charAt(0).toUpperCase();
  return `
    <div class="mini-thumb ${toneClass(tone)}">
      <span class="mini-thumb-mark">${escapeHtml(initial)}</span>
      <span class="mini-thumb-type">${escapeHtml(type)}</span>
      <span class="mini-thumb-subtitle">${escapeHtml(subtitle || title)}</span>
    </div>
  `;
}

function renderPersonalInfo(profile) {
  const documents = (profile.documents || [])
    .map((item) => `<a href="${item.url}">${item.label}</a>`)
    .join('<br />');

  const rows = [
    ['Name', profile.name],
    ['Occupation', profile.occupation],
    ['Previous', profile.previous.join('<br />')],
    [
      'Employer',
      profile.employer.url ? `<a href="${profile.employer.url}">${profile.employer.name}</a>` : profile.employer.name,
    ],
    ['Location', profile.location],
    ['Education', profile.education.join('<br />')],
    ['Contact', `<a href="mailto:${profile.email}">${profile.email}</a><br />${profile.phone}`],
    ['Documents', documents],
  ];

  return `
    <table class="info-table">
      <tbody>
        ${rows
          .map(
            ([label, value]) => `
              <tr>
                <td>${label}</td>
                <td>${value}</td>
              </tr>
            `,
          )
          .join('')}
      </tbody>
    </table>
  `;
}

function renderNow(profile) {
  const items = profile.now.map((item) => `<li>${item}</li>`).join('');
  return `<ul>${items}</ul>`;
}

/**
 * Shared table renderer for notes.
 * Thumbnails are intentionally disabled here; the user asked for them to live
 * in dedicated pages rather than on the homepage.
 */
function renderNotesTable(notes, basePath, limit = notes.length) {
  const sliced = notes.slice(0, limit);
  return `
    <table class="notes-table">
      <thead>
        <tr>
          <th>Date</th>
          <th>Title</th>
          <th>Link</th>
        </tr>
      </thead>
      <tbody>
        ${sliced
          .map((note) => {
            const href = `${basePath}view.html?slug=${note.slug}`;
            return `
              <tr>
                <td>${note.date}</td>
                <td>
                  <div class="meta-stack">
                    <a href="${href}">${note.title}</a>
                    <div class="tag-row">${(note.tags || []).map((tag) => `<span class="tag">${tag}</span>`).join('')}</div>
                  </div>
                </td>
                <td><a href="${href}">Read →</a></td>
              </tr>
            `;
          })
          .join('')}
      </tbody>
    </table>
  `;
}

/**
 * Lightweight homepage resource preview. No thumbnails here by request.
 */
function renderResourcesTable(items, basePrefix, limit = items.length) {
  const sliced = items.slice(0, limit);
  return `
    <table class="notes-table">
      <thead>
        <tr>
          <th>Date</th>
          <th>Item</th>
          <th>Type</th>
        </tr>
      </thead>
      <tbody>
        ${sliced
          .map((item) => {
            const href = item.noteSlug ? `${basePrefix}notes/view.html?slug=${item.noteSlug}` : item.url;
            const title = href ? `<a href="${href}">${item.title}</a>` : item.title;
            return `
              <tr>
                <td>${item.date || ''}</td>
                <td>
                  <div class="meta-stack">
                    <div>${title}</div>
                    <div class="muted">${item.source || ''}</div>
                    <div class="tag-row">${(item.tags || []).map((tag) => `<span class="tag">${tag}</span>`).join('')}</div>
                  </div>
                </td>
                <td>${item.type || ''}</td>
              </tr>
            `;
          })
          .join('')}
      </tbody>
    </table>
  `;
}

function renderLinkedList(items) {
  return items
    .map((item) => `<li>${item.url ? `<a href="${item.url}">${item.label}</a>` : item.label}</li>`)
    .join('');
}

/**
 * Projects now render as a plain linked list with descriptions.
 * This keeps the homepage lighter and leaves thumbnails to dedicated pages.
 */
function renderProjects(items) {
  return `
    <ul class="plain-list project-list">
      ${items
        .map(
          (item) => `
            <li>
              <a class="project-link" href="${item.url || '#'}">${item.label}</a>
              ${item.description ? `<div class="muted project-description">${item.description}</div>` : ''}
            </li>
          `,
        )
        .join('')}
    </ul>
  `;
}

function initHomeTabs() {
  const buttons = Array.from(document.querySelectorAll('[data-home-tab]'));
  const panels = Array.from(document.querySelectorAll('[data-home-panel]'));

  const activate = (name) => {
    buttons.forEach((button) => {
      button.classList.toggle('is-active', button.dataset.homeTab === name);
    });
    panels.forEach((panel) => {
      panel.hidden = panel.dataset.homePanel !== name;
    });
  };

  buttons.forEach((button) => {
    button.addEventListener('click', () => activate(button.dataset.homeTab));
  });

  activate('notes');
}

function titleizeType(type) {
  return String(type || 'resources')
    .split(/[-_\s]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function sortByDateDesc(items) {
  return [...items].sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
}

function groupResources(items) {
  const map = new Map();
  for (const item of sortByDateDesc(items)) {
    const key = item.type || 'resources';
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  }
  return [...map.entries()];
}

function renderResourceCard(item, basePrefix) {
  const href = item.noteSlug ? `${basePrefix}notes/view.html?slug=${item.noteSlug}` : item.url || '#';
  const meta = [item.date, item.source].filter(Boolean).join(' · ');
  const links = [];
  if (href) links.push(`<a href="${href}">${item.noteSlug ? 'Open note' : 'Open link'}</a>`);
  return `
    <article class="resource-card">
      ${buildThumbMarkup({
        title: item.title,
        subtitle: item.source || item.type || 'resource',
        tone: item.tone || 'blue',
        type: item.type || 'resource',
      })}
      <div class="resource-copy">
        <div class="resource-kicker">${meta}</div>
        <h3><a href="${href}">${item.title}</a></h3>
        ${item.summary ? `<p>${item.summary}</p>` : ''}
        <div class="tag-row">${(item.tags || []).map((tag) => `<span class="tag">${tag}</span>`).join('')}</div>
        <div class="resource-links">${links.join(' · ')}</div>
      </div>
    </article>
  `;
}

function renderResourcesArchive(items, basePrefix = '../') {
  const groups = groupResources(items);
  const toc = groups
    .map(([type, group]) => `<a href="#section-${slugify(type)}">${titleizeType(type)} <span class="muted">(${group.length})</span></a>`)
    .join('');

  const body = groups
    .map(
      ([type, group]) => `
        <details class="resource-section" id="section-${slugify(type)}" open>
          <summary>${titleizeType(type)} <span class="muted">(${group.length})</span></summary>
          <div class="resource-group-list">
            ${group.map((item) => renderResourceCard(item, basePrefix)).join('')}
          </div>
        </details>
      `,
    )
    .join('');

  return { body, toc };
}

async function initHome() {
  const [profile, notes, resources] = await Promise.all([
    loadJson('profile.json'),
    loadJson('notes/index.json'),
    loadJson('resources/index.json'),
  ]);

  document.title = profile.name;
  document.getElementById('site-title').textContent = profile.name;
  document.getElementById('personal-information').innerHTML = renderPersonalInfo(profile);
  document.getElementById('now-box').innerHTML = renderNow(profile);
  document.getElementById('home-notes').innerHTML = renderNotesTable(notes, './notes/', 6);
  document.getElementById('home-resources').innerHTML = renderResourcesTable(resources, './', 6);
  document.getElementById('projects-list').innerHTML = renderProjects(profile.projects || []);
  document.getElementById('links-list').innerHTML = renderLinkedList(profile.links || []);
  document.getElementById('footer-copy').textContent = `© ${new Date().getFullYear()} ${profile.name}. Static HTML, no backend.`;
  initHomeTabs();
}

async function initArchive() {
  const notes = await loadJson('notes/index.json');
  document.getElementById('archive-notes').innerHTML = renderNotesTable(notes, './');
}

async function initResourcesArchive() {
  const resources = await loadJson('resources/index.json');
  const { body, toc } = renderResourcesArchive(resources, '../');
  document.getElementById('archive-resources').innerHTML = body;
  const tocPanel = document.getElementById('resource-toc-panel');
  const tocContainer = document.getElementById('resource-toc');
  if (tocPanel && tocContainer && toc) {
    tocContainer.innerHTML = toc;
    tocPanel.hidden = false;
  }
}

async function main() {
  await initAppearance();
  const page = document.body.dataset.page;
  if (page === 'home') {
    await initHome();
  }
  if (page === 'notes-archive') {
    await initArchive();
  }
  if (page === 'resources-archive') {
    await initResourcesArchive();
  }
}

main().catch((error) => {
  console.error(error);
  const shell = document.querySelector('main');
  const message = document.createElement('p');
  message.className = 'panel';
  message.textContent = 'Failed to load site content. If you are opening this locally, serve the folder with a tiny static server (for example: python -m http.server).';
  shell.append(message);
});
