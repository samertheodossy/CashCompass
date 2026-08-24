import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const read = (name) => fs.readFileSync(new URL(name, root), 'utf8');
const serverSource = read('data_readiness.js');
const clientSource = read('Dashboard_Script_PlanningDataReadiness.html');
const planningSource = read('capital_allocation.js');
const shellSource = read('Dashboard_Script_PlanningCapitalAllocation.html');
const webSource = read('PlannerDashboardWeb.html');
const styles = read('Dashboard_Styles.html');
const help = read('Dashboard_Help.html');
const suites = read('test_harness_suites.js');
const scenarios = read('test_harness_scenarios_rfp.js');

for (const name of ['financialIdentityReadRegistry_', 'cashImportReadSourceLinks_',
  'readFinancialFacts_', 'cashImportLegacyBalanceIndex_', 'debtImportLegacyIndex_']) {
  const count = [...serverSource.matchAll(new RegExp(`${name}\\(`, 'g'))].length;
  assert.equal(count, 1, `${name} must be invoked once by the bulk view-model builder`);
}
assert.match(serverSource, /evaluateWeeklyPlanDataReadinessFromState_\(/,
  'view model must reuse already-loaded state instead of rereading facts');
assert.match(serverSource, /planningUsesNormalizedData:\s*false/);
assert.match(serverSource, /SHADOW_ONLY/);
assert.doesNotMatch(planningSource, /buildPlanningDataReadinessModel_|DATA_READINESS_VIEW_V1/,
  'Part 1 Planning math must not consume the shadow readiness model');
assert.doesNotMatch(serverSource.slice(serverSource.indexOf('var DATA_READINESS_DEBT_FACTS_'),
  serverSource.indexOf('function getPlanningDataReadinessFromDashboard')),
  /STATEMENT_BALANCE/,
  'statement balance must not become a required debt-readiness fact in V1');

const serverContext = {};
vm.createContext(serverContext);
vm.runInContext(serverSource, serverContext, { filename: 'data_readiness.js' });
const noDataState = serverContext.dataReadinessCustomerState_(0, 0,
  { overall: 'NOT_READY_FOR_AUTHORITY_SWITCH' }, []);
assert.equal(noDataState.code, 'NOT_CONNECTED');
assert.equal(noDataState.label, 'Data not connected');
const cashOnlyState = serverContext.dataReadinessCustomerState_(1, 0,
  { overall: 'NOT_READY_FOR_AUTHORITY_SWITCH' }, []);
assert.equal(cashOnlyState.code, 'MORE_DATA_NEEDED');
assert.match(cashOnlyState.planMessage, /Credit-card data still needs to be connected/);
const cardsOnlyState = serverContext.dataReadinessCustomerState_(0, 2,
  { overall: 'NOT_READY_FOR_AUTHORITY_SWITCH' }, []);
assert.equal(cardsOnlyState.code, 'MORE_DATA_NEEDED');
assert.match(cardsOnlyState.planMessage, /Cash data still needs to be connected/);
const reviewState = serverContext.dataReadinessCustomerState_(1, 2,
  { overall: 'NOT_READY_FOR_AUTHORITY_SWITCH' }, [{ title: 'APR needs review' }]);
assert.equal(reviewState.code, 'NEEDS_REVIEW');
const readyState = serverContext.dataReadinessCustomerState_(1, 2,
  { overall: 'READY_FOR_AUTHORITY_SWITCH_REVIEW' }, []);
assert.equal(readyState.code, 'READY_FOR_REVIEW');
const noDataWeekly = serverContext.dataReadinessWeeklyPresentation_({
  overall: 'NOT_READY_FOR_AUTHORITY_SWITCH', dimensions: {
    cash: { status: 'NOT_CONNECTED', readyCount: 0, accountCount: 0 },
    balanceReadiness: { status: 'NOT_CONNECTED', readyCount: 0, accountCount: 0 },
    interestRankingReadiness: { status: 'NOT_CONNECTED', readyCount: 0, accountCount: 0 },
    paymentObligationReadiness: { status: 'NOT_CONNECTED', readyCount: 0, accountCount: 0 },
    exactPayoffReadiness: { status: 'NOT_CONNECTED', readyCount: 0, accountCount: 0 }
  }
}, 0, 0, noDataState);
assert.equal(noDataWeekly.status, 'NOT_CONNECTED');
assert.equal(noDataWeekly.dimensions.every((row) => row.status === 'NOT_CONNECTED'), true);
assert.equal(noDataWeekly.dimensions.some((row) => row.statusLabel === 'Ready'), false,
  'zero-account dimensions must never render as Ready');

const context = {
  console,
  document: { getElementById() { return null; } },
  google: { script: { run: {} } },
  escapeCapitalAllocationHtml_(value) {
    return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  },
  formatCapitalAllocationMoney_(value) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD',
      minimumFractionDigits: 2 }).format(Number(value));
  }
};
vm.createContext(context);
vm.runInContext(clientSource, context, { filename: 'Dashboard_Script_PlanningDataReadiness.html' });

