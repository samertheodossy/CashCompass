/**
 * bounded_holdings_preview_identity.js — Bounded-only automatic investment identity for preview.
 *
 * Creates one SYS - Financial Accounts row on first explicit preview confirmation.
 * No Central behavior. No investment block writes. Users never supply stableAccountId.
 */

function boundedHoldingsPreviewIdentityMaskedValue_(value) {
  var text = String(value || '').trim();
  if (!text) return false;
  if (/^X{2,}\d+$/i.test(text) || /^XXXX/i.test(text)) return true;
  if (/^••••\d{4}$/.test(text)) return true;
  return false;
}

function boundedHoldingsPreviewInferIdentityProvider_(accountName, groupProvider) {
  if (groupProvider) return 'M1';
  var name = String(accountName || '').toLowerCase();
  if (/\bm1\b/.test(name)) return 'M1';
  if (/e\*?trade|etrade/.test(name)) return 'ETRADE';
  if (/robinhood/.test(name)) return 'ROBINHOOD';
  return 'OTHER';
}

function boundedHoldingsPreviewFindIdentityProvider_(providerKey) {
  var providers = [
    { providerKey: 'M1', label: 'M1', institution: 'M1 Finance' },
    { providerKey: 'ETRADE', label: 'E*TRADE', institution: 'E*TRADE' },
    { providerKey: 'ROBINHOOD', label: 'Robinhood', institution: 'Robinhood' },
    { providerKey: 'OTHER', label: 'Other investment account', institution: '' }
  ];
  var wanted = String(providerKey || '').trim().toUpperCase();
  for (var i = 0; i < providers.length; i += 1) {
    if (String(providers[i].providerKey || '').trim().toUpperCase() === wanted) return providers[i];
  }
  return null;
}

function boundedHoldingsPreviewIdentityDomainForRegistration_(registrationType) {
  var registration = financialIdentityNormalizeRegistrationType_(registrationType);
  return registration === '401K' || registration === 'IRA' || registration === '529' ||
    registration === 'CUSTODIAL' ? 'RETIREMENT' : 'INVESTMENT';
}

function boundedHoldingsPreviewEnrichAccountIdentitySetup_(accounts) {
  return (accounts || []).map(function(row) {
    var next = Object.assign({}, row);
    next.needsAutoIdentity = !next.identityReady;
    return next;
  });
}

function boundedHoldingsPreviewAssignAssetsInvestmentId_(ss, accountRow) {
  accountRow = accountRow || {};
  var sysAssetsRow = Number(accountRow.sysAssetsRow);
  var expectedName = String(accountRow.accountName || '').trim();
  if (!isFinite(sysAssetsRow) || sysAssetsRow < 2 || !expectedName) {
    return { ok: false, error: BOUNDED_HOLDINGS_PREVIEW_MISSING_INTERNAL_INVESTMENT_ID_ERROR_ };
  }

  var assetsSheet = ss.getSheetByName(getSheetNames_().ASSETS);
  if (!assetsSheet) {
    return { ok: false, error: BOUNDED_HOLDINGS_PREVIEW_MISSING_INTERNAL_INVESTMENT_ID_ERROR_ };
  }

  var display = assetsSheet.getDataRange().getDisplayValues();
  if (sysAssetsRow > display.length) {
    return { ok: false, error: 'Selected investment account is not active in this workbook.' };
  }

  var headerMap = getAssetsHeaderMap_(assetsSheet, display);
  if (headerMap.investmentIdCol === -1) {
    if (typeof ensureInvestmentPlanningMetadataColumns_ !== 'function') {
      return { ok: false, error: BOUNDED_HOLDINGS_PREVIEW_MISSING_INTERNAL_INVESTMENT_ID_ERROR_ };
    }
    headerMap = ensureInvestmentPlanningMetadataColumns_(assetsSheet);
    display = assetsSheet.getDataRange().getDisplayValues();
  }

  var values = assetsSheet.getDataRange().getValues();
  var rowDisplay = display[sysAssetsRow - 1] || [];
  var rowValues = values[sysAssetsRow - 1] || [];
  var actualName = String(rowDisplay[headerMap.nameColZero] || '').trim();
  if (!actualName || actualName.toLowerCase() !== expectedName.toLowerCase()) {
    return {
      ok: false,
      error: 'Account display name must match the selected CashCompass investment account.'
    };
  }

  var existingId = boundedHoldingsPreviewReadInvestmentIdFromAssetsRow_(
    rowDisplay, rowValues, headerMap.investmentIdColZero);
  if (existingId) {
    if (boundedHoldingsPreviewIdentityMaskedValue_(existingId)) {
      return {
        ok: false,
        error: 'Masked account numbers cannot be used as durable identity.'
      };
    }
    return { ok: true, investmentId: existingId, assigned: false };
  }

  var usedIds = Object.create(null);
  for (var r = 1; r < display.length; r += 1) {
    var id = boundedHoldingsPreviewReadInvestmentIdFromAssetsRow_(
      display[r], values[r], headerMap.investmentIdColZero);
    if (id) usedIds[id] = true;
  }

  var stableId = typeof createInvestmentStableId_ === 'function'
    ? createInvestmentStableId_()
    : ('INV-' + Utilities.getUuid());
  if (usedIds[stableId]) {
    return { ok: false, error: BOUNDED_HOLDINGS_PREVIEW_MISSING_INTERNAL_INVESTMENT_ID_ERROR_ };
  }

  assetsSheet.getRange(sysAssetsRow, headerMap.investmentIdCol).setValue(stableId);
  SpreadsheetApp.flush();
  return { ok: true, investmentId: stableId, assigned: true };
}

