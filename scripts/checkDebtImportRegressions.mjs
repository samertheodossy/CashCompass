import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import vm from 'node:vm';

const sources = ['config.js', 'financial_identity.js', 'financial_facts.js', 'cash_import.js',
  'debt_import.js'].map((name) => [name,
  fs.readFileSync(new URL(`../${name}`, import.meta.url), 'utf8')]);
let uuidSequence = 0;
const context = {
  Utilities: {
    DigestAlgorithm: { SHA_256: 'SHA_256' }, Charset: { UTF_8: 'UTF_8' },
    computeDigest(_algorithm, value) {
      return [...crypto.createHash('sha256').update(String(value), 'utf8').digest()]
        .map((byte) => byte > 127 ? byte - 256 : byte);
    },
    getUuid() { uuidSequence += 1; return `fixture-${uuidSequence}`; },
    formatDate(value, _timeZone, pattern) {
      const iso = new Date(value).toISOString();
      return pattern === 'yyyy-MM-dd' ? iso.slice(0, 10) : iso;
    }
  },
  Session: { getScriptTimeZone() { return 'America/Los_Angeles'; } },
  SpreadsheetApp: { flush() {} }, console
};
vm.createContext(context);
for (const [name, source] of sources) vm.runInContext(source, context, { filename: name });

const noDomainReadiness = context.evaluateWeeklyPlanDataReadinessFromState_([], {},
  '2026-08-16T20:00:00.000Z');
assert.equal(noDomainReadiness.dimensions.cash.status, 'NOT_CONNECTED',
  'zero normalized cash accounts must not be vacuously ready');
assert.equal(noDomainReadiness.dimensions.balanceReadiness.status, 'NOT_CONNECTED');
assert.equal(noDomainReadiness.dimensions.interestRankingReadiness.status, 'NOT_CONNECTED',
  'interest readiness cannot be READY with zero revolving cards');
assert.equal(noDomainReadiness.dimensions.paymentObligationReadiness.status, 'NOT_CONNECTED',
  'minimum and due-date readiness cannot be READY with zero revolving cards');
assert.equal(noDomainReadiness.dimensions.exactPayoffReadiness.status, 'NOT_CONNECTED',
  'exact payoff cannot be READY with zero revolving cards');
assert.equal(noDomainReadiness.overall, 'NOT_READY_FOR_AUTHORITY_SWITCH');

class FakeRange {
  constructor(sheet, row, col, numRows = 1, numCols = 1) {
    this.sheet = sheet; this.row = row; this.col = col;
    this.numRows = numRows; this.numCols = numCols;
  }
  read() {
    return Array.from({ length: this.numRows }, (_, r) =>
      Array.from({ length: this.numCols }, (_, c) =>
        this.sheet.rows[this.row - 1 + r]?.[this.col - 1 + c] ?? ''));
  }
  getValues() { return this.read(); }
  getDisplayValues() { return this.read().map((row) => row.map((value) => String(value ?? ''))); }
  setValues(values) {
    values.forEach((row, r) => row.forEach((value, c) => {
      const rr = this.row - 1 + r;
      while (this.sheet.rows.length <= rr) this.sheet.rows.push([]);
      this.sheet.rows[rr][this.col - 1 + c] = value;
    }));
    return this;
  }
  setFontWeight() { return this; } setBackground() { return this; }
  setHorizontalAlignment() { return this; }
}
class FakeSheet {
  constructor(name, rows = []) { this.name = name; this.rows = rows.map((row) => [...row]); }
  getName() { return this.name; }
  getLastRow() { return this.rows.length; }
  getLastColumn() { return Math.max(0, ...this.rows.map((row) => row.length)); }
  getRange(row, col, numRows = 1, numCols = 1) {
    return new FakeRange(this, row, col, numRows, numCols);
  }
  getDataRange() {
    return this.getRange(1, 1, Math.max(1, this.getLastRow()), Math.max(1, this.getLastColumn()));
  }
  appendRow(row) { this.rows.push([...row]); }
  setFrozenRows() {}
}
class FakeSpreadsheet {
  constructor(sheets = []) { this.sheets = new Map(sheets.map((sheet) => [sheet.getName(), sheet])); }
  getSheetByName(name) { return this.sheets.get(name) || null; }
  insertSheet(name) { const sheet = new FakeSheet(name); this.sheets.set(name, sheet); return sheet; }
  getSheets() { return [...this.sheets.values()]; }
}

