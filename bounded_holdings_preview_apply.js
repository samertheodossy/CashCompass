/**
 * bounded_holdings_preview_apply.js — Bounded unified holdings Apply workflow.
 *
 * Preview remains read-only until explicit Apply confirmation. Holdings write
 * SYS - Investment Holdings Unified. Trusted single-account Schwab/M1/Stash/Fidelity
 * 401(k) Apply may also write the statement month through the canonical
 * investment value writer. Fidelity 401(k) is balance-only: it never proposes
 * unified holdings rows. Samer Etrade Account uses the same Unified holdings
 * Apply plus monthly INPUT value. E*TRADE Cisco combined and Future potential
 * paths remain monthly-value only.
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

function boundedHoldingsPreviewApplyRebuildEtradeSamerBrokeragePreview_(ss, payload, accountValidation) {
  payload = payload || {};
  var mapping = typeof investmentEtradeSamerBrokerageAccountValueMapping_ === 'function'
    ? investmentEtradeSamerBrokerageAccountValueMapping_()
    : {
      accountName: 'Samer Etrade Account',
      source: 'ETRADE_CLIENT_STATEMENT_PDF'
    };
  if (payload.explicitAccountMatch !== true) {
    return {
      ok: false,
      error: 'Confirm this document belongs to ' + mapping.accountName + '.'
    };
  }
  var previewPayload = Object.assign({}, payload || {}, {
    stableAccountId: accountValidation && accountValidation.stableAccountId,
    registrationType: accountValidation && accountValidation.registrationType,
    explicitAccountMatch: true,
    source: mapping.source,
    accountName: String(payload.accountName || '').trim() || mapping.accountName
  });
  accountValidation = accountValidation ||
    boundedHoldingsPreviewValidateSelectedAccount_(ss, previewPayload);
  if (!accountValidation.ok) return accountValidation;
  if (typeof investmentEtradeMatchesSamerBrokerageAccountValueMapping_ !== 'function' ||
      !investmentEtradeMatchesSamerBrokerageAccountValueMapping_(
        accountValidation.accountName, mapping.source)) {
    return {
      ok: false,
      error: 'Select ' + mapping.accountName + ' before applying this E*TRADE statement.'
    };
  }
  var preview = holdingsPreviewLabBuildPreview_(previewPayload);
  if (!preview.ok) return preview;
  var parsed = typeof investmentEtradeClientStatementParseText_ === 'function'
    ? investmentEtradeClientStatementParseText_(payload.rawDocumentText)
    : { ok: false, error: 'E*TRADE client statement parser is unavailable.' };
  if (typeof investmentEtradeAttachSamerBrokeragePreviewContract_ === 'function') {
    preview = investmentEtradeAttachSamerBrokeragePreviewContract_(
      preview, parsed, accountValidation.accountName);
  }
  if (!preview || !preview.ok) {
    return preview && preview.ok === false ? preview : {
      ok: false,
      error: 'Could not validate the Samer Etrade Account statement.'
    };
  }
  var reviewCheck = boundedHoldingsPreviewApplyRejectReviewRequiredPreview_(preview);
  if (!reviewCheck.ok) return reviewCheck;
  var documentFingerprint = boundedHoldingsPreviewApplyBuildDocumentFingerprint_(
    mapping.source, payload.rawDocumentText);
  if (!documentFingerprint) {
    return { ok: false, error: 'Document fingerprint could not be built for Apply.' };
  }
  return {
    ok: true,
    accountValidation: accountValidation,
    preview: preview,
    documentFingerprint: documentFingerprint,
    scope: boundedHoldingsPreviewApplyBuildSingleScope_(
      accountValidation, preview, previewPayload, documentFingerprint)
  };
}

function boundedHoldingsPreviewApplyRebuildEtradeFuturePreview_(ss, payload, accountValidation) {
  payload = payload || {};
  var mapping = typeof investmentEtradePotentialUnvestedStockPlanMapping_ === 'function'
    ? investmentEtradePotentialUnvestedStockPlanMapping_()
    : {
      accountName: 'Etrade Cisco - Future',
      source: 'ETRADE_CLIENT_STATEMENT_PDF'
    };
  if (payload.explicitAccountMatch !== true) {
    return {
      ok: false,
      error: 'Confirm this document belongs to ' + mapping.accountName + '.'
    };
  }
  var previewPayload = Object.assign({}, payload, {
    source: mapping.source,
    accountName: String(payload.accountName || '').trim() || mapping.accountName,
    explicitAccountMatch: true
  });
  accountValidation = accountValidation ||
    boundedHoldingsPreviewValidateSelectedAccount_(ss, previewPayload);
  if (!accountValidation.ok) return accountValidation;
  if (typeof investmentEtradeMatchesPotentialUnvestedStockPlanMapping_ !== 'function' ||
      !investmentEtradeMatchesPotentialUnvestedStockPlanMapping_(
        accountValidation.accountName, mapping.source)) {
    return {
      ok: false,
      error: 'Select ' + mapping.accountName +
        ' before applying the potential/unvested stock-plan value.'
    };
  }
  var parsed = typeof investmentEtradeClientStatementParseText_ === 'function'
    ? investmentEtradeClientStatementParseText_(payload.rawDocumentText)
    : { ok: false, error: 'E*TRADE client statement parser is unavailable.' };
  if (!parsed || !parsed.ok) {
    return {
      ok: false,
      error: (parsed && parsed.error) ? parsed.error : 'Could not parse E*TRADE statement.'
    };
  }
  var preview = typeof investmentEtradeNormalizePotentialUnvestedMonthlyPreview_ === 'function'
    ? investmentEtradeNormalizePotentialUnvestedMonthlyPreview_(parsed)
    : { ok: false, error: 'Potential/unvested stock-plan mapping is unavailable.' };
  if (!preview || !preview.ok) {
    return {
      ok: false,
      error: (preview && preview.error) ? preview.error :
        'Could not normalize the potential/unvested stock-plan value.'
    };
  }
  var reviewCheck = boundedHoldingsPreviewApplyRejectReviewRequiredPreview_(preview);
  if (!reviewCheck.ok) return reviewCheck;
  var documentFingerprint = boundedHoldingsPreviewApplyBuildDocumentFingerprint_(
    mapping.source, payload.rawDocumentText);
  if (!documentFingerprint) {
    return { ok: false, error: 'Document fingerprint could not be built for Apply.' };
  }
  return {
    ok: true,
    accountValidation: accountValidation,
    preview: preview,
    documentFingerprint: documentFingerprint,
    scope: boundedHoldingsPreviewApplyBuildSingleScope_(
      accountValidation, preview, previewPayload, documentFingerprint)
  };
}

function boundedHoldingsPreviewApplyValidateCiscoStatementProfileTarget_(ss, accountName, payload) {
  payload = payload || {};
  var wanted = String(accountName || '').trim();
  if (!wanted) {
    return { ok: false, error: 'E*TRADE Cisco statement target account is missing.' };
  }
  if (typeof investmentEtradeCiscoStatementProfileCombinedAccountName_ === 'function' &&
      wanted === investmentEtradeCiscoStatementProfileCombinedAccountName_()) {
    return {
      ok: false,
      error: 'E*TRADE Cisco statement legs must keep Etrade Cisco - RSU/ESPP and Etrade Cisco - Future as separate accounts.'
    };
  }
  var activeRows = typeof boundedHoldingsPreviewReadActiveInvestmentAccounts_ === 'function'
    ? boundedHoldingsPreviewReadActiveInvestmentAccounts_(ss) : [];
  var matches = (activeRows || []).filter(function(row) {
    return String(row.accountName || '').trim() === wanted;
  });
  if (matches.length !== 1) {
    return {
      ok: false,
      error: 'Could not find active CashCompass account "' + wanted + '".'
    };
  }
  var row = matches[0];
  return boundedHoldingsPreviewValidateSelectedAccount_(ss, {
    accountName: row.accountName,
    pickerValue: row.investmentId,
    investmentId: row.investmentId,
    sysAssetsRow: row.sysAssetsRow,
    explicitAccountMatch: true,
    registrationType: String(payload.registrationType || '').trim() || 'TAXABLE',
    statementProvider: 'ETRADE'
  });
}

function boundedHoldingsPreviewApplyRebuildEtradeCiscoStatementProfilePreview_(ss, payload) {
  payload = payload || {};
  var profile = typeof investmentEtradeCiscoStatementImportProfile_ === 'function'
    ? investmentEtradeCiscoStatementImportProfile_()
    : null;
  if (!profile) {
    return { ok: false, error: 'E*TRADE Cisco statement profile is unavailable.' };
  }
  if (payload.explicitAccountMatch !== true) {
    return {
      ok: false,
      error: 'Confirm this document belongs to ' + profile.confirmLabel + '.'
    };
  }
  var parsed = typeof investmentEtradeClientStatementParseText_ === 'function'
    ? investmentEtradeClientStatementParseText_(payload.rawDocumentText)
    : { ok: false, error: 'E*TRADE client statement parser is unavailable.' };
  if (!parsed || !parsed.ok) {
    return {
      ok: false,
      error: (parsed && parsed.error) ? parsed.error : 'Could not parse E*TRADE statement.'
    };
  }
  var preview = typeof investmentEtradeNormalizeCiscoStatementProfilePreview_ === 'function'
    ? investmentEtradeNormalizeCiscoStatementProfilePreview_(parsed)
    : { ok: false, error: 'E*TRADE Cisco statement profile mapping is unavailable.' };
  if (!preview || !preview.ok) {
    return {
      ok: false,
      error: (preview && preview.error) ? preview.error :
        'Could not normalize the E*TRADE Cisco statement.'
    };
  }
  var reviewCheck = boundedHoldingsPreviewApplyRejectReviewRequiredPreview_(preview);
  if (!reviewCheck.ok) return reviewCheck;
  var targetValidations = [];
  var i;
  for (i = 0; i < (profile.legs || []).length; i++) {
    var validation = boundedHoldingsPreviewApplyValidateCiscoStatementProfileTarget_(
      ss, profile.legs[i].accountName, payload);
    if (!validation.ok) return validation;
    targetValidations.push(validation);
  }
  var documentFingerprint = boundedHoldingsPreviewApplyBuildDocumentFingerprint_(
    profile.source, payload.rawDocumentText);
  if (!documentFingerprint) {
    return { ok: false, error: 'Document fingerprint could not be built for Apply.' };
  }
  return {
    ok: true,
    accountValidation: null,
    targetValidations: targetValidations,
    preview: preview,
    documentFingerprint: documentFingerprint,
    scope: {
      mode: 'SINGLE_ACCOUNT',
      source: profile.source,
      provider: boundedHoldingsPreviewApplyProviderLabel_(profile.source, ''),
      parentAccountName: '',
      investmentId: profile.pickerValue,
      parentStableAccountId: '',
      accountIdentityKey: profile.pickerValue,
      childPartitionId: '',
      recognitionLabel: '',
      documentFingerprint: documentFingerprint,
      contentFingerprint: boundedHoldingsPreviewApplyBuildContentFingerprintFromPreview_(preview),
      asOfDate: boundedHoldingsPreviewApplyNormalizeAsOfDate_(preview.asOf),
      statementPeriodEnd: boundedHoldingsPreviewApplyNormalizeAsOfDate_(preview.asOf)
    }
  };
}

function boundedHoldingsPreviewApplyRebuildFidelity401kPreview_(ss, payload) {
  payload = payload || {};
  if (payload.explicitAccountMatch !== true) {
    return {
      ok: false,
      error: 'Confirm this document belongs to the selected 401K Account.'
    };
  }
  var previewPayload = Object.assign({}, payload, {
    source: 'FIDELITY_401K_STATEMENT_PDF',
    accountName: String(payload.accountName || '').trim() || '401K Account',
    registrationType: String(payload.registrationType || '').trim() || '401K',
    explicitAccountMatch: true
  });
  var accountValidation = boundedHoldingsPreviewValidateSelectedAccount_(ss, previewPayload);
  if (!accountValidation.ok) return accountValidation;
  if (!/^401K Account$/i.test(String(accountValidation.accountName || '').trim())) {
    return {
      ok: false,
      error: 'Select the 401K Account before applying a retirement savings statement.'
    };
  }
  var parsed = typeof investmentFidelity401kStatementPreviewFromText_ === 'function'
    ? investmentFidelity401kStatementPreviewFromText_(payload.rawDocumentText)
    : { ok: false, error: 'Fidelity 401(k) parser is unavailable.' };
  if (!parsed || !parsed.ok) {
    return {
      ok: false,
      error: (parsed && parsed.error) ? parsed.error : 'Could not parse retirement savings statement.'
    };
  }
  var preview = typeof investmentFidelity401kStatementNormalizeMonthlyPreview_ === 'function'
    ? investmentFidelity401kStatementNormalizeMonthlyPreview_(parsed)
    : parsed;
  if (!preview || !preview.ok) {
    return {
      ok: false,
      error: (preview && preview.error) ? preview.error : 'Could not normalize retirement savings statement.'
    };
  }
  var reviewCheck = boundedHoldingsPreviewApplyRejectReviewRequiredPreview_(preview);
  if (!reviewCheck.ok) return reviewCheck;
  var documentFingerprint = boundedHoldingsPreviewApplyBuildDocumentFingerprint_(
    'FIDELITY_401K_STATEMENT_PDF', payload.rawDocumentText);
  if (!documentFingerprint) {
    return { ok: false, error: 'Document fingerprint could not be built for Apply.' };
  }
  return {
    ok: true,
    accountValidation: accountValidation,
    preview: preview,
    documentFingerprint: documentFingerprint,
    scope: boundedHoldingsPreviewApplyBuildSingleScope_(
      accountValidation, preview, previewPayload, documentFingerprint)
  };
}

function boundedHoldingsPreviewApplyRebuildSinglePreview_(ss, payload) {
  payload = payload || {};
  if (typeof investmentPortfolioDrawerGuardCustomerProductionImport_ === 'function') {
    var customerGate = investmentPortfolioDrawerGuardCustomerProductionImport_(ss, payload);
    if (!customerGate.ok) return customerGate;
  }
  var requestedSource = typeof investmentPortfolioNormalizeSource_ === 'function'
    ? investmentPortfolioNormalizeSource_(payload.source || '')
    : String(payload.source || '').trim().toUpperCase();
  if (requestedSource === 'FIDELITY_401K_STATEMENT_PDF') {
    return boundedHoldingsPreviewApplyRebuildFidelity401kPreview_(ss, payload);
  }
  if (requestedSource === 'ETRADE_CLIENT_STATEMENT_PDF') {
    if (typeof investmentEtradeMatchesCiscoStatementImportProfile_ === 'function' &&
        investmentEtradeMatchesCiscoStatementImportProfile_(payload.pickerValue)) {
      return boundedHoldingsPreviewApplyRebuildEtradeCiscoStatementProfilePreview_(ss, payload);
    }
    var etradeAccountValidation = boundedHoldingsPreviewValidateSelectedAccount_(ss, payload);
    if (!etradeAccountValidation.ok) return etradeAccountValidation;
    if (typeof investmentEtradeMatchesPotentialUnvestedStockPlanMapping_ === 'function' &&
        investmentEtradeMatchesPotentialUnvestedStockPlanMapping_(
          etradeAccountValidation.accountName, requestedSource)) {
      return boundedHoldingsPreviewApplyRebuildEtradeFuturePreview_(
        ss, payload, etradeAccountValidation);
    }
    if (typeof investmentEtradeMatchesSamerBrokerageAccountValueMapping_ === 'function' &&
        investmentEtradeMatchesSamerBrokerageAccountValueMapping_(
          etradeAccountValidation.accountName, requestedSource)) {
      return boundedHoldingsPreviewApplyRebuildEtradeSamerBrokeragePreview_(
        ss, payload, etradeAccountValidation);
    }
  }
  var accountValidation = boundedHoldingsPreviewValidateSelectedAccount_(ss, payload);
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
  payload = Object.assign({}, payload, {
    source: payload.source || 'M1_STATEMENT_PDF'
  });
  if (typeof investmentPortfolioDrawerGuardCustomerProductionImport_ === 'function') {
    var customerGate = investmentPortfolioDrawerGuardCustomerProductionImport_(ss, payload);
    if (!customerGate.ok) return customerGate;
  }
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
  var single = null;

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
    single = boundedHoldingsPreviewApplyRebuildSinglePreview_(ss, payload);
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

  var monthlyProposals = boundedHoldingsPreviewApplyBuildMonthlyInvestmentValueProposals_(
    payload, mode, accountValidation, preview, single && single.targetValidations);
  var monthlyProposal = monthlyProposals[0] ||
    boundedHoldingsPreviewApplyBuildMonthlySkip_('UNSUPPORTED_SOURCE',
      'This statement type does not propose a monthly investment value.');

  var diffDigest = boundedHoldingsPreviewApplyBuildDiffDigest_({
    mode: mode,
    investmentId: scopes[0] && scopes[0].investmentId,
    parentStableAccountId: scopes[0] && scopes[0].parentStableAccountId,
    documentFingerprint: mode === 'SINGLE_ACCOUNT' ? documentFingerprint : '',
    groupedDigestPart: mode === 'GROUPED_PROVIDER'
      ? boundedHoldingsPreviewApplyBuildGroupedDigestPart_(scopes) : '',
    proposedRows: proposedRows,
    existingRows: existingRows,
    monthlyDigestPart: monthlyProposals.map(boundedHoldingsPreviewApplyMonthlyDigestPart_)
  });

  var diffPreview = boundedHoldingsPreviewApplyBuildDiffPreview_(diff, scopes, replayOutcomes);
  var monthlyWillWrite = monthlyProposals.some(function(item) { return item && item.willWrite; });
  var holdingsDuplicateNoop = !!diff.duplicateNoop || !!diffPreview.duplicateNoop;
  diffPreview.applyEligible = !diff.blocked &&
    replayOutcomes.every(function(item) {
      return item && item.outcome !== 'IDENTITY_REVIEW_REQUIRED';
    });
  diffPreview.targetSheet = boundedHoldingsPreviewApplyUnifiedSheetName_();
  diffPreview.sheetExists = !!ss.getSheetByName(boundedHoldingsPreviewApplyUnifiedSheetName_());
  diffPreview.monthlyInvestmentValue =
    boundedHoldingsPreviewApplySanitizeMonthlyValueForClient_(monthlyProposal);
  diffPreview.monthlyInvestmentValues = monthlyProposals.map(
    boundedHoldingsPreviewApplySanitizeMonthlyValueForClient_);
  diffPreview.inputInvestmentsUnchanged = !monthlyWillWrite;
  diffPreview.monthlyHistoryUnchanged = true;
  diffPreview.holdingsDuplicateNoop = holdingsDuplicateNoop;
  diffPreview.duplicateNoop = holdingsDuplicateNoop && !monthlyWillWrite;

  return {
    ok: true,
    mode: mode,
    diffDigest: diffDigest,
    duplicateNoop: holdingsDuplicateNoop && !monthlyWillWrite,
    applyEligible: diffPreview.applyEligible,
    replayOutcomes: replayOutcomes,
    diff: diffPreview,
    monthlyProposal: monthlyProposal,
    monthlyProposals: monthlyProposals,
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
    boundedHoldingsPreviewApplyLogMonthlyValueActivity_(ss, payload, bundle, 'STALE_REJECTED');
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

  var monthlyProposals = boundedHoldingsPreviewApplyMonthlyProposalsFromBundle_(bundle, payload, mode);
  var monthlyProposal = monthlyProposals[0] || {};
  var monthlyWillWrite = monthlyProposals.some(function(item) { return item && item.willWrite; });
  var holdingsDuplicateNoop = !!(bundle.diff && bundle.diff.holdingsDuplicateNoop) ||
    boundedHoldingsPreviewApplyIsDuplicateNoopDiff_(
      boundedHoldingsPreviewApplyBuildDiff_(bundle.existingRows, bundle.proposedRows),
      bundle.replayOutcomes);

  var diff = boundedHoldingsPreviewApplyBuildDiff_(bundle.existingRows, bundle.proposedRows);
  if (diff.blocked) {
    return {
      ok: false,
      error: diff.blockReason || 'Conflicting unified holdings rows must be reviewed before Apply.',
      blocked: true
    };
  }

  var holdingsWillWrite = !holdingsDuplicateNoop &&
    ((diff.create || []).length > 0 || (diff.update || []).length > 0);
  if (!holdingsWillWrite && !monthlyWillWrite) {
    boundedHoldingsPreviewApplyLogMonthlyValueActivity_(ss, payload, bundle, 'SKIPPED');
    return {
      ok: true,
      duplicateNoop: true,
      importRunRef: '',
      message: holdingsDuplicateNoop
        ? 'Exact same document already applied — no change.'
        : 'No holdings or monthly investment-value changes to apply.',
      inputInvestmentsUnchanged: true,
      monthlyHistoryUnchanged: true,
      diff: bundle.diff
    };
  }

  var importRunRef = '';
  var importedAt = '';
  var writeResult = {
    ok: true,
    created: 0,
    updated: 0,
    sheetCreated: false,
    importRunRef: '',
    rowResults: [],
    rollback: null
  };
  if (holdingsWillWrite) {
    importRunRef = boundedHoldingsPreviewApplyBuildImportRunRef_();
    importedAt = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
    writeResult = boundedHoldingsPreviewApplyWriteDiff_(ss, diff, importRunRef, importedAt);
  }

  var monthlyWritten = false;
  if (monthlyWillWrite) {
    try {
      boundedHoldingsPreviewApplyWriteMonthlyInvestmentValues_(monthlyProposals);
      monthlyWritten = true;
    } catch (monthlyErr) {
      if (holdingsWillWrite && writeResult && writeResult.rollback) {
        var unifiedSheet = ss.getSheetByName(boundedHoldingsPreviewApplyUnifiedSheetName_());
        if (unifiedSheet) {
          boundedHoldingsPreviewApplyRollbackWrites_(unifiedSheet, writeResult.rollback);
          try { boundedHoldingsPreviewApplyFormatUnifiedSheet_(unifiedSheet); } catch (_fmtErr) { /* cosmetic */ }
        }
      }
      boundedHoldingsPreviewApplyLogMonthlyValueActivity_(ss, payload, bundle, 'FAILED');
      return {
        ok: false,
        error: 'Monthly investment value could not be saved. Holdings changes were not kept. ' +
          String(monthlyErr && monthlyErr.message ? monthlyErr.message : monthlyErr),
        rolledBack: true,
        inputInvestmentsUnchanged: true,
        monthlyHistoryUnchanged: true
      };
    }
  } else {
    boundedHoldingsPreviewApplyLogMonthlyValueActivity_(ss, payload, bundle, 'SKIPPED');
  }
  if (monthlyWritten) {
    boundedHoldingsPreviewApplyLogMonthlyValueActivity_(ss, payload, bundle, 'APPLIED');
  }

  var holdingsMessage = holdingsWillWrite
    ? ('Applied ' + writeResult.created + ' new and ' + writeResult.updated +
      ' updated holdings rows to ' + boundedHoldingsPreviewApplyUnifiedSheetName_() + '.')
    : (holdingsDuplicateNoop ? 'Holdings were already applied.' : 'No holdings rows changed.');
  var writtenAccounts = monthlyProposals.filter(function(item) {
    return item && item.willWrite;
  }).map(function(item) {
    return String(item.accountName || 'the selected account');
  });
  var monthlyMessage = monthlyWritten
    ? (' Saved ' + String(monthlyProposal.monthLabel || 'the statement month') +
      ' investment value for ' + writtenAccounts.join(' and ') + '.')
    : '';

  return {
    ok: true,
    duplicateNoop: false,
    importRunRef: writeResult.importRunRef || importRunRef,
    created: writeResult.created || 0,
    updated: writeResult.updated || 0,
    sheetCreated: !!writeResult.sheetCreated,
    targetSheet: boundedHoldingsPreviewApplyUnifiedSheetName_(),
    inputInvestmentsUnchanged: !monthlyWritten,
    monthlyHistoryUnchanged: true,
    monthlyInvestmentValueWritten: monthlyWritten,
    rowResults: writeResult.rowResults || [],
    diff: bundle.diff,
    message: String(holdingsMessage + monthlyMessage).trim()
  };
}

