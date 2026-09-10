/**
 * robinhood_unified_migration_preview.js — Read-only Robinhood → Unified migration preview.
 *
 * Sources: SYS - Investment Activity (transaction ledger) and SYS - Investment Holdings
 * (activity-rebuilt aggregates). Never writes, migrates, deletes, or changes import behavior.
 * Does not use legacy Robinhood CSV text or a second holdings source of truth.
 */

var ROBINHOOD_UNIFIED_MIGRATION_PREVIEW_VERSION_ = 'ROBINHOOD_UNIFIED_MIGRATION_PREVIEW_V1';
var ROBINHOOD_UNIFIED_MIGRATION_PREVIEW_SOURCE_ = 'ROBINHOOD_CSV';
var ROBINHOOD_UNIFIED_MIGRATION_PREVIEW_PROVIDER_ = 'ROBINHOOD';
var ROBINHOOD_UNIFIED_MIGRATION_PREVIEW_IMPORT_STATUS_ = 'MIGRATION_PREVIEW';

function robinhoodUnifiedMigrationPreviewReadRobinhoodScope_(ss, options) {
  options = options || {};
  var filterId = String(options.investmentId || '').trim();
  var activitySheet = ss.getSheetByName(getSheetNames_().INVESTMENT_ACTIVITY);
  var investmentIds = Object.create(null);
  var activityCounts = Object.create(null);
  if (activitySheet && activitySheet.getLastRow() >= 2) {
    var lastRow = activitySheet.getLastRow();
    var width = INVESTMENT_ACTIVITY_HEADERS_.length;
    var display = activitySheet.getRange(2, 1, lastRow - 1, width).getDisplayValues();
    for (var i = 0; i < display.length; i += 1) {
      var source = String(display[i][12] || '').trim().toUpperCase();
      if (source !== ROBINHOOD_UNIFIED_MIGRATION_PREVIEW_SOURCE_) continue;
      var investmentId = String(display[i][1] || '').trim();
      if (!investmentId) continue;
      if (filterId && investmentId !== filterId) continue;
      investmentIds[investmentId] = true;
      activityCounts[investmentId] = Number(activityCounts[investmentId] || 0) + 1;
    }
  }
  return {
    investmentIds: Object.keys(investmentIds).sort(),
    activityCounts: activityCounts
  };
}

function robinhoodUnifiedMigrationPreviewReadLegacyHoldings_(ss, investmentId) {
  var wanted = String(investmentId || '').trim();
  if (!wanted) return [];
  var sheet = ss.getSheetByName(getSheetNames_().INVESTMENT_HOLDINGS);
  if (!sheet || sheet.getLastRow() < 2) return [];
  var lastRow = sheet.getLastRow();
  var width = INVESTMENT_HOLDINGS_HEADERS_.length;
  var display = sheet.getRange(2, 1, lastRow - 1, width).getDisplayValues();
  var values = sheet.getRange(2, 1, lastRow - 1, width).getValues();
  var rows = [];
  for (var i = 0; i < display.length; i += 1) {
    if (String(display[i][0] || '').trim() !== wanted) continue;
    rows.push({
      sheetRow: i + 2,
      investmentId: wanted,
      accountName: String(display[i][1] || '').trim(),
      asOfDate: String(display[i][2] || '').trim(),
      ticker: String(display[i][3] || '').trim().toUpperCase(),
      quantity: values[i][4],
      totalBuyCost: values[i][5],
      saleProceeds: values[i][6],
      dividendsReceived: values[i][7],
      weeklyRecurringBuy: values[i][8],
      lastActivityPrice: values[i][9],
      activityCount: values[i][10],
      updatedAt: String(display[i][11] || '').trim()
    });
  }
  return rows;
}

function robinhoodUnifiedMigrationPreviewSourceSecurityKey_(ticker) {
  var symbol = String(ticker || '').trim().toUpperCase();
  if (!symbol) return '';
  return 'TICKER:' + symbol;
}

function robinhoodUnifiedMigrationPreviewDocumentFingerprint_(scope) {
  scope = scope || {};
  return investmentPortfolioDigest_([
    'ROBINHOOD_ACTIVITY_RECON',
    String(scope.investmentId || ''),
    boundedHoldingsPreviewApplyNormalizeAsOfDate_(scope.asOfDate),
    String(scope.activityRowCount || 0),
    String(scope.holdingsRowCount || 0)
  ]);
}

