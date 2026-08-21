import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source = fs.readFileSync(new URL('../capital_allocation.js', import.meta.url), 'utf8');
const scenarios = fs.readFileSync(new URL('../test_harness_scenarios_rfp.js', import.meta.url), 'utf8');
const registry = fs.readFileSync(new URL('../test_harness_scenarios.js', import.meta.url), 'utf8');
const suites = fs.readFileSync(new URL('../test_harness_suites.js', import.meta.url), 'utf8');
const body = fs.readFileSync(new URL('../Dashboard_Body.html', import.meta.url), 'utf8');
const client = fs.readFileSync(new URL('../Dashboard_Script_PlanningCapitalAllocation.html', import.meta.url), 'utf8');
const styles = fs.readFileSync(new URL('../Dashboard_Styles.html', import.meta.url), 'utf8');
const template = fs.readFileSync(new URL('../PlannerDashboardWeb.html', import.meta.url), 'utf8');
const webapp = fs.readFileSync(new URL('../webapp.js', import.meta.url), 'utf8');
const dashboardData = fs.readFileSync(new URL('../dashboard_data.js', import.meta.url), 'utf8');
const plannerCore = fs.readFileSync(new URL('../planner_core.js', import.meta.url), 'utf8');

for (const forbidden of [
  '.setValue(', '.setValues(', '.appendRow(', '.insertSheet(', '.deleteSheet(',
  'appendActivityLog_(', 'getBillsDueFromCashFlowForDashboard('
]) {
  assert.equal(source.includes(forbidden), false,
    `RFP-3a must remain read-only and must not contain ${forbidden}`);
}

assert.match(source, /function getCapitalAllocationQueueFromDashboard\(payload\)/);
assert.match(source, /function getCapitalAllocationQueueForSpreadsheet_\(ss, payload\)/);
assert.match(source, /function buildCapitalAllocationQueue_\(facts\)/);
assert.match(source, /function buildCapitalAllocationPlan_\(facts\)/);
assert.match(source,
  /function readCapitalAllocationFacts_\(ss, asOfDate\)[\s\S]*?ownsDedupeCache[\s\S]*?__billsDueDedupeCache_ = \{ keys: null \}[\s\S]*?finally[\s\S]*?__billsDueDedupeCache_ = null/,
  'Planning must use one request-scoped Activity Log dedupe index');
assert.match(source, /getInputBillsDueRows_\(ss, asOfDate, tz, \{ readOnly: true \}\)/);
assert.match(scenarios, /function getHarnessRfpCapitalAllocationScenario_\(\)[\s\S]*?expectedAssertionCount:\s*16/);
assert.match(scenarios, /function getHarnessRfpCapitalAllocationWeeklyPlanScenario_\(\)[\s\S]*?expectedAssertionCount:\s*108/);
assert.match(registry, /getHarnessRfpCapitalAllocationScenario_/);
assert.match(registry, /getHarnessRfpCapitalAllocationWeeklyPlanScenario_/);
assert.match(suites, /SUITE-RFP-CAPITAL-ALLOCATION-FOUNDATION[\s\S]*?REGRESSION-RFP-CAPITAL-ALLOCATION-FOUNDATION/);
assert.match(suites, /SUITE-RFP-CAPITAL-ALLOCATION-FOUNDATION[\s\S]*?REGRESSION-RFP-CAPITAL-ALLOCATION-WEEKLY-PLAN/);
assert.match(dashboardData, /function getInputBillsDueRows_\(ss, today, tz, options\)[\s\S]*?const readOnly =/);
assert.match(source, /VARIABLE_BILL_ESTIMATE_USED:[\s\S]*?'WARNING', false/);
assert.match(source, /VARIABLE_BILL_ESTIMATE_MISSING:[\s\S]*?'ERROR', true/);
assert.match(source, /SAVED_ESTIMATED_AMOUNT/);
assert.match(source, /PROTECT_90_DAY_OPERATING_RESERVE/);
assert.match(source, /policyType:\s*'POLICY_FLOOR'/);
assert.match(source, /policyFloor:[\s\S]*?optionalAcceleration:[\s\S]*?scheduledAmount:[\s\S]*?recommendedAmount:/);
assert.match(source, /function capitalAllocationIsRevolvingDebt_/);
assert.match(source, /function capitalAllocationDebtEconomics_/);
assert.doesNotMatch(source, /interestRate[^\n]{0,120}CAPITAL_ALLOCATION_(?:CRITICAL|HIGH|MODERATE)_DEBT_APR_/,
  'APR explanation bands must never gate allocation behavior');
assert.doesNotMatch(source, /(?:150000|250000|500000|600000|1000000|goal reached|target ceiling)/i,
  'portfolio milestones must not become terminal optimization rules');
assert.doesNotMatch(source, /(?:debt(?:\.balance|Balance)|requestedAmount)[^;\n]*\*\s*0\.25/i,
  'deployment pace must not be a fixed 25% debt rule');
assert.match(source, /function buildCapitalAllocationDeploymentPace_/);
assert.match(source,
  /balancedMonthlyDeploymentCap:\s*periodBudget/,
  'the monthly policy cap must remain explicit in the plan contract');
