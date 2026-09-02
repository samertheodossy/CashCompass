import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const plannerHelpers = fs.readFileSync(new URL('../planner_helpers.js', import.meta.url), 'utf8');
const dashboardData = fs.readFileSync(new URL('../dashboard_data.js', import.meta.url), 'utf8');
const quickAdd = fs.readFileSync(new URL('../quick_add_payment.js', import.meta.url), 'utf8');
const incomeSources = fs.readFileSync(new URL('../income_sources.js', import.meta.url), 'utf8');

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

class FakeRange {
  constructor(sheet, row, col) {
    this.sheet = sheet;
    this.row = row;
    this.col = col;
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
  getRange(row, col) {
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
  sliceFunction(plannerHelpers, 'isCashFlowInputSheet_'),
  sliceFunction(plannerHelpers, 'applyCashFlowMoneyFormat_'),
  sliceFunction(plannerHelpers, 'addCashFlowMoneyToCellPreserveRowFormat_'),
  sliceFunction(plannerHelpers, 'setCashFlowMoneyCellPreserveRowFormat_'),
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

console.log('Cash Flow auto-entry format regressions passed.');
