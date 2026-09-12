/**
 * Income-Producing investment activity import and derived holdings.
 *
 * `INPUT - Investments` remains the account-balance authority. These sheets
 * explain the activity and ticker quantities underneath a designated account;
 * they never write balances back into the existing investment history.
 */

var INVESTMENT_ACTIVITY_SOURCE_ROBINHOOD_ = 'ROBINHOOD_CSV';
var INVESTMENT_ACTIVITY_MAX_CSV_CHARS_ = 2000000;
var INVESTMENT_ACTIVITY_MAX_ROWS_ = 5000;
var INVESTMENT_ACTIVITY_HEADERS_ = [
  'Import Key', 'Investment Id', 'Account Name', 'Activity Date', 'Settle Date',
  'Ticker', 'Activity Type', 'Quantity', 'Price', 'Amount', 'Recurring',
  'Description', 'Source', 'Imported At'
];
var INVESTMENT_HOLDINGS_HEADERS_ = [
  'Investment Id', 'Account Name', 'As Of Date', 'Ticker', 'Quantity',
  'Total Buy Cost', 'Sale Proceeds', 'Dividends Received',
  'Weekly Recurring Buy', 'Last Activity Price', 'Activity Count', 'Updated At'
];
var INVESTMENT_PLAN_HEADERS_ = [
  'Investment Id', 'Account Name', 'Ticker', 'Portfolio Status',
  'Plan Frequency', 'Planned Amount', 'Plan Active', 'Updated At',
  'Activity Boundary Date'
];
var INVESTMENT_PORTFOLIO_COMPARISON_HEADERS_ = [
  'Investment Id', 'Account Name', 'Comparison Date', 'Prior As Of Date',
  'Prior Market Value', 'Current Market Value', 'Prior Holdings Count',
  'Current Holdings Count', 'Prior Cash', 'Current Cash', 'Import Digest', 'Updated At'
];
var INVESTMENT_ACTIVITY_CANONICAL_WIDTHS_ = {
  'Import Key': 250, 'Investment Id': 250, 'Account Name': 280,
  'Activity Date': 125, 'Settle Date': 125, 'Ticker': 100,
  'Activity Type': 190, 'Quantity': 130, 'Price': 130, 'Amount': 140,
  'Recurring': 110, 'Description': 420, 'Source': 150, 'Imported At': 170
};
var INVESTMENT_HOLDINGS_CANONICAL_WIDTHS_ = {
  'Investment Id': 250, 'Account Name': 280, 'As Of Date': 125,
  'Ticker': 100, 'Quantity': 130, 'Total Buy Cost': 150,
  'Sale Proceeds': 140, 'Dividends Received': 170,
  'Weekly Recurring Buy': 190, 'Last Activity Price': 170,
  'Activity Count': 140, 'Updated At': 170
};
var INVESTMENT_PLAN_CANONICAL_WIDTHS_ = {
  'Investment Id': 250, 'Account Name': 280, 'Ticker': 100,
  'Portfolio Status': 180, 'Plan Frequency': 170,
  'Planned Amount': 170, 'Plan Active': 130, 'Updated At': 170,
  'Activity Boundary Date': 210
};
var INVESTMENT_PORTFOLIO_COMPARISON_CANONICAL_WIDTHS_ = {
  'Investment Id': 250, 'Account Name': 280, 'Comparison Date': 150,
  'Prior As Of Date': 150, 'Prior Market Value': 170, 'Current Market Value': 170,
  'Prior Holdings Count': 170, 'Current Holdings Count': 170,
  'Prior Cash': 130, 'Current Cash': 130, 'Import Digest': 250, 'Updated At': 170
};

function ensureInvestmentActivitySheet_(optionalSs) {
  var ss = optionalSs || getUserSpreadsheet_();
  return ensureInvestmentSystemSheet_(ss, getSheetNames_().INVESTMENT_ACTIVITY,
    INVESTMENT_ACTIVITY_HEADERS_, INVESTMENT_ACTIVITY_CANONICAL_WIDTHS_);
}

function ensureInvestmentHoldingsSheet_(optionalSs) {
  var ss = optionalSs || getUserSpreadsheet_();
  return ensureInvestmentSystemSheet_(ss, getSheetNames_().INVESTMENT_HOLDINGS,
    INVESTMENT_HOLDINGS_HEADERS_, INVESTMENT_HOLDINGS_CANONICAL_WIDTHS_);
}

function ensureInvestmentPortfolioComparisonsSheet_(optionalSs) {
  var ss = optionalSs || getUserSpreadsheet_();
  return ensureInvestmentSystemSheet_(ss, getSheetNames_().INVESTMENT_PORTFOLIO_COMPARISONS,
    INVESTMENT_PORTFOLIO_COMPARISON_HEADERS_, INVESTMENT_PORTFOLIO_COMPARISON_CANONICAL_WIDTHS_);
}

