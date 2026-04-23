function getDashboardSnapshot() {
  return buildDashboardSnapshot_();
}

function runPlannerAndRefreshDashboard() {
  if (typeof runDebtPlanner !== 'function') {
    throw new Error('runDebtPlanner() is not available.');
  }

  runDebtPlanner();
  touchDashboardSourceUpdated_('planner');

  const snapshot = buildDashboardSnapshot_();
  saveDashboardBaselineSnapshot_(snapshot);

  return {
    ok: true,
    message: 'Planner run complete.',
    snapshot: snapshot
  };
}

function buildDashboardSnapshot_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureActivityLogSheet_(ss);

  // Cash and Debt come from REQUIRED setup sheets (SYS - Accounts, INPUT -
  // Debts). Historically, a missing sheet here threw "Missing sheet
  // (after retry+flush): …" and painted a red banner on the overview for
  // any brand-new / blank workbook that had not yet completed onboarding.
  // Phase A2: treat absence as a not-yet-set-up signal and degrade to
  // zero values, exposing the state via the new `state` field below.
  // Investments (SYS - Assets) and Houses (SYS - House Assets) remain
  // OPTIONAL and keep using sumColumnByHeaderForOptionalSheet_.
  let accountsSheet = null;
  let accountsPresent = false;
  try {
    accountsSheet = getSheet_(ss, 'ACCOUNTS');
    accountsPresent = true;
  } catch (_accountsMissingErr) {
    // Fresh workbook before Bank Accounts onboarding: tolerate absence.
  }

  let debtsSheet = null;
  let debtsPresent = false;
  try {
    debtsSheet = getSheet_(ss, 'DEBTS');
    debtsPresent = true;
  } catch (_debtsMissingErr) {
    // Fresh workbook before Debts onboarding: tolerate absence.
  }

  const cash = accountsPresent
    ? sumColumnByHeader_(accountsSheet, 'Current Balance')
    : 0;
  const investments = sumColumnByHeaderForOptionalSheet_(ss, 'ASSETS', 'Current Balance');
  const houseValues = sumColumnByHeaderForOptionalSheet_(ss, 'HOUSE_ASSETS', 'Current Value');
  const houseLoans = sumColumnByHeaderForOptionalSheet_(ss, 'HOUSE_ASSETS', 'Loan Amount Left');
  const houseEquity = round2_(houseValues - houseLoans);
  const totalDebt = debtsPresent ? sumDebtBalances_(debtsSheet) : 0;

  let snapshotState;
  if (accountsPresent && debtsPresent) {
    snapshotState = 'ready';
  } else if (accountsPresent || debtsPresent) {
    snapshotState = 'partial';
  } else {
    snapshotState = 'notSetUp';
  }

  const netWorth = round2_(cash + investments + houseValues - totalDebt);

  const historySnapshots = getLatestHistorySnapshots_(2);
  const latestHistory = historySnapshots.length ? historySnapshots[0] : null;
  const propertyBaseline = getDashboardBaselineSnapshot_();

  let deltas = latestHistory
    ? {
        cash: null,
        investments: round2_(investments - Number(latestHistory.investments || 0)),
        houseEquity: round2_(houseValues - Number(latestHistory.houseValues || 0)),
        debt: round2_(totalDebt - Number(latestHistory.debt || 0)),
        netWorth: round2_(netWorth - Number(latestHistory.netWorth || 0)),
        baselineLabel: latestHistory.runLabel || latestHistory.runDate || 'Latest planner run',
        baselineSource: 'history'
      }
    : (propertyBaseline
      ? {
          cash: round2_(cash - Number(propertyBaseline.cash || 0)),
          investments: round2_(investments - Number(propertyBaseline.investments || 0)),
          houseEquity: round2_(houseEquity - Number(propertyBaseline.houseEquity || 0)),
          debt: round2_(totalDebt - Number(propertyBaseline.debt || 0)),
          netWorth: round2_(netWorth - Number(propertyBaseline.netWorth || 0)),
          baselineLabel: propertyBaseline.savedAt || 'Previous saved snapshot',
          baselineSource: 'baseline'
        }
      : null);

  const invPrior = getPriorMonthInvestmentsTotalFromInput_();
  if (invPrior && invPrior.total !== null) {
    if (!deltas) deltas = {};
    deltas.investments = round2_(investments - invPrior.total);
    deltas.investmentsMoMLabel = invPrior.label;
  } else {
    if (deltas) {
      deltas.investments = null;
      deltas.investmentsMoMLabel = null;
    }
  }

  const cashPrior = getPriorMonthCashTotalFromBankInput_();
  if (cashPrior && cashPrior.total !== null) {
    if (!deltas) deltas = {};
    deltas.cash = round2_(cash - cashPrior.total);
    deltas.cashMoMLabel = cashPrior.label;
  } else {
    if (deltas) {
      deltas.cash = null;
      deltas.cashMoMLabel = null;
    }
  }

  const housePrior = getPriorMonthHouseValuesTotalFromHouseValuesInput_();
  if (housePrior && housePrior.total !== null) {
    if (!deltas) deltas = {};
    deltas.houseEquity = round2_(houseValues - housePrior.total);
    deltas.houseValuesMoMLabel = housePrior.label;
  } else {
    if (deltas) {
      deltas.houseEquity = null;
      deltas.houseValuesMoMLabel = null;
    }
  }

  const debtPrior = getPriorMonthTotalDebtFromHistory_();
  if (debtPrior && debtPrior.total !== null) {
    if (!deltas) deltas = {};
    deltas.debt = round2_(totalDebt - debtPrior.total);
    deltas.debtMoMLabel = debtPrior.label;
  } else {
    if (deltas) {
      deltas.debt = null;
      deltas.debtMoMLabel = null;
    }
  }

  if (
    cashPrior &&
    cashPrior.total !== null &&
    invPrior &&
    invPrior.total !== null &&
    housePrior &&
    housePrior.total !== null &&
    debtPrior &&
    debtPrior.total !== null
  ) {
    if (!deltas) deltas = {};
    const priorNetWorth = round2_(cashPrior.total + invPrior.total + housePrior.total - debtPrior.total);
    deltas.netWorth = round2_(netWorth - priorNetWorth);
    deltas.netWorthMoMLabel = invPrior.label;
  } else {
    if (deltas) {
      deltas.netWorth = null;
      deltas.netWorthMoMLabel = null;
    }
  }

  const latestMetrics = getLatestPlannerHistoryMetrics_();
  const upcoming = getUpcomingExpenseMetricsSafe_();
  const retirement = getRetirementSummarySafe_();

  const bufferRunway = buildBufferRunway_(latestMetrics, cash);
  const historyRows = getAllHistorySnapshotRows_();
  const weeklyPick = pickWeeklyBaselineFromRows_(historyRows);
  const attribution = buildNetWorthAttributionWeekly_(
    {
      investments: investments,
      houseValues: houseValues,
      debt: totalDebt,
      netWorth: netWorth
    },
    weeklyPick
  );
  const health = buildFinancialHealthScore_(latestMetrics, upcoming);
  const issues = buildDashboardIssues_(ss, {
    cash: cash,
    investments: investments,
    houseValues: houseValues,
    houseLoans: houseLoans,
    houseEquity: houseEquity,
    debt: totalDebt,
    netWorth: netWorth,
    deltas: deltas,
    upcoming: upcoming,
    retirement: retirement,
    bufferRunway: bufferRunway
  });
  const suggestedActions = buildSuggestedActions_(latestMetrics, upcoming, retirement, bufferRunway);

  return {
    cash: round2_(cash),
    investments: round2_(investments),
    houseValues: round2_(houseValues),
    houseLoans: round2_(houseLoans),
    houseEquity: round2_(houseEquity),
    debt: round2_(totalDebt),
    netWorth: round2_(netWorth),
    deltas: deltas,
    attribution: attribution,
    bufferRunway: bufferRunway,
    issues: issues,
    anomalies: issues.map(function(x) { return x.message; }),
    health: health,
    recentChanges: attribution && attribution.items ? attribution.items : [],
    suggestedActions: suggestedActions,
    retirement: retirement,
    state: snapshotState,
    sourceUpdated: getDashboardSourceUpdatedMap_(),
    refreshedAt: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss')
  };
}

function getLatestHistorySnapshots_(count) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('OUT - History');
  if (!sheet) return [];

  const values = sheet.getDataRange().getValues();
  const display = sheet.getDataRange().getDisplayValues();
  if (display.length < 2) return [];

  const headers = display[0];
  const runDateCol = headers.indexOf('Run Date');
  const runLabelCol = headers.indexOf('Run Label');
  const investmentsCol = headers.indexOf('Total Financial Assets');
  const houseValuesCol = headers.indexOf('Total Real Estate Assets');
  const debtCol = headers.indexOf('Total Liabilities');
  const assetsCol = headers.indexOf('Total Assets');
  const netWorthCol = headers.indexOf('Net Worth');

  if (runDateCol === -1 || investmentsCol === -1 || houseValuesCol === -1 || debtCol === -1 || assetsCol === -1 || netWorthCol === -1) {
    return [];
  }

  const out = [];
  for (let r = values.length - 1; r >= 1; r--) {
    const runDate = String(display[r][runDateCol] || '').trim();
    if (!runDate) continue;

    out.push({
      runDate: runDate,
      runLabel: runLabelCol === -1 ? '' : String(display[r][runLabelCol] || '').trim(),
      investments: round2_(toNumber_(values[r][investmentsCol])),
      houseValues: round2_(toNumber_(values[r][houseValuesCol])),
      debt: round2_(toNumber_(values[r][debtCol])),
      totalAssets: round2_(toNumber_(values[r][assetsCol])),
      netWorth: round2_(toNumber_(values[r][netWorthCol]))
    });

    if (out.length >= count) break;
  }

  return out;
}

/**
 * INPUT - Debts has no monthly columns; use the latest OUT - History row whose Run Date
 * falls in the prior calendar month (script timezone) for Total Liabilities.
 */
function getPriorMonthTotalDebtFromHistory_() {
  const tz = Session.getScriptTimeZone();
  const now = new Date();
  const parts = Utilities.formatDate(now, tz, 'yyyy-MM-dd').split('-');
  const curY = parseInt(parts[0], 10);
  const curM = parseInt(parts[1], 10);
  var prevY = curY;
  var prevM = curM - 1;
  if (prevM < 1) {
    prevM = 12;
    prevY -= 1;
  }
  const targetMonthIndex = prevM - 1;

  const rows = getAllHistorySnapshotRows_();
  var best = null;
  var bestTime = 0;
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    var d = r.runDate;
    if (d.getFullYear() !== prevY || d.getMonth() !== targetMonthIndex) continue;
    var t = d.getTime();
    if (t > bestTime) {
      bestTime = t;
      best = r;
    }
  }
  if (!best) {
    return { total: null, label: '' };
  }
  var label = Utilities.formatDate(new Date(prevY, targetMonthIndex, 1), tz, 'MMM yyyy');
  return { total: best.debt, label: label };
}