function robinhoodUnifiedMigrationPreviewReadSourceLinks_(ss) {
  if (typeof cashImportReadSourceLinks_ === 'function') {
    return cashImportReadSourceLinks_(ss);
  }
  var sheet = ss.getSheetByName(getSheetNames_().ACCOUNT_SOURCE_LINKS);
  if (!sheet || sheet.getLastRow() < 2) return [];
  if (typeof financialIdentityAssertHeaders_ === 'function') {
    financialIdentityAssertHeaders_(sheet, ACCOUNT_SOURCE_LINK_HEADERS_);
  }
  var values = sheet.getRange(2, 1, sheet.getLastRow() - 1,
    ACCOUNT_SOURCE_LINK_HEADERS_.length).getDisplayValues();
  return values.filter(function(row) { return String(row[0] || '').trim(); }).map(function(row) {
    return {
      sourceLinkId: String(row[0] || '').trim(),
      stableAccountId: String(row[1] || '').trim(),
      sourceType: String(row[2] || '').trim(),
      sourceSystem: String(row[3] || '').trim(),
      sourceAccountKey: String(row[4] || '').trim().toLowerCase(),
      maskedIdentifier: String(row[5] || '').trim(),
      institution: String(row[6] || '').trim(),
      sourceAccountType: String(row[7] || '').trim(),
      linkStatus: String(row[8] || '').trim()
    };
  });
}

function robinhoodUnifiedMigrationPreviewAssessSourceLinkRequirement_(identityMapped, sourceLinks, investmentId) {
  identityMapped = identityMapped || {};
  sourceLinks = sourceLinks || [];
  var stableAccountId = String(identityMapped.suggestedStableAccountId || '').trim();
  var robinhoodLinks = sourceLinks.filter(function(link) {
    var system = String(link.sourceSystem || '').trim().toUpperCase();
    return system === 'ROBINHOOD' || system === 'ROBINHOOD_CSV';
  });
  var verifiedForStable = stableAccountId ? robinhoodLinks.filter(function(link) {
    return link.stableAccountId === stableAccountId &&
      String(link.linkStatus || '').trim().toUpperCase() === 'VERIFIED';
  }) : [];
  var verifiedForInvestment = robinhoodLinks.filter(function(link) {
    return String(link.sourceAccountKey || '').trim() === String(investmentId || '').trim().toLowerCase() &&
      String(link.linkStatus || '').trim().toUpperCase() === 'VERIFIED';
  });
  var verifiedCount = verifiedForStable.length + verifiedForInvestment.length;

  if (identityMapped.identityReady) {
    return {
      required: false,
      sufficient: true,
      status: 'NOT_REQUIRED',
      reason: verifiedCount ? 'VERIFIED_FINANCIAL_IDENTITY_WITH_OPTIONAL_SOURCE_LINK' :
        'VERIFIED_FINANCIAL_IDENTITY_SUFFICIENT',
      verifiedRobinhoodLinkCount: verifiedCount,
      message: 'Verified Financial Accounts identity is sufficient for this activity-reconstructed migration preview.'
    };
  }
  if (!String(investmentId || '').trim()) {
    return {
      required: true,
      sufficient: false,
      status: 'REQUIRED',
      reason: 'MISSING_INVESTMENT_ID',
      verifiedRobinhoodLinkCount: 0,
      message: 'Investment Id is required before migration preview can proceed.'
    };
  }
  if (verifiedForInvestment.length === 1 && verifiedForStable.length <= 1) {
    return {
      required: true,
      sufficient: true,
      status: 'NOT_REQUIRED',
      reason: 'VERIFIED_SOURCE_LINK_SUFFICIENT',
      verifiedRobinhoodLinkCount: verifiedCount,
      message: 'Verified Account Source Link satisfies identity for this Robinhood Investment Id.'
    };
  }
  if (verifiedCount > 1) {
    return {
      required: true,
      sufficient: false,
      status: 'REVIEW_REQUIRED',
      reason: 'AMBIGUOUS_VERIFIED_SOURCE_LINKS',
      verifiedRobinhoodLinkCount: verifiedCount,
      message: 'Multiple verified Robinhood source links match — review required. CashCompass will not auto-map ambiguous accounts.'
    };
  }
  return {
    required: true,
    sufficient: false,
    status: 'REQUIRED',
    reason: 'FINANCIAL_IDENTITY_OR_SOURCE_LINK_REVIEW_REQUIRED',
    verifiedRobinhoodLinkCount: verifiedCount,
    message: 'Financial identity must be verified or a verified Robinhood Account Source Link is required.'
  };
}