function ensureInvestmentPlansSheet_(optionalSs) {
  var ss = optionalSs || getUserSpreadsheet_();
  var name = getSheetNames_().INVESTMENT_PLANS;
  var existing = ss.getSheetByName(name);
  if (existing) {
    var boundaryHeader = String(existing.getRange(1, 9).getDisplayValue() || '').trim();
    if (boundaryHeader && boundaryHeader !== INVESTMENT_PLAN_HEADERS_[8]) {
      throw new Error(name + ' column 9 must be "' + INVESTMENT_PLAN_HEADERS_[8] + '".');
    }
    if (!boundaryHeader) {
      try {
        existing.getRange(1, 8).copyTo(existing.getRange(1, 9),
          SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
      } catch (_copyFormatErr) { /* header format is cosmetic */ }
      existing.getRange(1, 9).setValue(INVESTMENT_PLAN_HEADERS_[8]);
      existing.setColumnWidth(9, INVESTMENT_PLAN_CANONICAL_WIDTHS_[INVESTMENT_PLAN_HEADERS_[8]]);
    }
    return existing;
  }
  var sheet;
  try {
    sheet = ss.insertSheet(name);
  } catch (e) {
    var raced = ss.getSheetByName(name);
    if (raced) return raced;
    throw e;
  }
  sheet.getRange(1, 1, 1, INVESTMENT_PLAN_HEADERS_.length)
    .setValues([INVESTMENT_PLAN_HEADERS_]);
  applySysSheetBaseStyle_(sheet, INVESTMENT_PLAN_CANONICAL_WIDTHS_);
  try {
    sheet.getRange(2, 6, Math.max(1, sheet.getMaxRows() - 1), 1)
      .setNumberFormat('$#,##0.00;-$#,##0.00');
  } catch (_formatErr) { /* cosmetic only */ }
  return sheet;
}

function ensureInvestmentSystemSheet_(ss, sheetName, headers, widths) {
  var existing = ss.getSheetByName(sheetName);
  if (existing) return existing;
  var sheet;
  try {
    sheet = ss.insertSheet(sheetName);
  } catch (e) {
    var raced = ss.getSheetByName(sheetName);
    if (raced) return raced;
    throw e;
  }
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  applySysSheetBaseStyle_(sheet, widths);
  try {
    if (sheetName === getSheetNames_().INVESTMENT_ACTIVITY) {
      sheet.getRange(2, 4, Math.max(1, sheet.getMaxRows() - 1), 2)
        .setNumberFormat('yyyy-mm-dd');
      sheet.getRange(2, 8, Math.max(1, sheet.getMaxRows() - 1), 1)
        .setNumberFormat('0.000000');
      sheet.getRange(2, 9, Math.max(1, sheet.getMaxRows() - 1), 2)
        .setNumberFormat('$#,##0.00;-$#,##0.00');
    } else {
      sheet.getRange(2, 3, Math.max(1, sheet.getMaxRows() - 1), 1)
        .setNumberFormat('yyyy-mm-dd');
      sheet.getRange(2, 5, Math.max(1, sheet.getMaxRows() - 1), 1)
        .setNumberFormat('0.000000');
      sheet.getRange(2, 6, Math.max(1, sheet.getMaxRows() - 1), 5)
        .setNumberFormat('$#,##0.00;-$#,##0.00');
    }
  } catch (_formatErr) { /* cosmetic only */ }
  return sheet;
}

function fitInvestmentSystemSheetColumns_(sheet, headers, context) {
  fitContentColumnsToContents_((headers || []).map(function(_header, index) {
    return { sheet: sheet, col: index + 1 };
  }), context || 'investment system-sheet content fit');
}

function normalizeInvestmentPlanFrequency_(value, allowBlank) {
  var normalized = String(value || '').trim().toUpperCase();
  if (!normalized && allowBlank) return '';
  if (['WEEKLY', 'BIWEEKLY', 'MONTHLY'].indexOf(normalized) === -1) {
    throw new Error('Choose Weekly, Biweekly, or Monthly for the investment plan.');
  }
  return normalized;
}

function readInvestmentPlanRows_(ss, investmentId) {
  var sheet = ss.getSheetByName(getSheetNames_().INVESTMENT_PLANS);
  if (!sheet || sheet.getLastRow() < 2) return [];
  return sheet.getRange(2, 1, sheet.getLastRow() - 1,
    INVESTMENT_PLAN_HEADERS_.length).getValues().map(function(row, index) {
      return {
        sheetRow: index + 2,
        investmentId: String(row[0] || '').trim(),
        accountName: String(row[1] || '').trim(),
        ticker: normalizeInvestmentTicker_(row[2]),
        portfolioStatus: String(row[3] || '').trim().toUpperCase(),
        planFrequency: String(row[4] || '').trim().toUpperCase(),
        plannedAmount: Number(row[5]) || 0,
        planActive: String(row[6] || '').trim().toUpperCase() !== 'NO',
        updatedAt: String(row[7] || '').trim(),
        activityBoundaryDate: String(row[8] || '').trim()
      };
    }).filter(function(row) {
      return row.investmentId === investmentId && !!row.ticker;
    });
}

function investmentPlanRowsByTicker_(rows) {
  var result = {};
  (rows || []).forEach(function(row) {
    if (row && row.ticker) result[row.ticker] = row;
  });
  return result;
}

function readSavedInvestmentTickers_(ss, investmentId) {
  var result = {};
  var activity = ss.getSheetByName(getSheetNames_().INVESTMENT_ACTIVITY);
  if (activity && activity.getLastRow() >= 2) {
    activity.getRange(2, 1, activity.getLastRow() - 1,
      INVESTMENT_ACTIVITY_HEADERS_.length).getValues().forEach(function(row) {
      if (String(row[1] || '').trim() !== investmentId) return;
      var ticker = normalizeInvestmentTicker_(row[5]);
      if (ticker) result[ticker] = true;
    });
  }
  readInvestmentPlanRows_(ss, investmentId).forEach(function(row) {
    if (row.portfolioStatus === 'EXCLUDED') delete result[row.ticker];
    if (row.portfolioStatus === 'INCLUDED') result[row.ticker] = true;
  });
  return result;
}

function normalizeInvestmentTickerDecisions_(value) {
  var source = value && typeof value === 'object' ? value : {};
  var result = {};
  Object.keys(source).sort().forEach(function(rawTicker) {
    var ticker = normalizeInvestmentTicker_(rawTicker);
    var decision = String(source[rawTicker] || '').trim().toUpperCase();
    if (!ticker || ['INCLUDE', 'EXCLUDE'].indexOf(decision) === -1) return;
    result[ticker] = decision;
  });
  return result;
}

function investmentTickerDecisionsDigestPart_(decisions, boundaries) {
  return Object.keys(decisions || {}).sort().map(function(ticker) {
    return ticker + ':' + decisions[ticker] + ':' + String(boundaries && boundaries[ticker] || '');
  }).join('|');
}

function isInvestmentTickerReviewRow_(row, cutoff) {
  var code = String(row && row.transCode || '').toUpperCase();
  return !!(row && row.ticker && row.activityDate >= cutoff &&
    ['BUY', 'SELL', 'CDIV'].indexOf(code) !== -1 &&
    ['BTO', 'STC', 'STO', 'BTC'].indexOf(code) === -1 &&
    !/\b(call|put)\b/i.test(row.description));
}

function readLatestRecurringActivityByTicker_(ss, investmentId) {
  var result = {};
  var activity = ss.getSheetByName(getSheetNames_().INVESTMENT_ACTIVITY);
  if (!activity || activity.getLastRow() < 2) return result;
  activity.getRange(2, 1, activity.getLastRow() - 1,
    INVESTMENT_ACTIVITY_HEADERS_.length).getValues().forEach(function(row) {
    if (String(row[1] || '').trim() !== investmentId ||
        String(row[6] || '').trim() !== 'RECURRING_BUY') return;
    var ticker = normalizeInvestmentTicker_(row[5]);
    var activityDate = String(row[3] || '').trim();
    if (!ticker || !activityDate) return;
    if (!result[ticker] || activityDate > result[ticker].activityDate) {
      result[ticker] = { activityDate: activityDate, amount: 0 };
    }
    if (activityDate === result[ticker].activityDate) {
      result[ticker].amount = round2_(result[ticker].amount + Math.abs(Number(row[9]) || 0));
    }
  });
  return result;
}

function getInvestmentActivityImportSetupFromDashboard() {
  var config = getIncomeProducingAccountConfigurations_();
  return {
    accounts: (config.eligibleAccounts || []).map(function(row) {
      return {
        investmentId: row.investmentId,
        accountName: row.accountName,
        type: row.type
      };
    }),
    defaultCutoffDate: '',
    source: INVESTMENT_ACTIVITY_SOURCE_ROBINHOOD_
  };
}

function previewInvestmentActivityImportFromDashboard(payload, optionalSs) {
  payload = payload || {};
  var ss = optionalSs || getUserSpreadsheet_();
  var account = resolveEligibleInvestmentImportAccount_(ss, payload.investmentId);
  var requestedCutoff = String(payload.cutoffDate || '').trim();
  var rawCsv = String(payload.rawCsv || '');
  if (!rawCsv.trim()) throw new Error('Choose a Robinhood CSV file first.');
  if (rawCsv.length > INVESTMENT_ACTIVITY_MAX_CSV_CHARS_) {
    throw new Error('That CSV is too large. Use a file smaller than 2 MB.');
  }

  var rows;
  try {
    rows = Utilities.parseCsv(rawCsv);
  } catch (_parseErr) {
    throw new Error('CashCompass could not read that CSV. Export it again from Robinhood and retry.');
  }
  if (!rows || rows.length < 2) throw new Error('The CSV has no activity rows.');
  if (rows.length - 1 > INVESTMENT_ACTIVITY_MAX_ROWS_) {
    throw new Error('The CSV contains more than 5,000 activity rows. Import a smaller date range.');
  }

  var headers = rows[0].map(function(value, index) {
    var header = String(value || '').trim();
    return index === 0 ? header.replace(/^\uFEFF/, '') : header;
  });
  var required = ['Activity Date', 'Settle Date', 'Instrument', 'Description',
    'Trans Code', 'Quantity', 'Price', 'Amount'];
  var indexes = {};
  required.forEach(function(header) {
    var index = headers.indexOf(header);
    if (index === -1) throw new Error('Robinhood CSV is missing the "' + header + '" column.');
    indexes[header] = index;
  });

  var parsed = [];
  var preExcluded = [];
  var recurringUniverse = {};
  var dividendUniverse = {};
  for (var r = 1; r < rows.length; r++) {
    var raw = rows[r] || [];
    if (raw.join('').trim() === '') continue;
    var activityDateText = String(raw[indexes['Activity Date']] || '').trim();
    if (!activityDateText) {
      if (isInvestmentImportNonActivityFooter_(raw, indexes)) {
        preExcluded.push({ sourceRow: r + 1, reason: 'NON_ACTIVITY_FOOTER',
          ticker: '', transCode: '', activityDate: '' });
        continue;
      }
      throw new Error('Activity date is required in CSV row ' + (r + 1) + '.');
    }
    var ticker = normalizeInvestmentTicker_(raw[indexes['Instrument']]);
    var description = String(raw[indexes['Description']] || '').trim();
    var transCode = String(raw[indexes['Trans Code']] || '').trim();
    var recurring = /(^|\s)recurring(\s|$)/i.test(description);
    if (ticker && recurring && transCode.toLowerCase() === 'buy') recurringUniverse[ticker] = true;
    if (ticker && transCode.toUpperCase() === 'CDIV') dividendUniverse[ticker] = true;
    parsed.push({
      sourceRow: r + 1,
      activityDate: normalizeInvestmentImportDate_(activityDateText, 'Activity date'),
      settleDate: normalizeInvestmentImportDate_(raw[indexes['Settle Date']], 'Settle date', true),
      ticker: ticker,
      description: description,
      transCode: transCode,
      quantity: parseRobinhoodCsvQuantity_(raw[indexes['Quantity']], transCode, r + 1),
      price: parseInvestmentImportMoney_(raw[indexes['Price']]),
      amount: parseInvestmentImportMoney_(raw[indexes['Amount']]),
      recurring: recurring
    });
  }

  var detectionUniverse = {};
  Object.keys(recurringUniverse).forEach(function(ticker) { detectionUniverse[ticker] = true; });
  Object.keys(dividendUniverse).forEach(function(ticker) { detectionUniverse[ticker] = true; });
  var detectedCutoff = '';
  parsed.forEach(function(row) {
    var code = String(row.transCode || '').toUpperCase();
    if (!detectionUniverse[row.ticker] || (code !== 'BUY' && code !== 'SELL')) return;
    if (!detectedCutoff || row.activityDate < detectedCutoff) detectedCutoff = row.activityDate;
  });
  var cutoff = requestedCutoff
    ? normalizeInvestmentImportDate_(requestedCutoff, 'Start date')
    : detectedCutoff;
  if (!cutoff) throw new Error('CashCompass could not detect the portfolio start date. Enter it and preview again.');
  var tickerDecisions = normalizeInvestmentTickerDecisions_(payload.tickerDecisions);
  var planRowsByTicker = investmentPlanRowsByTicker_(
    readInvestmentPlanRows_(ss, account.investmentId));
  var universe = readSavedInvestmentTickers_(ss, account.investmentId);
  var reviewEligibleTickers = {};
  var latestReviewDateByTicker = {};
  parsed.forEach(function(row) {
    if (!isInvestmentTickerReviewRow_(row, cutoff)) return;
    reviewEligibleTickers[row.ticker] = true;
    if (!latestReviewDateByTicker[row.ticker] ||
        row.activityDate > latestReviewDateByTicker[row.ticker]) {
      latestReviewDateByTicker[row.ticker] = row.activityDate;
    }
  });
  Object.keys(tickerDecisions).forEach(function(ticker) {
    if (!reviewEligibleTickers[ticker]) {
      throw new Error('Ticker decision is no longer present in this CSV: ' + ticker + '. Preview again.');
    }
  });
  Object.keys(tickerDecisions).forEach(function(ticker) {
    if (tickerDecisions[ticker] === 'INCLUDE') universe[ticker] = true;
    if (tickerDecisions[ticker] === 'EXCLUDE') delete universe[ticker];
  });
  var reopenedExcludedTickers = {};
  parsed.forEach(function(row) {
    var plan = planRowsByTicker[row.ticker] || null;
    if (!plan || plan.portfolioStatus !== 'EXCLUDED' ||
        !isInvestmentTickerReviewRow_(row, cutoff) ||
        String(row.transCode || '').toUpperCase() !== 'BUY') return;
    if (!plan.activityBoundaryDate || row.activityDate > plan.activityBoundaryDate) {
      if (!reopenedExcludedTickers[row.ticker] ||
          row.activityDate < reopenedExcludedTickers[row.ticker]) {
        reopenedExcludedTickers[row.ticker] = row.activityDate;
      }
    }
  });
  var tickerDecisionBoundaries = {};
  Object.keys(tickerDecisions).forEach(function(ticker) {
    var existingPlan = planRowsByTicker[ticker] || null;
    if (tickerDecisions[ticker] === 'EXCLUDE') {
      tickerDecisionBoundaries[ticker] = String(latestReviewDateByTicker[ticker] || '');
      return;
    }
    var boundary = String(existingPlan && existingPlan.activityBoundaryDate || '');
    var reopenDate = reopenedExcludedTickers[ticker] || '';
    if (existingPlan && existingPlan.portfolioStatus === 'EXCLUDED' && reopenDate) {
      parsed.forEach(function(row) {
        if (row.ticker !== ticker || !isInvestmentTickerReviewRow_(row, cutoff) ||
            row.activityDate >= reopenDate) return;
        if (!boundary || row.activityDate > boundary) boundary = row.activityDate;
      });
    }
    tickerDecisionBoundaries[ticker] = boundary;
  });
  var candidateByTicker = {};
  parsed.forEach(function(row) {
    var ticker = row.ticker;
    var code = String(row.transCode || '').toUpperCase();
    if (!isInvestmentTickerReviewRow_(row, cutoff) || universe[ticker] ||
        tickerDecisions[ticker] === 'EXCLUDE') return;
    var priorPlan = planRowsByTicker[ticker] || null;
    if (priorPlan && priorPlan.portfolioStatus === 'EXCLUDED') {
      if (!reopenedExcludedTickers[ticker] ||
          row.activityDate < reopenedExcludedTickers[ticker]) return;
    }
    if (!candidateByTicker[ticker]) {
      candidateByTicker[ticker] = {
        ticker: ticker, activityCount: 0, purchaseAmount: 0,
        saleAmount: 0, dividendAmount: 0, recurringDetected: false,
        latestRecurringAmount: 0, latestRecurringDate: '', firstActivityDate: '',
        lastActivityDate: '', previouslyExcluded: !!(priorPlan &&
          priorPlan.portfolioStatus === 'EXCLUDED'),
        reviewedThroughDate: String(priorPlan && priorPlan.activityBoundaryDate || '')
      };
    }
    var candidate = candidateByTicker[ticker];
    candidate.activityCount++;
    if (!candidate.firstActivityDate || row.activityDate < candidate.firstActivityDate) {
      candidate.firstActivityDate = row.activityDate;
    }
    if (!candidate.lastActivityDate || row.activityDate > candidate.lastActivityDate) {
      candidate.lastActivityDate = row.activityDate;
    }
    if (code === 'BUY') candidate.purchaseAmount += Math.abs(row.amount);
    if (code === 'SELL') candidate.saleAmount += Math.abs(row.amount);
    if (code === 'CDIV') candidate.dividendAmount += Math.abs(row.amount);
    if (code === 'BUY' && row.recurring) {
      if (row.activityDate > candidate.latestRecurringDate) {
        candidate.latestRecurringDate = row.activityDate;
        candidate.latestRecurringAmount = 0;
      }
      if (row.activityDate === candidate.latestRecurringDate) {
        candidate.latestRecurringAmount += Math.abs(row.amount);
      }
      candidate.recurringDetected = true;
    }
  });
  var newTickerCandidates = Object.keys(candidateByTicker).sort().map(function(ticker) {
    var row = candidateByTicker[ticker];
    row.purchaseAmount = round2_(row.purchaseAmount);
    row.saleAmount = round2_(row.saleAmount);
    row.dividendAmount = round2_(row.dividendAmount);
    row.latestRecurringAmount = round2_(row.latestRecurringAmount);
    return row;
  });
  var savedRecurringByTicker = readLatestRecurringActivityByTicker_(
    ss, account.investmentId);
  var latestRecurringInFile = {};
  parsed.forEach(function(row) {
    if (!row.ticker || !universe[row.ticker] || !row.recurring ||
        String(row.transCode || '').toUpperCase() !== 'BUY' ||
        row.activityDate < cutoff) return;
    if (!latestRecurringInFile[row.ticker] ||
        row.activityDate > latestRecurringInFile[row.ticker].activityDate) {
      latestRecurringInFile[row.ticker] = { activityDate: row.activityDate, amount: 0 };
    }
    if (row.activityDate === latestRecurringInFile[row.ticker].activityDate) {
      latestRecurringInFile[row.ticker].amount = round2_(
        latestRecurringInFile[row.ticker].amount + Math.abs(row.amount));
    }
  });
  var recurringPlanChanges = Object.keys(latestRecurringInFile).sort().filter(function(ticker) {
    var saved = savedRecurringByTicker[ticker];
    return !saved || latestRecurringInFile[ticker].activityDate > saved.activityDate;
  }).map(function(ticker) {
    var saved = savedRecurringByTicker[ticker] || null;
    var latest = latestRecurringInFile[ticker];
    var plan = planRowsByTicker[ticker] || null;
    return {
      ticker: ticker,
      previousDetectedAmount: saved ? saved.amount : 0,
      previousDetectedDate: saved ? saved.activityDate : '',
      newDetectedAmount: latest.amount,
      newDetectedDate: latest.activityDate,
      planConfigured: !!(plan && plan.planFrequency),
      planFrequency: plan ? plan.planFrequency : '',
      plannedAmount: plan ? plan.plannedAmount : 0,
      planActive: plan ? plan.planActive : true
    };
  });
  var administrativeOffsets = {};
  parsed.forEach(function(row) {
    if (String(row.transCode || '').toUpperCase() !== 'GOLD' || row.amount >= 0) return;
    administrativeOffsets[row.activityDate + '|' + round2_(Math.abs(row.amount))] = true;
  });
  var activityBoundaryByTicker = {};
  Object.keys(universe).forEach(function(ticker) {
    var plan = planRowsByTicker[ticker] || null;
    var boundary = tickerDecisions[ticker] === 'INCLUDE'
      ? tickerDecisionBoundaries[ticker]
      : String(plan && plan.activityBoundaryDate || '');
    if (boundary) activityBoundaryByTicker[ticker] = boundary;
  });
  var accepted = [];
  var excluded = preExcluded.slice();
  parsed.forEach(function(row) {
    if (universe[row.ticker] && activityBoundaryByTicker[row.ticker] &&
        row.activityDate <= activityBoundaryByTicker[row.ticker] &&
        isInvestmentTickerReviewRow_(row, cutoff)) {
      excluded.push({ sourceRow: row.sourceRow, reason: 'BEFORE_TICKER_BOUNDARY',
        ticker: row.ticker, transCode: row.transCode, activityDate: row.activityDate });
      return;
    }
    var classification = classifyInvestmentImportRow_(row, cutoff, universe, administrativeOffsets);
    if (!classification.accepted) {
      excluded.push({ sourceRow: row.sourceRow, reason: classification.reason,
        ticker: row.ticker, transCode: row.transCode, activityDate: row.activityDate });
      return;
    }
    row.activityType = classification.activityType;
    row.importKey = buildInvestmentActivityImportKey_(account.investmentId, row);
    accepted.push(row);
  });

  // A broker funding transfer can settle shortly before the first portfolio
  // trade. Preserve qualifying ACH evidence as opening capital effective on
  // the chosen strategy start date, while the original pre-start row remains
  // excluded from dated activity. This keeps the ledger self-contained and
  // avoids treating unrelated trading proceeds as family contributions.
  parsed.forEach(function(row) {
    var code = String(row.transCode || '').toUpperCase();
    if (code !== 'ACH' || !/ACH Deposit/i.test(row.description) || row.amount <= 0) return;
    if (row.activityDate >= cutoff) return;
    var daysBefore = investmentImportDayNumber_(cutoff) -
      investmentImportDayNumber_(row.activityDate);
    if (daysBefore < 0 || daysBefore > 14) return;
    if (administrativeOffsets[row.activityDate + '|' + round2_(Math.abs(row.amount))]) return;
    var opening = {
      sourceRow: row.sourceRow,
      activityDate: cutoff,
      settleDate: '',
      ticker: '',
      description: 'Opening capital detected from prior ACH deposit dated ' + row.activityDate,
      transCode: 'OPENING_CAPITAL',
      quantity: 0,
      price: 0,
      amount: row.amount,
      recurring: false,
      activityType: 'OPENING_CAPITAL'
    };
    opening.importKey = buildInvestmentActivityImportKey_(account.investmentId, opening);
    accepted.push(opening);
  });

  if (!accepted.length && !newTickerCandidates.length) {
    throw new Error('No supported long-term portfolio activity was found on or after ' + cutoff + '.');
  }
  var digest = investmentImportDigest_(account.investmentId, cutoff, rawCsv,
    investmentTickerDecisionsDigestPart_(tickerDecisions, tickerDecisionBoundaries));
  var summary = summarizeInvestmentImportPreview_(accepted, excluded, universe);
  return {
    investmentId: account.investmentId,
    accountName: account.accountName,
    cutoffDate: cutoff,
    digest: digest,
    acceptedRows: accepted,
    excludedRows: excluded,
    newTickerCandidates: newTickerCandidates,
    appliedTickerDecisions: tickerDecisions,
    tickerDecisionBoundaries: tickerDecisionBoundaries,
    requiresTickerDecisions: newTickerCandidates.length > 0,
    recurringPlanChanges: recurringPlanChanges,
    summary: summary,
    portfolioComparison: investmentActivityBuildRobinhoodPortfolioComparisonPreview_(
      ss, account.investmentId, accepted)
  };
}

function isInvestmentImportNonActivityFooter_(raw, indexes) {
  var transactionHeaders = [
    'Instrument', 'Description', 'Trans Code', 'Quantity', 'Price', 'Amount'
  ];
  return transactionHeaders.every(function(header) {
    return !String(raw[indexes[header]] || '').trim();
  });
}

function importInvestmentActivityFromDashboard(payload, optionalSs) {
  payload = payload || {};
  var ss = optionalSs || getUserSpreadsheet_();
  var lock = LockService.getUserLock();
  if (!lock.tryLock(15000)) {
    throw new Error('Another investment change is in progress. Please try again in a moment.');
  }
  var activitySheet = null;
  var appendedStart = 0;
  var appendedCount = 0;
  var decisionAppend = null;
  try {
    var preview = previewInvestmentActivityImportFromDashboard(payload, ss);
    if (!payload.expectedDigest || String(payload.expectedDigest) !== preview.digest) {
      throw new Error('The CSV or import settings changed after preview. Preview it again before saving.');
    }
    if (preview.requiresTickerDecisions) {
      throw new Error('Review every new ticker and update the Preview before saving.');
    }
    activitySheet = ensureInvestmentActivitySheet_(ss);
    ensureInvestmentHoldingsSheet_(ss);
    var existingKeys = readInvestmentActivityImportKeys_(activitySheet);
    var now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
    var newRows = [];
    preview.acceptedRows.forEach(function(row) {
      if (existingKeys[row.importKey]) return;
      newRows.push([
        row.importKey, preview.investmentId, preview.accountName,
        row.activityDate, row.settleDate, row.ticker, row.activityType,
        row.quantity, row.price, row.amount, row.recurring ? 'Yes' : 'No',
        row.description, INVESTMENT_ACTIVITY_SOURCE_ROBINHOOD_, now
      ]);
    });
    if (newRows.length) {
      appendedStart = activitySheet.getLastRow() + 1;
      appendedCount = newRows.length;
      activitySheet.getRange(appendedStart, 1, newRows.length,
        INVESTMENT_ACTIVITY_HEADERS_.length).setValues(newRows);
    }
    fitInvestmentSystemSheetColumns_(activitySheet, INVESTMENT_ACTIVITY_HEADERS_,
      'investment activity import content fit');
    var priorHoldings = getInvestmentHoldingsSummary_(ss, preview.investmentId);
    var priorSummary = investmentActivitySummarizeSavedHoldingsPortfolio_(priorHoldings);
    var priorAsOfDate = investmentActivityLatestHoldingsAsOfDate_(priorHoldings);
    var hadPriorPortfolio = investmentActivityRobinhoodPortfolioHadPriorHoldings_(
      priorHoldings, priorSummary);
    rebuildInvestmentHoldingsForAccount_(ss, preview.investmentId, preview.accountName);
    decisionAppend = saveInvestmentTickerDecisions_(ss, {
      investmentId: preview.investmentId,
      accountName: preview.accountName
    }, preview.appliedTickerDecisions, preview.tickerDecisionBoundaries);
    var savedPortfolioComparison = investmentActivityBuildRobinhoodPortfolioComparisonForDrawer_(null);
    if (hadPriorPortfolio) {
      var currentHoldings = getInvestmentHoldingsSummary_(ss, preview.investmentId);
      var currentSummary = investmentActivitySummarizeSavedHoldingsPortfolio_(currentHoldings);
      var comparisonDate = investmentActivityLatestHoldingsAsOfDate_(currentHoldings) ||
        preview.cutoffDate;
      investmentActivityWriteRobinhoodPortfolioComparison_(ss, {
        investmentId: preview.investmentId,
        accountName: preview.accountName,
        comparisonDate: comparisonDate,
        priorAsOfDate: priorAsOfDate,
        priorMarketValue: priorSummary.marketValueTotal,
        currentMarketValue: currentSummary.marketValueTotal,
        priorHoldingsCount: priorSummary.holdingsCount,
        currentHoldingsCount: currentSummary.holdingsCount,
        priorCash: priorSummary.cashBalance,
        currentCash: currentSummary.cashBalance,
        importDigest: preview.digest
      });
      savedPortfolioComparison = investmentActivityBuildRobinhoodPortfolioComparisonForDrawer_(
        investmentActivityReadRobinhoodPortfolioComparison_(ss, preview.investmentId));
    }
    try {
      appendActivityLog_(ss, {
        eventType: 'investment_activity_import', entryDate: preview.cutoffDate,
        amount: preview.summary.totalCapitalAdded, direction: 'INFO',
        payee: preview.accountName, category: 'Investments',
        accountSource: preview.accountName,
        dedupeKey: 'investment_activity_import::' + preview.investmentId + '::' + preview.digest,
        details: {
          investmentId: preview.investmentId,
          acceptedRows: preview.summary.acceptedCount,
          appendedRows: newRows.length,
          duplicateRows: preview.summary.acceptedCount - newRows.length,
          excludedRows: preview.summary.excludedCount,
          tickerDecisions: preview.appliedTickerDecisions,
          source: INVESTMENT_ACTIVITY_SOURCE_ROBINHOOD_
        }
      });
    } catch (_auditErr) { /* appendActivityLog_ is best-effort */ }
    return {
      ok: true,
      message: newRows.length
        ? 'Import complete: ' + newRows.length + ' new activities saved.'
        : 'Import complete: every supported activity was already saved.',
      appendedRows: newRows.length,
      duplicateRows: preview.summary.acceptedCount - newRows.length,
      summary: preview.summary,
      holdings: getInvestmentHoldingsSummary_(ss, preview.investmentId),
      savedPortfolioComparison: savedPortfolioComparison
    };
  } catch (e) {
    var rollbackProblems = [];
    if (decisionAppend && decisionAppend.sheet && decisionAppend.rowCount > 0) {
      try {
        decisionAppend.sheet.deleteRows(decisionAppend.startRow, decisionAppend.rowCount);
      } catch (_decisionRollbackErr) {
        rollbackProblems.push('portfolio decisions');
      }
    }
    if (decisionAppend && decisionAppend.updatedRows) {
      try {
        decisionAppend.updatedRows.forEach(function(change) {
          decisionAppend.sheet.getRange(change.row, 1, 1, INVESTMENT_PLAN_HEADERS_.length)
            .setValues([change.previous]);
        });
      } catch (_decisionUpdateRollbackErr) {
        rollbackProblems.push('portfolio decision updates');
      }
    }
    if (activitySheet && appendedStart >= 2 && appendedCount > 0) {
      try {
        activitySheet.deleteRows(appendedStart, appendedCount);
        if (preview && preview.investmentId) {
          rebuildInvestmentHoldingsForAccount_(ss, preview.investmentId, preview.accountName);
        }
      } catch (_rollbackErr) {
        rollbackProblems.push('activity and holdings');
      }
    }
    if (rollbackProblems.length) {
      throw new Error((e.message || String(e)) + ' Rollback could not be confirmed for: ' +
        rollbackProblems.join(', ') + '.');
    }
    throw e;
  } finally {
    lock.releaseLock();
  }
}

function resolveEligibleInvestmentImportAccount_(ss, investmentId) {
  var wanted = String(investmentId || '').trim();
  if (!wanted) throw new Error('Select an Income-Producing account.');
  var config = getIncomeProducingAccountConfigurations_(ss);
  var matches = (config.eligibleAccounts || []).filter(function(row) {
    return row.investmentId === wanted;
  });
  if (matches.length !== 1) {
    throw new Error('That account is not an active Income-Producing account. Refresh Setup and try again.');
  }
  return matches[0];
}

function normalizeInvestmentImportDate_(value, label, allowBlank) {
  var text = String(value || '').trim();
  if (!text && allowBlank) return '';
  if (!text) throw new Error((label || 'Date') + ' is required.');
  var iso = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    var isoDate = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    if (isoDate.getFullYear() !== Number(iso[1]) ||
        isoDate.getMonth() !== Number(iso[2]) - 1 ||
        isoDate.getDate() !== Number(iso[3])) {
      throw new Error((label || 'Date') + ' is invalid: ' + text);
    }
    return iso[1] + '-' + iso[2] + '-' + iso[3];
  }
  var us = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!us) throw new Error((label || 'Date') + ' is invalid: ' + text);
  var month = ('0' + us[1]).slice(-2);
  var day = ('0' + us[2]).slice(-2);
  var normalized = us[3] + '-' + month + '-' + day;
  var date = new Date(Number(us[3]), Number(us[1]) - 1, Number(us[2]));
  if (date.getFullYear() !== Number(us[3]) || date.getMonth() !== Number(us[1]) - 1 ||
      date.getDate() !== Number(us[2])) {
    throw new Error((label || 'Date') + ' is invalid: ' + text);
  }
  return normalized;
}

