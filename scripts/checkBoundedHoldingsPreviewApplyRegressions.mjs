import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const read = (name) => fs.readFileSync(new URL(name, root), 'utf8');
const fixture = (folder, name) => read(`test/fixtures/${folder}/${name}`);

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} must exist`);
  const brace = source.indexOf('{', start);
  let depth = 0;
  for (let i = brace; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    if (source[i] === '}' && --depth === 0) return source.slice(start, i + 1);
  }
  assert.fail(`${name} must have a complete body`);
}

const utilities = {
  DigestAlgorithm: { SHA_256: 'SHA_256' },
  Charset: { UTF_8: 'UTF_8' },
  getUuid() {
    return '00000000-0000-4000-8000-000000000001';
  },
  formatDate(_date, _tz, pattern) {
    return pattern === 'yyyy-MM-dd HH:mm:ss' ? '2026-09-09 12:00:00' : '2026-09-09';
  },
  computeDigest(_algorithm, value) {
    return [...crypto.createHash('sha256').update(String(value), 'utf8').digest()]
      .map((byte) => (byte > 127 ? byte - 256 : byte));
  }
};

const FINANCIAL_ACCOUNT_HEADERS = [
  'Stable Account Id', 'Domain', 'Display Name', 'Institution', 'Account Type',
  'Account Subtype', 'Owner Id', 'Registration Type', 'Currency', 'Last 4',
  'Active', 'Identity Status', 'Legacy Domain', 'Legacy Key', 'Created At',
  'Updated At'
];

const assetsHeaders = [
  'Account Name', 'Type', 'Current Balance', 'Active', 'Investment Id', 'Planning Purpose'
];

const investmentsHeaders = [
  'Account Name', 'Type', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Active', 'Investment Id'
];

const monthlyHistoryHeaders = ['Account Name', 'Month', 'Value'];

class FakeRange {
  constructor(sheet, row, col, numRows = 1, numCols = 1) {
    this.sheet = sheet; this.row = row; this.col = col;
    this.numRows = numRows; this.numCols = numCols;
    this.failOnWrite = false;
  }
  read() {
    return Array.from({ length: this.numRows }, (_, r) =>
      Array.from({ length: this.numCols }, (_, c) =>
        this.sheet.rows[this.row - 1 + r]?.[this.col - 1 + c] ?? ''));
  }
  getValues() { return this.read(); }
  getDisplayValues() { return this.read().map((row) => row.map((value) => String(value ?? ''))); }
  setValues(values) {
    if (this.failOnWrite) throw new Error('Synthetic write failure');
    values.forEach((row, r) => row.forEach((value, c) => {
      const rr = this.row - 1 + r;
      while (this.sheet.rows.length <= rr) this.sheet.rows.push([]);
      this.sheet.rows[rr][this.col - 1 + c] = value;
    }));
    return this;
  }
  setNumberFormat(format) {
    for (let offset = 0; offset < this.numCols; offset += 1) {
      this.sheet.columnFormats[this.col + offset] = format;
    }
    return this;
  }
  setBackground() { return this; }
  setFontColor() { return this; }
  setFontWeight() { return this; }
  setFontSize() { return this; }
  setHorizontalAlignment() { return this; }
  setVerticalAlignment() { return this; }
  setWrap(wrap) {
    for (let r = 0; r < this.numRows; r += 1) {
      for (let c = 0; c < this.numCols; c += 1) {
        this.sheet.wrapByCell[`${this.row + r}:${this.col + c}`] = !!wrap;
      }
    }
    return this;
  }
  createFilter() {
    this.sheet.createFilter();
    return this;
  }
}

class FakeSheet {
  constructor(name, rows = []) {
    this.name = name;
    this.rows = rows.map((row) => [...row]);
    this.columnFormats = {};
    this.columnWidths = {};
    this.rowHeights = {};
    this.wrapByCell = {};
    this.hiddenColumns = [];
    this.frozenRows = 0;
    this.frozenColumns = 0;
    this.hasFilter = false;
    this.conditionalFormatRules = [];
  }
  getName() { return this.name; }
  getLastRow() { return this.rows.length; }
  getLastColumn() { return Math.max(0, ...this.rows.map((row) => row.length)); }
  getMaxRows() { return Math.max(1000, this.rows.length); }
  getRange(row, col, numRows = 1, numCols = 1) {
    return new FakeRange(this, row, col, numRows, numCols);
  }
  getDataRange() {
    return this.getRange(1, 1, Math.max(1, this.getLastRow()), Math.max(1, this.getLastColumn()));
  }
  appendRow(row) { this.rows.push([...row]); }
  deleteRows(startRow, count) {
    this.rows.splice(startRow - 1, count);
  }
  setFrozenRows(count) { this.frozenRows = count; }
  setFrozenColumns(count) { this.frozenColumns = count; }
  setColumnWidth(col, width) { this.columnWidths[col] = width; }
  getColumnWidth(col) { return this.columnWidths[col] || 100; }
  setRowHeight(row, height) { this.rowHeights[row] = height; }
  setRowHeights(startRow, count, height) {
    for (let i = 0; i < count; i += 1) this.rowHeights[startRow + i] = height;
  }
  hideColumns(col) { this.hiddenColumns.push(col); }
  getFilter() { return this.hasFilter ? { remove: () => { this.hasFilter = false; } } : null; }
  createFilter() { this.hasFilter = true; }
  getConditionalFormatRules() { return this.conditionalFormatRules; }
  setConditionalFormatRules(rules) { this.conditionalFormatRules = rules || []; }
}

class FakeSpreadsheet {
  constructor(sheets = []) {
    this.sheets = new Map(sheets.map((sheet) => [sheet.getName(), sheet]));
  }
  getSheetByName(name) { return this.sheets.get(name) || null; }
  insertSheet(name) {
    const sheet = new FakeSheet(name);
    this.sheets.set(name, sheet);
    return sheet;
  }
  deleteSheet(sheet) { this.sheets.delete(sheet.getName()); }
  getSheets() { return [...this.sheets.values()]; }
}

function cloneSheetRows(sheet) {
  return sheet ? sheet.rows.map((row) => [...row]) : [];
}

function registryRow(row) {
  return [
    row.stableAccountId, row.domain, row.displayName, row.institution, row.accountType,
    row.accountSubtype, row.ownerId, row.registrationType, row.currency, row.last4,
    row.active, row.identityStatus, row.legacyDomain, row.legacyKey, '2026-01-01 00:00:00',
    '2026-01-01 00:00:00'
  ];
}

function buildM1Statement(options = {}) {
  const masked = options.masked || 'XXXX1234';
  const periodStart = options.periodStart || '08/01/2026';
  const periodEnd = options.periodEnd || '08/31/2026';
  const totalValue = options.totalValue || '10000.00';
  const portfolioTotal = options.portfolioTotal || '9505.00';
  const synaMv = options.synaMv || '5765.20';
  const synbMv = options.synbMv || '3308.91';
  const accountLabel = options.accountLabel || 'Synthetic M1 Child Brokerage';
  return `# Synthetic M1 Brokerage Statement PDF text extract — structure only (no real balances)
