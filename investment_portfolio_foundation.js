/**
 * Multi-Broker Portfolio Foundation v1 — CSV-first canonical contracts.
 *
 * Pure normalization, validation, replay, reconciliation, and schema contracts.
 * Does not write workbook sheets on load. Robinhood production import remains in
 * investment_activity.js until a reviewed migration wires this layer.
 */

var INVESTMENT_PORTFOLIO_SCHEMA_VERSION_ = '1.0.0';

var INVESTMENT_PORTFOLIO_SOURCES_ = {
  ROBINHOOD_CSV: true,
  ETRADE_CSV: true,
  ETRADE_PACKAGE: true,
  M1_CSV: true,
  SCHWAB_CSV: true,
  RETIREMENT_PLAN_CSV: true,
  PLAID_INVESTMENTS: true,
  MANUAL_STRUCTURED: true
};

var INVESTMENT_PORTFOLIO_FILE_ROLES_ = {
  ACTIVITY: true,
  HOLDINGS: true,
  TAX_LOTS: true,
  ACCOUNT_SNAPSHOT: true,
  DIVIDEND_HISTORY: true,
  REALIZED_GAIN_LOSS: true,
  UNKNOWN: true
};

var INVESTMENT_PORTFOLIO_CAPABILITIES_ = {
  activities: true,
  holdings: true,
  taxLots: true,
  accountSnapshot: true,
  dividendHistory: true,
  realizedGainLoss: true
};

var INVESTMENT_PORTFOLIO_ACTIVITY_TYPES_ = {
  BUY: true,
  SELL: true,
  DIVIDEND: true,
  DISTRIBUTION: true,
  REINVESTMENT: true,
  CONTRIBUTION: true,
  WITHDRAWAL: true,
  EMPLOYER_MATCH: true,
  TRANSFER_IN: true,
  TRANSFER_OUT: true,
  SPLIT: true,
  FEE: true,
  INTEREST: true,
  OPENING_BALANCE: true,
  OPENING_CAPITAL: true,
  RECURRING_BUY: true,
  CORPORATE_ACTION: true,
  LOAN: true,
  HARDSHIP_WITHDRAWAL: true,
  UNSUPPORTED: true
};

/**
 * Canonical activitySubtype values for broker-specific distinctions.
 * Robinhood legacy previews may carry broker transCode strings when allowLegacy is set.
 */
var INVESTMENT_PORTFOLIO_ACTIVITY_SUBTYPES_ = {
  QUALIFIED_DIVIDEND: true,
  REINVESTMENT: true,
  EXCHANGE_RECEIVED: true,
  EXCHANGE_DELIVERED: true,
  REDEMPTION: true,
  STOCK_SPLIT: true,
  CASH_IN_LIEU: true,
  CANCEL_SOLD: true,
  ONLINE_TRANSFER: true,
  SERVICE_FEE: true
};

var INVESTMENT_PORTFOLIO_CANONICAL_SUBTYPE_SOURCES_ = {
  ETRADE_CSV: true,
  ETRADE_PACKAGE: true,
  M1_CSV: true,
  SCHWAB_CSV: true,
  RETIREMENT_PLAN_CSV: true,
  PLAID_INVESTMENTS: true,
  MANUAL_STRUCTURED: true
};

var INVESTMENT_PORTFOLIO_REGISTRATION_TYPES_ = {
  TAXABLE: true,
  TRADITIONAL_IRA: true,
  ROTH_IRA: true,
  '401K': true,
  '403B': true,
  HSA: true,
  OTHER_RETIREMENT: true,
  UNKNOWN: true
};

var INVESTMENT_PORTFOLIO_LEGACY_REGISTRATION_TYPES_ = {
  INDIVIDUAL: true,
  JOINT: true,
  CUSTODIAL: true,
  IRA: true,
  '529': true,
  TRUST: true,
  PROPERTY_TITLE: true
};

var INVESTMENT_PORTFOLIO_PORTFOLIO_ROLES_ = {
  RETIREMENT_ACCUMULATION: true,
  INCOME_PRODUCING: true,
  GROWTH: true,
  PROTECTED: true,
  OPTIMIZATION_CANDIDATE: true,
  DO_NOT_SELL_FOR_CASH_FUNDING: true,
  UNKNOWN: true
};

var INVESTMENT_PORTFOLIO_INCOME_BUCKETS_ = {
  CURRENT_SPENDABLE_PORTFOLIO_INCOME: true,
  RETIREMENT_PORTFOLIO_INCOME: true,
  UNKNOWN: true
};

var INVESTMENT_PORTFOLIO_HOLDINGS_AUTHORITY_ = {
  CASHCOMPASS_RECONSTRUCTED: true,
  PROVIDER_REPORTED: true,
  HYBRID: true
};

