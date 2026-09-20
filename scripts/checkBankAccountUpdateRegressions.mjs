import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read = (name) => fs.readFileSync(new URL('../' + name, import.meta.url), 'utf8');
const bankSource = read('bank_accounts.js');
const body = read('Dashboard_Body.html');
const help = read('Dashboard_Help.html');
const client = read('Dashboard_Script_AssetsBankInvestments.html');
const sidebar = read('PlannerDashboard.html');
const legacySidebar = read('BankAccountsUI.html');

const bankUpdate = body.slice(body.indexOf('id="bank_mode_update_wrap"'), body.indexOf('id="bank_mode_add_wrap"'));
assert.match(bankUpdate, /Monthly balance/);
assert.doesNotMatch(bankUpdate, />Value</);
assert.match(bankUpdate, /id="bank_updateAvailableNow"/);
assert.doesNotMatch(bankUpdate, /id="bank_updateAvailableNow"\s+checked/);
assert.match(bankUpdate, /id="bank_updateMinBuffer"/);
assert.doesNotMatch(bankUpdate, /id="bank_updateMinBuffer"\s+checked/);
assert.match(bankUpdate, /This changes the amount Planning may use/);
assert.match(bankUpdate, /A blank balance is not saved as \$0/);
assert.match(help, /The box starts unchecked/);
assert.match(help, /A blank monthly balance is not saved as \$0/);
assert.match(sidebar, /Monthly balance/);
assert.doesNotMatch(sidebar, /id="bank_updateAvailableNow"\s+checked/);
assert.match(sidebar, /This changes the amount Planning may use/);
assert.match(legacySidebar, /Monthly balance/);
assert.doesNotMatch(legacySidebar, /id="updateAvailableNow"\s+checked/);
assert.match(client, /function saveBank\(\)[\s\S]*Enter a monthly balance, including \$0\.00 if the account is actually at zero/);
assert.match(client, /function saveBank\(\)[\s\S]*updateAvailableNow:\s*document\.getElementById\('bank_updateAvailableNow'\)\.checked/);
assert.match(sidebar, /function saveBank\(\)[\s\S]*Enter a monthly balance, including \$0\.00 if the account is actually at zero/);
assert.match(bankSource, /function resolveBankMonthlyBalance_/);
assert.match(bankSource, /Enter a monthly balance, including 0\.00 if the account is actually at zero/);
assert.doesNotMatch(
  bankSource,
  /function updateBankAccountValueByDate_\(payload, trustedProvenance\)[\s\S]*?const currentValue = toNumber_\(payload\.currentValue\)/
);
assert.match(
  bankSource,
  /function updateBankAccountValueByDate_\(payload, trustedProvenance\)[\s\S]*?const updateAvailableNow = !!payload\.updateAvailableNow/
);

