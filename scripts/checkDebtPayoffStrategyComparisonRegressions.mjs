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
  /id="debt_payoff_strategy_wrap"[\s\S]*?This month’s action/,
  'the monthly recommendation belongs inside Debt Overview');
assert.doesNotMatch(debtOverview, /Household strategy comparison/);
assert.match(debtOverview,
  /related-view-nav[\s\S]*id="debt_payoff_strategy_wrap"[\s\S]*id="debt_payoff_recommendation"[\s\S]*id="debt_payoff_household_wrap"[\s\S]*Debt balances and payoff estimates[\s\S]*id="debt_payoff_read_summary"[\s\S]*id="debt_payoff_read_chart_wrap"[\s\S]*id="debt_payoff_read_table_wrap"[\s\S]*id="debt_payoff_calc_wrap"/,
  'the monthly recommendation must appear before the debt chart and account table');
assert.match(debtOverview,
  /<details class="debt-payoff-details debt-payoff-position">[\s\S]*<summary[^>]*>Debt balances and payoff estimates<\/summary>/);
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
assert.match(sliceFunction(client, 'renderDebtPayoffComparisonTableHtml_'),
  /debtPayoffStrategyTitle_\(key, options\.data\)/);
assert.match(sliceFunction(client, 'renderDebtPayoffComparisonTableHtml_'),
  /formatDebtPayoffInterestVsBaseline_\(row\)/);
assert.doesNotMatch(sliceFunction(client, 'renderDebtPayoffComparisonTableHtml_'),
  /fmtCurrency\(row\.interestSavedVsMinimumOnly\)/);
assert.match(sliceFunction(client, 'renderDebtPayoffStrategyCard_'),
  /renderDebtPayoffComparisonTableHtml_/);
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
assert.match(help, /monthly shortfall/);
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
assert.match(projection, /function debtPayoffClassifySavedDebtType_/);
assert.match(projection, /function collectDebtPayoffSupportedMinimums_/);
assert.doesNotMatch(sliceFunction(projection, 'debtPayoffClassifySavedDebtType_'),
  /debt\.name|originalName/);
assert.doesNotMatch(sliceFunction(projection, 'simulateDebtPayoffSchedule_'),
  /\.minimumPayment\s*=/);
assert.match(client, /function renderDebtPayoffBreakEvenHtml_/);
assert.match(client, /function renderDebtPayoffDebtMinimumDetailsHtml_/);
assert.match(sliceFunction(client, 'renderDebtPayoffCalculationDetailsHtml_'),
  /Debt minimums by account/);
assert.match(help, /split by saved Type into Credit Cards, HELOC, Loans\/Mortgages, and Other\/Unknown/);
assert.match(help, /not estimated as a percentage of a declining balance/);
assert.match(help, /recast or refinance/);
assert.match(sliceFunction(client, 'renderDebtPayoffMonthlyRecommendation_'),
  /renderDebtPayoffBreakEvenHtml_/);
assert.doesNotMatch(sliceFunction(client, 'renderDebtPayoffBreakEvenHtml_'),
  /optional|adjustable|safe to reduce/i);
assert.doesNotMatch(sliceFunction(client, 'renderDebtPayoffWhyExtraStaysHtml_'),
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
assert.match(client, /<th scope="col" class="debt-payoff-num">YTD total<\/th>/);
assert.match(client, /<th scope="col" class="debt-payoff-num">Months<\/th>/);
assert.match(client, /<th scope="col" class="debt-payoff-num">Monthly average/);
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
assert.match(client, /<th scope="col">Debt-free<\/th>/);
assert.match(client, /<th scope="col" class="debt-payoff-num">Total interest<\/th>/);
assert.match(client, /<th scope="col" class="debt-payoff-num">vs baseline<\/th>/);
assert.match(client, /function renderDebtPayoffComparisonTableHtml_/);
assert.match(client, /<summary>Payment releases and payoff order<\/summary>/);
assert.match(client, /<summary>View income sources<\/summary>/);
assert.match(client, /<summary>View household bills<\/summary>/);
assert.match(client, /<summary>View debt accounts<\/summary>/);
assert.match(client, /<summary>View investment sources<\/summary>/);
assert.match(client, /Monthly cash picture/);
assert.match(client, /\$0 extra this month/);
assert.match(client, /Lowest modeled interest/);
assert.match(client, /Conditional lowest-interest scenario/);
assert.match(client, /Not affordable or recommended for this month under current facts/);
assert.match(client, /Other modeled strategies/);
assert.match(client, /function debtPayoffLowestModeledInterestKey_/);
assert.match(client, /function debtPayoffCashPictureIsVisible_/);
assert.match(client, /function debtPayoffCashPictureExclusiveOpen_/);
assert.match(sliceFunction(client, 'debtPayoffCashPictureExclusiveOpen_'), /other\.open = false/);
assert.doesNotMatch(client, /<summary>View details<\/summary>/);
assert.match(client, /<summary>Why extra stays \$0\.00<\/summary>/);
assert.match(client, /<td colspan="4">/);
assert.doesNotMatch(client, /<th scope="col">Details<\/th>/);
assert.match(debtOverview, /debt-payoff-panel-title-row[\s\S]*class="small-btn"[\s\S]*loadDebtPayoffReadSection\(\)/);
assert.match(debtOverview, /aria-label="Refresh Debt Overview"/);
assert.doesNotMatch(debtOverview, /<div class="panel-head">[\s\S]*onclick="loadDebtPayoffReadSection\(\)">Refresh<\/button>/);
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

assert.match(help, /recommendation can appear before the payoff chart/);
assert.match(help, /does not reuse a stored snapshot/);
assert.match(client, /function failDebtPayoffReadLoad_/);
assert.match(client, /function loadDebtPayoffPositionSection_/);
assert.match(sliceFunction(client, 'loadDebtPayoffReadSection'),
  /requestId !== __debtPayoffReadRequestId_/);
assert.match(sliceFunction(client, 'loadDebtPayoffReadSection'),
  /getDebtPayoffRecommendationData\(\)/);
assert.match(sliceFunction(client, 'loadDebtPayoffReadSection'),
  /loadDebtPayoffPositionSection_\(requestId\)/);
assert.doesNotMatch(sliceFunction(client, 'loadDebtPayoffReadSection'),
  /getDebtPayoffReadData\(\)/);
assert.match(sliceFunction(client, 'loadDebtPayoffPositionSection_'),
  /getDebtPayoffPositionData\(\)/);
assert.match(sliceFunction(client, 'loadDebtPayoffPositionSection_'),
  /Payoff data could not be loaded/);
assert.match(sliceFunction(client, 'failDebtPayoffReadLoad_'),
  /setStatus\(\s*'debt_payoff_read_status'[\s\S]*true\s*\)/);
assert.doesNotMatch(sliceFunction(client, 'failDebtPayoffReadLoad_'),
  /Loading payoff data/);
assert.doesNotMatch(sliceFunction(projection, 'getDebtPayoffRecommendationData'),
  /sumExpensePaymentsForDebtPayees_|cash_flow_paid/);
assert.match(sliceFunction(projection, 'getDebtPayoffRecommendationData'),
  /debt_payoff\.recommendation/);
assert.match(sliceFunction(projection, 'getDebtPayoffPositionData'),
  /debt_payoff\.position/);
assert.match(sliceFunction(projection, 'buildDebtPayoffPositionFromFacts_'),
  /sumExpensePaymentsForDebtPayees_/);
assert.match(sliceFunction(projection, 'buildDebtPayoffPositionFromFacts_'),
  /estimateDebtPayoffPositionMonths_/);
assert.match(sliceFunction(projection, 'estimateDebtPayoffPositionMonths_'),
  /debtPayoffContractualPrincipalPayment_/);
assert.match(sliceFunction(projection, 'estimateDebtPayoffPositionMonths_'),
  /debtPayoffModeledPayoffMonths_/);
assert.match(sliceFunction(projection, 'estimateDebtPayoffPositionMonths_'),
  /estimateRoughPayoffMonths_/);
assert.match(sliceFunction(client, 'formatPayoffMonths_'), /Incomplete/);
assert.match(client, /Property loans: months use principal-and-interest only/);
assert.match(help, /Property-loan payoff months in that summary use principal-and-interest only/);
assert.doesNotMatch(sliceFunction(projection, 'buildDebtPayoffRecommendationFromFacts_'),
  /sumExpensePaymentsForDebtPayees_/);
assert.doesNotMatch(sliceFunction(projection, 'getDebtPayoffRecommendationData'),
  /CacheService|PropertiesService/);
assert.doesNotMatch(sliceFunction(projection, 'getDebtPayoffPositionData'),
  /CacheService|PropertiesService/);
assert.match(sliceFunction(client, 'runDebtPayoffStrategyComparison'),
  /__debtPayoffReadInFlight_/);
assert.match(sliceFunction(client, 'runDebtPayoffStrategyComparison'),
  /requestId !== __debtPayoffStrategyRequestId_/);

const payoffTableWrap = { innerHTML: '' };
const payoffRecWrap = { innerHTML: '' };
const payoffStatusCalls = [];
const payoffRecRenderCalls = [];
const payoffPosRenderCalls = [];
let pendingPayoffSuccess = null;
let pendingPayoffFailure = null;
let recSuccess = null;
let recFailure = null;
let posSuccess = null;
let posFailure = null;
let recRpcCalls = 0;
let posRpcCalls = 0;
const payoffLoadContext = vm.createContext({
  Date, Math, Number, String, Array, Object, JSON, isFinite,
  __debtPayoffReadCache: null,
  __debtPayoffReadRequestId_: 0,
  __debtPayoffStrategyRequestId_: 0,
  __debtPayoffReadInFlight_: false,
  __debtPayoffRecInFlight_: false,
  __debtPayoffPositionInFlight_: false,
  __debtPayoffRecFailed_: false,
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
      if (id === 'debt_payoff_recommendation') return payoffRecWrap;
      if (id === 'debt_payoff_scenario_extra') return { value: '25' };
      return null;
    }
  },
  setStatus: function(id, message, isError) {
    payoffStatusCalls.push({ id: id, message: message, isError: isError });
  },
  loadingIndicatorHtml: function(label) { return 'LOADING:' + label; },
  renderDebtPayoffMonthlyRecommendation_: function(rec, supported) {
    payoffRecRenderCalls.push({ rec: rec, supported: supported });
    payoffRecWrap.innerHTML = 'REC';
  },
  renderDebtPayoffScenarioBonusForm_: function() {},
  renderDebtPayoffPositionData_: function(data) {
    payoffPosRenderCalls.push(data);
    payoffTableWrap.innerHTML = 'TABLE';
  },
  google: {
    script: {
      run: {
        withSuccessHandler: function(handler) {
          pendingPayoffSuccess = handler;
          return this;
        },
        withFailureHandler: function(handler) {
          pendingPayoffFailure = handler;
          return this;
        },
        getDebtPayoffRecommendationData: function() {
          recRpcCalls += 1;
          recSuccess = pendingPayoffSuccess;
          recFailure = pendingPayoffFailure;
        },
        getDebtPayoffPositionData: function() {
          posRpcCalls += 1;
          posSuccess = pendingPayoffSuccess;
          posFailure = pendingPayoffFailure;
        }
      }
    }
  }
});
vm.runInContext(
  sliceFunction(client, 'settleDebtPayoffReadInFlight_') +
  '\n' + sliceFunction(client, 'debtPayoffLoadingHtml_') +
  '\n' + sliceFunction(client, 'failDebtPayoffReadLoad_') +
  '\n' + sliceFunction(client, 'clearDebtPayoffRecommendationSurfaces_') +
  '\n' + sliceFunction(client, 'failDebtPayoffRecommendationLoad_') +
  '\n' + sliceFunction(client, 'loadDebtPayoffReadSection') +
  '\n' + sliceFunction(client, 'loadDebtPayoffPositionSection_'),
  payoffLoadContext
);

payoffLoadContext.loadDebtPayoffReadSection();
assert.match(payoffRecWrap.innerHTML, /LOADING:Loading recommendation…/);
assert.match(payoffTableWrap.innerHTML, /LOADING:Loading payoff data…/);
assert.equal(payoffLoadContext.__debtPayoffReadInFlight_, true);
assert.equal(recRpcCalls, 1);
assert.equal(posRpcCalls, 0, 'position must not start until recommendation settles');
assert.equal(typeof recSuccess, 'function');
assert.equal(typeof recFailure, 'function');

recFailure(new Error('offline'));
assert.equal(payoffRecWrap.innerHTML, '',
  'recommendation failure must clear the recommendation spinner');
assert.match(payoffTableWrap.innerHTML, /LOADING:Loading payoff data…/,
  'recommendation failure must not clear the independent table spinner');
assert.equal(posRpcCalls, 1, 'position still loads after a recommendation failure');
assert.equal(payoffLoadContext.__debtPayoffReadInFlight_, true);
assert.equal(payoffStatusCalls.some(function(row) {
  return row.id === 'debt_payoff_read_status' && row.isError === true && /offline/.test(row.message);
}), true, 'recommendation failure must report a visible error');
assert.equal(payoffRecRenderCalls.length, 0);
assert.equal(payoffPosRenderCalls.length, 0);
posFailure(new Error('offline'));
assert.equal(payoffTableWrap.innerHTML, '',
  'position failure must clear the payoff loading spinner');
assert.equal(payoffLoadContext.__debtPayoffReadInFlight_, false);

payoffStatusCalls.length = 0;
payoffRecRenderCalls.length = 0;
payoffPosRenderCalls.length = 0;
payoffLoadContext.loadDebtPayoffReadSection();
assert.match(payoffTableWrap.innerHTML, /LOADING:Loading payoff data…/);
recSuccess({
  monthlyRecommendation: { state: 'RECOMMENDED', monthlyExtra: 50 },
  supportedMonthlyExtra: { available: true, amount: 50 }
});
assert.equal(payoffRecRenderCalls.length, 1);
assert.equal(payoffRecWrap.innerHTML, 'REC',
  'recommendation must paint without waiting for position data');
assert.match(payoffTableWrap.innerHTML, /LOADING:Loading payoff data…/,
  'table must stay loading until the independent position request returns');
assert.equal(payoffPosRenderCalls.length, 0);
assert.equal(payoffLoadContext.__debtPayoffReadInFlight_, true);
posSuccess({ debts: [{ name: 'Card' }] });
assert.equal(payoffPosRenderCalls.length, 1);
assert.equal(payoffTableWrap.innerHTML, 'TABLE',
  'position success must replace the loading spinner with payoff data');
assert.equal(payoffLoadContext.__debtPayoffReadInFlight_, false);
assert.equal(payoffStatusCalls.some(function(row) {
  return row.id === 'debt_payoff_read_status' && row.isError === true;
}), false);

payoffStatusCalls.length = 0;
payoffRecRenderCalls.length = 0;
payoffPosRenderCalls.length = 0;
payoffLoadContext.loadDebtPayoffReadSection();
recSuccess(null);
assert.equal(payoffRecRenderCalls.length, 0);
assert.equal(payoffRecWrap.innerHTML, '');
assert.match(payoffTableWrap.innerHTML, /LOADING:Loading payoff data…/);
assert.equal(payoffStatusCalls.some(function(row) {
  return row.isError === true && /Recommendation could not be loaded/.test(row.message);
}), true, 'empty recommendation success must report a visible error');
posSuccess(null);
assert.equal(payoffPosRenderCalls.length, 0);
assert.equal(payoffTableWrap.innerHTML, '',
  'empty position success must not leave Loading payoff data… on screen');
assert.equal(payoffStatusCalls.some(function(row) {
  return row.isError === true && /Payoff data could not be loaded/.test(row.message);
}), true, 'empty position success must report a visible error');

payoffStatusCalls.length = 0;
payoffRecRenderCalls.length = 0;
payoffPosRenderCalls.length = 0;
payoffLoadContext.renderDebtPayoffPositionData_ = function() {
  throw new Error('chart failed');
};
payoffLoadContext.loadDebtPayoffReadSection();
recSuccess({ monthlyRecommendation: { monthlyExtra: 0 }, supportedMonthlyExtra: {} });
assert.equal(payoffRecWrap.innerHTML, 'REC');
posSuccess({ debts: [{ name: 'Card' }] });
assert.equal(payoffTableWrap.innerHTML, '',
  'a thrown position handler must clear the loading spinner');
assert.equal(payoffRecWrap.innerHTML, 'REC',
  'a thrown position handler must keep the already-painted recommendation');
assert.equal(payoffStatusCalls.some(function(row) {
  return row.isError === true && /chart failed/.test(row.message);
}), true, 'a thrown position handler must surface the failure');

const firstReadId = payoffLoadContext.__debtPayoffReadRequestId_;
payoffStatusCalls.length = 0;
payoffRecRenderCalls.length = 0;
payoffPosRenderCalls.length = 0;
payoffLoadContext.renderDebtPayoffPositionData_ = function(data) {
  payoffPosRenderCalls.push(data);
  payoffTableWrap.innerHTML = 'TABLE';
};
payoffLoadContext.loadDebtPayoffReadSection();
const staleRecSuccess = recSuccess;
const staleRecFailure = recFailure;
payoffLoadContext.loadDebtPayoffReadSection();
assert.ok(payoffLoadContext.__debtPayoffReadRequestId_ > firstReadId);
staleRecSuccess({ monthlyRecommendation: { monthlyExtra: 9 }, supportedMonthlyExtra: {} });
assert.equal(payoffRecRenderCalls.length, 0,
  'a stale recommendation success must not paint over a newer load');
assert.match(payoffRecWrap.innerHTML, /LOADING:Loading recommendation…/);
assert.match(payoffTableWrap.innerHTML, /LOADING:Loading payoff data…/);
staleRecFailure(new Error('stale offline'));
assert.match(payoffRecWrap.innerHTML, /LOADING:Loading recommendation…/,
  'a stale recommendation failure must not clear a newer load');
