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
assert.match(serverSource, /planSourceHeadline/);
assert.match(serverSource, /evidenceReadinessHeadline/);
assert.match(serverSource, /DATA_READINESS_EVIDENCE_SOURCE_LEGEND_/);
assert.match(serverSource, /dataReadinessEvaluateValueEvidence_/);
assert.match(serverSource, /dataReadinessProviderReview_/);
assert.doesNotMatch(planningSource, /readFinancialFacts_|getPlanningDataReadinessFromDashboard/,
  'Part 1 Planning math must not read Financial Facts or the readiness RPC');
assert.doesNotMatch(read('debts.js'), /readFinancialFacts_|buildPlanningDataReadinessModel_/,
  'Debt planning must not consume Financial Facts readiness projection');
assert.doesNotMatch(read('bank_accounts.js'), /readFinancialFacts_|buildPlanningDataReadinessModel_/,
  'Bank account writers must not consume Financial Facts readiness projection');
assert.doesNotMatch(read('dashboard_data.js'), /buildPlanningDataReadinessModel_|getPlanningDataReadinessFromDashboard/,
  'Dashboard loaders must not gate on imported readiness projection');
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
assert.equal(noDataState.label, 'Not connected');
assert.equal(noDataState.overviewHeadline, 'Not connected');
assert.equal(noDataState.planStatusLabel, 'Not connected');
const cashOnlyState = serverContext.dataReadinessCustomerState_(1, 0,
  { overall: 'NOT_READY_FOR_AUTHORITY_SWITCH' }, []);
assert.equal(cashOnlyState.code, 'CURRENT',
  'an empty opposite domain is Not connected, not More data needed');
assert.equal(cashOnlyState.label, 'Current');
const cardsOnlyState = serverContext.dataReadinessCustomerState_(0, 2,
  { overall: 'NOT_READY_FOR_AUTHORITY_SWITCH' }, []);
assert.equal(cardsOnlyState.code, 'CURRENT',
  'an empty opposite domain is Not connected, not More data needed');
assert.equal(cardsOnlyState.label, 'Current');
const missingState = serverContext.dataReadinessCustomerState_(1, 0,
  { overall: 'NOT_READY_FOR_AUTHORITY_SWITCH' },
  [{ title: 'Cash balance is missing', kind: 'MISSING' }]);
assert.equal(missingState.code, 'MORE_DATA_NEEDED');
assert.equal(missingState.label, 'Needs attention');
const reviewState = serverContext.dataReadinessCustomerState_(1, 2,
  { overall: 'NOT_READY_FOR_AUTHORITY_SWITCH' }, [{ title: 'APR needs review', kind: 'REVIEW' }]);
assert.equal(reviewState.code, 'NEEDS_REVIEW');
assert.equal(reviewState.label, 'Needs review');
const readyState = serverContext.dataReadinessCustomerState_(1, 2,
  { overall: 'READY_FOR_AUTHORITY_SWITCH_REVIEW' }, []);
assert.equal(readyState.code, 'CURRENT');
assert.equal(readyState.label, 'Current');
const importNotReadyButCurrent = serverContext.dataReadinessCustomerState_(1, 2,
  { overall: 'NOT_READY_FOR_AUTHORITY_SWITCH' }, []);
assert.equal(importNotReadyButCurrent.code, 'CURRENT',
  'provider-import status must not block source-neutral readiness');
const emptyCash = serverContext.dataReadinessDomainSummary_('cash', []);
const emptyCards = serverContext.dataReadinessDomainSummary_('debt', []);
assert.equal(emptyCash.status, 'NOT_CONNECTED');
assert.equal(emptyCash.label, 'Not connected');
assert.equal(emptyCash.countLabel, 'Not connected');
assert.equal(emptyCash.readyCount, 0);
assert.equal(emptyCash.accountCount, 0);
assert.equal(emptyCards.status, 'NOT_CONNECTED');
assert.equal(emptyCards.label, 'Not connected');
assert.equal(emptyCards.countLabel, 'Not connected');
assert.doesNotMatch(emptyCash.label, /Current|Needs attention|More data needed|Ready for review/);
assert.doesNotMatch(emptyCards.countLabel, /0 of 0 current/);
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
assert.equal(noDataWeekly.statusLabel, 'Not connected');
assert.equal(noDataWeekly.dimensions.every((row) => row.status === 'NOT_CONNECTED'), true);
assert.equal(noDataWeekly.dimensions.every((row) => row.statusLabel === 'Not connected'), true);
assert.equal(noDataWeekly.dimensions.every((row) => row.readyCount === 0 && row.accountCount === 0), true,
  'Not connected is excluded from current/readiness pass counts');
assert.equal(noDataWeekly.dimensions.some((row) => [
  'Ready', 'Ready for review', 'Current', 'More data needed', 'Needs attention', 'Needs review'
].includes(row.statusLabel)), false,
  'empty readiness dimensions must stay Not connected');
const emptyAuthority = serverContext.dataReadinessAuthorityPresentation_(
  'NOT_CONNECTED', emptyCash, emptyCards);
assert.equal(emptyAuthority.headline, 'Data readiness: Not connected');
assert.equal(emptyAuthority.cashSummaryLine, 'Cash data: Not connected');
assert.equal(emptyAuthority.cardSummaryLine, 'Credit-card data: Not connected');
assert.match(emptyAuthority.planSourceHeadline, /INPUT\/SYS/);
assert.equal(serverContext.dataReadinessPageHeadline_('CURRENT', 0),
  'Your required cash and credit-card data is current. No action is required.');
assert.equal(serverContext.dataReadinessOptionalProviderSummary_(0), '');
assert.match(serverContext.dataReadinessOptionalProviderSummary_(38),
  /38 older or unmatched imported records are available for reference/);
assert.equal(serverContext.dataReadinessUnsupportedDomains_()[0].status,
  'Not included in this readiness review yet');

const verifiedIdentity = { status: 'VERIFIED', label: 'Matched' };
const currentSelection = {
  fact: {
    numericValue: 100, sourceType: 'PLAID', sourceSystem: 'PLAID',
    authorityClass: 'INSTITUTION_AUTHORITATIVE', effectiveAsOf: '2026-08-17T16:00:00.000Z'
  },
  freshness: { status: 'CURRENT', safeToAct: true, safeToModel: true }
};
const manualEvidence = serverContext.dataReadinessEvaluateValueEvidence_(
  2500, { fact: null, freshness: { status: 'MISSING', safeToAct: false } },
  verifiedIdentity, 'CURRENT_BALANCE', '2026-08-17T16:00:00.000Z');
assert.equal(manualEvidence.valid, true, 'manually entered value counts as valid evidence');
assert.equal(manualEvidence.sourceCode, 'MANUAL');
assert.equal(manualEvidence.status, 'CURRENT');
const zeroEvidence = serverContext.dataReadinessEvaluateValueEvidence_(
  0, { fact: null, freshness: { status: 'MISSING', safeToAct: false } },
  verifiedIdentity, 'CURRENT_BALANCE', '2026-08-17T16:00:00.000Z');
