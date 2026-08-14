import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source = fs.readFileSync(new URL('../capital_allocation.js', import.meta.url), 'utf8');
const scenarios = fs.readFileSync(new URL('../test_harness_scenarios_rfp.js', import.meta.url), 'utf8');
const registry = fs.readFileSync(new URL('../test_harness_scenarios.js', import.meta.url), 'utf8');
const suites = fs.readFileSync(new URL('../test_harness_suites.js', import.meta.url), 'utf8');
const body = fs.readFileSync(new URL('../Dashboard_Body.html', import.meta.url), 'utf8');
const client = fs.readFileSync(new URL('../Dashboard_Script_PlanningCapitalAllocation.html', import.meta.url), 'utf8');
const template = fs.readFileSync(new URL('../PlannerDashboardWeb.html', import.meta.url), 'utf8');
const webapp = fs.readFileSync(new URL('../webapp.js', import.meta.url), 'utf8');
const dashboardData = fs.readFileSync(new URL('../dashboard_data.js', import.meta.url), 'utf8');

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
assert.match(source, /getInputBillsDueRows_\(ss, asOfDate, tz, \{ readOnly: true \}\)/);
assert.match(scenarios, /function getHarnessRfpCapitalAllocationScenario_\(\)[\s\S]*?expectedAssertionCount:\s*16/);
assert.match(scenarios, /function getHarnessRfpCapitalAllocationWeeklyPlanScenario_\(\)[\s\S]*?expectedAssertionCount:\s*33/);
assert.match(registry, /getHarnessRfpCapitalAllocationScenario_/);
assert.match(registry, /getHarnessRfpCapitalAllocationWeeklyPlanScenario_/);
assert.match(suites, /SUITE-RFP-CAPITAL-ALLOCATION-FOUNDATION[\s\S]*?REGRESSION-RFP-CAPITAL-ALLOCATION-FOUNDATION/);
assert.match(suites, /SUITE-RFP-CAPITAL-ALLOCATION-FOUNDATION[\s\S]*?REGRESSION-RFP-CAPITAL-ALLOCATION-WEEKLY-PLAN/);
assert.match(dashboardData, /function getInputBillsDueRows_\(ss, today, tz, options\)[\s\S]*?const readOnly =/);
assert.match(source, /VARIABLE_BILL_ESTIMATE_USED:[\s\S]*?'WARNING', false/);
assert.match(source, /VARIABLE_BILL_ESTIMATE_MISSING:[\s\S]*?'ERROR', true/);
assert.match(source, /SAVED_ESTIMATED_AMOUNT/);
assert.match(source, /PROTECT_90_DAY_OPERATING_RESERVE/);
assert.match(source, /readCapitalAllocationForecast90_/);
assert.match(source, /readCapitalAllocationFutureUpcoming_/);
assert.match(source, /capitalAllocationClassifyInvestmentContribution_/);
assert.match(source, /readCapitalAllocationRecurringInvestmentContributions_/);
assert.match(source, /function capitalAllocationBuildPropertyContingency_/);
assert.match(source, /minimumFloor = capitalAllocationMoney_\(historicalAllowance \* 0\.25\)/);
assert.match(source, /SAMER_ALLY_USE_POLICY_CONFLICT/);
assert.match(source, /DUPLICATE_IDENTITY_BLOCKED/);
assert.match(source, /futureOperatingOutflows = capitalAllocationMoney_\([\s\S]*?futureBills\.total \+ futureDebtMinimums\.total \+ futureUpcoming\.total \+[\s\S]*?propertyContingency\.additionalReserveAmount/);
assert.doesNotMatch(source, /futureOperatingOutflows = capitalAllocationMoney_\([\s\S]{0,180}futureInvestmentCommitments\.total/);
assert.match(source, /PROTECT_90_DAY_OPERATING_RESERVE[\s\S]*?FUND_SAMER_ROBINHOOD_WEEKLY_MINIMUM_UNLESS_EMERGENCY_OVERRIDE[\s\S]*?PAY_EXTRA_DEBT_BY_APR/);
assert.match(dashboardData, /function generateOccurrences_\(rule, todayOnly, effectiveDate, horizonEnd\)/);
assert.match(body, /planning-next-actions-feature[\s\S]*?class="tab-btn active"[\s\S]*?data-tab="capitalAllocationPreview"[\s\S]*?Start here[\s\S]*?This week/);
assert.match(body, /planning-tool-group--do-now[\s\S]*?data-tab="nextActions"[\s\S]*?data-tab="rollingDebtPayoff"/);
assert.match(body, /id="nextActions" class="panel"/);
assert.match(body, /id="capitalAllocationPreview" class="panel active"/);
assert.match(client, /getCapitalAllocationPlanFromDashboard/);
assert.match(client, /Variable bills use planning estimates/);
assert.match(client, /estimatedAmount/);
assert.match(client, /episodic bill/);
assert.match(client, /Scheduled categories[\s\S]*?are excluded here because Bills, debt minimums, or Upcoming expenses already own them/);
assert.match(client, /Deployable cash[\s\S]*?Required this week[\s\S]*?Expected 90-day income[\s\S]*?Protected outside plan[\s\S]*?90-day operating reserve[\s\S]*?Available for goals/);
assert.match(client, /Plan at a glance/);
assert.match(client, /Bills & scheduled commitments/);
assert.match(client, /Extra debt payments/);
assert.match(client, /Investment funding/);
assert.match(client, /Protected for the next 90 days/);
assert.match(client, /Unassigned cash/);
assert.match(client, /How the 90-day reserve is calculated/);
assert.match(client, /Expected gross rental income/);
assert.match(client, /Normal Robinhood policy commitments/);
assert.match(client, /Recommended allocation this week/);
assert.match(client, /After Action &rarr; Next Dollar/);
assert.match(client, /Capital Source Ladder/);
assert.match(client, /TAX_DATA_REQUIRED/);
assert.match(client, /Why Robinhood is safety-paused this week/);
assert.match(client, /Projected protected cash after actions/);
assert.match(client, /Safety paused this week/);
assert.match(client, /Retained for household analysis — not funding sources/);
assert.match(client, /unknown-repair floor of 25%/);
assert.match(client, /What waits[\s\S]*?No current contribution plan/);
assert.match(client, /View calculation details/);
assert.match(template, /Dashboard_Script_PlanningCapitalAllocation/);
assert.doesNotMatch(client, /__cashCompassPlanningPreviewEnabled/);
assert.doesNotMatch(template, /planningPreviewEnabledJson/);
assert.doesNotMatch(webapp, /planningPreview/);

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
assert.equal(futureDebtMinimums.rows.some(row => row.name === 'Amex'), false,
  'a debt represented by an active tracked bill must not be forecast twice');
assert.equal(futureDebtMinimums.total, 2700);
const reserveWithHighIncome = context.capitalAllocationReserve90_(12000, 30000);
assert.equal(reserveWithHighIncome.minimumOperatingFloorAmount, 4000);
assert.equal(reserveWithHighIncome.requiredReserveAmount, 4000,
  'forecast income must never erase the one-month operating floor');

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
      { accountName: 'Operating', balance: 10000, minBuffer: 2500, usable: 7500, included: true },
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
planFacts.income = { expectedThisWeek: null, normalizedWeeklyPace: 2000 };
planFacts.forecast90 = {
  horizonDays: 90,
  endDate: '2026-11-11',
  expectedIncome: 9000,
  expectedNonRentalIncome: 6000,
  expectedRentalIncome: 3000,
  futureBillsAmount: 7000,
  futureDebtMinimumsAmount: 3000,
  futureUpcomingAmount: 1000,
  futureInvestmentCommitmentsAmount: 6000,
  propertyContingencyAmount: 0,
  requiredReserveAmount: 2000
};
planFacts.existingInvestmentContributions = [{ name: 'Robinhood', amount: 500,
  matchedInvestmentId: 'INV-1', matchedAccountName: 'Samer Robinhood' },
  { name: 'M1 Investment', amount: 600, matchedInvestmentId: '', matchedAccountName: '' }];
planFacts.brokerageFoundation = [{ investmentId: 'INV-M1', accountName: 'M1 Account',
  currentBalance: 50000, inKindTransferStatus: 'REVIEW_COMPATIBILITY',
  salePlanningStatus: 'TAX_DATA_REQUIRED', actionableSource: true,
  identityMessage: 'Separate SYS - Assets identity verified by INV-M1.', sysAssetsRow: 4 }];
planFacts.dataQuality = [{ findingId: 'VARIABLE_BILL_ESTIMATE_USED:UTILITY',
  severity: 'WARNING', blocksAllocation: false, message: 'Utility uses its saved estimate.',
  provenance: 'INPUT - Bills', estimatedAmount: 175 }];
const plan = context.buildCapitalAllocationPlan_(planFacts);
assert.equal(plan.schemaVersion, 'RFP_3B_V1');
assert.equal(plan.allocationStatus, 'ALLOCATED');
assert.equal(plan.dataQuality[0].blocksAllocation, false);
assert.equal(plan.summary.deployableAfterRequired, 5800);
assert.equal(plan.summary.reserve90Days, 2000);
assert.equal(plan.summary.availableForGoals, 3800);
assert.equal(plan.reconciliation.difference, 0);
assert.equal(plan.reconciliation.endingCash, 2000);
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
assert.equal(highDebt.allocatedAmount, 2800);
assert.equal(lowDebt.allocatedAmount, 0);
assert.equal(highDebt.estimatedAnnualInterestAvoided, 755.72);
assert.equal(plan.monthlyOutlook.totals.incomeProducingFunding, 500);
assert.equal(plan.existingInvestmentContributions[0].amount, 500);
assert.equal(plan.contributionStrategy.recommendation, 'REDIRECT_OPTIONAL_CONTRIBUTIONS_TO_DEBT');
assert.equal(plan.contributionStrategy.redirectedWeekly, 600);
assert.equal(plan.capitalSourceLadder.steps.some(row =>
  row.sourceType === 'PAUSE_OR_REDIRECT_FUTURE_CONTRIBUTION' && row.sourceName === 'M1 Investment'), true);
assert.equal(plan.capitalSourceLadder.steps.some(row =>
  row.sourceType === 'BROKERAGE_IN_KIND_TRANSFER_REVIEW' && row.status === 'REVIEW_COMPATIBILITY'), true);
assert.equal(plan.capitalSourceLadder.steps.some(row =>
  row.sourceType === 'BROKERAGE_SELL_OR_TRIM_REVIEW' && row.status === 'TAX_DATA_REQUIRED'), true);
assert.equal(plan.nextDollar.destination, 'Amex');
assert.equal(plan.whyNot.winner, 'PAY_DEBT');

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
emergencyFacts.debts[0].type = 'Credit Card';
const emergencyPlan = context.buildCapitalAllocationPlan_(emergencyFacts);
const emergencyMinimum = emergencyPlan.weeklyActions.find(row =>
  row.actionType === 'FUND_INCOME_PRODUCING_MINIMUM');
assert.equal(emergencyPlan.summary.emergencyInvestmentOverride, true);
assert.equal(emergencyPlan.summary.standingInvestmentFunded, 0);
assert.equal(emergencyMinimum.status, 'EMERGENCY_OVERRIDE');
assert.equal(emergencyPlan.summary.requiredThisWeek, 1150,
  'critical revolving debt temporarily overrides the normal investment policy minimum');
assert.equal(emergencyPlan.nextDollar.destination, 'Amex',
  'a critical-debt override must not masquerade as an operating-reserve shortfall');
assert.equal(emergencyPlan.summary.emergencyInvestmentOverrideReasons.some(row =>
  row.code === 'CRITICAL_REVOLVING_DEBT' && row.apr === 26.99), true);

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
assert.equal(payoffCapPlan.afterAction.releasedMonthlyMinimums, 300,
  'a fully paid debt releases its minimum into future allocatable cash');
assert.equal(payoffCapPlan.afterAction.releasedWeeklyEquivalent, 69.23);

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
