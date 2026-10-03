/**
 * bounded_holdings_preview_apply_diff.js — Read-only unified holdings diff builder (bounded Apply).
 *
 * Never creates or writes the unified sheet. Compares proposed preview rows to existing sheet rows.
 */

function boundedHoldingsPreviewApplyBuildDocumentFingerprint_(source, rawText, documentFingerprint) {
  var normalizedSource = typeof investmentPortfolioNormalizeSource_ === 'function'
    ? investmentPortfolioNormalizeSource_(source || '')
    : String(source || '').trim().toUpperCase();
  var raw = String(rawText || '').trim();
  if (!raw) return '';
  if (normalizedSource === 'M1_STATEMENT_PDF' &&
      typeof investmentM1BuildStatementFileFingerprint_ === 'function') {
    return investmentM1BuildStatementFileFingerprint_(raw);
  }
  if (normalizedSource === 'SCHWAB_BROKERAGE_STATEMENT_PDF' &&
      typeof investmentSchwabBuildStatementFileFingerprint_ === 'function') {
    return investmentSchwabBuildStatementFileFingerprint_(raw);
  }
  if (normalizedSource === 'STASH_BROKERAGE_STATEMENT_PDF' &&
      typeof investmentStashBuildStatementFileFingerprint_ === 'function') {
    return investmentStashBuildStatementFileFingerprint_(raw);
  }
  if (normalizedSource === 'ETRADE_POSITIONS_PDF' &&
      typeof investmentEtradeBuildPositionsFileFingerprint_ === 'function') {
    return investmentEtradeBuildPositionsFileFingerprint_(raw);
  }
  if (normalizedSource === 'ETRADE_CLIENT_STATEMENT_PDF' &&
      typeof investmentEtradeClientStatementResolveDocumentFingerprint_ === 'function') {
    return investmentEtradeClientStatementResolveDocumentFingerprint_({
      documentFingerprint: documentFingerprint,
      rawStatementText: raw
    });
  }
  return investmentPortfolioDigest_([normalizedSource, raw]);
}

function boundedHoldingsPreviewApplyBuildContentFingerprintFromPreview_(preview) {
  preview = preview || {};
  var holdings = (preview.holdingsRows || []).map(function(row) {
    return [
      String(row.symbol || '').trim().toUpperCase(),
      String(row.sourceSecurityKey || '').trim(),
      String(row.quantity != null ? row.quantity : ''),
      String(row.marketValue != null ? row.marketValue : '')
    ].join(':');
  }).sort().join('|');
  return investmentPortfolioDigest_([
    boundedHoldingsPreviewApplyNormalizeAsOfDate_(preview.asOf),
    String(preview.cashBalance != null ? preview.cashBalance : ''),
    String(preview.totalAccountValue != null ? preview.totalAccountValue : ''),
    holdings
  ]);
}

function boundedHoldingsPreviewApplyProviderLabel_(source, groupProviderKey) {
  var provider = String(groupProviderKey || '').trim();
  if (provider) return provider;
  return typeof investmentPortfolioNormalizeSource_ === 'function'
    ? investmentPortfolioNormalizeSource_(source || '')
    : String(source || '').trim().toUpperCase();
}

function boundedHoldingsPreviewApplyFinalizeProposedRow_(row) {
  row = row || {};
  row.asOfDate = boundedHoldingsPreviewApplyNormalizeAsOfDate_(row.asOfDate || row.asOf);
  row.accountIdentityKey = boundedHoldingsPreviewApplyAccountIdentityKey_(row);
  row.rowKey = boundedHoldingsPreviewApplyRowKey_(row);
  row.valueDigest = boundedHoldingsPreviewApplyValueDigestPart_(row);
  row.importStatus = String(row.importStatus || 'APPLIED').trim();
  return row;
}

function boundedHoldingsPreviewApplyBuildProposedRowsFromPreview_(scope, preview) {
  scope = scope || {};
  preview = preview || {};
  var source = typeof investmentPortfolioNormalizeSource_ === 'function'
    ? investmentPortfolioNormalizeSource_(scope.source || preview.source || '')
    : String(scope.source || preview.source || '').trim().toUpperCase();
  if (source === 'FIDELITY_401K_STATEMENT_PDF') return [];
  if (String(preview.importProfile || '').trim() === 'ETRADE_CISCO_STATEMENT') return [];
  if (source === 'ETRADE_CLIENT_STATEMENT_PDF' &&
      (String(preview.valueCategory || '').trim() === 'POTENTIAL_UNVESTED_STOCK_PLAN' ||
       (typeof investmentEtradeMatchesPotentialUnvestedStockPlanMapping_ === 'function' &&
        investmentEtradeMatchesPotentialUnvestedStockPlanMapping_(
          scope.parentAccountName || scope.accountName, source)))) {
    return [];
  }
  var rows = [];
  var asOfDate = boundedHoldingsPreviewApplyNormalizeAsOfDate_(preview.asOf);
  var cashBalance = boundedHoldingsPreviewApplyNullableNumber_(preview.cashBalance);
  if (cashBalance !== null) {
    rows.push(boundedHoldingsPreviewApplyFinalizeProposedRow_({
      source: scope.source,
      provider: scope.provider,
      parentAccount: scope.parentAccountName,
      childPartition: scope.childPartitionId || '',
      investmentId: scope.investmentId,
      sourceSecurityKey: '__CASH__',
      symbol: 'Cash',
      securityName: 'Cash balance',
      shares: '',
      price: '',
      marketValue: cashBalance,
      costBasis: '',
      unrealizedGainLoss: '',
      cashBalance: cashBalance,
      asOfDate: asOfDate,
      documentFingerprint: scope.documentFingerprint,
      recognitionLabel: scope.recognitionLabel || ''
    }));
  }

  (preview.holdingsRows || []).forEach(function(holding) {
    rows.push(boundedHoldingsPreviewApplyFinalizeProposedRow_({
      source: scope.source,
      provider: scope.provider,
      parentAccount: scope.parentAccountName,
      childPartition: scope.childPartitionId || '',
      investmentId: scope.investmentId,
      sourceSecurityKey: String(holding.sourceSecurityKey || '').trim(),
      symbol: String(holding.symbol || '').trim(),
      securityName: String(holding.description || holding.securityName || '').trim(),
      shares: holding.quantity,
      price: holding.price,
      marketValue: holding.marketValue,
      costBasis: holding.costBasis,
      unrealizedGainLoss: holding.unrealizedGainLoss,
      cashBalance: '',
      asOfDate: asOfDate,
      documentFingerprint: scope.documentFingerprint,
      recognitionLabel: scope.recognitionLabel || ''
    }));
  });
  return rows;
}

