/**
 * central_etrade_preview_lab.js — Admin-only E*TRADE Preview Lab (Central).
 *
 * Preview-only: CSV is processed in memory for the request. No workbook writes,
 * persistence, Cache/Properties/Drive retention, or production import paths.
 */

var ETRADE_PREVIEW_LAB_MAX_CSV_CHARS_ = 5000000;
var ETRADE_PREVIEW_LAB_MAX_TABLE_ROWS_ = 250;

function etradePreviewLabSafe_(fn) {
  try {
    return fn();
  } catch (e) {
    return {
      ok: false,
      error: (e && e.message) ? String(e.message) : String(e)
    };
  }
}

function assertEtradePreviewLabAllowed_() {
  assertAdmin_();
  if (!isCentralModeEnabled_()) {
    throw new Error('E*TRADE Preview Lab is available in Central mode only.');
  }
}

/**
 * Admin UI RPC: preview an uploaded E*TRADE Transactions CSV in memory.
 *
 * @param {{
 *   rawCsv?: string,
 *   source?: string,
 *   stableAccountId?: string,
 *   registrationType?: string,
 *   accountName?: string,
 *   usePackageFiles?: boolean
 * }} payload
 * @returns {Object}
 */
function adminUiEtradePreviewLabPreview(payload) {
  return etradePreviewLabSafe_(function() {
    assertEtradePreviewLabAllowed_();
    return etradePreviewLabBuildPreview_(payload || {});
  });
}

/**
 * Admin UI RPC: explicit clear/reset acknowledgement (no server-side state).
 *
 * @returns {{ok: boolean}}
 */
function adminUiEtradePreviewLabClear() {
  return etradePreviewLabSafe_(function() {
    assertEtradePreviewLabAllowed_();
    return { ok: true };
  });
}

function etradePreviewLabBuildPreview_(payload) {
  var rawCsv = String(payload.rawCsv || '');
  if (!rawCsv.trim()) {
    return { ok: false, error: 'CSV content is empty.' };
  }
  if (rawCsv.length > ETRADE_PREVIEW_LAB_MAX_CSV_CHARS_) {
    return {
      ok: false,
      error: 'CSV exceeds the maximum preview size (' +
        ETRADE_PREVIEW_LAB_MAX_CSV_CHARS_ + ' characters).'
    };
  }

  var source = investmentPortfolioNormalizeSource_(payload.source) || 'ETRADE_CSV';
  if (source !== 'ETRADE_CSV' && source !== 'ETRADE_PACKAGE') {
    return { ok: false, error: 'Unsupported preview source.' };
  }

  var accountMeta = {
    stableAccountId: String(payload.stableAccountId || '').trim(),
    registrationType: String(payload.registrationType || 'TAXABLE').trim() || 'TAXABLE',
    accountName: String(payload.accountName || '').trim()
  };

  var input = {
    source: source,
    accountMeta: accountMeta
  };
  if (source === 'ETRADE_PACKAGE' && payload.usePackageFiles) {
    input.files = [{ role: 'ACTIVITY', content: rawCsv }];
  } else {
    input.rawCsv = rawCsv;
  }

  var preview = (source === 'ETRADE_CSV')
    ? investmentAdapterPreviewEtradeCsv_(input)
    : investmentAdapterPreviewEtradePackage_(input);

  if (!preview || !preview.ok) {
    return {
      ok: false,
      error: (preview && preview.error) ? String(preview.error) : 'Preview failed.',
      reviewRequired: !!(preview && preview.reviewRequired),
      source: source
    };
  }

  return etradePreviewLabSanitizeResponse_(preview, {
    source: source,
    requestAccountMeta: accountMeta
  });
}

function etradePreviewLabSanitizeResponse_(preview, context) {
  var normalized = preview.normalized || {};
  var activities = normalized.activities || [];
  var aggregates = etradePreviewLabBuildAggregates_(normalized, preview);
  var tableRows = activities.slice(0, ETRADE_PREVIEW_LAB_MAX_TABLE_ROWS_).map(
    etradePreviewLabSanitizeActivityRow_
  );
  var unsupportedRows = (normalized.unsupportedRows || []).map(function(row) {
    return {
      rowIndex: row.rowIndex,
      reason: String(row.reason || row.error || 'UNSUPPORTED'),
      activityType: String(row.activityType || '')
    };
  });
  var warnings = (normalized.warnings || []).map(function(text) {
    return etradePreviewLabSanitizeWarningText_(text);
  });

  return {
    ok: true,
    reviewRequired: !!preview.reviewRequired,
    source: context.source,
    parserVersion: preview.parserVersion || normalized.parserVersion || '',
    aggregates: aggregates,
    requestAccountMeta: {
      stableAccountId: context.requestAccountMeta.stableAccountId,
      registrationType: context.requestAccountMeta.registrationType,
      accountName: context.requestAccountMeta.accountName
    },
    activityPreviewRows: tableRows,
    activityPreviewTruncated: activities.length > ETRADE_PREVIEW_LAB_MAX_TABLE_ROWS_,
    activityPreviewTotal: activities.length,
    unsupportedRows: unsupportedRows,
    warnings: warnings
  };
}

