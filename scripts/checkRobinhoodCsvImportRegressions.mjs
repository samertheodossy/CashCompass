import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const read = (name) => fs.readFileSync(new URL(name, root), 'utf8');
const fixture = (name) => read(`test/fixtures/robinhood/${name}`);

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

const activitySource = read('investment_activity.js');
const planHeadersMatch = activitySource.match(/var INVESTMENT_PLAN_HEADERS_ = \[([\s\S]*?)\];/);
const activityHeadersMatch = activitySource.match(/var INVESTMENT_ACTIVITY_HEADERS_ = \[([\s\S]*?)\];/);
const holdingsHeadersMatch = activitySource.match(/var INVESTMENT_HOLDINGS_HEADERS_ = \[([\s\S]*?)\];/);

const utilities = {
  DigestAlgorithm: { SHA_256: 'SHA_256' },
  Charset: { UTF_8: 'UTF_8' },
  computeDigest(_algorithm, value) {
    return [...crypto.createHash('sha256').update(String(value), 'utf8').digest()]
      .map((byte) => (byte > 127 ? byte - 256 : byte));
  },
  parseCsv(text) {
    const rows = [];
    let row = [];
    let cur = '';
    let inQ = false;
    for (let i = 0; i < text.length; i += 1) {
      const ch = text[i];
      if (ch === '"') { inQ = !inQ; continue; }
      if ((ch === '\n' || ch === '\r') && !inQ) {
        if (ch === '\r' && text[i + 1] === '\n') continue;
        if (cur.length || row.length) { row.push(cur); rows.push(row); row = []; cur = ''; }
        continue;
      }
      if (ch === ',' && !inQ) { row.push(cur); cur = ''; continue; }
      cur += ch;
    }
    if (cur.length || row.length) { row.push(cur); rows.push(row); }
    return rows;
  }
};

const context = {
  Utilities: utilities,
  String, Number, Object, Array, Math, isFinite, Error, JSON, console
};
vm.createContext(context);
vm.runInContext(`
  function round2_(value) { return Math.round(Number(value) * 100) / 100; }
  var INVESTMENT_ACTIVITY_MAX_CSV_CHARS_ = 2000000;
  var INVESTMENT_ACTIVITY_MAX_ROWS_ = 5000;
  var INVESTMENT_ACTIVITY_HEADERS_ = [${activityHeadersMatch[1]}];
  var INVESTMENT_PLAN_HEADERS_ = [${planHeadersMatch[1]}];
  var INVESTMENT_HOLDINGS_HEADERS_ = [${holdingsHeadersMatch[1]}];
  var INVESTMENT_PORTFOLIO_COMPARISON_HEADERS_ = [
    'Investment Id', 'Account Name', 'Comparison Date', 'Prior As Of Date',
    'Prior Market Value', 'Current Market Value', 'Prior Holdings Count',
    'Current Holdings Count', 'Prior Cash', 'Current Cash', 'Import Digest', 'Updated At'
  ];
  var ROBINHOOD_CSV_SHARE_SUFFIX_QUANTITY_CODES_ = {
    SXCH: true, CONV: true, MRGS: true, SPL: true, SPR: true
  };
  var ROBINHOOD_CSV_NON_SHARE_QUANTITY_CODES_ = { OEXP: true };
  function getSheetNames_() {
    return {
      INVESTMENT_ACTIVITY: 'SYS - Investment Activity',
      INVESTMENT_HOLDINGS: 'SYS - Investment Holdings',
      INVESTMENT_PLANS: 'SYS - Investment Plans'
    };
  }
  function getUserSpreadsheet_() { return mockSs; }
  function getIncomeProducingAccountConfigurations_() {
    return {
      eligibleAccounts: [{
        investmentId: 'inv-robinhood-golden',
        accountName: 'Robinhood',
        type: 'Brokerage'
      }]
    };
  }
  ${extractFunction(activitySource, 'normalizeInvestmentImportDate_')}
  ${extractFunction(activitySource, 'parseInvestmentImportMoney_')}
  ${extractFunction(activitySource, 'parseInvestmentImportNumber_')}
  ${extractFunction(activitySource, 'parseRobinhoodCsvQuantity_')}
  ${extractFunction(activitySource, 'normalizeInvestmentTicker_')}
  ${extractFunction(activitySource, 'classifyInvestmentImportRow_')}
  ${extractFunction(activitySource, 'isInvestmentImportNonActivityFooter_')}
  ${extractFunction(activitySource, 'isInvestmentTickerReviewRow_')}
  ${extractFunction(activitySource, 'investmentImportDigest_')}
  ${extractFunction(activitySource, 'buildInvestmentActivityImportKey_')}
  ${extractFunction(activitySource, 'investmentActivityAggregateHoldingsFromRows_')}
  ${extractFunction(activitySource, 'investmentActivitySummarizeAggregatePortfolio_')}
  ${extractFunction(activitySource, 'investmentActivityBuildPortfolioDeltaEntry_')}
  ${extractFunction(activitySource, 'investmentActivityPortfolioDeltaDirection_')}
  ${extractFunction(activitySource, 'investmentActivitySummarizeSavedHoldingsPortfolio_')}
  ${extractFunction(activitySource, 'investmentActivityMergePreviewAcceptedActivity_')}
  ${extractFunction(activitySource, 'investmentActivityReadSavedActivityRowsForAccount_')}
  ${extractFunction(activitySource, 'investmentActivityBuildRobinhoodPortfolioComparisonPreview_')}
  ${extractFunction(activitySource, 'investmentTickerDecisionsDigestPart_')}
  ${extractFunction(activitySource, 'normalizeInvestmentTickerDecisions_')}
  ${extractFunction(activitySource, 'investmentPlanRowsByTicker_')}
  ${extractFunction(activitySource, 'readSavedInvestmentTickers_')}
  ${extractFunction(activitySource, 'readInvestmentPlanRows_')}
  ${extractFunction(activitySource, 'readLatestRecurringActivityByTicker_')}
  ${extractFunction(activitySource, 'investmentImportDayNumber_')}
  ${extractFunction(activitySource, 'resolveEligibleInvestmentImportAccount_')}
  ${extractFunction(activitySource, 'summarizeInvestmentImportPreview_')}
  ${extractFunction(activitySource, 'getInvestmentHoldingsSummary_')}
  ${extractFunction(activitySource, 'previewInvestmentActivityImportFromDashboard')}
`, context, { filename: 'robinhood_csv_partial.js' });

