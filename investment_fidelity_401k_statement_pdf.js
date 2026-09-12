/**
 * Fidelity NetBenefits 401(k) Retirement Savings Statement PDF — preview-only parser.
 *
 * Parses PDF text extracts into read-only BALANCE_SNAPSHOT previews.
 * No persistence, logging of private statement content, or workbook writes.
 */

var FIDELITY_401K_STATEMENT_PDF_PARSER_VERSION_ = 'fidelity-401k-statement-pdf-v1';

var FIDELITY_401K_STATEMENT_REQUIRED_MARKERS_ = [
  /Retirement\s+Savings\s+Statement/i,
  /Your\s+Account\s+Summary/i,
  /Statement\s+Period/i,
  /Ending\s+Balance/i,
  /Vested\s+Balance/i
];

var FIDELITY_401K_STATEMENT_SUMMARY_LABELS_ = [
  { key: 'beginningBalance', label: 'Beginning Balance' },
  { key: 'employeeContributions', label: 'Employee Contributions' },
  { key: 'employerContributions', label: 'Employer Contributions' },
  { key: 'fees', label: 'Fees' },
  { key: 'changeInMarketValue', label: 'Change in Market Value' },
  { key: 'endingBalance', label: 'Ending Balance' },
  { key: 'vestedBalance', label: 'Vested Balance' },
  { key: 'dividendsAndInterest', label: 'Dividends & Interest' }
];

function investmentFidelity401kStatementNormalizeText_(raw) {
  return String(raw || '')
    .replace(/[\uE000-\uF8FF]/g, ' ')
    .replace(/\uFFFD/g, '')
    .replace(/\f/g, '\n')
    .replace(/[\u00A0\u2000-\u200B]/g, ' ')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');
}

