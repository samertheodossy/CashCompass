import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const read = (name) => fs.readFileSync(new URL(name, root), 'utf8');

const monthlyUi = read('Dashboard_Script_MonthlyCheckin.html');
const plaidClient = read('Dashboard_Script_PlaidConnectedAccounts.html');
const render = read('Dashboard_Script_Render.html');

assert.match(plaidClient, /refreshMonthlyCheckinAfterDebtMutation_/);
assert.match(plaidClient, /accountDomain === 'DEBT' && typeof refreshMonthlyCheckinAfterDebtMutation_/);
assert.match(
  plaidClient,
  /function plaidMainApplySelectedUpdates_[\s\S]*?function\s*\(result\)\s*\{[\s\S]{0,1200}refreshMonthlyCheckinAfterDebtMutation_/
);
const applyFnBlock = plaidClient.match(
  /function plaidMainApplySelectedUpdates_[\s\S]*?function\s*\(err\)\s*\{[\s\S]*?plaidMainPatchAccountCard_\(domain, connection, account\);\s*\}\);/
);
assert.ok(applyFnBlock, 'Apply handler block must exist');
assert.doesNotMatch(
  applyFnBlock[0].match(/function\s*\(err\)\s*\{[\s\S]*?\}\);/)[0],
  /refreshMonthlyCheckinAfterDebtMutation_/,
  'failed Apply must not refresh Monthly Review'
);
assert.match(render, /refreshMonthlyCheckinIfStale_/);
assert.doesNotMatch(monthlyUi, /location\.reload|window\.location\.reload/);
assert.doesNotMatch(plaidClient, /location\.reload|window\.location\.reload/);

function makeHost(id) {
  return {
    id,
    hidden: true,
    _html: '',
    classList: {
      _active: false,
      contains(name) {
        if (name === 'active') return this._active;
        if (name === 'startup-gated') return false;
        return false;
      }
    },
    set hidden(value) { this._hidden = value; },
    get hidden() { return !!this._hidden; },
    set innerHTML(value) { this._html = value; },
    get innerHTML() { return this._html || ''; },
    set textContent(value) { this._text = String(value ?? ''); },
    get textContent() { return this._text || ''; }
  };
}

function buildStaleDebtModel() {
  return {
    available: true,
    cycleKey: '2026-09',
    projection: {
      cycleKey: '2026-09',
      ui: {
        areasCurrent: 0,
        totalActiveCount: 24,
        attentionCount: 24,
        needsReviewCount: 24,
        identityIssueCount: 0,
        identityRepairItems: [],
        domainSections: [{
          domain: 'debts',
          label: 'Debts',
          domainKind: 'debt_acknowledgement',
          navigatePage: 'assets',
          navigateTab: 'debts',
          activeCount: 24,
          currentCount: 0,
          records: Array.from({ length: 24 }, (_, index) => ({
            accountKey: 'debt:v1:DEBT-' + String(index + 1).padStart(2, '0'),
            displayName: index === 7 ? 'Credit Card - American Express' : ('Debt ' + (index + 1)),
            needsAttention: true,
            reason: 'Needs current-cycle update',
            debtType: 'Credit Card',
            currentValue: index === 7 ? 41290.97 : 100
          }))
        }]
      }
    }
  };
}

function buildFreshAmexDebtModel() {
  const records = Array.from({ length: 24 }, (_, index) => {
    if (index === 7) {
      return {
        accountKey: 'debt:v1:DEBT-08',
        displayName: 'Credit Card - American Express',
        needsAttention: false,
        currentStatusLabel: 'Current for September 2026',
        lastUpdated: '2026-09-08',
        debtType: 'Credit Card',
        currentValue: 41290.97
      };
    }
    return {
      accountKey: 'debt:v1:DEBT-' + String(index + 1).padStart(2, '0'),
      displayName: 'Debt ' + (index + 1),
      needsAttention: true,
      reason: 'Needs current-cycle update',
      debtType: 'Credit Card',
      currentValue: 100
    };
  });
  return {
    available: true,
    cycleKey: '2026-09',
    projection: {
      cycleKey: '2026-09',
      ui: {
        areasCurrent: 0,
        totalActiveCount: 24,
        attentionCount: 23,
        needsReviewCount: 23,
        identityIssueCount: 0,
        identityRepairItems: [],
        domainSections: [{
          domain: 'debts',
          label: 'Debts',
          domainKind: 'debt_acknowledgement',
          navigatePage: 'assets',
          navigateTab: 'debts',
          activeCount: 24,
          currentCount: 1,
          records
        }]
      }
    }
  };
}

