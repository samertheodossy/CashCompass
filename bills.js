/**
 * Bills input — v1 Add + lifecycle (Stop tracking).
 *
 * Canonical home for "add a new recurring bill" and "stop tracking a bill"
 * from the dashboard. Writes stay confined to INPUT - Bills; we never delete
 * rows (Stop tracking only flips Active=No) so the sheet remains a full,
 * auditable history of every bill the user has ever tracked.
 *
 * v1 scope (per ONBOARDING_AND_INPUT_STRATEGY.md):
 *   - Add
 *   - Stop tracking (soft delete via Active=No)
 *   - Edit (in-place field updates on the selected active row;
 *     never moves the row, never touches Cash Flow rows generated
 *     at Add time)
 *   - Distinct-category suggestions for the Add form
 *
 * Explicitly out of scope for v1:
 *   - Hard delete
 *   - Onboarding / Overview integration
 *   - Cash Flow auto-row creation
 *   - Alias mapping repair
 *   - Re-sorting INPUT - Bills on Due Day edit (Manage table sorts
 *     client-side; sheet stays in place until the next Add)
 */

var BILLS_SUPPORTED_FREQUENCY_LABELS_ = {
  monthly: 'Monthly',
  biweekly: 'Biweekly',
  weekly: 'Weekly',
  bimonthly: 'Bimonthly',
  quarterly: 'Quarterly',
  semi_annually: 'Semi-annually',
  yearly: 'Yearly'
};

/**
 * Accept only frequency inputs that map unambiguously to a supported value.
 * `normalizeFrequency_` defaults unknown input to 'monthly', so we can't rely
 * on it alone — we cross-check against this allow-list of accepted raw forms.
 */
var BILLS_ACCEPTED_FREQUENCY_RAW_ = {
  monthly: true,
  biweekly: true,
  weekly: true,
  bimonthly: true,
  'bi-monthly': true,
  'bi monthly': true,
  quarterly: true,
  yearly: true,
  annual: true,
  annually: true,
  'semi annually': true,
  'semi-annually': true,
  semiannually: true,
  'semi annual': true,
  'semi-annual': true
};

/* -------------------------------------------------------------------------- */
/*  Add bill                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Append a new bill row to INPUT - Bills.
 *
 * @param {Object} payload
 *   Required:
 *     - payee          {string}  non-empty (max 200 chars)
 *     - dueDay         {number}  integer 1..31
 *     - frequency      {string}  one of the supported labels
 *     - paymentSource  {string}  'CASH' or 'CREDIT_CARD'
 *     - category       {string}  non-empty after trim (free-form; Other is
 *                                accepted via the UI's Other… input)
 *   Optional:
 *     - defaultAmount  {number|string} non-negative
 *     - notes          {string}
 *     - autopay        {string}  'Yes' | 'No' (default 'No')
 *     - varies         {string}  'Yes' | 'No' (default 'No')
 *     - active         {string}  'Yes' | 'No' (default 'Yes')
 *     - startMonth     {number}  integer 1..12 (default = current month)
 *
 * @returns {{ok:boolean, message:string, payee:string}}
 */
/**
 * Normalize a raw Weekday value to a canonical full-name label
 * ('Sunday'..'Saturday'), or '' when blank / unrecognized.
 *
 * The stored label is what parseBillWeekday_ (dashboard_data.js) reads back on
 * the recurrence path, and full names round-trip through that parser. A blank /
 * unrecognized value returns '' so the bill stays on legacy Due Day scheduling.
 * Phase 4 is UI data-binding only: this does not change recurrence generation —
 * it just canonicalizes what the Weekday cell stores so the engine sees a value
 * it already understands.
 *
 * @param {string} value
 * @returns {string} '' or one of 'Sunday'..'Saturday'
 */
function billsNormalizeWeekdayLabel_(value) {
  var v = String(value == null ? '' : value).trim().toLowerCase();
  if (!v) return '';
  var map = {
    'sunday': 'Sunday', 'sun': 'Sunday',
    'monday': 'Monday', 'mon': 'Monday',
    'tuesday': 'Tuesday', 'tue': 'Tuesday', 'tues': 'Tuesday',
    'wednesday': 'Wednesday', 'wed': 'Wednesday', 'weds': 'Wednesday',
    'thursday': 'Thursday', 'thu': 'Thursday', 'thur': 'Thursday', 'thurs': 'Thursday',
    'friday': 'Friday', 'fri': 'Friday',
    'saturday': 'Saturday', 'sat': 'Saturday'
  };
  return Object.prototype.hasOwnProperty.call(map, v) ? map[v] : '';
}

/**
 * Normalize a raw Anchor Date value to a canonical 'yyyy-MM-dd' string, or ''
 * when blank / unparseable. Accepts a Date, a 'yyyy-MM-dd' string, or common
 * date strings; anything else returns '' so the bill stays on legacy Due Day
 * scheduling. The stored string round-trips through the recurrence read path
 * (getInputBillsDueRows_ parses both Date cells and yyyy-MM-dd text). Phase 6B
 * is UI data-binding only — this does not change recurrence generation.
 *
 * @param {*} value
 * @returns {string} '' or 'yyyy-MM-dd'
 */
function billsNormalizeAnchorDateLabel_(value) {
  if (value instanceof Date) {
    if (isNaN(value.getTime())) return '';
    return billsFormatYmd_(value);
  }
  var s = String(value == null ? '' : value).trim();
  if (!s) return '';
  // Fast path: already yyyy-MM-dd. Build a local date to validate the calendar
  // day (rejects e.g. 2026-02-30) and re-emit canonically.
  var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) {
    var y = Number(m[1]), mo = Number(m[2]), da = Number(m[3]);
    var d0 = new Date(y, mo - 1, da);
    if (d0.getFullYear() === y && d0.getMonth() === (mo - 1) && d0.getDate() === da) {
      return billsFormatYmd_(d0);
    }
    return '';
  }
  var d = new Date(s);
  if (isNaN(d.getTime())) return '';
  return billsFormatYmd_(new Date(d.getFullYear(), d.getMonth(), d.getDate()));
}

/**
 * Format a Date as a local yyyy-MM-dd string (no timezone shift).
 * @param {Date} d
 * @returns {string}
 */
function billsFormatYmd_(d) {
  var y = d.getFullYear();
  var mo = ('0' + (d.getMonth() + 1)).slice(-2);
  var da = ('0' + d.getDate()).slice(-2);
  return y + '-' + mo + '-' + da;
}

/**
 * Weekday label ('Sunday'..'Saturday') -> JS day-of-week index (Sunday=0). Used
 * to validate that a Biweekly Anchor Date lands on the selected weekday.
 */
var BILLS_WEEKDAY_LABEL_INDEX_ = {
  'Sunday': 0, 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3,
  'Thursday': 4, 'Friday': 5, 'Saturday': 6
};

/**
 * Backend consistency check mirroring isAnchorDateValidForWeekday_
 * (dashboard_data.js): does the canonical Anchor Date fall on the given Weekday
 * label? Returns true only when BOTH are present and consistent. Blank values
 * pass (legacy behavior). Never corrects the date — callers reject on false.
 *
 * @param {string} anchorYmd    canonical 'yyyy-MM-dd' (billsNormalizeAnchorDateLabel_)
 * @param {string} weekdayLabel canonical weekday (billsNormalizeWeekdayLabel_)
 * @returns {boolean}
 */
function billsAnchorMatchesWeekday_(anchorYmd, weekdayLabel) {
  var idx = BILLS_WEEKDAY_LABEL_INDEX_[String(weekdayLabel || '').trim()];
  if (typeof idx !== 'number') return true;
  var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(anchorYmd || '').trim());
  if (!m) return true;
  var d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (isNaN(d.getTime())) return true;
  return d.getDay() === idx;
}

