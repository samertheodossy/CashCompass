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
  const ss = getUserSpreadsheet_();
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
      .setNumberFormat('$#,##0.00;[Red]-$#,##0.00');
  }

  const summaryRow = findCashFlowSummaryRow_(newSheet, numRows, layout);
  if (summaryRow > 0) {
    writeCashFlowSummaryFormulas_(newSheet, summaryRow, layout);
  }

  newSheet.setFrozenRows(sourceSheet.getFrozenRows());
  newSheet.setFrozenColumns(sourceSheet.getFrozenColumns());

  // Layer the canonical header/Summary styling on top of the copied
  // formatting. PASTE_FORMAT above reproduces whatever was on the source
  // sheet — when that source is a legacy sheet created before the
  // styling pass the new year inherits the unstyled look. Applying
  // the helpers here guarantees the new year reads like the reference
  // layout regardless of source vintage.
  try {
    applyCashFlowSheetStyling_(newSheet, layout);
    if (summaryRow > 0) {
      applyCashFlowSummaryRowStyling_(newSheet, summaryRow, layout);
    }
    // Canonical body font (FIRST-CREATE clone). This sheet is brand-new this
    // run (not an existing user workbook), so washing body font to the
    // canonical 14pt is safe and guarantees canonical typography regardless
    // of the source year's vintage. Row heights are intentionally left as
    // copied from the source above — Phase A does not restyle clone heights.
    const maxRowsClone = newSheet.getMaxRows();
    if (maxRowsClone > 1) {
      newSheet.getRange(2, 1, maxRowsClone - 1, numCols).setFontSize(CANON_FONT_BODY_);
    }
    // Golden Workbook row-type text colors (FIRST-CREATE clone): Income
    // green, Expense red, via conditional formatting on the new sheet.
    applyCashFlowRowTypeColorRules_(newSheet, layout);
  } catch (_styleErr) { /* cosmetic only */ }

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
 * Cash Flow "financial health" text colors — the Golden Workbook color language
 * shared by BOTH Income/Expense row coloring (applyCashFlowRowTypeColorRules_)
 * AND the Summary-row net coloring (applyCashFlowSummaryHealthColorRules_), so
 * there is ONE definition of each color. Dark green / dark red (Google's palette
 * shades). Applied via CONDITIONAL FORMATTING font color — NOT number-format
 * color codes, whose bright [Green]/[Red] primaries cannot match these hexes.
 */
const CASH_FLOW_HEALTH_COLOR_POSITIVE_ = '#38761d'; // Income rows + positive net
const CASH_FLOW_HEALTH_COLOR_NEGATIVE_ = '#cc0000'; // Expense rows + negative net

/**
 * Cash Flow Summary-row number format — NEUTRAL currency only (ratified
 * ProductDecision 2026-07-11; refined to CF-based coloring 2026-07-11). The net
 * COLOR of the "Summary | Cash Flow Per Month" values (positive green, negative
 * red, zero neutral black) is applied by CONDITIONAL FORMATTING
 * (applyCashFlowSummaryHealthColorRules_) so it EXACTLY matches the Income/
 * Expense color language (#38761d / #cc0000). The number format therefore
 * carries NO color codes — it only formats currency and the negative sign. Three
 * sections keep positive / negative / zero visually identical apart from the CF
 * color, and zero (no CF match) shows the cell's default black. Income/Expense
 * DATA rows keep the sheet-wide `$#,##0.00;[Red]-$#,##0.00` set in
 * ensureCashFlowYearSheet_.
 */
const CASH_FLOW_SUMMARY_HEALTH_NUMBER_FORMAT_ = '$#,##0.00;-$#,##0.00;$#,##0.00';

/**
 * Write the Summary-row formulas:
 *   - one SUMIF("Income") + SUMIF("Expense") per month column, keyed off the
 *     DETECTED Type column letter (not hardcoded "$A").
 *   - one =SUM(firstMonth:lastMonth) yearly total, if a total column exists.
 *
 * The Flow Source column is intentionally ignored by these formulas — it's
 * metadata, not an amount.
 *
 * Ranges are BOUNDED to rows 2..(summaryRow-1) rather than open-ended
 * ($A$2:$A). We tried the open-ended form first; in practice
 * `setFormula($A$2:$A, ..., E$2:E)` produced $0.00 totals on freshly
 * seeded sheets even when the data rows contained numeric values — the
 * two-argument open-ended form appears to be evaluated against a range
 * snapshotted at formula-write time, so subsequent row inserts above
 * Summary did not flow into the totals. Callers MUST call
 * `writeCashFlowSummaryFormulas_` again after inserting a new row so
 * the bounded ranges expand to cover the new data row;
 * `insertCashFlowRow_` does this unconditionally.
 */
