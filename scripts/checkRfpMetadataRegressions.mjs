import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../investments.js', import.meta.url), 'utf8');
const body = await readFile(new URL('../Dashboard_Body.html', import.meta.url), 'utf8');
const onboarding = await readFile(new URL('../Dashboard_Script_Onboarding.html', import.meta.url), 'utf8');
const styles = await readFile(new URL('../Dashboard_Styles.html', import.meta.url), 'utf8');

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

console.log('RFP investment metadata regression checks passed.');
