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

var ETRADE_POSITIONS_MONTHS_ = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
};

function investmentEtradeParsePositionsIdentityColumn_(identity) {
  var text = String(identity || '').trim();
  var corporateEventMarker = /[*!]/.test(text);
  var cleaned = text.replace(/[*!]/g, '').trim();
  if (!cleaned) {
    return { raw: text, symbol: '', cusip: '', corporateEventMarker: corporateEventMarker };
  }
  if (/^[0-9A-Z]{9}$/.test(cleaned) && !/^[A-Z]{1,5}$/.test(cleaned)) {
    return { raw: text, symbol: '', cusip: cleaned.toUpperCase(), corporateEventMarker: corporateEventMarker };
  }
  return {
    raw: text,
    symbol: cleaned.toUpperCase(),
    cusip: '',
    corporateEventMarker: corporateEventMarker
  };
}

function investmentEtradeBuildPositionsSourceSecurityKey_(symbol, typeLabel, cusip) {
  var cusipText = String(cusip || '').trim().toUpperCase();
  if (cusipText) return 'CUSIP:' + cusipText;
  return 'ETRADE|' + String(symbol || '').trim().toUpperCase() + '|' +
    String(typeLabel || 'Trade').trim();
}

function investmentEtradeMapPositionsSecurityType_(typeLabel, symbol) {
  var label = String(typeLabel || '').trim().toLowerCase();
  if (/etf/i.test(label) || /etf/i.test(symbol)) return 'ETF';
  if (/mutual/i.test(label)) return 'MUTUAL_FUND';
  if (/bond/i.test(label)) return 'BOND';
  if (/option/i.test(label)) return 'OPTION';
  return 'UNKNOWN';
}

function investmentEtradeNormalizePositionsRefreshAt_(refreshRaw) {
  var text = String(refreshRaw || '').trim();
  if (!text) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text;
  var match = text.match(/^([A-Za-z]{3,9})\s+(\d{1,2}),\s+(\d{4})(?:\s+(\d{1,2}):(\d{2})\s*(AM|PM)\s*(ET|EST|EDT)?)?/i);
  if (!match) return text;
  var monthKey = match[1].slice(0, 3).toLowerCase();
  var month = ETRADE_POSITIONS_MONTHS_[monthKey];
  if (typeof month !== 'number') return text;
  var day = ('0' + match[2]).slice(-2);
  var year = match[3];
  var isoDate = year + '-' + ('0' + (month + 1)).slice(-2) + '-' + day;
  if (!match[4]) return isoDate + 'T00:00:00.000Z';
  var hour = Number(match[4]) % 12;
  if (String(match[6] || '').toUpperCase() === 'PM') hour += 12;
  var minute = ('0' + match[5]).slice(-2);
  var hourText = ('0' + hour).slice(-2);
  return isoDate + 'T' + hourText + ':' + minute + ':00.000Z';
}

function investmentEtradeExtractPositionsCashBalance_(noiseRows) {
  var cashRow = (noiseRows || []).filter(function(row) {
    return row.reason === 'CASH_ROW';
  })[0];
  if (!cashRow || !cashRow.cells) return null;
  var value = investmentEtradeSafeParsePositionsMoney_(cashRow.cells[10]);
  return isFinite(value) ? value : null;
}

