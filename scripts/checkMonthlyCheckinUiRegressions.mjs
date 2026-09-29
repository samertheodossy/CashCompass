import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const read = (name) => fs.readFileSync(new URL(name, root), 'utf8');

const body = read('Dashboard_Body.html');
const styles = read('Dashboard_Styles.html');
const render = read('Dashboard_Script_Render.html');
const monthlyUi = read('Dashboard_Script_MonthlyCheckin.html');
const plannerWeb = read('PlannerDashboardWeb.html');
const readinessUi = read('Dashboard_Script_PlanningDataReadiness.html');
const readServer = read('monthly_checkin_read.js');

assert.doesNotMatch(body, /id="ov_monthly_checkin_banner"/);
assert.doesNotMatch(body, /overview-section--monthly-checkin/);
assert.match(body, /id="ov_monthly_review_entry"/);
assert.match(body, /id="ov_monthly_review_btn"/);
assert.doesNotMatch(body, /id="ov_monthly_review_label"/);
assert.doesNotMatch(body, /Later/);
assert.doesNotMatch(body, /dismissMonthlyCheckinForSession_/);
assert.match(body, />Monthly Review</);
assert.match(body, /id="page_monthly_review"/);
assert.match(styles, /monthly-review-domain-fold/);
assert.match(styles, /monthly-review-card--current/);
assert.match(styles, /monthly-review-card-status--current/);
assert.doesNotMatch(styles, /overview-monthly-review-later/);
assert.match(styles, /overview-monthly-review-btn--current/);

