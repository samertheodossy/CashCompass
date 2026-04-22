/**
 * Activity ledger: discrete user/script actions (Quick add / quick_pay, bill skip, bill autopay, bill_add, bill_deactivate, house expense, house_add, house_deactivate, donations, upcoming add/status/cashflow, bank_account_add, bank_account_deactivate, investment_add, investment_deactivate, debt_add, debt_deactivate, income_add, income_deactivate, …). Rows can be removed from the web UI for mistaken log lines only.
 * Complements OUT - History (planner-run snapshots). Tab: LOG - Activity.
 */

var ACTIVITY_LOG_SHEET_NAME = 'LOG - Activity';

var ACTIVITY_LOG_HEADERS = [
  'Logged At',
  'Event Type',
  'Entry Date',
  'Amount',
  'Direction',
  'Payee',
  'Category',
  'Account / Source',
  'Cash Flow Sheet',
  'Cash Flow Month',
  'Dedupe Key',
  'Details'
];

/** 1-based column index for Dedupe Key column. */
var ACTIVITY_LOG_DEDUPE_COL = 11;

/**
 * LOG - Activity "Entry Date" is often a real date cell: getValues() returns a Date, not the yyyy-MM-dd string we wrote.
 * Donation undo fingerprint must compare using the same calendar day as INPUT - Donation.
 * @param {*} cellVal
 * @returns {string} yyyy-MM-dd or best-effort trimmed string
 */
