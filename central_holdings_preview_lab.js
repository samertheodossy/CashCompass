/**
 * central_holdings_preview_lab.js — Admin-only Portfolio Intelligence Holdings Preview Lab (Central).
 *
 * Preview-only unified holdings for ETRADE_POSITIONS_PDF, ETRADE_CLIENT_STATEMENT_PDF,
 * and M1_STATEMENT_PDF.
 * No workbook writes, persistence, or production import paths.
 */

var HOLDINGS_PREVIEW_LAB_MAX_TEXT_CHARS_ = 5000000;
var HOLDINGS_PREVIEW_LAB_MAX_HOLDINGS_ROWS_ = 250;
var HOLDINGS_PREVIEW_LAB_SUPPORTED_SOURCES_ = {
  ETRADE_POSITIONS_PDF: true,
  ETRADE_CLIENT_STATEMENT_PDF: true,
  M1_STATEMENT_PDF: true
};

function holdingsPreviewLabSafe_(fn) {
  try {
    return fn();
  } catch (e) {
    return {
      ok: false,
      error: (e && e.message) ? String(e.message) : String(e)
    };
  }
}

function assertHoldingsPreviewLabAllowed_() {
  assertAdmin_();
  if (!isCentralModeEnabled_()) {
    throw new Error('Holdings Preview Lab is available in Central mode only.');
  }
}

/**
 * Admin UI RPC: preview one statement/PDF text extract in memory.
 *
 * @param {{
 *   source?: string,
 *   rawDocumentText?: string,
 *   stableAccountId?: string,
 *   accountName?: string,
 *   registrationType?: string,
 *   explicitAccountMatch?: boolean
 * }} payload
 * @returns {Object}
 */
function adminUiHoldingsPreviewLabPreview(payload) {
  return holdingsPreviewLabSafe_(function() {
    assertHoldingsPreviewLabAllowed_();
    return holdingsPreviewLabBuildPreview_(payload || {});
  });
}

/**
 * Admin UI RPC: aggregate sanitized in-session previews (no raw document text).
 *
 * @param {{ sessionPreviews?: Object[] }} payload
 * @returns {Object}
 */
function adminUiHoldingsPreviewLabAggregateSession(payload) {
  return holdingsPreviewLabSafe_(function() {
    assertHoldingsPreviewLabAllowed_();
    var items = payload && payload.sessionPreviews;
    if (!Array.isArray(items) || !items.length) {
      return { ok: false, error: 'At least one in-session preview is required.' };
    }
    return {
      ok: true,
      aggregate: holdingsPreviewLabAggregateSessionPreviews_(items)
    };
  });
}

/**
 * Admin UI RPC: explicit clear acknowledgement (no server-side state).
 *
 * @returns {{ok: boolean}}
 */
function adminUiHoldingsPreviewLabClear() {
  return holdingsPreviewLabSafe_(function() {
    assertHoldingsPreviewLabAllowed_();
    return { ok: true };
  });
}

function holdingsPreviewLabValidateSource_(source) {
  var normalized = investmentPortfolioNormalizeSource_(source);
  if (!HOLDINGS_PREVIEW_LAB_SUPPORTED_SOURCES_[normalized]) {
    return { ok: false, error: 'Unsupported preview source.' };
  }
  return { ok: true, source: normalized };
}

function holdingsPreviewLabValidateIdentityInput_(payload) {
  var stableAccountId = String(payload.stableAccountId || '').trim();
  var registrationTypeRaw = String(payload.registrationType || '').trim();
  var registrationType = registrationTypeRaw
    ? investmentPortfolioNormalizeRegistrationType_(registrationTypeRaw)
    : '';
  var accountName = String(payload.accountName || '').trim();
  var explicitAccountMatch = payload.explicitAccountMatch === true;

  if (!stableAccountId) {
    return { ok: false, error: 'stableAccountId is required.' };
  }
  if (/^X{2,}\d+$/i.test(stableAccountId) || /^XXXX/i.test(stableAccountId)) {
    return {
      ok: false,
      error: 'Masked account numbers cannot be used as stableAccountId.'
    };
  }
  if (!registrationType) {
    return { ok: false, error: 'registrationType is required.' };
  }
  if (!accountName) {
    return { ok: false, error: 'Account display name is required.' };
  }
  if (!explicitAccountMatch) {
    return {
      ok: false,
      error: 'Explicit account-match confirmation is required.'
    };
  }
  return {
    ok: true,
    stableAccountId: stableAccountId,
    registrationType: registrationType,
    accountName: accountName,
    explicitAccountMatch: true
  };
}