function addBillFromDashboard(payload) {
  // Category is also required — enforced below with a user-friendly
  // "Category is required." message rather than the generic
  // "Missing required field: category." from validateRequired_.
  validateRequired_(payload, ['payee', 'dueDay', 'frequency', 'paymentSource']);

  var payee = String(payload.payee || '').trim();
  if (!payee) throw new Error('Payee is required.');
  if (payee.length > 200) throw new Error('Payee is too long (max 200 characters).');

  var dueDayNum = Math.round(Number(payload.dueDay));
  if (!isFinite(dueDayNum) || dueDayNum < 1 || dueDayNum > 31) {
    throw new Error('Due Day must be an integer from 1 to 31.');
  }

  var frequencyRaw = String(payload.frequency || '').trim();
  var frequencyLower = frequencyRaw.toLowerCase().replace(/\s+/g, ' ');
  if (!BILLS_ACCEPTED_FREQUENCY_RAW_[frequencyLower]) {
    throw new Error(
      'Frequency must be Monthly, Biweekly, Weekly, Bimonthly, Quarterly, ' +
      'Semi-annually, or Yearly.'
    );
  }
  var frequencyNormalized = normalizeFrequency_(frequencyRaw);
  var frequencyLabel = BILLS_SUPPORTED_FREQUENCY_LABELS_[frequencyNormalized];
  if (!frequencyLabel) {
    throw new Error('Frequency is not supported.');
  }

  var paymentSourceNorm = String(payload.paymentSource || '')
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_');
  if (paymentSourceNorm !== 'CASH' && paymentSourceNorm !== 'CREDIT_CARD') {
    throw new Error('Payment Source must be CASH or CREDIT_CARD.');
  }

  // Category is required. v1 deliberately keeps this as free-form text
  // (including "Other…" entries from the UI) rather than enforcing a
  // strict allow-list — we only guarantee that something non-empty is
  // present so reports and category suggestions are never blank.
  var category = String(payload.category || '').trim();
  if (!category) throw new Error('Category is required.');
  if (category.length > 200) category = category.slice(0, 200);

  var notes = String(payload.notes || '').trim();
  if (notes.length > 500) notes = notes.slice(0, 500);

  var defaultAmount = 0;
  var defaultAmountRaw = payload.defaultAmount;
  var hasAmount =
    defaultAmountRaw !== undefined &&
    defaultAmountRaw !== null &&
    String(defaultAmountRaw).trim() !== '';
  if (hasAmount) {
    var parsed = toNumber_(defaultAmountRaw);
    if (!isFinite(parsed)) {
      throw new Error('Default Amount must be a valid number.');
    }
    defaultAmount = round2_(Math.abs(parsed));
  }

  var autopayLabel = billsNormalizeYesNoLabel_(payload.autopay, 'No');
  var variesLabel = billsNormalizeYesNoLabel_(payload.varies, 'No');
  var activeLabel = billsNormalizeYesNoLabel_(payload.active, 'Yes');

  // Phase 4 / 6B: Weekday is meaningful for Weekly and Biweekly bills. For every
  // other frequency we persist '' so a bill that switches away never carries a
  // stale weekday. Blank keeps the bill on legacy Due Day scheduling.
  var weekdayLabel = (frequencyNormalized === 'weekly' || frequencyNormalized === 'biweekly')
    ? billsNormalizeWeekdayLabel_(payload.weekday)
    : '';

  // Phase 6B: Anchor Date is only meaningful for Biweekly bills; '' otherwise.
  var anchorLabel = (frequencyNormalized === 'biweekly')
    ? billsNormalizeAnchorDateLabel_(payload.anchorDate)
    : '';

  // Phase 6B: reject an inconsistent Biweekly Weekday + Anchor Date rather than
  // silently correcting it (mirrors isAnchorDateValidForWeekday_ on the engine).
  if (frequencyNormalized === 'biweekly' && weekdayLabel && anchorLabel &&
      !billsAnchorMatchesWeekday_(anchorLabel, weekdayLabel)) {
    throw new Error('Anchor Date must fall on the selected weekday.');
  }

  var nowMonth = new Date().getMonth() + 1;
  var startMonth = nowMonth;
  if (
    payload.startMonth !== undefined &&
    payload.startMonth !== null &&
    String(payload.startMonth).trim() !== ''
  ) {
    var startNum = Math.round(Number(payload.startMonth));
    if (!isFinite(startNum) || startNum < 1 || startNum > 12) {
      throw new Error('Start Month must be an integer from 1 to 12.');
    }
    startMonth = startNum;
  }

  // Ensure-before-write guard. Idempotent no-op on populated workbooks;
  // on fresh workbooks it seeds the canonical INPUT - Bills structure
  // the header read a few lines below expects. Mirrors the Bank Accounts
  // pattern in addBankAccountFromDashboard → bank_accounts.js.
  try {
    ensureOnboardingBillsSheetFromDashboard('normal');
  } catch (ensureErr) {
    throw new Error(
      "Couldn't prepare bills: " +
      (ensureErr && ensureErr.message ? ensureErr.message : ensureErr)
    );
  }
  try { SpreadsheetApp.flush(); } catch (_flushErr) { /* best-effort */ }

  var ss = getUserSpreadsheet_();
  var sheet = getSheet_(ss, 'BILLS');

  var headerDisplay = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0] || [];
  if (!headerDisplay || !headerDisplay.length) {
    throw new Error('Bills sheet has no header row.');
  }

  // Case-insensitive header map. Real-world INPUT - Bills sheets are sometimes
  // shipped with ALL-CAPS headers (e.g. "PAYMENT SOURCE" instead of
  // "Payment Source"), which a naive `indexOf('Payment Source')` would miss
  // and silently drop the value on write. Normalize once here and use
  // `headerIndex_` for every lookup so every casing lands on the same column.
  var headerMap = {};
  for (var i = 0; i < headerDisplay.length; i++) {
    var label = String(headerDisplay[i] || '').trim();
    if (label) headerMap[label.toLowerCase()] = i;
  }
  function headerIndex_(name) {
    var key = String(name || '').trim().toLowerCase();
    return Object.prototype.hasOwnProperty.call(headerMap, key) ? headerMap[key] : -1;
  }

  // The bill reader (getInputBillsDueRows_) requires these four; enforce the
  // same contract here so a mis-templated workbook fails at write-time rather
  // than at read-time.
  var requiredHeaders = ['Payee', 'Due Day', 'Default Amount', 'Active'];
  for (var h = 0; h < requiredHeaders.length; h++) {
    if (headerIndex_(requiredHeaders[h]) === -1) {
      throw new Error('Bills sheet is missing required header: ' + requiredHeaders[h] + '.');
    }
  }

  // Self-heal optional columns introduced in later phases. Older workbooks can
  // be missing these headers, which would cause the writes below to silently
  // drop the values — and in the Payment Source case that leaves freshly-paid
  // bills with a blank Flow Source on the Cash Flow row. The append-only heal
  // logic now lives in the shared ensureBillsSheetSchema_ helper (same headers,
  // anchors, and insert strategy as before) so every Bills entry point can
  // converge an older workbook, not just the add path.
  var headerChanged = ensureBillsSheetSchema_(sheet);

  if (headerChanged) {
    headerDisplay = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0] || [];
    headerMap = {};
    for (var i2 = 0; i2 < headerDisplay.length; i2++) {
      var label2 = String(headerDisplay[i2] || '').trim();
      if (label2) headerMap[label2.toLowerCase()] = i2;
    }
  }

  var row = new Array(headerDisplay.length);
  for (var c = 0; c < row.length; c++) row[c] = '';

  function setIfPresent(headerLabel, value) {
    var idx = headerIndex_(headerLabel);
    if (idx !== -1) {
      row[idx] = value;
    }
  }

  setIfPresent('Payee', payee);
  setIfPresent('Category', category);
  setIfPresent('Due Day', dueDayNum);
  setIfPresent('Default Amount', defaultAmount);
  setIfPresent('Varies', variesLabel);
  setIfPresent('Autopay', autopayLabel);
  setIfPresent('Active', activeLabel);
  setIfPresent('Payment Source', paymentSourceNorm);
  setIfPresent('Frequency', frequencyLabel);
  setIfPresent('Start Month', startMonth);
  setIfPresent('Notes', notes);
  setIfPresent('Weekday', weekdayLabel);
  setIfPresent('Anchor Date', anchorLabel);

  // Sorted insert: place the new bill row above the first existing row whose
  // Due Day is strictly greater so INPUT - Bills stays ordered by due date,
  // matching how the Manage Bills table sorts on the dashboard. All other
  // code paths look up bills by Payee name (`findRowByName_`,
  // `getInputBillsDueRows_`, `lookupRowByName_` in cash flow), so shifting
  // rows around is safe — there are no row-number references to update.
  // Falls back to appendRow when the new bill belongs at the bottom (highest
  // Due Day, or the sheet has no data yet).
  var dueDayCol1Based = headerIndex_('Due Day') + 1;
  var sortedInsertRow = findBillsSortedInsertRow_(sheet, dueDayCol1Based, dueDayNum);

  var newRow;
  if (sortedInsertRow === -1) {
    var previousLastRow = sheet.getLastRow();
    sheet.appendRow(row);
    newRow = sheet.getLastRow();
    copyBillsRowFormattingFromPreviousRow_(sheet, newRow, previousLastRow);
  } else {
    // insertRowBefore creates a blank row at sortedInsertRow and shifts the
    // previous occupant down. We then write values directly and paint the
    // formatting from the closest visual sibling (see helper for choice).
    sheet.insertRowBefore(sortedInsertRow);
    newRow = sortedInsertRow;
    sheet.getRange(newRow, 1, 1, row.length).setValues([row]);
    copyBillsRowFormattingFromInsertSiblingRow_(sheet, newRow);
  }

  try {
    appendActivityLog_(ss, {
      eventType: 'bill_add',
      entryDate: Utilities.formatDate(
        stripTime_(new Date()),
        Session.getScriptTimeZone(),
        'yyyy-MM-dd'
      ),
      amount: defaultAmount,
      direction: 'expense',
      payee: payee,
      category: category,
      accountSource: paymentSourceNorm,
      cashFlowSheet: '',
      cashFlowMonth: '',
      dedupeKey: '',
      details: JSON.stringify({
        detailsVersion: 1,
        dueDay: dueDayNum,
        frequency: frequencyLabel,
        paymentSource: paymentSourceNorm,
        startMonth: startMonth,
        defaultAmount: defaultAmount,
        autopay: autopayLabel,
        varies: variesLabel,
        active: activeLabel,
        notes: notes
      })
    });
  } catch (logErr) {
    Logger.log('addBillFromDashboard activity log: ' + logErr);
  }

  // Seed a corresponding Expense row on the current year's INPUT - Cash Flow
  // tab so the new bill is immediately visible on Bills Due / Upcoming /
  // planner reads that match by Type=Expense + Payee. This mirrors the
  // canonical pattern in addDebtFromDashboard — without it a freshly-added
  // bill would be Active with a Due day but still not appear on the Bills
  // Due card until the user manually added a Cash Flow row.
  //
  // - Flow Source comes straight from the user-supplied Payment Source
  //   (CASH or CREDIT_CARD). This matches getInputBillsDueRows_'s
  //   Payment Source → Flow Source propagation on the read path.
  // - Idempotent: if an Expense row with the same Payee already exists on
  //   the current-year sheet (user pre-seeded it by hand, or deactivate
  //   + re-add), we leave it alone.
  // - First-run safety: ensureCashFlowYearSheet_ creates the current-year
  //   Cash Flow sheet on demand when the workbook is blank. No-op on
  //   populated workbooks.
  // - All failures here are non-fatal: the bill row itself is already
  //   written to INPUT - Bills and the user can always add the Cash Flow
  //   row manually.
  var cashFlowRowSeeded = false;
  var cashFlowSeedWarning = '';
  try {
    var currentYear = new Date().getFullYear();
    if (typeof ensureCashFlowYearSheet_ === 'function') {
      try { ensureCashFlowYearSheet_(currentYear); } catch (_ensureErr) { /* fall through */ }
    }
    var cfSheet = typeof tryGetCashFlowSheet_ === 'function'
      ? tryGetCashFlowSheet_(ss, currentYear)
      : null;
    if (!cfSheet) {
      cashFlowSeedWarning =
        'Cash Flow ' + currentYear + ' not found — skipped Cash Flow seed. Bills Due will pick the bill up once a Cash Flow ' + currentYear + ' exists and has an expense row for "' + payee + '".';
    } else {
      var existing = findCashFlowRowByTypeAndPayee_(cfSheet, 'Expense', payee);
      if (existing) {
        cashFlowSeedWarning =
          'An expense row for "' + payee + '" already exists on Cash Flow ' + currentYear + ' — left untouched.';
      } else {
        insertCashFlowRow_(cfSheet, 'Expense', payee, paymentSourceNorm);
        cashFlowRowSeeded = true;
      }
    }
  } catch (cfErr) {
    Logger.log('addBillFromDashboard cash flow seed: ' + cfErr);
    cashFlowSeedWarning =
      'Cash Flow seed skipped: ' + (cfErr && cfErr.message ? cfErr.message : String(cfErr));
  }

  touchDashboardSourceUpdated_('bills');

  var message = 'Bill added.';
  if (cashFlowRowSeeded) {
    message += ' Added a matching expense row to Cash Flow so Bills Due sees it right away.';
  } else if (cashFlowSeedWarning) {
    message += ' ' + cashFlowSeedWarning;
  }

  return {
    ok: true,
    message: message,
    payee: payee,
    cashFlowRowSeeded: cashFlowRowSeeded
  };
}

