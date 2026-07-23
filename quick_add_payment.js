/**
 * Allow-list of Flow Source values for the `INPUT - Cash Flow YYYY` sheets.
 * Phase 2 keeps this deliberately tiny:
 *   CASH         — income, transfers, bank-funded payments, credit-card payoff rows.
 *   CREDIT_CARD  — expenses actually charged to a card (spending, not payoff).
 * Legacy rows created before the column existed are allowed to be blank.
 * Add per-card values here later; consumers read via `normalizeFlowSource_`.
 */
var FLOW_SOURCE_ALLOWED_VALUES_ = ['CASH', 'CREDIT_CARD'];

/**
 * Normalize a raw Flow Source value (from UI, payload, or sheet cell) to the
 * canonical uppercase form. Blank / null / undefined is allowed and returns ''.
 * Accepts common variants ("credit card", "credit-card", "Cash") and folds
 * whitespace/hyphens into underscores. Throws on any other value so typos
 * never silently poison the sheet.
 */
function normalizeFlowSource_(raw) {
  if (raw === null || raw === undefined) return '';
  const text = String(raw).trim();
  if (!text) return '';

  const canonical = text.toUpperCase().replace(/[\s-]+/g, '_');
  if (FLOW_SOURCE_ALLOWED_VALUES_.indexOf(canonical) !== -1) {
    return canonical;
  }

  throw new Error(
    'Unsupported Flow Source value: "' + raw + '". Allowed: ' +
    FLOW_SOURCE_ALLOWED_VALUES_.join(', ') + ', or blank.'
  );
}

function getQuickAddPaymentUiData() {
  const ss = getUserSpreadsheet_();
  const year = getCurrentYear_();

  // Blank-workbook safety: on a fresh sheet INPUT - Cash Flow YYYY does not
  // exist yet and getCashFlowSheetForYear_() -> getCashFlowSheet_() would
  // throw "Missing cash flow sheet: …" and surface as a red banner on the
  // Quick Add page. Return the same neutral payload shape the function's
  // existing empty-sheet branch produces so the UI renders clean. The
  // populated path below is unchanged.
  if (!ss.getSheetByName(getCashFlowSheetName_(year))) {
    return {
      year: year,
      payees: [],
      types: ['Expense', 'Income'],
      flowSources: FLOW_SOURCE_ALLOWED_VALUES_.slice(),
      flowSourceColumnPresent: false
    };
  }

  const sheet = getCashFlowSheetForYear_(ss, year);

  const values = sheet.getDataRange().getDisplayValues();
  if (values.length < 2) {
    return {
      year: year,
      payees: [],
      types: ['Expense', 'Income'],
      flowSources: FLOW_SOURCE_ALLOWED_VALUES_.slice(),
      flowSourceColumnPresent: false
    };
  }

  const headerMap = getCashFlowHeaderMap_(sheet);
  const hasFlowSource = headerMap.flowSourceColZero !== -1;

  const rows = [];
  for (let r = 1; r < values.length; r++) {
    const type = String(values[r][headerMap.typeColZero] || '').trim();
    const payee = String(values[r][headerMap.payeeColZero] || '').trim();

    if (!type || !payee) continue;
    if (type === 'Summary') continue;

    var existingFlowSource = '';
    if (hasFlowSource) {
      var rawExisting = values[r][headerMap.flowSourceColZero];
      try {
        existingFlowSource = normalizeFlowSource_(rawExisting);
      } catch (e) {
        // Leave legacy / typo values blank in the hint list rather than blowing
        // up the whole sidebar. The raw cell is untouched.
        existingFlowSource = '';
      }
    }

    rows.push({
      type: type,
      payee: payee,
      flowSource: existingFlowSource
    });
  }

  rows.sort(function(a, b) {
    if (a.type !== b.type) return a.type.localeCompare(b.type);
    return a.payee.localeCompare(b.payee);
  });

  return {
    year: year,
    payees: rows,
    types: ['Expense', 'Income'],
    flowSources: FLOW_SOURCE_ALLOWED_VALUES_.slice(),
    flowSourceColumnPresent: hasFlowSource
  };
}

/**
 * Prior calendar month cell for same Type + Payee on the Cash Flow tab for that calendar year.
 *
 * Each tab is one year: INPUT - Cash Flow YYYY has month columns Jan-YY … Dec-YY for that year only.
 * So for a January date, "last month" is December of the *previous* year → that month lives on
 * INPUT - Cash Flow (year−1), not on the current year’s tab. A payee row must exist on that tab
 * (same Type + Payee text) or there is nothing to read.
 */
function computeQuickAddPriorMonthPreview_(ss, entryType, payee, entryDate) {
  const prior = new Date(entryDate.getFullYear(), entryDate.getMonth() - 1, 15);
  const priorMonthLabel = Utilities.formatDate(prior, Session.getScriptTimeZone(), 'MMM-yy');
  const priorYear = prior.getFullYear();
  const priorTabName = getCashFlowSheetName_(priorYear);

  var priorSheet;
  try {
    priorSheet = getCashFlowSheet_(ss, priorYear);
  } catch (e) {
    return {
      priorMonthLabel: priorMonthLabel,
      priorMonthValue: null,
      priorMonthUnavailableMessage:
        'Missing tab "' +
        priorTabName +
        '" — last month (' +
        priorMonthLabel +
        ') is stored there, not on the current year’s cash flow sheet.'
    };
  }

  const rowPrior = findCashFlowRowByTypeAndPayee_(priorSheet, entryType, payee);
  if (!rowPrior) {
    return {
      priorMonthLabel: priorMonthLabel,
      priorMonthValue: null,
      priorMonthUnavailableMessage:
        'No row for this payee on "' +
        priorTabName +
        '" — last month’s amount is read from that tab (e.g. new payee this year or renamed payee).'
    };
  }

  try {
    const priorMonthCol = getMonthColumnByDate_(priorSheet, prior, 1);
    const priorMonthValue = round2_(toNumber_(priorSheet.getRange(rowPrior.row, priorMonthCol).getValue()));
    return {
      priorMonthLabel: priorMonthLabel,
      priorMonthValue: priorMonthValue,
      priorMonthUnavailableMessage: null
    };
  } catch (e) {
    return {
      priorMonthLabel: priorMonthLabel,
      priorMonthValue: null,
      priorMonthUnavailableMessage:
        'Could not find column ' + priorMonthLabel + ' on "' + priorSheet.getName() + '".'
    };
  }
}