function robinhoodUnifiedMigrationPreviewBuildIdentityChecks_(
  accountRow, identityMapped, identityResolution, sourceLinkAssessment) {
  accountRow = accountRow || {};
  identityMapped = identityMapped || {};
  identityResolution = identityResolution || {};
  sourceLinkAssessment = sourceLinkAssessment || {};
  return {
    assets: {
      ok: !!accountRow && !!String(accountRow.investmentId || '').trim(),
      investmentIdPresent: !!String(accountRow.investmentId || '').trim(),
      accountActive: !!accountRow && accountRow.inactive !== true,
      sysAssetsRow: Number(accountRow.sysAssetsRow) || 0
    },
    financialAccounts: {
      ok: !!identityMapped.identityReady,
      identityReady: !!identityMapped.identityReady,
      identitySource: identityResolution.ok
        ? String(identityResolution.identitySource || '') : '',
      stableAccountIdPresent: !!String(identityMapped.suggestedStableAccountId || '').trim(),
      registrationType: String(identityMapped.suggestedRegistrationType || ''),
      message: String(identityMapped.identityMessage || '')
    },
    accountSourceLink: sourceLinkAssessment
  };
}

function robinhoodUnifiedMigrationPreviewBuildFieldMapping_(holding, scope, proposed) {
  holding = holding || {};
  scope = scope || {};
  proposed = proposed || {};
  return {
    source: ROBINHOOD_UNIFIED_MIGRATION_PREVIEW_SOURCE_,
    provider: ROBINHOOD_UNIFIED_MIGRATION_PREVIEW_PROVIDER_,
    parentCashCompassAccount: {
      from: 'SYS - Assets account name (legacy holdings row mirror)',
      mapped: !!String(scope.parentAccountName || '').trim()
    },
    investmentId: {
      from: 'SYS - Assets Investment Id',
      present: !!String(scope.investmentId || '').trim()
    },
    sourceSecurityKey: {
      from: 'Activity-reconstructed ticker identity',
      key: String(proposed.sourceSecurityKey || '')
    },
    symbol: String(proposed.symbol || holding.ticker || '').trim(),
    shares: {
      from: 'Legacy Quantity',
      value: boundedHoldingsPreviewApplyNullableNumber_(proposed.shares)
    },
    price: {
      from: 'Legacy Last Activity Price',
      value: boundedHoldingsPreviewApplyNullableNumber_(proposed.price)
    },
    marketValue: {
      from: 'Derived shares × price when both present',
      value: boundedHoldingsPreviewApplyNullableNumber_(proposed.marketValue)
    },
    costBasis: {
      from: 'Legacy Total Buy Cost (aggregate, not tax-lot authority)',
      value: boundedHoldingsPreviewApplyNullableNumber_(proposed.costBasis),
      quality: 'RECONSTRUCTED'
    },
    asOfDate: {
      from: 'Legacy As Of Date (latest activity date for account)',
      value: boundedHoldingsPreviewApplyNormalizeAsOfDate_(proposed.asOfDate)
    },
    provenance: {
      authority: 'CASHCOMPASS_RECONSTRUCTED',
      activitySourceSheet: getSheetNames_().INVESTMENT_ACTIVITY,
      legacyHoldingsSheet: getSheetNames_().INVESTMENT_HOLDINGS,
      documentFingerprintKind: 'ACTIVITY_RECON_DIGEST',
      importStatus: ROBINHOOD_UNIFIED_MIGRATION_PREVIEW_IMPORT_STATUS_,
      importRunReference: ROBINHOOD_UNIFIED_MIGRATION_PREVIEW_VERSION_
    }
  };
}

