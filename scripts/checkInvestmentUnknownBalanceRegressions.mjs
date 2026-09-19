import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read = (name) => fs.readFileSync(new URL('../' + name, import.meta.url), 'utf8');
const investmentsSource = read('investments.js');
const body = read('Dashboard_Body.html');
const help = read('Dashboard_Help.html');
const client = read('Dashboard_Script_AssetsBankInvestments.html');
const sidebar = read('PlannerDashboard.html');

const investmentAdd = body.slice(body.indexOf('id="inv_mode_add_wrap"'), body.indexOf('id="inv_mode_manage_wrap"'));
assert.doesNotMatch(investmentAdd, /enter\s+(?:<code>)?0(?:<\/code>)?\s+if unknown/i);
const createInvestment = client.slice(client.indexOf('function createInvestmentAccount()'), client.indexOf('function stopTrackingInvestment()'));
assert.doesNotMatch(createInvestment, /enter 0 if unknown/i);
assert.match(createInvestment, /startingBalanceUnknown\s*=\s*true/);
assert.match(createInvestment, /payload\.startingBalance\s*=\s*startNum/);
assert.doesNotMatch(investmentsSource, /blank is treated as 0/);
assert.doesNotMatch(investmentsSource, /leave month empty for 0/);
assert.match(body, /id="inv_add_balance_unknown"/);
assert.match(body, /Balance is unknown \/ not available yet/);
assert.match(body, /\$0\.00<\/strong> only when you have confirmed the balance is actually zero/);
assert.match(help, /Planning does not treat it as a verified zero/);
assert.match(sidebar, /id="inv_add_balance_unknown"/);
assert.match(sidebar, /startingBalanceUnknown\s*=\s*true/);
assert.match(investmentsSource,
  /function updateInvestmentValueByDate\(payload\)[\s\S]*?changed-column fit[\s\S]*?function addInvestmentAccountFromDashboard\(payload\)[\s\S]*?fitContentColumnsToContents_\(\[[\s\S]*?balanceCol/);
assert.match(investmentsSource, /if \(!starting\.unknown\) \{\s*updateInvestmentHistory_\(accountName, currentYear, startDate, starting\.amount\);/);
assert.match(investmentsSource, /starting\.unknown \? null : starting\.amount/);

class FakeRange {
  constructor(sheet, row, col, numRows = 1, numCols = 1) {
    this.sheet = sheet;
    this.row = row;
    this.col = col;
    this.numRows = numRows;
    this.numCols = numCols;
  }
  getValue() { return this.sheet.valueAt(this.row, this.col); }
  getDisplayValue() { return String(this.getValue() ?? ''); }
  getFormula() { return this.sheet.formulaAt(this.row, this.col); }
  setValue(value) { this.sheet.setValueAt(this.row, this.col, value); return this; }
  setFormula(formula) { this.sheet.setFormulaAt(this.row, this.col, formula); return this; }
  setNumberFormat() { return this; }
  getNumberFormat() { return '$#,##0.00'; }
  clearContent() {
    for (let r = 0; r < this.numRows; r++) {
      for (let c = 0; c < this.numCols; c++) {
        this.sheet.setValueAt(this.row + r, this.col + c, '');
        this.sheet.setFormulaAt(this.row + r, this.col + c, '');
      }
    }
    return this;
  }
  getValues() {
    return Array.from({ length: this.numRows }, (_, r) =>
      Array.from({ length: this.numCols }, (_, c) => this.sheet.valueAt(this.row + r, this.col + c)));
  }
  getDisplayValues() {
    return this.getValues().map((row) => row.map((value) => String(value ?? '')));
  }
  setValues(values) {
    values.forEach((row, r) => row.forEach((value, c) => {
      this.sheet.setValueAt(this.row + r, this.col + c, value);
    }));
    return this;
  }
  copyTo() { return this; }
  setBackground() { return this; }
  setFontWeight() { return this; }
  setFontColor() { return this; }
  setFontSize() { return this; }
  setVerticalAlignment() { return this; }
  setHorizontalAlignment() { return this; }
}

class FakeSheet {
  constructor(name, rows) {
    this.name = name;
    this.width = Math.max(1, ...rows.map((row) => row.length));
    this.rows = rows.map((row) => this.pad(row));
    this.formulas = this.rows.map((row) => row.map(() => ''));
  }
  pad(row) {
    const copy = row.slice();
    while (copy.length < this.width) copy.push('');
    return copy;
  }
  getName() { return this.name; }
  getLastRow() { return this.rows.length; }
  getLastColumn() { return this.width; }
  valueAt(row, col) {
    return this.rows[row - 1]?.[col - 1] ?? '';
  }
  formulaAt(row, col) {
    return this.formulas[row - 1]?.[col - 1] ?? '';
  }
  setValueAt(row, col, value) {
    while (this.rows.length < row) {
      this.rows.push(Array.from({ length: this.width }, () => ''));
      this.formulas.push(Array.from({ length: this.width }, () => ''));
    }
    this.rows[row - 1][col - 1] = value;
  }
  setFormulaAt(row, col, formula) {
    this.setValueAt(row, col, this.valueAt(row, col));
    this.formulas[row - 1][col - 1] = formula;
  }
  getRange(row, col, numRows, numCols) {
    return new FakeRange(this, row, col, numRows || 1, numCols || 1);
  }
  getDataRange() {
    return this.getRange(1, 1, Math.max(1, this.getLastRow()), this.getLastColumn());
  }
  insertRowAfter(row) {
    const blank = Array.from({ length: this.width }, () => '');
    this.rows.splice(row, 0, blank.slice());
    this.formulas.splice(row, 0, blank.slice());
  }
  deleteRow(row) {
    this.rows.splice(row - 1, 1);
    this.formulas.splice(row - 1, 1);
  }
  appendRow(values) {
    this.rows.push(this.pad(values));
    this.formulas.push(Array.from({ length: this.width }, () => ''));
  }
  setRowHeight() {}
  getRowHeight() { return 26; }
  setFrozenRows() {}
  setFrozenColumns() {}
}

const now = new Date();
const year = now.getFullYear();
const monthIndex = now.getMonth();
const isoDate = year + '-' + String(monthIndex + 1).padStart(2, '0') + '-15';
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  .map((name) => name + '-' + String(year).slice(-2));
const priorMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  .map((name) => name + '-' + String(year - 1).slice(-2));

function historyRow(name, type, valuesByMonth) {
  const row = [name, type].concat(Array.from({ length: 12 }, () => '')).concat(['Yes']);
  Object.keys(valuesByMonth).forEach((index) => {
    row[2 + Number(index)] = valuesByMonth[index];
  });
  return row;
}

const priorAccount = historyRow('Old Brokerage', 'Brokerage', { 0: 1000 });
const existingAccount = historyRow('Existing Brokerage', 'Brokerage', { 0: 12500, [monthIndex]: 13000 });
const investments = new FakeSheet('INPUT - Investments', [
  ['Year', String(year - 1)],
  ['Account Name', 'Type'].concat(priorMonths).concat(['Active']),
  priorAccount,
  ['Account Totals', ''],
  ['Delta', ''],
  ['Year', String(year)],
  ['Account Name', 'Type'].concat(months).concat(['Active']),
  existingAccount,
  ['Account Totals', ''],
  ['Delta', '']
]);
const assets = new FakeSheet('SYS - Assets', [
  ['Account Name', 'Type', 'Current Balance', 'Active'],
  ['Existing Brokerage', 'Brokerage', 13000, 'Yes']
]);
const ss = {
  getSheetByName(name) {
    if (name === 'INPUT - Investments') return investments;
    if (name === 'SYS - Assets') return assets;
    return null;
  }
};

function rowByName(sheet, name) {
  return sheet.rows.find((row) => String(row[0] || '').trim() === name) || null;
}
function snapshotRows(names) {
  return names.map((name) => JSON.stringify(rowByName(investments, name)));
}
function assetBalance(name) {
  const row = rowByName(assets, name);
  return row ? row[2] : undefined;
}

const preservedNames = ['Old Brokerage', 'Existing Brokerage'];
const preservedBefore = snapshotRows(preservedNames);
const existingAssetBefore = JSON.stringify(rowByName(assets, 'Existing Brokerage'));
const activity = [];

const context = {
  console,
  SpreadsheetApp: { flush() {}, CopyPasteType: { PASTE_FORMAT: 'PASTE_FORMAT' } },
  Logger: { log() {} },
  Session: { getScriptTimeZone() { return 'America/Los_Angeles'; } },
  Utilities: {
    formatDate(date, _tz, fmt) {
      const d = date instanceof Date ? date : new Date(date);
      const mmm = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()];
      const yy = String(d.getFullYear()).slice(-2);
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      if (fmt === 'MMM-yy') return mmm + '-' + yy;
      if (fmt === 'yy-MMM') return yy + '-' + mmm;
      if (fmt === 'MMM yy') return mmm + ' ' + yy;
      if (fmt === 'yy MMM') return yy + ' ' + mmm;
      if (fmt === 'yyyy-MM-dd') return d.getFullYear() + '-' + month + '-' + day;
      if (fmt === 'MMM-yyyy') return mmm + '-' + d.getFullYear();
      return String(d);
    }
  },
  parseIsoDateLocal_(isoText) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(isoText || '').trim());
    if (!match) throw new Error('Invalid ISO date: ' + isoText);
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  },
  columnToLetter_(column) {
    let n = column;
    let out = '';
    while (n > 0) {
      const rem = (n - 1) % 26;
      out = String.fromCharCode(65 + rem) + out;
      n = Math.floor((n - 1) / 26);
    }
    return out;
  }
};
vm.createContext(context);
vm.runInContext(read('planner_helpers.js'), context, { filename: 'planner_helpers.js' });
vm.runInContext(investmentsSource, context, { filename: 'investments.js' });
vm.runInContext(read('financial_integrity_canonical.js'), context, { filename: 'financial_integrity_canonical.js' });
vm.runInContext(read('monthly_checkin.js'), context, { filename: 'monthly_checkin.js' });
vm.runInContext(read('monthly_checkin_read.js'), context, { filename: 'monthly_checkin_read.js' });