function stripDateOnly_(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function parseHistoryRunDate_(cellValue, displayValue) {
  if (cellValue instanceof Date && !isNaN(cellValue.getTime())) {
    return stripDateOnly_(cellValue);
  }
  const s = String(displayValue || '').trim();
  try {
    const iso = parseIsoDateLocal_(s);
    if (iso) return stripDateOnly_(iso);
  } catch (isoErr) {
    /* not YYYY-MM-DD */
  }
  const parsed = Date.parse(s);
  if (!isNaN(parsed)) return stripDateOnly_(new Date(parsed));
  return null;
}

function getAllHistorySnapshotRows_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('OUT - History');
  if (!sheet) return [];

  const values = sheet.getDataRange().getValues();
  const display = sheet.getDataRange().getDisplayValues();
  if (display.length < 2) return [];

  const headers = display[0];
  const runDateCol = headers.indexOf('Run Date');
  const runLabelCol = headers.indexOf('Run Label');
  const investmentsCol = headers.indexOf('Total Financial Assets');
  const houseValuesCol = headers.indexOf('Total Real Estate Assets');
  const debtCol = headers.indexOf('Total Liabilities');
  const assetsCol = headers.indexOf('Total Assets');
  const netWorthCol = headers.indexOf('Net Worth');

  if (runDateCol === -1 || investmentsCol === -1 || houseValuesCol === -1 || debtCol === -1 || assetsCol === -1 || netWorthCol === -1) {
    return [];
  }

  const out = [];
  for (let r = 1; r < values.length; r++) {
    const runDateObj = parseHistoryRunDate_(values[r][runDateCol], display[r][runDateCol]);
    if (!runDateObj) continue;

    out.push({
      runDate: runDateObj,
      runLabel: runLabelCol === -1 ? '' : String(display[r][runLabelCol] || '').trim(),
      investments: round2_(toNumber_(values[r][investmentsCol])),
      houseValues: round2_(toNumber_(values[r][houseValuesCol])),
      debt: round2_(toNumber_(values[r][debtCol])),
      totalAssets: round2_(toNumber_(values[r][assetsCol])),
      netWorth: round2_(toNumber_(values[r][netWorthCol]))
    });
  }

  return out;
}

function pickWeeklyBaselineFromRows_(rows) {
  const tz = Session.getScriptTimeZone();
  const now = new Date();
  const today = stripDateOnly_(now);
  const cutoff = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 7);

  if (!rows.length) {
    return {
      baseline: null,
      insufficientHistory: true,
      note: 'No rows in OUT - History yet. Run the planner to record history.',
      daysSinceBaseline: null
    };
  }

  const older = rows.filter(function(r) {
    return r.runDate.getTime() <= cutoff.getTime();
  });

  if (older.length) {
    older.sort(function(a, b) {
      return b.runDate.getTime() - a.runDate.getTime();
    });
    const b = older[0];
    const days = Math.round((today.getTime() - b.runDate.getTime()) / 86400000);
    return {
      baseline: b,
      insufficientHistory: false,
      note: '',
      daysSinceBaseline: days
    };
  }

  rows.sort(function(a, b) {
    return a.runDate.getTime() - b.runDate.getTime();
  });
  const oldest = rows[0];
  const days = Math.round((today.getTime() - oldest.runDate.getTime()) / 86400000);
  return {
    baseline: oldest,
    insufficientHistory: true,
    note:
      'No planner run at least 7 days ago yet — comparing to earliest available (' +
      Utilities.formatDate(oldest.runDate, tz, 'MMM d, yyyy') +
      ').',
    daysSinceBaseline: days
  };
}

function buildNetWorthAttributionWeekly_(current, pickMeta) {
  const b = pickMeta && pickMeta.baseline;
  const tz = Session.getScriptTimeZone();

  if (!pickMeta || !b) {
    return {
      items: [],
      baselineLabel: '',
      baselineDetail: '',
      note: (pickMeta && pickMeta.note) || 'No OUT - History data.',
      insufficientHistory: true,
      comparisonMode: 'weekly'
    };
  }

  const items = [
    {
      key: 'financialAssets',
      label: 'Financial Assets',
      value: round2_(current.investments - b.investments)
    },
    {
      key: 'realEstate',
      label: 'Real Estate Value',
      value: round2_(current.houseValues - b.houseValues)
    },
    {
      key: 'liabilities',
      label: 'Total Liabilities',
      value: round2_(b.debt - current.debt)
    },
    {
      key: 'netWorth',
      label: 'Net Worth',
      value: round2_(current.netWorth - b.netWorth)
    }
  ];

  const dateFmt = Utilities.formatDate(b.runDate, tz, 'MMM d, yyyy');
  const baselineLabel = b.runLabel ? b.runLabel + ' · ' + dateFmt : dateFmt;
  const todayForDetail = stripDateOnly_(new Date());
  const cutoffForDetail = new Date(todayForDetail.getFullYear(), todayForDetail.getMonth(), todayForDetail.getDate() - 7);
  let baselineDetail =
    'Live sheet balances vs planner run on ' +
    dateFmt +
    ' (' +
    (pickMeta.daysSinceBaseline != null ? pickMeta.daysSinceBaseline : '—') +
    ' days ago). Baseline = latest run on or before ' +
    Utilities.formatDate(cutoffForDetail, tz, 'MMM d, yyyy') +
    '.';

  if (pickMeta.insufficientHistory) {
    baselineDetail += ' (No run that old yet — earliest run used.)';
  }

  return {
    items: items,
    baselineLabel: baselineLabel,
    baselineDetail: baselineDetail,
    note: pickMeta.note || '',
    insufficientHistory: pickMeta.insufficientHistory,
    comparisonMode: 'weekly'
  };
}

function getLatestPlannerHistoryMetrics_() {
  return getPlannerHistoryMetricsByOffset_(0);
}

function getPreviousPlannerHistoryMetrics_() {
  return getPlannerHistoryMetricsByOffset_(1);
}

function readPlannerHistoryMetricsRow_(values, display, r) {
  const headers = display[0];
  const cols = {
    runDate: headers.indexOf('Run Date'),
    runLabel: headers.indexOf('Run Label'),
    month: headers.indexOf('Month'),
    mode: headers.indexOf('Mode'),
    stability: headers.indexOf('Monthly Stability'),
    projectedCashFlow: headers.indexOf('Projected Cash Flow'),
    previousCashFlow: headers.indexOf('Previous Month Cash Flow'),
    usableCash: headers.indexOf('Usable Cash After Buffers'),
    ccDebt: headers.indexOf('Total Active Credit Card Debt'),
    totalDebt: headers.indexOf('Total Liabilities'),
    totalAssets: headers.indexOf('Total Assets'),
    minPayments: headers.indexOf('Total Minimum Payments'),
    payoffTarget: headers.indexOf('Estimated Months To Pay Off Target'),
    payoffAll: headers.indexOf('Estimated Months To Pay Off All Cards')
  };

  if (cols.runDate === -1) return null;
  const runDate = String(display[r][cols.runDate] || '').trim();
  if (!runDate) return null;

  return {
    runDate: runDate,
    runLabel: cols.runLabel === -1 ? '' : String(display[r][cols.runLabel] || '').trim(),
    month: cols.month === -1 ? '' : String(display[r][cols.month] || '').trim(),
    mode: cols.mode === -1 ? '' : String(display[r][cols.mode] || '').trim(),
    stability: cols.stability === -1 ? '' : String(display[r][cols.stability] || '').trim(),
    projectedCashFlow: cols.projectedCashFlow === -1 ? 0 : round2_(toNumber_(values[r][cols.projectedCashFlow])),
    previousCashFlow: cols.previousCashFlow === -1 ? 0 : round2_(toNumber_(values[r][cols.previousCashFlow])),
    usableCash: cols.usableCash === -1 ? 0 : round2_(toNumber_(values[r][cols.usableCash])),
    ccDebt: cols.ccDebt === -1 ? 0 : round2_(toNumber_(values[r][cols.ccDebt])),
    totalDebt: cols.totalDebt === -1 ? 0 : round2_(toNumber_(values[r][cols.totalDebt])),
    totalAssets: cols.totalAssets === -1 ? 0 : round2_(toNumber_(values[r][cols.totalAssets])),
    minPayments: cols.minPayments === -1 ? 0 : round2_(toNumber_(values[r][cols.minPayments])),
    payoffTarget: cols.payoffTarget === -1 ? 0 : round2_(toNumber_(values[r][cols.payoffTarget])),
    payoffAll: cols.payoffAll === -1 ? 0 : round2_(toNumber_(values[r][cols.payoffAll]))
  };
}

function getPlannerHistoryMetricsByOffset_(offsetFromLatest) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('OUT - History');
  if (!sheet) return null;

  const values = sheet.getDataRange().getValues();
  const display = sheet.getDataRange().getDisplayValues();
  if (display.length < 2) return null;

  const headers = display[0];
  const runDateCol = headers.indexOf('Run Date');
  if (runDateCol === -1) return null;

  const validRows = [];
  for (let r = values.length - 1; r >= 1; r--) {
    const runDate = String(display[r][runDateCol] || '').trim();
    if (!runDate) continue;
    validRows.push(r);
  }

  if (offsetFromLatest >= validRows.length) return null;

  const r = validRows[offsetFromLatest];
  return readPlannerHistoryMetricsRow_(values, display, r);
}

/** Latest planner run in the prior calendar month (script TZ), for health score MoM. */
function getPriorMonthPlannerHistoryMetrics_() {
  const tz = Session.getScriptTimeZone();
  const now = new Date();
  const parts = Utilities.formatDate(now, tz, 'yyyy-MM-dd').split('-');
  const curY = parseInt(parts[0], 10);
  const curM = parseInt(parts[1], 10);
  var prevY = curY;
  var prevM = curM - 1;
  if (prevM < 1) {
    prevM = 12;
    prevY -= 1;
  }
  const targetMonthIndex = prevM - 1;

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('OUT - History');
  if (!sheet) return { metrics: null, label: '' };

  const values = sheet.getDataRange().getValues();
  const display = sheet.getDataRange().getDisplayValues();
  if (display.length < 2) return { metrics: null, label: '' };

  const headers = display[0];
  const runDateCol = headers.indexOf('Run Date');
  if (runDateCol === -1) return { metrics: null, label: '' };

  var bestRow = -1;
  var bestTime = 0;
  for (var r = 1; r < values.length; r++) {
    const runDateObj = parseHistoryRunDate_(values[r][runDateCol], display[r][runDateCol]);
    if (!runDateObj) continue;
    if (runDateObj.getFullYear() !== prevY || runDateObj.getMonth() !== targetMonthIndex) continue;
    const t = runDateObj.getTime();
    if (t > bestTime) {
      bestTime = t;
      bestRow = r;
    }
  }
  if (bestRow === -1) return { metrics: null, label: '' };

  const metrics = readPlannerHistoryMetricsRow_(values, display, bestRow);
  if (!metrics) return { metrics: null, label: '' };

  const label = Utilities.formatDate(new Date(prevY, targetMonthIndex, 1), tz, 'MMM yyyy');
  return { metrics: metrics, label: label };
}