function investmentImportDayNumber_(isoDate) {
  var parts = String(isoDate || '').split('-');
  return Math.floor(Date.UTC(Number(parts[0]), Number(parts[1]) - 1,
    Number(parts[2])) / 86400000);
}

function parseInvestmentImportMoney_(value) {
  var text = String(value || '').trim();
  if (!text) return 0;
  var negative = text.indexOf('(') !== -1 || text.indexOf('-') !== -1;
  var numeric = Number(text.replace(/[\$(),\s-]/g, ''));
  if (!isFinite(numeric)) throw new Error('Invalid money value in investment CSV: ' + text);
  return round2_(negative ? -numeric : numeric);
}

function parseInvestmentImportNumber_(value) {
  var text = String(value || '').trim();
  if (!text) return 0;
  var numeric = Number(text.replace(/,/g, ''));
  if (!isFinite(numeric)) throw new Error('Invalid quantity in investment CSV: ' + text);
  return numeric;
}

var ROBINHOOD_CSV_SHARE_SUFFIX_QUANTITY_CODES_ = {
  SXCH: true,
  CONV: true,
  MRGS: true,
  SPL: true,
  SPR: true
};

var ROBINHOOD_CSV_NON_SHARE_QUANTITY_CODES_ = {
  OEXP: true
};