context.getUserSpreadsheet_ = () => ss;
context.getSheet_ = (spreadsheet, key) => {
  const names = { INVESTMENTS: 'INPUT - Investments', ASSETS: 'SYS - Assets' };
  const sheet = spreadsheet.getSheetByName(names[key] || key);
  if (!sheet) throw new Error('Missing sheet: ' + key);
  return sheet;
};
context.ensureInputInvestmentsSheet_ = () => investments;
context.ensureSysAssetsSheet_ = () => assets;
context.applyInvestmentsSheetStyling_ = () => {};
context.applyAssetsSheetStyling_ = () => {};
context.fitContentColumnsToContents_ = () => {};
context.touchDashboardSourceUpdated_ = () => {};
context.writeActiveCellWithRowFormat_ = (sheet, row, col, value) => {
  sheet.getRange(row, col).setValue(String(value == null ? '' : value));
};
context.appendActivityLog_ = (_ss, payload) => {
  activity.push(payload);
  return true;
};

assert.throws(() => context.addInvestmentAccountFromDashboard({
  accountName: 'Rejected Unknown',
  type: 'Brokerage'
}), /confirm the balance is unknown/);
assert.throws(() => context.addInvestmentAccountFromDashboard({
  accountName: 'Rejected Both',
  type: 'Brokerage',
  startingBalanceUnknown: true,
  startingBalance: 0
}), /Clear the starting value/);
assert.deepEqual(snapshotRows(preservedNames), preservedBefore, 'rejected creates must not touch existing history');
assert.equal(JSON.stringify(rowByName(assets, 'Existing Brokerage')), existingAssetBefore);

