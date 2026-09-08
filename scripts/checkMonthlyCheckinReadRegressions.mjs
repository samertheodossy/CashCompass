import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const read = (name) => fs.readFileSync(new URL(name, root), 'utf8');

const modelSource = read('monthly_checkin.js');
const identitySource = read('monthly_checkin_identity.js');
const readSource = read('monthly_checkin_read.js');
const planningSource = read('capital_allocation.js');
const readinessSource = read('data_readiness.js');
const plaidSource = read('plaid_import_bridge.js');
const factsSource = read('financial_facts.js');
const dashboardSource = read('dashboard_data.js');

assert.match(readSource, /function getMonthlyCheckinFromDashboard\(/);
assert.match(readSource, /function buildMonthlyCheckinReadModel_\(/);
assert.match(readSource, /monthlyCheckinReadSettingsRawValue_/);
assert.doesNotMatch(readSource, /readAllSettingsMap_/,
  'read orchestration must not call readAllSettingsMap_ (ensureInputSettingsSheet_ side effect)');
assert.doesNotMatch(readSource, /ensureInputSettingsSheet_/);
assert.doesNotMatch(readSource, /writeSetting_/);
assert.doesNotMatch(readSource, /\bsetValue\s*\(/);
assert.doesNotMatch(readSource, /\bappendRow\s*\(/);
assert.doesNotMatch(readSource, /readFinancialFacts_/);
assert.doesNotMatch(readSource, /buildPlanningDataReadinessModel_/);
assert.doesNotMatch(readSource, /plaid_import|capital_allocation/i);
assert.doesNotMatch(planningSource, /monthly_checkin_read|getMonthlyCheckinFromDashboard/);
assert.doesNotMatch(readinessSource, /monthly_checkin_read|getMonthlyCheckinFromDashboard/);
assert.doesNotMatch(plaidSource, /monthly_checkin_read|getMonthlyCheckinFromDashboard/);
assert.doesNotMatch(factsSource, /monthly_checkin_read|getMonthlyCheckinFromDashboard/);
assert.doesNotMatch(dashboardSource, /getMonthlyCheckinFromDashboard/,
  'dashboard snapshot must not gate on monthly check-in during this slice');

class FakeRange {
  constructor(sheet, row, col, numRows = 1, numCols = 1) {
    this.sheet = sheet;
    this.row = row;
    this.col = col;
    this.numRows = numRows;
    this.numCols = numCols;
  }
  getValues() {
    return Array.from({ length: this.numRows }, (_, r) =>
      Array.from({ length: this.numCols }, (_, c) =>
        this.sheet.rows[this.row - 1 + r]?.[this.col - 1 + c] ?? ''));
  }
}
class FakeSheet {
  constructor(name, rows = []) {
    this.name = name;
    this.rows = rows.map((row) => [...row]);
    this.writeLog = [];
  }
  getName() { return this.name; }
  getLastRow() { return this.rows.length; }
  getRange(row, col, numRows = 1, numCols = 1) {
    return new FakeRange(this, row, col, numRows, numCols);
  }
  setValues(values) {
    this.writeLog.push({ type: 'setValues', values });
    values.forEach((row, r) => row.forEach((value, c) => {
      while (this.rows.length <= r) this.rows.push([]);
      this.rows[r][c] = value;
    }));
    return this;
  }
  insertSheet() { throw new Error('insertSheet must not run during read'); }
}
class FakeSpreadsheet {
  constructor(sheets = {}) {
    this.sheets = sheets;
    this.writeLog = [];
  }
  getSheetByName(name) { return this.sheets[name] || null; }
  insertSheet(name) {
    this.writeLog.push({ type: 'insertSheet', name });
    const sheet = new FakeSheet(name, [['Key', 'Value']]);
    this.sheets[name] = sheet;
    return sheet;
  }
}

const cycleKey = '2026-09';
const settingsKey = `monthly_checkin.v1.${cycleKey}`;
const storedState = {
  version: 1,
  cycleKey,
  revision: 1,
  updatedAt: '2026-09-02T12:00:00.000Z',
  domains: {
    bank: { reviewedKeys: ['bank:v1:CASH-ALLY-1'] },
    houses: { reviewedKeys: [] },
    investments: { reviewedKeys: [] },
    debts: { reviewedKeys: [] }
  }
};

const registryAccounts = [
  {
    stableAccountId: 'CASH-ALLY-1', domain: 'CASH', displayName: 'Ally Checking',
    legacyDomain: 'SYS_ACCOUNTS', legacyKey: 'Ally Checking', identityStatus: 'VERIFIED'
  },
  {
    stableAccountId: 'PROP-MAIN-1', domain: 'PROPERTY', displayName: 'Main House',
    legacyDomain: 'SYS_HOUSE_ASSETS', legacyKey: 'Main House', identityStatus: 'VERIFIED'
  },
  {
    stableAccountId: 'INV-BROKER-1', domain: 'INVESTMENT', displayName: 'Brokerage',
    legacyDomain: 'SYS_ASSETS', legacyKey: 'INV-BROKER-1', identityStatus: 'VERIFIED'
  },
  {
    stableAccountId: 'DEBT-CITI-1', domain: 'DEBT', displayName: 'Citi Card',
    legacyDomain: 'INPUT_DEBTS', legacyKey: 'Citi Card', identityStatus: 'VERIFIED'
  },
  {
    stableAccountId: 'CASH-DUP-1', domain: 'CASH', displayName: 'Duplicate One',
    legacyDomain: 'SYS_ACCOUNTS', legacyKey: 'Duplicate Bank', identityStatus: 'VERIFIED'
  },
  {
    stableAccountId: 'CASH-DUP-2', domain: 'CASH', displayName: 'Duplicate Two',
    legacyDomain: 'SYS_ACCOUNTS', legacyKey: 'Duplicate Bank', identityStatus: 'VERIFIED'
  }
];

function buildContext(overrides = {}) {
  const settingsSheet = new FakeSheet('INPUT - Settings', [
    ['Key', 'Value'],
    [settingsKey, JSON.stringify(storedState)]
  ]);
  const ss = overrides.ss || new FakeSpreadsheet({ 'INPUT - Settings': settingsSheet });
  const writeLog = [];
  const ctx = {
    console,
    Session: { getScriptTimeZone: () => 'America/Los_Angeles' },
    Utilities: {
      formatDate(date, _tz, pattern) {
        const value = new Date(date);
        if (pattern === 'yyyy-MM') {
          const year = value.getUTCFullYear();
          const month = String(value.getUTCMonth() + 1).padStart(2, '0');
          return `${year}-${month}`;
        }
        return value.toISOString();
      }
    },
    getUserSpreadsheet_: () => ss,
    getStartupRoutingFromDashboard: () => ({
      ok: true,
      isBlankWorkbook: false,
      mode: 'normal',
      coreSheetCount: 6,
      existingCoreSheetCount: 6,
      hasAnyAppSheet: true
    }),
    getBankAccountUiData: () => ({
      managementAccounts: [
        { accountName: 'Ally Checking' },
        { accountName: 'Duplicate Bank' },
        { accountName: 'Mystery Bank' }
      ]
    }),
    getHouseUiData: () => ({
      managementHouses: [{ houseName: 'Main House' }]
    }),
    getInvestmentUiData: () => ({
      managementAccounts: [
        { accountName: 'Brokerage', investmentId: 'INV-BROKER-1' },
        { accountName: 'Orphan', investmentId: '' }
      ]
    }),
    getActiveDebtsForManagementFromDashboard: () => ([
      { accountName: 'Citi Card', type: 'Credit Card', lastUpdated: '' }
    ]),
    financialIdentityReadRegistry_: () => ({ accounts: registryAccounts.slice() }),
    buildRecoveryRouting_: (err) => ({
      ok: false,
      isBlankWorkbook: false,
      mode: 'recovery',
      recovery: { type: 'unavailable', message: String(err && err.message || err) }
    })
  };
  Object.assign(ctx, overrides.handlers || {});
  vm.createContext(ctx);
  vm.runInContext(modelSource, ctx, { filename: 'monthly_checkin.js' });
  vm.runInContext(identitySource, ctx, { filename: 'monthly_checkin_identity.js' });
  vm.runInContext(readSource, ctx, { filename: 'monthly_checkin_read.js' });
  return { ctx, ss, settingsSheet, writeLog };
}

const { ctx } = buildContext();
assert.equal(ctx.monthlyCheckinCurrentCycleKey_(new Date('2026-09-15T12:00:00.000Z')), '2026-09');
assert.equal(ctx.monthlyCheckinReadSettingsRawValue_(
  buildContext().ss, settingsKey), JSON.stringify(storedState));

const missingSheetSs = new FakeSpreadsheet({});
assert.equal(ctx.monthlyCheckinReadSettingsRawValue_(missingSheetSs, settingsKey), '');

const model = ctx.buildMonthlyCheckinReadModel_(
  buildContext().ss,
  { cycleKey },
  { ok: true, isBlankWorkbook: false, mode: 'normal' }
);
assert.equal(model.available, true);
assert.equal(model.cycleKey, cycleKey);
assert.equal(model.settingsKey, settingsKey);
assert.equal(model.state.parseReason, '');
assert.equal(model.state.persisted, true);
assert.equal(model.projection.domains.bank.status, 'IN_PROGRESS');
assert.equal(model.projection.domains.houses.status, 'NOT_STARTED');
assert.equal(model.projection.domains.investments.status, 'NOT_STARTED');
assert.equal(model.projection.domains.debts.status, 'NOT_STARTED');
assert.equal(model.projection.status, 'IN_PROGRESS');
assert.equal(model.projection.domains.bank.activeCount, 1);
assert.equal(model.projection.domains.bank.identityIssueCount, 2);
assert.equal(model.projection.domains.bank.currentMonthValueCount, 0);
assert.equal(model.projection.domains.debts.unreviewedCount, 1);
assert.equal(model.projection.domains.debts.domainKind, 'debt_acknowledgement');
assert.equal(model.projection.domains.bank.domainKind, 'month_value');
assert.equal(
  model.projection.domains.bank.activeRecords.some((row) => row.accountKey === 'bank:v1:CASH-ALLY-1'),
  true
);
assert.equal(
  model.projection.domains.houses.activeRecords.some((row) => row.accountKey === 'house:v1:PROP-MAIN-1'),
  true
);
assert.equal(model.projection.domains.investments.activeCount, 2);
assert.equal(model.projection.domains.investments.identityIssueCount, 0);
assert.equal(
  model.projection.domains.investments.activeRecords.some((row) =>
    row.displayName === 'Brokerage' && !row.accountKey),
  true
);
assert.equal(
  model.projection.domains.investments.activeRecords.some((row) =>
    row.displayName === 'Orphan' && !row.accountKey),
  true
);
assert.equal(
  model.projection.domains.debts.activeRecords.some((row) => row.accountKey === 'debt:v1:DEBT-CITI-1'),
  true
);

const unresolvedBank = model.projection.domains.bank.identityIssues.find((issue) =>
  issue.displayName === 'Mystery Bank');
assert.equal(unresolvedBank && unresolvedBank.code, 'IDENTITY_UNRESOLVED');
const duplicateBank = model.projection.domains.bank.identityIssues.find((issue) =>
  issue.displayName === 'Duplicate Bank');
assert.equal(duplicateBank && duplicateBank.code, 'DUPLICATE_LEGACY_IDENTITY');
assert.equal(
  model.projection.domains.bank.activeRecords.some((row) => row.accountKey === 'bank:v1:5'),
  false,
  'row-number fallback keys must never appear'
);

const orphanInvestment = model.projection.domains.investments.identityIssues.find((issue) =>
  issue.displayName === 'Orphan');
assert.equal(orphanInvestment, undefined,
  'ordinary investments without Investment Id must not be identity failures');

const incomeProducingCtx = buildContext({
  handlers: {
    getInvestmentUiData: () => ({
      managementAccounts: [{
        accountName: 'Robinhood Income',
        investmentId: '',
        planningPurpose: 'INCOME_PRODUCING'
      }]
    })
  }
});
const incomeProducing = incomeProducingCtx.ctx.buildMonthlyCheckinReadModel_(
  incomeProducingCtx.ss,
  { cycleKey },
  { ok: true, isBlankWorkbook: false, mode: 'normal' }
);
const incomeProducingIssue = incomeProducing.projection.domains.investments.identityIssues.find((issue) =>
  issue.displayName === 'Robinhood Income');
assert.equal(incomeProducingIssue && incomeProducingIssue.code, 'IDENTITY_UNRESOLVED',
  'income-producing investments still require Investment Id identity');

const incomeProducingResolvedCtx = buildContext({
  handlers: {
    getInvestmentUiData: () => ({
      managementAccounts: [{
        accountName: 'Robinhood Income',
        investmentId: 'INV-BROKER-1',
        planningPurpose: 'INCOME_PRODUCING'
      }]
    })
  }
});
const incomeProducingResolved = incomeProducingResolvedCtx.ctx.buildMonthlyCheckinReadModel_(
  incomeProducingResolvedCtx.ss,
  { cycleKey },
  { ok: true, isBlankWorkbook: false, mode: 'normal' }
);
assert.equal(
  incomeProducingResolved.projection.domains.investments.activeRecords.some((row) =>
    row.accountKey === 'investment:v1:INV-BROKER-1'),
  true,
  'income-producing investments with Investment Id keep durable keys'
);

const boundedInvestments = Array.from({ length: 14 }, (_, index) => ({
  accountName: 'Investment ' + String(index + 1).padStart(2, '0'),
  investmentId: '',
  planningPurpose: ''
}));
const boundedCtx = buildContext({
  handlers: {
    getInvestmentUiData: () => ({ managementAccounts: boundedInvestments })
  }
});
const boundedResolved = boundedCtx.ctx.monthlyCheckinResolveInvestmentActive_(
  boundedInvestments,
  boundedCtx.ctx.monthlyCheckinBuildRegistryIndex_({ accounts: [] }),
  boundedCtx.ctx.monthlyCheckinBuildInvestmentLifecycleCounts_(boundedInvestments),
  Object.fromEntries(
    boundedInvestments.map((row, index) => [row.accountName.toLowerCase(), {
      present: index < 12,
      value: index < 12 ? 1000 + index : null
    }])
  )
);
assert.equal(boundedResolved.activeEntries.length, 14);
assert.equal(boundedResolved.identityIssues.length, 0);
assert.equal(
  boundedResolved.activeEntries.filter((row) => row.hasCurrentMonthValue).length,
  12
);
assert.equal(
  boundedResolved.activeEntries.filter((row) => !row.hasCurrentMonthValue).length,
  2
);
assert.equal(
  boundedResolved.activeEntries.every((row) => !row.accountKey),
  true,
  'bounded ordinary investments must not fabricate durable review keys'
);

const missingStateSheet = new FakeSheet('INPUT - Settings', [['Key', 'Value']]);
const missingStateSs = new FakeSpreadsheet({ 'INPUT - Settings': missingStateSheet });
const missingState = ctx.buildMonthlyCheckinReadModel_(
  missingStateSs,
  { cycleKey },
  { ok: true, isBlankWorkbook: false, mode: 'normal' }
);
assert.equal(missingState.state.parseReason, 'MISSING');
assert.equal(missingState.state.persisted, false);
assert.equal(missingState.projection.complete, false);
assert.equal(missingStateSheet.writeLog.length, 0);
assert.equal(missingStateSs.writeLog.length, 0);

const blankCtx = buildContext({
  handlers: {
    getStartupRoutingFromDashboard: () => ({
      ok: true,
      isBlankWorkbook: true,
      mode: 'normal',
      hasAnyAppSheet: false
    })
  }
});
const blank = blankCtx.ctx.getMonthlyCheckinFromDashboard({ cycleKey });
assert.equal(blank.available, false);
assert.equal(blank.routing.isBlankWorkbook, true);
assert.equal(blank.projection, null);
assert.equal(blankCtx.settingsSheet.writeLog.length, 0);

const recoveryCtx = buildContext({
  handlers: {
    getStartupRoutingFromDashboard: () => ({
      ok: false,
      isBlankWorkbook: false,
      mode: 'recovery',
      recovery: { type: 'stale' }
    })
  }
});
const recovery = recoveryCtx.ctx.getMonthlyCheckinFromDashboard({ cycleKey });
assert.equal(recovery.available, false);
assert.equal(recovery.routing.mode, 'recovery');
assert.equal(recovery.routing.recovery.type, 'stale');

const filteredCtx = buildContext({
  handlers: {
    getBankAccountUiData: () => ({
      managementAccounts: [{ accountName: 'Ally Checking' }],
      inactiveAccounts: [{ accountName: 'Closed Ally' }]
    }),
    getInvestmentUiData: () => ({
      managementAccounts: [{ accountName: 'Brokerage', investmentId: 'INV-BROKER-1' }],
      inactiveAccounts: [{ accountName: 'Old Brokerage', investmentId: 'INV-OLD' }]
    })
  }
});
const filtered = filteredCtx.ctx.buildMonthlyCheckinReadModel_(
  filteredCtx.ss,
  { cycleKey },
  { ok: true, isBlankWorkbook: false, mode: 'normal' }
);
assert.equal(filtered.projection.domains.bank.activeCount, 1);
assert.equal(
  filtered.projection.domains.bank.activeRecords.some((row) => row.displayName === 'Closed Ally'),
  false
);
assert.equal(filtered.projection.domains.investments.activeCount, 1);

const rpc = buildContext().ctx.getMonthlyCheckinFromDashboard({ cycleKey });
assert.equal(rpc.available, true);
assert.equal(rpc.settingsKey, settingsKey);
assert.equal(buildContext().settingsSheet.writeLog.length, 0);

console.log('Monthly check-in read orchestration regressions passed.');
