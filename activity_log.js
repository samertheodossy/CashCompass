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
