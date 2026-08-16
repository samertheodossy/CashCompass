import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import vm from 'node:vm';

const factsSource = fs.readFileSync(new URL('../financial_facts.js', import.meta.url), 'utf8');
const planningSource = fs.readFileSync(new URL('../capital_allocation.js', import.meta.url), 'utf8');
const identitySource = fs.readFileSync(new URL('../financial_identity.js', import.meta.url), 'utf8');
const configSource = fs.readFileSync(new URL('../config.js', import.meta.url), 'utf8');
const harnessSource = fs.readFileSync(
  new URL('../test_harness_scenarios_rfp.js', import.meta.url), 'utf8');
const suitesSource = fs.readFileSync(new URL('../test_harness_suites.js', import.meta.url), 'utf8');
const validatorSource = fs.readFileSync(new URL('../validator_rules.js', import.meta.url), 'utf8');

const context = {
  Utilities: {
    DigestAlgorithm: { SHA_256: 'SHA_256' },
    Charset: { UTF_8: 'UTF_8' },
    computeDigest(_algorithm, value) {
      return [...crypto.createHash('sha256').update(String(value), 'utf8').digest()]
        .map((byte) => byte > 127 ? byte - 256 : byte);
    }
  },
  console
};
vm.createContext(context);
vm.runInContext(factsSource, context, { filename: 'financial_facts.js' });

const asOf = '2026-08-15T12:00:00.000Z';
let sequence = 0;
function rawFact(overrides = {}) {
  sequence += 1;
  return {
    stableInternalAccountId: 'DEBT-AMEX',
    factType: 'CURRENT_BALANCE',
    numericValue: 1000,
    textValue: '',
    currencyOrUnit: 'USD',
    effectiveAsOf: '2026-08-15T00:00:00.000Z',
    observedAt: '2026-08-15T01:00:00.000Z',
    sourceType: 'INSTITUTION',
    sourceSystem: 'Fixture Institution',
    importRunId: 'RUN-FIXTURE',
    sourceRecordKey: `sha256:${String(sequence).padStart(64, '0')}`,
    authorityClass: 'INSTITUTION_AUTHORITATIVE',
    verificationStatus: 'VERIFIED',
    verifiedAt: '2026-08-15T01:00:00.000Z',
    manualOverride: false,
    supersedesFactId: '',
    reconciliationStatus: 'MATCHED',
    createdAt: '2026-08-15T01:00:00.000Z',
    ...overrides
  };
}
function fact(overrides = {}) {
  return context.normalizeFinancialFact_(rawFact(overrides), { asOf });
}

const expectedTypes = [
  'CURRENT_BALANCE', 'AVAILABLE_BALANCE', 'ACCOUNT_VALUE', 'APR', 'APY',
  'CREDIT_LIMIT', 'MINIMUM_PAYMENT', 'NEXT_PAYMENT_AMOUNT', 'NEXT_PAYMENT_DATE',
  'POSITION_QUANTITY', 'POSITION_MARKET_VALUE', 'SECURITY_PRICE', 'COST_BASIS',
  'CASH_SWEEP_YIELD'
];
assert.deepEqual(Object.keys(context.FINANCIAL_FACT_TYPES_).sort(), expectedTypes.sort(),
  'the initial Financial Facts contract must contain all 14 approved types');
assert.equal(Object.keys(context.FINANCIAL_FACT_TYPE_METADATA_).length, 14,
  'every fact type must have value metadata');

const unknownLegacy = context.financialFactFromLegacyValue_({
  stableInternalAccountId: 'DEBT-LEGACY', factType: 'CURRENT_BALANCE',
  numericValue: 400, currencyOrUnit: 'USD', asOf
});
assert.equal(context.evaluateFinancialFactFreshness_(unknownLegacy, asOf).status, 'UNKNOWN',
  'legacy values without a real timestamp must remain UNKNOWN');

assert.throws(() => fact({ effectiveAsOf: '2026-08-16T00:00:00.000Z' }),
  /cannot be in the future/, 'future Effective As Of must be rejected');

const oldObservedToday = fact({
  effectiveAsOf: '2026-07-31T00:00:00.000Z',
  observedAt: '2026-08-15T11:59:00.000Z',
  sourceType: 'STATEMENT', authorityClass: 'STATEMENT_DERIVED'
});
assert.equal(context.evaluateFinancialFactFreshness_(oldObservedToday, asOf).status, 'STALE',
  'Observed At today must not make July 31 evidence current');

const staleInstitution = fact({ effectiveAsOf: '2026-07-01T00:00:00.000Z' });
const currentVerifiedManual = fact({ sourceType: 'MANUAL', sourceSystem: 'USER',
  authorityClass: 'USER_VERIFIED_MANUAL', manualOverride: false });
assert.equal(context.selectCurrentFinancialFact_([staleInstitution, currentVerifiedManual],
  'DEBT-AMEX', 'CURRENT_BALANCE', asOf).fact.factId, currentVerifiedManual.factId,
  'current verified manual evidence must outrank stale institution evidence');