/**
 * Parse Robinhood activity CSV Quantity values for portfolio math.
 *
 * Robinhood appends a trailing "S" on some rows. For corporate actions such as SXCH,
 * the suffix marks share quantity (for example "1S" is one share). For option expiration
 * (OEXP), the suffix is not portfolio share quantity and must not be coerced to 1.
 */
function parseRobinhoodCsvQuantity_(value, transCode, sourceRow) {
  sourceRow = Number(sourceRow) || 0;
  transCode = String(transCode || '').trim().toUpperCase();
  var text = String(value || '').trim();
  if (!text) return 0;
  var suffixMatch = text.match(/^(-?\d+(?:\.\d+)?)(S)$/i);
  if (suffixMatch) {
    if (ROBINHOOD_CSV_NON_SHARE_QUANTITY_CODES_[transCode]) {
      return 0;
    }
    if (!ROBINHOOD_CSV_SHARE_SUFFIX_QUANTITY_CODES_[transCode]) {
      throw new Error(
        'Robinhood CSV row ' + sourceRow + ': quantity "' + text +
        '" uses Robinhood\'s "S" suffix, but Trans Code "' + (transCode || '(blank)') +
        '" is not a supported share-quantity row. Review the row or export a fresh activity report.'
      );
    }
    text = suffixMatch[1];
  }
  var numeric = Number(text.replace(/,/g, ''));
  if (!isFinite(numeric)) {
    throw new Error(
      'Robinhood CSV row ' + sourceRow + ': quantity is not a valid share count for Trans Code "' +
      (transCode || '(blank)') + '".'
    );
  }
  return numeric;
}

