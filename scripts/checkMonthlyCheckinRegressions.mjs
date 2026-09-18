import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const modelSource = fs.readFileSync(new URL('../monthly_checkin.js', import.meta.url), 'utf8');
const identitySource = fs.readFileSync(new URL('../monthly_checkin_identity.js', import.meta.url), 'utf8');
const planningSource = fs.readFileSync(new URL('../capital_allocation.js', import.meta.url), 'utf8');
const readinessSource = fs.readFileSync(new URL('../data_readiness.js', import.meta.url), 'utf8');
const plaidSource = fs.readFileSync(new URL('../plaid_import_bridge.js', import.meta.url), 'utf8');
const factsSource = fs.readFileSync(new URL('../financial_facts.js', import.meta.url), 'utf8');

const context = { console };
vm.createContext(context);
vm.runInContext(modelSource, context, { filename: 'monthly_checkin.js' });

function assertJsonEqual(actual, expected) {
  assert.equal(JSON.stringify(actual), JSON.stringify(expected));
}

const cycleKey = '2026-09';
const defaultState = context.monthlyCheckinDefaultState_(cycleKey);
assert.equal(defaultState.version, 1);
assert.equal(defaultState.cycleKey, cycleKey);
assert.equal(defaultState.revision, 0);
assert.equal(defaultState.updatedAt, null);
assertJsonEqual(defaultState.domains.bank.reviewedKeys, []);
assertJsonEqual(defaultState.domains.houses.reviewedKeys, []);
assertJsonEqual(defaultState.domains.investments.reviewedKeys, []);
assertJsonEqual(defaultState.domains.debts.reviewedKeys, []);

assert.equal(context.monthlyCheckinValidateCycleKey_('2026-09'), true);
assert.equal(context.monthlyCheckinValidateCycleKey_('2026-13'), false);
assert.equal(context.monthlyCheckinValidateCycleKey_('26-09'), false);
assert.equal(context.monthlyCheckinSettingsKey_(cycleKey), 'monthly_checkin.v1.2026-09');

const missing = context.monthlyCheckinParseStoredState_(null, cycleKey);
assert.equal(missing.ok, false);
assert.equal(missing.reason, 'MISSING');
assertJsonEqual(missing.state.domains.bank.reviewedKeys, []);

const malformed = context.monthlyCheckinParseStoredState_('{not json', cycleKey);
assert.equal(malformed.ok, false);
assert.equal(malformed.reason, 'MALFORMED');
assert.equal(malformed.state.cycleKey, cycleKey);

const priorMonth = context.monthlyCheckinParseStoredState_(JSON.stringify({
  version: 1,
  cycleKey: '2026-08',
  revision: 2,
  updatedAt: '2026-08-31T00:00:00.000Z',
  domains: {
    bank: { reviewedKeys: ['bank:v1:CASH-1'] },
    houses: { reviewedKeys: [] },
    investments: { reviewedKeys: [] },
    debts: { reviewedKeys: [] }
  }
}), cycleKey);
assert.equal(priorMonth.ok, false);
assert.equal(priorMonth.reason, 'CYCLE_MISMATCH');
assertJsonEqual(priorMonth.state.domains.bank.reviewedKeys, []);

const emptyDomain = context.monthlyCheckinBuildDomainProjection_(
  'bank', defaultState, [], []);
assert.equal(emptyDomain.status, 'COMPLETE');
assert.equal(emptyDomain.activeCount, 0);

const partialState = context.monthlyCheckinParseStoredState_(JSON.stringify({
  version: 1,
  cycleKey: cycleKey,
  revision: 1,
  updatedAt: '2026-09-03T00:00:00.000Z',
  domains: {
    bank: { reviewedKeys: ['bank:v1:CASH-1'] },
    houses: { reviewedKeys: [] },
    investments: { reviewedKeys: [] },
    debts: { reviewedKeys: [] }
  }
}), cycleKey).state;
const partialBank = context.monthlyCheckinBuildDomainProjection_(
  'bank', partialState,
  [
    { accountKey: 'bank:v1:CASH-1', hasCurrentMonthValue: true },
    { accountKey: 'bank:v1:CASH-2', hasCurrentMonthValue: false }
  ], []);