assert.match(source,
  /Math\.min\(excess,[\s\S]*?balancedLiquidityCushion/,
  'Balanced must cap monthly deployment at the calculated liquidity cushion');
assert.doesNotMatch(source, /balancedMonthlyDeploymentCap[^\n]{0,160}(?:0\.25|0\.30|41895\.78)/,
  'the Balanced monthly cap must not use a percentage or household-specific dollar constant');
assert.match(source, /LIQUIDITY_FIRST[\s\S]*?BALANCED[\s\S]*?AGGRESSIVE_DEBT_REDUCTION/);
assert.match(source, /readCapitalAllocationForecast90_/);
assert.match(source,
  /monthlyDebtEvidenceResult = readCapitalAllocationMonthlyDebtEvidenceResult_[\s\S]*?monthlyDebtEvidence = monthlyDebtEvidenceResult\.rows[\s\S]*?readCapitalAllocationObligations_[\s\S]*?monthlyDebtEvidence[\s\S]*?readCapitalAllocationForecast90_[\s\S]*?monthlyDebtEvidence/,
  'one canonical monthly payment reconciliation must feed current requirements and the forecast');
assert.match(source, /futureOperatingOutflows30Amount/,
  'the safety proof must use a dated next-30-day gross obligation total');
assert.doesNotMatch(source, /gross30DayOutflows\s*=\s*capitalAllocationMoney_\(gross90DayOutflows\s*\/\s*3\)/,
  'next-30-day coverage must never be inferred as one third of the 90-day total');
assert.match(source, /function buildCapitalAllocationSafetyProof_/);
assert.match(source, /readCapitalAllocationFutureUpcoming_/);
assert.match(source,
  /var frequency = normalizeFrequency_\(frequencyCol === -1 \? '' : display\[r\]\[frequencyCol\]\);[\s\S]*?buildInputBillDueCandidates_\(asOfDate, dueDay, frequency,/,
  'the reserve forecast must normalize monthly, quarterly, semiannual, and annual schedules before occurrence generation');
assert.match(source, /capitalAllocationClassifyInvestmentContribution_/);
assert.match(source, /readCapitalAllocationRecurringInvestmentContributions_/);
assert.match(source, /function capitalAllocationBuildPropertyContingency_/);
assert.match(source, /minimumFloor = capitalAllocationMoney_\(historicalAllowance \* 0\.25\)/);
assert.match(source, /SAMER_ALLY_USE_POLICY_CONFLICT/);
assert.match(source, /DUPLICATE_IDENTITY_BLOCKED/);
assert.match(source, /futureOperatingOutflows = capitalAllocationMoney_\([\s\S]*?futureBills\.total \+ futureDebtMinimums\.total \+ futureUpcoming\.total \+[\s\S]*?propertyContingency\.additionalReserveAmount/);
assert.doesNotMatch(source, /futureOperatingOutflows = capitalAllocationMoney_\([\s\S]{0,180}futureInvestmentCommitments\.total/);
assert.match(source, /PROTECT_90_DAY_OPERATING_RESERVE[\s\S]*?FUND_SAMER_ROBINHOOD_WEEKLY_MINIMUM[\s\S]*?PAY_EXTRA_DEBT_BY_APR/);
assert.match(dashboardData, /function generateOccurrences_\(rule, todayOnly, effectiveDate, horizonEnd\)/);
assert.match(plannerCore, /dueDayKnown:\s*dueDayKnown/,
  'normalized debts must retain whether the source actually supplied a valid recurring due day');
assert.match(body, /planning-primary-tools[\s\S]*?class="tab-btn active"[\s\S]*?data-tab="capitalAllocationPreview"[\s\S]*?This week[\s\S]*?data-tab="rollingDebtPayoff"[\s\S]*?data-tab="debtPayoff"[\s\S]*?data-tab="retirement"[\s\S]*?data-tab="purchase"/);
assert.doesNotMatch(body, /planning-next-actions-feature|planning-tool-group--do-now|planning-tool-group--explore|data-tab="nextActions"/);
assert.match(body, /id="nextActions" class="panel"/);
assert.match(body, /id="capitalAllocationPreview" class="panel active"/);
assert.doesNotMatch(body, /Your household plan · read only/,
  'the shared This Week shell must not repeat a page-level read-only disclaimer');
assert.match(client, /getCapitalAllocationPlanFromDashboard/);
assert.match(client, /Variable bills use planning estimates/);
assert.match(client, /estimatedAmount/);
assert.match(client, /episodic bill/);
assert.match(client, /Scheduled categories[\s\S]*?are excluded here because Bills, debt minimums, or Upcoming expenses already own them/);
assert.match(client, /Keep available[\s\S]*?Hard reserve[\s\S]*?Extra cushion/);
assert.match(client, /Recommended deployment this period[\s\S]*?Potential excess cash[\s\S]*?Recommended to deploy this month[\s\S]*?Intentionally held for future decisions/);
assert.match(client, /This week\\'s recommendation/);
assert.match(client, /capitalAllocationViewTabsHtml_/);
for (const view of ['Overview', 'Debt', 'Cash', 'Investments', 'Properties', 'Forecast', 'Data']) {
  assert.match(client, new RegExp(`label: '${view}'`), `This Week must expose the ${view} subview`);
}
assert.match(client, /var allowed = \['overview', 'debt', 'cash', 'investments', 'properties', 'forecast', 'data'\]/,
  'This Week must retain exactly seven independent subviews');
assert.match(client, /var __capitalAllocationActiveView = 'overview'/,
  'This Week must open on the concise Overview cockpit');
assert.match(client, /Pay debt/);
assert.match(client, /Keep available/);
assert.match(client, /Pause for now/);
assert.match(client, /Expected results/);
assert.match(client, /Debt plan this month/);
assert.match(client, /Still to pay this month/);
assert.match(client, /Extra payoff recommendation/);
assert.match(client, /Already covered this month/);
assert.match(client, /Next extra-payoff target/);
assert.match(plannerCore, /__display__Due Date[\s\S]*?__display__Due Day/,
  'debt due-day normalization must preserve both legacy and additive header representations');
assert.match(source, /allocated > 0 && allocated < 1[\s\S]*?allocated = 0/,
  'sub-dollar optional remainders must stay in cash instead of leaking to another debt');
assert.match(styles, /capital-allocation-debt-card-grid[\s\S]*?grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/,
  'desktop Debt cards must use a compact two-column grid');
assert.match(styles, /@media \(max-width: 760px\)[\s\S]*?capital-allocation-debt-card-grid\s*\{\s*grid-template-columns:\s*1fr/,
  'Debt cards must stack to one column without a wide mobile table');
for (const statusClass of ['recommended-payoff', 'confirmed', 'awaiting', 'required-extra',
  'required', 'recommended', 'needs-update', 'past-due', 'waiting']) {
  assert.match(styles, new RegExp(`capital-allocation-debt-status--${statusClass}`),
    `Debt status styling must define ${statusClass}`);
}
assert.doesNotMatch(styles, /capital-allocation-debt-(?:status|month-card)--(?:critical|moderate|low-cost)/i,
  'APR severity must not drive customer-facing card or status color');
assert.match(client, /scheduledAmount/);
assert.match(client, /capitalAllocationContributionPeriodLabel_/);
const primaryRenderer = client.slice(client.indexOf('function capitalAllocationPrimaryDecisionHtml_'),
  client.indexOf('function capitalAllocationDecisionHtml_'));
assert.match(primaryRenderer, /Expected results[\s\S]*?View outcomes/);
assert.doesNotMatch(primaryRenderer, /Compare choices/,
  'the outcome section heading must not imply a comparison action');
assert.doesNotMatch(primaryRenderer, /Robinhood policy floor|Scheduled Robinhood amount|Recommended Robinhood funding|Optional Robinhood acceleration|Optional investing redirected|Why aren&rsquo;t we investing more/,
  'implementation concepts must stay out of the primary customer card');
assert.match(client, /Next 90 days/);
assert.match(client, /Upcoming requirements/);
assert.match(client, /Extra debt planned this week/);
assert.match(client, /Investment funding/);
assert.match(client, /Protected reserve/);
assert.match(client, /Preferred extra cushion/);
assert.doesNotMatch(client, /Unassigned cash/);
assert.match(client, /How the 90-day reserve is calculated/);
assert.match(client, /Expected gross rental income/);
assert.match(client, /Normal Robinhood policy commitments/);
assert.match(client, /View allocation logic/);
assert.match(client, /What happens next/);
assert.match(client, /Available to use/);
assert.match(client, /Protected accounts/);
assert.match(client, /eligible account/);
assert.match(client, /Awaiting confirmation/);
assert.match(client, /Tax information needed before recommending a sale/);
assert.doesNotMatch(client, /Robinhood is safety-paused/);
assert.doesNotMatch(client, /Safety paused this week/);
assert.match(client, /Protected and household-analysis accounts/);
assert.match(client, /unknown-repair floor of 25%/);
assert.match(client, /What waits[\s\S]*?No current contribution plan/);
assert.match(client, /Audit details/);
assert.match(template, /Dashboard_Script_PlanningCapitalAllocation/);
assert.doesNotMatch(client, /__cashCompassPlanningPreviewEnabled/);
assert.doesNotMatch(template, /planningPreviewEnabledJson/);
assert.doesNotMatch(webapp, /planningPreview/);
assert.match(styles, /\.capital-allocation-view-tabs\s*\{[\s\S]*?repeat\(6,/);
assert.match(styles, /@media \(max-width: 760px\)[\s\S]*?\.capital-allocation-view-tabs\s*\{[^}]*repeat\(3,/);
assert.match(styles, /@media \(max-width: 480px\)[\s\S]*?\.capital-allocation-view-tabs\s*\{[^}]*repeat\(2,/);
assert.match(styles, /@media \(max-width: 760px\)[\s\S]*?\.capital-allocation-view-tabs[\s\S]*?min-height:\s*44px/,
  'the seven-screen navigation must keep touch-friendly targets on narrow screens');

const context = { console };
vm.createContext(context);
vm.runInContext(source, context, { filename: 'capital_allocation.js' });
context.normalizeBillName_ = value => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
context.stripTime_ = value => new Date(value.getFullYear(), value.getMonth(), value.getDate());
context.daysBetween_ = (start, end) => Math.round((end.getTime() - start.getTime()) / 86400000);
context.getInputBillsPayeeMap_ = () => ({ 'loan depot sj house': true });
context.getSheetNames_ = () => ({ BILLS: 'INPUT - Bills' });
context.getAliasMap_ = () => ({ 'Loan Depot - SJ House': 'Loan Depot - San Jose House' });
context.normalizeName_ = (value, aliases) => aliases[String(value || '').trim()] || String(value || '').trim();
context.normalizeYesNo_ = value => String(value || '').trim().toLowerCase() === 'yes' ? 'yes' : 'no';
context.toNumber_ = value => Number(String(value == null ? '' : value).replace(/[$,]/g, '')) || 0;

const monthlyDebt = [{ name: 'Marriott', originalName: 'Credit Card - Marriott',
  active: true, balance: 8000, minimumPayment: 240, dueDay: 11 }];
function monthlyEvidence_(payments, asOf = new Date(2026, 7, 18)) {
  return context.capitalAllocationBuildMonthlyDebtEvidence_(monthlyDebt, payments, asOf)[0];
}
const fullRecorded = monthlyEvidence_([{ evidenceId: 'p1', accountName: 'Credit Card - Marriott',
  amount: 240, paymentDate: '2026-08-09', evidenceClass: 'RECORDED_CASH_FLOW' }]);
assert.equal(fullRecorded.status, 'RECORDED_PAID');
assert.equal(fullRecorded.remainingRequiredAmount, 0);
assert.equal(fullRecorded.paymentDate, '2026-08-09');
const partialRecorded = monthlyEvidence_([{ evidenceId: 'p2', accountName: 'Credit Card - Marriott',
  amount: 100, paymentDate: '2026-08-09', evidenceClass: 'RECORDED_CASH_FLOW' }]);
assert.equal(partialRecorded.status, 'PARTIALLY_PAID');
assert.equal(partialRecorded.remainingRequiredAmount, 140);
const overpaymentRecorded = monthlyEvidence_([{ evidenceId: 'p3', accountName: 'Credit Card - Marriott',
  amount: 300, paymentDate: '2026-08-09', evidenceClass: 'RECORDED_CASH_FLOW' }]);
assert.equal(overpaymentRecorded.status, 'RECORDED_PAID');
assert.equal(overpaymentRecorded.reconciledPaymentAmount, 240,
  'overpayments may satisfy but never create negative required obligations');
const unmatchedRecorded = monthlyEvidence_([{ evidenceId: 'p4', accountName: 'Unrelated card',
  amount: 240, paymentDate: '2026-08-09', evidenceClass: 'RECORDED_CASH_FLOW' }]);
assert.equal(unmatchedRecorded.status, 'PAST_DUE_UNPAID');
assert.equal(unmatchedRecorded.remainingRequiredAmount, 240);
const ambiguousRecorded = monthlyEvidence_([{ evidenceId: 'p5', accountName: 'Credit Card - Marriott',
  amount: 240, paymentDate: '2026-08-09', evidenceClass: 'RECORDED_CASH_FLOW', ambiguous: true }]);
assert.equal(ambiguousRecorded.status, 'PAYMENT_STATUS_UNKNOWN');
assert.equal(ambiguousRecorded.remainingRequiredAmount, 240,
  'ambiguous evidence must fail closed and retain the full requirement');
const collisionEvidence = context.capitalAllocationBuildMonthlyDebtEvidence_([
  { name: 'Shared Card', originalName: 'Shared Card', active: true, balance: 1000,
    minimumPayment: 100, dueDay: 11 },
  { name: 'Shared Card', originalName: 'Shared Card', active: true, balance: 2000,
    minimumPayment: 200, dueDay: 11 }
], [{ evidenceId: 'collision', accountName: 'Shared Card', amount: 200,
  paymentDate: '2026-08-09', evidenceClass: 'RECORDED_CASH_FLOW' }], new Date(2026, 7, 18));
assert.equal(collisionEvidence.every(row => row.status === 'PAYMENT_STATUS_UNKNOWN'), true,
  'one payment that matches multiple debt accounts must never satisfy either account silently');
assert.equal(collisionEvidence.reduce((sum, row) => sum + row.remainingRequiredAmount, 0), 300,
  'a cross-account collision must preserve every required obligation until reviewed');
const upcomingUnpaid = monthlyEvidence_([], new Date(2026, 7, 5));
assert.equal(upcomingUnpaid.status, 'UPCOMING');
const pastDueUnpaid = monthlyEvidence_([]);
assert.equal(pastDueUnpaid.status, 'PAST_DUE_UNPAID');
const duplicateEvidence = monthlyEvidence_([
  { evidenceId: 'same', accountName: 'Credit Card - Marriott', amount: 100,
    paymentDate: '2026-08-09', evidenceClass: 'RECORDED_CASH_FLOW' },
  { evidenceId: 'same', accountName: 'Credit Card - Marriott', amount: 100,
    paymentDate: '2026-08-09', evidenceClass: 'RECORDED_CASH_FLOW' }
]);
assert.equal(duplicateEvidence.recordedPaymentAmount, 100,
  'duplicate transaction evidence must be counted once');
assert.equal(duplicateEvidence.remainingRequiredAmount, 140);
const duplicateEvidenceResult = context.capitalAllocationBuildMonthlyDebtEvidenceResult_(
  monthlyDebt, [
    { evidenceId: 'same', accountName: 'Credit Card - Marriott', amount: 100,
      paymentDate: '2026-08-09', evidenceClass: 'RECORDED_CASH_FLOW' },
    { evidenceId: 'same', accountName: 'Credit Card - Marriott', amount: 100,
      paymentDate: '2026-08-09', evidenceClass: 'RECORDED_CASH_FLOW' },
    { evidenceId: 'unmatched', accountName: 'Unrelated card', amount: 50,
      paymentDate: '2026-08-09', evidenceClass: 'RECORDED_CASH_FLOW' }
  ], new Date(2026, 7, 18));
assert.equal(duplicateEvidenceResult.audit.inputEvidenceCount, 3);
assert.equal(duplicateEvidenceResult.audit.uniqueEvidenceCount, 2);
assert.equal(duplicateEvidenceResult.audit.duplicateEvidenceSuppressedCount, 1,
  'the proof packet must disclose the exact number of suppressed duplicate evidence rows');
assert.equal(duplicateEvidenceResult.audit.matchedEvidenceCount, 1);
assert.equal(duplicateEvidenceResult.audit.unmatchedEvidenceCount, 1,
  'unmatched payment evidence must remain explicit without satisfying a debt');
assert.equal(duplicateEvidenceResult.audit.ambiguousEvidenceCount, 0);
const authoritativeRecorded = monthlyEvidence_([{ evidenceId: 'auth1',
  accountName: 'Credit Card - Marriott', amount: 240, paymentDate: '2026-08-09',
  evidenceClass: 'AUTHORITATIVE_IMPORTED' }]);
assert.equal(authoritativeRecorded.status, 'CONFIRMED_PAID',
  'the seam must allow later authoritative evidence to strengthen recorded payment state');

const classifiedRobinhood = context.capitalAllocationClassifyInvestmentContribution_(
  { payee: 'Robinhood', category: '' },
  [{ investmentId: 'INV-1', accountName: 'Samer Robinhood' }]);
assert.equal(classifiedRobinhood.investmentId, 'INV-1');
assert.equal(context.capitalAllocationClassifyInvestmentContribution_(
  { payee: 'M1 Investment', category: '' }, []).isInvestmentContribution, true);
assert.equal(context.capitalAllocationIsEpisodicVariableBill_(
  { payee: 'Medical Bills', category: 'Healthcare' }), true);
assert.equal(context.capitalAllocationIsRentalIncomeSource_('Rent - San Diego'), true);
assert.equal(context.capitalAllocationIsRentalIncomeSource_('Rental Income'), true);
assert.equal(context.capitalAllocationIsRentalIncomeSource_('Salary'), false);
assert.equal(context.capitalAllocationIsSamerAllyAccount_(
  'Ally - Samer Savings Account - 0393'), true);
assert.equal(context.capitalAllocationIsSamerAllyAccount_(
  'Ally - Laith Savings Account'), false);
assert.equal(context.capitalAllocationZeroEstimateFinding_(
  { payee: 'Medical Bills' }).blocksAllocation, false);
assert.equal(context.capitalAllocationNormalizeContributionWeekly_(600, 'weekly'), 600);
assert.equal(context.capitalAllocationNormalizeContributionWeekly_(600, 'monthly'), 138.46);

const aliasedBillMap = context.capitalAllocationActiveBillPayeeMap_({
  getSheetByName() {
    return { getDataRange() { return { getDisplayValues() {
      return [['Payee', 'Active'], ['Loan Depot - SJ House', 'Yes']];
    } }; } };
  }
});
assert.equal(aliasedBillMap['loan depot san jose house'], true,
  'tracked Bill aliases must suppress the same debt minimum in the reserve forecast');

const futureDebtMinimums = context.readCapitalAllocationFutureDebtMinimums_([
  { name: 'Amex', originalName: 'Amex', active: true, balance: 10000,
    minimumPayment: 300, dueDay: 20 },
  { name: 'Low mortgage', originalName: 'Low mortgage', active: true, balance: 100000,
    minimumPayment: 900, dueDay: 1 }
], new Date(2026, 7, 14), new Date(2026, 10, 11), { amex: true });
assert.equal(futureDebtMinimums.rows.filter(row => row.name === 'Amex').length, 2,
  'the canonical Debt ledger must retain future cycles even when a tracked Bill also represents the account');
assert.equal(futureDebtMinimums.total, 3300);
const partiallyPaidFutureMinimums = context.readCapitalAllocationFutureDebtMinimums_([
  { name: 'Marriott', originalName: 'Credit Card - Marriott', active: true, balance: 8000,
    minimumPayment: 240, dueDay: 25 }
], new Date(2026, 7, 14), new Date(2026, 10, 11), {}, [{
  name: 'Marriott', originalName: 'Credit Card - Marriott', remainingRequiredAmount: 140
}]);
assert.equal(partiallyPaidFutureMinimums.rows[0].amount, 140,
  'the current cycle forecast must protect only the remaining partially paid obligation');
assert.equal(partiallyPaidFutureMinimums.total, 620,
  'later cycles retain their full minimum while the current cycle uses its reconciled remainder');
const reserveWithHighIncome = context.capitalAllocationReserve90_(12000, 30000);
assert.equal(reserveWithHighIncome.minimumOperatingFloorAmount, 4000);
assert.equal(reserveWithHighIncome.requiredReserveAmount, 4000,
  'forecast income must never erase the one-month operating floor');

let observedForecastFrequency = '';
context.Session = { getScriptTimeZone() { return 'America/Los_Angeles'; } };
context.parseDateOnlySheetCell_ = () => null;
context.buildInputBillDueCandidates_ = function(asOfDate, dueDay, frequency) {
  observedForecastFrequency = frequency;
  return [{ dueDate: new Date(2026, 10, 15) }];
};
context.normalizeFrequency_ = value => String(value || '').trim().toLowerCase() === 'yearly'
  ? 'yearly' : 'monthly';
const forecastSheetValues = [
  ['Payee', 'Default Amount', 'Due Day', 'Active', 'Frequency', 'Start Month', 'Category', 'Varies'],
  ['Annual Tax', 1000, 15, 'Yes', 'Yearly', 4, 'Taxes', 'No']
];
const forecastSheetDisplay = forecastSheetValues.map(row => row.map(value => String(value)));
const normalizedScheduleForecast = context.readCapitalAllocationFutureBills_({
  getSpreadsheetTimeZone() { return 'America/Los_Angeles'; },
  getSheetByName() {
    return { getDataRange() { return {
      getValues() { return forecastSheetValues; },
      getDisplayValues() { return forecastSheetDisplay; }
    }; } };
  }
}, new Date(2026, 7, 18), new Date(2026, 10, 15), [], []);
assert.equal(observedForecastFrequency, 'yearly',
  'title-case Yearly source data must reach the recurrence engine as the canonical yearly schedule');
assert.equal(normalizedScheduleForecast.rows.length, 1);
const debtOwnedBillForecast = context.readCapitalAllocationFutureBills_({
  getSpreadsheetTimeZone() { return 'America/Los_Angeles'; },
  getSheetByName() {
    return { getDataRange() { return {
      getValues() { return forecastSheetValues; },
      getDisplayValues() { return forecastSheetDisplay; }
    }; } };
  }
}, new Date(2026, 7, 18), new Date(2026, 10, 15), [], [], [{
  name: 'Annual Tax', originalName: 'Annual Tax', remainingRequiredAmount: 1000
}]);
assert.equal(debtOwnedBillForecast.total, 0,
  'a tracked Bill that represents a Debt-owned obligation must not create a second forecast deduction');

function extractFunction_(text, name) {
  const start = text.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} must exist`);
  const next = text.indexOf('\nfunction ', start + 10);
  return text.slice(start, next === -1 ? text.length : next);
}

const recurrenceContext = { console };
vm.createContext(recurrenceContext);
vm.runInContext([
  'monthHeaderFromYearMonth_',
  'normalizeFrequency_',
  'billAppliesInMonth_',
  'parseBillWeekday_',
  'isAnchorDateValidForWeekday_',
  'buildRuleFromBillRow_',
  'generateOccurrences_',
  'buildInputBillDueCandidates_'
].map(name => extractFunction_(dashboardData, name)).join('\n'), recurrenceContext);

const recurrenceAliases = {
  Monthly: 'monthly', Weekly: 'weekly', Biweekly: 'biweekly',
  Bimonthly: 'bimonthly', Quarterly: 'quarterly',
  'Semi-annually': 'semi_annually', Yearly: 'yearly', Annual: 'yearly'
};
for (const [label, expected] of Object.entries(recurrenceAliases)) {
  assert.equal(recurrenceContext.normalizeFrequency_(label), expected,
    `${label} must normalize to ${expected}`);
}
assert.equal(recurrenceContext.normalizeFrequency_(''), 'unknown');
assert.equal(recurrenceContext.normalizeFrequency_('custom someday'), 'unknown');
assert.equal(recurrenceContext.billAppliesInMonth_('unknown', 1, 1), false,
  'unknown recurrence must never silently behave as monthly');

const recurrenceDate = (year, monthIndex, day) =>
  vm.runInContext(`new Date(${year}, ${monthIndex}, ${day})`, recurrenceContext);
const windowStart = recurrenceDate(2026, 7, 18);
const windowEnd = recurrenceDate(2026, 10, 15);
const occurrenceDates = (frequency, startMonth, end = windowEnd) =>
  Array.from(recurrenceContext.buildInputBillDueCandidates_(
    windowStart, 15, frequency, startMonth, '', windowStart, null, end),
  row => `${row.dueDate.getFullYear()}-${String(row.dueDate.getMonth() + 1).padStart(2, '0')}-${String(row.dueDate.getDate()).padStart(2, '0')}`);

assert.deepEqual(occurrenceDates('monthly', 1), ['2026-09-15', '2026-10-15', '2026-11-15']);
assert.deepEqual(occurrenceDates('bimonthly', 8), ['2026-10-15']);
assert.deepEqual(occurrenceDates('quarterly', 8), ['2026-11-15']);
assert.deepEqual(occurrenceDates('semi_annually', 5), ['2026-11-15']);
assert.deepEqual(occurrenceDates('yearly', 11), ['2026-11-15']);
assert.deepEqual(occurrenceDates('yearly', 11, recurrenceDate(2026, 10, 14)), [],
  'an annual obligation outside the rolling horizon must not be counted');
assert.deepEqual(occurrenceDates('unknown', 1), [],
  'blank, one-time, irregular, and unsupported schedules remain unknown rather than becoming monthly');
assert.deepEqual(Array.from(recurrenceContext.buildInputBillDueCandidates_(
  recurrenceDate(2026, 11, 15), 15, 'yearly', 1, '', recurrenceDate(2026, 11, 15), null,
  recurrenceDate(2027, 0, 15)), row => row.dueDate.getFullYear() + '-' + (row.dueDate.getMonth() + 1)),
['2027-1'], 'yearly recurrence must cross the calendar-year boundary once');

assert.equal(context.capitalAllocationForecastRowsWithinDays_([
  { dueDate: '2026-08-25', amount: 100 },
  { dueDate: '2026-09-10', amount: 200 },
  { dueDate: '2026-09-17', amount: 300 },
  { dueDate: '2026-10-20', amount: 400 }
], new Date(2026, 7, 18), 30), 200,
  'the exact 30-day ledger must include days 8-29 and exclude current-week and later obligations');

const unknownScheduleFindings = [];
const unknownScheduleValues = [
  ['Payee', 'Default Amount', 'Due Day', 'Active', 'Frequency', 'Start Month', 'Category', 'Varies'],
  ['Unknown Schedule', 900, 15, 'Yes', 'Custom', 1, 'Utilities', 'No']
];
const unknownScheduleDisplay = unknownScheduleValues.map(row => row.map(String));
context.normalizeFrequency_ = recurrenceContext.normalizeFrequency_;
context.buildInputBillDueCandidates_ = recurrenceContext.buildInputBillDueCandidates_;
const unknownScheduleForecast = context.readCapitalAllocationFutureBills_({
  getSpreadsheetTimeZone() { return 'America/Los_Angeles'; },
  getSheetByName() { return { getDataRange() { return {
    getValues() { return unknownScheduleValues; },
    getDisplayValues() { return unknownScheduleDisplay; }
  }; } }; }
}, windowStart, windowEnd, unknownScheduleFindings, []);
assert.equal(unknownScheduleForecast.total, 0);
assert.equal(unknownScheduleFindings.length, 1);
assert.equal(unknownScheduleFindings[0].blocksAllocation, true,
  'an unknown bill schedule must remain an explicit reserve blocker, not a fabricated zero or monthly amount');

const propertyContingency = context.capitalAllocationBuildPropertyContingency_([
  { house: 'SD House', type: 'Repair', cost: 1000, serviceFees: 0,
    dateDisplay: '2026-05-01', sortDate: new Date(2026, 4, 1) },
  { house: 'SD House', type: 'Maintenance', cost: 400, serviceFees: 100,
    dateDisplay: '2026-06-01', sortDate: new Date(2026, 5, 1) },
  { house: 'SD House', type: 'HOA', cost: 1200, serviceFees: 0,
    dateDisplay: '2026-07-01', sortDate: new Date(2026, 6, 1) },
  { house: 'SD House', type: 'Mgmt', cost: 600, serviceFees: 0,
    dateDisplay: '2026-07-01', sortDate: new Date(2026, 6, 1) },
  { house: 'Inactive House', type: 'Repair', cost: 5000, serviceFees: 0,
    dateDisplay: '2026-07-01', sortDate: new Date(2026, 6, 1) },
  { house: 'SD House', type: 'Repair', cost: 9000, serviceFees: 0,
    dateDisplay: '2026-09-01', sortDate: new Date(2026, 8, 1) }
], new Date(2026, 7, 14), ['SD House'], [
  { category: 'Repair', amount: 200 },
  { category: 'HOA', amount: 999 }
]);
assert.equal(propertyContingency.historicalAllowanceAmount, 369.86);
assert.equal(propertyContingency.upcomingOffsetAmount, 200);
assert.equal(propertyContingency.additionalReserveAmount, 169.86,
  'scheduled HOA and management must not enter the irregular property allowance');
assert.deepEqual(Array.from(propertyContingency.rows, row => row.house), ['SD House']);
const fullyScheduledPropertyContingency = context.capitalAllocationBuildPropertyContingency_([
  { house: 'SD House', type: 'Repair', cost: 1000, serviceFees: 0,
    dateDisplay: '2026-06-01', sortDate: new Date(2026, 5, 1) }
], new Date(2026, 7, 14), ['SD House'], [{ category: 'Repair', amount: 1000 }]);
assert.equal(fullyScheduledPropertyContingency.minimumFloorAmount, 61.65);
assert.equal(fullyScheduledPropertyContingency.additionalReserveAmount, 61.65,
  'known repairs must not erase the unknown-repair contingency floor');

assert.equal(context.capitalAllocationMinimumWeeklyCommitment_(
  { accountName: 'Samer Robinhood' }), 500);
assert.equal(context.capitalAllocationMinimumWeeklyCommitment_(
  { accountName: 'Second Income Account' }), 0);
const futureRobinhood = context.readCapitalAllocationFutureInvestmentCommitments_([
  { investmentId: 'INV-1', accountName: 'Samer Robinhood', eligible: true }
], new Date(2026, 7, 14), new Date(2026, 10, 11));
assert.equal(futureRobinhood.rows.length, 12);
assert.equal(futureRobinhood.total, 6000,
  'the forecast must disclose twelve normal-policy commitments without adding them to the operating floor');

const facts = {
  asOfDate: '2026-08-14',
  liquidity: {
    cashToUse: 7450,
    accounts: [
      { accountName: 'Operating', balance: 9950, minBuffer: 2500, usable: 7450, included: true },
      { accountName: 'Emergency', balance: 12000, minBuffer: 0, usable: 0,
        included: false, excludedReason: 'do_not_touch_policy' },
      { accountName: 'Property reserve', balance: 500, minBuffer: 1500, usable: 0, included: true }
    ]
  },
  debts: [
    { name: 'Amex', originalName: 'Amex', active: true, balance: 10000, minimumPayment: 300, interestRate: 26.99 },
    { name: 'Low mortgage', originalName: 'Low mortgage', active: true, balance: 100000, minimumPayment: 900, interestRate: 1.99 },
    { name: 'Missing APR', originalName: 'Missing APR', active: true, balance: 5000, minimumPayment: 100, interestRate: 0 },
    { name: 'Stopped debt', originalName: 'Stopped debt', active: false, balance: 4000, minimumPayment: 50, interestRate: 19 }
  ],
  obligations: [
    { sourceType: 'debt_minimum', sourceId: 'Amex', name: 'Amex', actionType: 'PAY_DEBT_MINIMUM',
      amount: 300, requiredThisWeek: true, amountBasis: 'MINIMUM_PAYMENT', reason: 'Due', provenance: 'INPUT - Debts' },
    { sourceType: 'tracked_bill', sourceId: 'Tax:2026-08-20', name: 'Property tax', actionType: 'PAY_TRACKED_BILL',
      amount: 850, requiredThisWeek: true, amountBasis: 'DEFAULT_AMOUNT', reason: 'Due', provenance: 'INPUT - Bills' }
  ],
  incomeProducingAccounts: [
    { investmentId: 'INV-1', accountName: 'Samer Robinhood', eligible: true, requestedWeeklyPace: 500 },
    { investmentId: 'INV-2', accountName: 'Second Income Account', eligible: true, requestedWeeklyPace: 0 }
  ],
  dataQuality: []
};

const first = context.buildCapitalAllocationQueue_(facts);
const second = context.buildCapitalAllocationQueue_(facts);
assert.equal(JSON.stringify(first), JSON.stringify(second), 'identical facts must produce identical output');
assert.equal(first.mode, 'READ_ONLY_FACTS_AND_UNRANKED_CANDIDATES');
assert.equal(first.allocationStatus, 'NOT_ALLOCATED');
assert.equal(first.reconciliation.allocatedAmount, 0);
assert.equal(first.reconciliation.remainingCash, 7450);
assert.equal(first.totals.requiredActionAmount, 1650);
assert.equal(first.totals.protectedCashAmount, 15000);
assert.equal(first.discretionaryCandidates.every(row => row.rank === null && row.allocatedAmount === null), true);

const debtTargets = Array.from(first.discretionaryCandidates
  .filter(row => row.actionType === 'PAY_EXTRA_DEBT'), row => row.targetName).sort();
assert.deepEqual(debtTargets, ['Amex', 'Low mortgage', 'Missing APR']);
assert.equal(first.hardConstraints.some(row => row.actionType === 'PROTECT_CASH' && row.requestedAmount === 12000), true);
assert.equal(first.discretionaryCandidates.some(row => row.actionType === 'RESTORE_RESERVE' && row.requestedAmount === 1000), true);
assert.equal(first.hardConstraints.some(row => row.actionType === 'FUND_INCOME_PRODUCING_MINIMUM' && row.requestedAmount === 500), true);
assert.equal(first.discretionaryCandidates.some(row => row.actionType === 'FUND_INCOME_PRODUCING_ACCOUNT' && row.requestedAmount === null), true);
assert.equal(first.discretionaryCandidates.some(row => row.actionType === 'HOLD_CASH'), true);
assert.equal(first.dataQuality.some(row => row.findingId === 'MISSING_DEBT_APR:MISSING_APR' && row.blocksAllocation), true);
assert.equal(first.dataQuality.some(row => row.findingId === 'UNSIZED_INCOME_ACCOUNT:INV_2'), true);

const planFacts = JSON.parse(JSON.stringify(facts));
planFacts.debts = planFacts.debts.filter(row => row.name !== 'Missing APR');
planFacts.debts[0].type = 'Credit Card';
planFacts.debts[1].type = 'Mortgage';
planFacts.income = { expectedThisWeek: null, normalizedWeeklyPace: 2000 };
planFacts.forecast90 = {
  horizonDays: 90,
  endDate: '2026-11-11',
  expectedIncome: 9000,
  expectedNonRentalIncome: 6000,
  expectedRentalIncome: 3000,
  futureBillsAmount: 1200,
  futureDebtMinimumsAmount: 1800,
  futureUpcomingAmount: 600,
  futureOperatingOutflowsAmount: 3600,
  futureOperatingOutflows30Amount: 1200,
  futureInvestmentCommitmentsAmount: 6000,
  propertyContingencyAmount: 0,
  requiredReserveAmount: 2000,
  obligationOwnership: {
    trackedBills: 'bills', debtMinimums: 'debts', upcoming: 'upcoming',
    property: 'property', cashFlow: 'payment evidence', investmentPolicy: 'separate'
  }
};
planFacts.monthlyDebtEvidenceAudit = { inputEvidenceCount: 0, uniqueEvidenceCount: 0,
  duplicateEvidenceSuppressedCount: 0, matchedEvidenceCount: 0,
  unmatchedEvidenceCount: 0, ambiguousEvidenceCount: 0, recordedEvidenceCount: 0,
  institutionConfirmedEvidenceCount: 0, obligationStatusCounts: {} };
planFacts.existingInvestmentContributions = [{ name: 'Robinhood', amount: 500,
  scheduledAmount: 500, frequency: 'weekly',
  matchedInvestmentId: 'INV-1', matchedAccountName: 'Samer Robinhood' },
  { name: 'M1 Investment', amount: 600, scheduledAmount: 600, frequency: 'weekly',
    matchedInvestmentId: '', matchedAccountName: '' },
  { name: 'Stash', amount: 3.46, scheduledAmount: 15, frequency: 'monthly',
    matchedInvestmentId: '', matchedAccountName: '' }];
planFacts.brokerageFoundation = [{ investmentId: 'INV-M1', accountName: 'M1 Account',
  currentBalance: 50000, inKindTransferStatus: 'REVIEW_COMPATIBILITY',
  salePlanningStatus: 'TAX_DATA_REQUIRED', actionableSource: true,
  identityMessage: 'Separate SYS - Assets identity verified by INV-M1.', sysAssetsRow: 4 }];
planFacts.dataQuality = [{ findingId: 'VARIABLE_BILL_ESTIMATE_USED:UTILITY',
  severity: 'WARNING', blocksAllocation: false, message: 'Utility uses its saved estimate.',
  provenance: 'INPUT - Bills', estimatedAmount: 175 }];
// Synthetic authority for tests that exercise allocation behavior. This is an
// explicit fixture value, not a product default or percentage-based policy.
planFacts.deploymentTracking = { planningPeriod: 'WEEKLY', deploymentBudget: 10000,
  alreadyDeployedThisPeriod: 0, awaitingConfirmationAmount: 0 };
const plan = context.buildCapitalAllocationPlan_(planFacts);
assert.equal(plan.schemaVersion, 'RFP_3B_V2');
assert.equal(plan.recommendationLifecycle.currentPlanState, 'PROPOSED');
assert.equal(plan.recommendationLifecycle.downstreamEffectsState, 'AWAITING_CONFIRMATION');
assert.deepEqual(Array.from(plan.recommendationLifecycle.supportedStates),
  ['PROPOSED', 'AWAITING_CONFIRMATION', 'CONFIRMED', 'SUPERSEDED']);
assert.equal(plan.allocationStatus, 'ALLOCATED');
assert.equal(plan.dataQuality[0].blocksAllocation, false);
assert.equal(plan.summary.deployableAfterRequired, 5800);
assert.equal(plan.summary.reserve90Days, 2000);
assert.equal(plan.summary.availableForGoals, 2600);
assert.equal(plan.reconciliation.difference, 0);
assert.equal(plan.reconciliation.endingCash, 4600);
assert.equal(plan.deploymentPace.liquidityPreference, 'BALANCED');
assert.equal(plan.deploymentPace.hardOperatingFloor, 2000);
assert.equal(plan.deploymentPace.preferredLiquidityTarget, 3200);
assert.equal(plan.deploymentPace.capitalAbovePreferredLiquidity, 2600);
assert.equal(plan.deploymentPace.balancedLiquidityCushion, 1200);
assert.equal(plan.deploymentPace.balancedMonthlyDeploymentCap, 1200);
assert.equal(plan.deploymentPace.recommendedAcceleratedDeployment, 1200);
assert.equal(plan.deploymentPace.intentionallyStagedCapital, 1400);
assert.equal(plan.deploymentPace.intentionallyRetainedLiquidity, 4600);
assert.equal(plan.deploymentPace.acceleratedDeploymentStatus, 'READY');
assert.equal(plan.deploymentPace.proposalSemantics, 'IDEMPOTENT_SNAPSHOT_NOT_ADDITIVE');
assert.equal(plan.deploymentPace.cashYieldDataStatus, 'CASH_YIELD_DATA_REQUIRED');
assert.equal(plan.monthlyOutlook.coverage, 'CURRENT_WEEK_ONLY');
const ranked = plan.rankedCandidates;
const reserve = ranked.find(row => row.actionType === 'RESTORE_RESERVE');
const funding = ranked.find(row => row.actionType === 'FUND_INCOME_PRODUCING_ACCOUNT');
const highDebt = ranked.find(row => row.targetName === 'Amex');
const lowDebt = ranked.find(row => row.targetName === 'Low mortgage');
assert.equal(reserve.allocatedAmount, 1000);
assert.equal(funding.allocatedAmount, 0);
assert.equal(highDebt.rank < lowDebt.rank, true);
assert.equal(highDebt.rank < funding.rank, true);
assert.equal(highDebt.allocatedAmount, 200);
assert.equal(lowDebt.allocatedAmount, 0);
assert.equal(highDebt.estimatedAnnualInterestAvoided, 53.98);
assert.equal(plan.monthlyOutlook.totals.incomeProducingFunding, 500);
assert.equal(plan.existingInvestmentContributions[0].amount, 500);
assert.equal(plan.contributionStrategy.recommendation, 'REDIRECT_OPTIONAL_CONTRIBUTIONS_TO_DEBT');
assert.equal(plan.contributionStrategy.recommendationState, 'PROPOSED');
assert.equal(plan.contributionStrategy.redirectedWeekly, 603.46);
assert.equal(plan.investmentPolicy.policyType, 'POLICY_FLOOR');
assert.equal(plan.investmentPolicy.policyFloor, 500);
assert.equal(plan.investmentPolicy.scheduledAmount, 500);
assert.equal(plan.investmentPolicy.recommendedAmount, 500);
assert.equal(plan.investmentPolicy.optionalAcceleration, 0);

const householdFacts = {
  asOfDate: '2026-08-18',
  liquidity: {
    cashToUse: 176480.44,
    accounts: [{ accountName: 'Eligible household cash', balance: 176480.44,
      minBuffer: 0, usable: 176480.44, included: true }]
  },
  debts: [
    { name: 'Credit Card - American Express', originalName: 'American Express',
      type: 'Credit Card', active: true, balance: 39790.53, minimumPayment: 1193.72,
      interestRate: 26.99, dueDay: 6, dueDayKnown: true },
    { name: 'Credit Card - CitiAA', originalName: 'Credit Card - AA',
      type: 'Credit Card', active: true, balance: 9000, minimumPayment: 270,
      interestRate: 23.49, dueDay: 28, dueDayKnown: true },
    { name: 'Credit Card - Marriott', originalName: 'Marriott',
      type: 'Credit Card', active: true, balance: 8000, minimumPayment: 240,
      interestRate: 20.25, dueDay: 11, dueDayKnown: true },
    { name: 'Credit Card - Southwest', originalName: 'Credit Card - SW',
      type: 'Credit Card', active: true, balance: 32947.12, minimumPayment: 988.41,
      interestRate: 20.24, dueDay: 22, dueDayKnown: true },
    { name: 'Credit Card - United', originalName: 'United',
      type: 'Credit Card', active: true, balance: 8974.51, minimumPayment: 269,
      interestRate: 20.24, dueDay: 16, dueDayKnown: true },
    { name: 'Required term-debt service', originalName: 'Required term-debt service',
      type: 'Mortgage', active: true, balance: 1500000, minimumPayment: 19019.36,
      interestRate: 7.875, dueDay: 1, dueDayKnown: true }
  ],
  obligations: [
    { sourceType: 'tracked_bill', sourceId: 'CURRENT-HOUSEHOLD', name: 'Current household uses',
      actionType: 'PAY_TRACKED_BILL', amount: 1082.93, dueDate: '2026-08-18',
      requiredThisWeek: true, amountBasis: 'RECORDED_DUE_AMOUNT', reason: 'Due',
      provenance: 'bounded-style fixture' },
    { sourceType: 'debt_minimum', sourceId: 'SOUTHWEST-2026-08-22',
      name: 'Credit Card - Southwest', actionType: 'PAY_DEBT_MINIMUM', amount: 988.41,
      dueDate: '2026-08-22', requiredThisWeek: true, amountBasis: 'MINIMUM_PAYMENT',
      reason: 'Due', provenance: 'bounded-style fixture' }
  ],
  incomeProducingAccounts: [{ investmentId: 'INV-RH', accountName: 'Samer Robinhood',
    eligible: true, requestedWeeklyPace: 500 }],
  income: { expectedThisWeek: null, normalizedWeeklyPace: 0 },
  forecast90: {
    horizonDays: 90, startDate: '2026-08-18', endDate: '2026-11-15',
    futureBillsAmount: 27530.21, futureDebtMinimumsAmount: 58978.57,
    futureUpcomingAmount: 38500, propertyContingencyAmount: 678.57,
    futureOperatingOutflowsAmount: 125687.35, expectedIncome: 90584.70,
    futureOperatingOutflows30Amount: 41895.78,
    incomeOffsetAmount: 83791.57, minimumOperatingFloorAmount: 41895.78,
    requiredReserveAmount: 41895.78,
    obligationOwnership: {
      trackedBills: 'bills', debtMinimums: 'debts', upcoming: 'upcoming',
      property: 'property', cashFlow: 'payment evidence', investmentPolicy: 'separate'
    }
  },
  monthlyDebtEvidenceAudit: { inputEvidenceCount: 0, uniqueEvidenceCount: 0,
    duplicateEvidenceSuppressedCount: 0, matchedEvidenceCount: 0,
    unmatchedEvidenceCount: 0, ambiguousEvidenceCount: 0, recordedEvidenceCount: 0,
    institutionConfirmedEvidenceCount: 0, obligationStatusCounts: {} },
  dataQuality: []
};
const householdPlan = context.buildCapitalAllocationPlan_(householdFacts);
assert.equal(householdPlan.summary.householdRequiredThisWeek, 2071.34);
assert.equal(householdPlan.summary.standingInvestmentFunded, 500);
assert.equal(householdPlan.deploymentPace.cashAfterRequiredAndPolicyFloor, 173909.10);
assert.equal(householdPlan.deploymentPace.hardOperatingFloor, 41895.78);
assert.equal(householdPlan.deploymentPace.cushionComponents.normalizedMonthlyOutflows, 41895.78);
assert.equal(householdPlan.deploymentPace.cushionComponents.monthlyDebtService, 21980.49);
assert.equal(householdPlan.deploymentPace.cushionComponents.monthlyPropertyRisk, 226.19);
assert.equal(householdPlan.deploymentPace.preferredLiquidityTarget, 83791.56);
assert.equal(householdPlan.deploymentPace.capitalAbovePreferredLiquidity, 90117.54);
assert.equal(householdPlan.deploymentPace.periodBudgetAuthorityAvailable, true);
assert.equal(householdPlan.deploymentPace.acceleratedDeploymentStatus, 'READY');
assert.equal(householdPlan.deploymentPace.balancedLiquidityCushion, 41895.78);
assert.equal(householdPlan.deploymentPace.balancedMonthlyDeploymentCap, 41895.78,
  'Balanced cap must equal the lesser of potential excess and the calculated cushion');
assert.equal(householdPlan.deploymentPace.recommendedAcceleratedDeployment, 41895.78,
  'the bounded-style plan must stage rather than consume all potential excess');
assert.equal(householdPlan.deploymentPace.intentionallyStagedCapital, 48221.76);
assert.equal(householdPlan.summary.endingCash, 132013.32);
assert.equal(householdPlan.deploymentPace.gross30DayObligations, 41895.78);
assert.equal(householdPlan.deploymentPace.gross90DayObligations, 125687.35);
assert.equal(householdPlan.deploymentPace.coverage30Days, 3.15);
assert.equal(householdPlan.deploymentPace.coverage90Days, 1.05);
assert.equal(householdPlan.deploymentPace.coverageStatus, 'COVERED_WITH_CURRENT_CASH');
assert.equal(householdPlan.safetyProof.schemaVersion, 'RFP_3_POST_DECISION_SAFETY_V1');
assert.equal(householdPlan.safetyProof.status, 'PASS');
assert.equal(householdPlan.safetyProof.postDecision.coverage30DaySurplus, 90117.54);
assert.equal(householdPlan.safetyProof.postDecision.coverage90DaySurplus, 6325.97);
assert.equal(householdPlan.safetyProof.reconciliation.cashIdentityDifference, 0);
assert.equal(householdPlan.safetyProof.reconciliation.stagedCapitalIdentityDifference, 0);
assert.equal(householdPlan.safetyProof.checks.noFutureIncomeRequired, true);
assert.equal(householdPlan.safetyProof.checks.eligibleCashMatchesAccountSources, true);
assert.equal(householdPlan.safetyProof.checks.paymentEvidenceDeduplicated, true);
assert.equal(householdPlan.safetyProof.checks.obligationsCountedExactlyOnce, true);
assert.equal(householdPlan.safetyProof.checks.recommendationAwaitingConfirmation, true);
assert.deepEqual(Array.from(householdPlan.safetyProof.decision.debtAvalanche,
  row => [row.targetName, row.amount]), [
  ['Credit Card - American Express', 39790.53],
  ['Credit Card - CitiAA', 2105.25]
]);
const ownershipCollisionFacts = JSON.parse(JSON.stringify(householdFacts));
ownershipCollisionFacts.forecast90.obligationOwnership.trackedBills =
  ownershipCollisionFacts.forecast90.obligationOwnership.debtMinimums;
const ownershipCollisionPlan = context.buildCapitalAllocationPlan_(ownershipCollisionFacts);
assert.equal(ownershipCollisionPlan.safetyProof.checks.obligationsCountedExactlyOnce, false,
  'two obligation classes assigned to the same ownership bucket must fail closed');
assert.equal(ownershipCollisionPlan.safetyProof.status, 'FAIL_CLOSED');
assert.equal(householdPlan.deploymentPace.futureIncomeReliedUponForOptionalDeployment, false,
  'today\'s optional deployment must remain safe without unreceived future income');
assert.ok(householdPlan.summary.endingCash >= householdPlan.deploymentPace.hardOperatingFloor,
  'post-decision cash must preserve the hard operating floor');
assert.ok(householdPlan.summary.endingCash >= householdPlan.deploymentPace.preferredLiquidityTarget,
  'post-decision cash must preserve the preferred liquidity target');
assert.equal(Math.round((householdPlan.deploymentPace.recommendedAcceleratedDeployment +
  householdPlan.deploymentPace.intentionallyStagedCapital) * 100) / 100,
  householdPlan.deploymentPace.capitalAbovePreferredLiquidity,
  'potential excess must split exactly between the current recommendation and staged capital');
assert.equal(176480.44, 2071.34 + 500 + 41895.78 + 132013.32,
  'eligible cash must equal required uses plus Robinhood plus accelerated deployment plus retained cash');
assert.equal(householdPlan.reconciliation.difference, 0,
  'the corrected household-scale plan must reconcile exactly');
const householdExtra = householdPlan.weeklyActions
  .filter(row => row.actionType === 'PAY_EXTRA_DEBT');
assert.deepEqual(Array.from(householdExtra, row => [row.targetName, row.amount]), [
  ['Credit Card - American Express', 39790.53],
  ['Credit Card - CitiAA', 2105.25]
], 'the bounded-style monthly cap must remain highest-APR-first after required minimums');
assert.equal(householdPlan.afterAction.projectedReleasedMonthlyMinimums, 1193.72,
  'a proposed full payoff may project but must not confirm a released minimum');
assert.equal(householdPlan.afterAction.confirmedReleasedMonthlyMinimums, 0,
  'projected payoff must not release monthly cash before refreshed confirmation');

const resilienceLimitedFacts = JSON.parse(JSON.stringify(householdFacts));
resilienceLimitedFacts.forecast90.futureOperatingOutflowsAmount = 160000;
const resilienceLimitedPlan = context.buildCapitalAllocationPlan_(resilienceLimitedFacts);
assert.equal(resilienceLimitedPlan.deploymentPace.recommendedAcceleratedDeployment, 13909.10,
  'gross 90-day obligations must reduce the monthly cap before optional deployment');
assert.equal(resilienceLimitedPlan.summary.endingCash, 160000);
assert.equal(resilienceLimitedPlan.deploymentPace.coverage90Days, 1);
assert.equal(resilienceLimitedPlan.deploymentPace.futureIncomeReliedUponForOptionalDeployment,
  false);

const missingCushionFacts = JSON.parse(JSON.stringify(householdFacts));
delete missingCushionFacts.forecast90.futureOperatingOutflowsAmount;
delete missingCushionFacts.forecast90.futureOperatingOutflows30Amount;
delete missingCushionFacts.forecast90.futureBillsAmount;
delete missingCushionFacts.forecast90.futureDebtMinimumsAmount;
delete missingCushionFacts.forecast90.futureUpcomingAmount;
delete missingCushionFacts.forecast90.propertyContingencyAmount;
const missingCushionPlan = context.buildCapitalAllocationPlan_(missingCushionFacts);
assert.equal(missingCushionPlan.deploymentPace.acceleratedDeploymentStatus,
  'PACING_DATA_REQUIRED');
assert.equal(missingCushionPlan.deploymentPace.recommendedAcceleratedDeployment, 0);

const authorizedHouseholdFacts = JSON.parse(JSON.stringify(householdFacts));
authorizedHouseholdFacts.deploymentTracking = { planningPeriod: 'MONTHLY',
  deploymentBudget: 25000, alreadyDeployedThisPeriod: 0, awaitingConfirmationAmount: 0 };
const authorizedHouseholdPlan = context.buildCapitalAllocationPlan_(authorizedHouseholdFacts);
assert.equal(authorizedHouseholdPlan.deploymentPace.recommendedAcceleratedDeployment, 25000,
  'an explicit fixture budget may authorize only that current-period amount');
assert.deepEqual(Array.from(authorizedHouseholdPlan.weeklyActions
  .filter(row => row.actionType === 'PAY_EXTRA_DEBT'), row => [row.targetName, row.amount]), [
  ['Credit Card - American Express', 25000]
], 'authorized accelerated debt must remain highest-APR-first');
assert.equal(176480.44, 2071.34 + 500 + 25000 + 148909.10,
  'authorized household allocation must still reconcile exactly');

const subDollarRemainderFacts = JSON.parse(JSON.stringify(householdFacts));
subDollarRemainderFacts.deploymentTracking = { planningPeriod: 'MONTHLY',
  deploymentBudget: 41896.03, alreadyDeployedThisPeriod: 0, awaitingConfirmationAmount: 0 };
const subDollarRemainderPlan = context.buildCapitalAllocationPlan_(subDollarRemainderFacts);
const subDollarOptionalActions = subDollarRemainderPlan.weeklyActions.filter(row =>
  row.actionType === 'PAY_EXTRA_DEBT');
assert.equal(subDollarOptionalActions.reduce((sum, row) => sum + row.amount, 0), 41895.78,
  'the actionable revolving allocation must not be padded by a meaningless $0.25 tail');
assert.equal(subDollarOptionalActions.some(row => Number(row.amount) < 1), false,
  'no optional debt instruction may contain a sub-dollar remainder');
assert.equal(subDollarRemainderPlan.summary.endingCash, 132013.32,
  'the unallocated $0.25 must remain in retained cash');

const clientContext = { console, document: { getElementById() { return null; } } };
vm.createContext(clientContext);
vm.runInContext(client, clientContext, { filename: 'Dashboard_Script_PlanningCapitalAllocation.html' });
const financialOutputBeforePresentation = JSON.stringify({
  summary: plan.summary,
  weeklyActions: plan.weeklyActions,
  rankedCandidates: plan.rankedCandidates,
  investmentPolicy: plan.investmentPolicy,
  contributionStrategy: plan.contributionStrategy,
  deploymentPace: plan.deploymentPace,
  forecast90: plan.forecast90,
  afterAction: plan.afterAction,
  recommendationLifecycle: plan.recommendationLifecycle
});
const primaryDecision = clientContext.capitalAllocationPrimaryDecisionModel_(plan);
const detailedRevolvingPayment = plan.afterAction.debts
  .filter(row => row.isRevolving && Number(row.proposedPayment || 0) > 0)
  .reduce((sum, row) => sum + Number(row.proposedPayment || 0), 0);
assert.equal(primaryDecision.investAmount, plan.investmentPolicy.recommendedAmount,
  'the simplified Invest value must use the approved detailed recommendation');
assert.equal(primaryDecision.debtAmount, detailedRevolvingPayment,
  'the simplified debt value must reconcile to the detailed revolving actions');
assert.equal(primaryDecision.cashAmount, plan.summary.endingCash,
  'the simplified cash value must use the detailed ending-cash result');
assert.deepEqual(Array.from(primaryDecision.pausedContributions, row =>
  [row.displayName, row.scheduledAmount, row.frequency]), [
  ['M1', 600, 'weekly'], ['Stash', 15, 'monthly']
], 'paused schedules must remain separate and use their native units');
const primaryHtml = clientContext.capitalAllocationPrimaryDecisionHtml_(plan);
assert.match(primaryHtml, /<span>Invest<\/span><strong>\$500\.00<\/strong>/);
assert.match(primaryHtml, /<span>Pay debt<\/span><strong>\$500\.00<\/strong>/);
assert.match(primaryHtml, /<span>Keep available<\/span><strong>\$4,600\.00<\/strong>/);
assert.match(primaryHtml, />M1<[\s\S]*?Pause \$600\.00\/week/);
assert.match(primaryHtml, /Stash[\s\S]*?Pause \$15\.00\/month/);
assert.doesNotMatch(primaryHtml, /\$603\.46 per week|policy floor|optional acceleration|normalized contribution|deployment budget|economic comparator|AWAITING_CONFIRMATION/i,
  'the primary card must not expose normalized or internal allocation terminology');

const outcomePlan = JSON.parse(JSON.stringify(plan));
outcomePlan.afterAction.debts = [
  { name: 'Credit Card - American Express', isRevolving: true, startingBalance: 39790.53,
    proposedPayment: 39790.53, projectedEndingBalance: 0, apr: 26.99,
    projectedAnnualInterestAvoided: 10739.46, projectedMonthlyMinimumReleased: 1193.72 },
  { name: 'Credit Card - CitiAA', isRevolving: true, startingBalance: 9000,
    proposedPayment: 2238.60, projectedEndingBalance: 6761.40, apr: 23.49,
    projectedAnnualInterestAvoided: 525.82 },
  { name: 'Credit Card - Southwest', isRevolving: true, startingBalance: 32947.12,
    proposedPayment: 988.41, projectedEndingBalance: 31958.71, apr: 20.24,
    projectedAnnualInterestAvoided: 200.06, priorityClass: 'MODERATE' },
  { name: 'Credit Card - Marriott', isRevolving: true, startingBalance: 8000,
    proposedPayment: 0, projectedEndingBalance: 8000, apr: 20.25,
    projectedAnnualInterestAvoided: 0, priorityClass: 'MODERATE' },
  { name: 'Credit Card - United', isRevolving: true, startingBalance: 8974.51,
    proposedPayment: 0, projectedEndingBalance: 8974.51, apr: 20.24,
    projectedAnnualInterestAvoided: 0, priorityClass: 'MODERATE' },
  { name: 'Loan - Lake Tahoe', isRevolving: false, startingBalance: 562744.17,
    proposedPayment: 0, projectedEndingBalance: 562744.17, apr: 7.875,
    projectedAnnualInterestAvoided: 0, priorityClass: 'LOW_COST' },
  { name: 'Toyota', isRevolving: false, startingBalance: 82952,
    proposedPayment: 0, projectedEndingBalance: 82952, apr: 3.75,
    projectedAnnualInterestAvoided: 0, priorityClass: 'LOW_COST' }
];
outcomePlan.afterAction.debts[0].priorityClass = 'CRITICAL';
outcomePlan.afterAction.debts[1].priorityClass = 'CRITICAL';
outcomePlan.afterAction.projectedReleasedMonthlyMinimums = 1193.72;
outcomePlan.afterAction.confirmedReleasedMonthlyMinimums = 0;
outcomePlan.afterAction.projectedRobinhoodBalanceAfterContributions = 16693.06;
outcomePlan.forecast90.startDate = '2026-08-17';
outcomePlan.forecast90.futureDebtMinimums = [
  { name: 'Credit Card - Marriott', dueDate: '2026-08-26', amount: 240 },
  { name: 'Credit Card - United', dueDate: '2026-08-29', amount: 175 },
  { name: 'Credit Card - CitiAA', dueDate: '2026-09-05', amount: 270 }
];
outcomePlan.forecast90.futureBills = [
  { name: 'Marriott', dueDate: '2026-08-26', amount: 240 },
  { name: 'Southwest', dueDate: '2026-08-22', amount: 988.41 },
  { name: 'Marriott', dueDate: '2026-08-26', amount: 240 }
];
outcomePlan.weeklyActions = [
  { actionType: 'PAY_DEBT_MINIMUM', targetName: 'Credit Card - American Express', amount: 1000,
    dueDate: '2026-08-18' },
  { actionType: 'PAY_EXTRA_DEBT', targetName: 'Credit Card - American Express', amount: 38790.53 },
  { actionType: 'PAY_DEBT_MINIMUM', targetName: 'Credit Card - CitiAA', amount: 270,
    dueDate: '2026-08-20' },
  { actionType: 'PAY_EXTRA_DEBT', targetName: 'Credit Card - CitiAA', amount: 1968.60 },
  { actionType: 'PAY_DEBT_MINIMUM', targetName: 'Credit Card - Southwest', amount: 988.41,
    dueDate: '2026-08-22' }
];
outcomePlan.queue.facts.debts = [
  { name: 'Credit Card - American Express', originalName: 'American Express', minimumPayment: 1000,
    dueDay: 18, dueDayKnown: true },
  { name: 'Credit Card - CitiAA', originalName: 'CitiAA', minimumPayment: 270,
    dueDay: 20, dueDayKnown: true },
  { name: 'Credit Card - Southwest', originalName: 'Southwest', minimumPayment: 988.41,
    dueDay: 22, dueDayKnown: true },
  { name: 'Credit Card - Marriott', originalName: 'Marriott', minimumPayment: 240,
    dueDay: 26, dueDayKnown: true },
  { name: 'Credit Card - United', originalName: 'United', minimumPayment: 175,
    dueDay: 29, dueDayKnown: true }
];
const outcomeDecision = clientContext.capitalAllocationPrimaryDecisionModel_(outcomePlan);
assert.equal(outcomeDecision.debtActions[0].outcome, 'PAID_OFF');
assert.equal(outcomeDecision.debtActions[1].outcome, 'PAID_DOWN');
assert.equal(outcomeDecision.debtActions[2].outcome, 'REQUIRED_PAYMENT');
assert.equal(outcomeDecision.debtActions[1].endingBalance, 6761.40);
assert.equal(outcomeDecision.debtActions[1].requiredPayment, 270);
assert.equal(outcomeDecision.debtActions[1].extraPayment, 1968.60);
assert.equal(outcomeDecision.debtActions[2].requiredPayment, 988.41);
assert.equal(outcomeDecision.debtActions[2].extraPayment, 0);
assert.equal(outcomeDecision.debtActions[1].annualInterestReduction,
  outcomePlan.afterAction.debts[1].projectedAnnualInterestAvoided,
  'the customer outcome must use the existing deterministic interest result');
const outcomeHtml = clientContext.capitalAllocationPrimaryDecisionHtml_(outcomePlan);
assert.match(outcomeHtml, /Expected results/);
assert.match(outcomeHtml, /American Express — Expected to be paid off[\s\S]*?Expected balance \$39,790\.53 → \$0\.00[\s\S]*?~\$10,739\.46\/yr[\s\S]*?projected interest avoided/);
assert.match(outcomeHtml, /CitiAA — Recommended extra payment[\s\S]*?Expected balance \$9,000\.00 → \$6,761\.40[\s\S]*?~\$525\.82\/yr[\s\S]*?projected interest reduction/);
assert.match(outcomeHtml, /Southwest — Required payment covered[\s\S]*?\$988\.41 required · No extra payment/);
assert.doesNotMatch(outcomeHtml, /capital-allocation-badge">(?:Paid off|Paid down)/,
  'a proposed outcome must never use a completed-state badge');
const partialOutcome = outcomeHtml.slice(outcomeHtml.lastIndexOf('CitiAA'),
  outcomeHtml.indexOf('Additional investing'));
assert.doesNotMatch(partialOutcome, /APR eliminated|Avoid 23\.49% interest/,
  'a partial payoff must never imply that its APR was eliminated or avoided');
assert.doesNotMatch(outcomeHtml, /Extra debt payment|Total this week|Current balance|APR remains/,
  'the Overview outcome drill-down must remain compact');
const outcomeFinancialBeforeDebtPresentation = JSON.stringify({
  weeklyActions: outcomePlan.weeklyActions,
  debts: outcomePlan.afterAction.debts,
  projectedReleasedMonthlyMinimums: outcomePlan.afterAction.projectedReleasedMonthlyMinimums,
  confirmedReleasedMonthlyMinimums: outcomePlan.afterAction.confirmedReleasedMonthlyMinimums,
  projectedRobinhoodBalanceAfterContributions:
    outcomePlan.afterAction.projectedRobinhoodBalanceAfterContributions,
  futureDebtMinimums: outcomePlan.forecast90.futureDebtMinimums,
  futureBills: outcomePlan.forecast90.futureBills,
  recommendationLifecycle: outcomePlan.recommendationLifecycle
});
const debtViewHtml = clientContext.capitalAllocationDebtViewHtml_(outcomePlan);
assert.match(debtViewHtml, /Debt plan this month[\s\S]*?Required payments this month[\s\S]*?\$2,673\.41[\s\S]*?Extra payoff[\s\S]*?\$40,759\.13[\s\S]*?Remaining debt payments this month[\s\S]*?\$43,432\.54/,
  'monthly totals must reconcile one required obligation per card plus current extra payoff');
assert.doesNotMatch(debtViewHtml, /Required amount already covered by payoff recommendations[\s\S]*?−\$0\.00/,
  'the customer summary must not render a meaningless zero overlap row');
const monthlyDebtModel = clientContext.capitalAllocationMonthlyDebtPlanModel_(outcomePlan, outcomeDecision);
assert.equal(monthlyDebtModel.requiredTotal, 2673.41);
assert.equal(monthlyDebtModel.extraTotal, 40759.13);
assert.equal(monthlyDebtModel.requiredIncludedTotal, 0);
assert.equal(monthlyDebtModel.totalPlanned, 43432.54);
assert.equal(Math.round((monthlyDebtModel.requiredTotal + monthlyDebtModel.extraTotal -
  monthlyDebtModel.requiredIncludedTotal) * 100) / 100, monthlyDebtModel.totalPlanned,
  'monthly debt summary must expose the exact overlap instead of inviting double counting');
const householdMonthlyDebtModel = clientContext.capitalAllocationMonthlyDebtPlanModel_(
  householdPlan, clientContext.capitalAllocationPrimaryDecisionModel_(householdPlan));
assert.equal(householdMonthlyDebtModel.requiredTotal, 21980.49,
  'monthly required-payment visibility must include the current term-debt obligation');
assert.equal(householdMonthlyDebtModel.extraTotal, 41895.78);
assert.equal(householdMonthlyDebtModel.requiredIncludedTotal, 1193.72,
  'the Amex monthly requirement must be shown but not added again inside its full payoff');
assert.equal(householdMonthlyDebtModel.totalPlanned, 62682.55);
assert.equal(Math.round((householdMonthlyDebtModel.requiredTotal + householdMonthlyDebtModel.extraTotal -
  householdMonthlyDebtModel.requiredIncludedTotal) * 100) / 100,
  householdMonthlyDebtModel.totalPlanned,
  'the bounded-style monthly totals must reconcile required plus accelerated less embedded requirements');
const householdMonthlyDebtSummaryHtml = clientContext.capitalAllocationMonthlyDebtSummaryHtml_(
  householdMonthlyDebtModel);
assert.match(householdMonthlyDebtSummaryHtml,
  /Required amount already covered by payoff recommendations[\s\S]*?−\$1,193\.72/,
  'the monthly summary must disclose the Amex requirement embedded in its full payoff');
assert.match(clientContext.capitalAllocationPrimaryDecisionHtml_(householdPlan),
  /This week's recommendation[\s\S]*?Pay \$42,884\.19 toward debt now[\s\S]*?American Express[\s\S]*?\$39,790\.53[\s\S]*?CitiAA[\s\S]*?\$2,105\.25[\s\S]*?Southwest[\s\S]*?\$988\.41/,
  'Overview must reconcile optional debt deployment and required debt payments');
assert.doesNotMatch(clientContext.capitalAllocationPrimaryDecisionHtml_(householdPlan),
  /\$0\.00[^<]*(?:extra payoff|extra debt)|(?:extra payoff|extra debt)[\s\S]{0,80}\$0\.00/i,
  'missing pacing authority must not appear as a zero extra-payoff recommendation');
assert.match(clientContext.capitalAllocationOverviewNextStepHtml_(householdPlan),
  /Make the recommended payments[\s\S]*?refresh Cash Compass/);
assert.match(clientContext.capitalAllocationCashViewHtml_(householdPlan),
  /Choose your pace[\s\S]*?Potential excess cash[\s\S]*?\$90,117\.54[\s\S]*?Recommended to deploy this month[\s\S]*?\$41,895\.78[\s\S]*?Intentionally held for future decisions[\s\S]*?\$48,221\.76/,
  'Cash must explain the monthly staging decision');
assert.match(householdMonthlyDebtSummaryHtml,
  /Required payments this month[\s\S]*?\$21,980\.49[\s\S]*?Extra payoff[\s\S]*?\$41,895\.78[\s\S]*?Remaining debt payments this month[\s\S]*?\$62,682\.55/,
  'Debt must reconcile all required debt obligations with the staged optional payoff');
assert.match(debtViewHtml, /Credit-card debt now[\s\S]*?\$98,712\.16[\s\S]*?Expected credit-card debt after current recommendations[\s\S]*?\$55,694\.62/,
  'current and expected revolving balances must remain explicitly distinct');
assert.match(debtViewHtml, /Recommended payoff[\s\S]*?American Express[\s\S]*?Pay off[\s\S]*?\$39,790\.53[\s\S]*?Required Aug 18, 2026[\s\S]*?\$1,000\.00[\s\S]*?\$39,790\.53 → \$0\.00 expected/);
assert.match(debtViewHtml, /Still to pay this month[\s\S]*?CitiAA[\s\S]*?\$270\.00[\s\S]*?Aug 20, 2026[\s\S]*?An additional payoff is recommended separately below/);
assert.match(debtViewHtml, /Extra payoff recommendation[\s\S]*?CitiAA[\s\S]*?Extra payoff[\s\S]*?\$1,968\.60[\s\S]*?Required Aug 20, 2026[\s\S]*?\$270\.00[\s\S]*?\$9,000\.00 → \$6,761\.40 expected/);
assert.match(debtViewHtml, /Required payment[\s\S]*?Southwest[\s\S]*?Still to pay this month[\s\S]*?\$988\.41[\s\S]*?Due[\s\S]*?Aug 22, 2026[\s\S]*?Extra payoff waits/,
  'required-only cards must not look like discretionary allocation');
assert.match(debtViewHtml, /Marriott[\s\S]*?\$240\.00[\s\S]*?Aug 26, 2026[\s\S]*?Extra payoff waits/);
assert.match(debtViewHtml, /United[\s\S]*?\$175\.00[\s\S]*?Aug 29, 2026[\s\S]*?Extra payoff waits/);
const extraDebtSection = debtViewHtml.slice(debtViewHtml.indexOf('Extra payoff recommendation'),
  debtViewHtml.indexOf('Already covered this month'));
const amexDebtCard = extraDebtSection.slice(extraDebtSection.indexOf('American Express'), extraDebtSection.indexOf('CitiAA'));
const citiDebtCard = extraDebtSection.slice(extraDebtSection.indexOf('CitiAA'));
const southwestDebtCard = debtViewHtml.slice(debtViewHtml.indexOf('Southwest'), debtViewHtml.indexOf('Marriott'));
assert.match(amexDebtCard, /Pay off[\s\S]*?Required Aug 18, 2026/,
  'a full payoff must show one payoff amount and keep the current requirement contextual');
assert.doesNotMatch(amexDebtCard, /Extra payoff|\$38,790\.53/,
  'a full payoff must not present its reduced extra component as additive to the minimum');
assert.match(citiDebtCard, /Extra payoff[\s\S]*?Required Aug 20, 2026/,
  'a partial payment containing both components must show the useful breakdown once');
assert.equal(270 + 1968.60, 2238.60,
  'required plus pure extra must reconcile to the existing proposed CitiAA payment without double counting');
assert.doesNotMatch(southwestDebtCard, /Extra payoff<\/span>|\$0\.00/,
  'a required-only payment must hide zero extra and duplicate-total rows');
const recordedPaidPlan = JSON.parse(JSON.stringify(outcomePlan));
recordedPaidPlan.monthlyDebtEvidence = [{ name: 'Marriott', originalName: 'Credit Card - Marriott',
  status: 'RECORDED_PAID', dueDate: '2026-08-26', obligationAmount: 240,
  recordedPaymentAmount: 240, remainingRequiredAmount: 0, paymentDate: '2026-08-09' }];
const recordedPaidHtml = clientContext.capitalAllocationDebtViewHtml_(recordedPaidPlan);
assert.match(recordedPaidHtml,
  /Required payments this month[\s\S]*?\$2,673\.41[\s\S]*?Required payments already covered[\s\S]*?−\$240\.00[\s\S]*?Required payments still to cover[\s\S]*?\$2,433\.41/,
  'recorded payments must reduce the remaining required ledger without hiding the monthly obligation');
assert.match(recordedPaidHtml,
  /Monthly payment covered[\s\S]*?Marriott[\s\S]*?Recorded payment[\s\S]*?\$240\.00 on Aug 9, 2026/,
  'manual Cash Flow evidence must say recorded, not confirmed');
const partiallyPaidPlan = JSON.parse(JSON.stringify(outcomePlan));
partiallyPaidPlan.monthlyDebtEvidence = [{ name: 'United', originalName: 'Credit Card - United',
  status: 'PARTIALLY_PAID', dueDate: '2026-08-29', obligationAmount: 175,
  recordedPaymentAmount: 100, remainingRequiredAmount: 75, paymentDate: '2026-08-12' }];
const partiallyPaidHtml = clientContext.capitalAllocationDebtViewHtml_(partiallyPaidPlan);
assert.match(partiallyPaidHtml,
  /Partially paid[\s\S]*?United[\s\S]*?Recorded payment[\s\S]*?\$100\.00 on Aug 12, 2026[\s\S]*?Required payment[\s\S]*?\$75\.00/,
  'partial payment presentation must show both recorded and remaining required amounts');
const ambiguousPaymentPlan = JSON.parse(JSON.stringify(outcomePlan));
ambiguousPaymentPlan.monthlyDebtEvidence = [{ name: 'United', originalName: 'Credit Card - United',
  status: 'PAYMENT_STATUS_UNKNOWN', dueDate: '2026-08-29', obligationAmount: 175,
  recordedPaymentAmount: 0, remainingRequiredAmount: 175, paymentDate: '' }];
const ambiguousPaymentHtml = clientContext.capitalAllocationDebtViewHtml_(ambiguousPaymentPlan);
assert.match(ambiguousPaymentHtml,
  /Payment status needs review[\s\S]*?United[\s\S]*?Required payment[\s\S]*?\$175\.00/,
  'uncertain evidence must remain visible and fully protected');
assert.doesNotMatch(recordedPaidHtml, /Confirmed paid[\s\S]*?Marriott/,
  'manual recorded evidence must not be upgraded to authoritative confirmation');
const coveredPayoffPlan = JSON.parse(JSON.stringify(outcomePlan));
coveredPayoffPlan.monthlyDebtEvidence = [
  { name: 'American Express', originalName: 'Credit Card - American Express',
    status: 'RECORDED_PAID', dueDate: '2026-08-18', obligationAmount: 1000,
    recordedPaymentAmount: 13588.06, remainingRequiredAmount: 0, paymentDate: '2026-08-09' },
  { name: 'Marriott', originalName: 'Credit Card - Marriott', status: 'RECORDED_PAID',
    dueDate: '2026-08-26', obligationAmount: 240, recordedPaymentAmount: 1375.68,
    remainingRequiredAmount: 0, paymentDate: '2026-08-09' }
];
const coveredPayoffHtml = clientContext.capitalAllocationDebtViewHtml_(coveredPayoffPlan);
const coveredPayoffExtra = coveredPayoffHtml.slice(
  coveredPayoffHtml.indexOf('Extra payoff recommendation'),
  coveredPayoffHtml.indexOf('Already covered this month'));
const coveredPayoffCompleted = coveredPayoffHtml.slice(
  coveredPayoffHtml.indexOf('<details class="capital-allocation-debt-covered">'),
  coveredPayoffHtml.indexOf('Next extra-payoff target'));
assert.match(coveredPayoffExtra,
  /Recommended payoff[\s\S]*?American Express[\s\S]*?Pay off[\s\S]*?\$39,790\.53[\s\S]*?Recorded this month[\s\S]*?\$13,588\.06[\s\S]*?Monthly requirement[\s\S]*?Already covered/,
  'a payoff card must carry its already-covered monthly context without duplicating the account');
assert.match(coveredPayoffCompleted,
  /<details class="capital-allocation-debt-covered">[\s\S]*?2 payments · \$1,240\.00 of required payments covered[\s\S]*?View covered payments/,
  'covered monthly history must be collapsed with a concise count and reconciled required total');
assert.doesNotMatch(coveredPayoffCompleted,
  /<details class="capital-allocation-debt-covered"\s+open/,
  'covered monthly history must remain collapsed by default');
assert.match(coveredPayoffCompleted, /American Express/,
  'a payoff target may also appear inside collapsed covered history when its monthly requirement was recorded paid');
assert.match(coveredPayoffCompleted, /Marriott[\s\S]*?\$1,375\.68/,
  'covered accounts without a current payoff action must remain visible');
assert.match(coveredPayoffHtml,
  /Potentially available over time[\s\S]*?Recommended extra now[\s\S]*?Staged for future decisions[\s\S]*?subject to refreshed balances and upcoming obligations/,
  'Debt must explain staged capital without implying permanent protection');
const termDebtPlan = JSON.parse(JSON.stringify(outcomePlan));
termDebtPlan.afterAction.debts.push({ name: 'Meriwest', debtType: 'Personal Loan',
  isRevolving: false, startingBalance: 12000, proposedPayment: 0,
  projectedEndingBalance: 12000, apr: 6.50, projectedAnnualInterestAvoided: 0 });
termDebtPlan.queue.facts.debts.push(
  { name: 'Meriwest', originalName: 'Meriwest', minimumPayment: 625,
    dueDay: 25, dueDayKnown: true },
  { name: 'Toyota', originalName: 'Toyota', minimumPayment: 350,
    dueDay: 30, dueDayKnown: true }
);
termDebtPlan.forecast90.futureDebtMinimums.push(
  { name: 'Meriwest', dueDate: '2026-08-25', amount: 625 });
termDebtPlan.forecast90.futureBills.push(
  { name: 'Meriwest', dueDate: '2026-08-25', amount: 625 });
termDebtPlan.monthlyDebtEvidence = [{ name: 'Toyota', originalName: 'Toyota',
  status: 'RECORDED_PAID', dueDate: '2026-08-30', obligationAmount: 350,
  recordedPaymentAmount: 350, remainingRequiredAmount: 0, paymentDate: '2026-08-10' }];
const termDebtDecision = clientContext.capitalAllocationPrimaryDecisionModel_(termDebtPlan);
const termDebtMonthly = clientContext.capitalAllocationMonthlyDebtPlanModel_(termDebtPlan, termDebtDecision);
const termDebtHtml = clientContext.capitalAllocationDebtViewHtml_(termDebtPlan);
const termDebtRequired = termDebtHtml.slice(termDebtHtml.indexOf('Still to pay this month'),
  termDebtHtml.indexOf('Extra payoff recommendation'));
const termDebtCovered = termDebtHtml.slice(termDebtHtml.indexOf('Already covered this month'),
  termDebtHtml.indexOf('Next extra-payoff target'));
assert.match(termDebtRequired, /Meriwest[\s\S]*?\$625\.00[\s\S]*?Aug 25, 2026/,
  'an unpaid current-month term-loan obligation must appear with other required debt payments');
assert.doesNotMatch(termDebtRequired, /Toyota/,
  'a term-loan obligation already recorded as covered must not remain in the action list');
assert.match(termDebtCovered,
  /Monthly payment covered[\s\S]*?Toyota[\s\S]*?\$350\.00[\s\S]*?Aug 30, 2026/,
  'a satisfied term-loan obligation must remain visible as already covered');
assert.equal(termDebtMonthly.obligationTotal, 3648.41,
  'all debt types must contribute exactly once to the monthly obligation total');
assert.equal(termDebtMonthly.recordedTotal, 350);
assert.equal(termDebtMonthly.requiredTotal, 3298.41);
assert.equal(termDebtMonthly.extraTotal, 40759.13,
  'term-loan visibility must not change the revolving extra-payoff recommendation');
assert.equal(Math.round(termDebtMonthly.currentDebt * 100) / 100, 98712.16,
  'the credit-card balance metric must remain revolving-only');
const termDebtCustomerHtml = termDebtHtml.split(
  '<details class="capital-allocation-debt-advanced">')[0];
assert.equal((termDebtCustomerHtml.match(/Meriwest/g) || []).length, 1,
  'duplicate Debt and Bill schedule evidence must render one Meriwest obligation');
const termOtherLoans = termDebtHtml.slice(termDebtHtml.indexOf('Other loans'),
  termDebtHtml.indexOf('Audit details'));
assert.doesNotMatch(termOtherLoans, /Meriwest|Toyota/,
  'term loans with a due or covered monthly obligation must not be duplicated under Other loans');
const noOtherLoansPlan = JSON.parse(JSON.stringify(termDebtPlan));
noOtherLoansPlan.afterAction.debts = noOtherLoansPlan.afterAction.debts.filter(row =>
  !/Lake Tahoe/i.test(row.name));
const noOtherLoansHtml = clientContext.capitalAllocationDebtViewHtml_(noOtherLoansPlan);
assert.doesNotMatch(noOtherLoansHtml, /<strong>Other loans<\/strong>|0 loans/,
  'the customer view must not render an empty Other loans section');
const extraOnlyHtml = clientContext.capitalAllocationDetailedDebtOutcomesHtml_([{
  displayName: 'Extra Only', amount: 500, requiredPayment: 0, extraPayment: 500,
  startingBalance: 2000, endingBalance: 1500, apr: 18, annualInterestReduction: 90,
  outcome: 'PAID_DOWN'
}], 'PROPOSED');
assert.doesNotMatch(extraOnlyHtml, /Required payment|Total this week|\$0\.00/,
  'an extra-only payment must hide zero required and duplicate-total rows');
assert.match(extraOnlyHtml, /Recommended extra payment[\s\S]*?Pay \$500\.00/);
assert.doesNotMatch(debtViewHtml, /Balance after plan|capital-allocation-badge">Paid off|capital-allocation-badge">Paid down/,
  'proposed debt actions must remain prospective throughout the detailed view');
assert.match(debtViewHtml, /These payments are not complete yet\.[\s\S]*?After you make the recommended payments/,
  'the proposed Debt view must contain one clear lifecycle instruction');
assert.equal((debtViewHtml.match(/These payments are not complete yet\./g) || []).length, 1,
  'the lifecycle instruction must not be duplicated');
assert.match(debtViewHtml,
  /Next extra-payoff target[\s\S]*?CitiAA — 23\.49% APR[\s\S]*?Next: Marriott 20\.25% → Southwest 20\.24% → United 20\.24%/,
  'customer priority rows must preserve descending revolving APR order');
assert.equal((debtViewHtml.match(/Aug 26, 2026/g) || []).length, 1,
  'a required payment represented by debt and Bill evidence must render once');
assert.doesNotMatch(debtViewHtml, /CitiAA[\s\S]*?Sep 5/,
  'the August monthly payment list must exclude next-month obligations');
assert.match(debtViewHtml, /Other loans[\s\S]*?2 loans · no extra payment recommended this month[\s\S]*?View loans[\s\S]*?Lake Tahoe[\s\S]*?\$562,744\.17 current balance[\s\S]*?Toyota[\s\S]*?\$82,952\.00 current balance/,
  'untouched term loans must use concise current-balance language');
const customerDebtLayer = debtViewHtml.split('<details class="capital-allocation-debt-audit">')[0];
assert.doesNotMatch(customerDebtLayer,
  /CRITICAL|MODERATE|LOW_COST|optimizer|ranked candidate|economic priority class|proposal ID|[A-Z][A-Z0-9_]{3,}/,
  'normal Debt content must not expose severity labels, engine codes, or implementation terms');
assert.doesNotMatch(debtViewHtml, /Samer Robinhood|Projected value after proposed funding|\$16,693\.06/,
  'Debt presentation must not include the projected Robinhood portfolio value');
assert.equal(outcomePlan.afterAction.projectedRobinhoodBalanceAfterContributions, 16693.06,
  'presentation cleanup must not change the backend Robinhood projection');
assert.match(debtViewHtml,
  /Monthly cash freed after payoff[\s\S]*?\$1,193\.72\/month expected[\s\S]*?Paying off American Express is expected to free its current monthly payment[\s\S]*?Available today[\s\S]*?\$0\.00\/month[\s\S]*?refreshed balances confirm the payoff at \$0/,
  'a single payoff must name the debt while keeping released cash prospective and unavailable today');
assert.doesNotMatch(debtViewHtml, /After confirmed payoffs payoff|\$0\.00\/month expected to become available/,
  'the customer layer must not render broken singular/plural wording or a zero future benefit');

const partialPayoffPlan = JSON.parse(JSON.stringify(outcomePlan));
partialPayoffPlan.afterAction.debts[0].proposedPayment = 25572.95;
partialPayoffPlan.afterAction.debts[0].projectedEndingBalance = 14217.58;
partialPayoffPlan.afterAction.debts[0].projectedMonthlyMinimumReleased = 0;
partialPayoffPlan.afterAction.projectedReleasedMonthlyMinimums = 0;
partialPayoffPlan.afterAction.confirmedReleasedMonthlyMinimums = 0;
const partialFreedCashHtml = clientContext.capitalAllocationDebtFreedCashSectionHtml_(
  partialPayoffPlan.afterAction, 'PROPOSED');
assert.match(partialFreedCashHtml,
  /Monthly cash freed[\s\S]*?None yet[\s\S]*?American Express is expected to retain a \$14,217\.58 balance after the current recommendation[\s\S]*?monthly payment will not be considered freed until a refreshed balance confirms the account has been paid off/,
  'a partial payoff must clearly say that no monthly cash is freed yet');
assert.doesNotMatch(partialFreedCashHtml, /\$0\.00\/month expected|After confirmed payoffs payoff/);
assert.match(debtViewHtml, /Audit details[\s\S]*?CRITICAL[\s\S]*?MODERATE[\s\S]*?LOW_COST/,
  'technical severity evidence must remain available only under collapsed Audit details');
assert.match(debtViewHtml, /<details class="capital-allocation-debt-advanced">/);
assert.doesNotMatch(debtViewHtml, /<details class="capital-allocation-debt-advanced"\s+open/,
  'customer Advanced details must be collapsed by default');
assert.doesNotMatch(debtViewHtml, /<details class="capital-allocation-debt-audit"\s+open/,
  'technical Audit details must be collapsed by default');

const unknownDebtPlan = JSON.parse(JSON.stringify(outcomePlan));
unknownDebtPlan.forecast90.futureDebtMinimums = unknownDebtPlan.forecast90.futureDebtMinimums
  .filter(row => !/United/i.test(row.name));
unknownDebtPlan.forecast90.futureBills = unknownDebtPlan.forecast90.futureBills
  .filter(row => !/United/i.test(row.name));
const unknownDebtHtml = clientContext.capitalAllocationDebtViewHtml_(unknownDebtPlan);
assert.match(unknownDebtHtml,
  /Required payment[\s\S]*?United[\s\S]*?\$175\.00[\s\S]*?Aug 29, 2026/,
  'a missing schedule occurrence must not erase the normalized recurring due day');
assert.doesNotMatch(unknownDebtHtml, /No required payment due this month[\s\S]*?United/,
  'absence of schedule evidence must never become a known-zero payment state');

const missingDatePlan = JSON.parse(JSON.stringify(unknownDebtPlan));
const missingDateFact = missingDatePlan.queue.facts.debts.find(row => /United/i.test(row.name));
missingDateFact.dueDayKnown = false;
const missingDateHtml = clientContext.capitalAllocationDebtViewHtml_(missingDatePlan);
assert.match(missingDateHtml,
  /Due date needs updating[\s\S]*?United[\s\S]*?\$175\.00[\s\S]*?Due[\s\S]*?Due date needs updating/,
  'known amount plus missing due-day evidence must request a due-date update specifically');

const southwestAliasPlan = JSON.parse(JSON.stringify(unknownDebtPlan));
const southwestAliasFact = southwestAliasPlan.queue.facts.debts.find(row => /Southwest/i.test(row.name));
southwestAliasFact.name = 'Credit Card - SW';
southwestAliasFact.originalName = 'Credit Card - SW';
southwestAliasFact.dueDay = 22;
southwestAliasFact.dueDayKnown = true;
southwestAliasPlan.weeklyActions.forEach(row => {
  if (/Southwest/i.test(row.targetName || '')) row.dueDate = '';
});
southwestAliasPlan.forecast90.futureBills = southwestAliasPlan.forecast90.futureBills
  .filter(row => !/Southwest/i.test(row.name));
const southwestAliasHtml = clientContext.capitalAllocationDebtViewHtml_(southwestAliasPlan);
assert.match(southwestAliasHtml,
  /Southwest[\s\S]*?\$988\.41[\s\S]*?Aug 22, 2026/,
  'the source representation Credit Card - SW must retain its recorded due day through customer rendering');
assert.doesNotMatch(southwestAliasHtml, /Due date needs updating[\s\S]*?Southwest/,
  'a populated Southwest due day must not be lost by alias matching');

const boundedClosurePlan = JSON.parse(JSON.stringify(householdPlan));
boundedClosurePlan.afterAction.debts.push({ name: 'Meriwest', debtType: 'Personal Loan',
  isRevolving: false, startingBalance: 12000, proposedPayment: 0,
  projectedEndingBalance: 12000, apr: 6.50, projectedAnnualInterestAvoided: 0 });
boundedClosurePlan.queue.facts.debts.push({ name: 'Meriwest', originalName: 'Meriwest',
  minimumPayment: 400, dueDay: 28, dueDayKnown: true });
boundedClosurePlan.monthlyDebtEvidence = [{ name: 'Meriwest', originalName: 'Meriwest',
  status: 'UPCOMING', dueDate: '2026-08-28', obligationAmount: 400,
  recordedPaymentAmount: 0, remainingRequiredAmount: 400, paymentDate: '' }];
const boundedClosureDecision = clientContext.capitalAllocationPrimaryDecisionModel_(boundedClosurePlan);
const boundedClosureMonthly = clientContext.capitalAllocationMonthlyDebtPlanModel_(
  boundedClosurePlan, boundedClosureDecision);
assert.equal(clientContext.capitalAllocationLaterRequiredDebtAmount_(boundedClosureMonthly), 670,
  'Overview later-this-month debt must derive from CitiAA and Meriwest after the seven-day window');
const boundedClosureOverview = clientContext.capitalAllocationPrimaryDecisionHtml_(boundedClosurePlan);
assert.match(boundedClosureOverview,
  /This week's recommendation[\s\S]*?Pay \$42,884\.19 toward debt now[\s\S]*?\$670\.00 of additional required debt payments remain later this month/,
  'Overview must bridge the weekly recommendation to remaining monthly obligations');
const boundedClosureRequired = clientContext.capitalAllocationDebtViewHtml_(boundedClosurePlan)
  .slice(clientContext.capitalAllocationDebtViewHtml_(boundedClosurePlan).indexOf('Still to pay this month'),
    clientContext.capitalAllocationDebtViewHtml_(boundedClosurePlan).indexOf('Extra payoff recommendation'));
assert.ok(boundedClosureRequired.indexOf('Southwest') < boundedClosureRequired.indexOf('CitiAA') &&
  boundedClosureRequired.indexOf('CitiAA') < boundedClosureRequired.indexOf('Meriwest'),
  'remaining monthly obligations must sort Southwest Aug 22 before CitiAA and Meriwest Aug 28');

const missingAmountPlan = JSON.parse(JSON.stringify(unknownDebtPlan));
const missingAmountFact = missingAmountPlan.queue.facts.debts.find(row => /United/i.test(row.name));
missingAmountFact.minimumPayment = 0;
const missingAmountHtml = clientContext.capitalAllocationDebtViewHtml_(missingAmountPlan);
assert.match(missingAmountHtml,
  /Payment amount needs updating[\s\S]*?United[\s\S]*?Aug 29, 2026[\s\S]*?Required payment[\s\S]*?Not recorded/,
  'known due day plus missing amount must request a payment-amount update specifically');

const missingDetailsPlan = JSON.parse(JSON.stringify(missingAmountPlan));
const missingDetailsFact = missingDetailsPlan.queue.facts.debts.find(row => /United/i.test(row.name));
missingDetailsFact.dueDayKnown = false;
assert.match(clientContext.capitalAllocationDebtViewHtml_(missingDetailsPlan),
  /Payment details need updating[\s\S]*?United/,
  'missing amount and date must request payment details without inventing zero or a date');

const explicitNoPaymentPlan = JSON.parse(JSON.stringify(missingDatePlan));
explicitNoPaymentPlan.monthlyDebtEvidence = [
  { name: 'Credit Card - United', status: 'NO_PAYMENT_DUE' }
];
assert.match(clientContext.capitalAllocationDebtViewHtml_(explicitNoPaymentPlan),
  /No required payment due this month[\s\S]*?United/,
  'known no-payment language requires explicit positive evidence');

const satisfiedDebtPlan = JSON.parse(JSON.stringify(missingDatePlan));
satisfiedDebtPlan.monthlyDebtEvidence = [
  { name: 'Credit Card - United', status: 'SATISFIED' }
];
assert.match(clientContext.capitalAllocationDebtViewHtml_(satisfiedDebtPlan),
  /Required payment satisfied[\s\S]*?United/,
  'a positively satisfied cycle must not remain due');

const overdueDebtPlan = JSON.parse(JSON.stringify(missingDatePlan));
overdueDebtPlan.forecast90.futureBills.push(
  { name: 'United', dueDate: '2026-08-11', amount: 175 }
);
assert.match(clientContext.capitalAllocationDebtViewHtml_(overdueDebtPlan),
  /Past due[\s\S]*?United[\s\S]*?\$175\.00[\s\S]*?Aug 11, 2026/,
  'an unpaid current-month date before the Planning date must remain visible as past due');

const nextMonthOnlyPlan = JSON.parse(JSON.stringify(missingDatePlan));
nextMonthOnlyPlan.forecast90.futureBills.push(
  { name: 'United', dueDate: '2026-09-02', amount: 175 }
);
const nextMonthUnitedCard = clientContext.capitalAllocationDebtViewHtml_(nextMonthOnlyPlan)
  .slice(0, clientContext.capitalAllocationDebtViewHtml_(nextMonthOnlyPlan)
    .indexOf('Next extra-payoff target'));
assert.doesNotMatch(nextMonthUnitedCard, /Sep 2/,
  'a September obligation must not appear in an August monthly debt plan');
assert.match(nextMonthUnitedCard, /Due date needs updating[\s\S]*?United/,
  'next-month evidence must not be repurposed as current-month evidence');

const awaitingOutcomePlan = JSON.parse(JSON.stringify(outcomePlan));
awaitingOutcomePlan.recommendationLifecycle.currentPlanState = 'AWAITING_CONFIRMATION';
const awaitingDebtHtml = clientContext.capitalAllocationDebtViewHtml_(awaitingOutcomePlan);
assert.match(awaitingDebtHtml, /Debt plan this month[\s\S]*?Waiting for confirmation[\s\S]*?These payments are waiting for confirmation/);
assert.doesNotMatch(awaitingDebtHtml, /capital-allocation-badge">Paid off|Confirmed balance/,
  'awaiting-confirmation actions must not render a confirmed payoff or balance');
assert.match(awaitingDebtHtml, /Available today[\s\S]*?\$0\.00\/month/,
  'awaiting confirmation must not release projected monthly payments');

const confirmedOutcomePlan = JSON.parse(JSON.stringify(outcomePlan));
confirmedOutcomePlan.recommendationLifecycle.currentPlanState = 'CONFIRMED';
confirmedOutcomePlan.afterAction.confirmedReleasedMonthlyMinimums = 1193.72;
const confirmedDebtHtml = clientContext.capitalAllocationDebtViewHtml_(confirmedOutcomePlan);
assert.match(confirmedDebtHtml, /Debt plan this month[\s\S]*?Confirmed[\s\S]*?Confirmed payoff[\s\S]*?American Express[\s\S]*?\$39,790\.53 → \$0\.00 expected/);
assert.match(confirmedDebtHtml, /These payments have been confirmed/,
  'completed-state language is reserved for the confirmed lifecycle');
assert.match(confirmedDebtHtml,
  /Monthly cash freed[\s\S]*?\$1,193\.72\/month confirmed[\s\S]*?American Express has been confirmed paid off/,
  'a confirmed zero balance must present released monthly cash as confirmed');
assert.equal(Number(outcomePlan.afterAction.confirmedReleasedMonthlyMinimums || 0), 0,
  'presentation must not release a minimum before refreshed confirmation');

const pluralPayoffPlan = JSON.parse(JSON.stringify(outcomePlan));
pluralPayoffPlan.afterAction.debts[1].projectedEndingBalance = 0;
pluralPayoffPlan.afterAction.debts[1].projectedMonthlyMinimumReleased = 270;
pluralPayoffPlan.afterAction.projectedReleasedMonthlyMinimums = 1463.72;
const pluralFreedCashHtml = clientContext.capitalAllocationDebtFreedCashSectionHtml_(
  pluralPayoffPlan.afterAction, 'PROPOSED');
assert.match(pluralFreedCashHtml,
  /Monthly cash freed after payoff[\s\S]*?\$1,463\.72\/month expected[\s\S]*?These recommended payoffs are expected to free their current monthly payments[\s\S]*?confirm the payoffs at \$0/,
  'multiple projected payoffs must use grammatical plural customer wording');
assert.doesNotMatch(pluralFreedCashHtml, /payoffs payoff|payoff are|payoffs is/);
assert.equal(JSON.stringify({
  weeklyActions: outcomePlan.weeklyActions,
  debts: outcomePlan.afterAction.debts,
  projectedReleasedMonthlyMinimums: outcomePlan.afterAction.projectedReleasedMonthlyMinimums,
  confirmedReleasedMonthlyMinimums: outcomePlan.afterAction.confirmedReleasedMonthlyMinimums,
  projectedRobinhoodBalanceAfterContributions:
    outcomePlan.afterAction.projectedRobinhoodBalanceAfterContributions,
  futureDebtMinimums: outcomePlan.forecast90.futureDebtMinimums,
  futureBills: outcomePlan.forecast90.futureBills,
  recommendationLifecycle: outcomePlan.recommendationLifecycle
}), outcomeFinancialBeforeDebtPresentation,
  'Debt presentation must leave weekly actions, monthly obligations, balances, APRs, released cash, Robinhood, and lifecycle byte-equivalent');

const overviewHtml = clientContext.capitalAllocationPrimaryDecisionHtml_(plan) +
  clientContext.capitalAllocationProgressHtml_(plan) +
  clientContext.capitalAllocationOverviewWarningsHtml_(plan, [], plan.dataQuality || []) +
  clientContext.capitalAllocationOverviewNextStepHtml_(plan);
assert.match(overviewHtml,
  /This week's recommendation[\s\S]*?Your progress[\s\S]*?(?:Needs your attention|Plan notes)[\s\S]*?Next step/);
assert.match(overviewHtml,
  /Credit-card debt remaining[\s\S]*?After this week(?:'|&#39;)s recommended payments[\s\S]*?Next target:/,
  'the revolving-debt progress card must identify the prospective amount remaining and its next target');
assert.doesNotMatch(overviewHtml, /Credit-card debt<\/div>[\s\S]*?expected/,
  'the revolving-debt value must not rely on a vague expected suffix');
assert.match(overviewHtml,
  /Income portfolio[\s\S]*?Current value[\s\S]*?\+\$500\.00 this week/,
  'the income-portfolio card must distinguish current value from this week\'s contribution');
const progressExamplePlan = JSON.parse(JSON.stringify(plan));
progressExamplePlan.afterAction.projectedReleasedMonthlyMinimums = 1193.72;
progressExamplePlan.afterAction.confirmedReleasedMonthlyMinimums = 0;
const progressExampleHtml = clientContext.capitalAllocationProgressHtml_(progressExamplePlan);
assert.match(progressExampleHtml,
  /Monthly cash freed[\s\S]*?\$1,193\.72\/month expected[\s\S]*?After the recommended payoff is confirmed[\s\S]*?Currently confirmed: \$0\.00\/month/,
  'the freed-cash card must lead with the prospective benefit while preserving the confirmed current state');
assert.doesNotMatch(overviewHtml, /Monthly payments freed|\$0\.00 confirmed[\s\S]*?projected after confirmation/,
  'the primary progress card must not lead with lifecycle-oriented wording');
const attentionPlan = JSON.parse(JSON.stringify(plan));
attentionPlan.capitalSourceLadder.cashAccounts = [
  { accountName: 'Ally - Samer Savings', zeroBufferWarning: true },
  { accountName: 'Household Checking', zeroBufferWarning: false }
];
attentionPlan.capitalSourceLadder.steps = (attentionPlan.capitalSourceLadder.steps || []).filter(row =>
  String(row.status || '') !== 'TAX_DATA_REQUIRED').concat([
  { sourceName: 'Brokerage One', status: 'TAX_DATA_REQUIRED' },
  { sourceName: 'Brokerage Two', status: 'TAX_DATA_REQUIRED' }
]);
attentionPlan.capitalSourceLadder.zeroBufferWarningCount = 1;
const attentionHtml = clientContext.capitalAllocationOverviewWarningsHtml_(attentionPlan, [],
  [{}, {}, {}, {}]);
assert.match(attentionHtml,
  /Needs your attention[\s\S]*?1 action needed[\s\S]*?Set a cash buffer for Ally - Samer Savings/,
  'the immediate action must name the affected cash account from plan data');
assert.match(attentionHtml,
  /Cash Compass currently considers the full eligible balance available to use[\s\S]*?Set a protected amount if some of this money should remain untouched/,
  'the cash-buffer action must explain why the customer should review the account');
assert.match(attentionHtml,
  /openCapitalAllocationCashBufferReview_[\s\S]*?Review cash buffer/,
  'the customer action must route to the real bank-account management experience');
assert.match(attentionHtml,
  /Also:[\s\S]*?2 investments need tax information[\s\S]*?4 bills are using estimates/,
  'tax requirements and bill estimates must remain visible as secondary information');
assert.doesNotMatch(attentionHtml,
  /1 cash buffer|Information still needed|TAX_DATA_REQUIRED|POLICY_FLOOR|blocking item|Action needed now/,
  'the primary attention layer must not expose diagnostic counts or internal states');
const zeroActionHtml = clientContext.capitalAllocationOverviewWarningsHtml_(
  { capitalSourceLadder: { cashAccounts: [], steps: attentionPlan.capitalSourceLadder.steps } }, [], [{}]);
assert.match(zeroActionHtml,
  /Plan notes[\s\S]*?No action needed right now[\s\S]*?2 investments need tax information[\s\S]*?1 bill is using estimates/,
  'informational limitations must remain calm when no immediate action exists');
assert.doesNotMatch(zeroActionHtml, /Needs your attention[\s\S]*?0|0 actions needed/);
const multipleActionPlan = JSON.parse(JSON.stringify(attentionPlan));
multipleActionPlan.capitalSourceLadder.cashAccounts = [
  { accountName: 'Ally - Samer Savings', zeroBufferWarning: true },
  { accountName: 'Rental Reserve', zeroBufferWarning: true },
  { accountName: 'Tax Reserve', zeroBufferWarning: true },
  { accountName: 'Household Checking', zeroBufferWarning: true }
];
const multipleActionHtml = clientContext.capitalAllocationOverviewWarningsHtml_(multipleActionPlan,
  [{ findingId: 'MISSING_DEBT_APR:CITIAA', message: 'CitiAA has no usable APR. Ranking must wait.' }], []);
assert.match(multipleActionHtml,
  /5 actions needed[\s\S]*?Set a cash buffer for Ally - Samer Savings[\s\S]*?Set a cash buffer for Rental Reserve[\s\S]*?Set a cash buffer for Tax Reserve[\s\S]*?Review 2 more actions/,
  'multiple immediate actions must stay concise and expose the remainder on demand');
assert.match(multipleActionHtml, /Verify the APR for CitiAA/,
  'known blocking information must translate into a customer action without exposing its reason code');
assert.doesNotMatch(multipleActionHtml, /MISSING_DEBT_APR|TAX_DATA_REQUIRED/);
assert.match(client, /function openCapitalAllocationCashBufferReview_\(\)[\s\S]*?showTab\('bank'\)[\s\S]*?setBankPanelMode\('manage'\)/,
  'Review cash buffer must open the existing Bank accounts management flow');
assert.doesNotMatch(client, /openCapitalAllocationCashBufferReview_[\s\S]{0,300}(?:google\.script\.run|setValue|save|submit)/,
  'the review route must not write or change a buffer automatically');
assert.doesNotMatch(overviewHtml, /Proposal [A-Z0-9-]+|Eligible Cash Sources|How the 90-day reserve is calculated|View allocation logic/,
  'Overview must keep audit and formula detail out of the daily cockpit');
const cashViewHtml = clientContext.capitalAllocationCashViewHtml_(plan);
const investmentsViewHtml = clientContext.capitalAllocationInvestmentsViewHtml_(plan);
const propertiesViewHtml = clientContext.capitalAllocationPropertiesViewHtml_(plan.forecast90);
const forecastViewHtml = clientContext.capitalAllocationForecastViewHtml_(plan, plan.dataQuality || []);
assert.match(cashViewHtml, /Keep available[\s\S]*?Available to use[\s\S]*?Protected accounts[\s\S]*?Choose your pace[\s\S]*?Advanced calculation details/);
assert.match(investmentsViewHtml, /Investment plan this week[\s\S]*?Current contribution decisions[\s\S]*?Brokerage accounts to review later[\s\S]*?Tax information needed before recommending a sale/);
assert.match(propertiesViewHtml, /Property reserve[\s\S]*?scheduled property bills are already counted elsewhere/i);
assert.match(forecastViewHtml, /Next 90 days[\s\S]*?Upcoming requirements[\s\S]*?What waits[\s\S]*?After confirmation[\s\S]*?Audit details/);
assert.doesNotMatch(cashViewHtml.replace(/<details class="capital-allocation-(?:deployment-pace|audit-details)"[\s\S]*?<\/details>/g, ''),
  /CAP-[A-Z0-9-]+|IDEMPOTENT_SNAPSHOT_NOT_ADDITIVE|SNAPSHOT_IDEMPOTENT_ONLY|CASH_YIELD_DATA_REQUIRED/,
  'normal Cash content must not expose proposal or implementation codes');
assert.doesNotMatch(investmentsViewHtml.replace(/<details class="capital-allocation-audit-details"[\s\S]*?<\/details>/g, ''),
  /TAX_DATA_REQUIRED|STABLE_ID_REQUIRED|RETIREMENT_OR_RESTRICTED|STRATEGIC_DESTINATION|NO_SURPLUS_ESTABLISHED|ELIGIBLE_FUTURE_CASH_FLOW/,
  'normal Investments content must translate backend states');
assert.doesNotMatch(forecastViewHtml.split('<details class="capital-allocation-calculation-details">')[0],
  /optimizer|deployment budget|ranked candidates|idempotent|source ladder|normalized weekly value|CAP-[A-Z0-9-]+|[A-Z][A-Z0-9_]{3,}/,
  'normal Forecast content must use customer financial language');
const normalCustomerLayer = [overviewHtml, debtViewHtml,
  cashViewHtml.split('<details class="capital-allocation-deployment-pace">')[0],
  investmentsViewHtml.split('<details class="capital-allocation-audit-details">')[0],
  propertiesViewHtml.split('<details class="capital-allocation-property-detail">')[0],
  forecastViewHtml.split('<details class="capital-allocation-calculation-details">')[0]
].join('\n');
for (const internalTerm of [
  'CASH_YIELD_DATA_REQUIRED', 'TAX_DATA_REQUIRED', 'STABLE_ID_REQUIRED',
  'ELIGIBLE_FUTURE_CASH_FLOW', 'NO_SURPLUS_ESTABLISHED',
  'RETIREMENT_OR_RESTRICTED', 'STRATEGIC_DESTINATION', 'POLICY_FLOOR',
  'IDEMPOTENT_SNAPSHOT_NOT_ADDITIVE', 'SNAPSHOT_IDEMPOTENT_ONLY'
]) {
  assert.doesNotMatch(normalCustomerLayer, new RegExp(internalTerm),
    `${internalTerm} must not appear in the normal customer layer`);
}
assert.doesNotMatch(normalCustomerLayer,
  /\b(?:optimizer|deployment budget|ranked candidates|source ladder|normalized weekly value|idempotent|authority class|reconciliation mechanics)\b/i,
  'normal Planning content must avoid implementation-oriented English');
assert.match(cashViewHtml, /CASH_YIELD_DATA_REQUIRED[\s\S]*?Proposal CAP-/,
  'cash audit details must retain the raw yield and proposal evidence');
assert.match(investmentsViewHtml, /Advanced details[\s\S]*?TAX_DATA_REQUIRED/,
  'investment audit details must retain the raw status evidence');
assert.match(forecastViewHtml, /Audit details[\s\S]*?Ranked choices/,
  'Forecast must retain the full recommended order under Audit details');
assert.equal(JSON.stringify({
  summary: plan.summary,
  weeklyActions: plan.weeklyActions,
  rankedCandidates: plan.rankedCandidates,
  investmentPolicy: plan.investmentPolicy,
  contributionStrategy: plan.contributionStrategy,
  deploymentPace: plan.deploymentPace,
  forecast90: plan.forecast90,
  afterAction: plan.afterAction,
  recommendationLifecycle: plan.recommendationLifecycle
}), financialOutputBeforePresentation,
  'presentation rendering must leave every financial output byte-equivalent');
assert.equal(overviewHtml.length < debtViewHtml.length + cashViewHtml.length +
  investmentsViewHtml.length + propertiesViewHtml.length + forecastViewHtml.length, true,
  'the default cockpit must be materially shorter than the reachable domain detail');
assert.equal(outcomeDecision.debtAmount, 43017.54,
  'presentation classification must not alter the underlying proposed payments');
assert.equal(plan.economicAssumptions.investmentComparison.source, 'DEFAULT_PLANNING_ASSUMPTION');
assert.equal(plan.capitalSourceLadder.steps.some(row =>
  row.sourceType === 'PAUSE_OR_REDIRECT_FUTURE_CONTRIBUTION' && row.sourceName === 'M1 Investment'), true);
assert.equal(plan.capitalSourceLadder.steps.some(row =>
  row.sourceType === 'BROKERAGE_IN_KIND_TRANSFER_REVIEW' && row.status === 'REVIEW_COMPATIBILITY'), true);
assert.equal(plan.capitalSourceLadder.steps.some(row =>
  row.sourceType === 'BROKERAGE_SELL_OR_TRIM_REVIEW' && row.status === 'TAX_DATA_REQUIRED'), true);
assert.equal(plan.nextDollar.destination, 'Amex');
assert.equal(plan.whyNot.winner, 'PAY_DEBT');
assert.equal(plan.weeklyActions.every(row => row.recommendationState === 'PROPOSED'), true);
assert.equal(plan.summary.endingCash > plan.summary.reserve90Days, true,
  'Balanced mode must intentionally retain cash above the hard floor');
const robinhoodFloorIndex = plan.weeklyActions.findIndex(row =>
  row.actionType === 'FUND_INCOME_PRODUCING_MINIMUM');
const firstExtraDebtIndex = plan.weeklyActions.findIndex(row => row.actionType === 'PAY_EXTRA_DEBT');
assert.equal(plan.weeklyActions.every((row, index) =>
  (row.actionType !== 'PAY_DEBT_MINIMUM' && row.actionType !== 'PAY_TRACKED_BILL') ||
    index < robinhoodFloorIndex), true,
  'required payments must be planned before the Robinhood policy floor');
assert.equal(robinhoodFloorIndex < firstExtraDebtIndex, true,
  'the Robinhood policy floor must be funded before accelerated debt payments');
assert.equal(plan.weeklyActions.filter(row => row.actionType === 'PAY_EXTRA_DEBT')
  .reduce((sum, row) => sum + Number(row.amount || 0), 0) <=
    plan.deploymentPace.recommendedAcceleratedDeployment, true,
  'accelerated debt must remain within the approved deployment budget');

const payoffFacts = JSON.parse(JSON.stringify(planFacts));
payoffFacts.liquidity.accounts = [];
payoffFacts.liquidityPlanning = { otherKnownCushionAmount: 1000 };
payoffFacts.debts = [
  { name: 'Amex', originalName: 'Amex', active: true, balance: 1000,
    minimumPayment: 300, interestRate: 26.99, type: 'Credit Card' },
  { name: 'Second Card', originalName: 'Second Card', active: true, balance: 10000,
    minimumPayment: 200, interestRate: 20, type: 'Credit Card' }
];
payoffFacts.obligations = [
  { sourceType: 'debt_minimum', sourceId: 'Amex', name: 'Amex',
    actionType: 'PAY_DEBT_MINIMUM', amount: 300, requiredThisWeek: true,
    amountBasis: 'MINIMUM_PAYMENT', reason: 'Due', provenance: 'INPUT - Debts' },
  { sourceType: 'tracked_bill', sourceId: 'Tax:2026-08-20', name: 'Property tax',
    actionType: 'PAY_TRACKED_BILL', amount: 850, requiredThisWeek: true,
    amountBasis: 'DEFAULT_AMOUNT', reason: 'Due', provenance: 'INPUT - Bills' }
];
const payoffPlan = context.buildCapitalAllocationPlan_(payoffFacts);
const payoffExtraActions = payoffPlan.weeklyActions.filter(row =>
  row.actionType === 'PAY_EXTRA_DEBT');
assert.deepEqual(Array.from(payoffExtraActions, row => row.targetName),
  ['Amex', 'Second Card'],
  'accelerated revolving debt must remain highest-APR-first');
assert.equal(payoffExtraActions[0].amount, 700,
  'the highest-APR card receives only the amount remaining after its required minimum');
const paidOffDebt = payoffPlan.afterAction.debts.find(row => row.name === 'Amex');
const remainingDebt = payoffPlan.afterAction.debts.find(row => row.name === 'Second Card');
assert.equal(paidOffDebt.projectedEndingBalance, 0);
assert.equal(paidOffDebt.projectedMonthlyMinimumReleased, 300,
  'a proposed full payoff may project its minimum as a future release');
assert.equal(remainingDebt.projectedEndingBalance > 0, true);
assert.equal(remainingDebt.projectedMonthlyMinimumReleased, 0,
  'a positive projected balance must retain its minimum-payment obligation');
assert.equal(payoffPlan.afterAction.confirmedReleasedMonthlyMinimums, 0,
  'no proposed payoff releases a minimum before authoritative refreshed confirmation');
assert.equal(payoffPlan.recommendationLifecycle.downstreamEffectsState, 'AWAITING_CONFIRMATION');
const assertDeploymentReconciliation = (candidate, label) => {
  assert.equal(candidate.summary.openingCash + candidate.summary.expectedIncomeThisWeek,
    candidate.summary.householdRequiredThisWeek + candidate.summary.standingInvestmentFunded +
      candidate.deploymentPace.recommendedAcceleratedDeployment +
      candidate.deploymentPace.intentionallyRetainedLiquidity,
    `${label} must subtract household requirements and the Robinhood floor exactly once`);
};
assertDeploymentReconciliation(plan, 'Balanced');

const liquidityFirstFacts = JSON.parse(JSON.stringify(planFacts));
liquidityFirstFacts.liquidityPreference = 'LIQUIDITY_FIRST';
const liquidityFirstPlan = context.buildCapitalAllocationPlan_(liquidityFirstFacts);
const aggressiveFacts = JSON.parse(JSON.stringify(planFacts));
aggressiveFacts.liquidityPreference = 'AGGRESSIVE_DEBT_REDUCTION';
const aggressivePlan = context.buildCapitalAllocationPlan_(aggressiveFacts);
assert.equal(liquidityFirstPlan.deploymentPace.preferredLiquidityTarget >
  plan.deploymentPace.preferredLiquidityTarget, true);
assert.equal(liquidityFirstPlan.deploymentPace.recommendedAcceleratedDeployment <
  plan.deploymentPace.recommendedAcceleratedDeployment, true);
assert.equal(aggressivePlan.deploymentPace.preferredLiquidityTarget <
  plan.deploymentPace.preferredLiquidityTarget, true);
assert.equal(aggressivePlan.deploymentPace.recommendedAcceleratedDeployment >
  plan.deploymentPace.recommendedAcceleratedDeployment, true);
assert.equal(aggressivePlan.summary.endingCash >= aggressivePlan.summary.reserve90Days, true,
  'aggressive pacing must never breach the hard operating floor');
assertDeploymentReconciliation(liquidityFirstPlan, 'Liquidity First');
assertDeploymentReconciliation(aggressivePlan, 'Aggressive debt reduction');

const trackedFacts = JSON.parse(JSON.stringify(householdFacts));
trackedFacts.deploymentTracking = { planningPeriod: 'MONTHLY',
  alreadyDeployedThisPeriod: 20000, awaitingConfirmationAmount: 0 };
const trackedPlan = context.buildCapitalAllocationPlan_(trackedFacts);
assert.equal(trackedPlan.deploymentPace.remainingDeploymentBudget, 21895.78,
  'weekly refresh must use only remaining monthly deployment capacity');
const awaitingFacts = JSON.parse(JSON.stringify(trackedFacts));
awaitingFacts.deploymentTracking.alreadyDeployedThisPeriod = 0;
awaitingFacts.deploymentTracking.awaitingConfirmationAmount = 41895.78;
const awaitingPlan = context.buildCapitalAllocationPlan_(awaitingFacts);
assert.equal(awaitingPlan.deploymentPace.remainingDeploymentBudget, 0,
  'awaiting deployment must not be recommended again');
assert.equal(context.buildCapitalAllocationPlan_(awaitingFacts).deploymentPace.proposalId,
  awaitingPlan.deploymentPace.proposalId, 'unchanged facts must preserve one proposal identity');
const nextDayFacts = JSON.parse(JSON.stringify(planFacts));
nextDayFacts.asOfDate = '2026-08-15';
assert.equal(context.buildCapitalAllocationPlan_(nextDayFacts).deploymentPace.proposalId,
  plan.deploymentPace.proposalId,
  'unchanged facts refreshed on another day in the same week must preserve one proposal identity');
assert.equal(trackedPlan.deploymentPace.confirmedDeploymentAmount, 20000,
  'confirmed deployment must be disclosed and reduce the remaining period capacity');

const sourceAudit = context.buildCapitalAllocationSourceLadder_({ liquidity: { accounts: [
  { accountName: 'Zero buffer savings', balance: 30000, minBuffer: 0,
    usable: 30000, included: true, usePolicy: 'use with caution' },
  { accountName: 'Protected savings', balance: 10000, minBuffer: 2500,
    usable: 7500, included: true, usePolicy: 'extra cash' }
] } }, plan);
assert.equal(sourceAudit.totalEligibleCash, 37500);
assert.equal(sourceAudit.zeroBufferWarningCount, 1);
assert.equal(sourceAudit.cashAccounts[0].warning.includes('full positive balance'), true);

const protectedSourceAudit = context.buildCapitalAllocationSourceLadder_({ liquidity: { accounts: [
  { accountName: 'BofA protected', balance: 40000, minBuffer: 0, usable: 0,
    included: false, usePolicy: 'do not touch', planningRole: 'DO_NOT_TOUCH',
    excludedReason: 'hard_exclusion_role' },
  { accountName: 'Child savings', balance: 12000, minBuffer: 0, usable: 0,
    included: false, usePolicy: 'extra cash', planningRole: 'CHILD_CUSTODIAL',
    excludedReason: 'hard_exclusion_role' },
  { accountName: 'Samer Ally', balance: 30411.01, minBuffer: 10000, usable: 20411.01,
    included: true, usePolicy: 'use with caution', planningRole: '' }
] } }, plan);
assert.equal(protectedSourceAudit.totalEligibleCash, 20411.01,
  'only the configured Samer Ally amount above its buffer is eligible');
assert.equal(protectedSourceAudit.cashAccounts.find(row => row.accountName === 'BofA protected').status,
  'EXCLUDED');
assert.equal(protectedSourceAudit.cashAccounts.find(row => row.accountName === 'Child savings').status,
  'EXCLUDED');
assert.equal(plan.reconciliation.cashUses,
  plan.reconciliation.openingCash + plan.reconciliation.expectedInflows - plan.reconciliation.endingCash,
  'cash sources and proposed uses must reconcile once without double counting');

const blockedFacts = JSON.parse(JSON.stringify(planFacts));
blockedFacts.dataQuality = [{ findingId: 'BLOCK', severity: 'ERROR', blocksAllocation: true,
  message: 'Blocked', provenance: 'Fixture' }];
const blocked = context.buildCapitalAllocationPlan_(blockedFacts);
assert.equal(blocked.allocationStatus, 'BLOCKED');
assert.equal(blocked.reconciliation.endingCash, 5800);
assert.equal(blocked.weeklyActions.some(row =>
  row.actionType === 'FUND_INCOME_PRODUCING_MINIMUM' && row.amount === 500), true,
  'required Robinhood funding remains visible even when discretionary allocation is blocked');
assert.equal(!!blocked.capitalSourceLadder && !!blocked.nextDollar && !!blocked.whyNot, true,
  'blocked plans still expose source, next-dollar, and comparison views');

const shortFacts = JSON.parse(JSON.stringify(planFacts));
shortFacts.liquidity.cashToUse = 100;
const shortPlan = context.buildCapitalAllocationPlan_(shortFacts);
assert.equal(shortPlan.allocationStatus, 'INSUFFICIENT_CASH');
assert.equal(shortPlan.dataQuality.some(row =>
  row.findingId === 'INSUFFICIENT_CASH_FOR_REQUIRED_ACTIONS' && row.blocksAllocation), true);
assert.equal(shortPlan.reconciliation.difference, 0);

const emergencyFacts = JSON.parse(JSON.stringify(planFacts));
const emergencyPlan = context.buildCapitalAllocationPlan_(emergencyFacts);
const emergencyMinimum = emergencyPlan.weeklyActions.find(row =>
  row.actionType === 'FUND_INCOME_PRODUCING_MINIMUM');
assert.equal(emergencyPlan.summary.emergencyInvestmentOverride, false);
assert.equal(emergencyPlan.summary.standingInvestmentFunded, 500);
assert.equal(emergencyMinimum.status, 'REQUIRED');
assert.equal(emergencyPlan.summary.requiredThisWeek, 1650,
  'critical revolving debt must not cancel the standing Robinhood policy minimum');
assert.equal(emergencyPlan.nextDollar.destination, 'Amex',
  'critical debt still receives remaining goal money after the standing minimum');
assert.equal(emergencyPlan.summary.emergencyInvestmentOverrideReasons.length, 0);

const solvencyFacts = JSON.parse(JSON.stringify(planFacts));
solvencyFacts.liquidity.cashToUse = 3300;
const solvencyPlan = context.buildCapitalAllocationPlan_(solvencyFacts);
const solvencyMinimum = solvencyPlan.weeklyActions.find(row =>
  row.actionType === 'FUND_INCOME_PRODUCING_MINIMUM');
assert.equal(solvencyPlan.summary.emergencyInvestmentOverride, true);
assert.equal(solvencyPlan.summary.standingInvestmentFunded, 0);
assert.equal(solvencyMinimum.status, 'EMERGENCY_OVERRIDE');
assert.equal(solvencyPlan.investmentPolicy.overrideReasons[0].code, 'OPERATING_FLOOR_CONFLICT');
assert.equal(solvencyPlan.contributionStrategy.recommendation,
  'HOLD_OPTIONAL_DURING_POLICY_OVERRIDE');
assertDeploymentReconciliation(solvencyPlan, 'Emergency Robinhood override');
assert.match(solvencyPlan.investmentPolicy.overrideReasons[0].message,
  /below the \$2000\.00 hard operating floor/);

const revolvingFacts = JSON.parse(JSON.stringify(planFacts));
revolvingFacts.liquidity.cashToUse = 8500;
revolvingFacts.liquidity.accounts = [];
revolvingFacts.forecast90.requiredReserveAmount = 2000;
revolvingFacts.obligations = [];
revolvingFacts.debts = [
  { name: 'Card 18', originalName: 'Card 18', type: 'Credit Card', active: true,
    balance: 2000, minimumPayment: 50, interestRate: 18 },
  { name: 'Card 12', originalName: 'Card 12', type: 'Revolving', active: true,
    balance: 3000, minimumPayment: 75, interestRate: 12 },
  { name: 'Card 8', originalName: 'Card 8', type: 'Credit Card', active: true,
    balance: 4000, minimumPayment: 100, interestRate: 8 }
];
const revolvingPlan = context.buildCapitalAllocationPlan_(revolvingFacts);
const revolvingPayments = revolvingPlan.rankedCandidates
  .filter(row => row.actionType === 'PAY_EXTRA_DEBT')
  .map(row => [row.targetName, row.allocatedAmount]);
assert.equal(JSON.stringify(revolvingPayments), JSON.stringify([['Card 18', 1200], ['Card 12', 0], ['Card 8', 0]]),
  'the monthly tranche must remain highest-APR-first without spilling into lower APR debt');

const payoffCapFacts = JSON.parse(JSON.stringify(planFacts));
payoffCapFacts.liquidity.cashToUse = 200000;
payoffCapFacts.liquidity.accounts = [];
payoffCapFacts.debts = [{ name: 'Amex', originalName: 'Amex', active: true,
  balance: 1000, minimumPayment: 300, interestRate: 26.99 }];
payoffCapFacts.obligations = [planFacts.obligations[0]];
payoffCapFacts.incomeProducingAccounts = [{ investmentId: 'INV-1',
  accountName: 'Samer Robinhood', eligible: true, requestedWeeklyPace: 500 }];
const payoffCapPlan = context.buildCapitalAllocationPlan_(payoffCapFacts);
const cappedExtra = payoffCapPlan.rankedCandidates.find(row => row.actionType === 'PAY_EXTRA_DEBT');
assert.equal(cappedExtra.allocatedAmount, 700, 'extra debt must subtract the same-week minimum');
assert.equal(payoffCapPlan.afterAction.projectedReleasedMonthlyMinimums, 300,
  'a fully paid proposed debt projects its minimum into future allocatable cash');
assert.equal(payoffCapPlan.afterAction.projectedReleasedWeeklyEquivalent, 69.23);
assert.equal(payoffCapPlan.afterAction.confirmedReleasedMonthlyMinimums, 0,
  'projected released minimums must not be exposed as confirmed cash flow');
assert.equal(payoffCapPlan.afterAction.state, 'AWAITING_CONFIRMATION');

const transitionFacts = JSON.parse(JSON.stringify(planFacts));
transitionFacts.liquidity.cashToUse = 30000;
transitionFacts.liquidity.accounts = [{ accountName: 'Eligible cash', balance: 30000,
  minBuffer: 0, usable: 30000, included: true, usePolicy: 'use with caution' }];
transitionFacts.liquidityPlanning = { otherKnownCushionAmount: 10000 };
transitionFacts.debts[0].type = 'Credit Card';
transitionFacts.debts[1].interestRate = 7.875;
const transitionPlan = context.buildCapitalAllocationPlan_(transitionFacts);
assert.equal(transitionPlan.summary.emergencyInvestmentOverride, false,
  'critical card debt does not pause the standing Robinhood minimum');
assert.equal(transitionPlan.summary.standingInvestmentFunded, 500);
assert.equal(transitionPlan.afterAction.debts.find(row => row.name === 'Amex').projectedEndingBalance, 0);
assert.equal(transitionPlan.nextDollar.actionType, 'PAY_EXTRA_DEBT');
assert.equal(transitionPlan.nextDollar.recommendationState, 'AWAITING_CONFIRMATION');
assert.equal(transitionPlan.nextDollar.destination, 'Low mortgage');
assert.equal(transitionPlan.whyNot.winner, 'PAY_DEBT');

const lowCostFacts = JSON.parse(JSON.stringify(planFacts));
lowCostFacts.debts = [lowCostFacts.debts[1]];
assert.equal(context.capitalAllocationDebtEconomics_(lowCostFacts.debts[0], lowCostFacts)
  .debtOutranksInvestment, false, '1.99% debt must not automatically outrank investing');
lowCostFacts.investmentComparison = { expectedReturnLow: 3, expectedReturnBase: 5,
  expectedReturnHigh: 8 };
assert.equal(context.capitalAllocationInvestmentComparison_(lowCostFacts).source,
  'CONFIGURED_FACT', 'investment comparison defaults must remain replaceable by configured facts');

const roleMinimum = context.capitalAllocationMinimumWeeklyCommitment_({
  accountName: 'Renamed strategic account', planningRole: 'PRIMARY_INCOME_STRATEGY',
  minimumWeeklyContribution: 625
});
assert.equal(roleMinimum, 625, 'stable planning metadata must survive account rename');

const brokerageFoundation = context.readCapitalAllocationBrokerageFoundation_([
  { sysAssetsRow: 2, investmentId: 'INV-ET-1', accountName: 'Etrade Cisco - Future',
    type: 'Investment account', currentBalance: 972808, active: true,
    planningPurpose: '', planningRole: '' },
  { sysAssetsRow: 3, investmentId: 'INV-ET-2', accountName: 'Etrade Cisco - RSU/ESPP',
    type: 'Investment account', currentBalance: 63504, active: true,
    planningPurpose: '', planningRole: '' },
  { sysAssetsRow: 4, investmentId: '', accountName: '401K Account',
    type: 'Investment account', currentBalance: 1887450, active: true,
    planningPurpose: '', planningRole: '' }
]);
const etradeFuture = brokerageFoundation.find(row => row.accountName === 'Etrade Cisco - Future');
const etradeRsu = brokerageFoundation.find(row => row.accountName === 'Etrade Cisco - RSU/ESPP');
assert.equal(etradeFuture.identityStatus, 'STABLE_ID_VERIFIED');
assert.equal(etradeRsu.identityStatus, 'STABLE_ID_VERIFIED');
assert.equal(etradeFuture.investmentId === etradeRsu.investmentId, false,
  'separate Etrade pools require separate stable identities');
const retirementFoundation = brokerageFoundation.find(row => row.accountName === '401K Account');
assert.equal(retirementFoundation.actionableSource, false);
assert.equal(retirementFoundation.assetClass, 'RETIREMENT_OR_RESTRICTED');

console.log('RFP Capital Allocation and Planning Preview regressions passed.');
