import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read = (name) => fs.readFileSync(new URL('../' + name, import.meta.url), 'utf8');
const body = read('Dashboard_Body.html');
const help = read('Dashboard_Help.html');
const client = read('Dashboard_Script_PlanningDebts.html');
const debtImport = read('debt_import.js');
const plaidClient = read('Dashboard_Script_PlaidConnectedAccounts.html');
const bankClient = read('Dashboard_Script_AssetsBankInvestments.html');
const houseClient = read('Dashboard_Script_AssetsHouseValues.html');
const invClient = read('Dashboard_Script_AssetsBankInvestments.html');
const sidebar = read('PlannerDashboard.html');
const styles = read('Dashboard_Styles.html');
const bridge = read('plaid_import_bridge.js');
const roadmap = read('ROADMAP.md');
const liabilities = read('services/plaid-backend/src/liabilities_adapter.js');

function sliceFn(source, name, nextName) {
  const start = source.indexOf('function ' + name);
  let end = source.length;
  if (nextName) {
    const functionEnd = source.indexOf('function ' + nextName, start + 1);
    end = functionEnd >= 0 ? functionEnd : source.indexOf(nextName, start + 1);
  }
  assert.ok(start >= 0 && end > start, name + ' must exist');
  return source.slice(start, end);
}

const manage = body.slice(body.indexOf('id="debt_mode_manage_wrap"'), body.indexOf('id="debt_mode_connected_wrap"'));
const connected = body.slice(body.indexOf('id="debt_mode_connected_wrap"'), body.indexOf('id="debt_status"'));
const drawer = body.slice(body.indexOf('id="debt_activity_drawer_backdrop"'), body.indexOf('id="retirement"'));
const debtsPanel = body.slice(body.indexOf('id="debts"'), body.indexOf('id="retirement"'));
const activityClient = client.slice(client.indexOf('function openDebtAccountActivityDrawer_'));

assert.match(manage, /id="debt_account_activity_btn"/);
assert.match(manage, />Debt activity</);
assert.match(manage, /openDebtAccountActivityDrawer_\('provider'\)/);
assert.doesNotMatch(manage, /Paste CSV|Review pending imports|id="debt_mode_import_btn"/);

assert.match(drawer, /id="debt_activity_drawer"/);
assert.match(drawer, /id="debt_activity_provider_btn"/);
assert.match(drawer, /Connected provider \/ Plaid/);
assert.match(drawer, /id="debt_activity_provider_list"/);
assert.match(drawer, /Preview does not write/);
assert.match(drawer, /same Connected provider field mapping/);
assert.match(drawer, /Matching fields show <strong>Same<\/strong>/);
assert.match(drawer, /Connection management stays on Connected/);
assert.match(drawer, /Apply Selected Updates<\/strong> on Connected remains available/);
assert.doesNotMatch(drawer, /Paste CSV|OFX|PDF|CURRENT_BALANCE/);
assert.doesNotMatch(drawer, /id="debt_activity_csv_btn"|id="debt_activity_ofx_btn"|id="debt_activity_pdf_btn"/);
assert.doesNotMatch(drawer, /Provider did not provide this field|Apply this Balance/);

assert.match(connected, /Connected manages the provider connection/);
assert.match(connected, /Import Data opens Debt activity with Connected provider \/ Plaid selected/);
assert.match(connected, /CashCompass values change only after explicit confirmation/);
assert.match(connected, /Apply Selected Updates<\/strong> on Connected remains available/);
assert.match(connected, /Planning continues to use your CashCompass balances and terms/);
assert.doesNotMatch(connected, /automatically updates Planning|provider data automatically/);

assert.match(help, /Open <strong>Debt activity<\/strong> under <strong>Manage debts<\/strong>/);
assert.match(help, /Connected <strong>Import Data<\/strong>/);
assert.match(help, /Import Data<\/strong> opens Debt activity with Connected provider \/ Plaid selected/);
assert.match(help, /keeps the selected institution and mapped account in context/);
assert.match(help, /same Connected Plaid review/);
assert.match(help, /Current Balance[\s\S]*Credit Limit[\s\S]*Minimum Payment[\s\S]*Due Date[\s\S]*Int Rate/);
assert.match(help, /Matching fields show <strong>Same<\/strong>/);
assert.match(help, /Provider information only — not stored in CashCompass/);
assert.match(help, /Credit Left and Provider Available Credit cannot be imported or applied/);
assert.match(help, /Debt activity previews provider data and requires explicit confirmation before CashCompass values change/);
assert.match(help, /Connected manages the provider connection/);
assert.match(help, /Apply Selected Updates[\s\S]*on Connected remains available/);
assert.match(help, /Planning continues to use CashCompass balances and terms/);
assert.doesNotMatch(help, /automatically updates Planning|provider data automatically updates Planning/);
assert.doesNotMatch(help, /Provider did not provide this field/);

assert.match(roadmap, /Debt activity/);
assert.match(roadmap, /plaidMainBuildDomainReview_|plaidMainRenderPreviewAccount_/);
assert.match(roadmap, /Apply Selected Updates[\s\S]*until live review|Keep Connected debt[\s\S]*Apply Selected Updates/);

