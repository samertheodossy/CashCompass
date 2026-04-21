/**
 * Create-Next-Year-Cash-Flow tool.
 *
 * Phase 2: fully layout-driven so that the optional "Flow Source" column
 * (CASH / CREDIT_CARD / blank) between "Type" and "Payee" does not break the
 * copy. All column positions are detected from the source sheet's header row
 * — nothing about `A`, `B`, or `C:N` is hardcoded anymore.
 *
 * Backward compatibility: legacy year tabs that predate the Flow Source
 * column copy through unchanged (flowSourceCol0 === -1 is handled).
 */

function createNextYearCashFlowSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const currentYear = new Date().getFullYear();
  const nextYear = currentYear + 1;

  const sourceSheet = getCashFlowSheet_(ss, currentYear);
  const targetName = getCashFlowSheetName_(nextYear);

  if (ss.getSheetByName(targetName)) {
    SpreadsheetApp.getUi().alert('Sheet already exists: ' + targetName + '. Delete it first, then run again.');
    return;
  }

  const sourceRange = sourceSheet.getDataRange();
  const sourceValues = sourceRange.getValues();
  const numRows = sourceValues.length;
  if (!numRows) {
    throw new Error('Source Cash Flow sheet "' + sourceSheet.getName() + '" is empty.');
  }

  const layout = detectCashFlowLayout_(sourceValues[0]);
  const numCols = layout.numCols;

  const newSheet = ss.insertSheet(targetName);

  sourceRange.copyTo(
    newSheet.getRange(1, 1),
    SpreadsheetApp.CopyPasteType.PASTE_FORMAT,
    false
  );

  for (let r = 1; r <= numRows; r++) {
    newSheet.setRowHeight(r, sourceSheet.getRowHeight(r));
  }

  for (let c = 1; c <= numCols; c++) {
    newSheet.setColumnWidth(c, sourceSheet.getColumnWidth(c));
  }

  const headerRow = buildCashFlowHeaderRow_(sourceValues[0], layout, nextYear);

  const newValues = [headerRow];

  for (let r = 1; r < numRows; r++) {
    const rowType = String(sourceValues[r][layout.typeCol0] || '').trim();
    const rowPayee = String(sourceValues[r][layout.payeeCol0] || '').trim();
    const isSummaryRow = rowType === 'Summary' && rowPayee === 'Cash Flow Per Month';

    const row = [];
    for (let c = 0; c < numCols; c++) {
      if (layout.monthColSet[c]) {
        // Wipe all month amounts — next year starts clean.
        row.push('');
      } else if (isSummaryRow && layout.totalCol0 !== -1 && c === layout.totalCol0) {
        // Clear the Summary row's yearly total so the formula we write below
        // is the sole source of truth.
        row.push('');
      } else {
        // Copy Type, Flow Source (if present), Payee, and anything else
        // (notes columns, total formulas on non-Summary rows, etc.) verbatim.
        row.push(sourceValues[r][c]);
      }
    }

    newValues.push(row);
  }

  newSheet.getRange(1, 1, numRows, numCols).setValues(newValues);

  // Force each month header cell to plain text so "Jan-27" stays "Jan-27"
  // instead of getting auto-parsed by Sheets as a date.
  for (let i = 0; i < layout.monthCol0s.length; i++) {
    const col1 = layout.monthCol0s[i] + 1;
    const cell = newSheet.getRange(1, col1);
    cell.setNumberFormat('@STRING@');
    cell.setValue(headerRow[col1 - 1]);
  }

  // Re-apply currency format to the data body under each month header.
  for (let i = 0; i < layout.monthCol0s.length; i++) {
    const col1 = layout.monthCol0s[i] + 1;
    newSheet.getRange(2, col1, Math.max(1, numRows - 1), 1)
      .setNumberFormat('$#,##0.00;-$#,##0.00');
  }

  const summaryRow = findCashFlowSummaryRow_(newSheet, numRows, layout);
  if (summaryRow > 0) {
    writeCashFlowSummaryFormulas_(newSheet, summaryRow, layout);
  }

  newSheet.setFrozenRows(sourceSheet.getFrozenRows());
  newSheet.setFrozenColumns(sourceSheet.getFrozenColumns());

  ss.setActiveSheet(newSheet);
  SpreadsheetApp.getUi().alert('Created clean sheet: ' + targetName);
}

/**
 * Scan the header row of an `INPUT - Cash Flow YYYY` sheet and return the
 * zero-based (and 1-based) positions of the structural columns. "Flow Source"
 * is optional; on legacy sheets it simply comes back as -1 and callers branch
 * accordingly. A sheet is considered valid as long as Type, Payee, and at
 * least one MMM-YY month column are present.
 *
 * The `totalCol0` heuristic mirrors the legacy behavior: if there is any
 * column strictly to the right of the last month column, the right-most one
 * is treated as the yearly-total column. This keeps user-added layouts
 * (e.g. a trailing "Notes" column) from silently getting stomped.
 */
