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
const adaptersSource = read('investment_adapters.js');
const activitySource = read('investment_activity.js');
const dashboardInvestments = read('Dashboard_Script_AssetsBankInvestments.html');

const utilities = {
  DigestAlgorithm: { SHA_256: 'SHA_256' },
  Charset: { UTF_8: 'UTF_8' },
  computeDigest(_algorithm, value) {
    return [...crypto.createHash('sha256').update(String(value), 'utf8').digest()]
      .map((byte) => (byte > 127 ? byte - 256 : byte));
  }
};

const context = {
  Utilities: utilities,
  String, Number, Object, Array, Math, isFinite, Error, JSON, console
};
vm.createContext(context);
vm.runInContext(configSource, context, { filename: 'config.js' });
vm.runInContext(identitySource, context, { filename: 'financial_identity.js' });
vm.runInContext(foundationSource, context, { filename: 'investment_portfolio_foundation.js' });
vm.runInContext(`
  function round2_(value) { return Math.round(Number(value) * 100) / 100; }
  ${extractFunction(activitySource, 'normalizeInvestmentImportDate_')}
  ${extractFunction(activitySource, 'parseInvestmentImportMoney_')}
  ${extractFunction(activitySource, 'parseInvestmentImportNumber_')}
`, context, { filename: 'investment_activity_partial.js' });
vm.runInContext(etradeSource, context, { filename: 'investment_etrade_csv.js' });
vm.runInContext(adaptersSource, context, { filename: 'investment_adapters.js' });

const minimalCsv = fixture('synthetic_etrade_txn_minimal.csv');
const overlapCsv = fixture('synthetic_etrade_txn_overlap.csv');

// --- Adapter registry ---
assert.deepEqual(context.listInvestmentAdapterSources_().sort(), [
  'ETRADE_CSV', 'ETRADE_PACKAGE', 'ROBINHOOD_CSV'
]);
assert.throws(() => context.getInvestmentAdapter_('M1_CSV'), /not implemented/);

// --- Detect ---
assert.equal(context.investmentEtradeDetectTxnCsv_({ rawCsv: minimalCsv }).ok, true);
assert.equal(context.investmentEtradeDetectTxnCsv_({ rawCsv: minimalCsv }).source, 'ETRADE_PACKAGE');
assert.equal(context.investmentAdapterDetectRobinhoodCsv_({ rawCsv: minimalCsv }).ok, false);

// --- Preamble / footer ---
const parsed = context.investmentEtradeParseTxnCsv_(minimalCsv);
assert.equal(parsed.ok, true);
assert.ok(parsed.preamble.lineCount >= 6, 'Preamble must include six structural lines before header');
assert.match(parsed.preamble.accountLabel, /TEST-ACCT-0001/);
assert.equal(parsed.preamble.total, 1234.56);
assert.ok(parsed.footerRows.length >= 4, 'Footer disclaimer rows must be excluded from data parse');
assert.ok(parsed.dataRows.length >= 18, 'Synthetic fixture must include supported activity rows');

// --- Preview entry point ---
const preview = context.investmentAdapterPreviewEtradePackage_({
  source: 'ETRADE_PACKAGE',
  rawCsv: minimalCsv,
  accountMeta: {
    stableAccountId: 'INV-ET-SYNTH-1',
    registrationType: 'TAXABLE',
    accountName: 'Synthetic E*TRADE Taxable'
  }
});
assert.equal(preview.ok, true);
assert.equal(preview.source, 'ETRADE_PACKAGE');
assert.equal(preview.parserVersion, 'etrade-txn-csv-v1');
assert.equal(preview.normalized.source, 'ETRADE_PACKAGE');
assert.ok(preview.normalized.activities.length >= 18);
assert.equal(preview.normalized.capabilities.holdings, false);
assert.equal(preview.normalized.capabilities.realizedGainLoss, false);