function writeCashFlowSummaryFormulas_(sheet, summaryRow, layout) {
  const typeColLetter = columnToLetter_(layout.typeCol1);
  // Rows strictly above Summary hold every data row plus blank separator
  // rows (header at row 1, then Income block, 2 blanks, Expense block, 2
  // blanks). Blank separator rows carry no Type value so the SUMIF("Income")
  // / SUMIF("Expense") terms simply ignore them. When Summary sits at row 2
  // (empty sheet edge case) we fall back to a degenerate single-cell range
  // which evaluates to 0 — correct.
  const lastDataRow = Math.max(2, summaryRow - 1);

  for (let i = 0; i < layout.monthCol0s.length; i++) {
    const monthCol1 = layout.monthCol0s[i] + 1;
    const colLetter = columnToLetter_(monthCol1);

    const typeRange =
      '$' + typeColLetter + '$2:$' + typeColLetter + '$' + lastDataRow;
    const monthRange =
      '$' + colLetter + '$2:$' + colLetter + '$' + lastDataRow;

    const formula =
      '=SUMIF(' + typeRange + ',"Income",' + monthRange + ')' +
      '+SUMIF(' + typeRange + ',"Expense",' + monthRange + ')';

    const cell = sheet.getRange(summaryRow, monthCol1);
    cell.setFormula(formula);
    cell.setNumberFormat(CASH_FLOW_SUMMARY_HEALTH_NUMBER_FORMAT_);
  }

  if (layout.totalCol0 !== -1) {
    const firstMonthLetter = columnToLetter_(layout.firstMonthCol1);
    const lastMonthLetter = columnToLetter_(layout.lastMonthCol1);
    const totalCell = sheet.getRange(summaryRow, layout.totalCol1);
    totalCell.setFormula(
      '=SUM(' + firstMonthLetter + summaryRow + ':' + lastMonthLetter + summaryRow + ')'
    );
    totalCell.setNumberFormat(CASH_FLOW_SUMMARY_HEALTH_NUMBER_FORMAT_);
  }

  // Financial-health COLOR for the Summary net values lives in conditional
  // formatting (not the neutral number format above), so it matches the
  // Income/Expense color language exactly (#38761d / #cc0000). Applied here
  // because this function runs in every Summary path — first-create, next-year
  // clone, and every insert — which is also what lets existing workbooks
  // self-heal narrowly onto the new colors. Idempotent: never duplicates rules,
  // touches only Summary-scoped CF rules and Summary money cells.
  try {
    applyCashFlowSummaryHealthColorRules_(sheet, layout);
  } catch (_healthErr) { /* cosmetic only */ }
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

/**
 * Conservatively refreshes simple `=SUM(<L><N>:<L><M>)` column-range
 * formulas on aggregate rows inside a year block. Used by the INPUT -
 * House Values and INPUT - Investments add-row paths to keep the user's
 * "Total Values" / "Account Totals" rows in sync when a new data row
 * is inserted at the lower boundary of the existing SUM range.
 *
 * Why this helper exists
 * ----------------------
 * Google Sheets' automatic range-expansion rule is: inserting a row
 * *strictly inside* a referenced range expands the range; inserting
 * at or past the range's lower boundary does NOT. The add-row paths
 * call `insertRowAfter(lastDataRow)` — that lands the new row at the
 * lower edge of a typical `=SUM(C{dataStartRow}:C{lastDataRow})`
 * formula, so the newly-added house / investment silently drops out
 * of the user's total.
 *
 * What it does
 * ------------
 * For each aggregate row whose column A matches one of `targetLabels`,
 * in the scan window `[afterRow .. lastRow]` (stops early at the next
 * "Year" marker), inspects each data-column cell. Only rewrites cells
 * whose formula matches EXACTLY `=SUM(<L>{start}:<L>{end})` with both
 * endpoints on the same column letter AND that letter equal to the
 * cell's own column. The rewrite binds the range to the current
 * block's `dataStartRow:dataEndRow`.
 *
 * What it deliberately leaves alone
 * ---------------------------------
 *   - Compound formulas (`=SUM(C4:C8)+100`, `=SUM(C4:C8)-SUM(D4:D8)`)
 *   - Cross-sheet refs, named ranges, structured refs
 *   - Non-SUM aggregates (AVERAGE, SUMIF, IF, etc.)
 *   - "Delta" rows (typically YoY diff, not a sum of data rows)
 *   - "House Assets" row (per-row snapshot — not a sum of above)
 *   - Blank cells / literal numbers / text
 *
 * All errors are swallowed — this helper is defense-in-depth only and
 * must never fail an add-row write.
 *
 * @param {Sheet} sheet                 target sheet
 * @param {number} dataStartRow         1-based first data row in the block
 * @param {number} dataEndRow           1-based last data row in the block
 *                                      (AFTER the new-row insertion)
 * @param {number} afterRow             1-based row to start the aggregate
 *                                      scan from (typically dataEndRow+1)
 * @param {string[]} targetLabels       aggregate-row col-A labels to match
 *                                      (e.g. ['Total Values'], ['Account Totals'])
 */
function refreshBlockSumAggregates_(sheet, dataStartRow, dataEndRow, afterRow, targetLabels) {
  if (!sheet) return;
  if (!targetLabels || !targetLabels.length) return;
  if (!(dataStartRow > 0) || !(dataEndRow >= dataStartRow)) return;

  const labelSet = Object.create(null);
  for (let i = 0; i < targetLabels.length; i++) {
    labelSet[String(targetLabels[i]).toLowerCase()] = true;
  }

  let lastRow = 0;
  try { lastRow = sheet.getLastRow(); } catch (_) { return; }
  if (lastRow < afterRow) return;

  let lastCol = 1;
  try { lastCol = Math.max(1, sheet.getLastColumn()); } catch (_) { return; }

  for (let r = afterRow; r <= lastRow; r++) {
    let marker = '';
    try {
      marker = String(sheet.getRange(r, 1).getDisplayValue() || '').trim();
    } catch (_) { continue; }

    // Bail at the next Year block — we must never rewrite formulas in
    // a *different* year's aggregate row.
    if (marker === 'Year') break;
    if (!marker) continue;
    if (!labelSet[marker.toLowerCase()]) continue;

    let formulas = [];
    try {
      formulas = sheet.getRange(r, 1, 1, lastCol).getFormulas()[0] || [];
    } catch (_) { continue; }

    for (let c = 2; c <= lastCol; c++) {
      const formula = String(formulas[c - 1] || '').trim();
      if (!formula) continue;

      const cellLetter = columnToLetter_(c).toUpperCase();

      // Accept two shapes, both of which must reference this cell's own column:
      //   1. strict range  =SUM(<L><N>:<L><M>)  (both ends the same column)
      //   2. single cell   =SUM(<L><N>)         (the Google-Sheets-normalized /
      //      row-insert-shifted form of a former single-row range — Sheets
      //      collapses =SUM(C2:C2) to =SUM(C2) and a later insert shifts it to
      //      =SUM(C3); see the Phase 3.1 refreshDebtsTotalRow_ fix). Without
      //      (2) a one-row aggregate freezes forever.
      // Compound, cross-sheet, non-SUM, and Delta-style formulas match neither
      // and are left untouched.
      const m = formula.match(
        /^=SUM\(\s*\$?([A-Z]+)\$?(\d+)\s*:\s*\$?([A-Z]+)\$?(\d+)\s*\)$/i
      );
      if (m) {
        if (m[1].toUpperCase() !== m[3].toUpperCase()) continue;
        if (m[1].toUpperCase() !== cellLetter) continue;
      } else {
        const s = formula.match(/^=SUM\(\s*\$?([A-Z]+)\$?(\d+)\s*\)$/i);
        if (!s) continue;
        if (s[1].toUpperCase() !== cellLetter) continue;
      }

      const newFormula =
        '=SUM(' + cellLetter + dataStartRow + ':' + cellLetter + dataEndRow + ')';
      if (newFormula === formula) continue;

      try {
        sheet.getRange(r, c).setFormula(newFormula);
      } catch (_setErr) { /* non-fatal */ }
    }
  }
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
  // Thin wrapper: resolve the user's workbook, then delegate to the ss-scoped
  // builder. Production behavior is unchanged. The builder is shared so callers that
  // already hold a workbook (e.g. the Test Harness on a disposable workbook) reuse the
  // exact production build path — header, month columns, currency, header styling,
  // canonical body font/row height, Income/Expense color rules, and the Summary row —
  // instead of duplicating any of it. See buildCashFlowYearSheet_.
  return buildCashFlowYearSheet_(getUserSpreadsheet_(), year);
}

/**
 * ss-scoped core of ensureCashFlowYearSheet_ — builds (idempotently) the canonical
 * INPUT - Cash Flow <year> sheet on an EXPLICITLY provided workbook.
 *
 * Extracted so getUserSpreadsheet_() resolution lives ONLY in the ensureCashFlowYearSheet_
 * wrapper and every other caller reuses the exact same production build path (structure
 * + all formatting) rather than re-implementing it. This is what lets an integration
 * test harness produce a Cash Flow sheet that is visually identical to production
 * without ever touching a real workbook.
 *
 * FIRST-CREATE ONLY: if the sheet already exists it is returned untouched (no styling
 * or font wash over a populated sheet) — identical to the prior ensure semantics.
 *
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss Target workbook (REQUIRED — never resolved internally).
 * @param {number|string=} year Defaults to the current calendar year.
 * @returns {GoogleAppsScript.Spreadsheet.Sheet} The (possibly newly created) Cash Flow sheet.
 * @throws {Error} If ss is missing, the resolved year is not a positive integer, or sheet insertion fails for a non-race reason.
 */
function buildCashFlowYearSheet_(ss, year) {
  if (!ss) {
    throw new Error('buildCashFlowYearSheet_: ss (target workbook) is required.');
  }
  const yearNum = Number(
    (year === undefined || year === null || year === '')
      ? getCurrentYear_()
      : year
  );
  if (!Number.isFinite(yearNum) || yearNum <= 0 || Math.floor(yearNum) !== yearNum) {
    throw new Error('buildCashFlowYearSheet_: invalid year: ' + String(year));
  }

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

  const headerRow = CASH_FLOW_REQUIRED_HEADERS_
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
      .setNumberFormat('$#,##0.00;[Red]-$#,##0.00');
    sheet.getRange(2, totalCol1, sheet.getMaxRows() - 1, 1)
      .setNumberFormat('$#,##0.00;[Red]-$#,##0.00');
  } catch (e) {
    // Number format is cosmetic; do not fail the ensure op.
  }

  // Cosmetic polish — never load-bearing. applyCashFlowSheetStyling_
  // layers in the warm-yellow header fill, taller header row, bold
  // black text, a bottom separator border, and per-column widths that
  // match the reference layout the user pasted. Falls back silently on
  // any error — a styling glitch must never fail the sheet-creation
  // contract. Summary-row styling is applied separately by
  // ensureCashFlowSummaryRow_ below.
  try {
    const freshLayout = detectCashFlowLayout_(headerRow);
    applyCashFlowSheetStyling_(sheet, freshLayout);
  } catch (e) { /* cosmetic only */ }

  // Canonical body font + readable body row height (FIRST-CREATE ONLY).
  // The sheet was just inserted and holds no data rows, so washing the body
  // is safe here and never runs for an existing populated workbook (the
  // guard at the top returns early). Body cells render at the canonical 14pt
  // and empty data rows get a readable 24px height, so future Quick Add /
  // seed rows inherit comfortable spacing (insertCashFlowRow_ propagates the
  // neighbor/default row format). Header font (canonical 20) is applied by
  // applyCashFlowSheetStyling_ above.
  try {
    const maxRowsCF = sheet.getMaxRows();
    if (maxRowsCF > 1) {
      sheet.getRange(2, 1, maxRowsCF - 1, headerRow.length).setFontSize(CANON_FONT_BODY_);
      sheet.setRowHeights(2, maxRowsCF - 1, CANON_ROW_HEIGHT_BODY_);
    }
  } catch (_bodyErr) { /* cosmetic only */ }

  // Golden Workbook row-type text colors (FIRST-CREATE ONLY): Income green,
  // Expense red, applied via conditional formatting keyed off the Type
  // column so new rows auto-color without any runtime restyling.
  try {
    applyCashFlowRowTypeColorRules_(sheet, detectCashFlowLayout_(headerRow));
  } catch (_cfErr) { /* cosmetic only */ }

  // Seed the canonical Summary row ("Summary | Cash Flow Per Month") with
  // per-month SUMIF totals so users see running Income+Expense totals per
  // column as soon as they start adding rows. Idempotent — no-op if the
  // Summary row already exists (e.g. on a sheet that was cloned from a
  // prior year via createNextYearCashFlowSheet). Any failure is cosmetic
  // and MUST NOT fail the sheet-creation contract: Bills Due, debt seed,
  // and income seed all still work without a Summary row present.
  try {
    if (typeof ensureCashFlowSummaryRow_ === 'function') {
      ensureCashFlowSummaryRow_(sheet);
    }
  } catch (summaryErr) {
    Logger.log('ensureCashFlowYearSheet_ summary seed failed: ' + summaryErr);
  }

  return sheet;
}

