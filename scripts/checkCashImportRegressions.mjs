import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import vm from 'node:vm';

const sources = ['config.js', 'financial_identity.js', 'financial_facts.js', 'cash_import.js']
  .map((name) => [name, fs.readFileSync(new URL(`../${name}`, import.meta.url), 'utf8')]);
let uuidSequence = 0;
const context = {
  Utilities: {
    DigestAlgorithm: { SHA_256: 'SHA_256' }, Charset: { UTF_8: 'UTF_8' },
    computeDigest(_algorithm, value) {
      return [...crypto.createHash('sha256').update(String(value), 'utf8').digest()]
        .map((byte) => byte > 127 ? byte - 256 : byte);
    },
    getUuid() { uuidSequence += 1; return `fixture-${uuidSequence}`; },
    formatDate(value) { return new Date(value).toISOString(); }
  },
  Session: { getScriptTimeZone() { return 'America/Los_Angeles'; } },
  SpreadsheetApp: { flush() {} },
  console
};
vm.createContext(context);
for (const [name, source] of sources) vm.runInContext(source, context, { filename: name });

const observedAt = '2026-08-16T16:00:00.000Z';
const ofx = `OFXHEADER:100
DATA:OFXSGML
VERSION:102

<OFX>
<SIGNONMSGSRSV1><SONRS><FI><ORG>Ally Bank</ORG><FID>99999</FID></FI></SONRS></SIGNONMSGSRSV1>
<BANKMSGSRSV1><STMTTRNRS><STMTRS>
<CURDEF>USD
<BANKACCTFROM><BANKID>124003116<ACCTID>123456789012<ACCTTYPE>SAVINGS</BANKACCTFROM>
<BANKTRANLIST><DTSTART>20260801000000[-5:EST]<DTEND>20260816000000[-5:EST]</BANKTRANLIST>
<LEDGERBAL><BALAMT>30411.01<DTASOF>20260816073000[-5:EST]</LEDGERBAL>
<AVAILBAL><BALAMT>30300.00<DTASOF>20260816073000[-5:EST]</AVAILBAL>
</STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;
const adapted = context.adaptOfxCashEvidence_(ofx, { observedAt, ownerId: 'SAMER',
  registrationType: 'INDIVIDUAL' });
assert.equal(adapted.accounts.length, 1);
assert.equal(adapted.accounts[0].facts.find((fact) => fact.factType === 'CURRENT_BALANCE').numericValue,
  30411.01, 'QFX ledger balance must become CURRENT_BALANCE');
assert.equal(adapted.accounts[0].facts.find((fact) => fact.factType === 'AVAILABLE_BALANCE').numericValue,
  30300, 'explicit available balance must be retained');
assert.equal(adapted.accounts[0].facts.some((fact) => fact.factType === 'APY'), false,
  'APY must never be invented from a balance export');
const explicitApy = context.adaptOfxCashEvidence_(ofx.replace(
  '<AVAILBAL>', '<APY>4.20<AVAILBAL>'), { observedAt });
assert.equal(explicitApy.accounts[0].facts.find((fact) => fact.factType === 'APY').numericValue,
  4.2, 'APY must be imported only when the source explicitly supplies it');
assert.match(adapted.accounts[0].sourceAccountKey, /^sha256:[a-f0-9]{64}$/);
assert.equal(JSON.stringify(adapted).includes('123456789012'), false,
  'normalized adapter output must not retain a raw account number');
assert.equal(adapted.accounts[0].facts[0].effectiveAsOf, '2026-08-16T12:30:00.000Z',
  'OFX offset timestamps must retain their exact instant');

assert.throws(() => context.adaptOfxCashEvidence_(ofx.replace(
  '<LEDGERBAL><BALAMT>30411.01<DTASOF>20260816073000[-5:EST]</LEDGERBAL>', ''),
  { observedAt }), /no authoritative ledger balance/i,
  'transaction-only files must not imply an account balance');

const missingDate = context.adaptOfxCashEvidence_(ofx.replace(
  '<DTASOF>20260816073000[-5:EST]', ''), { observedAt });
assert.equal(missingDate.accounts[0].facts[0].effectiveAsOf, '',
  'missing source-effective time must remain blank');
const missingDateFact = context.normalizeFinancialFact_(context.cashImportFinancialFact_(
  missingDate.accounts[0], missingDate.accounts[0].facts[0], 'CASH-FIXTURE', 'PREVIEW', false),
  { asOf: observedAt, defaultCreatedAt: observedAt });
assert.equal(context.evaluateFinancialFactFreshness_(missingDateFact, observedAt).status, 'UNKNOWN');
assert.equal(missingDateFact.authorityClass, 'FILE_IMPORTED');
assert.equal(missingDateFact.verificationStatus, 'REVIEW_REQUIRED');

const account = { stableAccountId: 'CASH-SAMER-ALLY', domain: 'CASH', displayName: 'Samer Ally',
  institution: 'Ally Bank', accountType: 'Savings', ownerId: 'SAMER',
  registrationType: 'INDIVIDUAL', last4: '9012' };
const exactLink = { stableAccountId: account.stableAccountId, sourceSystem: adapted.sourceSystem,
  sourceAccountKey: adapted.accounts[0].sourceAccountKey, linkStatus: 'VERIFIED' };
assert.equal(context.cashImportMatchRecord_(adapted.accounts[0], [account], [exactLink], {}).outcome,
  'EXACT_LINK', 'verified source identity must match deterministically');
const conflicting = { ...adapted.accounts[0], ownerId: 'LAITH' };
assert.equal(context.cashImportMatchRecord_(conflicting, [account], [exactLink], {}).reason,
  'OWNER_MISMATCH', 'owner conflicts must fail closed even with a source link');

const noLink = context.cashImportMatchRecord_(adapted.accounts[0], [account], [], {});
assert.notEqual(noLink.outcome, 'EXACT_LINK');
assert.equal(context.cashImportPreviewAction_(noLink, {}), 'REVIEW_REQUIRED',
  'institution/name resemblance must never auto-merge accounts');
const sameInstitution = { ...account, stableAccountId: 'CASH-SAMER-ALLY-2' };
assert.equal(context.cashImportMatchRecord_(adapted.accounts[0], [account, sameInstitution], [], {}).outcome,
  'AMBIGUOUS', 'same-institution accounts must not merge from institution and last four');

class FakeRange {
  constructor(sheet, row, col, numRows = 1, numCols = 1) {
    this.sheet = sheet; this.row = row; this.col = col; this.numRows = numRows; this.numCols = numCols;
  }
  getValues() { return this.read(); }
  getDisplayValues() { return this.read().map((row) => row.map((value) => String(value ?? ''))); }
  read() {
    return Array.from({ length: this.numRows }, (_, r) =>
      Array.from({ length: this.numCols }, (_, c) => this.sheet.rows[this.row - 1 + r]?.[this.col - 1 + c] ?? ''));
  }
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
  getRange(row, col, numRows = 1, numCols = 1) { return new FakeRange(this, row, col, numRows, numCols); }
  getDataRange() { return this.getRange(1, 1, Math.max(1, this.getLastRow()), Math.max(1, this.getLastColumn())); }
  appendRow(row) { this.rows.push([...row]); }
  setFrozenRows() {}
}
class FakeSpreadsheet {
  constructor(sheets = []) { this.sheets = new Map(sheets.map((sheet) => [sheet.getName(), sheet])); }
  getSheetByName(name) { return this.sheets.get(name) || null; }
  insertSheet(name) { const sheet = new FakeSheet(name); this.sheets.set(name, sheet); return sheet; }
  getSheets() { return [...this.sheets.values()]; }
}
const accountRows = [context.FINANCIAL_ACCOUNT_HEADERS_, [
  account.stableAccountId, 'CASH', account.displayName, account.institution, account.accountType,
  '', 'SAMER', 'INDIVIDUAL', 'USD', '9012', 'Yes', 'VERIFIED', '', '', observedAt, observedAt
]];
const linkRows = [context.ACCOUNT_SOURCE_LINK_HEADERS_, [
  'LINK-FIXTURE', account.stableAccountId, 'FILE_IMPORT', adapted.sourceSystem,
  adapted.accounts[0].sourceAccountKey, '••••9012', account.institution, account.accountType,
  'VERIFIED', observedAt, observedAt
]];
const fakeSs = new FakeSpreadsheet([
  new FakeSheet(context.getSheetNames_().FINANCIAL_ACCOUNTS, accountRows),
  new FakeSheet(context.getSheetNames_().ACCOUNT_SOURCE_LINKS, linkRows)
]);
const preview = context.previewAuthoritativeCashImport_(fakeSs, adapted, {}, observedAt);
assert.equal(preview.summary.matched, 1);
assert.equal(preview.accounts[0].action, 'MATCH');
assert.ok(preview.accounts[0].diagnostics.includes('CASH_YIELD_DATA_REQUIRED'));
const applied = context.applyAuthoritativeCashImport_(fakeSs, adapted, {}, preview.previewDigest, observedAt);
assert.equal(applied.appendedFacts, 2);
assert.equal(fakeSs.getSheetByName(context.getSheetNames_().FINANCIAL_FACTS).getLastRow(), 3);
const shadow = context.getCashImportShadowComparison_(fakeSs, [], observedAt);
assert.equal(shadow[0].normalizedValue, 30411.01);
assert.equal(shadow[0].legacyValue, null);
assert.equal(shadow[0].freshness, 'CURRENT');
const selectedWithUnknownLegacy = context.selectCurrentFinancialFact_([
  context.financialFactFromLegacyValue_({ stableInternalAccountId: account.stableAccountId,
    factType: 'CURRENT_BALANCE', numericValue: 99999, currencyOrUnit: 'USD', asOf: observedAt }),
  ...context.readFinancialFacts_(fakeSs)
], account.stableAccountId, 'CURRENT_BALANCE', observedAt);
assert.equal(selectedWithUnknownLegacy.fact.numericValue, 30411.01,
  'authoritative current evidence must outrank unknown-date legacy evidence');
const replay = context.applyAuthoritativeCashImport_(fakeSs, adapted, {}, preview.previewDigest, observedAt);
assert.equal(replay.status, 'DUPLICATE_NOOP');
assert.equal(replay.appendedFacts, 0);

const verifiedManual = context.adaptVerifiedManualCashEvidence_({
  stableAccountId: 'CASH-SAMER-ALLY', displayName: 'Samer Ally', currentBalance: 30411.01,
  effectiveAsOf: '2026-08-16T07:30:00-05:00', currency: 'USD'
}, { observedAt });
const manualFact = context.cashImportFinancialFact_(verifiedManual.accounts[0],
  verifiedManual.accounts[0].facts[0], 'CASH-SAMER-ALLY', 'IMPORT-MANUAL', true);
assert.equal(manualFact.authorityClass, 'USER_VERIFIED_MANUAL');
assert.equal(manualFact.manualOverride, true);
assert.throws(() => context.adaptVerifiedManualCashEvidence_({
  stableAccountId: 'CASH-SAMER-ALLY', currentBalance: 1
}, { observedAt }), /effective date is required/i);

assert.equal(context.CASH_IMPORT_RECONCILIATION_POLICY_V1_.currencyMinorUnit, 0.01,
  'exact reconciliation precision must be centralized and currency-based');
assert.equal(context.CASH_IMPORT_MATERIALITY_POLICY_V1_.status, 'NOT_YET_DECIDED',
  'planning materiality must remain explicit rather than inventing a threshold');
assert.deepEqual(JSON.parse(JSON.stringify(context.cashImportReconcileValues_(100, 100))), {
  difference: 0, exactStatus: 'EXACT_MATCH', materialityStatus: 'NOT_YET_DECIDED'
}, 'exact equality must remain distinct from a difference');
assert.deepEqual(JSON.parse(JSON.stringify(context.cashImportReconcileValues_(100, 99.99))), {
  difference: -0.01, exactStatus: 'DIFFERENCE_DETECTED', materialityStatus: 'NOT_YET_DECIDED'
}, 'a one-cent difference must remain quantified and visible without a materiality claim');
assert.deepEqual(JSON.parse(JSON.stringify(context.cashImportReconcileValues_(30411, 29850))), {
  difference: -561, exactStatus: 'DIFFERENCE_DETECTED', materialityStatus: 'NOT_YET_DECIDED'
}, 'the worked $561 difference must remain quantified and visible');
assert.ok(context.cashImportRecordDiagnostics_(adapted.accounts[0], { outcome: 'EXACT_LINK' },
  adapted.accounts[0].facts[0]).includes('CASH_YIELD_DATA_REQUIRED'));

const bankImportSource = fs.readFileSync(new URL('../bank_import.js', import.meta.url), 'utf8');
assert.match(bankImportSource, /bankImportProtectedRecord_\(normalized\)/,
  'legacy staging must protect incoming identifiers before persistence');
assert.match(bankImportSource, /externalAccountKey = bankImportProtectedExternalId_/,
  'legacy Activity details must store a protected key');
const planningSource = fs.readFileSync(new URL('../capital_allocation.js', import.meta.url), 'utf8');
assert.doesNotMatch(planningSource, /readPlanningFinancialFacts_|SYS - Financial Facts/,
  'Part 2A-3 must not switch Planning to Financial Facts');

const suiteSource = fs.readFileSync(new URL('../test_harness_suites.js', import.meta.url), 'utf8');
assert.match(suiteSource, /SUITE-PART-2A-AUTHORITATIVE-CASH-IMPORT/,
  'dedicated disposable Central suite must remain registered');

console.log('Cash import regressions passed.');