assert.equal(partialBank.status, 'IN_PROGRESS');
assert.equal(partialBank.activeCount, 2);
assert.equal(partialBank.currentMonthValueCount, 1);
assert.equal(partialBank.missingCurrentMonthValueCount, 1);

const completeBank = context.monthlyCheckinBuildDomainProjection_(
  'bank', partialState,
  [{ accountKey: 'bank:v1:CASH-1', hasCurrentMonthValue: true }], []);
assert.equal(completeBank.status, 'COMPLETE');
assert.equal(completeBank.currentMonthValueCount, 1);

const newActiveBank = context.monthlyCheckinBuildDomainProjection_(
  'bank', partialState,
  [
    { accountKey: 'bank:v1:CASH-1', hasCurrentMonthValue: true },
    { accountKey: 'bank:v1:CASH-NEW', hasCurrentMonthValue: false }
  ], []);
assert.equal(newActiveBank.status, 'IN_PROGRESS');
assert.equal(newActiveBank.missingCurrentMonthValueCount, 1);

const stoppedExcluded = context.monthlyCheckinBuildDomainProjection_(
  'bank', partialState,
  [{ accountKey: 'bank:v1:CASH-1', hasCurrentMonthValue: true }], []);
assert.equal(stoppedExcluded.activeCount, 1);
assert.notEqual(stoppedExcluded.activeRecords.some((row) => row.accountKey === 'bank:v1:CASH-2'), true);

const investmentSeptember = context.monthlyCheckinBuildDomainProjection_(
  'investments', defaultState,
  Array.from({ length: 14 }, (_, index) => ({
    accountKey: '',
    displayName: 'Fund ' + String(index + 1).padStart(2, '0'),
    hasCurrentMonthValue: index < 12
  })), []);
assert.equal(investmentSeptember.activeCount, 14);
assert.equal(investmentSeptember.currentMonthValueCount, 12);
assert.equal(investmentSeptember.missingCurrentMonthValueCount, 2);
assert.equal(investmentSeptember.identityIssueCount, 0);
assert.equal(investmentSeptember.status, 'IN_PROGRESS');
assert.equal(
  investmentSeptember.activeRecords.filter((row) => row.accountKey).length,
  0,
  'ordinary investments must not require durable review keys'
);

const identitySeparateFromMissing = context.monthlyCheckinBuildDomainProjection_(
  'investments', defaultState,
  [{ accountKey: 'investment:v1:INV-01', hasCurrentMonthValue: true }],
  [{ code: 'IDENTITY_UNRESOLVED', displayName: 'Orphan Fund' }]);
assert.equal(identitySeparateFromMissing.activeCount, 1);
assert.equal(identitySeparateFromMissing.currentMonthValueCount, 1);
assert.equal(identitySeparateFromMissing.missingCurrentMonthValueCount, 0);
assert.equal(identitySeparateFromMissing.identityIssueCount, 1);
assert.equal(identitySeparateFromMissing.status, 'IN_PROGRESS');

const unresolved = context.monthlyCheckinBuildDomainProjection_(
  'debts', defaultState,
  [{ accountKey: 'debt:v1:DEBT-1', lastUpdated: '' }],
  [{ code: 'IDENTITY_UNRESOLVED', displayName: 'Mystery Card' }]);
assert.equal(unresolved.status, 'IN_PROGRESS');
assert.equal(unresolved.identityIssueCount, 1);
assert.equal(unresolved.activeCount, 1);

const debtAck = context.monthlyCheckinBuildDomainProjection_(
  'debts', partialState,
  [
    { accountKey: 'debt:v1:DEBT-1', lastUpdated: '' },
    { accountKey: 'debt:v1:DEBT-2', lastUpdated: '' }
  ], []);