/**
 * Read-only six-month Cash Flow history for the selected Quick Add payee.
 *
 * This is presentation evidence only. It never creates a year sheet, inserts
 * a payee row, writes a month cell, or appends Activity. Missing years, rows,
 * and blank month cells are returned as blank points so the chart remains
 * truthful rather than implying a $0 payment.
 */
function computeQuickAddHistoryPreview_(ss, entryType, payee, entryDate, currentRowExists) {
  if (entryType !== 'Expense' || !currentRowExists) return [];

  const tz = Session.getScriptTimeZone();
  const points = [];
  const sheetCache = {};

  for (let offset = -5; offset <= 0; offset++) {
    const monthDate = new Date(entryDate.getFullYear(), entryDate.getMonth() + offset, 15);
    const year = monthDate.getFullYear();
    let sheet = Object.prototype.hasOwnProperty.call(sheetCache, year)
      ? sheetCache[year]
      : undefined;

    if (sheet === undefined) {
      try {
        sheet = getCashFlowSheet_(ss, year);
      } catch (_e) {
        sheet = null;
      }
      sheetCache[year] = sheet;
    }

    let amount = 0;
    let hasValue = false;
    if (sheet) {
      const rowInfo = findCashFlowRowByTypeAndPayee_(sheet, entryType, payee);
      if (rowInfo) {
        try {
          const monthCol = getMonthColumnByDate_(sheet, monthDate, 1);
          const cell = sheet.getRange(rowInfo.row, monthCol);
          const display = String(cell.getDisplayValue() || '').trim();
          if (display !== '') {
            amount = round2_(Math.abs(toNumber_(cell.getValue())));
            hasValue = true;
          }
        } catch (_e2) {
          hasValue = false;
        }
      }
    }

    points.push({
      month: Utilities.formatDate(monthDate, tz, 'yyyy-MM'),
      label: Utilities.formatDate(monthDate, tz, 'MMM'),
      amount: amount,
      hasValue: hasValue
    });
  }

  return points;
}

function getQuickAddPreview(payload) {
  validateRequired_(payload, ['entryType', 'payee', 'entryDate']);

  const entryType = String(payload.entryType || '').trim();
  const payee = String(payload.payee || '').trim();
  const entryDate = parseIsoDateLocal_(payload.entryDate);

  if (!payee) throw new Error('Payee is required.');
  if (isNaN(entryDate.getTime())) throw new Error('Invalid date.');
  if (entryType !== 'Expense' && entryType !== 'Income') {
    throw new Error('Type must be Expense or Income.');
  }

  const year = entryDate.getFullYear();
  const ss = getUserSpreadsheet_();
  const sheet = getCashFlowSheetForYear_(ss, year);
  const monthCol = getMonthColumnByDate_(sheet, entryDate, 1);
  const headerMap = getCashFlowHeaderMap_(sheet);

  const rowInfo = findCashFlowRowByTypeAndPayee_(sheet, entryType, payee);

  let currentValue = '';
  let existingFlowSource = '';
  if (rowInfo) {
    currentValue = round2_(toNumber_(sheet.getRange(rowInfo.row, monthCol).getValue()));
    if (headerMap.flowSourceColZero !== -1) {
      try {
        existingFlowSource = normalizeFlowSource_(
          sheet.getRange(rowInfo.row, headerMap.flowSourceCol).getDisplayValue()
        );
      } catch (e) {
        existingFlowSource = '';
      }
    }
  }

  const priorPreview = computeQuickAddPriorMonthPreview_(ss, entryType, payee, entryDate);
  const history = computeQuickAddHistoryPreview_(ss, entryType, payee, entryDate, !!rowInfo);

  return {
    sheetName: sheet.getName(),
    month: Utilities.formatDate(entryDate, Session.getScriptTimeZone(), 'MMM-yy'),
    currentValue: currentValue,
    rowExists: !!rowInfo,
    flowSourceColumnPresent: headerMap.flowSourceColZero !== -1,
    existingFlowSource: existingFlowSource,
    priorMonthLabel: priorPreview.priorMonthLabel,
    priorMonthValue: priorPreview.priorMonthValue,
    priorMonthUnavailableMessage: priorPreview.priorMonthUnavailableMessage,
    history: history
  };
}