function normalizeInvestmentTicker_(value) {
  var ticker = String(value || '').trim().toUpperCase();
  return /^[A-Z][A-Z0-9.\-]{0,14}$/.test(ticker) ? ticker : '';
}

function classifyInvestmentImportRow_(row, cutoff, universe, administrativeOffsets) {
  if (row.activityDate < cutoff) return { accepted: false, reason: 'BEFORE_START_DATE' };
  var code = String(row.transCode || '').toUpperCase();
  if (code === 'OEXP' || code === 'BTO' || code === 'STC' || code === 'STO' || code === 'BTC' ||
      /\b(call|put)\b/i.test(row.description)) {
    return { accepted: false, reason: 'OPTIONS_ACTIVITY' };
  }
  if (code === 'ACH' && /ACH Deposit/i.test(row.description) && row.amount > 0) {
    if (administrativeOffsets &&
        administrativeOffsets[row.activityDate + '|' + round2_(Math.abs(row.amount))]) {
      return { accepted: false, reason: 'CASH_OR_ADMIN' };
    }
    return { accepted: true, activityType: 'CONTRIBUTION' };
  }
  if (!row.ticker || !universe[row.ticker]) {
    return { accepted: false, reason: row.ticker ? 'OUTSIDE_PORTFOLIO' : 'CASH_OR_ADMIN' };
  }
  if (code === 'CDIV' && row.amount > 0) return { accepted: true, activityType: 'DIVIDEND' };
  if (code === 'SXCH' || code === 'CONV' || code === 'MRGS' || code === 'SPL' || code === 'SPR') {
    if (!(Number(row.quantity) > 0)) {
      return { accepted: false, reason: 'UNSUPPORTED_ACTIVITY' };
    }
    return { accepted: true, activityType: 'CORPORATE_ACTION_IN' };
  }
  if (code === 'BUY') {
    return { accepted: true, activityType: row.recurring ? 'RECURRING_BUY' : 'BUY' };
  }
  if (code === 'SELL') return { accepted: true, activityType: 'SELL' };
  return { accepted: false, reason: 'UNSUPPORTED_ACTIVITY' };
}

function buildInvestmentActivityImportKey_(investmentId, row) {
  return investmentImportDigest_(investmentId, row.activityDate, [
    row.settleDate, row.ticker, row.transCode, row.quantity, row.price,
    row.amount, row.description
  ].join('|'));
}

function investmentImportDigest_() {
  var value = Array.prototype.slice.call(arguments).join('||');
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, value,
    Utilities.Charset.UTF_8);
  return bytes.map(function(byte) {
    var normalized = byte < 0 ? byte + 256 : byte;
    return ('0' + normalized.toString(16)).slice(-2);
  }).join('');
}

function investmentActivityPortfolioDeltaDirection_(delta) {
  if (delta == null || !isFinite(delta)) return null;
  if (delta > 0) return 'up';
  if (delta < 0) return 'down';
  return 'flat';
}

function investmentActivityBuildPortfolioDeltaEntry_(delta) {
  if (delta == null || !isFinite(delta)) return null;
  return {
    delta: delta,
    direction: investmentActivityPortfolioDeltaDirection_(delta)
  };
}