var INVESTMENT_PORTFOLIO_LOT_AUTHORITY_ = {
  PROVIDER_REPORTED: true,
  CASHCOMPASS_RECONSTRUCTED: true,
  AGGREGATE_ONLY: true,
  UNKNOWN: true
};

var INVESTMENT_PORTFOLIO_COST_BASIS_QUALITY_ = {
  PROVIDER_LOT: true,
  PROVIDER_AGGREGATE: true,
  RECONSTRUCTED: true,
  UNKNOWN: true
};

var INVESTMENT_PORTFOLIO_REPLAY_OUTCOMES_ = {
  EXACT_REPLAY: true,
  NEW_RECORD: true,
  SOURCE_CORRECTION: true,
  CONFLICT: true
};

var INVESTMENT_PORTFOLIO_RECONCILIATION_ = {
  MATCH: true,
  ROUNDING_DIFFERENCE: true,
  SOURCE_INCOMPLETE: true,
  ACTIVITY_GAP: true,
  COST_BASIS_GAP: true,
  PRICE_STALE: true,
  CASH_GAP: true,
  MATERIAL_MISMATCH: true
};

var INVESTMENT_PORTFOLIO_SECURITY_TYPES_ = {
  EQUITY: true,
  ETF: true,
  MUTUAL_FUND: true,
  BOND: true,
  OPTION: true,
  CASH_EQUIVALENT: true,
  CRYPTO: true,
  UNKNOWN: true
};

var INVESTMENT_PORTFOLIO_DATA_QUALITY_ = {
  PROVIDER_REPORTED: true,
  NORMALIZED: true,
  INFERRED: true,
  UNKNOWN: true
};

/** Append-only extensions; base Robinhood columns remain authoritative for legacy rows. */
var INVESTMENT_ACTIVITY_EXTENDED_HEADERS_ = [
  'Stable Account Id', 'Stable Security Id', 'Source Record Key', 'Source Account Key',
  'Fees', 'Net Amount', 'Activity Subtype', 'Parser Version', 'Data Quality',
  'Import Batch Id', 'Source File Fingerprint', 'Income Bucket Snapshot'
];

var INVESTMENT_HOLDINGS_EXTENDED_HEADERS_ = [
  'Stable Account Id', 'Stable Security Id', 'Market Value', 'Current Price',
  'Price As Of', 'Provider Cost Basis', 'Cost Basis Quality', 'Unrealized Gain/Loss',
  'Authority', 'Reconstruction Status', 'Source Snapshot Key', 'Source As Of Date'
];

var INVESTMENT_TAX_LOT_HEADERS_ = [
  'Stable Lot Id', 'Investment Id', 'Stable Account Id', 'Ticker', 'Stable Security Id',
  'Acquisition Date', 'Original Quantity', 'Remaining Quantity', 'Cost Per Share',
  'Original Cost Basis', 'Adjusted Cost Basis', 'Cost Basis Quality', 'Lot Authority',
  'Source', 'Source Lot Id', 'Source Transaction Id', 'Current Price', 'Current Value',
  'Unrealized Gain/Loss', 'Holding Period Days', 'Term Status', 'As Of Date', 'Updated At'
];

var INVESTMENT_SECURITIES_HEADERS_ = [
  'Stable Security Id', 'Ticker', 'Security Name', 'Security Type', 'CUSIP', 'ISIN',
  'Primary Source', 'Source Security Key', 'Active', 'Updated At'
];

var INVESTMENT_PORTFOLIO_RETIREMENT_REGISTRATIONS_ = {
  TRADITIONAL_IRA: true,
  ROTH_IRA: true,
  '401K': true,
  '403B': true,
  HSA: true,
  OTHER_RETIREMENT: true
};

function investmentPortfolioNormalizeSource_(value) {
  var key = String(value || '').trim().toUpperCase();
  return INVESTMENT_PORTFOLIO_SOURCES_[key] ? key : '';
}

function investmentPortfolioNormalizeActivitySubtype_(value, options) {
  options = options || {};
  var raw = String(value || '').trim();
  if (!raw) return '';
  var key = raw.toUpperCase();
  if (INVESTMENT_PORTFOLIO_ACTIVITY_SUBTYPES_[key]) return key;
  if (options.allowLegacy) return raw;
  return options.unknownFallback || '';
}

function investmentPortfolioIsCanonicalActivitySubtype_(value) {
  var key = String(value || '').trim().toUpperCase();
  return !!INVESTMENT_PORTFOLIO_ACTIVITY_SUBTYPES_[key];
}

function investmentPortfolioSourceRequiresCanonicalSubtype_(source) {
  var key = investmentPortfolioNormalizeSource_(source);
  return INVESTMENT_PORTFOLIO_CANONICAL_SUBTYPE_SOURCES_[key] === true;
}

