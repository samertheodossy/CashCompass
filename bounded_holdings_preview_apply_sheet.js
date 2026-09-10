/**
 * bounded_holdings_preview_apply_sheet.js — Unified holdings sheet I/O (bounded Apply only).
 *
 * The unified sheet is created only on explicit Apply confirmation, never during preview or diff.
 */

var BOUNDED_HOLDINGS_UNIFIED_HEADERS_ = [
  'Source',
  'Provider',
  'Parent CashCompass account',
  'Child account/partition',
  'Investment Id',
  'Source security key',
  'Symbol',
  'Security name',
  'Shares',
  'Price',
  'Market value',
  'Cost basis',
  'Unrealized gain/loss',
  'Cash balance',
  'As-of date',
  'Document fingerprint',
  'Import status',
  'Imported at',
  'Import run/reference'
];

var BOUNDED_HOLDINGS_UNIFIED_WIDTHS_ = {
  'Source': 165,
  'Provider': 102,
  'Parent CashCompass account': 248,
  'Child account/partition': 220,
  'Investment Id': 140,
  'Source security key': 168,
  'Symbol': 78,
  'Security name': 240,
  'Shares': 96,
  'Price': 92,
  'Market value': 118,
  'Cost basis': 108,
  'Unrealized gain/loss': 148,
  'Cash balance': 112,
  'As-of date': 108,
  'Document fingerprint': 168,
  'Import status': 118,
  'Imported at': 168,
  'Import run/reference': 168
};

var BOUNDED_HOLDINGS_UNIFIED_HEADER_ROW_HEIGHT_ = 32;
var BOUNDED_HOLDINGS_UNIFIED_BODY_ROW_HEIGHT_ = 22;
var BOUNDED_HOLDINGS_UNIFIED_HEADER_FONT_SIZE_ = 10;
var BOUNDED_HOLDINGS_UNIFIED_BODY_FONT_SIZE_ = 10;
var BOUNDED_HOLDINGS_UNIFIED_TEXT_FORMAT_ = '@';

/** 1-based column indices — must match BOUNDED_HOLDINGS_UNIFIED_HEADERS_ order. */
var BOUNDED_HOLDINGS_UNIFIED_COL_ = {
  SOURCE: 1,
  PROVIDER: 2,
  PARENT_ACCOUNT: 3,
  CHILD_PARTITION: 4,
  INVESTMENT_ID: 5,
  SOURCE_SECURITY_KEY: 6,
  SYMBOL: 7,
  SECURITY_NAME: 8,
  SHARES: 9,
  PRICE: 10,
  MARKET_VALUE: 11,
  COST_BASIS: 12,
  UNREALIZED_GL: 13,
  CASH_BALANCE: 14,
  AS_OF_DATE: 15,
  DOCUMENT_FINGERPRINT: 16,
  IMPORT_STATUS: 17,
  IMPORTED_AT: 18,
  IMPORT_RUN_REF: 19
};

var BOUNDED_HOLDINGS_UNIFIED_CURRENCY_FORMAT_ = '$#,##0.00;-$#,##0.00';
var BOUNDED_HOLDINGS_UNIFIED_SHARES_FORMAT_ = '#,##0.000000';
var BOUNDED_HOLDINGS_UNIFIED_AS_OF_FORMAT_ = 'yyyy-mm-dd';
var BOUNDED_HOLDINGS_UNIFIED_IMPORTED_AT_FORMAT_ = 'yyyy-mm-dd hh:mm:ss';

var BOUNDED_HOLDINGS_UNIFIED_HIDDEN_COLUMNS_ = [
  BOUNDED_HOLDINGS_UNIFIED_COL_.CHILD_PARTITION,
  BOUNDED_HOLDINGS_UNIFIED_COL_.INVESTMENT_ID,
  BOUNDED_HOLDINGS_UNIFIED_COL_.SOURCE_SECURITY_KEY,
  BOUNDED_HOLDINGS_UNIFIED_COL_.DOCUMENT_FINGERPRINT,
  BOUNDED_HOLDINGS_UNIFIED_COL_.IMPORT_RUN_REF
];

