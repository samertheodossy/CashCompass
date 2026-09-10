/**
 * sys_sheet_runtime_snapshot.js — read-only bounded-workbook SYS sheet audit.
 *
 * Reports existence, dimensions, headers, safe metadata, and inventory
 * classifications for every sheet whose name begins with "SYS -".
 *
 * Safety contract:
 *   - No writes, formatting, renames, deletions, migrations, or repairs.
 *   - No ensure helpers or provisioning side effects — getSheetByName only.
 *   - No raw financial document text, account names, or security descriptions.
 *   - Headers only; body values are scanned in-memory for counts/flags only.
 */

var SYS_SHEET_RUNTIME_SNAPSHOT_VERSION_ = 'SYS_SHEET_RUNTIME_SNAPSHOT_V1';

var SYS_SHEET_RUNTIME_SNAPSHOT_FOCUS_SHEETS_ = [
  'SYS - Investment Holdings',
  'SYS - Investment Holdings Unified',
  'SYS - Investment Activity',
  'SYS - Assets',
  'SYS - Financial Accounts',
  'SYS - Account Source Links'
];

/**
 * Static production-reference index mirrored from sys-sheet-audit-inventory.json.
 * Regression tests keep this aligned with the fixture classifications.
 * @returns {!Object<string, !Object>}
 */
function sysSheetRuntimeSnapshotInventoryIndex_() {
  return {
    'SYS - Accounts': {
      configKey: 'ACCOUNTS', recommendedStatus: 'KEEP_ACTIVE',
      hasProductionReaders: true, hasProductionWriters: true
    },
    'SYS - House Assets': {
      configKey: 'HOUSE_ASSETS', recommendedStatus: 'KEEP_ACTIVE',
      hasProductionReaders: true, hasProductionWriters: true
    },
    'SYS - Assets': {
      configKey: 'ASSETS', recommendedStatus: 'KEEP_ACTIVE',
      hasProductionReaders: true, hasProductionWriters: true
    },
    'SYS - Investment Activity': {
      configKey: 'INVESTMENT_ACTIVITY', recommendedStatus: 'KEEP_ACTIVE',
      hasProductionReaders: true, hasProductionWriters: true
    },
    'SYS - Investment Holdings': {
      configKey: 'INVESTMENT_HOLDINGS', recommendedStatus: 'KEEP_ACTIVE',
      hasProductionReaders: true, hasProductionWriters: true
    },
    'SYS - Investment Holdings Unified': {
      configKey: 'INVESTMENT_HOLDINGS_UNIFIED', recommendedStatus: 'KEEP_ACTIVE',
      hasProductionReaders: true, hasProductionWriters: true
    },
    'SYS - Investment Plans': {
      configKey: 'INVESTMENT_PLANS', recommendedStatus: 'KEEP_ACTIVE',
      hasProductionReaders: true, hasProductionWriters: true
    },
    'SYS - Investment Tax Lots': {
      configKey: 'INVESTMENT_TAX_LOTS', recommendedStatus: 'KEEP_EMPTY_RESERVED',
      hasProductionReaders: false, hasProductionWriters: true
    },
    'SYS - Investment Securities': {
      configKey: 'INVESTMENT_SECURITIES', recommendedStatus: 'KEEP_EMPTY_RESERVED',
      hasProductionReaders: false, hasProductionWriters: true
    },
    'SYS - Financial Accounts': {
      configKey: 'FINANCIAL_ACCOUNTS', recommendedStatus: 'KEEP_ACTIVE',
      hasProductionReaders: true, hasProductionWriters: true
    },
    'SYS - Account Source Links': {
      configKey: 'ACCOUNT_SOURCE_LINKS', recommendedStatus: 'KEEP_ACTIVE',
      hasProductionReaders: true, hasProductionWriters: true
    },
    'SYS - Financial Facts': {
      configKey: 'FINANCIAL_FACTS', recommendedStatus: 'KEEP_ACTIVE',
      hasProductionReaders: true, hasProductionWriters: true
    },
    'SYS - Import Runs': {
      configKey: 'IMPORT_RUNS', recommendedStatus: 'KEEP_ACTIVE',
      hasProductionReaders: true, hasProductionWriters: true
    },
    'SYS - Import Staging \u2014 Bank Accounts': {
      configKey: 'IMPORT_STAGING_BANK', recommendedStatus: 'KEEP_EMPTY_RESERVED',
      hasProductionReaders: true, hasProductionWriters: true
    },
    'SYS - Import Ignored \u2014 Bank Accounts': {
      configKey: 'IMPORT_IGNORED_BANK', recommendedStatus: 'KEEP_EMPTY_RESERVED',
      hasProductionReaders: true, hasProductionWriters: true
    },
    'SYS - Meta': {
      configKey: null, recommendedStatus: 'KEEP_ACTIVE',
      hasProductionReaders: true, hasProductionWriters: true
    }
  };
}