Statement
Statement period: ${periodStart} to ${periodEnd}
Account number: ${masked}
Account: ${accountLabel}
Type: Margin
Account title: SYNTHETIC OWNER / JTWROS

Account value
Total account value / 1-month change
$${totalValue} / $500.00 [5.26%]

Account breakdown
Description | Last period | Current period | Change
07/31/2026 | 08/31/2026
Cash | $5.00 | $6.92 | $1.92
Equities | $9,000.00 | $9,500.00 | $500.00
Total portfolio | $9,005.00 | $${portfolioTotal} | $500.00

Total portfolio
Symbol | Quantity | Price | Market value | Cost basis | Unrealized P/L
SYNA | 57.65199 | $100.00 | $${synaMv} | $2,000.00 | $3,765.20
SYNB | 165.44571 | $20.00 | $${synbMv} | $3,400.00 | ($91.09)
Total | $${portfolioTotal} | $5,400.00 | $4,105.00

Financial instrument information
Symbol | Share class | Description | Exchange
SYNA | Class A | SYNTHETIC ALPHA INC COM | NASD
SYNB | Class A | SYNTHETIC BETA INC COM NEW | NASD
`;
}

function buildM1MrvlSmciStatement(options = {}) {
  const masked = options.masked || 'XXXX5678';
  const periodStart = options.periodStart || '08/01/2026';
  const periodEnd = options.periodEnd || '08/31/2026';
  const accountLabel = options.accountLabel || 'Synthetic M1 Child Brokerage';
  return `# Synthetic M1 Brokerage Statement PDF text extract — MRVL/SMCI shape
Statement
Statement period: ${periodStart} to ${periodEnd}
Account number: ${masked}
Account: ${accountLabel}
Type: Margin
Account title: SYNTHETIC OWNER

Account value
Total account value
$18377.36

Account breakdown
Cash | $6.92
Total portfolio | $18370.44

