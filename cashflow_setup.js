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
  // Rows strictly above Summary hold every data row (header at row 1,
  // optional blank separator at row 2, then Income/Expense block). When
  // Summary sits at row 2 (empty sheet edge case) we fall back to a
  // degenerate single-cell range which evaluates to 0 — correct.
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

      // Strict: =SUM(<L><N>:<L><M>), case-insensitive, with optional $.
      const m = formula.match(
        /^=SUM\(\s*\$?([A-Z]+)\$?(\d+)\s*:\s*\$?([A-Z]+)\$?(\d+)\s*\)$/i
      );
      if (!m) continue;

      const lhsLetter = m[1].toUpperCase();
      const rhsLetter = m[3].toUpperCase();
      if (lhsLetter !== rhsLetter) continue;

      const cellLetter = columnToLetter_(c).toUpperCase();
      if (lhsLetter !== cellLetter) continue;

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
 * Summary row is freshly created, one blank separator row is left
 * between it and the last data row (or directly under the header on a
 * brand-new sheet) so the block structure matches the reference
 * layout the user pasted.
 */
function ensureCashFlowSummaryRow_(sheet) {
  if (!sheet) throw new Error('ensureCashFlowSummaryRow_: sheet is required.');

  const lastCol = Math.max(1, sheet.getLastColumn());
  const headerValues = sheet.getRange(1, 1, 1, lastCol).getDisplayValues()[0] || [];
  const layout = detectCashFlowLayout_(headerValues);

  // Refresh header + column-width styling on every call. Idempotent
  // (setting the same background/bold/width a second time is a no-op
  // visually), so repeated inserts don't accumulate cost, and legacy
  // sheets created before the styling pass upgrade to the new look the
  // next time Quick Add / debt seed / bill seed touches them.
  try {
    applyCashFlowSheetStyling_(sheet, layout);
  } catch (styleErr) {
    Logger.log('ensureCashFlowSummaryRow_ header styling failed: ' + styleErr);
  }

  const numRows = sheet.getLastRow();
  const existing = findCashFlowSummaryRow_(sheet, numRows, layout);
  if (existing > 0) {
    // Re-apply summary-row styling on existing Summary rows too so
    // legacy sheets pick up the light-gray fill / top border without
    // needing a from-scratch rebuild.
    try { applyCashFlowSummaryRowStyling_(sheet, existing, layout); } catch (_) { /* cosmetic */ }
    return existing;
  }

  // Place Summary two rows below the last data row so there's always one
  // blank separator row above it. On a fresh sheet (numRows === 1, just
  // headers) this lands at row 3 with row 2 as the separator. On a sheet
  // that already has data rows but no Summary, it lands past the last
  // data row with one blank in between, matching the reference layout.
  const summaryRow = numRows + 2;

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
 * Apply the canonical Cash Flow header styling (warm-yellow fill, bold
 * black text, taller row, bottom border) and reasonable column widths
 * so every `INPUT - Cash Flow YYYY` sheet reads like the reference
 * layout the user pasted. Idempotent — safe to call on every Quick Add
 * / debt seed / summary seed path. Errors are swallowed (cosmetic
 * only; never fail a row write on a styling glitch).
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
      SpreadsheetApp.BorderStyle.SOLID_MEDIUM
    );
  } catch (_borderErr) { /* cosmetic */ }

  try { sheet.setRowHeight(1, 32); } catch (_rhErr) { /* cosmetic */ }
  try { sheet.setFrozenRows(1); } catch (_frErr) { /* cosmetic */ }

  // Column widths tuned to the canonical column identities. When a
  // column is absent (e.g. legacy sheet without Flow Source or Active)
  // the `*Col1 === -1` branch skips the set — no errant width write to
  // column -1. Month columns share a single width so the block reads
  // as a clean grid.
  const widthByCol1 = [];
  if (layout.typeCol1 > 0)        widthByCol1.push({ col: layout.typeCol1, width: 110 });
  if (layout.flowSourceCol1 > 0)  widthByCol1.push({ col: layout.flowSourceCol1, width: 130 });
  if (layout.payeeCol1 > 0)       widthByCol1.push({ col: layout.payeeCol1, width: 220 });
  if (layout.activeCol1 > 0)      widthByCol1.push({ col: layout.activeCol1, width: 80 });
  if (layout.totalCol1 > 0)       widthByCol1.push({ col: layout.totalCol1, width: 110 });

  // Only widen — never shrink. Populated workbooks where the user has
  // manually widened a column (e.g. Flow Source > 130 to fit
  // "CREDIT_CARD", or month columns > 90 to fit long currency values)
  // would otherwise be reset on every Quick Add / bill / debt seed,
  // because ensureCashFlowSummaryRow_ calls this helper on every insert.
  // Fresh sheets start below each target width (Google Sheets default
  // ~100px) and still get widened on creation as before.
  for (let i = 0; i < widthByCol1.length; i++) {
    try {
      const col1 = widthByCol1[i].col;
      const target = widthByCol1[i].width;
      if (sheet.getColumnWidth(col1) < target) {
        sheet.setColumnWidth(col1, target);
      }
    } catch (_) {}
  }

  for (let i = 0; i < layout.monthCol0s.length; i++) {
    try {
      const monthCol1 = layout.monthCol0s[i] + 1;
      if (sheet.getColumnWidth(monthCol1) < 90) {
        sheet.setColumnWidth(monthCol1, 90);
      }
    } catch (_) {}
  }
}

/**
 * Apply the canonical Summary-row styling (light-gray fill, bold
 * black text, solid top border). Called whenever Summary is seeded or
 * found on an existing sheet so legacy sheets upgrade transparently.
 * All failures are swallowed — cosmetic only.
 */
function applyCashFlowSummaryRowStyling_(sheet, summaryRow, layout) {
  if (!sheet || !layout || !summaryRow || summaryRow < 2) return;

  const range = sheet.getRange(summaryRow, 1, 1, layout.numCols);

  try {
    range
      .setBackground('#f3f3f3')
      .setFontWeight('bold')
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