const goldenPlanRows = [
  ['inv-robinhood-golden', 'Robinhood', 'JEPQ', 'INCLUDED', 'WEEKLY', 50, 'YES', '', ''],
  ['inv-robinhood-golden', 'Robinhood', 'QQQ', 'INCLUDED', 'WEEKLY', 350, 'YES', '', ''],
  ['inv-robinhood-golden', 'Robinhood', 'QQQI', 'INCLUDED', 'WEEKLY', 100, 'YES', '', ''],
  ['inv-robinhood-golden', 'Robinhood', 'SPYI', 'INCLUDED', 'WEEKLY', 100, 'YES', '', '']
];
const goldenSavedHoldings = [
  { ticker: 'JEPQ', quantity: 10, lastActivityPrice: 55, totalBuyCost: 500 },
  { ticker: 'QQQ', quantity: 2, lastActivityPrice: 600, totalBuyCost: 1200 }
];
const goldenSavedActivity = [
  {
    activityDate: '2026-04-27',
    ticker: 'QQQ',
    activityType: 'BUY',
    quantity: 2,
    price: 600,
    amount: -1200
  }
];
const mockSs = {
  getSheetByName(name) {
    const sheetNames = context.getSheetNames_();
    if (name === sheetNames.INVESTMENT_ACTIVITY) {
      return {
        getLastRow: () => goldenSavedActivity.length + 1,
        getRange: () => ({
          getValues: () => goldenSavedActivity.map((row) => [
            'key-qqq', 'inv-robinhood-golden', 'Robinhood', row.activityDate, '',
            row.ticker, row.activityType, row.quantity, row.price, row.amount,
            'NO', 'Invesco QQQ', 'ROBINHOOD_CSV', '2026-05-01'
          ])
        })
      };
    }
    if (name === sheetNames.INVESTMENT_HOLDINGS) {
      return {
        getLastRow: () => goldenSavedHoldings.length + 1,
        getRange: () => ({
        getValues: () => goldenSavedHoldings.map((row) => [
          'inv-robinhood-golden', 'Robinhood', '2026-05-01', row.ticker, row.quantity,
          row.totalBuyCost, 0, 0, 0, row.lastActivityPrice, 1, ''
        ])
        })
      };
    }
    if (name === sheetNames.INVESTMENT_PLANS) {
      return {
        getLastRow: () => goldenPlanRows.length + 1,
        getRange: () => ({ getValues: () => goldenPlanRows })
      };
    }
    return null;
  }
};
context.mockSs = mockSs;