const asOf = '2026-08-16T20:00:00.000Z';
const rawAccount = '4111111111110393';
const ofx = `OFXHEADER:100
DATA:OFXSGML
VERSION:102

<OFX><SIGNONMSGSRSV1><SONRS><FI><ORG>Fixture Card Bank</ORG><FID>4242</FID></FI></SONRS></SIGNONMSGSRSV1>
<CREDITCARDMSGSRSV1><CCSTMTTRNRS><CCSTMTRS><CURDEF>USD
<CCACCTFROM><ACCTID>${rawAccount}</CCACCTFROM>
<LEDGERBAL><BALAMT>9000.00<DTASOF>20260816090000[-5:EST]</LEDGERBAL>
<MINPMTDUE>270.00<NEXTPMTAMT>500.00<DTPMTDUE>20260825000000[-5:EST]
<CREDITLIMIT>15000.00<AVAILCREDIT>6000.00<APR>23.49
</CCSTMTRS></CCSTMTTRNRS></CREDITCARDMSGSRSV1></OFX>`;
const adapter = context.adaptOfxRevolvingDebtEvidence_(ofx, {
  observedAt: asOf, ownerId: 'SAMER', registrationType: 'INDIVIDUAL',
  planningAprApplicableToCarriedBalance: true
});
assert.equal(adapter.contractVersion, 'DEBT_EVIDENCE_V1');
assert.equal(adapter.accounts[0].facts.find((f) => f.factType === 'CURRENT_BALANCE').numericValue, 9000);
assert.equal(adapter.accounts[0].facts.some((f) => f.factType === 'APR'), false,
  'caller options must not manufacture canonical applicable APR from OFX');
assert.equal(adapter.accounts[0].facts.find((f) => f.factType === 'DISCLOSED_APR').numericValue, 23.49,
  'OFX headline APR must remain separately typed evidence');
assert.equal(adapter.accounts[0].aprReviewStatus, 'APR_APPLICABILITY_REVIEW_REQUIRED');
assert.equal(adapter.accounts[0].facts.find((f) => f.factType === 'MINIMUM_PAYMENT').numericValue, 270);
assert.equal(adapter.accounts[0].facts.find((f) => f.factType === 'NEXT_PAYMENT_AMOUNT').numericValue, 500,
  'minimum and next payment must remain independent');
assert.equal(adapter.accounts[0].facts.find((f) => f.factType === 'NEXT_PAYMENT_DATE').textValue,
  '2026-08-25');
assert.equal(JSON.stringify(adapter).includes(rawAccount), false,
  'full card number must never survive normalized output');
assert.match(adapter.accounts[0].sourceAccountKey, /^sha256:[a-f0-9]{64}$/);
assert.equal(context.FINANCIAL_FACT_TYPES_.APR, true);
assert.equal(context.FINANCIAL_FACT_TYPES_.APY, true);
assert.notEqual(context.FINANCIAL_FACT_TYPE_METADATA_.APR,
  context.FINANCIAL_FACT_TYPE_METADATA_.APY, 'APR and APY must remain distinct typed facts');
const dateCellRow = Array(19).fill('');
dateCellRow[0] = 'FACT-DATE-CELL';
dateCellRow[1] = 'DEBT-CITIAA';
dateCellRow[2] = 'NEXT_PAYMENT_DATE';
dateCellRow[4] = new Date('2026-08-25T07:00:00.000Z');
dateCellRow[5] = 'DATE';
dateCellRow[6] = asOf;
dateCellRow[7] = asOf;
dateCellRow[8] = 'INSTITUTION';
dateCellRow[9] = 'FIXTURE';
dateCellRow[11] = `sha256:${'f'.repeat(64)}`;
dateCellRow[12] = 'INSTITUTION_AUTHORITATIVE';
dateCellRow[13] = 'VERIFIED';
dateCellRow[14] = asOf;
dateCellRow[18] = asOf;
assert.equal(context.financialFactFromRow_(dateCellRow).textValue, '2026-08-25',
  'Sheets-coerced date cells must return the canonical date-only contract');

