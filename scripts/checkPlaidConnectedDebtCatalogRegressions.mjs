import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const bridge = fs.readFileSync(new URL('../plaid_import_bridge.js', import.meta.url), 'utf8');
const client = fs.readFileSync(new URL('../Dashboard_Script_PlaidConnectedAccounts.html', import.meta.url), 'utf8');
const debtsClient = fs.readFileSync(new URL('../Dashboard_Script_PlanningDebts.html', import.meta.url), 'utf8');
const identity = fs.readFileSync(new URL('../financial_identity.js', import.meta.url), 'utf8');
const config = fs.readFileSync(new URL('../config.js', import.meta.url), 'utf8');
const debtImport = fs.readFileSync(new URL('../debt_import.js', import.meta.url), 'utf8');

function sliceFunction(source, name) {
  const start = source.indexOf(`function ${name}`);
  assert.ok(start >= 0, `${name} is missing`);
  const end = source.indexOf('\nfunction ', start + 1);
  return source.slice(start, end < 0 ? source.length : end);
}

const ensureReady = sliceFunction(bridge, 'plaidImportEnsureIdentityReadyForConnected_');
assert(!ensureReady.includes('registry.accounts || []).length > 0'),
  'Connected identity must not skip foundation sync when registry already has rows');
assert(ensureReady.includes('plaidImportEnsureIdentityFoundationForConnected_'),
  'Connected identity must always run foundation sync before reading registry');

assert(bridge.includes('function plaidImportInvalidateAppliedAccountCaches_'),
  'apply refresh must invalidate request-scoped legacy caches');
assert(/plaidImportRefreshPreviewAccountAfterApply_[\s\S]{0,1200}plaidImportInvalidateAppliedAccountCaches_/.test(bridge),
  'post-apply preview refresh must clear stale legacy caches before re-reading facts');

