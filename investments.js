/* -------------------------------------------------------------------------- */
/*  Safe from-scratch creators (zero-sheet onboarding)                        */
/*                                                                            */
/*  Both helpers are idempotent no-ops when the sheet already exists —        */
/*  they return the existing Sheet object untouched. They never rewrite       */
/*  headers, clear data, or modify an existing sheet in any way. They         */
/*  are safe to call on every invocation of the add-investment flow.          */
/*                                                                            */
/*  Schema is derived from the current readers/writers in this file, not      */
/*  guessed:                                                                  */
/*    - getInvestmentsYearBlock_ scans column A for "Year" + <year> on        */
/*      row 1 and "Account Name" on row 2, uses firstMonthCol = 3, and        */
/*      terminates the block at the next "Account Totals" / "Delta" /        */
/*      "Year" row (or end of sheet). Month headers are MMM-YY (see          */
/*      parseMonthHeader_ in planner_helpers.js) — the insert path uses       */
/*      getMonthColumnByDate_ to match them.                                  */
/*    - ensureInvestmentsActiveColumnForBlock_ places "Active" at             */
/*      firstMonthCol + 12 (col O) when a new investment is added, so         */
/*      the canonical 15-column layout is Account Name | Type | Jan-YY        */
/*      … Dec-YY | Active.                                                   */
/*    - getAssetsHeaderMap_ requires "Account Name" and "Current Balance".    */
/*      "Type" and "Active" are optional in the reader but the add path       */
/*      always writes them, so we seed all four.                              */
/*                                                                            */
/*  Aggregate rows (Account Totals / Delta) are intentionally NOT seeded:     */
/*  current logic does not depend on them (getInvestmentsYearBlock_ falls     */
/*  back to sheet.getLastRow() as dataEndRow when absent, the insert path     */
/*  handles that case via the `dataEndRow < dataStartRow` branch, and         */
/*  refreshBlockSumAggregates_ is a no-op with nothing to refresh). The       */
/*  user can add them manually once they have data if they want totals —     */
/*  this matches the user's instruction to only seed aggregate rows "if       */
/*  current logic truly depends on them".                                     */
/* -------------------------------------------------------------------------- */

/**
 * Canonical from-scratch creator for `INPUT - Investments`.
 *
 * Safety contract:
 *   - Idempotent: if the sheet already exists, returns it untouched. No
 *     header rewrite, no re-styling of existing data.
 *   - Never overwrites data on an existing sheet.
 *   - Never deletes or renames any sheet.
 *
 * Canonical structure written only on first creation:
 *   Row 1:   Year | <currentYear>                     (orange banner)
 *   Row 2:   Account Name | Type | Jan-YY | Feb-YY |   (yellow banner)
 *            … | Dec-YY | Active                     (cols 1..15)
 *   Data:    (none — addInvestmentAccountFromDashboard inserts on write)
 *
 * @returns {GoogleAppsScript.Spreadsheet.Sheet} the sheet (existing or new)
 */
function ensureInputInvestmentsSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const names = getSheetNames_();
  const sheetName = names.INVESTMENTS;

  const existing = ss.getSheetByName(sheetName);
  if (existing) return existing;

  let sheet;
  try {
    sheet = ss.insertSheet(sheetName);
  } catch (e) {
    // Race: another path may have just created it. Prefer the existing
    // sheet over a new one so we never end up with "Sheet 2"-style dupes.
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

  // Row 1: Year banner.
  sheet.getRange(1, 1, 1, 2).setValues([['Year', year]]);

  // Row 2: column headers. Col 1 Account Name, col 2 Type, cols 3..14
  // the 12 MMM-YY month columns (firstMonthCol = 3), col 15 Active —
  // matches ensureInvestmentsActiveColumnForBlock_(block.firstMonthCol + 12).
  const headers = ['Account Name', 'Type'];
  for (let i = 0; i < monthLabels.length; i++) {
    headers.push(monthLabels[i] + '-' + yy);
  }
  headers.push('Active');
  sheet.getRange(2, 1, 1, headers.length).setValues([headers]);

  // Cosmetic polish — cosmetic only, wrapped in try/catch so a formatting
  // hiccup never fails the structural creation. Matches the existing
  // applyInvestmentsSheetStyling_ pattern (warm orange Year banner,
  // warm yellow Account Name header, frozen col A + col B).
  try {
    applyInvestmentsSheetStyling_(sheet);
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
 * Canonical from-scratch creator for `SYS - Assets`.
 *
 * Flat 4-column table consumed by getAssetsHeaderMap_ (which requires
 * "Account Name" + "Current Balance" and treats "Type" + "Active" as
 * optional). The add path always writes all four, so we seed them all.
 *
 * Safety contract: idempotent no-op when the sheet already exists. Never
 * overwrites or re-styles populated sheets.
 *
 * @returns {GoogleAppsScript.Spreadsheet.Sheet}
 */
function ensureSysAssetsSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const names = getSheetNames_();
  const sheetName = names.ASSETS;

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

  // Header order mirrors what getAssetsHeaderMap_ looks up by label;
  // positions are not load-bearing but we keep them consistent with the
  // usual convention (identifier → categorization → money → state).
  const headers = ['Account Name', 'Type', 'Current Balance', 'Active'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  // Pre-format the Current Balance column so the first currency value
  // the add path writes renders correctly. Bounded to the sheet's
  // current max rows — consistent with the rest of the workbook's
  // creators (no whole-column formatting).
  try {
    const maxRowsAssets = sheet.getMaxRows();
    if (maxRowsAssets > 1) {
      sheet.getRange(2, 3, maxRowsAssets - 1, 1)
        .setNumberFormat('$#,##0.00;-$#,##0.00');
    }
  } catch (_fmtErr) { /* cosmetic only */ }

  try {
    applyAssetsSheetStyling_(sheet);
  } catch (_styleErr) { /* cosmetic only */ }

  try {
    sheet.autoResizeColumns(1, headers.length);
  } catch (_resizeErr) { /* cosmetic only */ }

  return sheet;
}

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
  // Blank-workbook safety: on a fresh sheet INPUT - Investments does
  // not exist yet and getInvestmentsFromHistory_() -> getSheet_() would
  // throw a red banner on the Investments page. Return the same shape
  // with empty lists so the page renders clean. The populated path
  // below is unchanged.
  const ssEarly = SpreadsheetApp.getActiveSpreadsheet();
  if (!ssEarly.getSheetByName(getSheetNames_().INVESTMENTS)) {
    return { accounts: [], typeOptions: [] };
  }

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
    message: 'Investment value updated.'
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
    throw new Error('Could not find Year block for ' + year + ' in Investments.');
  }

  const headerRow = yearRow + 1;
  const headerName = String(sheet.getRange(headerRow, 1).getDisplayValue() || '').trim();
  if (headerName !== 'Account Name') {
    throw new Error('Expected Account Name header row for Year ' + year + ' in Investments.');
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
    throw new Error('Assets sheet must contain Account Name.');
  }

  if (balanceColZero === -1) {
    throw new Error('Assets sheet must contain Current Balance.');
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
      throw new Error('An investment account named "' + existing[i] + '" already exists.');
    }
  }

  if (assetExistsInAssetsSheet_(name)) {
    throw new Error('An investment account with that name already exists.');
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

  // Refresh the block's "Account Totals" simple SUM formulas to cover
  // the new data row. See refreshBlockSumAggregates_ for rationale: a
  // row inserted at the lower boundary of `=SUM(C{start}:C{lastAccount})`
  // is NOT picked up by Google Sheets' auto-expansion, which would
  // cause a newly-added account to silently drop out of the user's
  // Account Totals.
  //
  // Delta is intentionally NOT in the target-label set. Delta rows in
  // the user's Investments sheet are typically YoY or period diffs
  // (e.g. `=N5-C5`), not sums of data rows, and the helper's strict
  // `=SUM(<L><N>:<L><M>)` match would leave them alone anyway; we pass
  // only ['Account Totals'] to make intent explicit.
  const newDataStartRow = block.dataStartRow;
  const newDataEndRow = Math.max(newRow, block.dataEndRow + 1);
  try {
    refreshBlockSumAggregates_(
      sheet,
      newDataStartRow,
      newDataEndRow,
      newDataEndRow + 1,
      ['Account Totals']
    );
  } catch (_aggErr) { /* defense in depth only */ }

  // Re-assert canonical banner styling on the whole sheet. Idempotent —
  // repeated adds don't flicker or accumulate cost. Never load-bearing —
  // failures are swallowed inside the helper.
  try { applyInvestmentsSheetStyling_(sheet); } catch (_) { /* cosmetic only */ }

  return newRow;
}

