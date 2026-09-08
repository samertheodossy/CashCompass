import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const read = (name) => fs.readFileSync(new URL(name, root), 'utf8');

const debtsSource = read('debts.js');
const modelSource = read('monthly_checkin.js');
const identitySource = read('monthly_checkin_identity.js');
const helpersSource = read('planner_helpers.js');
const configSource = read('config.js');

assert.match(debtsSource, /DEBTS_LAST_UPDATED_HEADER_/);
assert.match(debtsSource, /function ensureDebtsLastUpdatedColumn_/);
assert.match(debtsSource, /function touchDebtLastUpdatedForActiveRow_/);
assert.doesNotMatch(debtsSource, /confirmDebtBalanceReviewFromDashboard/);
assert.doesNotMatch(debtsSource, /confirmAllDebtBalanceReviewsFromDashboard/);
assert.doesNotMatch(debtsSource, /DEBTS_LAST_REVIEWED_HEADER_/);
assert.doesNotMatch(debtsSource, /writeSetting_/);
assert.doesNotMatch(debtsSource, /reviewedKeys/);

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
        this.sheet.cell(this.row + r, this.col + c)));
  }
  getDisplayValues() {
    return this.getValues().map((row) =>
      row.map((value) => {
        if (value instanceof Date) {
          const year = value.getFullYear();
          const month = String(value.getMonth() + 1).padStart(2, '0');
          const day = String(value.getDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
        }
        return value == null ? '' : String(value);
      }));
  }
  getDisplayValue() {
    return this.getDisplayValues()[0][0];
  }
  getValue() {
    return this.getValues()[0][0];
  }
  getNumberFormat() { return '0.00'; }
  setValue(value) {
    this.sheet.writeLog.push({ type: 'setValue', row: this.row, col: this.col, value });
    this.sheet.setCell(this.row, this.col, value);
    return this;
  }
  setNumberFormat() { return this; }
  clearDataValidations() { return this; }
  setDataValidation() { return this; }
  copyTo() { return this; }
}

class FakeSheet {
  constructor(name, rows = [], parent = null) {
    this.name = name;
    this.rows = rows.map((row) => row.slice());
    this.writeLog = [];
    this._parent = parent;
  }
  getName() { return this.name; }
  getParent() { return this._parent; }
  getLastRow() { return this.rows.length; }
  getLastColumn() {
    return this.rows.reduce((max, row) => Math.max(max, row.length), 0) || 1;
  }
  getMaxRows() { return 1000; }
  cell(row, col) {
    const r = row - 1;
    const c = col - 1;
    while (this.rows.length <= r) this.rows.push([]);
    if (this.rows[r][c] === undefined) return '';
    return this.rows[r][c];
  }
  setCell(row, col, value) {
    const r = row - 1;
    const c = col - 1;
    while (this.rows.length <= r) this.rows.push([]);
    this.rows[r][c] = value;
  }
  getRange(row, col, numRows = 1, numCols = 1) {
    return new FakeRange(this, row, col, numRows, numCols);
  }
  getDataRange() {
    const lastRow = this.getLastRow();
    const lastCol = this.getLastColumn();
    return new FakeRange(this, 1, 1, lastRow, lastCol);
  }
  setColumnWidth() { return this; }
}

const DEBTS_HEADERS = [
  'Account Name', 'Type', 'Account Balance', 'Due Date', 'Credit Limit',
  'Minimum Payment', 'Credit Left', 'Int Rate', 'Acct PCT Avail', 'Active', 'Linked Property'
];

function buildDebtSheetRows(extraRows = []) {
  return [
    DEBTS_HEADERS.slice(),
    ['Citi Card', 'Credit Card', 1200, 15, 5000, 50, 3800, '18%', '76%', 'Yes', ''],
    ['Old Loan', 'Loan', 9000, 1, '', 200, '', '5%', '', 'No', ''],
    ...extraRows
  ];
}

