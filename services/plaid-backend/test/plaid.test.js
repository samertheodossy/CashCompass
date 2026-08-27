import test from 'node:test';
import assert from 'node:assert/strict';
import { PlaidClient } from '../src/plaid.js';

const credentials = { async getPlaidCredentials() { return { clientId: 'client-private', secret: 'secret-private' }; } };

test('item/remove treats provider ITEM_NOT_FOUND as a safe already-removed outcome', async () => {
  const client = new PlaidClient({
    baseUrl: 'https://sandbox.plaid.test', credentials,
    fetchImpl: async () => ({ ok: false, status: 400, async json() { return { error_code: 'ITEM_NOT_FOUND' }; } })
  });
  assert.deepEqual(await client.removeItem('access-private'), { removed: true, alreadyRemoved: true });
});

test('provider transport failures are classified transient without echoing credentials', async () => {
  const client = new PlaidClient({
    baseUrl: 'https://sandbox.plaid.test', credentials,
    fetchImpl: async () => { throw new Error('network details'); }
  });
  await assert.rejects(client.getAccounts('access-private'), error => {
    assert.equal(error.transient, true);
    assert.equal(error.message.includes('access-private'), false);
    assert.equal(error.message.includes('secret-private'), false);
    return true;
  });
});

test('Link creation discovers all accounts with consented liabilities and update mode omits products', async () => {
  const bodies = [];
  const client = new PlaidClient({ baseUrl: 'https://production.plaid.test', credentials,
    fetchImpl: async (_url, options) => { bodies.push(JSON.parse(options.body)); return {
      ok: true, status: 200, async json() { return { link_token: 'synthetic', expiration: '2026-08-24T00:00:00Z' }; }
    }; } });
  await client.createLinkToken({ userKey: 'opaque-user', correlationId: 'one' });
  await client.createUpdateLinkToken({ userKey: 'opaque-user', accessToken: 'private-access', correlationId: 'two' });
  assert.deepEqual(bodies[0].products, ['assets']);
  assert.deepEqual(bodies[0].additional_consented_products, ['liabilities']);
  assert.equal(Object.hasOwn(bodies[0], 'account_filters'), false);
  assert.equal(Object.hasOwn(bodies[1], 'products'), false);
  assert.equal(Object.hasOwn(bodies[1], 'account_filters'), false);
  assert.equal(bodies[1].access_token, 'private-access');
});