const bankAdd = body.slice(body.indexOf('id="bank_mode_add_wrap"'), body.indexOf('id="bank_mode_manage_wrap"'));
const sidebarAdd = sidebar.slice(sidebar.indexOf('id="bank_mode_add_wrap"'), sidebar.indexOf('id="bank_status"'));
assert.match(bankAdd, /id="bank_add_balance_unknown"/);
assert.match(bankAdd, /Opening balance is unknown \/ not available yet/);
assert.match(bankAdd, /This changes the amount Planning may use/);
assert.match(bankAdd, /This changes the protected minimum/);
assert.doesNotMatch(bankAdd, /enter\s+(?:<code>)?0(?:<\/code>)?\s+if unknown/i);
assert.doesNotMatch(bankAdd, /id="bank_add_opening_value"[^>]*value="0\.00"/);
assert.doesNotMatch(bankAdd, /id="bank_add_set_available"\s+checked/);
assert.doesNotMatch(bankAdd, /id="bank_add_set_min_buffer"\s+checked/);
assert.match(sidebarAdd, /id="bank_add_balance_unknown"/);
assert.match(sidebarAdd, /Opening balance is unknown \/ not available yet/);
assert.doesNotMatch(sidebarAdd, /id="bank_add_set_available"\s+checked/);
assert.doesNotMatch(sidebarAdd, /id="bank_add_set_min_buffer"\s+checked/);
assert.match(help, /Opening balance is unknown \/ not available yet/);
assert.match(help, /A blank opening balance is not saved as \$0/);
assert.match(client, /function createBankAccount\(\)[\s\S]*?openingBalanceUnknown\s*=\s*true/);
assert.doesNotMatch(client, /Enter 0 if unknown/);
assert.match(sidebar, /function createBankAccount\(\)[\s\S]*?openingBalanceUnknown\s*=\s*true/);
assert.match(bankSource, /function resolveBankOpeningBalance_/);
assert.match(bankSource, /confirm the opening balance is unknown/);
assert.match(read('bank_import.js'), /openingBalanceUnknown:\s*true/);

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
  valueAt(row, col) { return this.rows[row - 1]?.[col - 1] ?? ''; }
  formulaAt(row, col) { return this.formulas[row - 1]?.[col - 1] ?? ''; }
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
  insertRowBefore(row) {
    const blank = Array.from({ length: this.width }, () => '');
    this.rows.splice(row - 1, 0, blank.slice());
    this.formulas.splice(row - 1, 0, blank.slice());
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
const earlierMonthIndex = monthIndex === 0 ? null : 0;
const isoDate = year + '-' + String(monthIndex + 1).padStart(2, '0') + '-15';
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  .map((name) => name + '-' + String(year).slice(-2));
const priorMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  .map((name) => name + '-' + String(year - 1).slice(-2));

function historyRow(name, valuesByMonth) {
  const row = [name].concat(Array.from({ length: 12 }, () => '')).concat(['', 'Yes']);
  Object.keys(valuesByMonth).forEach((index) => {
    row[1 + Number(index)] = valuesByMonth[index];
  });
  return row;
}

const checkingValues = { [monthIndex]: 2000 };
if (earlierMonthIndex !== null) checkingValues[earlierMonthIndex] = 1800;
const existingChecking = historyRow('Checking', checkingValues);
const existingSavings = historyRow('Savings', { [monthIndex]: 8000 });
const bankAccounts = new FakeSheet('INPUT - Bank Accounts', [
  ['Year', String(year - 1)],
  ['Account Name'].concat(priorMonths).concat(['Total', 'Active']),
  historyRow('Old Checking', { 0: 900 }),
  ['Total Accounts'],
  ['Year', String(year)],
  ['Account Name'].concat(months).concat(['Total', 'Active']),
  existingChecking,
  existingSavings,
  ['Total Accounts']
]);
const accounts = new FakeSheet('SYS - Accounts', [
  ['Account Name', 'Current Balance', 'Available Now', 'Min Buffer', 'Type', 'Use Policy', 'Priority', 'Active'],
  ['Checking', 2000, 1500, 400, 'Checking', 'USE_FOR_BILLS', 1, 'Yes'],
  ['Savings', 8000, 8000, 1000, 'Savings', 'DO_NOT_TOUCH', 9, 'Yes']
]);
const sheets = {
  'INPUT - Bank Accounts': bankAccounts,
  'SYS - Accounts': accounts
};
const ss = {
  getSheetByName(name) { return sheets[name] || null; }
};

function rowByName(sheet, name) {
  return sheet.rows.find((row) => String(row[0] || '').trim() === name) || null;
}
function snapshotRows(names) {
  return names.map((name) => JSON.stringify(rowByName(bankAccounts, name)));
}
function accountRow(name) {
  return rowByName(accounts, name);
}

const preservedNames = ['Old Checking', 'Savings'];
const preservedBefore = snapshotRows(preservedNames);
const savingsAssetBefore = JSON.stringify(accountRow('Savings'));
const checkingAssetBefore = JSON.stringify(accountRow('Checking'));
const activity = [];
const monthCol = 1 + monthIndex;
const earlierMonthCol = earlierMonthIndex === null ? null : 1 + earlierMonthIndex;

const context = {
  console,
  SpreadsheetApp: { flush() {}, CopyPasteType: { PASTE_FORMAT: 'PASTE_FORMAT' } },
  LockService: { getUserLock() { return null; } },
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
  }
};
vm.createContext(context);
vm.runInContext(read('planner_helpers.js'), context, { filename: 'planner_helpers.js' });
vm.runInContext(bankSource, context, { filename: 'bank_accounts.js' });

