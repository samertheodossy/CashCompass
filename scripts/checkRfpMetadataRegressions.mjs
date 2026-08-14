import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../investments.js', import.meta.url), 'utf8');
const activitySource = await readFile(new URL('../investment_activity.js', import.meta.url), 'utf8');
const body = await readFile(new URL('../Dashboard_Body.html', import.meta.url), 'utf8');
const onboarding = await readFile(new URL('../Dashboard_Script_Onboarding.html', import.meta.url), 'utf8');
const investmentClient = await readFile(new URL('../Dashboard_Script_AssetsBankInvestments.html', import.meta.url), 'utf8');
const styles = await readFile(new URL('../Dashboard_Styles.html', import.meta.url), 'utf8');
const validatorRules = await readFile(new URL('../validator_rules.js', import.meta.url), 'utf8');

function functionSource(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} must exist`);
  const brace = source.indexOf('{', start);
  let depth = 0;
  for (let i = brace; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    if (source[i] === '}' && --depth === 0) return source.slice(start, i + 1);
  }
  assert.fail(`${name} must have a complete body`);
}

function activityFunctionSource(name) {
  const start = activitySource.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} must exist`);
  const brace = activitySource.indexOf('{', start);
  let depth = 0;
  for (let i = brace; i < activitySource.length; i += 1) {
    if (activitySource[i] === '{') depth += 1;
    if (activitySource[i] === '}' && --depth === 0) return activitySource.slice(start, i + 1);
  }
  assert.fail(`${name} must have a complete body`);
}

const context = vm.createContext({ String, Error, Array });
vm.runInContext(`
  var INVESTMENT_ID_HEADER_ = 'Investment Id';
  var INVESTMENT_PLANNING_PURPOSE_HEADER_ = 'Planning Purpose';
  var INCOME_PRODUCING_PURPOSE_ = 'INCOME_PRODUCING';
  ${functionSource('getAssetsHeaderMap_')}
  ${functionSource('isAssetRowInactive_')}
  ${functionSource('getIncomeProducingAccountConfigurations_')}
`, context);

let reads = 0;
const sheet = {
  getDataRange: () => ({ getDisplayValues: () => {
    reads += 1;
    return [
      ['Account Name', 'Type', 'Current Balance', 'Active', 'Investment Id', 'Planning Purpose'],
      ['Samer Robinhood', 'Brokerage', '$16,193.06', 'Yes', 'INV-samer', 'INCOME_PRODUCING'],
      ['401K Account', 'Retirement', '$1,887,450.18', 'Yes', 'INV-401k', 'INCOME_PRODUCING'],
      ['Former Income Account', 'Brokerage', '$0.00', 'No', 'INV-old', 'INCOME_PRODUCING'],
      ['Lutfi Robinhood', 'Brokerage', '$10,845.46', 'Yes', '', '']
    ];
  } })
};
context.getSheetNames_ = () => ({ ASSETS: 'SYS - Assets' });
context.getUserSpreadsheet_ = () => ({ getSheetByName: () => sheet });
const configured = JSON.parse(JSON.stringify(context.getIncomeProducingAccountConfigurations_()));
assert.equal(reads, 1, 'Configuration reader must use one SYS - Assets read');
assert.equal(configured.configuredCount, 3, 'All explicit designations must be returned');
assert.equal(configured.eligibleCount, 2, 'Only active designated accounts are eligible');
assert.deepEqual(configured.eligibleAccounts.map(row => row.accountName),
  ['Samer Robinhood', '401K Account'], 'Multiple active account types must coexist');

const noMetadataSheet = { getDataRange: () => ({ getDisplayValues: () => [
  ['Account Name', 'Type', 'Current Balance', 'Active'],
  ['Samer Robinhood', 'Brokerage', '$16,193.06', 'Yes'],
  ['401K Account', 'Retirement', '$1,887,450.18', 'Yes']
] }) };
context.getUserSpreadsheet_ = () => ({ getSheetByName: () => noMetadataSheet });
assert.deepEqual(JSON.parse(JSON.stringify(context.getIncomeProducingAccountConfigurations_())),
  { configured: false, accounts: [], eligibleAccounts: [] },
  'Names and account types without metadata must never be inferred');

