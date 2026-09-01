import fs from 'node:fs';
import vm from 'node:vm';

const bridge = fs.readFileSync(new URL('../plaid_import_bridge.js', import.meta.url), 'utf8');
const client = fs.readFileSync(new URL('../Dashboard_Script_PlaidConnectedAccounts.html', import.meta.url), 'utf8');
const debts = fs.readFileSync(new URL('../debts.js', import.meta.url), 'utf8');
const banks = fs.readFileSync(new URL('../bank_accounts.js', import.meta.url), 'utf8');

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
  applyInner.includes('plaidImportRefreshPreviewAccountAfterApplySafe_') &&
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
  client.includes('importingKeys') &&
  client.includes('accountMessages') &&
  client.includes('reviewObservedAt') &&
  !/plaidMainApplySelectedUpdates_[\s\S]{0,1500}loadPlaidConnectedAccounts_/.test(client),
  'post-Apply must defer save-flow planner refresh and avoid full Connected reload');

assert(client.includes('plaidMainRenderAccountLocalStatus_') &&
  client.includes('Importing data…') &&
  client.includes('Applying selected updates…') &&
  !client.includes('Importing provider data…') &&
  !/plaidMainImportData_[\s\S]{0,800}plaidMainSetStatus_/.test(client) &&
  !/plaidMainApplySelectedUpdates_[\s\S]{0,800}plaidMainSetStatus_/.test(client),
  'Import and Apply must use account-local status, not the section banner');

assert(client.includes('plaidMainSelectedEligibleApplyCount_') &&
  client.includes('plaidMainPruneStaleApplySelections_') &&
  client.includes('plaidMainClearAccountSelections_') &&
  client.includes('plaidMainEligibleApplyKeySet_'),
  'Apply eligibility must recompute from the current preview and prune stale selections');

assert(/plaidMainImportData_[\s\S]{0,1200}plaidMainClearAccountSelections_/.test(client),
  'fresh Import Data must clear prior Apply selections for that account');

assert(client.includes('accountImportState') &&
  client.includes('accountPreviews') &&
  client.includes('importRequestSeq') &&
  client.includes('plaidMainHasValidAccountPreview_') &&
  client.includes('plaidMainClearAccountReviewState_') &&
  client.includes('plaidMainStoreAccountPreviewBundle_') &&
  client.includes('plaidMainApplyImportResult_') &&
  /plaidMainSaveMapping_[\s\S]{0,1200}plaidMainClearAccountReviewState_/.test(client) &&
  !/plaidMainRenderDomain_[\s\S]{0,2500}status === 'CONFIRMED'\)[\s\S]{0,200}plaidMainRenderPreviewAccount_/.test(client) &&
  /plaidMainHasValidAccountPreview_/.test(client) &&
  !client.includes('previews:') &&
  /plaidMainImportData_[\s\S]{0,1200}plaidMainApplyImportResult_/.test(client) &&
  !/plaidMainImportData_[\s\S]{0,1200}accountPreviews[\s\S]{0,200}= result;/.test(client),
  'review panel must use account-scoped previews and not replace sibling imports');

