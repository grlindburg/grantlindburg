import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import site from '../public/data/eras.json' with { type: 'json' };

const server = createApp().listen(0);
const base = () => `http://127.0.0.1:${server.address().port}`;
after(() => server.close());

test('GET /healthz returns ok', async () => {
  const res = await fetch(`${base()}/healthz`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.status, 'ok');
});

test('GET / serves the rendered home page', async () => {
  const res = await fetch(`${base()}/`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /text\/html/);
  const html = await res.text();
  assert.match(html, /Grant Lindburg/);
  for (const era of site.eras) {
    assert.match(html, new RegExp(`id="era-${era.id}"`), `era ${era.id} rendered`);
    assert.ok(html.includes(era.title), `era title "${era.title}" rendered`);
  }
  assert.match(html, /<script type="application\/ld\+json">/);
  assert.match(html, /property="og:title"/);
  assert.match(html, /id="site-data"/);
});

test('GET /data/eras.json serves the content file', async () => {
  const res = await fetch(`${base()}/data/eras.json`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /application\/json/);
  const body = await res.json();
  assert.equal(body.person.name, 'Grant Lindburg');
});

test('unknown path returns the 404 page', async () => {
  const res = await fetch(`${base()}/nope`);
  assert.equal(res.status, 404);
  assert.match(await res.text(), /Not found/i);
});
