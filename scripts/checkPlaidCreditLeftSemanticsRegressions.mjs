import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const client = fs.readFileSync(new URL('../Dashboard_Script_PlaidConnectedAccounts.html', import.meta.url), 'utf8');
const debtImport = fs.readFileSync(new URL('../debt_import.js', import.meta.url), 'utf8');
const debts = fs.readFileSync(new URL('../debts.js', import.meta.url), 'utf8');
const config = fs.readFileSync(new URL('../config.js', import.meta.url), 'utf8');
const financialIdentity = fs.readFileSync(new URL('../financial_identity.js', import.meta.url), 'utf8');

function sliceFunction(source, name) {
  const start = source.indexOf(`function ${name}`);
  assert.ok(start >= 0, `${name} is missing`);
  const end = source.indexOf('\nfunction ', start + 1);
  return source.slice(start, end < 0 ? source.length : end);
}

assert(!debtImport.includes("available: headers.indexOf('Credit Left')"),
  'legacy debt index must not alias Credit Left as AVAILABLE_CREDIT');
assert(debtImport.includes("creditLeft: headers.indexOf('Credit Left')") &&
  debtImport.includes('CREDIT_LEFT: debtImportCellNumber_'),
  'legacy debt index must expose Credit Left under CREDIT_LEFT');

assert(client.includes('function plaidMainAuthoritativeCreditLimit_') &&
  client.includes('function plaidMainProviderAvailableCreditInconsistent_') &&
  !/plaidMainExistingCreditLeft_[\s\S]{0,200}AVAILABLE_CREDIT/.test(client),
  'Connected review must derive Credit Left from CREDIT_LEFT, not provider available credit');

const bridge = fs.readFileSync(new URL('../plaid_import_bridge.js', import.meta.url), 'utf8');

assert(debts.includes('function recalcDebtDerivedCreditFieldsForRow_') &&
  bridge.includes('recalcDebtDerivedCreditFieldsForRow_'),
  'successful Debt Apply must recalculate canonical Credit Left and Pct Avail');

class FakeRange {
  constructor(sheet, row, col, numRows = 1, numCols = 1) {
    this.sheet = sheet;
    this.row = row;
    this.col = col;
    this.numRows = numRows;
    this.numCols = numCols;
  }
  getValue() { return this.sheet.rows[this.row - 1]?.[this.col - 1] ?? ''; }
  setValue(value) {
    const rr = this.row - 1;
    while (this.sheet.rows.length <= rr) this.sheet.rows.push([]);
    this.sheet.rows[rr][this.col - 1] = value;
    return this;
  }
  setNumberFormat() { return this; }
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
}

const ctx = {
  console,
  round2_: (n) => Math.round(n * 100) / 100,
  toNumber_: (v) => {
    if (v === '' || v === null || v === undefined) return 0;
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  },
  copyNeighborFormatInRow_() {},
  applyCurrencyFormat_() {},
  Utilities: {
    DigestAlgorithm: { SHA_256: 'SHA_256' },
    Charset: { UTF_8: 'UTF-8' },
    computeDigest(_algorithm, value) { return [...Buffer.from(value, 'utf8')]; },
    getUuid() { return 'fixture-uuid-1'; },
    formatDate(value) { return new Date(value).toISOString().slice(0, 10); }
  },
  Session: { getScriptTimeZone() { return 'America/Los_Angeles'; } },
  SpreadsheetApp: { flush() {} },
  LockService: { getDocumentLock() { return { waitLock() {}, releaseLock() {} }; } },
  applySysSheetBaseStyle_() {},
  PropertiesService: {
    getScriptProperties() { return { getProperty() { return ''; } }; },
    getUserProperties() { return { getProperty() { return null; }, setProperty() {} }; }
  },
  Logger: { log() {} }
};

vm.createContext(ctx);
for (const [name, source] of [['config.js', config], ['financial_identity.js', financialIdentity],
  ['debt_import.js', debtImport], ['debts.js', debts]]) {
  vm.runInContext(source, ctx, { filename: name });
}

const debtHeaders = ['Account Name', 'Type', 'Active', 'Account Balance', 'Minimum Payment',
  'Credit Limit', 'Credit Left', 'Int Rate', 'Acct PCT Avail'];
const sheet = new FakeSheet('INPUT - Debts', [
  debtHeaders,
  ['Credit Card - Corporate AMEX', 'Credit Card', 'Yes', 0, 0, 10000, 50000, 26.99, 5],
  ['American Express', 'Credit Card', 'Yes', 48696.95, 0, 50000, 1303.05, 19.99, 0.0261],
  ['Southwest', 'Credit Card', 'Yes', 5200, 0, 5000, -200, 24.99, -0.04]
]);
const registryAccounts = [
  { stableAccountId: 'DEBT-CORP', legacyDomain: 'INPUT_DEBTS', legacyKey: 'Credit Card - Corporate AMEX' },
  { stableAccountId: 'DEBT-AMEX', legacyDomain: 'INPUT_DEBTS', legacyKey: 'American Express' },
  { stableAccountId: 'DEBT-SWA', legacyDomain: 'INPUT_DEBTS', legacyKey: 'Southwest' }
];
const legacyIndex = ctx.debtImportLegacyIndex_({ getSheetByName() { return sheet; } }, registryAccounts);