function investmentPortfolioActivityHasTradeSemantics_(activity) {
  var type = String(activity && activity.activityType || '').trim().toUpperCase();
  return type === 'BUY' || type === 'SELL' || type === 'RECURRING_BUY';
}

function investmentPortfolioBuildDividendGroupKey_(activity) {
  var row = activity || {};
  var type = String(row.activityType || '').trim().toUpperCase();
  var subtype = String(row.activitySubtype || '').trim().toUpperCase();
  if (type !== 'DIVIDEND' && type !== 'REINVESTMENT') return '';
  if (!String(row.activityDate || '').trim() || !String(row.ticker || '').trim()) return '';
  return [
    row.activityDate,
    String(row.ticker || '').trim().toUpperCase(),
    'dividend'
  ].join('|');
}

function investmentPortfolioSummarizeDividendIncome_(activities) {
  var groups = {};
  var reinvestGroups = {};
  (activities || []).forEach(function(row) {
    var type = String(row.activityType || '').trim().toUpperCase();
    var groupKey = investmentPortfolioBuildDividendGroupKey_(row);
    if (!groupKey) return;
    if (type === 'REINVESTMENT') {
      reinvestGroups[groupKey] = (reinvestGroups[groupKey] || 0) + 1;
      return;
    }
    if (type !== 'DIVIDEND') return;
    var amount = Number(row.amount);
    if (!isFinite(amount) || amount <= 0) return;
    groups[groupKey] = (groups[groupKey] || 0) + amount;
  });
  var totalCashDividendIncome = 0;
  Object.keys(groups).forEach(function(key) {
    totalCashDividendIncome += groups[key];
  });
  return {
    totalCashDividendIncome: totalCashDividendIncome,
    groups: groups,
    reinvestGroups: reinvestGroups
  };
}

function investmentPortfolioMapEtradeSourceActivity_(row) {
  row = row || {};
  var label = String(row.etradeActivityType || row.activityTypeLabel || '').trim().toLowerCase();
  var description = String(row.description || '').trim();
  var descUpper = description.toUpperCase();
  var amount = Number(row.amount);
  var quantity = Number(row.quantity);
  var hasQty = isFinite(quantity) && quantity !== 0;
  var mapped = {
    activityType: 'UNSUPPORTED',
    activitySubtype: '',
    dividendGroupKey: '',
    tradeSemantics: false,
    incomeEligible: false,
    reviewRequired: false
  };

  if (label === 'bought') {
    mapped.activityType = 'BUY';
    mapped.tradeSemantics = true;
    return mapped;
  }
  if (label === 'sold') {
    mapped.activityType = 'SELL';
    mapped.tradeSemantics = true;
    return mapped;
  }
  if (label === 'qualified dividend') {
    mapped.activityType = 'DIVIDEND';
    mapped.activitySubtype = 'QUALIFIED_DIVIDEND';
    mapped.incomeEligible = true;
    mapped.dividendGroupKey = investmentPortfolioBuildDividendGroupKey_({
      activityDate: row.activityDate,
      ticker: row.ticker,
      activityType: 'DIVIDEND',
      activitySubtype: 'QUALIFIED_DIVIDEND'
    });
    return mapped;
  }
  if (label === 'dividend') {
    if (descUpper.indexOf('DIVIDEND REINVESTMENT') !== -1) {
      mapped.activityType = 'REINVESTMENT';
      mapped.activitySubtype = 'REINVESTMENT';
      mapped.dividendGroupKey = investmentPortfolioBuildDividendGroupKey_({
        activityDate: row.activityDate,
        ticker: row.ticker,
        activityType: 'REINVESTMENT',
        activitySubtype: 'REINVESTMENT'
      });
      return mapped;
    }
    mapped.activityType = 'DIVIDEND';
    mapped.incomeEligible = isFinite(amount) && amount > 0;
    mapped.dividendGroupKey = investmentPortfolioBuildDividendGroupKey_({
      activityDate: row.activityDate,
      ticker: row.ticker,
      activityType: 'DIVIDEND',
      activitySubtype: ''
    });
    return mapped;
  }
  if (label === 'transfer') {
    if (descUpper.indexOf('ACH DEPOSIT') !== -1) {
      mapped.activityType = 'CONTRIBUTION';
      mapped.activitySubtype = 'ONLINE_TRANSFER';
      return mapped;
    }
    if (descUpper.indexOf('TFR TO ACCT') !== -1 || descUpper.indexOf('GIFT TFR') !== -1) {
      mapped.activityType = hasQty && quantity < 0 ? 'TRANSFER_OUT' : 'TRANSFER_IN';
      return mapped;
    }
    mapped.activityType = hasQty && quantity < 0 ? 'TRANSFER_OUT' : 'TRANSFER_IN';
    mapped.reviewRequired = true;
    return mapped;
  }
  if (label === 'online transfer') {
    if (isFinite(amount) && amount > 0) {
      mapped.activityType = descUpper.indexOf('ACH DEPOSIT') !== -1 ? 'CONTRIBUTION' : 'TRANSFER_IN';
    } else if (isFinite(amount) && amount < 0) {
      mapped.activityType = descUpper.indexOf('ACH WITHDRAW') !== -1 ? 'WITHDRAWAL' : 'TRANSFER_OUT';
    } else {
      mapped.activityType = 'TRANSFER_IN';
      mapped.reviewRequired = true;
    }
    mapped.activitySubtype = 'ONLINE_TRANSFER';
    return mapped;
  }
  if (label === 'exchange received in') {
    mapped.activityType = 'CORPORATE_ACTION';
    mapped.activitySubtype = 'EXCHANGE_RECEIVED';
    return mapped;
  }
  if (label === 'exchange delivered out') {
    mapped.activityType = 'CORPORATE_ACTION';
    mapped.activitySubtype = 'EXCHANGE_DELIVERED';
    return mapped;
  }
  if (label === 'cash in lieu') {
    mapped.activityType = 'CORPORATE_ACTION';
    mapped.activitySubtype = 'CASH_IN_LIEU';
    return mapped;
  }
  if (label === 'stock split') {
    mapped.activityType = 'SPLIT';
    mapped.activitySubtype = 'STOCK_SPLIT';
    return mapped;
  }
  if (label === 'redemption') {
    mapped.activityType = 'CORPORATE_ACTION';
    mapped.activitySubtype = 'REDEMPTION';
    return mapped;
  }
  if (label === 'cancel sold') {
    mapped.activityType = 'CORPORATE_ACTION';
    mapped.activitySubtype = 'CANCEL_SOLD';
    return mapped;
  }
  if (label === 'service fee') {
    mapped.activityType = 'FEE';
    mapped.activitySubtype = 'SERVICE_FEE';
    return mapped;
  }
  if (label === 'interest income') {
    mapped.activityType = 'INTEREST';
    return mapped;
  }
  mapped.reviewRequired = true;
  return mapped;
}

