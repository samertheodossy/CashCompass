function writeRecommendations_(ss, summary) {
  let sheet;

  try {
    sheet = getSheet_(ss, 'DASHBOARD');
  } catch (e) {
    sheet = ss.insertSheet(getSheetNames_().DASHBOARD);
  }

  sheet.clearContents();
  sheet.clearFormats();

  const existingFilter = sheet.getFilter();
  if (existingFilter) existingFilter.remove();

  // Previously we tore down every Dashboard chart here and rebuilt all
  // six below on every planner run. `insertChart` is slow in Apps Script
  // web-app contexts (often seconds per chart), so that made
  // Run Planner Now unnecessarily long. The per-chart builders below
  // now keep an existing chart in place when its bound range + title
  // still match the desired chart — charts auto-repaint from the fresh
  // setValues we write into their ranges, so no rebuild is needed when
  // the range shape hasn't changed. When the range shape DID change
  // (e.g. a new history row appended, new active credit cards), the
  // specific stale chart is removed and re-inserted inside its builder.
  // We intentionally no longer call removeAllCharts_(sheet) here so
  // (a) the fast path skips all chart work, and (b) any chart the user
  // manually added to the Dashboard sheet is preserved.

  const rows = [];

  rows.push(['Debt Planner Dashboard']);
  rows.push(['']);

  rows.push(['Visual Summary']);
  rows.push(['Charts are shown below the dashboard tables.']);
  rows.push(['']);

  rows.push(['Action Plan']);
  summary.actionPlan.forEach(function(line) { rows.push([line]); });
  rows.push(['']);

  rows.push(['Executive Summary']);
  summary.executiveSummary.forEach(function(line) { rows.push([line]); });
  rows.push(['']);

  rows.push(['Liquidity vs Debt']);
  rows.push(['Metric', 'Value']);
  rows.push(['Usable Cash After Buffers', summary.liquiditySummary.usableCashAfterBuffers]);
  rows.push(['Active Credit Card Debt', summary.liquiditySummary.activeCardDebt]);
  rows.push(['Months of Minimum Coverage', summary.liquiditySummary.monthsOfMinimumCoverage]);
  rows.push(['Cash to Card Debt Ratio', summary.liquiditySummary.cashToCardDebtRatio]);
  rows.push(['Upcoming Pay Window Coverage', summary.liquiditySummary.payWindowCoverage]);
  rows.push(['']);

  rows.push(['Assets & Liabilities Summary']);
  rows.push(['Metric', 'Value']);
  rows.push(['Total Financial Assets', summary.assetSummary.totalAssets]);
  rows.push(['Brokerage Assets', summary.assetSummary.brokerage]);
  rows.push(['Retirement Assets', summary.assetSummary.retirement]);
  rows.push(['Education Assets', summary.assetSummary.education]);
  rows.push(['Total Real Estate Assets', summary.houseAssetSummary.totalRealEstateValue]);
  rows.push(['Estimated Real Estate Equity', summary.houseAssetSummary.totalRealEstateEquity]);
  rows.push(['Total Assets', summary.totalAssets]);
  rows.push(['Total Liabilities', summary.liabilitySummary.totalLiabilities]);
  rows.push(['Credit Card Debt', summary.liabilitySummary.creditCards]);
  rows.push(['Loan Debt', summary.liabilitySummary.loans]);
  rows.push(['HELOC Debt', summary.liabilitySummary.heloc]);
  rows.push(['Other Obligations', summary.liabilitySummary.other]);
  rows.push(['Net Worth', summary.netWorth]);
  rows.push(['']);

  rows.push(['Key Metrics']);
  rows.push(['Metric', 'Value']);
  rows.push(['Run Date', summary.runDate]);
  rows.push(['Month', summary.monthHeader]);
  rows.push(['Mode', summary.mode]);
  rows.push(['Monthly Stability', summary.stability.label]);
  rows.push(['Projected Income This Month', summary.projectedIncome]);
  rows.push(['Projected Expenses This Month', summary.projectedExpenses]);
  rows.push(['Projected Cash Flow This Month', summary.thisMonthCashFlow]);
  rows.push(['Previous Month Cash Flow', summary.previousMonthCashFlow]);
  rows.push(['Month-over-Month Cash Flow Change', summary.monthChange]);
  rows.push(['Total Usable Cash Now', summary.totalUsableCashNow]);
  rows.push(['Total Protected Buffers', summary.totalProtectedBuffers]);
  rows.push(['Usable Cash After Buffers', summary.usableCashAfterBuffers]);
  rows.push(['Total Minimum Payments', summary.minimumDueTotal]);
  rows.push(['Total Active Credit Card Debt', summary.totalActiveCreditCardDebt]);
  rows.push(['Minimums Due Now', summary.payNowMinimumTotal]);
  rows.push(['Minimums Due Soon', summary.paySoonMinimumTotal]);
  rows.push(['Suggested Extra Payment This Cycle', summary.suggestedExtraPayment]);
  rows.push(['Recommended Total To Pay Now', summary.recommendedTotalToPayNow]);
  rows.push(['Estimated Annual Interest Savings', summary.recommendation ? summary.recommendation.annualInterestSavingsEstimate : 0]);
  rows.push(['Estimated Months To Pay Off Target', summary.recommendation ? summary.recommendation.estimatedMonthsToPayOffTarget : 'N/A']);
  rows.push(['Estimated Months To Pay Off All Cards', summary.recommendation ? summary.recommendation.estimatedMonthsToPayOffAllCards : 'N/A']);
  rows.push(['Next Target After This', summary.recommendation && summary.recommendation.nextTargetAfterThis ? summary.recommendation.nextTargetAfterThis.account : 'None']);
  rows.push(['']);

  rows.push(['Asset Breakdown']);
  rows.push(['Account', 'Type', 'Value']);
  if (summary.assets.length === 0) rows.push(['None', '', '']);
  else summary.assets.forEach(function(a) { rows.push([a.name, a.type, a.value]); });
  rows.push(['']);

  rows.push(['Real Estate Breakdown']);
  rows.push(['House', 'Loan Amount Left', 'Current Value', 'Estimated Equity']);
  if (summary.houseAssets.length === 0) rows.push(['None', '', '', '']);
  else summary.houseAssets.forEach(function(h) { rows.push([h.house, h.loanAmountLeft, h.currentValue, h.estimatedEquity]); });
  rows.push(['']);

  rows.push(['Cash Flow Change Breakdown']);
  rows.push(['Type', 'Payee', summary.previousMonthHeader + ' Amount', summary.monthHeader + ' Amount', 'Delta']);
  if (summary.cashFlowBreakdown.length === 0) rows.push(['None', '', '', '', '']);
  else summary.cashFlowBreakdown.forEach(function(x) { rows.push([x.type, x.payee, x.previousAmount, x.currentAmount, x.delta]); });
  rows.push(['']);

  rows.push(['Pay Now']);
  rows.push(['Account', 'Type', 'Due Date', 'Days Until Due', 'Minimum Payment', 'Balance', 'APR']);
  if (summary.payNow.length === 0) rows.push(['None', '', '', '', '', '', '']);
  else summary.payNow.forEach(function(p) { rows.push([p.account, p.type, p.dueDate, p.daysUntilDue, p.minimumPayment, p.balance, p.interestRate]); });
  rows.push(['']);

  rows.push(['Pay Soon']);
  rows.push(['Account', 'Type', 'Due Date', 'Days Until Due', 'Minimum Payment', 'Balance', 'APR']);
  if (summary.paySoon.length === 0) rows.push(['None', '', '', '', '', '', '']);
  else summary.paySoon.forEach(function(p) { rows.push([p.account, p.type, p.dueDate, p.daysUntilDue, p.minimumPayment, p.balance, p.interestRate]); });
  rows.push(['']);

  rows.push(['Other Obligations']);
  rows.push(['Account', 'Type', 'Minimum Payment', 'Balance', 'APR']);
  if (summary.otherObligations.length === 0) rows.push(['None', '', '', '', '']);
  else summary.otherObligations.forEach(function(d) { rows.push([d.name, d.type, d.minimumPayment, d.balance, d.interestRate]); });
  rows.push(['']);

  rows.push(['Recommendation']);
  rows.push(['Strategy', 'Target Account', 'Target Type', 'Target APR', 'Target Balance', 'Suggested Extra Payment', 'Annual Interest Savings', 'Months To Pay Off Target', 'Months To Pay Off All Cards', 'Next Target', 'Reason']);
  if (summary.recommendation) {
    rows.push([
      summary.recommendation.strategy,
      summary.recommendation.targetAccount,
      summary.recommendation.targetType,
      summary.recommendation.targetAPR,
      summary.recommendation.targetBalance,
      summary.recommendation.suggestedExtraPayment,
      summary.recommendation.annualInterestSavingsEstimate,
      summary.recommendation.estimatedMonthsToPayOffTarget,
      summary.recommendation.estimatedMonthsToPayOffAllCards,
      summary.recommendation.nextTargetAfterThis ? summary.recommendation.nextTargetAfterThis.account : 'None',
      summary.recommendation.reason
    ]);
  } else {
    rows.push(['None', '', '', '', '', 0, 0, 'N/A', 'N/A', 'None', 'No recommendation generated.']);
  }
  rows.push(['']);

  rows.push(['Top Debt Targets']);
  rows.push(['Account', 'Type', 'Balance', 'APR', 'Minimum Payment']);
  if (summary.topDebtTargets.length === 0) rows.push(['None', '', '', '', '']);
  else summary.topDebtTargets.forEach(function(d) { rows.push([d.name, d.type, d.balance, d.interestRate, d.minimumPayment]); });
  rows.push(['']);

  rows.push(['Warnings']);
  if (summary.warnings.length === 0) rows.push(['None']);
  else summary.warnings.forEach(function(w) { rows.push([w]); });
  rows.push(['']);

  rows.push(['Notes']);
  if (summary.notes.length === 0) rows.push(['None']);
  else summary.notes.forEach(function(n) { rows.push([n]); });

  const width = Math.max.apply(null, rows.map(function(r) { return r.length; }));
  const normalizedRows = rows.map(function(r) {
    const copy = r.slice();
    while (copy.length < width) copy.push('');
    return copy;
  });

  sheet.getRange(1, 1, normalizedRows.length, width).setValues(normalizedRows);
  formatRecommendationsSheet_(sheet, normalizedRows);
  writeDashboardChartDataAndBuildCharts_(ss, sheet, summary);
}

