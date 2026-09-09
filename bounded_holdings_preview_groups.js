/**
 * bounded_holdings_preview_groups.js — Session-only grouped provider preview (bounded app).
 *
 * Supports one visible CashCompass group account (e.g. M1 Account - Gmail) with up to five
 * separate in-session child statement partitions. No workbook writes or persistent registry rows.
 */

var BOUNDED_HOLDINGS_PREVIEW_GROUP_PROVIDERS_ = [
  {
    providerKey: 'M1_GMAIL',
    source: 'M1_STATEMENT_PDF',
    maxChildAccounts: 5,
    accountNamePattern: /^M1 Account\s*-\s*Gmail$/i,
    visibleLabel: 'M1 Account - Gmail',
    newChildPrompt: 'This appears to be a new M1 account under M1 Account - Gmail. Add it as another account?',
    reconciliationLabel: 'Previewed M1 child accounts only.',
    childRecognitionPrefix: 'Account',
    defaultRegistrationType: 'TAXABLE'
  },
  {
    providerKey: 'M1_YAHOO',
    source: 'M1_STATEMENT_PDF',
    maxChildAccounts: 5,
    accountNamePattern: /^M1 Account\s*-\s*yahoo$/i,
    visibleLabel: 'M1 Account - yahoo',
    newChildPrompt: 'This appears to be a new M1 account under M1 Account - yahoo. Add it as another account?',
    reconciliationLabel: 'Previewed M1 child accounts only.',
    childRecognitionPrefix: 'Account',
    defaultRegistrationType: 'TAXABLE'
  }
];

function boundedHoldingsPreviewMatchGroupProvider_(accountName, source) {
  var name = String(accountName || '').trim();
  var normalizedSource = typeof investmentPortfolioNormalizeSource_ === 'function'
    ? investmentPortfolioNormalizeSource_(source || '')
    : String(source || '').trim().toUpperCase();
  for (var i = 0; i < BOUNDED_HOLDINGS_PREVIEW_GROUP_PROVIDERS_.length; i += 1) {
    var config = BOUNDED_HOLDINGS_PREVIEW_GROUP_PROVIDERS_[i];
    if (config.source !== normalizedSource) continue;
    if (!config.accountNamePattern.test(name)) continue;
    return config;
  }
  return null;
}

function boundedHoldingsPreviewGroupedChildPartitionPrefix_(providerKey, parentInvestmentId) {
  return 'PREVIEW-GROUP-' + String(providerKey || '').trim() + '-' +
    String(parentInvestmentId || '').trim() + '-';
}

function boundedHoldingsPreviewBuildSessionChildPartitionId_(providerKey, parentInvestmentId,
  childSequence, confirmationToken) {
  var digest = investmentPortfolioDigest_([
    String(providerKey || ''),
    String(parentInvestmentId || ''),
    String(childSequence || ''),
    String(confirmationToken || '')
  ]);
  return boundedHoldingsPreviewGroupedChildPartitionPrefix_(providerKey, parentInvestmentId) +
    'C' + String(childSequence) + '-' + digest.slice(0, 12);
}

function boundedHoldingsPreviewBuildGroupedConfirmationToken_(signals) {
  signals = signals || {};
  return investmentPortfolioDigest_([
    String(signals.maskedAccountNumber || ''),
    String(signals.accountLabel || ''),
    String(signals.accountTitle || '')
  ]);
}