assert.equal(zeroEvidence.valid, true, 'explicit zero counts as valid evidence');
const plaidEvidence = serverContext.dataReadinessEvaluateValueEvidence_(
  null, currentSelection, verifiedIdentity, 'CURRENT_BALANCE', '2026-08-17T16:00:00.000Z');
assert.equal(plaidEvidence.valid, true, 'Plaid value counts as valid evidence');
assert.equal(plaidEvidence.sourceCode, 'PLAID');
const csvEvidence = serverContext.dataReadinessEvaluateValueEvidence_(
  null, {
    fact: { numericValue: 80, sourceType: 'CSV', sourceSystem: 'CSV_UPLOAD',
      effectiveAsOf: '2026-08-17T16:00:00.000Z' },
    freshness: { status: 'CURRENT', safeToAct: true }
  }, verifiedIdentity, 'CURRENT_BALANCE', '2026-08-17T16:00:00.000Z');
assert.equal(csvEvidence.valid, true, 'CSV value counts as valid evidence');
assert.equal(csvEvidence.sourceCode, 'CSV');
const pdfEvidence = serverContext.dataReadinessEvaluateValueEvidence_(
  null, {
    fact: { numericValue: 90, sourceType: 'PDF', sourceSystem: 'STATEMENT_PDF',
      effectiveAsOf: '2026-08-17T16:00:00.000Z' },
    freshness: { status: 'CURRENT', safeToAct: true }
  }, verifiedIdentity, 'CURRENT_BALANCE', '2026-08-17T16:00:00.000Z');
assert.equal(pdfEvidence.valid, true, 'PDF value counts as valid evidence');
assert.equal(pdfEvidence.sourceCode, 'PDF');
const missingEvidence = serverContext.dataReadinessEvaluateValueEvidence_(
  null, { fact: null, freshness: { status: 'MISSING', safeToAct: false } },
  verifiedIdentity, 'CURRENT_BALANCE', '2026-08-17T16:00:00.000Z');
assert.equal(missingEvidence.valid, false, 'missing value requires attention');
assert.equal(missingEvidence.status, 'MISSING');
assert.equal(missingEvidence.tone, 'review');
const invalidEvidence = serverContext.dataReadinessEvaluateValueEvidence_(
  'N/A', { fact: null, freshness: { status: 'MISSING', safeToAct: false } },
  verifiedIdentity, 'CURRENT_BALANCE', '2026-08-17T16:00:00.000Z');
assert.equal(invalidEvidence.valid, false, 'invalid value requires review');
assert.equal(invalidEvidence.status, 'INVALID');
assert.equal(invalidEvidence.tone, 'error');
const identityEvidence = serverContext.dataReadinessEvaluateValueEvidence_(
  100, currentSelection, { status: 'REVIEW_REQUIRED', label: 'Needs review' },
  'CURRENT_BALANCE', '2026-08-17T16:00:00.000Z');
assert.equal(identityEvidence.status, 'IDENTITY_AMBIGUOUS');
assert.equal(identityEvidence.tone, 'error');
const unimportedReady = serverContext.dataReadinessEvaluateValueEvidence_(
  12.5, { fact: null, freshness: { status: 'MISSING', safeToAct: false } },
  verifiedIdentity, 'CURRENT_BALANCE', '2026-08-17T16:00:00.000Z');
assert.equal(unimportedReady.valid, true, 'unimported accounts with a valid value are not failures');
const staleEvidence = serverContext.dataReadinessEvaluateValueEvidence_(
  null, {
    fact: { numericValue: 100, sourceType: 'PLAID', sourceSystem: 'PLAID',
      effectiveAsOf: '2025-01-01T00:00:00.000Z' },
    freshness: { status: 'STALE', safeToAct: false }
  }, verifiedIdentity, 'CURRENT_BALANCE', '2026-08-17T16:00:00.000Z');
assert.equal(staleEvidence.status, 'STALE');
assert.equal(serverContext.dataReadinessCustomerStatusFromEvidence_(
  manualEvidence, verifiedIdentity, 'MATCHED'), 'CURRENT');
assert.equal(serverContext.dataReadinessPresentationLabel_('READY_FOR_REVIEW'), 'Ready for review');
assert.equal(serverContext.dataReadinessCustomerStatusFromEvidence_(
  zeroEvidence, verifiedIdentity, 'UNAVAILABLE'), 'CURRENT');
assert.equal(serverContext.dataReadinessCustomerStatusFromEvidence_(
  plaidEvidence, verifiedIdentity, 'MATCHED'), 'CURRENT');
assert.equal(serverContext.dataReadinessCustomerStatusFromEvidence_(
  missingEvidence, verifiedIdentity, 'UNAVAILABLE'), 'MORE_DATA_NEEDED');
assert.equal(serverContext.dataReadinessPresentationLabel_('MORE_DATA_NEEDED'), 'Needs attention');
assert.equal(serverContext.dataReadinessCustomerStatusFromEvidence_(
  invalidEvidence, verifiedIdentity, 'UNAVAILABLE'), 'NEEDS_REVIEW');
assert.equal(serverContext.dataReadinessCustomerStatusFromEvidence_(
  staleEvidence, verifiedIdentity, 'UNAVAILABLE'), 'NEEDS_REVIEW');
assert.equal(serverContext.dataReadinessCustomerStatusFromEvidence_(
  identityEvidence, { status: 'REVIEW_REQUIRED' }, 'MATCHED'), 'CURRENT',
  'a valid Planning value is not Needs review because identity is unmatched');
const identityNoPlanning = serverContext.dataReadinessEvaluateValueEvidence_(
  null, currentSelection, { status: 'REVIEW_REQUIRED', label: 'Needs review' },
  'CURRENT_BALANCE', '2026-08-17T16:00:00.000Z');
assert.equal(identityNoPlanning.planningValid, false);
assert.equal(serverContext.dataReadinessCustomerStatusFromEvidence_(
  identityNoPlanning, { status: 'REVIEW_REQUIRED' }, 'MATCHED'), 'NEEDS_REVIEW');
assert.equal(serverContext.dataReadinessCustomerStatusFromEvidence_(
  { status: 'CURRENT' }, verifiedIdentity, 'DIFFERENCE_DETECTED'), 'CURRENT');
assert.equal(serverContext.dataReadinessPresentationLabel_('NEEDS_REVIEW'), 'Needs review');
const missingDomain = serverContext.dataReadinessDomainSummary_('cash', [{
  domain: 'CASH', ready: false, evidenceStatus: 'MISSING',
  identity: verifiedIdentity, differenceStatus: 'UNAVAILABLE'
}]);
assert.equal(missingDomain.status, 'MORE_DATA_NEEDED');
assert.equal(missingDomain.label, 'Needs attention');
const readyManualDomain = serverContext.dataReadinessDomainSummary_('cash', [{
  domain: 'CASH', ready: true, evidenceStatus: 'CURRENT',
  identity: verifiedIdentity, differenceStatus: 'UNAVAILABLE'
}]);
assert.equal(readyManualDomain.status, 'CURRENT');
assert.equal(readyManualDomain.label, 'Current');
const conflictDomain = serverContext.dataReadinessDomainSummary_('cash', [{
  domain: 'CASH', ready: true, evidenceStatus: 'CURRENT',
  identity: verifiedIdentity, differenceStatus: 'DIFFERENCE_DETECTED'
}]);
assert.equal(conflictDomain.status, 'CURRENT');
assert.equal(conflictDomain.label, 'Current');
const manualGuidance = serverContext.dataReadinessGuidanceFromEvidence_(
  manualEvidence, verifiedIdentity, 'UNAVAILABLE', 'Balance');
