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
assert.equal(context.investmentPortfolioNormalizeSource_('etrade_package'), 'ETRADE_PACKAGE',
  'ETRADE_PACKAGE must be a registered foundation source');

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

// --- Activity subtype model (E*TRADE foundation; Robinhood legacy preserved) ---
[
  'QUALIFIED_DIVIDEND', 'REINVESTMENT', 'EXCHANGE_RECEIVED', 'EXCHANGE_DELIVERED',
  'REDEMPTION', 'STOCK_SPLIT', 'CASH_IN_LIEU', 'CANCEL_SOLD', 'ONLINE_TRANSFER', 'SERVICE_FEE'
].forEach((subtype) => {
  assert.equal(context.investmentPortfolioIsCanonicalActivitySubtype_(subtype), true,
    `${subtype} must be a canonical activitySubtype`);
});
assert.equal(context.investmentPortfolioNormalizeActivitySubtype_('qualified_dividend'), 'QUALIFIED_DIVIDEND');
assert.equal(context.investmentPortfolioNormalizeActivitySubtype_('Buy', { allowLegacy: true }), 'Buy',
  'Robinhood transCode strings must pass through unchanged when allowLegacy is set');
assert.equal(context.investmentPortfolioNormalizeActivitySubtype_('Buy'), '',
  'Non-canonical subtypes must not normalize without allowLegacy');

const etradeQualified = context.investmentPortfolioMapEtradeSourceActivity_({
  etradeActivityType: 'Qualified Dividend',
  activityDate: '2026-01-15',
  ticker: 'SYNAAA',
  amount: 12.34
});
assert.deepEqual({
  activityType: etradeQualified.activityType,
  activitySubtype: etradeQualified.activitySubtype,
  tradeSemantics: etradeQualified.tradeSemantics,
  incomeEligible: etradeQualified.incomeEligible
}, {
  activityType: 'DIVIDEND',
  activitySubtype: 'QUALIFIED_DIVIDEND',
  tradeSemantics: false,
  incomeEligible: true
});

const etradeReinvest = context.investmentPortfolioMapEtradeSourceActivity_({
  etradeActivityType: 'Dividend',
  description: 'SYNAAA DIVIDEND REINVESTMENT',
  activityDate: '2026-01-15',
  ticker: 'SYNAAA',
  amount: -12.34,
  quantity: 0.25
});
assert.equal(etradeReinvest.activityType, 'REINVESTMENT');
assert.equal(etradeReinvest.activitySubtype, 'REINVESTMENT');
assert.equal(etradeReinvest.tradeSemantics, false);

const etradeExchangeIn = context.investmentPortfolioMapEtradeSourceActivity_({
  etradeActivityType: 'Exchange Received In',
  quantity: 10
});
assert.equal(etradeExchangeIn.activityType, 'CORPORATE_ACTION');
assert.equal(etradeExchangeIn.activitySubtype, 'EXCHANGE_RECEIVED');
assert.equal(context.investmentPortfolioActivityHasTradeSemantics_(etradeExchangeIn), false);

const etradeExchangeOut = context.investmentPortfolioMapEtradeSourceActivity_({
  etradeActivityType: 'Exchange Delivered Out',
  quantity: -10
});
assert.equal(etradeExchangeOut.activitySubtype, 'EXCHANGE_DELIVERED');
assert.notEqual(etradeExchangeOut.activityType, 'BUY');
assert.notEqual(etradeExchangeOut.activityType, 'SELL');

const etradeTransfer = context.investmentPortfolioMapEtradeSourceActivity_({
  etradeActivityType: 'Transfer',
  description: 'TFR TO ACCT',
  quantity: -5
});
assert.equal(etradeTransfer.activityType, 'TRANSFER_OUT');
assert.equal(context.investmentPortfolioActivityHasTradeSemantics_(etradeTransfer), false);

const etradeAch = context.investmentPortfolioMapEtradeSourceActivity_({
  etradeActivityType: 'Online Transfer',
  description: 'ACH DEPOSIT',
  amount: 500
});
assert.equal(etradeAch.activityType, 'CONTRIBUTION');
assert.equal(etradeAch.activitySubtype, 'ONLINE_TRANSFER');

const etradeSplit = context.investmentPortfolioMapEtradeSourceActivity_({
  etradeActivityType: 'Stock Split',
  description: 'SPLIT RATIO 10:1',
  quantity: 90
});
assert.equal(etradeSplit.activityType, 'SPLIT');
assert.equal(etradeSplit.activitySubtype, 'STOCK_SPLIT');

const etradeApplied = context.investmentPortfolioApplyEtradeMappedActivity_({
  source: 'ETRADE_PACKAGE',
  activityDate: '2026-02-01',
  ticker: 'SYNBBB',
  amount: -1.25,
  etradeActivityType: 'Service Fee'
});
assert.equal(etradeApplied.activityType, 'FEE');
assert.equal(etradeApplied.activitySubtype, 'SERVICE_FEE');
assert.equal(context.investmentPortfolioValidateActivity_(etradeApplied).ok, true);

