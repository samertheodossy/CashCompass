/**
 * CashCompass Validator — formatting parity comparison (READ-ONLY).
 *
 * Diffs two formatting snapshots (produced by validator_snapshot.js) and
 * groups the differences by design family. Pure computation over already-read
 * snapshot objects — performs no I/O and no workbook access itself.
 *
 * Every helper is internal (trailing underscore); the only public entry point
 * to the Validator is validateGoldenParityReport() in validator_core.js.
 *
 * Borders are not comparable (no Apps Script read API) — verify visually.
 */

/** Fixed family order for the report. */
var VALIDATOR_FAMILY_ORDER_ = ['Financial Ledger', 'Operational', 'SYS', 'Planner', 'Special'];

/** Style properties compared per key row (as the set of distinct row values). */
var VALIDATOR_STYLE_PROPS_ = [
  'background', 'fontFamily', 'fontSize', 'fontWeight',
  'fontColor', 'hAlign', 'vAlign', 'numberFormat'
];

/**
 * Sheets that are intentionally Central-only system sheets — their presence in
 * Central but not the Golden Workbook is EXPECTED, not a convergence gap. These
 * differences are classified 'central_only_expected' (ignored). See
 * WORKBOOK_PARITY_CHECKLIST.md → "Excluded from parity".
 */
function validatorIsIntentionalCentralOnlySheet_(name) {
  if (name === 'SYS - Meta') return true;      // hidden system marker
  if (name.indexOf('SYS - Import') === 0) return true; // bank-import staging/ignored
  if (name === 'HOME') return true;            // admin/menu tool
  return false;
}

/**
 * Golden-convergence priority: only sheets present in BOTH workbooks are worth
 * converging first. This is the focused set surfaced under
 * report.convergencePriority.
 */
var VALIDATOR_CONVERGENCE_PRIORITY_SHEETS_ = [
  'INPUT - Bank Accounts',
  'INPUT - Cash Flow 2026',
  'INPUT - Upcoming Expenses',
  'SYS - Accounts',
  'LOG - Activity',
  'INPUT - Settings'
];

/**
 * Classifies a single diff entry into one of:
 *   - 'missing_in_central'       sheet in Golden but not Central (module not
 *                                provisioned/used yet)
 *   - 'central_only'             sheet in Central but not Golden (unexpected)
 *   - 'central_only_expected'    Central-only intentional system sheet (ignored)
 *   - 'structural'               present-in-both structural/schema mismatch
 *                                (sheet/row presence, frozen panes, hidden
 *                                rows/cols, merged ranges)
 *   - 'formatting'               present-in-both true formatting mismatch
 *                                (colors, fonts, alignment, number format,
 *                                column widths, row heights)
 */
function validatorDiffCategory_(d) {
  if (d.property === 'presence') {
    if (d.golden === 'present' && d.central === 'MISSING') return 'missing_in_central';
    return validatorIsIntentionalCentralOnlySheet_(d.sheet) ? 'central_only_expected' : 'central_only';
  }
  if (d.property === 'row presence') return 'structural';
  if (d.rowType === 'sheet' &&
      (d.property === 'frozenRows' || d.property === 'frozenColumns' ||
       d.property === 'hiddenColumns' || d.property === 'hiddenRows' ||
       d.property === 'mergedRanges')) {
    return 'structural';
  }
  return 'formatting';
}

/** Recommendation vocabulary + fixed print order. */
var VALIDATOR_RECO_ORDER_ = ['AdoptGolden', 'KeepCentral', 'ProductDecision', 'IgnoreNoise', 'NeedsReview'];

/* ---------- recommendation engine ---------- */

/**
 * Assigns exactly one recommendation to a diff, encoding the engineering rules
 * established during Golden-Workbook convergence analysis:
 *
 *   AdoptGolden     — Central is objectively worse and should match Golden.
 *                     Mainly: Golden column is WIDER (Central near defaults /
 *                     autoResized-on-empty), or a Header/SysHeader that Central
 *                     left unstyled (white) while Golden has a real fill.
 *   KeepCentral     — Golden reflects an untouched Sheets default; Central's
 *                     value is the ratified canonical standard. Row heights,
 *                     vertical-middle, frozen panes, bold/centered headers,
 *                     negative-aware currency formats, columns already ≥ Golden.
 *   ProductDecision — a deliberate design call with no single right answer:
 *                     palette hexes (background), single-value font colors, and
 *                     font SIZE (Golden is bigger on ledgers but smaller on SYS).
 *   IgnoreNoise     — non-actionable: mature-vs-fresh row presence, expected
 *                     totals / year banners, blank-cell default number formats,
 *                     Arial↔Calibri default font-family drift, and body-row
 *                     alignment/weight aggregation noise.
 *   NeedsReview     — anything the rules don't confidently cover (unexpected
 *                     Central-only sheet, hidden rows/cols, merges, missing
 *                     header, non-numeric geometry).
 */