/* -------------------------------------------------------------------------- */
/*  Edit tracked bill (in-place update)                                       */
/* -------------------------------------------------------------------------- */

/**
 * In-place edit of a single active INPUT - Bills row. Mirrors the
 * Add bill validation contract so the same form HTML can drive both
 * code paths from the dashboard.
 *
 * Bounded scope (v1):
 *  - Updates ONLY the columns whose value actually changed.
 *  - Never moves the row (no re-sort by Due Day in this step — the
 *    Manage table already sorts client-side, so display order stays
 *    correct).
 *  - Never touches Active / Start Month (lifecycle is owned by Stop
 *    tracking; Start Month is a v1 add-only field).
 *  - Never touches Cash Flow rows generated at Add time, even on a
 *    Payee rename (existing history is left intact by design).
 *  - Refuses inactive bills — Stop tracking is the canonical
 *    lifecycle path; re-adding is the way to revive history.
 *  - No-op save (no field actually changed) returns
 *    { ok:true, message:'No changes.' } WITHOUT writing, logging, or
 *    touching dashboard freshness state.
 *
 * @param {Object} payload
 *   Required:
 *     - sheetRow       {number}  1-based row index in INPUT - Bills.
 *     - expectedPayee  {string}  current Payee on that row; used as a
 *                                stale-payload guard so a row-shift
 *                                between load and save cannot
 *                                clobber the wrong bill.
 *     - payee          {string}  new Payee value (may equal expected).
 *     - dueDay         {number}  integer 1..31.
 *     - frequency      {string}  one of the supported labels.
 *     - paymentSource  {string}  'CASH' or 'CREDIT_CARD'.
 *     - category       {string}  non-empty after trim.
 *   Optional (treated as "no change" if header missing):
 *     - defaultAmount  {number|string} non-negative; blank → 0.
 *     - notes          {string}  trimmed; ≤ 500 chars.
 *     - autopay        {string}  'Yes' | 'No' (default 'No').
 *     - varies         {string}  'Yes' | 'No' (default 'No').
 *
 * @returns {{ok:boolean, message:string, payee:string, changedFields:string[]}}
 */
