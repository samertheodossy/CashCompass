import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const plannerHelpers = fs.readFileSync(new URL('../planner_helpers.js', import.meta.url), 'utf8');
const dashboardData = fs.readFileSync(new URL('../dashboard_data.js', import.meta.url), 'utf8');
const quickAdd = fs.readFileSync(new URL('../quick_add_payment.js', import.meta.url), 'utf8');
const incomeSources = fs.readFileSync(new URL('../income_sources.js', import.meta.url), 'utf8');
const cashflowSetup = fs.readFileSync(new URL('../cashflow_setup.js', import.meta.url), 'utf8');
const incomeClient = fs.readFileSync(new URL('../Dashboard_Script_Income.html', import.meta.url), 'utf8');
const body = fs.readFileSync(new URL('../Dashboard_Body.html', import.meta.url), 'utf8');

function sliceFunction(source, name) {
  const start = source.indexOf(`function ${name}`);
  assert.ok(start >= 0, `${name} is missing`);
  const end = source.indexOf('\nfunction ', start + 1);
  return source.slice(start, end < 0 ? source.length : end);
}

function sliceFrom(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  assert.ok(start >= 0, `missing ${startMarker}`);
  const end = endMarker ? source.indexOf(endMarker, start + startMarker.length) : source.length;
  assert.ok(end > start, `missing end for ${startMarker}`);
  return source.slice(start, end < 0 ? source.length : end);
}

assert.match(plannerHelpers,
  /var CASH_FLOW_MONEY_FORMAT_\s*=\s*'\$#,##0\.00;\[Red\]-\$#,##0\.00'/,
  'Cash Flow money format must keep red-negative currency');
assert.match(plannerHelpers, /function isCashFlowInputSheet_/,
  'Cash Flow sheet guard must exist for restore formatting');
assert.match(plannerHelpers,
  /function cashFlowMoneyFormatLooksCanonical_[\s\S]*?\/\^general\$\/i/,
  'Canonical format check must reject General and accept currency masks');
assert.match(dashboardData,
  /function writeDashboardBillValuePreserveFormat_[\s\S]*?copyNearestAmountFormatInRow_[\s\S]*?applyCashFlowMoneyFormat_\(cell\)[\s\S]*?applyCashFlowRowTypeFontColor_/,
  'AutoPay value writer must copy a sibling month format then finish with canonical Cash Flow money format');
assert.doesNotMatch(dashboardData,
  /function writeDashboardBillValuePreserveFormat_[\s\S]*?const numberFormat = cell\.getNumberFormat\(\)[\s\S]*?cell\.setValue\(value\)[\s\S]*?setNumberFormat\(numberFormat\)/,
  'AutoPay must not restore a blank cell General format after writing the amount');
assert.match(dashboardData,
  /function writeVerifiedBillAutopay_[\s\S]*?applyCashFlowMoneyFormat_\(cell\)[\s\S]*?cashFlowMoneyFormatLooksCanonical_/,
  'Verified AutoPay writer must apply canonical Cash Flow money format without requiring an exact Sheets format string');
assert.match(quickAdd,
  /addCashFlowMoneyToCellPreserveRowFormat_\(sheet,\s*rowInfo\.row,\s*monthCol,\s*signedAmount,\s*3\)/,
  'Quick Add must use Cash Flow money formatting for month writes');