function holdingsPreviewLabBuildPreview_(payload) {
  var sourceResult = holdingsPreviewLabValidateSource_(payload.source);
  if (!sourceResult.ok) return sourceResult;

  var identity = holdingsPreviewLabValidateIdentityInput_(payload);
  if (!identity.ok) return identity;

  var rawText = String(payload.rawDocumentText || '').trim();
  if (!rawText) {
    return { ok: false, error: 'PDF text extract content is required.' };
  }
  if (rawText.length > HOLDINGS_PREVIEW_LAB_MAX_TEXT_CHARS_) {
    return {
      ok: false,
      error: 'Document text exceeds the maximum preview size (' +
        HOLDINGS_PREVIEW_LAB_MAX_TEXT_CHARS_ + ' characters).'
    };
  }

  var input = {
    source: sourceResult.source,
    explicitAccountMatch: true,
    accountMeta: {
      stableAccountId: identity.stableAccountId,
      registrationType: identity.registrationType,
      accountName: identity.accountName,
      explicitAccountMatch: true
    }
  };
  if (payload.extractionMeta) {
    input.extractionMeta = payload.extractionMeta;
  }
  if (payload.documentFingerprint) {
    input.documentFingerprint = payload.documentFingerprint;
  }
  if (sourceResult.source === 'ETRADE_POSITIONS_PDF') {
    if (typeof investmentEtradeClientStatementClassifyDocumentType_ === 'function') {
      var docClass = investmentEtradeClientStatementClassifyDocumentType_(rawText);
      if (docClass.documentType === 'ETRADE_CLIENT_STATEMENT_PDF') {
        return {
          ok: false,
          error: 'Document matches an E*TRADE monthly client statement. Select ETRADE_CLIENT_STATEMENT_PDF source.',
          source: sourceResult.source
        };
      }
    }
    if (typeof investmentEtradeClientStatementAssessTextQuality_ === 'function') {
      var corruptQuality = investmentEtradeClientStatementAssessTextQuality_(rawText);
      if (corruptQuality.quality === 'ENCODING_FAILURE') {
        return {
          ok: false,
          error: 'Extracted PDF text is encoding-corrupt and cannot be parsed as Expanded Positions.',
          source: sourceResult.source
        };
      }
    }
    input.rawPositionsText = rawText;
  } else {
    input.rawStatementText = rawText;
  }

  var preview;
  if (sourceResult.source === 'ETRADE_POSITIONS_PDF') {
    preview = investmentAdapterPreviewEtradePositionsPdf_(input);
  } else if (sourceResult.source === 'ETRADE_CLIENT_STATEMENT_PDF') {
    preview = investmentAdapterPreviewEtradeClientStatementPdf_(input);
  } else {
    if (typeof investmentEtradeClientStatementClassifyDocumentType_ === 'function') {
      var m1DocClass = investmentEtradeClientStatementClassifyDocumentType_(rawText);
      if (m1DocClass.documentType === 'ETRADE_CLIENT_STATEMENT_PDF') {
        return {
          ok: false,
          error: 'Document matches an E*TRADE monthly client statement. Select ETRADE_CLIENT_STATEMENT_PDF source.',
          source: sourceResult.source
        };
      }
    }
    if (typeof investmentEtradeClientStatementAssessTextQuality_ === 'function') {
      var m1CorruptQuality = investmentEtradeClientStatementAssessTextQuality_(rawText);
      if (m1CorruptQuality.quality === 'ENCODING_FAILURE') {
        return {
          ok: false,
          error: 'Extracted PDF text is encoding-corrupt. E*TRADE monthly client statement PDF is not currently supported for direct import.',
          source: sourceResult.source
        };
      }
    }
    preview = investmentAdapterPreviewM1StatementPdf_(input);
  }

  if (!preview || !preview.ok) {
    return {
      ok: false,
      error: (preview && preview.error) ? String(preview.error) : 'Preview failed.',
      reviewRequired: !!(preview && preview.reviewRequired),
      source: sourceResult.source,
      matchStatus: preview && preview.matchStatus
    };
  }

  return holdingsPreviewLabSanitizePreviewResponse_(preview, identity, sourceResult.source);
}