assert.equal(manualGuidance.status, 'CURRENT');
assert.equal(manualGuidance.nextAction, 'Current — no action required.');
assert.equal(manualGuidance.hasAction, false);
assert.equal(manualGuidance.reason, 'A valid monthly CashCompass value is present.');
const importedGuidance = serverContext.dataReadinessGuidanceFromEvidence_(
  plaidEvidence, verifiedIdentity, 'MATCHED', 'Balance');
assert.equal(importedGuidance.status, 'CURRENT');
assert.equal(importedGuidance.nextAction, 'Current — no action required.');
assert.equal(importedGuidance.hasAction, false);
assert.equal(importedGuidance.reason, 'A valid monthly imported value is present.');
const unmatchedGuidance = serverContext.dataReadinessGuidanceFromEvidence_(
  { status: 'CURRENT', planningValid: true, importedValid: true },
  verifiedIdentity, 'UNAVAILABLE', 'Balance', { importedUnmatched: true });
assert.equal(unmatchedGuidance.status, 'CURRENT');
assert.equal(unmatchedGuidance.actionable, false);
assert.equal(unmatchedGuidance.optionalItems[0].reason,
  'Not matched — current CashCompass value is being used. No action required.');
assert.equal(unmatchedGuidance.optionalItems[0].optional, true);
assert.equal(unmatchedGuidance.optionalItems[0].hasAction, false);
assert.equal(unmatchedGuidance.optionalItems[0].nextAction, '');
assert.equal(unmatchedGuidance.optionalItems[0].reviewRoute, '');
assert.equal(unmatchedGuidance.optionalItems[0].navigateTab, '');
const missingGuidance = serverContext.dataReadinessGuidanceFromEvidence_(
  missingEvidence, verifiedIdentity, 'UNAVAILABLE', 'Balance');
assert.equal(missingGuidance.status, 'MORE_DATA_NEEDED');
assert.equal(missingGuidance.reason, 'No monthly value has been entered.');
assert.equal(missingGuidance.nextAction, 'Open Bank Accounts');
assert.equal(missingGuidance.navigateTab, 'bank');
assert.equal(missingGuidance.reviewRoute, 'editor');
assert.equal(missingGuidance.hasAction, true);
const missingDebtGuidance = serverContext.dataReadinessGuidanceFromEvidence_(
  missingEvidence, verifiedIdentity, 'UNAVAILABLE', 'APR', {
    domain: 'DEBT', accountKey: 'DEBT-1', asOf: '2026-09-17'
  });
assert.equal(missingDebtGuidance.nextAction, 'Open Debts');
assert.equal(missingDebtGuidance.navigateTab, 'debts');
assert.equal(missingDebtGuidance.accountKey, 'DEBT-1');
assert.equal(missingDebtGuidance.cycleKey, '2026-09');
assert.equal(missingDebtGuidance.reason, 'No September 2026 APR has been entered.');
assert.equal(serverContext.dataReadinessOpenAction_('HOUSES'), 'Open Houses');
assert.equal(serverContext.dataReadinessOpenAction_('INVESTMENTS'), 'Open Investments');
assert.equal(serverContext.dataReadinessNavigateForDomain_('HOUSES').navigateTab, 'houses');
assert.equal(serverContext.dataReadinessNavigateForDomain_('INVESTMENTS').navigateTab, 'investments');
const staleGuidance = serverContext.dataReadinessGuidanceFromEvidence_(
  staleEvidence, verifiedIdentity, 'UNAVAILABLE', 'Balance');
assert.equal(staleGuidance.status, 'NEEDS_REVIEW');
assert.equal(staleGuidance.reason, 'The imported evidence is stale.');
assert.equal(staleGuidance.nextAction, 'Open Bank Accounts');
const staleSelection = {
  fact: { numericValue: 100, sourceType: 'PLAID', sourceSystem: 'PLAID',
    authorityClass: 'INSTITUTION_AUTHORITATIVE', effectiveAsOf: '2025-01-01T00:00:00.000Z' },
  freshness: { status: 'STALE', safeToAct: false }
};
const manualPlusStale = serverContext.dataReadinessEvaluateValueEvidence_(
  2500, staleSelection, verifiedIdentity, 'CURRENT_BALANCE', '2026-08-17T16:00:00.000Z');
assert.equal(manualPlusStale.planningValid, true);
assert.equal(manualPlusStale.status, 'CURRENT');
assert.equal(manualPlusStale.importedStale, true);
const manualPlusStaleGuidance = serverContext.dataReadinessGuidanceFromEvidence_(
  manualPlusStale, verifiedIdentity, 'UNAVAILABLE', 'Balance');
assert.equal(manualPlusStaleGuidance.status, 'CURRENT');
assert.equal(manualPlusStaleGuidance.actionable, false);
assert.equal(manualPlusStaleGuidance.nextAction, 'Current — no action required.');
assert.equal(manualPlusStaleGuidance.hasAction, false);
assert.equal(manualPlusStaleGuidance.optionalItems[0].reason, 'The imported evidence is stale.');
assert.equal(manualPlusStaleGuidance.optionalItems[0].optional, true);
assert.equal(manualPlusStaleGuidance.optionalItems[0].hasAction, false);
assert.equal(manualPlusStaleGuidance.optionalItems[0].nextAction, '');
assert.equal(manualPlusStaleGuidance.optionalItems[0].reviewRoute, '');
assert.equal(manualPlusStaleGuidance.optionalItems[0].navigateTab, '');
assert.match(manualPlusStaleGuidance.optionalItems[0].planningImpact,
  /Planning is using the existing CashCompass value/);
const importedPlusStale = serverContext.dataReadinessEvaluateValueEvidence_(
  100, staleSelection, verifiedIdentity, 'CURRENT_BALANCE', '2026-08-17T16:00:00.000Z');
assert.equal(importedPlusStale.planningValid, true);
assert.equal(importedPlusStale.sourceCode, 'PLAID');
assert.equal(importedPlusStale.importedStale, true);
const importedPlusStaleGuidance = serverContext.dataReadinessGuidanceFromEvidence_(
  importedPlusStale, verifiedIdentity, 'UNAVAILABLE', 'Balance');
assert.equal(importedPlusStaleGuidance.status, 'CURRENT');
assert.equal(importedPlusStaleGuidance.actionable, false);
assert.equal(importedPlusStaleGuidance.optionalItems[0].optional, true);
const currentImportedPlusStaleGuidance = serverContext.dataReadinessGuidanceFromEvidence_(
  { status: 'CURRENT', planningValid: false, importedValid: true, importedStale: true },
  verifiedIdentity, 'UNAVAILABLE', 'Balance');
