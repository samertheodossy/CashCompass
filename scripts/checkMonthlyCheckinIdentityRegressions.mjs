import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const identitySource = fs.readFileSync(new URL('../monthly_checkin_identity.js', import.meta.url), 'utf8');
const context = { console };
vm.createContext(context);
vm.runInContext(identitySource, context, { filename: 'monthly_checkin_identity.js' });

const registry = {
  accounts: [
    {
      stableAccountId: 'CASH-ALLY-1', domain: 'CASH', displayName: 'Ally Checking',
      legacyDomain: 'SYS_ACCOUNTS', legacyKey: 'Ally Checking', identityStatus: 'VERIFIED'
    },
    {
      stableAccountId: 'PROP-MAIN-1', domain: 'PROPERTY', displayName: 'Main House',
      legacyDomain: 'SYS_HOUSE_ASSETS', legacyKey: 'Main House', identityStatus: 'VERIFIED'
    },
    {
      stableAccountId: 'INV-BROKER-1', domain: 'INVESTMENT', displayName: 'Brokerage Taxable',
      legacyDomain: 'SYS_ASSETS', legacyKey: 'INV-ORPHAN-1', identityStatus: 'VERIFIED'
    },
    {
      stableAccountId: 'DEBT-CITI-1', domain: 'DEBT', displayName: 'CitiAA',
      legacyDomain: 'INPUT_DEBTS', legacyKey: 'CitiAA', identityStatus: 'VERIFIED'
    }
  ]
};
const index = context.monthlyCheckinBuildRegistryIndex_(registry);

const bankResolved = context.monthlyCheckinResolveAccountKey_({
  domain: 'bank', stableAccountId: 'CASH-ALLY-1', displayName: 'Renamed Ally', registryIndex: index
});
assert.equal(bankResolved.ok, true);
assert.equal(bankResolved.accountKey, 'bank:v1:CASH-ALLY-1');
assert.equal(bankResolved.displayName, 'Renamed Ally');
assert.notEqual(bankResolved.accountKey, 'bank:v1:Renamed Ally');

const houseResolved = context.monthlyCheckinResolveAccountKey_({
  domain: 'house', houseName: 'Main House', registryIndex: index
});
assert.equal(houseResolved.accountKey, 'house:v1:PROP-MAIN-1');

const investmentResolved = context.monthlyCheckinResolveAccountKey_({
  domain: 'investment', investmentId: 'INV-ORPHAN-1', registryIndex: index
});
assert.equal(investmentResolved.accountKey, 'investment:v1:INV-BROKER-1');

const debtResolved = context.monthlyCheckinResolveAccountKey_({
  domain: 'debt', accountName: 'CitiAA', registryIndex: index
});
assert.equal(debtResolved.accountKey, 'debt:v1:DEBT-CITI-1');

for (const result of [bankResolved, houseResolved, investmentResolved, debtResolved]) {
  assert.match(result.accountKey, /^(bank|house|investment|debt):v1:[^:]+$/);
  assert.doesNotMatch(result.accountKey, /:\d+$/);
  assert.doesNotMatch(result.accountKey, /row/i);
}

const reordered = context.monthlyCheckinResolveAccountKey_({
  domain: 'bank',
  stableAccountId: 'CASH-ALLY-1',
  sysAccountsRow: 99,
  registryIndex: index
});
assert.equal(reordered.accountKey, bankResolved.accountKey,
  'row numbers must not affect canonical keys');

const renamed = context.monthlyCheckinResolveAccountKey_({
  domain: 'bank',
  stableAccountId: 'CASH-ALLY-1',
  accountName: 'Completely Different Label',
  registryIndex: index
});
assert.equal(renamed.accountKey, bankResolved.accountKey,
  'rename preserves key when stable identity is unchanged');

const newIdentity = context.monthlyCheckinResolveAccountKey_({
  domain: 'bank', stableAccountId: 'CASH-NEW-1', registryIndex: index
});
assert.equal(newIdentity.ok, false);
assert.equal(newIdentity.code, 'IDENTITY_UNRESOLVED');

const legacyOnlyBank = context.monthlyCheckinResolveAccountKey_({
  domain: 'bank', accountName: 'Unregistered Bank', registryIndex: index
});
assert.equal(legacyOnlyBank.ok, false);
assert.equal(legacyOnlyBank.code, 'IDENTITY_UNRESOLVED',
  'bank accounts without registry rows must fail closed');

const duplicateRegistry = context.monthlyCheckinBuildRegistryIndex_({
  accounts: [
    registry.accounts[0],
    {
      stableAccountId: 'CASH-ALLY-2', domain: 'CASH', displayName: 'Duplicate Ally',
      legacyDomain: 'SYS_ACCOUNTS', legacyKey: 'Ally Checking', identityStatus: 'VERIFIED'
    }
  ]
});
const duplicateLegacy = context.monthlyCheckinResolveAccountKey_({
  domain: 'bank', accountName: 'Ally Checking', registryIndex: duplicateRegistry
});
assert.equal(duplicateLegacy.ok, false);
assert.equal(duplicateLegacy.code, 'DUPLICATE_LEGACY_IDENTITY');

const duplicateStable = context.monthlyCheckinBuildRegistryIndex_({
  accounts: [registry.accounts[0], registry.accounts[0]]
});
const duplicateStableResult = context.monthlyCheckinResolveAccountKey_({
  domain: 'bank', stableAccountId: 'CASH-ALLY-1', registryIndex: duplicateStable
});
assert.equal(duplicateStableResult.ok, false);
assert.equal(duplicateStableResult.code, 'DUPLICATE_STABLE_ACCOUNT_ID');

const orphanInvestment = context.monthlyCheckinResolveAccountKey_({
  domain: 'investment',
  investmentId: 'INV-SHEET-ONLY-1',
  displayName: 'Robinhood',
  registryIndex: index,
  investmentLifecycleCounts: { 'INV-SHEET-ONLY-1': 1 }
});
assert.equal(orphanInvestment.ok, true);
assert.equal(orphanInvestment.accountKey, 'investment:v1:INV-SHEET-ONLY-1');
assert.equal(orphanInvestment.identitySource, 'INVESTMENT_LIFECYCLE_ID');
assert.notEqual(orphanInvestment.accountKey, 'investment:v1:Robinhood');

const orphanDuplicate = context.monthlyCheckinResolveAccountKey_({
  domain: 'investment',
  investmentId: 'INV-DUP',
  registryIndex: index,
  investmentLifecycleCounts: { 'INV-DUP': 2 }
});
assert.equal(orphanDuplicate.ok, false);
assert.equal(orphanDuplicate.code, 'DUPLICATE_LEGACY_IDENTITY');

assert.doesNotMatch(identitySource, /\bsetValue\s*\(/);
assert.doesNotMatch(identitySource, /\bappendRow\s*\(/);
assert.doesNotMatch(identitySource, /\bwriteSetting_\s*\(/);
assert.doesNotMatch(identitySource, /\binsertSheet\s*\(/);
assert.doesNotMatch(identitySource, /getUserSpreadsheet_\s*\(/,
  'resolver module must not read workbooks directly');

console.log('Monthly check-in identity regressions passed.');