/**
 * Ensures the canonical Summary row ("Summary | Cash Flow Per Month")
 * exists on the given Cash Flow sheet. Idempotent — returns the 1-based
 * row of an existing Summary row if present, otherwise appends one near
 * the bottom with per-month SUMIF formulas + a yearly Total formula.
 *
 * The Summary row is what users asked for so every month column shows
 * its running Income+Expense net ("Cash Flow Per Month" in the template
 * the user pasted). It's also what insertCashFlowRow_ uses as its
 * anchor when deciding where to drop new Income / Expense rows
 * (Income stacks above it, Expense stacks just before it), so seeding
 * it early is what keeps Income and Expense from interleaving on a
 * freshly created sheet.
 *
 * Safety: this function only ADDS a row — it never rewrites existing
 * cells, never touches user data, and never moves other rows. When the
 * Summary row is freshly created, TWO blank separator rows are left
 * between it and the last data row (or directly under the header on a
 * brand-new sheet) so the block structure matches the Golden Workbook
 * layout (Income → 2 blanks → Expense → 2 blanks → Summary). Existing
 * sheets that already have a Summary row return early and are never
 * reflowed, so populated workbooks keep their current spacing untouched.
 */
function ensureCashFlowSummaryRow_(sheet) {
  if (!sheet) throw new Error('ensureCashFlowSummaryRow_: sheet is required.');

  const lastCol = Math.max(1, sheet.getLastColumn());
  const headerValues = sheet.getRange(1, 1, 1, lastCol).getDisplayValues()[0] || [];
  const layout = detectCashFlowLayout_(headerValues);

  // Runtime Helpers Must Not Style (ENGINEERING_STANDARDS.md §9-10). This
  // helper runs on EVERY Quick Add / bill seed / debt seed / income seed, so
  // it must only establish the Summary row's DATA + FORMULAS (correctness) —
  // it must NOT re-wash cosmetic header/width/row-height styling on an
  // existing sheet. (It previously called applyCashFlowSheetStyling_ and
  // re-styled the existing Summary row on every insert, mutating populated
  // user workbooks on routine writes.) Header/body/width styling now lives
  // only in first-create (ensureCashFlowYearSheet_ / createNextYearCash-
  // FlowSheet). Summary-row cosmetic styling is applied once — only when
  // THIS call is the one that creates the Summary row (first-create of that
  // row), never on an already-present Summary row.

  const numRows = sheet.getLastRow();
  const existing = findCashFlowSummaryRow_(sheet, numRows, layout);
  if (existing > 0) {
    // Summary row already present: nothing cosmetic to do here. Formula
    // maintenance on insert is a correctness operation handled by
    // writeCashFlowSummaryFormulas_ (invoked from insertCashFlowRow_).
    return existing;
  }

  // Place Summary three rows below the last data row so there are always TWO
  // blank separator rows above it (Golden Workbook layout:
  // Income → 2 blanks → Expense → 2 blanks → Summary). On a fresh sheet
  // (numRows === 1, just headers) this lands at row 4 with rows 2-3 as the
  // separators. On a sheet that has data rows but no Summary yet it lands
  // past the last data row with two blanks in between. This only runs on the
  // first-create of the Summary row; existing sheets that already have one
  // return early above, so populated workbooks keep their spacing untouched.
  const summaryRow = numRows + 3;

  // Apps Script sheets default to 1000 max rows; explicitly extend if the
  // target row is beyond the current grid (defensive — very unlikely in
  // practice but cheap to guard against).
  const maxRows = sheet.getMaxRows();
  if (summaryRow > maxRows) {
    sheet.insertRowsAfter(maxRows, summaryRow - maxRows);
  }

  sheet.getRange(summaryRow, layout.typeCol1).setValue('Summary');
  sheet.getRange(summaryRow, layout.payeeCol1).setValue('Cash Flow Per Month');

  try {
    writeCashFlowSummaryFormulas_(sheet, summaryRow, layout);
  } catch (formulaErr) {
    Logger.log('ensureCashFlowSummaryRow_ formula write failed: ' + formulaErr);
  }

  try {
    applyCashFlowSummaryRowStyling_(sheet, summaryRow, layout);
  } catch (e) { /* cosmetic only */ }

  return summaryRow;
}

