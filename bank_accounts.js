function syncAllAccountsFromLatestCurrentYear_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sourceSheet = getSheet_(ss, 'BANK_ACCOUNTS');
  const targetSheet = getSheet_(ss, 'ACCOUNTS');

  const targetDisplay = targetSheet.getDataRange().getDisplayValues();
  if (targetDisplay.length < 2) {
    throw new Error('Accounts sheet is empty.');
  }

  const targetHeaderMap = getAccountsHeaderMap_(targetSheet);
  const latestMap = getLatestBankAccountValuesForYear_(sourceSheet, getCurrentYear_());

  for (let r = 1; r < targetDisplay.length; r++) {
    const name = String(targetDisplay[r][targetHeaderMap.nameColZero] || '').trim();
    if (!name) continue;

    if (Object.prototype.hasOwnProperty.call(latestMap, name)) {
      setCurrencyCellPreserveRowFormat_(
        targetSheet,
        r + 1,
        targetHeaderMap.balanceCol,
        latestMap[name],
        1
      );
    }
  }
}

function getLatestBankAccountValuesForYear_(sheet, year) {
  const block = getBankAccountsYearBlock_(sheet, year);
  const result = {};

  for (let row = block.dataStartRow; row <= block.dataEndRow; row++) {
    const name = String(sheet.getRange(row, 1).getDisplayValue() || '').trim();
    if (!isBankAccountDataRowName_(name)) continue;

    const latestCol = getLatestNonEmptyMonthColumnForRow_(
      sheet,
      row,
      year,
      block.firstMonthCol,
      block.headerRow
    );

    if (latestCol !== -1) {
      result[name] = round2_(toNumber_(sheet.getRange(row, latestCol).getValue()));
    }
  }

  return result;
}

function getBankAccountUiData() {
  return {
    accounts: getBankAccountsFromHistory_()
  };
}

function getBankAccountsFromHistory_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getSheet_(ss, 'BANK_ACCOUNTS');

  const values = sheet.getDataRange().getDisplayValues();
  const accounts = new Set();

  for (let r = 0; r < values.length; r++) {
    const name = String(values[r][0] || '').trim();
    if (!isBankAccountDataRowName_(name)) continue;
    accounts.add(name);
  }

  return Array.from(accounts).sort();
}

function getBankAccountValueForDate(accountName, balanceDate) {
  const name = String(accountName || '').trim();
  if (!name) throw new Error('Account name is required.');

  const d = parseIsoDateLocal_(balanceDate);

  const year = d.getFullYear();
  const monthValue = getBankAccountHistoryValueForMonth_(name, year, d);
  const accountInfo = getAccountsRowData_(name);

  var previousMonthLabel = '';
  var deltaFromPreviousMonth = null;
  try {
    const prior = new Date(d.getFullYear(), d.getMonth() - 1, 15);
    const priorYear = prior.getFullYear();
    const previousMonthValue = getBankAccountHistoryValueForMonth_(name, priorYear, prior);
    previousMonthLabel = Utilities.formatDate(prior, Session.getScriptTimeZone(), 'MMM-yy');
    const cur = Number(monthValue);
    const prev = Number(previousMonthValue);
    if (!isNaN(cur) && !isNaN(prev)) {
      deltaFromPreviousMonth = round2_(cur - prev);
    }
  } catch (e) {
    /* prior month block/column unavailable */
  }

  return {
    accountName: name,
    selectedMonth: Utilities.formatDate(d, Session.getScriptTimeZone(), 'MMM-yy'),
    selectedMonthValue: monthValue,
    currentBalance: accountInfo ? accountInfo.currentBalance : '',
    availableNow: accountInfo ? accountInfo.availableNow : '',
    minBuffer: accountInfo ? accountInfo.minBuffer : '',
    type: accountInfo ? accountInfo.type : '',
    usePolicy: accountInfo ? accountInfo.usePolicy : '',
    previousMonthLabel: previousMonthLabel,
    deltaFromPreviousMonth: deltaFromPreviousMonth
  };
}

function getBankAccountHistoryValueForMonth_(accountName, year, balanceDate) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getSheet_(ss, 'BANK_ACCOUNTS');
  const block = getBankAccountsYearBlock_(sheet, year);

  const accountRow = findBankAccountRowInBlock_(sheet, block, accountName);
  if (accountRow === -1) {
    throw new Error('Could not find account "' + accountName + '" inside Year ' + year + ' block.');
  }

  const monthCol = getMonthColumnByDate_(sheet, balanceDate, block.headerRow);
  return round2_(toNumber_(sheet.getRange(accountRow, monthCol).getValue()));
}

