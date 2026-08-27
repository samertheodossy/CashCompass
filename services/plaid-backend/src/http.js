import { randomUUID } from 'node:crypto';
import { verifyAssertion } from './auth.js';
import { publicError } from './errors.js';

const ROUTES = new Map([
  ['POST /v1/link-token', { action: 'LINK_TOKEN_CREATE', invoke: (service, userKey) => service.createLinkToken(userKey) }],
  ['POST /v1/update-link-token', { action: 'UPDATE_LINK_TOKEN_CREATE', invoke: (service, userKey, body) => service.createUpdateLinkToken(userKey, body) }],
  ['POST /v1/update-complete', { action: 'UPDATE_COMPLETE', invoke: (service, userKey, body) => service.completeUpdate(userKey, body) }],
  ['POST /v1/preview', { action: 'LIABILITIES_PREVIEW', invoke: (service, userKey, body) => service.preview(userKey, body) }],
  ['POST /v1/exchange', { action: 'PUBLIC_TOKEN_EXCHANGE', invoke: (service, userKey, body) => service.exchange(userKey, body) }],
  ['GET /v1/connections', { action: 'CONNECTIONS_LIST', invoke: (service, userKey) => service.list(userKey) }],
  ['GET /v1/mappings', { action: 'MAPPINGS_LIST', invoke: (service, userKey, body, identity) => service.listMappings(userKey, body, identity) }],
  ['POST /v1/mappings/save', { action: 'MAPPING_SAVE', invoke: (service, userKey, body, identity) => service.saveMapping(userKey, body, identity) }],
  ['POST /v1/mappings/invalidate', { action: 'MAPPING_INVALIDATE', invoke: (service, userKey, body, identity) => service.invalidateMapping(userKey, body, identity) }],
  ['POST /v1/mappings/resolve', { action: 'MAPPING_RESOLVE', invoke: (service, userKey, body, identity) => service.resolveMapping(userKey, body, identity) }],
  ['POST /v1/mappings/migrate', { action: 'MAPPINGS_MIGRATE', invoke: (service, userKey, body, identity) => service.migrateMappings(userKey, body, identity) }],
  ['POST /v1/disconnect', { action: 'DISCONNECT', invoke: (service, userKey, body) => service.disconnect(userKey, body) }],
  ['POST /v1/runtime-status', { action: 'RUNTIME_STATUS', invoke: service => service.runtimeStatus() }]
]);

function writeJson(response, status, body) {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff'
  });
  response.end(JSON.stringify(body));
}

async function readBody(request, maxBytes) {
  const parts = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxBytes) throw Object.assign(new Error('Request too large.'), { status: 413, code: 'REQUEST_TOO_LARGE' });
    parts.push(chunk);
  }
  return Buffer.concat(parts).toString('utf8');
}

export function createHttpHandler({ config, service, store, logger, now = () => Date.now() }) {
  return async function handler(request, response) {
    const started = now();
    const requestId = randomUUID();
    const pathname = new URL(request.url, 'http://localhost').pathname;
    if (request.method === 'GET' && pathname === '/health') {
      writeJson(response, 200, { ok: true, environment: config.environment });
      return;
    }
    const route = ROUTES.get(`${request.method} ${pathname}`);
    if (!route) {
      writeJson(response, 404, { ok: false, error: 'NOT_FOUND' });
      return;
    }
    let userKey = '';
    try {
      const rawBody = await readBody(request, config.maxRequestBytes);
      const auth = verifyAssertion({
        token: request.headers['x-cashcompass-assertion'],
        rawBody,
        expectedAction: route.action,
        config,
        nowMs: now()
      });
      const identity = await service.resolveRequestIdentity(auth);
      userKey = identity.userKey;
      await store.consumeNonce(identity.actorKey, auth.nonce, auth.expiresAtSeconds, now());
      let body = {};
      if (rawBody) {
        try { body = JSON.parse(rawBody); } catch (_error) { throw Object.assign(new Error('Invalid JSON.'), { status: 400, code: 'INVALID_JSON' }); }
      }
      const result = await route.invoke(service, identity.userKey, body, identity);
      logger.info({ requestId, action: route.action, environment: config.environment, userKey, status: 'OK', accountCount: result.accounts?.length || result.connections?.reduce((n, c) => n + c.accounts.length, 0) || 0, durationMs: now() - started });
      writeJson(response, 200, result.ok === undefined ? { ok: true, ...result } : result);
    } catch (error) {
      const result = publicError(error);
      if (error.status && error.code && !(error instanceof Error && error.name === 'ServiceError')) {
        result.status = error.status;
        result.body = { ok: false, error: error.code };
      }
      logger.error({ requestId, action: route.action, environment: config.environment, userKey, status: 'ERROR', reasonCode: result.body.error, durationMs: now() - started });
      writeJson(response, result.status, result.body);
    }
  };
}