function quickAddPayment(payload, optionalSs) {
  validateRequired_(payload, ['entryType', 'payee', 'entryDate', 'amount']);

  const entryType = String(payload.entryType || '').trim();
  const payee = String(payload.payee || '').trim();
  const entryDate = parseIsoDateLocal_(payload.entryDate);
  const amount = Math.abs(toNumber_(payload.amount));
  const createIfMissing = !!payload.createIfMissing;
  // Validate up-front so a bad value can't land in the sheet. Blank is allowed
  // (legacy-compatible) and simply skips the Flow Source write below.
  let flowSource = normalizeFlowSource_(payload.flowSource);

  if (!payee) throw new Error('Payee is required.');
  if (isNaN(entryDate.getTime())) throw new Error('Invalid date.');
  // $0 is allowed — users may intentionally zero out a month cell, correct a
  // bad entry, or log a placeholder row. Only reject values that aren't a
  // valid number at all. Math.abs() guarantees amount is >= 0 here, so the
  // negative branch is defensive only.
  if (isNaN(amount) || amount < 0) throw new Error('Amount must be a valid number.');
  if (entryType !== 'Expense' && entryType !== 'Income') {
    throw new Error('Type must be Expense or Income.');
  }

  const signedAmount = entryType === 'Expense' ? -amount : amount;
  const year = entryDate.getFullYear();

  // Internal Test Harness seam: normal browser/sidebar callers omit optionalSs
  // and preserve Central/bound resolution. Harness callers pass only an already
  // validated disposable Spreadsheet object.
  const ss = optionalSs || getUserSpreadsheet_();
  const sheet = getCashFlowSheetForYear_(ss, year);
  const monthCol = getMonthColumnByDate_(sheet, entryDate, 1);
  const headerMap = getCashFlowHeaderMap_(sheet);

  let rowInfo = findCashFlowRowByTypeAndPayee_(sheet, entryType, payee);
  let rowWasCreated = false;
  // Track whether flowSource came from the caller vs. a server-side lookup.
  // Only relevant when filling a blank Flow Source on an EXISTING row: we
  // must not retroactively stamp a derived value onto a row the user already
  // owns, so the fill-a-blank branch below stays gated on an explicit caller
  // value even when a fallback was resolved for the newly created row.
  const callerProvidedFlowSource = !!flowSource;

  if (!rowInfo) {
    if (!createIfMissing) {
      throw new Error('Payee row not found. Check "Create row if missing" to add it automatically.');
    }
    // Bills → Pay and similar flows can lose `flowSource` along the wire
    // (stale cached client bundle on the deployed web app, alternate pay
    // surfaces such as the sidebar, upcoming-expense auto-writes, etc.).
    // Rather than trust every UI path to carry the value, derive it from
    // INPUT - Bills (primary source of truth for the Payment Source field)
    // and INPUT - Debts (Credit Card ⇒ CREDIT_CARD, else CASH) on the
    // server whenever a brand-new Expense row is about to be created
    // without one. Income rows and any non-matching payees keep blank.
    if (!flowSource && entryType === 'Expense') {
      flowSource = resolveFlowSourceFromBillOrDebt_(ss, payee);
    }
    rowInfo = insertCashFlowRow_(sheet, entryType, payee, flowSource);
    rowWasCreated = true;
  }

  const targetCell = sheet.getRange(rowInfo.row, monthCol);
  const previousValue = round2_(toNumber_(targetCell.getValue()));

  // Cash Flow month cells use the red-negative money format so auto-entered
  // expenses match the surrounding expense cells. Value is unchanged — only
  // the number format differs from the shared (black-negative) helper.
  addCashFlowMoneyToCellPreserveRowFormat_(sheet, rowInfo.row, monthCol, signedAmount, 3);

  const newValue = round2_(toNumber_(sheet.getRange(rowInfo.row, monthCol).getValue()));

  // Write Flow Source only when the column exists on this year's tab AND the
  // caller passed a value. For existing rows we only fill a blank cell — we
  // never overwrite a value the user (or a prior call) already set. New rows
  // created by `insertCashFlowRow_` above already got the Flow Source seeded
  // (either from the caller or from the INPUT - Bills/Debts fallback above).
  // Note: the INPUT - Bills/Debts fallback deliberately does NOT fire for
  // existing rows — derived values only seed brand-new rows so we never
  // silently stamp a fallback onto a row the user already owns.
  let flowSourceWritten = rowWasCreated && !!flowSource;
  if (
    flowSource &&
    callerProvidedFlowSource &&
    !rowWasCreated &&
    headerMap.flowSourceColZero !== -1
  ) {
    const flowCell = sheet.getRange(rowInfo.row, headerMap.flowSourceCol);
    const existingRaw = flowCell.getDisplayValue();
    if (!String(existingRaw || '').trim()) {
      flowCell.setValue(flowSource);
      flowSourceWritten = true;
    }
  }

  const debtAdjustResult = adjustDebtsBalanceAfterQuickPayment_(ss, payee, entryType, amount);
  // Preserve existing debtBalanceNote semantics: it represents an ACTUAL
  // balance change ({previousBalance,newBalance}) or null. A Loan/HELOC match
  // returns an info-only marker that must NOT be logged as a balance change —
  // it is surfaced to the user as a UX notice only (no balance was reduced).
  const loanOrHelocNotice = !!(debtAdjustResult && debtAdjustResult.loanOrHelocSkipped);
  const debtBalanceNote = loanOrHelocNotice ? null : debtAdjustResult;

  // The explicit Spreadsheet seam is harness-only; do not update the operator's
  // per-user dashboard freshness metadata while exercising a disposable fixture.
  if (!optionalSs) {
    touchDashboardSourceUpdated_('quick_payment');
    touchDashboardSourceUpdated_('cash_flow');
  }

  const monthLabel = Utilities.formatDate(entryDate, Session.getScriptTimeZone(), 'MMM-yy');
  const entryDateStr = Utilities.formatDate(entryDate, Session.getScriptTimeZone(), 'yyyy-MM-dd');

  var activitySnapshot = {
    operationId: Utilities.getUuid(),
    entryType: entryType,
    payee: payee,
    entryDate: entryDateStr,
    amount: amount,
    previousValue: previousValue,
    newValue: newValue,
    signedAmount: signedAmount,
    createIfMissing: createIfMissing,
    debtBalanceNote: debtBalanceNote,
    cashFlowSheet: sheet.getName(),
    cashFlowMonth: monthLabel,
    flowSource: flowSource || '',
    flowSourceWritten: flowSourceWritten
  };

  if (!payload.suppressActivityLog) {
    appendActivityLog_(ss, {
      eventType: 'quick_pay',
      entryDate: entryDateStr,
      amount: amount,
      direction: entryType === 'Expense' ? 'expense' : 'income',
      payee: payee,
      category: '',
      accountSource: '',
      cashFlowSheet: sheet.getName(),
      cashFlowMonth: monthLabel,
      dedupeKey: '',
      details: JSON.stringify({
        previousValue: previousValue,
        newValue: newValue,
        signedAmount: signedAmount,
        createIfMissing: createIfMissing,
        debtBalanceNote: debtBalanceNote
      })
    });
  }

  const priorPreview = computeQuickAddPriorMonthPreview_(ss, entryType, payee, entryDate);
  const history = computeQuickAddHistoryPreview_(ss, entryType, payee, entryDate, true);

  // Keep the user-facing status line to a single short sentence. The detailed
  // fields the old multi-line dump surfaced (sheet name, month, before/after
  // values, flow source, debt balance delta) are still returned in
  // `preview` and `activitySnapshot` for any caller that needs them.
  let message = 'Payment recorded — ' + monthLabel + ' cash flow updated';
  // Non-blocking, info-only nudge for Loan/HELOC payments. The balance was
  // intentionally not auto-reduced; explain why and point users to Manage
  // Debts for a manual update. Appended to the normal success message so it
  // reuses the existing pay_status notification and clears with it. Shown only
  // for Loan/HELOC matches — never for credit cards or other revolving debt.
  if (loanOrHelocNotice) {
    message += ' — Loan and HELOC balances are not automatically reduced because '
      + 'payments may include interest or fees. Update the balance in Manage Debts '
      + 'after your statement if you want the tracked principal balance to reflect '
      + 'the latest amount.';
  }

  return {
    ok: true,
    preview: {
      sheetName: sheet.getName(),
      month: monthLabel,
      currentValue: newValue,
      rowExists: true,
      flowSourceColumnPresent: headerMap.flowSourceColZero !== -1,
      flowSourceWritten: flowSourceWritten,
      priorMonthLabel: priorPreview.priorMonthLabel,
      priorMonthValue: priorPreview.priorMonthValue,
      priorMonthUnavailableMessage: priorPreview.priorMonthUnavailableMessage,
      history: history
    },
    message: message,
    loanOrHelocNotice: loanOrHelocNotice,
    activitySnapshot: activitySnapshot
  };
}

