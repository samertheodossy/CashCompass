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
function getIncomeSourcesForManagementFromDashboard(optionalSpreadsheet) {
  var ss = optionalSpreadsheet || getUserSpreadsheet_();
  var year = findLatestCashFlowYearWithAnyIncome_(ss);
  if (year == null) return { year: null, activeSources: [], inactiveSources: [] };

  var sheet;
  try { sheet = getCashFlowSheet_(ss, year); }
  catch (e) {
    throw new Error('Could not load the income lifecycle inventory. Please refresh and try again.');
  }

  var groups = analyzeIncomeLifecycleGroupsInSheet_(sheet);
  var active = [];
  var inactive = [];
  for (var i = 0; i < groups.length; i++) {
    var g = groups[i];
    if (!incomeGroupQualifiesAsRecurring_(g)) continue;
    var item = {
      groupKey: g.groupKey,
      sourceName: g.displayName,
      amount: g.avgNonZero,
      frequency: 'Monthly',
      year: year,
      sheetName: sheet.getName(),
      rows: g.rows,
      mixedState: g.mixedState
    };
    if (g.lifecycleState === 'inactive') inactive.push(item);
    else active.push(item);
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
  return { year: year, activeSources: active, inactiveSources: inactive };
}

/** Backward-compatible active-only read seam for older callers. */
function getActiveIncomeSourcesForManagementFromDashboard(optionalSpreadsheet) {
  return getIncomeSourcesForManagementFromDashboard(optionalSpreadsheet).activeSources;
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
        flowSourceWritten: flowSourceWritten
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