function robinhoodUnifiedMigrationPreviewDescribeConflict_(existing, proposed) {
  existing = existing || {};
  proposed = proposed || {};
  var reasons = [];
  if (boundedHoldingsPreviewApplyNormalizeAsOfDate_(existing.asOfDate) !==
      boundedHoldingsPreviewApplyNormalizeAsOfDate_(proposed.asOfDate)) {
    reasons.push('AS_OF_DATE_MISMATCH');
  }
  if (String(existing.investmentId || '') !== String(proposed.investmentId || '')) {
    reasons.push('INVESTMENT_ID_MISMATCH');
  }
  if (String(existing.sourceSecurityKey || '') !== String(proposed.sourceSecurityKey || '')) {
    reasons.push('SOURCE_SECURITY_KEY_MISMATCH');
  }
  if (boundedHoldingsPreviewApplyRowsMatchValues_(existing, proposed)) return reasons;
  if (round2_(Number(existing.shares)) !== round2_(Number(proposed.shares))) {
    reasons.push('QUANTITY_MISMATCH');
  }
  if (round2_(Number(existing.price)) !== round2_(Number(proposed.price))) {
    reasons.push('PRICE_MISMATCH');
  }
  if (round2_(Number(existing.marketValue)) !== round2_(Number(proposed.marketValue))) {
    reasons.push('MARKET_VALUE_MISMATCH');
  }
  if (round2_(Number(existing.costBasis)) !== round2_(Number(proposed.costBasis))) {
    reasons.push('COST_BASIS_MISMATCH');
  }
  if (String(existing.documentFingerprint || '') !== String(proposed.documentFingerprint || '')) {
    reasons.push('DOCUMENT_FINGERPRINT_MISMATCH');
  }
  if (!reasons.length) reasons.push('VALUE_MISMATCH');
  return reasons;
}

function robinhoodUnifiedMigrationPreviewResolveAction_(proposed, diff) {
  diff = diff || {};
  var rowKey = String(proposed.rowKey || '');
  var createMatch = (diff.create || []).some(function(row) { return row.rowKey === rowKey; });
  if (createMatch) return 'CREATE';
  var unchangedMatch = (diff.unchanged || []).some(function(entry) {
    return entry.proposed && entry.proposed.rowKey === rowKey;
  });
  if (unchangedMatch) return 'UNCHANGED';
  var updateMatch = (diff.update || []).some(function(entry) {
    return entry.proposed && entry.proposed.rowKey === rowKey;
  });
  if (updateMatch) return 'UPDATE';
  var conflictMatch = (diff.conflicts || []).some(function(entry) {
    return entry.proposed && entry.proposed.rowKey === rowKey;
  });
  if (conflictMatch) return 'CONFLICT';
  return 'CREATE';
}

function robinhoodUnifiedMigrationPreviewBuildHoldingPreview_(
  holding, scope, diff, existingByKey) {
  holding = holding || {};
  scope = scope || {};
  diff = diff || {};
  existingByKey = existingByKey || Object.create(null);
  var proposed = robinhoodUnifiedMigrationPreviewMapLegacyHolding_(holding, scope);
  var existing = existingByKey[proposed.rowKey] || null;
  var action = robinhoodUnifiedMigrationPreviewResolveAction_(proposed, diff);
  var conflictReasons = action === 'CONFLICT' && existing
    ? robinhoodUnifiedMigrationPreviewDescribeConflict_(existing, proposed) : [];
  return {
    ticker: String(holding.ticker || '').trim(),
    legacySheetRow: holding.sheetRow,
    legacySummary: {
      quantity: boundedHoldingsPreviewApplyNullableNumber_(holding.quantity),
      asOfDate: boundedHoldingsPreviewApplyNormalizeAsOfDate_(holding.asOfDate),
      activityCount: Number(holding.activityCount) || 0
    },
    targetUnified: typeof boundedHoldingsPreviewApplySanitizeDiffRowForClient_ === 'function'
      ? boundedHoldingsPreviewApplySanitizeDiffRowForClient_(proposed, 'PROPOSED')
      : {
        rowKey: proposed.rowKey,
        source: proposed.source,
        provider: proposed.provider,
        investmentId: proposed.investmentId,
        sourceSecurityKey: proposed.sourceSecurityKey,
        symbol: proposed.symbol,
        shares: proposed.shares,
        price: proposed.price,
        marketValue: proposed.marketValue,
        costBasis: proposed.costBasis,
        asOfDate: proposed.asOfDate,
        documentFingerprint: proposed.documentFingerprint
      },
    fieldMapping: robinhoodUnifiedMigrationPreviewBuildFieldMapping_(holding, scope, proposed),
    duplicateDetection: {
      rowKey: proposed.rowKey,
      existingUnifiedRowFound: !!existing,
      existingUnifiedSheetRow: existing ? existing.sheetRow : null
    },
    proposedAction: action,
    conflictReasons: conflictReasons
  };
}