var BOUNDED_HOLDINGS_UNIFIED_TEXT_COLUMNS_ = [
  BOUNDED_HOLDINGS_UNIFIED_COL_.SOURCE,
  BOUNDED_HOLDINGS_UNIFIED_COL_.PROVIDER,
  BOUNDED_HOLDINGS_UNIFIED_COL_.PARENT_ACCOUNT,
  BOUNDED_HOLDINGS_UNIFIED_COL_.CHILD_PARTITION,
  BOUNDED_HOLDINGS_UNIFIED_COL_.INVESTMENT_ID,
  BOUNDED_HOLDINGS_UNIFIED_COL_.SOURCE_SECURITY_KEY,
  BOUNDED_HOLDINGS_UNIFIED_COL_.SYMBOL,
  BOUNDED_HOLDINGS_UNIFIED_COL_.SECURITY_NAME,
  BOUNDED_HOLDINGS_UNIFIED_COL_.DOCUMENT_FINGERPRINT,
  BOUNDED_HOLDINGS_UNIFIED_COL_.IMPORT_STATUS,
  BOUNDED_HOLDINGS_UNIFIED_COL_.IMPORT_RUN_REF
];

function boundedHoldingsPreviewApplyUnifiedSheetName_() {
  return getSheetNames_().INVESTMENT_HOLDINGS_UNIFIED;
}

function boundedHoldingsPreviewApplyNormalizeAsOfDate_(value) {
  var raw = String(value || '').trim();
  if (!raw) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  var parsed = typeof normalizeInvestmentImportDate_ === 'function'
    ? normalizeInvestmentImportDate_(raw)
    : raw;
  parsed = String(parsed || '').trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(parsed)) return parsed.slice(0, 10);
  return parsed.slice(0, 10);
}

function boundedHoldingsPreviewApplyAccountIdentityKey_(row) {
  row = row || {};
  var childPartition = String(row.childPartition || '').trim();
  if (childPartition.indexOf('PREVIEW-GROUP-') === 0) return childPartition;
  var investmentId = String(row.investmentId || '').trim();
  if (investmentId) return investmentId;
  return String(row.accountIdentityKey || '').trim();
}

function boundedHoldingsPreviewApplyRowKey_(row) {
  row = row || {};
  return [
    String(row.source || '').trim().toUpperCase(),
    boundedHoldingsPreviewApplyAccountIdentityKey_(row),
    String(row.sourceSecurityKey || '').trim(),
    boundedHoldingsPreviewApplyNormalizeAsOfDate_(row.asOfDate || row.asOf)
  ].join('|');
}

function boundedHoldingsPreviewApplyNullableNumber_(value) {
  if (value === null || typeof value === 'undefined' || value === '') return null;
  var num = Number(value);
  return isFinite(num) ? round2_(num) : null;
}

function boundedHoldingsPreviewApplyValueDigestPart_(row) {
  row = row || {};
  return investmentPortfolioDigest_([
    boundedHoldingsPreviewApplyNullableNumber_(row.shares),
    boundedHoldingsPreviewApplyNullableNumber_(row.price),
    boundedHoldingsPreviewApplyNullableNumber_(row.marketValue),
    boundedHoldingsPreviewApplyNullableNumber_(row.costBasis),
    boundedHoldingsPreviewApplyNullableNumber_(row.unrealizedGainLoss),
    boundedHoldingsPreviewApplyNullableNumber_(row.cashBalance),
    String(row.documentFingerprint || '').trim(),
    String(row.importStatus || '').trim()
  ]);
}

function boundedHoldingsPreviewApplyParseSheetRow_(displayRow, valueRow, sheetRow) {
  displayRow = displayRow || [];
  valueRow = valueRow || [];
  var row = {
    sheetRow: sheetRow,
    source: String(displayRow[0] || '').trim(),
    provider: String(displayRow[1] || '').trim(),
    parentAccount: String(displayRow[2] || '').trim(),
    childPartition: String(displayRow[3] || '').trim(),
    investmentId: String(displayRow[4] || '').trim(),
    sourceSecurityKey: String(displayRow[5] || '').trim(),
    symbol: String(displayRow[6] || '').trim(),
    securityName: String(displayRow[7] || '').trim(),
    shares: valueRow[8],
    price: valueRow[9],
    marketValue: valueRow[10],
    costBasis: valueRow[11],
    unrealizedGainLoss: valueRow[12],
    cashBalance: valueRow[13],
    asOfDate: boundedHoldingsPreviewApplyNormalizeAsOfDate_(displayRow[14]),
    documentFingerprint: String(displayRow[15] || '').trim(),
    importStatus: boundedHoldingsPreviewApplyNormalizeImportStatus_(displayRow[16]),
    importedAt: String(displayRow[17] || '').trim(),
    importRunRef: String(displayRow[18] || '').trim()
  };
  row.accountIdentityKey = boundedHoldingsPreviewApplyAccountIdentityKey_(row);
  row.rowKey = boundedHoldingsPreviewApplyRowKey_(row);
  row.valueDigest = boundedHoldingsPreviewApplyValueDigestPart_(row);
  return row;
}