/** @returns {!Array<string>} */
function sysSheetRuntimeSnapshotExpectedSheetNames_() {
  var names = getSheetNames_();
  var out = [];
  Object.keys(names).forEach(function(key) {
    var name = String(names[key] || '');
    if (name.indexOf('SYS -') === 0) out.push(name);
  });
  var metaName = (typeof SYS_META_SHEET_NAME_ === 'string')
    ? SYS_META_SHEET_NAME_ : 'SYS - Meta';
  if (out.indexOf(metaName) === -1) out.push(metaName);
  out.sort();
  return out;
}

/** @returns {!Array<string>} */
function sysSheetRuntimeSnapshotWorkbookSysSheetNames_(ss) {
  var found = [];
  try {
    ss.getSheets().forEach(function(sheet) {
      var name = String(sheet.getName() || '');
      if (name.indexOf('SYS -') === 0) found.push(name);
    });
  } catch (_e) { /* read failure handled per-sheet */ }
  found.sort();
  return found;
}

function sysSheetRuntimeSnapshotNormalizeToken_(value) {
  return String(value || '').trim().toUpperCase();
}

function sysSheetRuntimeSnapshotHeaderIndex_(headers, candidates) {
  headers = headers || [];
  candidates = candidates || [];
  for (var i = 0; i < headers.length; i++) {
    var header = sysSheetRuntimeSnapshotNormalizeToken_(headers[i]);
    for (var j = 0; j < candidates.length; j++) {
      if (header === sysSheetRuntimeSnapshotNormalizeToken_(candidates[j])) return i;
    }
  }
  return -1;
}

function sysSheetRuntimeSnapshotLooksLikeDate_(text) {
  var raw = String(text || '').trim();
  if (!raw) return false;
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return true;
  if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(raw)) return true;
  return false;
}

function sysSheetRuntimeSnapshotFindLastDate_(headers, displayRows) {
  var dateIdx = sysSheetRuntimeSnapshotHeaderIndex_(headers, [
    'As-of date', 'As Of Date', 'Activity Date', 'Imported At', 'Updated At', 'Settle Date'
  ]);
  if (dateIdx < 0) return null;
  var best = '';
  (displayRows || []).forEach(function(row) {
    var token = String((row || [])[dateIdx] || '').trim();
    if (!sysSheetRuntimeSnapshotLooksLikeDate_(token)) return;
    if (!best || token > best) best = token;
  });
  return best || null;
}

function sysSheetRuntimeSnapshotFormatLooksCurrency_(format) {
  var raw = String(format || '').toLowerCase();
  return raw.indexOf('$') >= 0 || raw.indexOf('currency') >= 0 ||
    raw.indexOf('#,##0') >= 0;
}

function sysSheetRuntimeSnapshotFormatLooksDate_(format) {
  var raw = String(format || '').toLowerCase();
  return raw.indexOf('yyyy') >= 0 || raw.indexOf('mm/dd') >= 0 ||
    raw.indexOf('dd/mm') >= 0;
}

/**
 * @returns {boolean}
 */
function sysSheetRuntimeSnapshotSheetHasFormulas_(sheet, lastRow, lastCol) {
  if (!sheet || lastRow < 2 || lastCol < 1) return false;
  try {
    var formulas = sheet.getRange(2, 1, lastRow - 1, lastCol).getFormulas();
    for (var r = 0; r < formulas.length; r++) {
      var row = formulas[r] || [];
      for (var c = 0; c < row.length; c++) {
        var formula = String(row[c] || '').trim();
        if (formula.charAt(0) === '=') return true;
      }
    }
  } catch (_e) { return false; }
  return false;
}