function robinhoodUnifiedMigrationPreviewMapLegacyHolding_(holding, scope) {
  holding = holding || {};
  scope = scope || {};
  var shares = boundedHoldingsPreviewApplyNullableNumber_(holding.quantity);
  var price = boundedHoldingsPreviewApplyNullableNumber_(holding.lastActivityPrice);
  var marketValue = shares !== null && price !== null ? round2_(shares * price) : null;
  var row = {
    source: ROBINHOOD_UNIFIED_MIGRATION_PREVIEW_SOURCE_,
    provider: ROBINHOOD_UNIFIED_MIGRATION_PREVIEW_PROVIDER_,
    parentAccount: scope.parentAccountName,
    childPartition: '',
    investmentId: scope.investmentId,
    sourceSecurityKey: robinhoodUnifiedMigrationPreviewSourceSecurityKey_(holding.ticker),
    symbol: String(holding.ticker || '').trim(),
    securityName: String(holding.ticker || '').trim(),
    shares: shares,
    price: price,
    marketValue: marketValue,
    costBasis: boundedHoldingsPreviewApplyNullableNumber_(holding.totalBuyCost),
    unrealizedGainLoss: '',
    cashBalance: '',
    asOfDate: boundedHoldingsPreviewApplyNormalizeAsOfDate_(holding.asOfDate),
    documentFingerprint: scope.documentFingerprint,
    importStatus: ROBINHOOD_UNIFIED_MIGRATION_PREVIEW_IMPORT_STATUS_,
    importRunRef: ROBINHOOD_UNIFIED_MIGRATION_PREVIEW_VERSION_,
    recognitionLabel: ''
  };
  return boundedHoldingsPreviewApplyFinalizeProposedRow_(row);
}

