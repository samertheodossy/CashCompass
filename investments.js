function syncAllAssetsFromLatestCurrentYear_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sourceSheet = getSheet_(ss, 'INVESTMENTS');
  const targetSheet = getSheet_(ss, 'ASSETS');

  const targetRaw = targetSheet.getDataRange().getValues();
  const targetDisplay = targetSheet.getDataRange().getDisplayValues();

  if (targetRaw.length < 2) throw new Error('Assets sheet is empty.');

  const targetHeaderMap = getAssetsHeaderMap_(targetSheet);
  const currentYear = getCurrentYear_();
  const latestMap = getLatestInvestmentValuesForYear_(sourceSheet, currentYear);

  for (let r = 1; r < targetRaw.length; r++) {
    const accountName = String(targetDisplay[r][targetHeaderMap.nameColZero] || '').trim();
    if (!accountName) continue;

    if (Object.prototype.hasOwnProperty.call(latestMap, accountName)) {
      setCurrencyCellPreserveRowFormat_(
        targetSheet,
        r + 1,
        targetHeaderMap.balanceCol,
        latestMap[accountName],
        1
      );
    }
  }
}

function getLatestInvestmentValuesForYear_(sheet, year) {
  const block = getInvestmentsYearBlock_(sheet, year);
  const result = {};

  for (let row = block.dataStartRow; row <= block.dataEndRow; row++) {
    const name = String(sheet.getRange(row, 1).getDisplayValue() || '').trim();
    if (!isInvestmentDataRowName_(name)) continue;

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

function getInvestmentUiData() {
  return {
    accounts: getInvestmentsFromHistory_()
  };
}

function getInvestmentsFromHistory_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getSheet_(ss, 'INVESTMENTS');

  const values = sheet.getDataRange().getDisplayValues();
  const accounts = new Set();

  for (let r = 0; r < values.length; r++) {
    const name = String(values[r][0] || '').trim();
    if (!isInvestmentDataRowName_(name)) continue;
    accounts.add(name);
  }

  return Array.from(accounts).sort();
}

function getInvestmentValueForDate(accountName, balanceDate) {
  const name = String(accountName || '').trim();
  if (!name) throw new Error('Account name is required.');

  const d = parseIsoDateLocal_(balanceDate);

  const year = d.getFullYear();
  const monthValue = getInvestmentHistoryValueForMonth_(name, year, d);
  const assetInfo = getAssetRowData_(name);

  return {
    accountName: name,
    selectedMonth: Utilities.formatDate(d, Session.getScriptTimeZone(), 'MMM-yy'),
    selectedMonthValue: monthValue,
    currentBalance: assetInfo ? assetInfo.currentBalance : '',
    type: assetInfo ? assetInfo.type : ''
  };
}

function getInvestmentHistoryValueForMonth_(accountName, year, balanceDate) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getSheet_(ss, 'INVESTMENTS');
  const block = getInvestmentsYearBlock_(sheet, year);

  const accountRow = findInvestmentRowInBlock_(sheet, block, accountName);
  if (accountRow === -1) {
    throw new Error('Could not find investment "' + accountName + '" inside Year ' + year + ' block.');
  }

  const monthCol = getMonthColumnByDate_(sheet, balanceDate, block.headerRow);
  return round2_(toNumber_(sheet.getRange(accountRow, monthCol).getValue()));
}

function updateInvestmentValueByDate(payload) {
  validateRequired_(payload, ['accountName', 'balanceDate', 'currentValue']);

  const accountName = String(payload.accountName || '').trim();
  const balanceDate = parseIsoDateLocal_(payload.balanceDate);
  const currentValue = toNumber_(payload.currentValue);

  if (!accountName) throw new Error('Account name is required.');

  const year = balanceDate.getFullYear();

  updateInvestmentHistory_(accountName, year, balanceDate, currentValue);
  syncAllAssetsFromLatestCurrentYear_();
  touchDashboardSourceUpdated_('investments');

  if (typeof runDebtPlanner === 'function') runDebtPlanner();

  return {
    ok: true,
    message: 'Investment value updated and SYS - Assets synced.'
  };
}

function updateInvestmentHistory_(accountName, year, balanceDate, currentValue) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getSheet_(ss, 'INVESTMENTS');
  const block = getInvestmentsYearBlock_(sheet, year);

  const accountRow = findInvestmentRowInBlock_(sheet, block, accountName);
  if (accountRow === -1) {
    throw new Error('Could not find investment "' + accountName + '" inside Year ' + year + ' block.');
  }

  const monthCol = getMonthColumnByDate_(sheet, balanceDate, block.headerRow);
  setCurrencyCellPreserveRowFormat_(sheet, accountRow, monthCol, currentValue, block.firstMonthCol);
}

