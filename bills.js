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
 *   - Distinct-category suggestions for the Add form
 *
 * Explicitly out of scope for v1:
 *   - Edit
 *   - Hard delete
 *   - Onboarding / Overview integration
 *   - Cash Flow auto-row creation
 *   - Alias mapping repair
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

  var ss = SpreadsheetApp.getActiveSpreadsheet();
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
  // bills with a blank Flow Source on the Cash Flow row because the
  // server-side fallback (`resolveFlowSourceFromBillOrDebt_`) has nothing to
  // read. Case-insensitive check: we only add the column if it genuinely
  // doesn't exist under any casing (so "PAYMENT SOURCE" counts as present).
  var selfHealHeaders = ['Payment Source', 'Category', 'Frequency', 'Start Month', 'Notes'];
  var selfHealAnchors = {
    'Payment Source': 'Active',
    'Category': 'Payee',
    'Frequency': 'Payment Source',
    'Start Month': 'Frequency',
    'Notes': 'Start Month'
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
    Logger.log('addBillFromDashboard: auto-added missing INPUT - Bills column "' + needed + '" at index ' + insertIndex);
    headerChanged = true;
  }

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

  // Capture the last data row BEFORE the append so we can copy its formatting
  // onto the new row afterwards (values-only append, then paint the format).
  var previousLastRow = sheet.getLastRow();

  sheet.appendRow(row);

  var newRow = sheet.getLastRow();
  copyBillsRowFormattingFromPreviousRow_(sheet, newRow, previousLastRow);

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

  var ss = SpreadsheetApp.getActiveSpreadsheet();
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
      message: 'Bill was already inactive.',
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
    message: 'Stopped tracking "' + actualPayee + '".',
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
  var ss = SpreadsheetApp.getActiveSpreadsheet();
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
 * @returns {Array<{
 *   inputBillsRow:number,
 *   payee:string,
 *   category:string,
 *   dueDay:(number|string),
 *   frequency:string,
 *   paymentSource:string,
 *   defaultAmount:number,
 *   autopay:string,
 *   varies:string
 * }>}
 */
function getActiveBillsForManagementFromDashboard() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  // First-run safety: INPUT - Bills may be missing on a blank workbook.
  // Return an empty list so the Bills management section renders its
  // "No active bills yet" empty state instead of throwing a red banner.
  var sheet = ss.getSheetByName(getSheetNames_().BILLS);
  if (!sheet) return [];
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
        : 'No'
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
