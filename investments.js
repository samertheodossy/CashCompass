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
  var typeOpts = [];
  try {
    typeOpts = getAssetsDistinctColumnValues_('Type');
  } catch (e) {
    Logger.log('getInvestmentUiData type options: ' + e);
  }

  let inactive = Object.create(null);
  try {
    inactive = getInactiveInvestmentsSet_();
  } catch (e) {
    Logger.log('getInvestmentUiData inactive filter: ' + e);
  }

  const allAccounts = getInvestmentsFromHistory_();
  const activeAccounts = allAccounts.filter(function(name) {
    return !inactive[String(name || '').toLowerCase()];
  });

  return {
    accounts: activeAccounts,
    typeOptions: typeOpts
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

/**
 * Returns an object map keyed by lowercase account name for investments whose
 * Active column on SYS - Assets is explicitly marked "No" / "n" / "false" /
 * "inactive". Blank, missing, or unrecognized values are treated as active
 * (backward compatibility for rows created before Active existed).
 */
function getInactiveInvestmentsSet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getSheet_(ss, 'ASSETS');
  const display = sheet.getDataRange().getDisplayValues();
  const inactive = Object.create(null);
  if (display.length < 2) return inactive;

  let headerMap;
  try {
    headerMap = getAssetsHeaderMap_(sheet);
  } catch (e) {
    return inactive;
  }
  if (headerMap.activeColZero === -1) return inactive;

  for (let r = 1; r < display.length; r++) {
    const name = String(display[r][headerMap.nameColZero] || '').trim();
    if (!name) continue;
    const raw = String(display[r][headerMap.activeColZero] || '').trim().toLowerCase();
    if (raw === 'no' || raw === 'n' || raw === 'false' || raw === 'inactive') {
      inactive[name.toLowerCase()] = true;
    }
  }
  return inactive;
}

/**
 * Distinct non-empty values from a column on SYS - Assets (for Add Investment
 * datalists). Blank values and reserved labels are skipped.
 * @param {string} headerLabel e.g. "Type"
 * @returns {string[]}
 */
function getAssetsDistinctColumnValues_(headerLabel) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getSheet_(ss, 'ASSETS');
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

