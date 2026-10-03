import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read = (name) => fs.readFileSync(new URL('../' + name, import.meta.url), 'utf8');

const educationSource = read('education.js');
const retirementSource = read('retirement.js');
const activitySource = read('activity_log.js');
const body = read('Dashboard_Body.html');
const help = read('Dashboard_Help.html');
const styles = read('Dashboard_Styles.html');
const render = read('Dashboard_Script_Render.html');
const client = read('Dashboard_Script_PlanningEducation.html');
const webShell = read('PlannerDashboardWeb.html');
const thisWeekClient = read('Dashboard_Script_PlanningCapitalAllocation.html');

assert.match(educationSource,
  /A projection based on an end-of-month investment balance starts in the[\s\S]*following calendar month/);
assert.match(educationSource,
  /Contributions or expenses already reflected in that[\s\S]*end-of-month balance are not counted twice/);
assert.doesNotMatch(educationSource, /function calculateEducation|function projectEducation|function runEducation/);
assert.match(educationSource, /Lutfi 529/);
assert.match(educationSource, /Laith 529/);
assert.match(educationSource, /INPUT - Education Line Items/);
assert.match(educationSource, /blankEducationPlan_/);
assert.match(educationSource, /education_plan_update/);
assert.doesNotMatch(educationSource, /getCurrentInvestableAssetsForRetirement_/);
assert.doesNotMatch(educationSource, /Filtering 529s out of Retirement investable assets/);
assert.doesNotMatch(educationSource, /retirement529Review/);
assert.doesNotMatch(
  educationSource.slice(
    educationSource.indexOf('function getOrCreateEducationSheet_'),
    educationSource.indexOf('function getOrCreateEducationLineItemsSheet_')
  ),
  /1000|1625|25000|30000|75000|2028|2029/
);
assert.doesNotMatch(
  educationSource.slice(
    educationSource.indexOf('function getOrCreateEducationLineItemsSheet_'),
    educationSource.indexOf('function buildEducationUiData_')
  ),
  /1000|1625|25000|30000|75000/
);

