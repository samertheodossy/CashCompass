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
/*  Aggregate rows (Account Totals / Delta) ARE seeded on first-create for    */
/*  Golden Workbook parity (Investments Pass 2). Account Totals is seeded      */
/*  label-only with a BLANK, currency-formatted money row; its gross per-      */
/*  month =SUM is materialized and maintained by                              */
/*  refreshInvestmentsAccountTotalsRow_ (a blank-fill + range-maintain helper, */
/*  required because the shared refreshBlockSumAggregates_ never fills blanks  */
/*  and seeded SUMs do not auto-expand at the insert-above-footer boundary).   */
/*  Delta is seeded with immediate month-over-month formulas. Both are FIRST-  */
/*  CREATE only + idempotent; populated workbooks are never migrated.          */
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
 *   Footer:  Account Totals (green, blank =SUM until first account) +
 *            Delta (pink, month-over-month formulas) — seeded here for
 *            Golden Workbook parity; see seedInvestments*Row_ helpers.
 *   Data:    (none — addInvestmentAccountFromDashboard inserts above the
 *            footer on write)
 *
 * First-create cosmetic convergence toward the Golden Workbook (Financial
 * Ledger family): month headers pinned as text, month columns currency-
 * formatted, and widen-only readable column widths. All cosmetic-only and
 * first-create only — populated workbooks return at the `existing` guard.
 *
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet=} optionalSs Explicit target for
 *   disposable harness runs; normal product callers resolve the user's workbook.
 * @returns {GoogleAppsScript.Spreadsheet.Sheet} the sheet (existing or new)
 */
function ensureInputInvestmentsSheet_(optionalSs) {
  const ss = optionalSs || getUserSpreadsheet_();
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

  // Column geometry: A=Account Name, B=Type, C..N = the 12 MMM-YY month
  // columns (firstMonthCol = 3), O = Active. Used by the cosmetic blocks
  // below and mirrors ensureInvestmentsActiveColumnForBlock_.
  const firstMonthCol = 3;
  const lastMonthCol = firstMonthCol + monthLabels.length - 1; // 14 (Dec)
  const activeCol = lastMonthCol + 1;                          // 15 (Active)

  // Golden Workbook Convergence (Phase 2): bring the freshly provisioned
  // month columns to Financial Ledger family parity with the validated
  // Bank Accounts creator — (1) pin the month headers as literal text so
  // Sheets never auto-parses "Jan-26" into a Date, and (2) currency-format
  // the 12 month columns so the first value typed renders like Cash Flow /
  // Bank Accounts. Bounded to current max rows; data rows begin at row 3.
  // Cosmetic only and first-create only (populated sheets return above).
  try {
    for (let mh = 0; mh < monthLabels.length; mh++) {
      const hdrCell = sheet.getRange(2, firstMonthCol + mh);
      hdrCell.setNumberFormat('@STRING@');
      hdrCell.setValue(monthLabels[mh] + '-' + yy);
    }
    const maxRowsInv = sheet.getMaxRows();
    if (maxRowsInv > 2) {
      sheet.getRange(3, firstMonthCol, maxRowsInv - 2, monthLabels.length)
        .setNumberFormat('$#,##0.00;-$#,##0.00');
    }
  } catch (_fmtErr) { /* cosmetic only */ }

  // Golden Workbook Convergence (Investments Pass 2): seed the canonical
  // per-year-block footer — "Account Totals" then "Delta" directly below the
  // (currently empty) account region — so a freshly provisioned workbook
  // matches production. Account Totals is seeded label-only with BLANK money
  // cells (its gross =SUM is materialized by refreshInvestmentsAccountTotalsRow_
  // once the first account exists — a SUM on an empty block is self-
  // referential); Delta is seeded with immediate month-over-month formulas
  // that reference Account Totals by fixed cell and shift correctly when the
  // first account row is inserted above them. FIRST-CREATE ONLY (populated
  // workbooks return at the `existing` guard above and never reach here).
  // Seeded BEFORE styling so applyInvestmentsSheetStyling_ colors the green
  // Account Totals / pink Delta bands.
  try {
    seedInvestmentsAccountTotalsRow_(sheet);
    seedInvestmentsDeltaRow_(sheet);
  } catch (_seedErr) { /* cosmetic/structural best-effort */ }

  // Canonical banner coloring — cosmetic only, wrapped in try/catch so a
  // formatting hiccup never fails the structural creation. Matches the
  // existing applyInvestmentsSheetStyling_ pattern (warm orange Year
  // banner, bright-yellow Account Name header, frozen col A + col B).
  try {
    applyInvestmentsSheetStyling_(sheet);
  } catch (_styleErr) { /* cosmetic only */ }

  // Golden Workbook font-size parity (Financial Ledger family) — FIRST-CREATE
  // ONLY. A fresh Apps Script sheet defaults to size 10; the bound Golden
  // Workbook uses Year 20 / header 16 / body 14. Wash the ENTIRE sheet to the
  // canonical body size (14) so every row — data rows, Account Totals, Delta,
  // and any future inserted row — defaults to 14, then raise row 1 (Year
  // banner) to 20 and row 2 (Account Name header) to 16. Applied HERE and not
  // in applyInvestmentsSheetStyling_ (which also runs on populated workbooks on
  // every add) so an existing user's sheet is never body-restyled. Cosmetic
  // only; failures are swallowed.
  try {
    const maxRowsFont = sheet.getMaxRows();
    const lastColFont = Math.max(1, sheet.getLastColumn());
    sheet.getRange(1, 1, maxRowsFont, lastColFont).setFontSize(CANON_FONT_BODY_);
    sheet.getRange(1, 1, 1, lastColFont).setFontSize(CANON_FONT_YEAR_BANNER_); // Year banner (20)
    sheet.getRange(2, 1, 1, lastColFont).setFontSize(CANON_FONT_HEADER_); // Account Name header (16)
  } catch (_fontErr) { /* cosmetic only */ }

  // Canonical row GEOMETRY (FIRST-CREATE ONLY). Year banner + header at 40px,
  // vertical-middle; header horizontally centered with a thin black bottom
  // border; body rows at 26px. Applied HERE — never in applyInvestmentsSheetStyling_,
  // which runs on populated workbooks on every add — so existing users' sheets
  // are never reshaped (ENGINEERING_STANDARDS §9/§10). Cosmetic only.
  try {
    const lastColGeo = Math.max(1, sheet.getLastColumn());
    const maxRowsGeo = sheet.getMaxRows();
    sheet.setRowHeight(1, CANON_ROW_HEIGHT_YEAR_);
    sheet.getRange(1, 1, 1, lastColGeo).setVerticalAlignment(CANON_VERTICAL_ALIGNMENT_);
    sheet.setRowHeight(2, CANON_ROW_HEIGHT_HEADER_);
    sheet.getRange(2, 1, 1, lastColGeo)
      .setHorizontalAlignment('center')
      .setVerticalAlignment(CANON_VERTICAL_ALIGNMENT_)
      .setBorder(false, false, true, false, false, false, '#000000', SpreadsheetApp.BorderStyle.SOLID);
    if (maxRowsGeo > 2) sheet.setRowHeights(3, maxRowsGeo - 2, CANON_ROW_HEIGHT_BODY_);
  } catch (_geoErr) { /* cosmetic only */ }

  try {
    sheet.setFrozenRows(2);
  } catch (_frozenErr) { /* cosmetic only */ }

  try {
    sheet.autoResizeColumns(1, headers.length);
  } catch (_resizeErr) { /* cosmetic only */ }

  // Widen-only readable column widths, applied HERE in the first-create
  // path only — never inside applyInvestmentsSheetStyling_, which also runs
  // on populated workbooks (insertNewInvestmentHistoryRow_) and must not
  // resize a user's columns. Converges a fresh sheet toward the Golden
  // Workbook's readable widths without ever shrinking a manually widened
  // column. Account Name (260) and the month columns (110) mirror the
  // validated Financial Ledger family standard from Bank Accounts; Type
  // (140) and Active (90) are readable defaults pending Golden confirmation.
  try {
    if (sheet.getColumnWidth(1) < 260) sheet.setColumnWidth(1, 260);
    if (sheet.getColumnWidth(2) < 140) sheet.setColumnWidth(2, 140);
    for (let c = firstMonthCol; c <= lastMonthCol; c++) {
      if (sheet.getColumnWidth(c) < 110) sheet.setColumnWidth(c, 110);
    }
    if (sheet.getColumnWidth(activeCol) < 90) sheet.setColumnWidth(activeCol, 90);
  } catch (_widthErr) { /* cosmetic only */ }

  return sheet;
}

