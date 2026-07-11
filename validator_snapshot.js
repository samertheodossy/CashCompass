/**
 * CashCompass Validator — read-only formatting snapshot (part of the Validator
 * subsystem; see VALIDATOR_ARCHITECTURE.md).
 *
 * Extracts a structured, JSON-style snapshot of a workbook's *formatting*
 * (geometry + per-cell style for key rows). READ-ONLY BY CONSTRUCTION: only
 * SpreadsheetApp getters are used; nothing here writes, styles, inserts,
 * deletes, or mutates a workbook.
 *
 * SAFETY CONTRACT (enforced by convention + CI, per VALIDATOR_ARCHITECTURE.md):
 *   - never called from runtime/provisioning flows (doGet, resolver,
 *     provisioning, dashboard, onboarding, planner, client HTML, triggers),
 *   - execution is guarded upstream in validator_core.js
 *     (VALIDATOR_ENABLED flag + admin allow-list),
 *   - all helpers are internal (trailing underscore).
 *
 * Borders note: Apps Script exposes no *read* API for cell borders — border
 * parity must be verified visually; every other attribute is captured here.
 */

/** Hard caps so we never scan a huge blank grid. Override via options. */
var VALIDATOR_ROW_CAP_ = 80;
var VALIDATOR_COL_CAP_ = 40;

/** Sheet-name prefixes captured by default. Override with options.sheetFilter. */
var VALIDATOR_DEFAULT_PREFIXES_ = ['INPUT - ', 'SYS - ', 'OUT - ', 'HOUSES - ', 'LOG - '];

/**
 * Snapshot a workbook by ID (internal). The executing account must have at
 * least read access to the ID. Read-only usage of openById.
 *
 * @param {string} spreadsheetId
 * @param {Object=} opts See validatorSnapshotWorkbook_.
 * @returns {Object}
 */
function validatorSnapshotById_(spreadsheetId, opts) {
  if (!spreadsheetId || typeof spreadsheetId !== 'string') {
    throw new Error('validatorSnapshotById_: spreadsheetId (string) is required.');
  }
  return validatorSnapshotWorkbook_(SpreadsheetApp.openById(spreadsheetId), opts || {});
}

/**
 * Core read-only extractor. Returns a plain object describing the workbook's
 * formatting. Never mutates the workbook.
 *
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss
 * @param {Object} opts
 *   - {number}   rowCap        max rows scanned per sheet (default 80)
 *   - {number}   colCap        max cols scanned per sheet (default 40)
 *   - {string[]} sheetFilter   name prefixes to include (default INPUT-/SYS-/OUT-/HOUSES-/LOG-)
 *   - {string[]} sheetNames    exact sheet names to include (overrides sheetFilter)
 *   - {boolean}  allSheets     true = every sheet regardless of filter
 *   - {boolean}  includeHidden true = include hidden sheets (default true)
 *   - {boolean}  redactValues  true = replace values/labels with shape tokens
 * @returns {Object}
 */
function validatorSnapshotWorkbook_(ss, opts) {
  opts = opts || {};
  var rowCap = opts.rowCap || VALIDATOR_ROW_CAP_;
  var colCap = opts.colCap || VALIDATOR_COL_CAP_;
  var includeHidden = opts.includeHidden !== false;
  var redactValues = opts.redactValues === true;

  var sheets = ss.getSheets();
  var out = {
    spreadsheetId: ss.getId(),
    spreadsheetName: ss.getName(),
    capturedAt: new Date().toISOString(),
    caps: { rowCap: rowCap, colCap: colCap },
    redacted: redactValues,
    bordersNote: 'Borders are not readable via Apps Script; verify visually.',
    sheetCount: sheets.length,
    sheets: []
  };

  for (var i = 0; i < sheets.length; i++) {
    var sheet = sheets[i];
    var name = sheet.getName();
    if (!includeHidden && sheet.isSheetHidden()) continue;
    if (!validatorIncludesSheet_(name, opts)) continue;
    try {
      out.sheets.push(validatorSnapshotSheet_(sheet, i, rowCap, colCap, redactValues));
    } catch (e) {
      out.sheets.push({ name: name, index: i, error: String(e) });
    }
  }
  return out;
}

