import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import vm from 'node:vm';

const configSource = fs.readFileSync(new URL('../config.js', import.meta.url), 'utf8');
const identitySource = fs.readFileSync(new URL('../financial_identity.js', import.meta.url), 'utf8');
const bankSource = fs.readFileSync(new URL('../bank_import.js', import.meta.url), 'utf8');
const dashboardSource = fs.readFileSync(
  new URL('../Dashboard_Script_AssetsBankInvestments.html', import.meta.url), 'utf8');
const planningSource = fs.readFileSync(new URL('../capital_allocation.js', import.meta.url), 'utf8');
const harnessSource = fs.readFileSync(
  new URL('../test_harness_scenarios_rfp.js', import.meta.url), 'utf8');
const contractSource = fs.readFileSync(
  new URL('../PART_2A_IDENTITY_CONTRACT.md', import.meta.url), 'utf8');

let uuidCounter = 0;
const context = {
  Utilities: {
    DigestAlgorithm: { SHA_256: 'SHA_256' },
    Charset: { UTF_8: 'UTF_8' },
    computeDigest(_algorithm, value) {
      return [...crypto.createHash('sha256').update(String(value), 'utf8').digest()]
        .map((byte) => byte > 127 ? byte - 256 : byte);
    },
    getUuid() { uuidCounter += 1; return `00000000-0000-4000-8000-${String(uuidCounter).padStart(12, '0')}`; },
    formatDate(value, _timeZone, pattern) {
      const iso = new Date(value).toISOString();
      return pattern === 'yyyy-MM-dd HH:mm:ss' ? iso.slice(0, 19).replace('T', ' ') : iso;
    }
  },
  console
};
vm.createContext(context);
vm.runInContext(configSource, context, { filename: 'config.js' });
vm.runInContext(identitySource, context, { filename: 'financial_identity.js' });

const baseAccount = {
  stableAccountId: 'CASH-1', domain: 'CASH', institution: 'Example Bank',
  last4: '1234', ownerId: 'SAMER', registrationType: 'INDIVIDUAL'
};
const raw = {
  sourceType: 'OFX', sourceSystem: 'Example Bank', externalAccountId: 'RAW-SECRET-1234',
  institution: 'Example Bank', displayName: 'Renamed checking', last4: '1234',
  domain: 'CASH', accountType: 'Checking', ownerId: 'SAMER',
  registrationType: 'INDIVIDUAL', currency: 'USD'
};
const normalized = context.normalizeFinancialIdentityAdapterRecord_(raw);
assert.match(normalized.sourceAccountKey, /^sha256:[a-f0-9]{64}$/);
assert.equal(JSON.stringify(normalized).includes(raw.externalAccountId), false,
  'normalized identity output must not retain the raw external identifier');
assert.equal(normalized.maskedIdentifier, '••••1234');

const exactLink = {
  stableAccountId: 'CASH-1', sourceSystem: 'Example Bank',
  sourceAccountKey: normalized.sourceAccountKey, linkStatus: 'VERIFIED'
};
assert.equal(context.matchFinancialIdentityAdapterRecord_(raw, [baseAccount], [exactLink]).outcome,
  'EXACT_LINK', 'a rename must not break an exact verified source link');

const duplicateAccounts = [baseAccount, { ...baseAccount, stableAccountId: 'CASH-2' }];
assert.equal(context.matchFinancialIdentityAdapterRecord_(raw, duplicateAccounts, []).outcome,
  'AMBIGUOUS', 'institution and last4 must never auto-merge duplicate accounts');

const ownerMismatch = { ...raw, ownerId: 'LAITH', registrationType: 'CUSTODIAL' };
assert.equal(context.matchFinancialIdentityAdapterRecord_(ownerMismatch, [baseAccount], [exactLink]).outcome,
  'CONFLICT', 'child/adult owner mismatch must fail closed');

assert.equal(context.matchFinancialIdentityAdapterRecord_(raw, [baseAccount], [exactLink, exactLink]).outcome,
  'AMBIGUOUS', 'multiple verified links for the same source key must fail closed');

const statementAccount = {
  stableAccountId: 'DEBT-CHASE', domain: 'DEBT', institution: 'Chase',
  accountType: 'Credit Card', active: 'Yes', identityStatus: 'VERIFIED',
  last4: '2468', ownerId: 'SAMER', registrationType: 'INDIVIDUAL'
};
const unconfirmedStatement = context.resolveConfirmedStatementSourceAssociation_({
  profileVersion: 'CHASE_STATEMENT_V1', confirmed: false, last4: '2468'
}, [statementAccount], []);
assert.equal(unconfirmedStatement.outcome, 'REVIEW_REQUIRED',
  'last four alone must never authorize a statement source link');