function removeAllCharts_(sheet) {
  const charts = sheet.getCharts();
  charts.forEach(function(chart) {
    sheet.removeChart(chart);
  });
}

function writeDashboardChartDataAndBuildCharts_(ss, dashboardSheet, summary) {
  const historySheet = ensureHistorySheet_(ss);

  const startCol = 15; // O
  const maxRows = dashboardSheet.getMaxRows();
  const maxCols = dashboardSheet.getMaxColumns();

  if (maxCols < startCol + 12) {
    dashboardSheet.insertColumnsAfter(maxCols, (startCol + 12) - maxCols);
  }

  dashboardSheet.getRange(1, startCol, maxRows, 12).clearContent();

  writeDashboardTrendTable_(historySheet, dashboardSheet, startCol);
  writeDashboardSnapshotTables_(dashboardSheet, summary, startCol + 5);

  const anchorRow = dashboardSheet.getLastRow() + 3;

  buildDashboardNetWorthChart_(dashboardSheet, startCol, anchorRow);
  buildDashboardCashFlowChart_(dashboardSheet, startCol + 3, anchorRow + 18);
  buildDashboardAssetsVsLiabilitiesChart_(dashboardSheet, startCol + 5, anchorRow);
  buildDashboardAssetAllocationChart_(dashboardSheet, startCol + 5, anchorRow + 18);
  buildDashboardLiabilityBreakdownChart_(dashboardSheet, startCol + 5, anchorRow + 36);
  buildDashboardCreditCardPaydownChart_(dashboardSheet, startCol + 5, anchorRow + 54);
}