const multiple = context.adaptStructuredDebtEvidence_({ sourceSystem: 'FIXTURE_MULTI',
  observedAt: asOf, accounts: [{ externalAccountId: 'MULTI-0393', displayName: 'Multi APR',
    ownerId: 'SAMER', registrationType: 'INDIVIDUAL', effectiveAsOf: asOf,
    currentBalance: 1000, minimumPayment: 50, nextPaymentDate: '2026-08-25',
    rates: [{ type: 'PURCHASE', apr: 19.99 }, { type: 'CASH_ADVANCE', apr: 29.99 }] }] });
assert.equal(multiple.accounts[0].aprReviewStatus, 'MULTIPLE_APR_REVIEW_REQUIRED');
assert.equal(multiple.accounts[0].facts.some((f) => f.factType === 'APR'), false,
  'multiple APRs must not silently create a planning APR');
assert.equal(multiple.accounts[0].facts.some((f) => f.factType === 'PURCHASE_APR'), true);
assert.equal(multiple.accounts[0].facts.some((f) => f.factType === 'CASH_ADVANCE_APR'), true);

assert.equal(context.CHASE_SHADOW_IMPORT_V1_CONTRACT_.qfxProfile.fid, '10898');
assert.equal(context.CHASE_SHADOW_IMPORT_V1_CONTRACT_.qfxProfile.org, 'B1');
assert.deepEqual(Array.from(context.CHASE_SHADOW_IMPORT_V1_CONTRACT_.qfxProfile.availableCreditStructure),
  ['AVAILBAL/BALAMT', 'AVAILBAL/DTASOF']);
const chaseComponents = [
  { factType: 'PURCHASE_APR' }, { factType: 'CASH_ADVANCE_APR' },
  { factType: 'BALANCE_TRANSFER_APR' }
];
assert.equal(context.validateChaseShadowImportV1FactSet_('STATEMENT', chaseComponents).length, 3);
assert.throws(() => context.validateChaseShadowImportV1FactSet_('STATEMENT', [
  { factType: 'APR', appliesToCarriedBalance: true }
]), /cannot create canonical APR/,
  'Chase client/caller flags must never manufacture canonical APR');
for (const manufactured of ['PURCHASE_APR', 'CURRENT_BALANCE', 'STATEMENT_BALANCE']) {
  assert.throws(() => context.validateChaseShadowImportV1FactSet_('STATEMENT', [
    { factType: 'APR', derivedFrom: manufactured, selectionRule: 'FIRST_OR_ONLY' }
  ]), /cannot create canonical APR/);
}

const manual = context.adaptVerifiedManualDebtEvidence_({ stableAccountId: 'DEBT-CITIAA',
  apr: 23.49, rateType: 'PERCENT_VARIABLE', effectiveAsOf: asOf }, { observedAt: asOf });
assert.equal(manual.accounts[0].facts.length, 1,
  'manual APR can supplement a partial file without falsifying file provenance');
const manualFact = context.debtImportFinancialFact_(manual.accounts[0], manual.accounts[0].facts[0],
  'DEBT-CITIAA', 'IMPORT-MANUAL', true);
assert.equal(manualFact.authorityClass, 'USER_VERIFIED_MANUAL');
assert.equal(manualFact.sourceSystem, 'USER_VERIFIED_MANUAL');

const account = { stableAccountId: 'DEBT-CITIAA', domain: 'DEBT', displayName: 'CitiAA',
  institution: 'Fixture Card Bank', accountType: 'Credit Card', ownerId: 'SAMER',
  registrationType: 'INDIVIDUAL', last4: '0393', legacyDomain: 'INPUT_DEBTS',
  legacyKey: 'CitiAA', active: 'Yes' };
const link = { stableAccountId: account.stableAccountId, sourceSystem: adapter.sourceSystem,
  sourceAccountKey: adapter.accounts[0].sourceAccountKey, linkStatus: 'VERIFIED' };
assert.equal(context.debtImportMatchRecord_(adapter.accounts[0], [account], [link], {}).outcome,
  'EXACT_LINK');
const inactiveAccount = { ...account, active: 'No' };
assert.equal(context.debtImportMatchRecord_(adapter.accounts[0], [inactiveAccount], [link], {}).reason,
  'ACCOUNT_INACTIVE', 'a verified source link must not match an inactive Financial Account');