assert.match(client, /function openDebtAccountActivityDrawer_/);
assert.match(client, /function debtActivityProviderSetFocusContext_/);
assert.match(client, /function debtActivityProviderMaybeAutoPreviewFocus_/);
assert.match(client, /function setDebtAccountActivityView_/);
assert.match(client, /function loadDebtActivityProviderPreview_/);
assert.match(client, /function previewDebtActivityProviderAccount_/);
assert.match(client, /function confirmDebtActivityProviderApply_/);
assert.match(client, /plaidImportConnectedAccountsState/);
assert.match(client, /plaidImportPreviewMapped/);
assert.match(client, /plaidMainRenderPreviewAccount_/);
assert.match(client, /applyHost: 'debtActivity'/);
assert.doesNotMatch(activityClient, /updateDebtField\(/);
assert.doesNotMatch(activityClient, /debtActivityProviderSupportedFields_|debtActivityProviderFieldStatus_|debtActivityProviderAccountFacts_/);
assert.doesNotMatch(activityClient, /PLAID_MAIN_DEBT_CANONICAL_/);
assert.doesNotMatch(activityClient, /Provider did not provide this field|Apply this Balance|fieldLabel: 'Balance'/);

const openDrawer = sliceFn(client, 'openDebtAccountActivityDrawer_(', 'closeDebtAccountActivityDrawer_(');
assert.match(openDrawer, /debtActivityProviderSetFocusContext_\(context\)/);
assert.match(openDrawer, /setDebtAccountActivityView_\('provider'\)/);
assert.doesNotMatch(openDrawer, /updateDebtField|plaidImportApplyDebtUpdates|plaidImportPreviewMapped|confirmed: true/);

const focusContext = sliceFn(client, 'debtActivityProviderSetFocusContext_(', 'debtActivityProviderCardDomId_(');
assert.match(focusContext, /protectedConnectionKey/);
assert.match(focusContext, /protectedAccountKey/);
assert.match(focusContext, /autoPreview/);
assert.match(focusContext, /focusKey/);

const loadProvider = sliceFn(client, 'loadDebtActivityProviderPreview_(', 'renderDebtActivityProviderList_(');
assert.match(loadProvider, /plaidImportConnectedAccountsState/);
assert.match(loadProvider, /debtActivityProviderSortFocusFirst_/);
assert.match(loadProvider, /debtActivityProviderMaybeAutoPreviewFocus_/);
assert.doesNotMatch(loadProvider, /updateDebtField|plaidImportApplyDebtUpdates/);

const autoPreview = sliceFn(client, 'debtActivityProviderMaybeAutoPreviewFocus_(', 'loadDebtActivityProviderPreview_(');
assert.match(autoPreview, /previewDebtActivityProviderAccount_/);
assert.doesNotMatch(autoPreview, /updateDebtField|plaidImportApplyDebtUpdates|confirmed: true/);

const previewFn = sliceFn(client, 'previewDebtActivityProviderAccount_(', 'confirmDebtActivityProviderApply_(');
assert.match(previewFn, /plaidImportPreviewMapped/);
assert.doesNotMatch(previewFn, /updateDebtField|plaidImportApplyDebtUpdates|confirmed: true/);

assert.match(
  sliceFn(client, 'renderDebtActivityProviderCard_(', 'renderDebtActivityProviderComparison_('),
  /debt-activity-focus-card/
);
assert.match(styles, /#debt_activity_drawer \.debt-activity-focus-card/);

const mapped = sliceFn(client, 'debtActivityProviderIsMappedDebt_(', 'debtActivityProviderTargetName_(');
assert.match(mapped, /lifecycleStatus \|\| ''\) !== 'ACTIVE'/);
assert.match(mapped, /domain !== 'DEBT'/);
assert.match(mapped, /mapping\.status \|\| ''\) === 'CONFIRMED'/);
assert.match(mapped, /mapping\.stableAccountId/);
assert.doesNotMatch(mapped, /UNMATCHED|PENDING/);

const canonical = plaidClient.slice(
  plaidClient.indexOf('var PLAID_MAIN_DEBT_CANONICAL_'),
  plaidClient.indexOf('var PLAID_MAIN_CASH_CANONICAL_')
);
const canonicalLabels = [...canonical.matchAll(/label: '([^']+)'/g)].map((match) => match[1]);
assert.deepEqual(canonicalLabels, [
  'Current Balance',
  'Credit Limit',
  'Minimum Payment',
  'Due Date',
  'Statement Balance',
  'Statement Date'
], 'Debt activity must reuse Connected canonical field labels and order');
assert.match(canonical, /CURRENT_BALANCE:[\s\S]*CREDIT_LIMIT:[\s\S]*MINIMUM_PAYMENT:[\s\S]*NEXT_PAYMENT_DATE:/);
assert.match(plaidClient, /item: 'Credit Left'/);
assert.match(plaidClient, /item: 'Provider Available Credit'/);
assert.match(plaidClient, /item: 'Int Rate'/);
assert.match(plaidClient, /\['Apply', 'Item', 'CashCompass', 'Imported', 'Change'\]/);
assert.match(plaidClient, /PLAID_MAIN_MISSING_ = '—'/);
assert.match(plaidClient, /PLAID_MAIN_MISSING_NOTE_ = '— Not currently tracked in CashCompass'/);
assert.match(
  sliceFn(plaidClient, 'plaidMainRenderPreviewAccount_(', 'plaidMainRenderAssociationSelect_('),
  /Provider information only — not stored in CashCompass/
);
assert.match(
  sliceFn(plaidClient, 'plaidMainRenderPreviewAccount_(', 'plaidMainRenderAssociationSelect_('),
  /fromActivity[\s\S]{0,180}Provider information only/
);

const domainReview = sliceFn(plaidClient, 'plaidMainBuildDomainReview_(', 'plaidMainApplySelectable_(');
assert.match(domainReview, /if \(!previewRow\) return;/);
assert.match(domainReview, /plaidMainBuildDueDateRow_\(previewRow, legacy, preview, hostOptions\)/);
assert.match(domainReview, /plaidMainBuildDerivedCreditLeftRow_/);
assert.match(domainReview, /plaidMainBuildProviderAvailableCreditRow_/);
assert.match(domainReview, /plaidMainBuildIntRateReview_/);
assert.match(domainReview, /PLAID_MAIN_MISSING_NOTE_|hasMissing/);

