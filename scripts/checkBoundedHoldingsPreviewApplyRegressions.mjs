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
  formatDate(date, _tz, pattern) {
    if (pattern === 'yyyy-MM-dd HH:mm:ss') return '2026-09-09 12:00:00';
    const resolved = date instanceof Date ? date : new Date(date);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const yy = String(resolved.getFullYear()).slice(2);
    if (pattern === 'MMM-yy') return `${months[resolved.getMonth()]}-${yy}`;
    if (pattern === 'MMM-yyyy') return `${months[resolved.getMonth()]}-${resolved.getFullYear()}`;
    if (pattern === 'yy-MMM') return `${yy}-${months[resolved.getMonth()]}`;
    if (pattern === 'MMM yy') return `${months[resolved.getMonth()]} ${yy}`;
    if (pattern === 'yy MMM') return `${yy} ${months[resolved.getMonth()]}`;
    if (pattern === 'MMMM yyyy') {
      const longMonths = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];
      return `${longMonths[resolved.getMonth()]} ${resolved.getFullYear()}`;
    }
    if (pattern === 'yyyy-MM-dd') {
      const month = String(resolved.getMonth() + 1).padStart(2, '0');
      const day = String(resolved.getDate()).padStart(2, '0');
      return `${resolved.getFullYear()}-${month}-${day}`;
    }
    return '2026-09-09';
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

function monthHeadersForYear(year) {
  const yy = String(year).slice(2);
  return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((month) => `${month}-${yy}`);
}

function buildInvestmentsYearBlockRows(year, accounts) {
  const months = monthHeadersForYear(year);
  const rows = [
    ['Year', String(year)],
    ['Account Name', 'Type', ...months, 'Active', 'Investment Id']
  ];
  (accounts || []).forEach((account) => {
    const values = Array.isArray(account.months) ? account.months.slice() : Array(12).fill('');
    while (values.length < 12) values.push('');
    rows.push([
      account.name,
      account.type || 'Brokerage',
      ...values.slice(0, 12),
      'Yes',
      account.investmentId
    ]);
  });
  return rows;
}

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
  getValue() { return this.read()[0]?.[0] ?? ''; }
  getDisplayValue() { return String(this.getValue() ?? ''); }
  getNumberFormat() { return this.sheet.columnFormats[this.col] || ''; }
  setValue(value) {
    if (this.failOnWrite) throw new Error('Synthetic write failure');
    return this.setValues([[value]]);
  }
  copyTo() { return this; }
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
  autoResizeColumn(col) {
    let maxLen = 0;
    for (const row of this.rows) {
      const text = String(row[col - 1] ?? '');
      if (text.length > maxLen) maxLen = text.length;
    }
    this.columnWidths[col] = Math.max(50, Math.round(maxLen * 7 + 16));
    return this;
  }
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

function fakeAutoWidthForColumn(sheet, col) {
  let maxLen = 0;
  for (const row of sheet.rows) {
    const text = String(row[col - 1] ?? '');
    if (text.length > maxLen) maxLen = text.length;
  }
  return Math.max(50, Math.round(maxLen * 7 + 16));
}

function expectedUnifiedColumnWidth(sheet, col, maxWidth) {
  return Math.min(maxWidth, fakeAutoWidthForColumn(sheet, col) + 24);
}

const UNIFIED_MAX_WIDTHS_ = {
  Source: 280,
  Provider: 120,
  'Parent CashCompass account': 280,
  Symbol: 96,
  'Security name': 280,
  Shares: 110,
  Price: 110,
  'Market value': 130,
  'Cost basis': 120,
  'Unrealized gain/loss': 200,
  'Cash balance': 120,
  'Document fingerprint': 168,
  'Import status': 118,
  'Import run/reference': 168
};

const READABLE_UNIFIED_HEADERS = [
  'Source', 'Provider', 'Parent CashCompass account', 'Symbol', 'Security name',
  'Shares', 'Price', 'Market value', 'Cost basis', 'Unrealized gain/loss', 'Cash balance'
];

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
  const plannerSource = read('planner_helpers.js');
  const quickAddSource = read('quick_add_payment.js');
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
    ${extractFunction(investmentsSource, 'investmentNumericEvidencePresent_')}
    ${extractFunction(investmentsSource, 'isInvestmentDataRowName_')}
    ${extractFunction(investmentsSource, 'getInvestmentsYearBlock_')}
    ${extractFunction(investmentsSource, 'findInvestmentRowInBlock_')}
    ${extractFunction(investmentsSource, 'getInvestmentHistoryValueForMonth_')}
    ${extractFunction(investmentsSource, 'updateInvestmentHistory_')}
    ${extractFunction(investmentsSource, 'updateInvestmentValueByDate')}
    ${extractFunction(plannerSource, 'validateRequired_')}
    ${extractFunction(plannerSource, 'normalizeHeaderText_')}
    ${extractFunction(plannerSource, 'getMonthHeaderCandidates_')}
    ${extractFunction(plannerSource, 'findMonthColumnIndexZeroBased_')}
    ${extractFunction(plannerSource, 'findMonthColumnIndex_')}
    ${extractFunction(plannerSource, 'getMonthColumnByDate_')}
    ${extractFunction(plannerSource, 'applyCurrencyFormat_')}
    ${extractFunction(plannerSource, 'copyNeighborFormatInRow_')}
    ${extractFunction(plannerSource, 'setCurrencyPreserveFormat_')}
    ${extractFunction(plannerSource, 'setCurrencyCellPreserveRowFormat_')}
    ${extractFunction(quickAddSource, 'parseIsoDateLocal_')}
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

function makeSchwabWorkbook(options = {}) {
  const julyValue = Object.prototype.hasOwnProperty.call(options, 'julyValue')
    ? options.julyValue
    : '';
  const months = Array(12).fill('');
  months[6] = julyValue;
  return makeWorkbook({
    assetsRows: [
      ['Charles Schwab - Personal', 'Brokerage', '40000', 'Yes', 'INV-SCHWAB-1', '']
    ],
    investmentsRows: buildInvestmentsYearBlockRows(2026, [{
      name: 'Charles Schwab - Personal',
      investmentId: 'INV-SCHWAB-1',
      months
    }]),
    monthlyRows: [monthlyHistoryHeaders],
    registryRows: [
      FINANCIAL_ACCOUNT_HEADERS,
      registryRow({
        stableAccountId: 'STABLE-SCHWAB-1',
        domain: 'INVESTMENT',
        displayName: 'Charles Schwab - Personal',
        institution: 'Charles Schwab',
        accountType: 'Brokerage',
        accountSubtype: '',
        ownerId: 'OWNER-1',
        registrationType: 'TAXABLE',
        currency: 'USD',
        last4: '',
        active: 'Yes',
        identityStatus: 'VERIFIED',
        legacyDomain: 'SYS_ASSETS',
        legacyKey: 'INV-SCHWAB-1'
      })
    ]
  });
}

