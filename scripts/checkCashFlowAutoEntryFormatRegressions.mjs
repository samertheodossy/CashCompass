import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const plannerHelpers = fs.readFileSync(new URL('../planner_helpers.js', import.meta.url), 'utf8');
const dashboardData = fs.readFileSync(new URL('../dashboard_data.js', import.meta.url), 'utf8');
const quickAdd = fs.readFileSync(new URL('../quick_add_payment.js', import.meta.url), 'utf8');
const incomeSources = fs.readFileSync(new URL('../income_sources.js', import.meta.url), 'utf8');
const cashflowSetup = fs.readFileSync(new URL('../cashflow_setup.js', import.meta.url), 'utf8');

function sliceFunction(source, name) {
  const start = source.indexOf(`function ${name}`);
  assert.ok(start >= 0, `${name} is missing`);
  const end = source.indexOf('\nfunction ', start + 1);
  return source.slice(start, end < 0 ? source.length : end);
}

assert.match(plannerHelpers,
  /var CASH_FLOW_MONEY_FORMAT_\s*=\s*'\$#,##0\.00;\[Red\]-\$#,##0\.00'/,
  'Cash Flow money format must keep red-negative currency');
assert.match(plannerHelpers, /function isCashFlowInputSheet_/,
  'Cash Flow sheet guard must exist for restore formatting');
assert.match(dashboardData,
  /function writeDashboardBillValuePreserveFormat_[\s\S]*?applyCashFlowMoneyFormat_\(cell\)/,
  'AutoPay value writer must finish with canonical Cash Flow money format');
assert.match(dashboardData,
  /function writeVerifiedBillAutopay_[\s\S]*?applyCashFlowMoneyFormat_\(cell\)/,
  'Verified AutoPay writer must apply canonical Cash Flow money format');
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
  /skipDashboardBill[\s\S]*?applyCashFlowMoneyFormat_\(cell\)[\s\S]*?applyCashFlowRowTypeFontColor_/,
  'Bill Skip zero write must re-apply row Type font color after money format');
assert.match(dashboardData,
  /copyNearestAmountFormatInRow_[\s\S]*?firstMonthCol[\s\S]*?lastMonthCol/,
  'Skip format copy must search month columns only, not Total/metadata');

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
  round2_: (n) => Math.round(Number(n) * 100) / 100,
  toNumber_: (v) => {
    if (v === '' || v === null || v === undefined) return 0;
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  },
  copyNeighborFormatInRow_() { return false; },
  copyNearestAmountFormatInRow_() { return false; }
};

vm.createContext(ctx);
vm.runInContext([
  "var CASH_FLOW_MONEY_FORMAT_ = '$#,##0.00;[Red]-$#,##0.00';",
  "var CASH_FLOW_HEALTH_COLOR_NEGATIVE_ = '#cc0000';",
  "var CASH_FLOW_HEALTH_COLOR_POSITIVE_ = '#38761d';",
  sliceFunction(plannerHelpers, 'parseMonthHeader_'),
  sliceFunction(plannerHelpers, 'isCashFlowInputSheet_'),
  sliceFunction(plannerHelpers, 'applyCashFlowMoneyFormat_'),
  sliceFunction(plannerHelpers, 'addCashFlowMoneyToCellPreserveRowFormat_'),
  sliceFunction(plannerHelpers, 'setCashFlowMoneyCellPreserveRowFormat_'),
  sliceFunction(cashflowSetup, 'detectCashFlowLayout_'),
  sliceFunction(cashflowSetup, 'applyCashFlowRowTypeFontColor_'),
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
  ['Type', 'Flow Source', 'Active', 'Payee', 'Mar-26', 'Apr-26', 'Sep-26', 'Total'],
  ['Expense', 'CREDIT_CARD', 'YES', 'Credit Card - Corporate AMEX', '', '', '', 0]
]);
const skipCell = skipSheet.getRange(2, 7);
skipCell.setValue(0);
ctx.applyCashFlowMoneyFormat_(skipCell);
ctx.applyCashFlowRowTypeFontColor_(skipSheet, 2, 7);
assert.equal(skipCell.getFontColor(), '#cc0000',
  'Skipped expense zero must render with expense-row red font color');

console.log('Cash Flow auto-entry format regressions passed.');
