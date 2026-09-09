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

const context = {
  Utilities: {
    DigestAlgorithm: { SHA_256: 'SHA_256' },
    Charset: { UTF_8: 'UTF_8' },
    computeDigest(_algorithm, value) {
      return [...crypto.createHash('sha256').update(String(value), 'utf8').digest()]
        .map((byte) => (byte > 127 ? byte - 256 : byte));
    }
  },
  String, Number, Object, Array, Math, isFinite, Error, JSON, console
};
vm.createContext(context);
vm.runInContext(read('config.js'), context, { filename: 'config.js' });
vm.runInContext(read('financial_identity.js'), context, { filename: 'financial_identity.js' });
vm.runInContext(read('investment_portfolio_foundation.js'), context, {
  filename: 'investment_portfolio_foundation.js'
});
vm.runInContext(`
  function round2_(value) { return Math.round(Number(value) * 100) / 100; }
  ${extractFunction(read('investment_activity.js'), 'normalizeInvestmentImportDate_')}
  ${extractFunction(read('investment_activity.js'), 'parseInvestmentImportMoney_')}
  ${extractFunction(read('investment_activity.js'), 'parseInvestmentImportNumber_')}
`, context, { filename: 'investment_activity_partial.js' });
vm.runInContext(read('investment_etrade_csv.js'), context, { filename: 'investment_etrade_csv.js' });
vm.runInContext(read('investment_etrade_positions_pdf.js'), context, {
  filename: 'investment_etrade_positions_pdf.js'
});
vm.runInContext(read('investment_m1_statement_pdf.js'), context, {
  filename: 'investment_m1_statement_pdf.js'
});
vm.runInContext(read('investment_adapters.js'), context, { filename: 'investment_adapters.js' });

const positionsFixture = fixture('synthetic_etrade_positions_minimal.txt');
const headersOnlyFixture = fixture('synthetic_etrade_positions_headers_only.txt');
const positionsSource = read('investment_etrade_positions_pdf.js');
const adaptersSource = read('investment_adapters.js');

const accountMeta = {
  stableAccountId: 'INV-ET-POS-1',
  registrationType: 'TAXABLE',
  accountName: 'Synthetic Positions Preview',
  explicitAccountMatch: true
};

const preview = context.investmentAdapterPreviewEtradePositionsPdf_({
  source: 'ETRADE_POSITIONS_PDF',
  rawPositionsText: positionsFixture,
  accountMeta
});
assert.equal(preview.ok, true, preview.error || 'unified positions preview failed');
assert.equal(preview.normalized.contractVersion, 'PORTFOLIO_INTELLIGENCE_HOLDINGS_V1');
assert.equal(preview.normalized.previewOnly, true);
assert.equal(context.investmentPortfolioValidateUnifiedHoldingsPreview_(preview.normalized).ok, true);

// --- One document produces valid holdings preview ---
assert.equal(preview.normalized.holdings.length, 3);
assert.equal(preview.normalized.securities.length, 3);
assert.equal(preview.normalized.accounts.length, 1);
assert.match(preview.normalized.accounts[0].displayName, /Synthetic Positions Preview/);
assert.equal(preview.normalized.accounts[0].taxStatus, 'TAXABLE');
assert.equal(preview.normalized.accounts[0].matchStatus, 'EXPLICIT_MATCH');
assert.match(preview.normalized.asOf, /2025-08-15/);
assert.equal(preview.normalized.accountSnapshots[0].marketValue, 125000);
assert.equal(preview.normalized.accountSnapshots[0].cashBalance, 12345.67);

const synaaa = preview.normalized.holdings.find((row) => row.ticker === 'SYNAAA');
assert.equal(synaaa.shares, 30);
assert.equal(synaaa.price, 150);
assert.equal(synaaa.marketValue, 4500);
assert.equal(synaaa.providerCostBasis, 3500);
assert.equal(synaaa.unrealizedGainLoss, 1000);
assert.ok(synaaa.replayKey);

// --- Optional cost basis when present; absent fields do not fail validation ---
const synaaaHeaderOnly = context.investmentAdapterPreviewEtradePositionsPdf_({
  source: 'ETRADE_POSITIONS_PDF',
  rawPositionsText: headersOnlyFixture,
  accountMeta: {
    stableAccountId: 'INV-ET-POS-2',
    registrationType: 'TAXABLE',
    explicitAccountMatch: true
  }
});
assert.equal(synaaaHeaderOnly.ok, true);
const headerOnlyRow = synaaaHeaderOnly.normalized.holdings.find((row) => row.ticker === 'SYNAAA');
assert.equal(headerOnlyRow.providerCostBasis, null);
assert.equal(headerOnlyRow.costBasisQuality, 'UNKNOWN');
assert.equal(context.investmentPortfolioValidateUnifiedHoldingRow_(headerOnlyRow).ok, true);