const recentInstitution = fact({ effectiveAsOf: '2026-08-10T00:00:00.000Z' });
const currentEstimate = fact({ numericValue: 995, sourceType: 'ESTIMATED',
  sourceSystem: 'USER_ESTIMATE', authorityClass: 'ESTIMATED',
  verificationStatus: 'UNVERIFIED', reconciliationStatus: 'UNVERIFIED' });
assert.equal(context.selectCurrentFinancialFact_([recentInstitution, currentEstimate],
  'DEBT-AMEX', 'CURRENT_BALANCE', asOf).fact.factId, recentInstitution.factId,
  'recent authoritative evidence must beat a current unverified estimate');

const currentInstitution = fact({ numericValue: 990 });
assert.equal(context.selectCurrentFinancialFact_([currentInstitution, currentEstimate],
  'DEBT-AMEX', 'CURRENT_BALANCE', asOf).fact.factId, currentInstitution.factId,
  'current authoritative evidence must beat a current unverified estimate');

assert.throws(() => context.normalizeFinancialFact_({ ...rawFact(), factType: 'USE_POLICY' },
  { asOf }), /Household policy cannot be stored/, 'policy fields must never enter facts');

const currentDebtSelection = context.selectCurrentFinancialFact_([currentInstitution],
  'DEBT-AMEX', 'CURRENT_BALANCE', asOf);
const staleBrokerage = fact({ stableInternalAccountId: 'INV-TAXABLE',
  factType: 'POSITION_QUANTITY', numericValue: 12, currencyOrUnit: 'SHARES',
  effectiveAsOf: '2026-07-01T00:00:00.000Z' });
assert.equal(context.evaluateDecisionDataQuality_('PAY_DEBT', [currentDebtSelection]).confidence,
  'HIGH', 'an unrelated stale brokerage fact must not degrade a debt decision');
assert.equal(context.evaluateDecisionDataQuality_('PAY_DEBT', [
  context.selectCurrentFinancialFact_([staleInstitution], 'DEBT-AMEX', 'CURRENT_BALANCE', asOf)
]).safeToAct, false, 'a stale card balance must block payoff actionability');
assert.equal(context.evaluateDecisionDataQuality_('SELL_SECURITY', [
  context.selectCurrentFinancialFact_([staleBrokerage], 'INV-TAXABLE', 'POSITION_QUANTITY', asOf)
]).safeToAct, false, 'a stale brokerage quantity must block a security sale');
assert.ok(context.evaluateDecisionDataQuality_('SELL_SECURITY', [
  context.selectCurrentFinancialFact_([staleBrokerage], 'INV-TAXABLE', 'POSITION_QUANTITY', asOf)
]).reasons.includes('MISSING_REQUIRED_FACT:COST_BASIS'),
  'decision policy must enforce required facts rather than trusting caller completeness');

const fixedMortgageApr = fact({ stableInternalAccountId: 'DEBT-MORTGAGE', factType: 'APR',
  numericValue: 2.75, currencyOrUnit: 'PERCENT_FIXED',
  effectiveAsOf: '2026-01-01T00:00:00.000Z' });
const mortgageSelection = context.selectCurrentFinancialFact_([fixedMortgageApr],
  'DEBT-MORTGAGE', 'APR', asOf);
assert.equal(mortgageSelection.freshness.category, 'LOWER_CHANGE_FREQUENCY');
assert.equal(mortgageSelection.freshness.safeToAct, true,
  'an older verified fixed mortgage APR can remain actionable under its policy');

const earlier = fact({ effectiveAsOf: '2026-08-14T00:00:00.000Z', numericValue: 1100 });
const laterRaw = rawFact({ effectiveAsOf: '2026-08-15T00:00:00.000Z', numericValue: 1000 });
const append = context.prepareFinancialFactAppend_([earlier], [laterRaw], { asOf });
assert.equal(append.appended.length, 1);
assert.equal(append.appended[0].supersedesFactId, earlier.factId,
  'newer evidence must append and reference the prior selected fact');
assert.equal(append.allFacts[0].numericValue, 1100,
  'append-only supersession must retain the old fact unchanged');

const laterFact = fact({ numericValue: 777 });
const duplicate = context.prepareFinancialFactAppend_([laterFact], [{ ...laterFact }], { asOf });
assert.equal(duplicate.appended.length, 0);
assert.equal(duplicate.duplicates.length, 1, 'identical evidence must be idempotent');

const deterministicA = context.selectCurrentFinancialFact_([currentEstimate, recentInstitution],
  'DEBT-AMEX', 'CURRENT_BALANCE', asOf).fact.factId;
const deterministicB = context.selectCurrentFinancialFact_([recentInstitution, currentEstimate],
  'DEBT-AMEX', 'CURRENT_BALANCE', asOf).fact.factId;