assert.throws(() => context.resolveConfirmedStatementSourceAssociation_({
  profileVersion: 'OTHER_STATEMENT_V1', confirmed: true,
  stableAccountId: statementAccount.stableAccountId
}, [statementAccount], []), /Unsupported Chase V1 statement profile/,
  'the Chase V1 association helper must fail closed for other statement profiles');
const confirmedStatement = context.resolveConfirmedStatementSourceAssociation_({
  profileVersion: 'CHASE_STATEMENT_V1', confirmed: true,
  stableAccountId: statementAccount.stableAccountId, last4: '2468', institution: 'Chase',
  protectedQfxAccountKey: `sha256:${'a'.repeat(64)}`
}, [statementAccount], [{
  sourceType: 'QFX', sourceSystem: 'CHASE_QFX_FID_10898_V1',
  sourceAccountKey: `sha256:${'a'.repeat(64)}`,
  stableAccountId: statementAccount.stableAccountId, linkStatus: 'VERIFIED'
}]);
assert.equal(confirmedStatement.outcome, 'EXPLICIT_CONFIRMED');
assert.equal(confirmedStatement.sourceLink.sourceType, 'STATEMENT');
assert.match(confirmedStatement.sourceLink.sourceAccountKey, /^sha256:[a-f0-9]{64}$/);
assert.equal(JSON.stringify(confirmedStatement).includes('4111111111112468'), false,
  'statement association output must not expose a raw account identifier');
assert.equal(context.resolveConfirmedStatementSourceAssociation_({
  profileVersion: 'CHASE_STATEMENT_V1', confirmed: true,
  stableAccountId: statementAccount.stableAccountId,
  protectedQfxAccountKey: `sha256:${'b'.repeat(64)}`
}, [statementAccount], []).reason, 'QFX_LINK_NOT_VERIFIED',
  'a caller-supplied protected QFX key must not authorize statement association');
assert.equal(context.resolveConfirmedStatementSourceAssociation_({
  profileVersion: 'CHASE_STATEMENT_V1', confirmed: true,
  stableAccountId: statementAccount.stableAccountId
}, [{ ...statementAccount, active: 'No' }], []).reason, 'ACCOUNT_INACTIVE');
assert.equal(context.resolveConfirmedStatementSourceAssociation_({
  profileVersion: 'CHASE_STATEMENT_V1', confirmed: true,
  stableAccountId: statementAccount.stableAccountId
}, [{ ...statementAccount, active: '' }], []).reason, 'ACCOUNT_INACTIVE',
  'a missing or unknown Active value must fail closed');
assert.equal(context.resolveConfirmedStatementSourceAssociation_({
  profileVersion: 'CHASE_STATEMENT_V1', confirmed: true,
  stableAccountId: statementAccount.stableAccountId
}, [statementAccount, { ...statementAccount }], []).outcome, 'AMBIGUOUS',
  'an ambiguous explicit statement target must fail closed');
assert.equal(context.resolveConfirmedStatementSourceAssociation_({
  profileVersion: 'CHASE_STATEMENT_V1', confirmed: true,
  stableAccountId: statementAccount.stableAccountId
}, [{ ...statementAccount, identityStatus: 'REVIEW_REQUIRED' }], []).reason,
  'IDENTITY_NOT_VERIFIED', 'a stale or review-required statement target must fail closed');