assert.equal(payoffStatusCalls.some(function(row) {
  return row.isError === true && /stale offline/.test(row.message);
}), false);
recSuccess({ monthlyRecommendation: { monthlyExtra: 25 }, supportedMonthlyExtra: {} });
assert.equal(payoffRecRenderCalls.length, 1);
assert.equal(payoffRecWrap.innerHTML, 'REC');
assert.match(payoffTableWrap.innerHTML, /LOADING:Loading payoff data…/);
posSuccess({ debts: [{ name: 'Fresh' }] });
assert.equal(payoffPosRenderCalls.length, 1);
assert.equal(payoffTableWrap.innerHTML, 'TABLE');

const monthHeadersForYear = function(year) {
  const yy = String(year).slice(-2);
  return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map(function(mon) {
    return mon + '-' + yy;
  });
};
const cfPaidDebtNames = ['Card A', 'Card B', 'Loan Depot', 'HELOC'];
const makeCfPaidRows = function(year, amountsByDebt) {
  const header = monthHeadersForYear(year).concat(['Type', 'Payee']);
  const rows = [header];
  cfPaidDebtNames.forEach(function(name) {
    const amount = amountsByDebt[name] || 0;
    const row = [];
    for (let i = 0; i < 12; i++) row.push(i === 0 ? -amount : 0);
    row.push('Expense', name);
    rows.push(row);
  });
  rows.push(['', '', '', '', '', '', '', '', '', '', '', '', 'Income', 'Salary']);
  return rows;
};
const cfPaidStats = {
  lastColumn: 0,
  headerRange: 0,
  dataValues: 0,
  dataDisplay: 0,
  sheetOpens: 0
};
const makeCfPaidSheet = function(rows) {
  return {
    getLastColumn: function() {
      cfPaidStats.lastColumn += 1;
      return rows[0].length;
    },
    getRange: function() {
      cfPaidStats.headerRange += 1;
      return { getDisplayValues: function() { return [rows[0]]; } };
    },
    getDataRange: function() {
      return {
        getValues: function() {
          cfPaidStats.dataValues += 1;
          return rows;
        },
        getDisplayValues: function() {
          cfPaidStats.dataDisplay += 1;
          return rows;
        }
      };
    }
  };
};
const cfPaidSheets = {
  2025: makeCfPaidSheet(makeCfPaidRows(2025, {
    'Card A': 100, 'Card B': 40, 'Loan Depot': 200, 'HELOC': 80
  })),
  2026: makeCfPaidSheet(makeCfPaidRows(2026, {
    'Card A': 50, 'Card B': 10, 'Loan Depot': 25, 'HELOC': 5
  }))
};
const cfPaidContext = vm.createContext({
  Date, Math, Number, String, Array, Object, JSON, isFinite,
  getCashFlowSheetName_: function(year) { return 'Cash Flow ' + year; },
  getCashFlowSheet_: function(ss, year) {
    cfPaidStats.sheetOpens += 1;
    const sheet = cfPaidSheets[year];
    if (!sheet) throw new Error('Missing cash flow sheet: Cash Flow ' + year);
    return sheet;
  },
  normalizeName_: function(name) { return String(name || '').trim(); },
  round2_: function(n) {
    return Math.round((Number(n || 0) + Number.EPSILON) * 100) / 100;
  }
});
vm.runInContext(
  sliceFunction(plannerHelpers, 'parseMonthHeader_') +
  '\n' + sliceFunction(plannerHelpers, 'toNumber_') +
  '\n' + sliceFunction(
    fs.readFileSync(new URL('../quick_add_payment.js', import.meta.url), 'utf8'),
    'getCashFlowHeaderMapFromHeaders_') +
  '\n' + sliceFunction(projection, 'sumExpensePaymentsForDebtPayees_') +
  '\n' + sliceFunction(projection, 'sumExpensePaymentsForDebtPayee_'),
  cfPaidContext
);

const beforeCfPaidFullReads = cfPaidDebtNames.length * 2 * 2;
const cfPaidTotals = cfPaidContext.sumExpensePaymentsForDebtPayees_(
  {}, cfPaidDebtNames, [2025, 2026], {}, []);
assert.equal(cfPaidTotals['Card A'], 150);
assert.equal(cfPaidTotals['Card B'], 50);
assert.equal(cfPaidTotals['Loan Depot'], 225);
assert.equal(cfPaidTotals.HELOC, 85);
assert.equal(cfPaidStats.sheetOpens, 2,
  'batched CF paid must open each year sheet once');
assert.equal(cfPaidStats.dataValues, 2,
  'batched CF paid must read each year grid once');
assert.equal(cfPaidStats.dataDisplay, 0,
  'batched CF paid must reuse the header row instead of a second full-sheet display read');
assert.equal(cfPaidStats.headerRange, 2);
assert.equal(beforeCfPaidFullReads, 16,
  'legacy path was 4 debts × 2 years × (values + display) = 16 full-sheet reads');
console.log(
  'Debt Overview CF paid full-sheet reads: before=' +
    beforeCfPaidFullReads +
    ' after=' +
    cfPaidStats.dataValues
);

function makeCountingSheet(rows) {
  const stats = { dataRange: 0, values: 0, display: 0 };
  const range = {
    getValues: function() {
      stats.values += 1;
      return rows;
    },
    getDisplayValues: function() {
      stats.display += 1;
      return rows;
    }
  };
  return {
    stats: stats,
    getLastRow: function() { return rows.length; },
    getLastColumn: function() { return (rows[0] || []).length; },
    getDataRange: function() {
      stats.dataRange += 1;
      JSON.parse(JSON.stringify(rows));
      return range;
    }
  };
}
function elapsedMs_(fn) {
  const start = process.hrtime.bigint();
  fn();
  return Number(process.hrtime.bigint() - start) / 1e6;
}

const recRangeSheets = {
  retirement: makeCountingSheet([
    ['Selected Scenario', 'Base', '', ''],
    ['Expected Annual Return %', 5, 7, 9]
  ]),
  upcoming: makeCountingSheet([
    ['Expense Name', 'Due Date', 'Amount', 'Status', 'Payee']
  ]),
  income: makeCountingSheet([
    ['Name', 'Jan-26', 'Type', 'Payee', 'Recurring', 'Frequency', 'Expected Amount'],
    ['Cisco Pay', 1, 'Income', 'Cisco Pay', 'Yes', 'Biweekly', 1000]
  ]),
  bills: makeCountingSheet([
    ['Payee', 'Default Amount', 'Active', 'Frequency', 'Category', 'Varies'],
    ['Internet', 80, 'Yes', 'Monthly', 'Utilities', 'No']
  ]),
  variable: makeCountingSheet([
    ['Name', 'Jan-26', 'Type', 'Payee'],
    ['Power', -40, 'Expense', 'Power']
  ])
};
const recRangeContext = vm.createContext({
  Date, Math, Number, String, Array, Object, JSON, isFinite,
  DEBT_PAYOFF_CASH_SAFETY_LOCATION_: 'Cash Flow → Upcoming',
  toNumber_: function(n) { return Number(n) || 0; },
  round2_: function(n) {
    return Math.round((Number(n || 0) + Number.EPSILON) * 100) / 100;
  },
  normalizeYesNo_: function(value) {
    return String(value || '').trim().toLowerCase() === 'yes' ? 'yes' : 'no';
  },
  normalizeFrequency_: function(value) { return String(value || '').trim() || 'unknown'; },
  debtMinimumPaymentCellIsKnown_: function(value, display) {
    return String(display == null ? value : display).trim() !== '';
  },
  getSheetNames_: function() { return { BILLS: 'INPUT - Bills' }; },
  findLatestCashFlowYearWithIncome_: function() { return 2026; },
  getCashFlowSheet_: function() { return recRangeSheets.income; },
  debtPayoffParseCiscoBonusScenario_: function() { return null; },
  debtPayoffParseConfirmedCashFlowIncome_: function() {
    return { cadenceUnconfirmed: false, incompleteRows: [], sources: [] };
  },
  debtPayoffTryCashFlowSheet_: function() { return recRangeSheets.variable; },
  debtPayoffBillIsVaries_: function() { return true; },
  debtPayoffYtdCompletedMonthKeys_: function() { return ['2026-01']; },
  estimateDebtPayoffVariableBillHistory_: function() { return { ok: true }; }
});
vm.runInContext(
  sliceFunction(projection, 'readDebtPayoffSavedPlanningAssumptions_') +
  '\n' + sliceFunction(projection, 'readDebtPayoffUpcomingObligations_') +
  '\n' + sliceFunction(projection, 'readDebtPayoffSupportedMonthlyExtraIncome_') +
  '\n' + sliceFunction(projection, 'readDebtPayoffSupportedMonthlyExtraBills_') +
  '\n' + sliceFunction(projection, 'attachDebtPayoffVariableBillHistory_'),
  recRangeContext
);

const recRangeBeforeFetches = 5 * 2;
const recAssumption = recRangeContext.readDebtPayoffSavedPlanningAssumptions_({
  getSheetByName: function() { return recRangeSheets.retirement; }
});
assert.equal(recAssumption.expectedInvestmentReturnKnown, true);
assert.equal(recAssumption.expectedInvestmentReturnPct, 7);
assert.equal(recRangeSheets.retirement.stats.dataRange, 1,
  'Retirement assumptions must reuse one getDataRange()');
assert.equal(recRangeSheets.retirement.stats.values, 1);
assert.equal(recRangeSheets.retirement.stats.display, 1);

const upcomingRead = recRangeContext.readDebtPayoffUpcomingObligations_({
  getSheetByName: function() { return recRangeSheets.upcoming; }
});
assert.equal(upcomingRead.ok, true);
assert.equal(recRangeSheets.upcoming.stats.dataRange, 1,
  'Upcoming obligations must reuse one getDataRange()');

const incomeRead = recRangeContext.readDebtPayoffSupportedMonthlyExtraIncome_({});
assert.equal(incomeRead.unavailable, false);
assert.equal(recRangeSheets.income.stats.dataRange, 1,
  'Income Cash Flow must reuse one getDataRange()');

const billsRead = recRangeContext.readDebtPayoffSupportedMonthlyExtraBills_({
  getSheetByName: function() { return recRangeSheets.bills; }
}, []);
assert.equal(billsRead.unavailable, false);
assert.equal(recRangeSheets.bills.stats.dataRange, 1,
  'Bills must reuse one getDataRange()');

recRangeContext.attachDebtPayoffVariableBillHistory_({}, [
  { active: true, payee: 'Power', varies: 'Yes' }
], new Date(2026, 9, 7));
assert.equal(recRangeSheets.variable.stats.dataRange, 1,
  'Variable-bill history must reuse one getDataRange() per Cash Flow year');

const recRangeAfterFetches =
  recRangeSheets.retirement.stats.dataRange +
  recRangeSheets.upcoming.stats.dataRange +
  recRangeSheets.income.stats.dataRange +
  recRangeSheets.bills.stats.dataRange +
  recRangeSheets.variable.stats.dataRange;
assert.equal(recRangeAfterFetches, 5,
  'recommendation helpers must fetch each sheet range once');
assert.equal(recRangeBeforeFetches, 10,
  'legacy recommendation helpers fetched values and display as two ranges each');

const largeGrid = [];
for (let r = 0; r < 250; r++) {
  const row = [];
  for (let c = 0; c < 16; c++) row.push(r === 0 ? 'H' + c : r * 16 + c);
  largeGrid.push(row);
}
const duplicateSheet = makeCountingSheet(largeGrid);
const reusedSheet = makeCountingSheet(largeGrid);
const duplicateMs = elapsedMs_(function() {
  duplicateSheet.getDataRange().getValues();
  duplicateSheet.getDataRange().getDisplayValues();
});
const reusedMs = elapsedMs_(function() {
  const range = reusedSheet.getDataRange();
  range.getValues();
  range.getDisplayValues();
});
assert.equal(duplicateSheet.stats.dataRange, 2);
assert.equal(reusedSheet.stats.dataRange, 1);

const wideCfPaidStats = {
  lastColumn: 0,
  headerRange: 0,
  dataValues: 0,
  dataDisplay: 0,
  sheetOpens: 0
};
const wideCfRows = makeCfPaidRows(2026, {
  'Card A': 50, 'Card B': 10, 'Loan Depot': 25, 'HELOC': 5
});
for (let i = 0; i < 180; i++) {
  const row = [];
  for (let m = 0; m < 12; m++) row.push(m === 0 ? -1 : 0);
  row.push('Expense', 'Other ' + i);
  wideCfRows.push(row);
}
const wideCfSheet = {
  getLastColumn: function() {
    wideCfPaidStats.lastColumn += 1;
    return wideCfRows[0].length;
  },
  getRange: function() {
    wideCfPaidStats.headerRange += 1;
    return { getDisplayValues: function() { return [wideCfRows[0]]; } };
  },
  getDataRange: function() {
    JSON.parse(JSON.stringify(wideCfRows));
    return {
      getValues: function() {
        wideCfPaidStats.dataValues += 1;
        return wideCfRows;
      }
    };
  }
};
const wideCfContext = vm.createContext({
  Date, Math, Number, String, Array, Object, JSON, isFinite,
  getCashFlowSheetName_: function(year) { return 'Cash Flow ' + year; },
  getCashFlowSheet_: function() {
    wideCfPaidStats.sheetOpens += 1;
    return wideCfSheet;
  },
  normalizeName_: function(name) { return String(name || '').trim(); },
  round2_: function(n) {
    return Math.round((Number(n || 0) + Number.EPSILON) * 100) / 100;
  }
});
vm.runInContext(
  sliceFunction(plannerHelpers, 'parseMonthHeader_') +
  '\n' + sliceFunction(plannerHelpers, 'toNumber_') +
  '\n' + sliceFunction(
    fs.readFileSync(new URL('../quick_add_payment.js', import.meta.url), 'utf8'),
    'getCashFlowHeaderMapFromHeaders_') +
  '\n' + sliceFunction(projection, 'sumExpensePaymentsForDebtPayees_'),
  wideCfContext
);
const cfPaidBlockMs = elapsedMs_(function() {
  wideCfContext.sumExpensePaymentsForDebtPayees_(
    {}, cfPaidDebtNames, [2026], {}, []);
});
assert.equal(wideCfPaidStats.dataValues, 1);
const recTtfBeforeMs = duplicateMs + cfPaidBlockMs;
const recTtfAfterMs = reusedMs;
console.log(
  'Debt Overview recommendation TTF proxy: before=' +
    recTtfBeforeMs.toFixed(1) +
    'ms (blocked on CF paid + duplicate range fetches) after=' +
    recTtfAfterMs.toFixed(1) +
    'ms (independent rec + one range per sheet)'
);
console.log(
  'Debt Overview recommendation range fetches: before=' +
    recRangeBeforeFetches +
    ' after=' +
    recRangeAfterFetches
);
console.log(
  'Debt Overview same-sheet range materializations: before=' +
    duplicateSheet.stats.dataRange +
    ' (' +
    duplicateMs.toFixed(1) +
    'ms) after=' +
    reusedSheet.stats.dataRange +
    ' (' +
    reusedMs.toFixed(1) +
    'ms)'
);
console.log(
  'Debt Overview CF paid work no longer on recommendation TTF: ' +
    cfPaidBlockMs.toFixed(1) +
    'ms'
);

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
assert.equal(surplus.cashPicture.income.total, 4000);
assert.equal(surplus.cashPicture.income.sources[0].name, 'Salary');
assert.equal(surplus.cashPicture.income.sources[0].amount, 4000);
assert.equal(surplus.cashPicture.householdBills.total, 1000);
assert.equal(surplus.cashPicture.householdBills.required, 1000);
assert.equal(surplus.cashPicture.householdBills.requiredSources[0].name, 'Rent');
assert.equal(surplus.cashPicture.householdBills.requiredSources[0].amount, 1000);
assert.equal(surplus.cashPicture.debtPayments.total, 500);
assert.equal(surplus.cashPicture.debtPayments.accounts[0].name, 'Card');
assert.equal(surplus.cashPicture.debtPayments.accounts[0].amount, 500);
assert.equal(surplus.cashPicture.investments.total, 0);
assert.equal(surplus.cashPicture.shortfall, 0);
assert.equal(surplus.cashPicture.surplus, 2500);
assert.equal(
  context.debtPayoffRecommendationProtection_(surplus).cashPicture.income.total,
  4000
);
const liveCashPicture = context.buildDebtPayoffCashPicture_({
  components: {
    recurringIncomeMonthly: 22033.22,
    recurringBillsMonthly: 4653.61,
    variableBillsMonthly: 4387.57,
    debtMinimumsMonthly: 22018.49,
    policyFloorMonthly: 2166.67,
    unmatchedInvestmentBillsMonthly: 15
  },
  surplus: -11208.12,
  debtMinimumsByType: {
    subtotals: [
      { key: 'creditCards', amount: 3140.63, accounts: [
        { name: 'Chase card', type: 'Credit Card', amount: 3140.63, minimumPaymentKnown: true }
      ] },
      { key: 'heloc', amount: 400, accounts: [
        { name: 'HELOC', type: 'HELOC', amount: 400, minimumPaymentKnown: true }
      ] },
      { key: 'loansMortgages', amount: 18477.86, accounts: [
        { name: 'MTB Bank - MO 4 Plex', type: 'Loan', amount: 18477.86, minimumPaymentKnown: true }
      ] }
    ]
  },
  incomeSources: [
    { name: 'Cisco Pay', amount: 18000 },
    { name: 'Oakley rent', amount: 4033.22 }
  ],
  requiredBillSources: [{ name: 'Required bills', amount: 4653.61 }],
  variableBillEstimates: [{
    payee: 'Costco',
    ytdTotal: 43875.7,
    completedMonthCount: 10,
    monthlyEquivalent: 4387.57
  }],
  policyFloorSources: [{ name: 'Whole life floor', amount: 2166.67 }],
  unmatchedInvestmentBillSources: [{ name: 'Other investment bill', amount: 15 }]
});
assert.equal(liveCashPicture.income.total, 22033.22);
assert.equal(liveCashPicture.householdBills.total, 9041.18);
assert.equal(liveCashPicture.householdBills.required, 4653.61);
assert.equal(liveCashPicture.householdBills.variable, 4387.57);
assert.equal(liveCashPicture.debtPayments.total, 22018.49);
assert.equal(liveCashPicture.debtPayments.creditCards, 3140.63);
assert.equal(liveCashPicture.debtPayments.heloc, 400);
assert.equal(liveCashPicture.debtPayments.loansMortgages, 18477.86);
assert.equal(liveCashPicture.investments.total, 2181.67);
assert.equal(liveCashPicture.investments.policyFloors, 2166.67);
assert.equal(liveCashPicture.investments.otherBills, 15);
assert.equal(liveCashPicture.shortfall, 11208.12);
assert.equal(
  liveCashPicture.income.sources.reduce((sum, row) => sum + row.amount, 0),
  liveCashPicture.income.total
);
assert.equal(
  liveCashPicture.householdBills.requiredSources.reduce((sum, row) => sum + row.amount, 0) +
    liveCashPicture.householdBills.variableSources.reduce((sum, row) => sum + row.monthlyEquivalent, 0),
  liveCashPicture.householdBills.total
);
assert.equal(
  liveCashPicture.debtPayments.accounts.reduce((sum, row) => sum + row.amount, 0),
  liveCashPicture.debtPayments.total
);
assert.equal(
  liveCashPicture.investments.policyFloorSources.reduce((sum, row) => sum + row.amount, 0) +
    liveCashPicture.investments.otherBillSources.reduce((sum, row) => sum + row.amount, 0),
  liveCashPicture.investments.total
);
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
assert.equal(unknownMin.debtMinimumsByType.total, 0);
assert.equal(unknownMin.debtMinimumsByType.unknownMinimums.length, 1);
assert.equal(unknownMin.debtMinimumsByType.unknownMinimums[0].amount, null);
assert.equal(unknownMin.debtMinimumsByType.unknownMinimums[0].minimumPaymentKnown, false);
assert.doesNotMatch(JSON.stringify(unknownMin.debtMinimumsByType.unknownMinimums), /"amount":0/);