function boundedHoldingsPreviewApplyWriteMonthlyInvestmentValue_(proposal) {
  proposal = proposal || {};
  if (!proposal.willWrite) return { ok: true, written: false };
  if (typeof updateInvestmentValueByDate !== 'function') {
    throw new Error('Investment value writer is unavailable.');
  }
  var result = updateInvestmentValueByDate({
    accountName: proposal.accountName,
    balanceDate: proposal.asOfDate,
    currentValue: proposal.proposedValue,
    skipActivityLog: true
  });
  if (result && result.ok === false) {
    throw new Error(result.error || result.message || 'Monthly investment value could not be saved.');
  }
  return { ok: true, written: true };
}

function boundedHoldingsPreviewApplyMonthlyProposalsFromBundle_(bundle, payload, mode) {
  bundle = bundle || {};
  if (Array.isArray(bundle.monthlyProposals) && bundle.monthlyProposals.length) {
    return bundle.monthlyProposals;
  }
  if (bundle.monthlyProposal) return [bundle.monthlyProposal];
  return [boundedHoldingsPreviewApplyBuildMonthlyInvestmentValueProposal_(
    payload, mode, bundle.accountValidation, bundle.preview)];
}

function boundedHoldingsPreviewApplyRestoreMonthlyInvestmentValue_(proposal) {
  proposal = proposal || {};
  var parsed = boundedHoldingsPreviewApplyParseStatementDate_(proposal.asOfDate);
  if (!parsed) {
    throw new Error('Cannot restore monthly investment value without a statement date.');
  }
  if (proposal.existingPresent) {
    if (typeof updateInvestmentValueByDate !== 'function') {
      throw new Error('Investment value writer is unavailable.');
    }
    var restore = updateInvestmentValueByDate({
      accountName: proposal.accountName,
      balanceDate: proposal.asOfDate,
      currentValue: proposal.existingValue,
      skipActivityLog: true
    });
    if (restore && restore.ok === false) {
      throw new Error(restore.error || restore.message || 'Could not restore the prior monthly value.');
    }
    return { ok: true };
  }
  var ss = getUserSpreadsheet_();
  var sheet = getSheet_(ss, 'INVESTMENTS');
  var block = getInvestmentsYearBlock_(sheet, parsed.year);
  var accountRow = findInvestmentRowInBlock_(sheet, block, proposal.accountName);
  if (accountRow === -1) {
    throw new Error('Could not restore investment "' + proposal.accountName + '".');
  }
  var monthCol = getMonthColumnByDate_(sheet, parsed.date, block.headerRow);
  sheet.getRange(accountRow, monthCol).setValue('');
  if (typeof syncAllAssetsFromLatestCurrentYear_ === 'function') {
    syncAllAssetsFromLatestCurrentYear_();
  }
  if (typeof touchDashboardSourceUpdated_ === 'function') {
    touchDashboardSourceUpdated_('investments');
  }
  return { ok: true };
}

