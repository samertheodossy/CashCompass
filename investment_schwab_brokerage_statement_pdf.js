/**
 * Schwab monthly brokerage statement PDF — preview-only text parser.
 *
 * Parses Positions - Equities into PORTFOLIO_INTELLIGENCE_HOLDINGS_V1 previews.
 * Positions - Unpriced Securities are unsupported (never zero-coerced).
 * Transactions, tax lots, realized gain/loss, and estimated income/yield are ignored.
 * No persistence, logging of private statement content, or workbook writes.
 */

var SCHWAB_BROKERAGE_STATEMENT_PDF_PARSER_VERSION_ = 'schwab-brokerage-statement-pdf-v1';

/** Absolute reconciliation tolerance — reuse E*TRADE client-statement rule. */
var SCHWAB_BROKERAGE_STATEMENT_RECONCILIATION_TOLERANCE_USD_ = 2.00;

var SCHWAB_BROKERAGE_STATEMENT_MONTHS_ = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12
};

function investmentSchwabNormalizeStatementText_(raw) {
  return String(raw || '')
    .replace(/[\uE000-\uF8FF]/g, '/')
    .replace(/\uFFFD/g, '')
    .replace(/\f/g, '\n')
    .replace(/[\u00A0\u2000-\u200B]/g, ' ')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');
}

function investmentSchwabCompactStatementText_(text) {
  return String(text || '')
    .replace(/\|/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function investmentSchwabLooksLikeBrokerageStatementPdf_(text) {
  var compact = investmentSchwabCompactStatementText_(text);
  if (!compact) return false;
  var branding = /Charles\s+Schwab|Schwab\s+One|Schwab\s+Brokerage|\bSchwab\b/i.test(compact);
  var equities = /Positions\s*[-–]\s*Equities/i.test(compact);
  return branding && equities;
}

function investmentSchwabLooksLikeM1Statement_(compact) {
  compact = String(compact || '');
  return /M1:|Finance Super App|Total account value \/ 1-month change/i.test(compact) ||
    (/Statement period:/i.test(compact) &&
      (/Account breakdown/i.test(compact) ||
        /Symbol Quantity Price Market value/i.test(compact)));
}

function investmentSchwabLooksLikeEtradeClientStatement_(compact) {
  compact = String(compact || '');
  return /Security\s+Description\s+Quantity\s+Share\s+Price/i.test(compact) &&
    /Ending\s+Total\s+Value/i.test(compact);
}

function investmentSchwabHasMoney_(value) {
  return value !== null && typeof value !== 'undefined' && value !== '' && isFinite(value);
}

/**
 * Parse optional money. Empty / N/A / em-dash stay null.
 * Never coerce missing values to zero. Explicit $0.00 remains 0.
 */
function investmentSchwabParseOptionalMoney_(value) {
  var text = String(value == null ? '' : value).trim();
  if (!text) return null;
  if (/^(n\/?a|na|—|–|--|-|\.|none)$/i.test(text)) return null;
  try {
    var parsed = parseInvestmentImportMoney_(text);
    return isFinite(parsed) ? parsed : null;
  } catch (e) {
    return null;
  }
}

function investmentSchwabParseOptionalQuantity_(value) {
  var text = String(value == null ? '' : value).trim();
  if (!text) return null;
  if (/^(n\/?a|na|—|–|--|-)$/i.test(text)) return null;
  try {
    var parsed = parseInvestmentImportNumber_(text);
    return isFinite(parsed) ? parsed : null;
  } catch (e) {
    return null;
  }
}

function investmentSchwabSplitStatementLine_(line) {
  var text = String(line || '').trim();
  if (!text || /^#/.test(text)) return [];
  if (text.indexOf('|') >= 0) {
    return text.split('|').map(function(cell) { return String(cell || '').trim(); });
  }
  if (text.indexOf('\t') >= 0) {
    return text.split('\t').map(function(cell) { return String(cell || '').trim(); });
  }
  var spaced = text.split(/\s{2,}/).map(function(cell) { return String(cell || '').trim(); });
  return spaced.length >= 2 ? spaced : [text];
}

function investmentSchwabIsTicker_(value) {
  return /^[A-Z][A-Z0-9.]{0,9}$/.test(String(value || '').trim());
}

function investmentSchwabIsStopSection_(line) {
  var text = String(line || '').trim();
  return /^(Transactions|Transaction\s+Detail|Activity(?:\s+Detail)?|Realized\s+Gains?(?:\s*\/?\s*Losses?)?|Tax\s+Lots?|Estimated\s+(?:Income|Yield)|Income\s+and\s+Expense|Account\s+Detail)\b/i.test(text);
}

function investmentSchwabIsUnpricedSection_(line) {
  return /Positions\s*[-–]\s*Unpriced\s+Securities|^Unpriced\s+Securities\b/i.test(String(line || ''));
}

function investmentSchwabIsEquitiesSection_(line) {
  return /Positions\s*[-–]\s*Equities/i.test(String(line || ''));
}

function investmentSchwabIsHoldingsHeader_(cells, line) {
  var joined = (cells && cells.length ? cells.join(' ') : String(line || '')).replace(/\|/g, ' ');
  return /\bSymbol\b/i.test(joined) && /\bQuantity\b/i.test(joined);
}

function investmentSchwabIsTotalRow_(cells, line) {
  var joined = (cells && cells.length ? cells.join(' ') : String(line || ''));
  return /^\s*Total\b/i.test(joined);
}

function investmentSchwabParseNamedDate_(text) {
  var raw = String(text || '').trim();
  if (!raw) return '';
  var named = raw.match(/([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})/);
  if (!named) return '';
  var month = SCHWAB_BROKERAGE_STATEMENT_MONTHS_[String(named[1] || '').toLowerCase()];
  if (!month) return '';
  return ('0' + month).slice(-2) + '/' + ('0' + named[2]).slice(-2) + '/' + named[3];
}

function investmentSchwabParseStatementPeriodEnd_(text) {
  var compact = investmentSchwabCompactStatementText_(text);
  var match = compact.match(/Statement\s+Period[:\s]+([^|]+?)(?:\s+Account\s+Value|\s+Positions\s|\s+Account\s+Number|$)/i);
  var raw = match ? String(match[1] || '').trim() : '';
  if (!raw) return '';
  var monthRange = raw.match(/([A-Za-z]+)\s+\d{1,2}\s*[–\-]\s*(\d{1,2}),?\s*(\d{4})/);
  if (monthRange) {
    return investmentSchwabParseNamedDate_(monthRange[1] + ' ' + monthRange[2] + ', ' + monthRange[3]);
  }
  var through = raw.match(/(?:to|through|–|-)\s*([A-Za-z]+\s+\d{1,2},?\s*\d{4}|\d{1,2}\/\d{1,2}\/\d{4})\s*$/i);
  if (through) {
    var endRaw = String(through[1] || '').trim();
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(endRaw)) return endRaw;
    return investmentSchwabParseNamedDate_(endRaw);
  }
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(raw)) return raw;
  return investmentSchwabParseNamedDate_(raw);
}

function investmentSchwabNormalizeAsOf_(periodEndRaw) {
  var text = String(periodEndRaw || '').trim();
  if (!text) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) {
    return text.indexOf('T') >= 0 ? text : text + 'T00:00:00.000Z';
  }
  try {
    var normalized = normalizeInvestmentImportDate_(text, 'Statement period end');
    return normalized + 'T00:00:00.000Z';
  } catch (e) {
    return '';
  }
}