const selectable = sliceFn(plaidClient, 'plaidMainApplySelectable_(', 'plaidMainDebtApplySelectable_(');
assert.match(selectable, /row\.derivedOnly \|\| row\.informational/);
assert.match(selectable, /change === 'Same'/);
assert.match(selectable, /staleProviderDueDate/);
assert.match(selectable, /PLAID_MAIN_DEBT_APPLY_KEYS_/);
assert.doesNotMatch(selectable, /CREDIT_LEFT|AVAILABLE_CREDIT/);

const currencyChange = sliceFn(plaidClient, 'plaidMainFormatCurrencyChange_(', 'plaidMainChangeRowClass_(');
assert.match(currencyChange, /return 'New'/);
assert.match(currencyChange, /return 'Same'/);

const dueDateRow = sliceFn(plaidClient, 'plaidMainBuildDueDateRow_(', 'plaidMainBuildDerivedCreditLeftRow_(');
assert.match(dueDateRow, /plaidMainParseDueDay_/);
assert.match(dueDateRow, /plaidMainGetNextDueDateParts_/);
assert.match(dueDateRow, /change = 'New'/);
assert.match(dueDateRow, /change = 'Same'/);
assert.match(dueDateRow, /applyHost === 'debtActivity'/);
assert.match(dueDateRow, /Not applied — this provider due date has already passed and no valid effective date was provided\./);
assert.match(dueDateRow, /staleProviderDueDate/);
assert.match(dueDateRow, /plaidMainProviderDueDateNeedsStaleReview_/);
assert.match(dueDateRow, /cashCompass: cashCompassDisplay/);
assert.doesNotMatch(dueDateRow, /plaidMainGetNextDueDateParts_\(anchorParts, importedDay\)/);
assert.doesNotMatch(dueDateRow, /recorded payment|markPaid|Cash Flow|updateDebtField/i);

const staleClientSrc = [
  sliceFn(plaidClient, 'plaidMainParseIsoDateParts_(', 'plaidMainFormatCalendarParts_('),
  sliceFn(plaidClient, 'plaidMainReviewAnchorParts_(', 'plaidMainGetNextDueDateParts_('),
  sliceFn(plaidClient, 'plaidMainCalendarDateIsPast_(', 'plaidMainBuildDueDateRow_(')
].join('\n');
assert.doesNotMatch(staleClientSrc, /recorded payment|markPaid|Cash Flow|updateDebtField/i);
const staleClientVm = vm.createContext({ Date, Number, String, Object });
vm.runInContext(staleClientSrc, staleClientVm);
const pastDueRow = { candidate: { textValue: '2026-09-10' }, effectiveAsOf: '' };
assert.equal(
  staleClientVm.plaidMainProviderDueDateNeedsStaleReview_(pastDueRow, { reviewAnchorDate: '2026-09-21' }),
  true,
  'past provider due date with no effective timestamp is blocked'
);
assert.equal(
  staleClientVm.plaidMainProviderDueDateNeedsStaleReview_({
    candidate: { textValue: '2026-09-25' },
    effectiveAsOf: ''
  }, { reviewAnchorDate: '2026-09-21' }),
  false,
  'future provider due date remains reviewable'
);
assert.equal(
  staleClientVm.plaidMainProviderDueDateNeedsStaleReview_({
    candidate: { textValue: '2026-09-21' },
    effectiveAsOf: ''
  }, { reviewAnchorDate: '2026-09-21' }),
  false,
  'due date on the current date is not treated as stale'
);
assert.equal(
  staleClientVm.plaidMainProviderDueDateNeedsStaleReview_({
    candidate: { textValue: '2026-09-10', providerEffectiveAsOf: '2026-09-10' },
    effectiveAsOf: ''
  }, { reviewAnchorDate: '2026-09-21' }),
  false,
  'past due date with a provider effective timestamp is not blocked by the missing-timestamp rule'
);

const percentFmt = sliceFn(plaidClient, 'plaidMainFormatPercent_(', 'plaidMainParseIsoDateParts_(');
assert.match(percentFmt, /toFixed\(2\) \+ '%'/);

const creditLeft = sliceFn(plaidClient, 'plaidMainBuildDerivedCreditLeftRow_(', 'plaidMainProviderAvailableCreditInconsistent_(');
assert.match(creditLeft, /derivedOnly: true/);
assert.match(creditLeft, /CREDIT_LEFT_DERIVED/);
assert.doesNotMatch(creditLeft, /applyKey/);

const availableCredit = sliceFn(plaidClient, 'plaidMainBuildProviderAvailableCreditRow_(', 'plaidMainBuildDateRow_(');
assert.match(availableCredit, /informational: true/);
assert.match(availableCredit, /AVAILABLE_CREDIT/);
assert.doesNotMatch(availableCredit, /applyKey/);

