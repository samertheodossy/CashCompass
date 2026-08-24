import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import vm from 'node:vm';

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
    getUuid() { uuidCounter += 1; return `00000000-0000-4000-8000-${String(uuidCounter).padStart(12, '0')}`; }
  },
  console
};
vm.createContext(context);
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

console.log('Financial identity regressions passed.');