function updateTrackedBillFromDashboard(payload) {
  validateRequired_(payload, [
    'sheetRow', 'expectedPayee', 'payee',
    'dueDay', 'frequency', 'paymentSource', 'category'
  ]);

  var targetRow = Math.round(Number(payload.sheetRow));
  if (!isFinite(targetRow) || targetRow < 2) {
    throw new Error('Invalid bill row reference.');
  }

  var expectedPayee = String(payload.expectedPayee || '').trim();
  if (!expectedPayee) throw new Error('Expected payee is required.');

  // ---- Validate new values using Add's rules (parity is intentional). ----

  var payee = String(payload.payee || '').trim();
  if (!payee) throw new Error('Payee is required.');
  if (payee.length > 200) throw new Error('Payee is too long (max 200 characters).');

  var dueDayNum = Math.round(Number(payload.dueDay));
  if (!isFinite(dueDayNum) || dueDayNum < 1 || dueDayNum > 31) {
    throw new Error('Due Day must be an integer from 1 to 31.');
  }

  var frequencyRaw = String(payload.frequency || '').trim();
  var frequencyLower = frequencyRaw.toLowerCase().replace(/\s+/g, ' ');
  if (!BILLS_ACCEPTED_FREQUENCY_RAW_[frequencyLower]) {
    throw new Error(
      'Frequency must be Monthly, Biweekly, Weekly, Bimonthly, Quarterly, ' +
      'Semi-annually, or Yearly.'
    );
  }
  var frequencyLabel = BILLS_SUPPORTED_FREQUENCY_LABELS_[normalizeFrequency_(frequencyRaw)];
  if (!frequencyLabel) {
    throw new Error('Frequency is not supported.');
  }

  var paymentSourceNorm = String(payload.paymentSource || '')
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_');
  if (paymentSourceNorm !== 'CASH' && paymentSourceNorm !== 'CREDIT_CARD') {
    throw new Error('Payment Source must be CASH or CREDIT_CARD.');
  }

  var category = String(payload.category || '').trim();
  if (!category) throw new Error('Category is required.');
  if (category.length > 200) category = category.slice(0, 200);

  var notes = String(payload.notes || '').trim();
  if (notes.length > 500) notes = notes.slice(0, 500);

  var defaultAmount = 0;
  var defaultAmountRaw = payload.defaultAmount;
  var hasAmount =
    defaultAmountRaw !== undefined &&
    defaultAmountRaw !== null &&
    String(defaultAmountRaw).trim() !== '';
  if (hasAmount) {
    var parsedAmount = toNumber_(defaultAmountRaw);
    if (!isFinite(parsedAmount)) {
      throw new Error('Default Amount must be a valid number.');
    }
    defaultAmount = round2_(Math.abs(parsedAmount));
  }

  var autopayLabel = billsNormalizeYesNoLabel_(payload.autopay, 'No');
  var variesLabel = billsNormalizeYesNoLabel_(payload.varies, 'No');

  // Phase 4 / 6B: Weekday is meaningful for Weekly and Biweekly bills. Switching
  // a bill to any other frequency clears any prior weekday (recordChange_ below
  // only writes when the value actually differs). Blank keeps legacy Due Day
  // scheduling. Purely data-binding — recurrence generation is unchanged.
  var frequencyNormalizedForSchedule = normalizeFrequency_(frequencyRaw);
  var weekdayLabel = (frequencyNormalizedForSchedule === 'weekly' || frequencyNormalizedForSchedule === 'biweekly')
    ? billsNormalizeWeekdayLabel_(payload.weekday)
    : '';

  // Phase 6B: Anchor Date is only meaningful for Biweekly bills; cleared when the
  // bill switches away from Biweekly (recordChange_ only writes on a real diff).
  var anchorLabel = (frequencyNormalizedForSchedule === 'biweekly')
    ? billsNormalizeAnchorDateLabel_(payload.anchorDate)
    : '';

  // Phase 6B: reject an inconsistent Biweekly Weekday + Anchor Date rather than
  // silently correcting it (mirrors isAnchorDateValidForWeekday_ on the engine).
  if (frequencyNormalizedForSchedule === 'biweekly' && weekdayLabel && anchorLabel &&
      !billsAnchorMatchesWeekday_(anchorLabel, weekdayLabel)) {
    throw new Error('Anchor Date must fall on the selected weekday.');
  }

  // ---- Open sheet + verify the row hasn't shifted under us. ----

  var ss = getUserSpreadsheet_();
  var sheet = getSheet_(ss, 'BILLS');

  if (targetRow > sheet.getLastRow()) {
    throw new Error('Bill row is out of range. The sheet may have been edited; please refresh.');
  }

  var lastCol = sheet.getLastColumn();
  var headerDisplay = sheet.getRange(1, 1, 1, lastCol).getDisplayValues()[0] || [];
  if (!headerDisplay || !headerDisplay.length) {
    throw new Error('Bills sheet has no header row.');
  }

  var headerMap = {};
  for (var i = 0; i < headerDisplay.length; i++) {
    var label = String(headerDisplay[i] || '').trim();
    if (label) headerMap[label.toLowerCase()] = i;
  }
  function headerIndex_(name) {
    var key = String(name || '').trim().toLowerCase();
    return Object.prototype.hasOwnProperty.call(headerMap, key) ? headerMap[key] : -1;
  }

  // Same contract Add enforces — Payee / Due Day / Default Amount / Active
  // are mandatory column anchors. We deliberately do NOT self-heal the
  // optional columns here (Add owns that responsibility on first write).
  // Optional columns that genuinely don't exist are treated as "no
  // change" so editing an old-template workbook still saves the
  // changes the user can actually see.
  var requiredHeaders = ['Payee', 'Due Day', 'Default Amount', 'Active'];
  for (var h = 0; h < requiredHeaders.length; h++) {
    if (headerIndex_(requiredHeaders[h]) === -1) {
      throw new Error('Bills sheet is missing required header: ' + requiredHeaders[h] + '.');
    }
  }

  // Read the row twice: raw (numbers stay numbers) for numeric
  // comparison + display (formatted) for the stale-payload check.
  var rowRaw = sheet.getRange(targetRow, 1, 1, lastCol).getValues()[0] || [];
  var rowDisplay = sheet.getRange(targetRow, 1, 1, lastCol).getDisplayValues()[0] || [];

  var actualPayee = String(rowDisplay[headerIndex_('Payee')] || '').trim();
  if (!actualPayee) {
    throw new Error('No bill found on the selected row; please refresh.');
  }
  if (actualPayee !== expectedPayee) {
    throw new Error(
      'Bill has moved on the sheet (expected "' + expectedPayee +
      '", found "' + actualPayee + '"). Please refresh and try again.'
    );
  }

  var activeIdx = headerIndex_('Active');
  var currentActive = activeIdx === -1 ? 'yes' : normalizeYesNo_(rowDisplay[activeIdx]);
  if (currentActive === 'no') {
    throw new Error('Bill is inactive. Use Add bill to re-add it.');
  }

  // ---- Build a per-field diff against the row's current sheet values. ----

  // Each entry is { field, header, kind, currentVal, newVal, currentDisplay, newDisplay }
  // - kind 'text'    → trimmed string equality.
  // - kind 'integer' → numeric equality after Math.round(Number()).
  // - kind 'currency'→ numeric equality after round2_(Math.abs(toNumber_())).
  // - kind 'yesno'   → normalized 'Yes'/'No' label equality.
  function readTextCell_(header) {
    var idx = headerIndex_(header);
    if (idx === -1) return null;
    return String(rowDisplay[idx] == null ? '' : rowDisplay[idx]).trim();
  }
  function readIntCell_(header) {
    var idx = headerIndex_(header);
    if (idx === -1) return null;
    var raw = rowRaw[idx];
    if (raw === '' || raw === null || raw === undefined) return null;
    var n = Number(raw);
    return isFinite(n) ? Math.round(n) : null;
  }
  function readCurrencyCell_(header) {
    var idx = headerIndex_(header);
    if (idx === -1) return null;
    var raw = rowRaw[idx];
    if (raw === '' || raw === null || raw === undefined) return 0;
    var n = toNumber_(raw);
    return isFinite(n) ? round2_(Math.abs(n)) : 0;
  }
  function readYesNoCell_(header, fallback) {
    var idx = headerIndex_(header);
    if (idx === -1) return null;
    return billsNormalizeYesNoLabel_(rowDisplay[idx], fallback || 'No');
  }

  var changedFields = [];
  var oldValues = {};
  var newValues = {};

  function recordChange_(field, header, newVal, currentDisplay, newDisplay) {
    var idx = headerIndex_(header);
    if (idx === -1) return; // optional column missing → silently skip.
    changedFields.push(field);
    oldValues[field] = currentDisplay;
    newValues[field] = newDisplay;
    sheet.getRange(targetRow, idx + 1).setValue(newVal);
  }

  // Payee
  if (payee !== actualPayee) {
    recordChange_('payee', 'Payee', payee, actualPayee, payee);
  }

  // Due Day (numeric)
  var currentDueDay = readIntCell_('Due Day');
  if (currentDueDay !== dueDayNum) {
    recordChange_(
      'dueDay', 'Due Day',
      dueDayNum,
      currentDueDay === null ? '' : String(currentDueDay),
      String(dueDayNum)
    );
  }

  // Frequency (text label)
  var currentFrequency = readTextCell_('Frequency');
  if (currentFrequency !== null && currentFrequency !== frequencyLabel) {
    recordChange_('frequency', 'Frequency', frequencyLabel, currentFrequency, frequencyLabel);
  }

  // Payment Source (text label, uppercased)
  var currentPaymentSource = readTextCell_('Payment Source');
  if (currentPaymentSource !== null && currentPaymentSource !== paymentSourceNorm) {
    recordChange_(
      'paymentSource', 'Payment Source',
      paymentSourceNorm, currentPaymentSource, paymentSourceNorm
    );
  }

  // Category (text)
  var currentCategory = readTextCell_('Category');
  if (currentCategory !== null && currentCategory !== category) {
    recordChange_('category', 'Category', category, currentCategory, category);
  }

  // Default Amount (currency)
  var currentDefaultAmount = readCurrencyCell_('Default Amount');
  if (currentDefaultAmount !== null && currentDefaultAmount !== defaultAmount) {
    recordChange_(
      'defaultAmount', 'Default Amount',
      defaultAmount,
      String(currentDefaultAmount.toFixed(2)),
      String(defaultAmount.toFixed(2))
    );
  }

  // Autopay (Yes/No)
  var currentAutopay = readYesNoCell_('Autopay', 'No');
  if (currentAutopay !== null && currentAutopay !== autopayLabel) {
    recordChange_('autopay', 'Autopay', autopayLabel, currentAutopay, autopayLabel);
  }

  // Varies (Yes/No)
  var currentVaries = readYesNoCell_('Varies', 'No');
  if (currentVaries !== null && currentVaries !== variesLabel) {
    recordChange_('varies', 'Varies', variesLabel, currentVaries, variesLabel);
  }

  // Notes (text)
  var currentNotes = readTextCell_('Notes');
  if (currentNotes !== null && currentNotes !== notes) {
    recordChange_('notes', 'Notes', notes, currentNotes, notes);
  }

  // Weekday (text label) — Phase 4. readTextCell_ returns null when the column
  // is absent (older workbook not yet self-healed), in which case recordChange_
  // silently skips, so editing an old-template bill still saves everything else.
  var currentWeekday = readTextCell_('Weekday');
  if (currentWeekday !== null && currentWeekday !== weekdayLabel) {
    recordChange_('weekday', 'Weekday', weekdayLabel, currentWeekday, weekdayLabel);
  }

  // Anchor Date (canonical yyyy-MM-dd text) — Phase 6B. readTextCell_ returns
  // null when the column is absent (older workbook not yet self-healed) so
  // recordChange_ skips and the rest of the edit still saves. Compared as the
  // canonical yyyy-MM-dd string so a Date cell vs. text cell never false-diffs.
  var currentAnchorRaw = readTextCell_('Anchor Date');
  if (currentAnchorRaw !== null) {
    var currentAnchor = billsNormalizeAnchorDateLabel_(currentAnchorRaw);
    if (currentAnchor !== anchorLabel) {
      recordChange_('anchorDate', 'Anchor Date', anchorLabel, currentAnchor, anchorLabel);
    }
  }

  // ---- No-op save → return cleanly, no write/log/dirty marker. ----

  if (!changedFields.length) {
    return {
      ok: true,
      message: 'No changes made',
      payee: actualPayee,
      changedFields: []
    };
  }

  // ---- Phase 5B: prospective schedule changes. ----
  // If any scheduling field actually changed (Frequency / Due Day / Weekday /
  // Anchor Date), stamp Schedule Effective Date = today (script tz) so
  // recurrence generation clamps occurrences to on/after this date — the change
  // affects only future occurrences. Historical Cash Flow / Activity Log /
  // markers are never rewritten. Written directly (not via recordChange_) so it
  // does not inflate the user-facing "fields updated" count; still surfaced in
  // the bill_update details for audit. Skipped when no scheduling field changed
  // or the column is absent (older workbook not yet self-healed) → in both cases
  // the effective date stays blank = legacy behavior.
  var SCHEDULING_FIELDS_ = { frequency: true, dueDay: true, weekday: true, anchorDate: true };
  var schedulingChanged = changedFields.some(function(f) {
    return Object.prototype.hasOwnProperty.call(SCHEDULING_FIELDS_, f);
  });
  var scheduleEffectiveDateWritten = '';
  if (schedulingChanged) {
    var schedEffIdx = headerIndex_('Schedule Effective Date');
    if (schedEffIdx !== -1) {
      scheduleEffectiveDateWritten = Utilities.formatDate(
        stripTime_(new Date()), Session.getScriptTimeZone(), 'yyyy-MM-dd'
      );
      sheet.getRange(targetRow, schedEffIdx + 1).setValue(scheduleEffectiveDateWritten);
    }
  }

  // ---- Activity log + dashboard freshness. ----

  try {
    appendActivityLog_(ss, {
      eventType: 'bill_update',
      entryDate: Utilities.formatDate(
        stripTime_(new Date()),
        Session.getScriptTimeZone(),
        'yyyy-MM-dd'
      ),
      amount: 0,
      direction: '',
      payee: payee, // new payee — keeps Activity readable on a Payee rename
      category: category,
      accountSource: paymentSourceNorm,
      cashFlowSheet: '',
      cashFlowMonth: '',
      dedupeKey: '',
      details: JSON.stringify({
        detailsVersion: 1,
        sheetRow: targetRow,
        payeeBefore: actualPayee,
        payeeAfter: payee,
        changedFields: changedFields,
        'old': oldValues,
        'new': newValues,
        // Phase 5B: present only when a scheduling change stamped a new floor.
        scheduleEffectiveDate: scheduleEffectiveDateWritten
      })
    });
  } catch (logErr) {
    Logger.log('updateTrackedBillFromDashboard activity log: ' + logErr);
  }

  touchDashboardSourceUpdated_('bills');

  var summary = changedFields.length === 1
    ? '1 field updated'
    : changedFields.length + ' fields updated';

  return {
    ok: true,
    message: 'Changes saved — ' + summary,
    payee: payee,
    changedFields: changedFields
  };
}

