/**
 * bounded_holdings_preview_apply_diff.js — Read-only unified holdings diff builder (bounded Apply).
 *
 * Never creates or writes the unified sheet. Compares proposed preview rows to existing sheet rows.
 */

function boundedHoldingsPreviewApplyBuildDocumentFingerprint_(source, rawText) {
  var normalizedSource = typeof investmentPortfolioNormalizeSource_ === 'function'
    ? investmentPortfolioNormalizeSource_(source || '')
    : String(source || '').trim().toUpperCase();
  var raw = String(rawText || '').trim();
  if (!raw) return '';
  if (normalizedSource === 'M1_STATEMENT_PDF' &&
      typeof investmentM1BuildStatementFileFingerprint_ === 'function') {
    return investmentM1BuildStatementFileFingerprint_(raw);
  }
  if (normalizedSource === 'ETRADE_POSITIONS_PDF' &&
      typeof investmentEtradeBuildPositionsFileFingerprint_ === 'function') {
    return investmentEtradeBuildPositionsFileFingerprint_(raw);
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