/**
 * Normalize and validate the browser-held receipt used to verify a completed
 * Quick Add write. The receipt may identify only the canonical Cash Flow cell
 * that quickAddPayment() already wrote; it cannot target another sheet or turn
 * a correction into a second additive payment.
 */
function normalizeQuickAddWriteReceipt_(raw) {
  raw = raw || {};
  validateRequired_(raw, [
    'entryType', 'payee', 'entryDate', 'previousValue', 'newValue',
    'signedAmount', 'cashFlowSheet', 'cashFlowMonth'
  ]);

  var entryType = String(raw.entryType || '').trim();
  var payee = String(raw.payee || '').trim();
  var entryDate = parseIsoDateLocal_(raw.entryDate);
  var previousValue = Number(raw.previousValue);
  var newValue = Number(raw.newValue);
  var signedAmount = Number(raw.signedAmount);

  if (entryType !== 'Expense' && entryType !== 'Income') {
    throw new Error('Quick Add receipt has an invalid entry type.');
  }
  if (!payee || isNaN(entryDate.getTime())) {
    throw new Error('Quick Add receipt has an invalid payee or date.');
  }
  if (!isFinite(previousValue) || !isFinite(newValue) || !isFinite(signedAmount)) {
    throw new Error('Quick Add receipt has invalid numeric values.');
  }
  if ((entryType === 'Expense' && signedAmount > 0) ||
      (entryType === 'Income' && signedAmount < 0)) {
    throw new Error('Quick Add receipt amount direction does not match its type.');
  }

  previousValue = round2_(previousValue);
  newValue = round2_(newValue);
  signedAmount = round2_(signedAmount);
  if (!quickAddMoneyEquals_(round2_(previousValue + signedAmount), newValue)) {
    throw new Error('Quick Add receipt before/after values are inconsistent.');
  }

  var expectedSheet = getCashFlowSheetName_(entryDate.getFullYear());
  var expectedMonth = Utilities.formatDate(
    entryDate,
    Session.getScriptTimeZone(),
    'MMM-yy'
  );
  if (String(raw.cashFlowSheet || '').trim() !== expectedSheet ||
      String(raw.cashFlowMonth || '').trim() !== expectedMonth) {
    throw new Error('Quick Add receipt does not match its date target.');
  }

  return {
    operationId: String(raw.operationId || '').trim(),
    entryType: entryType,
    payee: payee,
    entryDate: Utilities.formatDate(entryDate, Session.getScriptTimeZone(), 'yyyy-MM-dd'),
    previousValue: previousValue,
    newValue: newValue,
    signedAmount: signedAmount,
    cashFlowSheet: expectedSheet,
    cashFlowMonth: expectedMonth
  };
}

/** Two-decimal money equality with a half-cent tolerance. */
function quickAddMoneyEquals_(left, right) {
  return Math.abs(round2_(left) - round2_(right)) < 0.005;
}

/**
 * Pure decision seam used by the UI guard and disposable regression harness.
 */
function classifyQuickAddWriteState_(currentValue, previousValue, expectedValue) {
  if (quickAddMoneyEquals_(currentValue, expectedValue)) return 'MATCH';
  if (quickAddMoneyEquals_(currentValue, previousValue)) return 'REVERTED_TO_PREVIOUS';
  return 'CHANGED_TO_OTHER';
}

/** Locate and read the canonical cell described by a validated receipt. */
function inspectQuickAddWriteInSpreadsheet_(ss, receipt) {
  var sheet = ss.getSheetByName(receipt.cashFlowSheet);
  if (!sheet) {
    return {
      status: 'TARGET_MISSING',
      currentValue: null,
      receipt: receipt,
      message: 'Cash Flow sheet is missing.'
    };
  }

  var rowInfo = findCashFlowRowByTypeAndPayee_(sheet, receipt.entryType, receipt.payee);
  if (!rowInfo) {
    return {
      status: 'TARGET_MISSING',
      currentValue: null,
      receipt: receipt,
      message: 'Cash Flow payee row is missing.'
    };
  }

  var entryDate = parseIsoDateLocal_(receipt.entryDate);
  var monthCol = getMonthColumnByDate_(sheet, entryDate, 1);
  var currentValue = round2_(toNumber_(sheet.getRange(rowInfo.row, monthCol).getValue()));

  return {
    status: classifyQuickAddWriteState_(
      currentValue,
      receipt.previousValue,
      receipt.newValue
    ),
    currentValue: currentValue,
    receipt: receipt,
    row: rowInfo.row,
    column: monthCol,
    sheet: sheet
  };
}

/** Shape an inspection result for the browser without returning Sheet objects. */
function quickAddWriteResultForClient_(inspection) {
  var receipt = inspection.receipt || {};
  return {
    operationId: receipt.operationId || '',
    status: inspection.status,
    entryType: receipt.entryType || '',
    payee: receipt.payee || '',
    entryDate: receipt.entryDate || '',
    cashFlowSheet: receipt.cashFlowSheet || '',
    cashFlowMonth: receipt.cashFlowMonth || '',
    previousValue: receipt.previousValue,
    expectedValue: receipt.newValue,
    currentValue: inspection.currentValue,
    message: inspection.message || ''
  };
}

/**
 * PUBLIC, READ-ONLY: recheck recent browser-held Quick Add receipts. Receipts
 * remain client-session state; this endpoint only resolves and reads their
 * canonical Cash Flow cells.
 */
function verifyQuickAddPaymentWrites(receipts) {
  if (!Array.isArray(receipts)) return [];
  var ss = getUserSpreadsheet_();
  return receipts.slice(0, 10).map(function(raw) {
    try {
      var receipt = normalizeQuickAddWriteReceipt_(raw);
      return quickAddWriteResultForClient_(inspectQuickAddWriteInSpreadsheet_(ss, receipt));
    } catch (e) {
      return {
        operationId: String(raw && raw.operationId || '').trim(),
        status: 'INVALID_RECEIPT',
        message: e && e.message ? e.message : String(e)
      };
    }
  });
}

/**
 * Workbook-scoped compare-and-set correction seam. This SETS the already
 * recorded expected value only when the cell still equals its pre-save value.
 * It never adds the amount and never appends another Activity row.
 */