const byType = {};
preview.normalized.activities.forEach((row) => {
  const key = row.activityType + (row.activitySubtype ? `:${row.activitySubtype}` : '');
  byType[key] = (byType[key] || 0) + 1;
});
assert.ok(byType['BUY'] >= 2, 'Fixture must include Bought rows including overlap duplicate');
assert.equal(byType['SELL'], 1);
assert.equal(byType['DIVIDEND:QUALIFIED_DIVIDEND'], 1);
assert.equal(byType['REINVESTMENT:REINVESTMENT'], 1);
assert.equal(byType['DIVIDEND'], 1);
assert.ok(byType['CONTRIBUTION:ONLINE_TRANSFER'] >= 1);
assert.ok(byType['WITHDRAWAL:ONLINE_TRANSFER'] >= 1 || byType['TRANSFER_OUT:ONLINE_TRANSFER'] >= 1);
assert.ok(byType['TRANSFER_OUT'] >= 1);
assert.ok(byType['TRANSFER_IN'] >= 1);
assert.equal(byType['CORPORATE_ACTION:EXCHANGE_DELIVERED'], 1);
assert.equal(byType['CORPORATE_ACTION:EXCHANGE_RECEIVED'], 1);
assert.equal(byType['CORPORATE_ACTION:CASH_IN_LIEU'], 1);
assert.equal(byType['SPLIT:STOCK_SPLIT'], 1);
assert.equal(byType['CORPORATE_ACTION:REDEMPTION'], 1);
assert.equal(byType['CORPORATE_ACTION:CANCEL_SOLD'], 1);
assert.ok(byType['FEE:SERVICE_FEE'] >= 2);

// --- Service fee signed amounts: debits stay negative, reversals stay positive ---
const feeDebitRow = preview.normalized.activities.find((row) =>
  row.activityType === 'FEE' && /REORG/i.test(String(row.description || '')));
const feeCreditRow = preview.normalized.activities.find((row) =>
  row.activityType === 'FEE' && /REVERSAL/i.test(String(row.description || '')));
assert.ok(feeDebitRow, 'Mandatory reorg fee must normalize as FEE');
assert.ok(feeCreditRow, 'Fee reversal must normalize as FEE');
assert.equal(feeDebitRow.amount, -25);
assert.equal(feeCreditRow.amount, 25);
assert.equal(feeDebitRow.activitySubtype, 'SERVICE_FEE');
assert.equal(feeCreditRow.activitySubtype, 'SERVICE_FEE');
assert.notEqual(feeDebitRow.activityType, 'EXPENSE');
assert.notEqual(feeCreditRow.activityType, 'EXPENSE');

assert.equal(byType.INTEREST, 1);

// --- Transfers / exchanges must not be trades ---
preview.normalized.activities.forEach((row) => {
  if (row.activityType === 'TRANSFER_IN' || row.activityType === 'TRANSFER_OUT' ||
      row.activityType === 'CONTRIBUTION' || row.activityType === 'WITHDRAWAL' ||
      row.activitySubtype === 'EXCHANGE_RECEIVED' || row.activitySubtype === 'EXCHANGE_DELIVERED') {
    assert.equal(context.investmentPortfolioActivityHasTradeSemantics_(row), false);
    assert.notEqual(row.activityType, 'BUY');
    assert.notEqual(row.activityType, 'SELL');
  }
});

// --- Dividend income not double-counted ---
assert.equal(preview.normalized.dividendIncome.totalCashDividendIncome, 15,
  'Qualified + cash dividend income must exclude reinvestment leg');
const reinvestRow = preview.normalized.activities.find((row) =>
  row.activityType === 'REINVESTMENT' && row.ticker === 'SYNAAA');
assert.ok(reinvestRow);
assert.equal(reinvestRow.activitySubtype, 'REINVESTMENT');
assert.ok(reinvestRow.dividendGroupKey, 'Dividend rows must carry dividendGroupKey for income dedupe');
assert.notEqual(reinvestRow.dividendGroupKey, reinvestRow.sourceRecordKey,
  'dividendGroupKey must not be used as sourceRecordKey');
assert.notEqual(reinvestRow.dividendGroupKey, reinvestRow.replayKey,
  'dividendGroupKey must not be used as replayKey');

// --- REFID and fingerprint source keys ---
const refidRow = preview.normalized.activities.find((row) =>
  row.sourceRecordKey === 'REFID:1234567890');
assert.ok(refidRow, 'ACH deposit row must preserve REFID sourceRecordKey');
const fingerprintRow = preview.normalized.activities.find((row) =>
  row.activityType === 'BUY' && row.ticker === 'SYNETF');
assert.ok(fingerprintRow);
assert.match(fingerprintRow.sourceRecordKey, /^FP:/);
assert.equal(fingerprintRow.fees, 0.99);

