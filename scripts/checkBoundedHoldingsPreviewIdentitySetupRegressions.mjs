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
  }
  read() {
    return Array.from({ length: this.numRows }, (_, r) =>
      Array.from({ length: this.numCols }, (_, c) =>
        this.sheet.rows[this.row - 1 + r]?.[this.col - 1 + c] ?? ''));
  }
  getValues() { return this.read(); }
  getDisplayValues() { return this.read().map((row) => row.map((value) => String(value ?? ''))); }
  setValue(value) {
    while (this.sheet.rows.length < this.row) this.sheet.rows.push([]);
    while ((this.sheet.rows[this.row - 1] || []).length < this.col) {
      this.sheet.rows[this.row - 1].push('');
    }
    this.sheet.rows[this.row - 1][this.col - 1] = value;
    return this;
  }
  setValues(values) {
    values.forEach((row, r) => row.forEach((value, c) => {
      const rr = this.row - 1 + r;
      while (this.sheet.rows.length <= rr) this.sheet.rows.push([]);
      this.sheet.rows[rr][this.col - 1 + c] = value;
    }));
    return this;
  }
  setFontWeight() { return this; }
  setBackground() { return this; }
  setHorizontalAlignment() { return this; }
}

class FakeSheet {
  constructor(name, rows = []) {
    this.name = name;
    this.rows = rows.map((row) => [...row]);
  }
  getName() { return this.name; }
  getLastRow() { return this.rows.length; }
  getLastColumn() { return Math.max(0, ...this.rows.map((row) => row.length)); }
  getRange(row, col, numRows = 1, numCols = 1) {
    return new FakeRange(this, row, col, numRows, numCols);
  }
  getDataRange() {
    return this.getRange(1, 1, Math.max(1, this.getLastRow()), Math.max(1, this.getLastColumn()));
  }
  appendRow(row) { this.rows.push([...row]); }
  setFrozenRows() {}
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

function makeWorkbook(options = {}) {
  const assetsRows = options.assetsRows || [
    ['E*TRADE Unregistered', 'Brokerage', '9000', 'Yes', 'INV-ET-UNREG', ''],
    ['M1 Account - Gmail', 'Brokerage', '95000', 'Yes', 'INV-M1-GMAIL-UNREG', ''],
    ['Synthetic E*TRADE Taxable', 'Brokerage', '50000', 'Yes', 'INV-ET-BOUNDED-1', ''],
    ['Inactive M1 Account', 'Brokerage', '500', 'No', 'INV-M1-INACTIVE', '']
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
      ownerId: 'SAMER',
      registrationType: 'TAXABLE',
      currency: 'USD',
      last4: '',
      active: 'Yes',
      identityStatus: 'VERIFIED',
      legacyDomain: 'SYS_ASSETS',
      legacyKey: 'INV-ET-BOUNDED-1'
    })
  ];

  const assetsSheet = new FakeSheet('SYS - Assets', [assetsHeaders, ...assetsRows]);
  const investmentsSheet = new FakeSheet('INPUT - Investments', [
    investmentsHeaders,
    ['Synthetic E*TRADE Taxable', 'Brokerage', '50000', '', '', '', '', '', '', '', '', '', '', 'Yes', 'INV-ET-BOUNDED-1']
  ]);
  const monthlySheet = new FakeSheet('SYS - Monthly Investment Values', [
    monthlyHistoryHeaders,
    ['Synthetic E*TRADE Taxable', '2026-01', '48000']
  ]);
  const registryBody = registryRows.map((row) => (Array.isArray(row) ? row : registryRow(row)));
  const registrySheet = new FakeSheet('SYS - Financial Accounts', registryBody);

  return {
    ss: new FakeSpreadsheet([assetsSheet, investmentsSheet, monthlySheet, registrySheet]),
    assetsSheet,
    investmentsSheet,
    monthlySheet,
    registrySheet
  };
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
    ${extractFunction(investmentsSource, 'createInvestmentStableId_')}
  `, context, { filename: 'investments-helpers.js' });
}

function buildContext(workbook) {
  const context = {
    Utilities: utilities,
    String, Number, Object, Array, Math, isFinite, Error, JSON, console, Date,
    ScriptApp: { getService() { return { getUrl() { return 'https://script.google.com/macros/s/X/exec'; } }; } },
    LockService: { getDocumentLock() { return { waitLock() {}, releaseLock() {} }; } },
    SpreadsheetApp: { flush() {} },
    Session: { getScriptTimeZone() { return 'America/Los_Angeles'; } },
    assertAdmin_: () => {},
    isAdminUser_: () => false,
    isCentralModeEnabled_: () => false,
    isAllowlistedUser_: () => true,
    applySysSheetBaseStyle_: () => {},
    getUserSpreadsheet_: () => workbook.ss,
    getSheetNames_: () => ({
      ASSETS: 'SYS - Assets',
      FINANCIAL_ACCOUNTS: 'SYS - Financial Accounts',
      ACCOUNT_SOURCE_LINKS: 'SYS - Account Source Links',
      INVESTMENTS: 'INPUT - Investments'
    })
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
  vm.runInContext(read('bounded_holdings_preview.js'), context, {
    filename: 'bounded_holdings_preview.js'
  });
  vm.runInContext(read('bounded_holdings_preview_groups.js'), context, {
    filename: 'bounded_holdings_preview_groups.js'
  });
  vm.runInContext(read('bounded_holdings_preview_identity.js'), context, {
    filename: 'bounded_holdings_preview_identity.js'
  });
  return context;
}

const identitySource = read('bounded_holdings_preview_identity.js');
const boundedSource = read('bounded_holdings_preview.js');
const boundedHtml = read('BoundedHoldingsPreviewUI.html');
const etradeFixture = fixture('etrade', 'synthetic_etrade_positions_minimal.txt');
const m1Fixture = fixture('m1', 'synthetic_m1_statement_minimal.txt');

assert.match(identitySource, /boundedHoldingsPreviewEnsureAccountIdentity_/);
assert.match(identitySource, /ensureFinancialAccountsSheet_/);
assert.match(identitySource, /financialIdentityInferOwnerId_/);
assert.match(identitySource, /assigned automatically by CashCompass/);
assert.match(identitySource, /legacyDomain: 'SYS_ASSETS'/);
assert.match(identitySource, /legacyKey: investmentId/);
assert.match(identitySource, /boundedHoldingsPreviewAssignAssetsInvestmentId_/);
assert.match(identitySource, /createInvestmentStableId_/);
assert.match(identitySource, /needsInvestmentIdAssignment/);
assert.match(boundedSource, /BOUNDED_HOLDINGS_PREVIEW_AUTO_IDENTITY_ON_CONFIRM_MESSAGE_/);
assert.doesNotMatch(boundedSource, /\bappendRow\b/);
assert.doesNotMatch(identitySource, /getSheetByName\([^)]*INVESTMENTS|Monthly Investment Values/);
assert.doesNotMatch(boundedHtml, /id="stableAccountId"/);
assert.doesNotMatch(boundedHtml, /Identity setup required/);
assert.doesNotMatch(boundedHtml, /Set up identity/);
assert.doesNotMatch(boundedHtml, /applyBoundedHoldingsPreviewIdentitySetupFromDashboard/);
assert.match(boundedHtml, /id="selectedAccount"/);
assert.match(boundedHtml, /id="registrationType"/);
assert.match(boundedHtml, /id="explicitAccountMatch"/);
assert.match(boundedHtml, /groupedSession/);
assert.match(boundedHtml, /CashCompass saves internal identity automatically/);

const workbook = makeWorkbook();
const ctx = buildContext(workbook);
const investmentsBefore = cloneSheetRows(workbook.investmentsSheet);
const monthlyBefore = cloneSheetRows(workbook.monthlySheet);
const registryBefore = cloneSheetRows(workbook.registrySheet);

const setup = ctx.getBoundedHoldingsPreviewSetupFromDashboard();
assert.equal(setup.ok, true, setup.error || 'setup failed');
const unregistered = setup.accounts.find((row) => row.accountName === 'E*TRADE Unregistered');
assert.ok(unregistered, 'unregistered account must appear');
assert.equal(unregistered.identityReady, false);
assert.equal(unregistered.needsAutoIdentity, true);
assert.ok(setup.accounts.every((row) => !String(row.accountName).includes(' — Identity setup required')));

const setupOnly = cloneSheetRows(workbook.registrySheet);
assert.deepEqual(setupOnly, registryBefore, 'account selection must not create identity');

const missingRegistration = ctx.boundedHoldingsPreviewRunFromDashboard({
  source: 'ETRADE_POSITIONS_PDF',
  rawDocumentText: etradeFixture,
  investmentId: 'INV-ET-UNREG',
  accountName: 'E*TRADE Unregistered',
  registrationType: '',
  explicitAccountMatch: true
});
assert.equal(missingRegistration.ok, false);
assert.match(missingRegistration.error, /registrationType is required/);
assert.deepEqual(cloneSheetRows(workbook.registrySheet), registryBefore);

const missingConfirm = ctx.boundedHoldingsPreviewRunFromDashboard({
  source: 'ETRADE_POSITIONS_PDF',
  rawDocumentText: etradeFixture,
  investmentId: 'INV-ET-UNREG',
  accountName: 'E*TRADE Unregistered',
  registrationType: 'TAXABLE',
  explicitAccountMatch: false
});
assert.equal(missingConfirm.ok, false);
assert.match(missingConfirm.error, /Explicit account-match confirmation is required/);
assert.deepEqual(cloneSheetRows(workbook.registrySheet), registryBefore);

const rejectedStableId = ctx.boundedHoldingsPreviewRunFromDashboard({
  source: 'ETRADE_POSITIONS_PDF',
  rawDocumentText: etradeFixture,
  investmentId: 'INV-ET-UNREG',
  accountName: 'E*TRADE Unregistered',
  registrationType: 'TAXABLE',
  stableAccountId: 'USER-ENTERED-ID',
  explicitAccountMatch: true
});
assert.equal(rejectedStableId.ok, false);
assert.match(rejectedStableId.error, /assigned automatically by CashCompass/);
assert.deepEqual(cloneSheetRows(workbook.registrySheet), registryBefore);

const inactiveSetup = ctx.boundedHoldingsPreviewRunFromDashboard({
  source: 'M1_STATEMENT_PDF',
  rawDocumentText: m1Fixture,
  investmentId: 'INV-M1-INACTIVE',
  accountName: 'Inactive M1 Account',
  registrationType: 'TAXABLE',
  explicitAccountMatch: true
});
assert.equal(inactiveSetup.ok, false);
assert.match(inactiveSetup.error, /not active/);

const autoPreview = ctx.boundedHoldingsPreviewRunFromDashboard({
  source: 'ETRADE_POSITIONS_PDF',
  rawDocumentText: etradeFixture,
  investmentId: 'INV-ET-UNREG',
  accountName: 'E*TRADE Unregistered',
  registrationType: 'TAXABLE',
  explicitAccountMatch: true
});
assert.equal(autoPreview.ok, true, autoPreview.error || 'auto identity preview failed');
assert.equal(autoPreview.account.stableAccountId, 'INV-ET-UNREG');

const registryAfterAuto = cloneSheetRows(workbook.registrySheet);
assert.equal(registryAfterAuto.length, registryBefore.length + 1);
const newRow = registryAfterAuto[registryAfterAuto.length - 1];
assert.equal(newRow[0], 'INV-ET-UNREG');
assert.equal(newRow[13], 'INV-ET-UNREG');
assert.doesNotMatch(String(newRow[0]), /^XXXX/i);

const verifiedAfter = registryAfterAuto.find((row) => row[13] === 'INV-ET-BOUNDED-1');
const verifiedBefore = registryBefore.find((row) => row[13] === 'INV-ET-BOUNDED-1');
assert.ok(verifiedAfter && verifiedBefore);
assert.deepEqual(verifiedAfter.slice(0, 14), verifiedBefore.slice(0, 14),
  'existing verified identities must remain unchanged');

assert.deepEqual(cloneSheetRows(workbook.investmentsSheet), investmentsBefore);
assert.deepEqual(cloneSheetRows(workbook.monthlySheet), monthlyBefore);

const renamedWorkbook = makeWorkbook({
  assetsRows: [
    ['Renamed E*TRADE Label', 'Brokerage', '9000', 'Yes', 'INV-ET-UNREG', ''],
    ['Synthetic E*TRADE Taxable', 'Brokerage', '50000', 'Yes', 'INV-ET-BOUNDED-1', '']
  ],
  registryRows: [
    FINANCIAL_ACCOUNT_HEADERS,
    registryRow({
      stableAccountId: 'INV-ET-UNREG',
      domain: 'INVESTMENT',
      displayName: 'E*TRADE Unregistered',
      institution: 'E*TRADE',
      accountType: 'Brokerage',
      accountSubtype: '',
      ownerId: 'SAMER',
      registrationType: 'TAXABLE',
      currency: 'USD',
      last4: '',
      active: 'Yes',
      identityStatus: 'VERIFIED',
      legacyDomain: 'SYS_ASSETS',
      legacyKey: 'INV-ET-UNREG'
    })
  ]
});
const renamedCtx = buildContext(renamedWorkbook);
const renamedPreview = renamedCtx.boundedHoldingsPreviewRunFromDashboard({
  source: 'ETRADE_POSITIONS_PDF',
  rawDocumentText: etradeFixture,
  investmentId: 'INV-ET-UNREG',
  accountName: 'Renamed E*TRADE Label',
  registrationType: 'TAXABLE',
  explicitAccountMatch: true
});
assert.equal(renamedPreview.ok, true, renamedPreview.error || 'rename preview failed');
assert.equal(renamedPreview.account.stableAccountId, 'INV-ET-UNREG');
assert.equal(renamedWorkbook.registrySheet.getLastRow(), 2, 'rename must not create a new identity row');

const duplicateNameWorkbook = makeWorkbook({
  assetsRows: [
    ['Shared Brokerage Name', 'Brokerage', '1000', 'Yes', 'INV-DUP-A', ''],
    ['Shared Brokerage Name', 'Brokerage', '2000', 'Yes', 'INV-DUP-B', ''],
    ['Synthetic E*TRADE Taxable', 'Brokerage', '50000', 'Yes', 'INV-ET-BOUNDED-1', '']
  ]
});
const duplicateCtx = buildContext(duplicateNameWorkbook);
const dupA = duplicateCtx.boundedHoldingsPreviewRunFromDashboard({
  source: 'ETRADE_POSITIONS_PDF',
  rawDocumentText: etradeFixture,
  investmentId: 'INV-DUP-A',
  accountName: 'Shared Brokerage Name',
  registrationType: 'TAXABLE',
  explicitAccountMatch: true
});
assert.equal(dupA.ok, true, dupA.error || 'dup A preview failed');
assert.equal(dupA.account.stableAccountId, 'INV-DUP-A');
const dupB = duplicateCtx.boundedHoldingsPreviewRunFromDashboard({
  source: 'ETRADE_POSITIONS_PDF',
  rawDocumentText: etradeFixture,
  investmentId: 'INV-DUP-B',
  accountName: 'Shared Brokerage Name',
  registrationType: 'TAXABLE',
  explicitAccountMatch: true
});
assert.equal(dupB.ok, true, dupB.error || 'dup B preview failed');
assert.equal(dupB.account.stableAccountId, 'INV-DUP-B');
assert.notEqual(dupA.account.stableAccountId, dupB.account.stableAccountId);

const groupedAuto = ctx.boundedHoldingsPreviewRunGroupedChildFromDashboard({
  pickerValue: 'INV-M1-GMAIL-UNREG',
  investmentId: 'INV-M1-GMAIL-UNREG',
  accountName: 'M1 Account - Gmail',
  source: 'M1_STATEMENT_PDF',
  rawDocumentText: m1Fixture,
  registrationType: 'TAXABLE',
  explicitAccountMatch: true,
  sessionChildren: [],
  sessionPreviews: [],
  confirmNewChild: true,
  confirmationToken: 'SYNTH'
});
assert.equal(groupedAuto.ok, false);
assert.match(groupedAuto.error, /confirmationToken|parse|confirm/i);

const groupedWorkbook = makeWorkbook({
  assetsRows: [
    ['M1 Account - Gmail', 'Brokerage', '95000', 'Yes', 'INV-M1-GMAIL-UNREG', ''],
    ['Synthetic E*TRADE Taxable', 'Brokerage', '50000', 'Yes', 'INV-ET-BOUNDED-1', '']
  ]
});
const groupedCtx = buildContext(groupedWorkbook);
const groupedRegistryBefore = groupedWorkbook.registrySheet.getLastRow();
const groupedInspect = groupedCtx.boundedHoldingsPreviewInspectGroupedStatementFromDashboard({
  accountName: 'M1 Account - Gmail',
  pickerValue: 'INV-M1-GMAIL-UNREG',
  sysAssetsRow: 2,
  source: 'M1_STATEMENT_PDF',
  rawDocumentText: m1Fixture,
  registrationType: 'TAXABLE',
  explicitAccountMatch: true,
  sessionChildren: [],
  sessionPreviews: []
});
assert.equal(groupedInspect.ok, true, groupedInspect.error || 'grouped inspect failed');
assert.ok(groupedWorkbook.registrySheet.getLastRow() > groupedRegistryBefore,
  'grouped parent identity must be created automatically after explicit confirmation');

const groupedNameOnlyInspect = groupedCtx.boundedHoldingsPreviewInspectGroupedStatementFromDashboard({
  accountName: 'M1 Account - Gmail',
  source: 'M1_STATEMENT_PDF',
  rawDocumentText: m1Fixture,
  registrationType: 'TAXABLE',
  explicitAccountMatch: true,
  sessionChildren: [],
  sessionPreviews: []
});
assert.equal(groupedNameOnlyInspect.ok, true, groupedNameOnlyInspect.error || 'grouped name-only inspect failed');

const groupedMissingWorkbook = makeWorkbook({
  assetsRows: [
    ['M1 Account - Gmail', 'Brokerage', '95000', 'Yes', '', ''],
    ['Synthetic E*TRADE Taxable', 'Brokerage', '50000', 'Yes', 'INV-ET-BOUNDED-1', '']
  ]
});
const groupedMissingCtx = buildContext(groupedMissingWorkbook);
const groupedMissingAssetsBefore = cloneSheetRows(groupedMissingWorkbook.assetsSheet);
const groupedMissingRegistryBefore = cloneSheetRows(groupedMissingWorkbook.registrySheet);
const groupedMissingInvestmentsBefore = cloneSheetRows(groupedMissingWorkbook.investmentsSheet);
const groupedMissingMonthlyBefore = cloneSheetRows(groupedMissingWorkbook.monthlySheet);
const groupedMissingSetup = groupedMissingCtx.getBoundedHoldingsPreviewSetupFromDashboard();
const missingParent = groupedMissingSetup.accounts.find((row) =>
  row.accountName === 'M1 Account - Gmail');
assert.ok(missingParent);
assert.equal(missingParent.needsAutoIdentity, true);
assert.match(missingParent.identityMessage, /assign internal identity automatically/i);
assert.deepEqual(cloneSheetRows(groupedMissingWorkbook.registrySheet), groupedMissingRegistryBefore,
  'read-only setup must not assign grouped parent identity');
assert.deepEqual(cloneSheetRows(groupedMissingWorkbook.assetsSheet), groupedMissingAssetsBefore,
  'read-only setup must not assign Investment Id');

const groupedMissingInspect = groupedMissingCtx.boundedHoldingsPreviewInspectGroupedStatementFromDashboard({
  accountName: 'M1 Account - Gmail',
  pickerValue: missingParent.pickerValue,
  sysAssetsRow: missingParent.sysAssetsRow,
  source: 'M1_STATEMENT_PDF',
  rawDocumentText: m1Fixture,
  registrationType: 'TAXABLE',
  explicitAccountMatch: true,
  sessionChildren: [],
  sessionPreviews: []
});
assert.equal(groupedMissingInspect.ok, true, groupedMissingInspect.error || 'grouped missing-id inspect failed');
assert.match(String(groupedMissingWorkbook.assetsSheet.rows[1][4] || ''), /^INV-/,
  'explicit grouped confirmation must assign Investment Id on SYS - Assets');
assert.ok(groupedMissingWorkbook.registrySheet.getLastRow() > groupedMissingRegistryBefore.length,
  'explicit grouped confirmation must create parent registry identity');

const groupedMissingConfirm = groupedMissingCtx.boundedHoldingsPreviewRunGroupedChildFromDashboard({
  accountName: 'M1 Account - Gmail',
  pickerValue: missingParent.pickerValue,
  sysAssetsRow: missingParent.sysAssetsRow,
  source: 'M1_STATEMENT_PDF',
  rawDocumentText: m1Fixture,
  registrationType: 'TAXABLE',
  explicitAccountMatch: true,
  sessionChildren: [],
  sessionPreviews: [],
  confirmNewChild: true,
  confirmationToken: groupedMissingInspect.childMatch.confirmationToken
});
assert.equal(groupedMissingConfirm.ok, true, groupedMissingConfirm.error || 'grouped missing-id preview failed');
assert.equal(groupedMissingConfirm.preview.account.registrationType, 'TAXABLE');
assert.deepEqual(cloneSheetRows(groupedMissingWorkbook.investmentsSheet), groupedMissingInvestmentsBefore);
assert.deepEqual(cloneSheetRows(groupedMissingWorkbook.monthlySheet), groupedMissingMonthlyBefore);

const duplicateNameGroupedWorkbook = makeWorkbook({
  assetsRows: [
    ['M1 Account - Gmail', 'Brokerage', '95000', 'Yes', '', ''],
    ['M1 Account - Gmail', 'Brokerage', '88000', 'Yes', '', ''],
    ['Synthetic E*TRADE Taxable', 'Brokerage', '50000', 'Yes', 'INV-ET-BOUNDED-1', '']
  ]
});
const duplicateNameGroupedCtx = buildContext(duplicateNameGroupedWorkbook);
assert.equal(
  duplicateNameGroupedCtx.boundedHoldingsPreviewRunGroupedChildFromDashboard({
    accountName: 'M1 Account - Gmail',
    source: 'M1_STATEMENT_PDF',
    rawDocumentText: m1Fixture,
    registrationType: 'TAXABLE',
    explicitAccountMatch: true,
    sessionChildren: [],
    sessionPreviews: []
  }).ok,
  false
);

const maskedWorkbook = makeWorkbook({
  assetsRows: [['Masked Account', 'Brokerage', '1000', 'Yes', 'XXXX1234', '']],
  registryRows: [FINANCIAL_ACCOUNT_HEADERS]
});
const maskedCtx = buildContext(maskedWorkbook);
const maskedApply = maskedCtx.boundedHoldingsPreviewRunFromDashboard({
  source: 'M1_STATEMENT_PDF',
  rawDocumentText: m1Fixture,
  investmentId: 'XXXX1234',
  accountName: 'Masked Account',
  registrationType: 'TAXABLE',
  explicitAccountMatch: true
});
assert.equal(maskedApply.ok, false);
assert.match(maskedApply.error, /Masked account numbers cannot be used as durable identity/);

console.log('checkBoundedHoldingsPreviewIdentitySetupRegressions: ok');