function investmentEtradeResolvePositionsAccountMatch_(input, accountResolution) {
  input = input || {};
  accountResolution = accountResolution || {};
  var accountMeta = input.accountMeta || {};
  var stableAccountId = String(accountMeta.stableAccountId || '').trim();
  var explicitMatch = input.explicitAccountMatch === true || accountMeta.explicitAccountMatch === true;
  var active = accountMeta.active !== false;
  if (!accountResolution.ok) {
    return {
      ok: false,
      stableAccountId: stableAccountId,
      sourceAccountKey: '',
      matchStatus: 'NO_MATCH',
      error: accountResolution.error || 'Account identity unresolved.'
    };
  }
  if (!stableAccountId) {
    return {
      ok: true,
      stableAccountId: '',
      sourceAccountKey: accountResolution.sourceAccountKey,
      matchStatus: accountResolution.reviewRequired ? 'REVIEW_REQUIRED' : 'AMBIGUOUS',
      reviewRequired: true,
      warning: accountResolution.warning || 'stableAccountId is required for durable account identity.'
    };
  }
  if (!active) {
    return {
      ok: true,
      stableAccountId: stableAccountId,
      sourceAccountKey: stableAccountId,
      matchStatus: 'AMBIGUOUS',
      reviewRequired: true,
      warning: 'Inactive account cannot be associated automatically.'
    };
  }
  if (!explicitMatch) {
    return {
      ok: true,
      stableAccountId: stableAccountId,
      sourceAccountKey: stableAccountId,
      matchStatus: 'REVIEW_REQUIRED',
      reviewRequired: true,
      warning: 'Explicit owner account match is required before trusting holdings preview.'
    };
  }
  return {
    ok: true,
    stableAccountId: stableAccountId,
    sourceAccountKey: stableAccountId,
    matchStatus: 'EXPLICIT_MATCH',
    reviewRequired: false
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
    var parsedIdentity = investmentEtradeParsePositionsIdentityColumn_(identity);
    if (!parsedIdentity.symbol && !parsedIdentity.cusip) {
      return { kind: 'UNKNOWN', identity: identity };
    }
    return {
      kind: 'POSITION_HEADER',
      symbol: parsedIdentity.symbol || parsedIdentity.cusip,
      cusip: parsedIdentity.cusip,
      corporateEventMarker: parsedIdentity.corporateEventMarker
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

function investmentEtradeHasPositionsMoney_(value) {
  return value !== null && typeof value !== 'undefined' && value !== '' && isFinite(value);
}

function investmentEtradeExtractPositionsNumericFields_(cells) {
  var pricePaidText = String(cells[6] || '').trim();
  return {
    lastPrice: investmentEtradeSafeParsePositionsMoney_(cells[2]),
    changeDollar: investmentEtradeSafeParsePositionsMoney_(cells[3]),
    changePercent: investmentEtradeSafeParsePositionsNumber_(String(cells[4] || '').replace(/%/g, '')),
    quantity: investmentEtradeSafeParsePositionsNumber_(cells[5]),
    pricePaid: pricePaidText ? investmentEtradeSafeParsePositionsMoney_(cells[6]) : NaN,
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
  if (errors.length) {
    return {
      ok: false,
      reason: 'MALFORMED_POSITION_HEADER',
      rowIndex: row.rowIndex,
      symbol: row.classified.symbol,
      errors: errors
    };
  }
  var typeLabel = String(row.cells[1] || 'Trade').trim();
  var symbol = String(row.classified.symbol || '').trim().toUpperCase();
  var cusip = String(row.classified.cusip || '').trim().toUpperCase();
  var sourceSecurityKey = investmentEtradeBuildPositionsSourceSecurityKey_(symbol, typeLabel, cusip);
  var stableSecurityId = investmentPortfolioHashOpaqueKey_('SEC', sourceSecurityKey);
  var reviewRequired = !!row.classified.corporateEventMarker;
  return {
    ok: true,
    reviewRequired: reviewRequired,
    header: {
      symbol: symbol,
      cusip: cusip,
      stableSecurityId: stableSecurityId,
      sourceSecurityKey: sourceSecurityKey,
      securityTypeLabel: typeLabel,
      securityType: investmentEtradeMapPositionsSecurityType_(typeLabel, symbol),
      sourceRowIndex: row.rowIndex,
      lastPrice: nums.lastPrice,
      changeDollar: nums.changeDollar,
      changePercent: nums.changePercent,
      quantity: nums.quantity,
      pricePaid: investmentEtradeHasPositionsMoney_(nums.pricePaid) ? nums.pricePaid : null,
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
    providerCostBasis: investmentEtradeHasPositionsMoney_(header.pricePaid) ? header.pricePaid : null,
    costBasisQuality: investmentEtradeHasPositionsMoney_(header.pricePaid) ? 'PROVIDER_AGGREGATE' : 'UNKNOWN',
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

function investmentEtradeBuildUnifiedHoldingsPreviewFromPositions_(input, legacyPreview, parseResult, accountMatch) {
  input = input || {};
  legacyPreview = legacyPreview || {};
  parseResult = parseResult || {};
  accountMatch = accountMatch || {};
  var normalized = legacyPreview.normalized || {};
  var accountMeta = input.accountMeta || {};
  var preamble = parseResult.preamble || normalized.preamble || {};
  var sourceAsOf = investmentEtradeNormalizePositionsRefreshAt_(preamble.refreshAt || '');
  var registrationType = investmentPortfolioNormalizeRegistrationType_(
    accountMeta.registrationType || 'TAXABLE');
  var taxStatus = investmentPortfolioResolveTaxStatus_(registrationType);
  var fingerprint = normalized.sourceFileFingerprint ||
    investmentEtradeBuildPositionsFileFingerprint_(investmentEtradeExtractHoldingsContent_(input));
  var stableAccountId = String(accountMatch.stableAccountId || '').trim();
  var matchStatus = String(accountMatch.matchStatus || 'REVIEW_REQUIRED').toUpperCase();
  var confidence = matchStatus === 'EXPLICIT_MATCH' ? 'HIGH' : 'MEDIUM';
  if (['AMBIGUOUS', 'CONFLICT', 'NO_MATCH', 'REVIEW_REQUIRED'].indexOf(matchStatus) !== -1) {
    confidence = 'LOW';
  }

  var preview = investmentPortfolioBuildEmptyHoldingsPreview_({
    source: 'ETRADE_POSITIONS_PDF',
    parserVersion: legacyPreview.parserVersion || ETRADE_POSITIONS_PDF_PARSER_VERSION_,
    asOf: sourceAsOf,
    observedAt: String(input.observedAt || '')
  });
  preview.source = 'ETRADE_POSITIONS_PDF';
  preview.parserVersion = legacyPreview.parserVersion || ETRADE_POSITIONS_PDF_PARSER_VERSION_;
  preview.sourceFiles = [{
    role: 'HOLDINGS',
    fileName: String(input.fileName || 'etrade-positions.pdf').trim() || 'etrade-positions.pdf',
    sourceFileFingerprint: fingerprint,
    sourceAsOf: sourceAsOf,
    parserVersion: ETRADE_POSITIONS_PDF_PARSER_VERSION_
  }];
  preview.capabilities = {
    activities: false,
    holdings: (normalized.holdingsSnapshots || []).length > 0,
    taxLots: (normalized.taxLots || []).length > 0,
    accountSnapshot: !!(preamble.netAccountValue || investmentEtradeExtractPositionsCashBalance_(parseResult.noiseRows)),
    dividendHistory: false,
    realizedGainLoss: false
  };
  preview.accounts = [{
    investmentId: String(input.investmentId || accountMeta.investmentId || ''),
    stableAccountId: stableAccountId,
    institution: 'E*TRADE',
    displayName: String(accountMeta.accountName || preamble.accountLabel || '').trim(),
    accountType: String(accountMeta.accountType || 'Brokerage').trim() || 'Brokerage',
    registrationType: registrationType,
    domain: investmentPortfolioResolveDomainForRegistration_(registrationType),
    taxStatus: taxStatus,
    portfolioRoles: investmentPortfolioResolvePortfolioRoles_(accountMeta),
    active: accountMeta.active !== false,
    matchStatus: matchStatus,
    sourceAccountKey: String(accountMatch.sourceAccountKey || normalized.sourceAccountKey || '').trim()
  }];
  preview.securities = (normalized.securities || []).map(function(security) {
    return {
      stableSecurityId: security.stableSecurityId,
      ticker: security.ticker || '',
      cusip: security.cusip || '',
      securityName: security.securityName || '',
      securityType: security.securityType || 'UNKNOWN',
      assetClass: 'UNKNOWN',
      primarySource: 'ETRADE_POSITIONS_PDF',
      sourceSecurityKey: security.sourceSecurityKey
    };
  });
  preview.holdings = (normalized.holdingsSnapshots || []).map(function(row) {
    var holding = {
      stableAccountId: stableAccountId || String(row.stableAccountId || ''),
      stableSecurityId: row.stableSecurityId,
      ticker: row.ticker || '',
      shares: row.quantity,
      price: row.currentPrice,
      priceAsOf: sourceAsOf,
      marketValue: row.marketValue,
      providerCostBasis: row.providerCostBasis,
      costBasisQuality: row.costBasisQuality || 'UNKNOWN',
      unrealizedGainLoss: row.unrealizedGain,
      authority: row.authority || 'PROVIDER_REPORTED',
      source: 'ETRADE_POSITIONS_PDF',
      sourceSnapshotKey: fingerprint,
      sourceAsOf: sourceAsOf,
      sourceFileFingerprint: fingerprint,
      dataQuality: row.dataQuality || 'PROVIDER_REPORTED',
      freshness: sourceAsOf ? 'CURRENT' : 'UNKNOWN',
      confidence: confidence,
      reviewRequired: !!row.reviewRequired
    };
    holding.replayKey = investmentPortfolioBuildHoldingsSnapshotReplayKey_({
      source: holding.source,
      sourceAccountKey: accountMatch.sourceAccountKey || stableAccountId,
      sourceSnapshotKey: holding.sourceSnapshotKey,
      stableSecurityId: holding.stableSecurityId,
      shares: holding.shares,
      marketValue: holding.marketValue,
      providerCostBasis: holding.providerCostBasis,
      unrealizedGainLoss: holding.unrealizedGainLoss,
      sourceAsOf: holding.sourceAsOf
    });
    return holding;
  }).filter(function(row, index, rows) {
    return rows.findIndex(function(other) {
      return other.stableSecurityId === row.stableSecurityId &&
        other.stableAccountId === row.stableAccountId;
    }) === index;
  });
  preview.taxLots = (normalized.taxLots || []).map(function(lot) {
    return {
      stableLotId: lot.stableLotId,
      stableAccountId: stableAccountId || lot.stableAccountId,
      stableSecurityId: lot.stableSecurityId,
      ticker: lot.ticker || '',
      acquisitionDate: lot.acquisitionDate,
      originalQuantity: lot.originalQuantity,
      remainingQuantity: lot.remainingQuantity,
      costPerShare: lot.costPerShare,
      originalCostBasis: lot.originalCostBasis,
      adjustedCostBasis: lot.adjustedCostBasis,
      costBasisQuality: lot.costBasisQuality || 'PROVIDER_LOT',
      lotAuthority: lot.lotAuthority || 'PROVIDER_REPORTED',
      currentPrice: lot.currentPrice,
      currentValue: lot.currentValue,
      unrealizedGainLoss: lot.unrealizedGain,
      washSaleAdjusted: !!lot.washSaleAdjusted,
      sourceLotKey: lot.sourceLotKey,
      sourceAsOf: sourceAsOf,
      source: 'ETRADE_POSITIONS_PDF'
    };
  });
  preview.realizedGainLoss = [];
  preview.distributions = [];
  preview.activities = [];
  var cashBalance = investmentEtradeExtractPositionsCashBalance_(parseResult.noiseRows);
  if (preamble.netAccountValue || cashBalance !== null) {
    preview.accountSnapshots = [{
      stableAccountId: stableAccountId || String(accountMatch.sourceAccountKey || ''),
      snapshotType: cashBalance !== null ? 'CASH' : 'RETIREMENT_BALANCE',
      marketValue: preamble.netAccountValue,
      cashBalance: cashBalance,
      asOf: sourceAsOf,
      authority: 'PROVIDER_REPORTED',
      sourceSnapshotKey: fingerprint,
      sourceAsOf: sourceAsOf,
      source: 'ETRADE_POSITIONS_PDF'
    }];
  }
  preview.importSummary = investmentPortfolioBuildImportPreviewSummary_({
    source: 'ETRADE_POSITIONS_PDF',
    parserVersion: preview.parserVersion,
    reportedHoldings: preview.holdings.length,
    providerLots: preview.taxLots.length,
    excludedActivities: (normalized.unsupportedRows || []).length,
    account: accountMeta.accountName || preamble.accountLabel,
    warnings: normalized.warnings || [],
    capabilities: preview.capabilities
  });
  preview.warnings = (normalized.warnings || []).slice();
  preview.unsupportedRows = (normalized.unsupportedRows || []).slice();
  preview.recommendationReadiness = investmentPortfolioEvaluateRecommendationReadiness_(preview);
  if (preview.capabilities.realizedGainLoss === false &&
      !preview.recommendationReadiness.blockingReasons.length &&
      preview.recommendationReadiness.trustedForHoldingsVisibility) {
    preview.recommendationReadiness.trustedForIncomeAnalysis = false;
    preview.recommendationReadiness.trustedForTaxLotSalePlanning =
      preview.taxLots.length > 0 && preview.recommendationReadiness.trustedForTaxLotSalePlanning;
  }
  return preview;
}

function investmentEtradePreviewPositionsPdfUnifiedHoldings_(input) {
  input = input || {};
  var legacyPreview = investmentEtradePreviewPositionsPdf_(input);
  if (!legacyPreview.ok) return legacyPreview;
  var rawText = investmentEtradeExtractHoldingsContent_(input);
  var parseResult = investmentEtradeParsePositionsPdfText_(rawText);
  var accountMeta = input.accountMeta || {};
  var accountResolution = investmentEtradeResolvePositionsSourceAccountKey_(parseResult, accountMeta);
  var accountMatch = investmentEtradeResolvePositionsAccountMatch_(input, accountResolution);
  var unified = investmentEtradeBuildUnifiedHoldingsPreviewFromPositions_(
    input, legacyPreview, parseResult, accountMatch);
  var reviewRequired = legacyPreview.reviewRequired ||
    !unified.recommendationReadiness.trustedForHoldingsVisibility;
  return {
    ok: true,
    reviewRequired: reviewRequired,
    source: 'ETRADE_POSITIONS_PDF',
    parserVersion: legacyPreview.parserVersion,
    schemaVersion: INVESTMENT_PORTFOLIO_SCHEMA_VERSION_,
    contractVersion: PORTFOLIO_INTELLIGENCE_HOLDINGS_CONTRACT_VERSION_,
    capabilities: unified.capabilities,
    normalized: unified,
    legacyNormalized: legacyPreview.normalized
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
  if (typeof investmentEtradeClientStatementClassifyDocumentType_ === 'function') {
    var docClass = investmentEtradeClientStatementClassifyDocumentType_(rawText);
    if (docClass.documentType === 'ETRADE_CLIENT_STATEMENT_PDF') {
      return {
        ok: false,
        reviewRequired: true,
        source: source,
        error: 'Document matches an E*TRADE monthly client statement. Use ETRADE_CLIENT_STATEMENT_PDF source.'
      };
    }
  }
  if (typeof investmentEtradeClientStatementAssessTextQuality_ === 'function') {
    var stmtQuality = investmentEtradeClientStatementAssessTextQuality_(rawText);
    if (stmtQuality.quality === 'ENCODING_FAILURE') {
      return {
        ok: false,
        reviewRequired: true,
        source: source,
        error: 'Extracted PDF text is encoding-corrupt and cannot be parsed as Expanded Positions.'
      };
    }
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
  var accountMatch = investmentEtradeResolvePositionsAccountMatch_(input, accountResolution);
  if (!accountMatch.ok) {
    return {
      ok: false,
      reviewRequired: true,
      source: source,
      error: accountMatch.error
    };
  }
  var context = investmentEtradeBuildPositionsContext_(input, parseResult, {
    sourceAccountKey: accountMatch.sourceAccountKey,
    reviewRequired: accountMatch.reviewRequired,
    warning: accountMatch.warning
  });
  context.stableAccountId = accountMatch.stableAccountId || context.stableAccountId;
  var headersBySymbol = {};
  var headerOrder = [];
  var currentHeader = null;
  var excluded = [];
  var warnings = [];
  if (accountMatch.warning) warnings.push(accountMatch.warning);
  if (accountResolution.warning && accountResolution.warning !== accountMatch.warning) {
    warnings.push(accountResolution.warning);
  }

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
    holdingsSnapshots.push(investmentEtradeBuildHoldingsSnapshotRecord_(header, context));
    header.openLots.forEach(function(lot) {
      taxLots.push(investmentEtradeBuildOpenLotRecord_(lot, context));
    });
    securities.push({
      stableSecurityId: header.stableSecurityId,
      ticker: header.symbol,
      cusip: header.cusip || '',
      securityName: '',
      securityType: header.securityType,
      primarySource: 'ETRADE_POSITIONS_PDF',
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
    return /mismatch|review/i.test(text);
  }) || holdingsSnapshots.some(function(row) { return row.reviewRequired; }) ||
    accountMatch.reviewRequired === true;

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

  normalized.portfolioIntelligenceHoldings = investmentEtradeBuildUnifiedHoldingsPreviewFromPositions_(
    input,
    { ok: true, parserVersion: ETRADE_POSITIONS_PDF_PARSER_VERSION_, normalized: normalized },
    parseResult,
    accountMatch
  );
  normalized.capabilities.accountSnapshot =
    (normalized.portfolioIntelligenceHoldings.accountSnapshots || []).length > 0;

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