/* -------------------------------------------------------------------------- */
/*  Stop tracking (deactivate)                                                */
/* -------------------------------------------------------------------------- */

/**
 * Soft-delete: flip Active = 'No' on a single INPUT - Bills row.
 *
 * Targets a specific row by sheet index (passed back from the rendered bill
 * card) and re-checks the Payee label before writing, so a stale UI payload
 * cannot accidentally deactivate the wrong row.
 *
 * @param {Object} payload
 *   - sheetRow {number} 1-based row index in INPUT - Bills (required)
 *   - payee    {string} expected Payee on that row (required; used to verify)
 *
 * @returns {{ok:boolean, message:string, payee:string}}
 */
function deactivateBillFromDashboard(payload) {
  validateRequired_(payload, ['sheetRow', 'payee']);

  var targetRow = Math.round(Number(payload.sheetRow));
  if (!isFinite(targetRow) || targetRow < 2) {
    throw new Error('Invalid bill row reference.');
  }

  var expectedPayee = String(payload.payee || '').trim();
  if (!expectedPayee) throw new Error('Payee is required.');

  var ss = getUserSpreadsheet_();
  var sheet = getSheet_(ss, 'BILLS');

  if (targetRow > sheet.getLastRow()) {
    throw new Error('Bill row is out of range. The sheet may have been edited; please refresh.');
  }

  var headerDisplay = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0] || [];
  var headerMap = {};
  for (var i = 0; i < headerDisplay.length; i++) {
    var label = String(headerDisplay[i] || '').trim();
    if (label) headerMap[label] = i;
  }

  if (!Object.prototype.hasOwnProperty.call(headerMap, 'Payee')) {
    throw new Error('Bills sheet is missing required header: Payee.');
  }
  if (!Object.prototype.hasOwnProperty.call(headerMap, 'Active')) {
    throw new Error('Bills sheet is missing required header: Active.');
  }

  var rowDisplay = sheet
    .getRange(targetRow, 1, 1, headerDisplay.length)
    .getDisplayValues()[0] || [];

  var actualPayee = String(rowDisplay[headerMap.Payee] || '').trim();
  if (!actualPayee) {
    throw new Error('No bill found on the selected row; please refresh.');
  }
  if (actualPayee !== expectedPayee) {
    throw new Error(
      'Bill has moved on the sheet (expected "' + expectedPayee +
      '", found "' + actualPayee + '"). Please refresh and try again.'
    );
  }

  var currentActive = normalizeYesNo_(rowDisplay[headerMap.Active]);
  if (currentActive === 'no') {
    return {
      ok: true,
      message: 'Already not tracked',
      payee: actualPayee
    };
  }

  sheet.getRange(targetRow, headerMap.Active + 1).setValue('No');

  try {
    appendActivityLog_(ss, {
      eventType: 'bill_deactivate',
      entryDate: Utilities.formatDate(
        stripTime_(new Date()),
        Session.getScriptTimeZone(),
        'yyyy-MM-dd'
      ),
      amount: 0,
      direction: 'expense',
      payee: actualPayee,
      category: headerMap.Category !== undefined
        ? String(rowDisplay[headerMap.Category] || '').trim()
        : '',
      accountSource: '',
      cashFlowSheet: '',
      cashFlowMonth: '',
      dedupeKey: '',
      details: JSON.stringify({
        detailsVersion: 1,
        sheetRow: targetRow,
        previousActive: 'Yes',
        reason: 'stop_tracking'
      })
    });
  } catch (logErr) {
    Logger.log('deactivateBillFromDashboard activity log: ' + logErr);
  }

  touchDashboardSourceUpdated_('bills');

  return {
    ok: true,
    message: 'Tracking stopped — ' + actualPayee + ' removed from bills',
    payee: actualPayee
  };
}

