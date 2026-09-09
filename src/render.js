import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, '..', 'public', 'data', 'eras.json');
const VIEWS_DIR = path.join(__dirname, 'views');
const DIALECTS = new Set(['ai', 'webgl', 'editorial', 'terminal']);

export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

const e = escapeHtml;

export async function loadSite() {
  const site = JSON.parse(await fs.readFile(DATA_FILE, 'utf8'));
  validateSite(site);
  return site;
}

export function validateSite(site) {
  const fail = (msg) => { throw new Error(`eras.json: ${msg}`); };
  if (!site?.person?.name) fail('person.name is required');
  if (!site.person.email) fail('person.email is required');
  if (!site.meta?.title) fail('meta.title is required');
  if (!Array.isArray(site.eras) || site.eras.length === 0) fail('eras must be a non-empty array');
  const ids = new Set();
  for (const era of site.eras) {
    for (const key of ['id', 'dialect', 'years', 'title', 'lesson']) {
      if (!era[key]) fail(`era "${era.id ?? '?'}" is missing ${key}`);
    }
    if (!DIALECTS.has(era.dialect)) fail(`era "${era.id}" has unknown dialect "${era.dialect}"`);
    if (ids.has(era.id)) fail(`era ids must be unique ("${era.id}")`);
    ids.add(era.id);
    if (!Array.isArray(era.projects) || era.projects.length === 0) fail(`era "${era.id}" needs at least one entry in projects`);
    for (const p of era.projects) {
      if (!p.title || !p.outcome) fail(`era "${era.id}" has a project missing title or outcome`);
    }
  }
  return site;
}

// ---------- partials ----------

const partialCache = new Map();
async function partial(name) {
  const file = path.join(VIEWS_DIR, 'partials', name);
  if (process.env.NODE_ENV === 'production' && partialCache.has(file)) return partialCache.get(file);
  const text = await fs.readFile(file, 'utf8');
  partialCache.set(file, text);
  return text;
}

function renderLinks(links, cls) {
  return links.map((l) => `<a class="${cls}" href="${e(l.href)}" rel="me noopener">${e(l.label)}</a>`).join('\n');
}

function renderHero(site) {
  const { person, eras } = site;
  const index = eras.map((era) => `
      <li data-strata="${e(era.dialect)}"><a href="#era-${e(era.id)}"><span class="index__years">${e(era.years)}</span><span class="index__title">${e(era.title)}</span></a></li>`).join('');
  const contact = [
    person.location ? `<li>${e(person.location)}</li>` : '',
    `<li><a href="mailto:${e(person.email)}">${e(person.email)}</a></li>`,
    ...person.links.map((l) => `<li><a href="${e(l.href)}" rel="me noopener">${e(l.label)}</a></li>`),
  ].join('\n      ');
  const skills = (person.skills ?? []).map((g) => `
        <div class="skills__group">
          <dt>${e(g.label)}</dt>
          <dd>${g.items.map(e).join(', ')}</dd>
        </div>`).join('');
  const edu = person.education;
  return `
<header class="hero" id="top">
  <div class="hero__inner">
    <h1 class="hero__name">${e(person.name)}</h1>
    ${person.title ? `<p class="hero__title">${e(person.title)}</p>` : ''}
    <ul class="hero__contact" aria-label="Contact">
      ${contact}
    </ul>
    <div class="hero__body">
      <div class="hero__summary">
        ${person.summary ? `<p>${e(person.summary)}</p>` : ''}
        ${person.jobTitle ? `<p class="hero__now">Currently ${e(person.jobTitle)}.</p>` : ''}
        ${edu ? `<p class="hero__education">${e(edu.degree)}, ${e(edu.school)}, ${e(edu.years)}.</p>` : ''}
      </div>
      ${skills ? `<dl class="skills">${skills}
      </dl>` : ''}
    </div>
  </div>
  <nav class="index" aria-label="Eras">
    <p class="index__label">Experience, newest first</p>
    <ol class="index__list">${index}
    </ol>
  </nav>
</header>`;
}

function renderStack(stack = []) {
  if (!stack.length) return '';
  return `<ul class="card__stack" aria-label="Stack">${stack.map((s) => `<li>${e(s)}</li>`).join('')}</ul>`;
}

