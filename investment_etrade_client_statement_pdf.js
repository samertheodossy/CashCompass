/**
 * E*TRADE monthly Client Statement PDF — preview-only text parser.
 *
 * Parses PDF/OCR text extracts into PORTFOLIO_INTELLIGENCE_HOLDINGS_V1 previews.
 * No persistence, logging of private statement content, or workbook writes.
 */

var ETRADE_CLIENT_STATEMENT_PDF_PARSER_VERSION_ = 'etrade-client-statement-pdf-v1';

/** Absolute reconciliation tolerance — no percentage scaling with account size. */
var ETRADE_CLIENT_STATEMENT_RECONCILIATION_TOLERANCE_USD_ = 2.00;

var ETRADE_CLIENT_STATEMENT_HOLDINGS_COLUMNS_ = [
  'securityDescription', 'quantity', 'sharePrice', 'totalCost', 'marketValue', 'unrealizedGain'
];

var ETRADE_CLIENT_STATEMENT_SECTION_STOP_PATTERNS_ = [
  /^Potential\s+Restricted\s+Stock/i,
  /^Restricted\s+Stock/i,
  /^Unvested\s+Stock/i,
  /^Hypothetical/i,
  /^Grant\s+Detail/i,
  /^Realized\s+Gains?\b/i,
  /^Activity\s+Summary/i,
  /^Activity\s+Detail/i,
  /^Total\s+Cash,\s*Bank\s+Deposit/i,
  /^Ending\s+Total\s+Value/i,
  /^Terms\s+and\s+Conditions/i,
  /^Page\s+\d+\s+of\s+\d+/i,
  /^--\s*\d+\s+of\s+\d+\s*--/i
];

function investmentEtradeClientStatementNormalizeText_(raw) {
  return String(raw || '')
    .replace(/[\uE000-\uF8FF]/g, '/')
    .replace(/\uFFFD/g, '')
    .replace(/\f/g, '\n')
    .replace(/[\u00A0\u2000-\u200B]/g, ' ')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');
}

