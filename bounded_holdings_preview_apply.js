/**
 * bounded_holdings_preview_apply.js — Bounded unified holdings Apply workflow.
 *
 * Preview remains read-only until explicit Apply confirmation. Writes only to
 * SYS - Investment Holdings Unified under document lock with rollback.
 */

function boundedHoldingsPreviewApplyAssertExplicitConfirm_(payload) {
  payload = payload || {};
  if (payload.explicitApplyConfirm !== true) {
    return { ok: false, error: 'Explicit Apply confirmation is required after reviewing the diff.' };
  }
  if (!String(payload.diffDigest || '').trim()) {
    return { ok: false, error: 'Apply diffDigest is required.' };
  }
  return { ok: true };
}

function boundedHoldingsPreviewApplyRejectReviewRequiredPreview_(preview) {
  preview = preview || {};
  if (preview.readiness && preview.readiness.trustedForHoldingsVisibility === false) {
    return {
      ok: false,
      error: 'Holdings preview is not trusted for Apply.',
      reviewRequired: true
    };
  }
  return { ok: true };
}

function boundedHoldingsPreviewApplyBuildSingleScope_(accountValidation, preview, payload, documentFingerprint) {
  var source = typeof investmentPortfolioNormalizeSource_ === 'function'
    ? investmentPortfolioNormalizeSource_(payload.source || preview.source || '')
    : String(payload.source || preview.source || '').trim().toUpperCase();
  return {
    mode: 'SINGLE_ACCOUNT',
    source: source,
    provider: boundedHoldingsPreviewApplyProviderLabel_(source, ''),
    parentAccountName: accountValidation.accountName,
    investmentId: accountValidation.investmentId,
    parentStableAccountId: accountValidation.stableAccountId,
    accountIdentityKey: accountValidation.investmentId,
    childPartitionId: '',
    recognitionLabel: '',
    documentFingerprint: documentFingerprint,
    contentFingerprint: boundedHoldingsPreviewApplyBuildContentFingerprintFromPreview_(preview),
    asOfDate: boundedHoldingsPreviewApplyNormalizeAsOfDate_(preview.asOf),
    statementPeriodEnd: boundedHoldingsPreviewApplyNormalizeAsOfDate_(preview.asOf)
  };
}

function boundedHoldingsPreviewApplyRebuildSinglePreview_(ss, payload) {
  var accountValidation = boundedHoldingsPreviewValidateSelectedAccount_(ss, payload || {});
  if (!accountValidation.ok) return accountValidation;
  var previewPayload = Object.assign({}, payload || {}, {
    stableAccountId: accountValidation.stableAccountId,
    registrationType: accountValidation.registrationType,
    explicitAccountMatch: true
  });
  var preview = holdingsPreviewLabBuildPreview_(previewPayload);
  if (!preview.ok) return preview;
  var reviewCheck = boundedHoldingsPreviewApplyRejectReviewRequiredPreview_(preview);
  if (!reviewCheck.ok) return reviewCheck;
  var documentFingerprint = boundedHoldingsPreviewApplyBuildDocumentFingerprint_(
    previewPayload.source, payload.rawDocumentText);
  if (!documentFingerprint) {
    return { ok: false, error: 'Document fingerprint could not be built for Apply.' };
  }
  return {
    ok: true,
    accountValidation: accountValidation,
    preview: preview,
    documentFingerprint: documentFingerprint,
    scope: boundedHoldingsPreviewApplyBuildSingleScope_(
      accountValidation, preview, payload, documentFingerprint)
  };
}

