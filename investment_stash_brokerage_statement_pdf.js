/**
 * Stash monthly brokerage statement PDF — preview-only text parser.
 *
 * Parses the Apex-cleared Stash statement PORTFOLIO holdings table
 * (PDF.js space-joined extract) into PORTFOLIO_INTELLIGENCE_HOLDINGS_V1.
 * FDIC Insured Deposits is cash, not an equity. ISPXZ is never a security.
 * Transactions, dividends, tax lots, and realized gain/loss are ignored.
 * No persistence, logging of private statement content, or workbook writes.
 */

var STASH_BROKERAGE_STATEMENT_PDF_PARSER_VERSION_ = 'stash-brokerage-statement-pdf-v1';

/** Absolute reconciliation tolerance — reuse E*TRADE / Schwab client-statement rule. */
var STASH_BROKERAGE_STATEMENT_RECONCILIATION_TOLERANCE_USD_ = 2.00;

var STASH_BROKERAGE_STATEMENT_MONTHS_ = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12
};

var STASH_CASH_SWEEP_SYMBOLS_ = {
  ISPXZ: true
};

var STASH_RESERVED_TICKERS_ = {
  ACCOUNT: true,
  APEX: true,
  AUGUST: true,
  BUY: true,
  CAPITAL: true,
  CASH: true,
  CHANGE: true,
  CLEARING: true,
  CLOSING: true,
  CORPORATION: true,
  CUSIP: true,
  DEPOSITS: true,
  DESCRIPTION: true,
  EQUITIES: true,
  EST: true,
  FDIC: true,
  INCOME: true,
  INDIVIDUAL: true,
  INSURED: true,
  LAST: true,
  MARKET: true,
  NET: true,
  NUMBER: true,
  OPENING: true,
  OPTIONS: true,
  PAGE: true,
  PERIOD: true,
  PORTFOLIO: true,
  PRICE: true,
  PRICED: true,
  PROGRAM: true,
  QUANTITY: true,
  SELL: true,
  STASH: true,
  STATEMENT: true,
  SYMBOL: true,
  THE: true,
  TOTAL: true,
  TRANSACTIONS: true,
  TYPE: true,
  VALUE: true
};

function investmentStashNormalizeStatementText_(raw) {
  return String(raw || '')
    .replace(/[\uE000-\uF8FF]/g, '/')
    .replace(/\uFFFD/g, '')
    .replace(/\f/g, '\n')
    .replace(/[\u00A0\u2000-\u200B]/g, ' ')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');
}

