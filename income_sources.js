/**
 * Income sources — Cash Flow is the canonical source of truth.
 *
 * There is intentionally no separate INPUT - Income Sources sheet. The
 * Income screen is a thin management layer over the latest
 * `INPUT - Cash Flow <year>` tab:
 *
 *   Display   → scan the latest Cash Flow year that has Income rows,
 *               group active Income rows by a conservatively normalized
 *               payee name, and return the high-confidence recurring
 *               groups.
 *
 *   Add       → write a Cash Flow Income row in the current year
 *               (Type=Income, Flow Source=CASH, Active=YES, Payee=name)
 *               and set the current month cell. No past/future month
 *               auto-fill in v1. This immediately affects monthly Cash
 *               Flow totals.
 *
 *   Stop      → flip Active=NO on every Cash Flow Income row whose
 *               normalized name matches the group being stopped. History
 *               is preserved; rows are never deleted.
 *
 * Activity only tracks user-triggered actions performed here
 * (`income_add` / `income_deactivate`). Historical Cash Flow income is
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
 * Recurring gate: a grouped income source must appear in at least this
 * many distinct months with positive cash flow before it shows up as a
 * tracked source on the main list. Sparse / one-off rows surface in the
 * "Other detected income" reference section instead.
 */
var INCOME_MIN_MONTHS_FOR_RECURRING_ = 3;

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
function analyzeIncomeGroupsInSheet_(sheet) {
  if (!sheet) return [];
  var headerMap;
  try {
    headerMap = getCashFlowHeaderMap_(sheet);
  } catch (e) {
    return [];
  }
  var display = sheet.getDataRange().getDisplayValues();
  if (!display || display.length < 2) return [];

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

/* -------------------------------------------------------------------------- */
/*  Dashboard: list active income sources                                     */
/* -------------------------------------------------------------------------- */

/**
 * Return the high-confidence recurring income groups from the latest
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
function getActiveIncomeSourcesForManagementFromDashboard() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var year = findLatestCashFlowYearWithIncome_(ss);
  if (year == null) return [];

  var sheet;
  try { sheet = getCashFlowSheet_(ss, year); } catch (e) { return []; }

  var groups = analyzeIncomeGroupsInSheet_(sheet);
  var out = [];
  for (var i = 0; i < groups.length; i++) {
    var g = groups[i];
    if (!incomeGroupQualifiesAsRecurring_(g)) continue;
    out.push({
      groupKey: g.displayName.toLowerCase(),
      sourceName: g.displayName,
      amount: g.avgNonZero,
      frequency: 'Monthly',
      year: year,
      sheetName: sheet.getName()
    });
  }
  // Largest-first ordering surfaces material income at the top of the
  // management list; name is a deterministic tiebreaker.
  out.sort(function(a, b) {
    if ((b.amount || 0) !== (a.amount || 0)) return (b.amount || 0) - (a.amount || 0);
    return String(a.sourceName || '').toLowerCase()
      .localeCompare(String(b.sourceName || '').toLowerCase());
  });
  return out;
}

/* -------------------------------------------------------------------------- */
/*  Dashboard: add income source (writes to Cash Flow)                        */
/* -------------------------------------------------------------------------- */

/**
 * Add a new income source by writing directly to the current year's
 * Cash Flow tab.
 *
 * Payload:
 *   - sourceName {string} non-empty (<=160 chars)
 *   - amount     {number|string} strictly > 0 (this month's amount)
 *
 * Behavior:
 *   - Group-level duplicate check against the same Cash Flow year's
 *     active Income rows using the normalized name. Inactive / dormant
 *     rows do NOT block reuse (matching the app's Stop tracking
 *     semantics).
 *   - If an inactive row already exists with the exact same payee name
 *     (case-insensitive), reactivate it (Active=YES) and write the
 *     current month amount — avoids creating duplicate rows when a user
 *     re-enables a source they previously stopped.
 *   - Otherwise insert a new Cash Flow row (Type=Income, Flow Source=
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
function addIncomeSourceFromDashboard(payload) {
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

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var year = getCurrentYear_();
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
  var groups = analyzeIncomeGroupsInSheet_(sheet);
  var normalizedNew = normalizeIncomeName_(name);
  var normalizedNewKey = normalizedNew.toLowerCase();
  for (var i = 0; i < groups.length; i++) {
    if (groups[i].displayName.toLowerCase() === normalizedNewKey) {
      throw new Error(
        'An income source named "' + groups[i].displayName +
        '" is already tracked. Update its monthly amount on the Cash Flow sheet.'
      );
    }
  }

  // Look for a dormant exact-payee match (case-insensitive) on the
  // current year's sheet — reactivating it keeps the sheet tidy when a
  // user re-enables a source they previously stopped tracking.
  var display = sheet.getDataRange().getDisplayValues();
  var exactMatchRow = -1;
  var nameLower = name.toLowerCase();
  for (var r = 1; r < display.length; r++) {
    var rowDisplay = display[r] || [];
    var typeVal = String(rowDisplay[headerMap.typeColZero] || '').trim().toLowerCase();
    if (typeVal !== 'income') continue;
    var payeeVal = String(rowDisplay[headerMap.payeeColZero] || '').trim();
    if (!payeeVal) continue;
    if (payeeVal.toLowerCase() === nameLower) {
      exactMatchRow = r + 1;
      break;
    }
  }

  var targetRow;
  var rowCreated = false;
  var rowReactivated = false;
  var flowSourceWritten = false;

  if (exactMatchRow !== -1) {
    targetRow = exactMatchRow;
    // Ensure Active=YES. If the row was previously stopped, this is a
    // reactivation; if the column was blank, seed it explicitly so the
    // sheet is self-documenting.
    if (headerMap.activeColZero !== -1) {
      var currentActive = String(
        sheet.getRange(targetRow, headerMap.activeCol).getDisplayValue() || ''
      ).trim();
      if (currentActive && normalizeYesNo_(currentActive) === 'no') {
        sheet.getRange(targetRow, headerMap.activeCol).setValue('YES');
        rowReactivated = true;
      } else if (!currentActive) {
        sheet.getRange(targetRow, headerMap.activeCol).setValue('YES');
      }
    }
    // Fill a blank Flow Source with CASH — never overwrite a value the
    // user (or a prior caller) already set.
    if (headerMap.flowSourceColZero !== -1) {
      var flowRaw = String(
        sheet.getRange(targetRow, headerMap.flowSourceCol).getDisplayValue() || ''
      ).trim();
      if (!flowRaw) {
        sheet.getRange(targetRow, headerMap.flowSourceCol).setValue('CASH');
        flowSourceWritten = true;
      }
    }
  } else {
    // Create a brand-new row. `insertCashFlowRow_` places it after the
    // last existing Income row (or just before the Summary row), copies
    // the prior row's formatting, and seeds Active=YES when the column
    // exists. We pass 'CASH' so the Flow Source cell is seeded too.
    var rowInfo = insertCashFlowRow_(sheet, 'Income', name, 'CASH');
    targetRow = rowInfo.row;
    rowCreated = true;
    flowSourceWritten = (headerMap.flowSourceColZero !== -1);
  }

  // Authoritative write — this is the income amount for the current
  // month, not a quick-pay increment. We overwrite any pre-existing
  // value in the cell so the totals reflect exactly what the user just
  // entered.
  setCurrencyCellPreserveRowFormat_(sheet, targetRow, monthCol, amountNum, 3);

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
        rowReactivated: rowReactivated,
        flowSourceWritten: flowSourceWritten
      })
    });
  } catch (logErr) {
    Logger.log('addIncomeSourceFromDashboard activity log: ' + logErr);
  }

  touchDashboardSourceUpdated_('cash_flow');

  var message;
  if (rowReactivated) message = 'Restarted "' + name + '" on ' + sheet.getName() + '.';
  else if (rowCreated) message = 'Added "' + name + '" to ' + sheet.getName() + '.';
  else message = 'Updated "' + name + '" on ' + sheet.getName() + '.';

  return {
    ok: true,
    message: message,
    sourceName: name,
    year: year,
    sheetName: sheet.getName()
  };
}

/* -------------------------------------------------------------------------- */
/*  Dashboard: stop tracking (flip Active=NO on every matching row)           */
/* -------------------------------------------------------------------------- */

/**
 * Soft-delete: flip Active=NO on every `Type=Income` row on the given
 * Cash Flow year whose normalized payee matches `groupKey`.
 *
 * Payload:
 *   - groupKey   {string} lowercased normalized display name
 *                (matches what `getActiveIncomeSourcesForManagementFromDashboard`
 *                returns so the client doesn't have to re-derive it)
 *   - year       {number} Cash Flow year the group was read from
 *   - sourceName {string} user-facing label (for messages / activity)
 *
 * The function never deletes rows — history stays intact. When the
 * current year's sheet doesn't have an Active column yet (legacy tabs)
 * we self-heal it before writing so Stop tracking always completes.
 */
function deactivateIncomeSourceFromDashboard(payload) {
  validateRequired_(payload, ['groupKey', 'year']);

  var groupKey = String(payload.groupKey || '').trim().toLowerCase();
  if (!groupKey) throw new Error('Income source reference is required.');

  var year = Math.round(Number(payload.year));
  if (!isFinite(year) || year < 2000 || year > 3000) {
    throw new Error('Invalid year for income source.');
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet;
  try {
    sheet = getCashFlowSheet_(ss, year);
  } catch (e) {
    throw new Error('Cash Flow sheet for ' + year + ' was not found.');
  }

  var headerMap = getCashFlowHeaderMap_(sheet);

  // Self-heal: legacy tabs without an Active column get one appended so
  // Stop tracking can set a real value. Blank / missing Active is
  // treated as active everywhere else in the app, so this is additive.
  if (headerMap.activeColZero === -1) {
    var insertAt = sheet.getLastColumn() + 1;
    sheet.getRange(1, insertAt).setValue('Active');
    headerMap = getCashFlowHeaderMap_(sheet);
  }

  var display = sheet.getDataRange().getDisplayValues();
  var deactivatedRows = [];
  var displayName = String(payload.sourceName || '').trim();

  for (var r = 1; r < display.length; r++) {
    var row = display[r] || [];
    var typeVal = String(row[headerMap.typeColZero] || '').trim().toLowerCase();
    if (typeVal !== 'income') continue;
    var payeeVal = String(row[headerMap.payeeColZero] || '').trim();
    if (!payeeVal) continue;

    var normalized = normalizeIncomeName_(payeeVal);
    if (normalized.toLowerCase() !== groupKey) continue;

    if (!displayName) displayName = normalized;

    var rawActive = headerMap.activeColZero !== -1
      ? String(row[headerMap.activeColZero] || '').trim()
      : '';
    if (rawActive && normalizeYesNo_(rawActive) === 'no') continue; // already inactive

    sheet.getRange(r + 1, headerMap.activeCol).setValue('NO');
    deactivatedRows.push({ row: r + 1, payee: payeeVal });
  }

  if (!deactivatedRows.length) {
    return {
      ok: true,
      message: 'Income source was already inactive.',
      sourceName: displayName || payload.sourceName || ''
    };
  }

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
      payee: displayName,
      category: '',
      accountSource: '',
      cashFlowSheet: sheet.getName(),
      cashFlowMonth: '',
      dedupeKey: '',
      details: JSON.stringify({
        detailsVersion: 1,
        reason: 'stop_tracking',
        year: year,
        rowsDeactivated: deactivatedRows.length,
        rows: deactivatedRows
      })
    });
  } catch (logErr) {
    Logger.log('deactivateIncomeSourceFromDashboard activity log: ' + logErr);
  }

  touchDashboardSourceUpdated_('cash_flow');

  return {
    ok: true,
    message: 'Stopped tracking "' + displayName + '".',
    sourceName: displayName
  };
}

/* -------------------------------------------------------------------------- */
/*  Dashboard: "Other detected income" reference surface                      */
/* -------------------------------------------------------------------------- */

/**
 * Reference-only list of non-recurring / excluded income candidates
 * spotted in the latest Cash Flow year. Shares the same classification
 * pipeline as the main management list so the two surfaces can't drift:
 * an item appears here exactly when it does NOT qualify as a recurring
 * tracked source.
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
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var year = findLatestCashFlowYearWithIncome_(ss);
  if (year == null) return { year: null, items: [] };

  var sheet;
  try { sheet = getCashFlowSheet_(ss, year); } catch (e) { return { year: year, items: [] }; }

  var groups = analyzeIncomeGroupsInSheet_(sheet);
  var items = [];
  for (var i = 0; i < groups.length; i++) {
    var g = groups[i];
    // Mirror the recurring gate: anything that WOULD qualify is already
    // on the main tracked list, so it never surfaces here.
    if (incomeGroupQualifiesAsRecurring_(g)) continue;

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