function investmentEtradeClientStatementCompactText_(text) {
  return String(text || '')
    .replace(/\|/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function investmentEtradeClientStatementLooksEncodingCorrupt_(text) {
  text = String(text || '');
  if (!text.trim()) return false;
  var sample = text.slice(0, 12000);
  if (!sample) return false;
  var badChars = (sample.match(/[\uFFFD\uE000-\uF8FF]/g) || []).length;
  if (badChars / sample.length > 0.02) return true;
  var letters = (sample.match(/[A-Za-z]/g) || []).length;
  if (sample.length > 2000 && letters / sample.length < 0.08) return true;
  if (sample.length > 2000 &&
      !/Security\s+Description/i.test(sample) &&
      !/Ending\s+Total/i.test(sample) &&
      !/Client\s*Statement/i.test(sample) &&
      letters / sample.length < 0.15) {
    return true;
  }
  var weirdChars = (sample.match(/[ÃÙ¶˚™ƒ¤£›ÕÇÑÄäËëÏïÖöÜüÀÂÈÊÎÔÛµ§]/g) || []).length;
  if (sample.length > 1000 && weirdChars / sample.length > 0.04 &&
      !/Security\s+Description/i.test(sample)) {
    return true;
  }
  var latinExtended = (sample.match(/[\u00C0-\u00FF]/g) || []).length;
  if (sample.length > 5000 && latinExtended / sample.length > 0.10 &&
      !/Security\s+Description/i.test(sample) &&
      !/Symbol\s*\/\s*CUSIP/i.test(sample)) {
    return true;
  }
  var noiseChars = (sample.match(/[\/\\~^|#]/g) || []).length;
  if (sample.length > 5000 && noiseChars / sample.length > 0.05 &&
      !/Security\s+Description/i.test(sample) &&
      !/Symbol\s*\/\s*CUSIP/i.test(sample)) {
    return true;
  }
  return false;
}

function investmentEtradeClientStatementAssessTextQuality_(text) {
  text = String(text || '');
  if (!text.trim()) {
    return {
      quality: 'NO_TEXT',
      usable: false,
      reason: 'No E*TRADE client statement text supplied.'
    };
  }
  if (investmentEtradeClientStatementLooksEncodingCorrupt_(text)) {
    return {
      quality: 'ENCODING_FAILURE',
      usable: false,
      reason: 'Extracted text appears encoding-corrupt; OCR or pasted text is required.'
    };
  }
  var compact = investmentEtradeClientStatementCompactText_(text);
  if (/Symbol\s*\/\s*CUSIP/i.test(compact) && /Refresh:/i.test(compact)) {
    return {
      quality: 'WRONG_DOCUMENT_TYPE',
      usable: false,
      reason: 'File matches E*TRADE Expanded Positions export, not a monthly client statement.'
    };
  }
  var hasHeader = /Security\s+Description\s+Quantity\s+Share\s+Price/i.test(compact);
  var hasEnding = /Ending\s+Total\s+Value/i.test(compact);
  var hasStatementMarker = /E\*?TRADE|Client\s*Statement|ClientStatements|Morgan\s+Stanley/i.test(compact);
  if (!hasHeader) {
    return {
      quality: 'STRUCTURE_MISMATCH',
      usable: false,
      reason: 'Missing Security Description holdings table header.'
    };
  }
  if (!hasEnding) {
    return {
      quality: 'STRUCTURE_MISMATCH',
      usable: false,
      reason: 'Missing Ending Total Value reconciliation marker.'
    };
  }
  if (!hasStatementMarker) {
    return {
      quality: 'STRUCTURE_MISMATCH',
      usable: false,
      reason: 'Missing E*TRADE client statement confirmatory markers.'
    };
  }
  return { quality: 'USABLE', usable: true, reason: '' };
}

function investmentEtradeClientStatementLooksLikePositionsPdf_(text) {
  var compact = investmentEtradeClientStatementCompactText_(text);
  return /Symbol\s*\/\s*CUSIP/i.test(compact) && /Refresh:/i.test(compact);
}

/**
 * Classify E*TRADE PDF text before parser routing.
 *
 * @param {string} text
 * @returns {{documentType: string, confidence: string, reason: string}}
 */
function investmentEtradeClientStatementClassifyDocumentType_(text) {
  text = String(text || '');
  if (!text.trim()) {
    return {
      documentType: 'UNKNOWN',
      confidence: 'LOW',
      reason: 'No PDF text extracted.'
    };
  }
  if (investmentEtradeClientStatementLooksLikePositionsPdf_(text)) {
    return {
      documentType: 'ETRADE_POSITIONS_PDF',
      confidence: 'HIGH',
      reason: 'Expanded Positions export markers detected.'
    };
  }
  var compact = investmentEtradeClientStatementCompactText_(text);
  if (/M1:|Finance Super App|Total account value \/ 1-month change/i.test(compact) ||
      (/Statement period:/i.test(compact) &&
        (/Account breakdown/i.test(compact) ||
          /Symbol Quantity Price Market value/i.test(compact)))) {
    return {
      documentType: 'UNKNOWN',
      confidence: 'LOW',
      reason: 'Document appears to be an M1 brokerage statement.'
    };
  }
  var hasClientStatementMarkers =
    /E\*?TRADE|Client\s*Statement|ClientStatements|Morgan\s+Stanley|MSSB/i.test(compact) ||
    /Ending\s+Total\s+Value/i.test(compact) ||
    /Security\s+Description\s+Quantity\s+Share\s+Price/i.test(compact);
  if (hasClientStatementMarkers) {
    return {
      documentType: 'ETRADE_CLIENT_STATEMENT_PDF',
      confidence: 'HIGH',
      reason: 'E*TRADE monthly client statement markers detected.'
    };
  }
  if (investmentEtradeClientStatementLooksEncodingCorrupt_(text) && text.length > 1000) {
    return {
      documentType: 'ETRADE_CLIENT_STATEMENT_PDF',
      confidence: 'MEDIUM',
      reason: 'Encoding-corrupt PDF text consistent with E*TRADE monthly statement subset fonts.'
    };
  }
  if (text.length > 5000 &&
      !/M1:|Finance Super App|Total account value \/ 1-month change/i.test(compact)) {
    var quality = investmentEtradeClientStatementAssessTextQuality_(text);
    if (!quality.usable && quality.quality !== 'WRONG_DOCUMENT_TYPE') {
      return {
        documentType: 'ETRADE_CLIENT_STATEMENT_PDF',
        confidence: 'MEDIUM',
        reason: 'Non-positions PDF extract failed E*TRADE client-statement quality gate.'
      };
    }
  }
  return {
    documentType: 'UNKNOWN',
    confidence: 'LOW',
    reason: 'Could not classify E*TRADE PDF document type.'
  };
}

function investmentEtradeClientStatementReflowSections_(text) {
  text = String(text || '');
  if (!text) return text;
  var markers = [
    'Security Description Quantity Share Price Total Cost Market Value Unrealized Gain/Loss',
    'Security Description Quantity Share Price',
    'Total Cash, Bank Deposit Program, and Money Market Funds',
    'Ending Total Value (as of',
    'Potential Restricted Stock',
    'Restricted Stock',
    'Activity Summary',
    'Activity Detail',
    'Statement period:',
    'Account number:',
    'Account title:',
    'Stock Plan',
    'Employee Stock Purchase'
  ];
  markers.sort(function(a, b) {
    return b.length - a.length;
  });
  markers.forEach(function(marker) {
    var escaped = marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
    var re = new RegExp('(^|[^\\n])(' + escaped + ')', 'gi');
    text = text.replace(re, '$1\n$2');
  });
  text = text.replace(/\n{2,}/g, '\n');
  return text;
}

function investmentEtradeClientStatementMergeWrappedHeaderLines_(lines) {
  lines = lines || [];
  var merged = [];
  for (var i = 0; i < lines.length; i += 1) {
    var line = String(lines[i] || '').trim();
    var next = String(lines[i + 1] || '').trim();
    if (!line) continue;
    if (/Security\s+Description\s+Quantity\s+Share\s+Price/i.test(line) &&
        /^realized\s+Gain\/Loss/i.test(next)) {
      merged.push(line + next);
      i += 1;
      continue;
    }
    if (/Market\s+Value\s+Un$/i.test(line) && /^realized\s+Gain\/Loss/i.test(next)) {
      merged.push(line + next);
      i += 1;
      continue;
    }
    merged.push(line);
  }
  return merged;
}

function investmentEtradeClientStatementPrepareTextForParsing_(rawText) {
  var text = investmentEtradeClientStatementNormalizeText_(rawText);
  text = investmentEtradeClientStatementReflowSections_(text);
  var lines = text.split('\n').map(function(line) {
    return String(line || '').trim();
  }).filter(function(line) {
    if (!line) return false;
    if (/^Page\s+\d+\s+of\s+\d+/i.test(line)) return false;
    if (/^--\s*\d+\s+of\s+\d+\s*--$/i.test(line)) return false;
    return true;
  });
  lines = investmentEtradeClientStatementMergeWrappedHeaderLines_(lines);
  return lines.join('\n');
}

function investmentEtradeClientStatementExtractContent_(input) {
  input = input || {};
  if (input.rawStatementText) return String(input.rawStatementText);
  if (input.rawPositionsText) return String(input.rawPositionsText);
  var files = input.files || [];
  var statementFile = files.filter(function(file) {
    var role = String(file.role || '').toUpperCase();
    return role === 'HOLDINGS' || role === 'ACCOUNT_SNAPSHOT';
  })[0];
  return String(statementFile && statementFile.content || '');
}

function investmentEtradeClientStatementBuildTextFingerprint_(rawText) {
  var normalized = investmentEtradeClientStatementPrepareTextForParsing_(rawText);
  return investmentPortfolioDigest_(['ETRADE_CLIENT_STATEMENT_TEXT', normalized]);
}

/** @deprecated Prefer ResolveDocumentFingerprint_; kept for text-only call sites. */
function investmentEtradeClientStatementBuildFileFingerprint_(rawText) {
  return investmentEtradeClientStatementBuildTextFingerprint_(rawText);
}

function investmentEtradeClientStatementResolveDocumentFingerprint_(input) {
  input = input || {};
  var explicit = String(input.documentFingerprint || '').trim();
  if (!explicit && input.extractionMeta) {
    explicit = String(input.extractionMeta.documentFingerprint || '').trim();
  }
  if (explicit) return explicit;
  var rawText = investmentEtradeClientStatementExtractContent_(input);
  if (!rawText.trim()) return '';
  return investmentEtradeClientStatementBuildTextFingerprint_(rawText);
}

function investmentEtradeClientStatementSafeParseMoney_(text) {
  try {
    var value = parseInvestmentImportMoney_(text);
    return isFinite(value) ? value : NaN;
  } catch (e) {
    return NaN;
  }
}

function investmentEtradeClientStatementSafeParseNumber_(text) {
  try {
    var value = parseInvestmentImportNumber_(text);
    return isFinite(value) ? value : NaN;
  } catch (e) {
    return NaN;
  }
}

function investmentEtradeClientStatementHasMoney_(value) {
  return value !== null && typeof value !== 'undefined' && value !== '' && isFinite(value);
}

function investmentEtradeClientStatementTokenizeRow_(text) {
  var tokens = [];
  var pattern = /\$?\([\d,.\-]+\)|\$[\d,.\-]+|\d{1,2}\/\d{1,2}\/\d{4}|[A-Za-z][A-Za-z0-9.\-&']*|\bTotal\b|\bPurchases\b|\bReinvestments\b|[\d,]+(?:\.\d+)?/gi;
  var match;
  while ((match = pattern.exec(String(text || ''))) !== null) {
    tokens.push(match[0]);
  }
  return tokens;
}

function investmentEtradeClientStatementSplitLine_(line) {
  var text = String(line || '').trim();
  if (!text || /^#/.test(text)) return null;
  if (text.indexOf('|') >= 0) {
    return text.split('|').map(function(cell) { return String(cell || '').trim(); });
  }
  if (text.indexOf('\t') >= 0) {
    return text.split('\t').map(function(cell) { return String(cell || '').trim(); });
  }
  var spaced = text.split(/\s{2,}/).map(function(cell) { return String(cell || '').trim(); });
  if (spaced.length >= 4) return spaced;
  var tokenized = investmentEtradeClientStatementTokenizeRow_(text);
  if (tokenized.length >= 2) return tokenized;
  return [text];
}

function investmentEtradeClientStatementExtractSymbol_(text) {
  var match = String(text || '').match(/\(([A-Z][A-Z0-9.\-]{0,11})\)/);
  return match ? String(match[1] || '').trim().toUpperCase() : '';
}

function investmentEtradeClientStatementDetectAccountKind_(text) {
  var compact = investmentEtradeClientStatementCompactText_(text);
  if (/Stock\s*Plan|ESPP|Employee\s+Stock\s+Purchase/i.test(compact)) {
    return 'STOCK_PLAN';
  }
  return 'BROKERAGE';
}

function investmentEtradeClientStatementIsHoldingsHeader_(line) {
  var text = String(line || '').replace(/\|/g, ' ');
  return /Security\s+Description\s+Quantity\s+Share\s+Price/i.test(text);
}

function investmentEtradeClientStatementFindHoldingsHeaderIndex_(lines) {
  for (var i = 0; i < (lines || []).length; i++) {
    if (investmentEtradeClientStatementIsHoldingsHeader_(lines[i])) return i;
  }
  return -1;
}

function investmentEtradeClientStatementIsHoldingsHeaderContinuation_(line) {
  return /^realized\s+Gain\/Loss/i.test(String(line || '').trim());
}

function investmentEtradeClientStatementIsSectionStop_(line, accountKind) {
  var text = String(line || '').trim();
  if (!text) return false;
  if (investmentEtradeClientStatementIsHoldingsHeaderContinuation_(text)) return false;
  for (var i = 0; i < ETRADE_CLIENT_STATEMENT_SECTION_STOP_PATTERNS_.length; i++) {
    var pattern = ETRADE_CLIENT_STATEMENT_SECTION_STOP_PATTERNS_[i];
    if (pattern.test(text)) {
      if (accountKind === 'STOCK_PLAN' &&
          /^Potential\s+Restricted\s+Stock|^Restricted\s+Stock/i.test(text)) {
        return true;
      }
      if (!/^Potential\s+Restricted\s+Stock|^Restricted\s+Stock/i.test(text) ||
          accountKind === 'STOCK_PLAN') {
        return true;
      }
    }
  }
  return false;
}

function investmentEtradeClientStatementIsSummaryTotalRow_(line) {
  var text = String(line || '').trim();
  if (!/\bTotal\b/i.test(text)) return false;
  if (/^Total\s+(Cash|Equities|Portfolio|Market|Account|Income|Realized|Securities)/i.test(text)) {
    return true;
  }
  if (/Total Cash, Bank Deposit/i.test(text)) return true;
  if (/Ending Total Value/i.test(text)) return true;
  return false;
}

function investmentEtradeClientStatementIsSecurityTotalRow_(line) {
  var text = String(line || '').trim();
  if (!/\bTotal\b/i.test(text)) return false;
  if (investmentEtradeClientStatementIsSummaryTotalRow_(text)) return false;
  return /Total[\s|]+[\d,]+\.?\d*/i.test(text) || /\)\s*Total/i.test(text);
}

function investmentEtradeClientStatementIsPurchasesOrReinvestmentRow_(line) {
  return /^\s*(Purchases|Reinvestments)\b/i.test(String(line || '').trim());
}

function investmentEtradeClientStatementExtractNumericFieldsAfterTotal_(cells) {
  cells = cells || [];
  var start = -1;
  for (var i = 0; i < cells.length; i++) {
    if (/^Total$/i.test(String(cells[i] || '').trim())) {
      start = i + 1;
      break;
    }
  }
  if (start < 0) {
    var joined = cells.join(' ');
    var match = joined.match(/\bTotal\b\s+([\d,]+\.?\d*)\s+(\$[\d,().\-]+)\s+(\$[\d,().\-]+)\s+(\$[\d,().\-]+)\s+(\$[\d,().\-]+)/i);
    if (!match) return null;
    return {
      quantity: investmentEtradeClientStatementSafeParseNumber_(match[1]),
      sharePrice: investmentEtradeClientStatementSafeParseMoney_(match[2]),
      totalCost: investmentEtradeClientStatementSafeParseMoney_(match[3]),
      marketValue: investmentEtradeClientStatementSafeParseMoney_(match[4]),
      unrealizedGain: investmentEtradeClientStatementSafeParseMoney_(match[5])
    };
  }
  var nums = cells.slice(start);
  while (nums.length < 5) nums.push('');
  return {
    quantity: investmentEtradeClientStatementSafeParseNumber_(nums[0]),
    sharePrice: investmentEtradeClientStatementSafeParseMoney_(nums[1]),
    totalCost: investmentEtradeClientStatementSafeParseMoney_(nums[2]),
    marketValue: investmentEtradeClientStatementSafeParseMoney_(nums[3]),
    unrealizedGain: investmentEtradeClientStatementSafeParseMoney_(nums[4])
  };
}

function investmentEtradeClientStatementParsePreamble_(lines, fullText) {
  var preamble = {
    statementPeriodStart: '',
    statementPeriodEnd: '',
    maskedAccountNumber: '',
    accountLabel: '',
    accountTitle: '',
    accountType: '',
    cashBalance: null,
    accruedInterest: null,
    excludedBalances: [],
    endingTotalValue: null,
    asOfDate: '',
    asOfDateRaw: ''
  };
  (lines || []).forEach(function(line) {
    var text = String(line || '').trim();
    if (!text) return;
    var periodMatch = text.match(/^Statement period:\s*(\d{1,2}\/\d{1,2}\/\d{4})\s+to\s+(\d{1,2}\/\d{1,2}\/\d{4})/i);
    if (periodMatch) {
      preamble.statementPeriodStart = periodMatch[1];
      preamble.statementPeriodEnd = periodMatch[2];
      return;
    }
    var accountNumberMatch = text.match(/^Account number:\s*(\S+)/i);
    if (accountNumberMatch) {
      preamble.maskedAccountNumber = String(accountNumberMatch[1] || '').trim();
      return;
    }
    var accountTitleMatch = text.match(/^Account title:\s*(.+)$/i);
    if (accountTitleMatch) {
      preamble.accountTitle = String(accountTitleMatch[1] || '').trim();
      return;
    }
    var accountMatch = text.match(/^Account:\s*(.+)$/i);
    if (accountMatch) {
      preamble.accountLabel = String(accountMatch[1] || '').trim();
    }
    var accruedLineMatch = text.match(/^Accrued\s+Interest\b[^$]*(\$[\d,().\-]+)/i);
    if (accruedLineMatch) {
      preamble.accruedInterest = investmentEtradeClientStatementSafeParseMoney_(accruedLineMatch[1]);
      return;
    }
    var excludedLineMatch = text.match(
      /^(Excluded\s+Balance|Unsettled\s+(?:Activity|Funds)|Pending\s+(?:Activity|Transfers?))\b[^$]*(\$[\d,().\-]+)/i);
    if (excludedLineMatch) {
      var excludedAmount = investmentEtradeClientStatementSafeParseMoney_(excludedLineMatch[2]);
      if (investmentEtradeClientStatementHasMoney_(excludedAmount)) {
        preamble.excludedBalances.push({
          label: String(excludedLineMatch[1] || '').trim(),
          amount: excludedAmount
        });
      }
    }
  });
  var compact = investmentEtradeClientStatementCompactText_(fullText);
  var endingMatch = compact.match(
    /Ending\s+Total\s+Value\s*\(\s*as\s+of\s+(\d{1,2}\/\d{1,2}\/\d{4})\s*\)[^$]*(\$[\d,().\-]+)/i);
  if (endingMatch) {
    preamble.asOfDateRaw = endingMatch[1];
    try {
      preamble.asOfDate = normalizeInvestmentImportDate_(endingMatch[1], 'Statement as-of');
    } catch (e) {
      preamble.asOfDate = endingMatch[1];
    }
    preamble.endingTotalValue = investmentEtradeClientStatementSafeParseMoney_(endingMatch[2]);
  }
  var cashMatch = compact.match(
    /Total Cash, Bank Deposit Program, and Money Market Funds(?!\s+Debit)[^$]*(\$[\d,().\-]+)/i);
  if (cashMatch) {
    preamble.cashBalance = investmentEtradeClientStatementSafeParseMoney_(cashMatch[1]);
  }
  (lines || []).forEach(function(line) {
    var text = String(line || '').trim();
    if (!/Total Cash, Bank Deposit Program, and Money Market Funds/i.test(text)) return;
    if (/Debit/i.test(text)) return;
    var moneyMatch = text.match(/(\$[\d,().\-]+)\s*$/);
    if (moneyMatch && investmentEtradeClientStatementHasMoney_(
      investmentEtradeClientStatementSafeParseMoney_(moneyMatch[1]))) {
      preamble.cashBalance = investmentEtradeClientStatementSafeParseMoney_(moneyMatch[1]);
    }
  });
  return preamble;
}

function investmentEtradeClientStatementParseHoldingsSection_(lines, headerIndex, accountKind) {
  var holdings = [];
  var excluded = [];
  var currentSymbol = '';
  var currentDescription = '';
  for (var i = headerIndex + 1; i < lines.length; i++) {
    var line = String(lines[i] || '').trim();
    if (!line || /^#/.test(line)) continue;
    if (investmentEtradeClientStatementIsHoldingsHeader_(line)) continue;
    if (investmentEtradeClientStatementIsHoldingsHeaderContinuation_(line)) continue;
    if (investmentEtradeClientStatementIsSectionStop_(line, accountKind)) break;
    if ((/^Realized\b/i.test(line) || /^Activity\b/i.test(line)) &&
        !investmentEtradeClientStatementIsHoldingsHeaderContinuation_(line)) {
      excluded.push({ rowIndex: i + 1, reason: 'ACTIVITY_OR_REALIZED_SECTION', line: line });
      break;
    }
    if (investmentEtradeClientStatementIsSummaryTotalRow_(line)) {
      excluded.push({ rowIndex: i + 1, reason: 'SUMMARY_TOTAL_ROW', line: line });
      continue;
    }
    if (investmentEtradeClientStatementIsPurchasesOrReinvestmentRow_(line)) {
      excluded.push({
        rowIndex: i + 1,
        reason: 'PURCHASES_OR_REINVESTMENT_ROW',
        symbol: currentSymbol,
        line: line
      });
      continue;
    }
    var symbolInLine = investmentEtradeClientStatementExtractSymbol_(line);
    if (symbolInLine && !investmentEtradeClientStatementIsSecurityTotalRow_(line)) {
      currentSymbol = symbolInLine;
      currentDescription = line;
      continue;
    }
    if (!investmentEtradeClientStatementIsSecurityTotalRow_(line)) {
      if (/\b(Unvested|Hypothetical|Grant)\b/i.test(line)) {
        excluded.push({ rowIndex: i + 1, reason: 'STOCK_PLAN_EXCLUDED_ROW', line: line });
      }
      continue;
    }
    var cells = investmentEtradeClientStatementSplitLine_(line);
    if (!cells || !cells.length) continue;
    var symbol = symbolInLine || currentSymbol ||
      investmentEtradeClientStatementExtractSymbol_(currentDescription);
    if (!symbol) {
      excluded.push({
        rowIndex: i + 1,
        reason: 'MISSING_SYMBOL',
        line: line,
        errors: ['symbol not found in security description']
      });
      continue;
    }
    if (accountKind === 'STOCK_PLAN' && symbol !== 'CSCO') {
      excluded.push({
        rowIndex: i + 1,
        reason: 'STOCK_PLAN_NON_CSCO',
        symbol: symbol,
        line: line
      });
      continue;
    }
    var nums = investmentEtradeClientStatementExtractNumericFieldsAfterTotal_(cells);
    if (!nums) {
      excluded.push({
        rowIndex: i + 1,
        reason: 'MALFORMED_TOTAL_ROW',
        symbol: symbol,
        line: line,
        errors: ['could not parse Total row numerics']
      });
      continue;
    }
    var errors = [];
    if (!isFinite(nums.quantity)) errors.push('quantity');
    if (!investmentEtradeClientStatementHasMoney_(nums.sharePrice)) errors.push('sharePrice');
    if (!investmentEtradeClientStatementHasMoney_(nums.marketValue)) errors.push('marketValue');
    if (errors.length) {
      excluded.push({
        rowIndex: i + 1,
        reason: 'MALFORMED_TOTAL_ROW',
        symbol: symbol,
        line: line,
        errors: errors
      });
      continue;
    }
    holdings.push({
      rowIndex: i + 1,
      symbol: symbol,
      securityDescription: currentDescription || line,
      quantity: nums.quantity,
      sharePrice: nums.sharePrice,
      totalCost: investmentEtradeClientStatementHasMoney_(nums.totalCost) ? nums.totalCost : null,
      marketValue: nums.marketValue,
      unrealizedGain: investmentEtradeClientStatementHasMoney_(nums.unrealizedGain)
        ? nums.unrealizedGain : null
    });
  }
  return { holdings: holdings, excluded: excluded };
}

function investmentEtradeClientStatementSumExcludedBalances_(preamble) {
  preamble = preamble || {};
  return (preamble.excludedBalances || []).reduce(function(sum, row) {
    return sum + (investmentEtradeClientStatementHasMoney_(row.amount) ? row.amount : 0);
  }, 0);
}

function investmentEtradeClientStatementBuildReconciliation_(preamble, holdings) {
  preamble = preamble || {};
  holdings = holdings || [];
  var tolerance = ETRADE_CLIENT_STATEMENT_RECONCILIATION_TOLERANCE_USD_;
  var holdingsSum = holdings.reduce(function(sum, row) {
    return sum + (investmentEtradeClientStatementHasMoney_(row.marketValue) ? row.marketValue : 0);
  }, 0);
  var cash = investmentEtradeClientStatementHasMoney_(preamble.cashBalance) ? preamble.cashBalance : 0;
  var accruedInterest = investmentEtradeClientStatementHasMoney_(preamble.accruedInterest)
    ? preamble.accruedInterest : 0;
  var excludedBalanceSum = investmentEtradeClientStatementSumExcludedBalances_(preamble);
  var computedBase = Math.round((holdingsSum + cash) * 100) / 100;
  var explainedAdjustments = Math.round((accruedInterest + excludedBalanceSum) * 100) / 100;
  var computedTotal = Math.round((computedBase + explainedAdjustments) * 100) / 100;
  var ending = investmentEtradeClientStatementHasMoney_(preamble.endingTotalValue)
    ? preamble.endingTotalValue : NaN;
  var grossDifference = isFinite(ending)
    ? Math.round((ending - computedBase) * 100) / 100 : NaN;
  var residualDifference = isFinite(ending)
    ? Math.round((ending - computedTotal) * 100) / 100 : NaN;
  var absGross = isFinite(grossDifference) ? Math.abs(grossDifference) : NaN;
  var absResidual = isFinite(residualDifference) ? Math.abs(residualDifference) : NaN;
  var ok = false;
  var blockingReason = '';
  if (!isFinite(ending)) {
    blockingReason = 'MISSING_ENDING_TOTAL';
  } else if (absGross <= tolerance) {
    ok = true;
  } else if (explainedAdjustments > 0 && absResidual <= tolerance) {
    ok = true;
  } else if (explainedAdjustments > 0) {
    blockingReason = 'RESIDUAL_AFTER_ADJUSTMENTS';
  } else {
    blockingReason = 'UNMODELED_STATEMENT_BALANCE';
  }
  return {
    ok: ok,
    rule: 'ABSOLUTE_USD_' + tolerance.toFixed(2),
    computedBase: computedBase,
    computedTotal: computedTotal,
    endingTotalValue: ending,
    holdingsMarketValueSum: Math.round(holdingsSum * 100) / 100,
    cashBalance: investmentEtradeClientStatementHasMoney_(preamble.cashBalance) ? cash : null,
    accruedInterest: investmentEtradeClientStatementHasMoney_(preamble.accruedInterest)
      ? accruedInterest : null,
    excludedBalances: (preamble.excludedBalances || []).slice(),
    explainedAdjustments: explainedAdjustments,
    grossDifference: isFinite(grossDifference) ? grossDifference : null,
    difference: isFinite(grossDifference) ? grossDifference : null,
    unexplainedDifference: ok ? 0 : (isFinite(residualDifference) ? residualDifference : null),
    tolerance: tolerance,
    blockingReason: ok ? '' : blockingReason
  };
}

function investmentEtradeClientStatementParseText_(rawText) {
  var prepared = investmentEtradeClientStatementPrepareTextForParsing_(rawText);
  if (!prepared.trim()) {
    return { ok: false, error: 'E*TRADE client statement PDF text is empty.' };
  }
  var quality = investmentEtradeClientStatementAssessTextQuality_(prepared);
  if (!quality.usable) {
    return { ok: false, error: quality.reason || 'E*TRADE client statement text is not usable.' };
  }
  var lines = prepared.split('\n');
  var headerIndex = investmentEtradeClientStatementFindHoldingsHeaderIndex_(lines);
  if (headerIndex < 0) {
    return { ok: false, error: 'E*TRADE client statement holdings table header not found.' };
  }
  var accountKind = investmentEtradeClientStatementDetectAccountKind_(prepared);
  var preamble = investmentEtradeClientStatementParsePreamble_(lines, prepared);
  var holdingsResult = investmentEtradeClientStatementParseHoldingsSection_(
    lines, headerIndex, accountKind);
  var reconciliation = investmentEtradeClientStatementBuildReconciliation_(
    preamble, holdingsResult.holdings);
  return {
    ok: true,
    preamble: preamble,
    holdings: holdingsResult.holdings,
    excluded: holdingsResult.excluded,
    accountKind: accountKind,
    reconciliation: reconciliation
  };
}

function investmentEtradeClientStatementDetect_(input) {
  input = input || {};
  var rawText = investmentEtradeClientStatementExtractContent_(input);
  if (!rawText.trim()) {
    return { ok: false, reason: 'No E*TRADE client statement PDF text supplied.' };
  }
  var prepared = investmentEtradeClientStatementPrepareTextForParsing_(rawText);
  var quality = investmentEtradeClientStatementAssessTextQuality_(prepared);
  if (!quality.usable) {
    return { ok: false, reason: quality.reason || 'File does not match E*TRADE client statement layout.' };
  }
  return {
    ok: true,
    source: 'ETRADE_CLIENT_STATEMENT_PDF',
    inferredRoles: ['HOLDINGS', 'ACCOUNT_SNAPSHOT']
  };
}

function investmentEtradeClientStatementResolveSourceAccountKey_(parseResult, accountMeta) {
  accountMeta = accountMeta || {};
  parseResult = parseResult || {};
  var stable = String(accountMeta.stableAccountId || '').trim();
  if (stable) {
    return {
      ok: true,
      sourceAccountKey: stable,
      reviewRequired: false
    };
  }
  var preamble = parseResult.preamble || {};
  var label = String(preamble.accountLabel || preamble.maskedAccountNumber ||
    preamble.accountTitle || '').trim();
  if (label) {
    return {
      ok: true,
      sourceAccountKey: investmentPortfolioHashOpaqueKey_('ETRADE_ACCT', label),
      reviewRequired: true,
      warning: 'stableAccountId is required before replaying E*TRADE client statement holdings.'
    };
  }
  return {
    ok: false,
    reviewRequired: true,
    error: 'E*TRADE client statement preview requires stableAccountId or account label in statement preamble.'
  };
}

function investmentEtradeClientStatementResolveAccountMatch_(input, accountResolution) {
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

function investmentEtradeClientStatementBuildSourceSecurityKey_(symbol) {
  return 'ETRADE|' + String(symbol || '').trim().toUpperCase() + '|STATEMENT';
}

function investmentEtradeClientStatementNormalizeAsOf_(preamble) {
  preamble = preamble || {};
  var asOf = String(preamble.asOfDate || '').trim();
  if (!asOf) {
    var periodEnd = String(preamble.statementPeriodEnd || '').trim();
    if (!periodEnd) return '';
    try {
      asOf = normalizeInvestmentImportDate_(periodEnd, 'Statement period end');
    } catch (e) {
      asOf = periodEnd;
    }
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(asOf)) return asOf + 'T00:00:00.000Z';
  if (/^\d{4}-\d{2}-\d{2}T/.test(asOf)) return asOf;
  return asOf;
}

function investmentEtradeClientStatementBuildUnifiedPreview_(input, parseResult, accountMatch) {
  input = input || {};
  parseResult = parseResult || {};
  accountMatch = accountMatch || {};
  var accountMeta = input.accountMeta || {};
  var preamble = parseResult.preamble || {};
  var sourceAsOf = investmentEtradeClientStatementNormalizeAsOf_(preamble);
  var registrationType = investmentPortfolioNormalizeRegistrationType_(
    accountMeta.registrationType || 'TAXABLE');
  var taxStatus = investmentPortfolioResolveTaxStatus_(registrationType);
  var fingerprint = investmentEtradeClientStatementResolveDocumentFingerprint_(input);
  var stableAccountId = String(accountMatch.stableAccountId || '').trim();
  var matchStatus = String(accountMatch.matchStatus || 'REVIEW_REQUIRED').toUpperCase();
  var confidence = matchStatus === 'EXPLICIT_MATCH' ? 'HIGH' : 'MEDIUM';
  if (['AMBIGUOUS', 'CONFLICT', 'NO_MATCH', 'REVIEW_REQUIRED'].indexOf(matchStatus) !== -1) {
    confidence = 'LOW';
  }

  var preview = investmentPortfolioBuildEmptyHoldingsPreview_({
    source: 'ETRADE_CLIENT_STATEMENT_PDF',
    parserVersion: ETRADE_CLIENT_STATEMENT_PDF_PARSER_VERSION_,
    asOf: sourceAsOf,
    observedAt: String(input.observedAt || '')
  });
  preview.source = 'ETRADE_CLIENT_STATEMENT_PDF';
  preview.parserVersion = ETRADE_CLIENT_STATEMENT_PDF_PARSER_VERSION_;
  preview.sourceFiles = [{
    role: 'HOLDINGS',
    fileName: String(input.fileName || 'etrade-client-statement.pdf').trim() ||
      'etrade-client-statement.pdf',
    sourceFileFingerprint: fingerprint,
    sourceAsOf: sourceAsOf,
    parserVersion: ETRADE_CLIENT_STATEMENT_PDF_PARSER_VERSION_
  }];
  preview.capabilities = {
    activities: false,
    holdings: (parseResult.holdings || []).length > 0,
    taxLots: false,
    accountSnapshot: !!(preamble.endingTotalValue || preamble.cashBalance !== null),
    dividendHistory: false,
    realizedGainLoss: false
  };
  preview.accounts = [{
    investmentId: String(input.investmentId || accountMeta.investmentId || ''),
    stableAccountId: stableAccountId,
    institution: 'E*TRADE',
    displayName: String(accountMeta.accountName || preamble.accountTitle ||
      preamble.accountLabel || '').trim(),
    accountType: String(accountMeta.accountType ||
      (parseResult.accountKind === 'STOCK_PLAN' ? 'Stock Plan' : 'Brokerage')).trim(),
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
    var sourceSecurityKey = investmentEtradeClientStatementBuildSourceSecurityKey_(row.symbol);
    var stableSecurityId = investmentPortfolioHashOpaqueKey_('SEC', sourceSecurityKey);
    if (!securitiesById[stableSecurityId]) {
      securitiesById[stableSecurityId] = {
        stableSecurityId: stableSecurityId,
        ticker: row.symbol,
        securityName: String(row.securityDescription || '').replace(/\s*\([^)]+\)\s*$/, '').trim(),
        securityType: 'EQUITY',
        assetClass: 'US_EQUITY',
        primarySource: 'ETRADE_CLIENT_STATEMENT_PDF',
        sourceSecurityKey: sourceSecurityKey
      };
      securities.push(securitiesById[stableSecurityId]);
    }
    var holding = {
      stableAccountId: stableAccountId,
      stableSecurityId: stableSecurityId,
      ticker: row.symbol,
      shares: row.quantity,
      price: row.sharePrice,
      priceAsOf: sourceAsOf,
      marketValue: row.marketValue,
      providerCostBasis: row.totalCost,
      costBasisQuality: row.totalCost !== null ? 'PROVIDER_AGGREGATE' : 'UNKNOWN',
      unrealizedGainLoss: row.unrealizedGain,
      authority: 'PROVIDER_REPORTED',
      source: 'ETRADE_CLIENT_STATEMENT_PDF',
      sourceSnapshotKey: fingerprint,
      sourceAsOf: sourceAsOf,
      sourceFileFingerprint: fingerprint,
      dataQuality: 'PROVIDER_REPORTED',
      freshness: sourceAsOf ? 'CURRENT' : 'UNKNOWN',
      confidence: confidence,
      reviewRequired: accountMatch.reviewRequired === true
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
  if (preamble.endingTotalValue || preamble.cashBalance !== null) {
    preview.accountSnapshots = [{
      stableAccountId: stableAccountId || String(accountMatch.sourceAccountKey || ''),
      snapshotType: 'CASH',
      marketValue: preamble.endingTotalValue,
      cashBalance: investmentEtradeClientStatementHasMoney_(preamble.cashBalance)
        ? preamble.cashBalance : null,
      asOf: sourceAsOf,
      authority: 'PROVIDER_REPORTED',
      sourceSnapshotKey: fingerprint,
      sourceAsOf: sourceAsOf,
      source: 'ETRADE_CLIENT_STATEMENT_PDF'
    }];
  }
  preview.warnings = [];
  if (accountMatch.warning) preview.warnings.push(accountMatch.warning);
  if (!parseResult.reconciliation || parseResult.reconciliation.ok !== true) {
    var recon = parseResult.reconciliation || {};
    if (recon.blockingReason === 'UNMODELED_STATEMENT_BALANCE') {
      preview.warnings.push(
        'Ending Total Value includes an unmodeled balance not represented in holdings, cash, accrued interest, or excluded-balance fields (difference ' +
        String(recon.grossDifference != null ? recon.grossDifference : 'unknown') + ').');
    } else if (recon.blockingReason === 'RESIDUAL_AFTER_ADJUSTMENTS') {
      preview.warnings.push(
        'Statement totals do not reconcile after modeled accrued interest / excluded-balance adjustments (residual ' +
        String(recon.unexplainedDifference != null ? recon.unexplainedDifference : 'unknown') + ').');
    } else {
      preview.warnings.push(
        'Statement holdings plus cash do not reconcile to Ending Total Value within $' +
        ETRADE_CLIENT_STATEMENT_RECONCILIATION_TOLERANCE_USD_.toFixed(2) + ' absolute tolerance.');
    }
  }
  if (parseResult.accountKind === 'STOCK_PLAN') {
    preview.warnings.push('Stock Plan / ESPP statement: only vested CSCO Total rows are included in holdings preview.');
  }
  if (preamble.maskedAccountNumber) {
    preview.warnings.push(
      'Masked statement account number is informational only and is not durable account identity.');
  }
  preview.unsupportedRows = parseResult.excluded || [];
  preview.statementParseMeta = {
    extraction: input.extractionMeta || null,
    reconciliation: parseResult.reconciliation || null,
    accountKind: parseResult.accountKind || 'BROKERAGE',
    endingTotalValue: preamble.endingTotalValue,
    asOfDate: preamble.asOfDate || '',
    cashBalance: preamble.cashBalance,
    accruedInterest: preamble.accruedInterest,
    excludedBalances: (preamble.excludedBalances || []).slice(),
    documentFingerprint: fingerprint,
    holdingsRowsParsed: (parseResult.holdings || []).length,
    excludedRows: (parseResult.excluded || []).length
  };
  preview.importSummary = investmentPortfolioBuildImportPreviewSummary_({
    source: 'ETRADE_CLIENT_STATEMENT_PDF',
    parserVersion: ETRADE_CLIENT_STATEMENT_PDF_PARSER_VERSION_,
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
  if (accountMatch.reviewRequired) {
    preview.recommendationReadiness.trustedForHoldingsVisibility = false;
    preview.recommendationReadiness.trustedForIncomeAnalysis = false;
    preview.recommendationReadiness.trustedForTaxLotSalePlanning = false;
  }
  preview.recommendationReadiness.trustedForIncomeAnalysis = false;
  preview.recommendationReadiness.trustedForTaxLotSalePlanning = false;
  return preview;
}

function investmentEtradeClientStatementPreviewUnified_(input) {
  input = input || {};
  var source = String(input.source || 'ETRADE_CLIENT_STATEMENT_PDF').trim() ||
    'ETRADE_CLIENT_STATEMENT_PDF';
  var rawText = investmentEtradeClientStatementExtractContent_(input);
  if (!rawText.trim()) {
    return {
      ok: false,
      reviewRequired: true,
      source: source,
      error: 'E*TRADE client statement PDF text content is required.'
    };
  }
  var quality = investmentEtradeClientStatementAssessTextQuality_(
    investmentEtradeClientStatementPrepareTextForParsing_(rawText));
  if (!quality.usable) {
    return {
      ok: false,
      reviewRequired: true,
      source: source,
      error: quality.reason || 'E*TRADE client statement text is not usable.',
      extractionQuality: quality.quality
    };
  }
  var parseResult = investmentEtradeClientStatementParseText_(rawText);
  if (!parseResult.ok) {
    return {
      ok: false,
      reviewRequired: true,
      source: source,
      error: parseResult.error
    };
  }
  var accountMeta = input.accountMeta || {};
  var accountResolution = investmentEtradeClientStatementResolveSourceAccountKey_(parseResult, accountMeta);
  if (!accountResolution.ok) {
    return {
      ok: false,
      reviewRequired: true,
      source: source,
      error: accountResolution.error
    };
  }
  var accountMatch = investmentEtradeClientStatementResolveAccountMatch_(input, accountResolution);
  if (!accountMatch.ok) {
    return {
      ok: false,
      reviewRequired: true,
      source: source,
      error: accountMatch.error
    };
  }
  var unified = investmentEtradeClientStatementBuildUnifiedPreview_(
    input, parseResult, accountMatch);
  var reviewRequired = accountMatch.reviewRequired === true ||
    !unified.recommendationReadiness.trustedForHoldingsVisibility;
  return {
    ok: true,
    reviewRequired: reviewRequired,
    source: 'ETRADE_CLIENT_STATEMENT_PDF',
    parserVersion: ETRADE_CLIENT_STATEMENT_PDF_PARSER_VERSION_,
    schemaVersion: INVESTMENT_PORTFOLIO_SCHEMA_VERSION_,
    contractVersion: PORTFOLIO_INTELLIGENCE_HOLDINGS_CONTRACT_VERSION_,
    capabilities: unified.capabilities,
    normalized: unified
  };
}