function boundedHoldingsPreviewApplyReadExistingRows_(ss) {
  ss = ss || getUserSpreadsheet_();
  var sheet = ss.getSheetByName(boundedHoldingsPreviewApplyUnifiedSheetName_());
  if (!sheet || sheet.getLastRow() < 2) return [];
  var lastRow = sheet.getLastRow();
  var width = BOUNDED_HOLDINGS_UNIFIED_HEADERS_.length;
  var display = sheet.getRange(2, 1, lastRow - 1, width).getDisplayValues();
  var values = sheet.getRange(2, 1, lastRow - 1, width).getValues();
  var rows = [];
  for (var i = 0; i < display.length; i += 1) {
    if (!String(display[i][0] || '').trim()) continue;
    rows.push(boundedHoldingsPreviewApplyParseSheetRow_(display[i], values[i], i + 2));
  }
  return rows;
}

function boundedHoldingsPreviewApplyUnifiedBodyRowCount_(sheet) {
  if (!sheet) return 0;
  try {
    var lastRow = Math.max(1, sheet.getLastRow());
    return Math.max(0, lastRow - 1);
  } catch (_e) { return 0; }
}

function boundedHoldingsPreviewApplySetUnifiedColumnWidths_(sheet) {
  if (!sheet) return;
  var width = BOUNDED_HOLDINGS_UNIFIED_HEADERS_.length;
  var headers = [];
  try {
    headers = sheet.getRange(1, 1, 1, width).getValues()[0] || [];
  } catch (_headerErr) { return; }
  for (var i = 0; i < headers.length; i += 1) {
    var header = String(headers[i] || '').trim();
    var targetWidth = BOUNDED_HOLDINGS_UNIFIED_WIDTHS_[header];
    if (!(targetWidth > 0)) continue;
    try { sheet.setColumnWidth(i + 1, targetWidth); } catch (_widthErr) { /* cosmetic */ }
  }
}