function boundedHoldingsPreviewApplyValidateGroupedSessionItems_(payload, parentValidation, groupConfig) {
  var sessionApplyItems = Array.isArray(payload.sessionApplyItems) ? payload.sessionApplyItems : [];
  if (!sessionApplyItems.length) {
    return { ok: false, error: 'At least one grouped child preview is required for Apply.' };
  }
  var latestPreviews = typeof boundedHoldingsPreviewSelectLatestGroupedPreviews_ === 'function'
    ? boundedHoldingsPreviewSelectLatestGroupedPreviews_(sessionApplyItems)
    : sessionApplyItems;
  if (!latestPreviews.length) {
    return { ok: false, error: 'Grouped Apply requires at least one accepted child preview.' };
  }

  var scopes = [];
  var proposedRows = [];
  var replayOutcomes = [];
  for (var i = 0; i < latestPreviews.length; i += 1) {
    var item = latestPreviews[i] || {};
    var preview = item.preview || item;
    if (!preview || preview.ok === false) {
      return { ok: false, error: 'Grouped Apply child preview is invalid or incomplete.' };
    }
    var reviewCheck = boundedHoldingsPreviewApplyRejectReviewRequiredPreview_(preview);
    if (!reviewCheck.ok) return reviewCheck;
    var childPartitionId = String(item.childPartitionId || '').trim();
    if (!childPartitionId ||
        childPartitionId === String(parentValidation.parentStableAccountId || '').trim()) {
      return { ok: false, error: 'Grouped child partition identity is invalid.' };
    }
    if (/^X{2,}\d+$/i.test(childPartitionId) || /^XXXX/i.test(childPartitionId)) {
      return { ok: false, error: 'Masked account numbers cannot be used as durable child identity.' };
    }
    var documentFingerprint = String(item.documentFingerprint || '').trim();
    if (!documentFingerprint) {
      return { ok: false, error: 'Grouped Apply child document fingerprint is required.' };
    }
    var scope = {
      mode: 'GROUPED_PROVIDER',
      source: groupConfig.source,
      provider: boundedHoldingsPreviewApplyProviderLabel_(groupConfig.source, groupConfig.providerKey),
      parentAccountName: parentValidation.accountRow.accountName,
      investmentId: parentValidation.mapped.investmentId,
      parentStableAccountId: parentValidation.parentStableAccountId,
      accountIdentityKey: childPartitionId,
      childPartitionId: childPartitionId,
      recognitionLabel: String(item.recognitionLabel || '').trim(),
      documentFingerprint: documentFingerprint,
      contentFingerprint: String(item.contentFingerprint || '').trim() ||
        boundedHoldingsPreviewApplyBuildContentFingerprintFromPreview_(preview),
      asOfDate: boundedHoldingsPreviewApplyNormalizeAsOfDate_(preview.asOf || item.statementPeriodEnd || item.previewAsOf),
      statementPeriodEnd: boundedHoldingsPreviewApplyNormalizeAsOfDate_(
        item.statementPeriodEnd || item.previewAsOf || preview.asOf)
    };
    scopes.push(scope);
    proposedRows = proposedRows.concat(
      boundedHoldingsPreviewApplyBuildProposedRowsFromPreview_(scope, preview));
  }
  return {
    ok: true,
    scopes: scopes,
    proposedRows: proposedRows,
    replayOutcomes: replayOutcomes
  };
}

function boundedHoldingsPreviewApplyRebuildGroupedPreview_(ss, payload) {
  payload = payload || {};
  var groupConfig = boundedHoldingsPreviewMatchGroupProvider_(
    payload.accountName, payload.source || 'M1_STATEMENT_PDF');
  if (!groupConfig) {
    return { ok: false, error: 'Selected account does not support grouped Apply.' };
  }
  var parentValidation = boundedHoldingsPreviewValidateGroupedParentAccount_(ss, payload, groupConfig);
  if (!parentValidation.ok) return parentValidation;
  var built = boundedHoldingsPreviewApplyValidateGroupedSessionItems_(
    payload, parentValidation, groupConfig);
  if (!built.ok) return built;
  return {
    ok: true,
    parentValidation: parentValidation,
    groupConfig: groupConfig,
    scopes: built.scopes,
    proposedRows: built.proposedRows
  };
}