context.addInvestmentAccountFromDashboard({
  accountName: 'Positive IRA',
  type: 'Retirement',
  startingBalance: 2500,
  startingBalanceDate: isoDate
});
context.addInvestmentAccountFromDashboard({
  accountName: 'Zero Brokerage',
  type: 'Brokerage',
  startingBalance: 0,
  startingBalanceDate: isoDate
});
context.addInvestmentAccountFromDashboard({
  accountName: 'Unknown IRA',
  type: 'Retirement',
  startingBalanceUnknown: true
});

assert.deepEqual(snapshotRows(preservedNames), preservedBefore,
  'adding accounts must not rewrite existing investment history');
assert.equal(JSON.stringify(rowByName(assets, 'Existing Brokerage')), existingAssetBefore,
  'adding accounts must not rewrite an existing SYS asset balance');
assert.equal(rowByName(investments, 'Rejected Unknown'), null);
assert.equal(rowByName(investments, 'Rejected Both'), null);

const monthCol = 2 + monthIndex;
assert.equal(rowByName(investments, 'Positive IRA')[monthCol], 2500);
assert.equal(assetBalance('Positive IRA'), 2500);
assert.equal(rowByName(investments, 'Zero Brokerage')[monthCol], 0);
assert.equal(assetBalance('Zero Brokerage'), 0);
const unknownHistory = rowByName(investments, 'Unknown IRA');
assert.ok(unknownHistory, 'unknown still creates the investment account');
assert.equal(unknownHistory[1], 'Retirement');
for (let i = 0; i < 12; i++) {
  assert.equal(unknownHistory[2 + i], '', 'unknown must not write a monthly value');
}
assert.equal(assetBalance('Unknown IRA'), '', 'unknown must not write a fake SYS $0');

