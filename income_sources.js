/**
 * Income sources — Cash Flow is the canonical source of truth.
 *
 * There is intentionally no separate INPUT - Income Sources sheet. The
 * Income screen is a thin management layer over the latest
 * `INPUT - Cash Flow <year>` tab:
 *
 *   Display   → scan the latest Cash Flow year that has any Income rows,
 *               group rows by a conservatively normalized payee name,
 *               and return separate active/inactive tracked inventories.
 *
 *   Add       → write a Cash Flow Income row in the current year
 *               (Type=Income, Flow Source=CASH, Active=YES, Payee=name)
 *               and set the current month cell. No past/future month
 *               auto-fill in v1. This immediately affects monthly Cash
 *               Flow totals.
 *
 *   Stop      → flip Active=NO on the exact displayed Cash Flow Income
 *               rows. Reactivate flips only those same Active cells back to
 *               YES. History and monthly amounts are preserved.
 *
 * Activity only tracks user-triggered actions performed here
 * (`income_add` / `income_deactivate` / `income_reactivate`). Historical Cash Flow income is
 * never retroactively logged — that kept the previous architecture
 * noisy and confusing.
 */

/* -------------------------------------------------------------------------- */
/*  Shared constants                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Maximum years we'll walk back from the current year when probing for a
 * Cash Flow tab that contains Income rows. Kept small and local so the
 * Income screen never re-scans the full sheet history.
 */
var INCOME_MAX_YEARS_BACK_ = 5;

/**
 * Tracked-income gate: one positive month is enough for a non-excluded active
 * source to appear on the main list. The dashboard Add flow writes the current
 * month only, so a higher threshold hid a source immediately after the user
 * explicitly added it and made Income disagree with Setup.
 */
var INCOME_MIN_MONTHS_FOR_RECURRING_ = 1;

var CISCO_MID_YEAR_BONUS_PAYEE_ = 'Cisco Mid Year Bonus';
var CISCO_END_YEAR_BONUS_PAYEE_ = 'Cisco End Year Bonus';
var CISCO_BONUS_TRUSTED_2026_MID_AMOUNT_ = 22766.25;
var CISCO_BONUS_TRUSTED_2026_END_AMOUNT_ = 56476.24;

/* -------------------------------------------------------------------------- */
/*  Name normalization and exclusion (shared by display + other-detected)     */
/* -------------------------------------------------------------------------- */

/**
 * Conservative, rule-based normalization of a Cash Flow Payee into a
 * display name. Only intentionally narrow rewrites are applied — we
 * never "cluster" unrelated payees. Each rule targets a specific,
 * user-confirmed family of Cash Flow row names; everything else passes
 * through with whitespace normalization only.
 */
function normalizeIncomeName_(payee) {
  var s = String(payee || '').trim().replace(/\s+/g, ' ');
  if (!s) return '';

  // "Cisco Pay", "Cisco Pay 1", "Cisco Pay 2", "Cisco Pay 3",
  // "Cisco Pay 3 (some months)", etc. The trailing numeric qualifier
  // is typically a paycheck split (stock vs cash, base vs supplemental)
  // for the same employer; an optional parenthetical suffix tags rows
  // that only apply to a subset of months. Both still represent the
  // same salary stream, so we collapse them into one row.
  if (/^cisco\s+pay(?:\s+\d+)?(?:\s*\(.*\))?$/i.test(s)) {
    return 'Cisco Salary';
  }
  if (/^cisco\s+mid\s+year\s+bonus$/i.test(s)) {
    return CISCO_MID_YEAR_BONUS_PAYEE_;
  }
  if (/^cisco\s+end\s+year\s+bonus$/i.test(s)) {
    return CISCO_END_YEAR_BONUS_PAYEE_;
  }
  if (/^cisco\s+bonus(?:\s+\d+)?(?:\s*\(.*\))?$/i.test(s)) {
    return 'Cisco Bonus';
  }

  // "Rent Oakley House", "Rent Oakley House - Unit A", etc. Tenant /
  // unit suffixes are logged separately but represent the same
  // property-level income stream.
  if (/^rent\s+oakley\s+house(?:\s*-\s*.+)?$/i.test(s)) {
    return 'Rent Oakley House';
  }

  return s;
}

/**
 * Obvious non-recurring income labels (bonuses, refunds, one-off stock
 * sales, etc.). These groups never show up in the main tracked list,
 * even if they happen to appear in >= the min-months threshold. They
 * still surface in the "Other detected income" reference section so
 * users can see them.
 */
