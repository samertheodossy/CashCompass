import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const read = (name) => fs.readFileSync(new URL(name, root), 'utf8');

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

const contractDoc = read('PORTFOLIO_INTELLIGENCE_HOLDINGS_CONTRACT.md');
assert.match(contractDoc, /PORTFOLIO_INTELLIGENCE_HOLDINGS_V1/);
assert.match(contractDoc, /previewOnly: true/);
assert.match(contractDoc, /Ticker alone is not durable security identity/);
assert.match(contractDoc, /No auto-map/);
assert.match(contractDoc, /401\(k\)/);
assert.match(contractDoc, /M1_CSV/);
assert.match(contractDoc, /Expanded Positions PDF/);
assert.match(contractDoc, /Gains & Losses PDF/);

const empty = context.investmentPortfolioBuildEmptyHoldingsPreview_({
  source: 'ETRADE_PACKAGE',
  asOf: '2026-08-15T20:00:00.000Z'
});
assert.equal(empty.previewOnly, true);
assert.equal(empty.contractVersion, 'PORTFOLIO_INTELLIGENCE_HOLDINGS_V1');
assert.equal(empty.recommendationReadiness.trustedForHoldingsVisibility, false);
assert.equal(context.investmentPortfolioValidateUnifiedHoldingsPreview_(empty).ok, true);

const security = {
  stableSecurityId: 'SEC-VTI',
  ticker: 'VTI',
  securityName: 'Vanguard Total Stock Market ETF',
  securityType: 'ETF',
  assetClass: 'US_EQUITY',
  primarySource: 'ETRADE_PACKAGE',
  sourceSecurityKey: 'VTI|ETF'
};
assert.equal(context.investmentPortfolioValidateUnifiedSecurityIdentity_(security).ok, true);
assert.equal(context.investmentPortfolioValidateUnifiedSecurityIdentity_({
  stableSecurityId: 'SEC-BAD',
  ticker: 'VTI',
  securityType: 'ETF'
}).errors[0], 'sourceSecurityKeyRequiredWithoutCusip');

assert.equal(context.investmentPortfolioResolveTaxStatus_('401K'), 'RETIREMENT');
assert.equal(context.investmentPortfolioResolveTaxStatus_('TAXABLE'), 'TAXABLE');
assert.equal(context.investmentPortfolioResolveTaxStatus_('ROTH_IRA'), 'RETIREMENT');

const holding = {
  stableAccountId: 'INV-401K-1',
  stableSecurityId: 'SEC-VTI',
  ticker: 'VTI',
  shares: 100,
  price: 250.12,
  priceAsOf: '2026-08-15T13:00:00.000Z',
  marketValue: 25012,
  providerCostBasis: 22000,
  costBasisQuality: 'PROVIDER_AGGREGATE',
  unrealizedGainLoss: 3012,
  authority: 'PROVIDER_REPORTED',
  source: 'ETRADE_PACKAGE',
  sourceSnapshotKey: 'sha256:' + 'a'.repeat(64),
  sourceAsOf: '2026-08-15T13:00:00.000Z',
  dataQuality: 'PROVIDER_REPORTED',
  freshness: 'CURRENT',
  confidence: 'HIGH'
};
assert.equal(context.investmentPortfolioValidateUnifiedHoldingRow_(holding).ok, true);

const distribution = {
  stableAccountId: 'INV-TAX-1',
  stableSecurityId: 'SEC-VTI',
  amount: 42.15,
  distributionDate: '2026-08-01',
  classification: 'QUALIFIED_DIVIDEND',
  source: 'ETRADE_CSV',
  sourceRecordKey: 'REFID:12345',
  incomeBucket: 'CURRENT_SPENDABLE_PORTFOLIO_INCOME'
};
assert.equal(context.investmentPortfolioValidateUnifiedDistributionRow_(distribution).ok, true);

const replayA = context.investmentPortfolioBuildHoldingsSnapshotReplayKey_(holding);
const replayB = context.investmentPortfolioBuildHoldingsSnapshotReplayKey_({
  ...holding,
  observedAt: '2026-08-16T10:00:00.000Z'
});
assert.equal(replayA, replayB, 'holdings replay identity must exclude observedAt');

const distReplayA = context.investmentPortfolioBuildDistributionReplayKey_(distribution);
const distReplayB = context.investmentPortfolioBuildDistributionReplayKey_({
  ...distribution,
  observedAt: '2026-08-16T10:00:00.000Z'
});
assert.equal(distReplayA, distReplayB, 'distribution replay identity must exclude observedAt');

const trustedPreview = {
  contractVersion: 'PORTFOLIO_INTELLIGENCE_HOLDINGS_V1',
  schemaVersion: '1.0.0',
  previewOnly: true,
  accounts: [{
    stableAccountId: 'INV-TAX-1',
    investmentId: 'INV-TAX-1',
    institution: 'E*TRADE',
    displayName: 'Taxable Brokerage',
    accountType: 'Brokerage',
    registrationType: 'TAXABLE',
    domain: 'INVESTMENT',
    taxStatus: 'TAXABLE',
    active: true,
    matchStatus: 'EXACT_LINK'
  }],
  securities: [security],
  holdings: [holding],
  distributions: [distribution],
  taxLots: [{
    stableLotId: 'LOT-1',
    stableAccountId: 'INV-TAX-1',
    stableSecurityId: 'SEC-VTI',
    ticker: 'VTI',
    acquisitionDate: '2024-01-15',
    originalQuantity: 100,
    remainingQuantity: 100,
    costPerShare: 220,
    originalCostBasis: 22000,
    adjustedCostBasis: 22000,
    lotAuthority: 'PROVIDER_REPORTED',
    sourceLotKey: 'sha256:' + 'b'.repeat(64),
    sourceAsOf: '2026-08-15T13:00:00.000Z'
  }],
  realizedGainLoss: [],
  accountSnapshots: [],
  activities: []
};
const readiness = context.investmentPortfolioEvaluateRecommendationReadiness_(trustedPreview);
assert.equal(readiness.trustedForHoldingsVisibility, true);
assert.equal(readiness.trustedForIncomeAnalysis, true);
assert.equal(readiness.trustedForTaxLotSalePlanning, true);

const conflictPreview = {
  ...trustedPreview,
  holdings: [{ ...holding, replayOutcome: 'CONFLICT' }]
};
const blocked = context.investmentPortfolioEvaluateRecommendationReadiness_(conflictPreview);
assert.equal(blocked.trustedForHoldingsVisibility, false);
assert.equal(blocked.trustedForTaxLotSalePlanning, false);
assert.ok(blocked.blockingReasons.includes('REPLAY_CONFLICT'));

const stalePreview = {
  ...trustedPreview,
  holdings: [{ ...holding, freshness: 'STALE', confidence: 'LOW' }]
};
assert.equal(
  context.investmentPortfolioEvaluateRecommendationReadiness_(stalePreview).trustedForHoldingsVisibility,
  false
);

assert.equal(context.investmentPortfolioValidateUnifiedHoldingsPreview_(trustedPreview).ok, true);
assert.equal(context.investmentPortfolioValidateUnifiedHoldingsPreview_({
  ...trustedPreview,
  previewOnly: false
}).ok, false);

console.log('Portfolio Intelligence holdings contract regressions passed.');
