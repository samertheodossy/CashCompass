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
const drawer401kSource = read('Dashboard_Script_InvestmentPortfolioDrawer401k.html');
const webappSource = read('webapp.js');
const drawerSource = read('investment_portfolio_drawer.js');
const activitySource = read('investment_activity.js');
const configSource = read('config.js');
const investmentsSource = read('investments.js');

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
  ${extractFunction(drawerSource, 'investmentPortfolioDrawerProviderLabel_')}
  ${extractFunction(drawerSource, 'investmentPortfolioDrawerMatchGroupProvider_')}
  ${extractFunction(drawerSource, 'investmentPortfolioDrawerIs401kRetirementAccount_')}
  ${extractFunction(drawerSource, 'investmentPortfolioDrawerInferProvider_')}
  ${extractFunction(drawerSource, 'investmentPortfolioDrawerMapAccountRow_')}
  ${extractFunction(drawerSource, 'investmentPortfolioDrawerRobinhoodImportEligible_')}
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
    var investmentId = String(row.investmentId || '').trim();
    var pickerValue = investmentId || ('__row__:' + String(row.sysAssetsRow));
    return {
      accountName: String(row.accountName || '').trim(),
      pickerValue: pickerValue,
      investmentId: investmentId,
      planningPurpose: String(row.planningPurpose || '').trim()
    };
  });
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
assert.match(activitySource, /function resolveEligibleInvestmentImportAccount_/);

// --- Active account list includes all five active accounts, excludes inactive ---
const drawerList = simulateDrawerAccountList(fixtureAccounts);
assert.equal(drawerList.length, 5, 'drawer must list all five active investment accounts');
assert.deepEqual(
  drawerList.map((row) => row.accountName).sort(),
  [
    '401K Account',
    'Charles Schwab - Personal',
    'Etrade Cisco - Future',
    'Etrade Cisco - RSU/ESPP',
    'Samer Robinhood'
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
  4,
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

// --- Provider metadata: explicit broker names only; ambiguous names stay unknown ---
assert.equal(
  context.investmentPortfolioDrawerInferProvider_('Charles Schwab - Personal', null),
  'SCHWAB'
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

// --- No workbook writes in drawer module ---
assert.doesNotMatch(drawerSource, /\bsetValues\b|\bappendRow\b|\bsetValue\b/);

// --- Unified drawer UX ---
assert.doesNotMatch(dashboardBody, /id="inv_holdings_preview_btn"/);
assert.doesNotMatch(dashboardBody, /Preview holdings \(PDF\)/);
assert.match(dashboardBody, /Import M1 statement PDF/);
assert.match(dashboardBody, /inv_portfolio_m1_import_view/);
assert.match(dashboardBody, /CashCompass investment account/);
assert.match(dashboardBody, /view portfolio holdings and import statements when available/);
assert.doesNotMatch(dashboardBody, /update recurring plans/);
assert.match(drawerM1Source, /boundedHoldingsPreviewRunFromDashboard/);
assert.match(drawerM1Source, /boundedHoldingsPreviewRunGroupedChildFromDashboard/);
assert.match(drawerM1Source, /boundedHoldingsPreviewBuildApplyDiffFromDashboard/);
assert.match(drawerM1Source, /boundedHoldingsPreviewBuildGroupedApplyDiffFromDashboard/);
assert.match(drawerM1Source, /boundedHoldingsPreviewApplyFromDashboard/);
assert.match(drawerM1Source, /boundedHoldingsPreviewApplyGroupedFromDashboard/);
assert.match(drawerSource, /m1ImportAvailable/);
assert.match(drawerSource, /parentAggregateExcluded/);
assert.match(drawerSource, /fidelity401kImportAvailable/);
assert.match(drawerSource, /FIDELITY_401K_BALANCE/);
assert.match(drawerSource, /previewFidelity401kStatementFromDashboard/);
assert.match(drawerSource, /Retirement savings statement PDF/);
assert.match(dashboardBody, /inv_portfolio_401k_import_view/);
assert.match(dashboardBody, /Retirement savings statement PDF/);
assert.match(dashboardInvestments, /renderInvestmentPortfolio401kBalanceView_/);
assert.match(dashboardInvestments, /investmentPortfolioRender401kBalanceComparison_/);
assert.match(dashboardInvestments, /Change in reported balance/);
assert.match(drawer401kSource, /previewFidelity401kStatementFromDashboard/);
assert.doesNotMatch(drawer401kSource, /boundedHoldingsPreviewApplyFromDashboard/);
assert.doesNotMatch(drawer401kSource, /\bsetValues\b|\bappendRow\b/);
assert.match(webappSource, /view === 'portfolio-holdings-preview' && !isCentralModeEnabled_\(\)/);
assert.doesNotMatch(drawerM1Source, /\bsetValues\b|\bappendRow\b/);

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

console.log('Investment portfolio drawer regressions passed.');