function holdingsPreviewLabSanitizePreviewResponse_(preview, identity, source) {
  var normalized = preview.normalized || {};
  var account = (normalized.accounts || [])[0] || {};
  var snapshot = (normalized.accountSnapshots || [])[0] || {};
  var holdingsRows = holdingsPreviewLabSanitizeHoldingsRows_(normalized);
  var truncated = holdingsRows.length > HOLDINGS_PREVIEW_LAB_MAX_HOLDINGS_ROWS_;
  if (truncated) {
    holdingsRows = holdingsRows.slice(0, HOLDINGS_PREVIEW_LAB_MAX_HOLDINGS_ROWS_);
  }

  var cashBalance = holdingsPreviewLabNullableNumber_(snapshot.cashBalance);
  if (cashBalance === null && normalized.holdings && normalized.holdings.length === 0) {
    cashBalance = holdingsPreviewLabNullableNumber_(snapshot.marketValue);
  }
  var totalAccountValue = holdingsPreviewLabNullableNumber_(snapshot.marketValue);
  if (totalAccountValue === null) {
    totalAccountValue = holdingsPreviewLabSumMarketValues_(holdingsRows, cashBalance);
  }

  var readiness = normalized.recommendationReadiness || {};
  var capabilities = normalized.capabilities || preview.capabilities || {};
  var warnings = (normalized.warnings || []).map(holdingsPreviewLabSanitizeWarningText_);
  var unavailableFields = holdingsPreviewLabCollectUnavailableFields_(normalized, capabilities);
  var analysis = holdingsPreviewLabBuildAccountAnalysis_(holdingsRows, cashBalance, totalAccountValue);
  analysis.readinessObservations = holdingsPreviewLabBuildReadinessObservations_(
    readiness, capabilities, normalized);
  var statementMeta = normalized.statementParseMeta || {};
  var reconciliation = statementMeta.reconciliation || null;
  var extraction = statementMeta.extraction || null;

  return {
    ok: true,
    reviewRequired: !!preview.reviewRequired ||
      !readiness.trustedForHoldingsVisibility,
    source: source,
    provider: source === 'ETRADE_CLIENT_STATEMENT_PDF' ? 'ETRADE' : '',
    parserVersion: preview.parserVersion || normalized.parserVersion || '',
    contractVersion: normalized.contractVersion || '',
    schemaVersion: normalized.schemaVersion || '',
    account: {
      stableAccountId: String(account.stableAccountId || identity.stableAccountId),
      displayName: String(account.displayName || identity.accountName),
      registrationType: String(account.registrationType || identity.registrationType),
      matchStatus: String(account.matchStatus || ''),
      institution: String(account.institution || ''),
      taxStatus: String(account.taxStatus || '')
    },
    asOf: String(normalized.asOf || snapshot.asOf || snapshot.sourceAsOf || ''),
    totalAccountValue: totalAccountValue,
    cashBalance: cashBalance,
    holdingsRows: holdingsRows,
    holdingsTruncated: truncated,
    holdingsTotal: (normalized.holdings || []).length,
    readiness: {
      trustedForHoldingsVisibility: !!readiness.trustedForHoldingsVisibility,
      trustedForIncomeAnalysis: !!readiness.trustedForIncomeAnalysis,
      trustedForTaxLotSalePlanning: !!readiness.trustedForTaxLotSalePlanning,
      blockingReasons: (readiness.blockingReasons || []).slice()
    },
    capabilities: {
      activities: !!capabilities.activities,
      holdings: !!capabilities.holdings,
      taxLots: !!capabilities.taxLots,
      accountSnapshot: !!capabilities.accountSnapshot,
      dividendHistory: !!capabilities.dividendHistory,
      realizedGainLoss: !!capabilities.realizedGainLoss
    },
    warnings: warnings,
    unavailableFields: unavailableFields,
    analysis: analysis,
    extraction: extraction,
    reconciliation: reconciliation ? {
      ok: !!reconciliation.ok,
      rule: String(reconciliation.rule || ''),
      computedBase: holdingsPreviewLabNullableNumber_(reconciliation.computedBase),
      computedTotal: holdingsPreviewLabNullableNumber_(reconciliation.computedTotal),
      endingTotalValue: holdingsPreviewLabNullableNumber_(reconciliation.endingTotalValue),
      holdingsMarketValueSum: holdingsPreviewLabNullableNumber_(reconciliation.holdingsMarketValueSum),
      cashBalance: holdingsPreviewLabNullableNumber_(reconciliation.cashBalance),
      accruedInterest: holdingsPreviewLabNullableNumber_(reconciliation.accruedInterest),
      grossDifference: holdingsPreviewLabNullableNumber_(reconciliation.grossDifference),
      difference: holdingsPreviewLabNullableNumber_(reconciliation.difference),
      unexplainedDifference: holdingsPreviewLabNullableNumber_(reconciliation.unexplainedDifference),
      tolerance: holdingsPreviewLabNullableNumber_(reconciliation.tolerance),
      blockingReason: String(reconciliation.blockingReason || '')
    } : null,
    documentFingerprint: String(
      (normalized.statementParseMeta && normalized.statementParseMeta.documentFingerprint) || ''
    ).trim(),
    accountKind: String(statementMeta.accountKind || '')
  };
}

