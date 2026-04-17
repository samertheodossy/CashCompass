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
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const year = getCurrentYear_();
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
  const ss = SpreadsheetApp.getActiveSpreadsheet();
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

  return {
    sheetName: sheet.getName(),
    month: Utilities.formatDate(entryDate, Session.getScriptTimeZone(), 'MMM-yy'),
    currentValue: currentValue,
    rowExists: !!rowInfo,
    flowSourceColumnPresent: headerMap.flowSourceColZero !== -1,
    existingFlowSource: existingFlowSource,
    priorMonthLabel: priorPreview.priorMonthLabel,
    priorMonthValue: priorPreview.priorMonthValue,
    priorMonthUnavailableMessage: priorPreview.priorMonthUnavailableMessage
  };
}

function quickAddPayment(payload) {
  validateRequired_(payload, ['entryType', 'payee', 'entryDate', 'amount']);

  const entryType = String(payload.entryType || '').trim();
  const payee = String(payload.payee || '').trim();
  const entryDate = parseIsoDateLocal_(payload.entryDate);
  const amount = Math.abs(toNumber_(payload.amount));
  const createIfMissing = !!payload.createIfMissing;
  // Validate up-front so a bad value can't land in the sheet. Blank is allowed
  // (legacy-compatible) and simply skips the Flow Source write below.
  const flowSource = normalizeFlowSource_(payload.flowSource);

  if (!payee) throw new Error('Payee is required.');
  if (isNaN(entryDate.getTime())) throw new Error('Invalid date.');
  if (amount <= 0) throw new Error('Amount must be greater than 0.');
  if (entryType !== 'Expense' && entryType !== 'Income') {
    throw new Error('Type must be Expense or Income.');
  }

  const signedAmount = entryType === 'Expense' ? -amount : amount;
  const year = entryDate.getFullYear();

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getCashFlowSheetForYear_(ss, year);
  const monthCol = getMonthColumnByDate_(sheet, entryDate, 1);
  const headerMap = getCashFlowHeaderMap_(sheet);

  let rowInfo = findCashFlowRowByTypeAndPayee_(sheet, entryType, payee);
  let rowWasCreated = false;

  if (!rowInfo) {
    if (!createIfMissing) {
      throw new Error('Payee row not found. Check "Create row if missing" to add it automatically.');
    }
    rowInfo = insertCashFlowRow_(sheet, entryType, payee, flowSource);
    rowWasCreated = true;
  }

  const targetCell = sheet.getRange(rowInfo.row, monthCol);
  const previousValue = round2_(toNumber_(targetCell.getValue()));

  addCurrencyToCellPreserveRowFormat_(sheet, rowInfo.row, monthCol, signedAmount, 3);

  const newValue = round2_(toNumber_(sheet.getRange(rowInfo.row, monthCol).getValue()));

  // Write Flow Source only when the column exists on this year's tab AND the
  // caller passed a value. For existing rows we only fill a blank cell — we
  // never overwrite a value the user (or a prior call) already set. New rows
  // created by `insertCashFlowRow_` above already got the Flow Source seeded.
  let flowSourceWritten = rowWasCreated && !!flowSource;
  if (
    flowSource &&
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

  const debtBalanceNote = adjustDebtsBalanceAfterQuickPayment_(ss, payee, entryType, amount);

  touchDashboardSourceUpdated_('quick_payment');
  touchDashboardSourceUpdated_('cash_flow');

  const monthLabel = Utilities.formatDate(entryDate, Session.getScriptTimeZone(), 'MMM-yy');
  const entryDateStr = Utilities.formatDate(entryDate, Session.getScriptTimeZone(), 'yyyy-MM-dd');

  var activitySnapshot = {
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

  let message =
    'Saved to Cash Flow.\n' +
    'Sheet: ' + sheet.getName() + '\n' +
    'Month: ' + monthLabel + '\n' +
    'Payee: ' + payee + '\n' +
    'Previous value: ' + fmtCurrency_(previousValue) + '\n' +
    'Change: ' + fmtCurrency_(signedAmount) + '\n' +
    'New value: ' + fmtCurrency_(newValue);

  if (flowSourceWritten) {
    message += '\nFlow Source: ' + flowSource;
  }

  if (debtBalanceNote) {
    message +=
      '\nDebts: Account Balance ' +
      fmtCurrency_(debtBalanceNote.previousBalance) +
      ' → ' +
      fmtCurrency_(debtBalanceNote.newBalance) +
      ' (INPUT - Debts).';
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
      priorMonthUnavailableMessage: priorPreview.priorMonthUnavailableMessage
    },
    message: message,
    activitySnapshot: activitySnapshot
  };
}

/**
 * For Expense quick payments whose payee matches INPUT - Debts (normalized name),
 * reduce Account Balance by the payment amount, floored at 0.
 * Skips Type Loan and HELOC (payment vs principal rules differ; revisit later).
 */
function adjustDebtsBalanceAfterQuickPayment_(ss, payee, entryType, paymentAmount) {
  if (entryType !== 'Expense') return null;

  const normPayee = normalizeBillName_(payee);
  const debtSheet = getSheet_(ss, 'DEBTS');
  const headerMap = getDebtsHeaderMap_(debtSheet);
  if (headerMap.balanceCol === -1) return null;

  const display = debtSheet.getDataRange().getDisplayValues();
  const values = debtSheet.getDataRange().getValues();

  for (let r = 1; r < display.length; r++) {
    const name = String(display[r][headerMap.nameColZero] || '').trim();
    if (!name || isDebtSummaryRowName_(name)) continue;
    if (normalizeBillName_(name) !== normPayee) continue;

    const dType = String(display[r][headerMap.typeColZero] || '').trim();
    if (isDebtTypeLoanOrHeloc_(dType)) return null;

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

function findCashFlowRowByTypeAndPayee_(sheet, entryType, payee) {
  const values = sheet.getDataRange().getDisplayValues();
  if (values.length < 2) return null;

  const headerMap = getCashFlowHeaderMap_(sheet);

  for (let r = 1; r < values.length; r++) {
    const rowType = String(values[r][headerMap.typeColZero] || '').trim();
    const rowPayee = String(values[r][headerMap.payeeColZero] || '').trim();

    if (rowType === entryType && rowPayee === payee) {
      return { row: r + 1 };
    }
  }

  return null;
}

/**
 * Insert a new row into the cash-flow sheet for the given Type + Payee, seeded
 * with an optional Flow Source value. The row is placed immediately after the
 * last existing row of the same Type (or just before the Summary row if there
 * is no prior row of that Type), and inherits the formatting of the row above.
 *
 * `flowSource` is already validated/normalized by the caller (empty allowed).
 * When the column isn't present on legacy year tabs we silently skip it.
 */
function insertCashFlowRow_(sheet, entryType, payee, flowSource) {
  const values = sheet.getDataRange().getDisplayValues();
  if (!values.length) {
    throw new Error('Cash Flow sheet is empty.');
  }

  const headerMap = getCashFlowHeaderMap_(sheet);

  let insertAfterRow = -1;
  let summaryRow = -1;

  for (let r = 1; r < values.length; r++) {
    const rowType = String(values[r][headerMap.typeColZero] || '').trim();
    const rowPayee = String(values[r][headerMap.payeeColZero] || '').trim();

    if (rowType === 'Summary' && rowPayee === 'Cash Flow Per Month') {
      summaryRow = r + 1;
      break;
    }

    if (rowType === entryType) {
      insertAfterRow = r + 1;
    }
  }

  if (insertAfterRow === -1) {
    if (summaryRow > 0) {
      insertAfterRow = summaryRow - 1;
    } else {
      insertAfterRow = sheet.getLastRow();
    }
  }

  sheet.insertRowAfter(insertAfterRow);
  const newRow = insertAfterRow + 1;

  sheet.getRange(insertAfterRow, 1, 1, sheet.getLastColumn())
    .copyTo(
      sheet.getRange(newRow, 1, 1, sheet.getLastColumn()),
      SpreadsheetApp.CopyPasteType.PASTE_FORMAT,
      false
    );

  sheet.getRange(newRow, 1, 1, sheet.getLastColumn()).clearContent();
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