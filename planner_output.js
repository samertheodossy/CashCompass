function writeRecommendations_(ss, summary, performanceTrace) {
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

  // The generated Dashboard remains a tabular planner output. Its former six
  // embedded charts and O:Z support tables were not consumed by CashCompass;
  // retire only those known chart objects after rebuilding the table. Unknown
  // customer-added charts remain untouched.

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
  if (typeof markPerformanceTrace_ === 'function') {
    markPerformanceTrace_(performanceTrace, 'write_dashboard_data');
  }
  formatRecommendationsSheet_(sheet, normalizedRows);
  if (typeof markPerformanceTrace_ === 'function') {
    markPerformanceTrace_(performanceTrace, 'format_dashboard');
  }
  retireDashboardCharts_(sheet);
  if (typeof markPerformanceTrace_ === 'function') {
    markPerformanceTrace_(performanceTrace, 'build_dashboard_charts');
  }
}

function removeAllCharts_(sheet) {
  const charts = sheet.getCharts();
  charts.forEach(function(chart) {
    sheet.removeChart(chart);
  });
}

/**
 * Retire only the six charts historically owned by the planner. Unknown charts
 * are preserved because a customer may have added them manually. The planner's
 * leading clearContents() already clears the obsolete O:Z chart-support tables.
 */
function retireDashboardCharts_(sheet) {
  const retiredTitles = {
    'Net Worth by Run': true,
    'Cash Flow by Run (Blue=Projected, Red=Previous Month)': true,
    'Assets vs Liabilities vs Net Worth': true,
    'Asset Allocation': true,
    'Liability Breakdown': true,
    'Credit Card Balances': true
  };
  const charts = sheet.getCharts();
  charts.forEach(function(chart) {
    let title = '';
    try {
      const options = chart.getOptions();
      title = options ? String(options.get('title') || '') : '';
    } catch (_e) {
      // Preserve charts whose metadata cannot be read; they cannot be safely
      // identified as planner-owned.
    }
    if (retiredTitles[title]) sheet.removeChart(chart);
  });
}