function sysSheetRuntimeSnapshotScanTextMarkers_(text) {
  var token = sysSheetRuntimeSnapshotNormalizeToken_(text);
  return {
    robinhood: token.indexOf('ROBINHOOD') >= 0 || token === 'ROBINHOOD_CSV',
    m1: token === 'M1' || token.indexOf('M1_') === 0 || token.indexOf('M1 ') === 0,
    etrade: token.indexOf('ETRADE') >= 0 || token.indexOf('E*TRADE') >= 0 ||
      token.indexOf('E TRADE') >= 0,
    identity: token.indexOf('STABLEACCOUNT') >= 0 || token.indexOf('IDENTITY') >= 0 ||
      token.indexOf('VERIFIED') >= 0,
    importTag: token.indexOf('IMPORT') >= 0 || token.indexOf('STAGING') >= 0 ||
      token.indexOf('FINGERPRINT') >= 0 || token.indexOf('DIGEST') >= 0
  };
}

function sysSheetRuntimeSnapshotMergeMarkers_(target, next) {
  next = next || {};
  target.robinhood = !!(target.robinhood || next.robinhood);
  target.m1 = !!(target.m1 || next.m1);
  target.etrade = !!(target.etrade || next.etrade);
  target.identity = !!(target.identity || next.identity);
  target.importTag = !!(target.importTag || next.importTag);
}

function sysSheetRuntimeSnapshotClassifyDataMarkers_(sheetName, headers, displayRows, inventoryMeta) {
  var markers = {
    robinhood: false,
    m1: false,
    etrade: false,
    identity: false,
    import: false,
    reserved: false
  };
  var reservedNames = {
    'SYS - Investment Tax Lots': true,
    'SYS - Investment Securities': true,
    'SYS - Import Staging \u2014 Bank Accounts': true,
    'SYS - Import Ignored \u2014 Bank Accounts': true
  };
  if (reservedNames[sheetName]) markers.reserved = true;
  if (sheetName === 'SYS - Financial Accounts' || sheetName === 'SYS - Account Source Links') {
    markers.identity = (displayRows || []).length > 0;
  }
  if (sheetName === 'SYS - Import Runs' ||
      sheetName === 'SYS - Import Staging \u2014 Bank Accounts' ||
      sheetName === 'SYS - Import Ignored \u2014 Bank Accounts') {
    markers.import = (displayRows || []).length > 0;
  }

  var sourceIdx = sysSheetRuntimeSnapshotHeaderIndex_(headers, ['Source']);
  var providerIdx = sysSheetRuntimeSnapshotHeaderIndex_(headers, ['Provider']);
  (displayRows || []).forEach(function(row) {
    if (sourceIdx >= 0) sysSheetRuntimeSnapshotMergeMarkers_(markers,
      sysSheetRuntimeSnapshotScanTextMarkers_(row[sourceIdx]));
    if (providerIdx >= 0) sysSheetRuntimeSnapshotMergeMarkers_(markers,
      sysSheetRuntimeSnapshotScanTextMarkers_(row[providerIdx]));
    if (sheetName === 'SYS - Investment Activity') {
      sysSheetRuntimeSnapshotMergeMarkers_(markers,
        sysSheetRuntimeSnapshotScanTextMarkers_(row[12]));
    }
  });

  markers.import = !!(markers.import || markers.importTag);
  delete markers.importTag;

  if (inventoryMeta && inventoryMeta.recommendedStatus === 'KEEP_EMPTY_RESERVED' &&
      !(displayRows || []).length) {
    markers.reserved = true;
  }
  return markers;
}

function sysSheetRuntimeSnapshotCountDistinctNonEmpty_(displayRows, colIndex) {
  if (colIndex < 0) return 0;
  var seen = {};
  var count = 0;
  (displayRows || []).forEach(function(row) {
    var token = String((row || [])[colIndex] || '').trim();
    if (!token || seen[token]) return;
    seen[token] = true;
    count += 1;
  });
  return count;
}

