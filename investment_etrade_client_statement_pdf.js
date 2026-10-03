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

var ETRADE_CLIENT_STATEMENT_BOILERPLATE_SYMBOLS_ = {
  SIPA: true,
  SIPC: true,
  FX: true,
  LOSS: true,
  MMF: true,
  DEBITS: true,
  CONTINUED: true
};

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
  /^CASH,?\s+BANK\s+DEPOSIT\s+PROGRAM/i,
  /^Ending\s+Total\s+Value/i,
  /^MONEY\s+MARKET\s+FUND\b/i,
  /^NET\s+CREDITS/i,
  /^Terms\s+and\s+Conditions/i,
  /^Page\s+\d+\s+of\s+\d+/i,
  /^--\s*\d+\s+of\s+\d+\s*--/i
];

/**
 * Explicit configured mapping for the potential/unvested stock-plan monthly value.
 * Exact account name only — do not infer from display-name text such as "Future" or "Etrade".
 */
function investmentEtradePotentialUnvestedStockPlanMapping_() {
  return {
    accountName: 'Etrade Cisco - Future',
    source: 'ETRADE_CLIENT_STATEMENT_PDF',
    valueCategory: 'POTENTIAL_UNVESTED_STOCK_PLAN',
    valueLabel: 'Potential/unvested stock-plan value',
    warning: 'This value is not vested and is not current brokerage holdings.',
    providerLabel: 'E*TRADE'
  };
}

function investmentEtradeMatchesPotentialUnvestedStockPlanMapping_(accountName, source) {
  var mapping = investmentEtradePotentialUnvestedStockPlanMapping_();
  if (String(accountName || '').trim() !== mapping.accountName) return false;
  if (source == null || String(source).trim() === '') return true;
  var normalized = typeof investmentPortfolioNormalizeSource_ === 'function'
    ? investmentPortfolioNormalizeSource_(source)
    : String(source || '').trim().toUpperCase();
  return normalized === mapping.source;
}

/**
 * Explicit mapping for the vested/current E*TRADE Cisco brokerage monthly value.
 * Exact account name only — never infer from display-name text such as "RSU" or "ESPP".
 * Used only by the combined Cisco statement-import profile, not as a standalone import.
 */
function investmentEtradeCiscoBrokerageAccountValueMapping_() {
  return {
    accountName: 'Etrade Cisco - RSU/ESPP',
    source: 'ETRADE_CLIENT_STATEMENT_PDF',
    valueCategory: 'BROKERAGE_ACCOUNT_VALUE',
    valueLabel: 'Brokerage account value',
    providerLabel: 'E*TRADE'
  };
}

/**
 * Explicit mapping for the Samer E*TRADE self-directed brokerage import.
 * Exact account name only — never infer from display-name text such as "Samer"
 * or statement account numbers. Monthly INPUT value plus Unified holdings.
 */
function investmentEtradeSamerBrokerageAccountValueMapping_() {
  return {
    accountName: 'Samer Etrade Account',
    source: 'ETRADE_CLIENT_STATEMENT_PDF',
    valueCategory: 'BROKERAGE_ACCOUNT_VALUE',
    valueLabel: 'Brokerage account value',
    providerLabel: 'E*TRADE'
  };
}

function investmentEtradeMatchesSamerBrokerageAccountValueMapping_(accountName, source) {
  var mapping = investmentEtradeSamerBrokerageAccountValueMapping_();
  if (String(accountName || '').trim() !== mapping.accountName) return false;
  if (source == null || String(source).trim() === '') return true;
  var normalized = typeof investmentPortfolioNormalizeSource_ === 'function'
    ? investmentPortfolioNormalizeSource_(source)
    : String(source || '').trim().toUpperCase();
  return normalized === mapping.source;
}

/**
 * Combined statement-import profile for one E*TRADE Cisco client statement.
 * Picker-only — not a CashCompass account and not an INPUT - Investments identity.
 */
function investmentEtradeCiscoStatementImportProfile_() {
  var brokerage = investmentEtradeCiscoBrokerageAccountValueMapping_();
  var potential = investmentEtradePotentialUnvestedStockPlanMapping_();
  return {
    pickerKind: 'STATEMENT_IMPORT_PROFILE',
    pickerValue: '__profile__:ETRADE_CISCO_STATEMENT',
    pickerLabel: 'E*TRADE Cisco Statement — RSU/ESPP + Future',
    source: 'ETRADE_CLIENT_STATEMENT_PDF',
    provider: 'ETRADE',
    providerLabel: 'E*TRADE',
    confirmLabel: brokerage.accountName + ' and ' + potential.accountName,
    legs: [
      {
        accountName: brokerage.accountName,
        valueCategory: brokerage.valueCategory,
        valueLabel: brokerage.valueLabel,
        valueOrigin: 'ENDING_TOTAL_VALUE',
        warning: ''
      },
      {
        accountName: potential.accountName,
        valueCategory: potential.valueCategory,
        valueLabel: potential.valueLabel,
        valueOrigin: 'POTENTIAL_UNVESTED_STOCK_PLAN',
        warning: potential.warning
      }
    ]
  };
}

function investmentEtradeMatchesCiscoStatementImportProfile_(pickerValue) {
  return String(pickerValue || '').trim() ===
    investmentEtradeCiscoStatementImportProfile_().pickerValue;
}

