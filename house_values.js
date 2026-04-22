/* -------------------------------------------------------------------------- */
/*  Safe from-scratch creators (zero-sheet onboarding)                        */
/*                                                                            */
/*  Mirrors the investments.js creators. Both helpers are idempotent          */
/*  no-ops when the sheet already exists. Schema is derived from:             */
/*                                                                            */
/*    - getHouseValuesYearBlock_: Year | <year> on row 1, House header        */
/*      on row 2, firstMonthCol = 3, block terminates at                      */
/*      "Total Values" / "House Assets" / "Year".                             */
/*    - ensureHouseValuesActiveColumnForBlock_: "Active" at col 15            */
/*      (firstMonthCol + 12).                                                 */
/*    - getHouseAssetsHeaderMap_: requires "House" + "Current Value".         */
/*      "Type" / "Loan Amount Left" / "Active" are optional in the reader     */
/*      but the add path writes all four.                                     */
/*                                                                            */
/*  As with the investments creator, aggregate rows ("Total Values",          */
/*  "House Assets") are intentionally NOT seeded — current logic does         */
/*  not require them.                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Canonical from-scratch creator for `INPUT - House Values`.
 *
 * Safety contract: idempotent no-op when the sheet already exists. Never
 * overwrites or re-styles populated sheets.
 *
 * Canonical structure written only on first creation:
 *   Row 1:   Year | <currentYear>                       (orange banner)
 *   Row 2:   House | Loan Amount Left | Jan-YY | Feb-YY  (yellow banner)
 *            | … | Dec-YY | Active                     (cols 1..15)
 *   Data:    (none — addHouseFromDashboard inserts on write)
 *
 * @returns {GoogleAppsScript.Spreadsheet.Sheet}
 */
function ensureInputHouseValuesSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const names = getSheetNames_();
  const sheetName = names.HOUSE_VALUES;

  const existing = ss.getSheetByName(sheetName);
  if (existing) return existing;

  let sheet;
  try {
    sheet = ss.insertSheet(sheetName);
  } catch (e) {
    const racedSheet = ss.getSheetByName(sheetName);
    if (racedSheet) return racedSheet;
    throw e;
  }

  const year = (typeof getCurrentYear_ === 'function')
    ? getCurrentYear_()
    : new Date().getFullYear();
  const yy = String(year).slice(-2);
  const monthLabels = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];

  sheet.getRange(1, 1, 1, 2).setValues([['Year', year]]);

  // Col 1 House, col 2 Loan Amount Left, cols 3..14 the 12 MMM-YY month
  // columns (firstMonthCol = 3), col 15 Active.
  const headers = ['House', 'Loan Amount Left'];
  for (let i = 0; i < monthLabels.length; i++) {
    headers.push(monthLabels[i] + '-' + yy);
  }
  headers.push('Active');
  sheet.getRange(2, 1, 1, headers.length).setValues([headers]);

  try {
    applyHouseValuesSheetStyling_(sheet);
  } catch (_styleErr) { /* cosmetic only */ }

  try {
    sheet.setFrozenRows(2);
  } catch (_frozenErr) { /* cosmetic only */ }

  try {
    sheet.autoResizeColumns(1, headers.length);
  } catch (_resizeErr) { /* cosmetic only */ }

  return sheet;
}

/**
 * Canonical from-scratch creator for `SYS - House Assets`.
 *
 * Flat 5-column table consumed by getHouseAssetsHeaderMap_ (requires
 * "House" + "Current Value"; "Type" / "Loan Amount Left" / "Active" are
 * optional in the reader but the add path writes all five).
 *
 * Safety contract: idempotent no-op when the sheet already exists.
 *
 * @returns {GoogleAppsScript.Spreadsheet.Sheet}
 */
function ensureSysHouseAssetsSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const names = getSheetNames_();
  const sheetName = names.HOUSE_ASSETS;

  const existing = ss.getSheetByName(sheetName);
  if (existing) return existing;

  let sheet;
  try {
    sheet = ss.insertSheet(sheetName);
  } catch (e) {
    const racedSheet = ss.getSheetByName(sheetName);
    if (racedSheet) return racedSheet;
    throw e;
  }

  const headers = ['House', 'Type', 'Loan Amount Left', 'Current Value', 'Active'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  // Pre-format the two money columns on data rows only — bounded to
  // sheet.getMaxRows(), consistent with the rest of the workbook.
  try {
    const maxRowsHA = sheet.getMaxRows();
    if (maxRowsHA > 1) {
      sheet.getRange(2, 3, maxRowsHA - 1, 1)
        .setNumberFormat('$#,##0.00;-$#,##0.00');
      sheet.getRange(2, 4, maxRowsHA - 1, 1)
        .setNumberFormat('$#,##0.00;-$#,##0.00');
    }
  } catch (_fmtErr) { /* cosmetic only */ }

  try {
    applyHouseAssetsSheetStyling_(sheet);
  } catch (_styleErr) { /* cosmetic only */ }

  try {
    sheet.autoResizeColumns(1, headers.length);
  } catch (_resizeErr) { /* cosmetic only */ }

  return sheet;
}

function getHouseUiData() {
  // Blank-workbook safety: on a fresh sheet INPUT - House Values does
  // not exist yet and getHousesFromHouseValues_() -> getSheet_() would
  // throw a red banner on the House Values page. Return the same shape
  // with empty lists so the page renders clean. The populated path
  // below is unchanged.
  const ssEarly = SpreadsheetApp.getActiveSpreadsheet();
  if (!ssEarly.getSheetByName(getSheetNames_().HOUSE_VALUES)) {
    return { houses: [], propertyTypeOptions: [] };
  }

  var propertyTypeOpts = [];
  try {
    propertyTypeOpts = getHouseAssetsDistinctColumnValues_('Type');
  } catch (e) {
    Logger.log('getHouseUiData propertyType options: ' + e);
  }

  let inactive = Object.create(null);
  try {
    inactive = getInactiveHousesSet_();
  } catch (e) {
    Logger.log('getHouseUiData inactive filter: ' + e);
  }

  // Selectors only surface currently-active houses. History storage
  // (INPUT - House Values, SYS rows, HOUSES sheets) is untouched.
  const allHouses = getHousesFromHouseValues_();
  const activeHouses = allHouses.filter(function(name) {
    return !inactive[String(name || '').toLowerCase()];
  });

  return {
    houses: activeHouses,
    propertyTypeOptions: propertyTypeOpts
  };
}

/**
 * Returns an object map keyed by lowercase house name for houses whose
 * Active column on SYS - House Assets is explicitly marked "No" / "n" /
 * "false" / "inactive". Blank, missing, or unrecognized values are treated
 * as active (backward compatibility for rows created before Active existed).
 */