assert.equal(context.financialIdentityEffectiveStatus_({
  identityStatus: '', ownerId: 'SAMER', registrationType: 'INDIVIDUAL'
}), 'VERIFIED', 'blank identity status with known owner resolves to verified');
assert.equal(context.financialIdentityEffectiveStatus_({
  identityStatus: '', ownerId: 'UNKNOWN_REVIEW_REQUIRED', registrationType: 'INDIVIDUAL'
}), 'REVIEW_REQUIRED', 'blank identity status with unknown owner fails closed');
assert.equal(context.financialIdentityEffectiveStatus_({
  identityStatus: 'CONFLICT', ownerId: 'SAMER', registrationType: 'INDIVIDUAL'
}), 'CONFLICT', 'explicit identity status is preserved');
assert.equal(context.financialIdentityIsVerifiedForMatching_({
  identityStatus: '', ownerId: 'SAMER', registrationType: 'INDIVIDUAL'
}), true, 'verified effective status allows canonical matching');
assert.equal(context.financialIdentityIsVerifiedForMatching_({
  identityStatus: 'REVIEW_REQUIRED', ownerId: 'SAMER', registrationType: 'INDIVIDUAL'
}), false, 'review-required status blocks strict verified matching');
assert.equal(context.financialIdentityIsEligibleExplicitComparisonTarget_({
  stableAccountId: 'DEBT-1', domain: 'DEBT', ownerId: 'UNKNOWN_REVIEW_REQUIRED',
  registrationType: 'UNKNOWN', identityStatus: 'REVIEW_REQUIRED', active: 'Yes',
  accountType: 'Credit Card', legacyDomain: 'INPUT_DEBTS', legacyKey: 'Chase'
}), true, 'registry debt rows stay eligible for explicit stable-id mapping');
assert.equal(context.financialIdentityIsEligibleExplicitComparisonTarget_({
  stableAccountId: 'DEBT-1', domain: 'DEBT', ownerId: 'SAMER', registrationType: 'INDIVIDUAL',
  identityStatus: 'CONFLICT', active: 'Yes', accountType: 'Credit Card'
}), false, 'conflict identity stays ineligible for explicit mapping');

assert.match(context.financialIdentityGenerateStableAccountId_('CASH'), /^CASH-/);
assert.match(context.financialIdentityGenerateStableAccountId_('DEBT'), /^DEBT-/);
assert.match(context.financialIdentityGenerateStableAccountId_('INVESTMENT'), /^INV-/);
assert.match(context.financialIdentityGenerateStableAccountId_('RETIREMENT'), /^RET-/);
assert.match(context.financialIdentityGenerateStableAccountId_('PROPERTY'), /^PROP-/);

