import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const names = [
  'Dashboard_Body.html',
  'Dashboard_Script_BillsCategoryRaceFix.html',
  'Dashboard_Script_Donations.html',
  'Dashboard_Styles.html',
  'PlannerDashboardWeb.html',
  'activity_log.js',
  'bills.js',
  'dashboard_data.js',
  'donations.js',
  'planner_helpers.js',
  'PROJECT_CONTEXT.md',
  'TODO.md',
  'agents/features/bills.md',
  'test_harness_scenarios.js',
  'test_harness_scenarios_maintenance.js',
  'test_harness_suites.js'
];
const files = Object.fromEntries(await Promise.all(names.map(async (name) => [
  name,
  await readFile(new URL(`../${name}`, import.meta.url), 'utf8')
])));

const billPatch = files['Dashboard_Script_BillsCategoryRaceFix.html'];
assert.match(files['PlannerDashboardWeb.html'],
  /includeHtml_\('Dashboard_Script_BillsDue'\)[\s\S]*includeHtml_\('Dashboard_Script_BillsCategoryRaceFix'\)/,
  'The race coordinator must load immediately after the Bills bundle');

// Exact reproduction of the first-open race: Add begins the request, Edit
// queues its prefill before the response, and only one RPC is issued.
const categorySelect = { value: '', options: [] };
const categoryOther = { value: '', style: { display: 'none' } };
const categoryRequests = [];
let billEditSubmitCount = 0;
const context = vm.createContext({
  window: { __billsCategoryOptionsLoaded: false },
  BILL_ADD_CATEGORY_FALLBACK_OPTIONS_: ['Utilities', 'Housing'],
  __billsFormMode: { mode: 'edit' },
  submitBillEdit_() { billEditSubmitCount += 1; },
  setStatusLoading() {},
  document: {
    getElementById(id) {
      if (id === 'bills_add_category') return categorySelect;
      if (id === 'bills_add_category_other') return categoryOther;
      return null;
    }
  },
  populateBillCategoryOptions_(categories) {
    categorySelect.options = [{ value: '' }]
      .concat(categories.map((value) => ({ value })))
      .concat([{ value: '__other__' }]);
    categorySelect.value = '';
  },
  google: {
    script: {
      run: {
        withSuccessHandler(onSuccess) {
          return {
            withFailureHandler(onFailure) {
              return {
                getBillCategoriesFromDashboard() {
                  categoryRequests.push({ onSuccess, onFailure });
                }
              };
            }
          };
        }
      }
    }
  },
  Array,
  String
});
vm.runInContext(billPatch, context);
context.loadBillCategoriesIntoForm_();
context.prefillBillCategoryForEdit_('Utilities');
assert.equal(categoryRequests.length, 1,
  'Add load and Edit prefill must share one in-flight category request');
categoryRequests[0].onSuccess(['Custom']);
assert.equal(categorySelect.value, 'Utilities',
  'The queued Edit prefill must win after categories load');

context.window.__billsCategoryOptionsLoaded = false;
context.prefillBillCategoryForEdit_('Housing');
context.prefillBillCategoryForEdit_('Custom');
assert.equal(categoryRequests.length, 2,
  'A deliberate cache invalidation must issue only one fresh request');
categoryRequests[1].onSuccess(['Custom']);
assert.equal(categorySelect.value, 'Custom',
  'Only the most recently opened Edit target may apply after a delayed response');

context.window.__billsCategoryOptionsLoaded = false;
context.prefillBillCategoryForEdit_('Utilities');
context.submitBillEdit_();
context.submitBillEdit_();
assert.equal(billEditSubmitCount, 0,
  'Save must wait instead of reporting Category required while categories load');
assert.equal(categoryRequests.length, 3,
  'Deferred Save must reuse the existing category request');
categoryRequests[2].onSuccess([]);
assert.equal(billEditSubmitCount, 1,
  'Deferred Save must resume exactly once after category prefill completes');