function sysSheetRuntimeSnapshotFocusMetadata_(sheetName, sheet, headers, displayRows) {
  if (SYS_SHEET_RUNTIME_SNAPSHOT_FOCUS_SHEETS_.indexOf(sheetName) === -1) return null;
  var meta = { focusSheet: true, dataRowCount: (displayRows || []).length };

  if (sheetName === 'SYS - Investment Holdings') {
    meta.distinctInvestmentIdCount = sysSheetRuntimeSnapshotCountDistinctNonEmpty_(displayRows, 0);
    meta.distinctTickerCount = sysSheetRuntimeSnapshotCountDistinctNonEmpty_(displayRows, 3);
  }

  if (sheetName === 'SYS - Investment Activity') {
    var sourceIdx = sysSheetRuntimeSnapshotHeaderIndex_(headers, ['Source']);
    var robinhoodRows = 0;
    (displayRows || []).forEach(function(row) {
      var source = sysSheetRuntimeSnapshotNormalizeToken_(row[sourceIdx]);
      if (source === 'ROBINHOOD_CSV' || source.indexOf('ROBINHOOD') >= 0) robinhoodRows += 1;
    });
    meta.robinhoodRowCount = robinhoodRows;
    meta.distinctTickerCount = sysSheetRuntimeSnapshotCountDistinctNonEmpty_(displayRows,
      sysSheetRuntimeSnapshotHeaderIndex_(headers, ['Ticker']));
  }

  if (sheetName === 'SYS - Investment Holdings Unified') {
    var sourceCounts = { M1: 0, ETRADE: 0, ROBINHOOD: 0, OTHER: 0 };
    var cashRows = 0;
    var securityRows = 0;
    var sourceCol = sysSheetRuntimeSnapshotHeaderIndex_(headers, ['Source']);
    var symbolCol = sysSheetRuntimeSnapshotHeaderIndex_(headers, ['Symbol']);
    var keyCol = sysSheetRuntimeSnapshotHeaderIndex_(headers, ['Source security key']);
    var cashCol = sysSheetRuntimeSnapshotHeaderIndex_(headers, ['Cash balance']);
    (displayRows || []).forEach(function(row) {
      var sourceScan = sysSheetRuntimeSnapshotScanTextMarkers_(row[sourceCol]);
      if (sourceScan.robinhood) sourceCounts.ROBINHOOD += 1;
      else if (sourceScan.m1) sourceCounts.M1 += 1;
      else if (sourceScan.etrade) sourceCounts.ETRADE += 1;
      else sourceCounts.OTHER += 1;
      var keyToken = sysSheetRuntimeSnapshotNormalizeToken_(row[keyCol]);
      var symbolToken = sysSheetRuntimeSnapshotNormalizeToken_(row[symbolCol]);
      var cashToken = String((row || [])[cashCol] || '').trim();
      if (keyToken === '__CASH__' || symbolToken === 'CASH' || cashToken) cashRows += 1;
      else securityRows += 1;
    });
    meta.sourceCounts = sourceCounts;
    meta.m1RowsPresent = sourceCounts.M1 > 0;
    meta.cashRowCount = cashRows;
    meta.securityRowCount = securityRows;
    meta.maxAsOfDate = sysSheetRuntimeSnapshotFindLastDate_(headers, displayRows);
    if (sheet && cashCol >= 0 && displayRows.length) {
      try {
        var startRow = Math.max(2, sheet.getLastRow() - displayRows.length + 1);
        var endRow = sheet.getLastRow();
        var formats = sheet.getRange(startRow, cashCol + 1, endRow - startRow + 1, 1)
          .getNumberFormats() || [];
        var currencyLike = 0;
        var dateLike = 0;
        for (var r = 0; r < formats.length; r++) {
          var fmt = String((formats[r] && formats[r][0]) || '');
          if (sysSheetRuntimeSnapshotFormatLooksCurrency_(fmt)) currencyLike += 1;
          if (sysSheetRuntimeSnapshotFormatLooksDate_(fmt)) dateLike += 1;
        }
        meta.cashBalanceFormat = {
          sampleRows: displayRows.length,
          currencyLikeRows: currencyLike,
          dateLikeRows: dateLike,
          displaysAsCurrency: currencyLike > 0 && dateLike === 0
        };
      } catch (_fmtErr) {
        meta.cashBalanceFormat = { sampleRows: displayRows.length, unavailable: true };
      }
    }
  }

  if (sheetName === 'SYS - Assets') {
    meta.investmentAccountRowCount = (displayRows || []).length;
  }

  if (sheetName === 'SYS - Financial Accounts') {
    meta.registryRowCount = (displayRows || []).length;
  }

  if (sheetName === 'SYS - Account Source Links') {
    var statusIdx = sysSheetRuntimeSnapshotHeaderIndex_(headers, ['Link status', 'Link Status']);
    var verified = 0;
    (displayRows || []).forEach(function(row) {
      var status = sysSheetRuntimeSnapshotNormalizeToken_(row[statusIdx]);
      if (status === 'VERIFIED') verified += 1;
    });
    meta.linkRowCount = (displayRows || []).length;
    meta.verifiedLinkCount = verified;
  }

  return meta;
}