assert.equal(context.debtImportMatchRecord_(adapter.accounts[0], [inactiveAccount], [], {
  action: 'MATCH', stableAccountId: inactiveAccount.stableAccountId
}).reason, 'ACCOUNT_INACTIVE', 'an explicit decision must not match an inactive Financial Account');
assert.equal(context.debtImportMatchRecord_({ ...adapter.accounts[0], ownerId: 'LAITH' },
  [account], [link], {}).reason, 'OWNER_MISMATCH');
const child = { ...account, stableAccountId: 'DEBT-LAITH', ownerId: 'LAITH',
  registrationType: 'CUSTODIAL' };
assert.equal(context.debtImportValidateExplicitMatch_(adapter.accounts[0], child.stableAccountId,
  [child]).outcome, 'CONFLICT', 'child debt cannot merge into an adult debt identity');
const ambiguousAccount = { ...account, stableAccountId: 'DEBT-CITIAA-2' };
assert.equal(context.debtImportMatchRecord_(adapter.accounts[0], [account, ambiguousAccount], [], {}).outcome,
  'AMBIGUOUS');

const accountRows = [context.FINANCIAL_ACCOUNT_HEADERS_, [
  account.stableAccountId, 'DEBT', account.displayName, account.institution, account.accountType,
  'REVOLVING', 'SAMER', 'INDIVIDUAL', 'USD', '0393', 'Yes', 'VERIFIED',
  'INPUT_DEBTS', 'CitiAA', asOf, asOf
]];
const linkRows = [context.ACCOUNT_SOURCE_LINK_HEADERS_, [
  'LINK-FIXTURE', account.stableAccountId, 'FILE_IMPORT', adapter.sourceSystem,
  adapter.accounts[0].sourceAccountKey, '••••0393', account.institution, account.accountType,
  'VERIFIED', asOf, asOf
]];
const debtRows = [[
  'Account Name', 'Type', 'Account Balance', 'Due Date', 'Credit Limit',
  'Minimum Payment', 'Credit Left', 'Int Rate', 'Acct PCT Avail', 'Active', 'Linked Property'
], ['CitiAA', 'Credit Card', 9500, 25, 15000, 270, 5500, 22.99, 36.67, 'Yes', '']];
const fakeSs = new FakeSpreadsheet([
  new FakeSheet(context.getSheetNames_().FINANCIAL_ACCOUNTS, accountRows),
  new FakeSheet(context.getSheetNames_().ACCOUNT_SOURCE_LINKS, linkRows),
  new FakeSheet(context.getSheetNames_().DEBTS, debtRows)
]);
const policyBefore = JSON.stringify(debtRows[1]);
const preview = context.previewAuthoritativeDebtImport_(fakeSs, adapter, {}, asOf);
assert.equal(preview.summary.matched, 1);
assert.equal(preview.accounts[0].facts.CURRENT_BALANCE.difference, -500);
assert.equal(preview.accounts[0].facts.CURRENT_BALANCE.reconciliationStatus, 'DIFFERENCE_DETECTED');
assert.equal(preview.accounts[0].facts.CURRENT_BALANCE.materialityStatus, 'NOT_YET_DECIDED');
assert.equal(preview.accounts[0].facts.NEXT_PAYMENT_DATE.reconciliationStatus, 'UNAVAILABLE',
  'legacy due-day must not be falsely equated to a full authoritative date');
const applied = context.applyAuthoritativeDebtImport_(fakeSs, adapter, {}, preview.previewDigest, asOf);
assert.equal(applied.appendedFacts, 7);
assert.equal(JSON.stringify(fakeSs.getSheetByName(context.getSheetNames_().DEBTS).rows[1]), policyBefore,
  'import must not overwrite Part 1 debt configuration');
const manualDecisions = { [manual.accounts[0].sourceAccountKey]: {
  action: 'MATCH', stableAccountId: account.stableAccountId } };
const manualPreview = context.previewAuthoritativeDebtImport_(fakeSs, manual, manualDecisions, asOf);
const manualApplied = context.applyAuthoritativeDebtImport_(fakeSs, manual, manualDecisions,
  manualPreview.previewDigest, asOf);
