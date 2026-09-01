import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const read = (name) => fs.readFileSync(new URL(name, root), 'utf8');
const fixture = (name) => read(`test/fixtures/etrade/${name}`);

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

const configSource = read('config.js');
const identitySource = read('financial_identity.js');
const foundationSource = read('investment_portfolio_foundation.js');
const etradeSource = read('investment_etrade_csv.js');
const etradePositionsSource = read('investment_etrade_positions_pdf.js');
const adaptersSource = read('investment_adapters.js');
const activitySource = read('investment_activity.js');
const previewLabSource = read('central_etrade_preview_lab.js');
const webappSource = read('webapp.js');
const htmlSource = read('EtradePreviewLabUI.html');
const adminDiagSource = read('AdminDiagnostics.html');

const utilities = {
  DigestAlgorithm: { SHA_256: 'SHA_256' },
  Charset: { UTF_8: 'UTF_8' },
  computeDigest(_algorithm, value) {
    return [...crypto.createHash('sha256').update(String(value), 'utf8').digest()]
      .map((byte) => (byte > 127 ? byte - 256 : byte));
  }
};

function buildContext(overrides = {}) {
  const context = {
    Utilities: utilities,
    String, Number, Object, Array, Math, isFinite, Error, JSON, console,
    assertAdmin_: () => {
      if (!context.__admin) throw new Error('Admin access required.');
    },
    isAdminUser_: () => !!context.__admin,
    isCentralModeEnabled_: () => context.__central !== false,
    ...overrides
  };
  context.__admin = overrides.admin !== false;
  context.__central = overrides.central !== false;
  vm.createContext(context);
  vm.runInContext(configSource, context, { filename: 'config.js' });
  vm.runInContext(identitySource, context, { filename: 'financial_identity.js' });
  vm.runInContext(foundationSource, context, { filename: 'investment_portfolio_foundation.js' });
  vm.runInContext(`
    function round2_(value) { return Math.round(Number(value) * 100) / 100; }
    ${extractFunction(activitySource, 'normalizeInvestmentImportDate_')}
    ${extractFunction(activitySource, 'parseInvestmentImportMoney_')}
    ${extractFunction(activitySource, 'parseInvestmentImportNumber_')}
  `, context, { filename: 'activity-stubs.js' });
  vm.runInContext(etradeSource, context, { filename: 'investment_etrade_csv.js' });
  vm.runInContext(etradePositionsSource, context, { filename: 'investment_etrade_positions_pdf.js' });
  vm.runInContext(adaptersSource, context, { filename: 'investment_adapters.js' });
  vm.runInContext(previewLabSource, context, { filename: 'central_etrade_preview_lab.js' });
  return context;
}

const minimalCsv = fixture('synthetic_etrade_txn_minimal.csv');
const overlapCsv = fixture('synthetic_etrade_txn_overlap.csv');
const positionsFixture = fixture('synthetic_etrade_positions_minimal.txt');
const ctx = buildContext();

// --- Admin gating ---
const denied = buildContext({ admin: false });
const deniedResult = denied.adminUiEtradePreviewLabPreview({ rawCsv: minimalCsv });
assert.equal(deniedResult.ok, false);
assert.match(deniedResult.error, /Admin access required/);
const bounded = buildContext({ central: false });
const boundedResult = bounded.adminUiEtradePreviewLabPreview({ rawCsv: minimalCsv });
assert.equal(boundedResult.ok, false);
assert.match(boundedResult.error, /Central mode only/);

// --- Empty file ---
const empty = ctx.adminUiEtradePreviewLabPreview({ rawCsv: '' });
assert.equal(empty.ok, false);
assert.match(empty.error, /CSV or Positions PDF text content is required/i);

// --- Invalid CSV ---
const invalid = ctx.adminUiEtradePreviewLabPreview({
  rawCsv: 'Date,Amount\n1/1/2024,1',
  source: 'ETRADE_CSV'
});
assert.equal(invalid.ok, false);

// --- Valid synthetic CSV (ETRADE_CSV) ---
const csvPreview = ctx.adminUiEtradePreviewLabPreview({
  rawCsv: minimalCsv,
  source: 'ETRADE_CSV',
  stableAccountId: 'INV-ET-PREVIEW-1',
  registrationType: 'TAXABLE',
  accountName: 'Preview Account'
});
assert.equal(csvPreview.ok, true, csvPreview.error || 'preview failed');
assert.equal(csvPreview.source, 'ETRADE_CSV');
assert.ok(csvPreview.parserVersion);
assert.ok(csvPreview.aggregates.acceptedActivityCount > 0);
assert.equal(typeof csvPreview.aggregates.sourceActivityTypeCounts.Bought, 'number');
assert.equal(typeof csvPreview.aggregates.canonicalActivityTypeCounts.BUY, 'number');
assert.ok(Array.isArray(csvPreview.activityPreviewRows));
assert.ok(csvPreview.activityPreviewRows.length > 0);

