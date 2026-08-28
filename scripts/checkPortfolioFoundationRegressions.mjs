import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const read = (name) => fs.readFileSync(new URL(name, root), 'utf8');

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
  ${extractFunction(activitySource, 'normalizeInvestmentTicker_')}
  ${extractFunction(activitySource, 'classifyInvestmentImportRow_')}
  ${extractFunction(activitySource, 'buildInvestmentActivityImportKey_')}
  ${extractFunction(activitySource, 'investmentImportDigest_')}
  ${extractFunction(activitySource, 'summarizeInvestmentImportPreview_')}
`, context, { filename: 'investment_activity_partial.js' });
vm.runInContext(adaptersSource, context, { filename: 'investment_adapters.js' });

// --- Source enum / adapter registry ---
assert.deepEqual(context.listInvestmentAdapterSources_(), ['ROBINHOOD_CSV'],
  'Foundation v1 implements Robinhood adapter only');
assert.throws(() => context.getInvestmentAdapter_('ETRADE_CSV'),
  /not implemented/, 'Future broker adapters must not be stubbed as live');
assert.equal(context.investmentPortfolioNormalizeSource_('robinhood_csv'), 'ROBINHOOD_CSV');

// --- Registration types ---
['TRADITIONAL_IRA', 'ROTH_IRA', '403B', 'HSA', 'OTHER_RETIREMENT', 'TAXABLE'].forEach((type) => {
  assert.equal(context.financialIdentityNormalizeRegistrationType_(type), type,
    `${type} must be a canonical registration type`);
});
assert.equal(context.financialIdentityNormalizeRegistrationType_('IRA'), 'IRA',
  'Legacy IRA value must remain distinct until owner confirms Traditional vs Roth');
assert.equal(context.investmentPortfolioRegistrationTaxAuthoritative_('IRA'), false,
  'Bare IRA must not be tax-authoritative');
assert.equal(context.investmentPortfolioRegistrationTaxAuthoritative_('ROTH_IRA'), true);
assert.equal(context.investmentPortfolioResolveDomainForRegistration_('401K'), 'RETIREMENT');
assert.equal(context.investmentPortfolioResolveDomainForRegistration_('TAXABLE'), 'INVESTMENT');

// --- Portfolio role / import eligibility ---
assert.equal(context.investmentPortfolioImportEligible_({
  domain: 'RETIREMENT', active: true, investmentId: 'INV-401k', stableAccountId: 'RET-1'
}), true, '401K must be eligible for canonical import without INCOME_PRODUCING');
assert.equal(context.investmentPortfolioImportEligible_({
  domain: 'INVESTMENT', active: true, investmentId: 'INV-1'
}), true);
assert.equal(context.investmentPortfolioRobinhoodImportEligible_({ incomeProducingEligible: true }), true);
assert.equal(context.investmentPortfolioRobinhoodImportEligible_({ incomeProducingEligible: false }), false,
  'Robinhood production gate remains INCOME_PRODUCING until reviewed migration');

assert.equal(context.investmentPortfolioCashFundingSellEligible_({
  registrationType: '401K', portfolioPolicyFlags: ['RETIREMENT_ACCUMULATION']
}), false);
assert.equal(context.investmentPortfolioCashFundingSellEligible_({
  registrationType: 'TAXABLE', portfolioPolicyFlags: ['OPTIMIZATION_CANDIDATE']
}), true);
assert.equal(context.investmentPortfolioCashFundingSellEligible_({
  registrationType: 'TAXABLE', portfolioPolicyFlags: ['PROTECTED', 'DO_NOT_SELL_FOR_CASH_FUNDING']
}), false);

// --- Income bucket ---
assert.equal(context.investmentPortfolioResolveIncomeBucket_('TAXABLE'),
  'CURRENT_SPENDABLE_PORTFOLIO_INCOME');
assert.equal(context.investmentPortfolioResolveIncomeBucket_('ROTH_IRA'),
  'RETIREMENT_PORTFOLIO_INCOME');
assert.equal(context.investmentPortfolioResolveIncomeBucket_('IRA'),
  'RETIREMENT_PORTFOLIO_INCOME');

// --- Robinhood characterization: classification unchanged ---
const universe = { QQQ: true, JEPQ: true };
const cutoff = '2026-04-27';
const rows = [
  { activityDate: '2026-05-01', ticker: 'SPY', transCode: 'BTO', description: 'SPY Call', amount: -100, recurring: false },
  { activityDate: '2026-05-01', ticker: 'HL', transCode: 'Buy', description: 'Hecla Mining', amount: -10, recurring: false },
  { activityDate: '2026-05-04', ticker: 'QQQ', transCode: 'Buy', description: 'Invesco QQQ Recurring', amount: -350, recurring: true },
  { activityDate: '2026-05-05', ticker: 'JEPQ', transCode: 'CDIV', description: 'Cash Div', amount: 10, recurring: false }
];
const classifications = rows.map((row) => context.classifyInvestmentImportRow_(row, cutoff, universe));
assert.deepEqual(classifications.map((item) => item.reason || item.activityType), [
  'OPTIONS_ACTIVITY', 'OUTSIDE_PORTFOLIO', 'RECURRING_BUY', 'DIVIDEND'
]);

const investmentId = 'INV-synthetic';
const accepted = [
  { activityDate: '2026-04-27', settleDate: '2026-04-28', ticker: 'QQQ', transCode: 'Buy',
    activityType: 'BUY', quantity: 5, price: 600, amount: -3000, description: 'Invesco QQQ', recurring: false },
  { activityDate: '2026-05-04', settleDate: '2026-05-05', ticker: 'QQQ', transCode: 'Buy',
    activityType: 'RECURRING_BUY', quantity: 0.5, price: 700, amount: -350,
    description: 'Invesco QQQ Recurring', recurring: true }
];
accepted.forEach((row) => {
  row.importKey = context.buildInvestmentActivityImportKey_(investmentId, row);
});
assert.match(accepted[0].importKey, /^[a-f0-9]{64}$/,
  'Import keys must remain deterministic SHA-256 digests');
assert.notEqual(accepted[0].importKey, accepted[1].importKey,
  'Distinct accepted rows must keep distinct Import Keys');

const legacyPreview = {
  investmentId,
  accountName: 'Synthetic Income Portfolio',
  parserVersion: 'robinhood-legacy-v1',
  acceptedRows: accepted.map((row) => ({ ...row })),
  excludedRows: [{ reason: 'OPTIONS_ACTIVITY', ticker: 'SPY', activityDate: '2026-05-04', transCode: 'BTO' }],
  summary: { acceptedCount: 2, excludedCount: 1 }
};
const normalized = context.investmentPortfolioNormalizeRobinhoodPreview_(legacyPreview, {
  stableAccountId: 'INV-STABLE-1',
  registrationType: 'TAXABLE',
  planningPurpose: 'INCOME_PRODUCING'
});
assert.equal(normalized.source, 'ROBINHOOD_CSV');
assert.equal(normalized.activities.length, 2);
assert.equal(normalized.activities[0].replayKey, accepted[0].importKey,
  'Normalized preview must preserve legacy Import Key as replay key');
assert.equal(normalized.activities[0].incomeBucketSnapshot, 'CURRENT_SPENDABLE_PORTFOLIO_INCOME');
assert.equal(normalized.unsupportedRows[0].reason, 'OPTIONS_ACTIVITY');
assert.match(JSON.stringify(normalized), /QQQ/, 'Ticker may appear in normalized output');
assert.doesNotMatch(JSON.stringify(normalized), /Trans Code/i,
  'Broker-specific column names must not escape adapter boundary');

// --- Replay / dedupe / correction ---
const existing = {
  source: 'ETRADE_CSV',
  sourceAccountKey: 'acct-1',
  sourceRecordKey: 'txn-100',
  activityDate: '2026-01-15',
  settleDate: '2026-01-16',
  ticker: 'ABC',
  activityType: 'BUY',
  quantity: 10,
  price: 25,
  amount: -250,
  fees: 0
};
const exactReplay = { ...existing };
const correction = { ...existing, amount: -255, quantity: 10, price: 25.5 };
assert.equal(context.investmentPortfolioClassifyReplay_(exactReplay, existing), 'EXACT_REPLAY');
assert.equal(context.investmentPortfolioClassifyReplay_(correction, existing), 'SOURCE_CORRECTION');
const conflictIncoming = {
  activityDate: '2026-01-15', ticker: 'ABC', activityType: 'BUY',
  quantity: 10, price: 25, amount: -300, source: 'MANUAL_STRUCTURED'
};
const conflictExisting = {
  activityDate: '2026-01-15', ticker: 'ABC', activityType: 'BUY',
  quantity: 10, price: 25, amount: -250, source: 'MANUAL_STRUCTURED'
};
assert.equal(context.investmentPortfolioClassifyReplay_(conflictIncoming, conflictExisting, {
  legacyImportKey: 'shared-legacy-key'
}), 'CONFLICT');
const fingerprintOnly = {
  activityDate: '2026-02-01', ticker: 'XYZ', activityType: 'BUY',
  quantity: 1, price: 10, amount: -10, source: 'M1_CSV'
};
const fingerprintDuplicate = { ...fingerprintOnly };
assert.equal(context.investmentPortfolioClassifyReplay_(fingerprintDuplicate, fingerprintOnly), 'EXACT_REPLAY');
const sameDayCollisionA = {
  activityDate: '2026-03-01', ticker: 'DUP', activityType: 'BUY',
  quantity: 1, price: 100, amount: -100, source: 'SCHWAB_CSV'
};
const sameDayCollisionB = {
  activityDate: '2026-03-01', ticker: 'DUP', activityType: 'BUY',
  quantity: 1, price: 100, amount: -100, source: 'SCHWAB_CSV'
};
assert.equal(context.investmentPortfolioBuildReplayKey_(sameDayCollisionA),
  context.investmentPortfolioBuildReplayKey_(sameDayCollisionB),
  'Same-day identical trades share fingerprint replay key (documented collision risk)');

// --- Security matching hierarchy ---
const securities = [
  { stableSecurityId: 'SEC-1', ticker: 'ABC', securityType: 'EQUITY',
    primarySource: 'ETRADE_CSV', sourceSecurityKey: 'E-123', cusip: '123456789' }
];
assert.equal(context.investmentPortfolioMatchSecurity_(securities, {
  primarySource: 'ETRADE_CSV', sourceSecurityKey: 'E-123', ticker: 'WRONG'
}).method, 'SOURCE_SECURITY_KEY');
assert.equal(context.investmentPortfolioMatchSecurity_(securities, {
  cusip: '123456789', ticker: 'WRONG'
}).method, 'CUSIP');
assert.equal(context.investmentPortfolioMatchSecurity_(securities, {
  ticker: 'ABC', securityType: 'EQUITY'
}).method, 'TICKER_AND_TYPE');
assert.equal(context.investmentPortfolioMatchSecurity_(securities, {
  ticker: 'ABC', securityType: 'ETF'
}).method, 'UNRESOLVED');

// --- Tax lots ---
assert.equal(context.investmentPortfolioValidateTaxLot_({
  stableLotId: 'LOT-1', lotAuthority: 'PROVIDER_REPORTED'
}).ok, true);
assert.equal(context.investmentPortfolioValidateTaxLot_({
  stableLotId: 'LOT-2', lotAuthority: 'AGGREGATE_ONLY',
  originalQuantity: 100, remainingQuantity: 100
}).ok, true);
assert.equal(context.investmentPortfolioValidateTaxLot_({
  stableLotId: '', lotAuthority: 'PROVIDER_REPORTED'
}).ok, false);

// --- Reconciliation ---
assert.equal(context.investmentPortfolioReconcilePosition_({
  reconstructedQuantity: 10, providerQuantity: 10
}).quantityStatus, 'MATCH');
assert.equal(context.investmentPortfolioReconcilePosition_({
  reconstructedQuantity: 10.005, providerQuantity: 10
}).quantityStatus, 'ROUNDING_DIFFERENCE');
assert.equal(context.investmentPortfolioReconcilePosition_({
  reconstructedQuantity: 8, providerQuantity: 10
}).quantityStatus, 'MATERIAL_MISMATCH');
assert.equal(context.investmentPortfolioReconcilePosition_({
  reconstructedCost: 1000, providerCostBasis: 1000.5, moneyTolerance: 0.02
}).costBasisStatus, 'ROUNDING_DIFFERENCE');
assert.equal(context.investmentPortfolioReconcilePosition_({
  calculatedMarketValue: 500, providerMarketValue: 520, priceAsOfStale: true
}).marketValueStatus, 'PRICE_STALE');

// --- Adapter detect / package preview ---
const robinhoodCsv = [
  '"Activity Date","Process Date","Settle Date","Instrument","Description","Trans Code","Quantity","Price","Amount"',
  '"4/27/2026","4/27/2026","4/28/2026","QQQ","Invesco QQQ","Buy","5","$600.00","($3,000.00)"'
].join('\n');
assert.equal(context.investmentAdapterDetectRobinhoodCsv_({ rawCsv: robinhoodCsv }).ok, true);
assert.equal(context.investmentAdapterDetectRobinhoodCsv_({ rawCsv: 'Date,Amount\n1/1/2026,1' }).ok, false);
assert.equal(context.investmentAdapterBuildPackagePreview_({ source: 'ETRADE_CSV', files: [] }).ok, false);

// --- Workbook safety / production path audit ---
assert.doesNotMatch(foundationSource, /investmentPortfolioEnsureTaxLotsSheet_\(\)/,
  'Foundation must not first-create tax lot sheets on module load');
assert.doesNotMatch(adaptersSource, /investmentPortfolioEnsure/,
  'Adapters must not create workbook sheets during preview');
assert.doesNotMatch(dashboardInvestments,
  /getInvestmentAdapter_|investmentAdapterBuildPackagePreview_|investmentPortfolioEnsure/,
  'Dashboard investment UI must not wire generic foundation persistence yet');
assert.match(foundationSource, /INVESTMENT_ACTIVITY_EXTENDED_HEADERS_/,
  'Activity schema extension contract must exist');
assert.match(foundationSource, /INVESTMENT_TAX_LOT_HEADERS_/,
  'Tax lot first-create headers must be defined');
assert.match(foundationSource, /INVESTMENT_SECURITIES_HEADERS_/,
  'Securities first-create headers must be defined');
assert.match(configSource, /INVESTMENT_TAX_LOTS: 'SYS - Investment Tax Lots'/);
assert.match(configSource, /INVESTMENT_SECURITIES: 'SYS - Investment Securities'/);
assert.match(activitySource,
  /function resolveEligibleInvestmentImportAccount_/,
  'Robinhood eligibility gate must remain in investment_activity.js');
assert.doesNotMatch(foundationSource, /resolveEligibleInvestmentImportAccount_/,
  'Generic foundation must not replace Robinhood eligibility gate');

console.log('Portfolio foundation regressions passed.');