function etradePreviewLabBuildAggregates_(normalized, preview) {
  var activities = normalized.activities || [];
  var replaySummary = normalized.replaySummary || {};
  var intraFileSummary = normalized.intraFileSummary || {};
  var stableKeyAmbiguity = normalized.stableKeyAmbiguity || {};
  var dividendIncome = normalized.dividendIncome || {};
  var importSummary = normalized.importSummary || {};

  var sourceActivityTypeCounts = etradePreviewLabCountBy_(activities, 'etradeActivityType');
  var canonicalActivityTypeCounts = etradePreviewLabCountBy_(activities, 'activityType');
  var activitySubtypeCounts = etradePreviewLabCountBy_(activities, 'activitySubtype', true);

  var transferCounts = {
    transferIn: 0,
    transferOut: 0,
    contribution: 0,
    withdrawal: 0,
    onlineTransfer: 0
  };
  var exchangeCounts = {
    exchangeReceived: 0,
    exchangeDelivered: 0
  };
  var feeCount = 0;
  var feeNetTotal = 0;
  var feeGrossActivityTotal = 0;
  var feeDebitTotal = 0;
  var feeCreditTotal = 0;

  activities.forEach(function(activity) {
    var type = String(activity.activityType || '');
    var subtype = String(activity.activitySubtype || '');
    if (type === 'TRANSFER_IN') transferCounts.transferIn += 1;
    if (type === 'TRANSFER_OUT') transferCounts.transferOut += 1;
    if (type === 'CONTRIBUTION') transferCounts.contribution += 1;
    if (type === 'WITHDRAWAL') transferCounts.withdrawal += 1;
    if (subtype === 'ONLINE_TRANSFER') transferCounts.onlineTransfer += 1;
    if (subtype === 'EXCHANGE_RECEIVED') exchangeCounts.exchangeReceived += 1;
    if (subtype === 'EXCHANGE_DELIVERED') exchangeCounts.exchangeDelivered += 1;
    if (type === 'FEE') {
      feeCount += 1;
      var feeAmount = Number(activity.amount);
      if (!isFinite(feeAmount)) feeAmount = 0;
      feeNetTotal += feeAmount;
      feeGrossActivityTotal += Math.abs(feeAmount);
      if (feeAmount < 0) feeDebitTotal += feeAmount;
      if (feeAmount > 0) feeCreditTotal += feeAmount;
    }
  });

  return {
    ok: true,
    reviewRequired: !!preview.reviewRequired,
    acceptedActivityCount: activities.length,
    unsupportedRowCount: (normalized.unsupportedRows || []).length,
    warningCount: (normalized.warnings || []).length,
    sourceActivityTypeCounts: sourceActivityTypeCounts,
    canonicalActivityTypeCounts: canonicalActivityTypeCounts,
    activitySubtypeCounts: activitySubtypeCounts,
    exactReplayCount: Number(replaySummary.exactReplays) || 0,
    sourceCorrectionCount: Number(replaySummary.sourceCorrections) || 0,
    duplicateCount: (Number(intraFileSummary.exactDuplicates) || 0) +
      (Number(intraFileSummary.mutableDuplicates) || 0),
    stableKeyAmbiguityCount: Number(stableKeyAmbiguity.groups) || 0,
    conflictCount: (Number(replaySummary.conflicts) || 0) +
      (Number(intraFileSummary.conflicts) || 0),
    intraFileExactDuplicates: Number(intraFileSummary.exactDuplicates) || 0,
    intraFileMutableDuplicates: Number(intraFileSummary.mutableDuplicates) || 0,
    intraFileConflicts: Number(intraFileSummary.conflicts) || 0,
    transferCounts: transferCounts,
    exchangeCounts: exchangeCounts,
    dividendIncomeSummary: {
      cashDividendIncome: Number(dividendIncome.totalCashDividendIncome) || 0,
      reinvestmentCount: Object.keys(dividendIncome.reinvestGroups || {}).length,
      reinvestmentGroupCount: Object.keys(dividendIncome.reinvestGroups || {}).length
    },
    feeCount: feeCount,
    feeNetTotal: Math.round(feeNetTotal * 100) / 100,
    feeGrossActivityTotal: Math.round(feeGrossActivityTotal * 100) / 100,
    feeDebitTotal: Math.round(feeDebitTotal * 100) / 100,
    feeCreditTotal: Math.round(feeCreditTotal * 100) / 100,
    importSummaryAccepted: Number(importSummary.acceptedActivities) || activities.length,
    importSummaryExcluded: Number(importSummary.excludedActivities) ||
      (normalized.unsupportedRows || []).length
  };
}

function etradePreviewLabCountBy_(items, field, skipEmpty) {
  var counts = {};
  (items || []).forEach(function(item) {
    var value = String(item[field] || '').trim();
    if (skipEmpty && !value) return;
    var key = value || '(none)';
    counts[key] = (counts[key] || 0) + 1;
  });
  return counts;
}

function etradePreviewLabSanitizeActivityRow_(activity) {
  return {
    sourceRowIndex: activity.sourceRowIndex,
    activityDate: activity.activityDate || '',
    symbol: activity.ticker || activity.symbol || '',
    activityType: activity.activityType || '',
    activitySubtype: activity.activitySubtype || '',
    quantity: activity.quantity,
    amount: activity.amount,
    replayOutcome: activity.replayOutcome || '',
    intraFileOutcome: activity.intraFileOutcome || '',
    reviewRequired: !!activity.reviewRequired
  };
}

function etradePreviewLabSanitizeWarningText_(text) {
  return String(text || '')
    .replace(/REFID[:\s]+\d+/gi, 'REFID:***')
    .replace(/\b\d{4,}\b/g, '****');
}