function boundedHoldingsPreviewApplyBuildDiffBundle_(ss, payload, mode) {
  ss = ss || getUserSpreadsheet_();
  payload = payload || {};
  mode = mode || 'SINGLE_ACCOUNT';

  var existingRows = boundedHoldingsPreviewApplyReadExistingRows_(ss);
  var scopes = [];
  var proposedRows = [];
  var replayOutcomes = [];
  var accountValidation = null;
  var parentValidation = null;
  var preview = null;
  var documentFingerprint = '';

  if (mode === 'GROUPED_PROVIDER') {
    var grouped = boundedHoldingsPreviewApplyRebuildGroupedPreview_(ss, payload);
    if (!grouped.ok) return grouped;
    parentValidation = grouped.parentValidation;
    scopes = grouped.scopes;
    proposedRows = grouped.proposedRows;
    scopes.forEach(function(scope) {
      replayOutcomes.push(boundedHoldingsPreviewApplyClassifyDocumentReplay_(existingRows, scope));
    });
  } else {
    var single = boundedHoldingsPreviewApplyRebuildSinglePreview_(ss, payload);
    if (!single.ok) return single;
    accountValidation = single.accountValidation;
    preview = single.preview;
    documentFingerprint = single.documentFingerprint;
    scopes = [single.scope];
    proposedRows = boundedHoldingsPreviewApplyBuildProposedRowsFromPreview_(single.scope, preview);
    replayOutcomes = [boundedHoldingsPreviewApplyClassifyDocumentReplay_(existingRows, single.scope)];
  }

  var blockingReplay = replayOutcomes.filter(function(item) {
    return item && (item.outcome === 'CONFLICT_REVIEW_REQUIRED' ||
      item.outcome === 'IDENTITY_REVIEW_REQUIRED');
  });
  if (blockingReplay.length) {
    var blockMessage = String(blockingReplay[0].message || '').trim() ||
      (blockingReplay[0].outcome === 'IDENTITY_REVIEW_REQUIRED'
        ? 'Account identity or statement period review is required before Apply.'
        : 'Same account partition and as-of period with different document content — review required.');
    return {
      ok: false,
      requiresReview: true,
      error: blockMessage,
      replayOutcome: blockingReplay[0].outcome,
      replayMessage: blockMessage,
      replayOutcomes: replayOutcomes
    };
  }

  var partitionConflicts = boundedHoldingsPreviewApplyDetectPartitionDocumentConflicts_(
    existingRows, scopes);
  if (partitionConflicts.length) {
    return boundedHoldingsPreviewApplyBuildPartitionConflictFailure_(
      partitionConflicts, replayOutcomes);
  }

  var diff = boundedHoldingsPreviewApplyBuildDiff_(existingRows, proposedRows);
  if (boundedHoldingsPreviewApplyIsDuplicateNoopDiff_(diff, replayOutcomes)) {
    diff.duplicateNoop = true;
  }

  var diffDigest = boundedHoldingsPreviewApplyBuildDiffDigest_({
    mode: mode,
    investmentId: scopes[0] && scopes[0].investmentId,
    parentStableAccountId: scopes[0] && scopes[0].parentStableAccountId,
    documentFingerprint: mode === 'SINGLE_ACCOUNT' ? documentFingerprint : '',
    groupedDigestPart: mode === 'GROUPED_PROVIDER'
      ? boundedHoldingsPreviewApplyBuildGroupedDigestPart_(scopes) : '',
    proposedRows: proposedRows,
    existingRows: existingRows
  });

  var diffPreview = boundedHoldingsPreviewApplyBuildDiffPreview_(diff, scopes, replayOutcomes);
  diffPreview.applyEligible = !diff.blocked &&
    replayOutcomes.every(function(item) {
      return item && item.outcome !== 'IDENTITY_REVIEW_REQUIRED';
    });
  diffPreview.targetSheet = boundedHoldingsPreviewApplyUnifiedSheetName_();
  diffPreview.sheetExists = !!ss.getSheetByName(boundedHoldingsPreviewApplyUnifiedSheetName_());
  diffPreview.inputInvestmentsUnchanged = true;
  diffPreview.monthlyHistoryUnchanged = true;

  return {
    ok: true,
    mode: mode,
    diffDigest: diffDigest,
    duplicateNoop: !!diff.duplicateNoop,
    applyEligible: diffPreview.applyEligible,
    replayOutcomes: replayOutcomes,
    diff: diffPreview,
    accountValidation: accountValidation,
    parentValidation: parentValidation,
    preview: preview,
    scopes: scopes,
    proposedRows: proposedRows,
    existingRows: existingRows
  };
}