/* -------------------------------------------------------------------------- */
/*  Category suggestions                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Distinct Category values from INPUT - Bills, sorted alphabetically.
 * Used by the Add Bill form's Category dropdown.
 *
 * @returns {string[]}
 */
function getBillCategoriesFromDashboard() {
  var ss = getUserSpreadsheet_();
  // First-run safety: INPUT - Bills may be missing on a blank workbook.
  // Return an empty list; the client has a canonical fallback (see
  // BILL_ADD_CATEGORY_FALLBACK_OPTIONS_) that kicks in when the server
  // returns none.
  var sheet = ss.getSheetByName(getSheetNames_().BILLS);
  if (!sheet) return [];
  var display = sheet.getDataRange().getDisplayValues();
  if (!display || display.length < 2) return [];

  var headers = display[0] || [];
  var categoryCol = -1;
  for (var i = 0; i < headers.length; i++) {
    if (String(headers[i] || '').trim() === 'Category') {
      categoryCol = i;
      break;
    }
  }
  if (categoryCol === -1) return [];

  var seen = {};
  var out = [];
  for (var r = 1; r < display.length; r++) {
    var val = String((display[r] && display[r][categoryCol]) || '').trim();
    if (!val) continue;
    var key = val.toLowerCase();
    if (seen[key]) continue;
    seen[key] = true;
    out.push(val);
  }

  out.sort(function(a, b) {
    return a.toLowerCase().localeCompare(b.toLowerCase());
  });
  return out;
}

/* -------------------------------------------------------------------------- */
/*  Active bills — management view                                            */
/* -------------------------------------------------------------------------- */

/**
 * Return every active row in INPUT - Bills as a compact list for the "All
 * active bills" management section of the Bills page.
 *
 * Active = any row whose normalized Active column is 'yes' (blank rows skipped).
 *
 * This is a pure read — it never writes, never touches Cash Flow, and is
 * intentionally decoupled from the Due Soon / Next 7 Days reader so the
 * management section keeps working even when a user has no upcoming dues.
 *
 * Each row carries `inputBillsRow` (1-based sheet row) so the frontend's
 * Stop tracking action can target the exact row without a second lookup.
 *
 * `notes` is included so the Manage Edit form can pre-fill the
 * Notes field without a separate fetch — without it, opening Edit
 * would silently clear an existing Notes cell on save.
 *
 * @returns {Array<{
 *   inputBillsRow:number,
 *   payee:string,
 *   category:string,
 *   dueDay:(number|string),
 *   frequency:string,
 *   paymentSource:string,
 *   defaultAmount:number,
 *   autopay:string,
 *   varies:string,
 *   notes:string
 * }>}
 */