/**
 * Canonical Golden Workbook column widths for INPUT - Cash Flow YYYY, keyed by
 * exact header text. These are the Validator-approved **AdoptGolden** widths —
 * the four metadata columns where the Canonical (Golden) Workbook is the agreed
 * source of truth (Validator run: Canonical vs fresh Central-provisioned
 * workbook). Applied header-driven (not positional) and widen-only via
 * applyCanonicalColumnWidthsByHeader_ during FIRST-CREATE ONLY (fresh year
 * sheet + next-year clone), so populated sheets are never restyled.
 *
 * Only the four AdoptGolden metadata columns live here. The positional Total
 * and month-column widths stay on their layout-index widen-only paths below,
 * and colors / typography / row heights / alignment / formulas are unchanged
 * (those are KeepCentral / ProductDecision / IgnoreNoise per the Validator).
 */
const CASH_FLOW_CANONICAL_WIDTHS_ = {
  'Type': 189,
  'Flow Source': 255,
  'Payee': 439,
  'Active': 147
};

/**
 * Canonical LEADING (structural) header columns for INPUT - Cash Flow YYYY, in
 * exact order. The 12 month columns (MMM-YY) and the trailing 'Total' column are
 * positional/dynamic — the creator appends them after this prefix — so they are
 * intentionally NOT part of this name-checked list. Single source of truth shared
 * by createCashFlowYearSheet_ (first-create) and the Validator canonical model
 * (validator_rules.js). getCashFlowHeaderMap_ / detectCashFlowLayout_ resolve
 * these labels by string, so order here is layout-independent but must not change.
 */