function robinhoodUnifiedMigrationPreviewBuildAccountPreview_(ss, investmentId, context) {
  context = context || {};
  var activityRowCount = Number((context.activityCounts || {})[investmentId] || 0);
  var accountRow = (context.activeAccounts || []).filter(function(row) {
    return String(row.investmentId || '').trim() === investmentId;
  })[0] || null;
  var legacyHoldings = robinhoodUnifiedMigrationPreviewReadLegacyHoldings_(ss, investmentId);
  var tickers = Object.create(null);
  legacyHoldings.forEach(function(row) {
    if (row.ticker) tickers[row.ticker] = true;
  });
  var asOfDate = legacyHoldings.reduce(function(latest, row) {
    var normalized = boundedHoldingsPreviewApplyNormalizeAsOfDate_(row.asOfDate);
    return normalized > latest ? normalized : latest;
  }, '');
  var identityResolution = accountRow && typeof monthlyCheckinResolveAccountKey_ === 'function'
    ? monthlyCheckinResolveAccountKey_({
      domain: 'investment',
      investmentId: accountRow.investmentId,
      displayName: accountRow.accountName,
      registryIndex: context.registryIndex,
      investmentLifecycleCounts: context.lifecycleCounts
    })
    : { ok: false, message: 'Investment account is not active in SYS - Assets.' };
  var identityMapped = accountRow
    ? boundedHoldingsPreviewMapAccountRow_(
      accountRow, context.registryIndex, context.lifecycleCounts)
    : {
      identityReady: false,
      identityMessage: String(identityResolution.message || ''),
      suggestedStableAccountId: '',
      suggestedRegistrationType: ''
    };
  var sourceLinkAssessment = robinhoodUnifiedMigrationPreviewAssessSourceLinkRequirement_(
    identityMapped, context.sourceLinks, investmentId);
  var identityChecks = robinhoodUnifiedMigrationPreviewBuildIdentityChecks_(
    accountRow, identityMapped, identityResolution, sourceLinkAssessment);
  var scope = {
    investmentId: investmentId,
    parentAccountName: accountRow ? accountRow.accountName :
      (legacyHoldings[0] ? legacyHoldings[0].accountName : ''),
    asOfDate: asOfDate,
    activityRowCount: activityRowCount,
    holdingsRowCount: legacyHoldings.length,
    documentFingerprint: ''
  };
  scope.documentFingerprint = robinhoodUnifiedMigrationPreviewDocumentFingerprint_(scope);
  var proposedRows = legacyHoldings.map(function(holding) {
    return robinhoodUnifiedMigrationPreviewMapLegacyHolding_(holding, scope);
  });
  var existingRows = typeof boundedHoldingsPreviewApplyReadExistingRows_ === 'function'
    ? boundedHoldingsPreviewApplyReadExistingRows_(ss) : [];
  var existingByKey = Object.create(null);
  existingRows.forEach(function(row) {
    existingByKey[row.rowKey] = row;
  });
  var diff = typeof boundedHoldingsPreviewApplyBuildDiff_ === 'function'
    ? boundedHoldingsPreviewApplyBuildDiff_(existingRows, proposedRows)
    : {
      create: proposedRows,
      update: [],
      unchanged: [],
      conflicts: [],
      summary: {
        createCount: proposedRows.length,
        updateCount: 0,
        unchangedCount: 0,
        conflictCount: 0,
        proposedCount: proposedRows.length
      }
    };
  var holdings = legacyHoldings.map(function(holding) {
    return robinhoodUnifiedMigrationPreviewBuildHoldingPreview_(
      holding, scope, diff, existingByKey);
  });
  var identityBlocked = !identityChecks.assets.ok ||
    (!identityChecks.financialAccounts.ok && !sourceLinkAssessment.sufficient);
  return {
    investmentId: investmentId,
    activityRowCount: activityRowCount,
    legacyHoldingsRowCount: legacyHoldings.length,
    legacyTickerCount: Object.keys(tickers).length,
    identityChecks: identityChecks,
    identityBlocked: identityBlocked,
    diffSummary: diff.summary,
    diffBlocked: !!diff.blocked,
    diffBlockReason: diff.blockReason || '',
    holdings: holdings
  };
}

function robinhoodUnifiedMigrationPreviewAggregateSummary_(accounts) {
  accounts = accounts || [];
  var summary = {
    accountCount: accounts.length,
    legacyHoldingsRowCount: 0,
    legacyTickerCount: 0,
    proposedCount: 0,
    createCount: 0,
    updateCount: 0,
    unchangedCount: 0,
    conflictCount: 0,
    identityBlockedAccountCount: 0
  };
  accounts.forEach(function(account) {
    summary.legacyHoldingsRowCount += Number(account.legacyHoldingsRowCount || 0);
    summary.legacyTickerCount += Number(account.legacyTickerCount || 0);
    var diffSummary = account.diffSummary || {};
    summary.proposedCount += Number(diffSummary.proposedCount || 0);
    summary.createCount += Number(diffSummary.createCount || 0);
    summary.updateCount += Number(diffSummary.updateCount || 0);
    summary.unchangedCount += Number(diffSummary.unchangedCount || 0);
    summary.conflictCount += Number(diffSummary.conflictCount || 0);
    if (account.identityBlocked) summary.identityBlockedAccountCount += 1;
  });
  return summary;
}

function robinhoodUnifiedMigrationPreviewSanitizedLogSummary_(preview) {
  preview = preview || {};
  return {
    ok: preview.ok,
    previewVersion: preview.previewVersion,
    readOnly: preview.readOnly,
    summary: preview.summary,
    accountCount: (preview.accounts || []).length,
    safety: preview.safety
  };
}

/**
 * Read-only Robinhood → Unified migration preview for an explicit spreadsheet handle.
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss
 * @param {Object=} options optional { investmentId }
 */
