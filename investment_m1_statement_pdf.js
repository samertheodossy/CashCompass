/**
 * M1 Finance monthly Brokerage Statement PDF — preview-only text parser.
 *
 * Parses PDF text extracts into PORTFOLIO_INTELLIGENCE_HOLDINGS_V1 previews.
 * No persistence, logging of private statement content, or workbook writes.
 */

var M1_STATEMENT_PDF_PARSER_VERSION_ = 'm1-statement-pdf-v3';

function investmentM1NormalizeStatementText_(raw) {
  return String(raw || '')
    .replace(/[\uE000-\uF8FF]/g, '/')
    .replace(/\uFFFD/g, '')
    .replace(/\f/g, '\n')
    .replace(/[\u00A0\u2000-\u200B]/g, ' ')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');
}

function investmentM1HasCharacterSpacedLayout_(text) {
  var sample = String(text || '').slice(0, 5000).replace(/\s+/g, ' ').trim();
  if (!sample) return false;
  var tokens = sample.split(' ').filter(function(token) {
    return token.length > 0;
  });
  if (tokens.length < 20) return false;
  var singleCharCount = tokens.filter(function(token) {
    return token.length === 1;
  }).length;
  return singleCharCount / tokens.length >= 0.55;
}

function investmentM1RepairCharacterSpacedGroup_(group) {
  var tokens = String(group || '').replace(/\s+/g, ' ').trim().split(' ').filter(function(token) {
    return token.length > 0;
  });
  if (!tokens.length) return '';
  if (tokens.length === 1) return tokens[0];
  var singleCharCount = tokens.filter(function(token) {
    return token.length === 1;
  }).length;
  if (singleCharCount / tokens.length >= 0.55) {
    return tokens.join('');
  }
  return tokens.join(' ');
}

function investmentM1SplitGluedStatementTokens_(text) {
  return String(text || '')
    .replace(/([A-Za-z%-])(\$[\d,.()\-])/g, '$1 $2')
    .replace(/([A-Za-z])(Statement period:)/gi, '$1\n$2')
    .replace(/(\d{4})(Account number:)/gi, '$1\n$2')
    .replace(/([A-Za-z0-9%)])(Account breakdown)/gi, '$1\n$2')
    .replace(/([A-Za-z0-9%)])(Activity summary)/gi, '$1\n$2')
    .replace(/([A-Za-z0-9%)])(Statement for account\/)/gi, '$1\n$2')
    .replace(/([A-Za-z0-9%)])(Financial instrument information)/gi, '$1\n$2')
    .replace(/([A-Za-z0-9%)])(Total portfolio)/gi, '$1\n$2')
    .replace(/([A-Za-z0-9%)])(Symbol Quantity Price Market value)/gi, '$1\n$2');
}

function investmentM1RepairSpacedMoneyInLine_(line) {
  line = String(line || '');
  line = line.replace(/\$[\d\s,().%-]+/g, function(segment) {
    var tokens = segment.replace(/\s+/g, ' ').trim().split(' ').filter(function(token) {
      return token.length > 0;
    });
    if (tokens.length < 2) return segment;
    var singleCharCount = tokens.filter(function(token) {
      return token.length === 1;
    }).length;
    if (singleCharCount / tokens.length >= 0.45) {
      return tokens.join('');
    }
    return segment;
  });
  line = line.replace(/\(\s*\$[\d\s,().%-]+\s*\)/g, function(segment) {
    var inner = segment.replace(/^\(\s*/, '').replace(/\s*\)$/, '');
    return '(' + investmentM1RepairSpacedMoneyInLine_(inner) + ')';
  });
  line = line.replace(/\[\s*[\d\s.]+\s*%\s*\]/g, function(segment) {
    var tokens = segment.replace(/[\[\]%]/g, ' ').replace(/\s+/g, ' ').trim().split(' ')
      .filter(function(token) { return token.length > 0; });
    if (tokens.length < 2) return segment;
    var singleCharCount = tokens.filter(function(token) {
      return token.length === 1;
    }).length;
    if (singleCharCount / tokens.length >= 0.45) {
      return '[' + tokens.join('') + '%]';
    }
    return segment;
  });
  return line;
}

function investmentM1RepairCharacterSpacedLine_(line) {
  line = investmentM1RepairSpacedMoneyInLine_(String(line || ''));
  var repaired = line.split(/\s{2,}/).map(investmentM1RepairCharacterSpacedGroup_).join(' ');
  return investmentM1SplitGluedStatementTokens_(repaired);
}

function investmentM1RepairCharacterSpacedText_(text) {
  text = String(text || '');
  if (!investmentM1HasCharacterSpacedLayout_(text)) {
    return text.split('\n').map(investmentM1RepairSpacedLetters_).join('\n');
  }
  return text.split('\n').map(function(line) {
    if (!String(line || '').trim()) return line;
    return investmentM1RepairCharacterSpacedLine_(line);
  }).join('\n');
}

