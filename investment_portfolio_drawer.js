/**
 * investment_portfolio_drawer.js — Read-only Portfolio activity drawer (Phase 1).
 *
 * Lists all active CashCompass investment accounts and returns portfolio status
 * without import/apply writes.
 */

function investmentPortfolioDrawerProviderLabel_(providerKey) {
  var labels = {
    M1: 'M1',
    ETRADE: 'E*TRADE',
    ROBINHOOD: 'Robinhood',
    FIDELITY: 'Fidelity',
    SCHWAB: 'Schwab',
    STASH: 'Stash',
    UNKNOWN: 'Unknown — review',
    OTHER: 'Other'
  };
  var key = String(providerKey || '').trim().toUpperCase();
  return labels[key] || labels.UNKNOWN;
}

function investmentPortfolioDrawerMatchGroupProvider_(accountName) {
  if (typeof boundedHoldingsPreviewMatchGroupProvider_ === 'function') {
    return boundedHoldingsPreviewMatchGroupProvider_(accountName, 'M1_STATEMENT_PDF');
  }
  var name = String(accountName || '').trim();
  if (/^M1 Account\s*-\s*Gmail$/i.test(name)) {
    return { providerKey: 'M1', source: 'M1_STATEMENT_PDF', maxChildAccounts: 5 };
  }
  if (/^M1 Account\s*-\s*yahoo$/i.test(name)) {
    return { providerKey: 'M1', source: 'M1_STATEMENT_PDF', maxChildAccounts: 5 };
  }
  return null;
}

function investmentPortfolioDrawerIs401kRetirementAccount_(account) {
  account = account || {};
  var name = String(account.accountName || '').trim();
  var type = String(account.type || '').trim();
  return /^401K Account$/i.test(name) && /^Retirement$/i.test(type);
}

function investmentPortfolioDrawerInferProvider_(accountName, groupProvider) {
  if (groupProvider) return 'M1';
  var name = String(accountName || '').trim();
  if (/^401K Account$/i.test(name)) return 'FIDELITY';
  var lower = name.toLowerCase();
  if (/robinhood/.test(lower)) return 'ROBINHOOD';
  if (/e\*?trade|etrade/.test(lower)) return 'ETRADE';
  if (/schwab/.test(lower)) return 'SCHWAB';
  if (/stash/.test(lower)) return 'STASH';
  if (/^M1 Account\s*-\s*(Gmail|yahoo)$/i.test(name)) return 'M1';
  return 'UNKNOWN';
}

function investmentPortfolioDrawerReadActiveAccounts_(ss) {
  if (typeof boundedHoldingsPreviewReadActiveInvestmentAccounts_ === 'function') {
    return boundedHoldingsPreviewReadActiveInvestmentAccounts_(ss);
  }
  return [];
}

function investmentPortfolioDrawerResolveAccount_(ss, pickerValue) {
  pickerValue = String(pickerValue || '').trim();
  if (!pickerValue) return null;
  var rows = investmentPortfolioDrawerReadActiveAccounts_(ss);
  if (pickerValue.indexOf('__row__:') === 0) {
    var wantedRow = Number(pickerValue.slice('__row__:'.length));
    if (!isFinite(wantedRow) || wantedRow <= 0) return null;
    var rowMatches = rows.filter(function(row) {
      return Number(row.sysAssetsRow) === wantedRow;
    });
    return rowMatches.length === 1 ? investmentPortfolioDrawerMapAccountRow_(rowMatches[0]) : null;
  }
  var idMatches = rows.filter(function(row) {
    return String(row.investmentId || '').trim() === pickerValue;
  });
  if (idMatches.length === 1) return investmentPortfolioDrawerMapAccountRow_(idMatches[0]);
  return null;
}

function investmentPortfolioDrawerMapAccountRow_(row) {
  row = row || {};
  var investmentId = String(row.investmentId || '').trim();
  var accountName = String(row.accountName || '').trim();
  var groupProvider = investmentPortfolioDrawerMatchGroupProvider_(accountName);
  var provider = investmentPortfolioDrawerInferProvider_(accountName, groupProvider);
  return {
    sysAssetsRow: row.sysAssetsRow,
    investmentId: investmentId,
    pickerValue: investmentId || ('__row__:' + String(row.sysAssetsRow)),
    accountName: accountName,
    type: String(row.type || '').trim(),
    registrationType: String(row.registrationType || '').trim(),
    currentBalance: row.currentBalance,
    planningPurpose: String(row.planningPurpose || '').trim(),
    statementProvider: provider,
    providerLabel: investmentPortfolioDrawerProviderLabel_(provider),
    previewMode: groupProvider ? 'GROUPED_PROVIDER' : 'SINGLE_ACCOUNT',
    parentIsAggregateOnly: !!groupProvider,
    incomeProducingEligible: String(row.planningPurpose || '').trim() === 'INCOME_PRODUCING' &&
      !!investmentId
  };
}

function investmentPortfolioDrawerRobinhoodImportEligible_(account) {
  account = account || {};
  if (String(account.statementProvider || '').trim().toUpperCase() !== 'ROBINHOOD') return false;
  return !!account.incomeProducingEligible;
}

function investmentPortfolioDrawerNormalizeImportSource_(source) {
  if (typeof investmentPortfolioNormalizeSource_ === 'function') {
    return investmentPortfolioNormalizeSource_(source || '');
  }
  return String(source || '').trim().toUpperCase();
}

function investmentPortfolioDrawerIsCustomerProductionSource_(source) {
  var normalized = investmentPortfolioDrawerNormalizeImportSource_(source);
  return normalized === 'ROBINHOOD_CSV' ||
    normalized === 'M1_STATEMENT_PDF' ||
    normalized === 'SCHWAB_BROKERAGE_STATEMENT_PDF' ||
    normalized === 'STASH_BROKERAGE_STATEMENT_PDF' ||
    normalized === 'FIDELITY_401K_STATEMENT_PDF';
}

function investmentPortfolioDrawerIs529Account_(account) {
  account = account || {};
  var registration = String(account.registrationType || '').trim().toUpperCase();
  if (registration === '529') return true;
  var type = String(account.type || '').trim();
  var name = String(account.accountName || '').trim();
  if (/\b529\b/i.test(type)) return true;
  if (typeof financialIdentityInferRegistration_ === 'function') {
    return financialIdentityInferRegistration_('INVESTMENT', name, type) === '529';
  }
  return /\b529\b/i.test(name + ' ' + type);
}