const hosts = Object.create(null);
['ov_monthly_review_entry', 'page_overview', 'page_onboarding', 'page_monthly_review',
  'monthly_review_subtitle', 'monthly_review_summary', 'monthly_review_domains',
  'monthly_review_identity', 'monthly_review_identity_list'
].forEach((id) => { hosts[id] = makeHost(id); });

let rpcCount = 0;
let lastRpcName = '';

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
  showPage(name) {
    Object.keys(hosts).forEach((id) => {
      if (id.indexOf('page_') === 0) hosts[id].classList._active = false;
    });
    if (hosts['page_' + name]) hosts['page_' + name].classList._active = true;
    if (name === 'monthly_review') {
      context.renderMonthlyReviewScreen_(context.__monthlyCheckinModel);
      context.loadMonthlyCheckinOverview_(context.__monthlyCheckinStale);
    }
    if (name === 'overview' && typeof context.refreshMonthlyCheckinIfStale_ === 'function') {
      context.refreshMonthlyCheckinIfStale_();
    }
  },
  google: { script: { run: {} } },
  runReadOnlyRpcWithRetry_(options) {
    options.invoke(
      function(model) { options.onSuccess(model); },
      function(err) { options.onFailure(err); }
    );
  }
};

vm.createContext(context);
vm.runInContext(monthlyUi, context, { filename: 'Dashboard_Script_MonthlyCheckin.html' });

context.google.script.run.withSuccessHandler = function(handler) {
  return {
    withFailureHandler() {
      return {
        getMonthlyCheckinFromDashboard() {
          rpcCount++;
          lastRpcName = 'getMonthlyCheckinFromDashboard';
          handler(buildFreshAmexDebtModel());
        }
      };
    }
  };
};

context.renderMonthlyCheckinUi_(buildStaleDebtModel());
hosts.page_overview.classList._active = true;
assert.equal(hosts.ov_monthly_review_entry.hidden, false, 'stale model still shows attention entry');

rpcCount = 0;
context.refreshMonthlyCheckinAfterDebtMutation_();
assert.equal(rpcCount, 1, 'visible Overview must refresh Monthly Review immediately after debt Apply');
assert.equal(lastRpcName, 'getMonthlyCheckinFromDashboard');
assert.equal(context.__monthlyCheckinStale, false);
const debtsSection = context.__monthlyCheckinModel.projection.ui.domainSections[0];
assert.equal(debtsSection.currentCount, 1,
  'AMEX scenario must move from stale 0 of 24 to 1 of 24 without browser reload');
assert.equal(debtsSection.records[7].needsAttention, false);
assert.match(debtsSection.records[7].displayName, /American Express/);
assert.equal(context.__monthlyCheckinModel.projection.ui.attentionCount, 23);

context.renderMonthlyCheckinUi_(buildStaleDebtModel());
hosts.page_overview.classList._active = false;
hosts.page_monthly_review.classList._active = false;
rpcCount = 0;
context.refreshMonthlyCheckinAfterDebtMutation_();
assert.equal(rpcCount, 0, 'hidden screens must defer Monthly Review RPC until opened');
assert.equal(context.__monthlyCheckinStale, true);

rpcCount = 0;
context.showPage('overview');
assert.equal(rpcCount, 1, 'Overview must consume stale Monthly Review refresh when opened');
assert.equal(context.__monthlyCheckinModel.projection.ui.domainSections[0].currentCount, 1);

rpcCount = 0;
context.renderMonthlyCheckinUi_(buildStaleDebtModel());
hosts.page_overview.classList._active = true;
hosts.page_monthly_review.classList._active = true;
context.refreshMonthlyCheckinAfterDebtMutation_();
assert.equal(rpcCount, 1, 'single RPC when Overview and Monthly Review are both active');
assert.match(hosts.monthly_review_domains.innerHTML, /1 of 24 current/,
  'open Monthly Review screen must rerender domain summary immediately');

rpcCount = 0;
context.renderMonthlyCheckinUi_(buildStaleDebtModel());
context.__monthlyCheckinStale = true;
context.__monthlyCheckinLoading = true;
context.refreshMonthlyCheckinAfterDebtMutation_();
assert.equal(rpcCount, 1, 'forced refresh must bypass in-flight guard and avoid duplicate stale RPC');
assert.equal(context.__monthlyCheckinStale, false);

console.log('Monthly check-in Plaid Apply refresh regressions passed.');