assert.equal(currentImportedPlusStaleGuidance.status, 'CURRENT');
assert.equal(currentImportedPlusStaleGuidance.actionable, false);
assert.equal(currentImportedPlusStaleGuidance.optionalItems[0].reason,
  'The imported evidence is stale.');
const conflictGuidance = serverContext.dataReadinessGuidanceFromEvidence_(
  { status: 'CURRENT', planningValid: true, importedValid: true },
  verifiedIdentity, 'DIFFERENCE_DETECTED', 'Balance');
assert.equal(conflictGuidance.status, 'CURRENT');
assert.equal(conflictGuidance.nextAction, 'Current — no action required.');
assert.equal(conflictGuidance.optionalItems[0].reason,
  'The imported value differs from the current CashCompass value.');
assert.equal(conflictGuidance.optionalItems[0].hasAction, false);
assert.equal(conflictGuidance.optionalItems[0].nextAction, '');
assert.equal(conflictGuidance.optionalItems[0].reviewRoute, '');
const invalidGuidance = serverContext.dataReadinessGuidanceFromEvidence_(
  invalidEvidence, verifiedIdentity, 'UNAVAILABLE', 'Balance');
assert.equal(invalidGuidance.blocking, true);
assert.equal(invalidGuidance.status, 'NEEDS_REVIEW');
assert.notEqual(invalidGuidance.status, 'CURRENT',
  'invalid required evidence is not silently treated as Current');
assert.equal(invalidGuidance.hasAction, true);
assert.equal(invalidGuidance.reviewRoute, 'editor');
assert.equal(invalidGuidance.reason, 'The evidence could not be validated.');
assert.match(invalidGuidance.planningImpact, /cannot use this value/);
const identityGuidance = serverContext.dataReadinessGuidanceFromEvidence_(
  identityEvidence, { status: 'REVIEW_REQUIRED' }, 'MATCHED', 'Balance');
assert.equal(identityGuidance.status, 'CURRENT');
assert.equal(identityGuidance.actionable, false);
assert.equal(identityGuidance.nextAction, 'Current — no action required.');
assert.equal(identityGuidance.optionalItems[0].optional, true);
assert.equal(identityGuidance.optionalItems[0].hasAction, false);
assert.equal(identityGuidance.optionalItems[0].reviewRoute, '');
assert.equal(identityGuidance.optionalItems[0].nextAction, '');
assert.equal(identityGuidance.optionalItems[0].reason,
  'Not matched — current CashCompass value is being used. No action required.');
const optionalIdentityTarget = serverContext.dataReadinessNavigationTarget_(
  identityGuidance.optionalItems[0]);
assert.equal(optionalIdentityTarget.reviewRoute, '');
assert.equal(optionalIdentityTarget.navigateTab, '');
const unmatchedOptionalTarget = serverContext.dataReadinessNavigationTarget_(
  unmatchedGuidance.optionalItems[0]);
assert.equal(unmatchedOptionalTarget.reviewRoute, '');
assert.equal(unmatchedOptionalTarget.navigateTab, '');
const identityNoPlanningGuidance = serverContext.dataReadinessGuidanceFromEvidence_(
  identityNoPlanning, { status: 'REVIEW_REQUIRED' }, 'MATCHED', 'Balance');
assert.equal(identityNoPlanningGuidance.blocking, true);
assert.equal(identityNoPlanningGuidance.nextAction, 'Review the account match.');
assert.equal(identityNoPlanningGuidance.reviewRoute, 'identity');
assert.equal(identityNoPlanningGuidance.actionKind, 'IDENTITY');
assert.equal(serverContext.dataReadinessNavigationTarget_(identityNoPlanningGuidance).reviewRoute,
  'identity');
const groupedAttention = serverContext.dataReadinessAttention_([{
  displayName: 'Fixture Cash', domain: 'CASH', identity: verifiedIdentity,
  guidance: missingGuidance, optionalItems: []
}, {
  displayName: 'Fixture Ally Savings', domain: 'CASH', identity: verifiedIdentity,
  guidance: conflictGuidance, optionalItems: conflictGuidance.optionalItems
}], []);
assert.equal(groupedAttention.length, 1, 'optional imported review is not an actionable card');
assert.equal(groupedAttention[0].accountName, 'Fixture Cash');
assert.equal(groupedAttention.filter((card) => card.accountName === 'Fixture Cash').length, 1,
  'no duplicated unexplained account cards');
const groupedOptional = serverContext.dataReadinessProviderReview_([{
  displayName: 'Fixture Ally Savings', domain: 'CASH', identity: verifiedIdentity,
  guidance: conflictGuidance, optionalItems: conflictGuidance.optionalItems
}], []);
assert.equal(groupedOptional.length, 1);
assert.match(groupedOptional[0].reason, /Older imported record|Not matched/);
assert.match(groupedOptional[0].planningImpact, /Planning is using the existing CashCompass value/);
assert.equal(groupedOptional[0].hasAction, false);
assert.equal(groupedOptional[0].nextAction, '');
assert.equal(groupedOptional[0].reviewRoute, '');
assert.equal(groupedOptional[0].navigateTab, '');
const optionalTarget = serverContext.dataReadinessNavigationTarget_(groupedOptional[0]);
assert.equal(optionalTarget.reviewRoute, '');
assert.equal(optionalTarget.navigateTab, '');
const optionalDoesNotDriveState = serverContext.dataReadinessCustomerState_(1, 1,
  { overall: 'NOT_READY_FOR_AUTHORITY_SWITCH' }, groupedOptional);
assert.equal(optionalDoesNotDriveState.code, 'CURRENT',
  'Planning remains unaffected by optional imported evidence');

const zeroGuidance = serverContext.dataReadinessGuidanceFromEvidence_(
  zeroEvidence, verifiedIdentity, 'UNAVAILABLE', 'Balance');
const cleanManualRow = {
  displayName: 'Manual Checking', domain: 'CASH', identity: verifiedIdentity,
  customerStatus: 'CURRENT', guidance: manualGuidance, optionalItems: []
};
const cleanImportedRow = {
  displayName: 'Imported Checking', domain: 'CASH', identity: verifiedIdentity,
  customerStatus: 'CURRENT', guidance: importedGuidance, optionalItems: []
};
const cleanZeroRow = {
  displayName: 'Zero Balance', domain: 'CASH', identity: verifiedIdentity,
  customerStatus: 'CURRENT', guidance: zeroGuidance, optionalItems: []
};
const unmatchedOptionalRow = {
  displayName: 'Unmatched Import', domain: 'CASH', identity: verifiedIdentity,
  customerStatus: 'CURRENT', guidance: unmatchedGuidance,
  optionalItems: unmatchedGuidance.optionalItems
};
assert.notEqual(manualGuidance.status, 'NEEDS_REVIEW',
  'valid current manual evidence does not produce Needs review');
assert.notEqual(manualGuidance.statusLabel, 'Needs review');
assert.equal(manualGuidance.actionable, false);
assert.notEqual(importedGuidance.status, 'NEEDS_REVIEW',
  'valid current imported evidence does not produce Needs review');