assert(/plaidMainHasValidAccountPreview_[\s\S]{0,500}accountPreviews\[selectionKey\]/.test(client) &&
  !/plaidMainHasValidAccountPreview_[\s\S]{0,500}previews\[String\(connection/.test(client),
  'review validity must not depend on connection-level observedAt invalidating siblings');

assert(/plaidMainBeginImportRequest_[\s\S]{0,400}importRequestSeq/.test(client) &&
  /plaidMainApplyImportResult_[\s\S]{0,400}importRequestSeq\[selectionKey\] !== requestId/.test(client),
  'concurrent Import Data must reject stale responses per account only');

assert(/plaidMainBeginApplyRequest_[\s\S]{0,400}applyRequestSeq/.test(client) &&
  /plaidMainFinishApplyRequest_[\s\S]{0,400}applyRequestSeq\[selectionKey\] !== requestId/.test(client) &&
  /plaidMainApplySelectedUpdates_[\s\S]{0,1200}accountPreview\.reviewObservedAt/.test(client) &&
  !/plaidMainApplySelectedUpdates_[\s\S]{0,800}preview\.observedAt/.test(client),
  'Apply must use account-scoped reviewObservedAt and reject stale concurrent responses per account');

assert(/plaidMainImportData_[\s\S]{0,600}protectedAccountKey/.test(client),
  'Import Data must scope server baseline persistence to the triggering account');

assert(client.includes('plaidMainPatchAccountCard_') &&
  client.includes('plaidMainDeferPlannerRefresh_') &&
  /plaidMainImportData_[\s\S]{0,900}plaidMainPatchAccountCard_/.test(client) &&
  /plaidMainApplySelectedUpdates_[\s\S]{0,1800}plaidMainPatchAccountCard_/.test(client),
  'Import and Apply must patch only the affected account card and defer planner refresh');

assert(bridge.includes('plaidImportAccountReviewObservedAt_') &&
  bridge.includes('targetProtectedAccountKey') &&
  /plaidImportFetchPreviewMappedCore_[\s\S]{0,2500}targetProtectedAccountKey/.test(bridge) &&
  bridge.includes('plaidImportRefreshPreviewAccountAfterApplySafe_') &&
  bridge.includes('refreshNotice') &&
  bridge.includes('plaidImportBeginRequestSession_') &&
  bridge.includes('plaidImportRequestRegistry_') &&
  bridge.includes('stageTimingMs'),
  'server must store account-scoped review tokens and not overwrite sibling baselines on Import');

assert(/plaidMainLastImportedAt_[\s\S]{0,400}stableAccountId/.test(client) &&
  client.includes('Not yet imported'),
  'Last imported must reset when association changes without a current preview');

assert(!/plaidMainSaveMapping_[\s\S]{0,1200}plaidImportPreviewMapped/.test(client),
  'association Confirm must not auto-trigger Import Data');

assert(/plaidMainApplySelectedUpdates_[\s\S]{0,600}eligible\[key\]/.test(client),
  'Apply must submit only currently eligible selected keys');

assert(client.includes('protectedConnectionKey') &&
  client.includes('protectedAccountKey') &&
  client.includes('importingKeys[selectionKey]'),
  'account operation state must key by protected connection/account identity');

assert(!client.includes('value:') || !/selectedApplyKeys[\s\S]{0,200}value:/.test(client),
  'client must not send financial values on Apply');

const cashApplyFn = sliceFunction(bridge, 'plaidImportApplyCashUpdates');
const cashApplyInner = sliceFunction(bridge, 'plaidImportApplyCashUpdates_');

assert(cashApplyFn.includes('plaidImportApplyCashUpdates_'), 'Bank Apply must delegate to inner handler');
assert(cashApplyInner.includes('plaidImportRejectApplyFinancialAuthority_') &&
  cashApplyInner.includes('plaidImportFetchPreviewMappedCore_') &&
  cashApplyInner.includes('plaidImportLoadReviewBaseline_') &&
  cashApplyInner.includes('updateBankAccountValueByDate_(') &&
  cashApplyInner.includes("domain || '').toUpperCase() !== 'CASH'") &&
  !cashApplyInner.includes('updateBankAccountValueByDate({'),
  'Bank Apply must revalidate and write only through private canonical bank writer');

assert(bridge.includes('PLAID_IMPORT_CASH_APPLY_KEYS_') &&
  bridge.includes('CURRENT_BALANCE: true') &&
  !/PLAID_IMPORT_CASH_APPLY_KEYS_[\s\S]{0,120}AVAILABLE_BALANCE/.test(bridge),
  'Bank Apply v1 allows Current Balance only');

assert(cashApplyInner.includes('plaidImportCashApplyValuesEqual_') &&
  cashApplyInner.includes('No changes are available to apply') &&
  cashApplyInner.includes('CashCompass values changed since review') &&
  cashApplyInner.includes('plaidImportCurrentCashApplyValue_') &&
  cashApplyInner.includes('cashCompassApplyContext'),
  'Bank Apply must compare against target month balance and reject stale review');

assert(banks.includes('function readBankAccountMonthBalanceForDate_') &&
  banks.includes('hasMonthValue: false') &&
  bridge.includes('plaidImportEnrichCashApplyContext_') &&
  bridge.includes('readBankAccountMonthBalanceForDate_'),
  'Bank Apply review must read INPUT month cells and treat empty months as zero');

assert(client.includes('plaidMainBuildCashBalanceRow_') &&
  client.includes('cashCompassApplyContext') &&
  /plaidMainBuildCashBalanceRow_[\s\S]{0,500}monthBalance/.test(client),
  'Connected client must compare bank Apply against target month balance');

assert(cashApplyInner.includes('targetProtectedAccountKey') &&
  /plaidImportApplyCashUpdates_[\s\S]{0,2000}plaidImportBeginRequestSession_/.test(bridge),
  'Bank Apply must use account-scoped preview revalidation with request-local reuse');

assert(banks.includes("importSource: plaidApply ? 'PLAID'") &&
  banks.includes("accountSource: plaidApply ? 'PLAID'") &&
  banks.includes('updateBankAccountValueByDate_(payload, null)'),
  'Bank writer must record PLAID Activity Log provenance server-side only');

assert(client.includes('plaidImportApplyCashUpdates') &&
  client.includes('PLAID_MAIN_CASH_APPLY_KEYS_') &&
  client.includes('plaidMainApplyRpcName_') &&
  client.includes('Available Balance is informational only') &&
  !client.includes('updateBankAccountValueByDate('),
  'Connected client routes Bank Apply through bridge only');

assert(/plaidMainApplySelectedUpdates_[\s\S]{0,1500}plaidMainEnsureAccountReviewExpanded_/.test(client) &&
  /plaidMainShouldForceReviewExpanded_[\s\S]{0,400}applyingKeys/.test(client) &&
  /plaidMainShouldForceReviewExpanded_[\s\S]{0,400}isError/.test(client),
  'Apply must keep the affected account expanded while applying and on failure');

new vm.Script(bridge);
new vm.Script(client);
new vm.Script(debts);
new vm.Script(banks);

console.log('Plaid Apply regressions passed.');