assert.match(identitySource,
  /var investmentId = idCol[\s\S]*?financialIdentityLegacyCandidate_\(domain, 'SYS_ASSETS',[\s\S]*?investmentId \|\| name[\s\S]*?investmentId/,
  'existing Investment Id values must be adopted rather than regenerated');
assert.match(identitySource, /DUPLICATE_INVESTMENT_ID/);
assert.match(identitySource, /UNKNOWN_REVIEW_REQUIRED/);
assert.match(identitySource, /OWNER_OR_REGISTRATION_MISMATCH/);
assert.doesNotMatch(planningSource, /FINANCIAL_ACCOUNTS|ACCOUNT_SOURCE_LINKS|SYS - Financial Accounts/,
  'Part 2A-1 must not switch Planning to the new registry');
assert.doesNotMatch(identitySource, /setValue\([^\n]*(Use Policy|Min Buffer|Planning Role)/,
  'identity migration must not write household policy fields');
assert.match(harnessSource,
  /getHarnessRfpInvestmentMetadataScenario_[\s\S]*?executionLevel: 'INTEGRATION'/,
  'Investment Metadata must remain an integration scenario');
assert.match(harnessSource,
  /getHarnessPart2aFinancialIdentityScenario_[\s\S]*?executionLevel: 'PURE'/,
  'Part 2A identity matcher must remain a pure scenario');

for (const header of ['Stable Account Id', 'Owner Id', 'Registration Type', 'Legacy Key']) {
  assert.ok(context.FINANCIAL_ACCOUNT_HEADERS_.includes(header), `missing account header ${header}`);
}
for (const header of ['Stable Account Id', 'Source Account Key', 'Masked Identifier', 'Link Status']) {
  assert.ok(context.ACCOUNT_SOURCE_LINK_HEADERS_.includes(header), `missing link header ${header}`);
}

assert.match(bankSource, /function bankImportProtectedExternalId_/);
assert.match(bankSource, /bankImportProtectedRecord_\(normalized\)/,
  'pending staging writes must use a protected record');
assert.doesNotMatch(bankSource, /details\.externalAccountId\s*=/,
  'new bank activity details must not persist a raw external identifier');
assert.doesNotMatch(bankSource, /externalAccountId:\s*stagedRow\.externalAccountId/,
  'review/apply activity details must not persist a raw external identifier');
assert.match(bankSource, /externalAccountKey:/);
assert.match(bankSource, /maskedIdentifier:/);
assert.match(dashboardSource, /account identifier/);
assert.match(dashboardSource, /suppliedLast4 \? '••••'/);
assert.doesNotMatch(dashboardSource, /ext\.slice\(/,
  'bank import preview must not render any portion of a raw identifier');

for (const phrase of [
  'Authority and freshness are fact-level', 'Effective As Of', 'Observed At',
  'never overwrite user-controlled policy', 'Planning remains on its existing readers'
]) assert.ok(contractSource.includes(phrase), `contract missing: ${phrase}`);
assert.match(contractSource, /Chase V1[\s\S]*explicit customer confirmation/,
  'identity contract must pin explicit Chase V1 statement association');

assert.match(identitySource, /function runFinancialIdentityFoundationPreview\(/);
assert.match(identitySource, /function runFinancialIdentityFoundationApply\(/);
assert.match(identitySource, /getFinancialIdentityFoundationPreviewFromDashboard\(\)/);
assert.match(identitySource, /applyFinancialIdentityFoundationFromDashboard\(\{ previewDigest: digest \}\)/);
assert.doesNotMatch(identitySource,
  /function runFinancialIdentityFoundationApply[\s\S]*?getFinancialIdentityFoundationPreviewFromDashboard\(\)[\s\S]*?applyFinancialIdentityFoundationFromDashboard/,
  'apply helper must not preview-and-apply in one step');
assert.match(identitySource, /financialIdentityFoundationSanitizePreviewResult_/);
assert.match(identitySource, /financialIdentityFoundationSanitizeApplyResult_/);
assert.match(identitySource, /row\.action !== 'EXISTING' && row\.action !== 'CONFLICT'/,
  'identity foundation apply must skip existing and conflict rows for idempotency');

assert.match(identitySource, /function ensureFinancialIdentityFoundationForConnectedAccounts_\(/);
assert.match(identitySource, /financialIdentityFoundationPendingCount_/);
assert.match(identitySource, /throw new Error\('FINANCIAL_IDENTITY_REVIEW_REQUIRED'\)/);
assert.match(identitySource,
  /if \(financialIdentityFoundationPendingCount_\(preview\.summary\) <= 0\)[\s\S]*?ALREADY_INITIALIZED/,
  'connected self-init must no-op when the registry is already initialized');
assert.match(identitySource, /financialIdentityApplyFirstCreateStyle_/);
assert.match(identitySource, /applySysSheetBaseStyle_/);
assert.match(identitySource, /if \(!linkSheet\) linkSheet = ensureAccountSourceLinksSheet_/,
  'identity apply must defer link-sheet ensure until a source link is written');
assert.match(identitySource, /financialIdentityRollbackPartialApply_/);
assert.doesNotMatch(identitySource,
  /var linkSheet = ensureAccountSourceLinksSheet_\(ss\);\s*var now = Utilities\.formatDate/,
  'identity apply must not require link sheet before writing account rows');

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
  deleteSheet(sheet) { this.sheets.delete(sheet.getName()); }
  getSheets() { return [...this.sheets.values()]; }
}

context.LockService = {
  getDocumentLock() {
    return { waitLock() {}, releaseLock() {} };
  }
};
context.applySysSheetBaseStyle_ = function(sheet) {
  sheet.sysStyled = true;
};
context.Session = { getScriptTimeZone() { return 'America/Los_Angeles'; } };
context.SpreadsheetApp = { flush() {} };

function cloneSheetRows(sheet) {
  return sheet.rows.map((row) => [...row]);
}

const debtHeaders = ['Account Name', 'Type', 'Active'];
const populatedDebts = new FakeSheet('INPUT - Debts', [
  debtHeaders,
  ['Chase Card', 'Credit Card', 'Yes'],
  ['Mortgage Main', 'Mortgage', 'Yes']
]);
const populatedWorkbook = new FakeSpreadsheet([populatedDebts]);
const debtsBeforeInit = cloneSheetRows(populatedDebts);

const firstInit = context.ensureFinancialIdentityFoundationForConnectedAccounts_(populatedWorkbook);
assert.equal(firstInit.ok, true);
assert.equal(firstInit.applied, true);
assert.equal(firstInit.reason, 'INITIALIZED');
assert.deepEqual(cloneSheetRows(populatedDebts), debtsBeforeInit,
  'connected self-init must not rewrite INPUT - Debts');
const registrySheet = populatedWorkbook.getSheetByName('SYS - Financial Accounts');
assert.ok(registrySheet, 'conflict-free first Connected use must create the identity registry');
assert.equal(registrySheet.getLastRow(), 1 + populatedDebts.getLastRow() - 1,
  'registry rows must mirror active legacy debt candidates');
const registryRowsAfterFirst = registrySheet.getLastRow();

const secondInit = context.ensureFinancialIdentityFoundationForConnectedAccounts_(populatedWorkbook);
assert.equal(secondInit.applied, false);
assert.equal(secondInit.reason, 'ALREADY_INITIALIZED');
assert.equal(registrySheet.getLastRow(), registryRowsAfterFirst,
  'second Connected use must not append additional identity rows');

const duplicateDebts = new FakeSheet('INPUT - Debts', [
  debtHeaders,
  ['Chase', 'Credit Card', 'Yes'],
  ['Chase', 'Credit Card', 'Yes']
]);
const conflictWorkbook = new FakeSpreadsheet([duplicateDebts]);
const conflictDebtsBefore = cloneSheetRows(duplicateDebts);
assert.throws(
  () => context.ensureFinancialIdentityFoundationForConnectedAccounts_(conflictWorkbook),
  /FINANCIAL_IDENTITY_REVIEW_REQUIRED/,
  'identity conflicts must fail closed without mutation');
assert.equal(conflictWorkbook.getSheetByName('SYS - Financial Accounts'), null,
  'conflict review must leave an absent registry untouched');
assert.deepEqual(cloneSheetRows(duplicateDebts), conflictDebtsBefore,
  'conflict review must not rewrite INPUT - Debts');

const existingRegistry = new FakeSheet('SYS - Financial Accounts', [
  context.FINANCIAL_ACCOUNT_HEADERS_,
  ['DEBT-EXISTING', 'DEBT', 'Chase Card', '', 'Credit Card', '', 'SAMER', 'INDIVIDUAL',
    'USD', '', 'Yes', 'VERIFIED', 'INPUT_DEBTS', 'Chase Card', '2026-01-01', '2026-01-01']
]);
const partialWorkbook = new FakeSpreadsheet([
  new FakeSheet('INPUT - Debts', [
    debtHeaders,
    ['Chase Card', 'Credit Card', 'Yes'],
    ['New Loan', 'Loan', 'Yes']
  ]),
  existingRegistry
]);
const existingRowsBefore = existingRegistry.getLastRow();
const partialInit = context.ensureFinancialIdentityFoundationForConnectedAccounts_(partialWorkbook);
assert.equal(partialInit.applied, true);
assert.equal(existingRegistry.getLastRow(), existingRowsBefore + 1,
  'self-init must append only missing registry rows');
assert.equal(existingRegistry.rows[1][0], 'DEBT-EXISTING',
  'existing registry rows must remain unchanged');

const digestWorkbook = new FakeSpreadsheet([populatedDebts]);
const digestPreview = context.buildFinancialIdentityFoundationPreview_(digestWorkbook);
context.ensureFinancialAccountsSheet_(digestWorkbook);
const digestAfterHeader = context.buildFinancialIdentityFoundationPreview_(digestWorkbook);
assert.equal(digestAfterHeader.digest, digestPreview.digest,
  'creating the identity registry header must not invalidate the preview digest');

const placeholderLinksWorkbook = new FakeSpreadsheet([
  new FakeSheet('INPUT - Debts', [
    debtHeaders,
    ['Chase Card', 'Credit Card', 'Yes']
  ]),
  new FakeSheet('SYS - Account Source Links', [])
]);
const placeholderInit = context.ensureFinancialIdentityFoundationForConnectedAccounts_(placeholderLinksWorkbook);
assert.equal(placeholderInit.applied, true);
assert.equal(placeholderLinksWorkbook.getSheetByName('SYS - Financial Accounts').getLastRow(), 2,
  'empty Account Source Links placeholder must not block identity row writes');

const headerOnlyRegistry = new FakeSheet('SYS - Financial Accounts', [context.FINANCIAL_ACCOUNT_HEADERS_]);
const resumeWorkbook = new FakeSpreadsheet([
  new FakeSheet('INPUT - Debts', [
    debtHeaders,
    ['Resume Card', 'Credit Card', 'Yes']
  ]),
  headerOnlyRegistry
]);
const resumeInit = context.ensureFinancialIdentityFoundationForConnectedAccounts_(resumeWorkbook);
assert.equal(resumeInit.applied, true);
assert.equal(headerOnlyRegistry.getLastRow(), 2,
  'header-only registry must resume by appending identity rows');
assert.equal(headerOnlyRegistry.sysStyled, true,
  'header-only registry repair must apply canonical SYS first-create styling');

console.log('Financial identity regressions passed.');