assert.notEqual(importedGuidance.statusLabel, 'Needs review');
assert.equal(importedGuidance.actionable, false);
assert.equal(zeroGuidance.status, 'CURRENT');
assert.notEqual(zeroGuidance.status, 'NEEDS_REVIEW',
  'explicit zero does not produce Needs review');
assert.notEqual(zeroGuidance.statusLabel, 'Needs review');
assert.equal(zeroGuidance.nextAction, 'Current — no action required.');
assert.equal(zeroGuidance.hasAction, false);
assert.equal(manualGuidance.hasAction, false);
const currentAllyRow = {
  displayName: 'Samer Ally', domain: 'CASH', identity: verifiedIdentity, ready: true,
  customerStatus: 'CURRENT', guidance: manualGuidance, optionalItems: []
};
assert.equal(serverContext.dataReadinessAttention_([currentAllyRow], []).length, 0,
  'current manual Ally value has no action');
assert.equal(currentAllyRow.guidance.hasAction, false);
assert.notEqual(unmatchedGuidance.status, 'NEEDS_REVIEW',
  'optional unmatched imported evidence does not produce Needs review');
assert.notEqual(unmatchedGuidance.statusLabel, 'Needs review');
assert.equal(unmatchedGuidance.actionable, false);
assert.equal(serverContext.dataReadinessAttention_([unmatchedOptionalRow], []).length, 0,
  'optional unmatched imported evidence does not count as an action');
assert.equal(serverContext.dataReadinessCustomerState_(1, 0,
  { overall: 'NOT_READY_FOR_AUTHORITY_SWITCH' },
  serverContext.dataReadinessAttention_([unmatchedOptionalRow], [])).code,
  'CURRENT');
assert.equal(serverContext.dataReadinessAttention_(
  [cleanManualRow, cleanImportedRow, cleanZeroRow], []).length, 0,
  'accounts with no missing, stale, conflicting, malformed, or identity issues are not actionable');
assert.equal(serverContext.dataReadinessRowsCustomerStatus_(
  [cleanManualRow, cleanImportedRow, cleanZeroRow]), 'CURRENT');
assert.equal(cleanManualRow.guidance.nextAction, 'Current — no action required.');
assert.equal(cleanImportedRow.guidance.nextAction, 'Current — no action required.');
assert.equal(cleanZeroRow.guidance.nextAction, 'Current — no action required.');
const reviewThenCleared = serverContext.dataReadinessCustomerState_(1, 1,
  { overall: 'NOT_READY_FOR_AUTHORITY_SWITCH' },
  [{ title: 'Balance is invalid', kind: 'REVIEW', blocking: true }]);
assert.equal(reviewThenCleared.code, 'NEEDS_REVIEW');
const noGenuineReviewItems = serverContext.dataReadinessCustomerState_(1, 1,
  { overall: 'NOT_READY_FOR_AUTHORITY_SWITCH' }, []);
assert.equal(noGenuineReviewItems.code, 'CURRENT',
  'aggregate status becomes Current when no genuine review items remain');
assert.notEqual(noGenuineReviewItems.code, 'NEEDS_REVIEW');
assert.notEqual(noGenuineReviewItems.label, 'Needs review');
const onlyOptionalRemains = serverContext.dataReadinessCustomerState_(1, 1,
  { overall: 'NOT_READY_FOR_AUTHORITY_SWITCH' }, groupedOptional);
assert.equal(onlyOptionalRemains.code, 'CURRENT');
assert.notEqual(onlyOptionalRemains.label, 'Needs review');
const staleOptionalRow = {
  displayName: 'Samer Ally', domain: 'CASH', identity: verifiedIdentity, ready: true,
  customerStatus: 'CURRENT', guidance: manualPlusStaleGuidance,
  optionalItems: manualPlusStaleGuidance.optionalItems
};
const importedStaleOptionalRow = {
  displayName: 'Imported Checking Stale', domain: 'CASH', identity: verifiedIdentity,
  ready: true, customerStatus: 'CURRENT', guidance: importedPlusStaleGuidance,
  optionalItems: importedPlusStaleGuidance.optionalItems
};
assert.equal(serverContext.dataReadinessAttention_([staleOptionalRow, importedStaleOptionalRow], []).length, 0,
  'current Planning values plus stale imported evidence are not actionable');
assert.equal(serverContext.dataReadinessProviderReview_([staleOptionalRow, importedStaleOptionalRow], []).length, 2);
assert.equal(serverContext.dataReadinessRowsCustomerStatus_([staleOptionalRow, importedStaleOptionalRow]),
  'CURRENT');
assert.equal(serverContext.dataReadinessDomainSummary_('cash', [staleOptionalRow]).status,
  'CURRENT');
assert.equal(serverContext.dataReadinessDomainSummary_('debt', [importedStaleOptionalRow]).status,
  'CURRENT');
assert.equal(serverContext.dataReadinessCustomerState_(1, 1,
  { overall: 'NOT_READY_FOR_AUTHORITY_SWITCH' },
  serverContext.dataReadinessAttention_([staleOptionalRow], [])).code, 'CURRENT');
assert.equal(serverContext.dataReadinessCustomerStatusFromEvidence_(
  missingEvidence, verifiedIdentity, 'UNAVAILABLE'), 'MORE_DATA_NEEDED');