/** Remove retired History charts and only their recognized Y:BB support area. */
function retireHistoryChartsAndSupportData_(sheet) {
  removeAllCharts_(sheet);

  const startCol = 25; // Y
  const availableCols = sheet.getMaxColumns() - startCol + 1;
  if (availableCols <= 0) return;
  const width = Math.min(30, availableCols);
  const headers = sheet.getRange(1, startCol, 1, width).getDisplayValues()[0];
  const hasLegacySupportTable = headers.some(function(value) {
    return String(value || '').trim() === 'Run Label';
  });
  if (hasLegacySupportTable) {
    sheet.getRange(1, startCol, sheet.getMaxRows(), width).clearContent();
  }
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

function appendHistory_(ss, summary, performanceTrace, canonicalSnapshot) {
  const sheet = ensureHistorySheet_(ss);
  // Preserve the existing 21-column History schema and every prior row. Only
  // the new row's five financial-position cells converge on the approved
  // canonical basis. Unavailable legacy domains retain the Planner values
  // instead of breaking refresh or writing a mixed-basis identity.
  const historyFinancials = canonicalHistorySnapshotValues_(
    canonicalSnapshot,
    {
      investments: summary.assetSummary.totalAssets,
      grossRealEstate: summary.houseAssetSummary.totalRealEstateValue,
      totalAssets: summary.totalAssets,
      totalLiabilities: summary.liabilitySummary.totalLiabilities,
      netWorth: summary.netWorth
    }
  );

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
    historyFinancials.investments,
    historyFinancials.grossRealEstate,
    historyFinancials.totalAssets,
    historyFinancials.totalLiabilities,
    historyFinancials.netWorth
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

  if (typeof markPerformanceTrace_ === 'function') {
    markPerformanceTrace_(performanceTrace, 'write_history');
  }

  // OUT - History rows feed dashboard comparisons, but its six embedded charts
  // are not displayed anywhere in the product. Remove legacy copies and do not
  // rebuild them. On later runs getCharts() returns an empty array, leaving only
  // a small cleanup check instead of repeated chart insertion work.
  retireHistoryChartsAndSupportData_(sheet);
  if (typeof markPerformanceTrace_ === 'function') {
    markPerformanceTrace_(performanceTrace, 'cleanup_history_charts');
  }

  // Additive test seam: callers that need an immediate same-execution read can
  // use the exact Sheet object that performed the write. Existing production
  // callers ignore the return value, so write behavior is unchanged.
  return sheet;
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

/**
 * Decide whether to send the planner email now or defer it via the
 * debounce trigger.
 *
 * `options.emailMode`:
 *   - `'defer'` — per-save background run. Bumps `LAST_SAVE_AT` so the
 *     debounce trigger knows there is pending work, logs a
 *     `planner_email_deferred` row, and returns without sending. The
 *     debounce trigger will fire after the quiet window settles.
 *   - `'send'` (default) — manual button or the debounce trigger
 *     itself. Honors the meaningfulness gate, resolves all valid
 *     recipients (primary + spouse), sends one email to all of them
 *     joined on `To:`, and marks the debounce queue settled.
 *
 * The default `'send'` preserves byte-for-byte compatibility with
 * legacy callers that don't pass options (e.g. the menu's "Run
 * Planner" item, the legacy sidebar HTML callers).
 */
function sendPlannerEmailIfConfigured_(summary, options) {
  options = options || {};
  var emailMode = String(options.emailMode || 'send').toLowerCase();

  // Harness-only privacy seam. Normal callers never pass `suppress`; unknown
  // values retain the legacy send behavior below. This performs no property,
  // Activity, recipient, or MailApp work.
  if (emailMode === 'suppress') return;

  if (emailMode === 'defer') {
    // Per-save background run. Defer the email — the debounce trigger
    // will eventually settle and send. Bump LAST_SAVE_AT so the
    // trigger knows there's pending work, AND increment the deferred-
    // save counter so the eventual planner_email_sent row can show
    // (N saves batched). We deliberately do NOT write a
    // planner_email_deferred activity row any more: a heavy update
    // session was producing 20-50 redundant rows that crowded out
    // real money events in the Activity ledger. The audit lives on
    // the one row that matters — the actual send.
    if (typeof bumpDebouncePlannerLastSaveAt_ === 'function') {
      bumpDebouncePlannerLastSaveAt_();
    }
    if (typeof bumpDebouncePlannerDeferredCount_ === 'function') {
      bumpDebouncePlannerDeferredCount_();
    }
    return;
  }

  // emailMode === 'send' (or anything else falls through to send for
  // safety — better to over-send than to silently drop the email).
  //
  // Readiness gate: when the workbook has no meaningful planner signal
  // (no liabilities, no assets, no scheduled payments, no
  // recommendation) skip silently. All four values come from the
  // existing summary object built by runDebtPlanner, so this check
  // does not read any sheets. Still mark the queue settled so the
  // debounce trigger doesn't keep retrying every poll interval.
  if (!isPlannerSummaryMeaningful_(summary)) {
    if (typeof markDebouncePlannerEmailSettled_ === 'function') {
      markDebouncePlannerEmailSettled_();
    }
    return;
  }

  // Strict settings-only recipient resolution: reads INPUT - Settings
  // directly without triggering sheet auto-creation and without
  // falling back to Session.getActiveUser().getEmail(). The Session
  // fallback was causing blank / not-set-up workbooks to silently
  // email the owner when the user never configured a recipient in
  // Profile. Populated workbooks with a valid settings email are
  // unaffected. Returns BOTH primary (`Email`) and spouse
  // (`Spouse Email`) when configured — see Profile help.
  var resolved = readPlannerEmailRecipientsStrict_();

  // Surface invalid recipient fields so the user can tell *why* the
  // expected address didn't get the email without reading code. We
  // log the field name (e.g. `Spouse Email`) but never the bad value
  // itself so we don't leak a typo'd address into Activity.
  if (resolved.invalidFields && resolved.invalidFields.length) {
    appendPlannerEmailInvalidRecipientActivity_(resolved.invalidFields);
  }

  if (!resolved.valid || !resolved.valid.length) {
    // No valid recipients at all — same silent skip as before. Still
    // mark the queue settled so the debounce trigger doesn't keep
    // polling forever waiting to send to a recipient that doesn't
    // exist (case 9 from the plan).
    if (typeof markDebouncePlannerEmailSettled_ === 'function') {
      markDebouncePlannerEmailSettled_();
    }
    return;
  }

  const lines = [];
  lines.push('Debt Planner Update');
  lines.push('');
  summary.actionPlan.forEach(function(line) { lines.push(line); });
  lines.push('');
  lines.push('---');
  lines.push('');
  summary.executiveSummary.forEach(function(line) { lines.push(line); });

  MailApp.sendEmail({
    to: resolved.valid.join(','),
    subject: 'Debt Planner Update - ' + summary.monthHeader,
    body: lines.join('\n')
  });

  appendPlannerEmailSentActivity_(resolved);
  if (typeof markDebouncePlannerEmailSettled_ === 'function') {
    markDebouncePlannerEmailSettled_();
  }
}

/**
 * Non-throwing, non-creating read of INPUT - Settings to collect every
 * configured planner email recipient — currently `Email` (primary)
 * and `Spouse Email` from Profile. Each candidate is validated against
 * `PROFILE_EMAIL_REGEX_` (the same regex Profile uses on save) before
 * being included.
 *
 * Returns:
 *   {
 *     valid: string[],          // deduplicated list of valid addresses
 *     fields: string[],         // Profile field names that contributed
 *                               //   to `valid`, in the same order
 *     invalidFields: string[]   // field names whose stored value was
 *                               //   present but failed validation;
 *                               //   surfaced via
 *                               //   `planner_email_invalid_recipient`
 *                               //   activity rows
 *   }
 *
 * Never falls back to `Session.getActiveUser().getEmail()` (same hard
 * rule as before — was the source of an old "silently emailed the
 * owner of a blank workbook" bug).
 */
function readPlannerEmailRecipientsStrict_() {
  var result = { valid: [], fields: [], invalidFields: [] };

  try {
    var ss = getUserSpreadsheet_();
    var sheetName =
      typeof PROFILE_SETTINGS_SHEET_NAME_ === 'string'
        ? PROFILE_SETTINGS_SHEET_NAME_
        : 'INPUT - Settings';
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) return result;

    var last = sheet.getLastRow();
    if (last < 2) return result;

    var values = sheet.getRange(2, 1, last - 1, 2).getValues();

    var emailKey =
      typeof PROFILE_KEYS_ === 'object' && PROFILE_KEYS_ && PROFILE_KEYS_.EMAIL
        ? PROFILE_KEYS_.EMAIL
        : 'Email';
    var spouseEmailKey =
      typeof PROFILE_KEYS_ === 'object' && PROFILE_KEYS_ && PROFILE_KEYS_.SPOUSE_EMAIL
        ? PROFILE_KEYS_.SPOUSE_EMAIL
        : 'Spouse Email';

    var regex =
      typeof PROFILE_EMAIL_REGEX_ !== 'undefined'
        ? PROFILE_EMAIL_REGEX_
        : /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    var primaryRaw = '';
    var spouseRaw = '';
    for (var i = 0; i < values.length; i++) {
      var key = String(values[i][0] || '').trim();
      var raw = String(values[i][1] == null ? '' : values[i][1]).trim();
      if (key === emailKey) primaryRaw = raw;
      else if (key === spouseEmailKey) spouseRaw = raw;
    }

    var seen = {};
    function consider(label, raw) {
      if (!raw) return; // blank is allowed — silent omission
      if (!regex.test(raw)) {
        result.invalidFields.push(label);
        return;
      }
      var normalized = raw.toLowerCase();
      if (seen[normalized]) return; // dedup on case-insensitive match
      seen[normalized] = true;
      result.valid.push(raw);
      result.fields.push(label);
    }

    consider(emailKey, primaryRaw);
    consider(spouseEmailKey, spouseRaw);
  } catch (_e) {
    // Defensive: leave whatever we collected so far and return.
    return result;
  }

  return result;
}

/**
 * Deprecated: kept as a no-op so any unexpected caller (legacy code
 * path, future refactor, etc.) doesn't crash. Per-save defers no
 * longer write a `planner_email_deferred` row — the count is rolled
 * up onto the eventual `planner_email_sent` row instead. See the
 * defer branch in sendPlannerEmailIfConfigured_ and the
 * `deferredSaveCount` field on the sent row's details JSON.
 *
 * Existing `planner_email_deferred` rows already on LOG - Activity
 * are intentionally left untouched — `activity_log.js` still classifies
 * them as Planner / "Email deferred" / non-monetary so historical rows
 * remain readable in the Activity table.
 */
function appendPlannerEmailDeferredActivity_(_summary) {
  // Intentionally a no-op. See doc comment above.
}

/**
 * Append `planner_email_invalid_recipient` rows naming the Profile
 * fields whose stored value failed regex validation. We deliberately
 * never include the bad value itself — only the field name — so a
 * typo doesn't leak into Activity.
 */
function appendPlannerEmailInvalidRecipientActivity_(invalidFields) {
  try {
    if (!invalidFields || !invalidFields.length) return;
    if (typeof appendActivityLog_ !== 'function') return;
    var ss = getUserSpreadsheet_();
    for (var i = 0; i < invalidFields.length; i++) {
      var field = String(invalidFields[i] || '').trim();
      if (!field) continue;
      appendActivityLog_(ss, {
        eventType: 'planner_email_invalid_recipient',
        payee: 'Planner',
        details: JSON.stringify({ field: field, detailsVersion: 1 })
      });
    }
  } catch (_e) { /* defensive */ }
}

/**
 * Append a `planner_email_sent` row when the email actually went out.
 * Stores the recipient *count* and the contributing field *names*
 * (e.g. ['Email', 'Spouse Email']) — never the addresses themselves.
 *
 * Also reads the deferred-save counter from DocumentProperties and
 * stamps it onto the row as `deferredSaveCount` so the action label
 * can render "(N saves batched)". The counter is read here (not
 * reset); `markDebouncePlannerEmailSettled_` clears it right after
 * this function returns. Manual Run Planner runs that had no prior
 * defers see count 0 → no suffix on the label.
 */
function appendPlannerEmailSentActivity_(resolved) {
  try {
    if (typeof appendActivityLog_ !== 'function') return;
    var ss = getUserSpreadsheet_();
    var deferredSaveCount = 0;
    if (typeof readDebouncePlannerDeferredCount_ === 'function') {
      deferredSaveCount = readDebouncePlannerDeferredCount_() || 0;
    }
    appendActivityLog_(ss, {
      eventType: 'planner_email_sent',
      payee: 'Planner',
      details: JSON.stringify({
        recipientCount: (resolved && resolved.valid) ? resolved.valid.length : 0,
        recipientFields: (resolved && resolved.fields) ? resolved.fields.slice() : [],
        deferredSaveCount: deferredSaveCount,
        detailsVersion: 1
      })
    });
  } catch (_e) { /* defensive */ }
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