function holdingsPreviewLabSanitizeHoldingsRows_(normalized) {
  var securitiesById = {};
  (normalized.securities || []).forEach(function(sec) {
    securitiesById[String(sec.stableSecurityId || '')] = sec;
  });
  return (normalized.holdings || []).map(function(row) {
    var sec = securitiesById[String(row.stableSecurityId || '')] || {};
    var unavailable = [];
    if (row.providerCostBasis === null || typeof row.providerCostBasis === 'undefined') {
      unavailable.push('costBasis');
    }
    if (row.unrealizedGainLoss === null || typeof row.unrealizedGainLoss === 'undefined') {
      unavailable.push('unrealizedGainLoss');
    }
    if (row.price === null || typeof row.price === 'undefined') {
      unavailable.push('price');
    }
    return {
      sourceSecurityKey: String(sec.sourceSecurityKey || ''),
      symbol: String(row.ticker || sec.ticker || ''),
      description: String(sec.securityName || ''),
      shareClass: String(sec.shareClass || ''),
      exchange: String(sec.exchange || ''),
      quantity: row.shares,
      price: row.price,
      marketValue: row.marketValue,
      costBasis: row.providerCostBasis,
      unrealizedGainLoss: row.unrealizedGainLoss,
      unavailableFields: unavailable
    };
  });
}

function holdingsPreviewLabCollectUnavailableFields_(normalized, capabilities) {
  var unavailable = [];
  if (!capabilities.holdings) unavailable.push('holdings');
  if (!capabilities.accountSnapshot) unavailable.push('accountSnapshot');
  if (!capabilities.taxLots) unavailable.push('taxLots');
  if (!capabilities.dividendHistory) unavailable.push('dividendHistory');
  if (!capabilities.realizedGainLoss) unavailable.push('realizedGainLoss');
  if (!capabilities.activities) unavailable.push('activities');
  if (!(normalized.distributions || []).length) unavailable.push('classifiedDistributions');
  return unavailable;
}

function holdingsPreviewLabBuildReadinessObservations_(readiness, capabilities, normalized) {
  readiness = readiness || {};
  capabilities = capabilities || {};
  normalized = normalized || {};
  var observations = [];
  if (!readiness.trustedForHoldingsVisibility) {
    observations.push(
      'Holdings visibility is not ready because account identity or source data is incomplete.');
  }
  if (!readiness.trustedForIncomeAnalysis) {
    observations.push(
      'Income analysis is not ready because classified distribution data is absent.');
  }
  if (!readiness.trustedForTaxLotSalePlanning) {
    observations.push(
      'Tax-lot sale planning is not ready because open-lot detail is unavailable or incomplete.');
  }
  if (capabilities.realizedGainLoss === false) {
    observations.push('Realized gain/loss activity is unavailable in this document.');
  }
  if (!(normalized.activities || []).length && capabilities.activities === false) {
    observations.push('Account activity is unavailable in this document.');
  }
  return observations;
}

function holdingsPreviewLabRoundPercent_(value) {
  return Math.round(Number(value) * 100) / 100;
}

