import { test } from 'node:test';
import assert from 'node:assert/strict';
import { escapeHtml, validateSite, renderPage, loadSite } from '../src/render.js';

const minimal = () => ({
  person: { name: 'A', tagline: 't', jobTitle: 'j', email: 'a@b.c', url: 'https://x', links: [] },
  meta: { title: 'T', description: 'D' },
  eras: [{
    id: 'one', dialect: 'terminal', years: '2014', title: 'One', role: 'r', org: 'o',
    summary: 's', projects: [{ title: 'P', outcome: 'did a thing' }], lesson: 'l',
  }],
});

test('escapeHtml neutralises markup', () => {
  assert.equal(escapeHtml(`<script>alert("x")</script> & 'q'`),
    '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;q&#39;');
});

test('validateSite accepts a minimal site', () => {
  assert.doesNotThrow(() => validateSite(minimal()));
});

test('validateSite rejects missing fields, bad dialects, duplicate ids', () => {
  const noLesson = minimal(); delete noLesson.eras[0].lesson;
  assert.throws(() => validateSite(noLesson), /lesson/);
  const badDialect = minimal(); badDialect.eras[0].dialect = 'nope';
  assert.throws(() => validateSite(badDialect), /dialect/);
  const dup = minimal(); dup.eras.push({ ...minimal().eras[0] });
  assert.throws(() => validateSite(dup), /unique/);
  const noProjects = minimal(); noProjects.eras[0].projects = [];
  assert.throws(() => validateSite(noProjects), /projects/);
});

test('renderPage escapes content and inlines data safely', async () => {
  const site = minimal();
  site.person.name = 'Grant </script><b>';
  site.eras[0].title = '<img onerror=x>';
  const html = await renderPage(site);
  assert.doesNotMatch(html, /<img onerror/);
  assert.match(html, /&lt;img onerror=x&gt;/);
  // inlined JSON must not be able to close the script tag
  const blob = html.match(/<script type="application\/json" id="site-data">([\s\S]*?)<\/script>/)[1];
  assert.doesNotMatch(blob, /<\/script>/i);
  assert.equal(JSON.parse(blob).person.name, 'Grant </script><b>');
});

test('renderPage marks placeholder eras and projects', async () => {
  const site = minimal();
  site.eras[0].placeholder = true;
  site.eras[0].projects[0].placeholder = true;
  const html = await renderPage(site);
  assert.match(html, /era__badge/);
  assert.match(html, /card__badge/);
});

test('renderPage leaves no unfilled slots', async () => {
  const html = await renderPage(minimal());
  assert.doesNotMatch(html, /<!--slot:/);
});

test('the real eras.json is valid', async () => {
  const site = await loadSite();
  assert.doesNotThrow(() => validateSite(site));
  assert.ok(site.eras.length >= 4);
});

test('renderPage links single words inside a project title', async () => {
  const site = minimal();
  site.eras[0].projects[0].title = 'Cove and Spinach <b>';
  site.eras[0].projects[0].links = { Spinach: 'https://spinachcannabis.com/?q="x"' };
  const html = await renderPage(site);
  assert.match(html, /<h3 class="card__title">Cove and <a class="card__word" href="https:\/\/spinachcannabis\.com\/\?q=&quot;x&quot;" target="_blank" rel="noopener">Spinach<\/a> &lt;b&gt;<\/h3>/);
});

test('era links open external hrefs in a new tab but not in-page ones', async () => {
  const site = minimal();
  site.eras[0].projects.push({ title: 'Ext', href: 'https://example.com', outcome: 'o' });
  site.eras[0].projects.push({ title: 'Local', href: '#top', outcome: 'o' });
  const html = await renderPage(site);
  assert.match(html, /href="https:\/\/example\.com" target="_blank" rel="noopener"/);
  assert.match(html, /<a class="card__link" href="#top">Local/);
});