function buildContext(options = {}) {
  const workbook = options.workbook || makeWorkbook(options);
  const context = {
    Utilities: utilities,
    String, Number, Object, Array, Math, isFinite, Error, JSON, console,
    Session: { getScriptTimeZone: () => 'America/Los_Angeles' },
    SpreadsheetApp: {
      flush() {},
      CopyPasteType: { PASTE_FORMAT: 'PASTE_FORMAT' },
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
    assertAdmin_: () => {},
    Logger: { log() {} },
    getCurrentYear_: () => 2026,
    syncAllAssetsFromLatestCurrentYear_() {},
    __activityLogEntries: [],
    appendActivityLog_(_ss, payload) {
      const detailsRaw = payload && payload.details;
      let details = detailsRaw;
      if (typeof detailsRaw === 'string') {
        try { details = JSON.parse(detailsRaw); } catch (_err) { details = { legacyDetailsText: detailsRaw }; }
      }
      context.__activityLogEntries.push({
        eventType: String((payload && payload.eventType) || ''),
        payee: String((payload && payload.payee) || ''),
        accountSource: String((payload && payload.accountSource) || ''),
        details: details || {}
      });
      return true;
    },
    touchDashboardSourceUpdated_() {},
    fitContentColumnsToContents_() {}
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
  vm.runInContext(read('investment_etrade_client_statement_pdf.js'), context, {
    filename: 'investment_etrade_client_statement_pdf.js'
  });
  vm.runInContext(read('investment_m1_statement_pdf.js'), context, {
    filename: 'investment_m1_statement_pdf.js'
  });
  vm.runInContext(read('investment_schwab_brokerage_statement_pdf.js'), context, {
    filename: 'investment_schwab_brokerage_statement_pdf.js'
  });
  vm.runInContext(read('investment_stash_brokerage_statement_pdf.js'), context, {
    filename: 'investment_stash_brokerage_statement_pdf.js'
  });
  vm.runInContext(read('investment_fidelity_401k_statement_pdf.js'), context, {
    filename: 'investment_fidelity_401k_statement_pdf.js'
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
const applyDiffSource = read('bounded_holdings_preview_apply_diff.js');
const boundedHtml = read('BoundedHoldingsPreviewUI.html');
const boundedSource = read('bounded_holdings_preview.js');
const etradeText = fixture('etrade', 'synthetic_etrade_positions_minimal.txt');
const schwabText = fixture('schwab', 'synthetic_schwab_brokerage_statement_pdfjs_space_joined.txt');
const stashText = fixture('stash', 'synthetic_stash_brokerage_statement_minimal.txt');
const stashReconFailText = fixture('stash', 'synthetic_stash_brokerage_statement_reconciliation_fail.txt');

assert.match(applySource, /boundedHoldingsPreviewApplyFromDashboard/);
assert.match(applySource, /boundedHoldingsPreviewBuildApplyDiffFromDashboard/);
assert.match(applySource, /boundedHoldingsPreviewApplySanitizeDiffBundleForClient_/);
assert.match(applySource, /updateInvestmentValueByDate/);
assert.match(applySource, /boundedHoldingsPreviewApplyBuildMonthlyInvestmentValueProposal_/);
assert.match(applySource, /appendActivityLog_/);
assert.match(applySource, /investment_statement_monthly_value/);
assert.match(applySource, /KEEP_EXISTING/);
assert.match(applySource, /STALE_REJECTED/);
assert.doesNotMatch(applySource, /SYS - Investment Activity/);
assert.match(applyDiffSource, /monthlyDigestPart/);
assert.match(applyDiffSource, /endingTotalValue/);
assert.match(applyDiffSource, /existingPresent/);
assert.match(applyDiffSource, /Already matches\. Existing value will be kept\./);
assert.match(applyDiffSource, /Existing value will remain unchanged unless Replace is selected\./);
assert.match(applyDiffSource, /Warning: the existing monthly value will be replaced\./);
assert.doesNotMatch(
  extractFunction(applyDiffSource, 'boundedHoldingsPreviewApplyBuildMonthlyInvestmentValueProposal_'),
  /proposal\.warning = proposal\.warning[\s\S]*will be replaced/
);
assert.doesNotMatch(applyDiffSource, /holdingsMarketValueSum \+|preview\.analysis/);
assert.doesNotMatch(
  extractFunction(applyDiffSource, 'boundedHoldingsPreviewApplyBuildMonthlyInvestmentValueProposal_'),
  /action:\s*'UPDATE'|explicitMonthlyValueReplace|ALREADY_MATCHES/
);
assert.match(extractFunction(applyDiffSource, 'boundedHoldingsPreviewApplyIsMonthlyValueSource_'),
  /STASH_BROKERAGE_STATEMENT_PDF/);
assert.match(extractFunction(applyDiffSource, 'boundedHoldingsPreviewApplyMonthlyDigestPart_'), /decision:/);
assert.match(boundedHtml, /boundedHoldingsPreviewBuildGroupedApplyDiffFromDashboard/);
assert.match(applySheetSource, /boundedHoldingsPreviewApplyFormatUnifiedSheet_/);
assert.match(applySheetSource, /boundedHoldingsPreviewApplySetUnifiedColumnWidths_/);
assert.match(applySheetSource, /autoResizeColumn/);
assert.match(applySheetSource, /boundedHoldingsPreviewApplyUnifiedWidthGutter_/);
assert.match(extractFunction(applySheetSource, 'boundedHoldingsPreviewApplySetUnifiedColumnWidths_'),
  /autoResizeColumn/);
assert.doesNotMatch(extractFunction(applySheetSource, 'boundedHoldingsPreviewApplySetUnifiedColumnWidths_'),
  /SCHWAB|M1_|ETRADE/);
assert.doesNotMatch(extractFunction(applySheetSource, 'boundedHoldingsPreviewApplyFormatUnifiedSheet_'),
  /getSheetByName|getSheets\(/);
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
assert.match(boundedHtml, /Monthly investment value/);
assert.match(boundedHtml, /Keep existing/);
assert.match(boundedHtml, /Replace with statement value/);
assert.match(boundedHtml, /Already matches\. Existing value will be kept\./);
assert.match(boundedHtml, /Existing value will remain unchanged unless Replace is selected\./);
assert.match(boundedHtml, /Warning: the existing monthly value will be replaced\./);
assert.doesNotMatch(boundedHtml, /if you choose Replace/);
assert.doesNotMatch(boundedHtml, /explicitMonthlyValueReplace/);
assert.match(boundedHtml, /ETRADE_CLIENT_STATEMENT_PDF/);
assert.match(boundedHtml, /Etrade Cisco - Future/);
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
assert.equal(diffOnly.diff.monthlyInvestmentValue.action, 'SKIP');
assert.equal(diffOnly.diff.monthlyInvestmentValue.reason, 'UNSUPPORTED_SOURCE');

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
assert.equal(
  formatSheet.columnWidths[1],
  expectedUnifiedColumnWidth(formatSheet, 1, UNIFIED_MAX_WIDTHS_.Source),
  'Source must auto-size to header/values then cap'
);
assert.equal(
  formatSheet.columnWidths[17],
  expectedUnifiedColumnWidth(formatSheet, 17, UNIFIED_MAX_WIDTHS_['Import status']),
  'Import status width must fit APPLIED without exceeding the cap'
);
assert.equal(
  formatSheet.columnWidths[16],
  expectedUnifiedColumnWidth(formatSheet, 16, UNIFIED_MAX_WIDTHS_['Document fingerprint']),
  'Document fingerprint width must stay bounded'
);
assert.equal(
  formatSheet.columnWidths[19],
  expectedUnifiedColumnWidth(formatSheet, 19, UNIFIED_MAX_WIDTHS_['Import run/reference']),
  'Import run/reference width must stay bounded'
);
READABLE_UNIFIED_HEADERS.forEach((header) => {
  const col = formatSheet.rows[0].indexOf(header) + 1;
  assert.ok(col > 0, `${header} must exist on Unified holdings`);
  const maxWidth = UNIFIED_MAX_WIDTHS_[header];
  const width = formatSheet.columnWidths[col];
  assert.equal(width, expectedUnifiedColumnWidth(formatSheet, col, maxWidth),
    `${header} must auto-size from current values`);
  assert.ok(width <= maxWidth, `${header} must not exceed its max width`);
  assert.ok(width >= 50, `${header} must remain readable`);
});

const blankUnifiedSheet = new FakeSheet(unifiedName, [buildUnifiedHeadersRow()]);
const blankRowsBefore = cloneSheetRows(blankUnifiedSheet);
ctx.boundedHoldingsPreviewApplySetUnifiedColumnWidths_(blankUnifiedSheet);
assert.deepEqual(blankUnifiedSheet.rows, blankRowsBefore,
  'blank Unified auto-size must not create or rewrite data rows');
READABLE_UNIFIED_HEADERS.forEach((header) => {
  const col = blankUnifiedSheet.rows[0].indexOf(header) + 1;
  const maxWidth = UNIFIED_MAX_WIDTHS_[header];
  const width = blankUnifiedSheet.columnWidths[col];
  assert.equal(width, expectedUnifiedColumnWidth(blankUnifiedSheet, col, maxWidth),
    `blank Unified ${header} must auto-size from the header`);
  assert.ok(width <= maxWidth, `blank Unified ${header} must stay within max width`);
});

const populatedSchwabSheet = new FakeSheet(unifiedName, [
  buildUnifiedHeadersRow(),
  [
    'SCHWAB_BROKERAGE_STATEMENT_PDF', 'SCHWAB', 'Charles Schwab - Personal',
    '', 'INV-SCHWAB-1', 'CSCO', 'CSCO', 'CISCO SYS INC',
    3.5863, 115.99, 415.97, '', '', 6.92, '2026-07-31', 'FP-SCHWAB', 'APPLIED',
    '2026-09-09 12:00:00', 'BH-APPLY-SCHWAB'
  ]
]);
const schwabRowsBefore = cloneSheetRows(populatedSchwabSheet);
const investmentsNeighbor = new FakeSheet('INPUT - Investments', [
  investmentsHeaders,
  ['Charles Schwab - Personal', 'Brokerage', '50000']
]);
investmentsNeighbor.columnWidths[1] = 999;
ctx.boundedHoldingsPreviewApplySetUnifiedColumnWidths_(populatedSchwabSheet);
assert.deepEqual(populatedSchwabSheet.rows, schwabRowsBefore,
  'populated Unified auto-size must not rewrite values');
assert.equal(investmentsNeighbor.columnWidths[1], 999,
  'Unified width helper must not restyle unrelated sheets');
assert.equal(
  populatedSchwabSheet.columnWidths[1],
  expectedUnifiedColumnWidth(populatedSchwabSheet, 1, UNIFIED_MAX_WIDTHS_.Source)
);
assert.ok(
  populatedSchwabSheet.columnWidths[1] > formatSheet.columnWidths[1],
  'longer Source values must widen Source without a provider-specific formatter'
);
assert.ok(populatedSchwabSheet.columnWidths[1] <= UNIFIED_MAX_WIDTHS_.Source);
assert.equal(
  populatedSchwabSheet.columnWidths[3],
  expectedUnifiedColumnWidth(populatedSchwabSheet, 3, UNIFIED_MAX_WIDTHS_['Parent CashCompass account'])
);
assert.equal(
  populatedSchwabSheet.columnWidths[8],
  expectedUnifiedColumnWidth(populatedSchwabSheet, 8, UNIFIED_MAX_WIDTHS_['Security name'])
);

const wideFormatSheet = new FakeSheet(unifiedName, [
  buildUnifiedHeadersRow(),
  [
    'M1_STATEMENT_PDF', 'M1_GMAIL', 'M1 Account - Gmail',
    'PREVIEW-GROUP-VERY-LONG-CHILD-PARTITION-IDENTIFIER-1234567890', 'INV-M1-GMAIL-1',
    'SOURCE-SECURITY-KEY-WITH-LONG-TECHNICAL-IDENTIFIER', 'NVDA',
    'NVIDIA CORPORATION CLASS A COMMON STOCK WITH AN EXTREMELY LONG REGISTERED SECURITY DESCRIPTION',
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
assert.equal(wideFormatSheet.columnWidths[16], UNIFIED_MAX_WIDTHS_['Document fingerprint'],
  'long document fingerprints must not keep auto-expanded column width');
assert.equal(wideFormatSheet.columnWidths[19], UNIFIED_MAX_WIDTHS_['Import run/reference'],
  'long import references must not keep auto-expanded column width');
assert.equal(wideFormatSheet.columnWidths[8], UNIFIED_MAX_WIDTHS_['Security name'],
  'long security names must cap at the shared Unified max width');
assert.ok(
  wideFormatSheet.columnWidths[8] < fakeAutoWidthForColumn(wideFormatSheet, 8) + 24,
  'security-name cap must shrink past the uncapped auto-size'
);
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
assert.equal(groupedDiff.diff.monthlyInvestmentValue.action, 'SKIP');
assert.equal(groupedDiff.diff.monthlyInvestmentValue.reason, 'GROUPED_PROVIDER');
assert.equal(groupedDiff.diff.monthlyInvestmentValue.skipKind, 'UNAVAILABLE');

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
  accountName: 'Wrong Account Name',
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

function julyValueFromSchwabSheet(ss) {
  return ss.getSheetByName('INPUT - Investments').getRange(3, 9).getValue();
}

function otherMonthValuesFromSchwabSheet(ss) {
  const sheet = ss.getSheetByName('INPUT - Investments');
  return [3, 4, 5, 6, 7, 8, 10, 11, 12, 13, 14].map((col) => sheet.getRange(3, col).getValue());
}

function statementMonthlyActivity_(ctx) {
  return (ctx.__activityLogEntries || []).filter((row) =>
    row.eventType === 'investment_statement_monthly_value');
}

function lastStatementMonthlyActivity_(ctx) {
  const rows = statementMonthlyActivity_(ctx);
  return rows.length ? rows[rows.length - 1] : null;
}

function assertNoSysInvestmentActivity_(ss, label) {
  assert.equal(ss.getSheetByName('SYS - Investment Activity'), null,
    `${label} must not create SYS - Investment Activity`);
}

const schwabPayload = {
  pickerValue: 'INV-SCHWAB-1',
  accountName: 'Charles Schwab - Personal',
  sysAssetsRow: 2,
  source: 'SCHWAB_BROKERAGE_STATEMENT_PDF',
  rawDocumentText: schwabText,
  registrationType: 'TAXABLE',
  explicitAccountMatch: true,
  statementProvider: 'SCHWAB'
};

const skipIdentity = ctx.boundedHoldingsPreviewApplyBuildMonthlyInvestmentValueProposal_(
  {
    source: 'SCHWAB_BROKERAGE_STATEMENT_PDF',
    explicitAccountMatch: true,
    accountName: 'Wrong Account'
  },
  'SINGLE_ACCOUNT',
  { accountName: 'Charles Schwab - Personal', investmentId: 'INV-SCHWAB-1' },
  { asOf: '2026-07-31', reconciliation: { endingTotalValue: 47778.84 } }
);
assert.equal(skipIdentity.action, 'SKIP');
assert.equal(skipIdentity.reason, 'IDENTITY_MISMATCH');
assert.equal(skipIdentity.willWrite, false);

const skipMatch = ctx.boundedHoldingsPreviewApplyBuildMonthlyInvestmentValueProposal_(
  {
    source: 'SCHWAB_BROKERAGE_STATEMENT_PDF',
    accountName: 'Charles Schwab - Personal'
  },
  'SINGLE_ACCOUNT',
  { accountName: 'Charles Schwab - Personal', investmentId: 'INV-SCHWAB-1' },
  { asOf: '2026-07-31', reconciliation: { endingTotalValue: 47778.84 } }
);
assert.equal(skipMatch.action, 'SKIP');
assert.equal(skipMatch.reason, 'EXPLICIT_MATCH_REQUIRED');
assert.equal(skipMatch.willWrite, false);

const skipMissingEnding = ctx.boundedHoldingsPreviewApplyBuildMonthlyInvestmentValueProposal_(
  {
    source: 'SCHWAB_BROKERAGE_STATEMENT_PDF',
    accountName: 'Charles Schwab - Personal',
    explicitAccountMatch: true
  },
  'SINGLE_ACCOUNT',
  { accountName: 'Charles Schwab - Personal', investmentId: 'INV-SCHWAB-1' },
  {
    asOf: '2026-07-31',
    totalAccountValue: 12345.67,
    capabilities: { accountSnapshot: true },
    holdingsRows: [{ marketValue: 12345.67 }],
    reconciliation: { endingTotalValue: null, holdingsMarketValueSum: 12345.67 }
  }
);
assert.equal(skipMissingEnding.action, 'SKIP');
assert.equal(skipMissingEnding.reason, 'MISSING_ENDING_TOTAL');
assert.equal(skipMissingEnding.willWrite, false);
assert.notEqual(skipMissingEnding.proposedValue, 12345.67);

const skipOutOfYear = ctx.boundedHoldingsPreviewApplyBuildMonthlyInvestmentValueProposal_(
  {
    source: 'SCHWAB_BROKERAGE_STATEMENT_PDF',
    accountName: 'Charles Schwab - Personal',
    explicitAccountMatch: true
  },
  'SINGLE_ACCOUNT',
  { accountName: 'Charles Schwab - Personal', investmentId: 'INV-SCHWAB-1' },
  { asOf: '2025-07-31', reconciliation: { endingTotalValue: 47778.84 } }
);
assert.equal(skipOutOfYear.action, 'SKIP');
assert.equal(skipOutOfYear.reason, 'OUT_OF_YEAR');
assert.equal(skipOutOfYear.skipKind, 'UNAVAILABLE');
assert.equal(skipOutOfYear.willWrite, false);

const skipInvalidDate = ctx.boundedHoldingsPreviewApplyBuildMonthlyInvestmentValueProposal_(
  {
    source: 'SCHWAB_BROKERAGE_STATEMENT_PDF',
    accountName: 'Charles Schwab - Personal',
    explicitAccountMatch: true
  },
  'SINGLE_ACCOUNT',
  { accountName: 'Charles Schwab - Personal', investmentId: 'INV-SCHWAB-1' },
  { asOf: '', reconciliation: { endingTotalValue: 47778.84 } }
);
assert.equal(skipInvalidDate.action, 'SKIP');
assert.equal(skipInvalidDate.reason, 'INVALID_STATEMENT_DATE');
assert.equal(skipInvalidDate.willWrite, false);

const emptySchwab = makeSchwabWorkbook();
const emptySchwabBuilt = buildContext({ workbook: emptySchwab });
const emptySchwabCtx = emptySchwabBuilt.context;
const emptySchwabBook = emptySchwabBuilt.workbook;
const emptyInvestmentsBeforePreview = cloneSheetRows(emptySchwabBook.getSheetByName('INPUT - Investments'));
const emptyPreview = emptySchwabCtx.boundedHoldingsPreviewRunFromDashboard(schwabPayload);
assert.equal(emptyPreview.ok, true);
assert.equal(emptyPreview.reconciliation.endingTotalValue, 47778.84);
assert.ok(emptyPreview.unsupportedRows.some((row) => row.reason === 'UNPRICED_SECURITY'));
assert.equal(emptySchwabBook.getSheetByName(unifiedName), null, 'preview must not create unified sheet');
assert.deepEqual(cloneSheetRows(emptySchwabBook.getSheetByName('INPUT - Investments')),
  emptyInvestmentsBeforePreview, 'preview must not write monthly investment values');

const emptyDiff = emptySchwabCtx.boundedHoldingsPreviewBuildApplyDiffFromDashboard(schwabPayload);
assert.equal(emptyDiff.ok, true);
assert.equal(emptyDiff.diff.monthlyInvestmentValue.comparison, 'BLANK');
assert.equal(emptyDiff.diff.monthlyInvestmentValue.decision, 'IGNORE');
assert.equal(emptyDiff.diff.monthlyInvestmentValue.action, 'SKIP');
assert.equal(emptyDiff.diff.monthlyInvestmentValue.proposedValue, 47778.84);
assert.equal(emptyDiff.diff.monthlyInvestmentValue.willWrite, false);
assert.equal(emptyDiff.diff.monthlyInvestmentValue.existingPresent, false);
assert.match(emptyDiff.diff.monthlyInvestmentValue.message, /July 2026/);
assert.doesNotMatch(String(emptyDiff.diff.monthlyInvestmentValue.message || ''),
  /replaced|remain unchanged unless Replace/);
assert.doesNotMatch(String(emptyDiff.diff.monthlyInvestmentValue.warning || ''),
  /replaced|remain unchanged unless Replace/);
assert.match(emptyDiff.diffDigest, /./);
assert.deepEqual(cloneSheetRows(emptySchwabBook.getSheetByName('INPUT - Investments')),
  emptyInvestmentsBeforePreview, 'review must not write monthly investment values');

const otherMonthsBeforeEmptyApply = otherMonthValuesFromSchwabSheet(emptySchwabBook);
const emptyIgnoreApply = emptySchwabCtx.boundedHoldingsPreviewApplyFromDashboard({
  ...schwabPayload,
  diffDigest: emptyDiff.diffDigest,
  explicitApplyConfirm: true,
  monthlyInvestmentValueDecision: 'IGNORE'
});
assert.equal(emptyIgnoreApply.ok, true);
assert.notEqual(emptyIgnoreApply.monthlyInvestmentValueWritten, true);
assert.equal(julyValueFromSchwabSheet(emptySchwabBook), '');
assert.deepEqual(otherMonthValuesFromSchwabSheet(emptySchwabBook), otherMonthsBeforeEmptyApply);
const emptyUnified = emptySchwabBook.getSheetByName(unifiedName);
assert.ok(emptyUnified, 'Schwab Apply must create unified holdings');
assert.equal(emptyUnified.rows.some((row) => /TIANREN|CHINA TIANREN/i.test(String(row.join(' ')))), false,
  'unpriced holdings must remain excluded');
assert.equal(emptyUnified.rows.filter((row, index) => index > 0 && String(row[6] || '').trim()).length >= 5, true);
const ignoreLog = lastStatementMonthlyActivity_(emptySchwabCtx);
assert.ok(ignoreLog, 'Ignore must write LOG - Activity');
assert.equal(ignoreLog.payee, 'Charles Schwab - Personal');
assert.equal(ignoreLog.accountSource, 'Schwab');
assert.equal(ignoreLog.details.decision, 'IGNORE');
assert.equal(ignoreLog.details.result, 'SKIPPED');
assert.equal(ignoreLog.details.oldValue, '');
assert.equal(ignoreLog.details.proposedValue, 47778.84);
assert.equal(ignoreLog.details.targetMonth, 'July 2026');
assert.match(String(ignoreLog.details.documentFingerprint || ignoreLog.details.diffDigest || ''), /./);
assertNoSysInvestmentActivity_(emptySchwabBook, 'Schwab Ignore');

const addSchwab = makeSchwabWorkbook();
const addSchwabBuilt = buildContext({ workbook: addSchwab });
const addDiff = addSchwabBuilt.context.boundedHoldingsPreviewBuildApplyDiffFromDashboard({
  ...schwabPayload,
  monthlyInvestmentValueDecision: 'ADD'
});
assert.equal(addDiff.diff.monthlyInvestmentValue.action, 'ADD');
assert.equal(addDiff.diff.monthlyInvestmentValue.willWrite, true);
assert.equal(addDiff.diff.monthlyInvestmentValue.decision, 'ADD');
assert.match(addDiff.diff.monthlyInvestmentValue.message, /Add July 2026 value: \$47,778\.84/);
const missingConfirmApply = addSchwabBuilt.context.boundedHoldingsPreviewApplyFromDashboard({
  ...schwabPayload,
  diffDigest: addDiff.diffDigest,
  monthlyInvestmentValueDecision: 'ADD'
});
assert.equal(missingConfirmApply.ok, false);
assert.equal(statementMonthlyActivity_(addSchwabBuilt.context).length, 0,
  'missing final confirmation must not log a monthly-value decision');
assert.equal(julyValueFromSchwabSheet(addSchwab), '');

const otherMonthsBeforeAdd = otherMonthValuesFromSchwabSheet(addSchwab);
const emptyApply = addSchwabBuilt.context.boundedHoldingsPreviewApplyFromDashboard({
  ...schwabPayload,
  diffDigest: addDiff.diffDigest,
  explicitApplyConfirm: true,
  monthlyInvestmentValueDecision: 'ADD'
});
assert.equal(emptyApply.ok, true);
assert.equal(emptyApply.monthlyInvestmentValueWritten, true);
assert.equal(julyValueFromSchwabSheet(addSchwab), 47778.84);
assert.deepEqual(otherMonthValuesFromSchwabSheet(addSchwab), otherMonthsBeforeAdd);
const addLog = lastStatementMonthlyActivity_(addSchwabBuilt.context);
assert.equal(addLog.details.decision, 'ADD');
assert.equal(addLog.details.result, 'APPLIED');
assert.equal(addLog.details.oldValue, '');
assert.equal(addLog.details.proposedValue, 47778.84);
assert.equal(addLog.details.newValue, 47778.84);
assert.equal(addLog.payee, 'Charles Schwab - Personal');
assertNoSysInvestmentActivity_(addSchwab, 'Schwab Add');

const alreadyWorkbook = makeSchwabWorkbook({ julyValue: 47778.84 });
const alreadyBuilt = buildContext({ workbook: alreadyWorkbook });
const alreadyDiff = alreadyBuilt.context.boundedHoldingsPreviewBuildApplyDiffFromDashboard(schwabPayload);
assert.equal(alreadyDiff.ok, true);
assert.equal(alreadyDiff.diff.monthlyInvestmentValue.comparison, 'MATCH');
assert.equal(alreadyDiff.diff.monthlyInvestmentValue.decision, 'KEEP');
assert.equal(alreadyDiff.diff.monthlyInvestmentValue.action, 'SKIP');
assert.equal(alreadyDiff.diff.monthlyInvestmentValue.willWrite, false);
assert.equal(alreadyDiff.diff.monthlyInvestmentValue.existingPresent, true);
assert.equal(alreadyDiff.diff.monthlyInvestmentValue.message,
  'Already matches. Existing value will be kept.');
const alreadyBefore = cloneSheetRows(alreadyWorkbook.getSheetByName('INPUT - Investments'));
const alreadyApply = alreadyBuilt.context.boundedHoldingsPreviewApplyFromDashboard({
  ...schwabPayload,
  diffDigest: alreadyDiff.diffDigest,
  explicitApplyConfirm: true,
  monthlyInvestmentValueDecision: 'KEEP'
});
assert.equal(alreadyApply.ok, true);
assert.notEqual(alreadyApply.monthlyInvestmentValueWritten, true);
assert.deepEqual(cloneSheetRows(alreadyWorkbook.getSheetByName('INPUT - Investments')), alreadyBefore,
  'matching occupied month must not be rewritten');
const matchLog = lastStatementMonthlyActivity_(alreadyBuilt.context);
assert.equal(matchLog.details.decision, 'KEEP_EXISTING');
assert.equal(matchLog.details.result, 'SKIPPED');
assert.equal(matchLog.details.oldValue, 47778.84);
assert.equal(matchLog.details.proposedValue, 47778.84);
assertNoSysInvestmentActivity_(alreadyWorkbook, 'Schwab match');

const zeroWorkbook = makeSchwabWorkbook({ julyValue: 0 });
const zeroBuilt = buildContext({ workbook: zeroWorkbook });
const zeroDiff = zeroBuilt.context.boundedHoldingsPreviewBuildApplyDiffFromDashboard(schwabPayload);
assert.equal(zeroDiff.diff.monthlyInvestmentValue.comparison, 'DIFFER');
assert.equal(zeroDiff.diff.monthlyInvestmentValue.existingPresent, true);
assert.equal(zeroDiff.diff.monthlyInvestmentValue.existingValue, 0);
assert.equal(zeroDiff.diff.monthlyInvestmentValue.willWrite, false);
const zeroBefore = cloneSheetRows(zeroWorkbook.getSheetByName('INPUT - Investments'));
const zeroApply = zeroBuilt.context.boundedHoldingsPreviewApplyFromDashboard({
  ...schwabPayload,
  diffDigest: zeroDiff.diffDigest,
  explicitApplyConfirm: true,
  monthlyInvestmentValueDecision: 'KEEP'
});
assert.equal(zeroApply.ok, true);
assert.notEqual(zeroApply.monthlyInvestmentValueWritten, true);
assert.equal(julyValueFromSchwabSheet(zeroWorkbook), 0);
assert.deepEqual(cloneSheetRows(zeroWorkbook.getSheetByName('INPUT - Investments')), zeroBefore,
  'explicit $0 is an occupied value and must not be overwritten');
const zeroLog = lastStatementMonthlyActivity_(zeroBuilt.context);
assert.equal(zeroLog.details.decision, 'KEEP_EXISTING');
assert.equal(zeroLog.details.result, 'SKIPPED');
assert.equal(zeroLog.details.oldValue, 0);
assert.equal(zeroLog.details.proposedValue, 47778.84);
assertNoSysInvestmentActivity_(zeroWorkbook, 'Schwab explicit $0');

const occupiedWorkbook = makeSchwabWorkbook({ julyValue: 50000 });
const occupiedBuilt = buildContext({ workbook: occupiedWorkbook });
const occupiedDiff = occupiedBuilt.context.boundedHoldingsPreviewBuildApplyDiffFromDashboard(schwabPayload);
assert.equal(occupiedDiff.ok, true);
assert.equal(occupiedDiff.diff.monthlyInvestmentValue.comparison, 'DIFFER');
assert.equal(occupiedDiff.diff.monthlyInvestmentValue.decision, 'KEEP');
assert.equal(occupiedDiff.diff.monthlyInvestmentValue.action, 'SKIP');
assert.equal(occupiedDiff.diff.monthlyInvestmentValue.willWrite, false);
assert.equal(occupiedDiff.diff.monthlyInvestmentValue.existingValue, 50000);
assert.equal(occupiedDiff.diff.monthlyInvestmentValue.proposedValue, 47778.84);
assert.match(occupiedDiff.diff.monthlyInvestmentValue.message,
  /Existing value will remain unchanged unless Replace is selected\./);
assert.doesNotMatch(String(occupiedDiff.diff.monthlyInvestmentValue.message || ''),
  /will be replaced/);
assert.doesNotMatch(String(occupiedDiff.diff.monthlyInvestmentValue.warning || ''),
  /will be replaced/);
const occupiedOtherMonths = otherMonthValuesFromSchwabSheet(occupiedWorkbook);
const occupiedApply = occupiedBuilt.context.boundedHoldingsPreviewApplyFromDashboard({
  ...schwabPayload,
  diffDigest: occupiedDiff.diffDigest,
  explicitApplyConfirm: true,
  monthlyInvestmentValueDecision: 'KEEP'
});
assert.equal(occupiedApply.ok, true);
assert.notEqual(occupiedApply.monthlyInvestmentValueWritten, true);
assert.equal(julyValueFromSchwabSheet(occupiedWorkbook), 50000,
  'Keep existing must not overwrite a different monthly value');
assert.deepEqual(otherMonthValuesFromSchwabSheet(occupiedWorkbook), occupiedOtherMonths,
  'other months remain unchanged when Keep existing is chosen');
const keepLog = lastStatementMonthlyActivity_(occupiedBuilt.context);
assert.equal(keepLog.details.decision, 'KEEP_EXISTING');
assert.equal(keepLog.details.result, 'SKIPPED');
assert.equal(keepLog.details.oldValue, 50000);
assert.equal(keepLog.details.proposedValue, 47778.84);
assertNoSysInvestmentActivity_(occupiedWorkbook, 'Schwab Keep');

const replaceWorkbook = makeSchwabWorkbook({ julyValue: 50000 });
const replaceBuilt = buildContext({ workbook: replaceWorkbook });
const replaceDiff = replaceBuilt.context.boundedHoldingsPreviewBuildApplyDiffFromDashboard({
  ...schwabPayload,
  monthlyInvestmentValueDecision: 'REPLACE'
});
assert.equal(replaceDiff.diff.monthlyInvestmentValue.action, 'REPLACE');
assert.equal(replaceDiff.diff.monthlyInvestmentValue.willWrite, true);
assert.match(String(replaceDiff.diff.monthlyInvestmentValue.message || ''),
  /Warning: the existing monthly value will be replaced/);
const replaceApply = replaceBuilt.context.boundedHoldingsPreviewApplyFromDashboard({
  ...schwabPayload,
  diffDigest: replaceDiff.diffDigest,
  explicitApplyConfirm: true,
  monthlyInvestmentValueDecision: 'REPLACE'
});
assert.equal(replaceApply.ok, true);
assert.equal(replaceApply.monthlyInvestmentValueWritten, true);
assert.equal(julyValueFromSchwabSheet(replaceWorkbook), 47778.84);
const replaceLog = lastStatementMonthlyActivity_(replaceBuilt.context);
assert.equal(replaceLog.details.decision, 'REPLACE');
assert.equal(replaceLog.details.result, 'APPLIED');
assert.equal(replaceLog.details.oldValue, 50000);
assert.equal(replaceLog.details.newValue, 47778.84);
assert.equal(replaceLog.details.proposedValue, 47778.84);
assertNoSysInvestmentActivity_(replaceWorkbook, 'Schwab Replace');

const monthlyStaleWorkbook = makeSchwabWorkbook();
const monthlyStaleBuilt = buildContext({ workbook: monthlyStaleWorkbook });
const monthlyStaleDiff = monthlyStaleBuilt.context.boundedHoldingsPreviewBuildApplyDiffFromDashboard({
  ...schwabPayload,
  monthlyInvestmentValueDecision: 'ADD'
});
assert.equal(monthlyStaleDiff.diff.monthlyInvestmentValue.action, 'ADD');
assert.equal(monthlyStaleDiff.diff.monthlyInvestmentValue.existingPresent, false);
monthlyStaleWorkbook.getSheetByName('INPUT - Investments').getRange(3, 9).setValue(1);
const monthlyStaleApply = monthlyStaleBuilt.context.boundedHoldingsPreviewApplyFromDashboard({
  ...schwabPayload,
  diffDigest: monthlyStaleDiff.diffDigest,
  explicitApplyConfirm: true,
  monthlyInvestmentValueDecision: 'ADD'
});
assert.equal(monthlyStaleApply.ok, false);
assert.equal(monthlyStaleApply.staleDiff, true);
assert.equal(julyValueFromSchwabSheet(monthlyStaleWorkbook), 1);
assert.equal(monthlyStaleWorkbook.getSheetByName(unifiedName), null,
  'stale monthly digest must fail closed before holdings write');
const staleLog = lastStatementMonthlyActivity_(monthlyStaleBuilt.context);
assert.equal(staleLog.details.result, 'STALE_REJECTED');
assert.notEqual(staleLog.details.result, 'APPLIED');
assert.equal(staleLog.details.decision, 'ADD');
assertNoSysInvestmentActivity_(monthlyStaleWorkbook, 'Schwab stale');

const failWorkbook = makeSchwabWorkbook();
const failBuilt = buildContext({ workbook: failWorkbook });
const failDiff = failBuilt.context.boundedHoldingsPreviewBuildApplyDiffFromDashboard({
  ...schwabPayload,
  monthlyInvestmentValueDecision: 'ADD'
});
failBuilt.context.updateInvestmentValueByDate = function failMonthly() {
  throw new Error('Synthetic monthly write failure');
};
const failApply = failBuilt.context.boundedHoldingsPreviewApplyFromDashboard({
  ...schwabPayload,
  diffDigest: failDiff.diffDigest,
  explicitApplyConfirm: true,
  monthlyInvestmentValueDecision: 'ADD'
});
assert.equal(failApply.ok, false);
assert.match(String(failApply.error || ''), /Monthly investment value could not be saved/);
assert.equal(julyValueFromSchwabSheet(failWorkbook), '');
const failUnified = failWorkbook.getSheetByName(unifiedName);
assert.ok(!failUnified || failUnified.rows.length <= 1,
  'monthly-write failure must not leave applied holdings rows');
const failLog = lastStatementMonthlyActivity_(failBuilt.context);
assert.equal(failLog.details.result, 'FAILED');
assert.notEqual(failLog.details.result, 'APPLIED');
assertNoSysInvestmentActivity_(failWorkbook, 'Schwab failed Apply');

const mismatchApply = emptySchwabCtx.boundedHoldingsPreviewApplyFromDashboard({
  ...schwabPayload,
  explicitAccountMatch: false,
  diffDigest: emptyDiff.diffDigest,
  explicitApplyConfirm: true
});
assert.equal(mismatchApply.ok, false);

assert.equal(
  emptySchwabCtx.boundedHoldingsPreviewApplyIsMonthlyValueSource_('STASH_BROKERAGE_STATEMENT_PDF'),
  true
);
assert.equal(
  emptySchwabCtx.boundedHoldingsPreviewApplyIsMonthlyValueSource_('SCHWAB_BROKERAGE_STATEMENT_PDF'),
  true
);
assert.equal(
  emptySchwabCtx.boundedHoldingsPreviewApplyIsMonthlyValueSource_('FIDELITY_401K_STATEMENT_PDF'),
  true
);
assert.equal(
  emptySchwabCtx.boundedHoldingsPreviewApplyIsMonthlyValueSource_('ETRADE_CLIENT_STATEMENT_PDF'),
  false
);
assert.equal(
  emptySchwabCtx.boundedHoldingsPreviewApplyIsMonthlyValueSource_(
    'ETRADE_CLIENT_STATEMENT_PDF', 'Etrade Cisco - Future'),
  true
);
assert.equal(
  emptySchwabCtx.boundedHoldingsPreviewApplyIsMonthlyValueSource_(
    'ETRADE_CLIENT_STATEMENT_PDF', 'Etrade Cisco - RSU/ESPP'),
  false
);
assert.equal(
  emptySchwabCtx.boundedHoldingsPreviewApplyIsMonthlyValueSource_(
    'ETRADE_CLIENT_STATEMENT_PDF', 'Samer Etrade Account'),
  true
);
assert.equal(
  emptySchwabCtx.boundedHoldingsPreviewApplyIsMonthlyValueSource_(
    'ETRADE_CLIENT_STATEMENT_PDF', 'Lutfi Etrade Account'),
  false
);
const stashTrustedEnding = emptySchwabCtx.boundedHoldingsPreviewApplyResolveProviderEndingTotal_(
  { reconciliation: { ok: true, endingTotalValue: 7782.13 } },
  'STASH_BROKERAGE_STATEMENT_PDF'
);
assert.equal(stashTrustedEnding.value, 7782.13);
assert.equal(stashTrustedEnding.origin, 'RECONCILIATION');
assert.equal(
  emptySchwabCtx.boundedHoldingsPreviewApplyResolveProviderEndingTotal_(
    {
      reconciliation: { ok: false, endingTotalValue: 9000 },
      totalAccountValue: 9000,
      holdingsRows: [{ marketValue: 4000 }, { marketValue: 5000 }]
    },
    'STASH_BROKERAGE_STATEMENT_PDF'
  ).value,
  null
);
const stashMissingReconProposal = emptySchwabCtx.boundedHoldingsPreviewApplyBuildMonthlyInvestmentValueProposal_(
  {
    source: 'STASH_BROKERAGE_STATEMENT_PDF',
    explicitAccountMatch: true,
    accountName: 'Stash Account'
  },
  'SINGLE_ACCOUNT',
  { accountName: 'Stash Account', investmentId: 'INV-STASH-1' },
  { asOf: '2026-08-31', reconciliation: { ok: false, endingTotalValue: 9000 } }
);
assert.equal(stashMissingReconProposal.action, 'SKIP');
assert.equal(stashMissingReconProposal.reason, 'MISSING_ENDING_TOTAL');
assert.equal(stashMissingReconProposal.willWrite, false);

function makeStashWorkbook(options = {}) {
  const augustValue = Object.prototype.hasOwnProperty.call(options, 'augustValue')
    ? options.augustValue
    : '';
  const months = Array(12).fill('');
  months[7] = augustValue;
  return makeWorkbook({
    assetsRows: [
      ['Stash Account', 'Brokerage', '7000', 'Yes', 'INV-STASH-1', '']
    ],
    investmentsRows: buildInvestmentsYearBlockRows(2026, [{
      name: 'Stash Account',
      investmentId: 'INV-STASH-1',
      months
    }]),
    monthlyRows: [monthlyHistoryHeaders],
    registryRows: [
      FINANCIAL_ACCOUNT_HEADERS,
      registryRow({
        stableAccountId: 'STABLE-STASH-1',
        domain: 'INVESTMENT',
        displayName: 'Stash Account',
        institution: 'Stash',
        accountType: 'Brokerage',
        accountSubtype: '',
        ownerId: 'OWNER-1',
        registrationType: 'TAXABLE',
        currency: 'USD',
        last4: '',
        active: 'Yes',
        identityStatus: 'VERIFIED',
        legacyDomain: 'SYS_ASSETS',
        legacyKey: 'INV-STASH-1'
      })
    ]
  });
}

function makeFidelity401kWorkbook(options = {}) {
  const septemberValue = Object.prototype.hasOwnProperty.call(options, 'septemberValue')
    ? options.septemberValue
    : '';
  const months = Array(12).fill('');
  months[8] = septemberValue;
  return makeWorkbook({
    assetsRows: [
      ['401K Account', 'Retirement', '', 'Yes', 'INV-401K-1', '']
    ],
    investmentsRows: buildInvestmentsYearBlockRows(2026, [{
      name: '401K Account',
      type: 'Retirement',
      investmentId: 'INV-401K-1',
      months
    }]),
    monthlyRows: [monthlyHistoryHeaders],
    registryRows: [
      FINANCIAL_ACCOUNT_HEADERS,
      registryRow({
        stableAccountId: 'STABLE-401K-1',
        domain: 'RETIREMENT',
        displayName: '401K Account',
        institution: 'Fidelity',
        accountType: 'Retirement',
        accountSubtype: '',
        ownerId: 'OWNER-1',
        registrationType: '401K',
        currency: 'USD',
        last4: '',
        active: 'Yes',
        identityStatus: 'VERIFIED',
        legacyDomain: 'SYS_ASSETS',
        legacyKey: 'INV-401K-1'
      })
    ]
  });
}

function septemberValueFrom401kSheet(ss) {
  return ss.getSheetByName('INPUT - Investments').getRange(3, 11).getValue();
}

function otherMonthValuesFrom401kSheet(ss) {
  const sheet = ss.getSheetByName('INPUT - Investments');
  return [3, 4, 5, 6, 7, 8, 9, 10, 12, 13, 14].map((col) => sheet.getRange(3, col).getValue());
}

const fidelityText = fixture('fidelity', 'synthetic_fidelity_401k_statement_sep_2026.txt');
const fidelityPayload = {
  pickerValue: 'INV-401K-1',
  accountName: '401K Account',
  sysAssetsRow: 2,
  source: 'FIDELITY_401K_STATEMENT_PDF',
  rawDocumentText: fidelityText,
  registrationType: '401K',
  explicitAccountMatch: true,
  statementProvider: 'FIDELITY'
};

const fidelityParsed = emptySchwabCtx.investmentFidelity401kStatementPreviewFromText_(fidelityText);
assert.equal(fidelityParsed.preview.asOfDate, '2026-09-30');
assert.equal(fidelityParsed.preview.endingBalance, 1919468.06);
const fidelityNormalized = emptySchwabCtx.investmentFidelity401kStatementNormalizeMonthlyPreview_(
  fidelityParsed);
assert.ok(Array.isArray(fidelityNormalized.holdingsRows));
assert.equal(fidelityNormalized.holdingsRows.length, 0);
assert.equal(
  emptySchwabCtx.boundedHoldingsPreviewApplyBuildProposedRowsFromPreview_(
    { source: 'FIDELITY_401K_STATEMENT_PDF' },
    {
      source: 'FIDELITY_401K_STATEMENT_PDF',
      asOf: '2026-09-30',
      endingBalance: 1919468.06,
      holdingsRows: [{ symbol: 'FAKE', marketValue: 1000 }],
      cashBalance: 50
    }
  ).length,
  0,
  'Fidelity Apply must never propose holdings or cash rows'
);

const skipFidelityConfirm = emptySchwabCtx.boundedHoldingsPreviewApplyBuildMonthlyInvestmentValueProposal_(
  {
    source: 'FIDELITY_401K_STATEMENT_PDF',
    accountName: '401K Account',
    explicitAccountMatch: false
  },
  'SINGLE_ACCOUNT',
  { accountName: '401K Account', investmentId: 'INV-401K-1' },
  { asOf: '2026-09-30', endingBalance: 1919468.06 }
);
assert.equal(skipFidelityConfirm.action, 'SKIP');
assert.equal(skipFidelityConfirm.reason, 'EXPLICIT_MATCH_REQUIRED');

const emptyFidelity = makeFidelity401kWorkbook();
const emptyFidelityBuilt = buildContext({ workbook: emptyFidelity });
const emptyFidelityCtx = emptyFidelityBuilt.context;
const emptyFidelityBook = emptyFidelityBuilt.workbook;
const emptyFidelityBefore = cloneSheetRows(emptyFidelityBook.getSheetByName('INPUT - Investments'));
const emptyFidelityDiff = emptyFidelityCtx.boundedHoldingsPreviewBuildApplyDiffFromDashboard(fidelityPayload);
assert.equal(emptyFidelityDiff.ok, true);
assert.equal(emptyFidelityDiff.diff.monthlyInvestmentValue.comparison, 'BLANK');
assert.equal(emptyFidelityDiff.diff.monthlyInvestmentValue.decision, 'IGNORE');
assert.equal(emptyFidelityDiff.diff.monthlyInvestmentValue.action, 'SKIP');
assert.equal(emptyFidelityDiff.diff.monthlyInvestmentValue.proposedValue, 1919468.06);
assert.equal(emptyFidelityDiff.diff.monthlyInvestmentValue.willWrite, false);
assert.equal(emptyFidelityDiff.diff.monthlyInvestmentValue.existingPresent, false);
assert.equal((emptyFidelityDiff.diff.create || []).length, 0);
assert.equal((emptyFidelityDiff.diff.update || []).length, 0);
assert.deepEqual(cloneSheetRows(emptyFidelityBook.getSheetByName('INPUT - Investments')),
  emptyFidelityBefore, 'review must not write monthly investment values');
assert.equal(emptyFidelityBook.getSheetByName(unifiedName), null,
  'Fidelity review must not create unified holdings');

const defaultIgnoreFidelity = emptyFidelityCtx.boundedHoldingsPreviewApplyFromDashboard({
  ...fidelityPayload,
  diffDigest: emptyFidelityDiff.diffDigest,
  explicitApplyConfirm: true
});
assert.equal(defaultIgnoreFidelity.ok, true);
assert.notEqual(defaultIgnoreFidelity.monthlyInvestmentValueWritten, true);
assert.deepEqual(cloneSheetRows(emptyFidelityBook.getSheetByName('INPUT - Investments')),
  emptyFidelityBefore, 'default Ignore must not write');
const fidelityIgnoreLog = lastStatementMonthlyActivity_(emptyFidelityCtx);
assert.equal(fidelityIgnoreLog.details.decision, 'IGNORE');
assert.equal(fidelityIgnoreLog.details.result, 'SKIPPED');
assert.equal(fidelityIgnoreLog.details.oldValue, '');
assert.equal(fidelityIgnoreLog.details.proposedValue, 1919468.06);
assert.equal(fidelityIgnoreLog.payee, '401K Account');
assert.equal(fidelityIgnoreLog.accountSource, 'Fidelity 401(k)');
assertNoSysInvestmentActivity_(emptyFidelityBook, 'Fidelity Ignore');

const fidelityAddBook = makeFidelity401kWorkbook();
const fidelityAddBuilt = buildContext({ workbook: fidelityAddBook });
const fidelityAddDiff = fidelityAddBuilt.context.boundedHoldingsPreviewBuildApplyDiffFromDashboard({
  ...fidelityPayload,
  monthlyInvestmentValueDecision: 'ADD'
});
assert.equal(fidelityAddDiff.diff.monthlyInvestmentValue.action, 'ADD');
assert.equal(fidelityAddDiff.diff.monthlyInvestmentValue.willWrite, true);
assert.match(fidelityAddDiff.diff.monthlyInvestmentValue.message,
  /Add September 2026 value: \$1,919,468\.06/);
const fidelityMissingConfirm = fidelityAddBuilt.context.boundedHoldingsPreviewApplyFromDashboard({
  ...fidelityPayload,
  diffDigest: fidelityAddDiff.diffDigest,
  monthlyInvestmentValueDecision: 'ADD'
});
assert.equal(fidelityMissingConfirm.ok, false);
assert.equal(statementMonthlyActivity_(fidelityAddBuilt.context).length, 0);

const fidelityMonthsBeforeAdd = otherMonthValuesFrom401kSheet(fidelityAddBook);
const fidelityAddApply = fidelityAddBuilt.context.boundedHoldingsPreviewApplyFromDashboard({
  ...fidelityPayload,
  diffDigest: fidelityAddDiff.diffDigest,
  explicitApplyConfirm: true,
  monthlyInvestmentValueDecision: 'ADD'
});
assert.equal(fidelityAddApply.ok, true);
assert.equal(fidelityAddApply.monthlyInvestmentValueWritten, true);
assert.equal(septemberValueFrom401kSheet(fidelityAddBook), 1919468.06);
assert.deepEqual(otherMonthValuesFrom401kSheet(fidelityAddBook), fidelityMonthsBeforeAdd,
  'Fidelity Add must write only the statement month');
assert.equal(fidelityAddBook.getSheetByName(unifiedName), null,
  'Fidelity Add must not write SYS - Investment Holdings Unified');
const fidelityAddLog = lastStatementMonthlyActivity_(fidelityAddBuilt.context);
assert.equal(fidelityAddLog.details.decision, 'ADD');
assert.equal(fidelityAddLog.details.result, 'APPLIED');
assert.equal(fidelityAddLog.details.oldValue, '');
assert.equal(fidelityAddLog.details.newValue, 1919468.06);
assertNoSysInvestmentActivity_(fidelityAddBook, 'Fidelity Add');

const occupiedFidelity = makeFidelity401kWorkbook({ septemberValue: 50000 });
const occupiedFidelityBuilt = buildContext({ workbook: occupiedFidelity });
const occupiedFidelityDiff = occupiedFidelityBuilt.context
  .boundedHoldingsPreviewBuildApplyDiffFromDashboard(fidelityPayload);
assert.equal(occupiedFidelityDiff.diff.monthlyInvestmentValue.comparison, 'DIFFER');
assert.equal(occupiedFidelityDiff.diff.monthlyInvestmentValue.decision, 'KEEP');
assert.equal(occupiedFidelityDiff.diff.monthlyInvestmentValue.action, 'SKIP');
assert.equal(occupiedFidelityDiff.diff.monthlyInvestmentValue.willWrite, false);
assert.equal(occupiedFidelityDiff.diff.monthlyInvestmentValue.existingValue, 50000);
assert.equal(occupiedFidelityDiff.diff.monthlyInvestmentValue.proposedValue, 1919468.06);
const occupiedFidelityBefore = cloneSheetRows(occupiedFidelity.getSheetByName('INPUT - Investments'));
const occupiedFidelityApply = occupiedFidelityBuilt.context.boundedHoldingsPreviewApplyFromDashboard({
  ...fidelityPayload,
  diffDigest: occupiedFidelityDiff.diffDigest,
  explicitApplyConfirm: true,
  monthlyInvestmentValueDecision: 'KEEP'
});
assert.equal(occupiedFidelityApply.ok, true);
assert.notEqual(occupiedFidelityApply.monthlyInvestmentValueWritten, true);
assert.equal(septemberValueFrom401kSheet(occupiedFidelity), 50000);
assert.deepEqual(cloneSheetRows(occupiedFidelity.getSheetByName('INPUT - Investments')),
  occupiedFidelityBefore, 'occupied month Keep existing must not overwrite');
assert.equal(occupiedFidelity.getSheetByName(unifiedName), null);
const fidelityKeepLog = lastStatementMonthlyActivity_(occupiedFidelityBuilt.context);
assert.equal(fidelityKeepLog.details.decision, 'KEEP_EXISTING');
assert.equal(fidelityKeepLog.details.result, 'SKIPPED');
assert.equal(fidelityKeepLog.details.oldValue, 50000);

const fidelityReplaceBook = makeFidelity401kWorkbook({ septemberValue: 50000 });
const fidelityReplaceBuilt = buildContext({ workbook: fidelityReplaceBook });
const fidelityReplaceDiff = fidelityReplaceBuilt.context
  .boundedHoldingsPreviewBuildApplyDiffFromDashboard({
    ...fidelityPayload,
    monthlyInvestmentValueDecision: 'REPLACE'
  });
const fidelityReplaceApply = fidelityReplaceBuilt.context.boundedHoldingsPreviewApplyFromDashboard({
  ...fidelityPayload,
  diffDigest: fidelityReplaceDiff.diffDigest,
  explicitApplyConfirm: true,
  monthlyInvestmentValueDecision: 'REPLACE'
});
assert.equal(fidelityReplaceApply.ok, true);
assert.equal(septemberValueFrom401kSheet(fidelityReplaceBook), 1919468.06);
const fidelityReplaceLog = lastStatementMonthlyActivity_(fidelityReplaceBuilt.context);
assert.equal(fidelityReplaceLog.details.decision, 'REPLACE');
assert.equal(fidelityReplaceLog.details.result, 'APPLIED');
assert.equal(fidelityReplaceLog.details.oldValue, 50000);
assert.equal(fidelityReplaceLog.details.newValue, 1919468.06);

const zeroFidelity = makeFidelity401kWorkbook({ septemberValue: 0 });
const zeroFidelityBuilt = buildContext({ workbook: zeroFidelity });
const zeroFidelityDiff = zeroFidelityBuilt.context
  .boundedHoldingsPreviewBuildApplyDiffFromDashboard(fidelityPayload);
assert.equal(zeroFidelityDiff.diff.monthlyInvestmentValue.comparison, 'DIFFER');
assert.equal(zeroFidelityDiff.diff.monthlyInvestmentValue.existingValue, 0);
const zeroFidelityBefore = cloneSheetRows(zeroFidelity.getSheetByName('INPUT - Investments'));
const zeroFidelityApply = zeroFidelityBuilt.context.boundedHoldingsPreviewApplyFromDashboard({
  ...fidelityPayload,
  diffDigest: zeroFidelityDiff.diffDigest,
  explicitApplyConfirm: true,
  monthlyInvestmentValueDecision: 'KEEP'
});
assert.equal(zeroFidelityApply.ok, true);
assert.notEqual(zeroFidelityApply.monthlyInvestmentValueWritten, true);
assert.equal(septemberValueFrom401kSheet(zeroFidelity), 0);
assert.deepEqual(cloneSheetRows(zeroFidelity.getSheetByName('INPUT - Investments')),
  zeroFidelityBefore, 'explicit $0 is occupied and must not be overwritten');
const fidelityZeroLog = lastStatementMonthlyActivity_(zeroFidelityBuilt.context);
assert.equal(fidelityZeroLog.details.oldValue, 0);
assert.equal(fidelityZeroLog.details.result, 'SKIPPED');

const staleFidelity = makeFidelity401kWorkbook();
const staleFidelityBuilt = buildContext({ workbook: staleFidelity });
const staleFidelityDiff = staleFidelityBuilt.context
  .boundedHoldingsPreviewBuildApplyDiffFromDashboard({
    ...fidelityPayload,
    monthlyInvestmentValueDecision: 'ADD'
  });
assert.equal(staleFidelityDiff.diff.monthlyInvestmentValue.action, 'ADD');
staleFidelity.getSheetByName('INPUT - Investments').getRange(3, 11).setValue(1);
const staleFidelityApply = staleFidelityBuilt.context.boundedHoldingsPreviewApplyFromDashboard({
  ...fidelityPayload,
  diffDigest: staleFidelityDiff.diffDigest,
  explicitApplyConfirm: true,
  monthlyInvestmentValueDecision: 'ADD'
});
assert.equal(staleFidelityApply.ok, false);
assert.equal(staleFidelityApply.staleDiff, true);
assert.equal(septemberValueFrom401kSheet(staleFidelity), 1);
assert.equal(staleFidelity.getSheetByName(unifiedName), null);
const fidelityStaleLog = lastStatementMonthlyActivity_(staleFidelityBuilt.context);
assert.equal(fidelityStaleLog.details.result, 'STALE_REJECTED');
assert.notEqual(fidelityStaleLog.details.result, 'APPLIED');

const mismatchFidelity = emptyFidelityCtx.boundedHoldingsPreviewApplyFromDashboard({
  ...fidelityPayload,
  explicitAccountMatch: false,
  diffDigest: emptyFidelityDiff.diffDigest,
  explicitApplyConfirm: true,
  monthlyInvestmentValueDecision: 'ADD'
});
assert.equal(mismatchFidelity.ok, false);

function augustValueFromStashSheet(ss) {
  return ss.getSheetByName('INPUT - Investments').getRange(3, 10).getValue();
}

function otherMonthValuesFromStashSheet(ss) {
  const sheet = ss.getSheetByName('INPUT - Investments');
  return [3, 4, 5, 6, 7, 8, 9, 11, 12, 13, 14].map((col) => sheet.getRange(3, col).getValue());
}

const stashPayload = {
  pickerValue: 'INV-STASH-1',
  accountName: 'Stash Account',
  sysAssetsRow: 2,
  source: 'STASH_BROKERAGE_STATEMENT_PDF',
  rawDocumentText: stashText,
  registrationType: 'TAXABLE',
  explicitAccountMatch: true,
  statementProvider: 'STASH'
};

const emptyStash = makeStashWorkbook();
const emptyStashBuilt = buildContext({ workbook: emptyStash });
const emptyStashCtx = emptyStashBuilt.context;
const emptyStashBook = emptyStashBuilt.workbook;
const emptyStashInvestmentsBefore = cloneSheetRows(emptyStashBook.getSheetByName('INPUT - Investments'));
const emptyStashPreview = emptyStashCtx.boundedHoldingsPreviewRunFromDashboard(stashPayload);
assert.equal(emptyStashPreview.ok, true, emptyStashPreview.error || 'Stash preview failed');
assert.match(String(emptyStashPreview.asOf || ''), /^2026-08-31/);
assert.equal(emptyStashPreview.reconciliation.ok, true);
assert.equal(emptyStashPreview.reconciliation.endingTotalValue, 7782.13);
assert.equal(emptyStashPreview.holdingsRows.filter((row) => row.symbol !== 'Cash').length, 7);
assert.equal(emptyStashPreview.holdingsRows.some((row) => row.symbol === 'ISPXZ'), false);
assert.deepEqual(cloneSheetRows(emptyStashBook.getSheetByName('INPUT - Investments')),
  emptyStashInvestmentsBefore, 'Stash preview must not write monthly investment values');

const emptyStashDiff = emptyStashCtx.boundedHoldingsPreviewBuildApplyDiffFromDashboard(stashPayload);
assert.equal(emptyStashDiff.ok, true);
assert.equal(emptyStashDiff.diff.monthlyInvestmentValue.comparison, 'BLANK');
assert.equal(emptyStashDiff.diff.monthlyInvestmentValue.decision, 'IGNORE');
assert.equal(emptyStashDiff.diff.monthlyInvestmentValue.action, 'SKIP');
assert.equal(emptyStashDiff.diff.monthlyInvestmentValue.proposedValue, 7782.13);
assert.equal(emptyStashDiff.diff.monthlyInvestmentValue.willWrite, false);
assert.equal(emptyStashDiff.diff.monthlyInvestmentValue.existingPresent, false);
assert.match(emptyStashDiff.diff.monthlyInvestmentValue.message, /August 2026/);
assert.equal(emptyStashDiff.diff.summary.createCount, 8);
assert.deepEqual(cloneSheetRows(emptyStashBook.getSheetByName('INPUT - Investments')),
  emptyStashInvestmentsBefore, 'Stash review must not write monthly investment values');

const otherMonthsBeforeStashIgnore = otherMonthValuesFromStashSheet(emptyStashBook);
const stashIgnoreApply = emptyStashCtx.boundedHoldingsPreviewApplyFromDashboard({
  ...stashPayload,
  diffDigest: emptyStashDiff.diffDigest,
  explicitApplyConfirm: true,
  monthlyInvestmentValueDecision: 'IGNORE'
});
assert.equal(stashIgnoreApply.ok, true, stashIgnoreApply.error || 'Stash Ignore Apply failed');
assert.notEqual(stashIgnoreApply.monthlyInvestmentValueWritten, true);
assert.equal(augustValueFromStashSheet(emptyStashBook), '');
assert.deepEqual(otherMonthValuesFromStashSheet(emptyStashBook), otherMonthsBeforeStashIgnore);
const stashIgnoreUnified = emptyStashBook.getSheetByName(unifiedName);
assert.ok(stashIgnoreUnified, 'Stash holdings Apply must create unified holdings');
assert.equal(stashIgnoreUnified.rows.filter((row, index) => index > 0).length, 8);
assert.equal(stashIgnoreUnified.rows.some((row) => /ISPXZ/i.test(String(row.join(' ')))), false);
const stashIgnoreLog = lastStatementMonthlyActivity_(emptyStashCtx);
assert.ok(stashIgnoreLog, 'Stash Ignore must write LOG - Activity');
assert.equal(stashIgnoreLog.eventType, 'investment_statement_monthly_value');
assert.equal(stashIgnoreLog.payee, 'Stash Account');
assert.equal(stashIgnoreLog.accountSource, 'Stash');
assert.equal(stashIgnoreLog.details.source, 'STASH_BROKERAGE_STATEMENT_PDF');
assert.equal(stashIgnoreLog.details.decision, 'IGNORE');
assert.equal(stashIgnoreLog.details.result, 'SKIPPED');
assert.equal(stashIgnoreLog.details.oldValue, '');
assert.equal(stashIgnoreLog.details.proposedValue, 7782.13);
assert.equal(stashIgnoreLog.details.targetMonth, 'August 2026');
assert.equal(stashIgnoreLog.details.statementAsOf, '2026-08-31');
assert.match(String(stashIgnoreLog.details.documentFingerprint || stashIgnoreLog.details.diffDigest || ''), /./);
assertNoSysInvestmentActivity_(emptyStashBook, 'Stash Ignore');

const addStash = makeStashWorkbook();
const addStashBuilt = buildContext({ workbook: addStash });
const stashAddDiff = addStashBuilt.context.boundedHoldingsPreviewBuildApplyDiffFromDashboard({
  ...stashPayload,
  monthlyInvestmentValueDecision: 'ADD'
});
assert.equal(stashAddDiff.diff.monthlyInvestmentValue.action, 'ADD');
assert.equal(stashAddDiff.diff.monthlyInvestmentValue.willWrite, true);
assert.equal(stashAddDiff.diff.monthlyInvestmentValue.decision, 'ADD');
assert.match(stashAddDiff.diff.monthlyInvestmentValue.message, /Add August 2026 value: \$7,782\.13/);
const stashMissingConfirm = addStashBuilt.context.boundedHoldingsPreviewApplyFromDashboard({
  ...stashPayload,
  diffDigest: stashAddDiff.diffDigest,
  monthlyInvestmentValueDecision: 'ADD'
});
assert.equal(stashMissingConfirm.ok, false);
assert.equal(statementMonthlyActivity_(addStashBuilt.context).length, 0);
assert.equal(augustValueFromStashSheet(addStash), '');

const otherMonthsBeforeStashAdd = otherMonthValuesFromStashSheet(addStash);
const stashAddApply = addStashBuilt.context.boundedHoldingsPreviewApplyFromDashboard({
  ...stashPayload,
  diffDigest: stashAddDiff.diffDigest,
  explicitApplyConfirm: true,
  monthlyInvestmentValueDecision: 'ADD'
});
assert.equal(stashAddApply.ok, true, stashAddApply.error || 'Stash Add Apply failed');
assert.equal(stashAddApply.monthlyInvestmentValueWritten, true);
assert.equal(augustValueFromStashSheet(addStash), 7782.13);
assert.deepEqual(otherMonthValuesFromStashSheet(addStash), otherMonthsBeforeStashAdd);
const stashAddUnified = addStash.getSheetByName(unifiedName);
assert.equal(stashAddUnified.rows.filter((row, index) => index > 0).length, 8);
assert.equal(stashAddUnified.rows.some((row) => /ISPXZ/i.test(String(row.join(' ')))), false);
const stashAddLog = lastStatementMonthlyActivity_(addStashBuilt.context);
assert.equal(stashAddLog.details.decision, 'ADD');
assert.equal(stashAddLog.details.result, 'APPLIED');
assert.equal(stashAddLog.details.oldValue, '');
assert.equal(stashAddLog.details.proposedValue, 7782.13);
assert.equal(stashAddLog.details.newValue, 7782.13);
assert.equal(stashAddLog.payee, 'Stash Account');
assert.equal(stashAddLog.accountSource, 'Stash');
assert.equal(
  (addStashBuilt.context.__activityLogEntries || []).filter((row) =>
    row.eventType === 'investment_update').length,
  0,
  'Stash statement Apply must not add a duplicate investment_update event'
);
assertNoSysInvestmentActivity_(addStash, 'Stash Add');

const stashMatchWorkbook = makeStashWorkbook({ augustValue: 7782.13 });
const stashMatchBuilt = buildContext({ workbook: stashMatchWorkbook });
const stashMatchDiff = stashMatchBuilt.context.boundedHoldingsPreviewBuildApplyDiffFromDashboard(stashPayload);
assert.equal(stashMatchDiff.diff.monthlyInvestmentValue.comparison, 'MATCH');
assert.equal(stashMatchDiff.diff.monthlyInvestmentValue.decision, 'KEEP');
assert.equal(stashMatchDiff.diff.monthlyInvestmentValue.action, 'SKIP');
assert.equal(stashMatchDiff.diff.monthlyInvestmentValue.willWrite, false);
assert.equal(stashMatchDiff.diff.monthlyInvestmentValue.message,
  'Already matches. Existing value will be kept.');
const stashMatchBefore = cloneSheetRows(stashMatchWorkbook.getSheetByName('INPUT - Investments'));
const stashMatchApply = stashMatchBuilt.context.boundedHoldingsPreviewApplyFromDashboard({
  ...stashPayload,
  diffDigest: stashMatchDiff.diffDigest,
  explicitApplyConfirm: true,
  monthlyInvestmentValueDecision: 'KEEP'
});
assert.equal(stashMatchApply.ok, true);
assert.notEqual(stashMatchApply.monthlyInvestmentValueWritten, true);
assert.deepEqual(cloneSheetRows(stashMatchWorkbook.getSheetByName('INPUT - Investments')), stashMatchBefore);
const stashMatchLog = lastStatementMonthlyActivity_(stashMatchBuilt.context);
assert.equal(stashMatchLog.details.decision, 'KEEP_EXISTING');
assert.equal(stashMatchLog.details.result, 'SKIPPED');
assert.equal(stashMatchLog.details.oldValue, 7782.13);
assertNoSysInvestmentActivity_(stashMatchWorkbook, 'Stash match');

const stashZeroWorkbook = makeStashWorkbook({ augustValue: 0 });
const stashZeroBuilt = buildContext({ workbook: stashZeroWorkbook });
const stashZeroDiff = stashZeroBuilt.context.boundedHoldingsPreviewBuildApplyDiffFromDashboard(stashPayload);
assert.equal(stashZeroDiff.diff.monthlyInvestmentValue.comparison, 'DIFFER');
assert.equal(stashZeroDiff.diff.monthlyInvestmentValue.existingPresent, true);
assert.equal(stashZeroDiff.diff.monthlyInvestmentValue.existingValue, 0);
assert.equal(stashZeroDiff.diff.monthlyInvestmentValue.willWrite, false);
const stashZeroBefore = cloneSheetRows(stashZeroWorkbook.getSheetByName('INPUT - Investments'));
const stashZeroApply = stashZeroBuilt.context.boundedHoldingsPreviewApplyFromDashboard({
  ...stashPayload,
  diffDigest: stashZeroDiff.diffDigest,
  explicitApplyConfirm: true,
  monthlyInvestmentValueDecision: 'KEEP'
});
assert.equal(stashZeroApply.ok, true);
assert.notEqual(stashZeroApply.monthlyInvestmentValueWritten, true);
assert.equal(augustValueFromStashSheet(stashZeroWorkbook), 0);
assert.deepEqual(cloneSheetRows(stashZeroWorkbook.getSheetByName('INPUT - Investments')), stashZeroBefore);
const stashZeroLog = lastStatementMonthlyActivity_(stashZeroBuilt.context);
assert.equal(stashZeroLog.details.decision, 'KEEP_EXISTING');
assert.equal(stashZeroLog.details.result, 'SKIPPED');
assert.equal(stashZeroLog.details.oldValue, 0);
assertNoSysInvestmentActivity_(stashZeroWorkbook, 'Stash explicit $0');

const stashOccupiedWorkbook = makeStashWorkbook({ augustValue: 50000 });
const stashOccupiedBuilt = buildContext({ workbook: stashOccupiedWorkbook });
const stashKeepDiff = stashOccupiedBuilt.context.boundedHoldingsPreviewBuildApplyDiffFromDashboard(stashPayload);
assert.equal(stashKeepDiff.diff.monthlyInvestmentValue.comparison, 'DIFFER');
assert.equal(stashKeepDiff.diff.monthlyInvestmentValue.decision, 'KEEP');
assert.equal(stashKeepDiff.diff.monthlyInvestmentValue.willWrite, false);
assert.equal(stashKeepDiff.diff.monthlyInvestmentValue.existingValue, 50000);
assert.equal(stashKeepDiff.diff.monthlyInvestmentValue.proposedValue, 7782.13);
const stashKeepApply = stashOccupiedBuilt.context.boundedHoldingsPreviewApplyFromDashboard({
  ...stashPayload,
  diffDigest: stashKeepDiff.diffDigest,
  explicitApplyConfirm: true,
  monthlyInvestmentValueDecision: 'KEEP'
});
assert.equal(stashKeepApply.ok, true);
assert.notEqual(stashKeepApply.monthlyInvestmentValueWritten, true);
assert.equal(augustValueFromStashSheet(stashOccupiedWorkbook), 50000);
const stashKeepLog = lastStatementMonthlyActivity_(stashOccupiedBuilt.context);
assert.equal(stashKeepLog.details.decision, 'KEEP_EXISTING');
assert.equal(stashKeepLog.details.result, 'SKIPPED');
assertNoSysInvestmentActivity_(stashOccupiedWorkbook, 'Stash Keep');

const stashReplaceWorkbook = makeStashWorkbook({ augustValue: 50000 });
const stashReplaceBuilt = buildContext({ workbook: stashReplaceWorkbook });
const stashReplaceDiff = stashReplaceBuilt.context.boundedHoldingsPreviewBuildApplyDiffFromDashboard({
  ...stashPayload,
  monthlyInvestmentValueDecision: 'REPLACE'
});
assert.equal(stashReplaceDiff.diff.monthlyInvestmentValue.action, 'REPLACE');
assert.equal(stashReplaceDiff.diff.monthlyInvestmentValue.willWrite, true);
assert.match(String(stashReplaceDiff.diff.monthlyInvestmentValue.message || ''),
  /Warning: the existing monthly value will be replaced/);
const stashReplaceApply = stashReplaceBuilt.context.boundedHoldingsPreviewApplyFromDashboard({
  ...stashPayload,
  diffDigest: stashReplaceDiff.diffDigest,
  explicitApplyConfirm: true,
  monthlyInvestmentValueDecision: 'REPLACE'
});
assert.equal(stashReplaceApply.ok, true, stashReplaceApply.error || 'Stash Replace Apply failed');
assert.equal(stashReplaceApply.monthlyInvestmentValueWritten, true);
assert.equal(augustValueFromStashSheet(stashReplaceWorkbook), 7782.13);
const stashReplaceLog = lastStatementMonthlyActivity_(stashReplaceBuilt.context);
assert.equal(stashReplaceLog.details.decision, 'REPLACE');
assert.equal(stashReplaceLog.details.result, 'APPLIED');
assert.equal(stashReplaceLog.details.oldValue, 50000);
assert.equal(stashReplaceLog.details.newValue, 7782.13);
assertNoSysInvestmentActivity_(stashReplaceWorkbook, 'Stash Replace');

const stashStaleWorkbook = makeStashWorkbook();
const stashStaleBuilt = buildContext({ workbook: stashStaleWorkbook });
const stashStaleDiff = stashStaleBuilt.context.boundedHoldingsPreviewBuildApplyDiffFromDashboard({
  ...stashPayload,
  monthlyInvestmentValueDecision: 'ADD'
});
assert.equal(stashStaleDiff.diff.monthlyInvestmentValue.action, 'ADD');
assert.equal(stashStaleDiff.diff.monthlyInvestmentValue.existingPresent, false);
stashStaleWorkbook.getSheetByName('INPUT - Investments').getRange(3, 10).setValue(1);
const stashStaleApply = stashStaleBuilt.context.boundedHoldingsPreviewApplyFromDashboard({
  ...stashPayload,
  diffDigest: stashStaleDiff.diffDigest,
  explicitApplyConfirm: true,
  monthlyInvestmentValueDecision: 'ADD'
});
assert.equal(stashStaleApply.ok, false);
assert.equal(stashStaleApply.staleDiff, true);
assert.equal(augustValueFromStashSheet(stashStaleWorkbook), 1);
assert.equal(stashStaleWorkbook.getSheetByName(unifiedName), null,
  'stale Stash monthly digest must fail closed before holdings write');
const stashStaleLog = lastStatementMonthlyActivity_(stashStaleBuilt.context);
assert.equal(stashStaleLog.details.result, 'STALE_REJECTED');
assert.notEqual(stashStaleLog.details.result, 'APPLIED');
assertNoSysInvestmentActivity_(stashStaleWorkbook, 'Stash stale');

function makeEtradeFutureWorkbook(options = {}) {
  const augustValue = Object.prototype.hasOwnProperty.call(options, 'augustValue')
    ? options.augustValue
    : '';
  const months = Array(12).fill('');
  months[7] = augustValue;
  return makeWorkbook({
    assetsRows: [
      ['Etrade Cisco - Future', 'Brokerage', '', 'Yes', 'INV-ET-FUTURE-1', ''],
      ['Etrade Cisco - RSU/ESPP', 'Brokerage', '', 'Yes', 'INV-ET-RSU-1', '']
    ],
    investmentsRows: buildInvestmentsYearBlockRows(2026, [{
      name: 'Etrade Cisco - Future',
      investmentId: 'INV-ET-FUTURE-1',
      months
    }, {
      name: 'Etrade Cisco - RSU/ESPP',
      investmentId: 'INV-ET-RSU-1',
      months: Array(12).fill('')
    }]),
    monthlyRows: [monthlyHistoryHeaders],
    registryRows: [
      FINANCIAL_ACCOUNT_HEADERS,
      registryRow({
        stableAccountId: 'STABLE-ET-FUTURE-1',
        domain: 'INVESTMENT',
        displayName: 'Etrade Cisco - Future',
        institution: 'E*TRADE',
        accountType: 'Brokerage',
        accountSubtype: '',
        ownerId: 'OWNER-1',
        registrationType: 'TAXABLE',
        currency: 'USD',
        last4: '',
        active: 'Yes',
        identityStatus: 'VERIFIED',
        legacyDomain: 'SYS_ASSETS',
        legacyKey: 'INV-ET-FUTURE-1'
      }),
      registryRow({
        stableAccountId: 'STABLE-ET-RSU-1',
        domain: 'INVESTMENT',
        displayName: 'Etrade Cisco - RSU/ESPP',
        institution: 'E*TRADE',
        accountType: 'Brokerage',
        accountSubtype: '',
        ownerId: 'OWNER-1',
        registrationType: 'TAXABLE',
        currency: 'USD',
        last4: '',
        active: 'Yes',
        identityStatus: 'VERIFIED',
        legacyDomain: 'SYS_ASSETS',
        legacyKey: 'INV-ET-RSU-1'
      })
    ]
  });
}

function augustValueFromFutureSheet(ss) {
  return ss.getSheetByName('INPUT - Investments').getRange(3, 10).getValue();
}

function rsuAugustValueFromFutureSheet(ss) {
  return ss.getSheetByName('INPUT - Investments').getRange(4, 10).getValue();
}

function otherMonthValuesFromFutureSheet(ss) {
  const sheet = ss.getSheetByName('INPUT - Investments');
  return [3, 4, 5, 6, 7, 8, 9, 11, 12, 13, 14].map((col) => sheet.getRange(3, col).getValue());
}

const futureText = fixture('etrade', 'synthetic_etrade_client_statement_cisco_future_potential.txt');
const futurePayload = {
  pickerValue: 'INV-ET-FUTURE-1',
  accountName: 'Etrade Cisco - Future',
  sysAssetsRow: 2,
  source: 'ETRADE_CLIENT_STATEMENT_PDF',
  rawDocumentText: futureText,
  registrationType: 'TAXABLE',
  explicitAccountMatch: true,
  statementProvider: 'ETRADE'
};

const futureParsed = emptySchwabCtx.investmentEtradeClientStatementParseText_(futureText);
assert.equal(futureParsed.potentialUnvestedStockPlan.value, 846353.40);
assert.equal(futureParsed.preamble.endingTotalValue, 113042.10);
assert.equal(
  emptySchwabCtx.boundedHoldingsPreviewApplyBuildProposedRowsFromPreview_(
    {
      source: 'ETRADE_CLIENT_STATEMENT_PDF',
      parentAccountName: 'Etrade Cisco - Future'
    },
    {
      source: 'ETRADE_CLIENT_STATEMENT_PDF',
      valueCategory: 'POTENTIAL_UNVESTED_STOCK_PLAN',
      asOf: '2026-08-31',
      potentialUnvestedStockPlanValue: 846353.40,
      holdingsRows: [{ symbol: 'CSCO', quantity: 1023.098, marketValue: 51154.90 }],
      cashBalance: 61887.20
    }
  ).length,
  0,
  'Future potential Apply must never propose holdings or cash rows'
);

const futureEnding = emptySchwabCtx.boundedHoldingsPreviewApplyResolveProviderEndingTotal_(
  {
    potentialUnvestedStockPlanValue: 846353.40,
    reconciliation: { ok: true, endingTotalValue: 113042.10 },
    totalAccountValue: 113042.10,
    holdingsRows: [{ marketValue: 51154.90 }]
  },
  'ETRADE_CLIENT_STATEMENT_PDF'
);
assert.equal(futureEnding.value, 846353.40);
assert.equal(futureEnding.origin, 'POTENTIAL_UNVESTED_STOCK_PLAN');
assert.notEqual(futureEnding.value, 113042.10);

const skipFutureConfirm = emptySchwabCtx.boundedHoldingsPreviewApplyBuildMonthlyInvestmentValueProposal_(
  {
    source: 'ETRADE_CLIENT_STATEMENT_PDF',
    accountName: 'Etrade Cisco - Future',
    explicitAccountMatch: false
  },
  'SINGLE_ACCOUNT',
  { accountName: 'Etrade Cisco - Future', investmentId: 'INV-ET-FUTURE-1' },
  { asOf: '2026-08-31', potentialUnvestedStockPlanValue: 846353.40 }
);
assert.equal(skipFutureConfirm.action, 'SKIP');
assert.equal(skipFutureConfirm.reason, 'EXPLICIT_MATCH_REQUIRED');

const rsuSkipMonthly = emptySchwabCtx.boundedHoldingsPreviewApplyBuildMonthlyInvestmentValueProposal_(
  {
    source: 'ETRADE_CLIENT_STATEMENT_PDF',
    accountName: 'Etrade Cisco - RSU/ESPP',
    explicitAccountMatch: true
  },
  'SINGLE_ACCOUNT',
  { accountName: 'Etrade Cisco - RSU/ESPP', investmentId: 'INV-ET-RSU-1' },
  {
    asOf: '2026-08-31',
    potentialUnvestedStockPlanValue: 846353.40,
    reconciliation: { ok: true, endingTotalValue: 113042.10 }
  }
);
assert.equal(rsuSkipMonthly.action, 'SKIP');
assert.equal(rsuSkipMonthly.reason, 'UNSUPPORTED_SOURCE');

const emptyFuture = makeEtradeFutureWorkbook();
const emptyFutureBuilt = buildContext({ workbook: emptyFuture });
const emptyFutureDiff = emptyFutureBuilt.context.boundedHoldingsPreviewBuildApplyDiffFromDashboard(
  futurePayload);
assert.equal(emptyFutureDiff.ok, true, emptyFutureDiff.error || 'Future diff failed');
assert.equal(emptyFutureDiff.diff.monthlyInvestmentValue.comparison, 'BLANK');
assert.equal(emptyFutureDiff.diff.monthlyInvestmentValue.decision, 'IGNORE');
assert.equal(emptyFutureDiff.diff.monthlyInvestmentValue.action, 'SKIP');
assert.equal(emptyFutureDiff.diff.monthlyInvestmentValue.proposedValue, 846353.40);
assert.equal(emptyFutureDiff.diff.monthlyInvestmentValue.willWrite, false);
assert.equal(emptyFutureDiff.diff.monthlyInvestmentValue.existingPresent, false);
assert.equal(emptyFutureDiff.diff.monthlyInvestmentValue.valueCategory, 'POTENTIAL_UNVESTED_STOCK_PLAN');
assert.equal(emptyFutureDiff.diff.monthlyInvestmentValue.valueLabel,
  'Potential/unvested stock-plan value');
assert.equal(emptyFutureDiff.diff.monthlyInvestmentValue.accountName, 'Etrade Cisco - Future');
assert.match(String(emptyFutureDiff.diff.monthlyInvestmentValue.asOfDate || ''), /^2026-08-31/);
assert.match(String(emptyFutureDiff.diff.monthlyInvestmentValue.warning || ''),
  /This value is not vested and is not current brokerage holdings\./);
assert.notEqual(emptyFutureDiff.diff.monthlyInvestmentValue.proposedValue, 113042.10);
assert.equal(emptyFutureDiff.diff.summary.createCount, 0);
assert.equal((emptyFutureDiff.diff.create || []).length, 0);

const futureIgnoreApply = emptyFutureBuilt.context.boundedHoldingsPreviewApplyFromDashboard({
  ...futurePayload,
  diffDigest: emptyFutureDiff.diffDigest,
  explicitApplyConfirm: true,
  monthlyInvestmentValueDecision: 'IGNORE'
});
assert.equal(futureIgnoreApply.ok, true, futureIgnoreApply.error || 'Future Ignore Apply failed');
assert.notEqual(futureIgnoreApply.monthlyInvestmentValueWritten, true);
assert.equal(augustValueFromFutureSheet(emptyFuture), '');
assert.equal(rsuAugustValueFromFutureSheet(emptyFuture), '');
assert.equal(emptyFuture.getSheetByName(unifiedName), null,
  'Future Ignore must not write SYS - Investment Holdings Unified');
const futureIgnoreLog = lastStatementMonthlyActivity_(emptyFutureBuilt.context);
assert.ok(futureIgnoreLog, 'Future Ignore must write LOG - Activity');
assert.equal(futureIgnoreLog.eventType, 'investment_statement_monthly_value');
assert.equal(futureIgnoreLog.payee, 'Etrade Cisco - Future');
assert.equal(futureIgnoreLog.accountSource, 'E*TRADE');
assert.equal(futureIgnoreLog.details.source, 'ETRADE_CLIENT_STATEMENT_PDF');
assert.equal(futureIgnoreLog.details.decision, 'IGNORE');
assert.equal(futureIgnoreLog.details.result, 'SKIPPED');
assert.equal(futureIgnoreLog.details.oldValue, '');
assert.equal(futureIgnoreLog.details.proposedValue, 846353.40);
assert.equal(futureIgnoreLog.details.valueCategory, 'POTENTIAL_UNVESTED_STOCK_PLAN');
assert.equal(futureIgnoreLog.details.targetMonth, 'August 2026');
assert.match(String(futureIgnoreLog.details.statementAsOf || ''), /^2026-08-31/);
assert.match(String(futureIgnoreLog.details.documentFingerprint || futureIgnoreLog.details.diffDigest || ''), /./);
assertNoSysInvestmentActivity_(emptyFuture, 'Future Ignore');

const addFuture = makeEtradeFutureWorkbook();
const addFutureBuilt = buildContext({ workbook: addFuture });
const futureAddDiff = addFutureBuilt.context.boundedHoldingsPreviewBuildApplyDiffFromDashboard({
  ...futurePayload,
  monthlyInvestmentValueDecision: 'ADD'
});
assert.equal(futureAddDiff.diff.monthlyInvestmentValue.action, 'ADD');
assert.equal(futureAddDiff.diff.monthlyInvestmentValue.willWrite, true);
assert.equal(futureAddDiff.diff.monthlyInvestmentValue.decision, 'ADD');
assert.equal(futureAddDiff.diff.monthlyInvestmentValue.proposedValue, 846353.40);
assert.match(futureAddDiff.diff.monthlyInvestmentValue.message,
  /Add August 2026 value: \$846,353\.40/);
const futureMissingConfirm = addFutureBuilt.context.boundedHoldingsPreviewApplyFromDashboard({
  ...futurePayload,
  diffDigest: futureAddDiff.diffDigest,
  monthlyInvestmentValueDecision: 'ADD'
});
assert.equal(futureMissingConfirm.ok, false);
assert.equal(statementMonthlyActivity_(addFutureBuilt.context).length, 0);
assert.equal(augustValueFromFutureSheet(addFuture), '');
assert.equal(addFuture.getSheetByName(unifiedName), null);

const futureMonthsBeforeAdd = otherMonthValuesFromFutureSheet(addFuture);
const futureAddApply = addFutureBuilt.context.boundedHoldingsPreviewApplyFromDashboard({
  ...futurePayload,
  diffDigest: futureAddDiff.diffDigest,
  explicitApplyConfirm: true,
  monthlyInvestmentValueDecision: 'ADD'
});
assert.equal(futureAddApply.ok, true, futureAddApply.error || 'Future Add Apply failed');
assert.equal(futureAddApply.monthlyInvestmentValueWritten, true);
assert.equal(augustValueFromFutureSheet(addFuture), 846353.40);
assert.equal(rsuAugustValueFromFutureSheet(addFuture), '',
  'Actual brokerage $113,042.10 must not be assigned to Etrade Cisco - RSU/ESPP');
assert.deepEqual(otherMonthValuesFromFutureSheet(addFuture), futureMonthsBeforeAdd,
  'Future Add must write only the statement month');
assert.equal(addFuture.getSheetByName(unifiedName), null,
  'Future Add must not write SYS - Investment Holdings Unified');
const futureAddLog = lastStatementMonthlyActivity_(addFutureBuilt.context);
assert.equal(futureAddLog.details.decision, 'ADD');
assert.equal(futureAddLog.details.result, 'APPLIED');
assert.equal(futureAddLog.details.oldValue, '');
assert.equal(futureAddLog.details.proposedValue, 846353.40);
assert.equal(futureAddLog.details.newValue, 846353.40);
assert.equal(futureAddLog.details.valueCategory, 'POTENTIAL_UNVESTED_STOCK_PLAN');
assert.equal(futureAddLog.payee, 'Etrade Cisco - Future');
assert.equal(futureAddLog.accountSource, 'E*TRADE');
assert.equal(
  (addFutureBuilt.context.__activityLogEntries || []).filter((row) =>
    row.eventType === 'investment_update').length,
  0,
  'Future statement Apply must not add a duplicate investment_update event'
);
assertNoSysInvestmentActivity_(addFuture, 'Future Add');

const futureMatchWorkbook = makeEtradeFutureWorkbook({ augustValue: 846353.40 });
const futureMatchBuilt = buildContext({ workbook: futureMatchWorkbook });
const futureMatchDiff = futureMatchBuilt.context.boundedHoldingsPreviewBuildApplyDiffFromDashboard(
  futurePayload);
assert.equal(futureMatchDiff.diff.monthlyInvestmentValue.comparison, 'MATCH');
assert.equal(futureMatchDiff.diff.monthlyInvestmentValue.decision, 'KEEP');
assert.equal(futureMatchDiff.diff.monthlyInvestmentValue.action, 'SKIP');
assert.equal(futureMatchDiff.diff.monthlyInvestmentValue.willWrite, false);
assert.equal(futureMatchDiff.diff.monthlyInvestmentValue.message,
  'Already matches. Existing value will be kept.');
const futureMatchBefore = cloneSheetRows(futureMatchWorkbook.getSheetByName('INPUT - Investments'));
const futureMatchApply = futureMatchBuilt.context.boundedHoldingsPreviewApplyFromDashboard({
  ...futurePayload,
  diffDigest: futureMatchDiff.diffDigest,
  explicitApplyConfirm: true,
  monthlyInvestmentValueDecision: 'KEEP'
});
assert.equal(futureMatchApply.ok, true);
assert.notEqual(futureMatchApply.monthlyInvestmentValueWritten, true);
assert.deepEqual(cloneSheetRows(futureMatchWorkbook.getSheetByName('INPUT - Investments')),
  futureMatchBefore);
assert.equal(futureMatchWorkbook.getSheetByName(unifiedName), null);
const futureMatchLog = lastStatementMonthlyActivity_(futureMatchBuilt.context);
assert.equal(futureMatchLog.details.decision, 'KEEP_EXISTING');
assert.equal(futureMatchLog.details.result, 'SKIPPED');
assert.equal(futureMatchLog.details.oldValue, 846353.40);
assert.equal(futureMatchLog.details.valueCategory, 'POTENTIAL_UNVESTED_STOCK_PLAN');
assertNoSysInvestmentActivity_(futureMatchWorkbook, 'Future match');

const occupiedFuture = makeEtradeFutureWorkbook({ augustValue: 50000 });
const occupiedFutureBuilt = buildContext({ workbook: occupiedFuture });
const occupiedFutureDiff = occupiedFutureBuilt.context
  .boundedHoldingsPreviewBuildApplyDiffFromDashboard(futurePayload);
assert.equal(occupiedFutureDiff.diff.monthlyInvestmentValue.comparison, 'DIFFER');
assert.equal(occupiedFutureDiff.diff.monthlyInvestmentValue.decision, 'KEEP');
assert.equal(occupiedFutureDiff.diff.monthlyInvestmentValue.action, 'SKIP');
assert.equal(occupiedFutureDiff.diff.monthlyInvestmentValue.willWrite, false);
assert.equal(occupiedFutureDiff.diff.monthlyInvestmentValue.existingValue, 50000);
assert.equal(occupiedFutureDiff.diff.monthlyInvestmentValue.proposedValue, 846353.40);
assert.match(occupiedFutureDiff.diff.monthlyInvestmentValue.message,
  /Existing value will remain unchanged unless Replace is selected\./);
assert.doesNotMatch(String(occupiedFutureDiff.diff.monthlyInvestmentValue.message || ''),
  /will be replaced/);
assert.doesNotMatch(String(occupiedFutureDiff.diff.monthlyInvestmentValue.warning || ''),
  /will be replaced/);
const occupiedFutureBefore = cloneSheetRows(occupiedFuture.getSheetByName('INPUT - Investments'));
const occupiedFutureApply = occupiedFutureBuilt.context.boundedHoldingsPreviewApplyFromDashboard({
  ...futurePayload,
  diffDigest: occupiedFutureDiff.diffDigest,
  explicitApplyConfirm: true,
  monthlyInvestmentValueDecision: 'KEEP'
});
assert.equal(occupiedFutureApply.ok, true);
assert.notEqual(occupiedFutureApply.monthlyInvestmentValueWritten, true);
assert.equal(augustValueFromFutureSheet(occupiedFuture), 50000);
assert.deepEqual(cloneSheetRows(occupiedFuture.getSheetByName('INPUT - Investments')),
  occupiedFutureBefore, 'occupied month Keep existing must not overwrite');
assert.equal(occupiedFuture.getSheetByName(unifiedName), null);
const futureKeepLog = lastStatementMonthlyActivity_(occupiedFutureBuilt.context);
assert.equal(futureKeepLog.details.decision, 'KEEP_EXISTING');
assert.equal(futureKeepLog.details.result, 'SKIPPED');
assert.equal(futureKeepLog.details.oldValue, 50000);

const futureReplaceBook = makeEtradeFutureWorkbook({ augustValue: 50000 });
const futureReplaceBuilt = buildContext({ workbook: futureReplaceBook });
const futureReplaceDiff = futureReplaceBuilt.context
  .boundedHoldingsPreviewBuildApplyDiffFromDashboard({
    ...futurePayload,
    monthlyInvestmentValueDecision: 'REPLACE'
  });
assert.equal(futureReplaceDiff.diff.monthlyInvestmentValue.action, 'REPLACE');
assert.equal(futureReplaceDiff.diff.monthlyInvestmentValue.willWrite, true);
assert.match(String(futureReplaceDiff.diff.monthlyInvestmentValue.warning || ''),
  /This value is not vested and is not current brokerage holdings\./);
assert.match(String(futureReplaceDiff.diff.monthlyInvestmentValue.message || ''),
  /Warning: the existing monthly value will be replaced/);
const futureReplaceApply = futureReplaceBuilt.context.boundedHoldingsPreviewApplyFromDashboard({
  ...futurePayload,
  diffDigest: futureReplaceDiff.diffDigest,
  explicitApplyConfirm: true,
  monthlyInvestmentValueDecision: 'REPLACE'
});
assert.equal(futureReplaceApply.ok, true);
assert.equal(futureReplaceApply.monthlyInvestmentValueWritten, true);
assert.equal(augustValueFromFutureSheet(futureReplaceBook), 846353.40);
assert.equal(rsuAugustValueFromFutureSheet(futureReplaceBook), '');
assert.equal(futureReplaceBook.getSheetByName(unifiedName), null);
const futureReplaceLog = lastStatementMonthlyActivity_(futureReplaceBuilt.context);
assert.equal(futureReplaceLog.details.decision, 'REPLACE');
assert.equal(futureReplaceLog.details.result, 'APPLIED');
assert.equal(futureReplaceLog.details.oldValue, 50000);
assert.equal(futureReplaceLog.details.newValue, 846353.40);
assert.equal(futureReplaceLog.details.valueCategory, 'POTENTIAL_UNVESTED_STOCK_PLAN');
assertNoSysInvestmentActivity_(futureReplaceBook, 'Future Replace');

const zeroFuture = makeEtradeFutureWorkbook({ augustValue: 0 });
const zeroFutureBuilt = buildContext({ workbook: zeroFuture });
const zeroFutureDiff = zeroFutureBuilt.context.boundedHoldingsPreviewBuildApplyDiffFromDashboard(
  futurePayload);
assert.equal(zeroFutureDiff.diff.monthlyInvestmentValue.comparison, 'DIFFER');
assert.equal(zeroFutureDiff.diff.monthlyInvestmentValue.existingPresent, true);
assert.equal(zeroFutureDiff.diff.monthlyInvestmentValue.existingValue, 0);
assert.equal(zeroFutureDiff.diff.monthlyInvestmentValue.willWrite, false);
const zeroFutureBefore = cloneSheetRows(zeroFuture.getSheetByName('INPUT - Investments'));
const zeroFutureApply = zeroFutureBuilt.context.boundedHoldingsPreviewApplyFromDashboard({
  ...futurePayload,
  diffDigest: zeroFutureDiff.diffDigest,
  explicitApplyConfirm: true,
  monthlyInvestmentValueDecision: 'KEEP'
});
assert.equal(zeroFutureApply.ok, true);
assert.notEqual(zeroFutureApply.monthlyInvestmentValueWritten, true);
assert.equal(augustValueFromFutureSheet(zeroFuture), 0);
assert.deepEqual(cloneSheetRows(zeroFuture.getSheetByName('INPUT - Investments')),
  zeroFutureBefore, 'explicit $0 is occupied and must not be overwritten');
const futureZeroLog = lastStatementMonthlyActivity_(zeroFutureBuilt.context);
assert.equal(futureZeroLog.details.oldValue, 0);
assert.equal(futureZeroLog.details.result, 'SKIPPED');
assert.equal(zeroFuture.getSheetByName(unifiedName), null);

const staleFuture = makeEtradeFutureWorkbook();
const staleFutureBuilt = buildContext({ workbook: staleFuture });
const staleFutureDiff = staleFutureBuilt.context
  .boundedHoldingsPreviewBuildApplyDiffFromDashboard({
    ...futurePayload,
    monthlyInvestmentValueDecision: 'ADD'
  });
assert.equal(staleFutureDiff.diff.monthlyInvestmentValue.action, 'ADD');
staleFuture.getSheetByName('INPUT - Investments').getRange(3, 10).setValue(1);
const staleFutureApply = staleFutureBuilt.context.boundedHoldingsPreviewApplyFromDashboard({
  ...futurePayload,
  diffDigest: staleFutureDiff.diffDigest,
  explicitApplyConfirm: true,
  monthlyInvestmentValueDecision: 'ADD'
});
assert.equal(staleFutureApply.ok, false);
assert.equal(staleFutureApply.staleDiff, true);
assert.equal(augustValueFromFutureSheet(staleFuture), 1);
assert.equal(staleFuture.getSheetByName(unifiedName), null);
const futureStaleLog = lastStatementMonthlyActivity_(staleFutureBuilt.context);
assert.equal(futureStaleLog.details.result, 'STALE_REJECTED');
assert.notEqual(futureStaleLog.details.result, 'APPLIED');
assertNoSysInvestmentActivity_(staleFuture, 'Future stale');

const ciscoProfilePayload = {
  pickerValue: '__profile__:ETRADE_CISCO_STATEMENT',
  accountName: '',
  source: 'ETRADE_CLIENT_STATEMENT_PDF',
  rawDocumentText: futureText,
  registrationType: 'TAXABLE',
  explicitAccountMatch: true,
  statementProvider: 'ETRADE'
};

function monthlyByAccount_(diff, accountName) {
  const values = (diff && diff.diff && diff.diff.monthlyInvestmentValues) || [];
  return values.find((item) => item && item.accountName === accountName) || null;
}

const emptyCisco = makeEtradeFutureWorkbook();
const emptyCiscoBuilt = buildContext({ workbook: emptyCisco });
const emptyCiscoDiff = emptyCiscoBuilt.context.boundedHoldingsPreviewBuildApplyDiffFromDashboard(
  ciscoProfilePayload);
assert.equal(emptyCiscoDiff.ok, true, emptyCiscoDiff.error || 'Cisco profile diff failed');
assert.equal((emptyCiscoDiff.diff.monthlyInvestmentValues || []).length, 2);
const emptyRsuMonthly = monthlyByAccount_(emptyCiscoDiff, 'Etrade Cisco - RSU/ESPP');
const emptyFutureMonthly = monthlyByAccount_(emptyCiscoDiff, 'Etrade Cisco - Future');
assert.ok(emptyRsuMonthly);
assert.ok(emptyFutureMonthly);
assert.equal(emptyRsuMonthly.proposedValue, 113042.10);
assert.equal(emptyRsuMonthly.valueCategory, 'BROKERAGE_ACCOUNT_VALUE');
assert.equal(emptyRsuMonthly.comparison, 'BLANK');
assert.equal(emptyRsuMonthly.decision, 'IGNORE');
assert.equal(emptyFutureMonthly.proposedValue, 846353.40);
assert.equal(emptyFutureMonthly.valueCategory, 'POTENTIAL_UNVESTED_STOCK_PLAN');
assert.equal(emptyFutureMonthly.comparison, 'BLANK');
assert.doesNotMatch(String(emptyRsuMonthly.message || ''),
  /replaced|remain unchanged unless Replace/);
assert.doesNotMatch(String(emptyFutureMonthly.message || ''),
  /replaced|remain unchanged unless Replace/);
assert.doesNotMatch(String(emptyRsuMonthly.warning || ''),
  /replaced|remain unchanged unless Replace/);
assert.doesNotMatch(String(emptyFutureMonthly.warning || ''),
  /will be replaced/);
assert.equal(emptyCiscoDiff.diff.summary.createCount, 0);
assert.equal(
  JSON.stringify(emptyCiscoDiff).includes('Etrade Cisco - RSU/ESPP + Future'),
  false,
  'combined backend account name must not appear in the Cisco profile diff'
);

const ciscoIgnoreApply = emptyCiscoBuilt.context.boundedHoldingsPreviewApplyFromDashboard({
  ...ciscoProfilePayload,
  diffDigest: emptyCiscoDiff.diffDigest,
  explicitApplyConfirm: true,
  monthlyInvestmentValueDecisions: {
    'Etrade Cisco - RSU/ESPP': 'IGNORE',
    'Etrade Cisco - Future': 'IGNORE'
  }
});
assert.equal(ciscoIgnoreApply.ok, true, ciscoIgnoreApply.error || 'Cisco Ignore Apply failed');
assert.notEqual(ciscoIgnoreApply.monthlyInvestmentValueWritten, true);
assert.equal(augustValueFromFutureSheet(emptyCisco), '');
assert.equal(rsuAugustValueFromFutureSheet(emptyCisco), '');
assert.equal(emptyCisco.getSheetByName(unifiedName), null);
const ciscoIgnoreLogs = statementMonthlyActivity_(emptyCiscoBuilt.context);
assert.equal(ciscoIgnoreLogs.length, 2);
assert.deepEqual(ciscoIgnoreLogs.map((row) => row.payee).sort(),
  ['Etrade Cisco - Future', 'Etrade Cisco - RSU/ESPP']);
ciscoIgnoreLogs.forEach((row) => {
  assert.equal(row.eventType, 'investment_statement_monthly_value');
  assert.equal(row.details.decision, 'IGNORE');
  assert.equal(row.details.result, 'SKIPPED');
  assert.notEqual(row.payee, 'Etrade Cisco - RSU/ESPP + Future');
});
assertNoSysInvestmentActivity_(emptyCisco, 'Cisco Ignore');

const addCisco = makeEtradeFutureWorkbook();
const addCiscoBuilt = buildContext({ workbook: addCisco });
const ciscoAddDiff = addCiscoBuilt.context.boundedHoldingsPreviewBuildApplyDiffFromDashboard({
  ...ciscoProfilePayload,
  monthlyInvestmentValueDecisions: {
    'Etrade Cisco - RSU/ESPP': 'ADD',
    'Etrade Cisco - Future': 'ADD'
  }
});
assert.equal(monthlyByAccount_(ciscoAddDiff, 'Etrade Cisco - RSU/ESPP').action, 'ADD');
assert.equal(monthlyByAccount_(ciscoAddDiff, 'Etrade Cisco - Future').action, 'ADD');
const ciscoMissingConfirm = addCiscoBuilt.context.boundedHoldingsPreviewApplyFromDashboard({
  ...ciscoProfilePayload,
  diffDigest: ciscoAddDiff.diffDigest,
  monthlyInvestmentValueDecisions: {
    'Etrade Cisco - RSU/ESPP': 'ADD',
    'Etrade Cisco - Future': 'ADD'
  }
});
assert.equal(ciscoMissingConfirm.ok, false);
assert.equal(statementMonthlyActivity_(addCiscoBuilt.context).length, 0);
const ciscoAddApply = addCiscoBuilt.context.boundedHoldingsPreviewApplyFromDashboard({
  ...ciscoProfilePayload,
  diffDigest: ciscoAddDiff.diffDigest,
  explicitApplyConfirm: true,
  monthlyInvestmentValueDecisions: {
    'Etrade Cisco - RSU/ESPP': 'ADD',
    'Etrade Cisco - Future': 'ADD'
  }
});
assert.equal(ciscoAddApply.ok, true, ciscoAddApply.error || 'Cisco dual Add Apply failed');
assert.equal(ciscoAddApply.monthlyInvestmentValueWritten, true);
assert.equal(rsuAugustValueFromFutureSheet(addCisco), 113042.10);
assert.equal(augustValueFromFutureSheet(addCisco), 846353.40);
assert.equal(addCisco.getSheetByName(unifiedName), null);
const ciscoAddLogs = statementMonthlyActivity_(addCiscoBuilt.context);
assert.equal(ciscoAddLogs.length, 2);
assert.deepEqual(ciscoAddLogs.map((row) => row.payee).sort(),
  ['Etrade Cisco - Future', 'Etrade Cisco - RSU/ESPP']);
const rsuAddLog = ciscoAddLogs.find((row) => row.payee === 'Etrade Cisco - RSU/ESPP');
const futureAddFromProfileLog = ciscoAddLogs.find((row) => row.payee === 'Etrade Cisco - Future');
assert.equal(rsuAddLog.details.proposedValue, 113042.10);
assert.equal(rsuAddLog.details.valueCategory, 'BROKERAGE_ACCOUNT_VALUE');
assert.equal(rsuAddLog.details.result, 'APPLIED');
assert.equal(futureAddFromProfileLog.details.proposedValue, 846353.40);
assert.equal(futureAddFromProfileLog.details.valueCategory, 'POTENTIAL_UNVESTED_STOCK_PLAN');
assert.equal(futureAddFromProfileLog.details.result, 'APPLIED');
assert.equal(
  (addCiscoBuilt.context.__activityLogEntries || []).filter((row) =>
    row.eventType === 'investment_update').length,
  0
);
assertNoSysInvestmentActivity_(addCisco, 'Cisco dual Add');

const splitCisco = makeEtradeFutureWorkbook();
const splitCiscoBuilt = buildContext({ workbook: splitCisco });
const splitCiscoDiff = splitCiscoBuilt.context.boundedHoldingsPreviewBuildApplyDiffFromDashboard({
  ...ciscoProfilePayload,
  monthlyInvestmentValueDecisions: {
    'Etrade Cisco - RSU/ESPP': 'ADD',
    'Etrade Cisco - Future': 'IGNORE'
  }
});
assert.equal(monthlyByAccount_(splitCiscoDiff, 'Etrade Cisco - RSU/ESPP').willWrite, true);
assert.equal(monthlyByAccount_(splitCiscoDiff, 'Etrade Cisco - Future').willWrite, false);
const splitCiscoApply = splitCiscoBuilt.context.boundedHoldingsPreviewApplyFromDashboard({
  ...ciscoProfilePayload,
  diffDigest: splitCiscoDiff.diffDigest,
  explicitApplyConfirm: true,
  monthlyInvestmentValueDecisions: {
    'Etrade Cisco - RSU/ESPP': 'ADD',
    'Etrade Cisco - Future': 'IGNORE'
  }
});
assert.equal(splitCiscoApply.ok, true, splitCiscoApply.error || 'independent Cisco decisions failed');
assert.equal(rsuAugustValueFromFutureSheet(splitCisco), 113042.10);
assert.equal(augustValueFromFutureSheet(splitCisco), '');
const splitLogs = statementMonthlyActivity_(splitCiscoBuilt.context);
assert.equal(splitLogs.find((row) => row.payee === 'Etrade Cisco - RSU/ESPP').details.result, 'APPLIED');
assert.equal(splitLogs.find((row) => row.payee === 'Etrade Cisco - Future').details.result, 'SKIPPED');

const matchCisco = makeEtradeFutureWorkbook({ augustValue: 846353.40 });
matchCisco.getSheetByName('INPUT - Investments').getRange(4, 10).setValue(113042.10);
const matchCiscoBuilt = buildContext({ workbook: matchCisco });
const matchCiscoDiff = matchCiscoBuilt.context.boundedHoldingsPreviewBuildApplyDiffFromDashboard(
  ciscoProfilePayload);
assert.equal(monthlyByAccount_(matchCiscoDiff, 'Etrade Cisco - RSU/ESPP').message,
  'Already matches. Existing value will be kept.');
assert.equal(monthlyByAccount_(matchCiscoDiff, 'Etrade Cisco - Future').message,
  'Already matches. Existing value will be kept.');

const differCisco = makeEtradeFutureWorkbook({ augustValue: 50000 });
differCisco.getSheetByName('INPUT - Investments').getRange(4, 10).setValue(40000);
const differCiscoKeepBuilt = buildContext({ workbook: differCisco });
const differCiscoKeepDiff = differCiscoKeepBuilt.context
  .boundedHoldingsPreviewBuildApplyDiffFromDashboard(ciscoProfilePayload);
const keepRsu = monthlyByAccount_(differCiscoKeepDiff, 'Etrade Cisco - RSU/ESPP');
const keepFuture = monthlyByAccount_(differCiscoKeepDiff, 'Etrade Cisco - Future');
assert.equal(keepRsu.decision, 'KEEP');
assert.equal(keepFuture.decision, 'KEEP');
assert.match(keepRsu.message, /Existing value will remain unchanged unless Replace is selected\./);
assert.match(keepFuture.message, /Existing value will remain unchanged unless Replace is selected\./);
assert.doesNotMatch(String(keepRsu.message || ''), /will be replaced/);
assert.doesNotMatch(String(keepFuture.message || ''), /will be replaced/);
assert.doesNotMatch(String(keepRsu.warning || ''), /will be replaced/);
assert.doesNotMatch(String(keepFuture.warning || ''), /will be replaced/);

const differCiscoReplace = makeEtradeFutureWorkbook({ augustValue: 50000 });
differCiscoReplace.getSheetByName('INPUT - Investments').getRange(4, 10).setValue(40000);
const differCiscoReplaceBuilt = buildContext({ workbook: differCiscoReplace });
const differCiscoReplaceDiff = differCiscoReplaceBuilt.context
  .boundedHoldingsPreviewBuildApplyDiffFromDashboard({
    ...ciscoProfilePayload,
    monthlyInvestmentValueDecisions: {
      'Etrade Cisco - RSU/ESPP': 'REPLACE',
      'Etrade Cisco - Future': 'KEEP'
    }
  });
const replaceRsu = monthlyByAccount_(differCiscoReplaceDiff, 'Etrade Cisco - RSU/ESPP');
const keepFutureAfterReplace = monthlyByAccount_(differCiscoReplaceDiff, 'Etrade Cisco - Future');
assert.equal(replaceRsu.decision, 'REPLACE');
assert.equal(keepFutureAfterReplace.decision, 'KEEP');
assert.match(replaceRsu.message, /Warning: the existing monthly value will be replaced/);
assert.match(keepFutureAfterReplace.message,
  /Existing value will remain unchanged unless Replace is selected\./);
assert.doesNotMatch(String(keepFutureAfterReplace.message || ''), /will be replaced/);

const staleCisco = makeEtradeFutureWorkbook();
const staleCiscoBuilt = buildContext({ workbook: staleCisco });
const staleCiscoDiff = staleCiscoBuilt.context.boundedHoldingsPreviewBuildApplyDiffFromDashboard({
  ...ciscoProfilePayload,
  monthlyInvestmentValueDecisions: {
    'Etrade Cisco - RSU/ESPP': 'ADD',
    'Etrade Cisco - Future': 'ADD'
  }
});
staleCisco.getSheetByName('INPUT - Investments').getRange(4, 10).setValue(1);
const staleCiscoApply = staleCiscoBuilt.context.boundedHoldingsPreviewApplyFromDashboard({
  ...ciscoProfilePayload,
  diffDigest: staleCiscoDiff.diffDigest,
  explicitApplyConfirm: true,
  monthlyInvestmentValueDecisions: {
    'Etrade Cisco - RSU/ESPP': 'ADD',
    'Etrade Cisco - Future': 'ADD'
  }
});
assert.equal(staleCiscoApply.ok, false);
assert.equal(staleCiscoApply.staleDiff, true);
assert.equal(augustValueFromFutureSheet(staleCisco), '');
assert.equal(rsuAugustValueFromFutureSheet(staleCisco), 1);
assert.equal(staleCisco.getSheetByName(unifiedName), null);
const staleCiscoLogs = statementMonthlyActivity_(staleCiscoBuilt.context);
assert.ok(staleCiscoLogs.length >= 1);
staleCiscoLogs.forEach((row) => {
  assert.equal(row.details.result, 'STALE_REJECTED');
  assert.notEqual(row.payee, 'Etrade Cisco - RSU/ESPP + Future');
});

const rollbackCisco = makeEtradeFutureWorkbook();
const rollbackCiscoBuilt = buildContext({ workbook: rollbackCisco });
const rollbackCiscoDiff = rollbackCiscoBuilt.context.boundedHoldingsPreviewBuildApplyDiffFromDashboard({
  ...ciscoProfilePayload,
  monthlyInvestmentValueDecisions: {
    'Etrade Cisco - RSU/ESPP': 'ADD',
    'Etrade Cisco - Future': 'ADD'
  }
});
const originalUpdate = rollbackCiscoBuilt.context.updateInvestmentValueByDate;
rollbackCiscoBuilt.context.updateInvestmentValueByDate = function(payload) {
  if (String(payload && payload.accountName || '').trim() === 'Etrade Cisco - Future') {
    throw new Error('injected Future write failure');
  }
  return originalUpdate(payload);
};
const rollbackCiscoApply = rollbackCiscoBuilt.context.boundedHoldingsPreviewApplyFromDashboard({
  ...ciscoProfilePayload,
  diffDigest: rollbackCiscoDiff.diffDigest,
  explicitApplyConfirm: true,
  monthlyInvestmentValueDecisions: {
    'Etrade Cisco - RSU/ESPP': 'ADD',
    'Etrade Cisco - Future': 'ADD'
  }
});
assert.equal(rollbackCiscoApply.ok, false, 'second-leg failure must fail the whole Apply');
assert.equal(rsuAugustValueFromFutureSheet(rollbackCisco), '',
  'first-leg ADD must restore blank after second-leg failure');
assert.equal(augustValueFromFutureSheet(rollbackCisco), '');
assert.equal(rollbackCisco.getSheetByName(unifiedName), null);
const rollbackLogs = statementMonthlyActivity_(rollbackCiscoBuilt.context);
assert.ok(rollbackLogs.length >= 1);
rollbackLogs.forEach((row) => {
  assert.equal(row.details.result, 'FAILED');
  assert.notEqual(row.payee, 'Etrade Cisco - RSU/ESPP + Future');
});
assertNoSysInvestmentActivity_(rollbackCisco, 'Cisco atomic rollback');

const stashReconFailWorkbook = makeStashWorkbook();
const stashReconFailBuilt = buildContext({ workbook: stashReconFailWorkbook });
const stashReconFailPreview = stashReconFailBuilt.context.boundedHoldingsPreviewRunFromDashboard({
  ...stashPayload,
  rawDocumentText: stashReconFailText
});
assert.equal(stashReconFailPreview.ok, true);
assert.notEqual(stashReconFailPreview.reconciliation && stashReconFailPreview.reconciliation.ok, true);
const stashReconFailDiff = stashReconFailBuilt.context.boundedHoldingsPreviewBuildApplyDiffFromDashboard({
  ...stashPayload,
  rawDocumentText: stashReconFailText
});
if (stashReconFailDiff.ok) {
  assert.equal(stashReconFailDiff.diff.monthlyInvestmentValue.action, 'SKIP');
  assert.equal(stashReconFailDiff.diff.monthlyInvestmentValue.reason, 'MISSING_ENDING_TOTAL');
  assert.equal(stashReconFailDiff.diff.monthlyInvestmentValue.willWrite, false);
} else {
  assert.match(String(stashReconFailDiff.error || ''), /trusted|reconcil/i);
}

function makeSamerEtradeWorkbook(options = {}) {
  const augustValue = Object.prototype.hasOwnProperty.call(options, 'augustValue')
    ? options.augustValue
    : '';
  const months = Array(12).fill('');
  months[7] = augustValue;
  return makeWorkbook({
    assetsRows: [
      ['Samer Etrade Account', 'Brokerage', '7000', 'Yes', 'INV-ET-SAMER-1', ''],
      ['Lutfi Etrade Account', 'Brokerage', '', 'Yes', 'INV-ET-LUTFI-1', ''],
      ['Etrade Cisco - Future', 'Brokerage', '', 'Yes', 'INV-ET-FUTURE-1', ''],
      ['Etrade Cisco - RSU/ESPP', 'Brokerage', '', 'Yes', 'INV-ET-RSU-1', '']
    ],
    investmentsRows: buildInvestmentsYearBlockRows(2026, [{
      name: 'Samer Etrade Account',
      investmentId: 'INV-ET-SAMER-1',
      months
    }, {
      name: 'Lutfi Etrade Account',
      investmentId: 'INV-ET-LUTFI-1',
      months: Array(12).fill('')
    }, {
      name: 'Etrade Cisco - Future',
      investmentId: 'INV-ET-FUTURE-1',
      months: Array(12).fill('')
    }, {
      name: 'Etrade Cisco - RSU/ESPP',
      investmentId: 'INV-ET-RSU-1',
      months: Array(12).fill('')
    }]),
    monthlyRows: [monthlyHistoryHeaders],
    registryRows: [
      FINANCIAL_ACCOUNT_HEADERS,
      registryRow({
        stableAccountId: 'STABLE-ET-SAMER-1',
        domain: 'INVESTMENT',
        displayName: 'Samer Etrade Account',
        institution: 'E*TRADE',
        accountType: 'Brokerage',
        accountSubtype: '',
        ownerId: 'OWNER-1',
        registrationType: 'TAXABLE',
        currency: 'USD',
        last4: '',
        active: 'Yes',
        identityStatus: 'VERIFIED',
        legacyDomain: 'SYS_ASSETS',
        legacyKey: 'INV-ET-SAMER-1'
      }),
      registryRow({
        stableAccountId: 'STABLE-ET-LUTFI-1',
        domain: 'INVESTMENT',
        displayName: 'Lutfi Etrade Account',
        institution: 'E*TRADE',
        accountType: 'Brokerage',
        accountSubtype: '',
        ownerId: 'OWNER-1',
        registrationType: 'TAXABLE',
        currency: 'USD',
        last4: '',
        active: 'Yes',
        identityStatus: 'VERIFIED',
        legacyDomain: 'SYS_ASSETS',
        legacyKey: 'INV-ET-LUTFI-1'
      }),
      registryRow({
        stableAccountId: 'STABLE-ET-FUTURE-1',
        domain: 'INVESTMENT',
        displayName: 'Etrade Cisco - Future',
        institution: 'E*TRADE',
        accountType: 'Brokerage',
        accountSubtype: '',
        ownerId: 'OWNER-1',
        registrationType: 'TAXABLE',
        currency: 'USD',
        last4: '',
        active: 'Yes',
        identityStatus: 'VERIFIED',
        legacyDomain: 'SYS_ASSETS',
        legacyKey: 'INV-ET-FUTURE-1'
      }),
      registryRow({
        stableAccountId: 'STABLE-ET-RSU-1',
        domain: 'INVESTMENT',
        displayName: 'Etrade Cisco - RSU/ESPP',
        institution: 'E*TRADE',
        accountType: 'Brokerage',
        accountSubtype: '',
        ownerId: 'OWNER-1',
        registrationType: 'TAXABLE',
        currency: 'USD',
        last4: '',
        active: 'Yes',
        identityStatus: 'VERIFIED',
        legacyDomain: 'SYS_ASSETS',
        legacyKey: 'INV-ET-RSU-1'
      })
    ]
  });
}

function augustValueFromSamerSheet(ss) {
  return ss.getSheetByName('INPUT - Investments').getRange(3, 10).getValue();
}

function lutfiAugustValueFromSamerSheet(ss) {
  return ss.getSheetByName('INPUT - Investments').getRange(4, 10).getValue();
}

function futureAugustFromSamerSheet(ss) {
  return ss.getSheetByName('INPUT - Investments').getRange(5, 10).getValue();
}

function rsuAugustFromSamerSheet(ss) {
  return ss.getSheetByName('INPUT - Investments').getRange(6, 10).getValue();
}

function otherMonthValuesFromSamerSheet(ss) {
  const sheet = ss.getSheetByName('INPUT - Investments');
  return [3, 4, 5, 6, 7, 8, 9, 11, 12, 13, 14].map((col) => sheet.getRange(3, col).getValue());
}

const samerText = fixture('etrade', 'synthetic_etrade_client_statement_samer_brokerage.txt');
const samerPayload = {
  pickerValue: 'INV-ET-SAMER-1',
  accountName: 'Samer Etrade Account',
  sysAssetsRow: 2,
  source: 'ETRADE_CLIENT_STATEMENT_PDF',
  rawDocumentText: samerText,
  registrationType: 'TAXABLE',
  explicitAccountMatch: true,
  statementProvider: 'ETRADE'
};

const samerEnding = emptySchwabCtx.boundedHoldingsPreviewApplyResolveProviderEndingTotal_(
  {
    accountName: 'Samer Etrade Account',
    valueCategory: 'BROKERAGE_ACCOUNT_VALUE',
    reconciliation: { ok: true, endingTotalValue: 7205 },
    potentialUnvestedStockPlanValue: 846353.40,
    totalAccountValue: 7205
  },
  'ETRADE_CLIENT_STATEMENT_PDF'
);
assert.equal(samerEnding.value, 7205);
assert.equal(samerEnding.origin, 'ENDING_TOTAL_VALUE');
assert.notEqual(samerEnding.value, 846353.40);

const lutfiSkipMonthly = emptySchwabCtx.boundedHoldingsPreviewApplyBuildMonthlyInvestmentValueProposal_(
  {
    source: 'ETRADE_CLIENT_STATEMENT_PDF',
    accountName: 'Lutfi Etrade Account',
    explicitAccountMatch: true
  },
  'SINGLE_ACCOUNT',
  { accountName: 'Lutfi Etrade Account', investmentId: 'INV-ET-LUTFI-1' },
  { asOf: '2026-08-31', reconciliation: { ok: true, endingTotalValue: 7205 } }
);
assert.equal(lutfiSkipMonthly.action, 'SKIP');
assert.equal(lutfiSkipMonthly.reason, 'UNSUPPORTED_SOURCE');

const emptySamer = makeSamerEtradeWorkbook();
const emptySamerBuilt = buildContext({ workbook: emptySamer });
const emptySamerCtx = emptySamerBuilt.context;
const emptySamerBook = emptySamerBuilt.workbook;
const emptySamerInvestmentsBefore = cloneSheetRows(emptySamerBook.getSheetByName('INPUT - Investments'));
const emptySamerPreview = emptySamerCtx.boundedHoldingsPreviewRunFromDashboard(samerPayload);
assert.equal(emptySamerPreview.ok, true, emptySamerPreview.error || 'Samer E*TRADE preview failed');
assert.match(String(emptySamerPreview.asOf || ''), /^2026-08-31/);
assert.equal(emptySamerPreview.accountName, 'Samer Etrade Account');
assert.equal(emptySamerPreview.reconciliation.ok, true);
assert.equal(emptySamerPreview.reconciliation.endingTotalValue, 7205);
assert.equal(emptySamerPreview.cashBalance, 5000);
assert.equal(emptySamerPreview.holdingsRows.filter((row) => row.symbol !== 'Cash').length, 4);
assert.deepEqual(
  [...emptySamerPreview.holdingsRows.filter((row) => row.symbol !== 'Cash').map((row) => row.symbol).sort()],
  ['SYNA', 'SYNB', 'VTI', 'ZERO']
);
assert.equal(emptySamerPreview.holdingsRows.find((row) => row.symbol === 'ZERO').marketValue, 0);
assert.equal(emptySamerPreview.capabilities.activities, false);
assert.equal(emptySamerPreview.capabilities.taxLots, false);
assert.deepEqual(cloneSheetRows(emptySamerBook.getSheetByName('INPUT - Investments')),
  emptySamerInvestmentsBefore, 'Samer preview must not write monthly investment values');

const missingPeriodPreview = emptySamerCtx.boundedHoldingsPreviewRunFromDashboard({
  ...samerPayload,
  rawDocumentText: samerText.replace(/^Statement period:.*$/m, 'Account number: XXXX-BROKERAGE-001')
});
assert.equal(missingPeriodPreview.ok, false);
assert.match(String(missingPeriodPreview.error || ''), /Statement period is missing or invalid/);

const gluedSamerText = fixture('etrade', 'extracted_etrade_client_statement_samer_glued_pdfjs.txt');
const gluedSamerPreview = emptySamerCtx.boundedHoldingsPreviewRunFromDashboard({
  ...samerPayload,
  rawDocumentText: gluedSamerText
});
assert.equal(gluedSamerPreview.ok, true, gluedSamerPreview.error || 'glued Samer preview failed');
assert.match(String(gluedSamerPreview.asOf || ''), /^2026-08-31/);
assert.equal(gluedSamerPreview.accountName, 'Samer Etrade Account');
assert.equal(gluedSamerPreview.proposedValue, 7205);
assert.equal(gluedSamerPreview.cashBalance, 5000);
assert.equal(gluedSamerPreview.holdingsRows.filter((row) => row.symbol !== 'Cash').length, 4);
assert.deepEqual(
  [...gluedSamerPreview.holdingsRows.filter((row) => row.symbol !== 'Cash').map((row) => row.symbol).sort()],
  ['SYNA', 'SYNB', 'VTI', 'ZERO']
);
assert.equal(gluedSamerPreview.holdingsRows.find((row) => row.symbol === 'ZERO').marketValue, 0);

const gluedMissingPeriodPreview = emptySamerCtx.boundedHoldingsPreviewRunFromDashboard({
  ...samerPayload,
  rawDocumentText: gluedSamerText.replace(/For the Period August 1-31, 2026/g, 'CLIENT STATEMENT')
});
assert.equal(gluedMissingPeriodPreview.ok, false);
assert.match(String(gluedMissingPeriodPreview.error || ''), /Statement period is missing or invalid/);

const mismatchPreview = emptySamerCtx.boundedHoldingsPreviewRunFromDashboard({
  ...samerPayload,
  explicitAccountMatch: false
});
assert.equal(mismatchPreview.ok, false);

const emptySamerDiff = emptySamerCtx.boundedHoldingsPreviewBuildApplyDiffFromDashboard(samerPayload);
assert.equal(emptySamerDiff.ok, true, emptySamerDiff.error || 'Samer diff failed');
assert.equal(emptySamerDiff.diff.monthlyInvestmentValue.comparison, 'BLANK');
assert.equal(emptySamerDiff.diff.monthlyInvestmentValue.decision, 'IGNORE');
assert.equal(emptySamerDiff.diff.monthlyInvestmentValue.action, 'SKIP');
assert.equal(emptySamerDiff.diff.monthlyInvestmentValue.proposedValue, 7205);
assert.equal(emptySamerDiff.diff.monthlyInvestmentValue.willWrite, false);
assert.equal(emptySamerDiff.diff.monthlyInvestmentValue.valueCategory, 'BROKERAGE_ACCOUNT_VALUE');
assert.equal(emptySamerDiff.diff.summary.createCount, 5);
assert.deepEqual(cloneSheetRows(emptySamerBook.getSheetByName('INPUT - Investments')),
  emptySamerInvestmentsBefore, 'Samer review must not write monthly investment values');

const otherMonthsBeforeSamerIgnore = otherMonthValuesFromSamerSheet(emptySamerBook);
const samerIgnoreApply = emptySamerCtx.boundedHoldingsPreviewApplyFromDashboard({
  ...samerPayload,
  diffDigest: emptySamerDiff.diffDigest,
  explicitApplyConfirm: true,
  monthlyInvestmentValueDecision: 'IGNORE'
});
assert.equal(samerIgnoreApply.ok, true, samerIgnoreApply.error || 'Samer Ignore Apply failed');
assert.notEqual(samerIgnoreApply.monthlyInvestmentValueWritten, true);
assert.equal(augustValueFromSamerSheet(emptySamerBook), '');
assert.equal(lutfiAugustValueFromSamerSheet(emptySamerBook), '');
assert.equal(futureAugustFromSamerSheet(emptySamerBook), '');
assert.equal(rsuAugustFromSamerSheet(emptySamerBook), '');
assert.deepEqual(otherMonthValuesFromSamerSheet(emptySamerBook), otherMonthsBeforeSamerIgnore);
const samerIgnoreUnified = emptySamerBook.getSheetByName(unifiedName);
assert.ok(samerIgnoreUnified, 'Samer holdings Apply must create unified holdings');
const samerUnifiedRows = samerIgnoreUnified.rows.filter((row, index) => index > 0);
assert.equal(samerUnifiedRows.length, 5);
assert.ok(samerUnifiedRows.every((row) => String(row[2] || row.parentAccount || '').includes('Samer Etrade Account') ||
  String(row.join(' ')).includes('Samer Etrade Account')));
assert.equal(samerUnifiedRows.some((row) => /Lutfi Etrade Account|Etrade Cisco/i.test(String(row.join(' ')))), false);
assert.ok(samerUnifiedRows.some((row) => /ZERO/.test(String(row.join(' ')))));
assert.ok(samerUnifiedRows.some((row) => /\bCash\b/i.test(String(row.join(' ')))));
assert.ok(samerUnifiedRows.some((row) => /VTI/.test(String(row.join(' ')))));
const samerIgnoreLog = lastStatementMonthlyActivity_(emptySamerCtx);
assert.ok(samerIgnoreLog, 'Samer Ignore must write LOG - Activity');
assert.equal(samerIgnoreLog.eventType, 'investment_statement_monthly_value');
assert.equal(samerIgnoreLog.payee, 'Samer Etrade Account');
assert.equal(samerIgnoreLog.details.source, 'ETRADE_CLIENT_STATEMENT_PDF');
assert.equal(samerIgnoreLog.details.decision, 'IGNORE');
assert.equal(samerIgnoreLog.details.result, 'SKIPPED');
assert.equal(samerIgnoreLog.details.proposedValue, 7205);
assertNoSysInvestmentActivity_(emptySamerBook, 'Samer Ignore');

const addSamer = makeSamerEtradeWorkbook();
const addSamerBuilt = buildContext({ workbook: addSamer });
const samerAddDiff = addSamerBuilt.context.boundedHoldingsPreviewBuildApplyDiffFromDashboard({
  ...samerPayload,
  monthlyInvestmentValueDecision: 'ADD'
});
assert.equal(samerAddDiff.diff.monthlyInvestmentValue.willWrite, true);
const samerAddApply = addSamerBuilt.context.boundedHoldingsPreviewApplyFromDashboard({
  ...samerPayload,
  diffDigest: samerAddDiff.diffDigest,
  explicitApplyConfirm: true,
  monthlyInvestmentValueDecision: 'ADD'
});
assert.equal(samerAddApply.ok, true, samerAddApply.error || 'Samer Add Apply failed');
assert.equal(augustValueFromSamerSheet(addSamer), 7205);
assert.equal(lutfiAugustValueFromSamerSheet(addSamer), '');
assert.equal(futureAugustFromSamerSheet(addSamer), '');
assert.equal(rsuAugustFromSamerSheet(addSamer), '');
const samerAddLog = lastStatementMonthlyActivity_(addSamerBuilt.context);
assert.equal(samerAddLog.details.decision, 'ADD');
assert.equal(samerAddLog.details.result, 'APPLIED');
assertNoSysInvestmentActivity_(addSamer, 'Samer Add');

const samerDupDiff = addSamerBuilt.context.boundedHoldingsPreviewBuildApplyDiffFromDashboard(samerPayload);
assert.equal(samerDupDiff.ok, true);
assert.equal(samerDupDiff.duplicateNoop, true);
const samerDupApply = addSamerBuilt.context.boundedHoldingsPreviewApplyFromDashboard({
  ...samerPayload,
  diffDigest: samerDupDiff.diffDigest,
  explicitApplyConfirm: true
});
assert.equal(samerDupApply.ok, true);
assert.equal(samerDupApply.duplicateNoop, true);
assert.equal(augustValueFromSamerSheet(addSamer), 7205);

const occupiedSamer = makeSamerEtradeWorkbook({ augustValue: 1 });
const occupiedSamerBuilt = buildContext({ workbook: occupiedSamer });
const samerKeepDiff = occupiedSamerBuilt.context.boundedHoldingsPreviewBuildApplyDiffFromDashboard(samerPayload);
assert.equal(samerKeepDiff.diff.monthlyInvestmentValue.comparison, 'DIFFER');
assert.equal(samerKeepDiff.diff.monthlyInvestmentValue.decision, 'KEEP');
assert.equal(samerKeepDiff.diff.monthlyInvestmentValue.willWrite, false);
const samerKeepApply = occupiedSamerBuilt.context.boundedHoldingsPreviewApplyFromDashboard({
  ...samerPayload,
  diffDigest: samerKeepDiff.diffDigest,
  explicitApplyConfirm: true,
  monthlyInvestmentValueDecision: 'KEEP'
});
assert.equal(samerKeepApply.ok, true);
assert.equal(augustValueFromSamerSheet(occupiedSamer), 1);

const replaceSamer = makeSamerEtradeWorkbook({ augustValue: 1 });
const replaceSamerBuilt = buildContext({ workbook: replaceSamer });
const samerReplaceDiff = replaceSamerBuilt.context.boundedHoldingsPreviewBuildApplyDiffFromDashboard({
  ...samerPayload,
  monthlyInvestmentValueDecision: 'REPLACE'
});
assert.equal(samerReplaceDiff.diff.monthlyInvestmentValue.willWrite, true);
const samerReplaceApply = replaceSamerBuilt.context.boundedHoldingsPreviewApplyFromDashboard({
  ...samerPayload,
  diffDigest: samerReplaceDiff.diffDigest,
  explicitApplyConfirm: true,
  monthlyInvestmentValueDecision: 'REPLACE'
});
assert.equal(samerReplaceApply.ok, true);
assert.equal(augustValueFromSamerSheet(replaceSamer), 7205);
assert.equal(lutfiAugustValueFromSamerSheet(replaceSamer), '');
assert.equal(futureAugustFromSamerSheet(replaceSamer), '');
assert.equal(rsuAugustFromSamerSheet(replaceSamer), '');

const staleSamer = makeSamerEtradeWorkbook({ augustValue: 1 });
const staleSamerBuilt = buildContext({ workbook: staleSamer });
const samerStaleDiff = staleSamerBuilt.context.boundedHoldingsPreviewBuildApplyDiffFromDashboard({
  ...samerPayload,
  monthlyInvestmentValueDecision: 'ADD'
});
staleSamer.getSheetByName('INPUT - Investments').getRange(3, 10).setValue(2);
const samerStaleApply = staleSamerBuilt.context.boundedHoldingsPreviewApplyFromDashboard({
  ...samerPayload,
  diffDigest: samerStaleDiff.diffDigest,
  explicitApplyConfirm: true,
  monthlyInvestmentValueDecision: 'ADD'
});
assert.equal(samerStaleApply.ok, false);
assert.equal(samerStaleApply.staleDiff, true);
assert.equal(augustValueFromSamerSheet(staleSamer), 2);
assert.equal(staleSamer.getSheetByName(unifiedName), null,
  'stale Samer monthly digest must fail closed before holdings write');
const samerStaleLog = lastStatementMonthlyActivity_(staleSamerBuilt.context);
assert.equal(samerStaleLog.details.result, 'STALE_REJECTED');
assertNoSysInvestmentActivity_(staleSamer, 'Samer stale');

const lutfiPayload = {
  ...samerPayload,
  pickerValue: 'INV-ET-LUTFI-1',
  accountName: 'Lutfi Etrade Account',
  sysAssetsRow: 3
};
const lutfiBook = makeSamerEtradeWorkbook();
const lutfiBuilt = buildContext({ workbook: lutfiBook });
const lutfiDiff = lutfiBuilt.context.boundedHoldingsPreviewBuildApplyDiffFromDashboard(lutfiPayload);
if (lutfiDiff.ok) {
  assert.equal(lutfiDiff.diff.monthlyInvestmentValue.action, 'SKIP');
  assert.equal(lutfiDiff.diff.monthlyInvestmentValue.reason, 'UNSUPPORTED_SOURCE');
}

console.log('Bounded holdings preview Apply regressions passed.');