function restoreQuickAddPaymentWriteInSpreadsheet_(ss, rawReceipt) {
  var receipt = normalizeQuickAddWriteReceipt_(rawReceipt);
  var before = inspectQuickAddWriteInSpreadsheet_(ss, receipt);

  if (before.status === 'MATCH') {
    var already = quickAddWriteResultForClient_(before);
    already.status = 'MATCH';
    already.message = 'The recorded amount is already present.';
    return already;
  }
  if (before.status !== 'REVERTED_TO_PREVIOUS') {
    var refused = quickAddWriteResultForClient_(before);
    refused.status = 'RESTORE_REFUSED';
    refused.message = 'The cell contains a different newer value, so CashCompass did not overwrite it.';
    return refused;
  }

  before.sheet.getRange(before.row, before.column).setValue(receipt.newValue);
  SpreadsheetApp.flush();

  var after = inspectQuickAddWriteInSpreadsheet_(ss, receipt);
  var result = quickAddWriteResultForClient_(after);
  if (after.status === 'MATCH') {
    result.status = 'RESTORED';
    result.message = 'Recorded amount restored. No duplicate Activity entry was created.';
  } else {
    result.status = 'RESTORE_NOT_CONFIRMED';
    result.message = 'The restore was immediately changed again. Finish or cancel the open spreadsheet edit and retry.';
  }
  return result;
}

/**
 * PUBLIC, GUARDED WRITE: repair a late client-edit overwrite without replaying
 * quickAddPayment(). A per-user lock serializes CashCompass calls; the strict
 * compare-and-set check protects a legitimate newer spreadsheet value.
 */
function restoreQuickAddPaymentWrite(receipt) {
  var lock = LockService.getUserLock();
  lock.waitLock(5000);
  try {
    var result = restoreQuickAddPaymentWriteInSpreadsheet_(getUserSpreadsheet_(), receipt);
    if (result.status === 'RESTORED') {
      touchDashboardSourceUpdated_('quick_payment');
      touchDashboardSourceUpdated_('cash_flow');
    }
    return result;
  } finally {
    lock.releaseLock();
  }
}

/**
 * For Expense quick payments whose payee matches INPUT - Debts (normalized name),
 * reduce Account Balance by the payment amount, floored at 0.
 * Skips Type Loan and HELOC (payment vs principal rules differ; revisit later).
 */
function adjustDebtsBalanceAfterQuickPayment_(ss, payee, entryType, paymentAmount) {
  if (entryType !== 'Expense') return null;

  const normPayee = normalizeBillName_(payee);

  // Blank-workbook safety: on a fresh sheet INPUT - Debts does not exist yet
  // and getSheet_() would throw "Missing sheet: INPUT - Debts" after a
  // successful Cash Flow write. Returning null matches this function's
  // existing "nothing to adjust" contract (no matching row / missing balance
  // column / non-Expense), so the caller's optional debtBalanceNote branch
  // is skipped cleanly. The populated path below is unchanged.
  if (!ss.getSheetByName(getSheetNames_().DEBTS)) return null;

  const debtSheet = getSheet_(ss, 'DEBTS');
  const headerMap = getDebtsHeaderMap_(debtSheet);
  if (headerMap.balanceCol === -1) return null;

  const display = debtSheet.getDataRange().getDisplayValues();
  const values = debtSheet.getDataRange().getValues();

  for (let r = 1; r < display.length; r++) {
    const name = String(display[r][headerMap.nameColZero] || '').trim();
    if (!name || isDebtSummaryRowName_(name)) continue;
    if (normalizeBillName_(name) !== normPayee) continue;

    // Skip debts that have been soft-deleted via Stop tracking. Using the
    // shared row-level rule keeps legacy workbooks (no Active column) behaving
    // like before via the balance/minimum-payment fallback.
    if (isDebtRowInactive_(display[r], values[r], headerMap)) continue;

    const dType = String(display[r][headerMap.typeColZero] || '').trim();
    if (isDebtTypeLoanOrHeloc_(dType)) {
      // Matched a tracked Loan/HELOC. We intentionally do NOT touch the
      // balance here (Loan/HELOC payments may include interest, escrow, or
      // fees, so the payment amount is not a clean principal reduction).
      // Return an info-only marker — no balance write, no INPUT - Debts
      // mutation — so the caller can surface a one-time UX explanation.
      return { loanOrHelocSkipped: true, debtType: dType };
    }

    const curBal = round2_(toNumber_(values[r][headerMap.balanceColZero]));
    const newBal = Math.max(0, round2_(curBal - paymentAmount));
    const targetRow = r + 1;
    const targetCol = headerMap.balanceCol;

    setCurrencyCellPreserveRowFormat_(debtSheet, targetRow, targetCol, newBal, 1);

    recalcDebtPctAvailForRow_(debtSheet, targetRow, {
      creditLimitCol: headerMap.creditLimitColZero,
      creditLeftCol: headerMap.creditLeftColZero,
      balanceCol: headerMap.balanceColZero,
      pctAvailCol: headerMap.pctAvailColZero
    });

    touchDashboardSourceUpdated_('debts');

    return {
      previousBalance: curBal,
      newBalance: newBal
    };
  }

  return null;
}

function isDebtTypeLoanOrHeloc_(typeStr) {
  const t = String(typeStr || '').trim().toLowerCase();
  return t === 'loan' || t === 'heloc';
}

/**
 * Server-side Flow Source fallback for freshly-created Cash Flow Expense rows.
 *
 * Mirrors the Payment Source inference used by the Bills dashboard readers
 * (`getInputBillsDueRows_` / `getDebtBillsDueRows_`) so a new row ends up with
 * the same Flow Source the user would see on the Bills page:
 *
 *   1. INPUT - Bills: look up the row by normalized payee name and use its
 *      `Payment Source` column if present and valid (CASH | CREDIT_CARD).
 *   2. INPUT - Debts: look up the row by normalized Account Name and infer
 *      CREDIT_CARD for `Type = Credit Card`, CASH otherwise.
 *   3. No match: return '' so legacy behavior (blank Flow Source) is kept.
 *
 * Silent try/catch on each sheet read — this is a best-effort enrichment
 * and must never block the primary Cash Flow write. A missing INPUT - Bills
 * / INPUT - Debts sheet just falls through to the next step.
 *
 * Only called for `entryType === 'Expense'` AND only when we're about to
 * create a brand-new Cash Flow row. Existing rows are never touched by this
 * helper — that keeps this behavior additive and audit-friendly.
 */