const fractionalRow = preview.normalized.activities.find((row) =>
  row.ticker === 'SYNETF' && row.activityType === 'BUY');
assert.ok(fractionalRow);
assert.ok(Math.abs(Number(fractionalRow.quantity) - 0.123) < 0.0001);

// --- Exact replay within same file (duplicate bought row) ---
const buyRows = preview.normalized.activities.filter((row) =>
  row.activityType === 'BUY' && row.ticker === 'SYNAAA' && row.amount === -250);
assert.equal(buyRows.length, 2);
assert.equal(buyRows[0].sourceRecordKey, buyRows[1].sourceRecordKey);
assert.equal(buyRows[0].replayKey, buyRows[1].replayKey);
const duplicateBuy = buyRows.find((row) => row.intraFileOutcome === 'DUPLICATE_EXACT');
assert.ok(duplicateBuy, 'Second identical row must be flagged DUPLICATE_EXACT');
assert.equal(duplicateBuy.reviewRequired, true);
assert.equal(preview.normalized.intraFileSummary.exactDuplicates, 1);
assert.equal(preview.normalized.importSummary.activities.intraFileExactDuplicates, 1);
assert.equal(preview.reviewRequired, true,
  'Intra-file duplicate sourceRecordKey must require review before persistence');

// --- Overlapping export replay behavior ---
const firstImport = context.investmentAdapterPreviewEtradePackage_({
  source: 'ETRADE_PACKAGE',
  rawCsv: minimalCsv,
  accountMeta: { stableAccountId: 'INV-ET-SYNTH-1', registrationType: 'TAXABLE' }
});

const secondImport = context.investmentAdapterPreviewEtradePackage_({
  source: 'ETRADE_PACKAGE',
  rawCsv: overlapCsv,
  existingActivities: firstImport.normalized.activities,
  accountMeta: { stableAccountId: 'INV-ET-SYNTH-1', registrationType: 'TAXABLE' }
});
assert.equal(secondImport.ok, true);
assert.ok(secondImport.normalized.replaySummary.exactReplays >= 1,
  'Overlap export must detect at least one exact replay');
assert.ok(secondImport.normalized.replaySummary.sourceCorrections >= 1,
  'Overlap export must detect REFID source correction');
assert.ok(secondImport.normalized.replaySummary.newRecords >= 1,
  'Overlap export must detect at least one new record');

const corrected = secondImport.normalized.activities.find((row) =>
  row.sourceRecordKey === 'REFID:1234567890');
assert.equal(corrected.replayOutcome, 'SOURCE_CORRECTION');
assert.equal(corrected.amount, 505);
const replayedBuy = secondImport.normalized.activities.find((row) =>
  row.activityType === 'BUY' && row.ticker === 'SYNAAA' && row.replayOutcome === 'EXACT_REPLAY');
assert.ok(replayedBuy, 'Overlap export must exact-replay prior bought row');
const priorBuy = firstImport.normalized.activities.find((row) =>
  row.activityType === 'BUY' && row.ticker === 'SYNAAA' && row.amount === -250);
assert.equal(replayedBuy.sourceRecordKey, priorBuy.sourceRecordKey,
  'Exact replay must preserve sourceRecordKey');
assert.equal(corrected.sourceRecordKey, 'REFID:1234567890',
  'Source correction must preserve REFID sourceRecordKey');

// --- Distinct fingerprint keys for distinct transactions ---
const buySynaaa = preview.normalized.activities.find((row) =>
  row.activityType === 'BUY' && row.ticker === 'SYNAAA');
const buySynetf = preview.normalized.activities.find((row) =>
  row.activityType === 'BUY' && row.ticker === 'SYNETF');
assert.notEqual(buySynaaa.sourceRecordKey, buySynetf.sourceRecordKey);

