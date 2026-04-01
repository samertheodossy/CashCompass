function getHouseUiData() {
  return {
    houses: getHousesFromHouseValues_()
  };
}

function getHousesFromHouseValues_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getSheet_(ss, 'HOUSE_VALUES');

  const values = sheet.getDataRange().getDisplayValues();
  const houses = new Set();

  for (let r = 0; r < values.length; r++) {
    const name = String(values[r][0] || '').trim();
    const sub = String(values[r][1] || '').trim();

    if (!isHouseDataRowName_(name, sub)) continue;
    houses.add(name);
  }

  return Array.from(houses).sort();
}

function getHouseValueForDate(house, valuationDate) {
  const houseName = String(house || '').trim();
  if (!houseName) throw new Error('House is required.');

  const d = parseIsoDateLocal_(valuationDate);

  const year = d.getFullYear();
  const monthValue = getHouseValueFromHistoryForMonth_(houseName, year, d);
  const assetsInfo = getHouseAssetRowData_(houseName);

  return {
    house: houseName,
    selectedMonth: Utilities.formatDate(d, Session.getScriptTimeZone(), 'MMM-yy'),
    selectedMonthValue: monthValue,
    currentAssetValue: assetsInfo ? assetsInfo.currentValue : '',
    loanAmountLeft: assetsInfo ? assetsInfo.loanAmountLeft : ''
  };
}

function updateHouseValueByDate(payload) {
  validateRequired_(payload, ['house', 'valuationDate', 'currentValue']);

  const house = String(payload.house || '').trim();
  const valuationDate = parseIsoDateLocal_(payload.valuationDate);
  const currentValue = toNumber_(payload.currentValue);

  if (!house) throw new Error('House is required.');
  if (currentValue <= 0) throw new Error('Current value must be greater than 0.');

  const year = valuationDate.getFullYear();
  const monthLabel = Utilities.formatDate(valuationDate, Session.getScriptTimeZone(), 'MMM-yy');

  const historyUpdated = updateHouseValuesHistory_(house, year, valuationDate, currentValue);

  syncAllHouseAssetsFromLatestCurrentYear_();
  touchDashboardSourceUpdated_('house_values');

  if (typeof runDebtPlanner === 'function') runDebtPlanner();

  return {
    ok: true,
    message:
      'House value updated.\n' +
      'Year block: ' + year + '\n' +
      'Month: ' + monthLabel + '\n' +
      'History updated: ' + (historyUpdated ? 'Yes' : 'No') + '\n' +
      'House Assets refreshed from latest available values for current year: Yes'
  };
}

function updateHouseValuesHistory_(house, year, valuationDate, currentValue) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getSheet_(ss, 'HOUSE_VALUES');
  const block = getHouseValuesYearBlock_(sheet, year);

  const houseRow = findHouseRowInBlock_(sheet, block, house);
  if (houseRow === -1) {
    throw new Error('Could not find house "' + house + '" inside Year ' + year + ' block.');
  }

  const monthCol = getMonthColumnByDate_(sheet, valuationDate, block.headerRow);
  setCurrencyCellPreserveRowFormat_(sheet, houseRow, monthCol, currentValue, block.firstMonthCol);
  return true;
}

function getHouseValueFromHistoryForMonth_(house, year, valuationDate) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getSheet_(ss, 'HOUSE_VALUES');
  const block = getHouseValuesYearBlock_(sheet, year);

  const houseRow = findHouseRowInBlock_(sheet, block, house);
  if (houseRow === -1) {
    throw new Error('Could not find house "' + house + '" inside Year ' + year + ' block.');
  }

  const monthCol = getMonthColumnByDate_(sheet, valuationDate, block.headerRow);
  return round2_(toNumber_(sheet.getRange(houseRow, monthCol).getValue()));
}

function syncAllHouseAssetsFromLatestCurrentYear_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hvSheet = getSheet_(ss, 'HOUSE_VALUES');
  const haSheet = getSheet_(ss, 'HOUSE_ASSETS');

  const haRaw = haSheet.getDataRange().getValues();
  const haDisplay = haSheet.getDataRange().getDisplayValues();

  if (haRaw.length < 2) throw new Error('House Assets sheet is empty.');

  const haHeaderMap = getHouseAssetsHeaderMap_(haSheet);
  const currentYear = getCurrentYear_();
  const latestMap = getLatestHouseValuesForYear_(hvSheet, currentYear);

  for (let r = 1; r < haRaw.length; r++) {
    const house = String(haDisplay[r][haHeaderMap.houseColZero] || '').trim();
    if (!house) continue;

    if (Object.prototype.hasOwnProperty.call(latestMap, house)) {
      setCurrencyCellPreserveRowFormat_(
        haSheet,
        r + 1,
        haHeaderMap.valueCol,
        latestMap[house],
        1
      );
    }
  }
}