function investmentEtradeCiscoStatementProfileCombinedAccountName_() {
  return 'Etrade Cisco - RSU/ESPP + Future';
}

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
  if (typeof investmentStashLooksLikeBrokerageStatementPdf_ === 'function' &&
      investmentStashLooksLikeBrokerageStatementPdf_(text)) {
    return {
      documentType: 'UNKNOWN',
      confidence: 'LOW',
      reason: 'Document appears to be a Stash brokerage statement.'
    };
  }
  if (/Charles\s+Schwab|Schwab\s+One|Schwab\s+Brokerage/i.test(compact) &&
      /Positions\s*[-–]\s*Equities/i.test(compact)) {
    return {
      documentType: 'UNKNOWN',
      confidence: 'LOW',
      reason: 'Document appears to be a Schwab brokerage statement.'
    };
  }
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
      !/M1:|Finance Super App|Total account value \/ 1-month change/i.test(compact) &&
      !(typeof investmentStashLooksLikeBrokerageStatementPdf_ === 'function' &&
        investmentStashLooksLikeBrokerageStatementPdf_(text))) {
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
    'CASH, BANK DEPOSIT PROGRAM AND MONEY MARKET FUNDS',
    'For the Period',
    'Ending Total Value (as of',
    'Potential Restricted Stock',
    'Exercisable Value',
    'Potential Value',
    'TOTAL VALUE',
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
  var expanded = [];
  lines.forEach(function(line) {
    String(investmentEtradeClientStatementExpandGluedHoldingsLine_(line) || '').split('\n')
      .forEach(function(part) {
        part = String(part || '').trim();
        if (part) expanded.push(part);
      });
  });
  return expanded.join('\n');
}