assert(client.includes('function plaidMainReloadConnectedCatalog_') &&
  client.includes('plaidMainInvalidateMetadataCache_') &&
  /plaidMainReloadConnectedCatalog_[\s\S]{0,200}loadPlaidConnectedAccounts_\(true/.test(client),
  'Connected catalog reload must invalidate cache and force metadata fetch');

assert(/plaidMainSaveMapping_[\s\S]{0,1200}plaidMainReloadConnectedCatalog_/.test(client),
  'mapping save must refresh the Connected catalog');
assert(debtsClient.includes("plaidMainReloadConnectedCatalog_('DEBT')"),
  'Debt Connected tab activation must refresh the catalog');
assert(debtsClient.includes("plaidMainInvalidateMetadataCache_('DEBT')"),
  'new debt creation must invalidate Connected metadata cache');

class FakeRange {
  constructor(sheet, row, col, numRows = 1, numCols = 1) {
    this.sheet = sheet;
    this.row = row;
    this.col = col;
    this.numRows = numRows;
    this.numCols = numCols;
  }
  getValues() {
    return Array.from({ length: this.numRows }, (_, r) =>
      Array.from({ length: this.numCols }, (_, c) =>
        this.sheet.rows[this.row - 1 + r]?.[this.col - 1 + c] ?? ''));
  }
  getDisplayValues() {
    return this.getValues().map((row) => row.map((value) => String(value ?? '')));
  }
  setValues(values) {
    values.forEach((row, r) => row.forEach((value, c) => {
      const rr = this.row - 1 + r;
      while (this.sheet.rows.length <= rr) this.sheet.rows.push([]);
      this.sheet.rows[rr][this.col - 1 + c] = value;
    }));
    return this;
  }
}
class FakeSheet {
  constructor(name, rows = []) { this.name = name; this.rows = rows.map((row) => [...row]); }
  getName() { return this.name; }
  getLastRow() { return this.rows.length; }
  getLastColumn() { return Math.max(0, ...this.rows.map((row) => row.length)); }
  getRange(row, col, numRows = 1, numCols = 1) {
    return new FakeRange(this, row, col, numRows, numCols);
  }
  getDataRange() {
    return this.getRange(1, 1, Math.max(1, this.getLastRow()), Math.max(1, this.getLastColumn()));
  }
  appendRow(row) { this.rows.push([...row]); }
  setFrozenRows() {}
}
class FakeSpreadsheet {
  constructor(sheets = []) { this.sheets = new Map(sheets.map((sheet) => [sheet.getName(), sheet])); }
  getSheetByName(name) { return this.sheets.get(name) || null; }
  insertSheet(name) { const sheet = new FakeSheet(name); this.sheets.set(name, sheet); return sheet; }
  getSheets() { return [...this.sheets.values() ]; }
}

const ctx = {
  console,
  Utilities: {
    DigestAlgorithm: { SHA_256: 'SHA_256' },
    Charset: { UTF_8: 'UTF-8' },
    computeDigest(_algorithm, value) {
      return [...Buffer.from(value, 'utf8')];
    },
    getUuid() { return 'fixture-uuid-1'; },
    formatDate(value) { return new Date(value).toISOString().slice(0, 10); }
  },
  Session: { getScriptTimeZone() { return 'America/Los_Angeles'; } },
  SpreadsheetApp: { flush() {} },
  LockService: { getDocumentLock() { return { waitLock() {}, releaseLock() {} }; } },
  applySysSheetBaseStyle_() {},
  getDebtsUiData() {
    return {
      debts: [{ accountName: 'Credit Card - Corporate AMEX', type: 'Credit Card', balance: 0 }]
    };
  },
  getActiveDebtsForManagementFromDashboard() {
    return [{ accountName: 'Credit Card - Corporate AMEX', type: 'Credit Card', balance: 0 }];
  },
  getBankAccountUiData() { return { accounts: [] }; },
  getInvestmentUiData() { return { accounts: [], managementAccounts: [] }; },
  PropertiesService: {
    getScriptProperties() { return { getProperty() { return ''; } }; },
    getUserProperties() { return { getProperty() { return null; }, setProperty() {} }; }
  },
  UrlFetchApp: { fetch() { throw new Error('network'); }, fetchAll() { return []; } },
  Logger: { log() {} }
};

vm.createContext(ctx);
for (const [name, source] of [['config.js', config], ['financial_identity.js', identity],
  ['debt_import.js', debtImport]]) {
  vm.runInContext(source, ctx, { filename: name });
}

const debtHeaders = ['Account Name', 'Type', 'Active', 'Account Balance', 'Minimum Payment',
  'Credit Limit', 'Int Rate', 'Due Date'];
const workbook = new FakeSpreadsheet([
  new FakeSheet('INPUT - Debts', [
    debtHeaders,
    ['Chase Card', 'Credit Card', 'Yes', 1200, 35, 5000, 19.99, 15],
    ['Credit Card - Corporate AMEX', 'Credit Card', 'Yes', 0, 0, 10000, 26.99, 10],
    ['Inactive Card', 'Credit Card', 'No', 0, 0, 1000, 12, 1]
  ]),
  new FakeSheet('SYS - Financial Accounts', [
    ctx.FINANCIAL_ACCOUNT_HEADERS_,
    ['DEBT-CHASE', 'DEBT', 'Chase Card', '', 'Credit Card', '', 'SAMER', 'INDIVIDUAL',
      'USD', '', 'Yes', 'VERIFIED', 'INPUT_DEBTS', 'Chase Card', '2026-01-01', '2026-01-01']
  ])
]);

const partialInit = ctx.ensureFinancialIdentityFoundationForConnectedAccounts_(workbook);
assert.equal(partialInit.applied, true, 'foundation sync must append missing active debts to registry');
const registry = ctx.financialIdentityReadRegistry_(workbook);

vm.runInContext([
  sliceFunction(bridge, 'plaidImportNormalizeConnectedDomain_'),
  sliceFunction(bridge, 'plaidImportConnectedTargetEligible_'),
  sliceFunction(bridge, 'plaidImportBuildConnectedDisplayTargetsFromRegistry_'),
  sliceFunction(bridge, 'plaidImportEnsureIdentityFoundationForConnected_'),
  sliceFunction(bridge, 'plaidImportEnsureIdentityReadyForConnected_'),
  sliceFunction(bridge, 'plaidImportInvalidateAppliedAccountCaches_')
].join('\n'), ctx, { filename: 'plaid_import_bridge_catalog_slice.js' });

const syncedRegistry = ctx.plaidImportEnsureIdentityReadyForConnected_(workbook);
const displayTargets = ctx.plaidImportBuildConnectedDisplayTargetsFromRegistry_(syncedRegistry, 'DEBT');
const names = displayTargets.map((row) => row.accountName);

assert(names.includes('Chase Card'), 'existing registry debt must remain in Connected catalog');
assert(names.includes('Credit Card - Corporate AMEX'),
  'active zero-balance debt must appear in Connected mapping catalog after foundation sync');
assert(!names.includes('Inactive Card'), 'inactive debts must stay out of Connected mapping catalog');
assert.equal(ctx.getActiveDebtsForManagementFromDashboard().length, 1,
  'fixture manage catalog must include active zero-balance Corporate AMEX');

ctx.PLAID_IMPORT_REQUEST_SESSION_ = {
  existingFactsCache: { 'DEBT-AMEX': { INT_RATE: 26.99 } },
  debtLegacyIndex: { rows: 1 },
  cashLegacyIndex: { rows: 1 }
};
ctx.plaidImportInvalidateAppliedAccountCaches_('DEBT-AMEX');
assert.equal(ctx.PLAID_IMPORT_REQUEST_SESSION_.existingFactsCache['DEBT-AMEX'], undefined,
  'post-apply cache invalidation must drop stale legacy facts');
assert.equal(ctx.PLAID_IMPORT_REQUEST_SESSION_.debtLegacyIndex, null,
  'post-apply cache invalidation must reset debt legacy index');
assert.equal(ctx.PLAID_IMPORT_REQUEST_SESSION_.cashLegacyIndex, null,
  'post-apply cache invalidation must reset cash legacy index');

console.log('Plaid Connected debt catalog regressions passed.');
