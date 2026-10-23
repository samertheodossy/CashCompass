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
  /id="debt_payoff_strategy_wrap"[\s\S]*?This month’s extra-payoff recommendation/,
  'the monthly recommendation belongs inside Debt Overview');
assert.doesNotMatch(debtOverview, /Household strategy comparison/);
assert.match(debtOverview,
  /related-view-nav[\s\S]*id="debt_payoff_strategy_wrap"[\s\S]*id="debt_payoff_recommendation"[\s\S]*Debt position and payoff estimates[\s\S]*id="debt_payoff_read_summary"[\s\S]*id="debt_payoff_read_chart_wrap"[\s\S]*id="debt_payoff_read_table_wrap"/,
  'the monthly recommendation must appear before the debt chart and account table');
assert.match(debtOverview,
  /<details class="debt-payoff-details debt-payoff-position">[\s\S]*<summary>Debt position and payoff estimates<\/summary>/);
assert.doesNotMatch(debtOverview, /debt-payoff-position[^>]*\sopen/);
assert.match(debtOverview,
  /id="debt_payoff_read_chart_wrap"[\s\S]*id="debt_payoff_read_table_wrap"/);
assert.match(debtOverview,
  /prove the extra amount is affordable/,
  'the extra amount must be labeled not affordable');
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
assert.doesNotMatch(comparisonSource, /getCapitalAllocation|getRollingDebtPayoffPlan/);
assert.doesNotMatch(comparisonSource, /should_draw_from_heloc|max_heloc_draw|heloc_recommended_now/);
assert.match(comparisonSource, /HELOC extra is not included/);
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
assert.match(comparisonSource, /DEBT_PAYOFF_CASH_SAFETY_HORIZON_MONTHS_ = 3/);
assert.match(comparisonSource, /3-month cash-safety forecast/);
assert.match(comparisonSource, /function evaluateDebtPayoffFutureCashSafety_/);
assert.match(comparisonSource, /function readDebtPayoffUpcomingObligations_/);
assert.doesNotMatch(sliceFunction(projection, 'readDebtPayoffUpcomingObligations_'),
  /getOrCreateUpcomingExpensesSheet_|setValue\(|appendRow\(|insertSheet/);
assert.doesNotMatch(sliceFunction(projection, 'evaluateDebtPayoffFutureCashSafety_'),
  /pendingImport|PENDING_IMPORT|buildCapitalAllocationPlan_/);
assert.doesNotMatch(sliceFunction(projection, 'buildDebtPayoffSupportedMonthlyExtra_'),
  /pendingImport|PENDING_IMPORT|buildCapitalAllocationPlan_/);
assert.doesNotMatch(capital, /evaluateDebtPayoffFutureCashSafety_|readDebtPayoffUpcomingObligations_/);
assert.doesNotMatch(rolling, /evaluateDebtPayoffFutureCashSafety_|readDebtPayoffUpcomingObligations_/);
assert.match(help, /3-month cash-safety forecast/);
assert.match(help, /Cash Flow → Upcoming/);
assert.match(help, /counted once/);
assert.match(help, /outside this check/);
assert.match(help, /one-time extra from cash above the protected reserve/);
assert.match(help, /12-month month-by-month projection/);
assert.match(help, /no lump is labeled safe/);
assert.match(help, /monthly gap to break even/);
assert.match(help, /cannot identify a safe reduction from the saved facts/);
assert.match(help, /Extra debt payments remain \$0\.00 until recurring commitments are covered/);
assert.match(help, /Above reserve at month 3 — not safe to spend/);
assert.match(help, /not available to spend/);
assert.match(help, /continuing monthly deficit is shown as a currency amount/);
assert.doesNotMatch(help, /Projected cash above reserve is not labeled or colored as spendable/);
assert.match(help, /limited to three months/);
assert.match(help, /CASH_YIELD_DATA_REQUIRED/);
assert.doesNotMatch(help, /One-time use of cash above the reserve is not evaluated here/);
assert.doesNotMatch(help, /not recommended as a one-time extra payment/);
assert.doesNotMatch(client, /not recommended as a one-time extra payment/);
assert.doesNotMatch(client, /No recurring extra to compare/);
assert.match(client, /function renderDebtPayoffOneTimeAllocationHtml_/);
assert.doesNotMatch(client, /One-time use of cash above the reserve is not evaluated here/);
assert.match(projection, /function buildDebtPayoffOneTimeAllocation_/);
assert.match(projection, /function debtPayoffMaxOneTimePreservingReserve_/);
assert.match(projection, /function evaluateDebtPayoffOneTimeHorizon_/);
assert.match(projection, /function buildDebtPayoffBreakEvenExplanation_/);
assert.match(client, /function renderDebtPayoffBreakEvenHtml_/);
assert.match(sliceFunction(client, 'renderDebtPayoffMonthlyRecommendation_'),
  /renderDebtPayoffBreakEvenHtml_/);
assert.doesNotMatch(sliceFunction(client, 'renderDebtPayoffBreakEvenHtml_'),
  /optional|adjustable|safe to reduce/i);
assert.doesNotMatch(sliceFunction(projection, 'buildDebtPayoffBreakEvenExplanation_'),
  /optional|adjustable|safe to reduce/i);
assert.match(projection, /DEBT_PAYOFF_ONE_TIME_HORIZON_MONTHS_ = 12/);
assert.doesNotMatch(sliceFunction(projection, 'evaluateDebtPayoffOneTimeHorizon_'),
  /bonusEvents/);
assert.match(sliceFunction(projection, 'evaluateDebtPayoffOneTimeHorizon_'),
  /Optional Cisco bonuses are not assumed/);
assert.match(projection, /function debtPayoffFormatCashSafetyCurrency_/);
assert.match(projection, /function debtPayoffCashSafetySurplusContinuation_/);
assert.match(sliceFunction(projection, 'evaluateDebtPayoffOneTimeHorizon_'),
  /debtPayoffCashSafetySurplusContinuation_/);
assert.doesNotMatch(sliceFunction(projection, 'evaluateDebtPayoffOneTimeHorizon_'),
  /when required payments and the protected reserve is due/);
assert.doesNotMatch(sliceFunction(projection, 'compareDebtPayoffStrategies_'),
  /oneTimeExtra/);
assert.doesNotMatch(capital, /buildDebtPayoffOneTimeAllocation_|debtPayoffMaxOneTimePreservingReserve_/);
assert.doesNotMatch(rolling, /buildDebtPayoffOneTimeAllocation_|debtPayoffMaxOneTimePreservingReserve_/);
assert.doesNotMatch(projection, /not recommended as a one-time extra payment/);
assert.match(client, /function renderDebtPayoffCashSafetyHtml_/);
assert.match(client, /function renderDebtPayoffCashSafetyReconciliationHtml_/);
assert.match(sliceFunction(client, 'renderDebtPayoffCalculationDetailsHtml_'),
  /renderDebtPayoffCashSafetyHtml_/);
assert.match(client, /function renderDebtPayoffNestedDetailsHtml_/);
assert.match(sliceFunction(client, 'renderDebtPayoffCalculationDetailsHtml_'),
  /Monthly income and commitments/);
assert.match(sliceFunction(client, 'renderDebtPayoffCalculationDetailsHtml_'),
  /Upcoming expenses/);
assert.match(sliceFunction(client, 'renderDebtPayoffCalculationDetailsHtml_'),
  /Variable bills/);
assert.doesNotMatch(sliceFunction(client, 'renderDebtPayoffNestedDetailsHtml_'),
  /\sopen/);
assert.doesNotMatch(sliceFunction(client, 'renderDebtPayoffCalculationDetailsHtml_'),
  /The cash-safety check covers three months/);
assert.doesNotMatch(sliceFunction(client, 'renderDebtPayoffCalculationDetailsHtml_'),
  /not a payment and is not saved/);
assert.match(sliceFunction(client, 'renderDebtPayoffCashSafetyHtml_'),
  /Outside this 3-month check/);
assert.doesNotMatch(sliceFunction(client, 'renderDebtPayoffCashSafetyHtml_'),
  /<strong>Horizon:<\/strong>/);
assert.match(client, /function renderDebtPayoffCashSafetySummaryHtml_/);
assert.match(sliceFunction(client, 'renderDebtPayoffCashSafetySummaryHtml_'),
  /Projected cash after three months/);
assert.match(sliceFunction(client, 'renderDebtPayoffCashSafetySummaryHtml_'),
  /Above reserve at month 3 — not safe to spend/);
assert.doesNotMatch(sliceFunction(client, 'renderDebtPayoffCashSafetySummaryHtml_'),
  /Projected cash above reserve/);
assert.match(sliceFunction(client, 'renderDebtPayoffOneTimeAllocationHtml_'),
  /required payments and the protected reserve/);
assert.match(sliceFunction(client, 'renderDebtPayoffCashSafetySummaryHtml_'),
  /debt-payoff-cash-summary-item[\s\S]*debt-payoff-summary-label[\s\S]*debt-payoff-summary-value/);
assert.doesNotMatch(sliceFunction(client, 'renderDebtPayoffCashSafetySummaryHtml_'),
  /Available after the three-month check/);
assert.doesNotMatch(sliceFunction(client, 'renderDebtPayoffCashSafetySummaryHtml_'),
  /debt-payoff-tone-available/);
assert.doesNotMatch(sliceFunction(client, 'renderDebtPayoffCashSafetySummaryHtml_'),
  /Projected; one-time use is not evaluated/);
assert.doesNotMatch(sliceFunction(client, 'renderDebtPayoffCashSafetySummaryHtml_'),
  /One-time use of cash above the reserve is not evaluated here/);
assert.match(client, /debt-payoff-tone-label/);
assert.match(sliceFunction(client, 'renderDebtPayoffCashSafetyReconciliationHtml_'),
  /In canonical reserve/);
assert.match(sliceFunction(client, 'renderDebtPayoffCashSafetyReconciliationHtml_'),
  /debt-payoff-upcoming-discrepancy/);
assert.match(help, /canonical reserve[\s\S]*?upcoming expenses and property contingency/);
assert.doesNotMatch(debtOverview, /id="debt_payoff_supported_extra"/);
assert.doesNotMatch(debtOverview, /Supported monthly extra/);
assert.match(debtOverview, /id="debt_payoff_recommendation"/);
assert.match(debtOverview, /<details class="debt-payoff-details debt-payoff-what-if">/);
assert.doesNotMatch(debtOverview, /debt-payoff-what-if[^>]*\sopen/);
assert.match(debtOverview, /Optional hypothetical scenario/);
assert.match(debtOverview, /This is a separate hypothetical scenario/);
assert.match(debtOverview, /Monthly extra \(hypothetical only\)/);
assert.doesNotMatch(debtOverview, /Use this amount in a what-if/);
assert.doesNotMatch(client, /Use this amount in a what-if/);
assert.doesNotMatch(client, /function useDebtPayoffSupportedMonthlyExtra_/);
assert.doesNotMatch(client, /function renderDebtPayoffSupportedMonthlyExtra_/);
assert.match(client, /function renderDebtPayoffMonthlyRecommendation_/);
assert.match(client, /<summary>How this was calculated<\/summary>/);
assert.doesNotMatch(client, /<summary>How this amount was calculated<\/summary>/);
assert.match(help, /estimated recurring monthly extra[\s\S]*?monthly recommendation uses it when extra cash can be proven/);
assert.doesNotMatch(help, /Use this amount in a what-if/);
assert.match(help, /monthly recommendation uses the supported extra automatically/);
assert.doesNotMatch(sliceFunction(client, 'renderDebtPayoffReadData_'),
  /runDebtPayoffStrategyComparison\(\)/,
  'the monthly recommendation must not require a second Compare RPC on load');
assert.match(help, /Active recurring bills marked Varies are not forecast from Default Amount/);
assert.match(help, /YTD running average/);
assert.match(help, /January through the latest completed month this year/);
assert.match(help, /January ÷ 1, January–February ÷ 2/);
assert.match(help, /blank or missing month withholds that bill/);
assert.match(help, /annual or seasonal costs can make it swing/i);
assert.match(client, /function renderDebtPayoffVariableBillEstimatesHtml_/);
assert.match(sliceFunction(client, 'renderDebtPayoffVariableBillEstimatesHtml_'),
  /YTD window:/);
assert.doesNotMatch(sliceFunction(client, 'renderDebtPayoffVariableBillEstimatesHtml_'),
  /YTD running average for/);
assert.doesNotMatch(sliceFunction(client, 'renderDebtPayoffVariableBillEstimatesHtml_'),
  /explicit \$0 counts and a blank month withholds this bill/);
assert.match(client, /<th scope="col">Bill<\/th>/);
assert.match(client, /<th scope="col">YTD total<\/th>/);
assert.match(client, /<th scope="col">Months<\/th>/);
assert.match(client, /<th scope="col">Monthly average/);
assert.doesNotMatch(sliceFunction(client, 'renderDebtPayoffVariableBillEstimatesHtml_'),
  /rows\.forEach\([\s\S]*Annual or seasonal costs can make this average swing/,
  'the seasonal-cost explanation must not repeat on every variable-bill row');
assert.doesNotMatch(sliceFunction(client, 'renderDebtPayoffMonthlyRecommendation_'),
  /Use this amount in a what-if|useDebtPayoffSupportedMonthlyExtra_|debt-payoff-use-supported-extra|debt_payoff_scenario_extra/,
  'the monthly recommendation must not copy itself into the hypothetical scenario');
assert.match(sliceFunction(client, 'renderDebtPayoffMonthlyRecommendation_'),
  /renderDebtPayoffCalculationDetailsHtml_/);
assert.doesNotMatch(client, /<summary>View estimate details<\/summary>/);
assert.doesNotMatch(sliceFunction(client, 'renderDebtPayoffReadData_'),
  /renderDebtPayoffSupportedMonthlyExtra_/);
assert.match(sliceFunction(client, 'renderDebtPayoffReadData_'),
  /renderDebtPayoffMonthlyRecommendation_\([\s\S]*supportedMonthlyExtra/);
assert.doesNotMatch(sliceFunction(client, 'runDebtPayoffStrategyComparison'),
  /renderDebtPayoffMonthlyRecommendation_|renderDebtPayoffSupportedMonthlyExtra_/,
  'a hypothetical Compare must not overwrite this month’s recommendation');
assert.match(client, /<summary>Calculation assumptions<\/summary>/);
assert.match(client, /<summary>Payoff order and allocation<\/summary>/);
assert.match(client, /<dt>Debt-free<\/dt>/);
assert.match(client, /<dt>Total interest<\/dt>/);
assert.match(client, /<dt>vs baseline<\/dt>/);
assert.doesNotMatch(client, /function renderDebtPayoffDatedBonusScenarioHtml_/);
assert.doesNotMatch(sliceFunction(client, 'renderDebtPayoffMonthlyRecommendation_'),
  /Cisco Mid Year Bonus and Cisco End Year Bonus/);
assert.doesNotMatch(sliceFunction(client, 'renderDebtPayoffScenarioBonusForm_'),
  /annualizedMonthlyEquivalent|Annualized monthly equivalent/);
assert.doesNotMatch(sliceFunction(client, 'renderDebtPayoffStrategyComparison_'),
  /Avalanche applies monthly extra and bonus payments highest APR first/);
assert.match(debtOverview,
  /id="debt_payoff_recommendation"[\s\S]*Optional hypothetical scenario[\s\S]*id="debt_payoff_scenario_bonus_wrap"[\s\S]*id="debt_payoff_scenario_extra"[\s\S]*Compare strategies[\s\S]*id="debt_payoff_strategy_results"/,
  'Debt Overview must keep one recommendation section and a separate optional scenario');
assert.match(debtOverview, /class="debt-payoff-strategy-controls"[\s\S]*debt_payoff_scenario_extra[\s\S]*Compare strategies/);
assert.match(debtOverview, /class="debt-payoff-bonus-caveat"/);
assert.equal((debtOverview.match(/not used for the 90-day cash reserve/g) || []).length, 1,
  'the optional bonus caveat must appear once in the main flow');
assert.equal((debtOverview.match(/Optional Cisco bonus/g) || []).length, 1);
assert.doesNotMatch(debtOverview, /Annualized monthly equivalent/);
assert.match(help, /this month’s extra-payoff recommendation is at the top[\s\S]*optional hypothetical scenario/);
assert.doesNotMatch(sliceFunction(projection, 'debtPayoffParseKnownCashFlowSpend_'),
  /Math\.abs/);
assert.doesNotMatch(sliceFunction(client, 'renderDebtPayoffMonthlyRecommendation_'),
  /el\.value\s*=/);
assert.doesNotMatch(sliceFunction(projection, 'attachDebtPayoffVariableBillHistory_'),
  /setValue\(|appendRow\(|insertColumn|insertCashFlowRow_|ensureCashFlowYearSheet_/);
assert.doesNotMatch(sliceFunction(projection, 'estimateDebtPayoffVariableBillHistory_'),
  /setValue\(|appendRow\(|getRange\(/);
assert.doesNotMatch(sliceFunction(projection, 'readDebtPayoffSupportedMonthlyExtra_'),
  /setValue\(|appendRow\(|insertColumn|insertCashFlowRow_/);
assert.doesNotMatch(capital, /attachDebtPayoffVariableBillHistory_|estimateDebtPayoffVariableBillHistory_/);
assert.doesNotMatch(rolling, /attachDebtPayoffVariableBillHistory_|estimateDebtPayoffVariableBillHistory_/);
assert.match(projection,
  /function getDebtPayoffStrategyComparison\(payload\)[\s\S]*?parseDebtPayoffScenarioMonthlyExtra_\(payload\.monthlyExtra\)/);
assert.match(projection, /recommendationState: 'HYPOTHETICAL'/);
assert.match(projection, /function buildDebtPayoffMonthlyRecommendation_/);
assert.match(projection, /monthlyRecommendation: buildDebtPayoffMonthlyRecommendation_/);
assert.match(projection, /extraIsAffordable: null/);
assert.match(projection, /persisted: false/);
assert.match(projection, /reserveModeled: false/);
assert.doesNotMatch(sliceFunction(projection, 'buildDebtPayoffMonthlyRecommendation_'),
  /setValue\(|appendRow\(|PAY_EXTRA|PropertiesService|google\.script\.run/);
assert.doesNotMatch(sliceFunction(projection, 'buildDebtPayoffMonthlyRecommendation_'),
  /bonusSelections|datedBonusScenario/);
assert.match(projection, /function buildDebtPayoffNextDollarComparison_/);
assert.match(projection, /rec.nextDollar = buildDebtPayoffNextDollarComparison_/);
assert.match(projection, /extraTargetNames/);
assert.match(sliceFunction(projection, 'readDebtPayoffSavedPlanningAssumptions_'),
  /CASH_YIELD_DATA_REQUIRED/);
assert.doesNotMatch(sliceFunction(projection, 'readDebtPayoffSavedPlanningAssumptions_'),
  /getOrCreateRetirementSheet_|insertSheet|setValue\(/);
assert.doesNotMatch(sliceFunction(projection, 'buildDebtPayoffNextDollarComparison_'),
  /CAPITAL_ALLOCATION_DEFAULT_EXPECTED_INVESTMENT_RETURN_|readCapitalAllocationFacts_|buildCapitalAllocationNextDollar_/);
assert.doesNotMatch(capital, /buildDebtPayoffNextDollarComparison_|readDebtPayoffSavedPlanningAssumptions_/);
assert.doesNotMatch(rolling, /buildDebtPayoffNextDollarComparison_|readDebtPayoffSavedPlanningAssumptions_/);
assert.doesNotMatch(thisWeekClient, /buildDebtPayoffNextDollarComparison_/);
assert.match(client, /Compare other uses of this extra/);
assert.match(client, /<strong>Liquidity:<\/strong>/);
assert.match(help, /paying high-APR debt, keeping cash, extra mortgage principal, and investing/);
assert.match(help, /CASH_YIELD_DATA_REQUIRED/);
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
  '\n' + sliceFunction(dashboardData, 'normalizeBillName_') +
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
  __debtPayoffReadInFlight_: false,
  __debtPayoffReadRequestId_: 0,
  __debtPayoffStrategyRequestId_: 0,
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

assert.match(client, /function failDebtPayoffReadLoad_/);
assert.match(sliceFunction(client, 'loadDebtPayoffReadSection'),
  /requestId !== __debtPayoffReadRequestId_/);
assert.match(sliceFunction(client, 'loadDebtPayoffReadSection'),
  /failDebtPayoffReadLoad_\(wrap, err\)/);
assert.match(sliceFunction(client, 'loadDebtPayoffReadSection'),
  /Payoff data could not be loaded/);
assert.match(sliceFunction(client, 'failDebtPayoffReadLoad_'),
  /setStatus\(\s*'debt_payoff_read_status'[\s\S]*true\s*\)/);
assert.doesNotMatch(sliceFunction(client, 'failDebtPayoffReadLoad_'),
  /Loading payoff data/);
assert.match(sliceFunction(client, 'runDebtPayoffStrategyComparison'),
  /__debtPayoffReadInFlight_/);
assert.match(sliceFunction(client, 'runDebtPayoffStrategyComparison'),
  /requestId !== __debtPayoffStrategyRequestId_/);

const payoffTableWrap = { innerHTML: '' };
const payoffStatusCalls = [];
const payoffRenderCalls = [];
let payoffSuccess = null;
let payoffFailure = null;
const payoffLoadContext = vm.createContext({
  Date, Math, Number, String, Array, Object, JSON, isFinite,
  __debtPayoffReadCache: null,
  __debtPayoffReadRequestId_: 0,
  __debtPayoffStrategyRequestId_: 0,
  __debtPayoffReadInFlight_: false,
  document: {
    getElementById: function(id) {
      if (id === 'debt_payoff_read_table_wrap') return payoffTableWrap;
      if (id === 'debt_payoff_read_status') return { textContent: '', className: '' };
      if (id === 'debt_payoff_read_summary') return { innerHTML: '' };
      if (id === 'debt_payoff_read_recommendations') return { innerHTML: '' };
      if (id === 'debt_payoff_read_meta') return { textContent: '' };
      if (id === 'debt_payoff_read_filter_note') return { textContent: '' };
      if (id === 'debt_payoff_read_chart_wrap') return { innerHTML: '' };
      if (id === 'debt_payoff_strategy_results') return { innerHTML: 'comparison' };
      if (id === 'debt_payoff_recommendation') return { innerHTML: '' };
      if (id === 'debt_payoff_scenario_extra') return { value: '25' };
      return null;
    }
  },
  setStatus: function(id, message, isError) {
    payoffStatusCalls.push({ id: id, message: message, isError: isError });
  },
  loadingIndicatorHtml: function(label) { return 'LOADING:' + label; },
  renderDebtPayoffReadData_: function(data) {
    payoffRenderCalls.push(data);
    payoffTableWrap.innerHTML = 'TABLE';
  },
  google: {
    script: {
      run: {
        withSuccessHandler: function(handler) {
          payoffSuccess = handler;
          return this;
        },
        withFailureHandler: function(handler) {
          payoffFailure = handler;
          return this;
        },
        getDebtPayoffReadData: function() {}
      }
    }
  }
});
vm.runInContext(
  sliceFunction(client, 'failDebtPayoffReadLoad_') +
  '\n' + sliceFunction(client, 'loadDebtPayoffReadSection'),
  payoffLoadContext
);

payoffLoadContext.loadDebtPayoffReadSection();
assert.match(payoffTableWrap.innerHTML, /LOADING:Loading payoff data…/);
assert.equal(payoffLoadContext.__debtPayoffReadInFlight_, true);
assert.equal(typeof payoffSuccess, 'function');
assert.equal(typeof payoffFailure, 'function');

payoffFailure(new Error('offline'));
assert.equal(payoffTableWrap.innerHTML, '',
  'failure must clear the payoff loading spinner');
assert.equal(payoffLoadContext.__debtPayoffReadInFlight_, false);
assert.equal(payoffStatusCalls.some(function(row) {
  return row.id === 'debt_payoff_read_status' && row.isError === true && /offline/.test(row.message);
}), true, 'failure must report a visible error instead of hiding the spinner');
assert.equal(payoffRenderCalls.length, 0);

payoffStatusCalls.length = 0;
payoffRenderCalls.length = 0;
payoffLoadContext.loadDebtPayoffReadSection();
assert.match(payoffTableWrap.innerHTML, /LOADING:Loading payoff data…/);
payoffSuccess({ debts: [{ name: 'Card' }] });
assert.equal(payoffRenderCalls.length, 1);
assert.equal(payoffTableWrap.innerHTML, 'TABLE',
  'success must replace the loading spinner with payoff data');
assert.equal(payoffLoadContext.__debtPayoffReadInFlight_, false);
assert.equal(payoffStatusCalls.some(function(row) {
  return row.id === 'debt_payoff_read_status' && row.isError === true;
}), false);

payoffStatusCalls.length = 0;
payoffRenderCalls.length = 0;
payoffLoadContext.loadDebtPayoffReadSection();
payoffSuccess(null);
assert.equal(payoffRenderCalls.length, 0);
assert.equal(payoffTableWrap.innerHTML, '',
  'empty success must not leave Loading payoff data… on screen');
assert.equal(payoffStatusCalls.some(function(row) {
  return row.isError === true && /Payoff data could not be loaded/.test(row.message);
}), true, 'empty success must report a visible error');

payoffStatusCalls.length = 0;
payoffRenderCalls.length = 0;
payoffLoadContext.renderDebtPayoffReadData_ = function() {
  throw new Error('chart failed');
};
payoffLoadContext.loadDebtPayoffReadSection();
payoffSuccess({ debts: [{ name: 'Card' }] });
assert.equal(payoffTableWrap.innerHTML, '',
  'a thrown success handler must clear the loading spinner');
assert.equal(payoffStatusCalls.some(function(row) {
  return row.isError === true && /chart failed/.test(row.message);
}), true, 'a thrown success handler must surface the failure');

const firstReadId = payoffLoadContext.__debtPayoffReadRequestId_;
payoffStatusCalls.length = 0;
payoffRenderCalls.length = 0;
payoffLoadContext.renderDebtPayoffReadData_ = function(data) {
  payoffRenderCalls.push(data);
  payoffTableWrap.innerHTML = 'TABLE';
};
payoffLoadContext.loadDebtPayoffReadSection();
const staleSuccess = payoffSuccess;
const staleFailure = payoffFailure;
payoffLoadContext.loadDebtPayoffReadSection();
assert.ok(payoffLoadContext.__debtPayoffReadRequestId_ > firstReadId);
staleSuccess({ debts: [{ name: 'Stale' }] });
assert.equal(payoffRenderCalls.length, 0,
  'a stale payoff-data success must not paint over a newer load');
assert.match(payoffTableWrap.innerHTML, /LOADING:Loading payoff data…/);
staleFailure(new Error('stale offline'));
assert.match(payoffTableWrap.innerHTML, /LOADING:Loading payoff data…/,
  'a stale payoff-data failure must not clear a newer load');
assert.equal(payoffStatusCalls.some(function(row) {
  return row.isError === true && /stale offline/.test(row.message);
}), false);
payoffSuccess({ debts: [{ name: 'Fresh' }] });
assert.equal(payoffRenderCalls.length, 1);
assert.equal(payoffTableWrap.innerHTML, 'TABLE');

rpcPayloads = [];
statusCalls = [];
resultsEl.innerHTML = 'stale';
runContext.__debtPayoffReadInFlight_ = true;
extraInputEl.value = '50';
runContext.runDebtPayoffStrategyComparison();
assert.equal(rpcPayloads.length, 0,
  'Compare must not run a second RPC while payoff data is still loading');
assert.equal(resultsEl.innerHTML, 'stale',
  'Compare during payoff load must not replace results or hide the table spinner');
assert.equal(statusCalls.some(function(row) {
  return !row.isError && /still loading/i.test(row.message);
}), true);
runContext.__debtPayoffReadInFlight_ = false;

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

const renderRecommendation = sliceFunction(client, 'renderDebtPayoffMonthlyRecommendation_');
assert.doesNotMatch(renderRecommendation, /debt_payoff_scenario_extra/,
  'the estimate must not auto-fill the hypothetical extra field');
assert.doesNotMatch(renderRecommendation, /<button/,
  'the monthly recommendation must not offer a copy-to-scenario button');

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
  asOfDate: asOf,
  recurringIncomeSources: [confirmedIncome('Salary', 1200)]
}));
assert.equal(deficit.available, true);
assert.equal(deficit.deficit, true);
assert.equal(deficit.amount, 0);
assert.ok(deficit.cashSafety);
assert.equal(deficit.cashSafety.oneTimeAllocationEvaluated, true);
assert.equal(deficit.cashSafety.oneTimeBaselineSafe, true);
assert.equal(deficit.cashSafety.oneTimeLimitedToThreeMonths, false);
assert.ok(deficit.cashSafety.oneTimeAmount > 0);
assert.ok(deficit.cashSafety.oneTimeAmount <= deficit.cashSafety.remainingAboveReserve);
assert.ok(deficit.cashSafety.remainingAboveReserve > 0);

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

const cashSafetyAsOf = new Date(2026, 9, 16);
const safeProjection = context.buildDebtPayoffSupportedMonthlyExtra_(Object.assign({}, baseSupported, {
  asOfDate: cashSafetyAsOf,
  upcomingExpenses: [{
    name: 'Insurance',
    status: 'Planned',
    dueDate: '2026-11-15',
    dueDateKnown: true,
    amount: 200,
    amountKnown: true
  }]
}));
assert.equal(safeProjection.available, true);
assert.equal(safeProjection.amount, 2500);
assert.equal(safeProjection.futureReserveProtects, false);
assert.equal(safeProjection.cashSafety.safe, true);
assert.equal(safeProjection.cashSafety.reduced, false);
assert.equal(safeProjection.cashSafety.horizonMonths, 3);
assert.match(String(safeProjection.cashSafety.horizonLabel), /3-month cash-safety forecast/);
assert.match(String(safeProjection.cashSafety.reason), /2026-12/);

const futureReserveBreach = context.buildDebtPayoffSupportedMonthlyExtra_(Object.assign({}, baseSupported, {
  asOfDate: cashSafetyAsOf,
  upcomingExpenses: [{
    name: 'Insurance',
    status: 'Planned',
    dueDate: '2026-12-01',
    dueDateKnown: true,
    amount: 12000,
    amountKnown: true
  }]
}));
assert.equal(futureReserveBreach.available, true);
assert.equal(futureReserveBreach.amount, 0);
assert.equal(futureReserveBreach.futureReserveProtects, true);
assert.ok(futureReserveBreach.recurringSurplusBeforeReserve > 0);
assert.equal(futureReserveBreach.cashSafety.withheld, true);
assert.equal(futureReserveBreach.cashSafety.breachMonthKey, '2026-12');
assert.match(String(futureReserveBreach.cashSafety.breachObligation), /Insurance/);
assert.match(String(futureReserveBreach.cashSafety.reason), /2026-12/);
assert.match(String(futureReserveBreach.cashSafety.reason), /Insurance/);
assert.notEqual(futureReserveBreach.amount, futureReserveBreach.recurringSurplusBeforeReserve);

const upcomingExpenseSafety = context.buildDebtPayoffSupportedMonthlyExtra_(Object.assign({}, baseSupported, {
  asOfDate: cashSafetyAsOf,
  upcomingExpenses: [{
    name: 'Insurance',
    status: 'Planned',
    dueDate: '2026-12-01',
    dueDateKnown: true,
    amount: 4500,
    amountKnown: true
  }, {
    name: 'After-horizon tuition',
    status: 'Planned',
    dueDate: '2027-02-01',
    dueDateKnown: true,
    amount: 8000,
    amountKnown: true
  }]
}));
assert.equal(upcomingExpenseSafety.available, true);
assert.equal(upcomingExpenseSafety.amount, 2333.33);
assert.ok(upcomingExpenseSafety.amount < upcomingExpenseSafety.recurringSurplusBeforeReserve);
assert.equal(upcomingExpenseSafety.cashSafety.reduced, true);
assert.equal(upcomingExpenseSafety.cashSafety.breachMonthKey, '2026-12');
assert.match(String(upcomingExpenseSafety.cashSafety.reason), /Insurance \(\$4500\.00\)/);
assert.match(String(upcomingExpenseSafety.cashSafety.reason), /Outside this 3-month check: After-horizon tuition \(due 2027-02-01/);
assert.equal(upcomingExpenseSafety.cashSafety.outsideHorizon.length, 1);
assert.equal(upcomingExpenseSafety.cashSafety.outsideHorizon[0].name, 'After-horizon tuition');
assert.equal(upcomingExpenseSafety.cashSafety.extraBeforeSafety, 2500);
assert.equal(upcomingExpenseSafety.cashSafety.extraAfterSafety, 2333.33);

const noDoubleCountUpcoming = context.buildDebtPayoffSupportedMonthlyExtra_(Object.assign({}, baseSupported, {
  asOfDate: cashSafetyAsOf,
  reserveUpcomingAmount: 4500,
  upcomingExpenses: [{
    name: 'Insurance',
    status: 'Planned',
    dueDate: '2026-12-01',
    dueDateKnown: true,
    amount: 4500,
    amountKnown: true
  }]
}));
assert.equal(noDoubleCountUpcoming.available, true);
assert.equal(noDoubleCountUpcoming.amount, 2500);
assert.equal(noDoubleCountUpcoming.cashSafety.reduced, false);
assert.equal(noDoubleCountUpcoming.cashSafety.protectedReserveFloor, 0);
assert.notEqual(noDoubleCountUpcoming.amount, 2333.33,
  'upcoming already in the canonical reserve must not reduce extra again');

const invalidUpcomingDate = context.buildDebtPayoffSupportedMonthlyExtra_(Object.assign({}, baseSupported, {
  asOfDate: cashSafetyAsOf,
  upcomingExpenses: [{
    name: 'Broken date bill',
    status: 'Planned',
    dueDate: '2026-13-40',
    dueDateKnown: true,
    amount: 900,
    amountKnown: true
  }]
}));
assert.equal(invalidUpcomingDate.available, false);
assert.equal(invalidUpcomingDate.amount, null);
assert.equal(invalidUpcomingDate.blockers.some(function(row) {
  return row.code === 'UPCOMING_DATE_UNKNOWN';
}), true);
assert.match(String(invalidUpcomingDate.blockers[0].reason), /treated as \$0/);

const missingProjectionFacts = context.buildDebtPayoffSupportedMonthlyExtra_(Object.assign({}, baseSupported, {
  asOfDate: cashSafetyAsOf,
  upcomingExpenses: [{
    name: 'Insurance',
    status: 'Planned',
    dueDate: '',
    dueDateKnown: false,
    amount: null,
    amountKnown: false
  }]
}));
assert.equal(missingProjectionFacts.available, false);
assert.equal(missingProjectionFacts.amount, null);
assert.equal(missingProjectionFacts.blockers.some(function(row) {
  return row.code === 'UPCOMING_DATE_UNKNOWN';
}), true);
assert.match(String(missingProjectionFacts.blockers[0].reason), /Cash Flow → Upcoming/);
assert.doesNotMatch(JSON.stringify(missingProjectionFacts.blockers), /"amount":0/);

const missingUpcomingAmount = context.buildDebtPayoffSupportedMonthlyExtra_(Object.assign({}, baseSupported, {
  asOfDate: cashSafetyAsOf,
  upcomingExpenses: [{
    name: 'Insurance',
    status: 'Planned',
    dueDate: '2026-11-20',
    dueDateKnown: true,
    amount: null,
    amountKnown: false
  }]
}));
assert.equal(missingUpcomingAmount.available, false);
assert.equal(missingUpcomingAmount.amount, null);
assert.equal(missingUpcomingAmount.blockers.some(function(row) {
  return row.code === 'UPCOMING_AMOUNT_UNKNOWN';
}), true);
assert.match(String(missingUpcomingAmount.blockers[0].reason), /not treated as \$0/);
assert.equal(missingUpcomingAmount.cashSafety, null,
  'unknown upcoming amounts withhold extra and are not walked as $0');

const laterUnknownUpcoming = context.buildDebtPayoffSupportedMonthlyExtra_(Object.assign({}, baseSupported, {
  asOfDate: cashSafetyAsOf,
  upcomingExpenses: [{
    name: 'Future tax',
    status: 'Planned',
    dueDate: '2027-04-15',
    dueDateKnown: true,
    amount: null,
    amountKnown: false
  }]
}));
assert.equal(laterUnknownUpcoming.available, true,
  'unknown Planned amounts after month three do not withhold the monthly extra');
assert.equal(laterUnknownUpcoming.amount, 2500);
assert.equal(laterUnknownUpcoming.cashSafety.oneTimeAllocationEvaluated, false);
assert.equal(laterUnknownUpcoming.cashSafety.oneTimeAmount, null);
assert.match(String(laterUnknownUpcoming.cashSafety.oneTimeReason), /not treated as \$0/);

const pendingImportDoesNotBlock = context.buildDebtPayoffSupportedMonthlyExtra_(Object.assign({}, baseSupported, {
  asOfDate: cashSafetyAsOf,
  pendingImport: true,
  upcomingExpenses: [{
    name: 'Insurance',
    status: 'Planned',
    dueDate: '2026-11-15',
    dueDateKnown: true,
    amount: 200,
    amountKnown: true
  }]
}));
assert.equal(pendingImportDoesNotBlock.available, true);
assert.equal(pendingImportDoesNotBlock.amount, 2500);

const negativeSurplusCashAbove = context.buildDebtPayoffSupportedMonthlyExtra_(Object.assign({}, baseSupported, {
  asOfDate: cashSafetyAsOf,
  recurringIncomeSources: [confirmedIncome('Salary', 1200)],
  usableCashAfterBuffers: 110139.19,
  requiredReserveAmount: 41252.04
}));
assert.equal(negativeSurplusCashAbove.available, true);
assert.equal(negativeSurplusCashAbove.deficit, true);
assert.equal(negativeSurplusCashAbove.amount, 0);
assert.equal(negativeSurplusCashAbove.recurringSurplusBeforeReserve, -300);
assert.ok(negativeSurplusCashAbove.usableCashAfterBuffers > negativeSurplusCashAbove.requiredReserveAmount);
assert.ok(negativeSurplusCashAbove.cashSafety.remainingAboveReserve > 0);
assert.equal(negativeSurplusCashAbove.cashSafety.oneTimeAllocationEvaluated, true);
assert.equal(negativeSurplusCashAbove.cashSafety.oneTimeBaselineSafe, true);
assert.ok(negativeSurplusCashAbove.cashSafety.oneTimeAmount > 0);
assert.ok(negativeSurplusCashAbove.cashSafety.oneTimeAmount <=
  negativeSurplusCashAbove.cashSafety.remainingAboveReserve);
assert.match(String(negativeSurplusCashAbove.cashSafety.reason), /remains above that reserve/);
assert.doesNotMatch(String(negativeSurplusCashAbove.cashSafety.reason),
  /One-time use of cash above the reserve is not evaluated here/);
assert.doesNotMatch(String(negativeSurplusCashAbove.cashSafety.reason),
  /not recommended as a one-time/);
assert.doesNotMatch(String(negativeSurplusCashAbove.cashSafety.reason), /already use available cash/);

const negativeSurplusHeadroom = negativeSurplusCashAbove.cashSafety.remainingAboveReserve;
const negativeSurplusUpcomingReducesHeadroom = context.buildDebtPayoffSupportedMonthlyExtra_(Object.assign({}, baseSupported, {
  asOfDate: cashSafetyAsOf,
  recurringIncomeSources: [confirmedIncome('Salary', 1200)],
  usableCashAfterBuffers: 110139.19,
  requiredReserveAmount: 41252.04,
  upcomingExpenses: [{
    name: 'Insurance',
    status: 'Planned',
    dueDate: '2026-11-15',
    dueDateKnown: true,
    amount: 8000,
    amountKnown: true
  }]
}));
assert.equal(negativeSurplusUpcomingReducesHeadroom.amount, 0);
assert.equal(negativeSurplusUpcomingReducesHeadroom.deficit, true);
assert.ok(negativeSurplusUpcomingReducesHeadroom.cashSafety.remainingAboveReserve < negativeSurplusHeadroom);
assert.ok(negativeSurplusUpcomingReducesHeadroom.cashSafety.remainingAboveReserve > 0);
assert.equal(
  context.round2_(negativeSurplusHeadroom - negativeSurplusUpcomingReducesHeadroom.cashSafety.remainingAboveReserve),
  8000
);

const displayedUpcoming = [{
  name: 'Home insurance',
  status: 'Planned',
  dueDate: '2026-10-28',
  dueDateKnown: true,
  amount: 5000,
  amountKnown: true
}, {
  name: 'Tuition',
  status: 'Planned',
  dueDate: '2026-11-05',
  dueDateKnown: true,
  amount: 15000,
  amountKnown: true
}, {
  name: 'Property tax',
  status: 'Planned',
  dueDate: '2026-11-20',
  dueDateKnown: true,
  amount: 8000,
  amountKnown: true
}, {
  name: 'HOA special',
  status: 'Planned',
  dueDate: '2026-12-01',
  dueDateKnown: true,
  amount: 7500,
  amountKnown: true
}, {
  name: 'Medical',
  status: 'Planned',
  dueDate: '2026-12-15',
  dueDateKnown: true,
  amount: 4000,
  amountKnown: true
}];
const displayedSafety = context.evaluateDebtPayoffFutureCashSafety_({
  asOfDate: cashSafetyAsOf,
  startingCash: 110139.19,
  surplus: -11233.45,
  requiredReserve: 41252.04,
  reserveUpcomingAmount: 39446.66,
  upcomingExpenses: displayedUpcoming
});
const displayedRecon = displayedSafety.cashSafety.reconciliation;
assert.equal(displayedSafety.ok, true);
assert.equal(displayedRecon.inWindowUpcoming.length, 5);
assert.equal(displayedRecon.inWindowUpcomingTotal, 39500);
assert.equal(displayedRecon.inCanonicalReserveTotal, 39500);
assert.ok(displayedRecon.inWindowUpcoming.every(function(row) {
  return row.inCanonicalReserve === true;
}));
assert.equal(displayedRecon.discrepancy.hasDiscrepancy, true);
assert.equal(displayedRecon.discrepancy.walkVsLump, 53.34);
assert.equal(displayedRecon.discrepancy.identifiedRow, null);
assert.match(String(displayedRecon.discrepancy.label),
  /not identified as a specific Upcoming row/);
assert.doesNotMatch(String(displayedRecon.discrepancy.label), /Near-term fee/);
assert.doesNotMatch(JSON.stringify(displayedRecon.inWindowUpcoming), /53\.34/);
assert.equal(displayedRecon.startingCash, 110139.19);
assert.equal(displayedRecon.recurringSurplusMonthly, -11233.45);
assert.equal(displayedRecon.surplusApplied, -33700.35);
assert.equal(displayedRecon.endingCash, 36938.84);
assert.equal(displayedRecon.canonicalReserve, 41252.04);
assert.equal(displayedRecon.reserveUpcomingAmount, 39446.66);
assert.equal(displayedRecon.protectedReserveFloor, 1805.38);
assert.equal(displayedRecon.remainingAboveReserve, 35133.46);
assert.equal(displayedRecon.cashIdentityOk, true);
assert.equal(displayedRecon.reserveIdentityOk, true);
assert.equal(displayedRecon.remainingIdentityOk, true);
assert.equal(
  context.round2_(displayedRecon.startingCash + displayedRecon.surplusApplied -
    displayedRecon.inWindowUpcomingTotal),
  displayedRecon.endingCash
);
assert.equal(
  context.round2_(displayedRecon.canonicalReserve - displayedRecon.reserveUpcomingAmount),
  displayedRecon.protectedReserveFloor
);
assert.equal(
  context.round2_(displayedRecon.endingCash - displayedRecon.protectedReserveFloor),
  displayedRecon.remainingAboveReserve
);
assert.equal(displayedSafety.cashSafety.oneTimeAllocationEvaluated, true);
assert.equal(displayedSafety.cashSafety.oneTimeAmount, 0);
assert.equal(displayedSafety.cashSafety.oneTimeBaselineSafe, false);
assert.equal(displayedSafety.cashSafety.oneTimeBaselineBreachMonthKey, '2027-04');
assert.equal(displayedSafety.cashSafety.oneTimeThreeMonthAmount, 35133.46);
assert.ok(displayedSafety.cashSafety.oneTimeThreeMonthAmount >
  displayedSafety.cashSafety.oneTimeAmount);
assert.match(String(displayedSafety.cashSafety.oneTimeReason), /2027-04/);
assert.match(String(displayedSafety.cashSafety.oneTimeReason), /No lump payment is labeled safe/);
assert.match(String(displayedSafety.cashSafety.oneTimeReason),
  /as the monthly deficit of \$11,233\.45 continues/);
assert.doesNotMatch(String(displayedSafety.cashSafety.oneTimeReason),
  /required payments and the protected reserve is due/);
assert.doesNotMatch(String(displayedSafety.cashSafety.oneTimeReason), /\$\-11/);
assert.doesNotMatch(String(displayedSafety.cashSafety.oneTimeReason),
  /recurring surplus of -/);
assert.equal(context.debtPayoffFormatCashSafetyCurrency_(-11233.45), '$11,233.45');
assert.equal(
  context.debtPayoffCashSafetySurplusContinuation_(-11233.45),
  'as the monthly deficit of $11,233.45 continues'
);
assert.doesNotMatch(String(displayedSafety.cashSafety.reason),
  /One-time use of cash above the reserve is not evaluated here/);
assert.doesNotMatch(String(displayedSafety.cashSafety.reason), /not recommended as a one-time/);
const displayedMonths3 = context.debtPayoffBuildCashSafetyMonths_(
  cashSafetyAsOf, 3, displayedUpcoming);
const displayedMonths12 = context.debtPayoffBuildCashSafetyMonths_(
  cashSafetyAsOf, 12, displayedUpcoming);
const displayedOneTimeWalk = context.debtPayoffWalkCashSafety_(
  110139.19, -11233.45, 35133.46, 1805.38, displayedMonths3, { oneTime: true });
assert.equal(displayedOneTimeWalk.ok, true,
  'the former 3-month lump still holds through month three');
assert.equal(
  displayedOneTimeWalk.walks.reduce(function(sum, row) {
    return context.round2_(sum + row.upcomingAmount);
  }, 0),
  39500
);
const displayedBaseline12 = context.debtPayoffWalkCashSafety_(
  110139.19, -11233.45, 0, 1805.38, displayedMonths12);
assert.equal(displayedBaseline12.ok, false,
  'continuing the -$11,233.45 deficit breaches the reserve after month three even with no lump');
assert.equal(displayedBaseline12.monthKey, '2027-04');
assert.ok(displayedBaseline12.walks.length >= 7);
assert.equal(displayedBaseline12.walks[2].ok, true,
  'month three still holds on the no-lump baseline');
assert.equal(displayedBaseline12.walks[6].ok, false);
assert.ok(displayedBaseline12.walks.every(function(row, i) {
  if (i === 0) return true;
  return row.endingCash < displayedBaseline12.walks[i - 1].endingCash;
}), 'continuing negative monthly cash flow reduces ending cash every month');
const displayedThreeMonthLumpFailsLater = context.debtPayoffWalkCashSafety_(
  110139.19, -11233.45, 35133.46, 1805.38, displayedMonths12, { oneTime: true });
assert.equal(displayedThreeMonthLumpFailsLater.ok, false,
  'a lump that only holds for three months is not safe through 12 months');
assert.ok(displayedThreeMonthLumpFailsLater.monthKey > '2026-12');
const displayedOneTimeOver = context.debtPayoffWalkCashSafety_(
  110139.19, -11233.45, 35133.47, 1805.38, displayedMonths3, { oneTime: true });
assert.equal(displayedOneTimeOver.ok, false);

const earlierMonthTighter = context.evaluateDebtPayoffFutureCashSafety_({
  asOfDate: cashSafetyAsOf,
  startingCash: 5000,
  surplus: 1000,
  requiredReserve: 4000,
  reserveUpcomingAmount: 0,
  upcomingExpenses: []
});
assert.equal(earlierMonthTighter.ok, true);
assert.equal(earlierMonthTighter.cashSafety.remainingAboveReserve, 4000);
assert.equal(earlierMonthTighter.cashSafety.oneTimeAmount, 2000);
assert.ok(earlierMonthTighter.cashSafety.oneTimeAmount <
  earlierMonthTighter.cashSafety.remainingAboveReserve);

const oneTimeCountsUpcomingOnce = context.evaluateDebtPayoffFutureCashSafety_({
  asOfDate: cashSafetyAsOf,
  startingCash: 5000,
  surplus: 1000,
  requiredReserve: 4000,
  reserveUpcomingAmount: 0,
  upcomingExpenses: [{
    name: 'Insurance',
    status: 'Planned',
    dueDate: '2026-10-28',
    dueDateKnown: true,
    amount: 800,
    amountKnown: true
  }]
});
assert.equal(
  context.round2_(earlierMonthTighter.cashSafety.oneTimeAmount -
    oneTimeCountsUpcomingOnce.cashSafety.oneTimeAmount),
  800
);

const passesThreeFailsLater = context.evaluateDebtPayoffFutureCashSafety_({
  asOfDate: cashSafetyAsOf,
  startingCash: 20000,
  surplus: -500,
  requiredReserve: 2000,
  reserveUpcomingAmount: 0,
  upcomingExpenses: []
});
assert.equal(passesThreeFailsLater.ok, true);
assert.equal(passesThreeFailsLater.cashSafety.oneTimeBaselineSafe, true);
assert.equal(passesThreeFailsLater.cashSafety.remainingAboveReserve, 16500);
assert.equal(passesThreeFailsLater.cashSafety.oneTimeThreeMonthAmount, 16500);
assert.equal(passesThreeFailsLater.cashSafety.oneTimeAmount, 12000);
assert.ok(passesThreeFailsLater.cashSafety.oneTimeThreeMonthAmount >
  passesThreeFailsLater.cashSafety.oneTimeAmount);
const laterMonths = context.debtPayoffBuildCashSafetyMonths_(cashSafetyAsOf, 12, []);
assert.equal(context.debtPayoffWalkCashSafety_(
  20000, -500, 16500, 2000, laterMonths, { oneTime: true }).ok, false);
assert.equal(context.debtPayoffWalkCashSafety_(
  20000, -500, 12000, 2000, laterMonths, { oneTime: true }).ok, true);
assert.equal(context.debtPayoffWalkCashSafety_(
  20000, -500, 16500, 2000,
  context.debtPayoffBuildCashSafetyMonths_(cashSafetyAsOf, 3, []),
  { oneTime: true }).ok, true);

const limitedHorizon = context.evaluateDebtPayoffFutureCashSafety_({
  startingCash: 20000,
  surplus: 500,
  requiredReserve: 2000,
  reserveUpcomingAmount: 0,
  upcomingExpenses: []
});
assert.equal(limitedHorizon.cashSafety.oneTimeLimitedToThreeMonths, true);
assert.equal(limitedHorizon.cashSafety.oneTimeAmount, 0);
assert.equal(limitedHorizon.cashSafety.oneTimeAllocationEvaluated, true);
assert.match(String(limitedHorizon.cashSafety.oneTimeReason), /limited to three months/);

const unknownLaterUpcoming = context.evaluateDebtPayoffFutureCashSafety_({
  asOfDate: cashSafetyAsOf,
  startingCash: 20000,
  surplus: 500,
  requiredReserve: 2000,
  reserveUpcomingAmount: 0,
  upcomingExpenses: [{
    name: 'Summer camp',
    status: 'Planned',
    dueDate: '2027-05-15',
    dueDateKnown: true,
    amount: null,
    amountKnown: false
  }]
});
assert.equal(unknownLaterUpcoming.ok, true);
assert.equal(unknownLaterUpcoming.extraCap, 500);
assert.equal(unknownLaterUpcoming.cashSafety.oneTimeAllocationEvaluated, false);
assert.equal(unknownLaterUpcoming.cashSafety.oneTimeAmount, null);
assert.match(String(unknownLaterUpcoming.cashSafety.oneTimeReason), /Summer camp/);
assert.match(String(unknownLaterUpcoming.cashSafety.oneTimeReason), /12-month/);

const identifiedGapUpcoming = [{
  name: 'Home insurance',
  status: 'Planned',
  dueDate: '2026-10-28',
  dueDateKnown: true,
  amount: 8946.66,
  amountKnown: true
}, {
  name: 'Tuition',
  status: 'Planned',
  dueDate: '2026-11-05',
  dueDateKnown: true,
  amount: 15000,
  amountKnown: true
}, {
  name: 'Property tax',
  status: 'Planned',
  dueDate: '2026-11-20',
  dueDateKnown: true,
  amount: 8000,
  amountKnown: true
}, {
  name: 'HOA special',
  status: 'Planned',
  dueDate: '2026-12-01',
  dueDateKnown: true,
  amount: 7500,
  amountKnown: true
}, {
  name: 'Car registration',
  status: 'Planned',
  dueDate: '2026-10-20',
  dueDateKnown: true,
  amount: 53.34,
  amountKnown: true
}];
const identifiedGapSafety = context.evaluateDebtPayoffFutureCashSafety_({
  asOfDate: cashSafetyAsOf,
  startingCash: 110139.19,
  surplus: -11233.45,
  requiredReserve: 41252.04,
  reserveUpcomingAmount: 39446.66,
  upcomingExpenses: identifiedGapUpcoming
});
assert.equal(identifiedGapSafety.cashSafety.reconciliation.inWindowUpcomingTotal, 39500);
assert.equal(
  identifiedGapSafety.cashSafety.reconciliation.discrepancy.identifiedRow &&
    identifiedGapSafety.cashSafety.reconciliation.discrepancy.identifiedRow.name,
  'Car registration'
);
assert.equal(
  identifiedGapSafety.cashSafety.reconciliation.discrepancy.identifiedRow.dueDate,
  '2026-10-20'
);
assert.match(String(identifiedGapSafety.cashSafety.reconciliation.discrepancy.label),
  /Car registration due 2026-10-20/);

const unknownUpcomingNotWalked = context.evaluateDebtPayoffFutureCashSafety_({
  asOfDate: cashSafetyAsOf,
  startingCash: 110139.19,
  surplus: -11233.45,
  requiredReserve: 41252.04,
  reserveUpcomingAmount: 0,
  upcomingExpenses: [{
    name: 'Unknown bill',
    status: 'Planned',
    dueDate: '2026-11-15',
    dueDateKnown: true,
    amount: null,
    amountKnown: false
  }, {
    name: 'Blank date bill',
    status: 'Planned',
    dueDate: '',
    dueDateKnown: false,
    amount: 900,
    amountKnown: true
  }]
});
assert.equal(unknownUpcomingNotWalked.ok, true);
assert.equal(unknownUpcomingNotWalked.cashSafety.inWindowUpcoming.length, 0);
assert.equal(unknownUpcomingNotWalked.cashSafety.inWindowUpcomingTotal, 0);
assert.equal(unknownUpcomingNotWalked.cashSafety.endingCashAtZeroExtra, 76438.84);
assert.notEqual(unknownUpcomingNotWalked.cashSafety.inWindowUpcomingTotal, 900);

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

const recDebts = [
  usableDebt('High APR Card', 3000, 24.99, 75),
  usableDebt('Low APR Card', 800, 8.99, 25)
];
const recSupported = context.buildDebtPayoffSupportedMonthlyExtra_(Object.assign({}, baseSupported, {
  debts: recDebts
}));
const monthlyRec = context.buildDebtPayoffMonthlyRecommendation_(recDebts, recSupported, { asOfDate: asOf });
assert.equal(recSupported.available, true);
assert.ok(recSupported.amount > 0);
assert.equal(monthlyRec.state, 'RECOMMENDED');
assert.equal(monthlyRec.monthlyExtra, recSupported.amount);
assert.equal(monthlyRec.strategyKey, 'avalanche');
assert.equal(monthlyRec.firstExtraDebt, 'High APR Card');
assert.equal(monthlyRec.extraIsAffordable, null);
assert.equal(monthlyRec.persisted, false);
assert.equal(monthlyRec.bonusesIncluded, false);
assert.equal(monthlyRec.refreshesFromSavedFacts, true);
assert.equal(monthlyRec.comparison.monthlyExtra, recSupported.amount);
assert.equal(monthlyRec.comparison.scenarioBonuses.included, false);
assert.ok(monthlyRec.nextMilestone && monthlyRec.nextMilestone.name);
assert.match(String(monthlyRec.why), /highest-APR|Avalanche/i);
assert.equal(monthlyRec.protection.reserveProtects, false);

const zeroRec = context.buildDebtPayoffMonthlyRecommendation_(recDebts, deficit, { asOfDate: asOf });
assert.equal(zeroRec.state, 'WITHHELD');
assert.equal(zeroRec.code, 'NO_SURPLUS');
assert.equal(zeroRec.monthlyExtra, 0);
assert.equal(zeroRec.comparison, null);
assert.equal(zeroRec.strategyKey, null);
assert.equal(zeroRec.breakEven.state, 'DEFICIT');
assert.equal(zeroRec.breakEven.gapToBreakEven,
  context.round2_(Math.abs(deficit.recurringSurplusBeforeReserve)));
assert.equal(zeroRec.breakEven.income, deficit.components.recurringIncomeMonthly);
assert.equal(zeroRec.breakEven.commitmentsTotal, context.round2_(
  deficit.components.recurringBillsMonthly + deficit.components.debtMinimumsMonthly));
assert.equal(
  context.round2_(zeroRec.breakEven.income - zeroRec.breakEven.commitmentsTotal),
  deficit.recurringSurplusBeforeReserve
);
assert.equal(zeroRec.breakEven.canIdentifySafeReduction, false);
assert.doesNotMatch(JSON.stringify(zeroRec.breakEven), /optional|adjustable|safe to reduce/i);
assert.match(String(zeroRec.reason), /by \$300\.00/);

assert.equal(monthlyRec.breakEven.state, 'BALANCED');
assert.equal(monthlyRec.breakEven.gapToBreakEven, 0);
assert.equal(monthlyRec.breakEven.income, recSupported.components.recurringIncomeMonthly);
assert.equal(monthlyRec.breakEven.canIdentifySafeReduction, false);

const missingRec = context.buildDebtPayoffMonthlyRecommendation_(recDebts, missingIncome, { asOfDate: asOf });
assert.equal(missingRec.state, 'WITHHELD');
assert.equal(missingRec.code, 'FACTS_MISSING');
assert.equal(missingRec.comparison, null);
assert.equal(missingRec.breakEven.state, 'FACTS_MISSING');
assert.equal(missingRec.breakEven.gapToBreakEven, null);
assert.equal(missingRec.breakEven.categories.length, 0);
assert.equal(missingRec.breakEven.canIdentifySafeReduction, false);

const reserveRec = context.buildDebtPayoffMonthlyRecommendation_(recDebts, reserveProtected, { asOfDate: asOf });
assert.equal(reserveRec.state, 'WITHHELD');
assert.equal(reserveRec.code, 'RESERVE_PROTECTS');
assert.equal(reserveRec.monthlyExtra, 0);
assert.equal(reserveRec.comparison, null);
assert.equal(reserveRec.protection.reserveProtects, true);

const futureBreachRec = context.buildDebtPayoffMonthlyRecommendation_(
  recDebts, futureReserveBreach, { asOfDate: cashSafetyAsOf });
assert.equal(futureBreachRec.state, 'WITHHELD');
assert.equal(futureBreachRec.code, 'FUTURE_RESERVE_BREACH');
assert.equal(futureBreachRec.monthlyExtra, 0);
assert.equal(futureBreachRec.comparison, null);
assert.equal(futureBreachRec.protection.futureReserveProtects, true);
assert.match(String(futureBreachRec.reason), /2026-12/);
assert.match(String(futureBreachRec.reason), /Insurance/);

const reducedRec = context.buildDebtPayoffMonthlyRecommendation_(
  recDebts, upcomingExpenseSafety, { asOfDate: cashSafetyAsOf });
assert.equal(reducedRec.state, 'RECOMMENDED');
assert.equal(reducedRec.monthlyExtra, 2333.33);
assert.notEqual(reducedRec.monthlyExtra, 2500);
assert.match(String(reducedRec.why), /reduced from \$2500\.00 to \$2333\.33/);
assert.match(String(reducedRec.why), /Insurance/);

const missingUpcomingRec = context.buildDebtPayoffMonthlyRecommendation_(
  recDebts, missingProjectionFacts, { asOfDate: cashSafetyAsOf });
assert.equal(missingUpcomingRec.state, 'WITHHELD');
assert.equal(missingUpcomingRec.code, 'FACTS_MISSING');
assert.match(String(missingUpcomingRec.reason), /Cash Flow → Upcoming/);
assert.equal(missingUpcomingRec.oneTimeAllocation.evaluated, false);
assert.equal(missingUpcomingRec.oneTimeAllocation.amount, null);
assert.equal(missingUpcomingRec.oneTimeAllocation.actionKey, 'NONE');
assert.match(String(missingUpcomingRec.oneTimeAllocation.why), /treated as \$0/);

const dedupRec = context.buildDebtPayoffMonthlyRecommendation_([
  usableDebt('Visa', 1200, 19.99, 200)
], doubleCount, { asOfDate: asOf });
assert.equal(dedupRec.state, 'RECOMMENDED');
assert.equal(dedupRec.monthlyExtra, 1333.33);
assert.equal(dedupRec.protection.debtMinimumsMonthly, 200);
assert.equal(dedupRec.protection.recurringBillsMonthly, 1000);
assert.equal(dedupRec.protection.policyFloorMonthly, 2166.67);
assert.notEqual(dedupRec.protection.recurringBillsMonthly, 1700);

const incompleteRec = context.buildDebtPayoffMonthlyRecommendation_([
  usableDebt('Good Card', 500, 19.99, 25),
  {
    name: 'Blank APR Card',
    active: true,
    balance: 400,
    interestRate: 0,
    minimumPayment: 20,
    minimumPaymentKnown: true,
    interestRateKnown: false
  }
], recSupported, { asOfDate: asOf });
assert.equal(incompleteRec.state, 'WITHHELD');
assert.equal(incompleteRec.code, 'HOUSEHOLD_INCOMPLETE');
assert.equal(incompleteRec.comparison, null);
assert.match(String(incompleteRec.reason), /Blank APR Card/);
assert.equal(incompleteRec.nextDollar.state, 'WITHHELD');
assert.equal(incompleteRec.nextDollar.actionKey, 'KEEP_CASH');

assert.equal(monthlyRec.nextDollar.actionKey, 'PAY_HIGH_APR_DEBT');
assert.equal(monthlyRec.nextDollar.amount, recSupported.amount);
assert.equal(monthlyRec.nextDollar.persisted, false);
assert.equal(monthlyRec.nextDollar.extraIsAffordable, null);
assert.equal(monthlyRec.nextDollar.cashYieldStatus, 'CASH_YIELD_DATA_REQUIRED');
assert.equal(monthlyRec.nextDollar.expectedInvestmentReturnKnown, false);
assert.equal(monthlyRec.nextDollar.alternatives.length, 4);
assert.equal(monthlyRec.nextDollar.alternatives[0].key, 'PAY_HIGH_APR_DEBT');
assert.equal(monthlyRec.nextDollar.alternatives[1].key, 'KEEP_CASH');
assert.equal(monthlyRec.nextDollar.alternatives[2].key, 'PAY_MORTGAGE');
assert.equal(monthlyRec.nextDollar.alternatives[3].key, 'INVEST');
assert.equal(monthlyRec.nextDollar.alternatives[0].status, 'READY');
assert.equal(monthlyRec.nextDollar.alternatives[3].status, 'CONDITIONAL');
assert.ok(monthlyRec.nextDollar.alternatives[0].interestSavedVsMinimumOnly > 0);
assert.match(String(monthlyRec.nextDollar.liquidity), /leaves cash|not kept as a reserve/i);
assert.match(String(monthlyRec.nextDollar.horizonLabel), /month/);
assert.match(String(monthlyRec.nextDollar.alternatives[3].location), /Retirement/);

assert.equal(zeroRec.nextDollar.actionKey, 'KEEP_CASH');
assert.equal(zeroRec.nextDollar.amount, 0);
assert.match(String(zeroRec.nextDollar.why), /no extra|no surplus|recurring extra|monthly extra remains/i);
assert.equal(zeroRec.nextDollar.alternatives.length, 0);
assert.equal(zeroRec.nextDollar.oneTimeAllocationEvaluated, true);
assert.equal(zeroRec.oneTimeAllocation.evaluated, true);
assert.ok(zeroRec.oneTimeAllocation.amount > 0);
assert.doesNotMatch(String(zeroRec.nextDollar.liquidity), /already use available cash/);

const noLumpSumRec = context.buildDebtPayoffMonthlyRecommendation_(
  recDebts, negativeSurplusCashAbove, { asOfDate: cashSafetyAsOf });
assert.equal(noLumpSumRec.state, 'WITHHELD');
assert.equal(noLumpSumRec.code, 'NO_SURPLUS');
assert.equal(noLumpSumRec.monthlyExtra, 0);
assert.equal(noLumpSumRec.nextDollar.alternatives.length, 0);
assert.equal(noLumpSumRec.nextDollar.oneTimeAllocationEvaluated, true);
assert.equal(noLumpSumRec.nextDollar.actionKey, 'KEEP_CASH');
assert.doesNotMatch(JSON.stringify(noLumpSumRec), /lump-sum|PAY_LUMP|one-time extra payment is recommended/i);
assert.match(String(noLumpSumRec.reason), /no monthly extra remains|no surplus|exceed recurring income/i);
assert.doesNotMatch(String(noLumpSumRec.reason), /not recommended as a one-time/);
assert.equal(noLumpSumRec.nextDollar.liquidity, '');
assert.equal(noLumpSumRec.nextDollar.outcome, '');
assert.doesNotMatch(String(noLumpSumRec.nextDollar.liquidity), /already use available cash/);
assert.equal(noLumpSumRec.oneTimeAllocation.evaluated, true);
assert.equal(noLumpSumRec.oneTimeAllocation.state, 'EVALUATED');
assert.equal(
  noLumpSumRec.oneTimeAllocation.amount,
  negativeSurplusCashAbove.cashSafety.oneTimeAmount
);
assert.ok(noLumpSumRec.oneTimeAllocation.amount > 0);
assert.equal(noLumpSumRec.oneTimeAllocation.actionKey, 'UNRANKED');
assert.equal(noLumpSumRec.oneTimeAllocation.ranked, false);
assert.equal(noLumpSumRec.oneTimeAllocation.cashYieldStatus, 'CASH_YIELD_DATA_REQUIRED');
assert.equal(noLumpSumRec.oneTimeAllocation.payHighApr.status, 'READY');
assert.ok(noLumpSumRec.oneTimeAllocation.payHighApr.interestSavedVsMinimumOnly > 0);
assert.match(String(noLumpSumRec.oneTimeAllocation.payHighApr.outcome), /less interest than baseline|Modeled interest/);
assert.match(String(noLumpSumRec.oneTimeAllocation.why), /not ranked/);
assert.doesNotMatch(JSON.stringify(noLumpSumRec.oneTimeAllocation), /buildCapitalAllocationPlan_/);

const displayedHouseholdSupported = Object.assign({}, negativeSurplusCashAbove, {
  amount: 0,
  deficit: true,
  recurringSurplusBeforeReserve: -11233.45,
  usableCashAfterBuffers: 110139.19,
  requiredReserveAmount: 41252.04,
  cashSafety: displayedSafety.cashSafety
});
const displayedHouseholdRec = context.buildDebtPayoffMonthlyRecommendation_(
  recDebts, displayedHouseholdSupported, { asOfDate: cashSafetyAsOf });
assert.equal(displayedHouseholdRec.monthlyExtra, 0);
assert.equal(displayedHouseholdRec.oneTimeAllocation.amount, 0);
assert.equal(displayedHouseholdRec.oneTimeAllocation.code, 'BASELINE_RESERVE_BREACH');
assert.equal(displayedHouseholdRec.oneTimeAllocation.actionKey, 'NONE');
assert.equal(displayedHouseholdRec.oneTimeAllocation.baselineBreachMonthKey, '2027-04');
assert.equal(displayedHouseholdRec.oneTimeAllocation.threeMonthAmount, 35133.46);
assert.equal(displayedHouseholdRec.breakEven.state, 'DEFICIT');
assert.equal(displayedHouseholdRec.breakEven.gapToBreakEven, 11233.45);
assert.equal(
  displayedHouseholdRec.breakEven.gapToBreakEven,
  context.round2_(Math.abs(displayedHouseholdSupported.recurringSurplusBeforeReserve))
);
assert.match(String(displayedHouseholdRec.oneTimeAllocation.why), /No lump payment is labeled safe/);
assert.match(String(displayedHouseholdRec.oneTimeAllocation.why),
  /as the monthly deficit of \$11,233\.45 continues/);
assert.doesNotMatch(String(displayedHouseholdRec.oneTimeAllocation.why),
  /required payments and the protected reserve is due/);
assert.doesNotMatch(String(displayedHouseholdRec.oneTimeAllocation.why), /still leaves cash at or above/);

const rankedOneTime = context.buildDebtPayoffMonthlyRecommendation_(
  recDebts, negativeSurplusCashAbove, {
    asOfDate: cashSafetyAsOf,
    savedAssumptions: {
      cashYieldKnown: true,
      cashYieldPct: 0.5,
      cashYieldStatus: 'SAVED_APY',
      cashYieldLocation: 'SYS - Financial Facts APY'
    }
  });
assert.equal(rankedOneTime.oneTimeAllocation.ranked, true);
assert.equal(rankedOneTime.oneTimeAllocation.actionKey, 'PAY_HIGH_APR_DEBT');
assert.equal(rankedOneTime.monthlyExtra, 0);

const keepCashOneTime = context.buildDebtPayoffMonthlyRecommendation_(
  recDebts, negativeSurplusCashAbove, {
    asOfDate: cashSafetyAsOf,
    savedAssumptions: {
      cashYieldKnown: true,
      cashYieldPct: 25,
      cashYieldStatus: 'SAVED_APY',
      cashYieldLocation: 'SYS - Financial Facts APY'
    }
  });
assert.equal(keepCashOneTime.oneTimeAllocation.ranked, true);
assert.equal(keepCashOneTime.oneTimeAllocation.actionKey, 'KEEP_CASH');
assert.equal(keepCashOneTime.monthlyExtra, 0);

assert.equal(missingRec.nextDollar.actionKey, 'NONE');
assert.equal(missingRec.nextDollar.amount, null);
assert.match(String(missingRec.nextDollar.why), /income|proven|missing|\$0/i);
assert.equal(missingRec.oneTimeAllocation.evaluated, false);
assert.equal(missingRec.oneTimeAllocation.amount, null);

assert.equal(reserveRec.nextDollar.actionKey, 'KEEP_CASH');
assert.equal(reserveRec.nextDollar.amount, 0);
assert.match(String(reserveRec.nextDollar.why), /reserve/i);
assert.equal(reserveRec.nextDollar.alternatives.length, 0);
assert.equal(reserveRec.oneTimeAllocation.evaluated, true);
assert.equal(reserveRec.oneTimeAllocation.amount, 0);
assert.equal(reserveRec.oneTimeAllocation.actionKey, 'NONE');

const house = usableDebt('Loan Depot - San Jose House', 400000, 2.25, 1800);
house.type = 'Loan';
const mortgageSupported = context.buildDebtPayoffSupportedMonthlyExtra_(Object.assign({}, baseSupported, {
  debts: [house]
}));
const mortgageRec = context.buildDebtPayoffMonthlyRecommendation_([house], mortgageSupported, {
  asOfDate: asOf
});
assert.equal(mortgageRec.state, 'RECOMMENDED');
assert.ok(mortgageRec.monthlyExtra > 0);
assert.equal(mortgageRec.nextDollar.actionKey, 'KEEP_CASH');
assert.equal(mortgageRec.nextDollar.alternatives[0].status, 'NOT_APPLICABLE');
assert.equal(mortgageRec.nextDollar.alternatives[2].status, 'READY');
assert.ok(mortgageRec.nextDollar.alternatives[2].interestSavedVsMinimumOnly > 0);
assert.match(String(mortgageRec.nextDollar.alternatives[2].why), /Tax deductibility/);
assert.equal(mortgageRec.nextDollar.alternatives[3].status, 'CONDITIONAL');

const heloc = usableDebt('Home Equity Line', 20000, 8.5, 200);
heloc.type = 'HELOC';
assert.equal(context.debtPayoffIsHeloc_(heloc), true);
assert.equal(context.debtPayoffIsMortgage_(heloc), false);
assert.equal(context.debtPayoffIsMortgage_(house), true);
const car = usableDebt('Honda Loan', 8000, 6.9, 250);
car.type = 'Loan';
assert.equal(context.debtPayoffIsMortgage_(car), false);

const investedRec = context.buildDebtPayoffMonthlyRecommendation_(recDebts, recSupported, {
  asOfDate: asOf,
  savedAssumptions: {
    cashYieldKnown: false,
    cashYieldStatus: 'CASH_YIELD_DATA_REQUIRED',
    expectedInvestmentReturnKnown: true,
    expectedInvestmentReturnPct: 8.5,
    expectedInvestmentReturnLocation: 'Planning → Retirement (Base Expected Annual Return %)'
  }
});
assert.equal(investedRec.nextDollar.actionKey, 'PAY_HIGH_APR_DEBT');
assert.equal(investedRec.nextDollar.alternatives[3].status, 'READY');
assert.equal(investedRec.nextDollar.alternatives[3].expectedReturnPct, 8.5);
assert.match(String(investedRec.nextDollar.alternatives[3].outcomeKind), /UNCERTAIN_RETURN/);
assert.notEqual(investedRec.nextDollar.actionKey, 'INVEST');
assert.doesNotMatch(JSON.stringify(investedRec.nextDollar), /"expectedInvestmentReturnPct":7\b/);

const targeted = context.simulateDebtPayoffSchedule_(
  [
    usableDebt('High APR Card', 400, 24, 20),
    Object.assign(usableDebt('Loan Depot - San Jose House', 400000, 2.25, 1800), { type: 'Loan' })
  ],
  50,
  'avalanche',
  {
    asOfDate: asOf,
    horizonMonths: 3,
    extraTargetNames: ['High APR Card']
  }
);
assert.deepEqual(targeted.extraPriorityOrder, ['High APR Card']);
assert.equal(targeted.extraPriorityOrder.indexOf('Loan Depot - San Jose House'), -1);

const blankReturn = context.readDebtPayoffSavedPlanningAssumptions_({
  getSheetByName: function() {
    return {
      getLastRow: function() { return 2; },
      getDataRange: function() {
        return {
          getValues: function() {
            return [['Selected Scenario', 'Base'], ['Expected Annual Return %', '', '']];
          },
          getDisplayValues: function() {
            return [['Selected Scenario', 'Base'], ['Expected Annual Return %', '', '']];
          }
        };
      }
    };
  }
});
assert.equal(blankReturn.expectedInvestmentReturnKnown, false);
assert.equal(blankReturn.expectedInvestmentReturnPct, null);
assert.equal(blankReturn.cashYieldStatus, 'CASH_YIELD_DATA_REQUIRED');

const savedReturn = context.readDebtPayoffSavedPlanningAssumptions_({
  getSheetByName: function() {
    return {
      getLastRow: function() { return 2; },
      getDataRange: function() {
        return {
          getValues: function() {
            return [
              ['Selected Scenario', 'Base', '', ''],
              ['Expected Annual Return %', '', 8.5, '']
            ];
          },
          getDisplayValues: function() {
            return [
              ['Selected Scenario', 'Base', '', ''],
              ['Expected Annual Return %', '', '8.50%', '']
            ];
          }
        };
      }
    };
  }
});
assert.equal(savedReturn.expectedInvestmentReturnKnown, true);
assert.equal(savedReturn.expectedInvestmentReturnPct, 8.5);
assert.equal(savedReturn.expectedInvestmentReturnSource, 'CONFIGURED_FACT');

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

const asOfJan2026 = new Date(2026, 0, 14);
const asOfFeb2026 = new Date(2026, 1, 14);
const asOfOct2026 = new Date(2026, 9, 14);
const janKeys = context.debtPayoffYtdCompletedMonthKeys_(asOfJan2026);
const febKeys = context.debtPayoffYtdCompletedMonthKeys_(asOfFeb2026);
const windowKeys = context.debtPayoffYtdCompletedMonthKeys_(asOfOct2026);
assert.equal(janKeys.length, 0);
assert.deepEqual(Array.from(febKeys), ['2026-01']);
assert.equal(windowKeys[0], '2026-01');
assert.equal(windowKeys[1], '2026-02');
assert.equal(windowKeys[8], '2026-09');
assert.equal(windowKeys.length, 9);
assert.equal(windowKeys.indexOf('2026-10') === -1, true);
assert.equal(windowKeys.indexOf('2025-12') === -1, true);

function buildCashFlowYear(year, rows) {
  const yy = String(year).slice(-2);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const headers = ['Type', 'Payee'].concat(months.map(function(name) {
    return name + '-' + yy;
  }));
  const display = [headers];
  const values = [headers.slice()];
  (rows || []).forEach(function(row) {
    const d = [row.type || 'Expense', row.payee];
    const v = [row.type || 'Expense', row.payee];
    for (let m = 1; m <= 12; m++) {
      const key = year + '-' + (m < 10 ? '0' + m : String(m));
      if (!Object.prototype.hasOwnProperty.call(row.amounts || {}, key) ||
          row.amounts[key] === '' || row.amounts[key] == null) {
        d.push('');
        v.push('');
        continue;
      }
      const amt = row.amounts[key];
      d.push(amt === 0 ? '0.00' : String(amt));
      v.push(amt);
    }
    display.push(d);
    values.push(v);
  });
  return { display: display, values: values };
}

function sheetsYtd(payee, fillFn, extraRows, keys) {
  const useKeys = keys || windowKeys;
  const amounts = { '2026-10': -5000, '2026-12': -5000 };
  useKeys.forEach(function(key) {
    amounts[key] = fillFn(key);
  });
  return {
    2026: buildCashFlowYear(2026, [{
      payee: payee,
      amounts: amounts
    }].concat(extraRows || []))
  };
}

function variableBill(payee, history, extra) {
  return Object.assign({
    payee: payee,
    amount: 999,
    amountKnown: true,
    frequency: 'monthly',
    active: true,
    varies: 'Yes',
    variableHistory: history
  }, extra || {});
}

const monthlyFill = function() { return -50; };
const monthlyHistory = context.estimateDebtPayoffVariableBillHistory_(
  'Utilities', windowKeys, sheetsYtd('Utilities', monthlyFill), []);
assert.equal(monthlyHistory.ok, true);
assert.equal(monthlyHistory.ytdTotal, 450);
assert.equal(monthlyHistory.completedMonthCount, 9);
assert.equal(monthlyHistory.monthlyEquivalent, 50);
assert.equal(monthlyHistory.label, 'YTD running average');
assert.notEqual(monthlyHistory.ytdTotal, 50 * 11,
  'the current incomplete month and later months must be excluded');

const janHistory = context.estimateDebtPayoffVariableBillHistory_(
  'Utilities', janKeys, sheetsYtd('Utilities', monthlyFill, [], janKeys), []);
assert.equal(janHistory.ok, false);
assert.equal(janHistory.code, 'VARIABLE_BILL_HISTORY_INCOMPLETE');
assert.match(String(janHistory.reason), /no completed Cash Flow month yet this year/);

const febHistory = context.estimateDebtPayoffVariableBillHistory_(
  'Utilities', febKeys, sheetsYtd('Utilities', function() { return -80; }, [], febKeys), []);
assert.equal(febHistory.ok, true);
assert.equal(febHistory.ytdTotal, 80);
assert.equal(febHistory.completedMonthCount, 1);
assert.equal(febHistory.monthlyEquivalent, 80);
assert.equal(febHistory.periodStart, '2026-01');
assert.equal(febHistory.periodEnd, '2026-01');
assert.notEqual(febHistory.ytdTotal, 80 + 5000);

const seasonalFill = function(key) { return key === '2026-03' ? -1200 : 0; };
const seasonalHistory = context.estimateDebtPayoffVariableBillHistory_(
  'Insurance', windowKeys, sheetsYtd('Insurance', seasonalFill), []);
assert.equal(seasonalHistory.ok, true);
assert.equal(seasonalHistory.ytdTotal, 1200);
assert.equal(seasonalHistory.completedMonthCount, 9);
assert.equal(seasonalHistory.monthlyEquivalent, 133.33);
assert.equal(seasonalHistory.explicitZeroMonthCount, 8);
assert.equal(seasonalHistory.label, 'YTD running average');
assert.notEqual(seasonalHistory.monthlyEquivalent, 100);

const blankInWindow = context.estimateDebtPayoffVariableBillHistory_(
  'Insurance', windowKeys, sheetsYtd('Insurance', function(key) {
    return key === '2026-09' ? '' : -50;
  }), []);
assert.equal(blankInWindow.ok, false);
assert.equal(blankInWindow.code, 'VARIABLE_BILL_HISTORY_INCOMPLETE');
assert.match(String(blankInWindow.reason), /blank or missing Cash Flow amount in 2026-09/i);
assert.match(String(blankInWindow.reason), /not treated as \$0 or omitted from the YTD denominator/);

const allBlankHistory = context.estimateDebtPayoffVariableBillHistory_(
  'Insurance', windowKeys, sheetsYtd('Insurance', function() { return ''; }), []);
assert.equal(allBlankHistory.ok, false);
assert.equal(allBlankHistory.code, 'VARIABLE_BILL_HISTORY_INCOMPLETE');

const missingYearHistory = context.estimateDebtPayoffVariableBillHistory_(
  'Insurance', windowKeys, {}, ['2026']);
assert.equal(missingYearHistory.ok, false);
assert.equal(missingYearHistory.code, 'VARIABLE_BILL_HISTORY_INCOMPLETE');
assert.match(String(missingYearHistory.reason), /Cash Flow 2026 is missing/);

const noMatchHistory = context.estimateDebtPayoffVariableBillHistory_(
  'Insurance', windowKeys, sheetsYtd('Water', monthlyFill), []);
assert.equal(noMatchHistory.ok, false);
assert.equal(noMatchHistory.code, 'VARIABLE_BILL_MATCH_MISSING');

const ambiguousSheets = sheetsYtd('PG&E', monthlyFill, [
  { payee: 'PG&E', amounts: { '2026-01': -80 } }
]);
const ambiguousHistory = context.estimateDebtPayoffVariableBillHistory_(
  'PG&E', windowKeys, ambiguousSheets, []);
assert.equal(ambiguousHistory.ok, false);
assert.equal(ambiguousHistory.code, 'VARIABLE_BILL_MATCH_AMBIGUOUS');

const oneTimeSheets = sheetsYtd('Insurance', seasonalFill, [
  { payee: 'Graduation Gift', amounts: { '2026-06': -400 } }
]);
const ignoresOneTime = context.estimateDebtPayoffVariableBillHistory_(
  'Insurance', windowKeys, oneTimeSheets, []);
assert.equal(ignoresOneTime.ytdTotal, 1200);
assert.notEqual(ignoresOneTime.ytdTotal, 1600);

const creditFill = function(key) { return key === '2026-06' ? 20 : -50; };
const creditHistory = context.estimateDebtPayoffVariableBillHistory_(
  'Utilities', windowKeys, sheetsYtd('Utilities', creditFill), []);
assert.equal(creditHistory.ok, true);
assert.equal(creditHistory.ytdTotal, 380);
assert.notEqual(creditHistory.ytdTotal, 420,
  'a documented Expense credit must be netted, not converted with an absolute value');

const netCreditHistory = context.estimateDebtPayoffVariableBillHistory_(
  'Utilities', windowKeys, sheetsYtd('Utilities', function() { return 20; }), []);
assert.equal(netCreditHistory.ok, false);
assert.equal(netCreditHistory.code, 'VARIABLE_BILL_SIGN_AMBIGUOUS');
assert.match(String(netCreditHistory.reason), /not converted with an absolute value/);

const variableSurplus = context.buildDebtPayoffSupportedMonthlyExtra_(Object.assign({}, baseSupported, {
  bills: [
    baseSupported.bills[0],
    variableBill('Insurance', seasonalHistory)
  ]
}));
assert.equal(variableSurplus.available, true);
assert.equal(variableSurplus.extraIsAffordable, null);
assert.equal(variableSurplus.components.variableBillsMonthly, 133.33);
assert.equal(variableSurplus.components.recurringBillsMonthly, 1000);
assert.equal(variableSurplus.amount, 2366.67);
assert.notEqual(variableSurplus.components.variableBillsMonthly, 999);
assert.equal(variableSurplus.variableBillEstimates.length, 1);
assert.equal(variableSurplus.variableBillEstimates[0].payee, 'Insurance');
assert.equal(variableSurplus.variableBillEstimates[0].ytdTotal, 1200);
assert.equal(variableSurplus.variableBillEstimates[0].completedMonthCount, 9);
assert.equal(variableSurplus.variableBillEstimates[0].monthlyEquivalent, 133.33);
assert.equal(variableSurplus.variableBillEstimates[0].label, 'YTD running average');
assert.match(String(variableSurplus.assumptions.join(' ')), /YTD running average/);
assert.match(String(variableSurplus.variableBillMethod), /annual or seasonal costs can make it swing/i);
assert.match(String(variableSurplus.variableBillMethod), /January ÷ 1/);

const withheldHistory = context.buildDebtPayoffSupportedMonthlyExtra_(Object.assign({}, baseSupported, {
  bills: [
    baseSupported.bills[0],
    variableBill('Insurance', blankInWindow)
  ]
}));
assert.equal(withheldHistory.available, false);
assert.equal(withheldHistory.amount, null);
assert.equal(withheldHistory.extraIsAffordable, null);
assert.equal(withheldHistory.blockers.some(function(row) {
  return row.code === 'VARIABLE_BILL_HISTORY_INCOMPLETE' && /Insurance/.test(row.reason);
}), true);

const withheldAmbiguous = context.buildDebtPayoffSupportedMonthlyExtra_(Object.assign({}, baseSupported, {
  bills: [baseSupported.bills[0], variableBill('PG&E', ambiguousHistory)]
}));
assert.equal(withheldAmbiguous.available, false);
assert.equal(withheldAmbiguous.blockers[0].code, 'VARIABLE_BILL_MATCH_AMBIGUOUS');

const debtNamedVaries = context.buildDebtPayoffSupportedMonthlyExtra_(Object.assign({}, baseSupported, {
  bills: [
    baseSupported.bills[0],
    variableBill('Card', monthlyHistory)
  ]
}));
assert.equal(debtNamedVaries.available, true);
assert.equal(debtNamedVaries.components.variableBillsMonthly, 0);
assert.equal(debtNamedVaries.components.debtMinimumsMonthly, 500);
assert.equal(debtNamedVaries.amount, 2500);

const floorNamedVaries = context.buildDebtPayoffSupportedMonthlyExtra_(Object.assign({}, baseSupported, {
  bills: [
    baseSupported.bills[0],
    variableBill('Samer Robinhood', monthlyHistory, {
      isInvestmentContribution: true,
      matchedInvestmentAccount: 'Samer Robinhood'
    })
  ],
  policyFloors: [{ accountName: 'Samer Robinhood', weeklyAmount: 500 }]
}));
assert.equal(floorNamedVaries.available, true);
assert.equal(floorNamedVaries.components.variableBillsMonthly, 0);
assert.equal(floorNamedVaries.components.policyFloorMonthly, 2166.67);
assert.notEqual(floorNamedVaries.components.variableBillsMonthly, 50);

const negativeSpend = context.debtPayoffParseKnownCashFlowSpend_(-80, '($80.00)');
assert.equal(negativeSpend.known, true);
assert.equal(negativeSpend.signed, -80);
assert.equal(negativeSpend.cost, 80);
const creditSpend = context.debtPayoffParseKnownCashFlowSpend_(20, '$20.00');
assert.equal(creditSpend.known, true);
assert.equal(creditSpend.signed, 20);
assert.equal(creditSpend.cost, -20);
const explicitZeroSpend = context.debtPayoffParseKnownCashFlowSpend_(0, '0.00');
assert.equal(explicitZeroSpend.known, true);
assert.equal(explicitZeroSpend.cost, 0);
const blankCell = context.debtPayoffParseKnownCashFlowSpend_('', '');
assert.equal(blankCell.known, false);

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

const upcomingReader = context.readDebtPayoffUpcomingObligations_({
  getSheetByName: function(name) {
    if (name !== 'INPUT - Upcoming Expenses') return null;
    return {
      getDataRange: function() {
        return {
          getDisplayValues: function() {
            return [
              ['ID', 'Status', 'Expense Name', 'Category', 'Payee', 'Due Date', 'Amount',
                'Account / Source', 'Auto Add To Cash Flow', 'Added To Cash Flow', 'Notes'],
              ['u1', 'Planned', 'Blank amount bill', '', '', '2026-11-20', '', '', 'No', 'No', ''],
              ['u2', 'Paid', 'Already paid', '', '', '2026-11-05', '900', '', 'No', 'No', '']
            ];
          },
          getValues: function() {
            return [
              ['ID', 'Status', 'Expense Name', 'Category', 'Payee', 'Due Date', 'Amount',
                'Account / Source', 'Auto Add To Cash Flow', 'Added To Cash Flow', 'Notes'],
              ['u1', 'Planned', 'Blank amount bill', '', '', '2026-11-20', '', '', 'No', 'No', ''],
              ['u2', 'Paid', 'Already paid', '', '', '2026-11-05', 900, '', 'No', 'No', '']
            ];
          }
        };
      }
    };
  }
});
assert.equal(upcomingReader.ok, true);
assert.equal(upcomingReader.rows.length, 1);
assert.equal(upcomingReader.rows[0].name, 'Blank amount bill');
assert.equal(upcomingReader.rows[0].amountKnown, false);
assert.equal(upcomingReader.rows[0].dueDateKnown, true);

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
assert.match(debtOverview, /not cash available each month/);
assert.match(debtOverview, /not used for the 90-day cash reserve/);
assert.doesNotMatch(client, /function renderDebtPayoffDatedBonusScenarioHtml_/);
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
  /applyDebtPayoffScenarioLeftover_\(\s*remaining, extra, allocStrategy, extraTargetNames\)/);
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

const bonusRowsWrap = { innerHTML: '' };
const resultsWrap = { innerHTML: '' };
const recommendationWrap = { innerHTML: '' };
const uiContext = vm.createContext({
  Date, Math, Number, String, Array, Object, JSON, isFinite,
  DEBT_PAYOFF_SCENARIO_BONUS_NAMES_: ['Cisco Mid Year Bonus', 'Cisco End Year Bonus'],
  escapeHtml: function(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  },
  fmtCurrency: function(value) {
    const num = Number(value);
    if (!isFinite(num)) return '—';
    const sign = num < 0 ? '-' : '';
    return sign + '$' + Math.abs(num).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  },
  document: {
    getElementById: function(id) {
      if (id === 'debt_payoff_scenario_bonus_rows') return bonusRowsWrap;
      if (id === 'debt_payoff_strategy_results') return resultsWrap;
      if (id === 'debt_payoff_recommendation') return recommendationWrap;
      return null;
    }
  }
});
vm.runInContext(
  sliceFunction(client, 'debtPayoffStrategyTitle_') +
  '\n' + sliceFunction(client, 'formatDebtPayoffInterestVsBaseline_') +
  '\n' + sliceFunction(client, 'formatDebtPayoffStrategyDate_') +
  '\n' + sliceFunction(client, 'formatDebtPayoffStrategyOrder_') +
  '\n' + sliceFunction(client, 'formatDebtPayoffPriority_') +
  '\n' + sliceFunction(client, 'formatDebtPayoffRecommendedExtraAmount_') +
  '\n' + sliceFunction(client, 'renderDebtPayoffMissingFactsHtml_') +
  '\n' + sliceFunction(client, 'debtPayoffSupportedFromProtection_') +
  '\n' + sliceFunction(client, 'renderDebtPayoffNestedDetailsHtml_') +
  '\n' + sliceFunction(client, 'renderDebtPayoffDetailsSummaryHtml_') +
  '\n' + sliceFunction(client, 'renderDebtPayoffCalculationDetailsHtml_') +
  '\n' + sliceFunction(client, 'renderDebtPayoffCashSafetySummaryHtml_') +
  '\n' + sliceFunction(client, 'renderDebtPayoffCashSafetyHtml_') +
  '\n' + sliceFunction(client, 'renderDebtPayoffCashSafetyReconciliationHtml_') +
  '\n' + sliceFunction(client, 'renderDebtPayoffSupportedExtraBreakdownHtml_') +
  '\n' + sliceFunction(client, 'renderDebtPayoffVariableBillMethodHtml_') +
  '\n' + sliceFunction(client, 'debtPayoffVariableBillPeriodLabel_') +
  '\n' + sliceFunction(client, 'renderDebtPayoffVariableBillEstimatesHtml_') +
  '\n' + sliceFunction(client, 'renderDebtPayoffOneTimeAllocationHtml_') +
  '\n' + sliceFunction(client, 'resolveDebtPayoffBreakEven_') +
  '\n' + sliceFunction(client, 'renderDebtPayoffBreakEvenHtml_') +
  '\n' + sliceFunction(client, 'renderDebtPayoffMonthlyRecommendation_') +
  '\n' + sliceFunction(client, 'renderDebtPayoffNextDollarLead_') +
  '\n' + sliceFunction(client, 'renderDebtPayoffNextDollarDetailsHtml_') +
  '\n' + sliceFunction(client, 'renderDebtPayoffScenarioBonusForm_') +
  '\n' + sliceFunction(client, 'renderDebtPayoffStrategyCard_') +
  '\n' + sliceFunction(client, 'renderDebtPayoffStrategyComparison_'),
  uiContext
);

const supportedExtraUi = {
  available: true,
  amount: 250,
  label: 'Estimate',
  reserveProtects: false,
  deficit: false,
  source: 'Confirmed Cash Flow recurring income',
  components: {
    recurringIncomeMonthly: 4000,
    recurringBillsMonthly: 1000,
    variableBillsMonthly: 133.33,
    debtMinimumsMonthly: 500,
    policyFloorMonthly: 0,
    unmatchedInvestmentBillsMonthly: 0
  },
  recurringSurplusBeforeReserve: 2366.67,
  usableCashAfterBuffers: 5000,
  requiredReserveAmount: 1000,
  variableBillMethod: 'Variable bills marked Varies use a YTD running average.',
  variableBillEstimates: [{
    payee: 'PG&E',
    periodStart: '2026-01',
    periodEnd: '2026-09',
    ytdTotal: 1200,
    completedMonthCount: 9,
    monthlyEquivalent: 133.33,
    label: 'YTD running average'
  }, {
    payee: 'Water',
    periodStart: '2026-01',
    periodEnd: '2026-09',
    ytdTotal: 360,
    completedMonthCount: 9,
    monthlyEquivalent: 40,
    label: 'YTD running average'
  }],
  assumptions: ['Variable bills marked Varies use a YTD running average.']
};

uiContext.renderDebtPayoffMonthlyRecommendation_({
  state: 'WITHHELD',
  code: 'NO_SURPLUS',
  reason: 'Recurring commitments leave no surplus after required bills.',
  monthlyExtra: 0,
  comparison: null,
  protection: {
    recurringIncomeMonthly: 1200,
    recurringBillsMonthly: 1000,
    debtMinimumsMonthly: 500,
    surplusBeforeReserve: -300,
    requiredReserveAmount: 1000,
    usableCashAfterBuffers: 5000,
    reserveProtects: false,
    deficit: true
  }
}, { available: true, amount: 0, deficit: true, components: {
  recurringIncomeMonthly: 1200,
  recurringBillsMonthly: 1000,
  debtMinimumsMonthly: 500
}, recurringSurplusBeforeReserve: -300, requiredReserveAmount: 1000, usableCashAfterBuffers: 5000 });
assert.match(recommendationWrap.innerHTML, /<strong>\$0\.00<\/strong>/);
assert.match(recommendationWrap.innerHTML, /No recurring extra this month/);
assert.match(recommendationWrap.innerHTML, /Monthly gap to break even: \$300\.00/);
assert.match(recommendationWrap.innerHTML, /<span class="debt-payoff-summary-label">Recurring income<\/span><span class="debt-payoff-summary-value">\$1,200\.00<\/span>/);
assert.match(recommendationWrap.innerHTML, /<span class="debt-payoff-summary-label">Required bills<\/span><span class="debt-payoff-summary-value">\$1,000\.00<\/span>/);
assert.match(recommendationWrap.innerHTML, /<span class="debt-payoff-summary-label">Debt minimums<\/span><span class="debt-payoff-summary-value">\$500\.00<\/span>/);
assert.match(recommendationWrap.innerHTML, /cannot identify a safe reduction from the saved facts/);
assert.match(recommendationWrap.innerHTML, /Extra debt payments remain \$0\.00 until recurring commitments are covered and the reserve forecast passes/);
assert.doesNotMatch(recommendationWrap.innerHTML, /safe to reduce|adjustable|optional bill/i);
assert.equal((recommendationWrap.innerHTML.match(/Income, commitments, and reserve protection/g) || []).length, 1);
assert.doesNotMatch(recommendationWrap.innerHTML, /Do not pay extra this month/);
assert.doesNotMatch(recommendationWrap.innerHTML, /Supported monthly extra/);
assert.doesNotMatch(recommendationWrap.innerHTML, /debt-payoff-strategy-grid/);
assert.match(recommendationWrap.innerHTML, /<summary>How this was calculated<\/summary>/);
assert.match(recommendationWrap.innerHTML, /<summary>Monthly income and commitments<\/summary>/);
assert.match(recommendationWrap.innerHTML, /Income, commitments, and reserve protection/);
assert.match(recommendationWrap.innerHTML, /Canonical reserve/);
assert.match(recommendationWrap.innerHTML, /not treated as \$0/);
assert.doesNotMatch(recommendationWrap.innerHTML, /The cash-safety check covers three months/);
assert.doesNotMatch(recommendationWrap.innerHTML, /not a payment and is not saved/);
assert.doesNotMatch(recommendationWrap.innerHTML, /debt-payoff-nested-details[^>]*\sopen/);

uiContext.renderDebtPayoffMonthlyRecommendation_({
  state: 'WITHHELD',
  code: 'NO_SURPLUS',
  reason: 'Recurring commitments exceed recurring income after required bills, known debt minimums, and standing floors, so no monthly extra remains.',
  monthlyExtra: 0,
  comparison: null,
  nextDollar: {
    state: 'WITHHELD',
    actionKey: 'KEEP_CASH',
    actionTitle: 'Keep the money in cash',
    amount: 0,
    why: 'Recurring commitments leave no surplus after required bills.',
    liquidity: '',
    outcome: '',
    remainingAboveReserve: 35133.46,
    oneTimeAllocationEvaluated: true,
    alternatives: [],
    horizonLabel: '3-month cash-safety forecast (aligned with This Week’s 90-day reserve)',
    reconciliation: displayedRecon
  },
  oneTimeAllocation: {
    state: 'EVALUATED',
    code: 'BASELINE_RESERVE_BREACH',
    evaluated: true,
    amount: 0,
    actionKey: 'NONE',
    actionTitle: 'No one-time extra is labeled safe',
    why: 'Even with no one-time extra, usable cash would fall below the protected reserve of $1,805.38 in 2027-04 as the monthly deficit of $11,233.45 continues. No lump payment is labeled safe. A recurring surplus, lower commitments, or additional confirmed income is needed. Optional Cisco bonuses are not assumed.',
    baselineBreachMonthKey: '2027-04',
    baselineBreachObligation: 'required payments and the protected reserve',
    threeMonthAmount: 35133.46,
    cashYieldKnown: false,
    cashYieldStatus: 'CASH_YIELD_DATA_REQUIRED',
    ranked: false,
    keepCash: null,
    payHighApr: null,
    assumptions: [
      'If even $0 extra would fall below the reserve in a later month, no lump is labeled safe.'
    ],
    missingAssumptions: [{
      code: 'CASH_YIELD_DATA_REQUIRED',
      reason: 'Cash accounts do not yet store an authoritative APY for this comparison.'
    }]
  },
  protection: {
    surplusBeforeReserve: -11233.45,
    requiredReserveAmount: 41252.04,
    usableCashAfterBuffers: 110139.19,
    deficit: true,
    remainingAboveReserve: 35133.46,
    cashSafetyReconciliation: displayedRecon
  }
}, {
  available: true,
  amount: 0,
  deficit: true,
  usableCashAfterBuffers: 110139.19,
  requiredReserveAmount: 41252.04,
  recurringSurplusBeforeReserve: -11233.45,
  cashSafety: {
    horizonLabel: '3-month cash-safety forecast (aligned with This Week’s 90-day reserve)',
    remainingAboveReserve: 35133.46,
    oneTimeAllocationEvaluated: true,
    oneTimeAmount: 0,
    oneTimeBaselineSafe: false,
    oneTimeBaselineBreachMonthKey: '2027-04',
    oneTimeThreeMonthAmount: 35133.46,
    reconciliation: displayedRecon,
    reason: 'After the 3-month cash-safety forecast, ending cash is $36,938.84, remaining protected reserve is $1,805.38, and $35,133.46 remains above that reserve.'
  }
});
const zeroExtraHtml = recommendationWrap.innerHTML;
assert.match(zeroExtraHtml, /No recurring extra this month/);
assert.equal((zeroExtraHtml.match(/No recurring extra this month/g) || []).length, 1);
assert.doesNotMatch(zeroExtraHtml, /not recommended as a one-time extra payment/);
assert.doesNotMatch(zeroExtraHtml, /<summary>No recurring extra to compare<\/summary>/);
assert.doesNotMatch(zeroExtraHtml, /One-time use of cash above the reserve is not evaluated here/);
assert.doesNotMatch(zeroExtraHtml, /Projected; one-time use is not evaluated/);
assert.match(zeroExtraHtml, /One-time extra from cash above reserve/);
assert.match(zeroExtraHtml, /No one-time extra is labeled safe/);
assert.match(zeroExtraHtml, /Monthly gap to break even: \$11,233\.45/);
assert.match(zeroExtraHtml, /cannot identify a safe reduction from the saved facts/);
assert.match(zeroExtraHtml, /Extra debt payments remain \$0\.00 until recurring commitments are covered and the reserve forecast passes/);
assert.doesNotMatch(zeroExtraHtml, /safe to reduce|adjustable|optional bill/i);
assert.match(zeroExtraHtml, /Shortfall month: 2027-04/);
assert.match(zeroExtraHtml, /as the monthly deficit of \$11,233\.45 continues/);
assert.doesNotMatch(zeroExtraHtml, /required payments and the protected reserve is due/);
assert.doesNotMatch(zeroExtraHtml, /Obligation: required payments and the protected reserve/);
assert.doesNotMatch(zeroExtraHtml, /\$\-11/);
assert.match(zeroExtraHtml, /\$35,133\.46/);
assert.doesNotMatch(zeroExtraHtml, /Cash versus high-APR debt is not ranked/);
assert.doesNotMatch(zeroExtraHtml, /If paid to high-APR debt/);
assert.doesNotMatch(zeroExtraHtml, /If kept in cash/);
assert.match(zeroExtraHtml, /separate from this month’s extra-payoff recommendation/);
assert.doesNotMatch(zeroExtraHtml, /id="debt_payoff_scenario_extra"/);
assert.match(zeroExtraHtml, /<summary>One-time extra assumptions<\/summary>/);
assert.doesNotMatch(zeroExtraHtml, /debt-payoff-one-time[\s\S]*\sopen/);
assert.match(zeroExtraHtml, /Projected cash after three months/);
assert.match(zeroExtraHtml, /Protected reserve/);
assert.match(zeroExtraHtml, /Above reserve at month 3 — not safe to spend/);
assert.doesNotMatch(zeroExtraHtml, /Projected cash above reserve/);
assert.match(zeroExtraHtml,
  /<div class="debt-payoff-cash-summary-item">[\s\S]*?<span class="debt-payoff-summary-label">Projected cash after three months<\/span><span class="debt-payoff-summary-value">[\s\S]*?<div class="debt-payoff-cash-summary-item">[\s\S]*?<span class="debt-payoff-summary-label">Protected reserve<\/span><span class="debt-payoff-summary-value">[\s\S]*?<div class="debt-payoff-cash-summary-item[\s\S]*?<span class="debt-payoff-summary-label">Above reserve at month 3 — not safe to spend<\/span><span class="debt-payoff-summary-value">/);
assert.match(zeroExtraHtml,
  /<details class="debt-payoff-details"><summary>How this was calculated<\/summary>/);
assert.doesNotMatch(zeroExtraHtml, /<details class="debt-payoff-details"[^>]*\sopen/);
assert.doesNotMatch(zeroExtraHtml, /Amount above reserve/);
assert.doesNotMatch(zeroExtraHtml, /Available after the three-month check/);
assert.doesNotMatch(zeroExtraHtml, /debt-payoff-tone-available/);
assert.match(zeroExtraHtml, /debt-payoff-tone-deficit/);
assert.match(zeroExtraHtml, />Deficit</);
assert.match(zeroExtraHtml, /<summary>How this was calculated<\/summary>/);
assert.match(zeroExtraHtml, /<summary>Monthly income and commitments<\/summary>/);
assert.match(zeroExtraHtml, /<summary>Upcoming expenses<\/summary>/);
assert.doesNotMatch(zeroExtraHtml, /debt-payoff-nested-details[^>]*\sopen/);
assert.match(zeroExtraHtml, /These 5 Planned rows total \$39,500\.00 and are included in the canonical reserve/);
assert.match(zeroExtraHtml, /Cash Flow → Upcoming in this window/);
assert.match(zeroExtraHtml, /Home insurance/);
assert.match(zeroExtraHtml, /Tuition/);
assert.match(zeroExtraHtml, /Property tax/);
assert.match(zeroExtraHtml, /HOA special/);
assert.match(zeroExtraHtml, /Medical/);
assert.doesNotMatch(zeroExtraHtml, /Near-term fee/);
assert.match(zeroExtraHtml, /not identified as a specific Upcoming row/);
assert.match(zeroExtraHtml, /\$39,500\.00/);
assert.match(zeroExtraHtml, /\$36,938\.84/);
assert.match(zeroExtraHtml, /\$1,805\.38/);
assert.match(zeroExtraHtml, /\$35,133\.46/);
assert.doesNotMatch(zeroExtraHtml, /<strong>Horizon:<\/strong>/);
assert.doesNotMatch(zeroExtraHtml, /<strong>Liquidity:<\/strong>/);
assert.doesNotMatch(zeroExtraHtml, /<strong>Estimated outcome:<\/strong>/);
assert.doesNotMatch(zeroExtraHtml, /<summary>Compare other uses of this extra<\/summary>/);
assert.doesNotMatch(zeroExtraHtml, /already use available cash/);
assert.doesNotMatch(zeroExtraHtml, /<summary>Compare other uses of this extra<\/summary>[\s\S]*Pay high-APR debt/);
assert.doesNotMatch(zeroExtraHtml, /The cash-safety check covers three months/);
assert.match(zeroExtraHtml, /class="debt-payoff-one-time"[\s\S]*not a payment and is not saved/);
assert.doesNotMatch(zeroExtraHtml.replace(/<section class="debt-payoff-one-time"[\s\S]*?<\/section>/, ''),
  /not a payment and is not saved/);
assert.equal((zeroExtraHtml.match(/Unknown values are not treated as \$0/g) || []).length, 1);

uiContext.renderDebtPayoffMonthlyRecommendation_({
  state: 'WITHHELD',
  code: 'FACTS_MISSING',
  reason: 'A required variable bill lacks complete YTD history.',
  monthlyExtra: null,
  comparison: null
}, {
  available: false,
  amount: null,
  blockers: [{
    code: 'VARIABLE_BILL_HISTORY_INCOMPLETE',
    reason: 'PG&E is missing a completed-month Cash Flow amount.',
    incompleteRows: [{
      payee: 'Salary',
      sheetRow: 12,
      missing: ['Expected Amount']
    }]
  }]
});
assert.match(recommendationWrap.innerHTML, /<strong>—<\/strong>/);
assert.doesNotMatch(recommendationWrap.innerHTML, /debt-payoff-recommendation-amount[\s\S]*\$0\.00/);
assert.match(recommendationWrap.innerHTML, /A monthly extra cannot be recommended/);
assert.match(recommendationWrap.innerHTML, /The monthly gap to break even cannot be proven from the saved facts/);
assert.doesNotMatch(recommendationWrap.innerHTML, /Monthly gap to break even: \$/);
assert.match(recommendationWrap.innerHTML, /cannot identify a safe reduction from the saved facts/);
assert.doesNotMatch(recommendationWrap.innerHTML, /safe to reduce|adjustable|optional bill/i);
assert.match(recommendationWrap.innerHTML, /PG&amp;E is missing a completed-month Cash Flow amount/);
assert.match(recommendationWrap.innerHTML, /Salary[\s\S]*Expected Amount/);
assert.match(recommendationWrap.innerHTML, /How this was calculated/);
assert.match(recommendationWrap.innerHTML, /Unknown data/);
assert.match(recommendationWrap.innerHTML, /not treated as \$0/);
assert.doesNotMatch(recommendationWrap.innerHTML, /Do not pay extra this month/);
assert.doesNotMatch(recommendationWrap.innerHTML, /debt-payoff-strategy-grid/);

uiContext.renderDebtPayoffMonthlyRecommendation_({
  state: 'WITHHELD',
  code: 'FUTURE_RESERVE_BREACH',
  reason: 'No recurring extra is recommended because even $0.00 extra would leave usable cash below This Week’s $1000.00 canonical reserve in 2026-12, when Insurance ($12000.00) is due.',
  monthlyExtra: 0,
  comparison: null,
  protection: {
    surplusBeforeReserve: 2500,
    requiredReserveAmount: 1000,
    usableCashAfterBuffers: 5000,
    futureReserveProtects: true,
    cashSafetyHorizonMonths: 3,
    cashSafetyHorizonLabel: '3-month cash-safety forecast (aligned with This Week’s 90-day reserve)',
    cashSafetyReason: 'No recurring extra is recommended because even $0.00 extra would leave usable cash below This Week’s $1000.00 canonical reserve in 2026-12, when Insurance ($12000.00) is due.',
    cashSafetyBreachMonthKey: '2026-12',
    cashSafetyBreachObligation: 'Insurance ($12000.00)'
  }
}, {
  available: true,
  amount: 0,
  futureReserveProtects: true,
  recurringSurplusBeforeReserve: 2500,
  requiredReserveAmount: 1000,
  usableCashAfterBuffers: 5000,
  cashSafety: {
    horizonMonths: 3,
    horizonLabel: '3-month cash-safety forecast (aligned with This Week’s 90-day reserve)',
    reduced: false,
    withheld: true,
    reason: 'No recurring extra is recommended because even $0.00 extra would leave usable cash below This Week’s $1000.00 canonical reserve in 2026-12, when Insurance ($12000.00) is due.',
    breachMonthKey: '2026-12',
    breachObligation: 'Insurance ($12000.00)',
    outsideHorizon: [{
      name: 'After-horizon tuition',
      dueDate: '2027-02-01',
      amountKnown: true,
      amount: 8000
    }]
  }
});
assert.match(recommendationWrap.innerHTML, /No recurring extra this month/);
assert.doesNotMatch(recommendationWrap.innerHTML, /Monthly gap to break even/);
assert.match(recommendationWrap.innerHTML, /2026-12/);
assert.match(recommendationWrap.innerHTML, /Insurance \(\$12000\.00\)/);
assert.doesNotMatch(recommendationWrap.innerHTML, /The cash-safety check covers three months/);
assert.match(recommendationWrap.innerHTML, /<summary>Upcoming expenses<\/summary>/);
assert.match(recommendationWrap.innerHTML, /Reserve breach/);
assert.match(recommendationWrap.innerHTML, /Shortfall month: 2026-12/);
assert.match(recommendationWrap.innerHTML, /Outside this 3-month check: After-horizon tuition \(due 2027-02-01/);
assert.doesNotMatch(recommendationWrap.innerHTML, /debt-payoff-strategy-grid/);

uiContext.renderDebtPayoffMonthlyRecommendation_({
  state: 'RECOMMENDED',
  strategyKey: 'avalanche',
  strategyTitle: 'Avalanche (highest APR first)',
  why: 'Avalanche applies the estimated monthly extra to the highest-APR debt first.',
  monthlyExtra: 250,
  firstExtraDebt: 'High APR Card',
  nextMilestone: { name: 'High APR Card', monthKey: '2027-08', monthIndex: 11 },
  debtFreeMonthKey: '2027-08',
  debtFreeWithinHorizon: true,
  totalInterest: 500,
  extraIsAffordable: null,
  bonusesIncluded: false,
  protection: {
    recurringIncomeMonthly: 4000,
    recurringBillsMonthly: 1000,
    debtMinimumsMonthly: 500,
    surplusBeforeReserve: 2500,
    requiredReserveAmount: 1000,
    usableCashAfterBuffers: 5000
  },
  comparison: {
    recommendedStrategyKey: 'avalanche',
    baselineLabel: 'Minimum payments only',
    assumptions: ['Minimums stay at the current recorded amount.'],
    scenarioBonuses: { included: false, events: [] },
    strategies: {
      minimum_only: {
        strategy: 'minimum_only',
        debtFreeWithinHorizon: true,
        debtFreeMonthKey: '2028-03',
        debtFreeMonthIndex: 18,
        totalInterest: 900,
        interestVsBaselineLabel: 'Same interest as baseline.',
        monthlyExtra: 250,
        payoffOrder: [{ name: 'High APR Card', monthKey: '2028-03', monthIndex: 18 }],
        extraPriorityOrder: []
      },
      avalanche: {
        strategy: 'avalanche',
        debtFreeWithinHorizon: true,
        debtFreeMonthKey: '2027-08',
        debtFreeMonthIndex: 11,
        totalInterest: 500,
        interestVsBaselineLabel: '$400.00 less interest than baseline.',
        monthlyExtra: 250,
        payoffOrder: [{ name: 'High APR Card', monthKey: '2027-08', monthIndex: 11 }],
        extraPriorityOrder: ['High APR Card']
      },
      snowball: {
        strategy: 'snowball',
        debtFreeWithinHorizon: true,
        debtFreeMonthKey: '2027-09',
        debtFreeMonthIndex: 12,
        totalInterest: 980,
        interestVsBaselineLabel: '$80.00 more interest than baseline.',
        monthlyExtra: 250,
        payoffOrder: [{ name: 'Low APR Card', monthKey: '2027-09', monthIndex: 12 }],
        extraPriorityOrder: ['Low APR Card']
      }
    }
  }
}, supportedExtraUi);
const recommendationHtml = recommendationWrap.innerHTML;
assert.match(recommendationHtml, /<strong>\$250\.00<\/strong>/);
assert.match(recommendationHtml, /Pay an extra \$250\.00 this month using Avalanche/);
assert.doesNotMatch(recommendationHtml, /Monthly gap to break even/);
assert.doesNotMatch(recommendationHtml, /cannot identify a safe reduction/);
assert.doesNotMatch(recommendationHtml, /Supported monthly extra/);
assert.doesNotMatch(recommendationHtml, /Use this amount in a what-if/);
assert.doesNotMatch(recommendationHtml, /<button/);
assert.doesNotMatch(recommendationHtml, /optional hypothetical scenario/);
assert.match(recommendationHtml, /<details class="debt-payoff-details">[\s\S]*<summary>How this was calculated<\/summary>/);
assert.match(recommendationHtml, /<summary>Monthly income and commitments<\/summary>/);
assert.match(recommendationHtml, /<summary>Variable bills<\/summary>/);
assert.doesNotMatch(recommendationHtml, /debt-payoff-nested-details[^>]*\sopen/);
assert.doesNotMatch(recommendationHtml, /not a guarantee of affordability/);
assert.match(recommendationHtml, /not treated as \$0/);
assert.match(recommendationHtml, /Income, commitments, and reserve protection/);
assert.match(recommendationHtml, /YTD window: 2026-01 through 2026-09/);
assert.equal((recommendationHtml.match(/Variable bills marked Varies use a YTD running average/g) || []).length, 1);
assert.doesNotMatch(recommendationHtml, /Annual or seasonal costs can make this average swing/);
assert.match(recommendationHtml, /<th scope="col">Bill<\/th>[\s\S]*<th scope="col">YTD total<\/th>[\s\S]*<th scope="col">Months<\/th>[\s\S]*<th scope="col">Monthly average<\/th>/);
assert.match(recommendationHtml, /PG&amp;E[\s\S]*\$1,200\.00[\s\S]*9[\s\S]*\$133\.33/);
assert.match(recommendationHtml, /debt-payoff-strategy-card--recommended/);
assert.match(recommendationHtml, /High APR Card/);
uiContext.renderDebtPayoffMonthlyRecommendation_({
  state: 'RECOMMENDED',
  strategyKey: 'avalanche',
  strategyTitle: 'Avalanche (highest APR first)',
  monthlyExtra: 250,
  nextDollar: {
    state: 'RECOMMENDED',
    actionKey: 'PAY_HIGH_APR_DEBT',
    actionTitle: 'Pay high-APR debt',
    amount: 250,
    firstTarget: 'High APR Card',
    why: 'Avalanche applies this extra to the highest-APR non-mortgage debt first.',
    liquidity: 'The extra leaves cash and is not kept as a reserve.',
    outcome: 'Modeled interest is $400.00 less interest than baseline.',
    horizonLabel: '600-month payoff forecast',
    alternatives: [{
      key: 'PAY_HIGH_APR_DEBT',
      title: 'Pay high-APR debt',
      status: 'READY',
      why: 'Highest-APR extra reduces modeled interest.',
      liquidity: 'The extra leaves cash.',
      outcome: 'Modeled interest savings.'
    }, {
      key: 'KEEP_CASH',
      title: 'Keep the money in cash',
      status: 'READY',
      why: 'Cash yield is not modeled.',
      liquidity: 'The extra stays available as cash.',
      outcome: 'No growth is modeled (CASH_YIELD_DATA_REQUIRED).'
    }, {
      key: 'PAY_MORTGAGE',
      title: 'Pay extra toward a mortgage',
      status: 'NOT_APPLICABLE',
      why: 'No mortgage was identified.',
      location: 'Assets & Liabilities → Debt accounts'
    }, {
      key: 'INVEST',
      title: 'Invest',
      status: 'CONDITIONAL',
      missingAssumption: 'Expected Annual Return % is missing or blank.',
      location: 'Planning → Retirement'
    }],
    assumptions: ['Cash APY is not invented.'],
    missingAssumptions: [{ reason: 'Cash accounts do not yet store an authoritative APY for this comparison.' }]
  },
  comparison: {
    recommendedStrategyKey: 'avalanche',
    assumptions: ['Minimums stay at the current recorded amount.'],
    strategies: {
      minimum_only: {
        strategy: 'minimum_only',
        debtFreeWithinHorizon: true,
        debtFreeMonthKey: '2028-03',
        totalInterest: 900,
        interestVsBaselineLabel: 'Same interest as baseline.',
        monthlyExtra: 250,
        payoffOrder: [],
        extraPriorityOrder: []
      },
      avalanche: {
        strategy: 'avalanche',
        debtFreeWithinHorizon: true,
        debtFreeMonthKey: '2027-08',
        totalInterest: 500,
        interestVsBaselineLabel: '$400.00 less interest than baseline.',
        monthlyExtra: 250,
        payoffOrder: [{ name: 'High APR Card', monthKey: '2027-08' }],
        extraPriorityOrder: ['High APR Card']
      },
      snowball: {
        strategy: 'snowball',
        debtFreeWithinHorizon: true,
        debtFreeMonthKey: '2027-09',
        totalInterest: 980,
        interestVsBaselineLabel: '$80.00 more interest than baseline.',
        monthlyExtra: 250,
        payoffOrder: [],
        extraPriorityOrder: []
      }
    }
  }
}, supportedExtraUi);
const nextDollarHtml = recommendationWrap.innerHTML;
assert.match(nextDollarHtml, /Use the extra to pay high-APR debt this month using Avalanche/);
assert.match(nextDollarHtml, /<strong>Liquidity:<\/strong>/);
assert.match(nextDollarHtml, /<strong>Estimated outcome:<\/strong>/);
assert.match(nextDollarHtml, /Horizon: 600-month payoff forecast/);
assert.match(nextDollarHtml, /<summary>Compare other uses of this extra<\/summary>/);
assert.match(nextDollarHtml, /Keep the money in cash/);
assert.match(nextDollarHtml, /CASH_YIELD_DATA_REQUIRED/);
assert.match(nextDollarHtml, /Planning → Retirement/);
assert.match(nextDollarHtml, /<summary>Avalanche, snowball, and minimum-only details<\/summary>/);
assert.doesNotMatch(nextDollarHtml, /id="planning_tool_/);
assert.doesNotMatch(recommendationHtml, /Annualized monthly equivalent/);
assert.doesNotMatch(recommendationHtml, /Cisco annual bonuses/);
assert.doesNotMatch(recommendationHtml, /Three identical \$0-extra/);

uiContext.renderDebtPayoffScenarioBonusForm_({
  payments: [
    { name: 'Cisco Mid Year Bonus', known: true, amount: 12000, included: true },
    { name: 'Cisco End Year Bonus', known: true, amount: 4500, included: true }
  ],
  reviewReasons: [],
  annualizedMonthlyEquivalent: 1375,
  countedInRecurringIncomeMonthly: false,
  countedInReserve: false
});
const bonusHtml = bonusRowsWrap.innerHTML;
assert.match(bonusHtml, /data-bonus-include/);
assert.match(bonusHtml, /data-bonus-month/);
assert.match(bonusHtml, /data-bonus-year/);
assert.match(bonusHtml, /data-bonus-repeat value="once"/);
assert.match(bonusHtml, /data-bonus-repeat value="annual"/);
assert.match(bonusHtml, /\$12,000\.00[\s\S]*per year/);
assert.doesNotMatch(bonusHtml, /Annualized monthly equivalent/);
assert.doesNotMatch(bonusHtml, /not recurring monthly income|not cash available each month|90-day cash reserve/);

uiContext.renderDebtPayoffStrategyComparison_({
  householdComparisonComplete: true,
  baselineLabel: 'Minimum payments only',
  blockers: [],
  assumptions: ['Minimums stay at the current recorded amount for the forecast.'],
  scenarioBonuses: {
    included: true,
    events: [{
      name: 'Cisco Mid Year Bonus',
      monthKey: '2026-10',
      amount: 12000,
      repeat: 'once'
    }]
  },
  strategies: {
    minimum_only: {
      strategy: 'minimum_only',
      debtFreeWithinHorizon: true,
      debtFreeMonthKey: '2028-03',
      debtFreeMonthIndex: 18,
      totalInterest: 900,
      interestVsBaselineLabel: 'Same interest as baseline.',
      monthlyExtra: 0,
      payoffOrder: [{ name: 'Card', monthKey: '2028-03', monthIndex: 18 }],
      extraPriorityOrder: []
    },
    avalanche: {
      strategy: 'avalanche',
      debtFreeWithinHorizon: true,
      debtFreeMonthKey: '2027-08',
      debtFreeMonthIndex: 11,
      totalInterest: 500,
      interestVsBaselineLabel: '$400.00 less interest than baseline.',
      monthlyExtra: 250,
      payoffOrder: [{ name: 'Card', monthKey: '2027-08', monthIndex: 11 }],
      extraPriorityOrder: ['Card']
    },
    snowball: {
      strategy: 'snowball',
      debtFreeWithinHorizon: true,
      debtFreeMonthKey: '2027-09',
      debtFreeMonthIndex: 12,
      totalInterest: 980,
      interestVsBaselineLabel: '$80.00 more interest than baseline.',
      monthlyExtra: 250,
      payoffOrder: [{ name: 'Card', monthKey: '2027-09', monthIndex: 12 }],
      extraPriorityOrder: ['Card']
    }
  }
});
const resultsHtml = resultsWrap.innerHTML;
assert.match(resultsHtml, /<dt>Debt-free<\/dt>/);
assert.match(resultsHtml, /<dt>Total interest<\/dt>/);
assert.match(resultsHtml, /<dt>vs baseline<\/dt>/);
assert.ok(
  resultsHtml.indexOf('<dt>Debt-free</dt>') < resultsHtml.indexOf('Payoff order and allocation'),
  'debt-free month, interest, and signed difference must sit above collapsed payoff details'
);
assert.match(resultsHtml, /<summary>Payoff order and allocation<\/summary>/);
assert.match(resultsHtml, /<details class="debt-payoff-details debt-payoff-strategy-assumptions">[\s\S]*<summary>Calculation assumptions<\/summary>/);
assert.match(resultsHtml, /Selected bonus events/);
assert.doesNotMatch(resultsHtml, /Avalanche applies monthly extra and bonus payments highest APR first/);
assert.doesNotMatch(resultsHtml, /Annualized monthly equivalent/);
assert.doesNotMatch(resultsHtml, /aria-hidden="true"/);

const styles = fs.readFileSync(new URL('../Dashboard_Styles.html', import.meta.url), 'utf8');
assert.match(styles, /\.debt-payoff-recommendation-amount[\s\S]*font-size:\s*1\.35rem/);
assert.match(styles, /\.debt-payoff-details\s*>\s*summary[\s\S]*cursor:\s*pointer/);
assert.match(styles, /@media \(max-width: 900px\)[\s\S]*\.debt-payoff-strategy-grid[\s\S]*minmax\(0,\s*1fr\)/);
assert.match(styles, /\.debt-payoff-tone-deficit[\s\S]*#9a3412/);
assert.match(styles, /\.debt-payoff-tone-unknown[\s\S]*#92400e/);
assert.match(styles, /\.debt-payoff-tone-available[\s\S]*#166534/);
assert.match(styles, /\.debt-payoff-summary-value[\s\S]*#0f172a/);
assert.match(styles, /\.debt-payoff-cash-summary[\s\S]*repeat\(3,\s*minmax\(12rem,\s*1fr\)\)[\s\S]*gap:\s*12px/);
assert.match(styles, /\.debt-payoff-cash-summary-item[\s\S]*flex-direction:\s*column[\s\S]*gap:\s*8px[\s\S]*padding:\s*12px 14px/);
assert.match(styles, /\.debt-payoff-summary-label[\s\S]*font-size:\s*13px[\s\S]*line-height:\s*1\.35/);
assert.match(styles, /\.debt-payoff-summary-value[\s\S]*font-size:\s*1\.25rem/);
assert.match(styles, /@media \(max-width: 900px\)[\s\S]*\.debt-payoff-cash-summary[\s\S]*grid-template-columns:\s*1fr/);

console.log('checkDebtPayoffStrategyComparisonRegressions: ok');
