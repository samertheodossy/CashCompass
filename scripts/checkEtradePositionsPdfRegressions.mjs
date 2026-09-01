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
const etradeCsvSource = read('investment_etrade_csv.js');
const etradePositionsSource = read('investment_etrade_positions_pdf.js');
const adaptersSource = read('investment_adapters.js');
const activitySource = read('investment_activity.js');

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
vm.runInContext(etradeCsvSource, context, { filename: 'investment_etrade_csv.js' });
vm.runInContext(etradePositionsSource, context, { filename: 'investment_etrade_positions_pdf.js' });
vm.runInContext(adaptersSource, context, { filename: 'investment_adapters.js' });

const positionsFixture = fixture('synthetic_etrade_positions_minimal.txt');
const minimalCsv = fixture('synthetic_etrade_txn_minimal.csv');
const accountMeta = {
  stableAccountId: 'INV-ET-POS-1',
  registrationType: 'TAXABLE',
  accountName: 'Synthetic Positions Preview'
};

// --- Detect ---
assert.equal(context.investmentEtradeDetectPositionsPdf_({
  rawPositionsText: positionsFixture
}).ok, true);
assert.equal(context.investmentEtradeDetectPackage_({
  rawPositionsText: positionsFixture
}).inferredRoles.join(','), 'HOLDINGS');
assert.equal(context.investmentEtradeDetectPackage_({
  rawCsv: minimalCsv,
  rawPositionsText: positionsFixture
}).inferredRoles.sort().join(','), 'ACTIVITY,HOLDINGS');

// --- Preamble / header ---
const parsed = context.investmentEtradeParsePositionsPdfText_(positionsFixture);
assert.equal(parsed.ok, true);
assert.match(parsed.preamble.accountLabel, /TEST-ACCT-POS-1/);
assert.match(parsed.preamble.refreshAt, /Aug 15, 2025/);
assert.equal(parsed.preamble.netAccountValue, 125000);
assert.ok(parsed.parsedRows.length >= 8, 'fixture must include headers and lot rows');

// --- Noise exclusion ---
assert.equal(parsed.noiseRows.filter((row) => row.reason === 'CASH_ROW').length, 1);
assert.equal(parsed.noiseRows.filter((row) => row.reason === 'PAGE_TOTAL').length, 2);

// --- Position headers ---
const preview = context.investmentEtradePreviewPositionsPdf_({
  source: 'ETRADE_PACKAGE',
  rawPositionsText: positionsFixture,
  accountMeta
});
assert.equal(preview.ok, true, preview.error || 'positions preview failed');
assert.equal(preview.parserVersion, 'etrade-positions-pdf-v1');
assert.equal(preview.normalized.holdingsSnapshots.length, 3);
const tickers = preview.normalized.holdingsSnapshots.map((row) => row.ticker).sort();
assert.ok(tickers.join(',') === 'SYNAAA,SYNBBB,SYNETF', tickers.join(','));

const synaaa = preview.normalized.holdingsSnapshots.find((row) => row.ticker === 'SYNAAA');
assert.equal(synaaa.quantity, 30);
assert.equal(synaaa.currentPrice, 150);
assert.equal(synaaa.marketValue, 4500);
assert.equal(synaaa.providerCostBasis, 3500);
assert.equal(synaaa.unrealizedGain, 1000);
assert.equal(synaaa.authority, 'PROVIDER_REPORTED');
assert.equal(synaaa.openLotCount, 2);

// --- Open lots ---
assert.equal(preview.normalized.taxLots.length, 5);
const washLot = preview.normalized.taxLots.find((lot) => lot.washSaleAdjusted);
assert.ok(washLot, 'fixture must include wash-sale lot marker');
assert.match(washLot.sourceLotKey, /WS/i);
assert.equal(washLot.ticker, 'SYNAAA');
assert.equal(washLot.remainingQuantity, 20);
assert.equal(washLot.originalCostBasis, 2500);