assert.equal(emptyCash.status, 'NOT_CONNECTED');
assert.equal(invalidGuidance.status, 'NEEDS_REVIEW');
assert.equal(identityNoPlanningGuidance.status, 'NEEDS_REVIEW');
assert.match(serverSource, /planningUsesNormalizedData:\s*false/);
assert.match(serverSource, /function dataReadinessAccountActive_[\s\S]*financialIdentityInactive_/,
  'active\/inactive account rules remain identity-lifecycle based');

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
  authority: {
    planSourceHeadline: 'Current plan source: CashCompass sheets',
    planSourceSupporting: 'Weekly Planning uses INPUT and SYS sheets.',
    evidenceReadinessHeadline: 'Data readiness: More data needed',
    importReadinessHeadline: 'Data readiness: More data needed',
    headline: 'Data readiness: More data needed',
    cashSummaryLine: 'Cash data: Current',
    cardSummaryLine: 'Credit-card data: Current',
    evidenceSourceLegend: 'Evidence source: Manual / Plaid / CSV / PDF',
    supporting: 'Weekly Planning, Net Worth, Cash Flow, and debt calculations use your INPUT and SYS sheets.',
    customerMessage: 'Every valid monthly value counts as evidence.'
  },
  summary: { status: 'MORE_DATA_NEEDED', label: 'More data needed', blockingCount: 0,
    attentionCount: 1, actionItemCount: 1, optionalReviewCount: 1,
    overviewHeadline: 'More data needed',
    overviewMessage: 'A connected account is missing required monthly fields.',
    planningStatus: 'Planning uses the existing CashCompass values from INPUT/SYS sheets.',
    cashReadyCount: 1, cashAccountCount: 1, cardReadyCount: 1, cardAccountCount: 1,
    evidenceSourceLegend: 'Evidence source: Manual / Plaid / CSV / PDF',
    cashPresentation: { status: 'CURRENT', label: 'Current',
      countLabel: '1 of 1 current', note: 'Evidence source: Manual / Plaid / CSV / PDF' },
    cardPresentation: { status: 'CURRENT', label: 'Current',
      countLabel: '1 of 1 current', note: 'Evidence source: Manual / Plaid / CSV / PDF' } },
  cash: [{ stableAccountId: 'CASH-FIXTURE', displayName: 'Samer Ally',
    institution: 'Ally', maskedIdentifier: '••••9012', planningValue: 30411,
    normalizedValue: 29850, difference: -561, differenceStatus: 'DIFFERENCE_DETECTED',
    fact: { status: 'CURRENT', statusLabel: 'Current', effectiveAsOf: '2026-08-17T16:00:00.000Z',
      safeToModel: true, safeToAct: true }, source: 'Plaid', sourceLabel: 'Plaid',
    identity: { label: 'Matched' }, refreshMethod: 'Imported provider available',
    ready: true, needsAttention: false, customerStatus: 'CURRENT',
    reviewStatus: 'Current',
    guidance: { status: 'CURRENT', statusLabel: 'Current',
      reason: 'A valid monthly CashCompass value is present.',
      planningImpact: 'Planning is using the existing CashCompass value.',
      nextAction: 'Current — no action required.', hasAction: false },
    optionalItems: [{ status: 'READY_FOR_REVIEW', statusLabel: 'Ready for review', optional: true,
      reason: 'The imported value differs from the current CashCompass value.',
      planningImpact: 'Planning is using the existing CashCompass value.',
      nextAction: '', reviewRoute: '', hasAction: false }],
    advanced: { stableAccountId: 'CASH-FIXTURE', factId: 'FACT-CASH',
      authorityClass: 'INSTITUTION_AUTHORITATIVE', verificationStatus: 'VERIFIED',
      reconciliationStatus: 'MATCHED' } }],
  debts: [{ stableAccountId: 'DEBT-CITIAA', displayName: 'CitiAA',
    institution: 'Citi', maskedIdentifier: '••••0393', ready: true,
    customerStatus: 'CURRENT', reviewStatus: 'Current',
    guidance: { status: 'CURRENT', statusLabel: 'Current',
      reason: 'A valid monthly CashCompass value is present.',
      planningImpact: 'Planning is using the existing CashCompass value.',
      nextAction: 'Current — no action required.', hasAction: false },
    optionalItems: [{ title: 'APR needs review', optional: true,
      reason: 'Optional imported evidence to review — Planning is using the existing CashCompass value.',
      planningImpact: 'Planning is using the existing CashCompass value.',
      nextAction: '', reviewRoute: '', hasAction: false }],
    identity: { label: 'Matched' },
    facts: [
      { factType: 'CURRENT_BALANCE', label: 'Balance', planningValue: 9500,
        normalizedValue: 9000, difference: -500, differenceStatus: 'DIFFERENCE_DETECTED',
        status: 'CURRENT', statusLabel: 'Current', effectiveAsOf: '2026-08-17T16:00:00.000Z' },
      { factType: 'APR', label: 'APR', planningValue: 22.99, normalizedValue: null,
        difference: null, differenceStatus: 'UNAVAILABLE', status: 'CURRENT',
        statusLabel: 'Current', effectiveAsOf: '', canVerifyManually: true },
      { factType: 'MINIMUM_PAYMENT', label: 'Minimum payment', planningValue: 270,
        normalizedValue: 270, difference: 0, differenceStatus: 'MATCHED', status: 'CURRENT',
        statusLabel: 'Current', effectiveAsOf: '2026-08-17T16:00:00.000Z' }
    ], advanced: { stableAccountId: 'DEBT-CITIAA',
      reasonCodes: ['MULTIPLE_APR_REVIEW_REQUIRED'], facts: [] } }],
  attention: [{ accountName: 'Fixture Cash', title: 'Balance is missing',
    message: 'No monthly value has been entered.', blocksReadiness: false, kind: 'MISSING',
    status: 'MORE_DATA_NEEDED', statusLabel: 'Needs attention',
    reason: 'No monthly value has been entered.',
    planningImpact: 'Planning is not affected.',
    nextAction: 'Open Bank Accounts',
    reviewRoute: 'editor', navigatePage: 'assets', navigateTab: 'bank',
    hasAction: true, domain: 'CASH', accountKey: 'CASH-FIXTURE', cycleKey: '2026-09',
    reasons: ['No monthly value has been entered.'] }],
  providerReview: [{ accountName: 'CitiAA', title: 'APR needs review',
    message: 'Optional imported evidence to review — Planning is using the existing CashCompass value.',
    optional: true, status: 'READY_FOR_REVIEW', statusLabel: 'Ready for review',
    reason: 'Optional imported evidence to review — Planning is using the existing CashCompass value.',
    planningImpact: 'Planning is using the existing CashCompass value.',
    nextAction: '', reviewRoute: '', hasAction: false }],
  weeklyPlanReadiness: { status: 'MORE_DATA_NEEDED', statusLabel: 'Needs attention',
    message: 'Required monthly fields are still missing on a connected account.',
    dimensions: [{ label: 'Interest rates', status: 'CURRENT',
      statusLabel: 'Current', readyCount: 1, accountCount: 1,
      reason: 'A valid monthly CashCompass value is present.',
      planningImpact: 'Planning is using the existing CashCompass value.',
      nextAction: 'Current — no action required.' }] },
  unsupportedDomains: [
    { domain: 'Investments', status: 'Not included in this readiness review yet' },
    { domain: 'Properties', status: 'Not included in this readiness review yet' },
    { domain: 'Retirement', status: 'Not included in this readiness review yet' }
  ],
  unsupportedNote: 'Investments, properties, and retirement are maintained in CashCompass but are not yet included in this readiness review. Existing CashCompass values remain authoritative.'
};

const overview = context.planningDataReadinessOverviewHtml_(model);
assert.match(overview, /Data readiness/);
assert.match(overview, /Some required monthly values still need attention/);
assert.match(overview, /Items requiring action/);
assert.match(overview, /Review data/);
assert.doesNotMatch(overview, /Optional imported evidence to review|Optional provider information/);
assert.doesNotMatch(overview, /Samer Ally|CitiAA/,
  'compact Overview card must contain no account rows');

