import test from 'node:test';
import assert from 'node:assert/strict';
import { buildReadOnlyPreview, normalizePlaidCreditLiabilities,
  normalizePlaidDepositoryAccounts, normalizePlaidMixedAccounts,
  normalizePlaidMortgageAccounts } from '../src/liabilities_adapter.js';
import { protectedKey } from '../src/crypto.js';
import { fakeConfig } from './helpers.js';

function normalized(overrides = {}) {
  const response = {
    accounts: [{ account_id: 'synthetic-account-private', name: 'Synthetic Card',
      official_name: 'Synthetic Card Official', type: 'credit', subtype: 'credit card', mask: '0000',
      balances: { current: 0, available: 900, limit: 1000, iso_currency_code: 'USD' } }],
    liabilities: { credit: [{ account_id: 'synthetic-account-private',
      last_statement_balance: 100, last_statement_issue_date: '2026-01-01',
      minimum_payment_amount: null, next_payment_due_date: '2026-02-15',
      aprs: [{ apr_type: 'purchase_apr', apr_percentage: 18.5 },
        { apr_type: 'special', apr_percentage: 0 }] }] },
    ...overrides
  };
  return normalizePlaidCreditLiabilities({ response, identitySecret: 'synthetic-secret',
    config: fakeConfig(), protectedKey, observedAt: '2026-08-24T18:00:00.000Z' });
}

test('normalizer preserves missing versus zero and never creates canonical APR', () => {
  const [account] = normalized();
  const byType = new Map(account.facts.map(fact => [fact.factType, fact]));
  assert.equal(byType.get('CURRENT_BALANCE').numericValue, 0);
  assert.equal(byType.has('MINIMUM_PAYMENT'), false);
  assert.equal(byType.get('PROMOTIONAL_APR').numericValue, 0);
  assert.equal(byType.has('APR'), false);
  assert.equal(byType.get('STATEMENT_BALANCE').providerEffectiveAsOf, '2026-01-01');
  assert.equal(byType.get('CURRENT_BALANCE').providerEffectiveAsOf, '');
  assert.equal(byType.get('CURRENT_BALANCE').sourceSemantic, 'ACCOUNT_CURRENT_BALANCE');
  assert.equal(account.observedAt, '2026-08-24T18:00:00.000Z');
});

test('preview emits every review status without inventing provider freshness', () => {
  const accounts = normalized();
  const preview = buildReadOnlyPreview({ accounts, observedAt: '2026-08-24T18:00:00.000Z',
    environment: 'SANDBOX', comparisonExplicit: true, existingFacts: {
      CURRENT_BALANCE: { value: 0 }, AVAILABLE_CREDIT: { value: 800 },
      STATEMENT_BALANCE: { value: 100 }, PURCHASE_APR: { value: 18.5 }
    } });
  const rows = preview[0].rows;
  assert.equal(rows.find(row => row.factType === 'CURRENT_BALANCE').status, 'MATCH');
  assert.equal(rows.find(row => row.factType === 'AVAILABLE_CREDIT').status, 'DIFFERENT');
  assert.equal(rows.find(row => row.factType === 'CREDIT_LIMIT').status, 'EXISTING_MISSING');
  assert.equal(rows.find(row => row.factType === 'MINIMUM_PAYMENT').status, 'PLAID_MISSING');
  assert.equal(rows.find(row => row.factType === 'STATEMENT_BALANCE').status, 'STALE');
  assert.equal(rows.find(row => row.factType === 'PURCHASE_APR').status, 'SEMANTIC_REVIEW_REQUIRED');
  assert.ok(rows.find(row => row.factType === 'CURRENT_BALANCE').candidate.observedAt);
  assert.equal(rows.find(row => row.factType === 'CURRENT_BALANCE').effectiveAsOf, '');
  assert.equal(rows.find(row => row.factType === 'CURRENT_BALANCE').safeToOfferForApproval, false);
  assert.equal(rows.find(row => row.factType === 'CURRENT_BALANCE').reason, 'PROVIDER_EFFECTIVE_TIME_MISSING');
});

test('adapter output excludes raw account and request identities', () => {
  const serialized = JSON.stringify(normalized());
  assert.equal(serialized.includes('synthetic-account-private'), false);
  assert.equal(serialized.includes('request_id'), false);
  assert.equal(serialized.includes('accounts[]'), false);
});

test('preview explicitly reports missing APR component evidence', () => {
  const accounts = normalized();
  accounts[0].facts = accounts[0].facts.filter(fact => !fact.factType.includes('APR'));
  const rows = buildReadOnlyPreview({ accounts, existingFacts: {},
    observedAt: '2026-08-24T18:00:00.000Z', environment: 'SANDBOX' })[0].rows;
  assert.equal(rows.find(row => row.factType === 'APR_COMPONENT_EVIDENCE').status, 'PLAID_MISSING');
  assert.equal(rows.some(row => row.factType === 'APR'), false);
});

test('depository normalizer preserves current, available, currency, and provider timestamp', () => {
  const [account] = normalizePlaidDepositoryAccounts({ response: { accounts: [{
    account_id: 'synthetic-checking-private', name: 'Checking', type: 'depository',
    subtype: 'checking', mask: '1111', balances: { current: 1200, available: 1150,
      iso_currency_code: 'USD', last_updated_datetime: '2026-08-24T17:59:00Z' }
  }] }, identitySecret: 'synthetic-secret', config: fakeConfig(), protectedKey,
  observedAt: '2026-08-24T18:00:00.000Z' });
  assert.deepEqual(account.facts.map(fact => fact.factType), ['CURRENT_BALANCE', 'AVAILABLE_BALANCE']);
  assert.equal(account.facts[0].currencyOrUnit, 'USD');
  assert.equal(account.facts[0].providerEffectiveAsOf, '2026-08-24T17:59:00.000Z');
  assert.equal(JSON.stringify(account).includes('synthetic-checking-private'), false);
});