/**
 * Per-sheet read-only snapshot: geometry for all captured rows/cols, a label +
 * classification for every captured row, and full per-cell style detail for the
 * classified "key" rows. Uses bulk getters (one call per attribute over the
 * capped block).
 */
function validatorSnapshotSheet_(sheet, index, rowCap, colCap, redactValues) {
  var name = sheet.getName();
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  var usedRows = Math.max(1, Math.min(lastRow || 1, rowCap));
  var usedCols = Math.max(1, Math.min(lastCol || 1, colCap));

  var s = {
    name: name,
    index: index,
    family: validatorSheetFamily_(name),
    hiddenSheet: sheet.isSheetHidden(),
    frozenRows: sheet.getFrozenRows(),
    frozenColumns: sheet.getFrozenColumns(),
    lastRow: lastRow,
    lastColumn: lastCol,
    scannedRows: usedRows,
    scannedColumns: usedCols,
    columnWidths: {},
    rowHeights: {},
    hiddenColumns: [],
    hiddenRows: [],
    mergedRanges: [],
    // Header labels (schema column names) are captured UNREDACTED even in
    // redacted mode: they are structural (e.g. "Payee", "Amount", "Jan-26"),
    // not user financial data, and are required so the comparator can match
    // columns by header NAME instead of position (schemas drift between the
    // mature Golden workbook and freshly provisioned Central sheets).
    headerRowNum: 0,
    headerLabels: {}, // 1-based colIndex -> trimmed header label
    rows: [],
    keyRows: []
  };

  for (var c = 1; c <= usedCols; c++) {
    try { s.columnWidths[c] = sheet.getColumnWidth(c); } catch (e1) {}
    try { if (sheet.isColumnHiddenByUser(c)) s.hiddenColumns.push(c); } catch (e2) {}
  }
  for (var r = 1; r <= usedRows; r++) {
    try { s.rowHeights[r] = sheet.getRowHeight(r); } catch (e3) {}
    try { if (sheet.isRowHiddenByUser(r)) s.hiddenRows.push(r); } catch (e4) {}
  }

  var range = sheet.getRange(1, 1, usedRows, usedCols);
  var values = range.getValues();
  var backgrounds = range.getBackgrounds();
  var fontFamilies = range.getFontFamilies();
  var fontSizes = range.getFontSizes();
  var fontWeights = range.getFontWeights();
  var fontColors = range.getFontColors();
  var hAligns = range.getHorizontalAlignments();
  var vAligns = range.getVerticalAlignments();
  var numFormats = range.getNumberFormats();

  try {
    var merges = range.getMergedRanges();
    for (var m = 0; m < merges.length; m++) s.mergedRanges.push(merges[m].getA1Notation());
  } catch (e5) {}

  var frozenRows = s.frozenRows;

  for (var ri = 0; ri < usedRows; ri++) {
    var rowNum = ri + 1;
    var rawLabel = (values[ri] && values[ri][0] != null) ? values[ri][0] : '';
    var type = validatorClassifyRowType_(name, rowNum, ri, values, frozenRows);
    s.rows.push({ r: rowNum, type: type, label: redactValues ? validatorRedactValue_(rawLabel) : String(rawLabel) });

    // Capture the first Header/SysHeader row's labels (unredacted) so widths
    // and structure can be compared by header name downstream.
    if (!s.headerRowNum && (type === 'Header' || type === 'SysHeader')) {
      s.headerRowNum = rowNum;
      for (var hc = 0; hc < usedCols; hc++) {
        var hv = values[ri][hc];
        var lbl = (hv === '' || hv == null) ? '' : String(hv).trim();
        if (lbl) s.headerLabels[hc + 1] = lbl;
      }
    }

    if (validatorIsKeyRowType_(type)) {
      var cells = [];
      for (var ci = 0; ci < usedCols; ci++) {
        var v = values[ri][ci];
        if (ci > 0 && (v === '' || v == null) && backgrounds[ri][ci] === '#ffffff') continue;
        cells.push({
          c: ci + 1,
          value: redactValues ? validatorRedactValue_(v) : v,
          background: backgrounds[ri][ci],
          fontFamily: fontFamilies[ri][ci],
          fontSize: fontSizes[ri][ci],
          fontWeight: fontWeights[ri][ci],
          fontColor: fontColors[ri][ci],
          hAlign: hAligns[ri][ci],
          vAlign: vAligns[ri][ci],
          numberFormat: numFormats[ri][ci]
        });
      }
      s.keyRows.push({ r: rowNum, type: type, cells: cells });
    }
  }

  return s;
}

