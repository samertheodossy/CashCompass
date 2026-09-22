import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read = (name) => fs.readFileSync(new URL('../' + name, import.meta.url), 'utf8');
const houseSource = read('house_values.js');
const body = read('Dashboard_Body.html');
const help = read('Dashboard_Help.html');
const client = read('Dashboard_Script_AssetsHouseValues.html');
const styles = read('Dashboard_Styles.html');
const roadmap = read('ROADMAP.md');
const monthlyCheckin = read('monthly_checkin.js');
const monthlyCheckinRead = read('monthly_checkin_read.js');
const planningDebts = read('Dashboard_Script_PlanningDebts.html');

function sliceFn(source, name, nextName) {
  const start = source.indexOf('function ' + name);
  let end = source.length;
  if (nextName) {
    const functionEnd = source.indexOf('function ' + nextName, start + 1);
    end = functionEnd >= 0 ? functionEnd : source.indexOf(nextName, start + 1);
  }
  assert.ok(start >= 0 && end > start, name + ' must exist');
  return source.slice(start, end);
}

const housesPanel = body.slice(body.indexOf('id="houses"'), body.indexOf('id="bank"'));
const manage = body.slice(body.indexOf('id="house_mode_manage_wrap"'), body.indexOf('id="house_status"'));
const houseAdd = body.slice(body.indexOf('id="house_mode_add_wrap"'), body.indexOf('id="house_mode_manage_wrap"'));
const houseUpdate = body.slice(body.indexOf('id="house_mode_update_wrap"'), body.indexOf('id="house_mode_add_wrap"'));
const saveHouse = sliceFn(client, 'saveHouse(', 'createHouse(');
const createHouse = sliceFn(client, 'createHouse(');
const updateWriter = sliceFn(houseSource, 'updateHouseValueByDate(', 'updateHouseValuesHistory_(');
const addLocked = sliceFn(houseSource, 'addHouseFromDashboardLocked_(', 'deactivateHouseFromDashboard(');
const fillDropdown = sliceFn(client, 'fillHouseDropdownFromData_(', 'updateHouseUpdateAvailability_(');
const getHouseUi = sliceFn(houseSource, 'getHouseUiDataForSpreadsheet_(', 'isHouseInactiveActiveValue_(');