function boundedHoldingsPreviewApplyWriteMonthlyInvestmentValues_(proposals) {
  proposals = proposals || [];
  var written = [];
  var i;
  try {
    for (i = 0; i < proposals.length; i++) {
      if (!proposals[i] || !proposals[i].willWrite) continue;
      boundedHoldingsPreviewApplyWriteMonthlyInvestmentValue_(proposals[i]);
      written.push(proposals[i]);
    }
    return { ok: true, written: written.length };
  } catch (writeErr) {
    for (i = written.length - 1; i >= 0; i--) {
      try {
        boundedHoldingsPreviewApplyRestoreMonthlyInvestmentValue_(written[i]);
      } catch (restoreErr) {
        Logger.log('boundedHoldingsPreviewApplyRestoreMonthlyInvestmentValue_: ' + restoreErr);
      }
    }
    throw writeErr;
  }
}

function boundedHoldingsPreviewApplyShouldLogMonthlyValueActivity_(proposal) {
  proposal = proposal || {};
  var comparison = String(proposal.comparison || '').trim().toUpperCase();
  return comparison === 'BLANK' || comparison === 'MATCH' || comparison === 'DIFFER';
}

function boundedHoldingsPreviewApplyMonthlyActivityDecision_(proposal, payload) {
  proposal = proposal || {};
  payload = payload || {};
  var keyed = typeof boundedHoldingsPreviewApplyMonthlyDecisionForAccount_ === 'function'
    ? boundedHoldingsPreviewApplyMonthlyDecisionForAccount_(payload, proposal.accountName)
    : '';
  var raw = String(keyed || payload.monthlyInvestmentValueDecision || proposal.decision || '')
    .trim().toUpperCase();
  if (raw === 'KEEP') return 'KEEP_EXISTING';
  if (raw === 'ADD' || raw === 'REPLACE' || raw === 'IGNORE') return raw;
  var comparison = String(proposal.comparison || '').trim().toUpperCase();
  if (comparison === 'BLANK') return 'IGNORE';
  if (comparison === 'MATCH' || comparison === 'DIFFER') return 'KEEP_EXISTING';
  return '';
}