function previewRobinhoodFixture(rawCsv, tickerDecisions) {
  return context.previewInvestmentActivityImportFromDashboard({
    investmentId: 'inv-robinhood-golden',
    rawCsv,
    tickerDecisions: tickerDecisions || {
      JEPQ: 'INCLUDE',
      QQQ: 'INCLUDE',
      QQQI: 'INCLUDE',
      SPYI: 'INCLUDE',
      HL: 'EXCLUDE'
    }
  }, mockSs);
}

// --- Numeric quantities ---
assert.equal(context.parseRobinhoodCsvQuantity_('5', 'Buy', 2), 5);
assert.equal(context.parseRobinhoodCsvQuantity_('0.5', 'Buy', 2), 0.5);
assert.equal(context.parseRobinhoodCsvQuantity_('0', 'Sell', 2), 0);
assert.equal(context.parseRobinhoodCsvQuantity_('-2', 'Sell', 2), -2);
assert.equal(context.parseRobinhoodCsvQuantity_('', 'Buy', 2), 0);

// --- Robinhood corporate-action S suffix (SXCH) ---
assert.equal(context.parseRobinhoodCsvQuantity_('1S', 'SXCH', 3), 1);
assert.equal(context.parseRobinhoodCsvQuantity_('2.5S', 'CONV', 3), 2.5);

// --- OEXP option expiration: accept "1S" without coercing to share quantity 1 ---
assert.equal(context.parseRobinhoodCsvQuantity_('1S', 'OEXP', 25), 0);
const oexpClass = context.classifyInvestmentImportRow_({
  activityDate: '2026-08-21',
  ticker: 'VTI',
  transCode: 'OEXP',
  quantity: 0,
  price: 0,
  amount: 0,
  description: 'Option Expiration for VTI 8/21/2026 Call',
  recurring: false
}, '2026-04-27', { VTI: true }, {});
assert.equal(oexpClass.accepted, false);
assert.equal(oexpClass.reason, 'OPTIONS_ACTIVITY');

// --- Fail-closed: S suffix on ordinary trade codes ---
assert.throws(
  () => context.parseRobinhoodCsvQuantity_('1S', 'Buy', 4),
  /uses Robinhood's "S" suffix/i
);
assert.throws(
  () => context.parseRobinhoodCsvQuantity_('1S', 'Sell', 4),
  /uses Robinhood's "S" suffix/i
);

// --- Malformed quantities ---
assert.throws(
  () => context.parseRobinhoodCsvQuantity_('abc', 'Buy', 5),
  /row 5.*not a valid share count/i
);
assert.throws(
  () => context.parseInvestmentImportNumber_('1S'),
  /Invalid quantity in investment CSV: 1S/
);

// --- Classification: corporate actions in portfolio ---
const universe = { QQQ: true, ABC: true, XYZ: true };
const cutoff = '2026-04-27';
const sxchClass = context.classifyInvestmentImportRow_({
  activityDate: '2026-05-10',
  ticker: 'ABC',
  transCode: 'SXCH',
  quantity: 1,
  price: 0,
  amount: 0,
  description: 'Exchange received in',
  recurring: false
}, cutoff, universe, {});
assert.equal(sxchClass.accepted, true);
assert.equal(sxchClass.activityType, 'CORPORATE_ACTION_IN');

// --- Holdings rebuild includes corporate-action shares without buy cost ---
const aggregate = context.investmentActivityAggregateHoldingsFromRows_([
  { activityDate: '2026-04-27', ticker: 'QQQ', activityType: 'BUY', quantity: 5, price: 600 },
  { activityDate: '2026-05-10', ticker: 'ABC', activityType: 'CORPORATE_ACTION_IN', quantity: 1, price: 0 }
]);
assert.equal(aggregate.aggregate.QQQ.quantity, 5);
assert.equal(aggregate.aggregate.ABC.quantity, 1);

// --- Portfolio comparison only after valid proposed portfolio ---
const baselineHoldings = [{ ticker: 'QQQ', quantity: 5, lastActivityPrice: 600, totalBuyCost: 3000 }];
const baselineSs = {
  getSheetByName(name) {
    const sheetNames = context.getSheetNames_();
    if (name === sheetNames.INVESTMENT_ACTIVITY) {
      return {
        getLastRow: () => 2,
        getRange: () => ({
          getValues: () => [[
            'key-qqq', 'inv-robinhood-golden', 'Robinhood', '2026-04-27', '',
            'QQQ', 'BUY', 5, 600, -3000, 'NO', 'Invesco QQQ', 'ROBINHOOD_CSV', '2026-05-01'
          ]]
        })
      };
    }
    if (name === sheetNames.INVESTMENT_HOLDINGS) {
      return {
        getLastRow: () => 2,
        getRange: () => ({
          getValues: () => [[
            'inv-robinhood-golden', 'Robinhood', '2026-05-01', 'QQQ', 5, 3000,
            0, 0, 0, 600, 1, ''
          ]]
        })
      };
    }
    return null;
  }
};
const comparison = context.investmentActivityBuildRobinhoodPortfolioComparisonPreview_(
  baselineSs,
  'inv-robinhood-golden',
  [{
    importKey: 'new-1',
    activityDate: '2026-05-10',
    ticker: 'ABC',
    activityType: 'CORPORATE_ACTION_IN',
    quantity: 1,
    price: 0,
    amount: 0
  }]
);
assert.equal(comparison.status, 'HAS_DELTA');
assert.equal(comparison.holdingsCount.direction, 'up');