const mixedKnownAndUnknownMin = context.buildDebtPayoffSupportedMonthlyExtra_(Object.assign({}, baseSupported, {
  debts: [
    Object.assign(usableDebt('Visa', 2000, 22, 75), { type: 'Credit Card' }),
    {
      name: 'Blank Min Card', type: 'Credit Card', active: true, balance: 900,
      minimumPayment: 0, minimumPaymentKnown: false
    }
  ]
}));
assert.equal(mixedKnownAndUnknownMin.available, false);
assert.equal(mixedKnownAndUnknownMin.components.debtMinimumsMonthly, 75);
assert.equal(mixedKnownAndUnknownMin.debtMinimumsByType.total, 75);
assert.equal(mixedKnownAndUnknownMin.debtMinimumsByType.unknownMinimums.length, 1);
assert.equal(mixedKnownAndUnknownMin.debtMinimumsByType.unknownMinimums[0].amount, null);

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

assert.match(plannerCore, /principalAndInterestKnown/);
assert.match(plannerCore, /escrowKnown/);
assert.match(projection, /function buildDebtPayoffEscrowBillCoverage_/);
assert.match(projection, /function debtPayoffSameSavedPropertyLink_/);
assert.match(projection, /ESCROW_COVERAGE_UNKNOWN/);
assert.doesNotMatch(sliceFunction(projection, 'buildDebtPayoffEscrowBillCoverage_'),
  /keywordKind && propertyDebts\.length/);
assert.doesNotMatch(sliceFunction(projection, 'buildDebtPayoffEscrowBillCoverage_'),
  /payee\.indexOf|debtPayoffBillMatchesLinkedProperty_/);
assert.match(sliceFunction(projection, 'readDebtPayoffSupportedMonthlyExtraBills_'),
  /Linked Property/);
assert.match(help, /full saved minimum, which may include escrow/);
assert.match(help, /properties with no linked mortgage stay in the bill total/);
assert.match(help, /Blank is unknown, not \$0/);
assert.match(body, /id="debt_edit_principal_interest"/);
assert.match(body, /id="debt_edit_escrow_payment"/);
const debtsSource = fs.readFileSync(new URL('../debts.js', import.meta.url), 'utf8');
const debtsClient = fs.readFileSync(
  new URL('../Dashboard_Script_PlanningDebts.html', import.meta.url), 'utf8');
assert.match(debtsClient, /principalAndInterest/);
assert.match(debtsClient, /escrowPayment/);
assert.match(debtsSource, /DEBTS_PRINCIPAL_AND_INTEREST_HEADER_/);
assert.match(debtsSource, /DEBTS_ESCROW_PAYMENT_HEADER_/);
assert.match(debtsSource, /function appendDebtPrincipalEscrowColumns_/);
assert.match(sliceFunction(debtsSource, 'getDebtsHeaderMap_'),
  /\.map\(function\(h\) \{\s*return String\(h \|\| ''\)\.trim\(\);/);
assert.match(sliceFunction(debtsSource, 'updateTrackedDebtFromDashboard'),
  /could not be saved because INPUT - Debts is missing that column/);
assert.match(sliceFunction(projection, 'debtPayoffHasContinuingPropertyCosts_'),
  /debtPayoffHasSavedPiOrEscrow_/);
assert.match(sliceFunction(debtsSource, 'updateDebtField'),
  /optionalKnownCurrencyFields/);
assert.match(sliceFunction(debtsSource, 'updateDebtField'),
  /blank if unknown/);
assert.doesNotMatch(sliceFunction(projection, 'simulateDebtPayoffSchedule_'),
  /d\.minimumPayment\) \|\| 0\),\s*d\.balance/);

const escrowBase = {
  recurringIncomeSources: [confirmedIncome('Salary', 5000)],
  reserveKnown: true,
  requiredReserveAmount: 500,
  usableCashAfterBuffers: 20000,
  usableCashKnown: true
};
const mtbEscrowDebt = {
  name: 'MTB Bank - MO 4 Plex',
  originalName: 'MTB Bank - MO 4 Plex',
  type: 'Loan',
  linkedProperty: 'MO 4 Plex',
  active: true,
  balance: 101450.59,
  interestRate: 6.875,
  minimumPayment: 2047.21,
  minimumPaymentKnown: true,
  escrowPayment: 873.73,
  escrowKnown: true,
  unverifiedTaxInsuranceAmount: 1485.20
};
const escrowOnce = context.buildDebtPayoffSupportedMonthlyExtra_(Object.assign({}, escrowBase, {
  debts: [mtbEscrowDebt],
  bills: [
    {
      payee: 'St. Charles County Collector', amount: 500, amountKnown: true,
      frequency: 'monthly', active: true, category: 'Tax',
      linkedProperty: 'MO 4 Plex'
    },
    {
      payee: 'State Farm homeowners', amount: 373.73, amountKnown: true,
      frequency: 'monthly', active: true, category: 'Insurance',
      linkedProperty: 'MO 4 Plex'
    },
    {
      payee: 'MO 4 Plex HOA', amount: 200, amountKnown: true,
      frequency: 'monthly', active: true, category: 'HOA'
    },
    {
      payee: 'Geico car insurance', amount: 100, amountKnown: true,
      frequency: 'monthly', active: true, category: 'Insurance'
    }
  ]
}));
assert.equal(escrowOnce.available, true);
assert.equal(escrowOnce.components.debtMinimumsMonthly, 2047.21,
  'full mortgage minimum stays the cash-flow amount');
assert.equal(escrowOnce.components.recurringBillsMonthly, 300,
  'escrow-covered tax/insurance must not be added on top of the full payment');
assert.equal(escrowOnce.escrowCoverage.countedOnce, true);
assert.equal(escrowOnce.escrowCoverage.excludedAmount, 873.73);
assert.notEqual(escrowOnce.components.recurringBillsMonthly, 1173.73,
  'double-counted escrowed property costs were $873.73');
assert.equal(escrowOnce.recurringSurplusBeforeReserve,
  Number((5000 - 2047.21 - 300).toFixed(2)));
assert.notEqual(escrowOnce.recurringSurplusBeforeReserve,
  Number((5000 - 2047.21 - 300 - 873.73).toFixed(2)));

const nonEscrowedCosts = context.buildDebtPayoffSupportedMonthlyExtra_(Object.assign({}, escrowBase, {
  debts: [{
    name: 'Bank of America Loan - Lake Tahoe House',
    type: 'Loan',
    linkedProperty: 'Lake Tahoe House',
    active: true,
    balance: 200000,
    minimumPayment: 1500,
    minimumPaymentKnown: true
  }],
  bills: [
    {
      payee: 'Lake Tahoe House HOA', amount: 350, amountKnown: true,
      frequency: 'monthly', active: true, category: 'HOA'
    }
  ]
}));
assert.equal(nonEscrowedCosts.available, true);
assert.equal(nonEscrowedCosts.components.debtMinimumsMonthly, 1500);
assert.equal(nonEscrowedCosts.components.recurringBillsMonthly, 350,
  'non-escrowed property costs such as HOA stay in bills');
assert.equal(nonEscrowedCosts.escrowCoverage.countedOnce, false);

const unknownEscrowCoverage = context.buildDebtPayoffSupportedMonthlyExtra_(Object.assign({}, escrowBase, {
  debts: [{
    name: 'Bank of America Loan - Lake Tahoe House',
    type: 'Loan',
    linkedProperty: 'Lake Tahoe House',
    active: true,
    balance: 200000,
    minimumPayment: 1500,
    minimumPaymentKnown: true
  }],
  bills: [
    {
      payee: 'Placer County property tax', amount: 400, amountKnown: true,
      frequency: 'monthly', active: true, category: 'Tax',
      linkedProperty: 'Lake Tahoe House'
    }
  ]
}));
assert.equal(unknownEscrowCoverage.available, false);
assert.equal(unknownEscrowCoverage.blockers[0].code, 'ESCROW_COVERAGE_UNKNOWN');
assert.equal(unknownEscrowCoverage.components.debtMinimumsMonthly, 1500);
assert.equal(unknownEscrowCoverage.components.recurringBillsMonthly, 400,
  'unknown escrow coverage must not guess by dropping the bill');
assert.match(String(unknownEscrowCoverage.blockers[0].reason), /withheld rather than/);
const unknownRec = context.buildDebtPayoffMonthlyRecommendation_([
  Object.assign(usableDebt('Bank of America Loan - Lake Tahoe House', 200000, 4, 1500), {
    type: 'Loan',
    linkedProperty: 'Lake Tahoe House'
  })
], unknownEscrowCoverage, { asOfDate: asOf });
assert.equal(unknownRec.state, 'WITHHELD');
assert.equal(unknownRec.code, 'FACTS_MISSING');
assert.equal(unknownRec.monthlyExtra, null);

const paidOffOakleyMinnesota = context.buildDebtPayoffSupportedMonthlyExtra_(Object.assign({}, escrowBase, {
  debts: [mtbEscrowDebt],
  bills: [
    {
      payee: 'Oakley House property tax', amount: 420, amountKnown: true,
      frequency: 'monthly', active: true, category: 'Tax',
      linkedProperty: 'Oakley House'
    },
    {
      payee: 'Minnesota House homeowners insurance', amount: 185, amountKnown: true,
      frequency: 'monthly', active: true, category: 'Insurance',
      linkedProperty: 'Minnesota House'
    }
  ]
}));
assert.equal(paidOffOakleyMinnesota.available, true,
  'paid-off Oakley and Minnesota tax/insurance must not withhold the estimate');
assert.equal(paidOffOakleyMinnesota.blockers.length, 0);
assert.equal(paidOffOakleyMinnesota.components.debtMinimumsMonthly, 2047.21,
  'full mortgage minimum is unchanged');
assert.equal(paidOffOakleyMinnesota.components.recurringBillsMonthly, 605,
  'Oakley and Minnesota bills stay in the supported surplus through the bill path');
assert.equal(paidOffOakleyMinnesota.escrowCoverage.countedOnce, false);
assert.equal(paidOffOakleyMinnesota.escrowCoverage.excludedAmount, 0);
assert.equal((paidOffOakleyMinnesota.escrowCoverage.excludedBills || []).length, 0);
assert.equal(paidOffOakleyMinnesota.recurringSurplusBeforeReserve,
  Number((5000 - 2047.21 - 605).toFixed(2)));

const nameHeuristicDoesNotLink = context.buildDebtPayoffSupportedMonthlyExtra_(Object.assign({}, escrowBase, {
  debts: [{
    name: 'Bank of America Loan - Lake Tahoe House',
    type: 'Loan',
    linkedProperty: 'Lake Tahoe House',
    active: true,
    balance: 200000,
    minimumPayment: 1500,
    minimumPaymentKnown: true
  }],
  bills: [
    {
      payee: 'Lake Tahoe House property tax', amount: 400, amountKnown: true,
      frequency: 'monthly', active: true, category: 'Tax'
    }
  ]
}));
assert.equal(nameHeuristicDoesNotLink.available, true,
  'a property-tax payee name must not be treated as a saved mortgage link');
assert.equal(nameHeuristicDoesNotLink.components.recurringBillsMonthly, 400);
assert.equal(nameHeuristicDoesNotLink.escrowCoverage.excludedAmount, 0);

const countedOnceWithPaidOffBills = context.buildDebtPayoffSupportedMonthlyExtra_(Object.assign({}, escrowBase, {
  debts: [mtbEscrowDebt],
  bills: [
    {
      payee: 'St. Charles County Collector', amount: 500, amountKnown: true,
      frequency: 'monthly', active: true, category: 'Tax',
      linkedProperty: 'MO 4 Plex'
    },
    {
      payee: 'State Farm homeowners', amount: 373.73, amountKnown: true,
      frequency: 'monthly', active: true, category: 'Insurance',
      linkedProperty: 'MO 4 Plex'
    },
    {
      payee: 'Oakley House property tax', amount: 420, amountKnown: true,
      frequency: 'monthly', active: true, category: 'Tax',
      linkedProperty: 'Oakley House'
    },
    {
      payee: 'Minnesota House homeowners insurance', amount: 185, amountKnown: true,
      frequency: 'monthly', active: true, category: 'Insurance',
      linkedProperty: 'Minnesota House'
    },
    {
      payee: 'MO 4 Plex HOA', amount: 200, amountKnown: true,
      frequency: 'monthly', active: true, category: 'HOA'
    },
    {
      payee: 'Geico car insurance', amount: 100, amountKnown: true,
      frequency: 'monthly', active: true, category: 'Insurance'
    }
  ]
}));
assert.equal(countedOnceWithPaidOffBills.available, true);
assert.equal(countedOnceWithPaidOffBills.components.debtMinimumsMonthly, 2047.21);
assert.equal(countedOnceWithPaidOffBills.components.recurringBillsMonthly, 905,
  'Oakley, Minnesota, HOA, and car insurance stay in bills; escrowed T&I is not added again');
assert.equal(countedOnceWithPaidOffBills.escrowCoverage.excludedAmount, 873.73);
assert.equal(countedOnceWithPaidOffBills.escrowCoverage.excludedBills.length, 2);
assert.equal(
  countedOnceWithPaidOffBills.components.recurringBillsMonthly +
    countedOnceWithPaidOffBills.escrowCoverage.excludedAmount,
  1778.73,
  'every bill is counted once: excluded escrowed T&I plus remaining bills');
assert.notEqual(countedOnceWithPaidOffBills.components.recurringBillsMonthly, 1778.73,
  'escrowed T&I must not also remain in the bill total');
assert.notEqual(countedOnceWithPaidOffBills.components.recurringBillsMonthly, 300,
  'paid-off Oakley and Minnesota bills must not be removed from the bill total');
assert.equal(countedOnceWithPaidOffBills.recurringSurplusBeforeReserve,
  Number((5000 - 2047.21 - 905).toFixed(2)));

const mortgagedUnknownStillWithholds = context.buildDebtPayoffSupportedMonthlyExtra_(Object.assign({}, escrowBase, {
  debts: [{
    name: 'Bank of America Loan - Lake Tahoe House',
    type: 'Loan',
    linkedProperty: 'Lake Tahoe House',
    active: true,
    balance: 200000,
    minimumPayment: 1500,
    minimumPaymentKnown: true
  }],
  bills: [
    {
      payee: 'Oakley House property tax', amount: 420, amountKnown: true,
      frequency: 'monthly', active: true, category: 'Tax',
      linkedProperty: 'Oakley House'
    },
    {
      payee: 'Placer County property tax', amount: 400, amountKnown: true,
      frequency: 'monthly', active: true, category: 'Tax',
      linkedProperty: 'Lake Tahoe House'
    }
  ]
}));
assert.equal(mortgagedUnknownStillWithholds.available, false);
assert.equal(mortgagedUnknownStillWithholds.blockers[0].code, 'ESCROW_COVERAGE_UNKNOWN');
assert.equal(mortgagedUnknownStillWithholds.components.recurringBillsMonthly, 820,
  'Oakley and the mortgaged-property bill both stay in the monthly expense total');
assert.equal(mortgagedUnknownStillWithholds.escrowCoverage.excludedAmount, 0,
  'unknown coverage must not remove either bill from expenses');
assert.match(String(mortgagedUnknownStillWithholds.blockers[0].reason), /Placer County property tax/);
assert.doesNotMatch(String(mortgagedUnknownStillWithholds.blockers[0].reason), /Oakley House property tax/);

assert.equal(mtbEscrowDebt.unverifiedTaxInsuranceAmount, 1485.20);
assert.notEqual(escrowOnce.escrowCoverage.excludedAmount, 1485.20);

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
assert.equal(zeroRec.breakEven.noSafeLump, false);
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