function buildBufferRunway_(latestMetrics, cash) {
  // Truly-blank case: no planner history AND no live cash signal.
  // Without this guard, `buildRunwayFromValues_(0, 0, 0)` returns a
  // confident-sounding "Growing / stable · Projected monthly cash
  // flow is non-negative." payload because `cf >= 0` is vacuously true
  // when every input is zero. On a brand-new workbook that reads as
  // the planner asserting things are fine before the user has entered
  // a single number — the same "false confidence" class of bug we
  // just removed from the Retirement tab + Overview Retirement card.
  //
  // `buildRunwayFromValues_` stays unchanged: its math contract is
  // correct (zeros in → "non-negative" out) and other callers / the
  // partial-cash branch below still rely on it. We fix the issue at
  // the caller layer where we can still tell "no signal at all" from
  // "legitimate zeros". Payload shape is preserved so the existing
  // `renderBufferRunway` path renders it with no UI change.
  const numericCash = Number(cash);
  const hasLiveCashSignal = !isNaN(numericCash) && numericCash > 0;
  if (!latestMetrics && !hasLiveCashSignal) {
    return {
      months: null,
      label: '—',
      detail: 'Run the planner to see how long your cash covers burn.',
      monthsLine: null
    };
  }
  if (!latestMetrics) {
    return buildRunwayFromValues_(cash, 0, 0);
  }
  return buildRunwayFromValues_(latestMetrics.usableCash, latestMetrics.projectedCashFlow, latestMetrics.minPayments);
}

/**
 * minPaymentsOpt: optional total minimum payments (planner). When projected cash flow is non-negative,
 * monthsLine uses usable ÷ min payments as "months of minimum-payment coverage". When cash flow is
 * negative (burn mode), monthsLine is omitted so the UI does not repeat the same value as label.
 */
function buildRunwayFromValues_(usableCash, projectedCashFlow, minPaymentsOpt) {
  const usable = Number(usableCash || 0);
  const cf = Number(projectedCashFlow || 0);
  const minPay = Number(minPaymentsOpt || 0);

  if (cf >= 0) {
    var monthsLine = '—';
    if (usable > 0 && minPay > 0) {
      monthsLine = round2_(usable / minPay).toFixed(1) + ' months';
    } else if (usable > 0 && minPay <= 0) {
      monthsLine = 'Many months+';
    }
    return {
      months: null,
      label: 'Growing / stable',
      detail: 'Projected monthly cash flow is non-negative.',
      monthsLine: monthsLine
    };
  }

  const burn = Math.abs(cf);
  const months = burn > 0 ? round2_(usable / burn) : null;

  if (usable <= 0) {
    return {
      months: 0,
      label: '0.0 months',
      detail: 'Usable cash is already at or below zero.',
      monthsLine: null
    };
  }

  return {
    months: months,
    label: months === null ? '—' : months.toFixed(1) + ' months',
    detail: 'Based on usable cash after buffers and projected monthly cash flow.',
    monthsLine: null
  };
}

function computeFinancialHealthScoreNumber_(metrics, upcomingData) {
  let score = 100;
  const drivers = [];
  const upcoming = upcomingData || {
    overduePlannedCount: 0,
    overduePlannedAmount: 0,
    next7PlannedAmount: 0,
    next30PlannedAmount: 0
  };

  if (metrics.projectedCashFlow < 0) {
    const penalty = Math.min(35, Math.ceil(Math.abs(metrics.projectedCashFlow) / 5000) * 5);
    score -= penalty;
    drivers.push('Projected cash flow is negative at ' + fmtCurrency_(metrics.projectedCashFlow) + '.');
  } else {
    drivers.push('Projected cash flow is positive at ' + fmtCurrency_(metrics.projectedCashFlow) + '.');
  }

  if (metrics.usableCash < 0) {
    score -= 20;
    drivers.push('Usable cash after buffers is negative.');
  } else if (metrics.usableCash < 25000) {
    score -= 10;
    drivers.push('Usable cash after buffers is tight at ' + fmtCurrency_(metrics.usableCash) + '.');
  } else {
    drivers.push('Usable cash after buffers is healthy at ' + fmtCurrency_(metrics.usableCash) + '.');
  }

  const debtToAssets = metrics.totalAssets > 0 ? (metrics.totalDebt / metrics.totalAssets) : 0;
  if (debtToAssets >= 0.50) {
    score -= 20;
    drivers.push('Debt is high relative to assets (' + round2_(debtToAssets * 100) + '%).');
  } else if (debtToAssets >= 0.30) {
    score -= 10;
    drivers.push('Debt-to-assets ratio is elevated (' + round2_(debtToAssets * 100) + '%).');
  }

  if (metrics.ccDebt >= 100000) {
    score -= 15;
    drivers.push('Active credit card debt is very high at ' + fmtCurrency_(metrics.ccDebt) + '.');
  } else if (metrics.ccDebt >= 50000) {
    score -= 8;
    drivers.push('Active credit card debt is elevated at ' + fmtCurrency_(metrics.ccDebt) + '.');
  }

  if (metrics.payoffAll >= 48) {
    score -= 20;
    drivers.push('Estimated payoff horizon is long at ' + round2_(metrics.payoffAll) + ' months.');
  } else if (metrics.payoffAll >= 24) {
    score -= 10;
    drivers.push('Estimated payoff horizon is moderate at ' + round2_(metrics.payoffAll) + ' months.');
  }

  if (upcoming.overduePlannedCount > 0) {
    score -= Math.min(10, upcoming.overduePlannedCount * 2);
    drivers.push(upcoming.overduePlannedCount + ' overdue upcoming expense(s).');
  }

  score = Math.max(0, Math.min(100, round2_(score)));
  return { score: score, drivers: drivers };
}

function buildFinancialHealthScore_(latestMetrics, upcoming) {
  if (!latestMetrics) {
    return {
      score: null,
      label: 'Unavailable',
      color: 'neutral',
      summary: 'Run the planner to generate health scoring.',
      drivers: [],
      baselineLabel: '',
      trend: null
    };
  }

  const upcomingData = upcoming || {
    overduePlannedCount: 0,
    overduePlannedAmount: 0,
    next7PlannedAmount: 0,
    next30PlannedAmount: 0
  };

  const current = computeFinancialHealthScoreNumber_(latestMetrics, upcomingData);
  const score = current.score;
  const drivers = current.drivers;

  let label = 'Critical';
  let color = 'bad';
  if (score >= 85) {
    label = 'Strong';
    color = 'great';
  } else if (score >= 70) {
    label = 'Good';
    color = 'good';
  } else if (score >= 55) {
    label = 'Fair';
    color = 'fair';
  } else if (score >= 40) {
    label = 'At Risk';
    color = 'warn';
  }

  let trend = null;
  const priorPack = getPriorMonthPlannerHistoryMetrics_();
  if (priorPack.metrics) {
    const emptyUpcoming = {
      overduePlannedCount: 0,
      overduePlannedAmount: 0,
      next7PlannedAmount: 0,
      next30PlannedAmount: 0
    };
    const prior = computeFinancialHealthScoreNumber_(priorPack.metrics, emptyUpcoming);
    trend = {
      change: round2_(score - prior.score),
      monthLabel: priorPack.label
    };
  }

  return {
    score: score,
    label: label,
    color: color,
    summary: label + ' financial health based on the latest planner run and upcoming obligations.',
    drivers: drivers,
    baselineLabel: latestMetrics.runLabel || latestMetrics.runDate || '',
    trend: trend
  };
}

function buildDashboardIssues_(ss, snapshot) {
  const out = [];

  // Phase A2: required sheets (SYS - Accounts / INPUT - Debts) may be
  // absent on a fresh / not-yet-set-up workbook. Skip the corresponding
  // issue categories instead of letting "Missing sheet (after
  // retry+flush)" bubble up and abort the whole snapshot.
  try {
    getAccountsBelowMinBufferIssues_(getSheet_(ss, 'ACCOUNTS')).forEach(function(issue) {
      out.push(issue);
    });
  } catch (_accountsIssuesMissingErr) {
    // No Accounts sheet yet → no bank-buffer issues to surface.
  }

  try {
    getHighUtilizationDebtIssues_(getSheet_(ss, 'DEBTS'), 80).forEach(function(issue) {
      out.push(issue);
    });
  } catch (_debtsIssuesMissingErr) {
    // No Debts sheet yet → no utilization issues to surface.
  }

  const upcoming = snapshot.upcoming || {};
  const upcomingRows = upcoming.rows || [];

  upcomingRows.forEach(function(row) {
    if (row.status !== 'Planned') return;

    if (row.dayBucket === 'Overdue') {
      out.push({
        type: 'upcoming_overdue',
        severity: 'danger',
        tab: 'upcoming',
        expenseId: row.id,
        message: 'Upcoming expense "' + row.expenseName + '" is overdue at ' + fmtCurrency_(row.amount) + ' due ' + row.dueDate + '.'
      });
    }
  });

  if (snapshot.bufferRunway && snapshot.bufferRunway.months !== null && snapshot.bufferRunway.months < 6) {
    out.push({
      type: 'buffer_runway',
      severity: snapshot.bufferRunway.months < 3 ? 'danger' : 'warn',
      tab: 'bank',
      message: 'Buffer runway is only ' + snapshot.bufferRunway.label + '.'
    });
  }

  if (snapshot.retirement && snapshot.retirement.analysis) {
    const ra = snapshot.retirement.analysis;
    if (ra.shortfallAtTargetAge > 0) {
      out.push({
        type: 'retirement_gap',
        severity: 'info',
        tab: 'retirement',
        message: 'Retirement shortfall at target age is ' + fmtCurrency_(ra.shortfallAtTargetAge) + '.'
      });
    }
  }

  return sortIssuesBySeverity_(out).slice(0, 24);
}