function investmentPortfolioDrawerSupportedImportFormats_(provider, previewMode) {
  provider = String(provider || '').trim().toUpperCase();
  previewMode = String(previewMode || '').trim();
  if (provider === 'ROBINHOOD') {
    return [{
      source: 'ROBINHOOD_CSV',
      label: 'Robinhood activity CSV',
      productionReady: true,
      customerDrawerImport: true
    }];
  }
  if (provider === 'M1') {
    return [{
      source: 'M1_STATEMENT_PDF',
      label: 'M1 monthly statement PDF',
      productionReady: true,
      customerDrawerImport: true
    }];
  }
  if (provider === 'ETRADE') {
    return [{
      source: 'ETRADE_POSITIONS_PDF',
      label: 'E*TRADE Expanded Positions PDF',
      productionReady: true,
      customerDrawerImport: false
    }];
  }
  if (provider === 'FIDELITY') {
    return [{
      source: 'FIDELITY_401K_STATEMENT_PDF',
      label: 'Retirement savings statement PDF',
      productionReady: true,
      customerDrawerImport: true,
      importPurpose: 'BALANCE_SNAPSHOT',
      accountType: 'RETIREMENT'
    }];
  }
  if (provider === 'SCHWAB') {
    return [{
      source: 'SCHWAB_BROKERAGE_STATEMENT_PDF',
      label: 'Schwab brokerage statement PDF',
      productionReady: true,
      customerDrawerImport: true
    }];
  }
  if (provider === 'STASH') {
    return [{
      source: 'STASH_BROKERAGE_STATEMENT_PDF',
      label: 'Stash brokerage statement PDF',
      productionReady: true,
      customerDrawerImport: true
    }];
  }
  if (previewMode === 'GROUPED_PROVIDER') {
    return [{
      source: 'M1_STATEMENT_PDF',
      label: 'M1 monthly statement PDF',
      productionReady: true,
      customerDrawerImport: true
    }];
  }
  return [];
}

function investmentPortfolioDrawerCustomerDrawerFormats_(provider, previewMode) {
  return investmentPortfolioDrawerSupportedImportFormats_(provider, previewMode).filter(function(fmt) {
    return !!(fmt && fmt.customerDrawerImport === true);
  });
}

function investmentPortfolioDrawerCustomerImportEligibility_(account) {
  account = account || {};
  var mapped = account.statementProvider
    ? account
    : investmentPortfolioDrawerMapAccountRow_(account);
  var provider = String(mapped.statementProvider || '').trim().toUpperCase();
  var previewMode = mapped.previewMode;
  var disabled = function(reason) {
    return {
      enabled: false,
      reason: reason || 'Import not available yet',
      pickerNote: '',
      source: '',
      provider: provider
    };
  };
  var enabled = function(source, pickerNote) {
    return {
      enabled: true,
      reason: '',
      pickerNote: pickerNote || '',
      source: source,
      provider: provider
    };
  };

  if (investmentPortfolioDrawerIs529Account_(mapped)) {
    return disabled('Import not available yet');
  }
  if (provider === 'ROBINHOOD') {
    if (!investmentPortfolioDrawerRobinhoodImportEligible_(mapped)) {
      return disabled('Robinhood CSV requires an eligible investment account');
    }
    return enabled('ROBINHOOD_CSV', '');
  }
  if (provider === 'FIDELITY') {
    if (!investmentPortfolioDrawerIs401kRetirementAccount_(mapped)) {
      return disabled('Import not available yet');
    }
    return enabled('FIDELITY_401K_STATEMENT_PDF', '401(k) supports balance-only import');
  }
  if (provider === 'ETRADE') {
    if (typeof investmentEtradeMatchesSamerBrokerageAccountValueMapping_ === 'function' &&
        investmentEtradeMatchesSamerBrokerageAccountValueMapping_(mapped.accountName, '')) {
      return enabled('ETRADE_CLIENT_STATEMENT_PDF', '');
    }
    return disabled('Import not available yet');
  }
  var formats = investmentPortfolioDrawerCustomerDrawerFormats_(provider, previewMode);
  if (!formats.length) return disabled('Import not available yet');
  return enabled(formats[0].source, '');
}

function investmentPortfolioDrawerOmitFromActivityPicker_(account) {
  var name = String((account && account.accountName) || '').trim();
  if (typeof investmentEtradeCiscoBrokerageAccountValueMapping_ === 'function' &&
      name === investmentEtradeCiscoBrokerageAccountValueMapping_().accountName) {
    return true;
  }
  if (typeof investmentEtradePotentialUnvestedStockPlanMapping_ === 'function' &&
      name === investmentEtradePotentialUnvestedStockPlanMapping_().accountName) {
    return true;
  }
  return false;
}

function investmentPortfolioDrawerDescribePickerAccount_(row) {
  var mapped = investmentPortfolioDrawerMapAccountRow_(row);
  var eligibility = investmentPortfolioDrawerCustomerImportEligibility_(mapped);
  return {
    sysAssetsRow: mapped.sysAssetsRow,
    accountName: mapped.accountName,
    type: mapped.type,
    registrationType: mapped.registrationType,
    currentBalance: row && row.currentBalance !== undefined ? row.currentBalance : mapped.currentBalance,
    investmentId: mapped.investmentId,
    planningPurpose: mapped.planningPurpose,
    inactive: !!(row && row.inactive),
    pickerValue: mapped.pickerValue,
    statementProvider: mapped.statementProvider,
    providerLabel: mapped.providerLabel,
    previewMode: mapped.previewMode,
    customerImportEnabled: eligibility.enabled,
    customerImportDisabledReason: eligibility.reason || '',
    customerImportPickerNote: eligibility.pickerNote || '',
    customerImportSource: eligibility.source || '',
    omitFromActivityPicker: investmentPortfolioDrawerOmitFromActivityPicker_(mapped)
  };
}

function investmentPortfolioDrawerKnownProviderLabel_(account) {
  account = account || {};
  var provider = String(account.statementProvider || '').trim().toUpperCase();
  if (!provider || provider === 'UNKNOWN' || provider === 'OTHER') return '';
  var label = String(account.providerLabel || '').trim();
  return label || investmentPortfolioDrawerProviderLabel_(provider);
}

function investmentPortfolioDrawerBuildPickerOptionLabel_(account) {
  account = account || {};
  var described = account.customerImportEnabled === true || account.customerImportEnabled === false
    ? account
    : investmentPortfolioDrawerDescribePickerAccount_(account);
  var name = String(described.accountName || '').trim();
  var providerLabel = investmentPortfolioDrawerKnownProviderLabel_(described);
  var label = providerLabel ? name + ' · ' + providerLabel : name;
  var note = described.customerImportEnabled
    ? String(described.customerImportPickerNote || '').trim()
    : String(described.customerImportDisabledReason || '').trim();
  if (note) label += ' — ' + note;
  return label;
}