function writeDashboardTrendTable_(historySheet, dashboardSheet, startCol) {
  const values = historySheet.getDataRange().getValues();
  if (values.length < 2) return;

  const headers = values[0];
  const runDateIdx = headers.indexOf('Run Date');
  const netWorthIdx = headers.indexOf('Net Worth');
  const cashFlowIdx = headers.indexOf('Projected Cash Flow');
  const prevCashFlowIdx = headers.indexOf('Previous Month Cash Flow');

  const out1 = [['Run Label', 'Net Worth']];
  const out2 = [['Run Label', 'Projected Cash Flow', 'Previous Month Cash Flow']];

  for (let r = 1; r < values.length; r++) {
    const label = buildRunLabel_(values[r][runDateIdx], r);
    out1.push([label, toNumber_(values[r][netWorthIdx])]);
    out2.push([
      label,
      toNumber_(values[r][cashFlowIdx]),
      toNumber_(values[r][prevCashFlowIdx])
    ]);
  }

  dashboardSheet.getRange(1, startCol, out1.length, 2).setValues(out1);
  dashboardSheet.getRange(1, startCol + 3, out2.length, 3).setValues(out2);
  dashboardSheet.getRange(1, startCol, out1.length, 1).setNumberFormat('@STRING@');
  dashboardSheet.getRange(1, startCol + 3, out2.length, 1).setNumberFormat('@STRING@');
}

function writeDashboardSnapshotTables_(dashboardSheet, summary, startCol) {
  const assetVsLiability = [
    ['Metric', 'Value'],
    ['Total Assets', summary.totalAssets],
    ['Total Liabilities', summary.liabilitySummary.totalLiabilities],
    ['Net Worth', summary.netWorth]
  ];
  dashboardSheet.getRange(1, startCol, assetVsLiability.length, 2).setValues(assetVsLiability);

  const assetAllocation = [
    ['Asset Type', 'Value'],
    ['Brokerage Assets', summary.assetSummary.brokerage],
    ['Retirement Assets', summary.assetSummary.retirement],
    ['Education Assets', summary.assetSummary.education],
    ['Real Estate Assets', summary.houseAssetSummary.totalRealEstateValue]
  ];
  dashboardSheet.getRange(8, startCol, assetAllocation.length, 2).setValues(assetAllocation);

  const liabilityBreakdown = [
    ['Liability Type', 'Value'],
    ['Credit Card Debt', summary.liabilitySummary.creditCards],
    ['Loan Debt', summary.liabilitySummary.loans],
    ['HELOC Debt', summary.liabilitySummary.heloc],
    ['Other Obligations', summary.liabilitySummary.other]
  ];
  dashboardSheet.getRange(15, startCol, liabilityBreakdown.length, 2).setValues(liabilityBreakdown);

  const creditCardRows = [['Account', 'Balance']];
  summary.topDebtTargets
    .filter(function(d) { return d.type === 'Credit Card'; })
    .forEach(function(d) {
      creditCardRows.push([d.name, d.balance]);
    });

  if (creditCardRows.length === 1) {
    creditCardRows.push(['No Active Cards', 0]);
  }

  dashboardSheet.getRange(22, startCol, creditCardRows.length, 2).setValues(creditCardRows);
}

// --------------------------------------------------------------------------
// Dashboard chart reuse helpers
//
// The six Dashboard chart builders below used to call insertChart() on
// every planner run. insertChart() is slow in Apps Script web-app
// contexts, so repeat runs paid that cost unnecessarily. We now key
// existing charts by their configured title (each of the six has a
// distinct, stable title) and compare their first bound range to the
// range we would build fresh. When both match, the existing chart is
// left in place — Apps Script auto-repaints it from the fresh
// setValues() we write into its range, so values stay current without
// any insertChart cost. When they differ (e.g. a new history row
// extended the NetWorth/CashFlow range, or active-card count changed
// for the Credit Card chart), the specific stale chart is removed and
// a replacement is inserted.
//
// Only Dashboard charts use these helpers. buildHistoryCharts_ still
// uses removeAllCharts_(historySheet) and is intentionally unchanged
// in this pass.
// --------------------------------------------------------------------------

function findDashboardChartByTitle_(sheet, title) {
  const target = String(title || '');
  if (!target) return null;
  const charts = sheet.getCharts();
  for (let i = 0; i < charts.length; i++) {
    let existingTitle = '';
    try {
      const opts = charts[i].getOptions();
      existingTitle = opts ? String(opts.get('title') || '') : '';
    } catch (_e) {
      // Older charts may not expose options; treat as "no match" and
      // fall through to rebuild rather than silently keep a wrong chart.
    }
    if (existingTitle === target) return charts[i];
  }
  return null;
}

function getDashboardChartFirstRangeA1_(chart) {
  try {
    const ranges = chart.getRanges();
    if (!ranges || !ranges.length) return '';
    return ranges[0].getA1Notation();
  } catch (_e) {
    return '';
  }
}

function dashboardChartAlreadyMatches_(sheet, title, desiredRangeA1) {
  const existing = findDashboardChartByTitle_(sheet, title);
  if (!existing) return false;
  return getDashboardChartFirstRangeA1_(existing) === desiredRangeA1;
}

function removeDashboardChartByTitle_(sheet, title) {
  const existing = findDashboardChartByTitle_(sheet, title);
  if (existing) sheet.removeChart(existing);
}