const detail = context.planningDataReadinessDetailHtml_(model);
assert.match(detail, /Some required monthly values still need attention/);
assert.match(detail, /Required monthly data/);
assert.match(detail, /Cash accounts: 1 of 1 current/);
assert.match(detail, /Credit cards: 1 of 1 current/);
assert.match(detail, /Items requiring action: 1/);
assert.match(detail, /Needs attention \(1\)/);
assert.match(detail, /Needs attention/);
assert.match(detail, /No monthly value has been entered/);
assert.match(detail, /Open Bank Accounts/);
assert.match(detail, /Current — no action required/);
assert.doesNotMatch(detail, /Review imported evidence/);
assert.doesNotMatch(detail, /data-review-route="imported_evidence"/);
assert.doesNotMatch(detail, /data-review-route="identity"/);
assert.match(detail, /Optional provider information/);
assert.match(detail, /do not affect Planning and do not require action/);
assert.match(detail, /Show details/);
assert.match(detail, /Cash data \(1\)/);
assert.match(detail, /Credit-card data \(1\)/);
assert.match(detail, /Readiness/);
assert.match(detail, /Planning uses the existing CashCompass values from INPUT\/SYS sheets/);
assert.match(detail, /Samer Ally/);
assert.match(detail, /\$30,411\.00/);
assert.match(detail, /Used by Planning/);
assert.match(detail, /\$29,850\.00/);
assert.match(detail, /evidence differs/);
assert.match(detail, /CitiAA/);
assert.match(detail, /Enter the APR that applies to the carried balance/);
assert.match(detail, /Planning currently uses/);
assert.match(detail, /Latest evidence/);
assert.doesNotMatch(detail, /Imported data readiness|Imported evidence checklist|Blocks imported readiness/i);
assert.doesNotMatch(detail, /Checking normalized|No normalized|Latest normalized|Authority has not switched/i,
  'the primary Data view must use customer language instead of implementation terminology');
assert.match(detail, /Difference detected/);
assert.match(detail, /Advanced audit details/);
assert.match(detail, /not yet included in this readiness review/);
assert.doesNotMatch(detail, /Authoritative data not connected yet/);
assert.doesNotMatch(detail, /material|significant/i,
  'exact differences must not be labeled financially material');
const attentionPanel = detail.match(/id="data_readiness_section_attention"[\s\S]*?id="data_readiness_section_cash"/)[0];
assert.match(attentionPanel, /Fixture Cash/);
assert.match(attentionPanel, /Open Bank Accounts/);
assert.doesNotMatch(attentionPanel, /Optional provider information|Show details|CitiAA/);

const screenshotModel = {
  authority: serverContext.dataReadinessAuthorityPresentation_('CURRENT',
    serverContext.dataReadinessDomainSummary_('cash', [staleOptionalRow]),
    serverContext.dataReadinessDomainSummary_('debt', [{
      domain: 'DEBT', ready: true, customerStatus: 'CURRENT',
      evidenceStatus: 'CURRENT', identity: verifiedIdentity
    }])),
  summary: {
    status: 'CURRENT', label: 'Current',
    actionItemCount: 0, attentionCount: 0, optionalReviewCount: 1,
    pageHeadline: 'Your required cash and credit-card data is current. No action is required.',
    overviewHeadline: 'Current',
    overviewMessage: 'Required cash and credit-card values are present for this period.',
    planningStatus: 'Planning uses the existing CashCompass values from INPUT/SYS sheets.',
    optionalProviderSummary: '1 older or unmatched imported record is available for reference. They do not affect Planning and do not require action.',
    cashReadyCount: 1, cashAccountCount: 1, cardReadyCount: 1, cardAccountCount: 1,
    cashPresentation: { status: 'CURRENT', label: 'Current',
      countLabel: '1 of 1 current', readyCount: 1, accountCount: 1 },
    cardPresentation: { status: 'CURRENT', label: 'Current',
      countLabel: '1 of 1 current', readyCount: 1, accountCount: 1 }
  },
  cash: [{ displayName: 'Samer Ally', planningValue: 30411, ready: true,
    customerStatus: 'CURRENT', reviewStatus: 'Current',
    guidance: manualPlusStaleGuidance, optionalItems: manualPlusStaleGuidance.optionalItems,
    fact: { status: 'CURRENT', statusLabel: 'Current' }, identity: { label: 'Matched' },
    difference: null, differenceStatus: 'UNAVAILABLE' }],
  debts: [{ displayName: 'CitiAA', ready: true, customerStatus: 'CURRENT',
    reviewStatus: 'Current', guidance: importedPlusStaleGuidance,
    optionalItems: importedPlusStaleGuidance.optionalItems,
    identity: { label: 'Matched' },
    facts: [{ factType: 'CURRENT_BALANCE', label: 'Balance', planningValue: 9500,
      status: 'CURRENT', statusLabel: 'Current', guidance: importedPlusStaleGuidance }] }],
  attention: [],
  providerReview: serverContext.dataReadinessProviderReview_([staleOptionalRow], []),
  weeklyPlanReadiness: { status: 'CURRENT', statusLabel: 'Current',
    message: 'Required monthly evidence is valid and current.',
    dimensions: [{ label: 'Cash data', status: 'CURRENT',
      statusLabel: 'Current', readyCount: 1, accountCount: 1,
      nextAction: 'Current — no action required.' }] },
  unsupportedDomains: model.unsupportedDomains
};
const screenshotOverview = context.planningDataReadinessOverviewHtml_(screenshotModel);
const screenshotDetail = context.planningDataReadinessDetailHtml_(screenshotModel);
assert.match(screenshotOverview, /Your required cash and credit-card data is current. No action is required/);
assert.match(screenshotOverview, /Items requiring action:<\/strong> 0/);
assert.doesNotMatch(screenshotOverview, /Optional imported evidence to review|Optional provider information/);
assert.match(screenshotOverview, /Current/);
assert.doesNotMatch(screenshotOverview, /Needs review/);
assert.match(screenshotDetail, /Your required cash and credit-card data is current. No action is required/);
assert.match(screenshotDetail, /Cash accounts: 1 of 1 current/);
assert.match(screenshotDetail, /Credit cards: 1 of 1 current/);
assert.match(screenshotDetail, /Items requiring action: 0/);
assert.match(screenshotDetail, /Needs attention \(0\)/);
assert.match(screenshotDetail, /Nothing currently requires attention/);
assert.match(screenshotDetail, /Current — no action required/);
assert.match(screenshotDetail, /Optional provider information/);
assert.match(screenshotDetail, /1 older or unmatched imported record is available for reference/);
assert.match(screenshotDetail, /do not affect Planning and do not require action/);
assert.match(screenshotDetail, /Show details/);
assert.match(screenshotDetail, /id="data_readiness_optional_details"/);
assert.doesNotMatch(screenshotDetail, /id="data_readiness_optional_details"[^>]*\sopen/);
assert.match(screenshotDetail, /Planning uses the existing CashCompass values from INPUT\/SYS sheets/);
assert.match(screenshotDetail, /not yet included in this readiness review/);
const screenshotAttention = screenshotDetail.match(
  /id="data_readiness_section_attention"[\s\S]*?id="data_readiness_section_cash"/)[0];
assert.match(screenshotAttention, /Nothing currently requires attention/);
assert.doesNotMatch(screenshotAttention, /Optional provider information|Show details|Samer Ally|imported evidence is stale/i);
assert.doesNotMatch(screenshotDetail, /Review imported evidence/);
assert.doesNotMatch(screenshotDetail, /data-review-route="imported_evidence"/);
assert.doesNotMatch(screenshotDetail, /data-review-route="identity"/);
assert.doesNotMatch(screenshotDetail, /planningDataReadinessOpenItemFromButton_/);