function investmentStashCompactStatementText_(text) {
  return String(text || '')
    .replace(/\|/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Repair rotated / letter-spaced Stash section titles only.
 * Does not use the global M1 character-collapse path.
 */
function investmentStashCollapseSpacedTitles_(text) {
  var next = String(text || '');
  next = next.replace(/F\s*D\s*I\s*C\s+I\s*N\s*S\s*U\s*R\s*E\s*D\s+D\s*E\s*P\s*O\s*S\s*I\s*T\s*S/gi,
    'FDIC INSURED DEPOSITS');
  next = next.replace(/F\s*D\s*I\s*C\s*I\s*N\s*S\s*U\s*R\s*E\s*D\s*D\s*E\s*P\s*O\s*S\s*I\s*T\s*S/gi,
    'FDIC INSURED DEPOSITS');
  next = next.replace(/E\s*Q\s*U\s*I\s*T\s*I\s*E\s*S\s*\/\s*O\s*P\s*T\s*I\s*O\s*N\s*S/gi,
    'EQUITIES / OPTIONS');
  next = next.replace(/B\s*U\s*Y\s*\/\s*S\s*E\s*L\s*L\s+T\s*R\s*A\s*N\s*S\s*A\s*C\s*T\s*I\s*O\s*N\s*S/gi,
    'BUY / SELL TRANSACTIONS');
  next = next.replace(/B\s*U\s*Y\s*\/\s*S\s*E\s*L\s*L\s*T\s*R\s*A\s*N\s*S\s*A\s*C\s*T\s*I\s*O\s*N\s*S/gi,
    'BUY / SELL TRANSACTIONS');
  next = next.replace(/I\s*N\s*D\s*I\s*V\s*I\s*D\s*U\s*A\s*L\s+A\s*C\s*C\s*O\s*U\s*N\s*T/gi,
    'INDIVIDUAL ACCOUNT');
  next = next.replace(/P\s*O\s*R\s*T\s*F\s*O\s*L\s*I\s*O\s+S\s*U\s*M\s*M\s*A\s*R\s*Y/gi,
    'PORTFOLIO SUMMARY');
  return next;
}

function investmentStashPrepareStatementText_(raw) {
  return investmentStashCollapseSpacedTitles_(investmentStashNormalizeStatementText_(raw));
}

function investmentStashHasStashBranding_(compact) {
  compact = String(compact || '');
  return /STASH\s+CAPITAL|\bStash\b/i.test(compact);
}

function investmentStashHasPositionsMarkers_(compact) {
  compact = String(compact || '');
  var pricedPortfolio = /TOTAL\s+PRICED\s+PORTFOLIO/i.test(compact);
  var equitiesTotal = /Total\s+Equities/i.test(compact);
  var holdingsHeader = /SYMBOL\s*\/?\s*CUSIP/i.test(compact) &&
    /QUANTITY/i.test(compact) &&
    /PRICE/i.test(compact) &&
    /MARKET\s+VALUE/i.test(compact);
  return pricedPortfolio && (equitiesTotal || holdingsHeader);
}

function investmentStashLooksLikeBrokerageStatementPdf_(text) {
  var prepared = investmentStashPrepareStatementText_(text);
  var compact = investmentStashCompactStatementText_(prepared);
  if (!compact) return false;
  return investmentStashHasStashBranding_(compact) && investmentStashHasPositionsMarkers_(compact);
}

function investmentStashLooksLikeM1Statement_(compact) {
  compact = String(compact || '');
  return /M1:|Finance Super App|Total account value \/ 1-month change/i.test(compact) ||
    (/Statement period:/i.test(compact) &&
      (/Account breakdown/i.test(compact) ||
        /Symbol Quantity Price Market value/i.test(compact)));
}

function investmentStashLooksLikeSchwabStatement_(compact) {
  compact = String(compact || '');
  return /Charles\s+Schwab|Schwab\s+One|Schwab\s+Brokerage/i.test(compact) &&
    /Positions\s*[-–]\s*Equities/i.test(compact);
}

function investmentStashLooksLikeEtradeClientStatement_(compact) {
  compact = String(compact || '');
  return /Security\s+Description\s+Quantity\s+Share\s+Price/i.test(compact) &&
    /Ending\s+Total\s+Value/i.test(compact);
}

function investmentStashHasMoney_(value) {
  return value !== null && typeof value !== 'undefined' && value !== '' && isFinite(value);
}

function investmentStashParseOptionalMoney_(value) {
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

function investmentStashParseOptionalQuantity_(value) {
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

function investmentStashParseOptionalPrice_(value) {
  var text = String(value == null ? '' : value).trim();
  if (!text) return null;
  if (/^(n\/?a|na|—|–|--|-)$/i.test(text)) return null;
  var numeric = Number(text.replace(/[$,\s]/g, ''));
  return isFinite(numeric) ? numeric : null;
}

function investmentStashIsTicker_(value) {
  var ticker = String(value || '').trim().toUpperCase();
  if (!/^[A-Z][A-Z0-9.]{1,9}$/.test(ticker)) return false;
  if (STASH_RESERVED_TICKERS_[ticker]) return false;
  if (STASH_CASH_SWEEP_SYMBOLS_[ticker]) return false;
  return true;
}

function investmentStashParseNamedDate_(text) {
  var raw = String(text || '').trim();
  if (!raw) return '';
  var named = raw.match(/([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})/);
  if (!named) return '';
  var month = STASH_BROKERAGE_STATEMENT_MONTHS_[String(named[1] || '').toLowerCase()];
  if (!month) return '';
  return ('0' + month).slice(-2) + '/' + ('0' + named[2]).slice(-2) + '/' + named[3];
}

function investmentStashParseStatementPeriodEnd_(text) {
  var compact = investmentStashCompactStatementText_(text);
  var range = compact.match(
    /([A-Za-z]+)\s+\d{1,2},?\s+\d{4}\s*[-–]\s*([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})/
  );
  if (range) {
    return investmentStashParseNamedDate_(range[2] + ' ' + range[3] + ', ' + range[4]);
  }
  var through = compact.match(
    /(?:to|through|–|-)\s*([A-Za-z]+\s+\d{1,2},?\s*\d{4}|\d{1,2}\/\d{1,2}\/\d{4})/i
  );
  if (through) {
    var endRaw = String(through[1] || '').trim();
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(endRaw)) return endRaw;
    return investmentStashParseNamedDate_(endRaw);
  }
  return '';
}

function investmentStashNormalizeAsOf_(periodEndRaw) {
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

function investmentStashParseTotalPricedPortfolio_(compact) {
  compact = String(compact || '');
  var last = null;
  var dollarRe = /TOTAL\s+PRICED\s+PORTFOLIO\s+(\$[\d,]+\.\d{2})/ig;
  var match;
  while ((match = dollarRe.exec(compact))) {
    last = investmentStashParseOptionalMoney_(match[1]);
  }
  if (investmentStashHasMoney_(last)) return last;
  var pairRe = /TOTAL\s+PRICED\s+PORTFOLIO\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})/ig;
  while ((match = pairRe.exec(compact))) {
    last = investmentStashParseOptionalMoney_(match[2]);
  }
  if (investmentStashHasMoney_(last)) return last;
  var singleRe = /TOTAL\s+PRICED\s+PORTFOLIO\s+([\d,]+\.\d{2})/ig;
  while ((match = singleRe.exec(compact))) {
    last = investmentStashParseOptionalMoney_(match[1]);
  }
  return investmentStashHasMoney_(last) ? last : null;
}

function investmentStashParseFdicCashBalance_(compact) {
  compact = String(compact || '');
  var labeledTotal = compact.match(/Total\s+FDIC\s+Insured\s+Deposits\s+(\$[\d,]+\.\d{2})/i);
  if (labeledTotal) return investmentStashParseOptionalMoney_(labeledTotal[1]);
  var closingPair = compact.match(
    /FDIC\s+Insured\s+Deposits\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})/i
  );
  if (closingPair) return investmentStashParseOptionalMoney_(closingPair[2]);
  var labeled = compact.match(/FDIC\s+Insured\s+Deposits\s+(\$[\d,]+\.\d{2})/i);
  if (labeled) return investmentStashParseOptionalMoney_(labeled[1]);
  return null;
}