function updateBankAccountValueByDate(payload) {
  validateRequired_(payload, ['accountName', 'balanceDate', 'currentValue']);

  const accountName = String(payload.accountName || '').trim();
  const balanceDate = parseIsoDateLocal_(payload.balanceDate);
  const currentValue = toNumber_(payload.currentValue);

  const updateAvailableNow = !!payload.updateAvailableNow;
  const updateMinBuffer = !!payload.updateMinBuffer;

  if (!accountName) throw new Error('Account name is required.');

  const year = balanceDate.getFullYear();

  updateBankAccountsHistory_(accountName, year, balanceDate, currentValue);
  syncAllAccountsFromLatestCurrentYear_();
  touchDashboardSourceUpdated_('bank_accounts');

  if (updateAvailableNow || updateMinBuffer) {
    updateAccountsSheetFields_(accountName, {
      availableNow: updateAvailableNow ? currentValue : null,
      minBuffer: updateMinBuffer ? currentValue : null
    });
  }

  if (typeof runDebtPlanner === 'function') runDebtPlanner();

  return {
    ok: true,
    message:
      'Bank account updated and synced.\n' +
      'Available Now updated: ' + (updateAvailableNow ? 'Yes' : 'No') + '\n' +
      'Min Buffer updated: ' + (updateMinBuffer ? 'Yes' : 'No')
  };
}

function updateBankAccountsHistory_(accountName, year, balanceDate, currentValue) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getSheet_(ss, 'BANK_ACCOUNTS');
  const block = getBankAccountsYearBlock_(sheet, year);

  const accountRow = findBankAccountRowInBlock_(sheet, block, accountName);
  if (accountRow === -1) {
    throw new Error('Could not find account "' + accountName + '" inside Year ' + year + ' block.');
  }

  const monthCol = getMonthColumnByDate_(sheet, balanceDate, block.headerRow);
  setCurrencyCellPreserveRowFormat_(sheet, accountRow, monthCol, currentValue, block.firstMonthCol);
}

function getAccountsRowData_(accountName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getSheet_(ss, 'ACCOUNTS');

  const values = sheet.getDataRange().getValues();
  const display = sheet.getDataRange().getDisplayValues();

  if (display.length < 2) return null;

  const headerMap = getAccountsHeaderMap_(sheet);

  for (let r = 1; r < display.length; r++) {
    if (String(display[r][headerMap.nameColZero] || '').trim() === accountName) {
      return {
        currentBalance: headerMap.balanceColZero === -1 ? '' : round2_(toNumber_(values[r][headerMap.balanceColZero])),
        availableNow: headerMap.availableColZero === -1 ? '' : round2_(toNumber_(values[r][headerMap.availableColZero])),
        minBuffer: headerMap.bufferColZero === -1 ? '' : round2_(toNumber_(values[r][headerMap.bufferColZero])),
        type: headerMap.typeColZero === -1 ? '' : String(display[r][headerMap.typeColZero] || '').trim(),
        usePolicy: headerMap.policyColZero === -1 ? '' : String(display[r][headerMap.policyColZero] || '').trim()
      };
    }
  }

  return null;
}

function updateAccountsSheetFields_(accountName, options) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getSheet_(ss, 'ACCOUNTS');
  const display = sheet.getDataRange().getDisplayValues();
  const headerMap = getAccountsHeaderMap_(sheet);

  for (let r = 1; r < display.length; r++) {
    if (String(display[r][headerMap.nameColZero] || '').trim() === accountName) {
      if (options.availableNow !== null && options.availableNow !== undefined) {
        if (headerMap.availableCol === -1) {
          throw new Error('Accounts sheet must contain Available Now.');
        }
        setCurrencyCellPreserveRowFormat_(sheet, r + 1, headerMap.availableCol, options.availableNow, 1);
      }

      if (options.minBuffer !== null && options.minBuffer !== undefined) {
        if (headerMap.bufferCol === -1) {
          throw new Error('Accounts sheet must contain Min Buffer.');
        }
        setCurrencyCellPreserveRowFormat_(sheet, r + 1, headerMap.bufferCol, options.minBuffer, 1);
      }

      return;
    }
  }

  throw new Error('Could not find account "' + accountName + '" in Accounts sheet.');
}