function getActiveBillsForManagementFromDashboard() {
  var ss = getUserSpreadsheet_();
  // First-run safety: INPUT - Bills may be missing on a blank workbook.
  // Return an empty list so the Bills management section renders its
  // "No active bills yet" empty state instead of throwing a red banner.
  var sheet = ss.getSheetByName(getSheetNames_().BILLS);
  if (!sheet) return [];

  // Converge older workbooks to the current Bills schema (append-only) the
  // first time the user opens the Bills module — no need to add a bill. This
  // is a user-initiated, infrequent read (NOT the Bills Due hot path), so a
  // one-time idempotent header heal is cheap. Best-effort: if the heal can't
  // write (read-only share / drive.file / lock), log and keep loading the list
  // — the reader below already tolerates missing optional columns.
  try {
    ensureBillsSheetSchema_(sheet);
  } catch (schemaErr) {
    Logger.log('getActiveBillsForManagementFromDashboard: Bills schema self-heal failed (continuing with existing columns): ' +
      (schemaErr && schemaErr.message ? schemaErr.message : schemaErr));
  }

  var display = sheet.getDataRange().getDisplayValues();
  if (!display || display.length < 2) return [];

  var headers = display[0] || [];
  var idx = {};
  for (var i = 0; i < headers.length; i++) {
    var label = String(headers[i] || '').trim();
    if (label) idx[label] = i;
  }

  if (idx.Payee === undefined || idx.Active === undefined) {
    // Mirrors the contract enforced by addBillFromDashboard: Payee + Active
    // are required for this view to be meaningful. A misconfigured workbook
    // should surface as an empty list rather than a runtime error here.
    return [];
  }

  var out = [];
  for (var r = 1; r < display.length; r++) {
    var row = display[r] || [];
    var payee = String(row[idx.Payee] || '').trim();
    if (!payee) continue;

    var activeRaw = row[idx.Active];
    var activeNorm = normalizeYesNo_(activeRaw);
    if (activeNorm !== 'yes') continue;

    var defaultAmount = 0;
    if (idx['Default Amount'] !== undefined) {
      var parsed = toNumber_(row[idx['Default Amount']]);
      if (isFinite(parsed)) defaultAmount = round2_(Math.abs(parsed));
    }

    var dueDayVal = '';
    if (idx['Due Day'] !== undefined) {
      var ddRaw = String(row[idx['Due Day']] || '').trim();
      if (ddRaw) {
        var ddNum = Number(ddRaw);
        dueDayVal = isFinite(ddNum) && Math.floor(ddNum) === ddNum ? ddNum : ddRaw;
      }
    }

    out.push({
      inputBillsRow: r + 1,
      payee: payee,
      category: idx.Category !== undefined ? String(row[idx.Category] || '').trim() : '',
      dueDay: dueDayVal,
      frequency: idx.Frequency !== undefined ? String(row[idx.Frequency] || '').trim() : '',
      paymentSource: idx['Payment Source'] !== undefined
        ? String(row[idx['Payment Source']] || '').trim()
        : '',
      defaultAmount: defaultAmount,
      autopay: idx.Autopay !== undefined
        ? billsNormalizeYesNoLabel_(row[idx.Autopay], 'No')
        : 'No',
      varies: idx.Varies !== undefined
        ? billsNormalizeYesNoLabel_(row[idx.Varies], 'No')
        : 'No',
      notes: idx.Notes !== undefined ? String(row[idx.Notes] || '').trim() : '',
      // Phase 4: raw Weekday label so the edit form can prefill the dropdown.
      // Blank when the column is absent (older workbook) or the cell is empty →
      // the form shows the "Legacy (Due Day)" placeholder.
      weekday: idx.Weekday !== undefined ? String(row[idx.Weekday] || '').trim() : '',
      // Phase 6B: canonical yyyy-MM-dd Anchor Date so the edit form can prefill
      // the <input type="date">. Normalized (handles our yyyy-MM-dd writes and
      // legacy locale-formatted Date cells); blank when absent/empty/unparseable
      // → the form shows an empty Anchor Date.
      anchorDate: idx['Anchor Date'] !== undefined
        ? billsNormalizeAnchorDateLabel_(row[idx['Anchor Date']])
        : ''
    });
  }

  out.sort(function(a, b) {
    return a.payee.toLowerCase().localeCompare(b.payee.toLowerCase());
  });

  return out;
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Idempotent, append-only INPUT - Bills schema self-heal.
 *
 * Ensures every optional column the app relies on exists on the given Bills
 * sheet WITHOUT rewriting data or moving existing columns. Older workbooks
 * (provisioned before a column was introduced) converge to the current schema
 * the first time any caller runs this, so it is safe to call on every use of
 * the Bills module — not just when a bill is added. Guarantees:
 *
 *   - idempotent            : a column present under ANY casing is left alone
 *   - append-only           : missing columns are inserted after their canonical
 *                             anchor (falling back to the end), never over data
 *   - case-insensitive      : "PAYMENT SOURCE" counts as "Payment Source"
 *   - preserves order        : canonical order Payee … Notes → Weekday → Anchor
 *                             Date (trailing new columns append at the end)
 *   - never rewrites rows    : only the header row (row 1) is ever written
 *
 * Self-healed columns and why:
 *   - Payment Source : older sheets missing it silently drop Flow Source on the
 *                      Cash Flow row (resolveFlowSourceFromBillOrDebt_ has
 *                      nothing to read).
 *   - Category / Frequency / Start Month / Notes : optional metadata columns.
 *   - Weekday / Anchor Date : Phase 2 additive scheduling columns. Nothing
 *                      writes a value into them yet, and a blank Weekday means
 *                      "behave exactly like today" (Due Day anchor). They stay
 *                      LAST in the list so their 'Notes' / 'Weekday' anchors
 *                      resolve consistently on older sheets.
 *   - Schedule Effective Date : Phase 5A additive column (schema-only). Blank
 *                      means "no clamp / legacy behavior"; no reader/writer
 *                      populates it yet. Anchored after 'Anchor Date'.
 *
 * This is the extraction of the self-heal block that previously lived inline in
 * addBillFromDashboard; behavior is identical (same headers, anchors, insert
 * strategy, and single pre-heal header map).
 *
 * @param {Sheet} sheet  the INPUT - Bills sheet
 * @returns {boolean} true if any column was appended (header row changed)
 */
function ensureBillsSheetSchema_(sheet) {
  var headerDisplay = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0] || [];
  if (!headerDisplay || !headerDisplay.length) {
    throw new Error('Bills sheet has no header row.');
  }

  // Case-insensitive header map. Real-world INPUT - Bills sheets are sometimes
  // shipped with ALL-CAPS headers (e.g. "PAYMENT SOURCE"), which a naive
  // indexOf would miss and re-add as a duplicate. Built once from the pre-heal
  // header (anchors resolve against this map; trailing columns append at the
  // end, preserving canonical order).
  var headerMap = {};
  for (var i = 0; i < headerDisplay.length; i++) {
    var label = String(headerDisplay[i] || '').trim();
    if (label) headerMap[label.toLowerCase()] = i;
  }
  function headerIndex_(name) {
    var key = String(name || '').trim().toLowerCase();
    return Object.prototype.hasOwnProperty.call(headerMap, key) ? headerMap[key] : -1;
  }

  var selfHealHeaders = ['Payment Source', 'Category', 'Frequency', 'Start Month', 'Notes', 'Weekday', 'Anchor Date', 'Schedule Effective Date'];
  var selfHealAnchors = {
    'Payment Source': 'Active',
    'Category': 'Payee',
    'Frequency': 'Payment Source',
    'Start Month': 'Frequency',
    'Notes': 'Start Month',
    'Weekday': 'Notes',
    'Anchor Date': 'Weekday',
    // Phase 5A (schema-only): appended AFTER 'Anchor Date'. Blank means
    // "no clamp / legacy behavior" — no recurrence/AutoPay/UI change yet.
    'Schedule Effective Date': 'Anchor Date'
  };
  var headerChanged = false;
  for (var sh = 0; sh < selfHealHeaders.length; sh++) {
    var needed = selfHealHeaders[sh];
    if (headerIndex_(needed) !== -1) continue;

    var anchor = selfHealAnchors[needed];
    var anchorIdx = anchor ? headerIndex_(anchor) : -1;
    var insertIndex = anchorIdx !== -1 ? anchorIdx + 2 : sheet.getLastColumn() + 1;

    try {
      if (insertIndex > sheet.getLastColumn()) {
        sheet.insertColumnAfter(sheet.getLastColumn());
      } else {
        sheet.insertColumnBefore(insertIndex);
      }
    } catch (colErr) {
      sheet.insertColumnAfter(sheet.getLastColumn());
      insertIndex = sheet.getLastColumn();
    }
    sheet.getRange(1, insertIndex).setValue(needed);

    // Formatting parity: a freshly inserted column otherwise carries Sheets'
    // default look. Inherit the neighboring (anchor) column's canonical Bills
    // formatting — font family/size/color, alignment, background, header band —
    // then apply the canonical width for the scheduling columns so the column
    // looks identical to how first-create provisioning would render it. Cosmetic
    // only: PASTE_FORMAT writes no values and no other column/row is touched.
    copyBillsColumnFormatFromNeighbor_(sheet, insertIndex, insertIndex - 1);

    Logger.log('ensureBillsSheetSchema_: auto-added missing INPUT - Bills column "' + needed + '" at index ' + insertIndex);
    headerChanged = true;
  }

  // Canonical widen-only widths for any scheduling columns just added, via the
  // shared header-addressed helper (same widths first-create uses). Guarded by
  // headerChanged so this runs ONLY on a real schema-evolution event, never on
  // the plain read path — see ENGINEERING_STANDARDS.md §9/§10.
  if (headerChanged) {
    try {
      applyCanonicalColumnWidthsByHeader_(sheet, 1, BILLS_SCHEDULING_COLUMN_WIDTHS_);
    } catch (_wErr) { /* cosmetic */ }
  }

  return headerChanged;
}

/**
 * Normalize a Yes/No-ish user input into the canonical sheet label.
 * Accepts 'yes'|'no'|'y'|'n'|'true'|'false' plus empty → fallback.
 */
function billsNormalizeYesNoLabel_(value, fallbackLabel) {
  var raw = String(value == null ? '' : value).trim();
  if (!raw) return fallbackLabel;
  var norm = normalizeYesNo_(raw);
  return norm === 'yes' ? 'Yes' : 'No';
}

/**
 * After an append, paint the newly written row's formatting from the row
 * immediately above it so the new row visually matches the rest of the sheet.
 *
 * Values are NOT overwritten — we use PASTE_FORMAT only.
 *
 * Silently no-ops if there is no usable source row (e.g. the append produced
 * the very first data row).
 */
function copyBillsRowFormattingFromPreviousRow_(sheet, newRow, previousLastRow) {
  if (!sheet || !newRow || newRow <= 2) return;
  var sourceRow = previousLastRow && previousLastRow >= 2 ? previousLastRow : newRow - 1;
  if (sourceRow < 2 || sourceRow >= newRow) return;

  var numCols = sheet.getLastColumn();
  if (numCols < 1) return;

  try {
    sheet
      .getRange(sourceRow, 1, 1, numCols)
      .copyTo(
        sheet.getRange(newRow, 1, 1, numCols),
        SpreadsheetApp.CopyPasteType.PASTE_FORMAT,
        false
      );
  } catch (e) {
    Logger.log('copyBillsRowFormattingFromPreviousRow_: ' + e);
  }
}