const typedMinDebts = [
  Object.assign(usableDebt('Visa', 2000, 22, 75), { type: 'Credit Card' }),
  Object.assign(usableDebt('Figure HELOC', 15000, 8, 120), { type: 'HELOC' }),
  Object.assign(usableDebt('Loan Depot - San Jose House', 400000, 2.25, 1800), { type: 'Loan' }),
  Object.assign(usableDebt('Mystery Account', 500, 19, 40), { type: '' }),
  Object.assign(usableDebt('Named HELOC as Loan', 8000, 7, 90), { type: 'Loan' })
];
const typedMinSupported = context.buildDebtPayoffSupportedMonthlyExtra_(Object.assign({}, baseSupported, {
  asOfDate: asOf,
  recurringIncomeSources: [confirmedIncome('Salary', 1200)],
  debts: typedMinDebts
}));
assert.equal(typedMinSupported.available, true);
assert.equal(typedMinSupported.deficit, true);
assert.equal(typedMinSupported.amount, 0);
assert.equal(typedMinSupported.components.debtMinimumsMonthly, 2125);
assert.equal(typedMinSupported.debtMinimumsByType.total, 2125);
assert.equal(typedMinSupported.debtMinimumsByType.reconciles, true);
assert.equal(typedMinSupported.debtMinimumsByType.unknownMinimums.length, 0);
const typedBuckets = {};
typedMinSupported.debtMinimumsByType.subtotals.forEach(function(row) {
  typedBuckets[row.key] = row;
});
assert.equal(typedBuckets.creditCards.amount, 75);
assert.equal(typedBuckets.heloc.amount, 120);
assert.equal(typedBuckets.loansMortgages.amount, 1890);
assert.equal(typedBuckets.otherUnknown.amount, 40);
assert.equal(
  context.round2_(
    typedBuckets.creditCards.amount + typedBuckets.heloc.amount +
    typedBuckets.loansMortgages.amount + typedBuckets.otherUnknown.amount
  ),
  typedMinSupported.components.debtMinimumsMonthly
);
assert.equal(context.debtPayoffClassifySavedDebtType_({ type: 'Loan', name: 'Chase HELOC' }),
  'loansMortgages');
assert.equal(context.debtPayoffClassifySavedDebtType_({ type: '', name: 'House Mortgage' }),
  'otherUnknown');
assert.equal(context.debtPayoffClassifySavedDebtType_({ type: 'HELOC', name: 'Card' }),
  'heloc');
assert.equal(context.debtPayoffClassifySavedDebtType_({ type: 'Credit Card' }), 'creditCards');
const typedMinRec = context.buildDebtPayoffMonthlyRecommendation_(
  typedMinDebts, typedMinSupported, { asOfDate: asOf });
assert.equal(typedMinRec.monthlyExtra, 0);
assert.equal(typedMinRec.breakEven.debtMinimumsByType.total, 2125);
assert.equal(typedMinRec.breakEven.doesNotProjectDecliningCardMinimum, true);
assert.equal(typedMinRec.breakEven.loanExtraDoesNotLowerScheduledPayment, true);
assert.equal(typedMinRec.breakEven.payingOffRequiresCash, true);
assert.equal(typedMinRec.oneTimeAllocation.amount, typedMinSupported.cashSafety.oneTimeAmount);

const minHeldConstant = context.simulateDebtPayoffSchedule_([
  Object.assign(usableDebt('Visa', 200, 24, 50), { type: 'Credit Card' }),
  Object.assign(usableDebt('Mortgage', 10000, 4, 400), { type: 'Loan' })
], 200, 'avalanche', { asOfDate: asOf, horizonMonths: 24 });
assert.ok(minHeldConstant.totalInterest > 0);
assert.doesNotMatch(JSON.stringify(minHeldConstant), /projectedMinimum|decliningMinimum/);

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
assert.equal(displayedHouseholdRec.oneTimeAllocation.amount, 0);
assert.equal(displayedHouseholdRec.oneTimeAllocation.code, 'BASELINE_RESERVE_BREACH');
assert.equal(displayedHouseholdRec.breakEven.noSafeLump, true);
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
assert.equal(Array.from(targeted.extraPriorityOrder).join('|'), 'High APR Card');
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
  /d\.balance \+ interest[\s\S]*contractualPrincipalPayment[\s\S]*bonusByMonth\[m\]/,
  'bonus cash must apply after interest and contractual principal payments');
assert.match(sliceFunction(projection, 'simulateDebtPayoffSchedule_'),
  /applyDebtPayoffScenarioLeftover_\(\s*remaining, bonusAmount, allocStrategy, null, targetOrder\)/);