function investmentPortfolioApplyEtradeMappedActivity_(row, mapped) {
  mapped = mapped || investmentPortfolioMapEtradeSourceActivity_(row);
  return {
    activityDate: row.activityDate || '',
    settleDate: row.settleDate || '',
    ticker: row.ticker || '',
    description: row.description || '',
    quantity: row.quantity,
    price: row.price,
    amount: row.amount,
    fees: row.fees,
    source: investmentPortfolioNormalizeSource_(row.source) || 'ETRADE_CSV',
    activityType: mapped.activityType,
    activitySubtype: mapped.activitySubtype,
    dividendGroupKey: mapped.dividendGroupKey || '',
    tradeSemantics: mapped.tradeSemantics === true,
    incomeEligible: mapped.incomeEligible === true,
    reviewRequired: mapped.reviewRequired === true
  };
}

function investmentPortfolioNormalizeRegistrationType_(value) {
  var key = String(value || '').trim().toUpperCase() || 'UNKNOWN';
  if (INVESTMENT_PORTFOLIO_REGISTRATION_TYPES_[key]) return key;
  if (key === 'IRA') return 'IRA';
  if (INVESTMENT_PORTFOLIO_LEGACY_REGISTRATION_TYPES_[key]) return key;
  return 'UNKNOWN';
}

function investmentPortfolioRegistrationTaxAuthoritative_(registrationType) {
  var key = investmentPortfolioNormalizeRegistrationType_(registrationType);
  if (key === 'IRA') return false;
  return INVESTMENT_PORTFOLIO_REGISTRATION_TYPES_[key] === true &&
    key !== 'UNKNOWN';
}

function investmentPortfolioResolveDomainForRegistration_(registrationType) {
  var key = investmentPortfolioNormalizeRegistrationType_(registrationType);
  if (INVESTMENT_PORTFOLIO_RETIREMENT_REGISTRATIONS_[key]) return 'RETIREMENT';
  if (key === 'IRA') return 'RETIREMENT';
  if (key === 'TAXABLE') return 'INVESTMENT';
  return 'INVESTMENT';
}

function investmentPortfolioResolveIncomeBucket_(registrationType) {
  var key = investmentPortfolioNormalizeRegistrationType_(registrationType);
  if (key === 'TAXABLE') return 'CURRENT_SPENDABLE_PORTFOLIO_INCOME';
  if (INVESTMENT_PORTFOLIO_RETIREMENT_REGISTRATIONS_[key] || key === 'IRA') {
    return 'RETIREMENT_PORTFOLIO_INCOME';
  }
  return 'UNKNOWN';
}