function boundedHoldingsPreviewParseGroupedStatementSignals_(rawText, source) {
  var normalizedSource = typeof investmentPortfolioNormalizeSource_ === 'function'
    ? investmentPortfolioNormalizeSource_(source || '')
    : String(source || '').trim().toUpperCase();
  if (normalizedSource !== 'M1_STATEMENT_PDF') {
    return { ok: false, error: 'Grouped preview supports M1 statement PDF extracts only.' };
  }
  var raw = String(rawText || '').trim();
  if (!raw) {
    return { ok: false, error: 'PDF text extract content is required.' };
  }
  if (raw.length > HOLDINGS_PREVIEW_LAB_MAX_TEXT_CHARS_) {
    return {
      ok: false,
      error: 'Document text exceeds the maximum preview size (' +
        HOLDINGS_PREVIEW_LAB_MAX_TEXT_CHARS_ + ' characters).'
    };
  }
  var parsed = investmentM1ParseStatementPdfText_(raw);
  if (!parsed || !parsed.ok) {
    return {
      ok: false,
      error: (parsed && parsed.error) ? String(parsed.error) : 'Could not parse M1 statement.'
    };
  }
  var preamble = parsed.preamble || {};
  return {
    ok: true,
    source: normalizedSource,
    statementPeriodStart: String(preamble.statementPeriodStart || '').trim(),
    statementPeriodEnd: String(preamble.statementPeriodEnd || '').trim(),
    maskedAccountNumber: String(preamble.maskedAccountNumber || '').trim().toUpperCase(),
    accountLabel: String(preamble.accountLabel || '').trim(),
    accountTitle: String(preamble.accountTitle || '').trim(),
    accountType: String(preamble.accountType || '').trim(),
    totalAccountValue: investmentM1HasMoney_(preamble.totalAccountValue)
      ? round2_(Number(preamble.totalAccountValue)) : null,
    cashBalance: investmentM1HasMoney_(preamble.cashBalance)
      ? round2_(Number(preamble.cashBalance)) : null,
    equitiesSubtotal: investmentM1HasMoney_(preamble.equitiesSubtotal)
      ? round2_(Number(preamble.equitiesSubtotal)) : null,
    cashPlusEquitiesReconciles: investmentM1BreakdownReconcilesToTotal_(preamble),
    holdingsCount: (parsed.holdings || []).length,
    documentFingerprint: investmentM1BuildStatementFileFingerprint_(raw),
    contentFingerprint: boundedHoldingsPreviewBuildGroupedContentFingerprint_(parsed),
    parseResult: parsed
  };
}

function boundedHoldingsPreviewBuildGroupedContentFingerprint_(parseResult) {
  parseResult = parseResult || {};
  var preamble = parseResult.preamble || {};
  var holdings = (parseResult.holdings || []).map(function(row) {
    return [
      String(row.symbol || '').trim().toUpperCase(),
      String(row.quantity || ''),
      String(row.marketValue || '')
    ].join(':');
  }).sort().join('|');
  return investmentPortfolioDigest_([
    String(preamble.statementPeriodEnd || ''),
    String(preamble.maskedAccountNumber || '').toUpperCase(),
    String(preamble.totalAccountValue || ''),
    holdings
  ]);
}

function boundedHoldingsPreviewResolveGroupedChildMatch_(signals, sessionChildren, groupConfig) {
  signals = signals || {};
  sessionChildren = sessionChildren || [];
  groupConfig = groupConfig || {};
  var masked = String(signals.maskedAccountNumber || '').trim().toUpperCase();
  if (!masked) {
    return {
      status: 'IDENTITY_REVIEW_REQUIRED',
      message: 'Masked account identifier was not found in this statement. Review before continuing.',
      maskedAccountSignal: ''
    };
  }
  if (/^X{2,}\d+$/i.test(masked)) {
    // Matching signal only — never treated as durable identity downstream.
  }
  var matches = sessionChildren.filter(function(child) {
    return String(child.maskedAccountSignal || '').trim().toUpperCase() === masked;
  });
  if (matches.length > 1) {
    return {
      status: 'IDENTITY_REVIEW_REQUIRED',
      message: 'Ambiguous masked account identifier matches more than one preview child.',
      maskedAccountSignal: masked
    };
  }
  if (matches.length === 1) {
    return {
      status: 'MATCH_EXISTING',
      child: matches[0],
      maskedAccountSignal: masked
    };
  }
  if (sessionChildren.length >= Number(groupConfig.maxChildAccounts || 5)) {
    return {
      status: 'CHILD_LIMIT_REACHED',
      message: 'This group already has the maximum number of preview child accounts (' +
        Number(groupConfig.maxChildAccounts || 5) + ').',
      maskedAccountSignal: masked
    };
  }
  var nextSequence = sessionChildren.length + 1;
  var prefix = String(groupConfig.childRecognitionPrefix || 'Account').trim() || 'Account';
  return {
    status: 'NEW_CHILD_CONFIRMATION_REQUIRED',
    prompt: String(groupConfig.newChildPrompt || ''),
    proposedRecognitionLabel: prefix + ' ' + nextSequence,
    proposedChildSequence: nextSequence,
    maskedAccountSignal: masked,
    confirmationToken: boundedHoldingsPreviewBuildGroupedConfirmationToken_(signals)
  };
}