function renderCard(p, i) {
  const title = p.href
    ? `<a class="card__link" href="${e(p.href)}"${/^https?:/.test(p.href) ? ' rel="noopener"' : ''}>${e(p.title)}</a>`
    : e(p.title);
  return `
      <li class="card" style="--i:${i}"${p.placeholder ? ' data-placeholder' : ''}>
        ${p.placeholder ? '<span class="card__badge">sample</span>' : ''}
        <h3 class="card__title">${title}</h3>
        ${p.role ? `<p class="card__role">${e(p.role)}</p>` : ''}
        <p class="card__outcome">${e(p.outcome)}</p>
        ${renderStack(p.stack)}
      </li>`;
}

async function renderDialectExtra(era) {
  if (era.dialect === 'ai') {
    const log = (era.extras?.log ?? []).map((line, i) => `<li style="--i:${i}">${e(line)}</li>`).join('\n');
    const diagram = await partial('diagram-ai.svg');
    return `
    <div class="ai__stage">
      ${diagram}
      <ol class="ai__log" aria-label="Agent trace">${log}</ol>
    </div>`;
  }
  if (era.dialect === 'webgl') {
    const { site, instagram } = era.extras ?? {};
    return `
    <div class="stage" data-stage data-era="${e(era.id)}">
      <p class="stage__hint">${site ? `<a href="${e(site)}" rel="noopener">Enter the garden ↗</a>` : ''}${instagram ? ` <a href="${e(instagram)}" rel="noopener">Experiments on Instagram ↗</a>` : ''}</p>
    </div>`;
  }
  return '';
}

async function renderEra(era, i) {
  const prompt = era.dialect === 'terminal' && era.extras?.prompt ? ` data-prompt="${e(era.extras.prompt)}"` : '';
  return `
<section class="era" id="era-${e(era.id)}" data-dialect="${e(era.dialect)}" aria-labelledby="era-${e(era.id)}-title" style="--n:${i}"${prompt}>
  <div class="era__inner">
    <header class="era__head">
      <p class="era__years">${e(era.years)}</p>
      <h2 class="era__title" id="era-${e(era.id)}-title">${e(era.title)}</h2>
      <p class="era__role">${e(era.role)}</p>
      ${era.org ? `<p class="era__org">${e(era.org)}</p>` : ''}
      <p class="era__summary">${e(era.summary)}</p>
      ${era.placeholder ? '<p class="era__badge">Sample entries · real projects landing soon</p>' : ''}
    </header>
    ${await renderDialectExtra(era)}
    <ul class="cards">${era.projects.map(renderCard).join('')}
    </ul>
    <p class="era__lesson"><span class="era__lesson-label">What this era taught me</span> ${e(era.lesson)}</p>
  </div>
</section>`;
}

function renderFooter(site) {
  const { person } = site;
  const email = person.footerEmail ?? person.email;
  return `
<footer class="footer">
  <div class="footer__inner">
    <p class="footer__cta">Building something that needs true creative systems behind it?<br><br>Reach out: <a href="mailto:${e(email)}">${e(email)}</a></p>
    <nav class="footer__links" aria-label="Profiles">${renderLinks(person.links, 'footer__link')}</nav>
    <p class="footer__meta">${e(person.shortName ?? person.name)}, ${e(person.location ?? '')}. <a href="#top">Back to top</a></p>
  </div>
</footer>`;
}

function renderJsonLd(site) {
  const { person } = site;
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: person.name,
    jobTitle: person.jobTitle,
    email: `mailto:${person.email}`,
    url: person.url,
    sameAs: person.links.map((l) => l.href),
  };
  return safeJson(data);
}

// JSON that cannot break out of a <script> element.
function safeJson(value) {
  return JSON.stringify(value).replaceAll('<', '\\u003c').replaceAll('\u2028', '\\u2028').replaceAll('\u2029', '\\u2029');
}

export async function renderPage(site) {
  const template = await partial('../index.html');
  const eras = [];
  for (const [i, era] of site.eras.entries()) eras.push(await renderEra(era, i));
  const slots = {
    title: e(site.meta.title),
    description: e(site.meta.description),
    url: e(site.person.url),
    jsonld: renderJsonLd(site),
    hero: renderHero(site),
    eras: eras.join('\n'),
    footer: renderFooter(site),
    data: safeJson(site),
  };
  return template.replace(/<!--slot:(\w+)-->/g, (m, name) => {
    if (!(name in slots)) throw new Error(`template references unknown slot "${name}"`);
    return slots[name];
  });
}