function boundedHoldingsPreviewApplyNormalizeImportStatus_(value) {
  return String(value || '').trim().toUpperCase();
}

function boundedHoldingsPreviewApplyIsAppliedImportStatus_(value) {
  return boundedHoldingsPreviewApplyNormalizeImportStatus_(value) === 'APPLIED';
}

/**
 * Returns distinct APPLIED document fingerprints already on a child partition for one as-of period.
 * @param {!Array<Object>} existingRows
 * @param {string} accountIdentityKey
 * @param {string} statementPeriodEnd
 * @returns {!Array<string>}
 */
function boundedHoldingsPreviewApplyCollectPartitionPeriodFingerprints_(existingRows,
  accountIdentityKey, statementPeriodEnd) {
  var partitionId = String(accountIdentityKey || '').trim();
  var periodEnd = boundedHoldingsPreviewApplyNormalizeAsOfDate_(statementPeriodEnd);
  if (!partitionId || !periodEnd) return [];
  var fingerprints = Object.create(null);
  (existingRows || []).forEach(function(row) {
    if (String(row.accountIdentityKey || '').trim() !== partitionId) return;
    if (!boundedHoldingsPreviewApplyIsAppliedImportStatus_(row.importStatus)) return;
    if (boundedHoldingsPreviewApplyNormalizeAsOfDate_(row.asOfDate) !== periodEnd) return;
    var fingerprint = String(row.documentFingerprint || '').trim();
    if (fingerprint) fingerprints[fingerprint] = true;
  });
  return Object.keys(fingerprints);
}

/**
 * Partition-level guard: one child partition + as-of period cannot host two APPLIED documents.
 * @param {!Array<Object>} existingRows
 * @param {!Array<Object>} scopes
 * @returns {!Array<Object>}
 */
function boundedHoldingsPreviewApplyDetectPartitionDocumentConflicts_(existingRows, scopes) {
  var conflicts = [];
  (scopes || []).forEach(function(scope) {
    scope = scope || {};
    var accountIdentityKey = String(scope.accountIdentityKey || scope.childPartitionId || '').trim();
    var documentFingerprint = String(scope.documentFingerprint || '').trim();
    var statementPeriodEnd = boundedHoldingsPreviewApplyNormalizeAsOfDate_(
      scope.statementPeriodEnd || scope.asOfDate || scope.asOf);
    if (!accountIdentityKey || !documentFingerprint) return;
    if (!statementPeriodEnd) {
      var appliedOnPartition = (existingRows || []).some(function(row) {
        return String(row.accountIdentityKey || '').trim() === accountIdentityKey &&
          boundedHoldingsPreviewApplyIsAppliedImportStatus_(row.importStatus);
      });
      if (appliedOnPartition) {
        conflicts.push({
          accountIdentityKey: accountIdentityKey,
          statementPeriodEnd: '',
          reason: 'MISSING_AS_OF'
        });
      }
      return;
    }
    var existingFingerprints = boundedHoldingsPreviewApplyCollectPartitionPeriodFingerprints_(
      existingRows, accountIdentityKey, statementPeriodEnd);
    if (!existingFingerprints.length) return;
    if (existingFingerprints.indexOf(documentFingerprint) >= 0) return;
    conflicts.push({
      accountIdentityKey: accountIdentityKey,
      statementPeriodEnd: statementPeriodEnd,
      existingFingerprints: existingFingerprints,
      proposedFingerprint: documentFingerprint
    });
  });
  return conflicts;
}

function boundedHoldingsPreviewApplyBuildPartitionConflictFailure_(conflicts, replayOutcomes) {
  conflicts = conflicts || [];
  replayOutcomes = replayOutcomes || [];
  var first = conflicts[0] || {};
  var message = first.reason === 'MISSING_AS_OF'
    ? 'Statement as-of period is required before Apply can replay against existing holdings.'
    : 'Same account partition and as-of period with different document content — review required.';
  return {
    ok: false,
    requiresReview: true,
    error: message,
    replayOutcome: 'CONFLICT_REVIEW_REQUIRED',
    replayMessage: message,
    replayOutcomes: replayOutcomes,
    partitionConflicts: conflicts.map(function(item) {
      return {
        accountIdentityKey: item.accountIdentityKey,
        statementPeriodEnd: item.statementPeriodEnd || '',
        existingFingerprintCount: (item.existingFingerprints || []).length,
        reason: item.reason || 'DOCUMENT_FINGERPRINT_MISMATCH'
      };
    })
  };
}

function boundedHoldingsPreviewApplyClassifyDocumentReplay_(existingRows, scope) {
  scope = scope || {};
  existingRows = existingRows || [];
  var accountIdentityKey = String(scope.accountIdentityKey || '').trim();
  var documentFingerprint = String(scope.documentFingerprint || '').trim();
  var statementPeriodEnd = boundedHoldingsPreviewApplyNormalizeAsOfDate_(
    scope.statementPeriodEnd || scope.asOfDate || scope.asOf);

  if (!accountIdentityKey || !documentFingerprint) {
    return {
      outcome: 'IDENTITY_REVIEW_REQUIRED',
      message: 'Account identity and document fingerprint are required before Apply.'
    };
  }

  var appliedPartitionRows = existingRows.filter(function(row) {
    return row.accountIdentityKey === accountIdentityKey &&
      boundedHoldingsPreviewApplyIsAppliedImportStatus_(row.importStatus);
  });

  if (!statementPeriodEnd && appliedPartitionRows.length) {
    return {
      outcome: 'IDENTITY_REVIEW_REQUIRED',
      message: 'Statement as-of period is required before Apply can replay against existing holdings.'
    };
  }

  var partitionFingerprints = boundedHoldingsPreviewApplyCollectPartitionPeriodFingerprints_(
    existingRows, accountIdentityKey, statementPeriodEnd);
  if (partitionFingerprints.indexOf(documentFingerprint) >= 0) {
    return {
      outcome: 'DUPLICATE_NOOP',
      message: 'This document was already applied for this account partition — no change.'
    };
  }
  if (partitionFingerprints.length && statementPeriodEnd) {
    return {
      outcome: 'CONFLICT_REVIEW_REQUIRED',
      message: 'Same account partition and as-of period with different document content — review required.'
    };
  }

  return {
    outcome: 'ACCEPT_NEW',
    message: 'New holdings snapshot is eligible for Apply review.'
  };
}

function boundedHoldingsPreviewApplyRowsMatchValues_(existing, proposed) {
  return String(existing.valueDigest || '') === String(proposed.valueDigest || '');
}