function boundedHoldingsPreviewClassifyGroupedReplay_(input) {
  input = input || {};
  var childPartitionId = String(input.childPartitionId || '').trim();
  var documentFingerprint = String(input.documentFingerprint || '').trim();
  var statementPeriodEnd = String(input.statementPeriodEnd || '').trim();
  var contentFingerprint = String(input.contentFingerprint || '').trim();
  var sessionPreviews = input.sessionPreviews || [];

  if (!childPartitionId || !documentFingerprint) {
    return {
      outcome: 'IDENTITY_REVIEW_REQUIRED',
      message: 'Child partition and document fingerprint are required for replay classification.'
    };
  }

  var childPreviews = sessionPreviews.filter(function(row) {
    return String(row.childPartitionId || '').trim() === childPartitionId;
  });

  var exactDuplicate = childPreviews.some(function(row) {
    return String(row.documentFingerprint || '').trim() === documentFingerprint;
  });
  if (exactDuplicate) {
    return {
      outcome: 'DUPLICATE_NOOP',
      message: 'Exact same document for this child account and statement period — no change.'
    };
  }

  var samePeriodConflict = childPreviews.some(function(row) {
    return String(row.statementPeriodEnd || '').trim() === statementPeriodEnd &&
      String(row.contentFingerprint || '').trim() !== contentFingerprint;
  });
  if (samePeriodConflict && statementPeriodEnd) {
    return {
      outcome: 'CONFLICT_REVIEW_REQUIRED',
      message: 'Same child account and statement period with different content — review required.'
    };
  }

  return {
    outcome: 'ACCEPT_NEW',
    message: childPreviews.length
      ? 'New statement period accepted for this child account.'
      : 'New child statement accepted.'
  };
}

function boundedHoldingsPreviewValidateGroupedParentAccount_(ss, payload, groupConfig) {
  payload = payload || {};
  groupConfig = groupConfig || {};
  var activeRows = boundedHoldingsPreviewReadActiveInvestmentAccounts_(ss);
  var accountRow = boundedHoldingsPreviewFindSelectedAccount_(activeRows, payload);
  if (!accountRow) {
    return { ok: false, error: 'Selected investment account is not active in this workbook.' };
  }
  var expectedName = String(accountRow.accountName || '').trim();
  var providedName = String(payload.accountName || '').trim();
  if (!expectedName || expectedName.toLowerCase() !== providedName.toLowerCase()) {
    return {
      ok: false,
      error: 'Account display name must match the selected CashCompass investment account.'
    };
  }
  if (!boundedHoldingsPreviewMatchGroupProvider_(expectedName, groupConfig.source)) {
    return { ok: false, error: 'Selected account is not a grouped provider preview account.' };
  }
  if (typeof boundedHoldingsPreviewEnsureAccountIdentity_ !== 'function') {
    return { ok: false, error: 'Financial identity setup is unavailable.' };
  }
  var ensure = boundedHoldingsPreviewEnsureAccountIdentity_(ss, payload);
  if (!ensure.ok) return ensure;

  activeRows = boundedHoldingsPreviewReadActiveInvestmentAccounts_(ss);
  accountRow = boundedHoldingsPreviewFindSelectedAccount_(activeRows, payload);
  if (!accountRow) {
    return { ok: false, error: 'Selected investment account is not active in this workbook.' };
  }

  var registryIndex = monthlyCheckinReadRegistryIndex_(ss);
  var lifecycleCounts = boundedHoldingsPreviewInvestmentLifecycleCounts_(activeRows);
  var mapped = boundedHoldingsPreviewMapAccountRow_(accountRow, registryIndex, lifecycleCounts);
  if (!mapped.identityReady) {
    return {
      ok: false,
      error: mapped.identityMessage || 'Financial identity could not be resolved for grouped preview.',
      identityCode: mapped.identityCode
    };
  }
  return {
    ok: true,
    accountRow: accountRow,
    mapped: mapped,
    parentStableAccountId: ensure.stableAccountId,
    parentAggregateValue: accountRow.currentBalance,
    groupConfig: groupConfig
  };
}