const latest = context.getLatestInvestmentValuesForYear_(investments, year);
assert.equal(latest['Positive IRA'], 2500);
assert.equal(latest['Zero Brokerage'], 0);
assert.equal(Object.prototype.hasOwnProperty.call(latest, 'Unknown IRA'), false,
  'Planning latest values must not treat an unknown balance as zero');
assert.equal(latest['Existing Brokerage'], 13000);
assert.equal(latest['Old Brokerage'], undefined);

const ledger = context.canonicalReadYearLedger_(investments, year, {
  domain: 'investments',
  getBlock: context.getInvestmentsYearBlock_,
  isDataRow(name) { return context.isInvestmentDataRowName_(name); }
});
const byName = Object.fromEntries(ledger.rows.map((row) => [row.name, row]));
assert.equal(byName['Zero Brokerage'].hasCurrentValue, true);
assert.equal(byName['Zero Brokerage'].currentValue, 0);
assert.equal(byName['Unknown IRA'].hasCurrentValue, false);
assert.equal(byName['Positive IRA'].currentValue, 2500);
const verifiedTotal = context.canonicalFinancialSumIncluded_(ledger.rows, 'currentValue');
const withoutUnknown = context.canonicalFinancialSumIncluded_(
  ledger.rows.filter((row) => row.name !== 'Unknown IRA'), 'currentValue');
assert.equal(verifiedTotal, withoutUnknown,
  'Planning must not add an unknown investment as a verified current balance');
assert.equal(verifiedTotal, context.round2_(13000 + 2500 + 0));

const balanceDate = new Date(year, monthIndex, 15);
const monthMap = context.monthlyCheckinReadMonthValueMap_(
  investments,
  balanceDate,
  context.getInvestmentsYearBlock_,
  (dispRow) => {
    const name = String(dispRow[0] || '').trim();
    if (!context.isInvestmentDataRowName_(name)) return null;
    return { name: name };
  }
);
function reviewStatus(name) {
  const info = context.monthlyCheckinMonthValueInfo_(monthMap, name, null);
  return context.monthlyCheckinEvaluateMonthValueEvidence_(info);
}
const unknownReview = reviewStatus('Unknown IRA');
assert.equal(unknownReview.evidenceStatus, 'MISSING');
assert.equal(unknownReview.hasCurrentMonthValue, false);
assert.equal(unknownReview.currentMonthValue, null);
const zeroReview = reviewStatus('Zero Brokerage');
assert.equal(zeroReview.evidenceStatus, 'CURRENT');
assert.equal(zeroReview.hasCurrentMonthValue, true);
assert.equal(zeroReview.currentMonthValue, 0);
const positiveReview = reviewStatus('Positive IRA');
assert.equal(positiveReview.evidenceStatus, 'CURRENT');
assert.equal(positiveReview.currentValue === undefined ? positiveReview.currentMonthValue : positiveReview.currentValue, 2500);

const unknownLog = activity.find((row) => row.payee === 'Unknown IRA');
const unknownDetails = JSON.parse(unknownLog.details);
assert.equal(unknownDetails.startingBalanceUnknown, true);
assert.equal(unknownDetails.startingBalance, null);
const zeroLog = activity.find((row) => row.payee === 'Zero Brokerage');
assert.equal(JSON.parse(zeroLog.details).startingBalance, 0);
assert.equal(JSON.parse(zeroLog.details).startingBalanceUnknown, false);

console.log('investment unknown-balance regressions passed');
