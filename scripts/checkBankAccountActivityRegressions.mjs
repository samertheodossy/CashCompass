import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read = (name) => fs.readFileSync(new URL('../' + name, import.meta.url), 'utf8');
const body = read('Dashboard_Body.html');
const help = read('Dashboard_Help.html');
const client = read('Dashboard_Script_AssetsBankInvestments.html');
const bankImport = read('bank_import.js');
const plaidClient = read('Dashboard_Script_PlaidConnectedAccounts.html');
const sidebar = read('PlannerDashboard.html');

const manage = body.slice(body.indexOf('id="bank_mode_manage_wrap"'), body.indexOf('id="bank_mode_connected_wrap"'));
const drawer = body.slice(body.indexOf('id="bank_activity_drawer_backdrop"'), body.indexOf('id="investments"'));
assert.match(body, /id="inv_portfolio_activity_btn"/);
assert.match(body, /id="inv_portfolio_drawer"/);
assert.match(body, />Portfolio activity</);

assert.match(manage, /id="bank_account_activity_btn"/);
assert.match(manage, /Account activity/);
assert.doesNotMatch(manage, /Review pending imports/);
assert.doesNotMatch(manage, /id="bank_mode_import_btn"/);
assert.doesNotMatch(body, /id="bank_mode_import_btn"/);
assert.match(drawer, /id="bank_activity_csv_btn"/);
assert.match(drawer, /id="bank_activity_provider_btn"/);
assert.match(drawer, /Connected provider \/ Plaid/);
assert.match(drawer, /Review pending imports/);
assert.match(drawer, /Paste CSV/);
assert.match(drawer, /Add as new/);
assert.match(drawer, /id="bank_import_csv_preview_btn"/);
assert.match(drawer, /Preview/);
assert.match(drawer, /Preview does not write/);
assert.match(body, /Import Data opens Account activity, where you can preview provider data and confirm any balance changes\./);
assert.doesNotMatch(
  body.slice(body.indexOf('id="bank_mode_connected_wrap"'), body.indexOf('id="bank_status"')),
  /Apply Selected Updates/
);
assert.match(help, /Account activity/);
assert.match(help, /Connected provider/);
assert.match(help, /Import Data[\s\S]*?opens Account activity/);
assert.match(client, /function openBankAccountActivityDrawer_/);
assert.match(client, /function setBankAccountActivityView_/);
assert.match(client, /function loadBankActivityProviderPreview_/);
assert.match(client, /function previewBankActivityProviderAccount_/);
assert.match(client, /function confirmBankActivityProviderApply_/);
assert.match(client, /plaidImportConnectedAccountsState/);
assert.match(client, /plaidImportPreviewMapped/);
assert.match(client, /Confirm account, month, and balance/);
assert.match(client, /applyStagedBankAccountBalance\(\{\s*stagingId:\s*stagingId,\s*confirmed:\s*true\s*\}\)/);
assert.match(client, /function confirmBankImportReviewAddNew_[\s\S]*?addStagedBankAccountAsNew/);
assert.match(client, /function confirmBankImportReviewMatch_[\s\S]*?matchStagedBankAccountToExisting/);
assert.match(client, /function confirmBankImportReviewIgnore_[\s\S]*?ignoreStagedBankAccount/);
assert.match(client, /function bankImportCsvPastePreview_[\s\S]*?function confirmBankImportCsvPasteStage_/);
assert.doesNotMatch(
  client.slice(client.indexOf('function bankImportCsvPastePreview_('), client.indexOf('function confirmBankImportCsvPasteStage_(')),
  /applyStagedBankAccountBalance|updateBankAccountsHistory_/
);
const providerPreview = sliceFn(client, 'bankActivityProviderCall_(', 'renderBankManageList_(');
assert.match(providerPreview, /plaidImportConnectedAccountsState/);
assert.match(providerPreview, /plaidImportPreviewMapped/);
assert.match(providerPreview, /CONFIRMED/);
assert.match(providerPreview, /factType \|\| ''\) === 'CURRENT_BALANCE'/);
assert.match(providerPreview, /Preview current balance/);
assert.match(providerPreview, /textContent = 'Current balance'/);
assert.doesNotMatch(providerPreview, /Preview CURRENT_BALANCE/);
assert.doesNotMatch(providerPreview, /textContent = 'CURRENT_BALANCE'/);
assert.doesNotMatch(drawer, /CURRENT_BALANCE/);
assert.match(providerPreview, /cashCompassApplyContext/);
assert.match(providerPreview, /Preview does not write/);
assert.match(providerPreview, /Select Current balance/);
assert.match(providerPreview, /Confirm account, month, and balance/);
assert.match(providerPreview, /bank-activity-provider-comparison-table/);
assert.match(providerPreview, /plaid-main-num bank-activity-provider-num/);
assert.match(providerPreview, /bank-activity-provider-col-item/);
assert.match(providerPreview, /bank-activity-provider-col-num/);
assert.match(providerPreview, /data-label/);
assert.match(providerPreview, /Already matches\./);
assert.match(providerPreview, /Apply this Current balance/);
assert.match(providerPreview, /hasMonth \? bankActivityProviderMoney_\(facts\.monthValue\) : '—'/);
assert.match(providerPreview, /Unknown is not \$0/);
assert.match(providerPreview, /Target month/);
assert.match(providerPreview, /Source timestamp/);
assert.match(providerPreview, /numericValue !== null/);
assert.match(providerPreview, /isFinite\(Number\(candidate\.numericValue\)\)/);
assert.match(providerPreview, /selectedCurrentBalance = false/);
assert.match(providerPreview, /plaidImportApplyCashUpdatesFromAccountActivity/);
assert.match(providerPreview, /selectedApplyKeys: \['CURRENT_BALANCE'\]/);
assert.match(providerPreview, /confirmed: true/);
assert.doesNotMatch(providerPreview, /plaidMainCall_\('plaidImportApplyCashUpdates'/);
assert.doesNotMatch(
  sliceFn(client, 'loadBankActivityProviderPreview_(', 'renderBankActivityProviderList_('),
  /plaidImportApplyCashUpdatesFromAccountActivity|plaidImportApplyCashUpdates_/
);
assert.doesNotMatch(
  sliceFn(client, 'previewBankActivityProviderAccount_(', 'confirmBankActivityProviderApply_('),
  /plaidImportApplyCashUpdatesFromAccountActivity|confirmed: true/
);
const previewLoad = sliceFn(client, 'previewBankActivityProviderAccount_(', 'confirmBankActivityProviderApply_(');
assert.match(previewLoad, /bankActivityProviderStartPreviewRequest_/);
assert.match(previewLoad, /bankActivityProviderFinishPreviewRequest_/);
assert.match(previewLoad, /bankActivityProviderFindRowByKey_/);
assert.doesNotMatch(previewLoad, /previewingKey\s*=/);
assert.doesNotMatch(previewLoad, /previewingKey !== key/);
assert.doesNotMatch(previewLoad, /current\.preview = null|row\.preview = null/);
const previewListLoad = sliceFn(client, 'loadBankActivityProviderPreview_(', 'renderBankActivityProviderList_(');
assert.match(previewListLoad, /previousByKey/);
assert.match(previewListLoad, /nextRow\.preview = previous\.preview/);
assert.doesNotMatch(previewListLoad, /previewingKey\s*=/);
assert.doesNotMatch(previewListLoad, /previewingKeys\s*=\s*Object\.create\(null\)/);
const previewCard = sliceFn(client, 'renderBankActivityProviderCard_(', 'renderBankActivityProviderComparison_(');
assert.match(previewCard, /bankActivityProviderIsPreviewing_\(__bankActivityProviderState, key\)/);
assert.match(previewCard, /if \(row\.preview\)/);
assert.match(previewCard, /Loading preview…/);
assert.doesNotMatch(previewCard, /previewingKey === key/);

const previewHelpers = sliceFn(
  client,
  'bankActivityProviderAccountKey_(',
  'bankActivityProviderCurrentBalanceFacts_('
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
const keyA = previewVm.bankActivityProviderAccountKey_(previewState.rows[0]);
const keyB = previewVm.bankActivityProviderAccountKey_(previewState.rows[1]);
assert.equal(previewVm.bankActivityProviderStartPreviewRequest_(previewState, keyA), true,
  'Account A loading starts');
assert.equal(previewVm.bankActivityProviderStartPreviewRequest_(previewState, keyA), false,
  'duplicate preview for the same account is prevented');
assert.equal(previewVm.bankActivityProviderStartPreviewRequest_(previewState, keyB), true,
  'Account B can start while Account A is loading');
assert.equal(previewVm.bankActivityProviderIsPreviewing_(previewState, keyA), true);
assert.equal(previewVm.bankActivityProviderIsPreviewing_(previewState, keyB), true);
const keptWhileBLoads = previewVm.bankActivityProviderKeepOtherPreviews_(
  previewState.rows, keyB, { observedAt: 'B-loading' }
);
assert.equal(keptWhileBLoads[keyA].observedAt, 'A',
  'completed Account A remains visible while Account B loads');
previewVm.bankActivityProviderFinishPreviewRequest_(previewState, keyA);
previewState.rows[0].preview = { observedAt: 'A-done' };
assert.equal(previewVm.bankActivityProviderIsPreviewing_(previewState, keyA), false,
  'Account A continues and eventually renders');
assert.equal(previewVm.bankActivityProviderIsPreviewing_(previewState, keyB), true,
  'Account B stays loading after Account A finishes');
previewVm.bankActivityProviderFinishPreviewRequest_(previewState, keyB);
const foundB = previewVm.bankActivityProviderFindRowByKey_(previewState.rows, keyB);
foundB.preview = { observedAt: 'B-done' };
assert.equal(previewState.rows[0].preview.observedAt, 'A-done',
  'Account A remains after Account B renders');
assert.equal(previewState.rows[1].preview.observedAt, 'B-done',
  'Account B eventually renders');

const matchHelpers = sliceFn(
  client,
  'bankActivityProviderDiffMatches_(',
  'bankActivityProviderAccountKey_('
);
const matchVm = vm.createContext({ Number, Math, isFinite, Object });
vm.runInContext(matchHelpers, matchVm);
assert.equal(matchVm.bankActivityProviderDiffMatches_(0), true);
assert.equal(matchVm.bankActivityProviderDiffMatches_(0.001), true);
assert.equal(matchVm.bankActivityProviderDiffMatches_(-0.004), true);
assert.equal(matchVm.bankActivityProviderDiffMatches_(0.006), false);
assert.equal(matchVm.bankActivityProviderDiffMatches_(null), false);
assert.equal(matchVm.bankActivityProviderIsAlreadyCurrent_({
  hasMonth: true, providerValue: 1200, diff: 0
}), true);
assert.equal(matchVm.bankActivityProviderIsAlreadyCurrent_({
  hasMonth: true, providerValue: 1200, diff: 25
}), false);
assert.equal(matchVm.bankActivityProviderIsAlreadyCurrent_({
  hasMonth: false, providerValue: 0, diff: null
}), false, 'missing CashCompass months are not treated as $0 matches');

assert.doesNotMatch(providerPreview, /Apply Selected Updates/);
assert.doesNotMatch(providerPreview, /stageBankImportPasteRows/);
assert.doesNotMatch(providerPreview, /processBankImportBatch_/);
assert.doesNotMatch(providerPreview, /matchStagedBankAccountToExisting/);
assert.doesNotMatch(providerPreview, /addStagedBankAccountAsNew/);
assert.doesNotMatch(providerPreview, /applyStagedBankAccountBalance/);
assert.doesNotMatch(providerPreview, /updateAccountsSheetFields_/);
assert.doesNotMatch(providerPreview, /updateAvailableNow|updateMinBuffer|setAvailableFromOpening|setMinBufferFromOpening/);
assert.doesNotMatch(providerPreview, /newValue:/);
const applyCall = sliceFn(client, 'confirmBankActivityProviderApply_(', 'renderBankManageList_(');
assert.match(applyCall, /plaidImportApplyCashUpdatesFromAccountActivity/);
assert.match(applyCall, /confirmed: true/);
assert.match(applyCall, /selectedApplyKeys: \['CURRENT_BALANCE'\]/);
assert.match(applyCall, /Available Now, Min Buffer, Use policy, and Priority were not changed/);
assert.doesNotMatch(applyCall, /updateAvailableNow|updateMinBuffer/);
assert.doesNotMatch(
  applyCall,
  /plaidImportApplyCashUpdatesFromAccountActivity', \{[\s\S]*?(accountName:|value:|newValue:)/
);
assert.match(applyCall, /bankActivityProviderIsAlreadyCurrent_/);
assert.match(applyCall, /Already matches\. No update is needed/);
assert.ok(
  applyCall.indexOf('bankActivityProviderIsAlreadyCurrent_') <
    applyCall.indexOf("plaidImportApplyCashUpdatesFromAccountActivity"),
  'matching balances must not reach the Plaid apply RPC'
);
const applyControls = sliceFn(
  client,
  'renderBankActivityProviderApplyControls_(',
  'previewBankActivityProviderAccount_('
);
assert.match(applyControls, /Already matches\./);
assert.match(applyControls, /Apply this Current balance/);
assert.match(applyControls, /Confirm account, month, and balance/);
assert.match(
  applyControls,
  /bankActivityProviderIsAlreadyCurrent_\(facts\)[\s\S]*?Already matches\.[\s\S]*?return wrap/
);
assert.ok(
  applyControls.indexOf('Already matches.') < applyControls.indexOf('Apply this Current balance'),
  'matching rows show Already matches before any apply control'
);
assert.doesNotMatch(
  applyControls.slice(0, applyControls.indexOf('return wrap')),
  /Apply this Current balance|Confirm account, month, and balance|type = 'checkbox'/,
  'matching rows must not render an apply control'
);
assert.match(
  applyControls.slice(applyControls.indexOf('return wrap')),
  /Apply this Current balance[\s\S]*?Confirm account, month, and balance/,
  'changed rows retain the apply checkbox and confirmation button'
);
const styles = read('Dashboard_Styles.html');
assert.match(styles, /#bank_activity_provider_list[\s\S]*?bank-activity-provider-comparison-table[\s\S]*?table-layout:\s*fixed/);
assert.match(styles, /#bank_activity_provider_list[\s\S]*?bank-activity-provider-num[\s\S]*?text-align:\s*right/);
assert.match(styles, /#bank_activity_provider_list[\s\S]*?font-variant-numeric:\s*tabular-nums/);
assert.match(
  styles,
  /@media \(max-width:\s*640px\)\s*\{\s*#bank_activity_provider_list[\s\S]*?table-layout:\s*auto/
);
assert.match(plaidClient, /openBankAccountActivityDrawer_\('provider'\)/);
assert.match(plaidClient, /function plaidMainOpenBankAccountActivityFromImportData_/);
assert.match(plaidClient, /function plaidMainApplySelectedUpdates_/);
assert.match(plaidClient, /plaidImportApplyCashUpdates/);
assert.match(plaidClient, /function plaidMainImportData_/);
assert.match(plaidClient, /function plaidMainApplySelectedUpdates_/);
assert.doesNotMatch(plaidClient, /plaidImportApplyCashUpdatesFromAccountActivity/);
assert.doesNotMatch(plaidClient, /confirmBankActivityProviderApply_/);
assert.doesNotMatch(plaidClient, /loadBankActivityProviderPreview_/);
assert.match(
  sliceFn(plaidClient, 'plaidMainRenderAccountActions_(', 'plaidMainAccountDomId_('),
  /plaidMainOpenBankAccountActivityFromImportData_\(\)[\s\S]*?plaidMainImportData_\(domain, connection, account\)/
);
assert.match(
  sliceFn(plaidClient, 'plaidMainOpenBankAccountActivityFromImportData_(', 'plaidMainImportData_('),
  /openBankAccountActivityDrawer_\('provider'\)/
);
assert.match(
  sliceFn(plaidClient, 'plaidMainBuildAccountCard_(', 'plaidMainPatchAccountCard_('),
  /plaidMainAccountDomain_\(account\) !== 'CASH'/
);
assert.doesNotMatch(
  sliceFn(plaidClient, 'plaidMainRenderPreviewAccount_(', 'plaidMainRenderAssociationSelect_('),
  /accountDomain === 'DEBT' \|\| accountDomain === 'CASH'/
);
assert.doesNotMatch(sidebar, /bank_activity_drawer/);
assert.doesNotMatch(body.slice(body.indexOf('id="debts"'), body.indexOf('id="retirement"')), /bank_activity_drawer/);

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

const ingest = sliceFn(bankImport, 'bankImportProcessSingleRow_(', 'bankImportBalanceEvidencePresent_');
assert.doesNotMatch(ingest, /bankImportApplyAutoMatchWrite_/);
assert.doesNotMatch(ingest, /updateBankAccountsHistory_/);
const addNew = sliceFn(bankImport, 'addStagedBankAccountAsNew(', 'matchStagedBankAccountToExisting(');
const match = sliceFn(bankImport, 'matchStagedBankAccountToExisting(', 'unlinkMatchedStagedBankAccount(');
const ignore = sliceFn(bankImport, 'ignoreStagedBankAccount(', 'Step 2d — Apply balance');
for (const [label, source] of [['add', addNew], ['match', match], ['ignore', ignore]]) {
  assert.doesNotMatch(source, /bankImportApplyAutoMatchWrite_/, label + ' must not write a balance');
  assert.doesNotMatch(source, /updateBankAccountsHistory_/, label + ' must not write a month cell');
}
const apply = sliceFn(bankImport, 'applyStagedBankAccountBalance(', 'bankImportPreCheckMonthCell_');
assert.match(apply, /payload\.confirmed !== true/);
assert.match(apply, /blank balance is not saved as \$0/);
assert.match(apply, /BANK_IMPORT_EXPLICIT_APPLY_DEPTH_\+\+/);
assert.match(apply, /bankImportApplyAutoMatchWrite_/);
const writer = sliceFn(bankImport, 'bankImportApplyAutoMatchWrite_(', 'bankImportLogActivity_');
assert.match(writer, /if \(!BANK_IMPORT_EXPLICIT_APPLY_DEPTH_\)/);
assert.match(writer, /updateBankAccountsHistory_\(accountName, year, balanceAsOfDate, balance\)/);
assert.doesNotMatch(writer, /updateAvailableNow|availableNow|minBuffer/);

const context = {
  console,
  LockService: {
    getDocumentLock() {
      return { waitLock() {}, releaseLock() {} };
    }
  },
  Logger: { log() {} },
  parseIsoDateLocal_(iso) {
    const matchDate = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || '').trim());
    if (!matchDate) throw new Error('Invalid ISO date: ' + iso);
    return new Date(Number(matchDate[1]), Number(matchDate[2]) - 1, Number(matchDate[3]));
  }
};
const writes = [];
context.updateBankAccountsHistory_ = () => { writes.push('history'); };
context.syncAllAccountsFromLatestCurrentYear_ = () => { writes.push('sys'); };
context.getUserSpreadsheet_ = () => { writes.push('workbook'); throw new Error('workbook touched'); };
vm.createContext(context);
vm.runInContext(read('planner_helpers.js'), context, { filename: 'planner_helpers.js' });
vm.runInContext(bankImport, context, { filename: 'bank_import.js' });

const zero = context.bankImportNormalizeRow_({
  externalAccountId: 'EXT-1',
  institution: 'Chase',
  displayName: 'Checking',
  balance: 0,
  balanceAsOf: '2026-09-15',
  currency: 'USD'
});
assert.equal(zero.balance, 0);
assert.throws(() => context.bankImportNormalizeRow_({
  externalAccountId: 'EXT-1',
  displayName: 'Checking',
  balance: '',
  balanceAsOf: '2026-09-15'
}), /balance is required/);
assert.throws(() => context.bankImportNormalizeRow_({
  externalAccountId: 'EXT-1',
  displayName: 'Checking',
  balance: '   ',
  balanceAsOf: '2026-09-15'
}), /balance is required/);

assert.throws(() => context.bankImportApplyAutoMatchWrite_('Checking', new Date(2026, 8, 15), 0),
  /cannot write a balance/);
assert.deepEqual(writes, []);

assert.throws(() => context.applyStagedBankAccountBalance({
  stagingId: 'stage-1',
  confirmed: false
}), /Confirm the account, month, and balance/);
assert.deepEqual(writes, [], 'unconfirmed apply must not touch the workbook');

const bridge = read('plaid_import_bridge.js');
const activityApplyGate = sliceFn(
  bridge,
  'plaidImportAssertAccountActivityCashApplyPayload_(',
  'plaidImportApplyCashUpdatesFromAccountActivity('
);
const cashApplyInner = sliceFn(
  bridge,
  'plaidImportApplyCashUpdates_(',
  'plaidImportAssertAccountActivityCashApplyPayload_('
);
const activityApplyWrapper = sliceFn(
  bridge,
  'plaidImportApplyCashUpdatesFromAccountActivity(',
  'plaidImportAssertAccountActivityDebtApplyPayload_('
);
assert.match(activityApplyWrapper, /plaidImportAssertAccountActivityCashApplyPayload_/);
assert.match(activityApplyWrapper, /plaidImportApplyCashUpdates_\(input\)/);
assert.match(activityApplyWrapper, /plaidImportRejectBrowserAuthority_/);
assert.match(activityApplyWrapper, /plaidImportRejectApplyFinancialAuthority_/);
assert.doesNotMatch(activityApplyWrapper, /updateBankAccountValueByDate_/);
assert.match(cashApplyInner, /updateAvailableNow: false/);
assert.match(cashApplyInner, /updateMinBuffer: false/);
assert.match(cashApplyInner, /updateBankAccountValueByDate_\(/);
assert.doesNotMatch(cashApplyInner, /plaidImportApplyCashUpdatesFromAccountActivity/);
const gateContext = vm.createContext({});
vm.runInContext(activityApplyGate, gateContext);
assert.throws(
  () => gateContext.plaidImportAssertAccountActivityCashApplyPayload_({ selectedApplyKeys: ['CURRENT_BALANCE'] }),
  /Confirm the account, month, and balance/
);
assert.throws(
  () => gateContext.plaidImportAssertAccountActivityCashApplyPayload_({
    confirmed: false,
    selectedApplyKeys: ['CURRENT_BALANCE']
  }),
  /Confirm the account, month, and balance/
);
assert.throws(
  () => gateContext.plaidImportAssertAccountActivityCashApplyPayload_({ confirmed: true }),
  /Select Current balance/
);
assert.throws(
  () => gateContext.plaidImportAssertAccountActivityCashApplyPayload_({
    confirmed: true,
    selectedApplyKeys: ['AVAILABLE_BALANCE']
  }),
  /Current balance only/
);
assert.throws(
  () => gateContext.plaidImportAssertAccountActivityCashApplyPayload_({
    confirmed: true,
    selectedApplyKeys: ['CURRENT_BALANCE', 'AVAILABLE_BALANCE']
  }),
  /Current balance only/
);
gateContext.plaidImportAssertAccountActivityCashApplyPayload_({
  confirmed: true,
  selectedApplyKeys: ['CURRENT_BALANCE']
});

assert.match(drawer, /Preview does not write/);
assert.doesNotMatch(drawer, /Apply Selected Updates/);
assert.match(drawer, /Import Data opens Account activity|Select <strong>Current balance<\/strong>/);
assert.match(help, /currently applies <strong>Current balance<\/strong> only/);
assert.match(help, /Import Data[\s\S]*?opens Account activity/);
{
  const helpBank = help.slice(help.indexOf('<h4>Bank accounts</h4>'), help.indexOf('<h4>Investments</h4>'));
  assert.doesNotMatch(helpBank, /Apply Selected Updates/);
}

console.log('bank account activity regressions passed');