/**
 * Canonical from-scratch creator for `SYS - Assets`.
 *
 * Flat 4-column table consumed by getAssetsHeaderMap_ (which requires
 * "Account Name" + "Current Balance" and treats "Type" + "Active" as
 * optional). The add path always writes all four, so we seed them all.
 *
 * First-create applies Golden Workbook parity: canonical fonts (header 20,
 * body 14), deterministic canonical column widths (Account Name 280 / Type
 * 150 / Current Balance 220 / Active 110), a spacious 44px header row, and
 * readable 26px body rows.
 *
 * Safety contract: idempotent no-op when the sheet already exists. Never
 * overwrites or re-styles populated sheets — the font wash and width logic
 * below run only on the freshly inserted, empty sheet.
 *
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet=} optionalSs Explicit target for
 *   disposable harness runs; normal product callers resolve the user's workbook.
 * @returns {GoogleAppsScript.Spreadsheet.Sheet}
 */
function ensureSysAssetsSheet_(optionalSs) {
  const ss = optionalSs || getUserSpreadsheet_();
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

  // Canonical SYS-family base presentation (FIRST-CREATE ONLY) via the shared
  // helper — yellow #ffe599 header at the SYS 20pt size, centered + thin black
  // bottom border, height 40; white body at 14pt, 26px rows; canonical widths
  // (widen-only); frozen header row + first column. Shared with SYS - House
  // Assets and SYS - Accounts so the SYS family can never drift. Safe here: the
  // sheet was just inserted and this path is never reached for a populated
  // workbook (the `existing` guard above returns early).
  applySysSheetBaseStyle_(sheet, {
    'Account Name': 280,
    'Type': 150,
    'Current Balance': 220,
    'Active': 110
  });

  return sheet;
}

function syncAllAssetsFromLatestCurrentYear_() {
  // Performance: previously this function did ~4 sheet round-trips PER
  // INVESTMENT inside getLatestInvestmentValuesForYear_ (per-row display
  // read + getLatestNonEmptyMonthColumnForRow_'s 2 reads + the matched
  // cell read), then ~2-3 more round-trips PER SYS - Assets ROW writing
  // through setCurrencyCellPreserveRowFormat_ even when the value
  // hadn't changed. On populated workbooks (~20 investments) that
  // produced 100+ Sheets API round-trips on every save and made the
  // user-visible "Saving…" status hang for tens of seconds. We now
  // (1) compute the latest-value map with 2 round-trips total via
  // a batched read, and (2) skip the format-preserving write when
  // the new value equals the existing value, which is the common case
  // because the user only changed one account in this save.
  const ss = getUserSpreadsheet_();
  const sourceSheet = getSheet_(ss, 'INVESTMENTS');
  const targetSheet = getSheet_(ss, 'ASSETS');

  const targetRaw = targetSheet.getDataRange().getValues();
  const targetDisplay = targetSheet.getDataRange().getDisplayValues();

  if (targetRaw.length < 2) throw new Error('Assets sheet is empty.');

  // Reuse the loaded display for the header map so we don't re-fetch
  // the SYS - Assets header row.
  const targetHeaderMap = getAssetsHeaderMap_(targetSheet, targetDisplay);
  const currentYear = getCurrentYear_();
  const latestMap = getLatestInvestmentValuesForYear_(sourceSheet, currentYear);

  for (let r = 1; r < targetRaw.length; r++) {
    const accountName = String(targetDisplay[r][targetHeaderMap.nameColZero] || '').trim();
    if (!accountName) continue;

    if (!Object.prototype.hasOwnProperty.call(latestMap, accountName)) continue;

    const newValue = latestMap[accountName];
    // Skip-if-unchanged: round both sides to 2dp before comparing so
    // floating-point noise from earlier round2_ calls doesn't trigger
    // a needless write. round2_(toNumber_(...)) matches the rounding
    // applied when the latestMap was computed.
    const existing = targetHeaderMap.balanceColZero === -1
      ? null
      : round2_(toNumber_(targetRaw[r][targetHeaderMap.balanceColZero]));
    if (existing !== null && existing === round2_(toNumber_(newValue))) continue;

    setCurrencyCellPreserveRowFormat_(
      targetSheet,
      r + 1,
      targetHeaderMap.balanceCol,
      newValue,
      1
    );
  }
}