function boundedHoldingsPreviewBuildApplyDiffFromDashboard(payload) {
  return boundedHoldingsPreviewSafe_(function() {
    assertBoundedHoldingsPreviewAllowed_();
    var ss = getUserSpreadsheet_();
    var bundle = boundedHoldingsPreviewApplyBuildDiffBundle_(ss, payload || {}, 'SINGLE_ACCOUNT');
    return typeof boundedHoldingsPreviewApplySanitizeDiffBundleForClient_ === 'function'
      ? boundedHoldingsPreviewApplySanitizeDiffBundleForClient_(bundle)
      : bundle;
  });
}

function boundedHoldingsPreviewBuildGroupedApplyDiffFromDashboard(payload) {
  return boundedHoldingsPreviewSafe_(function() {
    assertBoundedHoldingsPreviewAllowed_();
    var ss = getUserSpreadsheet_();
    var bundle = boundedHoldingsPreviewApplyBuildDiffBundle_(ss, payload || {}, 'GROUPED_PROVIDER');
    return typeof boundedHoldingsPreviewApplySanitizeDiffBundleForClient_ === 'function'
      ? boundedHoldingsPreviewApplySanitizeDiffBundleForClient_(bundle)
      : bundle;
  });
}

function boundedHoldingsPreviewApplyExecute_(ss, payload, mode) {
  ss = ss || getUserSpreadsheet_();
  payload = payload || {};
  mode = mode || 'SINGLE_ACCOUNT';

  if (typeof boundedHoldingsPreviewApplyTouchUnifiedSheetFormat_ === 'function') {
    boundedHoldingsPreviewApplyTouchUnifiedSheetFormat_(ss);
  }

  var confirm = boundedHoldingsPreviewApplyAssertExplicitConfirm_(payload);
  if (!confirm.ok) return confirm;

  var expectedDigest = String(payload.diffDigest || '').trim();
  var bundle = boundedHoldingsPreviewApplyBuildDiffBundle_(ss, payload, mode);
  if (!bundle.ok) return bundle;
  if (bundle.diffDigest !== expectedDigest) {
    return {
      ok: false,
      error: 'Apply diff changed since review. Rebuild the diff and confirm again.',
      staleDiff: true
    };
  }
  if (!bundle.applyEligible) {
    return {
      ok: false,
      error: bundle.diff && bundle.diff.blockReason
        ? bundle.diff.blockReason
        : 'Apply is blocked until holdings conflicts are resolved.',
      blocked: true
    };
  }

  var partitionConflicts = boundedHoldingsPreviewApplyDetectPartitionDocumentConflicts_(
    bundle.existingRows, bundle.scopes);
  if (partitionConflicts.length) {
    return boundedHoldingsPreviewApplyBuildPartitionConflictFailure_(
      partitionConflicts, bundle.replayOutcomes);
  }

  if (bundle.duplicateNoop || boundedHoldingsPreviewApplyIsDuplicateNoopDiff_(
      boundedHoldingsPreviewApplyBuildDiff_(bundle.existingRows, bundle.proposedRows),
      bundle.replayOutcomes)) {
    return {
      ok: true,
      duplicateNoop: true,
      importRunRef: '',
      message: 'Exact same document already applied — no change.',
      diff: bundle.diff
    };
  }

  var diff = boundedHoldingsPreviewApplyBuildDiff_(bundle.existingRows, bundle.proposedRows);
  if (diff.blocked) {
    return {
      ok: false,
      error: diff.blockReason || 'Conflicting unified holdings rows must be reviewed before Apply.',
      blocked: true
    };
  }
  if (!(diff.create || []).length && !(diff.update || []).length) {
    return {
      ok: true,
      duplicateNoop: true,
      importRunRef: '',
      message: 'No holdings changes to apply.',
      diff: bundle.diff
    };
  }

  var importRunRef = boundedHoldingsPreviewApplyBuildImportRunRef_();
  var importedAt = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
  var writeResult = boundedHoldingsPreviewApplyWriteDiff_(ss, diff, importRunRef, importedAt);
  return {
    ok: true,
    duplicateNoop: false,
    importRunRef: writeResult.importRunRef,
    created: writeResult.created,
    updated: writeResult.updated,
    sheetCreated: !!writeResult.sheetCreated,
    targetSheet: boundedHoldingsPreviewApplyUnifiedSheetName_(),
    inputInvestmentsUnchanged: true,
    monthlyHistoryUnchanged: true,
    rowResults: writeResult.rowResults || [],
    diff: bundle.diff,
    message: 'Applied ' + writeResult.created + ' new and ' + writeResult.updated +
      ' updated holdings rows to ' + boundedHoldingsPreviewApplyUnifiedSheetName_() + '.'
  };
}