function buildDashboardNetWorthChart_(sheet, startCol, posRow) {
  const numRows = findLastNonEmptyRowInRange_(sheet, 1, startCol, 500);
  const range = sheet.getRange(1, startCol, Math.max(2, numRows), 2);
  const title = 'Net Worth by Run';
  if (dashboardChartAlreadyMatches_(sheet, title, range.getA1Notation())) return;
  removeDashboardChartByTitle_(sheet, title);
  const chart = sheet.newChart()
    .setChartType(Charts.ChartType.LINE)
    .addRange(range)
    .setOption('title', title)
    .setOption('legend', { position: 'bottom' })
    .setOption('useFirstColumnAsDomain', true)
    .setOption('curveType', 'function')
    .setPosition(posRow, 1, 0, 0)
    .build();
  sheet.insertChart(chart);
}

function buildDashboardCashFlowChart_(sheet, startCol, posRow) {
  const numRows = findLastNonEmptyRowInRange_(sheet, 1, startCol, 500);
  const range = sheet.getRange(1, startCol, Math.max(2, numRows), 3);
  const title = 'Cash Flow by Run (Blue=Projected, Red=Previous Month)';
  if (dashboardChartAlreadyMatches_(sheet, title, range.getA1Notation())) return;
  removeDashboardChartByTitle_(sheet, title);
  const chart = sheet.newChart()
    .setChartType(Charts.ChartType.LINE)
    .addRange(range)
    .setOption('title', title)
    .setOption('legend', { position: 'bottom' })
    .setOption('useFirstColumnAsDomain', true)
    .setOption('curveType', 'function')
    .setPosition(posRow, 1, 0, 0)
    .build();
  sheet.insertChart(chart);
}

function buildDashboardAssetsVsLiabilitiesChart_(sheet, startCol, posRow) {
  const range = sheet.getRange(1, startCol, 4, 2);
  const title = 'Assets vs Liabilities vs Net Worth';
  if (dashboardChartAlreadyMatches_(sheet, title, range.getA1Notation())) return;
  removeDashboardChartByTitle_(sheet, title);
  const chart = sheet.newChart()
    .setChartType(Charts.ChartType.COLUMN)
    .addRange(range)
    .setOption('title', title)
    .setOption('legend', { position: 'none' })
    .setPosition(posRow, 8, 0, 0)
    .build();
  sheet.insertChart(chart);
}

function buildDashboardAssetAllocationChart_(sheet, startCol, posRow) {
  const range = sheet.getRange(8, startCol, 5, 2);
  const title = 'Asset Allocation';
  if (dashboardChartAlreadyMatches_(sheet, title, range.getA1Notation())) return;
  removeDashboardChartByTitle_(sheet, title);
  const chart = sheet.newChart()
    .setChartType(Charts.ChartType.PIE)
    .addRange(range)
    .setOption('title', title)
    .setOption('legend', { position: 'right' })
    .setPosition(posRow, 8, 0, 0)
    .build();
  sheet.insertChart(chart);
}

function buildDashboardLiabilityBreakdownChart_(sheet, startCol, posRow) {
  const range = sheet.getRange(15, startCol, 5, 2);
  const title = 'Liability Breakdown';
  if (dashboardChartAlreadyMatches_(sheet, title, range.getA1Notation())) return;
  removeDashboardChartByTitle_(sheet, title);
  const chart = sheet.newChart()
    .setChartType(Charts.ChartType.PIE)
    .addRange(range)
    .setOption('title', title)
    .setOption('legend', { position: 'right' })
    .setPosition(posRow, 8, 0, 0)
    .build();
  sheet.insertChart(chart);
}

function buildDashboardCreditCardPaydownChart_(sheet, startCol, posRow) {
  const lastRow = findLastNonEmptyRowInRange_(sheet, 22, startCol, 50);
  const numRows = Math.max(2, lastRow - 22 + 1);
  const range = sheet.getRange(22, startCol, numRows, 2);
  const title = 'Credit Card Balances';
  if (dashboardChartAlreadyMatches_(sheet, title, range.getA1Notation())) return;
  removeDashboardChartByTitle_(sheet, title);
  const chart = sheet.newChart()
    .setChartType(Charts.ChartType.BAR)
    .addRange(range)
    .setOption('title', title)
    .setOption('legend', { position: 'none' })
    .setPosition(posRow, 8, 0, 0)
    .build();
  sheet.insertChart(chart);
}

function buildHistoryCharts_(ss) {
  const historySheet = ensureHistorySheet_(ss);
  removeAllCharts_(historySheet);

  const values = historySheet.getDataRange().getValues();
  if (values.length < 2) return;

  const maxCols = historySheet.getMaxColumns();
  const startCol = 25; // Y
  if (maxCols < startCol + 30) {
    historySheet.insertColumnsAfter(maxCols, (startCol + 30) - maxCols);
  }

  const maxRows = historySheet.getMaxRows();
  historySheet.getRange(1, startCol, maxRows, 30).clearContent();

  writeHistoryChartTables_(historySheet, startCol);

  const anchorRow = historySheet.getLastRow() + 3;

  buildHistoryNetWorthChart_(historySheet, startCol, anchorRow);
  buildHistoryCashFlowChart_(historySheet, startCol + 5, anchorRow + 18);
  buildHistoryAssetsLiabilitiesChart_(historySheet, startCol + 10, anchorRow + 36);
  buildHistoryDebtTrendChart_(historySheet, startCol + 15, anchorRow + 54);
  buildHistoryPayNowTrendChart_(historySheet, startCol + 19, anchorRow + 72);
  buildHistoryMonthsToPayoffChart_(historySheet, startCol + 23, anchorRow + 90);
}