Total portfolio
Symbol | Quantity | Price | Market value | Cost basis | Unrealized P/L
MRVL | 100 | $122.0262 | $12202.62 | $10000.00 | $2202.62
SMCI | 50 | $123.3564 | $6167.82 | $5000.00 | $1167.82
Total | $18370.44 | $15000.00 | $3370.44
`;
}

function buildUnifiedHeadersRow() {
  return [
    'Source', 'Provider', 'Parent CashCompass account', 'Child account/partition', 'Investment Id',
    'Source security key', 'Symbol', 'Security name', 'Shares', 'Price', 'Market value',
    'Cost basis', 'Unrealized gain/loss', 'Cash balance', 'As-of date', 'Document fingerprint',
    'Import status', 'Imported at', 'Import run/reference'
  ];
}

function buildSyntheticUnifiedHistoryRows(count, fingerprintPrefix) {
  const rows = [];
  for (let i = 0; i < count; i += 1) {
    rows.push([
      'M1_STATEMENT_PDF', 'M1_GMAIL', 'M1 Account - Gmail', 'LEGACY-PART-' + String(i + 1),
      'INV-M1-GMAIL-1', 'SYMBOL-' + String(i + 1), 'SYM' + String(i + 1),
      'Synthetic security ' + String(i + 1), '1', '10.00', '10.00', '9.00', '1.00', '',
      '2026-07-31', fingerprintPrefix + '-' + String(i + 1), 'APPLIED',
      '2026-08-01 00:00:00', 'BH-LEGACY-' + String(i + 1)
    ]);
  }
  return rows;
}

function loadInvestmentsHelpers(context) {
  const investmentsSource = read('investments.js');
  vm.runInContext(`
    var INVESTMENT_ID_HEADER_ = 'Investment Id';
    var INVESTMENT_PLANNING_PURPOSE_HEADER_ = 'Planning Purpose';
    function round2_(value) { return Math.round(Number(value) * 100) / 100; }
    function toNumber_(value) {
      if (value === null || typeof value === 'undefined' || value === '') return 0;
      var n = Number(String(value).replace(/,/g, ''));
      return isFinite(n) ? n : 0;
    }
    ${extractFunction(investmentsSource, 'getAssetsHeaderMap_')}
  `, context, { filename: 'investments-helpers.js' });
}

function makeWorkbook(options = {}) {
  const assetsRows = options.assetsRows || [
    ['Synthetic E*TRADE Taxable', 'Brokerage', '50000', 'Yes', 'INV-ET-BOUNDED-1', ''],
    ['M1 Account - Gmail', 'Brokerage', '95000', 'Yes', 'INV-M1-GMAIL-1', '']
  ];
  const investmentsRows = options.investmentsRows || [
    investmentsHeaders,
    ['Synthetic E*TRADE Taxable', 'Brokerage', '50000', '', '', '', '', '', '', '', '', '', '', '', 'Yes', 'INV-ET-BOUNDED-1'],
    ['M1 Account - Gmail', 'Brokerage', '95000', '', '', '', '', '', '', '', '', '', '', '', 'Yes', 'INV-M1-GMAIL-1']
  ];
  const monthlyRows = options.monthlyRows || [
    monthlyHistoryHeaders,
    ['Synthetic E*TRADE Taxable', '2026-08', '50000'],
    ['M1 Account - Gmail', '2026-08', '95000']
  ];
  const registryRows = options.registryRows || [
    FINANCIAL_ACCOUNT_HEADERS,
    registryRow({
      stableAccountId: 'STABLE-ET-BOUNDED-1',
      domain: 'INVESTMENT',
      displayName: 'Synthetic E*TRADE Taxable',
      institution: '',
      accountType: 'Brokerage',
      accountSubtype: '',
      ownerId: 'OWNER-1',
      registrationType: 'TAXABLE',
      currency: 'USD',
      last4: '',
      active: 'Yes',
      identityStatus: '',
      legacyDomain: 'SYS_ASSETS',
      legacyKey: 'INV-ET-BOUNDED-1'
    }),
    registryRow({
      stableAccountId: 'STABLE-M1-GMAIL-GROUP',
      domain: 'INVESTMENT',
      displayName: 'M1 Account - Gmail',
      institution: '',
      accountType: 'Brokerage',
      accountSubtype: '',
      ownerId: 'OWNER-1',
      registrationType: 'TAXABLE',
      currency: 'USD',
      last4: '',
      active: 'Yes',
      identityStatus: '',
      legacyDomain: 'SYS_ASSETS',
      legacyKey: 'INV-M1-GMAIL-1'
    })
  ];
  return new FakeSpreadsheet([
    new FakeSheet('SYS - Assets', [assetsHeaders, ...assetsRows]),
    new FakeSheet('INPUT - Investments', investmentsRows),
    new FakeSheet('OUT - History', monthlyRows),
    new FakeSheet('SYS - Financial Accounts', registryRows)
  ]);
}

function buildContext(options = {}) {
  const workbook = options.workbook || makeWorkbook(options);
  const context = {
    Utilities: utilities,
    String, Number, Object, Array, Math, isFinite, Error, JSON, console,
    Session: { getScriptTimeZone: () => 'America/Los_Angeles' },
    SpreadsheetApp: {
      flush() {},
      newConditionalFormatRule() {
        const state = { text: '', background: '', fontColor: '', ranges: [] };
        return {
          whenTextEqualTo(text) { state.text = text; return this; },
          whenTextContains(text) { state.text = text; return this; },
          setBackground(color) { state.background = color; return this; },
          setFontColor(color) { state.fontColor = color; return this; },
          setRanges(ranges) { state.ranges = ranges; return this; },
          build() { return { state, getRanges() { return state.ranges; } }; }
        };
      }
    },
    LockService: {
      getDocumentLock() {
        return {
          waitLock() {},
          releaseLock() {}
        };
      }
    },
    ScriptApp: {
      getService() {
        return { getUrl: () => 'https://script.google.com/macros/s/SYNTHETIC_BOUNDED_DEPLOY/exec' };
      }
    },
    isAdminUser_: () => false,
    isCentralModeEnabled_: () => false,
    isAllowlistedUser_: () => true,
    assertAdmin_: () => {}
  };
  vm.createContext(context);
  vm.runInContext(read('config.js'), context, { filename: 'config.js' });
  vm.runInContext(read('financial_identity.js'), context, { filename: 'financial_identity.js' });
  vm.runInContext(read('monthly_checkin_identity.js'), context, { filename: 'monthly_checkin_identity.js' });
  vm.runInContext(read('investment_portfolio_foundation.js'), context, {
    filename: 'investment_portfolio_foundation.js'
  });
  vm.runInContext(`
    function round2_(value) { return Math.round(Number(value) * 100) / 100; }
    function applySysSheetBaseStyle_() {}
    ${extractFunction(read('investment_activity.js'), 'normalizeInvestmentImportDate_')}
    ${extractFunction(read('investment_activity.js'), 'parseInvestmentImportMoney_')}
    ${extractFunction(read('investment_activity.js'), 'parseInvestmentImportNumber_')}
  `, context, { filename: 'activity-stubs.js' });
  vm.runInContext(read('investment_etrade_csv.js'), context, { filename: 'investment_etrade_csv.js' });
  vm.runInContext(read('investment_etrade_positions_pdf.js'), context, {
    filename: 'investment_etrade_positions_pdf.js'
  });
  vm.runInContext(read('investment_m1_statement_pdf.js'), context, {
    filename: 'investment_m1_statement_pdf.js'
  });
  vm.runInContext(read('investment_adapters.js'), context, { filename: 'investment_adapters.js' });
  vm.runInContext(read('central_holdings_preview_lab.js'), context, {
    filename: 'central_holdings_preview_lab.js'
  });
  loadInvestmentsHelpers(context);
  vm.runInContext(read('bounded_holdings_preview.js'), context, { filename: 'bounded_holdings_preview.js' });
  vm.runInContext(read('bounded_holdings_preview_groups.js'), context, {
    filename: 'bounded_holdings_preview_groups.js'
  });
  vm.runInContext(read('bounded_holdings_preview_identity.js'), context, {
    filename: 'bounded_holdings_preview_identity.js'
  });
  vm.runInContext(read('bounded_holdings_preview_apply_sheet.js'), context, {
    filename: 'bounded_holdings_preview_apply_sheet.js'
  });
  vm.runInContext(read('bounded_holdings_preview_apply_diff.js'), context, {
    filename: 'bounded_holdings_preview_apply_diff.js'
  });
  vm.runInContext(read('bounded_holdings_preview_apply.js'), context, {
    filename: 'bounded_holdings_preview_apply.js'
  });
  context.getUserSpreadsheet_ = () => workbook;
  return { context, workbook };
}

function formatLooksCurrency_(format) {
  const raw = String(format || '').toLowerCase();
  return raw.indexOf('$') >= 0 || raw.indexOf('currency') >= 0 || raw.indexOf('#,##0') >= 0;
}

function formatLooksDate_(format) {
  const raw = String(format || '').toLowerCase();
  return raw.indexOf('yyyy') >= 0 || raw.indexOf('mm/dd') >= 0 || raw.indexOf('dd/mm') >= 0;
}

function displaysAsCurrency_(format) {
  return formatLooksCurrency_(format) && !formatLooksDate_(format);
}

function assertUnifiedCashBalanceFormat_(sheet, label) {
  assert.equal(sheet.columnFormats[BOUNDED_HOLDINGS_UNIFIED_COL_.CASH_BALANCE],
    '$#,##0.00;-$#,##0.00', `${label} cash balance must use currency format`);
  assert.notEqual(sheet.columnFormats[BOUNDED_HOLDINGS_UNIFIED_COL_.CASH_BALANCE], 'yyyy-mm-dd',
    `${label} cash balance must not use date format`);
  assert.equal(displaysAsCurrency_(sheet.columnFormats[BOUNDED_HOLDINGS_UNIFIED_COL_.CASH_BALANCE]), true,
    `${label} cashBalanceFormat.displaysAsCurrency must be true`);
}

const BOUNDED_HOLDINGS_UNIFIED_COL_ = {
  CASH_BALANCE: 14,
  AS_OF_DATE: 15,
  IMPORTED_AT: 18,
  MARKET_VALUE: 11
};
const applySource = read('bounded_holdings_preview_apply.js');
const applySheetSource = read('bounded_holdings_preview_apply_sheet.js');
const boundedHtml = read('BoundedHoldingsPreviewUI.html');
const boundedSource = read('bounded_holdings_preview.js');
const etradeText = fixture('etrade', 'synthetic_etrade_positions_minimal.txt');

assert.match(applySource, /boundedHoldingsPreviewApplyFromDashboard/);
assert.match(applySource, /boundedHoldingsPreviewBuildApplyDiffFromDashboard/);
assert.match(applySource, /boundedHoldingsPreviewApplySanitizeDiffBundleForClient_/);
assert.match(boundedHtml, /boundedHoldingsPreviewBuildGroupedApplyDiffFromDashboard/);
assert.match(applySheetSource, /boundedHoldingsPreviewApplyFormatUnifiedSheet_/);
assert.match(applySheetSource, /boundedHoldingsPreviewApplySetUnifiedColumnWidths_/);
assert.match(applySheetSource, /function adminTouchBoundedHoldingsPreviewUnifiedSheetFormat\(\)/);
assert.match(applySheetSource, /boundedHoldingsPreviewApplyTouchUnifiedSheetFormat_\(ss\)/);
assert.doesNotMatch(applySheetSource, /function adminTouchBoundedHoldingsPreviewUnifiedSheetFormat_\(/);
assert.match(applySheetSource, /assertAdmin_\(\)/);
assert.match(applySheetSource, /setWrap\(false\)/);
assert.doesNotMatch(applySheetSource, /setWrap\(true\)/);
assert.doesNotMatch(applySheetSource, /applySysSheetBaseStyle_/);
assert.doesNotMatch(applySheetSource, /BOUNDED_HOLDINGS_UNIFIED_WRAP_COLUMNS_/);
assert.match(applySheetSource, /CASH_BALANCE:\s*14/);
assert.match(applySheetSource, /AS_OF_DATE:\s*15/);
assert.match(applySheetSource, /IMPORTED_AT:\s*18/);
assert.match(
  applySheetSource,
  /BOUNDED_HOLDINGS_UNIFIED_COL_\.CASH_BALANCE[\s\S]*setNumberFormat\(BOUNDED_HOLDINGS_UNIFIED_CURRENCY_FORMAT_\)/
);
assert.doesNotMatch(applySheetSource, /ensureInvestmentSystemSheet_/);
assert.match(boundedHtml, /Review holdings changes/);
assert.match(boundedHtml, /SYS - Investment Holdings Unified/);
assert.doesNotMatch(boundedSource, /\bsetValues\b|\bappendRow\b/);
assert.doesNotMatch(applySource, /INPUT - Investments|OUT - History|INPUT - Cash Flow/);
assert.doesNotMatch(applySource, /rawDocumentText.*PropertiesService|DriveApp|CacheService/s);

const { context: ctx, workbook } = buildContext();
const unifiedName = ctx.getSheetNames_().INVESTMENT_HOLDINGS_UNIFIED;

const etPayload = {
  pickerValue: 'INV-ET-BOUNDED-1',
  accountName: 'Synthetic E*TRADE Taxable',
  sysAssetsRow: 2,
  source: 'ETRADE_POSITIONS_PDF',
  rawDocumentText: etradeText,
  registrationType: 'TAXABLE',
  explicitAccountMatch: true
};

const preview = ctx.boundedHoldingsPreviewRunFromDashboard(etPayload);
assert.equal(preview.ok, true);
assert.equal(workbook.getSheetByName(unifiedName), null, 'preview must not create unified sheet');

const diffOnly = ctx.boundedHoldingsPreviewBuildApplyDiffFromDashboard(etPayload);
assert.equal(diffOnly.ok, true);
assert.equal(workbook.getSheetByName(unifiedName), null, 'diff build must not create unified sheet');
assert.ok(diffOnly.diffDigest);
assert.ok(diffOnly.diff.summary.createCount > 0);

const applyResult = ctx.boundedHoldingsPreviewApplyFromDashboard({
  ...etPayload,
  diffDigest: diffOnly.diffDigest,
  explicitApplyConfirm: true
});
assert.equal(applyResult.ok, true);
assert.ok(applyResult.importRunRef);
const unified = workbook.getSheetByName(unifiedName);
assert.ok(unified, 'first Apply must create unified sheet');
assert.equal(unified.rows[0].length, 19);
assert.equal(unified.rows[0][0], 'Source');
assert.equal(unified.rows[0][5], 'Source security key');
assert.equal(unified.rows[0][18], 'Import run/reference');
assert.ok(unified.rows.some((row) => row[5] === '__CASH__'), 'cash row must be created');
assert.ok(unified.rows.some((row) => row[5] && row[5] !== '__CASH__'), 'holdings rows must be created');
assertUnifiedCashBalanceFormat_(unified, 'Apply-created unified sheet');
assert.ok(unified.rows.every((row, index) => index === 0 || !String(row.join('')).includes(etradeText.slice(0, 40))),
  'raw PDF text must not be stored');

const investmentsBefore = cloneSheetRows(workbook.getSheetByName('INPUT - Investments'));
const historyBefore = cloneSheetRows(workbook.getSheetByName('OUT - History'));
const duplicateDiff = ctx.boundedHoldingsPreviewBuildApplyDiffFromDashboard(etPayload);
assert.equal(duplicateDiff.ok, true);
assert.equal(duplicateDiff.duplicateNoop, true);
const duplicateApply = ctx.boundedHoldingsPreviewApplyFromDashboard({
  ...etPayload,
  diffDigest: duplicateDiff.diffDigest,
  explicitApplyConfirm: true
});
assert.equal(duplicateApply.ok, true);
assert.equal(duplicateApply.duplicateNoop, true);
assert.deepEqual(cloneSheetRows(workbook.getSheetByName('INPUT - Investments')), investmentsBefore);
assert.deepEqual(cloneSheetRows(workbook.getSheetByName('OUT - History')), historyBefore);

const staleApply = ctx.boundedHoldingsPreviewApplyFromDashboard({
  ...etPayload,
  diffDigest: 'stale-digest',
  explicitApplyConfirm: true
});
assert.equal(staleApply.ok, false);
assert.equal(staleApply.staleDiff, true);

// --- Header mapping + unified sheet formatting ---
const cashRowValues = ctx.boundedHoldingsPreviewApplyRowToSheetValues_({
  source: 'M1_STATEMENT_PDF',
  provider: 'M1_GMAIL',
  parentAccount: 'M1 Account - Gmail',
  childPartition: 'PREVIEW-GROUP-M1_GMAIL-INV-M1-GMAIL-1-C1-abc',
  investmentId: 'INV-M1-GMAIL-1',
  sourceSecurityKey: '__CASH__',
  symbol: 'Cash',
  securityName: 'Cash balance',
  shares: '',
  price: '',
  marketValue: 6.92,
  costBasis: '',
  unrealizedGainLoss: '',
  cashBalance: 6.92,
  asOfDate: '2026-08-31'
}, 'BH-APPLY-TEST', '2026-09-09 12:00:00');
assert.equal(cashRowValues[13], 6.92, 'cash value must map to Cash balance column');
assert.equal(cashRowValues[14], '2026-08-31', 'as-of must map to As-of date column');
assert.equal(cashRowValues[12], '', 'cash row unrealized gain/loss stays blank');

const formatSheet = new FakeSheet(unifiedName, [[
  'Source', 'Provider', 'Parent CashCompass account', 'Child account/partition', 'Investment Id',
  'Source security key', 'Symbol', 'Security name', 'Shares', 'Price', 'Market value',
  'Cost basis', 'Unrealized gain/loss', 'Cash balance', 'As-of date', 'Document fingerprint',
  'Import status', 'Imported at', 'Import run/reference'
], [
  'M1_STATEMENT_PDF', 'M1_GMAIL', 'M1 Account - Gmail', 'PREVIEW-GROUP-1', 'INV-M1-GMAIL-1',
  '__CASH__', 'Cash', 'Cash balance', '', '', 6.92, '', '', 6.92, '2026-08-31', 'FP-1', 'APPLIED',
  '2026-09-09 12:00:00', 'BH-APPLY-TEST'
]]);
const rowsBeforeFormat = formatSheet.rows.map((row) => [...row]);
assert.deepEqual(formatSheet.rows[0], buildUnifiedHeadersRow(), 'unified schema must expose all 19 headers');
assert.equal(formatSheet.rows[0].length, 19, 'unified schema must stay 19 columns wide');
ctx.boundedHoldingsPreviewApplyFormatUnifiedSheet_(formatSheet);
assert.deepEqual(formatSheet.rows, rowsBeforeFormat, 'format helper must not mutate cell values');
assertUnifiedCashBalanceFormat_(formatSheet, 'Format helper');
assert.equal(formatSheet.columnFormats[11], '$#,##0.00;-$#,##0.00');
assert.equal(formatSheet.wrapByCell['1:1'], false, 'header labels must stay single-line');
assert.equal(formatSheet.wrapByCell['2:1'], false, 'Source body values must stay single-line');
assert.equal(formatSheet.rowHeights[1], 32, 'header row must use compact readable height');
assert.equal(formatSheet.rowHeights[2], 22, 'body rows must use controlled height');
assert.equal(formatSheet.columnWidths[1], 165, 'Source width must stay bounded');
assert.equal(formatSheet.columnWidths[17], 118, 'Import status width must fit APPLIED');
assert.equal(formatSheet.columnWidths[16], 168, 'Document fingerprint width must stay bounded');
assert.equal(formatSheet.columnWidths[19], 168, 'Import run/reference width must stay bounded');

const wideFormatSheet = new FakeSheet(unifiedName, [
  buildUnifiedHeadersRow(),
  [
    'M1_STATEMENT_PDF', 'M1_GMAIL', 'M1 Account - Gmail',
    'PREVIEW-GROUP-VERY-LONG-CHILD-PARTITION-IDENTIFIER-1234567890', 'INV-M1-GMAIL-1',
    'SOURCE-SECURITY-KEY-WITH-LONG-TECHNICAL-IDENTIFIER', 'NVDA', 'NVIDIA CORPORATION',
    12.345678, 180.5, 2227.16, 1500, 727.16, '', '2026-08-31',
    'a26a369b'.repeat(8), 'APPLIED', '2026-09-09 12:00:00', 'BH-APPLY-' + 'X'.repeat(120)
  ]
]);
wideFormatSheet.columnWidths[16] = 520;
wideFormatSheet.columnWidths[19] = 640;
const wideRowsBeforeFormat = wideFormatSheet.rows.map((row) => [...row]);
ctx.boundedHoldingsPreviewApplyFormatUnifiedSheet_(wideFormatSheet);
assert.deepEqual(wideFormatSheet.rows, wideRowsBeforeFormat,
  'bounded formatting must not rewrite long source/fingerprint/import-reference values');
assert.equal(wideFormatSheet.columnWidths[16], 168,
  'long document fingerprints must not keep auto-expanded column width');
assert.equal(wideFormatSheet.columnWidths[19], 168,
  'long import references must not keep auto-expanded column width');
assert.equal(wideFormatSheet.wrapByCell['2:16'], false, 'fingerprint body cells must not wrap');
assert.equal(wideFormatSheet.wrapByCell['2:19'], false, 'import reference body cells must not wrap');

const legacyDateFormatSheet = new FakeSheet(unifiedName, [[
  'Source', 'Provider', 'Parent CashCompass account', 'Child account/partition', 'Investment Id',
  'Source security key', 'Symbol', 'Security name', 'Shares', 'Price', 'Market value',
  'Cost basis', 'Unrealized gain/loss', 'Cash balance', 'As-of date', 'Document fingerprint',
  'Import status', 'Imported at', 'Import run/reference'
], [
  'M1_STATEMENT_PDF', 'M1_GMAIL', 'M1 Account - Gmail', 'PREVIEW-GROUP-1', 'INV-M1-GMAIL-1',
  '__CASH__', 'Cash', 'Cash balance', '', '', 6.92, '', '', 6.92, '2026-08-31', 'FP-1', 'APPLIED',
  '2026-09-09 12:00:00', 'BH-APPLY-TEST'
]]);
legacyDateFormatSheet.columnFormats[14] = 'yyyy-mm-dd';
assert.equal(displaysAsCurrency_(legacyDateFormatSheet.columnFormats[14]), false,
  'regression must reproduce legacy date format on cash column');
ctx.boundedHoldingsPreviewApplyFormatUnifiedSheet_(legacyDateFormatSheet);
assertUnifiedCashBalanceFormat_(legacyDateFormatSheet, 'Legacy date-format repair');
assert.equal(formatSheet.columnFormats[12], '$#,##0.00;-$#,##0.00');
assert.equal(formatSheet.columnFormats[13], '$#,##0.00;-$#,##0.00');
assert.equal(formatSheet.columnFormats[15], 'yyyy-mm-dd');
assert.equal(formatSheet.columnFormats[18], 'yyyy-mm-dd hh:mm:ss');
assert.equal(formatSheet.columnFormats[9], '#,##0.000000', 'Shares must use six-decimal numeric formatting');
assert.notEqual(formatSheet.columnFormats[9], '$#,##0.00;-$#,##0.00', 'Shares must not use currency formatting');
assert.equal(formatLooksDate_(formatSheet.columnFormats[15]), true, 'As-of date must use date formatting');
assert.equal(formatSheet.frozenRows, 1);
assert.equal(formatSheet.hasFilter, true);
assert.deepEqual(formatSheet.hiddenColumns.slice().sort((a, b) => a - b), [4, 5, 6, 16, 19]);
assert.ok(formatSheet.conditionalFormatRules.length >= 3, 'import status rules must be present');

// --- Public admin formatting entry point ---
const missingUnifiedWorkbook = makeWorkbook();
const { context: missingUnifiedCtx } = buildContext({ workbook: missingUnifiedWorkbook });
const missingUnifiedResult = missingUnifiedCtx.adminTouchBoundedHoldingsPreviewUnifiedSheetFormat();
assert.equal(missingUnifiedResult.ok, false, 'public wrapper must fail when unified sheet is missing');
assert.equal(missingUnifiedResult.formattingOnly, true);
assert.match(String(missingUnifiedResult.error || ''), /does not exist/i);

const touchWorkbook = makeWorkbook();
const touchUnifiedSheet = touchWorkbook.insertSheet(unifiedName);
touchUnifiedSheet.rows = [
  buildUnifiedHeadersRow(),
  [
    'M1_STATEMENT_PDF', 'M1_GMAIL', 'M1 Account - Gmail', 'PREVIEW-GROUP-1', 'INV-M1-GMAIL-1',
    '__CASH__', 'Cash', 'Cash balance', '', '', 6.92, '', '', 6.92, '2026-08-31', 'FP-1', 'APPLIED',
    '2026-09-09 12:00:00', 'BH-APPLY-TEST'
  ]
];
const touchCtx = buildContext({ workbook: touchWorkbook }).context;
const touchRowsBefore = cloneSheetRows(touchUnifiedSheet);
let touchDelegated = false;
const originalTouchHelper = touchCtx.boundedHoldingsPreviewApplyTouchUnifiedSheetFormat_;
touchCtx.boundedHoldingsPreviewApplyTouchUnifiedSheetFormat_ = function touchSpy(ss) {
  touchDelegated = true;
  return originalTouchHelper.call(this, ss);
};
const touchResult = touchCtx.adminTouchBoundedHoldingsPreviewUnifiedSheetFormat();
assert.equal(touchResult.ok, true, 'public wrapper must succeed when unified sheet exists');
assert.equal(touchResult.formattingOnly, true);
assert.equal(touchResult.sheetName, unifiedName);
assert.equal(touchDelegated, true, 'public wrapper must delegate to private touch helper');
assert.deepEqual(touchUnifiedSheet.rows, touchRowsBefore,
  'public wrapper must not change unified sheet values or rows');
assert.equal(touchUnifiedSheet.frozenRows, 1, 'public wrapper must apply unified formatting');

const investmentsSnapshot = cloneSheetRows(workbook.getSheetByName('INPUT - Investments'));
const groupPayload = {
  pickerValue: 'INV-M1-GMAIL-1',
  accountName: 'M1 Account - Gmail',
  source: 'M1_STATEMENT_PDF',
  registrationType: 'TAXABLE',
  explicitAccountMatch: true,
  sessionChildren: [],
  sessionPreviews: []
};
const child1Text = buildM1Statement({ masked: 'XXXX1001' });
const needsConfirm = ctx.boundedHoldingsPreviewRunGroupedChildFromDashboard({
  ...groupPayload,
  rawDocumentText: child1Text
});
assert.equal(needsConfirm.ok, false);
const child1 = ctx.boundedHoldingsPreviewRunGroupedChildFromDashboard({
  ...groupPayload,
  rawDocumentText: child1Text,
  confirmNewChild: true,
  confirmationToken: needsConfirm.childMatch.confirmationToken
});
assert.equal(child1.ok, true);
assert.ok(child1.sessionPreview.preview);
assert.notEqual(child1.sessionPreview.totalAccountValue, 95000, 'parent aggregate must not become child row total source');

const child2Text = buildM1Statement({ masked: 'XXXX2002', synaMv: '1000.00', synbMv: '500.00' });
const child2Needs = ctx.boundedHoldingsPreviewRunGroupedChildFromDashboard({
  ...groupPayload,
  rawDocumentText: child2Text,
  sessionChildren: child1.sessionChildren,
  sessionPreviews: [child1.sessionPreview]
});
const child2 = ctx.boundedHoldingsPreviewRunGroupedChildFromDashboard({
  ...groupPayload,
  rawDocumentText: child2Text,
  confirmNewChild: true,
  confirmationToken: child2Needs.childMatch.confirmationToken,
  sessionChildren: child1.sessionChildren,
  sessionPreviews: [child1.sessionPreview]
});
assert.equal(child2.ok, true);

const groupedDiff = ctx.boundedHoldingsPreviewBuildGroupedApplyDiffFromDashboard({
  ...groupPayload,
  sessionChildren: child2.sessionChildren,
  sessionApplyItems: [child1.sessionPreview, child2.sessionPreview]
});
assert.equal(groupedDiff.ok, true);
assert.ok(groupedDiff.diff.summary.createCount >= 4, 'grouped diff must include separate child rows');
const childPartitions = new Set(groupedDiff.diff.create.map((row) => row.childPartition));
assert.equal(childPartitions.size, 2, 'multiple M1 children must remain separate');

const groupedApply = ctx.boundedHoldingsPreviewApplyGroupedFromDashboard({
  ...groupPayload,
  sessionChildren: child2.sessionChildren,
  sessionApplyItems: [child1.sessionPreview, child2.sessionPreview],
  diffDigest: groupedDiff.diffDigest,
  explicitApplyConfirm: true
});
assert.equal(groupedApply.ok, true);
assert.ok(groupedApply.created > 0);
assert.ok(unified.rows.every((row, index) => index === 0 || String(row[2]) !== '95000'),
  'parent control total must not be written as child holdings row');

const conflictChild = ctx.boundedHoldingsPreviewBuildGroupedApplyDiffFromDashboard({
  ...groupPayload,
  sessionChildren: child2.sessionChildren,
  sessionApplyItems: [{
    ...child1.sessionPreview,
    documentFingerprint: 'DIFFERENT-FINGERPRINT',
    contentFingerprint: 'DIFFERENT-CONTENT',
    preview: {
      ...child1.sessionPreview.preview,
      totalAccountValue: 123456.78
    }
  }]
});
assert.equal(conflictChild.ok, false);
assert.equal(conflictChild.requiresReview, true);
assert.ok(conflictChild.error, 'conflict diff must expose a client-safe error message');
assert.equal(conflictChild.error, conflictChild.replayMessage);

// --- M1 MRVL/SMCI grouped Apply diff with populated existing unified sheet ---
const mrvlCtx = buildContext({
  workbook: new FakeSpreadsheet([
    new FakeSheet('SYS - Assets', [assetsHeaders, ['M1 Account - Gmail', 'Brokerage', '95000', 'Yes', 'INV-M1-GMAIL-1', '']]),
    new FakeSheet('INPUT - Investments', [
      investmentsHeaders,
      ['M1 Account - Gmail', 'Brokerage', '95000', '', '', '', '', '', '', '', '', '', '', '', 'Yes', 'INV-M1-GMAIL-1']
    ]),
    new FakeSheet('OUT - History', [monthlyHistoryHeaders, ['M1 Account - Gmail', '2026-08', '95000']]),
    new FakeSheet('SYS - Financial Accounts', [
      FINANCIAL_ACCOUNT_HEADERS,
      registryRow({
        stableAccountId: 'STABLE-M1-GMAIL-GROUP',
        domain: 'INVESTMENT',
        displayName: 'M1 Account - Gmail',
        institution: '',
        accountType: 'Brokerage',
        accountSubtype: '',
        ownerId: 'OWNER-1',
        registrationType: 'TAXABLE',
        currency: 'USD',
        last4: '',
        active: 'Yes',
        identityStatus: '',
        legacyDomain: 'SYS_ASSETS',
        legacyKey: 'INV-M1-GMAIL-1'
      })
    ]),
    new FakeSheet(unifiedName, [
      buildUnifiedHeadersRow(),
      ...buildSyntheticUnifiedHistoryRows(40, 'LEGACY-FP')
    ])
  ])
}).context;
const mrvlText = buildM1MrvlSmciStatement();
const mrvlGroupPayload = {
  pickerValue: 'INV-M1-GMAIL-1',
  accountName: 'M1 Account - Gmail',
  source: 'M1_STATEMENT_PDF',
  registrationType: 'TAXABLE',
  explicitAccountMatch: true,
  sessionChildren: [],
  sessionPreviews: []
};
const mrvlNeedsConfirm = mrvlCtx.boundedHoldingsPreviewRunGroupedChildFromDashboard({
  ...mrvlGroupPayload,
  rawDocumentText: mrvlText
});
assert.equal(mrvlNeedsConfirm.ok, false);
const mrvlChild = mrvlCtx.boundedHoldingsPreviewRunGroupedChildFromDashboard({
  ...mrvlGroupPayload,
  rawDocumentText: mrvlText,
  confirmNewChild: true,
  confirmationToken: mrvlNeedsConfirm.childMatch.confirmationToken
});
assert.equal(mrvlChild.ok, true);
assert.equal(mrvlChild.sessionPreview.cashBalance, 6.92);
assert.equal(mrvlChild.sessionPreview.totalAccountValue, 18377.36);
const mrvlSymbols = (mrvlChild.sessionPreview.preview.holdingsRows || []).map((row) => row.symbol);
assert.ok(mrvlSymbols.includes('MRVL'), 'MRVL holding must parse from M1 statement');
assert.ok(mrvlSymbols.includes('SMCI'), 'SMCI holding must parse from M1 statement');
const mrvlGroupedDiff = mrvlCtx.boundedHoldingsPreviewBuildGroupedApplyDiffFromDashboard({
  ...mrvlGroupPayload,
  sessionChildren: mrvlChild.sessionChildren,
  sessionApplyItems: [mrvlChild.sessionPreview]
});
assert.equal(mrvlGroupedDiff.ok, true, mrvlGroupedDiff.error || mrvlGroupedDiff.replayMessage || 'MRVL/SMCI diff must build');
assert.ok(mrvlGroupedDiff.diffDigest);
assert.equal(typeof mrvlGroupedDiff.proposedRows, 'undefined',
  'dashboard diff RPC must not return internal proposedRows');
assert.equal(typeof mrvlGroupedDiff.existingRows, 'undefined',
  'dashboard diff RPC must not return internal existingRows');
assert.ok(mrvlGroupedDiff.diff.summary.createCount >= 3,
  'MRVL/SMCI grouped diff must create cash + two holdings rows');
assert.equal(mrvlGroupedDiff.diff.totals.cash, 6.92);
assert.equal(mrvlGroupedDiff.diff.totals.marketValue, 18377.36);
assert.ok(mrvlGroupedDiff.applyEligible);
assert.ok(
  (mrvlGroupedDiff.replayOutcomes || []).every((item) =>
    !item || typeof item.existingRows === 'undefined'),
  'client replay outcomes must not include existing row payloads'
);
const mrvlGroupedApply = mrvlCtx.boundedHoldingsPreviewApplyGroupedFromDashboard({
  ...mrvlGroupPayload,
  sessionChildren: mrvlChild.sessionChildren,
  sessionApplyItems: [mrvlChild.sessionPreview],
  diffDigest: mrvlGroupedDiff.diffDigest,
  explicitApplyConfirm: true
});
assert.equal(mrvlGroupedApply.ok, true);
const mrvlUnified = mrvlCtx.getUserSpreadsheet_().getSheetByName(unifiedName);
assert.ok(mrvlUnified.rows.some((row) => row[6] === 'MRVL'));
assert.ok(mrvlUnified.rows.some((row) => row[6] === 'SMCI'));
assertUnifiedCashBalanceFormat_(mrvlUnified, 'MRVL/SMCI grouped Apply');

// --- M1 grouped partition document replay: C1(a26) + C2(c79), block C1(c79) re-apply ---
const FP_C1_A26 = 'a26a369b0afcf70158ba1d819c4f7ae415ff54117bfc2e33be3c302785f2af64';
const FP_C2_C79 = 'c79c256ab8d9d92d1112956d9a8d9818c549687e8ee4e8ad23766b6407eebb72';
const C1_PARTITION = 'PREVIEW-GROUP-M1_GMAIL-INV-M1-GMAIL-1-C1-a26a369b0a';
const C2_PARTITION = 'PREVIEW-GROUP-M1_GMAIL-INV-M1-GMAIL-1-C2-c79c256ab8d';
const M1_AS_OF = '2026-08-31';
const IMPORT_REF_BATCH1 = 'BH-APPLY-20260909-173615-a4d9d912';

function unifiedAppliedRow(options = {}) {
  const key = options.sourceSecurityKey;
  const isCash = key === '__CASH__';
  return [
    'M1_STATEMENT_PDF', 'M1_GMAIL', 'M1 Account - Gmail', options.partition, 'INV-M1-GMAIL-1',
    key, options.symbol, options.symbol, isCash ? '' : '1', isCash ? '' : '100.00',
    options.marketValue, '', '', options.cash == null ? '' : options.cash,
    M1_AS_OF, options.fingerprint, options.importStatus || 'APPLIED',
    '2026-09-09 12:00:00', options.importRef
  ];
}

const replayCtx = buildContext({
  workbook: new FakeSpreadsheet([
    new FakeSheet('SYS - Assets', [assetsHeaders, ['M1 Account - Gmail', 'Brokerage', '95000', 'Yes', 'INV-M1-GMAIL-1', '']]),
    new FakeSheet('INPUT - Investments', [
      investmentsHeaders,
      ['M1 Account - Gmail', 'Brokerage', '95000', '', '', '', '', '', '', '', '', '', '', '', 'Yes', 'INV-M1-GMAIL-1']
    ]),
    new FakeSheet('OUT - History', [monthlyHistoryHeaders, ['M1 Account - Gmail', '2026-08', '95000']]),
    new FakeSheet('SYS - Financial Accounts', [
      FINANCIAL_ACCOUNT_HEADERS,
      registryRow({
        stableAccountId: 'STABLE-M1-GMAIL-GROUP',
        domain: 'INVESTMENT',
        displayName: 'M1 Account - Gmail',
        institution: '',
        accountType: 'Brokerage',
        accountSubtype: '',
        ownerId: 'OWNER-1',
        registrationType: 'TAXABLE',
        currency: 'USD',
        last4: '',
        active: 'Yes',
        identityStatus: '',
        legacyDomain: 'SYS_ASSETS',
        legacyKey: 'INV-M1-GMAIL-1'
      })
    ]),
    new FakeSheet(unifiedName, [
      buildUnifiedHeadersRow(),
      unifiedAppliedRow({
        partition: C1_PARTITION, fingerprint: FP_C1_A26, sourceSecurityKey: '__CASH__',
        symbol: 'Cash', marketValue: 6.92, cash: 6.92, importRef: IMPORT_REF_BATCH1
      }),
      unifiedAppliedRow({
        partition: C1_PARTITION, fingerprint: FP_C1_A26, sourceSecurityKey: 'MRVL',
        symbol: 'MRVL', marketValue: 12202.62, importRef: IMPORT_REF_BATCH1
      }),
      unifiedAppliedRow({
        partition: C1_PARTITION, fingerprint: FP_C1_A26, sourceSecurityKey: 'SMCI',
        symbol: 'SMCI', marketValue: 6167.82, importRef: IMPORT_REF_BATCH1
      }),
      unifiedAppliedRow({
        partition: C2_PARTITION, fingerprint: FP_C2_C79, sourceSecurityKey: '__CASH__',
        symbol: 'Cash', marketValue: 0, cash: 0, importRef: IMPORT_REF_BATCH1
      }),
      unifiedAppliedRow({
        partition: C2_PARTITION, fingerprint: FP_C2_C79, sourceSecurityKey: 'NVDA',
        symbol: 'NVDA', marketValue: 92369.91, importRef: IMPORT_REF_BATCH1
      })
    ])
  ])
}).context;

const c1A26Preview = {
  ok: true,
  source: 'M1_STATEMENT_PDF',
  asOf: M1_AS_OF,
  cashBalance: 6.92,
  totalAccountValue: 18377.36,
  holdingsRows: [
    { sourceSecurityKey: 'MRVL', symbol: 'MRVL', quantity: 100, marketValue: 12202.62 },
    { sourceSecurityKey: 'SMCI', symbol: 'SMCI', quantity: 50, marketValue: 6167.82 }
  ]
};
const c2C79Preview = {
  ok: true,
  source: 'M1_STATEMENT_PDF',
  asOf: M1_AS_OF,
  cashBalance: 0,
  totalAccountValue: 92369.91,
  holdingsRows: [
    { sourceSecurityKey: 'NVDA', symbol: 'NVDA', quantity: 1, marketValue: 92369.91 }
  ]
};
const c1A26SessionItem = {
  childPartitionId: C1_PARTITION,
  recognitionLabel: 'Account 1',
  statementPeriodEnd: M1_AS_OF,
  documentFingerprint: FP_C1_A26,
  contentFingerprint: 'CONTENT-A26',
  source: 'M1_STATEMENT_PDF',
  preview: c1A26Preview
};
const c1C79SessionItem = {
  childPartitionId: C1_PARTITION,
  recognitionLabel: 'Account 1',
  statementPeriodEnd: M1_AS_OF,
  documentFingerprint: FP_C2_C79,
  contentFingerprint: 'CONTENT-C79',
  source: 'M1_STATEMENT_PDF',
  preview: c2C79Preview
};
const replayPayload = {
  pickerValue: 'INV-M1-GMAIL-1',
  accountName: 'M1 Account - Gmail',
  source: 'M1_STATEMENT_PDF',
  registrationType: 'TAXABLE',
  explicitAccountMatch: true,
  sessionChildren: [
    { childPartitionId: C1_PARTITION, recognitionLabel: 'Account 1' },
    { childPartitionId: C2_PARTITION, recognitionLabel: 'Account 2' }
  ],
  sessionApplyItems: [c1C79SessionItem]
};

const replayConflictDiff = replayCtx.boundedHoldingsPreviewBuildGroupedApplyDiffFromDashboard(replayPayload);
assert.equal(replayConflictDiff.ok, false, 'C1 partition must reject c79 fingerprint when a26 is already APPLIED');
assert.equal(replayConflictDiff.requiresReview, true);
assert.match(replayConflictDiff.error, /different document content/i);

const replayWorkbook = replayCtx.getUserSpreadsheet_();
const rowCountBefore = replayWorkbook.getSheetByName(unifiedName).rows.length;
const forgedBundle = replayCtx.boundedHoldingsPreviewApplyBuildDiffBundle_(
  replayWorkbook, replayPayload, 'GROUPED_PROVIDER');
assert.equal(forgedBundle.ok, false, 'internal bundle must also fail closed on partition conflict');
assert.equal(replayWorkbook.getSheetByName(unifiedName).rows.length, rowCountBefore,
  'conflicted grouped Apply must not append unified rows');

const replayDuplicateDiff = replayCtx.boundedHoldingsPreviewBuildGroupedApplyDiffFromDashboard({
  ...replayPayload,
  sessionApplyItems: [c1A26SessionItem]
});
assert.equal(replayDuplicateDiff.ok, true);
assert.equal(replayDuplicateDiff.duplicateNoop, true, 'same partition + same fingerprint must replay as duplicate no-op');

const mixedBatchDiff = replayCtx.boundedHoldingsPreviewBuildGroupedApplyDiffFromDashboard({
  ...replayPayload,
  sessionApplyItems: [c1A26SessionItem, {
    childPartitionId: C2_PARTITION,
    recognitionLabel: 'Account 2',
    statementPeriodEnd: M1_AS_OF,
    documentFingerprint: FP_C2_C79,
    contentFingerprint: 'CONTENT-C79',
    source: 'M1_STATEMENT_PDF',
    preview: c2C79Preview
  }, c1C79SessionItem]
});
assert.equal(mixedBatchDiff.ok, false, 'batch Apply must fail when any child partition has a document conflict');

// Lowercase import status must still participate in replay/conflict detection.
const lowercaseStatusWorkbook = new FakeSpreadsheet([
  new FakeSheet(unifiedName, [
    buildUnifiedHeadersRow(),
    unifiedAppliedRow({
      partition: C1_PARTITION, fingerprint: FP_C1_A26, sourceSecurityKey: 'MRVL',
      symbol: 'MRVL', marketValue: 12202.62, importRef: IMPORT_REF_BATCH1,
      importStatus: 'Applied'
    })
  ])
]);
const lowercaseCtx = buildContext({ workbook: lowercaseStatusWorkbook }).context;
const lowercaseConflict = lowercaseCtx.boundedHoldingsPreviewBuildGroupedApplyDiffFromDashboard(replayPayload);
assert.equal(lowercaseConflict.ok, false, 'Applied import status must match case-insensitively');

// --- Ambiguous identity abort ---
const ambiguousCtx = buildContext({
  assetsRows: [['Synthetic E*TRADE Taxable', 'Brokerage', '50000', 'Yes', '', '']],
  registryRows: [FINANCIAL_ACCOUNT_HEADERS]
}).context;
const ambiguousDiff = ambiguousCtx.boundedHoldingsPreviewBuildApplyDiffFromDashboard({
  ...etPayload,
  pickerValue: '__row__:2',
  investmentId: ''
});
assert.equal(ambiguousDiff.ok, false);

// --- Rollback on failed write ---
const rollbackWorkbook = makeWorkbook();
const rollbackCtx = buildContext({ workbook: rollbackWorkbook }).context;
const rollbackDiff = rollbackCtx.boundedHoldingsPreviewBuildApplyDiffFromDashboard({
  ...etPayload,
  rawDocumentText: etradeText + '\n# rollback variant'
});
assert.equal(rollbackDiff.ok, true);
const rollbackSheet = rollbackWorkbook.insertSheet(unifiedName);
rollbackSheet.rows.push([...rollbackCtx.BOUNDED_HOLDINGS_UNIFIED_HEADERS_]);
const originalWrite = rollbackCtx.boundedHoldingsPreviewApplyWriteDiff_;
rollbackCtx.boundedHoldingsPreviewApplyWriteDiff_ = function failWrite(ss, diff, importRunRef, importedAt) {
  const ensure = rollbackCtx.boundedHoldingsPreviewApplyEnsureUnifiedSheet_(ss, true);
  const sheet = ensure.sheet;
  const startRow = sheet.getLastRow() + 1;
  const values = (diff.create || []).map((row) =>
    rollbackCtx.boundedHoldingsPreviewApplyRowToSheetValues_(row, importRunRef, importedAt));
  const rollback = { updates: [], appends: [{ startRow, rowCount: values.length }] };
  const range = sheet.getRange(startRow, 1, values.length, rollbackCtx.BOUNDED_HOLDINGS_UNIFIED_HEADERS_.length);
  range.failOnWrite = true;
  try {
    range.setValues(values);
  } catch (writeErr) {
    rollbackCtx.boundedHoldingsPreviewApplyRollbackWrites_(sheet, rollback);
    throw writeErr;
  }
  return originalWrite(ss, diff, importRunRef, importedAt);
};
assert.throws(() => rollbackCtx.boundedHoldingsPreviewApplyWriteDiff_(
  rollbackWorkbook,
  rollbackCtx.boundedHoldingsPreviewApplyBuildDiff_(
    rollbackCtx.boundedHoldingsPreviewApplyReadExistingRows_(rollbackWorkbook),
    rollbackDiff.proposedRows
  ),
  'BH-APPLY-TEST',
  '2026-09-09 12:00:00'
), /Synthetic write failure/);
assert.equal(rollbackWorkbook.getSheetByName(unifiedName).rows.length, 1,
  'failed write must roll back appended rows');
assert.deepEqual(cloneSheetRows(workbook.getSheetByName('INPUT - Investments')), investmentsSnapshot,
  'formatting work must not modify INPUT - Investments');

console.log('Bounded holdings preview Apply regressions passed.');