function investmentPortfolioDrawerStatementImportProfiles_() {
  if (typeof investmentEtradeCiscoStatementImportProfile_ !== 'function') return [];
  var profile = investmentEtradeCiscoStatementImportProfile_();
  return [{
    pickerKind: profile.pickerKind,
    pickerValue: profile.pickerValue,
    pickerLabel: profile.pickerLabel,
    statementProvider: profile.provider,
    providerLabel: profile.providerLabel,
    customerImportEnabled: true,
    customerImportDisabledReason: '',
    customerImportPickerNote: '',
    customerImportSource: profile.source,
    inactive: false
  }];
}

function investmentPortfolioDrawerEvaluateCustomerImportRequest_(account, source) {
  var eligibility = investmentPortfolioDrawerCustomerImportEligibility_(account);
  var normalized = investmentPortfolioDrawerNormalizeImportSource_(source);
  if (!normalized) {
    if (!eligibility.enabled) {
      return {
        ok: false,
        error: eligibility.reason || 'Import not available yet',
        customerImportEnabled: false,
        accountName: account && account.accountName,
        statementProvider: eligibility.provider
      };
    }
    return { ok: true, eligibility: eligibility, customerImportEnabled: true };
  }
  if (!investmentPortfolioDrawerIsCustomerProductionSource_(normalized)) {
    if (eligibility.enabled && eligibility.source && normalized === eligibility.source) {
      return { ok: true, eligibility: eligibility, customerImportEnabled: true };
    }
    return { ok: true, eligibility: eligibility, labSource: true };
  }
  if (!eligibility.enabled) {
    return {
      ok: false,
      error: eligibility.reason || 'Import not available yet',
      customerImportEnabled: false,
      accountName: account && account.accountName,
      statementProvider: eligibility.provider,
      source: normalized
    };
  }
  if (eligibility.source && normalized !== eligibility.source) {
    return {
      ok: false,
      error: 'That import source is not available for this account.',
      customerImportEnabled: true,
      accountName: account && account.accountName,
      statementProvider: eligibility.provider,
      source: normalized
    };
  }
  return { ok: true, eligibility: eligibility, customerImportEnabled: true };
}

function investmentPortfolioDrawerResolveAccountFromPayload_(ss, payload) {
  payload = payload || {};
  var pickerValue = String(payload.pickerValue || payload.investmentId || '').trim();
  if (pickerValue) {
    var byPicker = investmentPortfolioDrawerResolveAccount_(ss, pickerValue);
    if (byPicker) return byPicker;
  }
  var wantedName = String(payload.accountName || '').trim().toLowerCase();
  if (!wantedName) return null;
  var rows = investmentPortfolioDrawerReadActiveAccounts_(ss);
  var matches = (rows || []).filter(function(row) {
    return String(row.accountName || '').trim().toLowerCase() === wantedName;
  });
  return matches.length === 1 ? investmentPortfolioDrawerMapAccountRow_(matches[0]) : null;
}

function investmentPortfolioDrawerAssertCustomerImportAllowed_(ss, pickerValueOrPayload, source) {
  var payload = pickerValueOrPayload && typeof pickerValueOrPayload === 'object'
    ? pickerValueOrPayload
    : { pickerValue: pickerValueOrPayload, source: source };
  if (source && !payload.source) payload = Object.assign({}, payload, { source: source });
  var normalized = investmentPortfolioDrawerNormalizeImportSource_(payload.source);
  var account = investmentPortfolioDrawerResolveAccountFromPayload_(ss, payload);
  if (!account && String(payload.accountName || '').trim()) {
    account = investmentPortfolioDrawerMapAccountRow_({
      accountName: payload.accountName,
      investmentId: payload.investmentId,
      type: payload.type,
      planningPurpose: payload.planningPurpose,
      sysAssetsRow: payload.sysAssetsRow,
      registrationType: payload.registrationType
    });
  }
  if (!account) {
    if (normalized && !investmentPortfolioDrawerIsCustomerProductionSource_(normalized)) {
      return { ok: true, labSource: true };
    }
    return { ok: false, error: 'Select an active CashCompass investment account.' };
  }
  return investmentPortfolioDrawerEvaluateCustomerImportRequest_(account, payload.source);
}

function investmentPortfolioDrawerGuardCustomerProductionImport_(ss, payload) {
  payload = payload || {};
  var source = investmentPortfolioDrawerNormalizeImportSource_(payload.source);
  if (typeof investmentEtradeMatchesCiscoStatementImportProfile_ === 'function' &&
      investmentEtradeMatchesCiscoStatementImportProfile_(payload.pickerValue)) {
    if (source && source !== 'ETRADE_CLIENT_STATEMENT_PDF') {
      return {
        ok: false,
        error: 'That import source is not available for this statement profile.'
      };
    }
    return { ok: true, statementImportProfile: true };
  }
  if (!investmentPortfolioDrawerIsCustomerProductionSource_(source)) {
    var labAccount = investmentPortfolioDrawerResolveAccountFromPayload_(ss, payload);
    if (labAccount) {
      var labEligibility = investmentPortfolioDrawerCustomerImportEligibility_(labAccount);
      if (labEligibility.enabled && labEligibility.source && labEligibility.source === source) {
        return investmentPortfolioDrawerAssertCustomerImportAllowed_(ss, payload, source);
      }
    }
    return { ok: true };
  }
  return investmentPortfolioDrawerAssertCustomerImportAllowed_(ss, payload, source);
}

function investmentPortfolioDrawerFilterUnifiedRowsForAccount_(rows, account) {
  rows = rows || [];
  account = account || {};
  var parentName = String(account.accountName || '').trim();
  var investmentId = String(account.investmentId || '').trim();
  return rows.filter(function(row) {
    if (parentName && String(row.parentAccount || '').trim() === parentName) return true;
    if (investmentId && String(row.investmentId || '').trim() === investmentId) return true;
    return false;
  });
}

function investmentPortfolioDrawerLatestAsOfDate_(rows) {
  var latest = '';
  (rows || []).forEach(function(row) {
    var asOf = typeof boundedHoldingsPreviewApplyNormalizeAsOfDate_ === 'function'
      ? boundedHoldingsPreviewApplyNormalizeAsOfDate_(row.asOfDate || row.asOf)
      : String(row.asOfDate || row.asOf || '').trim().slice(0, 10);
    if (asOf && (!latest || asOf > latest)) latest = asOf;
  });
  return latest;
}

function investmentPortfolioDrawerRowsAtAsOf_(rows, asOfDate) {
  asOfDate = String(asOfDate || '').trim();
  if (!asOfDate) return [];
  return (rows || []).filter(function(row) {
    var asOf = typeof boundedHoldingsPreviewApplyNormalizeAsOfDate_ === 'function'
      ? boundedHoldingsPreviewApplyNormalizeAsOfDate_(row.asOfDate || row.asOf)
      : String(row.asOfDate || row.asOf || '').trim().slice(0, 10);
    return asOf === asOfDate;
  });
}