assert.match(plannerWeb, /Dashboard_Script_MonthlyCheckin/);
assert.match(render, /requestMonthlyCheckinOverviewAfterPaint_\(\)/);
assert.match(monthlyUi, /monthlyCheckinDomainSectionHtml_/);
assert.doesNotMatch(monthlyUi, /monthly-review-attention-section/);
assert.doesNotMatch(monthlyUi, /monthly-review-domain-current/);
assert.doesNotMatch(monthlyUi, /View current /);
assert.doesNotMatch(monthlyUi, /sessionStorage/);
assert.doesNotMatch(monthlyUi, /writeSetting_|setValue\(|appendRow\(/);
assert.doesNotMatch(monthlyUi, /confirmDebtBalanceReviewFromDashboard/);
assert.doesNotMatch(monthlyUi, /confirmAllDebtBalanceReviewsFromDashboard/);
assert.doesNotMatch(monthlyUi, /This records that you reviewed the displayed balance/);
assert.match(monthlyUi, /Last Updated:/);
assert.match(monthlyUi, /Needs current-cycle update/);
assert.match(monthlyUi, /currentStatusLabel/);

function makeClassList(initial) {
  const names = new Set(initial || []);
  return {
    add(name) { names.add(name); },
    remove(name) { names.delete(name); },
    contains(name) { return names.has(name); },
    toggle(name, force) {
      if (force === true) { names.add(name); return true; }
      if (force === false) { names.delete(name); return false; }
      if (names.has(name)) { names.delete(name); return false; }
      names.add(name);
      return true;
    }
  };
}

function makeHost(id) {
  return {
    id,
    hidden: true,
    _html: '',
    classList: id === 'ov_monthly_review_btn'
      ? makeClassList(['overview-monthly-review-btn'])
      : { _active: false, contains(name) { return name === 'active' ? this._active : false; } },
    set hidden(value) { this._hidden = value; },
    get hidden() { return !!this._hidden; },
    set innerHTML(value) { this._html = value; },
    get innerHTML() { return this._html || ''; },
    set textContent(value) { this._text = String(value ?? ''); },
    get textContent() { return this._text || ''; }
  };
}

const hosts = Object.create(null);
['ov_monthly_review_entry', 'ov_monthly_review_btn', 'page_overview', 'page_onboarding', 'page_monthly_review',
  'monthly_review_subtitle', 'monthly_review_summary', 'monthly_review_domains',
  'monthly_review_identity', 'monthly_review_identity_list'
].forEach((id) => { hosts[id] = makeHost(id); });

let lastWorkspacePage = null;
let lastTab = null;

const context = {
  console,
  document: {
    body: { classList: { contains() { return false; } } },
    getElementById(id) { return hosts[id] || null; }
  },
  escapeHtml(value) {
    return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  },
  showPage() {},
  showWorkspacePage(name) { lastWorkspacePage = name; },
  showTab(tab) { lastTab = tab; },
  google: { script: { run: {} } }
};
vm.createContext(context);
vm.runInContext(monthlyUi, context, { filename: 'Dashboard_Script_MonthlyCheckin.html' });

function buildModel(overrides = {}) {
  return {
    available: true,
    cycleKey: '2026-09',
    projection: {
      cycleKey: '2026-09',
      ui: {
        areasCurrent: 1,
        totalActiveCount: 5,
        attentionCount: 3,
        missingMonthValueCount: 2,
        debtReviewCount: 1,
        identityIssueCount: 1,
        needsReviewCount: 4,
        attentionItems: [],
        identityRepairItems: [
          { domain: 'bank', displayName: 'Orphan Account', code: 'IDENTITY_UNRESOLVED', message: 'Account identity could not be resolved.', navigatePage: 'assets', navigateTab: 'bank' }
        ],
        domainSections: [
          { domain: 'bank', label: 'Bank accounts', domainKind: 'month_value', navigatePage: 'assets', navigateTab: 'bank', activeCount: 1, currentMonthValueCount: 1, records: [{ displayName: 'Ally', needsAttention: false, currentValue: 1200 }] },
          { domain: 'houses', label: 'Houses', domainKind: 'month_value', navigatePage: 'assets', navigateTab: 'houses', activeCount: 1, currentMonthValueCount: 0, records: [{ displayName: 'Main House', needsAttention: true, hasPriorMonthValue: true, priorMonthValue: 450000, reason: 'Missing September 2026 value' }] },
          { domain: 'investments', label: 'Investments', domainKind: 'month_value', navigatePage: 'assets', navigateTab: 'investments', activeCount: 2, currentMonthValueCount: 1, records: [{ displayName: 'Roth IRA', needsAttention: true, hasPriorMonthValue: true, priorMonthValue: 10845.46, reason: 'Missing September 2026 value' }, { displayName: 'Brokerage', needsAttention: false, currentValue: 5000 }] },
          { domain: 'debts', label: 'Debts', domainKind: 'debt_acknowledgement', navigatePage: 'assets', navigateTab: 'debts', activeCount: 1, currentCount: 0, records: [{ accountKey: 'debt:v1:DEBT-VISA-1', displayName: 'Visa', needsAttention: true, reason: 'Needs current-cycle update', debtType: 'Credit card', currentValue: 800 }] }
        ],
        ...(overrides.projection && overrides.projection.ui)
      },
      ...overrides.projection
    },
    ...overrides
  };
}

function domainChunk(html, domain) {
  return html.match(new RegExp('monthly_review_domain_' + domain + '[\\s\\S]*?</details>'));
}

function cardActionButtons(html) {
  const cards = html.match(/<article class="monthly-review-card[\s\S]*?<\/article>/g) || [];
  return cards.filter((card) => card.includes('monthlyCheckinOpenItemFromButton_'));
}

function currentCards(html) {
  const cards = html.match(/<article class="monthly-review-card[\s\S]*?<\/article>/g) || [];
  return cards.filter((card) => card.includes('monthly-review-card--current'));
}

function attentionCards(html) {
  const cards = html.match(/<article class="monthly-review-card[\s\S]*?<\/article>/g) || [];
  return cards.filter((card) => card.includes('monthly-review-card--attention'));
}

hosts.ov_monthly_review_entry.hidden = true;
context.renderMonthlyCheckinOverviewEntry_(buildModel({
  projection: { ui: { needsReviewCount: 0, attentionCount: 0, identityIssueCount: 0, domainSections: [] } }
}));
assert.equal(hosts.ov_monthly_review_entry.hidden, false,
  'Overview must keep Monthly Review visible after all areas are current');
assert.equal(hosts.ov_monthly_review_btn.classList.contains('overview-monthly-review-btn--current'), true,
  'Overview Monthly Review must turn green when nothing still needs this month');

const attentionModel = buildModel();
context.renderMonthlyCheckinUi_(attentionModel);
assert.equal(hosts.ov_monthly_review_entry.hidden, false);
assert.equal(hosts.ov_monthly_review_btn.classList.contains('overview-monthly-review-btn--current'), false,
  'Overview Monthly Review must stay orange while any item still needs this month');

context.renderMonthlyCheckinOverviewEntry_({ available: false });
assert.equal(hosts.ov_monthly_review_entry.hidden, true,
  'Overview must hide Monthly Review until the review model is available');
assert.equal(hosts.ov_monthly_review_btn.classList.contains('overview-monthly-review-btn--current'), false);

context.renderMonthlyReviewScreen_(attentionModel);
const domainsHtml = hosts.monthly_review_domains.innerHTML;

assert.equal((domainsHtml.match(/<details id="monthly_review_domain_/g) || []).length, 4,
  'all four domains must render as collapsible sections');
assert.doesNotMatch(domainsHtml, /monthly-review-attention-section/);
assert.doesNotMatch(domainsHtml, /View current investments/i);

const bankChunk = domainChunk(domainsHtml, 'bank');
const housesChunk = domainChunk(domainsHtml, 'houses');
const investmentsChunk = domainChunk(domainsHtml, 'investments');
const debtsChunk = domainChunk(domainsHtml, 'debts');
assert.ok(bankChunk && housesChunk && investmentsChunk && debtsChunk);

assert.doesNotMatch(bankChunk[0], /\sopen/,
  'fully current bank section must be collapsed by default');
assert.match(housesChunk[0], /\sopen/,
  'houses section with attention must be expanded by default');
assert.match(investmentsChunk[0], /\sopen/,
  'investments section with attention must be expanded by default');
assert.match(debtsChunk[0], /\sopen/,
  'debts section with attention must be expanded by default');

assert.match(bankChunk[0], /Open Bank Accounts/);
assert.match(housesChunk[0], /Open Houses/);
assert.match(investmentsChunk[0], /Open Investments/);
assert.match(debtsChunk[0], /Open Debts/);
assert.equal(cardActionButtons(currentCards(domainsHtml).join('')).length, 0,
  'current items must have no action button');
assert.equal(currentCards(domainsHtml).every((card) => card.includes('Current — no action required.')), true);
assert.ok(attentionCards(domainsHtml).length >= 3);
assert.equal(attentionCards(domainsHtml).every((card) => card.includes('monthlyCheckinOpenItemFromButton_')), true,
  'attention cards must provide a direct action');
assert.match(housesChunk[0], /Open Houses[\s\S]*Main House|Main House[\s\S]*Open Houses/);
assert.match(investmentsChunk[0], /Roth IRA[\s\S]*Open Investments/);
assert.match(debtsChunk[0], /Visa[\s\S]*Open Debts/);
assert.doesNotMatch(bankChunk[0], /monthly-review-card--current[\s\S]*monthlyCheckinOpenItemFromButton_/);

assert.match(housesChunk[0], /Main House/);
assert.match(housesChunk[0], /Aug-26:/);
assert.match(housesChunk[0], /Sep-26:/);
assert.match(housesChunk[0], /Not entered/);
assert.match(housesChunk[0], /monthly-review-card--attention/);

const rothPos = investmentsChunk[0].indexOf('Roth IRA');
const brokeragePos = investmentsChunk[0].indexOf('Brokerage');
assert.ok(rothPos !== -1 && brokeragePos !== -1 && rothPos < brokeragePos,
  'investment attention cards must appear before current cards');
assert.match(investmentsChunk[0], /monthly-review-card--current[\s\S]*Brokerage/);
assert.match(investmentsChunk[0], /Sep-26:/);
assert.match(investmentsChunk[0], /Current — no action required/);

assert.match(bankChunk[0], /monthly-review-card--current[\s\S]*Ally/);
assert.match(bankChunk[0], /Current — no action required/);
assert.equal((bankChunk[0].match(/1 of 1 September values present/g) || []).length, 1);

assert.match(debtsChunk[0], /Type: Credit card/);
assert.match(debtsChunk[0], /Balance: \$800\.00/);
assert.match(debtsChunk[0], /Needs current-cycle update/);
assert.doesNotMatch(debtsChunk[0], /Confirm current balance/);
assert.doesNotMatch(debtsChunk[0], /Confirm all current debt balances/);
assert.doesNotMatch(domainsHtml, /Orphan Account/);

const mixedDebtModel = buildModel({
  projection: {
    ui: {
      areasCurrent: 1,
      totalActiveCount: 2,
      attentionCount: 1,
      needsReviewCount: 1,
      identityIssueCount: 0,
      identityRepairItems: [],
      domainSections: [{
        domain: 'debts', label: 'Debts', domainKind: 'debt_acknowledgement',
        navigatePage: 'assets', navigateTab: 'debts',
        activeCount: 2, currentCount: 1,
        records: [
          { accountKey: 'debt:v1:DEBT-NEEDS-UPDATE', displayName: 'Zebra Card', needsAttention: true, reason: 'Needs current-cycle update', debtType: 'Credit card', currentValue: 100 },
          { accountKey: 'debt:v1:DEBT-CURRENT', displayName: 'Alpha Loan', needsAttention: false, currentStatusLabel: 'Current for September 2026', debtType: 'Loan', currentValue: 5000, lastUpdated: '2026-09-02' }
        ]
      }]
    }
  }
});
context.renderMonthlyReviewScreen_(mixedDebtModel);
const mixedDebtsHtml = hosts.monthly_review_domains.innerHTML;
const mixedDebtsChunk = domainChunk(mixedDebtsHtml, 'debts');
assert.match(mixedDebtsChunk[0], /Zebra Card[\s\S]*Alpha Loan/,
  'needs-update debt cards must appear before current cards');
assert.match(mixedDebtsChunk[0], /Last Updated: Sep 2, 2026/);
assert.match(mixedDebtsChunk[0], /Current for September 2026/);
assert.match(mixedDebtsChunk[0], /1 of 2 current/);
assert.doesNotMatch(mixedDebtsChunk[0], /Confirm all current debt balances/);

const fullyCurrentDebtModel = buildModel({
  projection: {
    ui: {
      areasCurrent: 1,
      totalActiveCount: 1,
      attentionCount: 0,
      needsReviewCount: 0,
      identityIssueCount: 0,
      identityRepairItems: [],
      domainSections: [{
        domain: 'debts', label: 'Debts', domainKind: 'debt_acknowledgement',
        navigatePage: 'assets', navigateTab: 'debts',
        activeCount: 1, currentCount: 1,
        records: [
          { accountKey: 'debt:v1:DEBT-CURRENT', displayName: 'Alpha Loan', needsAttention: false, currentStatusLabel: 'Current for September 2026', debtType: 'Loan', currentValue: 5000, lastUpdated: '2026-09-02' }
        ]
      }]
    }
  }
});
context.renderMonthlyReviewScreen_(fullyCurrentDebtModel);
const fullyCurrentDebtsHtml = hosts.monthly_review_domains.innerHTML;
assert.doesNotMatch(fullyCurrentDebtsHtml, /Confirm all current debt balances/);
assert.doesNotMatch(fullyCurrentDebtsHtml, /Needs current-cycle update/);

assert.doesNotMatch(domainsHtml, /Orphan Account/);

const fullyCurrentBankModel = buildModel({
  projection: {
    ui: {
      areasCurrent: 4,
      totalActiveCount: 20,
      attentionCount: 0,
      needsReviewCount: 0,
      identityIssueCount: 0,
      identityRepairItems: [],
      domainSections: [{
        domain: 'bank', label: 'Bank accounts', domainKind: 'month_value',
        navigatePage: 'assets', navigateTab: 'bank',
        activeCount: 20, currentMonthValueCount: 20,
        records: [
          { displayName: 'Ally', needsAttention: false, currentValue: 1200 },
          { displayName: 'BofA', needsAttention: false, currentValue: 2400, sourceLabel: 'Plaid' },
          { displayName: 'Cash Maximizer', needsAttention: false, currentValue: 0 },
        ]
      }]
    }
  }
});
context.renderMonthlyReviewScreen_(fullyCurrentBankModel);
const bankOnly = domainChunk(hosts.monthly_review_domains.innerHTML, 'bank');
assert.ok(bankOnly);
assert.doesNotMatch(bankOnly[0], /\sopen/);
assert.match(bankOnly[0], /Ally/);
assert.match(bankOnly[0], /BofA/);
assert.match(bankOnly[0], /Cash Maximizer/);
assert.match(bankOnly[0], /\$0\.00/);
assert.match(bankOnly[0], /Evidence source: Plaid/);
assert.equal((bankOnly[0].match(/20 of 20 September values present/g) || []).length, 1);
assert.equal(cardActionButtons(bankOnly[0]).length, 0,
  'current Ally and BofA values have no item action buttons');
assert.equal(currentCards(bankOnly[0]).every((card) =>
  card.includes('Current — no action required.')), true);
assert.doesNotMatch(bankOnly[0], /Review account match|Connected Bank Accounts/);

const noPriorModel = buildModel({
  projection: {
    ui: {
      ...buildModel().projection.ui,
      domainSections: buildModel().projection.ui.domainSections.map((section) => {
        if (section.domain !== 'investments') return section;
        return {
          ...section,
          records: [
            { displayName: 'Empty Fund', needsAttention: true, hasPriorMonthValue: false, reason: 'Missing September 2026 value' },
            { displayName: 'Brokerage', needsAttention: false, currentValue: 5000 }
          ]
        };
      })
    }
  }
});
context.renderMonthlyReviewScreen_(noPriorModel);
assert.match(hosts.monthly_review_domains.innerHTML, /No prior value/);
assert.doesNotMatch(hosts.monthly_review_domains.innerHTML,
  /Empty Fund[\s\S]*\$0\.00[\s\S]*Not entered/);

assert.match(hosts.monthly_review_identity_list.innerHTML, /monthly-review-card--identity/);
assert.match(hosts.monthly_review_identity_list.innerHTML, /Review account match/);
assert.equal(cardActionButtons(hosts.monthly_review_identity_list.innerHTML).length, 1);

lastWorkspacePage = null;
lastTab = null;
let lastFocus = null;
context.focusTarget = function(obj) { lastFocus = obj; lastTab = obj && obj.tab; };
const fakeButton = {
  getAttribute(name) {
    const attrs = {
      'data-tab': 'investments',
      'data-page': 'assets',
      'data-domain': 'investments',
      'data-account-key': 'investment:v1:I-1',
      'data-account-name': 'Roth IRA',
      'data-cycle-key': '2026-09',
      'data-reason': 'Missing September 2026 value',
      'data-debt-type': '',
      'data-review-route': 'editor',
      'data-action-kind': 'UPDATE'
    };
    return attrs[name] || '';
  }
};
context.monthlyCheckinOpenItemFromButton_(fakeButton);
assert.equal(lastWorkspacePage, 'assets');
assert.equal(lastFocus.accountName, 'Roth IRA');
assert.equal(lastFocus.cycleKey, '2026-09');
assert.equal(lastFocus.domain, 'investments');
assert.equal(lastFocus.reason, 'Missing September 2026 value');
assert.equal(lastFocus.reviewRoute, 'editor');

lastFocus = null;
lastWorkspacePage = null;
const debtButton = {
  getAttribute(name) {
    const attrs = {
      'data-tab': 'debts',
      'data-page': 'assets',
      'data-domain': 'debts',
      'data-account-key': 'debt:v1:DEBT-CAPITAL-ONE-1',
      'data-account-name': 'Credit Card - Capital One',
      'data-cycle-key': '2026-09',
      'data-reason': 'Needs current-cycle update',
      'data-debt-type': 'Credit Card',
      'data-review-route': 'editor',
      'data-action-kind': 'UPDATE'
    };
    return attrs[name] || '';
  }
};
context.monthlyCheckinOpenItemFromButton_(debtButton);
assert.equal(lastWorkspacePage, 'assets');
assert.equal(lastFocus.tab, 'debts');
assert.equal(lastFocus.accountName, 'Credit Card - Capital One');
assert.equal(lastFocus.debtType, 'Credit Card');
assert.equal(lastFocus.reviewRoute, 'editor');

assert.match(render,
  /function focusDebtTarget_\(obj\)[\s\S]*?setDebtPanelMode\('update'\)[\s\S]*?loadState === 'loading'\) return;[\s\S]*?loadDebtSectionThenSelect_\(name, debtType\)/,
  'Monthly Review debt open must wait for an in-flight Debts load, then keep the selected account');
assert.doesNotMatch(render,
  /function focusDebtTarget_\(obj\)[\s\S]*?loadState === 'loading' \|\|[\s\S]*?loadDebtSectionThenSelect_\(name, debtType\)/,
  'Debt focus must not start a second getDebtsUiData while the tab load is already in flight');

const focusStart = render.indexOf('function focusDebtTarget_(');
const focusEnd = render.indexOf('\nfunction escapeHtml(', focusStart);
assert.ok(focusStart >= 0 && focusEnd > focusStart, 'focusDebtTarget_ must be testable');
let thenSelectCalls = 0;
let appliedTargets = [];
const loadingSelect = { dataset: { loadState: 'loading' }, options: [{ value: '' }] };
const focusCtx = vm.createContext({
  document: { getElementById: () => loadingSelect },
  setDebtPanelMode() {},
  loadDebtSectionThenSelect_() { thenSelectCalls += 1; },
  selectDebtUpdateTarget_(name, debtType) { appliedTargets.push([name, debtType]); },
  pendingFocus: { tab: 'debts', accountName: 'Credit Card - Corporate AMEX' }
});
vm.runInContext(render.slice(focusStart, focusEnd), focusCtx);
focusCtx.focusDebtTarget_({
  accountName: 'Credit Card - Corporate AMEX',
  debtType: 'Credit Card'
});
assert.equal(thenSelectCalls, 0,
  'an in-flight Debts tab load must not start a competing load-and-select');
assert.deepEqual(appliedTargets, [],
  'Debt focus must wait for the in-flight load instead of selecting against a loading picker');
assert.equal(focusCtx.pendingFocus.accountName, 'Credit Card - Corporate AMEX',
  'pending debt focus must remain so the completed tab load can select the card');
assert.match(read('Dashboard_Script_PlanningDebts.html'),
  /function selectDebtUpdateTarget_\(accountName, optionalDebtType\)[\s\S]*?typeSel\.value = 'All'[\s\S]*?filterDebtAccounts\(\)/,
  'If a type filter would hide the focused debt, Update must fall back to All and keep the account selected');

const debtSelectSource = read('Dashboard_Script_PlanningDebts.html');
const selectStart = debtSelectSource.indexOf('function selectDebtUpdateTarget_(');
const selectEnd = debtSelectSource.indexOf('\n// First-run fallback', selectStart);
assert.ok(selectStart >= 0 && selectEnd > selectStart, 'selectDebtUpdateTarget_ must be testable');
const typeOptions = [
  { value: 'All' },
  { value: 'Credit Card' },
  { value: 'Loan' }
];
const accountOptions = [];
const typeSel = { value: 'All', options: typeOptions };
const accountSel = { value: '', options: accountOptions };
const selectCtx = vm.createContext({
  document: {
    getElementById(id) {
      if (id === 'debt_typeFilter') return typeSel;
      if (id === 'debt_account') return accountSel;
      return null;
    }
  },
  filterDebtAccounts() {
    accountOptions.length = 0;
    accountOptions.push({ value: '' });
    if (typeSel.value === 'All' || typeSel.value === 'Credit Card') {
      accountOptions.push({ value: 'Credit Card - Capital One' });
    }
    if (typeSel.value === 'All' || typeSel.value === 'Loan') {
      accountOptions.push({ value: 'Bank of America Loan' });
    }
    accountSel.value = '';
  },
  loadDebtFieldValue() {}
});
vm.runInContext(debtSelectSource.slice(selectStart, selectEnd), selectCtx);
assert.equal(selectCtx.selectDebtUpdateTarget_('Credit Card - Capital One', 'Credit Card'), true);
assert.equal(typeSel.value, 'Credit Card');
assert.equal(accountSel.value, 'Credit Card - Capital One');
assert.equal(selectCtx.selectDebtUpdateTarget_('Bank of America Loan', 'Missing Type'), true);
assert.equal(typeSel.value, 'All');
assert.equal(accountSel.value, 'Bank of America Loan');

lastWorkspacePage = null;
lastTab = null;
context.monthlyCheckinNavigateToDomain_('assets', 'bank');
assert.equal(lastWorkspacePage, 'assets');
assert.equal(lastTab, 'bank');

assert.match(body, /id="monthly_review_scope"/);
assert.match(body, /Monthly Review checks whether this month/);
assert.match(body, /Cash\/card provider readiness is reviewed separately under Planning → Data/);
assert.match(read('Dashboard_Help.html'),
  /Monthly Review<\/strong> stays in the top bar[\s\S]*turns green when all four areas are current/);
assert.doesNotMatch(monthlyUi, /Ready for review|compare or apply/);

console.log('Monthly check-in UI regressions passed.');