function getInactiveHousesSet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getSheet_(ss, 'HOUSE_ASSETS');
  const display = sheet.getDataRange().getDisplayValues();
  const inactive = Object.create(null);
  if (display.length < 2) return inactive;

  let headerMap;
  try {
    headerMap = getHouseAssetsHeaderMap_(sheet);
  } catch (e) {
    return inactive;
  }
  if (headerMap.activeColZero === -1) return inactive;

  for (let r = 1; r < display.length; r++) {
    const name = String(display[r][headerMap.houseColZero] || '').trim();
    if (!name) continue;
    const raw = String(display[r][headerMap.activeColZero] || '').trim().toLowerCase();
    if (raw === 'no' || raw === 'n' || raw === 'false' || raw === 'inactive') {
      inactive[name.toLowerCase()] = true;
    }
  }
  return inactive;
}

/**
 * Distinct non-empty values from a column on SYS - House Assets.
 * Used to populate the property-type datalist on the Add New House form.
 * @param {string} headerLabel e.g. "Type"
 * @returns {string[]}
 */
function getHouseAssetsDistinctColumnValues_(headerLabel) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getSheet_(ss, 'HOUSE_ASSETS');
  const display = sheet.getDataRange().getDisplayValues();
  if (!display.length) return [];

  const headers = display[0];
  const idx = headers.indexOf(headerLabel);
  if (idx === -1) return [];

  const found = {};
  for (let r = 1; r < display.length; r++) {
    const cell = String(display[r][idx] || '').trim();
    if (cell) found[cell] = true;
  }

  return Object.keys(found).sort(function(a, b) {
    return a.localeCompare(b);
  });
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

  var previousMonthLabel = '';
  var deltaFromPreviousMonth = null;
  try {
    const prior = new Date(d.getFullYear(), d.getMonth() - 1, 15);
    const priorYear = prior.getFullYear();
    const previousMonthValue = getHouseValueFromHistoryForMonth_(houseName, priorYear, prior);
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
    house: houseName,
    selectedMonth: Utilities.formatDate(d, Session.getScriptTimeZone(), 'MMM-yy'),
    selectedMonthValue: monthValue,
    currentAssetValue: assetsInfo ? assetsInfo.currentValue : '',
    propertyType: assetsInfo ? assetsInfo.propertyType : '',
    loanAmountLeft: assetsInfo ? assetsInfo.loanAmountLeft : '',
    previousMonthLabel: previousMonthLabel,
    deltaFromPreviousMonth: deltaFromPreviousMonth
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
    message: 'House value saved.'
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

/**
 * Copies latest INPUT - House Values (current year) into SYS - House Assets **Current Value** only.
 * Other columns (Type, Loan Amount Left) are left unchanged.
 */
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
        propertyType:
          headerMap.typeColZero === -1
            ? ''
            : String(displayValues[r][headerMap.typeColZero] || '').trim(),
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
  const typeColZero = headers.indexOf('Type');
  const loanColZero = headers.indexOf('Loan Amount Left');
  const valueColZero = headers.indexOf('Current Value');
  const activeColZero = headers.indexOf('Active');

  if (houseColZero === -1) {
    throw new Error('House Assets must contain House header.');
  }

  if (valueColZero === -1) {
    throw new Error('House Assets must contain Current Value header.');
  }

  return {
    houseColZero: houseColZero,
    typeColZero: typeColZero,
    loanColZero: loanColZero,
    valueColZero: valueColZero,
    activeColZero: activeColZero,
    houseCol: houseColZero + 1,
    typeCol: typeColZero === -1 ? -1 : typeColZero + 1,
    loanCol: loanColZero === -1 ? -1 : loanColZero + 1,
    valueCol: valueColZero + 1,
    activeCol: activeColZero === -1 ? -1 : activeColZero + 1
  };
}

/**
 * Self-heals SYS - House Assets by ensuring an "Active" header exists.
 * Appends "Active" to the first empty trailing header cell (or a new column
 * if none are empty) without touching any existing data rows. Returns a
 * fresh header map. Blank Active in existing rows is treated as active.
 */
function ensureHouseAssetsActiveColumn_(sheet) {
  const headerMap = getHouseAssetsHeaderMap_(sheet);
  if (headerMap.activeColZero !== -1) return headerMap;

  const lastCol = Math.max(sheet.getLastColumn(), 1);
  const headerRowValues = sheet.getRange(1, 1, 1, lastCol).getDisplayValues()[0] || [];

  // Prefer reusing a blank trailing cell on the header row so we don't push
  // the Active column far past the meaningful columns.
  let targetCol = lastCol + 1;
  for (let c = headerRowValues.length; c >= 1; c--) {
    if (String(headerRowValues[c - 1] || '').trim() === '') {
      targetCol = c;
    } else {
      break;
    }
  }

  sheet.getRange(1, targetCol).setValue('Active');
  return getHouseAssetsHeaderMap_(sheet);
}

/**
 * Writes a Yes/No-style Active value into a cell while inheriting the row's
 * text formatting (font size, color, alignment, vertical padding) from the
 * house-name cell in column 1. Without this, Active cells default to the
 * workbook's baseline tiny-text style and stick out next to the rest of
 * the row. Used by both INPUT - House Values and SYS - House Assets writes.
 */
function writeActiveCellWithRowFormat_(sheet, row, col, value) {
  const target = sheet.getRange(row, col);
  try {
    sheet.getRange(row, 1, 1, 1).copyTo(
      target,
      SpreadsheetApp.CopyPasteType.PASTE_FORMAT,
      false
    );
  } catch (e) {
    Logger.log('writeActiveCellWithRowFormat_ copyTo: ' + e);
  }
  try {
    // Column 1 is usually a text cell, but force plain text on the Active
    // cell so "Yes"/"No" are never coerced or re-formatted as currency.
    target.setNumberFormat('@');
  } catch (e) {
    /* best-effort */
  }
  target.setValue(String(value == null ? '' : value));
}

/**
 * Iterates every Year block on INPUT - House Values by scanning column A
 * for "Year" header rows. The callback receives the parsed block object
 * (same shape as getHouseValuesYearBlock_) and the integer year. Errors
 * on individual blocks are swallowed so a malformed block cannot break
 * a multi-block write pass.
 */
function forEachHouseValuesYearBlock_(sheet, callback) {
  const display = sheet.getDataRange().getDisplayValues();
  for (let r = 0; r < display.length; r++) {
    const colA = String(display[r][0] || '').trim();
    const colB = String(display[r][1] || '').trim();
    if (colA !== 'Year') continue;
    const yearNum = parseInt(colB, 10);
    if (isNaN(yearNum)) continue;

    let block = null;
    try {
      block = getHouseValuesYearBlock_(sheet, yearNum);
    } catch (blockErr) {
      Logger.log('forEachHouseValuesYearBlock_ ' + yearNum + ': ' + blockErr);
      continue;
    }
    callback(block, yearNum);
  }
}

