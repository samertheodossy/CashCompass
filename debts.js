function getDebtsUiData() {
  const debts = getDebtRows_();
  const typeSet = {};

  debts.forEach(function(d) {
    if (d.type) typeSet[d.type] = true;
  });

  return {
    debts: debts,
    types: ['All'].concat(Object.keys(typeSet).sort()),
    editableFields: [
      'Account Balance',
      'Due Date',
      'Credit Limit',
      'Minimum Payment',
      'Credit Left',
      'Int Rate'
    ]
  };
}

function getDebtRows_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getSheet_(ss, 'DEBTS');

  const display = sheet.getDataRange().getDisplayValues();
  if (display.length < 2) return [];

  const headerMap = getDebtsHeaderMap_(sheet);
  const debts = [];

  for (let r = 1; r < display.length; r++) {
    const name = String(display[r][headerMap.nameColZero] || '').trim();
    const type = String(display[r][headerMap.typeColZero] || '').trim();

    if (!name) continue;
    if (isDebtSummaryRowName_(name)) continue;

    debts.push({
      accountName: name,
      type: type
    });
  }

  return debts.sort(function(a, b) {
    if (a.type !== b.type) return a.type.localeCompare(b.type);
    return a.accountName.localeCompare(b.accountName);
  });
}

function getDebtAccounts_() {
  return getDebtRows_().map(function(d) {
    return d.accountName;
  });
}

function getDebtFieldValue(accountName, fieldName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getSheet_(ss, 'DEBTS');

  const values = sheet.getDataRange().getValues();
  const display = sheet.getDataRange().getDisplayValues();

  if (display.length < 2) throw new Error('INPUT - Debts is empty.');

  const headerMap = getDebtsHeaderMap_(sheet);
  const fieldColZero = getRequiredDebtFieldColZero_(sheet, fieldName);

  const row = findDebtRow_(sheet, accountName);
  if (row === -1) {
    throw new Error('Debt account not found: ' + accountName);
  }

  return {
    accountName: accountName,
    fieldName: fieldName,
    value: values[row - 1][fieldColZero],
    displayValue: display[row - 1][fieldColZero],
    type: headerMap.typeColZero === -1 ? '' : String(display[row - 1][headerMap.typeColZero] || '').trim(),
    pctAvail: headerMap.pctAvailColZero === -1 ? '' : String(display[row - 1][headerMap.pctAvailColZero] || '').trim()
  };
}

function updateDebtField(payload) {
  validateRequired_(payload, ['accountName', 'fieldName', 'value']);

  const accountName = String(payload.accountName || '').trim();
  const fieldName = String(payload.fieldName || '').trim();
  const rawValue = payload.value;

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getSheet_(ss, 'DEBTS');

  const display = sheet.getDataRange().getDisplayValues();
  if (display.length < 2) throw new Error('INPUT - Debts is empty.');

  const headerMap = getDebtsHeaderMap_(sheet);
  const targetRow = findDebtRow_(sheet, accountName);
  if (targetRow === -1) {
    throw new Error('Debt account not found: ' + accountName);
  }

  const targetCol = getRequiredDebtFieldCol_(sheet, fieldName);
  const cell = sheet.getRange(targetRow, targetCol);

  const currencyFields = {
    'Account Balance': true,
    'Minimum Payment': true,
    'Credit Limit': true,
    'Credit Left': true
  };

  const percentFields = {
    'Int Rate': true
  };

  const integerFields = {
    'Due Date': true
  };

  if (currencyFields[fieldName]) {
    const num = toNumber_(rawValue);
    setCurrencyCellPreserveRowFormat_(sheet, targetRow, targetCol, num, 1);
  } else if (percentFields[fieldName]) {
    const num = round2_(toNumber_(rawValue));
    copyNeighborFormatInRow_(sheet, targetRow, targetCol, 1);
    cell.setValue(num);
    cell.setNumberFormat('0.00');
  } else if (integerFields[fieldName]) {
    const num = parseInt(String(rawValue).trim(), 10);
    if (isNaN(num)) throw new Error(fieldName + ' must be a whole number.');
    copyNeighborFormatInRow_(sheet, targetRow, targetCol, 1);
    cell.setValue(num);
    cell.setNumberFormat('0');
  } else {
    copyNeighborFormatInRow_(sheet, targetRow, targetCol, 1);
    cell.setValue(rawValue);
  }

  recalcDebtPctAvailForRow_(sheet, targetRow, {
    creditLimitCol: headerMap.creditLimitColZero,
    creditLeftCol: headerMap.creditLeftColZero,
    balanceCol: headerMap.balanceColZero,
    pctAvailCol: headerMap.pctAvailColZero
  });

  touchDashboardSourceUpdated_('debts');
  if (typeof runDebtPlanner === 'function') runDebtPlanner();

  return {
    ok: true,
    message: 'Debt updated and planner refreshed.'
  };
}