function getAccountsBelowMinBufferIssues_(sheet) {
  const values = sheet.getDataRange().getValues();
  const display = sheet.getDataRange().getDisplayValues();
  if (display.length < 2) return [];

  const headers = display[0];
  const nameCol = headers.indexOf('Account Name');
  const balanceCol = headers.indexOf('Current Balance');
  const availableCol = headers.indexOf('Available Now');
  const bufferCol = headers.indexOf('Min Buffer');

  if (nameCol === -1 || bufferCol === -1) return [];

  const out = [];

  for (let r = 1; r < values.length; r++) {
    const name = String(display[r][nameCol] || '').trim();
    if (!name) continue;

    const minBuffer = toNumber_(values[r][bufferCol]);
    const compareValue = availableCol !== -1
      ? toNumber_(values[r][availableCol])
      : (balanceCol !== -1 ? toNumber_(values[r][balanceCol]) : 0);

    if (minBuffer > 0 && compareValue < minBuffer) {
      const gap = round2_(minBuffer - compareValue);
      out.push({
        type: 'bank_buffer',
        severity: gap >= 5000 ? 'danger' : 'warn',
        tab: 'bank',
        accountName: name,
        message: name + ' is below min buffer by ' + fmtCurrency_(gap) + '.',
        gap: gap
      });
    }
  }

  return out;
}

function getHighUtilizationDebtIssues_(sheet, thresholdPct) {
  const values = sheet.getDataRange().getValues();
  const display = sheet.getDataRange().getDisplayValues();
  if (display.length < 2) return [];

  const headers = display[0];
  const nameCol = headers.indexOf('Account Name');
  const balanceCol = headers.indexOf('Account Balance');
  const limitCol = headers.indexOf('Credit Limit');
  const typeCol = headers.indexOf('Type');
  const activeCol = headers.indexOf('Active');
  const minCol = headers.indexOf('Minimum Payment');

  if (nameCol === -1 || balanceCol === -1 || limitCol === -1) return [];

  const out = [];

  for (let r = 1; r < values.length; r++) {
    const name = String(display[r][nameCol] || '').trim();
    if (!name) continue;
    if (name.toUpperCase() === 'TOTAL DEBT') continue;

    const limit = toNumber_(values[r][limitCol]);
    const balance = toNumber_(values[r][balanceCol]);
    const minPayment = minCol === -1 ? 0 : toNumber_(values[r][minCol]);
    const type = typeCol === -1 ? '' : String(display[r][typeCol] || '').trim();

    if (isDebtSheetRowInactive_(display[r], activeCol, balance, minPayment)) continue;

    if (limit <= 0) continue;

    const util = (balance / limit) * 100;
    if (util >= thresholdPct) {
      out.push({
        type: 'debt_utilization',
        severity: util >= 95 ? 'danger' : 'warn',
        tab: 'debts',
        accountName: name,
        debtType: type,
        message: name + ' utilization is ' + round2_(util) + '%.',
        utilizationPct: round2_(util)
      });
    }
  }

  return out;
}

function buildSuggestedActions_(latestMetrics, upcoming, retirement, bufferRunway) {
  const out = [];

  if (latestMetrics && latestMetrics.projectedCashFlow < 0) {
    out.push({
      severity: 'warn',
      title: 'Improve monthly cash flow',
      message: 'Projected cash flow is ' + fmtCurrency_(latestMetrics.projectedCashFlow) + '.',
      ctaLabel: 'Open Quick add',
      tab: 'payments'
    });
  }

  if (bufferRunway && bufferRunway.months !== null && bufferRunway.months < 6) {
    out.push({
      severity: bufferRunway.months < 3 ? 'danger' : 'warn',
      title: 'Strengthen runway',
      message: 'Buffer runway is ' + bufferRunway.label + '.',
      ctaLabel: 'Open bank accounts',
      tab: 'bank'
    });
  }

  if (retirement && retirement.analysis && retirement.analysis.monteCarloSuccessProbabilityPct < 80) {
    out.push({
      severity: 'info',
      title: 'Retirement success can improve',
      message: 'Monte Carlo retirement success is ' + round2_(retirement.analysis.monteCarloSuccessProbabilityPct) + '%.',
      ctaLabel: 'Open retirement',
      tab: 'retirement'
    });
  }

  return sortActionsBySeverity_(dedupeActions_(out)).slice(0, 10);
}

function dedupeActions_(actions) {
  const seen = {};
  return (actions || []).filter(function(a) {
    const key = [a.title, a.tab || '', a.accountName || '', a.expenseId || ''].join('|');
    if (seen[key]) return false;
    seen[key] = true;
    return true;
  });
}

function sortIssuesBySeverity_(issues) {
  const rank = { danger: 0, warn: 1, info: 2 };
  return (issues || []).slice().sort(function(a, b) {
    const ra = Object.prototype.hasOwnProperty.call(rank, a.severity) ? rank[a.severity] : 9;
    const rb = Object.prototype.hasOwnProperty.call(rank, b.severity) ? rank[b.severity] : 9;
    if (ra !== rb) return ra - rb;
    return String(a.message || '').localeCompare(String(b.message || ''));
  });
}

function sortActionsBySeverity_(actions) {
  const rank = { danger: 0, warn: 1, info: 2 };
  return (actions || []).slice().sort(function(a, b) {
    const ra = Object.prototype.hasOwnProperty.call(rank, a.severity) ? rank[a.severity] : 9;
    const rb = Object.prototype.hasOwnProperty.call(rank, b.severity) ? rank[b.severity] : 9;
    if (ra !== rb) return ra - rb;
    return String(a.title || '').localeCompare(String(b.title || ''));
  });
}

function getUpcomingExpenseMetricsSafe_() {
  try {
    if (typeof getUpcomingExpenseMetrics_ === 'function') {
      return getUpcomingExpenseMetrics_();
    }
  } catch (e) {}
  return {
    overduePlannedCount: 0,
    overduePlannedAmount: 0,
    next7PlannedAmount: 0,
    next30PlannedAmount: 0,
    plannedTotalAmount: 0,
    rows: []
  };
}

function saveDashboardBaselineSnapshot_(snapshot) {
  PropertiesService.getScriptProperties().setProperty(
    'DASHBOARD_BASELINE_SNAPSHOT',
    JSON.stringify({
      cash: snapshot.cash,
      investments: snapshot.investments,
      houseEquity: snapshot.houseEquity,
      debt: snapshot.debt,
      netWorth: snapshot.netWorth,
      savedAt: snapshot.refreshedAt
    })
  );
}

function getDashboardBaselineSnapshot_() {
  const raw = PropertiesService.getScriptProperties().getProperty('DASHBOARD_BASELINE_SNAPSHOT');
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (e) {
    return null;
  }
}

/**
 * Like `sumColumnByHeader_` but for OPTIONAL registry sheets (e.g. SYS -
 * Assets, SYS - House Assets) that may legitimately not exist on a
 * workbook whose user has only completed the required setup steps.
 * Returns 0 in every "nothing to sum" case:
 *
 *   - sheet not present in the workbook (typical on fresh onboarding
 *     where the user hasn't touched the optional Houses / Investments
 *     panels yet)
 *   - sheet present but empty (<2 rows) or the requested header is
 *     missing — mirrors the strict helper's short-circuit so legacy
 *     workbooks with partial SYS sheets don't throw
 *
 * Callers that need strict "sheet must exist" validation (required
 * setup sheets, planner internals) MUST keep using the strict
 * `sumColumnByHeader_(getSheet_(ss, KEY), header)` pattern.
 */
function sumColumnByHeaderForOptionalSheet_(ss, sheetKey, headerName) {
  const names = getSheetNames_();
  const sheetName = names[sheetKey];
  if (!sheetName) return 0;

  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return 0;

  try {
    return sumColumnByHeader_(sheet, headerName);
  } catch (_missingHeaderErr) {
    // Legacy or partially-initialized sheet that's missing the requested
    // header — treat as "nothing to sum" rather than surfacing a red
    // banner on the overview.
    return 0;
  }
}

function sumColumnByHeader_(sheet, headerName) {
  const range = sheet.getDataRange();
  const values = range.getValues();
  const display = range.getDisplayValues();

  if (display.length < 2) return 0;

  const headers = display[0];
  const col = headers.indexOf(headerName);
  if (col === -1) {
    throw new Error('Sheet "' + sheet.getName() + '" must contain header: ' + headerName);
  }

  let total = 0;
  for (let r = 1; r < values.length; r++) {
    const rowName = String(display[r][0] || '').trim();
    if (!rowName) continue;
    total += toNumber_(values[r][col]);
  }

  return round2_(total);
}

function sumDebtBalances_(sheet) {
  const values = sheet.getDataRange().getValues();
  const display = sheet.getDataRange().getDisplayValues();

  if (display.length < 2) return 0;

  const headers = display[0];
  const nameCol = headers.indexOf('Account Name');
  const balanceCol = headers.indexOf('Account Balance');
  const activeCol = headers.indexOf('Active');
  const minCol = headers.indexOf('Minimum Payment');

  if (nameCol === -1 || balanceCol === -1) {
    throw new Error('DEBTS must contain Account Name and Account Balance.');
  }

  let total = 0;
  for (let r = 1; r < values.length; r++) {
    const name = String(display[r][nameCol] || '').trim();
    if (!name) continue;
    if (name.toUpperCase() === 'TOTAL DEBT') continue;
    const balance = toNumber_(values[r][balanceCol]);
    const minPayment = minCol === -1 ? 0 : toNumber_(values[r][minCol]);
    if (isDebtSheetRowInactive_(display[r], activeCol, balance, minPayment)) continue;
    total += balance;
  }

  return round2_(total);
}

/**
 * Shared explicit-only inactive test for direct INPUT - Debts sheet readers
 * in dashboard_data.js (high-utilization issues, debt balance totals, debt
 * bills due, payee map).
 *
 *   - Active column present (activeCol !== -1):
 *       explicit 'no'/'n'/'false'/'inactive' → inactive;
 *       blank / anything else              → active.
 *   - Active column missing (legacy workbook):
 *       never inactive — all rows are treated as active, matching
 *       pre-Active-column dashboard behavior.
 *
 * The legacy `balance > 0 || minPayment > 0` fallback still lives in
 * `planner_core.js → normalizeDebts_` for planner/waterfall purposes; it is
 * intentionally NOT applied here so $0-balance debts keep showing up in
 * dashboard aggregates and dropdowns on workbooks that haven't self-healed
 * the Active column yet. `balance` / `minPayment` params are retained for
 * signature compatibility with existing call sites.
 *
 * TOTAL DEBT summary-row handling is the caller's responsibility.
 */
function isDebtSheetRowInactive_(displayRow, activeCol, balance, minPayment) {
  if (activeCol === -1) return false;
  const v = String(displayRow[activeCol] == null ? '' : displayRow[activeCol])
    .trim()
    .toLowerCase();
  return v === 'no' || v === 'n' || v === 'false' || v === 'inactive';
}

