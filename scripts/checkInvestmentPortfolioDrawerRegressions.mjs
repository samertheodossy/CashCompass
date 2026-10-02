import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const read = (name) => fs.readFileSync(new URL(name, root), 'utf8');

function extractFunction(source, name) {
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

const dashboardBody = read('Dashboard_Body.html');
const dashboardInvestments = read('Dashboard_Script_AssetsBankInvestments.html');
const dashboardStyles = read('Dashboard_Styles.html');
const drawerM1Source = read('Dashboard_Script_InvestmentPortfolioDrawerM1.html');
const drawerSchwabSource = read('Dashboard_Script_InvestmentPortfolioDrawerSchwab.html');
const drawerStashSource = read('Dashboard_Script_InvestmentPortfolioDrawerStash.html');
const drawer401kSource = read('Dashboard_Script_InvestmentPortfolioDrawer401k.html');
const drawerEtradeFutureSource = read('Dashboard_Script_InvestmentPortfolioDrawerEtradeFuture.html');
const drawerEtradeSamerSource = read('Dashboard_Script_InvestmentPortfolioDrawerEtradeSamer.html');
const etradeClientSource = read('investment_etrade_client_statement_pdf.js');
const webappSource = read('webapp.js');
const drawerSource = read('investment_portfolio_drawer.js');
const activitySource = read('investment_activity.js');
const configSource = read('config.js');
const investmentsSource = read('investments.js');
const identitySource = read('financial_identity.js');
const previewSource = read('bounded_holdings_preview.js');
const applySource = read('bounded_holdings_preview_apply.js');
const groupedSource = read('bounded_holdings_preview_groups.js');

const context = {
  String, Number, Object, Array, Math, isFinite, Error, JSON, console
};
vm.createContext(context);
vm.runInContext(`
  function round2_(value) { return Math.round(Number(value) * 100) / 100; }
  function boundedHoldingsPreviewMatchGroupProvider_(accountName, source) {
    var name = String(accountName || '').trim();
    if (/^M1 Account\\s*-\\s*Gmail$/i.test(name)) {
      return { providerKey: 'M1', source: 'M1_STATEMENT_PDF', maxChildAccounts: 5 };
    }
    if (/^M1 Account\\s*-\\s*yahoo$/i.test(name)) {
      return { providerKey: 'M1', source: 'M1_STATEMENT_PDF', maxChildAccounts: 5 };
    }
    return null;
  }
  ${extractFunction(etradeClientSource, 'investmentEtradePotentialUnvestedStockPlanMapping_')}
  ${extractFunction(etradeClientSource, 'investmentEtradeMatchesPotentialUnvestedStockPlanMapping_')}
  ${extractFunction(etradeClientSource, 'investmentEtradeCiscoBrokerageAccountValueMapping_')}
  ${extractFunction(etradeClientSource, 'investmentEtradeCiscoStatementImportProfile_')}
  ${extractFunction(etradeClientSource, 'investmentEtradeMatchesCiscoStatementImportProfile_')}
  ${extractFunction(etradeClientSource, 'investmentEtradeSamerBrokerageAccountValueMapping_')}
  ${extractFunction(etradeClientSource, 'investmentEtradeMatchesSamerBrokerageAccountValueMapping_')}
  ${extractFunction(drawerSource, 'investmentPortfolioDrawerProviderLabel_')}
  ${extractFunction(drawerSource, 'investmentPortfolioDrawerMatchGroupProvider_')}
  ${extractFunction(drawerSource, 'investmentPortfolioDrawerIs401kRetirementAccount_')}
  ${extractFunction(drawerSource, 'investmentPortfolioDrawerInferProvider_')}
  ${extractFunction(drawerSource, 'investmentPortfolioDrawerMapAccountRow_')}
  ${extractFunction(drawerSource, 'investmentPortfolioDrawerRobinhoodImportEligible_')}
  ${extractFunction(drawerSource, 'investmentPortfolioDrawerNormalizeImportSource_')}
  ${extractFunction(drawerSource, 'investmentPortfolioDrawerIsCustomerProductionSource_')}
  ${extractFunction(identitySource, 'financialIdentityInferRegistration_')}
  ${extractFunction(drawerSource, 'investmentPortfolioDrawerIs529Account_')}
  ${extractFunction(drawerSource, 'investmentPortfolioDrawerSupportedImportFormats_')}
  ${extractFunction(drawerSource, 'investmentPortfolioDrawerCustomerDrawerFormats_')}
  ${extractFunction(drawerSource, 'investmentPortfolioDrawerCustomerImportEligibility_')}
  ${extractFunction(drawerSource, 'investmentPortfolioDrawerOmitFromActivityPicker_')}
  ${extractFunction(drawerSource, 'investmentPortfolioDrawerDescribePickerAccount_')}
  ${extractFunction(drawerSource, 'investmentPortfolioDrawerStatementImportProfiles_')}
  ${extractFunction(drawerSource, 'investmentPortfolioDrawerKnownProviderLabel_')}
  ${extractFunction(drawerSource, 'investmentPortfolioDrawerBuildPickerOptionLabel_')}
  ${extractFunction(drawerSource, 'investmentPortfolioDrawerEvaluateCustomerImportRequest_')}
  function boundedHoldingsPreviewApplyNormalizeAsOfDate_(value) {
    var raw = String(value || '').trim();
    if (!raw) return '';
    if (/^\\d{4}-\\d{2}-\\d{2}/.test(raw)) return raw.slice(0, 10);
    return raw.slice(0, 10);
  }
  ${extractFunction(drawerSource, 'investmentPortfolioDrawerFilterUnifiedRowsForAccount_')}
  ${extractFunction(drawerSource, 'investmentPortfolioDrawerLatestAsOfDate_')}
  ${extractFunction(drawerSource, 'investmentPortfolioDrawerRowsAtAsOf_')}
  ${extractFunction(drawerSource, 'investmentPortfolioDrawerSummarizeUnifiedRows_')}
  ${extractFunction(drawerSource, 'investmentPortfolioDrawerSerializeUnifiedHoldingRow_')}
  ${extractFunction(drawerSource, 'investmentPortfolioDrawerNormalizeAsOfDate_')}
  ${extractFunction(drawerSource, 'investmentPortfolioDrawerIsAppliedUnifiedRow_')}
  ${extractFunction(drawerSource, 'investmentPortfolioDrawerPartitionId_')}
  ${extractFunction(drawerSource, 'investmentPortfolioDrawerDistinctAsOfDatesForPartition_')}
  ${extractFunction(drawerSource, 'investmentPortfolioDrawerRowsForPartitionAtAsOf_')}
  ${extractFunction(drawerSource, 'investmentPortfolioDrawerResolvePartitionCashFromRows_')}
  ${extractFunction(drawerSource, 'investmentPortfolioDrawerSummarizePartitionSnapshot_')}
  ${extractFunction(drawerSource, 'investmentPortfolioDrawerFindPriorPartitionAsOf_')}
  ${extractFunction(drawerSource, 'investmentPortfolioDrawerComputeNumericDelta_')}
  ${extractFunction(drawerSource, 'investmentPortfolioDrawerStatementDeltaDirection_')}
  ${extractFunction(drawerSource, 'investmentPortfolioDrawerBuildStatementDeltaEntry_')}
  ${extractFunction(drawerSource, 'investmentPortfolioDrawerBuild401kBalanceComparison_')}
  ${extractFunction(drawerSource, 'investmentPortfolioDrawerBuildPartitionStatementDelta_')}
  ${extractFunction(drawerSource, 'investmentPortfolioDrawerBuildM1GroupedView_')}
`, context, { filename: 'investment_portfolio_drawer_partial.js' });

const fixtureAccounts = [
  {
    sysAssetsRow: 10,
    accountName: '401K Account',
    type: 'Retirement',
    investmentId: 'inv-401k',
    planningPurpose: '',
    inactive: false
  },
  {
    sysAssetsRow: 11,
    accountName: 'Charles Schwab - Personal',
    type: 'Brokerage',
    investmentId: 'inv-schwab',
    planningPurpose: '',
    inactive: false
  },
  {
    sysAssetsRow: 12,
    accountName: 'Etrade Cisco - Future',
    type: 'Brokerage',
    investmentId: 'inv-etrade-future',
    planningPurpose: '',
    inactive: false
  },
  {
    sysAssetsRow: 13,
    accountName: 'Etrade Cisco - RSU/ESPP',
    type: 'Brokerage',
    investmentId: 'inv-etrade-espp',
    planningPurpose: '',
    inactive: false
  },
  {
    sysAssetsRow: 14,
    accountName: 'Samer Robinhood',
    type: 'Brokerage',
    investmentId: 'inv-robinhood',
    planningPurpose: 'INCOME_PRODUCING',
    inactive: false
  },
  {
    sysAssetsRow: 15,
    accountName: 'M1 Account - Gmail',
    type: 'Brokerage',
    investmentId: 'inv-m1-gmail',
    planningPurpose: '',
    inactive: false
  },
  {
    sysAssetsRow: 16,
    accountName: 'M1 Account - yahoo',
    type: 'Brokerage',
    investmentId: 'inv-m1-yahoo',
    planningPurpose: '',
    inactive: false
  },
  {
    sysAssetsRow: 17,
    accountName: 'Stash Account',
    type: 'Brokerage',
    investmentId: 'inv-stash',
    planningPurpose: '',
    inactive: false
  },
  {
    sysAssetsRow: 18,
    accountName: 'Lutfi Robinhood',
    type: 'Brokerage',
    investmentId: 'inv-lutfi-robinhood',
    planningPurpose: '',
    inactive: false
  },
  {
    sysAssetsRow: 19,
    accountName: 'Laith 529',
    type: 'Education',
    investmentId: 'inv-laith-529',
    planningPurpose: '',
    inactive: false
  },
  {
    sysAssetsRow: 20,
    accountName: 'Lutfi 529',
    type: '529',
    investmentId: 'inv-lutfi-529',
    planningPurpose: '',
    inactive: false
  },
  {
    sysAssetsRow: 21,
    accountName: 'Samer Etrade Account',
    type: 'Brokerage',
    investmentId: 'inv-samer-etrade',
    planningPurpose: '',
    inactive: false
  },
  {
    sysAssetsRow: 22,
    accountName: 'Lutfi Etrade Account',
    type: 'Brokerage',
    investmentId: 'inv-lutfi-etrade',
    planningPurpose: '',
    inactive: false
  },
  {
    sysAssetsRow: 23,
    accountName: 'Laith Etrade Account',
    type: 'Brokerage',
    investmentId: 'inv-laith-etrade',
    planningPurpose: '',
    inactive: false
  },
  {
    sysAssetsRow: 99,
    accountName: 'Stopped Legacy Brokerage',
    type: 'Brokerage',
    investmentId: 'inv-stopped',
    planningPurpose: 'INCOME_PRODUCING',
    inactive: true
  }
];

function simulateDrawerAccountList(managementAccounts) {
  return (managementAccounts || []).filter(function(row) {
    return row && !row.inactive && String(row.accountName || '').trim();
  }).map(function(row) {
    var described = context.investmentPortfolioDrawerDescribePickerAccount_(row);
    return {
      accountName: described.accountName,
      pickerValue: described.pickerValue,
      investmentId: described.investmentId,
      planningPurpose: described.planningPurpose,
      statementProvider: described.statementProvider,
      providerLabel: described.providerLabel,
      customerImportEnabled: described.customerImportEnabled,
      customerImportDisabledReason: described.customerImportDisabledReason,
      customerImportPickerNote: described.customerImportPickerNote,
      customerImportSource: described.customerImportSource,
      omitFromActivityPicker: described.omitFromActivityPicker === true,
      optionLabel: context.investmentPortfolioDrawerBuildPickerOptionLabel_(described),
      optionDisabled: described.customerImportEnabled !== true
    };
  });
}

function simulateActivityPicker(managementAccounts) {
  var accounts = simulateDrawerAccountList(managementAccounts).filter(function(row) {
    return row.omitFromActivityPicker !== true;
  });
  var profiles = (context.investmentPortfolioDrawerStatementImportProfiles_() || []).map(function(row) {
    return {
      accountName: '',
      pickerValue: row.pickerValue,
      pickerLabel: row.pickerLabel,
      customerImportEnabled: row.customerImportEnabled === true,
      customerImportSource: row.customerImportSource,
      omitFromActivityPicker: false,
      optionLabel: row.pickerLabel,
      optionDisabled: row.customerImportEnabled !== true
    };
  });
  return accounts.concat(profiles);
}

function simulateImportEligibility(managementAccounts) {
  var eligible = Object.create(null);
  (managementAccounts || []).forEach(function(row) {
    if (!row || row.planningPurpose !== 'INCOME_PRODUCING' || !row.investmentId) return;
    eligible[String(row.investmentId).trim()] = true;
  });
  return eligible;
}

// --- Dashboard source wiring ---
assert.match(dashboardInvestments, /function populateInvestmentPortfolioDrawerAccounts_/);
assert.match(dashboardInvestments, /function rebuildInvestmentActivityImportEligibility_/);
assert.match(dashboardInvestments, /populateInvestmentPortfolioDrawerAccounts_\(data\)/);
assert.match(dashboardInvestments, /getInvestmentPortfolioDrawerFromDashboard/);
assert.match(dashboardInvestments, /renderInvestmentPortfolioDrawerView_/);
assert.doesNotMatch(
  dashboardInvestments,
  /populateInvestmentPortfolioDrawerAccounts_[\s\S]{0,1200}planningPurpose !== 'INCOME_PRODUCING'/
);
assert.match(
  dashboardInvestments,
  /rebuildInvestmentActivityImportEligibility_[\s\S]*planningPurpose !== 'INCOME_PRODUCING'/
);
assert.match(investmentsSource, /function getInvestmentUiData\(\)/);
assert.match(investmentsSource, /managementAccounts:/);
assert.match(investmentsSource, /portfolioActivityProfiles:/);
assert.match(investmentsSource, /investmentPortfolioDrawerStatementImportProfiles_/);
assert.match(investmentsSource, /investmentPortfolioDrawerDescribePickerAccount_/);
assert.match(activitySource, /function resolveEligibleInvestmentImportAccount_/);
assert.match(activitySource, /investmentPortfolioDrawerGuardCustomerProductionImport_/);
assert.match(previewSource, /investmentPortfolioDrawerGuardCustomerProductionImport_/);
assert.match(applySource, /investmentPortfolioDrawerGuardCustomerProductionImport_/);
assert.match(groupedSource, /investmentPortfolioDrawerGuardCustomerProductionImport_/);
assert.match(drawerSource, /function investmentPortfolioDrawerCustomerImportEligibility_/);
assert.match(drawerSource, /function investmentPortfolioDrawerEvaluateCustomerImportRequest_/);
assert.match(drawerSource, /function getInvestmentPortfolioDrawerFromDashboard/);
assert.match(
  drawerSource,
  /getInvestmentPortfolioDrawerFromDashboard[\s\S]*investmentPortfolioDrawerEvaluateCustomerImportRequest_/
);
assert.match(
  drawerSource,
  /previewFidelity401kStatementFromDashboard[\s\S]*investmentPortfolioDrawerGuardCustomerProductionImport_/
);
assert.match(dashboardInvestments, /option\.disabled = true/);
assert.match(dashboardInvestments, /is-import-unavailable/);
assert.match(dashboardInvestments, /customerImportEnabled === false/);
assert.match(dashboardInvestments, /option && option\.disabled/);
assert.match(
  dashboardInvestments,
  /mode === 'import' && !data\.robinhoodCsvImportAvailable/
);
assert.match(dashboardStyles, /#inv_activity_account option:disabled/);
assert.match(dashboardStyles, /#9aa3ad/);

// --- Active account list includes all active accounts, excludes inactive ---
const drawerList = simulateDrawerAccountList(fixtureAccounts);
assert.equal(drawerList.length, 14, 'drawer must list every active investment account');
assert.deepEqual(
  drawerList.map((row) => row.accountName).sort(),
  [
    '401K Account',
    'Charles Schwab - Personal',
    'Etrade Cisco - Future',
    'Etrade Cisco - RSU/ESPP',
    'Laith 529',
    'Laith Etrade Account',
    'Lutfi 529',
    'Lutfi Etrade Account',
    'Lutfi Robinhood',
    'M1 Account - Gmail',
    'M1 Account - yahoo',
    'Samer Etrade Account',
    'Samer Robinhood',
    'Stash Account'
  ].sort()
);
assert.equal(
  drawerList.some((row) => row.accountName === 'Stopped Legacy Brokerage'),
  false,
  'inactive account must not appear in drawer list'
);

// --- Income-producing filter is not applied to drawer list ---
assert.equal(
  drawerList.filter((row) => row.planningPurpose === 'INCOME_PRODUCING').length,
  1
);
assert.equal(
  drawerList.filter((row) => row.planningPurpose !== 'INCOME_PRODUCING').length,
  13,
  'non-income-producing active accounts must still appear'
);

// --- Accounts without holdings / non-income-producing still appear ---
assert.ok(drawerList.some((row) => row.accountName === 'Charles Schwab - Personal'));
assert.ok(drawerList.some((row) => row.accountName === 'Etrade Cisco - Future'));

// --- Robinhood CSV import eligibility remains income-producing only ---
const activeManagementAccounts = fixtureAccounts.filter((row) => row && !row.inactive);
const importEligible = simulateImportEligibility(activeManagementAccounts);
assert.deepEqual(Object.keys(importEligible).sort(), ['inv-robinhood']);
const robinhoodAccount = context.investmentPortfolioDrawerMapAccountRow_({
  sysAssetsRow: 14,
  accountName: 'Samer Robinhood',
  investmentId: 'inv-robinhood',
  planningPurpose: 'INCOME_PRODUCING'
});
assert.equal(context.investmentPortfolioDrawerRobinhoodImportEligible_(robinhoodAccount), true);
const schwabAccount = context.investmentPortfolioDrawerMapAccountRow_({
  sysAssetsRow: 11,
  accountName: 'Charles Schwab - Personal',
  investmentId: 'inv-schwab',
  planningPurpose: ''
});
assert.equal(context.investmentPortfolioDrawerRobinhoodImportEligible_(schwabAccount), false);
const schwabFormats = context.investmentPortfolioDrawerSupportedImportFormats_('SCHWAB', 'SINGLE_ACCOUNT');
assert.equal(schwabFormats.length, 1);
assert.equal(schwabFormats[0].source, 'SCHWAB_BROKERAGE_STATEMENT_PDF');
assert.equal(schwabFormats[0].label, 'Schwab brokerage statement PDF');
assert.equal(schwabFormats[0].productionReady, true);
assert.equal(schwabFormats[0].customerDrawerImport, true);
const stashFormats = context.investmentPortfolioDrawerSupportedImportFormats_('STASH', 'SINGLE_ACCOUNT');
assert.equal(stashFormats.length, 1);
assert.equal(stashFormats[0].source, 'STASH_BROKERAGE_STATEMENT_PDF');
assert.equal(stashFormats[0].label, 'Stash brokerage statement PDF');
assert.equal(stashFormats[0].productionReady, true);
assert.equal(stashFormats[0].customerDrawerImport, true);
const etradeFormats = context.investmentPortfolioDrawerSupportedImportFormats_('ETRADE', 'SINGLE_ACCOUNT');
assert.equal(etradeFormats[0].source, 'ETRADE_POSITIONS_PDF');
assert.equal(etradeFormats[0].productionReady, true);
assert.equal(etradeFormats[0].customerDrawerImport, false);
assert.equal(
  context.investmentPortfolioDrawerCustomerDrawerFormats_('ETRADE', 'SINGLE_ACCOUNT').length,
  0,
  'E*TRADE adapter existence must not create a customer drawer import tab'
);

// --- Provider metadata: explicit broker names only; ambiguous names stay unknown ---
assert.equal(
  context.investmentPortfolioDrawerInferProvider_('Charles Schwab - Personal', null),
  'SCHWAB'
);
assert.equal(
  context.investmentPortfolioDrawerInferProvider_('Stash Brokerage', null),
  'STASH'
);
assert.equal(
  context.investmentPortfolioDrawerInferProvider_('Etrade Cisco - Future', null),
  'ETRADE'
);
assert.equal(
  context.investmentPortfolioDrawerInferProvider_('Samer Robinhood', null),
  'ROBINHOOD'
);
assert.equal(context.investmentPortfolioDrawerInferProvider_('401K Account', null), 'FIDELITY');
assert.equal(
  context.investmentPortfolioDrawerProviderLabel_('FIDELITY'),
  'Fidelity'
);
assert.equal(
  context.investmentPortfolioDrawerInferProvider_('M1 Account - Gmail', null),
  'M1'
);
assert.doesNotMatch(drawerSource, /boundedHoldingsPreviewInferIdentityProvider_/);

function byName(name) {
  return drawerList.find((row) => row.accountName === name);
}

const pickerList = simulateActivityPicker(fixtureAccounts);
function pickerByName(name) {
  return pickerList.find((row) => row.accountName === name);
}
function pickerByValue(value) {
  return pickerList.find((row) => row.pickerValue === value);
}

const enabledNames = [
  '401K Account',
  'Charles Schwab - Personal',
  'M1 Account - Gmail',
  'M1 Account - yahoo',
  'Samer Robinhood',
  'Samer Etrade Account',
  'Stash Account'
];
const disabledNames = [
  'Laith 529',
  'Lutfi 529',
  'Lutfi Robinhood',
  'Lutfi Etrade Account',
  'Laith Etrade Account'
];
enabledNames.forEach((name) => {
  const row = pickerByName(name);
  assert.ok(row, `${name} must remain a selectable picker entry`);
  assert.equal(row.optionDisabled, false, `${name} must be selectable`);
  assert.equal(row.customerImportEnabled, true, `${name} must have a customer import path`);
  assert.match(row.optionLabel, new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});
disabledNames.forEach((name) => {
  const row = pickerByName(name);
  assert.ok(row, `${name} must remain visible`);
  assert.equal(row.optionDisabled, true, `${name} must stay visible but not selectable`);
  assert.equal(row.customerImportEnabled, false);
  assert.match(row.optionLabel, new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});
assert.equal(pickerByName('Etrade Cisco - Future'), undefined,
  'Etrade Cisco - Future must not be a standalone picker option');
assert.equal(pickerByName('Etrade Cisco - RSU/ESPP'), undefined,
  'Etrade Cisco - RSU/ESPP must not be a standalone picker option');
const ciscoPicker = pickerByValue('__profile__:ETRADE_CISCO_STATEMENT');
assert.ok(ciscoPicker, 'combined Cisco profile must remain selectable');
assert.equal(ciscoPicker.optionDisabled, false);
assert.equal(ciscoPicker.optionLabel, 'E*TRADE Cisco Statement — RSU/ESPP + Future');
assert.equal(byName('Etrade Cisco - Future').accountName, 'Etrade Cisco - Future');
assert.equal(byName('Etrade Cisco - RSU/ESPP').accountName, 'Etrade Cisco - RSU/ESPP');
assert.equal(byName('Etrade Cisco - Future').omitFromActivityPicker, true);
assert.equal(byName('Etrade Cisco - RSU/ESPP').omitFromActivityPicker, true);
assert.equal(byName('Stash Account').omitFromActivityPicker, false);
assert.equal(byName('Laith 529').omitFromActivityPicker, false);

assert.equal(byName('401K Account').customerImportSource, 'FIDELITY_401K_STATEMENT_PDF');
assert.equal(byName('401K Account').customerImportPickerNote, '401(k) supports balance-only import');
assert.match(byName('401K Account').optionLabel, /401K Account · Fidelity/);
assert.match(byName('401K Account').optionLabel, /401\(k\) supports balance-only import/);
assert.equal(byName('Charles Schwab - Personal').customerImportSource, 'SCHWAB_BROKERAGE_STATEMENT_PDF');
assert.match(byName('Charles Schwab - Personal').optionLabel, /Charles Schwab - Personal · Schwab/);
assert.equal(byName('M1 Account - Gmail').customerImportSource, 'M1_STATEMENT_PDF');
assert.match(byName('M1 Account - Gmail').optionLabel, /M1 Account - Gmail · M1/);
assert.equal(byName('M1 Account - yahoo').customerImportSource, 'M1_STATEMENT_PDF');
assert.match(byName('M1 Account - yahoo').optionLabel, /M1 Account - yahoo · M1/);
assert.equal(byName('Samer Robinhood').customerImportSource, 'ROBINHOOD_CSV');
assert.match(byName('Samer Robinhood').optionLabel, /Samer Robinhood · Robinhood/);
assert.equal(byName('Stash Account').customerImportSource, 'STASH_BROKERAGE_STATEMENT_PDF');
assert.match(byName('Stash Account').optionLabel, /Stash Account · Stash/);
assert.equal(byName('Samer Etrade Account').customerImportSource, 'ETRADE_CLIENT_STATEMENT_PDF');
assert.equal(byName('Samer Etrade Account').customerImportEnabled, true);
assert.match(byName('Samer Etrade Account').optionLabel, /Samer Etrade Account · E\*TRADE/);

const ciscoProfile = context.investmentPortfolioDrawerStatementImportProfiles_()[0];
assert.ok(ciscoProfile);
assert.equal(ciscoProfile.pickerKind, 'STATEMENT_IMPORT_PROFILE');
assert.equal(ciscoProfile.pickerValue, '__profile__:ETRADE_CISCO_STATEMENT');
assert.equal(ciscoProfile.pickerLabel, 'E*TRADE Cisco Statement — RSU/ESPP + Future');
assert.equal(ciscoProfile.customerImportEnabled, true);
assert.equal(ciscoProfile.customerImportSource, 'ETRADE_CLIENT_STATEMENT_PDF');
assert.equal(ciscoProfile.pickerLabel.includes('Etrade Cisco - RSU/ESPP + Future'), false);
assert.equal(context.investmentEtradeMatchesCiscoStatementImportProfile_(ciscoProfile.pickerValue), true);
assert.equal(
  context.investmentEtradeCiscoStatementImportProfile_().legs.map((leg) => leg.accountName).join('|'),
  'Etrade Cisco - RSU/ESPP|Etrade Cisco - Future'
);

assert.equal(byName('Etrade Cisco - Future').statementProvider, 'ETRADE');
assert.equal(byName('Etrade Cisco - Future').customerImportEnabled, false);
assert.equal(byName('Etrade Cisco - Future').customerImportDisabledReason, 'Import not available yet');
assert.match(byName('Etrade Cisco - Future').optionLabel, /Etrade Cisco - Future · E\*TRADE/);
assert.equal(byName('Etrade Cisco - RSU\/ESPP').customerImportDisabledReason, 'Import not available yet');
assert.equal(byName('Laith 529').customerImportDisabledReason, 'Import not available yet');
assert.match(byName('Laith 529').optionLabel, /Laith 529 — Import not available yet/);
assert.equal(byName('Lutfi 529').customerImportDisabledReason, 'Import not available yet');
assert.match(byName('Lutfi 529').optionLabel, /Lutfi 529 — Import not available yet/);
assert.equal(
  byName('Lutfi Robinhood').customerImportDisabledReason,
  'Robinhood CSV requires an eligible investment account'
);
assert.match(
  byName('Lutfi Robinhood').optionLabel,
  /Lutfi Robinhood · Robinhood — Robinhood CSV requires an eligible investment account/
);

const eligibleLutfiRobinhood = context.investmentPortfolioDrawerDescribePickerAccount_({
  sysAssetsRow: 21,
  accountName: 'Lutfi Robinhood',
  type: 'Brokerage',
  investmentId: 'inv-lutfi-robinhood-eligible',
  planningPurpose: 'INCOME_PRODUCING',
  inactive: false
});
assert.equal(eligibleLutfiRobinhood.customerImportEnabled, true);
assert.equal(eligibleLutfiRobinhood.customerImportSource, 'ROBINHOOD_CSV');

function evaluateNamed(name, source) {
  const row = fixtureAccounts.find((item) => item.accountName === name);
  const mapped = context.investmentPortfolioDrawerMapAccountRow_(row);
  return context.investmentPortfolioDrawerEvaluateCustomerImportRequest_(mapped, source);
}

enabledNames.forEach((name) => {
  const open = evaluateNamed(name, '');
  assert.equal(open.ok, true, `${name} must open the customer drawer`);
  const source = byName(name).customerImportSource;
  const allowed = evaluateNamed(name, source);
  assert.equal(allowed.ok, true, `${name} must invoke its supported import`);
});

['Etrade Cisco - Future', 'Etrade Cisco - RSU/ESPP', 'Laith 529', 'Lutfi 529', 'Lutfi Robinhood',
  'Lutfi Etrade Account', 'Laith Etrade Account'].forEach((name) => {
  const open = evaluateNamed(name, '');
  assert.equal(open.ok, false, `${name} must not open the customer drawer`);
  assert.match(String(open.error || ''), /Import not available yet|eligible investment account/);
  const schwabAttempt = evaluateNamed(name, 'SCHWAB_BROKERAGE_STATEMENT_PDF');
  assert.equal(schwabAttempt.ok, false, `${name} must not invoke a customer import`);
  const m1Attempt = evaluateNamed(name, 'M1_STATEMENT_PDF');
  assert.equal(m1Attempt.ok, false);
  const stashAttempt = evaluateNamed(name, 'STASH_BROKERAGE_STATEMENT_PDF');
  assert.equal(stashAttempt.ok, false);
  const fidelityAttempt = evaluateNamed(name, 'FIDELITY_401K_STATEMENT_PDF');
  assert.equal(fidelityAttempt.ok, false);
  const robinhoodAttempt = evaluateNamed(name, 'ROBINHOOD_CSV');
  assert.equal(robinhoodAttempt.ok, false);
});

const etradeLab = evaluateNamed('Etrade Cisco - Future', 'ETRADE_POSITIONS_PDF');
assert.equal(etradeLab.ok, true, 'lab E*TRADE sources must remain available off the customer drawer');
assert.equal(etradeLab.labSource, true);
const futureCustomerSource = evaluateNamed('Etrade Cisco - Future', 'ETRADE_CLIENT_STATEMENT_PDF');
assert.equal(futureCustomerSource.ok, true, 'lab Future-only CLIENT_STATEMENT remains available off the customer picker');
assert.equal(futureCustomerSource.labSource, true);
const samerCustomerSource = evaluateNamed('Samer Etrade Account', 'ETRADE_CLIENT_STATEMENT_PDF');
assert.equal(samerCustomerSource.ok, true);
assert.notEqual(samerCustomerSource.labSource, true);
assert.equal(samerCustomerSource.customerImportEnabled, true);
const lutfiEtradeLab = evaluateNamed('Lutfi Etrade Account', 'ETRADE_CLIENT_STATEMENT_PDF');
assert.equal(lutfiEtradeLab.ok, true, 'Lutfi E*TRADE lab CLIENT_STATEMENT remains off the customer picker');
assert.equal(lutfiEtradeLab.labSource, true);
const futureWrongSource = evaluateNamed('Etrade Cisco - Future', 'SCHWAB_BROKERAGE_STATEMENT_PDF');
assert.equal(futureWrongSource.ok, false);
assert.match(String(futureWrongSource.error || ''), /Import not available yet/);

const schwabWrongSource = evaluateNamed('Charles Schwab - Personal', 'M1_STATEMENT_PDF');
assert.equal(schwabWrongSource.ok, false);
assert.match(String(schwabWrongSource.error || ''), /not available for this account/);
const stashWrongSource = evaluateNamed('Stash Account', 'SCHWAB_BROKERAGE_STATEMENT_PDF');
assert.equal(stashWrongSource.ok, false);
const m1WrongSource = evaluateNamed('M1 Account - Gmail', 'STASH_BROKERAGE_STATEMENT_PDF');
assert.equal(m1WrongSource.ok, false);
const fidelityWrongSource = evaluateNamed('401K Account', 'ROBINHOOD_CSV');
assert.equal(fidelityWrongSource.ok, false);
const robinhoodWrongSource = evaluateNamed('Samer Robinhood', 'SCHWAB_BROKERAGE_STATEMENT_PDF');
assert.equal(robinhoodWrongSource.ok, false);

const education529ByType = context.investmentPortfolioDrawerDescribePickerAccount_({
  sysAssetsRow: 22,
  accountName: 'College Plan',
  type: '529',
  investmentId: 'inv-college-529',
  planningPurpose: '',
  inactive: false
});
assert.equal(education529ByType.customerImportEnabled, false);
assert.equal(education529ByType.customerImportDisabledReason, 'Import not available yet');

const education529ByRegistration = context.investmentPortfolioDrawerDescribePickerAccount_({
  sysAssetsRow: 24,
  accountName: 'College Savings',
  type: 'Brokerage',
  registrationType: '529',
  investmentId: 'inv-college-reg-529',
  planningPurpose: '',
  inactive: false
});
assert.equal(education529ByRegistration.customerImportEnabled, false);
assert.equal(education529ByRegistration.statementProvider, 'UNKNOWN');

const incomeProducingEtrade = context.investmentPortfolioDrawerDescribePickerAccount_({
  sysAssetsRow: 23,
  accountName: 'Etrade Cisco - Future',
  type: 'Brokerage',
  investmentId: 'inv-etrade-income',
  planningPurpose: 'INCOME_PRODUCING',
  inactive: false
});
assert.equal(incomeProducingEtrade.customerImportEnabled, false);
assert.equal(incomeProducingEtrade.customerImportDisabledReason, 'Import not available yet');
assert.equal(
  context.investmentPortfolioDrawerEvaluateCustomerImportRequest_(
    context.investmentPortfolioDrawerMapAccountRow_({
      sysAssetsRow: 23,
      accountName: 'Etrade Cisco - Future',
      type: 'Brokerage',
      investmentId: 'inv-etrade-income',
      planningPurpose: 'INCOME_PRODUCING'
    }),
    'ROBINHOOD_CSV'
  ).ok,
  false,
  'income-producing E*TRADE must not invoke Robinhood CSV'
);

['Lutfi Etrade Account', 'Laith Etrade Account'].forEach((name) => {
  const row = context.investmentPortfolioDrawerDescribePickerAccount_({
    sysAssetsRow: 30,
    accountName: name,
    type: 'Brokerage',
    investmentId: 'inv-' + name.toLowerCase().replace(/\s+/g, '-'),
    planningPurpose: '',
    inactive: false
  });
  assert.equal(row.customerImportEnabled, false, `${name} must stay import-disabled`);
  assert.equal(row.customerImportDisabledReason, 'Import not available yet');
});

assert.match(dashboardInvestments, /!data\.m1ImportAvailable/);
assert.match(dashboardInvestments, /!data\.schwabImportAvailable/);
assert.match(dashboardInvestments, /!data\.stashImportAvailable/);
assert.match(dashboardInvestments, /!data\.fidelity401kImportAvailable/);
assert.match(dashboardInvestments, /!data\.etradeCiscoStatementImportAvailable/);
assert.match(dashboardInvestments, /!data\.etradeSamerImportAvailable/);
assert.doesNotThrow(() => {
  new Function(dashboardInvestments);
}, 'Dashboard_Script_AssetsBankInvestments.html must parse so loadInvestmentSection can fill the Update dropdown');
assert.match(
  extractFunction(dashboardInvestments, 'setInvestmentPortfolioDrawerView_'),
  /else if \(view === 'etrade-samer'\) requested = 'etrade-samer';/
);

// --- No workbook writes in drawer module ---
assert.doesNotMatch(drawerSource, /\bsetValues\b|\bappendRow\b|\bsetValue\b/);

// --- Unified drawer UX ---
assert.doesNotMatch(dashboardBody, /id="inv_holdings_preview_btn"/);
assert.doesNotMatch(dashboardBody, /Preview holdings \(PDF\)/);
assert.match(dashboardBody, /Import M1 statement PDF/);
assert.match(dashboardBody, /inv_portfolio_m1_import_view/);
assert.match(dashboardBody, /Import Schwab statement PDF/);
assert.match(dashboardBody, /inv_portfolio_schwab_import_view/);
assert.match(dashboardBody, /Import Stash statement PDF/);
assert.match(dashboardBody, /inv_portfolio_stash_import_view/);
assert.match(dashboardBody, /for="inv_activity_account">CashCompass account or import profile/);
assert.match(dashboardBody, /Choose a CashCompass account or import profile to view holdings and import statements when available/);
assert.match(dashboardInvestments, /function investmentPortfolioDrawerClientOmitFromPicker_/);
assert.match(dashboardInvestments, /omitFromActivityPicker === true/);
assert.match(
  extractFunction(dashboardInvestments, 'populateInvestmentPortfolioDrawerAccounts_'),
  /investmentPortfolioDrawerClientOmitFromPicker_/
);
assert.match(drawerSource, /function investmentPortfolioDrawerOmitFromActivityPicker_/);
assert.doesNotMatch(dashboardBody, /update recurring plans/);
assert.match(drawerM1Source, /boundedHoldingsPreviewRunFromDashboard/);
assert.match(drawerM1Source, /boundedHoldingsPreviewRunGroupedChildFromDashboard/);
assert.match(drawerM1Source, /boundedHoldingsPreviewBuildApplyDiffFromDashboard/);
assert.match(drawerM1Source, /boundedHoldingsPreviewBuildGroupedApplyDiffFromDashboard/);
assert.match(drawerM1Source, /boundedHoldingsPreviewApplyFromDashboard/);
assert.match(drawerM1Source, /boundedHoldingsPreviewApplyGroupedFromDashboard/);
assert.match(drawerSource, /m1ImportAvailable/);
assert.match(drawerSource, /schwabImportAvailable/);
assert.match(drawerSource, /stashImportAvailable/);
assert.match(drawerSource, /parentAggregateExcluded/);
assert.match(drawerSource, /fidelity401kImportAvailable/);
assert.match(drawerSource, /FIDELITY_401K_BALANCE/);
assert.match(drawerSource, /previewFidelity401kStatementFromDashboard/);
assert.match(drawerSource, /previewEtradeCiscoFutureStatementFromDashboard/);
assert.match(drawerSource, /previewEtradeCiscoStatementProfileFromDashboard/);
assert.match(drawerSource, /etradeCiscoStatementImportAvailable/);
assert.match(drawerSource, /etradeSamerImportAvailable/);
assert.match(drawerSource, /ETRADE_CISCO_STATEMENT/);
assert.match(drawerSource, /investmentPortfolioDrawerStatementImportProfiles_/);
assert.doesNotMatch(drawerSource, /Etrade Cisco - RSU\/ESPP \+ Future/);
assert.match(drawerSource, /Retirement savings statement PDF/);
assert.match(dashboardBody, /inv_portfolio_401k_import_view/);
assert.match(dashboardBody, /Retirement savings statement PDF/);
assert.match(dashboardBody, /inv_portfolio_etrade_future_import_view/);
assert.match(dashboardBody, /E\*TRADE Cisco statement/);
assert.match(dashboardBody, /Etrade Cisco - RSU\/ESPP and Etrade Cisco - Future/);
assert.doesNotMatch(dashboardBody, /Etrade Cisco - RSU\/ESPP \+ Future/);
assert.match(dashboardInvestments, /renderInvestmentPortfolio401kBalanceView_/);
assert.match(dashboardInvestments, /renderInvestmentPortfolioEtradeFutureView_/);
assert.match(dashboardInvestments, /portfolioActivityProfiles/);
assert.match(dashboardInvestments, /investmentPortfolioRender401kBalanceComparison_/);
assert.match(dashboardInvestments, /Change in reported balance/);
assert.match(drawer401kSource, /previewFidelity401kStatementFromDashboard/);
assert.match(drawer401kSource, /boundedHoldingsPreviewBuildApplyDiffFromDashboard/);
assert.match(drawer401kSource, /boundedHoldingsPreviewApplyFromDashboard/);
assert.match(drawer401kSource, /payload\.explicitApplyConfirm = true/);
assert.match(drawer401kSource, /monthlyInvestmentValueDecision/);
assert.match(drawer401kSource, /Ignore monthly value/);
assert.match(drawer401kSource, /Keep existing/);
assert.match(drawer401kSource, /Replace with statement value/);
assert.match(drawer401kSource, /inv_401k_monthly_add/);
assert.doesNotMatch(drawer401kSource, /fundHoldings/);
assert.doesNotMatch(drawer401kSource, /\bsetValues\b|\bappendRow\b/);
assert.match(dashboardBody, /inv_401k_apply_area/);
assert.match(drawerEtradeFutureSource, /previewEtradeCiscoStatementProfileFromDashboard/);
assert.match(drawerEtradeFutureSource, /boundedHoldingsPreviewBuildApplyDiffFromDashboard/);
assert.match(drawerEtradeFutureSource, /boundedHoldingsPreviewApplyFromDashboard/);
assert.match(drawerEtradeFutureSource, /payload\.explicitApplyConfirm = true/);
assert.match(drawerEtradeFutureSource, /monthlyInvestmentValueDecisions/);
assert.match(drawerEtradeFutureSource, /Potential\/unvested stock-plan value/);
assert.match(drawerEtradeFutureSource, /Etrade Cisco - Future/);
assert.match(drawerEtradeFutureSource, /Etrade Cisco - RSU\/ESPP/);
assert.match(drawerEtradeFutureSource, /This value is not vested and is not current brokerage holdings\./);
assert.match(drawerEtradeFutureSource, /inv_etrade_cisco_monthly_add_/);
assert.match(drawerEtradeFutureSource, /Already matches\. Existing value will be kept\./);
assert.match(drawerEtradeFutureSource, /Existing value will remain unchanged unless Replace is selected\./);
assert.match(drawerEtradeFutureSource, /Warning: the existing monthly value will be replaced\./);
assert.match(drawerEtradeFutureSource, /Ignore monthly value/);
assert.doesNotMatch(drawerEtradeFutureSource, /if you choose Replace/);
assert.match(drawer401kSource, /Already matches\. Existing value will be kept\./);
assert.match(drawer401kSource, /Existing value will remain unchanged unless Replace is selected\./);
assert.match(drawer401kSource, /Warning: the existing monthly value will be replaced\./);
assert.match(drawerSchwabSource, /Already matches\. Existing value will be kept\./);
assert.match(drawerStashSource, /Already matches\. Existing value will be kept\./);
assert.match(drawerM1Source, /Already matches\. Existing value will be kept\./);
assert.match(drawerEtradeFutureSource, /ensureInvDrawerPdfClientReady_/);
assert.match(drawerEtradeFutureSource, /boundedHoldingsPreviewLoadDocumentTextFromFile_/);
assert.match(drawerEtradeFutureSource, /previewText \|\| result\.text/);
assert.match(drawerEtradeFutureSource, /accountProvider: 'ETRADE'/);
assert.match(drawerEtradeFutureSource, /This PDF does not contain a usable text layer\./);
assert.match(drawerEtradeFutureSource, /PDF extraction failed\. No text was returned from the selected file\./);
assert.doesNotMatch(drawerEtradeFutureSource, /extractBoundedHoldingsPreviewPdfText_/);
assert.doesNotMatch(drawerEtradeFutureSource, /PDF text extraction is unavailable/);
assert.doesNotMatch(drawerEtradeFutureSource, /tesseract|ocr\.space|google\.cloud\.vision/i);
assert.doesNotMatch(drawerEtradeFutureSource, /Etrade Cisco - RSU\/ESPP \+ Future/);
assert.doesNotMatch(drawerEtradeFutureSource, /\bsetValues\b|\bappendRow\b/);
assert.ok(
  read('PlannerDashboardWeb.html').indexOf('Dashboard_Script_InvestmentPortfolioDrawerM1') <
    read('PlannerDashboardWeb.html').indexOf('Dashboard_Script_InvestmentPortfolioDrawerEtradeFuture'),
  'M1 PDF helper include must load before the combined E*TRADE drawer'
);
assert.match(dashboardBody, /inv_etrade_future_apply_area/);
assert.match(read('PlannerDashboardWeb.html'), /Dashboard_Script_InvestmentPortfolioDrawerEtradeFuture/);
assert.match(webappSource, /view === 'portfolio-holdings-preview' && !isCentralModeEnabled_\(\)/);
assert.doesNotMatch(drawerM1Source, /\bsetValues\b|\bappendRow\b/);
assert.match(drawerSchwabSource, /boundedHoldingsPreviewRunFromDashboard/);
assert.match(drawerSchwabSource, /boundedHoldingsPreviewBuildApplyDiffFromDashboard/);
assert.match(drawerSchwabSource, /boundedHoldingsPreviewApplyFromDashboard/);
assert.match(drawerSchwabSource, /payload\.explicitApplyConfirm = true/);
assert.doesNotMatch(drawerSchwabSource, /boundedHoldingsPreviewRunGroupedChildFromDashboard/);
assert.doesNotMatch(drawerSchwabSource, /\bsetValues\b|\bappendRow\b/);
assert.doesNotMatch(drawerSchwabSource, /id="inv_schwab_stable_account"/);
assert.doesNotMatch(drawerSchwabSource, /res\.preview\s*\|\|/);
assert.match(drawerSchwabSource, /lastSinglePreview = res;/);
assert.match(drawerSchwabSource, /preview\.holdingsRows/);
assert.match(drawerSchwabSource, /preview\.unsupportedRows/);
assert.match(drawerSchwabSource, /preview\.readiness/);
assert.match(drawerSchwabSource, /preview\.warnings/);
assert.match(drawerSchwabSource, /preview\.reconciliation/);
assert.match(drawerStashSource, /boundedHoldingsPreviewRunFromDashboard/);
assert.match(drawerStashSource, /boundedHoldingsPreviewBuildApplyDiffFromDashboard/);
assert.match(drawerStashSource, /boundedHoldingsPreviewApplyFromDashboard/);
assert.match(drawerStashSource, /payload\.explicitApplyConfirm = true/);
assert.match(drawerStashSource, /monthlyInvestmentValueDecision/);
assert.match(drawerStashSource, /Monthly investment value/);
assert.match(drawerStashSource, /Ignore monthly value/);
assert.match(drawerStashSource, /Keep existing/);
assert.match(drawerStashSource, /Replace with statement value/);
assert.doesNotMatch(drawerStashSource, /boundedHoldingsPreviewRunGroupedChildFromDashboard/);
assert.doesNotMatch(drawerStashSource, /\bsetValues\b|\bappendRow\b/);
assert.match(drawerStashSource, /lastSinglePreview = res;/);
assert.match(dashboardInvestments, /stashImportAvailable/);
assert.match(dashboardInvestments, /etradeSamerImportAvailable/);
assert.match(drawerEtradeSamerSource, /boundedHoldingsPreviewRunFromDashboard/);
assert.match(drawerEtradeSamerSource, /boundedHoldingsPreviewBuildApplyDiffFromDashboard/);
assert.match(drawerEtradeSamerSource, /boundedHoldingsPreviewApplyFromDashboard/);
assert.match(drawerEtradeSamerSource, /payload\.explicitApplyConfirm = true/);
assert.match(drawerEtradeSamerSource, /monthlyInvestmentValueDecision/);
assert.match(drawerEtradeSamerSource, /Monthly investment value/);
assert.match(drawerEtradeSamerSource, /Ignore monthly value/);
assert.match(drawerEtradeSamerSource, /Keep existing/);
assert.match(drawerEtradeSamerSource, /Replace with statement value/);
assert.match(drawerEtradeSamerSource, /Already matches\. Existing value will be kept\./);
assert.match(drawerEtradeSamerSource, /Existing value will remain unchanged unless Replace is selected\./);
assert.match(drawerEtradeSamerSource, /Warning: the existing monthly value will be replaced\./);
assert.match(drawerEtradeSamerSource, /reason !== 'PURCHASES_OR_REINVESTMENT_ROW'/);
assert.match(drawerEtradeSamerSource, /reason !== 'SUMMARY_TOTAL_ROW'/);
assert.match(drawerEtradeSamerSource, /ETRADE_CLIENT_STATEMENT_PDF/);
assert.match(drawerEtradeSamerSource, /ensureInvDrawerPdfClientReady_/);
assert.match(drawerEtradeSamerSource, /accountProvider: 'ETRADE'/);
assert.doesNotMatch(drawerEtradeSamerSource, /boundedHoldingsPreviewRunGroupedChildFromDashboard/);
assert.doesNotMatch(drawerEtradeSamerSource, /\bsetValues\b|\bappendRow\b/);
assert.match(dashboardBody, /inv_portfolio_etrade_samer_import_view/);
assert.match(dashboardBody, /Import E\*TRADE statement PDF/);
assert.match(read('PlannerDashboardWeb.html'), /Dashboard_Script_InvestmentPortfolioDrawerEtradeSamer/);
assert.ok(
  read('PlannerDashboardWeb.html').indexOf('Dashboard_Script_InvestmentPortfolioDrawerM1') <
    read('PlannerDashboardWeb.html').indexOf('Dashboard_Script_InvestmentPortfolioDrawerEtradeSamer'),
  'M1 PDF helper include must load before the Samer E*TRADE drawer'
);

const schwabDrawerDom = (function() {
  const nodes = {};
  function ensure(id) {
    if (!nodes[id]) {
      nodes[id] = {
        id,
        innerHTML: '',
        disabled: false,
        onclick: null,
        textContent: '',
        value: '',
        checked: false
      };
    }
    return nodes[id];
  }
  ensure('inv_schwab_results');
  ensure('inv_schwab_apply_area');
  ensure('inv_schwab_document_text').value = 'schwab-extract';
  return {
    nodes,
    document: {
      getElementById(id) {
        if (id === 'inv_schwab_review_apply_btn' ||
            id === 'inv_schwab_confirm_apply_btn' ||
            id === 'inv_schwab_apply_message') {
          const applyHtml = String(nodes.inv_schwab_apply_area.innerHTML || '');
          if (applyHtml.indexOf(id) < 0) return null;
        }
        return ensure(id);
      }
    }
  };
})();

const schwabDrawerUi = {
  String, Number, Object, Array, Math, isFinite, Error, JSON, console,
  document: schwabDrawerDom.document,
  escapeHtml: (value) => String(value == null ? '' : value)
};
vm.createContext(schwabDrawerUi);
vm.runInContext(`
  var __invDrawerSchwabState = {
    selectedAccount: { pickerValue: 'STABLE-SCHWAB-1', accountName: 'Charles Schwab - Personal' },
    lastSinglePreview: null,
    lastPreviewDocumentText: '',
    applyReviewed: false,
    applyDiff: null,
    applyDiffDigest: '',
    applyStatusMessage: ''
  };
  ${extractFunction(drawerSchwabSource, 'invDrawerSchwabEscape_')}
  ${extractFunction(drawerSchwabSource, 'invDrawerSchwabCurrentText_')}
  ${extractFunction(drawerSchwabSource, 'invDrawerSchwabFormatMoney_')}
  ${extractFunction(drawerSchwabSource, 'invDrawerSchwabFormatAsOf_')}
  ${extractFunction(drawerSchwabSource, 'invDrawerSchwabEndingValue_')}
  ${extractFunction(drawerSchwabSource, 'clearInvestmentPortfolioDrawerSchwabApply_')}
  function reviewInvestmentPortfolioDrawerSchwabApplyDiff_() {}
  function confirmInvestmentPortfolioDrawerSchwabApply_() {}
  ${extractFunction(drawerSchwabSource, 'renderInvestmentPortfolioDrawerSchwabApplySection_')}
  ${extractFunction(drawerSchwabSource, 'renderInvDrawerSchwabSingleResults_')}
`, schwabDrawerUi, { filename: 'schwab-drawer-ui.js' });

const flatSchwabLabResponse = {
  ok: true,
  source: 'SCHWAB_BROKERAGE_STATEMENT_PDF',
  provider: 'SCHWAB',
  asOf: '2026-07-31T00:00:00.000Z',
  totalAccountValue: 47778.84,
  holdingsRows: [
    { symbol: 'CSCO', description: 'CISCO SYS INC', quantity: 3.5863, price: 115.99, marketValue: 415.97 },
    { symbol: 'DIS', description: 'DISNEY WALT CO', quantity: 32.0537, price: 96.19, marketValue: 3083.25 },
    { symbol: 'DXC', description: 'DXC TECHNOLOGY CO', quantity: 24.1784, price: 11.24, marketValue: 271.77 },
    { symbol: 'INTC', description: 'INTEL CORP', quantity: 84.1594, price: 90.2, marketValue: 7591.18 },
    { symbol: 'MSFT', description: 'MICROSOFT CORP', quantity: 78.3626, price: 464.72, marketValue: 36416.67 }
  ],
  unsupportedRows: [{
    symbol: '',
    description: 'CHINA TIANREN ORGANC',
    reason: 'UNPRICED_SECURITY',
    price: null,
    marketValue: null
  }],
  warnings: [],
  readiness: {
    trustedForHoldingsVisibility: true,
    trustedForIncomeAnalysis: false,
    trustedForTaxLotSalePlanning: false,
    blockingReasons: []
  },
  reconciliation: {
    ok: true,
    endingTotalValue: 47778.84
  }
};

schwabDrawerUi.renderInvDrawerSchwabSingleResults_(flatSchwabLabResponse);
const schwabResultsHtml = String(schwabDrawerDom.nodes.inv_schwab_results.innerHTML);
assert.match(schwabResultsHtml, /Schwab preview ready/);
assert.match(schwabResultsHtml, /As-of 2026-07-31/);
assert.match(schwabResultsHtml, /47778\.84/);
assert.match(schwabResultsHtml, /CSCO /);
assert.match(schwabResultsHtml, /DIS /);
assert.match(schwabResultsHtml, /DXC /);
assert.match(schwabResultsHtml, /INTC /);
assert.match(schwabResultsHtml, /MSFT /);
assert.match(schwabResultsHtml, /UNPRICED_SECURITY/);
assert.doesNotMatch(schwabResultsHtml, /needs review/);
assert.doesNotMatch(schwabResultsHtml, /not trusted for Apply/);
assert.equal(schwabDrawerUi.__invDrawerSchwabState.lastSinglePreview, flatSchwabLabResponse);
assert.equal(schwabDrawerUi.__invDrawerSchwabState.lastSinglePreview.holdingsRows.length, 5);
assert.equal(schwabDrawerUi.__invDrawerSchwabState.lastSinglePreview.unsupportedRows[0].reason, 'UNPRICED_SECURITY');
assert.equal(
  schwabDrawerUi.__invDrawerSchwabState.lastSinglePreview.readiness.trustedForHoldingsVisibility,
  true
);
assert.equal(
  schwabDrawerUi.__invDrawerSchwabState.lastSinglePreview.reconciliation.endingTotalValue,
  47778.84
);
const reviewBtn = schwabDrawerDom.document.getElementById('inv_schwab_review_apply_btn');
const confirmBtn = schwabDrawerDom.document.getElementById('inv_schwab_confirm_apply_btn');
assert.ok(reviewBtn, 'Review holdings changes button must exist');
assert.equal(reviewBtn.disabled, false);
assert.ok(confirmBtn, 'Apply approved holdings button must exist');
assert.equal(confirmBtn.disabled, true);
assert.match(String(schwabDrawerDom.nodes.inv_schwab_apply_area.innerHTML), /Review holdings changes/);
assert.doesNotMatch(
  String(schwabDrawerDom.nodes.inv_schwab_apply_area.innerHTML),
  /Apply is blocked until the statement reconciles/
);
assert.doesNotMatch(drawerSchwabSource, /bundle\.diffPreview/);
assert.match(drawerSchwabSource, /invDrawerSchwabResolveApplyDiffBundle_/);
assert.match(drawerSchwabSource, /Monthly investment value/);
assert.match(drawerSchwabSource, /monthlyInvestmentValueDecision/);
assert.match(drawerSchwabSource, /Keep existing/);
assert.match(drawerSchwabSource, /Replace with statement value/);
assert.doesNotMatch(drawerSchwabSource, /explicitMonthlyValueReplace/);
assert.doesNotMatch(drawerM1Source, /bundle\.diffPreview/);
assert.match(drawerM1Source, /invDrawerM1ResolveApplyDiffBundle_/);
assert.match(drawerM1Source, /Monthly investment value/);
assert.match(drawerM1Source, /monthlyInvestmentValueDecision/);
assert.match(drawerM1Source, /Keep existing/);
assert.match(drawerM1Source, /Replace with statement value/);
assert.doesNotMatch(drawerM1Source, /explicitMonthlyValueReplace/);
assert.match(drawerM1Source, /boundedHoldingsPreviewBuildApplyDiffFromDashboard/);
assert.match(drawerM1Source, /boundedHoldingsPreviewBuildGroupedApplyDiffFromDashboard/);

const applyDiffResolverUi = {
  String, Number, Object, Array, Math, isFinite, Error, JSON, console
};
vm.createContext(applyDiffResolverUi);
vm.runInContext(`
  ${extractFunction(drawerSchwabSource, 'invDrawerSchwabResolveApplyDiffBundle_')}
  ${extractFunction(drawerM1Source, 'invDrawerM1ResolveApplyDiffBundle_')}
`, applyDiffResolverUi, { filename: 'drawer-apply-diff-resolvers.js' });

const schwabDiffBundle = {
  ok: true,
  diffDigest: 'DIGEST-SCHWAB-1',
  diff: {
    summary: { createCount: 5, updateCount: 1 },
    blocked: false,
    duplicateNoop: false
  }
};
const schwabResolved = applyDiffResolverUi.invDrawerSchwabResolveApplyDiffBundle_(schwabDiffBundle);
assert.equal(schwabResolved.ok, true);
assert.equal(schwabResolved.applyDiff, schwabDiffBundle.diff);
assert.equal(schwabResolved.applyReviewed, true);
assert.match(schwabResolved.message, /Creates: 5/);
assert.match(schwabResolved.message, /Updates: 1/);
assert.doesNotMatch(schwabResolved.message, /Creates: 0 · Updates: 0/);
assert.equal(
  !!(schwabResolved.applyReviewed && schwabResolved.applyDiff &&
    !schwabResolved.applyDiff.blocked && !schwabResolved.applyDiff.duplicateNoop),
  true
);

const schwabMissingDiff = applyDiffResolverUi.invDrawerSchwabResolveApplyDiffBundle_({
  ok: true,
  diffDigest: 'DIGEST-SCHWAB-MISSING',
  diffPreview: { summary: { createCount: 5, updateCount: 0 } }
});
assert.equal(schwabMissingDiff.ok, false);
assert.equal(schwabMissingDiff.applyReviewed, false);
assert.equal(schwabMissingDiff.applyDiff, null);
assert.equal(schwabMissingDiff.message, 'Could not build diff.');
assert.doesNotMatch(schwabMissingDiff.message, /Creates: 0/);
assert.doesNotMatch(schwabMissingDiff.message, /Updates: 0/);

const m1DiffBundle = {
  ok: true,
  diffDigest: 'DIGEST-M1-1',
  diff: {
    summary: { createCount: 3, updateCount: 2 },
    blocked: false,
    duplicateNoop: false
  }
};
const m1Resolved = applyDiffResolverUi.invDrawerM1ResolveApplyDiffBundle_(m1DiffBundle);
assert.equal(m1Resolved.ok, true);
assert.equal(m1Resolved.applyDiff, m1DiffBundle.diff);
assert.equal(m1Resolved.applyReviewed, true);
assert.match(m1Resolved.message, /Creates: 3/);
assert.match(m1Resolved.message, /Updates: 2/);

const m1MissingDiff = applyDiffResolverUi.invDrawerM1ResolveApplyDiffBundle_({
  ok: true,
  diffDigest: 'DIGEST-M1-MISSING'
});
assert.equal(m1MissingDiff.ok, false);
assert.equal(m1MissingDiff.applyReviewed, false);
assert.equal(m1MissingDiff.message, 'Could not build diff.');
assert.doesNotMatch(m1MissingDiff.message, /Creates: 0/);

const schwabNoDigest = applyDiffResolverUi.invDrawerSchwabResolveApplyDiffBundle_({
  ok: true,
  diff: { summary: { createCount: 5, updateCount: 0 }, blocked: false, duplicateNoop: false }
});
assert.equal(schwabNoDigest.applyReviewed, false);
assert.equal(
  !!(schwabNoDigest.applyReviewed && schwabNoDigest.applyDiff &&
    !schwabNoDigest.applyDiff.blocked && !schwabNoDigest.applyDiff.duplicateNoop),
  false
);

assert.match(drawerSchwabSource, /syncInvestmentPortfolioDrawerSchwabReadyState_/);
assert.match(drawerSchwabSource, /invDrawerSchwabHasDocumentReady_/);
assert.match(drawerSchwabSource, /invDrawerSchwabRestoreTrustedDocumentText_/);
assert.match(
  drawerSchwabSource,
  /clearInvestmentPortfolioDrawerSchwabApply_\(true\);\s*syncInvestmentPortfolioDrawerSchwabReadyState_/
);
assert.match(dashboardBody, /onchange="onInvestmentPortfolioDrawerSchwabRegistrationChanged_\(\)"/);

const schwabReadyDom = (function() {
  const nodes = {};
  function ensure(id) {
    if (!nodes[id]) {
      nodes[id] = {
        id,
        innerHTML: '',
        disabled: true,
        onclick: null,
        textContent: '',
        value: '',
        checked: false
      };
    }
    return nodes[id];
  }
  ['inv_schwab_preview_btn', 'inv_schwab_registration_type', 'inv_schwab_explicit_match',
    'inv_schwab_document_text', 'inv_schwab_results', 'inv_schwab_apply_area'].forEach(ensure);
  return {
    nodes,
    document: { getElementById: (id) => ensure(id) }
  };
})();

const schwabReadyUi = {
  String, Number, Object, Array, Math, isFinite, Error, JSON, console,
  document: schwabReadyDom.document
};
vm.createContext(schwabReadyUi);
vm.runInContext(`
  var __invDrawerSchwabState = {
    selectedAccount: { pickerValue: 'STABLE-SCHWAB-1', accountName: 'Charles Schwab - Personal' },
    trustedDocumentText: '',
    lastSinglePreview: null,
    lastPreviewDocumentText: '',
    applyReviewed: false,
    applyDiff: null,
    applyDiffDigest: '',
    applyStatusMessage: '',
    registrationTouched: false
  };
  ${extractFunction(drawerSchwabSource, 'invDrawerSchwabCurrentText_')}
  ${extractFunction(drawerSchwabSource, 'invDrawerSchwabHasDocumentReady_')}
  ${extractFunction(drawerSchwabSource, 'invDrawerSchwabRestoreTrustedDocumentText_')}
  ${extractFunction(drawerSchwabSource, 'updateInvestmentPortfolioDrawerSchwabControls_')}
  ${extractFunction(drawerSchwabSource, 'clearInvestmentPortfolioDrawerSchwabApply_')}
  ${extractFunction(drawerSchwabSource, 'syncInvestmentPortfolioDrawerSchwabReadyState_')}
  ${extractFunction(drawerSchwabSource, 'onInvestmentPortfolioDrawerSchwabRegistrationChanged_')}
`, schwabReadyUi, { filename: 'schwab-drawer-ready-state.js' });

const readyNodes = schwabReadyDom.nodes;
readyNodes.inv_schwab_explicit_match.checked = true;
readyNodes.inv_schwab_preview_btn.disabled = true;

readyNodes.inv_schwab_document_text.value = '';
schwabReadyUi.__invDrawerSchwabState.trustedDocumentText = 'extracted-schwab-statement';
readyNodes.inv_schwab_registration_type.value = '';
schwabReadyUi.syncInvestmentPortfolioDrawerSchwabReadyState_();
assert.equal(readyNodes.inv_schwab_preview_btn.disabled, true, 'Preview stays disabled until registration is selected');

readyNodes.inv_schwab_registration_type.value = 'TAXABLE';
schwabReadyUi.onInvestmentPortfolioDrawerSchwabRegistrationChanged_();
assert.equal(schwabReadyUi.__invDrawerSchwabState.registrationTouched, true);
assert.equal(readyNodes.inv_schwab_document_text.value, 'extracted-schwab-statement');
assert.equal(schwabReadyUi.invDrawerSchwabCurrentText_(), 'extracted-schwab-statement');
assert.equal(readyNodes.inv_schwab_preview_btn.disabled, false, 'File then TAXABLE must enable Preview');

readyNodes.inv_schwab_document_text.value = '';
readyNodes.inv_schwab_registration_type.value = 'TAXABLE';
readyNodes.inv_schwab_preview_btn.disabled = true;
schwabReadyUi.__invDrawerSchwabState.trustedDocumentText = '';
schwabReadyUi.syncInvestmentPortfolioDrawerSchwabReadyState_();
assert.equal(readyNodes.inv_schwab_preview_btn.disabled, true, 'TAXABLE without a file stays disabled');

schwabReadyUi.__invDrawerSchwabState.trustedDocumentText = 'extracted-schwab-statement';
schwabReadyUi.syncInvestmentPortfolioDrawerSchwabReadyState_();
assert.equal(readyNodes.inv_schwab_document_text.value, 'extracted-schwab-statement');
assert.equal(readyNodes.inv_schwab_preview_btn.disabled, false, 'TAXABLE then file must enable Preview');

readyNodes.inv_schwab_results.innerHTML = '<div>stale preview</div>';
schwabReadyUi.__invDrawerSchwabState.lastSinglePreview = { ok: true, holdingsRows: [{ symbol: 'CSCO' }] };
schwabReadyUi.__invDrawerSchwabState.applyDiff = { summary: { createCount: 5, updateCount: 0 } };
schwabReadyUi.__invDrawerSchwabState.applyReviewed = true;
schwabReadyUi.__invDrawerSchwabState.applyDiffDigest = 'DIGEST-STALE';
readyNodes.inv_schwab_registration_type.value = 'ROTH_IRA';
schwabReadyUi.onInvestmentPortfolioDrawerSchwabRegistrationChanged_();
assert.equal(schwabReadyUi.__invDrawerSchwabState.lastSinglePreview, null);
assert.equal(schwabReadyUi.__invDrawerSchwabState.applyDiff, null);
assert.equal(schwabReadyUi.__invDrawerSchwabState.applyReviewed, false);
assert.equal(schwabReadyUi.__invDrawerSchwabState.applyDiffDigest, '');
assert.equal(readyNodes.inv_schwab_results.innerHTML, '');
assert.equal(readyNodes.inv_schwab_apply_area.innerHTML, '');
assert.equal(readyNodes.inv_schwab_document_text.value, 'extracted-schwab-statement');
assert.equal(readyNodes.inv_schwab_preview_btn.disabled, false, 'Registration change must not require re-upload');

const k401Account = context.investmentPortfolioDrawerMapAccountRow_({
  sysAssetsRow: 10,
  accountName: '401K Account',
  type: 'Retirement',
  investmentId: 'inv-401k',
  planningPurpose: ''
});
assert.equal(k401Account.statementProvider, 'FIDELITY');
assert.equal(context.investmentPortfolioDrawerIs401kRetirementAccount_(k401Account), true);
assert.equal(
  context.investmentPortfolioDrawerIs401kRetirementAccount_({
    accountName: '401K Account',
    type: 'Brokerage'
  }),
  false
);
const k401Comparison = context.investmentPortfolioDrawerBuild401kBalanceComparison_(1887450.18, 1918949.84);
assert.equal(k401Comparison.status, 'HAS_DELTA');
assert.equal(k401Comparison.balance.direction, 'up');
assert.equal(
  context.investmentPortfolioDrawerBuild401kBalanceComparison_(null, 1918949.84).status,
  'NO_PRIOR_STATEMENT'
);

// --- Drawer presentation (UI-only) ---
assert.match(dashboardInvestments, /investmentPortfolioDrawerShowsPlanActions_/);
assert.match(dashboardInvestments, /investmentPortfolioFriendlyChildLabel_/);
assert.match(dashboardInvestments, /renderInvestmentPortfolioSummaryMetrics_/);
assert.match(dashboardInvestments, /investment-portfolio-statement-card/);
assert.match(dashboardInvestments, /Account control total/);
assert.match(dashboardInvestments, /investment-portfolio-control-total-details/);
assert.doesNotMatch(dashboardInvestments, /Child partition:/);
assert.doesNotMatch(dashboardInvestments, /childPartitionId/);
assert.match(dashboardInvestments, /if \(showPlanActions && !row\.readOnly\)/);
assert.match(dashboardInvestments, /updateInvestmentPortfolioDrawerAccountHelp_/);
assert.doesNotMatch(dashboardInvestments, /supportedImportFormats[\s\S]{0,120}Supported imports:/);

// --- M1 statement card cash metrics ---
function investmentPortfolioResolvePartitionCashBalance_(partition) {
  partition = partition || {};
  if (partition.cashBalance != null && isFinite(Number(partition.cashBalance))) {
    return Number(partition.cashBalance);
  }
  var holdings = partition.holdings || [];
  for (var i = 0; i < holdings.length; i++) {
    var row = holdings[i] || {};
    var symbol = String(row.symbol || '').trim().toUpperCase();
    if (symbol === 'CASH') {
      var cashRowValue = Number(row.marketValue);
      if (isFinite(cashRowValue)) return cashRowValue;
    }
    if (row.cashBalance != null && isFinite(Number(row.cashBalance))) {
      return Number(row.cashBalance);
    }
  }
  return null;
}

function investmentPortfolioFormatCurrencyMetric_(value) {
  if (value == null || value === '' || !isFinite(Number(value))) return '—';
  var n = Number(value);
  var sign = n < 0 ? '-' : '';
  return sign + '$' + Math.abs(n).toFixed(2);
}

assert.equal(investmentPortfolioResolvePartitionCashBalance_({ cashBalance: 6.92 }), 6.92);
assert.equal(investmentPortfolioResolvePartitionCashBalance_({ cashBalance: -0.49 }), -0.49);
assert.equal(investmentPortfolioResolvePartitionCashBalance_({ cashBalance: 0 }), 0);
assert.equal(
  investmentPortfolioResolvePartitionCashBalance_({
    cashBalance: null,
    holdings: [{ symbol: 'CASH', marketValue: 0 }]
  }),
  0
);
assert.equal(investmentPortfolioResolvePartitionCashBalance_({ cashBalance: null, holdings: [] }), null);
assert.equal(investmentPortfolioFormatCurrencyMetric_(6.92), '$6.92');
assert.equal(investmentPortfolioFormatCurrencyMetric_(-0.49), '-$0.49');
assert.equal(investmentPortfolioFormatCurrencyMetric_(0), '$0.00');
assert.equal(investmentPortfolioFormatCurrencyMetric_(null), '—');
assert.match(dashboardInvestments, /appendInvestmentPortfolioStatementMetrics_/);
assert.match(dashboardInvestments, /appendInvestmentPortfolioMetricAlways_/);
assert.match(dashboardInvestments, /investmentPortfolioAppendComparisonDeltaLine_/);
assert.match(dashboardInvestments, /investmentPortfolioAppendComparisonMetric_/);
assert.match(dashboardInvestments, /investmentPortfolioRenderM1StatementComparison_/);
assert.match(dashboardInvestments, /investmentPortfolioCreateComparisonBlock_/);
assert.match(dashboardInvestments, /investmentPortfolioResolvePartitionCashBalance_/);
assert.match(dashboardInvestments, /Total market value/);
assert.match(dashboardInvestments, /Change in reported value/);
assert.match(dashboardInvestments, /vs previous statement/);
assert.match(dashboardInvestments, /vs current portfolio/);
assert.match(dashboardInvestments, /No change/);
assert.match(dashboardInvestments, /investment-portfolio-comparison-block/);
assert.match(dashboardInvestments, /investment-portfolio-comparison-metrics/);
assert.match(dashboardInvestments, /investment-portfolio-comparison-metric/);
assert.match(dashboardStyles, /investment-portfolio-comparison-block/);
assert.match(dashboardStyles, /investment-portfolio-comparison-metrics/);
assert.match(dashboardStyles, /investment-portfolio-metric-delta--up/);
assert.match(dashboardStyles, /investment-portfolio-metric-delta--down/);
assert.match(dashboardStyles, /investment-portfolio-metric-delta--flat/);
assert.doesNotMatch(drawerSource, /cash !== 0/);
assert.match(dashboardInvestments, /No previous statement available/);
assert.match(dashboardInvestments, /savedPortfolioComparison/);
assert.match(dashboardInvestments, /Comparison date · /);
assert.doesNotMatch(dashboardInvestments, /No comparison pending — preview a new CSV to compare/);
assert.match(dashboardInvestments, /investmentPortfolioAppendNeutralComparisonBlock_/);
assert.match(dashboardInvestments, /renderInvestmentPortfolioRobinhoodPortfolioSummary_/);
assert.match(dashboardInvestments, /investmentPortfolioRobinhoodCsvPreviewActive_/);
assert.match(dashboardInvestments, /investmentActivityImportHasUnsavedPreview_/);
assert.match(dashboardInvestments, /refreshInvestmentPortfolioDrawerAfterActivitySave_/);
assert.match(
  dashboardInvestments,
  /function saveInvestmentActivityImport_[\s\S]*?clearInvestmentActivityImport_[\s\S]*?refreshInvestmentPortfolioDrawerAfterActivitySave_/
);
assert.match(
  dashboardInvestments,
  /function onInvestmentPortfolioAccountChanged_[\s\S]*?investmentActivityImportHasUnsavedPreview_[\s\S]*?Discard this CSV preview\?/
);
assert.doesNotMatch(
  dashboardInvestments,
  /function onInvestmentPortfolioAccountChanged_[\s\S]{0,500}__investmentActivityImportState\.rawCsv \|\| __investmentActivityImportState\.preview/
);
assert.match(
  dashboardInvestments,
  /function refreshInvestmentPortfolioDrawerAfterActivitySave_[\s\S]*?getInvestmentPortfolioDrawerFromDashboard/
);
assert.doesNotMatch(
  dashboardInvestments,
  /function saveInvestmentActivityImport_[\s\S]{0,1200}renderInvestmentActivityHoldings_/
);
assert.match(activitySource, /function importInvestmentActivityFromDashboard[\s\S]*?rebuildInvestmentHoldingsForAccount_/);
assert.match(dashboardInvestments, /No current portfolio baseline available/);
assert.match(dashboardInvestments, /renderInvestmentPortfolioComparisonPreview_/);
assert.match(drawerSource, /savedPortfolioComparison/);
assert.match(drawerSource, /investmentActivityReadRobinhoodPortfolioComparison_/);
assert.match(activitySource, /INVESTMENT_PORTFOLIO_COMPARISON_HEADERS_/);
assert.match(activitySource, /investmentActivityWriteRobinhoodPortfolioComparison_/);
assert.match(activitySource, /investmentActivityBuildRobinhoodPortfolioComparisonForDrawer_/);
assert.match(activitySource, /savedPortfolioComparison:/);
assert.match(activitySource, /portfolioComparison:/);
assert.match(configSource, /INVESTMENT_PORTFOLIO_COMPARISONS: 'SYS - Investment Portfolio Comparisons'/);
assert.match(activitySource, /currentPortfolioValue:/);
assert.match(activitySource, /investmentActivityBuildRobinhoodPortfolioComparisonPreview_/);
assert.doesNotMatch(dashboardInvestments, /documentFingerprint/);
assert.doesNotMatch(dashboardInvestments, /statementDelta[\s\S]{0,80}textContent/);
assert.doesNotMatch(dashboardInvestments, /investment-portfolio-comparison-preview/);
assert.doesNotMatch(dashboardInvestments, /appendInvestmentPortfolioMetricWithDelta_/);
assert.match(dashboardInvestments, /if \(showPlanActions && !row\.readOnly\)/);

const m1Account = {
  accountName: 'M1 Account - Gmail',
  investmentId: 'INV-M1-GMAIL-1',
  currentBalance: 50000,
  previewMode: 'GROUPED_PROVIDER'
};
const partitionOne = 'PREVIEW-GROUP-M1-C1';
const partitionTwo = 'PREVIEW-GROUP-M1-C2';
const partitionThree = 'PREVIEW-GROUP-M1-C3';

function buildM1UnifiedRow(options) {
  options = options || {};
  return {
    source: 'M1_STATEMENT_PDF',
    provider: 'M1_GMAIL',
    parentAccount: 'M1 Account - Gmail',
    childPartition: options.childPartition,
    investmentId: 'INV-M1-GMAIL-1',
    sourceSecurityKey: options.sourceSecurityKey,
    symbol: options.symbol,
    securityName: options.securityName || options.symbol,
    shares: options.shares == null ? 1 : options.shares,
    price: options.price == null ? 100 : options.price,
    marketValue: options.marketValue,
    cashBalance: Object.prototype.hasOwnProperty.call(options, 'cashBalance') ? options.cashBalance : null,
    asOfDate: options.asOfDate,
    documentFingerprint: options.documentFingerprint,
    importStatus: options.importStatus || 'APPLIED'
  };
}

function buildPartitionStatementRows(config) {
  config = config || {};
  var rows = [];
  if (config.includeCashRow && Object.prototype.hasOwnProperty.call(config, 'cashBalance')) {
    rows.push(buildM1UnifiedRow({
      childPartition: config.childPartition,
      sourceSecurityKey: '__CASH__',
      symbol: 'Cash',
      securityName: 'Cash balance',
      shares: '',
      price: '',
      marketValue: config.cashBalance,
      cashBalance: config.cashBalance,
      asOfDate: config.asOfDate,
      documentFingerprint: config.documentFingerprint
    }));
  }
  rows.push(buildM1UnifiedRow({
    childPartition: config.childPartition,
    sourceSecurityKey: config.sourceSecurityKey || 'NVDA',
    symbol: config.symbol || 'NVDA',
    marketValue: config.marketValue,
    cashBalance: Object.prototype.hasOwnProperty.call(config, 'cashBalance') ? config.cashBalance : null,
    asOfDate: config.asOfDate,
    documentFingerprint: config.documentFingerprint
  }));
  return rows;
}

const firstStatementRows = buildPartitionStatementRows({
  childPartition: partitionOne,
  marketValue: 1000,
  cashBalance: 6.92,
  asOfDate: '2026-08-31',
  documentFingerprint: 'FP-STATEMENT-1'
});
const firstStatementView = context.investmentPortfolioDrawerBuildM1GroupedView_(firstStatementRows, m1Account);
assert.equal(firstStatementView.partitions.length, 1);
assert.equal(firstStatementView.partitions[0].marketValueTotal, 1000);
assert.equal(
  context.investmentPortfolioDrawerResolvePartitionCashFromRows_(
    context.investmentPortfolioDrawerRowsForPartitionAtAsOf_(firstStatementRows, partitionOne, '2026-08-31')
  ),
  6.92
);
assert.equal(firstStatementView.partitions[0].statementDelta.status, 'NO_PRIOR_STATEMENT');
assert.match(dashboardInvestments, /investmentPortfolioRenderM1StatementComparison_/);

const sameDateMultiPartitionRows = buildPartitionStatementRows({
  childPartition: partitionOne,
  marketValue: 1000,
  cashBalance: 6.92,
  asOfDate: '2026-08-31',
  documentFingerprint: 'FP-SAME-1'
}).concat(buildPartitionStatementRows({
  childPartition: partitionTwo,
  marketValue: 2000,
  cashBalance: 0,
  asOfDate: '2026-08-31',
  documentFingerprint: 'FP-SAME-2',
  includeCashRow: true
}));
const sameDateView = context.investmentPortfolioDrawerBuildM1GroupedView_(sameDateMultiPartitionRows, m1Account);
assert.equal(sameDateView.partitions.length, 2);
assert.equal(sameDateView.partitions[0].statementDelta.status, 'NO_PRIOR_STATEMENT');
assert.equal(sameDateView.partitions[1].statementDelta.status, 'NO_PRIOR_STATEMENT');

const increasedRows = firstStatementRows.concat(buildPartitionStatementRows({
  childPartition: partitionOne,
  marketValue: 1100,
  cashBalance: 6.92,
  asOfDate: '2026-09-30',
  documentFingerprint: 'FP-STATEMENT-2'
}));
const increasedView = context.investmentPortfolioDrawerBuildM1GroupedView_(increasedRows, m1Account);
assert.equal(increasedView.partitions[0].statementDelta.status, 'HAS_DELTA');
assert.equal(increasedView.partitions[0].statementDelta.priorAsOfDate, '2026-08-31');
assert.equal(increasedView.partitions[0].statementDelta.marketValue.delta, 100);
assert.equal(increasedView.partitions[0].statementDelta.marketValue.direction, 'up');
assert.equal(increasedView.partitions[0].statementDelta.cash.delta, 0);
assert.equal(increasedView.partitions[0].statementDelta.cash.direction, 'flat');

const decreasedRows = firstStatementRows.concat(buildPartitionStatementRows({
  childPartition: partitionOne,
  marketValue: 900,
  cashBalance: 6.92,
  asOfDate: '2026-09-30',
  documentFingerprint: 'FP-STATEMENT-3'
}));
const decreasedView = context.investmentPortfolioDrawerBuildM1GroupedView_(decreasedRows, m1Account);
assert.equal(decreasedView.partitions[0].statementDelta.marketValue.delta, -100);
assert.equal(decreasedView.partitions[0].statementDelta.marketValue.direction, 'down');

const unchangedRows = firstStatementRows.concat(buildPartitionStatementRows({
  childPartition: partitionOne,
  marketValue: 1000,
  cashBalance: 6.92,
  asOfDate: '2026-09-30',
  documentFingerprint: 'FP-STATEMENT-4'
}));
const unchangedView = context.investmentPortfolioDrawerBuildM1GroupedView_(unchangedRows, m1Account);
assert.equal(unchangedView.partitions[0].statementDelta.marketValue.delta, 0);
assert.equal(unchangedView.partitions[0].statementDelta.marketValue.direction, 'flat');

const zeroCashRows = buildPartitionStatementRows({
  childPartition: partitionThree,
  marketValue: 500,
  cashBalance: 0,
  asOfDate: '2026-08-31',
  documentFingerprint: 'FP-STATEMENT-3-AUG',
  includeCashRow: true
}).concat(buildPartitionStatementRows({
  childPartition: partitionThree,
  marketValue: 500,
  cashBalance: 0,
  asOfDate: '2026-09-30',
  documentFingerprint: 'FP-STATEMENT-3-SEP',
  includeCashRow: true
}));
const zeroCashView = context.investmentPortfolioDrawerBuildM1GroupedView_(zeroCashRows, m1Account);
assert.equal(zeroCashView.partitions[0].cashBalance, 0);
assert.equal(zeroCashView.partitions[0].statementDelta.cash.delta, 0);
assert.equal(zeroCashView.partitions[0].statementDelta.cash.direction, 'flat');

const cashFromZeroRows = buildPartitionStatementRows({
  childPartition: partitionThree,
  marketValue: 500,
  cashBalance: 0,
  asOfDate: '2026-08-31',
  documentFingerprint: 'FP-STATEMENT-3-AUG-2'
}).concat(buildPartitionStatementRows({
  childPartition: partitionThree,
  marketValue: 500,
  cashBalance: 5.5,
  asOfDate: '2026-09-30',
  documentFingerprint: 'FP-STATEMENT-3-SEP-2'
}));
const cashFromZeroView = context.investmentPortfolioDrawerBuildM1GroupedView_(cashFromZeroRows, m1Account);
assert.equal(cashFromZeroView.partitions[0].statementDelta.cash.delta, 5.5);
assert.equal(cashFromZeroView.partitions[0].statementDelta.cash.direction, 'up');

const multiPartitionRows = buildPartitionStatementRows({
  childPartition: partitionOne,
  marketValue: 1000,
  cashBalance: 6.92,
  asOfDate: '2026-08-31',
  documentFingerprint: 'FP-P1-AUG'
}).concat(buildPartitionStatementRows({
  childPartition: partitionOne,
  marketValue: 1100,
  cashBalance: -0.49,
  asOfDate: '2026-09-30',
  documentFingerprint: 'FP-P1-SEP'
})).concat(buildPartitionStatementRows({
  childPartition: partitionTwo,
  marketValue: 2000,
  cashBalance: 0,
  asOfDate: '2026-08-31',
  documentFingerprint: 'FP-P2-AUG'
})).concat(buildPartitionStatementRows({
  childPartition: partitionTwo,
  marketValue: 2500,
  cashBalance: 0,
  asOfDate: '2026-09-30',
  documentFingerprint: 'FP-P2-SEP'
}));
const multiPartitionView = context.investmentPortfolioDrawerBuildM1GroupedView_(multiPartitionRows, m1Account);
assert.equal(multiPartitionView.partitions.length, 2);
assert.equal(multiPartitionView.partitions[0].statementDelta.marketValue.delta, 100);
assert.equal(multiPartitionView.partitions[1].statementDelta.marketValue.delta, 500);
assert.equal(
  multiPartitionView.partitions[0].statementDelta.priorAsOfDate,
  '2026-08-31'
);
assert.equal(
  multiPartitionView.partitions[1].statementDelta.priorAsOfDate,
  '2026-08-31'
);
const singleStatementPartitionRows = buildPartitionStatementRows({
  childPartition: 'PREVIEW-GROUP-M1-C4',
  marketValue: 750,
  cashBalance: 1.25,
  asOfDate: '2026-09-30',
  documentFingerprint: 'FP-P4-ONLY'
}).concat(multiPartitionRows);
const mixedHistoryView = context.investmentPortfolioDrawerBuildM1GroupedView_(
  singleStatementPartitionRows, m1Account);
const lonePartition = mixedHistoryView.partitions.find(function(partition) {
  return partition.childPartitionId === 'PREVIEW-GROUP-M1-C4';
});
assert.ok(lonePartition, 'single-statement partition must render');
assert.equal(lonePartition.statementDelta.status, 'NO_PRIOR_STATEMENT', 'different child partitions do not compare');
assert.equal(multiPartitionView.partitions[0].cashBalance, -0.49);
assert.equal(multiPartitionView.partitions[1].cashBalance, 0);
assert.equal(multiPartitionView.parentControlTotal.amount, 50000);
assert.equal(multiPartitionView.parentControlTotal.statementDelta, undefined);

const replayRows = buildPartitionStatementRows({
  childPartition: partitionOne,
  marketValue: 1000,
  cashBalance: 6.92,
  asOfDate: '2026-08-31',
  documentFingerprint: 'FP-REPLAY'
}).concat(buildPartitionStatementRows({
  childPartition: partitionOne,
  marketValue: 1100,
  cashBalance: 6.92,
  asOfDate: '2026-09-30',
  documentFingerprint: 'FP-REPLAY'
}));
const replayView = context.investmentPortfolioDrawerBuildM1GroupedView_(replayRows, m1Account);
assert.equal(replayView.partitions[0].statementDelta.status, 'NO_DELTA');

const activityContext = {
  String, Number, Object, Array, Math, isFinite, Error, JSON, console
};
vm.createContext(activityContext);
vm.runInContext(`
  function round2_(value) { return Math.round(Number(value) * 100) / 100; }
  var INVESTMENT_ACTIVITY_HEADERS_ = [
    'Import Key', 'Investment Id', 'Account Name', 'Activity Date', 'Settle Date',
    'Ticker', 'Activity Type', 'Quantity', 'Price', 'Amount', 'Recurring',
    'Description', 'Source', 'Imported At'
  ];
  var INVESTMENT_PORTFOLIO_COMPARISON_HEADERS_ = [
    'Investment Id', 'Account Name', 'Comparison Date', 'Prior As Of Date',
    'Prior Market Value', 'Current Market Value', 'Prior Holdings Count',
    'Current Holdings Count', 'Prior Cash', 'Current Cash', 'Import Digest', 'Updated At'
  ];
  function getSheetNames_() {
    return { INVESTMENT_ACTIVITY: 'Investment Activity', INVESTMENT_HOLDINGS: 'Investment Holdings' };
  }
  function getInvestmentHoldingsSummary_(ss, investmentId) {
    investmentId = String(investmentId || '').trim();
    return (ss && ss.__holdingsByInvestmentId && ss.__holdingsByInvestmentId[investmentId]) || [];
  }
  ${extractFunction(activitySource, 'investmentActivityPortfolioDeltaDirection_')}
  ${extractFunction(activitySource, 'investmentActivityBuildPortfolioDeltaEntry_')}
  ${extractFunction(activitySource, 'investmentActivityAggregateHoldingsFromRows_')}
  ${extractFunction(activitySource, 'investmentActivitySummarizeAggregatePortfolio_')}
  ${extractFunction(activitySource, 'investmentActivitySummarizeSavedHoldingsPortfolio_')}
  ${extractFunction(activitySource, 'investmentActivityReadSavedActivityRowsForAccount_')}
  ${extractFunction(activitySource, 'investmentActivityMergePreviewAcceptedActivity_')}
  ${extractFunction(activitySource, 'investmentActivityBuildRobinhoodPortfolioComparisonPreview_')}
  ${extractFunction(activitySource, 'investmentActivityLatestHoldingsAsOfDate_')}
  ${extractFunction(activitySource, 'investmentActivityRobinhoodPortfolioHadPriorHoldings_')}
  ${extractFunction(activitySource, 'investmentActivityNormalizePortfolioComparisonNumber_')}
  ${extractFunction(activitySource, 'investmentActivityBuildRobinhoodPortfolioComparisonForDrawer_')}
  ${extractFunction(activitySource, 'investmentActivityReadRobinhoodPortfolioComparison_')}
  ${extractFunction(activitySource, 'investmentActivityWriteRobinhoodPortfolioComparison_')}
  function ensureInvestmentPortfolioComparisonsSheet_(ss) {
    if (!ss.__comparisonRows) ss.__comparisonRows = [];
    return {
      getLastRow: function() { return ss.__comparisonRows.length + 1; },
      getRange: function(startRow, startCol, numRows, numCols) {
        return {
          getValues: function() {
            return ss.__comparisonRows.slice(startRow - 2, startRow - 2 + numRows);
          },
          getDisplayValues: function() {
            return ss.__comparisonRows.slice(startRow - 2, startRow - 2 + numRows)
              .map(function(row) { return row.slice(startCol - 1, startCol - 1 + numCols); });
          },
          setValues: function(values) {
            values.forEach(function(row, index) {
              ss.__comparisonRows[startRow - 2 + index] = row.slice();
            });
          }
        };
      }
    };
  }
  function fitInvestmentSystemSheetColumns_() {}
  var Session = { getScriptTimeZone: function() { return 'UTC'; } };
  var Utilities = {
    formatDate: function(date, _tz, pattern) {
      var d = date instanceof Date ? date : new Date(date);
      if (pattern === 'yyyy-MM-dd HH:mm:ss') {
        return d.toISOString().slice(0, 19).replace('T', ' ');
      }
      return d.toISOString().slice(0, 10);
    }
  };
`, activityContext, { filename: 'investment_activity_comparison_partial.js' });

function buildFakeActivitySheet(rows) {
  return {
    getLastRow: function() { return rows.length + 1; },
    getRange: function(startRow, startCol, numRows) {
      return {
        getValues: function() { return rows.slice(startRow - 2, startRow - 2 + numRows); }
      };
    }
  };
}

function buildFakeRobinhoodWorkbook(config) {
  config = config || {};
  var investmentId = String(config.investmentId || 'inv-robinhood');
  return {
    __holdingsByInvestmentId: config.holdingsByInvestmentId || Object.create(null),
    getSheetByName: function(name) {
      if (name === getSheetNames_().INVESTMENT_HOLDINGS) {
        return buildFakeActivitySheet([]);
      }
      if (name === getSheetNames_().INVESTMENT_ACTIVITY) {
        return buildFakeActivitySheet(config.activityRows || []);
      }
      return null;
    }
  };
}

const robinhoodInvestmentId = 'inv-robinhood';
const baselineHoldings = [{
  ticker: 'AAPL',
  quantity: 10,
  lastActivityPrice: 100
}];
const baselineWorkbook = {
  __holdingsByInvestmentId: {
    [robinhoodInvestmentId]: baselineHoldings
  },
  getSheetByName: function(name) {
    if (name === 'Investment Activity') {
      return buildFakeActivitySheet([[
        'KEY-1', robinhoodInvestmentId, 'Samer Robinhood', '2026-08-01', '',
        'AAPL', 'BUY', 10, 100, 1000, 'No', '', 'ROBINHOOD_CSV', '2026-08-01 12:00:00'
      ]]);
    }
    return null;
  }
};
activityContext.getSheetNames_ = function() {
  return {
    INVESTMENT_ACTIVITY: 'Investment Activity',
    INVESTMENT_HOLDINGS: 'Investment Holdings',
    INVESTMENT_PORTFOLIO_COMPARISONS: 'Investment Portfolio Comparisons'
  };
};
activityContext.getInvestmentHoldingsSummary_ = function(ss, investmentId) {
  return (ss.__holdingsByInvestmentId && ss.__holdingsByInvestmentId[investmentId]) || [];
};

const noBaselineComparison = activityContext.investmentActivityBuildRobinhoodPortfolioComparisonPreview_(
  { __holdingsByInvestmentId: {}, getSheetByName: function() { return buildFakeActivitySheet([]); } },
  robinhoodInvestmentId,
  []
);
assert.equal(noBaselineComparison.status, 'NO_BASELINE');
assert.equal(noBaselineComparison.label, 'Change from current portfolio');

const unchangedComparison = activityContext.investmentActivityBuildRobinhoodPortfolioComparisonPreview_(
  baselineWorkbook,
  robinhoodInvestmentId,
  [{
    importKey: 'KEY-1',
    activityDate: '2026-08-01',
    ticker: 'AAPL',
    activityType: 'BUY',
    quantity: 10,
    price: 100,
    amount: 1000
  }]
);
assert.equal(unchangedComparison.status, 'UNCHANGED');
assert.equal(unchangedComparison.marketValue.direction, 'flat');
assert.equal(unchangedComparison.currentPortfolioValue, 1000);

function investmentPortfolioFormatComparisonDeltaText_(deltaEntry, options) {
  options = options || {};
  if (!deltaEntry || !deltaEntry.direction) return '';
  var baselineLabel = String(options.baselineLabel || '').trim();
  var suffix = baselineLabel ? (' ' + baselineLabel) : '';
  if (deltaEntry.direction === 'flat') return 'No change' + suffix;
  var amount = Number(deltaEntry.delta) || 0;
  if (amount === 0) return '$0.00' + suffix;
  var sign = amount > 0 ? '+' : '-';
  return sign + '$' + Math.abs(amount).toFixed(2) + suffix;
}
assert.equal(
  investmentPortfolioFormatComparisonDeltaText_(
    { direction: 'flat', delta: 0 },
    { baselineLabel: 'vs previous statement · 2026-08-31' }),
  'No change vs previous statement · 2026-08-31'
);
assert.equal(
  investmentPortfolioFormatComparisonDeltaText_(
    { direction: 'up', delta: 100 },
    { baselineLabel: 'vs current portfolio' }),
  '+$100.00 vs current portfolio'
);

const increasedComparison = activityContext.investmentActivityBuildRobinhoodPortfolioComparisonPreview_(
  baselineWorkbook,
  robinhoodInvestmentId,
  [{
    importKey: 'KEY-2',
    activityDate: '2026-09-01',
    ticker: 'AAPL',
    activityType: 'BUY',
    quantity: 2,
    price: 100,
    amount: 200
  }]
);
assert.equal(increasedComparison.status, 'HAS_DELTA');
assert.equal(increasedComparison.marketValue.delta, 200);
assert.equal(increasedComparison.marketValue.direction, 'up');

const decreasedComparison = activityContext.investmentActivityBuildRobinhoodPortfolioComparisonPreview_(
  baselineWorkbook,
  robinhoodInvestmentId,
  [{
    importKey: 'KEY-3',
    activityDate: '2026-09-02',
    ticker: 'AAPL',
    activityType: 'SELL',
    quantity: 4,
    price: 100,
    amount: -400
  }]
);
assert.equal(decreasedComparison.status, 'HAS_DELTA');
assert.equal(decreasedComparison.marketValue.delta, -400);
assert.equal(decreasedComparison.marketValue.direction, 'down');

const isolatedComparison = activityContext.investmentActivityBuildRobinhoodPortfolioComparisonPreview_(
  baselineWorkbook,
  'inv-other',
  []
);
assert.equal(isolatedComparison.status, 'NO_BASELINE');

function investmentPortfolioRobinhoodCsvPreviewActive_(state, selectedInvestmentId) {
  state = state || {};
  var previewInvestmentId = String(state.investmentId || '').trim();
  selectedInvestmentId = String(selectedInvestmentId || '').trim();
  return !!(state.preview && previewInvestmentId && previewInvestmentId === selectedInvestmentId);
}
function investmentActivityImportHasUnsavedPreview_(state, selectedInvestmentId) {
  state = state || {};
  if (!String(state.rawCsv || '').trim() || !String(state.digest || '').trim()) return false;
  return investmentPortfolioRobinhoodCsvPreviewActive_(state, selectedInvestmentId);
}
function simulateClearInvestmentActivityImport_(state) {
  return {
    rawCsv: '',
    digest: '',
    investmentId: '',
    cutoffDate: '',
    preview: null,
    tickerDecisions: {}
  };
}
assert.equal(
  investmentPortfolioRobinhoodCsvPreviewActive_(
    { preview: { ok: true }, investmentId: 'inv-robinhood' }, 'inv-robinhood'),
  true
);
assert.equal(
  investmentPortfolioRobinhoodCsvPreviewActive_(
    { preview: { ok: true }, investmentId: 'inv-robinhood' }, 'inv-other'),
  false
);
assert.equal(investmentPortfolioRobinhoodCsvPreviewActive_({}, 'inv-robinhood'), false);

const unsavedPreviewState = {
  rawCsv: 'Activity Date,Instrument',
  digest: 'abc123',
  investmentId: 'inv-robinhood',
  preview: { summary: { acceptedCount: 10 } }
};
assert.equal(
  investmentActivityImportHasUnsavedPreview_(unsavedPreviewState, 'inv-robinhood'),
  true,
  'unsaved preview on the selected account must require discard confirmation'
);
assert.equal(
  investmentActivityImportHasUnsavedPreview_(unsavedPreviewState, 'inv-other'),
  false,
  'preview tied to another account must not block switching away'
);
const clearedAfterSave = simulateClearInvestmentActivityImport_({
  rawCsv: unsavedPreviewState.rawCsv,
  digest: unsavedPreviewState.digest,
  investmentId: unsavedPreviewState.investmentId,
  preview: unsavedPreviewState.preview,
  tickerDecisions: { QQQ: 'INCLUDE' }
});
assert.equal(clearedAfterSave.rawCsv, '');
assert.equal(clearedAfterSave.preview, null);
assert.equal(
  investmentActivityImportHasUnsavedPreview_(clearedAfterSave, 'inv-robinhood'),
  false,
  'successful save must clear preview state so account switching stays silent'
);
assert.equal(
  investmentActivityImportHasUnsavedPreview_(
    { rawCsv: 'Activity Date', digest: '', preview: { ok: true }, investmentId: 'inv-robinhood' },
    'inv-robinhood'
  ),
  false,
  'preview without digest must not count as unsaved import state'
);

const comparisonWorkbook = {
  __comparisonRows: [],
  getSheetByName: function(name) {
    if (name !== 'Investment Portfolio Comparisons') return null;
    var rows = this.__comparisonRows;
    return {
      getLastRow: function() { return rows.length + 1; },
      getRange: function(startRow, startCol, numRows, numCols) {
        return {
          getValues: function() {
            return rows.slice(startRow - 2, startRow - 2 + numRows);
          },
          getDisplayValues: function() {
            return rows.slice(startRow - 2, startRow - 2 + numRows)
              .map(function(row) { return row.slice(startCol - 1, startCol - 1 + numCols); });
          },
          setValues: function(values) {
            values.forEach(function(row, index) {
              rows[startRow - 2 + index] = row.slice();
            });
          }
        };
      }
    };
  }
};
assert.equal(
  activityContext.investmentActivityBuildRobinhoodPortfolioComparisonForDrawer_(null).status,
  'NO_PRIOR',
  'first Robinhood import has no saved comparison'
);
assert.equal(
  activityContext.investmentActivityRobinhoodPortfolioHadPriorHoldings_([], { holdingsCount: 0 }),
  false
);
activityContext.investmentActivityWriteRobinhoodPortfolioComparison_(comparisonWorkbook, {
  investmentId: 'inv-robinhood',
  accountName: 'Samer Robinhood',
  comparisonDate: '2026-09-11',
  priorAsOfDate: '2026-08-31',
  priorMarketValue: 1000,
  currentMarketValue: 1500,
  priorHoldingsCount: 2,
  currentHoldingsCount: 3,
  priorCash: null,
  currentCash: null,
  importDigest: 'digest-2'
});
const savedComparison = activityContext.investmentActivityBuildRobinhoodPortfolioComparisonForDrawer_(
  activityContext.investmentActivityReadRobinhoodPortfolioComparison_(comparisonWorkbook, 'inv-robinhood')
);
assert.equal(savedComparison.status, 'HAS_DELTA');
assert.equal(savedComparison.marketValue.delta, 500);
assert.equal(savedComparison.marketValue.direction, 'up');
assert.equal(savedComparison.holdingsCount.delta, 1);
assert.equal(savedComparison.portfolioValue, 1500);
assert.equal(
  activityContext.investmentActivityReadRobinhoodPortfolioComparison_(comparisonWorkbook, 'inv-other'),
  null,
  'comparison metadata must stay isolated by investmentId'
);
activityContext.investmentActivityWriteRobinhoodPortfolioComparison_(comparisonWorkbook, {
  investmentId: 'inv-robinhood',
  accountName: 'Samer Robinhood',
  comparisonDate: '2026-10-01',
  priorMarketValue: 1500,
  currentMarketValue: 1200,
  priorHoldingsCount: 3,
  currentHoldingsCount: 3,
  importDigest: 'digest-3'
});
const decreasedSaved = activityContext.investmentActivityBuildRobinhoodPortfolioComparisonForDrawer_(
  activityContext.investmentActivityReadRobinhoodPortfolioComparison_(comparisonWorkbook, 'inv-robinhood')
);
assert.equal(decreasedSaved.marketValue.direction, 'down');
assert.equal(decreasedSaved.marketValue.delta, -300);
activityContext.investmentActivityWriteRobinhoodPortfolioComparison_(comparisonWorkbook, {
  investmentId: 'inv-robinhood',
  accountName: 'Samer Robinhood',
  comparisonDate: '2026-10-15',
  priorMarketValue: 1200,
  currentMarketValue: 1200,
  priorHoldingsCount: 3,
  currentHoldingsCount: 3,
  importDigest: 'digest-4'
});
const unchangedSaved = activityContext.investmentActivityBuildRobinhoodPortfolioComparisonForDrawer_(
  activityContext.investmentActivityReadRobinhoodPortfolioComparison_(comparisonWorkbook, 'inv-robinhood')
);
assert.equal(unchangedSaved.status, 'UNCHANGED');
assert.equal(unchangedSaved.marketValue.direction, 'flat');
assert.equal(comparisonWorkbook.__comparisonRows.length, 1, 'comparison storage keeps one row per investmentId');

assert.equal(firstStatementView.partitions[0].marketValueTotal, 1000, 'existing M1 card values remain unchanged');

const exactDelta = context.investmentPortfolioDrawerComputeNumericDelta_(1100.005, 1000.004);
assert.ok(Math.abs(exactDelta - 100.001) < 1e-9, 'delta uses exact numeric comparison before rounding');

const roadmap = read('ROADMAP.md');
assert.match(roadmap, /Cisco Statement — RSU\/ESPP \+ Future/);
assert.match(roadmap, /BROKERAGE_ACCOUNT_VALUE/);
assert.match(roadmap, /POTENTIAL_UNVESTED_STOCK_PLAN/);
assert.match(roadmap, /8\/31\/26/);
assert.match(roadmap, /pdf\.js/);
assert.match(roadmap, /Grant-detail \$0 values/);
assert.match(roadmap, /standalone Cisco picker entries were removed/);
assert.match(roadmap, /Central no-write runtime validation passed with the real statement/);
assert.match(roadmap, /Apply writes only `INPUT - Investments`/);
assert.match(roadmap, /LOG - Activity/);
assert.match(roadmap, /Samer Etrade Account/);
assert.match(roadmap, /Central runtime validation still needed/);
assert.match(roadmap, /Laith 529/);
assert.match(roadmap, /Lutfi 529/);
assert.match(roadmap, /Lutfi Etrade Account/);
assert.match(roadmap, /Lutfi Robinhood/);
assert.match(roadmap, /any account without a reliable supported export/);
assert.doesNotMatch(roadmap, /Samer Etrade Account import support is complete/);

console.log('Investment portfolio drawer regressions passed.');