function boundedHoldingsPreviewApplyBuildDiff_(existingRows, proposedRows) {
  existingRows = existingRows || [];
  proposedRows = proposedRows || [];
  var existingByKey = Object.create(null);
  existingRows.forEach(function(row) {
    existingByKey[row.rowKey] = row;
  });

  var create = [];
  var update = [];
  var unchanged = [];
  var conflicts = [];

  proposedRows.forEach(function(proposed) {
    var existing = existingByKey[proposed.rowKey];
    if (!existing) {
      create.push(proposed);
      return;
    }
    if (boundedHoldingsPreviewApplyRowsMatchValues_(existing, proposed)) {
      unchanged.push({ existing: existing, proposed: proposed });
      return;
    }
    if (existing.documentFingerprint !== proposed.documentFingerprint) {
      conflicts.push({
        existing: existing,
        proposed: proposed,
        reason: 'Existing applied row differs for the same identity key and document fingerprint mismatch.'
      });
      return;
    }
    update.push({ existing: existing, proposed: proposed });
  });

  return {
    create: create,
    update: update,
    unchanged: unchanged,
    conflicts: conflicts,
    summary: {
      createCount: create.length,
      updateCount: update.length,
      unchangedCount: unchanged.length,
      conflictCount: conflicts.length,
      proposedCount: proposedRows.length
    },
    blocked: conflicts.length > 0,
    blockReason: conflicts.length
      ? 'Conflicting unified holdings rows must be reviewed before Apply.'
      : ''
  };
}

function boundedHoldingsPreviewApplyBuildDiffDigest_(payload) {
  payload = payload || {};
  return investmentPortfolioDigest_([
    String(payload.mode || ''),
    String(payload.investmentId || ''),
    String(payload.parentStableAccountId || ''),
    String(payload.documentFingerprint || ''),
    String(payload.groupedDigestPart || ''),
    JSON.stringify(payload.monthlyDigestPart || null),
    JSON.stringify((payload.proposedRows || []).map(function(row) {
      return [
        row.rowKey,
        row.valueDigest,
        row.documentFingerprint
      ].join(':');
    }).sort()),
    JSON.stringify((payload.existingRows || []).map(function(row) {
      return [
        row.rowKey,
        row.valueDigest,
        row.documentFingerprint,
        String(row.sheetRow || '')
      ].join(':');
    }).sort())
  ]);
}

function boundedHoldingsPreviewApplySanitizeDiffRowForClient_(row, action) {
  row = row || {};
  return {
    action: action,
    rowKey: row.rowKey,
    source: row.source,
    provider: row.provider,
    parentAccount: row.parentAccount,
    childPartition: row.childPartition,
    childPartitionLabel: row.recognitionLabel || '',
    investmentId: row.investmentId,
    sourceSecurityKey: row.sourceSecurityKey,
    symbol: row.symbol,
    securityName: row.securityName,
    shares: row.shares,
    price: row.price,
    marketValue: row.marketValue,
    costBasis: row.costBasis,
    costBasisAvailable: row.costBasis !== '' && row.costBasis !== null &&
      typeof row.costBasis !== 'undefined',
    unrealizedGainLoss: row.unrealizedGainLoss,
    cashBalance: row.cashBalance,
    asOfDate: row.asOfDate,
    documentFingerprint: row.documentFingerprint
  };
}

function boundedHoldingsPreviewApplyBuildDiffPreview_(diff, scopes, replayOutcomes) {
  diff = diff || {};
  scopes = scopes || [];
  replayOutcomes = replayOutcomes || [];
  var primaryScope = scopes[0] || {};
  var cashTotal = 0;
  var marketValueTotal = 0;
  var costBasisAvailableCount = 0;
  var proposedCount = 0;

  (diff.create || []).concat((diff.update || []).map(function(entry) {
    return entry.proposed;
  })).concat((diff.unchanged || []).map(function(entry) {
    return entry.proposed;
  })).forEach(function(row) {
    proposedCount += 1;
    var cash = boundedHoldingsPreviewApplyNullableNumber_(row.cashBalance);
    var marketValue = boundedHoldingsPreviewApplyNullableNumber_(row.marketValue);
    if (cash !== null) cashTotal += cash;
    if (marketValue !== null) marketValueTotal += marketValue;
    if (row.costBasis !== '' && row.costBasis !== null && typeof row.costBasis !== 'undefined') {
      costBasisAvailableCount += 1;
    }
  });

  return {
    summary: diff.summary,
    blocked: !!diff.blocked,
    blockReason: diff.blockReason || '',
    duplicateNoop: replayOutcomes.every(function(item) {
      return item && item.outcome === 'DUPLICATE_NOOP';
    }) && replayOutcomes.length > 0,
    replayOutcomes: boundedHoldingsPreviewApplySanitizeReplayOutcomesForClient_(replayOutcomes),
    accountContext: {
      parentAccount: primaryScope.parentAccountName || '',
      investmentId: primaryScope.investmentId || '',
      childPartitions: scopes.map(function(scope) {
        return {
          accountIdentityKey: scope.accountIdentityKey,
          recognitionLabel: scope.recognitionLabel || '',
          asOfDate: boundedHoldingsPreviewApplyNormalizeAsOfDate_(scope.asOfDate || scope.asOf),
          documentFingerprint: scope.documentFingerprint || ''
        };
      })
    },
    totals: {
      cash: round2_(cashTotal),
      marketValue: round2_(marketValueTotal),
      costBasisAvailableCount: costBasisAvailableCount,
      proposedCount: proposedCount
    },
    create: (diff.create || []).map(function(row) {
      return boundedHoldingsPreviewApplySanitizeDiffRowForClient_(row, 'CREATE');
    }),
    update: (diff.update || []).map(function(entry) {
      return boundedHoldingsPreviewApplySanitizeDiffRowForClient_(entry.proposed, 'UPDATE');
    }),
    unchanged: (diff.unchanged || []).map(function(entry) {
      return boundedHoldingsPreviewApplySanitizeDiffRowForClient_(entry.proposed, 'UNCHANGED');
    }),
    conflicts: (diff.conflicts || []).map(function(entry) {
      var proposed = boundedHoldingsPreviewApplySanitizeDiffRowForClient_(entry.proposed, 'CONFLICT');
      proposed.reason = entry.reason || '';
      proposed.existingDocumentFingerprint = entry.existing && entry.existing.documentFingerprint;
      return proposed;
    })
  };
}

function boundedHoldingsPreviewApplySanitizeReplayOutcomeForClient_(item) {
  item = item || {};
  return {
    outcome: String(item.outcome || '').trim(),
    message: String(item.message || '').trim()
  };
}

function boundedHoldingsPreviewApplySanitizeReplayOutcomesForClient_(replayOutcomes) {
  return (replayOutcomes || []).map(boundedHoldingsPreviewApplySanitizeReplayOutcomeForClient_);
}