function writeHistoryChartTables_(historySheet, startCol) {
  const values = historySheet.getDataRange().getValues();
  const headers = values[0];

  const runDateIdx = headers.indexOf('Run Date');
  const netWorthIdx = headers.indexOf('Net Worth');
  const projectedCashFlowIdx = headers.indexOf('Projected Cash Flow');
  const prevCashFlowIdx = headers.indexOf('Previous Month Cash Flow');
  const totalAssetsIdx = headers.indexOf('Total Assets');
  const totalLiabilitiesIdx = headers.indexOf('Total Liabilities');
  const totalCardDebtIdx = headers.indexOf('Total Active Credit Card Debt');
  const totalMinimumsIdx = headers.indexOf('Total Minimum Payments');
  const suggestedExtraIdx = headers.indexOf('Suggested Extra Payment');
  const recommendedNowIdx = headers.indexOf('Recommended Total To Pay Now');
  const monthsTargetIdx = headers.indexOf('Estimated Months To Pay Off Target');
  const monthsAllIdx = headers.indexOf('Estimated Months To Pay Off All Cards');

  const trend1 = [['Run Label', 'Net Worth']];
  const trend2 = [['Run Label', 'Projected Cash Flow', 'Previous Month Cash Flow']];
  const trend3 = [['Run Label', 'Total Assets', 'Total Liabilities', 'Net Worth']];
  const trend4 = [['Run Label', 'Total Active Credit Card Debt', 'Total Minimum Payments']];
  const trend5 = [['Run Label', 'Suggested Extra Payment', 'Recommended Total To Pay Now']];
  const trend6 = [['Run Label', 'Months To Pay Off Target', 'Months To Pay Off All Cards']];

  for (let r = 1; r < values.length; r++) {
    const label = buildRunLabel_(values[r][runDateIdx], r);

    trend1.push([label, toNumber_(values[r][netWorthIdx])]);

    trend2.push([
      label,
      toNumber_(values[r][projectedCashFlowIdx]),
      toNumber_(values[r][prevCashFlowIdx])
    ]);

    trend3.push([
      label,
      toNumber_(values[r][totalAssetsIdx]),
      toNumber_(values[r][totalLiabilitiesIdx]),
      toNumber_(values[r][netWorthIdx])
    ]);

    trend4.push([
      label,
      toNumber_(values[r][totalCardDebtIdx]),
      toNumber_(values[r][totalMinimumsIdx])
    ]);

    trend5.push([
      label,
      toNumber_(values[r][suggestedExtraIdx]),
      toNumber_(values[r][recommendedNowIdx])
    ]);

    trend6.push([
      label,
      toNumber_(values[r][monthsTargetIdx]),
      toNumber_(values[r][monthsAllIdx])
    ]);
  }

  historySheet.getRange(1, startCol, trend1.length, 2).setValues(trend1);
  historySheet.getRange(1, startCol + 5, trend2.length, 3).setValues(trend2);
  historySheet.getRange(1, startCol + 10, trend3.length, 4).setValues(trend3);
  historySheet.getRange(1, startCol + 15, trend4.length, 3).setValues(trend4);
  historySheet.getRange(1, startCol + 19, trend5.length, 3).setValues(trend5);
  historySheet.getRange(1, startCol + 23, trend6.length, 3).setValues(trend6);

  historySheet.getRange(1, startCol, trend1.length, 1).setNumberFormat('@STRING@');
  historySheet.getRange(1, startCol + 5, trend2.length, 1).setNumberFormat('@STRING@');
  historySheet.getRange(1, startCol + 10, trend3.length, 1).setNumberFormat('@STRING@');
  historySheet.getRange(1, startCol + 15, trend4.length, 1).setNumberFormat('@STRING@');
  historySheet.getRange(1, startCol + 19, trend5.length, 1).setNumberFormat('@STRING@');
  historySheet.getRange(1, startCol + 23, trend6.length, 1).setNumberFormat('@STRING@');
}

function buildHistoryNetWorthChart_(sheet, startCol, posRow) {
  const rows = findLastNonEmptyRowInRange_(sheet, 1, startCol, 500);
  const chart = sheet.newChart()
    .setChartType(Charts.ChartType.LINE)
    .addRange(sheet.getRange(1, startCol, Math.max(2, rows), 2))
    .setOption('title', 'Net Worth by Run')
    .setOption('legend', { position: 'bottom' })
    .setOption('useFirstColumnAsDomain', true)
    .setOption('curveType', 'function')
    .setPosition(posRow, 1, 0, 0)
    .build();
  sheet.insertChart(chart);
}

function buildHistoryCashFlowChart_(sheet, startCol, posRow) {
  const rows = findLastNonEmptyRowInRange_(sheet, 1, startCol, 500);
  const chart = sheet.newChart()
    .setChartType(Charts.ChartType.LINE)
    .addRange(sheet.getRange(1, startCol, Math.max(2, rows), 3))
    .setOption('title', 'Cash Flow by Run (Blue=Projected, Red=Previous Month)')
    .setOption('legend', { position: 'bottom' })
    .setOption('useFirstColumnAsDomain', true)
    .setOption('curveType', 'function')
    .setPosition(posRow, 1, 0, 0)
    .build();
  sheet.insertChart(chart);
}

function buildHistoryAssetsLiabilitiesChart_(sheet, startCol, posRow) {
  const rows = findLastNonEmptyRowInRange_(sheet, 1, startCol, 500);
  const chart = sheet.newChart()
    .setChartType(Charts.ChartType.LINE)
    .addRange(sheet.getRange(1, startCol, Math.max(2, rows), 4))
    .setOption('title', 'Assets vs Liabilities vs Net Worth (Blue=Assets, Red=Liabilities, Yellow=Net Worth)')
    .setOption('legend', { position: 'bottom' })
    .setOption('useFirstColumnAsDomain', true)
    .setOption('curveType', 'function')
    .setPosition(posRow, 1, 0, 0)
    .build();
  sheet.insertChart(chart);
}