function validatorRecommendation_(d) {
  var cat = d.category;
  var prop = d.property;
  var rt = d.rowType;

  // Sheet presence.
  if (prop === 'presence') {
    if (cat === 'missing_in_central' || cat === 'central_only_expected') return 'IgnoreNoise';
    return 'NeedsReview'; // unexpected Central-only sheet
  }

  // Structural.
  if (prop === 'row presence') {
    // Header/SysHeader missing on one side is a genuine schema problem.
    if (rt === 'Header' || rt === 'SysHeader') return 'NeedsReview';
    // Totals, delta, year banners, first/body, blank = mature-vs-fresh content.
    return 'IgnoreNoise';
  }
  if (prop === 'frozenRows' || prop === 'frozenColumns') {
    var gz = validatorNum_(d.golden), cz = validatorNum_(d.central);
    if (gz !== null && cz !== null && cz >= gz) return 'KeepCentral'; // Central froze, Golden didn't
    return 'NeedsReview';
  }
  if (prop === 'hiddenColumns' || prop === 'hiddenRows' || prop === 'mergedRanges') return 'NeedsReview';

  // Column width (positional 'col N' OR header-addressed 'width[Label]').
  if (/^col\s/.test(prop) || /^width\[/.test(prop)) {
    var gw = validatorNum_(d.golden), cw = validatorNum_(d.central);
    if (gw === null || cw === null) return 'NeedsReview';
    return gw > cw ? 'AdoptGolden' : 'KeepCentral';
  }

  // Row height — Golden is the 21px Sheets default; Central geometry is canonical.
  if (/^rowHeight\[/.test(prop)) return 'KeepCentral';

  // Per-cell style properties.
  switch (prop) {
    case 'fontFamily':
      return 'IgnoreNoise'; // Arial ↔ Calibri default drift
    case 'vAlign':
      return 'KeepCentral'; // middle (canonical) vs bottom (default)
    case 'numberFormat':
      return (validatorIsDefaultishNumberFormat_(d.golden) || validatorIsDefaultishNumberFormat_(d.central))
        ? 'IgnoreNoise'
        : 'KeepCentral'; // Central's negative-aware currency format is preferred
    case 'fontWeight':
      return (rt === 'Header' || rt === 'SysHeader') ? 'KeepCentral' : 'IgnoreNoise';
    case 'hAlign':
      return (rt === 'Header' || rt === 'SysHeader') ? 'KeepCentral' : 'IgnoreNoise';
    case 'fontColor':
      // Golden aggregating multiple colors across a row is drift; a single
      // clean color difference is a real palette call.
      return (String(d.golden).indexOf('|') !== -1) ? 'IgnoreNoise' : 'ProductDecision';
    case 'background':
      if ((rt === 'Header' || rt === 'SysHeader') &&
          validatorIsBlankWhite_(d.central) && !validatorIsBlankWhite_(d.golden)) {
        return 'AdoptGolden'; // Central header left unstyled (e.g. INPUT - Settings)
      }
      return 'ProductDecision'; // palette hex choice
    case 'fontSize':
      return 'ProductDecision'; // per-family call; sequence after widths
    default:
      return 'NeedsReview';
  }
}

/** Parse a leading number from a scalar diff value; null when not numeric. */
function validatorNum_(v) {
  if (v === undefined || v === null || v === '') return null;
  var n = parseFloat(String(v));
  return isFinite(n) ? n : null;
}

/**
 * True when a numberFormat aggregate consists ONLY of default/general/text/blank
 * tokens ('', 'general', '@', or the automatic '0.###############'). Such diffs
 * are comparing empty/seed cells, not real currency/date formatting.
 */
function validatorIsDefaultishNumberFormat_(s) {
  var str = String(s == null ? '' : s);
  var tokens = str.split('|');
  for (var i = 0; i < tokens.length; i++) {
    var t = tokens[i].trim().toLowerCase();
    if (t === '' || t === 'general' || t === '@' || t === '0.###############') continue;
    return false; // a real format is present
  }
  return true;
}

/** True when a background aggregate is only blank/white ('', '#ffffff'). */
function validatorIsBlankWhite_(s) {
  var str = String(s == null ? '' : s);
  var tokens = str.split('|');
  for (var i = 0; i < tokens.length; i++) {
    var t = tokens[i].trim().toLowerCase();
    if (t === '' || t === '#ffffff') continue;
    return false;
  }
  return true;
}

/**
 * Diff two snapshot objects. Returns { meta, summary, groups }.
 * groups is keyed by family; each value is an array of diff entries:
 *   { sheet, family, rowType, property, golden, central, suggestedHelper }
 */
function validatorCompareSnapshots_(golden, central) {
  var groups = {};
  for (var f = 0; f < VALIDATOR_FAMILY_ORDER_.length; f++) groups[VALIDATOR_FAMILY_ORDER_[f]] = [];

  var centralByName = {};
  for (var i = 0; i < central.sheets.length; i++) centralByName[central.sheets[i].name] = central.sheets[i];
  var goldenByName = {};
  for (var j = 0; j < golden.sheets.length; j++) goldenByName[golden.sheets[j].name] = golden.sheets[j];

  var sheetsCompared = [];
  for (var g = 0; g < golden.sheets.length; g++) {
    var gs = golden.sheets[g];
    var family = gs.family || validatorSheetFamily_(gs.name);
    var cs = centralByName[gs.name];
    if (!cs) {
      validatorPushDiff_(groups, family, gs.name, 'sheet', 'presence', 'present', 'MISSING');
      continue;
    }
    sheetsCompared.push(gs.name);
    validatorCompareSheets_(groups, family, gs, cs);
  }
  for (var c = 0; c < central.sheets.length; c++) {
    var csx = central.sheets[c];
    if (!goldenByName[csx.name]) {
      var famx = csx.family || validatorSheetFamily_(csx.name);
      validatorPushDiff_(groups, famx, csx.name, 'sheet', 'presence', 'MISSING', 'present');
    }
  }

  var report = {
    meta: {
      generatedAt: new Date().toISOString(),
      golden: { id: golden.spreadsheetId, name: golden.spreadsheetName },
      central: { id: central.spreadsheetId, name: central.spreadsheetName },
      redacted: !!golden.redacted,
      bordersNote: 'Borders not compared (no Apps Script read API) — verify visually.'
    },
    summary: null,          // filled by validatorClassifyReport_
    classification: null,   // filled by validatorClassifyReport_
    convergencePriority: null, // filled by validatorClassifyReport_
    groups: groups
  };
  validatorClassifyReport_(report, sheetsCompared);
  return report;
}

/**
 * Post-pass classifier: tags every diff with a `category`, then builds
 * report.summary (counts), report.classification (sheet lists per category),
 * and report.convergencePriority (focused set of sheets present in both).
 * Pure — mutates only the passed report object.
 */
function validatorClassifyReport_(report, sheetsCompared) {
  var groups = report.groups;
  var presentInBoth = {};
  for (var i = 0; i < sheetsCompared.length; i++) presentInBoth[sheetsCompared[i]] = true;

  var counts = {
    totalDiffs: 0,
    presentInBothFormattingDiffs: 0,
    presentInBothStructuralDiffs: 0,
    missingInCentralSheets: 0,
    centralOnlySheets: 0,
    ignoredExpectedDiffs: 0,
    byFamily: {}
  };
  var missingInCentral = {}, centralOnly = {}, centralOnlyExpected = {},
      formattingSheets = {}, structuralSheets = {};

  // Recommendation tallies (global) + per-family summary scaffold.
  var recoSummary = validatorNewRecoCounts_();
  var familySummary = {};
  for (var fi = 0; fi < VALIDATOR_FAMILY_ORDER_.length; fi++) {
    familySummary[VALIDATOR_FAMILY_ORDER_[fi]] = {
      formatting: 0, structural: 0, presence: 0,
      recommendations: validatorNewRecoCounts_(),
      helpers: {}
    };
  }

  for (var f = 0; f < VALIDATOR_FAMILY_ORDER_.length; f++) {
    var fam = VALIDATOR_FAMILY_ORDER_[f];
    var diffs = groups[fam] || [];
    counts.byFamily[fam] = diffs.length;
    var famStats = familySummary[fam];
    for (var d = 0; d < diffs.length; d++) {
      var diff = diffs[d];
      var cat = validatorDiffCategory_(diff);
      diff.category = cat;
      var reco = validatorRecommendation_(diff);
      diff.recommendation = reco;
      counts.totalDiffs++;
      recoSummary[reco]++;

      // Per-family: formatting vs structural vs presence + reco + owners.
      if (diff.property === 'presence') famStats.presence++;
      else if (cat === 'structural') famStats.structural++;
      else if (cat === 'formatting') famStats.formatting++;
      famStats.recommendations[reco]++;
      if (diff.suggestedHelper) famStats.helpers[diff.suggestedHelper] = true;

      if (cat === 'missing_in_central') {
        missingInCentral[diff.sheet] = true;
      } else if (cat === 'central_only') {
        centralOnly[diff.sheet] = true;
      } else if (cat === 'central_only_expected') {
        centralOnlyExpected[diff.sheet] = true;
        counts.ignoredExpectedDiffs++;
      } else if (cat === 'formatting') {
        counts.presentInBothFormattingDiffs++;
        formattingSheets[diff.sheet] = true;
      } else if (cat === 'structural') {
        counts.presentInBothStructuralDiffs++;
        structuralSheets[diff.sheet] = true;
      }
    }
  }

  // Freeze helper sets into sorted arrays for the report.
  for (var fk in familySummary) {
    if (!Object.prototype.hasOwnProperty.call(familySummary, fk)) continue;
    familySummary[fk].helpers = Object.keys(familySummary[fk].helpers).sort();
  }
  report.recommendationSummary = recoSummary;
  report.familySummary = familySummary;

  report.classification = {
    missingInCentral: Object.keys(missingInCentral).sort(),
    centralOnly: Object.keys(centralOnly).sort(),
    centralOnlyExpected: Object.keys(centralOnlyExpected).sort(),
    formattingMismatchSheets: Object.keys(formattingSheets).sort(),
    structuralMismatchSheets: Object.keys(structuralSheets).sort()
  };
  counts.missingInCentralSheets = report.classification.missingInCentral.length;
  counts.centralOnlySheets = report.classification.centralOnly.length;
  report.summary = counts;

  report.convergencePriority = [];
  for (var p = 0; p < VALIDATOR_CONVERGENCE_PRIORITY_SHEETS_.length; p++) {
    var name = VALIDATOR_CONVERGENCE_PRIORITY_SHEETS_[p];
    var picked = [], fmt = 0, str = 0;
    for (var ff = 0; ff < VALIDATOR_FAMILY_ORDER_.length; ff++) {
      var arr = groups[VALIDATOR_FAMILY_ORDER_[ff]] || [];
      for (var k = 0; k < arr.length; k++) {
        if (arr[k].sheet !== name) continue;
        if (arr[k].category === 'formatting') { fmt++; picked.push(arr[k]); }
        else if (arr[k].category === 'structural') { str++; picked.push(arr[k]); }
      }
    }
    report.convergencePriority.push({
      sheet: name,
      presentInBoth: !!presentInBoth[name],
      formattingCount: fmt,
      structuralCount: str,
      diffs: picked
    });
  }
}

/** Compare a single matched sheet (geometry + key rows). */
function validatorCompareSheets_(groups, family, gs, cs) {
  var name = gs.name;

  validatorCmpScalar_(groups, family, name, 'sheet', 'frozenRows', gs.frozenRows, cs.frozenRows);
  validatorCmpScalar_(groups, family, name, 'sheet', 'frozenColumns', gs.frozenColumns, cs.frozenColumns);
  validatorCmpScalar_(groups, family, name, 'sheet', 'hiddenColumns', (gs.hiddenColumns || []).join(','), (cs.hiddenColumns || []).join(','));
  validatorCmpScalar_(groups, family, name, 'sheet', 'hiddenRows', (gs.hiddenRows || []).join(','), (cs.hiddenRows || []).join(','));
  validatorCmpScalar_(groups, family, name, 'sheet', 'mergedRanges', (gs.mergedRanges || []).slice().sort().join(' '), (cs.mergedRanges || []).slice().sort().join(' '));

  // Column widths — prefer matching by HEADER NAME so schema drift (reordered /
  // inserted columns, e.g. INPUT - Upcoming Expenses) doesn't produce dozens of
  // false positional diffs. Falls back to positional when either side lacks
  // captured header labels.
  var gHdr = gs.headerLabels || {};
  var cHdr = cs.headerLabels || {};
  if (Object.keys(gHdr).length && Object.keys(cHdr).length) {
    var cColByLabel = validatorLabelToCol_(cHdr);
    var gCols = Object.keys(gHdr).map(Number).sort(function(a, b) { return a - b; });
    for (var gi = 0; gi < gCols.length; gi++) {
      var gcol = gCols[gi];
      var label = gHdr[gcol];
      var ccol = cColByLabel[String(label).trim().toLowerCase()];
      if (!ccol) continue; // header only in Golden → schema diff, not a width gap
      validatorCmpScalar_(groups, family, name, 'columnWidth', 'width[' + label + ']',
        gs.columnWidths[gcol], cs.columnWidths[ccol]);
    }
  } else {
    var maxCol = Math.min(gs.scannedColumns || 0, cs.scannedColumns || 0);
    for (var col = 1; col <= maxCol; col++) {
      validatorCmpScalar_(groups, family, name, 'columnWidth', 'col ' + col, gs.columnWidths[col], cs.columnWidths[col]);
    }
  }

  var rowTypeByNum = {};
  for (var rr = 0; rr < (gs.rows || []).length; rr++) rowTypeByNum[gs.rows[rr].r] = gs.rows[rr].type;
  var maxRow = Math.min(gs.scannedRows || 0, cs.scannedRows || 0);
  for (var row = 1; row <= maxRow; row++) {
    validatorCmpScalar_(groups, family, name, rowTypeByNum[row] || 'row', 'rowHeight[row ' + row + ']', gs.rowHeights[row], cs.rowHeights[row]);
  }

  validatorCompareKeyRows_(groups, family, name, gs.keyRows || [], cs.keyRows || []);
}

/** Compare key rows of one sheet, matched by row type + occurrence index. */
function validatorCompareKeyRows_(groups, family, name, gKey, cKey) {
  var gByType = validatorGroupBy_(gKey, 'type');
  var cByType = validatorGroupBy_(cKey, 'type');

  for (var type in gByType) {
    if (!gByType.hasOwnProperty(type)) continue;
    var gArr = gByType[type];
    var cArr = cByType[type] || [];
    for (var idx = 0; idx < gArr.length; idx++) {
      var gRow = gArr[idx];
      var cRow = cArr[idx];
      if (!cRow) {
        validatorPushDiff_(groups, family, name, type, 'row presence', 'present (row ' + gRow.r + ')', 'MISSING');
        continue;
      }
      for (var p = 0; p < VALIDATOR_STYLE_PROPS_.length; p++) {
        var prop = VALIDATOR_STYLE_PROPS_[p];
        var gSet = validatorUniqueSorted_(gRow.cells, prop);
        var cSet = validatorUniqueSorted_(cRow.cells, prop);
        if (gSet !== cSet) validatorPushDiff_(groups, family, name, type, prop, gSet, cSet);
      }
    }
  }
  for (var ctype in cByType) {
    if (!cByType.hasOwnProperty(ctype)) continue;
    if (!gByType[ctype]) {
      validatorPushDiff_(groups, family, name, ctype, 'row presence', 'MISSING', 'present');
    }
  }
}

/* ---------- small utilities ---------- */

function validatorCmpScalar_(groups, family, sheet, rowType, prop, gVal, cVal) {
  var g = (gVal === undefined || gVal === null) ? '' : String(gVal);
  var c = (cVal === undefined || cVal === null) ? '' : String(cVal);
  if (g !== c) validatorPushDiff_(groups, family, sheet, rowType, prop, g, c);
}

function validatorPushDiff_(groups, family, sheet, rowType, prop, gVal, cVal) {
  if (!groups[family]) groups[family] = [];
  groups[family].push({
    sheet: sheet,
    family: family,
    rowType: rowType,
    property: prop,
    golden: gVal,
    central: cVal,
    suggestedHelper: validatorSuggestedHelper_(sheet)
  });
}

/** Fresh zeroed recommendation counter, keyed by VALIDATOR_RECO_ORDER_. */
function validatorNewRecoCounts_() {
  var o = {};
  for (var i = 0; i < VALIDATOR_RECO_ORDER_.length; i++) o[VALIDATOR_RECO_ORDER_[i]] = 0;
  return o;
}

/** Build a case-insensitive header-label → 1-based column map (first wins). */
function validatorLabelToCol_(headerLabels) {
  var out = {};
  for (var col in headerLabels) {
    if (!Object.prototype.hasOwnProperty.call(headerLabels, col)) continue;
    var key = String(headerLabels[col]).trim().toLowerCase();
    if (key && !Object.prototype.hasOwnProperty.call(out, key)) out[key] = Number(col);
  }
  return out;
}

function validatorGroupBy_(arr, key) {
  var out = {};
  for (var i = 0; i < arr.length; i++) {
    var k = arr[i][key];
    if (!out[k]) out[k] = [];
    out[k].push(arr[i]);
  }
  return out;
}

function validatorUniqueSorted_(cells, prop) {
  var seen = {};
  var list = [];
  for (var i = 0; i < cells.length; i++) {
    var v = cells[i][prop];
    var s = (v === undefined || v === null) ? '' : String(v);
    if (!seen[s]) { seen[s] = true; list.push(s); }
  }
  list.sort();
  return list.join(' | ');
}