function boundedHoldingsPreviewApplyMonthlyActivityProviderLabel_(source) {
  var normalized = typeof investmentPortfolioNormalizeSource_ === 'function'
    ? investmentPortfolioNormalizeSource_(source || '')
    : String(source || '').trim().toUpperCase();
  if (normalized === 'SCHWAB_BROKERAGE_STATEMENT_PDF') return 'Schwab';
  if (normalized === 'M1_STATEMENT_PDF') return 'M1';
  if (normalized === 'FIDELITY_401K_STATEMENT_PDF') return 'Fidelity 401(k)';
  if (normalized === 'STASH_BROKERAGE_STATEMENT_PDF') return 'Stash';
  if (normalized === 'ETRADE_CLIENT_STATEMENT_PDF') return 'E*TRADE';
  return '';
}

function boundedHoldingsPreviewApplyLogOneMonthlyValueActivity_(ss, payload, bundle, proposal, result) {
  if (!boundedHoldingsPreviewApplyShouldLogMonthlyValueActivity_(proposal)) return false;
  var decision = boundedHoldingsPreviewApplyMonthlyActivityDecision_(proposal, payload);
  if (!decision) return false;
  var normalizedResult = String(result || '').trim().toUpperCase();
  if (normalizedResult !== 'APPLIED' && normalizedResult !== 'SKIPPED' &&
      normalizedResult !== 'STALE_REJECTED' && normalizedResult !== 'FAILED') {
    return false;
  }
  if (normalizedResult === 'APPLIED' && (decision === 'IGNORE' || decision === 'KEEP_EXISTING')) {
    normalizedResult = 'SKIPPED';
  }
  if (normalizedResult === 'APPLIED' && !proposal.willWrite) {
    normalizedResult = 'SKIPPED';
  }
  var source = String(proposal.source || payload.source ||
    (bundle.preview && bundle.preview.source) || '').trim();
  var providerLabel = boundedHoldingsPreviewApplyMonthlyActivityProviderLabel_(source);
  var fingerprint = '';
  if (bundle.scopes && bundle.scopes[0] && bundle.scopes[0].documentFingerprint) {
    fingerprint = String(bundle.scopes[0].documentFingerprint || '').trim();
  }
  if (!fingerprint) fingerprint = String(payload.documentFingerprint || '').trim();
  var accountName = String(proposal.accountName || '').trim();
  if (!accountName ||
      (typeof investmentEtradeCiscoStatementProfileCombinedAccountName_ === 'function' &&
        accountName === investmentEtradeCiscoStatementProfileCombinedAccountName_())) {
    return false;
  }
  var oldValue = proposal.existingPresent ? proposal.existingValue : '';
  var proposedValue = proposal.proposedValue != null ? proposal.proposedValue : null;
  var details = {
    detailsVersion: 1,
    accountName: accountName,
    provider: providerLabel,
    source: source,
    statementAsOf: String(proposal.asOfDate || '').trim(),
    targetMonth: String(proposal.monthLabel || '').trim(),
    oldValue: oldValue,
    proposedValue: proposedValue,
    decision: decision,
    result: normalizedResult,
    documentFingerprint: fingerprint,
    diffDigest: String((bundle && bundle.diffDigest) || payload.diffDigest || '').trim(),
    valueCategory: String(proposal.valueCategory || '').trim()
  };
  if (normalizedResult === 'APPLIED') {
    details.newValue = proposedValue;
  }
  var tz = Session.getScriptTimeZone();
  appendActivityLog_(ss, {
    eventType: 'investment_statement_monthly_value',
    entryDate: Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd'),
    amount: 0,
    direction: '',
    payee: accountName,
    category: '',
    accountSource: providerLabel,
    cashFlowSheet: '',
    cashFlowMonth: '',
    dedupeKey: '',
    details: JSON.stringify(details)
  });
  return true;
}

function boundedHoldingsPreviewApplyLogMonthlyValueActivity_(ss, payload, bundle, result) {
  try {
    if (typeof appendActivityLog_ !== 'function') return false;
    payload = payload || {};
    bundle = bundle || {};
    var proposals = boundedHoldingsPreviewApplyMonthlyProposalsFromBundle_(bundle, payload, bundle.mode);
    var logged = false;
    var i;
    for (i = 0; i < proposals.length; i++) {
      if (boundedHoldingsPreviewApplyLogOneMonthlyValueActivity_(
          ss, payload, bundle, proposals[i] || {}, result)) {
        logged = true;
      }
    }
    return logged;
  } catch (logErr) {
    Logger.log('boundedHoldingsPreviewApplyLogMonthlyValueActivity_: ' + logErr);
    return false;
  }
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
        boundedHoldingsPreviewApplyLogMonthlyValueActivity_(ss, payload || {}, refreshed, 'STALE_REJECTED');
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
        boundedHoldingsPreviewApplyLogMonthlyValueActivity_(ss, payload || {}, refreshed, 'STALE_REJECTED');
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