function boundedHoldingsPreviewAssignGroupedChildPartition_(providerKey, parentInvestmentId,
  sessionChildren, confirmationToken, recognitionLabel, maskedAccountSignal) {
  sessionChildren = sessionChildren || [];
  var nextSequence = sessionChildren.length + 1;
  var childPartitionId = boundedHoldingsPreviewBuildSessionChildPartitionId_(
    providerKey, parentInvestmentId, nextSequence, confirmationToken);
  return {
    childPartitionId: childPartitionId,
    recognitionLabel: String(recognitionLabel || ('Account ' + nextSequence)).trim(),
    maskedAccountSignal: String(maskedAccountSignal || '').trim().toUpperCase(),
    childSequence: nextSequence,
    confirmed: true
  };
}

function boundedHoldingsPreviewInspectGroupedStatementFromDashboard(payload) {
  return boundedHoldingsPreviewSafe_(function() {
    assertBoundedHoldingsPreviewAllowed_();
    var ss = getUserSpreadsheet_();
    payload = payload || {};
    var groupConfig = boundedHoldingsPreviewMatchGroupProvider_(
      payload.accountName, payload.source || 'M1_STATEMENT_PDF');
    if (!groupConfig) {
      return { ok: false, error: 'Selected account does not support grouped statement preview.' };
    }
    var parentValidation = boundedHoldingsPreviewValidateGroupedParentAccount_(ss, payload, groupConfig);
    if (!parentValidation.ok) return parentValidation;

    var signals = boundedHoldingsPreviewParseGroupedStatementSignals_(
      payload.rawDocumentText, groupConfig.source);
    if (!signals.ok) return signals;

    var sessionChildren = Array.isArray(payload.sessionChildren) ? payload.sessionChildren : [];
    var sessionPreviews = Array.isArray(payload.sessionPreviews) ? payload.sessionPreviews : [];
    var childMatch = boundedHoldingsPreviewResolveGroupedChildMatch_(
      signals, sessionChildren, groupConfig);

    var replay = { outcome: 'ACCEPT_NEW', message: 'New child statement accepted.' };
    if (childMatch.status === 'MATCH_EXISTING' && childMatch.child) {
      replay = boundedHoldingsPreviewClassifyGroupedReplay_({
        childPartitionId: childMatch.child.childPartitionId,
        documentFingerprint: signals.documentFingerprint,
        statementPeriodEnd: signals.statementPeriodEnd,
        contentFingerprint: signals.contentFingerprint,
        sessionPreviews: sessionPreviews
      });
    }

    return {
      ok: true,
      previewMode: 'GROUPED_PROVIDER',
      groupProviderKey: groupConfig.providerKey,
      groupProviderLabel: groupConfig.visibleLabel,
      parentAggregateValue: parentValidation.parentAggregateValue,
      parentStableAccountId: parentValidation.parentStableAccountId,
      parentIsAggregateOnly: true,
      signals: {
        statementPeriodStart: signals.statementPeriodStart,
        statementPeriodEnd: signals.statementPeriodEnd,
        maskedAccountNumber: signals.maskedAccountNumber,
        accountLabel: signals.accountLabel,
        totalAccountValue: signals.totalAccountValue,
        cashBalance: signals.cashBalance,
        holdingsCount: signals.holdingsCount,
        documentFingerprint: signals.documentFingerprint,
        contentFingerprint: signals.contentFingerprint
      },
      childMatch: childMatch,
      replay: replay,
      maskedIdentifierIsMatchingSignalOnly: true
    };
  });
}

