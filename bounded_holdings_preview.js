/**
 * bounded_holdings_preview.js — Owner-accessible Portfolio Holdings Preview (bounded app).
 *
 * Preview-only unified holdings for ETRADE_POSITIONS_PDF, ETRADE_CLIENT_STATEMENT_PDF,
 * and M1_STATEMENT_PDF against
 * the caller's bound workbook investment accounts. No sheet writes or persistence.
 */

var BOUNDED_HOLDINGS_PREVIEW_MISSING_INTERNAL_INVESTMENT_ID_ERROR_ =
  'This investment account needs internal setup. Please refresh the account list or contact the administrator.';

var BOUNDED_HOLDINGS_PREVIEW_AUTO_IDENTITY_ON_CONFIRM_MESSAGE_ =
  'CashCompass will assign internal identity automatically on your first confirmed preview for this account.';

function boundedHoldingsPreviewReadInvestmentIdFromAssetsRow_(displayRow, valueRow, investmentIdIdx) {
  if (investmentIdIdx === -1) return '';
  var fromDisplay = String((displayRow || [])[investmentIdIdx] || '').trim();
  if (fromDisplay) return fromDisplay;
  return String((valueRow || [])[investmentIdIdx] || '').trim();
}

function boundedHoldingsPreviewSafe_(fn) {
  try {
    return fn();
  } catch (e) {
    return {
      ok: false,
      error: (e && e.message) ? String(e.message) : String(e)
    };
  }
}

function assertBoundedHoldingsPreviewAllowed_() {
  if (isCentralModeEnabled_()) {
    throw new Error('Portfolio Holdings Preview is available in the bounded workbook app only.');
  }
  if (!isAllowlistedUser_()) {
    throw new Error('Access denied.');
  }
}

/**
 * Returns the deployed web-app /exec base URL for the current bounded deployment.
 * Never returns googleusercontent.com sandbox iframe URLs.
 *
 * @returns {string}
 */