context.getUserSpreadsheet_ = () => ss;
context.getSheet_ = (spreadsheet, key) => {
  const names = { BANK_ACCOUNTS: 'INPUT - Bank Accounts', ACCOUNTS: 'SYS - Accounts' };
  const sheet = spreadsheet.getSheetByName(names[key] || key);
  if (!sheet) throw new Error('Missing sheet: ' + key);
  return sheet;
};
context.ensureSysAccountsSheet_ = () => accounts;
context.fitContentColumnsToContents_ = () => {};
context.touchDashboardSourceUpdated_ = () => {};
context.startPerformanceTrace_ = () => null;
context.markPerformanceTrace_ = () => {};
context.finishPerformanceTrace_ = () => null;
context.appendActivityLog_ = (_ss, payload) => {
  activity.push(payload);
  return true;
};

const blankBeforeHistory = JSON.stringify(rowByName(bankAccounts, 'Checking'));
assert.throws(() => context.updateBankAccountValueByDate({
  accountName: 'Checking',
  balanceDate: isoDate
}), /actually at zero/);
assert.throws(() => context.updateBankAccountValueByDate({
  accountName: 'Checking',
  balanceDate: isoDate,
  currentValue: ''
}), /actually at zero/);
assert.equal(JSON.stringify(rowByName(bankAccounts, 'Checking')), blankBeforeHistory,
  'a blank monthly balance must not invent $0 or rewrite history');
assert.equal(JSON.stringify(accountRow('Checking')), checkingAssetBefore,
  'a blank monthly balance must not rewrite SYS Available Now or Min Buffer');

context.updateBankAccountValueByDate({
  accountName: 'Checking',
  balanceDate: isoDate,
  currentValue: 2200,
  updateAvailableNow: false,
  updateMinBuffer: false
});
assert.equal(rowByName(bankAccounts, 'Checking')[monthCol], 2200);
if (earlierMonthCol !== null) {
  assert.equal(rowByName(bankAccounts, 'Checking')[earlierMonthCol], 1800,
    'a selected-month save must not rewrite other months');
}
assert.equal(accountRow('Checking')[1], 2200, 'SYS Current Balance follows the latest current-year month');
assert.equal(accountRow('Checking')[2], 1500,
  'a balance-only update must leave Available Now unchanged');
assert.equal(accountRow('Checking')[3], 400,
  'a balance-only update must leave Min Buffer unchanged');
assert.equal(accountRow('Checking')[4], 'Checking');
assert.equal(accountRow('Checking')[5], 'USE_FOR_BILLS');
assert.equal(accountRow('Checking')[6], 1);
assert.deepEqual(snapshotRows(['Old Checking']), [preservedBefore[0]],
  'a current-month save must preserve prior-year history');
assert.equal(JSON.stringify(accountRow('Savings')), savingsAssetBefore,
  'a Checking save must not rewrite another account\'s SYS settings');
assert.equal(JSON.stringify(rowByName(bankAccounts, 'Savings')), preservedBefore[1],
  'a Checking save must not rewrite another account\'s monthly history');

context.updateBankAccountValueByDate({
  accountName: 'Checking',
  balanceDate: isoDate,
  currentValue: 2200,
  updateAvailableNow: true,
  updateMinBuffer: false
});
assert.equal(rowByName(bankAccounts, 'Checking')[monthCol], 2200);
assert.equal(accountRow('Checking')[2], 2200,
  'an explicit Available Now opt-in copies the monthly balance into Available Now');