preview.normalized.taxLots.forEach((lot) => {
  assert.equal(context.investmentPortfolioValidateTaxLot_(lot).ok, true);
});

// --- Review-required ambiguity (qty mismatch + corporate marker) ---
const synbbb = preview.normalized.holdingsSnapshots.find((row) => row.ticker === 'SYNBBB');
assert.ok(synbbb.reviewRequired, 'SYNBBB header/lot qty mismatch must require review');
assert.equal(preview.reviewRequired, true);
assert.ok(preview.normalized.warnings.some((text) => /SYNBBB|mismatch/i.test(text)));

// --- Malformed / ambiguous unsupported rows ---
assert.ok(preview.normalized.unsupportedRows.some((row) => row.reason === 'MALFORMED_POSITION_HEADER'));
assert.ok(preview.normalized.unsupportedRows.some((row) =>
  row.reason === 'AMBIGUOUS_ROW' || row.reason === 'MALFORMED_POSITION_HEADER'));

// --- Deterministic output ---
const previewAgain = context.investmentEtradePreviewPositionsPdf_({
  source: 'ETRADE_PACKAGE',
  rawPositionsText: positionsFixture,
  accountMeta
});
assert.deepEqual(
  preview.normalized.holdingsSnapshots.map((row) => ({
    ticker: row.ticker,
    quantity: row.quantity,
    marketValue: row.marketValue,
    stableSecurityId: row.stableSecurityId
  })),
  previewAgain.normalized.holdingsSnapshots.map((row) => ({
    ticker: row.ticker,
    quantity: row.quantity,
    marketValue: row.marketValue,
    stableSecurityId: row.stableSecurityId
  }))
);
assert.deepEqual(
  preview.normalized.taxLots.map((lot) => lot.stableLotId).sort(),
  previewAgain.normalized.taxLots.map((lot) => lot.stableLotId).sort()
);

// --- Package merge (activity + holdings) ---
const packagePreview = context.investmentEtradePreviewPackage_({
  source: 'ETRADE_PACKAGE',
  rawCsv: minimalCsv,
  rawPositionsText: positionsFixture,
  accountMeta: {
    stableAccountId: 'INV-ET-SYNTH-1',
    registrationType: 'TAXABLE'
  }
});
assert.equal(packagePreview.ok, true);
assert.match(packagePreview.parserVersion, /etrade-txn-csv-v1\+etrade-positions-pdf-v1/);
assert.ok(packagePreview.normalized.activities.length >= 18);
assert.equal(packagePreview.normalized.holdingsSnapshots.length, 3);
assert.equal(packagePreview.normalized.taxLots.length, 5);
assert.equal(packagePreview.normalized.capabilities.activities, true);
assert.equal(packagePreview.normalized.capabilities.holdings, true);
assert.equal(packagePreview.normalized.capabilities.taxLots, true);

// --- Account identity: no silent cross-account merge ---
assert.equal(
  preview.normalized.sourceAccountKey,
  accountMeta.stableAccountId
);
const hashedPreview = context.investmentEtradePreviewPositionsPdf_({
  source: 'ETRADE_PACKAGE',
  rawPositionsText: positionsFixture,
  accountMeta: { registrationType: 'TAXABLE' }
});
assert.notEqual(hashedPreview.normalized.sourceAccountKey, accountMeta.stableAccountId);
assert.equal(hashedPreview.reviewRequired, true);

// --- Positions-only package adapter entry ---
const holdingsOnly = context.investmentAdapterPreviewEtradePackage_({
  source: 'ETRADE_PACKAGE',
  rawPositionsText: positionsFixture,
  accountMeta
});
assert.equal(holdingsOnly.ok, true);
assert.equal(holdingsOnly.normalized.activities.length, 0);
assert.equal(holdingsOnly.normalized.holdingsSnapshots.length, 3);

console.log('E*TRADE Positions PDF regressions passed.');