/* ---------- internal classification / filtering helpers ---------- */

/**
 * Design-family classification (mirrors GOLDEN_WORKBOOK.md families, plus
 * Planner for OUT sheets and a Special catch-all).
 * @returns {string} 'Financial Ledger' | 'Operational' | 'SYS' | 'Planner' | 'Special'
 */
function validatorSheetFamily_(name) {
  if (name.indexOf('SYS - ') === 0) return 'SYS';
  if (name.indexOf('OUT - ') === 0) return 'Planner';
  if (name.indexOf('HOUSES - ') === 0) return 'Financial Ledger';
  if (name === 'INPUT - Investments' || name === 'INPUT - House Values' ||
      name === 'INPUT - Bank Accounts' || name.indexOf('INPUT - Cash Flow') === 0) {
    return 'Financial Ledger';
  }
  if (name === 'INPUT - Bills' || name === 'INPUT - Debts' ||
      name === 'INPUT - Upcoming Expenses' || name === 'LOG - Activity') {
    return 'Operational';
  }
  return 'Special';
}

/**
 * Advisory mapping from a sheet to the styling helper(s) most likely
 * responsible for a formatting attribute — surfaced in the report so a diff
 * points at where a fix belongs.
 */
function validatorSuggestedHelper_(name) {
  if (name === 'INPUT - Investments') return 'applyFinancialLedgerBaseStyle_ / ensureInputInvestmentsSheet_ (investments.js)';
  if (name === 'INPUT - House Values') return 'applyFinancialLedgerBaseStyle_ / ensureInputHouseValuesSheet_ (house_values.js)';
  if (name === 'INPUT - Bank Accounts') return 'applyFinancialLedgerBaseStyle_ / applyBankAccountsSheetStyling_ (bank_accounts.js)';
  if (name.indexOf('INPUT - Cash Flow') === 0) return 'applyCashFlowSheetStyling_ / ensureCashFlowYearSheet_ (cashflow_setup.js)';
  if (name === 'INPUT - Bills') return 'applyOperationalFlatSheetStyling_ / applyBillsSheetStyling_ (bills.js + sheet_bootstrap.js)';
  if (name === 'INPUT - Debts') return 'applyOperationalFlatSheetStyling_ / applyDebtsSheetStyling_ (debts.js + sheet_bootstrap.js)';
  if (name === 'INPUT - Upcoming Expenses') return 'applyOperationalFlatSheetStyling_ / applyUpcomingExpensesSheetStyling_ (upcoming_expenses.js + sheet_bootstrap.js)';
  if (name === 'SYS - Assets') return 'applySysSheetBaseStyle_ / ensureSysAssetsSheet_ (investments.js + sheet_bootstrap.js)';
  if (name === 'SYS - House Assets') return 'applySysSheetBaseStyle_ / ensureSysHouseAssetsSheet_ (house_values.js + sheet_bootstrap.js)';
  if (name === 'SYS - Accounts') return 'applySysSheetBaseStyle_ / ensureSysAccountsSheet_ (bank_accounts.js + sheet_bootstrap.js)';
  if (name.indexOf('HOUSES - ') === 0) return 'applyHousesExpenseSheetStyling_ (house_values.js)';
  if (name.indexOf('OUT - ') === 0) return 'planner_output.js (planner rebuild)';
  if (name === 'LOG - Activity') return 'getOrCreateActivityLogSheet_ (activity_log.js)';
  // Previously "unknown" owners — completed 2026-07-10.
  if (name === 'INPUT - Settings') return 'ensureInputSettingsSheet_ (profile.js)';
  if (name === 'INPUT - Donation') return 'ensureInputDonationSheet_ (donations.js)';
  if (name === 'INPUT - House Taxes') return 'legacy sheet — no active canonical creator (house taxes)';
  if (name.indexOf('INPUT - Income/Expenses') === 0) {
    return 'legacy income architecture — superseded by INPUT - Cash Flow (no active creator)';
  }
  if (name.indexOf('SYS - Import Staging') === 0) return 'ensureImportStagingBankAccountsSheet_ (bank_import.js)';
  if (name.indexOf('SYS - Import Ignored') === 0) return 'ensureImportIgnoredBankAccountsSheet_ (bank_import.js)';
  if (name === 'SYS - Meta') return 'ensureWorkbookIdentityMarkers_ (central_provisioning.js)';
  if (name === 'HOME') return 'home.js (admin/menu tool — no styler)';
  return '(unmapped — add to validatorSuggestedHelper_)';
}