function investmentStashParseInformationalAccountNumber_(compact) {
  compact = String(compact || '');
  var match = compact.match(/ACCOUNT\s+NUMBER\s+([A-Z0-9*][-A-Z0-9* ]{3,})/i);
  if (!match) return '';
  return String(match[1] || '').replace(/\s+RR\b.*$/i, '').trim();
}

function investmentStashParsePreamble_(preparedText) {
  var compact = investmentStashCompactStatementText_(preparedText);
  return {
    statementPeriodEnd: investmentStashParseStatementPeriodEnd_(preparedText),
    accountValue: investmentStashParseTotalPricedPortfolio_(compact),
    cashBalance: investmentStashParseFdicCashBalance_(compact),
    informationalAccountNumber: investmentStashParseInformationalAccountNumber_(compact),
    accountLabel: ''
  };
}

function investmentStashSliceHoldingsRegion_(text) {
  var src = String(text || '');
  var start = src.search(/SYMBOL\s*\/?\s*CUSIP|FDIC\s+INSURED\s+DEPOSITS|EQUITIES\s*\/\s*OPTIONS/i);
  if (start < 0) start = 0;
  var rest = src.slice(start);
  var end = rest.search(/BUY\s*\/\s*SELL\s+TRANSACTIONS|BOUGHT\s+\d{2}\/\d{2}\/\d{4}|ANNOUNCEMENTS\b/i);
  return end < 0 ? rest : rest.slice(0, end);
}