function buildHistoryDebtTrendChart_(sheet, startCol, posRow) {
  const rows = findLastNonEmptyRowInRange_(sheet, 1, startCol, 500);
  const chart = sheet.newChart()
    .setChartType(Charts.ChartType.LINE)
    .addRange(sheet.getRange(1, startCol, Math.max(2, rows), 3))
    .setOption('title', 'Debt Trend (Blue=Card Debt, Red=Minimum Payments)')
    .setOption('legend', { position: 'bottom' })
    .setOption('useFirstColumnAsDomain', true)
    .setOption('curveType', 'function')
    .setPosition(posRow, 1, 0, 0)
    .build();
  sheet.insertChart(chart);
}

function buildHistoryPayNowTrendChart_(sheet, startCol, posRow) {
  const rows = findLastNonEmptyRowInRange_(sheet, 1, startCol, 500);
  const chart = sheet.newChart()
    .setChartType(Charts.ChartType.LINE)
    .addRange(sheet.getRange(1, startCol, Math.max(2, rows), 3))
    .setOption('title', 'Recommended Pay Now vs Suggested Extra (Blue=Extra, Red=Pay Now)')
    .setOption('legend', { position: 'bottom' })
    .setOption('useFirstColumnAsDomain', true)
    .setOption('curveType', 'function')
    .setPosition(posRow, 1, 0, 0)
    .build();
  sheet.insertChart(chart);
}

function buildHistoryMonthsToPayoffChart_(sheet, startCol, posRow) {
  const rows = findLastNonEmptyRowInRange_(sheet, 1, startCol, 500);
  const chart = sheet.newChart()
    .setChartType(Charts.ChartType.LINE)
    .addRange(sheet.getRange(1, startCol, Math.max(2, rows), 3))
    .setOption('title', 'Months to Payoff (Blue=Target, Red=All Cards)')
    .setOption('legend', { position: 'bottom' })
    .setOption('useFirstColumnAsDomain', true)
    .setOption('curveType', 'function')
    .setPosition(posRow, 1, 0, 0)
    .build();
  sheet.insertChart(chart);
}

function buildRunLabel_(runDateValue, rowNumber) {
  if (runDateValue instanceof Date && !isNaN(runDateValue.getTime())) {
    return Utilities.formatDate(
      runDateValue,
      Session.getScriptTimeZone(),
      'MM/dd HH:mm'
    );
  }

  const text = String(runDateValue || '').trim();
  if (!text) return 'Run ' + rowNumber;

  const m = text.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})/);
  if (m) {
    return m[2] + '/' + m[3] + ' ' + m[4] + ':' + m[5];
  }

  return text;
}

function findLastNonEmptyRowInRange_(sheet, startRow, col, maxRowsToCheck) {
  const values = sheet.getRange(startRow, col, maxRowsToCheck, 1).getValues();
  let last = startRow;
  for (let i = 0; i < values.length; i++) {
    if (String(values[i][0] || '').trim() !== '') {
      last = startRow + i;
    }
  }
  return last;
}

