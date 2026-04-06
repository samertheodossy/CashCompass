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
 * Human-readable kind: Loan, Bill, HOA, Tuition, Income, Other.
 * Uses INPUT - Debts / INPUT - Bills when payee matches; keyword overrides for HOA/Tuition.
 */
function classifyActivityKind_(lookup, payee, eventType, direction, logCategory) {
  var pay = String(payee || '').trim();
  var cat = String(logCategory || '').trim();
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

function parseOptionalAmountFilter_(raw) {
  var s = String(raw || '').trim();
  if (!s) return null;
  var n = round2_(toNumber_(s));
  if (isNaN(n)) return null;
  return n;
}

/**
 * Read LOG - Activity for the web dashboard. Filters: **Logged At** date, payee substring, optional amount min/max.
 * @param {{ dateFrom?: string, dateTo?: string, payeeSearch?: string, amountMin?: string|number, amountMax?: string|number, limit?: number }} filters
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
    var payeeSearch = String(filters.payeeSearch || '').trim().toLowerCase();
    var minNum = parseOptionalAmountFilter_(filters.amountMin);
    var maxNum = parseOptionalAmountFilter_(filters.amountMax);

    var limit = Math.min(2000, Math.max(1, Number(filters.limit) || 500));

    var lookup = buildActivityKindLookup_(ss);

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

      var payee = String(r[5] || '').trim();
      if (payeeSearch && payee.toLowerCase().indexOf(payeeSearch) === -1) continue;

      var amtVal = round2_(toNumber_(r[3]));
      if (minNum !== null && amtVal < minNum) continue;
      if (maxNum !== null && amtVal > maxNum) continue;

      var eventType = String(r[1] || '').trim();
      var direction = String(r[4] || '').trim();
      var logCategory = String(r[6] || '').trim();

      out.push({
        loggedAt: loggedAt,
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
        kindLabel: classifyActivityKind_(lookup, payee, eventType, direction, logCategory)
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