function boundedHoldingsPreviewApplyFormatUnifiedSheet_(sheet) {
  if (!sheet) return;
  var width = BOUNDED_HOLDINGS_UNIFIED_HEADERS_.length;
  var lastRow = 1;
  try { lastRow = Math.max(1, sheet.getLastRow()); } catch (_lastRowErr) { /* cosmetic only */ }
  var bodyRows = boundedHoldingsPreviewApplyUnifiedBodyRowCount_(sheet);
  var dataStart = 2;

  boundedHoldingsPreviewApplySetUnifiedColumnWidths_(sheet);

  try {
    sheet.getRange(1, 1, 1, width)
      .setBackground('#dbeafe')
      .setFontColor('#1e3a5f')
      .setFontWeight('bold')
      .setFontSize(BOUNDED_HOLDINGS_UNIFIED_HEADER_FONT_SIZE_)
      .setHorizontalAlignment('center')
      .setVerticalAlignment('middle')
      .setWrap(false);
    sheet.setFrozenRows(1);
    sheet.setFrozenColumns(0);
    sheet.setRowHeight(1, BOUNDED_HOLDINGS_UNIFIED_HEADER_ROW_HEIGHT_);
  } catch (_headerErr) { /* cosmetic only */ }

  try {
    if (bodyRows > 0) {
      sheet.getRange(dataStart, 1, bodyRows, width)
        .setBackground('#ffffff')
        .setFontColor('#000000')
        .setFontSize(BOUNDED_HOLDINGS_UNIFIED_BODY_FONT_SIZE_)
        .setWrap(false)
        .setVerticalAlignment('middle');
      sheet.setRowHeights(dataStart, bodyRows, BOUNDED_HOLDINGS_UNIFIED_BODY_ROW_HEIGHT_);
    }
  } catch (_bodyWrapErr) { /* cosmetic only */ }

  try {
    BOUNDED_HOLDINGS_UNIFIED_TEXT_COLUMNS_.forEach(function(col) {
      sheet.getRange(dataStart, col, bodyRows, 1)
        .setNumberFormat(BOUNDED_HOLDINGS_UNIFIED_TEXT_FORMAT_);
    });
    sheet.getRange(dataStart, BOUNDED_HOLDINGS_UNIFIED_COL_.SHARES, bodyRows, 1)
      .setNumberFormat(BOUNDED_HOLDINGS_UNIFIED_SHARES_FORMAT_);
    sheet.getRange(dataStart, BOUNDED_HOLDINGS_UNIFIED_COL_.PRICE, bodyRows, 1)
      .setNumberFormat(BOUNDED_HOLDINGS_UNIFIED_CURRENCY_FORMAT_);
    sheet.getRange(dataStart, BOUNDED_HOLDINGS_UNIFIED_COL_.MARKET_VALUE, bodyRows, 3)
      .setNumberFormat(BOUNDED_HOLDINGS_UNIFIED_CURRENCY_FORMAT_);
    sheet.getRange(dataStart, BOUNDED_HOLDINGS_UNIFIED_COL_.AS_OF_DATE, bodyRows, 1)
      .setNumberFormat(BOUNDED_HOLDINGS_UNIFIED_AS_OF_FORMAT_);
    sheet.getRange(dataStart, BOUNDED_HOLDINGS_UNIFIED_COL_.IMPORTED_AT, bodyRows, 1)
      .setNumberFormat(BOUNDED_HOLDINGS_UNIFIED_IMPORTED_AT_FORMAT_);
    // Cash balance must stay currency — never inherit yyyy-mm-dd from legacy column drift.
    sheet.getRange(dataStart, BOUNDED_HOLDINGS_UNIFIED_COL_.CASH_BALANCE, bodyRows, 1)
      .setNumberFormat(BOUNDED_HOLDINGS_UNIFIED_CURRENCY_FORMAT_);
    sheet.getRange(dataStart, BOUNDED_HOLDINGS_UNIFIED_COL_.IMPORT_STATUS, bodyRows, 1)
      .setHorizontalAlignment('center');
  } catch (_formatErr) { /* cosmetic only */ }

  BOUNDED_HOLDINGS_UNIFIED_HIDDEN_COLUMNS_.forEach(function(col) {
    try { sheet.hideColumns(col); } catch (_hideErr) { /* cosmetic only */ }
  });

  try {
    var filter = sheet.getFilter();
    if (filter) filter.remove();
    sheet.getRange(1, 1, Math.max(lastRow, 1), width).createFilter();
  } catch (_filterErr) { /* cosmetic only */ }

  boundedHoldingsPreviewApplyFormatUnifiedImportStatus_(sheet, lastRow);
}

function boundedHoldingsPreviewApplyFormatUnifiedImportStatus_(sheet, lastRow) {
  if (!sheet || lastRow < 2) return;
  var statusCol = BOUNDED_HOLDINGS_UNIFIED_COL_.IMPORT_STATUS;
  var statusRange = sheet.getRange(2, statusCol, lastRow - 1, 1);
  var preserved = [];
  try {
    preserved = (sheet.getConditionalFormatRules() || []).filter(function(rule) {
      var ranges = rule.getRanges ? rule.getRanges() : [];
      return !ranges.some(function(range) {
        return range.getColumn() === statusCol;
      });
    });
  } catch (_readErr) { /* cosmetic only */ }

  var statusRules = [];
  try {
    statusRules.push(SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('APPLIED')
      .setBackground('#d1fae5')
      .setFontColor('#065f46')
      .setRanges([statusRange])
      .build());
    statusRules.push(SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('REVIEW_REQUIRED')
      .setBackground('#fef3c7')
      .setFontColor('#92400e')
      .setRanges([statusRange])
      .build());
    statusRules.push(SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('CONFLICT')
      .setBackground('#fee2e2')
      .setFontColor('#991b1b')
      .setRanges([statusRange])
      .build());
    statusRules.push(SpreadsheetApp.newConditionalFormatRule()
      .whenTextContains('CONFLICT')
      .setBackground('#fee2e2')
      .setFontColor('#991b1b')
      .setRanges([statusRange])
      .build());
    sheet.setConditionalFormatRules(preserved.concat(statusRules));
  } catch (_ruleErr) { /* cosmetic only */ }
}