function investmentPortfolioDrawerSummarizeUnifiedRows_(rows) {
  rows = rows || [];
  var latestAsOf = investmentPortfolioDrawerLatestAsOfDate_(rows);
  var latestRows = investmentPortfolioDrawerRowsAtAsOf_(rows, latestAsOf);
  var holdingsCount = 0;
  var marketValueTotal = 0;
  var cashBalance = null;
  latestRows.forEach(function(row) {
    var symbol = String(row.symbol || '').trim();
    var marketValue = Number(row.marketValue);
    if (symbol) {
      holdingsCount += 1;
      if (isFinite(marketValue)) marketValueTotal += marketValue;
    }
    var cash = Number(row.cashBalance);
    if (isFinite(cash)) cashBalance = cash;
  });
  return {
    holdingsImported: rows.length > 0,
    latestAsOf: latestAsOf,
    holdingsCount: holdingsCount,
    marketValueTotal: round2_(marketValueTotal),
    cashBalance: cashBalance == null ? null : round2_(cashBalance)
  };
}

function investmentPortfolioDrawerSerializeUnifiedHoldingRow_(row) {
  row = row || {};
  return {
    symbol: String(row.symbol || '').trim(),
    securityName: String(row.securityName || '').trim(),
    shares: Number(row.shares) || 0,
    price: Number(row.price) || 0,
    marketValue: Number(row.marketValue) || 0,
    costBasis: row.costBasis === '' || row.costBasis == null ? null : Number(row.costBasis),
    unrealizedGainLoss: row.unrealizedGainLoss === '' || row.unrealizedGainLoss == null
      ? null : Number(row.unrealizedGainLoss),
    cashBalance: row.cashBalance === '' || row.cashBalance == null ? null : Number(row.cashBalance),
    asOfDate: typeof boundedHoldingsPreviewApplyNormalizeAsOfDate_ === 'function'
      ? boundedHoldingsPreviewApplyNormalizeAsOfDate_(row.asOfDate || row.asOf)
      : String(row.asOfDate || row.asOf || '').trim().slice(0, 10)
  };
}

function investmentPortfolioDrawerNormalizeAsOfDate_(value) {
  if (typeof boundedHoldingsPreviewApplyNormalizeAsOfDate_ === 'function') {
    return boundedHoldingsPreviewApplyNormalizeAsOfDate_(value);
  }
  return String(value || '').trim().slice(0, 10);
}

function investmentPortfolioDrawerIsAppliedUnifiedRow_(row) {
  row = row || {};
  var status = String(row.importStatus || 'APPLIED').trim().toUpperCase();
  return status === 'APPLIED';
}

function investmentPortfolioDrawerPartitionId_(row) {
  return String(row.childPartition || '').trim() || '__default__';
}

function investmentPortfolioDrawerDistinctAsOfDatesForPartition_(rows, partitionId) {
  var dates = Object.create(null);
  (rows || []).forEach(function(row) {
    if (!investmentPortfolioDrawerIsAppliedUnifiedRow_(row)) return;
    if (investmentPortfolioDrawerPartitionId_(row) !== partitionId) return;
    var asOf = investmentPortfolioDrawerNormalizeAsOfDate_(row.asOfDate || row.asOf);
    if (asOf) dates[asOf] = true;
  });
  return Object.keys(dates).sort();
}

function investmentPortfolioDrawerRowsForPartitionAtAsOf_(rows, partitionId, asOfDate) {
  asOfDate = investmentPortfolioDrawerNormalizeAsOfDate_(asOfDate);
  return (rows || []).filter(function(row) {
    if (!investmentPortfolioDrawerIsAppliedUnifiedRow_(row)) return false;
    return investmentPortfolioDrawerPartitionId_(row) === partitionId &&
      investmentPortfolioDrawerNormalizeAsOfDate_(row.asOfDate || row.asOf) === asOfDate;
  });
}

function investmentPortfolioDrawerResolvePartitionCashFromRows_(partitionRows) {
  var cashBalance = null;
  (partitionRows || []).forEach(function(row) {
    var cash = Number(row.cashBalance);
    if (isFinite(cash)) cashBalance = cash;
  });
  if (cashBalance != null) return cashBalance;
  for (var i = 0; i < (partitionRows || []).length; i += 1) {
    var row = partitionRows[i] || {};
    var symbol = String(row.symbol || '').trim().toUpperCase();
    if (symbol === 'CASH') {
      var marketValue = Number(row.marketValue);
      if (isFinite(marketValue)) return marketValue;
    }
  }
  return null;
}

function investmentPortfolioDrawerSummarizePartitionSnapshot_(partitionRows) {
  var marketValueTotal = 0;
  var documentFingerprint = '';
  (partitionRows || []).forEach(function(row) {
    var symbol = String(row.symbol || '').trim();
    if (symbol) {
      var marketValue = Number(row.marketValue);
      if (isFinite(marketValue)) marketValueTotal += marketValue;
    }
    if (!documentFingerprint) {
      documentFingerprint = String(row.documentFingerprint || '').trim();
    }
  });
  return {
    marketValueTotal: marketValueTotal,
    cashBalance: investmentPortfolioDrawerResolvePartitionCashFromRows_(partitionRows),
    documentFingerprint: documentFingerprint
  };
}

function investmentPortfolioDrawerFindPriorPartitionAsOf_(rows, partitionId, currentAsOf) {
  currentAsOf = investmentPortfolioDrawerNormalizeAsOfDate_(currentAsOf);
  var priorAsOf = '';
  investmentPortfolioDrawerDistinctAsOfDatesForPartition_(rows, partitionId).forEach(function(asOf) {
    if (asOf < currentAsOf && (!priorAsOf || asOf > priorAsOf)) priorAsOf = asOf;
  });
  return priorAsOf;
}

function investmentPortfolioDrawerComputeNumericDelta_(currentValue, priorValue) {
  if (!isFinite(Number(currentValue)) || !isFinite(Number(priorValue))) return null;
  return Number(currentValue) - Number(priorValue);
}

function investmentPortfolioDrawerStatementDeltaDirection_(delta) {
  if (delta == null || !isFinite(delta)) return null;
  if (delta > 0) return 'up';
  if (delta < 0) return 'down';
  return 'flat';
}

function investmentPortfolioDrawerBuildStatementDeltaEntry_(delta) {
  if (delta == null || !isFinite(delta)) return null;
  return {
    delta: delta,
    direction: investmentPortfolioDrawerStatementDeltaDirection_(delta)
  };
}