function boundedHoldingsPreviewResolveIdentityContext_(ss, payload) {
  payload = payload || {};
  var hasSelection = String(payload.pickerValue || '').trim() ||
    (isFinite(Number(payload.sysAssetsRow)) && Number(payload.sysAssetsRow) > 0) ||
    String(payload.accountName || '').trim();
  if (!hasSelection) {
    return { ok: false, error: 'Select an existing CashCompass investment account.' };
  }

  var activeRows = boundedHoldingsPreviewReadActiveInvestmentAccounts_(ss);
  var accountRow = boundedHoldingsPreviewFindSelectedAccount_(activeRows, payload);
  if (!accountRow) {
    return { ok: false, error: 'Selected investment account is not active in this workbook.' };
  }

  var clientIdCheck = boundedHoldingsPreviewValidateClientInvestmentId_(payload, accountRow);
  if (!clientIdCheck.ok) return clientIdCheck;

  var registryIndex = monthlyCheckinReadRegistryIndex_(ss);
  var lifecycleCounts = boundedHoldingsPreviewInvestmentLifecycleCounts_(activeRows);
  var mapped = boundedHoldingsPreviewMapAccountRow_(accountRow, registryIndex, lifecycleCounts);
  var groupProvider = boundedHoldingsPreviewMatchGroupProvider_(mapped.accountName, 'M1_STATEMENT_PDF');
  return {
    ok: true,
    accountRow: accountRow,
    mapped: mapped,
    registryIndex: registryIndex,
    lifecycleCounts: lifecycleCounts,
    groupProvider: groupProvider
  };
}

function boundedHoldingsPreviewValidateUserPreviewInput_(payload) {
  payload = payload || {};
  if (String(payload.stableAccountId || '').trim()) {
    return {
      ok: false,
      error: 'stableAccountId is assigned automatically by CashCompass.'
    };
  }

  var registrationTypeRaw = String(payload.registrationType || '').trim();
  if (!registrationTypeRaw) {
    return { ok: false, error: 'registrationType is required.' };
  }
  var registrationType = financialIdentityNormalizeRegistrationType_(registrationTypeRaw);
  if (registrationType === 'UNKNOWN') {
    return { ok: false, error: 'registrationType is required.' };
  }

  var accountName = String(payload.accountName || '').trim();
  if (!accountName) {
    return { ok: false, error: 'Account display name is required.' };
  }

  if (payload.explicitAccountMatch !== true) {
    return {
      ok: false,
      error: 'Explicit account-match confirmation is required.'
    };
  }

  return {
    ok: true,
    registrationType: registrationType,
    accountName: accountName,
    explicitAccountMatch: true
  };
}