/**
 * Idempotent canonical styling for `INPUT - Investments`.
 *
 * Mirrors the year-block pattern used by INPUT - House Values, but with
 * investments-specific banner labels. Walks the sheet top-to-bottom
 * scanning column A for the four block markers and asserts the
 * canonical fill / bold / row height the user's sheet already relies
 * on, so new blocks / newly-inserted rows never drift from the
 * canonical look:
 *
 *   - "Year"            → orange  #f4a300, bold black, row height 28
 *   - "Account Name"    → yellow  #fff200, bold black, centered, row height 32
 *                         (only when col B reads "Type" — disambiguates
 *                          from any legitimate data row whose col A just
 *                          happens to be the word "Account Name")
 *   - "Account Totals"  → green   #b6d7a8, bold black
 *   - "Delta"           → pink    #f4cccc, bold black
 *
 * Data rows (everything else) are deliberately left untouched so the
 * user's own conditional formatting on month cells (gain-green /
 * loss-red text) is preserved.
 *
 * All failures are swallowed — cosmetic only; must never fail an
 * Investments write on a formatting glitch. Safe to call from every
 * add-row / rollover path.
 */
function applyInvestmentsSheetStyling_(sheet) {
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
      } else if (marker === 'Account Name') {
        let colB = '';
        try {
          colB = String(sheet.getRange(row1, 2).getDisplayValue() || '').trim();
        } catch (_) { /* skip styling when col B cannot be read */ }
        if (colB === 'Type') {
          sheet.getRange(row1, 1, 1, lastCol)
            .setBackground('#fff200')
            .setFontWeight('bold')
            .setFontColor('#000000')
            .setHorizontalAlignment('center')
            .setVerticalAlignment('middle');
          try { sheet.setRowHeight(row1, 32); } catch (_) {}
        }
      } else if (marker === 'Account Totals') {
        sheet.getRange(row1, 1, 1, lastCol)
          .setBackground('#b6d7a8')
          .setFontWeight('bold')
          .setFontColor('#000000');
      } else if (marker === 'Delta') {
        sheet.getRange(row1, 1, 1, lastCol)
          .setBackground('#f4cccc')
          .setFontWeight('bold')
          .setFontColor('#000000');
      }
    } catch (_styleErr) { /* cosmetic only */ }
  }

  // Freeze columns A (Account Name) and B (Type) so both stay pinned
  // when scrolling across the 12 month columns. Idempotent — no-op
  // when already frozen.
  try { sheet.setFrozenColumns(2); } catch (_) { /* cosmetic */ }
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

  // Re-assert the canonical SYS - Assets header styling. Idempotent,
  // cosmetic only; failures are swallowed inside the helper so an
  // Assets write is never blocked by a formatting glitch.
  try { applyAssetsSheetStyling_(sheet); } catch (_) { /* cosmetic */ }
}

