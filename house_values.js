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
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet=} optionalSs Explicit target for
 *   disposable harness runs; normal product callers resolve the user's workbook.
 * @returns {GoogleAppsScript.Spreadsheet.Sheet}
 */
function ensureInputHouseValuesSheet_(optionalSs) {
  const ss = optionalSs || getUserSpreadsheet_();
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

  // Column geometry: A=House, B=Loan Amount Left, C..N = the 12 MMM-YY month
  // columns (firstMonthCol = 3), O = Active. Mirrors
  // ensureHouseValuesActiveColumnForBlock_(block.firstMonthCol + 12).
  const firstMonthCol = 3;
  const lastMonthCol = firstMonthCol + monthLabels.length - 1; // 14 (Dec)
  const activeCol = lastMonthCol + 1;                          // 15 (Active)

  // Golden Workbook Convergence (Financial Ledger parity, mirrors the validated
  // Investments / Bank Accounts creators) — (1) pin the month headers as literal
  // text so Sheets never auto-parses "Jan-26" into a Date, and (2) currency-
  // format the money columns (Loan Amount Left + the 12 month columns) so the
  // first value typed renders like Cash Flow / Investments. Bounded to current
  // max rows; data rows begin at row 3. Cosmetic and FIRST-CREATE only
  // (populated sheets return at the `existing` guard above).
  try {
    for (let mh = 0; mh < monthLabels.length; mh++) {
      const hdrCell = sheet.getRange(2, firstMonthCol + mh);
      hdrCell.setNumberFormat('@STRING@');
      hdrCell.setValue(monthLabels[mh] + '-' + yy);
    }
    const maxRowsHv = sheet.getMaxRows();
    if (maxRowsHv > 2) {
      // Loan Amount Left (col 2) + the 12 month columns are money.
      sheet.getRange(3, 2, maxRowsHv - 2, (lastMonthCol - 2) + 1)
        .setNumberFormat('$#,##0.00;-$#,##0.00');
    }
  } catch (_fmtErr) { /* cosmetic only */ }

  // Canonical banner coloring (orange Year, yellow header, green Total Values /
  // pink House Assets footer bands, frozen cols) — cosmetic only, wrapped so a
  // formatting hiccup never fails structural creation.
  try {
    applyHouseValuesSheetStyling_(sheet);
  } catch (_styleErr) { /* cosmetic only */ }

  // Golden Workbook font-size parity (Financial Ledger family) — FIRST-CREATE
  // ONLY. A fresh Apps Script sheet defaults to size 10; the bound Golden
  // Workbook uses Year 20 / header 16 / body 14. Wash the ENTIRE sheet to the
  // canonical body size (14) so every row — data rows, Total Values, House
  // Assets, and any future inserted row — defaults to 14, then raise row 1
  // (Year banner) to 20 and row 2 (House header) to 16. Applied HERE and not in
  // applyHouseValuesSheetStyling_ (which also runs on populated workbooks on
  // every add) so an existing user's sheet is never body-restyled. Cosmetic
  // only; failures are swallowed.
  try {
    const maxRowsFont = sheet.getMaxRows();
    const lastColFont = Math.max(1, sheet.getLastColumn());
    sheet.getRange(1, 1, maxRowsFont, lastColFont).setFontSize(CANON_FONT_BODY_);
    sheet.getRange(1, 1, 1, lastColFont).setFontSize(CANON_FONT_YEAR_BANNER_); // Year banner (20)
    sheet.getRange(2, 1, 1, lastColFont).setFontSize(CANON_FONT_HEADER_); // House header (16)
  } catch (_fontErr) { /* cosmetic only */ }

  // Canonical row GEOMETRY (FIRST-CREATE ONLY). Year banner + header at 40px,
  // vertical-middle; header horizontally centered with a thin black bottom
  // border; body rows at 26px. Applied HERE — never in applyHouseValuesSheetStyling_,
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

  // Widen-only readable column widths, applied HERE in the first-create path
  // only — never inside applyHouseValuesSheetStyling_, which also runs on
  // populated workbooks (insertNewHouseHistoryRow_) and must not resize a
  // user's columns. Converges a fresh sheet toward the Golden Workbook's
  // readable widths without ever shrinking a manually widened column. House
  // (260) mirrors the Financial Ledger family standard from Bank Accounts /
  // Investments; the month columns (140) are widened beyond the 110 family
  // default because property valuations are far larger than typical account
  // balances — a 7-figure value like $1,000,000.00 (and headroom for
  // $10,000,000.00) reads cleanly with breathing room instead of touching the
  // column edge; Loan Amount Left (210) gives the 16-char header (16pt bold)
  // comfortable spacing plus large loan values; Active (90) is readable.
  try {
    if (sheet.getColumnWidth(1) < 260) sheet.setColumnWidth(1, 260);
    if (sheet.getColumnWidth(2) < 210) sheet.setColumnWidth(2, 210);
    for (let c = firstMonthCol; c <= lastMonthCol; c++) {
      if (sheet.getColumnWidth(c) < 140) sheet.setColumnWidth(c, 140);
    }
    if (sheet.getColumnWidth(activeCol) < 90) sheet.setColumnWidth(activeCol, 90);
  } catch (_widthErr) { /* cosmetic only */ }

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
/**
 * Canonical column widths for SYS - House Assets, addressed by exact header
 * name. Single source of truth for both first-create styling and the safe
 * widen-only self-heal applied to existing sheets. Readability-first values
 * comparable to SYS - Assets (Type is wider than SYS - Assets because property
 * types — e.g. "Primary Residence" — are longer than investment types).
 */
var SYS_HOUSE_ASSETS_CANONICAL_WIDTHS_ = {
  'House': 280,
  'Type': 200,
  'Loan Amount Left': 240,
  'Current Value': 230,
  'Active': 110
};

/**
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet=} optionalSs Explicit target for
 *   disposable harness runs; normal product callers resolve the user's workbook.
 * @returns {GoogleAppsScript.Spreadsheet.Sheet}
 */
function ensureSysHouseAssetsSheet_(optionalSs) {
  const ss = optionalSs || getUserSpreadsheet_();
  const names = getSheetNames_();
  const sheetName = names.HOUSE_ASSETS;

  const existing = ss.getSheetByName(sheetName);
  if (existing) {
    // Safe widen-only self-heal for existing populated sheets: converge column
    // widths toward the canonical readable values WITHOUT ever shrinking a
    // user-widened column, moving/renaming columns, or touching data, fonts,
    // heights, or formulas. applyCanonicalColumnWidthsByHeader_ locates columns
    // by header name, sets max(current, canonical), and swallows all failures —
    // an approved additive convergence per ENGINEERING_STANDARDS.md (width-only,
    // idempotent). This is the one explicitly-approved existing-sheet change.
    try {
      applyCanonicalColumnWidthsByHeader_(existing, 1, SYS_HOUSE_ASSETS_CANONICAL_WIDTHS_);
    } catch (_selfHealErr) { /* cosmetic only */ }
    return existing;
  }

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

  // Canonical SYS-family base presentation (FIRST-CREATE ONLY) via the shared
  // helper — identical to SYS - Assets / SYS - Accounts. Yellow #ffe599 header
  // at the SYS 20pt size, centered + thin black bottom border, height 40; white
  // body at 14pt, 26px rows; canonical widths (widen-only, from the shared
  // SYS_HOUSE_ASSETS_CANONICAL_WIDTHS_ map — same values as the existing-sheet
  // self-heal above); frozen header row + first column. Safe: the sheet was
  // just inserted and this path is never reached for a populated workbook.
  applySysSheetBaseStyle_(sheet, SYS_HOUSE_ASSETS_CANONICAL_WIDTHS_);

  return sheet;
}

function getHouseUiData() {
  // Performance: previously this RPC made TWO full reads of
  // SYS - House Assets in a row — once for the distinct Type values
  // (getHouseAssetsDistinctColumnValues_) and once for the inactive
  // set (getInactiveHousesSet_). On populated workbooks each read is
  // a ~300–800ms round-trip. We now load SYS - House Assets ONCE and
  // derive both from the same snapshot. The INPUT - House Values
  // history read (1 round-trip) is unchanged.
  // Blank-workbook safety: on a fresh sheet INPUT - House Values does
  // not exist yet and getHousesFromHouseValues_() -> getSheet_() would
  // throw a red banner on the House Values page. Return the same shape
  // with empty lists so the page renders clean.
  const ss = getUserSpreadsheet_();
  if (!ss.getSheetByName(getSheetNames_().HOUSE_VALUES)) {
    return { houses: [], propertyTypeOptions: [] };
  }

  var propertyTypeOpts = [];
  let inactive = Object.create(null);

  try {
    const haSheet = ss.getSheetByName(getSheetNames_().HOUSE_ASSETS);
    if (haSheet) {
      const haDisplay = haSheet.getDataRange().getDisplayValues();
      if (haDisplay.length >= 1) {
        const headers = haDisplay[0] || [];
        const houseIdx = headers.indexOf('House');
        const typeIdx = headers.indexOf('Type');
        const activeIdx = headers.indexOf('Active');

        const typeSet = Object.create(null);

        for (let r = 1; r < haDisplay.length; r++) {
          const row = haDisplay[r] || [];

          if (typeIdx !== -1) {
            const t = String(row[typeIdx] || '').trim();
            if (t) typeSet[t] = true;
          }

          if (houseIdx !== -1 && activeIdx !== -1) {
            const name = String(row[houseIdx] || '').trim();
            if (name) {
              const raw = String(row[activeIdx] || '').trim().toLowerCase();
              if (raw === 'no' || raw === 'n' || raw === 'false' || raw === 'inactive') {
                inactive[name.toLowerCase()] = true;
              }
            }
          }
        }

        propertyTypeOpts = Object.keys(typeSet).sort(function(a, b) { return a.localeCompare(b); });
      }
    }
  } catch (e) {
    Logger.log('getHouseUiData house-assets read: ' + e);
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
  const ss = getUserSpreadsheet_();
  return getInactiveHousesSetForSpreadsheet_(ss);
}

function getInactiveHousesSetForSpreadsheet_(ss) {
  const sheet = ss && ss.getSheetByName(getSheetNames_().HOUSE_ASSETS);
  const inactive = Object.create(null);
  if (!sheet) return inactive;
  const display = sheet.getDataRange().getDisplayValues();
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

/** Active property names from SYS - House Assets for managed debt linking. */
function getActiveHouseNamesForSpreadsheet_(ss) {
  const sheet = ss && ss.getSheetByName(getSheetNames_().HOUSE_ASSETS);
  if (!sheet) return [];
  const display = sheet.getDataRange().getDisplayValues();
  if (display.length < 2) return [];

  let headerMap;
  try {
    headerMap = getHouseAssetsHeaderMap_(sheet, display);
  } catch (_e) {
    return [];
  }

  const names = [];
  const seen = Object.create(null);
  for (let r = 1; r < display.length; r++) {
    const name = String(display[r][headerMap.houseColZero] || '').trim();
    if (!name) continue;
    const activeRaw = headerMap.activeColZero === -1
      ? ''
      : String(display[r][headerMap.activeColZero] || '').trim();
    const activeKey = activeRaw.toLowerCase();
    if (activeKey === 'no' || activeKey === 'n' || activeKey === 'false' || activeKey === 'inactive') continue;
    const key = name.toLowerCase();
    if (seen[key]) continue;
    seen[key] = true;
    names.push(name);
  }
  return names.sort(function(a, b) { return a.localeCompare(b); });
}

/**
 * Distinct non-empty values from a column on SYS - House Assets.
 * Used to populate the property-type datalist on the Add New House form.
 * @param {string} headerLabel e.g. "Type"
 * @returns {string[]}
 */
function getHouseAssetsDistinctColumnValues_(headerLabel) {
  const ss = getUserSpreadsheet_();
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
  const ss = getUserSpreadsheet_();
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

  // Performance: previously this RPC did 2 full reads of HOUSE_VALUES
  // (one per month) plus a per-row range loop inside findHouseRowInBlock_
  // each time, so picking a date triggered ~50+ Sheet round-trips on
  // populated workbooks. Now we read HOUSE_VALUES once and share the
  // snapshot across both months via the optionalDisplay parameter on
  // the year-block + row-find helpers. The whole sheet (all year blocks)
  // is in memory so the prior-month case crosses year boundaries cleanly.
  const ss = getUserSpreadsheet_();
  const hvSheet = getSheet_(ss, 'HOUSE_VALUES');
  const hvDisplay = hvSheet.getDataRange().getDisplayValues();

  // Preview must mirror the SAVE path (updateHouseValueByDate): the house
  // lives in the CURRENT-year block, and an out-of-year selected date (e.g.
  // 02/10/2020) resolves to a safe month in that block via the shared
  // resolveHouseValuesSeedDate_ helper — never searching for or creating a
  // historical year block. seedDate drives the block/month lookup and the
  // displayed "selectedMonth"; the raw selected date `d` is untouched and is
  // still what the client sends back to updateHouseValueByDate on save (which
  // preserves it verbatim in the activity log).
  const currentYear = getCurrentYear_();
  const seedDate = resolveHouseValuesSeedDate_(d, currentYear);
  const monthValue = getHouseValueFromHistoryForMonthFromDisplay_(
    hvSheet, hvDisplay, houseName, currentYear, seedDate
  );
  const assetsInfo = getHouseAssetRowData_(houseName);

  var previousMonthLabel = '';
  var deltaFromPreviousMonth = null;
  try {
    // Prior month is derived from the resolved seed month so it stays within
    // the current-year block. When seedDate is January the prior month is Dec
    // of the previous year, whose block may not exist — that lookup throws and
    // is swallowed below (no delta), matching prior behavior.
    const prior = new Date(seedDate.getFullYear(), seedDate.getMonth() - 1, 15);
    const priorYear = prior.getFullYear();
    const previousMonthValue = getHouseValueFromHistoryForMonthFromDisplay_(
      hvSheet, hvDisplay, houseName, priorYear, prior
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
    house: houseName,
    selectedMonth: Utilities.formatDate(seedDate, Session.getScriptTimeZone(), 'MMM-yy'),
    selectedMonthValue: monthValue,
    currentAssetValue: assetsInfo ? assetsInfo.currentValue : '',
    propertyType: assetsInfo ? assetsInfo.propertyType : '',
    loanAmountLeft: assetsInfo ? assetsInfo.loanAmountLeft : '',
    previousMonthLabel: previousMonthLabel,
    deltaFromPreviousMonth: deltaFromPreviousMonth
  };
}

/**
 * Internal twin of getHouseValueFromHistoryForMonth_ that takes a
 * pre-loaded HOUSE_VALUES display-values snapshot so callers reading
 * multiple months in a single RPC don't re-fetch the same sheet for
 * each lookup. Used by getHouseValueForDate for the current+prior
 * month delta panel; the monthly cell value itself is still read with
 * sheet.getRange(...).getValue() so the rounding behavior is identical.
 */
function getHouseValueFromHistoryForMonthFromDisplay_(sheet, display, houseName, year, valuationDate) {
  const block = getHouseValuesYearBlock_(sheet, year, display);
  const houseRow = findHouseRowInBlock_(sheet, block, houseName, display);
  if (houseRow === -1) {
    throw new Error('Could not find house "' + houseName + '" inside Year ' + year + ' block.');
  }
  const monthCol = getMonthColumnByDate_(sheet, valuationDate, block.headerRow);
  return round2_(toNumber_(sheet.getRange(houseRow, monthCol).getValue()));
}

/**
 * Canonical month-seed date resolver for House Values writes (Add + Update).
 *
 * A house row always lives in the CURRENT-year block; this returns the date
 * used ONLY to choose which month column of that block receives the value.
 * When the entered date already falls in the block year we honor its month;
 * when it is historical or in the future (out-of-block-year) we fall back to
 * today — always inside the block year, since getCurrentYear_() is the
 * calendar year — so the month-column lookup, which keys on month AND year
 * ("MMM-yy"), resolves instead of throwing "Could not find month column".
 *
 * Never creates, searches, or backfills historical year blocks. The caller is
 * responsible for preserving the user's raw entered date in any log/detail.
 *
 * @param {!Date} valuationDate  parsed, validated entered date
 * @param {number} blockYear     the current-year block being written
 * @returns {!Date} a date guaranteed to fall inside blockYear
 */
function resolveHouseValuesSeedDate_(valuationDate, blockYear) {
  if (valuationDate && valuationDate.getFullYear() === blockYear) {
    return valuationDate;
  }
  return stripTime_(new Date());
}

function updateHouseValueByDate(payload) {
  validateRequired_(payload, ['house', 'valuationDate', 'currentValue']);

  const house = String(payload.house || '').trim();
  const valuationDate = parseIsoDateLocal_(payload.valuationDate);
  const currentValue = toNumber_(payload.currentValue);

  if (!house) throw new Error('House is required.');
  if (isNaN(valuationDate.getTime())) throw new Error('Invalid valuation date.');
  if (currentValue <= 0) throw new Error('Current value must be greater than 0.');

  // Update mirrors Add: the destination is ALWAYS the current-year block.
  // Historical dates express user intent only; the entered date is preserved
  // in the activity log below, but the block/month resolution uses the same
  // canonical seed-date logic as addHouseFromDashboard so an out-of-year date
  // (e.g. 02/10/2020) seeds a safe month in the current block instead of
  // searching for a nonexistent 2020 block.
  const currentYear = getCurrentYear_();
  const seedDate = resolveHouseValuesSeedDate_(valuationDate, currentYear);
  const year = currentYear;
  const monthLabel = Utilities.formatDate(seedDate, Session.getScriptTimeZone(), 'MMM-yy');
  const ss = getUserSpreadsheet_();

  // Capture the prior month-cell value BEFORE the overwrite so the activity
  // log row can show both the previous and new valuation. Best-effort —
  // a failed read here just leaves previousRaw null and the action label
  // falls back to a value-only form. Mirrors the read-then-write pattern
  // bank_accounts.js::updateBankAccountValueByDate uses for its activity
  // log; the duplicate block/row/col lookup is intentionally local so
  // updateHouseValuesHistory_'s contract stays unchanged for the
  // addHouseFromDashboard caller.
  let previousRaw = null;
  let previousDisplay = '';
  try {
    const prevSheet = getSheet_(ss, 'HOUSE_VALUES');
    const prevBlock = getHouseValuesYearBlock_(prevSheet, year);
    const prevRow = findHouseRowInBlock_(prevSheet, prevBlock, house);
    if (prevRow !== -1) {
      const prevCol = getMonthColumnByDate_(prevSheet, seedDate, prevBlock.headerRow);
      const prevCell = prevSheet.getRange(prevRow, prevCol);
      previousRaw = round2_(toNumber_(prevCell.getValue()));
      previousDisplay = String(prevCell.getDisplayValue() || '').trim();
    }
  } catch (prevErr) {
    Logger.log('updateHouseValueByDate previous-read: ' + prevErr);
  }

  const historyUpdated = updateHouseValuesHistory_(house, year, seedDate, currentValue);

  syncAllHouseAssetsFromLatestCurrentYear_();
  touchDashboardSourceUpdated_('house_values');

  // Activity log: house-value snapshot edit. Mirrors bank_account_update /
  // debt_update — non-monetary (Amount renders "—") because this is a
  // valuation snapshot, not a money movement; the action label carries
  // the month + new value for context, e.g.
  //   "Updated May-26 value to $850,000.00".
  // Logged BEFORE runDebtPlanner so the row is captured even if the
  // planner trips on bad data downstream.
  try {
    const tz = Session.getScriptTimeZone();
    const newRaw = round2_(toNumber_(currentValue));
    appendActivityLog_(ss, {
      eventType: 'house_value_update',
      entryDate: Utilities.formatDate(stripTime_(new Date()), tz, 'yyyy-MM-dd'),
      amount: 0,
      direction: '',
      payee: house,
      category: '',
      accountSource: '',
      cashFlowSheet: '',
      cashFlowMonth: '',
      dedupeKey: '',
      details: JSON.stringify({
        detailsVersion: 1,
        fieldName: 'Value',
        fieldKind: 'currency',
        monthLabel: monthLabel,
        valuationDate: Utilities.formatDate(valuationDate, tz, 'yyyy-MM-dd'),
        previousRaw: previousRaw,
        previousDisplay: previousDisplay,
        newRaw: newRaw,
        historyUpdated: !!historyUpdated
      })
    });
  } catch (logErr) {
    Logger.log('updateHouseValueByDate activity log: ' + logErr);
  }

  // NOTE: we intentionally do NOT call runDebtPlanner() here. The sheet
  // write + SYS - House Assets sync + activity log row are everything
  // the user needs to see the new value reflected. Planner-derived
  // panels (Rolling Debt Payoff, Net Worth trend, etc.) are refreshed
  // by the main dashboard firing runPlannerAndRefreshDashboard() as a
  // silent background RPC after this save returns — same pattern
  // Planning → Debts (saveDebt), Quick Add (savePayment), and bank
  // balance updates use, so the UI doesn't hang on "Saving…" while the
  // planner runs for several seconds on big workbooks. See
  // Dashboard_Script_AssetsHouseValues.html::saveHouse().
  return {
    ok: true,
    message: 'House value saved.'
  };
}

function updateHouseValuesHistory_(house, year, valuationDate, currentValue) {
  const ss = getUserSpreadsheet_();
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
  const ss = getUserSpreadsheet_();
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
function syncAllHouseAssetsFromLatestCurrentYear_(optionalSs) {
  // Performance: previously this function did ~4 sheet round-trips PER
  // HOUSE inside getLatestHouseValuesForYear_, then ~2-3 more
  // round-trips PER SYS - House Assets ROW writing through
  // setCurrencyCellPreserveRowFormat_ even when the value hadn't
  // changed. Now we (1) compute the latest map with 2 round-trips
  // total via a batched read and (2) skip the format-preserving write
  // when the new value equals the existing value.
  const ss = optionalSs || getUserSpreadsheet_();
  const hvSheet = getSheet_(ss, 'HOUSE_VALUES');
  const haSheet = getSheet_(ss, 'HOUSE_ASSETS');

  const haRaw = haSheet.getDataRange().getValues();
  const haDisplay = haSheet.getDataRange().getDisplayValues();

  if (haRaw.length < 2) throw new Error('House Assets sheet is empty.');

  const haHeaderMap = getHouseAssetsHeaderMap_(haSheet, haDisplay);
  const currentYear = getCurrentYear_();
  const latestMap = getLatestHouseValuesForYear_(hvSheet, currentYear);

  for (let r = 1; r < haRaw.length; r++) {
    const house = String(haDisplay[r][haHeaderMap.houseColZero] || '').trim();
    if (!house) continue;
    if (!Object.prototype.hasOwnProperty.call(latestMap, house)) continue;

    const newValue = latestMap[house];
    const existing = haHeaderMap.valueColZero === -1
      ? null
      : round2_(toNumber_(haRaw[r][haHeaderMap.valueColZero]));
    if (existing !== null && existing === round2_(toNumber_(newValue))) continue;

    setCurrencyCellPreserveRowFormat_(
      haSheet,
      r + 1,
      haHeaderMap.valueCol,
      newValue,
      1
    );
  }
}

function getLatestHouseValuesForYear_(sheet, year) {
  // Performance: same fix as getLatestInvestmentValuesForYear_. Read
  // the year block in 2 batched calls (display once, values once) and
  // resolve the latest non-empty month entirely in memory instead of
  // calling getRange() per row.
  const display = sheet.getDataRange().getDisplayValues();
  const block = getHouseValuesYearBlock_(sheet, year, display);
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
    const sub = String(dispRow[1] || '').trim();
    if (!isHouseDataRowName_(name, sub)) continue;

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

function getHouseAssetRowData_(house) {
  const ss = getUserSpreadsheet_();
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

function getHouseValuesYearBlock_(sheet, year, optionalDisplay) {
  // Performance: same fix as bank_accounts.js::getBankAccountsYearBlock_.
  // Previously this helper read the full sheet, then re-fetched column A
  // one cell at a time (sheet.getRange(row, 1).getDisplayValue()) just
  // to find the dataEndRow boundary and validate the header row. We now
  // reuse the loaded snapshot for everything, and accept an optional
  // pre-loaded display from callers that already have it (e.g.
  // getHouseValueForDate uses one snapshot for both current+prior month).
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
    throw new Error('Could not find Year block for ' + year + ' in House Values.');
  }

  const headerRow = yearRow + 1;
  const headerName = String(
    (display[headerRow - 1] && display[headerRow - 1][0]) || ''
  ).trim();
  if (headerName !== 'House') {
    throw new Error('Expected House header row for Year ' + year + ' in House Values.');
  }

  const dataStartRow = headerRow + 1;
  let dataEndRow = display.length;

  for (let r = dataStartRow - 1; r < display.length; r++) {
    const name = String((display[r] && display[r][0]) || '').trim();
    if (name === 'Total Values' || name === 'House Assets' || name === 'Year') {
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

function findHouseRowInBlock_(sheet, block, houseName, optionalDisplay) {
  // Performance: same fix as bank_accounts.js::findBankAccountRowInBlock_.
  // Replace the per-row getRange(row, 1).getDisplayValue() / getRange(row, 2)
  // pair with a single batched range read of columns A:B over the block,
  // or reuse the caller's already-loaded full-sheet display when given.
  if (block.dataEndRow < block.dataStartRow) return -1;

  let names;
  let subs;
  if (optionalDisplay && optionalDisplay.length) {
    names = [];
    subs = [];
    for (let r = block.dataStartRow - 1; r <= block.dataEndRow - 1 && r < optionalDisplay.length; r++) {
      const row = optionalDisplay[r] || [];
      names.push(row[0] !== undefined ? row[0] : '');
      subs.push(row[1] !== undefined ? row[1] : '');
    }
  } else {
    const numRows = block.dataEndRow - block.dataStartRow + 1;
    const slice = sheet.getRange(block.dataStartRow, 1, numRows, 2).getDisplayValues();
    names = slice.map(function(row) { return row[0]; });
    subs = slice.map(function(row) { return row[1]; });
  }

  for (let i = 0; i < names.length; i++) {
    const name = String(names[i] || '').trim();
    const sub = String(subs[i] || '').trim();
    if (!isHouseDataRowName_(name, sub)) continue;
    if (name === houseName) return block.dataStartRow + i;
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

function getHouseAssetsHeaderMap_(sheet, optionalDisplay) {
  // Performance: when callers already loaded the SYS - House Assets
  // display values, pass them in via optionalDisplay to skip the
  // redundant header round-trip. Behavior unchanged when omitted.
  const headers = (optionalDisplay && optionalDisplay.length)
    ? (optionalDisplay[0] || [])
    : (sheet.getDataRange().getDisplayValues()[0] || []);

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
    const ss = getUserSpreadsheet_();
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

  const ss = getUserSpreadsheet_();
  if (ss.getSheetByName('HOUSES - ' + name)) {
    throw new Error('A sheet named "HOUSES - ' + name + '" already exists.');
  }

  return name;
}

function houseExistsInHouseAssetsSheet_(houseName) {
  const target = String(houseName || '').trim();
  if (!target) return false;

  const ss = getUserSpreadsheet_();
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

  // When the only candidate template is the year-block header row (an empty
  // block getting its very first house) — or a reserved aggregate/marker row
  // directly below (a "Total Values" / "House Assets" footer) — cloning its
  // format would stamp the bright-yellow header band (or a green/pink summary
  // band) onto a data row. We detect that case and stamp a clean data-row
  // style instead of cloning. Cloning a REAL house row (the common case) is
  // unchanged. Mirrors investments.js::insertNewInvestmentHistoryRow_.
  let templateIsHeader = false;

  if (lastHouseRow === -1) {
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
      if (!isHouseDataRowName_(belowName)) {
        templateRow = block.headerRow;
        templateIsHeader = true;
      }
    } else {
      templateRow = block.headerRow;
      templateIsHeader = true;
    }
  } else {
    sheet.insertRowAfter(lastHouseRow);
    newRow = lastHouseRow + 1;
    templateRow = lastHouseRow;
  }

  if (templateIsHeader) {
    // Empty-block first house: do NOT inherit the header's styling. Stamp the
    // canonical Golden Workbook body-row look — white background, normal
    // weight, black text, canonical body font size 14 (Financial Ledger
    // parity — the freshly inserted row can otherwise inherit the size-16
    // header row above it), left-aligned House name, right-aligned currency for
    // the money columns (Loan Amount Left + the 12 month columns). The Active
    // cell is corrected by writeActiveCellWithRowFormat_ below. Cosmetic only —
    // a failure here must not block adding the house.
    try {
      sheet.getRange(newRow, 1, 1, lastCol)
        .setBackground('#ffffff')
        .setFontWeight('normal')
        .setFontColor('#000000')
        .setFontSize(CANON_FONT_BODY_)
        .setVerticalAlignment('bottom');
      const firstMonthCol = block.firstMonthCol || 3;
      const lastMonthCol = firstMonthCol + 11;
      sheet.getRange(newRow, 1).setHorizontalAlignment('left'); // House name
      // Loan Amount Left (col 2) through the last month column are currency.
      const moneyEndCol = Math.min(lastMonthCol, lastCol);
      if (moneyEndCol >= 2) {
        sheet.getRange(newRow, 2, 1, moneyEndCol - 2 + 1)
          .setHorizontalAlignment('right')
          .setNumberFormat('$#,##0.00;-$#,##0.00');
      }
    } catch (_stampErr) {
      Logger.log('insertNewHouseHistoryRow_ data-row stamp: ' + _stampErr);
    }
  } else {
    sheet.getRange(templateRow, 1, 1, lastCol).copyTo(
      sheet.getRange(newRow, 1, 1, lastCol),
      SpreadsheetApp.CopyPasteType.PASTE_FORMAT,
      false
    );
  }
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
  } else {
    // No existing data row to clone from (freshly created sheet, or a
    // header-only body). Stamp the canonical Golden body font AND row height on
    // JUST the row we appended so it never lands at the Apps Script defaults
    // (10pt / ~21px). Additive and narrowly scoped: touches only the new row,
    // never any existing row's formatting, width, or height. Mirrors
    // appendAssetsRowForNewInvestment_.
    try {
      sheet.getRange(appendedRow, 1, 1, lastCol).setFontSize(CANON_FONT_BODY_);
      sheet.setRowHeight(appendedRow, 26);
    } catch (bodyStampErr) {
      Logger.log('appendHouseAssetsRowForNewHouse_ body stamp failed: ' + bodyStampErr);
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

  // NOTE: intentionally NO applyHouseAssetsSheetStyling_ reassert here.
  // Per ENGINEERING_STANDARDS.md §9 (Styling Reassertion Rule) and §10
  // (Runtime Helpers Must Not Style), runtime writes must not re-apply
  // cosmetic formatting. Appending a body row cannot disturb the header
  // band or the frozen panes (both are established at first-create in
  // ensureSysHouseAssetsSheet_ and persist across row inserts), so there is
  // nothing correctness-related to reassert. Header/freeze styling for a
  // fresh sheet lives in first-create; existing populated sheets are left
  // exactly as the user has them.
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
 * FIRST-CREATE / REPAIR ONLY. Per ENGINEERING_STANDARDS.md §9/§10 this is
 * NOT called on normal writes (appendHouseAssetsRowForNewHouse_ no longer
 * reasserts it) — appending a body row cannot disturb the header band or
 * frozen panes. Font sizes, column widths, and row heights are applied by
 * the first-create block in ensureSysHouseAssetsSheet_, not here.
 *
 * Assertions:
 *   - Header row (row 1) → yellow #ffe599, bold black, centered
 *     horizontal / middle vertical.
 *   - Solid-medium black bottom border under row 1.
 *   - Frozen row 1 + frozen column 1 so House stays pinned when
 *     scrolling.
 *
 * Header row height is intentionally NOT set here (Styling Reassertion
 * Rule) — the first-create 44px survives. Data rows, number formats, and
 * any user cell highlights (including the red-text conditional formatting
 * on Loan Amount Left) are deliberately never touched. Failures are
 * swallowed — cosmetic only.
 */
function applyHouseAssetsSheetStyling_(sheet) {
  if (!sheet) return;
  let lastCol = 1;
  try { lastCol = Math.max(1, sheet.getLastColumn()); } catch (_) { return; }

  // Runtime = COLOR only (ENGINEERING_STANDARDS §9/§10). Header alignment,
  // vertical alignment, row height, and the thin black bottom border are
  // canonical GEOMETRY set at first-create in ensureSysHouseAssetsSheet_ —
  // never reasserted here so populated workbooks are never reshaped.
  try {
    sheet.getRange(1, 1, 1, lastCol)
      .setBackground(CANON_HEADER_YELLOW_)
      .setFontWeight('bold')
      .setFontColor('#000000');
  } catch (_headerErr) { /* cosmetic */ }

  // Freeze panes are asserted here because the app relies on the pinned header
  // row / first column for correctness.
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

  // Defense-in-depth: addHouseFromDashboard holds a document lock so the
  // existence check above and this insert are effectively atomic. Should a
  // concurrent path ever create this exact sheet in between, treat the
  // existing sheet as the idempotent result instead of surfacing the native
  // "A sheet with the name '...' already exists" error to the user.
  let newSheet;
  try {
    newSheet = ss.insertSheet(sheetName);
  } catch (insertErr) {
    const raced = ss.getSheetByName(sheetName);
    if (raced) return { sheet: raced, created: false, templateSheetName: '' };
    throw insertErr;
  }
  const currentYear = getCurrentYear_();
  const canonicalHeaders = [
    'Item', 'Type', 'Date', 'Location', 'Cost',
    'Service Fees Paid', 'Insurance covered', 'Payments Links', 'Notes'
  ];

  newSheet.getRange(1, 1, 1, 2).setValues([['Year', currentYear]]);
  newSheet.getRange(2, 1, 1, 9).setValues([canonicalHeaders]);

  // Apply canonical Golden Workbook (Financial Ledger family) styling DIRECTLY
  // to the freshly created sheet. Deterministic — every new HOUSES tab is fully
  // readable immediately (fonts, widths, row heights, currency/date formats,
  // freeze panes), independent of any earlier (possibly unpolished) HOUSES
  // sheet. This intentionally supersedes the old clone-from-template path,
  // which propagated the rough first-create fallback look to later houses.
  // Existing populated HOUSES sheets are never touched (first-create only).
  applyHousesExpenseSheetStyling_(newSheet);
  newSheet.getRange(1, 1).activate();

  return {
    sheet: newSheet,
    created: true,
    templateSheetName: ''
  };
}

/**
 * First-create canonical (Golden Workbook, Financial Ledger family) styling for
 * a HOUSES - <Property> expense sheet. Applied to the freshly created sheet
 * ONLY — never to existing/populated HOUSES sheets. See ENGINEERING_STANDARDS.md
 * → Canonical Row Styling / Width / Readability.
 *
 * Layout: row 1 = Year banner, row 2 = 9-column header, rows 3+ = expense body.
 * Columns: Item | Type | Date | Location | Cost | Service Fees Paid |
 *          Insurance covered | Payments Links | Notes
 *
 * All calls are wrapped best-effort: cosmetic styling must never fail the
 * caller's create transaction.
 */
function applyHousesExpenseSheetStyling_(sheet) {
  const NUM_COLS = 9;
  const maxRows = sheet.getMaxRows();

  // Body baseline font across the whole sheet; banner rows overridden below.
  try { sheet.getRange(1, 1, maxRows, NUM_COLS).setFontSize(CANON_FONT_BODY_); } catch (_f) { /* cosmetic */ }

  // Row 1 — Year banner: canonical Financial Ledger orange, bold black, 24pt.
  try {
    sheet.getRange(1, 1, 1, NUM_COLS)
      .setBackground('#f4a300')
      .setFontWeight('bold')
      .setFontColor('#000000')
      .setFontSize(CANON_FONT_YEAR_BANNER_)
      .setVerticalAlignment(CANON_VERTICAL_ALIGNMENT_);
    sheet.setRowHeight(1, CANON_ROW_HEIGHT_YEAR_);
  } catch (_y) { /* cosmetic */ }

  // Row 2 — column header: canonical yellow, bold black, 20pt, centered,
  // thin black bottom border. Wrap off so labels never wrap; widths below
  // prevent clipping.
  try {
    sheet.getRange(2, 1, 1, NUM_COLS)
      .setBackground(CANON_HEADER_YELLOW_)
      .setFontWeight('bold')
      .setFontColor('#000000')
      .setFontSize(CANON_FONT_HEADER_)
      .setHorizontalAlignment('center')
      .setVerticalAlignment(CANON_VERTICAL_ALIGNMENT_)
      .setWrap(false)
      .setBorder(false, false, true, false, false, false, '#000000', SpreadsheetApp.BorderStyle.SOLID);
    sheet.setRowHeight(2, CANON_ROW_HEIGHT_HEADER_);
  } catch (_h) { /* cosmetic */ }

  // Rows 3+ — body: 14pt normal weight, white, readable height.
  try {
    if (maxRows > 2) {
      sheet.getRange(3, 1, maxRows - 2, NUM_COLS)
        .setFontWeight('normal')
        .setFontColor('#000000')
        .setBackground('#ffffff')
        .setVerticalAlignment(CANON_VERTICAL_ALIGNMENT_);
      sheet.setRowHeights(3, maxRows - 2, CANON_ROW_HEIGHT_BODY_);
    }
  } catch (_b) { /* cosmetic */ }

  // Number formats on the body so future entries inherit them. Date = col 3;
  // currency = Cost (5) / Service Fees Paid (6) / Insurance covered (7). Number
  // formats on text cells are harmless.
  try {
    const bodyRows = Math.max(maxRows - 2, 1);
    sheet.getRange(3, 3, bodyRows, 1).setNumberFormat('M/d/yyyy');
    sheet.getRange(3, 5, bodyRows, 1).setNumberFormat('$#,##0.00;-$#,##0.00');
    sheet.getRange(3, 6, bodyRows, 1).setNumberFormat('$#,##0.00;-$#,##0.00');
    sheet.getRange(3, 7, bodyRows, 1).setNumberFormat('$#,##0.00;-$#,##0.00');
  } catch (_n) { /* cosmetic */ }

  // Canonical column widths — readable, no clipped bold-16pt headers.
  // (Prior default ~100px clipped "Service Fees Paid" / "Insurance covered" /
  // "Payments Links" / "Notes".)
  const widths = [
    160, // Item
    130, // Type
    120, // Date
    180, // Location
    130, // Cost
    210, // Service Fees Paid  (bold 16pt header needs more room)
    220, // Insurance covered  (bold 16pt header needs more room)
    190, // Payments Links     (bold 16pt header needs more room)
    240  // Notes
  ];
  for (let c = 0; c < widths.length; c++) {
    try { sheet.setColumnWidth(c + 1, widths[c]); } catch (_w) { /* cosmetic */ }
  }

  // Freeze the Year + header rows and the Item column so context stays visible
  // while scrolling the expense log.
  try { sheet.setFrozenRows(2); } catch (_fr) { /* cosmetic */ }
  try { sheet.setFrozenColumns(1); } catch (_fc) { /* cosmetic */ }
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
 *   - "House | Loan…"   → yellow  #ffe599, bold black, centered, row height 32
 *   - "Total Values"    → green   #b6d7a8, bold black  (Aggregate/Total role)
 *   - "House Assets"    → pink    #f4cccc, bold black  (secondary summary role)
 *
 * Footer color roles follow the Financial Ledger family standard
 * (ENGINEERING_STANDARDS.md → Canonical Row Styling): the Aggregate/Total row
 * is GREEN and the secondary summary row is PINK — matching Investments
 * (Account Totals = green, Delta = pink). "Total Values" is the per-month SUM
 * aggregate → green; "House Assets" is the secondary summary → pink. (Prior
 * builds had these two swapped.)
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
  // RUNTIME styler — delegates to the shared Financial Ledger walker in
  // color+freeze-only mode (ENGINEERING_STANDARDS §9/§10). Canonical geometry
  // (year/header fonts, heights, alignment, border) is set at first-create in
  // ensureInputHouseValuesSheet_ and is NEVER reasserted here, so populated
  // workbooks are never reshaped on routine adds. Marker set:
  //   Year → orange · "House" (only when col B = "Loan Amount Left") → yellow ·
  //   "Total Values" (aggregate) → green · "House Assets" (secondary summary) →
  //   pink. Freeze House + Loan Amount Left columns.
  applyFinancialLedgerBaseStyle_(sheet, {
    mode: 'runtime',
    headerMarkerLabel: 'House',
    headerRequireColB: 'Loan Amount Left',
    totalMarkerLabel: 'Total Values',
    deltaMarkerLabel: 'House Assets',
    freezeColumns: 2
  });
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
  // Serialize house creation per user so concurrent or double submits can never
  // race the check-then-write in addHouseFromDashboardLocked_ below. Without
  // this, two overlapping creates could either (a) both pass
  // validateNewHouseName_ before either committed and write DUPLICATE INPUT/SYS
  // rows, or (b) collide on ss.insertSheet() and surface the scary "Could not
  // create HOUSES - X sheet (rolled back other writes): ... already exists"
  // rollback error.
  //
  // Uses getUserLock() — NOT getDocumentLock(). getDocumentLock() returns null
  // in the Central web-app context (standalone script with no bound document),
  // which made lock.waitLock() throw immediately and surface the contention
  // message on EVERY normal single create. getUserLock() is valid in both bound
  // (sidebar) and Central (web app) modes and serializes per accessing user —
  // exactly the scope we need (a single user must not run two overlapping
  // creates; different users operate on different workbooks and never contend).
  // Mirrors central_provisioning.js / dashboard_data.js autopay.
  var lock = null;
  try { lock = LockService.getUserLock(); } catch (_lockGetErr) { lock = null; }

  var acquired = false;
  if (lock) {
    try { acquired = lock.tryLock(20000); } catch (_lockErr) { acquired = false; }
    if (!acquired) {
      throw new Error('Another change is in progress. Please try again in a moment.');
    }
  }
  // If no lock is available (no user context — e.g. a trigger), proceed WITHOUT
  // serialization rather than failing the create: validateNewHouseName_ (pre-
  // mutation) and the idempotent HOUSES-sheet create still guard the common
  // cases, and blocking a normal create would be worse UX.

  try {
    return addHouseFromDashboardLocked_(payload);
  } finally {
    if (acquired) {
      // Commit pending writes before releasing so the NEXT queued create sees
      // this house in validateNewHouseName_ (read-your-write across the lock).
      try { SpreadsheetApp.flush(); } catch (_flushErr) { /* best-effort */ }
      try { lock.releaseLock(); } catch (_relErr) { /* best-effort */ }
    }
  }
}

/**
 * Locked body of addHouseFromDashboard. Must only be called while the
 * document lock is held (see addHouseFromDashboard). Kept as a private helper
 * so the create sequence keeps its original indentation while the public entry
 * point owns the serialization / flush / release lifecycle.
 */
function addHouseFromDashboardLocked_(payload) {
  validateRequired_(payload, ['houseName', 'propertyType', 'currentValue', 'loanAmountLeft']);

  // Ensure-before-write guards. Both helpers are idempotent no-ops on
  // populated workbooks. On a fresh workbook they write the canonical
  // structure that getHouseValuesYearBlock_ / getHouseAssetsHeaderMap_
  // expect further down. They MUST also run before
  // validateNewHouseName_ below, because that validator calls
  // getHouseAssetsHistorical_ / getSheet_ on HOUSE_VALUES /
  // HOUSE_ASSETS, both of which throw "Missing sheet: ..." on a blank
  // workbook before these ensure calls would otherwise run. Mirrors
  // the ensure-before-validate pattern in
  // addBankAccountFromDashboard → bank_accounts.js.
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

  // Resolve the user-entered valuation date (preserved for the activity log).
  //   - If the user supplied a date, validate it is a real date and keep it
  //     verbatim — HISTORICAL dates are allowed (buying a house years ago and
  //     recording it in the current workbook is a normal scenario).
  //   - If the user left the field blank, default to today so month extraction
  //     in updateHouseValuesHistory_ / Utilities.formatDate is stable
  //     regardless of script timezone drift.
  //
  // `valuationDateWasProvided` preserves whether the UI supplied a date so the
  // activity log can still record the raw user intent (details.valuationDate).
  let valuationDate = null;
  const valuationDateStr = String(payload.valuationDate || '').trim();
  const valuationDateWasProvided = !!valuationDateStr;
  if (valuationDateWasProvided) {
    valuationDate = parseIsoDateLocal_(valuationDateStr);
    if (isNaN(valuationDate.getTime())) throw new Error('Invalid valuation date.');
  } else {
    valuationDate = stripTime_(new Date());
  }

  // Resolve the month-seed date used ONLY to choose which month column of the
  // current-year block receives the Current Value. The house is ALWAYS created
  // in the current-year block; an out-of-year entered date (e.g. 02/10/2018)
  // seeds a safe month in the current block instead of throwing. Shared with
  // updateHouseValueByDate via resolveHouseValuesSeedDate_ so Add and Update
  // behave identically. The user's raw entered date is preserved in the
  // activity log below (details.valuationDate).
  const seedDate = resolveHouseValuesSeedDate_(valuationDate, currentYear);

  const ss = getUserSpreadsheet_();
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
      updateHouseValuesHistory_(houseName, currentYear, seedDate, currentValue);
      seededMonthLabel = Utilities.formatDate(seedDate, tz, 'MMM-yy');
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
      // entryDate reflects the in-block month the value was seeded into (today
      // when the entered date is historical/out-of-year). The raw user-entered
      // date is preserved verbatim below in details.valuationDate.
      entryDate: Utilities.formatDate(stripTime_(seedDate || new Date()), tz, 'yyyy-MM-dd'),
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

  const ss = getUserSpreadsheet_();
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