function boundedHoldingsPreviewWebAppBaseUrl_() {
  if (isCentralModeEnabled_()) return '';
  try {
    if (typeof ScriptApp === 'undefined' || !ScriptApp.getService) return '';
    var base = String(ScriptApp.getService().getUrl() || '').replace(/\?.*$/, '');
    if (!base || !/\/exec$/i.test(base)) return '';
    if (/userCodeAppPanel/i.test(base) || !/^https:\/\/script\.google\.com\//i.test(base)) return '';
    return base;
  } catch (_e) {
    return '';
  }
}

/**
 * Full bounded Portfolio Holdings Preview launch URL for top-frame navigation.
 *
 * @returns {string}
 */
function boundedHoldingsPreviewLaunchUrl_() {
  var base = boundedHoldingsPreviewWebAppBaseUrl_();
  return base ? base + '?view=portfolio-holdings-preview' : '';
}

/**
 * Dashboard RPC: resolve the bounded preview launch URL from the deployed web app.
 *
 * @returns {{ok: boolean, url?: string, error?: string}}
 */
function getBoundedHoldingsPreviewLaunchUrlFromDashboard() {
  return boundedHoldingsPreviewSafe_(function() {
    assertBoundedHoldingsPreviewAllowed_();
    var url = boundedHoldingsPreviewLaunchUrl_();
    if (!url) {
      return { ok: false, error: 'Web app deployment URL is unavailable.' };
    }
    return { ok: true, url: url };
  });
}

/**
 * Dashboard RPC: read-only setup payload (investment accounts + identity hints).
 *
 * @returns {Object}
 */
function getBoundedHoldingsPreviewSetupFromDashboard() {
  return boundedHoldingsPreviewSafe_(function() {
    assertBoundedHoldingsPreviewAllowed_();
    var ss = getUserSpreadsheet_();
    return boundedHoldingsPreviewBuildSetup_(ss);
  });
}

/**
 * Dashboard RPC: preview one PDF text extract in memory for a selected account.
 *
 * @param {Object} payload
 * @returns {Object}
 */
function boundedHoldingsPreviewRunFromDashboard(payload) {
  return boundedHoldingsPreviewSafe_(function() {
    assertBoundedHoldingsPreviewAllowed_();
    var ss = getUserSpreadsheet_();
    var accountValidation = boundedHoldingsPreviewValidateSelectedAccount_(ss, payload || {});
    if (!accountValidation.ok) return accountValidation;
    var previewPayload = Object.assign({}, payload || {}, {
      stableAccountId: accountValidation.stableAccountId,
      registrationType: accountValidation.registrationType,
      explicitAccountMatch: true
    });
    var sourceValidation = boundedHoldingsPreviewValidatePreviewSourceForAccount_(
      {
        accountName: previewPayload.accountName,
        statementProvider: previewPayload.statementProvider,
        previewMode: previewPayload.previewMode
      },
      previewPayload.source,
      previewPayload.rawDocumentText);
    if (!sourceValidation.ok) return sourceValidation;
    previewPayload.source = sourceValidation.source;
    return holdingsPreviewLabBuildPreview_(previewPayload);
  });
}

/**
 * Dashboard RPC: explicit clear acknowledgement (no server-side state).
 *
 * @returns {{ok: boolean}}
 */
function boundedHoldingsPreviewClearFromDashboard() {
  return boundedHoldingsPreviewSafe_(function() {
    assertBoundedHoldingsPreviewAllowed_();
    return { ok: true };
  });
}

/**
 * Dashboard RPC: conservative registration-type suggestion from statement text.
 *
 * @param {{rawDocumentText?: string, source?: string}} payload
 * @returns {{ok: boolean, suggested?: string, confidence?: string, source?: string}}
 */
function boundedHoldingsPreviewSuggestRegistrationFromDashboard(payload) {
  return boundedHoldingsPreviewSafe_(function() {
    assertBoundedHoldingsPreviewAllowed_();
    payload = payload || {};
    var suggestion = boundedHoldingsPreviewSuggestRegistrationType_(
      payload.rawDocumentText, payload.source);
    return Object.assign({ ok: true }, suggestion);
  });
}

function boundedHoldingsPreviewSuggestRegistrationType_(rawText, source) {
  var normalizedSource = typeof investmentPortfolioNormalizeSource_ === 'function'
    ? investmentPortfolioNormalizeSource_(source || '')
    : String(source || '').trim().toUpperCase();
  if (normalizedSource === 'M1_STATEMENT_PDF' &&
      typeof investmentM1SuggestRegistrationTypeFromStatement_ === 'function') {
    return investmentM1SuggestRegistrationTypeFromStatement_(rawText);
  }
  return { suggested: '', confidence: 'LOW', source: '' };
}

function boundedHoldingsPreviewResolveStatementProvider_(accountMeta) {
  accountMeta = accountMeta || {};
  if (accountMeta.statementProvider) {
    return String(accountMeta.statementProvider).trim().toUpperCase();
  }
  var groupProvider = accountMeta.previewMode === 'GROUPED_PROVIDER'
    ? boundedHoldingsPreviewMatchGroupProvider_(accountMeta.accountName, 'M1_STATEMENT_PDF')
    : null;
  if (groupProvider) return 'M1';
  if (typeof boundedHoldingsPreviewInferIdentityProvider_ === 'function') {
    return boundedHoldingsPreviewInferIdentityProvider_(accountMeta.accountName, groupProvider);
  }
  return 'OTHER';
}

function boundedHoldingsPreviewDefaultSourceForAccount_(accountMeta) {
  accountMeta = accountMeta || {};
  if (accountMeta.previewMode === 'GROUPED_PROVIDER') return 'M1_STATEMENT_PDF';
  var provider = boundedHoldingsPreviewResolveStatementProvider_(accountMeta);
  if (provider === 'M1') return 'M1_STATEMENT_PDF';
  if (provider === 'ETRADE') return 'ETRADE_CLIENT_STATEMENT_PDF';
  return 'ETRADE_POSITIONS_PDF';
}

function boundedHoldingsPreviewAllowedSourcesForAccount_(accountMeta) {
  accountMeta = accountMeta || {};
  var provider = boundedHoldingsPreviewResolveStatementProvider_(accountMeta);
  if (accountMeta.previewMode === 'GROUPED_PROVIDER' || provider === 'M1') {
    return ['M1_STATEMENT_PDF'];
  }
  if (provider === 'ETRADE') {
    return ['ETRADE_POSITIONS_PDF', 'ETRADE_CLIENT_STATEMENT_PDF'];
  }
  return ['ETRADE_POSITIONS_PDF', 'ETRADE_CLIENT_STATEMENT_PDF', 'M1_STATEMENT_PDF'];
}

function boundedHoldingsPreviewCoerceSourceForAccount_(accountMeta, requestedSource) {
  var allowed = boundedHoldingsPreviewAllowedSourcesForAccount_(accountMeta);
  var normalized = typeof investmentPortfolioNormalizeSource_ === 'function'
    ? investmentPortfolioNormalizeSource_(requestedSource || '')
    : String(requestedSource || '').trim().toUpperCase();
  if (allowed.indexOf(normalized) >= 0) return normalized;
  return boundedHoldingsPreviewDefaultSourceForAccount_(accountMeta);
}

function boundedHoldingsPreviewValidatePreviewSourceForAccount_(accountMeta, source, rawText) {
  accountMeta = accountMeta || {};
  var provider = boundedHoldingsPreviewResolveStatementProvider_(accountMeta);
  var normalizedSource = typeof investmentPortfolioNormalizeSource_ === 'function'
    ? investmentPortfolioNormalizeSource_(source || '')
    : String(source || '').trim().toUpperCase();
  var allowed = boundedHoldingsPreviewAllowedSourcesForAccount_(accountMeta);

  if (allowed.indexOf(normalizedSource) < 0) {
    if (provider === 'ETRADE') {
      return {
        ok: false,
        error: 'M1_STATEMENT_PDF is not valid for E*TRADE accounts. Select ETRADE_CLIENT_STATEMENT_PDF or ETRADE_POSITIONS_PDF.',
        source: normalizedSource,
        provider: provider
      };
    }
    if (provider === 'M1') {
      return {
        ok: false,
        error: 'M1 accounts require M1_STATEMENT_PDF source.',
        source: normalizedSource,
        provider: provider
      };
    }
    return {
      ok: false,
      error: 'Unsupported preview source for the selected account.',
      source: normalizedSource,
      provider: provider
    };
  }

  rawText = String(rawText || '');
  if (normalizedSource === 'M1_STATEMENT_PDF' && rawText && provider !== 'M1') {
    if (typeof investmentEtradeClientStatementClassifyDocumentType_ === 'function') {
      var docClass = investmentEtradeClientStatementClassifyDocumentType_(rawText);
      if (docClass.documentType === 'ETRADE_CLIENT_STATEMENT_PDF') {
        return {
          ok: false,
          error: 'Document matches an E*TRADE monthly client statement. Select ETRADE_CLIENT_STATEMENT_PDF source.',
          source: normalizedSource
        };
      }
    }
    if (typeof investmentEtradeClientStatementAssessTextQuality_ === 'function') {
      var corruptQuality = investmentEtradeClientStatementAssessTextQuality_(rawText);
      if (corruptQuality.quality === 'ENCODING_FAILURE') {
        return {
          ok: false,
          error: 'Extracted PDF text is encoding-corrupt. E*TRADE monthly client statement PDF is not currently supported for direct import.',
          source: normalizedSource
        };
      }
    }
  }

  return { ok: true, source: normalizedSource, provider: provider };
}

/**
 * HtmlService include for bounded preview PDF client helpers.
 *
 * @param {string} filename
 * @returns {string}
 */
function boundedHoldingsPreviewIncludePdfClient_(filename) {
  return includeHtml_(String(filename || 'bounded_holdings_preview_pdf_client_include.html'));
}

function boundedHoldingsPreviewBuildSetup_(ss) {
  var registryIndex = monthlyCheckinReadRegistryIndex_(ss);
  var activeRows = boundedHoldingsPreviewReadActiveInvestmentAccounts_(ss);
  var lifecycleCounts = boundedHoldingsPreviewInvestmentLifecycleCounts_(activeRows);
  var accounts = activeRows.map(function(row) {
    return boundedHoldingsPreviewMapAccountRow_(row, registryIndex, lifecycleCounts);
  }).filter(function(row) {
    return !!row.accountName;
  });
  if (typeof boundedHoldingsPreviewEnrichAccountIdentitySetup_ === 'function') {
    accounts = boundedHoldingsPreviewEnrichAccountIdentitySetup_(accounts);
  }
  return {
    ok: true,
    previewLabel: 'Preview only — not loaded into CashCompass.',
    dashboardUrl: boundedHoldingsPreviewWebAppBaseUrl_(),
    launchUrl: boundedHoldingsPreviewLaunchUrl_(),
    accounts: accounts
  };
}

function boundedHoldingsPreviewIsExcludedAssetsName_(name) {
  var value = String(name || '').trim();
  if (!value) return true;
  return /^(account totals|total values|house assets|delta|year|account name)$/i.test(value);
}

function boundedHoldingsPreviewReadActiveInvestmentAccounts_(ss) {
  var rows = [];
  if (!ss) return rows;
  var sheet = ss.getSheetByName(getSheetNames_().ASSETS);
  if (!sheet) return rows;
  var assetsRange = sheet.getDataRange();
  var assetsDisplay = assetsRange.getDisplayValues();
  var assetsValues = assetsRange.getValues();
  if (!assetsDisplay.length) return rows;
  var headerMap = getAssetsHeaderMap_(sheet, assetsDisplay);
  var nameIdx = headerMap.nameColZero;
  var typeIdx = headerMap.typeColZero;
  var balanceIdx = headerMap.balanceColZero;
  var activeIdx = headerMap.activeColZero;
  var investmentIdIdx = headerMap.investmentIdColZero;
  var planningPurposeIdx = headerMap.planningPurposeColZero;

  for (var r = 1; r < assetsDisplay.length; r += 1) {
    var displayRow = assetsDisplay[r] || [];
    var name = nameIdx === -1 ? '' : String(displayRow[nameIdx] || '').trim();
    if (boundedHoldingsPreviewIsExcludedAssetsName_(name)) continue;
    var rawActive = activeIdx === -1 ? '' :
      String(displayRow[activeIdx] || '').trim().toLowerCase();
    var inactive = rawActive === 'no' || rawActive === 'n' ||
      rawActive === 'false' || rawActive === 'inactive';
    if (inactive) continue;
    rows.push({
      sysAssetsRow: r + 1,
      accountName: name,
      type: typeIdx === -1 ? '' : String(displayRow[typeIdx] || '').trim(),
      currentBalance: balanceIdx === -1 || assetsValues[r][balanceIdx] === ''
        ? '' : round2_(toNumber_(assetsValues[r][balanceIdx])),
      investmentId: boundedHoldingsPreviewReadInvestmentIdFromAssetsRow_(
        displayRow, assetsValues[r], investmentIdIdx),
      planningPurpose: planningPurposeIdx === -1 ? '' :
        String(displayRow[planningPurposeIdx] || '').trim(),
      inactive: false
    });
  }
  return rows;
}

function boundedHoldingsPreviewInvestmentLifecycleCounts_(rows) {
  var counts = Object.create(null);
  (rows || []).forEach(function(row) {
    var investmentId = String(row.investmentId || '').trim();
    if (!investmentId) return;
    counts[investmentId] = Number(counts[investmentId] || 0) + 1;
  });
  return counts;
}

function boundedHoldingsPreviewMapAccountRow_(row, registryIndex, lifecycleCounts) {
  var investmentId = String(row.investmentId || '').trim();
  var accountName = String(row.accountName || '').trim();
  var identity = monthlyCheckinResolveAccountKey_({
    domain: 'investment',
    investmentId: investmentId,
    displayName: accountName,
    registryIndex: registryIndex,
    investmentLifecycleCounts: lifecycleCounts
  });
  var verifiedRegistryIdentity = !!identity.ok &&
    (identity.identitySource === 'REGISTRY_STABLE_ACCOUNT_ID' ||
      identity.identitySource === 'REGISTRY_LEGACY_KEY');
  var registrationHint = '';
  if (verifiedRegistryIdentity && identity.identitySource === 'REGISTRY_STABLE_ACCOUNT_ID') {
    var regAccount = registryIndex.byStableId[identity.stableAccountId];
    registrationHint = regAccount ? String(regAccount.registrationType || '').trim() : '';
  } else if (verifiedRegistryIdentity && identity.identitySource === 'REGISTRY_LEGACY_KEY') {
    var legacyComposite = 'SYS_ASSETS::' + investmentId;
    var legacyMatches = (registryIndex.byLegacy[legacyComposite] || []).filter(function(account) {
      return monthlyCheckinRegistryAccountEligible_('investment', account);
    });
    if (legacyMatches.length === 1) {
      registrationHint = String(legacyMatches[0].registrationType || '').trim();
    }
  }
  var identityReady = verifiedRegistryIdentity;
  var identityMessage = identityReady ? '' : String(identity.message || '');
  if (identity.ok && !identityReady && identity.identitySource === 'INVESTMENT_LIFECYCLE_ID') {
    identityMessage = 'Financial identity registry setup is required before previewing holdings for this account.';
  }
  if (!investmentId) {
    identityMessage = identityReady ? '' : BOUNDED_HOLDINGS_PREVIEW_AUTO_IDENTITY_ON_CONFIRM_MESSAGE_;
    identityReady = false;
  }
  var groupProvider = boundedHoldingsPreviewMatchGroupProvider_(accountName, 'M1_STATEMENT_PDF');
  var statementProvider = typeof boundedHoldingsPreviewInferIdentityProvider_ === 'function'
    ? boundedHoldingsPreviewInferIdentityProvider_(accountName, groupProvider)
    : (groupProvider ? 'M1' : 'OTHER');
  var base = {
    sysAssetsRow: row.sysAssetsRow,
    investmentId: investmentId,
    pickerValue: investmentId || ('__row__:' + String(row.sysAssetsRow)),
    accountName: accountName,
    type: String(row.type || '').trim(),
    currentBalance: row.currentBalance,
    identityReady: identityReady,
    identityCode: identity.ok ? identity.code : identity.code,
    identityMessage: identityMessage,
    identityStatusLabel: !investmentId ? 'Auto identity on confirm' : '',
    suggestedStableAccountId: identityReady ? identity.stableAccountId : '',
    suggestedRegistrationType: registrationHint
      ? investmentPortfolioNormalizeRegistrationType_(registrationHint) : '',
    previewMode: groupProvider ? 'GROUPED_PROVIDER' : 'SINGLE_ACCOUNT',
    statementProvider: statementProvider,
    defaultPreviewSource: boundedHoldingsPreviewDefaultSourceForAccount_({
      accountName: accountName,
      previewMode: groupProvider ? 'GROUPED_PROVIDER' : 'SINGLE_ACCOUNT',
      statementProvider: statementProvider
    })
  };
  if (groupProvider) {
    base.groupProviderKey = groupProvider.providerKey;
    base.groupProviderLabel = groupProvider.visibleLabel;
    base.maxChildAccounts = groupProvider.maxChildAccounts;
    base.parentIsAggregateOnly = true;
    base.groupedPreviewSource = groupProvider.source;
    base.reconciliationLabel = groupProvider.reconciliationLabel;
  }
  return base;
}

function boundedHoldingsPreviewFindSelectedAccount_(activeRows, payload) {
  payload = payload || {};
  activeRows = activeRows || [];

  var sysAssetsRow = Number(payload.sysAssetsRow);
  if (isFinite(sysAssetsRow) && sysAssetsRow > 0) {
    var rowMatches = activeRows.filter(function(row) {
      return Number(row.sysAssetsRow) === sysAssetsRow;
    });
    if (rowMatches.length === 1) return rowMatches[0];
    if (rowMatches.length > 1) return null;
  }

  var pickerValue = String(payload.pickerValue || '').trim();
  if (pickerValue.indexOf('__row__:') === 0) {
    var wantedRow = Number(pickerValue.slice('__row__:'.length));
    if (isFinite(wantedRow) && wantedRow > 0) {
      var pickerRowMatches = activeRows.filter(function(row) {
        return Number(row.sysAssetsRow) === wantedRow;
      });
      if (pickerRowMatches.length === 1) return pickerRowMatches[0];
    }
  } else if (pickerValue) {
    var pickerIdMatches = activeRows.filter(function(row) {
      return String(row.investmentId || '').trim() === pickerValue;
    });
    if (pickerIdMatches.length === 1) return pickerIdMatches[0];
    if (pickerIdMatches.length > 1) return null;
  }

  var accountName = String(payload.accountName || '').trim();
  if (accountName) {
    var nameMatches = activeRows.filter(function(row) {
      return String(row.accountName || '').trim().toLowerCase() === accountName.toLowerCase();
    });
    if (nameMatches.length === 1) return nameMatches[0];
  }

  var investmentId = String(payload.investmentId || '').trim();
  if (investmentId) {
    var idMatches = activeRows.filter(function(row) {
      return String(row.investmentId || '').trim() === investmentId;
    });
    if (idMatches.length === 1) return idMatches[0];
    if (idMatches.length > 1) return null;
  }

  return null;
}

function boundedHoldingsPreviewValidateClientInvestmentId_(payload, accountRow) {
  var clientId = String(payload.investmentId || '').trim();
  if (!clientId) return { ok: true };
  var resolvedId = String(accountRow.investmentId || '').trim();
  if (!resolvedId) return { ok: true };
  if (clientId !== resolvedId) {
    return {
      ok: false,
      error: 'Selected account could not be verified. Refresh the account list and try again.'
    };
  }
  return { ok: true };
}

function boundedHoldingsPreviewValidateSelectedAccount_(ss, payload) {
  payload = payload || {};
  if (typeof boundedHoldingsPreviewEnsureAccountIdentity_ !== 'function') {
    return { ok: false, error: 'Financial identity setup is unavailable.' };
  }
  var ensure = boundedHoldingsPreviewEnsureAccountIdentity_(ss, payload);
  if (!ensure.ok) return ensure;

  var activeRows = boundedHoldingsPreviewReadActiveInvestmentAccounts_(ss);
  var accountRow = boundedHoldingsPreviewFindSelectedAccount_(activeRows, payload);
  if (!accountRow) {
    return { ok: false, error: 'Selected investment account is not active in this workbook.' };
  }

  return {
    ok: true,
    investmentId: String(accountRow.investmentId || '').trim(),
    sysAssetsRow: accountRow.sysAssetsRow,
    accountName: String(accountRow.accountName || '').trim(),
    stableAccountId: ensure.stableAccountId,
    registrationType: ensure.registrationType,
    identityCreated: !!ensure.identityCreated
  };
}