assert.match(retirementSource,
  /function isRetirementExcludedEducationAssetType_\([\s\S]*?EDUCATION[\s\S]*?529/);
assert.match(retirementSource,
  /function getCurrentInvestableAssetsForRetirement_\([\s\S]*?isRetirementExcludedEducationAssetType_/);
assert.doesNotMatch(
  retirementSource.slice(
    retirementSource.indexOf('function getCurrentInvestableAssetsForRetirement_'),
    retirementSource.indexOf('function getCurrentInvestableAssetsForRetirement_') + 900
  ),
  /Lutfi 529|Laith 529/
);

assert.match(activitySource, /etEarly === 'education_plan_update'\) return 'Education'/);
assert.match(activitySource, /case 'education_plan_update': return 'Education plan updated'/);
assert.match(activitySource, /et === 'education_plan_update'/);

const planning = body.slice(
  body.indexOf('<div id="page_planning"'),
  body.indexOf('<!--\n    Onboarding Phase 1')
);
assert.match(planning, /data-tab="education"[\s\S]*?>\s*Education\s*</);
assert.match(planning, /id="education" class="panel"/);
assert.match(planning, /Lutfi 529/);
assert.match(planning, /Laith 529/);
const educationPanel = planning.slice(
  planning.indexOf('id="education"'),
  planning.indexOf('id="debtPayoff"')
);
const lutfiChoice = educationPanel.indexOf('data-account-name="Lutfi 529"');
const laithChoice = educationPanel.indexOf('data-account-name="Laith 529"');
const coverageGoal = educationPanel.indexOf('id="edu_coverageGoal"');
assert.ok(lutfiChoice >= 0 && laithChoice >= 0,
  'Education must expose both exact account choices in the page markup');
assert.ok(lutfiChoice < coverageGoal && laithChoice < coverageGoal,
  'Both Education account choices must appear before the selected-child form so they are visible without scrolling through one child');
assert.match(educationPanel,
  /id="edu_account_cards"[\s\S]*data-account-name="Lutfi 529"[\s\S]*data-account-name="Laith 529"[\s\S]*id="edu_selected_plan"/);
const educationIntro = educationPanel.slice(
  educationPanel.indexOf('planning-panel-purpose'),
  educationPanel.indexOf('edu_account_cards')
);
assert.match(educationIntro, /Forecasts are not calculated yet/);
assert.doesNotMatch(educationIntro, /Lutfi 529|Laith 529|Choose an account|Exact account|Retirement/);
assert.doesNotMatch(educationPanel, /Exact account|education_retirement_529_note|Retirement still includes 529|investable assets|Choose an account to edit/);
assert.doesNotMatch(educationPanel, /class="grid-2"[\s\S]*id="edu_selected_plan"/);
assert.match(educationPanel, /class="education-layout"/);
assert.match(educationPanel, /<h3 id="edu_selected_title">Lutfi 529<\/h3>/);
assert.match(educationPanel, /education-balance-summary[\s\S]*id="edu_live_balance"/);
assert.doesNotMatch(educationPanel, /data-edu-live-balance/);
assert.ok(educationPanel.indexOf('id="edu_selected_plan"') < educationPanel.indexOf('id="edu_line_items"'),
  'Selected plan details must appear before full-width education line items');
assert.match(educationPanel, /<details class="planning-advanced-details">/);
assert.doesNotMatch(educationPanel, /<details class="planning-advanced-details"[^>]*open/);
assert.match(styles, /\.education-account-selector\s*\{[\s\S]*?grid-template-columns:\s*1fr 1fr/);
assert.match(styles, /@media \(max-width:\s*760px\)[\s\S]*?\.education-account-selector\s*\{[\s\S]*?grid-template-columns:\s*1fr 1fr/);
assert.match(styles, /@media \(max-width:\s*760px\)[\s\S]*?\.education-layout\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\)/);
assert.match(styles, /\.education-layout\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/);
assert.match(styles, /\.education-account-card\s*\{[^}]*color:\s*#1f2937/);
assert.match(styles, /\.education-account-card\.active\s*\{[^}]*color:\s*#ffffff/);
assert.match(styles, /\.education-account-card:focus-visible\s*\{[^}]*outline:/);
assert.match(client, /function selectEducationAccount\(accountName\)/);
assert.match(client, /educationExactUiAccountName_\(accountName\)/);
assert.match(client, /collectEducationLineItemsFromDom_\(\)/);
assert.match(client, /function educationLineItemsForSelectedAccount_\(/);
assert.match(client, /education-line-item-account">Account: <strong data-edu-line-account>/);
assert.match(client, /data-account-name', item.accountName/);
assert.match(client, /Add a school, cost, or contribution row\./);
assert.doesNotMatch(client, /No school, cost, or contribution-change rows yet for/);
assert.doesNotMatch(client, /host\.innerHTML = ''[\s\S]*createElement\('button'\)[\s\S]*Lutfi 529/);
assert.doesNotMatch(client, /education_retirement_529_note/);
assert.match(help, /Each saved plan stays on its own exact account/);
const educationHelp = help.slice(
  help.indexOf('id="help-education"'),
  help.indexOf('id="help-advanced"')
);
assert.doesNotMatch(educationHelp, /Retirement|investable assets|529 balances/);
assert.match(help, /Current investable assets exclude accounts typed Education or 529/);
assert.match(planning, /class="tab-btn active"[\s\S]*?data-tab="capitalAllocationPreview"/);
assert.equal((planning.match(/class="tab-btn active"/g) || []).length, 1,
  'Planning default must remain a single active primary tool');
assert.match(planning, /id="capitalAllocationPreview" class="panel active"/);
assert.doesNotMatch(planning, /id="education" class="panel active"/);
assert.doesNotMatch(planning, /Retirement still includes 529 balances in current investable assets/);
assert.match(client, /function loadEducationSection\(/);
assert.doesNotMatch(client, /runReadOnlyRpcWithRetry_/);
assert.doesNotMatch(client, /google\.script\.run[\s\S]*?updateInvestmentValueByDate|saveBill|saveDebt/);
assert.match(webShell, /includeHtml_\('Dashboard_Script_PlanningEducation'\)/);
assert.match(render, /name === 'education' && typeof loadEducationSection/);
assert.match(render, /planning: 'capitalAllocationPreview'/);
assert.doesNotMatch(thisWeekClient, /loadEducationSection|Education planner|Lutfi 529/);
assert.doesNotMatch(help, /INPUT - Education|SYS - Assets|LOG - Activity/);
assert.match(help, /or <strong>Education<\/strong> from one tool selector/);
assert.match(styles, /repeat\(6,\s*minmax\(0,\s*1fr\)\)/);

class FakeRange {
  constructor(sheet, row, col, numRows = 1, numCols = 1) {
    this.sheet = sheet;
    this.row = row;
    this.col = col;
    this.numRows = numRows;
    this.numCols = numCols;
  }
  getValue() { return this.sheet.valueAt(this.row, this.col); }
  getDisplayValue() { return String(this.getValue() ?? ''); }
  setValue(value) { this.sheet.setValueAt(this.row, this.col, value); return this; }
  setNumberFormat() { return this; }
  setFontWeight() { return this; }
  clearContent() {
    for (let r = 0; r < this.numRows; r++) {
      for (let c = 0; c < this.numCols; c++) {
        this.sheet.setValueAt(this.row + r, this.col + c, '');
      }
    }
    return this;
  }
  getValues() {
    return Array.from({ length: this.numRows }, (_, r) =>
      Array.from({ length: this.numCols }, (_, c) => this.sheet.valueAt(this.row + r, this.col + c)));
  }
  getDisplayValues() {
    return this.getValues().map((row) => row.map((value) => String(value ?? '')));
  }
  setValues(values) {
    values.forEach((row, r) => row.forEach((value, c) => {
      this.sheet.setValueAt(this.row + r, this.col + c, value);
    }));
    return this;
  }
}

class FakeSheet {
  constructor(name, rows) {
    this.name = name;
    this.rows = [];
    this.width = 1;
    (rows || [['']]).forEach((row, idx) => {
      row.forEach((value, col) => this.setValueAt(idx + 1, col + 1, value));
    });
  }
  setValueAt(row, col, value) {
    while (this.rows.length < row) {
      this.rows.push(Array.from({ length: this.width }, () => ''));
    }
    if (col > this.width) {
      const extra = col - this.width;
      this.rows.forEach((existing) => {
        for (let i = 0; i < extra; i++) existing.push('');
      });
      this.width = col;
    }
    this.rows[row - 1][col - 1] = value;
  }
  valueAt(row, col) {
    return this.rows[row - 1]?.[col - 1] ?? '';
  }
  getName() { return this.name; }
  getLastRow() { return this.rows.length; }
  getLastColumn() { return this.width; }
  getRange(row, col, numRows, numCols) {
    return new FakeRange(this, row, col, numRows || 1, numCols || 1);
  }
  getDataRange() {
    return this.getRange(1, 1, Math.max(1, this.getLastRow()), Math.max(1, this.getLastColumn()));
  }
  appendRow(values) {
    const next = this.getLastRow() + 1;
    values.forEach((value, idx) => this.setValueAt(next, idx + 1, value));
  }
  deleteRows(start, count) {
    this.rows.splice(start - 1, count);
  }
  setFrozenRows() {}
  setColumnWidths() {}
}

class FakeSpreadsheet {
  constructor(sheets) {
    this.id = 'edu-test-workbook';
    this.sheets = Object.fromEntries((sheets || []).map((sheet) => [sheet.getName(), sheet]));
    this.inserted = [];
  }
  getId() { return this.id; }
  getSheetByName(name) { return this.sheets[name] || null; }
  getSheets() { return Object.values(this.sheets); }
  insertSheet(name) {
    const sheet = new FakeSheet(name, [['']]);
    this.sheets[name] = sheet;
    this.inserted.push(name);
    return sheet;
  }
}

function snapshotDomain_(ss, names) {
  const out = {};
  names.forEach((name) => {
    const sheet = ss.getSheetByName(name);
    out[name] = sheet ? JSON.stringify(sheet.getDataRange().getValues()) : null;
  });
  return out;
}

function createContext(ss, logs) {
  const context = {
    EDUCATION_ACCOUNT_NAMES_: undefined,
    getUserSpreadsheet_() { return ss; },
    getSheetNames_() {
      return { ASSETS: 'SYS - Assets', INVESTMENTS: 'INPUT - Investments' };
    },
    investmentNumericEvidencePresent_(raw) {
      return !(raw === '' || raw === null || raw === undefined);
    },
    toNumber_(value) {
      if (typeof value === 'number') return value;
      const s = String(value || '').trim();
      if (!s) return 0;
      return Number(s.replace(/\$/g, '').replace(/,/g, '').replace(/%/g, '').trim()) || 0;
    },
    round2_(n) {
      return Math.round((Number(n || 0) + Number.EPSILON) * 100) / 100;
    },
    appendActivityLog_(target, payload) {
      logs.push({ targetId: target.getId(), payload });
      return true;
    },
    touchDashboardSourceUpdated_() {},
    INVESTMENT_ID_HEADER_: 'Investment Id'
  };
  vm.createContext(context);
  vm.runInContext(educationSource, context);
  return context;
}

const protectedNames = [
  'INPUT - Investments',
  'SYS - Assets',
  'INPUT - Bills',
  'INPUT - Cash Flow 2026',
  'SYS - Investment Holdings',
  'INPUT - Retirement'
];

function populatedWorkbook() {
  return new FakeSpreadsheet([
    new FakeSheet('INPUT - Investments', [
      ['Year', '2026'],
      ['Account Name', 'Type', 'Jan-26', 'Active'],
      ['Lutfi 529', '529', 73028.59, 'Yes'],
      ['Laith 529', 'Education', 41200, 'Yes'],
      ['Samer Robinhood', 'Brokerage', 5000, 'Yes']
    ]),
    new FakeSheet('SYS - Assets', [
      ['Account Name', 'Type', 'Current Balance', 'Active', 'Investment Id'],
      ['Lutfi 529', '529', 73028.59, 'Yes', 'INV-LUTFI-529'],
      ['Laith 529', 'Education', 41200, 'Yes', 'INV-LAITH-529'],
      ['Samer Robinhood', 'Brokerage', 5000, 'Yes', 'INV-SR']
    ]),
    new FakeSheet('INPUT - Bills', [['Payee', 'Amount'], ['Keep Me', 99]]),
    new FakeSheet('INPUT - Cash Flow 2026', [['Name', 'Jan'], ['Keep Cash Flow', 12]]),
    new FakeSheet('SYS - Investment Holdings', [['Ticker', 'Shares'], ['KEEP', 7]]),
    new FakeSheet('INPUT - Retirement', [['Setting', 'Value'], ['Selected Scenario', 'Base'], ['Keep Retirement', 1]])
  ]);
}

const firstSs = populatedWorkbook();
const firstLogs = [];
const firstCtx = createContext(firstSs, firstLogs);
const firstData = firstCtx.getEducationUiData(firstSs);
assert.deepEqual(firstSs.inserted, ['INPUT - Education', 'INPUT - Education Line Items']);
assert.equal(firstData.projectionAvailable, false);
assert.equal(JSON.stringify(firstData.accountNames), JSON.stringify(['Lutfi 529', 'Laith 529']));
assert.equal(firstData.plans[0].accountName, 'Lutfi 529');
assert.equal(firstData.plans[1].accountName, 'Laith 529');
assert.equal(firstData.plans[0].liveBalance.currentBalance, 73028.59);
assert.equal(firstData.plans[1].liveBalance.currentBalance, 41200);
assert.equal(firstData.plans[0].currentMonthlyContribution.present, false);
assert.equal(firstData.plans[1].currentMonthlyContribution.present, false);
assert.equal(firstData.plans[0].coverageGoal, '');
assert.equal(firstData.lineItems.length, 0);
assert.equal(firstData.household.expectedAnnualReturnPct.base.present, false);
assert.equal(firstData.retirement529Review, undefined);

const planValues = firstSs.getSheetByName('INPUT - Education').getDataRange().getValues();
assert.ok(planValues.some((row) => row[0] === 'Lutfi 529'));
assert.ok(planValues.some((row) => row[0] === 'Laith 529'));
planValues.forEach((row) => {
  if (row[0] === 'Lutfi 529' || row[0] === 'Laith 529') {
    assert.equal(row[2], '', 'first-create contribution must stay blank, not 0');
  }
  if (String(row[0]).includes('Return') || String(row[0]).includes('Inflation')) {
    assert.equal(row[1], '');
    assert.equal(row[2], '');
    assert.equal(row[3], '');
  }
});
const lineValues = firstSs.getSheetByName('INPUT - Education Line Items').getDataRange().getValues();
assert.equal(lineValues.length, 1);
assert.equal(lineValues[0][0], 'Item Id');

const beforeCreate = snapshotDomain_(firstSs, protectedNames);
const again = firstCtx.getEducationUiData(firstSs);
assert.deepEqual(firstSs.inserted, ['INPUT - Education', 'INPUT - Education Line Items']);
assert.equal(again.plans[0].currentMonthlyContribution.present, false);
assert.deepEqual(snapshotDomain_(firstSs, protectedNames), beforeCreate);

const beforeSave = snapshotDomain_(firstSs, protectedNames);
const saved = firstCtx.saveEducationInputs({
  household: {
    selectedScenario: 'Base',
    expectedAnnualReturnPct: { low: 4, base: '', high: { present: false, value: null } },
    educationCostInflationPct: { low: '', base: 0, high: '' }
  },
  plans: [
    {
      accountName: 'Lutfi 529',
      coverageGoal: 'Undergraduate through law',
      currentMonthlyContribution: { present: true, value: 0 },
      contributionEntryStatus: 'CONFIRMED',
      plannedChoice: 'CONTINUE',
      plannedChoiceEntryStatus: 'ESTIMATE',
      notes: 'Keep current baseline'
    },
    {
      accountName: 'Laith 529',
      coverageGoal: '',
      currentMonthlyContribution: '',
      contributionEntryStatus: '',
      plannedChoice: '',
      plannedChoiceEntryStatus: '',
      notes: ''
    }
  ],
  lineItems: [
    {
      accountName: 'Lutfi 529',
      recordType: 'STAGE',
      kind: 'UNDERGRAD',
      label: 'Undergraduate',
      amount: '',
      startMonth: '2028-08',
      endMonth: '2032-05',
      academicYear: '2028-29',
      yearCompleteness: 'PARTIAL',
      overlapPolicy: '',
      remainderPolicy: '',
      entryStatus: 'ESTIMATE',
      notes: ''
    },
    {
      accountName: 'Lutfi 529',
      recordType: 'COST',
      kind: 'TUITION_SEMESTER',
      label: 'Fall tuition',
      amount: 0,
      entryStatus: 'ESTIMATE',
      startMonth: '2028-08',
      endMonth: '2028-12',
      academicYear: '2028-29',
      yearCompleteness: 'PARTIAL',
      overlapPolicy: 'ADDS',
      remainderPolicy: 'CONTINUE',
      notes: ''
    }
  ]
}, firstSs);

assert.equal(saved.ok, true);
const lutfi = saved.data.plans.find((plan) => plan.accountName === 'Lutfi 529');
const laith = saved.data.plans.find((plan) => plan.accountName === 'Laith 529');
assert.equal(lutfi.currentMonthlyContribution.present, true);
assert.equal(lutfi.currentMonthlyContribution.value, 0);
assert.equal(laith.currentMonthlyContribution.present, false);
assert.equal(laith.currentMonthlyContribution.value, null);
assert.equal(saved.data.household.expectedAnnualReturnPct.low.present, true);
assert.equal(saved.data.household.expectedAnnualReturnPct.base.present, false);
assert.equal(saved.data.household.educationCostInflationPct.base.present, true);
assert.equal(saved.data.household.educationCostInflationPct.base.value, 0);
assert.equal(saved.data.lineItems.length, 2);
assert.equal(saved.data.lineItems[1].amount.present, true);
assert.equal(saved.data.lineItems[1].amount.value, 0);
assert.equal(firstLogs.length, 1);
assert.equal(firstLogs[0].payload.eventType, 'education_plan_update');
assert.equal(firstLogs[0].targetId, 'edu-test-workbook');
assert.deepEqual(snapshotDomain_(firstSs, protectedNames), beforeSave,
  'Education save must leave Investments, Bills, Cash Flow, holdings, and Retirement untouched');

assert.throws(
  () => firstCtx.saveEducationInputs({
    plans: [{ accountName: 'Lutfi College', currentMonthlyContribution: 1000 }]
  }, firstSs),
  /exact names Lutfi 529 and Laith 529/
);

const existingPlan = JSON.stringify(firstSs.getSheetByName('INPUT - Education').getDataRange().getValues());
const existingLines = JSON.stringify(firstSs.getSheetByName('INPUT - Education Line Items').getDataRange().getValues());
const existingSs = populatedWorkbook();
existingSs.sheets['INPUT - Education'] = firstSs.getSheetByName('INPUT - Education');
existingSs.sheets['INPUT - Education Line Items'] = firstSs.getSheetByName('INPUT - Education Line Items');
const existingLogs = [];
const existingCtx = createContext(existingSs, existingLogs);
existingCtx.getEducationUiData(existingSs);
assert.deepEqual(existingSs.inserted, []);
assert.equal(
  JSON.stringify(existingSs.getSheetByName('INPUT - Education').getDataRange().getValues()),
  existingPlan
);
assert.equal(
  JSON.stringify(existingSs.getSheetByName('INPUT - Education Line Items').getDataRange().getValues()),
  existingLines
);

const beforeClear = snapshotDomain_(existingSs, protectedNames);
const cleared = existingCtx.clearEducationPlan({ accountName: 'Lutfi 529' }, existingSs);
const clearedLutfi = cleared.data.plans.find((plan) => plan.accountName === 'Lutfi 529');
const clearedLaith = cleared.data.plans.find((plan) => plan.accountName === 'Laith 529');
assert.equal(clearedLutfi.currentMonthlyContribution.present, false);
assert.equal(clearedLutfi.coverageGoal, '');
assert.equal(clearedLutfi.plannedChoice, '');
assert.equal(cleared.data.lineItems.filter((item) => item.accountName === 'Lutfi 529').length, 0);
assert.equal(clearedLaith.currentMonthlyContribution.present, false);
assert.equal(existingLogs.at(-1).payload.details.cleared, true);
assert.deepEqual(snapshotDomain_(existingSs, protectedNames), beforeClear);

const missingLive = new FakeSpreadsheet([
  new FakeSheet('SYS - Assets', [
    ['Account Name', 'Type', 'Current Balance'],
    ['Samer Robinhood', 'Brokerage', 1]
  ])
]);
const missingCtx = createContext(missingLive, []);
const missingData = missingCtx.getEducationUiData(missingLive);
assert.equal(missingData.plans[0].liveBalance.found, false);
assert.equal(missingData.plans[0].liveBalance.currentBalancePresent, false);
assert.equal(missingData.plans[0].accountName, 'Lutfi 529');

const isolSs = populatedWorkbook();
const isolLogs = [];
const isolCtx = createContext(isolSs, isolLogs);
isolCtx.getEducationUiData(isolSs);
const isolated = isolCtx.saveEducationInputs({
  household: { selectedScenario: 'Base' },
  plans: [
    {
      accountName: 'Lutfi 529',
      coverageGoal: 'Lutfi only goal',
      currentMonthlyContribution: 10,
      contributionEntryStatus: 'CONFIRMED',
      plannedChoice: 'CONTINUE',
      plannedChoiceEntryStatus: 'CONFIRMED',
      notes: 'Lutfi notes'
    },
    {
      accountName: 'Laith 529',
      coverageGoal: 'Laith only goal',
      currentMonthlyContribution: 20,
      contributionEntryStatus: 'ESTIMATE',
      plannedChoice: 'PAUSE',
      plannedChoiceEntryStatus: 'ESTIMATE',
      notes: 'Laith notes'
    }
  ],
  lineItems: [
    {
      accountName: 'Lutfi 529',
      recordType: 'COST',
      kind: 'TUITION_SEMESTER',
      label: 'Lutfi tuition',
      amount: 100,
      entryStatus: 'ESTIMATE'
    },
    {
      accountName: 'Laith 529',
      recordType: 'COST',
      kind: 'LIVING_MONTHLY',
      label: 'Laith living',
      amount: 50,
      entryStatus: 'CONFIRMED'
    }
  ]
}, isolSs);
assert.equal(isolated.data.plans.find((plan) => plan.accountName === 'Lutfi 529').coverageGoal, 'Lutfi only goal');
assert.equal(isolated.data.plans.find((plan) => plan.accountName === 'Laith 529').coverageGoal, 'Laith only goal');
assert.equal(isolated.data.lineItems.find((item) => item.label === 'Lutfi tuition').accountName, 'Lutfi 529');
assert.equal(isolated.data.lineItems.find((item) => item.label === 'Laith living').accountName, 'Laith 529');
const clearedOther = isolCtx.clearEducationPlan({ accountName: 'Lutfi 529' }, isolSs);
assert.equal(clearedOther.data.plans.find((plan) => plan.accountName === 'Lutfi 529').coverageGoal, '');
assert.equal(clearedOther.data.plans.find((plan) => plan.accountName === 'Lutfi 529').currentMonthlyContribution.present, false);
assert.equal(clearedOther.data.plans.find((plan) => plan.accountName === 'Laith 529').coverageGoal, 'Laith only goal');
assert.equal(clearedOther.data.plans.find((plan) => plan.accountName === 'Laith 529').currentMonthlyContribution.value, 20);
assert.equal(clearedOther.data.plans.find((plan) => plan.accountName === 'Laith 529').notes, 'Laith notes');
assert.equal(clearedOther.data.lineItems.length, 1);
assert.equal(clearedOther.data.lineItems[0].accountName, 'Laith 529');
assert.equal(clearedOther.data.lineItems[0].label, 'Laith living');

function makeField(value) {
  return { id: '', value: value, textContent: value };
}
const fields = {
  edu_selectedScenario: makeField('Base'),
  edu_return_low: makeField(''),
  edu_return_base: makeField(''),
  edu_return_high: makeField(''),
  edu_inflation_low: makeField(''),
  edu_inflation_base: makeField(''),
  edu_inflation_high: makeField(''),
  edu_coverageGoal: makeField('Lutfi form'),
  edu_currentMonthlyContribution: makeField(''),
  edu_contributionEntryStatus: makeField(''),
  edu_plannedChoice: makeField(''),
  edu_plannedChoiceEntryStatus: makeField(''),
  edu_notes: makeField(''),
  edu_selected_title: makeField('Lutfi 529'),
  edu_live_balance: makeField('Not entered'),
  edu_live_found: makeField('')
};
const uiContext = {
  educationLoadGeneration_: 0,
  educationUiData: null,
  educationSelectedAccount_: 'Lutfi 529',
  educationLineItemDrafts_: [],
  document: {
    getElementById(id) { return fields[id] || null; },
    querySelectorAll() { return []; }
  },
  fmtCurrency(value) { return '$' + value; },
  toNumber(value) {
    const cleaned = String(value || '').replace(/\$/g, '').replace(/,/g, '').trim();
    if (!cleaned) return 0;
    const num = Number(cleaned);
    return isNaN(num) ? NaN : num;
  },
  google: { script: { run: { withSuccessHandler() { return this; }, withFailureHandler() { return this; }, getEducationUiData() {}, saveEducationInputs() {}, clearEducationPlan() {} } } },
  window: {},
  setStatus() {},
  startDashboardInitialLoadStage_() { return {}; },
  finishDashboardInitialLoadStage_() {},
  customerSafeErrorMessage_(msg) { return msg; },
  renderSurfaceState_() {}
};
vm.createContext(uiContext);
vm.runInContext(client, uiContext);
uiContext.educationUiData = {
  accountNames: ['Lutfi 529', 'Laith 529'],
  household: { selectedScenario: 'Base' },
  plans: [
    {
      accountName: 'Lutfi 529',
      coverageGoal: 'Lutfi form',
      currentMonthlyContribution: { present: false, value: null },
      contributionEntryStatus: '',
      plannedChoice: '',
      plannedChoiceEntryStatus: '',
      notes: 'keep lutfi',
      liveBalance: { found: true, currentBalancePresent: true, currentBalance: 1, type: '529' }
    },
    {
      accountName: 'Laith 529',
      coverageGoal: 'Laith form',
      currentMonthlyContribution: { present: true, value: 20 },
      contributionEntryStatus: 'ESTIMATE',
      plannedChoice: 'PAUSE',
      plannedChoiceEntryStatus: 'ESTIMATE',
      notes: 'keep laith',
      liveBalance: { found: true, currentBalancePresent: true, currentBalance: 2, type: 'Education' }
    }
  ],
  lineItems: []
};
uiContext.educationSelectedAccount_ = 'Lutfi 529';
uiContext.educationLineItemDrafts_ = [
  { clientKey: 'l1', accountName: 'Lutfi 529', label: 'Lutfi tuition', recordType: 'COST' },
  { clientKey: 'a1', accountName: 'Laith 529', label: 'Laith living', recordType: 'COST' }
];
uiContext.renderEducationLineItems_ = function() {};
uiContext.renderEducationAccountCards_ = function() {};
uiContext.fillEducationSelectedPlan_();
uiContext.selectEducationAccount('Laith College');
assert.equal(uiContext.educationSelectedAccount_, 'Lutfi 529');
assert.equal(JSON.stringify(uiContext.educationLineItemsForSelectedAccount_().map((item) => item.label)), JSON.stringify(['Lutfi tuition']));
uiContext.selectEducationAccount('Laith 529');
assert.equal(uiContext.educationSelectedAccount_, 'Laith 529');
assert.equal(uiContext.educationUiData.plans[0].coverageGoal, 'Lutfi form');
assert.equal(uiContext.educationUiData.plans[0].notes, 'keep lutfi');
assert.equal(fields.edu_coverageGoal.value, 'Laith form');
assert.equal(fields.edu_notes.value, 'keep laith');
assert.equal(fields.edu_selected_title.textContent, 'Laith 529');
assert.equal(JSON.stringify(uiContext.educationLineItemsForSelectedAccount_().map((item) => item.label)), JSON.stringify(['Laith living']));
fields.edu_coverageGoal.value = 'Edited Laith';
uiContext.selectEducationAccount('Lutfi 529');
assert.equal(uiContext.educationUiData.plans[1].coverageGoal, 'Edited Laith');
assert.equal(uiContext.educationUiData.plans[0].coverageGoal, 'Lutfi form');
assert.equal(fields.edu_coverageGoal.value, 'Lutfi form');
assert.equal(JSON.stringify(uiContext.educationLineItemsForSelectedAccount_().map((item) => item.accountName)), JSON.stringify(['Lutfi 529']));
uiContext.addEducationLineItem();
const added = uiContext.educationLineItemDrafts_[uiContext.educationLineItemDrafts_.length - 1];
assert.equal(added.accountName, 'Lutfi 529');
assert.equal(uiContext.educationLineItemDrafts_.find((item) => item.clientKey === 'a1').accountName, 'Laith 529');
assert.equal(uiContext.educationLineItemDrafts_.find((item) => item.clientKey === 'a1').label, 'Laith living');

console.log('checkPlanningEducationRegressions: ok');