function boundedHoldingsPreviewResolveExistingStableAccountId_(mapped, registryIndex, accountRow) {
  if (!mapped || !mapped.identityReady) return '';
  var investmentId = String(accountRow.investmentId || '').trim();
  var identity = monthlyCheckinResolveAccountKey_({
    domain: 'investment',
    investmentId: investmentId,
    displayName: String(accountRow.accountName || '').trim(),
    registryIndex: registryIndex
  });
  return identity.ok ? String(identity.stableAccountId || '').trim() : '';
}

function boundedHoldingsPreviewBuildAutoIdentityRowData_(accountRow, ctx, registrationType) {
  var groupProvider = ctx.groupProvider;
  var providerKey = boundedHoldingsPreviewInferIdentityProvider_(
    accountRow.accountName, groupProvider);
  var provider = boundedHoldingsPreviewFindIdentityProvider_(providerKey) ||
    boundedHoldingsPreviewFindIdentityProvider_('OTHER');
  var investmentId = String(accountRow.investmentId || '').trim();
  var accountName = String(accountRow.accountName || '').trim();
  var domain = boundedHoldingsPreviewIdentityDomainForRegistration_(registrationType);
  var ownerId = financialIdentityInferOwnerId_(accountName);
  var identityStatus = ownerId === 'UNKNOWN_REVIEW_REQUIRED' || registrationType === 'UNKNOWN'
    ? 'REVIEW_REQUIRED' : 'VERIFIED';

  return {
    stableAccountId: investmentId,
    domain: domain,
    displayName: accountName,
    institution: provider ? (provider.institution || '') : '',
    accountType: String(accountRow.type || '').trim(),
    accountSubtype: '',
    ownerId: ownerId,
    registrationType: registrationType,
    currency: 'USD',
    last4: '',
    active: 'Yes',
    identityStatus: identityStatus,
    legacyDomain: 'SYS_ASSETS',
    legacyKey: investmentId
  };
}

function boundedHoldingsPreviewValidateAutoIdentityCreate_(ctx, registrationType) {
  var accountRow = ctx.accountRow || {};
  var mapped = ctx.mapped || {};
  var investmentId = String(accountRow.investmentId || '').trim();

  if (!investmentId) {
    return {
      ok: true,
      needsInvestmentIdAssignment: true,
      identityCreated: true
    };
  }
  if (boundedHoldingsPreviewIdentityMaskedValue_(investmentId)) {
    return {
      ok: false,
      error: 'Masked account numbers cannot be used as durable identity.'
    };
  }
  if (Number(ctx.lifecycleCounts[investmentId] || 0) !== 1) {
    return {
      ok: false,
      error: 'Investment Id must be unique in SYS - Assets before previewing holdings.'
    };
  }

  var legacyComposite = 'SYS_ASSETS::' + investmentId;
  var legacyMatches = (ctx.registryIndex.byLegacy[legacyComposite] || []).filter(function(account) {
    return monthlyCheckinRegistryAccountEligible_('investment', account);
  });
  if (legacyMatches.length) {
    return {
      ok: true,
      stableAccountId: String(legacyMatches[0].stableAccountId || '').trim(),
      identityCreated: false
    };
  }
  if (ctx.registryIndex.byStableId[investmentId]) {
    return {
      ok: false,
      error: 'A registry row already uses this Investment Id as stableAccountId.'
    };
  }
  if (mapped.identityReady) {
    return {
      ok: true,
      stableAccountId: boundedHoldingsPreviewResolveExistingStableAccountId_(
        mapped, ctx.registryIndex, accountRow),
      identityCreated: false
    };
  }

  return {
    ok: true,
    rowData: boundedHoldingsPreviewBuildAutoIdentityRowData_(accountRow, ctx, registrationType),
    stableAccountId: investmentId,
    identityCreated: true
  };
}