function investmentStashIssuerBeforeTicker_(body, tickerIndex) {
  var before = String(body || '').slice(Math.max(0, tickerIndex - 80), tickerIndex).trim();
  var tokens = before.split(/\s+/).filter(Boolean);
  var issuer = [];
  var i;
  for (i = tokens.length - 1; i >= 0; i -= 1) {
    var token = tokens[i];
    if (/^[\d$%<.,]+$/.test(token) || /%$/.test(token) || STASH_RESERVED_TICKERS_[token.toUpperCase()]) {
      break;
    }
    if (/^[A-Z][A-Z0-9.]{1,9}$/.test(token) && investmentStashIsTicker_(token)) {
      break;
    }
    issuer.unshift(token);
    if (issuer.length >= 6) break;
  }
  return issuer.join(' ').trim();
}

function investmentStashParseEquityRows_(region) {
  var body = String(region || '');
  var equitiesStart = body.search(/EQUITIES\s*\/\s*OPTIONS/i);
  if (equitiesStart >= 0) body = body.slice(equitiesStart);
  body = body.replace(/\s*Total\s+Equities[\s\S]*$/i, '').trim();
  var holdings = [];
  var seen = {};
  var re = new RegExp(
    '\\b([A-Z][A-Z0-9.]{1,9})\\s+[CM]\\s+' +
    '(\\d+(?:\\.\\d+)?)\\s+' +
    '(\\$?[\\d,]+(?:\\.\\d+)?)\\s+' +
    '(\\$?[\\d,]+\\.\\d{2})\\b',
    'g'
  );
  var match;
  while ((match = re.exec(body))) {
    var ticker = String(match[1] || '').trim().toUpperCase();
    if (!investmentStashIsTicker_(ticker)) continue;
    if (seen[ticker]) continue;
    var quantity = investmentStashParseOptionalQuantity_(match[2]);
    var price = investmentStashParseOptionalPrice_(match[3]);
    var marketValue = investmentStashParseOptionalMoney_(match[4]);
    if (!investmentStashHasMoney_(quantity) ||
        !investmentStashHasMoney_(price) ||
        !investmentStashHasMoney_(marketValue)) {
      continue;
    }
    seen[ticker] = true;
    holdings.push({
      symbol: ticker,
      ticker: ticker,
      description: investmentStashIssuerBeforeTicker_(body, match.index) || ticker,
      quantity: quantity,
      price: price,
      marketValue: marketValue,
      providerCostBasis: null,
      unrealizedGainLoss: null
    });
  }
  return holdings;
}

function investmentStashParseExcludedSweepRows_(region) {
  var body = String(region || '');
  var excluded = [];
  var re = /\b(ISPXZ)\s+[CM]\s+(\d+(?:\.\d+)?)\s+(\$?[\d,]+(?:\.\d+)?)\s+(\$?[\d,]+\.\d{2})\b/g;
  var match;
  while ((match = re.exec(body))) {
    excluded.push({
      symbol: 'ISPXZ',
      ticker: 'ISPXZ',
      description: 'THE INSURED DEPOSIT PROGRAM',
      quantity: investmentStashParseOptionalQuantity_(match[2]),
      price: investmentStashParseOptionalPrice_(match[3]),
      marketValue: investmentStashParseOptionalMoney_(match[4]),
      reason: 'CASH_SWEEP'
    });
  }
  return excluded;
}

