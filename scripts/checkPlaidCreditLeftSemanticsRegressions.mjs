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
  bridge.includes('recalcDebtDerivedCreditFieldsForRow_(writeSession.sheet, writeSession.targetRow'),
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
  getDisplayValue() { return String(this.getValue() ?? ''); }
  getFormula() { return this.sheet.formulas?.[this.row - 1]?.[this.col - 1] || ''; }
  setValue(value) {
    const rr = this.row - 1;
    while (this.sheet.rows.length <= rr) this.sheet.rows.push([]);
    this.sheet.rows[rr][this.col - 1] = value;
    if (this.sheet.formulas) {
      while (this.sheet.formulas.length <= rr) this.sheet.formulas.push([]);
      this.sheet.formulas[rr][this.col - 1] = '';
    }
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
  constructor(name, rows = []) {
    this.name = name;
    this.rows = rows.map((row) => [...row]);
    this.formulas = rows.map((row) => row.map(() => ''));
  }
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
  typeCol: 1,
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
  'Pct-only recalc must not write Credit Left');
assert(sheet.getRange(4, 9).getValue() < 0,
  'Consistent over-limit Pct Avail remains negative from Credit Limit − Balance');

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

const editableSlice = debts.slice(
  debts.indexOf('var DEBT_EDITABLE_FIELDS_'),
  debts.indexOf('var DEBT_DERIVED_FIELDS_')
);
assert(debts.includes("Credit Left and available credit percentage are calculated") &&
  !editableSlice.includes("'Credit Left'") &&
  debts.includes("var DEBT_DERIVED_FIELDS_"),
  'Credit Left is a derived field and cannot be written by the generic editor');
assert(bridge.includes('PLAID_IMPORT_DEBT_DERIVED_KEYS_') &&
  bridge.includes('AVAILABLE_CREDIT: true') &&
  !bridge.includes('applyDebtDerivedCreditFieldRepair_'),
  'Plaid Apply cannot select derived keys and must not auto-repair workbook rows');
assert(debtImport.includes('never writes INPUT - Debts') &&
  !debtImport.includes('applyDebtDerivedCreditFieldRepair_'),
  'shadow debt import must not write or repair INPUT derived columns');

const derivedHeaderMap = {
  nameColZero: 0, typeColZero: 1, balanceColZero: 3, creditLimitColZero: 5,
  creditLeftColZero: 6, pctAvailColZero: 8
};

function derivedPct_(sheet, row) {
  return Math.round(Number(sheet.getRange(row, 9).getValue()) * 10000) / 100;
}

function writeSourceAndRecalc_(sheet, row, patch) {
  if (Object.prototype.hasOwnProperty.call(patch, 'balance')) {
    sheet.getRange(row, derivedHeaderMap.balanceColZero + 1).setValue(patch.balance);
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'limit')) {
    sheet.getRange(row, derivedHeaderMap.creditLimitColZero + 1).setValue(patch.limit);
  }
  ctx.recalcDebtDerivedCreditFieldsForRow_(sheet, row, derivedHeaderMap);
}

const dynamicSheet = new FakeSheet('INPUT - Debts', [
  debtHeaders,
  ['Derived Fixture Card', 'Credit Card', 'Yes', 28923.04, 35, 35800, -660.39, 24.99, -0.0184],
  ['Home Loan', 'Loan', 'Yes', 200000, 900, 0, 0, 6.25, ''],
  ['Heloc Line', 'HELOC', 'Yes', 55000, 400, 80000, 25000, 7.5, 0.5],
  ['Formula Card', 'Credit Card', 'Yes', 1000, 25, 5000, 9999, 18, 0.5]
]);
dynamicSheet.formulas[4][6] = '=F5-D5';
dynamicSheet.formulas[4][8] = '=G5/F5';

writeSourceAndRecalc_(dynamicSheet, 2, { balance: 28923.04, limit: 35800 });
assert.equal(dynamicSheet.getRange(2, 7).getValue(), 6876.96,
  'starting Balance $28,923.04 and Limit $35,800.00 derive Credit Left $6,876.96');
assert.equal(derivedPct_(dynamicSheet, 2), 19.21,
  'starting values derive Acct PCT Avail 19.21%');

writeSourceAndRecalc_(dynamicSheet, 2, { balance: 25000 });
assert.equal(dynamicSheet.getRange(2, 7).getValue(), 10800);
assert.equal(derivedPct_(dynamicSheet, 2), 30.17,
  'changing Balance updates both derived fields');