function investmentEtradeClientStatementInsertHoldingsRowBreaks_(text) {
  var out = String(text || '');
  if (!out) return out;
  out = out.replace(/\s+(Purchases|Reinvestments)\b/gi, '\n$1');
  out = out.replace(/\s+(Total\s+[\d,]+(?:\.\d+)?)/gi, '\n$1');
  out = out.replace(/\s+([A-Z][A-Za-z0-9 .,&/'+-]{1,80}\([A-Z][A-Z0-9.\-]{0,11}\))/g, '\n$1');
  out = out.replace(/\s+(Activity\s+Summary|Activity\s+Detail|Realized\s+Gains?|Total\s+Cash|CASH,\s+BANK\s+DEPOSIT\s+PROGRAM|Ending\s+Total\s+Value|Total\s+Equities|Total\s+Account\s+Value|TOTAL\s+VALUE|MONEY\s+MARKET\s+FUND|NET\s+CREDITS|Accrued\s+Interest|Terms\s+and\s+Conditions)\b/gi, '\n$1');
  return out;
}

function investmentEtradeClientStatementExpandGluedHoldingsLine_(line) {
  var text = String(line || '');
  if (!text) return text;
  var headerRe = /Security\s+Description\s+Quantity\s+Share\s+Price(?:\s+Total\s+Cost)?(?:\s+Market\s+Value)?(?:\s+Unrealized\s+Gain\/Loss(?:\s*%)?)?(?:\s+Est\s+Annual\s+Income)?(?:\s+Current\s+Yield\s*%)?(?:\s+Est\s+YTD\s+Income)?/i;
  var headerMatch = text.match(headerRe);
  var parts = [];
  var rest = text;
  if (headerMatch) {
    var before = text.slice(0, headerMatch.index).trim();
    if (before) parts.push(before);
    parts.push(String(headerMatch[0] || '').trim());
    rest = text.slice(headerMatch.index + headerMatch[0].length);
  }
  rest = investmentEtradeClientStatementInsertHoldingsRowBreaks_(rest);
  String(rest || '').split('\n').forEach(function(part) {
    part = String(part || '').trim();
    if (part) parts.push(part);
  });
  return parts.length ? parts.join('\n') : text;
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
  var raw = String(text == null ? '' : text).trim();
  if (!raw) return NaN;
  try {
    var value = parseInvestmentImportMoney_(raw);
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
  var pattern = /\$?\([\d,.\-]+\)|-\$[\d,.\-]+|\$[\d,.\-]+|\d{1,2}\/\d{1,2}\/\d{4}|[A-Za-z][A-Za-z0-9.\-&']*|\bTotal\b|\bPurchases\b|\bReinvestments\b|[\d,]+(?:\.\d+)?/gi;
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
  var symbol = match ? String(match[1] || '').trim().toUpperCase() : '';
  if (!symbol || ETRADE_CLIENT_STATEMENT_BOILERPLATE_SYMBOLS_[symbol]) return '';
  return symbol;
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
  if (/(?:Total\s+)?Cash,?\s+Bank\s+Deposit\s+Program,?\s+and\s+Money\s+Market\s+Funds/i.test(text)) {
    return true;
  }
  if (/^Total\s+(Value|Assets|Beginning)\b/i.test(text) || /^TOTAL\s+VALUE\b/i.test(text)) return true;
  if (/Total Cash Related Activity/i.test(text)) return true;
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

function investmentEtradeClientStatementIsHoldingsTableFooter_(line) {
  var text = String(line || '').trim();
  return /^TOTAL VALUE\s+[\d.]+%/i.test(text) || /^Percentage of Holdings\b/i.test(text);
}

function investmentEtradeClientStatementIsInlineSecurityHoldingRow_(line) {
  var text = String(line || '').trim();
  if (!text) return false;
  if (investmentEtradeClientStatementIsPurchasesOrReinvestmentRow_(text)) return false;
  if (investmentEtradeClientStatementIsSecurityTotalRow_(text)) return false;
  if (investmentEtradeClientStatementIsSummaryTotalRow_(text)) return false;
  if (!investmentEtradeClientStatementExtractSymbol_(text)) return false;
  return /\([A-Z][A-Z0-9.\-]{0,11}\)\s+[\d,]+(?:\.\d+)?/.test(text);
}

function investmentEtradeClientStatementIsMoneyToken_(tok) {
  tok = String(tok || '').trim();
  return /^\$/.test(tok) || /^\(.*\)$/.test(tok) || (/^[\-$]/.test(tok) && /[\d]/.test(tok));
}

function investmentEtradeClientStatementFindHoldingNumericStart_(cells) {
  cells = cells || [];
  var start = -1;
  var i;
  for (i = 0; i < cells.length; i++) {
    if (/^Total$/i.test(String(cells[i] || '').trim())) start = i + 1;
  }
  if (start >= 0) return start;
  for (i = 0; i < cells.length; i++) {
    if (investmentEtradeClientStatementExtractSymbol_(cells[i])) start = i + 1;
  }
  return start;
}

function investmentEtradeClientStatementCollectHoldingNumericValues_(cells, start) {
  cells = cells || [];
  var tokens = start >= 0 ? cells.slice(start) : cells;
  var quantity = NaN;
  var values = [];
  var i;
  for (i = 0; i < tokens.length; i++) {
    var tok = String(tokens[i] || '').trim();
    if (!tok || tok === '—' || tok === '-' || tok === '–') continue;
    if (/%/.test(tok)) continue;
    if (/^[A-Za-z]/.test(tok) && !/^\$/.test(tok)) break;
    if (!isFinite(quantity)) {
      var qty = investmentEtradeClientStatementSafeParseNumber_(tok);
      if (isFinite(qty)) {
        quantity = qty;
        continue;
      }
    }
    if (investmentEtradeClientStatementIsMoneyToken_(tok)) {
      var money = investmentEtradeClientStatementSafeParseMoney_(tok);
      if (investmentEtradeClientStatementHasMoney_(money)) values.push(money);
      continue;
    }
    var num = investmentEtradeClientStatementSafeParseNumber_(tok);
    if (isFinite(num)) values.push(num);
  }
  return { quantity: quantity, values: values };
}

function investmentEtradeClientStatementCostGainMatchesMarket_(cost, gain, market) {
  if (!investmentEtradeClientStatementHasMoney_(cost) ||
      !investmentEtradeClientStatementHasMoney_(gain) ||
      !investmentEtradeClientStatementHasMoney_(market)) {
    return false;
  }
  return Math.abs(Math.round((cost + gain) * 100) / 100 - market) <= 0.05;
}

function investmentEtradeClientStatementExtractNumericFieldsAfterTotal_(cells) {
  cells = cells || [];
  var start = investmentEtradeClientStatementFindHoldingNumericStart_(cells);
  if (start < 0) {
    var joined = cells.join(' ');
    var match = joined.match(/\bTotal\b\s+([\d,]+\.?\d*)\s+(\$[\d,().\-]+)\s+(\$[\d,().\-]+)\s+(\$[\d,().\-]+)\s+(\$[\d,().\-]+)/i);
    if (!match) return null;
    return investmentEtradeClientStatementAssignTotalNumericFields_(
      investmentEtradeClientStatementSafeParseNumber_(match[1]),
      [
        investmentEtradeClientStatementSafeParseMoney_(match[2]),
        investmentEtradeClientStatementSafeParseMoney_(match[3]),
        investmentEtradeClientStatementSafeParseMoney_(match[4]),
        investmentEtradeClientStatementSafeParseMoney_(match[5])
      ]
    );
  }
  var collected = investmentEtradeClientStatementCollectHoldingNumericValues_(cells, start);
  return investmentEtradeClientStatementAssignTotalNumericFields_(collected.quantity, collected.values);
}

function investmentEtradeClientStatementAssignTotalNumericFields_(quantity, values) {
  values = values || [];
  var empty = {
    quantity: quantity,
    sharePrice: NaN,
    totalCost: NaN,
    marketValue: NaN,
    unrealizedGain: NaN,
    ambiguous: false,
    invalidMarket: false
  };
  if (!isFinite(quantity) || values.length < 3) return empty;
  var omittedPrice = investmentEtradeClientStatementCostGainMatchesMarket_(
    values[0], values[2], values[1]);
  var withPrice = values.length >= 4 && investmentEtradeClientStatementCostGainMatchesMarket_(
    values[1], values[3], values[2]);
  if (omittedPrice && withPrice) {
    empty.ambiguous = true;
    return empty;
  }
  var price = NaN;
  var cost = NaN;
  var market = NaN;
  var gain = NaN;
  if (withPrice) {
    price = values[0];
    cost = values[1];
    market = values[2];
    gain = values[3];
  } else if (omittedPrice) {
    cost = values[0];
    market = values[1];
    gain = values[2];
    price = quantity ? Math.round((market / quantity) * 10000) / 10000 : NaN;
  } else {
    return empty;
  }
  if (!investmentEtradeClientStatementHasMoney_(market) || market < 0) {
    empty.invalidMarket = true;
    return empty;
  }
  return {
    quantity: quantity,
    sharePrice: price,
    totalCost: cost,
    marketValue: market,
    unrealizedGain: gain,
    ambiguous: false,
    invalidMarket: false
  };
}

function investmentEtradeClientStatementHoldingsRowAlignmentGap_(row) {
  if (!row || !isFinite(row.quantity) || !investmentEtradeClientStatementHasMoney_(row.sharePrice) ||
      !investmentEtradeClientStatementHasMoney_(row.marketValue)) {
    return Number.POSITIVE_INFINITY;
  }
  return Math.abs(Math.round(row.quantity * row.sharePrice * 100) / 100 - row.marketValue);
}

function investmentEtradeClientStatementValidatedIsoDate_(year, month, day) {
  year = Number(year);
  month = Number(month);
  day = Number(day);
  if (!isFinite(year) || !isFinite(month) || !isFinite(day)) return '';
  var date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return '';
  }
  return String(year) + '-' + ('0' + month).slice(-2) + '-' + ('0' + day).slice(-2);
}

/**
 * Normalize E*TRADE client-statement dates. Accepts 8/31/26, 08/31/26, 8/31/2026,
 * 08/31/2026, and ISO. Two-digit years map to 20xx. Invalid calendar dates return ''.
 */
function investmentEtradeClientStatementNormalizeStatementDate_(value) {
  var text = String(value || '').trim();
  if (!text) return '';
  var isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/);
  if (isoMatch) {
    return investmentEtradeClientStatementValidatedIsoDate_(isoMatch[1], isoMatch[2], isoMatch[3]);
  }
  var us = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4}|\d{2})$/);
  if (!us) return '';
  var year = us[3].length === 2 ? 2000 + Number(us[3]) : Number(us[3]);
  return investmentEtradeClientStatementValidatedIsoDate_(year, us[1], us[2]);
}

function investmentEtradeClientStatementMonthNameToNumber_(name) {
  var key = String(name || '').trim().toLowerCase().slice(0, 3);
  var months = {
    jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
    jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12
  };
  return months[key] || 0;
}

function investmentEtradeClientStatementFormatUsDate_(year, month, day) {
  year = Number(year);
  month = Number(month);
  day = Number(day);
  if (!isFinite(year) || !isFinite(month) || !isFinite(day) || month < 1 || day < 1) return '';
  return String(month) + '/' + String(day) + '/' + String(year);
}

function investmentEtradeClientStatementParseStatementPeriodFromText_(text) {
  var source = String(text || '').replace(/For the\s+Period/gi, 'For the Period');
  if (!source) return null;
  var numeric = source.match(/Statement period:\s*(\d{1,2}\/\d{1,2}\/(?:\d{4}|\d{2}))\s+(?:to|-|–)\s+(\d{1,2}\/\d{1,2}\/(?:\d{4}|\d{2}))/i);
  if (numeric) {
    return { start: numeric[1], end: numeric[2] };
  }
  var numericFor = source.match(
    /For the Period\s+(\d{1,2}\/\d{1,2}\/(?:\d{4}|\d{2}))\s*(?:to|-|–)\s*(\d{1,2}\/\d{1,2}\/(?:\d{4}|\d{2}))/i);
  if (numericFor) {
    return { start: numericFor[1], end: numericFor[2] };
  }
  var twoNamed = source.match(
    /For the Period\s+([A-Za-z]+)\s+(\d{1,2}),?\s*(?:(\d{4})\s+)?(?:to|-|–)\s+([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})/i);
  if (twoNamed) {
    var startYear = twoNamed[3] || twoNamed[6];
    var start = investmentEtradeClientStatementFormatUsDate_(
      startYear, investmentEtradeClientStatementMonthNameToNumber_(twoNamed[1]), twoNamed[2]);
    var end = investmentEtradeClientStatementFormatUsDate_(
      twoNamed[6], investmentEtradeClientStatementMonthNameToNumber_(twoNamed[4]), twoNamed[5]);
    if (start && end) return { start: start, end: end };
  }
  var collapsed = source.match(
    /For the Period\s+([A-Za-z]+)\s+(\d{1,2})\s*[-–—]\s*(\d{1,2}),\s*(\d{4})/i);
  if (collapsed) {
    var month = investmentEtradeClientStatementMonthNameToNumber_(collapsed[1]);
    var startDate = investmentEtradeClientStatementFormatUsDate_(collapsed[4], month, collapsed[2]);
    var endDate = investmentEtradeClientStatementFormatUsDate_(collapsed[4], month, collapsed[3]);
    if (startDate && endDate) return { start: startDate, end: endDate };
  }
  return null;
}

function investmentEtradeClientStatementIsCashFundsLabel_(text) {
  return /(?:Total\s+)?Cash,?\s+Bank\s+Deposit\s+Program,?\s+and\s+Money\s+Market\s+Funds/i
    .test(String(text || ''));
}

function investmentEtradeClientStatementIsCashFundsDebitLabel_(text) {
  var value = String(text || '');
  return /(?:Total\s+)?Cash,?\s+Bank\s+Deposit\s+Program,?\s+and\s+Money\s+Market\s+Funds\s+Debit/i
    .test(value) || /Cash,\s*BDP,\s*MMFs\s*\(Debit\)/i.test(value);
}

function investmentEtradeClientStatementResolvePreambleAsOfDate_(preamble) {
  preamble = preamble || {};
  var asOf = investmentEtradeClientStatementNormalizeStatementDate_(preamble.asOfDate);
  if (asOf) return asOf;
  return investmentEtradeClientStatementNormalizeStatementDate_(preamble.asOfDateRaw);
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
    cashDebit: null,
    accruedInterest: null,
    excludedBalances: [],
    endingTotalValue: null,
    asOfDate: '',
    asOfDateRaw: ''
  };
  (lines || []).forEach(function(line) {
    var text = String(line || '').trim();
    if (!text) return;
    var periodMatch = investmentEtradeClientStatementParseStatementPeriodFromText_(text);
    if (periodMatch && periodMatch.end) {
      preamble.statementPeriodStart = periodMatch.start || '';
      preamble.statementPeriodEnd = periodMatch.end;
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
    var accruedLineMatch = text.match(/^Accrued\s+Interest\s+(\$[\d,().\-]+)\s*$/i);
    if (accruedLineMatch) {
      var accruedAmount = investmentEtradeClientStatementSafeParseMoney_(accruedLineMatch[1]);
      if (investmentEtradeClientStatementHasMoney_(accruedAmount) && accruedAmount >= 0) {
        preamble.accruedInterest = accruedAmount;
      }
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
  if (!preamble.statementPeriodEnd) {
    var compactPeriod = investmentEtradeClientStatementParseStatementPeriodFromText_(compact);
    if (compactPeriod && compactPeriod.end) {
      preamble.statementPeriodStart = compactPeriod.start || '';
      preamble.statementPeriodEnd = compactPeriod.end;
    }
  }
  var endingDateRe =
    /Ending\s+Total\s+Value\s*\(\s*as\s+of\s+(\d{1,2}\/\d{1,2}\/(?:\d{4}|\d{2}))(?!\d)\s*\)/gi;
  var endingDateMatch;
  var rawEndingDates = [];
  var normalizedEndingDates = [];
  while ((endingDateMatch = endingDateRe.exec(compact)) !== null) {
    rawEndingDates.push(endingDateMatch[1]);
    normalizedEndingDates.push(
      investmentEtradeClientStatementNormalizeStatementDate_(endingDateMatch[1]));
  }
  var uniqueValidEndingDates = [];
  var hasInvalidEndingDate = false;
  normalizedEndingDates.forEach(function(iso) {
    if (!iso) {
      hasInvalidEndingDate = true;
      return;
    }
    if (uniqueValidEndingDates.indexOf(iso) === -1) uniqueValidEndingDates.push(iso);
  });
  if (!hasInvalidEndingDate && uniqueValidEndingDates.length === 1) {
    preamble.asOfDateRaw = rawEndingDates[0];
    preamble.asOfDate = uniqueValidEndingDates[0];
  }
  var endingMatch = compact.match(
    /Ending\s+Total\s+Value(?:\s*\(\s*as\s+of\s+\d{1,2}\/\d{1,2}\/(?:\d{4}|\d{2})(?!\d)\s*\))?\s*(\$[\d,().\-]+)/i);
  if (endingMatch) {
    preamble.endingTotalValue = investmentEtradeClientStatementSafeParseMoney_(endingMatch[1]);
  }
  preamble.cashDebit = null;
  var cashDebitMatch = compact.match(
    /(?:Total\s+)?Cash,?\s+Bank\s+Deposit\s+Program,?\s+and\s+Money\s+Market\s+Funds\s+Debit[^$]*(\$[\d,().\-]+)/i);
  if (cashDebitMatch) {
    preamble.cashDebit = investmentEtradeClientStatementSafeParseMoney_(cashDebitMatch[1]);
  }
  var cashMatch = compact.match(
    /(?:Total\s+)?Cash,?\s+Bank\s+Deposit\s+Program,?\s+and\s+Money\s+Market\s+Funds(?!\s+Debit)[^$]*(\$[\d,().\-]+)/i);
  if (cashMatch) {
    preamble.cashBalance = investmentEtradeClientStatementSafeParseMoney_(cashMatch[1]);
  }
  (lines || []).forEach(function(line) {
    var text = String(line || '').trim();
    if (!investmentEtradeClientStatementIsCashFundsLabel_(text)) return;
    var moneyMatch = text.match(/(\$[\d,().\-]+)\s*$/);
    if (!moneyMatch) return;
    var amount = investmentEtradeClientStatementSafeParseMoney_(moneyMatch[1]);
    if (!investmentEtradeClientStatementHasMoney_(amount)) return;
    if (investmentEtradeClientStatementIsCashFundsDebitLabel_(text) || /\bDebit\b/i.test(text)) {
      preamble.cashDebit = amount;
      return;
    }
    preamble.cashBalance = amount;
  });
  var closingCashMatch = compact.match(/CLOSING CASH,\s*BDP,\s*MMFs[^$]*(\$[\d,().\-]+)/i);
  if (closingCashMatch) {
    preamble.cashBalance = investmentEtradeClientStatementSafeParseMoney_(closingCashMatch[1]);
    preamble.cashDebit = null;
  }
  return preamble;
}

function investmentEtradeClientStatementParseHoldingsSection_(lines, headerIndex, accountKind) {
  var holdings = [];
  var excluded = [];
  var currentSymbol = '';
  var currentDescription = '';
  var seenSymbols = {};
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
      if (investmentEtradeClientStatementIsHoldingsTableFooter_(line)) break;
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
    var inlineHolding = investmentEtradeClientStatementIsInlineSecurityHoldingRow_(line);
    if (symbolInLine && !investmentEtradeClientStatementIsSecurityTotalRow_(line) && !inlineHolding) {
      currentSymbol = symbolInLine;
      currentDescription = line;
      continue;
    }
    if (!investmentEtradeClientStatementIsSecurityTotalRow_(line) && !inlineHolding) {
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
    if (inlineHolding) {
      currentSymbol = symbol;
      currentDescription = line;
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
    if (nums.ambiguous) {
      excluded.push({
        rowIndex: i + 1,
        reason: 'AMBIGUOUS_HOLDING_COLUMNS',
        symbol: symbol,
        line: line,
        errors: ['cost, market, and gain columns are ambiguous']
      });
      continue;
    }
    if (nums.invalidMarket) {
      excluded.push({
        rowIndex: i + 1,
        reason: 'INVALID_MARKET_VALUE',
        symbol: symbol,
        line: line,
        errors: ['market value is negative']
      });
      continue;
    }
    var errors = [];
    if (!isFinite(nums.quantity)) errors.push('quantity');
    if (!investmentEtradeClientStatementHasMoney_(nums.sharePrice)) errors.push('sharePrice');
    if (!investmentEtradeClientStatementHasMoney_(nums.marketValue)) errors.push('marketValue');
    if (investmentEtradeClientStatementHasMoney_(nums.marketValue) && nums.marketValue < 0) {
      errors.push('negativeMarketValue');
    }
    if (errors.length) {
      excluded.push({
        rowIndex: i + 1,
        reason: errors.indexOf('negativeMarketValue') >= 0 ? 'INVALID_MARKET_VALUE' : 'MALFORMED_TOTAL_ROW',
        symbol: symbol,
        line: line,
        errors: errors
      });
      continue;
    }
    if (seenSymbols[symbol]) {
      var existing = seenSymbols[symbol];
      var candidateGap = investmentEtradeClientStatementHoldingsRowAlignmentGap_({
        quantity: nums.quantity,
        sharePrice: nums.sharePrice,
        marketValue: nums.marketValue
      });
      var existingGap = investmentEtradeClientStatementHoldingsRowAlignmentGap_(existing);
      if (candidateGap + 0.01 < existingGap) {
        existing.rowIndex = i + 1;
        existing.securityDescription = currentDescription || existing.securityDescription || line;
        existing.quantity = nums.quantity;
        existing.sharePrice = nums.sharePrice;
        existing.totalCost = investmentEtradeClientStatementHasMoney_(nums.totalCost) ? nums.totalCost : null;
        existing.marketValue = nums.marketValue;
        existing.unrealizedGain = investmentEtradeClientStatementHasMoney_(nums.unrealizedGain)
          ? nums.unrealizedGain : null;
      }
      excluded.push({
        rowIndex: i + 1,
        reason: 'DUPLICATE_SYMBOL_TOTAL',
        symbol: symbol,
        line: line
      });
      continue;
    }
    var holdingRow = {
      rowIndex: i + 1,
      symbol: symbol,
      securityDescription: currentDescription || line,
      quantity: nums.quantity,
      sharePrice: nums.sharePrice,
      totalCost: investmentEtradeClientStatementHasMoney_(nums.totalCost) ? nums.totalCost : null,
      marketValue: nums.marketValue,
      unrealizedGain: investmentEtradeClientStatementHasMoney_(nums.unrealizedGain)
        ? nums.unrealizedGain : null
    };
    seenSymbols[symbol] = holdingRow;
    holdings.push(holdingRow);
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
  var cashDebit = investmentEtradeClientStatementHasMoney_(preamble.cashDebit) ? preamble.cashDebit : 0;
  var accruedInterest = investmentEtradeClientStatementHasMoney_(preamble.accruedInterest)
    ? preamble.accruedInterest : 0;
  var excludedBalanceSum = investmentEtradeClientStatementSumExcludedBalances_(preamble);
  var computedBase = Math.round((holdingsSum + cash - cashDebit) * 100) / 100;
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
    cashDebit: investmentEtradeClientStatementHasMoney_(preamble.cashDebit) ? cashDebit : null,
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

function investmentEtradeClientStatementNormalizePdfExtractText_(text) {
  return String(text || '')
    .replace(/[\u00A0\u202F\u2007\u2009\u200A\u2008\u2002\u2003\uFEFF]/g, ' ')
    .replace(/[\u2013\u2014\u2212\u2010\u2011]/g, '-');
}

function investmentEtradeClientStatementSlicePotentialSummarySection_(text) {
  text = investmentEtradeClientStatementNormalizePdfExtractText_(text);
  var headerMatch = text.match(
    /Exercisable\s+Value[\s\S]*?Potential\s+Value[\s\S]*?Total\s+Value/i);
  if (!headerMatch) return '';
  var rest = text.slice(headerMatch.index);
  var afterHeader = rest.slice(headerMatch[0].length);
  var grantHeading = afterHeader.search(/Potential\s+Restricted\s+Stock\b/i);
  var stop = afterHeader.search(
    /(?:^|\n)\s*(?:Grant\s+Detail|Grant\s+Date|Hypothetical\s+Plan\s+Value|Unvested\s+Stock(?:\s+Summary)?|Activity\s+Summary|Activity\s+Detail|Realized\s+Gains?\b|Terms\s+and\s+Conditions)\b/i
  );
  var cut = -1;
  if (grantHeading >= 0) cut = headerMatch[0].length + grantHeading;
  if (stop >= 0) {
    var stopAt = headerMatch[0].length + stop;
    if (cut < 0 || stopAt < cut) cut = stopAt;
  }
  if (cut > 0) rest = rest.slice(0, cut);
  return rest;
}

function investmentEtradeClientStatementHasPotentialSummaryHeaders_(text) {
  var compact = investmentEtradeClientStatementCompactText_(
    investmentEtradeClientStatementNormalizePdfExtractText_(text));
  var exercisable = compact.search(/Exercisable\s+Value/i);
  var potential = compact.search(/Potential\s+Value/i);
  var total = compact.search(/Total\s+Value/i);
  return exercisable >= 0 && potential > exercisable && total > potential;
}

function investmentEtradeClientStatementPotentialValueFromSummaryRow_(rowText) {
  var rest = investmentEtradeClientStatementNormalizePdfExtractText_(rowText)
    .replace(/^\s*TOTAL\s+VALUE\b/i, '');
  var money = rest.match(/\$\s*[\d,().\-]+/g) || [];
  if (money.length < 2) return null;
  var potentialRaw = money.length >= 3 ? money[1] : money[0];
  var value = investmentEtradeClientStatementSafeParseMoney_(potentialRaw);
  if (!investmentEtradeClientStatementHasMoney_(value)) return null;
  return round2_(Number(value));
}

function investmentEtradeClientStatementParsePotentialSummaryTableValue_(sectionText) {
  var section = investmentEtradeClientStatementNormalizePdfExtractText_(sectionText);
  if (!investmentEtradeClientStatementHasPotentialSummaryHeaders_(section)) return null;
  var headerMatch = section.match(
    /Exercisable\s+Value[\s\S]*?Potential\s+Value[\s\S]*?Total\s+Value/i);
  if (!headerMatch) return null;
  var afterHeaders = section.slice(headerMatch.index + headerMatch[0].length);
  var restrictedAt = afterHeaders.search(/(?:^|[\s])Restricted\s+Stock\b/i);
  if (restrictedAt < 0) return null;
  var afterRestricted = afterHeaders.slice(restrictedAt);
  var rowRe = /(?:^|[\s])TOTAL\s+VALUE\b/gi;
  var values = [];
  var rowMatch;
  while ((rowMatch = rowRe.exec(afterRestricted)) !== null) {
    var rowSlice = afterRestricted.slice(rowMatch.index, rowMatch.index + 220);
    var cut = rowSlice.search(
      /\n|Potential\s+Restricted\s+Stock|Grant\s+Date|Grant\s+Detail|Hypothetical\s+Plan\s+Value|Unvested\s+Stock|Activity\s+/i);
    if (cut > 12) rowSlice = rowSlice.slice(0, cut);
    var potential = investmentEtradeClientStatementPotentialValueFromSummaryRow_(rowSlice);
    if (!investmentEtradeClientStatementHasMoney_(potential)) continue;
    values.push(potential);
  }
  var unique = [];
  values.forEach(function(value) {
    if (unique.indexOf(value) === -1) unique.push(value);
  });
  if (unique.length !== 1) return null;
  return unique[0];
}

function investmentEtradeClientStatementParsePotentialUnvestedStockPlan_(lines) {
  var mapping = investmentEtradePotentialUnvestedStockPlanMapping_();
  var empty = {
    value: null,
    valueCategory: mapping.valueCategory,
    valueLabel: mapping.valueLabel,
    warning: mapping.warning
  };
  var text = (lines || []).join('\n');
  var section = investmentEtradeClientStatementSlicePotentialSummarySection_(text);
  var value = investmentEtradeClientStatementParsePotentialSummaryTableValue_(section);
  if (!investmentEtradeClientStatementHasMoney_(value)) return empty;
  return {
    value: round2_(Number(value)),
    valueCategory: mapping.valueCategory,
    valueLabel: mapping.valueLabel,
    warning: mapping.warning
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
  var potentialUnvestedStockPlan = investmentEtradeClientStatementParsePotentialUnvestedStockPlan_(lines);
  return {
    ok: true,
    preamble: preamble,
    holdings: holdingsResult.holdings,
    excluded: holdingsResult.excluded,
    accountKind: accountKind,
    reconciliation: reconciliation,
    potentialUnvestedStockPlan: potentialUnvestedStockPlan
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
    cashDebit: preamble.cashDebit,
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

function investmentEtradeNormalizePotentialUnvestedMonthlyPreview_(parseResult) {
  parseResult = parseResult || {};
  var mapping = investmentEtradePotentialUnvestedStockPlanMapping_();
  var preamble = parseResult.preamble || {};
  var potential = parseResult.potentialUnvestedStockPlan || {};
  var value = potential.value == null || potential.value === ''
    ? null
    : round2_(Number(potential.value));
  if (value != null && !isFinite(value)) value = null;
  var asOf = investmentEtradeClientStatementResolvePreambleAsOfDate_(preamble);
  if (!parseResult.ok) return parseResult;
  if (value == null) {
    return {
      ok: false,
      reviewRequired: true,
      source: mapping.source,
      error: 'Potential/unvested stock-plan value was not found on this E*TRADE statement.'
    };
  }
  if (!asOf) {
    return {
      ok: false,
      reviewRequired: true,
      source: mapping.source,
      error: 'Statement as-of date is required for the potential/unvested stock-plan value.'
    };
  }
  return {
    ok: true,
    reviewRequired: false,
    source: mapping.source,
    provider: 'ETRADE',
    importPurpose: mapping.valueCategory,
    valueCategory: mapping.valueCategory,
    valueLabel: mapping.valueLabel,
    warning: mapping.warning,
    accountName: mapping.accountName,
    parserVersion: parseResult.parserVersion || ETRADE_CLIENT_STATEMENT_PDF_PARSER_VERSION_,
    asOf: asOf,
    asOfDate: asOf,
    potentialUnvestedStockPlanValue: value,
    endingBalance: value,
    proposedValue: value,
    holdingsRows: [],
    cashBalance: null,
    totalAccountValue: null,
    capabilities: {
      activities: false,
      holdings: false,
      taxLots: false,
      accountSnapshot: false,
      dividendHistory: false,
      realizedGainLoss: false
    }
  };
}

function investmentEtradeValidateSamerBrokerageStatement_(parseResult) {
  parseResult = parseResult || {};
  var mapping = investmentEtradeSamerBrokerageAccountValueMapping_();
  var preamble = parseResult.preamble || {};
  var asOf = investmentEtradeClientStatementResolvePreambleAsOfDate_(preamble);
  if (!parseResult.ok) {
    return {
      ok: false,
      reviewRequired: true,
      source: mapping.source,
      error: parseResult.error || 'Could not parse this E*TRADE statement.'
    };
  }
  var periodEnd = investmentEtradeClientStatementNormalizeStatementDate_(
    preamble.statementPeriodEnd);
  if (!String(preamble.statementPeriodEnd || '').trim() || !periodEnd) {
    return {
      ok: false,
      reviewRequired: true,
      source: mapping.source,
      error: 'Statement period is missing or invalid, so the monthly investment value was skipped.'
    };
  }
  if (asOf && periodEnd !== asOf) {
    return {
      ok: false,
      reviewRequired: true,
      source: mapping.source,
      error: 'Statement period end and ending-total as-of date do not match.'
    };
  }
  if (!asOf) {
    return {
      ok: false,
      reviewRequired: true,
      source: mapping.source,
      error: 'Statement as-of date is required for Samer Etrade Account.'
    };
  }
  var ending = investmentEtradeCiscoStatementProfileResolveEndingTotal_(parseResult);
  if (ending == null) {
    return {
      ok: false,
      reviewRequired: true,
      source: mapping.source,
      error: 'Brokerage ending account value was not found on this E*TRADE statement.'
    };
  }
  return {
    ok: true,
    source: mapping.source,
    accountName: mapping.accountName,
    valueCategory: mapping.valueCategory,
    valueLabel: mapping.valueLabel,
    asOf: asOf,
    ending: ending
  };
}

function investmentEtradeAttachSamerBrokeragePreviewContract_(preview, parseResult, accountName) {
  if (typeof investmentEtradeMatchesSamerBrokerageAccountValueMapping_ !== 'function' ||
      !investmentEtradeMatchesSamerBrokerageAccountValueMapping_(accountName, 'ETRADE_CLIENT_STATEMENT_PDF')) {
    return preview;
  }
  var validated = investmentEtradeValidateSamerBrokerageStatement_(parseResult);
  if (!validated.ok) return validated;
  preview = preview || {};
  preview.accountName = validated.accountName;
  preview.valueCategory = validated.valueCategory;
  preview.valueLabel = validated.valueLabel;
  preview.asOf = validated.asOf;
  preview.asOfDate = validated.asOf;
  preview.endingTotalValue = validated.ending;
  preview.endingBalance = validated.ending;
  preview.proposedValue = validated.ending;
  if (preview.totalAccountValue == null) preview.totalAccountValue = validated.ending;
  return preview;
}

function investmentEtradeCiscoStatementProfileResolveEndingTotal_(parseResult) {
  parseResult = parseResult || {};
  var recon = parseResult.reconciliation || {};
  var preamble = parseResult.preamble || {};
  var ending = recon.endingTotalValue;
  if (!investmentEtradeClientStatementHasMoney_(ending)) {
    ending = preamble.endingTotalValue;
  }
  if (!investmentEtradeClientStatementHasMoney_(ending)) return null;
  return round2_(Number(ending));
}

function investmentEtradeNormalizeCiscoStatementProfilePreview_(parseResult) {
  parseResult = parseResult || {};
  var profile = investmentEtradeCiscoStatementImportProfile_();
  var brokerage = investmentEtradeCiscoBrokerageAccountValueMapping_();
  var potentialMapping = investmentEtradePotentialUnvestedStockPlanMapping_();
  if (!parseResult.ok) return parseResult;
  var asOf = investmentEtradeClientStatementResolvePreambleAsOfDate_(parseResult.preamble);
  if (!asOf) {
    return {
      ok: false,
      reviewRequired: true,
      source: profile.source,
      importProfile: 'ETRADE_CISCO_STATEMENT',
      error: 'Statement as-of date is required for the E*TRADE Cisco statement.'
    };
  }
  var brokerageValue = investmentEtradeCiscoStatementProfileResolveEndingTotal_(parseResult);
  if (brokerageValue == null) {
    return {
      ok: false,
      reviewRequired: true,
      source: profile.source,
      importProfile: 'ETRADE_CISCO_STATEMENT',
      error: 'Brokerage ending account value was not found on this E*TRADE statement.'
    };
  }
  var potentialPreview = investmentEtradeNormalizePotentialUnvestedMonthlyPreview_(parseResult);
  if (!potentialPreview || !potentialPreview.ok) {
    return {
      ok: false,
      reviewRequired: true,
      source: profile.source,
      importProfile: 'ETRADE_CISCO_STATEMENT',
      error: (potentialPreview && potentialPreview.error) ||
        'Potential/unvested stock-plan value was not found on this E*TRADE statement.'
    };
  }
  var potentialValue = potentialPreview.potentialUnvestedStockPlanValue;
  return {
    ok: true,
    reviewRequired: false,
    source: profile.source,
    provider: 'ETRADE',
    importProfile: 'ETRADE_CISCO_STATEMENT',
    pickerKind: profile.pickerKind,
    pickerValue: profile.pickerValue,
    pickerLabel: profile.pickerLabel,
    parserVersion: parseResult.parserVersion || ETRADE_CLIENT_STATEMENT_PDF_PARSER_VERSION_,
    asOf: asOf,
    asOfDate: asOf,
    endingTotalValue: brokerageValue,
    potentialUnvestedStockPlanValue: potentialValue,
    holdingsRows: [],
    cashBalance: null,
    totalAccountValue: null,
    capabilities: {
      activities: false,
      holdings: false,
      taxLots: false,
      accountSnapshot: false,
      dividendHistory: false,
      realizedGainLoss: false
    },
    monthlyLegs: [
      {
        accountName: brokerage.accountName,
        valueCategory: brokerage.valueCategory,
        valueLabel: brokerage.valueLabel,
        valueOrigin: 'ENDING_TOTAL_VALUE',
        warning: '',
        proposedValue: brokerageValue
      },
      {
        accountName: potentialMapping.accountName,
        valueCategory: potentialMapping.valueCategory,
        valueLabel: potentialMapping.valueLabel,
        valueOrigin: 'POTENTIAL_UNVESTED_STOCK_PLAN',
        warning: potentialMapping.warning,
        proposedValue: potentialValue
      }
    ]
  };
}