function getLatestInvestmentValuesForYear_(sheet, year) {
  // Performance: previously this loop made ~4 round-trips per row
  // (display lookup + getLatestNonEmptyMonthColumnForRow_'s header
  // read + value-row read + matched-cell read). For a 12-investment
  // year block that's ~50 round-trips. We now read the whole sheet's
  // display values + the year block's data values in 2 batched calls
  // and resolve the latest month entirely in memory.
  const display = sheet.getDataRange().getDisplayValues();
  const block = getInvestmentsYearBlock_(sheet, year, display);
  const result = {};

  if (block.dataEndRow < block.dataStartRow) return result;

  const headerRow = display[block.headerRow - 1] || [];
  const lastCol = sheet.getLastColumn();
  if (lastCol < block.firstMonthCol) return result;

  const numRows = block.dataEndRow - block.dataStartRow + 1;
  const values = sheet.getRange(block.dataStartRow, 1, numRows, lastCol).getValues();

  const yearNum = Number(year);
  const headerLen = headerRow.length;

  for (let i = 0; i < values.length; i++) {
    const dispRow = display[block.dataStartRow - 1 + i] || [];
    const name = String(dispRow[0] || '').trim();
    if (!isInvestmentDataRowName_(name)) continue;

    let bestColIdx = -1;
    let bestTime = -1;

    for (let c = block.firstMonthCol - 1; c < lastCol && c < headerLen; c++) {
      const parsed = parseMonthHeader_(headerRow[c]);
      if (!parsed) continue;
      if (parsed.getFullYear() !== yearNum) continue;

      const v = values[i][c];
      if (v === '' || v === null || v === undefined) continue;

      const time = parsed.getTime();
      if (time > bestTime) {
        bestTime = time;
        bestColIdx = c;
      }
    }

    if (bestColIdx !== -1) {
      result[name] = round2_(toNumber_(values[i][bestColIdx]));
    }
  }

  return result;
}

