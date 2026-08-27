import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { createHttpHandler } from '../src/http.js';
import { fakeConfig } from './helpers.js';

function request(pathname) {
  const stream = Readable.from([]);
  stream.method = 'GET';
  stream.url = pathname;
  stream.headers = {};
  return stream;
}

function response() {
  const result = { status: 0, headers: null, body: '' };
  result.writeHead = (status, headers) => {
    result.status = status;
    result.headers = headers;
  };
  result.end = body => { result.body = String(body || ''); };
  return result;
}

test('serves the public Sandbox health response on a Cloud Run-safe path', async () => {
  const handler = createHttpHandler({
    config: fakeConfig(),
    service: {},
    store: {},
    logger: { info() {}, error() {} }
  });
  const output = response();
  await handler(request('/health'), output);
  assert.equal(output.status, 200);
  assert.deepEqual(JSON.parse(output.body), { ok: true, environment: 'SANDBOX' });
  assert.equal(output.headers['cache-control'], 'no-store');
});

test('does not expose the obsolete Cloud Run-reserved healthz path', async () => {
  const handler = createHttpHandler({
    config: fakeConfig(),
    service: {},
    store: {},
    logger: { info() {}, error() {} }
  });
  const output = response();
  await handler(request('/healthz'), output);
  assert.equal(output.status, 404);
  assert.deepEqual(JSON.parse(output.body), { ok: false, error: 'NOT_FOUND' });
});
