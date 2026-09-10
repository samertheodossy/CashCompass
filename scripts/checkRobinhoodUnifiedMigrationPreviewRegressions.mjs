import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root = path.resolve(new URL('../', import.meta.url).pathname);
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');
const inventory = JSON.parse(read('test/fixtures/sys-sheet-audit-inventory.json'));
const previewSource = read('robinhood_unified_migration_preview.js');

const WRITE_PATTERNS = [
  /\bsetValues\s*\(/,
  /\bappendRow\s*\(/,
  /\bclearContents\s*\(/,
  /\bdeleteRow\s*\(/,
  /\bdeleteSheet\s*\(/,
  /\binsertSheet\s*\(/,
  /\bsetName\s*\(/,
  /\bhideColumns\s*\(/,
  /\bsetNumberFormat\s*\(/,
  /\bensureSys[A-Za-z0-9_]*\s*\(/,
  /\bensureInvestment[A-Za-z0-9_]*\s*\(/,
  /\bensureFinancial[A-Za-z0-9_]*\s*\(/,
  /\bensureImport[A-Za-z0-9_]*\s*\(/,
  /\bensureCashImport[A-Za-z0-9_]*\s*\(/,
  /\bboundedHoldingsPreviewApplyEnsure[A-Za-z0-9_]*\s*\(/,
  /\brebuildInvestmentHoldingsForAccount_\s*\(/,
  /\bimportInvestmentActivityFromDashboard\s*\(/
];

for (const pattern of WRITE_PATTERNS) {
  assert.doesNotMatch(previewSource, pattern,
    `robinhood_unified_migration_preview.js must stay read-only (${pattern})`);
}

assert.doesNotMatch(
  previewSource.match(/function buildRobinhoodUnifiedMigrationPreview_\(ss[\s\S]*?\n\}/)[0],
  /\bgetUserSpreadsheet_\s*\(/,
  'core builder must accept an explicit spreadsheet handle only'
);
assert.match(previewSource, /function adminGetRobinhoodUnifiedMigrationPreview\(/);
assert.match(previewSource, /assertAdmin_\(\)/);
assert.match(previewSource, /ROBINHOOD_UNIFIED_MIGRATION_PREVIEW_VERSION_/);
assert.match(previewSource, /MIGRATION_PREVIEW/);
assert.match(previewSource, /Logger\.log\(JSON\.stringify\(robinhoodUnifiedMigrationPreviewSanitizedLogSummary_/);
assert.doesNotMatch(
  previewSource.match(/function adminUiGetRobinhoodUnifiedMigrationPreview\([\s\S]*?\n\}/)[0],
  /Logger\.log/,
  'admin UI wrapper must not log preview payloads'
);
assert.match(read('validation_testing_server.js'), /function vtRunRobinhoodUnifiedMigrationPreview\(/);

const migration = inventory.robinhoodMigration;
assert.ok(migration.preview, 'inventory robinhoodMigration.preview must exist');
assert.equal(migration.preview.module, 'robinhood_unified_migration_preview.js');
assert.equal(migration.preview.readOnly, true);
assert.deepEqual(migration.preview.entryPoints.sort(), [
  'adminGetRobinhoodUnifiedMigrationPreview',
  'adminUiGetRobinhoodUnifiedMigrationPreview',
  'buildRobinhoodUnifiedMigrationPreview_',
  'vtRunRobinhoodUnifiedMigrationPreview'
].sort());

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

class FakeRange {
  constructor(sheet, row, col, numRows = 1, numCols = 1) {
    this.sheet = sheet;
    this.row = row;
    this.col = col;
    this.numRows = numRows;
    this.numCols = numCols;
  }
  read() {
    return Array.from({ length: this.numRows }, (_, r) =>
      Array.from({ length: this.numCols }, (_, c) =>
        this.sheet.rows[this.row - 1 + r]?.[this.col - 1 + c] ?? ''));
  }
  getValues() { return this.read(); }
  getDisplayValues() { return this.read().map((row) => row.map((value) => String(value ?? ''))); }
  setValues() { throw new Error('write forbidden in migration preview regression'); }
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
}

class FakeSpreadsheet {
  constructor(sheets = []) {
    this.sheets = new Map(sheets.map((sheet) => [sheet.getName(), sheet]));
    this.writeAttempts = 0;
  }
  getSheetByName(name) { return this.sheets.get(name) || null; }
  insertSheet() {
    this.writeAttempts += 1;
    throw new Error('write forbidden');
  }
}

const names = {
  INVESTMENT_ACTIVITY: 'SYS - Investment Activity',
  INVESTMENT_HOLDINGS: 'SYS - Investment Holdings',
  INVESTMENT_HOLDINGS_UNIFIED: 'SYS - Investment Holdings Unified',
  ASSETS: 'SYS - Assets',
  FINANCIAL_ACCOUNTS: 'SYS - Financial Accounts',
  ACCOUNT_SOURCE_LINKS: 'SYS - Account Source Links'
};

const activityHeaders = [
  'Import Key', 'Investment Id', 'Account Name', 'Activity Date', 'Settle Date',
  'Ticker', 'Activity Type', 'Quantity', 'Price', 'Amount', 'Recurring',
  'Description', 'Source', 'Imported At'
];
const holdingsHeaders = [
  'Investment Id', 'Account Name', 'As Of Date', 'Ticker', 'Quantity',
  'Total Buy Cost', 'Sale Proceeds', 'Dividends Received',
  'Weekly Recurring Buy', 'Last Activity Price', 'Activity Count', 'Updated At'
];
const unifiedHeaders = [
  'Source', 'Provider', 'Parent CashCompass account', 'Child account/partition',
  'Investment Id', 'Source security key', 'Symbol', 'Security name', 'Shares',
  'Price', 'Market value', 'Cost basis', 'Unrealized gain/loss', 'Cash balance',
  'As-of date', 'Document fingerprint', 'Import status', 'Imported at', 'Import run/reference'
];
const assetsHeaders = [
  'Account Name', 'Type', 'Current Balance', 'Active', 'Investment Id', 'Planning Purpose'
];
const financialHeaders = [
  'Stable Account Id', 'Domain', 'Display Name', 'Institution', 'Account Type',
  'Account Subtype', 'Owner Id', 'Registration Type', 'Currency', 'Last 4',
  'Active', 'Identity Status', 'Legacy Domain', 'Legacy Key', 'Created At', 'Updated At'
];
const sourceLinkHeaders = [
  'Source Link Id', 'Stable Account Id', 'Source Type', 'Source System',
  'Source Account Key', 'Masked Identifier', 'Institution',
  'Source Account Type', 'Link Status', 'Linked At', 'Verified At'
];

const investmentId = 'INV-RH-001';
const stableAccountId = 'STA-RH-001';

function buildWorkbook(options = {}) {
  const activityRows = [activityHeaders];
  (options.activityRows || [
    ['key-1', investmentId, 'Robinhood Brokerage', '2026-08-01', '2026-08-01',
      'AAPL', 'BUY', 2, 150, 300, '', 'Buy AAPL', 'ROBINHOOD_CSV', '2026-08-02 10:00:00'],
    ['key-2', investmentId, 'Robinhood Brokerage', '2026-08-15', '2026-08-15',
      'MSFT', 'BUY', 1, 400, 400, '', 'Buy MSFT', 'ROBINHOOD_CSV', '2026-08-16 10:00:00']
  ]).forEach((row) => activityRows.push(row));

  const holdingsRows = [holdingsHeaders];
  (options.holdingsRows || [
    [investmentId, 'Robinhood Brokerage', '2026-08-15', 'AAPL', 2, 300, 0, 0, 0, 150, 1,
      '2026-08-16 10:00:00'],
    [investmentId, 'Robinhood Brokerage', '2026-08-15', 'MSFT', 1, 400, 0, 0, 0, 400, 1,
      '2026-08-16 10:00:00']
  ]).forEach((row) => holdingsRows.push(row));

  const unifiedRows = [unifiedHeaders];
  (options.unifiedRows || []).forEach((row) => unifiedRows.push(row));

  const assetsRows = [assetsHeaders];
  if (options.includeAssets !== false) {
    assetsRows.push(['Robinhood Brokerage', 'Brokerage', 700, 'Yes', investmentId, '']);
  }

  const financialRows = [financialHeaders];
  if (options.includeFinancial !== false) {
    financialRows.push([
      stableAccountId, 'INVESTMENT', 'Robinhood Brokerage', 'Robinhood', 'Brokerage', '',
      'SAMER', 'TAXABLE', 'USD', '', 'Yes', 'VERIFIED', 'SYS_ASSETS', investmentId,
      '2026-01-01 00:00:00', '2026-01-01 00:00:00'
    ]);
  }

  const sourceLinkRows = [sourceLinkHeaders];
  (options.sourceLinkRows || []).forEach((row) => sourceLinkRows.push(row));

  return new FakeSpreadsheet([
    new FakeSheet(names.INVESTMENT_ACTIVITY, activityRows),
    new FakeSheet(names.INVESTMENT_HOLDINGS, holdingsRows),
    new FakeSheet(names.INVESTMENT_HOLDINGS_UNIFIED, unifiedRows),
    new FakeSheet(names.ASSETS, assetsRows),
    new FakeSheet(names.FINANCIAL_ACCOUNTS, financialRows),
    new FakeSheet(names.ACCOUNT_SOURCE_LINKS, sourceLinkRows)
  ]);
}

const context = {
  Utilities: utilities,
  String, Number, Object, Array, Math, isFinite, Error, JSON, console,
  getSheetNames_: () => names,
  INVESTMENT_ACTIVITY_HEADERS_: activityHeaders,
  INVESTMENT_HOLDINGS_HEADERS_: activityHeaders,
  ACCOUNT_SOURCE_LINK_HEADERS_: sourceLinkHeaders,
  assertAdmin_: () => {},
  Logger: { log() {} }
};
context.INVESTMENT_HOLDINGS_HEADERS_ = holdingsHeaders;

vm.createContext(context);
vm.runInContext(read('config.js'), context, { filename: 'config.js' });
vm.runInContext(read('financial_identity.js'), context, { filename: 'financial_identity.js' });
vm.runInContext(read('investment_portfolio_foundation.js'), context, { filename: 'investment_portfolio_foundation.js' });
vm.runInContext(read('monthly_checkin_identity.js'), context, { filename: 'monthly_checkin_identity.js' });
vm.runInContext(`
  function round2_(value) { return Math.round(Number(value) * 100) / 100; }
  function toNumber_(value) { return Number(value); }
  function getAssetsHeaderMap_(sheet, display) {
    var headers = display[0] || [];
    return {
      nameColZero: headers.indexOf('Account Name'),
      typeColZero: headers.indexOf('Type'),
      balanceColZero: headers.indexOf('Current Balance'),
      activeColZero: headers.indexOf('Active'),
      investmentIdColZero: headers.indexOf('Investment Id'),
      planningPurposeColZero: headers.indexOf('Planning Purpose'),
      investmentIdCol: headers.indexOf('Investment Id') + 1
    };
  }
  function boundedHoldingsPreviewReadInvestmentIdFromAssetsRow_(displayRow, valueRow, idx) {
    if (idx === -1) return '';
    return String(displayRow[idx] || valueRow[idx] || '').trim();
  }
  function boundedHoldingsPreviewIsExcludedAssetsName_(name) {
    return /^(account totals|total values|house assets|delta|year|account name)$/i.test(String(name || '').trim());
  }
  function boundedHoldingsPreviewMatchGroupProvider_() { return null; }
  ${extractFunction(read('bounded_holdings_preview.js'), 'boundedHoldingsPreviewReadActiveInvestmentAccounts_')}
  ${extractFunction(read('bounded_holdings_preview.js'), 'boundedHoldingsPreviewInvestmentLifecycleCounts_')}
  ${extractFunction(read('bounded_holdings_preview.js'), 'boundedHoldingsPreviewMapAccountRow_')}
`, context, { filename: 'bounded_holdings_preview_partial.js' });
vm.runInContext(read('bounded_holdings_preview_apply_sheet.js'), context, { filename: 'bounded_holdings_preview_apply_sheet.js' });
vm.runInContext(read('bounded_holdings_preview_apply_diff.js'), context, { filename: 'bounded_holdings_preview_apply_diff.js' });
vm.runInContext(previewSource, context, { filename: 'robinhood_unified_migration_preview.js' });

const ss = buildWorkbook();
const preview = context.buildRobinhoodUnifiedMigrationPreview_(ss);
assert.equal(preview.ok, true);
assert.equal(preview.previewOnly, true);
assert.equal(preview.summary.accountCount, 1);
assert.equal(preview.summary.legacyHoldingsRowCount, 2);
assert.equal(preview.summary.legacyTickerCount, 2);
assert.equal(preview.summary.createCount, 2);
assert.equal(preview.summary.updateCount, 0);
assert.equal(preview.summary.unchangedCount, 0);
assert.equal(preview.summary.conflictCount, 0);

const account = preview.accounts[0];
assert.equal(account.investmentId, investmentId);
assert.equal(account.identityChecks.financialAccounts.identityReady, true);
assert.equal(account.identityChecks.accountSourceLink.status, 'NOT_REQUIRED');
assert.equal(account.identityChecks.accountSourceLink.required, false);

const aapl = account.holdings.find((row) => row.ticker === 'AAPL');
assert.ok(aapl, 'AAPL holding preview must exist');
assert.equal(aapl.proposedAction, 'CREATE');
assert.equal(aapl.fieldMapping.source, 'ROBINHOOD_CSV');
assert.equal(aapl.fieldMapping.provider, 'ROBINHOOD');
assert.equal(aapl.fieldMapping.sourceSecurityKey.key, 'TICKER:AAPL');
assert.equal(aapl.targetUnified.symbol, 'AAPL');
assert.equal(aapl.targetUnified.shares, 2);
assert.equal(aapl.targetUnified.price, 150);
assert.equal(aapl.targetUnified.marketValue, 300);
assert.equal(aapl.targetUnified.costBasis, 300);
assert.equal(aapl.duplicateDetection.existingUnifiedRowFound, false);
assert.equal(aapl.fieldMapping.provenance.authority, 'CASHCOMPASS_RECONSTRUCTED');

const duplicateSs = buildWorkbook({
  unifiedRows: [[
    'ROBINHOOD_CSV', 'ROBINHOOD', 'Robinhood Brokerage', '', investmentId, 'TICKER:AAPL',
    'AAPL', 'AAPL', 2, 150, 300, 300, '', '', '2026-08-15', 'existing-fp', 'APPLIED',
    '2026-08-16 10:00:00', 'seed'
  ]]
});
const duplicatePreview = context.buildRobinhoodUnifiedMigrationPreview_(duplicateSs);
const duplicateAccount = duplicatePreview.accounts[0];
assert.equal(duplicatePreview.summary.createCount, 1);
assert.equal(duplicatePreview.summary.conflictCount, 1);
const duplicateAapl = duplicateAccount.holdings.find((row) => row.ticker === 'AAPL');
assert.equal(duplicateAapl.proposedAction, 'CONFLICT');
assert.ok(duplicateAapl.conflictReasons.includes('DOCUMENT_FINGERPRINT_MISMATCH'));
assert.equal(duplicateAapl.duplicateDetection.existingUnifiedRowFound, true);

const identityBlockedSs = buildWorkbook({ includeFinancial: false });
const identityBlockedPreview = context.buildRobinhoodUnifiedMigrationPreview_(identityBlockedSs);
assert.equal(identityBlockedPreview.accounts[0].identityBlocked, true);
assert.equal(identityBlockedPreview.accounts[0].identityChecks.accountSourceLink.status, 'REQUIRED');
assert.equal(identityBlockedPreview.summary.identityBlockedAccountCount, 1);

assert.equal(ss.writeAttempts, 0);
assert.equal(duplicateSs.writeAttempts, 0);

const emptySs = buildWorkbook({ activityRows: [], holdingsRows: [] });
const emptyPreview = context.buildRobinhoodUnifiedMigrationPreview_(emptySs);
assert.equal(emptyPreview.ok, true);
assert.equal(emptyPreview.accounts.length, 0);
assert.match(emptyPreview.message, /No Robinhood activity rows found/);

console.log('checkRobinhoodUnifiedMigrationPreviewRegressions: ok');