function boundedHoldingsPreviewApplySanitizeDiffBundleForClient_(bundle) {
  bundle = bundle || {};
  if (!bundle.ok) {
    var failureMessage = String(bundle.error || bundle.replayMessage || '').trim();
    return {
      ok: false,
      error: failureMessage || 'Could not build Apply diff.',
      replayMessage: String(bundle.replayMessage || '').trim(),
      replayOutcome: String(bundle.replayOutcome || '').trim(),
      requiresReview: !!bundle.requiresReview,
      reviewRequired: !!bundle.reviewRequired,
      blocked: !!bundle.blocked,
      staleDiff: !!bundle.staleDiff,
      replayOutcomes: boundedHoldingsPreviewApplySanitizeReplayOutcomesForClient_(
        bundle.replayOutcomes)
    };
  }
  return {
    ok: true,
    mode: bundle.mode,
    diffDigest: bundle.diffDigest,
    duplicateNoop: !!bundle.duplicateNoop,
    applyEligible: bundle.applyEligible,
    diff: bundle.diff,
    replayOutcomes: boundedHoldingsPreviewApplySanitizeReplayOutcomesForClient_(
      bundle.replayOutcomes)
  };
}

function boundedHoldingsPreviewApplyIsDuplicateNoopDiff_(diff, replayOutcomes) {
  replayOutcomes = replayOutcomes || [];
  if (!replayOutcomes.length) return false;
  return replayOutcomes.every(function(item) {
    return item && item.outcome === 'DUPLICATE_NOOP';
  });
}

function boundedHoldingsPreviewApplyBuildGroupedDigestPart_(scopes) {
  return (scopes || []).map(function(scope) {
    return [
      scope.accountIdentityKey,
      scope.documentFingerprint,
      scope.contentFingerprint
    ].join(':');
  }).sort().join('|');
}

function boundedHoldingsPreviewApplyIsMonthlyValueSource_(source, accountName) {
  var normalized = typeof investmentPortfolioNormalizeSource_ === 'function'
    ? investmentPortfolioNormalizeSource_(source || '')
    : String(source || '').trim().toUpperCase();
  if (normalized === 'SCHWAB_BROKERAGE_STATEMENT_PDF' ||
      normalized === 'M1_STATEMENT_PDF' ||
      normalized === 'FIDELITY_401K_STATEMENT_PDF' ||
      normalized === 'STASH_BROKERAGE_STATEMENT_PDF') {
    return true;
  }
  if (normalized === 'ETRADE_CLIENT_STATEMENT_PDF') {
    if (typeof investmentEtradeMatchesSamerBrokerageAccountValueMapping_ === 'function' &&
        investmentEtradeMatchesSamerBrokerageAccountValueMapping_(accountName, normalized)) {
      return true;
    }
    if (typeof investmentEtradeMatchesPotentialUnvestedStockPlanMapping_ === 'function') {
      return investmentEtradeMatchesPotentialUnvestedStockPlanMapping_(accountName, normalized);
    }
    return false;
  }
  return false;
}

function boundedHoldingsPreviewApplyParseStatementDate_(asOf) {
  var text = boundedHoldingsPreviewApplyNormalizeAsOfDate_(asOf);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  var year = Number(text.slice(0, 4));
  var month = Number(text.slice(5, 7));
  var day = Number(text.slice(8, 10));
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return null;
  return {
    iso: text,
    year: year,
    month: month,
    day: day,
    date: new Date(year, month - 1, day)
  };
}

function boundedHoldingsPreviewApplyMonthLabel_(parsed) {
  parsed = parsed || {};
  if (parsed.date && typeof Utilities !== 'undefined' && Utilities.formatDate) {
    try {
      var tz = (typeof Session !== 'undefined' && Session.getScriptTimeZone)
        ? Session.getScriptTimeZone()
        : 'America/Los_Angeles';
      return Utilities.formatDate(parsed.date, tz, 'MMM-yy');
    } catch (_fmtErr) { /* fall through */ }
  }
  if (parsed.iso) {
    var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months[parsed.month - 1] + '-' + String(parsed.year).slice(2);
  }
  return '';
}

function boundedHoldingsPreviewApplyMonthDisplayLabel_(parsed) {
  parsed = parsed || {};
  var months = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  if (parsed.date && typeof Utilities !== 'undefined' && Utilities.formatDate) {
    try {
      var tz = (typeof Session !== 'undefined' && Session.getScriptTimeZone)
        ? Session.getScriptTimeZone()
        : 'America/Los_Angeles';
      return Utilities.formatDate(parsed.date, tz, 'MMMM yyyy');
    } catch (_fmtErr) { /* fall through */ }
  }
  if (parsed.month && parsed.year) {
    return months[parsed.month - 1] + ' ' + parsed.year;
  }
  return boundedHoldingsPreviewApplyMonthLabel_(parsed);
}

function boundedHoldingsPreviewApplyResolveProviderEndingTotal_(preview, source) {
  preview = preview || {};
  var recon = preview.reconciliation || null;
  var reconEnding = boundedHoldingsPreviewApplyNullableNumber_(recon && recon.endingTotalValue);
  var normalized = typeof investmentPortfolioNormalizeSource_ === 'function'
    ? investmentPortfolioNormalizeSource_(source || '')
    : String(source || '').trim().toUpperCase();
  if (normalized === 'ETRADE_CLIENT_STATEMENT_PDF') {
    var accountName = String((preview && preview.accountName) || '').trim();
    var valueCategory = String((preview && preview.valueCategory) || '').trim();
    var isSamerBrokerage =
      valueCategory === 'BROKERAGE_ACCOUNT_VALUE' ||
      (typeof investmentEtradeMatchesSamerBrokerageAccountValueMapping_ === 'function' &&
        investmentEtradeMatchesSamerBrokerageAccountValueMapping_(accountName, normalized));
    if (isSamerBrokerage) {
      if (!(recon && recon.ok === true) || reconEnding === null) {
        var samerEnding = boundedHoldingsPreviewApplyNullableNumber_(
          preview.endingTotalValue);
        if (samerEnding === null) return { value: null, origin: '' };
        return { value: samerEnding, origin: 'ENDING_TOTAL_VALUE' };
      }
      return { value: reconEnding, origin: 'ENDING_TOTAL_VALUE' };
    }
    var potential = boundedHoldingsPreviewApplyNullableNumber_(
      preview.potentialUnvestedStockPlanValue);
    if (potential === null) return { value: null, origin: '' };
    return { value: potential, origin: 'POTENTIAL_UNVESTED_STOCK_PLAN' };
  }
  if (normalized === 'STASH_BROKERAGE_STATEMENT_PDF') {
    if (!(recon && recon.ok === true) || reconEnding === null) {
      return { value: null, origin: '' };
    }
    return { value: reconEnding, origin: 'RECONCILIATION' };
  }
  if (reconEnding !== null) {
    return { value: reconEnding, origin: 'RECONCILIATION' };
  }
  if (normalized === 'SCHWAB_BROKERAGE_STATEMENT_PDF') {
    // Schwab provider snapshot is reconciliation.endingTotalValue (or the
    // parser account snapshot that feeds it). Never use holdings-sum fallback.
    return { value: null, origin: '' };
  }
  if (normalized === 'M1_STATEMENT_PDF') {
    if (Object.prototype.hasOwnProperty.call(preview, 'endingTotalValue')) {
      var reportedEnding = boundedHoldingsPreviewApplyNullableNumber_(preview.endingTotalValue);
      if (reportedEnding === null) return { value: null, origin: '' };
      return { value: reportedEnding, origin: 'PROVIDER_SNAPSHOT' };
    }
    if (preview.statementParseMeta &&
        Object.prototype.hasOwnProperty.call(preview.statementParseMeta, 'endingTotalValue')) {
      var metaEnding = boundedHoldingsPreviewApplyNullableNumber_(
        preview.statementParseMeta.endingTotalValue);
      if (metaEnding === null) return { value: null, origin: '' };
      return { value: metaEnding, origin: 'PROVIDER_SNAPSHOT' };
    }
    if (!(preview.capabilities && preview.capabilities.accountSnapshot)) {
      return { value: null, origin: '' };
    }
    var snapshotTotal = boundedHoldingsPreviewApplyNullableNumber_(preview.totalAccountValue);
    if (snapshotTotal === null) return { value: null, origin: '' };
    return { value: snapshotTotal, origin: 'PROVIDER_SNAPSHOT' };
  }
  if (normalized === 'FIDELITY_401K_STATEMENT_PDF') {
    var fidelityEnding = boundedHoldingsPreviewApplyNullableNumber_(preview.endingBalance);
    if (fidelityEnding === null) return { value: null, origin: '' };
    return { value: fidelityEnding, origin: 'PROVIDER_SNAPSHOT' };
  }
  return { value: null, origin: '' };
}