// --- Golden baseline fixture (older working Robinhood activity export) ---
const goldenPreview = previewRobinhoodFixture(fixture('synthetic_robinhood_activity_golden_baseline.txt'));
assert.equal(goldenPreview.acceptedRows.length, 104, 'Golden Robinhood CSV must keep 104 accepted activities');
assert.equal(goldenPreview.requiresTickerDecisions, false);
const goldenPortfolio = context.investmentActivitySummarizeAggregatePortfolio_(
  context.investmentActivityAggregateHoldingsFromRows_(goldenPreview.acceptedRows)
);
const goldenTickers = Object.keys(
  context.investmentActivityAggregateHoldingsFromRows_(goldenPreview.acceptedRows).aggregate
).sort();
assert.deepEqual(goldenTickers, ['JEPQ', 'QQQ', 'QQQI', 'SPYI']);
assert.equal(context.round2_(goldenPortfolio.marketValueTotal), 16418.58);
assert.equal(
  context.investmentActivityBuildRobinhoodPortfolioComparisonPreview_(
    mockSs, 'inv-robinhood-golden', goldenPreview.acceptedRows
  ).status,
  'HAS_DELTA'
);
const goldenComparison = context.investmentActivityBuildRobinhoodPortfolioComparisonPreview_(
  mockSs, 'inv-robinhood-golden', goldenPreview.acceptedRows
);
assert.notEqual(goldenComparison.marketValue.direction, 'flat');

// --- Newer export with OEXP / Quantity "1S" must preview successfully ---
const oexpPreview = previewRobinhoodFixture(fixture('synthetic_robinhood_activity_oexp_1s.txt'));
assert.equal(oexpPreview.acceptedRows.length, 104, 'OEXP 1S row must not block preview');
assert.equal(
  oexpPreview.excludedRows.filter((row) => row.reason === 'OPTIONS_ACTIVITY' && row.transCode === 'OEXP').length,
  1
);
assert.equal(
  context.round2_(
    context.investmentActivitySummarizeAggregatePortfolio_(
      context.investmentActivityAggregateHoldingsFromRows_(oexpPreview.acceptedRows)
    ).marketValueTotal
  ),
  16418.58
);

// --- Fixture-shaped CSV row: Quantity column is "1S", Trans Code is SXCH ---
const fixtureCsv = fixture('synthetic_robinhood_activity_corporate_actions.txt');
const fixtureLines = fixtureCsv.trim().split('\n');
const fixtureHeaders = fixtureLines[0].split(',').map((h) => h.replace(/^"|"$/g, ''));
const sxchFixtureRow = fixtureLines[2].split(',').map((cell) => cell.replace(/^"|"$/g, ''));
const quantityIndex = fixtureHeaders.indexOf('Quantity');
const transCodeIndex = fixtureHeaders.indexOf('Trans Code');
assert.equal(sxchFixtureRow[transCodeIndex], 'SXCH');
assert.equal(sxchFixtureRow[quantityIndex], '1S');
assert.equal(
  context.parseRobinhoodCsvQuantity_(
    sxchFixtureRow[quantityIndex],
    sxchFixtureRow[transCodeIndex],
    3
  ),
  1
);

assert.match(activitySource, /parseRobinhoodCsvQuantity_/);
assert.match(activitySource, /ROBINHOOD_CSV_NON_SHARE_QUANTITY_CODES_/);
assert.match(activitySource, /CORPORATE_ACTION_IN/);
assert.match(activitySource, /investmentActivityWriteRobinhoodPortfolioComparison_/);
assert.match(activitySource, /investmentActivityBuildRobinhoodPortfolioComparisonForDrawer_/);
assert.match(activitySource, /hadPriorPortfolio[\s\S]*?rebuildInvestmentHoldingsForAccount_/);
assert.doesNotMatch(activitySource, /Invalid quantity in investment CSV: 1S/);

console.log('checkRobinhoodCsvImportRegressions: ok');