function getDebtPaymentBreakdownForDashboard() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const today = new Date();
  const tz = Session.getScriptTimeZone();

  const debtRows = readSheetAsObjects_(ss, 'DEBTS');
  const aliasMap = getAliasMap_();
  const debts = normalizeDebts_(debtRows, aliasMap);

  const nextPayments = buildUpcomingPayments_(debts, today, tz, 7, 30);

  return {
    payNow: (nextPayments.payNow || []).map(function(p) {
      return {
        name: p.name,
        minimumPayment: round2_(p.minimumPayment),
        dueDate: p.dueDate || ''
      };
    }),
    paySoon: (nextPayments.paySoon || []).map(function(p) {
      return {
        name: p.name,
        minimumPayment: round2_(p.minimumPayment),
        dueDate: p.dueDate || ''
      };
    })
  };
}

function getUpcomingBillsDueForDashboard() {
  const data = getUpcomingExpensesUiData();
  const rows = data.expenses || [];

  const buckets = {
    overdue: [],
    next7: []
  };

  rows.forEach(function(r) {
    if (r.status !== 'Planned') return;

    if (r.dayBucket === 'Overdue') {
      buckets.overdue.push({
        id: r.id,
        name: r.expenseName || r.payee,
        amount: round2_(r.amount),
        dueDate: r.dueDate,
        sourceType: 'upcoming'
      });
    } else if (r.dayBucket === 'Today' || r.dayBucket === 'Next 7 Days') {
      buckets.next7.push({
        id: r.id,
        name: r.expenseName || r.payee,
        amount: round2_(r.amount),
        dueDate: r.dueDate,
        sourceType: 'upcoming'
      });
    }
  });

  const debtData = getDebtPaymentBreakdownForDashboard();

  (debtData.payNow || []).forEach(function(r) {
    buckets.next7.push({
      id: '',
      name: r.name,
      amount: round2_(r.minimumPayment),
      dueDate: r.dueDate,
      sourceType: 'debt'
    });
  });

  (debtData.paySoon || []).forEach(function(r) {
    buckets.next7.push({
      id: '',
      name: r.name,
      amount: round2_(r.minimumPayment),
      dueDate: r.dueDate,
      sourceType: 'debt'
    });
  });

  function timeValue_(dateText) {
    if (!dateText) return Number.MAX_SAFE_INTEGER;
    const d = new Date(dateText + 'T00:00:00');
    return isNaN(d.getTime()) ? Number.MAX_SAFE_INTEGER : d.getTime();
  }

  function sortRows_(arr) {
    arr.sort(function(a, b) {
      const diff = timeValue_(a.dueDate) - timeValue_(b.dueDate);
      if (diff !== 0) return diff;
      return String(a.name || '').localeCompare(String(b.name || ''));
    });
    return arr;
  }

  return {
    overdue: sortRows_(buckets.overdue),
    next7: sortRows_(buckets.next7)
  };
}


function getBillsDueFromCashFlowForDashboard(preloadedCurrentCashFlow) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureActivityLogSheet_(ss);
  const today = new Date();
  const tz = Session.getScriptTimeZone();

  // First-run safety: the Bills Due calculation reads from the current
  // year's Cash Flow sheet. On a freshly-onboarded workbook that sheet
  // may not exist yet, in which case getDebtBillsDueRows_ /
  // getInputBillsDueRows_ would throw "Missing cash flow sheet: …" and
  // the Bills page would surface a red error after saving the first
  // bill. Creating it on demand via the centralized safe helper is a
  // no-op if the sheet already exists (populated workbooks unchanged).
  try {
    if (typeof ensureCashFlowYearSheet_ === 'function') {
      ensureCashFlowYearSheet_(today.getFullYear());
    }
  } catch (_e) { /* fall through; downstream will surface a clear error */ }

  // Optional `preloadedCurrentCashFlow` is the raw snapshot returned by
  // readCashFlowSheetRaw_ (shape: { year, sheet, values, display,
  // headers }). When the caller has already fetched the current-year
  // grid (e.g. runDebtPlanner reads it once up-front), we reuse those
  // arrays in getDebtBillsDueRows_ instead of re-fetching them here.
  // Existing callers (dashboard loader, Bills Due UI, next_actions, the
  // email path when preload is unavailable) pass nothing and get the
  // historical behavior. We only accept the preload when its year
  // matches today's year — stale cross-year preloads are ignored.
  const preloadForDebtRows =
    preloadedCurrentCashFlow &&
    preloadedCurrentCashFlow.values &&
    preloadedCurrentCashFlow.year === today.getFullYear()
      ? preloadedCurrentCashFlow
      : null;

  const debtRows = getDebtBillsDueRows_(ss, today, tz, preloadForDebtRows);
  const inputBillRows = getInputBillsDueRows_(ss, today, tz);

  const allRows = debtRows.concat(inputBillRows);

  const overdue = [];
  const next7 = [];
  const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  allRows.forEach(function(row) {
    const dueDate = parseIsoDateAtLocal_(row.dueDate);
    if (!dueDate) return;

    const diffDays = Math.floor((dueDate.getTime() - todayOnly.getTime()) / 86400000);

    if (diffDays < 0) {
      overdue.push(row);
    } else if (diffDays <= 7) {
      next7.push(row);
    }
  });

  overdue.sort(compareBillsByDueDate_);
  next7.sort(compareBillsByDueDate_);

  return {
    overdue: overdue,
    next7: next7
  };
}


function getRecurringBillsWithoutDueDateForDashboard() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const today = new Date();
  const tz = Session.getScriptTimeZone();

  const currentYear = today.getFullYear();
  const currentMonthIndex = today.getMonth();
  const nextDate = new Date(currentYear, currentMonthIndex + 1, 1);

  // First-run safety: ensure the current-year Cash Flow sheet exists
  // before any dependent reads run. Mirrors the guard at the top of
  // getBillsDueFromCashFlowForDashboard — see the comment there.
  try {
    if (typeof ensureCashFlowYearSheet_ === 'function') {
      ensureCashFlowYearSheet_(currentYear);
    }
  } catch (_e) { /* fall through; downstream will surface a clear error */ }

  const currentSheet = getCashFlowSheet_(ss, currentYear);
  const currentValues = currentSheet.getDataRange().getValues();
  const currentDisplay = currentSheet.getDataRange().getDisplayValues();
  if (currentDisplay.length < 2) return [];

  const currentHeaders = currentDisplay[0];
  const currentMonthHeader = monthHeaderFromYearMonth_(currentYear, currentMonthIndex);
  const currentMonthCol = currentHeaders.indexOf(currentMonthHeader);
  if (currentMonthCol === -1) return [];

  // Resolve Type/Payee by header label so inserting a column (e.g. "Flow
  // Source") between them on the sheet does not silently mis-align reads.
  const currentHeaderMap = getCashFlowHeaderMap_(currentSheet);

  // Next-month read is best-effort: when today is in December, the
  // following month lives in next year's Cash Flow sheet, which may
  // not exist yet (especially on a blank workbook). tryGetCashFlowSheet_
  // returns null instead of throwing so the recurring-bills list can
  // still render the current-month portion without a red banner.
  const nextSheet = typeof tryGetCashFlowSheet_ === 'function'
    ? tryGetCashFlowSheet_(ss, nextDate.getFullYear())
    : null;
  const nextValues = nextSheet ? nextSheet.getDataRange().getValues() : [];
  const nextDisplay = nextSheet ? nextSheet.getDataRange().getDisplayValues() : [];
  const nextHeaders = nextDisplay.length ? nextDisplay[0] : [];
  const nextMonthHeader = monthHeaderFromYearMonth_(nextDate.getFullYear(), nextDate.getMonth());
  const nextMonthCol = nextHeaders.length ? nextHeaders.indexOf(nextMonthHeader) : -1;

  const mappedBills = getInputBillsPayeeMap_(ss);
  const debtBills = getDebtPayeeMap_(ss);

  const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const result = [];

  for (let r = 1; r < currentValues.length; r++) {
    const type = String(currentDisplay[r][currentHeaderMap.typeColZero] || '').trim();
    const payee = String(currentDisplay[r][currentHeaderMap.payeeColZero] || '').trim();

    if (type !== 'Expense') continue;
    if (!payee) continue;

    if (mappedBills[normalizeBillName_(payee)]) continue;
    if (debtBills[normalizeBillName_(payee)]) continue;

    /* hasHistory gate removed: show unmapped expenses even when only the current month has activity.
       Revert: require non-zero in some month column other than currentMonthCol before currentCellValue. */

    const currentCellValue = currentValues[r][currentMonthCol];
    const currentCellDisplay = currentDisplay[r][currentMonthCol];

    const currentDueDate = new Date(currentYear, currentMonthIndex, 1);
    const currentHandled = isCashFlowBillHandled_(currentCellValue, currentCellDisplay);

    if (!currentHandled) {
      result.push({
        id: 'fallback::' + payee + '::' + currentMonthHeader,
        payee: payee,
        name: payee,
        amount: 0,
        dueDate: Utilities.formatDate(currentDueDate, tz, 'yyyy-MM-dd'),
        sourceType: 'fallback',
        sourceLabel: 'Fallback',
        category: '',
        autopay: '',
        varies: '',
        notes: 'Not yet mapped in INPUT - Bills',
        year: currentYear,
        monthHeader: currentMonthHeader
      });
      continue;
    }

    if (nextMonthCol === -1) continue;
    if (!nextValues[r] || !nextDisplay[r]) continue;

    const nextCellValue = nextValues[r][nextMonthCol];
    const nextCellDisplay = nextDisplay[r][nextMonthCol];
    const nextHandled = isCashFlowBillHandled_(nextCellValue, nextCellDisplay);
    if (nextHandled) continue;

    const nextDueDate = new Date(nextDate.getFullYear(), nextDate.getMonth(), 1);
    const diffDays = Math.floor((nextDueDate.getTime() - todayOnly.getTime()) / 86400000);

    if (diffDays <= 7) {
      result.push({
        id: 'fallback::' + payee + '::' + nextMonthHeader,
        payee: payee,
        name: payee,
        amount: 0,
        dueDate: Utilities.formatDate(nextDueDate, tz, 'yyyy-MM-dd'),
        sourceType: 'fallback',
        sourceLabel: 'Fallback',
        category: '',
        autopay: '',
        varies: '',
        notes: 'Not yet mapped in INPUT - Bills',
        year: nextDate.getFullYear(),
        monthHeader: nextMonthHeader
      });
    }
  }

  result.sort(function(a, b) {
    const dateCmp = String(a.dueDate || '').localeCompare(String(b.dueDate || ''));
    if (dateCmp !== 0) return dateCmp;
    return String(a.name || '').localeCompare(String(b.name || ''));
  });

  return result;
}