function investmentActivityAggregateHoldingsFromRows_(rows) {
  var aggregate = Object.create(null);
  var asOfDate = '';
  (rows || []).forEach(function(row) {
    row = row || {};
    var ticker = String(row.ticker || '').trim();
    var activityType = String(row.activityType || '').trim();
    var activityDate = String(row.activityDate || '').trim();
    if (activityDate > asOfDate) asOfDate = activityDate;
    if (!ticker) return;
    if (!aggregate[ticker]) {
      aggregate[ticker] = { quantity: 0, lastPrice: 0, count: 0 };
    }
    var item = aggregate[ticker];
    var quantity = Number(row.quantity) || 0;
    var price = Number(row.price) || 0;
    item.count += 1;
    if (price > 0) item.lastPrice = price;
    if (activityType === 'BUY' || activityType === 'RECURRING_BUY' ||
        activityType === 'CORPORATE_ACTION_IN') {
      item.quantity += quantity;
    } else if (activityType === 'SELL') {
      item.quantity -= quantity;
    }
  });
  return { aggregate: aggregate, asOfDate: asOfDate };
}

function investmentActivitySummarizeAggregatePortfolio_(aggregateResult) {
  aggregateResult = aggregateResult || {};
  var aggregate = aggregateResult.aggregate || Object.create(null);
  var marketValueTotal = 0;
  var holdingsCount = 0;
  Object.keys(aggregate).forEach(function(ticker) {
    var item = aggregate[ticker] || {};
    if (!(Number(item.quantity) > 0)) return;
    holdingsCount += 1;
    var price = Number(item.lastPrice) || 0;
    if (price > 0) marketValueTotal += Number(item.quantity) * price;
  });
  return {
    marketValueTotal: marketValueTotal,
    holdingsCount: holdingsCount,
    cashBalance: null
  };
}

function investmentActivitySummarizeSavedHoldingsPortfolio_(holdings) {
  var marketValueTotal = 0;
  var holdingsCount = 0;
  (holdings || []).forEach(function(row) {
    row = row || {};
    var quantity = Number(row.quantity) || 0;
    if (!(quantity > 0)) return;
    holdingsCount += 1;
    var price = Number(row.lastActivityPrice) || 0;
    if (price > 0) marketValueTotal += quantity * price;
  });
  return {
    marketValueTotal: marketValueTotal,
    holdingsCount: holdingsCount,
    cashBalance: null
  };
}

function investmentActivityLatestHoldingsAsOfDate_(holdings) {
  var latest = '';
  (holdings || []).forEach(function(row) {
    var asOf = String(row && row.asOfDate || '').trim().slice(0, 10);
    if (asOf && (!latest || asOf > latest)) latest = asOf;
  });
  return latest;
}

function investmentActivityRobinhoodPortfolioHadPriorHoldings_(holdings, summary) {
  summary = summary || investmentActivitySummarizeSavedHoldingsPortfolio_(holdings);
  if (Number(summary.holdingsCount) > 0) return true;
  return (holdings || []).some(function(row) {
    return Number(row && row.quantity) > 0;
  });
}

function investmentActivityNormalizePortfolioComparisonNumber_(value) {
  if (value == null || value === '') return '';
  var numeric = Number(value);
  return isFinite(numeric) ? round2_(numeric) : '';
}

function investmentActivityWriteRobinhoodPortfolioComparison_(ss, record) {
  record = record || {};
  var investmentId = String(record.investmentId || '').trim();
  if (!investmentId) return null;
  var sheet = ensureInvestmentPortfolioComparisonsSheet_(ss);
  var now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
  var rowValues = [
    investmentId,
    String(record.accountName || '').trim(),
    String(record.comparisonDate || '').trim(),
    String(record.priorAsOfDate || '').trim(),
    investmentActivityNormalizePortfolioComparisonNumber_(record.priorMarketValue),
    investmentActivityNormalizePortfolioComparisonNumber_(record.currentMarketValue),
    Number(record.priorHoldingsCount) || 0,
    Number(record.currentHoldingsCount) || 0,
    investmentActivityNormalizePortfolioComparisonNumber_(record.priorCash),
    investmentActivityNormalizePortfolioComparisonNumber_(record.currentCash),
    String(record.importDigest || '').trim(),
    now
  ];
  var targetRow = 0;
  if (sheet.getLastRow() >= 2) {
    var existing = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getDisplayValues();
    existing.forEach(function(row, index) {
      if (targetRow) return;
      if (String(row[0] || '').trim() === investmentId) targetRow = index + 2;
    });
  }
  if (targetRow) {
    sheet.getRange(targetRow, 1, 1, INVESTMENT_PORTFOLIO_COMPARISON_HEADERS_.length)
      .setValues([rowValues]);
  } else {
    targetRow = sheet.getLastRow() + 1;
    sheet.getRange(targetRow, 1, 1, INVESTMENT_PORTFOLIO_COMPARISON_HEADERS_.length)
      .setValues([rowValues]);
  }
  fitInvestmentSystemSheetColumns_(sheet, INVESTMENT_PORTFOLIO_COMPARISON_HEADERS_,
    'investment portfolio comparison content fit');
  return { sheetRow: targetRow, investmentId: investmentId };
}

function investmentActivityReadRobinhoodPortfolioComparison_(ss, investmentId) {
  investmentId = String(investmentId || '').trim();
  if (!investmentId) return null;
  var sheet = ss.getSheetByName(getSheetNames_().INVESTMENT_PORTFOLIO_COMPARISONS);
  if (!sheet || sheet.getLastRow() < 2) return null;
  var rows = sheet.getRange(2, 1, sheet.getLastRow() - 1,
    INVESTMENT_PORTFOLIO_COMPARISON_HEADERS_.length).getValues();
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][0] || '').trim() !== investmentId) continue;
    return {
      investmentId: investmentId,
      accountName: String(rows[i][1] || '').trim(),
      comparisonDate: String(rows[i][2] || '').trim(),
      priorAsOfDate: String(rows[i][3] || '').trim(),
      priorMarketValue: Number(rows[i][4]) || 0,
      currentMarketValue: Number(rows[i][5]) || 0,
      priorHoldingsCount: Number(rows[i][6]) || 0,
      currentHoldingsCount: Number(rows[i][7]) || 0,
      priorCash: rows[i][8] === '' || rows[i][8] == null ? null : Number(rows[i][8]),
      currentCash: rows[i][9] === '' || rows[i][9] == null ? null : Number(rows[i][9]),
      importDigest: String(rows[i][10] || '').trim(),
      updatedAt: String(rows[i][11] || '').trim()
    };
  }
  return null;
}

function investmentActivityBuildRobinhoodPortfolioComparisonForDrawer_(record) {
  if (!record) {
    return {
      status: 'NO_PRIOR',
      label: 'Change from previous portfolio',
      comparisonDate: '',
      portfolioValue: null,
      marketValue: null,
      cash: null,
      holdingsCount: null
    };
  }
  var marketDelta = round2_(Number(record.currentMarketValue) - Number(record.priorMarketValue));
  var holdingsDelta = Number(record.currentHoldingsCount) - Number(record.priorHoldingsCount);
  var cashDelta = null;
  if (record.priorCash != null && record.currentCash != null &&
      isFinite(Number(record.priorCash)) && isFinite(Number(record.currentCash))) {
    cashDelta = round2_(Number(record.currentCash) - Number(record.priorCash));
  }
  var unchanged = marketDelta === 0 &&
    holdingsDelta === 0 &&
    (cashDelta == null || cashDelta === 0);
  return {
    status: unchanged ? 'UNCHANGED' : 'HAS_DELTA',
    label: 'Change from previous portfolio',
    comparisonDate: String(record.comparisonDate || '').trim(),
    priorAsOfDate: String(record.priorAsOfDate || '').trim(),
    portfolioValue: round2_(Number(record.currentMarketValue)),
    priorPortfolioValue: round2_(Number(record.priorMarketValue)),
    marketValue: investmentActivityBuildPortfolioDeltaEntry_(marketDelta),
    cash: investmentActivityBuildPortfolioDeltaEntry_(cashDelta),
    holdingsCount: investmentActivityBuildPortfolioDeltaEntry_(holdingsDelta)
  };
}

function investmentActivityReadSavedActivityRowsForAccount_(ss, investmentId) {
  investmentId = String(investmentId || '').trim();
  if (!investmentId) return [];
  var sheet = ss.getSheetByName(getSheetNames_().INVESTMENT_ACTIVITY);
  if (!sheet || sheet.getLastRow() < 2) return [];
  return sheet.getRange(2, 1, sheet.getLastRow() - 1, INVESTMENT_ACTIVITY_HEADERS_.length)
    .getValues()
    .filter(function(row) {
      return String(row[1] || '').trim() === investmentId;
    })
    .map(function(row) {
      return {
        importKey: String(row[0] || '').trim(),
        activityDate: String(row[3] || '').trim(),
        ticker: String(row[5] || '').trim(),
        activityType: String(row[6] || '').trim(),
        quantity: Number(row[7]) || 0,
        price: Number(row[8]) || 0,
        amount: Number(row[9]) || 0
      };
    });
}

