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
assert.match(drawer, /read-only/);
assert.match(help, /Account activity/);
assert.match(help, /Connected provider/);
assert.match(help, /Apply Selected Updates/);
assert.match(client, /function openBankAccountActivityDrawer_/);
assert.match(client, /function setBankAccountActivityView_/);
assert.match(client, /function loadBankActivityProviderPreview_/);
assert.match(client, /function previewBankActivityProviderAccount_/);
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
assert.match(providerPreview, /Read-only preview/);
assert.match(providerPreview, /not updated here/);
assert.doesNotMatch(providerPreview, /plaidImportApplyCashUpdates/);
assert.doesNotMatch(providerPreview, /Apply Selected Updates/);
assert.doesNotMatch(providerPreview, /stageBankImportPasteRows/);
assert.doesNotMatch(providerPreview, /processBankImportBatch_/);
assert.doesNotMatch(providerPreview, /matchStagedBankAccountToExisting/);
assert.doesNotMatch(providerPreview, /addStagedBankAccountAsNew/);
assert.doesNotMatch(providerPreview, /applyStagedBankAccountBalance/);
assert.doesNotMatch(providerPreview, /updateAccountsSheetFields_/);
assert.doesNotMatch(providerPreview, /updateAvailableNow|updateMinBuffer|setAvailableFromOpening|setMinBufferFromOpening/);
assert.match(plaidClient, /Apply Selected Updates/);
assert.match(plaidClient, /plaidImportApplyCashUpdates/);
assert.match(plaidClient, /function plaidMainImportData_/);
assert.match(plaidClient, /function plaidMainApplySelectedUpdates_/);
assert.doesNotMatch(plaidClient, /openBankAccountActivityDrawer_/);
assert.doesNotMatch(plaidClient, /loadBankActivityProviderPreview_/);
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

console.log('bank account activity regressions passed');
