import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const files = Object.fromEntries(await Promise.all([
  'Dashboard_Body.html',
  'Dashboard_Help.html',
  'Dashboard_Script_AssetsBankInvestments.html',
  'Dashboard_Script_Onboarding.html',
  'Dashboard_Script_PlanningDebts.html',
  'Dashboard_Script_PropertiesHouseExpenses.html',
  'Dashboard_Script_Render.html',
  'onboarding.js'
].map(async (name) => [name, await readFile(new URL(`../${name}`, import.meta.url), 'utf8')])));

const render = files['Dashboard_Script_Render.html'];
for (const [page, tab] of Object.entries({
  assets: 'houses',
  cashflow: 'payments',
  properties: 'houseExpenses',
  planning: 'nextActions'
})) {
  assert.match(render, new RegExp(`${page}:\\s*['\"]${tab}['\"]`), `${page} must have a default panel`);
}
assert.match(
  render,
  /defaultTab\s*&&\s*!page\.querySelector\(['"]\.panel\.active['"]\)/,
  'Default navigation must preserve an explicitly active panel'
);
assert.match(render, /Financial plan refreshed/, 'Planner refresh must leave a success message');
assert.match(render, /planner_refresh_btn/, 'Planner refresh must guard against duplicate clicks');

const body = files['Dashboard_Body.html'];
for (const id of [
  'bank_update_save_btn',
  'bank_update_stop_btn',
  'inv_update_save_btn',
  'inv_update_stop_btn',
  'debt_update_save_btn',
  'debt_update_stop_btn',
  'hx_add_btn'
]) {
  assert.match(body, new RegExp(`id=['\"]${id}['\"][^>]*\\sdisabled`), `${id} must start disabled`);
}
assert.doesNotMatch(
  body,
  /A Year block for the current calendar year must already exist/,
  'First-run account copy must not require manual year-block setup'
);

const assetScript = files['Dashboard_Script_AssetsBankInvestments.html'];
assert.match(assetScript, /function updateBankUpdateAvailability_\(/);
assert.match(assetScript, /function updateInvestmentUpdateAvailability_\(/);
assert.match(files['Dashboard_Script_PlanningDebts.html'], /function updateDebtUpdateAvailability_\(/);
assert.match(files['Dashboard_Script_PropertiesHouseExpenses.html'], /function updateHouseExpenseAvailability_\(/);

const onboardingClient = files['Dashboard_Script_Onboarding.html'];
assert.doesNotMatch(onboardingClient, /step\.sheetName/, 'Setup cards must not render internal sheet names');
assert.doesNotMatch(onboardingClient, /Error reading setup status:/, 'Setup must not render raw server errors');

const onboardingServer = files['onboarding.js'];
for (const leakedCopy of [
  'Bank Accounts sheet not found.',
  'Debts sheet not found.',
  'Bills sheet not found.',
  "'No income detected on ' +"
]) {
  assert.ok(!onboardingServer.includes(leakedCopy), `Setup copy must not include: ${leakedCopy}`);
}

const help = files['Dashboard_Help.html'];
assert.doesNotMatch(help, /loadOnboardingSection\(\)|Dashboard_Script_Onboarding\.html|status === 'missing'/);
assert.doesNotMatch(help, /The workbook must already have that Year block/);
assert.match(help, /Advanced sheet reference/);

console.log('Dashboard UX regression checks passed.');