function investmentActivityMergePreviewAcceptedActivity_(savedRows, acceptedPreviewRows) {
  var keys = Object.create(null);
  (savedRows || []).forEach(function(row) {
    if (row && row.importKey) keys[row.importKey] = true;
  });
  var merged = (savedRows || []).slice();
  (acceptedPreviewRows || []).forEach(function(row) {
    row = row || {};
    if (!row.importKey || keys[row.importKey]) return;
    merged.push({
      importKey: row.importKey,
      activityDate: row.activityDate,
      ticker: row.ticker,
      activityType: row.activityType,
      quantity: row.quantity,
      price: row.price,
      amount: row.amount
    });
  });
  return merged;
}

function investmentActivityBuildRobinhoodPortfolioComparisonPreview_(ss, investmentId, acceptedPreviewRows) {
  investmentId = String(investmentId || '').trim();
  var label = 'Change from current portfolio';
  if (!investmentId) {
    return {
      status: 'NO_BASELINE',
      label: label,
      marketValue: null,
      cash: null,
      holdingsCount: null
    };
  }

  var currentHoldings = getInvestmentHoldingsSummary_(ss, investmentId);
  if (!currentHoldings.length) {
    return {
      status: 'NO_BASELINE',
      label: label,
      marketValue: null,
      cash: null,
      holdingsCount: null
    };
  }

  var current = investmentActivitySummarizeSavedHoldingsPortfolio_(currentHoldings);
  var savedActivity = investmentActivityReadSavedActivityRowsForAccount_(ss, investmentId);
  var proposedActivity = investmentActivityMergePreviewAcceptedActivity_(
    savedActivity, acceptedPreviewRows);
  var proposed = investmentActivitySummarizeAggregatePortfolio_(
    investmentActivityAggregateHoldingsFromRows_(proposedActivity));

  var marketDelta = Number(proposed.marketValueTotal) - Number(current.marketValueTotal);
  var holdingsDelta = Number(proposed.holdingsCount) - Number(current.holdingsCount);
  var cashDelta = null;
  if (proposed.cashBalance != null && current.cashBalance != null &&
      isFinite(Number(proposed.cashBalance)) && isFinite(Number(current.cashBalance))) {
    cashDelta = Number(proposed.cashBalance) - Number(current.cashBalance);
  }

  var unchanged = marketDelta === 0 &&
    (cashDelta == null || cashDelta === 0) &&
    holdingsDelta === 0;

  return {
    status: unchanged ? 'UNCHANGED' : 'HAS_DELTA',
    label: label,
    currentPortfolioValue: current.marketValueTotal,
    marketValue: investmentActivityBuildPortfolioDeltaEntry_(marketDelta),
    cash: investmentActivityBuildPortfolioDeltaEntry_(cashDelta),
    holdingsCount: investmentActivityBuildPortfolioDeltaEntry_(holdingsDelta)
  };
}

function summarizeInvestmentImportPreview_(accepted, excluded, universe) {
  var summary = {
    acceptedCount: accepted.length,
    excludedCount: excluded.length,
    contributions: 0,
    openingCapital: 0,
    totalCapitalAdded: 0,
    purchases: 0,
    dividends: 0,
    sales: 0,
    firstActivityDate: '',
    lastActivityDate: '',
    tickers: Object.keys(universe).sort(),
    excludedByReason: {}
  };
  accepted.forEach(function(row) {
    if (!summary.firstActivityDate || row.activityDate < summary.firstActivityDate) {
      summary.firstActivityDate = row.activityDate;
    }
    if (!summary.lastActivityDate || row.activityDate > summary.lastActivityDate) {
      summary.lastActivityDate = row.activityDate;
    }
    if (row.activityType === 'CONTRIBUTION') summary.contributions += row.amount;
    if (row.activityType === 'OPENING_CAPITAL') summary.openingCapital += row.amount;
    if (row.activityType === 'DIVIDEND') summary.dividends += row.amount;
    if (row.activityType === 'SELL') summary.sales += row.amount;
    if (row.activityType === 'BUY' || row.activityType === 'RECURRING_BUY') {
      summary.purchases += Math.abs(row.amount);
    }
  });
  var openingPurchases = 0;
  var openingContributions = 0;
  accepted.forEach(function(row) {
    if (row.activityDate !== summary.firstActivityDate) return;
    if (row.activityType === 'BUY' || row.activityType === 'RECURRING_BUY') {
      openingPurchases += Math.abs(row.amount);
    }
    if (row.activityType === 'CONTRIBUTION') openingContributions += row.amount;
  });
  summary.openingCapital = round2_(summary.openingCapital);
  summary.incidentalProceedsInvested = round2_(Math.max(0,
    openingPurchases - openingContributions - summary.openingCapital));
  excluded.forEach(function(row) {
    summary.excludedByReason[row.reason] = (summary.excludedByReason[row.reason] || 0) + 1;
  });
  summary.contributions = round2_(summary.contributions);
  summary.totalCapitalAdded = round2_(summary.contributions + summary.openingCapital);
  summary.purchases = round2_(summary.purchases);
  summary.dividends = round2_(summary.dividends);
  summary.sales = round2_(summary.sales);
  return summary;
}

function readInvestmentActivityImportKeys_(sheet) {
  var result = {};
  if (!sheet || sheet.getLastRow() < 2) return result;
  var values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getDisplayValues();
  values.forEach(function(row) {
    var key = String(row[0] || '').trim();
    if (key) result[key] = true;
  });
  return result;
}

function saveInvestmentTickerDecisions_(ss, account, decisions, boundaries) {
  var keys = Object.keys(decisions || {}).sort();
  if (!keys.length) return null;
  var sheet = ensureInvestmentPlansSheet_(ss);
  var existing = investmentPlanRowsByTicker_(
    readInvestmentPlanRows_(ss, account.investmentId));
  var now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
  var rows = [];
  var updatedRows = [];
  keys.forEach(function(ticker) {
    var wanted = decisions[ticker] === 'INCLUDE' ? 'INCLUDED' : 'EXCLUDED';
    var boundary = String(boundaries && boundaries[ticker] || '');
    var prior = existing[ticker] || null;
    if (prior) {
      var previous = sheet.getRange(prior.sheetRow, 1, 1,
        INVESTMENT_PLAN_HEADERS_.length).getValues()[0];
      var next = previous.slice();
      next[0] = account.investmentId;
      next[1] = account.accountName;
      next[2] = ticker;
      next[3] = wanted;
      next[7] = now;
      next[8] = boundary || prior.activityBoundaryDate || '';
      if (prior.portfolioStatus === wanted &&
          prior.activityBoundaryDate === String(next[8] || '')) return;
      updatedRows.push({ row: prior.sheetRow, previous: previous, next: next });
      return;
    }
    rows.push([account.investmentId, account.accountName, ticker, wanted,
      '', 0, 'Yes', now, boundary]);
  });
  if (!rows.length && !updatedRows.length) return null;
  var startRow = rows.length ? sheet.getLastRow() + 1 : 0;
  try {
    updatedRows.forEach(function(change) {
      sheet.getRange(change.row, 1, 1, INVESTMENT_PLAN_HEADERS_.length)
        .setValues([change.next]);
    });
    if (rows.length) {
      sheet.getRange(startRow, 1, rows.length, INVESTMENT_PLAN_HEADERS_.length)
        .setValues(rows);
    }
    fitInvestmentSystemSheetColumns_(sheet, INVESTMENT_PLAN_HEADERS_,
      'investment ticker decision content fit');
  } catch (writeErr) {
    var rollbackFailed = false;
    try {
      if (rows.length && sheet.getLastRow() >= startRow) {
        sheet.deleteRows(startRow, rows.length);
      }
      updatedRows.forEach(function(change) {
        sheet.getRange(change.row, 1, 1, INVESTMENT_PLAN_HEADERS_.length)
          .setValues([change.previous]);
      });
    } catch (_rollbackErr) {
      rollbackFailed = true;
    }
    if (rollbackFailed) {
      throw new Error((writeErr.message || String(writeErr)) +
        ' The ticker decision rollback could not be confirmed.');
    }
    throw writeErr;
  }
  return { sheet: sheet, startRow: startRow, rowCount: rows.length,
    updatedRows: updatedRows };
}