assert.equal(accountRow('Checking')[3], 400,
  'an Available Now opt-in must not change Min Buffer');
assert.equal(accountRow('Checking')[5], 'USE_FOR_BILLS');
assert.equal(accountRow('Checking')[6], 1);

context.updateBankAccountValueByDate({
  accountName: 'Checking',
  balanceDate: isoDate,
  currentValue: 2300,
  updateAvailableNow: true,
  updateMinBuffer: false
});
assert.equal(rowByName(bankAccounts, 'Checking')[monthCol], 2300);
assert.equal(accountRow('Checking')[2], 2300);
assert.equal(accountRow('Checking')[3], 400);
if (earlierMonthCol !== null) {
  assert.equal(rowByName(bankAccounts, 'Checking')[earlierMonthCol], 1800);
}

context.updateBankAccountValueByDate({
  accountName: 'Savings',
  balanceDate: isoDate,
  currentValue: 8000,
  updateAvailableNow: false,
  updateMinBuffer: true
});
assert.equal(rowByName(bankAccounts, 'Savings')[monthCol], 8000);
assert.equal(accountRow('Savings')[2], 8000,
  'Min Buffer opt-in must not change Available Now');
assert.equal(accountRow('Savings')[3], 8000);
assert.equal(accountRow('Savings')[5], 'DO_NOT_TOUCH');
assert.equal(accountRow('Savings')[6], 9);

context.updateBankAccountValueByDate({
  accountName: 'Savings',
  balanceDate: isoDate,
  currentValue: 0,
  updateAvailableNow: false,
  updateMinBuffer: false
});
assert.equal(rowByName(bankAccounts, 'Savings')[monthCol], 0,
  'explicit $0 is a valid monthly balance');
assert.equal(accountRow('Savings')[1], 0);
assert.equal(accountRow('Savings')[2], 8000,
  'an explicit $0 balance must not overwrite Available Now');
assert.equal(accountRow('Savings')[3], 8000,
  'an explicit $0 balance must not overwrite Min Buffer');

const latest = context.getLatestBankAccountValuesForYear_(bankAccounts, year);
assert.equal(latest.Checking, 2300);
assert.equal(latest.Savings, 0);

assert.deepEqual(snapshotRows(['Old Checking']), [preservedBefore[0]],
  'updates must preserve existing prior-year house history analog: bank history');
assert.equal(rowByName(bankAccounts, 'Checking')[monthCol], 2300);

context.ensureOnboardingBankAccountsSheetFromDashboard = () => {};
context.writeActiveCellWithRowFormat_ = (sheet, row, col, value) => {
  sheet.getRange(row, col).setValue(value == null ? '' : value);
};

function monthCells(name) {
  const row = rowByName(bankAccounts, name);
  assert.ok(row, name + ' history row must exist');
  return row.slice(1, 13);
}
function assertOnlyMonth(name, index, value) {
  monthCells(name).forEach((cell, i) => {
    assert.equal(cell, i === index ? value : '', name + ' must write only the selected month');
  });
}
const historyBeforeAdd = snapshotRows(['Old Checking', 'Checking', 'Savings']);
const checkingBeforeAdd = JSON.stringify(accountRow('Checking'));
const savingsBeforeAdd = JSON.stringify(accountRow('Savings'));

assert.throws(() => context.addBankAccountFromDashboard({
  accountName: 'Rejected Blank',
  type: 'Checking',
  usePolicy: 'USE_FOR_BILLS',
  openingBalance: '   '
}), /confirm the opening balance is unknown/);
assert.throws(() => context.addBankAccountFromDashboard({
  accountName: 'Rejected Both',
  type: 'Checking',
  usePolicy: 'USE_FOR_BILLS',
  openingBalanceUnknown: true,
  openingBalance: 0,
  setAvailableFromOpening: true,
  setMinBufferFromOpening: true
}), /Clear the opening balance/);
assert.equal(rowByName(bankAccounts, 'Rejected Blank'), null);
assert.equal(rowByName(accounts, 'Rejected Both'), null);
assert.deepEqual(snapshotRows(['Old Checking', 'Checking', 'Savings']), historyBeforeAdd,
  'a rejected Add new must not rewrite existing history');