function resolveFlowSourceFromBillOrDebt_(ss, payee) {
  const normalizedPayee = normalizeBillName_(payee);
  if (!normalizedPayee) return '';

  // Case-insensitive header match — some workbooks ship `INPUT - Bills` with
  // ALL-CAPS headers (e.g. "PAYMENT SOURCE") and a naive indexOf would miss
  // the column, leaving Flow Source blank on every created Cash Flow row.
  const findHeaderIdx = function (headers, label) {
    const want = String(label || '').trim().toLowerCase();
    for (let i = 0; i < headers.length; i++) {
      if (String(headers[i] || '').trim().toLowerCase() === want) return i;
    }
    return -1;
  };

  try {
    const billsSheet = getSheet_(ss, 'BILLS');
    const display = billsSheet.getDataRange().getDisplayValues();
    if (display && display.length >= 2) {
      const headers = display[0] || [];
      const payeeCol = findHeaderIdx(headers, 'Payee');
      const sourceCol = findHeaderIdx(headers, 'Payment Source');
      const activeCol = findHeaderIdx(headers, 'Active');

      if (payeeCol !== -1 && sourceCol !== -1) {
        // Prefer the first active match so deactivated rows don't bleed into
        // a live payment; fall back to any match if no active row exists.
        let activeMatch = '';
        let anyMatch = '';

        for (let r = 1; r < display.length; r++) {
          const rowPayee = String(display[r][payeeCol] || '').trim();
          if (!rowPayee) continue;
          if (normalizeBillName_(rowPayee) !== normalizedPayee) continue;

          const rawSource = String(display[r][sourceCol] || '').trim();
          if (!rawSource) continue;

          let canonical;
          try {
            canonical = normalizeFlowSource_(rawSource);
          } catch (e) {
            // Typo in the sheet — skip it rather than poison the Cash Flow row.
            continue;
          }
          if (!canonical) continue;

          const active = activeCol === -1 ? 'yes' : normalizeYesNo_(display[r][activeCol]);
          if (active === 'yes' && !activeMatch) {
            activeMatch = canonical;
            break;
          }
          if (!anyMatch) anyMatch = canonical;
        }

        if (activeMatch) return activeMatch;
        if (anyMatch) return anyMatch;
      }
    }
  } catch (e) {
    Logger.log('resolveFlowSourceFromBillOrDebt_ bills lookup: ' + e);
  }

  try {
    const debtsSheet = getSheet_(ss, 'DEBTS');
    const display = debtsSheet.getDataRange().getDisplayValues();
    if (display && display.length >= 2) {
      const headers = display[0] || [];
      const nameCol = findHeaderIdx(headers, 'Account Name');
      const typeCol = findHeaderIdx(headers, 'Type');
      const activeColDebt = findHeaderIdx(headers, 'Active');

      if (nameCol !== -1) {
        for (let r = 1; r < display.length; r++) {
          const rowName = String(display[r][nameCol] || '').trim();
          if (!rowName) continue;
          if (rowName.toUpperCase() === 'TOTAL DEBT') continue;
          if (normalizeBillName_(rowName) !== normalizedPayee) continue;

          // Skip stop-tracked debts so inactive rows don't poison the
          // Flow Source inference for live payments. Blank / missing Active
          // still means active, matching the shared debt rule. Routes through
          // the canonical isDebtInactive_ (ALWAYS_ACTIVE legacy mode) —
          // behavior-identical to the previous inline explicit check.
          if (isDebtInactive_({
            hasActiveColumn: activeColDebt !== -1,
            activeCellRaw: activeColDebt !== -1 ? display[r][activeColDebt] : '',
            legacyFallback: DEBT_LEGACY_FALLBACK_.ALWAYS_ACTIVE
          })) {
            continue;
          }

          const dType = typeCol === -1 ? '' : display[r][typeCol];
          return isDebtCreditCardType_(dType) ? 'CREDIT_CARD' : 'CASH';
        }
      }
    }
  } catch (e) {
    Logger.log('resolveFlowSourceFromBillOrDebt_ debts lookup: ' + e);
  }

  return '';
}

/**
 * Locate an existing Cash Flow row by the CANONICAL uniqueness key —
 * Type + Payee — comparing case-insensitively and trimmed. Flow Source is
 * deliberately NOT part of the key: it is per-row metadata (CASH /
 * CREDIT_CARD), so "Rent" must resolve to a single Expense row regardless of
 * its Flow Source, and "Robinhood" / "robinhood" / "Robinhood " must all
 * resolve to the same row rather than spawning duplicates. Returns
 * `{ row }` (1-based) or null. This is the shared finder used by Quick Add,
 * Bills, Debts, and the insert choke point.
 */
function findCashFlowRowByTypeAndPayee_(sheet, entryType, payee) {
  const values = sheet.getDataRange().getDisplayValues();
  if (values.length < 2) return null;

  const headerMap = getCashFlowHeaderMap_(sheet);
  const wantType = String(entryType == null ? '' : entryType).trim().toLowerCase();
  const wantPayee = String(payee == null ? '' : payee).trim().toLowerCase();

  for (let r = 1; r < values.length; r++) {
    const rowType = String(values[r][headerMap.typeColZero] || '').trim().toLowerCase();
    const rowPayee = String(values[r][headerMap.payeeColZero] || '').trim().toLowerCase();

    if (rowType === wantType && rowPayee === wantPayee) {
      return { row: r + 1 };
    }
  }

  return null;
}

/**
 * Stamp a clean canonical body-row format onto a freshly inserted Cash Flow
 * row. Used when a row is inserted directly under the header (first Income),
 * where Google Sheets would otherwise copy the header's yellow fill, bold
 * weight, 16pt font and @STRING@ month formats onto the data row.
 *
 * It resets fill to white, weight to normal and font size to the canonical
 * 14pt body size, resets the inherited header CENTER alignment to Golden
 * ledger alignment (metadata/text columns LEFT — so "Flow Source" values like
 * CREDIT_CARD sit left — and month + Total currency columns RIGHT), and
 * re-applies the currency number format to the month + Total columns so
 * entered amounts stay NUMERIC (a text-formatted month cell would silently
 * drop out of the Summary SUMIFs). Row text color (Income green / Expense red)
 * is left to the sheet's Type-keyed conditional-format rules, so no font color
 * is set here. All operations are best-effort — a cosmetic failure must never
 * break the row write.
 */