function boundedHoldingsPreviewApplyTouchUnifiedSheetFormat_(ss) {
  ss = ss || getUserSpreadsheet_();
  var sheet = ss.getSheetByName(boundedHoldingsPreviewApplyUnifiedSheetName_());
  if (!sheet) return;
  boundedHoldingsPreviewApplyFormatUnifiedSheet_(sheet);
}

/**
 * Admin entry — reapply Unified holdings sheet formatting only (no data writes).
 * Safe to run from the Apps Script editor on the active bounded workbook.
 */
function adminTouchBoundedHoldingsPreviewUnifiedSheetFormat() {
  try {
    if (typeof assertAdmin_ === 'function') {
      assertAdmin_();
    } else if (typeof isAdminUser_ === 'function' && !isAdminUser_()) {
      throw new Error('Admin access required.');
    }
    var ss = getUserSpreadsheet_();
    if (!ss) {
      throw new Error('Active spreadsheet is unavailable.');
    }
    var sheetName = boundedHoldingsPreviewApplyUnifiedSheetName_();
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      return {
        ok: false,
        formattingOnly: true,
        sheetName: sheetName,
        error: 'Unified holdings sheet does not exist: ' + sheetName
      };
    }
    var lastRow = 0;
    try { lastRow = Math.max(0, sheet.getLastRow()); } catch (_lastRowErr) { /* cosmetic only */ }
    boundedHoldingsPreviewApplyTouchUnifiedSheetFormat_(ss);
    return {
      ok: true,
      formattingOnly: true,
      sheetName: sheetName,
      dataRowCount: Math.max(0, lastRow - 1),
      message: 'Unified holdings formatting refreshed. Cell values and row order were not changed.'
    };
  } catch (err) {
    return {
      ok: false,
      formattingOnly: true,
      error: String(err && err.message ? err.message : err)
    };
  }
}

function boundedHoldingsPreviewApplyEnsureUnifiedSheet_(ss, createIfMissing) {
  ss = ss || getUserSpreadsheet_();
  var name = boundedHoldingsPreviewApplyUnifiedSheetName_();
  var existing = ss.getSheetByName(name);
  if (existing) {
    boundedHoldingsPreviewApplyFormatUnifiedSheet_(existing);
    return { sheet: existing, created: false };
  }
  if (!createIfMissing) return { sheet: null, created: false };
  var sheet;
  try {
    sheet = ss.insertSheet(name);
  } catch (e) {
    var raced = ss.getSheetByName(name);
    if (raced) {
      boundedHoldingsPreviewApplyFormatUnifiedSheet_(raced);
      return { sheet: raced, created: false };
    }
    throw e;
  }
  sheet.getRange(1, 1, 1, BOUNDED_HOLDINGS_UNIFIED_HEADERS_.length)
    .setValues([BOUNDED_HOLDINGS_UNIFIED_HEADERS_]);
  boundedHoldingsPreviewApplyFormatUnifiedSheet_(sheet);
  return { sheet: sheet, created: true };
}

function boundedHoldingsPreviewApplyRowToSheetValues_(row, importRunRef, importedAt) {
  row = row || {};
  return [
    String(row.source || '').trim(),
    String(row.provider || '').trim(),
    String(row.parentAccount || '').trim(),
    String(row.childPartition || '').trim(),
    String(row.investmentId || '').trim(),
    String(row.sourceSecurityKey || '').trim(),
    String(row.symbol || '').trim(),
    String(row.securityName || '').trim(),
    row.shares === '' || row.shares === null || typeof row.shares === 'undefined'
      ? '' : Number(row.shares),
    row.price === '' || row.price === null || typeof row.price === 'undefined'
      ? '' : Number(row.price),
    row.marketValue === '' || row.marketValue === null || typeof row.marketValue === 'undefined'
      ? '' : Number(row.marketValue),
    row.costBasis === '' || row.costBasis === null || typeof row.costBasis === 'undefined'
      ? '' : Number(row.costBasis),
    row.unrealizedGainLoss === '' || row.unrealizedGainLoss === null ||
      typeof row.unrealizedGainLoss === 'undefined'
      ? '' : Number(row.unrealizedGainLoss),
    row.cashBalance === '' || row.cashBalance === null || typeof row.cashBalance === 'undefined'
      ? '' : Number(row.cashBalance),
    boundedHoldingsPreviewApplyNormalizeAsOfDate_(row.asOfDate || row.asOf),
    String(row.documentFingerprint || '').trim(),
    String(row.importStatus || 'APPLIED').trim(),
    String(importedAt || '').trim(),
    String(importRunRef || '').trim()
  ];
}