function investmentStashBuildReconciliation_(preamble, holdings) {
  preamble = preamble || {};
  holdings = holdings || [];
  var tolerance = STASH_BROKERAGE_STATEMENT_RECONCILIATION_TOLERANCE_USD_;
  var holdingsSum = holdings.reduce(function(sum, row) {
    return sum + (investmentStashHasMoney_(row.marketValue) ? row.marketValue : 0);
  }, 0);
  var cash = investmentStashHasMoney_(preamble.cashBalance) ? preamble.cashBalance : 0;
  var computedTotal = Math.round((holdingsSum + cash) * 100) / 100;
  var statementTotal = investmentStashHasMoney_(preamble.accountValue)
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
    cashBalance: investmentStashHasMoney_(preamble.cashBalance) ? cash : null,
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

function investmentStashParseBrokerageStatementPdfText_(rawText) {
  var prepared = investmentStashPrepareStatementText_(rawText);
  if (!prepared.trim()) {
    return { ok: false, error: 'Stash brokerage statement PDF text is empty.' };
  }
  var compact = investmentStashCompactStatementText_(prepared);
  if (investmentStashLooksLikeM1Statement_(compact)) {
    return { ok: false, error: 'Document matches an M1 brokerage statement, not a Stash brokerage statement.' };
  }
  if (investmentStashLooksLikeSchwabStatement_(compact)) {
    return {
      ok: false,
      error: 'Document matches a Schwab brokerage statement, not a Stash brokerage statement.'
    };
  }
  if (investmentStashLooksLikeEtradeClientStatement_(compact)) {
    return {
      ok: false,
      error: 'Document matches an E*TRADE client statement, not a Stash brokerage statement.'
    };
  }
  if (!investmentStashLooksLikeBrokerageStatementPdf_(prepared)) {
    return {
      ok: false,
      error: 'Missing Stash branding or TOTAL PRICED PORTFOLIO / equities holdings markers.'
    };
  }
  var preamble = investmentStashParsePreamble_(prepared);
  var region = investmentStashSliceHoldingsRegion_(prepared);
  var holdings = investmentStashParseEquityRows_(region);
  var excluded = investmentStashParseExcludedSweepRows_(region);
  var reconciliation = investmentStashBuildReconciliation_(preamble, holdings);
  return {
    ok: true,
    preamble: preamble,
    holdings: holdings,
    excluded: excluded,
    reconciliation: reconciliation
  };
}

function investmentStashExtractStatementContent_(input) {
  input = input || {};
  if (input.rawStatementText) return String(input.rawStatementText);
  var files = input.files || [];
  var statementFile = files.filter(function(file) {
    return String(file.role || '').toUpperCase() === 'HOLDINGS' ||
      String(file.role || '').toUpperCase() === 'ACCOUNT_SNAPSHOT';
  })[0];
  return String(statementFile && statementFile.content || '');
}

function investmentStashBuildStatementFileFingerprint_(rawText) {
  return investmentPortfolioDigest_([String(rawText || '')]);
}

function investmentStashDetectBrokerageStatementPdf_(input) {
  input = input || {};
  var rawText = investmentStashExtractStatementContent_(input);
  if (!rawText.trim()) {
    return { ok: false, reason: 'No Stash brokerage statement PDF text supplied.' };
  }
  var prepared = investmentStashPrepareStatementText_(rawText);
  var compact = investmentStashCompactStatementText_(prepared);
  if (investmentStashLooksLikeM1Statement_(compact)) {
    return {
      ok: false,
      reason: 'Document matches an M1 brokerage statement, not a Stash brokerage statement.'
    };
  }
  if (investmentStashLooksLikeSchwabStatement_(compact)) {
    return {
      ok: false,
      reason: 'Document matches a Schwab brokerage statement, not a Stash brokerage statement.'
    };
  }
  if (investmentStashLooksLikeEtradeClientStatement_(compact)) {
    return {
      ok: false,
      reason: 'Document matches an E*TRADE client statement, not a Stash brokerage statement.'
    };
  }
  if (!investmentStashLooksLikeBrokerageStatementPdf_(rawText)) {
    return {
      ok: false,
      reason: 'File does not match a Stash-branded brokerage statement holdings layout.'
    };
  }
  return {
    ok: true,
    source: 'STASH_BROKERAGE_STATEMENT_PDF',
    inferredRoles: ['HOLDINGS', 'ACCOUNT_SNAPSHOT']
  };
}

function investmentStashResolveAccountMatch_(input) {
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
      error: 'stableAccountId is required for Stash brokerage statement preview.'
    };
  }
  if (!explicitMatch) {
    return {
      ok: false,
      stableAccountId: stableAccountId,
      sourceAccountKey: '',
      matchStatus: 'REVIEW_REQUIRED',
      error: 'explicitAccountMatch is required for Stash brokerage statement preview.'
    };
  }
  if (!registrationType) {
    return {
      ok: false,
      stableAccountId: stableAccountId,
      sourceAccountKey: '',
      matchStatus: 'REVIEW_REQUIRED',
      error: 'registrationType is required for Stash brokerage statement preview.'
    };
  }
  if (!active) {
    return {
      ok: false,
      stableAccountId: stableAccountId,
      sourceAccountKey: stableAccountId,
      matchStatus: 'AMBIGUOUS',
      error: 'Inactive account cannot be associated with Stash brokerage statement preview.'
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

function investmentStashBuildSourceSecurityKey_(symbol) {
  return 'STASH|' + String(symbol || '').trim().toUpperCase() + '|STATEMENT';
}

function investmentStashBuildUnifiedHoldingsPreview_(input, parseResult, accountMatch) {
  input = input || {};
  parseResult = parseResult || {};
  accountMatch = accountMatch || {};
  var accountMeta = input.accountMeta || {};
  var preamble = parseResult.preamble || {};
  var sourceAsOf = investmentStashNormalizeAsOf_(preamble.statementPeriodEnd);
  var registrationType = accountMatch.registrationType ||
    investmentPortfolioNormalizeRegistrationType_(accountMeta.registrationType || 'TAXABLE');
  var taxStatus = investmentPortfolioResolveTaxStatus_(registrationType);
  var fingerprint = investmentStashBuildStatementFileFingerprint_(
    investmentStashExtractStatementContent_(input));
  var stableAccountId = String(accountMatch.stableAccountId || '').trim();
  var matchStatus = String(accountMatch.matchStatus || 'REVIEW_REQUIRED').toUpperCase();
  var confidence = matchStatus === 'EXPLICIT_MATCH' ? 'HIGH' : 'LOW';
  var sweepRows = (parseResult.excluded || []).filter(function(row) {
    return String(row.reason || '') === 'CASH_SWEEP';
  });

  var preview = investmentPortfolioBuildEmptyHoldingsPreview_({
    source: 'STASH_BROKERAGE_STATEMENT_PDF',
    parserVersion: STASH_BROKERAGE_STATEMENT_PDF_PARSER_VERSION_,
    asOf: sourceAsOf,
    observedAt: String(input.observedAt || '')
  });
  preview.source = 'STASH_BROKERAGE_STATEMENT_PDF';
  preview.parserVersion = STASH_BROKERAGE_STATEMENT_PDF_PARSER_VERSION_;
  preview.sourceFiles = [{
    role: 'HOLDINGS',
    fileName: String(input.fileName || 'stash-brokerage-statement.pdf').trim() ||
      'stash-brokerage-statement.pdf',
    sourceFileFingerprint: fingerprint,
    sourceAsOf: sourceAsOf,
    parserVersion: STASH_BROKERAGE_STATEMENT_PDF_PARSER_VERSION_
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
    institution: 'Stash',
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
    var sourceSecurityKey = investmentStashBuildSourceSecurityKey_(row.symbol);
    var stableSecurityId = investmentPortfolioHashOpaqueKey_('SEC', sourceSecurityKey);
    if (!securitiesById[stableSecurityId]) {
      securitiesById[stableSecurityId] = {
        stableSecurityId: stableSecurityId,
        ticker: row.symbol,
        securityName: String(row.description || '').trim(),
        securityType: 'EQUITY',
        assetClass: 'US_EQUITY',
        primarySource: 'STASH_BROKERAGE_STATEMENT_PDF',
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
      providerCostBasis: null,
      costBasisQuality: 'UNKNOWN',
      unrealizedGainLoss: null,
      authority: 'PROVIDER_REPORTED',
      source: 'STASH_BROKERAGE_STATEMENT_PDF',
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
      cashBalance: investmentStashHasMoney_(preamble.cashBalance) ? preamble.cashBalance : null,
      asOf: sourceAsOf,
      authority: 'PROVIDER_REPORTED',
      sourceSnapshotKey: fingerprint,
      sourceAsOf: sourceAsOf,
      source: 'STASH_BROKERAGE_STATEMENT_PDF'
    }];
  }
  preview.warnings = [];
  if (sweepRows.length) {
    preview.warnings.push(
      'FDIC insured deposit sweep symbols are cash, not priced equities, and are excluded from holdings.');
  }
  if (!parseResult.reconciliation || parseResult.reconciliation.ok !== true) {
    var recon = parseResult.reconciliation || {};
    if (recon.blockingReason === 'MISSING_STATEMENT_TOTAL') {
      preview.warnings.push(
        'Statement market-value total was not found. Holdings preview is not trusted for Apply.');
    } else {
      preview.warnings.push(
        'Priced holdings plus cash do not reconcile to the statement market-value total within $' +
        STASH_BROKERAGE_STATEMENT_RECONCILIATION_TOLERANCE_USD_.toFixed(2) + ' absolute tolerance.');
    }
  }
  if (preamble.informationalAccountNumber) {
    preview.warnings.push(
      'Statement account number is informational only and is not durable account identity.');
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
    cashSweepRows: sweepRows.length
  };
  preview.importSummary = investmentPortfolioBuildImportPreviewSummary_({
    source: 'STASH_BROKERAGE_STATEMENT_PDF',
    parserVersion: STASH_BROKERAGE_STATEMENT_PDF_PARSER_VERSION_,
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

function investmentStashPreviewBrokerageStatementPdfUnified_(input) {
  input = input || {};
  var source = investmentPortfolioNormalizeSource_(input.source) ||
    'STASH_BROKERAGE_STATEMENT_PDF';
  var rawText = investmentStashExtractStatementContent_(input);
  if (!rawText.trim()) {
    return {
      ok: false,
      reviewRequired: true,
      source: source,
      error: 'Stash brokerage statement PDF text content is required.'
    };
  }
  var accountMatch = investmentStashResolveAccountMatch_(input);
  if (!accountMatch.ok) {
    return {
      ok: false,
      reviewRequired: true,
      source: source,
      error: accountMatch.error,
      matchStatus: accountMatch.matchStatus
    };
  }
  var parseResult = investmentStashParseBrokerageStatementPdfText_(rawText);
  if (!parseResult.ok) {
    return {
      ok: false,
      reviewRequired: true,
      source: source,
      error: parseResult.error
    };
  }
  var unified = investmentStashBuildUnifiedHoldingsPreview_(input, parseResult, accountMatch);
  var reviewRequired = !unified.recommendationReadiness.trustedForHoldingsVisibility;
  return {
    ok: true,
    reviewRequired: reviewRequired,
    source: 'STASH_BROKERAGE_STATEMENT_PDF',
    parserVersion: STASH_BROKERAGE_STATEMENT_PDF_PARSER_VERSION_,
    schemaVersion: INVESTMENT_PORTFOLIO_SCHEMA_VERSION_,
    contractVersion: PORTFOLIO_INTELLIGENCE_HOLDINGS_CONTRACT_VERSION_,
    capabilities: unified.capabilities,
    normalized: unified
  };
}