const CASH_FLOW_REQUIRED_HEADERS_ = ['Type', 'Flow Source', 'Payee', 'Active'];

/**
 * Apply the canonical Cash Flow header styling (warm-yellow fill, bold
 * black text at the canonical 16pt header size, taller row, bottom border)
 * and reasonable column widths so every `INPUT - Cash Flow YYYY` sheet reads
 * like the reference layout.
 *
 * FIRST-CREATE ONLY. Per Runtime Helpers Must Not Style / the Styling
 * Reassertion Rule (ENGINEERING_STANDARDS.md §9-10) this helper is called
 * exclusively from the sheet-creation paths (ensureCashFlowYearSheet_ and
 * createNextYearCashFlowSheet) — it is NOT called on the routine Quick Add /
 * debt seed / income seed write path anymore, so it never re-washes an
 * existing populated sheet. Errors are swallowed (cosmetic only; never fail
 * a row write on a styling glitch).
 *
 * Color is Google Sheets' yellow-2 (#ffe599) — one shade down from the
 * paler yellow-3, picked so the header band reads as clearly highlighted
 * on both the dashboard's tinted chrome and the raw sheet. Row height
 * and column widths are set to values tuned to
 * the canonical 4-metadata-columns + 12-month + total layout but
 * adapt automatically if the workbook's layout differs (header style
 * is applied to all columns returned by `detectCashFlowLayout_`).
 */