function detectCashFlowLayout_(headerRowValues) {
  const headers = (headerRowValues || []).map(function(h) {
    return String(h == null ? '' : h).trim();
  });

  const typeCol0 = headers.indexOf('Type');
  const payeeCol0 = headers.indexOf('Payee');
  const flowSourceCol0 = headers.indexOf('Flow Source');
  const activeCol0 = headers.indexOf('Active');

  if (typeCol0 === -1 || payeeCol0 === -1) {
    throw new Error(
      'Cash Flow source sheet must contain "Type" and "Payee" headers in row 1.'
    );
  }

  const monthCol0s = [];
  const monthColSet = {};
  for (let c = 0; c < headers.length; c++) {
    if (parseMonthHeader_(headers[c])) {
      monthCol0s.push(c);
      monthColSet[c] = true;
    }
  }

  if (!monthCol0s.length) {
    throw new Error(
      'Cash Flow source sheet must contain at least one MMM-YY month column.'
    );
  }

  const firstMonthCol0 = monthCol0s[0];
  const lastMonthCol0 = monthCol0s[monthCol0s.length - 1];
  const numCols = headers.length;
  const totalCol0 = (numCols - 1 > lastMonthCol0) ? (numCols - 1) : -1;

  return {
    typeCol0: typeCol0,
    typeCol1: typeCol0 + 1,
    payeeCol0: payeeCol0,
    payeeCol1: payeeCol0 + 1,
    flowSourceCol0: flowSourceCol0,
    flowSourceCol1: flowSourceCol0 === -1 ? -1 : flowSourceCol0 + 1,
    // `Active` (YES/NO/blank) is optional metadata that drives the HELOC
    // realism layer. Like Flow Source, it's -1 on legacy sheets — callers
    // MUST branch on `activeCol0 !== -1` before reading/writing.
    activeCol0: activeCol0,
    activeCol1: activeCol0 === -1 ? -1 : activeCol0 + 1,
    monthCol0s: monthCol0s,
    monthColSet: monthColSet,
    firstMonthCol0: firstMonthCol0,
    firstMonthCol1: firstMonthCol0 + 1,
    lastMonthCol0: lastMonthCol0,
    lastMonthCol1: lastMonthCol0 + 1,
    totalCol0: totalCol0,
    totalCol1: totalCol0 === -1 ? -1 : totalCol0 + 1,
    numCols: numCols
  };
}

/**
 * Build the next year's header row. Non-month columns (Type, Flow Source,
 * Payee, Total, Notes, …) are copied verbatim. Each month column is
 * re-labelled with the next year's suffix while preserving the *month name*
 * that was in the source cell — so odd source layouts (partial-year sheets,
 * custom ordering) continue to work.
 */
function buildCashFlowHeaderRow_(sourceHeaderRow, layout, year) {
  const suffix = String(year).slice(-2);
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const row = new Array(layout.numCols);
  for (let c = 0; c < layout.numCols; c++) {
    row[c] = sourceHeaderRow[c];
  }

  for (let i = 0; i < layout.monthCol0s.length; i++) {
    const col = layout.monthCol0s[i];
    const parsed = parseMonthHeader_(sourceHeaderRow[col]);
    if (!parsed) continue;
    const monthName = monthNames[parsed.getMonth()];
    row[col] = monthName + '-' + suffix;
  }

  return row;
}

/**
 * Locate the "Summary | Cash Flow Per Month" row by header-driven Type/Payee
 * lookups. Returns a 1-based row number, or -1 if not found.
 */
function findCashFlowSummaryRow_(sheet, numRows, layout) {
  const lastCol = Math.max(sheet.getLastColumn(), layout.numCols);
  const values = sheet.getRange(2, 1, Math.max(1, numRows - 1), lastCol).getDisplayValues();

  for (let i = 0; i < values.length; i++) {
    const type = String(values[i][layout.typeCol0] || '').trim();
    const payee = String(values[i][layout.payeeCol0] || '').trim();

    if (type === 'Summary' && payee === 'Cash Flow Per Month') {
      return i + 2;
    }
  }

  return -1;
}

/**
 * Write the Summary-row formulas:
 *   - one SUMIF("Income") + SUMIF("Expense") per month column, keyed off the
 *     DETECTED Type column letter (not hardcoded "$A").
 *   - one =SUM(firstMonth:lastMonth) yearly total, if a total column exists.
 *
 * The Flow Source column is intentionally ignored by these formulas — it's
 * metadata, not an amount.
 */