function boundedHoldingsPreviewApplyBuildImportRunRef_() {
  var stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss');
  var suffix = investmentPortfolioDigest_([String(stamp), String(Math.random())]).slice(0, 8);
  return 'BH-APPLY-' + stamp + '-' + suffix;
}

function boundedHoldingsPreviewApplyRollbackWrites_(sheet, rollback) {
  rollback = rollback || {};
  var updates = rollback.updates || [];
  var appends = rollback.appends || [];
  try {
    updates.slice().reverse().forEach(function(entry) {
      if (!entry || !entry.sheetRow) return;
      sheet.getRange(entry.sheetRow, 1, 1, BOUNDED_HOLDINGS_UNIFIED_HEADERS_.length)
        .setValues([entry.oldValues]);
    });
    appends.slice().reverse().forEach(function(entry) {
      if (!entry || !entry.startRow || !entry.rowCount) return;
      sheet.deleteRows(entry.startRow, entry.rowCount);
    });
    SpreadsheetApp.flush();
  } catch (_rollbackErr) { /* best effort */ }
}

function boundedHoldingsPreviewApplyWriteDiff_(ss, diff, importRunRef, importedAt) {
  diff = diff || {};
  var createRows = diff.create || [];
  var updateRows = diff.update || [];
  if (!createRows.length && !updateRows.length) {
    return { ok: true, created: 0, updated: 0, importRunRef: importRunRef, rowResults: [] };
  }

  var ensure = boundedHoldingsPreviewApplyEnsureUnifiedSheet_(ss, true);
  var sheet = ensure.sheet;
  if (!sheet) throw new Error('Unified holdings sheet could not be created.');

  var rollback = { updates: [], appends: [] };
  var rowResults = [];
  try {
    updateRows.forEach(function(entry) {
      var proposed = entry.proposed || entry;
      var existing = entry.existing || {};
      var sheetRow = Number(existing.sheetRow);
      if (!sheetRow || sheetRow < 2) {
        throw new Error('Update target row is invalid.');
      }
      var oldValues = sheet.getRange(sheetRow, 1, 1, BOUNDED_HOLDINGS_UNIFIED_HEADERS_.length).getValues()[0];
      rollback.updates.push({ sheetRow: sheetRow, oldValues: oldValues });
      var nextValues = boundedHoldingsPreviewApplyRowToSheetValues_(proposed, importRunRef, importedAt);
      sheet.getRange(sheetRow, 1, 1, BOUNDED_HOLDINGS_UNIFIED_HEADERS_.length).setValues([nextValues]);
      rowResults.push({
        action: 'UPDATE',
        rowKey: proposed.rowKey,
        sheetRow: sheetRow,
        sourceSecurityKey: proposed.sourceSecurityKey,
        symbol: proposed.symbol
      });
    });

    if (createRows.length) {
      var startRow = sheet.getLastRow() + 1;
      var values = createRows.map(function(row) {
        return boundedHoldingsPreviewApplyRowToSheetValues_(row, importRunRef, importedAt);
      });
      sheet.getRange(startRow, 1, values.length, BOUNDED_HOLDINGS_UNIFIED_HEADERS_.length).setValues(values);
      rollback.appends.push({ startRow: startRow, rowCount: values.length });
      createRows.forEach(function(row, index) {
        rowResults.push({
          action: 'CREATE',
          rowKey: row.rowKey,
          sheetRow: startRow + index,
          sourceSecurityKey: row.sourceSecurityKey,
          symbol: row.symbol
        });
      });
    }

    SpreadsheetApp.flush();
    boundedHoldingsPreviewApplyFormatUnifiedSheet_(sheet);
    return {
      ok: true,
      created: createRows.length,
      updated: updateRows.length,
      sheetCreated: !!ensure.created,
      importRunRef: importRunRef,
      rowResults: rowResults
    };
  } catch (writeErr) {
    boundedHoldingsPreviewApplyRollbackWrites_(sheet, rollback);
    throw writeErr;
  }
}