function rebuildInvestmentHoldingsForAccount_(ss, investmentId, accountName) {
  var activity = ensureInvestmentActivitySheet_(ss);
  var holdings = ensureInvestmentHoldingsSheet_(ss);
  var rows = activity.getLastRow() < 2 ? [] : activity.getRange(2, 1,
    activity.getLastRow() - 1, INVESTMENT_ACTIVITY_HEADERS_.length).getValues();
  var aggregate = {};
  var asOf = '';
  rows.forEach(function(row) {
    if (String(row[1] || '').trim() !== investmentId) return;
    var ticker = String(row[5] || '').trim();
    var activityType = String(row[6] || '').trim();
    var activityDate = String(row[3] || '').trim();
    if (activityDate > asOf) asOf = activityDate;
    if (!ticker) return;
    if (!aggregate[ticker]) {
      aggregate[ticker] = { quantity: 0, buys: 0, sales: 0, dividends: 0,
        weekly: 0, latestRecurringDate: '', lastPrice: 0, count: 0 };
    }
    var item = aggregate[ticker];
    var quantity = Number(row[7]) || 0;
    var price = Number(row[8]) || 0;
    var amount = Number(row[9]) || 0;
    item.count++;
    if (price > 0) item.lastPrice = price;
    if (activityType === 'BUY' || activityType === 'RECURRING_BUY') {
      item.quantity += quantity;
      item.buys += Math.abs(amount);
    } else if (activityType === 'CORPORATE_ACTION_IN') {
      item.quantity += quantity;
    } else if (activityType === 'SELL') {
      item.quantity -= quantity;
      item.sales += Math.abs(amount);
    } else if (activityType === 'DIVIDEND') {
      item.dividends += amount;
    }
    if (activityType === 'RECURRING_BUY' && activityDate >= item.latestRecurringDate) {
      if (activityDate > item.latestRecurringDate) item.weekly = 0;
      item.latestRecurringDate = activityDate;
      item.weekly += Math.abs(amount);
    }
  });

  for (var rowIndex = holdings.getLastRow(); rowIndex >= 2; rowIndex--) {
    if (String(holdings.getRange(rowIndex, 1).getDisplayValue() || '').trim() === investmentId) {
      holdings.deleteRow(rowIndex);
    }
  }
  var now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
  var output = Object.keys(aggregate).sort().map(function(ticker) {
    var item = aggregate[ticker];
    return [investmentId, accountName, asOf, ticker, item.quantity,
      round2_(item.buys), round2_(item.sales), round2_(item.dividends),
      round2_(item.weekly), round2_(item.lastPrice), item.count, now];
  });
  if (output.length) {
    holdings.getRange(holdings.getLastRow() + 1, 1, output.length,
      INVESTMENT_HOLDINGS_HEADERS_.length).setValues(output);
  }
  fitInvestmentSystemSheetColumns_(holdings, INVESTMENT_HOLDINGS_HEADERS_,
    'investment holdings rebuild content fit');
}

function getInvestmentHoldingsSummary_(ss, investmentId) {
  var sheet = ss.getSheetByName(getSheetNames_().INVESTMENT_HOLDINGS);
  if (!sheet || sheet.getLastRow() < 2) return [];
  return sheet.getRange(2, 1, sheet.getLastRow() - 1,
    INVESTMENT_HOLDINGS_HEADERS_.length).getValues().filter(function(row) {
      return String(row[0] || '').trim() === investmentId;
    }).map(function(row) {
      return {
        ticker: row[3], quantity: Number(row[4]) || 0,
        totalBuyCost: Number(row[5]) || 0,
        saleProceeds: Number(row[6]) || 0,
        dividendsReceived: Number(row[7]) || 0,
        weeklyRecurringBuy: Number(row[8]) || 0,
        lastActivityPrice: Number(row[9]) || 0,
        activityCount: Number(row[10]) || 0,
        asOfDate: String(row[2] || '')
      };
    });
}

function getInvestmentPortfolioActivityFromDashboard(investmentId, optionalSs) {
  var ss = optionalSs || getUserSpreadsheet_();
  var account = resolveEligibleInvestmentImportAccount_(ss, investmentId);
  var holdings = getInvestmentHoldingsSummary_(ss, account.investmentId);
  var planRows = readInvestmentPlanRows_(ss, account.investmentId);
  var plansByTicker = investmentPlanRowsByTicker_(planRows);
  var recurringByTicker = readLatestRecurringActivityByTicker_(ss, account.investmentId);
  var portfolio = holdings.map(function(row) {
    var plan = plansByTicker[row.ticker] || null;
    var recurring = recurringByTicker[row.ticker] || null;
    return {
      ticker: row.ticker,
      quantity: row.quantity,
      totalBuyCost: row.totalBuyCost,
      saleProceeds: row.saleProceeds,
      dividendsReceived: row.dividendsReceived,
      lastActivityPrice: row.lastActivityPrice,
      activityCount: row.activityCount,
      detectedRecurringAmount: recurring ? recurring.amount : 0,
      detectedRecurringDate: recurring ? recurring.activityDate : '',
      planConfigured: !!(plan && plan.planFrequency),
      planFrequency: plan ? plan.planFrequency : '',
      plannedAmount: plan ? plan.plannedAmount : 0,
      planActive: plan ? plan.planActive : true
    };
  });
  return {
    investmentId: account.investmentId,
    accountName: account.accountName,
    holdings: portfolio,
    excludedTickers: planRows.filter(function(row) {
      return row.portfolioStatus === 'EXCLUDED';
    }).map(function(row) {
      return { ticker: row.ticker, reviewedThroughDate: row.activityBoundaryDate };
    }).sort(function(a, b) { return a.ticker.localeCompare(b.ticker); })
  };
}

function saveInvestmentTickerPlanFromDashboard(payload, optionalSs) {
  payload = payload || {};
  var ss = optionalSs || getUserSpreadsheet_();
  var lock = LockService.getUserLock();
  if (!lock.tryLock(15000)) {
    throw new Error('Another investment change is in progress. Please try again in a moment.');
  }
  try {
    var account = resolveEligibleInvestmentImportAccount_(ss, payload.investmentId);
    var ticker = normalizeInvestmentTicker_(payload.ticker);
    if (!ticker) throw new Error('Choose a valid ticker.');
    var frequency = normalizeInvestmentPlanFrequency_(payload.planFrequency, false);
    var amount = Number(payload.plannedAmount);
    if (!isFinite(amount) || amount < 0 || amount > 1000000) {
      throw new Error('Planned amount must be between $0 and $1,000,000.');
    }
    amount = round2_(amount);
    var planActive = payload.planActive !== false &&
      String(payload.planActive || '').trim().toUpperCase() !== 'NO';
    var savedTickers = readSavedInvestmentTickers_(ss, account.investmentId);
    var existingRows = investmentPlanRowsByTicker_(
      readInvestmentPlanRows_(ss, account.investmentId));
    if (!savedTickers[ticker] && !existingRows[ticker]) {
      throw new Error('That ticker is not part of the selected portfolio. Import and include it first.');
    }
    var sheet = ensureInvestmentPlansSheet_(ss);
    var existing = existingRows[ticker] || null;
    var rowNumber = existing ? existing.sheetRow : sheet.getLastRow() + 1;
    var now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
    var nextRow = [account.investmentId, account.accountName, ticker, 'INCLUDED',
      frequency, amount, planActive ? 'Yes' : 'No', now,
      existing ? existing.activityBoundaryDate : ''];
    var previous = existing
      ? sheet.getRange(rowNumber, 1, 1, INVESTMENT_PLAN_HEADERS_.length).getValues()[0]
      : null;
    try {
      sheet.getRange(rowNumber, 1, 1, INVESTMENT_PLAN_HEADERS_.length).setValues([nextRow]);
      fitInvestmentSystemSheetColumns_(sheet, INVESTMENT_PLAN_HEADERS_,
        'investment plan update content fit');
    } catch (writeErr) {
      try {
        if (previous) {
          sheet.getRange(rowNumber, 1, 1, INVESTMENT_PLAN_HEADERS_.length)
            .setValues([previous]);
        } else if (sheet.getLastRow() >= rowNumber) {
          sheet.deleteRow(rowNumber);
        }
      } catch (_rollbackErr) {
        throw new Error((writeErr.message || String(writeErr)) +
          ' The plan rollback could not be confirmed.');
      }
      throw writeErr;
    }
    try {
      appendActivityLog_(ss, {
        eventType: 'investment_plan_update', entryDate: now.slice(0, 10),
        amount: amount, direction: 'INFO', payee: account.accountName,
        category: 'Investments', accountSource: account.accountName,
        details: {
          investmentId: account.investmentId, ticker: ticker,
          planFrequency: frequency, plannedAmount: amount,
          planActive: planActive
        }
      });
    } catch (_auditErr) { /* best-effort audit */ }
    return getInvestmentPortfolioActivityFromDashboard(account.investmentId, ss);
  } finally {
    lock.releaseLock();
  }
}