function writeCashFlowSummaryFormulas_(sheet, summaryRow, layout) {
  const firstDataRow = 2;
  const lastDataRow = summaryRow - 1;
  const typeColLetter = columnToLetter_(layout.typeCol1);

  for (let i = 0; i < layout.monthCol0s.length; i++) {
    const monthCol1 = layout.monthCol0s[i] + 1;
    const colLetter = columnToLetter_(monthCol1);

    const typeRange =
      '$' + typeColLetter + '$' + firstDataRow +
      ':$' + typeColLetter + '$' + lastDataRow;
    const monthRange =
      colLetter + '$' + firstDataRow +
      ':' + colLetter + '$' + lastDataRow;

    const formula =
      '=SUMIF(' + typeRange + ',"Income",' + monthRange + ')' +
      '+SUMIF(' + typeRange + ',"Expense",' + monthRange + ')';

    const cell = sheet.getRange(summaryRow, monthCol1);
    cell.setFormula(formula);
    cell.setNumberFormat('$#,##0.00;-$#,##0.00');
  }

  if (layout.totalCol0 !== -1) {
    const firstMonthLetter = columnToLetter_(layout.firstMonthCol1);
    const lastMonthLetter = columnToLetter_(layout.lastMonthCol1);
    const totalCell = sheet.getRange(summaryRow, layout.totalCol1);
    totalCell.setFormula(
      '=SUM(' + firstMonthLetter + summaryRow + ':' + lastMonthLetter + summaryRow + ')'
    );
    totalCell.setNumberFormat('$#,##0.00;-$#,##0.00');
  }
}

function columnToLetter_(column) {
  let temp = '';
  let letter = '';

  while (column > 0) {
    temp = (column - 1) % 26;
    letter = String.fromCharCode(temp + 65) + letter;
    column = (column - temp - 1) / 26;
  }

  return letter;
}

/* -------------------------------------------------------------------------- */
/*  Safe from-scratch Cash Flow year creator (zero-sheet onboarding)          */
/* -------------------------------------------------------------------------- */

/**
 * Canonical from-scratch creator for `INPUT - Cash Flow <year>`.
 *
 * Safety contract (non-negotiable):
 *   - If the sheet already exists this function is a hard no-op. It
 *     returns the existing sheet and NEVER rewrites headers, clears
 *     cells, or inspects user data.
 *   - Never deletes, renames, or replaces any sheet.
 *   - Never touches other years' Cash Flow sheets, SYS sheets, or any
 *     unrelated sheet.
 *   - Only creates the sheet if it is missing.
 *   - Idempotent and rerunnable.
 *
 * Canonical structure written on first creation (derived from existing
 * readers / writers, not guessed):
 *   Row 1 headers:
 *     A = 'Type'         (required by getCashFlowHeaderMap_)
 *     B = 'Flow Source'  (optional column, included up-front so Quick
 *                         Add and bill-routing work without the self-
 *                         heal column-inserter running later)
 *     C = 'Payee'        (required by getCashFlowHeaderMap_)
 *     D = 'Active'       (optional metadata; YES / NO / blank, blank is
 *                         treated as YES by every consumer. Seeded so
 *                         income detection and HELOC realism have the
 *                         column available immediately)
 *     E..P = 'Jan-YY' .. 'Dec-YY'  (MMM-YY pattern matched by
 *                                   parseMonthHeader_; plain-text
 *                                   formatted so Sheets does not
 *                                   auto-parse them as dates)
 *     Q = 'Total'        (optional total column, recognized by
 *                         detectCashFlowLayout_ as the rightmost
 *                         post-month column)
 *
 *   No data rows. No Summary row. Both the Summary row and any data
 *   rows are written incrementally by Quick Add / createNextYearCash-
 *   FlowSheet. Quick Add (insertCashFlowRow_) and
 *   findCashFlowSummaryRow_ both already handle the absent-Summary-row
 *   case gracefully by appending at the last row.
 *
 *   Frozen rows: 1. Month cells and Total column formatted as currency.
 *
 * @param {number|string=} year Defaults to the current calendar year.
 * @returns {GoogleAppsScript.Spreadsheet.Sheet} The (possibly newly
 *     created) Cash Flow sheet.
 * @throws {Error} If the resolved year is not a positive integer, or if
 *     sheet insertion fails for a non-race reason.
 */