assert.equal(deterministicA, deterministicB, 'current fact selection must be deterministic');

const projection = context.buildCurrentFinancialFactsProjection_([
  recentInstitution, currentEstimate, fixedMortgageApr
], asOf);
for (const row of projection) {
  const direct = context.selectCurrentFinancialFact_([
    recentInstitution, currentEstimate, fixedMortgageApr
  ], row.stableInternalAccountId, row.factType, asOf);
  assert.equal(row.selection.fact.factId, direct.fact.factId,
    'rebuildable projection must equal direct selector output');
}

const rawSensitiveId = '1234567890123456';
assert.equal(context.financialFactSafeStableId_(rawSensitiveId).includes(rawSensitiveId), false,
  'diagnostics must not expose full sensitive identifiers');
assert.throws(() => fact({ stableInternalAccountId: rawSensitiveId }),
  /protected CashCompass account ID/);
assert.throws(() => fact({ sourceRecordKey: rawSensitiveId }), /protected sha256 key/);

const staleApr = fact({ factType: 'APR', numericValue: 24.99,
  currencyOrUnit: 'PERCENT_VARIABLE', effectiveAsOf: '2025-01-01T00:00:00.000Z' });
assert.equal(currentDebtSelection.confidence, 'HIGH');
assert.notEqual(context.selectCurrentFinancialFact_([staleApr], 'DEBT-AMEX', 'APR', asOf).confidence,
  'HIGH', 'confidence must remain fact-level within one account');

const conflictA = fact({ numericValue: 1000 });
const conflictB = fact({ numericValue: 1001, sourceRecordKey: `sha256:${'f'.repeat(64)}` });
const conflictSelection = context.selectCurrentFinancialFact_([conflictA, conflictB],
  'DEBT-AMEX', 'CURRENT_BALANCE', asOf);
assert.equal(conflictSelection.reconciliationStatus, 'CONFLICT');
assert.equal(conflictSelection.freshness.safeToAct, false,
  'equal-quality conflicting facts must remain non-actionable');

const nextDate = fact({ factType: 'NEXT_PAYMENT_DATE', numericValue: '',
  textValue: '2026-08-30', currencyOrUnit: 'DATE' });
assert.equal(nextDate.textValue, '2026-08-30');
assert.throws(() => fact({ factType: 'NEXT_PAYMENT_DATE', numericValue: '',
  textValue: '2026-02-31', currencyOrUnit: 'DATE' }), /invalid calendar date/);
assert.throws(() => fact({ factType: 'APR', numericValue: 20, textValue: 'twenty',
  currencyOrUnit: 'PERCENT' }), /does not permit Text Value/);
assert.throws(() => fact({ factType: 'APR', numericValue: 20, currencyOrUnit: 'USD' }),
  /requires PERCENT/);

const staleDiagnostics = context.buildFinancialFactDataQualityDiagnostics_([{
  stableInternalAccountId: 'DEBT-AMEX', factType: 'CURRENT_BALANCE',
  selection: context.selectCurrentFinancialFact_([staleInstitution],
    'DEBT-AMEX', 'CURRENT_BALANCE', asOf)
}]);
assert.ok(staleDiagnostics.some((row) => row.code === 'STALE_BALANCE'));
assert.ok(staleDiagnostics.some((row) => row.code === 'SAFE_TO_MODEL_NOT_ACT'));

assert.doesNotMatch(planningSource,
  /FINANCIAL_FACTS|SYS - Financial Facts|readPlanningFinancialFacts_/,
  'Part 2A-2 must not switch Planning to the shadow fact reader');
assert.doesNotMatch(identitySource, /CURRENT_BALANCE|MINIMUM_PAYMENT|COST_BASIS/,
  'the frozen identity module must not absorb financial-fact behavior');
assert.doesNotMatch(factsSource, /OAuth|accessToken|refreshToken|rawPayload/,
  'the fact foundation must not persist connector secrets or raw payloads');
assert.doesNotMatch(factsSource, /SYS - Current Facts/,
  'Part 2A-2 must not introduce a persisted current-facts authority');
assert.match(configSource, /FINANCIAL_FACTS:\s*'SYS - Financial Facts'/);
assert.match(validatorSource, /financialFactHeaders/);
assert.match(validatorSource, /FINANCIAL_FACTS[\s\S]*?VALIDATOR_PRESENCE_OPTIONAL_/,
  'Financial Facts must be additive and optional in the canonical validator');
assert.match(harnessSource,
  /getHarnessPart2aFinancialFactsScenario_[\s\S]*?executionLevel: 'PURE'/);
assert.match(harnessSource,
  /getHarnessPart2aFinancialFactsIntegrationScenario_[\s\S]*?executionLevel: 'INTEGRATION'/);
assert.match(suitesSource, /SUITE-PART-2A-FINANCIAL-FACTS/);

console.log('Financial Facts regressions passed.');