function investmentPortfolioDrawerBuildPartitionStatementDelta_(rows, partitionId, currentAsOf, currentSnapshot) {
  currentAsOf = investmentPortfolioDrawerNormalizeAsOfDate_(currentAsOf);
  currentSnapshot = currentSnapshot || {};
  var priorAsOf = investmentPortfolioDrawerFindPriorPartitionAsOf_(rows, partitionId, currentAsOf);
  if (!priorAsOf) {
    return {
      status: 'NO_PRIOR_STATEMENT',
      priorAsOfDate: '',
      marketValue: null,
      cash: null
    };
  }

  var priorRows = investmentPortfolioDrawerRowsForPartitionAtAsOf_(rows, partitionId, priorAsOf);
  if (!priorRows.length) {
    return {
      status: 'NO_PRIOR_STATEMENT',
      priorAsOfDate: '',
      marketValue: null,
      cash: null
    };
  }

  var priorSnapshot = investmentPortfolioDrawerSummarizePartitionSnapshot_(priorRows);
  var currentFingerprint = String(currentSnapshot.documentFingerprint || '').trim();
  var priorFingerprint = String(priorSnapshot.documentFingerprint || '').trim();
  if (currentFingerprint && priorFingerprint && currentFingerprint === priorFingerprint) {
    return {
      status: 'NO_DELTA',
      priorAsOfDate: priorAsOf,
      marketValue: null,
      cash: null
    };
  }
  if (priorAsOf === currentAsOf) {
    return {
      status: 'NO_DELTA',
      priorAsOfDate: priorAsOf,
      marketValue: null,
      cash: null
    };
  }

  var marketDelta = investmentPortfolioDrawerComputeNumericDelta_(
    currentSnapshot.marketValueTotal, priorSnapshot.marketValueTotal);
  var cashDelta = null;
  if (currentSnapshot.cashBalance != null && priorSnapshot.cashBalance != null &&
      isFinite(Number(currentSnapshot.cashBalance)) &&
      isFinite(Number(priorSnapshot.cashBalance))) {
    cashDelta = investmentPortfolioDrawerComputeNumericDelta_(
      currentSnapshot.cashBalance, priorSnapshot.cashBalance);
  }

  return {
    status: 'HAS_DELTA',
    priorAsOfDate: priorAsOf,
    marketValue: investmentPortfolioDrawerBuildStatementDeltaEntry_(marketDelta),
    cash: investmentPortfolioDrawerBuildStatementDeltaEntry_(cashDelta)
  };
}

function investmentPortfolioDrawerBuildM1GroupedView_(rows, account) {
  rows = investmentPortfolioDrawerFilterUnifiedRowsForAccount_(rows, account);
  var appliedRows = rows.filter(investmentPortfolioDrawerIsAppliedUnifiedRow_);
  var latestAsOf = investmentPortfolioDrawerLatestAsOfDate_(appliedRows);
  var latestRows = investmentPortfolioDrawerRowsAtAsOf_(appliedRows, latestAsOf);
  var partitionMap = Object.create(null);
  latestRows.forEach(function(row) {
    var partitionId = investmentPortfolioDrawerPartitionId_(row);
    if (!partitionMap[partitionId]) {
      partitionMap[partitionId] = {
        childPartitionId: partitionId,
        label: partitionId === '__default__' ? 'Holdings' : partitionId,
        holdings: [],
        marketValueTotal: 0,
        marketValueRaw: 0,
        cashBalance: null,
        documentFingerprint: '',
        latestAsOf: latestAsOf,
        statementDelta: null
      };
    }
    var entry = partitionMap[partitionId];
    var serialized = investmentPortfolioDrawerSerializeUnifiedHoldingRow_(row);
    if (serialized.symbol) {
      entry.holdings.push(serialized);
      var marketValue = Number(serialized.marketValue || 0);
      if (isFinite(marketValue)) {
        entry.marketValueRaw += marketValue;
        entry.marketValueTotal = round2_(entry.marketValueTotal + marketValue);
      }
    }
    if (serialized.cashBalance != null && isFinite(Number(serialized.cashBalance))) {
      entry.cashBalance = serialized.cashBalance;
    }
    if (!entry.documentFingerprint) {
      entry.documentFingerprint = String(row.documentFingerprint || '').trim();
    }
  });
  var partitions = Object.keys(partitionMap).sort().map(function(key) {
    var partition = partitionMap[key];
    var snapshotRows = investmentPortfolioDrawerRowsForPartitionAtAsOf_(
      appliedRows, partition.childPartitionId, partition.latestAsOf);
    var snapshot = investmentPortfolioDrawerSummarizePartitionSnapshot_(snapshotRows);
    partition.statementDelta = investmentPortfolioDrawerBuildPartitionStatementDelta_(
      appliedRows,
      partition.childPartitionId,
      partition.latestAsOf,
      snapshot);
    delete partition.marketValueRaw;
    delete partition.documentFingerprint;
    return partition;
  });
  var summary = investmentPortfolioDrawerSummarizeUnifiedRows_(rows);
  return {
    parentControlTotal: {
      amount: account.currentBalance === '' || account.currentBalance == null
        ? null : Number(account.currentBalance),
      label: 'Parent control total (CashCompass)'
    },
    parentAggregateExcluded: true,
    partitions: partitions,
    summary: summary
  };
}

function investmentPortfolioDrawerBuildUnifiedSingleView_(rows, account) {
  rows = investmentPortfolioDrawerFilterUnifiedRowsForAccount_(rows, account);
  var summary = investmentPortfolioDrawerSummarizeUnifiedRows_(rows);
  var latestRows = investmentPortfolioDrawerRowsAtAsOf_(rows, summary.latestAsOf);
  var holdings = latestRows.filter(function(row) {
    return !!String(row.symbol || '').trim();
  }).map(investmentPortfolioDrawerSerializeUnifiedHoldingRow_);
  return {
    summary: summary,
    holdings: holdings
  };
}

function investmentPortfolioDrawerBuildRobinhoodLegacySummary_(ss, account) {
  if (!account.investmentId) {
    return {
      holdingsImported: false,
      latestAsOf: '',
      holdingsCount: 0,
      marketValueTotal: null,
      cashBalance: null
    };
  }
  var holdings = getInvestmentHoldingsSummary_(ss, account.investmentId);
  var latestAsOf = investmentActivityLatestHoldingsAsOfDate_(holdings);
  var summary = investmentActivitySummarizeSavedHoldingsPortfolio_(holdings);
  return {
    holdingsImported: holdings.length > 0,
    latestAsOf: latestAsOf,
    holdingsCount: summary.holdingsCount,
    marketValueTotal: round2_(summary.marketValueTotal),
    cashBalance: summary.cashBalance,
    holdingsSource: 'LEGACY_ACTIVITY'
  };
}

function investmentPortfolioDrawerBuildStatusLabel_(summary, providerLabel, previewMode) {
  summary = summary || {};
  if (!summary.holdingsImported) {
    return 'No portfolio holdings imported yet';
  }
  var prefix = providerLabel + ' portfolio imported';
  if (previewMode === 'GROUPED_PROVIDER') {
    prefix = providerLabel + ' grouped portfolio imported';
  }
  if (summary.latestAsOf) {
    return prefix + ' · latest as-of ' + summary.latestAsOf;
  }
  return prefix;
}