assert.equal(legacyIndex['DEBT-CORP'].CREDIT_LEFT, 50000,
  'fixture must start with bad persisted Corporate AMEX Credit Left');
assert.equal(legacyIndex['DEBT-CORP'].AVAILABLE_CREDIT, undefined,
  'provider available credit must not alias workbook Credit Left in legacy index');
assert.equal(legacyIndex['DEBT-AMEX'].CREDIT_LEFT, 1303.05);
assert.equal(legacyIndex['DEBT-SWA'].CREDIT_LEFT, -200);

const corpCols = {
  creditLimitCol: 5,
  creditLeftCol: 6,
  balanceCol: 3,
  pctAvailCol: 8
};
ctx.recalcCreditLeftFromLimitBalance_(sheet, 2, corpCols);
ctx.recalcDebtPctAvailForRow_(sheet, 2, corpCols);
assert.equal(sheet.getRange(2, 7).getValue(), 10000,
  'canonical Credit Left must be Credit Limit − Balance after recalc');
assert.equal(sheet.getRange(2, 9).getValue(), 1,
  'Pct Avail must be 100% when limit is 10k and balance is 0');

ctx.recalcDebtPctAvailForRow_(sheet, 3, corpCols);
assert.equal(Math.round(sheet.getRange(3, 9).getValue() * 10000) / 100, 2.61,
  'American Express Pct Avail must remain 2.61%');

ctx.recalcDebtPctAvailForRow_(sheet, 4, corpCols);
assert.equal(sheet.getRange(4, 7).getValue(), -200,
  'Southwest negative Credit Left must be preserved until balance/limit recalc');
assert(sheet.getRange(4, 9).getValue() < 0,
  'Southwest negative Pct Avail must be preserved');

vm.runInContext([
  'var PLAID_MAIN_MISSING_ = "—";',
  sliceFunction(client, 'plaidMainLegacyValue_'),
  sliceFunction(client, 'plaidMainDerivedCreditLeft_'),
  sliceFunction(client, 'plaidMainAuthoritativeCreditLimit_'),
  sliceFunction(client, 'plaidMainExistingCreditLeft_'),
  sliceFunction(client, 'plaidMainProviderAvailableCreditInconsistent_'),
  sliceFunction(client, 'plaidMainBuildDerivedCreditLeftRow_'),
  sliceFunction(client, 'plaidMainBuildProviderAvailableCreditRow_'),
  sliceFunction(client, 'plaidMainFormatMoney_'),
  sliceFunction(client, 'plaidMainFormatCurrencyChange_')
].join('\n'), ctx, { filename: 'plaid_credit_left_slice.js' });

function legacyFacts(row) {
  const out = {};
  Object.keys(row).forEach((key) => {
    if (row[key] !== null && row[key] !== undefined && row[key] !== '') {
      out[key] = { value: row[key] };
    }
  });
  return out;
}

const corporateLegacy = legacyFacts(legacyIndex['DEBT-CORP']);
const derivedRow = ctx.plaidMainBuildDerivedCreditLeftRow_({
  CURRENT_BALANCE: { candidate: { numericValue: 0, currency: 'USD' } },
  CREDIT_LIMIT: { candidate: { numericValue: 50000, currency: 'USD' } }
}, corporateLegacy);
assert.equal(derivedRow.imported, '$10,000.00',
  'review Credit Left must use CashCompass limit, not provider limit or available credit');
assert.equal(ctx.plaidMainProviderAvailableCreditInconsistent_(50000, corporateLegacy),
  'Exceeds CashCompass credit limit');

const amexLegacy = legacyFacts(legacyIndex['DEBT-AMEX']);
const amexDerived = ctx.plaidMainDerivedCreditLeft_(50000, 48696.95);
assert.equal(amexDerived, 1303.05);
const providerRow = ctx.plaidMainBuildProviderAvailableCreditRow_(
  { candidate: { numericValue: 1303.05, currency: 'USD' } }, amexLegacy);
assert.equal(providerRow.change, 'Informational',
  'consistent provider available credit must stay informational');

const isolatedLegacy = legacyFacts(legacyIndex['DEBT-CORP']);
const otherProvider = ctx.plaidMainBuildProviderAvailableCreditRow_(
  { candidate: { numericValue: 50000, currency: 'USD' } }, isolatedLegacy);
assert(otherProvider.change.includes('Exceeds CashCompass credit limit'),
  'provider evidence must flag inconsistency without writing Credit Left');

console.log('Plaid Credit Left semantics regressions passed.');
