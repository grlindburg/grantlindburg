import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';

const server = createApp().listen(0);
const base = () => `http://127.0.0.1:${server.address().port}`;
after(() => server.close());

test('GET /healthz returns ok', async () => {
  const res = await fetch(`${base()}/healthz`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.status, 'ok');
});

test('GET / serves the home page', async () => {
  const res = await fetch(`${base()}/`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /text\/html/);
  assert.match(await res.text(), /Grant Lindburg/);
});

test('unknown path returns the 404 page', async () => {
  const res = await fetch(`${base()}/nope`);
  assert.equal(res.status, 404);
  assert.match(await res.text(), /Not found/i);
});