function ensureCashFlowYearSheet_(year) {
  const yearNum = Number(
    (year === undefined || year === null || year === '')
      ? getCurrentYear_()
      : year
  );
  if (!Number.isFinite(yearNum) || yearNum <= 0 || Math.floor(yearNum) !== yearNum) {
    throw new Error('ensureCashFlowYearSheet_: invalid year: ' + String(year));
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetName = getCashFlowSheetName_(yearNum);

  const existing = ss.getSheetByName(sheetName);
  if (existing) {
    return existing;
  }

  let sheet;
  try {
    sheet = ss.insertSheet(sheetName);
  } catch (e) {
    const raced = ss.getSheetByName(sheetName);
    if (raced) return raced;
    throw e;
  }

  // Header row: columns must match the canonical order the rest of the
  // app uses. Column identities are resolved by header label everywhere
  // (getCashFlowHeaderMap_ / detectCashFlowLayout_), so we are free to
  // choose the order here — we deliberately mirror what a sheet cloned
  // via createNextYearCashFlowSheet from a canonical prior year would
  // look like.
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const suffix = String(yearNum).slice(-2);
  const monthHeaders = monthNames.map(function(m) { return m + '-' + suffix; });

  const headerRow = ['Type', 'Flow Source', 'Payee', 'Active']
    .concat(monthHeaders)
    .concat(['Total']);

  try {
    sheet.getRange(1, 1, 1, headerRow.length).setValues([headerRow]);
  } catch (e) {
    // Surface the error rather than leaving a half-built sheet. We do
    // NOT attempt to delete the sheet — the safety contract forbids
    // deletes, and a manually-emptied sheet is recoverable.
    throw new Error(
      'Cash Flow sheet "' + sheetName +
      '" was created but header write failed: ' + (e && e.message ? e.message : e)
    );
  }

  // Pin month headers as plain text so Sheets does not auto-parse
  // "Jan-26" into a Date. Must happen AFTER setValues so the string
  // representation is stable.
  const firstMonthCol1 = 5; // A=Type, B=Flow Source, C=Payee, D=Active, E=Jan
  const lastMonthCol1 = firstMonthCol1 + monthHeaders.length - 1;
  try {
    for (let i = 0; i < monthHeaders.length; i++) {
      const col1 = firstMonthCol1 + i;
      const cell = sheet.getRange(1, col1);
      cell.setNumberFormat('@STRING@');
      cell.setValue(monthHeaders[i]);
    }
  } catch (e) {
    // Plain-text pinning is defensive; losing it does not corrupt
    // readers (they trim and regex-match). Do not fail the whole op.
  }

  // Currency format for the month columns and the Total column. Empty
  // cells render as blank; numeric entries render as "$1,234.56".
  try {
    const totalCol1 = lastMonthCol1 + 1;
    sheet.getRange(2, firstMonthCol1, sheet.getMaxRows() - 1, monthHeaders.length)
      .setNumberFormat('$#,##0.00;-$#,##0.00');
    sheet.getRange(2, totalCol1, sheet.getMaxRows() - 1, 1)
      .setNumberFormat('$#,##0.00;-$#,##0.00');
  } catch (e) {
    // Number format is cosmetic; do not fail the ensure op.
  }

  // Cosmetic polish — never load-bearing.
  try {
    sheet.getRange(1, 1, 1, headerRow.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
    sheet.autoResizeColumns(1, headerRow.length);
  } catch (e) { /* cosmetic only */ }

  return sheet;
}

/**
 * Wrapper suitable for the centralized bootstrap registry. Keeps the
 * same return shape as the other ensureOnboarding*SheetFromDashboard
 * helpers so ensureBootstrapSheet_ can normalize results uniformly.
 *
 * Normal mode only — test Cash Flow sheets are cloned by
 * ensureOnboardingTestSheetsFromDashboard and must not be routed
 * through this path.
 */
function ensureOnboardingCashFlowYearSheetFromDashboard(mode) {
  const m = (typeof normalizeOnboardingMode_ === 'function')
    ? normalizeOnboardingMode_(mode)
    : ((String(mode || '').toLowerCase() === 'test') ? 'test' : 'normal');
  const year = getCurrentYear_();
  const sheetName = getCashFlowSheetName_(year);

  if (m === 'test') {
    return {
      ok: true,
      created: false,
      sheetName: sheetName,
      mode: m,
      reason: 'Test mode: use ensureOnboardingTestSheetsFromDashboard instead.'
    };
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const existed = !!ss.getSheetByName(sheetName);
  if (existed) {
    return { ok: true, created: false, sheetName: sheetName, mode: m };
  }

  try {
    ensureCashFlowYearSheet_(year);
  } catch (e) {
    return {
      ok: false,
      created: false,
      sheetName: sheetName,
      mode: m,
      reason: 'Could not create Cash Flow sheet: ' + (e && e.message ? e.message : e)
    };
  }

  return {
    ok: true,
    created: !!ss.getSheetByName(sheetName) && !existed,
    sheetName: sheetName,
    mode: m
  };
}