assert.match(quickAdd,
  /restoreQuickAddPaymentWriteInSpreadsheet_[\s\S]*?isCashFlowInputSheet_\([\s\S]*?applyCashFlowMoneyFormat_\(restoreCell\)/,
  'Quick Add restore must reapply Cash Flow money format');
assert.match(quickAdd,
  /function writeActivityOperationTargetStateInSpreadsheet_[\s\S]*?setCashFlowMoneyCellPreserveRowFormat_/,
  'Quick Add correction restore must use Cash Flow money formatting');
assert.match(incomeSources,
  /setCashFlowMoneyCellPreserveRowFormat_\(sheet,\s*targetRow,\s*monthCol,\s*amountNum,\s*3\)/,
  'Income Cash Flow writer must use Cash Flow money formatting');
assert.doesNotMatch(dashboardData,
  /skipDashboardBill[\s\S]*?setNumberFormat\('\$#,##0\.00;-\$#,##0\.00'\)/,
  'Bill Skip must not fall back to black-negative currency on Cash Flow');
assert.match(dashboardData,
  /skipDashboardBill[\s\S]*?writeCashFlowSkippedMonthZero_\(info\.sheet, info\.row, info\.col\)/,
  'Bill Skip zero write must use the shared skipped-month appearance helper');
assert.match(plannerHelpers,
  /CASH_FLOW_EXPENSE_ZERO_MONEY_FORMAT_\s*=\s*'\$#,##0\.00;\[Red\]-\$#,##0\.00;\[Red\]\$#,##0\.00'/,
  'Skipped expense zeros must use the [Red] zero section so $0.00 matches -$86.98');
assert.match(cashflowSetup,
  /function writeCashFlowSkippedMonthZero_[\s\S]*?applyCashFlowSkippedZeroAppearance_/,
  'Skip writer must apply skipped-zero appearance after writing 0');

class FakeRange {
  constructor(sheet, row, col, numRows = 1, numCols = 1) {
    this.sheet = sheet;
    this.row = row;
    this.col = col;
    this.numRows = numRows;
    this.numCols = numCols;
    this.numberFormat = 'General';
    this.fontColor = '#000000';
    this.fontSize = 10;
    this.fontWeight = 'normal';
    this.fontStyle = 'normal';
    this.fontLine = 'none';
    this.fontFamily = 'Arial';
    this.background = '#ffffff';
    this.horizontalAlignment = 'general';
    this.verticalAlignment = 'bottom';
    this.wrap = false;
  }
  getValue() {
    return this.sheet.values[this.row - 1]?.[this.col - 1] ?? '';
  }
  getDisplayValue() {
    const value = this.getValue();
    return value === '' || value === null || typeof value === 'undefined' ? '' : String(value);
  }
  getDisplayValues() {
    const out = [];
    for (let r = 0; r < this.numRows; r++) {
      const row = [];
      for (let c = 0; c < this.numCols; c++) {
        const cell = this.sheet.values[this.row - 1 + r]?.[this.col - 1 + c];
        row.push(cell === '' || cell === null || typeof cell === 'undefined' ? '' : String(cell));
      }
      out.push(row);
    }
    return out;
  }
  setValue(value) {
    const rr = this.row - 1;
    while (this.sheet.values.length <= rr) this.sheet.values.push([]);
    this.sheet.values[rr][this.col - 1] = value;
    return this;
  }
  getFontColor() { return this.fontColor; }
  getFontSize() { return this.fontSize; }
  getFontWeight() { return this.fontWeight; }
  getFontStyle() { return this.fontStyle; }
  getFontLine() { return this.fontLine; }
  getFontFamily() { return this.fontFamily; }
  getBackground() { return this.background; }
  getNumberFormat() { return this.numberFormat; }
  getHorizontalAlignment() { return this.horizontalAlignment; }
  getVerticalAlignment() { return this.verticalAlignment; }
  getWrap() { return this.wrap; }
  setFontColor(v) { this.fontColor = v; return this; }
  setFontSize(v) { this.fontSize = v; return this; }
  setFontWeight(v) { this.fontWeight = v; return this; }
  setFontStyle(v) { this.fontStyle = v; return this; }
  setFontLine(v) { this.fontLine = v; return this; }
  setFontFamily(v) { this.fontFamily = v; return this; }
  setBackground(v) { this.background = v; return this; }
  setNumberFormat(v) { this.numberFormat = v; return this; }
  setHorizontalAlignment(v) { this.horizontalAlignment = v; return this; }
  setVerticalAlignment(v) { this.verticalAlignment = v; return this; }
  setWrap(v) { this.wrap = v; return this; }
  getValues() {
    const out = [];
    for (let r = 0; r < this.numRows; r++) {
      const row = [];
      for (let c = 0; c < this.numCols; c++) {
        row.push(this.sheet.values[this.row - 1 + r]?.[this.col - 1 + c] ?? '');
      }
      out.push(row);
    }
    return out;
  }
  getFormula() { return ''; }
  clearContent() {
    this.setValue('');
    return this;
  }
  copyTo(destination, copyPasteType) {
    if (copyPasteType !== 'PASTE_FORMAT') return this;
    destination.numberFormat = this.numberFormat;
    destination.fontColor = this.fontColor;
    destination.fontSize = this.fontSize;
    destination.fontWeight = this.fontWeight;
    destination.fontStyle = this.fontStyle;
    destination.fontLine = this.fontLine;
    destination.fontFamily = this.fontFamily;
    destination.background = this.background;
    destination.horizontalAlignment = this.horizontalAlignment;
    destination.verticalAlignment = this.verticalAlignment;
    destination.wrap = this.wrap;
    return this;
  }
}

class FakeSheet {
  constructor(name, values = []) {
    this.name = name;
    this.values = values.map((row) => [...row]);
    this.ranges = new Map();
  }
  getName() { return this.name; }
  getLastColumn() {
    return this.values.reduce((max, row) => Math.max(max, row.length), 0);
  }
  getRange(row, col, numRows, numCols) {
    if (typeof numRows === 'number' && typeof numCols === 'number') {
      return new FakeRange(this, row, col, numRows, numCols);
    }
    const key = `${row}:${col}`;
    if (!this.ranges.has(key)) {
      this.ranges.set(key, new FakeRange(this, row, col));
    }
    return this.ranges.get(key);
  }
}

const ctx = {
  console,
  SpreadsheetApp: { CopyPasteType: { PASTE_FORMAT: 'PASTE_FORMAT' } },
  round2_: (n) => Math.round(Number(n) * 100) / 100,
  toNumber_: (v) => {
    if (v === '' || v === null || v === undefined) return 0;
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  },
  copyNeighborFormatInRow_() { return false; }
};

vm.createContext(ctx);
vm.runInContext([
  "var CASH_FLOW_MONEY_FORMAT_ = '$#,##0.00;[Red]-$#,##0.00';",
  "var CASH_FLOW_EXPENSE_ZERO_MONEY_FORMAT_ = '$#,##0.00;[Red]-$#,##0.00;[Red]$#,##0.00';",
  "var CASH_FLOW_HEALTH_COLOR_NEGATIVE_ = '#cc0000';",
  "var CASH_FLOW_HEALTH_COLOR_POSITIVE_ = '#38761d';",
  sliceFunction(plannerHelpers, 'parseMonthHeader_'),
  sliceFunction(plannerHelpers, 'isCashFlowInputSheet_'),
  sliceFunction(plannerHelpers, 'applyCashFlowMoneyFormat_'),
  sliceFunction(plannerHelpers, 'cashFlowMoneyFormatLooksCanonical_'),
  sliceFunction(plannerHelpers, 'addCashFlowMoneyToCellPreserveRowFormat_'),
  sliceFunction(plannerHelpers, 'setCashFlowMoneyCellPreserveRowFormat_'),
  sliceFunction(cashflowSetup, 'detectCashFlowLayout_'),
  sliceFunction(cashflowSetup, 'applyCashFlowRowTypeFontColor_'),
  sliceFunction(cashflowSetup, 'applyCashFlowSkippedZeroAppearance_'),
  sliceFunction(cashflowSetup, 'writeCashFlowSkippedMonthZero_'),
  sliceFunction(dashboardData, 'copyNearestAmountFormatInRow_'),
  sliceFunction(dashboardData, 'writeDashboardBillValuePreserveFormat_')
].join('\n'), ctx, { filename: 'cash_flow_format_slice.js' });

const sheet = new FakeSheet('INPUT - Cash Flow 2026', [
  ['Type', 'Flow Source', 'Active', 'Payee', 'Jan-26'],
  ['Expense', 'CASH', 'YES', 'Lutfi Allowance', '']
]);
const monthCol = 5;
const row = 2;

ctx.writeDashboardBillValuePreserveFormat_(sheet, row, monthCol, -75);
const autopayCell = sheet.getRange(row, monthCol);
assert.equal(autopayCell.getValue(), -75, 'AutoPay must preserve numeric -75');
assert.equal(autopayCell.getNumberFormat(), '$#,##0.00;[Red]-$#,##0.00',
  'AutoPay must finish with canonical Cash Flow money format');
assert.equal(autopayCell.getFontColor(), '#cc0000',
  'AutoPay expense write must use Expense row font color');

assert.equal(ctx.cashFlowMoneyFormatLooksCanonical_('General'), false);
assert.equal(ctx.cashFlowMoneyFormatLooksCanonical_('$#,##0.00;[Red]-$#,##0.00'), true);
assert.equal(ctx.cashFlowMoneyFormatLooksCanonical_('$#,##0.00;($#,##0.00)'), true);

const lutfiSheet = new FakeSheet('INPUT - Cash Flow 2026', [
  ['Type', 'Flow Source', 'Active', 'Payee', 'Sep-26', 'Oct-26', 'Totals'],
  ['Expense', 'CASH', 'YES', 'Lutfi Allowance', -375, '', -1800]
]);
const sepCell = lutfiSheet.getRange(2, 5);
sepCell.numberFormat = '$#,##0.00;[Red]-$#,##0.00';
sepCell.fontColor = '#cc0000';
const octCell = lutfiSheet.getRange(2, 6);
assert.equal(octCell.getNumberFormat(), 'General', 'October starts as a blank General cell');
ctx.writeDashboardBillValuePreserveFormat_(lutfiSheet, 2, 6, -75);
assert.equal(octCell.getValue(), -75, 'Weekly AutoPay first October week must write numeric -75');
assert.notEqual(octCell.getNumberFormat(), 'General',
  'Weekly AutoPay must not leave October as General -75');
assert.equal(octCell.getNumberFormat(), '$#,##0.00;[Red]-$#,##0.00',
  'Weekly AutoPay must use canonical -$75.00 format copied from September then re-asserted');
assert.equal(octCell.getFontColor(), '#cc0000',
  'Weekly AutoPay expense write must stay red like the rest of the row');

ctx.addCashFlowMoneyToCellPreserveRowFormat_(sheet, row, monthCol, -75, 3);
const accumulatedCell = sheet.getRange(row, monthCol);
assert.equal(accumulatedCell.getValue(), -150, 'Quick Add accumulation must remain numeric');
assert.equal(accumulatedCell.getNumberFormat(), '$#,##0.00;[Red]-$#,##0.00',
  'Quick Add accumulation must keep canonical Cash Flow money format');

const incomeSheet = new FakeSheet('INPUT - Cash Flow 2026', [
  ['Type', 'Flow Source', 'Active', 'Payee', 'Sep-26'],
  ['Income', 'CASH', 'YES', 'Cisco Pay 1', '']
]);
ctx.setCashFlowMoneyCellPreserveRowFormat_(incomeSheet, 2, 5, 5000, 3);
const incomeCell = incomeSheet.getRange(2, 5);
assert.equal(incomeCell.getValue(), 5000, 'Income write must remain numeric');
assert.equal(incomeCell.getNumberFormat(), '$#,##0.00;[Red]-$#,##0.00',
  'Income write must use the same Cash Flow money format mask');

assert.equal(ctx.isCashFlowInputSheet_(sheet), true,
  'Cash Flow input sheet guard must recognize year tabs');
assert.equal(ctx.isCashFlowInputSheet_({ getName() { return 'INPUT - Debts'; } }), false,
  'Cash Flow input sheet guard must not match non-Cash-Flow sheets');

const skipSheet = new FakeSheet('INPUT - Cash Flow 2026', [
  ['Type', 'Flow Source', 'Active', 'Payee',
    'Jan-26', 'Feb-26', 'Mar-26', 'Apr-26', 'May-26', 'Jun-26',
    'Jul-26', 'Aug-26', 'Sep-26', 'Oct-26', 'Totals'],
  ['Expense', 'CASH', 'YES', 'Credit Card - Home Depot Luma',
    0, 0, 0, -86.98, 0, 0, 0, 0, 0, '', -86.98]
]);
const paidCell = skipSheet.getRange(2, 8);
paidCell.numberFormat = '$#,##0.00;[Red]-$#,##0.00';
paidCell.fontColor = '#000000';
const skipCell = skipSheet.getRange(2, 14);
skipCell.numberFormat = 'General';
skipCell.fontColor = '#000000';
ctx.writeCashFlowSkippedMonthZero_(skipSheet, 2, 14);
assert.equal(skipCell.getValue(), 0, 'Skip must stamp a numeric zero');
assert.equal(skipCell.getNumberFormat(), '$#,##0.00;[Red]-$#,##0.00;[Red]$#,##0.00',
  'Skip $0.00 must use the [Red] zero section so it matches -$86.98 on the same expense row');
assert.equal(skipCell.getFontColor(), null,
  'Skip must not leave an explicit font color that paints $0.00 a different red from [Red]');

assert.match(cashflowSetup, /function formatCashFlowIncomeForecastColumns_/);
assert.doesNotMatch(sliceFunction(cashflowSetup, 'formatCashFlowIncomeForecastColumns_'),
  /setValue\(|insertColumn|applyCashFlowSheetStyling_/);
assert.match(sliceFunction(cashflowSetup, 'formatCashFlowIncomeForecastColumns_'),
  /CopyPasteType\.PASTE_FORMAT/);
assert.match(sliceFunction(cashflowSetup, 'formatCashFlowIncomeForecastColumns_'),
  /cashFlowIncomeForecastApplyHeaderContract_/);
assert.match(sliceFunction(cashflowSetup, 'formatCashFlowIncomeForecastColumns_'),
  /inspectCashFlowIncomeForecastFormatting_/);
assert.match(cashflowSetup, /function cashFlowIncomeForecastApplyHeaderContract_[\s\S]*?setFontSize\(contract\.fontSize\)/);
assert.doesNotMatch(sliceFunction(cashflowSetup, 'cashFlowIncomeForecastApplyHeaderContract_'),
  /setNumberFormat/,
  'Format must not set a number format on forecast header cells');
assert.doesNotMatch(sliceFunction(cashflowSetup, 'cashFlowIncomeForecastHeaderContract_'),
  /numberFormat/,
  'header contract must not include number format');
assert.doesNotMatch(sliceFunction(cashflowSetup, 'cashFlowIncomeForecastHeaderMismatches_'),
  /number format/,
  'header inspection must not fail on blank or Automatic number format');
assert.match(cashflowSetup, /function cashFlowIncomeForecastApplyWrap_[\s\S]*?setWrap\(true\)[\s\S]*?setWrapStrategy/);
assert.match(cashflowSetup, /function inspectCashFlowIncomeForecastFormatting_/);
assert.doesNotMatch(sliceFunction(cashflowSetup, 'inspectCashFlowIncomeForecastFormatting_'),
  /setValue\(|setBackground\(|setColumnWidth\(|setNumberFormat\(|copyTo\(|formatCashFlowIncomeForecastColumns_/);
assert.match(sliceFunction(cashflowSetup, 'inspectCashFlowIncomeForecastFormatting_'),
  /cashFlowIncomeForecastHeaderMismatches_/);
assert.match(cashflowSetup, /push_\('minimum width'/);
assert.match(sliceFunction(incomeSources, 'formatIncomeForecastColumnsFromDashboard'),
  /inspectCashFlowIncomeForecastFormatting_\(sheet\)[\s\S]*?needsFormat/);
assert.match(sliceFunction(incomeSources, 'readCashFlowIncomeForecastSchema_'),
  /inspectCashFlowIncomeForecastFormatting_[\s\S]*?needsFormat/);
assert.doesNotMatch(sliceFunction(incomeSources, 'readCashFlowIncomeForecastSchema_'),
  /formatCashFlowIncomeForecastColumns_|setValue\(|setBackground\(|setColumnWidth\(/);
assert.match(sliceFunction(incomeClient, 'renderIncomeForecastSchema_'),
  /schema\.present === true && schema\.needsFormat !== true[\s\S]*?wrap\.style\.display = 'none'/);
assert.match(sliceFunction(incomeClient, 'renderIncomeForecastSchema_'),
  /schema\.present === true[\s\S]*?formatBtn\.style\.display = ''/);
assert.match(sliceFunction(incomeClient, 'confirmFormatIncomeForecastColumns_'),
  /loadIncomeSourcesSection\(\)[\s\S]*?formatIncomeForecastColumnsFromDashboard/);
assert.match(sliceFunction(incomeClient, 'confirmFormatIncomeForecastColumns_'),
  /res\.needsFormat === true[\s\S]*?res\.mismatches/);
assert.match(incomeClient, /function renderIncomeForecastMismatchList_/);
assert.match(body, /id="income_forecast_schema_mismatch_list"/);
assert.match(cashflowSetup, /': actual ' \+ detail\.actual/);
assert.match(cashflowSetup, /', expected ' \+ detail\.expected/);

class ForecastFormatSheet {
  constructor(name, values) {
    this.name = name;
    this.values = values.map((row) => [...row]);
    this.columnWidths = {};
    this.cellMeta = {};
    this.maxRows = 8;
  }
  meta(row, col) {
    const key = `${row}:${col}`;
    if (!this.cellMeta[key]) {
      this.cellMeta[key] = {
        numberFormat: 'General',
        background: '#ffffff',
        fontWeight: 'normal',
        fontSize: 10,
        fontColor: '#000000',
        horizontalAlignment: 'general',
        verticalAlignment: 'bottom',
        wrap: false,
        wrapStrategy: null,
        borderBottom: false
      };
    }
    return this.cellMeta[key];
  }
  getName() { return this.name; }
  getLastColumn() {
    return this.values.reduce((max, row) => Math.max(max, row.length), 0);
  }
  getLastRow() { return this.values.length; }
  getMaxRows() { return this.maxRows; }
  getColumnWidth(col) { return this.columnWidths[col] || 100; }
  setColumnWidth(col, width) { this.columnWidths[col] = width; }
  getRange(row, col, numRows = 1, numCols = 1) {
    return new ForecastFormatRange(this, row, col, numRows, numCols);
  }
}

class ForecastFormatRange {
  constructor(sheet, row, col, numRows, numCols) {
    this.sheet = sheet;
    this.row = row;
    this.col = col;
    this.numRows = numRows;
    this.numCols = numCols;
  }
  eachCell(fn) {
    for (let r = 0; r < this.numRows; r++) {
      for (let c = 0; c < this.numCols; c++) {
        fn(this.sheet.meta(this.row + r, this.col + c), this.row + r, this.col + c);
      }
    }
    return this;
  }
  getDisplayValues() {
    const out = [];
    for (let r = 0; r < this.numRows; r++) {
      const row = [];
      for (let c = 0; c < this.numCols; c++) {
        const cell = this.sheet.values[this.row - 1 + r]?.[this.col - 1 + c];
        row.push(cell === '' || cell === null || typeof cell === 'undefined' ? '' : String(cell));
      }
      out.push(row);
    }
    return out;
  }
  getValues() {
    const out = [];
    for (let r = 0; r < this.numRows; r++) {
      const row = [];
      for (let c = 0; c < this.numCols; c++) {
        row.push(this.sheet.values[this.row - 1 + r]?.[this.col - 1 + c] ?? '');
      }
      out.push(row);
    }
    return out;
  }
  setValue(value) {
    const rr = this.row - 1;
    while (this.sheet.values.length <= rr) this.sheet.values.push([]);
    this.sheet.values[rr][this.col - 1] = value;
    return this;
  }
  clearFormat() {
    return this.eachCell((meta) => {
      meta.numberFormat = 'General';
      meta.background = '#ffffff';
      meta.fontWeight = 'normal';
      meta.fontSize = 10;
      meta.fontColor = '#000000';
      meta.horizontalAlignment = 'general';
      meta.verticalAlignment = 'bottom';
      meta.wrap = false;
      meta.wrapStrategy = null;
      meta.borderBottom = false;
    });
  }
  setNumberFormat(v) { return this.eachCell((meta) => { meta.numberFormat = v; }); }
  setBackground(v) { return this.eachCell((meta) => { meta.background = v; }); }
  setFontWeight(v) { return this.eachCell((meta) => { meta.fontWeight = v; }); }
  setFontSize(v) { return this.eachCell((meta) => { meta.fontSize = v; }); }
  setFontColor(v) { return this.eachCell((meta) => { meta.fontColor = v; }); }
  setHorizontalAlignment(v) { return this.eachCell((meta) => { meta.horizontalAlignment = v; }); }
  setVerticalAlignment(v) { return this.eachCell((meta) => { meta.verticalAlignment = v; }); }
  setWrap(v) {
    return this.eachCell((meta) => {
      meta.wrap = !!v;
      if (v) meta.wrapStrategy = 'WRAP';
    });
  }
  setWrapStrategy(v) { return this.eachCell((meta) => { meta.wrapStrategy = v; }); }
  setBorder(top, left, bottom) {
    if (bottom === true) this.eachCell((meta) => { meta.borderBottom = true; });
    return this;
  }
  copyTo(destination, copyPasteType) {
    if (copyPasteType !== 'PASTE_FORMAT') return this;
    const src = this.sheet.meta(this.row, this.col);
    destination.eachCell((meta) => {
      meta.numberFormat = src.numberFormat;
      meta.background = src.background;
      meta.fontWeight = src.fontWeight;
      meta.fontSize = src.fontSize;
      meta.fontColor = src.fontColor;
      meta.horizontalAlignment = src.horizontalAlignment;
      meta.verticalAlignment = src.verticalAlignment;
      meta.wrap = src.wrap;
      meta.wrapStrategy = src.wrapStrategy;
      meta.borderBottom = src.borderBottom;
    });
    return this;
  }
  getNumberFormat() { return this.sheet.meta(this.row, this.col).numberFormat; }
  getBackground() { return this.sheet.meta(this.row, this.col).background; }
  getFontWeight() { return this.sheet.meta(this.row, this.col).fontWeight; }
  getFontSize() { return this.sheet.meta(this.row, this.col).fontSize; }
  getFontColor() { return this.sheet.meta(this.row, this.col).fontColor; }
  getHorizontalAlignment() { return this.sheet.meta(this.row, this.col).horizontalAlignment; }
  getVerticalAlignment() { return this.sheet.meta(this.row, this.col).verticalAlignment; }
  getWrap() { return this.sheet.meta(this.row, this.col).wrap; }
  getWrapStrategy() { return this.sheet.meta(this.row, this.col).wrapStrategy; }
}

const formatCtx = {
  console,
  SpreadsheetApp: {
    CopyPasteType: { PASTE_FORMAT: 'PASTE_FORMAT' },
    BorderStyle: { SOLID: 'SOLID' },
    WrapStrategy: { WRAP: 'WRAP' },
    flush() {}
  },
  CANON_FONT_HEADER_: 16,
  CASH_FLOW_MONEY_FORMAT_: '$#,##0.00;[Red]-$#,##0.00'
};
vm.createContext(formatCtx);
vm.runInContext([
  sliceFunction(plannerHelpers, 'parseMonthHeader_'),
  sliceFunction(cashflowSetup, 'cashFlowIsSummaryHeader_'),
  sliceFunction(cashflowSetup, 'cashFlowLastSummaryColumnIndex_'),
  sliceFrom(cashflowSetup, 'const CASH_FLOW_CANONICAL_WIDTHS_', '\nconst CASH_FLOW_REQUIRED_HEADERS_'),
  sliceFunction(cashflowSetup, 'cashFlowIncomeForecastColumnIndexes_'),
  sliceFunction(cashflowSetup, 'cashFlowIncomeForecastMoneyFormat_'),
  sliceFunction(cashflowSetup, 'cashFlowIncomeForecastHeaderFontSize_'),
  sliceFrom(cashflowSetup, 'var CASH_FLOW_INCOME_FORECAST_HEADERS_', '\nfunction cashFlowIncomeForecastHeadersToAppend_'),
  sliceFrom(cashflowSetup, 'var CASH_FLOW_INCOME_FORECAST_HEADER_FILL_', '\nfunction ensureCashFlowIncomeForecastSchema_')
].join('\n'), formatCtx, { filename: 'cash_flow_forecast_format_slice.js' });

const forecastHeaders = [
  'Type', 'Flow Source', 'Payee', 'Active',
  'Jan-26', 'Feb-26', 'Mar-26', 'Apr-26', 'May-26', 'Jun-26',
  'Jul-26', 'Aug-26', 'Sep-26', 'Oct-26', 'Nov-26', 'Dec-26',
  'Totals', 'Yearly Total', 'Recurring', 'Frequency', 'Expected Amount'
];
const forecastRow = [
  'Income', 'CASH', 'Cisco Pay 1', 'YES',
  3187.42, 0, 3187.42, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  '=SUM(E2:P2)', '=Q2', 'Yes', 'Biweekly', 3200
];
const forecastSheet = new ForecastFormatSheet('INPUT - Cash Flow 2026', [
  forecastHeaders,
  forecastRow
]);
const totalsCol = forecastHeaders.indexOf('Totals') + 1;
const janCol = forecastHeaders.indexOf('Jan-26') + 1;
const recurringCol = forecastHeaders.indexOf('Recurring') + 1;
const frequencyCol = forecastHeaders.indexOf('Frequency') + 1;
const expectedCol = forecastHeaders.indexOf('Expected Amount') + 1;
const yearlyCol = forecastHeaders.indexOf('Yearly Total') + 1;
[totalsCol, yearlyCol].forEach(function(col) {
  forecastSheet.getRange(1, col)
    .setBackground('#ffe599')
    .setFontWeight('bold')
    .setFontSize(20)
    .setFontColor('#000000')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');
  forecastSheet.meta(1, col).borderBottom = true;
});
forecastSheet.getRange(2, janCol).setNumberFormat('$#,##0.00;[Red]-$#,##0.00');
forecastSheet.getRange(2, yearlyCol).setNumberFormat('General');
forecastSheet.setColumnWidth(janCol, 100);
forecastSheet.setColumnWidth(totalsCol, 120);
forecastSheet.setColumnWidth(recurringCol, 40);
forecastSheet.setColumnWidth(frequencyCol, 40);
forecastSheet.setColumnWidth(expectedCol, 40);
const valuesBefore = JSON.stringify(forecastSheet.values);

const mismatchedBeforeFormat = formatCtx.inspectCashFlowIncomeForecastFormatting_(forecastSheet);
assert.equal(mismatchedBeforeFormat.needsFormat, true,
  'mismatched forecast headers must keep the Format card visible');
const beforeLines = Array.from(mismatchedBeforeFormat.mismatches || []);
assert.ok(beforeLines.some((line) => String(line).indexOf('Recurring fill:') === 0),
  'status must name the failing fill property with actual and expected values');
assert.ok(beforeLines.some((line) => String(line).indexOf('Recurring wrap:') === 0),
  'status must name the failing wrap property with actual and expected values');
assert.ok(beforeLines.some((line) => String(line).indexOf('Recurring minimum width:') === 0),
  'status must name the failing minimum width property with actual and expected values');
assert.ok(beforeLines.some((line) => /actual .+expected /.test(String(line))),
  'status must include actual and expected values');
assert.equal(JSON.stringify(forecastSheet.values), valuesBefore,
  'format-status inspection must not change values or formulas');

const formatResult = formatCtx.formatCashFlowIncomeForecastColumns_(forecastSheet);
assert.equal(formatResult.formatted, true);
assert.equal(formatResult.added, false);
assert.deepEqual(Array.from(formatResult.columns), ['Recurring', 'Frequency', 'Expected Amount']);
assert.equal(JSON.stringify(forecastSheet.values), valuesBefore,
  'formatting already-present columns must not change values or formulas');
assert.equal(forecastSheet.values[1][4], 3187.42);
assert.equal(forecastSheet.values[1][5], 0);
assert.equal(forecastSheet.values[1][16], '=SUM(E2:P2)');
assert.equal(forecastSheet.values[1][17], '=Q2');
assert.equal(forecastSheet.values[1][18], 'Yes');
assert.equal(forecastSheet.values[1][20], 3200);
assert.equal(forecastSheet.getLastColumn(), forecastHeaders.length,
  'format must not add columns');

const recurringHeader = forecastSheet.getRange(1, recurringCol);
assert.equal(recurringHeader.getBackground(), '#ffe599');
assert.equal(recurringHeader.getFontWeight(), 'bold');
const sourceHeaderSize = forecastSheet.getRange(1, yearlyCol).getFontSize();
assert.equal(sourceHeaderSize, 20);
assert.equal(recurringHeader.getFontSize(), sourceHeaderSize,
  'forecast headers must copy the Totals / Yearly Total font size exactly');
assert.equal(forecastSheet.getRange(1, frequencyCol).getFontSize(), sourceHeaderSize);
assert.equal(forecastSheet.getRange(1, expectedCol).getFontSize(), sourceHeaderSize);
assert.equal(forecastSheet.getRange(1, totalsCol).getFontSize(), sourceHeaderSize);
assert.equal(recurringHeader.getFontColor(), '#000000');
assert.equal(recurringHeader.getHorizontalAlignment(), 'center');
assert.equal(recurringHeader.getVerticalAlignment(), 'middle');
assert.equal(recurringHeader.getWrap(), true);
assert.notEqual(recurringHeader.getNumberFormat(), '@STRING@',
  'Format must not set @STRING@ on Recurring header cells');
assert.notEqual(forecastSheet.getRange(1, frequencyCol).getNumberFormat(), '@STRING@',
  'Format must not set @STRING@ on Frequency header cells');
assert.notEqual(forecastSheet.getRange(1, expectedCol).getNumberFormat(), '@STRING@',
  'Format must not set @STRING@ on Expected Amount header cells');
assert.equal(forecastSheet.getRange(1, frequencyCol).getBackground(), '#ffe599');
assert.equal(forecastSheet.getRange(1, expectedCol).getWrap(), true);
assert.equal(forecastSheet.getColumnWidth(recurringCol), 150);
assert.equal(forecastSheet.getColumnWidth(frequencyCol), 170);
assert.equal(forecastSheet.getColumnWidth(expectedCol), 200);
assert.equal(forecastSheet.getColumnWidth(janCol), 100,
  'month column widths must stay unchanged');
assert.equal(forecastSheet.getRange(2, janCol).getNumberFormat(), '$#,##0.00;[Red]-$#,##0.00',
  'month number formats must stay unchanged');
assert.equal(forecastSheet.getRange(2, recurringCol).getNumberFormat(), '@STRING@');
assert.equal(forecastSheet.getRange(2, frequencyCol).getNumberFormat(), '@STRING@');
assert.equal(forecastSheet.getRange(2, expectedCol).getNumberFormat(), '$#,##0.00;[Red]-$#,##0.00');
assert.equal(forecastSheet.getRange(1, totalsCol).getBackground(), '#ffe599');
assert.equal(forecastSheet.getRange(1, janCol).getBackground(), '#ffffff',
  'month headers must not be restyled');

const formattedStatus = formatCtx.inspectCashFlowIncomeForecastFormatting_(forecastSheet);
assert.equal(formatResult.needsFormat, false,
  'the formatter’s returned status must report no mismatch');
assert.equal(formattedStatus.needsFormat, false,
  'the actual status inspector after the real formatter must report no mismatch');
assert.equal((formattedStatus.mismatches || []).length, 0,
  'after Format, no column property should remain mismatched');
assert.equal((formattedStatus.mismatchDetails || []).length, 0,
  'after Format, mismatch details must be empty');
assert.equal(JSON.stringify(forecastSheet.values), valuesBefore,
  'hiding the Format card must not rewrite values or formulas');
assert.equal(formatResult.mismatches && formatResult.mismatches.length, 0,
  'Format must leave the shared contract with no remaining mismatches');

forecastSheet.getRange(1, recurringCol).setBackground('#ffe599ff');
assert.equal(formatCtx.inspectCashFlowIncomeForecastFormatting_(forecastSheet).needsFormat, false,
  '8-digit Sheets fill #ffe599ff must normalize to the same contract fill Format wrote');
forecastSheet.getRange(1, recurringCol).setBackground('#ffe599');

forecastSheet.getRange(1, recurringCol).setWrap(false);
forecastSheet.getRange(1, recurringCol).setWrapStrategy('WRAP');
assert.equal(forecastSheet.getRange(1, recurringCol).getWrap(), false);
assert.equal(
  formatCtx.inspectCashFlowIncomeForecastFormatting_(forecastSheet).needsFormat,
  false,
  'wrap strategy WRAP must satisfy the same wrap contract Format applies'
);
forecastSheet.getRange(1, recurringCol).setWrap(true);

forecastSheet.setColumnWidth(recurringCol, 40);
const narrowWidthStatus = formatCtx.inspectCashFlowIncomeForecastFormatting_(forecastSheet);
assert.equal(narrowWidthStatus.needsFormat, true,
  'minimum width is part of the Format contract and must keep the repair card visible');
assert.ok(Array.from(narrowWidthStatus.mismatches || []).some((line) => String(line).indexOf('Recurring minimum width:') === 0));
assert.equal(forecastSheet.getColumnWidth(recurringCol), 40,
  'format-status inspection must not change column widths');
forecastSheet.setColumnWidth(recurringCol, 150);

const alreadyMatchingSheet = new ForecastFormatSheet('INPUT - Cash Flow 2026', [
  forecastHeaders,
  forecastRow.slice()
]);
[totalsCol, yearlyCol].forEach(function(col) {
  alreadyMatchingSheet.getRange(1, col)
    .setBackground('#ffe599')
    .setFontWeight('bold')
    .setFontSize(20)
    .setFontColor('#000000')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle')
    .setWrap(true);
});
[recurringCol, frequencyCol, expectedCol].forEach(function(col) {
  alreadyMatchingSheet.getRange(1, col)
    .setBackground('#ffe599')
    .setFontWeight('bold')
    .setFontSize(20)
    .setFontColor('#000000')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle')
    .setWrap(true);
});
alreadyMatchingSheet.getRange(1, recurringCol).setNumberFormat('');
alreadyMatchingSheet.getRange(1, frequencyCol).setNumberFormat('General');
alreadyMatchingSheet.getRange(1, expectedCol).setNumberFormat('Automatic');
alreadyMatchingSheet.setColumnWidth(recurringCol, 150);
alreadyMatchingSheet.setColumnWidth(frequencyCol, 170);
alreadyMatchingSheet.setColumnWidth(expectedCol, 200);
alreadyMatchingSheet.getRange(2, janCol).setNumberFormat('$#,##0.00;[Red]-$#,##0.00');
alreadyMatchingSheet.getRange(2, recurringCol).setNumberFormat('@STRING@');
alreadyMatchingSheet.getRange(2, frequencyCol).setNumberFormat('@STRING@');
alreadyMatchingSheet.getRange(2, expectedCol).setNumberFormat('$#,##0.00;[Red]-$#,##0.00');
const alreadyMatchingValues = JSON.stringify(alreadyMatchingSheet.values);
const blankHeaderStatus = formatCtx.inspectCashFlowIncomeForecastFormatting_(alreadyMatchingSheet);
assert.equal(blankHeaderStatus.needsFormat, false,
  'blank/Automatic number format on a text header is valid and must hide the Format card');
assert.equal((blankHeaderStatus.mismatches || []).length, 0,
  'blank/Automatic header number format must not be reported as a mismatch');
assert.equal(alreadyMatchingSheet.getRange(1, recurringCol).getNumberFormat(), '');
assert.equal(alreadyMatchingSheet.getRange(1, frequencyCol).getNumberFormat(), 'General');
assert.equal(alreadyMatchingSheet.getRange(1, expectedCol).getNumberFormat(), 'Automatic');
assert.equal(alreadyMatchingSheet.getRange(2, expectedCol).getNumberFormat(), '$#,##0.00;[Red]-$#,##0.00',
  'body currency formatting for Expected Amount must stay unchanged');
assert.equal(alreadyMatchingSheet.getRange(2, recurringCol).getNumberFormat(), '@STRING@');
assert.equal(alreadyMatchingSheet.getRange(2, frequencyCol).getNumberFormat(), '@STRING@');
assert.equal(alreadyMatchingSheet.getRange(2, janCol).getNumberFormat(), '$#,##0.00;[Red]-$#,##0.00');
assert.equal(JSON.stringify(alreadyMatchingSheet.values), alreadyMatchingValues,
  'inspecting a valid blank/Automatic header format must not rewrite values');

forecastSheet.setColumnWidth(expectedCol, 300);
const secondFormat = formatCtx.formatCashFlowIncomeForecastColumns_(forecastSheet);
assert.equal(secondFormat.formatted, true);
assert.equal(secondFormat.added, false);
assert.equal(JSON.stringify(forecastSheet.values), valuesBefore);
assert.equal(forecastSheet.getColumnWidth(expectedCol), 300,
  'already-readable widths must not shrink');
assert.equal(forecastSheet.getRange(1, recurringCol).getWrap(), true);
assert.equal(forecastSheet.getRange(2, expectedCol).getNumberFormat(), '$#,##0.00;[Red]-$#,##0.00');
assert.equal(formatCtx.inspectCashFlowIncomeForecastFormatting_(forecastSheet).needsFormat, false,
  'a second Format pass must keep the card hidden when headers still match');

forecastSheet.getRange(1, recurringCol).setBackground('#ffffff');
const fillMismatch = formatCtx.inspectCashFlowIncomeForecastFormatting_(forecastSheet);
assert.equal(fillMismatch.needsFormat, true,
  'one mismatched forecast header must show the Format card again');
assert.ok(Array.from(fillMismatch.mismatches || []).some((line) => String(line).indexOf('Recurring fill:') === 0));
assert.equal(JSON.stringify(forecastSheet.values), valuesBefore);
const repaired = formatCtx.formatCashFlowIncomeForecastColumns_(forecastSheet);
assert.equal(repaired.formatted, true);
const repairedStatus = formatCtx.inspectCashFlowIncomeForecastFormatting_(forecastSheet);
assert.equal(repairedStatus.needsFormat, false,
  'after Format succeeds, a fresh status read must report no mismatch');
assert.equal((repairedStatus.mismatches || []).length, 0);
assert.equal(JSON.stringify(forecastSheet.values), valuesBefore,
  'Format must leave values and formulas unchanged');

const brokenCopySheet = new ForecastFormatSheet('INPUT - Cash Flow 2026', [
  forecastHeaders,
  forecastRow.slice()
]);
const originalGetRange = brokenCopySheet.getRange.bind(brokenCopySheet);
brokenCopySheet.getRange = function(row, col, numRows, numCols) {
  const range = originalGetRange(row, col, numRows, numCols);
  range.copyTo = function() { return this; };
  return range;
};
brokenCopySheet.getRange(1, yearlyCol).setFontSize(20).setBackground('#ffe599');
brokenCopySheet.setColumnWidth(recurringCol, 40);
brokenCopySheet.setColumnWidth(frequencyCol, 40);
brokenCopySheet.setColumnWidth(expectedCol, 40);
const brokenValuesBefore = JSON.stringify(brokenCopySheet.values);
const brokenResult = formatCtx.formatCashFlowIncomeForecastColumns_(brokenCopySheet);
assert.equal(brokenResult.formatted, true);
assert.equal(brokenResult.added, false);
assert.equal(JSON.stringify(brokenCopySheet.values), brokenValuesBefore);
assert.equal(brokenCopySheet.getRange(1, recurringCol).getBackground(), '#ffe599',
  'already-present columns must still get the yellow header style if format copy is a no-op');
assert.equal(brokenCopySheet.getRange(1, expectedCol).getWrap(), true);
assert.equal(brokenCopySheet.getRange(1, recurringCol).getFontSize(), 20,
  'font size must still match Yearly Total when format copy is a no-op');
assert.equal(brokenCopySheet.getColumnWidth(expectedCol), 200);
assert.equal(brokenCopySheet.getRange(2, expectedCol).getNumberFormat(), '$#,##0.00;[Red]-$#,##0.00');
assert.equal(brokenCopySheet.getLastColumn(), forecastHeaders.length);

assert.doesNotMatch(cashflowSetup, /CASH_FLOW_EXPECTED_MONTH_HEADERS_|Expected Month/);
assert.doesNotMatch(cashflowSetup, /February Bonus Amount|September Bonus Amount/);
assert.match(cashflowSetup,
  /concat\(CASH_FLOW_INCOME_FORECAST_HEADERS_\);/);

console.log('Cash Flow auto-entry format regressions passed.');
