/**
 * E*TRADE Transactions CSV — preview-only parser (Phase A).
 *
 * Parses preamble, header, data rows, and footer disclaimers into canonical
 * normalized activities. No persistence or workbook writes.
 */

var ETRADE_TXN_CSV_PARSER_VERSION_ = 'etrade-txn-csv-v1';

var ETRADE_TXN_CSV_HEADER_FIELDS_ = [
  'activityTradeDate', 'transactionDate', 'settlementDate', 'activityType',
  'description', 'symbol', 'cusip', 'quantity', 'price', 'amount',
  'commission', 'category', 'note'
];

var ETRADE_TXN_KNOWN_ACTIVITY_TYPES_ = {
  'BOUGHT': true,
  'SOLD': true,
  'DIVIDEND': true,
  'QUALIFIED DIVIDEND': true,
  'TRANSFER': true,
  'ONLINE TRANSFER': true,
  'EXCHANGE RECEIVED IN': true,
  'EXCHANGE DELIVERED OUT': true,
  'CASH IN LIEU': true,
  'STOCK SPLIT': true,
  'REDEMPTION': true,
  'CANCEL SOLD': true,
  'SERVICE FEE': true,
  'INTEREST INCOME': true
};

function investmentEtradeSplitCsvLine_(line) {
  var cells = [];
  var current = '';
  var inQuotes = false;
  var text = String(line || '');
  for (var i = 0; i < text.length; i++) {
    var ch = text[i];
    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      cells.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  cells.push(current);
  return cells.map(function(cell) { return String(cell || '').trim(); });
}

function investmentEtradeFindTxnHeaderIndex_(lines) {
  for (var i = 0; i < (lines || []).length; i++) {
    var line = String(lines[i] || '');
    if (/Activity\/Trade Date/i.test(line) && /Activity Type/i.test(line)) {
      return i;
    }
  }
  return -1;
}

function investmentEtradeParsePreamble_(lines, headerIndex) {
  var preambleLines = lines.slice(0, headerIndex);
  var accountLabel = '';
  var dateRange = '';
  var total = null;
  preambleLines.forEach(function(line) {
    var text = String(line || '').trim();
    if (!text) return;
    if (/^total:/i.test(text)) {
      total = parseInvestmentImportMoney_(text.replace(/^total:\s*/i, ''));
      return;
    }
    if (/^all transactions/i.test(text)) return;
    accountLabel = text;
    var rangeMatch = text.match(/\|\s*(.+)$/);
    if (rangeMatch) dateRange = rangeMatch[1].trim();
  });
  return {
    accountLabel: accountLabel,
    dateRange: dateRange,
    total: total,
    lineCount: preambleLines.length
  };
}

function investmentEtradeIsFooterRow_(cells) {
  var activityType = String((cells || [])[3] || '').trim();
  if (activityType) return false;
  var first = String((cells || [])[0] || '').trim();
  if (!first) return true;
  if (first.length > 40 && !/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(first)) return true;
  return !activityType && !/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(first);
}

function investmentEtradeIsKnownActivityType_(activityType) {
  var key = String(activityType || '').trim().toUpperCase();
  return ETRADE_TXN_KNOWN_ACTIVITY_TYPES_[key] === true;
}

function investmentEtradeParseTxnCsvRow_(cells, rowIndex) {
  if (!cells || cells.length < 4) {
    return { ok: false, reason: 'ROW_TOO_SHORT', rowIndex: rowIndex };
  }
  while (cells.length < ETRADE_TXN_CSV_HEADER_FIELDS_.length) cells.push('');
  return {
    ok: true,
    rowIndex: rowIndex,
    activityTradeDate: cells[0],
    transactionDate: cells[1],
    settlementDate: cells[2],
    activityType: cells[3],
    description: cells[4],
    symbol: cells[5],
    cusip: cells[6],
    quantity: cells[7],
    price: cells[8],
    amount: cells[9],
    commission: cells[10],
    category: cells[11],
    note: cells[12]
  };
}

function investmentEtradeParseTxnCsv_(rawCsv) {
  var csv = String(rawCsv || '');
  if (!csv.trim()) {
    return { ok: false, error: 'E*TRADE Transactions CSV is empty.' };
  }
  var lines = csv.split(/\r?\n/);
  var headerIndex = investmentEtradeFindTxnHeaderIndex_(lines);
  if (headerIndex < 0) {
    return { ok: false, error: 'E*TRADE Transactions CSV header row was not found.' };
  }
  if (/Trans Code/i.test(lines[headerIndex]) && /Instrument/i.test(lines[headerIndex])) {
    return { ok: false, error: 'File appears to be a Robinhood activity CSV, not E*TRADE.' };
  }
  var preamble = investmentEtradeParsePreamble_(lines, headerIndex);
  var dataRows = [];
  var footerRows = [];
  var skippedRows = [];
  for (var i = headerIndex + 1; i < lines.length; i++) {
    var rawLine = lines[i];
    if (!String(rawLine || '').trim()) continue;
    var cells = investmentEtradeSplitCsvLine_(rawLine);
    if (investmentEtradeIsFooterRow_(cells)) {
      footerRows.push({ rowIndex: i, cells: cells });
      continue;
    }
    var parsed = investmentEtradeParseTxnCsvRow_(cells, i);
    if (!parsed.ok) {
      skippedRows.push(parsed);
      continue;
    }
    if (!investmentEtradeIsKnownActivityType_(parsed.activityType)) {
      skippedRows.push({
        ok: false,
        reason: 'UNKNOWN_ACTIVITY_TYPE',
        rowIndex: i,
        activityType: parsed.activityType
      });
      continue;
    }
    dataRows.push(parsed);
  }
  return {
    ok: true,
    preamble: preamble,
    headerIndex: headerIndex,
    dataRows: dataRows,
    footerRows: footerRows,
    skippedRows: skippedRows
  };
}

function investmentEtradeParseOptionalNumber_(value, parser) {
  var text = String(value || '').trim();
  if (!text || text === '--') return null;
  return parser(text);
}

function investmentEtradeNormalizeSymbol_(value) {
  var text = String(value || '').trim();
  if (!text || text === '--') return '';
  return text.toUpperCase();
}

function investmentEtradeNormalizeParsedRow_(parsed, context) {
  context = context || {};
  try {
    var activityDate = normalizeInvestmentImportDate_(
      parsed.activityTradeDate, 'Activity/Trade Date', false);
    var settleDate = normalizeInvestmentImportDate_(
      parsed.settlementDate, 'Settlement Date', true);
    var amount = parseInvestmentImportMoney_(parsed.amount);
    var quantity = investmentEtradeParseOptionalNumber_(
      parsed.quantity, parseInvestmentImportNumber_);
    var price = investmentEtradeParseOptionalNumber_(
      parsed.price, parseInvestmentImportMoney_);
    var fees = investmentEtradeParseOptionalNumber_(
      parsed.commission, parseInvestmentImportNumber_);
    if (fees === null) fees = 0;
    var ticker = investmentEtradeNormalizeSymbol_(parsed.symbol);
    var mapped = investmentPortfolioMapEtradeSourceActivity_({
      etradeActivityType: parsed.activityType,
      description: parsed.description,
      amount: amount,
      quantity: quantity,
      activityDate: activityDate,
      ticker: ticker
    });
    if (mapped.activityType === 'UNSUPPORTED') {
      return {
        ok: false,
        reason: 'UNSUPPORTED_ACTIVITY',
        rowIndex: parsed.rowIndex,
        activityType: parsed.activityType
      };
    }
    var source = investmentPortfolioNormalizeSource_(context.source) || 'ETRADE_PACKAGE';
    var activity = investmentPortfolioApplyEtradeMappedActivity_({
      source: source,
      activityDate: activityDate,
      settleDate: settleDate,
      ticker: ticker,
      description: parsed.description,
      quantity: quantity,
      price: price,
      amount: amount,
      fees: fees,
      etradeActivityType: parsed.activityType
    }, mapped);
    activity.sourceAccountKey = String(context.sourceAccountKey || '');
    activity.sourceRecordKey = investmentPortfolioBuildEtradeSourceRecordKey_(activity, {
      etradeActivityType: parsed.activityType,
      description: parsed.description
    });
    var identity = investmentPortfolioAssessEtradeSourceIdentity_(activity, {
      etradeActivityType: parsed.activityType,
      description: parsed.description
    });
    if (identity.reviewRequired) activity.reviewRequired = true;
    activity.sourceIdentityStrength = identity.strength;
    activity.sourceSecurityKey = ticker || '';
    activity.parserVersion = context.parserVersion || ETRADE_TXN_CSV_PARSER_VERSION_;
    activity.dataQuality = 'NORMALIZED';
    activity.netAmount = amount;
    activity.sourceRowIndex = parsed.rowIndex;
    activity.etradeActivityType = parsed.activityType;
    activity.replayKey = investmentPortfolioBuildReplayKey_(activity);
    if (context.investmentId) activity.investmentId = String(context.investmentId);
    if (context.stableAccountId) activity.stableAccountId = String(context.stableAccountId);
    if (context.incomeBucketSnapshot) {
      activity.incomeBucketSnapshot = context.incomeBucketSnapshot;
    }
    var validation = investmentPortfolioValidateActivity_(activity);
    if (!validation.ok) {
      return {
        ok: false,
        reason: 'VALIDATION_FAILED',
        rowIndex: parsed.rowIndex,
        errors: validation.errors
      };
    }
    return { ok: true, activity: activity };
  } catch (err) {
    return {
      ok: false,
      reason: 'PARSE_ERROR',
      rowIndex: parsed.rowIndex,
      error: String(err && err.message ? err.message : err)
    };
  }
}

function investmentEtradeResolveSourceAccountKey_(parseResult, accountMeta) {
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
      warning: 'stableAccountId is required before replaying E*TRADE imports across separate taxable or RSU/ESPP pools.'
    };
  }
  return {
    ok: false,
    reviewRequired: true,
    error: 'E*TRADE preview requires stableAccountId or a recognizable account line in the CSV preamble.'
  };
}

