import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const projection = fs.readFileSync(new URL('../debt_payoff_projection.js', import.meta.url), 'utf8');
const plannerCore = fs.readFileSync(new URL('../planner_core.js', import.meta.url), 'utf8');
const plannerHelpers = fs.readFileSync(new URL('../planner_helpers.js', import.meta.url), 'utf8');
const body = fs.readFileSync(new URL('../Dashboard_Body.html', import.meta.url), 'utf8');
const client = fs.readFileSync(new URL('../Dashboard_Script_PlanningDebtPayoff.html', import.meta.url), 'utf8');
const thisWeekClient = fs.readFileSync(
  new URL('../Dashboard_Script_PlanningCapitalAllocation.html', import.meta.url), 'utf8');
const rollingClient = fs.readFileSync(
  new URL('../Dashboard_Script_RollingDebtPayoff.html', import.meta.url), 'utf8');
const rolling = fs.readFileSync(new URL('../rolling_debt_payoff.js', import.meta.url), 'utf8');
const capital = fs.readFileSync(new URL('../capital_allocation.js', import.meta.url), 'utf8');
const help = fs.readFileSync(new URL('../Dashboard_Help.html', import.meta.url), 'utf8');

function sliceFunction(source, name) {
  const start = source.indexOf(`function ${name}`);
  assert.ok(start >= 0, `${name} is missing`);
  const end = source.indexOf('\nfunction ', start + 1);
  return source.slice(start, end < 0 ? source.length : end);
}

function sliceFrom(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  assert.ok(start >= 0, `missing ${startMarker}`);
  const end = endMarker ? source.indexOf(endMarker, start + startMarker.length) : source.length;
  assert.ok(end > start, `missing end for ${startMarker}`);
  return source.slice(start, end < 0 ? source.length : end);
}

const planningTools = body.slice(
  body.indexOf('class="tabs planning-primary-tools"'),
  body.indexOf('id="debts"')
);
const debtOverview = body.slice(
  body.indexOf('id="debtPayoff"'),
  body.indexOf('id="rollingDebtPayoff" class="panel"')
);

assert.match(planningTools,
  /data-tab="capitalAllocationPreview"[\s\S]*?This week[\s\S]*?data-tab="rollingDebtPayoff"[\s\S]*?Rolling debt payoff[\s\S]*?data-tab="debtPayoff"[\s\S]*?Debt overview[\s\S]*?data-tab="retirement"/,
  'comparison must reuse Debt Overview rather than add a Planning tab');