test('preview applies staleness policy to full provider balance timestamps', () => {
  const accounts = normalizePlaidDepositoryAccounts({ response: { accounts: [{
    account_id: 'synthetic-old-checking-private', name: 'Checking', type: 'depository',
    subtype: 'checking', mask: '1111', balances: { current: 1200, available: 1150,
      iso_currency_code: 'USD', last_updated_datetime: '2026-07-01T08:00:00Z' }
  }] }, identitySecret: 'synthetic-secret', config: fakeConfig(), protectedKey,
  observedAt: '2026-08-24T18:00:00.000Z' });
  const rows = buildReadOnlyPreview({ accounts, existingFacts: {
    CURRENT_BALANCE: { value: 1200 }, AVAILABLE_BALANCE: { value: 1150 }
  }, observedAt: '2026-08-24T18:00:00.000Z', environment: 'TRIAL',
  comparisonExplicit: true })[0].rows;
  assert.ok(rows.every(row => row.status === 'STALE'));
});

test('mortgage normalizer exposes only account current balance and preserves zero versus missing', () => {
  const accounts = normalizePlaidMortgageAccounts({ response: { accounts: [
    { account_id: 'mortgage-zero-private', name: 'Mortgage Zero', type: 'loan',
      subtype: 'mortgage', mask: '1111', balances: { current: 0, available: 500,
        iso_currency_code: 'USD', last_updated_datetime: '2026-08-24T17:59:00Z' } },
    { account_id: 'mortgage-missing-private', name: 'Mortgage Missing', type: 'loan',
      subtype: 'mortgage', mask: '2222', balances: { current: null, available: 700,
        iso_currency_code: 'USD' } },
    { account_id: 'student-private', name: 'Student Loan', type: 'loan',
      subtype: 'student', mask: '3333', balances: { current: 12 } }
  ] }, identitySecret: 'synthetic-secret', config: fakeConfig(), protectedKey,
  observedAt: '2026-08-24T18:00:00.000Z' });
  assert.equal(accounts.length, 2);
  assert.deepEqual(accounts[0].facts.map(fact => fact.factType), ['CURRENT_BALANCE']);
  assert.equal(accounts[0].facts[0].numericValue, 0);
  assert.equal(accounts[0].facts[0].providerEffectiveAsOf, '2026-08-24T17:59:00.000Z');
  assert.deepEqual(accounts[1].facts, []);
  assert.equal(JSON.stringify(accounts).includes('mortgage-zero-private'), false);
  assert.equal(JSON.stringify(accounts).includes('available'), false);

  const preview = buildReadOnlyPreview({ accounts, existingFacts: {},
    observedAt: '2026-08-24T18:00:00.000Z', environment: 'TRIAL' });
  assert.deepEqual(preview[0].rows.map(row => row.factType), ['CURRENT_BALANCE']);
  assert.equal(preview[0].rows[0].candidate.numericValue, 0);
  assert.equal(preview[1].rows[0].status, 'PLAID_MISSING');
});

test('mixed normalizer preserves one Item account grouping and marks unsupported accounts', () => {
  const accountsResponse = { accounts: [
    { account_id: 'checking-private', name: 'Checking', type: 'depository', subtype: 'checking',
      mask: '1111', balances: { current: 10, available: 9, iso_currency_code: 'USD' } },
    { account_id: 'savings-private', name: 'Savings', type: 'depository', subtype: 'savings',
      mask: '2222', balances: { current: 20, available: 19, iso_currency_code: 'USD' } },
    { account_id: 'credit-private', name: 'Card', type: 'credit', subtype: 'credit card',
      mask: '3333', balances: { current: 30, available: 70, limit: 100, iso_currency_code: 'USD' } },
    { account_id: 'mortgage-private', name: 'Mortgage', type: 'loan', subtype: 'mortgage',
      mask: '5555', balances: { current: 50, available: 500, iso_currency_code: 'USD' } },
    { account_id: 'investment-private', name: 'Brokerage', type: 'investment', subtype: 'brokerage',
      mask: '4444', balances: { current: 40, available: null, iso_currency_code: 'USD' } }
  ] };
  const liabilitiesResponse = { liabilities: { credit: [{ account_id: 'credit-private',
    minimum_payment_amount: 0, aprs: [] }] } };
  const output = normalizePlaidMixedAccounts({ accountsResponse, liabilitiesResponse,
    identitySecret: 'synthetic-secret', config: fakeConfig(), protectedKey,
    observedAt: '2026-08-24T18:00:00.000Z' });
  assert.deepEqual(output.map(account => account.type),
    ['depository', 'depository', 'credit', 'loan', 'investment']);
  assert.equal(output[3].unsupported, undefined);
  assert.deepEqual(output[3].facts.map(fact => fact.factType), ['CURRENT_BALANCE']);
  assert.equal(output[4].unsupported, true);
  assert.equal(JSON.stringify(output).includes('checking-private'), false);
  const unmapped = buildReadOnlyPreview({ accounts: output, existingFacts: {},
    observedAt: '2026-08-24T18:00:00.000Z', environment: 'SANDBOX' });
  assert.ok(unmapped.slice(0, 4).flatMap(account => account.rows)
    .every(row => row.status === 'SEMANTIC_REVIEW_REQUIRED' || row.status === 'PLAID_MISSING'));
  assert.equal(unmapped[4].rows[0].reason, 'UNSUPPORTED_ACCOUNT_TYPE');
});