const bills = files['bills.js'];
for (const pattern of [
  /function updateTrackedBillFromDashboard\(payload, optionalSs\)/,
  /LockService\.getUserLock\(\)/,
  /exactMatches\.length !== 1/,
  /Another bill already uses this payee/,
  /An Expense row already uses the new payee/,
  /SpreadsheetApp\.flush\(\)[\s\S]*verifiedBillPayee[\s\S]*verifiedCashFlowPayee/,
  /linkedCashFlowRename && activityLogged !== true[\s\S]*rollbackAppliedBillEdit_/,
  /billEditFitTargets[\s\S]*fitContentColumnsToContents_/,
  /if \(!category\) category = String\(currentCategory \|\| ''\)\.trim\(\)/,
  /function getInactiveBillsForManagementFromDashboard\(optionalSs\)[\s\S]*getBillsForManagementByState_\('no', optionalSs\)/,
  /function deactivateBillFromDashboard\(payload, optionalSs\)[\s\S]*LockService\.getUserLock\(\)[\s\S]*bill_deactivate/,
  /function reactivateBillFromDashboard\(payload, optionalSs\)[\s\S]*LockService\.getUserLock\(\)[\s\S]*active bill named[\s\S]*bill_reactivate/
]) {
  assert.match(bills, pattern, 'Bill Edit integrity contract is incomplete');
}