function stampCashFlowBodyRowFormat_(sheet, row) {
  const lastCol = sheet.getLastColumn();
  const range = sheet.getRange(row, 1, 1, lastCol);
  try { range.setBackground(null); } catch (_) { /* cosmetic */ }
  try { range.setFontWeight('normal'); } catch (_) { /* cosmetic */ }
  try { range.setFontSize(CANON_FONT_BODY_); } catch (_) { /* cosmetic */ }

  let layout = null;
  try {
    if (typeof detectCashFlowLayout_ === 'function') {
      const headerValues = sheet.getRange(1, 1, 1, lastCol).getDisplayValues()[0] || [];
      layout = detectCashFlowLayout_(headerValues);
    }
  } catch (_layoutErr) { layout = null; }

  // Alignment: a row inserted directly under the header inherits the header's
  // CENTER alignment. Reset to Golden ledger alignment — text columns left,
  // currency (month + Total) columns right.
  try {
    range.setHorizontalAlignment('left');
    if (layout && layout.monthCol0s && layout.monthCol0s.length) {
      for (let i = 0; i < layout.monthCol0s.length; i++) {
        sheet.getRange(row, layout.monthCol0s[i] + 1).setHorizontalAlignment('right');
      }
      if (layout.totalCol0 !== -1) {
        sheet.getRange(row, layout.totalCol0 + 1).setHorizontalAlignment('right');
      }
    }
  } catch (_alignErr) { /* cosmetic */ }

  // Re-apply currency to month + Total columns (correctness, not cosmetic:
  // the inherited header @STRING@ format would turn amounts into text).
  try {
    if (layout && layout.monthCol0s && layout.monthCol0s.length) {
      for (let i = 0; i < layout.monthCol0s.length; i++) {
        sheet.getRange(row, layout.monthCol0s[i] + 1)
          .setNumberFormat('$#,##0.00;[Red]-$#,##0.00');
      }
      if (layout.totalCol0 !== -1) {
        sheet.getRange(row, layout.totalCol0 + 1)
          .setNumberFormat('$#,##0.00;[Red]-$#,##0.00');
      }
    }
  } catch (fmtErr) {
    Logger.log('stampCashFlowBodyRowFormat_ number-format reapply failed: ' + fmtErr);
  }
}

/**
 * Insert a new row into the cash-flow sheet for the given Type + Payee, seeded
 * with an optional Flow Source value. Placement maintains the Golden Workbook
 * block structure automatically:
 *
 *     Income block  →  2 blank rows  →  Expense block  →  2 blank rows  →  Summary
 *
 *   - Rows of the same Type stack contiguously (insert after the last one).
 *   - The first Income drops directly under the header row; because Google
 *     Sheets copies the row-above format onto an inserted row, that new row
 *     would inherit the header's yellow fill / bold / 16pt / @STRING@ month
 *     formats — so we DO NOT copy formatting there and instead stamp a clean
 *     canonical body format (white, normal, 14pt, currency month/total cols).
 *     Data rows therefore never inherit header formatting, and month cells
 *     stay numeric so the Summary SUMIFs pick them up.
 *   - The first Expense lands above Summary and we guarantee two blank rows
 *     between it and Summary so the block structure is preserved.
 *   - Income / Expense text color (green / red) is applied by the first-create
 *     conditional-format rules keyed off the Type column, so new rows color
 *     themselves without any per-row restyling here.
 *
 * `flowSource` is already validated/normalized by the caller (empty allowed).
 * When the column isn't present on legacy year tabs we silently skip it.
 *
 * Choke-point guarantees (every Cash Flow row-creation path funnels through
 * here — Quick Add, Bills, Debts, Income sources):
 *   - VALIDATION (never create incomplete rows): entryType must be exactly
 *     "Income" or "Expense" and Payee must be non-empty. Callers already
 *     validate upstream; this is the last line of defense so no edge path can
 *     drop a blank/incomplete row onto the sheet.
 *   - UNIQUENESS (never create duplicates): the canonical key is Type + Payee
 *     (case-insensitive, trimmed; Flow Source is metadata, not identity). If a
 *     matching row already exists we RETURN it instead of inserting, making
 *     row creation idempotent on the canonical key regardless of caller.
 */