// --- Holdings usable when tax lots absent ---
assert.equal(synaaaHeaderOnly.normalized.taxLots.length, 0);
assert.equal(synaaaHeaderOnly.normalized.recommendationReadiness.trustedForHoldingsVisibility, true);
assert.equal(synaaaHeaderOnly.normalized.recommendationReadiness.trustedForTaxLotSalePlanning, false);

// --- Parenthesized / negative values ---
const synetfHeaderOnly = synaaaHeaderOnly.normalized.holdings.find((row) => row.ticker === 'SYNETF');
assert.equal(synetfHeaderOnly.price, 50);
assert.equal(synetfHeaderOnly.marketValue, 5000);
assert.equal(synetfHeaderOnly.providerCostBasis, 4800);

// --- Cash separated from securities; totals excluded ---
assert.ok(!preview.normalized.holdings.some((row) => row.ticker === 'Cash'));
assert.ok(!preview.normalized.securities.some((row) => row.ticker === 'Cash'));
assert.ok(!preview.normalized.holdings.some((row) => row.ticker === 'Total'));
const parsed = context.investmentEtradeParsePositionsPdfText_(positionsFixture);
assert.equal(parsed.noiseRows.filter((row) => row.reason === 'CASH_ROW').length, 1);
assert.equal(parsed.noiseRows.filter((row) => row.reason === 'PAGE_TOTAL').length, 2);

// --- Wash-sale suffix does not corrupt security identity ---
const washLot = preview.normalized.taxLots.find((lot) => lot.washSaleAdjusted);
assert.ok(washLot);
assert.match(washLot.sourceLotKey, /WS/i);
const synaaaSecurity = preview.normalized.securities.find((row) => row.ticker === 'SYNAAA');
assert.equal(washLot.stableSecurityId, synaaaSecurity.stableSecurityId);

// --- Ticker alone is not durable security identity ---
preview.normalized.securities.forEach((security) => {
  assert.notEqual(security.sourceSecurityKey, security.ticker);
  assert.match(security.sourceSecurityKey, /^ETRADE\|/);
});

// --- No automatic mapping ---
const withoutExplicit = context.investmentAdapterPreviewEtradePositionsPdf_({
  source: 'ETRADE_POSITIONS_PDF',
  rawPositionsText: headersOnlyFixture,
  accountMeta: { stableAccountId: 'INV-ET-POS-2', registrationType: 'TAXABLE' }
});
assert.equal(withoutExplicit.normalized.accounts[0].matchStatus, 'REVIEW_REQUIRED');
assert.equal(withoutExplicit.normalized.recommendationReadiness.trustedForHoldingsVisibility, false);

const inactive = context.investmentAdapterPreviewEtradePositionsPdf_({
  source: 'ETRADE_POSITIONS_PDF',
  rawPositionsText: headersOnlyFixture,
  accountMeta: {
    stableAccountId: 'INV-ET-POS-2',
    registrationType: 'TAXABLE',
    explicitAccountMatch: true,
    active: false
  }
});
assert.equal(inactive.normalized.accounts[0].matchStatus, 'AMBIGUOUS');
assert.equal(inactive.normalized.recommendationReadiness.trustedForHoldingsVisibility, false);

// --- No multi-file requirement ---
const positionsOnlyPackage = context.investmentEtradeDetectPackage_({
  rawPositionsText: positionsFixture
});
assert.equal(positionsOnlyPackage.inferredRoles.join(','), 'HOLDINGS');

// --- Readiness flags ---
assert.equal(preview.normalized.recommendationReadiness.trustedForHoldingsVisibility, true);
assert.equal(preview.normalized.recommendationReadiness.trustedForIncomeAnalysis, false);
assert.equal(preview.normalized.recommendationReadiness.trustedForTaxLotSalePlanning, true);
assert.equal(preview.normalized.distributions.length, 0);
assert.equal(preview.normalized.realizedGainLoss.length, 0);
assert.equal(preview.normalized.activities.length, 0);

// --- No duplicate holdings ---
assert.equal(
  preview.normalized.holdings.length,
  new Set(preview.normalized.holdings.map((row) => `${row.stableAccountId}|${row.stableSecurityId}`)).size
);

// --- Stable replay key ---
const replayAgain = context.investmentAdapterPreviewEtradePositionsPdf_({
  source: 'ETRADE_POSITIONS_PDF',
  rawPositionsText: positionsFixture,
  accountMeta
});
assert.deepEqual(
  preview.normalized.holdings.map((row) => row.replayKey).sort(),
  replayAgain.normalized.holdings.map((row) => row.replayKey).sort()
);

// --- Safety: preview-only, no workbook writes ---
assert.doesNotMatch(positionsSource, /SpreadsheetApp|setValues|appendRow/);
assert.doesNotMatch(adaptersSource, /investmentPortfolioEnsure/);
assert.doesNotMatch(positionsSource, /PropertiesService|CacheService|DriveApp/);

console.log('E*TRADE Positions PDF unified holdings regressions passed.');