function boundedHoldingsPreviewAppendIdentityRegistryRow_(ss, rowData) {
  var accountSheet = ensureFinancialAccountsSheet_(ss);
  var now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
  accountSheet.appendRow([
    rowData.stableAccountId,
    rowData.domain,
    rowData.displayName,
    rowData.institution,
    rowData.accountType,
    rowData.accountSubtype,
    rowData.ownerId,
    rowData.registrationType,
    rowData.currency,
    rowData.last4,
    rowData.active,
    rowData.identityStatus,
    rowData.legacyDomain,
    rowData.legacyKey,
    now,
    now
  ]);
}

/**
 * Ensures verified registry identity exists for the selected account.
 * Creates the registry row only after explicit preview confirmation.
 *
 * @returns {{ok: boolean, stableAccountId?: string, registrationType?: string, identityCreated?: boolean, error?: string}}
 */
function boundedHoldingsPreviewEnsureAccountIdentity_(ss, payload) {
  payload = payload || {};
  var userInput = boundedHoldingsPreviewValidateUserPreviewInput_(payload);
  if (!userInput.ok) return userInput;

  var ctx = boundedHoldingsPreviewResolveIdentityContext_(ss, payload);
  if (!ctx.ok) return ctx;

  var expectedName = String(ctx.accountRow.accountName || '').trim();
  if (expectedName.toLowerCase() !== userInput.accountName.toLowerCase()) {
    return {
      ok: false,
      error: 'Account display name must match the selected CashCompass investment account.'
    };
  }

  var createPlan = boundedHoldingsPreviewValidateAutoIdentityCreate_(
    ctx, userInput.registrationType);
  if (!createPlan.ok) return createPlan;
  if (!createPlan.identityCreated) {
    return {
      ok: true,
      stableAccountId: createPlan.stableAccountId,
      registrationType: userInput.registrationType,
      identityCreated: false
    };
  }

  var lock = LockService.getDocumentLock();
  try {
    lock.waitLock(30000);
  } catch (lockErr) {
    return {
      ok: false,
      error: 'Could not acquire document lock: ' + (lockErr && lockErr.message || lockErr)
    };
  }
  try {
    var freshCtx = boundedHoldingsPreviewResolveIdentityContext_(ss, payload);
    if (!freshCtx.ok) return freshCtx;

    var investmentIdAssigned = false;
    if (createPlan.needsInvestmentIdAssignment ||
        !String(freshCtx.accountRow.investmentId || '').trim()) {
      var assigned = boundedHoldingsPreviewAssignAssetsInvestmentId_(ss, freshCtx.accountRow);
      if (!assigned.ok) return assigned;
      investmentIdAssigned = !!assigned.assigned;
      freshCtx = boundedHoldingsPreviewResolveIdentityContext_(ss, payload);
      if (!freshCtx.ok) return freshCtx;
    }

    var freshPlan = boundedHoldingsPreviewValidateAutoIdentityCreate_(
      freshCtx, userInput.registrationType);
    if (!freshPlan.ok) return freshPlan;
    if (!freshPlan.identityCreated) {
      return {
        ok: true,
        stableAccountId: freshPlan.stableAccountId,
        registrationType: userInput.registrationType,
        identityCreated: false,
        investmentIdAssigned: investmentIdAssigned
      };
    }
    if (!freshPlan.rowData) {
      return { ok: false, error: BOUNDED_HOLDINGS_PREVIEW_MISSING_INTERNAL_INVESTMENT_ID_ERROR_ };
    }

    var registryBefore = financialIdentityReadRegistry_(ss);
    var priorCount = (registryBefore.accounts || []).length;
    boundedHoldingsPreviewAppendIdentityRegistryRow_(ss, freshPlan.rowData);
    SpreadsheetApp.flush();

    var registryAfter = financialIdentityReadRegistry_(ss);
    if ((registryAfter.accounts || []).length !== priorCount + 1) {
      throw new Error('Identity registry row was not saved.');
    }

    return {
      ok: true,
      stableAccountId: freshPlan.stableAccountId,
      registrationType: userInput.registrationType,
      identityCreated: true,
      investmentIdAssigned: investmentIdAssigned
    };
  } finally {
    try { lock.releaseLock(); } catch (_releaseErr) { /* best effort */ }
  }
}