function sysSheetRuntimeSnapshotCompactFocusMetadata_(sheetName, focusMetadata) {
  if (!focusMetadata) return null;
  if (sheetName === 'SYS - Investment Holdings Unified') {
    var cashFormat = focusMetadata.cashBalanceFormat || {};
    return {
      sourceCounts: focusMetadata.sourceCounts || { M1: 0, ETRADE: 0, ROBINHOOD: 0, OTHER: 0 },
      m1RowsPresent: !!focusMetadata.m1RowsPresent,
      cashRowCount: Number(focusMetadata.cashRowCount) || 0,
      cashBalanceFormat: {
        displaysAsCurrency: !!cashFormat.displaysAsCurrency
      },
      maxAsOfDate: focusMetadata.maxAsOfDate || null
    };
  }
  return focusMetadata;
}

function sysSheetRuntimeSnapshotCompactFocusSheetEntry_(entry) {
  entry = entry || {};
  var productionRefs = entry.productionRefs || {};
  return {
    sheetName: String(entry.sheetName || ''),
    exists: !!entry.exists,
    rowCount: Number(entry.rowCount) || 0,
    columnCount: Number(entry.columnCount) || 0,
    dataRowCount: Number(entry.dataRowCount) || 0,
    dataPresence: String(entry.dataPresence || 'MISSING'),
    dataMarkers: entry.dataMarkers || {
      robinhood: false, m1: false, etrade: false, identity: false, import: false, reserved: false
    },
    recommendedStatus: String(entry.recommendedStatus || productionRefs.recommendedStatus || 'UNKNOWN'),
    focusMetadata: sysSheetRuntimeSnapshotCompactFocusMetadata_(
      entry.sheetName, entry.focusMetadata)
  };
}

/**
 * Resolve the caller workbook for admin snapshot entry points.
 * @returns {!Object}
 */
function sysSheetRuntimeSnapshotRequireSpreadsheet_() {
  var ss = typeof getUserSpreadsheet_ === 'function' ? getUserSpreadsheet_() : null;
  if (!ss) {
    throw new Error(
      'No workbook is available for this execution. Open the CashCompass spreadsheet, ' +
      'run from Extensions > Apps Script, or use Validator vtRunSysSheetRuntimeSnapshot(spreadsheetId).'
    );
  }
  return ss;
}

/**
 * Ensure admin snapshot payloads are JSON-serializable before return/log.
 * @param {*} value
 * @returns {!Object}
 */
function sysSheetRuntimeSnapshotWireSafe_(value) {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch (wireErr) {
    throw new Error('Snapshot result is not serializable: ' +
      String(wireErr && wireErr.message ? wireErr.message : wireErr));
  }
}

/**
 * @param {*} err
 * @param {string} phase
 * @param {boolean=} includeSummaryVersion
 * @returns {!Object}
 */
function sysSheetRuntimeSnapshotFormatAdminError_(err, phase, includeSummaryVersion) {
  var payload = {
    ok: false,
    readOnly: true,
    auditVersion: SYS_SHEET_RUNTIME_SNAPSHOT_VERSION_,
    error: String(err && err.message ? err.message : err || 'Unknown error'),
    failurePhase: String(phase || 'snapshot'),
    stackLocation: ''
  };
  if (includeSummaryVersion) {
    payload.summaryVersion = 'SYS_SHEET_RUNTIME_FOCUS_SUMMARY_V1';
  }
  try {
    payload.stackLocation = String(err && err.stack ? err.stack : '')
      .split('\n')
      .slice(0, 8)
      .join('\n');
  } catch (_stackErr) { /* diagnostic only */ }
  return payload;
}

/**
 * Compact focus-sheet summary — reads only the six focus sheets (no full SYS scan).
 * @param {!Object} ss
 * @returns {!Object}
 */
