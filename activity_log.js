/**
 * Append-only activity ledger: discrete user/script actions (Quick Pay, bill skip, bill autopay, …).
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
    if (sh.getLastRow() === 0 || String(sh.getRange(1, 1).getValue() || '').trim() === '') {
      sh.getRange(1, 1, 1, ACTIVITY_LOG_HEADERS.length).setValues([ACTIVITY_LOG_HEADERS]);
      sh.setFrozenRows(1);
    }
    return sh;
  }
  sh = ss.insertSheet(ACTIVITY_LOG_SHEET_NAME);
  sh.getRange(1, 1, 1, ACTIVITY_LOG_HEADERS.length).setValues([ACTIVITY_LOG_HEADERS]);
  sh.setFrozenRows(1);
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
  var values = sh.getRange(2, ACTIVITY_LOG_DEDUPE_COL, lastRow, ACTIVITY_LOG_DEDUPE_COL).getValues();
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
 * Read LOG - Activity for the web dashboard (newest first). Filters apply to **Logged At** date.
 * @param {{ dateFrom?: string, dateTo?: string, eventType?: string, payeeSearch?: string, limit?: number }} filters
 * @returns {{ ok: boolean, rows?: Array<Object>, scannedRows?: number, message?: string, error?: string }}
 */
function getActivityLogForDashboard(filters) {
  filters = filters || {};
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName(ACTIVITY_LOG_SHEET_NAME);
    if (!sh || sh.getLastRow() < 2) {
      return { ok: true, rows: [], scannedRows: 0, message: 'No rows in LOG - Activity yet.' };
    }

    var lastRow = sh.getLastRow();
    var numCols = ACTIVITY_LOG_HEADERS.length;
    var values = sh.getRange(2, 1, lastRow, numCols).getDisplayValues();

    var dateFrom = String(filters.dateFrom || '').trim();
    var dateTo = String(filters.dateTo || '').trim();
    var eventFilter = String(filters.eventType || '').trim().toLowerCase();
    var payeeSearch = String(filters.payeeSearch || '').trim().toLowerCase();
    var limit = Math.min(500, Math.max(1, Number(filters.limit) || 250));

    function logDatePart_(loggedAtStr) {
      var s = String(loggedAtStr || '').trim();
      if (!s) return '';
      var m = /^(\d{4}-\d{2}-\d{2})/.exec(s);
      return m ? m[1] : '';
    }

    var out = [];
    for (var i = values.length - 1; i >= 0 && out.length < limit; i--) {
      var r = values[i];
      var loggedAt = String(r[0] || '').trim();
      if (!loggedAt && !String(r[1] || '').trim()) continue;

      var ld = logDatePart_(loggedAt);
      if (dateFrom && ld && ld < dateFrom) continue;
      if (dateTo && ld && ld > dateTo) continue;

      var et = String(r[1] || '').trim().toLowerCase();
      if (eventFilter && eventFilter !== 'all' && et !== eventFilter) continue;

      var payee = String(r[5] || '').trim();
      if (payeeSearch && payee.toLowerCase().indexOf(payeeSearch) === -1) continue;

      out.push({
        loggedAt: loggedAt,
        eventType: String(r[1] || '').trim(),
        entryDate: String(r[2] || '').trim(),
        amount: r[3],
        direction: String(r[4] || '').trim(),
        payee: payee,
        category: String(r[6] || '').trim(),
        accountSource: String(r[7] || '').trim(),
        cashFlowSheet: String(r[8] || '').trim(),
        cashFlowMonth: String(r[9] || '').trim(),
        dedupeKey: String(r[10] || '').trim(),
        details: String(r[11] || '').trim()
      });
    }

    return {
      ok: true,
      rows: out,
      scannedRows: values.length
    };
  } catch (e) {
    return { ok: false, error: String(e.message || e), rows: [] };
  }
}