function investmentPortfolioDrawerBuildPayload_(ss, account) {
  account = account || {};
  var provider = String(account.statementProvider || '').trim().toUpperCase();
  var eligibility = investmentPortfolioDrawerCustomerImportEligibility_(account);
  var customerFormats = eligibility.enabled
    ? investmentPortfolioDrawerSupportedImportFormats_(provider, account.previewMode).filter(function(fmt) {
      return fmt && fmt.customerDrawerImport === true && fmt.source === eligibility.source;
    })
    : [];
  var unifiedRows = typeof boundedHoldingsPreviewApplyReadExistingRows_ === 'function'
    ? boundedHoldingsPreviewApplyReadExistingRows_(ss) : [];
  var accountUnifiedRows = investmentPortfolioDrawerFilterUnifiedRowsForAccount_(unifiedRows, account);
  var payload = {
    ok: true,
    accountName: account.accountName,
    investmentId: account.investmentId,
    sysAssetsRow: account.sysAssetsRow,
    pickerValue: account.pickerValue,
    statementProvider: provider,
    providerLabel: account.providerLabel,
    previewMode: account.previewMode,
    currentBalance: account.currentBalance,
    incomeProducingEligible: !!account.incomeProducingEligible,
    customerImportEnabled: !!eligibility.enabled,
    customerImportDisabledReason: eligibility.reason || '',
    customerImportPickerNote: eligibility.pickerNote || '',
    robinhoodImportEligible: investmentPortfolioDrawerRobinhoodImportEligible_(account),
    robinhoodCsvImportAvailable: eligibility.enabled && eligibility.source === 'ROBINHOOD_CSV',
    m1ImportAvailable: eligibility.enabled && eligibility.source === 'M1_STATEMENT_PDF',
    schwabImportAvailable: eligibility.enabled && eligibility.source === 'SCHWAB_BROKERAGE_STATEMENT_PDF',
    stashImportAvailable: eligibility.enabled && eligibility.source === 'STASH_BROKERAGE_STATEMENT_PDF',
    fidelity401kImportAvailable: eligibility.enabled &&
      eligibility.source === 'FIDELITY_401K_STATEMENT_PDF',
    etradeSamerImportAvailable: eligibility.enabled &&
      eligibility.source === 'ETRADE_CLIENT_STATEMENT_PDF' &&
      typeof investmentEtradeMatchesSamerBrokerageAccountValueMapping_ === 'function' &&
      investmentEtradeMatchesSamerBrokerageAccountValueMapping_(account.accountName, eligibility.source),
    etradeFutureImportAvailable: false,
    etradeCiscoStatementImportAvailable: false,
    supportedImportFormats: customerFormats,
    viewKind: 'EMPTY',
    portfolioStatus: {
      holdingsImported: false,
      latestAsOf: '',
      holdingsCount: 0,
      marketValueTotal: null,
      cashBalance: null,
      holdingsSource: 'NONE',
      statusLabel: 'No portfolio holdings imported yet'
    },
    parentControlTotal: null,
    m1Grouped: null,
    unifiedHoldings: [],
    holdings: [],
    excludedTickers: []
  };

  if (provider === 'ROBINHOOD') {
    var robinhoodSummary = investmentPortfolioDrawerBuildRobinhoodLegacySummary_(ss, account);
    payload.portfolioStatus = Object.assign({}, robinhoodSummary, {
      holdingsSource: 'LEGACY_ACTIVITY',
      statusLabel: investmentPortfolioDrawerBuildStatusLabel_(
        robinhoodSummary, account.providerLabel, account.previewMode)
    });
    if (account.investmentId && investmentPortfolioDrawerRobinhoodImportEligible_(account)) {
      var activity = getInvestmentPortfolioActivityFromDashboard(account.investmentId, ss);
      payload.viewKind = 'ROBINHOOD_ACTIVITY';
      payload.holdings = activity.holdings || [];
      payload.excludedTickers = activity.excludedTickers || [];
      payload.portfolioStatus.holdingsCount = (activity.holdings || []).length;
      payload.portfolioStatus.holdingsImported = payload.portfolioStatus.holdingsCount > 0;
      payload.portfolioStatus.marketValueTotal = robinhoodSummary.marketValueTotal;
      payload.portfolioStatus.cashBalance = robinhoodSummary.cashBalance;
      payload.portfolioStatus.latestAsOf = robinhoodSummary.latestAsOf;
      payload.savedPortfolioComparison = investmentActivityBuildRobinhoodPortfolioComparisonForDrawer_(
        investmentActivityReadRobinhoodPortfolioComparison_(ss, account.investmentId));
      payload.portfolioStatus.statusLabel = investmentPortfolioDrawerBuildStatusLabel_(
        payload.portfolioStatus, account.providerLabel, account.previewMode);
      return payload;
    }
    if (robinhoodSummary.holdingsImported) {
      payload.viewKind = 'ROBINHOOD_ACTIVITY_READONLY';
      payload.holdings = getInvestmentHoldingsSummary_(ss, account.investmentId).map(function(row) {
        return {
          ticker: row.ticker,
          quantity: row.quantity,
          dividendsReceived: row.dividendsReceived,
          detectedRecurringAmount: 0,
          detectedRecurringDate: '',
          planConfigured: false,
          planFrequency: '',
          plannedAmount: 0,
          planActive: true,
          readOnly: true
        };
      });
      return payload;
    }
    payload.viewKind = 'EMPTY';
    return payload;
  }

  if (provider === 'FIDELITY' || investmentPortfolioDrawerIs401kRetirementAccount_(account)) {
    payload.viewKind = 'FIDELITY_401K_BALANCE';
    payload.fidelity401kImportAvailable = !!payload.fidelity401kImportAvailable;
    payload.m1ImportAvailable = false;
    payload.schwabImportAvailable = false;
    payload.stashImportAvailable = false;
    payload.robinhoodCsvImportAvailable = false;
    payload.etradeSamerImportAvailable = false;
    payload.etradeFutureImportAvailable = false;
    payload.etradeCiscoStatementImportAvailable = false;
    payload.portfolioStatus = {
      holdingsImported: false,
      latestAsOf: '',
      holdingsCount: 0,
      marketValueTotal: account.currentBalance === '' || account.currentBalance == null
        ? null : round2_(Number(account.currentBalance)),
      cashBalance: null,
      holdingsSource: 'WORKBOOK_BALANCE',
      statusLabel: account.currentBalance === '' || account.currentBalance == null ||
        !isFinite(Number(account.currentBalance))
        ? 'Retirement statement preview only — no prior balance on file'
        : 'CashCompass balance on file · preview-only statement import'
    };
    return payload;
  }

  if (accountUnifiedRows.length > 0) {
    if (account.previewMode === 'GROUPED_PROVIDER') {
      payload.m1Grouped = investmentPortfolioDrawerBuildM1GroupedView_(unifiedRows, account);
      payload.viewKind = 'UNIFIED_M1_GROUPED';
      payload.portfolioStatus = Object.assign({}, payload.m1Grouped.summary, {
        holdingsSource: 'UNIFIED',
        statusLabel: investmentPortfolioDrawerBuildStatusLabel_(
          payload.m1Grouped.summary, account.providerLabel, account.previewMode)
      });
      payload.parentControlTotal = payload.m1Grouped.parentControlTotal;
      return payload;
    }
    var unifiedView = investmentPortfolioDrawerBuildUnifiedSingleView_(unifiedRows, account);
    payload.viewKind = 'UNIFIED_SINGLE';
    payload.unifiedHoldings = unifiedView.holdings;
    payload.portfolioStatus = Object.assign({}, unifiedView.summary, {
      holdingsSource: 'UNIFIED',
      statusLabel: investmentPortfolioDrawerBuildStatusLabel_(
        unifiedView.summary, account.providerLabel, account.previewMode)
    });
    return payload;
  }

  if (account.previewMode === 'GROUPED_PROVIDER') {
    payload.parentControlTotal = {
      amount: account.currentBalance === '' || account.currentBalance == null
        ? null : Number(account.currentBalance),
      label: 'Parent control total (CashCompass)'
    };
  }
  payload.viewKind = 'EMPTY';
  return payload;
}

