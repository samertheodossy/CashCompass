/**
 * E*TRADE Expanded Positions PDF — preview-only text parser (Phase B).
 *
 * Parses PDF text/table extracts into canonical holdings snapshots and open tax lots.
 * No persistence or workbook writes.
 */

var ETRADE_POSITIONS_PDF_PARSER_VERSION_ = 'etrade-positions-pdf-v1';

var ETRADE_POSITIONS_PDF_TABLE_COLUMNS_ = [
  'identity', 'securityTypeLabel', 'lastPrice', 'changeDollar', 'changePercent',
  'quantity', 'pricePaid', 'daysGain', 'totalGain', 'totalGainPercent', 'marketValue'
];

function investmentEtradeSplitPositionsPdfLine_(line) {
  var text = String(line || '').trim();
  if (!text || /^#/.test(text)) return null;
  if (text.indexOf('|') >= 0) {
    return text.split('|').map(function(cell) { return String(cell || '').trim(); });
  }
  return text.split('\t').map(function(cell) { return String(cell || '').trim(); });
}

function investmentEtradeFindPositionsHeaderIndex_(lines) {
  for (var i = 0; i < (lines || []).length; i++) {
    var line = String(lines[i] || '');
    if (/Symbol\s*\/\s*CUSIP/i.test(line) && /Last Price/i.test(line) &&
        /Qty/i.test(line) && /Value/i.test(line)) {
      return i;
    }
  }
  return -1;
}

function investmentEtradeParsePositionsPreamble_(lines, headerIndex) {
  var preambleLines = lines.slice(0, headerIndex);
  var refreshAt = '';
  var accountLabel = '';
  var netAccountValue = null;
  var positionCountLabel = '';
  preambleLines.forEach(function(line) {
    var text = String(line || '').trim();
    if (!text || /^#/.test(text)) return;
    var refreshMatch = text.match(/^Refresh:\s*(.+)$/i);
    if (refreshMatch) {
      refreshAt = String(refreshMatch[1] || '').trim();
      return;
    }
    var accountMatch = text.match(/^Account:\s*(.+)$/i);
    if (accountMatch) {
      accountLabel = String(accountMatch[1] || '').trim();
      return;
    }
    var navMatch = text.match(/^Net Account Value:\s*(.+)$/i);
    if (navMatch) {
      netAccountValue = parseInvestmentImportMoney_(navMatch[1]);
      return;
    }
    var viewingMatch = text.match(/^Viewing\s+(\d+)\s+of\s+(\d+)\s+positions?/i);
    if (viewingMatch) {
      positionCountLabel = viewingMatch[1] + ' of ' + viewingMatch[2];
    }
  });
  return {
    refreshAt: refreshAt,
    accountLabel: accountLabel,
    netAccountValue: netAccountValue,
    positionCountLabel: positionCountLabel,
    lineCount: preambleLines.length
  };
}

function investmentEtradeParsePositionsAcquisitionDate_(identity) {
  var text = String(identity || '').trim();
  var match = text.match(/^(\d{1,2}\/\d{1,2}\/\d{4})(?:\s+WS)?$/i);
  if (!match) return { ok: false };
  var normalized = normalizeInvestmentImportDate_(match[1]);
  if (!normalized) return { ok: false };
  return {
    ok: true,
    acquisitionDate: normalized,
    acquisitionDateRaw: text,
    washSaleAdjusted: /\bWS\b/i.test(text)
  };
}

function investmentEtradeClassifyPositionsRow_(cells) {
  var identity = String(cells[0] || '').trim();
  var typeLabel = String(cells[1] || '').trim();
  if (!identity) {
    return { kind: 'SKIP', reason: 'EMPTY_IDENTITY' };
  }
  if (/^total$/i.test(identity)) {
    return { kind: 'NOISE', reason: 'PAGE_TOTAL' };
  }
  if (/^cash$/i.test(identity)) {
    return { kind: 'NOISE', reason: 'CASH_ROW' };
  }
  var lotDate = investmentEtradeParsePositionsAcquisitionDate_(identity);
  if (lotDate.ok) {
    return { kind: 'OPEN_LOT', lotDate: lotDate };
  }
  if (/^trade$/i.test(typeLabel) && /^[A-Z][A-Z0-9.\-]{0,11}$/i.test(identity.replace(/[*!]/g, ''))) {
    return {
      kind: 'POSITION_HEADER',
      symbol: identity.replace(/[*!]/g, '').toUpperCase(),
      corporateEventMarker: /[*!]/.test(identity)
    };
  }
  return { kind: 'UNKNOWN', identity: identity };
}

function investmentEtradeParsePositionsPdfText_(rawText) {
  var text = String(rawText || '');
  if (!text.trim()) {
    return { ok: false, error: 'E*TRADE Positions PDF text is empty.' };
  }
  var lines = text.split(/\r?\n/);
  var headerIndex = investmentEtradeFindPositionsHeaderIndex_(lines);
  if (headerIndex < 0) {
    return { ok: false, error: 'File does not match E*TRADE Expanded Positions table headers.' };
  }
  var preamble = investmentEtradeParsePositionsPreamble_(lines, headerIndex);
  var dataLines = lines.slice(headerIndex + 1);
  var parsedRows = [];
  var noiseRows = [];
  var skippedRows = [];
  dataLines.forEach(function(line, offset) {
    var rowIndex = headerIndex + 2 + offset;
    var cells = investmentEtradeSplitPositionsPdfLine_(line);
    if (!cells || !cells.length) return;
    if (cells.length === 1 && /wash sale/i.test(cells[0])) return;
    while (cells.length < ETRADE_POSITIONS_PDF_TABLE_COLUMNS_.length) cells.push('');
    var classified = investmentEtradeClassifyPositionsRow_(cells);
    if (classified.kind === 'NOISE') {
      noiseRows.push({ rowIndex: rowIndex, reason: classified.reason, cells: cells });
      return;
    }
    if (classified.kind === 'SKIP') {
      skippedRows.push({ rowIndex: rowIndex, reason: classified.reason });
      return;
    }
    parsedRows.push({
      rowIndex: rowIndex,
      cells: cells,
      classified: classified
    });
  });
  return {
    ok: true,
    preamble: preamble,
    parsedRows: parsedRows,
    noiseRows: noiseRows,
    skippedRows: skippedRows,
    headerIndex: headerIndex
  };
}

function investmentEtradeSafeParsePositionsMoney_(text) {
  try {
    var value = parseInvestmentImportMoney_(text);
    return isFinite(value) ? value : NaN;
  } catch (e) {
    return NaN;
  }
}

function investmentEtradeSafeParsePositionsNumber_(text) {
  try {
    var value = parseInvestmentImportNumber_(text);
    return isFinite(value) ? value : NaN;
  } catch (e) {
    return NaN;
  }
}

function investmentEtradeExtractPositionsNumericFields_(cells) {
  return {
    lastPrice: investmentEtradeSafeParsePositionsMoney_(cells[2]),
    changeDollar: investmentEtradeSafeParsePositionsMoney_(cells[3]),
    changePercent: investmentEtradeSafeParsePositionsNumber_(String(cells[4] || '').replace(/%/g, '')),
    quantity: investmentEtradeSafeParsePositionsNumber_(cells[5]),
    pricePaid: investmentEtradeSafeParsePositionsMoney_(cells[6]),
    daysGain: investmentEtradeSafeParsePositionsMoney_(cells[7]),
    totalGain: investmentEtradeSafeParsePositionsMoney_(cells[8]),
    totalGainPercent: investmentEtradeSafeParsePositionsNumber_(String(cells[9] || '').replace(/%/g, '')),
    marketValue: investmentEtradeSafeParsePositionsMoney_(cells[10])
  };
}

function investmentEtradeBuildPositionsContext_(input, parseResult, accountResolution) {
  var accountMeta = input.accountMeta || {};
  var registrationType = investmentPortfolioNormalizeRegistrationType_(
    accountMeta.registrationType || 'TAXABLE');
  var source = investmentPortfolioNormalizeSource_(input.source) || 'ETRADE_PACKAGE';
  return {
    source: source,
    sourceAccountKey: accountResolution.sourceAccountKey,
    parserVersion: ETRADE_POSITIONS_PDF_PARSER_VERSION_,
    investmentId: String(input.investmentId || accountMeta.investmentId || ''),
    stableAccountId: String(accountMeta.stableAccountId || ''),
    registrationType: registrationType,
    incomeBucketSnapshot: investmentPortfolioResolveIncomeBucket_(registrationType),
    priceAsOf: parseResult.preamble.refreshAt || '',
    sourceFileFingerprint: investmentEtradeBuildPositionsFileFingerprint_(input.rawPositionsText ||
      investmentEtradeExtractHoldingsContent_(input))
  };
}

function investmentEtradeExtractHoldingsContent_(input) {
  input = input || {};
  var files = input.files || [];
  if (input.rawPositionsText) return String(input.rawPositionsText);
  var holdingsFile = files.filter(function(file) {
    return String(file.role || '').toUpperCase() === 'HOLDINGS';
  })[0];
  return String(holdingsFile && holdingsFile.content || '');
}

function investmentEtradeBuildPositionsFileFingerprint_(rawText) {
  return investmentPortfolioDigest_([String(rawText || '')]);
}

function investmentEtradeResolvePositionsSourceAccountKey_(parseResult, accountMeta) {
  accountMeta = accountMeta || {};
  var stable = String(accountMeta.stableAccountId || '').trim();
  if (stable) {
    return {
      ok: true,
      sourceAccountKey: stable,
      reviewRequired: false
    };
  }
  var label = String(parseResult.preamble.accountLabel || '').trim();
  if (label) {
    return {
      ok: true,
      sourceAccountKey: investmentPortfolioHashOpaqueKey_('ETRADE_ACCT', label),
      reviewRequired: true,
      warning: 'stableAccountId is required before replaying E*TRADE holdings across separate pools.'
    };
  }
  return {
    ok: false,
    reviewRequired: true,
    error: 'E*TRADE Positions preview requires stableAccountId or Account line in PDF preamble.'
  };
}

function investmentEtradeNormalizePositionsHeader_(row, context) {
  var nums = investmentEtradeExtractPositionsNumericFields_(row.cells);
  var errors = [];
  if (!isFinite(nums.quantity)) errors.push('quantity');
  if (!isFinite(nums.lastPrice)) errors.push('lastPrice');
  if (!isFinite(nums.marketValue)) errors.push('marketValue');
  if (!isFinite(nums.pricePaid)) errors.push('pricePaid');
  if (errors.length) {
    return {
      ok: false,
      reason: 'MALFORMED_POSITION_HEADER',
      rowIndex: row.rowIndex,
      symbol: row.classified.symbol,
      errors: errors
    };
  }
  var symbol = row.classified.symbol;
  var stableSecurityId = investmentPortfolioHashOpaqueKey_('SEC', symbol);
  var reviewRequired = !!row.classified.corporateEventMarker;
  return {
    ok: true,
    reviewRequired: reviewRequired,
    header: {
      symbol: symbol,
      stableSecurityId: stableSecurityId,
      sourceSecurityKey: symbol,
      securityTypeLabel: String(row.cells[1] || 'Trade').trim(),
      securityType: 'UNKNOWN',
      sourceRowIndex: row.rowIndex,
      lastPrice: nums.lastPrice,
      changeDollar: nums.changeDollar,
      changePercent: nums.changePercent,
      quantity: nums.quantity,
      pricePaid: nums.pricePaid,
      daysGain: nums.daysGain,
      totalGain: nums.totalGain,
      totalGainPercent: nums.totalGainPercent,
      marketValue: nums.marketValue,
      corporateEventMarker: !!row.classified.corporateEventMarker,
      openLots: []
    }
  };
}

function investmentEtradeNormalizeOpenLotRow_(row, parent, context) {
  var nums = investmentEtradeExtractPositionsNumericFields_(row.cells);
  var errors = [];
  if (!isFinite(nums.quantity)) errors.push('quantity');
  if (!isFinite(nums.pricePaid)) errors.push('pricePaid');
  if (!isFinite(nums.marketValue)) errors.push('marketValue');
  if (errors.length) {
    return {
      ok: false,
      reason: 'MALFORMED_OPEN_LOT',
      rowIndex: row.rowIndex,
      parentSymbol: parent.symbol,
      errors: errors
    };
  }
  var lotDate = row.classified.lotDate;
  var stableLotId = investmentPortfolioHashOpaqueKey_('LOT', [
    context.sourceAccountKey,
    parent.symbol,
    lotDate.acquisitionDateRaw,
    nums.quantity,
    nums.pricePaid
  ].join('|'));
  return {
    ok: true,
    reviewRequired: false,
    lot: {
      stableLotId: stableLotId,
      stableSecurityId: parent.stableSecurityId,
      ticker: parent.symbol,
      sourceSecurityKey: parent.symbol,
      acquisitionDate: lotDate.acquisitionDate,
      acquisitionDateRaw: lotDate.acquisitionDateRaw,
      washSaleAdjusted: lotDate.washSaleAdjusted,
      sourceRowIndex: row.rowIndex,
      lastPrice: isFinite(nums.lastPrice) ? nums.lastPrice : parent.lastPrice,
      quantity: nums.quantity,
      pricePaid: nums.pricePaid,
      daysGain: nums.daysGain,
      totalGain: nums.totalGain,
      totalGainPercent: nums.totalGainPercent,
      marketValue: nums.marketValue
    }
  };
}

function investmentEtradeBuildHoldingsSnapshotRecord_(header, context) {
  return {
    stableAccountId: context.stableAccountId || context.sourceAccountKey,
    sourceAccountKey: context.sourceAccountKey,
    investmentId: context.investmentId,
    ticker: header.symbol,
    sourceSecurityKey: header.sourceSecurityKey,
    stableSecurityId: header.stableSecurityId,
    securityType: header.securityType,
    quantity: header.quantity,
    currentPrice: header.lastPrice,
    marketValue: header.marketValue,
    providerCostBasis: header.pricePaid,
    costBasisQuality: 'PROVIDER_AGGREGATE',
    unrealizedGain: header.totalGain,
    unrealizedGainPercent: header.totalGainPercent,
    authority: 'PROVIDER_REPORTED',
    reconstructionStatus: 'PROVIDER_SNAPSHOT',
    source: context.source,
    sourceSnapshotKey: context.sourceFileFingerprint,
    sourceAsOfDate: context.priceAsOf,
    priceAsOf: context.priceAsOf,
    parserVersion: context.parserVersion,
    dataQuality: 'PROVIDER_REPORTED',
    sourceRowIndex: header.sourceRowIndex,
    openLotCount: header.openLots.length,
    reviewRequired: header.reviewRequired
  };
}

function investmentEtradeBuildOpenLotRecord_(lot, context) {
  var costPerShare = lot.quantity ? lot.pricePaid / lot.quantity : null;
  return {
    stableLotId: lot.stableLotId,
    investmentId: context.investmentId,
    stableAccountId: context.stableAccountId || context.sourceAccountKey,
    sourceAccountKey: context.sourceAccountKey,
    ticker: lot.ticker,
    stableSecurityId: lot.stableSecurityId,
    sourceSecurityKey: lot.sourceSecurityKey,
    acquisitionDate: lot.acquisitionDate,
    originalQuantity: lot.quantity,
    remainingQuantity: lot.quantity,
    costPerShare: isFinite(costPerShare) ? Math.round(costPerShare * 10000) / 10000 : null,
    originalCostBasis: lot.pricePaid,
    adjustedCostBasis: lot.pricePaid,
    costBasisQuality: lot.washSaleAdjusted ? 'PROVIDER_LOT' : 'PROVIDER_LOT',
    lotAuthority: 'PROVIDER_REPORTED',
    lotStatus: 'OPEN',
    source: context.source,
    sourceLotKey: lot.acquisitionDateRaw,
    currentPrice: lot.lastPrice,
    currentValue: lot.marketValue,
    unrealizedGain: lot.totalGain,
    unrealizedGainPercent: lot.totalGainPercent,
    washSaleAdjusted: lot.washSaleAdjusted,
    asOfDate: context.priceAsOf,
    parserVersion: context.parserVersion,
    dataQuality: 'PROVIDER_REPORTED',
    sourceRowIndex: lot.sourceRowIndex,
    reviewRequired: lot.reviewRequired
  };
}

function investmentEtradePreviewPositionsPdf_(input) {
  input = input || {};
  var source = investmentPortfolioNormalizeSource_(input.source) || 'ETRADE_PACKAGE';
  var rawText = investmentEtradeExtractHoldingsContent_(input);
  if (!rawText.trim()) {
    return {
      ok: false,
      reviewRequired: true,
      source: source,
      error: 'E*TRADE Positions PDF text content is required.'
    };
  }
  var parseResult = investmentEtradeParsePositionsPdfText_(rawText);
  if (!parseResult.ok) {
    return {
      ok: false,
      reviewRequired: true,
      source: source,
      error: parseResult.error
    };
  }
  var accountMeta = input.accountMeta || {};
  var accountResolution = investmentEtradeResolvePositionsSourceAccountKey_(parseResult, accountMeta);
  if (!accountResolution.ok) {
    return {
      ok: false,
      reviewRequired: true,
      source: source,
      error: accountResolution.error
    };
  }
  var context = investmentEtradeBuildPositionsContext_(input, parseResult, accountResolution);
  var headersBySymbol = {};
  var headerOrder = [];
  var currentHeader = null;
  var excluded = [];
  var warnings = [];
  if (accountResolution.warning) warnings.push(accountResolution.warning);

  parseResult.parsedRows.forEach(function(row) {
    if (row.classified.kind === 'POSITION_HEADER') {
      var normalizedHeader = investmentEtradeNormalizePositionsHeader_(row, context);
      if (!normalizedHeader.ok) {
        excluded.push({
          reason: normalizedHeader.reason,
          rowIndex: normalizedHeader.rowIndex,
          symbol: normalizedHeader.symbol || '',
          errors: normalizedHeader.errors || []
        });
        currentHeader = null;
        return;
      }
      currentHeader = normalizedHeader.header;
      headersBySymbol[currentHeader.symbol] = currentHeader;
      headerOrder.push(currentHeader.symbol);
      return;
    }
    if (row.classified.kind === 'OPEN_LOT') {
      if (!currentHeader) {
        excluded.push({
          reason: 'ORPHAN_OPEN_LOT',
          rowIndex: row.rowIndex,
          errors: ['missing parent position header']
        });
        return;
      }
      var normalizedLot = investmentEtradeNormalizeOpenLotRow_(row, currentHeader, context);
      if (!normalizedLot.ok) {
        excluded.push({
          reason: normalizedLot.reason,
          rowIndex: normalizedLot.rowIndex,
          symbol: normalizedLot.parentSymbol || '',
          errors: normalizedLot.errors || []
        });
        return;
      }
      currentHeader.openLots.push(normalizedLot.lot);
      return;
    }
    excluded.push({
      reason: 'AMBIGUOUS_ROW',
      rowIndex: row.rowIndex,
      symbol: row.classified.identity || '',
      errors: ['unrecognized positions row shape']
    });
  });

  var holdingsSnapshots = [];
  var taxLots = [];
  var securities = [];
  headerOrder.forEach(function(symbol) {
    var header = headersBySymbol[symbol];
    if (!header) return;
    var lotQtySum = header.openLots.reduce(function(sum, lot) {
      return sum + (isFinite(lot.quantity) ? lot.quantity : 0);
    }, 0);
    if (header.openLots.length && Math.abs(lotQtySum - header.quantity) > 0.001) {
      header.reviewRequired = true;
      warnings.push('Quantity mismatch for ' + symbol + ': header ' + header.quantity +
        ' vs open lots ' + lotQtySum + '.');
    }
    if (header.openLots.length === 0) {
      header.reviewRequired = true;
      warnings.push('Position ' + symbol + ' has no open-lot children in export.');
    }
    holdingsSnapshots.push(investmentEtradeBuildHoldingsSnapshotRecord_(header, context));
    header.openLots.forEach(function(lot) {
      taxLots.push(investmentEtradeBuildOpenLotRecord_(lot, context));
    });
    securities.push({
      stableSecurityId: header.stableSecurityId,
      ticker: header.symbol,
      securityName: '',
      securityType: header.securityType,
      primarySource: context.source,
      sourceSecurityKey: header.sourceSecurityKey
    });
  });

  var cashNoise = parseResult.noiseRows.filter(function(row) {
    return row.reason === 'CASH_ROW';
  }).length;
  var pageTotalNoise = parseResult.noiseRows.filter(function(row) {
    return row.reason === 'PAGE_TOTAL';
  }).length;
  if (cashNoise) {
    warnings.push('Excluded ' + cashNoise + ' cash row(s) from holdings parse.');
  }
  if (pageTotalNoise) {
    warnings.push('Excluded ' + pageTotalNoise + ' page total row(s) as parser noise.');
  }

  var reviewRequired = excluded.length > 0 || warnings.some(function(text) {
    return /mismatch|no open-lot|review/i.test(text);
  }) || holdingsSnapshots.some(function(row) { return row.reviewRequired; }) ||
    accountResolution.reviewRequired === true;

  var normalized = {
    source: source,
    parserVersion: ETRADE_POSITIONS_PDF_PARSER_VERSION_,
    schemaVersion: INVESTMENT_PORTFOLIO_SCHEMA_VERSION_,
    capabilities: {
      activities: false,
      holdings: true,
      taxLots: true,
      accountSnapshot: false,
      dividendHistory: false,
      realizedGainLoss: false
    },
    accountCandidates: [{
      investmentId: context.investmentId,
      stableAccountId: context.stableAccountId || context.sourceAccountKey,
      accountName: String(accountMeta.accountName || parseResult.preamble.accountLabel || '').trim(),
      registrationType: context.registrationType,
      domain: investmentPortfolioResolveDomainForRegistration_(context.registrationType),
      portfolioRoles: investmentPortfolioResolvePortfolioRoles_(accountMeta)
    }],
    preamble: parseResult.preamble,
    sourceAccountKey: context.sourceAccountKey,
    sourceFileFingerprint: context.sourceFileFingerprint,
    activities: [],
    holdingsSnapshots: holdingsSnapshots,
    taxLots: taxLots,
    securities: securities,
    accountSnapshots: [],
    warnings: warnings,
    unsupportedRows: excluded,
    positionsParseMeta: {
      cashRowsExcluded: cashNoise,
      pageTotalsExcluded: pageTotalNoise,
      noiseRowsExcluded: parseResult.noiseRows.length
    },
    importSummary: investmentPortfolioBuildImportPreviewSummary_({
      source: source,
      parserVersion: ETRADE_POSITIONS_PDF_PARSER_VERSION_,
      reportedHoldings: holdingsSnapshots.length,
      providerLots: taxLots.length,
      excludedActivities: excluded.length,
      account: accountMeta.accountName || parseResult.preamble.accountLabel,
      warnings: warnings
    })
  };

  taxLots.forEach(function(lot) {
    var validation = investmentPortfolioValidateTaxLot_(lot);
    if (!validation.ok) {
      reviewRequired = true;
      warnings.push('Tax lot validation failed at row ' + lot.sourceRowIndex + '.');
    }
  });

  return {
    ok: true,
    reviewRequired: reviewRequired,
    source: source,
    parserVersion: ETRADE_POSITIONS_PDF_PARSER_VERSION_,
    schemaVersion: INVESTMENT_PORTFOLIO_SCHEMA_VERSION_,
    capabilities: normalized.capabilities,
    normalized: normalized
  };
}

function investmentEtradeHasActivityInput_(input) {
  input = input || {};
  if (String(input.rawCsv || '').trim()) return true;
  var files = input.files || [];
  return files.some(function(file) {
    var role = String(file.role || 'ACTIVITY').toUpperCase();
    return role === 'ACTIVITY' && String(file.content || '').trim();
  });
}

function investmentEtradeHasHoldingsInput_(input) {
  input = input || {};
  if (String(input.rawPositionsText || '').trim()) return true;
  var files = input.files || [];
  return files.some(function(file) {
    return String(file.role || '').toUpperCase() === 'HOLDINGS' &&
      String(file.content || '').trim();
  });
}

function investmentEtradeDetectPositionsPdf_(input) {
  input = input || {};
  var rawText = investmentEtradeExtractHoldingsContent_(input);
  if (!rawText.trim()) {
    return { ok: false, reason: 'No E*TRADE Positions PDF text supplied.' };
  }
  var lines = rawText.split(/\r?\n/);
  if (investmentEtradeFindPositionsHeaderIndex_(lines) < 0) {
    return { ok: false, reason: 'File does not match E*TRADE Expanded Positions table headers.' };
  }
  var source = investmentPortfolioNormalizeSource_(input.source) || 'ETRADE_PACKAGE';
  return { ok: true, source: source, inferredRoles: ['HOLDINGS'] };
}

function investmentEtradeDetectPackage_(input) {
  input = input || {};
  var roles = [];
  if (investmentEtradeHasActivityInput_(input)) {
    var txnDetect = investmentEtradeDetectTxnCsv_(input);
    if (txnDetect.ok) roles.push('ACTIVITY');
  }
  if (investmentEtradeHasHoldingsInput_(input)) {
    var posDetect = investmentEtradeDetectPositionsPdf_(input);
    if (posDetect.ok) roles.push('HOLDINGS');
  }
  if (!roles.length) {
    return {
      ok: false,
      reason: 'No recognizable E*TRADE ACTIVITY CSV or HOLDINGS Positions PDF text supplied.'
    };
  }
  var source = investmentPortfolioNormalizeSource_(input.source) || 'ETRADE_PACKAGE';
  return { ok: true, source: source, inferredRoles: roles };
}

function investmentEtradeMergePackageNormalized_(base, overlay) {
  base = base || {};
  overlay = overlay || {};
  base.holdingsSnapshots = overlay.holdingsSnapshots || [];
  base.taxLots = overlay.taxLots || [];
  base.securities = overlay.securities || [];
  base.positionsParseMeta = overlay.positionsParseMeta || null;
  if (overlay.preamble && overlay.preamble.refreshAt) {
    base.positionsPreamble = overlay.preamble;
  }
  base.capabilities = base.capabilities || {};
  base.capabilities.holdings = (overlay.holdingsSnapshots || []).length > 0;
  base.capabilities.taxLots = (overlay.taxLots || []).length > 0;
  base.warnings = (base.warnings || []).concat(overlay.warnings || []);
  base.unsupportedRows = (base.unsupportedRows || []).concat(overlay.unsupportedRows || []);
  if (overlay.importSummary) {
    base.importSummary = base.importSummary || {};
    base.importSummary.holdings = overlay.importSummary.holdings;
    base.importSummary.taxLots = overlay.importSummary.taxLots;
    base.importSummary.reportedHoldings = overlay.importSummary.holdings &&
      overlay.importSummary.holdings.reportedCount;
    base.importSummary.providerLots = overlay.importSummary.taxLots &&
      overlay.importSummary.taxLots.providerReported;
  }
  return base;
}

function investmentEtradePreviewPackage_(input) {
  input = input || {};
  var detection = investmentEtradeDetectPackage_(input);
  if (!detection.ok) {
    return {
      ok: false,
      reviewRequired: true,
      source: investmentPortfolioNormalizeSource_(input.source) || 'ETRADE_PACKAGE',
      error: detection.reason
    };
  }
  var roles = detection.inferredRoles || [];
  var mergedPreview = null;
  var parserVersions = [];

  if (roles.indexOf('ACTIVITY') >= 0) {
    var txnPreview = investmentEtradePreviewTxnCsv_(input);
    if (!txnPreview.ok) return txnPreview;
    mergedPreview = txnPreview;
    parserVersions.push(txnPreview.parserVersion);
  }
  if (roles.indexOf('HOLDINGS') >= 0) {
    var posPreview = investmentEtradePreviewPositionsPdf_(input);
    if (!posPreview.ok) return posPreview;
    parserVersions.push(posPreview.parserVersion);
    if (!mergedPreview) {
      mergedPreview = posPreview;
    } else {
      investmentEtradeMergePackageNormalized_(mergedPreview.normalized, posPreview.normalized);
      mergedPreview.reviewRequired = mergedPreview.reviewRequired || posPreview.reviewRequired;
      mergedPreview.normalized.capabilities.activities = true;
      mergedPreview.normalized.capabilities.holdings = true;
      mergedPreview.normalized.capabilities.taxLots = true;
    }
  }

  mergedPreview.parserVersion = parserVersions.join('+');
  mergedPreview.normalized.parserVersion = mergedPreview.parserVersion;
  return mergedPreview;
}