assert.equal((body.match(/id="planning_tool_/g) || []).length, 6,
  'Planning must still expose exactly six tool buttons');
assert.match(debtOverview,
  /id="debt_payoff_strategy_wrap"[\s\S]*?Household strategy comparison/,
  'scenario comparison belongs inside Debt Overview');
assert.match(debtOverview,
  /Hypothetical extra-payment scenario[\s\S]*?prove the extra amount is affordable/,
  'the extra amount must be labeled hypothetical and not affordable');
assert.match(debtOverview,
  /not taken from This Week[\s\S]*?does not model a cash reserve/,
  'the scenario must not infer This Week extra or claim a future reserve');
assert.doesNotMatch(planningTools,
  /planning_tool_[^"]+"[^>]*>[\s\S]*?Strategy comparison/,
  'must not add a separate strategy-comparison Planning tool');

assert.match(client,
  /getDebtPayoffStrategyComparison\(\{\s*monthlyExtra:\s*parsed\.amount\s*\}\)/,
  'the client must send only the explicit monthly extra');
assert.match(client,
  /if \(!parsed\.ok\)[\s\S]*?wrap\.innerHTML = ''[\s\S]*?setStatus\(statusId, parsed\.error, true\)[\s\S]*?return;/,
  'invalid extra must show an error and must not run Compare');
assert.doesNotMatch(client, /\*\s*4/,
  'the extra must not be inferred by multiplying a weekly amount by four');
assert.doesNotMatch(client, /weeklyExtra|getCapitalAllocation|saveDebt\(|PropertiesService/);
assert.doesNotMatch(client, /setValue\(|appendRow\(|PAY_EXTRA_DEBT/);
assert.match(client, /Not within forecast horizon/);
assert.match(client, /Interest saved vs minimum-only/);
assert.match(client, /minimumPaymentKnown === false \? '—' : fmtCurrency/);
assert.match(client, /interestRateKnown === false \? '—' : fmtPercent/);

const comparisonSource = sliceFrom(
  projection,
  'var DEBT_PAYOFF_SCENARIO_HORIZON_MONTHS_',
  ''
);
assert.doesNotMatch(comparisonSource, /ROLLING_DP_|CitiAA|Southwest|Marriott|100000|50000/);
assert.doesNotMatch(comparisonSource, /getCapitalAllocation|getRollingDebtPayoffPlan|HELOC/);
assert.doesNotMatch(comparisonSource, /\.setValue\(|\.appendRow\(|PropertiesService|CacheService/);
assert.doesNotMatch(comparisonSource, /payload\.weeklyExtra|weeklyActions|\*\s*4/);
assert.match(projection,
  /function getDebtPayoffStrategyComparison\(payload\)[\s\S]*?parseDebtPayoffScenarioMonthlyExtra_\(payload\.monthlyExtra\)/);
assert.match(projection, /recommendationState: 'HYPOTHETICAL'/);
assert.match(projection, /extraIsAffordable: null/);
assert.match(projection, /persisted: false/);
assert.match(projection, /reserveModeled: false/);
assert.match(plannerCore, /interestRateKnown: interestRateKnown/);
assert.match(plannerCore, /function debtInterestRateCellIsKnown_/);

assert.match(capital, /coverage: 'CURRENT_WEEK_ONLY'/);
assert.doesNotMatch(capital, /compareDebtPayoffStrategies_|getDebtPayoffStrategyComparison/);
assert.match(rolling, /var ROLLING_DP_RESERVE_DEFAULT_ = 100000;/);
assert.match(rolling, /ROLLING_DP_EXEC_PLAN_SMALL_BALANCE_SNOWBALL_MAX_/);
assert.doesNotMatch(rolling, /getDebtPayoffStrategyComparison|compareDebtPayoffStrategies_/);
assert.doesNotMatch(thisWeekClient, /getDebtPayoffStrategyComparison|debt_payoff_scenario_extra/);
assert.doesNotMatch(rollingClient, /getDebtPayoffStrategyComparison|debt_payoff_scenario_extra/);
assert.match(help, /hypothetical overlay[\s\S]*?avalanche[\s\S]*?snowball/);

const context = vm.createContext({
  Date,
  Math,
  Number,
  String,
  Array,
  Object,
  JSON,
  isFinite,
  console
});
vm.runInContext(
  sliceFunction(plannerHelpers, 'toNumber_') +
  '\n' + sliceFunction(plannerHelpers, 'fmtCurrency_') +
  '\n' + sliceFunction(plannerHelpers, 'round2_') +
  '\n' + sliceFrom(projection, 'var DEBT_PAYOFF_SCENARIO_HORIZON_MONTHS_', ''),
  context
);

function usableDebt(name, balance, apr, min) {
  return {
    name: name,
    active: true,
    balance: balance,
    interestRate: apr,
    minimumPayment: min,
    minimumPaymentKnown: true,
    interestRateKnown: true
  };
}

const asOf = new Date(2026, 9, 7);
const extra = 50;
const debts = [
  usableDebt('High APR Card', 400, 24, 20),
  usableDebt('Small Balance Card', 200, 12, 20)
];
const comparison = context.compareDebtPayoffStrategies_(debts, extra, { asOfDate: asOf });

assert.equal(comparison.persisted, false);
assert.equal(comparison.extraIsAffordable, null);
assert.equal(comparison.reserveModeled, false);
assert.equal(comparison.householdComparisonComplete, true);
assert.equal(comparison.monthlyExtra, extra);
assert.equal(comparison.strategies.avalanche.monthlyExtra, extra);
assert.equal(comparison.strategies.snowball.monthlyExtra, extra);
assert.equal(comparison.strategies.minimum_only.monthlyExtra, 0,
  'minimum-only must not receive the extra amount');
assert.equal(Array.from(comparison.strategies.avalanche.extraPriorityOrder).join('|'),
  'High APR Card|Small Balance Card');
assert.equal(Array.from(comparison.strategies.snowball.extraPriorityOrder).join('|'),
  'Small Balance Card|High APR Card');
assert.equal(comparison.strategies.avalanche.payoffOrder[0].name, 'High APR Card');
assert.equal(comparison.strategies.snowball.payoffOrder[0].name, 'Small Balance Card');
assert.ok(comparison.strategies.avalanche.totalInterest <= comparison.strategies.snowball.totalInterest);
assert.ok(comparison.strategies.snowball.totalInterest <= comparison.strategies.minimum_only.totalInterest);
assert.ok(comparison.strategies.avalanche.interestSavedVsMinimumOnly >=
  comparison.strategies.snowball.interestSavedVsMinimumOnly);
assert.equal(comparison.strategies.minimum_only.interestSavedVsMinimumOnly, 0);
assert.equal(comparison.strategies.minimum_only.debtFreeWithinHorizon, true);
assert.equal(comparison.strategies.avalanche.debtFreeWithinHorizon, true);
assert.match(String(comparison.strategies.avalanche.debtFreeMonthKey), /^\d{4}-\d{2}$/);
assert.ok(comparison.assumptions.some(function(line) {
  return /hypothetical/i.test(line) && /not proof that the extra is affordable/i.test(line);
}));
assert.ok(comparison.assumptions.some(function(line) {
  return /does not model future income, expenses, cash reserves, or changing rates/.test(line);
}));
assert.ok(comparison.assumptions.some(function(line) {
  return /APR ÷ 100 ÷ 12/.test(line);
}));
assert.ok(comparison.assumptions.some(function(line) {
  return /600 months/.test(line);
}));

const zeroExtra = context.compareDebtPayoffStrategies_(debts, 0, { asOfDate: asOf });
assert.equal(zeroExtra.strategies.avalanche.monthlyExtra, 0);
assert.equal(zeroExtra.strategies.snowball.monthlyExtra, 0);
assert.equal(zeroExtra.strategies.avalanche.totalInterest, zeroExtra.strategies.minimum_only.totalInterest);
assert.equal(zeroExtra.strategies.snowball.totalInterest, zeroExtra.strategies.minimum_only.totalInterest);

assert.equal(context.parseDebtPayoffScenarioMonthlyExtra_(50).ok, true);
assert.equal(context.parseDebtPayoffScenarioMonthlyExtra_(50).amount, 50);
assert.equal(context.parseDebtPayoffScenarioMonthlyExtra_('').ok, true);
assert.equal(context.parseDebtPayoffScenarioMonthlyExtra_('').amount, 0);
assert.equal(context.parseDebtPayoffScenarioMonthlyExtra_(null).amount, 0);
assert.equal(context.parseDebtPayoffScenarioMonthlyExtra_('1,200.50').amount, 1200.5);
assert.equal(context.parseDebtPayoffScenarioMonthlyExtra_(-25).ok, false);
assert.equal(context.parseDebtPayoffScenarioMonthlyExtra_(-25).amount, null);
assert.equal(context.parseDebtPayoffScenarioMonthlyExtra_('abc').ok, false);
assert.equal(context.parseDebtPayoffScenarioMonthlyExtra_(Number.NaN).ok, false);
assert.equal(context.parseDebtPayoffScenarioMonthlyExtra_(Number.POSITIVE_INFINITY).ok, false);
assert.notEqual(context.parseDebtPayoffScenarioMonthlyExtra_(50).amount, 200,
  'weekly extra must not be multiplied by four');

assert.throws(function() {
  context.compareDebtPayoffStrategies_(debts, -25, { asOfDate: asOf });
}, /valid monthly extra/i);
assert.throws(function() {
  context.getDebtPayoffStrategyComparison({ monthlyExtra: -25 });
}, /valid monthly extra/i);
assert.throws(function() {
  context.getDebtPayoffStrategyComparison({ monthlyExtra: 'nope' });
}, /valid monthly extra/i);

let compareInvoked = 0;
const originalCompare = context.compareDebtPayoffStrategies_;
context.compareDebtPayoffStrategies_ = function() {
  compareInvoked += 1;
  return originalCompare.apply(this, arguments);
};
compareInvoked = 0;
assert.throws(function() {
  context.getDebtPayoffStrategyComparison({ monthlyExtra: -1 });
}, /valid monthly extra/i);
assert.equal(compareInvoked, 0,
  'invalid extra must not return or invoke a $0 scenario comparison');
context.compareDebtPayoffStrategies_ = originalCompare;

const clientContext = vm.createContext({
  Date, Math, Number, String, Array, Object, JSON, isFinite
});
vm.runInContext(sliceFunction(client, 'parseDebtPayoffScenarioExtraText_'), clientContext);
assert.equal(clientContext.parseDebtPayoffScenarioExtraText_('').amount, 0);
assert.equal(clientContext.parseDebtPayoffScenarioExtraText_('   ').amount, 0);
assert.equal(clientContext.parseDebtPayoffScenarioExtraText_('75').ok, true);
assert.equal(clientContext.parseDebtPayoffScenarioExtraText_('75').amount, 75);
assert.equal(clientContext.parseDebtPayoffScenarioExtraText_('-10').ok, false);
assert.equal(clientContext.parseDebtPayoffScenarioExtraText_('abc').ok, false);

let rpcPayloads = [];
let statusCalls = [];
const extraInputEl = { value: '-40' };
const resultsEl = { innerHTML: 'stale' };
const runContext = vm.createContext({
  Date, Math, Number, String, Array, Object, JSON, isFinite,
  document: {
    getElementById: function(id) {
      if (id === 'debt_payoff_scenario_extra') return extraInputEl;
      if (id === 'debt_payoff_strategy_results') return resultsEl;
      return null;
    }
  },
  setStatus: function(id, message, isError) {
    statusCalls.push({ id: id, message: message, isError: isError });
  },
  loadingIndicatorHtml: function() { return 'loading'; },
  google: {
    script: {
      run: {
        withSuccessHandler: function() {
          return {
            withFailureHandler: function() {
              return {
                getDebtPayoffStrategyComparison: function(payload) {
                  rpcPayloads.push(payload);
                }
              };
            }
          };
        }
      }
    }
  }
});
vm.runInContext(
  sliceFunction(client, 'parseDebtPayoffScenarioExtraFromInput_') +
  '\n' + sliceFunction(client, 'parseDebtPayoffScenarioExtraText_') +
  '\n' + sliceFunction(client, 'runDebtPayoffStrategyComparison'),
  runContext
);
runContext.runDebtPayoffStrategyComparison();
assert.equal(rpcPayloads.length, 0, 'invalid extra must not call the comparison RPC');
assert.equal(resultsEl.innerHTML, '',
  'invalid extra must not display a $0 scenario');
assert.equal(statusCalls.some(function(row) {
  return row.isError && /valid monthly extra/i.test(row.message);
}), true);

extraInputEl.value = '';
rpcPayloads = [];
statusCalls = [];
resultsEl.innerHTML = '';
runContext.runDebtPayoffStrategyComparison();
assert.equal(rpcPayloads.length, 1, 'blank extra must still run the $0 scenario');
assert.equal(rpcPayloads[0].monthlyExtra, 0);
assert.equal(statusCalls.some(function(row) { return row.isError; }), false);

extraInputEl.value = '125.50';
rpcPayloads = [];
runContext.runDebtPayoffStrategyComparison();
assert.equal(rpcPayloads.length, 1);
assert.equal(rpcPayloads[0].monthlyExtra, 125.5);

const overpay = context.simulateDebtPayoffSchedule_(
  [usableDebt('Tiny', 100, 0, 10)], 1000, 'avalanche', { asOfDate: asOf });
assert.equal(overpay.debtFreeWithinHorizon, true);
assert.equal(overpay.debtFreeMonthIndex, 1);
assert.equal(overpay.remainingBalance, 0);
assert.ok(overpay.totalInterest >= 0);
assert.equal(overpay.payoffOrder.length, 1);

const stuck = usableDebt('Stuck', 10000, 24, 50);
const cannot = context.compareDebtPayoffStrategies_([stuck], 0, {
  asOfDate: asOf,
  horizonMonths: 24
});
assert.equal(Array.from(cannot.strategies.minimum_only.cannotAmortizeAtMinimum).join('|'),
  'Stuck');
assert.equal(cannot.strategies.minimum_only.debtFreeWithinHorizon, false);
assert.equal(cannot.strategies.minimum_only.debtFreeMonthKey, null);

const extraUnsticks = context.compareDebtPayoffStrategies_([stuck], 400, {
  asOfDate: asOf,
  horizonMonths: 120
});
assert.equal(Array.from(extraUnsticks.strategies.avalanche.cannotAmortizeAtMinimum).join('|'),
  'Stuck');
assert.equal(extraUnsticks.strategies.avalanche.debtFreeWithinHorizon, true);

const missingApr = context.compareDebtPayoffStrategies_([
  usableDebt('Known Card', 400, 24, 20),
  {
    name: 'Blank APR Card',
    active: true,
    balance: 900,
    interestRate: 0,
    minimumPayment: 25,
    minimumPaymentKnown: true,
    interestRateKnown: false
  }
], 50, { asOfDate: asOf });
assert.equal(missingApr.householdComparisonComplete, false);
assert.equal(missingApr.blockers.length, 1);
assert.equal(missingApr.blockers[0].name, 'Blank APR Card');
assert.equal(Array.from(missingApr.modeledDebtNames).join('|'), 'Known Card');
assert.equal(missingApr.strategies.avalanche.payoffOrder.some(function(row) {
  return row.name === 'Blank APR Card';
}), false);

const missingMin = context.compareDebtPayoffStrategies_([
  usableDebt('Known Card', 400, 24, 20),
  {
    name: 'Blank Min Card',
    active: true,
    balance: 900,
    interestRate: 19.99,
    minimumPayment: 0,
    minimumPaymentKnown: false,
    interestRateKnown: true
  }
], 50, { asOfDate: asOf });
assert.equal(missingMin.householdComparisonComplete, false);
assert.equal(missingMin.blockers[0].name, 'Blank Min Card');
assert.equal(missingMin.strategies.minimum_only.payoffOrder.some(function(row) {
  return row.name === 'Blank Min Card';
}), false);

const emptyHousehold = context.compareDebtPayoffStrategies_([], 200, { asOfDate: asOf });
assert.equal(emptyHousehold.householdComparisonComplete, false);
assert.equal(emptyHousehold.strategies.avalanche.debtFreeWithinHorizon, false);
assert.equal(emptyHousehold.strategies.avalanche.monthlyExtra, 200);
assert.equal(emptyHousehold.strategies.snowball.monthlyExtra, 200);

const rateContext = vm.createContext({
  Date, Math, Number, String, Array, Object, JSON, isFinite,
  DEBT_LEGACY_FALLBACK_: { BALANCE_OR_MIN: 'BALANCE_OR_MIN' },
  isDebtInactive_: function() { return false; },
  normalizeName_: function(name) { return String(name || '').trim(); }
});
vm.runInContext(
  sliceFunction(plannerHelpers, 'toNumber_') +
  '\n' + sliceFunction(plannerHelpers, 'round2_') +
  '\n' + sliceFunction(plannerCore, 'debtMinimumPaymentCellIsKnown_') +
  '\n' + sliceFunction(plannerCore, 'debtInterestRateCellIsKnown_') +
  '\n' + sliceFunction(plannerCore, 'normalizeDebts_'),
  rateContext
);

assert.equal(rateContext.debtInterestRateCellIsKnown_('', ''), false);
assert.equal(rateContext.debtInterestRateCellIsKnown_(0, '0.00%'), true);
assert.equal(rateContext.debtInterestRateCellIsKnown_('n/a', 'n/a'), false);

const normalizedUnknownApr = rateContext.normalizeDebts_([{
  'Account Name': 'Unknown APR Card',
  'Account Balance': 500,
  'Minimum Payment': 25,
  'Int Rate': '',
  '__display__Int Rate': '',
  Active: 'Yes',
  Type: 'Credit Card'
}], {});
assert.equal(normalizedUnknownApr[0].interestRateKnown, false);
assert.equal(normalizedUnknownApr[0].interestRate, 0);
assert.equal(normalizedUnknownApr[0].minimumPaymentKnown, true);

const normalizedZeroApr = rateContext.normalizeDebts_([{
  'Account Name': 'Zero APR Card',
  'Account Balance': 500,
  'Minimum Payment': 25,
  'Int Rate': 0,
  '__display__Int Rate': '0.00%',
  Active: 'Yes',
  Type: 'Credit Card'
}], {});
assert.equal(normalizedZeroApr[0].interestRateKnown, true);
assert.equal(normalizedZeroApr[0].interestRate, 0);

console.log('checkDebtPayoffStrategyComparisonRegressions: ok');