writeSourceAndRecalc_(dynamicSheet, 2, { limit: 40000 });
assert.equal(dynamicSheet.getRange(2, 7).getValue(), 15000);
assert.equal(derivedPct_(dynamicSheet, 2), 37.5,
  'changing Credit Limit updates both derived fields');

writeSourceAndRecalc_(dynamicSheet, 2, { balance: 28923.04, limit: 35800 });
assert.equal(dynamicSheet.getRange(2, 7).getValue(), 6876.96);
assert.equal(derivedPct_(dynamicSheet, 2), 19.21,
  'changing both Balance and Credit Limit updates both derived fields');

dynamicSheet.getRange(2, 7).setValue(-660.39);
ctx.recalcDebtPctAvailForRow_(dynamicSheet, 2, {
  typeCol: 1, creditLimitCol: 5, creditLeftCol: 6, balanceCol: 3, pctAvailCol: 8
});
assert.equal(derivedPct_(dynamicSheet, 2), 19.21,
  'stale Credit Left cannot affect Acct PCT Avail');
assert.equal(dynamicSheet.getRange(2, 7).getValue(), -660.39,
  'pct-only recalc must not write Credit Left');

const loanLeftBefore = dynamicSheet.getRange(3, 7).getValue();
const helocLeftBefore = dynamicSheet.getRange(4, 7).getValue();
writeSourceAndRecalc_(dynamicSheet, 3, { balance: 199000, limit: 0 });
writeSourceAndRecalc_(dynamicSheet, 4, { balance: 54000, limit: 80000 });
assert.equal(dynamicSheet.getRange(3, 7).getValue(), loanLeftBefore,
  'loans must not receive credit-card available-credit formulas');
assert.equal(dynamicSheet.getRange(4, 7).getValue(), helocLeftBefore,
  'HELOCs must not receive credit-card available-credit formulas');

const formulaLeftBefore = dynamicSheet.getRange(5, 7).getValue();
const formulaPctBefore = dynamicSheet.getRange(5, 9).getValue();
writeSourceAndRecalc_(dynamicSheet, 5, { balance: 2000 });
assert.equal(dynamicSheet.getRange(5, 7).getValue(), formulaLeftBefore,
  'existing Credit Left formulas remain the source of truth');
assert.equal(dynamicSheet.getRange(5, 9).getValue(), formulaPctBefore,
  'existing Acct PCT Avail formulas remain the source of truth');
assert.equal(dynamicSheet.formulas[4][6], '=F5-D5');
assert.equal(dynamicSheet.formulas[4][8], '=G5/F5');

const previewSheet = new FakeSheet('INPUT - Debts', [
  debtHeaders,
  ['Derived Fixture Card', 'Credit Card', 'Yes', 28923.04, 35, 35800, -660.39, 24.99, -0.0184]
]);
const previewSs = {
  getSheetByName(name) { return name === ctx.getSheetNames_().DEBTS ? previewSheet : null; }
};
const previewBefore = JSON.stringify(previewSheet.rows);
const preview = ctx.previewDebtDerivedCreditFieldRepair_(previewSs);
assert.equal(preview.ok, true);
assert.equal(preview.mismatches.length, 1);
assert.equal(JSON.stringify(previewSheet.rows), previewBefore,
  'preview must not rewrite populated workbook values');
assert.throws(
  () => ctx.applyDebtDerivedCreditFieldRepair_({ accountName: 'Derived Fixture Card' }, previewSs),
  /explicit confirmation/,
  'repair requires explicit confirmation and is not run automatically'
);
assert.throws(
  () => ctx.applyDebtDerivedCreditFieldRepair_({
    confirmRepair: true, repairAllMismatchedCreditCards: true, accountName: 'Derived Fixture Card'
  }, previewSs),
  /Bulk derived credit repair is not enabled/,
  'bulk repair remains disabled'
);
assert.equal(JSON.stringify(previewSheet.rows), previewBefore,
  'failed or unconfirmed repair must not write derived fields');

assert.equal(ctx.debtDerivedAvailableCredit_(35800, 28923.04).creditLeft, 6876.96);
assert.equal(ctx.debtDerivedAvailableCredit_(35800, 28923.04).pctAvail, 19.21);
assert.equal(ctx.debtIsCreditCardType_('HELOC'), false);
assert.equal(ctx.debtIsCreditCardType_('Loan'), false);
assert.equal(ctx.debtIsCreditCardType_('Credit Card'), true);

console.log('Plaid Credit Left semantics regressions passed.');