function investmentEtradeBuildFileFingerprint_(rawCsv) {
  return investmentPortfolioDigest_([String(rawCsv || '')]);
}

function investmentEtradePreviewTxnCsv_(input) {
  input = input || {};
  var source = investmentPortfolioNormalizeSource_(input.source) || 'ETRADE_PACKAGE';
  var files = input.files || [];
  var rawCsv = String(input.rawCsv || '').trim();
  if (!rawCsv && files.length) {
    var activityFile = files.filter(function(file) {
      return !file.role || file.role === 'ACTIVITY';
    })[0];
    rawCsv = String(activityFile && activityFile.content || '').trim();
  }
  if (!rawCsv) {
    return {
      ok: false,
      reviewRequired: true,
      source: source,
      error: 'E*TRADE Transactions CSV content is required.'
    };
  }
  var parseResult = investmentEtradeParseTxnCsv_(rawCsv);
  if (!parseResult.ok) {
    return {
      ok: false,
      reviewRequired: true,
      source: source,
      error: parseResult.error
    };
  }
  var accountMeta = input.accountMeta || {};
  var registrationType = investmentPortfolioNormalizeRegistrationType_(
    accountMeta.registrationType || 'TAXABLE');
  var incomeBucket = investmentPortfolioResolveIncomeBucket_(registrationType);
  var accountResolution = investmentEtradeResolveSourceAccountKey_(parseResult, accountMeta);
  if (!accountResolution.ok) {
    return {
      ok: false,
      reviewRequired: true,
      source: source,
      error: accountResolution.error
    };
  }
  var sourceAccountKey = accountResolution.sourceAccountKey;
  var context = {
    source: source,
    sourceAccountKey: sourceAccountKey,
    parserVersion: ETRADE_TXN_CSV_PARSER_VERSION_,
    investmentId: String(input.investmentId || accountMeta.investmentId || ''),
    stableAccountId: String(accountMeta.stableAccountId || ''),
    incomeBucketSnapshot: incomeBucket
  };
  var accepted = [];
  var excluded = [];
  parseResult.dataRows.forEach(function(row) {
    var normalized = investmentEtradeNormalizeParsedRow_(row, context);
    if (normalized.ok) accepted.push(normalized.activity);
    else {
      excluded.push({
        reason: normalized.reason,
        rowIndex: normalized.rowIndex,
        activityType: normalized.activityType || row.activityType,
        error: normalized.error || '',
        errors: normalized.errors || []
      });
    }
  });
  var existingActivities = input.existingActivities || [];
  var replaySummary = investmentPortfolioSummarizeReplay_(accepted, existingActivities, {
    investmentId: context.investmentId
  });
  var replayByKey = {};
  replaySummary.items.forEach(function(item) {
    if (item.replayKey) replayByKey[item.replayKey] = item.outcome;
  });
  var activities = accepted.map(function(activity) {
    var copy = {};
    Object.keys(activity).forEach(function(key) { copy[key] = activity[key]; });
    copy.replayOutcome = replayByKey[activity.replayKey] || 'NEW_RECORD';
    return copy;
  });
  var intraFileSummary = investmentPortfolioSummarizeIntraFileSourceKeys_(activities);
  if (intraFileSummary.exactDuplicates || intraFileSummary.mutableDuplicates ||
      intraFileSummary.conflicts) {
    activities.forEach(function(activity) {
      if (activity.intraFileOutcome) activity.reviewRequired = true;
    });
  }
  var stableKeyAmbiguity = investmentPortfolioSummarizeEtradeStableKeyAmbiguity_(activities);
  var dividendIncome = investmentPortfolioSummarizeDividendIncome_(activities);
  var warnings = [];
  if (accountResolution.warning) warnings.push(accountResolution.warning);
  if (parseResult.skippedRows.length) {
    warnings.push('Skipped ' + parseResult.skippedRows.length + ' unrecognized CSV row(s).');
  }
  if (parseResult.footerRows.length < 1) {
    warnings.push('No footer disclaimer rows detected; verify export completeness.');
  }
  if (stableKeyAmbiguity.groups) {
    warnings.push('Detected ' + stableKeyAmbiguity.groups +
      ' no-REFID stable-key collision group(s) requiring review.');
  }
  if (intraFileSummary.exactDuplicates) {
    warnings.push('Detected ' + intraFileSummary.exactDuplicates +
      ' intra-file duplicate row(s) sharing a sourceRecordKey.');
  }
  if (intraFileSummary.mutableDuplicates) {
    warnings.push('Detected ' + intraFileSummary.mutableDuplicates +
      ' intra-file row(s) with the same sourceRecordKey but changed amount/qty/price/fees.');
  }
  if (intraFileSummary.conflicts) {
    warnings.push('Detected ' + intraFileSummary.conflicts +
      ' intra-file sourceRecordKey conflict(s) requiring review.');
  }
  var normalized = {
    source: source,
    parserVersion: ETRADE_TXN_CSV_PARSER_VERSION_,
    schemaVersion: INVESTMENT_PORTFOLIO_SCHEMA_VERSION_,
    capabilities: {
      activities: true,
      holdings: false,
      taxLots: false,
      accountSnapshot: false,
      dividendHistory: false,
      realizedGainLoss: false
    },
    accountCandidates: [{
      investmentId: context.investmentId,
      stableAccountId: context.stableAccountId || sourceAccountKey,
      accountName: String(accountMeta.accountName ||
        parseResult.preamble.accountLabel || '').trim(),
      registrationType: registrationType,
      domain: investmentPortfolioResolveDomainForRegistration_(registrationType),
      portfolioRoles: investmentPortfolioResolvePortfolioRoles_(accountMeta)
    }],
    preamble: parseResult.preamble,
    sourceAccountKey: sourceAccountKey,
    sourceFileFingerprint: investmentEtradeBuildFileFingerprint_(rawCsv),
    activities: activities,
    holdingsSnapshots: [],
    taxLots: [],
    securities: [],
    accountSnapshots: [],
    dividendIncome: dividendIncome,
    replaySummary: {
      exactReplays: replaySummary.exactReplays,
      newRecords: replaySummary.newRecords,
      sourceCorrections: replaySummary.sourceCorrections,
      conflicts: replaySummary.conflicts
    },
    intraFileSummary: intraFileSummary,
    stableKeyAmbiguity: stableKeyAmbiguity,
    warnings: warnings,
    unsupportedRows: excluded,
    importSummary: investmentPortfolioBuildImportPreviewSummary_({
      source: source,
      parserVersion: ETRADE_TXN_CSV_PARSER_VERSION_,
      acceptedActivities: activities.length,
      excludedActivities: excluded.length,
      exactReplays: replaySummary.exactReplays,
      newRecords: replaySummary.newRecords,
      sourceCorrections: replaySummary.sourceCorrections,
      conflicts: replaySummary.conflicts,
      intraFileExactDuplicates: intraFileSummary.exactDuplicates,
      intraFileMutableDuplicates: intraFileSummary.mutableDuplicates,
      intraFileConflicts: intraFileSummary.conflicts,
      account: accountMeta.accountName || parseResult.preamble.accountLabel
    })
  };
  return {
    ok: true,
    reviewRequired: excluded.length > 0 || replaySummary.conflicts > 0 ||
      intraFileSummary.exactDuplicates > 0 || intraFileSummary.mutableDuplicates > 0 ||
      intraFileSummary.conflicts > 0 || stableKeyAmbiguity.groups > 0 ||
      accountResolution.reviewRequired === true,
    source: source,
    parserVersion: ETRADE_TXN_CSV_PARSER_VERSION_,
    schemaVersion: INVESTMENT_PORTFOLIO_SCHEMA_VERSION_,
    capabilities: normalized.capabilities,
    normalized: normalized
  };
}

function investmentEtradeDetectTxnCsv_(input) {
  input = input || {};
  var files = input.files || [];
  var rawCsv = String(input.rawCsv || '').trim();
  if (!rawCsv && files.length) {
    var activityFile = files.filter(function(file) {
      return !file.role || file.role === 'ACTIVITY';
    })[0];
    rawCsv = String(activityFile && activityFile.content || '').trim();
  }
  if (!rawCsv) {
    return { ok: false, reason: 'No files supplied for E*TRADE Transactions CSV import.' };
  }
  var lines = rawCsv.split(/\r?\n/);
  var headerIndex = investmentEtradeFindTxnHeaderIndex_(lines);
  if (headerIndex < 0) {
    return { ok: false, reason: 'File does not match E*TRADE Transactions CSV headers.' };
  }
  if (/Trans Code/i.test(lines[headerIndex]) && /Instrument/i.test(lines[headerIndex])) {
    return { ok: false, reason: 'File appears to be a Robinhood activity CSV, not E*TRADE.' };
  }
  var source = investmentPortfolioNormalizeSource_(input.source) || 'ETRADE_PACKAGE';
  return { ok: true, source: source, inferredRoles: ['ACTIVITY'] };
}