const row = csvPreview.activityPreviewRows[0];
assert.ok('sourceRowIndex' in row);
assert.ok('activityDate' in row);
assert.ok('symbol' in row);
assert.ok('activityType' in row);
assert.ok('replayOutcome' in row);
assert.ok('reviewRequired' in row);
assert.equal('description' in row, false);
assert.equal('sourceRecordKey' in row, false);
assert.equal('sourceAccountKey' in csvPreview, false);

// --- ETRADE_PACKAGE equivalent ---
const packagePreview = ctx.adminUiEtradePreviewLabPreview({
  rawCsv: minimalCsv,
  source: 'ETRADE_PACKAGE',
  usePackageFiles: true,
  stableAccountId: 'INV-ET-PREVIEW-1'
});
assert.equal(packagePreview.ok, true);
assert.equal(
  packagePreview.aggregates.acceptedActivityCount,
  csvPreview.aggregates.acceptedActivityCount
);
assert.deepEqual(
  packagePreview.aggregates.canonicalActivityTypeCounts,
  csvPreview.aggregates.canonicalActivityTypeCounts
);

// --- Transfer / exchange protection surfaced ---
assert.ok(packagePreview.aggregates.transferCounts.transferIn >= 1 ||
  packagePreview.aggregates.transferCounts.contribution >= 1);
assert.ok(packagePreview.aggregates.exchangeCounts.exchangeReceived >= 1);
assert.ok(packagePreview.aggregates.exchangeCounts.exchangeDelivered >= 1);

// Transfers and exchanges must not map to BUY or SELL
const transferExchangeRows = packagePreview.activityPreviewRows.filter((r) =>
  r.activitySubtype === 'EXCHANGE_RECEIVED' ||
  r.activitySubtype === 'EXCHANGE_DELIVERED' ||
  r.activitySubtype === 'ONLINE_TRANSFER' ||
  r.activityType === 'TRANSFER_IN' ||
  r.activityType === 'TRANSFER_OUT' ||
  r.activityType === 'CONTRIBUTION' ||
  r.activityType === 'WITHDRAWAL'
);
assert.ok(transferExchangeRows.length >= 4, 'fixture must include transfer/exchange rows');
transferExchangeRows.forEach((row) => {
  assert.notEqual(row.activityType, 'BUY', `row ${row.sourceRowIndex} must not be BUY`);
  assert.notEqual(row.activityType, 'SELL', `row ${row.sourceRowIndex} must not be SELL`);
});

// --- Dividend / reinvestment summary ---
assert.ok(packagePreview.aggregates.dividendIncomeSummary.cashDividendIncome > 0,
  'fixture must include cash dividend income');
assert.ok(packagePreview.aggregates.dividendIncomeSummary.reinvestmentCount >= 1,
  'fixture must include reinvestment groups');
const reinvestRows = packagePreview.activityPreviewRows.filter((r) => r.activityType === 'REINVESTMENT');
const dividendRows = packagePreview.activityPreviewRows.filter((r) => r.activityType === 'DIVIDEND');
assert.ok(dividendRows.length >= 1);
assert.ok(reinvestRows.length >= 1);

// --- Service fee preview summaries (net signed vs gross abs volume) ---
assert.equal(csvPreview.aggregates.feeCount, 2);
assert.equal(csvPreview.aggregates.feeNetTotal, 0);
assert.equal(csvPreview.aggregates.feeGrossActivityTotal, 50);
assert.equal(csvPreview.aggregates.feeDebitTotal, -25);
assert.equal(csvPreview.aggregates.feeCreditTotal, 25);
const previewFeeDebit = csvPreview.activityPreviewRows.find((row) =>
  row.activityType === 'FEE' && Number(row.amount) < 0);
const previewFeeCredit = csvPreview.activityPreviewRows.find((row) =>
  row.activityType === 'FEE' && Number(row.amount) > 0);
assert.ok(previewFeeDebit);
assert.ok(previewFeeCredit);
assert.equal(previewFeeDebit.amount, -25);
assert.equal(previewFeeCredit.amount, 25);