const emptyModel = {
  authority: serverContext.dataReadinessAuthorityPresentation_('NOT_CONNECTED', emptyCash, emptyCards),
  summary: { status: noDataState.code, label: noDataState.label,
    message: noDataState.message, overviewHeadline: noDataState.overviewHeadline,
    overviewMessage: noDataState.overviewMessage,
    attentionEmptyMessage: noDataState.attentionEmptyMessage, attentionCount: 0,
    cashPresentation: emptyCash,
    cardPresentation: emptyCards },
  cash: [], debts: [], attention: [], weeklyPlanReadiness: noDataWeekly,
  unsupportedDomains: model.unsupportedDomains
};
const emptyOverview = context.planningDataReadinessOverviewHtml_(emptyModel);
const emptyDetail = context.planningDataReadinessDetailHtml_(emptyModel);
assert.match(emptyOverview, /Not connected/);
assert.match(emptyOverview, /Cash and credit-card data still need to be added or verified|Cash and credit-card accounts are not connected yet/);
assert.doesNotMatch(emptyOverview, /No blocking updates|Needs review|More data needed|Ready for review/);
assert.doesNotMatch(emptyOverview, /Your required cash and credit-card data is current/);
assert.match(emptyDetail, /Not connected/);
assert.match(emptyDetail, /Cash accounts: Not connected/);
assert.match(emptyDetail, /Credit cards: Not connected/);
assert.match(emptyDetail, /No cash accounts yet/);
assert.match(emptyDetail, /No credit-card accounts yet/);
assert.match(emptyDetail, /Nothing currently requires attention/);
assert.match(emptyDetail, />Not connected</);
assert.doesNotMatch(emptyDetail, /0 of 0 current/);
assert.doesNotMatch(emptyDetail, /Your required cash and credit-card data is current/);
assert.doesNotMatch(emptyDetail, /Optional provider information/);
assert.doesNotMatch(emptyDetail, /Data readiness: (More data needed|Ready for review|Needs review|Current)/);
assert.doesNotMatch(emptyDetail, /Imported data readiness|0\s*\/\s*0|Refresh method not yet available|accounts ready/,
  'no-data customer view must not expose vacuous readiness or imported-only failures');
assert.match(emptyDetail, /not yet included in this readiness review/);
assert.doesNotMatch(emptyDetail, /Authoritative data not connected yet/);

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
assert.match(help, /valid monthly value counts as evidence/);
assert.match(help, /Not connected/);
assert.match(help, /Needs attention/);
assert.match(help, /Needs review/);
assert.match(help, /Current — no action required/);
assert.match(help, /Open Bank Accounts/);
assert.match(help, /INPUT and SYS/);
assert.match(help, /does not open Connected Accounts/);
assert.match(help, /Action buttons appear only when a required monthly CashCompass value is missing/);
assert.match(help, /not yet included in this readiness review/);
assert.doesNotMatch(help, /Authoritative data not connected yet/);
assert.match(clientSource, /planningDataReadinessOpenImportedReview_/);
assert.match(clientSource, /reviewRoute === 'imported_evidence'/);
assert.match(clientSource, /function planningDataReadinessOpenImportedReview_/);
assert.doesNotMatch(clientSource, /function planningDataReadinessOpenImportedReview_[\s\S]{0,800}focusTarget/);
assert.match(detail, /Open Bank Accounts/);
assert.doesNotMatch(detail, /data-review-route="imported_evidence"/);
const renderSource = read('Dashboard_Script_Render.html');
assert.match(renderSource, /reviewRoute === 'identity'/);
assert.match(renderSource, /setBankPanelMode\('connected'\)/);
assert.doesNotMatch(clientSource, /setBankPanelMode\('connected'\)/);
assert.match(suites, /SUITE-PART-2A-DATA-READINESS/);
assert.match(suites, /function testRunPart2aDataReadinessSuite\(options\)/);
assert.match(suites, /requested\.dispositionMode = 'trash'/);
assert.match(scenarios, /REGRESSION-PART-2A-DATA-READINESS/);
assert.match(scenarios, /Planning remains byte-equivalent/);

const dataReadinessScope =
  'Data Readiness checks required monthly cash and credit-card data. Monthly Review checks monthly values across banks, houses, investments, and debts.';
assert.equal(serverContext.DATA_READINESS_COPY_.PAGE_SCOPE, dataReadinessScope);
assert.match(clientSource, /function planningDataReadinessPageScope_/);
assert.match(screenshotDetail, /Data Readiness checks required monthly cash and credit-card data/);
assert.match(screenshotDetail, /Monthly Review checks monthly values across banks, houses, investments, and debts/);
assert.match(emptyDetail, /Data Readiness checks required monthly cash and credit-card data/);
assert.match(help, /Data Readiness checks required monthly cash and credit-card data/);
assert.match(help, /Monthly Review checks whether this month/);
assert.match(help, /Optional provider information is reference-only when a valid CashCompass value already exists/);
assert.match(help, /does not require Plaid, does not create an action item, does not open Connected Accounts, and does not replace the existing CashCompass value/);
assert.doesNotMatch(help, /Ready for review/);
assert.doesNotMatch(help, /compare or apply/);
assert.doesNotMatch(help, /you can compare or apply/);
const helpDataActions = help.match(/On Data Readiness those actions are[\s\S]*?\./)[0];
assert.match(helpDataActions, /Open Bank Accounts/);
assert.match(helpDataActions, /Open Debts/);
assert.doesNotMatch(helpDataActions, /Open Houses|Open Investments/);
assert.match(help, /Missing monthly values for banks, houses, investments, and debts are handled in <strong>Monthly Review<\/strong>/);
assert.match(help, /Plan notes<\/strong> for allocation warnings and recommendations/);
assert.match(help, /Planning warnings are not the same as missing monthly data/);
assert.match(shellSource, /missingDataCount \? 'Needs your attention' : 'Plan notes'/);
assert.match(shellSource, /planNotes\.length \? 'Planning considerations' : 'No action needed right now'/);
assert.match(shellSource, /Planning warnings are not the same as missing monthly data/);
assert.match(shellSource, /function openCapitalAllocationCashSettingsReview_/);
assert.match(shellSource, /Review cash settings<\/button>/);
assert.match(shellSource, /panelMode: 'manage'/);
assert.doesNotMatch(shellSource,
  /function openCapitalAllocationCashSettingsReview_[\s\S]{0,900}(?:google\.script\.run|saveTrackedBankAccountFromDashboard|submitBankEdit_|setBankPanelMode\('connected'\)|loadPlanningDataReadiness_|openMonthlyReviewScreen_)/);
assert.match(renderSource,
  /obj && obj\.panelMode === 'manage'[\s\S]*?setBankPanelMode\('manage'\)[\s\S]*?openBankEditForm_\(name\)/);
assert.doesNotMatch(clientSource, /openCapitalAllocationCashSettingsReview_/);
assert.match(styles, /data-readiness-page-scope/);
assert.match(styles, /monthly-review-scope/);

console.log('Data readiness regressions passed.');