function applyCashFlowSheetStyling_(sheet, layout) {
  if (!sheet || !layout) return;
  const numCols = layout.numCols;

  const headerRange = sheet.getRange(1, 1, 1, numCols);
  headerRange
    .setBackground('#ffe599')
    .setFontWeight('bold')
    .setFontSize(CANON_FONT_HEADER_)
    .setFontColor('#000000')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');

  // Solid bottom border below the header to visually separate the
  // header from the data body. Top/left/right/interior left at default
  // so existing user grid lines are preserved.
  try {
    headerRange.setBorder(
      null,  // top
      null,  // left
      true,  // bottom
      null,  // right
      null,  // vertical (interior)
      null,  // horizontal (interior)
      '#000000',
      SpreadsheetApp.BorderStyle.SOLID  // canonical thin black header border
    );
  } catch (_borderErr) { /* cosmetic */ }

  try { sheet.setRowHeight(1, CANON_ROW_HEIGHT_HEADER_); } catch (_rhErr) { /* cosmetic */ }
  try { sheet.setFrozenRows(1); } catch (_frErr) { /* cosmetic */ }

  // Column widths tuned to the canonical column identities so a freshly
  // created sheet never needs manual resizing (Readability Standard). All
  // sets are widen-only; absent optional columns are skipped safely.
  // Header-addressable columns get the Validator-approved AdoptGolden widen-only
  // widths from the shared helper (applyCanonicalColumnWidthsByHeader_), so Cash
  // Flow uses the same width mechanism as LOG - Activity and Upcoming Expenses
  // instead of bespoke logic. Type & Payee are guaranteed present; Flow Source &
  // Active are optional (the helper skips missing headers safely, matching the
  // old `*Col1 > 0` guards). Values are the canonical Golden widths — see
  // CASH_FLOW_CANONICAL_WIDTHS_ above (Type 189 · Flow Source 255 · Payee 439 ·
  // Active 147).
  try {
    applyCanonicalColumnWidthsByHeader_(sheet, 1, CASH_FLOW_CANONICAL_WIDTHS_);
  } catch (_cfWidthErr) { /* cosmetic only */ }

  // Total is identified POSITIONALLY (the last column after the month block),
  // not by a fixed header, so it stays on the layout-index widen-only path
  // rather than the header-addressed helper. Widen-only preserves any manual
  // widening; fresh sheets start at ~100px and get the canonical 120.
  if (layout.totalCol1 > 0) {
    try {
      if (sheet.getColumnWidth(layout.totalCol1) < 120) {
        sheet.setColumnWidth(layout.totalCol1, 120);
      }
    } catch (_) {}
  }

  // Month columns share one canonical width. 100px fits typical currency
  // values ("$12,345.67") at the 14pt body size and the "MMM-YY" header at
  // 16pt bold without clipping.
  for (let i = 0; i < layout.monthCol0s.length; i++) {
    try {
      const monthCol1 = layout.monthCol0s[i] + 1;
      if (sheet.getColumnWidth(monthCol1) < 100) {
        sheet.setColumnWidth(monthCol1, 100);
      }
    } catch (_) {}
  }
}