function boundedHoldingsPreviewRunGroupedChildFromDashboard(payload) {
  return boundedHoldingsPreviewSafe_(function() {
    assertBoundedHoldingsPreviewAllowed_();
    var ss = getUserSpreadsheet_();
    payload = payload || {};
    var groupConfig = boundedHoldingsPreviewMatchGroupProvider_(
      payload.accountName, payload.source || 'M1_STATEMENT_PDF');
    if (!groupConfig) {
      return { ok: false, error: 'Selected account does not support grouped statement preview.' };
    }
    var parentValidation = boundedHoldingsPreviewValidateGroupedParentAccount_(ss, payload, groupConfig);
    if (!parentValidation.ok) return parentValidation;

    var signals = boundedHoldingsPreviewParseGroupedStatementSignals_(
      payload.rawDocumentText, groupConfig.source);
    if (!signals.ok) return signals;

    var sessionChildren = Array.isArray(payload.sessionChildren) ? payload.sessionChildren.slice() : [];
    var sessionPreviews = Array.isArray(payload.sessionPreviews) ? payload.sessionPreviews.slice() : [];
    var childMatch = boundedHoldingsPreviewResolveGroupedChildMatch_(
      signals, sessionChildren, groupConfig);
    var childPartition = null;
    var newChildAssigned = false;

    if (childMatch.status === 'NEW_CHILD_CONFIRMATION_REQUIRED') {
      if (payload.confirmNewChild !== true) {
        return {
          ok: false,
          error: childMatch.prompt || 'Confirm adding this M1 child account before previewing.',
          childMatch: childMatch,
          requiresConfirmation: true
        };
      }
      var expectedToken = boundedHoldingsPreviewBuildGroupedConfirmationToken_(signals);
      if (String(payload.confirmationToken || '').trim() !== expectedToken) {
        return { ok: false, error: 'Child confirmation token does not match this statement.' };
      }
      childPartition = boundedHoldingsPreviewAssignGroupedChildPartition_(
        groupConfig.providerKey,
        parentValidation.mapped.investmentId,
        sessionChildren,
        expectedToken,
        childMatch.proposedRecognitionLabel,
        childMatch.maskedAccountSignal
      );
      sessionChildren.push(childPartition);
      newChildAssigned = true;
    } else if (childMatch.status === 'MATCH_EXISTING') {
      childPartition = childMatch.child;
    } else if (childMatch.status === 'IDENTITY_REVIEW_REQUIRED' ||
        childMatch.status === 'CHILD_LIMIT_REACHED') {
      return { ok: false, error: childMatch.message, childMatch: childMatch };
    } else {
      return { ok: false, error: 'Unable to resolve grouped child account.', childMatch: childMatch };
    }

    var replay = boundedHoldingsPreviewClassifyGroupedReplay_({
      childPartitionId: childPartition.childPartitionId,
      documentFingerprint: signals.documentFingerprint,
      statementPeriodEnd: signals.statementPeriodEnd,
      contentFingerprint: signals.contentFingerprint,
      sessionPreviews: sessionPreviews
    });

    if (replay.outcome === 'DUPLICATE_NOOP') {
      var existing = sessionPreviews.filter(function(row) {
        return String(row.childPartitionId) === String(childPartition.childPartitionId) &&
          String(row.documentFingerprint) === String(signals.documentFingerprint);
      })[0];
      return {
        ok: true,
        previewMode: 'GROUPED_PROVIDER',
        replayOutcome: replay.outcome,
        replayMessage: replay.message,
        duplicateNoop: true,
        childPartition: childPartition,
        sessionChildren: sessionChildren,
        sessionPreview: existing || null,
        reconciliation: boundedHoldingsPreviewBuildGroupedReconciliation_(
          parentValidation.parentAggregateValue, sessionPreviews, groupConfig, sessionChildren)
      };
    }

    if (replay.outcome === 'CONFLICT_REVIEW_REQUIRED') {
      return {
        ok: false,
        replayOutcome: replay.outcome,
        replayMessage: replay.message,
        childPartition: childPartition,
        childMatch: childMatch,
        requiresReview: true
      };
    }

    if (replay.outcome === 'IDENTITY_REVIEW_REQUIRED') {
      return { ok: false, replayOutcome: replay.outcome, replayMessage: replay.message };
    }

    var registrationType = String(payload.registrationType || '').trim() ||
      parentValidation.mapped.suggestedRegistrationType ||
      groupConfig.defaultRegistrationType;
    registrationType = investmentPortfolioNormalizeRegistrationType_(registrationType);
    if (!registrationType) {
      return { ok: false, error: 'registrationType is required.' };
    }
    if (payload.explicitAccountMatch !== true) {
      return { ok: false, error: 'Explicit account-match confirmation is required.' };
    }

    var childStableAccountId = String(childPartition.childPartitionId || '').trim();
    if (!childStableAccountId ||
        childStableAccountId === String(parentValidation.parentStableAccountId || '').trim()) {
      return { ok: false, error: 'Internal child preview identity is invalid.' };
    }
    if (/^X{2,}\d+$/i.test(childStableAccountId) || /^XXXX/i.test(childStableAccountId)) {
      return { ok: false, error: 'Masked account numbers cannot be used as stableAccountId.' };
    }

    var previewPayload = {
      source: groupConfig.source,
      rawDocumentText: payload.rawDocumentText,
      stableAccountId: childStableAccountId,
      accountName: String(childPartition.recognitionLabel || '').trim(),
      registrationType: registrationType,
      explicitAccountMatch: true
    };
    var preview = holdingsPreviewLabBuildPreview_(previewPayload);
    if (!preview.ok) return preview;

    var sessionPreview = {
      childPartitionId: childPartition.childPartitionId,
      recognitionLabel: childPartition.recognitionLabel,
      maskedAccountSignal: childPartition.maskedAccountSignal,
      statementPeriodEnd: signals.statementPeriodEnd,
      statementPeriodStart: signals.statementPeriodStart,
      statementAccountLabel: signals.accountLabel,
      statementAccountTitle: signals.accountTitle,
      statementAccountType: signals.accountType,
      statementSourceMaskedAccountNumber: signals.maskedAccountNumber,
      parentGroupLabel: groupConfig.visibleLabel,
      documentFingerprint: signals.documentFingerprint,
      contentFingerprint: signals.contentFingerprint,
      source: groupConfig.source,
      replayOutcome: replay.outcome,
      totalAccountValue: preview.totalAccountValue,
      cashBalance: preview.cashBalance != null ? preview.cashBalance : signals.cashBalance,
      equitiesSubtotal: signals.equitiesSubtotal,
      cashPlusEquitiesReconciles: signals.cashPlusEquitiesReconciles,
      holdingsCount: (preview.holdingsRows || []).length,
      matchStatus: preview.account && preview.account.matchStatus,
      previewScopeLabel: 'Previewed accounts only.',
      preview: preview
    };

    var nextPreviews = sessionPreviews.slice();
    nextPreviews.push(sessionPreview);

    return {
      ok: true,
      previewMode: 'GROUPED_PROVIDER',
      replayOutcome: replay.outcome,
      replayMessage: replay.message,
      newChildAssigned: newChildAssigned,
      childPartition: childPartition,
      sessionChildren: sessionChildren,
      sessionPreview: sessionPreview,
      preview: preview,
      reconciliation: boundedHoldingsPreviewBuildGroupedReconciliation_(
        parentValidation.parentAggregateValue, nextPreviews, groupConfig, sessionChildren),
      aggregate: boundedHoldingsPreviewAggregateGroupedSession_(nextPreviews, groupConfig),
      parentIsAggregateOnly: true,
      maskedIdentifierIsMatchingSignalOnly: true
    };
  });
}