function buildRobinhoodUnifiedMigrationPreview_(ss, options) {
  options = options || {};
  if (!ss) {
    return {
      ok: false,
      readOnly: true,
      previewOnly: true,
      previewVersion: ROBINHOOD_UNIFIED_MIGRATION_PREVIEW_VERSION_,
      error: 'Spreadsheet handle is required.'
    };
  }
  var scope = robinhoodUnifiedMigrationPreviewReadRobinhoodScope_(ss, options);
  if (!scope.investmentIds.length) {
    return {
      ok: true,
      readOnly: true,
      previewOnly: true,
      previewVersion: ROBINHOOD_UNIFIED_MIGRATION_PREVIEW_VERSION_,
      sources: {
        activitySheet: getSheetNames_().INVESTMENT_ACTIVITY,
        legacyHoldingsSheet: getSheetNames_().INVESTMENT_HOLDINGS,
        unifiedTargetSheet: getSheetNames_().INVESTMENT_HOLDINGS_UNIFIED
      },
      accounts: [],
      summary: robinhoodUnifiedMigrationPreviewAggregateSummary_([]),
      safety: {
        noWrites: true,
        noMigration: true,
        noImportBehaviorChange: true,
        legacyHoldingsPreserved: true,
        activitySourcePreserved: true,
        sensitiveValuesRedacted: true
      },
      message: 'No Robinhood activity rows found for migration preview scope.'
    };
  }

  var context = {
    activityCounts: scope.activityCounts,
    activeAccounts: typeof boundedHoldingsPreviewReadActiveInvestmentAccounts_ === 'function'
      ? boundedHoldingsPreviewReadActiveInvestmentAccounts_(ss) : [],
    registryIndex: typeof monthlyCheckinReadRegistryIndex_ === 'function'
      ? monthlyCheckinReadRegistryIndex_(ss) : { byStableId: {}, byLegacy: {} },
    lifecycleCounts: typeof boundedHoldingsPreviewInvestmentLifecycleCounts_ === 'function'
      ? boundedHoldingsPreviewInvestmentLifecycleCounts_(
        typeof boundedHoldingsPreviewReadActiveInvestmentAccounts_ === 'function'
          ? boundedHoldingsPreviewReadActiveInvestmentAccounts_(ss) : [])
      : Object.create(null),
    sourceLinks: robinhoodUnifiedMigrationPreviewReadSourceLinks_(ss)
  };
  var accounts = scope.investmentIds.map(function(investmentId) {
    return robinhoodUnifiedMigrationPreviewBuildAccountPreview_(ss, investmentId, context);
  });
  var summary = robinhoodUnifiedMigrationPreviewAggregateSummary_(accounts);
  return {
    ok: true,
    readOnly: true,
    previewOnly: true,
    previewVersion: ROBINHOOD_UNIFIED_MIGRATION_PREVIEW_VERSION_,
    sources: {
      activitySheet: getSheetNames_().INVESTMENT_ACTIVITY,
      legacyHoldingsSheet: getSheetNames_().INVESTMENT_HOLDINGS,
      unifiedTargetSheet: getSheetNames_().INVESTMENT_HOLDINGS_UNIFIED
    },
    accounts: accounts,
    summary: summary,
    safety: {
      noWrites: true,
      noMigration: true,
      noImportBehaviorChange: true,
      legacyHoldingsPreserved: true,
      activitySourcePreserved: true,
      sensitiveValuesRedacted: true
    }
  };
}

/** Admin-gated migration preview — logs compact summary only (no raw CSV or account names). */
function adminGetRobinhoodUnifiedMigrationPreview(options) {
  assertAdmin_();
  var preview = buildRobinhoodUnifiedMigrationPreview_(getUserSpreadsheet_(), options || {});
  Logger.log(JSON.stringify(robinhoodUnifiedMigrationPreviewSanitizedLogSummary_(preview), null, 2));
  return preview;
}

/** Admin UI wrapper — same payload without execution logging. */
function adminUiGetRobinhoodUnifiedMigrationPreview(options) {
  assertAdmin_();
  try {
    return buildRobinhoodUnifiedMigrationPreview_(getUserSpreadsheet_(), options || {});
  } catch (err) {
    return {
      ok: false,
      readOnly: true,
      previewOnly: true,
      previewVersion: ROBINHOOD_UNIFIED_MIGRATION_PREVIEW_VERSION_,
      error: String(err && err.message ? err.message : err)
    };
  }
}