assert.equal(debtAck.status, 'NOT_STARTED');
assert.equal(debtAck.currentCount, 0);
assert.equal(debtAck.needsUpdateCount, 2);

const debtPartialReview = context.monthlyCheckinBuildDomainProjection_(
  'debts', partialState,
  Array.from({ length: 24 }, (_, index) => ({
    accountKey: 'debt:v1:DEBT-' + String(index + 1).padStart(2, '0'),
    lastUpdated: index < 10 ? '2026-09-15' : (index < 20 ? '2026-08-31' : '')
  })), []);
assert.equal(debtPartialReview.activeCount, 24);
assert.equal(debtPartialReview.currentCount, 10);
assert.equal(debtPartialReview.needsUpdateCount, 14);
assert.equal(debtPartialReview.status, 'IN_PROGRESS');

const debtCurrentCycle = context.monthlyCheckinBuildDomainProjection_(
  'debts', partialState,
  [{ accountKey: 'debt:v1:DEBT-1', lastUpdated: '2026-09-01' }], []);
assert.equal(debtCurrentCycle.currentCount, 1);
assert.equal(debtCurrentCycle.status, 'COMPLETE');

const debtPriorCycle = context.monthlyCheckinBuildDomainProjection_(
  'debts', partialState,
  [{ accountKey: 'debt:v1:DEBT-1', lastUpdated: '2026-08-31' }], []);
assert.equal(debtPriorCycle.currentCount, 0);
assert.equal(debtPriorCycle.needsUpdateCount, 1);

const debtRollover = context.monthlyCheckinBuildDomainProjection_(
  'debts', context.monthlyCheckinDefaultState_('2026-10'),
  [{ accountKey: 'debt:v1:DEBT-1', lastUpdated: '2026-09-30' }], []);
assert.equal(debtRollover.currentCount, 0);

const overall = context.monthlyCheckinBuildCycleProjection_(partialState, {
  bank: [{ accountKey: 'bank:v1:CASH-1', hasCurrentMonthValue: true }],
  houses: [],
  investments: [],
  debts: [{ accountKey: 'debt:v1:DEBT-1', lastUpdated: '' }]
}, {
  bank: [],
  houses: [],
  investments: [],
  debts: []
});
assert.equal(overall.domains.bank.status, 'COMPLETE');
assert.equal(overall.domains.debts.status, 'NOT_STARTED');
assert.equal(overall.status, 'IN_PROGRESS');

const uiDebtState = context.monthlyCheckinParseStoredState_(JSON.stringify({
  version: 1,
  cycleKey: cycleKey,
  revision: 1,
  updatedAt: '2026-09-03T00:00:00.000Z',
  domains: {
    bank: { reviewedKeys: [] },
    houses: { reviewedKeys: [] },
    investments: { reviewedKeys: [] },
    debts: { reviewedKeys: ['debt:v1:DEBT-2'] }
  }
}), cycleKey).state;
const uiProjection = context.monthlyCheckinBuildCycleProjection_(uiDebtState, {
  bank: [{ accountKey: 'bank:v1:CASH-1', displayName: 'Ally', hasCurrentMonthValue: true, currentMonthValue: 1000 }],
  houses: [{ accountKey: 'house:v1:HOME-1', displayName: 'Main House', hasCurrentMonthValue: false }],
  investments: Array.from({ length: 14 }, (_, index) => ({
    accountKey: '',
    displayName: 'Fund ' + (index + 1),
    hasCurrentMonthValue: index < 12,
    currentMonthValue: index < 12 ? 1000 + index : null
  })),
  debts: [
    { accountKey: 'debt:v1:DEBT-1', displayName: 'Visa', accountBalance: 500, type: 'Credit card', lastUpdated: '' },
    { accountKey: 'debt:v1:DEBT-2', displayName: 'Mortgage', accountBalance: 250000, type: 'Mortgage', lastUpdated: '2026-09-02' }
  ]
}, {
  bank: [{ code: 'IDENTITY_UNRESOLVED', displayName: 'Orphan Bank' }],
  houses: [],
  investments: [],
  debts: []
}).ui;
assert.equal(uiProjection.attentionCount, 4,
  'attentionCount counts missing month values plus unreviewed debts only');