assert.doesNotMatch(housesPanel, /Property valuations|house_property_valuations_btn|house_valuation_activity_drawer|openHouseValuationActivityDrawer_/);
assert.doesNotMatch(manage, /Property valuations|house_property_valuations_btn|house_valuation/);
assert.doesNotMatch(body, /id="house_valuation_activity_drawer"|id="house_valuation_source"|id="house_valuation_value"|Source of estimate/);
assert.doesNotMatch(client, /openHouseValuationActivityDrawer_|previewHouseValuationEvidence_|confirmHouseValuationApply_|applyHouseValuationEvidenceFromActivity|houseValuationEvidencePayload_|fillHouseValuationHouseSelect_/);
assert.doesNotMatch(houseSource, /function previewHouseValuationEvidence\(|function applyHouseValuationEvidenceFromActivity\(|valuationSourceOptions|HOUSE_VALUATION_SOURCE_/);
assert.doesNotMatch(styles, /house_valuation_activity_drawer|house-valuation-comparison-table/);
assert.doesNotMatch(help, /Property valuations|Source of estimate|house_valuation/);

assert.match(housesPanel, /id="house_mode_update_btn"[^>]*>Update</);
assert.match(housesPanel, /id="house_mode_add_btn"[^>]*>Add new</);
assert.match(housesPanel, /id="house_mode_manage_btn"[^>]*>Manage houses</);
assert.match(manage, /id="house_show_inactive_btn"/);
assert.match(manage, /Show inactive houses/);
assert.match(manage, /Update a property’s value or stop tracking it while preserving its history and property expense sheet\./);
assert.match(houseUpdate, /Saves this month’s property value only/);
assert.match(houseUpdate, /id="house_update_save_btn"[^>]*onclick="saveHouse\(\)"/);
assert.match(houseAdd, /Current value \(optional\)/);
assert.match(houseAdd, /onclick="createHouse\(\)"/);
assert.match(client, /function stopTrackingHouse\(|stopTrackedEditorItem_/);
assert.match(client, /Reactivate house/);

assert.match(saveHouse, /\.updateHouseValueByDate\(\{/);
assert.match(saveHouse, /house: document\.getElementById\('house_house'\)\.value/);
assert.match(saveHouse, /Enter a value, including \$0\.00 if the property value is actually zero/);
assert.doesNotMatch(saveHouse, /previewHouseValuationEvidence|applyHouseValuationEvidenceFromActivity|sourceLabel/);
assert.match(createHouse, /\.addHouseFromDashboard\(payload\)/);
assert.doesNotMatch(createHouse, /updateHouseValueByDate|previewHouseValuationEvidence|applyHouseValuationEvidenceFromActivity/);
assert.equal(
  (client.match(/\.updateHouseValueByDate\(/g) || []).length,
  1,
  'Dashboard Houses client must have exactly one updateHouseValueByDate call (Update saveHouse)'
);
assert.doesNotMatch(fillDropdown, /google\.script\.run|updateHouseValueByDate|addHouseFromDashboard|deactivateHouse|reactivateHouse/);
assert.doesNotMatch(getHouseUi, /valuationSourceOptions|LOG - Activity|sourceLabel/);

assert.match(updateWriter, /Valuation date must be in /);
assert.match(updateWriter, /A date from another year is not saved as this month/);
assert.match(updateWriter, /Enter a value, including 0\.00 if the property value is actually zero/);
assert.match(updateWriter, /updateHouseValuesHistory_\(house, year, seedDate, currentValue\)/);
assert.doesNotMatch(updateWriter, /applyHouseValuationEvidenceFromActivity|previewHouseValuationEvidence/);
assert.match(houseSource, /function resolveHouseValuesSeedDate_[\s\S]*?return null;/);
assert.doesNotMatch(houseSource, /function resolveHouseValuesSeedDate_[\s\S]*?return stripTime_\(new Date\(\)\);/);
assert.match(houseSource, /if \(!currentParsed\.unknown && seedDate\) \{\s*updateHouseValuesHistory_/);
assert.match(addLocked, /historicalValuation: !!\(valuationDateWasProvided && !seedDate && !currentParsed\.unknown\)/);
assert.doesNotMatch(houseSource, /for \(.*existing.*houses.*rewrite|migrateHouse|rewriteHouseHistory/i);

assert.match(help, /<strong>Update<\/strong> records a confirmed monthly property value/);
assert.match(help, /does not change other months, remaining loan, or expense history/);
assert.match(help, /A date from another year is kept in Activity and does not fill this year’s tracking/);
assert.match(help, /does not save a blank amount as \$0/);

assert.match(roadmap, /Do not start Property valuations/);
assert.match(roadmap, /returns when an external evidence source is implemented/);
assert.match(roadmap, /Houses → Update remains the only manual house-value entry path/);
assert.match(roadmap, /Do not present an empty/);
assert.doesNotMatch(roadmap, /complete: provider-neutral dated house evidence review/);
assert.doesNotMatch(monthlyCheckin, /previewHouseValuationEvidence|applyHouseValuationEvidenceFromActivity/);
assert.doesNotMatch(monthlyCheckinRead, /previewHouseValuationEvidence|applyHouseValuationEvidenceFromActivity/);
assert.doesNotMatch(planningDebts, /previewHouseValuationEvidence|applyHouseValuationEvidenceFromActivity/);

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
const priorIsoDate = (year - 1) + '-06-15';
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  .map((name) => name + '-' + String(year).slice(-2));

function historyRow(name, loan, valuesByMonth) {
  const row = [name, loan].concat(Array.from({ length: 12 }, () => '')).concat(['Yes']);
  Object.keys(valuesByMonth).forEach((index) => {
    row[2 + Number(index)] = valuesByMonth[index];
  });
  return row;
}

const existingHouse = historyRow('Existing Home', 180000, { 0: 500000, [monthIndex]: 520000 });
if (monthIndex === 0) existingHouse[2 + otherMonthIndex] = 500000;
const houseValues = new FakeSheet('INPUT - House Values', [
  ['Year', String(year)],
  ['House', 'Loan Amount Left'].concat(months).concat(['Active']),
  existingHouse,
  historyRow('Zero Home', 0, { [monthIndex]: 0 }),
  historyRow('Unknown Home', '', {}),
  ['Total Values', ''],
  ['House Assets', '']
]);
const houseAssets = new FakeSheet('SYS - House Assets', [
  ['House', 'Type', 'Loan Amount Left', 'Current Value', 'Active'],
  ['Existing Home', 'Primary Residence', 180000, 520000, 'Yes'],
  ['Zero Home', 'Rental', 0, 0, 'Yes'],
  ['Unknown Home', 'Vacation Home', '', '', 'Yes']
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

const monthCol = 2 + monthIndex;
const otherMonthCol = 2 + otherMonthIndex;
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
      if (fmt === 'yyyy-MM-dd') return d.getFullYear() + '-' + month + '-' + day;
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

assert.equal(typeof context.previewHouseValuationEvidence, 'undefined');
assert.equal(typeof context.applyHouseValuationEvidenceFromActivity, 'undefined');

context.getUserSpreadsheet_ = () => ss;
context.getSheetNames_ = () => ({ HOUSE_VALUES: 'INPUT - House Values', HOUSE_ASSETS: 'SYS - House Assets' });
context.getSheet_ = (spreadsheet, key) => {
  const names = { HOUSE_VALUES: 'INPUT - House Values', HOUSE_ASSETS: 'SYS - House Assets' };
  const sheet = spreadsheet.getSheetByName(names[key] || key);
  if (!sheet) throw new Error('Missing sheet: ' + key);
  return sheet;
};
context.fitContentColumnsToContents_ = () => {};
context.touchDashboardSourceUpdated_ = () => {};
context.refreshBlockSumAggregates_ = () => {};
context.appendActivityLog_ = (_ss, payload) => {
  activity.push(payload);
  return true;
};

function snapshotExisting() {
  return {
    existing: JSON.stringify(rowByName(houseValues, 'Existing Home')),
    existingAsset: JSON.stringify(rowByName(houseAssets, 'Existing Home')),
    unknown: JSON.stringify(rowByName(houseValues, 'Unknown Home')),
    unknownAsset: JSON.stringify(rowByName(houseAssets, 'Unknown Home')),
    zero: JSON.stringify(rowByName(houseValues, 'Zero Home')),
    zeroAsset: JSON.stringify(rowByName(houseAssets, 'Zero Home'))
  };
}

const beforeBlank = snapshotExisting();
assert.throws(() => context.updateHouseValueByDate({
  house: 'Existing Home',
  valuationDate: isoDate
}), /actually zero/);
assert.deepEqual(snapshotExisting(), beforeBlank, 'blank Update must not rewrite house rows');

const beforePriorYear = snapshotExisting();
assert.throws(() => context.updateHouseValueByDate({
  house: 'Existing Home',
  valuationDate: priorIsoDate,
  currentValue: 540000
}), /must be in /);
assert.deepEqual(snapshotExisting(), beforePriorYear,
  'out-of-year Update must not rewrite house history or SYS values');

const otherMonthBefore = rowByName(houseValues, 'Existing Home')[otherMonthCol];
const loanBefore = rowByName(houseValues, 'Existing Home')[1];
const unknownBefore = snapshotExisting().unknown;
context.updateHouseValueByDate({
  house: 'Existing Home',
  valuationDate: isoDate,
  currentValue: 530000
});
assert.equal(rowByName(houseValues, 'Existing Home')[monthCol], 530000);
assert.equal(rowByName(houseValues, 'Existing Home')[otherMonthCol], otherMonthBefore,
  'Update must write only the selected current-year month');
assert.equal(rowByName(houseValues, 'Existing Home')[1], loanBefore,
  'Update must not change remaining loan');
assert.equal(JSON.stringify(rowByName(houseValues, 'Unknown Home')), unknownBefore,
  'Update must not rewrite unrelated houses');
assert.equal(activity.at(-1).eventType, 'house_value_update');
assert.equal(JSON.parse(activity.at(-1).details).newRaw, 530000);

context.updateHouseValueByDate({
  house: 'Zero Home',
  valuationDate: isoDate,
  currentValue: 0
});
assert.equal(rowByName(houseValues, 'Zero Home')[monthCol], 0,
  'explicit $0 remains a valid Update value');
assert.notEqual(rowByName(houseValues, 'Unknown Home')[monthCol], 0,
  'blank/unknown must not be converted to $0');

const uiData = context.getHouseUiDataForSpreadsheet_(ss);
assert.deepEqual(Object.keys(uiData).sort(), [
  'houses',
  'inactiveHouses',
  'managementHouses',
  'propertyTypeOptions'
]);
assert.ok(!Object.prototype.hasOwnProperty.call(uiData, 'valuationSourceOptions'));

console.log('house valuation activity regressions passed');