function recalcDebtPctAvailForRow_(sheet, row, cols) {
  if (
    cols.creditLimitCol === -1 ||
    cols.creditLeftCol === -1 ||
    cols.balanceCol === -1 ||
    cols.pctAvailCol === -1
  ) {
    return;
  }

  const creditLimit = toNumber_(sheet.getRange(row, cols.creditLimitCol + 1).getValue());
  const creditLeft = toNumber_(sheet.getRange(row, cols.creditLeftCol + 1).getValue());
  const balance = toNumber_(sheet.getRange(row, cols.balanceCol + 1).getValue());

  let pct = '';
  if (creditLimit > 0) {
    if (!isNaN(creditLeft)) {
      pct = round2_((creditLeft / creditLimit) * 100);
    } else {
      pct = round2_(((creditLimit - balance) / creditLimit) * 100);
    }
  }

  const pctCell = sheet.getRange(row, cols.pctAvailCol + 1);
  copyNeighborFormatInRow_(sheet, row, cols.pctAvailCol + 1, 1);

  if (pct === '') {
    pctCell.setValue('');
  } else {
    pctCell.setValue(pct / 100);
    pctCell.setNumberFormat('0.00%');
  }
}

function getDebtsHeaderMap_(sheet) {
  const headers = sheet.getDataRange().getDisplayValues()[0] || [];

  const nameColZero = headers.indexOf('Account Name');
  const typeColZero = headers.indexOf('Type');
  const balanceColZero = headers.indexOf('Account Balance');
  const dueDateColZero = headers.indexOf('Due Date');
  const creditLimitColZero = headers.indexOf('Credit Limit');
  const minimumPaymentColZero = headers.indexOf('Minimum Payment');
  const creditLeftColZero = headers.indexOf('Credit Left');
  const intRateColZero = headers.indexOf('Int Rate');
  const pctAvailColZero = headers.indexOf('Acct PCT Avail');

  if (nameColZero === -1) throw new Error('INPUT - Debts must contain Account Name.');
  if (typeColZero === -1) throw new Error('INPUT - Debts must contain Type.');

  return {
    nameColZero: nameColZero,
    typeColZero: typeColZero,
    balanceColZero: balanceColZero,
    dueDateColZero: dueDateColZero,
    creditLimitColZero: creditLimitColZero,
    minimumPaymentColZero: minimumPaymentColZero,
    creditLeftColZero: creditLeftColZero,
    intRateColZero: intRateColZero,
    pctAvailColZero: pctAvailColZero,
    nameCol: nameColZero + 1,
    typeCol: typeColZero + 1,
    balanceCol: balanceColZero === -1 ? -1 : balanceColZero + 1,
    dueDateCol: dueDateColZero === -1 ? -1 : dueDateColZero + 1,
    creditLimitCol: creditLimitColZero === -1 ? -1 : creditLimitColZero + 1,
    minimumPaymentCol: minimumPaymentColZero === -1 ? -1 : minimumPaymentColZero + 1,
    creditLeftCol: creditLeftColZero === -1 ? -1 : creditLeftColZero + 1,
    intRateCol: intRateColZero === -1 ? -1 : intRateColZero + 1,
    pctAvailCol: pctAvailColZero === -1 ? -1 : pctAvailColZero + 1
  };
}

function findDebtRow_(sheet, accountName) {
  const headerMap = getDebtsHeaderMap_(sheet);
  const row = findRowByName_(sheet, accountName, headerMap.nameCol, 2);
  if (row === -1) return -1;

  const name = String(sheet.getRange(row, headerMap.nameCol).getDisplayValue() || '').trim();
  if (isDebtSummaryRowName_(name)) return -1;

  return row;
}

function getRequiredDebtFieldColZero_(sheet, fieldName) {
  const headers = sheet.getDataRange().getDisplayValues()[0] || [];
  const colZero = headers.indexOf(fieldName);
  if (colZero === -1) {
    throw new Error('Field not found in INPUT - Debts: ' + fieldName);
  }
  return colZero;
}

function getRequiredDebtFieldCol_(sheet, fieldName) {
  return getRequiredDebtFieldColZero_(sheet, fieldName) + 1;
}

function isDebtSummaryRowName_(name) {
  const value = String(name || '').trim().toUpperCase();
  if (!value) return false;
  return value === 'TOTAL DEBT';
}