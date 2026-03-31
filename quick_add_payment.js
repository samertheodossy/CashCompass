function getQuickAddPaymentUiData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const year = getCurrentYear_();
  const sheet = getCashFlowSheetForYear_(ss, year);

  const values = sheet.getDataRange().getDisplayValues();
  if (values.length < 2) {
    return {
      year: year,
      payees: [],
      types: ['Expense', 'Income']
    };
  }

  const headerMap = getCashFlowHeaderMap_(sheet);

  const rows = [];
  for (let r = 1; r < values.length; r++) {
    const type = String(values[r][headerMap.typeColZero] || '').trim();
    const payee = String(values[r][headerMap.payeeColZero] || '').trim();

    if (!type || !payee) continue;
    if (type === 'Summary') continue;

    rows.push({
      type: type,
      payee: payee
    });
  }

  rows.sort(function(a, b) {
    if (a.type !== b.type) return a.type.localeCompare(b.type);
    return a.payee.localeCompare(b.payee);
  });

  return {
    year: year,
    payees: rows,
    types: ['Expense', 'Income']
  };
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

  const rowInfo = findCashFlowRowByTypeAndPayee_(sheet, entryType, payee);

  let currentValue = '';
  if (rowInfo) {
    currentValue = round2_(toNumber_(sheet.getRange(rowInfo.row, monthCol).getValue()));
  }

  return {
    sheetName: sheet.getName(),
    month: Utilities.formatDate(entryDate, Session.getScriptTimeZone(), 'MMM-yy'),
    currentValue: currentValue,
    rowExists: !!rowInfo
  };
}

function quickAddPayment(payload) {
  validateRequired_(payload, ['entryType', 'payee', 'entryDate', 'amount']);

  const entryType = String(payload.entryType || '').trim();
  const payee = String(payload.payee || '').trim();
  const entryDate = parseIsoDateLocal_(payload.entryDate);
  const amount = Math.abs(toNumber_(payload.amount));
  const createIfMissing = !!payload.createIfMissing;

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

  let rowInfo = findCashFlowRowByTypeAndPayee_(sheet, entryType, payee);

  if (!rowInfo) {
    if (!createIfMissing) {
      throw new Error('Payee row not found. Check "Create row if missing" to add it automatically.');
    }
    rowInfo = insertCashFlowRow_(sheet, entryType, payee);
  }

  const targetCell = sheet.getRange(rowInfo.row, monthCol);
  const previousValue = round2_(toNumber_(targetCell.getValue()));

  addCurrencyToCellPreserveRowFormat_(sheet, rowInfo.row, monthCol, signedAmount, 3);

  const newValue = round2_(toNumber_(sheet.getRange(rowInfo.row, monthCol).getValue()));

  const debtBalanceNote = adjustDebtsBalanceAfterQuickPayment_(ss, payee, entryType, amount);

  touchDashboardSourceUpdated_('quick_payment');
  touchDashboardSourceUpdated_('cash_flow');

  const monthLabel = Utilities.formatDate(entryDate, Session.getScriptTimeZone(), 'MMM-yy');

  let message =
    'Payment added.\n' +
    'Sheet: ' + sheet.getName() + '\n' +
    'Month: ' + monthLabel + '\n' +
    'Payee: ' + payee + '\n' +
    'Previous value: ' + fmtCurrency_(previousValue) + '\n' +
    'Added: ' + fmtCurrency_(signedAmount) + '\n' +
    'New value: ' + fmtCurrency_(newValue);

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
      rowExists: true
    },
    message: message
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

function insertCashFlowRow_(sheet, entryType, payee) {
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

  return { row: newRow };
}

function getCashFlowHeaderMap_(sheet) {
  const headers = sheet.getDataRange().getDisplayValues()[0] || [];
  const typeColZero = headers.indexOf('Type');
  const payeeColZero = headers.indexOf('Payee');

  if (typeColZero === -1 || payeeColZero === -1) {
    throw new Error('Cash Flow sheet must contain Type and Payee headers.');
  }

  return {
    typeColZero: typeColZero,
    payeeColZero: payeeColZero,
    typeCol: typeColZero + 1,
    payeeCol: payeeColZero + 1
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