/**
 * Find the 1-based row number BEFORE which a new bill row with `newDueDay`
 * should be inserted to keep INPUT - Bills sorted by Due Day ascending.
 *
 * Rules:
 *   - Insert before the first existing data row whose Due Day is strictly
 *     greater than `newDueDay`.
 *   - Same-day ties land AFTER existing same-day rows (newest at the
 *     bottom of the same-day group), matching the dashboard's stable
 *     sort behavior in sortBillsManageRows_.
 *   - Blank Due Day rows (legacy or hand-edited bills) sink to the bottom
 *     — numeric Due Day rows are inserted above the first blank row we
 *     encounter so the visible ordering stays predictable.
 *   - Returns -1 to signal "append at end" when no strictly-greater row
 *     exists and there are no blanks to displace, or when the sheet has
 *     no data yet. Caller falls back to `sheet.appendRow(row)`.
 *
 * Performance: one bounded `getRange().getValues()` over a single column.
 * Typical workbook has < 100 bills so this is well under one frame.
 *
 * @param {Sheet} sheet            INPUT - Bills sheet.
 * @param {number} dueDayCol1Based 1-based column index of "Due Day".
 * @param {number} newDueDay       Validated Due Day of the new bill (1..31).
 * @returns {number}               1-based row number to insertBefore, or -1.
 */
function findBillsSortedInsertRow_(sheet, dueDayCol1Based, newDueDay) {
  if (!sheet || !dueDayCol1Based || dueDayCol1Based < 1) return -1;
  if (!isFinite(newDueDay)) return -1;

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1; // header-only sheet → caller appends.

  var values = sheet.getRange(2, dueDayCol1Based, lastRow - 1, 1).getValues();
  for (var i = 0; i < values.length; i++) {
    var raw = values[i][0];
    var hasValue = (raw !== '' && raw !== null && raw !== undefined);
    var n = hasValue ? Number(raw) : NaN;
    var hasNumeric = hasValue && isFinite(n);
    if (!hasNumeric) {
      // Blank or unparseable Due Day — insert numeric row here so blanks
      // stay sunken at the bottom.
      return i + 2;
    }
    if (n > newDueDay) {
      return i + 2;
    }
  }
  return -1; // every existing row has Due Day <= newDueDay → append at end.
}

/**
 * Sister of copyBillsRowFormattingFromPreviousRow_ but for the sorted-insert
 * path. After `insertRowBefore(insertRow)` the row that was formerly at
 * `insertRow` is now at `insertRow + 1`, so it's the closest already-styled
 * sibling — copy its formatting onto the new blank row at `insertRow`.
 *
 * Falls back to the row above (`newRow - 1`) when the new row is now the
 * last data row and there is no styled row below to mirror. We never copy
 * from row 1 (the header) because that would inherit bold/header styling.
 *
 * Values are NOT overwritten — PASTE_FORMAT only.
 */
function copyBillsRowFormattingFromInsertSiblingRow_(sheet, newRow) {
  if (!sheet || !newRow || newRow < 2) return;
  var lastRow = sheet.getLastRow();
  // Prefer the row immediately below (originally at newRow before insert).
  var sourceRow = (newRow + 1) <= lastRow ? (newRow + 1) : (newRow - 1);
  if (sourceRow < 2 || sourceRow === newRow) return;

  var numCols = sheet.getLastColumn();
  if (numCols < 1) return;

  try {
    sheet
      .getRange(sourceRow, 1, 1, numCols)
      .copyTo(
        sheet.getRange(newRow, 1, 1, numCols),
        SpreadsheetApp.CopyPasteType.PASTE_FORMAT,
        false
      );
  } catch (e) {
    Logger.log('copyBillsRowFormattingFromInsertSiblingRow_: ' + e);
  }
}

// Canonical widen widths (px) for the additive scheduling columns, shared by
// first-create styling (applyBillsSheetStyling_) and the schema self-heal so a
// column looks identical however it was added. Keep in sync with the trailing
// positions of widthMins in applyBillsSheetStyling_.
// Sized so each 16pt-bold header AND its body value fit without clipping and
// with comfortable padding (Readability Standard): "Weekday" + weekday names,
// "Anchor Date" (11-char header, was clipped at 120), and the long
// "Schedule Effective Date" header (23 chars, was badly clipped at 160).
var BILLS_SCHEDULING_COLUMN_WIDTHS_ = {
  'Weekday': 120,
  'Anchor Date': 160,
  'Schedule Effective Date': 280
};

/**
 * Copy an entire column's cell FORMATTING (font family/size/color, alignment,
 * background, number format — header + body) from a source column onto a
 * newly-inserted column so the new column visually inherits its neighbor's
 * canonical Bills look instead of Sheets' default. Uses PASTE_FORMAT only, so
 * NO cell values are written and no data is modified. Cosmetic-only: all
 * failures are swallowed. No-op when source/target are invalid or identical.
 *
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @param {number} targetCol  1-based index of the newly inserted column
 * @param {number} sourceCol  1-based index of the neighboring column to inherit
 */
function copyBillsColumnFormatFromNeighbor_(sheet, targetCol, sourceCol) {
  if (!sheet || targetCol < 1 || sourceCol < 1 || targetCol === sourceCol) return;
  try {
    var maxRows = sheet.getMaxRows();
    sheet.getRange(1, sourceCol, maxRows, 1).copyTo(
      sheet.getRange(1, targetCol, maxRows, 1),
      SpreadsheetApp.CopyPasteType.PASTE_FORMAT,
      false
    );
  } catch (e) {
    Logger.log('copyBillsColumnFormatFromNeighbor_: ' + e);
  }
}

/**
 * First-create cosmetic styling for INPUT - Bills (Family Beta standard).
 *
 * INPUT - Bills is a FLAT table — a single header row (row 1) followed by
 * bill data rows — with no section/year rows, no totals, and no delta rows.
 * Styling is therefore: a warm-yellow header and a calm white body carried
 * by typography (size 14).
 *
 *   - body (all cells) → white background, font size 14
 *   - header (row 1)   → yellow #ffe599, bold, black, font size 16,
 *                        vertical-middle, row height 40
 *
 * The body wash runs FIRST so the header re-applied afterward always wins.
 * This helper NEVER writes formulas, creates rows, or changes headers/schema.
 * Existing number formats applied by the creator (Default Amount currency)
 * are preserved — only background + font size are touched on the body.
 *
 * Column widths are widen-only (never shrink a user's manual widening).
 *
 * All failures are swallowed — cosmetic only; must never fail an ensure op on
 * a formatting glitch. Idempotent: safe to re-run on the same sheet.
 *
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 */
function applyBillsSheetStyling_(sheet) {
  if (!sheet) return;

  var lastCol = 1;
  try { lastCol = Math.max(1, sheet.getLastColumn()); } catch (_) { return; }
  var lastRow = 0;
  try { lastRow = sheet.getLastRow(); } catch (_) { return; }
  if (lastRow < 1) return;

  // Shared Operational-family header + body presentation (ONE source of truth
  // in sheet_bootstrap.js — identical to Debts / Upcoming Expenses / Cash Flow).
  // Handles the white body wash, body row height, the yellow centered header
  // with thin black bottom border, and the frozen header row.
  applyOperationalFlatSheetStyling_(sheet);

  // Widen-only column widths (never shrink a column the user widened). Keyed
  // by canonical column position from the creator's header layout:
  // 1 Payee | 2 Category | 3 Due Day | 4 Default Amount | 5 Varies |
  // 6 Autopay | 7 Active | 8 Payment Source | 9 Frequency | 10 Start Month |
  // 11 Notes. The three trailing scheduling columns (Weekday, Anchor Date,
  // Schedule Effective Date) are widened separately below via the shared
  // header-addressed helper so first-create and self-heal share ONE source.
  var widthMins = [200, 150, 100, 175, 100, 110, 90, 190, 130, 130, 240];
  for (var c = 1; c <= lastCol && c <= widthMins.length; c++) {
    try {
      if (sheet.getColumnWidth(c) < widthMins[c - 1]) {
        sheet.setColumnWidth(c, widthMins[c - 1]);
      }
    } catch (_) {}
  }

  // Scheduling columns: canonical widen-only widths from the single shared
  // source (BILLS_SCHEDULING_COLUMN_WIDTHS_), applied by header name so
  // first-create matches the self-heal path exactly.
  try {
    applyCanonicalColumnWidthsByHeader_(sheet, 1, BILLS_SCHEDULING_COLUMN_WIDTHS_);
  } catch (_schedWidthErr) { /* cosmetic only */ }
  // Header freeze is handled by applyOperationalFlatSheetStyling_ above.
}