function formatRecommendationsSheet_(sheet, rows) {
  const lastRow = rows.length;
  const lastCol = rows[0].length;

  sheet.setFrozenRows(1);

  for (let c = 1; c <= lastCol; c++) sheet.setColumnWidth(c, 130);
  sheet.setColumnWidth(1, 280);
  if (lastCol >= 2) sheet.setColumnWidth(2, 180);
  if (lastCol >= 3) sheet.setColumnWidth(3, 140);
  if (lastCol >= 4) sheet.setColumnWidth(4, 140);
  if (lastCol >= 5) sheet.setColumnWidth(5, 140);
  if (lastCol >= 6) sheet.setColumnWidth(6, 140);
  if (lastCol >= 7) sheet.setColumnWidth(7, 140);
  if (lastCol >= 8) sheet.setColumnWidth(8, 170);
  if (lastCol >= 9) sheet.setColumnWidth(9, 170);
  if (lastCol >= 10) sheet.setColumnWidth(10, 180);
  if (lastCol >= 11) sheet.setColumnWidth(11, 700);

  sheet.getRange(1, 1, lastRow, lastCol)
    .setFontFamily('Arial')
    .setVerticalAlignment('middle')
    .setWrap(true);

  sheet.getRange(1, 1, 1, lastCol)
    .merge()
    .setValue('Debt Planner Dashboard')
    .setFontSize(16)
    .setFontWeight('bold')
    .setBackground('#1f4e78')
    .setFontColor('#ffffff')
    .setHorizontalAlignment('center');

  const sectionNames = {
    'Visual Summary': true,
    'Action Plan': true,
    'Executive Summary': true,
    'Liquidity vs Debt': true,
    'Assets & Liabilities Summary': true,
    'Key Metrics': true,
    'Asset Breakdown': true,
    'Real Estate Breakdown': true,
    'Cash Flow Change Breakdown': true,
    'Pay Now': true,
    'Pay Soon': true,
    'Other Obligations': true,
    'Recommendation': true,
    'Top Debt Targets': true,
    'Warnings': true,
    'Notes': true
  };

  for (let r = 1; r <= lastRow; r++) {
    const first = String(sheet.getRange(r, 1).getValue() || '').trim();
    const second = String(sheet.getRange(r, 2).getValue() || '').trim();

    if (sectionNames[first] && !second) {
      sheet.getRange(r, 1, 1, lastCol)
        .setBackground('#d9eaf7')
        .setFontWeight('bold')
        .setFontSize(11);
    }

    if (first === 'Metric' || first === 'Account' || first === 'Strategy' || first === 'Type' || first === 'House') {
      sheet.getRange(r, 1, 1, lastCol)
        .setBackground('#edf3f8')
        .setFontWeight('bold');
    }
  }

  const currencyLabels = {
    'Usable Cash After Buffers': true,
    'Active Credit Card Debt': true,
    'Total Financial Assets': true,
    'Brokerage Assets': true,
    'Retirement Assets': true,
    'Education Assets': true,
    'Total Real Estate Assets': true,
    'Estimated Real Estate Equity': true,
    'Total Assets': true,
    'Total Liabilities': true,
    'Credit Card Debt': true,
    'Loan Debt': true,
    'HELOC Debt': true,
    'Other Obligations': true,
    'Net Worth': true,
    'Projected Income This Month': true,
    'Projected Expenses This Month': true,
    'Projected Cash Flow This Month': true,
    'Previous Month Cash Flow': true,
    'Month-over-Month Cash Flow Change': true,
    'Total Usable Cash Now': true,
    'Total Protected Buffers': true,
    'Total Minimum Payments': true,
    'Total Active Credit Card Debt': true,
    'Minimums Due Now': true,
    'Minimums Due Soon': true,
    'Suggested Extra Payment This Cycle': true,
    'Recommended Total To Pay Now': true,
    'Estimated Annual Interest Savings': true
  };

  const integerLabels = {
    'Estimated Months To Pay Off Target': true,
    'Estimated Months To Pay Off All Cards': true
  };

  const decimalLabels = {
    'Months of Minimum Coverage': true,
    'Cash to Card Debt Ratio': true,
    'Upcoming Pay Window Coverage': true
  };

  for (let r = 1; r <= lastRow; r++) {
    const label = String(sheet.getRange(r, 1).getValue() || '').trim();
    if (currencyLabels[label]) sheet.getRange(r, 2).setNumberFormat('$#,##0.00;-$#,##0.00');
    if (integerLabels[label]) sheet.getRange(r, 2).setNumberFormat('0');
    if (decimalLabels[label]) sheet.getRange(r, 2).setNumberFormat('0.00');
  }

  const stabilityCell = findLabelValueCell_(sheet, 'Monthly Stability');
  if (stabilityCell) {
    const value = String(stabilityCell.getValue() || '').trim();
    if (value === 'Stable') stabilityCell.setBackground('#d9ead3').setFontColor('#274e13').setFontWeight('bold');
    else if (value === 'Tight') stabilityCell.setBackground('#fff2cc').setFontColor('#7f6000').setFontWeight('bold');
    else if (value === 'Risky') stabilityCell.setBackground('#f4cccc').setFontColor('#990000').setFontWeight('bold');
  }

  formatSectionTable_(sheet, 'Asset Breakdown', { currencyCols: [3] });
  formatSectionTable_(sheet, 'Real Estate Breakdown', { currencyCols: [2, 3, 4] });
  formatSectionTable_(sheet, 'Cash Flow Change Breakdown', { currencyCols: [3, 4, 5] });
  formatSectionTable_(sheet, 'Pay Now', { currencyCols: [5, 6], percentCols: [7], integerCols: [4] });
  formatSectionTable_(sheet, 'Pay Soon', { currencyCols: [5, 6], percentCols: [7], integerCols: [4] });
  formatSectionTable_(sheet, 'Other Obligations', { currencyCols: [3, 4], percentCols: [5] });
  formatSectionTable_(sheet, 'Recommendation', { currencyCols: [5, 6, 7], percentCols: [4], integerCols: [8, 9] });
  formatSectionTable_(sheet, 'Top Debt Targets', { currencyCols: [3, 5], percentCols: [4] });
}

function formatSectionTable_(sheet, sectionName, config) {
  const values = sheet.getDataRange().getValues();
  let dataStartRow = -1;
  let dataEndRow = -1;

  for (let r = 0; r < values.length; r++) {
    const first = String(values[r][0] || '').trim();
    if (first === sectionName) {
      dataStartRow = r + 3;
      break;
    }
  }

  if (dataStartRow === -1) return;

  for (let r = dataStartRow - 1; r < values.length; r++) {
    const first = String(values[r][0] || '').trim();
    if ((r + 1) > dataStartRow && first === '') {
      dataEndRow = r;
      break;
    }
  }

  if (dataEndRow === -1) dataEndRow = values.length;
  const numRows = dataEndRow - dataStartRow + 1;
  if (numRows <= 0) return;

  (config.currencyCols || []).forEach(function(col) {
    sheet.getRange(dataStartRow, col, numRows, 1).setNumberFormat('$#,##0.00;-$#,##0.00');
  });

  (config.percentCols || []).forEach(function(col) {
    sheet.getRange(dataStartRow, col, numRows, 1).setNumberFormat('0.00"%"');
  });

  (config.integerCols || []).forEach(function(col) {
    sheet.getRange(dataStartRow, col, numRows, 1).setNumberFormat('0');
  });
}

function getHistoryHeaders_() {
  return [
    'Run Date',
    'Month',
    'Mode',
    'Monthly Stability',
    'Projected Cash Flow',
    'Previous Month Cash Flow',
    'Cash Flow Change',
    'Usable Cash After Buffers',
    'Total Minimum Payments',
    'Total Active Credit Card Debt',
    'Suggested Extra Payment',
    'Recommended Total To Pay Now',
    'Target Account',
    'Next Target',
    'Estimated Months To Pay Off Target',
    'Estimated Months To Pay Off All Cards',
    'Total Financial Assets',
    'Total Real Estate Assets',
    'Total Assets',
    'Total Liabilities',
    'Net Worth'
  ];
}

function ensureHistorySheet_(ss) {
  let sheet;
  try {
    sheet = getSheet_(ss, 'HISTORY');
  } catch (e) {
    sheet = ss.insertSheet(getSheetNames_().HISTORY);
  }

  const headers = getHistoryHeaders_();
  const currentHeaders = sheet.getRange(1, 1, 1, headers.length).getValues()[0];

  const needsReset =
    sheet.getLastRow() === 0 ||
    currentHeaders.length < headers.length ||
    headers.some(function(h, i) {
      return String(currentHeaders[i] || '').trim() !== h;
    });

  if (needsReset) {
    sheet.clear();
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }

  formatHistorySheet_(sheet, headers.length);
  return sheet;
}