assert.equal(uiProjection.missingMonthValueCount, 3);
assert.equal(uiProjection.debtNeedsUpdateCount, 1);
assert.equal(uiProjection.identityIssueCount, 1,
  'identity issues must stay separate from attentionCount');
assert.equal(uiProjection.needsReviewCount, 5);
assert.equal(uiProjection.domainSections.find((row) => row.domain === 'investments').currentMonthValueCount, 12);
assert.equal(uiProjection.domainSections.find((row) => row.domain === 'investments').missingCurrentMonthValueCount, 2);
assert.equal(uiProjection.attentionItems.some((row) => row.displayName === 'Fund 13'), true);
assert.equal(uiProjection.attentionItems.some((row) => row.displayName === 'Fund 1'), false,
  'populated September values must not be listed as missing');
assert.equal(
  uiProjection.attentionItems.filter((row) => row.domain === 'investments').length,
  2,
  'only missing current-month investment values should need attention'
);
assert.equal(uiProjection.attentionItems.some((row) => row.domain === 'debts' && row.reason === 'Needs current-cycle update'), true);
assert.equal(uiProjection.identityRepairItems.length, 1);
assert.equal(uiProjection.identityRepairItems[0].displayName, 'Orphan Bank');
assert.equal(uiProjection.identityRepairItems[0].reviewRoute, 'identity');
assert.equal(uiProjection.identityRepairItems[0].actionLabel, 'Review account match');
assert.equal(uiProjection.domainSections.every((row) => row.navigatePage === 'assets'), true);
assert.equal(
  JSON.stringify(uiProjection.domainSections.map((row) => row.navigateTab)),
  JSON.stringify(['bank', 'houses', 'investments', 'debts'])
);