assert.match(source,
  /function setIncomeProducingAccountDesignationsFromDashboard\(payload, optionalSs\)[\s\S]*?LockService\.getUserLock\(\)[\s\S]*?beforeValues[\s\S]*?INCOME_PRODUCING_PURPOSE_[\s\S]*?investment_planning_purpose_update[\s\S]*?rolled back/,
  'Multi-account Save must be locked, stale-guarded, audited, and rollback-safe');
assert.match(await readFile(new URL('../test_harness_scenarios_rfp.js', import.meta.url), 'utf8'),
  /expectedAssertionCount:\s*19[\s\S]*?Investment Id metadata column is readable[\s\S]*?Planning Purpose metadata column is readable/,
  'Disposable runtime validation must prove both metadata columns are readable');
assert.match(functionSource('ensureInvestmentPlanningMetadataColumns_'),
  /if \(!missing\.length\)[\s\S]*?styleInvestmentPlanningMetadataHeaders_[\s\S]*?setValues\(\[missing\]\)[\s\S]*?styleInvestmentPlanningMetadataHeaders_/,
  'Both existing and newly created metadata headings must be repaired on explicit Save');
assert.match(functionSource('styleInvestmentPlanningMetadataHeaders_'),
  /copyTo\([\s\S]*?PASTE_FORMAT[\s\S]*?CANON_HEADER_YELLOW_[\s\S]*?setHorizontalAlignment\('center'\)[\s\S]*?setBorder[\s\S]*?BorderStyle\.SOLID_MEDIUM/,
  'Metadata headings must match the yellow centered SYS - Assets header and medium separator');
assert.doesNotMatch(functionSource('setIncomeProducingAccountDesignationsFromDashboard'),
  /displaced|another active investment is already selected|clear that selection/i,
  'Multi-account Save must not clear or reject another designation');
assert.match(source,
  /function saveTrackedInvestmentAccountFromDashboard\(payload, optionalSs\)[\s\S]*?assetsRowSnapshot[\s\S]*?setValue\(newName\)/,
  'Rename must update the existing SYS row without recreating stable metadata');
assert.doesNotMatch(functionSource('setInvestmentTrackingStateFromDashboard_'),
  /IncomeProducing.*Unique|FamilyIncome.*Unique/,
  'Reactivate must not impose a single Income-Producing account constraint');
assert.doesNotMatch(functionSource('ensureInputInvestmentsSheet_'),
  /Investment Id|Planning Purpose/,
  'INPUT - Investments must not receive RFP metadata columns');
assert.doesNotMatch(source, /RFP_FAMILY_INVESTING_ENABLED|isRfpFamilyInvestingEnabled_/,
  'Workbook designation—not a global Script Property—must control this feature');
assert.doesNotMatch(source, /FAMILY_INCOME/,
  'Retired single-account purpose code must not remain in runtime source');
assert.match(body,
  /data-step="familyInvesting"[\s\S]*?Income-Producing Accounts[\s\S]*?Optional/,
  'Setup must expose Income-Producing Accounts as an optional choice');
assert.match(body,
  /id="onboarding_income_producing_accounts"[\s\S]*?id="onboarding_family_investing_save_btn"[\s\S]*?Save changes/,
  'Setup must expose one simple multi-select Save surface');
assert.match(onboarding,
  /function onboardingSaveIncomeProducingAccounts_[\s\S]*?changes\.push[\s\S]*?planningPurpose:[\s\S]*?'INCOME_PRODUCING'[\s\S]*?setIncomeProducingAccountDesignationsFromDashboard/,
  'Setup Save must submit every changed designation as one guarded batch');
assert.match(onboarding,
  /save\.textContent = 'Saving…'[\s\S]*?elapsedSeconds[\s\S]*?save\.textContent = 'Saved'[\s\S]*?Done in/,
  'Setup Save must show nearby progress, completion, and measured elapsed time');
assert.doesNotMatch(functionSource('setIncomeProducingAccountDesignationsFromDashboard'),
  /onboardingLoadFamilyInvestingDetail_/,
  'Server writer must not require a second read to confirm a completed Save');
assert.match(body,
  /onboarding_family_investing_details[\s\S]*?onboarding_family_investing_status[\s\S]*?onboarding-actions/,
  'Save status must sit beside the action area instead of above a long account list');
assert.match(onboarding,
  /label\.className = 'onboarding-income-producing-row'[\s\S]*?input\.className = 'onboarding-income-producing-checkbox'[\s\S]*?onboarding-income-producing-label/,
  'Every checkbox and its account text must render in one dedicated aligned row');
assert.match(styles,
  /\.onboarding-profile-field \.onboarding-income-producing-row\s*\{[\s\S]*?display:\s*flex[\s\S]*?align-items:\s*center[\s\S]*?justify-content:\s*flex-start[\s\S]*?gap:\s*10px/,
  'Income-Producing rows must align the checkbox immediately beside the label');
assert.match(styles,
  /\.onboarding-profile-field \.onboarding-income-producing-checkbox\s*\{[\s\S]*?margin:\s*0[\s\S]*?flex:\s*0 0 18px/,
  'Checkbox dimensions must not inherit full-width profile input styling');
assert.match(functionSource('setIncomeProducingAccountDesignationsFromDashboard'),
  /fitContentColumnsToContents_\([\s\S]*?investmentIdCol[\s\S]*?planningPurposeCol[\s\S]*?metadata fit/,
  'Designation Save must fit both owned SYS - Assets metadata columns');

const activityContext = vm.createContext({ String, Number, Object, Array, Math, isFinite });
vm.runInContext(`
  function round2_(value) { return Math.round(Number(value) * 100) / 100; }
  ${activityFunctionSource('classifyInvestmentImportRow_')}
  ${activityFunctionSource('isInvestmentImportNonActivityFooter_')}
  ${activityFunctionSource('summarizeInvestmentImportPreview_')}
`, activityContext);
const universe = { QQQ: true, JEPQ: true };
assert.deepEqual(JSON.parse(JSON.stringify(activityContext.classifyInvestmentImportRow_({
  activityDate: '2026-05-01', ticker: 'SPY', transCode: 'BTO',
  description: 'SPY Call', amount: -100, recurring: false
}, '2026-04-27', universe))),
{ accepted: false, reason: 'OPTIONS_ACTIVITY' },
'Options activity must fail closed');
assert.deepEqual(JSON.parse(JSON.stringify(activityContext.classifyInvestmentImportRow_({
  activityDate: '2026-05-01', ticker: 'HL', transCode: 'Buy',
  description: 'Hecla Mining', amount: -10, recurring: false
}, '2026-04-27', universe))),
{ accepted: false, reason: 'OUTSIDE_PORTFOLIO' },
'Non-recurring unrelated holdings must be excluded from the inferred portfolio');
assert.deepEqual(JSON.parse(JSON.stringify(activityContext.classifyInvestmentImportRow_({
  activityDate: '2026-05-04', ticker: 'QQQ', transCode: 'Buy',
  description: 'Invesco QQQ Recurring', amount: -350, recurring: true
}, '2026-04-27', universe))),
{ accepted: true, activityType: 'RECURRING_BUY' },
'Recurring portfolio buys must be normalized');
assert.deepEqual(JSON.parse(JSON.stringify(activityContext.classifyInvestmentImportRow_({
  activityDate: '2026-05-04', ticker: '', transCode: 'ACH',
  description: 'ACH Deposit', amount: 5, recurring: false
}, '2026-04-27', universe, { '2026-05-04|5': true }))),
{ accepted: false, reason: 'CASH_OR_ADMIN' },
'ACH deposits that only offset a same-day brokerage fee must not inflate contributions');
const robinhoodIndexes = {
  'Activity Date': 0, Instrument: 3, Description: 4, 'Trans Code': 5,
  Quantity: 6, Price: 7, Amount: 8
};
assert.equal(activityContext.isInvestmentImportNonActivityFooter_(
  ['', '', '', '', '', '', '', '', '', 'Robinhood informational disclaimer'], robinhoodIndexes), true,
'A disclaimer outside all transaction-bearing columns must be treated as a non-activity footer');
assert.equal(activityContext.isInvestmentImportNonActivityFooter_(
  ['', '', '', 'QQQ', '', 'Buy', '1', '$700.00', '($700.00)'], robinhoodIndexes), false,
'A transaction-bearing row with no activity date must still fail closed');
const previewSummary = JSON.parse(JSON.stringify(activityContext.summarizeInvestmentImportPreview_([
  { activityDate: '2026-04-27', activityType: 'OPENING_CAPITAL', amount: 3000 },
  { activityDate: '2026-04-27', activityType: 'BUY', amount: -3021 },
  { activityDate: '2026-05-04', activityType: 'CONTRIBUTION', amount: 500 },
  { activityDate: '2026-05-05', activityType: 'DIVIDEND', amount: 10 }
], [{ reason: 'OPTIONS_ACTIVITY' }], universe)));
assert.equal(previewSummary.purchases, 3021, 'Preview must total purchases as positive deployed cash');
assert.equal(previewSummary.contributions, 500, 'Preview must total contributions independently');
assert.equal(previewSummary.openingCapital, 3000,
  'Preview must preserve evidenced opening capital when funding settled before the first included trade');
assert.equal(previewSummary.totalCapitalAdded, 3500,
  'Preview must combine opening capital and later contributions without double counting');
assert.equal(previewSummary.incidentalProceedsInvested, 21,
  'Preview must separate incidental proceeds invested from family capital');
assert.equal(previewSummary.dividends, 10, 'Preview must total cash dividends independently');
assert.equal(previewSummary.excludedByReason.OPTIONS_ACTIVITY, 1,
  'Preview must explain exclusions by reason');
assert.match(activitySource,
  /function previewInvestmentActivityImportFromDashboard[\s\S]*?Utilities\.parseCsv[\s\S]*?classifyInvestmentImportRow_[\s\S]*?digest/,
  'Preview must parse and classify on the server before returning a digest');
assert.match(activitySource,
  /activityDateText[\s\S]*?isInvestmentImportNonActivityFooter_[\s\S]*?NON_ACTIVITY_FOOTER[\s\S]*?Activity date is required in CSV row/,
  'Preview must exclude a transaction-empty Robinhood footer while rejecting undated transaction rows');
assert.match(activitySource,
  /function importInvestmentActivityFromDashboard[\s\S]*?expectedDigest[\s\S]*?readInvestmentActivityImportKeys_[\s\S]*?rebuildInvestmentHoldingsForAccount_[\s\S]*?deleteRows/,
  'Save must re-preview, verify the digest, dedupe, rebuild holdings, and roll back appended rows');
assert.match(activitySource,
  /function ensureInvestmentSystemSheet_[\s\S]*?if \(existing\) return existing[\s\S]*?insertSheet/,
  'Investment system sheets must be lazy first-create structures');
assert.match(validatorRules,
  /INVESTMENT_ACTIVITY_HEADERS_[\s\S]*?INVESTMENT_HOLDINGS_HEADERS_[\s\S]*?INVESTMENT_ACTIVITY_CANONICAL_WIDTHS_[\s\S]*?INVESTMENT_HOLDINGS_CANONICAL_WIDTHS_[\s\S]*?SYS - Investment Activity[\s\S]*?SYS - Investment Holdings/,
  'Validator canonical model must cover both lazy investment-import system sheets');
assert.doesNotMatch(activitySource, /setValue\([^\n]*INPUT - Investments|updateInvestmentValueByDate/,
  'Activity import must not write balances into INPUT Investments');
assert.match(body,
  /Import portfolio activity[\s\S]*?inv_activity_account[\s\S]*?inv_activity_file[\s\S]*?Preview import[\s\S]*?Save imported activity/,
  'Manage Investments must expose one preview-first import surface');
assert.match(investmentClient,
  /function previewInvestmentActivityImport_[\s\S]*?previewInvestmentActivityImportFromDashboard[\s\S]*?function saveInvestmentActivityImport_[\s\S]*?expectedDigest/,
  'Client must preview before enabling the guarded Save RPC');
assert.match(await readFile(new URL('../test_harness_scenarios_rfp.js', import.meta.url), 'utf8'),
  /REGRESSION-RFP-INVESTMENT-ACTIVITY[\s\S]*?expectedAssertionCount:\s*21[\s\S]*?Robinhood disclaimer footer excluded[\s\S]*?Second import appends no rows[\s\S]*?INPUT Investments schema unchanged/,
  'Disposable validation must prove footer handling, exclusions, dedupe, holdings, and schema isolation');

console.log('RFP investment metadata regression checks passed.');