function formatHistorySheet_(sheet, headerCount) {
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, headerCount)
    .setBackground('#5b2c6f')
    .setFontColor('#ffffff')
    .setFontWeight('bold')
    .setFontFamily('Arial');
  sheet.autoResizeColumns(1, headerCount);
}

function appendHistory_(ss, summary) {
  const sheet = ensureHistorySheet_(ss);

  const newRow = [
    summary.runDate,
    summary.monthHeader,
    summary.mode,
    summary.stability.label,
    summary.thisMonthCashFlow,
    summary.previousMonthCashFlow,
    summary.monthChange,
    summary.usableCashAfterBuffers,
    summary.minimumDueTotal,
    summary.totalActiveCreditCardDebt,
    summary.suggestedExtraPayment,
    summary.recommendedTotalToPayNow,
    summary.recommendation ? summary.recommendation.targetAccount : '',
    summary.recommendation && summary.recommendation.nextTargetAfterThis ? summary.recommendation.nextTargetAfterThis.account : '',
    summary.recommendation ? summary.recommendation.estimatedMonthsToPayOffTarget : '',
    summary.recommendation ? summary.recommendation.estimatedMonthsToPayOffAllCards : '',
    summary.assetSummary.totalAssets,
    summary.houseAssetSummary.totalRealEstateValue,
    summary.totalAssets,
    summary.liabilitySummary.totalLiabilities,
    summary.netWorth
  ];

  if (!isDuplicateHistoryRow_(sheet, newRow)) {
    sheet.appendRow(newRow);
  }

  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 5, lastRow - 1, 8).setNumberFormat('$#,##0.00;-$#,##0.00');
    sheet.getRange(2, 15, lastRow - 1, 2).setNumberFormat('0');
    sheet.getRange(2, 17, lastRow - 1, 5).setNumberFormat('$#,##0.00;-$#,##0.00');
  }

  buildHistoryCharts_(ss);
}

function isDuplicateHistoryRow_(sheet, newRow) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return false;

  const lastValues = sheet.getRange(lastRow, 1, 1, newRow.length).getValues()[0];

  for (let i = 1; i < newRow.length; i++) {
    const a = normalizeHistoryValue_(lastValues[i]);
    const b = normalizeHistoryValue_(newRow[i]);
    if (a !== b) return false;
  }

  return true;
}

function normalizeHistoryValue_(value) {
  if (value === null || value === undefined || value === '') return '';
  if (typeof value === 'number') return round2_(value);
  return String(value).trim();
}

function sendPlannerEmailIfConfigured_(summary) {
  // Strict settings-only recipient resolution: read INPUT - Settings.Email
  // directly without triggering sheet auto-creation and without falling
  // back to Session.getActiveUser().getEmail(). The Session fallback was
  // causing blank / not-set-up workbooks to silently email the owner even
  // when the user never configured a recipient in Profile. Populated
  // workbooks with a valid settings email are unaffected.
  var userEmail = readPlannerEmailFromSettingsStrict_();
  if (!userEmail) return;

  // Readiness gate: when the workbook has no meaningful planner signal
  // (no liabilities, no assets, no scheduled payments, no recommendation)
  // skip silently. All four values come from the existing summary object
  // built by runDebtPlanner, so this check does not read any sheets.
  if (!isPlannerSummaryMeaningful_(summary)) return;

  const lines = [];
  lines.push('Debt Planner Update');
  lines.push('');
  summary.actionPlan.forEach(function(line) { lines.push(line); });
  lines.push('');
  lines.push('---');
  lines.push('');
  summary.executiveSummary.forEach(function(line) { lines.push(line); });

  MailApp.sendEmail({
    to: userEmail,
    subject: 'Debt Planner Update - ' + summary.monthHeader,
    body: lines.join('\n')
  });
}

// Non-throwing, non-creating read of INPUT - Settings.Email. Returns the
// trimmed email only if the sheet exists and the cell holds a value that
// passes PROFILE_EMAIL_REGEX_. Never falls back to Session.getActiveUser().
function readPlannerEmailFromSettingsStrict_() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheetName =
      typeof PROFILE_SETTINGS_SHEET_NAME_ === 'string'
        ? PROFILE_SETTINGS_SHEET_NAME_
        : 'INPUT - Settings';
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) return '';
    var last = sheet.getLastRow();
    if (last < 2) return '';
    var values = sheet.getRange(2, 1, last - 1, 2).getValues();
    var emailKey =
      typeof PROFILE_KEYS_ === 'object' && PROFILE_KEYS_ && PROFILE_KEYS_.EMAIL
        ? PROFILE_KEYS_.EMAIL
        : 'Email';
    for (var i = 0; i < values.length; i++) {
      var key = String(values[i][0] || '').trim();
      if (key !== emailKey) continue;
      var raw = String(values[i][1] == null ? '' : values[i][1]).trim();
      if (!raw) return '';
      var regex =
        typeof PROFILE_EMAIL_REGEX_ !== 'undefined'
          ? PROFILE_EMAIL_REGEX_
          : /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return regex.test(raw) ? raw : '';
    }
  } catch (_e) {
    return '';
  }
  return '';
}

// Treat the summary as meaningful when at least one of the four planner
// signals has real content. On a blank / not-set-up workbook all four are
// empty/zero so we return false and the email send is skipped silently.
function isPlannerSummaryMeaningful_(summary) {
  if (!summary || typeof summary !== 'object') return false;
  var liabilities =
    summary.liabilitySummary && summary.liabilitySummary.totalLiabilities
      ? Number(summary.liabilitySummary.totalLiabilities) || 0
      : 0;
  if (liabilities > 0) return true;
  var assets = Number(summary.totalAssets) || 0;
  if (assets > 0) return true;
  if (Array.isArray(summary.payNow) && summary.payNow.length > 0) return true;
  if (Array.isArray(summary.paySoon) && summary.paySoon.length > 0) return true;
  if (summary.recommendation) return true;
  return false;
}