function canonicalizeIncomePayeeKey_(payee) {
  return String(payee || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function isCiscoMidYearBonusIncomeName_(payee) {
  return canonicalizeIncomePayeeKey_(payee) ===
    canonicalizeIncomePayeeKey_(CISCO_MID_YEAR_BONUS_PAYEE_);
}

function isCiscoEndYearBonusIncomeName_(payee) {
  return canonicalizeIncomePayeeKey_(payee) ===
    canonicalizeIncomePayeeKey_(CISCO_END_YEAR_BONUS_PAYEE_);
}

function isCiscoNamedAnnualBonusIncomeName_(payee) {
  return isCiscoMidYearBonusIncomeName_(payee) || isCiscoEndYearBonusIncomeName_(payee);
}

function isLegacyCiscoBonusIncomeName_(payee) {
  if (isCiscoNamedAnnualBonusIncomeName_(payee)) return false;
  var s = String(payee || '').trim();
  if (!s) return false;
  var normalized = normalizeIncomeName_(s) || s;
  return /^cisco\s+bonus$/i.test(normalized);
}

function isCiscoBonusIncomeName_(payee) {
  return isCiscoNamedAnnualBonusIncomeName_(payee) || isLegacyCiscoBonusIncomeName_(payee);
}

function incomeIsExcludedName_(name) {
  var s = String(name || '').toLowerCase();
  if (!s) return true;
  var patterns = [
    /\bbonus\b/,
    /\brefund\b/,
    /\brsu\b/,
    /\bespp\b/,
    /\bstock\s+sale\b/,
    /\bdeposit\b/,
    /\bother\s+money\b/
  ];
  for (var i = 0; i < patterns.length; i++) {
    if (patterns[i].test(s)) return true;
  }
  return false;
}

/* -------------------------------------------------------------------------- */
/*  Cash Flow year probes                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Walk backward from the current year until we find an
 * `INPUT - Cash Flow YYYY` tab that both exists and contains at least
 * one *active* Income row. Returns the year (number) or null if none
 * qualifies within the window.
 */
function findLatestCashFlowYearWithIncome_(ss) {
  var startYear = getCurrentYear_();
  for (var i = 0; i <= INCOME_MAX_YEARS_BACK_; i++) {
    var y = startYear - i;
    var sheet;
    try {
      // getCashFlowSheet_ throws when the tab is missing; treat that as
      // "skip this year" rather than a fatal error so the probe keeps
      // walking backward.
      sheet = getCashFlowSheet_(ss, y);
    } catch (e) {
      sheet = null;
    }
    if (!sheet) continue;
    if (cashFlowSheetHasActiveIncomeRows_(sheet)) return y;
  }
  return null;
}

/**
 * Latest year containing any Income row, including rows explicitly stopped.
 * Management uses this probe so stopping the last active source never makes
 * the UI fall back to an older year and hide the recoverable identity.
 */
function findLatestCashFlowYearWithAnyIncome_(ss) {
  var startYear = getCurrentYear_();
  for (var i = 0; i <= INCOME_MAX_YEARS_BACK_; i++) {
    var y = startYear - i;
    var sheet;
    try { sheet = getCashFlowSheet_(ss, y); } catch (e) { sheet = null; }
    if (!sheet || sheet.getLastRow() < 2) continue;
    var headerMap;
    try { headerMap = getCashFlowHeaderMap_(sheet); } catch (mapErr) { continue; }
    var display = sheet.getDataRange().getDisplayValues();
    for (var r = 1; r < display.length; r++) {
      var row = display[r] || [];
      if (String(row[headerMap.typeColZero] || '').trim().toLowerCase() !== 'income') continue;
      if (String(row[headerMap.payeeColZero] || '').trim()) return y;
    }
  }
  return null;
}

function cashFlowSheetHasActiveIncomeRows_(sheet) {
  if (!sheet) return false;
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return false;
  var headerMap;
  try {
    headerMap = getCashFlowHeaderMap_(sheet);
  } catch (e) {
    return false;
  }
  var display = sheet.getDataRange().getDisplayValues();
  for (var r = 1; r < display.length; r++) {
    var row = display[r] || [];
    var typeVal = String(row[headerMap.typeColZero] || '').trim().toLowerCase();
    if (typeVal !== 'income') continue;
    var payee = String(row[headerMap.payeeColZero] || '').trim();
    if (!payee) continue;
    if (headerMap.activeColZero !== -1) {
      var rawActive = String(row[headerMap.activeColZero] || '').trim();
      if (rawActive && normalizeYesNo_(rawActive) === 'no') continue;
    }
    return true;
  }
  return false;
}

/* -------------------------------------------------------------------------- */
/*  Group analysis                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Scan a single Cash Flow sheet, group *active* Income rows by
 * normalized name, and return per-group monthly stats.
 *
 * Each group's `monthly` array sums that month's cell values across
 * every raw row that maps to the same normalized name. A salary split
 * across "Cisco Pay 1" + "Cisco Pay 2" therefore rolls up into a
 * single combined monthly series before we look at cadence.
 *
 * @returns {Array<{
 *   displayName: string,
 *   rawPayees: Array<string>,
 *   monthsHit: number,        // count of months with sum > 0
 *   avgNonZero: number,       // average of those months' combined sums
 *   hasNegativeMonth: boolean,
 *   excluded: boolean
 * }>}
 */
function analyzeIncomeGroupsInSheet_(sheet, optionalDisplay, optionalHeaderMap) {
  if (!sheet) return [];
  var display = optionalDisplay || sheet.getDataRange().getDisplayValues();
  if (!display || display.length < 2) return [];
  var headerMap;
  try {
    headerMap = optionalHeaderMap || getCashFlowHeaderMapFromHeaders_(display[0] || []);
  } catch (e) {
    return [];
  }

  var headers = display[0] || [];
  // Identify month columns by parsing the "MMM-YY" header pattern.
  // Non-month columns (Type, Payee, Flow Source, Active, etc.) won't
  // match and are silently ignored.
  var monthCols = [];
  for (var c = 0; c < headers.length; c++) {
    if (parseMonthHeader_(headers[c])) monthCols.push(c);
  }
  if (!monthCols.length) return [];

  var typeCol = headerMap.typeColZero;
  var payeeCol = headerMap.payeeColZero;
  var activeCol = headerMap.activeColZero;

  var groups = {};
  for (var r = 1; r < display.length; r++) {
    var row = display[r] || [];
    var typeVal = String(row[typeCol] || '').trim().toLowerCase();
    if (typeVal !== 'income') continue;
    if (activeCol !== -1) {
      var rawActive = String(row[activeCol] || '').trim();
      if (rawActive && normalizeYesNo_(rawActive) === 'no') continue;
    }
    var payeeRaw = String(row[payeeCol] || '').trim();
    if (!payeeRaw) continue;
    var normalized = normalizeIncomeName_(payeeRaw);
    if (!normalized) continue;
    var key = normalized.toLowerCase();
    if (!groups[key]) {
      groups[key] = {
        displayName: normalized,
        rawPayees: [],
        monthly: []
      };
      for (var m0 = 0; m0 < monthCols.length; m0++) groups[key].monthly.push(0);
    }
    if (groups[key].rawPayees.indexOf(payeeRaw) === -1) {
      groups[key].rawPayees.push(payeeRaw);
    }
    for (var mi = 0; mi < monthCols.length; mi++) {
      var val = toNumber_(row[monthCols[mi]]);
      if (isFinite(val)) groups[key].monthly[mi] += val;
    }
  }

  var out = [];
  Object.keys(groups).forEach(function(k) {
    var g = groups[k];
    var posSum = 0;
    var posCount = 0;
    var hasNegative = false;
    for (var mi2 = 0; mi2 < g.monthly.length; mi2++) {
      var v = g.monthly[mi2];
      if (!isFinite(v)) continue;
      // "Positive month" means strictly > 0. A negative combined month
      // signals refunds / reversals and disqualifies the group on its
      // own.
      if (v > 0) { posSum += v; posCount += 1; }
      else if (v < 0) hasNegative = true;
    }
    out.push({
      displayName: g.displayName,
      rawPayees: g.rawPayees,
      monthsHit: posCount,
      avgNonZero: posCount > 0 ? round2_(posSum / posCount) : 0,
      hasNegativeMonth: hasNegative,
      excluded: incomeIsExcludedName_(g.displayName)
    });
  });

  out.sort(function(a, b) {
    return a.displayName.toLowerCase().localeCompare(b.displayName.toLowerCase());
  });
  return out;
}

function incomeGroupQualifiesAsRecurring_(group) {
  if (!group) return false;
  if (group.excluded) return false;
  if (group.hasNegativeMonth) return false;
  if (Number(group.monthsHit) < INCOME_MIN_MONTHS_FOR_RECURRING_) return false;
  if (Number(group.avgNonZero) <= 0) return false;
  return true;
}

/**
 * Analyze every Income row (active and inactive) for lifecycle management.
 * The returned row evidence is intentionally exact: Reactivate must prove the
 * same rows/payees still represent the group before changing Active cells.
 */
function analyzeIncomeLifecycleGroupsInSheet_(sheet) {
  if (!sheet || sheet.getLastRow() < 2) return [];
  var display = sheet.getDataRange().getDisplayValues();
  var headerMap;
  try { headerMap = getCashFlowHeaderMapFromHeaders_(display[0] || []); }
  catch (e) { return []; }

  var monthCols = [];
  for (var c = 0; c < display[0].length; c++) {
    if (parseMonthHeader_(display[0][c])) monthCols.push(c);
  }
  if (!monthCols.length) return [];

  var groups = {};
  for (var r = 1; r < display.length; r++) {
    var row = display[r] || [];
    if (String(row[headerMap.typeColZero] || '').trim().toLowerCase() !== 'income') continue;
    var payee = String(row[headerMap.payeeColZero] || '').trim();
    var normalized = normalizeIncomeName_(payee);
    if (!normalized) continue;
    var key = normalized.toLowerCase();
    var inactive = false;
    if (headerMap.activeColZero !== -1) {
      var rawActive = String(row[headerMap.activeColZero] || '').trim();
      inactive = !!rawActive && normalizeYesNo_(rawActive) === 'no';
    }
    if (!groups[key]) {
      groups[key] = {
        groupKey: key,
        displayName: normalized,
        rows: [],
        activeRows: 0,
        inactiveRows: 0,
        activeMonthly: [],
        allMonthly: []
      };
      for (var m = 0; m < monthCols.length; m++) {
        groups[key].activeMonthly.push(0);
        groups[key].allMonthly.push(0);
      }
    }
    var group = groups[key];
    group.rows.push({ sheetRow: r + 1, payee: payee });
    if (inactive) group.inactiveRows += 1;
    else group.activeRows += 1;
    for (var mi = 0; mi < monthCols.length; mi++) {
      var amount = toNumber_(row[monthCols[mi]]);
      if (!isFinite(amount)) continue;
      group.allMonthly[mi] += amount;
      if (!inactive) group.activeMonthly[mi] += amount;
    }
  }

  var out = [];
  Object.keys(groups).forEach(function(key) {
    var g = groups[key];
    var monthly = g.activeRows > 0 ? g.activeMonthly : g.allMonthly;
    var positiveTotal = 0;
    var positiveMonths = 0;
    var hasNegative = false;
    for (var i = 0; i < monthly.length; i++) {
      if (monthly[i] > 0) { positiveTotal += monthly[i]; positiveMonths += 1; }
      else if (monthly[i] < 0) hasNegative = true;
    }
    out.push({
      groupKey: g.groupKey,
      displayName: g.displayName,
      rows: g.rows,
      activeRows: g.activeRows,
      inactiveRows: g.inactiveRows,
      lifecycleState: g.activeRows > 0 ? 'active' : 'inactive',
      mixedState: g.activeRows > 0 && g.inactiveRows > 0,
      monthsHit: positiveMonths,
      avgNonZero: positiveMonths ? round2_(positiveTotal / positiveMonths) : 0,
      hasNegativeMonth: hasNegative,
      excluded: incomeIsExcludedName_(g.displayName)
    });
  });
  out.sort(function(a, b) {
    return a.displayName.toLowerCase().localeCompare(b.displayName.toLowerCase());
  });
  return out;
}

/**
 * Single classification source shared by Income and Setup. Every active group
 * belongs to exactly one bucket, so the two surfaces cannot disagree about the
 * same Cash Flow rows.
 */
function classifyIncomeGroupsInSheet_(sheet, optionalDisplay, optionalHeaderMap) {
  var groups = analyzeIncomeGroupsInSheet_(sheet, optionalDisplay, optionalHeaderMap);
  var recurring = [];
  var other = [];
  for (var i = 0; i < groups.length; i++) {
    if (incomeGroupQualifiesAsRecurring_(groups[i])) recurring.push(groups[i]);
    else other.push(groups[i]);
  }
  return { recurring: recurring, other: other };
}

/* -------------------------------------------------------------------------- */
/*  Dashboard: list active income sources                                     */
/* -------------------------------------------------------------------------- */

/**
 * Return the tracked recurring income groups from the latest
 * Cash Flow year as a compact list for the "Manage income sources"
 * surface. Pure read — never writes.
 *
 * Callers receive `year` on every row so the subsequent "Stop tracking"
 * call can operate on the exact same sheet the list was read from.
 *
 * @returns {Array<{
 *   groupKey: string,
 *   sourceName: string,
 *   amount: number,
 *   frequency: string,
 *   year: number,
 *   sheetName: string
 * }>}
 */
function readCashFlowIncomeForecastSchema_(optionalSpreadsheet) {
  var ss = optionalSpreadsheet || getUserSpreadsheet_();
  var year = getCurrentYear_();
  var sheet = null;
  try { sheet = getCashFlowSheet_(ss, year); } catch (_currentErr) { sheet = null; }
  if (!sheet) {
    year = findLatestCashFlowYearWithAnyIncome_(ss);
    if (year == null) {
      return {
        year: null,
        sheetName: '',
        present: false,
        missing: CASH_FLOW_INCOME_FORECAST_HEADERS_.slice(),
        lastSummaryLabel: ''
      };
    }
    try { sheet = getCashFlowSheet_(ss, year); } catch (_latestErr) {
      return {
        year: year,
        sheetName: '',
        present: false,
        missing: CASH_FLOW_INCOME_FORECAST_HEADERS_.slice(),
        lastSummaryLabel: ''
      };
    }
  }
  var lastCol = Math.max(1, sheet.getLastColumn());
  var headers = sheet.getRange(1, 1, 1, lastCol).getDisplayValues()[0] || [];
  var missing = typeof cashFlowIncomeForecastHeadersToAppend_ === 'function'
    ? cashFlowIncomeForecastHeadersToAppend_(headers)
    : ['Recurring', 'Frequency', 'Expected Amount'];
  var lastSummary = typeof cashFlowLastSummaryColumnIndex_ === 'function'
    ? cashFlowLastSummaryColumnIndex_(headers)
    : -1;
  var present = missing.length === 0;
  var needsFormat = false;
  var mismatches = [];
  var mismatchDetails = [];
  if (present) {
    if (typeof inspectCashFlowIncomeForecastFormatting_ === 'function') {
      try {
        var inspection = inspectCashFlowIncomeForecastFormatting_(sheet);
        needsFormat = inspection && inspection.needsFormat === true;
        mismatches = inspection && Array.isArray(inspection.mismatches)
          ? inspection.mismatches.slice()
          : [];
        mismatchDetails = inspection && Array.isArray(inspection.mismatchDetails)
          ? inspection.mismatchDetails.slice()
          : [];
      } catch (_inspectErr) {
        needsFormat = true;
        mismatches = ['Cash Flow forecast header formatting could not be read.'];
      }
    } else {
      needsFormat = true;
    }
  }
  return {
    year: year,
    sheetName: sheet.getName(),
    present: present,
    missing: missing,
    needsFormat: needsFormat === true,
    mismatches: mismatches,
    mismatchDetails: mismatchDetails,
    lastSummaryLabel: lastSummary >= 0 ? String(headers[lastSummary] || '') : ''
  };
}

/**
 * Explicit setup: append Recurring / Frequency / Expected Amount to the
 * current year's Cash Flow sheet after Totals / Yearly Total. Never inserts
 * an income row and never writes month cells, totals, or formulas.
 */
function addIncomeForecastColumnsFromDashboard(optionalSpreadsheet) {
  var ss = optionalSpreadsheet || getUserSpreadsheet_();
  var lock = LockService.getUserLock();
  lock.waitLock(10000);
  try {
    var year = getCurrentYear_();
    var sheet;
    try { sheet = getCashFlowSheet_(ss, year); }
    catch (e) {
      throw new Error(
        'Cash Flow sheet for ' + year + ' was not found. Open the current year tab first.'
      );
    }
    var lastCol = Math.max(1, sheet.getLastColumn());
    var headersBefore = sheet.getRange(1, 1, 1, lastCol).getDisplayValues()[0] || [];
    var missing = typeof cashFlowIncomeForecastHeadersToAppend_ === 'function'
      ? cashFlowIncomeForecastHeadersToAppend_(headersBefore)
      : ['Recurring', 'Frequency', 'Expected Amount'];
    if (!missing.length) {
      return {
        ok: true,
        added: [],
        alreadyPresent: true,
        year: year,
        sheetName: sheet.getName(),
        lastSummaryLabel: typeof cashFlowLastSummaryColumnIndex_ === 'function' &&
          cashFlowLastSummaryColumnIndex_(headersBefore) >= 0
          ? String(headersBefore[cashFlowLastSummaryColumnIndex_(headersBefore)] || '')
          : '',
        message: 'Recurring, Frequency, and Expected Amount are already on ' +
          sheet.getName() + '.'
      };
    }
    if (typeof ensureCashFlowIncomeForecastSchema_ !== 'function') {
      throw new Error('Cash Flow forecast columns could not be added.');
    }
    ensureCashFlowIncomeForecastSchema_(sheet);
    var headersAfter = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0] || [];
    var stillMissing = cashFlowIncomeForecastHeadersToAppend_(headersAfter);
    if (stillMissing.length) {
      throw new Error('Cash Flow forecast columns could not be verified after adding them.');
    }
    var lastSummary = cashFlowLastSummaryColumnIndex_(headersAfter);
    var lastSummaryLabel = lastSummary >= 0 ? String(headersAfter[lastSummary] || '') : '';
    var recurringIndex = headersAfter.indexOf('Recurring');
    if (lastSummary >= 0 && recurringIndex >= 0 && recurringIndex <= lastSummary) {
      throw new Error('Forecast columns must be added after Totals and Yearly Total.');
    }
    return {
      ok: true,
      added: missing,
      alreadyPresent: false,
      year: year,
      sheetName: sheet.getName(),
      lastSummaryLabel: lastSummaryLabel,
      message: 'Added ' + missing.join(', ') + ' after ' +
        (lastSummaryLabel || 'the existing Cash Flow columns') +
        ' on ' + sheet.getName() +
        '. Existing month amounts, totals, and income rows were not changed.'
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Explicit setup: match Recurring / Frequency / Expected Amount to the
 * existing Cash Flow header style. Never adds columns and never writes
 * values, formulas, month cells, totals, or income rows.
 */
function formatIncomeForecastColumnsFromDashboard(optionalSpreadsheet) {
  var ss = optionalSpreadsheet || getUserSpreadsheet_();
  var lock = LockService.getUserLock();
  lock.waitLock(10000);
  try {
    var year = getCurrentYear_();
    var sheet;
    try { sheet = getCashFlowSheet_(ss, year); }
    catch (e) {
      throw new Error(
        'Cash Flow sheet for ' + year + ' was not found. Open the current year tab first.'
      );
    }
    var lastCol = Math.max(1, sheet.getLastColumn());
    var headers = sheet.getRange(1, 1, 1, lastCol).getDisplayValues()[0] || [];
    var missing = typeof cashFlowIncomeForecastHeadersToAppend_ === 'function'
      ? cashFlowIncomeForecastHeadersToAppend_(headers)
      : ['Recurring', 'Frequency', 'Expected Amount'];
    if (missing.length) {
      throw new Error(
        'Recurring, Frequency, and Expected Amount are not all on ' +
        sheet.getName() +
        '. Add the missing columns first. This action does not add columns.'
      );
    }
    if (typeof formatCashFlowIncomeForecastColumns_ !== 'function') {
      throw new Error('Cash Flow forecast columns could not be formatted.');
    }
    var result = formatCashFlowIncomeForecastColumns_(sheet);
    if (!result || result.formatted !== true || result.added === true) {
      throw new Error('Cash Flow forecast columns could not be formatted without adding columns.');
    }
    if (typeof cashFlowIncomeForecastFlush_ === 'function') cashFlowIncomeForecastFlush_();
    var inspection = typeof inspectCashFlowIncomeForecastFormatting_ === 'function'
      ? inspectCashFlowIncomeForecastFormatting_(sheet)
      : { needsFormat: false, mismatches: [], mismatchDetails: [] };
    var mismatchLines = inspection && Array.isArray(inspection.mismatches)
      ? inspection.mismatches.slice()
      : [];
    var message = 'Formatted Recurring, Frequency, and Expected Amount on ' +
      sheet.getName() +
      ' to match the existing Cash Flow headers. Values, formulas, month columns, totals, and income rows were not changed.';
    if (inspection && inspection.needsFormat === true) {
      message = 'Format ran on ' + sheet.getName() +
        ', but the fresh status read still found mismatches: ' +
        (mismatchLines.length ? mismatchLines.join('; ') : 'headers still need formatting') +
        '. Values, formulas, and income rows were not changed.';
    }
    return {
      ok: true,
      added: false,
      formatted: true,
      needsFormat: inspection && inspection.needsFormat === true,
      mismatches: mismatchLines,
      mismatchDetails: inspection && Array.isArray(inspection.mismatchDetails)
        ? inspection.mismatchDetails.slice()
        : [],
      columns: result.columns || [],
      year: year,
      sheetName: sheet.getName(),
      message: message
    };
  } finally {
    lock.releaseLock();
  }
}

function ciscoBonusHistoryValueIsFormula_(value) {
  return typeof value === 'string' && String(value).trim().charAt(0) === '=';
}

function ciscoBonusHistoryCellAmount_(value, display) {
  if (ciscoBonusHistoryValueIsFormula_(value) || ciscoBonusHistoryValueIsFormula_(display)) {
    return { formula: true, known: false, amount: null, present: true };
  }
  var known = typeof debtMinimumPaymentCellIsKnown_ === 'function'
    ? debtMinimumPaymentCellIsKnown_(value, display)
    : String(display == null ? '' : display).trim() !== '';
  if (!known) return { formula: false, known: false, amount: null, present: false };
  var amount = round2_(toNumber_(value));
  return {
    formula: false,
    known: true,
    amount: amount,
    present: amount !== 0
  };
}

function listCashFlowMonthColumnsForBonusSplit_(headers) {
  var out = [];
  (headers || []).forEach(function(header, col) {
    if (typeof parseMonthHeader_ !== 'function') return;
    var parsed = parseMonthHeader_(header);
    if (!parsed) return;
    out.push({
      col: col,
      header: String(header || '').trim(),
      date: parsed,
      monthIndex: parsed.getMonth(),
      year: parsed.getFullYear()
    });
  });
  return out;
}

function cashFlowIncomeMonthlyTotalsFromGrid_(display, values, typeCol, monthCols) {
  var totals = {};
  (monthCols || []).forEach(function(month) {
    totals[month.header] = 0;
  });
  for (var r = 1; r < (display || []).length; r++) {
    if (String((display[r] || [])[typeCol] || '').trim().toLowerCase() !== 'income') continue;
    (monthCols || []).forEach(function(month) {
      var val = ((values && values[r]) || display[r] || [])[month.col];
      if (ciscoBonusHistoryValueIsFormula_(val)) return;
      var n = toNumber_(val);
      if (isFinite(n)) {
        totals[month.header] = round2_((totals[month.header] || 0) + n);
      }
    });
  }
  return totals;
}

function cashFlowIncomeAnnualTotalFromMonthly_(monthlyTotals) {
  var sum = 0;
  Object.keys(monthlyTotals || {}).forEach(function(key) {
    sum = round2_(sum + (Number(monthlyTotals[key]) || 0));
  });
  return sum;
}

function cashFlowRewriteFormulaRow_(formula, fromRow, toRow) {
  var text = String(formula || '');
  if (!text || text.charAt(0) !== '=') return text;
  var from = String(fromRow);
  var to = String(toRow);
  return text.replace(new RegExp('([A-Za-z]+)\\$?' + from + '\\b', 'g'), '$1' + to);
}

function ciscoBonusTrusted2026Split_(payments) {
  if (!payments || payments.length !== 2) return false;
  var years = {};
  var byMonth = {};
  payments.forEach(function(payment) {
    years[payment.year] = true;
    byMonth[payment.monthIndex] = round2_(Number(payment.amount));
  });
  return years[2026] === true && Object.keys(years).length === 1 &&
    byMonth[2] === CISCO_BONUS_TRUSTED_2026_MID_AMOUNT_ &&
    byMonth[8] === CISCO_BONUS_TRUSTED_2026_END_AMOUNT_;
}

function ciscoBonusProposalFingerprint_(proposal) {
  var payments = (proposal && proposal.payments) || [];
  return payments.map(function(payment) {
    return String(payment.header || '') + '=' +
      round2_(Number(payment.amount) || 0) + '>' +
      String(payment.toPayee || '');
  }).join('|');
}

function inspectCiscoBonusHistorySplit_(display, values) {
  display = display || [];
  values = values || display;
  var headers = display[0] || [];
  var typeCol = headers.indexOf('Type');
  var payeeCol = headers.indexOf('Payee');
  var activeCol = headers.indexOf('Active');
  var expectedCol = headers.indexOf('Expected Amount');
  var monthCols = listCashFlowMonthColumnsForBonusSplit_(headers);
  var result = {
    needed: false,
    alreadySplit: false,
    canSplit: false,
    requiresConfirmation: false,
    trustedMapping: false,
    historyYear: null,
    proposal: null,
    paymentMonths: [],
    ambiguities: [],
    warnings: [],
    monthlyTotals: cashFlowIncomeMonthlyTotalsFromGrid_(display, values, typeCol, monthCols),
    annualTotal: 0,
    legacyRows: [],
    namedRows: { mid: [], end: [] },
    rename: [],
    insert: [],
    moves: [],
    deactivate: [],
    clearExpected: []
  };
  result.annualTotal = cashFlowIncomeAnnualTotalFromMonthly_(result.monthlyTotals);
  if (typeCol === -1 || payeeCol === -1) {
    result.ambiguities.push(
      'Cisco Bonus history cannot be split because Cash Flow Type and Payee headers are missing.'
    );
    return result;
  }

  function rowInactive_(row) {
    if (activeCol === -1) return false;
    var rawActive = String(row[activeCol] || '').trim();
    return !!rawActive && normalizeYesNo_(rawActive) === 'no';
  }

  var bonusRows = [];
  for (var r = 1; r < display.length; r++) {
    var row = display[r] || [];
    if (String(row[typeCol] || '').trim().toLowerCase() !== 'income') continue;
    var payee = String(row[payeeCol] || '').trim();
    if (!payee || !isCiscoBonusIncomeName_(payee)) continue;
    var valueRow = values[r] || row;
    var expectedKnown = expectedCol >= 0 && (
      typeof debtMinimumPaymentCellIsKnown_ === 'function'
        ? debtMinimumPaymentCellIsKnown_(valueRow[expectedCol], row[expectedCol])
        : String(row[expectedCol] || '').trim() !== ''
    );
    var info = {
      sheetRow: r + 1,
      rowIndex: r,
      payee: payee,
      inactive: rowInactive_(row),
      expectedKnown: expectedKnown === true,
      expectedAmount: expectedKnown === true ? toNumber_(valueRow[expectedCol]) : null,
      cells: []
    };
    if (isCiscoMidYearBonusIncomeName_(payee)) result.namedRows.mid.push(info);
    else if (isCiscoEndYearBonusIncomeName_(payee)) result.namedRows.end.push(info);
    else if (!info.inactive) result.legacyRows.push(info);
    if (!info.inactive) bonusRows.push(info);
  }

  var activeMid = result.namedRows.mid.filter(function(row) { return !row.inactive; });
  var activeEnd = result.namedRows.end.filter(function(row) { return !row.inactive; });
  result.needed = result.legacyRows.length > 0 ||
    activeMid.length !== 1 ||
    activeEnd.length !== 1;

  if (activeMid.length > 1) {
    result.ambiguities.push(
      'Multiple Cisco Mid Year Bonus rows exist, so history was not rewritten.'
    );
  }
  if (activeEnd.length > 1) {
    result.ambiguities.push(
      'Multiple Cisco End Year Bonus rows exist, so history was not rewritten.'
    );
  }
  if (!result.legacyRows.length && !activeMid.length && !activeEnd.length) {
    result.ambiguities.push('No Cisco Bonus income entry was found to split.');
    return result;
  }

  var hitsByHeader = {};
  var historyYears = {};
  bonusRows.forEach(function(info) {
    var valueRow = values[info.rowIndex] || display[info.rowIndex] || [];
    var shownRow = display[info.rowIndex] || [];
    monthCols.forEach(function(month) {
      var cell = ciscoBonusHistoryCellAmount_(valueRow[month.col], shownRow[month.col]);
      info.cells.push({
        col: month.col,
        header: month.header,
        monthIndex: month.monthIndex,
        year: month.year,
        date: month.date,
        value: valueRow[month.col],
        present: cell.present,
        formula: cell.formula,
        amount: cell.amount
      });
      if (!cell.present) return;
      historyYears[month.year] = true;
      if (cell.formula) {
        result.ambiguities.push(
          info.payee + ' row ' + info.sheetRow + ' ' + month.header +
          ' is a formula, so that historical value was not moved.'
        );
        return;
      }
      if (!hitsByHeader[month.header]) hitsByHeader[month.header] = [];
      hitsByHeader[month.header].push({
        row: info,
        header: month.header,
        col: month.col,
        monthIndex: month.monthIndex,
        year: month.year,
        date: month.date,
        amount: cell.amount,
        value: valueRow[month.col]
      });
    });
  });

  var paymentMonths = Object.keys(hitsByHeader);
  paymentMonths.forEach(function(header) {
    if (hitsByHeader[header].length > 1) {
      result.ambiguities.push(
        header +
        ' has more than one Cisco Bonus amount, so it cannot be assigned to Cisco Mid Year Bonus or Cisco End Year Bonus without guessing.'
      );
    }
  });
  if (Object.keys(historyYears).length > 1) {
    result.ambiguities.push(
      'Cisco Bonus history spans more than one year, so payment order was not guessed.'
    );
  }
  result.historyYear = Object.keys(historyYears).length === 1
    ? Number(Object.keys(historyYears)[0])
    : (monthCols[0] ? monthCols[0].year : null);
  result.paymentMonths = paymentMonths.slice();

  var uniquePayments = paymentMonths.map(function(header) {
    return hitsByHeader[header][0];
  }).filter(Boolean);
  uniquePayments.sort(function(a, b) {
    return a.date - b.date;
  });

  if (result.ambiguities.length) return result;

  if (uniquePayments.length === 0 &&
      result.legacyRows.length === 0 &&
      activeMid.length === 1 &&
      activeEnd.length === 1) {
    result.alreadySplit = true;
    result.needed = false;
    result.canSplit = true;
    return result;
  }

  if (uniquePayments.length !== 2) {
    result.ambiguities.push(
      uniquePayments.length === 0
        ? 'Cisco Bonus history has no recorded payments, so two separate payments could not be identified. History was not changed.'
        : uniquePayments.length === 1
          ? 'Cisco Bonus history has only one recorded payment month (' +
            uniquePayments[0].header + ' ' +
            (typeof fmtCurrency_ === 'function' ? fmtCurrency_(uniquePayments[0].amount) : uniquePayments[0].amount) +
            '), so a Mid Year and End Year split was not guessed.'
          : 'Cisco Bonus history has ' + uniquePayments.length +
            ' recorded payment months (' +
            uniquePayments.map(function(payment) { return payment.header; }).join(', ') +
            '), so two separate payments could not be identified without guessing.'
    );
    return result;
  }

  var earlier = uniquePayments[0];
  var later = uniquePayments[1];
  result.proposal = {
    year: result.historyYear,
    payments: [
      {
        header: earlier.header,
        monthIndex: earlier.monthIndex,
        year: earlier.year,
        amount: earlier.amount,
        toPayee: CISCO_MID_YEAR_BONUS_PAYEE_,
        identity: 'mid'
      },
      {
        header: later.header,
        monthIndex: later.monthIndex,
        year: later.year,
        amount: later.amount,
        toPayee: CISCO_END_YEAR_BONUS_PAYEE_,
        identity: 'end'
      }
    ]
  };
  result.trustedMapping = ciscoBonusTrusted2026Split_(result.proposal.payments);
  result.requiresConfirmation = result.trustedMapping !== true;

  var midRow = activeMid[0] || null;
  var endRow = activeEnd[0] || null;
  var leftover = result.legacyRows.slice();

  function takeRow_(row) {
    for (var i = 0; i < leftover.length; i++) {
      if (leftover[i] === row) {
        leftover.splice(i, 1);
        return row;
      }
    }
    return row;
  }

  if (!midRow) {
    result.rename.push({
      sheetRow: earlier.row.sheetRow,
      rowIndex: earlier.row.rowIndex,
      fromPayee: earlier.row.payee,
      toPayee: CISCO_MID_YEAR_BONUS_PAYEE_
    });
    midRow = takeRow_(earlier.row);
  }
  if (!endRow) {
    if (later.row !== midRow && leftover.indexOf(later.row) >= 0 &&
        later.row.payee && !isCiscoNamedAnnualBonusIncomeName_(later.row.payee)) {
      result.rename.push({
        sheetRow: later.row.sheetRow,
        rowIndex: later.row.rowIndex,
        fromPayee: later.row.payee,
        toPayee: CISCO_END_YEAR_BONUS_PAYEE_
      });
      endRow = takeRow_(later.row);
    } else {
      result.insert.push({ payee: CISCO_END_YEAR_BONUS_PAYEE_ });
    }
  }
  if (!midRow) result.insert.push({ payee: CISCO_MID_YEAR_BONUS_PAYEE_ });

  var renamedToMid = result.rename.some(function(item) {
    return item.rowIndex === earlier.row.rowIndex &&
      item.toPayee === CISCO_MID_YEAR_BONUS_PAYEE_;
  });
  var renamedToEnd = result.rename.some(function(item) {
    return item.rowIndex === later.row.rowIndex &&
      item.toPayee === CISCO_END_YEAR_BONUS_PAYEE_;
  });
  if (!renamedToMid && !isCiscoMidYearBonusIncomeName_(earlier.row.payee)) {
    result.moves.push({
      fromSheetRow: earlier.row.sheetRow,
      fromRowIndex: earlier.row.rowIndex,
      fromCol: earlier.col,
      header: earlier.header,
      value: earlier.value,
      toPayee: CISCO_MID_YEAR_BONUS_PAYEE_
    });
  }
  if (!renamedToEnd && !isCiscoEndYearBonusIncomeName_(later.row.payee)) {
    result.moves.push({
      fromSheetRow: later.row.sheetRow,
      fromRowIndex: later.row.rowIndex,
      fromCol: later.col,
      header: later.header,
      value: later.value,
      toPayee: CISCO_END_YEAR_BONUS_PAYEE_
    });
  }

  leftover.forEach(function(row) {
    var remaining = (row.cells || []).some(function(cell) { return cell.present; });
    if (remaining && row !== earlier.row && row !== later.row) {
      result.ambiguities.push(
        row.payee + ' row ' + row.sheetRow +
        ' still has historical amounts that cannot be assigned to Cisco Mid Year Bonus or Cisco End Year Bonus without guessing.'
      );
      return;
    }
    if (row !== midRow && row !== endRow) {
      result.deactivate.push({
        sheetRow: row.sheetRow,
        rowIndex: row.rowIndex,
        payee: row.payee
      });
    }
  });

  if (result.ambiguities.length) return result;

  function blankExpected_(row, payeeLabel) {
    if (!row) return;
    result.clearExpected.push({
      sheetRow: row.sheetRow,
      rowIndex: row.rowIndex,
      reason: 'Expected Amount on ' + (payeeLabel || row.payee) +
        ' was left blank. Set Cisco Mid Year Bonus and Cisco End Year Bonus independently; a combined amount was not copied.'
    });
  }
  blankExpected_(midRow, CISCO_MID_YEAR_BONUS_PAYEE_);
  if (endRow) blankExpected_(endRow, CISCO_END_YEAR_BONUS_PAYEE_);
  result.warnings = result.clearExpected.map(function(item) { return item.reason; })
    .filter(function(reason, idx, all) { return all.indexOf(reason) === idx; });
  if (!result.warnings.length) {
    result.warnings.push(
      'Expected Amount on Cisco Mid Year Bonus and Cisco End Year Bonus was left blank until each is entered.'
    );
  }
  result.needed = true;
  result.alreadySplit = false;
  result.canSplit = true;
  return result;
}

function applyCiscoBonusHistorySplitToGrid_(grid, options) {
  options = options || {};
  var source = (grid || []).map(function(row) {
    return (row || []).slice();
  });
  var inspection = inspectCiscoBonusHistorySplit_(source, source);
  if (!inspection.canSplit) {
    return {
      ok: false,
      changed: false,
      error: inspection.ambiguities.join(' '),
      ambiguities: inspection.ambiguities.slice(),
      grid: source,
      monthlyTotalsBefore: inspection.monthlyTotals,
      monthlyTotalsAfter: inspection.monthlyTotals,
      annualTotalBefore: inspection.annualTotal,
      annualTotalAfter: inspection.annualTotal
    };
  }
  if (inspection.alreadySplit) {
    return {
      ok: true,
      changed: false,
      alreadySplit: true,
      grid: source,
      monthlyTotalsBefore: inspection.monthlyTotals,
      monthlyTotalsAfter: inspection.monthlyTotals,
      annualTotalBefore: inspection.annualTotal,
      annualTotalAfter: inspection.annualTotal,
      warnings: []
    };
  }
  if (inspection.requiresConfirmation === true && options.confirmProposal !== true) {
    return {
      ok: false,
      changed: false,
      needsConfirmation: true,
      proposal: inspection.proposal,
      error: 'Confirm the proposed earlier payment as Cisco Mid Year Bonus and later payment as Cisco End Year Bonus before history is changed.',
      ambiguities: [],
      grid: source,
      monthlyTotalsBefore: inspection.monthlyTotals,
      monthlyTotalsAfter: inspection.monthlyTotals,
      annualTotalBefore: inspection.annualTotal,
      annualTotalAfter: inspection.annualTotal
    };
  }
  if (options.proposal) {
    if (ciscoBonusProposalFingerprint_(options.proposal) !==
        ciscoBonusProposalFingerprint_(inspection.proposal)) {
      return {
        ok: false,
        changed: false,
        error: 'The proposed payment months changed. History was not rewritten.',
        grid: source,
        monthlyTotalsBefore: inspection.monthlyTotals,
        monthlyTotalsAfter: inspection.monthlyTotals,
        annualTotalBefore: inspection.annualTotal,
        annualTotalAfter: inspection.annualTotal
      };
    }
  }

  var headers = source[0] || [];
  var typeCol = headers.indexOf('Type');
  var payeeCol = headers.indexOf('Payee');
  var flowCol = headers.indexOf('Flow Source');
  var activeCol = headers.indexOf('Active');
  var recurringCol = headers.indexOf('Recurring');
  var frequencyCol = headers.indexOf('Frequency');
  var expectedCol = headers.indexOf('Expected Amount');
  var monthCols = listCashFlowMonthColumnsForBonusSplit_(headers);
  var totalsBefore = cashFlowIncomeMonthlyTotalsFromGrid_(source, source, typeCol, monthCols);
  var annualBefore = cashFlowIncomeAnnualTotalFromMonthly_(totalsBefore);
  var unrelatedBefore = source.slice(1).filter(function(row) {
    return String(row[typeCol] || '').trim().toLowerCase() === 'income' &&
      !isCiscoBonusIncomeName_(row[payeeCol]);
  }).map(function(row) { return row.slice(); });

  inspection.rename.forEach(function(item) {
    source[item.rowIndex][payeeCol] = item.toPayee;
  });
  inspection.deactivate.forEach(function(item) {
    if (activeCol >= 0) source[item.rowIndex][activeCol] = 'NO';
  });

  function findPayeeRow_(payee) {
    for (var r = 1; r < source.length; r++) {
      if (String(source[r][typeCol] || '').trim().toLowerCase() !== 'income') continue;
      if (canonicalizeIncomePayeeKey_(source[r][payeeCol]) === canonicalizeIncomePayeeKey_(payee)) {
        var inactive = activeCol >= 0 &&
          String(source[r][activeCol] || '').trim() &&
          normalizeYesNo_(source[r][activeCol]) === 'no';
        if (!inactive) return r;
      }
    }
    return -1;
  }

  function blankRowFrom_(templateIndex, payee) {
    var template = source[templateIndex] || source[1] || [];
    var next = template.map(function() { return ''; });
    next[typeCol] = 'Income';
    if (flowCol >= 0) next[flowCol] = template[flowCol] || 'CASH';
    next[payeeCol] = payee;
    if (activeCol >= 0) next[activeCol] = 'YES';
    if (recurringCol >= 0) next[recurringCol] = 'Yes';
    if (frequencyCol >= 0) next[frequencyCol] = 'Yearly';
    if (expectedCol >= 0) next[expectedCol] = '';
    headers.forEach(function(header, col) {
      var label = String(header || '').trim().toLowerCase();
      if (label !== 'total' && label !== 'totals' && label !== 'yearly total') return;
      var formula = template[col];
      if (ciscoBonusHistoryValueIsFormula_(formula)) {
        next[col] = cashFlowRewriteFormulaRow_(formula, templateIndex + 1, source.length + 1);
      }
    });
    return next;
  }

  var templateIndex = inspection.rename[0] ? inspection.rename[0].rowIndex : 1;
  inspection.insert.forEach(function(item) {
    if (findPayeeRow_(item.payee) >= 0) return;
    source.push(blankRowFrom_(templateIndex, item.payee));
  });

  inspection.moves.forEach(function(move) {
    var destIndex = findPayeeRow_(move.toPayee);
    if (destIndex < 0) {
      inspection.ambiguities.push(
        'Cisco Bonus history could not be moved to ' + move.toPayee + '.'
      );
      return;
    }
    if (destIndex === move.fromRowIndex) return;
    source[destIndex][move.fromCol] = move.value;
    source[move.fromRowIndex][move.fromCol] = '';
  });

  [CISCO_MID_YEAR_BONUS_PAYEE_, CISCO_END_YEAR_BONUS_PAYEE_].forEach(function(payee) {
    var rowIndex = findPayeeRow_(payee);
    if (rowIndex < 0) return;
    if (recurringCol >= 0) source[rowIndex][recurringCol] = 'Yes';
    if (frequencyCol >= 0) source[rowIndex][frequencyCol] = 'Yearly';
    if (expectedCol >= 0) source[rowIndex][expectedCol] = '';
  });

  if (inspection.ambiguities.length) {
    return {
      ok: false,
      changed: false,
      error: inspection.ambiguities.join(' '),
      ambiguities: inspection.ambiguities.slice(),
      grid: (grid || []).map(function(row) { return (row || []).slice(); }),
      monthlyTotalsBefore: totalsBefore,
      monthlyTotalsAfter: totalsBefore,
      annualTotalBefore: annualBefore,
      annualTotalAfter: annualBefore
    };
  }

  var unrelatedAfter = source.slice(1).filter(function(row) {
    return String(row[typeCol] || '').trim().toLowerCase() === 'income' &&
      !isCiscoBonusIncomeName_(row[payeeCol]);
  });
  if (unrelatedAfter.length !== unrelatedBefore.length) {
    return {
      ok: false,
      changed: false,
      error: 'Unrelated income rows would have changed. History was not rewritten.',
      grid: (grid || []).map(function(row) { return (row || []).slice(); }),
      monthlyTotalsBefore: totalsBefore,
      monthlyTotalsAfter: totalsBefore,
      annualTotalBefore: annualBefore,
      annualTotalAfter: annualBefore
    };
  }
  for (var u = 0; u < unrelatedBefore.length; u++) {
    if (JSON.stringify(unrelatedBefore[u]) !== JSON.stringify(unrelatedAfter[u])) {
      return {
        ok: false,
        changed: false,
        error: 'Unrelated income rows would have changed. History was not rewritten.',
        grid: (grid || []).map(function(row) { return (row || []).slice(); }),
        monthlyTotalsBefore: totalsBefore,
        monthlyTotalsAfter: totalsBefore,
        annualTotalBefore: annualBefore,
        annualTotalAfter: annualBefore
      };
    }
  }

  var totalsAfter = cashFlowIncomeMonthlyTotalsFromGrid_(source, source, typeCol, monthCols);
  return {
    ok: true,
    changed: true,
    alreadySplit: false,
    trustedMapping: inspection.trustedMapping === true,
    proposal: inspection.proposal,
    grid: source,
    monthlyTotalsBefore: totalsBefore,
    monthlyTotalsAfter: totalsAfter,
    annualTotalBefore: annualBefore,
    annualTotalAfter: cashFlowIncomeAnnualTotalFromMonthly_(totalsAfter),
    warnings: inspection.warnings.slice(),
    inspection: inspection
  };
}

function listCiscoBonusIncomeEntries_(sheet, headerMap) {
  if (!sheet || !headerMap) return [];
  var display = sheet.getDataRange().getDisplayValues();
  var values = sheet.getDataRange().getValues();
  var out = [];
  for (var r = 1; r < display.length; r++) {
    var row = display[r] || [];
    if (String(row[headerMap.typeColZero] || '').trim().toLowerCase() !== 'income') continue;
    var payee = String(row[headerMap.payeeColZero] || '').trim();
    if (!payee || !isCiscoBonusIncomeName_(payee)) continue;
    var inactive = false;
    if (headerMap.activeColZero !== -1) {
      var rawActive = String(row[headerMap.activeColZero] || '').trim();
      inactive = !!rawActive && normalizeYesNo_(rawActive) === 'no';
    }
    var forecast = {
      recurring: headerMap.recurringColZero >= 0
        ? String(row[headerMap.recurringColZero] || '').trim() : '',
      frequency: headerMap.frequencyColZero >= 0
        ? String(row[headerMap.frequencyColZero] || '').trim() : '',
      expectedAmount: null,
      expectedKnown: false
    };
    if (headerMap.expectedAmountColZero >= 0) {
      forecast.expectedKnown = typeof debtMinimumPaymentCellIsKnown_ === 'function'
        ? debtMinimumPaymentCellIsKnown_(
            values[r][headerMap.expectedAmountColZero],
            row[headerMap.expectedAmountColZero]
          )
        : String(row[headerMap.expectedAmountColZero] || '').trim() !== '';
      if (forecast.expectedKnown) {
        forecast.expectedAmount = toNumber_(values[r][headerMap.expectedAmountColZero]);
      }
    }
    var named = isCiscoNamedAnnualBonusIncomeName_(payee);
    var posSum = 0;
    var posCount = 0;
    var headers = display[0] || [];
    for (var c = 0; c < headers.length; c++) {
      if (typeof parseMonthHeader_ !== 'function' || !parseMonthHeader_(headers[c])) continue;
      var monthAmt = toNumber_(values[r][c]);
      if (monthAmt > 0) {
        posSum += monthAmt;
        posCount += 1;
      }
    }
    out.push({
      groupKey: (normalizeIncomeName_(payee) || payee).toLowerCase(),
      sourceName: named ? (normalizeIncomeName_(payee) || payee) : (normalizeIncomeName_(payee) || 'Cisco Bonus'),
      payee: payee,
      kind: named ? 'cisco_annual_bonus' : 'cisco_bonus_legacy',
      sheetRow: r + 1,
      rows: [{ sheetRow: r + 1, payee: payee }],
      lifecycleState: inactive ? 'inactive' : 'active',
      amount: posCount ? round2_(posSum / posCount) : 0,
      recurring: forecast.recurring,
      frequency: forecast.frequency,
      expectedAmount: forecast.expectedAmount,
      expectedKnown: forecast.expectedKnown === true
    });
  }
  return out;
}

function validateCiscoBonusRowReference_(sheet, headerMap, payload) {
  var expectedRows = normalizeIncomeLifecycleRows_(payload.rows);
  if (expectedRows.length !== 1) {
    throw new Error('Cisco bonus payments are edited one Cash Flow row at a time.');
  }
  var expected = expectedRows[0];
  var display = sheet.getDataRange().getDisplayValues();
  var rowIndex = expected.sheetRow - 1;
  if (rowIndex < 1 || rowIndex >= display.length) {
    throw new Error('This Cisco bonus row moved or changed. Refresh Income and try again.');
  }
  var row = display[rowIndex] || [];
  if (String(row[headerMap.typeColZero] || '').trim().toLowerCase() !== 'income') {
    throw new Error('This Cisco bonus row moved or changed. Refresh Income and try again.');
  }
  var payee = String(row[headerMap.payeeColZero] || '').trim();
  if (payee !== expected.payee || !isCiscoNamedAnnualBonusIncomeName_(payee)) {
    throw new Error('This Cisco bonus row moved or changed. Refresh Income and try again.');
  }
  var inactive = false;
  if (headerMap.activeColZero !== -1) {
    var rawActive = String(row[headerMap.activeColZero] || '').trim();
    inactive = !!rawActive && normalizeYesNo_(rawActive) === 'no';
  }
  return {
    displayName: normalizeIncomeName_(payee) || payee,
    payee: payee,
    sheetRow: expected.sheetRow,
    rows: [{ sheetRow: expected.sheetRow, payee: payee }],
    activeCount: inactive ? 0 : 1
  };
}

function updateCiscoBonusForecastFieldsFromDashboard(payload, optionalSpreadsheet) {
  validateRequired_(payload, ['year', 'rows']);
  var recurring = parseIncomeRecurringStatusFromDashboard_(payload.recurring);
  var frequency = parseIncomeFrequencyFromDashboard_(payload.frequency);
  var expected = parseIncomeExpectedAmountFromDashboard_(payload.expectedAmount);
  if (recurring === 'Yes') {
    if (!frequency) {
      throw new Error('Frequency is required when Recurring is Yes.');
    }
    if (typeof normalizeFrequency_ === 'function' && normalizeFrequency_(frequency) !== 'yearly') {
      throw new Error('Cisco Mid Year Bonus and Cisco End Year Bonus are annual. Frequency must be Yearly.');
    }
    if (expected.known !== true) {
      throw new Error('Expected amount is required when Recurring is Yes. Use 0 if the occurrence amount is zero.');
    }
  }
  var year = Math.round(Number(payload.year));
  if (!isFinite(year) || year < 2000 || year > 3000) {
    throw new Error('Invalid year for income source.');
  }
  var ss = optionalSpreadsheet || getUserSpreadsheet_();
  var lock = LockService.getUserLock();
  lock.waitLock(10000);
  try {
    var sheet;
    try { sheet = getCashFlowSheet_(ss, year); }
    catch (e) { throw new Error('Cash Flow sheet for ' + year + ' was not found.'); }
    var headerMap = getCashFlowHeaderMap_(sheet);
    if (!(headerMap.recurringCol > 0) || !(headerMap.frequencyCol > 0) ||
        !(headerMap.expectedAmountCol > 0)) {
      throw new Error(
        'Add Recurring, Frequency, and Expected Amount columns from Manage income first. Existing income rows were not changed.'
      );
    }
    var identity = validateCiscoBonusRowReference_(sheet, headerMap, payload);
    if (identity.activeCount === 0) {
      throw new Error('Inactive income sources cannot be edited. Reactivate the source first.');
    }
    var lastCol = Math.max(1, sheet.getLastColumn());
    var valueRow = sheet.getRange(identity.sheetRow, 1, 1, lastCol).getValues()[0] || [];
    var originals = {
      recurring: headerMap.recurringCol > 0
        ? sheet.getRange(identity.sheetRow, headerMap.recurringCol).getValue() : '',
      frequency: headerMap.frequencyCol > 0
        ? sheet.getRange(identity.sheetRow, headerMap.frequencyCol).getValue() : '',
      expectedAmount: headerMap.expectedAmountCol > 0
        ? sheet.getRange(identity.sheetRow, headerMap.expectedAmountCol).getValue() : ''
    };
    try {
      var nextRow = applyIncomeForecastFieldsToRow_(valueRow, headerMap, {
        recurring: recurring,
        frequency: frequency,
        expectedKnown: expected.known === true,
        expectedAmount: expected.known === true ? expected.value : ''
      });
      sheet.getRange(identity.sheetRow, headerMap.recurringCol)
        .setValue(nextRow[headerMap.recurringColZero]);
      sheet.getRange(identity.sheetRow, headerMap.frequencyCol)
        .setValue(nextRow[headerMap.frequencyColZero]);
      var expectedCell = sheet.getRange(identity.sheetRow, headerMap.expectedAmountCol);
      expectedCell.setValue(nextRow[headerMap.expectedAmountColZero]);
      if (expected.known) {
        try { expectedCell.setNumberFormat('$#,##0.00;[Red]-$#,##0.00'); } catch (_expFmt) { /* cosmetic */ }
      }
    } catch (writeErr) {
      try {
        sheet.getRange(identity.sheetRow, headerMap.recurringCol).setValue(originals.recurring);
        sheet.getRange(identity.sheetRow, headerMap.frequencyCol).setValue(originals.frequency);
        sheet.getRange(identity.sheetRow, headerMap.expectedAmountCol).setValue(originals.expectedAmount);
      } catch (_rb) { /* best-effort rollback */ }
      throw writeErr;
    }
    try {
      appendActivityLog_(ss, {
        eventType: 'income_bonus_forecast_edit',
        entryDate: Utilities.formatDate(stripTime_(new Date()), Session.getScriptTimeZone(), 'yyyy-MM-dd'),
        amount: expected.known ? expected.value : 0,
        direction: 'income',
        payee: identity.payee,
        category: '',
        accountSource: '',
        cashFlowSheet: sheet.getName(),
        cashFlowMonth: '',
        dedupeKey: '',
        details: JSON.stringify({
          detailsVersion: 3,
          year: year,
          rows: identity.rows,
          recurring: recurring,
          frequency: frequency,
          expectedKnown: expected.known === true,
          expectedAmount: expected.known ? expected.value : null
        })
      });
    } catch (logErr) {
      Logger.log('updateCiscoBonusForecastFieldsFromDashboard activity log: ' + logErr);
    }
    touchDashboardSourceUpdated_('cash_flow');
    return {
      ok: true,
      message: 'Updated ' + identity.displayName +
        '. Historical month amounts were not changed.',
      sourceName: identity.displayName,
      rows: identity.rows
    };
  } finally {
    lock.releaseLock();
  }
}

function splitCiscoBonusIncomeRowsFromDashboard(payload, optionalSpreadsheet) {
  if (payload && typeof payload.getSheetByName === 'function' && optionalSpreadsheet == null) {
    optionalSpreadsheet = payload;
    payload = {};
  }
  payload = payload || {};
  var ss = optionalSpreadsheet || getUserSpreadsheet_();
  var lock = LockService.getUserLock();
  lock.waitLock(10000);
  try {
    var year = getCurrentYear_();
    var sheet;
    try { sheet = getCashFlowSheet_(ss, year); }
    catch (e) {
      throw new Error('Cash Flow sheet for ' + year + ' was not found.');
    }
    var headerMap = getCashFlowHeaderMap_(sheet);
    var display = sheet.getDataRange().getDisplayValues();
    var values = sheet.getDataRange().getValues();
    var inspection = inspectCiscoBonusHistorySplit_(display, values);
    if (!inspection.canSplit) {
      throw new Error(
        (inspection.ambiguities && inspection.ambiguities.length
          ? inspection.ambiguities.join(' ')
          : 'Cisco Bonus history cannot be split without guessing.') +
        ' Existing month amounts, totals, and income rows were not changed.'
      );
    }
    if (inspection.requiresConfirmation === true) {
      if (payload.confirmProposal !== true) {
        throw new Error(
          'Confirm the proposed earlier payment as Cisco Mid Year Bonus and later payment as Cisco End Year Bonus before history is changed. Existing month amounts were not rewritten.'
        );
      }
      if (payload.proposal && ciscoBonusProposalFingerprint_(payload.proposal) !==
          ciscoBonusProposalFingerprint_(inspection.proposal)) {
        throw new Error(
          'The proposed payment months changed. Refresh Income and confirm again. Existing month amounts were not rewritten.'
        );
      }
    }
    if (inspection.alreadySplit) {
      return {
        ok: true,
        changed: false,
        alreadySplit: true,
        year: year,
        sheetName: sheet.getName(),
        message: 'Cisco Mid Year Bonus and Cisco End Year Bonus already exist. Historical month amounts were not changed.'
      };
    }

    var monthlyBefore = inspection.monthlyTotals;
    inspection.rename.forEach(function(item) {
      sheet.getRange(item.sheetRow, headerMap.payeeCol).setValue(item.toPayee);
    });
    inspection.clearExpected.forEach(function(item) {
      if (headerMap.expectedAmountCol > 0) {
        sheet.getRange(item.sheetRow, headerMap.expectedAmountCol).setValue('');
      }
    });
    inspection.insert.forEach(function(item) {
      var rowInfo = insertCashFlowRow_(sheet, 'Income', item.payee, 'CASH');
      if (rowInfo && rowInfo.row && String(
        sheet.getRange(rowInfo.row, headerMap.payeeCol).getDisplayValue() || ''
      ).trim() !== item.payee) {
        throw new Error('A named Cisco bonus row could not be added without changing an existing payee. Existing history was not finished.');
      }
    });
    display = sheet.getDataRange().getDisplayValues();
    values = sheet.getDataRange().getValues();
    function findNamedRow_(payee) {
      for (var r = 1; r < display.length; r++) {
        if (String(display[r][headerMap.typeColZero] || '').trim().toLowerCase() !== 'income') continue;
        if (canonicalizeIncomePayeeKey_(display[r][headerMap.payeeColZero]) !==
            canonicalizeIncomePayeeKey_(payee)) continue;
        if (headerMap.activeColZero !== -1) {
          var rawActive = String(display[r][headerMap.activeColZero] || '').trim();
          if (rawActive && normalizeYesNo_(rawActive) === 'no') continue;
        }
        return r + 1;
      }
      return 0;
    }
    inspection.moves.forEach(function(move) {
      var destRow = findNamedRow_(move.toPayee);
      if (!destRow) {
        throw new Error(
          'Cisco Bonus history could not be moved to ' + move.toPayee +
          '. Existing month amounts were not finished.'
        );
      }
      var destCol = move.fromCol + 1;
      var sourceCell = sheet.getRange(move.fromSheetRow, destCol);
      var destCell = sheet.getRange(destRow, destCol);
      destCell.setValue(sourceCell.getValue());
      try {
        var fmt = sourceCell.getNumberFormat();
        if (fmt) destCell.setNumberFormat(fmt);
      } catch (_fmtErr) { /* cosmetic */ }
      sourceCell.setValue('');
    });
    [CISCO_MID_YEAR_BONUS_PAYEE_, CISCO_END_YEAR_BONUS_PAYEE_].forEach(function(payee) {
      var sheetRow = findNamedRow_(payee);
      if (!sheetRow) return;
      if (headerMap.recurringCol > 0) {
        sheet.getRange(sheetRow, headerMap.recurringCol).setValue('Yes');
      }
      if (headerMap.frequencyCol > 0) {
        sheet.getRange(sheetRow, headerMap.frequencyCol).setValue('Yearly');
      }
      if (headerMap.expectedAmountCol > 0) {
        sheet.getRange(sheetRow, headerMap.expectedAmountCol).setValue('');
      }
    });
    inspection.deactivate.forEach(function(item) {
      if (headerMap.activeCol > 0) {
        sheet.getRange(item.sheetRow, headerMap.activeCol).setValue('NO');
      }
    });

    display = sheet.getDataRange().getDisplayValues();
    values = sheet.getDataRange().getValues();
    var monthCols = listCashFlowMonthColumnsForBonusSplit_(display[0] || []);
    var monthlyAfter = cashFlowIncomeMonthlyTotalsFromGrid_(
      display, values, (display[0] || []).indexOf('Type'), monthCols);
    Object.keys(monthlyBefore || {}).forEach(function(header) {
      if (round2_(monthlyBefore[header] || 0) !== round2_(monthlyAfter[header] || 0)) {
        throw new Error(
          'Cisco Bonus split stopped because ' + header +
          ' totals would have changed. Existing history was not left in a guessed state.'
        );
      }
    });

    try {
      appendActivityLog_(ss, {
        eventType: 'income_bonus_split',
        entryDate: Utilities.formatDate(stripTime_(new Date()), Session.getScriptTimeZone(), 'yyyy-MM-dd'),
        amount: 0,
        direction: 'income',
        payee: CISCO_MID_YEAR_BONUS_PAYEE_,
        category: '',
        accountSource: '',
        cashFlowSheet: sheet.getName(),
        cashFlowMonth: '',
        dedupeKey: '',
        details: JSON.stringify({
          detailsVersion: 1,
          year: year,
          warnings: inspection.warnings,
          renamed: inspection.rename.map(function(item) {
            return { from: item.fromPayee, to: item.toPayee, sheetRow: item.sheetRow };
          })
        })
      });
    } catch (logErr) {
      Logger.log('splitCiscoBonusIncomeRowsFromDashboard activity log: ' + logErr);
    }
    touchDashboardSourceUpdated_('cash_flow');
    var warningText = inspection.warnings.length
      ? ' ' + inspection.warnings.join(' ')
      : '';
    return {
      ok: true,
      changed: true,
      alreadySplit: false,
      year: year,
      sheetName: sheet.getName(),
      warnings: inspection.warnings.slice(),
      proposal: inspection.proposal,
      trustedMapping: inspection.trustedMapping === true,
      message: 'Split the existing Cisco Bonus entry into Cisco Mid Year Bonus and Cisco End Year Bonus. Mid Year is the first recorded payment; End Year is the second. Recurring is Yes and Frequency is Yearly on both rows. Expected Amount was left blank on both. Historical monthly totals were not changed.' +
        warningText
    };
  } finally {
    lock.releaseLock();
  }
}

function getIncomeSourcesForManagementFromDashboard(optionalSpreadsheet) {
  var ss = optionalSpreadsheet || getUserSpreadsheet_();
  var forecastSchema = readCashFlowIncomeForecastSchema_(ss);
  var year = findLatestCashFlowYearWithAnyIncome_(ss);
  if (year == null) {
    return {
      year: null,
      activeSources: [],
      inactiveSources: [],
      scheduledBonusSources: [],
      bonusSplit: {
        needed: false,
        alreadySplit: false,
        canSplit: false,
        requiresConfirmation: false,
        trustedMapping: false,
        proposal: null,
        paymentMonths: [],
        ambiguities: []
      },
      forecastSchema: forecastSchema
    };
  }

  var sheet;
  try { sheet = getCashFlowSheet_(ss, year); }
  catch (e) {
    throw new Error('Could not load the income lifecycle inventory. Please refresh and try again.');
  }

  var headerMap;
  try { headerMap = getCashFlowHeaderMap_(sheet); }
  catch (mapErr) { headerMap = {}; }

  var groups = analyzeIncomeLifecycleGroupsInSheet_(sheet);
  var active = [];
  var inactive = [];
  for (var i = 0; i < groups.length; i++) {
    var g = groups[i];
    if (typeof isCiscoBonusIncomeName_ === 'function' && isCiscoBonusIncomeName_(g.displayName)) {
      if (typeof isCiscoNamedAnnualBonusIncomeName_ === 'function' &&
          isCiscoNamedAnnualBonusIncomeName_(g.displayName) &&
          g.lifecycleState === 'inactive') {
        var bonusForecast = readIncomeForecastFieldsFromGroup_(sheet, headerMap, g.rows);
        inactive.push({
          groupKey: g.groupKey,
          sourceName: g.displayName,
          amount: g.avgNonZero,
          frequency: bonusForecast.frequency || '',
          recurring: bonusForecast.recurring || '',
          expectedAmount: bonusForecast.expectedAmount,
          expectedKnown: bonusForecast.expectedKnown === true,
          year: year,
          sheetName: sheet.getName(),
          rows: g.rows,
          mixedState: g.mixedState,
          kind: 'cisco_annual_bonus'
        });
      }
      continue;
    }
    if (!incomeGroupQualifiesAsRecurring_(g)) continue;
    var forecast = readIncomeForecastFieldsFromGroup_(sheet, headerMap, g.rows);
    var item = {
      groupKey: g.groupKey,
      sourceName: g.displayName,
      amount: g.avgNonZero,
      frequency: forecast.frequency || '',
      recurring: forecast.recurring || '',
      expectedAmount: forecast.expectedAmount,
      expectedKnown: forecast.expectedKnown === true,
      year: year,
      sheetName: sheet.getName(),
      rows: g.rows,
      mixedState: g.mixedState
    };
    if (g.lifecycleState === 'inactive') inactive.push(item);
    else active.push(item);
  }
  var scheduledBonus = listCiscoBonusIncomeEntries_(sheet, headerMap).map(function(entry) {
    entry.year = year;
    entry.sheetName = sheet.getName();
    return entry;
  });
  var bonusSplit = {
    needed: false,
    alreadySplit: false,
    canSplit: false,
    ambiguities: []
  };
  try {
    var display = sheet.getDataRange().getDisplayValues();
    var values = sheet.getDataRange().getValues();
    var inspection = inspectCiscoBonusHistorySplit_(display, values);
    bonusSplit = {
      needed: inspection.needed === true,
      alreadySplit: inspection.alreadySplit === true,
      canSplit: inspection.canSplit === true,
      requiresConfirmation: inspection.requiresConfirmation === true,
      trustedMapping: inspection.trustedMapping === true,
      year: inspection.historyYear,
      proposal: inspection.proposal || null,
      paymentMonths: inspection.paymentMonths ? inspection.paymentMonths.slice() : [],
      ambiguities: inspection.ambiguities ? inspection.ambiguities.slice() : [],
      warnings: inspection.warnings ? inspection.warnings.slice() : []
    };
  } catch (_splitInspectErr) {
    bonusSplit.ambiguities = ['Cisco Bonus history could not be inspected.'];
  }
  // Largest-first ordering surfaces material income at the top of the
  // management list; name is a deterministic tiebreaker.
  var sortSources = function(a, b) {
    if ((b.amount || 0) !== (a.amount || 0)) return (b.amount || 0) - (a.amount || 0);
    return String(a.sourceName || '').toLowerCase()
      .localeCompare(String(b.sourceName || '').toLowerCase());
  };
  active.sort(sortSources);
  inactive.sort(sortSources);
  scheduledBonus.sort(function(a, b) {
    var nameOrder = {};
    nameOrder[canonicalizeIncomePayeeKey_(CISCO_MID_YEAR_BONUS_PAYEE_)] = 1;
    nameOrder[canonicalizeIncomePayeeKey_(CISCO_END_YEAR_BONUS_PAYEE_)] = 2;
    var am = nameOrder[canonicalizeIncomePayeeKey_(a.payee || a.sourceName)] || 9;
    var bm = nameOrder[canonicalizeIncomePayeeKey_(b.payee || b.sourceName)] || 9;
    if (am !== bm) return am - bm;
    return Number(a.sheetRow || 0) - Number(b.sheetRow || 0);
  });
  return {
    year: year,
    activeSources: active,
    inactiveSources: inactive,
    scheduledBonusSources: scheduledBonus,
    bonusSplit: bonusSplit,
    forecastSchema: forecastSchema
  };
}

/** Backward-compatible active-only read seam for older callers. */
function getActiveIncomeSourcesForManagementFromDashboard(optionalSpreadsheet) {
  return getIncomeSourcesForManagementFromDashboard(optionalSpreadsheet).activeSources;
}

/* -------------------------------------------------------------------------- */
/*  Dashboard: add income source (writes to Cash Flow)                        */
/* -------------------------------------------------------------------------- */

/**
 * Recurring Yes / No / blank-unknown. Blank stays unknown; it is not No.
 */
function parseIncomeRecurringStatusFromDashboard_(value) {
  var text = String(value == null ? '' : value).replace(/\u00A0/g, ' ').trim();
  if (!text) return '';
  var v = text.toLowerCase();
  if (v === 'yes' || v === 'y') return 'Yes';
  if (v === 'no' || v === 'n') return 'No';
  throw new Error('Recurring must be Yes, No, or left blank.');
}

function parseIncomeFrequencyFromDashboard_(value) {
  var text = String(value == null ? '' : value).replace(/\u00A0/g, ' ').trim();
  if (!text) return '';
  var normalized = typeof normalizeFrequency_ === 'function'
    ? normalizeFrequency_(text)
    : 'unknown';
  if (normalized === 'unknown') {
    throw new Error('Frequency must be a supported payment frequency or left blank.');
  }
  return text;
}

function parseIncomeExpectedAmountFromDashboard_(raw) {
  if (raw === undefined || raw === null || String(raw).trim() === '') {
    return { known: false, value: null };
  }
  var amountNum = toNumber_(raw);
  if (!isFinite(amountNum)) throw new Error('Expected amount must be a valid number.');
  if (amountNum < 0) throw new Error('Expected amount cannot be negative.');
  return { known: true, value: round2_(amountNum) };
}

/**
 * Copy a Cash Flow row and write only Recurring / Frequency / Expected Amount.
 * Month cells and every other column stay untouched. Blank expected stays blank.
 */
function applyIncomeForecastFieldsToRow_(row, headerMap, fields) {
  var next = (row || []).slice();
  fields = fields || {};
  if (headerMap && headerMap.recurringColZero >= 0) {
    next[headerMap.recurringColZero] = fields.recurring || '';
  }
  if (headerMap && headerMap.frequencyColZero >= 0) {
    next[headerMap.frequencyColZero] = fields.frequency || '';
  }
  if (headerMap && headerMap.expectedAmountColZero >= 0) {
    next[headerMap.expectedAmountColZero] = fields.expectedKnown === true
      ? fields.expectedAmount
      : '';
  }
  return next;
}

function readIncomeForecastFieldsFromGroup_(sheet, headerMap, rows) {
  var empty = { recurring: '', frequency: '', expectedAmount: null, expectedKnown: false };
  if (!sheet || !headerMap || !rows || !rows.length) return empty;
  var first = rows[0];
  var sheetRow = Number(first && first.sheetRow);
  if (!isFinite(sheetRow) || sheetRow < 2) return empty;
  var lastCol = Math.max(1, sheet.getLastColumn());
  var displayRow = sheet.getRange(sheetRow, 1, 1, lastCol).getDisplayValues()[0] || [];
  var valueRow = sheet.getRange(sheetRow, 1, 1, lastCol).getValues()[0] || [];
  var recurring = headerMap.recurringColZero >= 0
    ? String(displayRow[headerMap.recurringColZero] || '').trim()
    : '';
  var frequency = headerMap.frequencyColZero >= 0
    ? String(displayRow[headerMap.frequencyColZero] || '').trim()
    : '';
  var expectedAmount = null;
  var expectedKnown = false;
  if (headerMap.expectedAmountColZero >= 0) {
    expectedKnown = typeof debtMinimumPaymentCellIsKnown_ === 'function'
      ? debtMinimumPaymentCellIsKnown_(
          valueRow[headerMap.expectedAmountColZero],
          displayRow[headerMap.expectedAmountColZero]
        )
      : String(displayRow[headerMap.expectedAmountColZero] || '').trim() !== '';
    if (expectedKnown) {
      expectedAmount = toNumber_(valueRow[headerMap.expectedAmountColZero]);
    }
  }
  return {
    recurring: recurring,
    frequency: frequency,
    expectedAmount: expectedAmount,
    expectedKnown: expectedKnown
  };
}

/**
 * Add a new income source by writing directly to the current year's
 * Cash Flow tab.
 *
 * Payload:
 *   - sourceName {string} non-empty (<=160 chars)
 *   - amount     {number|string} strictly > 0 (this month's amount)
 *   - recurring  {string} Yes / No / blank-unknown
 *   - frequency  {string} payment frequency or blank
 *   - expectedAmount {number|string} amount per occurrence, including explicit 0, or blank
 *
 * Behavior:
 *   - Group-level duplicate check includes active and inactive rows.
 *     Existing inactive identities must use Reactivate, because Add records
 *     current-month dollars and is not a lifecycle action.
 *   - Insert a new Cash Flow row (Type=Income, Flow Source=
 *     CASH, Active=YES, Payee=sourceName) immediately after the last
 *     existing Income row (via the shared `insertCashFlowRow_`).
 *   - Writes `amount` into the current month column only. No past /
 *     future month auto-fill in v1.
 *
 * @returns {{
 *   ok: boolean,
 *   message: string,
 *   sourceName: string,
 *   year: number,
 *   sheetName: string
 * }}
 */
function addIncomeSourceFromDashboard(payload, optionalSpreadsheet) {
  validateRequired_(payload, ['sourceName', 'amount']);

  var name = String(payload.sourceName || '').trim();
  if (!name) throw new Error('Source name is required.');
  if (name.length > 160) throw new Error('Source name is too long (max 160 characters).');

  var amountRaw = payload.amount;
  if (amountRaw === undefined || amountRaw === null || String(amountRaw).trim() === '') {
    throw new Error('Amount is required.');
  }
  var amountNum = toNumber_(amountRaw);
  if (!isFinite(amountNum)) throw new Error('Amount must be a valid number.');
  if (amountNum <= 0) throw new Error('Amount must be greater than zero.');
  amountNum = round2_(amountNum);

  var recurring = parseIncomeRecurringStatusFromDashboard_(payload.recurring);
  var frequency = parseIncomeFrequencyFromDashboard_(payload.frequency);
  var expected = parseIncomeExpectedAmountFromDashboard_(payload.expectedAmount);
  if (recurring === 'Yes') {
    if (!frequency) {
      throw new Error('Frequency is required when Recurring is Yes.');
    }
    if (expected.known !== true) {
      throw new Error('Expected amount is required when Recurring is Yes. Use 0 if the occurrence amount is zero.');
    }
  }

  var ss = optionalSpreadsheet || getUserSpreadsheet_();
  var year = getCurrentYear_();

  // First-run safety: income rows are written into the current year's Cash
  // Flow sheet, which may not exist yet on a freshly-onboarded workbook.
  // Create it on demand via the centralized safe helper (no-op if it
  // already exists) so adding income "just works" rather than dead-ending
  // with "create the sheet first". Mirrors the bill/debt seed paths.
  if (!optionalSpreadsheet && typeof ensureCashFlowYearSheet_ === 'function') {
    try { ensureCashFlowYearSheet_(year); } catch (_ensureErr) { /* fall through; read below surfaces a clear error */ }
  }

  var sheet;
  try {
    sheet = getCashFlowSheet_(ss, year);
  } catch (e) {
    throw new Error(
      'Cash Flow sheet for ' + year + ' was not found. Create ' +
      getCashFlowSheetName_(year) + ' first, then add income sources.'
    );
  }

  var headerMap = getCashFlowHeaderMap_(sheet);
  if ((recurring || frequency || expected.known) &&
      (!(headerMap.recurringCol > 0) || !(headerMap.frequencyCol > 0) ||
       !(headerMap.expectedAmountCol > 0))) {
    throw new Error(
      'Add Recurring, Frequency, and Expected Amount columns from Manage income first. No income row was added.'
    );
  }

  var today = stripTime_(new Date());
  var monthCol;
  try {
    monthCol = getMonthColumnByDate_(sheet, today, 1);
  } catch (e) {
    throw new Error(
      'Could not find the current month column on ' + sheet.getName() +
      '. Check the month headers on that sheet.'
    );
  }

  // Group-level duplicate check against the CURRENT year only. This is
  // the canonical sheet the new row will live on, so collisions here
  // are what matter for the user's live Cash Flow totals.
  var groups = analyzeIncomeLifecycleGroupsInSheet_(sheet);
  var normalizedNew = normalizeIncomeName_(name);
  var normalizedNewKey = normalizedNew.toLowerCase();
  for (var i = 0; i < groups.length; i++) {
    if (groups[i].displayName.toLowerCase() === normalizedNewKey) {
      throw new Error(
        'An income source named "' + groups[i].displayName + '" already exists. ' +
        (groups[i].lifecycleState === 'inactive'
          ? 'Use Show inactive income sources to reactivate it without recording new income.'
          : 'Update its monthly amount on the Cash Flow sheet.')
      );
    }
  }
  var rowInfo = insertCashFlowRow_(sheet, 'Income', name, 'CASH');
  var targetRow = rowInfo.row;
  var rowCreated = true;
  var flowSourceWritten = (headerMap.flowSourceColZero !== -1);

  // Authoritative write — this is the income amount for the current
  // month, not a quick-pay increment. We overwrite any pre-existing
  // value in the cell so the totals reflect exactly what the user just
  // entered. Uses the Cash-Flow money format (red negatives) to keep the
  // month column consistent with auto-entered expense cells; income is
  // positive so the negative section is inert here.
  setCashFlowMoneyCellPreserveRowFormat_(sheet, targetRow, monthCol, amountNum, 3);

  if (headerMap.recurringCol > 0 && recurring) {
    sheet.getRange(targetRow, headerMap.recurringCol).setValue(recurring);
  }
  if (headerMap.frequencyCol > 0 && frequency) {
    sheet.getRange(targetRow, headerMap.frequencyCol).setValue(frequency);
  }
  if (headerMap.expectedAmountCol > 0 && expected.known) {
    var expectedCell = sheet.getRange(targetRow, headerMap.expectedAmountCol);
    expectedCell.setValue(expected.value);
    try {
      expectedCell.setNumberFormat('$#,##0.00;[Red]-$#,##0.00');
    } catch (_expectedFmt) { /* cosmetic */ }
  }

  var monthLabel = Utilities.formatDate(today, Session.getScriptTimeZone(), 'MMM-yy');
  var todayIso = Utilities.formatDate(today, Session.getScriptTimeZone(), 'yyyy-MM-dd');

  try {
    appendActivityLog_(ss, {
      eventType: 'income_add',
      entryDate: todayIso,
      amount: amountNum,
      direction: 'income',
      payee: name,
      category: '',
      accountSource: '',
      cashFlowSheet: sheet.getName(),
      cashFlowMonth: monthLabel,
      dedupeKey: '',
      details: JSON.stringify({
        detailsVersion: 1,
        amount: amountNum,
        year: year,
        rowCreated: rowCreated,
        rowReactivated: false,
        flowSourceWritten: flowSourceWritten,
        recurring: recurring,
        frequency: frequency,
        expectedAmount: expected.known ? expected.value : null,
        expectedKnown: expected.known === true
      })
    });
  } catch (logErr) {
    Logger.log('addIncomeSourceFromDashboard activity log: ' + logErr);
  }

  touchDashboardSourceUpdated_('cash_flow');

  var incomeFitTargets = [
    { sheet: sheet, col: headerMap.payeeCol },
    { sheet: sheet, col: monthCol }
  ];
  if (rowCreated) {
    incomeFitTargets.push({ sheet: sheet, col: headerMap.typeCol });
    incomeFitTargets.push({ sheet: sheet, col: headerMap.activeCol });
  }
  if (flowSourceWritten) {
    incomeFitTargets.push({ sheet: sheet, col: headerMap.flowSourceCol });
  }
  if (headerMap.recurringCol > 0) {
    incomeFitTargets.push({ sheet: sheet, col: headerMap.recurringCol });
  }
  if (headerMap.frequencyCol > 0) {
    incomeFitTargets.push({ sheet: sheet, col: headerMap.frequencyCol });
  }
  if (headerMap.expectedAmountCol > 0) {
    incomeFitTargets.push({ sheet: sheet, col: headerMap.expectedAmountCol });
  }
  fitContentColumnsToContents_(
    incomeFitTargets,
    'addIncomeSourceFromDashboard changed-column fit'
  );

  var message;
  message = 'Added "' + name + '" to ' + sheet.getName() + '.';

  return {
    ok: true,
    message: message,
    sourceName: name,
    year: year,
    sheetName: sheet.getName()
  };
}

/**
 * Update Recurring / Frequency / Expected Amount on existing active Cash Flow
 * income rows. Never inserts a row and never writes month cells.
 */
function updateIncomeForecastFieldsFromDashboard(payload, optionalSpreadsheet) {
  validateRequired_(payload, ['groupKey', 'year', 'rows']);

  var recurring = parseIncomeRecurringStatusFromDashboard_(payload.recurring);
  var frequency = parseIncomeFrequencyFromDashboard_(payload.frequency);
  var expected = parseIncomeExpectedAmountFromDashboard_(payload.expectedAmount);
  if (recurring === 'Yes') {
    if (!frequency) {
      throw new Error('Frequency is required when Recurring is Yes.');
    }
    if (expected.known !== true) {
      throw new Error('Expected amount is required when Recurring is Yes. Use 0 if the occurrence amount is zero.');
    }
  }

  var year = Math.round(Number(payload.year));
  if (!isFinite(year) || year < 2000 || year > 3000) {
    throw new Error('Invalid year for income source.');
  }

  var ss = optionalSpreadsheet || getUserSpreadsheet_();
  var lock = LockService.getUserLock();
  lock.waitLock(10000);
  try {
    var sheet;
    try { sheet = getCashFlowSheet_(ss, year); }
    catch (e) { throw new Error('Cash Flow sheet for ' + year + ' was not found.'); }

    var headerMap = getCashFlowHeaderMap_(sheet);
    if (!(headerMap.recurringCol > 0) || !(headerMap.frequencyCol > 0) ||
        !(headerMap.expectedAmountCol > 0)) {
      throw new Error(
        'Add Recurring, Frequency, and Expected Amount columns from Manage income first. Existing income rows were not changed.'
      );
    }
    var identity = validateIncomeLifecycleReference_(sheet, headerMap, payload);
    if (typeof isCiscoBonusIncomeName_ === 'function' &&
        isCiscoBonusIncomeName_(identity.displayName)) {
      throw new Error(
        'Cisco Mid Year Bonus and Cisco End Year Bonus are edited as their own annual income rows. Split the existing Cisco Bonus entry first if those named rows are not present.'
      );
    }
    if (identity.activeCount === 0) {
      throw new Error('Inactive income sources cannot be edited. Reactivate the source first.');
    }

    var fields = {
      recurring: recurring,
      frequency: frequency,
      expectedKnown: expected.known === true,
      expectedAmount: expected.known === true ? expected.value : ''
    };
    var originals = [];
    try {
      for (var i = 0; i < identity.rows.length; i++) {
        var sheetRow = identity.rows[i].sheetRow;
        var lastCol = Math.max(1, sheet.getLastColumn());
        var valueRow = sheet.getRange(sheetRow, 1, 1, lastCol).getValues()[0] || [];
        originals.push({
          sheetRow: sheetRow,
          recurring: headerMap.recurringCol > 0
            ? sheet.getRange(sheetRow, headerMap.recurringCol).getValue() : '',
          frequency: headerMap.frequencyCol > 0
            ? sheet.getRange(sheetRow, headerMap.frequencyCol).getValue() : '',
          expected: headerMap.expectedAmountCol > 0
            ? sheet.getRange(sheetRow, headerMap.expectedAmountCol).getValue() : ''
        });
        var nextRow = applyIncomeForecastFieldsToRow_(valueRow, headerMap, fields);
        if (headerMap.recurringCol > 0) {
          sheet.getRange(sheetRow, headerMap.recurringCol)
            .setValue(nextRow[headerMap.recurringColZero]);
        }
        if (headerMap.frequencyCol > 0) {
          sheet.getRange(sheetRow, headerMap.frequencyCol)
            .setValue(nextRow[headerMap.frequencyColZero]);
        }
        if (headerMap.expectedAmountCol > 0) {
          var expectedCell = sheet.getRange(sheetRow, headerMap.expectedAmountCol);
          expectedCell.setValue(nextRow[headerMap.expectedAmountColZero]);
          if (fields.expectedKnown) {
            try {
              expectedCell.setNumberFormat('$#,##0.00;[Red]-$#,##0.00');
            } catch (_expectedFmt) { /* cosmetic */ }
          }
        }
      }
    } catch (writeErr) {
      for (var j = 0; j < originals.length; j++) {
        try {
          if (headerMap.recurringCol > 0) {
            sheet.getRange(originals[j].sheetRow, headerMap.recurringCol)
              .setValue(originals[j].recurring);
          }
          if (headerMap.frequencyCol > 0) {
            sheet.getRange(originals[j].sheetRow, headerMap.frequencyCol)
              .setValue(originals[j].frequency);
          }
          if (headerMap.expectedAmountCol > 0) {
            sheet.getRange(originals[j].sheetRow, headerMap.expectedAmountCol)
              .setValue(originals[j].expected);
          }
        } catch (_rollbackErr) { /* best effort */ }
      }
      throw writeErr;
    }

    try {
      appendActivityLog_(ss, {
        eventType: 'income_forecast_edit',
        entryDate: Utilities.formatDate(
          stripTime_(new Date()),
          Session.getScriptTimeZone(),
          'yyyy-MM-dd'
        ),
        amount: expected.known ? expected.value : 0,
        direction: 'income',
        payee: identity.displayName,
        category: '',
        accountSource: '',
        cashFlowSheet: sheet.getName(),
        cashFlowMonth: '',
        dedupeKey: '',
        details: JSON.stringify({
          detailsVersion: 1,
          reason: 'forecast_fields',
          year: year,
          recurring: recurring,
          frequency: frequency,
          expectedAmount: expected.known ? expected.value : null,
          expectedKnown: expected.known === true,
          rowsUpdated: identity.rows.length,
          rows: identity.rows
        })
      });
    } catch (logErr) {
      Logger.log('updateIncomeForecastFieldsFromDashboard activity log: ' + logErr);
    }

    touchDashboardSourceUpdated_('cash_flow');
    return {
      ok: true,
      message: 'Updated Recurring, Frequency, and Expected Amount for "' +
        identity.displayName + '" without changing monthly Cash Flow amounts.',
      sourceName: identity.displayName,
      rowsUpdated: identity.rows.length
    };
  } finally {
    lock.releaseLock();
  }
}

/* -------------------------------------------------------------------------- */
/*  Dashboard: exact-row Stop / Reactivate lifecycle                          */
/* -------------------------------------------------------------------------- */

function normalizeIncomeLifecycleRows_(rows) {
  if (!Array.isArray(rows) || !rows.length) {
    throw new Error('Income source row evidence is missing. Refresh Income and try again.');
  }
  var seen = {};
  return rows.map(function(row) {
    var sheetRow = Math.round(Number(row && row.sheetRow));
    var payee = String(row && row.payee || '').trim();
    if (!isFinite(sheetRow) || sheetRow < 2 || !payee || seen[sheetRow]) {
      throw new Error('Income source row evidence is invalid. Refresh Income and try again.');
    }
    seen[sheetRow] = true;
    return { sheetRow: sheetRow, payee: payee };
  }).sort(function(a, b) { return a.sheetRow - b.sheetRow; });
}

function validateIncomeLifecycleReference_(sheet, headerMap, payload) {
  var groupKey = String(payload.groupKey || '').trim().toLowerCase();
  if (!groupKey) throw new Error('Income source reference is required.');
  var expectedName = String(payload.sourceName || payload.expectedSourceName || '').trim();
  var expectedRows = normalizeIncomeLifecycleRows_(payload.rows);
  var display = sheet.getDataRange().getDisplayValues();
  var actualRows = [];
  var activeCount = 0;
  var inactiveCount = 0;

  for (var r = 1; r < display.length; r++) {
    var row = display[r] || [];
    if (String(row[headerMap.typeColZero] || '').trim().toLowerCase() !== 'income') continue;
    var payee = String(row[headerMap.payeeColZero] || '').trim();
    if (!payee || normalizeIncomeName_(payee).toLowerCase() !== groupKey) continue;
    actualRows.push({ sheetRow: r + 1, payee: payee });
    var rawActive = headerMap.activeColZero === -1
      ? '' : String(row[headerMap.activeColZero] || '').trim();
    if (rawActive && normalizeYesNo_(rawActive) === 'no') inactiveCount += 1;
    else activeCount += 1;
  }

  actualRows.sort(function(a, b) { return a.sheetRow - b.sheetRow; });
  if (actualRows.length !== expectedRows.length) {
    throw new Error('This income source changed or became ambiguous. Refresh Income and try again.');
  }
  for (var i = 0; i < expectedRows.length; i++) {
    if (actualRows[i].sheetRow !== expectedRows[i].sheetRow ||
        actualRows[i].payee !== expectedRows[i].payee) {
      throw new Error('This income source moved or changed on the Cash Flow sheet. Refresh Income and try again.');
    }
  }
  var normalizedExpected = normalizeIncomeName_(expectedName);
  if (expectedName && normalizedExpected.toLowerCase() !== groupKey) {
    throw new Error('This income source identity is stale. Refresh Income and try again.');
  }
  return {
    displayName: normalizedExpected || normalizeIncomeName_(actualRows[0].payee),
    rows: actualRows,
    activeCount: activeCount,
    inactiveCount: inactiveCount
  };
}

function setIncomeLifecycleActiveState_(sheet, activeCol, rows, nextValue) {
  var originals = [];
  try {
    for (var i = 0; i < rows.length; i++) {
      var cell = sheet.getRange(rows[i].sheetRow, activeCol);
      originals.push(cell.getValue());
      cell.setValue(nextValue);
    }
    for (var verify = 0; verify < rows.length; verify++) {
      var written = String(
        sheet.getRange(rows[verify].sheetRow, activeCol).getDisplayValue() || ''
      ).trim();
      if (normalizeYesNo_(written) !== normalizeYesNo_(nextValue)) {
        throw new Error('Income lifecycle write could not be verified. Changes were rolled back.');
      }
    }
  } catch (writeErr) {
    for (var j = 0; j < originals.length; j++) {
      try { sheet.getRange(rows[j].sheetRow, activeCol).setValue(originals[j]); }
      catch (_rollbackErr) { /* best effort; preserve original failure */ }
    }
    throw writeErr;
  }
}

/**
 * Soft-delete: after exact displayed-row verification, flip only Active to NO.
 *
 * Payload:
 *   - groupKey   {string} lowercased normalized display name
 *                (matches what `getActiveIncomeSourcesForManagementFromDashboard`
 *                returns so the client doesn't have to re-derive it)
 *   - year       {number} Cash Flow year the group was read from
 *   - sourceName {string} user-facing label (for messages / activity)
 *   - rows       {Array<{sheetRow:number,payee:string}>} exact UI evidence
 *
 * The function never deletes rows or changes monthly amounts. When the
 * current year's sheet doesn't have an Active column yet (legacy tabs)
 * we self-heal it before writing so Stop tracking always completes.
 */
function deactivateIncomeSourceFromDashboard(payload, optionalSpreadsheet) {
  validateRequired_(payload, ['groupKey', 'year']);

  var groupKey = String(payload.groupKey || '').trim().toLowerCase();
  if (!groupKey) throw new Error('Income source reference is required.');

  var year = Math.round(Number(payload.year));
  if (!isFinite(year) || year < 2000 || year > 3000) {
    throw new Error('Invalid year for income source.');
  }

  var ss = optionalSpreadsheet || getUserSpreadsheet_();
  var lock = LockService.getUserLock();
  lock.waitLock(10000);
  try {
    var sheet;
    try { sheet = getCashFlowSheet_(ss, year); }
    catch (e) { throw new Error('Cash Flow sheet for ' + year + ' was not found.'); }
    var headerMap = getCashFlowHeaderMap_(sheet);
    if (headerMap.activeColZero === -1) {
      sheet.getRange(1, sheet.getLastColumn() + 1).setValue('Active');
      headerMap = getCashFlowHeaderMap_(sheet);
    }
    var identity = validateIncomeLifecycleReference_(sheet, headerMap, payload);
    if (identity.activeCount === 0) {
      return { ok: true, alreadyInactive: true, message: 'Income source was already inactive.', sourceName: identity.displayName };
    }
    setIncomeLifecycleActiveState_(sheet, headerMap.activeCol, identity.rows, 'NO');

  try {
    appendActivityLog_(ss, {
      eventType: 'income_deactivate',
      entryDate: Utilities.formatDate(
        stripTime_(new Date()),
        Session.getScriptTimeZone(),
        'yyyy-MM-dd'
      ),
      amount: 0,
      direction: 'income',
      payee: identity.displayName,
      category: '',
      accountSource: '',
      cashFlowSheet: sheet.getName(),
      cashFlowMonth: '',
      dedupeKey: '',
      details: JSON.stringify({
        detailsVersion: 1,
        reason: 'stop_tracking',
        year: year,
        rowsDeactivated: identity.rows.length,
        rows: identity.rows
      })
    });
  } catch (logErr) {
    Logger.log('deactivateIncomeSourceFromDashboard activity log: ' + logErr);
  }

    touchDashboardSourceUpdated_('cash_flow');
    return {
      ok: true,
      message: 'Stopped tracking "' + identity.displayName + '".',
      sourceName: identity.displayName
    };
  } finally {
    lock.releaseLock();
  }
}

/** Restore tracking only; never create rows or record current-month income. */
function reactivateIncomeSourceFromDashboard(payload, optionalSpreadsheet) {
  validateRequired_(payload, ['groupKey', 'year', 'rows']);
  var year = Math.round(Number(payload.year));
  if (!isFinite(year) || year < 2000 || year > 3000) {
    throw new Error('Invalid year for income source.');
  }
  var ss = optionalSpreadsheet || getUserSpreadsheet_();
  var lock = LockService.getUserLock();
  lock.waitLock(10000);
  try {
    var sheet;
    try { sheet = getCashFlowSheet_(ss, year); }
    catch (e) { throw new Error('Cash Flow sheet for ' + year + ' was not found.'); }
    var headerMap = getCashFlowHeaderMap_(sheet);
    if (headerMap.activeColZero === -1) {
      throw new Error('This income source is no longer inactive. Refresh Income and try again.');
    }
    var identity = validateIncomeLifecycleReference_(sheet, headerMap, payload);
    if (identity.inactiveCount === 0) {
      return { ok: true, alreadyActive: true, message: 'Income source is already active.', sourceName: identity.displayName };
    }
    if (identity.activeCount > 0) {
      throw new Error('This income source has mixed active state. Refresh Income and review its Cash Flow rows.');
    }
    setIncomeLifecycleActiveState_(sheet, headerMap.activeCol, identity.rows, 'YES');

    try {
      appendActivityLog_(ss, {
        eventType: 'income_reactivate',
        entryDate: Utilities.formatDate(stripTime_(new Date()), Session.getScriptTimeZone(), 'yyyy-MM-dd'),
        amount: 0,
        direction: 'income',
        payee: identity.displayName,
        category: '',
        accountSource: '',
        cashFlowSheet: sheet.getName(),
        cashFlowMonth: '',
        dedupeKey: '',
        details: JSON.stringify({
          detailsVersion: 1,
          reason: 'reactivate_tracking',
          year: year,
          rowsReactivated: identity.rows.length,
          rows: identity.rows
        })
      });
    } catch (logErr) {
      Logger.log('reactivateIncomeSourceFromDashboard activity log: ' + logErr);
    }
    touchDashboardSourceUpdated_('cash_flow');
    return {
      ok: true,
      message: 'Reactivated "' + identity.displayName + '".',
      sourceName: identity.displayName
    };
  } finally {
    lock.releaseLock();
  }
}

/* -------------------------------------------------------------------------- */
/*  Dashboard: "Other detected income" reference surface                      */
/* -------------------------------------------------------------------------- */

/**
 * Reference-only list of non-recurring / excluded income candidates
 * spotted in the latest Cash Flow year. Shares the same classification
 * pipeline as the main management list so the two surfaces can't drift:
 * an item appears here exactly when it does NOT qualify as a recurring
 * tracked source because it is excluded, negative, or non-positive.
 *
 * Pure read / no writes. No actions attached — the section exists so
 * users can see what the system detected but chose not to treat as a
 * recurring source.
 *
 * @returns {{
 *   year: (number|null),
 *   items: Array<{
 *     sourceName: string,
 *     reason: string,      // excluded_pattern | below_min_months | negative_month | non_positive_amount
 *     monthsHit: number,
 *     avgNonZero: number
 *   }>
 * }}
 */
function getOtherDetectedIncomeFromLatestCashFlowFromDashboard() {
  var ss = getUserSpreadsheet_();
  var year = findLatestCashFlowYearWithIncome_(ss);
  if (year == null) return { year: null, items: [] };

  var sheet;
  try { sheet = getCashFlowSheet_(ss, year); } catch (e) { return { year: year, items: [] }; }

  var groups = classifyIncomeGroupsInSheet_(sheet).other;
  var items = [];
  for (var i = 0; i < groups.length; i++) {
    var g = groups[i];
    if (typeof isCiscoBonusIncomeName_ === 'function' && isCiscoBonusIncomeName_(g.displayName)) {
      continue;
    }
    var reason;
    if (g.excluded) reason = 'excluded_pattern';
    else if (g.hasNegativeMonth) reason = 'negative_month';
    else if (g.avgNonZero <= 0) reason = 'non_positive_amount';
    else reason = 'below_min_months';

    items.push({
      sourceName: g.displayName,
      reason: reason,
      monthsHit: g.monthsHit,
      avgNonZero: g.avgNonZero
    });
  }
  return { year: year, items: items };
}