function boundedHoldingsPreviewApplyResolveMonthlyValueDecision_(comparison, rawDecision) {
  var raw = String(rawDecision || '').trim().toUpperCase();
  if (comparison === 'BLANK') {
    if (raw === 'ADD') return { ok: true, decision: 'ADD' };
    if (!raw || raw === 'IGNORE') return { ok: true, decision: 'IGNORE' };
    return { ok: false, error: 'Choose Add or Ignore for the monthly investment value.' };
  }
  if (comparison === 'MATCH') {
    if (!raw || raw === 'KEEP') return { ok: true, decision: 'KEEP' };
    return { ok: false, error: 'This month already matches the statement value.' };
  }
  if (comparison === 'DIFFER') {
    if (raw === 'REPLACE') return { ok: true, decision: 'REPLACE' };
    if (!raw || raw === 'KEEP') return { ok: true, decision: 'KEEP' };
    return {
      ok: false,
      error: 'Choose Keep existing or Replace with the statement value.'
    };
  }
  return { ok: true, decision: '' };
}

function boundedHoldingsPreviewApplyReadExistingMonthlyValue_(accountName, parsed) {
  if (typeof getInvestmentHistoryValueForMonth_ !== 'function') {
    return { ok: false, reason: 'MONTH_CELL_UNAVAILABLE' };
  }
  try {
    var value = getInvestmentHistoryValueForMonth_(accountName, parsed.year, parsed.date);
    var present = value !== '' && value !== null && typeof value !== 'undefined';
    return {
      ok: true,
      present: present,
      value: present ? round2_(Number(value)) : null
    };
  } catch (_readErr) {
    return { ok: false, reason: 'MONTH_CELL_UNAVAILABLE' };
  }
}

function boundedHoldingsPreviewApplyMonthlyDigestPart_(monthly) {
  monthly = monthly || {};
  return {
    action: String(monthly.action || ''),
    reason: String(monthly.reason || ''),
    accountName: String(monthly.accountName || ''),
    investmentId: String(monthly.investmentId || ''),
    asOfDate: String(monthly.asOfDate || ''),
    existingPresent: !!monthly.existingPresent,
    existingValue: monthly.existingValue,
    proposedValue: monthly.proposedValue,
    willWrite: !!monthly.willWrite,
    comparison: String(monthly.comparison || ''),
    decision: String(monthly.decision || ''),
    source: String(monthly.source || ''),
    valueCategory: String(monthly.valueCategory || '')
  };
}

function boundedHoldingsPreviewApplySanitizeMonthlyValueForClient_(monthly) {
  monthly = monthly || {};
  return {
    action: String(monthly.action || 'SKIP'),
    willWrite: !!monthly.willWrite,
    reason: String(monthly.reason || ''),
    skipKind: String(monthly.skipKind || ''),
    message: String(monthly.message || ''),
    accountName: String(monthly.accountName || ''),
    investmentId: String(monthly.investmentId || ''),
    asOfDate: String(monthly.asOfDate || ''),
    monthLabel: String(monthly.monthLabel || ''),
    existingPresent: !!monthly.existingPresent,
    existingValue: monthly.existingValue,
    proposedValue: monthly.proposedValue,
    proposedValueLabel: String(monthly.proposedValueLabel || ''),
    comparison: String(monthly.comparison || ''),
    decision: String(monthly.decision || ''),
    defaultDecision: String(monthly.defaultDecision || ''),
    allowedDecisions: Array.isArray(monthly.allowedDecisions) ? monthly.allowedDecisions.slice() : [],
    difference: monthly.difference != null ? monthly.difference : null,
    valuesMatch: !!monthly.valuesMatch,
    warning: String(monthly.warning || ''),
    source: String(monthly.source || ''),
    valueCategory: String(monthly.valueCategory || ''),
    valueLabel: String(monthly.valueLabel || '')
  };
}

function boundedHoldingsPreviewApplyBuildMonthlySkip_(reason, message, extras) {
  extras = extras || {};
  return {
    action: 'SKIP',
    willWrite: false,
    reason: reason,
    skipKind: extras.skipKind || 'UNAVAILABLE',
    message: message,
    accountName: extras.accountName || '',
    investmentId: extras.investmentId || '',
    asOfDate: extras.asOfDate || '',
    monthLabel: extras.monthLabel || '',
    existingPresent: !!extras.existingPresent,
    existingValue: extras.existingValue != null ? extras.existingValue : null,
    proposedValue: extras.proposedValue != null ? extras.proposedValue : null,
    proposedValueLabel: String(extras.proposedValueLabel || ''),
    comparison: String(extras.comparison || ''),
    decision: String(extras.decision || ''),
    defaultDecision: String(extras.defaultDecision || ''),
    allowedDecisions: Array.isArray(extras.allowedDecisions) ? extras.allowedDecisions.slice() : [],
    difference: extras.difference != null ? extras.difference : null,
    valuesMatch: !!extras.valuesMatch,
    warning: String(extras.warning || ''),
    source: String(extras.source || ''),
    valueCategory: String(extras.valueCategory || ''),
    valueLabel: String(extras.valueLabel || '')
  };
}