function holdingsPreviewLabNullableNumber_(value) {
  if (value === null || typeof value === 'undefined' || value === '') return null;
  var num = Number(value);
  return isFinite(num) ? Math.round(num * 100) / 100 : null;
}

function holdingsPreviewLabSumMarketValues_(holdingsRows, cashBalance) {
  var total = isFinite(Number(cashBalance)) ? Number(cashBalance) : 0;
  (holdingsRows || []).forEach(function(row) {
    var mv = Number(row.marketValue);
    if (isFinite(mv)) total += mv;
  });
  return total > 0 ? Math.round(total * 100) / 100 : null;
}

function holdingsPreviewLabBuildAccountAnalysis_(holdingsRows, cashBalance, totalAccountValue) {
  holdingsRows = holdingsRows || [];
  var cash = isFinite(Number(cashBalance)) ? Number(cashBalance) : 0;
  var securitiesValue = 0;
  holdingsRows.forEach(function(row) {
    var mv = Number(row.marketValue);
    if (isFinite(mv)) securitiesValue += mv;
  });
  var holdingsPlusCash = securitiesValue + cash;
  var reportedTotal = isFinite(Number(totalAccountValue)) ? Number(totalAccountValue) : 0;
  var total = holdingsPlusCash;
  if (reportedTotal > 0 && reportedTotal <= holdingsPlusCash * 1.10) {
    total = reportedTotal;
  } else if (!holdingsPlusCash && reportedTotal > 0) {
    total = reportedTotal;
  }
  if (!(total > 0)) total = holdingsPlusCash || reportedTotal;

  var allocationByHolding = holdingsRows.map(function(row) {
    var mv = Number(row.marketValue);
    if (!isFinite(mv)) mv = 0;
    var pct = total > 0 ? holdingsPreviewLabRoundPercent_((mv / total) * 100) : 0;
    return {
      symbol: row.symbol,
      label: row.symbol || row.sourceSecurityKey || '(holding)',
      marketValue: Math.round(mv * 100) / 100,
      percent: pct
    };
  }).sort(function(a, b) { return b.percent - a.percent; });

  var cashPercent = total > 0 ? holdingsPreviewLabRoundPercent_((cash / total) * 100) : 0;
  var concentrationObservations = [];
  if (allocationByHolding.length && allocationByHolding[0].percent >= 25) {
    concentrationObservations.push(
      'Largest holding represents ' + allocationByHolding[0].percent + '% of this preview.');
  }
  if (cash > 0 && total > 0) {
    concentrationObservations.push('Cash represents ' + cashPercent + '% of this preview.');
  }

  var symbolCounts = {};
  holdingsRows.forEach(function(row) {
    var sym = String(row.symbol || '').trim().toUpperCase();
    if (!sym) return;
    symbolCounts[sym] = (symbolCounts[sym] || 0) + 1;
  });
  var repeatedSymbolObservations = [];
  Object.keys(symbolCounts).sort().forEach(function(sym) {
    if (symbolCounts[sym] > 1) {
      repeatedSymbolObservations.push('This symbol appears more than once in the preview.');
    }
  });

  return {
    totalPreviewValue: Math.round((reportedTotal > 0 ? reportedTotal : total) * 100) / 100,
    parsedScopeTotal: Math.round(total * 100) / 100,
    cashBalance: Math.round(cash * 100) / 100,
    cashPercent: cashPercent,
    allocationByHolding: allocationByHolding,
    topFiveHoldings: allocationByHolding.slice(0, 5),
    concentrationObservations: concentrationObservations,
    repeatedSymbolObservations: repeatedSymbolObservations
  };
}