function buildSysSheetRuntimeSnapshotFocusSummary_(ss) {
  if (!ss) throw new Error('Spreadsheet handle is required.');

  var inventoryIndex = sysSheetRuntimeSnapshotInventoryIndex_();
  var sheets = SYS_SHEET_RUNTIME_SNAPSHOT_FOCUS_SHEETS_.map(function(name) {
    return sysSheetRuntimeSnapshotCompactFocusSheetEntry_(
      sysSheetRuntimeSnapshotBuildSheetEntry_(ss, name, inventoryIndex));
  });

  return {
    ok: true,
    readOnly: true,
    auditVersion: SYS_SHEET_RUNTIME_SNAPSHOT_VERSION_,
    summaryVersion: 'SYS_SHEET_RUNTIME_FOCUS_SUMMARY_V1',
    generatedAt: new Date().toISOString(),
    spreadsheetId: (function() {
      try { return String(ss.getId() || ''); } catch (_e) { return ''; }
    })(),
    sheets: sheets,
    safety: {
      noWrites: true,
      noFormatting: true,
      noRepairs: true,
      sensitiveValuesRedacted: true
    }
  };
}

function sysSheetRuntimeSnapshotProductionRefs_(sheetName, inventoryMeta) {
  inventoryMeta = inventoryMeta || {};
  return {
    hasProductionReaders: !!inventoryMeta.hasProductionReaders,
    hasProductionWriters: !!inventoryMeta.hasProductionWriters,
    recommendedStatus: String(inventoryMeta.recommendedStatus || 'UNKNOWN'),
    inventoryKnown: !!inventoryMeta.configKey || sheetName === 'SYS - Meta'
  };
}

function sysSheetRuntimeSnapshotBuildSheetEntry_(ss, sheetName, inventoryIndex) {
  inventoryIndex = inventoryIndex || sysSheetRuntimeSnapshotInventoryIndex_();
  var inventoryMeta = inventoryIndex[sheetName] || {};
  var sheet = null;
  try { sheet = ss.getSheetByName(sheetName); } catch (_e) { sheet = null; }

  if (!sheet) {
    return {
      sheetName: sheetName,
      exists: false,
      rowCount: 0,
      columnCount: 0,
      headerRow: [],
      dataRowCount: 0,
      hasFormulas: false,
      lastPopulatedRow: null,
      lastPopulatedDate: null,
      dataPresence: 'MISSING',
      dataMarkers: sysSheetRuntimeSnapshotClassifyDataMarkers_(sheetName, [], [], inventoryMeta),
      productionRefs: sysSheetRuntimeSnapshotProductionRefs_(sheetName, inventoryMeta),
      focusMetadata: SYS_SHEET_RUNTIME_SNAPSHOT_FOCUS_SHEETS_.indexOf(sheetName) >= 0
        ? { focusSheet: true, dataRowCount: 0 } : null
    };
  }

  var lastRow = 0;
  var lastCol = 0;
  try {
    lastRow = sheet.getLastRow();
    lastCol = sheet.getLastColumn();
  } catch (_dimErr) {
    lastRow = 0;
    lastCol = 0;
  }

  var headerRow = [];
  if (lastRow >= 1 && lastCol >= 1) {
    try {
      headerRow = sheet.getRange(1, 1, 1, lastCol).getDisplayValues()[0].map(function(cell) {
        return String(cell || '').trim();
      });
    } catch (_headerErr) { headerRow = []; }
  }

  var dataRowCount = Math.max(0, lastRow - 1);
  var displayRows = [];
  if (dataRowCount > 0 && lastCol >= 1) {
    var sampleCount = Math.min(500, dataRowCount);
    var startRow = Math.max(2, lastRow - sampleCount + 1);
    try {
      displayRows = sheet.getRange(startRow, 1, lastRow - startRow + 1, lastCol).getDisplayValues();
    } catch (_sampleErr) { displayRows = []; }
  }

  var hasFormulas = sysSheetRuntimeSnapshotSheetHasFormulas_(sheet, lastRow, lastCol);
  var dataMarkers = sysSheetRuntimeSnapshotClassifyDataMarkers_(
    sheetName, headerRow, displayRows, inventoryMeta);
  var focusMetadata = sysSheetRuntimeSnapshotFocusMetadata_(
    sheetName, sheet, headerRow, displayRows);

  return {
    sheetName: sheetName,
    exists: true,
    rowCount: lastRow,
    columnCount: lastCol,
    headerRow: headerRow,
    dataRowCount: dataRowCount,
    hasFormulas: hasFormulas,
    lastPopulatedRow: dataRowCount > 0 ? lastRow : null,
    lastPopulatedDate: sysSheetRuntimeSnapshotFindLastDate_(headerRow, displayRows),
    dataPresence: dataRowCount > 0 ? 'POPULATED' : 'EMPTY',
    dataMarkers: dataMarkers,
    productionRefs: sysSheetRuntimeSnapshotProductionRefs_(sheetName, inventoryMeta),
    focusMetadata: focusMetadata
  };
}