function boundedHoldingsPreviewApplyBuildMissingStatementValueSkip_(extras) {
  return boundedHoldingsPreviewApplyBuildMonthlySkip_(
    'MISSING_ENDING_TOTAL',
    'Statement value is not provided. Needs review. Add and Replace are not available.',
    Object.assign({
      proposedValue: null,
      proposedValueLabel: 'Not provided',
      comparison: 'MISSING',
      skipKind: 'NEEDS_REVIEW',
      allowedDecisions: []
    }, extras || {})
  );
}

function boundedHoldingsPreviewApplyFormatMoney_(value) {
  if (value === null || typeof value === 'undefined' || value === '') return '—';
  var n = Number(value);
  if (!isFinite(n)) return '—';
  var abs = Math.abs(n).toFixed(2);
  var parts = abs.split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return (n < 0 ? '-$' : '$') + parts.join('.');
}

function boundedHoldingsPreviewApplyIsEtradeCiscoStatementProfile_(payload, preview) {
  payload = payload || {};
  preview = preview || {};
  if (typeof investmentEtradeMatchesCiscoStatementImportProfile_ === 'function' &&
      investmentEtradeMatchesCiscoStatementImportProfile_(payload.pickerValue)) {
    return true;
  }
  return String(preview.importProfile || '').trim() === 'ETRADE_CISCO_STATEMENT';
}

function boundedHoldingsPreviewApplyMonthlyDecisionForAccount_(payload, accountName) {
  payload = payload || {};
  var wanted = String(accountName || '').trim();
  var map = payload.monthlyInvestmentValueDecisions;
  if (map && typeof map === 'object' && !Array.isArray(map) && wanted) {
    if (map[wanted] != null && String(map[wanted]).trim() !== '') {
      return String(map[wanted]).trim().toUpperCase();
    }
  }
  if (Array.isArray(map) && wanted) {
    var i;
    for (i = 0; i < map.length; i++) {
      if (map[i] && String(map[i].accountName || '').trim() === wanted &&
          map[i].decision != null) {
        return String(map[i].decision).trim().toUpperCase();
      }
    }
  }
  return String(payload.monthlyInvestmentValueDecision || '').trim().toUpperCase();
}

function boundedHoldingsPreviewApplyResolveMonthlyValueForLeg_(preview, source, leg) {
  preview = preview || {};
  leg = leg || {};
  var origin = String(leg.valueOrigin || leg.valueCategory || '').trim().toUpperCase();
  if (origin === 'POTENTIAL_UNVESTED_STOCK_PLAN') {
    var potential = boundedHoldingsPreviewApplyNullableNumber_(
      preview.potentialUnvestedStockPlanValue);
    if (potential === null) return { value: null, origin: '' };
    return { value: potential, origin: 'POTENTIAL_UNVESTED_STOCK_PLAN' };
  }
  if (origin === 'ENDING_TOTAL_VALUE' || origin === 'BROKERAGE_ACCOUNT_VALUE') {
    var recon = preview.reconciliation || null;
    var ending = boundedHoldingsPreviewApplyNullableNumber_(
      preview.endingTotalValue != null ? preview.endingTotalValue :
        (recon && recon.endingTotalValue));
    if (ending === null) {
      ending = boundedHoldingsPreviewApplyNullableNumber_(
        preview.preamble && preview.preamble.endingTotalValue);
    }
    if (ending === null) return { value: null, origin: '' };
    return { value: ending, origin: 'ENDING_TOTAL_VALUE' };
  }
  return boundedHoldingsPreviewApplyResolveProviderEndingTotal_(preview, source);
}

function boundedHoldingsPreviewApplyBuildMonthlyInvestmentValueProposals_(
  payload, mode, accountValidation, preview, targetValidations) {
  payload = payload || {};
  preview = preview || {};
  if (!boundedHoldingsPreviewApplyIsEtradeCiscoStatementProfile_(payload, preview)) {
    return [boundedHoldingsPreviewApplyBuildMonthlyInvestmentValueProposal_(
      payload, mode, accountValidation, preview)];
  }
  var profile = typeof investmentEtradeCiscoStatementImportProfile_ === 'function'
    ? investmentEtradeCiscoStatementImportProfile_()
    : null;
  var legs = (preview.monthlyLegs && preview.monthlyLegs.length)
    ? preview.monthlyLegs
    : ((profile && profile.legs) || []);
  var validationsByName = Object.create(null);
  (targetValidations || []).forEach(function(item) {
    if (item && item.accountName) validationsByName[item.accountName] = item;
  });
  var proposals = [];
  var i;
  for (i = 0; i < legs.length; i++) {
    var leg = legs[i] || {};
    var validation = validationsByName[leg.accountName] || {
      accountName: leg.accountName,
      investmentId: ''
    };
    proposals.push(boundedHoldingsPreviewApplyBuildMonthlyInvestmentValueProposalForLeg_(
      payload, mode, validation, preview, leg));
  }
  if (!proposals.length) {
    return [boundedHoldingsPreviewApplyBuildMonthlySkip_('UNSUPPORTED_SOURCE',
      'This statement type does not propose a monthly investment value.')];
  }
  return proposals;
}