/**
 * Apply the canonical Summary-row styling (light-gray fill, bold black text
 * at the canonical 14pt body size, solid top border).
 *
 * FIRST-CREATE / repair only. Per Runtime Helpers Must Not Style
 * (ENGINEERING_STANDARDS.md §10) this is applied only when the Summary row
 * is first created (fresh sheet or next-year clone) — NOT re-applied to an
 * already-present Summary row on every insert. All failures are swallowed —
 * cosmetic only.
 *
 * Note: the light-gray fill (#f3f3f3) is the pre-existing treatment and is
 * intentionally left unchanged in Phase A; the Summary-row COLOR remains a
 * Phase B item pending a Golden Workbook observation. Phase A only adds the
 * canonical font size.
 */
function applyCashFlowSummaryRowStyling_(sheet, summaryRow, layout) {
  if (!sheet || !layout || !summaryRow || summaryRow < 2) return;

  const range = sheet.getRange(summaryRow, 1, 1, layout.numCols);

  try {
    range
      .setBackground('#f3f3f3')
      .setFontWeight('bold')
      .setFontSize(CANON_FONT_TOTAL_)
      .setFontColor('#000000');
  } catch (_fillErr) { /* cosmetic */ }

  try {
    range.setBorder(
      true,   // top (separates Summary from the data body)
      null,
      null,
      null,
      null,
      null,
      '#000000',
      SpreadsheetApp.BorderStyle.SOLID_MEDIUM
    );
  } catch (_borderErr) { /* cosmetic */ }

  try { sheet.setRowHeight(summaryRow, 28); } catch (_rhErr) { /* cosmetic */ }
}

/**
 * Apply the Golden Workbook row-type text colors — Income → green, Expense
 * → red — via CONDITIONAL FORMATTING keyed off the Type column.
 *
 * FIRST-CREATE ONLY. The rules are added once, on a WHOLE-COLUMN range, so
 * Google Sheets then colors any Income / Expense row automatically based on
 * its Type cell, and NO runtime helper ever restyles a row (Runtime Helpers
 * Must Not Style, ENGINEERING_STANDARDS.md §10). Rows whose Type is not
 * Income / Expense (the Summary row, the blank spacer rows, the header) keep
 * their default font color. Existing populated sheets never receive these
 * rules — this runs only from the creation paths — so no existing workbook is
 * recolored.
 *
 * Why a WHOLE-COLUMN range (A:Q) instead of a bounded row range: a bounded
 * range (rows 2..maxRows) DRIFTS when a row is inserted at its top boundary
 * (row 2, directly under the header) — the same insert-at-the-edge quirk this
 * file documents for SUM ranges (see refreshBlockSumAggregates_). That drift
 * left freshly inserted Income/Expense rows OUTSIDE the conditional-format
 * range, so they rendered black. A whole-column range covers every current
 * AND future row and is immune to row-insert drift. The formula is anchored
 * at row 1 (the range's top-left) with the Type column $-locked, so each row
 * evaluates its own Type cell.
 *
 * Rules are APPENDED to any rules already on the sheet (never clobbering
 * user/other rules). Colors use the standard Google Sheets palette shades
 * (dark green #38761d / dark red #cc0000). All failures are swallowed —
 * cosmetic only; a conditional-format glitch must never fail sheet creation.
 */
function applyCashFlowRowTypeColorRules_(sheet, layout) {
  if (!sheet || !layout) return;
  try {
    const typeLetter = columnToLetter_(layout.typeCol1);
    const firstColLetter = columnToLetter_(1);
    const lastColLetter = columnToLetter_(layout.numCols);

    // Whole-column range, e.g. "A:Q" (all canonical columns, every row). Its
    // top-left is row 1, so the custom formula is anchored at row 1.
    const range = sheet.getRange(firstColLetter + ':' + lastColLetter);

    const incomeRule = SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=$' + typeLetter + '1="Income"')
      .setFontColor(CASH_FLOW_HEALTH_COLOR_POSITIVE_)
      .setRanges([range])
      .build();

    const expenseRule = SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=$' + typeLetter + '1="Expense"')
      .setFontColor(CASH_FLOW_HEALTH_COLOR_NEGATIVE_)
      .setRanges([range])
      .build();

    const rules = sheet.getConditionalFormatRules() || [];
    rules.push(incomeRule);
    rules.push(expenseRule);
    sheet.setConditionalFormatRules(rules);
  } catch (_cfErr) { /* cosmetic only */ }
}