const model = {
  authority: { customerMessage: 'Shadow-only comparison.' },
  summary: { status: 'NEEDS_REVIEW', label: 'Needs review', blockingCount: 1,
    attentionCount: 1, overviewHeadline: '1 item needs review',
    overviewMessage: 'Review connected cash and credit-card data before it can support the weekly plan.',
    cashReadyCount: 1, cashAccountCount: 1, cardReadyCount: 0, cardAccountCount: 1,
    cashPresentation: { status: 'READY', label: 'Ready', note: '1 normalized account' },
    cardPresentation: { status: 'NEEDS_REVIEW', label: '0 / 1 ready', note: '1 normalized account' } },
  cash: [{ stableAccountId: 'CASH-FIXTURE', displayName: 'Samer Ally',
    institution: 'Ally', maskedIdentifier: '••••9012', planningValue: 30411,
    normalizedValue: 29850, difference: -561, differenceStatus: 'DIFFERENCE_DETECTED',
    fact: { status: 'CURRENT', statusLabel: 'Current', effectiveAsOf: '2026-08-17T16:00:00.000Z',
      safeToModel: true, safeToAct: true }, source: 'Imported QFX/OFX',
    identity: { label: 'Matched' }, refreshMethod: 'Imported evidence available',
    advanced: { stableAccountId: 'CASH-FIXTURE', factId: 'FACT-CASH',
      authorityClass: 'INSTITUTION_AUTHORITATIVE', verificationStatus: 'VERIFIED',
      reconciliationStatus: 'MATCHED' } }],
  debts: [{ stableAccountId: 'DEBT-CITIAA', displayName: 'CitiAA',
    institution: 'Citi', maskedIdentifier: '••••0393', ready: false,
    reviewStatus: 'APR needs review', identity: { label: 'Matched' },
    facts: [
      { factType: 'CURRENT_BALANCE', label: 'Balance', planningValue: 9500,
        normalizedValue: 9000, difference: -500, differenceStatus: 'DIFFERENCE_DETECTED',
        status: 'CURRENT', statusLabel: 'Current', effectiveAsOf: '2026-08-17T16:00:00.000Z' },
      { factType: 'APR', label: 'APR', planningValue: 22.99, normalizedValue: null,
        difference: null, differenceStatus: 'UNAVAILABLE', status: 'MISSING',
        statusLabel: 'Missing', effectiveAsOf: '', canVerifyManually: true },
      { factType: 'MINIMUM_PAYMENT', label: 'Minimum payment', planningValue: 270,
        normalizedValue: 270, difference: 0, differenceStatus: 'MATCHED', status: 'CURRENT',
        statusLabel: 'Current', effectiveAsOf: '2026-08-17T16:00:00.000Z' }
    ], advanced: { stableAccountId: 'DEBT-CITIAA',
      reasonCodes: ['MULTIPLE_APR_REVIEW_REQUIRED'], facts: [] } }],
  attention: [{ accountName: 'CitiAA', title: 'APR needs review',
    message: 'More than one possible rate applies.', blocksReadiness: true }],
  weeklyPlanReadiness: { status: 'NOT_READY', statusLabel: 'Needs updates',
    message: 'Update required.', dimensions: [{ label: 'Interest rates',
      statusLabel: 'Not ready', readyCount: 0, accountCount: 1 }] },
  unsupportedDomains: [
    { domain: 'Investments', status: 'Authoritative data not connected yet' },
    { domain: 'Properties', status: 'Authoritative data not connected yet' },
    { domain: 'Retirement', status: 'Authoritative data not connected yet' }
  ]
};