assert.match(sliceFunction(projection, 'simulateDebtPayoffSchedule_'),
  /applyDebtPayoffScenarioLeftover_\(\s*remaining, rolledBudget, allocStrategy, extraTargetNames, targetOrder\)/);
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
const householdWrap = { innerHTML: '' };
const calcWrap = { innerHTML: '' };
function debtOverviewPageHtml_() {
  return String(recommendationWrap.innerHTML || '') +
    String(householdWrap.innerHTML || '') +
    String(calcWrap.innerHTML || '');
}
const uiContext = vm.createContext({
  Date, Math, Number, String, Array, Object, JSON, isFinite,
  DEBT_PAYOFF_SCENARIO_BONUS_NAMES_: ['Cisco Mid Year Bonus', 'Cisco End Year Bonus'],
  __debtPayoffHouseholdPlanMeta_: null,
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
      if (id === 'debt_payoff_household_wrap') return householdWrap;
      if (id === 'debt_payoff_calc_wrap') return calcWrap;
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
  '\n' + sliceFunction(client, 'debtPayoffRoundMoney_') +
  '\n' + sliceFunction(client, 'debtPayoffMoneyText_') +
  '\n' + sliceFunction(client, 'debtPayoffCashPictureFromFacts_') +
  '\n' + sliceFunction(client, 'renderDebtPayoffCashPictureSourceTableHtml_') +
  '\n' + sliceFunction(client, 'renderDebtPayoffCashPictureSplitsHtml_') +
  '\n' + sliceFunction(client, 'renderDebtPayoffCashPictureGroupHtml_') +
  '\n' + sliceFunction(client, 'debtPayoffCashPictureExclusiveOpen_') +
  '\n' + sliceFunction(client, 'renderDebtPayoffCashPictureHtml_') +
  '\n' + sliceFunction(client, 'debtPayoffComparisonValueClass_') +
  '\n' + sliceFunction(client, 'renderDebtPayoffNestedDetailsHtml_') +
  '\n' + sliceFunction(client, 'debtPayoffCashPictureIsVisible_') +
  '\n' + sliceFunction(client, 'renderDebtPayoffReserveProtectionHtml_') +
  '\n' + sliceFunction(client, 'renderDebtPayoffDetailsSummaryHtml_') +
  '\n' + sliceFunction(client, 'debtPayoffBreakEvenMinimumsByType_') +
  '\n' + sliceFunction(client, 'renderDebtPayoffMinimumTypeSubtotalsHtml_') +
  '\n' + sliceFunction(client, 'renderDebtPayoffDebtMinimumDetailsHtml_') +
  '\n' + sliceFunction(client, 'renderDebtPayoffCalculationDetailsHtml_') +
  '\n' + sliceFunction(client, 'renderDebtPayoffCashSafetySummaryHtml_') +
  '\n' + sliceFunction(client, 'renderDebtPayoffCashSafetyHtml_') +
  '\n' + sliceFunction(client, 'renderDebtPayoffCashSafetyReconciliationHtml_') +
  '\n' + sliceFunction(client, 'renderDebtPayoffSupportedExtraBreakdownHtml_') +
  '\n' + sliceFunction(client, 'renderDebtPayoffVariableBillMethodHtml_') +
  '\n' + sliceFunction(client, 'debtPayoffVariableBillPeriodLabel_') +
  '\n' + sliceFunction(client, 'renderDebtPayoffVariableBillEstimatesHtml_') +
  '\n' + sliceFunction(client, 'debtPayoffOneTimeWhyRepeatsReserveWarning_') +
  '\n' + sliceFunction(client, 'renderDebtPayoffOneTimeAllocationHtml_') +
  '\n' + sliceFunction(client, 'renderDebtPayoffHouseholdPlanHtml_') +
  '\n' + sliceFunction(client, 'renderDebtPayoffHouseholdAssumptionsHtml_') +
  '\n' + sliceFunction(client, 'debtPayoffLowestModeledInterestKey_') +
  '\n' + sliceFunction(client, 'renderDebtPayoffHouseholdComparisonHtml_') +
  '\n' + sliceFunction(client, 'renderDebtPayoffHouseholdComparisonCard_') +
  '\n' + sliceFunction(client, 'formatDebtPayoffHouseholdInterest_') +
  '\n' + sliceFunction(client, 'formatDebtPayoffComparisonInterest_') +
  '\n' + sliceFunction(client, 'debtPayoffComparisonCashFlowLabel_') +
  '\n' + sliceFunction(client, 'renderDebtPayoffComparisonDetailsHtml_') +
  '\n' + sliceFunction(client, 'renderDebtPayoffOverlayAllocationDetail_') +
  '\n' + sliceFunction(client, 'renderDebtPayoffComparisonTableHtml_') +
  '\n' + sliceFunction(client, 'renderDebtPayoffHouseholdReleasesHtml_') +
  '\n' + sliceFunction(client, 'renderDebtPayoffHouseholdCustomOrderHtml_') +
  '\n' + sliceFunction(client, 'renderDebtPayoffHouseholdStrategyCard_') +
  '\n' + sliceFunction(client, 'formatDebtPayoffPaymentReleasesHtml_') +
  '\n' + sliceFunction(client, 'resolveDebtPayoffBreakEven_') +
  '\n' + sliceFunction(client, 'renderDebtPayoffWhyExtraStaysHtml_') +
  '\n' + sliceFunction(client, 'renderDebtPayoffBreakEvenHtml_') +
  '\n' + sliceFunction(client, 'fillDebtPayoffSection_') +
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
  breakEven: {
    state: 'DEFICIT',
    gapToBreakEven: 300,
    noSafeLump: true,
    payingOffRequiresCash: true,
    doesNotProjectDecliningCardMinimum: true,
    loanExtraDoesNotLowerScheduledPayment: true,
    categories: [
      { key: 'recurringIncomeMonthly', label: 'Recurring income', kind: 'income', amount: 1200 },
      { key: 'recurringBillsMonthly', label: 'Required bills', kind: 'commitment', amount: 1000 },
      { key: 'debtMinimumsMonthly', label: 'Debt minimums', kind: 'commitment', amount: 500 }
    ],
    debtMinimumsByType: {
      total: 500,
      reconciles: true,
      subtotals: [
        { key: 'creditCards', label: 'Credit Cards', amount: 200, accounts: [
          { name: 'Visa', type: 'Credit Card', amount: 200, minimumPaymentKnown: true }
        ] },
        { key: 'heloc', label: 'HELOC', amount: 0, accounts: [] },
        { key: 'loansMortgages', label: 'Loans/Mortgages', amount: 300, accounts: [
          { name: 'House loan', type: 'Loan', amount: 300, minimumPaymentKnown: true }
        ] },
        { key: 'otherUnknown', label: 'Other/Unknown', amount: 0, accounts: [] }
      ],
      unknownMinimums: [
        { name: 'Blank Card', type: 'Unknown', typeKey: 'otherUnknown', amount: null, minimumPaymentKnown: false }
      ]
    }
  },
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
}, recurringSurplusBeforeReserve: -300, requiredReserveAmount: 1000, usableCashAfterBuffers: 5000,
  debtMinimumsByType: {
    total: 500,
    reconciles: true,
    subtotals: [
      { key: 'creditCards', label: 'Credit Cards', amount: 200, accounts: [
        { name: 'Visa', type: 'Credit Card', amount: 200, minimumPaymentKnown: true }
      ] },
      { key: 'heloc', label: 'HELOC', amount: 0, accounts: [] },
      { key: 'loansMortgages', label: 'Loans/Mortgages', amount: 300, accounts: [
        { name: 'House loan', type: 'Loan', amount: 300, minimumPaymentKnown: true }
      ] },
      { key: 'otherUnknown', label: 'Other/Unknown', amount: 0, accounts: [] }
    ],
    unknownMinimums: [
      { name: 'Blank Card', type: 'Unknown', typeKey: 'otherUnknown', amount: null, minimumPaymentKnown: false }
    ]
  },
  cashPicture: {
    income: {
      label: 'Income',
      total: 1200,
      sources: [{ name: 'Salary', amount: 1200 }]
    },
    householdBills: {
      label: 'Household bills',
      total: 1000,
      required: 1000,
      variable: 0,
      requiredSources: [{ name: 'Rent', amount: 1000 }],
      variableSources: []
    },
    debtPayments: {
      label: 'Debt payments',
      total: 500,
      creditCards: 200,
      heloc: 0,
      loansMortgages: 300,
      otherUnknown: 0,
      unknownMinimums: [
        { name: 'Blank Card', type: 'Unknown', typeKey: 'otherUnknown', amount: null, minimumPaymentKnown: false }
      ],
      accounts: [
        { name: 'Visa', type: 'Credit Card', amount: 200, minimumPaymentKnown: true },
        { name: 'House loan', type: 'Loan', amount: 300, minimumPaymentKnown: true }
      ]
    },
    investments: {
      label: 'Investment commitments',
      total: 0,
      policyFloors: 0,
      otherBills: 0,
      policyFloorSources: [],
      otherBillSources: []
    },
    shortfall: 300,
    surplus: -300
  }
});
assert.match(recommendationWrap.innerHTML, /<strong>\$0 extra this month<\/strong>/);
assert.doesNotMatch(recommendationWrap.innerHTML, /No recurring extra this month/);
assert.doesNotMatch(recommendationWrap.innerHTML, /Monthly gap to break even: \$300\.00/);
assert.match(recommendationWrap.innerHTML, /Monthly shortfall[\s\S]*\$300\.00/);
assert.match(recommendationWrap.innerHTML, /Monthly cash picture/);
assert.match(recommendationWrap.innerHTML, /<summary>View income sources<\/summary>/);
assert.match(recommendationWrap.innerHTML, /<summary>View household bills<\/summary>/);
assert.match(recommendationWrap.innerHTML, /<summary>View debt accounts<\/summary>/);
assert.match(recommendationWrap.innerHTML, /<summary>View investment sources<\/summary>/);
assert.match(recommendationWrap.innerHTML, /class="debt-payoff-cash-picture-stack"/);
assert.equal((recommendationWrap.innerHTML.match(/<article class="debt-payoff-cash-picture-card/g) || []).length, 4);
assert.match(recommendationWrap.innerHTML, /<summary>Why extra stays \$0\.00<\/summary>/);
assert.match(recommendationWrap.innerHTML,
  /<summary>Why extra stays \$0\.00<\/summary>[\s\S]*Recurring commitments leave no surplus after required bills/);
assert.doesNotMatch(recommendationWrap.innerHTML.split('<summary>Why extra stays $0.00</summary>')[0],
  /Recurring commitments leave no surplus after required bills/);
assert.doesNotMatch(recommendationWrap.innerHTML, /debt-payoff-break-even-details[^>]*\sopen/);
assert.doesNotMatch(recommendationWrap.innerHTML, /debt-payoff-cash-picture-details[^>]*\sopen/);
assert.match(recommendationWrap.innerHTML, /<span class="debt-payoff-cash-picture-label">Income<\/span><span class="debt-payoff-cash-picture-value">\$1,200\.00<\/span>/);
assert.match(recommendationWrap.innerHTML, /<span class="debt-payoff-cash-picture-label">Household bills<\/span><span class="debt-payoff-cash-picture-value">\$1,000\.00<\/span>/);
assert.match(recommendationWrap.innerHTML, /<span class="debt-payoff-cash-picture-label">Debt payments<\/span><span class="debt-payoff-cash-picture-value">\$500\.00<\/span>/);
assert.match(recommendationWrap.innerHTML, /<span class="debt-payoff-cash-picture-label">Investment commitments<\/span><span class="debt-payoff-cash-picture-value">\$0\.00<\/span>/);
assert.match(recommendationWrap.innerHTML, /credit cards \$200\.00/);
assert.match(recommendationWrap.innerHTML, /loans\/mortgages \$300\.00/);
assert.match(recommendationWrap.innerHTML, /other\/unknown unknown/);
assert.doesNotMatch(recommendationWrap.innerHTML, /other\/unknown \$0\.00/);
assert.match(recommendationWrap.innerHTML, /cannot identify a safe reduction from the saved facts/);
assert.match(recommendationWrap.innerHTML, /percentage of a declining balance/);
assert.match(recommendationWrap.innerHTML, /recast or refinance/);
assert.match(recommendationWrap.innerHTML, /Paying off a card requires cash/);
assert.match(recommendationWrap.innerHTML, /reserve cash should not be used to pay cards now/);
assert.match(recommendationWrap.innerHTML, /Extra debt payments remain \$0\.00 until recurring commitments are covered and the reserve forecast passes/);
assert.doesNotMatch(recommendationWrap.innerHTML, /safe to reduce|adjustable|optional bill/i);
const cashPictureSummaryHtml = recommendationWrap.innerHTML.split('<summary>View income sources</summary>')[0];
assert.doesNotMatch(cashPictureSummaryHtml, /Visa|House loan|Blank Card/);
assert.doesNotMatch(cashPictureSummaryHtml, /justify-content:\s*space-between/);
assert.doesNotMatch(recommendationWrap.innerHTML, /<summary>Debt minimums by account<\/summary>/);
assert.match(recommendationWrap.innerHTML, /Visa[\s\S]*Credit Card[\s\S]*\$200\.00/);
assert.match(recommendationWrap.innerHTML, /House loan[\s\S]*Loan[\s\S]*\$300\.00/);
assert.match(recommendationWrap.innerHTML, /Blank Card[\s\S]*Unknown[\s\S]*unknown/);
assert.doesNotMatch(recommendationWrap.innerHTML, /Blank Card[\s\S]{0,80}\$0\.00/);
assert.match(recommendationWrap.innerHTML, /<caption>Income sources<\/caption>[\s\S]*<th scope="col" class="debt-payoff-num">Monthly amount<\/th>[\s\S]*Salary[\s\S]*\$1,200\.00/);
assert.match(recommendationWrap.innerHTML, /<caption>Required bills<\/caption>[\s\S]*<th scope="col" class="debt-payoff-num">Monthly amount<\/th>[\s\S]*Rent[\s\S]*\$1,000\.00/);
assert.match(recommendationWrap.innerHTML, /<caption>Debt accounts and minimum payments<\/caption>[\s\S]*<th scope="col" class="debt-payoff-num">Monthly minimum<\/th>[\s\S]*Visa[\s\S]*\$200\.00/);
assert.match(recommendationWrap.innerHTML, /Investment sources[\s\S]*Saved sources are not listed on this view/);
assert.equal((recommendationWrap.innerHTML.match(/<span class="debt-payoff-cash-picture-label">(?:Income|Household bills|Debt payments|Investment commitments)<\/span>/g) || []).length, 4);
assert.equal((recommendationWrap.innerHTML.match(/<summary>View (?:income sources|household bills|debt accounts|investment sources)<\/summary>/g) || []).length, 4);
assert.match(recommendationWrap.innerHTML,
  /<article class="debt-payoff-cash-picture-card[\s\S]*?debt-payoff-cash-picture-label">Income<\/span>[\s\S]*?<summary>View income sources<\/summary>[\s\S]*?debt-payoff-cash-picture-panel[\s\S]*?<\/article>/);
assert.match(recommendationWrap.innerHTML,
  /<article class="debt-payoff-cash-picture-card[\s\S]*?debt-payoff-cash-picture-label">Household bills<\/span>[\s\S]*?<summary>View household bills<\/summary>[\s\S]*?<\/article>/);
assert.match(recommendationWrap.innerHTML,
  /<article class="debt-payoff-cash-picture-card[\s\S]*?debt-payoff-cash-picture-label">Debt payments<\/span>[\s\S]*?<summary>View debt accounts<\/summary>[\s\S]*?<\/article>/);
assert.match(recommendationWrap.innerHTML,
  /<article class="debt-payoff-cash-picture-card[\s\S]*?debt-payoff-cash-picture-label">Investment commitments<\/span>[\s\S]*?<summary>View investment sources<\/summary>[\s\S]*?<\/article>/);
assert.doesNotMatch(recommendationWrap.innerHTML,
  /<\/article>\s*<details class="debt-payoff-details debt-payoff-cash-picture-details"/);
const shortfallHtml = (recommendationWrap.innerHTML.match(
  /<p class="debt-payoff-cash-picture-shortfall debt-payoff-tone-deficit">[\s\S]*?<\/p>/
) || [])[0] || '';
assert.match(shortfallHtml, /Monthly shortfall/);
assert.doesNotMatch(shortfallHtml, /<summary>|<details/);
assert.doesNotMatch(recommendationWrap.innerHTML, /Income, commitments, and reserve protection/);
assert.doesNotMatch(recommendationWrap.innerHTML, /Do not pay extra this month/);
assert.doesNotMatch(recommendationWrap.innerHTML, /Supported monthly extra/);
assert.doesNotMatch(recommendationWrap.innerHTML, /debt-payoff-strategy-grid/);
assert.doesNotMatch(recommendationWrap.innerHTML, /How this was calculated/);
assert.doesNotMatch(recommendationWrap.innerHTML, /Household payoff strategy comparison/);
assert.match(calcWrap.innerHTML, /Calculation details and source data/);
assert.match(calcWrap.innerHTML, /<summary>How this was calculated<\/summary>/);
assert.doesNotMatch(debtOverviewPageHtml_(), /<summary>Monthly income and commitments<\/summary>/);
assert.match(calcWrap.innerHTML, /<summary>Reserve protection<\/summary>/);
assert.match(calcWrap.innerHTML, /Canonical reserve/);
assert.match(debtOverviewPageHtml_(), /not treated as \$0/);
assert.doesNotMatch(debtOverviewPageHtml_(), /The cash-safety check covers three months/);
assert.doesNotMatch(debtOverviewPageHtml_(), /not a payment and is not saved/);
assert.doesNotMatch(debtOverviewPageHtml_(), /debt-payoff-nested-details[^>]*\sopen/);

const livePictureHtml = uiContext.renderDebtPayoffBreakEvenHtml_({
  state: 'WITHHELD',
  code: 'NO_SURPLUS',
  breakEven: { state: 'DEFICIT', gapToBreakEven: 11208.12, noSafeLump: true }
}, {
  deficit: true,
  components: {
    recurringIncomeMonthly: 22033.22,
    recurringBillsMonthly: 4653.61,
    variableBillsMonthly: 4387.57,
    debtMinimumsMonthly: 22018.49,
    policyFloorMonthly: 2166.67,
    unmatchedInvestmentBillsMonthly: 15
  },
  recurringSurplusBeforeReserve: -11208.12,
  cashPicture: liveCashPicture
});
assert.match(livePictureHtml, /Monthly cash picture/);
assert.match(livePictureHtml, /<span class="debt-payoff-cash-picture-label">Income<\/span><span class="debt-payoff-cash-picture-value">\$22,033\.22<\/span>/);
assert.match(livePictureHtml, /<span class="debt-payoff-cash-picture-label">Household bills<\/span><span class="debt-payoff-cash-picture-value">\$9,041\.18<\/span>/);
assert.match(livePictureHtml, /required \$4,653\.61/);
assert.match(livePictureHtml, /variable \$4,387\.57/);
assert.match(livePictureHtml, /<span class="debt-payoff-cash-picture-label">Debt payments<\/span><span class="debt-payoff-cash-picture-value">\$22,018\.49<\/span>/);
assert.match(livePictureHtml, /credit cards \$3,140\.63/);
assert.match(livePictureHtml, /HELOC \$400\.00/);
assert.match(livePictureHtml, /loans\/mortgages \$18,477\.86/);
assert.match(livePictureHtml, /<span class="debt-payoff-cash-picture-label">Investment commitments<\/span><span class="debt-payoff-cash-picture-value">\$2,181\.67<\/span>/);
assert.match(livePictureHtml, /policy floors \$2,166\.67/);
assert.match(livePictureHtml, /other bills \$15\.00/);
assert.match(livePictureHtml, /<span class="debt-payoff-cash-picture-label">Monthly shortfall<\/span><span class="debt-payoff-cash-picture-value">\$11,208\.12<\/span>/);
assert.doesNotMatch(livePictureHtml, /Monthly gap to break even: \$11,208\.12/);
assert.equal((livePictureHtml.match(/\$11,208\.12/g) || []).length, 1);
assert.match(livePictureHtml, /<th scope="col" class="debt-payoff-num">Monthly amount<\/th>/);
assert.match(livePictureHtml, /<th scope="col" class="debt-payoff-num">YTD total<\/th>/);
assert.match(livePictureHtml, /<th scope="col" class="debt-payoff-num">Monthly minimum<\/th>/);
assert.match(livePictureHtml, /debt-payoff-tone-deficit/);
assert.match(livePictureHtml, /debt-payoff-tone-info/);
assert.match(livePictureHtml, /Cisco Pay[\s\S]*\$18,000\.00/);
assert.match(livePictureHtml, /Oakley rent[\s\S]*\$4,033\.22/);
assert.match(livePictureHtml, /Chase card[\s\S]*\$3,140\.63/);
assert.match(livePictureHtml, /<caption>Variable bills<\/caption>[\s\S]*Costco[\s\S]*\$43,875\.70[\s\S]*10[\s\S]*\$4,387\.57/);
assert.match(livePictureHtml, /Whole life floor[\s\S]*\$2,166\.67/);
assert.match(livePictureHtml, /Other investment bill[\s\S]*\$15\.00/);
assert.doesNotMatch(livePictureHtml, /debt-payoff-cash-picture-details[^>]*\sopen/);
assert.equal((livePictureHtml.match(/<article class="debt-payoff-cash-picture-card/g) || []).length, 4);
assert.equal((livePictureHtml.match(/<summary>View (?:income sources|household bills|debt accounts|investment sources)<\/summary>/g) || []).length, 4);
assert.match(livePictureHtml,
  /<article class="debt-payoff-cash-picture-card[\s\S]*?View income sources[\s\S]*?Cisco Pay[\s\S]*?<\/article>/);
assert.match(livePictureHtml,
  /<article class="debt-payoff-cash-picture-card[\s\S]*?View household bills[\s\S]*?Costco[\s\S]*?<\/article>/);
assert.match(livePictureHtml,
  /<article class="debt-payoff-cash-picture-card[\s\S]*?View debt accounts[\s\S]*?Chase card[\s\S]*?<\/article>/);
assert.match(livePictureHtml,
  /<article class="debt-payoff-cash-picture-card[\s\S]*?View investment sources[\s\S]*?Whole life floor[\s\S]*?<\/article>/);
assert.doesNotMatch(livePictureHtml,
  /<\/article>\s*<details class="debt-payoff-details debt-payoff-cash-picture-details"/);
assert.match(livePictureHtml, /class="debt-payoff-cash-picture-stack"/);
assert.match(livePictureHtml, /class="debt-payoff-cash-picture-shortfall debt-payoff-tone-deficit"/);
const liveShortfallHtml = (livePictureHtml.match(
  /<p class="debt-payoff-cash-picture-shortfall debt-payoff-tone-deficit">[\s\S]*?<\/p>/
) || [])[0] || '';
assert.match(liveShortfallHtml, /\$11,208\.12/);
assert.doesNotMatch(liveShortfallHtml, /<summary>|<details/);
assert.doesNotMatch(livePictureHtml.split('<summary>View income sources</summary>')[0], /Cisco Pay|Costco|Chase card|Whole life floor/);
const cashPictureOpened = { open: true };
const cashPictureOther = { open: true };
const cashPictureClosed = { open: false };
const cashPictureStack = {
  querySelectorAll: function() { return [cashPictureOpened, cashPictureOther, cashPictureClosed]; }
};
cashPictureOpened.closest = function() { return cashPictureStack; };
uiContext.debtPayoffCashPictureExclusiveOpen_(cashPictureOpened);
assert.equal(cashPictureOpened.open, true);
assert.equal(cashPictureOther.open, false);
assert.equal(cashPictureClosed.open, false);

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
const zeroExtraHtml = debtOverviewPageHtml_();
assert.match(zeroExtraHtml, /<strong>\$0 extra this month<\/strong>/);
assert.equal((zeroExtraHtml.match(/\$0 extra this month/g) || []).length, 1);
assert.doesNotMatch(zeroExtraHtml, /No recurring extra this month/);
assert.doesNotMatch(zeroExtraHtml, /not recommended as a one-time extra payment/);
assert.doesNotMatch(zeroExtraHtml, /<summary>No recurring extra to compare<\/summary>/);
assert.doesNotMatch(zeroExtraHtml, /One-time use of cash above the reserve is not evaluated here/);
assert.doesNotMatch(zeroExtraHtml, /Projected; one-time use is not evaluated/);
assert.match(zeroExtraHtml, /One-time extra from cash above reserve/);
assert.match(zeroExtraHtml, /No one-time extra is labeled safe/);
assert.match(zeroExtraHtml,
  /<summary>Why extra stays \$0\.00<\/summary>[\s\S]*Recurring commitments exceed recurring income/);
assert.doesNotMatch(zeroExtraHtml.split('<summary>Why extra stays $0.00</summary>')[0],
  /Recurring commitments exceed recurring income/);
assert.doesNotMatch(zeroExtraHtml, /Monthly gap to break even: \$11,233\.45/);
assert.match(zeroExtraHtml, /Monthly shortfall[\s\S]*\$11,233\.45/);
assert.equal((zeroExtraHtml.match(/Monthly shortfall/g) || []).length, 1);
assert.match(zeroExtraHtml, /cannot identify a safe reduction from the saved facts/);
assert.match(zeroExtraHtml, /Extra debt payments remain \$0\.00 until recurring commitments are covered and the reserve forecast passes/);
assert.match(zeroExtraHtml, /percentage of a declining balance/);
assert.match(zeroExtraHtml, /recast or refinance/);
assert.match(zeroExtraHtml, /reserve cash should not be used to pay cards now/);
assert.doesNotMatch(zeroExtraHtml, /safe to reduce|adjustable|optional bill/i);
assert.match(zeroExtraHtml, /Shortfall month: 2027-04/);
assert.doesNotMatch((zeroExtraHtml.match(/<section class="debt-payoff-one-time"[\s\S]*?<\/section>/) || [''])[0]
  .replace(/<details[\s\S]*?<\/details>/g, ''),
  /usable cash/i);
assert.doesNotMatch((zeroExtraHtml.match(/<section class="debt-payoff-one-time"[\s\S]*?<\/section>/) || [''])[0]
  .replace(/<details[\s\S]*?<\/details>/g, ''),
  /as the monthly deficit of \$11,233\.45 continues/);
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
assert.match(zeroExtraHtml, /Monthly shortfall/);
assert.match(zeroExtraHtml, /<summary>How this was calculated<\/summary>/);
assert.doesNotMatch(zeroExtraHtml, /<summary>Monthly income and commitments<\/summary>/);
assert.doesNotMatch(zeroExtraHtml, /<summary>Debt minimums by account<\/summary>/);
assert.match(zeroExtraHtml, /<summary>Reserve protection<\/summary>/);
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
assert.doesNotMatch(recommendationWrap.innerHTML, /percentage of a declining balance/);
assert.match(recommendationWrap.innerHTML, /cannot identify a safe reduction from the saved facts/);
assert.doesNotMatch(recommendationWrap.innerHTML, /safe to reduce|adjustable|optional bill/i);
assert.match(recommendationWrap.innerHTML, /PG&amp;E is missing a completed-month Cash Flow amount/);
assert.match(recommendationWrap.innerHTML, /Salary[\s\S]*Expected Amount/);
assert.match(debtOverviewPageHtml_(), /How this was calculated/);
assert.match(debtOverviewPageHtml_(), /Unknown data/);
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
assert.match(recommendationWrap.innerHTML, /<strong>\$0 extra this month<\/strong>/);
assert.doesNotMatch(recommendationWrap.innerHTML, /No recurring extra this month/);
assert.doesNotMatch(recommendationWrap.innerHTML, /Monthly gap to break even/);
assert.match(recommendationWrap.innerHTML, /2026-12/);
assert.match(recommendationWrap.innerHTML, /Insurance \(\$12000\.00\)/);
assert.doesNotMatch(recommendationWrap.innerHTML, /The cash-safety check covers three months/);
assert.match(recommendationWrap.innerHTML,
  /<summary>Why extra stays \$0\.00<\/summary>[\s\S]*usable cash below This Week’s \$1000\.00 canonical reserve/);
assert.doesNotMatch(recommendationWrap.innerHTML.split('<summary>Why extra stays $0.00</summary>')[0],
  /usable cash below This Week’s \$1000\.00 canonical reserve/);
assert.match(debtOverviewPageHtml_(), /<summary>Upcoming expenses<\/summary>/);
assert.match(debtOverviewPageHtml_(), /Reserve breach/);
assert.match(debtOverviewPageHtml_(), /Shortfall month: 2026-12/);
assert.match(debtOverviewPageHtml_(), /Outside this 3-month check: After-horizon tuition \(due 2027-02-01/);
assert.doesNotMatch(recommendationWrap.innerHTML, /debt-payoff-strategy-grid/);

uiContext.renderDebtPayoffMonthlyRecommendation_({
  state: 'WITHHELD',
  code: 'RESERVE_PROTECTS',
  reason: 'Usable cash after buffers does not yet cover This Week’s canonical reserve, so no extra debt payment is recommended.',
  monthlyExtra: 0,
  comparison: null,
  oneTimeAllocation: {
    state: 'EVALUATED',
    code: 'RESERVE_PROTECTS',
    evaluated: true,
    amount: 0,
    actionKey: 'NONE',
    actionTitle: 'No one-time extra',
    why: 'Usable cash after buffers does not yet cover This Week’s canonical reserve, so no one-time extra debt payment is evaluated.',
    assumptions: [
      'This one-time amount is separate from the monthly extra recommendation and the optional hypothetical scenario.'
    ]
  }
}, {
  available: true,
  amount: 0,
  reserveProtects: true,
  usableCashAfterBuffers: 0,
  requiredReserveAmount: 29933.26
});
const reserveProtectsHtml = recommendationWrap.innerHTML;
assert.match(reserveProtectsHtml, /<strong>\$0 extra this month<\/strong>/);
assert.match(reserveProtectsHtml,
  /<summary>Why extra stays \$0\.00<\/summary>[\s\S]*Usable cash after buffers does not yet cover This Week’s canonical reserve, so no extra debt payment is recommended/);
assert.doesNotMatch(reserveProtectsHtml.split('<summary>Why extra stays $0.00</summary>')[0],
  /Usable cash after buffers does not yet cover This Week’s canonical reserve/);
assert.match(reserveProtectsHtml, /One-time extra from cash above reserve/);
assert.match(reserveProtectsHtml, /No one-time extra/);
assert.doesNotMatch((reserveProtectsHtml.match(/<section class="debt-payoff-one-time"[\s\S]*?<\/section>/) || [''])[0]
  .replace(/<details[\s\S]*?<\/details>/g, ''),
  /Usable cash after buffers does not yet cover This Week’s canonical reserve/);
assert.match(reserveProtectsHtml, /separate from this month’s extra-payoff recommendation/);
assert.doesNotMatch(reserveProtectsHtml, /Monthly gap to break even/);

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
const recommendationHtml = debtOverviewPageHtml_();
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
assert.match(recommendationHtml, /<th scope="col">Bill<\/th>[\s\S]*<th scope="col" class="debt-payoff-num">YTD total<\/th>[\s\S]*<th scope="col" class="debt-payoff-num">Months<\/th>[\s\S]*<th scope="col" class="debt-payoff-num">Monthly average<\/th>/);
assert.match(recommendationHtml, /PG&amp;E[\s\S]*\$1,200\.00[\s\S]*9[\s\S]*\$133\.33/);
assert.match(recommendationHtml, /debt-payoff-comparison-row--recommended/);
assert.match(recommendationHtml, /debt-payoff-recommended-label/);
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
assert.match(resultsHtml, /<th scope="col">Debt-free<\/th>/);
assert.match(resultsHtml, /<th scope="col" class="debt-payoff-num">Total interest<\/th>/);
assert.match(resultsHtml, /<th scope="col" class="debt-payoff-num">vs baseline<\/th>/);
assert.match(resultsHtml, /<tr class="debt-payoff-comparison-expand-row"><td colspan="4">/);
assert.doesNotMatch(resultsHtml, /<th scope="col">Details<\/th>/);
assert.ok(
  resultsHtml.indexOf('Debt-free') < resultsHtml.indexOf('Payoff order and allocation'),
  'debt-free month, interest, and signed difference must sit above collapsed payoff details'
);
assert.doesNotMatch(resultsHtml, /debt-payoff-recommended-label/);
assert.doesNotMatch(resultsHtml, /Payoff order and allocation[\s\S]{0,80}\sopen/);
assert.match(resultsHtml, /<summary>Payoff order and allocation<\/summary>/);
assert.match(resultsHtml, /<details class="debt-payoff-details debt-payoff-strategy-assumptions">[\s\S]*<summary>Calculation assumptions<\/summary>/);
assert.match(resultsHtml, /Selected bonus events/);
assert.doesNotMatch(resultsHtml, /Avalanche applies monthly extra and bonus payments highest APR first/);
assert.doesNotMatch(resultsHtml, /Annualized monthly equivalent/);
assert.doesNotMatch(resultsHtml, /aria-hidden="true"/);

assert.match(projection, /function buildDebtPayoffHouseholdPlan_/);
assert.match(projection, /function getDebtPayoffHouseholdPlan/);
assert.match(sliceFunction(projection, 'simulateDebtPayoffSchedule_'),
  /rollReleasedPayments/);
assert.match(sliceFunction(projection, 'simulateDebtPayoffSchedule_'),
  /contractualPrincipalPayment/);
assert.match(projection, /function debtPayoffContractualPrincipalPayment_/);
assert.doesNotMatch(sliceFunction(projection, 'simulateDebtPayoffSchedule_'),
  /\.minimumPayment\s*=/);
assert.doesNotMatch(sliceFunction(projection, 'buildDebtPayoffHouseholdPlan_'),
  /400/);
assert.doesNotMatch(capital, /buildDebtPayoffHouseholdPlan_|getDebtPayoffHouseholdPlan/);
assert.doesNotMatch(rolling, /buildDebtPayoffHouseholdPlan_|getDebtPayoffHouseholdPlan/);
assert.doesNotMatch(thisWeekClient, /getDebtPayoffHouseholdPlan/);
assert.match(sliceFunction(client, 'formatDebtPayoffStrategyDate_'),
  /Incomplete — P&I versus escrow is not saved/);
assert.match(sliceFunction(client, 'formatDebtPayoffStrategyDate_'),
  /conditional estimate/);
assert.doesNotMatch(sliceFunction(client, 'formatDebtPayoffStrategyDate_'),
  /Incomplete — mortgage payoff month is not reliable/);
assert.match(help, /Remaining contractual term is not required to show that estimate/);
assert.match(help, /March 2027 rate change/);
assert.match(help, /April 2027 P&amp;I change/);
assert.match(help, /hypothetical and not currently affordable/);
assert.doesNotMatch(help, /mortgage payoff month is flagged and is not shown as a reliable date/);
assert.match(plannerCore, /remainingTermKnown/);
assert.match(projection, /function debtPayoffModeledPayoffMonths_/);
assert.match(projection, /function applyDebtPayoffMortgageTimingFlags_/);
assert.match(client, /function renderDebtPayoffHouseholdPlanHtml_/);
assert.match(client, /function runDebtPayoffHouseholdCustomOrder_/);
assert.match(sliceFunction(client, 'runDebtPayoffHouseholdCustomOrder_'),
  /getDebtPayoffHouseholdPlan\(/);
assert.match(help, /Keeping a paid-off debt’s payment improves monthly cash flow/);
assert.match(help, /does not improve cash flow until the rollover stops/);
assert.match(help, /payment relief is unknown rather than treating the full minimum as freed/);
assert.match(help, /full saved minimum is not applied to principal/);
assert.match(help, /payoff dates and interest are not reported as reliable/);
assert.match(help, /does not add \$400 to a mortgage/);
assert.match(body, /id="debtPayoff"/);
assert.doesNotMatch(body, /id="householdDebtPayoff"/);

function householdDebt(name, type, balance, apr, min, extras) {
  const row = usableDebt(name, balance, apr, min);
  row.type = type;
  row.originalName = name;
  extras = extras || {};
  Object.keys(extras).forEach(function(key) { row[key] = extras[key]; });
  return row;
}

const cardA = householdDebt('Card A', 'Credit Card', 20, 0, 20);
const cardB = householdDebt('Card B', 'Credit Card', 40, 0, 10);
const cardPlan = context.buildDebtPayoffHouseholdPlan_([cardA, cardB], {
  asOfDate: asOf,
  monthlyExtra: 0,
  extraIsSafe: false,
  reserveBreached: true
});
assert.equal(cardPlan.monthlyExtra, 0);
assert.equal(cardPlan.extraIsSafe, false);
assert.equal(cardPlan.proposedMortgageExtra, 0);
assert.equal(cardPlan.rolloverIsSafe, false);
assert.equal(cardPlan.cardMinimumsHeldConstant, true);
assert.equal(cardPlan.strategies.keep_cash.improvesMonthlyCashFlowOnRelease, true);
assert.equal(cardPlan.strategies.avalanche_roll.improvesMonthlyCashFlowOnRelease, false);
assert.equal(cardPlan.strategies.keep_cash.debtFreeMonthIndex, 4);
assert.equal(cardPlan.strategies.avalanche_roll.debtFreeMonthIndex, 2);
assert.ok(cardPlan.strategies.avalanche_roll.debtFreeMonthIndex <
  cardPlan.strategies.keep_cash.debtFreeMonthIndex,
  'rolling freed card minimums must finish sooner than keeping cash');
assert.equal(cardPlan.strategies.keep_cash.paymentReleases[0].disposition, 'household_cash');
assert.equal(cardPlan.strategies.keep_cash.paymentReleases[0].amount, 20);
assert.equal(cardPlan.strategies.keep_cash.paymentReleases[0].cashFlowStartsMonthIndex, 2);
assert.equal(cardPlan.strategies.avalanche_roll.paymentReleases[0].disposition, 'rolled_to_next');
assert.equal(cardPlan.strategies.avalanche_roll.paymentReleases[0].amount, 20);
assert.equal(cardPlan.strategies.keep_cash.hypothetical, true);
assert.equal(cardPlan.strategies.avalanche_roll.rolloverIsSafe, false);

const overlayNoRoll = context.compareDebtPayoffStrategies_([cardA, cardB], 0, { asOfDate: asOf });
assert.equal(overlayNoRoll.strategies.avalanche.totalInterest,
  overlayNoRoll.strategies.minimum_only.totalInterest,
  'optional overlay avalanche must not roll freed minimums');
assert.equal(overlayNoRoll.strategies.avalanche.debtFreeMonthIndex,
  overlayNoRoll.strategies.minimum_only.debtFreeMonthIndex);

const missingPi = householdDebt(
  'Bank of America Loan - Lake Tahoe House', 'Loan', 200000, 4, 1500, {
    linkedProperty: 'Lake Tahoe House'
  });
const carLoan = householdDebt('Car Loan', 'Loan', 8000, 6, 250);
const householdHeloc = householdDebt('HELOC', 'HELOC', 12000, 8, 100);
const mtbSavedApr = 6.875;
const mtb = householdDebt('MTB Bank - MO 4 Plex', 'Loan', 101450.59, mtbSavedApr, 2047.21, {
  linkedProperty: 'MO 4 Plex',
  escrowPayment: 873.73,
  escrowKnown: true,
  remainingTermMonths: 119,
  remainingTermKnown: true,
  unverifiedTaxInsuranceAmount: 1485.20
});
const householdDebts = [cardA, cardB, carLoan, householdHeloc, missingPi, mtb];
const noSafePlan = context.buildDebtPayoffHouseholdPlan_(householdDebts, {
  asOfDate: asOf,
  monthlyExtra: 0,
  extraIsSafe: false,
  reserveBreached: true,
  targetOrder: ['MTB Bank - MO 4 Plex'],
  monthlyDeficit: 11208.12,
  usableCashAfterBuffers: 0,
  requiredReserveAmount: 29933.26
});
assert.equal(noSafePlan.monthlyExtra, 0);
assert.equal(noSafePlan.extraIsSafe, false);
assert.equal(noSafePlan.reserveBreached, true);
assert.equal(noSafePlan.rolloverIsSafe, false);
assert.equal(noSafePlan.proposedMortgageExtra, 0);
assert.equal(noSafePlan.mortgageExtraHypothetical, false);
assert.equal(noSafePlan.modeledDebtNames.join('|'),
  'Card A|Card B|Car Loan|HELOC|Bank of America Loan - Lake Tahoe House|MTB Bank - MO 4 Plex');
assert.equal(Number((2047.21 - 873.73).toFixed(2)), 1173.48);
const mtbRecon = noSafePlan.mortgageReconciliations.filter(function(row) {
  return row.name === 'MTB Bank - MO 4 Plex';
})[0];
assert.equal(mtbRecon.savedBalance, 101450.59);
assert.equal(mtbRecon.savedApr, mtbSavedApr);
assert.equal(mtbRecon.savedApr, mtb.interestRate,
  'planner must use the saved CashCompass APR, not a substituted fixture');
assert.equal(mtbRecon.savedMinimum, 2047.21);
assert.equal(mtbRecon.escrowPayment, 873.73);
assert.equal(mtbRecon.derivedPrincipalAndInterest, 1173.48);
assert.equal(mtbRecon.remainingTermMonths, 119);
assert.equal(mtbRecon.amortizedPayment,
  context.debtPayoffAmortizingPayment_(101450.59, mtbSavedApr, 119));
assert.notEqual(Number(mtbRecon.amortizedPayment.toFixed(2)), 1173.48);
assert.ok(Math.abs(mtbRecon.amortizedPayment - 1173.48) > 4 &&
  Math.abs(mtbRecon.amortizedPayment - 1173.48) < 6,
  'saved APR and 119 remaining payments should flag the roughly $5/month P&I mismatch');
assert.equal(mtbRecon.mismatch, true,
  'saved APR and 119 remaining payments must not silently overwrite derived P&I');
assert.equal(mtbRecon.savedValuesUnchanged, true);
assert.equal(mtbRecon.ignoredUnverifiedAmounts[0].amount, 1485.2);
assert.match(mtbRecon.ignoredUnverifiedAmounts[0].reason, /not treated as a monthly escrow/);
assert.equal(
  context.debtPayoffContractualPrincipalPayment_(mtb).amount,
  1173.48
);
assert.equal(
  context.debtPayoffContractualPrincipalPayment_(missingPi).known,
  false
);
assert.equal(context.debtPayoffContractualPrincipalPayment_(carLoan).amount, 250);

assert.equal(noSafePlan.householdComparisonComplete, false);
assert.equal(noSafePlan.mortgageProjectionComplete, false);
assert.equal(noSafePlan.incompleteMortgages.map(function(row) { return row.name; }).join('|'),
  'Bank of America Loan - Lake Tahoe House');
assert.equal(noSafePlan.strategies.keep_cash.projectionIncomplete, true);
assert.equal(noSafePlan.strategies.keep_cash.totalInterestReliable, false);
assert.equal(noSafePlan.strategies.keep_cash.totalInterest, null);
assert.equal(noSafePlan.strategies.keep_cash.debtFreeMonthIndex, null);
assert.equal(noSafePlan.strategies.keep_cash.debtFreeWithinHorizon, false);
const unknownRelease = noSafePlan.strategies.keep_cash.paymentReleases.filter(function(row) {
  return row.name === 'Bank of America Loan - Lake Tahoe House';
})[0];
assert.equal(unknownRelease, undefined,
  'missing P&I must not invent a mortgage payoff date or interest total');
assert.ok(noSafePlan.strategies.keep_cash.remainingDebtNames.indexOf(
  'Bank of America Loan - Lake Tahoe House') >= 0);
const mtbRelease = noSafePlan.strategies.keep_cash.paymentReleases.filter(function(row) {
  return row.name === 'MTB Bank - MO 4 Plex';
})[0];
assert.equal(mtbRelease.amountKnown, true);
assert.equal(mtbRelease.amount, 1173.48);
assert.equal(mtbRelease.continuingEscrow, 873.73);
assert.equal(mtbRelease.disposition, 'household_cash');
assert.equal(mtbRelease.timingReliable, false,
  'MTB payoff month must stay a conditional current-APR/P&I scenario, not a lender forecast');
assert.equal(mtbRelease.conditionalEstimate, true);
assert.ok(mtbRelease.monthKey,
  'saved P&I, APR, and balance must still produce a calculated payoff month');
assert.ok(mtbRelease.cashFlowStartsMonthKey,
  'missing remaining-term agreement must not hide the calculated release month');
const carRelease = noSafePlan.strategies.keep_cash.paymentReleases.filter(function(row) {
  return row.name === 'Car Loan';
})[0];
assert.equal(carRelease.amount, 250);
assert.equal(carRelease.amountKnown, true);
const helocRelease = noSafePlan.strategies.keep_cash.paymentReleases.filter(function(row) {
  return row.name === 'HELOC';
})[0];
assert.equal(helocRelease.amount, 100);

const rolledUnknown = noSafePlan.strategies.avalanche_roll.paymentReleases.filter(function(row) {
  return row.name === 'Bank of America Loan - Lake Tahoe House';
})[0];
assert.equal(rolledUnknown, undefined,
  'missing P&I must not assume the full mortgage payment is rolled or paid off');
assert.equal(noSafePlan.strategies.avalanche_roll.projectionIncomplete, true);
assert.equal(noSafePlan.strategies.avalanche_roll.totalInterest, null);

assert.equal(noSafePlan.strategies.custom_order.extraPriorityOrder[0],
  'MTB Bank - MO 4 Plex');
assert.equal(noSafePlan.strategies.custom_order.hypothetical, true);
assert.equal(noSafePlan.strategies.custom_order.rolloverIsSafe, false);
assert.match(noSafePlan.assumptions.join(' '), /does not add \$400/);
assert.match(noSafePlan.assumptions.join(' '), /not labeled safe/);

const recWithPlan = context.buildDebtPayoffMonthlyRecommendation_(householdDebts, {
  available: true,
  amount: 0,
  deficit: true,
  reserveProtects: false,
  futureReserveProtects: true,
  cashSafety: { reason: 'Reserve would be breached.', reduced: true },
  components: {
    recurringIncomeMonthly: 1000,
    recurringBillsMonthly: 500,
    debtMinimumsMonthly: 11708.12
  },
  recurringSurplusBeforeReserve: -11208.12,
  usableCashAfterBuffers: 0,
  requiredReserveAmount: 29933.26
}, { asOfDate: asOf });
assert.equal(recWithPlan.monthlyExtra, 0);
assert.equal(recWithPlan.householdPlan.monthlyExtra, 0);
assert.equal(recWithPlan.householdPlan.extraIsSafe, false);
assert.equal(recWithPlan.householdPlan.reserveBreached, true);
assert.equal(recWithPlan.householdPlan.rolloverIsSafe, false);
assert.equal(recWithPlan.householdPlan.monthlyDeficit, 11208.12);
assert.equal(recWithPlan.householdPlan.usableCashAfterBuffers, 0);
assert.equal(recWithPlan.householdPlan.requiredReserveAmount, 29933.26);
assert.doesNotMatch(recWithPlan.householdPlan.assumptions.join(' '), /\$11,208\.12/);
assert.match(recWithPlan.householdPlan.assumptions.join(' '), /\$0\.00 usable cash/);
assert.match(recWithPlan.householdPlan.assumptions.join(' '), /\$29,933\.26/);
assert.match(recWithPlan.householdPlan.assumptions.join(' '), /hypothetical and not currently affordable/);
assert.match(recWithPlan.householdPlan.assumptions.join(' '), /how the current deficit is funded/);

const householdHtmlContext = vm.createContext({
  Date, Math, Number, String, Array, Object, JSON, isFinite,
  escapeHtml: function(value) { return String(value || ''); },
  fmtCurrency: function(n) {
    const num = Number(n);
    if (!isFinite(num)) return '—';
    const sign = num < 0 ? '-' : '';
    return sign + '$' + Math.abs(num).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  },
  __debtPayoffHouseholdPlanMeta_: null
});
vm.runInContext(
  sliceFunction(client, 'debtPayoffStrategyTitle_') +
  '\n' + sliceFunction(client, 'formatDebtPayoffInterestVsBaseline_') +
  '\n' + sliceFunction(client, 'formatDebtPayoffStrategyDate_') +
  '\n' + sliceFunction(client, 'formatDebtPayoffStrategyOrder_') +
  '\n' + sliceFunction(client, 'formatDebtPayoffPriority_') +
  '\n' + sliceFunction(client, 'debtPayoffComparisonValueClass_') +
  '\n' + sliceFunction(client, 'renderDebtPayoffHouseholdPlanHtml_') +
  '\n' + sliceFunction(client, 'renderDebtPayoffHouseholdAssumptionsHtml_') +
  '\n' + sliceFunction(client, 'debtPayoffLowestModeledInterestKey_') +
  '\n' + sliceFunction(client, 'renderDebtPayoffHouseholdComparisonHtml_') +
  '\n' + sliceFunction(client, 'renderDebtPayoffHouseholdComparisonCard_') +
  '\n' + sliceFunction(client, 'formatDebtPayoffHouseholdInterest_') +
  '\n' + sliceFunction(client, 'formatDebtPayoffComparisonInterest_') +
  '\n' + sliceFunction(client, 'debtPayoffComparisonCashFlowLabel_') +
  '\n' + sliceFunction(client, 'renderDebtPayoffComparisonDetailsHtml_') +
  '\n' + sliceFunction(client, 'renderDebtPayoffOverlayAllocationDetail_') +
  '\n' + sliceFunction(client, 'renderDebtPayoffComparisonTableHtml_') +
  '\n' + sliceFunction(client, 'renderDebtPayoffHouseholdReleasesHtml_') +
  '\n' + sliceFunction(client, 'renderDebtPayoffHouseholdCustomOrderHtml_') +
  '\n' + sliceFunction(client, 'renderDebtPayoffHouseholdStrategyCard_') +
  '\n' + sliceFunction(client, 'formatDebtPayoffPaymentReleasesHtml_'),
  householdHtmlContext
);
const householdHtml = householdHtmlContext.renderDebtPayoffHouseholdPlanHtml_(noSafePlan);
assert.match(householdHtml, /Household payoff strategy comparison/);
assert.doesNotMatch(householdHtml, /Current extra remains \$0\.00/);
assert.match(householdHtml, /not labeled safe/);
assert.match(householdHtml, /does not improve cash flow until the rollover stops/);
assert.match(householdHtml, /Hypothetical first target/);
assert.match(householdHtml, /MTB Bank - MO 4 Plex/);
assert.match(householdHtml, /does not add \$400/);
assert.match(householdHtml, /Mortgage payoff dates and interest are incomplete/);
assert.match(householdHtml, /Bank of America Loan - Lake Tahoe House/);
assert.match(householdHtml, /not applied to principal/);
assert.match(householdHtml, /required calculation input is missing/);
assert.match(householdHtml, /conditional estimate/);
assert.match(householdHtml, /March 2027 rate change/);
assert.match(householdHtml, /April 2027 P&(?:amp;)?I change/);
assert.doesNotMatch(householdHtml, /\$11,208\.12/);
assert.match(householdHtml, /\$0\.00 usable cash/);
assert.match(householdHtml, /\$29,933\.26/);
assert.match(householdHtml, /hypothetical and not currently affordable/);
assert.match(householdHtml, /required payments continue/);
assert.match(householdHtml, /released payments can be rolled/);
assert.match(householdHtml, /how the current deficit is funded/);
assert.match(householdHtml, /future new borrowing/);
assert.match(householdHtml, /<table class="debt-payoff-comparison">/);
assert.match(householdHtml, /<caption>Household payoff comparison<\/caption>/);
assert.match(householdHtml, /<th scope="col">Debt-free<\/th>/);
assert.match(householdHtml, /<th scope="col" class="debt-payoff-num">Vs keep-cash<\/th>/);
assert.match(householdHtml, /debt-payoff-comparison-value/);
assert.match(householdHtml, /<tbody class="debt-payoff-comparison-strategy">/);
assert.match(householdHtml, /<tr class="debt-payoff-comparison-expand-row"><td colspan="4">/);
assert.doesNotMatch(householdHtml, /<th scope="col">Details<\/th>/);
assert.doesNotMatch(householdHtml, /data-label="Details"/);
assert.match(householdHtml, /debt-payoff-tone-conditional/);
assert.doesNotMatch(householdHtml, /debt-payoff-tone-available/);
assert.equal(
  (householdHtml.match(/<summary>Payment releases and payoff order<\/summary>/g) || []).length,
  3
);
assert.doesNotMatch(householdHtml, /Payment releases and payoff order[\s\S]{0,80}\sopen/);
assert.equal((householdHtml.match(/debt-payoff-comparison-expand-row/g) || []).length, 3);
assert.doesNotMatch(householdHtml, /<summary>Per-debt payment releases<\/summary>/);
assert.doesNotMatch(householdHtml, /debt-payoff-recommended-label/);
assert.match(householdHtml, /<summary>Other modeled strategies<\/summary>/);
assert.doesNotMatch(householdHtml, /debt-payoff-household-alternatives[^>]*\sopen/);
assert.doesNotMatch(householdHtml, /Lowest modeled interest/);
assert.doesNotMatch(householdHtml, /Hypothetical\. Not currently affordable\. Not labeled safe/);
function fakeHouseholdCompareRow_(key, interest) {
  return {
    planKey: key,
    totalInterest: interest,
    totalInterestReliable: true,
    projectionIncomplete: false,
    hypothetical: true,
    debtFreeWithinHorizon: true,
    debtFreeMonthKey: '2036-10',
    debtFreeMonthIndex: 120,
    payoffOrder: [],
    paymentReleases: [],
    extraPriorityOrder: [],
    interestVsBaselineLabel: 'Same interest as keep-cash.'
  };
}
const avalancheLeaderHtml = householdHtmlContext.renderDebtPayoffHouseholdComparisonHtml_({
  extraIsSafe: false,
  strategies: {
    keep_cash: fakeHouseholdCompareRow_('keep_cash', 900),
    avalanche_roll: fakeHouseholdCompareRow_('avalanche_roll', 500),
    snowball_roll: fakeHouseholdCompareRow_('snowball_roll', 700)
  }
});
assert.match(avalancheLeaderHtml,
  /Highest APR first, roll released payments[\s\S]*Lowest modeled interest/);
assert.match(avalancheLeaderHtml, /Conditional lowest-interest scenario/);
assert.match(avalancheLeaderHtml, /Not affordable or recommended for this month under current facts/);
assert.match(avalancheLeaderHtml, /<summary>Other modeled strategies<\/summary>/);
assert.doesNotMatch(avalancheLeaderHtml, /debt-payoff-household-alternatives[^>]*\sopen/);
assert.doesNotMatch(avalancheLeaderHtml, /debt-payoff-recommended-label/);
assert.doesNotMatch(avalancheLeaderHtml, /debt-payoff-tone-available/);
assert.match(avalancheLeaderHtml.split('<summary>Other modeled strategies</summary>')[1] || '',
  /Minimum payments, keep released cash/);
assert.match(avalancheLeaderHtml.split('<summary>Other modeled strategies</summary>')[1] || '',
  /Smallest balance first, roll released payments/);
assert.doesNotMatch(avalancheLeaderHtml.split('<summary>Other modeled strategies</summary>')[0],
  /Smallest balance first, roll released payments/);
const snowballLeaderHtml = householdHtmlContext.renderDebtPayoffHouseholdComparisonHtml_({
  extraIsSafe: false,
  strategies: {
    keep_cash: fakeHouseholdCompareRow_('keep_cash', 900),
    avalanche_roll: fakeHouseholdCompareRow_('avalanche_roll', 700),
    snowball_roll: fakeHouseholdCompareRow_('snowball_roll', 500)
  }
});
assert.match(snowballLeaderHtml,
  /Smallest balance first, roll released payments[\s\S]*Lowest modeled interest/);
assert.doesNotMatch(snowballLeaderHtml.split('<summary>Other modeled strategies</summary>')[0],
  /Highest APR first, roll released payments/);
const safeCompareHtml = householdHtmlContext.renderDebtPayoffHouseholdComparisonHtml_({
  extraIsSafe: true,
  strategies: {
    keep_cash: fakeHouseholdCompareRow_('keep_cash', 900),
    avalanche_roll: fakeHouseholdCompareRow_('avalanche_roll', 500),
    snowball_roll: fakeHouseholdCompareRow_('snowball_roll', 700)
  }
});
assert.doesNotMatch(safeCompareHtml, /Other modeled strategies/);
assert.doesNotMatch(safeCompareHtml, /Lowest modeled interest/);
assert.equal((safeCompareHtml.match(/debt-payoff-comparison-strategy/g) || []).length, 3);
assert.equal((householdHtml.match(/March 2027/g) || []).length, 1);
assert.equal((householdHtml.match(/April 2027/g) || []).length, 1);
assert.doesNotMatch(householdHtml, /Some mortgage payoff dates are not reliable/);
assert.doesNotMatch(householdHtml, /Remaining term is not saved/);
assert.doesNotMatch(householdHtml, /values were not changed/);
const householdReleaseHtml = householdHtmlContext.formatDebtPayoffPaymentReleasesHtml_(
  noSafePlan.strategies.keep_cash);
assert.match(householdReleaseHtml, /MTB Bank - MO 4 Plex/);
assert.ok(mtbRelease.cashFlowStartsMonthKey);
assert.match(householdReleaseHtml, new RegExp('starting ' + mtbRelease.cashFlowStartsMonthKey));
assert.doesNotMatch(householdReleaseHtml, /Remaining term is not saved/);
assert.doesNotMatch(householdReleaseHtml, /values were not changed/);
assert.doesNotMatch(householdHtml, /future rate of/);
assert.doesNotMatch(householdHtml, /future P&amp;I of/);

const mtbMonth1 = context.simulateDebtPayoffSchedule_([mtb], 0, 'minimum_only', {
  asOfDate: asOf,
  horizonMonths: 1
});
const mtbWorking = context.copyDebtPayoffScenarioWorkingDebts_([mtb])[0];
assert.equal(mtbWorking.interestRate, mtbSavedApr,
  'working copy must keep the saved CashCompass APR');
assert.equal(mtbWorking.contractualPrincipalPayment, 1173.48);
const mtbMonth1Interest = context.debtPayoffScenarioMonthlyInterest_(
  mtbWorking.balance, mtbWorking.interestRate);
assert.equal(mtbMonth1.remainingBalance,
  Number((mtbWorking.balance + mtbMonth1Interest - 1173.48).toFixed(2)),
  'month-1 mortgage principal must use derived P&I, not the full payment');
assert.notEqual(mtbMonth1.remainingBalance,
  Number((mtbWorking.balance + mtbMonth1Interest - 2047.21).toFixed(2)),
  'escrow must never be applied to mortgage principal');
assert.equal(mtbMonth1.projectionIncomplete, false);
assert.equal(mtbMonth1.totalInterestReliable, true);
assert.ok(mtbMonth1.totalInterest > 0);

const mtbAsOf = new Date(2026, 10, 9);
assert.equal(context.debtPayoffScenarioMonthKey_(mtbAsOf, 1), '2026-11');
assert.equal(context.debtPayoffScenarioMonthKey_(mtbAsOf, 119), '2036-09');
assert.equal(context.debtPayoffScenarioMonthKey_(mtbAsOf, 120), '2036-10');
assert.equal(context.debtPayoffScenarioMonthKey_(mtbAsOf, 121), '2036-11');
const mtbConfirmedSim = context.simulateDebtPayoffSchedule_([mtb], 0, 'minimum_only', {
  asOfDate: mtbAsOf,
  horizonMonths: 180
});
assert.equal(mtbConfirmedSim.payoffOrder[0].monthIndex, 120,
  'saved P&I $1,173.48 at 6.875% needs 120 months, not the lender 119');
assert.equal(mtbConfirmedSim.payoffOrder[0].monthKey, '2036-10');
assert.equal(mtbConfirmedSim.paymentReleases[0].cashFlowStartsMonthIndex, 121,
  'release display is payoff month + 1, which is November 2036 from a November 2026 as-of');
assert.equal(mtbConfirmedSim.paymentReleases[0].cashFlowStartsMonthKey, '2036-11');
assert.equal(
  context.debtPayoffBalanceAfterScheduledPayments_(101450.59, mtbSavedApr, 1173.48, 119),
  811.55
);
assert.equal(
  Number(context.debtPayoffAmortizingPayment_(101450.59, mtbSavedApr, 119).toFixed(2)),
  1178.26
);
assert.notEqual(1178.26, 1173.48);

const mtbTimingPlan = context.buildDebtPayoffHouseholdPlan_([mtb], {
  asOfDate: mtbAsOf,
  monthlyExtra: 0,
  extraIsSafe: false,
  reserveBreached: true
});
const mtbTimingRecon = mtbTimingPlan.mortgageReconciliations[0];
assert.equal(mtbTimingRecon.savedApr, mtbSavedApr);
assert.equal(mtbTimingRecon.savedBalance, 101450.59);
assert.equal(mtbTimingRecon.savedMinimum, 2047.21);
assert.equal(mtbTimingRecon.derivedPrincipalAndInterest, 1173.48);
assert.equal(mtbTimingRecon.remainingTermMonths, 119);
assert.equal(mtbTimingRecon.modeledPayoffMonths, 120);
assert.equal(mtbTimingRecon.leftoverAfterRemainingTerm, 811.55);
assert.equal(Number(mtbTimingRecon.amortizedPayment.toFixed(2)), 1178.26);
assert.equal(mtbTimingRecon.savedLastPaymentMonthKey, '2036-09');
assert.equal(mtbTimingRecon.modeledPayoffMonthKey, '2036-10');
assert.equal(mtbTimingRecon.modeledReleaseMonthKey, '2036-11');
assert.equal(mtbTimingRecon.mismatch, true);
assert.equal(mtbTimingRecon.conditionalEstimate, true);
assert.equal(mtbTimingRecon.payoffTimingReliable, false);
assert.equal(mtbTimingRecon.rateResetNotModeled, true);
assert.match(mtbTimingRecon.rateResetCaveat, /March 2027 rate change/);
assert.match(mtbTimingRecon.rateResetCaveat, /April 2027 P&I change/);
assert.equal(mtbTimingRecon.savedValuesUnchanged, true);
const mtbTimingRelease = mtbTimingPlan.strategies.keep_cash.paymentReleases[0];
assert.equal(mtbTimingRelease.timingReliable, false);
assert.equal(mtbTimingRelease.conditionalEstimate, true);
assert.equal(mtbTimingRelease.modeledMonthIndex, 120);
assert.equal(mtbTimingRelease.modeledCashFlowStartsMonthIndex, 121);
assert.equal(mtbTimingRelease.modeledCashFlowStartsMonthKey, '2036-11');
assert.equal(mtbTimingRelease.monthIndex, 120);
assert.equal(mtbTimingRelease.monthKey, '2036-10');
assert.equal(mtbTimingRelease.cashFlowStartsMonthIndex, 121);
assert.equal(mtbTimingRelease.cashFlowStartsMonthKey, '2036-11');
assert.equal(mtbTimingRelease.amount, 1173.48);
assert.equal(mtbTimingPlan.strategies.keep_cash.payoffTimingReliable, false);
assert.equal(mtbTimingPlan.strategies.keep_cash.mortgageDatesAreConditional, true);
assert.equal(mtbTimingPlan.strategies.keep_cash.debtFreeMonthKey, '2036-10');
assert.equal(mtbTimingPlan.strategies.keep_cash.debtFreeMonthIndex, 120);
const mtbTimingHtml = householdHtmlContext.renderDebtPayoffHouseholdPlanHtml_(mtbTimingPlan);
assert.match(mtbTimingHtml, /conditional estimate/);
assert.match(mtbTimingHtml, /March 2027 rate change/);
assert.match(mtbTimingHtml, /April 2027 P&(?:amp;)?I change/);
assert.match(mtbTimingHtml, /not a reliable long-term MTB date/);
assert.match(mtbTimingHtml, /does not invent a future rate or payment/);
assert.match(mtbTimingHtml, /2036-10 \(month 120\)/);
assert.match(mtbTimingHtml, /starting 2036-11 \(month 121\)/);
assert.doesNotMatch(mtbTimingHtml, /Remaining term is not saved/);
assert.doesNotMatch(mtbTimingHtml, /future rate of/);
assert.equal((mtbTimingHtml.match(/March 2027/g) || []).length, 1);

const mtbNoTerm = householdDebt('MTB Bank - MO 4 Plex', 'Loan', 101450.59, mtbSavedApr, 2047.21, {
  linkedProperty: 'MO 4 Plex',
  escrowPayment: 873.73,
  escrowKnown: true
});
const mtbNoTermPlan = context.buildDebtPayoffHouseholdPlan_([mtbNoTerm], {
  asOfDate: mtbAsOf,
  monthlyExtra: 0,
  extraIsSafe: false,
  reserveBreached: true
});
assert.equal(mtbNoTermPlan.mortgageReconciliations[0].remainingTermKnown, false);
assert.equal(mtbNoTermPlan.mortgageReconciliations[0].mismatch, false);
assert.equal(mtbNoTermPlan.mortgageReconciliations[0].conditionalEstimate, true);
assert.equal(mtbNoTermPlan.mortgageReconciliations[0].estimateKind, 'conditional');
assert.doesNotMatch(mtbNoTermPlan.mortgageReconciliations[0].mismatches.join(' '),
  /Remaining term is not saved/);
assert.equal(mtbNoTermPlan.mortgageProjectionComplete, true);
assert.equal(mtbNoTermPlan.incompleteMortgages.length, 0);
assert.equal(mtbNoTermPlan.strategies.keep_cash.projectionIncomplete, false);
assert.equal(mtbNoTermPlan.strategies.keep_cash.paymentReleases[0].timingReliable, false);
assert.equal(mtbNoTermPlan.strategies.keep_cash.paymentReleases[0].conditionalEstimate, true);
assert.equal(mtbNoTermPlan.strategies.keep_cash.paymentReleases[0].monthIndex, 120);
assert.equal(mtbNoTermPlan.strategies.keep_cash.paymentReleases[0].monthKey, '2036-10');
assert.equal(mtbNoTermPlan.strategies.keep_cash.paymentReleases[0].cashFlowStartsMonthKey, '2036-11');
assert.ok(mtbNoTermPlan.strategies.keep_cash.totalInterest > 0);
const mtbNoTermHtml = householdHtmlContext.renderDebtPayoffHouseholdPlanHtml_(mtbNoTermPlan);
assert.match(mtbNoTermHtml, /conditional estimate/);
assert.match(mtbNoTermHtml, /2036-10 \(month 120\)/);
assert.doesNotMatch(mtbNoTermHtml, /Remaining term is not saved/);
assert.doesNotMatch(mtbNoTermHtml, /Mortgage payoff dates and interest are incomplete/);

const matchingTermMortgage = householdDebt('Matching Mortgage', 'Mortgage', 3000, 0, 1000, {
  escrowKnown: true,
  escrowPayment: 0,
  remainingTermMonths: 3,
  remainingTermKnown: true
});
const matchingTermPlan = context.buildDebtPayoffHouseholdPlan_([matchingTermMortgage], {
  asOfDate: mtbAsOf,
  monthlyExtra: 0,
  extraIsSafe: false,
  reserveBreached: true
});
assert.equal(matchingTermPlan.mortgageReconciliations[0].mismatch, false);
assert.equal(matchingTermPlan.mortgageReconciliations[0].conditionalEstimate, true);
assert.equal(matchingTermPlan.mortgageReconciliations[0].payoffTimingReliable, false);
assert.equal(matchingTermPlan.strategies.keep_cash.paymentReleases[0].timingReliable, false);
assert.equal(matchingTermPlan.strategies.keep_cash.paymentReleases[0].conditionalEstimate, true);
assert.equal(matchingTermPlan.strategies.keep_cash.paymentReleases[0].monthIndex, 3);
assert.equal(matchingTermPlan.strategies.keep_cash.paymentReleases[0].cashFlowStartsMonthIndex, 4);
assert.equal(matchingTermPlan.strategies.keep_cash.payoffTimingReliable, false);
assert.equal(matchingTermPlan.strategies.keep_cash.mortgageDatesAreConditional, true);
assert.equal(matchingTermPlan.strategies.keep_cash.debtFreeMonthIndex, 3);
const cardHtml = householdHtmlContext.renderDebtPayoffHouseholdPlanHtml_(cardPlan);
assert.doesNotMatch(cardHtml, /March 2027/);
assert.doesNotMatch(cardHtml, /conditional estimate/);
assert.match(cardHtml, /hypothetical and not currently affordable/);
assert.match(client, /function renderDebtPayoffHouseholdAssumptionsHtml_/);
assert.match(client, /function renderDebtPayoffHouseholdReleasesHtml_/);

const mtbZeroApr = householdDebt('MTB Zero APR', 'Loan', 101450.59, 0, 2047.21, {
  linkedProperty: 'MO 4 Plex',
  escrowPayment: 873.73,
  escrowKnown: true
});
const mtbZeroSim = context.simulateDebtPayoffSchedule_([mtbZeroApr], 0, 'minimum_only', {
  asOfDate: asOf,
  horizonMonths: 120
});
assert.equal(mtbZeroSim.debtFreeMonthIndex, 87,
  'P&I-only $1,173.48 must take 87 months at 0% APR, not the escrow-inflated 50 months');
assert.notEqual(mtbZeroSim.debtFreeMonthIndex, 50);

const tahoeOnly = context.simulateDebtPayoffSchedule_([missingPi], 0, 'minimum_only', {
  asOfDate: asOf,
  horizonMonths: 24
});
assert.equal(tahoeOnly.projectionIncomplete, true);
assert.equal(tahoeOnly.totalInterestReliable, false);
assert.equal(tahoeOnly.totalInterest, null);
assert.equal(tahoeOnly.debtFreeMonthIndex, null);
assert.equal(tahoeOnly.debtFreeWithinHorizon, false);
assert.equal(tahoeOnly.payoffOrder.length, 0);
assert.equal(tahoeOnly.remainingBalance, 200000);
assert.equal(tahoeOnly.remainingDebtNames.join('|'),
  'Bank of America Loan - Lake Tahoe House');

const typeMortgageMissing = householdDebt('Primary Mortgage', 'Mortgage', 80000, 5, 2200);
const typeMortgageSim = context.simulateDebtPayoffSchedule_(
  [typeMortgageMissing], 0, 'minimum_only', { asOfDate: asOf, horizonMonths: 12 });
assert.equal(typeMortgageSim.projectionIncomplete, true);
assert.equal(typeMortgageSim.totalInterest, null);
assert.equal(typeMortgageSim.payoffOrder.length, 0);
assert.equal(typeMortgageSim.remainingBalance, 80000);

const typeMortgageEscrow = householdDebt('Escrowed Mortgage', 'Mortgage', 10000, 0, 1000, {
  escrowKnown: true,
  escrowPayment: 400
});
const typeMortgageEscrowSim = context.simulateDebtPayoffSchedule_(
  [typeMortgageEscrow], 0, 'minimum_only', { asOfDate: asOf, horizonMonths: 1 });
assert.equal(typeMortgageEscrowSim.remainingBalance, 9400,
  'Type Mortgage must amortize derived P&I $600, not the $1,000 payment that includes escrow');
assert.notEqual(typeMortgageEscrowSim.remainingBalance, 9000);

const sjLinked = householdDebt('Loan Depot - San Jose House', 'Loan', 400000, 2.25, 1800, {
  linkedProperty: 'San Jose House'
});
const sjLinkedSim = context.simulateDebtPayoffSchedule_(
  [sjLinked], 0, 'minimum_only', { asOfDate: asOf, horizonMonths: 6 });
assert.equal(sjLinkedSim.projectionIncomplete, true);
assert.equal(sjLinkedSim.totalInterest, null);
assert.equal(sjLinkedSim.remainingBalance, 400000);

const trappedMortgage = householdDebt('Trapped Mortgage', 'Mortgage', 100000, 12, 1500, {
  escrowKnown: true,
  escrowPayment: 600
});
const trappedSim = context.simulateDebtPayoffSchedule_(
  [trappedMortgage], 0, 'minimum_only', { asOfDate: asOf, horizonMonths: 3 });
assert.ok(trappedSim.cannotAmortizeAtMinimum.indexOf('Trapped Mortgage') >= 0,
  'cannot-amortize must use P&I $900, not the $1,500 payment that includes escrow');
assert.ok(trappedSim.remainingBalance > 100000);

vm.runInContext(
  sliceFunction(projection, 'isLoanTypeForAmortization_') +
  '\n' + sliceFunction(projection, 'estimateRoughPayoffSimple_') +
  '\n' + sliceFunction(projection, 'estimateMonthsAmortizingLoan_') +
  '\n' + sliceFunction(projection, 'estimateRoughPayoffMonths_') +
  '\n' + sliceFunction(plannerCore, 'estimateMonthsToPayoff_'),
  context
);

function savedManageDebtLoan_(name, balance, apr, pi, escrow, extras) {
  extras = extras || {};
  const min = context.round2_(Number(pi) + Number(escrow));
  return householdDebt(name, extras.type || 'Loan', balance, apr, min, {
    linkedProperty: Object.prototype.hasOwnProperty.call(extras, 'linkedProperty')
      ? extras.linkedProperty
      : '',
    principalAndInterest: pi,
    principalAndInterestKnown: true,
    escrowPayment: escrow,
    escrowKnown: true
  });
}

const manageDebtSavedLoans = [
  savedManageDebtLoan_('MTB Bank - MO 4 Plex', 101450.59, mtbSavedApr, 1173.48, 873.73),
  savedManageDebtLoan_('Bank of America Loan - Lake Tahoe House', 200000, 4, 4094.30, 1007.63),
  savedManageDebtLoan_('Loan Depot - San Jose House', 400000, 2.25, 4508.07, 1246.50),
  savedManageDebtLoan_('Bank of America Loan - San Diego Condo', 250000, 3.5, 2987.29, 685.11)
];
assert.equal(manageDebtSavedLoans.length, 4);
assert.equal(manageDebtSavedLoans[0].minimumPayment, 2047.21);
assert.equal(manageDebtSavedLoans[1].minimumPayment, 5101.93);
assert.equal(manageDebtSavedLoans[2].minimumPayment, 5754.57);
assert.equal(manageDebtSavedLoans[3].minimumPayment, 3672.40);
manageDebtSavedLoans.forEach(function(debt) {
  assert.equal(debt.linkedProperty, '',
    debt.name + ' must use saved P&I even when Linked Property is blank');
  assert.equal(context.debtPayoffHasContinuingPropertyCosts_(debt), true);
  const contractual = context.debtPayoffContractualPrincipalPayment_(debt);
  assert.equal(contractual.known, true);
  assert.equal(contractual.amount, debt.principalAndInterest);
  assert.notEqual(contractual.amount, debt.minimumPayment);
  const pos = context.estimateDebtPayoffPositionMonths_(debt);
  const sim = context.simulateDebtPayoffSchedule_([debt], 0, 'minimum_only', {
    asOfDate: asOf,
    horizonMonths: 600
  });
  const fullMinMonths = context.estimateMonthsAmortizingLoan_(
    debt.balance, debt.interestRate, debt.minimumPayment, 600);
  assert.equal(pos.incomplete, false, debt.name + ' saved P&I must estimate months');
  assert.equal(pos.months, sim.payoffOrder[0].monthIndex,
    debt.name + ' account-summary months must match the household min-payment simulator');
  assert.equal(pos.months, sim.debtFreeMonthIndex);
  assert.notEqual(pos.months, fullMinMonths,
    debt.name + ' must not treat the escrowed full minimum as principal');
});
assert.equal(
  context.estimateDebtPayoffPositionMonths_(manageDebtSavedLoans[0]).months,
  120
);

const headerCtx = vm.createContext({
  DEBTS_LINKED_PROPERTY_HEADER_: 'Linked Property',
  DEBTS_PRINCIPAL_AND_INTEREST_HEADER_: 'Principal and Interest',
  DEBTS_ESCROW_PAYMENT_HEADER_: 'Escrow Payment',
  DEBTS_LAST_UPDATED_HEADER_: 'Last Updated'
});
vm.runInContext(sliceFunction(debtsSource, 'getDebtsHeaderMap_'), headerCtx);
const trimmedPiCol = headerCtx.getDebtsHeaderMap_({
  getDataRange: function() {
    return {
      getDisplayValues: function() {
        return [[
          'Account Name', 'Type', 'Account Balance', 'Due Date', 'Credit Limit',
          'Minimum Payment', 'Credit Left', 'Int Rate', 'Principal and Interest ',
          ' Escrow Payment'
        ]];
      }
    };
  }
});
assert.ok(trimmedPiCol.principalAndInterestColZero >= 0,
  'Manage Debt header lookup must trim Principal and Interest');
assert.ok(trimmedPiCol.escrowPaymentColZero >= 0,
  'Manage Debt header lookup must trim Escrow Payment');

const missingPiAfterSave = householdDebt(
  'Bank of America Loan - Lake Tahoe House', 'Loan', 200000, 4, 5101.93, {
    linkedProperty: 'Lake Tahoe House'
  });
const missingPos = context.estimateDebtPayoffPositionMonths_(missingPiAfterSave);
const missingSim = context.simulateDebtPayoffSchedule_([missingPiAfterSave], 0, 'minimum_only', {
  asOfDate: asOf,
  horizonMonths: 24
});
assert.equal(missingPos.incomplete, true);
assert.equal(missingPos.months, null);
assert.equal(missingSim.projectionIncomplete, true);
assert.equal(missingSim.payoffOrder.length, 0);
assert.notEqual(
  missingPos.months,
  context.estimateMonthsAmortizingLoan_(200000, 4, 5101.93, 600),
  'a truly missing P&I must not fall back to the full minimum'
);

const carPosition = context.estimateDebtPayoffPositionMonths_(carLoan);
assert.equal(carPosition.incomplete, false);
assert.equal(
  carPosition.months,
  context.estimateRoughPayoffMonths_(carLoan.balance, carLoan.minimumPayment, carLoan.interestRate, carLoan.type),
  'non-property loans keep the existing full-minimum amortization'
);
const helocPosition = context.estimateDebtPayoffPositionMonths_(householdHeloc);
assert.equal(helocPosition.incomplete, false);
assert.equal(
  helocPosition.months,
  context.estimateRoughPayoffMonths_(
    householdHeloc.balance, householdHeloc.minimumPayment,
    householdHeloc.interestRate, householdHeloc.type)
);
const cardPosition = context.estimateDebtPayoffPositionMonths_(cardA);
assert.equal(cardPosition.incomplete, false);
assert.equal(
  cardPosition.months,
  context.estimateRoughPayoffMonths_(cardA.balance, cardA.minimumPayment, cardA.interestRate, cardA.type)
);

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
assert.match(styles, /\.debt-payoff-household-assumptions/);
assert.match(styles, /\.debt-payoff-panel-title-row[\s\S]*display:\s*flex/);
assert.match(styles, /\.debt-payoff-comparison-value[\s\S]*white-space:\s*nowrap/);
assert.match(styles, /@media \(max-width: 900px\)[\s\S]*\.debt-payoff-comparison[\s\S]*display:\s*block/);
assert.match(styles, /@media \(max-width: 900px\)[\s\S]*\.debt-payoff-panel-title-row \.small-btn[\s\S]*width:\s*auto/);
assert.match(styles, /\.debt-payoff-cash-picture-stack[\s\S]*flex-direction:\s*column/);
assert.doesNotMatch(styles, /\.debt-payoff-cash-picture-stack[\s\S]{0,200}repeat\(2/);
assert.doesNotMatch(styles, /\.debt-payoff-cash-picture-grid[\s\S]*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
assert.doesNotMatch(styles, /debt-payoff-cash-picture-item:has\(details\[open\]\)/);
assert.match(styles, /\.debt-payoff-source-table[\s\S]*width:\s*100%/);
assert.match(styles, /\.debt-payoff-source-table th:last-child[\s\S]*text-align:\s*right/);
assert.match(styles, /\.debt-payoff-source-table \.debt-payoff-num[\s\S]*text-align:\s*right/);
assert.match(styles, /\.debt-payoff-estimate-breakdown \.debt-payoff-num[\s\S]*text-align:\s*right/);
assert.match(styles, /#debtPayoff \.activity-table th\.activity-num[\s\S]*text-align:\s*right/);
assert.match(styles, /\.debt-payoff-one-time-amount[\s\S]*font-size:\s*1\.15rem/);
assert.match(styles, /\.debt-payoff-num[\s\S]*text-align:\s*right[\s\S]*font-variant-numeric:\s*tabular-nums/);
assert.match(styles, /\.debt-payoff-variable-bill-table th:nth-child\(n\+2\)[\s\S]*text-align:\s*right/);
assert.match(styles, /\.debt-payoff-math-leader-label[\s\S]*#92400e/);
assert.doesNotMatch(styles, /\.debt-payoff-math-leader-label[\s\S]{0,200}#166534/);
assert.match(styles, /@media \(max-width: 900px\)[\s\S]*\.debt-payoff-cash-picture-stack[\s\S]*flex-direction:\s*column/);
assert.match(styles, /\.debt-payoff-comparison-expand-row/);
assert.match(styles, /\.debt-payoff-tone-info[\s\S]*#1f4e78/);
assert.match(styles, /\.debt-payoff-tone-conditional[\s\S]*#92400e/);
assert.doesNotMatch(styles, /\.debt-payoff-cash-picture[\s\S]{0,400}justify-content:\s*space-between/);
assert.doesNotMatch(sliceFunction(client, 'debtPayoffComparisonValueClass_'), /tone-available/);
assert.doesNotMatch(sliceFunction(client, 'renderDebtPayoffComparisonTableHtml_'),
  /debt-payoff-tone-available/);
assert.match(help, /compact Refresh control beside that heading/);
assert.match(help, /Monthly cash picture/);
assert.match(help, /View income sources or View debt accounts/);
assert.match(help, /only one Monthly cash picture card can be open at a time/);
assert.match(help, /has no disclosure control/);
assert.match(help, /full comparison width beneath that row/);
assert.match(help, /hypothetical savings are not colored green/);
assert.match(help, /household payoff comparison stays visible as a table/);
assert.match(help, /\$0 extra this month/);
assert.match(help, /Lowest modeled interest/);
assert.match(help, /Conditional lowest-interest scenario/);
assert.match(help, /Other modeled strategies/);
assert.match(help, /Amount column headings sit above their amounts/);
assert.match(help, /that shortfall amount is shown once/);
assert.match(help, /Why extra stays \$0\.00/);
assert.match(help, /does not repeat the usable-cash-below-reserve warning/);
assert.match(help, /Native disclosure controls stay keyboard-accessible/);
assert.match(help, /each comparison strategy stacks as its own block/);
assert.match(help, /one shared assumptions note/);
assert.match(help, /no household strategy is presented as a recommendation/);
assert.match(help, /Four visually distinct sections/);
assert.match(help, /This month’s action and Monthly cash picture/);
assert.match(help, /Debt balances and payoff estimates/);
assert.match(help, /Calculation details and source data/);
assert.match(help, /Expanded details stay inside their own section/);
assert.match(styles, /\.debt-payoff-section[\s\S]*border-radius:\s*12px/);
assert.match(styles, /\.debt-payoff-section-title[\s\S]*border-bottom:\s*1px solid #e2e8f0/);
assert.match(debtOverview, /class="debt-payoff-section debt-payoff-section--action"/);
assert.match(debtOverview, /class="debt-payoff-section debt-payoff-section--position"/);
assert.doesNotMatch(debtOverview, /debt-payoff-strategy info/);
assert.match(sliceFunction(client, 'renderDebtPayoffMonthlyRecommendation_'),
  /debt_payoff_household_wrap[\s\S]*debt_payoff_calc_wrap/);
assert.match(sliceFunction(client, 'renderDebtPayoffCalculationDetailsHtml_'),
  /Calculation details and source data/);
assert.match(sliceFunction(client, 'renderDebtPayoffTable_'),
  /<th class="activity-num">Balance<\/th>/);
assert.match(sliceFunction(client, 'renderDebtPayoffTable_'),
  /data-label="Min payment"/);
assert.match(sliceFunction(client, 'renderDebtPayoffOneTimeAllocationHtml_'),
  /debt-payoff-one-time-amount/);
assert.doesNotMatch(sliceFunction(client, 'renderDebtPayoffOneTimeAllocationHtml_'),
  /debt-payoff-recommendation-amount/);
assert.match(sliceFunction(client, 'renderDebtPayoffOneTimeAllocationHtml_'),
  /debtPayoffOneTimeWhyRepeatsReserveWarning_/);
assert.match(sliceFunction(client, 'renderDebtPayoffWhyExtraStaysHtml_'),
  /<summary>Why extra stays \$0\.00<\/summary>/);
assert.match(help, /not affordable or recommended to act on this month/);
assert.doesNotMatch(sliceFunction(projection, 'debtPayoffHouseholdPlanAssumptions_'),
  /Current extra remains ' \+ fmtCurrency_\(extra\) \+ '\. A rollover/);

console.log('checkDebtPayoffStrategyComparisonRegressions: ok');