function isCashFlowBillHandled_(cellValue, cellDisplay) {
  const displayText = String(cellDisplay || '').trim();
  if (displayText === '') return false;

  const num = Number(cellValue);
  if (!isNaN(num)) return true;

  return false;
}

/** True when INPUT - Debts Type is Credit Card (whitespace/case normalized). */
function isDebtCreditCardType_(debtType) {
  const t = String(debtType || '').trim().toLowerCase().replace(/\s+/g, ' ');
  return t === 'credit card';
}

/*
function isCashFlowBillHandled_(cellValue, cellDisplay) {
  const displayText = String(cellDisplay || '').trim();
  if (displayText === '') return false;

  const num = Number(cellValue);
  if (!isNaN(num) && num !== 0) return true;

  return false;
}
*/

function getDebtBillsDueRows_(ss, today, tz, preloadedCurrentCashFlow) {
  const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  // Only honor the preload when it carries the exact current-year
  // snapshot we would otherwise fetch. Nothing below treats a null
  // preload specially — all reads fall through to the sheet as today.
  const usablePreload =
    preloadedCurrentCashFlow &&
    preloadedCurrentCashFlow.values &&
    preloadedCurrentCashFlow.display &&
    preloadedCurrentCashFlow.headers &&
    preloadedCurrentCashFlow.sheet &&
    preloadedCurrentCashFlow.year === today.getFullYear()
      ? preloadedCurrentCashFlow
      : null;

  function buildMonthContext_(baseDate, offsetMonths) {
    const d = new Date(baseDate.getFullYear(), baseDate.getMonth() + offsetMonths, 1);
    const year = d.getFullYear();
    const monthIndex = d.getMonth();
    const monthHeader = monthNames[monthIndex] + '-' + String(year).slice(-2);
    // Reuse the caller-provided sheet reference when the preload
    // covers this context's year (current-month path only). Otherwise
    // fall back to the existing lookup, which also handles the
    // next-month context sheet (may live in next year's tab).
    const sheet = usablePreload && usablePreload.year === year
      ? usablePreload.sheet
      : (typeof tryGetCashFlowSheet_ === 'function'
        ? tryGetCashFlowSheet_(ss, year)
        : ss.getSheetByName(getCashFlowSheetName_(year)));
    return {
      year: year,
      monthIndex: monthIndex,
      monthHeader: monthHeader,
      sheet: sheet
    };
  }

  function buildDueDate_(ctx, dueDay) {
    if (!dueDay) return null;
    const d = new Date(ctx.year, ctx.monthIndex, dueDay);
    return isNaN(d.getTime()) ? null : d;
  }

  const currentCtx = buildMonthContext_(today, 0);
  const nextCtx = buildMonthContext_(today, 1);

  // First-run safety: INPUT - Debts may be missing on a blank workbook.
  // Treat missing as "no debt bills due" so the Bills page can render
  // cleanly without a red "Missing sheet: INPUT - Debts" banner.
  var debtSheet = ss.getSheetByName(getSheetNames_().DEBTS);
  if (!debtSheet) return [];
  const debtValues = debtSheet.getDataRange().getValues();
  const debtDisplay = debtSheet.getDataRange().getDisplayValues();
  if (debtDisplay.length < 2) return [];

  const debtHeaders = debtDisplay[0];
  const debtNameCol = debtHeaders.indexOf('Account Name');
  const debtDueCol = debtHeaders.indexOf('Due Date');
  const debtTypeCol = debtHeaders.indexOf('Type');
  const debtMinCol = debtHeaders.indexOf('Minimum Payment');
  const debtBalanceCol = debtHeaders.indexOf('Account Balance');
  const debtActiveCol = debtHeaders.indexOf('Active');

  const debtMap = {};

  if (debtNameCol !== -1) {
    for (let r = 1; r < debtValues.length; r++) {
      const rawName = String(debtDisplay[r][debtNameCol] || '').trim();
      if (!rawName) continue;
      if (rawName.toUpperCase() === 'TOTAL DEBT') continue;

      const rowBalance = debtBalanceCol === -1 ? 0 : toNumber_(debtValues[r][debtBalanceCol]);
      const rowMin = debtMinCol === -1 ? 0 : toNumber_(debtValues[r][debtMinCol]);
      if (isDebtSheetRowInactive_(debtDisplay[r], debtActiveCol, rowBalance, rowMin)) continue;

      debtMap[normalizeBillName_(rawName)] = {
        dueDay: debtDueCol === -1 ? null : Number(debtValues[r][debtDueCol]) || null,
        debtType: debtTypeCol === -1 ? '' : String(debtDisplay[r][debtTypeCol] || '').trim(),
        minimumPayment: debtMinCol === -1 ? 0 : round2_(Math.abs(toNumber_(debtValues[r][debtMinCol])))
      };
    }
  }

  // First-run safety: current-year Cash Flow may be missing on a blank
  // workbook. The caller (getBillsDueFromCashFlowForDashboard) tries to
  // ensure it, but defensively bail out with no rows so the Bills page
  // can still render instead of surfacing "Missing cash flow sheet".
  if (!currentCtx.sheet) return [];

  // Prefer the caller-provided raw snapshot when it matches this
  // context's year — it's the exact same data we would otherwise read
  // here. When absent (no preload, or a mismatched year), fall back to
  // the original getDataRange() path so every existing caller keeps
  // behaving identically.
  const currentValues =
    usablePreload && usablePreload.year === currentCtx.year
      ? usablePreload.values
      : currentCtx.sheet.getDataRange().getValues();
  const currentDisplay =
    usablePreload && usablePreload.year === currentCtx.year
      ? usablePreload.display
      : currentCtx.sheet.getDataRange().getDisplayValues();
  if (currentDisplay.length < 2) return [];

  const currentHeaders = currentDisplay[0];
  const currentMonthCol = currentHeaders.indexOf(currentCtx.monthHeader);
  if (currentMonthCol === -1) return [];

  // Header-driven lookup of Type / Payee (they may no longer live at [0] / [1]
  // once the Flow Source column is inserted between them on the sheet).
  const currentHeaderMap = getCashFlowHeaderMap_(currentCtx.sheet);

  const nextValues = nextCtx.sheet ? nextCtx.sheet.getDataRange().getValues() : [];
  const nextDisplay = nextCtx.sheet ? nextCtx.sheet.getDataRange().getDisplayValues() : [];
  const nextHeaders = nextDisplay.length ? nextDisplay[0] : [];
  const nextMonthCol = nextHeaders.length ? nextHeaders.indexOf(nextCtx.monthHeader) : -1;

  const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const rows = [];

  for (let r = 1; r < currentValues.length; r++) {
    const type = String(currentDisplay[r][currentHeaderMap.typeColZero] || '').trim();
    const payee = String(currentDisplay[r][currentHeaderMap.payeeColZero] || '').trim();

    if (type !== 'Expense') continue;
    if (!payee) continue;

    const match = debtMap[normalizeBillName_(payee)] || null;
    if (!match || !match.dueDay) continue;

    const currentDueDate = buildDueDate_(currentCtx, match.dueDay);
    const nextDueDate = buildDueDate_(nextCtx, match.dueDay);

    let chosenDueDate = null;
    let chosenYear = null;
    let chosenMonthHeader = '';
    let cellValue = '';
    let cellDisplay = '';

    if (currentDueDate) {
      if (currentDueDate.getTime() >= todayOnly.getTime()) {
        chosenDueDate = currentDueDate;
        chosenYear = currentCtx.year;
        chosenMonthHeader = currentCtx.monthHeader;
        cellValue = currentValues[r][currentMonthCol];
        cellDisplay = currentDisplay[r][currentMonthCol];
      } else if (!isCashFlowBillHandled_(currentValues[r][currentMonthCol], currentDisplay[r][currentMonthCol])) {
        chosenDueDate = currentDueDate;
        chosenYear = currentCtx.year;
        chosenMonthHeader = currentCtx.monthHeader;
        cellValue = currentValues[r][currentMonthCol];
        cellDisplay = currentDisplay[r][currentMonthCol];
      } else if (nextDueDate && nextMonthCol !== -1) {
        chosenDueDate = nextDueDate;
        chosenYear = nextCtx.year;
        chosenMonthHeader = nextCtx.monthHeader;
        cellValue = nextValues[r] ? nextValues[r][nextMonthCol] : '';
        cellDisplay = nextDisplay[r] ? nextDisplay[r][nextMonthCol] : '';
      }
    }

    if (!chosenDueDate) continue;
    if (isCashFlowBillHandled_(cellValue, cellDisplay)) continue;

    const suggestedAmount = match.minimumPayment && match.minimumPayment > 0 ? match.minimumPayment : 0;
    if (!isDebtCreditCardType_(match.debtType) && !suggestedAmount) continue;

    // Debt bills originate from INPUT - Debts, which has no Payment Source
    // column. Infer the Cash Flow Flow Source from the debt Type: Credit
    // Card payments come out of CREDIT_CARD (they reduce a CC balance);
    // everything else (Loan, HELOC, etc.) defaults to CASH.
    const debtPaymentSource = isDebtCreditCardType_(match.debtType)
      ? 'CREDIT_CARD'
      : 'CASH';

    rows.push({
      id: buildDashboardBillSkipKey_(payee, Utilities.formatDate(chosenDueDate, tz, 'yyyy-MM-dd')),
      payee: payee,
      name: payee,
      amount: round2_(suggestedAmount),
      dueDate: Utilities.formatDate(chosenDueDate, tz, 'yyyy-MM-dd'),
      sourceType: 'debt',
      debtType: match.debtType || '',
      matchedToDebt: true,
      minimumPayment: round2_(match.minimumPayment || 0),
      paymentSource: debtPaymentSource,
      year: chosenYear,
      monthHeader: chosenMonthHeader
    });
  }

  return rows;
}