const overview = context.planningDataReadinessOverviewHtml_(model);
assert.match(overview, /Data status/);
assert.match(overview, /1 item needs review/);
assert.match(overview, /Review connected cash and credit-card data/);
assert.match(overview, /Review data/);
assert.doesNotMatch(overview, /Samer Ally|CitiAA/,
  'compact Overview card must contain no account rows');

const detail = context.planningDataReadinessDetailHtml_(model);
assert.match(detail, /Imported data is being reviewed/);
assert.match(detail, /weekly plan still uses the existing Planning values/i);
assert.match(detail, /Needs attention \(1\)/);
assert.match(detail, /Cash data \(1\)/);
assert.match(detail, /Credit-card data \(1\)/);
assert.match(detail, /Samer Ally/);
assert.match(detail, /\$29,850\.00/);
assert.match(detail, /differs -\$561\.00/);
assert.match(detail, /CitiAA/);
assert.match(detail, /Enter the APR that applies to the carried balance/);
assert.match(detail, /Planning currently uses/);
assert.match(detail, /Latest imported value/);
assert.match(detail, /Planning still uses existing values/);
assert.doesNotMatch(detail, /Checking normalized|No normalized|Latest normalized|Authority has not switched/i,
  'the primary Data view must use customer language instead of implementation terminology');
assert.match(detail, /Difference detected/);
assert.match(detail, /Advanced audit details/);
assert.match(detail, /Authoritative data not connected yet/);
assert.doesNotMatch(detail, /material|significant/i,
  'exact differences must not be labeled financially material');

const emptyModel = {
  authority: { headline: 'Imported data is not connected yet.',
    supporting: 'Your current weekly plan still uses the existing Planning values.',
    customerMessage: 'Shadow-only comparison.' },
  summary: { status: noDataState.code, label: noDataState.label,
    message: noDataState.message, overviewHeadline: noDataState.overviewHeadline,
    overviewMessage: noDataState.overviewMessage,
    attentionEmptyMessage: noDataState.attentionEmptyMessage, attentionCount: 0,
    cashPresentation: serverContext.dataReadinessDomainSummary_('cash', []),
    cardPresentation: serverContext.dataReadinessDomainSummary_('debt', []) },
  cash: [], debts: [], attention: [], weeklyPlanReadiness: noDataWeekly,
  unsupportedDomains: model.unsupportedDomains
};
const emptyOverview = context.planningDataReadinessOverviewHtml_(emptyModel);
const emptyDetail = context.planningDataReadinessDetailHtml_(emptyModel);
assert.match(emptyOverview, /Not connected yet/);
assert.match(emptyOverview, /Cash and credit-card data still need to be added or verified/);
assert.doesNotMatch(emptyOverview, /No blocking updates|Needs review/);
assert.match(emptyDetail, /Imported data is not connected yet/);
assert.match(emptyDetail, /Cash data has not been connected yet/);
assert.match(emptyDetail, /Credit-card data has not been connected yet/);
assert.match(emptyDetail, /No imported items currently require review/);
assert.match(emptyDetail, /Not available yet/);
assert.doesNotMatch(emptyDetail, /0\s*\/\s*0|Refresh method not yet available|accounts ready/,
  'no-data customer view must not expose vacuous readiness or implementation language');
assert.match(emptyDetail, /Authoritative data not connected yet/);

assert.match(shellSource, /\{ id: 'data', label: 'Data' \}/);
assert.match(shellSource, /selected === 'data'/);
assert.match(shellSource, /capital_allocation_view_data/);
assert.match(shellSource, /planningDataReadinessOverviewShellHtml_/);
assert.match(webSource, /Dashboard_Script_PlanningDataReadiness/);
assert.match(styles, /@media \(max-width: 760px\)/);
assert.match(styles, /@media \(max-width: 480px\)/);
assert.match(styles, /data-readiness-account-row > summary/);
assert.match(clientSource, /<details class="data-readiness-account-row">/);
assert.match(clientSource, /role="tablist"/);
assert.match(clientSource, /aria-selected/);
assert.match(help, /Planning → This week → Data/);
assert.match(help, /review layer/);
assert.match(suites, /SUITE-PART-2A-DATA-READINESS/);
assert.match(suites, /function testRunPart2aDataReadinessSuite\(options\)/);
assert.match(suites, /requested\.dispositionMode = 'trash'/);
assert.match(scenarios, /REGRESSION-PART-2A-DATA-READINESS/);
assert.match(scenarios, /Planning remains byte-equivalent/);

console.log('Data readiness regressions passed.');