function boundedHoldingsPreviewAggregateGroupedFromDashboard(payload) {
  return boundedHoldingsPreviewSafe_(function() {
    assertBoundedHoldingsPreviewAllowed_();
    var ss = getUserSpreadsheet_();
    payload = payload || {};
    var groupConfig = boundedHoldingsPreviewMatchGroupProvider_(
      payload.accountName, payload.source || 'M1_STATEMENT_PDF');
    if (!groupConfig) {
      return { ok: false, error: 'Selected account does not support grouped statement preview.' };
    }
    var parentValidation = boundedHoldingsPreviewValidateGroupedParentAccount_(ss, payload, groupConfig);
    if (!parentValidation.ok) return parentValidation;

    var sessionChildren = Array.isArray(payload.sessionChildren) ? payload.sessionChildren : [];
    var sessionPreviews = Array.isArray(payload.sessionPreviews) ? payload.sessionPreviews : [];

    return {
      ok: true,
      previewMode: 'GROUPED_PROVIDER',
      reconciliation: boundedHoldingsPreviewBuildGroupedReconciliation_(
        parentValidation.parentAggregateValue, sessionPreviews, groupConfig, sessionChildren),
      aggregate: boundedHoldingsPreviewAggregateGroupedSession_(sessionPreviews, groupConfig),
      parentIsAggregateOnly: true
    };
  });
}

function boundedHoldingsPreviewSelectLatestGroupedPreviews_(sessionPreviews) {
  var latestByChild = Object.create(null);
  (sessionPreviews || []).forEach(function(row, index) {
    var childId = String(row.childPartitionId || '').trim();
    if (!childId) return;
    var existing = latestByChild[childId];
    if (!existing) {
      latestByChild[childId] = { row: row, index: index };
      return;
    }
    var existingPeriod = String(existing.row.statementPeriodEnd || '');
    var nextPeriod = String(row.statementPeriodEnd || '');
    if (nextPeriod > existingPeriod || (!existingPeriod && nextPeriod)) {
      latestByChild[childId] = { row: row, index: index };
      return;
    }
    if (nextPeriod === existingPeriod && index > existing.index) {
      latestByChild[childId] = { row: row, index: index };
    }
  });
  return Object.keys(latestByChild).map(function(key) {
    return latestByChild[key].row;
  });
}