const donations = files['donations.js'];
for (const pattern of [
  /function updateRecentDonationComments\(payload, optionalSs\)/,
  /LockService\.getUserLock\(\)/,
  /donationDataRowMatchesActivityUndo_\(values\[row0\]/,
  /eventType: 'donation_comment_update'/,
  /commentsCell\.setValue\(expected\.comments\)/,
  /prior value was restored/
]) {
  assert.match(donations, pattern, 'Donation comments integrity contract is incomplete');
}
const donationBody = files['Dashboard_Body.html'];
const donationScript = files['Dashboard_Script_Donations.html'];
const donationAddStart = donationBody.indexOf('id="donations_view_add"');
const donationManageStart = donationBody.indexOf('id="donations_view_manage"');
const donationPanelEnd = donationBody.indexOf('id="billsDue"', donationManageStart);
assert.ok(donationAddStart !== -1 && donationManageStart > donationAddStart,
  'Donations must expose separate Add donation and Manage donations views');
assert.match(donationBody, /setDonationsView\('add'\)[\s\S]*>Add donation<\/button>[\s\S]*setDonationsView\('manage'\)[\s\S]*>Manage donations<\/button>/,
  'Donations must expose exactly the intended Add and Manage choices');
assert.doesNotMatch(donationBody.slice(donationAddStart, donationManageStart),
  /don_manage_list|Edit donation/i,
  'The Add donation view must not contain donation management actions');
assert.match(donationBody.slice(donationAddStart, donationManageStart),
  /grid-2[\s\S]*donations-previous-panel[\s\S]*don_previous_list/,
  'Add donation must retain the two-column blue Previous donations panel');
assert.match(donationBody.slice(donationManageStart, donationPanelEnd),
  /don_manage_list[\s\S]*Loading donations/,
  'Donation management must live in its own full-width view');
assert.match(donationScript,
  /function setDonationsView\(view\)[\s\S]*donations_view_add[\s\S]*donations_view_manage/,
  'The Donation view switch must toggle Add and Manage panels');
assert.match(donationScript, /getElementById\('don_manage_list'\)/,
  'Donation rows must render into the Manage donations container');
assert.match(donationScript, /donations-manage-table/,
  'Manage donations must render a full-width management table');
assert.match(donationScript, /Edit donation/,
  'Full donation editing must render inside Manage donations');
assert.match(donations, /getRecentDonationsForUi_\([\s\S]*values,[\s\S]*250,/,
  'Manage donations must not retain the old eight-row Recent Donations limit');
for (const pattern of [
  /function updateDonationFromDashboard\(payload, optionalSs\)/,
  /donationDataRowMatchesActivityUndo_\(values\[row0\]/,
  /movedTaxYear[\s\S]*destinationRow[\s\S]*clearContent\(\)/,
  /eventType: 'donation_update'/,
  /rollbackDonationEdit_\(\)/,
  /prior values were restored/
]) {
  assert.match(donations, pattern, 'Full donation edit integrity contract is incomplete');
}
assert.match(donationScript,
  /function editManagedDonation_\(key\)[\s\S]*newCharityName[\s\S]*newDonationDate[\s\S]*newAmount[\s\S]*newTaxYear[\s\S]*newPaymentType[\s\S]*newComments/,
  'Manage donations must submit every editable donation field');
assert.match(donationScript,
  /paymentType:\s*row\.paymentType[\s\S]*newPaymentType:\s*String\(payment\.value/,
  'Manage donations must submit the old Payment type snapshot and the edited replacement');
assert.match(donationScript,
  /var amountInputId = key \+ '-amount';[\s\S]*amountInput\.onfocus = function\(\) \{ currencyFocus\(amountInputId\); \};[\s\S]*amountInput\.onblur = function\(\) \{ currencyBlur\(amountInputId\); \};[\s\S]*currencyBlur\(amountInputId\);/,
  'Manage donations must open and leave the Amount editor in canonical currency format');
const fullDonationUpdateStart = donations.indexOf('function updateDonationFromDashboard(payload, optionalSs)');
const fullDonationNextStart = donations.indexOf('var next = {', fullDonationUpdateStart);
const fullDonationExpectedContract = donations.slice(fullDonationUpdateStart, fullDonationNextStart);
assert.doesNotMatch(fullDonationExpectedContract, /['"]paymentType['"]/,
  'A legacy blank expected Payment type must not be rejected as a missing required field');
assert.doesNotMatch(fullDonationExpectedContract, /!expected\.paymentType/,
  'A legacy blank expected Payment type must remain a valid stable-row snapshot');
assert.match(donations,
  /if \(!next\.paymentType\) throw new Error\('Payment type is required\.'\)/,
  'The replacement Payment type must remain required');
assert.match(files['test_harness_scenarios_maintenance.js'],
  /Harness Legacy Blank Payment[\s\S]*paymentType:\s*legacy\.paymentType[\s\S]*newPaymentType:\s*'Cash'[\s\S]*Legacy blank Payment type can be repaired/,
  'The disposable full-donation scenario must cover blank-to-Cash Payment type repair');
assert.match(files['test_harness_scenarios_maintenance.js'],
  /billPayeeTightAutoWidth[\s\S]*?fitContentColumnToContents_[\s\S]*?Shared content fit adds the exact rendering gutter/,
  /defaultAmount:\s*1234567890123\.45[\s\S]*?Bills currency column auto-fits a larger formatted amount/,
  'The disposable Bill scenario must prove the shared fit gutter with the real Sheets sizing engine');

function donationViewElement_() {
  return {
    style: { display: '' },
    attributes: {},
    active: false,
    classList: {
      toggle(_name, enabled) { this.owner.active = !!enabled; },
      owner: null
    },
    setAttribute(name, value) { this.attributes[name] = value; }
  };
}
const donationViewElements = {};
[
  'donations_view_add', 'donations_view_manage',
  'donations_view_tab_add', 'donations_view_tab_manage'
].forEach((id) => {
  const element = donationViewElement_();
  element.classList.owner = element;
  donationViewElements[id] = element;
});
const donationViewContext = vm.createContext({
  window: {},
  document: {
    getElementById(id) { return donationViewElements[id] || null; },
    createElement() { return {}; }
  },
  Array,
  Date,
  Number,
  Object,
  String
});
vm.runInContext(donationScript, donationViewContext);
donationViewContext.setDonationsView('manage');
assert.equal(donationViewElements.donations_view_add.style.display, 'none',
  'Manage donations must hide the Add donation form');
assert.equal(donationViewElements.donations_view_manage.style.display, '',
  'Manage donations must show only the management table');
assert.equal(donationViewElements.donations_view_tab_manage.attributes['aria-selected'], 'true',
  'Manage donations must publish accessible selected state');
donationViewContext.setDonationsView('add');
assert.equal(donationViewElements.donations_view_add.style.display, '',
  'Add donation must restore the focused entry form');
assert.equal(donationViewElements.donations_view_manage.style.display, 'none',
  'Add donation must hide all management actions');

const managedDonationKey = 'donation-2025-12';
const managedDonationAmountId = `${managedDonationKey}-amount`;
const managedDonationElements = {
  [managedDonationKey]: { innerHTML: '' },
  [`${managedDonationKey}-charity`]: { focus() {}, select() {} },
  [managedDonationAmountId]: { value: '800', onfocus: null, onblur: null }
};
Object.assign(donationViewElements, managedDonationElements);
donationViewContext.window.__recentDonationRows = {
  [managedDonationKey]: {
    charity: 'GoodWill',
    entryDate: '2025-12-13',
    amount: 800,
    taxYear: 2025,
    paymentType: '',
    comments: 'Bags'
  }
};
donationViewContext.window.__donationFormData = { taxYears: [2026, 2025] };
donationViewContext.escapeHtml = (value) => String(value);
donationViewContext.escapeJs = (value) => String(value);
donationViewContext.currencyFocus = (id) => {
  donationViewElements[id].value = '800';
};
donationViewContext.currencyBlur = (id) => {
  donationViewElements[id].value = '$800.00';
};
donationViewContext.editManagedDonation_(managedDonationKey);
assert.equal(donationViewElements[managedDonationAmountId].value, '$800.00',
  'Manage donations must immediately format a stored 800 amount as $800.00');
donationViewElements[managedDonationAmountId].onfocus();
assert.equal(donationViewElements[managedDonationAmountId].value, '800',
  'Manage donations must expose the numeric amount while the editor is focused');
donationViewElements[managedDonationAmountId].onblur();
assert.equal(donationViewElements[managedDonationAmountId].value, '$800.00',
  'Manage donations must restore canonical currency when the editor loses focus');
assert.match(files['activity_log.js'], /donation_comment_update[\s\S]*Donation comments updated/,
  'Donation comment edits must render as immutable Donation audit history');
assert.match(files['activity_log.js'], /donation_update[\s\S]*Donation updated/,
  'Full donation edits must render as immutable Donation audit history');

const dashboardData = files['dashboard_data.js'];
assert.equal(
  (dashboardData.match(/applyCashFlowMoneyFormat_\(cellRange\);/g) || []).length,
  0,
  'AutoPay callers must use the verified writer instead of unverified inline formatting'
);
assert.match(dashboardData,
  /function formatBillOccurrenceDateIso_[\s\S]*?getFullYear\(\)[\s\S]*?getMonth\(\)[\s\S]*?getDate\(\)/,
  'Bill occurrence identity must be built from stable calendar components');
assert.match(dashboardData,
  /function isBillAutopayOccurrenceScheduleSafe_[\s\S]*?frequency !== 'weekly'[\s\S]*?parseBillWeekday_[\s\S]*?occurrenceDate\.getDay\(\) === expectedWeekday/,
  'Weekly AutoPay must fail closed unless the generated date matches the configured Weekday');
for (const docName of ['PROJECT_CONTEXT.md', 'TODO.md', 'agents/features/bills.md']) {
  assert.match(files[docName],
    /Weekly unattended AutoPay[\s\S]{0,180}fails closed|Weekly AutoPay[\s\S]{0,180}fails closed|unattended Weekly AutoPay[\s\S]{0,180}fails closed/,
    `${docName} must preserve the Weekly AutoPay fail-closed contract`);
}
assert.match(dashboardData,
  /function writeVerifiedBillAutopay_[\s\S]*?SpreadsheetApp\.flush\(\)[\s\S]*?appendActivityLog_[\s\S]*?activityLogDedupeKeyExists_[\s\S]*?setNumberFormat\(priorNumberFormat\)/,
  'AutoPay must verify money and marker writes and restore the prior cell on failure');
assert.equal(
  (dashboardData.match(/writeVerifiedBillAutopay_\(ss, \{/g) || []).length,
  2,
  'Monthly and expanded-occurrence AutoPay must both use the verified writer'
);
assert.match(files['planner_helpers.js'],
  /CASH_FLOW_MONEY_FORMAT_\s*=\s*'\$#,##0\.00;\[Red\]-\$#,##0\.00'/,
  'Canonical Cash Flow formatting must keep red negative currency');

for (const id of [
  'REGRESSION-BILLS-EDIT-INTEGRITY',
  'REGRESSION-BILLS-AUTOPAY-FORMAT',
  'REGRESSION-BILLS-WEEKDAY-AUTOPAY-GUARD',
  'REGRESSION-BILLS-AUTOPAY-ROLLBACK',
  'REGRESSION-DONATION-COMMENTS-EDIT',
  'REGRESSION-DONATION-FULL-EDIT'
]) {
  assert.match(files['test_harness_scenarios_maintenance.js'], new RegExp(id),
    `${id} must have a focused disposable-workbook scenario`);
  assert.match(files['test_harness_suites.js'], new RegExp(id),
    `${id} must be registered on the single Validation console suite surface`);
}
assert.match(files['test_harness_scenarios.js'], /getHarnessBillsEditIntegrityScenario_/,
  'Maintenance scenarios must be discoverable by the harness registry');
assert.match(files['test_harness_scenarios_maintenance.js'],
  /firstStop[\s\S]*inactiveBeforeReactivate[\s\S]*reactivateStaleError[\s\S]*reactivateDuplicateError[\s\S]*activeAfterReactivateCount[\s\S]*alreadyActiveReactivate[\s\S]*secondStop[\s\S]*inactiveAfterSecondStop[\s\S]*deactivateAuditCount/,
  'Bill maintenance evidence must prove the complete Stop, inactive discovery, stale/duplicate-safe Reactivate, and Stop-again lifecycle');
assert.match(files['test_harness_scenarios_maintenance.js'],
  /state\.autopayOnly = updateTrackedBillFromDashboard[\s\S]*?autopay: 'Yes'[\s\S]*?AutoPay-only edit changes exactly AutoPay[\s\S]*?JSON\.stringify\(\['autopay'\]\)[\s\S]*?AutoPay-only edit persists Yes/,
  'Bill maintenance evidence must retain the exact AutoPay-only server regression');
assert.match(files['test_harness_scenarios_maintenance.js'],
  /Frequency: 'Biweekly'[\s\S]*Weekday: 'Monday'[\s\S]*'Anchor Date': '2026-08-03'[\s\S]*'Schedule Effective Date': '2026-08-01'[\s\S]*lifecycleConfigAfterSecondStop/,
  'Bill lifecycle evidence must preserve representative Bills V2 recurrence configuration');
assert.match(files['test_harness_scenarios_maintenance.js'],
  /cashFlowHistoryBeforeLifecycle[\s\S]*cashFlowHistoryAfterLifecycle[\s\S]*Existing Cash Flow payment history survives the lifecycle/,
  'Bill lifecycle evidence must preserve linked Cash Flow history');
assert.match(files['test_harness_scenarios.js'], /getHarnessDonationFullEditScenario_/,
  'Full donation edit scenario must be discoverable by the harness registry');

console.log('Maintenance regression checks passed.');