/**
 * Self-heals a year block in INPUT - House Values by ensuring an "Active"
 * header exists. Placed at column firstMonthCol + 12 (immediately after the
 * Dec month column) so existing month column logic — which assumes 12
 * contiguous months starting at firstMonthCol — is not disturbed. Returns
 * the 1-based column of the Active header for this block.
 */
function ensureHouseValuesActiveColumnForBlock_(sheet, block) {
  const afterDecCol = block.firstMonthCol + 12; // typically col 15 with firstMonthCol=3
  const scanWidth = Math.max(sheet.getLastColumn(), afterDecCol + 4);
  const headerVals = sheet.getRange(block.headerRow, 1, 1, scanWidth).getDisplayValues()[0] || [];

  for (let c = 0; c < headerVals.length; c++) {
    if (String(headerVals[c] || '').trim().toLowerCase() === 'active') {
      return c + 1;
    }
  }

  // Best-effort: mirror the Dec-month header formatting onto the new Active
  // cell so it looks consistent with neighboring column headers.
  try {
    sheet.getRange(block.headerRow, block.firstMonthCol + 11, 1, 1).copyTo(
      sheet.getRange(block.headerRow, afterDecCol, 1, 1),
      SpreadsheetApp.CopyPasteType.PASTE_FORMAT,
      false
    );
  } catch (e) {
    /* formatting is best-effort; the header value itself is what matters */
  }
  sheet.getRange(block.headerRow, afterDecCol).setValue('Active');
  return afterDecCol;
}

/**
 * Sums INPUT - House Values for the prior calendar month (script timezone) for all data rows.
 * Pairs with SYS - House Assets total (Current Value) on the dashboard Real Estate card.
 */
function getPriorMonthHouseValuesTotalFromHouseValuesInput_() {
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
    const sheet = getSheet_(ss, 'HOUSE_VALUES');
    const block = getHouseValuesYearBlock_(sheet, year);
    const refDate = new Date(year, monthIndexZero, 15);
    const monthCol = getMonthColumnByDate_(sheet, refDate, block.headerRow);
    var sum = 0;
    for (var row = block.dataStartRow; row <= block.dataEndRow; row++) {
      var name = String(sheet.getRange(row, 1).getDisplayValue() || '').trim();
      var sub = String(sheet.getRange(row, 2).getDisplayValue() || '').trim();
      if (!isHouseDataRowName_(name, sub)) continue;
      sum += toNumber_(sheet.getRange(row, monthCol).getValue());
    }
    var label = Utilities.formatDate(new Date(year, monthIndexZero, 1), tz, 'MMM yyyy');
    return { total: round2_(sum), label: label };
  } catch (e) {
    return { total: null, label: '' };
  }
}

/**
 * Validate a proposed new house name against canonical identifiers.
 * Checks INPUT - House Values, SYS - House Assets, and the HOUSES - {House}
 * sheet name so the three stay in lockstep.
 *
 * @param {string} raw
 * @returns {string} trimmed name
 */