function investmentSchwabParseAccountValue_(compact) {
  compact = String(compact || '');
  var ending = compact.match(
    /Ending\s+Account\s+Value(?:\s+as\s+of\s+\d{1,2}\/\d{1,2})?[\s\S]{0,200}?(\$[\d,]+\.\d{2})/i);
  if (ending) return investmentSchwabParseOptionalMoney_(ending[1]);
  var genericRe = /(?:Total\s+)?Account\s+Value[:\s]+(\$?\(?[\d,.\-]+\)?)/ig;
  var match;
  while ((match = genericRe.exec(compact))) {
    var before = compact.slice(Math.max(0, match.index - 12), match.index);
    if (/Beginning\s+$/i.test(before)) continue;
    return investmentSchwabParseOptionalMoney_(match[1]);
  }
  return null;
}

function investmentSchwabParseCashBalance_(compact) {
  compact = String(compact || '');
  var endingCash = compact.match(
    /Ending\s+Cash\*?\s*(?:as\s+of\s+\d{1,2}\/\d{1,2})?[:\s]+(\$?\(?[\d,.\-]+\)?)/i);
  if (endingCash) return investmentSchwabParseOptionalMoney_(endingCash[1]);
  var labeled = compact.match(/Cash\s*&\s*Cash\s+Investments[:\s]+(\$?\(?[\d,.\-]+\)?)/i) ||
    compact.match(/Cash\s+Balance[:\s]+(\$?\(?[\d,.\-]+\)?)/i);
  if (labeled) return investmentSchwabParseOptionalMoney_(labeled[1]);
  return null;
}