function holdingsPreviewLabAggregateSessionPreviews_(items) {
  var seenAccountKeys = Object.create(null);
  var totalPreviewedValue = 0;
  var totalCash = 0;
  var accountAllocations = [];
  var symbolTotals = Object.create(null);
  var crossAccountSymbols = Object.create(null);
  var allHoldings = [];

  (items || []).forEach(function(item) {
    var account = item.account || {};
    var stableAccountId = String(account.stableAccountId || '').trim();
    var source = String(item.source || '').trim();
    var sessionKey = stableAccountId + '|' + source;
    if (!stableAccountId || !source) {
      throw new Error('Each session preview must include stableAccountId and source.');
    }
    if (seenAccountKeys[sessionKey]) {
      throw new Error('Duplicate preview session for the same account identity.');
    }
    seenAccountKeys[sessionKey] = true;

    var analysis = item.analysis || {};
    var accountValue = Number(analysis.totalPreviewValue);
    if (!isFinite(accountValue)) accountValue = 0;
    var cash = Number(item.cashBalance);
    if (!isFinite(cash)) cash = 0;
    totalPreviewedValue += accountValue;
    totalCash += cash;

    accountAllocations.push({
      stableAccountId: stableAccountId,
      source: source,
      displayName: String(account.displayName || ''),
      totalValue: Math.round(accountValue * 100) / 100,
      cashBalance: Math.round(cash * 100) / 100,
      percentOfSession: 0
    });

    (item.holdingsRows || []).forEach(function(row) {
      var sym = String(row.symbol || '').trim().toUpperCase();
      var mv = Number(row.marketValue);
      if (!isFinite(mv)) mv = 0;
      allHoldings.push({
        stableAccountId: stableAccountId,
        source: source,
        symbol: sym,
        marketValue: Math.round(mv * 100) / 100
      });
      if (!sym) return;
      if (!symbolTotals[sym]) symbolTotals[sym] = { symbol: sym, marketValue: 0, accountKeys: {} };
      symbolTotals[sym].marketValue += mv;
      symbolTotals[sym].accountKeys[sessionKey] = true;
    });
  });

  if (!(totalPreviewedValue > 0)) {
    totalPreviewedValue = totalCash;
  }
  accountAllocations.forEach(function(row) {
    row.percentOfSession = totalPreviewedValue > 0
      ? holdingsPreviewLabRoundPercent_((row.totalValue / totalPreviewedValue) * 100)
      : 0;
  });

  var cashPercent = totalPreviewedValue > 0
    ? holdingsPreviewLabRoundPercent_((totalCash / totalPreviewedValue) * 100)
    : 0;

  var topHoldingsAcrossAccounts = Object.keys(symbolTotals).map(function(sym) {
    return {
      symbol: sym,
      marketValue: Math.round(symbolTotals[sym].marketValue * 100) / 100,
      percentOfSession: totalPreviewedValue > 0
        ? holdingsPreviewLabRoundPercent_((symbolTotals[sym].marketValue / totalPreviewedValue) * 100)
        : 0,
      accountCount: Object.keys(symbolTotals[sym].accountKeys).length
    };
  }).sort(function(a, b) { return b.marketValue - a.marketValue; }).slice(0, 10);

  var crossAccountSymbolOverlap = Object.keys(symbolTotals).filter(function(sym) {
    return Object.keys(symbolTotals[sym].accountKeys).length > 1;
  }).map(function(sym) {
    return {
      symbol: sym,
      accountCount: Object.keys(symbolTotals[sym].accountKeys).length,
      observation: 'This symbol appears in more than one previewed account.'
    };
  });

  var concentrationObservations = [];
  if (topHoldingsAcrossAccounts.length &&
      topHoldingsAcrossAccounts[0].percentOfSession >= 25) {
    concentrationObservations.push(
      'Largest holding represents ' + topHoldingsAcrossAccounts[0].percentOfSession +
      '% of previewed accounts only.');
  }
  if (totalCash > 0 && totalPreviewedValue > 0) {
    concentrationObservations.push(
      'Cash represents ' + cashPercent + '% of previewed accounts only.');
  }

  return {
    scopeLabel: 'Previewed accounts only',
    accountCount: accountAllocations.length,
    totalPreviewedValue: Math.round(totalPreviewedValue * 100) / 100,
    totalCash: Math.round(totalCash * 100) / 100,
    cashPercent: cashPercent,
    accountAllocations: accountAllocations,
    topHoldingsAcrossAccounts: topHoldingsAcrossAccounts,
    crossAccountSymbolOverlap: crossAccountSymbolOverlap,
    concentrationObservations: concentrationObservations
  };
}

function holdingsPreviewLabSanitizeWarningText_(text) {
  return String(text || '')
    .replace(/REFID[:\s]+\d+/gi, 'REFID:***')
    .replace(/\b\d{4,}\b/g, '****');
}