function validateNewHouseName_(raw) {
  const name = String(raw || '').trim();
  if (!name) throw new Error('House name is required.');
  if (name.length > 120) throw new Error('House name is too long (max 120 characters).');

  // Reject characters that cannot live in a sheet name ( : \ / ? * [ ] ).
  if (/[:\\\/\?\*\[\]]/.test(name)) {
    throw new Error('House name cannot contain any of these characters: : \\ / ? * [ ]');
  }

  // Guard against colliding with the reserved labels used by the
  // INPUT - House Values scanner (these would be dropped by isHouseDataRowName_).
  const reserved = {
    'year': true,
    'house': true,
    'total values': true,
    'house assets': true,
    'account name': true,
    'delta': true,
    'total accounts': true,
    'loan amount left': true
  };
  if (Object.prototype.hasOwnProperty.call(reserved, name.toLowerCase())) {
    throw new Error('That house name is reserved; please pick a different name.');
  }

  const existingHouses = getHousesFromHouseValues_();
  for (let i = 0; i < existingHouses.length; i++) {
    if (existingHouses[i].toLowerCase() === name.toLowerCase()) {
      throw new Error('A house named "' + existingHouses[i] + '" already exists.');
    }
  }

  if (houseExistsInHouseAssetsSheet_(name)) {
    throw new Error('A house with that name already exists.');
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (ss.getSheetByName('HOUSES - ' + name)) {
    throw new Error('A sheet named "HOUSES - ' + name + '" already exists.');
  }

  return name;
}

function houseExistsInHouseAssetsSheet_(houseName) {
  const target = String(houseName || '').trim();
  if (!target) return false;

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getSheet_(ss, 'HOUSE_ASSETS');
  const display = sheet.getDataRange().getDisplayValues();
  if (display.length < 2) return false;

  const headerMap = getHouseAssetsHeaderMap_(sheet);
  for (let r = 1; r < display.length; r++) {
    if (String(display[r][headerMap.houseColZero] || '').trim().toLowerCase() === target.toLowerCase()) {
      return true;
    }
  }
  return false;
}

/**
 * Last row in the INPUT - House Values year block whose column A is a real
 * house name. Mirrors findLastBankAccountDataRowInBlock_.
 * @returns {number} 1-based row, or -1 if none
 */
function findLastHouseDataRowInBlock_(sheet, block) {
  let last = -1;
  for (let row = block.dataStartRow; row <= block.dataEndRow; row++) {
    const name = String(sheet.getRange(row, 1).getDisplayValue() || '').trim();
    const sub = String(sheet.getRange(row, 2).getDisplayValue() || '').trim();
    if (isHouseDataRowName_(name, sub)) last = row;
  }
  return last;
}

/**
 * Inserts a new data row inside the year block, copying format from a sibling
 * row so the new row inherits the same visual treatment. Mirrors
 * insertNewBankAccountHistoryRow_.
 *
 * Writes:
 *   - column 1 → houseName
 *   - column 2 → Loan Amount Left (from loanAmountLeft)
 *
 * Month columns (firstMonthCol..) are left blank; month valuation seeding is
 * handled separately by updateHouseValuesHistory_().
 *
 * @returns {number} 1-based row number of the new row
 */
function insertNewHouseHistoryRow_(sheet, block, houseName, loanAmountLeft) {
  // Self-heal the Active column before computing lastCol so the inserted
  // row's format copy covers it and we can stamp Active=Yes below.
  const activeCol = ensureHouseValuesActiveColumnForBlock_(sheet, block);
  const lastCol = Math.max(sheet.getLastColumn(), activeCol, 2);
  const lastHouseRow = findLastHouseDataRowInBlock_(sheet, block);
  let newRow;
  let insertBeforeRow;
  let templateRow;

  if (lastHouseRow === -1) {
    if (block.dataEndRow < block.dataStartRow) {
      insertBeforeRow = block.dataStartRow;
    } else {
      insertBeforeRow = block.dataEndRow + 1;
    }
    sheet.insertRowBefore(insertBeforeRow);
    newRow = insertBeforeRow;
    templateRow = (newRow + 1 <= sheet.getLastRow()) ? (newRow + 1) : block.headerRow;
  } else {
    sheet.insertRowAfter(lastHouseRow);
    newRow = lastHouseRow + 1;
    templateRow = lastHouseRow;
  }

  sheet.getRange(templateRow, 1, 1, lastCol).copyTo(
    sheet.getRange(newRow, 1, 1, lastCol),
    SpreadsheetApp.CopyPasteType.PASTE_FORMAT,
    false
  );
  sheet.getRange(newRow, 1, 1, lastCol).clearContent();
  sheet.getRange(newRow, 1).setValue(houseName);

  // Column 2 in INPUT - House Values is "Loan Amount Left" (firstMonthCol = 3).
  // We always write it so the row is complete — callers pass 0 when unknown.
  const loanNum = round2_(toNumber_(loanAmountLeft));
  const loanCell = sheet.getRange(newRow, 2);
  loanCell.setValue(isNaN(loanNum) ? 0 : loanNum);
  // Only apply currency format if the template didn't already set one —
  // the PASTE_FORMAT copy above normally inherits the right format already.
  if (!String(loanCell.getNumberFormat() || '').match(/\$|#,##0/)) {
    applyCurrencyFormat_(loanCell);
  }

  // New houses are Active = Yes. Historical rows created before the Active
  // column existed remain blank and are treated as active by readers. The
  // cell inherits the row's text formatting from col 1 so "Yes" doesn't
  // render in the default tiny style next to the rest of the row.
  writeActiveCellWithRowFormat_(sheet, newRow, activeCol, 'Yes');

  // Refresh the block's "Total Values" simple SUM formulas to cover the
  // new data row. Google Sheets does NOT auto-expand ranges when a row
  // is inserted at the lower boundary of the range (which is exactly
  // what insertRowAfter(lastHouseRow) does when the block's aggregate
  // rows sit immediately below the last house), so without this the
  // newly added house silently drops out of the user's Total Values.
  //
  // Conservative: only simple `=SUM(<L><N>:<L><M>)` formulas whose
  // column letter matches the cell's own column are rewritten. Delta-
  // style YoY diffs, House Assets per-row snapshots, compound formulas,
  // and non-SUM aggregates are all deliberately left alone.
  const newDataStartRow = block.dataStartRow;
  const newDataEndRow = Math.max(newRow, block.dataEndRow + 1);
  try {
    refreshBlockSumAggregates_(
      sheet,
      newDataStartRow,
      newDataEndRow,
      newDataEndRow + 1,
      ['Total Values']
    );
  } catch (_aggErr) { /* defense in depth only */ }

  // Re-assert canonical banner-row styling on the whole sheet. Row
  // insertion above can subtly shift banner positions; re-applying is
  // idempotent (setting the same background/bold on the same cells is
  // a visual no-op) and keeps every Year / House / Total Values /
  // House Assets row looking consistent even as blocks grow. Never
  // load-bearing — failures are swallowed inside the helper.
  try { applyHouseValuesSheetStyling_(sheet); } catch (_) { /* cosmetic only */ }

  return newRow;
}

function appendHouseAssetsRowForNewHouse_(sheet, houseName, propertyType, loanAmountLeft, currentValue) {
  // Self-heal the Active column so new houses always record Active=Yes
  // explicitly, while pre-existing blank rows stay blank (read as active).
  const headerMap = ensureHouseAssetsActiveColumn_(sheet);
  const lastCol = Math.max(sheet.getLastColumn(), headerMap.houseCol, headerMap.activeCol);

  const row = [];
  for (let c = 0; c < lastCol; c++) row[c] = '';

  row[headerMap.houseColZero] = houseName;
  if (headerMap.typeColZero !== -1) row[headerMap.typeColZero] = propertyType;
  if (headerMap.loanColZero !== -1) row[headerMap.loanColZero] = round2_(toNumber_(loanAmountLeft));
  if (headerMap.valueColZero !== -1) row[headerMap.valueColZero] = round2_(toNumber_(currentValue));
  if (headerMap.activeColZero !== -1) row[headerMap.activeColZero] = 'Yes';

  // Identify a neighboring existing data row BEFORE appending, so we can clone
  // its visual treatment (borders, background, font, alignment, number
  // formats) onto the new row without touching the freshly written values.
  const templateRow = findHouseAssetsTemplateRow_(sheet, headerMap);

  sheet.appendRow(row);
  const appendedRow = sheet.getLastRow();

  if (templateRow !== -1) {
    try {
      sheet.getRange(templateRow, 1, 1, lastCol).copyTo(
        sheet.getRange(appendedRow, 1, 1, lastCol),
        SpreadsheetApp.CopyPasteType.PASTE_FORMAT,
        false
      );
      sheet.setRowHeight(appendedRow, sheet.getRowHeight(templateRow));
    } catch (formatErr) {
      Logger.log('appendHouseAssetsRowForNewHouse_ format copy failed: ' + formatErr);
    }
  }

  // Explicitly guarantee currency formatting on the money columns in case the
  // template row did not have one set.
  if (headerMap.valueCol !== -1) {
    const vc = sheet.getRange(appendedRow, headerMap.valueCol);
    if (!String(vc.getNumberFormat() || '').match(/\$|#,##0/)) applyCurrencyFormat_(vc);
  }
  if (headerMap.loanCol !== -1) {
    const lc = sheet.getRange(appendedRow, headerMap.loanCol);
    if (!String(lc.getNumberFormat() || '').match(/\$|#,##0/)) applyCurrencyFormat_(lc);
  }

  // Re-stamp Active with row-consistent formatting. The whole-row format
  // copy above inherits the template row's Active cell style, which may
  // itself have defaulted to tiny text on older rows. Forcing the house
  // name column's style keeps "Yes" visually in line with the row.
  if (headerMap.activeCol !== -1) {
    writeActiveCellWithRowFormat_(sheet, appendedRow, headerMap.activeCol, 'Yes');
  }

  // Re-assert the canonical SYS - House Assets header styling.
  // Idempotent, cosmetic only — failures are swallowed inside the
  // helper so a House Assets write is never blocked by a formatting
  // glitch.
  try { applyHouseAssetsSheetStyling_(sheet); } catch (_) { /* cosmetic */ }
}

/**
 * Idempotent canonical styling for `SYS - House Assets`.
 *
 * Flat 5-column table (House / Type / Loan Amount Left / Current Value /
 * Active) with no year blocks and no footer rows. Mirrors the
 * `SYS - Assets` styling pattern — only row 1 needs asserted styling,
 * since data rows are append-only and each new row inherits formatting
 * from a neighbor template via PASTE_FORMAT (see
 * `appendHouseAssetsRowForNewHouse_` above).
 *
 * Assertions:
 *   - Header row (row 1) → yellow #fff200, bold black, centered
 *     horizontal / middle vertical, row height 32.
 *   - Solid-medium black bottom border under row 1.
 *   - Frozen row 1 + frozen column 1 so House stays pinned when
 *     scrolling.
 *
 * Data rows, number formats, and any user cell highlights (including
 * the red-text conditional formatting on Loan Amount Left) are
 * deliberately never touched. Failures are swallowed — cosmetic only.
 */
function applyHouseAssetsSheetStyling_(sheet) {
  if (!sheet) return;
  let lastCol = 1;
  try { lastCol = Math.max(1, sheet.getLastColumn()); } catch (_) { return; }

  try {
    const headerRange = sheet.getRange(1, 1, 1, lastCol);
    headerRange
      .setBackground('#fff200')
      .setFontWeight('bold')
      .setFontColor('#000000')
      .setHorizontalAlignment('center')
      .setVerticalAlignment('middle');
    try {
      headerRange.setBorder(
        null, null, true, null, null, null,
        '#000000',
        SpreadsheetApp.BorderStyle.SOLID_MEDIUM
      );
    } catch (_borderErr) { /* cosmetic */ }
  } catch (_headerErr) { /* cosmetic */ }

  try { sheet.setRowHeight(1, 32); } catch (_) {}
  try { sheet.setFrozenRows(1); } catch (_) {}
  try { sheet.setFrozenColumns(1); } catch (_) {}
}

/**
 * Finds the last existing data row in SYS - House Assets whose "House" column
 * is non-empty, to use as a formatting template for newly appended rows.
 * @returns {number} 1-based row number, or -1 if none available.
 */
function findHouseAssetsTemplateRow_(sheet, headerMap) {
  const display = sheet.getDataRange().getDisplayValues();
  for (let r = display.length - 1; r >= 1; r--) {
    const name = String(display[r][headerMap.houseColZero] || '').trim();
    if (name) return r + 1;
  }
  return -1;
}

function deleteHouseAssetsRowByExactName_(sheet, houseName) {
  const target = String(houseName || '').trim();
  if (!target) return;

  const headerMap = getHouseAssetsHeaderMap_(sheet);
  const display = sheet.getDataRange().getDisplayValues();

  for (let r = 1; r < display.length; r++) {
    if (String(display[r][headerMap.houseColZero] || '').trim() === target) {
      sheet.deleteRow(r + 1);
      return;
    }
  }
}

/**
 * Creates the HOUSES - {House} sheet with the canonical header structure that
 * the rest of the app (house_expenses.js readers) expects:
 *
 *   Row 1:   Year | <currentYear>
 *   Row 2:   Item | Type | Date | Location | Cost | Service Fees Paid |
 *            Insurance covered | Payments Links | Notes
 *
 * If an existing HOUSES - * sheet is available in the workbook, the Year row
 * and header row formatting is cloned from there so the new sheet visually
 * matches existing house sheets. Otherwise the fallback background/weight
 * already used by findOrCreateHouseExpenseYearBlock_ is applied.
 *
 * Safe to call when the sheet already exists (it's a no-op).
 *
 * @returns {{sheet: GoogleAppsScript.Spreadsheet.Sheet, created: boolean, templateSheetName: string}}
 */
function createHousesExpenseSheet_(ss, houseName) {
  const sheetName = 'HOUSES - ' + houseName;
  const existing = ss.getSheetByName(sheetName);
  if (existing) {
    return { sheet: existing, created: false, templateSheetName: '' };
  }

  const newSheet = ss.insertSheet(sheetName);
  const currentYear = getCurrentYear_();
  const canonicalHeaders = [
    'Item', 'Type', 'Date', 'Location', 'Cost',
    'Service Fees Paid', 'Insurance covered', 'Payments Links', 'Notes'
  ];

  newSheet.getRange(1, 1, 1, 2).setValues([['Year', currentYear]]);
  newSheet.getRange(2, 1, 1, 9).setValues([canonicalHeaders]);

  const template = findExistingHousesTemplateRows_(ss, sheetName);
  if (template) {
    try {
      template.sheet.getRange(template.yearRow, 1, 1, 9)
        .copyTo(newSheet.getRange(1, 1, 1, 9), { formatOnly: true });
      template.sheet.getRange(template.headerRow, 1, 1, 9)
        .copyTo(newSheet.getRange(2, 1, 1, 9), { formatOnly: true });
      newSheet.setRowHeight(1, template.sheet.getRowHeight(template.yearRow));
      newSheet.setRowHeight(2, template.sheet.getRowHeight(template.headerRow));

      // Copy column widths so the new sheet visually matches existing houses.
      copyHousesColumnWidths_(template.sheet, newSheet, 9);
    } catch (e) {
      // Formatting copy is best-effort; headers themselves are already correct.
      Logger.log('createHousesExpenseSheet_ formatting copy failed: ' + e);
      applyHousesYearRowFallbackFormat_(newSheet, 1);
      applyHousesHeaderRowFallbackFormat_(newSheet, 2);
    }
  } else {
    applyHousesYearRowFallbackFormat_(newSheet, 1);
    applyHousesHeaderRowFallbackFormat_(newSheet, 2);
  }

  newSheet.setFrozenRows(2);
  newSheet.getRange(1, 1).activate();

  return {
    sheet: newSheet,
    created: true,
    templateSheetName: template ? template.sheet.getName() : ''
  };
}

/**
 * Scans existing HOUSES - * sheets for a (Year row, Item/Type header row) pair
 * and returns the first match. Skips the target sheet name so we don't clone
 * a half-initialized sheet.
 */
function findExistingHousesTemplateRows_(ss, skipSheetName) {
  const sheets = ss.getSheets();
  for (let i = 0; i < sheets.length; i++) {
    const sheet = sheets[i];
    const name = String(sheet.getName() || '');
    if (name === skipSheetName) continue;
    if (name.toUpperCase().indexOf('HOUSES - ') !== 0) continue;

    const lastRow = Math.max(sheet.getLastRow(), 1);
    if (lastRow < 2) continue;

    const scanRows = Math.min(lastRow, 50);
    const values = sheet.getRange(1, 1, scanRows, 2).getDisplayValues();

    let yearRow = -1;
    for (let r = 0; r < scanRows; r++) {
      const colA = String(values[r][0] || '').trim().toLowerCase();
      if (colA === 'year') {
        yearRow = r + 1;
        break;
      }
    }
    if (yearRow === -1) continue;

    // Header row should be the next non-empty row with Item/Type.
    let headerRow = -1;
    for (let r = yearRow; r < scanRows; r++) {
      const a = String(values[r][0] || '').trim().toLowerCase();
      const b = String(values[r][1] || '').trim().toLowerCase();
      if (a === 'item' && b === 'type') {
        headerRow = r + 1;
        break;
      }
    }
    if (headerRow === -1) continue;

    return { sheet: sheet, yearRow: yearRow, headerRow: headerRow };
  }
  return null;
}

/**
 * Copies column widths (columns 1..numColumns) from a source HOUSES - * sheet
 * onto a newly created HOUSES - * sheet so they visually match. Errors on any
 * individual column are swallowed (width copying is best-effort).
 */
function copyHousesColumnWidths_(sourceSheet, targetSheet, numColumns) {
  for (let col = 1; col <= numColumns; col++) {
    try {
      const w = sourceSheet.getColumnWidth(col);
      if (w && w > 0) targetSheet.setColumnWidth(col, w);
    } catch (e) {
      Logger.log('copyHousesColumnWidths_ col ' + col + ' failed: ' + e);
    }
  }
}

function applyHousesYearRowFallbackFormat_(sheet, row) {
  sheet.getRange(row, 1, 1, 9)
    .setBackground('#f4a300')
    .setFontWeight('bold')
    .setFontColor('#000000');
}

function applyHousesHeaderRowFallbackFormat_(sheet, row) {
  sheet.getRange(row, 1, 1, 9)
    .setBackground('#fff200')
    .setFontWeight('bold')
    .setFontColor('#000000');
}

/**
 * Idempotent canonical styling for `INPUT - House Values`.
 *
 * Walks the sheet top-to-bottom scanning column A for the block markers
 * ("Year", "House", "Total Values", "House Assets") and asserts the
 * colors + font weight + row heights the user already relies on so new
 * blocks / newly-inserted rows never drift from the canonical look:
 *
 *   - "Year | <year>"   → orange  #f4a300, bold black, row height 28
 *   - "House | Loan…"   → yellow  #fff200, bold black, centered, row height 32
 *   - "Total Values"    → pink    #f4cccc, bold black
 *   - "House Assets"    → green   #b6d7a8, bold black
 *
 * Data rows (everything else) are deliberately left untouched so the
 * user's own conditional formatting on "Loan Amount Left" (red text)
 * is preserved. Column widths, frozen rows/columns, and number
 * formats on money cells are also left alone — this helper only
 * asserts the *banner* rows that make each block readable.
 *
 * All failures are swallowed — cosmetic only; must never fail a
 * House Values write on a formatting glitch. Safe to call from every
 * add-row / rollover path.
 */
function applyHouseValuesSheetStyling_(sheet) {
  if (!sheet) return;
  let lastCol = 1;
  try { lastCol = Math.max(1, sheet.getLastColumn()); } catch (_) { return; }
  let lastRow = 0;
  try { lastRow = sheet.getLastRow(); } catch (_) { return; }
  if (lastRow < 1) return;

  let colA;
  try {
    colA = sheet.getRange(1, 1, lastRow, 1).getDisplayValues();
  } catch (_) { return; }

  for (let i = 0; i < colA.length; i++) {
    const marker = String(colA[i][0] || '').trim();
    if (!marker) continue;
    const row1 = i + 1;
    try {
      if (marker === 'Year') {
        sheet.getRange(row1, 1, 1, lastCol)
          .setBackground('#f4a300')
          .setFontWeight('bold')
          .setFontColor('#000000');
        try { sheet.setRowHeight(row1, 28); } catch (_) {}
      } else if (marker === 'House') {
        // Only style as the column-header row when col B reads
        // "Loan Amount Left" — otherwise it's a data row whose first
        // cell happens to be the word "House" (defensive; readers
        // already filter these out via isHouseDataRowName_).
        let colB = '';
        try {
          colB = String(sheet.getRange(row1, 2).getDisplayValue() || '').trim();
        } catch (_) { /* leave colB blank and skip styling */ }
        if (colB === 'Loan Amount Left') {
          const range = sheet.getRange(row1, 1, 1, lastCol);
          range
            .setBackground('#fff200')
            .setFontWeight('bold')
            .setFontColor('#000000')
            .setHorizontalAlignment('center')
            .setVerticalAlignment('middle');
          try { sheet.setRowHeight(row1, 32); } catch (_) {}
        }
      } else if (marker === 'Total Values') {
        sheet.getRange(row1, 1, 1, lastCol)
          .setBackground('#f4cccc')
          .setFontWeight('bold')
          .setFontColor('#000000');
      } else if (marker === 'House Assets') {
        sheet.getRange(row1, 1, 1, lastCol)
          .setBackground('#b6d7a8')
          .setFontWeight('bold')
          .setFontColor('#000000');
      }
    } catch (_styleErr) { /* cosmetic only */ }
  }

  // Freeze column A so house names stay pinned when scrolling across
  // the 12 month columns. Idempotent — no-op when already frozen.
  try { sheet.setFrozenColumns(1); } catch (_) { /* cosmetic */ }
}

/**
 * Canonical "add a new house" entry point used by the dashboard UI.
 *
 * Writes:
 *   - INPUT - House Values:   new data row inside the current-year block,
 *                             optionally seeded with currentValue for the
 *                             month that valuationDate falls in.
 *   - SYS - House Assets:     new row with House / Type / Loan Amount Left /
 *                             Current Value.
 *   - HOUSES - {House}:       new sheet with the canonical 9-column header
 *                             (created only if it does not already exist).
 *   - LOG - Activity:         a 'house_add' row.
 *
 * Does NOT touch:
 *   - planner logic
 *   - property-performance calculations
 *   - existing house rows / expense sheets
 *
 * @param {{
 *   houseName: string,
 *   propertyType: string,
 *   currentValue: number|string,
 *   loanAmountLeft: number|string,
 *   valuationDate?: string
 * }} payload
 */
function addHouseFromDashboard(payload) {
  validateRequired_(payload, ['houseName', 'propertyType', 'currentValue', 'loanAmountLeft']);

  const houseName = validateNewHouseName_(payload.houseName);
  const propertyType = String(payload.propertyType || '').trim();
  if (!propertyType) throw new Error('Property type is required.');
  if (propertyType.length > 80) throw new Error('Property type is too long (max 80 characters).');

  const currentValueRaw = payload.currentValue;
  const currentValue = round2_(toNumber_(currentValueRaw));
  if (isNaN(currentValue)) throw new Error('Current value must be a valid number.');
  if (currentValue < 0) throw new Error('Current value cannot be negative.');

  const loanRaw = payload.loanAmountLeft;
  const loanAmountLeft = round2_(toNumber_(loanRaw));
  if (isNaN(loanAmountLeft)) throw new Error('Loan amount left must be a valid number.');
  if (loanAmountLeft < 0) throw new Error('Loan amount left cannot be negative.');

  const tz = Session.getScriptTimeZone();
  const currentYear = getCurrentYear_();

  // Resolve a deterministic effective valuation date.
  //   - If the user supplied a date, validate it and use it verbatim
  //     (must be in the current-year block being extended).
  //   - If the user left the field blank, default to today. This
  //     guarantees every new-house write lands in a real month column
  //     instead of leaving the month cell silently empty, which used
  //     to create the ambiguity described in the UI copy update.
  //
  // `valuationDateWasProvided` preserves whether the UI supplied a
  // date so the activity log can still record the raw user intent
  // separately from the resolved date.
  let valuationDate = null;
  const valuationDateStr = String(payload.valuationDate || '').trim();
  const valuationDateWasProvided = !!valuationDateStr;
  if (valuationDateWasProvided) {
    valuationDate = parseIsoDateLocal_(valuationDateStr);
    if (isNaN(valuationDate.getTime())) throw new Error('Invalid valuation date.');
    if (valuationDate.getFullYear() !== currentYear) {
      throw new Error('Valuation date must be in ' + currentYear +
        ' (same year as the house block being extended).');
    }
  } else {
    // stripTime_ normalizes to the start of today so month extraction
    // in updateHouseValuesHistory_ / Utilities.formatDate is stable
    // regardless of script timezone drift.
    valuationDate = stripTime_(new Date());
  }

  // Ensure-before-write guards. Both helpers are idempotent no-ops on
  // populated workbooks. On a fresh workbook they write the canonical
  // structure getHouseValuesYearBlock_ and getHouseAssetsHeaderMap_
  // expect on the very next line. Mirrors addInvestmentAccountFromDashboard.
  try {
    ensureInputHouseValuesSheet_();
  } catch (ensureErr) {
    throw new Error(
      "Couldn't prepare house values: " +
      (ensureErr && ensureErr.message ? ensureErr.message : ensureErr)
    );
  }
  try {
    ensureSysHouseAssetsSheet_();
  } catch (sysErr) {
    throw new Error(
      'Could not prepare SYS - House Assets: ' +
      (sysErr && sysErr.message ? sysErr.message : sysErr)
    );
  }
  try { SpreadsheetApp.flush(); } catch (_flushErr) { /* best-effort */ }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hvSheet = getSheet_(ss, 'HOUSE_VALUES');
  const haSheet = getSheet_(ss, 'HOUSE_ASSETS');
  const block = getHouseValuesYearBlock_(hvSheet, currentYear);

  // 1) Insert the INPUT - House Values row. Column 2 ("Loan Amount Left") is
  //    populated here so the row is complete before we move on to SYS.
  let newHvRow = 0;
  try {
    newHvRow = insertNewHouseHistoryRow_(hvSheet, block, houseName, loanAmountLeft);
  } catch (e) {
    throw new Error('Could not insert House Values row: ' + (e.message || e));
  }

  // 2) Append the SYS - House Assets row. Roll back HV row on failure.
  try {
    appendHouseAssetsRowForNewHouse_(haSheet, houseName, propertyType, loanAmountLeft, currentValue);
  } catch (e2) {
    hvSheet.deleteRow(newHvRow);
    throw new Error('Could not add House Assets row (rolled back House Values row): ' +
      (e2.message || e2));
  }

  // 3) Seed the month cell with currentValue using the resolved
  //    valuation date (always non-null now — either the user-supplied
  //    date or today when the field was left blank).
  //    The `currentValue !== 0` guard is preserved from prior
  //    behavior: writing an explicit 0 into a month cell is
  //    indistinguishable from "no entry" in downstream readers, and
  //    historically populated workbooks rely on that. New-house
  //    creation still records the SYS - House Assets Current Value
  //    directly in step 2, so the row is complete even when the
  //    month cell is skipped.
  let seededMonthLabel = '';
  try {
    if (currentValue !== 0) {
      updateHouseValuesHistory_(houseName, currentYear, valuationDate, currentValue);
      seededMonthLabel = Utilities.formatDate(valuationDate, tz, 'MMM-yy');
    }
    // Only copy Current Value for rows that actually have a latest month.
    // Leaves Type and Loan Amount Left untouched on the new row.
    syncAllHouseAssetsFromLatestCurrentYear_();
    touchDashboardSourceUpdated_('house_values');
  } catch (e3) {
    deleteHouseAssetsRowByExactName_(haSheet, houseName);
    hvSheet.deleteRow(newHvRow);
    throw e3;
  }

  // 4) Create the HOUSES - {House} expense sheet (REQUIRED in this pass).
  //    Sheet creation failures must not silently succeed — the whole add
  //    operation is reverted so the user can retry cleanly.
  let sheetCreationInfo = null;
  try {
    sheetCreationInfo = createHousesExpenseSheet_(ss, houseName);
  } catch (e4) {
    deleteHouseAssetsRowByExactName_(haSheet, houseName);
    hvSheet.deleteRow(newHvRow);
    throw new Error('Could not create HOUSES - ' + houseName + ' sheet (rolled back other writes): ' +
      (e4.message || e4));
  }

  // 5) Log the activity event (best-effort; never block the user on a log failure).
  try {
    appendActivityLog_(ss, {
      eventType: 'house_add',
      entryDate: Utilities.formatDate(stripTime_(valuationDate || new Date()), tz, 'yyyy-MM-dd'),
      amount: Math.abs(currentValue),
      direction: 'expense',
      payee: houseName,
      category: propertyType,
      accountSource: '',
      cashFlowSheet: '',
      cashFlowMonth: '',
      dedupeKey: '',
      details: JSON.stringify({
        detailsVersion: 1,
        year: currentYear,
        propertyType: propertyType,
        currentValue: currentValue,
        loanAmountLeft: loanAmountLeft,
        valuationDate: valuationDateStr,
        seededMonthLabel: seededMonthLabel,
        houseSheet: 'HOUSES - ' + houseName,
        houseSheetCreated: sheetCreationInfo ? sheetCreationInfo.created : false,
        houseSheetTemplate: sheetCreationInfo ? sheetCreationInfo.templateSheetName : ''
      })
    });
  } catch (logErr) {
    Logger.log('addHouseFromDashboard activity log: ' + logErr);
  }

  return {
    ok: true,
    houseName: houseName,
    message: 'House added.'
  };
}

/* -------------------------------------------------------------------------- */
/*  Stop tracking (soft deactivate)                                           */
/* -------------------------------------------------------------------------- */

/**
 * Soft-delete entry point for houses. Flips Active = 'No' on every row for
 * this house across all year blocks in INPUT - House Values (canonical) and
 * on the matching SYS - House Assets row (mirror). Does not touch history,
 * month values, loan amounts, or the HOUSES - {House} sheet.
 *
 * @param {{ houseName: string }} payload
 * @returns {{ ok: boolean, message: string, houseName: string,
 *             alreadyInactive: boolean, rowsUpdated: number }}
 */
function deactivateHouseFromDashboard(payload) {
  validateRequired_(payload, ['houseName']);
  const houseName = String(payload.houseName || '').trim();
  if (!houseName) throw new Error('House name is required.');

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hvSheet = getSheet_(ss, 'HOUSE_VALUES');
  const haSheet = getSheet_(ss, 'HOUSE_ASSETS');

  // 1) Canonical write: flip every matching row across all year blocks so
  //    future reads see a consistent inactive state regardless of which
  //    year block they query.
  const hvUpdate = setHouseActiveInAllHouseValuesBlocks_(hvSheet, houseName, 'No');
  if (!hvUpdate.found) {
    throw new Error('No rows found for "' + houseName + '" in House Values.');
  }

  // 2) Mirror write: SYS - House Assets carries one row per house. Writes
  //    even if the row already reads "No" so row formatting is refreshed
  //    consistently with the canonical rows.
  const haUpdate = setHouseAssetsActiveValue_(haSheet, houseName, 'No');

  const alreadyInactive = hvUpdate.rowsUpdated === 0 && !haUpdate.changed;

  // 3) Activity log (best-effort; never block the user on a log failure).
  try {
    const tz = Session.getScriptTimeZone();
    appendActivityLog_(ss, {
      eventType: 'house_deactivate',
      entryDate: Utilities.formatDate(stripTime_(new Date()), tz, 'yyyy-MM-dd'),
      amount: 0,
      direction: 'expense',
      payee: houseName,
      category: '',
      accountSource: '',
      cashFlowSheet: '',
      cashFlowMonth: '',
      dedupeKey: '',
      details: JSON.stringify({
        detailsVersion: 1,
        reason: 'stop_tracking',
        hvRowsUpdated: hvUpdate.rowsUpdated,
        hvBlocksScanned: hvUpdate.blocksScanned,
        haRowFound: haUpdate.found,
        alreadyInactive: alreadyInactive
      })
    });
  } catch (logErr) {
    Logger.log('deactivateHouseFromDashboard activity log: ' + logErr);
  }

  try {
    touchDashboardSourceUpdated_('house_values');
  } catch (e) {
    /* best-effort */
  }

  const message = alreadyInactive
    ? '"' + houseName + '" was already marked inactive. History and HOUSES sheet remain.'
    : 'Stopped tracking "' + houseName + '". The HOUSES - ' + houseName +
      ' sheet and all history remain.';

  return {
    ok: true,
    message: message,
    houseName: houseName,
    alreadyInactive: alreadyInactive,
    rowsUpdated: hvUpdate.rowsUpdated + (haUpdate.changed ? 1 : 0)
  };
}

/**
 * Writes an Active value on every data row in every year block of
 * INPUT - House Values whose column A matches houseName (case-insensitive).
 * Self-heals the Active column in each block before writing.
 *
 * @returns {{ found: boolean, rowsUpdated: number, blocksScanned: number }}
 */
function setHouseActiveInAllHouseValuesBlocks_(sheet, houseName, value) {
  const target = String(houseName || '').trim().toLowerCase();
  const writeValue = String(value == null ? '' : value);
  let rowsUpdated = 0;
  let found = false;
  let blocksScanned = 0;

  forEachHouseValuesYearBlock_(sheet, function(block) {
    blocksScanned++;
    const activeCol = ensureHouseValuesActiveColumnForBlock_(sheet, block);

    for (let row = block.dataStartRow; row <= block.dataEndRow; row++) {
      const name = String(sheet.getRange(row, 1).getDisplayValue() || '').trim();
      const sub = String(sheet.getRange(row, 2).getDisplayValue() || '').trim();
      if (!isHouseDataRowName_(name, sub)) continue;
      if (name.toLowerCase() !== target) continue;

      found = true;
      const cell = sheet.getRange(row, activeCol);
      const current = String(cell.getDisplayValue() || '').trim().toLowerCase();
      if (current !== writeValue.toLowerCase()) {
        writeActiveCellWithRowFormat_(sheet, row, activeCol, writeValue);
        rowsUpdated++;
      }
    }
  });

  return {
    found: found,
    rowsUpdated: rowsUpdated,
    blocksScanned: blocksScanned
  };
}

/**
 * Writes an Active value on the matching SYS - House Assets row.
 * Self-heals the Active column if missing. Case-insensitive name match.
 *
 * @returns {{ found: boolean, changed: boolean, row: number }}
 */
function setHouseAssetsActiveValue_(sheet, houseName, value) {
  const target = String(houseName || '').trim().toLowerCase();
  if (!target) return { found: false, changed: false, row: -1 };

  const headerMap = ensureHouseAssetsActiveColumn_(sheet);
  const display = sheet.getDataRange().getDisplayValues();
  if (display.length < 2 || headerMap.activeCol === -1) {
    return { found: false, changed: false, row: -1 };
  }

  for (let r = 1; r < display.length; r++) {
    const rowHouse = String(display[r][headerMap.houseColZero] || '').trim();
    if (!rowHouse) continue;
    if (rowHouse.toLowerCase() !== target) continue;

    const rowNum = r + 1;
    const current = String(display[r][headerMap.activeColZero] || '').trim().toLowerCase();
    const writeValue = String(value == null ? '' : value);
    if (current === writeValue.toLowerCase()) {
      return { found: true, changed: false, row: rowNum };
    }
    writeActiveCellWithRowFormat_(sheet, rowNum, headerMap.activeCol, writeValue);
    return { found: true, changed: true, row: rowNum };
  }

  return { found: false, changed: false, row: -1 };
}