/**
 * Core read-only snapshot builder. Accepts an open Spreadsheet handle only.
 * @param {!Object} ss
 * @returns {!Object}
 */
function buildSysSheetRuntimeSnapshot_(ss) {
  if (!ss) throw new Error('Spreadsheet handle is required.');

  var inventoryIndex = sysSheetRuntimeSnapshotInventoryIndex_();
  var expected = sysSheetRuntimeSnapshotExpectedSheetNames_();
  var workbookNames = sysSheetRuntimeSnapshotWorkbookSysSheetNames_(ss);
  var union = {};
  expected.forEach(function(name) { union[name] = true; });
  workbookNames.forEach(function(name) { union[name] = true; });
  var sheetNames = Object.keys(union).sort();

  var sheets = sheetNames.map(function(name) {
    return sysSheetRuntimeSnapshotBuildSheetEntry_(ss, name, inventoryIndex);
  });

  var focusSummaries = {};
  SYS_SHEET_RUNTIME_SNAPSHOT_FOCUS_SHEETS_.forEach(function(name) {
    var entry = null;
    for (var i = 0; i < sheets.length; i++) {
      if (sheets[i].sheetName === name) { entry = sheets[i]; break; }
    }
    focusSummaries[name] = entry ? {
      exists: entry.exists,
      dataRowCount: entry.dataRowCount,
      dataPresence: entry.dataPresence,
      focusMetadata: entry.focusMetadata
    } : { exists: false, dataRowCount: 0, dataPresence: 'MISSING', focusMetadata: null };
  });

  return {
    ok: true,
    readOnly: true,
    auditVersion: SYS_SHEET_RUNTIME_SNAPSHOT_VERSION_,
    repositoryAuditVersion: 'SYS_SHEET_AUDIT_V1',
    generatedAt: new Date().toISOString(),
    spreadsheetId: (function() {
      try { return String(ss.getId() || ''); } catch (_e) { return ''; }
    })(),
    expectedSheetCount: expected.length,
    workbookSysSheetCount: workbookNames.length,
    sheets: sheets,
    focusSummaries: focusSummaries,
    safety: {
      noWrites: true,
      noFormatting: true,
      noRepairs: true,
      sensitiveValuesRedacted: true
    }
  };
}

/** Admin-gated runtime snapshot for the caller's resolved workbook. */
function adminGetSysSheetRuntimeSnapshot() {
  try {
    assertAdmin_();
    var snapshot = sysSheetRuntimeSnapshotWireSafe_(
      buildSysSheetRuntimeSnapshot_(sysSheetRuntimeSnapshotRequireSpreadsheet_()));
    Logger.log(JSON.stringify(snapshot, null, 2));
    return snapshot;
  } catch (err) {
    var failure = sysSheetRuntimeSnapshotFormatAdminError_(err, 'full_snapshot', false);
    Logger.log(JSON.stringify(failure, null, 2));
    return failure;
  }
}

/** Admin-gated compact focus summary — one execution-log line per focus sheet. */
function adminGetSysSheetRuntimeSnapshotFocusSummary() {
  try {
    assertAdmin_();
    var summary = sysSheetRuntimeSnapshotWireSafe_(
      buildSysSheetRuntimeSnapshotFocusSummary_(sysSheetRuntimeSnapshotRequireSpreadsheet_()));
    (summary.sheets || []).forEach(function(sheet) {
      Logger.log(JSON.stringify(sheet, null, 2));
    });
    return summary;
  } catch (err) {
    var failure = sysSheetRuntimeSnapshotFormatAdminError_(err, 'focus_summary', true);
    Logger.log(JSON.stringify(failure, null, 2));
    return failure;
  }
}

/** Admin UI wrapper — same payload, sanitized for google.script.run. */
function adminUiGetSysSheetRuntimeSnapshot() {
  try {
    assertAdmin_();
    return sysSheetRuntimeSnapshotWireSafe_(
      buildSysSheetRuntimeSnapshot_(sysSheetRuntimeSnapshotRequireSpreadsheet_()));
  } catch (err) {
    return sysSheetRuntimeSnapshotFormatAdminError_(err, 'ui_snapshot', false);
  }
}