function getInvestmentUiData() {
  // Performance: previously this RPC made TWO full reads of SYS - Assets
  // in a row — once for distinct Type values
  // (getAssetsDistinctColumnValues_) and once for the inactive set
  // (getInactiveInvestmentsSet_). Each is a ~300–800ms round-trip on
  // populated workbooks. We now load SYS - Assets ONCE and derive both
  // from the same snapshot. The INPUT - Investments history read (1
  // round-trip) is unchanged.
  // Blank-workbook safety preserved: if INPUT - Investments doesn't
  // exist yet, return empty shape so the page renders clean.
  const ss = getUserSpreadsheet_();
  if (!ss.getSheetByName(getSheetNames_().INVESTMENTS)) {
    return { accounts: [], typeOptions: [] };
  }

  var typeOpts = [];
  let inactive = Object.create(null);

  try {
    const assetsSheet = ss.getSheetByName(getSheetNames_().ASSETS);
    if (assetsSheet) {
      const assetsDisplay = assetsSheet.getDataRange().getDisplayValues();
      if (assetsDisplay.length >= 1) {
        const headers = assetsDisplay[0] || [];
        const nameIdx = headers.indexOf('Account Name');
        const typeIdx = headers.indexOf('Type');
        const activeIdx = headers.indexOf('Active');

        const typeSet = Object.create(null);

        for (let r = 1; r < assetsDisplay.length; r++) {
          const row = assetsDisplay[r] || [];

          if (typeIdx !== -1) {
            const t = String(row[typeIdx] || '').trim();
            if (t) typeSet[t] = true;
          }

          if (nameIdx !== -1 && activeIdx !== -1) {
            const name = String(row[nameIdx] || '').trim();
            if (name) {
              const raw = String(row[activeIdx] || '').trim().toLowerCase();
              if (raw === 'no' || raw === 'n' || raw === 'false' || raw === 'inactive') {
                inactive[name.toLowerCase()] = true;
              }
            }
          }
        }

        typeOpts = Object.keys(typeSet).sort(function(a, b) { return a.localeCompare(b); });
      }
    }
  } catch (e) {
    Logger.log('getInvestmentUiData assets read: ' + e);
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
  const ss = getUserSpreadsheet_();
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
  const ss = getUserSpreadsheet_();
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
  const ss = getUserSpreadsheet_();
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

  // Performance: previously this RPC did 2 full reads of INVESTMENTS
  // (one per month) plus a per-row range loop inside
  // findInvestmentRowInBlock_ each time, so picking a date triggered
  // ~50+ Sheet round-trips on populated workbooks. Now we read
  // INVESTMENTS once and share the snapshot across both months via
  // the optionalDisplay parameter on the year-block + row-find
  // helpers. The whole sheet (all year blocks) is in memory so the
  // prior-month case crosses year boundaries cleanly.
  const ss = getUserSpreadsheet_();
  const invSheet = getSheet_(ss, 'INVESTMENTS');
  const invDisplay = invSheet.getDataRange().getDisplayValues();

  const year = d.getFullYear();
  const monthValue = getInvestmentHistoryValueForMonthFromDisplay_(
    invSheet, invDisplay, name, year, d
  );
  const assetInfo = getAssetRowData_(name);

  var previousMonthLabel = '';
  var deltaFromPreviousMonth = null;
  try {
    const prior = new Date(d.getFullYear(), d.getMonth() - 1, 15);
    const priorYear = prior.getFullYear();
    const previousMonthValue = getInvestmentHistoryValueForMonthFromDisplay_(
      invSheet, invDisplay, name, priorYear, prior
    );
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
  const ss = getUserSpreadsheet_();
  const sheet = getSheet_(ss, 'INVESTMENTS');
  const block = getInvestmentsYearBlock_(sheet, year);

  const accountRow = findInvestmentRowInBlock_(sheet, block, accountName);
  if (accountRow === -1) {
    throw new Error('Could not find investment "' + accountName + '" inside Year ' + year + ' block.');
  }

  const monthCol = getMonthColumnByDate_(sheet, balanceDate, block.headerRow);
  return round2_(toNumber_(sheet.getRange(accountRow, monthCol).getValue()));
}

/**
 * Internal twin of getInvestmentHistoryValueForMonth_ that takes a
 * pre-loaded INVESTMENTS display-values snapshot so callers reading
 * multiple months in a single RPC don't re-fetch the same sheet for
 * each lookup. Used by getInvestmentValueForDate for the current+prior
 * month delta panel; the monthly cell value itself is still read via
 * sheet.getRange(...).getValue() so rounding behavior is identical.
 */
function getInvestmentHistoryValueForMonthFromDisplay_(sheet, display, accountName, year, balanceDate) {
  const block = getInvestmentsYearBlock_(sheet, year, display);
  const accountRow = findInvestmentRowInBlock_(sheet, block, accountName, display);
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
  const ss = getUserSpreadsheet_();

  // Capture the prior month-cell value BEFORE the overwrite so the activity
  // log row can show both the previous and new balance. Best-effort —
  // a failed read here just leaves previousRaw null and the action label
  // falls back to a balance-only form. Mirrors the read-then-write
  // pattern in bank_accounts.js::updateBankAccountValueByDate /
  // house_values.js::updateHouseValueByDate; the duplicate block/row/col
  // lookup is intentionally local so updateInvestmentHistory_'s contract
  // stays unchanged for the addInvestmentFromDashboard caller.
  let previousRaw = null;
  let previousDisplay = '';
  try {
    const prevSheet = getSheet_(ss, 'INVESTMENTS');
    const prevBlock = getInvestmentsYearBlock_(prevSheet, year);
    const prevRow = findInvestmentRowInBlock_(prevSheet, prevBlock, accountName);
    if (prevRow !== -1) {
      const prevCol = getMonthColumnByDate_(prevSheet, balanceDate, prevBlock.headerRow);
      const prevCell = prevSheet.getRange(prevRow, prevCol);
      previousRaw = round2_(toNumber_(prevCell.getValue()));
      previousDisplay = String(prevCell.getDisplayValue() || '').trim();
    }
  } catch (prevErr) {
    Logger.log('updateInvestmentValueByDate previous-read: ' + prevErr);
  }

  updateInvestmentHistory_(accountName, year, balanceDate, currentValue);
  syncAllAssetsFromLatestCurrentYear_();
  touchDashboardSourceUpdated_('investments');

  // Activity log: investment-balance snapshot edit. Mirrors
  // bank_account_update / house_value_update / debt_update — non-monetary
  // (Amount renders "—") because this is a balance snapshot, not a money
  // movement; the action label carries the month + new balance for
  // context, e.g. "Updated May-26 balance to $25,432.10". Logged BEFORE
  // runDebtPlanner so the row is captured even if the planner trips on
  // bad data downstream.
  try {
    const tz = Session.getScriptTimeZone();
    const monthLabel = Utilities.formatDate(balanceDate, tz, 'MMM-yy');
    const newRaw = round2_(toNumber_(currentValue));
    appendActivityLog_(ss, {
      eventType: 'investment_update',
      entryDate: Utilities.formatDate(stripTime_(new Date()), tz, 'yyyy-MM-dd'),
      amount: 0,
      direction: '',
      payee: accountName,
      category: '',
      accountSource: '',
      cashFlowSheet: '',
      cashFlowMonth: '',
      dedupeKey: '',
      details: JSON.stringify({
        detailsVersion: 1,
        fieldName: 'Balance',
        fieldKind: 'currency',
        monthLabel: monthLabel,
        balanceDate: Utilities.formatDate(balanceDate, tz, 'yyyy-MM-dd'),
        previousRaw: previousRaw,
        previousDisplay: previousDisplay,
        newRaw: newRaw
      })
    });
  } catch (logErr) {
    Logger.log('updateInvestmentValueByDate activity log: ' + logErr);
  }

  // NOTE: we intentionally do NOT call runDebtPlanner() here. The sheet
  // write + SYS - Assets sync + activity log row are everything the
  // user needs to see the new balance reflected. Planner-derived panels
  // are refreshed by the main dashboard firing
  // runPlannerAndRefreshDashboard() as a silent background RPC after
  // this save returns — same pattern Planning → Debts (saveDebt),
  // Quick Add (savePayment), bank balance updates, and house value
  // updates use, so the UI doesn't hang on "Saving…" while the planner
  // runs for several seconds on big workbooks. See
  // Dashboard_Script_AssetsBankInvestments.html::saveInvestment().
  return {
    ok: true,
    message: 'Investment value saved.'
  };
}

function updateInvestmentHistory_(accountName, year, balanceDate, currentValue) {
  const ss = getUserSpreadsheet_();
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
  const ss = getUserSpreadsheet_();
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

function getInvestmentsYearBlock_(sheet, year, optionalDisplay) {
  // Performance: same fix as bank_accounts.js::getBankAccountsYearBlock_.
  // Previously this helper read the full sheet then re-fetched column A
  // one cell at a time (sheet.getRange(row, 1).getDisplayValue()) just
  // to find the dataEndRow boundary and validate the header row. We now
  // reuse the loaded snapshot for everything, and accept an optional
  // pre-loaded display from callers that already have it.
  const display = (optionalDisplay && optionalDisplay.length)
    ? optionalDisplay
    : sheet.getDataRange().getDisplayValues();

  let yearRow = -1;
  for (let r = 0; r < display.length; r++) {
    const colA = String((display[r] && display[r][0]) || '').trim();
    const colB = String((display[r] && display[r][1]) || '').trim();
    if (colA === 'Year' && colB === String(year)) {
      yearRow = r + 1;
      break;
    }
  }

  if (yearRow === -1) {
    throw new Error('Could not find Year block for ' + year + ' in Investments.');
  }

  const headerRow = yearRow + 1;
  const headerName = String(
    (display[headerRow - 1] && display[headerRow - 1][0]) || ''
  ).trim();
  if (headerName !== 'Account Name') {
    throw new Error('Expected Account Name header row for Year ' + year + ' in Investments.');
  }

  const dataStartRow = headerRow + 1;
  let dataEndRow = display.length;

  for (let r = dataStartRow - 1; r < display.length; r++) {
    const name = String((display[r] && display[r][0]) || '').trim();
    if (name === 'Account Totals' || name === 'Delta' || name === 'Year') {
      dataEndRow = r; // r is the 0-based index, equal to (1-based row) - 1
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

function findInvestmentRowInBlock_(sheet, block, accountName, optionalDisplay) {
  // Performance: same fix as bank_accounts.js::findBankAccountRowInBlock_.
  // Replace the per-row sheet.getRange(row, 1).getDisplayValue() loop with
  // a single batched range read of column A across the block, or reuse
  // the caller's already-loaded full-sheet display when given.
  if (block.dataEndRow < block.dataStartRow) return -1;

  let names;
  if (optionalDisplay && optionalDisplay.length) {
    names = [];
    for (let r = block.dataStartRow - 1; r <= block.dataEndRow - 1 && r < optionalDisplay.length; r++) {
      names.push((optionalDisplay[r] && optionalDisplay[r][0] !== undefined)
        ? optionalDisplay[r][0]
        : '');
    }
  } else {
    const numRows = block.dataEndRow - block.dataStartRow + 1;
    names = sheet.getRange(block.dataStartRow, 1, numRows, 1).getDisplayValues().map(function(row) {
      return row[0];
    });
  }

  for (let i = 0; i < names.length; i++) {
    const name = String(names[i] || '').trim();
    if (!isInvestmentDataRowName_(name)) continue;
    if (name === accountName) return block.dataStartRow + i;
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

function getAssetsHeaderMap_(sheet, optionalDisplay) {
  // Performance: when callers already loaded the SYS - Assets display
  // values, pass them in via optionalDisplay to skip the redundant
  // header round-trip. Behavior unchanged when omitted.
  const headers = (optionalDisplay && optionalDisplay.length)
    ? (optionalDisplay[0] || [])
    : (sheet.getDataRange().getDisplayValues()[0] || []);

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
    const ss = getUserSpreadsheet_();
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

  const ss = getUserSpreadsheet_();
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

  // When the only candidate template is the year-block header row (an empty
  // block getting its very first account) — or a reserved aggregate/marker
  // row directly below (a seeded "Account Totals" / "Delta") — cloning its
  // format would stamp the bright-yellow header band (or the green/pink
  // summary band) onto a data row. We detect that case and stamp a clean
  // data-row style instead of cloning. Cloning a REAL account row (the
  // common case) is unchanged. Mirrors bank_accounts.js::
  // insertNewBankAccountHistoryRow_.
  let templateIsHeader = false;

  if (lastAccountRow === -1) {
    if (block.dataEndRow < block.dataStartRow) {
      insertBeforeRow = block.dataStartRow;
    } else {
      insertBeforeRow = block.dataEndRow + 1;
    }
    sheet.insertRowBefore(insertBeforeRow);
    newRow = insertBeforeRow;
    if (newRow + 1 <= sheet.getLastRow()) {
      templateRow = newRow + 1;
      const belowName = String(sheet.getRange(templateRow, 1).getDisplayValue() || '').trim();
      if (!isInvestmentDataRowName_(belowName)) {
        templateRow = block.headerRow;
        templateIsHeader = true;
      }
    } else {
      templateRow = block.headerRow;
      templateIsHeader = true;
    }
  } else {
    sheet.insertRowAfter(lastAccountRow);
    newRow = lastAccountRow + 1;
    templateRow = lastAccountRow;
  }

  if (templateIsHeader) {
    // Empty-block first account: do NOT inherit the header's styling. Stamp
    // the canonical Golden Workbook body-row look — white background, normal
    // weight, black text, canonical body font size 14 (Financial Ledger
    // parity — the freshly inserted row can otherwise inherit the size-16
    // header row above it), left-aligned identifiers (Account Name / Type),
    // right-aligned currency month cells, default vertical alignment — and
    // re-apply currency formats to the 12 month columns. The Active cell is
    // corrected by writeActiveCellWithRowFormat_ below. Cosmetic only — a
    // failure here must not block adding the account.
    try {
      sheet.getRange(newRow, 1, 1, lastCol)
        .setBackground('#ffffff')
        .setFontWeight('normal')
        .setFontColor('#000000')
        .setFontSize(CANON_FONT_BODY_)
        .setVerticalAlignment('bottom');
      const firstMonthCol = block.firstMonthCol || 3;
      sheet.getRange(newRow, 1, 1, Math.min(2, lastCol))
        .setHorizontalAlignment('left');
      if (lastCol >= firstMonthCol) {
        const monthSpan = Math.min(firstMonthCol + 11, lastCol) - firstMonthCol + 1;
        sheet.getRange(newRow, firstMonthCol, 1, monthSpan)
          .setHorizontalAlignment('right')
          .setNumberFormat('$#,##0.00;-$#,##0.00');
      }
    } catch (_stampErr) {
      Logger.log('insertNewInvestmentHistoryRow_ data-row stamp: ' + _stampErr);
    }
  } else {
    sheet.getRange(templateRow, 1, 1, lastCol).copyTo(
      sheet.getRange(newRow, 1, 1, lastCol),
      SpreadsheetApp.CopyPasteType.PASTE_FORMAT,
      false
    );
  }
  sheet.getRange(newRow, 1, 1, lastCol).clearContent();
  sheet.getRange(newRow, 1).setValue(accountName);
  // Column 2 in INPUT - Investments is "Type" (firstMonthCol = 3).
  sheet.getRange(newRow, 2).setValue(String(typeStr || ''));

  // New investments are Active = Yes. Historical rows created before the
  // Active column existed remain blank and are treated as active by readers.
  writeActiveCellWithRowFormat_(sheet, newRow, activeCol, 'Yes');

  // NOTE: the "Account Totals" gross =SUM is maintained by the caller
  // (addInvestmentAccountFromDashboard → refreshInvestmentsAccountTotalsRow_),
  // which both fills the seeded blank row on the first account and rewrites the
  // range on later inserts (the insert-above-footer case hits the Sheets
  // lower-boundary where =SUM does not auto-expand). Delta needs no refresh —
  // its fixed-cell references shift correctly when this row is inserted above.

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
 *   - "Account Name"    → yellow  #ffe599, bold black, centered, row height 32
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
  // RUNTIME styler — delegates to the shared Financial Ledger walker in
  // color+freeze-only mode (ENGINEERING_STANDARDS §9/§10). Canonical geometry
  // (year/header fonts, heights, alignment, border, body row heights) is set at
  // first-create in ensureInputInvestmentsSheet_ and is NEVER reasserted here,
  // so populated workbooks are never reshaped on routine adds. Marker set:
  //   Year → orange · "Account Name" (only when col B = "Type") → yellow ·
  //   "Account Totals" → green · "Delta" → pink. Freeze Account Name + Type.
  applyFinancialLedgerBaseStyle_(sheet, {
    mode: 'runtime',
    headerMarkerLabel: 'Account Name',
    headerRequireColB: 'Type',
    totalMarkerLabel: 'Account Totals',
    deltaMarkerLabel: 'Delta',
    freezeColumns: 2
  });
}

/* -------------------------------------------------------------------------- */
/*  Financial Ledger footer rows — Account Totals + Delta                     */
/*                                                                            */
/*  Golden Workbook Convergence (Investments Pass 2). Production parity for    */
/*  the per-year-block footer, confirmed against the bound workbook:          */
/*                                                                            */
/*    <investment account rows>                                              */
/*    Account Totals   ← per-month gross =SUM of the account rows            */
/*    Delta            ← month-over-month change of Account Totals           */
/*    <blank spacer row>                                                     */
/*    Year …           ← next year block                                    */
/*                                                                            */
/*  The Investments layout has NO "Total" roll-up column (Account Name |      */
/*  Type | Jan-YY … Dec-YY | Active), so — unlike Bank Accounts — the Delta   */
/*  row has no horizontal Total cell and none is invented.                    */
/*                                                                            */
/*  These mirror the proven, live-workbook-confirmed Bank Accounts helpers    */
/*  (seedBankAccountsTotalAccountsRow_ / seedBankAccountsDeltaRow_ /          */
/*  refreshBankAccountsTotalAccountsRow_) but use the Investments label       */
/*  "Account Totals" (Bank Accounts / House Values use "Total Accounts").     */
/*  All are FIRST-CREATE only + idempotent — a populated workbook returns at  */
/*  the `existing` guard in ensureInputInvestmentsSheet_ and never reaches    */
/*  the seeders, so existing sheets are never migrated or restyled.           */
/* -------------------------------------------------------------------------- */

/**
 * First-create seed of a label-only "Account Totals" summary row.
 *
 * Writes the literal "Account Totals" in column A on the row immediately
 * after the last content row and leaves every money cell BLANK — the gross
 * =SUM formulas are materialized by refreshInvestmentsAccountTotalsRow_ once
 * at least one account row exists (seeding a SUM on an empty block would be
 * self-referential; the blank-then-refresh split is deliberate and mirrors
 * seedBankAccountsTotalAccountsRow_ / seedDebtsTotalRow_).
 *
 * Only the 12 MMM-YY month columns are currency-pre-formatted (resolved by
 * header label via parseMonthHeader_), so the Type (col 2) and Active
 * columns are never touched — unlike Bank Accounts, whose fresh sheet had no
 * Active column and could blanket-format cols 2..lastCol.
 *
 * Idempotent: if an "Account Totals" row already exists this is a no-op and
 * returns its 1-based row. FIRST-CREATE only.
 *
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @returns {number} 1-based row of the Account Totals row, or -1 on failure
 */
function seedInvestmentsAccountTotalsRow_(sheet) {
  if (!sheet) return -1;

  const lastRow = Math.max(1, sheet.getLastRow());
  const colA = sheet.getRange(1, 1, lastRow, 1).getDisplayValues();
  for (let i = 0; i < colA.length; i++) {
    if (String(colA[i][0] || '').trim() === 'Account Totals') return i + 1;
  }

  const totalRow = sheet.getLastRow() + 1;
  sheet.getRange(totalRow, 1).setValue('Account Totals');

  // Currency-format only the month columns of the (currently blank) row so the
  // =SUM formulas filled later render consistently. Month columns resolved by
  // header label from the nearest "Account Name" header above — never the Type
  // or Active columns. Cosmetic only; never load-bearing.
  try {
    let headerRow = -1;
    for (let r = totalRow - 1; r >= 1; r--) {
      const name = String((colA[r - 1] && colA[r - 1][0]) || '').trim();
      if (name === 'Account Name') { headerRow = r; break; }
      if (name === 'Year') break;
    }
    if (headerRow !== -1) {
      const lastCol = sheet.getLastColumn();
      const headerVals = sheet.getRange(headerRow, 1, 1, lastCol).getDisplayValues()[0] || [];
      for (let c = 2; c <= lastCol; c++) {
        if (parseMonthHeader_(String(headerVals[c - 1] || '').trim())) {
          sheet.getRange(totalRow, c).setNumberFormat('$#,##0.00;-$#,##0.00');
        }
      }
    }
  } catch (_fmtErr) { /* cosmetic only */ }

  return totalRow;
}

/**
 * Read-only: locate the December "Account Totals" cell of a given year block
 * so a subsequent year's January Delta can chain across the year boundary
 * (Jan Delta = current-year Jan Account Totals − prior-year Dec Account
 * Totals, e.g. the confirmed `C36 - N15`).
 *
 * Operates on a pre-loaded full-sheet display snapshot (no Sheets reads).
 * Columns resolved by header label (parseMonthHeader_), never by position,
 * so the Active column never confuses the Dec lookup. Mirrors
 * findBankAccountsDecTotalAccountsCell_ with the Investments label.
 *
 * @param {string[][]} display  getDataRange().getDisplayValues() snapshot
 * @param {number} year         the block year to locate (e.g. blockYear - 1)
 * @returns {{row:number, col:number}|null}
 */
function findInvestmentsDecAccountTotalsCell_(display, year) {
  let yearRow = -1;
  for (let r = 0; r < display.length; r++) {
    const a = String((display[r] && display[r][0]) || '').trim();
    const b = String((display[r] && display[r][1]) || '').trim();
    if (a === 'Year' && b === String(year)) { yearRow = r + 1; break; }
  }
  if (yearRow === -1) return null;

  const headerRow = yearRow + 1;
  if (String((display[headerRow - 1] && display[headerRow - 1][0]) || '').trim() !== 'Account Name') {
    return null;
  }

  const headerVals = display[headerRow - 1] || [];
  let decCol = -1;
  for (let c = 2; c <= headerVals.length; c++) {
    const d = parseMonthHeader_(String(headerVals[c - 1] || '').trim());
    if (d && d.getMonth() === 11) { decCol = c; break; }
  }
  if (decCol === -1) return null;

  let taRow = -1;
  for (let r = headerRow; r < display.length; r++) {
    const name = String((display[r] && display[r][0]) || '').trim();
    if (r + 1 > headerRow && name === 'Year') break;
    if (name === 'Account Totals') { taRow = r + 1; break; }
  }
  if (taRow === -1) return null;

  return { row: taRow, col: decCol };
}

/**
 * First-create seed of the "Delta" month-over-month change row, placed
 * directly below the "Account Totals" summary row of the same year block.
 *
 * Production parity (confirmed against the live workbook):
 *   - Jan of the FIRST year block     → literal 0
 *   - Jan of a SUBSEQUENT year block  → Jan Account Totals − prior-year Dec
 *                                       Account Totals (cross-block, e.g. C36−N15)
 *   - Feb … Dec                       → this month's Account Totals −
 *                                       previous month's Account Totals (e.g. D36−C36)
 *
 * The Investments layout has no "Total" column, so no horizontal Delta total
 * is written (requirement: do not invent one). A /^total$/i scan finds no
 * such column and is naturally skipped.
 *
 * Seed-only by design — NO refresh hook required: the Jan / Feb…Dec formulas
 * reference the Account Totals row by fixed cell. When a new account row is
 * inserted above Account Totals, Sheets shifts the Account Totals + Delta rows
 * down together and auto-adjusts those references. There is no data-row RANGE
 * to grow (unlike the Account Totals gross =SUM), so nothing freezes stale.
 *
 * Idempotent: if any "Delta" row already exists this is a no-op and returns
 * its 1-based row. Requires an "Account Totals" row first; returns -1 when
 * none is present. FIRST-CREATE only. Mirrors seedBankAccountsDeltaRow_.
 *
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @returns {number} 1-based row of the Delta row, or -1 on no-op-miss/failure
 */
function seedInvestmentsDeltaRow_(sheet) {
  if (!sheet) return -1;

  const display = sheet.getDataRange().getDisplayValues();

  // Idempotent: any existing Delta row → no-op.
  for (let i = 0; i < display.length; i++) {
    if (String((display[i] && display[i][0]) || '').trim() === 'Delta') return i + 1;
  }

  // Delta sits directly below the first Account Totals row; never create one
  // without it.
  let totalRow = -1;
  for (let i = 0; i < display.length; i++) {
    if (String((display[i] && display[i][0]) || '').trim() === 'Account Totals') {
      totalRow = i + 1;
      break;
    }
  }
  if (totalRow === -1) return -1;

  // Header row = nearest "Account Name" above Account Totals.
  let headerRow = -1;
  for (let r = totalRow - 1; r >= 1; r--) {
    const name = String((display[r - 1] && display[r - 1][0]) || '').trim();
    if (name === 'Account Name') { headerRow = r; break; }
    if (name === 'Year') break;
  }
  if (headerRow === -1) return -1;

  const headerVals = display[headerRow - 1] || [];
  const lastCol = sheet.getLastColumn();

  // Catalog month columns (by label); derive the block year from the January
  // header so we can chain across years. No Total column exists in this model.
  const months = []; // { col, monthIndex }  monthIndex: 0=Jan … 11=Dec
  let blockYear = -1;
  for (let c = 2; c <= lastCol; c++) {
    const header = String(headerVals[c - 1] !== undefined ? headerVals[c - 1] : '').trim();
    if (!header) continue;
    const d = parseMonthHeader_(header);
    if (!d) continue; // skip Type / Active / unrelated columns
    months.push({ col: c, monthIndex: d.getMonth() });
    if (d.getMonth() === 0) blockYear = d.getFullYear();
  }
  if (months.length === 0) return -1;
  months.sort(function(a, b) { return a.col - b.col; });

  // Prior-year Dec Account Totals (pre-insert coordinates); null → first-year
  // semantics (Jan = 0).
  let priorDec = (blockYear > 0)
    ? findInvestmentsDecAccountTotalsCell_(display, blockYear - 1)
    : null;

  // Place Delta directly below Account Totals. Insert a physical row only when
  // content follows (e.g. another year block) so nothing is overwritten;
  // append when Account Totals is the last row (the fresh-create case).
  let deltaRow = totalRow + 1;
  const inserted = totalRow < sheet.getLastRow();
  if (inserted) {
    sheet.insertRowAfter(totalRow);
    deltaRow = totalRow + 1;
    if (priorDec && priorDec.row > totalRow) priorDec.row += 1;
  }
  sheet.getRange(deltaRow, 1).setValue('Delta');

  const currency = '$#,##0.00;-$#,##0.00';

  for (let idx = 0; idx < months.length; idx++) {
    const m = months[idx];
    const letter = columnToLetter_(m.col).toUpperCase();
    let formula = null;
    if (idx === 0) {
      // Leftmost month of the block (January in the canonical layout).
      if (m.monthIndex === 0 && priorDec) {
        formula = '=' + letter + totalRow + '-' +
          columnToLetter_(priorDec.col).toUpperCase() + priorDec.row;
      }
      // else: first-year Jan (or no prior block) → literal 0 below.
    } else {
      const prevLetter = columnToLetter_(months[idx - 1].col).toUpperCase();
      formula = '=' + letter + totalRow + '-' + prevLetter + totalRow;
    }
    try {
      const cell = sheet.getRange(deltaRow, m.col);
      if (formula) cell.setFormula(formula);
      else cell.setValue(0);
      cell.setNumberFormat(currency);
    } catch (_mErr) { /* non-fatal */ }
  }

  return deltaRow;
}

/**
 * Maintains a year block's "Account Totals" summary row so each month column's
 * gross =SUM range covers every account data row above the summary. Gross by
 * design — inactive accounts still count, matching a hand-authored =SUM.
 *
 * Required (not optional) because:
 *   - The seeded Account Totals row starts BLANK; the shared
 *     refreshBlockSumAggregates_ only rewrites cells that ALREADY hold a
 *     simple SUM and never fills blanks (see cashflow_setup.js) — so it can
 *     never materialize the first fill.
 *   - Inserting a new account row directly above Account Totals hits the
 *     Sheets lower-boundary case where =SUM does NOT auto-expand, so seeded
 *     formulas alone would silently drop the newest account.
 *
 * Bound-mode safety (exact-shape guard):
 *   - Acts only when an Account Totals row already exists; NEVER creates one.
 *   - Scoped strictly to MMM-YY month columns (parseMonthHeader_); the Type
 *     and Active columns are never given a currency =SUM. No Total column
 *     exists in this model.
 *   - Fills a money cell only when it is truly BLANK (the seeded state) or it
 *     already holds a strict simple =SUM on its OWN column (range or the
 *     Sheets-normalized single-cell shape). Literals / compound / cross-sheet
 *     / Delta-style formulas are left untouched.
 *   - Scoped to a single Year block (bails at the next "Year" marker).
 *
 * Best-effort: all failures are swallowed; must never block an account save.
 * Mirrors refreshBankAccountsTotalAccountsRow_.
 *
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @param {number|string} year  the Year block to refresh (e.g. current year)
 */
function refreshInvestmentsAccountTotalsRow_(sheet, year) {
  try {
    if (!sheet) return;

    const display = sheet.getDataRange().getDisplayValues();
    const block = getInvestmentsYearBlock_(sheet, year, display);

    const dataStart = block.dataStartRow;
    const dataEnd = findLastInvestmentDataRowInBlock_(sheet, block);
    if (dataEnd === -1 || dataEnd < dataStart) return; // no account rows yet

    // Locate THIS block's Account Totals row, bailing at the next Year marker.
    let totalRow = -1;
    for (let r = block.headerRow; r < display.length; r++) {
      const name = String((display[r] && display[r][0]) || '').trim();
      if (r + 1 > block.headerRow && name === 'Year') break;
      if (name === 'Account Totals') { totalRow = r + 1; break; }
    }
    if (totalRow === -1) return; // no summary row — never create one here

    const headerRowVals = display[block.headerRow - 1] || [];
    const lastCol = sheet.getLastColumn();
    const currency = '$#,##0.00;-$#,##0.00';
    const simpleSum = /^=SUM\(\s*\$?([A-Z]+)\$?(\d+)\s*:\s*\$?([A-Z]+)\$?(\d+)\s*\)$/i;
    const singleCellSum = /^=SUM\(\s*\$?([A-Z]+)\$?(\d+)\s*\)$/i;

    for (let c = block.firstMonthCol; c <= lastCol; c++) {
      const header = String((headerRowVals[c - 1] !== undefined ? headerRowVals[c - 1] : '')).trim();
      if (!parseMonthHeader_(header)) continue; // month columns only (skip Active)

      const letter = columnToLetter_(c).toUpperCase();
      const canonical = '=SUM(' + letter + dataStart + ':' + letter + dataEnd + ')';
      const cell = sheet.getRange(totalRow, c);

      let formula = '';
      try { formula = String(cell.getFormula() || '').trim(); } catch (_) { continue; }

      if (formula === '') {
        // No formula present. Only fill a truly blank cell — a literal value
        // (possible in a hand-authored bound workbook) is left alone.
        let val = '';
        try { val = cell.getValue(); } catch (_) { continue; }
        const isBlank = (val === '' || val === null || val === undefined);
        if (!isBlank) continue;
        try {
          cell.setFormula(canonical);
          cell.setNumberFormat(currency);
        } catch (_setErr) { /* non-fatal */ }
        continue;
      }

      // A formula is present — accept only a SUM we own on this column, in
      // either the range or single-cell (normalized/shifted) shape.
      const m = formula.match(simpleSum);
      if (m) {
        if (m[1].toUpperCase() !== m[3].toUpperCase()) continue;
        if (m[1].toUpperCase() !== letter) continue;
      } else {
        const s = formula.match(singleCellSum);
        if (!s) continue;
        if (s[1].toUpperCase() !== letter) continue;
      }
      if (formula === canonical) continue;
      try {
        cell.setFormula(canonical);
        cell.setNumberFormat(currency);
      } catch (_setErr2) { /* non-fatal */ }
    }
  } catch (e) {
    Logger.log('refreshInvestmentsAccountTotalsRow_: ' + e);
  }
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
  } else {
    // No existing data row to clone from (freshly created sheet, or a
    // header-only body). Stamp the canonical Golden body font AND row
    // height on JUST the row we appended so it never lands at the Apps
    // Script defaults (10pt / ~21px). Additive and narrowly scoped:
    // touches only the new row, never any existing row's formatting,
    // width, or height.
    try {
      sheet.getRange(appendedRow, 1, 1, lastCol).setFontSize(CANON_FONT_BODY_);
      sheet.setRowHeight(appendedRow, 26);
    } catch (bodyStampErr) {
      Logger.log('appendAssetsRowForNewInvestment_ body stamp failed: ' + bodyStampErr);
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
 *   - Header row (row 1) → yellow #ffe599, bold black, centered
 *     horizontal / middle vertical.
 *   - Solid-medium black bottom border under row 1 to separate header
 *     from the data body.
 *   - Frozen row 1 + frozen column 1 so Account Name stays pinned
 *     when scrolling.
 *
 * Header ROW HEIGHT is deliberately NOT set here. Per the Styling
 * Reassertion Rule (ENGINEERING_STANDARDS.md §9), runtime helpers must not
 * repeatedly force cosmetic row heights on every write — doing so clobbered
 * the taller first-create header height in the same add flow, and mutated
 * existing user sheets on routine actions. Header height is established once
 * on first-create in `ensureSysAssetsSheet_`; existing sheets keep whatever
 * height they already have.
 *
 * Data rows, number formats, and any user cell highlights are
 * deliberately never touched. Failures are swallowed — cosmetic only.
 */
function applyAssetsSheetStyling_(sheet) {
  if (!sheet) return;
  let lastCol = 1;
  try { lastCol = Math.max(1, sheet.getLastColumn()); } catch (_) { return; }

  // Runtime = COLOR only (ENGINEERING_STANDARDS §9/§10). Header alignment,
  // vertical alignment, row height, and the thin black bottom border are
  // canonical GEOMETRY set at first-create in ensureSysAssetsSheet_ — never
  // reasserted here so populated workbooks are never reshaped.
  try {
    sheet.getRange(1, 1, 1, lastCol)
      .setBackground(CANON_HEADER_YELLOW_)
      .setFontWeight('bold')
      .setFontColor('#000000');
  } catch (_headerErr) { /* cosmetic */ }

  // Freeze panes are asserted here because the app relies on the pinned
  // header row / first column for correctness.
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

  // Ensure-before-validate guards. Both helpers are idempotent no-ops on
  // populated workbooks (sheet exists → returned untouched). On a fresh
  // workbook they write the canonical structure the duplicate-name
  // validation (getInvestmentsFromHistory_ / assetExistsInAssetsSheet_)
  // and the writes further down depend on. They MUST run BEFORE
  // validateNewInvestmentAccountName_ below, because that validator reads
  // INPUT - Investments / SYS - Assets and would otherwise throw
  // "Missing sheet: …" on a brand-new workbook. Mirrors the
  // ensure-before-validate ordering in addHouseFromDashboard.
  try {
    ensureInputInvestmentsSheet_();
  } catch (ensureErr) {
    throw new Error(
      "Couldn't prepare investments: " +
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
  // Flush so subsequent reads (validation + the writes below) see the
  // just-inserted sheets — without this, getSheet_ can still miss a
  // freshly-created sheet on some Apps Script executions.
  try { SpreadsheetApp.flush(); } catch (_flushErr) { /* best-effort */ }

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

  const ss = getUserSpreadsheet_();
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

  // Materialize / maintain the current-year "Account Totals" gross =SUM so it
  // covers the just-inserted account row: fills the seeded blank row on the
  // first account and rewrites the range on later inserts (insert-above-footer
  // lower-boundary case). Best-effort — a failure here must never undo an
  // account that is already saved. Mirrors addBankAccountFromDashboard.
  try {
    refreshInvestmentsAccountTotalsRow_(invSheet, currentYear);
  } catch (totalErr) {
    Logger.log('addInvestmentAccountFromDashboard refreshInvestmentsAccountTotalsRow_: ' + totalErr);
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
    message: 'Investment account added.'
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

  const ss = getUserSpreadsheet_();
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