context.addBankAccountFromDashboard({
  accountName: 'Zero Cash',
  type: 'Checking',
  usePolicy: 'USE_FOR_BILLS',
  openingBalance: 0
});
assertOnlyMonth('Zero Cash', monthIndex, 0);
assert.equal(accountRow('Zero Cash')[1], 0, 'explicit $0 is current-month SYS evidence');
assert.equal(accountRow('Zero Cash')[2], '', 'Available Now stays unset by default');
assert.equal(accountRow('Zero Cash')[3], '', 'Min Buffer stays unset by default');

context.addBankAccountFromDashboard({
  accountName: 'Unknown Cash',
  type: 'Savings',
  usePolicy: 'DO_NOT_TOUCH',
  openingBalanceUnknown: true,
  setAvailableFromOpening: true,
  setMinBufferFromOpening: true
});
monthCells('Unknown Cash').forEach((cell) => {
  assert.equal(cell, '', 'unknown opening balance must not write a month, including $0');
});
assert.equal(accountRow('Unknown Cash')[1], '', 'unknown opening balance must not write SYS current balance');
assert.equal(accountRow('Unknown Cash')[2], '', 'unknown opening balance must not write Available Now');
assert.equal(accountRow('Unknown Cash')[3], '', 'unknown opening balance must not write Min Buffer');

context.addBankAccountFromDashboard({
  accountName: 'Available Opt In',
  type: 'Checking',
  usePolicy: 'USE_FOR_BILLS',
  openingBalance: 400,
  openingBalanceDate: isoDate,
  setAvailableFromOpening: true,
  setMinBufferFromOpening: false
});
assertOnlyMonth('Available Opt In', monthIndex, 400);
assert.equal(accountRow('Available Opt In')[1], 400);
assert.equal(accountRow('Available Opt In')[2], 400, 'Available Now is written only when opted in');
assert.equal(accountRow('Available Opt In')[3], '', 'Available Now opt-in must not set Min Buffer');

context.addBankAccountFromDashboard({
  accountName: 'Buffer Opt In',
  type: 'Savings',
  usePolicy: 'DO_NOT_TOUCH',
  openingBalance: 125,
  openingBalanceDate: isoDate,
  setAvailableFromOpening: false,
  setMinBufferFromOpening: true
});
assertOnlyMonth('Buffer Opt In', monthIndex, 125);
assert.equal(accountRow('Buffer Opt In')[1], 125);
assert.equal(accountRow('Buffer Opt In')[2], '', 'Min Buffer opt-in must not set Available Now');
assert.equal(accountRow('Buffer Opt In')[3], 125);

if (earlierMonthIndex !== null) {
  const earlierDate = year + '-01-10';
  context.addBankAccountFromDashboard({
    accountName: 'Earlier Month',
    type: 'Checking',
    usePolicy: 'USE_FOR_BILLS',
    openingBalance: 55,
    openingBalanceDate: earlierDate
  });
  assertOnlyMonth('Earlier Month', earlierMonthIndex, 55);
  assert.equal(accountRow('Earlier Month')[1], 55, 'SYS current balance follows the selected opening month');
  assert.equal(accountRow('Earlier Month')[2], '');
  assert.equal(accountRow('Earlier Month')[3], '');
}

assert.deepEqual(snapshotRows(['Old Checking', 'Checking', 'Savings']), historyBeforeAdd,
  'Add new must preserve existing account history');
assert.equal(JSON.stringify(accountRow('Checking')), checkingBeforeAdd);
assert.equal(JSON.stringify(accountRow('Savings')), savingsBeforeAdd);

console.log('bank account update regressions passed');