function investmentSchwabParsePreamble_(preparedText) {
  var compact = investmentSchwabCompactStatementText_(preparedText);
  var maskedMatch = compact.match(/Account\s+(?:Number|#)[:\s]+(X+\d+|[•*]+[\dX]+)/i);
  return {
    statementPeriodEnd: investmentSchwabParseStatementPeriodEnd_(preparedText),
    accountValue: investmentSchwabParseAccountValue_(compact),
    cashBalance: investmentSchwabParseCashBalance_(compact),
    maskedAccountNumber: maskedMatch ? String(maskedMatch[1] || '').trim() : '',
    accountLabel: ''
  };
}

function investmentSchwabParseEquityRow_(cells, line) {
  cells = cells || [];
  var ticker = '';
  var description = '';
  var quantity = null;
  var price = null;
  var marketValue = null;
  var costBasis = null;
  var unrealized = null;
  if (cells.length >= 3 && investmentSchwabIsTicker_(cells[0])) {
    ticker = String(cells[0] || '').trim().toUpperCase();
    description = String(cells[1] || '').trim();
    quantity = investmentSchwabParseOptionalQuantity_(cells[2]);
    price = investmentSchwabParseOptionalMoney_(cells[3]);
    marketValue = investmentSchwabParseOptionalMoney_(cells[4]);
    costBasis = investmentSchwabParseOptionalMoney_(cells[5]);
    unrealized = investmentSchwabParseOptionalMoney_(cells[6]);
  }
  return {
    ticker: ticker,
    description: description,
    quantity: quantity,
    price: price,
    marketValue: marketValue,
    providerCostBasis: costBasis,
    unrealizedGainLoss: unrealized,
    sourceLine: String(line || '').trim()
  };
}

function investmentSchwabParseUnpricedRow_(cells, line) {
  cells = cells || [];
  var ticker = '';
  var description = '';
  var quantity = null;
  var price = null;
  var marketValue = null;
  var costBasis = null;
  if (cells.length >= 2 && investmentSchwabIsTicker_(cells[0])) {
    ticker = String(cells[0] || '').trim().toUpperCase();
    description = String(cells[1] || '').trim();
    quantity = investmentSchwabParseOptionalQuantity_(cells[2]);
    if (cells.length <= 4) {
      costBasis = investmentSchwabParseOptionalMoney_(cells[3]);
    } else {
      price = investmentSchwabParseOptionalMoney_(cells[3]);
      marketValue = investmentSchwabParseOptionalMoney_(cells[4]);
      costBasis = investmentSchwabParseOptionalMoney_(cells[5]);
    }
  }
  return {
    ticker: ticker,
    description: description,
    quantity: quantity,
    price: price,
    marketValue: marketValue,
    providerCostBasis: costBasis,
    sourceLine: String(line || '').trim()
  };
}

var SCHWAB_SPACE_JOINED_RESERVED_TICKERS_ = {
  POSITIONS: true,
  SYMBOL: true,
  DESCRIPTION: true,
  QUANTITY: true,
  PRICE: true,
  MARKET: true,
  VALUE: true,
  COST: true,
  BASIS: true,
  TOTAL: true,
  EQUITIES: true,
  UNPRICED: true,
  SECURITIES: true,
  EST: true,
  YIELD: true,
  ANNUAL: true,
  INCOME: true,
  ACCT: true,
  BEGINNING: true,
  ENDING: true,
  ACCOUNT: true,
  CASH: true,
  TRANSACTIONS: true,
  STATEMENT: true,
  CHARLES: true,
  SCHWAB: true,
  BROKERAGE: true
};

function investmentSchwabReservedSpaceJoinedTicker_(ticker) {
  return !!SCHWAB_SPACE_JOINED_RESERVED_TICKERS_[String(ticker || '').toUpperCase()];
}

function investmentSchwabHasPipeHoldingsLayout_(text) {
  return /Positions\s*[-–]\s*Equities[\s\S]{0,1200}\|/.test(String(text || ''));
}

function investmentSchwabSliceSection_(text, startRe, endRe) {
  var src = String(text || '');
  var start = src.search(startRe);
  if (start < 0) return '';
  var rest = src.slice(start);
  var end = rest.slice(1).search(endRe);
  return end < 0 ? rest : rest.slice(0, end + 1);
}

function investmentSchwabStripSchwabPositionsHeader_(section, kind) {
  var text = String(section || '');
  if (kind === 'UNPRICED') {
    text = text.replace(/^Positions\s*[-–]\s*Unpriced\s+Securities\s*/i, '');
  } else {
    text = text.replace(/^Positions\s*[-–]\s*Equities\s*/i, '');
  }
  text = text.replace(/^Symbol\s+Description\s+Quantity\s*/i, '');
  text = text.replace(/^Price\(\$\)\s*Market\s*Value\(\$\)\s*Cost\s*Basis\(\$\)\s*/i, '');
  text = text.replace(/^Unrealized\s+Gain\/\(Loss\)\(\$\)\s*/i, '');
  text = text.replace(/^Est\.\s*Yield\s+Est\.\s*Annual\s+Income\(\$\)\s*/i, '');
  text = text.replace(/^%of\s*Acct\s*/i, '');
  return text.trim();
}

function investmentSchwabParseSpaceJoinedEquityRows_(section) {
  var body = investmentSchwabStripSchwabPositionsHeader_(section, 'EQUITIES');
  body = body.replace(/\s*Total\s+Equities[\s\S]*$/i, '').trim();
  var holdings = [];
  var re = new RegExp(
    '\\b([A-Z][A-Z0-9.]{0,9})\\s+' +
    '(.+?)\\s+' +
    '(\\d+(?:\\.\\d+)?)\\s+' +
    '(\\d+\\.\\d{2,8})\\s+' +
    '(\\(?[\\d,]+\\.\\d{2}\\)?)\\s+' +
    '(\\(?[\\d,]+\\.\\d{2}\\)?)\\s+' +
    '(\\(?[\\d,]+\\.\\d{2}\\)?)\\s+' +
    '(N\\/A|\\d+(?:\\.\\d+)?%)\\s+' +
    '(N\\/A|-?[\\d,]+\\.?\\d*)\\s+' +
    '(<\\d+%|\\d+%)',
    'g'
  );
  var match;
  while ((match = re.exec(body))) {
    var ticker = String(match[1] || '').trim().toUpperCase();
    if (!investmentSchwabIsTicker_(ticker) || investmentSchwabReservedSpaceJoinedTicker_(ticker)) {
      continue;
    }
    var quantity = investmentSchwabParseOptionalQuantity_(match[3]);
    var price = investmentSchwabParseOptionalMoney_(match[4]);
    var marketValue = investmentSchwabParseOptionalMoney_(match[5]);
    var costBasis = investmentSchwabParseOptionalMoney_(match[6]);
    var unrealized = investmentSchwabParseOptionalMoney_(match[7]);
    if (!investmentSchwabHasMoney_(quantity) ||
        !investmentSchwabHasMoney_(price) ||
        !investmentSchwabHasMoney_(marketValue)) {
      continue;
    }
    holdings.push({
      symbol: ticker,
      ticker: ticker,
      description: String(match[2] || '').trim(),
      quantity: quantity,
      price: price,
      marketValue: marketValue,
      providerCostBasis: investmentSchwabHasMoney_(costBasis) ? costBasis : null,
      unrealizedGainLoss: investmentSchwabHasMoney_(unrealized) ? unrealized : null
    });
  }
  return holdings;
}

function investmentSchwabParseSpaceJoinedUnpricedRows_(section) {
  var body = investmentSchwabStripSchwabPositionsHeader_(section, 'UNPRICED');
  body = body.replace(/\s*Total\s+Unpriced[\s\S]*$/i, '').trim();
  if (!body) return [];
  var match = body.match(/^(.+?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)(?:\s+e)?(?:\s+N\/A)+\s*$/i);
  if (!match) return [];
  return [{
    symbol: '',
    ticker: '',
    description: String(match[1] || '').trim(),
    quantity: investmentSchwabParseOptionalQuantity_(match[2]),
    price: null,
    marketValue: null,
    providerCostBasis: investmentSchwabParseOptionalMoney_(match[3]),
    reason: 'UNPRICED_SECURITY'
  }];
}

function investmentSchwabParseSpaceJoinedHoldings_(text) {
  var equitiesSection = investmentSchwabSliceSection_(
    text,
    /Positions\s*[-–]\s*Equities/i,
    /Positions\s*[-–]\s*Unpriced|Transactions\s*-|Transaction\s+Details|Terms\s+and\s+Conditions/i
  );
  var unpricedSection = investmentSchwabSliceSection_(
    text,
    /Positions\s*[-–]\s*Unpriced\s+Securities/i,
    /Total\s+Unpriced\s+Securities|Transactions\s*-|Transaction\s+Details|Terms\s+and\s+Conditions/i
  );
  var excluded = investmentSchwabParseSpaceJoinedUnpricedRows_(unpricedSection);
  if (unpricedSection && !excluded.length) {
    var fallbackCells = investmentSchwabSplitStatementLine_(
      investmentSchwabStripSchwabPositionsHeader_(unpricedSection, 'UNPRICED'));
    var fallback = investmentSchwabParseUnpricedRow_(fallbackCells, unpricedSection);
    if (fallback.ticker || investmentSchwabHasMoney_(fallback.quantity)) {
      excluded.push({
        symbol: fallback.ticker,
        ticker: fallback.ticker,
        description: fallback.description,
        quantity: fallback.quantity,
        price: null,
        marketValue: null,
        providerCostBasis: fallback.providerCostBasis,
        reason: 'UNPRICED_SECURITY'
      });
    }
  }
  return {
    holdings: investmentSchwabParseSpaceJoinedEquityRows_(equitiesSection),
    excluded: excluded
  };
}

function investmentSchwabParseHoldingsSections_(lines) {
  var holdings = [];
  var excluded = [];
  var section = '';
  var i;
  for (i = 0; i < lines.length; i += 1) {
    var line = String(lines[i] || '').trim();
    if (!line) continue;
    if (investmentSchwabIsEquitiesSection_(line)) {
      section = 'EQUITIES';
      continue;
    }
    if (investmentSchwabIsUnpricedSection_(line)) {
      section = 'UNPRICED';
      continue;
    }
    if (investmentSchwabIsStopSection_(line)) {
      section = 'STOP';
      continue;
    }
    if (section === 'STOP' || !section) continue;
    var cells = investmentSchwabSplitStatementLine_(line);
    if (investmentSchwabIsHoldingsHeader_(cells, line) || investmentSchwabIsTotalRow_(cells, line)) {
      continue;
    }
    if (section === 'UNPRICED') {
      var unpriced = investmentSchwabParseUnpricedRow_(cells, line);
      if (!unpriced.ticker && !unpriced.quantity) continue;
      excluded.push({
        symbol: unpriced.ticker,
        ticker: unpriced.ticker,
        description: unpriced.description,
        quantity: unpriced.quantity,
        price: unpriced.price,
        marketValue: unpriced.marketValue,
        providerCostBasis: unpriced.providerCostBasis,
        reason: 'UNPRICED_SECURITY'
      });
      continue;
    }
    var row = investmentSchwabParseEquityRow_(cells, line);
    if (!row.ticker) continue;
    if (!investmentSchwabHasMoney_(row.quantity) ||
        !investmentSchwabHasMoney_(row.price) ||
        !investmentSchwabHasMoney_(row.marketValue)) {
      excluded.push({
        symbol: row.ticker,
        ticker: row.ticker,
        description: row.description,
        quantity: row.quantity,
        price: row.price,
        marketValue: row.marketValue,
        reason: 'MALFORMED_EQUITY_ROW'
      });
      continue;
    }
    holdings.push({
      symbol: row.ticker,
      ticker: row.ticker,
      description: row.description,
      quantity: row.quantity,
      price: row.price,
      marketValue: row.marketValue,
      providerCostBasis: investmentSchwabHasMoney_(row.providerCostBasis)
        ? row.providerCostBasis : null,
      unrealizedGainLoss: investmentSchwabHasMoney_(row.unrealizedGainLoss)
        ? row.unrealizedGainLoss : null
    });
  }
  return { holdings: holdings, excluded: excluded };
}

function investmentSchwabBuildReconciliation_(preamble, holdings) {
  preamble = preamble || {};
  holdings = holdings || [];
  var tolerance = SCHWAB_BROKERAGE_STATEMENT_RECONCILIATION_TOLERANCE_USD_;
  var holdingsSum = holdings.reduce(function(sum, row) {
    return sum + (investmentSchwabHasMoney_(row.marketValue) ? row.marketValue : 0);
  }, 0);
  var cash = investmentSchwabHasMoney_(preamble.cashBalance) ? preamble.cashBalance : 0;
  var computedTotal = Math.round((holdingsSum + cash) * 100) / 100;
  var statementTotal = investmentSchwabHasMoney_(preamble.accountValue)
    ? preamble.accountValue : NaN;
  var difference = isFinite(statementTotal)
    ? Math.round((statementTotal - computedTotal) * 100) / 100 : NaN;
  var ok = false;
  var blockingReason = '';
  if (!isFinite(statementTotal)) {
    blockingReason = 'MISSING_STATEMENT_TOTAL';
  } else if (Math.abs(difference) <= tolerance) {
    ok = true;
  } else {
    blockingReason = 'UNMODELED_STATEMENT_BALANCE';
  }
  return {
    ok: ok,
    rule: 'ABSOLUTE_USD_' + tolerance.toFixed(2),
    computedBase: computedTotal,
    computedTotal: computedTotal,
    endingTotalValue: isFinite(statementTotal) ? statementTotal : null,
    holdingsMarketValueSum: Math.round(holdingsSum * 100) / 100,
    cashBalance: investmentSchwabHasMoney_(preamble.cashBalance) ? cash : null,
    accruedInterest: null,
    excludedBalances: [],
    explainedAdjustments: 0,
    grossDifference: isFinite(difference) ? difference : null,
    difference: isFinite(difference) ? difference : null,
    unexplainedDifference: ok ? 0 : (isFinite(difference) ? difference : null),
    tolerance: tolerance,
    blockingReason: ok ? '' : blockingReason
  };
}

function investmentSchwabParseBrokerageStatementPdfText_(rawText) {
  var prepared = investmentSchwabNormalizeStatementText_(rawText);
  if (!prepared.trim()) {
    return { ok: false, error: 'Schwab brokerage statement PDF text is empty.' };
  }
  var compact = investmentSchwabCompactStatementText_(prepared);
  if (typeof investmentStashLooksLikeBrokerageStatementPdf_ === 'function' &&
      investmentStashLooksLikeBrokerageStatementPdf_(prepared)) {
    return {
      ok: false,
      error: 'Document matches a Stash brokerage statement, not a Schwab brokerage statement.'
    };
  }
  if (investmentSchwabLooksLikeM1Statement_(compact)) {
    return { ok: false, error: 'Document matches an M1 brokerage statement, not a Schwab brokerage statement.' };
  }
  if (investmentSchwabLooksLikeEtradeClientStatement_(compact)) {
    return {
      ok: false,
      error: 'Document matches an E*TRADE client statement, not a Schwab brokerage statement.'
    };
  }
  if (!investmentSchwabLooksLikeBrokerageStatementPdf_(prepared)) {
    return {
      ok: false,
      error: 'Missing Charles Schwab / Schwab One branding or Positions - Equities section.'
    };
  }
  var lines = prepared.split('\n');
  var preamble = investmentSchwabParsePreamble_(prepared);
  var parsed = investmentSchwabHasPipeHoldingsLayout_(prepared)
    ? investmentSchwabParseHoldingsSections_(lines)
    : investmentSchwabParseSpaceJoinedHoldings_(prepared);
  var reconciliation = investmentSchwabBuildReconciliation_(preamble, parsed.holdings);
  return {
    ok: true,
    preamble: preamble,
    holdings: parsed.holdings,
    excluded: parsed.excluded,
    reconciliation: reconciliation
  };
}

function investmentSchwabExtractStatementContent_(input) {
  input = input || {};
  if (input.rawStatementText) return String(input.rawStatementText);
  var files = input.files || [];
  var statementFile = files.filter(function(file) {
    return String(file.role || '').toUpperCase() === 'HOLDINGS' ||
      String(file.role || '').toUpperCase() === 'ACCOUNT_SNAPSHOT';
  })[0];
  return String(statementFile && statementFile.content || '');
}

function investmentSchwabBuildStatementFileFingerprint_(rawText) {
  return investmentPortfolioDigest_([String(rawText || '')]);
}

function investmentSchwabDetectBrokerageStatementPdf_(input) {
  input = input || {};
  var rawText = investmentSchwabExtractStatementContent_(input);
  if (!rawText.trim()) {
    return { ok: false, reason: 'No Schwab brokerage statement PDF text supplied.' };
  }
  var compact = investmentSchwabCompactStatementText_(rawText);
  if (typeof investmentStashLooksLikeBrokerageStatementPdf_ === 'function' &&
      investmentStashLooksLikeBrokerageStatementPdf_(rawText)) {
    return {
      ok: false,
      reason: 'Document matches a Stash brokerage statement, not a Schwab brokerage statement.'
    };
  }
  if (investmentSchwabLooksLikeM1Statement_(compact)) {
    return {
      ok: false,
      reason: 'Document matches an M1 brokerage statement, not a Schwab brokerage statement.'
    };
  }
  if (investmentSchwabLooksLikeEtradeClientStatement_(compact)) {
    return {
      ok: false,
      reason: 'Document matches an E*TRADE client statement, not a Schwab brokerage statement.'
    };
  }
  if (!investmentSchwabLooksLikeBrokerageStatementPdf_(rawText)) {
    return {
      ok: false,
      reason: 'File does not match a Schwab brokerage statement Positions - Equities layout.'
    };
  }
  return {
    ok: true,
    source: 'SCHWAB_BROKERAGE_STATEMENT_PDF',
    inferredRoles: ['HOLDINGS', 'ACCOUNT_SNAPSHOT']
  };
}

function investmentSchwabResolveAccountMatch_(input) {
  input = input || {};
  var accountMeta = input.accountMeta || {};
  var stableAccountId = String(accountMeta.stableAccountId || '').trim();
  var explicitMatch = input.explicitAccountMatch === true || accountMeta.explicitAccountMatch === true;
  var registrationType = investmentPortfolioNormalizeRegistrationType_(
    accountMeta.registrationType || '');
  var active = accountMeta.active !== false;

  if (!stableAccountId) {
    return {
      ok: false,
      stableAccountId: '',
      sourceAccountKey: '',
      matchStatus: 'NO_MATCH',
      error: 'stableAccountId is required for Schwab brokerage statement preview.'
    };
  }
  if (!explicitMatch) {
    return {
      ok: false,
      stableAccountId: stableAccountId,
      sourceAccountKey: '',
      matchStatus: 'REVIEW_REQUIRED',
      error: 'explicitAccountMatch is required for Schwab brokerage statement preview.'
    };
  }
  if (!registrationType) {
    return {
      ok: false,
      stableAccountId: stableAccountId,
      sourceAccountKey: '',
      matchStatus: 'REVIEW_REQUIRED',
      error: 'registrationType is required for Schwab brokerage statement preview.'
    };
  }
  if (!active) {
    return {
      ok: false,
      stableAccountId: stableAccountId,
      sourceAccountKey: stableAccountId,
      matchStatus: 'AMBIGUOUS',
      error: 'Inactive account cannot be associated with Schwab brokerage statement preview.'
    };
  }
  return {
    ok: true,
    stableAccountId: stableAccountId,
    sourceAccountKey: stableAccountId,
    matchStatus: 'EXPLICIT_MATCH',
    accountName: String(accountMeta.accountName || '').trim(),
    registrationType: registrationType,
    reviewRequired: false
  };
}

function investmentSchwabBuildSourceSecurityKey_(symbol) {
  return 'SCHWAB|' + String(symbol || '').trim().toUpperCase() + '|STATEMENT';
}

function investmentSchwabBuildUnifiedHoldingsPreview_(input, parseResult, accountMatch) {
  input = input || {};
  parseResult = parseResult || {};
  accountMatch = accountMatch || {};
  var accountMeta = input.accountMeta || {};
  var preamble = parseResult.preamble || {};
  var sourceAsOf = investmentSchwabNormalizeAsOf_(preamble.statementPeriodEnd);
  var registrationType = accountMatch.registrationType ||
    investmentPortfolioNormalizeRegistrationType_(accountMeta.registrationType || 'TAXABLE');
  var taxStatus = investmentPortfolioResolveTaxStatus_(registrationType);
  var fingerprint = investmentSchwabBuildStatementFileFingerprint_(
    investmentSchwabExtractStatementContent_(input));
  var stableAccountId = String(accountMatch.stableAccountId || '').trim();
  var matchStatus = String(accountMatch.matchStatus || 'REVIEW_REQUIRED').toUpperCase();
  var confidence = matchStatus === 'EXPLICIT_MATCH' ? 'HIGH' : 'LOW';
  var unpricedRows = (parseResult.excluded || []).filter(function(row) {
    return String(row.reason || '') === 'UNPRICED_SECURITY';
  });

  var preview = investmentPortfolioBuildEmptyHoldingsPreview_({
    source: 'SCHWAB_BROKERAGE_STATEMENT_PDF',
    parserVersion: SCHWAB_BROKERAGE_STATEMENT_PDF_PARSER_VERSION_,
    asOf: sourceAsOf,
    observedAt: String(input.observedAt || '')
  });
  preview.source = 'SCHWAB_BROKERAGE_STATEMENT_PDF';
  preview.parserVersion = SCHWAB_BROKERAGE_STATEMENT_PDF_PARSER_VERSION_;
  preview.sourceFiles = [{
    role: 'HOLDINGS',
    fileName: String(input.fileName || 'schwab-brokerage-statement.pdf').trim() ||
      'schwab-brokerage-statement.pdf',
    sourceFileFingerprint: fingerprint,
    sourceAsOf: sourceAsOf,
    parserVersion: SCHWAB_BROKERAGE_STATEMENT_PDF_PARSER_VERSION_
  }];
  preview.capabilities = {
    activities: false,
    holdings: (parseResult.holdings || []).length > 0,
    taxLots: false,
    accountSnapshot: !!(preamble.accountValue || preamble.cashBalance !== null),
    dividendHistory: false,
    realizedGainLoss: false
  };
  preview.accounts = [{
    investmentId: String(input.investmentId || accountMeta.investmentId || ''),
    stableAccountId: stableAccountId,
    institution: 'Charles Schwab',
    displayName: String(accountMatch.accountName || accountMeta.accountName || '').trim(),
    accountType: String(accountMeta.accountType || 'Brokerage').trim(),
    registrationType: registrationType,
    domain: investmentPortfolioResolveDomainForRegistration_(registrationType),
    taxStatus: taxStatus,
    portfolioRoles: investmentPortfolioResolvePortfolioRoles_(accountMeta),
    active: accountMeta.active !== false,
    matchStatus: matchStatus,
    sourceAccountKey: String(accountMatch.sourceAccountKey || stableAccountId).trim()
  }];

  var securitiesById = {};
  var securities = [];
  var holdings = [];
  (parseResult.holdings || []).forEach(function(row) {
    var sourceSecurityKey = investmentSchwabBuildSourceSecurityKey_(row.symbol);
    var stableSecurityId = investmentPortfolioHashOpaqueKey_('SEC', sourceSecurityKey);
    if (!securitiesById[stableSecurityId]) {
      securitiesById[stableSecurityId] = {
        stableSecurityId: stableSecurityId,
        ticker: row.symbol,
        securityName: String(row.description || '').trim(),
        securityType: 'EQUITY',
        assetClass: 'US_EQUITY',
        primarySource: 'SCHWAB_BROKERAGE_STATEMENT_PDF',
        sourceSecurityKey: sourceSecurityKey
      };
      securities.push(securitiesById[stableSecurityId]);
    }
    var holding = {
      stableAccountId: stableAccountId,
      stableSecurityId: stableSecurityId,
      ticker: row.symbol,
      shares: row.quantity,
      price: row.price,
      priceAsOf: sourceAsOf,
      marketValue: row.marketValue,
      providerCostBasis: row.providerCostBasis,
      costBasisQuality: row.providerCostBasis !== null ? 'PROVIDER_AGGREGATE' : 'UNKNOWN',
      unrealizedGainLoss: row.unrealizedGainLoss,
      authority: 'PROVIDER_REPORTED',
      source: 'SCHWAB_BROKERAGE_STATEMENT_PDF',
      sourceSnapshotKey: fingerprint,
      sourceAsOf: sourceAsOf,
      sourceFileFingerprint: fingerprint,
      dataQuality: 'PROVIDER_REPORTED',
      freshness: sourceAsOf ? 'CURRENT' : 'UNKNOWN',
      confidence: confidence,
      reviewRequired: false
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
    holdings.push(holding);
  });
  preview.securities = securities;
  preview.holdings = holdings.filter(function(row, index, rows) {
    return rows.findIndex(function(other) {
      return other.stableSecurityId === row.stableSecurityId &&
        other.stableAccountId === row.stableAccountId;
    }) === index;
  });
  preview.taxLots = [];
  preview.realizedGainLoss = [];
  preview.distributions = [];
  preview.activities = [];
  if (preamble.accountValue || preamble.cashBalance !== null) {
    preview.accountSnapshots = [{
      stableAccountId: stableAccountId,
      snapshotType: 'CASH',
      marketValue: preamble.accountValue,
      cashBalance: investmentSchwabHasMoney_(preamble.cashBalance) ? preamble.cashBalance : null,
      asOf: sourceAsOf,
      authority: 'PROVIDER_REPORTED',
      sourceSnapshotKey: fingerprint,
      sourceAsOf: sourceAsOf,
      source: 'SCHWAB_BROKERAGE_STATEMENT_PDF'
    }];
  }
  preview.warnings = [];
  if (unpricedRows.length) {
    preview.warnings.push(
      'Unpriced securities are excluded from Apply. Priced holdings only are proposed when statement totals reconcile.');
  }
  if (!parseResult.reconciliation || parseResult.reconciliation.ok !== true) {
    var recon = parseResult.reconciliation || {};
    if (recon.blockingReason === 'MISSING_STATEMENT_TOTAL') {
      preview.warnings.push(
        'Statement market-value total was not found. Holdings preview is not trusted for Apply.');
    } else {
      preview.warnings.push(
        'Priced holdings plus cash do not reconcile to the statement market-value total within $' +
        SCHWAB_BROKERAGE_STATEMENT_RECONCILIATION_TOLERANCE_USD_.toFixed(2) + ' absolute tolerance.');
    }
  }
  if (preamble.maskedAccountNumber) {
    preview.warnings.push(
      'Masked statement account number is informational only and is not durable account identity.');
  }
  preview.unsupportedRows = parseResult.excluded || [];
  preview.statementParseMeta = {
    extraction: input.extractionMeta || null,
    reconciliation: parseResult.reconciliation || null,
    accountKind: 'BROKERAGE',
    endingTotalValue: preamble.accountValue,
    asOfDate: sourceAsOf,
    cashBalance: preamble.cashBalance,
    documentFingerprint: fingerprint,
    holdingsRowsParsed: (parseResult.holdings || []).length,
    excludedRows: (parseResult.excluded || []).length,
    unpricedRows: unpricedRows.length
  };
  preview.importSummary = investmentPortfolioBuildImportPreviewSummary_({
    source: 'SCHWAB_BROKERAGE_STATEMENT_PDF',
    parserVersion: SCHWAB_BROKERAGE_STATEMENT_PDF_PARSER_VERSION_,
    reportedHoldings: preview.holdings.length,
    providerLots: 0,
    excludedActivities: preview.unsupportedRows.length,
    account: preview.accounts[0] && preview.accounts[0].displayName,
    warnings: preview.warnings,
    capabilities: preview.capabilities
  });
  preview.recommendationReadiness = investmentPortfolioEvaluateRecommendationReadiness_(preview);
  if (!parseResult.reconciliation || parseResult.reconciliation.ok !== true) {
    preview.recommendationReadiness.trustedForHoldingsVisibility = false;
    preview.recommendationReadiness.trustedForIncomeAnalysis = false;
    preview.recommendationReadiness.trustedForTaxLotSalePlanning = false;
    if (preview.recommendationReadiness.blockingReasons.indexOf('RECONCILIATION_FAILED') < 0) {
      preview.recommendationReadiness.blockingReasons.push('RECONCILIATION_FAILED');
    }
  }
  preview.recommendationReadiness.trustedForIncomeAnalysis = false;
  preview.recommendationReadiness.trustedForTaxLotSalePlanning = false;
  return preview;
}

function investmentSchwabPreviewBrokerageStatementPdfUnified_(input) {
  input = input || {};
  var source = investmentPortfolioNormalizeSource_(input.source) ||
    'SCHWAB_BROKERAGE_STATEMENT_PDF';
  var rawText = investmentSchwabExtractStatementContent_(input);
  if (!rawText.trim()) {
    return {
      ok: false,
      reviewRequired: true,
      source: source,
      error: 'Schwab brokerage statement PDF text content is required.'
    };
  }
  var accountMatch = investmentSchwabResolveAccountMatch_(input);
  if (!accountMatch.ok) {
    return {
      ok: false,
      reviewRequired: true,
      source: source,
      error: accountMatch.error,
      matchStatus: accountMatch.matchStatus
    };
  }
  var parseResult = investmentSchwabParseBrokerageStatementPdfText_(rawText);
  if (!parseResult.ok) {
    return {
      ok: false,
      reviewRequired: true,
      source: source,
      error: parseResult.error
    };
  }
  var unified = investmentSchwabBuildUnifiedHoldingsPreview_(input, parseResult, accountMatch);
  var reviewRequired = !unified.recommendationReadiness.trustedForHoldingsVisibility;
  return {
    ok: true,
    reviewRequired: reviewRequired,
    source: 'SCHWAB_BROKERAGE_STATEMENT_PDF',
    parserVersion: SCHWAB_BROKERAGE_STATEMENT_PDF_PARSER_VERSION_,
    schemaVersion: INVESTMENT_PORTFOLIO_SCHEMA_VERSION_,
    contractVersion: PORTFOLIO_INTELLIGENCE_HOLDINGS_CONTRACT_VERSION_,
    capabilities: unified.capabilities,
    normalized: unified
  };
}