function activityLogEntryDateToYyyyMmDd_(cellVal) {
  if (cellVal instanceof Date && !isNaN(cellVal.getTime())) {
    return Utilities.formatDate(stripTime_(cellVal), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  var s = String(cellVal || '').trim();
  var m = /^(\d{4}-\d{2}-\d{2})/.exec(s);
  if (m) return m[1];
  try {
    var d = stripTime_(parseIsoDateLocal_(s));
    if (isNaN(d.getTime())) return s;
    return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  } catch (e) {
    return s;
  }
}

/**
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss
 * @returns {GoogleAppsScript.Spreadsheet.Sheet}
 */
/**
 * Creates LOG - Activity and headers if missing. Safe to call on every Bills Due / dashboard load.
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss
 */
function ensureActivityLogSheet_(ss) {
  getOrCreateActivityLogSheet_(ss);
}

function getOrCreateActivityLogSheet_(ss) {
  var sh = ss.getSheetByName(ACTIVITY_LOG_SHEET_NAME);
  if (sh) {
    // Self-heal an empty sheet only (blank A1). Do NOT touch populated
    // sheets — existing rows keep whatever formatting the user had.
    if (sh.getLastRow() === 0 || String(sh.getRange(1, 1).getValue() || '').trim() === '') {
      sh.getRange(1, 1, 1, ACTIVITY_LOG_HEADERS.length).setValues([ACTIVITY_LOG_HEADERS]);
      sh.setFrozenRows(1);
    }
    return sh;
  }
  try {
    sh = ss.insertSheet(ACTIVITY_LOG_SHEET_NAME);
  } catch (insertErr) {
    // On a truly blank workbook the dashboard fires several RPCs in
    // parallel (buildDashboardSnapshot_, getBillsDueFromCashFlowForDashboard,
    // etc.), each of which calls ensureActivityLogSheet_. The
    // getSheetByName check above and this insertSheet call are not
    // atomic across concurrent executions, so two threads can both
    // observe "missing" and race. The loser's insertSheet call throws
    // "A sheet with the name 'LOG - Activity' already exists." — that
    // surfaces as a red banner on the Overview. Treat the collision as
    // "the winner just created it" and return the now-existing sheet.
    // Any other insert failure is re-thrown so genuine problems still
    // surface clearly.
    var existing = ss.getSheetByName(ACTIVITY_LOG_SHEET_NAME);
    if (existing) return existing;
    throw insertErr;
  }
  sh.getRange(1, 1, 1, ACTIVITY_LOG_HEADERS.length).setValues([ACTIVITY_LOG_HEADERS]);
  sh.setFrozenRows(1);

  // First-creation-only polish. All wrapped in try/catch — cosmetic
  // only, must never fail a log write. Matches the bold-header +
  // auto-resize convention used by every other creator in the
  // workbook. Existing `LOG - Activity` sheets are skipped above, so
  // this branch only runs on truly-new logs.
  try {
    sh.getRange(1, 1, 1, ACTIVITY_LOG_HEADERS.length).setFontWeight('bold');
  } catch (_boldErr) { /* cosmetic only */ }
  try {
    sh.autoResizeColumns(1, ACTIVITY_LOG_HEADERS.length);
  } catch (_resizeErr) { /* cosmetic only */ }

  return sh;
}

/**
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss
 * @param {string} dedupeKey
 * @returns {boolean}
 */
function activityLogDedupeKeyExists_(ss, dedupeKey) {
  var key = String(dedupeKey || '').trim();
  if (!key) return false;

  var sh = ss.getSheetByName(ACTIVITY_LOG_SHEET_NAME);
  if (!sh || sh.getLastRow() < 2) return false;

  var lastRow = sh.getLastRow();
  // Read exactly the dedupe-key column, rows 2..lastRow (one column only).
  // Previously this passed `ACTIVITY_LOG_DEDUPE_COL` as the `numColumns`
  // argument by mistake, reading a `lastRow × 11` block starting at
  // col K; it only worked today because `values[i][0]` still pointed at
  // the right column, but was wasteful and would throw the moment the
  // sheet's max-columns dropped below K + 11 − 1.
  var values = sh.getRange(2, ACTIVITY_LOG_DEDUPE_COL, lastRow - 1, 1).getValues();
  for (var i = 0; i < values.length; i++) {
    if (String(values[i][0] || '').trim() === key) return true;
  }
  return false;
}

/**
 * @param {string} payee
 * @param {string} monthHeader e.g. Jan-26
 * @param {Date} dueDate
 * @param {number} amount
 * @returns {string}
 */
function buildBillAutopayDedupeKey_(payee, monthHeader, dueDate, amount) {
  var dd =
    dueDate instanceof Date
      ? Utilities.formatDate(dueDate, Session.getScriptTimeZone(), 'yyyy-MM-dd')
      : String(dueDate || '');
  return (
    'bill_autopay::' +
    normalizeActivityKeyPart_(payee) +
    '::' +
    String(monthHeader || '').trim() +
    '::' +
    dd +
    '::' +
    String(round2_(Math.abs(toNumber_(amount))))
  );
}

function normalizeActivityKeyPart_(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/**
 * @param {{ payee: string, year: number, monthHeader: string, dueDate?: string }} bill
 * @returns {string} yyyy-MM-dd or ''
 */
function activityLogEntryDateFromSkipBill_(bill) {
  if (!bill) return '';
  if (bill.dueDate) return String(bill.dueDate).trim();
  if (bill.year && bill.monthHeader) {
    var d = monthHeaderToFirstOfMonthDate_(bill.monthHeader, bill.year);
    return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return '';
}

function monthHeaderToFirstOfMonthDate_(monthHeader, fullYear) {
  var mon = String(monthHeader || '').split('-')[0];
  var monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var idx = monthNames.indexOf(mon);
  if (idx === -1) return new Date(fullYear, 0, 1);
  return new Date(fullYear, idx, 1);
}

/** Month column label from Cash Flow row 1 (e.g. Jan-26). */
function activityLogMonthHeaderFromCell_(sheet, col1Based) {
  return String(sheet.getRange(1, col1Based).getDisplayValue() || '').trim();
}

/** If getDashboardBillByKey_ fails, best-effort payee from skip key (payee must not contain "::"). */
function activityLogFallbackPayeeFromSkipKey_(skipKey) {
  var t = String(skipKey || '');
  if (t.indexOf('dashboard_bill_skip::') === 0 || t.indexOf('dashboard_recurring_skip::') === 0) {
    var parts = t.split('::');
    return parts.length >= 2 ? String(parts[1] || '').trim() : '';
  }
  return '';
}

/**
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss
 * @param {{
 *   eventType: string,
 *   entryDate: string,
 *   amount: number,
 *   direction: string,
 *   payee: string,
 *   category?: string,
 *   accountSource?: string,
 *   cashFlowSheet?: string,
 *   cashFlowMonth?: string,
 *   dedupeKey?: string,
 *   details?: string
 * }} payload
 * @returns {boolean}
 */
function appendActivityLog_(ss, payload) {
  try {
    var dedupe = String(payload.dedupeKey || '').trim();
    if (dedupe && activityLogDedupeKeyExists_(ss, dedupe)) {
      return false;
    }

    var sh = getOrCreateActivityLogSheet_(ss);
    var tz = Session.getScriptTimeZone();
    var loggedAt = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd HH:mm:ss');

    var row = [
      loggedAt,
      String(payload.eventType || '').trim(),
      String(payload.entryDate || '').trim(),
      round2_(Math.abs(toNumber_(payload.amount))),
      String(payload.direction || '').trim(),
      String(payload.payee || '').trim(),
      String(payload.category || '').trim(),
      String(payload.accountSource || '').trim(),
      String(payload.cashFlowSheet || '').trim(),
      String(payload.cashFlowMonth || '').trim(),
      dedupe,
      String(payload.details || '').trim()
    ];

    sh.appendRow(row);
    return true;
  } catch (e) {
    Logger.log('appendActivityLog_ failed: ' + e);
    return false;
  }
}

/**
 * Removes one data row from LOG - Activity (row 1 = headers is never deleted).
 * @param {number} row1Based 1-based sheet row (must be >= 2).
 * @returns {{ ok: boolean, error?: string }}
 */
function deleteActivityLogRow(row1Based) {
  try {
    var row = Number(row1Based);
    if (!isFinite(row) || row !== Math.floor(row) || row < 2) {
      return { ok: false, error: 'Invalid row.' };
    }
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName(ACTIVITY_LOG_SHEET_NAME);
    if (!sh) {
      return { ok: false, error: 'Activity log not found.' };
    }
    var last = sh.getLastRow();
    if (row > last) {
      return { ok: false, error: 'That row is no longer in the log. Click Apply to refresh.' };
    }

    var logVals = sh.getRange(row, 1, row, ACTIVITY_LOG_HEADERS.length).getValues()[0];
    var ev = String(logVals[1] || '').trim().toLowerCase();
    if (ev !== 'donation') {
      return {
        ok: false,
        error:
          'Remove from the dashboard is only enabled for Donation rows for now (other event types need safe undo before we enable them).'
      };
    }

    var activityUndo = '';
    var activityUndoDetail = '';
    var det = {};
    try {
      det = JSON.parse(String(logVals[11] || '') || '{}');
    } catch (pe) {
      det = {};
    }
    var sr = Number(det.sheetRow);
    if (isFinite(sr) && sr >= 2) {
      var amtSigned =
        det.amountSigned !== undefined && det.amountSigned !== null && String(det.amountSigned) !== ''
          ? round2_(toNumber_(det.amountSigned))
          : null;
      var fp = {
        taxYear: Number(det.taxYear),
        charityName: String(logVals[5] || '').trim(),
        entryDate: activityLogEntryDateToYyyyMmDd_(logVals[2]),
        amountAbs: round2_(toNumber_(logVals[3])),
        amountSigned: amtSigned,
        comments: det.comments != null ? String(det.comments).trim() : '',
        paymentType: String(det.paymentType || logVals[6] || '').trim()
      };
      if (!isNaN(fp.taxYear)) {
        var u = tryDeleteDonationRowForActivityUndo_(ss, Math.floor(sr), fp);
        if (u.deleted) {
          activityUndo = 'donation_sheet_deleted';
        } else if (u.mismatch) {
          activityUndo = 'donation_skipped_mismatch';
        } else if (u.error) {
          activityUndo = 'donation_skipped_error';
          activityUndoDetail = u.error;
        } else if (u.skip) {
          activityUndo = 'donation_skipped_no_undo';
        }
      } else {
        activityUndo = 'donation_skipped_no_undo';
      }
    } else {
      activityUndo = 'donation_skipped_no_undo';
    }

    sh.deleteRow(row);
    return { ok: true, activityUndo: activityUndo, activityUndoDetail: activityUndoDetail };
  } catch (e) {
    return { ok: false, error: String(e.message || e) };
  }
}

/**
 * Maps normalized payee → INPUT - Debts Type and INPUT - Bills Category for Activity "Kind" column.
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss
 * @returns {{ debtByNorm: Object<string, string>, billCatByNorm: Object<string, string> }}
 */
function buildActivityKindLookup_(ss) {
  var debtByNorm = {};
  var billCatByNorm = {};
  try {
    var debtSheet = getSheet_(ss, 'DEBTS');
    var d = debtSheet.getDataRange().getDisplayValues();
    var dh = d[0] || [];
    var nameCol = dh.indexOf('Account Name');
    var typeCol = dh.indexOf('Type');
    if (nameCol !== -1 && typeCol !== -1) {
      for (var r = 1; r < d.length; r++) {
        var n = String(d[r][nameCol] || '').trim();
        if (!n) continue;
        var nk = normalizeBillName_(n);
        if (nk) debtByNorm[nk] = String(d[r][typeCol] || '').trim();
      }
    }
  } catch (e) {
    Logger.log('buildActivityKindLookup_ debts: ' + e);
  }
  try {
    var billSheet = getSheet_(ss, 'BILLS');
    var b = billSheet.getDataRange().getDisplayValues();
    var bh = b[0] || [];
    var pCol = bh.indexOf('Payee');
    var cCol = bh.indexOf('Category');
    if (pCol !== -1 && cCol !== -1) {
      for (var r2 = 1; r2 < b.length; r2++) {
        var p = String(b[r2][pCol] || '').trim();
        if (!p) continue;
        var pk = normalizeBillName_(p);
        if (pk) billCatByNorm[pk] = String(b[r2][cCol] || '').trim();
      }
    }
  } catch (e2) {
    Logger.log('buildActivityKindLookup_ bills: ' + e2);
  }
  return { debtByNorm: debtByNorm, billCatByNorm: billCatByNorm };
}

/**
 * Stored Type on HOUSES sheets uses value "Tax" while the UI label is "Property Tax".
 * @param {string} logCategory Category column from LOG - Activity (House Expenses form Type).
 * @returns {string}
 */
function formatHouseExpenseTypeForActivityKind_(logCategory) {
  var c = String(logCategory || '').trim();
  if (!c) return '';
  if (c === 'Tax') return 'Property Tax';
  return c;
}

/**
 * Human-readable kind: Loan, Bill, HOA, Tuition, Income, house expense types (Repair, Utilities, …), Other.
 * Uses INPUT - Debts / INPUT - Bills when payee matches; keyword overrides for HOA/Tuition.
 */
function classifyActivityKind_(lookup, payee, eventType, direction, logCategory) {
  var pay = String(payee || '').trim();
  var cat = String(logCategory || '').trim();
  var etEarly = String(eventType || '').toLowerCase();
  if (etEarly === 'house_expense') {
    var houseType = formatHouseExpenseTypeForActivityKind_(cat);
    if (houseType) return houseType;
    return 'House Expenses';
  }
  if (etEarly === 'donation') return 'Donation';
  if (etEarly.indexOf('upcoming_') === 0) return 'Upcoming';
  if (etEarly === 'bank_account_add') return 'Bank';
  if (etEarly === 'bank_account_deactivate') return 'Bank';
  if (etEarly === 'bill_add') return 'Bill';
  if (etEarly === 'bill_deactivate') return 'Bill';
  if (etEarly === 'house_add') return 'House Expenses';
  if (etEarly === 'house_deactivate') return 'House Expenses';
  if (etEarly === 'investment_add') return 'Investment';
  if (etEarly === 'investment_deactivate') return 'Investment';
  if (etEarly === 'debt_add') return 'Debt';
  if (etEarly === 'debt_deactivate') return 'Debt';
  // income_add / income_deactivate are the canonical event names after
  // the refactor that made INPUT - Cash Flow <year> the source of truth
  // for income. Legacy rows written by the old INPUT - Income Sources
  // architecture (income_source_add / income_source_deactivate) still
  // need a clean label so historical activity stays readable.
  if (etEarly === 'income_add') return 'Income';
  if (etEarly === 'income_deactivate') return 'Income';
  if (etEarly === 'income_source_add') return 'Income';
  if (etEarly === 'income_source_deactivate') return 'Income';

  var combined = pay + ' ' + cat;
  var blob = combined.toLowerCase();

  if (/\bhoa\b|hoa\s|^hoa|association/i.test(combined)) return 'HOA';
  if (/tuition/i.test(blob)) return 'Tuition';

  var norm = normalizeBillName_(pay);
  var dt =
    norm && lookup.debtByNorm[norm] ? String(lookup.debtByNorm[norm]).trim().toLowerCase() : '';
  if (dt) {
    if (dt === 'loan' || dt === 'heloc') return 'Loan';
    if (dt.indexOf('credit') !== -1) return 'Bill';
    return dt.charAt(0).toUpperCase() + dt.slice(1);
  }

  var billCat = norm && lookup.billCatByNorm[norm] ? String(lookup.billCatByNorm[norm]) : '';
  if (billCat) {
    if (/hoa/i.test(billCat)) return 'HOA';
    if (/tuition/i.test(billCat)) return 'Tuition';
  }

  var et = String(eventType || '').toLowerCase();
  var dir = String(direction || '').toLowerCase();
  if (et === 'quick_pay' && dir === 'income') return 'Income';
  if (et === 'quick_pay' && dir === 'expense') return 'Bill';
  if (et === 'bill_skip' || et === 'bill_autopay') return 'Bill';
  return 'Other';
}

/**
 * Display-only per-event label surfaced next to the broad "Type" pill so
 * users can tell similar kinds apart at a glance (e.g. "Bill" covers both
 * bill_add and bill_deactivate — but the row should still read "Bill added"
 * vs "Tracking stopped").
 *
 * Returning '' means "no secondary label"; the pill alone is enough.
 *
 * Importantly, this does NOT replace `kindLabel` — the Type filter dropdown
 * and sort still operate on the broad kindLabel, so filtering by "Bill"
 * keeps surfacing every bill lifecycle event as it did before.
 *
 * The optional `detailsJson` second arg lets a handful of events enrich
 * their label from existing details (e.g. upcoming_payment shows the paid
 * amount and remaining balance). We deliberately do NOT change the Amount
 * column rendering or add new fields — this is label-clarity only.
 */
function activityLogActionLabel_(eventType, detailsJson) {
  var et = String(eventType || '').trim().toLowerCase();
  switch (et) {
    case 'bill_add': return 'Bill added';
    case 'bill_deactivate': return 'Tracking stopped';
    case 'bill_skip': return 'Bill skipped';
    case 'bill_autopay': return 'Bill autopay';
    case 'bank_account_add': return 'Account added';
    case 'bank_account_deactivate': return 'Tracking stopped';
    case 'house_add': return 'House added';
    case 'house_deactivate': return 'Tracking stopped';
    case 'investment_add': return 'Account added';
    case 'investment_deactivate': return 'Tracking stopped';
    case 'debt_add': return 'Account added';
    case 'debt_deactivate': return 'Tracking stopped';
    case 'income_add': return 'Income source added';
    case 'income_deactivate': return 'Tracking stopped';
    // Legacy rows from the old INPUT - Income Sources architecture.
    case 'income_source_add': return 'Income source added';
    case 'income_source_deactivate': return 'Tracking stopped';
    case 'upcoming_add': return 'Upcoming added';
    // upcoming_status is now only written by dismissUpcomingExpense() — the
    // previous Planned/Paid/Skipped status toggle is gone. Keep the label
    // tight so legacy rows and new Dismiss events both read cleanly.
    case 'upcoming_status': return 'Dismissed';
    // upcoming_payment is the non-monetary lifecycle event paired with a
    // quick_pay money movement. Amount stays "—" (the dollars are on the
    // quick_pay row) but we surface paid + remaining context in the label
    // so the Activity list doesn't just read "Payment applied" with no
    // numbers next to it. Falls back to the plain label for legacy rows
    // that predate the detail fields.
    case 'upcoming_payment':
      return upcomingPaymentActionLabel_(detailsJson);
    // Legacy: upcoming_cashflow is no longer emitted (direct "Add to Cash
    // Flow" path removed), but historical rows still need a readable label.
    case 'upcoming_cashflow': return 'Pushed to cash flow';
    default: return '';
  }
}

/**
 * Build the upcoming_payment action label from the row's details JSON.
 * Uses paidAmount + remainingAfter + fullyPaid that are already written
 * by appendUpcomingActivityPayment_ — no schema changes.
 *
 *   "Applied $500.00 (Remaining $250.00)"   — partial payment
 *   "Applied $500.00 (Fully paid)"          — terminal payment
 *   "Applied $500.00"                       — amount only (missing remaining)
 *   "Payment applied"                       — legacy row with no details
 */
function upcomingPaymentActionLabel_(detailsJson) {
  var fallback = 'Payment applied';
  var raw = String(detailsJson || '').trim();
  if (!raw) return fallback;

  var d;
  try {
    d = JSON.parse(raw);
  } catch (e) {
    return fallback;
  }
  if (!d || typeof d !== 'object') return fallback;

  var paid = activityLogAsFiniteNumber_(d.paidAmount);
  if (paid === null || paid <= 0) return fallback;

  var label = 'Applied ' + activityLogFmtMoney_(paid);
  var fullyPaid = d.fullyPaid === true;
  var remaining = activityLogAsFiniteNumber_(d.remainingAfter);

  if (fullyPaid) {
    label += ' (Fully paid)';
  } else if (remaining !== null && remaining >= 0) {
    label += ' (Remaining ' + activityLogFmtMoney_(remaining) + ')';
  }

  return label;
}

function activityLogAsFiniteNumber_(v) {
  if (v === null || v === undefined || v === '') return null;
  var n = Number(v);
  return isFinite(n) ? n : null;
}

function activityLogFmtMoney_(n) {
  var v = Number(n) || 0;
  var sign = v < 0 ? '-' : '';
  var abs = Math.abs(v).toFixed(2);
  // Thin thousands-separator formatter so we don't depend on Utilities/Intl
  // in this server-side path.
  var parts = abs.split('.');
  var whole = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return sign + '$' + whole + '.' + parts[1];
}

/**
 * Event types that represent lifecycle/metadata actions rather than a money
 * movement. Activity UI renders these rows with a blank amount ("—") so we
 * don't show a misleading $0.00.
 */
function activityLogIsNonMonetaryEvent_(eventType) {
  var et = String(eventType || '').trim().toLowerCase();
  // upcoming_status is the Dismiss lifecycle event (Paid transitions now
  // flow through upcoming_payment instead). upcoming_payment is the
  // non-monetary partner of a quick_pay money-movement row — rendering
  // both as "—" prevents double-counting the payment dollars.
  return (
    et === 'bill_deactivate' ||
    et === 'bank_account_deactivate' ||
    et === 'house_deactivate' ||
    et === 'investment_deactivate' ||
    et === 'debt_deactivate' ||
    et === 'income_deactivate' ||
    et === 'income_source_deactivate' ||
    et === 'upcoming_status' ||
    et === 'upcoming_payment'
  );
}

function parseOptionalAmountFilter_(raw) {
  var s = String(raw || '').trim();
  if (!s) return null;
  var n = round2_(toNumber_(s));
  if (isNaN(n)) return null;
  return n;
}

function activityLogLoggedDatePart_(loggedAtStr) {
  var s = String(loggedAtStr || '').trim();
  var m = /^(\d{4}-\d{2}-\d{2})/.exec(s);
  return m ? m[1] : '';
}

function activityLogRowKind_(lookup, r) {
  var payee = String(r[5] || '').trim();
  return classifyActivityKind_(
    lookup,
    payee,
    String(r[1] || '').trim(),
    String(r[4] || '').trim(),
    String(r[6] || '').trim()
  );
}

function activityLogDistinctKindsFromValues_(values, lookup) {
  var seen = {};
  for (var i = 0; i < values.length; i++) {
    var r = values[i];
    if (!String(r[0] || '').trim() && !String(r[1] || '').trim()) continue;
    var k = activityLogRowKind_(lookup, r);
    if (k) seen[k] = true;
  }
  return Object.keys(seen).sort(function(a, b) {
    return a.localeCompare(b);
  });
}

function activityLogRowMatchesDashboardFilters_(r, dateFrom, dateTo, payeeSearch, minNum, maxNum, kindType, lookup) {
  var loggedAt = String(r[0] || '').trim();
  if (!loggedAt && !String(r[1] || '').trim()) return false;
  var ld = activityLogLoggedDatePart_(loggedAt);
  if (dateFrom && ld && ld < dateFrom) return false;
  if (dateTo && ld && ld > dateTo) return false;
  var payee = String(r[5] || '').trim();
  if (payeeSearch && payee.toLowerCase().indexOf(payeeSearch) === -1) return false;
  var amtVal = round2_(toNumber_(r[3]));
  if (minNum !== null && amtVal < minNum) return false;
  if (maxNum !== null && amtVal > maxNum) return false;
  if (kindType) {
    if (activityLogRowKind_(lookup, r) !== kindType) return false;
  }
  return true;
}

/**
 * Activity tab: filtered rows (newest first, capped) plus distinct Type labels from the whole log.
 * @param {{ dateFrom?: string, dateTo?: string, payeeSearch?: string, kindType?: string, amountMin?: string|number, amountMax?: string|number, matchLimit?: number }} filters
 */
function getActivityDashboardData(filters) {
  filters = filters || {};
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName(ACTIVITY_LOG_SHEET_NAME);
    if (!sh || sh.getLastRow() < 2) {
      return {
        ok: true,
        rows: [],
        kinds: [],
        scannedRows: 0,
        truncated: false,
        message: 'No activity recorded yet.'
      };
    }

    var values = sh.getRange(2, 1, sh.getLastRow(), ACTIVITY_LOG_HEADERS.length).getDisplayValues();
    var lookup = buildActivityKindLookup_(ss);
    var kinds = activityLogDistinctKindsFromValues_(values, lookup);

    var dateFrom = String(filters.dateFrom || '').trim();
    var dateTo = String(filters.dateTo || '').trim();
    var payeeSearch = String(filters.payeeSearch || '').trim().toLowerCase();
    var minNum = parseOptionalAmountFilter_(filters.amountMin);
    var maxNum = parseOptionalAmountFilter_(filters.amountMax);
    var kindType = String(filters.kindType || '').trim();
    var matchLimit = Math.min(2000, Math.max(1, Number(filters.matchLimit) || 500));

    var out = [];
    var i;
    for (i = values.length - 1; i >= 0 && out.length < matchLimit; i--) {
      var r = values[i];
      if (!activityLogRowMatchesDashboardFilters_(r, dateFrom, dateTo, payeeSearch, minNum, maxNum, kindType, lookup)) {
        continue;
      }

      var payee = String(r[5] || '').trim();
      var eventType = String(r[1] || '').trim();
      var direction = String(r[4] || '').trim();
      var logCategory = String(r[6] || '').trim();
      var amtVal = round2_(toNumber_(r[3]));

      out.push({
        sheetRow: i + 2,
        loggedAt: String(r[0] || '').trim(),
        eventType: eventType,
        entryDate: String(r[2] || '').trim(),
        amount: r[3],
        amountNum: amtVal,
        direction: direction,
        payee: payee,
        category: logCategory,
        accountSource: String(r[7] || '').trim(),
        cashFlowSheet: String(r[8] || '').trim(),
        cashFlowMonth: String(r[9] || '').trim(),
        dedupeKey: String(r[10] || '').trim(),
        details: String(r[11] || '').trim(),
        kindLabel: activityLogRowKind_(lookup, r),
        actionLabel: activityLogActionLabel_(eventType, String(r[11] || '').trim()),
        isNonMonetary: activityLogIsNonMonetaryEvent_(eventType)
      });
    }

    var truncated = false;
    if (out.length >= matchLimit && i >= 0) {
      for (var j = i; j >= 0; j--) {
        if (
          activityLogRowMatchesDashboardFilters_(values[j], dateFrom, dateTo, payeeSearch, minNum, maxNum, kindType, lookup)
        ) {
          truncated = true;
          break;
        }
      }
    }

    return {
      ok: true,
      rows: out,
      kinds: kinds,
      scannedRows: values.length,
      truncated: truncated,
      matchLimit: matchLimit
    };
  } catch (e) {
    return { ok: false, error: String(e.message || e), rows: [], kinds: [], truncated: false };
  }
}

/**
 * Read LOG - Activity for the web dashboard (rows only; use getActivityDashboardData for kinds + Type filter).
 * @param {{ dateFrom?: string, dateTo?: string, payeeSearch?: string, kindType?: string, amountMin?: string|number, amountMax?: string|number, limit?: number, matchLimit?: number }} filters
 */
function getActivityLogForDashboard(filters) {
  var f = filters || {};
  var res = getActivityDashboardData({
    dateFrom: f.dateFrom,
    dateTo: f.dateTo,
    payeeSearch: f.payeeSearch,
    kindType: f.kindType,
    amountMin: f.amountMin,
    amountMax: f.amountMax,
    matchLimit: f.matchLimit != null ? f.matchLimit : f.limit
  });
  if (!res.ok) {
    return { ok: false, error: res.error, rows: [] };
  }
  return {
    ok: true,
    rows: res.rows,
    scannedRows: res.scannedRows,
    message: res.message,
    truncated: res.truncated,
    matchLimit: res.matchLimit
  };
}