function investmentPortfolioNormalizePortfolioRole_(value) {
  var key = String(value || '').trim().toUpperCase() || 'UNKNOWN';
  return INVESTMENT_PORTFOLIO_PORTFOLIO_ROLES_[key] ? key : 'UNKNOWN';
}

function investmentPortfolioResolvePortfolioRoles_(account) {
  var roles = [];
  var input = account || {};
  if (input.portfolioRole) roles.push(investmentPortfolioNormalizePortfolioRole_(input.portfolioRole));
  (input.portfolioPolicyFlags || []).forEach(function(flag) {
    var normalized = investmentPortfolioNormalizePortfolioRole_(flag);
    if (normalized !== 'UNKNOWN' && roles.indexOf(normalized) === -1) roles.push(normalized);
  });
  if (String(input.planningPurpose || '').trim().toUpperCase() === 'INCOME_PRODUCING' &&
      roles.indexOf('INCOME_PRODUCING') === -1) {
    roles.push('INCOME_PRODUCING');
  }
  if (roles.indexOf('UNKNOWN') !== -1 && roles.length > 1) {
    roles = roles.filter(function(role) { return role !== 'UNKNOWN'; });
  }
  return roles.length ? roles : ['UNKNOWN'];
}

function investmentPortfolioCashFundingSellEligible_(account) {
  var roles = investmentPortfolioResolvePortfolioRoles_(account);
  if (roles.indexOf('DO_NOT_SELL_FOR_CASH_FUNDING') !== -1) return false;
  if (roles.indexOf('PROTECTED') !== -1) return false;
  var registration = investmentPortfolioNormalizeRegistrationType_(
    account && account.registrationType);
  if (INVESTMENT_PORTFOLIO_RETIREMENT_REGISTRATIONS_[registration] || registration === 'IRA') {
    return false;
  }
  return roles.indexOf('OPTIMIZATION_CANDIDATE') !== -1 ||
    registration === 'TAXABLE';
}

function investmentPortfolioImportEligible_(account) {
  var input = account || {};
  var domain = String(input.domain || '').trim().toUpperCase();
  if (domain !== 'INVESTMENT' && domain !== 'RETIREMENT') return false;
  if (input.active === false) return false;
  var investmentId = String(input.investmentId || '').trim();
  var stableAccountId = String(input.stableAccountId || '').trim();
  if (!investmentId && !stableAccountId) return false;
  return true;
}

function investmentPortfolioRobinhoodImportEligible_(account) {
  return !!(account && account.incomeProducingEligible === true);
}

function investmentPortfolioDigest_(parts) {
  var value = (parts || []).map(function(part) {
    return String(part === null || typeof part === 'undefined' ? '' : part);
  }).join('||');
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, value,
    Utilities.Charset.UTF_8);
  return bytes.map(function(byte) {
    var normalized = byte < 0 ? byte + 256 : byte;
    return ('0' + normalized.toString(16)).slice(-2);
  }).join('');
}

function investmentPortfolioHashOpaqueKey_(prefix, raw) {
  var text = String(raw || '').trim();
  if (!text) return '';
  return prefix + ':' + investmentPortfolioDigest_(text);
}

function investmentPortfolioBuildActivityFingerprint_(activity) {
  var row = activity || {};
  return investmentPortfolioDigest_([
    row.source || '',
    row.activityDate || '',
    row.settleDate || '',
    row.stableSecurityId || row.ticker || '',
    row.activityType || '',
    row.quantity,
    row.price,
    row.amount,
    row.fees,
    row.activitySubtype || '',
    row.description || ''
  ]);
}

function investmentPortfolioBuildReplayKey_(activity, options) {
  options = options || {};
  var row = activity || {};
  var source = investmentPortfolioNormalizeSource_(row.source) ||
    String(row.source || '').trim().toUpperCase();
  var sourceRecordKey = String(row.sourceRecordKey || '').trim();
  var sourceAccountKey = String(row.sourceAccountKey || '').trim();
  if (source && sourceAccountKey && sourceRecordKey) {
    return investmentPortfolioDigest_([source, sourceAccountKey, sourceRecordKey]);
  }
  if (options.legacyImportKey) return String(options.legacyImportKey);
  if (options.investmentId && row.activityDate) {
    return investmentPortfolioDigest_([
      options.investmentId,
      row.activityDate,
      [
        row.settleDate, row.ticker, row.transCode || row.activitySubtype || '',
        row.quantity, row.price, row.amount, row.description
      ].join('|')
    ]);
  }
  return investmentPortfolioBuildActivityFingerprint_(row);
}