// --- No-REFID same-day generic-description collision (real-export pattern) ---
const ambiguousCsv = [
  'All Transactions Activity Types',
  '',
  'Account TEST-ACCT-0001 | Jan 1, 2024 - Aug 28, 2026',
  '',
  'Total: $0.00',
  '',
  'Activity/Trade Date,Transaction Date,Settlement Date,Activity Type,Description,Symbol,Cusip,Quantity #,Price $,Amount $,Commission,Category,Note',
  '01/23/2025,01/23/2025,01/24/2025,Bought,SYNCCC UNSOLICITED TRADE,SYNCCC,--,323,6.24,-2015.52,0.0,--,--',
  '01/23/2025,01/23/2025,01/24/2025,Bought,SYNCCC UNSOLICITED TRADE,SYNCCC,--,298,6.65,-1981.70,0.0,--,--',
  'Disclaimer row only,,,,,,,,,,,,'
].join('\n');
const ambiguousPreview = context.investmentAdapterPreviewEtradePackage_({
  source: 'ETRADE_PACKAGE',
  rawCsv: ambiguousCsv,
  accountMeta: { stableAccountId: 'INV-ET-SYNTH-1', registrationType: 'TAXABLE' }
});
assert.equal(ambiguousPreview.ok, true);
const ambiguousBuys = ambiguousPreview.normalized.activities.filter((row) =>
  row.activityType === 'BUY' && row.ticker === 'SYNCCC');
assert.equal(ambiguousBuys.length, 2);
assert.notEqual(ambiguousBuys[0].sourceRecordKey, ambiguousBuys[1].sourceRecordKey,
  'Distinct same-day fills must keep distinct no-REFID sourceRecordKeys');
assert.equal(ambiguousBuys[0].sourceIdentityStrength, 'AMBIGUOUS');
assert.equal(ambiguousBuys[0].reviewRequired, true);
assert.ok(ambiguousPreview.normalized.stableKeyAmbiguity.groups >= 1,
  'Same-day generic-description collision must surface stable-key ambiguity');
assert.equal(ambiguousPreview.reviewRequired, true);

const noRefidCorrectedCsv = minimalCsv.replace('-12.30', '-12.50').replace('0.99', '1.99');
const correctedNoRefidImport = context.investmentAdapterPreviewEtradePackage_({
  source: 'ETRADE_PACKAGE',
  rawCsv: noRefidCorrectedCsv,
  existingActivities: firstImport.normalized.activities,
  accountMeta: { stableAccountId: 'INV-ET-SYNTH-1', registrationType: 'TAXABLE' }
});
const synetfPrior = firstImport.normalized.activities.find((row) =>
  row.activityType === 'BUY' && row.ticker === 'SYNETF');
const correctedSynetf = correctedNoRefidImport.normalized.activities.find((row) =>
  row.activityType === 'BUY' && row.ticker === 'SYNETF');
assert.notEqual(correctedSynetf.sourceRecordKey, synetfPrior.sourceRecordKey,
  'No-REFID amount change must not reuse prior sourceRecordKey');
assert.notEqual(correctedSynetf.replayOutcome, 'SOURCE_CORRECTION',
  'No-REFID corrections must not auto-classify as SOURCE_CORRECTION');

// --- Account identity fail-closed without stableAccountId or preamble ---
const noIdentityCsv = [
  'Activity/Trade Date,Transaction Date,Settlement Date,Activity Type,Description,Symbol,Cusip,Quantity #,Price $,Amount $,Commission,Category,Note',
  '01/15/2024,01/15/2024,01/16/2024,Bought,SYNAAA BUY,SYNAAA,--,1,10.00,-10.00,0.0,--,--'
].join('\n');
assert.equal(context.investmentAdapterPreviewEtradePackage_({
  source: 'ETRADE_PACKAGE',
  rawCsv: noIdentityCsv
}).ok, false);
const preambleOnlyPreview = context.investmentAdapterPreviewEtradePackage_({
  source: 'ETRADE_PACKAGE',
  rawCsv: minimalCsv
});
assert.equal(preambleOnlyPreview.ok, true);
assert.equal(preambleOnlyPreview.reviewRequired, true,
  'Missing stableAccountId must require review even when preamble account line exists');

// --- ETRADE_PACKAGE files[] input matches rawCsv ---
const packageFilesPreview = context.investmentAdapterPreviewEtradePackage_({
  source: 'ETRADE_PACKAGE',
  files: [{ role: 'ACTIVITY', content: minimalCsv }],
  accountMeta: { stableAccountId: 'INV-ET-SYNTH-1' }
});
assert.equal(packageFilesPreview.ok, true);
assert.equal(packageFilesPreview.normalized.activities.length,
  preview.normalized.activities.length);