function getLatestHouseValuesForYear_(sheet, year) {
  const block = getHouseValuesYearBlock_(sheet, year);
  const result = {};

  for (let row = block.dataStartRow; row <= block.dataEndRow; row++) {
    const name = String(sheet.getRange(row, 1).getDisplayValue() || '').trim();
    const sub = String(sheet.getRange(row, 2).getDisplayValue() || '').trim();

    if (!isHouseDataRowName_(name, sub)) continue;

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

function getHouseAssetRowData_(house) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getSheet_(ss, 'HOUSE_ASSETS');

  const values = sheet.getDataRange().getValues();
  const displayValues = sheet.getDataRange().getDisplayValues();

  if (values.length < 2) return null;

  const headerMap = getHouseAssetsHeaderMap_(sheet);

  for (let r = 1; r < displayValues.length; r++) {
    const rowHouse = String(displayValues[r][headerMap.houseColZero] || '').trim();
    if (rowHouse === house) {
      return {
        loanAmountLeft: headerMap.loanColZero === -1 ? '' : round2_(toNumber_(values[r][headerMap.loanColZero])),
        currentValue: headerMap.valueColZero === -1 ? '' : round2_(toNumber_(values[r][headerMap.valueColZero]))
      };
    }
  }

  return null;
}

function getHouseValuesYearBlock_(sheet, year) {
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
    throw new Error('Could not find Year block for ' + year + ' in House Values.');
  }

  const headerRow = yearRow + 1;
  const headerName = String(sheet.getRange(headerRow, 1).getDisplayValue() || '').trim();
  if (headerName !== 'House') {
    throw new Error('Expected House header row for Year ' + year + ' in House Values.');
  }

  const dataStartRow = headerRow + 1;
  let dataEndRow = sheet.getLastRow();

  for (let row = dataStartRow; row <= sheet.getLastRow(); row++) {
    const name = String(sheet.getRange(row, 1).getDisplayValue() || '').trim();

    if (name === 'Total Values' || name === 'House Assets' || name === 'Year') {
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

function findHouseRowInBlock_(sheet, block, houseName) {
  for (let row = block.dataStartRow; row <= block.dataEndRow; row++) {
    const name = String(sheet.getRange(row, 1).getDisplayValue() || '').trim();
    const sub = String(sheet.getRange(row, 2).getDisplayValue() || '').trim();

    if (!isHouseDataRowName_(name, sub)) continue;
    if (name === houseName) return row;
  }
  return -1;
}

function isHouseDataRowName_(name, sub) {
  const value = String(name || '').trim();
  const subValue = String(sub || '').trim();

  if (!value) return false;
  if (value === 'Year') return false;
  if (value === 'House') return false;
  if (value === 'Total Values') return false;
  if (value === 'House Assets') return false;
  if (value === 'Account Name') return false;
  if (value === 'Delta') return false;
  if (value === 'Total Accounts') return false;
  if (value === 'Loan Amount Left') return false;
  if (value === 'House' && subValue === 'Loan Amount Left') return false;

  return true;
}

function getHouseAssetsHeaderMap_(sheet) {
  const headers = sheet.getDataRange().getDisplayValues()[0] || [];

  const houseColZero = headers.indexOf('House');
  const loanColZero = headers.indexOf('Loan Amount Left');
  const valueColZero = headers.indexOf('Current Value');

  if (houseColZero === -1) {
    throw new Error('House Assets must contain House header.');
  }

  if (valueColZero === -1) {
    throw new Error('House Assets must contain Current Value header.');
  }

  return {
    houseColZero: houseColZero,
    loanColZero: loanColZero,
    valueColZero: valueColZero,
    houseCol: houseColZero + 1,
    loanCol: loanColZero === -1 ? -1 : loanColZero + 1,
    valueCol: valueColZero + 1
  };
}