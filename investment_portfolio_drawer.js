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

function investmentPortfolioDrawerSupportedImportFormats_(provider, previewMode) {
  provider = String(provider || '').trim().toUpperCase();
  previewMode = String(previewMode || '').trim();
  if (provider === 'ROBINHOOD') {
    return [{ source: 'ROBINHOOD_CSV', label: 'Robinhood activity CSV', productionReady: true }];
  }
  if (provider === 'M1') {
    return [{ source: 'M1_STATEMENT_PDF', label: 'M1 monthly statement PDF', productionReady: true }];
  }
  if (provider === 'ETRADE') {
    return [{
      source: 'ETRADE_POSITIONS_PDF',
      label: 'E*TRADE Expanded Positions PDF',
      productionReady: true
    }];
  }
  if (provider === 'FIDELITY') {
    return [{
      source: 'FIDELITY_401K_STATEMENT_PDF',
      label: 'Retirement savings statement PDF',
      productionReady: true,
      importPurpose: 'BALANCE_SNAPSHOT',
      accountType: 'RETIREMENT'
    }];
  }
  if (provider === 'SCHWAB') {
    return [{ source: 'SCHWAB_CSV', label: 'Schwab CSV (future)', productionReady: false }];
  }
  if (provider === 'STASH') {
    return [{ source: 'MANUAL_STRUCTURED', label: 'Stash import (future)', productionReady: false }];
  }
  if (previewMode === 'GROUPED_PROVIDER') {
    return [{ source: 'M1_STATEMENT_PDF', label: 'M1 monthly statement PDF', productionReady: true }];
  }
  return [];
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
    robinhoodImportEligible: investmentPortfolioDrawerRobinhoodImportEligible_(account),
    robinhoodCsvImportAvailable: investmentPortfolioDrawerRobinhoodImportEligible_(account),
    m1ImportAvailable: provider === 'M1' || account.previewMode === 'GROUPED_PROVIDER',
    supportedImportFormats: investmentPortfolioDrawerSupportedImportFormats_(
      provider, account.previewMode),
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
    payload.fidelity401kImportAvailable = true;
    payload.m1ImportAvailable = false;
    payload.robinhoodCsvImportAvailable = false;
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
  var pickerValue = String(payload.pickerValue || payload.investmentId || '').trim();
  var account = investmentPortfolioDrawerResolveAccount_(ss, pickerValue);
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
 * Dashboard RPC: read-only portfolio drawer payload for one active investment account.
 *
 * @param {string} pickerValue investmentId or __row__:sysAssetsRow
 * @returns {Object}
 */
function getInvestmentPortfolioDrawerFromDashboard(pickerValue) {
  var ss = getUserSpreadsheet_();
  var account = investmentPortfolioDrawerResolveAccount_(ss, pickerValue);
  if (!account) {
    return { ok: false, error: 'Select an active CashCompass investment account.' };
  }
  return investmentPortfolioDrawerBuildPayload_(ss, account);
}
