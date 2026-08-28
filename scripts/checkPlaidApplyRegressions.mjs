import fs from 'node:fs';
import vm from 'node:vm';

const bridge = fs.readFileSync(new URL('../plaid_import_bridge.js', import.meta.url), 'utf8');
const client = fs.readFileSync(new URL('../Dashboard_Script_PlaidConnectedAccounts.html', import.meta.url), 'utf8');
const debts = fs.readFileSync(new URL('../debts.js', import.meta.url), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(`Plaid Apply regression failed: ${message}`);
}

function sliceFunction(source, name) {
  const start = source.indexOf(`function ${name}`);
  assert(start >= 0, `${name} is missing`);
  const end = source.indexOf('\nfunction ', start + 1);
  return source.slice(start, end < 0 ? source.length : end);
}

const applyFn = sliceFunction(bridge, 'plaidImportApplyDebtUpdates');
const applyInner = sliceFunction(bridge, 'plaidImportApplyDebtUpdates_');
const rejectFinancial = sliceFunction(bridge, 'plaidImportRejectApplyFinancialAuthority_');

assert(applyFn.includes('plaidImportApplyDebtUpdates_'), 'Apply must delegate to inner handler');
assert(applyInner.includes('plaidImportRejectBrowserAuthority_') &&
  applyInner.includes('plaidImportRejectApplyFinancialAuthority_') &&
  applyInner.includes('plaidImportFetchPreviewMappedCore_') &&
  applyInner.includes('plaidImportCanonicalTarget_') &&
  applyInner.includes('plaidImportLoadReviewBaseline_') &&
  applyInner.includes('plaidImportRefreshPreviewAccountAfterApply_') &&
  applyInner.includes('plaidImportBeginDebtApplyWriteSession_') &&
  applyInner.includes('updateDebtField(') &&
  !applyInner.includes('plaidImportPreviewMapped('),
  'Apply must revalidate once, patch preview locally, and reuse updateDebtField');

assert(!applyInner.includes('plaidImportOwnedAccount_') &&
  applyInner.includes('persistBaselines: false'),
  'Apply must not duplicate connection fetch or store import baselines during revalidation');

assert(applyInner.includes('stageTimingMs') &&
  bridge.includes('plaidImportApplyTimingCreate_'),
  'Apply must expose sanitized stage timing without financial values');

assert(applyInner.split('plaidImportFetchPreviewMappedCore_').length === 2,
  'Apply must perform exactly one preview revalidation fetch per request');

assert(rejectFinancial.includes("'value'") &&
  rejectFinancial.includes("'accountName'") &&
  rejectFinancial.includes("'fieldName'") &&
  rejectFinancial.includes("'providerAccountId'"),
  'browser cannot supply arbitrary financial values');

assert(applyInner.includes('baselineFactsHash') && applyInner.includes('candidateHash') &&
  applyInner.includes('Import Data again'),
  'stale preview and changed CashCompass/import must fail closed');

assert(bridge.includes('PLAID_IMPORT_DEBT_APPLY_KEYS_') &&
  bridge.includes('CURRENT_BALANCE') && bridge.includes('INT_RATE') &&
  !bridge.includes("CREDIT_LEFT_DERIVED") &&
  !/PLAID_IMPORT_DEBT_APPLY_KEYS_[\s\S]{0,200}AVAILABLE_CREDIT/.test(bridge),
  'allowed Apply keys exclude derived and informational fields');

assert(bridge.includes('plaidImportDueDayFromIso_') &&
  bridge.includes("NEXT_PAYMENT_DATE: 'Due Date'") &&
  applyInner.includes('plaidImportResolveDebtApplyValue_'),
  'Due Date Apply must normalize to day-of-month through canonical writer');

assert(bridge.includes('APR source must be selected') &&
  applyInner.includes('sourceSemantic') &&
  applyInner.includes('importProvenance'),
  'Int Rate Apply requires explicit APR source and provenance');

assert(applyInner.includes('plaidImportDebtApplyValuesEqual_') &&
  applyInner.includes('No changes are available to apply'),
  'same-value fields must not write');

assert(debts.includes("logDetails.importSource = 'PLAID'") &&
  debts.includes('importSourceSemantic') &&
  debts.includes("accountSource: importProvenance &&"),
  'updateDebtField must record PLAID Activity Log provenance');

assert(!/appendActivityLog_\([\s\S]{0,1200}plaidImportPreviewMapped/.test(bridge) &&
  !/appendActivityLog_/.test(bridge),
  'Import Data must not create financial Activity Log entries in bridge');

assert(applyInner.includes('partialApplied') || applyInner.includes('Apply stopped after updating'),
  'multi-field partial failure must be explicit');

assert(client.includes('plaidImportApplyDebtUpdates') &&
  client.includes('plaidMainDebtApplySelectable_') &&
  client.includes("'Apply Selected Updates'") &&
  client.includes('allowApplySelection') &&
  client.includes('derivedOnly: true') &&
  client.includes('CREDIT_LEFT_DERIVED') &&
  !client.includes('updateDebtField('),
  'client uses Apply RPC only and exposes Debt field selection UX');

assert(debts.includes('plaidImportDebtApplyWriteSession_') &&
  debts.includes('plaidImportApplyBatch') &&
  debts.includes('reuseApplySession'),
  'multi-field Apply must reuse one request-local Debt sheet read');

assert(client.includes('runPlannerAndRefreshDashboardFromSave') &&
  client.includes('applyingKeys') &&
  client.includes('reviewObservedAt') &&
  !/plaidMainApplySelectedUpdates_[\s\S]{0,1500}loadPlaidConnectedAccounts_/.test(client),
  'post-Apply must defer save-flow planner refresh and avoid full Connected reload');

assert(!client.includes('value:') || !/selectedApplyKeys[\s\S]{0,200}value:/.test(client),
  'client must not send financial values on Apply');

new vm.Script(bridge);
new vm.Script(client);
new vm.Script(debts);

console.log('Plaid Apply regressions passed.');