assert.match(liabilities, /numericFact\(facts, 'CURRENT_BALANCE'/);
assert.match(liabilities, /numericFact\(facts, 'AVAILABLE_CREDIT'/);
assert.match(liabilities, /numericFact\(facts, 'CREDIT_LIMIT'/);
assert.match(liabilities, /numericFact\(facts, 'STATEMENT_BALANCE'/);
assert.match(liabilities, /factType: 'STATEMENT_DATE'/);
assert.match(liabilities, /numericFact\(facts, 'MINIMUM_PAYMENT'/);
assert.match(liabilities, /factType: 'NEXT_PAYMENT_DATE'/);
assert.match(liabilities, /purchase_apr: 'PURCHASE_APR'/);
assert.match(liabilities, /MORTGAGE_FACTS = Object\.freeze\(\['CURRENT_BALANCE'\]\)/);

const providerPreview = sliceFn(client, 'debtActivityProviderCall_(', 'confirmDebtActivityProviderApply_(');
assert.match(providerPreview, /plaidImportConnectedAccountsState/);
assert.match(providerPreview, /\{ domain: 'DEBT' \}/);
assert.match(providerPreview, /debtActivityProviderIsMappedDebt_/);
assert.match(providerPreview, /plaidMainRenderPreviewAccount_/);
assert.match(providerPreview, /applyHost: 'debtActivity'/);
assert.match(providerPreview, /CashCompass debt account/);
assert.match(providerPreview, /Provider account/);
assert.match(providerPreview, /plaidMainRenderProviderImportTiming_|plaidMainRenderPreviewAccount_/);
assert.doesNotMatch(providerPreview, /debt-activity-provider-comparison-table/);
assert.doesNotMatch(providerPreview, /textContent = 'CURRENT_BALANCE'/);
assert.doesNotMatch(providerPreview, /Apply this Balance|fieldLabel: 'Balance'/);
assert.doesNotMatch(providerPreview, /auto-match|autoMatch|auto-apply|autoApply/i);
assert.doesNotMatch(providerPreview, /plaidMainCall_\('plaidImportApplyDebtUpdates'/);
assert.doesNotMatch(providerPreview, /CREDIT_LEFT|ACCT_PCT_AVAIL|AVAILABLE_CREDIT/);

const previewLoad = sliceFn(client, 'previewDebtActivityProviderAccount_(', 'confirmDebtActivityProviderApply_(');
assert.match(previewLoad, /debtActivityProviderStartPreviewRequest_/);
assert.match(previewLoad, /debtActivityProviderFinishPreviewRequest_/);
assert.match(previewLoad, /debtActivityProviderFindRowByKey_/);
assert.match(previewLoad, /plaidImportPreviewMapped/);
assert.match(previewLoad, /plaidMainNormalizeAccountPreviewBundle_|debtActivityProviderPreviewBundle_/);
assert.match(previewLoad, /plaidMainStoreAccountPreviewBundle_|debtActivityProviderStorePreview_/);
assert.doesNotMatch(previewLoad, /previewingKey\s*=/);
assert.doesNotMatch(previewLoad, /previewingKey !== key/);
assert.doesNotMatch(previewLoad, /plaidImportApplyDebtUpdatesFromAccountActivity|plaidImportApplyDebtUpdates_|updateDebtField|confirmed: true/);
assert.doesNotMatch(previewLoad, /loadDebtSection|refreshMonthlyCheckinAfterDebtMutation_/);

const previewListLoad = sliceFn(client, 'loadDebtActivityProviderPreview_(', 'renderDebtActivityProviderList_(');
assert.match(previewListLoad, /previousByKey/);
assert.match(previewListLoad, /nextRow\.preview = previous\.preview/);
assert.doesNotMatch(previewListLoad, /previewingKey\s*=/);
assert.doesNotMatch(previewListLoad, /previewingKeys\s*=\s*Object\.create\(null\)/);
assert.doesNotMatch(previewListLoad, /plaidImportApplyDebtUpdatesFromAccountActivity|updateDebtField/);

const previewCard = sliceFn(client, 'renderDebtActivityProviderCard_(', 'renderDebtActivityProviderComparison_(');
assert.match(previewCard, /debtActivityProviderIsPreviewing_\(__debtActivityProviderState, key\)/);
assert.match(previewCard, /if \(row\.preview\)/);
assert.match(previewCard, /Loading preview…/);
assert.doesNotMatch(previewCard, /previewingKey === key/);

const comparison = sliceFn(client, 'renderDebtActivityProviderComparison_(', 'previewDebtActivityProviderAccount_(');
assert.match(comparison, /plaidMainRenderPreviewAccount_/);
assert.match(comparison, /applyHost: 'debtActivity'/);
assert.match(comparison, /onRerender:/);
assert.match(comparison, /confirmDebtActivityProviderApply_\(index\)/);
assert.doesNotMatch(comparison, /debtActivityProviderSupportedFields_|Apply this Balance/);

const previewHelpers = sliceFn(
  client,
  'debtActivityProviderAccountKey_(',
  'loadDebtActivityProviderPreview_('
);
const previewState = {
  previewingKeys: Object.create(null),
  rows: [
    {
      connection: { protectedConnectionKey: 'conn-a' },
      account: { protectedAccountKey: 'acct-a' },
      preview: { observedAt: 'A' }
    },
    {
      connection: { protectedConnectionKey: 'conn-b' },
      account: { protectedAccountKey: 'acct-b' },
      preview: null
    }
  ]
};
const previewVm = vm.createContext({ Object });
vm.runInContext(previewHelpers, previewVm);
const keyA = previewVm.debtActivityProviderAccountKey_(previewState.rows[0]);
const keyB = previewVm.debtActivityProviderAccountKey_(previewState.rows[1]);
assert.equal(previewVm.debtActivityProviderStartPreviewRequest_(previewState, keyA), true,
  'Account A loading starts');
assert.equal(previewVm.debtActivityProviderStartPreviewRequest_(previewState, keyA), false,
  'duplicate preview for the same account is prevented');
assert.equal(previewVm.debtActivityProviderStartPreviewRequest_(previewState, keyB), true,
  'Account B can start while Account A is loading');
assert.equal(previewVm.debtActivityProviderIsPreviewing_(previewState, keyA), true);
assert.equal(previewVm.debtActivityProviderIsPreviewing_(previewState, keyB), true);
const keptWhileBLoads = previewVm.debtActivityProviderKeepOtherPreviews_(
  previewState.rows, keyB, { observedAt: 'B-loading' }
);
assert.equal(keptWhileBLoads[keyA].observedAt, 'A',
  'completed Account A remains visible while Account B loads');
previewVm.debtActivityProviderFinishPreviewRequest_(previewState, keyA);
previewState.rows[0].preview = { observedAt: 'A-done' };
assert.equal(previewVm.debtActivityProviderIsPreviewing_(previewState, keyA), false,
  'Account A continues and eventually renders');
assert.equal(previewVm.debtActivityProviderIsPreviewing_(previewState, keyB), true,
  'Account B stays loading after Account A finishes');
previewVm.debtActivityProviderFinishPreviewRequest_(previewState, keyB);
const foundB = previewVm.debtActivityProviderFindRowByKey_(previewState.rows, keyB);
foundB.preview = { observedAt: 'B-done' };
assert.equal(previewState.rows[0].preview.observedAt, 'A-done',
  'Account A remains after Account B renders');
assert.equal(previewState.rows[1].preview.observedAt, 'B-done',
  'Account B eventually renders');

const connectedPreview = sliceFn(plaidClient, 'plaidMainRenderPreviewAccount_(', 'plaidMainRenderAssociationSelect_(');
assert.match(connectedPreview, /'Apply Selected Updates'/);
assert.match(connectedPreview, /Select approved fields, then Apply Selected Updates/);
assert.match(connectedPreview, /plaidMainApplySelectedUpdates_/);
assert.match(connectedPreview, /applyHost === 'debtActivity'/);
assert.match(connectedPreview, /Confirm account, field, and value/);
assert.match(connectedPreview, /applyBtn\.disabled = applying \|\| applyCount < 1/);
assert.doesNotMatch(connectedPreview, /plaidImportApplyDebtUpdatesFromAccountActivity/);
assert.doesNotMatch(
  sliceFn(plaidClient, 'plaidMainBuildAccountCard_(', 'plaidMainPatchAccountCard_('),
  /plaidMainRenderPreviewAccount_\([\s\S]{0,120}applyHost/
);
assert.match(
  sliceFn(plaidClient, 'plaidMainBuildAccountCard_(', 'plaidMainPatchAccountCard_('),
  /plaidMainRenderPreviewAccount_\(domain, connection, account, accountCard, preview, reviewPanelId\);/
);

const connectedApply = sliceFn(plaidClient, 'plaidMainApplySelectedUpdates_(', 'plaidMainRenderInlineAprControls_(');
assert.match(connectedApply, /plaidMainApplyRpcName_\(accountDomain\)/);
assert.doesNotMatch(connectedApply, /confirmed: true/);
assert.doesNotMatch(connectedApply, /plaidImportApplyDebtUpdatesFromAccountActivity/);
assert.doesNotMatch(connectedApply, /openDebtAccountActivityDrawer_/);
assert.doesNotMatch(connectedApply, /guardStaleDueDate|applyHost: 'debtActivity'/);

const applyCall = sliceFn(client, 'confirmDebtActivityProviderApply_(');
assert.match(applyCall, /plaidImportApplyDebtUpdatesFromAccountActivity/);
assert.match(applyCall, /confirmed: true/);
assert.match(applyCall, /plaidMainEligibleApplyKeySet_/);
assert.match(applyCall, /plaidMainPruneStaleApplySelections_/);
assert.match(applyCall, /applyHost: 'debtActivity'/);
assert.match(applyCall, /selectedApplyKeys: keys/);
assert.match(applyCall, /Select a changed field before applying/);
assert.ok(
  applyCall.indexOf('plaidMainEligibleApplyKeySet_') <
    applyCall.indexOf("plaidImportApplyDebtUpdatesFromAccountActivity"),
  'matching fields must be pruned before the Plaid apply RPC'
);
assert.doesNotMatch(applyCall, /selectedApplyKeys: \['CURRENT_BALANCE'\]/);
assert.doesNotMatch(applyCall, /CREDIT_LEFT|ACCT_PCT_AVAIL|AVAILABLE_CREDIT/);
assert.doesNotMatch(
  applyCall,
  /plaidImportApplyDebtUpdatesFromAccountActivity', \{[\s\S]*?(accountName:|value:|newValue:|fieldName:)/
);
assert.doesNotMatch(applyCall, /plaidMainCall_\('plaidImportApplyDebtUpdates'/);

assert.match(styles, /#bank_activity_provider_list[\s\S]*?bank-activity-provider-comparison-table[\s\S]*?table-layout:\s*fixed/);
assert.match(
  styles,
  /@media \(max-width:\s*640px\)\s*\{\s*#bank_activity_provider_list[\s\S]*?table-layout:\s*auto/
);
assert.match(styles, /#debt_activity_drawer[\s\S]*?overflow-x:\s*hidden/);
assert.match(styles, /#debt_activity_drawer \.bill-pay-drawer-body[\s\S]*?overflow-x:\s*hidden/);
assert.match(
  styles,
  /#debt_activity_drawer \.plaid-main-comparison-table[\s\S]*?table-layout:\s*fixed[\s\S]*?max-width:\s*100%/
);
assert.match(
  styles,
  /#debt_activity_drawer \.plaid-main-comparison-table td\.plaid-main-num:not\(\.plaid-main-change-cell\)[\s\S]*?text-align:\s*right[\s\S]*?white-space:\s*nowrap/
);
assert.match(
  styles,
  /#debt_activity_drawer \.plaid-main-comparison-table td\.plaid-main-change-cell[\s\S]*?white-space:\s*normal[\s\S]*?overflow-wrap:\s*anywhere/
);
assert.match(styles, /#debt_activity_drawer \.tracked-editor-actions[\s\S]*?max-width:\s*100%/);
assert.match(
  styles,
  /@media \(max-width:\s*640px\)[\s\S]*?#debt_activity_drawer \.plaid-main-comparison-table[\s\S]*?table-layout:\s*auto/
);

const aprRowCssStart = styles.indexOf('#debt_activity_drawer .debt-activity-apr-row');
assert.ok(aprRowCssStart >= 0, 'Debt activity APR row layout CSS must exist');
const aprRowCss = styles.slice(
  aprRowCssStart,
  styles.indexOf('.investment-portfolio-account-help', aprRowCssStart)
);
assert.match(
  styles,
  /#debt_activity_drawer \.plaid-main-comparison-table td\.plaid-main-num\[data-label="Imported"\][\s\S]*?width:\s*26%/
);
assert.match(aprRowCss, /td\.plaid-main-num\[data-label="Imported"\][\s\S]*?white-space:\s*normal/);
assert.match(aprRowCss, /debt-activity-apr-imported-wrap[\s\S]*?flex-direction:\s*column/);
assert.match(aprRowCss, /debt-activity-apr-imported-value[\s\S]*?white-space:\s*nowrap[\s\S]*?text-align:\s*right/);
assert.match(aprRowCss, /debt-activity-apr-imported-source[\s\S]*?white-space:\s*normal[\s\S]*?overflow-wrap:\s*anywhere/);
assert.match(aprRowCss, /debt-activity-apr-row \.plaid-main-change-cell[\s\S]*?flex-direction:\s*column/);
assert.match(aprRowCss, /debt-activity-apr-change-value[\s\S]*?text-align:\s*right[\s\S]*?white-space:\s*nowrap/);
assert.match(aprRowCss, /debt-activity-apr-actions[\s\S]*?width:\s*100%/);
assert.match(aprRowCss, /debt-activity-apr-actions[\s\S]*?plaid-main-apr-source-toggle[\s\S]*?visibility:\s*visible/);
assert.doesNotMatch(aprRowCss, /position:\s*absolute/);
assert.doesNotMatch(aprRowCss, /text-overflow:\s*ellipsis/);
assert.match(
  aprRowCss,
  /@media \(max-width:\s*640px\)[\s\S]*?debt-activity-apr-row[\s\S]*?flex-direction:\s*column[\s\S]*?debt-activity-apr-actions[\s\S]*?align-self:\s*stretch/
);

const intRateReview = sliceFn(plaidClient, 'plaidMainBuildIntRateReview_(', 'plaidMainCanonicalMapForDomain_(');
assert.match(intRateReview, /importedAprValue:\s*plaidMainFormatPercent_\(importedNum\)/);
assert.match(intRateReview, /importedAprSourceLabel:\s*plaidMainFactLabel_\(preference\.sourceSemantic\)/);
assert.match(intRateReview, /canChangeAprSource:\s*true/);

assert.match(plaidClient, /function plaidMainIsAprReviewRow_/);

const comparisonTable = sliceFn(plaidClient, 'plaidMainRenderComparisonTable_(', 'plaidMainSaveAprPreference_(');
assert.match(comparisonTable, /Apply', 'Item', 'CashCompass', 'Imported', 'Change'/);
assert.match(comparisonTable, /debt-activity-review-table/);
assert.match(comparisonTable, /plaid-main-num/);
assert.match(comparisonTable, /plaid-main-change-cell/);
assert.match(comparisonTable, /renderAprControls/);
assert.match(comparisonTable, /plaidMainApplySelectable_/);
assert.match(comparisonTable, /change === 'Same'|plaidMainApplySelectable_/);
assert.match(comparisonTable, /debt-activity-apr-row/);
assert.match(comparisonTable, /debt-activity-apr-imported-wrap/);
assert.match(comparisonTable, /debt-activity-apr-imported-value/);
assert.match(comparisonTable, /debt-activity-apr-imported-source/);
assert.match(comparisonTable, /debt-activity-apr-change-value/);
assert.match(comparisonTable, /debt-activity-apr-actions/);
assert.match(
  comparisonTable,
  /debt-activity-apr-change-value[\s\S]*?debt-activity-apr-actions[\s\S]*?plaidMainRenderInlineAprControls_/
);
assert.match(
  comparisonTable,
  /fromActivityApr && cell\.key === 'imported'[\s\S]*?importedAprSourceLabel/
);

const aprControls = sliceFn(plaidClient, 'plaidMainRenderInlineAprControls_(', 'plaidMainIsAprReviewRow_(');
assert.match(aprControls, /Change APR source/);
assert.match(aprControls, /toggle\.type = 'button'/);
assert.match(aprControls, /plaidMainSaveAprPreference_/);

const technicalDetails = sliceFn(plaidClient, 'plaidMainRenderTechnicalDetails_(', 'plaidMainRenderPreviewAccount_(');
assert.match(technicalDetails, /plaidMainElement_\('details', 'plaid-main-technical'\)/);
assert.doesNotMatch(technicalDetails, /\.open\s*=\s*true|setAttribute\('open'/);

assert.match(
  sliceFn(plaidClient, 'plaidMainRenderPreviewAccount_(', 'plaidMainRenderAssociationSelect_('),
  /Confirm account, field, and value/
);
assert.match(
  sliceFn(plaidClient, 'plaidMainRenderPreviewAccount_(', 'plaidMainRenderAssociationSelect_('),
  /debt-activity-review-panel/
);

assert.match(plaidClient, /function plaidMainImportData_/);
assert.match(plaidClient, /function plaidMainApplySelectedUpdates_/);
assert.match(plaidClient, /Apply Selected Updates/);
assert.match(plaidClient, /plaidImportApplyDebtUpdates/);
assert.match(plaidClient, /function plaidMainOpenDebtAccountActivityFromImportData_/);
assert.match(
  sliceFn(plaidClient, 'plaidMainRenderAccountActions_(', 'plaidMainAccountDomId_('),
  /plaidMainOpenBankAccountActivityFromImportData_\(\)[\s\S]*?plaidMainOpenDebtAccountActivityFromImportData_\(connection, account\)[\s\S]*?plaidMainImportData_\(domain, connection, account\)/
);
assert.match(
  sliceFn(plaidClient, 'plaidMainOpenDebtAccountActivityFromImportData_(', 'plaidMainImportData_('),
  /openDebtAccountActivityDrawer_\('provider'/
);
assert.match(
  sliceFn(plaidClient, 'plaidMainOpenDebtAccountActivityFromImportData_(', 'plaidMainImportData_('),
  /protectedConnectionKey: connection && connection\.protectedConnectionKey/
);
assert.match(
  sliceFn(plaidClient, 'plaidMainOpenDebtAccountActivityFromImportData_(', 'plaidMainImportData_('),
  /protectedAccountKey: account && account\.protectedAccountKey/
);
assert.match(
  sliceFn(plaidClient, 'plaidMainOpenDebtAccountActivityFromImportData_(', 'plaidMainImportData_('),
  /autoPreview: true/
);
assert.doesNotMatch(
  sliceFn(plaidClient, 'plaidMainOpenDebtAccountActivityFromImportData_(', 'plaidMainImportData_('),
  /plaidImportApplyDebtUpdates|updateDebtField|confirmed: true/
);
assert.doesNotMatch(plaidClient, /plaidImportApplyDebtUpdatesFromAccountActivity/);
assert.doesNotMatch(plaidClient, /confirmDebtActivityProviderApply_/);
assert.doesNotMatch(plaidClient, /loadDebtActivityProviderPreview_/);

assert.doesNotMatch(bankClient, /openDebtAccountActivityDrawer_|debt_activity_drawer/);
assert.doesNotMatch(houseClient, /openDebtAccountActivityDrawer_|debt_activity_drawer/);
assert.doesNotMatch(invClient, /openDebtAccountActivityDrawer_|debt_activity_drawer/);
assert.doesNotMatch(sidebar, /debt_activity_drawer/);
assert.doesNotMatch(
  body.slice(body.indexOf('id="bank"'), body.indexOf('id="investments"')),
  /debt_activity_drawer|Debt activity/
);

assert.match(debtImport, /This module is shadow-only/);
assert.match(debtImport, /It never writes INPUT - Debts/);
assert.doesNotMatch(debtImport, /updateDebtField\(/);
assert.doesNotMatch(debtImport, /plaidImportApplyDebtUpdates/);
assert.doesNotMatch(debtImport, /openDebtAccountActivityDrawer_/);

const activityApplyGate = sliceFn(
  bridge,
  'plaidImportAssertAccountActivityDebtApplyPayload_(',
  'plaidImportApplyDebtUpdatesFromAccountActivity('
);
const activityApplyWrapper = sliceFn(
  bridge,
  'plaidImportApplyDebtUpdatesFromAccountActivity(',
  'plaidImportDisconnect('
);
const applyInner = sliceFn(
  bridge,
  'plaidImportApplyDebtUpdates_(',
  'plaidImportBalanceDateFromPreview_('
);
assert.match(activityApplyWrapper, /plaidImportAssertAccountActivityDebtApplyPayload_/);
assert.match(activityApplyWrapper, /plaidImportApplyDebtUpdates_\(input, \{ guardStaleDueDate: true \}\)/);
assert.match(activityApplyWrapper, /plaidImportRejectBrowserAuthority_/);
assert.match(activityApplyWrapper, /plaidImportRejectApplyFinancialAuthority_/);
assert.doesNotMatch(activityApplyWrapper, /updateDebtField\(/);
assert.match(activityApplyGate, /PLAID_IMPORT_DEBT_APPLY_KEYS_/);
assert.match(activityApplyGate, /PLAID_IMPORT_DEBT_DERIVED_KEYS_/);
assert.match(applyInner, /updateDebtField\(/);
assert.match(applyInner, /PLAID_IMPORT_DEBT_DERIVED_KEYS_/);
assert.match(applyInner, /recalcDebtDerivedCreditFieldsForRow_/);
assert.doesNotMatch(applyInner, /CREDIT_LEFT: 'Credit Left'|ACCT_PCT_AVAIL/);

const gateContext = vm.createContext({
  PLAID_IMPORT_DEBT_APPLY_KEYS_: {
    CURRENT_BALANCE: true,
    CREDIT_LIMIT: true,
    MINIMUM_PAYMENT: true,
    NEXT_PAYMENT_DATE: true,
    INT_RATE: true
  },
  PLAID_IMPORT_DEBT_DERIVED_KEYS_: {
    CREDIT_LEFT: true,
    CREDIT_LEFT_DERIVED: true,
    AVAILABLE_CREDIT: true,
    ACCT_PCT_AVAIL: true,
    UTILIZATION: true,
    PCT_AVAIL: true
  }
});
vm.runInContext(activityApplyGate, gateContext);
assert.throws(
  () => gateContext.plaidImportAssertAccountActivityDebtApplyPayload_({
    selectedApplyKeys: ['CURRENT_BALANCE']
  }),
  /Confirm the account, field, and value/
);
assert.throws(
  () => gateContext.plaidImportAssertAccountActivityDebtApplyPayload_({
    confirmed: false,
    selectedApplyKeys: ['CURRENT_BALANCE']
  }),
  /Confirm the account, field, and value/
);
assert.throws(
  () => gateContext.plaidImportAssertAccountActivityDebtApplyPayload_({ confirmed: true }),
  /Select at least one field/
);
assert.throws(
  () => gateContext.plaidImportAssertAccountActivityDebtApplyPayload_({
    confirmed: true,
    selectedApplyKeys: ['CREDIT_LEFT']
  }),
  /cannot be applied/
);
assert.throws(
  () => gateContext.plaidImportAssertAccountActivityDebtApplyPayload_({
    confirmed: true,
    selectedApplyKeys: ['AVAILABLE_CREDIT']
  }),
  /cannot be applied/
);
assert.throws(
  () => gateContext.plaidImportAssertAccountActivityDebtApplyPayload_({
    confirmed: true,
    selectedApplyKeys: ['ACCT_PCT_AVAIL']
  }),
  /cannot be applied/
);
assert.throws(
  () => gateContext.plaidImportAssertAccountActivityDebtApplyPayload_({
    confirmed: true,
    selectedApplyKeys: ['CURRENT_BALANCE', 'CREDIT_LEFT']
  }),
  /cannot be applied/
);
assert.throws(
  () => gateContext.plaidImportAssertAccountActivityDebtApplyPayload_({
    confirmed: true,
    selectedApplyKeys: ['STATEMENT_BALANCE']
  }),
  /Balance, APR, Minimum payment, Due date, and Credit Limit only/
);
gateContext.plaidImportAssertAccountActivityDebtApplyPayload_({
  confirmed: true,
  selectedApplyKeys: ['CURRENT_BALANCE']
});
gateContext.plaidImportAssertAccountActivityDebtApplyPayload_({
  confirmed: true,
  selectedApplyKeys: ['INT_RATE', 'MINIMUM_PAYMENT', 'NEXT_PAYMENT_DATE', 'CREDIT_LIMIT']
});

const staleServerSrc = [
  sliceFn(bridge, 'plaidImportFindPreviewRow_(', 'plaidImportDueDayFromIso_('),
  sliceFn(bridge, 'plaidImportParseIsoDateParts_(', 'plaidImportParseDueDayFromLegacy_(')
].join('\n');
assert.doesNotMatch(staleServerSrc, /recorded payment|markPaid|Cash Flow|updateDebtField/i);
const staleServerVm = vm.createContext({ Number, String, Array, Object });
vm.runInContext(staleServerSrc, staleServerVm);
assert.equal(
  staleServerVm.plaidImportProviderDueDateNeedsStaleReview_({
    candidate: { textValue: '2026-09-10' },
    effectiveAsOf: ''
  }, '2026-09-21'),
  true,
  'activity apply blocks a past provider due date with no effective timestamp'
);
assert.equal(
  staleServerVm.plaidImportProviderDueDateNeedsStaleReview_({
    candidate: { textValue: '2026-09-25' },
    effectiveAsOf: ''
  }, '2026-09-21'),
  false,
  'activity apply still allows a future provider due date'
);
assert.throws(
  () => staleServerVm.plaidImportAssertSelectedDueDateNotStale_(
    ['NEXT_PAYMENT_DATE'],
    { rows: [{ factType: 'NEXT_PAYMENT_DATE', candidate: { textValue: '2026-09-10' }, effectiveAsOf: '' }] },
    '2026-09-21'
  ),
  /Not applied — this provider due date has already passed and no valid effective date was provided/
);
staleServerVm.plaidImportAssertSelectedDueDateNotStale_(
  ['CURRENT_BALANCE'],
  { rows: [{ factType: 'NEXT_PAYMENT_DATE', candidate: { textValue: '2026-09-10' }, effectiveAsOf: '' }] },
  '2026-09-21'
);
staleServerVm.plaidImportAssertSelectedDueDateNotStale_(
  ['NEXT_PAYMENT_DATE'],
  { rows: [{ factType: 'NEXT_PAYMENT_DATE', candidate: { textValue: '2026-09-30' }, effectiveAsOf: '' }] },
  '2026-09-21'
);

const activityApplyInnerCall = sliceFn(
  bridge,
  'plaidImportApplyDebtUpdatesFromAccountActivity(',
  'plaidImportDisconnect('
);
assert.match(activityApplyInnerCall, /guardStaleDueDate: true/);
assert.match(
  sliceFn(bridge, 'plaidImportApplyDebtUpdates_(', 'plaidImportBalanceDateFromPreview_('),
  /options\.guardStaleDueDate/
);
assert.match(
  sliceFn(bridge, 'plaidImportApplyDebtUpdates(', 'plaidImportApplyDebtUpdates_('),
  /plaidImportApplyDebtUpdates_\(payload\)/
);
assert.doesNotMatch(
  sliceFn(bridge, 'plaidImportApplyDebtUpdates(', 'plaidImportApplyDebtUpdates_('),
  /guardStaleDueDate/
);

assert.doesNotMatch(debtsPanel, /automatically updates Planning/);
assert.match(drawer, /Credit Left and Provider Available Credit are derived or informational only/);

console.log('debt account activity regressions passed');