// --- Review-required / duplicate / ambiguity via overlap fixture ---
const overlapFirst = ctx.adminUiEtradePreviewLabPreview({
  rawCsv: overlapCsv,
  source: 'ETRADE_CSV',
  stableAccountId: 'INV-ET-OVERLAP-1'
});
assert.equal(overlapFirst.ok, true);

// Duplicate / ambiguity synthetic: two identical source keys in one file
const duplicateCsv = [
  'All Transactions Activity Types',
  '',
  'Account TEST-ACCT-0001 | Jan 1, 2024 - Aug 28, 2026',
  '',
  'Total: $0.00',
  '',
  'Activity/Trade Date,Transaction Date,Settlement Date,Activity Type,Description,Symbol,Cusip,Quantity #,Price $,Amount $,Commission,Category,Note',
  '01/15/2024,01/15/2024,01/16/2024,Bought,REFID:11111111111,SYNAAA,--,1,1.00,-1.00,0.0,--,--',
  '01/15/2024,01/15/2024,01/16/2024,Bought,REFID:11111111111,SYNAAA,--,1,1.00,-1.00,0.0,--,--',
  'Disclaimer row only,,,,,,,,,,,,'
].join('\n');
const dupPreview = ctx.adminUiEtradePreviewLabPreview({
  rawCsv: duplicateCsv,
  source: 'ETRADE_CSV',
  stableAccountId: 'INV-ET-DUP-1'
});
assert.equal(dupPreview.ok, true);
assert.ok(dupPreview.aggregates.duplicateCount >= 1);
assert.equal(dupPreview.reviewRequired, true);

const ambiguityCsv = [
  'All Transactions Activity Types',
  '',
  'Account TEST-ACCT-0001 | Jan 1, 2024 - Aug 28, 2026',
  '',
  'Total: $0.00',
  '',
  'Activity/Trade Date,Transaction Date,Settlement Date,Activity Type,Description,Symbol,Cusip,Quantity #,Price $,Amount $,Commission,Category,Note',
  '01/15/2024,01/15/2024,01/16/2024,Bought,UNSOLICITED TRADE,SYNAAA,--,1,10.00,-10.00,0.0,--,--',
  '01/15/2024,01/15/2024,01/16/2024,Bought,UNSOLICITED TRADE,SYNAAA,--,2,20.00,-40.00,0.0,--,--',
  'Disclaimer row only,,,,,,,,,,,,'
].join('\n');
const ambPreview = ctx.adminUiEtradePreviewLabPreview({
  rawCsv: ambiguityCsv,
  source: 'ETRADE_CSV',
  stableAccountId: 'INV-ET-AMB-1'
});
assert.equal(ambPreview.ok, true);
assert.ok(ambPreview.aggregates.stableKeyAmbiguityCount >= 1);
assert.equal(ambPreview.reviewRequired, true);

// --- Unsupported rows sanitized (no raw cells) ---
const badRowCsv = [
  'All Transactions Activity Types',
  '',
  'Account TEST-ACCT-0001 | Jan 1, 2024 - Aug 28, 2026',
  '',
  'Total: $0.00',
  '',
  'Activity/Trade Date,Transaction Date,Settlement Date,Activity Type,Description,Symbol,Cusip,Quantity #,Price $,Amount $,Commission,Category,Note',
  'not-a-date,01/01/2024,01/02/2024,Bought,BAD DATE,SYNAAA,--,1,1.00,-1.00,0.0,--,--',
  'Disclaimer row only,,,,,,,,,,,,'
].join('\n');
const badPreview = ctx.adminUiEtradePreviewLabPreview({
  rawCsv: badRowCsv,
  source: 'ETRADE_CSV',
  stableAccountId: 'INV-ET-BAD-1'
});
assert.equal(badPreview.ok, true);
assert.ok(badPreview.unsupportedRows.length >= 1);
badPreview.unsupportedRows.forEach((row) => {
  assert.equal('cells' in row, false);
  assert.equal('raw' in row, false);
  assert.ok(row.rowIndex);
  assert.ok(row.reason);
});