function investmentPortfolioActivitiesEquivalent_(left, right) {
  var a = left || {};
  var b = right || {};
  return String(a.activityDate || '') === String(b.activityDate || '') &&
    String(a.settleDate || '') === String(b.settleDate || '') &&
    String(a.ticker || '').toUpperCase() === String(b.ticker || '').toUpperCase() &&
    String(a.activityType || '') === String(b.activityType || '') &&
    Number(a.quantity || 0) === Number(b.quantity || 0) &&
    Number(a.price || 0) === Number(b.price || 0) &&
    Number(a.amount || 0) === Number(b.amount || 0) &&
    Number(a.fees || 0) === Number(b.fees || 0) &&
    String(a.activitySubtype || '') === String(b.activitySubtype || '');
}

function investmentPortfolioClassifyReplay_(incoming, existing, options) {
  options = options || {};
  if (!existing) return 'NEW_RECORD';
  var incomingKey = investmentPortfolioBuildReplayKey_(incoming, options);
  var existingKey = investmentPortfolioBuildReplayKey_(existing, options);
  if (incomingKey && existingKey && incomingKey === existingKey) {
    if (investmentPortfolioActivitiesEquivalent_(incoming, existing)) return 'EXACT_REPLAY';
    var incomingSourceKey = String(incoming.sourceRecordKey || '').trim();
    var existingSourceKey = String(existing.sourceRecordKey || '').trim();
    if (incomingSourceKey && existingSourceKey && incomingSourceKey === existingSourceKey) {
      return 'SOURCE_CORRECTION';
    }
    return 'CONFLICT';
  }
  if (investmentPortfolioActivitiesEquivalent_(incoming, existing)) return 'EXACT_REPLAY';
  return 'NEW_RECORD';
}

function investmentPortfolioSummarizeReplay_(incomingRows, existingRows, options) {
  var existingByKey = {};
  (existingRows || []).forEach(function(row) {
    var key = investmentPortfolioBuildReplayKey_(row, options);
    if (key) existingByKey[key] = row;
  });
  var summary = {
    exactReplays: 0,
    newRecords: 0,
    sourceCorrections: 0,
    conflicts: 0,
    items: []
  };
  (incomingRows || []).forEach(function(row) {
    var key = investmentPortfolioBuildReplayKey_(row, options);
    var existing = existingByKey[key] || null;
    var outcome = investmentPortfolioClassifyReplay_(row, existing, options);
    summary.items.push({ outcome: outcome, replayKey: key, activity: row });
    if (outcome === 'EXACT_REPLAY') summary.exactReplays += 1;
    else if (outcome === 'NEW_RECORD') summary.newRecords += 1;
    else if (outcome === 'SOURCE_CORRECTION') summary.sourceCorrections += 1;
    else if (outcome === 'CONFLICT') summary.conflicts += 1;
  });
  return summary;
}

function investmentPortfolioValidateActivity_(activity) {
  var row = activity || {};
  var errors = [];
  if (!String(row.activityDate || '').trim()) errors.push('activityDate');
  var type = String(row.activityType || '').trim().toUpperCase();
  if (!INVESTMENT_PORTFOLIO_ACTIVITY_TYPES_[type]) errors.push('activityType');
  var subtypeRaw = String(row.activitySubtype || '').trim();
  if (subtypeRaw) {
    var source = investmentPortfolioNormalizeSource_(row.source);
    var allowLegacy = source === 'ROBINHOOD_CSV';
    var normalizedSubtype = investmentPortfolioNormalizeActivitySubtype_(subtypeRaw, {
      allowLegacy: allowLegacy
    });
    if (!normalizedSubtype) errors.push('activitySubtype');
    else if (investmentPortfolioSourceRequiresCanonicalSubtype_(source) &&
        !investmentPortfolioIsCanonicalActivitySubtype_(normalizedSubtype)) {
      errors.push('activitySubtype');
    }
  }
  ['quantity', 'price', 'amount', 'fees'].forEach(function(field) {
    if (row[field] === null || typeof row[field] === 'undefined' || row[field] === '') return;
    if (!isFinite(Number(row[field]))) errors.push(field);
  });
  return { ok: errors.length === 0, errors: errors };
}

function investmentPortfolioValidateTaxLot_(lot) {
  var row = lot || {};
  var errors = [];
  if (!String(row.stableLotId || '').trim()) errors.push('stableLotId');
  var authority = String(row.lotAuthority || '').trim().toUpperCase();
  if (!INVESTMENT_PORTFOLIO_LOT_AUTHORITY_[authority]) errors.push('lotAuthority');
  return { ok: errors.length === 0, errors: errors };
}