assert.equal(manualApplied.appendedFacts, 1,
  'verified manual evidence may establish applicable APR through its dedicated authority path');
const replay = context.applyAuthoritativeDebtImport_(fakeSs, adapter, {}, preview.previewDigest, asOf);
assert.equal(replay.status, 'DUPLICATE_NOOP');
assert.equal(replay.appendedFacts, 0);
const shadow = context.getDebtImportShadowComparison_(fakeSs, [], asOf)[0];
assert.equal(shadow.facts.CURRENT_BALANCE.normalizedValue, 9000);
assert.equal(shadow.facts.APR.normalizedValue, 23.49);
assert.equal(shadow.facts.MINIMUM_PAYMENT.normalizedValue, 270);
assert.equal(shadow.facts.NEXT_PAYMENT_DATE.normalizedValue, '2026-08-25');
assert.equal(shadow.safeToAct, true);
const runRows = fakeSs.getSheetByName(context.getSheetNames_().IMPORT_RUNS).rows;
assert.equal(JSON.stringify(runRows).includes(rawAccount), false,
  'sanitized Import Runs must not retain a full card number');

const staleBalance = context.normalizeFinancialFact_(context.debtImportFinancialFact_(
  adapter.accounts[0], { ...adapter.accounts[0].facts[0], effectiveAsOf: '2026-08-04T00:00:00.000Z' },
  account.stableAccountId, 'STALE', false), { asOf, defaultCreatedAt: asOf });
const freshApr = context.selectCurrentFinancialFact_(context.readFinancialFacts_(fakeSs),
  account.stableAccountId, 'APR', asOf);
const freshMinimum = context.selectCurrentFinancialFact_(context.readFinancialFacts_(fakeSs),
  account.stableAccountId, 'MINIMUM_PAYMENT', asOf);
const freshDue = context.selectCurrentFinancialFact_(context.readFinancialFacts_(fakeSs),
  account.stableAccountId, 'NEXT_PAYMENT_DATE', asOf);
const staleComparisons = {
  CURRENT_BALANCE: { selection: context.selectCurrentFinancialFact_([staleBalance],
    account.stableAccountId, 'CURRENT_BALANCE', asOf) },
  APR: { selection: freshApr }, MINIMUM_PAYMENT: { selection: freshMinimum },
  NEXT_PAYMENT_DATE: { selection: freshDue }
};
const staleQuality = context.evaluateRevolvingDebtActionabilityFromComparisons_(staleComparisons, [], []);
assert.equal(staleQuality.safeToModel, true);
assert.equal(staleQuality.exactPayoffActionable, false,
  '12-day-old balance may model but must block exact payoff action');
const missingDueQuality = context.evaluateRevolvingDebtActionabilityFromComparisons_({
  CURRENT_BALANCE: { selection: context.selectCurrentFinancialFact_(
    context.readFinancialFacts_(fakeSs), account.stableAccountId, 'CURRENT_BALANCE', asOf) },
  APR: { selection: freshApr },
  MINIMUM_PAYMENT: { selection: freshMinimum },
  NEXT_PAYMENT_DATE: { selection: { fact: null,
    freshness: context.evaluateFinancialFactFreshness_(null, asOf) } }
}, [], []);
assert.equal(missingDueQuality.interestRankingReadiness, 'READY');
assert.equal(missingDueQuality.paymentObligationReadiness, 'NOT_READY',
  'a current minimum without an exact next-payment date is not payment-obligation ready');

const staleAprFact = context.normalizeFinancialFact_({ ...manualFact,
  factId: 'FACT-STALE-APR', effectiveAsOf: '2026-03-01T00:00:00.000Z' }, { asOf });
assert.equal(context.evaluateFinancialFactFreshness_(staleAprFact, asOf).status, 'STALE',
  'fresh balance must not refresh APR');
const zero = context.adaptStructuredDebtEvidence_({ sourceSystem: 'FIXTURE_ZERO', observedAt: asOf,
  accounts: [{ externalAccountId: 'ZERO-0000', currentBalance: 0, effectiveAsOf: asOf,
    ownerId: 'SAMER', registrationType: 'INDIVIDUAL', rates: [] }] });