function boundedHoldingsPreviewApplyFromDashboard(payload) {
  return boundedHoldingsPreviewSafe_(function() {
    assertBoundedHoldingsPreviewAllowed_();
    var ss = getUserSpreadsheet_();
    var lock = LockService.getDocumentLock();
    try { lock.waitLock(30000); } catch (lockErr) {
      return {
        ok: false,
        error: 'Could not acquire document lock: ' + (lockErr && lockErr.message || lockErr)
      };
    }
    try {
      var bundle = boundedHoldingsPreviewApplyBuildDiffBundle_(ss, payload || {}, 'SINGLE_ACCOUNT');
      if (!bundle.ok) return bundle;
      var refreshed = boundedHoldingsPreviewApplyBuildDiffBundle_(ss, payload || {}, 'SINGLE_ACCOUNT');
      if (!refreshed.ok) return refreshed;
      if (refreshed.diffDigest !== String(payload.diffDigest || '').trim()) {
        return {
          ok: false,
          error: 'Apply diff changed during lock acquisition. Rebuild the diff and confirm again.',
          staleDiff: true
        };
      }
      return boundedHoldingsPreviewApplyExecute_(ss, payload || {}, 'SINGLE_ACCOUNT');
    } finally {
      try { lock.releaseLock(); } catch (_releaseErr) { /* best effort */ }
    }
  });
}

function boundedHoldingsPreviewApplyGroupedFromDashboard(payload) {
  return boundedHoldingsPreviewSafe_(function() {
    assertBoundedHoldingsPreviewAllowed_();
    var ss = getUserSpreadsheet_();
    var lock = LockService.getDocumentLock();
    try { lock.waitLock(30000); } catch (lockErr) {
      return {
        ok: false,
        error: 'Could not acquire document lock: ' + (lockErr && lockErr.message || lockErr)
      };
    }
    try {
      var bundle = boundedHoldingsPreviewApplyBuildDiffBundle_(ss, payload || {}, 'GROUPED_PROVIDER');
      if (!bundle.ok) return bundle;
      var refreshed = boundedHoldingsPreviewApplyBuildDiffBundle_(ss, payload || {}, 'GROUPED_PROVIDER');
      if (!refreshed.ok) return refreshed;
      if (refreshed.diffDigest !== String(payload.diffDigest || '').trim()) {
        return {
          ok: false,
          error: 'Apply diff changed during lock acquisition. Rebuild the diff and confirm again.',
          staleDiff: true
        };
      }
      return boundedHoldingsPreviewApplyExecute_(ss, payload || {}, 'GROUPED_PROVIDER');
    } finally {
      try { lock.releaseLock(); } catch (_releaseErr) { /* best effort */ }
    }
  });
}