function investmentPortfolioValidateSecurity_(security) {
  var row = security || {};
  var errors = [];
  if (!String(row.stableSecurityId || '').trim()) errors.push('stableSecurityId');
  var type = String(row.securityType || 'UNKNOWN').trim().toUpperCase();
  if (!INVESTMENT_PORTFOLIO_SECURITY_TYPES_[type]) errors.push('securityType');
  return { ok: errors.length === 0, errors: errors };
}

function investmentPortfolioMatchSecurity_(candidates, incoming) {
  var row = incoming || {};
  var source = investmentPortfolioNormalizeSource_(row.primarySource || row.source);
  var sourceSecurityKey = String(row.sourceSecurityKey || '').trim();
  if (source && sourceSecurityKey) {
    var exact = (candidates || []).filter(function(item) {
      return String(item.primarySource || item.source || '').toUpperCase() === source &&
        String(item.sourceSecurityKey || '') === sourceSecurityKey;
    })[0];
    if (exact) return { match: exact, method: 'SOURCE_SECURITY_KEY' };
  }
  var cusip = String(row.cusip || '').trim().toUpperCase();
  if (cusip) {
    var byCusip = (candidates || []).filter(function(item) {
      return String(item.cusip || '').trim().toUpperCase() === cusip;
    })[0];
    if (byCusip) return { match: byCusip, method: 'CUSIP' };
  }
  var isin = String(row.isin || '').trim().toUpperCase();
  if (isin) {
    var byIsin = (candidates || []).filter(function(item) {
      return String(item.isin || '').trim().toUpperCase() === isin;
    })[0];
    if (byIsin) return { match: byIsin, method: 'ISIN' };
  }
  var ticker = String(row.ticker || '').trim().toUpperCase();
  var securityType = String(row.securityType || 'UNKNOWN').trim().toUpperCase();
  if (ticker) {
    var byTicker = (candidates || []).filter(function(item) {
      return String(item.ticker || '').trim().toUpperCase() === ticker &&
        String(item.securityType || 'UNKNOWN').trim().toUpperCase() === securityType;
    })[0];
    if (byTicker) return { match: byTicker, method: 'TICKER_AND_TYPE' };
  }
  return { match: null, method: 'UNRESOLVED' };
}

function investmentPortfolioReconcilePosition_(input) {
  input = input || {};
  var tolerance = typeof input.quantityTolerance === 'number' ? input.quantityTolerance : 0.0001;
  var moneyTolerance = typeof input.moneyTolerance === 'number' ? input.moneyTolerance : 0.02;
  var reconstructedQty = Number(input.reconstructedQuantity);
  var providerQty = Number(input.providerQuantity);
  var reconstructedCost = Number(input.reconstructedCost);
  var providerCost = Number(input.providerCostBasis);
  var calculatedMv = Number(input.calculatedMarketValue);
  var providerMv = Number(input.providerMarketValue);
  var result = {
    quantityStatus: 'SOURCE_INCOMPLETE',
    costBasisStatus: 'SOURCE_INCOMPLETE',
    marketValueStatus: 'SOURCE_INCOMPLETE'
  };
  if (isFinite(reconstructedQty) && isFinite(providerQty)) {
    var qtyDelta = Math.abs(reconstructedQty - providerQty);
    result.quantityStatus = qtyDelta <= tolerance ? 'MATCH'
      : qtyDelta <= 0.01 ? 'ROUNDING_DIFFERENCE'
      : Math.abs(reconstructedQty) > 0 && providerQty === 0 ? 'ACTIVITY_GAP'
      : 'MATERIAL_MISMATCH';
  }
  if (isFinite(reconstructedCost) && isFinite(providerCost)) {
    var costDelta = Math.abs(reconstructedCost - providerCost);
    result.costBasisStatus = costDelta <= moneyTolerance ? 'MATCH'
      : costDelta <= 1 ? 'ROUNDING_DIFFERENCE'
      : 'COST_BASIS_GAP';
  }
  if (isFinite(calculatedMv) && isFinite(providerMv)) {
    var mvDelta = Math.abs(calculatedMv - providerMv);
    result.marketValueStatus = mvDelta <= moneyTolerance ? 'MATCH'
      : mvDelta <= 5 ? 'ROUNDING_DIFFERENCE'
      : input.priceAsOfStale ? 'PRICE_STALE'
      : 'MATERIAL_MISMATCH';
  }
  return result;
}

