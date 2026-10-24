// Offline tests for the optional HUWISE_APIKEY. No network: a fake Playwright target and a local fake server.
// The key value used here is a dummy.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { apiKey, isPortalApiUrl, withApiKey, routeApiKey } from '../apikey.mjs';

const KEY = 'dummy-key-123';
const ENV = { HUWISE_APIKEY: KEY };
const API = 'https://data.gr.ch/api/explore/v2.1/catalog/datasets/x/records?limit=1';

test('apiKey reads the env var only, blank counts as unset', () => {
  assert.equal(apiKey(ENV), KEY);
  assert.equal(apiKey({}), null);
  assert.equal(apiKey({ HUWISE_APIKEY: '  ' }), null);
});

test('isPortalApiUrl accepts only https data.gr.ch API paths', () => {
  assert.ok(isPortalApiUrl(API));
  assert.ok(isPortalApiUrl('https://data.gr.ch/api/datasets/1.0/x/?lang=de'));
  assert.ok(isPortalApiUrl('https://data.gr.ch/api/records/1.0/search/?dataset=x'));
  for (const u of [
    'https://data.gr.ch/static/vendor/x.js', 'https://data.gr.ch/pages/x/', 'http://data.gr.ch/api/explore/v2.1/x',
    'https://example.com/api/explore/v2.1/x', 'https://data.gr.ch.evil.example/api/explore/v2.1/x',
    'https://evil.example/https://data.gr.ch/api/explore/v2.1/x', 'http://127.0.0.1:1/api/explore/v2.1/x', 'not a url'])
    assert.equal(isPortalApiUrl(u), false, u);
});

test('withApiKey adds the Authorization header only with the env var set and only for data.gr.ch', () => {
  assert.deepEqual(withApiKey(API, { accept: 'application/json' }, ENV), { accept: 'application/json', authorization: `Apikey ${KEY}` });
  assert.deepEqual(withApiKey(API, { accept: 'application/json' }, {}), { accept: 'application/json' });
  assert.deepEqual(withApiKey('https://example.com/api/explore/v2.1/x', { accept: 'a' }, ENV), { accept: 'a' });
  assert.deepEqual(withApiKey('http://127.0.0.1:9/api/explore/v2.1/x', { accept: 'a' }, ENV), { accept: 'a' });
});

function fakeTarget() {
  const t = { routes: [] };
  t.route = async (match, handler) => { t.routes.push({ match, handler }); };
  return t;
}
function fakeRoute(url, headers = { accept: '*/*' }) {
  const r = { fetched: null, fulfilled: null };
  r.request = () => ({ url: () => url, headers: () => headers });
  r.fetch = async opts => { r.fetched = opts; return { fake: 'response' }; };
  r.fulfill = async opts => { r.fulfilled = opts; };
  return r;
}

test('routeApiKey routes nothing without the env var', async () => {
  const t = fakeTarget();
  assert.equal(await routeApiKey(t, {}), false);
  assert.equal(t.routes.length, 0);
});

test('routeApiKey matches only data.gr.ch API URLs and fetches them with the header', async () => {
  const t = fakeTarget();
  assert.equal(await routeApiKey(t, ENV), true);
  const [{ match, handler }] = t.routes;
  assert.ok(match(API));
  assert.equal(match('https://data.gr.ch/static/x.css'), false);
  assert.equal(match('https://cdnjs.cloudflare.com/api/explore/x'), false);
  assert.equal(match('http://127.0.0.1:5000/api/explore/v2.1/x'), false);
  const r = fakeRoute(API, { accept: 'application/json', origin: 'http://127.0.0.1:5000' });
  await handler(r);
  assert.equal(r.fetched.headers.authorization, `Apikey ${KEY}`);
  assert.equal(r.fetched.headers.accept, 'application/json');
  assert.deepEqual(r.fulfilled, { response: { fake: 'response' } });
});

// A real fetch to a local fake server: the CLI's request must carry no key (the host is not data.gr.ch).
test('intake sends no Authorization header to a non-data.gr.ch host even with the env var set', async () => {
  const seen = [];
  const server = http.createServer((req, res) => {
    seen.push(req.headers.authorization ?? null);
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ datasetid: 'x', metas: {}, fields: [] }));
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const intake = path.join(import.meta.dirname, '..', 'intake.mjs');
  const out = await new Promise(resolve => {
    let text = '';
    const c = spawn('node', [intake, 'v1', 'x'], { env: { ...process.env, ...ENV, HUWISE_HOST: `http://127.0.0.1:${server.address().port}` } });
    c.stdout.on('data', d => { text += d; });
    c.stderr.on('data', d => { text += d; });
    c.on('close', code => resolve({ code, text }));
  });
  server.close();
  assert.equal(out.code, 0, out.text);
  assert.deepEqual(seen, [null]);
  assert.ok(!out.text.includes(KEY));
});