/** Decides whether a sheet name passes the configured filter. */
function validatorIncludesSheet_(name, opts) {
  if (opts.allSheets) return true;
  if (opts.sheetNames && opts.sheetNames.length) {
    return opts.sheetNames.indexOf(name) !== -1;
  }
  var prefixes = (opts.sheetFilter && opts.sheetFilter.length)
    ? opts.sheetFilter
    : VALIDATOR_DEFAULT_PREFIXES_;
  for (var p = 0; p < prefixes.length; p++) {
    if (name.indexOf(prefixes[p]) === 0) return true;
  }
  return false;
}

/** True for the row types we capture full per-cell detail on. */
function validatorIsKeyRowType_(type) {
  return type === 'YearBanner' || type === 'Header' || type === 'SysHeader' ||
         type === 'FirstBody' || type === 'Total' || type === 'DeltaOrSecondary' ||
         type === 'ReportSection';
}

/**
 * Replaces a cell value with a non-identifying "shape token" so real financial
 * data never reaches the logs while structure stays diffable.
 */
function validatorRedactValue_(v) {
  if (v === '' || v == null) return '';
  if (v instanceof Date) return '«date»';
  if (typeof v === 'number') return '«num»';
  if (typeof v === 'boolean') return '«bool»';
  return '«text:' + String(v).length + '»';
}

/**
 * Heuristic row-type classifier (read-only, best-effort). Labels rows for the
 * diff — not authoritative. Recognizes YearBanner, Header, SysHeader,
 * ReportSection, Total, DeltaOrSecondary, FirstBody, Body, Blank, Other.
 */
function validatorClassifyRowType_(sheetName, rowNum, ri, values, frozenRows) {
  var colA = (values[ri] && values[ri][0] != null) ? String(values[ri][0]).trim().toLowerCase() : '';

  if (/total/.test(colA) || colA === 'summary') return 'Total';
  if (/^delta\b/.test(colA) || colA === 'house assets' || /change/.test(colA)) return 'DeltaOrSecondary';

  var isSys = sheetName.indexOf('SYS - ') === 0;
  var isOut = sheetName.indexOf('OUT - ') === 0;
  var headerRow = frozenRows >= 1 ? frozenRows : 1;

  if (rowNum === 1 && !isSys && !isOut) {
    var joined = (values[ri] || []).join(' ');
    if (/\b(19|20)\d{2}\b/.test(joined) && headerRow > 1) return 'YearBanner';
  }
  if (rowNum === 1 && isOut) return 'ReportSection';
  if (rowNum === headerRow) return isSys ? 'SysHeader' : 'Header';

  if (rowNum > headerRow) {
    var hasValue = false;
    var row = values[ri] || [];
    for (var k = 0; k < row.length; k++) {
      if (row[k] !== '' && row[k] != null) { hasValue = true; break; }
    }
    if (!hasValue) return 'Blank';
    for (var pr = headerRow; pr < ri; pr++) {
      var prior = values[pr] || [];
      for (var pk = 0; pk < prior.length; pk++) {
        if (prior[pk] !== '' && prior[pk] != null) return 'Body';
      }
    }
    return 'FirstBody';
  }
  return 'Other';
}