function investmentM1ReflowStatementSections_(text) {
  text = String(text || '');
  if (!text) return text;
  var markers = [
    'Financial instrument information',
    'Symbol Quantity Price Market value Cost basis Unrealized P/L',
    'Symbol Quantity Price Market value',
    'Statement for account/',
    'Total account value / 1-month change',
    'Account breakdown',
    'Activity summary',
    'Statement period:',
    'Account number:',
    'Account type:',
    'Account title:',
    'Address:',
    'Account value',
    'Terms and conditions',
    'M1: The Finance Super App'
  ];
  markers.sort(function(a, b) {
    return b.length - a.length;
  });
  markers.forEach(function(marker) {
    var escaped = marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
    var prefix = marker.toLowerCase() === 'account value' ? '(?<!Total )' : '';
    var re = new RegExp('(^|[^\\n])(' + prefix + escaped + ')', 'gi');
    text = text.replace(re, '$1\n$2');
  });
  text = text.replace(/(^|[^\n])(Account breakdown)(Cash(?:\s|\$|\.))/gi, '$1\n$2\n$3');
  text = text.replace(/Account breakdown\s+(Cash|Equities|Total portfolio)/gi, 'Account breakdown\n$1');
  text = text.replace(/Account breakdown(?=Cash|Equities|Total portfolio)/gi, 'Account breakdown\n');
  text = text.replace(/(\$[\d,.()\-]+)(Equities(?:\s|\$))/gi, '$1\n$2');
  text = text.replace(/(\$[\d,.()\-]+)(Total portfolio(?:\s|\$))/gi, '$1\n$2');
  text = text.replace(/(^|[^\n])(Cash\s+\$[\d,.()\-]+(?:\s+\$[\d,.()\-]+){1,2})(Equities\s)/gi, '$1\n$2\n$3');
  text = text.replace(/(^|[^\n])(Equities\s+\$[\d,.()\-]+(?:\s+\$[\d,.()\-]+){1,2})(Total portfolio\s)/gi,
    '$1\n$2\n$3');
  text = text.replace(/(^|[^\n])((?:Total portfolio))(\s+\$)/gi, '$1\n$2$3');
  text = text.replace(/(^|[^\n])((?:Unrealized P\/L))(\s*)([A-Z][A-Z0-9.\-]{0,5}\s)/gi, '$1\n$2\n$4');
  text = text.replace(/(^|[^\n])((?:Total portfolio))(\s*(?:Symbol|[A-Z][A-Z0-9.\-]{0,5}\s+[\d($]))/gi,
    '$1\n$2\n$3');
  text = text.replace(/(\$[\d,.()\-]+)(\s*)([A-Z][A-Z0-9.\-]{0,5}\s+[\d(.])/g, '$1\n$3');
  text = text.replace(/(^|[^\n])(Account:\s+(?!number\b))/gi, '$1\n$2');
  text = text.replace(/(^|[^\n])(Type:\s)/gi, '$1\n$2');
  text = text.replace(/\n{2,}/g, '\n');
  return text;
}

function investmentM1RepairSpacedLetters_(line) {
  var text = String(line || '').replace(/\s+/g, ' ').trim();
  if (!text) return text;
  var tokens = text.split(' ');
  if (tokens.length < 4) return text;
  var singleCharCount = tokens.filter(function(token) {
    return token.length === 1;
  }).length;
  if (singleCharCount / tokens.length < 0.55) return text;
  return tokens.join('');
}

function investmentM1MergeWrappedLabelLines_(lines) {
  lines = lines || [];
  var merged = [];
  for (var i = 0; i < lines.length; i += 1) {
    var line = String(lines[i] || '').trim();
    var next = String(lines[i + 1] || '').trim();
    if (!line) continue;
    if (/^Statement period:?\s*$/i.test(line) && next) {
      merged.push('Statement period: ' + next);
      i += 1;
      continue;
    }
    if (/^(Account type|Account number|Account title|Account):?\s*$/i.test(line) && next && !/:/.test(next)) {
      merged.push(line.replace(/:?\s*$/, ': ') + next);
      i += 1;
      continue;
    }
    if (/^Total account value\s*\/\s*1-month change\s*$/i.test(line) && next) {
      merged.push(next);
      i += 1;
      continue;
    }
    merged.push(line);
  }
  return merged;
}

function investmentM1ExtractBreakdownMoneyValues_(cells) {
  var values = [];
  (cells || []).forEach(function(cell, index) {
    if (index === 0) return;
    var value = investmentM1SafeParseMoney_(cell);
    if (investmentM1HasMoney_(value)) values.push(value);
  });
  return values;
}

function investmentM1SelectBreakdownCurrentPeriod_(moneyValues) {
  moneyValues = moneyValues || [];
  if (!moneyValues.length) return NaN;
  // M1 breakdown columns are Last period | Current period | Change.
  // With three money cells, current period is the middle value — never the change column.
  if (moneyValues.length >= 3) return moneyValues[1];
  // With two money cells, the second is usually change ($0.00) — keep the first value.
  if (moneyValues.length === 2) return moneyValues[0];
  return moneyValues[0];
}

function investmentM1ApplyBreakdownRowCells_(preamble, cells) {
  preamble = preamble || {};
  cells = cells || [];
  for (var i = 0; i < cells.length; i += 1) {
    var label = String(cells[i] || '').trim();
    if (!/^(cash|equities|total portfolio)$/i.test(label)) continue;
    var rowCells = cells.slice(i);
    var currentPeriodValue = investmentM1SelectBreakdownCurrentPeriod_(
      investmentM1ExtractBreakdownMoneyValues_(rowCells));
    if (!investmentM1HasMoney_(currentPeriodValue)) continue;
    if (/^cash$/i.test(label)) {
      preamble.cashBalance = currentPeriodValue;
    } else if (/^equities$/i.test(label)) {
      preamble.equitiesSubtotal = currentPeriodValue;
    } else if (/^total portfolio$/i.test(label)) {
      preamble.totalPortfolioSubtotal = currentPeriodValue;
    }
  }
  return preamble;
}

function investmentM1ExpandGluedBreakdownLines_(lines) {
  var expanded = [];
  (lines || []).forEach(function(line) {
    var text = String(line || '').trim();
    if (!text) return;
    text = text.replace(/Account breakdown\s+(Cash|Equities|Total portfolio)/gi, 'Account breakdown\n$1');
    text = text.replace(/Account breakdown(?=Cash|Equities|Total portfolio)/gi, 'Account breakdown\n');
    text = text.replace(/(\$[\d,.()\-]+)(Equities(?:\s|\$))/gi, '$1\n$2');
    text = text.replace(/(\$[\d,.()\-]+)(Total portfolio(?:\s|\$))/gi, '$1\n$2');
    text.split('\n').forEach(function(part) {
      var trimmed = String(part || '').trim();
      if (trimmed) expanded.push(trimmed);
    });
  });
  return expanded;
}

function investmentM1RecoverBreakdownFromGluedText_(text, preamble) {
  preamble = preamble || {};
  text = String(text || '');
  var rows = [
    { field: 'cashBalance', label: 'Cash' },
    { field: 'equitiesSubtotal', label: 'Equities' },
    { field: 'totalPortfolioSubtotal', label: 'Total portfolio' }
  ];
  rows.forEach(function(row) {
    if (investmentM1HasMoney_(preamble[row.field])) return;
    var re = new RegExp(row.label + '\\s*(.+)$', 'im');
    var match = text.match(re);
    if (!match) return;
    var cells = investmentM1TokenizeTabularStatementRow_(row.label + ' ' + match[1]);
    if (!cells || cells.length < 2) return;
    var currentValue = investmentM1SelectBreakdownCurrentPeriod_(
      investmentM1ExtractBreakdownMoneyValues_(cells));
    if (investmentM1HasMoney_(currentValue)) preamble[row.field] = currentValue;
  });
  return preamble;
}

function investmentM1PrepareStatementTextForParsing_(rawText) {
  var text = investmentM1NormalizeStatementText_(rawText);
  var characterSpaced = investmentM1HasCharacterSpacedLayout_(text);
  text = investmentM1RepairCharacterSpacedText_(text);
  text = investmentM1ReflowStatementSections_(text);
  var lines = text.split('\n').map(function(line) {
    if (characterSpaced) {
      return investmentM1RepairCharacterSpacedLine_(line);
    }
    return investmentM1RepairSpacedLetters_(line);
  });
  lines = investmentM1MergeWrappedLabelLines_(lines);
  lines = lines.filter(function(line) {
    var trimmed = String(line || '').trim();
    if (!trimmed) return false;
    if (/^--\s*\d+\s+of\s+\d+\s*--$/i.test(trimmed)) return false;
    if (/^Page\s+\d+\s+of\s+\d+/i.test(trimmed)) return false;
    return true;
  });
  return lines.join('\n');
}

function investmentM1CompactStatementTextForMatching_(text) {
  return String(text || '')
    .replace(/\|/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function investmentM1AssessStatementLayout_(text) {
  text = String(text || '');
  var compact = investmentM1CompactStatementTextForMatching_(text);
  var markers = {
    statementPeriod: /Statement period\s*:\s*\d{1,2}\/\d{1,2}\/\d{4}/i.test(compact),
    accountNumber: /Account number\s*:\s*XXXX\d+/i.test(compact),
    accountBreakdown: /Account breakdown/i.test(compact),
    accountValue: /Account value|Total account value/i.test(compact),
    holdingsHeader: /Symbol\s+Quantity\s+Price\s+Market value/i.test(compact),
    totalPortfolio: /Total portfolio/i.test(compact),
    instrumentHeader: /Symbol\s+Share class\s+Description\s+Exchange/i.test(compact),
    m1Finance: /M1 Finance|M1:\s/i.test(compact)
  };
  var missing = [];
  if (!markers.statementPeriod) missing.push('Statement period');
  if (!markers.holdingsHeader && !(markers.totalPortfolio && /Symbol\s+[A-Z0-9]{1,5}\s+/i.test(compact))) {
    missing.push('holdings table header (Symbol, Quantity, Price, Market value)');
  }
  var confirmCount = Number(!!markers.totalPortfolio) + Number(!!markers.accountNumber) +
    Number(!!markers.m1Finance) + Number(!!markers.accountBreakdown) +
    Number(!!markers.accountValue) + Number(!!markers.instrumentHeader);
  if (missing.length) {
    return {
      ok: false,
      error: 'File does not match M1 brokerage statement layout. Missing required marker(s): ' +
        missing.join(', ') + '.'
    };
  }
  if (confirmCount < 1) {
    return {
      ok: false,
      error: 'File does not match M1 brokerage statement layout. Missing M1 confirmatory marker(s): ' +
        'Account breakdown, Account value, Account number, Total portfolio, instrument table, or M1 Finance disclosure.'
    };
  }
  return { ok: true, markers: markers };
}

function investmentM1SuggestRegistrationTypeFromStatement_(rawText) {
  var text = String(rawText || '');
  if (!text.trim()) {
    return { suggested: '', confidence: 'LOW', source: '' };
  }
  var prepared = investmentM1PrepareStatementTextForParsing_(text);
  var upper = prepared.replace(/\s+/g, ' ').toUpperCase();
  if (/\bROTH\s+IRA\b/.test(upper)) {
    return { suggested: 'ROTH_IRA', confidence: 'HIGH', source: 'STATEMENT_LABEL' };
  }
  if (/\bSEP\s+IRA\b/.test(upper)) {
    return { suggested: 'TRADITIONAL_IRA', confidence: 'HIGH', source: 'STATEMENT_LABEL' };
  }
  if (/\bTRADITIONAL\s+IRA\b/.test(upper)) {
    return { suggested: 'TRADITIONAL_IRA', confidence: 'HIGH', source: 'STATEMENT_LABEL' };
  }
  if (/\b401\s*\(\s*K\s*\)\b/.test(upper) || /\b401K\b/.test(upper)) {
    return { suggested: '401K', confidence: 'HIGH', source: 'STATEMENT_LABEL' };
  }
  if (/\bHSA\b/.test(upper) && /\bHEALTH\s+SAVINGS\b/.test(upper)) {
    return { suggested: 'HSA', confidence: 'HIGH', source: 'STATEMENT_LABEL' };
  }
  if (/\bIRA\b/.test(upper) && !/\bROTH\b/.test(upper)) {
    return { suggested: 'TRADITIONAL_IRA', confidence: 'MEDIUM', source: 'STATEMENT_LABEL' };
  }
  var layout = investmentM1AssessStatementLayout_(prepared);
  if (layout.ok && !/\b(ROTH|TRADITIONAL|SEP|401|HSA|IRA)\b/.test(upper)) {
    return { suggested: 'TAXABLE', confidence: 'MEDIUM', source: 'BROKERAGE_STATEMENT' };
  }
  return { suggested: '', confidence: 'LOW', source: '' };
}

function investmentM1TokenizeTabularStatementRow_(text) {
  var tokens = [];
  var pattern = /\$?\([\d,.\-]+\)|\$[\d,.\-]+|\d{1,2}\/\d{1,2}\/\d{4}|[A-Za-z][A-Za-z0-9.\-&]*|[\d,]+(?:\.\d+)?/g;
  var match;
  while ((match = pattern.exec(String(text || ''))) !== null) {
    tokens.push(match[0]);
  }
  return tokens;
}

function investmentM1SplitStatementLine_(line) {
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
  var tokenized = investmentM1TokenizeTabularStatementRow_(text);
  if (tokenized.length >= 2) return tokenized;
  return [text];
}

function investmentM1SafeParseMoney_(text) {
  try {
    var value = parseInvestmentImportMoney_(text);
    return isFinite(value) ? value : NaN;
  } catch (e) {
    return NaN;
  }
}

function investmentM1SafeParseNumber_(text) {
  try {
    var value = parseInvestmentImportNumber_(text);
    return isFinite(value) ? value : NaN;
  } catch (e) {
    return NaN;
  }
}

function investmentM1HasMoney_(value) {
  return value !== null && typeof value !== 'undefined' && value !== '' && isFinite(value);
}

function investmentM1BreakdownReconcilesToTotal_(preamble) {
  preamble = preamble || {};
  if (!investmentM1HasMoney_(preamble.totalAccountValue)) return null;
  if (!investmentM1HasMoney_(preamble.equitiesSubtotal)) return null;
  if (!investmentM1HasMoney_(preamble.cashBalance) && preamble.cashBalance !== 0) return null;
  var sum = Number(preamble.cashBalance || 0) + Number(preamble.equitiesSubtotal || 0);
  return Math.abs(Math.round(sum * 100) / 100 - Number(preamble.totalAccountValue)) <= 0.01;
}

function investmentM1NormalizeStatementPeriodEnd_(periodEndRaw) {
  var text = String(periodEndRaw || '').trim();
  if (!text) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.indexOf('T') >= 0 ? text : text + 'T00:00:00.000Z';
  try {
    var normalized = normalizeInvestmentImportDate_(text, 'Statement period end');
    return normalized + 'T00:00:00.000Z';
  } catch (e) {
    return text;
  }
}

function investmentM1ExtractStatementContent_(input) {
  input = input || {};
  if (input.rawStatementText) return String(input.rawStatementText);
  var files = input.files || [];
  var statementFile = files.filter(function(file) {
    return String(file.role || '').toUpperCase() === 'HOLDINGS' ||
      String(file.role || '').toUpperCase() === 'ACCOUNT_SNAPSHOT';
  })[0];
  return String(statementFile && statementFile.content || '');
}

function investmentM1BuildStatementFileFingerprint_(rawText) {
  return investmentPortfolioDigest_([String(rawText || '')]);
}

function investmentM1BuildSourceSecurityKey_(symbol, shareClass, exchange, description, disambiguate) {
  var key = 'M1|' + String(symbol || '').trim().toUpperCase() + '|' +
    String(shareClass || 'Class A').trim() + '|' +
    String(exchange || 'UNKNOWN').trim().toUpperCase();
  if (disambiguate) {
    key += '|' + investmentPortfolioDigest_([String(description || '').trim()]);
  }
  return key;
}

function investmentM1ResolveStatementAccountMatch_(input) {
  input = input || {};
  var accountMeta = input.accountMeta || {};
  var stableAccountId = String(accountMeta.stableAccountId || '').trim();
  var explicitMatch = input.explicitAccountMatch === true || accountMeta.explicitAccountMatch === true;
  var registrationType = investmentPortfolioNormalizeRegistrationType_(
    accountMeta.registrationType || '');
  var accountName = String(accountMeta.accountName || '').trim();
  var active = accountMeta.active !== false;

  if (!stableAccountId) {
    return {
      ok: false,
      stableAccountId: '',
      sourceAccountKey: '',
      matchStatus: 'NO_MATCH',
      error: 'stableAccountId is required for M1 statement preview.'
    };
  }
  if (!explicitMatch) {
    return {
      ok: false,
      stableAccountId: stableAccountId,
      sourceAccountKey: '',
      matchStatus: 'REVIEW_REQUIRED',
      error: 'explicitAccountMatch is required for M1 statement preview.'
    };
  }
  if (!registrationType) {
    return {
      ok: false,
      stableAccountId: stableAccountId,
      sourceAccountKey: '',
      matchStatus: 'REVIEW_REQUIRED',
      error: 'registrationType is required for M1 statement preview.'
    };
  }
  if (!active) {
    return {
      ok: false,
      stableAccountId: stableAccountId,
      sourceAccountKey: stableAccountId,
      matchStatus: 'AMBIGUOUS',
      error: 'Inactive account cannot be associated with M1 statement preview.'
    };
  }
  return {
    ok: true,
    stableAccountId: stableAccountId,
    sourceAccountKey: stableAccountId,
    matchStatus: 'EXPLICIT_MATCH',
    registrationType: registrationType,
    accountName: accountName,
    reviewRequired: false
  };
}

function investmentM1FindSectionHeaderIndex_(lines, pattern) {
  for (var i = 0; i < (lines || []).length; i++) {
    var normalized = String(lines[i] || '').replace(/\|/g, ' ');
    if (pattern.test(normalized)) return i;
  }
  return -1;
}

function investmentM1ParseStatementPreamble_(lines) {
  var preamble = {
    statementPeriodStart: '',
    statementPeriodEnd: '',
    maskedAccountNumber: '',
    accountLabel: '',
    accountType: '',
    accountTitle: '',
    totalAccountValue: null,
    periodChangeAmount: null,
    periodChangePercent: null,
    cashBalance: null,
    equitiesSubtotal: null,
    totalPortfolioSubtotal: null,
    paidDividendsCurrentPeriod: null,
    paidDividendsYtd: null
  };
  (lines || []).forEach(function(line) {
    var text = String(line || '').trim();
    if (!text || /^#/.test(text)) return;
    var periodMatch = text.match(/^Statement period:\s*(\d{1,2}\/\d{1,2}\/\d{4})\s+to\s+(\d{1,2}\/\d{1,2}\/\d{4})/i);
    if (periodMatch) {
      preamble.statementPeriodStart = periodMatch[1];
      preamble.statementPeriodEnd = periodMatch[2];
      return;
    }
    var accountNumberMatch = text.match(/^Account number:\s*(XXXX\d+)/i);
    if (accountNumberMatch) {
      preamble.maskedAccountNumber = accountNumberMatch[1].toUpperCase();
      return;
    }
    var accountTypeMatch = text.match(/^Account type:\s*(.+)$/i);
    if (accountTypeMatch) {
      preamble.accountType = String(accountTypeMatch[1] || '').trim();
      return;
    }
    var accountMatch = text.match(/^Account:\s*(.+)$/i);
    if (accountMatch) {
      preamble.accountLabel = String(accountMatch[1] || '').trim();
      return;
    }
    var typeMatch = text.match(/^Type:\s*(.+)$/i);
    if (typeMatch) {
      preamble.accountType = String(typeMatch[1] || '').trim();
      return;
    }
    var titleMatch = text.match(/^Account title:\s*(.+)$/i);
    if (titleMatch) {
      preamble.accountTitle = String(titleMatch[1] || '').trim();
      return;
    }
    var totalValueMatch = text.match(/^Total account value\s*\/\s*1-month change\s*$/i);
    if (totalValueMatch) return;
    var totalInlineMatch = text.match(
      /^Total account value\s*\/\s*1-month change\s+\$?([\d,]+(?:\.\d+)?)\s*\/\s*\$?([\d,()\-]+(?:\.\d+)?)\s*\[([\d.]+)%\]/i);
    if (totalInlineMatch) {
      preamble.totalAccountValue = investmentM1SafeParseMoney_(totalInlineMatch[1]);
      preamble.periodChangeAmount = investmentM1SafeParseMoney_(totalInlineMatch[2]);
      preamble.periodChangePercent = investmentM1SafeParseNumber_(totalInlineMatch[3]);
      return;
    }
    var totalLineMatch = text.match(/^\$?([\d,]+(?:\.\d+)?)\s*\/\s*\$?([\d,()\-]+(?:\.\d+)?)\s*\[([\d.]+)%\]/);
    if (totalLineMatch) {
      preamble.totalAccountValue = investmentM1SafeParseMoney_(totalLineMatch[1]);
      preamble.periodChangeAmount = investmentM1SafeParseMoney_(totalLineMatch[2]);
      preamble.periodChangePercent = investmentM1SafeParseNumber_(totalLineMatch[3]);
      return;
    }
    var cells = investmentM1SplitStatementLine_(text);
    if (cells && cells.length >= 3) {
      var rowLabel = String(cells[0] || '').trim();
      if (/^(cash|equities|total portfolio)$/i.test(rowLabel)) {
        var currentPeriodValue = investmentM1SelectBreakdownCurrentPeriod_(
          investmentM1ExtractBreakdownMoneyValues_(cells));
        if (/^cash$/i.test(rowLabel) && investmentM1HasMoney_(currentPeriodValue)) {
          preamble.cashBalance = currentPeriodValue;
        } else if (/^equities$/i.test(rowLabel) && investmentM1HasMoney_(currentPeriodValue)) {
          preamble.equitiesSubtotal = currentPeriodValue;
        } else if (/^total portfolio$/i.test(rowLabel) && investmentM1HasMoney_(currentPeriodValue)) {
          preamble.totalPortfolioSubtotal = currentPeriodValue;
        }
        return;
      }
      if (/^paid dividends$/i.test(rowLabel)) {
        preamble.paidDividendsCurrentPeriod = investmentM1SafeParseMoney_(cells[1]);
        if (cells.length > 2) preamble.paidDividendsYtd = investmentM1SafeParseMoney_(cells[2]);
        return;
      }
      if (/account breakdown/i.test(text)) {
        investmentM1ApplyBreakdownRowCells_(preamble, cells);
        return;
      }
    }
    var breakdownMatch = text.match(/^(Cash|Equities|Total portfolio)\s*(.+)$/i);
    if (breakdownMatch) {
      var breakdownCells = investmentM1TokenizeTabularStatementRow_(breakdownMatch[0]);
      if (!breakdownCells || breakdownCells.length < 2) {
        breakdownCells = [breakdownMatch[1]].concat(
          breakdownMatch[2].split(/\s{2,}|\t|\|/).map(function(cell) {
            return String(cell || '').trim();
          }).filter(Boolean)
        );
      }
      var label = String(breakdownCells[0] || '').trim();
      var currentValue = investmentM1SelectBreakdownCurrentPeriod_(
        investmentM1ExtractBreakdownMoneyValues_(breakdownCells));
      if (/^cash$/i.test(label) && investmentM1HasMoney_(currentValue)) {
        preamble.cashBalance = currentValue;
      } else if (/^equities$/i.test(label) && investmentM1HasMoney_(currentValue)) {
        preamble.equitiesSubtotal = currentValue;
      } else if (/^total portfolio$/i.test(label) && investmentM1HasMoney_(currentValue)) {
        preamble.totalPortfolioSubtotal = currentValue;
      }
      return;
    }
    var dividendMatch = text.match(/^Paid dividends\s+(.+)$/i);
    if (dividendMatch) {
      var dividendCells = investmentM1SplitStatementLine_(text) ||
        ['Paid dividends'].concat(dividendMatch[1].split(/\s{2,}/));
      preamble.paidDividendsCurrentPeriod = investmentM1SafeParseMoney_(dividendCells[1]);
      if (dividendCells.length > 2) {
        preamble.paidDividendsYtd = investmentM1SafeParseMoney_(dividendCells[2]);
      }
    }
  });
  return preamble;
}

function investmentM1ParseHoldingsTable_(lines, startIndex) {
  var rows = [];
  var excluded = [];
  for (var i = startIndex + 1; i < lines.length; i++) {
    var line = String(lines[i] || '').trim();
    if (!line || /^#/.test(line)) continue;
    if (/^Financial instrument information/i.test(line)) break;
    if (/^Statement for account/i.test(line)) break;
    if (/^--\s*\d+\s+of\s+\d+\s*--/i.test(line)) break;
    if (/^M1:/i.test(line)) break;
    if (/^Total portfolio$/i.test(line)) break;
    var cells = investmentM1SplitStatementLine_(line);
    if (!cells || cells.length < 2) continue;
    var symbol = String(cells[0] || '').trim().toUpperCase();
    if (!symbol) continue;
    if (/^total$/i.test(symbol)) {
      excluded.push({ rowIndex: i + 1, reason: 'PAGE_TOTAL', symbol: symbol });
      continue;
    }
    if (/^(cash|equities|total portfolio)$/i.test(symbol)) {
      excluded.push({ rowIndex: i + 1, reason: 'ACCOUNT_ROLLUP', symbol: symbol });
      continue;
    }
    var quantity = investmentM1SafeParseNumber_(cells[1]);
    var price = investmentM1SafeParseMoney_(cells[2]);
    var marketValue = investmentM1SafeParseMoney_(cells[3]);
    var costBasisText = String(cells[4] || '').trim();
    var costBasis = costBasisText ? investmentM1SafeParseMoney_(cells[4]) : NaN;
    var unrealizedText = String(cells[5] || '').trim();
    var unrealized = unrealizedText ? investmentM1SafeParseMoney_(cells[5]) : NaN;
    var errors = [];
    if (!isFinite(quantity)) errors.push('quantity');
    if (!investmentM1HasMoney_(price)) errors.push('price');
    if (!investmentM1HasMoney_(marketValue)) errors.push('marketValue');
    if (errors.length) {
      excluded.push({
        rowIndex: i + 1,
        reason: 'MALFORMED_HOLDING',
        symbol: symbol,
        errors: errors
      });
      continue;
    }
    rows.push({
      rowIndex: i + 1,
      symbol: symbol,
      quantity: quantity,
      price: price,
      marketValue: marketValue,
      providerCostBasis: investmentM1HasMoney_(costBasis) ? costBasis : null,
      unrealizedGainLoss: investmentM1HasMoney_(unrealized) ? unrealized : null
    });
  }
  return { rows: rows, excluded: excluded };
}

function investmentM1ParseInstrumentTable_(lines, startIndex) {
  var instruments = {};
  var duplicateSymbols = {};
  var rows = [];
  for (var i = startIndex + 1; i < lines.length; i++) {
    var line = String(lines[i] || '').trim();
    if (!line || /^#/.test(line)) continue;
    if (/^Statement for account/i.test(line)) break;
    if (/^--\s*\d+\s+of\s+\d+\s*--/i.test(line)) break;
    if (/^M1:/i.test(line)) break;
    if (/^Terms and conditions/i.test(line)) break;
    if (/^M1 Finance/i.test(line)) break;
    if (/^Total portfolio$/i.test(line)) break;
    var cells = investmentM1SplitStatementLine_(line);
    if (!cells || cells.length < 2) continue;
    var symbol = String(cells[0] || '').trim().toUpperCase();
    if (!symbol || /^symbol$/i.test(symbol)) continue;
    if (!/^[A-Z][A-Z0-9.\-]{0,5}$/.test(symbol)) continue;
    var shareClass = 'Class A';
    var description = '';
    var exchange = 'UNKNOWN';
    if (/^class$/i.test(String(cells[1] || '').trim()) &&
        /^a$/i.test(String(cells[2] || '').trim()) &&
        cells.length >= 4) {
      shareClass = 'Class A';
      exchange = String(cells[cells.length - 1] || 'UNKNOWN').trim().toUpperCase();
      description = cells.slice(3, cells.length - 1).join(' ').trim();
    } else if (cells.length >= 4) {
      shareClass = String(cells[1] || 'Class A').trim();
      exchange = String(cells[cells.length - 1] || 'UNKNOWN').trim().toUpperCase();
      description = cells.slice(2, cells.length - 1).join(' ').trim();
    } else if (cells.length === 3) {
      shareClass = String(cells[1] || 'Class A').trim();
      description = shareClass;
      exchange = String(cells[2] || 'UNKNOWN').trim().toUpperCase();
      shareClass = 'Class A';
    }
    rows.push({
      rowIndex: i + 1,
      symbol: symbol,
      shareClass: shareClass,
      description: description,
      exchange: exchange
    });
    if (instruments[symbol] &&
        (instruments[symbol].description !== description ||
         instruments[symbol].shareClass !== shareClass ||
         instruments[symbol].exchange !== exchange)) {
      duplicateSymbols[symbol] = true;
    }
    instruments[symbol] = {
      shareClass: shareClass,
      description: description,
      exchange: exchange
    };
  }
  return { bySymbol: instruments, rows: rows, duplicateSymbols: duplicateSymbols };
}

function investmentM1ParseStatementPdfText_(rawText) {
  var text = investmentM1PrepareStatementTextForParsing_(rawText);
  if (!text.trim()) {
    return { ok: false, error: 'M1 statement PDF text is empty.' };
  }
  var layout = investmentM1AssessStatementLayout_(text);
  if (!layout.ok) {
    return { ok: false, error: layout.error };
  }
  var lines = text.split('\n');
  var holdingsHeaderIndex = investmentM1FindSectionHeaderIndex_(lines,
    /Symbol\s+Quantity\s+Price\s+Market value(?:\s+Cost basis\s+Unrealized)?/i);
  if (holdingsHeaderIndex < 0) {
    return { ok: false, error: 'M1 statement holdings table header not found.' };
  }
  var instrumentHeaderIndex = investmentM1FindSectionHeaderIndex_(lines,
    /Symbol\s+Share class\s+Description\s+Exchange/i);
  var preambleLines = investmentM1ExpandGluedBreakdownLines_(lines.slice(0, holdingsHeaderIndex));
  var preamble = investmentM1ParseStatementPreamble_(preambleLines);
  preamble = investmentM1RecoverBreakdownFromGluedText_(preambleLines.join('\n'), preamble);
  var holdings = investmentM1ParseHoldingsTable_(lines, holdingsHeaderIndex);
  var instruments = instrumentHeaderIndex >= 0
    ? investmentM1ParseInstrumentTable_(lines, instrumentHeaderIndex)
    : { bySymbol: {}, rows: [], duplicateSymbols: {} };
  return {
    ok: true,
    preamble: preamble,
    holdings: holdings.rows,
    excluded: holdings.excluded,
    instruments: instruments.bySymbol,
    instrumentRows: instruments.rows,
    duplicateInstrumentSymbols: instruments.duplicateSymbols
  };
}

function investmentM1DetectStatementPdf_(input) {
  input = input || {};
  var rawText = investmentM1ExtractStatementContent_(input);
  if (!rawText.trim()) {
    return { ok: false, reason: 'No M1 statement PDF text supplied.' };
  }
  var layout = investmentM1AssessStatementLayout_(
    investmentM1PrepareStatementTextForParsing_(rawText));
  if (!layout.ok) {
    return { ok: false, reason: layout.error };
  }
  return { ok: true, source: 'M1_STATEMENT_PDF', inferredRoles: ['HOLDINGS', 'ACCOUNT_SNAPSHOT'] };
}

function investmentM1BuildUnifiedHoldingsPreviewFromStatement_(input, parseResult, accountMatch) {
  input = input || {};
  parseResult = parseResult || {};
  accountMatch = accountMatch || {};
  var accountMeta = input.accountMeta || {};
  var preamble = parseResult.preamble || {};
  var sourceAsOf = investmentM1NormalizeStatementPeriodEnd_(preamble.statementPeriodEnd);
  var registrationType = accountMatch.registrationType ||
    investmentPortfolioNormalizeRegistrationType_(accountMeta.registrationType || 'TAXABLE');
  var taxStatus = investmentPortfolioResolveTaxStatus_(registrationType);
  var fingerprint = investmentM1BuildStatementFileFingerprint_(
    investmentM1ExtractStatementContent_(input));
  var stableAccountId = String(accountMatch.stableAccountId || '').trim();
  var matchStatus = String(accountMatch.matchStatus || 'REVIEW_REQUIRED').toUpperCase();
  var confidence = matchStatus === 'EXPLICIT_MATCH' ? 'HIGH' : 'LOW';

  var preview = investmentPortfolioBuildEmptyHoldingsPreview_({
    source: 'M1_STATEMENT_PDF',
    parserVersion: M1_STATEMENT_PDF_PARSER_VERSION_,
    asOf: sourceAsOf,
    observedAt: String(input.observedAt || '')
  });
  preview.source = 'M1_STATEMENT_PDF';
  preview.parserVersion = M1_STATEMENT_PDF_PARSER_VERSION_;
  preview.sourceFiles = [{
    role: 'HOLDINGS',
    fileName: String(input.fileName || 'm1-statement.pdf').trim() || 'm1-statement.pdf',
    sourceFileFingerprint: fingerprint,
    sourceAsOf: sourceAsOf,
    parserVersion: M1_STATEMENT_PDF_PARSER_VERSION_
  }];
  preview.capabilities = {
    activities: false,
    holdings: (parseResult.holdings || []).length > 0,
    taxLots: false,
    accountSnapshot: !!(preamble.totalAccountValue || preamble.cashBalance),
    dividendHistory: false,
    realizedGainLoss: false
  };
  var resolvedDisplayName = String(accountMatch.accountName || accountMeta.accountName || '').trim();
  if (!resolvedDisplayName && matchStatus !== 'EXPLICIT_MATCH') {
    resolvedDisplayName = String(preamble.accountLabel || '').trim();
  }
  preview.accounts = [{
    investmentId: String(input.investmentId || accountMeta.investmentId || ''),
    stableAccountId: stableAccountId,
    institution: 'M1 Finance',
    displayName: resolvedDisplayName,
    accountType: String(preamble.accountType || accountMeta.accountType || 'Brokerage').trim(),
    registrationType: registrationType,
    domain: investmentPortfolioResolveDomainForRegistration_(registrationType),
    taxStatus: taxStatus,
    portfolioRoles: investmentPortfolioResolvePortfolioRoles_(accountMeta),
    active: accountMeta.active !== false,
    matchStatus: matchStatus,
    sourceAccountKey: String(accountMatch.sourceAccountKey || stableAccountId).trim()
  }];

  var securitiesById = {};
  var holdings = [];
  var securities = [];
  (parseResult.holdings || []).forEach(function(row) {
    var instrument = (parseResult.instruments || {})[row.symbol] || {};
    var disambiguate = !!(parseResult.duplicateInstrumentSymbols || {})[row.symbol];
    var sourceSecurityKey = investmentM1BuildSourceSecurityKey_(
      row.symbol,
      instrument.shareClass,
      instrument.exchange,
      instrument.description,
      disambiguate
    );
    var stableSecurityId = investmentPortfolioHashOpaqueKey_('SEC', sourceSecurityKey);
    if (!securitiesById[stableSecurityId]) {
      securitiesById[stableSecurityId] = {
        stableSecurityId: stableSecurityId,
        ticker: row.symbol,
        securityName: instrument.description || '',
        securityType: 'EQUITY',
        assetClass: 'US_EQUITY',
        primarySource: 'M1_STATEMENT_PDF',
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
      source: 'M1_STATEMENT_PDF',
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
  if (preamble.totalAccountValue || preamble.cashBalance !== null) {
    preview.accountSnapshots = [{
      stableAccountId: stableAccountId,
      snapshotType: 'CASH',
      marketValue: preamble.totalAccountValue,
      cashBalance: investmentM1HasMoney_(preamble.cashBalance) ? preamble.cashBalance : null,
      asOf: sourceAsOf,
      authority: 'PROVIDER_REPORTED',
      sourceSnapshotKey: fingerprint,
      sourceAsOf: sourceAsOf,
      source: 'M1_STATEMENT_PDF'
    }];
  }
  preview.warnings = [];
  if (preamble.paidDividendsCurrentPeriod || preamble.paidDividendsYtd) {
    preview.warnings.push(
      'Paid dividend rollups are summary-only and were not promoted to distributions[].');
  }
  if (preamble.maskedAccountNumber) {
    preview.warnings.push(
      'Masked statement account number is informational only and is not durable account identity.');
  }
  preview.unsupportedRows = parseResult.excluded || [];
  preview.statementParseMeta = {
    maskedAccountNumber: preamble.maskedAccountNumber || '',
    accountLabel: preamble.accountLabel || '',
    accountTitle: preamble.accountTitle || '',
    accountType: preamble.accountType || '',
    equitiesSubtotal: preamble.equitiesSubtotal,
    totalPortfolioSubtotal: preamble.totalPortfolioSubtotal,
    cashPlusEquitiesReconciles: investmentM1BreakdownReconcilesToTotal_(preamble),
    paidDividendsCurrentPeriod: preamble.paidDividendsCurrentPeriod,
    paidDividendsYtd: preamble.paidDividendsYtd,
    instrumentRowsParsed: (parseResult.instrumentRows || []).length,
    holdingsRowsParsed: (parseResult.holdings || []).length
  };
  preview.importSummary = investmentPortfolioBuildImportPreviewSummary_({
    source: 'M1_STATEMENT_PDF',
    parserVersion: M1_STATEMENT_PDF_PARSER_VERSION_,
    reportedHoldings: preview.holdings.length,
    providerLots: 0,
    excludedActivities: preview.unsupportedRows.length,
    account: preview.accounts[0] && preview.accounts[0].displayName,
    warnings: preview.warnings,
    capabilities: preview.capabilities
  });
  preview.recommendationReadiness = investmentPortfolioEvaluateRecommendationReadiness_(preview);
  preview.recommendationReadiness.trustedForIncomeAnalysis = false;
  preview.recommendationReadiness.trustedForTaxLotSalePlanning = false;
  return preview;
}

function investmentM1PreviewStatementPdfUnifiedHoldings_(input) {
  input = input || {};
  var source = investmentPortfolioNormalizeSource_(input.source) || 'M1_STATEMENT_PDF';
  var rawText = investmentM1ExtractStatementContent_(input);
  if (!rawText.trim()) {
    return {
      ok: false,
      reviewRequired: true,
      source: source,
      error: 'M1 statement PDF text content is required.'
    };
  }
  var accountMatch = investmentM1ResolveStatementAccountMatch_(input);
  if (!accountMatch.ok) {
    return {
      ok: false,
      reviewRequired: true,
      source: source,
      error: accountMatch.error,
      matchStatus: accountMatch.matchStatus
    };
  }
  var parseResult = investmentM1ParseStatementPdfText_(rawText);
  if (!parseResult.ok) {
    return {
      ok: false,
      reviewRequired: true,
      source: source,
      error: parseResult.error
    };
  }
  var unified = investmentM1BuildUnifiedHoldingsPreviewFromStatement_(
    input, parseResult, accountMatch);
  var reviewRequired = !unified.recommendationReadiness.trustedForHoldingsVisibility;
  return {
    ok: true,
    reviewRequired: reviewRequired,
    source: 'M1_STATEMENT_PDF',
    parserVersion: M1_STATEMENT_PDF_PARSER_VERSION_,
    schemaVersion: INVESTMENT_PORTFOLIO_SCHEMA_VERSION_,
    contractVersion: PORTFOLIO_INTELLIGENCE_HOLDINGS_CONTRACT_VERSION_,
    capabilities: unified.capabilities,
    normalized: unified
  };
}