function investmentPortfolioDrawerBuild401kBalanceComparison_(priorBalance, endingBalance) {
  var prior = priorBalance === '' || priorBalance == null ? null : Number(priorBalance);
  if (prior == null || !isFinite(prior)) {
    return { status: 'NO_PRIOR_STATEMENT' };
  }
  var ending = Number(endingBalance);
  if (!isFinite(ending)) return { status: 'NO_PRIOR_STATEMENT' };
  var deltaEntry = investmentPortfolioDrawerBuildStatementDeltaEntry_(prior, ending);
  if (deltaEntry.direction === 'flat') {
    return {
      status: 'NO_DELTA',
      priorBalance: round2_(prior),
      balance: deltaEntry
    };
  }
  return {
    status: 'HAS_DELTA',
    priorBalance: round2_(prior),
    balance: deltaEntry
  };
}

/**
 * Dashboard RPC: preview-only Fidelity 401(k) retirement savings statement PDF.
 * Read-only — no workbook writes.
 *
 * @param {Object} payload
 * @returns {Object}
 */
function previewFidelity401kStatementFromDashboard(payload) {
  payload = payload || {};
  var ss = getUserSpreadsheet_();
  payload = Object.assign({}, payload, { source: 'FIDELITY_401K_STATEMENT_PDF' });
  var customerGate = investmentPortfolioDrawerGuardCustomerProductionImport_(ss, payload);
  if (!customerGate.ok) return customerGate;
  var account = investmentPortfolioDrawerResolveAccountFromPayload_(ss, payload);
  if (!account || !investmentPortfolioDrawerIs401kRetirementAccount_(account)) {
    return {
      ok: false,
      error: 'Select the 401K Account before previewing a retirement savings statement.'
    };
  }
  if (!payload.explicitAccountMatch) {
    return {
      ok: false,
      error: 'Confirm this document belongs to the selected 401K Account.'
    };
  }
  var text = String(payload.rawDocumentText || '').trim();
  if (!text) {
    return { ok: false, error: 'No retirement savings statement text supplied.' };
  }
  var parsed = investmentFidelity401kStatementPreviewFromText_(text);
  if (!parsed.ok) {
    return {
      ok: false,
      error: parsed.error || 'Could not parse retirement savings statement.'
    };
  }
  var preview = parsed.preview || {};
  return {
    ok: true,
    source: 'FIDELITY_401K_STATEMENT_PDF',
    provider: 'FIDELITY',
    importPurpose: 'BALANCE_SNAPSHOT',
    accountType: 'RETIREMENT',
    preview: preview,
    balanceComparison: investmentPortfolioDrawerBuild401kBalanceComparison_(
      account.currentBalance, preview.endingBalance)
  };
}

/**
 * Dashboard RPC: preview-only E*TRADE potential/unvested stock-plan value for
 * Etrade Cisco - Future. Read-only — no workbook writes.
 *
 * @param {Object} payload
 * @returns {Object}
 */
function previewEtradeCiscoFutureStatementFromDashboard(payload) {
  payload = payload || {};
  var ss = getUserSpreadsheet_();
  var mapping = typeof investmentEtradePotentialUnvestedStockPlanMapping_ === 'function'
    ? investmentEtradePotentialUnvestedStockPlanMapping_()
    : {
      accountName: 'Etrade Cisco - Future',
      source: 'ETRADE_CLIENT_STATEMENT_PDF',
      valueCategory: 'POTENTIAL_UNVESTED_STOCK_PLAN',
      valueLabel: 'Potential/unvested stock-plan value',
      warning: 'This value is not vested and is not current brokerage holdings.'
    };
  payload = Object.assign({}, payload, { source: mapping.source });
  var customerGate = investmentPortfolioDrawerGuardCustomerProductionImport_(ss, payload);
  if (!customerGate.ok) return customerGate;
  var account = investmentPortfolioDrawerResolveAccountFromPayload_(ss, payload);
  if (!account ||
      typeof investmentEtradeMatchesPotentialUnvestedStockPlanMapping_ !== 'function' ||
      !investmentEtradeMatchesPotentialUnvestedStockPlanMapping_(account.accountName, mapping.source)) {
    return {
      ok: false,
      error: 'Select ' + mapping.accountName +
        ' before previewing the potential/unvested stock-plan value.'
    };
  }
  if (!payload.explicitAccountMatch) {
    return {
      ok: false,
      error: 'Confirm this document belongs to ' + mapping.accountName + '.'
    };
  }
  var text = String(payload.rawDocumentText || '').trim();
  if (!text) {
    return { ok: false, error: 'No E*TRADE/Morgan Stanley statement text supplied.' };
  }
  var parsed = investmentEtradeClientStatementParseText_(text);
  if (!parsed.ok) {
    return {
      ok: false,
      error: parsed.error || 'Could not parse E*TRADE statement.'
    };
  }
  var preview = investmentEtradeNormalizePotentialUnvestedMonthlyPreview_(parsed);
  if (!preview.ok) {
    return {
      ok: false,
      error: preview.error || 'Could not normalize the potential/unvested stock-plan value.'
    };
  }
  return {
    ok: true,
    source: mapping.source,
    provider: 'ETRADE',
    importPurpose: mapping.valueCategory,
    valueCategory: mapping.valueCategory,
    valueLabel: mapping.valueLabel,
    warning: mapping.warning,
    accountName: mapping.accountName,
    preview: preview,
    brokerageEndingTotalValue: parsed.reconciliation &&
      parsed.reconciliation.endingTotalValue != null
      ? parsed.reconciliation.endingTotalValue
      : (parsed.preamble && parsed.preamble.endingTotalValue),
    balanceComparison: investmentPortfolioDrawerBuild401kBalanceComparison_(
      account.currentBalance, preview.potentialUnvestedStockPlanValue)
  };
}

