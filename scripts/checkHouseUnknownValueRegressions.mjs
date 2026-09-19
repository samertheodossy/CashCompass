import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read = (name) => fs.readFileSync(new URL('../' + name, import.meta.url), 'utf8');
const houseSource = read('house_values.js');
const body = read('Dashboard_Body.html');
const help = read('Dashboard_Help.html');
const client = read('Dashboard_Script_AssetsHouseValues.html');
const sidebar = read('PlannerDashboard.html');

const houseAdd = body.slice(body.indexOf('id="house_mode_add_wrap"'), body.indexOf('id="house_mode_manage_wrap"'));
const houseUpdate = body.slice(body.indexOf('id="house_mode_update_wrap"'), body.indexOf('id="house_mode_add_wrap"'));
assert.match(client, /function createHouse\(\)[\s\S]*if \(currentValue !== null\) payload\.currentValue = currentValue/);
assert.doesNotMatch(client, /function createHouse\(\)[\s\S]*Current value is required/);
assert.doesNotMatch(client, /function createHouse\(\)[\s\S]*Loan amount left is required/);
assert.match(client, /function saveHouse\(\)[\s\S]*Enter a value, including \$0\.00 if the property value is actually zero/);
assert.match(houseAdd, /House name \(required\)/);
assert.match(houseAdd, /Property type \(required\)/);
assert.match(houseAdd, /Current value \(optional\)/);
assert.match(houseAdd, /Remaining loan balance \(optional\)/);
assert.doesNotMatch(houseAdd, /Loan amount left/i);
assert.doesNotMatch(houseAdd, /Current value is required/);
assert.match(houseUpdate, /Remaining loan balance/);
assert.match(houseUpdate, /Saves this month’s property value only/);
assert.match(help, /A house created without a current value stays in the list/);
assert.match(help, /does not change other months, remaining loan, or expense history/);
assert.match(sidebar, /Remaining loan balance \(optional\)/);
assert.match(sidebar, /does not fill this year/);
assert.doesNotMatch(sidebar, /still saved in this year/);
assert.match(houseSource, /if \(!currentParsed\.unknown && seedDate\) \{\s*updateHouseValuesHistory_/);
assert.match(houseSource, /function resolveHouseValuesSeedDate_[\s\S]*?return null;/);
assert.doesNotMatch(houseSource, /function resolveHouseValuesSeedDate_[\s\S]*?return stripTime_\(new Date\(\)\);/);
assert.match(houseAdd, /does not fill this year/);
assert.doesNotMatch(houseAdd, /still saved in this year/);
assert.match(help, /does not fill this year/);
assert.doesNotMatch(help, /still recorded in this year/);
assert.match(houseUpdate, /not saved as this month/);
assert.match(houseSource,
  /function updateHouseValueByDate\(payload\)[\s\S]*?changed-column fit[\s\S]*?function addHouseFromDashboardLocked_\(payload\)[\s\S]*?fitContentColumnsToContents_\(\[[\s\S]*?valueCol/);
assert.doesNotMatch(houseSource, /Current value must be greater than 0/);
assert.doesNotMatch(houseSource, /callers pass 0 when unknown/);

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
const otherMonthIndex = monthIndex === 0 ? 2 : 0;
const isoDate = year + '-' + String(monthIndex + 1).padStart(2, '0') + '-15';
const otherIsoDate = year + '-' + String(otherMonthIndex + 1).padStart(2, '0') + '-15';
const priorIsoDate = (year - 1) + '-06-15';
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  .map((name) => name + '-' + String(year).slice(-2));
const priorMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  .map((name) => name + '-' + String(year - 1).slice(-2));

function historyRow(name, loan, valuesByMonth) {
  const row = [name, loan].concat(Array.from({ length: 12 }, () => '')).concat(['Yes']);
  Object.keys(valuesByMonth).forEach((index) => {
    row[2 + Number(index)] = valuesByMonth[index];
  });
  return row;
}

const existingHouse = historyRow('Existing Home', 180000, { 0: 500000, [monthIndex]: 520000 });
const houseValues = new FakeSheet('INPUT - House Values', [
  ['Year', String(year - 1)],
  ['House', 'Loan Amount Left'].concat(priorMonths).concat(['Active']),
  historyRow('Old Home', 90000, { 0: 300000 }),
  ['Total Values', ''],
  ['House Assets', ''],
  ['Year', String(year)],
  ['House', 'Loan Amount Left'].concat(months).concat(['Active']),
  existingHouse,
  ['Total Values', ''],
  ['House Assets', '']
]);
const houseAssets = new FakeSheet('SYS - House Assets', [
  ['House', 'Type', 'Loan Amount Left', 'Current Value', 'Active'],
  ['Existing Home', 'Primary Residence', 180000, 520000, 'Yes']
]);
const sheets = {
  'INPUT - House Values': houseValues,
  'SYS - House Assets': houseAssets
};
const ss = {
  getSheetByName(name) { return sheets[name] || null; },
  insertSheet(name) {
    sheets[name] = new FakeSheet(name, [['Year', String(year)], ['Item', 'Type']]);
    return sheets[name];
  }
};

function rowByName(sheet, name) {
  return sheet.rows.find((row) => String(row[0] || '').trim() === name) || null;
}
function snapshotRows(names) {
  return names.map((name) => JSON.stringify(rowByName(houseValues, name)));
}
function assetRow(name) {
  return rowByName(houseAssets, name);
}

const preservedNames = ['Old Home', 'Existing Home'];
const preservedBefore = snapshotRows(preservedNames);
const existingAssetBefore = JSON.stringify(assetRow('Existing Home'));
const activity = [];

const context = {
  console,
  SpreadsheetApp: { flush() {}, CopyPasteType: { PASTE_FORMAT: 'PASTE_FORMAT' } },
  LockService: { getUserLock() { return null; } },
  Logger: { log() {} },
  Session: { getScriptTimeZone() { return 'America/Los_Angeles'; } },
  CANON_FONT_BODY_: 14,
  CANON_HEADER_YELLOW_: '#ffe599',
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
vm.runInContext(houseSource, context, { filename: 'house_values.js' });
vm.runInContext(read('financial_integrity_canonical.js'), context, { filename: 'financial_integrity_canonical.js' });
vm.runInContext(read('monthly_checkin.js'), context, { filename: 'monthly_checkin.js' });
vm.runInContext(read('monthly_checkin_read.js'), context, { filename: 'monthly_checkin_read.js' });

context.getUserSpreadsheet_ = () => ss;
context.getSheetNames_ = () => ({ HOUSE_VALUES: 'INPUT - House Values', HOUSE_ASSETS: 'SYS - House Assets' });
context.getSheet_ = (spreadsheet, key) => {
  const names = { HOUSE_VALUES: 'INPUT - House Values', HOUSE_ASSETS: 'SYS - House Assets' };
  const sheet = spreadsheet.getSheetByName(names[key] || key);
  if (!sheet) throw new Error('Missing sheet: ' + key);
  return sheet;
};
context.ensureInputHouseValuesSheet_ = () => houseValues;
context.ensureSysHouseAssetsSheet_ = () => houseAssets;
context.applyHouseValuesSheetStyling_ = () => {};
context.applyHouseAssetsSheetStyling_ = () => {};
context.applyHousesExpenseSheetStyling_ = () => {};
context.refreshBlockSumAggregates_ = () => {};
context.fitContentColumnsToContents_ = () => {};
context.touchDashboardSourceUpdated_ = () => {};
context.createHousesExpenseSheet_ = (_ss, houseName) => ({
  sheet: { getName: () => 'HOUSES - ' + houseName },
  created: true,
  templateSheetName: ''
});
context.appendActivityLog_ = (_ss, payload) => {
  activity.push(payload);
  return true;
};

context.addHouseFromDashboard({
  houseName: 'Normal Home',
  propertyType: 'Primary Residence',
  currentValue: 425000,
  loanAmountLeft: 210000,
  valuationDate: isoDate
});
context.addHouseFromDashboard({
  houseName: 'Zero Value Home',
  propertyType: 'Rental',
  currentValue: 0,
  loanAmountLeft: 0,
  valuationDate: isoDate
});
context.addHouseFromDashboard({
  houseName: 'Unknown Value Home',
  propertyType: 'Vacation Home'
});
context.addHouseFromDashboard({
  houseName: 'Unknown Loan Home',
  propertyType: 'Primary Residence',
  currentValue: 310000,
  valuationDate: isoDate
});
context.addHouseFromDashboard({
  houseName: 'Historical Home',
  propertyType: 'Primary Residence',
  currentValue: 275000,
  loanAmountLeft: 90000,
  valuationDate: otherIsoDate
});
context.addHouseFromDashboard({
  houseName: 'Prior Year Home',
  propertyType: 'Primary Residence',
  currentValue: 260000,
  loanAmountLeft: 75000,
  valuationDate: priorIsoDate
});

assert.deepEqual(snapshotRows(preservedNames), preservedBefore,
  'adding houses must not rewrite existing valuation history');
assert.equal(JSON.stringify(assetRow('Existing Home')), existingAssetBefore,
  'adding houses must not rewrite an existing SYS house-asset row');

const monthCol = 2 + monthIndex;
const otherMonthCol = 2 + otherMonthIndex;
assert.equal(rowByName(houseValues, 'Normal Home')[monthCol], 425000);
assert.equal(assetRow('Normal Home')[3], 425000);
assert.equal(assetRow('Normal Home')[2], 210000);
assert.equal(rowByName(houseValues, 'Normal Home')[1], 210000);

assert.equal(rowByName(houseValues, 'Zero Value Home')[monthCol], 0);
assert.equal(assetRow('Zero Value Home')[3], 0);
assert.equal(assetRow('Zero Value Home')[2], 0);

const unknownValue = rowByName(houseValues, 'Unknown Value Home');
assert.ok(unknownValue, 'unknown current value still creates the house');
for (let i = 0; i < 12; i++) {
  assert.equal(unknownValue[2 + i], '', 'unknown current value must not write a monthly value');
}
assert.equal(assetRow('Unknown Value Home')[3], '', 'unknown current value must not write a fake SYS $0');
assert.equal(assetRow('Unknown Value Home')[2], '', 'unknown remaining loan must stay blank');
assert.equal(unknownValue[1], '', 'unknown remaining loan must not write INPUT $0');

assert.equal(rowByName(houseValues, 'Unknown Loan Home')[monthCol], 310000);
assert.equal(rowByName(houseValues, 'Unknown Loan Home')[1], '');
assert.equal(assetRow('Unknown Loan Home')[2], '');
assert.equal(assetRow('Unknown Loan Home')[3], 310000);

assert.equal(rowByName(houseValues, 'Historical Home')[otherMonthCol], 275000);
assert.equal(rowByName(houseValues, 'Historical Home')[monthCol], '',
  'a current-year historical date must not also write today\'s month');
const historicalLog = activity.find((row) => row.payee === 'Historical Home');
assert.equal(JSON.parse(historicalLog.details).valuationDate, otherIsoDate);
assert.equal(JSON.parse(historicalLog.details).seededMonthLabel,
  months[otherMonthIndex]);

const priorYearRow = rowByName(houseValues, 'Prior Year Home');
assert.ok(priorYearRow, 'prior-year valuation still creates the house');
for (let i = 0; i < 12; i++) {
  assert.equal(priorYearRow[2 + i], '',
    'a prior-year valuation must not write a current-year month');
}
assert.equal(priorYearRow[1], 75000, 'prior-year add may still record remaining loan');
assert.equal(assetRow('Prior Year Home')[2], 75000);
assert.equal(assetRow('Prior Year Home')[3], '',
  'a prior-year valuation must not write SYS Current Value as this month');
const priorYearLog = activity.find((row) => row.payee === 'Prior Year Home');
const priorYearDetails = JSON.parse(priorYearLog.details);
assert.equal(priorYearDetails.valuationDate, priorIsoDate);
assert.equal(priorYearDetails.currentValue, 260000);
assert.equal(priorYearDetails.seededMonthLabel, '');
assert.equal(priorYearDetails.historicalValuation, true);
const priorYearPreview = context.getHouseValueForDate('Prior Year Home', priorIsoDate);
assert.equal(priorYearPreview.selectedMonthValue, '',
  'preview must not remap a prior-year date onto a current-year month');

const latest = context.getLatestHouseValuesForYear_(houseValues, year);
assert.equal(latest['Normal Home'], 425000);
assert.equal(latest['Zero Value Home'], 0);
assert.equal(Object.prototype.hasOwnProperty.call(latest, 'Unknown Value Home'), false,
  'Planning latest values must not treat an unknown house value as zero');
assert.equal(latest['Existing Home'], 520000);
assert.equal(Object.prototype.hasOwnProperty.call(latest, 'Prior Year Home'), false,
  'Planning latest values must not treat a prior-year valuation as current-year evidence');

const ledger = context.canonicalReadYearLedger_(houseValues, year, {
  domain: 'properties',
  getBlock: context.getHouseValuesYearBlock_,
  isDataRow(name, sub) { return context.isHouseDataRowName_(name, sub); }
});
const byName = Object.fromEntries(ledger.rows.map((row) => [row.name, row]));
assert.equal(byName['Zero Value Home'].hasCurrentValue, true);
assert.equal(byName['Zero Value Home'].currentValue, 0);
assert.equal(byName['Unknown Value Home'].hasCurrentValue, false);
assert.equal(byName['Prior Year Home'].hasCurrentValue, false);

const balanceDate = new Date(year, monthIndex, 15);
const monthMap = context.monthlyCheckinReadMonthValueMap_(
  houseValues,
  balanceDate,
  context.getHouseValuesYearBlock_,
  (dispRow) => {
    const name = String(dispRow[0] || '').trim();
    const sub = String(dispRow[1] || '').trim();
    if (!context.isHouseDataRowName_(name, sub)) return null;
    return { name: name };
  }
);
function reviewStatus(name) {
  const info = context.monthlyCheckinMonthValueInfo_(monthMap, name, null);
  return context.monthlyCheckinEvaluateMonthValueEvidence_(info);
}
const unknownReview = reviewStatus('Unknown Value Home');
assert.equal(unknownReview.evidenceStatus, 'MISSING');
assert.equal(unknownReview.hasCurrentMonthValue, false);
const zeroReview = reviewStatus('Zero Value Home');
assert.equal(zeroReview.evidenceStatus, 'CURRENT');
assert.equal(zeroReview.currentMonthValue, 0);
const normalReview = reviewStatus('Normal Home');
assert.equal(normalReview.evidenceStatus, 'CURRENT');
assert.equal(normalReview.currentMonthValue, 425000);
const priorYearReview = reviewStatus('Prior Year Home');
assert.equal(priorYearReview.evidenceStatus, 'MISSING',
  'Monthly Review must keep the current month missing until a current-year month is entered');
assert.equal(priorYearReview.hasCurrentMonthValue, false);

const beforeUpdate = JSON.stringify(rowByName(houseValues, 'Historical Home'));
context.updateHouseValueByDate({
  house: 'Historical Home',
  valuationDate: isoDate,
  currentValue: 288000
});
assert.equal(rowByName(houseValues, 'Historical Home')[monthCol], 288000);
assert.equal(rowByName(houseValues, 'Historical Home')[otherMonthCol], 275000,
  'Update must write only the selected month and preserve prior history');
assert.equal(rowByName(houseValues, 'Historical Home')[1], 90000,
  'Update must not change remaining loan');
assert.notEqual(JSON.stringify(rowByName(houseValues, 'Historical Home')), beforeUpdate);
assert.deepEqual(snapshotRows(['Old Home', 'Existing Home']), preservedBefore,
  'Update must not rewrite unrelated houses');

assert.throws(() => context.updateHouseValueByDate({
  house: 'Historical Home',
  valuationDate: isoDate
}), /actually zero/);

const priorYearBeforeUpdate = JSON.stringify(rowByName(houseValues, 'Prior Year Home'));
const priorYearAssetBeforeUpdate = JSON.stringify(assetRow('Prior Year Home'));
assert.throws(() => context.updateHouseValueByDate({
  house: 'Prior Year Home',
  valuationDate: priorIsoDate,
  currentValue: 261000
}), /must be in /);
assert.equal(JSON.stringify(rowByName(houseValues, 'Prior Year Home')), priorYearBeforeUpdate,
  'a prior-year Update must not rewrite current-year month cells');
assert.equal(JSON.stringify(assetRow('Prior Year Home')), priorYearAssetBeforeUpdate,
  'a prior-year Update must not rewrite SYS Current Value');
assert.deepEqual(snapshotRows(['Old Home', 'Existing Home']), preservedBefore,
  'a rejected prior-year Update must not rewrite unrelated houses');

const unknownLog = activity.find((row) => row.payee === 'Unknown Value Home');
assert.equal(JSON.parse(unknownLog.details).currentValueUnknown, true);
assert.equal(JSON.parse(unknownLog.details).currentValue, null);
assert.equal(JSON.parse(unknownLog.details).loanAmountLeftUnknown, true);
const zeroLog = activity.find((row) => row.payee === 'Zero Value Home');
assert.equal(JSON.parse(zeroLog.details).currentValue, 0);
assert.equal(JSON.parse(zeroLog.details).loanAmountLeft, 0);

console.log('house unknown-value regressions passed');
