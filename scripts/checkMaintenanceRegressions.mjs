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
  /payeeColumnResizeTargets[\s\S]*autoResizeColumn/,
  /if \(!category\) category = String\(currentCategory \|\| ''\)\.trim\(\)/
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
assert.match(files['test_harness_scenarios.js'], /getHarnessDonationFullEditScenario_/,
  'Full donation edit scenario must be discoverable by the harness registry');

console.log('Maintenance regression checks passed.');