const registryAccounts = [{
  stableAccountId: 'DEBT-CITI-1',
  domain: 'DEBT',
  displayName: 'Citi Card',
  legacyDomain: 'INPUT_DEBTS',
  legacyKey: 'Citi Card',
  identityStatus: 'VERIFIED'
}];

function buildDebtContext(sheetRows) {
  const ss = { sheets: {} };
  const debtsSheet = new FakeSheet('INPUT - Debts', sheetRows, ss);
  ss.sheets['INPUT - Debts'] = debtsSheet;
  ss.getSheetByName = function(name) { return this.sheets[name] || null; };
  const ctx = {
    console,
    SpreadsheetApp: {
      CopyPasteType: { PASTE_FORMAT: 'PASTE_FORMAT' },
      newDataValidation() {
        return {
          requireValueInList() { return this; },
          setAllowInvalid() { return this; },
          setHelpText() { return this; },
          build() { return {}; }
        };
      }
    },
    Session: { getScriptTimeZone: () => 'America/Los_Angeles' },
    Utilities: {
      formatDate(date, _tz, pattern) {
        const value = date instanceof Date ? date : new Date(date);
        if (pattern === 'yyyy-MM-dd') {
          const year = value.getFullYear();
          const month = String(value.getMonth() + 1).padStart(2, '0');
          const day = String(value.getDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
        }
        if (pattern === 'yyyy-MM') {
          const year = value.getFullYear();
          const month = String(value.getMonth() + 1).padStart(2, '0');
          return `${year}-${month}`;
        }
        return value.toISOString();
      }
    },
    Logger: { log() {} },
    getUserSpreadsheet_: () => ss,
    getSheetNames_: () => ({ DEBTS: 'INPUT - Debts' }),
    getSheet_: (_ss, key) => key === 'DEBTS' ? debtsSheet : null,
    getActiveHouseNamesForSpreadsheet_: () => [],
    financialIdentityReadRegistry_: () => ({ accounts: registryAccounts.slice() }),
    toNumber_: (value) => Number(value),
    round2_: (value) => Math.round(Number(value) * 100) / 100,
    stripTime_: (date) => {
      const value = date instanceof Date ? date : new Date(date);
      return new Date(value.getFullYear(), value.getMonth(), value.getDate());
    },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: () => null,
        setProperty: () => {}
      })
    },
    touchDashboardSourceUpdated_: () => {},
    appendActivityLog_: () => {},
    applyCurrencyFormat_: () => {},
    fitContentColumnsToContents_: () => {},
    copyNeighborFormatInRow_: () => {},
    setCurrencyCellPreserveRowFormat_: (sheet, row, col, value) => {
      sheet.setCell(row, col, value);
    }
  };
  vm.createContext(ctx);
  vm.runInContext(configSource, ctx, { filename: 'config.js' });
  vm.runInContext(helpersSource, ctx, { filename: 'planner_helpers.js' });
  vm.runInContext(modelSource, ctx, { filename: 'monthly_checkin.js' });
  vm.runInContext(identitySource, ctx, { filename: 'monthly_checkin_identity.js' });
  vm.runInContext(debtsSource, ctx, { filename: 'debts.js' });
  return { ctx, debtsSheet, ss };
}

const beforeRows = buildDebtSheetRows();
const beforeSnapshot = JSON.stringify(beforeRows);
const { ctx, debtsSheet } = buildDebtContext(beforeRows.map((row) => row.slice()));

const headerMap = ctx.ensureDebtsLastUpdatedColumn_(debtsSheet);
assert.equal(headerMap.lastUpdatedColZero, DEBTS_HEADERS.length);
assert.equal(debtsSheet.rows[0][DEBTS_HEADERS.length], 'Last Updated');
assert.equal(debtsSheet.rows[1][1], 'Credit Card');
assert.equal(debtsSheet.rows[1][2], 1200);
assert.equal(JSON.stringify(debtsSheet.rows[1].slice(0, DEBTS_HEADERS.length)),
  JSON.stringify(beforeRows[1]));