function getInvestmentValueForDate(accountName, balanceDate) {
  const name = String(accountName || '').trim();
  if (!name) throw new Error('Account name is required.');

  const d = parseIsoDateLocal_(balanceDate);

  const year = d.getFullYear();
  const monthValue = getInvestmentHistoryValueForMonth_(name, year, d);
  const assetInfo = getAssetRowData_(name);

  var previousMonthLabel = '';
  var deltaFromPreviousMonth = null;
  try {
    const prior = new Date(d.getFullYear(), d.getMonth() - 1, 15);
    const priorYear = prior.getFullYear();
    const previousMonthValue = getInvestmentHistoryValueForMonth_(name, priorYear, prior);
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
    currentBalance: assetInfo ? assetInfo.currentBalance : '',
    type: assetInfo ? assetInfo.type : '',
    previousMonthLabel: previousMonthLabel,
    deltaFromPreviousMonth: deltaFromPreviousMonth
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
  const activeColZero = headers.indexOf('Active');

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
    activeColZero: activeColZero,
    nameCol: nameColZero + 1,
    typeCol: typeColZero === -1 ? -1 : typeColZero + 1,
    balanceCol: balanceColZero + 1,
    activeCol: activeColZero === -1 ? -1 : activeColZero + 1
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

/**
 * Self-heals SYS - Assets by ensuring an "Active" header exists. Appends
 * "Active" to the first empty trailing header cell (or a new column if none
 * are empty) without touching existing data rows. Returns a fresh header
 * map. Blank Active in existing rows is treated as active.
 */
function ensureAssetsActiveColumn_(sheet) {
  const headerMap = getAssetsHeaderMap_(sheet);
  if (headerMap.activeColZero !== -1) return headerMap;

  const lastCol = Math.max(sheet.getLastColumn(), 1);
  const headerRowValues = sheet.getRange(1, 1, 1, lastCol).getDisplayValues()[0] || [];

  let targetCol = lastCol + 1;
  for (let c = headerRowValues.length; c >= 1; c--) {
    if (String(headerRowValues[c - 1] || '').trim() === '') {
      targetCol = c;
    } else {
      break;
    }
  }

  sheet.getRange(1, targetCol).setValue('Active');
  return getAssetsHeaderMap_(sheet);
}

/**
 * Iterates every Year block on INPUT - Investments. Callback receives the
 * parsed block (same shape as getInvestmentsYearBlock_) and the integer year.
 * Errors on individual blocks are swallowed so a malformed block can never
 * break a multi-block write pass.
 */
function forEachInvestmentsYearBlock_(sheet, callback) {
  const display = sheet.getDataRange().getDisplayValues();
  for (let r = 0; r < display.length; r++) {
    const colA = String(display[r][0] || '').trim();
    const colB = String(display[r][1] || '').trim();
    if (colA !== 'Year') continue;
    const yearNum = parseInt(colB, 10);
    if (isNaN(yearNum)) continue;

    let block = null;
    try {
      block = getInvestmentsYearBlock_(sheet, yearNum);
    } catch (blockErr) {
      Logger.log('forEachInvestmentsYearBlock_ ' + yearNum + ': ' + blockErr);
      continue;
    }
    callback(block, yearNum);
  }
}

/**
 * Self-heals a year block in INPUT - Investments by ensuring an "Active"
 * header exists. Placed at column firstMonthCol + 12 (immediately after Dec)
 * so existing month column logic — which assumes 12 contiguous months
 * starting at firstMonthCol — is not disturbed. Returns the 1-based column
 * of the Active header for this block.
 */
function ensureInvestmentsActiveColumnForBlock_(sheet, block) {
  const afterDecCol = block.firstMonthCol + 12; // typically col 15 with firstMonthCol=3
  const scanWidth = Math.max(sheet.getLastColumn(), afterDecCol + 4);
  const headerVals = sheet.getRange(block.headerRow, 1, 1, scanWidth).getDisplayValues()[0] || [];

  for (let c = 0; c < headerVals.length; c++) {
    if (String(headerVals[c] || '').trim().toLowerCase() === 'active') {
      return c + 1;
    }
  }

  try {
    sheet.getRange(block.headerRow, block.firstMonthCol + 11, 1, 1).copyTo(
      sheet.getRange(block.headerRow, afterDecCol, 1, 1),
      SpreadsheetApp.CopyPasteType.PASTE_FORMAT,
      false
    );
  } catch (e) {
    /* formatting is best-effort; the header value is what matters */
  }
  sheet.getRange(block.headerRow, afterDecCol).setValue('Active');
  return afterDecCol;
}

/**
 * Validate a proposed new investment account name against canonical
 * identifiers. Checks INPUT - Investments (all rows, active or inactive) and
 * SYS - Assets so the two stay in lockstep and inactive names stay reserved.
 *
 * @param {string} raw
 * @returns {string} trimmed name
 */
function validateNewInvestmentAccountName_(raw) {
  const name = String(raw || '').trim();
  if (!name) throw new Error('Account name is required.');
  if (name.length > 120) throw new Error('Account name is too long (max 120 characters).');
  if (!isInvestmentDataRowName_(name)) {
    throw new Error('That account name is not allowed (reserved label or invalid).');
  }

  const existing = getInvestmentsFromHistory_();
  for (let i = 0; i < existing.length; i++) {
    if (existing[i].toLowerCase() === name.toLowerCase()) {
      throw new Error('An investment account named "' + existing[i] + '" already exists on INPUT - Investments.');
    }
  }

  if (assetExistsInAssetsSheet_(name)) {
    throw new Error('An investment account with that name already exists on SYS - Assets.');
  }

  return name;
}

function assetExistsInAssetsSheet_(accountName) {
  const target = String(accountName || '').trim();
  if (!target) return false;

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getSheet_(ss, 'ASSETS');
  const display = sheet.getDataRange().getDisplayValues();
  if (display.length < 2) return false;

  const headerMap = getAssetsHeaderMap_(sheet);
  for (let r = 1; r < display.length; r++) {
    if (String(display[r][headerMap.nameColZero] || '').trim().toLowerCase() === target.toLowerCase()) {
      return true;
    }
  }
  return false;
}

/**
 * Last row in the INPUT - Investments year block whose column A is a real
 * account name (skips blanks/totals). Mirrors findLastBankAccountDataRowInBlock_.
 * @returns {number} 1-based row, or -1 if none
 */
function findLastInvestmentDataRowInBlock_(sheet, block) {
  let last = -1;
  for (let row = block.dataStartRow; row <= block.dataEndRow; row++) {
    const name = String(sheet.getRange(row, 1).getDisplayValue() || '').trim();
    if (isInvestmentDataRowName_(name)) last = row;
  }
  return last;
}

/**
 * Inserts a new data row inside the year block, copying format from a sibling
 * row so the new row inherits the same visual treatment. Writes:
 *   - column 1 → accountName
 *   - column 2 → typeStr (Type)
 *
 * Month columns (firstMonthCol..) are left blank; starting-month seeding is
 * handled separately by updateInvestmentHistory_().
 *
 * @returns {number} 1-based row number of the new row
 */
function insertNewInvestmentHistoryRow_(sheet, block, accountName, typeStr) {
  // Self-heal the Active column before computing lastCol so the inserted row's
  // format copy covers it and we can stamp Active=Yes below.
  const activeCol = ensureInvestmentsActiveColumnForBlock_(sheet, block);
  const lastCol = Math.max(sheet.getLastColumn(), activeCol, 2);
  const lastAccountRow = findLastInvestmentDataRowInBlock_(sheet, block);
  let newRow;
  let insertBeforeRow;
  let templateRow;

  if (lastAccountRow === -1) {
    if (block.dataEndRow < block.dataStartRow) {
      insertBeforeRow = block.dataStartRow;
    } else {
      insertBeforeRow = block.dataEndRow + 1;
    }
    sheet.insertRowBefore(insertBeforeRow);
    newRow = insertBeforeRow;
    templateRow = (newRow + 1 <= sheet.getLastRow()) ? (newRow + 1) : block.headerRow;
  } else {
    sheet.insertRowAfter(lastAccountRow);
    newRow = lastAccountRow + 1;
    templateRow = lastAccountRow;
  }

  sheet.getRange(templateRow, 1, 1, lastCol).copyTo(
    sheet.getRange(newRow, 1, 1, lastCol),
    SpreadsheetApp.CopyPasteType.PASTE_FORMAT,
    false
  );
  sheet.getRange(newRow, 1, 1, lastCol).clearContent();
  sheet.getRange(newRow, 1).setValue(accountName);
  // Column 2 in INPUT - Investments is "Type" (firstMonthCol = 3).
  sheet.getRange(newRow, 2).setValue(String(typeStr || ''));

  // New investments are Active = Yes. Historical rows created before the
  // Active column existed remain blank and are treated as active by readers.
  writeActiveCellWithRowFormat_(sheet, newRow, activeCol, 'Yes');

  return newRow;
}

function findAssetsTemplateRow_(sheet, headerMap) {
  const display = sheet.getDataRange().getDisplayValues();
  for (let r = display.length - 1; r >= 1; r--) {
    const name = String(display[r][headerMap.nameColZero] || '').trim();
    if (name) return r + 1;
  }
  return -1;
}

function appendAssetsRowForNewInvestment_(sheet, accountName, typeStr, currentBalance) {
  const headerMap = ensureAssetsActiveColumn_(sheet);
  const lastCol = Math.max(sheet.getLastColumn(), headerMap.nameCol, headerMap.activeCol);

  const row = [];
  for (let c = 0; c < lastCol; c++) row[c] = '';

  row[headerMap.nameColZero] = accountName;
  if (headerMap.typeColZero !== -1) row[headerMap.typeColZero] = String(typeStr || '');
  if (headerMap.balanceColZero !== -1) row[headerMap.balanceColZero] = round2_(toNumber_(currentBalance));
  if (headerMap.activeColZero !== -1) row[headerMap.activeColZero] = 'Yes';

  // Identify a neighbor row BEFORE appending so we can clone visual
  // treatment (borders, background, font, alignment, number formats)
  // onto the new row without touching the freshly written values.
  const templateRow = findAssetsTemplateRow_(sheet, headerMap);

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
      Logger.log('appendAssetsRowForNewInvestment_ format copy failed: ' + formatErr);
    }
  }

  if (headerMap.balanceCol !== -1) {
    const bc = sheet.getRange(appendedRow, headerMap.balanceCol);
    if (!String(bc.getNumberFormat() || '').match(/\$|#,##0/)) applyCurrencyFormat_(bc);
  }

  // Re-stamp Active with row-consistent formatting. The whole-row PASTE_FORMAT
  // copy above inherits the template row's Active cell style, which may
  // itself have defaulted to tiny text on older rows.
  if (headerMap.activeCol !== -1) {
    writeActiveCellWithRowFormat_(sheet, appendedRow, headerMap.activeCol, 'Yes');
  }
}

function deleteAssetsRowByExactName_(sheet, accountName) {
  const target = String(accountName || '').trim();
  if (!target) return;

  const headerMap = getAssetsHeaderMap_(sheet);
  const display = sheet.getDataRange().getDisplayValues();

  for (let r = 1; r < display.length; r++) {
    if (String(display[r][headerMap.nameColZero] || '').trim() === target) {
      sheet.deleteRow(r + 1);
      return;
    }
  }
}

/**
 * Creates a new investment account in the current year block of
 * INPUT - Investments, mirrors it to SYS - Assets (Active=Yes), optionally
 * seeds a starting value into the given month, and logs an `investment_add`
 * activity event. Mirrors addBankAccountFromDashboard / addHouseFromDashboard.
 *
 * @param {{
 *   accountName: string,
 *   type: string,
 *   startingBalance?: number|string,
 *   startingBalanceDate?: string
 * }} payload
 */
function addInvestmentAccountFromDashboard(payload) {
  validateRequired_(payload, ['accountName', 'type']);

  const accountName = validateNewInvestmentAccountName_(payload.accountName);
  const typeStr = String(payload.type || '').trim();
  if (!typeStr) throw new Error('Type is required.');
  if (typeStr.length > 80) throw new Error('Type is too long (max 80 characters).');

  const startDateStr = String(payload.startingBalanceDate || '').trim();
  const sbRaw = payload.startingBalance;
  const hasStartDate = !!startDateStr;
  const hasStartAmount =
    sbRaw !== '' && sbRaw !== null && sbRaw !== undefined && String(sbRaw).trim() !== '';

  let startDate = null;
  let startAmount = null;

  if (hasStartDate || hasStartAmount) {
    if (!hasStartDate || !hasStartAmount) {
      throw new Error('For a starting value, provide both date and amount.');
    }
    startDate = parseIsoDateLocal_(startDateStr);
    if (isNaN(startDate.getTime())) throw new Error('Invalid starting value date.');
    startAmount = round2_(toNumber_(sbRaw));
    if (isNaN(startAmount)) throw new Error('Starting value must be a valid number.');

    const cy = getCurrentYear_();
    if (startDate.getFullYear() !== cy) {
      throw new Error('Starting value date must be in ' + cy + ' (same year as the investment block you are extending).');
    }
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const invSheet = getSheet_(ss, 'INVESTMENTS');
  const assetsSheet = getSheet_(ss, 'ASSETS');
  const currentYear = getCurrentYear_();
  const block = getInvestmentsYearBlock_(invSheet, currentYear);

  let invRowNum = 0;
  try {
    invRowNum = insertNewInvestmentHistoryRow_(invSheet, block, accountName, typeStr);
  } catch (e) {
    throw new Error('Could not insert INPUT - Investments row: ' + (e.message || e));
  }

  try {
    appendAssetsRowForNewInvestment_(
      assetsSheet,
      accountName,
      typeStr,
      startAmount !== null ? startAmount : 0
    );
  } catch (e2) {
    invSheet.deleteRow(invRowNum);
    throw new Error('Could not add SYS - Assets row (rolled back INPUT row): ' + (e2.message || e2));
  }

  try {
    if (startDate && startAmount !== null) {
      updateInvestmentHistory_(accountName, currentYear, startDate, startAmount);
    }
    syncAllAssetsFromLatestCurrentYear_();
    touchDashboardSourceUpdated_('investments');
  } catch (e3) {
    deleteAssetsRowByExactName_(assetsSheet, accountName);
    invSheet.deleteRow(invRowNum);
    throw e3;
  }

  try {
    appendActivityLog_(ss, {
      eventType: 'investment_add',
      entryDate: Utilities.formatDate(stripTime_(new Date()), Session.getScriptTimeZone(), 'yyyy-MM-dd'),
      amount: startAmount !== null ? Math.abs(startAmount) : 0,
      direction: 'expense',
      payee: accountName,
      category: typeStr,
      accountSource: '',
      cashFlowSheet: '',
      cashFlowMonth: '',
      dedupeKey: '',
      details: JSON.stringify({
        detailsVersion: 1,
        year: currentYear,
        startingBalanceDate: startDateStr,
        startingBalance: startAmount
      })
    });
  } catch (logErr) {
    Logger.log('addInvestmentAccountFromDashboard activity log: ' + logErr);
  }

  return {
    ok: true,
    accountName: accountName,
    message:
      'Created investment account "' + accountName +
      '" on INPUT - Investments and SYS - Assets.'
  };
}

/**
 * Writes an Active value on every data row in every year block of
 * INPUT - Investments whose column A matches accountName (case-insensitive).
 * Self-heals the Active column in each block before writing.
 *
 * @returns {{ found: boolean, rowsUpdated: number, blocksScanned: number }}
 */
function setInvestmentActiveInAllBlocks_(sheet, accountName, value) {
  const target = String(accountName || '').trim().toLowerCase();
  const writeValue = String(value == null ? '' : value);
  let rowsUpdated = 0;
  let found = false;
  let blocksScanned = 0;

  forEachInvestmentsYearBlock_(sheet, function(block) {
    blocksScanned++;
    const activeCol = ensureInvestmentsActiveColumnForBlock_(sheet, block);

    for (let row = block.dataStartRow; row <= block.dataEndRow; row++) {
      const name = String(sheet.getRange(row, 1).getDisplayValue() || '').trim();
      if (!isInvestmentDataRowName_(name)) continue;
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
 * Writes an Active value on the matching SYS - Assets row. Self-heals the
 * Active column first so the write always lands in a real column.
 *
 * @returns {{ found: boolean, changed: boolean }}
 */
function setAssetsActiveValue_(sheet, accountName, value) {
  const target = String(accountName || '').trim().toLowerCase();
  const writeValue = String(value == null ? '' : value);

  const headerMap = ensureAssetsActiveColumn_(sheet);
  const display = sheet.getDataRange().getDisplayValues();

  for (let r = 1; r < display.length; r++) {
    const name = String(display[r][headerMap.nameColZero] || '').trim();
    if (!name) continue;
    if (name.toLowerCase() !== target) continue;

    const rowNum = r + 1;
    const cell = sheet.getRange(rowNum, headerMap.activeCol);
    const current = String(cell.getDisplayValue() || '').trim().toLowerCase();
    if (current === writeValue.toLowerCase()) {
      return { found: true, changed: false };
    }
    writeActiveCellWithRowFormat_(sheet, rowNum, headerMap.activeCol, writeValue);
    return { found: true, changed: true };
  }

  return { found: false, changed: false };
}

/**
 * Stop tracking an investment account: flips Active=No on every matching
 * INPUT - Investments row (across all year blocks) and on the mirror
 * SYS - Assets row. History (month values, Current Balance) is preserved;
 * the row is not deleted or renamed, so the name stays reserved against
 * reuse.
 *
 * @param {{ accountName: string }} payload
 */
function deactivateInvestmentAccountFromDashboard(payload) {
  validateRequired_(payload, ['accountName']);
  const accountName = String(payload.accountName || '').trim();
  if (!accountName) throw new Error('Account name is required.');

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const invSheet = getSheet_(ss, 'INVESTMENTS');
  const assetsSheet = getSheet_(ss, 'ASSETS');

  // 1) Canonical write across every year block.
  const invUpdate = setInvestmentActiveInAllBlocks_(invSheet, accountName, 'No');
  if (!invUpdate.found) {
    throw new Error('No rows found for "' + accountName + '" in INPUT - Investments.');
  }

  // 2) Mirror write on SYS - Assets.
  const assetsUpdate = setAssetsActiveValue_(assetsSheet, accountName, 'No');

  const alreadyInactive = invUpdate.rowsUpdated === 0 && !assetsUpdate.changed;

  // 3) Activity log (best-effort).
  try {
    const tz = Session.getScriptTimeZone();
    appendActivityLog_(ss, {
      eventType: 'investment_deactivate',
      entryDate: Utilities.formatDate(stripTime_(new Date()), tz, 'yyyy-MM-dd'),
      amount: 0,
      direction: 'expense',
      payee: accountName,
      category: '',
      accountSource: '',
      cashFlowSheet: '',
      cashFlowMonth: '',
      dedupeKey: '',
      details: JSON.stringify({
        detailsVersion: 1,
        reason: 'stop_tracking',
        invRowsUpdated: invUpdate.rowsUpdated,
        invBlocksScanned: invUpdate.blocksScanned,
        assetsRowFound: assetsUpdate.found,
        alreadyInactive: alreadyInactive
      })
    });
  } catch (logErr) {
    Logger.log('deactivateInvestmentAccountFromDashboard activity log: ' + logErr);
  }

  try {
    touchDashboardSourceUpdated_('investments');
  } catch (e) {
    /* best-effort */
  }

  const message = alreadyInactive
    ? '"' + accountName + '" was already marked inactive. History remains.'
    : 'Stopped tracking "' + accountName + '". History in INPUT - Investments and the SYS - Assets row remain.';

  return {
    ok: true,
    message: message,
    accountName: accountName,
    alreadyInactive: alreadyInactive,
    rowsUpdated: invUpdate.rowsUpdated + (assetsUpdate.changed ? 1 : 0)
  };
}