// --- Quoted CSV fields ---
const quotedCsv = [
  'All Transactions Activity Types',
  '',
  'Account TEST-ACCT-0001 | Jan 1, 2024 - Aug 28, 2026',
  '',
  'Total: $0.00',
  '',
  'Activity/Trade Date,Transaction Date,Settlement Date,Activity Type,Description,Symbol,Cusip,Quantity #,Price $,Amount $,Commission,Category,Note',
  '05/01/2024,05/01/2024,05/02/2024,Bought,"SYNAAA, synthetic buy",SYNAAA,--,1,10.00,-10.00,0.0,--,--',
  'Disclaimer row only,,,,,,,,,,,,'
].join('\n');
const quotedPreview = context.investmentAdapterPreviewEtradePackage_({
  source: 'ETRADE_PACKAGE',
  rawCsv: quotedCsv,
  accountMeta: { stableAccountId: 'INV-ET-SYNTH-1' }
});
assert.equal(quotedPreview.ok, true);
assert.equal(quotedPreview.normalized.activities[0].description, 'SYNAAA, synthetic buy');

// --- ETRADE_CSV alias ---
const csvPreview = context.investmentAdapterBuildPackagePreview_({
  source: 'ETRADE_CSV',
  rawCsv: minimalCsv,
  accountMeta: { stableAccountId: 'INV-ET-SYNTH-1' }
});
assert.equal(csvPreview.ok, true);
assert.equal(csvPreview.normalized.source, 'ETRADE_CSV');

// --- Malformed / unsupported fail safely ---
assert.equal(context.investmentEtradeParseTxnCsv_('').ok, false);
assert.equal(context.investmentAdapterPreviewEtradePackage_({
  source: 'ETRADE_PACKAGE',
  rawCsv: 'Date,Amount\n1/1/2024,1'
}).ok, false);
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
const badPreview = context.investmentAdapterPreviewEtradePackage_({
  source: 'ETRADE_PACKAGE',
  rawCsv: badRowCsv,
  accountMeta: { stableAccountId: 'INV-ET-SYNTH-1' }
});
assert.equal(badPreview.ok, true);
assert.equal(badPreview.normalized.activities.length, 0);
assert.ok(badPreview.normalized.unsupportedRows.length >= 1);

// --- Activity taxonomy completeness (14 documented E*TRADE Activity Type labels) ---
const documentedEtradeActivityTypes = [
  'Bought', 'Sold', 'Dividend', 'Qualified Dividend', 'Transfer', 'Online Transfer',
  'Exchange Received In', 'Exchange Delivered Out', 'Cash in Lieu', 'Stock Split',
  'Redemption', 'Cancel Sold', 'Service Fee', 'Interest Income'
];
assert.equal(documentedEtradeActivityTypes.length, 14,
  'Documented E*TRADE Activity Type label count must stay aligned with ETRADE_SOURCE_MAPPING.md');
documentedEtradeActivityTypes.forEach((label) => {
  assert.match(minimalCsv, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
    `Synthetic fixture must include documented Activity Type label: ${label}`);
  const mapped = context.investmentPortfolioMapEtradeSourceActivity_({
    etradeActivityType: label,
    description: label === 'Dividend' ? 'SYNAAA DIVIDEND REINVESTMENT' : `${label} SYNTHETIC`,
    amount: label === 'Sold' ? 100 : (label === 'Online Transfer' ? -100 : 10),
    quantity: label === 'Sold' ? -5 : (label === 'Exchange Delivered Out' ? -10 : 1),
    activityDate: '2024-01-01',
    ticker: 'SYNAAA'
  });
  assert.notEqual(mapped.activityType, 'UNSUPPORTED', `${label} must map to a supported activityType`);
});

// --- Workbook / UI safety ---
assert.doesNotMatch(etradeSource, /previewInvestmentActivityImportFromDashboard/,
  'E*TRADE parser must not call Robinhood production preview');
assert.doesNotMatch(etradeSource, /investmentPortfolioEnsure/,
  'E*TRADE parser must not create workbook sheets');
assert.doesNotMatch(dashboardInvestments,
  /investmentAdapterPreviewEtradePackage_|investmentEtradePreviewTxnCsv_/,
  'Dashboard must not wire E*TRADE preview yet');

console.log('E*TRADE adapter regressions passed.');