function boundedHoldingsPreviewApplyBuildMonthlyInvestmentValueProposalForLeg_(
  payload, mode, accountValidation, preview, leg) {
  payload = payload || {};
  accountValidation = accountValidation || {};
  preview = preview || {};
  leg = leg || {};
  var accountName = String(accountValidation.accountName || leg.accountName || '').trim();
  var investmentId = String(accountValidation.investmentId || '').trim();
  var source = typeof investmentPortfolioNormalizeSource_ === 'function'
    ? investmentPortfolioNormalizeSource_(payload.source || preview.source || '')
    : String(payload.source || preview.source || '').trim().toUpperCase();
  var legPayload = Object.assign({}, payload, {
    accountName: accountName,
    investmentId: investmentId,
    monthlyInvestmentValueDecision:
      boundedHoldingsPreviewApplyMonthlyDecisionForAccount_(payload, accountName)
  });
  if (mode === 'GROUPED_PROVIDER') {
    return boundedHoldingsPreviewApplyBuildMonthlySkip_('GROUPED_PROVIDER',
      'Grouped M1 Apply does not update the parent monthly investment value.');
  }
  if (!accountName || !investmentId) {
    return boundedHoldingsPreviewApplyBuildMonthlySkip_('IDENTITY_MISMATCH',
      'Monthly investment value requires a verified CashCompass account identity.');
  }
  if (payload.explicitAccountMatch !== true) {
    return boundedHoldingsPreviewApplyBuildMonthlySkip_('EXPLICIT_MATCH_REQUIRED',
      'Monthly investment value requires explicit account-match confirmation.');
  }
  var parsed = boundedHoldingsPreviewApplyParseStatementDate_(preview.asOf);
  if (!parsed) {
    return boundedHoldingsPreviewApplyBuildMonthlySkip_('INVALID_STATEMENT_DATE',
      'Statement date is missing or invalid, so the monthly investment value was skipped.',
      { accountName: accountName, investmentId: investmentId });
  }
  var monthLabel = boundedHoldingsPreviewApplyMonthDisplayLabel_(parsed);
  var currentYear = typeof getCurrentYear_ === 'function' ? getCurrentYear_() : new Date().getFullYear();
  if (parsed.year !== Number(currentYear)) {
    return boundedHoldingsPreviewApplyBuildMonthlySkip_('OUT_OF_YEAR',
      monthLabel + ' is outside ' + currentYear + ' tracking, so the monthly investment value was skipped.',
      {
        accountName: accountName,
        investmentId: investmentId,
        asOfDate: parsed.iso,
        monthLabel: monthLabel
      });
  }
  var ending = boundedHoldingsPreviewApplyResolveMonthlyValueForLeg_(preview, source, leg);
  if (ending.value === null) {
    return boundedHoldingsPreviewApplyBuildMissingStatementValueSkip_({
      accountName: accountName,
      investmentId: investmentId,
      asOfDate: parsed.iso,
      monthLabel: monthLabel
    });
  }
  var existing = boundedHoldingsPreviewApplyReadExistingMonthlyValue_(accountName, parsed);
  if (!existing.ok) {
    return boundedHoldingsPreviewApplyBuildMonthlySkip_(existing.reason || 'MONTH_CELL_UNAVAILABLE',
      'The ' + monthLabel + ' investment cell could not be read, so the monthly value was skipped.',
      {
        accountName: accountName,
        investmentId: investmentId,
        asOfDate: parsed.iso,
        monthLabel: monthLabel,
        proposedValue: ending.value
      });
  }
  return boundedHoldingsPreviewApplyBuildTrustedMonthlyValueProposal_({
    source: source,
    monthlyInvestmentValueDecision: legPayload.monthlyInvestmentValueDecision,
    accountName: accountName,
    investmentId: investmentId,
    asOfDate: parsed.iso,
    monthLabel: monthLabel,
    existingPresent: !!existing.present,
    existingValue: existing.present ? existing.value : null,
    proposedValue: ending.value,
    valueCategory: String(leg.valueCategory || ''),
    valueLabel: String(leg.valueLabel || ''),
    warning: String(leg.warning || '')
  });
}

function boundedHoldingsPreviewApplyBuildMonthlyInvestmentValueProposal_(payload, mode, accountValidation, preview) {
  payload = payload || {};
  accountValidation = accountValidation || {};
  preview = preview || {};
  var accountName = String(accountValidation.accountName || '').trim();
  var investmentId = String(accountValidation.investmentId || '').trim();
  var payloadAccountName = String(payload.accountName || '').trim();
  var payloadInvestmentId = String(payload.investmentId || '').trim();
  var source = typeof investmentPortfolioNormalizeSource_ === 'function'
    ? investmentPortfolioNormalizeSource_(payload.source || preview.source || '')
    : String(payload.source || preview.source || '').trim().toUpperCase();

  if (mode === 'GROUPED_PROVIDER') {
    return boundedHoldingsPreviewApplyBuildMonthlySkip_('GROUPED_PROVIDER',
      'Grouped M1 Apply does not update the parent monthly investment value.');
  }
  if (!boundedHoldingsPreviewApplyIsMonthlyValueSource_(source, accountName)) {
    return boundedHoldingsPreviewApplyBuildMonthlySkip_('UNSUPPORTED_SOURCE',
      'This statement type does not propose a monthly investment value.');
  }
  if (!accountName || !investmentId) {
    return boundedHoldingsPreviewApplyBuildMonthlySkip_('IDENTITY_MISMATCH',
      'Monthly investment value requires a verified CashCompass account identity.');
  }
  if (payloadAccountName && payloadAccountName !== accountName) {
    return boundedHoldingsPreviewApplyBuildMonthlySkip_('IDENTITY_MISMATCH',
      'Monthly investment value requires the selected CashCompass account identity.',
      { accountName: accountName, investmentId: investmentId });
  }
  if (payloadInvestmentId && payloadInvestmentId !== investmentId &&
      payloadInvestmentId !== String(accountValidation.stableAccountId || '').trim()) {
    return boundedHoldingsPreviewApplyBuildMonthlySkip_('IDENTITY_MISMATCH',
      'Monthly investment value requires the selected CashCompass account identity.',
      { accountName: accountName, investmentId: investmentId });
  }
  if (payload.explicitAccountMatch !== true) {
    return boundedHoldingsPreviewApplyBuildMonthlySkip_('EXPLICIT_MATCH_REQUIRED',
      'Monthly investment value requires explicit account-match confirmation.');
  }

  var parsed = boundedHoldingsPreviewApplyParseStatementDate_(preview.asOf);
  if (!parsed) {
    return boundedHoldingsPreviewApplyBuildMonthlySkip_('INVALID_STATEMENT_DATE',
      'Statement date is missing or invalid, so the monthly investment value was skipped.',
      { accountName: accountName, investmentId: investmentId });
  }
  var monthLabel = boundedHoldingsPreviewApplyMonthDisplayLabel_(parsed);
  var currentYear = typeof getCurrentYear_ === 'function' ? getCurrentYear_() : new Date().getFullYear();
  if (parsed.year !== Number(currentYear)) {
    return boundedHoldingsPreviewApplyBuildMonthlySkip_('OUT_OF_YEAR',
      monthLabel + ' is outside ' + currentYear + ' tracking, so the monthly investment value was skipped.',
      {
        accountName: accountName,
        investmentId: investmentId,
        asOfDate: parsed.iso,
        monthLabel: monthLabel
      });
  }

  var ending = boundedHoldingsPreviewApplyResolveProviderEndingTotal_(
    Object.assign({}, preview, { accountName: preview.accountName || accountName }),
    source);
  if (ending.value === null) {
    return boundedHoldingsPreviewApplyBuildMissingStatementValueSkip_({
      accountName: accountName,
      investmentId: investmentId,
      asOfDate: parsed.iso,
      monthLabel: monthLabel
    });
  }

  var existing = boundedHoldingsPreviewApplyReadExistingMonthlyValue_(accountName, parsed);
  if (!existing.ok) {
    return boundedHoldingsPreviewApplyBuildMonthlySkip_(existing.reason || 'MONTH_CELL_UNAVAILABLE',
      'The ' + monthLabel + ' investment cell could not be read, so the monthly value was skipped.',
      {
        accountName: accountName,
        investmentId: investmentId,
        asOfDate: parsed.iso,
        monthLabel: monthLabel,
        proposedValue: ending.value
      });
  }

  var mapping = typeof investmentEtradePotentialUnvestedStockPlanMapping_ === 'function'
    ? investmentEtradePotentialUnvestedStockPlanMapping_()
    : null;
  var isPotentialUnvested = source === 'ETRADE_CLIENT_STATEMENT_PDF' &&
    mapping && accountName === mapping.accountName;
  var samerMapping = typeof investmentEtradeSamerBrokerageAccountValueMapping_ === 'function'
    ? investmentEtradeSamerBrokerageAccountValueMapping_()
    : null;
  var isSamerBrokerage = source === 'ETRADE_CLIENT_STATEMENT_PDF' &&
    samerMapping && accountName === samerMapping.accountName;
  return boundedHoldingsPreviewApplyBuildTrustedMonthlyValueProposal_({
    source: source,
    monthlyInvestmentValueDecision: payload.monthlyInvestmentValueDecision,
    accountName: accountName,
    investmentId: investmentId,
    asOfDate: parsed.iso,
    monthLabel: monthLabel,
    existingPresent: !!existing.present,
    existingValue: existing.present ? existing.value : null,
    proposedValue: ending.value,
    valueCategory: isPotentialUnvested ? mapping.valueCategory
      : (isSamerBrokerage ? samerMapping.valueCategory : ''),
    valueLabel: isPotentialUnvested ? mapping.valueLabel
      : (isSamerBrokerage ? samerMapping.valueLabel : ''),
    warning: isPotentialUnvested ? mapping.warning : ''
  });
}