function investmentFidelity401kStatementCompactText_(text) {
  return String(text || '')
    .replace(/\|/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function investmentFidelity401kStatementLooksEncodingCorrupt_(text) {
  text = String(text || '');
  if (!text.trim()) return false;
  var sample = text.slice(0, 8000);
  var badChars = (sample.match(/[\uFFFD\uE000-\uF8FF]/g) || []).length;
  if (badChars / sample.length > 0.02) return true;
  var letters = (sample.match(/[A-Za-z]/g) || []).length;
  return sample.length > 2000 && letters / sample.length < 0.08;
}

function investmentFidelity401kStatementHasRequiredMarkers_(compact) {
  compact = String(compact || '');
  for (var i = 0; i < FIDELITY_401K_STATEMENT_REQUIRED_MARKERS_.length; i += 1) {
    if (!FIDELITY_401K_STATEMENT_REQUIRED_MARKERS_[i].test(compact)) return false;
  }
  return true;
}

function investmentFidelity401kStatementLooksLikeWrongDocument_(compact) {
  compact = String(compact || '');
  if (/M1:|Finance Super App|Total account value \/ 1-month change/i.test(compact)) return true;
  if (/Symbol\s*\/\s*CUSIP/i.test(compact) && /Refresh:/i.test(compact)) return true;
  if (/Activity Date/i.test(compact) && /Trans Code/i.test(compact)) return true;
  if (/Security\s+Description\s+Quantity\s+Share\s+Price/i.test(compact) &&
      /Ending\s+Total\s+Value/i.test(compact)) {
    return true;
  }
  return false;
}

/**
 * @param {string} text
 * @returns {{documentType: string, confidence: string, reason: string, usable: boolean}}
 */
function investmentFidelity401kStatementClassifyDocumentType_(text) {
  text = String(text || '');
  if (!text.trim()) {
    return {
      documentType: 'UNKNOWN',
      confidence: 'LOW',
      reason: 'No PDF text extracted.',
      usable: false
    };
  }
  if (investmentFidelity401kStatementLooksEncodingCorrupt_(text)) {
    return {
      documentType: 'FIDELITY_401K_STATEMENT_PDF',
      confidence: 'LOW',
      reason: 'Extracted text appears encoding-corrupt.',
      usable: false
    };
  }
  var compact = investmentFidelity401kStatementCompactText_(text);
  if (investmentFidelity401kStatementLooksLikeWrongDocument_(compact)) {
    return {
      documentType: 'UNKNOWN',
      confidence: 'HIGH',
      reason: 'Document does not match a Fidelity retirement savings statement.',
      usable: false
    };
  }
  if (investmentFidelity401kStatementHasRequiredMarkers_(compact)) {
    return {
      documentType: 'FIDELITY_401K_STATEMENT_PDF',
      confidence: 'HIGH',
      reason: 'Fidelity retirement savings statement markers detected.',
      usable: true
    };
  }
  if (/Retirement\s+Savings\s+Statement/i.test(compact) &&
      /NetBenefits|Fidelity/i.test(compact)) {
    return {
      documentType: 'FIDELITY_401K_STATEMENT_PDF',
      confidence: 'MEDIUM',
      reason: 'Partial Fidelity retirement statement markers detected.',
      usable: false
    };
  }
  return {
    documentType: 'UNKNOWN',
    confidence: 'LOW',
    reason: 'Missing Fidelity retirement savings statement structure.',
    usable: false
  };
}

function investmentFidelity401kStatementDetect_(input) {
  input = input || {};
  var text = String(input.rawDocumentText || input.rawStatementText || input.text || '').trim();
  if (!text && input.files && input.files.length) {
    text = String(input.files[0].content || '').trim();
  }
  if (!text) {
    return { ok: false, reason: 'No Fidelity 401(k) statement text supplied.' };
  }
  var classification = investmentFidelity401kStatementClassifyDocumentType_(text);
  if (classification.documentType !== 'FIDELITY_401K_STATEMENT_PDF') {
    return {
      ok: false,
      reason: classification.reason || 'Document is not a Fidelity retirement savings statement.'
    };
  }
  if (!classification.usable) {
    return {
      ok: false,
      reason: classification.reason || 'Fidelity retirement savings statement structure mismatch.'
    };
  }
  return {
    ok: true,
    source: 'FIDELITY_401K_STATEMENT_PDF',
    provider: 'FIDELITY',
    documentType: classification.documentType,
    confidence: classification.confidence
  };
}

function investmentFidelity401kStatementParseMoney_(value) {
  if (typeof parseInvestmentImportMoney_ === 'function') {
    return parseInvestmentImportMoney_(value);
  }
  var raw = String(value || '').replace(/[$,\s]/g, '').trim();
  if (!raw) return null;
  var negative = raw.charAt(0) === '(' && raw.charAt(raw.length - 1) === ')';
  raw = raw.replace(/[()]/g, '');
  if (raw.charAt(0) === '-') {
    negative = true;
    raw = raw.slice(1);
  }
  var amount = Number(raw);
  if (!isFinite(amount)) return null;
  return negative ? -amount : amount;
}

function investmentFidelity401kStatementParseSummaryMoneyAfterLabel_(compact, label) {
  compact = String(compact || '');
  label = String(label || '').trim();
  if (!label) return null;
  var escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  var pattern = new RegExp(escaped + '\\s+(-?\\$?[\\d,]+\\.\\d{2})', 'i');
  var match = compact.match(pattern);
  if (!match) return null;
  return investmentFidelity401kStatementParseMoney_(match[1]);
}

function investmentFidelity401kStatementParseStatementPeriod_(compact) {
  compact = String(compact || '');
  var match = compact.match(
    /Statement\s+Period:\s*(\d{2}\/\d{2}\/\d{4})\s+to\s+(\d{2}\/\d{2}\/\d{4})/i);
  if (!match) return { start: '', end: '' };
  return {
    start: typeof normalizeInvestmentImportDate_ === 'function'
      ? normalizeInvestmentImportDate_(match[1]) : match[1],
    end: typeof normalizeInvestmentImportDate_ === 'function'
      ? normalizeInvestmentImportDate_(match[2]) : match[2]
  };
}

function investmentFidelity401kStatementExtractAccountSummarySection_(compact) {
  compact = String(compact || '');
  var start = compact.search(/Your\s+Account\s+Summary/i);
  if (start < 0) return compact;
  var end = compact.search(/Additional\s+Information/i);
  if (end < 0) end = compact.search(/Your\s+Personal\s+Rate\s+of\s+Return/i);
  if (end < 0) end = compact.search(/Your\s+Asset\s+Allocation/i);
  if (end < 0 || end <= start) return compact.slice(start);
  return compact.slice(start, end);
}

function investmentFidelity401kStatementParseSummaryFields_(compact) {
  var summarySection = investmentFidelity401kStatementExtractAccountSummarySection_(compact);
  var additionalSection = '';
  var additionalStart = compact.search(/Additional\s+Information/i);
  if (additionalStart >= 0) {
    var additionalEnd = compact.search(/Your\s+Personal\s+Rate\s+of\s+Return/i);
    additionalSection = additionalEnd > additionalStart
      ? compact.slice(additionalStart, additionalEnd)
      : compact.slice(additionalStart, additionalStart + 500);
  }
  var parsed = {
    beginningBalance: null,
    employeeContributions: null,
    employerContributions: null,
    fees: null,
    changeInMarketValue: null,
    endingBalance: null,
    vestedBalance: null,
    dividendsAndInterest: null
  };
  FIDELITY_401K_STATEMENT_SUMMARY_LABELS_.forEach(function(entry) {
    var value = investmentFidelity401kStatementParseSummaryMoneyAfterLabel_(
      summarySection, entry.label);
    if (value == null && (entry.key === 'vestedBalance' || entry.key === 'dividendsAndInterest')) {
      value = investmentFidelity401kStatementParseSummaryMoneyAfterLabel_(
        additionalSection, entry.label);
    }
    parsed[entry.key] = value;
  });
  return parsed;
}

function investmentFidelity401kStatementParseFundHoldings_(compact) {
  compact = String(compact || '');
  var holdings = [];
  var tierPattern = /(ACTIVE TIER|PASSIVE TIER)/gi;
  var tierMatch;
  var seen = Object.create(null);
  while ((tierMatch = tierPattern.exec(compact)) !== null) {
    var tier = String(tierMatch[1] || '').trim();
    var slice = compact.slice(tierMatch.index, tierMatch.index + 2500);
    var rowPattern = /([A-Za-z][A-Za-z0-9 .\/&-]{2,40}?)\s+([\d,]+\.\d{3})\s+\$([\d,]+\.\d{2,4})\s+\$([\d,]+\.\d{2})/g;
    var rowMatch;
    while ((rowMatch = rowPattern.exec(slice)) !== null) {
      var name = String(rowMatch[1] || '').replace(/\s+/g, ' ').trim();
      if (!name || /^(Investment|Stock|Bond|Income|International|Large Cap|Mid-Cap)$/i.test(name)) {
        continue;
      }
      var marketValue = investmentFidelity401kStatementParseMoney_(rowMatch[4]);
      if (marketValue == null || marketValue <= 0) continue;
      var key = tier + '|' + name.toLowerCase();
      if (seen[key]) continue;
      seen[key] = true;
      holdings.push({
        tier: tier,
        fundName: name,
        shares: Number(String(rowMatch[2] || '').replace(/,/g, '')) || 0,
        price: investmentFidelity401kStatementParseMoney_(rowMatch[3]),
        marketValue: round2_(marketValue)
      });
    }
  }
  return holdings;
}

function investmentFidelity401kStatementValidateParsedSummary_(summary, period) {
  summary = summary || {};
  period = period || {};
  if (!period.end) {
    return { ok: false, error: 'Could not parse statement period end date.' };
  }
  if (summary.endingBalance == null || !isFinite(Number(summary.endingBalance))) {
    return { ok: false, error: 'Missing or invalid Ending Balance on retirement savings statement.' };
  }
  return { ok: true };
}

function investmentFidelity401kStatementBuildPreview_(text) {
  text = investmentFidelity401kStatementNormalizeText_(text);
  var compact = investmentFidelity401kStatementCompactText_(text);
  var period = investmentFidelity401kStatementParseStatementPeriod_(compact);
  var summary = investmentFidelity401kStatementParseSummaryFields_(compact);
  var validation = investmentFidelity401kStatementValidateParsedSummary_(summary, period);
  if (!validation.ok) {
    return {
      ok: false,
      reviewRequired: true,
      source: 'FIDELITY_401K_STATEMENT_PDF',
      error: validation.error
    };
  }
  var fundHoldings = investmentFidelity401kStatementParseFundHoldings_(compact);
  return {
    ok: true,
    reviewRequired: false,
    source: 'FIDELITY_401K_STATEMENT_PDF',
    provider: 'FIDELITY',
    importPurpose: 'BALANCE_SNAPSHOT',
    accountType: 'RETIREMENT',
    parserVersion: FIDELITY_401K_STATEMENT_PDF_PARSER_VERSION_,
    preview: {
      documentType: 'FIDELITY_401K_RETIREMENT_SAVINGS_STATEMENT',
      asOfDate: period.end,
      statementPeriodStart: period.start,
      statementPeriodEnd: period.end,
      endingBalance: round2_(Number(summary.endingBalance)),
      vestedBalance: summary.vestedBalance == null ? null : round2_(Number(summary.vestedBalance)),
      summary: {
        beginningBalance: summary.beginningBalance == null
          ? null : round2_(Number(summary.beginningBalance)),
        employeeContributions: summary.employeeContributions == null
          ? null : round2_(Number(summary.employeeContributions)),
        employerContributions: summary.employerContributions == null
          ? null : round2_(Number(summary.employerContributions)),
        fees: summary.fees == null ? null : round2_(Number(summary.fees)),
        changeInMarketValue: summary.changeInMarketValue == null
          ? null : round2_(Number(summary.changeInMarketValue)),
        dividendsAndInterest: summary.dividendsAndInterest == null
          ? null : round2_(Number(summary.dividendsAndInterest))
      },
      fundHoldings: fundHoldings,
      fundHoldingsComplete: fundHoldings.length > 0,
      ocrRequired: false
    }
  };
}

function investmentFidelity401kStatementPreviewFromText_(text) {
  var detection = investmentFidelity401kStatementDetect_({ rawDocumentText: text });
  if (!detection.ok) {
    return {
      ok: false,
      reviewRequired: true,
      source: 'FIDELITY_401K_STATEMENT_PDF',
      error: detection.reason
    };
  }
  return investmentFidelity401kStatementBuildPreview_(text);
}

function investmentFidelity401kStatementPreview_(input) {
  input = input || {};
  var text = String(input.rawDocumentText || input.rawStatementText || input.text || '').trim();
  if (!text && input.files && input.files.length) {
    text = String(input.files[0].content || '').trim();
  }
  if (!text) {
    return {
      ok: false,
      reviewRequired: true,
      source: 'FIDELITY_401K_STATEMENT_PDF',
      error: 'No Fidelity 401(k) statement text supplied.'
    };
  }
  return investmentFidelity401kStatementPreviewFromText_(text);
}

function investmentAdapterDetectFidelity401kStatementPdf_(input) {
  return investmentFidelity401kStatementDetect_(input);
}