const activeDebts = ctx.getActiveDebtsForManagementFromDashboard();
assert.equal(activeDebts.length, 1);
assert.equal(activeDebts[0].accountName, 'Citi Card');
assert.equal(activeDebts[0].lastUpdated, '');

const blankReview = ctx.monthlyCheckinBuildDomainProjection_(
  'debts',
  ctx.monthlyCheckinDefaultState_('2026-09'),
  [{ accountKey: 'debt:v1:DEBT-CITI-1', lastUpdated: '' }], []);
assert.equal(blankReview.currentCount, 0);
assert.equal(blankReview.needsUpdateCount, 1);

const priorMonthReview = ctx.monthlyCheckinBuildDomainProjection_(
  'debts',
  ctx.monthlyCheckinDefaultState_('2026-09'),
  [{ accountKey: 'debt:v1:DEBT-CITI-1', lastUpdated: '2026-08-15' }], []);
assert.equal(priorMonthReview.currentCount, 0);

const currentCycleReview = ctx.monthlyCheckinBuildDomainProjection_(
  'debts',
  ctx.monthlyCheckinDefaultState_('2026-09'),
  [{ accountKey: 'debt:v1:DEBT-CITI-1', lastUpdated: '2026-09-03' }], []);
assert.equal(currentCycleReview.currentCount, 1);
assert.equal(currentCycleReview.status, 'COMPLETE');

const tenOfTwentyFour = ctx.monthlyCheckinBuildDomainProjection_(
  'debts',
  ctx.monthlyCheckinDefaultState_('2026-09'),
  Array.from({ length: 24 }, (_, index) => ({
    accountKey: 'debt:v1:DEBT-' + String(index + 1).padStart(2, '0'),
    lastUpdated: index < 10 ? '2026-09-10' : ''
  })), []);
assert.equal(tenOfTwentyFour.currentCount, 10);
assert.equal(tenOfTwentyFour.needsUpdateCount, 14);

const rollover = ctx.monthlyCheckinBuildDomainProjection_(
  'debts',
  ctx.monthlyCheckinDefaultState_('2026-10'),
  [{ accountKey: 'debt:v1:DEBT-CITI-1', lastUpdated: '2026-09-30' }], []);
assert.equal(rollover.currentCount, 0);

const lastUpdatedCol = DEBTS_HEADERS.length + 1;
debtsSheet.writeLog.length = 0;
const touchResult = ctx.touchDebtLastUpdatedForActiveRow_(debtsSheet, 2, headerMap, debtsSheet.getParent());
const today = new Date();
const expectedIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
assert.equal(touchResult, expectedIso);
assert.equal(debtsSheet.rows[1][2], 1200, 'balance must remain unchanged');
assert.equal(debtsSheet.rows[1][1], 'Credit Card', 'type must remain unchanged');
const dateWrites = debtsSheet.writeLog.filter((entry) =>
  entry.type === 'setValue' && entry.row === 2 && entry.col === lastUpdatedCol);
assert.equal(dateWrites.length, 1);
assert.ok(
  dateWrites[0].value instanceof Date || ctx.debtParseLastUpdatedDate_(dateWrites[0].value),
  'Last Updated write must store a real date value'
);

debtsSheet.writeLog.length = 0;
const inactiveTouch = ctx.touchDebtLastUpdatedForActiveRow_(debtsSheet, 3, headerMap, debtsSheet.getParent());
assert.equal(inactiveTouch, '');
assert.equal(debtsSheet.writeLog.length, 0, 'inactive debt must not write Last Updated');

debtsSheet.writeLog.length = 0;
ctx.updateDebtField({
  accountName: 'Citi Card',
  fieldName: 'Account Balance',
  value: 1300
});
const fieldSaveWrites = debtsSheet.writeLog.filter((entry) =>
  entry.type === 'setValue' && entry.row === 2 && entry.col === lastUpdatedCol);
assert.equal(fieldSaveWrites.length, 1, 'financial updateDebtField save must touch Last Updated');
assert.equal(debtsSheet.rows[1][2], 1300);