function getAssetRowData_(accountName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getSheet_(ss, 'ASSETS');

  const values = sheet.getDataRange().getValues();
  const display = sheet.getDataRange().getDisplayValues();

  if (display.length < 2) return null;

  const headerMap = getAssetsHeaderMap_(sheet);

  for (let r = 1; r < display.length; r++) {
    if (String(display[r][headerMap.nameColZero] || '').trim() === accountName) {
      return {
        type: headerMap.typeColZero === -1 ? '' : String(display[r][headerMap.typeColZero] || '').trim(),
        currentBalance: headerMap.balanceColZero === -1 ? '' : round2_(toNumber_(values[r][headerMap.balanceColZero]))
      };
    }
  }

  return null;
}

function getInvestmentsYearBlock_(sheet, year) {
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
    throw new Error('Could not find Year block for ' + year + ' in INPUT - Investments.');
  }

  const headerRow = yearRow + 1;
  const headerName = String(sheet.getRange(headerRow, 1).getDisplayValue() || '').trim();
  if (headerName !== 'Account Name') {
    throw new Error('Expected Account Name header row for Year ' + year + ' in INPUT - Investments.');
  }

  const dataStartRow = headerRow + 1;
  let dataEndRow = sheet.getLastRow();

  for (let row = dataStartRow; row <= sheet.getLastRow(); row++) {
    const name = String(sheet.getRange(row, 1).getDisplayValue() || '').trim();
    if (name === 'Account Totals' || name === 'Delta' || name === 'Year') {
      dataEndRow = row - 1;
      break;
    }
  }

  return {
    yearRow: yearRow,
    headerRow: headerRow,
    dataStartRow: dataStartRow,
    dataEndRow: dataEndRow,
    firstMonthCol: 3
  };
}

function findInvestmentRowInBlock_(sheet, block, accountName) {
  for (let row = block.dataStartRow; row <= block.dataEndRow; row++) {
    const name = String(sheet.getRange(row, 1).getDisplayValue() || '').trim();
    if (!isInvestmentDataRowName_(name)) continue;
    if (name === accountName) return row;
  }
  return -1;
}

function isInvestmentDataRowName_(name) {
  const value = String(name || '').trim();
  if (!value) return false;
  if (value === 'Year') return false;
  if (value === 'Account Name') return false;
  if (value === 'Account Totals') return false;
  if (value === 'Delta') return false;
  return true;
}

function getAssetsHeaderMap_(sheet) {
  const headers = sheet.getDataRange().getDisplayValues()[0] || [];

  const nameColZero = headers.indexOf('Account Name');
  const typeColZero = headers.indexOf('Type');
  const balanceColZero = headers.indexOf('Current Balance');

  if (nameColZero === -1) {
    throw new Error('SYS - Assets must contain Account Name.');
  }

  if (balanceColZero === -1) {
    throw new Error('SYS - Assets must contain Current Balance.');
  }

  return {
    nameColZero: nameColZero,
    typeColZero: typeColZero,
    balanceColZero: balanceColZero,
    nameCol: nameColZero + 1,
    typeCol: typeColZero === -1 ? -1 : typeColZero + 1,
    balanceCol: balanceColZero + 1
  };
}

/**
 * Sums INPUT - Investments for the prior calendar month (script timezone) for all data rows.
 * Used for dashboard "Total investments" change vs prior month (Option A).
 * Returns { total: number|null, label: string } — total null if year block or month column is missing.
 */
function getPriorMonthInvestmentsTotalFromInput_() {
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
    const sheet = getSheet_(ss, 'INVESTMENTS');
    const block = getInvestmentsYearBlock_(sheet, year);
    const refDate = new Date(year, monthIndexZero, 15);
    const monthCol = getMonthColumnByDate_(sheet, refDate, block.headerRow);
    var sum = 0;
    for (var row = block.dataStartRow; row <= block.dataEndRow; row++) {
      var name = String(sheet.getRange(row, 1).getDisplayValue() || '').trim();
      if (!isInvestmentDataRowName_(name)) continue;
      sum += toNumber_(sheet.getRange(row, monthCol).getValue());
    }
    var label = Utilities.formatDate(new Date(year, monthIndexZero, 1), tz, 'MMM yyyy');
    return { total: round2_(sum), label: label };
  } catch (e) {
    return { total: null, label: '' };
  }
}