// --- Positions PDF text preview (Phase B) ---
const positionsPreview = ctx.adminUiEtradePreviewLabPreview({
  rawPositionsText: positionsFixture,
  source: 'ETRADE_PACKAGE',
  usePackageFiles: true,
  stableAccountId: 'INV-ET-POS-PREVIEW-1',
  registrationType: 'TAXABLE'
});
assert.equal(positionsPreview.ok, true, positionsPreview.error || 'positions preview failed');
assert.equal(positionsPreview.aggregates.reportedHoldingsCount, 3);
assert.equal(positionsPreview.aggregates.openLotCount, 5);
assert.equal(positionsPreview.aggregates.washSaleLotCount, 1);
assert.equal(positionsPreview.aggregates.positionsNoiseExcluded.cashRowsExcluded, 1);
assert.equal(positionsPreview.aggregates.positionsNoiseExcluded.pageTotalsExcluded, 2);
assert.ok(positionsPreview.holdingsPreviewRows.length === 3);
assert.ok(positionsPreview.taxLotPreviewRows.length === 5);
assert.equal('stableLotId' in (positionsPreview.taxLotPreviewRows[0] || {}), false);
assert.equal(positionsPreview.reviewRequired, true);

const combinedPreview = ctx.adminUiEtradePreviewLabPreview({
  rawCsv: minimalCsv,
  rawPositionsText: positionsFixture,
  source: 'ETRADE_PACKAGE',
  usePackageFiles: true,
  stableAccountId: 'INV-ET-COMBINED-1'
});
assert.equal(combinedPreview.ok, true);
assert.ok(combinedPreview.aggregates.acceptedActivityCount > 0);
assert.equal(combinedPreview.aggregates.reportedHoldingsCount, 3);
assert.match(combinedPreview.parserVersion, /etrade-positions-pdf-v1/);

// --- Clear endpoint ---
const cleared = ctx.adminUiEtradePreviewLabClear();
assert.equal(cleared.ok, true);

// --- Optional real private CSV (never copied into Git) ---
const privateCsvPath = process.env.ETRADE_PRIVATE_CSV_PATH || '';
if (privateCsvPath && fs.existsSync(privateCsvPath)) {
  const realCsv = fs.readFileSync(privateCsvPath, 'utf8');
  const realPreview = ctx.adminUiEtradePreviewLabPreview({
    rawCsv: realCsv,
    source: 'ETRADE_CSV',
    stableAccountId: 'INV-ET-REAL-PREVIEW'
  });
  assert.equal(realPreview.ok, true, realPreview.error || 'real csv preview failed');
  assert.equal(realPreview.aggregates.acceptedActivityCount, 356);
  assert.equal(realPreview.aggregates.unsupportedRowCount, 0);
  assert.equal(realPreview.aggregates.feeCount, 10);
  assert.equal(realPreview.aggregates.feeGrossActivityTotal, 380);
  assert.ok(realPreview.aggregates.stableKeyAmbiguityCount >= 7);
  assert.ok(realPreview.aggregates.dividendIncomeSummary.reinvestmentCount >= 100);
  assert.ok(realPreview.aggregates.feeGrossActivityTotal >=
    Math.abs(realPreview.aggregates.feeNetTotal));
  assert.equal('description' in (realPreview.activityPreviewRows[0] || {}), false);
}

// --- No workbook / persistence calls in preview lab module ---
assert.doesNotMatch(previewLabSource, /SpreadsheetApp|getUserSpreadsheet_|getActiveSpreadsheet/,
  'Preview lab must not touch spreadsheets');
assert.doesNotMatch(previewLabSource, /CacheService|PropertiesService|DriveApp|Logger\.log/,
  'Preview lab must not persist or log sensitive content');
assert.doesNotMatch(previewLabSource, /investmentAdapterNormalize|previewInvestmentActivityImport/,
  'Preview lab must not call normalize/apply import paths');
assert.doesNotMatch(previewLabSource, /investmentPortfolioEnsure|setValues|appendRow/,
  'Preview lab must not write workbook data');

// --- Route and UI safety ---
assert.match(webappSource, /view === 'etrade-preview-lab' && isAdminUser_\(\)/,
  'webapp must register admin-gated etrade-preview-lab route');
assert.match(adminDiagSource, /view=etrade-preview-lab/,
  'Admin Diagnostics must link to E*TRADE Preview Lab');
assert.match(htmlSource, /Preview only — no workbook changes or import will occur/,
  'UI must show preview-only banner');
assert.doesNotMatch(htmlSource, /button[^>]*>\s*(Apply|Import|Save|Persist)\b/i,
  'UI must not expose persist action buttons');
assert.match(htmlSource, /adminUiEtradePreviewLabPreview/,
  'UI must call preview RPC only');

console.log('E*TRADE Preview Lab regressions passed.');