function getBankAccountsYearBlock_(sheet, year) {
  const display = sheet.getDataRange().getDisplayValues();

  let yearRow = -1;
  for (let r = 0; r < display.length; r++) {
    const colA = String(display[r][0] || '').trim();
    const colB = String(display[r][1] || '').trim();

    if (colA === 'Year' && colB === String(year)) {
      yearRow = r + 1;
      break;
    }
  }

  if (yearRow === -1) {
    throw new Error('Could not find Year block for ' + year + ' in Bank Accounts.');
  }

  const headerRow = yearRow + 1;
  const headerName = String(sheet.getRange(headerRow, 1).getDisplayValue() || '').trim();
  if (headerName !== 'Account Name') {
    throw new Error('Expected Account Name header row for Year ' + year + ' in Bank Accounts.');
  }

  const dataStartRow = headerRow + 1;
  let dataEndRow = sheet.getLastRow();

  for (let row = dataStartRow; row <= sheet.getLastRow(); row++) {
    const name = String(sheet.getRange(row, 1).getDisplayValue() || '').trim();

    if (name === 'Total Accounts' || name === 'Delta' || name === 'Year') {
      dataEndRow = row - 1;
      break;
    }
  }

  return {
    yearRow: yearRow,
    headerRow: headerRow,
    dataStartRow: dataStartRow,
    dataEndRow: dataEndRow,
    firstMonthCol: 2
  };
}

function findBankAccountRowInBlock_(sheet, block, accountName) {
  for (let row = block.dataStartRow; row <= block.dataEndRow; row++) {
    const name = String(sheet.getRange(row, 1).getDisplayValue() || '').trim();
    if (!isBankAccountDataRowName_(name)) continue;
    if (name === accountName) return row;
  }
  return -1;
}

function isBankAccountDataRowName_(name) {
  const value = String(name || '').trim();
  if (!value) return false;
  if (value === 'Year') return false;
  if (value === 'Account Name') return false;
  if (value === 'Total Accounts') return false;
  if (value === 'Delta') return false;
  return true;
}

function getAccountsHeaderMap_(sheet) {
  const headers = sheet.getDataRange().getDisplayValues()[0] || [];

  const nameColZero = headers.indexOf('Account Name');
  const balanceColZero = headers.indexOf('Current Balance');
  const availableColZero = headers.indexOf('Available Now');
  const bufferColZero = headers.indexOf('Min Buffer');
  const typeColZero = headers.indexOf('Type');
  const policyColZero = headers.indexOf('Use Policy');

  if (nameColZero === -1) {
    throw new Error('Accounts sheet must contain Account Name.');
  }

  return {
    nameColZero: nameColZero,
    balanceColZero: balanceColZero,
    availableColZero: availableColZero,
    bufferColZero: bufferColZero,
    typeColZero: typeColZero,
    policyColZero: policyColZero,
    nameCol: nameColZero + 1,
    balanceCol: balanceColZero === -1 ? -1 : balanceColZero + 1,
    availableCol: availableColZero === -1 ? -1 : availableColZero + 1,
    bufferCol: bufferColZero === -1 ? -1 : bufferColZero + 1,
    typeCol: typeColZero === -1 ? -1 : typeColZero + 1,
    policyCol: policyColZero === -1 ? -1 : policyColZero + 1
  };
}

/**
 * Sums INPUT - Bank Accounts for the prior calendar month (script timezone) for all data rows.
 * Used for dashboard "Total cash" change vs prior month (same pattern as investments).
 */
function getPriorMonthCashTotalFromBankInput_() {
  const tz = Session.getScriptTimeZone();
  const now = new Date();
  const parts = Utilities.formatDate(now, tz, 'yyyy-MM-dd').split('-');
  const curY = parseInt(parts[0], 10);
  const curM = parseInt(parts[1], 10);
  var prevY = curY;
  var prevM = curM - 1;
  if (prevM < 1) {
    prevM = 12;
    prevY -= 1;
  }
  const monthIndexZero = prevM - 1;
  const year = prevY;

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = getSheet_(ss, 'BANK_ACCOUNTS');
    const block = getBankAccountsYearBlock_(sheet, year);
    const refDate = new Date(year, monthIndexZero, 15);
    const monthCol = getMonthColumnByDate_(sheet, refDate, block.headerRow);
    var sum = 0;
    for (var row = block.dataStartRow; row <= block.dataEndRow; row++) {
      var name = String(sheet.getRange(row, 1).getDisplayValue() || '').trim();
      if (!isBankAccountDataRowName_(name)) continue;
      sum += toNumber_(sheet.getRange(row, monthCol).getValue());
    }
    var label = Utilities.formatDate(new Date(year, monthIndexZero, 1), tz, 'MMM yyyy');
    return { total: round2_(sum), label: label };
  } catch (e) {
    return { total: null, label: '' };
  }
}