function investmentPortfolioDrawerResolveCiscoStatementProfileTargets_(ss, profile) {
  profile = profile || (typeof investmentEtradeCiscoStatementImportProfile_ === 'function'
    ? investmentEtradeCiscoStatementImportProfile_() : null);
  if (!profile) {
    return { ok: false, error: 'E*TRADE Cisco statement profile is unavailable.' };
  }
  var rows = investmentPortfolioDrawerReadActiveAccounts_(ss) || [];
  var targets = [];
  var i;
  for (i = 0; i < (profile.legs || []).length; i++) {
    var wanted = String(profile.legs[i].accountName || '').trim();
    var matches = rows.filter(function(row) {
      return String(row.accountName || '').trim() === wanted;
    });
    if (matches.length !== 1) {
      return {
        ok: false,
        error: 'Could not find active CashCompass account "' + wanted + '".'
      };
    }
    var mapped = investmentPortfolioDrawerMapAccountRow_(matches[0]);
    targets.push({
      accountName: mapped.accountName,
      investmentId: mapped.investmentId,
      sysAssetsRow: mapped.sysAssetsRow,
      currentBalance: mapped.currentBalance,
      valueCategory: profile.legs[i].valueCategory,
      valueLabel: profile.legs[i].valueLabel,
      warning: profile.legs[i].warning || ''
    });
  }
  return { ok: true, profile: profile, targets: targets };
}

function investmentPortfolioDrawerBuildCiscoStatementProfilePayload_(ss) {
  var resolved = investmentPortfolioDrawerResolveCiscoStatementProfileTargets_(ss);
  if (!resolved.ok) return resolved;
  var profile = resolved.profile;
  return {
    ok: true,
    pickerKind: profile.pickerKind,
    pickerValue: profile.pickerValue,
    profileLabel: profile.pickerLabel,
    accountName: '',
    investmentId: '',
    statementProvider: profile.provider,
    providerLabel: profile.providerLabel,
    viewKind: 'ETRADE_CISCO_STATEMENT',
    customerImportEnabled: true,
    customerImportSource: profile.source,
    etradeCiscoStatementImportAvailable: true,
    etradeSamerImportAvailable: false,
    etradeFutureImportAvailable: false,
    m1ImportAvailable: false,
    schwabImportAvailable: false,
    stashImportAvailable: false,
    robinhoodCsvImportAvailable: false,
    fidelity401kImportAvailable: false,
    targetAccounts: resolved.targets,
    supportedImportFormats: [{
      source: profile.source,
      label: 'E*TRADE/Morgan Stanley statement PDF',
      productionReady: true,
      customerDrawerImport: true,
      importPurpose: 'STATEMENT_IMPORT_PROFILE'
    }],
    unifiedHoldings: [],
    holdings: [],
    excludedTickers: [],
    portfolioStatus: {
      holdingsImported: false,
      latestAsOf: '',
      holdingsCount: 0,
      marketValueTotal: null,
      cashBalance: null,
      holdingsSource: 'NONE',
      statusLabel: 'One E*TRADE statement updates ' + profile.confirmLabel
    }
  };
}

/**
 * Dashboard RPC: preview-only combined E*TRADE Cisco statement for
 * Etrade Cisco - RSU/ESPP and Etrade Cisco - Future. Read-only — no workbook writes.
 *
 * @param {Object} payload
 * @returns {Object}
 */
function previewEtradeCiscoStatementProfileFromDashboard(payload) {
  payload = payload || {};
  var ss = getUserSpreadsheet_();
  var profile = typeof investmentEtradeCiscoStatementImportProfile_ === 'function'
    ? investmentEtradeCiscoStatementImportProfile_()
    : null;
  if (!profile) {
    return { ok: false, error: 'E*TRADE Cisco statement profile is unavailable.' };
  }
  payload = Object.assign({}, payload, {
    pickerValue: profile.pickerValue,
    source: profile.source,
    accountName: ''
  });
  var customerGate = investmentPortfolioDrawerGuardCustomerProductionImport_(ss, payload);
  if (!customerGate.ok) return customerGate;
  var resolved = investmentPortfolioDrawerResolveCiscoStatementProfileTargets_(ss, profile);
  if (!resolved.ok) return resolved;
  if (!payload.explicitAccountMatch) {
    return {
      ok: false,
      error: 'Confirm this document belongs to ' + profile.confirmLabel + '.'
    };
  }
  var text = String(payload.rawDocumentText || '').trim();
  if (!text) {
    return { ok: false, error: 'No E*TRADE/Morgan Stanley statement text supplied.' };
  }
  var parsed = investmentEtradeClientStatementParseText_(text);
  if (!parsed.ok) {
    return {
      ok: false,
      error: parsed.error || 'Could not parse E*TRADE statement.'
    };
  }
  var preview = investmentEtradeNormalizeCiscoStatementProfilePreview_(parsed);
  if (!preview.ok) {
    return {
      ok: false,
      error: preview.error || 'Could not normalize the E*TRADE Cisco statement.'
    };
  }
  return {
    ok: true,
    source: profile.source,
    provider: 'ETRADE',
    importProfile: 'ETRADE_CISCO_STATEMENT',
    pickerKind: profile.pickerKind,
    pickerValue: profile.pickerValue,
    profileLabel: profile.pickerLabel,
    preview: preview,
    targetAccounts: resolved.targets
  };
}

/**
 * Dashboard RPC: read-only portfolio drawer payload for one active investment account
 * or a statement-import profile picker value.
 *
 * @param {string} pickerValue investmentId, __row__:sysAssetsRow, or __profile__:…
 * @returns {Object}
 */
function getInvestmentPortfolioDrawerFromDashboard(pickerValue) {
  var ss = getUserSpreadsheet_();
  if (typeof investmentEtradeMatchesCiscoStatementImportProfile_ === 'function' &&
      investmentEtradeMatchesCiscoStatementImportProfile_(pickerValue)) {
    return investmentPortfolioDrawerBuildCiscoStatementProfilePayload_(ss);
  }
  var account = investmentPortfolioDrawerResolveAccount_(ss, pickerValue);
  if (!account) {
    return { ok: false, error: 'Select an active CashCompass investment account.' };
  }
  var openGate = investmentPortfolioDrawerEvaluateCustomerImportRequest_(account, '');
  if (!openGate.ok) return openGate;
  return investmentPortfolioDrawerBuildPayload_(ss, account);
}