function getInputBillsDueRows_(ss, today, tz) {
  // First-run safety: INPUT - Bills may be missing on a blank workbook.
  // Treat missing as "no bills due" so the Bills page can render
  // cleanly without a red "Missing sheet: INPUT - Bills" banner.
  var billsSheet = ss.getSheetByName(getSheetNames_().BILLS);
  if (!billsSheet) return [];
  const values = billsSheet.getDataRange().getValues();
  const display = billsSheet.getDataRange().getDisplayValues();
  if (display.length < 2) return [];

  const headers = display[0];
  // Case-insensitive lookup: some workbooks ship with ALL-CAPS headers
  // ("PAYMENT SOURCE" vs "Payment Source"), which a strict indexOf would miss
  // and quietly drop the Payment Source → Flow Source propagation.
  const findHeaderIdx = (label) => {
    const want = String(label || '').trim().toLowerCase();
    for (let i = 0; i < headers.length; i++) {
      if (String(headers[i] || '').trim().toLowerCase() === want) return i;
    }
    return -1;
  };
  const colMap = {
    payee: findHeaderIdx('Payee'),
    category: findHeaderIdx('Category'),
    dueDay: findHeaderIdx('Due Day'),
    defaultAmount: findHeaderIdx('Default Amount'),
    varies: findHeaderIdx('Varies'),
    autopay: findHeaderIdx('Autopay'),
    active: findHeaderIdx('Active'),
    frequency: findHeaderIdx('Frequency'),
    startMonth: findHeaderIdx('Start Month'),
    notes: findHeaderIdx('Notes'),
    paymentSource: findHeaderIdx('Payment Source')
  };

  if (colMap.payee === -1 || colMap.dueDay === -1 || colMap.defaultAmount === -1 || colMap.active === -1) {
    throw new Error('Bills sheet must contain Payee, Due Day, Default Amount, and Active headers.');
  }

  const rows = [];
  const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  for (let r = 1; r < values.length; r++) {
    const payee = String(display[r][colMap.payee] || '').trim();
    if (!payee) continue;

    const active = normalizeYesNo_(display[r][colMap.active]);
    if (active !== 'yes') continue;

    const dueDay = Number(values[r][colMap.dueDay]) || 0;
    if (!dueDay) continue;

    const defaultAmount = round2_(Math.abs(toNumber_(values[r][colMap.defaultAmount])));

    const category = colMap.category === -1 ? '' : String(display[r][colMap.category] || '').trim();
    const varies = normalizeYesNo_(colMap.varies === -1 ? '' : display[r][colMap.varies]);
    const autopay = normalizeYesNo_(colMap.autopay === -1 ? '' : display[r][colMap.autopay]);
    const frequency = normalizeFrequency_(display[r][colMap.frequency]);
    const startMonth = colMap.startMonth === -1 ? 1 : (Number(values[r][colMap.startMonth]) || 1);
    const notes = colMap.notes === -1 ? '' : String(display[r][colMap.notes] || '').trim();
    // Normalize to the same canonical form used by Flow Source writes
    // (CASH | CREDIT_CARD). Empty is allowed — downstream callers treat a
    // blank paymentSource as "don't seed Flow Source".
    const paymentSourceRaw = colMap.paymentSource === -1
      ? ''
      : String(display[r][colMap.paymentSource] || '').trim();
    const paymentSource = paymentSourceRaw
      ? paymentSourceRaw.toUpperCase().replace(/[\s-]+/g, '_')
      : '';

    const candidates = buildInputBillDueCandidates_(todayOnly, dueDay, frequency, startMonth);

    for (let i = 0; i < candidates.length; i++) {
      const cand = candidates[i];
      const sheet = getCashFlowSheet_(ss, cand.year);
      const rowMap = getCashFlowRowMap_(sheet);
      const monthCol = rowMap.headers.indexOf(cand.monthHeader);
      if (monthCol === -1) continue;

      // Bills without a matching Cash Flow row are treated as "unhandled" so
      // freshly-added bills (or bills whose payee does not yet live in the
      // Cash Flow grid) still appear in Overdue / Next 7 Days. The autopay
      // write-back below stays gated on the Cash Flow row existing, since we
      // cannot write into a nonexistent row.
      const rowInfo = rowMap.rowsByPayee[payee] || null;
      const hasCashFlowRow =
        !!rowInfo && String(rowInfo.type || '').trim() === 'Expense';

      let cellValue = '';
      let cellDisplay = '';

      if (hasCashFlowRow) {
        const cellRange = sheet.getRange(rowInfo.row, monthCol + 1);
        cellValue = cellRange.getValue();
        cellDisplay = cellRange.getDisplayValue();

        const dueHasPassed = cand.dueDate.getTime() < todayOnly.getTime();
        const canAutopay = autopay === 'yes' && varies !== 'yes';

        if (canAutopay && defaultAmount > 0 && dueHasPassed && !isCashFlowBillHandled_(cellValue, cellDisplay)) {
          writeDashboardBillValuePreserveFormat_(sheet, rowInfo.row, monthCol + 1, -defaultAmount);
          touchDashboardSourceUpdated_('cash_flow');

          var autopayDedupe = buildBillAutopayDedupeKey_(payee, cand.monthHeader, cand.dueDate, defaultAmount);
          appendActivityLog_(ss, {
            eventType: 'bill_autopay',
            entryDate: Utilities.formatDate(cand.dueDate, tz, 'yyyy-MM-dd'),
            amount: defaultAmount,
            direction: 'expense',
            payee: payee,
            category: category,
            accountSource: '',
            cashFlowSheet: sheet.getName(),
            cashFlowMonth: cand.monthHeader,
            dedupeKey: autopayDedupe,
            details: JSON.stringify({ source: 'INPUT - Bills', autopay: true, varies: varies })
          });

          cellValue = cellRange.getValue();
          cellDisplay = cellRange.getDisplayValue();
        }

        if (isCashFlowBillHandled_(cellValue, cellDisplay)) {
          continue;
        }
      }

      rows.push({
        id: buildDashboardBillSkipKey_(payee, Utilities.formatDate(cand.dueDate, tz, 'yyyy-MM-dd')),
        payee: payee,
        name: payee,
        amount: defaultAmount,
        dueDate: Utilities.formatDate(cand.dueDate, tz, 'yyyy-MM-dd'),
        sourceType: 'input_bill',
        sourceLabel: 'INPUT - Bills',
        category: category,
        varies: varies === 'yes' ? 'Yes' : 'No',
        autopay: autopay === 'yes' ? 'Yes' : 'No',
        // Frontend uses paymentSource to seed Flow Source when Quick Add
        // creates a missing Cash Flow row via Bills → Pay.
        paymentSource: paymentSource,
        startMonth: startMonth,
        year: cand.year,
        monthHeader: cand.monthHeader,
        notes: notes,
        // 1-based INPUT - Bills sheet row — lets Stop tracking target this
        // exact row without a fragile payee-based re-lookup on the server.
        inputBillsRow: r + 1,
        hasCashFlowRow: hasCashFlowRow
      });

      break;
    }
  }

  return rows;
}

/**
 * INPUT - Bills rows shaped like buildUpcomingPayments_ items, split into the same
 * Pay now (0..payNowWindowDays) and Pay soon (payNowWindowDays+1 .. paySoonWindowDays)
 * windows as the debt planner email. Omits overdue (negative days) so they stay only
 * in the email Overdue section from getBillsDueFromCashFlowForDashboard.
 */
function buildInputBillPlannerPaymentWindows_(today, tz, payNowWindowDays, paySoonWindowDays) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const rows = getInputBillsDueRows_(ss, today, tz);
  const todayOnly = stripTime_(today);
  const payNow = [];
  const paySoon = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const due = parseIsoDateAtLocal_(row.dueDate);
    if (!due || isNaN(due.getTime())) continue;

    const daysUntilDue = daysBetween_(todayOnly, stripTime_(due));
    if (daysUntilDue < 0) continue;

    const item = {
      account: String(row.payee || row.name || '').trim() || 'Bill',
      type: 'Bill',
      dueDate: String(row.dueDate || '').trim(),
      daysUntilDue: Math.round(daysUntilDue),
      minimumPayment: round2_(Math.abs(toNumber_(row.amount))),
      balance: 0,
      interestRate: 0
    };

    if (daysUntilDue <= payNowWindowDays) payNow.push(item);
    else if (daysUntilDue <= paySoonWindowDays) paySoon.push(item);
  }

  payNow.sort(function(a, b) {
    if (a.daysUntilDue !== b.daysUntilDue) return a.daysUntilDue - b.daysUntilDue;
    return String(a.account).localeCompare(String(b.account));
  });
  paySoon.sort(function(a, b) {
    if (a.daysUntilDue !== b.daysUntilDue) return a.daysUntilDue - b.daysUntilDue;
    return String(a.account).localeCompare(String(b.account));
  });

  return { payNow: payNow, paySoon: paySoon };
}

function buildInputBillDueCandidates_(todayOnly, dueDay, frequency, startMonth) {
  const candidates = [];
  const monthOffsets = [0, 1];
  const effectiveStart = Math.min(12, Math.max(1, Number(startMonth) || 1));
  const todayYear = todayOnly.getFullYear();

  for (let i = 0; i < monthOffsets.length; i++) {
    const offset = monthOffsets[i];
    const d = new Date(todayOnly.getFullYear(), todayOnly.getMonth() + offset, 1);
    const year = d.getFullYear();
    const monthNumber = d.getMonth() + 1;

    if (!billAppliesInMonth_(frequency, effectiveStart, monthNumber)) continue;

    // Hard skip: never surface a candidate month earlier than the bill's
    // Start Month inside the same calendar year as today. This keeps
    // monthly/biweekly/weekly bills from reporting as "Due" — or being
    // autopaid — in Jan/Feb/Mar for a bill whose Start Month is April.
    // Candidate months that roll into a later calendar year are always
    // eligible (once a bill has started, it keeps running).
    if (year === todayYear && monthNumber < effectiveStart) continue;

    const dueDate = new Date(year, d.getMonth(), dueDay);
    if (isNaN(dueDate.getTime())) continue;

    candidates.push({
      year: year,
      monthIndex: d.getMonth(),
      monthHeader: monthHeaderFromYearMonth_(year, d.getMonth()),
      dueDate: dueDate
    });
  }

  candidates.sort(function(a, b) {
    return a.dueDate.getTime() - b.dueDate.getTime();
  });

  return candidates;
}

function getInputBillsPayeeMap_(ss) {
  // First-run safety: INPUT - Bills may be missing on a blank workbook.
  // Treat missing as "no mapped bills" so callers (recurring-bills
  // fallback, cross-reference maps) don't throw during Bills first load.
  var sheet = ss.getSheetByName(getSheetNames_().BILLS);
  if (!sheet) return {};
  const display = sheet.getDataRange().getDisplayValues();
  if (display.length < 2) return {};

  const headers = display[0];
  const payeeCol = headers.indexOf('Payee');
  const activeCol = headers.indexOf('Active');

  const out = {};
  if (payeeCol === -1) return out;

  for (let r = 1; r < display.length; r++) {
    const payee = String(display[r][payeeCol] || '').trim();
    if (!payee) continue;

    const active = activeCol === -1 ? 'yes' : normalizeYesNo_(display[r][activeCol]);
    if (active !== 'yes') continue;

    out[normalizeBillName_(payee)] = true;
  }

  return out;
}