function investmentPortfolioBuildImportPreviewSummary_(parts) {
  parts = parts || {};
  return {
    schemaVersion: INVESTMENT_PORTFOLIO_SCHEMA_VERSION_,
    source: investmentPortfolioNormalizeSource_(parts.source),
    parserVersion: String(parts.parserVersion || ''),
    account: parts.account || null,
    capabilities: parts.capabilities || {},
    activities: {
      accepted: Number(parts.acceptedActivities || 0),
      excluded: Number(parts.excludedActivities || 0),
      exactReplays: Number(parts.exactReplays || 0),
      newRecords: Number(parts.newRecords || 0),
      sourceCorrections: Number(parts.sourceCorrections || 0),
      conflicts: Number(parts.conflicts || 0)
    },
    holdings: {
      reportedCount: Number(parts.reportedHoldings || 0),
      reconciliation: parts.holdingsReconciliation || 'SOURCE_INCOMPLETE'
    },
    taxLots: {
      providerReported: Number(parts.providerLots || 0),
      reconstructed: Number(parts.reconstructedLots || 0),
      aggregateOnly: Number(parts.aggregateLots || 0)
    },
    warnings: parts.warnings || [],
    unsupportedRows: parts.unsupportedRows || []
  };
}

function investmentPortfolioNormalizeRobinhoodPreview_(legacyPreview, accountMeta) {
  var preview = legacyPreview || {};
  var account = accountMeta || {};
  var registrationType = investmentPortfolioNormalizeRegistrationType_(
    account.registrationType || 'TAXABLE');
  var incomeBucket = investmentPortfolioResolveIncomeBucket_(registrationType);
  var activities = (preview.acceptedRows || []).map(function(row) {
    return {
      replayKey: row.importKey || '',
      legacyImportKey: row.importKey || '',
      investmentId: preview.investmentId || '',
      stableAccountId: String(account.stableAccountId || ''),
      accountName: preview.accountName || '',
      activityDate: row.activityDate || '',
      settleDate: row.settleDate || '',
      ticker: row.ticker || '',
      activityType: row.activityType || '',
      quantity: row.quantity,
      price: row.price,
      amount: row.amount,
      fees: null,
      netAmount: row.amount,
      recurring: !!row.recurring,
      description: row.description || '',
      source: 'ROBINHOOD_CSV',
      sourceRecordKey: '',
      sourceAccountKey: '',
      activitySubtype: investmentPortfolioNormalizeActivitySubtype_(row.transCode || '', {
        allowLegacy: true
      }) || String(row.transCode || '').trim(),
      parserVersion: String(preview.parserVersion || ''),
      dataQuality: 'NORMALIZED',
      incomeBucketSnapshot: incomeBucket
    };
  });
  return {
    source: 'ROBINHOOD_CSV',
    parserVersion: String(preview.parserVersion || INVESTMENT_PORTFOLIO_SCHEMA_VERSION_),
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
      investmentId: preview.investmentId || '',
      stableAccountId: String(account.stableAccountId || ''),
      accountName: preview.accountName || '',
      registrationType: registrationType,
      domain: investmentPortfolioResolveDomainForRegistration_(registrationType),
      portfolioRoles: investmentPortfolioResolvePortfolioRoles_(account)
    }],
    activities: activities,
    holdingsSnapshots: [],
    taxLots: [],
    securities: [],
    accountSnapshots: [],
    warnings: [],
    unsupportedRows: (preview.excludedRows || []).map(function(row) {
      return {
        reason: row.reason || 'UNSUPPORTED',
        ticker: row.ticker || '',
        activityDate: row.activityDate || '',
        transCode: row.transCode || ''
      };
    }),
    importSummary: investmentPortfolioBuildImportPreviewSummary_({
      source: 'ROBINHOOD_CSV',
      parserVersion: preview.parserVersion || INVESTMENT_PORTFOLIO_SCHEMA_VERSION_,
      acceptedActivities: preview.summary && preview.summary.acceptedCount,
      excludedActivities: preview.summary && preview.summary.excludedCount,
      account: preview.accountName
    }),
    legacyPreview: preview
  };
}

function investmentPortfolioEnsureTaxLotsSheet_(optionalSs) {
  var ss = optionalSs || getUserSpreadsheet_();
  var sheetName = getSheetNames_().INVESTMENT_TAX_LOTS;
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
  sheet.getRange(1, 1, 1, INVESTMENT_TAX_LOT_HEADERS_.length)
    .setValues([INVESTMENT_TAX_LOT_HEADERS_]);
  if (typeof applySysSheetBaseStyle_ === 'function') {
    applySysSheetBaseStyle_(sheet, {});
  }
  return sheet;
}

function investmentPortfolioEnsureSecuritiesSheet_(optionalSs) {
  var ss = optionalSs || getUserSpreadsheet_();
  var sheetName = getSheetNames_().INVESTMENT_SECURITIES;
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
  sheet.getRange(1, 1, 1, INVESTMENT_SECURITIES_HEADERS_.length)
    .setValues([INVESTMENT_SECURITIES_HEADERS_]);
  if (typeof applySysSheetBaseStyle_ === 'function') {
    applySysSheetBaseStyle_(sheet, {});
  }
  return sheet;
}