function boundedHoldingsPreviewBuildGroupedReconciliation_(parentAggregateValue, sessionPreviews,
  groupConfig, sessionChildren) {
  sessionPreviews = sessionPreviews || [];
  sessionChildren = sessionChildren || [];
  groupConfig = groupConfig || {};
  var latestPreviews = boundedHoldingsPreviewSelectLatestGroupedPreviews_(sessionPreviews);
  var childPreviewedValueSum = 0;
  latestPreviews.forEach(function(row) {
    var value = Number(row.totalAccountValue);
    if (isFinite(value)) childPreviewedValueSum += value;
  });
  childPreviewedValueSum = round2_(childPreviewedValueSum);
  var parentValue = parentAggregateValue === '' || parentAggregateValue === null ||
    typeof parentAggregateValue === 'undefined'
    ? null : round2_(Number(parentAggregateValue));
  var difference = parentValue === null ? null : round2_(parentValue - childPreviewedValueSum);
  var distinctChildAccountsObserved = sessionChildren.length;
  var statementPreviewsLoaded = sessionPreviews.length;
  var fiveDistinctChildrenObserved = distinctChildAccountsObserved >=
    Number(groupConfig.maxChildAccounts || 5);
  return {
    label: String(groupConfig.reconciliationLabel || 'Previewed child accounts only.'),
    parentAggregateValue: parentValue,
    parentExcludedFromChildTotals: true,
    childPreviewedValueSum: childPreviewedValueSum,
    difference: difference,
    distinctChildAccountsObserved: distinctChildAccountsObserved,
    statementPreviewsLoaded: statementPreviewsLoaded,
    assumedCompleteChildCount: fiveDistinctChildrenObserved
      ? Number(groupConfig.maxChildAccounts || 5) : null,
    allExpectedStatementsPresent: fiveDistinctChildrenObserved
      ? statementPreviewsLoaded >= Number(groupConfig.maxChildAccounts || 5)
      : null
  };
}

function boundedHoldingsPreviewAggregateGroupedSession_(sessionPreviews, groupConfig) {
  var allPreviews = sessionPreviews || [];
  var latestPreviews = boundedHoldingsPreviewSelectLatestGroupedPreviews_(allPreviews);
  groupConfig = groupConfig || {};
  var items = latestPreviews.map(function(row) {
    var preview = row.preview || row;
    return {
      source: row.source || groupConfig.source,
      cashBalance: preview.cashBalance != null ? preview.cashBalance : row.cashBalance,
      account: {
        stableAccountId: String(row.childPartitionId || '') + '|' +
          String(row.statementPeriodEnd || ''),
        displayName: String(row.recognitionLabel || '')
      },
      analysis: (preview.analysis || {}),
      holdingsRows: (preview.holdingsRows || [])
    };
  });
  var aggregate = holdingsPreviewLabAggregateSessionPreviews_(items);
  aggregate.scopeLabel = 'Previewed accounts only.';
  aggregate.parentAggregateExcluded = true;
  aggregate.groupProviderKey = groupConfig.providerKey;
  aggregate.childAccountCount = items.length;
  aggregate.statementPreviewCount = allPreviews.length;
  return aggregate;
}

function boundedHoldingsPreviewRemoveGroupedSessionPreview_(sessionPreviews, childPartitionId,
  documentFingerprint) {
  sessionPreviews = sessionPreviews || [];
  childPartitionId = String(childPartitionId || '').trim();
  documentFingerprint = String(documentFingerprint || '').trim();
  return sessionPreviews.filter(function(row) {
    if (String(row.childPartitionId) !== childPartitionId) return true;
    if (documentFingerprint && String(row.documentFingerprint) === documentFingerprint) return false;
    return !!documentFingerprint;
  });
}

function boundedHoldingsPreviewRemoveGroupedSessionChild_(sessionChildren, sessionPreviews,
  childPartitionId) {
  childPartitionId = String(childPartitionId || '').trim();
  return {
    sessionChildren: (sessionChildren || []).filter(function(row) {
      return String(row.childPartitionId) !== childPartitionId;
    }),
    sessionPreviews: (sessionPreviews || []).filter(function(row) {
      return String(row.childPartitionId) !== childPartitionId;
    })
  };
}