function insertCashFlowRow_(sheet, entryType, payee, flowSource) {
  if (!sheet.getDataRange().getDisplayValues().length) {
    throw new Error('Cash Flow sheet is empty.');
  }

  // Normalize + validate BEFORE any sheet mutation (Issue 3: no blank /
  // incomplete rows). Reassign the params so the rest of the function writes
  // the trimmed values.
  entryType = String(entryType == null ? '' : entryType).trim();
  payee = String(payee == null ? '' : payee).trim();
  if (entryType !== 'Income' && entryType !== 'Expense') {
    throw new Error(
      'insertCashFlowRow_: entryType must be "Income" or "Expense" (got "' + entryType + '").'
    );
  }
  if (!payee) {
    throw new Error('insertCashFlowRow_: a non-empty Payee is required to create a Cash Flow row.');
  }

  // Canonical uniqueness guard (Issue 2): if a Type + Payee row already exists
  // (case-insensitive), return it instead of inserting a duplicate. This makes
  // insertion idempotent at the single choke point, so no caller can create a
  // duplicate Income/Expense row. Existing data is never modified here.
  const existingCanonical = findCashFlowRowByTypeAndPayee_(sheet, entryType, payee);
  if (existingCanonical) {
    return existingCanonical;
  }

  const headerMap = getCashFlowHeaderMap_(sheet);

  // Seed the Summary row up-front so Income / Expense / Summary placement
  // is deterministic. Idempotent — no-op when the row already exists, so
  // this only does work on sheets that predate the Summary-row rollout.
  // We deliberately call this BEFORE scanning for insertion anchors so
  // the scan sees the freshly-seeded Summary row and Expense inserts land
  // just above it. Any failure is non-fatal: the row write below is the
  // contract and must succeed even if summary seeding does not.
  try {
    if (typeof ensureCashFlowSummaryRow_ === 'function') {
      ensureCashFlowSummaryRow_(sheet);
    }
  } catch (summaryErr) {
    Logger.log('insertCashFlowRow_ ensureCashFlowSummaryRow_ failed: ' + summaryErr);
  }

  // Re-read after the ensure call — the Summary row may have been added
  // and the blank separator placed above it, both of which affect the
  // scan below.
  const values = sheet.getDataRange().getDisplayValues();

  let lastSameTypeRow = -1;
  let summaryRow = -1;

  for (let r = 1; r < values.length; r++) {
    const rowType = String(values[r][headerMap.typeColZero] || '').trim();
    const rowPayee = String(values[r][headerMap.payeeColZero] || '').trim();

    if (rowType === 'Summary' && rowPayee === 'Cash Flow Per Month') {
      summaryRow = r + 1;
      break;
    }

    if (rowType === entryType) {
      lastSameTypeRow = r + 1;
    }
  }

  // Placement rules, maintaining the Golden Workbook block structure
  // (Income → 2 blanks → Expense → 2 blanks → Summary):
  //   - Same-type rows exist: stack after the last one so adjacent rows
  //     of the same type stay contiguous (pushes the blanks + Summary
  //     below down together, preserving the gaps).
  //   - Income with no existing Income rows: drop at the top (insert
  //     after the header row) so Income always precedes any Expense /
  //     Summary rows. Without this branch, first Income on a sheet that
  //     already has Expenses would be appended AT THE BOTTOM after the
  //     Expense block, interleaving the two types.
  //   - First Expense with a Summary present: land just above Summary,
  //     then guarantee two blank separator rows between it and Summary
  //     (ensureTwoBlanksBeforeSummary below).
  //   - Anything else: append to the end (legacy sheets pre-Summary).
  let insertAfterRow;
  let ensureTwoBlanksBeforeSummary = false;
  if (lastSameTypeRow !== -1) {
    insertAfterRow = lastSameTypeRow;
  } else if (entryType === 'Income') {
    insertAfterRow = 1; // right after the header row
  } else if (summaryRow > 0) {
    insertAfterRow = summaryRow - 1;
    ensureTwoBlanksBeforeSummary = true;
  } else {
    insertAfterRow = sheet.getLastRow();
  }

  sheet.insertRowAfter(insertAfterRow);
  const newRow = insertAfterRow + 1;

  // Row-format propagation. Two cases:
  //   - Inserted after a data / blank row: copy that row's formatting
  //     (white body, normal weight, 14pt, currency on month/total cols),
  //     then clear its content. Google Sheets also copies the row-above
  //     format automatically, but the explicit copyTo keeps behavior
  //     deterministic across insert positions.
  //   - Inserted after the header row (first Income): the header carries
  //     the yellow fill, bold weight, 16pt font AND @STRING@ month formats.
  //     Copying any of that onto a data row is wrong (bold/yellow look) and
  //     the @STRING@ month format would turn entered amounts into text and
  //     silently break the Summary SUMIFs. Stamp a clean canonical body
  //     format instead so data rows NEVER inherit header formatting.
  if (insertAfterRow !== 1) {
    sheet.getRange(insertAfterRow, 1, 1, sheet.getLastColumn())
      .copyTo(
        sheet.getRange(newRow, 1, 1, sheet.getLastColumn()),
        SpreadsheetApp.CopyPasteType.PASTE_FORMAT,
        false
      );
    sheet.getRange(newRow, 1, 1, sheet.getLastColumn()).clearContent();
  } else {
    stampCashFlowBodyRowFormat_(sheet, newRow);
  }

  // Guarantee two blank separator rows between the first Expense and the
  // Summary row so the block structure matches the Golden Workbook. This is
  // purely additive (inserts blank rows; never moves or rewrites existing
  // data). The trailing Summary-formula refresh below re-locates Summary by
  // label, so shifting it down here is safe.
  if (ensureTwoBlanksBeforeSummary) {
    try {
      sheet.insertRowsAfter(newRow, 2);
    } catch (blankErr) {
      Logger.log('insertCashFlowRow_ blank-separator insert failed: ' + blankErr);
    }
  }

  sheet.getRange(newRow, headerMap.typeCol).setValue(entryType);
  sheet.getRange(newRow, headerMap.payeeCol).setValue(payee);

  if (flowSource && headerMap.flowSourceColZero !== -1) {
    sheet.getRange(newRow, headerMap.flowSourceCol).setValue(flowSource);
  }

  // Seed Active=YES on freshly-created rows when the column exists so the
  // sheet is self-documenting. Blank would be treated as YES by every
  // consumer, but an explicit value avoids user confusion and keeps the
  // HELOC debug output ("active_column_present") meaningful even if the
  // user hasn't manually flagged anything as NO yet.
  if (headerMap.activeColZero !== -1) {
    sheet.getRange(newRow, headerMap.activeCol).setValue('YES');
  }

  // Re-write Summary-row formulas so their bounded range expands to
  // include the newly-inserted data row. writeCashFlowSummaryFormulas_
  // uses `$A$2:$A$<summaryRow-1>`-style bounded ranges (see the comment
  // on that function for why open-ended ranges were abandoned), which
  // means an insert ABOVE Summary shifts the formula cell down but the
  // range upper bound is still the pre-insert last-data-row and won't
  // cover the new row until we rewrite. Best-effort — any failure here
  // is non-fatal; the caller's primary contract is the row write above.
  try {
    const headerValuesNow = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0] || [];
    if (
      typeof detectCashFlowLayout_ === 'function' &&
      typeof findCashFlowSummaryRow_ === 'function' &&
      typeof writeCashFlowSummaryFormulas_ === 'function'
    ) {
      const layoutNow = detectCashFlowLayout_(headerValuesNow);
      const summaryRowNow = findCashFlowSummaryRow_(sheet, sheet.getLastRow(), layoutNow);
      if (summaryRowNow > 0) {
        writeCashFlowSummaryFormulas_(sheet, summaryRowNow, layoutNow);
      }
    }
  } catch (refreshErr) {
    Logger.log('insertCashFlowRow_ summary formula refresh failed: ' + refreshErr);
  }

  return { row: newRow };
}

/**
 * Header-index map for an `INPUT - Cash Flow YYYY` sheet. Flow Source is
 * optional for backward compatibility with legacy year tabs that predate the
 * column — callers MUST branch on `flowSourceColZero !== -1` before reading
 * or writing that column.
 *
 * Type and Payee remain required; if either is missing the sheet is
 * unusable and we fail loudly rather than silently mis-align columns.
 */
function getCashFlowHeaderMap_(sheet) {
  const headers = sheet.getDataRange().getDisplayValues()[0] || [];
  const typeColZero = headers.indexOf('Type');
  const payeeColZero = headers.indexOf('Payee');
  const flowSourceColZero = headers.indexOf('Flow Source');
  // `Active` is optional metadata — YES/NO/blank. Blank is treated as YES
  // by every consumer, so legacy tabs without the column stay valid.
  const activeColZero = headers.indexOf('Active');

  if (typeColZero === -1 || payeeColZero === -1) {
    throw new Error('Cash Flow sheet must contain Type and Payee headers.');
  }

  return {
    typeColZero: typeColZero,
    payeeColZero: payeeColZero,
    flowSourceColZero: flowSourceColZero,
    activeColZero: activeColZero,
    typeCol: typeColZero + 1,
    payeeCol: payeeColZero + 1,
    flowSourceCol: flowSourceColZero === -1 ? -1 : flowSourceColZero + 1,
    activeCol: activeColZero === -1 ? -1 : activeColZero + 1
  };
}

function parseIsoDateLocal_(isoText) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(isoText || '').trim());
  if (!m) {
    throw new Error('Invalid ISO date: ' + isoText);
  }

  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);

  return new Date(year, month - 1, day);
}