/**
 * Idempotent canonical styling for `SYS - Assets`.
 *
 * Flat 4-column table (Account Name / Type / Current Balance / Active)
 * with no year blocks and no footer rows. Only row 1 needs styling —
 * the data rows are append-only and each new row inherits formatting
 * from a neighbor template via PASTE_FORMAT (see
 * `appendAssetsRowForNewInvestment_` above), so their visual treatment
 * is already consistent.
 *
 * Assertions:
 *   - Header row (row 1) → yellow #fff200, bold black, centered
 *     horizontal / middle vertical, row height 32.
 *   - Solid-medium black bottom border under row 1 to separate header
 *     from the data body.
 *   - Frozen row 1 + frozen column 1 so Account Name stays pinned
 *     when scrolling.
 *
 * Data rows, number formats, and any user cell highlights are
 * deliberately never touched. Failures are swallowed — cosmetic only.
 */
function applyAssetsSheetStyling_(sheet) {
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

  // Starting amount: default to 0 when omitted (blank is treated as 0).
  let startAmount = 0;
  if (hasStartAmount) {
    startAmount = round2_(toNumber_(sbRaw));
    if (isNaN(startAmount)) throw new Error('Starting value must be a valid number.');
  }

  // Starting date: if provided, validate; if blank, default to today so the
  // month column is always deterministic.
  let startDate;
  if (hasStartDate) {
    startDate = parseIsoDateLocal_(startDateStr);
    if (isNaN(startDate.getTime())) throw new Error('Invalid starting value date.');
    const cy = getCurrentYear_();
    if (startDate.getFullYear() !== cy) {
      throw new Error('Starting value date must be in ' + cy + ' (same year as the investment block you are extending).');
    }
  } else {
    startDate = stripTime_(new Date());
  }

  // Ensure-before-write guards. Both helpers are idempotent no-ops on
  // populated workbooks (sheet exists → returned untouched). On a fresh
  // workbook they write the canonical structure getInvestmentsYearBlock_
  // and getAssetsHeaderMap_ expect on the very next line. Re-surface any
  // failure as an actionable user-facing message instead of the raw
  // "Missing sheet: …" banner. Matches the Bank Accounts pattern in
  // addBankAccountFromDashboard → bank_accounts.js.
  try {
    ensureInputInvestmentsSheet_();
  } catch (ensureErr) {
    throw new Error(
      'Could not prepare INPUT - Investments: ' +
      (ensureErr && ensureErr.message ? ensureErr.message : ensureErr)
    );
  }
  try {
    ensureSysAssetsSheet_();
  } catch (sysErr) {
    throw new Error(
      'Could not prepare SYS - Assets: ' +
      (sysErr && sysErr.message ? sysErr.message : sysErr)
    );
  }
  // Flush so the fresh Spreadsheet handle below sees the structural
  // writes — without this, getSheet_ can still miss a just-inserted
  // sheet on some Apps Script executions.
  try { SpreadsheetApp.flush(); } catch (_flushErr) { /* best-effort */ }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const invSheet = getSheet_(ss, 'INVESTMENTS');
  const assetsSheet = getSheet_(ss, 'ASSETS');
  const currentYear = getCurrentYear_();
  const block = getInvestmentsYearBlock_(invSheet, currentYear);

  let invRowNum = 0;
  try {
    invRowNum = insertNewInvestmentHistoryRow_(invSheet, block, accountName, typeStr);
  } catch (e) {
    throw new Error('Could not insert investment row: ' + (e.message || e));
  }

  try {
    appendAssetsRowForNewInvestment_(
      assetsSheet,
      accountName,
      typeStr,
      startAmount
    );
  } catch (e2) {
    invSheet.deleteRow(invRowNum);
    throw new Error('Could not add asset record (rolled back the investment row): ' + (e2.message || e2));
  }

  try {
    // Preserve historical "leave month empty for 0" semantic: only seed the
    // month column when we actually have a non-zero amount.
    if (startAmount !== 0) {
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
      amount: Math.abs(startAmount),
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
      'Created investment account "' + accountName + '".'
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
    throw new Error('No rows found for "' + accountName + '" in Investments.');
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
    : 'Stopped tracking "' + accountName + '". History is preserved.';

  return {
    ok: true,
    message: message,
    accountName: accountName,
    alreadyInactive: alreadyInactive,
    rowsUpdated: invUpdate.rowsUpdated + (assetsUpdate.changed ? 1 : 0)
  };
}