function boundedHoldingsPreviewApplyBuildTrustedMonthlyValueProposal_(fields) {
  fields = fields || {};
  var existingPresent = !!fields.existingPresent;
  var existingValue = existingPresent
    ? boundedHoldingsPreviewApplyNullableNumber_(fields.existingValue)
    : null;
  var proposedValue = boundedHoldingsPreviewApplyNullableNumber_(fields.proposedValue);
  if (proposedValue === null) {
    return boundedHoldingsPreviewApplyBuildMissingStatementValueSkip_({
      accountName: fields.accountName,
      investmentId: fields.investmentId,
      asOfDate: fields.asOfDate,
      monthLabel: fields.monthLabel,
      existingPresent: existingPresent,
      existingValue: existingValue,
      source: fields.source,
      valueCategory: String(fields.valueCategory || ''),
      valueLabel: String(fields.valueLabel || ''),
      warning: String(fields.warning || '')
    });
  }
  var comparison = 'BLANK';
  if (existingPresent) {
    comparison = existingValue === proposedValue ? 'MATCH' : 'DIFFER';
  }
  var resolved = boundedHoldingsPreviewApplyResolveMonthlyValueDecision_(
    comparison, fields.monthlyInvestmentValueDecision);
  if (!resolved.ok) {
    return boundedHoldingsPreviewApplyBuildMonthlySkip_('INVALID_DECISION', resolved.error, {
      accountName: fields.accountName,
      investmentId: fields.investmentId,
      asOfDate: fields.asOfDate,
      monthLabel: fields.monthLabel,
      existingPresent: existingPresent,
      existingValue: existingValue,
      proposedValue: proposedValue,
      comparison: comparison,
      source: fields.source,
      valueCategory: String(fields.valueCategory || ''),
      valueLabel: String(fields.valueLabel || ''),
      warning: String(fields.warning || '')
    });
  }

  var decision = resolved.decision;
  var moneyExisting = boundedHoldingsPreviewApplyFormatMoney_(existingValue);
  var moneyProposed = boundedHoldingsPreviewApplyFormatMoney_(proposedValue);
  var monthLabel = String(fields.monthLabel || '');
  var difference = comparison === 'DIFFER'
    ? round2_(proposedValue - existingValue)
    : (comparison === 'MATCH' ? 0 : null);
  var proposal = {
    action: 'SKIP',
    willWrite: false,
    reason: '',
    skipKind: '',
    message: '',
    accountName: fields.accountName || '',
    investmentId: fields.investmentId || '',
    asOfDate: fields.asOfDate || '',
    monthLabel: monthLabel,
    existingPresent: existingPresent,
    existingValue: existingPresent ? existingValue : null,
    proposedValue: proposedValue,
    proposedValueLabel: '',
    comparison: comparison,
    decision: decision,
    defaultDecision: '',
    allowedDecisions: [],
    difference: difference,
    valuesMatch: comparison === 'MATCH',
    warning: String(fields.warning || ''),
    source: String(fields.source || ''),
    valueCategory: String(fields.valueCategory || ''),
    valueLabel: String(fields.valueLabel || '')
  };

  if (comparison === 'BLANK') {
    proposal.allowedDecisions = ['ADD', 'IGNORE'];
    proposal.defaultDecision = 'IGNORE';
    if (decision === 'ADD') {
      proposal.action = 'ADD';
      proposal.willWrite = true;
      proposal.message = 'Add ' + monthLabel + ' value: ' + moneyProposed;
    } else {
      proposal.reason = 'USER_IGNORE';
      proposal.skipKind = 'IGNORED';
      proposal.message = 'Ignore monthly value. Statement value for ' + monthLabel +
        ': ' + moneyProposed + '.';
    }
    return proposal;
  }

  if (comparison === 'MATCH') {
    proposal.allowedDecisions = ['KEEP'];
    proposal.defaultDecision = 'KEEP';
    proposal.reason = 'MATCH';
    proposal.skipKind = 'MATCH';
    proposal.message = 'Already matches. Existing value will be kept.';
    return proposal;
  }

  proposal.allowedDecisions = ['KEEP', 'REPLACE'];
  proposal.defaultDecision = 'KEEP';
  proposal.message = monthLabel + ' existing value ' + moneyExisting +
    ' differs from statement value ' + moneyProposed +
    ' by ' + boundedHoldingsPreviewApplyFormatMoney_(difference) + '.';
  if (decision === 'REPLACE') {
    proposal.action = 'REPLACE';
    proposal.willWrite = true;
    proposal.message += ' Warning: the existing monthly value will be replaced.';
  } else {
    proposal.reason = 'USER_KEEP';
    proposal.skipKind = 'KEPT';
    proposal.message += ' Existing value will remain unchanged unless Replace is selected.';
  }
  return proposal;
}