/**
 * Apply the Summary-row financial-health text colors — positive net → green,
 * negative net → red, zero → neutral (default black) — via CONDITIONAL
 * FORMATTING, matching the Income/Expense color language EXACTLY (shared
 * CASH_FLOW_HEALTH_COLOR_* constants).
 *
 * Scope: the MONEY columns of the Summary row ONLY. Two rules over the
 * first-month-column..Total whole-column range, each gated on BOTH
 * `Type="Summary"` AND the cell's own sign, so only Summary-row money cells are
 * colored and Type/Payee text is untouched. Using a WHOLE-COLUMN range plus a
 * Type-keyed formula makes the rules immune to row-insert drift — the same
 * drift-proof pattern as applyCashFlowRowTypeColorRules_. The formula is
 * anchored at row 1 (the range's top-left): the `$Type` column is $-locked while
 * its row and the money-cell reference are relative, so each cell evaluates its
 * own row's Type and its own value. Zero matches neither rule and keeps the
 * cell's default black font.
 *
 * IDEMPOTENT / no duplicates: any pre-existing Summary-health rules (identified
 * by a custom formula containing `="Summary"`) are removed first, then exactly
 * two fresh rules are appended. Income/Expense rules (keyed off "Income" /
 * "Expense") and any unrelated user rules are preserved untouched. Because it is
 * idempotent it is safe to call on every insert, which is what lets existing
 * workbooks self-heal narrowly onto the new colors on their next Quick Add
 * WITHOUT accumulating duplicate rules. All failures swallowed — cosmetic only.
 *
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @param {Object} layout  detectCashFlowLayout_ result
 */
function applyCashFlowSummaryHealthColorRules_(sheet, layout) {
  if (!sheet || !layout) return;
  if (!(layout.firstMonthCol1 > 0)) return;
  try {
    const typeLetter = columnToLetter_(layout.typeCol1);
    // Money columns are contiguous: first month column → Total (or the last
    // month column when a sheet has no Total column).
    const lastMoneyCol1 = (layout.totalCol1 > 0) ? layout.totalCol1 : layout.lastMonthCol1;
    const firstMoneyLetter = columnToLetter_(layout.firstMonthCol1);
    const lastMoneyLetter = columnToLetter_(lastMoneyCol1);

    // Whole-column range over the money columns only; top-left is row 1, so the
    // relative money-cell reference in the formula is <firstMoney>1.
    const range = sheet.getRange(firstMoneyLetter + ':' + lastMoneyLetter);

    const positiveRule = SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=AND($' + typeLetter + '1="Summary", ' + firstMoneyLetter + '1>0)')
      .setFontColor(CASH_FLOW_HEALTH_COLOR_POSITIVE_)
      .setRanges([range])
      .build();

    const negativeRule = SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=AND($' + typeLetter + '1="Summary", ' + firstMoneyLetter + '1<0)')
      .setFontColor(CASH_FLOW_HEALTH_COLOR_NEGATIVE_)
      .setRanges([range])
      .build();

    // Dedupe: drop any prior Summary-health rules (custom formula that mentions
    // `="Summary"`), keep everything else (Income/Expense + user rules), then
    // append the two fresh rules. Running repeatedly always yields exactly two.
    const existing = sheet.getConditionalFormatRules() || [];
    const kept = [];
    for (let i = 0; i < existing.length; i++) {
      let isSummaryHealth = false;
      try {
        const bc = existing[i].getBooleanCondition();
        if (bc) {
          const vals = bc.getCriteriaValues() || [];
          for (let v = 0; v < vals.length; v++) {
            if (String(vals[v]).indexOf('="Summary"') !== -1) { isSummaryHealth = true; break; }
          }
        }
      } catch (_inspectErr) { /* uninspectable → leave the rule in place */ }
      if (!isSummaryHealth) kept.push(existing[i]);
    }
    kept.push(positiveRule);
    kept.push(negativeRule);
    sheet.setConditionalFormatRules(kept);
  } catch (_cfErr) { /* cosmetic only */ }
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

  const ss = getUserSpreadsheet_();
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