assert.equal(context.investmentPortfolioValidateActivity_({
  activityDate: '2026-02-01',
  activityType: 'DIVIDEND',
  activitySubtype: 'QUALIFIED_DIVIDEND',
  source: 'ETRADE_CSV'
}).ok, true);
assert.equal(context.investmentPortfolioValidateActivity_({
  activityDate: '2026-02-01',
  activityType: 'DIVIDEND',
  activitySubtype: 'NotARealSubtype',
  source: 'ETRADE_CSV'
}).ok, false);
assert.equal(context.investmentPortfolioValidateActivity_({
  activityDate: '2026-02-01',
  activityType: 'BUY',
  activitySubtype: 'Buy',
  source: 'ROBINHOOD_CSV'
}).ok, true, 'Robinhood legacy transCode subtypes remain valid');

const dividendPair = [
  context.investmentPortfolioApplyEtradeMappedActivity_({
    source: 'ETRADE_CSV',
    activityDate: '2026-01-15',
    ticker: 'SYNAAA',
    amount: 10,
    etradeActivityType: 'Qualified Dividend'
  }),
  context.investmentPortfolioApplyEtradeMappedActivity_({
    source: 'ETRADE_CSV',
    activityDate: '2026-01-15',
    ticker: 'SYNAAA',
    amount: -10,
    quantity: 0.5,
    description: 'SYNAAA DIVIDEND REINVESTMENT',
    etradeActivityType: 'Dividend'
  })
];
const dividendIncome = context.investmentPortfolioSummarizeDividendIncome_(dividendPair);
assert.equal(dividendIncome.totalCashDividendIncome, 10,
  'Qualified dividend income must not double-count paired reinvestment');
assert.equal(dividendIncome.reinvestGroups[dividendPair[0].dividendGroupKey], 1);

// --- Subtype-aware replay identity ---
const subtypeBase = {
  source: 'ETRADE_CSV',
  sourceAccountKey: 'acct-1',
  sourceRecordKey: 'txn-div-1',
  activityDate: '2026-01-15',
  ticker: 'SYNAAA',
  activityType: 'DIVIDEND',
  activitySubtype: 'QUALIFIED_DIVIDEND',
  quantity: 0,
  price: 0,
  amount: 10,
  fees: 0
};
assert.equal(context.investmentPortfolioClassifyReplay_(subtypeBase, { ...subtypeBase }), 'EXACT_REPLAY');
const subtypeOnlyCorrection = { ...subtypeBase, activitySubtype: 'REINVESTMENT' };
assert.equal(subtypeOnlyCorrection.activityType, subtypeBase.activityType,
  'Subtype replay test must hold primary activityType constant');
assert.equal(subtypeOnlyCorrection.sourceRecordKey, subtypeBase.sourceRecordKey,
  'Subtype replay test must hold sourceRecordKey constant');
assert.notEqual(
  context.investmentPortfolioBuildActivityFingerprint_(subtypeBase),
  context.investmentPortfolioBuildActivityFingerprint_(subtypeOnlyCorrection),
  'Distinct subtypes must affect activity fingerprints'
);
assert.notEqual(
  context.investmentPortfolioClassifyReplay_(subtypeOnlyCorrection, subtypeBase),
  'EXACT_REPLAY',
  'Subtype-only correction must not classify as exact replay'
);
assert.equal(
  context.investmentPortfolioClassifyReplay_(subtypeOnlyCorrection, subtypeBase),
  'SOURCE_CORRECTION',
  'Same source record key with subtype-only change must be SOURCE_CORRECTION'
);
const fingerprintSubtypeA = {
  activityDate: '2026-02-01', ticker: 'SYNAAA', activityType: 'DIVIDEND',
  activitySubtype: 'QUALIFIED_DIVIDEND', amount: 10, source: 'ETRADE_CSV'
};
const fingerprintSubtypeB = { ...fingerprintSubtypeA, activitySubtype: 'REINVESTMENT' };
assert.equal(fingerprintSubtypeB.activityType, fingerprintSubtypeA.activityType,
  'Fingerprint subtype test must hold primary activityType constant');
assert.notEqual(
  context.investmentPortfolioBuildReplayKey_(fingerprintSubtypeA),
  context.investmentPortfolioBuildReplayKey_(fingerprintSubtypeB),
  'Subtype differences must change fingerprint replay keys when no source record key exists'
);

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
assert.match(foundationSource, /INVESTMENT_PORTFOLIO_ACTIVITY_SUBTYPES_/,
  'Canonical activitySubtype enum must exist');
assert.match(foundationSource, /investmentPortfolioMapEtradeSourceActivity_/,
  'E*TRADE source mapping helper must exist for future adapter work');
assert.match(foundationSource, /investmentPortfolioSummarizeDividendIncome_/,
  'Dividend income summarization must exist to prevent double-counting');
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