assert.doesNotMatch(modelSource, /\bsetValue\s*\(/);
assert.doesNotMatch(modelSource, /\bappendRow\s*\(/);
assert.doesNotMatch(modelSource, /\bwriteSetting_\s*\(/);
assert.doesNotMatch(modelSource, /\bgetUserSpreadsheet_\s*\(/);
assert.doesNotMatch(modelSource, /\breadFinancialFacts_\s*\(/);
assert.doesNotMatch(modelSource, /data_readiness|plaid_import|capital_allocation/i);
assert.doesNotMatch(modelSource, /monthlyCheckinResolveAccountKey_/);

assert.doesNotMatch(planningSource, /monthly_checkin/);
assert.doesNotMatch(readinessSource, /monthly_checkin/);
assert.doesNotMatch(plaidSource, /monthly_checkin/);
assert.doesNotMatch(factsSource, /monthly_checkin/);

const zeroBank = context.monthlyCheckinEvaluateMonthValueEvidence_({
  accountKey: 'bank:v1:CASH-ZERO',
  hasCurrentMonthValue: true,
  currentMonthValue: 0,
  sourceType: 'MANUAL'
});
assert.equal(zeroBank.hasCurrentMonthValue, true, 'explicit zero counts as valid monthly evidence');
assert.equal(zeroBank.currentMonthValue, 0);
assert.equal(zeroBank.sourceCode, 'MANUAL');
assert.equal(zeroBank.evidenceStatus, 'CURRENT');

const manualBank = context.monthlyCheckinEvaluateMonthValueEvidence_({
  accountKey: 'bank:v1:CASH-MANUAL',
  hasCurrentMonthValue: true,
  currentMonthValue: 1200,
  sourceType: 'MANUAL'
});
assert.equal(manualBank.valid === undefined ? manualBank.hasCurrentMonthValue : manualBank.valid, true);
assert.equal(manualBank.sourceLabel, 'Manual');

const plaidBank = context.monthlyCheckinEvaluateMonthValueEvidence_({
  accountKey: 'bank:v1:CASH-PLAID',
  hasCurrentMonthValue: true,
  currentMonthValue: 800,
  sourceType: 'PLAID',
  sourceSystem: 'PLAID'
});
assert.equal(plaidBank.hasCurrentMonthValue, true, 'Plaid value counts as valid monthly evidence');
assert.equal(plaidBank.sourceCode, 'PLAID');
assert.equal(plaidBank.sourceLabel, 'Plaid');

const csvBank = context.monthlyCheckinEvaluateMonthValueEvidence_({
  accountKey: 'bank:v1:CASH-CSV',
  hasCurrentMonthValue: true,
  currentMonthValue: 90,
  sourceType: 'CSV'
});
assert.equal(csvBank.sourceCode, 'CSV');
const pdfBank = context.monthlyCheckinEvaluateMonthValueEvidence_({
  accountKey: 'bank:v1:CASH-PDF',
  hasCurrentMonthValue: true,
  currentMonthValue: 70,
  sourceType: 'PDF'
});
assert.equal(pdfBank.sourceCode, 'PDF');

const missingBank = context.monthlyCheckinEvaluateMonthValueEvidence_({
  accountKey: 'bank:v1:CASH-MISSING',
  hasCurrentMonthValue: false
});
assert.equal(missingBank.hasCurrentMonthValue, false, 'missing value requires attention');
assert.equal(missingBank.evidenceStatus, 'MISSING');
assert.equal(missingBank.evidenceTone, 'review');

const invalidBank = context.monthlyCheckinEvaluateMonthValueEvidence_({
  accountKey: 'bank:v1:CASH-INVALID',
  hasCurrentMonthValue: true,
  currentMonthValue: 'N/A'
});
assert.equal(invalidBank.hasCurrentMonthValue, false, 'invalid value requires review');
assert.equal(invalidBank.invalidCurrentMonthValue, true);
assert.equal(invalidBank.evidenceTone, 'error');

const unimportedBank = context.monthlyCheckinBuildDomainProjection_(
  'bank', defaultState,
  [{ accountKey: 'bank:v1:CASH-1', hasCurrentMonthValue: true, currentMonthValue: 50, sourceType: 'MANUAL' }],
  []);
assert.equal(unimportedBank.status, 'COMPLETE');
assert.equal(unimportedBank.activeRecords[0].sourceCode, 'MANUAL');
assert.doesNotMatch(JSON.stringify(unimportedBank), /imported-data failure|Imported evidence/i);

vm.runInContext(identitySource, context, { filename: 'monthly_checkin_identity.js' });
const registry = {
  accounts: [{
    stableAccountId: 'CASH-1', domain: 'CASH', displayName: 'Ally',
    legacyDomain: 'SYS_ACCOUNTS', legacyKey: 'Ally', identityStatus: 'VERIFIED'
  }]
};
const index = context.monthlyCheckinBuildRegistryIndex_(registry);
const resolved = context.monthlyCheckinResolveAccountKey_({
  domain: 'bank', stableAccountId: 'CASH-1', registryIndex: index
});
assert.equal(resolved.accountKey, 'bank:v1:CASH-1');
assert.doesNotMatch(resolved.accountKey, /:\d+$/);

const invalidReviewed = context.monthlyCheckinParseStoredState_(JSON.stringify({
  version: 1,
  cycleKey: cycleKey,
  revision: 0,
  updatedAt: null,
  domains: {
    bank: { reviewedKeys: ['Ally Checking', 'bank:v1:5', 'bank:v1:CASH-1'] },
    houses: { reviewedKeys: [] },
    investments: { reviewedKeys: [] },
    debts: { reviewedKeys: [] }
  }
}), cycleKey);
assert.equal(invalidReviewed.ok, true);
assertJsonEqual(invalidReviewed.state.domains.bank.reviewedKeys, ['bank:v1:CASH-1']);

const serialized = context.monthlyCheckinSerializeState_(invalidReviewed.state);
assert.equal(typeof serialized, 'string');
assert.equal(JSON.parse(serialized).domains.bank.reviewedKeys[0], 'bank:v1:CASH-1');

const missingBankUi = context.monthlyCheckinBuildRecordUi_('bank', {
  accountKey: 'bank:v1:CASH-MISSING', displayName: 'Ally', hasCurrentMonthValue: false
}, cycleKey);
assert.equal(missingBankUi.hasAction, true);
assert.equal(missingBankUi.actionLabel, 'Open Bank Accounts');
assert.equal(missingBankUi.navigateTab, 'bank');
assert.equal(missingBankUi.cycleKey, cycleKey);
assert.equal(missingBankUi.accountKey, 'bank:v1:CASH-MISSING');
assert.equal(missingBankUi.reviewRoute, 'editor');
assert.match(missingBankUi.reason, /September 2026/);

const missingHouseUi = context.monthlyCheckinBuildRecordUi_('houses', {
  accountKey: 'house:v1:H-1', displayName: 'Main House', hasCurrentMonthValue: false
}, cycleKey);
assert.equal(missingHouseUi.actionLabel, 'Open Houses');
assert.equal(missingHouseUi.navigateTab, 'houses');

const missingInvestmentUi = context.monthlyCheckinBuildRecordUi_('investments', {
  accountKey: 'investment:v1:I-1', displayName: 'Fund 13', hasCurrentMonthValue: false
}, cycleKey);
assert.equal(missingInvestmentUi.actionLabel, 'Open Investments');
assert.equal(missingInvestmentUi.navigateTab, 'investments');

const missingDebtUi = context.monthlyCheckinBuildRecordUi_('debts', {
  accountKey: 'debt:v1:D-1', displayName: 'Visa', currentForCycle: false, type: 'Credit card'
}, cycleKey);
assert.equal(missingDebtUi.actionLabel, 'Open Debts');
assert.equal(missingDebtUi.navigateTab, 'debts');
assert.equal(missingDebtUi.reason, 'Needs current-cycle update');

const currentBankUi = context.monthlyCheckinBuildRecordUi_('bank', {
  accountKey: 'bank:v1:CASH-CURRENT', displayName: 'Ally',
  hasCurrentMonthValue: true, currentMonthValue: 1200
}, cycleKey);
assert.equal(currentBankUi.hasAction, false);
assert.equal(currentBankUi.actionLabel, '');
assert.equal(currentBankUi.nextAction, 'Current — no action required.');
assert.equal(currentBankUi.needsAttention, false);

const currentImportedBankUi = context.monthlyCheckinBuildRecordUi_('bank', {
  accountKey: 'bank:v1:CASH-PLAID', displayName: 'BofA',
  hasCurrentMonthValue: true, currentMonthValue: 2400,
  sourceCode: 'PLAID', sourceLabel: 'Plaid'
}, cycleKey);
assert.equal(currentImportedBankUi.hasAction, false);
assert.equal(currentImportedBankUi.needsAttention, false);
assert.equal(currentImportedBankUi.nextAction, 'Current — no action required.');
assert.equal(currentImportedBankUi.sourceCode, 'PLAID');

const currentZeroBankUi = context.monthlyCheckinBuildRecordUi_('bank', {
  accountKey: 'bank:v1:CASH-ZERO', displayName: 'Ally',
  hasCurrentMonthValue: true, currentMonthValue: 0
}, cycleKey);
assert.equal(currentZeroBankUi.hasAction, false);
assert.equal(currentZeroBankUi.needsAttention, false);
assert.equal(currentZeroBankUi.currentValue, 0);
assert.equal(currentZeroBankUi.nextAction, 'Current — no action required.');

const invalidBankUi = context.monthlyCheckinBuildRecordUi_('bank', {
  accountKey: 'bank:v1:CASH-INVALID', displayName: 'Broken Bank',
  hasCurrentMonthValue: false, invalidCurrentMonthValue: true, currentMonthValue: 'N/A'
}, cycleKey);
assert.equal(invalidBankUi.needsAttention, true);
assert.notEqual(invalidBankUi.evidenceStatus, 'CURRENT');
assert.equal(invalidBankUi.evidenceStatus, 'INVALID');
assert.match(invalidBankUi.reason, /Invalid value needs review/);
assert.equal(invalidBankUi.hasAction, true);
assert.equal(invalidBankUi.actionLabel, 'Open Bank Accounts');
assert.equal(invalidBankUi.reviewRoute, 'editor');

const attentionThenCurrent = context.monthlyCheckinBuildCycleProjection_(defaultState, {
  bank: [{ accountKey: 'bank:v1:CASH-FIX', displayName: 'Fix Bank', hasCurrentMonthValue: false }],
  houses: [{ accountKey: 'house:v1:H-FIX', displayName: 'Fix House', hasCurrentMonthValue: false }],
  investments: [{ accountKey: 'investment:v1:I-FIX', displayName: 'Fund 13', hasCurrentMonthValue: false }],
  debts: [{ accountKey: 'debt:v1:D-FIX', displayName: 'Visa', lastUpdated: '' }]
}, { bank: [], houses: [], investments: [], debts: [] });
const attentionThenCurrentUi = context.monthlyCheckinBuildUiProjection_(attentionThenCurrent.domains, cycleKey);
assert.equal(attentionThenCurrentUi.attentionCount, 4);
assert.equal(attentionThenCurrentUi.attentionItems.every((row) => row.hasAction), true);

const afterFix = context.monthlyCheckinBuildCycleProjection_(defaultState, {
  bank: [{ accountKey: 'bank:v1:CASH-FIX', displayName: 'Fix Bank', hasCurrentMonthValue: true, currentMonthValue: 10 }],
  houses: [{ accountKey: 'house:v1:H-FIX', displayName: 'Fix House', hasCurrentMonthValue: true, currentMonthValue: 1 }],
  investments: [{ accountKey: 'investment:v1:I-FIX', displayName: 'Fund 13', hasCurrentMonthValue: true, currentMonthValue: 2 }],
  debts: [{ accountKey: 'debt:v1:D-FIX', displayName: 'Visa', lastUpdated: '2026-09-15' }]
}, { bank: [], houses: [], investments: [], debts: [] });
const afterFixUi = context.monthlyCheckinBuildUiProjection_(afterFix.domains, cycleKey);
assert.equal(afterFixUi.attentionCount, 0);
assert.equal(afterFixUi.attentionItems.length, 0);
assert.equal(afterFixUi.domainSections.every((row) => row.records.every((item) => !item.hasAction &&
  item.nextAction === 'Current — no action required.')), true);

const laterMonth = context.monthlyCheckinBuildCycleProjection_(
  context.monthlyCheckinDefaultState_('2026-10'),
  {
    bank: [{ accountKey: 'bank:v1:CASH-FIX', displayName: 'Fix Bank', hasCurrentMonthValue: true, currentMonthValue: 10 }],
    houses: [{ accountKey: 'house:v1:H-FIX', displayName: 'Fix House', hasCurrentMonthValue: true, currentMonthValue: 1 }],
    investments: [{ accountKey: 'investment:v1:I-FIX', displayName: 'Fund 13', hasCurrentMonthValue: true, currentMonthValue: 2 }],
    debts: [{ accountKey: 'debt:v1:D-FIX', displayName: 'Visa', lastUpdated: '2026-09-15' }]
  }, { bank: [], houses: [], investments: [], debts: [] });
assert.equal(laterMonth.domains.debts.needsUpdateCount, 1,
  'a completed debt stays current only until the month changes');

console.log('Monthly check-in model regressions passed.');