debtsSheet.writeLog.length = 0;
ctx.updateDebtField({
  accountName: 'Citi Card',
  fieldName: 'Account Balance',
  value: 1300
});
assert.equal(
  debtsSheet.writeLog.filter((entry) =>
    entry.type === 'setValue' && entry.row === 2 && entry.col === lastUpdatedCol).length,
  0,
  'repeat save with unchanged value must not touch Last Updated again'
);

debtsSheet.writeLog.length = 0;
ctx.updateDebtField({
  accountName: 'Old Loan',
  fieldName: 'Account Balance',
  value: 8500
});
assert.equal(
  debtsSheet.writeLog.filter((entry) =>
    entry.type === 'setValue' && entry.col === lastUpdatedCol).length,
  0,
  'inactive debt financial save must not touch Last Updated'
);

debtsSheet.writeLog.length = 0;
ctx.updateTrackedDebtFromDashboard({
  sheetRow: 2,
  expectedAccountName: 'Citi Card',
  newAccountName: 'Citi Card'
});
assert.equal(
  debtsSheet.writeLog.filter((entry) =>
    entry.type === 'setValue' && entry.col === lastUpdatedCol).length,
  0,
  'display-only tracked save without financial changes must not touch Last Updated'
);

debtsSheet.writeLog.length = 0;
ctx.updateTrackedDebtFromDashboard({
  sheetRow: 2,
  expectedAccountName: 'Citi Card',
  newAccountName: 'Citi Card',
  accountBalance: 1400
});
const trackedSaveWrites = debtsSheet.writeLog.filter((entry) =>
  entry.type === 'setValue' && entry.row === 2 && entry.col === lastUpdatedCol);
assert.equal(trackedSaveWrites.length, 1, 'tracked financial save must touch Last Updated');

const readOnlyCtx = buildDebtContext(beforeRows.map((row) => row.slice()));
readOnlyCtx.debtsSheet.writeLog.length = 0;
const readRows = readOnlyCtx.ctx.getActiveDebtsForManagementFromDashboard();
assert.equal(readRows[0].lastUpdated, '');
assert.equal(readOnlyCtx.debtsSheet.rows[0][DEBTS_HEADERS.length], 'Last Updated',
  'Debts tab read must add Last Updated header without writing row dates');
const readDateWrites = readOnlyCtx.debtsSheet.writeLog.filter((entry) =>
  entry.type === 'setValue' && entry.row > 1 && entry.col === lastUpdatedCol);
assert.equal(readDateWrites.length, 0, 'reads must not write Last Updated row dates');

assert.equal(beforeSnapshot, JSON.stringify(beforeRows),
  'fixture snapshot unchanged; additive ensure must not rewrite populated debt data');

assert.doesNotMatch(read('capital_allocation.js'), /touchDebtLastUpdatedForActiveRow_/);
assert.doesNotMatch(read('data_readiness.js'), /touchDebtLastUpdatedForActiveRow_/);

const applySessionCtx = buildDebtContext(beforeRows.map((row) => row.slice()));
applySessionCtx.ctx.plaidImportDebtApplyWriteSession_ = function() {
  return {
    accountName: 'Citi Card',
    ss: applySessionCtx.ss,
    sheet: applySessionCtx.debtsSheet,
    display: applySessionCtx.debtsSheet.getDataRange().getDisplayValues(),
    headerMap: applySessionCtx.ctx.getDebtsHeaderMap_(applySessionCtx.debtsSheet),
    targetRow: 2
  };
};
applySessionCtx.debtsSheet.writeLog.length = 0;
applySessionCtx.ctx.updateDebtField({
  accountName: 'Citi Card',
  fieldName: 'Account Balance',
  value: 1250,
  plaidImportApplyBatch: true
});
const applySessionWrites = applySessionCtx.debtsSheet.writeLog.filter((entry) =>
  entry.type === 'setValue' && entry.row === 2 && entry.col === lastUpdatedCol);
assert.equal(applySessionWrites.length, 1,
  'Plaid apply batch must touch Last Updated when applySession.values is absent');

console.log('Monthly check-in debt regressions passed.');
