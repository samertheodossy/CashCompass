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
const dashboardData = fs.readFileSync(new URL('../dashboard_data.js', import.meta.url), 'utf8');
const cashflowSetup = fs.readFileSync(new URL('../cashflow_setup.js', import.meta.url), 'utf8');
const incomeSources = fs.readFileSync(new URL('../income_sources.js', import.meta.url), 'utf8');
const incomeClient = fs.readFileSync(new URL('../Dashboard_Script_Income.html', import.meta.url), 'utf8');

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
  /getDebtPayoffStrategyComparison\(\{[\s\S]*monthlyExtra:\s*parsed\.amount[\s\S]*bonusSelections:\s*bonusSelections/,
  'the client must send the explicit monthly extra and optional bonus selections');
assert.match(body, /id="debt_payoff_scenario_bonus_wrap"/);
assert.match(client, /function collectDebtPayoffScenarioBonusSelections_/);
assert.match(client, /function validateDebtPayoffScenarioBonusSelections_/);
assert.match(help, /optional comparison overlay can include a bonus/);
assert.match(help, /RSU\/ESPP sales, Other Stock Sales, and tax refunds stay excluded/);
assert.match(sliceFunction(client, 'runDebtPayoffStrategyComparison'),
  /if \(!parsed\.ok\)[\s\S]*?wrap\.innerHTML = ''[\s\S]*?setStatus\(statusId, parsed\.error, true\)[\s\S]*?return;/,
  'invalid extra must show an error and must not run Compare');
assert.match(sliceFunction(client, 'runDebtPayoffStrategyComparison'),
  /if \(!bonusCheck\.ok\)[\s\S]*?wrap\.innerHTML = ''[\s\S]*?setStatus\(statusId, bonusCheck\.error, true\)[\s\S]*?return;/,
  'invalid bonus timing must show an error and must not run Compare');
assert.doesNotMatch(client, /\*\s*4/,
  'the extra must not be inferred by multiplying a weekly amount by four');
assert.doesNotMatch(client, /weeklyExtra|getCapitalAllocation|saveDebt\(|PropertiesService/);
assert.doesNotMatch(client, /setValue\(|appendRow\(|PAY_EXTRA_DEBT/);
assert.match(client, /Not within forecast horizon/);
assert.match(client, /less interest than baseline/);
assert.match(client, /more interest than baseline/);
assert.match(client, /Same interest as baseline/);
assert.doesNotMatch(sliceFunction(projection, 'summarizeDebtPayoffScenario_'),
  /Math\.max\(0,\s*Number\(minOnlyInterest/);
assert.match(sliceFunction(client, 'debtPayoffStrategyTitle_'), /data\.baselineLabel/);
assert.match(sliceFunction(client, 'renderDebtPayoffStrategyCard_'),
  /debtPayoffStrategyTitle_\(row\.strategy, data\)/);
assert.match(sliceFunction(client, 'renderDebtPayoffStrategyCard_'),
  /formatDebtPayoffInterestVsBaseline_\(row\)/);
assert.doesNotMatch(sliceFunction(client, 'renderDebtPayoffStrategyCard_'),
  /fmtCurrency\(row\.interestSavedVsMinimumOnly\)/);
assert.match(help, /additional interest, not \$0 saved/);
assert.match(debtOverview, /additional interest is shown rather than \$0 saved/);
assert.match(help, /not “minimum payments only\.”/);
assert.match(projection, /DEBT_PAYOFF_SCENARIO_BASELINE_WITH_BONUS_LABEL_/);
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
assert.match(comparisonSource, /function buildDebtPayoffSupportedMonthlyExtra_/);
assert.match(comparisonSource, /\*\s*52\s*\/\s*12/);
assert.doesNotMatch(comparisonSource, /buildCapitalAllocationPlan_/);
assert.doesNotMatch(comparisonSource, /classifyIncomeGroupsInSheet_/);
assert.doesNotMatch(comparisonSource, /three months of recurring bills/);
assert.match(comparisonSource, /readCapitalAllocationFacts_/);
assert.match(comparisonSource, /futureUpcomingAmount/);
assert.match(comparisonSource, /propertyContingencyAmount/);
assert.match(help, /canonical reserve[\s\S]*?upcoming expenses and property contingency/);
assert.match(debtOverview, /id="debt_payoff_supported_extra"/);
assert.match(client, /Use this amount in the scenario/);
assert.match(client, /function useDebtPayoffSupportedMonthlyExtra_/);
assert.match(help, /estimated recurring monthly extra[\s\S]*?Use this amount in the scenario/);
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
  '\n' + sliceFunction(plannerHelpers, 'parseMonthHeader_') +
  '\n' + sliceFunction(plannerCore, 'debtMinimumPaymentCellIsKnown_') +
  '\n' + sliceFunction(dashboardData, 'normalizeYesNo_') +
  '\n' + sliceFunction(dashboardData, 'normalizeFrequency_') +
  '\n' + sliceFrom(incomeSources, 'var CISCO_MID_YEAR_BONUS_PAYEE_', '\nfunction incomeIsExcludedName_') +
  '\n' + sliceFunction(incomeSources, 'incomeIsExcludedName_') +
  '\n' + sliceFunction(incomeSources, 'parseIncomeRecurringStatusFromDashboard_') +
  '\n' + sliceFunction(incomeSources, 'parseIncomeFrequencyFromDashboard_') +
  '\n' + sliceFunction(incomeSources, 'parseIncomeExpectedAmountFromDashboard_') +
  '\n' + sliceFunction(incomeSources, 'applyIncomeForecastFieldsToRow_') +
  '\n' + sliceFrom(incomeSources, 'function ciscoBonusHistoryValueIsFormula_', '\nfunction listCiscoBonusIncomeEntries_') +
  '\n' + sliceFunction(cashflowSetup, 'detectCashFlowLayout_') +
  '\n' + sliceFunction(cashflowSetup, 'cashFlowIsSummaryHeader_') +
  '\n' + sliceFunction(cashflowSetup, 'cashFlowLastSummaryColumnIndex_') +
  '\n' + sliceFrom(cashflowSetup, 'var CASH_FLOW_INCOME_FORECAST_HEADERS_', '\nfunction ensureCashFlowIncomeForecastSchema_') +
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
  '\n' + sliceFunction(client, 'collectDebtPayoffScenarioBonusSelections_') +
  '\n' + sliceFunction(client, 'debtPayoffScenarioForecastStartMonthKey_') +
  '\n' + sliceFunction(client, 'validateDebtPayoffScenarioBonusSelections_') +
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
assert.deepEqual(Array.from(rpcPayloads[0].bonusSelections || []), [],
  'bonuses stay off unless explicitly included');
assert.equal(statusCalls.some(function(row) { return row.isError; }), false);

extraInputEl.value = '125.50';
rpcPayloads = [];
runContext.runDebtPayoffStrategyComparison();
assert.equal(rpcPayloads.length, 1);
assert.equal(rpcPayloads[0].monthlyExtra, 125.5);
assert.deepEqual(Array.from(rpcPayloads[0].bonusSelections || []), []);

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

const renderSupported = sliceFunction(client, 'renderDebtPayoffSupportedMonthlyExtra_');
assert.doesNotMatch(renderSupported, /debt_payoff_scenario_extra/,
  'the estimate must not auto-fill the hypothetical extra field');
const useSupported = sliceFunction(client, 'useDebtPayoffSupportedMonthlyExtra_');
assert.match(useSupported, /el\.value = amount\.toFixed\(2\)/);
assert.doesNotMatch(useSupported, /runDebtPayoffStrategyComparison|google\.script\.run/,
  'using the estimate copies the field only and does not run Compare or write');

function confirmedIncome(name, monthlyAmount) {
  return {
    rawPayee: name,
    name: name,
    recurringConfirmed: true,
    cadenceKnown: true,
    frequency: 'monthly',
    expectedAmount: monthlyAmount,
    amountKnown: true
  };
}

const baseSupported = {
  recurringIncomeSources: [confirmedIncome('Salary', 4000)],
  incomeUnavailable: false,
  debts: [{
    name: 'Card', active: true, balance: 800, minimumPayment: 500,
    minimumPaymentKnown: true
  }],
  bills: [{
    payee: 'Rent', amount: 1000, amountKnown: true, frequency: 'monthly',
    active: true, varies: 'No'
  }],
  policyFloors: [],
  usableCashAfterBuffers: 5000,
  usableCashKnown: true,
  reserveKnown: true,
  requiredReserveAmount: 1000
};

const surplus = context.buildDebtPayoffSupportedMonthlyExtra_(baseSupported);
assert.equal(surplus.available, true);
assert.equal(surplus.amount, 2500);
assert.equal(surplus.label, 'Estimate');
assert.equal(surplus.persisted, false);
assert.equal(surplus.extraIsAffordable, null);
assert.equal(surplus.deficit, false);
assert.equal(surplus.reserveProtects, false);
assert.notEqual(surplus.amount, 1000 * 4,
  'must not invent extra by multiplying a weekly figure by four');

const deficit = context.buildDebtPayoffSupportedMonthlyExtra_(Object.assign({}, baseSupported, {
  recurringIncomeSources: [confirmedIncome('Salary', 1200)]
}));
assert.equal(deficit.available, true);
assert.equal(deficit.deficit, true);
assert.equal(deficit.amount, 0);

const missingIncome = context.buildDebtPayoffSupportedMonthlyExtra_(Object.assign({}, baseSupported, {
  recurringIncomeSources: [],
  incomeUnavailable: true
}));
assert.equal(missingIncome.available, false);
assert.equal(missingIncome.amount, null);
assert.equal(missingIncome.blockers[0].code, 'INCOME_UNAVAILABLE');

const unknownMin = context.buildDebtPayoffSupportedMonthlyExtra_(Object.assign({}, baseSupported, {
  debts: [{
    name: 'Blank Min Card', active: true, balance: 900, minimumPayment: 0,
    minimumPaymentKnown: false
  }]
}));
assert.equal(unknownMin.available, false);
assert.equal(unknownMin.amount, null);
assert.equal(unknownMin.blockers.some(function(row) { return row.code === 'MINIMUM_UNKNOWN'; }), true);

const unknownFrequency = context.buildDebtPayoffSupportedMonthlyExtra_(Object.assign({}, baseSupported, {
  bills: [{
    payee: 'Utility', amount: 80, amountKnown: true, frequency: 'unknown',
    active: true
  }]
}));
assert.equal(unknownFrequency.available, false);
assert.equal(unknownFrequency.amount, null);
assert.equal(unknownFrequency.blockers.some(function(row) {
  return row.code === 'BILL_FREQUENCY_UNKNOWN';
}), true);

const reserveProtected = context.buildDebtPayoffSupportedMonthlyExtra_(Object.assign({}, baseSupported, {
  usableCashAfterBuffers: 1000,
  requiredReserveAmount: 4000
}));
assert.equal(reserveProtected.available, true);
assert.equal(reserveProtected.reserveProtects, true);
assert.equal(reserveProtected.amount, 0);
assert.ok(reserveProtected.recurringSurplusBeforeReserve > 0);

const weeklyFloor = context.debtPayoffScenarioWeeklyToMonthly_(500);
assert.equal(weeklyFloor, 2166.67);
assert.notEqual(weeklyFloor, 2000);

const doubleCount = context.buildDebtPayoffSupportedMonthlyExtra_({
  recurringIncomeSources: [confirmedIncome('Salary', 5000)],
  reserveKnown: true,
  requiredReserveAmount: 500,
  debts: [{
    name: 'Visa', active: true, balance: 1200, minimumPayment: 200,
    minimumPaymentKnown: true
  }],
  bills: [
    { payee: 'Visa', amount: 500, amountKnown: true, frequency: 'monthly', active: true },
    { payee: 'Rent', amount: 1000, amountKnown: true, frequency: 'monthly', active: true },
    {
      payee: 'Samer Robinhood', amount: 500, amountKnown: true, frequency: 'weekly',
      active: true, isInvestmentContribution: true,
      matchedInvestmentAccount: 'Samer Robinhood'
    },
    {
      payee: 'Other IRA', amount: 300, amountKnown: true, frequency: 'monthly',
      active: true, isInvestmentContribution: true, matchedInvestmentAccount: ''
    }
  ],
  policyFloors: [{ accountName: 'Samer Robinhood', weeklyAmount: 500 }],
  usableCashAfterBuffers: 20000,
  usableCashKnown: true
});
assert.equal(doubleCount.available, true);
assert.equal(doubleCount.components.debtMinimumsMonthly, 200);
assert.equal(doubleCount.components.recurringBillsMonthly, 1000);
assert.equal(doubleCount.components.policyFloorMonthly, 2166.67);
assert.equal(doubleCount.components.unmatchedInvestmentBillsMonthly, 300);
assert.notEqual(doubleCount.components.recurringBillsMonthly, 1700,
  'debt-named bills must not be added on top of the contractual minimum');
assert.notEqual(doubleCount.components.policyFloorMonthly, 4333.34,
  'a matching policy-floor bill must not be counted twice');
assert.equal(doubleCount.amount, 1333.33);

const oneTimeIncome = context.buildDebtPayoffSupportedMonthlyExtra_(Object.assign({}, baseSupported, {
  recurringIncomeSources: [{
    rawPayee: 'Freelance Project',
    name: 'Freelance Project',
    recurringConfirmed: false,
    expectedAmount: 4000,
    frequency: 'monthly'
  }]
}));
assert.equal(oneTimeIncome.available, false);
assert.equal(oneTimeIncome.amount, null);
assert.equal(oneTimeIncome.blockers.some(function(row) {
  return row.code === 'INCOME_CADENCE_UNCONFIRMED';
}), true);

const irregularIncome = context.buildDebtPayoffSupportedMonthlyExtra_(Object.assign({}, baseSupported, {
  recurringIncomeSources: [{
    rawPayee: 'Salary',
    name: 'Salary',
    recurringConfirmed: true,
    cadenceKnown: true,
    frequency: 'monthly',
    expectedAmount: 4000,
    inferredFromPositiveMonths: true,
    dropsZeroMonths: true
  }]
}));
assert.equal(irregularIncome.available, false);
assert.equal(irregularIncome.amount, null);
assert.equal(irregularIncome.blockers.some(function(row) {
  return row.code === 'INCOME_CADENCE_UNCONFIRMED';
}), true);

const hiddenRsu = context.buildDebtPayoffSupportedMonthlyExtra_(Object.assign({}, baseSupported, {
  recurringIncomeSources: [{
    name: 'Cisco Salary',
    rawPayees: ['Cisco Pay 1', 'Cisco Pay 3 (RSU)'],
    recurringConfirmed: true,
    cadenceKnown: true,
    frequency: 'monthly',
    expectedAmount: 4000
  }]
}));
assert.equal(hiddenRsu.available, false);
assert.equal(hiddenRsu.amount, null);
assert.equal(hiddenRsu.blockers.some(function(row) {
  return row.code === 'INCOME_EXCLUDED_IDENTITY_MIXED';
}), true);
assert.equal(context.debtPayoffRawIncomeIsExcluded_('Cisco Pay 3 (RSU)'), true);
assert.equal(context.debtPayoffRawIncomeIsExcluded_('Cisco Pay 1'), false);

const missingFloorHelpers = context.buildDebtPayoffSupportedMonthlyExtra_(Object.assign({}, baseSupported, {
  investmentsUnavailable: true
}));
assert.equal(missingFloorHelpers.available, false);
assert.equal(missingFloorHelpers.amount, null);
assert.equal(missingFloorHelpers.blockers.some(function(row) {
  return row.code === 'INVESTMENTS_UNAVAILABLE';
}), true);

const missingVaries = context.buildDebtPayoffSupportedMonthlyExtra_(Object.assign({}, baseSupported, {
  billsUnavailable: true,
  billsUnavailableReason: 'INPUT - Bills is missing the Varies column, so variable bills were not treated as fixed.'
}));
assert.equal(missingVaries.available, false);
assert.equal(missingVaries.amount, null);
assert.equal(missingVaries.blockers.some(function(row) {
  return row.code === 'BILLS_UNAVAILABLE';
}), true);

const missingCadenceHeaders = context.debtPayoffParseConfirmedCashFlowIncome_([
  ['Type', 'Payee', 'Active', 'Jan-26'],
  ['Income', 'Salary', 'Yes', '4000']
]);
assert.equal(missingCadenceHeaders.cadenceUnconfirmed, true);
assert.match(String(missingCadenceHeaders.reason), /Recurring, Frequency, and Expected Amount/);
assert.equal(missingCadenceHeaders.sources.length, 0);
assert.equal(missingCadenceHeaders.incompleteRows.length, 1);
assert.equal(missingCadenceHeaders.incompleteRows[0].payee, 'Salary');
assert.equal(missingCadenceHeaders.incompleteRows[0].sheetRow, 2);

const confirmedCashFlow = context.debtPayoffParseConfirmedCashFlowIncome_([
  ['Type', 'Payee', 'Active', 'Recurring', 'Frequency', 'Expected Amount'],
  ['Income', 'Salary', 'Yes', 'Yes', 'Monthly', '4000'],
  ['Income', 'Cisco Pay 3 (RSU)', 'Yes', 'Yes', 'Monthly', '2000'],
  ['Income', 'One-time bonus', 'Yes', 'Yes', 'Monthly', '800']
], [
  ['Type', 'Payee', 'Active', 'Recurring', 'Frequency', 'Expected Amount'],
  ['Income', 'Salary', 'Yes', 'Yes', 'Monthly', 4000],
  ['Income', 'Cisco Pay 3 (RSU)', 'Yes', 'Yes', 'Monthly', 2000],
  ['Income', 'One-time bonus', 'Yes', 'Yes', 'Monthly', 800]
]);
assert.equal(confirmedCashFlow.cadenceUnconfirmed, false);
assert.equal(confirmedCashFlow.sources.length, 1);
assert.equal(confirmedCashFlow.sources[0].rawPayee, 'Salary');

const canonicalReserve = context.debtPayoffReserveFromCanonicalForecast_({
  requiredReserveAmount: 4200,
  futureUpcomingAmount: 600,
  propertyContingencyAmount: 200,
  futureBillsAmount: 2500,
  futureDebtMinimumsAmount: 900
});
assert.equal(canonicalReserve.ok, true);
assert.equal(canonicalReserve.amount, 4200);
assert.equal(canonicalReserve.breakdown.futureUpcomingAmount, 600);
assert.equal(canonicalReserve.breakdown.propertyContingencyAmount, 200);
assert.notEqual(canonicalReserve.amount, (1000 + 500) * 3);

const billsOnlyProxy = context.debtPayoffReserveFromCanonicalForecast_({
  requiredReserveAmount: 4500,
  futureBillsAmount: 3000,
  futureDebtMinimumsAmount: 1500
});
assert.equal(billsOnlyProxy.ok, false);
assert.match(String(billsOnlyProxy.reason), /upcoming expenses or property contingency/);

const missingReserve = context.buildDebtPayoffSupportedMonthlyExtra_(Object.assign({}, baseSupported, {
  reserveKnown: false,
  requiredReserveAmount: null,
  reserveUnavailableReason: 'This Week’s canonical reserve, including upcoming expenses and property contingency, could not be proven.'
}));
assert.equal(missingReserve.available, false);
assert.equal(missingReserve.amount, null);
assert.equal(missingReserve.blockers.some(function(row) {
  return row.code === 'RESERVE_UNAVAILABLE';
}), true);

const incomeReader = sliceFunction(projection, 'readDebtPayoffSupportedMonthlyExtraIncome_');
assert.doesNotMatch(incomeReader, /ensureCashFlowIncomeForecastSchema_|setValue\(|insertColumn/);
assert.match(incomeReader, /Read-only\. Never self-heal schema here/);
assert.match(cashflowSetup,
  /concat\(\['Total'\]\)\s*\.concat\(CASH_FLOW_INCOME_FORECAST_HEADERS_\)/);
assert.match(cashflowSetup, /function ensureCashFlowIncomeForecastSchema_/);
assert.match(cashflowSetup, /function cashFlowIncomeForecastHeadersToAppend_/);
assert.doesNotMatch(cashflowSetup, /CASH_FLOW_REQUIRED_HEADERS_ = \[[^\]]*Recurring/);
assert.doesNotMatch(sliceFunction(incomeSources, 'addIncomeSourceFromDashboard'), /ensureCashFlowIncomeForecastSchema_/);
assert.doesNotMatch(sliceFunction(incomeSources, 'updateIncomeForecastFieldsFromDashboard'), /ensureCashFlowIncomeForecastSchema_/);
assert.match(incomeSources, /function addIncomeForecastColumnsFromDashboard/);
assert.doesNotMatch(sliceFunction(incomeSources, 'addIncomeForecastColumnsFromDashboard'),
  /insertCashFlowRow_|getMonthColumnByDate_|setCashFlowMoneyCellPreserveRowFormat_/);
assert.match(body, /id="income_forecast_schema_btn"/);
assert.match(body, /id="income_forecast_format_btn"/);
assert.match(incomeClient, /addIncomeForecastColumnsFromDashboard/);
assert.match(incomeClient, /function confirmAddIncomeForecastColumns_/);
assert.match(incomeClient, /function confirmFormatIncomeForecastColumns_/);
assert.match(incomeClient, /formatIncomeForecastColumnsFromDashboard/);
assert.match(incomeClient, /schema\.present === true && schema\.needsFormat !== true[\s\S]*?wrap\.style\.display = 'none'/);
assert.match(incomeClient, /schema\.present === true[\s\S]*?formatBtn\.style\.display = ''/);
assert.match(cashflowSetup, /function formatCashFlowIncomeForecastColumns_/);
assert.match(incomeSources, /function formatIncomeForecastColumnsFromDashboard/);
assert.doesNotMatch(sliceFunction(incomeSources, 'formatIncomeForecastColumnsFromDashboard'),
  /ensureCashFlowIncomeForecastSchema_|insertColumn|insertCashFlowRow_|setValue\(/);
assert.doesNotMatch(sliceFunction(cashflowSetup, 'formatCashFlowIncomeForecastColumns_'),
  /setValue\(|insertColumn|applyCashFlowSheetStyling_/);
assert.match(help, /separate Format action/);
assert.match(incomeSources, /headerMap\.recurringCol > 0 && recurring[\s\S]*?headerMap\.frequencyCol > 0 && frequency[\s\S]*?headerMap\.expectedAmountCol > 0 && expected\.known/);
assert.match(incomeSources, /function parseIncomeRecurringStatusFromDashboard_/);
assert.doesNotMatch(sliceFunction(incomeSources, 'parseIncomeRecurringStatusFromDashboard_'), /normalizeYesNo_/);
assert.doesNotMatch(sliceFunction(incomeSources, 'getIncomeSourcesForManagementFromDashboard'), /frequency: 'Monthly'/);
assert.match(body, /id="income_add_recurring"[\s\S]*?id="income_add_frequency"[\s\S]*?id="income_add_expected"/);
assert.match(body, /<option value="" selected>Unknown<\/option>[\s\S]*?<option value="Yes">Yes<\/option>[\s\S]*?<option value="No">No<\/option>/);
assert.match(incomeClient, /recurring: recurring[\s\S]*?frequency: frequency[\s\S]*?expectedAmount: expectedAmount/);
assert.match(incomeClient, /Expected amount is required when Recurring is Yes/);
assert.match(help, /Recurring \(Yes \/ No \/ unknown\), Frequency, and Expected amount/);
assert.doesNotMatch(body, /id="income_add_expected_month"|id="income_expected_month_schema_wrap"/);
assert.match(incomeClient, /updateCiscoBonusForecastFieldsFromDashboard/);
assert.match(incomeClient, /splitCiscoBonusIncomeRowsFromDashboard/);
assert.match(incomeClient, /Split into Cisco Mid Year Bonus and Cisco End Year Bonus/);
assert.match(incomeClient, /first bonus payment of the year/);
assert.match(incomeClient, /confirmProposal: true/);
assert.doesNotMatch(incomeClient, /February history can be assigned/);
assert.match(incomeClient, /kind === 'cisco_annual_bonus'/);
assert.match(sliceFunction(incomeClient, 'renderCiscoBonusOverview_'),
  /Annual income[\s\S]*?income-overview-table[\s\S]*?Expected Amount per year/);
assert.doesNotMatch(sliceFunction(incomeClient, 'renderCiscoBonusOverview_'),
  /income-bonus-review|Stop tracking|recurring monthly income/);
assert.match(sliceFunction(incomeClient, 'renderScheduledBonusSources_'),
  /Stop tracking[\s\S]*?income-manage-table/);
assert.match(sliceFunction(incomeClient, 'renderScheduledBonusSources_'),
  /split\.alreadySplit !== true/);
assert.doesNotMatch(incomeClient, /income-bonus-review/);
assert.doesNotMatch(incomeClient, /addCiscoBonusIncomeEntryFromDashboard|openCiscoBonusAddForm_/);
assert.doesNotMatch(sliceFunction(incomeClient, 'openCiscoBonusEditForm_'), /avgNonZero|src\.amount\b|februaryAmount|expectedMonth/);
assert.match(incomeSources, /function updateCiscoBonusForecastFieldsFromDashboard/);
assert.match(incomeSources, /function splitCiscoBonusIncomeRowsFromDashboard/);
assert.doesNotMatch(sliceFunction(incomeSources, 'updateCiscoBonusForecastFieldsFromDashboard'),
  /getMonthColumnByDate_|setCashFlowMoneyCellPreserveRowFormat_|expectedMonth/);
assert.match(incomeSources, /Cisco Mid Year Bonus and Cisco End Year Bonus are edited as their own annual income rows/);
assert.match(help, /Cisco Mid Year Bonus and Cisco End Year Bonus/);
assert.match(help, /not used for the 90-day cash reserve/);
assert.match(client, /function renderDebtPayoffDatedBonusScenarioHtml_/);
assert.match(client, /not cash available each month/);
assert.match(client, /not used for the 90-day cash reserve/);
assert.doesNotMatch(sliceFunction(projection, 'compareDebtPayoffStrategies_'),
  /datedBonusScenario|February Bonus Amount|Expected Month/);
assert.doesNotMatch(sliceFunction(projection, 'simulateDebtPayoffSchedule_'),
  /datedBonusScenario|February Bonus Amount|Expected Month/);
assert.match(sliceFunction(projection, 'simulateDebtPayoffSchedule_'),
  /d\.balance \+ interest[\s\S]*minimumPayment[\s\S]*bonusByMonth\[m\]/,
  'bonus cash must apply after interest and contractual minimums');
assert.match(sliceFunction(projection, 'simulateDebtPayoffSchedule_'),
  /applyDebtPayoffScenarioLeftover_\(\s*remaining, bonusAmount, allocStrategy\)/);
assert.match(sliceFunction(projection, 'simulateDebtPayoffSchedule_'),
  /applyDebtPayoffScenarioLeftover_\(\s*remaining, extra, allocStrategy\)/);
assert.match(help, /avalanche applies monthly extra and bonus payments highest APR first/);
assert.match(help, /snowball applies both smallest balance first/);
assert.doesNotMatch(sliceFunction(projection, 'resolveDebtPayoffScenarioBonusEvents_'),
  /setValue\(|appendRow\(|PropertiesService|parseMonthHeader_/);
assert.doesNotMatch(sliceFunction(projection, 'getDebtPayoffStrategyComparison'),
  /setValue\(|appendRow\(|PropertiesService/);
assert.match(projection, /appliedToComparison: false/);
assert.match(projection, /countedInRecurringIncomeMonthly: false/);
assert.match(projection, /countedInReserve: false/);
assert.doesNotMatch(cashflowSetup, /CASH_FLOW_EXPECTED_MONTH_HEADERS_|Expected Month/);
assert.doesNotMatch(cashflowSetup, /concat\(CASH_FLOW_CISCO_BONUS_HEADERS_\)/);

assert.equal(context.parseIncomeRecurringStatusFromDashboard_(''), '');
assert.equal(context.parseIncomeRecurringStatusFromDashboard_('Yes'), 'Yes');
assert.equal(context.parseIncomeRecurringStatusFromDashboard_('No'), 'No');
assert.equal(context.parseIncomeExpectedAmountFromDashboard_('').known, false);
assert.equal(context.parseIncomeExpectedAmountFromDashboard_(0).known, true);
assert.equal(context.parseIncomeExpectedAmountFromDashboard_(0).value, 0);
assert.equal(context.parseIncomeExpectedAmountFromDashboard_('0').value, 0);

const freqHeaders = ['Type', 'Payee', 'Active', 'Recurring', 'Frequency', 'Expected Amount'];
function parseIncomeRows(rows, valueRows) {
  const display = [freqHeaders].concat(rows);
  const values = [freqHeaders].concat(valueRows || rows.map(function(row) {
    return row.slice(0, 5).concat([row[5] === '' || row[5] == null ? '' : Number(row[5])]);
  }));
  return context.debtPayoffParseConfirmedCashFlowIncome_(display, values);
}

const blankRecurring = parseIncomeRows([
  ['Income', 'Salary', 'Yes', '', 'Monthly', '4000']
], [
  ['Income', 'Salary', 'Yes', '', 'Monthly', 4000]
]);
assert.equal(blankRecurring.cadenceUnconfirmed, true);
assert.match(String(blankRecurring.reason), /Salary \(Cash Flow row 2\) needs Recurring/);
assert.equal(blankRecurring.sources.length, 0);
assert.equal(blankRecurring.incompleteRows.length, 1);
assert.equal(blankRecurring.incompleteRows[0].payee, 'Salary');
assert.equal(blankRecurring.incompleteRows[0].sheetRow, 2);
assert.deepEqual(Array.from(blankRecurring.incompleteRows[0].missing), ['Recurring']);

const recurringNo = parseIncomeRows([
  ['Income', 'Side gig', 'Yes', 'No', 'Monthly', '4000']
], [
  ['Income', 'Side gig', 'Yes', 'No', 'Monthly', 4000]
]);
assert.equal(recurringNo.cadenceUnconfirmed, false);
assert.equal(recurringNo.sources.length, 0);

const recurringYes = parseIncomeRows([
  ['Income', 'Salary', 'Yes', 'Yes', 'Monthly', '4000']
], [
  ['Income', 'Salary', 'Yes', 'Yes', 'Monthly', 4000]
]);
assert.equal(recurringYes.cadenceUnconfirmed, false);
assert.equal(recurringYes.sources.length, 1);
assert.equal(recurringYes.sources[0].recurringConfirmed, true);
assert.equal(recurringYes.sources[0].expectedAmount, 4000);

const supportedFreq = {
  Weekly: 'weekly',
  Biweekly: 'biweekly',
  Monthly: 'monthly',
  'Semi-monthly / twice monthly': 'semi_monthly',
  'Every two months': 'bimonthly',
  Bimonthly: 'bimonthly',
  Quarterly: 'quarterly',
  'Semi-annually': 'semi_annually',
  Yearly: 'yearly'
};
const expectedMonthlyFrom100 = {
  weekly: 433.33,
  biweekly: 216.67,
  monthly: 100,
  semi_monthly: 200,
  bimonthly: 50,
  quarterly: 33.33,
  semi_annually: 16.67,
  yearly: 8.33
};
Object.keys(supportedFreq).forEach(function(label) {
  const key = supportedFreq[label];
  const parsed = parseIncomeRows([
    ['Income', 'Salary', 'Yes', 'Yes', label, '100']
  ], [
    ['Income', 'Salary', 'Yes', 'Yes', label, 100]
  ]);
  assert.equal(parsed.sources[0].frequency, key, label + ' must normalize');
  assert.equal(
    context.debtPayoffScenarioScheduledToMonthly_(100, key),
    expectedMonthlyFrom100[key],
    label + ' must convert by payment frequency, not sparse history'
  );
});

const explicitZero = parseIncomeRows([
  ['Income', 'Salary', 'Yes', 'Yes', 'Monthly', '0']
], [
  ['Income', 'Salary', 'Yes', 'Yes', 'Monthly', 0]
]);
assert.equal(explicitZero.sources[0].amountKnown, true);
assert.equal(explicitZero.sources[0].expectedAmount, 0);
const zeroClassified = context.debtPayoffClassifySupportedIncomeSource_(explicitZero.sources[0]);
assert.equal(zeroClassified.monthlyAmount, 0);
assert.equal(zeroClassified.blocker, undefined);

const blankExpected = parseIncomeRows([
  ['Income', 'Salary', 'Yes', 'Yes', 'Monthly', '']
], [
  ['Income', 'Salary', 'Yes', 'Yes', 'Monthly', '']
]);
assert.equal(blankExpected.cadenceUnconfirmed, true);
assert.equal(blankExpected.sources.length, 0);
assert.equal(blankExpected.incompleteRows[0].payee, 'Salary');
assert.deepEqual(Array.from(blankExpected.incompleteRows[0].missing), ['Expected Amount']);
assert.notEqual(explicitZero.sources[0].amountKnown, false);
const blankClassified = context.debtPayoffClassifySupportedIncomeSource_({
  rawPayee: 'Salary',
  name: 'Salary',
  recurringConfirmed: true,
  cadenceKnown: true,
  frequency: 'monthly',
  expectedAmount: null,
  amountKnown: false
});
assert.equal(blankClassified.blocker.code, 'INCOME_AMOUNT_UNKNOWN');
assert.match(String(blankClassified.blocker.reason), /blank Expected Amount/);

const inactiveIncome = parseIncomeRows([
  ['Income', 'Old job', 'No', '', 'Monthly', '4000'],
  ['Income', 'Salary', 'Yes', 'Yes', 'Monthly', '3000']
], [
  ['Income', 'Old job', 'No', '', 'Monthly', 4000],
  ['Income', 'Salary', 'Yes', 'Yes', 'Monthly', 3000]
]);
assert.equal(inactiveIncome.cadenceUnconfirmed, false);
assert.equal(inactiveIncome.sources.length, 1);
assert.equal(inactiveIncome.sources[0].rawPayee, 'Salary');

const mixedParser = parseIncomeRows([
  ['Income', 'Cisco Pay 1', 'Yes', 'Yes', 'Monthly', '4000'],
  ['Income', 'Cisco Pay 3 (RSU)', 'Yes', 'Yes', 'Monthly', '2000']
], [
  ['Income', 'Cisco Pay 1', 'Yes', 'Yes', 'Monthly', 4000],
  ['Income', 'Cisco Pay 3 (RSU)', 'Yes', 'Yes', 'Monthly', 2000]
]);
assert.equal(mixedParser.cadenceUnconfirmed, false);
assert.equal(mixedParser.sources.length, 1);
assert.deepEqual(Array.from(mixedParser.sources[0].rawPayees), ['Cisco Pay 1', 'Cisco Pay 3 (RSU)']);
const mixedClassified = context.debtPayoffClassifySupportedIncomeSource_(mixedParser.sources[0]);
assert.equal(mixedClassified.blocker.code, 'INCOME_EXCLUDED_IDENTITY_MIXED');

const bonusOnly = parseIncomeRows([
  ['Income', 'Annual Bonus', 'Yes', 'Yes', 'Yearly', '8000']
], [
  ['Income', 'Annual Bonus', 'Yes', 'Yes', 'Yearly', 8000]
]);
assert.equal(bonusOnly.sources.length, 0);

const populatedHeaders = [
  'Type', 'Flow Source', 'Payee', 'Active',
  'Jan-26', 'Feb-26', 'Mar-26', 'Apr-26', 'May-26', 'Jun-26',
  'Jul-26', 'Aug-26', 'Sep-26', 'Oct-26', 'Nov-26', 'Dec-26',
  'Total', 'Notes'
];
const populatedMonthValues = ['Income', 'CASH', 'Salary', 'YES',
  5000, 0, 5000, 5000, 5000, 5000, 5000, 5000, 5000, 5000, 5000, 5000, 55000, 'keep me'];
assert.deepEqual(
  Array.from(context.cashFlowIncomeForecastHeadersToAppend_(populatedHeaders)),
  ['Recurring', 'Frequency', 'Expected Amount']
);
const afterAppend = populatedHeaders.concat(['Recurring', 'Frequency', 'Expected Amount']);
assert.deepEqual(Array.from(context.cashFlowIncomeForecastHeadersToAppend_(afterAppend)), []);
assert.deepEqual(
  Array.from(context.cashFlowIncomeForecastHeadersToAppend_(populatedHeaders.concat(['Recurring']))),
  ['Frequency', 'Expected Amount']
);
const layoutWithTrailing = context.detectCashFlowLayout_(afterAppend);
assert.equal(afterAppend[layoutWithTrailing.totalCol0], 'Total');
assert.notEqual(afterAppend[layoutWithTrailing.totalCol0], 'Expected Amount');
assert.notEqual(afterAppend[layoutWithTrailing.totalCol0], 'Notes');
assert.equal(layoutWithTrailing.totalCol0, populatedHeaders.indexOf('Total'));
assert.equal(populatedMonthValues[4], 5000);
assert.equal(populatedMonthValues[5], 0);
assert.equal(populatedMonthValues[populatedHeaders.indexOf('Notes')], 'keep me');
assert.ok(afterAppend.indexOf('Recurring') > afterAppend.indexOf('Total'));
assert.ok(afterAppend.indexOf('Recurring') > afterAppend.indexOf('Notes'));
assert.equal(afterAppend[afterAppend.length - 3], 'Recurring');
assert.equal(afterAppend[afterAppend.length - 1], 'Expected Amount');

const populatedWorkbookHeaders = [
  'Type', 'Flow Source', 'Payee', 'Active',
  'Jan-26', 'Feb-26', 'Mar-26', 'Apr-26', 'May-26', 'Jun-26',
  'Jul-26', 'Aug-26', 'Sep-26', 'Oct-26', 'Nov-26', 'Dec-26',
  'Totals', 'Yearly Total'
];
const populatedWorkbookRow = [
  'Income', 'CASH', 'Salary', 'YES',
  5000, 0, 5000, 5000, 5000, 5000, 5000, 5000, 5000, 5000, 5000, 5000,
  '=SUM(E2:P2)', '=Q2'
];
const populatedGrid = [populatedWorkbookHeaders, populatedWorkbookRow];
const populatedLayout = context.detectCashFlowLayout_(populatedWorkbookHeaders);
assert.equal(populatedLayout.totalCol0, -1,
  'existing Totals / Yearly Total sheets must not be treated as a column named Total');
assert.equal(populatedWorkbookHeaders[populatedLayout.lastSummaryCol0], 'Yearly Total');
assert.ok(populatedLayout.lastSummaryCol0 > populatedLayout.lastMonthCol0);
const firstAppend = context.applyCashFlowIncomeForecastHeadersToGrid_(populatedGrid);
assert.deepEqual(Array.from(firstAppend.added), ['Recurring', 'Frequency', 'Expected Amount']);
assert.equal(firstAppend.grid[0][firstAppend.grid[0].length - 3], 'Recurring');
assert.equal(firstAppend.grid[0][firstAppend.grid[0].length - 1], 'Expected Amount');
assert.ok(firstAppend.grid[0].indexOf('Recurring') > firstAppend.grid[0].indexOf('Yearly Total'));
assert.ok(firstAppend.grid[0].indexOf('Recurring') > firstAppend.grid[0].indexOf('Totals'));
assert.equal(firstAppend.grid[1][4], 5000);
assert.equal(firstAppend.grid[1][5], 0);
assert.equal(firstAppend.grid[1][16], '=SUM(E2:P2)');
assert.equal(firstAppend.grid[1][17], '=Q2');
assert.equal(firstAppend.grid[1][18], '');
assert.equal(firstAppend.grid[1][19], '');
assert.equal(firstAppend.grid[1][20], '');
const secondAppend = context.applyCashFlowIncomeForecastHeadersToGrid_(firstAppend.grid);
assert.deepEqual(Array.from(secondAppend.added), []);
assert.deepEqual(Array.from(secondAppend.grid[0]), Array.from(firstAppend.grid[0]));
assert.equal(secondAppend.grid[1][16], '=SUM(E2:P2)');
assert.equal(secondAppend.grid[1][4], 5000);
assert.equal(context.cashFlowIsSummaryHeader_('Totals'), true);
assert.equal(context.cashFlowIsSummaryHeader_('Yearly Total'), true);
assert.equal(context.cashFlowIsSummaryHeader_('Total'), true);
assert.equal(context.cashFlowIsSummaryHeader_('Recurring'), false);

assert.equal(context.normalizeFrequency_('Semi-monthly / twice monthly'), 'semi_monthly');
assert.equal(context.normalizeFrequency_('twice monthly'), 'semi_monthly');
assert.equal(context.normalizeFrequency_('Every two months'), 'bimonthly');
assert.equal(context.normalizeFrequency_('Bimonthly'), 'bimonthly');
assert.equal(context.debtPayoffScenarioScheduledToMonthly_(100, 'semi_monthly'), 200);
assert.equal(context.debtPayoffScenarioScheduledToMonthly_(100, 'bimonthly'), 50);

const blankFrequency = parseIncomeRows([
  ['Income', 'Salary', 'Yes', 'Yes', '', '4000']
], [
  ['Income', 'Salary', 'Yes', 'Yes', '', 4000]
]);
assert.equal(blankFrequency.cadenceUnconfirmed, true);
assert.deepEqual(Array.from(blankFrequency.incompleteRows[0].missing), ['Frequency']);

const twoIncomplete = parseIncomeRows([
  ['Income', 'Salary', 'Yes', '', 'Monthly', '4000'],
  ['Income', 'Consulting', 'Yes', 'Yes', 'Monthly', '']
], [
  ['Income', 'Salary', 'Yes', '', 'Monthly', 4000],
  ['Income', 'Consulting', 'Yes', 'Yes', 'Monthly', '']
]);
assert.equal(twoIncomplete.incompleteRows.length, 2);
assert.equal(twoIncomplete.incompleteRows[0].payee, 'Salary');
assert.equal(twoIncomplete.incompleteRows[0].sheetRow, 2);
assert.equal(twoIncomplete.incompleteRows[1].payee, 'Consulting');
assert.equal(twoIncomplete.incompleteRows[1].sheetRow, 3);
assert.deepEqual(Array.from(twoIncomplete.incompleteRows[1].missing), ['Expected Amount']);

const withheldWithRows = context.buildDebtPayoffSupportedMonthlyExtra_(Object.assign({}, baseSupported, {
  incomeCadenceUnconfirmed: true,
  incomeCadenceReason: context.debtPayoffFormatIncompleteIncomeRows_(twoIncomplete.incompleteRows),
  incomeIncompleteRows: twoIncomplete.incompleteRows,
  recurringIncomeSources: []
}));
assert.equal(withheldWithRows.available, false);
const cadenceBlocker = withheldWithRows.blockers.find(function(row) {
  return row.code === 'INCOME_CADENCE_UNCONFIRMED';
});
assert.ok(cadenceBlocker);
assert.equal(cadenceBlocker.incompleteRows.length, 2);
assert.equal(cadenceBlocker.incompleteRows[0].payee, 'Salary');
assert.match(client, /Complete these active Cash Flow income groups from Income → Manage → Edit/);
assert.match(client, /row\.incompleteRows/);
assert.match(client, /incomeRow\.rawPayees/);

const forecastHeaderMap = {
  recurringColZero: afterAppend.indexOf('Recurring'),
  frequencyColZero: afterAppend.indexOf('Frequency'),
  expectedAmountColZero: afterAppend.indexOf('Expected Amount')
};
const existingRow = populatedMonthValues.concat(['', '', '']);
const editedRow = context.applyIncomeForecastFieldsToRow_(existingRow, forecastHeaderMap, {
  recurring: 'Yes',
  frequency: 'Every two months',
  expectedKnown: true,
  expectedAmount: 2500
});
assert.equal(editedRow[4], 5000);
assert.equal(editedRow[5], 0);
assert.equal(editedRow[populatedHeaders.indexOf('Notes')], 'keep me');
assert.equal(editedRow[forecastHeaderMap.recurringColZero], 'Yes');
assert.equal(editedRow[forecastHeaderMap.frequencyColZero], 'Every two months');
assert.equal(editedRow[forecastHeaderMap.expectedAmountColZero], 2500);
assert.notEqual(existingRow[forecastHeaderMap.recurringColZero], 'Yes');

const incomeEditWriter = sliceFunction(incomeSources, 'updateIncomeForecastFieldsFromDashboard');
assert.doesNotMatch(incomeEditWriter, /insertCashFlowRow_|getMonthColumnByDate_|setCashFlowMoneyCellPreserveRowFormat_/);
assert.match(incomeEditWriter, /applyIncomeForecastFieldsToRow_/);
assert.match(incomeEditWriter, /validateIncomeLifecycleReference_/);
assert.match(incomeClient, /function openIncomeEditForm_/);
assert.match(incomeClient, /updateIncomeForecastFieldsFromDashboard/);
assert.match(incomeClient, /function submitIncomeForm_/);
const incomeFreqSelect = body.slice(
  body.indexOf('id="income_add_frequency"'),
  body.indexOf('id="income_add_expected"')
);
assert.match(incomeFreqSelect, /Semi-monthly \/ twice monthly/);
assert.match(incomeFreqSelect, /Every two months/);
assert.doesNotMatch(incomeFreqSelect, />Bimonthly</);
assert.match(body, /Biweekly is 26 times a year \(amount × 26 ÷ 12\)/);
assert.match(body, /Semi-monthly \/ twice monthly is 24 times a year \(amount × 24 ÷ 12\)/);
assert.match(body, /Historical avg is separate and is never used as Expected amount/);
assert.match(incomeClient, /Historical avg is not used as Expected Amount/);
assert.match(incomeClient, /Never prefill Expected Amount from the historical average/);
assert.doesNotMatch(
  sliceFunction(incomeClient, 'openIncomeEditForm_'),
  /avgNonZero|src\.amount\b/
);
assert.match(incomeClient, /expectedKnown === true && src.expectedAmount != null/);
assert.match(help, /Biweekly is 26 times a year/);
assert.match(help, /Semi-monthly \/ twice monthly is 24 times a year/);
assert.match(projection, /Multiple Cash Flow history rows in the same group are not multiplied/);

const ciscoPaycheck = 3200;
const ciscoMonthlyOnce = context.debtPayoffScenarioScheduledToMonthly_(ciscoPaycheck, 'biweekly');
assert.equal(ciscoMonthlyOnce, 6933.33);
assert.notEqual(context.round2_(ciscoPaycheck * 3 * 26 / 12), ciscoMonthlyOnce);

const ciscoGrouped = parseIncomeRows([
  ['Income', 'Cisco Pay 1', 'Yes', 'Yes', 'Biweekly', '3200'],
  ['Income', 'Cisco Pay 2', 'Yes', 'Yes', 'Biweekly', '3200'],
  ['Income', 'Cisco Pay 3', 'Yes', 'Yes', 'Biweekly', '3200']
], [
  ['Income', 'Cisco Pay 1', 'Yes', 'Yes', 'Biweekly', 3200],
  ['Income', 'Cisco Pay 2', 'Yes', 'Yes', 'Biweekly', 3200],
  ['Income', 'Cisco Pay 3', 'Yes', 'Yes', 'Biweekly', 3200]
]);
assert.equal(ciscoGrouped.cadenceUnconfirmed, false);
assert.equal(ciscoGrouped.sources.length, 1, 'Cisco Pay 1/2/3 must be one forecast source');
assert.equal(ciscoGrouped.sources[0].name, 'Cisco Salary');
assert.equal(ciscoGrouped.sources[0].expectedAmount, ciscoPaycheck);
assert.equal(ciscoGrouped.sources[0].frequency, 'biweekly');
assert.equal(ciscoGrouped.sources[0].historyRowCount, 3);
assert.deepEqual(
  Array.from(ciscoGrouped.sources[0].rawPayees),
  ['Cisco Pay 1', 'Cisco Pay 2', 'Cisco Pay 3']
);
const ciscoClassified = context.debtPayoffClassifySupportedIncomeSource_(ciscoGrouped.sources[0]);
assert.equal(ciscoClassified.monthlyAmount, ciscoMonthlyOnce);
assert.notEqual(ciscoClassified.monthlyAmount, 20800);
assert.notEqual(ciscoClassified.monthlyAmount, context.round2_(ciscoPaycheck * 3 * 26 / 12));

const oakleyRent = 4500;
const oakleyGrouped = parseIncomeRows([
  ['Income', 'Rent Oakley House - Section 8', 'Yes', 'Yes', 'Monthly', '4500'],
  ['Income', 'Rent Oakley House - Tenant Part 1', 'Yes', 'Yes', 'Monthly', '4500'],
  ['Income', 'Rent Oakley House - Tenant Part 2', 'Yes', 'Yes', 'Monthly', '4500'],
  ['Income', 'Rent Oakley House - Tenant Part 3', 'Yes', 'Yes', 'Monthly', '4500']
], [
  ['Income', 'Rent Oakley House - Section 8', 'Yes', 'Yes', 'Monthly', 4500],
  ['Income', 'Rent Oakley House - Tenant Part 1', 'Yes', 'Yes', 'Monthly', 4500],
  ['Income', 'Rent Oakley House - Tenant Part 2', 'Yes', 'Yes', 'Monthly', 4500],
  ['Income', 'Rent Oakley House - Tenant Part 3', 'Yes', 'Yes', 'Monthly', 4500]
]);
assert.equal(oakleyGrouped.sources.length, 1, 'Oakley payer rows must be one forecast source');
assert.equal(oakleyGrouped.sources[0].name, 'Rent Oakley House');
assert.equal(oakleyGrouped.sources[0].expectedAmount, oakleyRent);
assert.equal(oakleyGrouped.sources[0].frequency, 'monthly');
assert.equal(oakleyGrouped.sources[0].historyRowCount, 4);
const oakleyClassified = context.debtPayoffClassifySupportedIncomeSource_(oakleyGrouped.sources[0]);
assert.equal(oakleyClassified.monthlyAmount, oakleyRent);
assert.notEqual(oakleyClassified.monthlyAmount, oakleyRent * 4);

const mixedExcludedHousehold = parseIncomeRows([
  ['Income', 'Cisco Pay 1', 'Yes', 'Yes', 'Biweekly', '3200'],
  ['Income', 'Cisco Pay 2', 'Yes', 'Yes', 'Biweekly', '3200'],
  ['Income', 'Cisco Pay 3 (RSU)', 'Yes', 'Yes', 'Monthly', '2000'],
  ['Income', 'Annual Bonus', 'Yes', 'Yes', 'Yearly', '8000'],
  ['Income', 'AAPL stock sale', 'Yes', 'Yes', 'Yearly', '15000'],
  ['Income', 'One-time catch-up', 'Yes', 'Yes', 'Monthly', '900']
], [
  ['Income', 'Cisco Pay 1', 'Yes', 'Yes', 'Biweekly', 3200],
  ['Income', 'Cisco Pay 2', 'Yes', 'Yes', 'Biweekly', 3200],
  ['Income', 'Cisco Pay 3 (RSU)', 'Yes', 'Yes', 'Monthly', 2000],
  ['Income', 'Annual Bonus', 'Yes', 'Yes', 'Yearly', 8000],
  ['Income', 'AAPL stock sale', 'Yes', 'Yes', 'Yearly', 15000],
  ['Income', 'One-time catch-up', 'Yes', 'Yes', 'Monthly', 900]
]);
assert.equal(mixedExcludedHousehold.sources.length, 1);
assert.equal(mixedExcludedHousehold.sources[0].name, 'Cisco Salary');
const mixedHouseholdClassified = context.debtPayoffClassifySupportedIncomeSource_(
  mixedExcludedHousehold.sources[0]);
assert.equal(mixedHouseholdClassified.blocker.code, 'INCOME_EXCLUDED_IDENTITY_MIXED');
const mixedHouseholdEstimate = context.buildDebtPayoffSupportedMonthlyExtra_(Object.assign({}, baseSupported, {
  recurringIncomeSources: mixedExcludedHousehold.sources
}));
assert.equal(mixedHouseholdEstimate.available, false);
assert.equal(mixedHouseholdEstimate.blockers.some(function(row) {
  return row.code === 'INCOME_EXCLUDED_IDENTITY_MIXED';
}), true);

const ciscoConflict = parseIncomeRows([
  ['Income', 'Cisco Pay 1', 'Yes', 'Yes', 'Biweekly', '3200'],
  ['Income', 'Cisco Pay 2', 'Yes', 'Yes', 'Biweekly', '4100']
], [
  ['Income', 'Cisco Pay 1', 'Yes', 'Yes', 'Biweekly', 3200],
  ['Income', 'Cisco Pay 2', 'Yes', 'Yes', 'Biweekly', 4100]
]);
assert.equal(ciscoConflict.cadenceUnconfirmed, true);
assert.equal(ciscoConflict.sources.length, 0);
assert.equal(ciscoConflict.incompleteRows[0].payee, 'Cisco Salary');
assert.match(String(ciscoConflict.reason), /matching Recurring, Frequency, and Expected Amount/);

const groupedIncomeEstimate = context.buildDebtPayoffSupportedMonthlyExtra_(Object.assign({}, baseSupported, {
  recurringIncomeSources: ciscoGrouped.sources.concat(oakleyGrouped.sources)
}));
assert.equal(groupedIncomeEstimate.available, true);
assert.equal(groupedIncomeEstimate.components.recurringIncomeMonthly, context.round2_(ciscoMonthlyOnce + oakleyRent));
assert.notEqual(
  groupedIncomeEstimate.components.recurringIncomeMonthly,
  context.round2_(ciscoPaycheck * 3 * 26 / 12 + oakleyRent * 4)
);

const ciscoHistoryHeaders = [
  'Type', 'Flow Source', 'Payee', 'Active',
  'Jan-26', 'Feb-26', 'Mar-26', 'Apr-26', 'May-26', 'Jun-26',
  'Jul-26', 'Aug-26', 'Sep-26', 'Oct-26', 'Nov-26', 'Dec-26',
  'Totals', 'Yearly Total', 'Recurring', 'Frequency', 'Expected Amount'
];
function ciscoHistoryRow(payee, jan, mar, totalFormula, yearlyFormula) {
  return [
    'Income', 'CASH', payee, 'YES',
    jan, 0, mar, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    totalFormula, yearlyFormula, '', '', ''
  ];
}
const ciscoHistoryGrid = [
  ciscoHistoryHeaders,
  ciscoHistoryRow('Cisco Pay 1', 3187.42, 3187.42, '=SUM(E2:P2)', '=Q2'),
  ciscoHistoryRow('Cisco Pay 2', 412.11, 0, '=SUM(E3:P3)', '=Q3'),
  ciscoHistoryRow('Cisco Pay 3', 0, 890.55, '=SUM(E4:P4)', '=Q4')
];
const ciscoForecastMap = {
  recurringColZero: ciscoHistoryHeaders.indexOf('Recurring'),
  frequencyColZero: ciscoHistoryHeaders.indexOf('Frequency'),
  expectedAmountColZero: ciscoHistoryHeaders.indexOf('Expected Amount')
};
const forecastFields = {
  recurring: 'Yes',
  frequency: 'Biweekly',
  expectedKnown: true,
  expectedAmount: ciscoPaycheck
};
const editedCiscoGrid = [ciscoHistoryGrid[0]].concat(ciscoHistoryGrid.slice(1).map(function(row) {
  return context.applyIncomeForecastFieldsToRow_(row, ciscoForecastMap, forecastFields);
}));
editedCiscoGrid.slice(1).forEach(function(row, idx) {
  const original = ciscoHistoryGrid[idx + 1];
  assert.equal(row[2], original[2]);
  assert.equal(row[4], original[4]);
  assert.equal(row[5], original[5]);
  assert.equal(row[6], original[6]);
  assert.equal(row[16], original[16]);
  assert.equal(row[17], original[17]);
  assert.equal(row[ciscoForecastMap.recurringColZero], 'Yes');
  assert.equal(row[ciscoForecastMap.frequencyColZero], 'Biweekly');
  assert.equal(row[ciscoForecastMap.expectedAmountColZero], ciscoPaycheck);
});
const parsedAfterEdit = context.debtPayoffParseConfirmedCashFlowIncome_(editedCiscoGrid, editedCiscoGrid);
assert.equal(parsedAfterEdit.sources.length, 1);
assert.equal(parsedAfterEdit.sources[0].expectedAmount, ciscoPaycheck);
assert.equal(
  context.debtPayoffClassifySupportedIncomeSource_(parsedAfterEdit.sources[0]).monthlyAmount,
  ciscoMonthlyOnce
);

assert.equal(context.normalizeIncomeName_('Cisco Bonus'), 'Cisco Bonus');
assert.equal(context.normalizeIncomeName_('Cisco Bonus 1'), 'Cisco Bonus');
assert.equal(context.normalizeIncomeName_('Cisco Mid Year Bonus'), 'Cisco Mid Year Bonus');
assert.equal(context.normalizeIncomeName_('Cisco End Year Bonus'), 'Cisco End Year Bonus');
assert.equal(context.isCiscoBonusIncomeName_('Cisco Bonus'), true);
assert.equal(context.isCiscoBonusIncomeName_('Cisco Bonus 1'), true);
assert.equal(context.isCiscoNamedAnnualBonusIncomeName_('Cisco Mid Year Bonus'), true);
assert.equal(context.isCiscoNamedAnnualBonusIncomeName_('Cisco End Year Bonus'), true);
assert.equal(context.isLegacyCiscoBonusIncomeName_('Cisco Mid Year Bonus'), false);
assert.equal(context.isCiscoBonusIncomeName_('Cisco Pay 1'), false);
assert.equal(context.incomeIsExcludedName_('Cisco Bonus'), true);
assert.equal(context.incomeIsExcludedName_('Cisco Mid Year Bonus'), true);
assert.equal(context.incomeIsExcludedName_('Cisco End Year Bonus'), true);

const bonusHeaders = [
  'Type', 'Payee', 'Active', 'Recurring', 'Frequency', 'Expected Amount'
];
function parseBonusScenario(rows, valueRows) {
  const display = [bonusHeaders].concat(rows);
  const values = [bonusHeaders].concat(valueRows || rows);
  return context.debtPayoffParseCiscoBonusScenario_(display, values);
}

const unequalBonuses = parseBonusScenario([
  ['Income', 'Cisco Mid Year Bonus', 'Yes', 'Yes', 'Yearly', '12000'],
  ['Income', 'Cisco End Year Bonus', 'Yes', 'Yes', 'Yearly', '4500']
], [
  ['Income', 'Cisco Mid Year Bonus', 'Yes', 'Yes', 'Yearly', 12000],
  ['Income', 'Cisco End Year Bonus', 'Yes', 'Yes', 'Yearly', 4500]
]);
assert.equal(unequalBonuses.identityKnown, true);
assert.equal(unequalBonuses.appliedToComparison, false);
assert.equal(unequalBonuses.countedInRecurringIncomeMonthly, false);
assert.equal(unequalBonuses.countedInReserve, false);
assert.equal(unequalBonuses.payments.length, 2);
assert.equal(unequalBonuses.payments[0].name, 'Cisco Mid Year Bonus');
assert.equal(unequalBonuses.payments[0].included, true);
assert.equal(unequalBonuses.payments[0].amount, 12000);
assert.equal(unequalBonuses.payments[1].name, 'Cisco End Year Bonus');
assert.equal(unequalBonuses.payments[1].included, true);
assert.equal(unequalBonuses.payments[1].amount, 4500);
assert.notEqual(unequalBonuses.payments[0].amount, unequalBonuses.payments[1].amount);
assert.notEqual(unequalBonuses.payments[0].amount, context.round2_((12000 + 4500) / 2));
assert.notEqual(unequalBonuses.payments[0].amount, context.round2_((12000 + 4500) / 12));
assert.equal(unequalBonuses.annualizedMonthlyEquivalent, context.round2_((12000 + 4500) / 12));
assert.match(String(unequalBonuses.annualizedMonthlyEquivalentLabel), /estimate only/);
assert.match(String(unequalBonuses.annualizedMonthlyEquivalentLabel), /not cash available each month/);
assert.match(String(unequalBonuses.annualizedMonthlyEquivalentLabel), /90-day cash reserve/);
assert.match(String(unequalBonuses.comparisonConstraint), /not applied until you include them/);
assert.match(String(unequalBonuses.comparisonConstraint), /Timing is not inferred from the row name/);
assert.match(String(unequalBonuses.comparisonConstraint), /RSU\/ESPP sales/);

const blankMidYear = parseBonusScenario([
  ['Income', 'Cisco End Year Bonus', 'Yes', 'Yes', 'Yearly', '4500']
], [
  ['Income', 'Cisco End Year Bonus', 'Yes', 'Yes', 'Yearly', 4500]
]);
assert.equal(blankMidYear.payments[0].known, false);
assert.equal(blankMidYear.payments[0].included, false);
assert.equal(blankMidYear.payments[0].amount, null);
assert.equal(blankMidYear.payments[1].included, true);
assert.equal(blankMidYear.payments[1].amount, 4500);
assert.match(String(blankMidYear.reviewReasons.join(' ')), /Cisco Mid Year Bonus was not found/);

const blankAmount = parseBonusScenario([
  ['Income', 'Cisco Mid Year Bonus', 'Yes', 'Yes', 'Yearly', ''],
  ['Income', 'Cisco End Year Bonus', 'Yes', 'Yes', 'Yearly', '4500']
], [
  ['Income', 'Cisco Mid Year Bonus', 'Yes', 'Yes', 'Yearly', ''],
  ['Income', 'Cisco End Year Bonus', 'Yes', 'Yes', 'Yearly', 4500]
]);
assert.equal(blankAmount.payments[0].included, false);
assert.equal(blankAmount.payments[0].known, false);
assert.equal(blankAmount.payments[1].amount, 4500);
assert.match(String(blankAmount.reviewReasons.join(' ')), /blank \(unknown\)/);
assert.match(String(blankAmount.reviewReasons.join(' ')), /Blank was not treated as \$0/);
assert.equal(blankAmount.annualizedMonthlyEquivalent, context.round2_(4500 / 12));

const explicitZeroMidYear = parseBonusScenario([
  ['Income', 'Cisco Mid Year Bonus', 'Yes', 'Yes', 'Yearly', '0'],
  ['Income', 'Cisco End Year Bonus', 'Yes', 'Yes', 'Yearly', '4500']
], [
  ['Income', 'Cisco Mid Year Bonus', 'Yes', 'Yes', 'Yearly', 0],
  ['Income', 'Cisco End Year Bonus', 'Yes', 'Yes', 'Yearly', 4500]
]);
assert.equal(explicitZeroMidYear.payments[0].known, true);
assert.equal(explicitZeroMidYear.payments[0].included, true);
assert.equal(explicitZeroMidYear.payments[0].amount, 0);
assert.equal(explicitZeroMidYear.payments[1].amount, 4500);
assert.equal(explicitZeroMidYear.annualizedMonthlyEquivalent, context.round2_(4500 / 12));

const missingIdentity = parseBonusScenario([
  ['Income', 'Cisco Pay 1', 'Yes', 'Yes', 'Biweekly', '3200']
], [
  ['Income', 'Cisco Pay 1', 'Yes', 'Yes', 'Biweekly', 3200]
]);
assert.equal(missingIdentity.identityKnown, false);
assert.equal(missingIdentity.appliedToComparison, false);
assert.match(String(missingIdentity.reviewReasons.join(' ')), /Cisco Mid Year Bonus and Cisco End Year Bonus were not found/);

const leftoverNeedsSplit = parseBonusScenario([
  ['Income', 'Cisco Bonus', 'Yes', 'Yes', 'Yearly', '12000']
], [
  ['Income', 'Cisco Bonus', 'Yes', 'Yes', 'Yearly', 12000]
]);
assert.equal(leftoverNeedsSplit.identityKnown, true);
assert.equal(leftoverNeedsSplit.payments[0].included, false);
assert.equal(leftoverNeedsSplit.payments[1].included, false);
assert.match(String(leftoverNeedsSplit.reviewReasons.join(' ')), /Split the existing Cisco Bonus entry/);

const duplicateMidYear = parseBonusScenario([
  ['Income', 'Cisco Mid Year Bonus', 'Yes', 'Yes', 'Yearly', '12000'],
  ['Income', 'Cisco Mid Year Bonus', 'Yes', 'Yes', 'Yearly', '8000'],
  ['Income', 'Cisco End Year Bonus', 'Yes', 'Yes', 'Yearly', '4500']
], [
  ['Income', 'Cisco Mid Year Bonus', 'Yes', 'Yes', 'Yearly', 12000],
  ['Income', 'Cisco Mid Year Bonus', 'Yes', 'Yes', 'Yearly', 8000],
  ['Income', 'Cisco End Year Bonus', 'Yes', 'Yes', 'Yearly', 4500]
]);
assert.equal(duplicateMidYear.payments[0].included, false);
assert.equal(duplicateMidYear.payments[1].included, true);
assert.equal(duplicateMidYear.payments[1].amount, 4500);
assert.match(String(duplicateMidYear.reviewReasons.join(' ')), /counted twice/);

const yearlyWouldMonthly = context.debtPayoffScenarioScheduledToMonthly_(12000, 'yearly');
assert.equal(yearlyWouldMonthly, 1000);
assert.notEqual(unequalBonuses.payments[0].amount, yearlyWouldMonthly);
assert.notEqual(
  unequalBonuses.annualizedMonthlyEquivalent,
  context.round2_(ciscoMonthlyOnce + yearlyWouldMonthly)
);

const bonusWithSalaryAndRent = parseIncomeRows([
  ['Income', 'Cisco Pay 1', 'Yes', 'Yes', 'Biweekly', '3200'],
  ['Income', 'Cisco Pay 2', 'Yes', 'Yes', 'Biweekly', '3200'],
  ['Income', 'Cisco Pay 3', 'Yes', 'Yes', 'Biweekly', '3200'],
  ['Income', 'Rent Oakley House - Section 8', 'Yes', 'Yes', 'Monthly', '4500'],
  ['Income', 'Rent Oakley House - Tenant Part 1', 'Yes', 'Yes', 'Monthly', '4500'],
  ['Income', 'Cisco Mid Year Bonus', 'Yes', 'Yes', 'Yearly', '12000'],
  ['Income', 'Cisco End Year Bonus', 'Yes', 'Yes', 'Yearly', '4500'],
  ['Income', 'Annual Bonus', 'Yes', 'Yes', 'Yearly', '8000'],
  ['Income', 'AAPL stock sale', 'Yes', 'Yes', 'Yearly', '15000']
], [
  ['Income', 'Cisco Pay 1', 'Yes', 'Yes', 'Biweekly', 3200],
  ['Income', 'Cisco Pay 2', 'Yes', 'Yes', 'Biweekly', 3200],
  ['Income', 'Cisco Pay 3', 'Yes', 'Yes', 'Biweekly', 3200],
  ['Income', 'Rent Oakley House - Section 8', 'Yes', 'Yes', 'Monthly', 4500],
  ['Income', 'Rent Oakley House - Tenant Part 1', 'Yes', 'Yes', 'Monthly', 4500],
  ['Income', 'Cisco Mid Year Bonus', 'Yes', 'Yes', 'Yearly', 12000],
  ['Income', 'Cisco End Year Bonus', 'Yes', 'Yes', 'Yearly', 4500],
  ['Income', 'Annual Bonus', 'Yes', 'Yes', 'Yearly', 8000],
  ['Income', 'AAPL stock sale', 'Yes', 'Yes', 'Yearly', 15000]
]);
assert.equal(bonusWithSalaryAndRent.sources.length, 2);
assert.equal(bonusWithSalaryAndRent.sources[0].name, 'Cisco Salary');
assert.equal(bonusWithSalaryAndRent.sources[1].name, 'Rent Oakley House');
const bonusHouseholdEstimate = context.buildDebtPayoffSupportedMonthlyExtra_(Object.assign({}, baseSupported, {
  recurringIncomeSources: bonusWithSalaryAndRent.sources,
  datedBonusScenario: unequalBonuses
}));
assert.equal(bonusHouseholdEstimate.available, true);
assert.equal(
  bonusHouseholdEstimate.components.recurringIncomeMonthly,
  context.round2_(ciscoMonthlyOnce + oakleyRent)
);
assert.notEqual(
  bonusHouseholdEstimate.components.recurringIncomeMonthly,
  context.round2_(ciscoMonthlyOnce + oakleyRent + 12000 + 4500)
);
assert.notEqual(
  bonusHouseholdEstimate.components.recurringIncomeMonthly,
  context.round2_(ciscoMonthlyOnce + oakleyRent + 1000 + 375)
);
assert.notEqual(
  bonusHouseholdEstimate.components.recurringIncomeMonthly,
  context.round2_(ciscoMonthlyOnce + oakleyRent + unequalBonuses.annualizedMonthlyEquivalent)
);
assert.equal(bonusHouseholdEstimate.datedBonusScenario.appliedToComparison, false);
assert.equal(bonusHouseholdEstimate.datedBonusScenario.countedInRecurringIncomeMonthly, false);
assert.equal(bonusHouseholdEstimate.datedBonusScenario.countedInReserve, false);
assert.equal(bonusHouseholdEstimate.datedBonusScenario.payments[0].amount, 12000);
assert.equal(bonusHouseholdEstimate.datedBonusScenario.payments[1].amount, 4500);
assert.match(String(bonusHouseholdEstimate.assumptions.join(' ')), /estimate only/);
assert.match(String(bonusHouseholdEstimate.assumptions.join(' ')), /not used to satisfy the 90-day cash reserve/);

const cadenceUnconfirmedStillReviewsBonus = context.buildDebtPayoffSupportedMonthlyExtra_(Object.assign({}, baseSupported, {
  incomeCadenceUnconfirmed: true,
  incomeCadenceReason: 'Salary needs Recurring.',
  recurringIncomeSources: [],
  datedBonusScenario: blankMidYear
}));
assert.equal(cadenceUnconfirmedStillReviewsBonus.available, false);
assert.equal(cadenceUnconfirmedStillReviewsBonus.datedBonusScenario.payments[1].amount, 4500);
assert.equal(cadenceUnconfirmedStillReviewsBonus.datedBonusScenario.payments[0].included, false);

const comparisonBeforeBonus = context.compareDebtPayoffStrategies_(debts, extra, { asOfDate: asOf });
const comparisonAfterBonus = context.compareDebtPayoffStrategies_(debts, extra, { asOfDate: asOf });
assert.equal(comparisonAfterBonus.monthlyExtra, comparisonBeforeBonus.monthlyExtra);
assert.equal(comparisonAfterBonus.strategies.avalanche.totalInterest,
  comparisonBeforeBonus.strategies.avalanche.totalInterest);
assert.equal(comparisonAfterBonus.strategies.snowball.totalInterest,
  comparisonBeforeBonus.strategies.snowball.totalInterest);
assert.equal(comparisonAfterBonus.reserveModeled, false);
assert.match(String(comparisonAfterBonus.assumptions.join(' ')),
  /does not model future income, expenses, cash reserves, or changing rates/);

function cashFlowYearHeaders(year) {
  const suffix = String(year).slice(-2);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return ['Type', 'Flow Source', 'Payee', 'Active']
    .concat(months.map(function(month) { return month + '-' + suffix; }))
    .concat(['Totals', 'Yearly Total', 'Recurring', 'Frequency', 'Expected Amount']);
}
function bonusAmountsRow(headers, payee, amounts, totalFormula, yearlyFormula) {
  return headers.map(function(header, idx) {
    if (idx === 0) return 'Income';
    if (idx === 1) return 'CASH';
    if (idx === 2) return payee;
    if (idx === 3) return 'YES';
    if (Object.prototype.hasOwnProperty.call(amounts, header)) return amounts[header];
    if (/^[A-Z][a-z]{2}-\d{2}$/.test(header)) return 0;
    if (header === 'Totals') return totalFormula || '';
    if (header === 'Yearly Total') return yearlyFormula || '';
    return '';
  });
}

const trusted2026Headers = cashFlowYearHeaders(2026);
const trusted2026Grid = [
  trusted2026Headers,
  ciscoHistoryRow('Cisco Pay 1', 3187.42, 3187.42, '=SUM(E2:P2)', '=Q2'),
  bonusAmountsRow(trusted2026Headers, 'Cisco Bonus', {
    'Mar-26': 22766.25,
    'Sep-26': 56476.24
  }, '=SUM(E3:P3)', '=Q3')
];
const salaryBeforeTrusted = trusted2026Grid[1].slice();
const trustedInspect = context.inspectCiscoBonusHistorySplit_(trusted2026Grid, trusted2026Grid);
assert.equal(trustedInspect.canSplit, true);
assert.equal(trustedInspect.trustedMapping, true);
assert.equal(trustedInspect.requiresConfirmation, false);
assert.equal(trustedInspect.proposal.payments[0].header, 'Mar-26');
assert.equal(trustedInspect.proposal.payments[0].amount, 22766.25);
assert.equal(trustedInspect.proposal.payments[0].toPayee, 'Cisco Mid Year Bonus');
assert.equal(trustedInspect.proposal.payments[1].header, 'Sep-26');
assert.equal(trustedInspect.proposal.payments[1].amount, 56476.24);
assert.equal(trustedInspect.proposal.payments[1].toPayee, 'Cisco End Year Bonus');
const trustedSplit = context.applyCiscoBonusHistorySplitToGrid_(trusted2026Grid);
assert.equal(trustedSplit.ok, true);
assert.deepEqual(trustedSplit.monthlyTotalsAfter, trustedSplit.monthlyTotalsBefore);
assert.equal(trustedSplit.annualTotalAfter, trustedSplit.annualTotalBefore);
assert.deepEqual(trustedSplit.grid[1], salaryBeforeTrusted);
const trustedMid = trustedSplit.grid.find(function(row) { return row[2] === 'Cisco Mid Year Bonus'; });
const trustedEnd = trustedSplit.grid.find(function(row) { return row[2] === 'Cisco End Year Bonus'; });
assert.equal(trustedMid[trusted2026Headers.indexOf('Mar-26')], 22766.25);
assert.equal(trustedMid[trusted2026Headers.indexOf('Sep-26')], '');
assert.equal(trustedEnd[trusted2026Headers.indexOf('Mar-26')], '');
assert.equal(trustedEnd[trusted2026Headers.indexOf('Sep-26')], 56476.24);
assert.equal(trustedMid[trusted2026Headers.indexOf('Expected Amount')], '');
assert.equal(trustedEnd[trusted2026Headers.indexOf('Expected Amount')], '');
assert.equal(trustedMid[trusted2026Headers.indexOf('Recurring')], 'Yes');
assert.equal(trustedEnd[trusted2026Headers.indexOf('Frequency')], 'Yearly');
assert.equal(trustedSplit.grid[1][trusted2026Headers.indexOf('Totals')], '=SUM(E2:P2)');
assert.equal(trustedMid[trusted2026Headers.indexOf('Totals')], '=SUM(E3:P3)');

const shiftingHeaders = cashFlowYearHeaders(2027);
const shiftingGrid = [
  shiftingHeaders,
  ciscoHistoryRow('Cisco Pay 1', 3187.42, 3187.42, '=SUM(E2:P2)', '=Q2'),
  bonusAmountsRow(shiftingHeaders, 'Cisco Bonus', {
    'Feb-27': 10000,
    'Oct-27': 20000
  }, '=SUM(E3:P3)', '=Q3')
];
shiftingGrid[1][2] = 'Cisco Pay 1';
const shiftingInspect = context.inspectCiscoBonusHistorySplit_(shiftingGrid, shiftingGrid);
assert.equal(shiftingInspect.canSplit, true);
assert.equal(shiftingInspect.trustedMapping, false);
assert.equal(shiftingInspect.requiresConfirmation, true);
assert.equal(shiftingInspect.proposal.payments[0].header, 'Feb-27');
assert.equal(shiftingInspect.proposal.payments[1].header, 'Oct-27');
const shiftingUnconfirmed = context.applyCiscoBonusHistorySplitToGrid_(shiftingGrid);
assert.equal(shiftingUnconfirmed.ok, false);
assert.equal(shiftingUnconfirmed.needsConfirmation, true);
assert.equal(shiftingUnconfirmed.grid[2][2], 'Cisco Bonus');
assert.equal(shiftingUnconfirmed.grid[2][shiftingHeaders.indexOf('Feb-27')], 10000);
assert.equal(shiftingUnconfirmed.grid[2][shiftingHeaders.indexOf('Oct-27')], 20000);
const shiftingConfirmed = context.applyCiscoBonusHistorySplitToGrid_(shiftingGrid, {
  confirmProposal: true,
  proposal: shiftingInspect.proposal
});
assert.equal(shiftingConfirmed.ok, true);
assert.deepEqual(shiftingConfirmed.monthlyTotalsAfter, shiftingConfirmed.monthlyTotalsBefore);
assert.equal(shiftingConfirmed.annualTotalAfter, shiftingConfirmed.annualTotalBefore);
const shiftingMid = shiftingConfirmed.grid.find(function(row) { return row[2] === 'Cisco Mid Year Bonus'; });
const shiftingEnd = shiftingConfirmed.grid.find(function(row) { return row[2] === 'Cisco End Year Bonus'; });
assert.equal(shiftingMid[shiftingHeaders.indexOf('Feb-27')], 10000);
assert.equal(shiftingEnd[shiftingHeaders.indexOf('Oct-27')], 20000);
assert.equal(shiftingMid[shiftingHeaders.indexOf('Expected Amount')], '');
assert.equal(shiftingEnd[shiftingHeaders.indexOf('Expected Amount')], '');

const ambiguousThree = [
  trusted2026Headers,
  bonusAmountsRow(trusted2026Headers, 'Cisco Bonus', {
    'Mar-26': 22766.25,
    'Jun-26': 100,
    'Sep-26': 56476.24
  })
];
const ambiguousInspect = context.inspectCiscoBonusHistorySplit_(ambiguousThree, ambiguousThree);
assert.equal(ambiguousInspect.canSplit, false);
assert.match(String(ambiguousInspect.ambiguities.join(' ')), /Jun-26/);
const ambiguousApply = context.applyCiscoBonusHistorySplitToGrid_(ambiguousThree);
assert.equal(ambiguousApply.ok, false);
assert.equal(ambiguousApply.grid[1][2], 'Cisco Bonus');
assert.equal(ambiguousApply.grid[1][trusted2026Headers.indexOf('Mar-26')], 22766.25);
assert.equal(ambiguousApply.grid[1][trusted2026Headers.indexOf('Jun-26')], 100);
assert.equal(ambiguousApply.grid[1][trusted2026Headers.indexOf('Sep-26')], 56476.24);

const onePaymentGrid = [
  trusted2026Headers,
  bonusAmountsRow(trusted2026Headers, 'Cisco Bonus', { 'Sep-26': 56476.24 })
];
const onePaymentInspect = context.inspectCiscoBonusHistorySplit_(onePaymentGrid, onePaymentGrid);
assert.equal(onePaymentInspect.canSplit, false);
assert.match(String(onePaymentInspect.ambiguities.join(' ')), /only one recorded payment month/);

const editedBonusRow = context.applyIncomeForecastFieldsToRow_(
  bonusAmountsRow(trusted2026Headers, 'Cisco Mid Year Bonus', { 'Mar-26': 22766.25 }),
  {
    recurringColZero: trusted2026Headers.indexOf('Recurring'),
    frequencyColZero: trusted2026Headers.indexOf('Frequency'),
    expectedAmountColZero: trusted2026Headers.indexOf('Expected Amount')
  },
  {
    recurring: 'Yes',
    frequency: 'Yearly',
    expectedKnown: true,
    expectedAmount: 12000
  }
);
assert.equal(editedBonusRow[trusted2026Headers.indexOf('Mar-26')], 22766.25);
assert.equal(editedBonusRow[trusted2026Headers.indexOf('Sep-26')], 0);
assert.equal(editedBonusRow[trusted2026Headers.indexOf('Expected Amount')], 12000);
assert.equal(trusted2026Headers.indexOf('Expected Month'), -1);

const bonusPayments = unequalBonuses.payments;
const offPlan = context.resolveDebtPayoffScenarioBonusEvents_([], unequalBonuses, asOf, 600);
assert.equal(offPlan.ok, true);
assert.equal(offPlan.included, false);
assert.equal(offPlan.events.length, 0);

const omittedPlan = context.resolveDebtPayoffScenarioBonusEvents_(null, unequalBonuses, asOf, 600);
assert.equal(omittedPlan.included, false);
assert.equal(omittedPlan.events.length, 0);

const baseline = context.compareDebtPayoffStrategies_(debts, extra, { asOfDate: asOf });
const stillOff = context.compareDebtPayoffStrategies_(debts, extra, {
  asOfDate: asOf,
  bonusEvents: [],
  bonusPlan: offPlan
});
assert.equal(stillOff.strategies.minimum_only.totalInterest, baseline.strategies.minimum_only.totalInterest);
assert.equal(stillOff.strategies.avalanche.totalInterest, baseline.strategies.avalanche.totalInterest);
assert.equal(stillOff.strategies.snowball.totalInterest, baseline.strategies.snowball.totalInterest);
assert.equal(stillOff.scenarioBonuses.included, false);

const blankInclude = context.resolveDebtPayoffScenarioBonusEvents_([{
  name: 'Cisco Mid Year Bonus',
  include: true,
  month: 10,
  year: 2026,
  repeat: 'once'
}], blankAmount, asOf, 600);
assert.equal(blankInclude.ok, false);
assert.match(String(blankInclude.error), /blank \(unknown\)/);
assert.match(String(blankInclude.error), /not treated as \$0/);

const zeroPlan = context.resolveDebtPayoffScenarioBonusEvents_([{
  name: 'Cisco Mid Year Bonus',
  include: true,
  month: 10,
  year: 2026,
  repeat: 'once'
}], explicitZeroMidYear, asOf, 600);
assert.equal(zeroPlan.ok, true);
assert.equal(zeroPlan.events.length, 1);
assert.equal(zeroPlan.events[0].amount, 0);
const zeroCompare = context.compareDebtPayoffStrategies_(debts, extra, {
  asOfDate: asOf,
  bonusEvents: zeroPlan.events,
  bonusPlan: zeroPlan
});
assert.equal(zeroCompare.strategies.avalanche.totalInterest, baseline.strategies.avalanche.totalInterest);
assert.equal(zeroCompare.strategies.minimum_only.totalInterest, baseline.strategies.minimum_only.totalInterest);

const missingMonth = context.resolveDebtPayoffScenarioBonusEvents_([{
  name: 'Cisco Mid Year Bonus',
  include: true,
  month: '',
  year: 2026,
  repeat: 'once'
}], unequalBonuses, asOf, 600);
assert.equal(missingMonth.ok, false);
assert.match(String(missingMonth.error), /month and year/);
assert.match(String(missingMonth.error), /not inferred/);

const pastMonth = context.resolveDebtPayoffScenarioBonusEvents_([{
  name: 'Cisco Mid Year Bonus',
  include: true,
  month: 9,
  year: 2026,
  repeat: 'once'
}], unequalBonuses, asOf, 600);
assert.equal(pastMonth.ok, false);
assert.equal(pastMonth.events.length, 0);
assert.match(String(pastMonth.error), /forecast start month \(2026-10\)/);
assert.match(String(pastMonth.error), /not moved into a later month/);
assert.match(String(pastMonth.error), /2026-09/);

const pastAnnualNotRolled = context.resolveDebtPayoffScenarioBonusEvents_([{
  name: 'Cisco Mid Year Bonus',
  include: true,
  month: 6,
  year: 2026,
  repeat: 'annual'
}], unequalBonuses, asOf, 600);
assert.equal(pastAnnualNotRolled.ok, false);
assert.equal(pastAnnualNotRolled.events.length, 0);
assert.match(String(pastAnnualNotRolled.error), /forecast start month \(2026-10\)/);
assert.doesNotMatch(JSON.stringify(pastAnnualNotRolled.events), /2027-06/);

const currentForecastMonth = context.resolveDebtPayoffScenarioBonusEvents_([{
  name: 'Cisco End Year Bonus',
  include: true,
  month: 10,
  year: 2026,
  repeat: 'once'
}], unequalBonuses, asOf, 600);
assert.equal(currentForecastMonth.ok, true);
assert.equal(currentForecastMonth.events[0].monthIndex, 1);
assert.equal(currentForecastMonth.events[0].monthKey, '2026-10');
assert.equal(context.debtPayoffScenarioForecastStartMonthKey_(asOf), '2026-10');

const inferredName = context.resolveDebtPayoffScenarioBonusEvents_([{
  name: 'Cisco Mid Year Bonus',
  include: true,
  month: 6,
  year: 2027,
  repeat: 'once'
}], unequalBonuses, asOf, 600);
assert.equal(inferredName.ok, true);
assert.equal(inferredName.events[0].monthKey, '2027-06');
assert.notEqual(inferredName.events[0].monthKey, '2026-06',
  'Mid Year must not infer June of the current year from the row name');

const rsuExcluded = context.resolveDebtPayoffScenarioBonusEvents_([{
  name: 'RSU/ESPP',
  include: true,
  month: 10,
  year: 2026,
  repeat: 'once'
}], unequalBonuses, asOf, 600);
assert.equal(rsuExcluded.ok, false);
assert.match(String(rsuExcluded.error), /RSU\/ESPP sales/);

const taxRefundExcluded = context.resolveDebtPayoffScenarioBonusEvents_([{
  name: 'Tax refund',
  include: true,
  month: 10,
  year: 2026,
  repeat: 'once'
}], unequalBonuses, asOf, 600);
assert.equal(taxRefundExcluded.ok, false);

const stockSaleExcluded = context.resolveDebtPayoffScenarioBonusEvents_([{
  name: 'Other Stock Sales',
  include: true,
  month: 10,
  year: 2026,
  repeat: 'once'
}], unequalBonuses, asOf, 600);
assert.equal(stockSaleExcluded.ok, false);

const missingRepeat = context.resolveDebtPayoffScenarioBonusEvents_([{
  name: 'Cisco End Year Bonus',
  include: true,
  month: 12,
  year: 2026,
  repeat: ''
}], unequalBonuses, asOf, 600);
assert.equal(missingRepeat.ok, false);
assert.match(String(missingRepeat.error), /once or repeats annually/);

const oncePlan = context.resolveDebtPayoffScenarioBonusEvents_([{
  name: 'Cisco Mid Year Bonus',
  include: true,
  month: 10,
  year: 2026,
  repeat: 'once'
}], unequalBonuses, asOf, 600);
assert.equal(oncePlan.ok, true);
assert.equal(oncePlan.events.length, 1);
assert.equal(oncePlan.events[0].amount, 12000);
assert.equal(oncePlan.events[0].monthKey, '2026-10');
assert.equal(oncePlan.events[0].repeat, 'once');

const annualPlan = context.resolveDebtPayoffScenarioBonusEvents_([{
  name: 'Cisco Mid Year Bonus',
  include: true,
  month: 10,
  year: 2026,
  repeat: 'annual'
}], unequalBonuses, asOf, 36);
assert.equal(annualPlan.ok, true);
assert.equal(annualPlan.events.length, 3);
assert.equal(annualPlan.events[0].monthKey, '2026-10');
assert.equal(annualPlan.events[1].monthKey, '2027-10');
assert.equal(annualPlan.events[2].monthKey, '2028-10');
annualPlan.events.forEach(function(ev) {
  assert.equal(ev.amount, 12000);
  assert.equal(ev.amountHeldConstant, true);
});

const longDebts = [
  usableDebt('High APR Card', 25000, 24, 250),
  usableDebt('Small Balance Card', 18000, 12, 200)
];
const longBaseline = context.compareDebtPayoffStrategies_(longDebts, extra, { asOfDate: asOf });
const onceCompare = context.compareDebtPayoffStrategies_(longDebts, extra, {
  asOfDate: asOf,
  bonusEvents: oncePlan.events,
  bonusPlan: oncePlan
});
const annualCompare = context.compareDebtPayoffStrategies_(longDebts, extra, {
  asOfDate: asOf,
  bonusEvents: annualPlan.events,
  bonusPlan: annualPlan
});
assert.ok(onceCompare.strategies.avalanche.totalInterest < longBaseline.strategies.avalanche.totalInterest);
assert.ok(annualCompare.strategies.avalanche.totalInterest < onceCompare.strategies.avalanche.totalInterest);
assert.ok(onceCompare.strategies.minimum_only.totalInterest < longBaseline.strategies.minimum_only.totalInterest);
assert.equal(onceCompare.scenarioBonuses.events.length, 1);
assert.equal(annualCompare.scenarioBonuses.events.length, 3);
assert.equal(longBaseline.baselineLabel, 'Minimum payments only');
assert.equal(
  onceCompare.baselineLabel,
  'Minimum contractual payments plus selected bonus events (highest APR first)'
);
assert.notEqual(onceCompare.baselineLabel, 'Minimum payments only');
assert.ok(onceCompare.strategies.avalanche.totalInterest <=
  onceCompare.strategies.minimum_only.totalInterest);
assert.equal(onceCompare.strategies.minimum_only.bonusAllocationRule, 'avalanche');
assert.equal(onceCompare.strategies.avalanche.bonusAllocationRule, 'avalanche');
assert.equal(onceCompare.strategies.snowball.bonusAllocationRule, 'snowball');
assert.equal(
  onceCompare.strategies.avalanche.interestSavedVsMinimumOnly,
  context.round2_(
    onceCompare.strategies.minimum_only.totalInterest -
    onceCompare.strategies.avalanche.totalInterest
  )
);
assert.equal(
  onceCompare.strategies.snowball.interestSavedVsMinimumOnly,
  context.round2_(
    onceCompare.strategies.minimum_only.totalInterest -
    onceCompare.strategies.snowball.totalInterest
  )
);
assert.match(String(onceCompare.assumptions.join(' ')),
  /minimum contractual payments plus the selected bonus events/);
assert.match(String(onceCompare.assumptions.join(' ')), /highest APR first/);
assert.match(String(onceCompare.assumptions.join(' ')),
  /Interest savings are measured against this baseline/);
assert.match(String(onceCompare.assumptions.join(' ')),
  /Snowball applies monthly extra and bonus payments smallest balance first/);
assert.match(String(onceCompare.assumptions.join(' ')), /after interest and contractual minimums/);
assert.match(String(onceCompare.assumptions.join(' ')), /held constant as a scenario assumption/);

['minimum_only', 'avalanche', 'snowball'].forEach(function(key) {
  assert.equal(onceCompare.strategies[key].monthlyExtra, key === 'minimum_only' ? 0 : extra);
  assert.ok(onceCompare.strategies[key].totalInterest < longBaseline.strategies[key].totalInterest);
});
assert.equal(onceCompare.scenarioBonuses.included, true);
assert.deepEqual(
  Array.from(onceCompare.scenarioBonuses.events).map(function(ev) { return ev.monthKey + '|' + ev.amount; }),
  ['2026-10|12000']
);

const targetingDebts = [
  usableDebt('High APR Card', 5000, 24, 200),
  usableDebt('Small Balance Card', 800, 6, 50)
];
const targetingBonus = [{
  name: 'Cisco Mid Year Bonus',
  amount: 300,
  monthIndex: 1,
  monthKey: '2026-10',
  repeat: 'once'
}];
const targeting = context.compareDebtPayoffStrategies_(targetingDebts, 0, {
  asOfDate: asOf,
  bonusEvents: targetingBonus
});
const avBonus = targeting.strategies.avalanche.bonusApplications[0];
const snBonus = targeting.strategies.snowball.bonusApplications[0];
const baseBonus = targeting.strategies.minimum_only.bonusApplications[0];
assert.ok(avBonus && snBonus && baseBonus, 'each strategy must record the selected bonus application');
assert.equal(avBonus.monthKey, '2026-10');
assert.equal(snBonus.monthKey, avBonus.monthKey);
assert.equal(baseBonus.monthKey, avBonus.monthKey);
assert.equal(avBonus.amount, 300);
assert.equal(snBonus.amount, avBonus.amount);
assert.equal(baseBonus.amount, avBonus.amount);
assert.equal(avBonus.firstTarget, 'High APR Card');
assert.equal(snBonus.firstTarget, 'Small Balance Card');
assert.notEqual(avBonus.firstTarget, snBonus.firstTarget,
  'avalanche and snowball must send the same bonus to different debts');
assert.equal(baseBonus.firstTarget, 'High APR Card',
  'baseline bonus allocation is highest APR first');
assert.deepEqual(
  Array.from(targeting.scenarioBonuses.events).map(function(ev) {
    return ev.name + '|' + ev.monthKey + '|' + ev.amount;
  }),
  ['Cisco Mid Year Bonus|2026-10|300']
);
assert.equal(targeting.strategies.avalanche.bonusApplications.length,
  targeting.strategies.snowball.bonusApplications.length);
assert.equal(targeting.asOfMonthKey, '2026-10');
assert.equal(targeting.strategies.minimum_only.monthlyExtra, 0);
assert.equal(targeting.strategies.avalanche.monthlyExtra, 0);
assert.equal(targeting.strategies.snowball.monthlyExtra, 0);
assert.equal(
  targeting.strategies.avalanche.totalInterest,
  targeting.strategies.minimum_only.totalInterest,
  'with $0 extra, avalanche and baseline share highest-APR bonus routing and must match interest'
);
assert.ok(targeting.strategies.snowball.totalInterest >
  targeting.strategies.minimum_only.totalInterest,
  'snowball routing the bonus to the lower-APR debt must accrue more interest than the baseline');
const snowballVsBaseline = context.round2_(
  targeting.strategies.minimum_only.totalInterest -
  targeting.strategies.snowball.totalInterest
);
assert.ok(snowballVsBaseline < 0);
assert.equal(targeting.strategies.snowball.interestSavedVsMinimumOnly, snowballVsBaseline);
assert.notEqual(targeting.strategies.snowball.interestSavedVsMinimumOnly, 0);
assert.match(
  String(targeting.strategies.snowball.interestVsBaselineLabel),
  /more interest than baseline/
);
assert.doesNotMatch(
  String(targeting.strategies.snowball.interestVsBaselineLabel),
  /\$0(?:\.00)? saved|Same interest as baseline/
);
assert.equal(
  targeting.strategies.snowball.interestVsBaselineLabel,
  context.formatDebtPayoffInterestVsBaseline_({
    interestSavedVsMinimumOnly: snowballVsBaseline
  })
);
assert.equal(
  targeting.strategies.minimum_only.interestVsBaselineLabel,
  'Same interest as baseline.'
);
assert.equal(
  targeting.strategies.avalanche.interestVsBaselineLabel,
  'Same interest as baseline.'
);
assert.equal(
  targeting.strategies.avalanche.interestSavedVsMinimumOnly,
  context.round2_(
    targeting.strategies.minimum_only.totalInterest -
    targeting.strategies.avalanche.totalInterest
  )
);

const bothPlan = context.resolveDebtPayoffScenarioBonusEvents_([
  {
    name: 'Cisco Mid Year Bonus',
    include: true,
    month: 10,
    year: 2026,
    repeat: 'once'
  },
  {
    name: 'Cisco End Year Bonus',
    include: true,
    month: 12,
    year: 2026,
    repeat: 'once'
  }
], unequalBonuses, asOf, 600);
assert.equal(bothPlan.events.length, 2);
const bothCompare = context.compareDebtPayoffStrategies_(longDebts, extra, {
  asOfDate: asOf,
  bonusEvents: bothPlan.events,
  bonusPlan: bothPlan
});
assert.ok(bothCompare.strategies.minimum_only.totalInterest <= onceCompare.strategies.minimum_only.totalInterest);
assert.ok(bothCompare.strategies.avalanche.totalInterest <= onceCompare.strategies.avalanche.totalInterest);
assert.ok(bothCompare.strategies.snowball.totalInterest <= onceCompare.strategies.snowball.totalInterest);

const earlyPlan = context.resolveDebtPayoffScenarioBonusEvents_([{
  name: 'Cisco End Year Bonus',
  include: true,
  month: 10,
  year: 2026,
  repeat: 'once'
}], unequalBonuses, asOf, 600);
const latePlan = context.resolveDebtPayoffScenarioBonusEvents_([{
  name: 'Cisco End Year Bonus',
  include: true,
  month: 10,
  year: 2027,
  repeat: 'once'
}], unequalBonuses, asOf, 600);
const earlyCompare = context.compareDebtPayoffStrategies_(longDebts, extra, {
  asOfDate: asOf,
  bonusEvents: earlyPlan.events,
  bonusPlan: earlyPlan
});
const lateCompare = context.compareDebtPayoffStrategies_(longDebts, extra, {
  asOfDate: asOf,
  bonusEvents: latePlan.events,
  bonusPlan: latePlan
});
assert.ok(earlyCompare.strategies.avalanche.totalInterest < lateCompare.strategies.avalanche.totalInterest,
  'an earlier bonus event must reduce modeled interest versus a later event of the same amount');
assert.ok(earlyCompare.strategies.minimum_only.totalInterest < lateCompare.strategies.minimum_only.totalInterest);
assert.ok(earlyCompare.strategies.snowball.totalInterest < lateCompare.strategies.snowball.totalInterest);

assert.throws(function() {
  context.compareDebtPayoffStrategies_(longDebts, extra, {
    asOfDate: asOf,
    bonusEvents: [{
      name: 'Cisco Mid Year Bonus',
      amount: 12000,
      monthIndex: 0,
      monthKey: '2026-09',
      repeat: 'once'
    }]
  });
}, /before the forecast start month \(2026-10\)/);

const skippedPastSim = context.simulateDebtPayoffSchedule_(
  longDebts, extra, 'avalanche', {
    asOfDate: asOf,
    bonusEvents: [{ name: 'Cisco Mid Year Bonus', amount: 12000, monthIndex: 0 }]
  });
const noBonusSim = context.simulateDebtPayoffSchedule_(
  longDebts, extra, 'avalanche', { asOfDate: asOf, bonusEvents: [] });
assert.equal(skippedPastSim.totalInterest, noBonusSim.totalInterest,
  'a bonus before forecast start must not be applied in month 1 or any other month');

const clientBonusContext = vm.createContext({
  Date,
  Math,
  Number,
  String,
  Array,
  Object,
  JSON,
  isFinite,
  fmtCurrency: function(value) {
    const num = Number(value);
    if (!isFinite(num)) return '—';
    const sign = num < 0 ? '-' : '';
    return sign + '$' + Math.abs(num).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }
});
vm.runInContext(
  sliceFunction(client, 'collectDebtPayoffScenarioBonusSelections_') +
  '\n' + sliceFunction(client, 'debtPayoffScenarioForecastStartMonthKey_') +
  '\n' + sliceFunction(client, 'validateDebtPayoffScenarioBonusSelections_') +
  '\n' + sliceFunction(client, 'debtPayoffStrategyTitle_') +
  '\n' + sliceFunction(client, 'formatDebtPayoffInterestVsBaseline_'),
  clientBonusContext
);
assert.equal(clientBonusContext.validateDebtPayoffScenarioBonusSelections_([{
  name: 'Cisco Mid Year Bonus', include: true, month: '', year: '2026', repeat: 'once'
}], asOf).ok, false);
assert.equal(clientBonusContext.validateDebtPayoffScenarioBonusSelections_([{
  name: 'Cisco Mid Year Bonus', include: false, month: '', year: '', repeat: 'once'
}], asOf).ok, true);
assert.equal(clientBonusContext.validateDebtPayoffScenarioBonusSelections_([{
  name: 'Cisco Mid Year Bonus', include: true, month: '10', year: '2026', repeat: 'once'
}], asOf).ok, true);
const clientPast = clientBonusContext.validateDebtPayoffScenarioBonusSelections_([{
  name: 'Cisco Mid Year Bonus', include: true, month: '9', year: '2026', repeat: 'once'
}], asOf);
assert.equal(clientPast.ok, false);
assert.match(String(clientPast.error), /forecast start month \(2026-10\)/);
assert.match(String(clientPast.error), /not moved into a later month/);
assert.equal(
  clientBonusContext.debtPayoffStrategyTitle_('minimum_only', { baselineLabel: 'Minimum payments only' }),
  'Minimum payments only'
);
assert.equal(
  clientBonusContext.debtPayoffStrategyTitle_('minimum_only', {
    baselineLabel: 'Minimum contractual payments plus selected bonus events (highest APR first)'
  }),
  'Minimum contractual payments plus selected bonus events (highest APR first)'
);
assert.notEqual(
  clientBonusContext.debtPayoffStrategyTitle_('minimum_only', {
    baselineLabel: 'Minimum contractual payments plus selected bonus events (highest APR first)'
  }),
  'Minimum payments only'
);
assert.equal(
  clientBonusContext.formatDebtPayoffInterestVsBaseline_({ interestSavedVsMinimumOnly: 12.5 }),
  '$12.50 less interest than baseline.'
);
assert.equal(
  clientBonusContext.formatDebtPayoffInterestVsBaseline_({ interestSavedVsMinimumOnly: -8.25 }),
  '$8.25 more interest than baseline.'
);
assert.equal(
  clientBonusContext.formatDebtPayoffInterestVsBaseline_({ interestSavedVsMinimumOnly: 0 }),
  'Same interest as baseline.'
);
assert.match(
  clientBonusContext.formatDebtPayoffInterestVsBaseline_({
    interestSavedVsMinimumOnly: targeting.strategies.snowball.interestSavedVsMinimumOnly
  }),
  /more interest than baseline/
);
assert.doesNotMatch(
  clientBonusContext.formatDebtPayoffInterestVsBaseline_({
    interestSavedVsMinimumOnly: targeting.strategies.snowball.interestSavedVsMinimumOnly
  }),
  /\$0(?:\.00)? saved|Same interest as baseline/
);

console.log('checkDebtPayoffStrategyComparisonRegressions: ok');