function getDebtPayeeMap_(ss) {
  // First-run safety: INPUT - Debts may be missing on a blank workbook.
  // Treat missing as "no debt payees" so the recurring-bills fallback
  // and cross-reference maps don't throw during Bills first load.
  var sheet = ss.getSheetByName(getSheetNames_().DEBTS);
  if (!sheet) return {};
  const display = sheet.getDataRange().getDisplayValues();
  const values = sheet.getDataRange().getValues();
  if (display.length < 2) return {};

  const headers = display[0];
  const payeeCol = headers.indexOf('Account Name');
  const activeCol = headers.indexOf('Active');
  const balanceCol = headers.indexOf('Account Balance');
  const minCol = headers.indexOf('Minimum Payment');

  const out = {};
  if (payeeCol === -1) return out;

  for (let r = 1; r < display.length; r++) {
    const payee = String(display[r][payeeCol] || '').trim();
    if (!payee) continue;
    if (payee.toUpperCase() === 'TOTAL DEBT') continue;

    const balance = balanceCol === -1 ? 0 : toNumber_(values[r][balanceCol]);
    const minPayment = minCol === -1 ? 0 : toNumber_(values[r][minCol]);
    if (isDebtSheetRowInactive_(display[r], activeCol, balance, minPayment)) continue;

    out[normalizeBillName_(payee)] = true;
  }

  return out;
}

function getCashFlowRowMap_(sheet) {
  const display = sheet.getDataRange().getDisplayValues();
  if (display.length < 2) {
    return { headers: [], rowsByPayee: {} };
  }

  const headers = display[0];
  const typeCol = headers.indexOf('Type');
  const payeeCol = headers.indexOf('Payee');

  if (typeCol === -1 || payeeCol === -1) {
    throw new Error('Cash Flow sheet must contain Type and Payee.');
  }

  const rowsByPayee = {};
  for (let r = 1; r < display.length; r++) {
    const payee = String(display[r][payeeCol] || '').trim();
    if (!payee) continue;

    rowsByPayee[payee] = {
      row: r + 1,
      type: String(display[r][typeCol] || '').trim()
    };
  }

  return {
    headers: headers,
    rowsByPayee: rowsByPayee
  };
}

function monthHeaderFromYearMonth_(year, monthIndexZero) {
  const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return monthNames[monthIndexZero] + '-' + String(year).slice(-2);
}

function normalizeYesNo_(value) {
  const v = String(value || '').trim().toLowerCase();
  if (v === 'yes' || v === 'y' || v === 'true') return 'yes';
  return 'no';
}

function normalizeFrequency_(value) {
  const v = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
  if (v === 'quarterly') return 'quarterly';
  if (v === 'biweekly') return 'biweekly';
  if (v === 'weekly') return 'weekly';
  if (v === 'yearly' || v === 'annual' || v === 'annually' || v === 'yealry') return 'yearly';
  if (
    v === 'semi annually' ||
    v === 'semi-annually' ||
    v === 'semiannually' ||
    v === 'semi annual' ||
    v === 'semi-annual'
  ) {
    return 'semi_annually';
  }
  if (v === 'bimonthly' || v === 'bi-monthly' || v === 'bi monthly') return 'bimonthly';
  return 'monthly';
}

function billAppliesInMonth_(frequency, startMonth, monthNumber1to12) {
  const start = Math.min(12, Math.max(1, Number(startMonth) || 1));

  if (frequency === 'monthly' || frequency === 'biweekly' || frequency === 'weekly') {
    return true;
  }
  if (frequency === 'yearly') {
    return monthNumber1to12 === start;
  }
  if (frequency === 'semi_annually') {
    const second = start + 6 > 12 ? start + 6 - 12 : start + 6;
    return monthNumber1to12 === start || monthNumber1to12 === second;
  }
  if (frequency === 'bimonthly') {
    const diff = (monthNumber1to12 - start + 12) % 12;
    return diff % 2 === 0;
  }
  if (frequency === 'quarterly') {
    const diff = (monthNumber1to12 - start + 12) % 12;
    return diff % 3 === 0;
  }
  return true;
}

function writeDashboardBillValuePreserveFormat_(sheet, row, col, value) {
  const cell = sheet.getRange(row, col);

  const fontColor = cell.getFontColor();
  const fontSize = cell.getFontSize();
  const fontWeight = cell.getFontWeight();
  const fontStyle = cell.getFontStyle();
  const fontLine = cell.getFontLine();
  const fontFamily = cell.getFontFamily();
  const background = cell.getBackground();
  const numberFormat = cell.getNumberFormat();
  const horizontalAlignment = cell.getHorizontalAlignment();
  const verticalAlignment = cell.getVerticalAlignment();
  const wrap = cell.getWrap();

  cell.setValue(value);

  cell
    .setFontColor(fontColor)
    .setFontSize(fontSize)
    .setFontWeight(fontWeight)
    .setFontStyle(fontStyle)
    .setFontLine(fontLine)
    .setFontFamily(fontFamily)
    .setBackground(background)
    .setNumberFormat(numberFormat)
    .setHorizontalAlignment(horizontalAlignment)
    .setVerticalAlignment(verticalAlignment)
    .setWrap(wrap);
}

function parseIsoDateAtLocal_(isoDate) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(isoDate || '').trim());
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function compareBillsByDueDate_(a, b) {
  const dateCmp = String(a.dueDate || '').localeCompare(String(b.dueDate || ''));
  if (dateCmp !== 0) return dateCmp;
  return String(a.name || '').localeCompare(String(b.name || ''));
}

function normalizeBillName_(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/['".,]/g, '')
    .replace(/\s+/g, ' ')
    .replace('credit card - sw', 'credit card - southwest')
    .replace('credit card - capone', 'credit card - capital one')
    .replace('kohls', "kohl's")
    .trim();
}

function buildDashboardBillSkipKey_(payee, dueDate) {
  return 'dashboard_bill_skip::' + String(payee || '').trim() + '::' + String(dueDate || '').trim();
}

function buildDashboardRecurringSkipKey_(payee, year, monthHeader) {
  return 'dashboard_recurring_skip::' + String(payee || '').trim() + '::' + String(year || '') + '::' + String(monthHeader || '').trim();
}

function skipDashboardBill(skipKey) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const info = resolveDashboardBillSkipTarget_(ss, skipKey);

  if (!info || !info.sheet || !info.row || !info.col) {
    throw new Error('Could not resolve bill skip target.');
  }

  const cell = info.sheet.getRange(info.row, info.col);
  const currentValue = cell.getValue();
  const currentDisplay = String(cell.getDisplayValue() || '').trim();

  const isBlank =
    currentValue === '' ||
    currentValue === null ||
    typeof currentValue === 'undefined' ||
    currentDisplay === '';

  if (isBlank) {
    const fontColor = cell.getFontColor();
    const fontSize = cell.getFontSize();
    const fontWeight = cell.getFontWeight();
    const fontStyle = cell.getFontStyle();
    const fontLine = cell.getFontLine();
    const fontFamily = cell.getFontFamily();
    const background = cell.getBackground();
    const numberFormat = cell.getNumberFormat();
    const horizontalAlignment = cell.getHorizontalAlignment();
    const verticalAlignment = cell.getVerticalAlignment();
    const wrap = cell.getWrap();

    cell.setValue(0);

    cell
      .setFontColor(fontColor)
      .setFontSize(fontSize)
      .setFontWeight(fontWeight)
      .setFontStyle(fontStyle)
      .setFontLine(fontLine)
      .setFontFamily(fontFamily)
      .setBackground(background)
      .setNumberFormat(numberFormat)
      .setHorizontalAlignment(horizontalAlignment)
      .setVerticalAlignment(verticalAlignment)
      .setWrap(wrap);

    var bill = getDashboardBillByKey_(ss, skipKey);
    var monthHdr = bill && bill.monthHeader ? bill.monthHeader : activityLogMonthHeaderFromCell_(info.sheet, info.col);
    var payeeName = bill ? bill.payee : activityLogFallbackPayeeFromSkipKey_(skipKey);
    appendActivityLog_(ss, {
      eventType: 'bill_skip',
      entryDate: bill ? activityLogEntryDateFromSkipBill_(bill) : '',
      amount: 0,
      direction: 'skip',
      payee: payeeName || '(unknown)',
      category: '',
      accountSource: '',
      cashFlowSheet: info.sheet.getName(),
      cashFlowMonth: monthHdr,
      dedupeKey: 'bill_skip::' + String(skipKey || '').trim(),
      details: JSON.stringify({ skipKey: skipKey, wroteZero: true, billResolved: !!bill })
    });

    return {
      ok: true,
      message: 'Bill skipped for this cycle. Wrote 0 into Cash Flow.'
    };
  }

  return {
    ok: true,
    message: 'Cash Flow already has a value, so it was left unchanged.'
  };
}

function resolveDashboardBillSkipTarget_(ss, skipKey) {
  const bill = getDashboardBillByKey_(ss, skipKey);
  if (!bill) return null;

  const year = Number(bill.year);
  const monthHeader = bill.monthHeader;
  const payee = bill.payee;

  const sheet = getCashFlowSheet_(ss, year);
  const display = sheet.getDataRange().getDisplayValues();

  if (display.length < 2) return null;

  const headers = display[0];
  const payeeCol = headers.indexOf('Payee');
  const monthCol = headers.indexOf(monthHeader);

  if (payeeCol === -1 || monthCol === -1) {
    throw new Error('Could not find Payee or month column in Cash Flow.');
  }

  for (let r = 1; r < display.length; r++) {
    const rowPayee = String(display[r][payeeCol] || '').trim();
    if (rowPayee === payee) {
      return {
        sheet: sheet,
        row: r + 1,
        col: monthCol + 1
      };
    }
  }

  return null;
}

function getDashboardBillByKey_(ss, skipKey) {
  const text = String(skipKey || '').trim();
  if (!text) return null;

  if (text.indexOf('dashboard_bill_skip::') === 0) {
    const parts = text.split('::');
    if (parts.length < 3) return null;

    const payee = String(parts[1] || '').trim();
    const dueDate = String(parts[2] || '').trim();
    if (!payee || !dueDate) return null;

    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dueDate);
    if (!m) return null;

    const year = Number(m[1]);
    const monthNum = Number(m[2]);
    if (!year || !monthNum) return null;

    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const monthHeader = monthNames[monthNum - 1] + '-' + String(year).slice(-2);

    return {
      payee: payee,
      dueDate: dueDate,
      year: year,
      monthHeader: monthHeader
    };
  }

  if (text.indexOf('dashboard_recurring_skip::') === 0) {
    const parts = text.split('::');
    if (parts.length < 4) return null;

    return {
      payee: String(parts[1] || '').trim(),
      year: Number(parts[2] || 0),
      monthHeader: String(parts[3] || '').trim()
    };
  }

  return null;
}