assert.equal(zero.accounts[0].facts[0].numericValue, 0,
  'authoritative current zero balance must be representable');

const conflictA = context.normalizeFinancialFact_({ ...manualFact, factId: 'FACT-APR-A',
  numericValue: 23.49, sourceRecordKey: `sha256:${'a'.repeat(64)}` }, { asOf });
const conflictB = context.normalizeFinancialFact_({ ...manualFact, factId: 'FACT-APR-B',
  numericValue: 24.49, sourceRecordKey: `sha256:${'b'.repeat(64)}` }, { asOf });
assert.equal(context.selectCurrentFinancialFact_([conflictA, conflictB], account.stableAccountId,
  'APR', asOf).reconciliationStatus, 'CONFLICT',
  'equal-quality conflicting APRs must remain conflict');

const cashAccount = ['CASH-FIXTURE', 'CASH', 'Fixture Cash', 'Fixture Bank', 'Checking', '',
  'SAMER', 'INDIVIDUAL', 'USD', '1111', 'Yes', 'VERIFIED', '', '', asOf, asOf];
fakeSs.getSheetByName(context.getSheetNames_().FINANCIAL_ACCOUNTS).rows.push(cashAccount);
context.appendFinancialFacts_(fakeSs, [{ stableInternalAccountId: 'CASH-FIXTURE',
  factType: 'CURRENT_BALANCE', numericValue: 20000, currencyOrUnit: 'USD', effectiveAsOf: asOf,
  observedAt: asOf, sourceType: 'MANUAL', sourceSystem: 'FIXTURE',
  sourceRecordKey: `sha256:${'c'.repeat(64)}`, authorityClass: 'USER_VERIFIED_MANUAL',
  verificationStatus: 'VERIFIED', verifiedAt: asOf, manualOverride: true,
  reconciliationStatus: 'MATCHED' }], { asOf, defaultCreatedAt: asOf });
context.appendFinancialFacts_(fakeSs, [{ stableInternalAccountId: 'INV-STALE',
  factType: 'POSITION_QUANTITY', numericValue: 1, currencyOrUnit: 'SHARES',
  effectiveAsOf: '2020-01-01T00:00:00.000Z', observedAt: asOf, sourceType: 'MANUAL',
  sourceSystem: 'FIXTURE', sourceRecordKey: `sha256:${'d'.repeat(64)}`,
  authorityClass: 'USER_VERIFIED_MANUAL', verificationStatus: 'VERIFIED', verifiedAt: asOf,
  manualOverride: true, reconciliationStatus: 'MATCHED' }], { asOf, defaultCreatedAt: asOf });
const readiness = context.evaluateWeeklyPlanDataReadiness_(fakeSs, asOf);
assert.equal(readiness.scope, 'CURRENT_CASH_AND_REVOLVING_DEBT_ONLY');
assert.equal(readiness.overall, 'READY_FOR_AUTHORITY_SWITCH_REVIEW');
assert.equal(JSON.stringify(readiness).includes('INV-STALE'), false,
  'unrelated brokerage staleness must not block weekly cash/debt readiness');
assert.equal(readiness.authoritySwitched, false);

const planningSource = fs.readFileSync(new URL('../capital_allocation.js', import.meta.url), 'utf8');
assert.doesNotMatch(planningSource, /debt_import|evaluateWeeklyPlanDataReadiness_|DEBT_EVIDENCE_V1/,
  'Part 2A-4 must not wire normalized debt evidence into Planning');
assert.match(planningSource, /PAY_DEBT_MINIMUM/,
  'existing required-minimum lifecycle remains in Part 1');
const suiteSource = fs.readFileSync(new URL('../test_harness_suites.js', import.meta.url), 'utf8');
assert.match(suiteSource, /SUITE-PART-2A-AUTHORITATIVE-REVOLVING-DEBT/,
  'dedicated disposable Central suite must remain registered');
assert.match(suiteSource, /function testRunPart2aAuthoritativeDebtSuite\(options\)/,
  'isolated Central must expose an argument-free guarded suite runner');
assert.match(suiteSource, /requested\.dispositionMode = 'trash'/,
  'argument-free Part 2A debt suite runs must default to Trash cleanup');

console.log('Debt import regressions passed.');
