/**
 * Part 2A-2 versioned financial-fact foundation.
 *
 * SYS - Financial Facts is append-only evidence. Existing domain sheets remain
 * authoritative for Part 1 Planning. This module provides a shadow reader only;
 * capital_allocation.js does not consume it in Part 2A-2.
 */

var FINANCIAL_FACT_HEADERS_ = [
  'Fact Id', 'Stable Account Id', 'Fact Type', 'Numeric Value', 'Text Value',
  'Currency Or Unit', 'Effective As Of', 'Observed At', 'Source Type',
  'Source System', 'Import Run Id', 'Source Record Key', 'Authority Class',
  'Verification Status', 'Verified At', 'Manual Override',
  'Supersedes Fact Id', 'Reconciliation Status', 'Created At'
];

var FINANCIAL_FACT_CANONICAL_WIDTHS_ = {
  'Fact Id': 250, 'Stable Account Id': 250, 'Fact Type': 190,
  'Numeric Value': 130, 'Text Value': 180, 'Currency Or Unit': 145,
  'Effective As Of': 165, 'Observed At': 165, 'Source Type': 155,
  'Source System': 170, 'Import Run Id': 180, 'Source Record Key': 250,
  'Authority Class': 210, 'Verification Status': 170, 'Verified At': 165,
  'Manual Override': 145, 'Supersedes Fact Id': 250,
  'Reconciliation Status': 185, 'Created At': 165
};

var FINANCIAL_FACT_TYPES_ = {
  CURRENT_BALANCE: true, AVAILABLE_BALANCE: true, ACCOUNT_VALUE: true,
  APR: true, APY: true, CREDIT_LIMIT: true, MINIMUM_PAYMENT: true,
  NEXT_PAYMENT_AMOUNT: true, NEXT_PAYMENT_DATE: true,
  AVAILABLE_CREDIT: true, DISCLOSED_APR: true, PURCHASE_APR: true, CASH_ADVANCE_APR: true,
  BALANCE_TRANSFER_APR: true, PROMOTIONAL_APR: true,
  PROMOTIONAL_APR_EXPIRATION: true, DEFERRED_INTEREST_STATUS: true,
  DEFERRED_INTEREST_EXPIRATION: true,
  POSITION_QUANTITY: true, POSITION_MARKET_VALUE: true,
  SECURITY_PRICE: true, COST_BASIS: true, CASH_SWEEP_YIELD: true
};

var FINANCIAL_FACT_TYPE_METADATA_ = {
  CURRENT_BALANCE: { valueKind: 'NUMERIC', unitKind: 'CURRENCY',
    freshnessCategory: 'HIGHLY_TIME_SENSITIVE', selectionPolicy: 'BALANCE_VALUE' },
  AVAILABLE_BALANCE: { valueKind: 'NUMERIC', unitKind: 'CURRENCY',
    freshnessCategory: 'HIGHLY_TIME_SENSITIVE', selectionPolicy: 'BALANCE_VALUE' },
  ACCOUNT_VALUE: { valueKind: 'NUMERIC', unitKind: 'CURRENCY',
    freshnessCategory: 'LOWER_CHANGE_FREQUENCY', selectionPolicy: 'BALANCE_VALUE' },
  APR: { valueKind: 'NUMERIC', unitKind: 'PERCENT',
    freshnessCategory: 'MODERATELY_TIME_SENSITIVE', selectionPolicy: 'DEFAULT' },
  APY: { valueKind: 'NUMERIC', unitKind: 'PERCENT',
    freshnessCategory: 'MODERATELY_TIME_SENSITIVE', selectionPolicy: 'DEFAULT' },
  CREDIT_LIMIT: { valueKind: 'NUMERIC', unitKind: 'CURRENCY',
    freshnessCategory: 'LOWER_CHANGE_FREQUENCY', selectionPolicy: 'DEFAULT' },
  MINIMUM_PAYMENT: { valueKind: 'NUMERIC', unitKind: 'CURRENCY',
    freshnessCategory: 'MODERATELY_TIME_SENSITIVE', selectionPolicy: 'DEFAULT' },
  NEXT_PAYMENT_AMOUNT: { valueKind: 'NUMERIC', unitKind: 'CURRENCY',
    freshnessCategory: 'MODERATELY_TIME_SENSITIVE', selectionPolicy: 'DEFAULT' },
  NEXT_PAYMENT_DATE: { valueKind: 'DATE', unitKind: 'DATE',
    freshnessCategory: 'MODERATELY_TIME_SENSITIVE', selectionPolicy: 'DEFAULT' },
  AVAILABLE_CREDIT: { valueKind: 'NUMERIC', unitKind: 'CURRENCY',
    freshnessCategory: 'HIGHLY_TIME_SENSITIVE', selectionPolicy: 'BALANCE_VALUE' },
  DISCLOSED_APR: { valueKind: 'NUMERIC', unitKind: 'PERCENT',
    freshnessCategory: 'MODERATELY_TIME_SENSITIVE', selectionPolicy: 'DEFAULT' },
  PURCHASE_APR: { valueKind: 'NUMERIC', unitKind: 'PERCENT',
    freshnessCategory: 'MODERATELY_TIME_SENSITIVE', selectionPolicy: 'DEFAULT' },
  CASH_ADVANCE_APR: { valueKind: 'NUMERIC', unitKind: 'PERCENT',
    freshnessCategory: 'MODERATELY_TIME_SENSITIVE', selectionPolicy: 'DEFAULT' },
  BALANCE_TRANSFER_APR: { valueKind: 'NUMERIC', unitKind: 'PERCENT',
    freshnessCategory: 'MODERATELY_TIME_SENSITIVE', selectionPolicy: 'DEFAULT' },
  PROMOTIONAL_APR: { valueKind: 'NUMERIC', unitKind: 'PERCENT',
    freshnessCategory: 'MODERATELY_TIME_SENSITIVE', selectionPolicy: 'DEFAULT' },
  PROMOTIONAL_APR_EXPIRATION: { valueKind: 'DATE', unitKind: 'DATE',
    freshnessCategory: 'MODERATELY_TIME_SENSITIVE', selectionPolicy: 'DEFAULT' },
  DEFERRED_INTEREST_STATUS: { valueKind: 'TEXT', unitKind: 'STATUS',
    freshnessCategory: 'MODERATELY_TIME_SENSITIVE', selectionPolicy: 'DEFAULT' },
  DEFERRED_INTEREST_EXPIRATION: { valueKind: 'DATE', unitKind: 'DATE',
    freshnessCategory: 'MODERATELY_TIME_SENSITIVE', selectionPolicy: 'DEFAULT' },
  POSITION_QUANTITY: { valueKind: 'NUMERIC', unitKind: 'QUANTITY',
    freshnessCategory: 'HIGHLY_TIME_SENSITIVE', selectionPolicy: 'DEFAULT' },
  POSITION_MARKET_VALUE: { valueKind: 'NUMERIC', unitKind: 'CURRENCY',
    freshnessCategory: 'HIGHLY_TIME_SENSITIVE', selectionPolicy: 'DEFAULT' },
  SECURITY_PRICE: { valueKind: 'NUMERIC', unitKind: 'CURRENCY',
    freshnessCategory: 'HIGHLY_TIME_SENSITIVE', selectionPolicy: 'DEFAULT' },
  COST_BASIS: { valueKind: 'NUMERIC', unitKind: 'CURRENCY',
    freshnessCategory: 'RECONCILIATION_DEPENDENT', selectionPolicy: 'RECONCILIATION' },
  CASH_SWEEP_YIELD: { valueKind: 'NUMERIC', unitKind: 'PERCENT',
    freshnessCategory: 'MODERATELY_TIME_SENSITIVE', selectionPolicy: 'DEFAULT' }
};

var FINANCIAL_FACT_SOURCE_TYPES_ = {
  MANUAL: true, FILE_IMPORT: true, INSTITUTION: true, STATEMENT: true,
  CALCULATED: true, ESTIMATED: true, LEGACY: true
};

var FINANCIAL_FACT_AUTHORITY_CLASSES_ = {
  INSTITUTION_AUTHORITATIVE: true,
  USER_VERIFIED_MANUAL: true,
  STATEMENT_DERIVED: true,
  CALCULATED: true,
  FILE_IMPORTED: true,
  ESTIMATED: true,
  LEGACY_MANUAL: true
};

var FINANCIAL_FACT_VERIFICATION_STATUSES_ = {
  VERIFIED: true, UNVERIFIED: true, REVIEW_REQUIRED: true, CONFLICT: true
};

var FINANCIAL_FACT_RECONCILIATION_STATUSES_ = {
  MATCHED: true, SUPERSEDED: true, CONFLICT: true,
  REVIEW_REQUIRED: true, UNVERIFIED: true
};

var FINANCIAL_FACT_POLICY_FIELD_NAMES_ = {
  DO_NOT_TOUCH: true, USE_POLICY: true, MIN_BUFFER: true, PLANNING_ROLE: true,
  ROBINHOOD_POLICY_FLOOR: true, LIQUIDITY_PREFERENCE: true,
  OWNERSHIP_RESTRICTION: true, ACTIVE_LIFECYCLE_POLICY: true
};

/**
 * Versioned planning policy, not an objectively optimal financial formula.
 * Age is measured from Effective As Of only. Observed At never refreshes it.
 */
var DATA_QUALITY_POLICY_V1_ = {
  policyId: 'DATA_QUALITY_POLICY_V1',
  categories: {
    HIGHLY_TIME_SENSITIVE: { currentDays: 3, recentDays: 7, agingDays: 14 },
    MODERATELY_TIME_SENSITIVE: { currentDays: 30, recentDays: 60, agingDays: 120 },
    LOWER_CHANGE_FREQUENCY: { currentDays: 180, recentDays: 365, agingDays: 730 },
    RECONCILIATION_DEPENDENT: { currentDays: 7, recentDays: 30, agingDays: 90 }
  },
  factTypePolicies: {
    CURRENT_BALANCE: 'BALANCE_VALUE', AVAILABLE_BALANCE: 'BALANCE_VALUE',
    ACCOUNT_VALUE: 'BALANCE_VALUE', APR: 'DEFAULT', APY: 'DEFAULT',
    CREDIT_LIMIT: 'DEFAULT', MINIMUM_PAYMENT: 'DEFAULT',
    NEXT_PAYMENT_AMOUNT: 'DEFAULT', NEXT_PAYMENT_DATE: 'DEFAULT',
    AVAILABLE_CREDIT: 'BALANCE_VALUE', DISCLOSED_APR: 'DEFAULT', PURCHASE_APR: 'DEFAULT',
    CASH_ADVANCE_APR: 'DEFAULT', BALANCE_TRANSFER_APR: 'DEFAULT',
    PROMOTIONAL_APR: 'DEFAULT', PROMOTIONAL_APR_EXPIRATION: 'DEFAULT',
    DEFERRED_INTEREST_STATUS: 'DEFAULT', DEFERRED_INTEREST_EXPIRATION: 'DEFAULT',
    POSITION_QUANTITY: 'DEFAULT', POSITION_MARKET_VALUE: 'DEFAULT',
    SECURITY_PRICE: 'DEFAULT', COST_BASIS: 'RECONCILIATION',
    CASH_SWEEP_YIELD: 'DEFAULT'
  },
  decisionRequirements: {
    PAY_DEBT: ['CURRENT_BALANCE'],
    FUND_INVESTMENT: ['AVAILABLE_BALANCE'],
    SELL_SECURITY: ['POSITION_QUANTITY', 'SECURITY_PRICE', 'COST_BASIS'],
    TRANSFER_SECURITY: ['POSITION_QUANTITY'],
    PAY_LOAN: ['CURRENT_BALANCE', 'APR', 'MINIMUM_PAYMENT'],
    USE_CASH_SOURCE: ['AVAILABLE_BALANCE']
  },
  selectionPolicies: {
    BALANCE_VALUE: [
      { score: 120, freshness: ['CURRENT', 'RECENT'], authority: ['USER_VERIFIED_MANUAL'],
        verification: ['VERIFIED'], manualOverride: true, reconciliation: ['MATCHED'] },
      { score: 110, freshness: ['CURRENT'], authority: ['INSTITUTION_AUTHORITATIVE'],
        verification: ['VERIFIED'], reconciliation: ['MATCHED'] },
      { score: 100, freshness: ['CURRENT'], authority: ['USER_VERIFIED_MANUAL'],
        verification: ['VERIFIED'], reconciliation: ['MATCHED'] },
      { score: 95, freshness: ['RECENT'], authority: ['INSTITUTION_AUTHORITATIVE'],
        verification: ['VERIFIED'], reconciliation: ['MATCHED'] },
      { score: 90, freshness: ['RECENT'], authority: ['USER_VERIFIED_MANUAL'],
        verification: ['VERIFIED'], reconciliation: ['MATCHED'] },
      { score: 75, freshness: ['CURRENT', 'RECENT'],
        authority: ['STATEMENT_DERIVED', 'FILE_IMPORTED', 'CALCULATED'],
        verification: ['VERIFIED'], reconciliation: ['MATCHED'] },
      { score: 65, freshness: ['AGING'],
        authority: ['INSTITUTION_AUTHORITATIVE', 'STATEMENT_DERIVED', 'FILE_IMPORTED'],
        verification: ['VERIFIED'], reconciliation: ['MATCHED'] },
      { score: 55, freshness: ['STALE'], authority: ['INSTITUTION_AUTHORITATIVE'],
        verification: ['VERIFIED'], reconciliation: ['MATCHED'] },
      { score: 45, freshness: ['CURRENT', 'RECENT'], authority: ['ESTIMATED', 'LEGACY_MANUAL'],
        verification: ['UNVERIFIED', 'REVIEW_REQUIRED'],
        reconciliation: ['UNVERIFIED', 'REVIEW_REQUIRED'] },
      { score: 20, freshness: ['AGING', 'STALE', 'UNKNOWN'],
        authority: ['USER_VERIFIED_MANUAL', 'STATEMENT_DERIVED', 'FILE_IMPORTED',
          'CALCULATED', 'ESTIMATED', 'LEGACY_MANUAL'],
        verification: ['VERIFIED', 'UNVERIFIED', 'REVIEW_REQUIRED'],
        reconciliation: ['MATCHED', 'UNVERIFIED', 'REVIEW_REQUIRED'] }
    ],
    DEFAULT: [
      { score: 120, freshness: ['CURRENT', 'RECENT'], authority: ['USER_VERIFIED_MANUAL'],
        verification: ['VERIFIED'], manualOverride: true, reconciliation: ['MATCHED'] },
      { score: 110, freshness: ['CURRENT'], authority: ['INSTITUTION_AUTHORITATIVE'],
        verification: ['VERIFIED'], reconciliation: ['MATCHED'] },
      { score: 100, freshness: ['CURRENT'], authority: ['USER_VERIFIED_MANUAL'],
        verification: ['VERIFIED'], reconciliation: ['MATCHED'] },
      { score: 95, freshness: ['RECENT'], authority: ['INSTITUTION_AUTHORITATIVE'],
        verification: ['VERIFIED'], reconciliation: ['MATCHED'] },
      { score: 85, freshness: ['RECENT'], authority: ['USER_VERIFIED_MANUAL'],
        verification: ['VERIFIED'], reconciliation: ['MATCHED'] },
      { score: 75, freshness: ['CURRENT', 'RECENT'],
        authority: ['STATEMENT_DERIVED', 'FILE_IMPORTED', 'CALCULATED'],
        verification: ['VERIFIED'], reconciliation: ['MATCHED'] },
      { score: 60, freshness: ['AGING', 'STALE'],
        authority: ['INSTITUTION_AUTHORITATIVE', 'STATEMENT_DERIVED', 'FILE_IMPORTED'],
        verification: ['VERIFIED'], reconciliation: ['MATCHED'] },
      { score: 40, freshness: ['CURRENT', 'RECENT'], authority: ['ESTIMATED', 'LEGACY_MANUAL'],
        verification: ['UNVERIFIED', 'REVIEW_REQUIRED'],
        reconciliation: ['UNVERIFIED', 'REVIEW_REQUIRED'] },
      { score: 20, freshness: ['AGING', 'STALE', 'UNKNOWN'],
        authority: ['USER_VERIFIED_MANUAL', 'CALCULATED', 'ESTIMATED', 'LEGACY_MANUAL'],
        verification: ['VERIFIED', 'UNVERIFIED', 'REVIEW_REQUIRED'],
        reconciliation: ['MATCHED', 'UNVERIFIED', 'REVIEW_REQUIRED'] }
    ],
    RECONCILIATION: [
      { score: 110, freshness: ['CURRENT'],
        authority: ['INSTITUTION_AUTHORITATIVE', 'STATEMENT_DERIVED', 'FILE_IMPORTED'],
        verification: ['VERIFIED'], reconciliation: ['MATCHED'] },
      { score: 95, freshness: ['RECENT'],
        authority: ['INSTITUTION_AUTHORITATIVE', 'STATEMENT_DERIVED', 'FILE_IMPORTED'],
        verification: ['VERIFIED'], reconciliation: ['MATCHED'] },
      { score: 30, freshness: ['CURRENT', 'RECENT', 'AGING', 'STALE', 'UNKNOWN'],
        authority: ['USER_VERIFIED_MANUAL', 'STATEMENT_DERIVED', 'FILE_IMPORTED',
          'ESTIMATED', 'LEGACY_MANUAL'],
        verification: ['VERIFIED', 'UNVERIFIED', 'REVIEW_REQUIRED'],
        reconciliation: ['UNVERIFIED', 'REVIEW_REQUIRED'] }
    ]
  }
};

var FINANCIAL_FACT_DECISION_TYPES_ = {
  PAY_DEBT: true, FUND_INVESTMENT: true, SELL_SECURITY: true,
  TRANSFER_SECURITY: true, PAY_LOAN: true, USE_CASH_SOURCE: true
};

function ensureFinancialFactsSheet_(optionalSs) {
  var ss = optionalSs || getUserSpreadsheet_();
  var name = getSheetNames_().FINANCIAL_FACTS;
  var existing = ss.getSheetByName(name);
  if (existing) {
    financialFactsAssertHeaders_(existing);
    return existing;
  }
  var sheet;
  try {
    sheet = ss.insertSheet(name);
  } catch (e) {
    sheet = ss.getSheetByName(name);
    if (!sheet) throw e;
    financialFactsAssertHeaders_(sheet);
    return sheet;
  }
  sheet.getRange(1, 1, 1, FINANCIAL_FACT_HEADERS_.length)
    .setValues([FINANCIAL_FACT_HEADERS_]);
  try {
    sheet.getRange(1, 1, 1, FINANCIAL_FACT_HEADERS_.length)
      .setFontWeight('bold').setBackground('#ffe599')
      .setHorizontalAlignment('center');
    sheet.setFrozenRows(1);
    sheet.setFrozenColumns(1);
    for (var i = 0; i < FINANCIAL_FACT_HEADERS_.length; i++) {
      sheet.setColumnWidth(i + 1,
        FINANCIAL_FACT_CANONICAL_WIDTHS_[FINANCIAL_FACT_HEADERS_[i]] || 140);
    }
  } catch (_formatErr) { /* first-create presentation only */ }
  return sheet;
}

function financialFactsAssertHeaders_(sheet) {
  var actual = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1))
    .getDisplayValues()[0] || [];
  for (var i = 0; i < FINANCIAL_FACT_HEADERS_.length; i++) {
    if (String(actual[i] || '').trim() !== FINANCIAL_FACT_HEADERS_[i]) {
      throw new Error(sheet.getName() + ' column ' + (i + 1) +
        ' must be "' + FINANCIAL_FACT_HEADERS_[i] + '". No changes were made.');
    }
  }
}

function financialFactEnum_(value, allowed, label, fallback) {
  var key = String(value || '').trim().toUpperCase() || String(fallback || '');
  if (!allowed[key]) throw new Error('Unsupported ' + label + ': ' + value);
  return key;
}

function financialFactIso_(value, label) {
  if (value === '' || value === null || typeof value === 'undefined') return '';
  var date = value instanceof Date ? value : new Date(value);
  if (isNaN(date.getTime())) throw new Error((label || 'date') + ' is invalid.');
  return date.toISOString();
}

function financialFactNumber_(value) {
  if (value === '' || value === null || typeof value === 'undefined') return '';
  var number = Number(value);
  if (!isFinite(number)) throw new Error('Financial fact numericValue must be finite.');
  return number;
}

function financialFactCanonicalDateValue_(value) {
  var text = String(value || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    throw new Error('Date-valued financial facts require Text Value in YYYY-MM-DD format.');
  }
  var parsed = new Date(text + 'T00:00:00.000Z');
  if (isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== text) {
    throw new Error('Date-valued financial fact contains an invalid calendar date.');
  }
  return text;
}

function financialFactValidateValueContract_(factType, numeric, text, unit) {
  var metadata = FINANCIAL_FACT_TYPE_METADATA_[factType];
  if (!metadata) throw new Error('Missing value metadata for financial fact type: ' + factType);
  var normalizedUnit = String(unit || '').trim().toUpperCase();
  if (metadata.valueKind === 'DATE') {
    if (numeric !== '') throw new Error(factType + ' does not permit Numeric Value.');
    text = financialFactCanonicalDateValue_(text);
    if (normalizedUnit && normalizedUnit !== 'DATE') {
      throw new Error(factType + ' requires Currency Or Unit = DATE.');
    }
    return { numericValue: '', textValue: text, currencyOrUnit: 'DATE' };
  }
  if (metadata.valueKind === 'TEXT') {
    if (numeric !== '') throw new Error(factType + ' does not permit Numeric Value.');
    if (!text) throw new Error(factType + ' requires Text Value.');
    if (metadata.unitKind === 'STATUS' && normalizedUnit !== 'STATUS') {
      throw new Error(factType + ' requires Currency Or Unit = STATUS.');
    }
    return { numericValue: '', textValue: text.toUpperCase(), currencyOrUnit: normalizedUnit };
  }
  if (numeric === '') throw new Error(factType + ' requires Numeric Value.');
  if (text) throw new Error(factType + ' does not permit Text Value with Numeric Value.');
  if (metadata.unitKind === 'CURRENCY' && !/^[A-Z]{3}$/.test(normalizedUnit)) {
    throw new Error(factType + ' requires a three-letter currency unit such as USD.');
  }
  if (metadata.unitKind === 'PERCENT') {
    if (['PERCENT', 'PERCENT_FIXED', 'PERCENT_VARIABLE'].indexOf(normalizedUnit) === -1) {
      throw new Error(factType + ' requires PERCENT, PERCENT_FIXED, or PERCENT_VARIABLE.');
    }
    if (numeric < 0 || numeric > 1000) {
      throw new Error(factType + ' percent value must be between 0 and 1000.');
    }
  }
  if (metadata.unitKind === 'QUANTITY' && ['SHARES', 'UNITS'].indexOf(normalizedUnit) === -1) {
    throw new Error(factType + ' requires SHARES or UNITS.');
  }
  return { numericValue: numeric, textValue: '', currencyOrUnit: normalizedUnit };
}

function normalizeFinancialFact_(raw, options) {
  if (!raw || typeof raw !== 'object') throw new Error('Financial fact is required.');
  var opts = options || {};
  var factType = String(raw.factType || '').trim().toUpperCase();
  if (FINANCIAL_FACT_POLICY_FIELD_NAMES_[factType]) {
    throw new Error('Household policy cannot be stored as a financial fact: ' + factType);
  }
  factType = financialFactEnum_(factType, FINANCIAL_FACT_TYPES_, 'financial fact type');
  var accountId = String(raw.stableInternalAccountId || raw.stableAccountId || '').trim();
  if (!accountId) throw new Error('stableInternalAccountId is required.');
  if (!/^(CASH|DEBT|INV|RET|PROP)-[A-Za-z0-9-]+$/.test(accountId)) {
    throw new Error('stableInternalAccountId must be a protected CashCompass account ID.');
  }
  var effective = financialFactIso_(raw.effectiveAsOf, 'effectiveAsOf');
  var observed = financialFactIso_(raw.observedAt, 'observedAt');
  var created = financialFactIso_(raw.createdAt, 'createdAt') ||
    (opts.defaultCreatedAt ? financialFactIso_(opts.defaultCreatedAt, 'defaultCreatedAt') : '');
  var comparison = financialFactIso_(opts.asOf || new Date(), 'asOf');
  if (effective && new Date(effective).getTime() > new Date(comparison).getTime()) {
    throw new Error('effectiveAsOf cannot be in the future.');
  }
  var numeric = financialFactNumber_(raw.numericValue);
  var text = String(raw.textValue === null || typeof raw.textValue === 'undefined'
    ? '' : raw.textValue).trim();
  if (numeric === '' && !text) throw new Error('A financial fact requires numericValue or textValue.');
  var valueContract = financialFactValidateValueContract_(factType, numeric, text,
    raw.currencyOrUnit);
  var manualOverride = raw.manualOverride === true ||
    ['yes', 'true', '1'].indexOf(String(raw.manualOverride || '').trim().toLowerCase()) !== -1;
  var suppliedFactId = String(raw.factId || '').trim();
  if (suppliedFactId && !/^FACT-[A-Za-z0-9-]+$/.test(suppliedFactId)) {
    throw new Error('factId must be a protected FACT- identifier.');
  }
  var sourceRecordKey = String(raw.sourceRecordKey || '').trim();
  if (sourceRecordKey && !/^sha256:[a-f0-9]{64}$/i.test(sourceRecordKey)) {
    throw new Error('sourceRecordKey must be a protected sha256 key.');
  }
  var normalized = {
    factId: suppliedFactId,
    stableInternalAccountId: accountId,
    factType: factType,
    numericValue: valueContract.numericValue,
    textValue: valueContract.textValue,
    currencyOrUnit: valueContract.currencyOrUnit,
    effectiveAsOf: effective,
    observedAt: observed,
    sourceType: financialFactEnum_(raw.sourceType, FINANCIAL_FACT_SOURCE_TYPES_,
      'financial fact source type'),
    sourceSystem: String(raw.sourceSystem || '').trim(),
    importRunId: String(raw.importRunId || '').trim(),
    sourceRecordKey: sourceRecordKey.toLowerCase(),
    authorityClass: financialFactEnum_(raw.authorityClass,
      FINANCIAL_FACT_AUTHORITY_CLASSES_, 'financial fact authority class'),
    verificationStatus: financialFactEnum_(raw.verificationStatus,
      FINANCIAL_FACT_VERIFICATION_STATUSES_, 'financial fact verification status',
      'UNVERIFIED'),
    verifiedAt: financialFactIso_(raw.verifiedAt, 'verifiedAt'),
    manualOverride: manualOverride,
    supersedesFactId: String(raw.supersedesFactId || '').trim(),
    reconciliationStatus: financialFactEnum_(raw.reconciliationStatus,
      FINANCIAL_FACT_RECONCILIATION_STATUSES_, 'financial fact reconciliation status',
      'UNVERIFIED'),
    createdAt: created
  };
  normalized.contentIdentity = financialFactContentIdentity_(normalized);
  if (!normalized.factId) normalized.factId = 'FACT-' + normalized.contentIdentity.slice(0, 32);
  return normalized;
}

function financialFactContentIdentity_(fact) {
  var identity = [
    fact.stableInternalAccountId, fact.factType, fact.numericValue,
    fact.textValue, fact.currencyOrUnit, fact.effectiveAsOf, fact.sourceType,
    fact.sourceSystem, fact.sourceRecordKey, fact.authorityClass,
    fact.verificationStatus, fact.manualOverride ? '1' : '0',
    fact.reconciliationStatus
  ].join('\n');
  return financialFactDigest_(identity);
}

function financialFactDigest_(value) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,
    String(value || ''), Utilities.Charset.UTF_8);
  var hex = '';
  for (var i = 0; i < bytes.length; i++) {
    var unsigned = bytes[i] < 0 ? bytes[i] + 256 : bytes[i];
    var part = unsigned.toString(16);
    hex += part.length === 1 ? '0' + part : part;
  }
  return hex;
}

function financialFactCategory_(fact) {
  var type = String(fact && fact.factType || '').toUpperCase();
  var unit = String(fact && fact.currencyOrUnit || '').toUpperCase();
  if (type === 'APR' && unit === 'PERCENT_FIXED') return 'LOWER_CHANGE_FREQUENCY';
  var metadata = FINANCIAL_FACT_TYPE_METADATA_[type];
  return metadata ? metadata.freshnessCategory : 'HIGHLY_TIME_SENSITIVE';
}

function evaluateFinancialFactFreshness_(fact, asOf) {
  var policyId = DATA_QUALITY_POLICY_V1_.policyId;
  if (!fact) return { status: 'MISSING', ageDays: null, ruleId: policyId + ':MISSING',
    reason: 'Required fact is missing.', safeToModel: false, safeToAct: false };
  if (!fact.effectiveAsOf) return { status: 'UNKNOWN', ageDays: null,
    ruleId: policyId + ':UNKNOWN_TIMESTAMP',
    reason: 'Effective As Of is unknown.', safeToModel: true, safeToAct: false };
  var target = new Date(asOf || new Date());
  var effective = new Date(fact.effectiveAsOf);
  if (isNaN(effective.getTime()) || effective.getTime() > target.getTime()) {
    return { status: 'UNKNOWN', ageDays: null,
      ruleId: policyId + ':INVALID_EFFECTIVE_AS_OF',
      reason: 'Effective As Of is invalid or in the future.',
      safeToModel: false, safeToAct: false };
  }
  var category = financialFactCategory_(fact);
  var rule = DATA_QUALITY_POLICY_V1_.categories[category];
  var age = Math.floor((target.getTime() - effective.getTime()) / 86400000);
  var status = age <= rule.currentDays ? 'CURRENT'
    : age <= rule.recentDays ? 'RECENT'
      : age <= rule.agingDays ? 'AGING' : 'STALE';
  var blocked = fact.verificationStatus === 'CONFLICT' ||
    fact.reconciliationStatus === 'CONFLICT' ||
    fact.reconciliationStatus === 'REVIEW_REQUIRED';
  var reconciliationSafe = category !== 'RECONCILIATION_DEPENDENT' ||
    fact.reconciliationStatus === 'MATCHED';
  var safeToAct = !blocked && reconciliationSafe &&
    (status === 'CURRENT' || status === 'RECENT') &&
    fact.verificationStatus === 'VERIFIED';
  return {
    status: status,
    ageDays: age,
    category: category,
    ruleId: policyId + ':' + category,
    reason: status + ' under ' + category + ' thresholds; age ' + age + ' day(s).',
    safeToModel: !blocked,
    safeToAct: safeToAct
  };
}

function financialFactFreshnessRank_(status) {
  return { CURRENT: 6, RECENT: 5, AGING: 4, STALE: 3, UNKNOWN: 2, MISSING: 0 }[status] || 0;
}

function financialFactAuthorityRank_(authority) {
  return {
    INSTITUTION_AUTHORITATIVE: 70,
    USER_VERIFIED_MANUAL: 60,
    STATEMENT_DERIVED: 50,
    CALCULATED: 40,
    FILE_IMPORTED: 35,
    LEGACY_MANUAL: 20,
    ESTIMATED: 10
  }[String(authority || '').toUpperCase()] || 0;
}

function financialFactVerificationRank_(status) {
  return { VERIFIED: 4, UNVERIFIED: 2, REVIEW_REQUIRED: 1, CONFLICT: 0 }[
    String(status || '').toUpperCase()] || 0;
}

function financialFactPolicyRuleMatches_(rule, fact, freshness) {
  function includes_(values, value) {
    return !values || !values.length || values.indexOf(String(value || '').toUpperCase()) !== -1;
  }
  if (!includes_(rule.freshness, freshness.status)) return false;
  if (!includes_(rule.authority, fact.authorityClass)) return false;
  if (!includes_(rule.verification, fact.verificationStatus)) return false;
  if (!includes_(rule.reconciliation, fact.reconciliationStatus)) return false;
  if (rule.manualOverride === true && !fact.manualOverride) return false;
  if (rule.manualOverride === false && fact.manualOverride) return false;
  return true;
}

function financialFactSelectionPolicyScore_(fact, asOf) {
  var freshness = evaluateFinancialFactFreshness_(fact, asOf);
  var policyName = DATA_QUALITY_POLICY_V1_.factTypePolicies[fact.factType] || 'DEFAULT';
  var rules = DATA_QUALITY_POLICY_V1_.selectionPolicies[policyName] || [];
  for (var i = 0; i < rules.length; i++) {
    if (financialFactPolicyRuleMatches_(rules[i], fact, freshness)) {
      return { score: rules[i].score, policyName: policyName,
        ruleId: DATA_QUALITY_POLICY_V1_.policyId + ':SELECT:' + policyName + ':' + (i + 1) };
    }
  }
  return { score: 0, policyName: policyName,
    ruleId: DATA_QUALITY_POLICY_V1_.policyId + ':SELECT:' + policyName + ':INADMISSIBLE' };
}

function financialFactSelectionVector_(fact, asOf) {
  var policy = financialFactSelectionPolicyScore_(fact, asOf);
  return [
    policy.score,
    fact.effectiveAsOf ? new Date(fact.effectiveAsOf).getTime() : 0,
    fact.observedAt ? new Date(fact.observedAt).getTime() : 0,
    String(fact.factId || '')
  ];
}

function financialFactCompareVectors_(a, b) {
  for (var i = 0; i < a.length; i++) {
    if (a[i] === b[i]) continue;
    return a[i] > b[i] ? -1 : 1;
  }
  return 0;
}

function financialFactValueKey_(fact) {
  return String(fact.numericValue) + '\n' + String(fact.textValue || '') + '\n' +
    String(fact.currencyOrUnit || '');
}

function selectCurrentFinancialFact_(facts, accountId, factType, asOf) {
  return selectCurrentFinancialFactFromIndex_(indexFinancialFacts_(facts),
    accountId, factType, asOf);
}

function indexFinancialFacts_(facts) {
  var index = { factsByKey: {}, supersededFactIds: {} };
  (facts || []).forEach(function(row) {
    if (!row) return;
    if (row.supersedesFactId) {
      index.supersededFactIds[String(row.supersedesFactId)] = true;
    }
    if (!row.stableInternalAccountId || !row.factType) return;
    var key = row.stableInternalAccountId + '\n' + String(row.factType).toUpperCase();
    if (!index.factsByKey[key]) index.factsByKey[key] = [];
    index.factsByKey[key].push(row);
  });
  return index;
}

function selectCurrentFinancialFactFromIndex_(index, accountId, factType, asOf) {
  var targetTime = new Date(asOf || new Date()).getTime();
  var normalizedType = String(factType || '').trim().toUpperCase();
  var key = String(accountId || '').trim() + '\n' + normalizedType;
  var candidates = (index.factsByKey[key] || []).filter(function(row) {
    if (index.supersededFactIds[String(row.factId || '')]) return false;
    if (row.effectiveAsOf && new Date(row.effectiveAsOf).getTime() > targetTime) return false;
    if (row.observedAt && new Date(row.observedAt).getTime() > targetTime) return false;
    return true;
  });
  candidates.sort(function(a, b) {
    return financialFactCompareVectors_(financialFactSelectionVector_(a, asOf),
      financialFactSelectionVector_(b, asOf));
  });
  if (!candidates.length) {
    return { fact: null, freshness: evaluateFinancialFactFreshness_(null, asOf),
      confidence: 'LOW', reconciliationStatus: 'UNVERIFIED', diagnostics: ['MISSING_FACT'] };
  }
  var selected = candidates[0];
  var top = financialFactSelectionVector_(selected, asOf);
  var conflict = candidates.some(function(row, index) {
    if (row.verificationStatus === 'CONFLICT' || row.reconciliationStatus === 'CONFLICT') {
      return true;
    }
    if (!index) return false;
    var vector = financialFactSelectionVector_(row, asOf);
    var sameDecisionQuality = vector.slice(0, 2).join('|') === top.slice(0, 2).join('|');
    return sameDecisionQuality && financialFactValueKey_(row) !== financialFactValueKey_(selected);
  });
  var freshness = evaluateFinancialFactFreshness_(selected, asOf);
  var selectionPolicy = financialFactSelectionPolicyScore_(selected, asOf);
  if (conflict) {
    freshness = { status: freshness.status, ageDays: freshness.ageDays,
      category: freshness.category, ruleId: freshness.ruleId + ':CONFLICT',
      reason: 'Equally qualified facts disagree.', safeToModel: false, safeToAct: false };
  }
  var confidence = freshness.safeToAct ? 'HIGH' : freshness.safeToModel ? 'MEDIUM' : 'LOW';
  return {
    fact: selected,
    freshness: freshness,
    confidence: confidence,
    selectionRuleId: selectionPolicy.ruleId,
    reconciliationStatus: conflict ? 'CONFLICT' : selected.reconciliationStatus,
    diagnostics: conflict ? ['CONFLICTING_FACTS'] : []
  };
}

function buildCurrentFinancialFactsProjection_(facts, asOf) {
  var index = indexFinancialFacts_(facts);
  return Object.keys(index.factsByKey).sort().map(function(key) {
    var parts = key.split('\n');
    var request = { stableInternalAccountId: parts[0], factType: parts[1] };
    var selection = selectCurrentFinancialFactFromIndex_(index,
      request.stableInternalAccountId, request.factType, asOf);
    return { stableInternalAccountId: request.stableInternalAccountId,
      factType: request.factType, selection: selection };
  });
}

function evaluateDecisionDataQuality_(decisionType, requiredSelections) {
  var type = financialFactEnum_(decisionType, FINANCIAL_FACT_DECISION_TYPES_,
    'decision type');
  var selections = requiredSelections || [];
  var reasons = [];
  var safeToModel = selections.length > 0;
  var safeToAct = selections.length > 0;
  var selectedFacts = [];
  var selectedTypes = {};
  for (var i = 0; i < selections.length; i++) {
    var selection = selections[i] && selections[i].selection
      ? selections[i].selection : selections[i];
    if (!selection || !selection.fact) {
      safeToModel = false;
      safeToAct = false;
      reasons.push('MISSING_REQUIRED_FACT');
      continue;
    }
    selectedFacts.push(selection.fact);
    selectedTypes[selection.fact.factType] = true;
    if (!selection.freshness.safeToModel) safeToModel = false;
    if (!selection.freshness.safeToAct) safeToAct = false;
    if (!selection.freshness.safeToAct) {
      reasons.push(selection.fact.factType + ':' + selection.freshness.status);
    }
    if ((type === 'SELL_SECURITY' || type === 'TRANSFER_SECURITY') &&
        selection.fact.factType === 'POSITION_QUANTITY' &&
        !selection.freshness.safeToAct) {
      reasons.push('POSITION_QUANTITY_NOT_ACTIONABLE');
    }
    if (type === 'SELL_SECURITY' && selection.fact.factType === 'COST_BASIS' &&
        selection.fact.reconciliationStatus !== 'MATCHED') {
      safeToAct = false;
      reasons.push('COST_BASIS_NOT_RECONCILED');
    }
  }
  var requiredTypes = DATA_QUALITY_POLICY_V1_.decisionRequirements[type] || [];
  for (var r = 0; r < requiredTypes.length; r++) {
    if (!selectedTypes[requiredTypes[r]]) {
      safeToModel = false;
      safeToAct = false;
      reasons.push('MISSING_REQUIRED_FACT:' + requiredTypes[r]);
    }
  }
  var confidence = safeToAct ? 'HIGH' : safeToModel ? 'MEDIUM' : 'LOW';
  return { decisionType: type, safeToModel: safeToModel, safeToAct: safeToAct,
    confidence: confidence, reasons: financialFactUnique_(reasons), facts: selectedFacts };
}

function evaluateDecisionFinancialFacts_(decisionType, requests, facts, asOf) {
  var index = indexFinancialFacts_(facts);
  var selections = (requests || []).map(function(request) {
    return selectCurrentFinancialFactFromIndex_(index, request.stableInternalAccountId,
      request.factType, asOf);
  });
  return evaluateDecisionDataQuality_(decisionType, selections);
}

function financialFactUnique_(values) {
  var seen = {};
  return (values || []).filter(function(value) {
    var key = String(value || '');
    if (!key || seen[key]) return false;
    seen[key] = true;
    return true;
  });
}

function financialFactFromLegacyValue_(input) {
  var raw = input || {};
  return normalizeFinancialFact_({
    stableInternalAccountId: raw.stableInternalAccountId,
    factType: raw.factType,
    numericValue: raw.numericValue,
    textValue: raw.textValue,
    currencyOrUnit: raw.currencyOrUnit,
    effectiveAsOf: raw.effectiveAsOf || '',
    observedAt: raw.observedAt || '',
    sourceType: 'LEGACY',
    sourceSystem: raw.sourceSystem || 'LEGACY_DOMAIN_SHEET',
    importRunId: '',
    sourceRecordKey: raw.sourceRecordKey || '',
    authorityClass: 'LEGACY_MANUAL',
    verificationStatus: raw.verificationStatus || 'UNVERIFIED',
    verifiedAt: raw.verifiedAt || '',
    manualOverride: false,
    supersedesFactId: '',
    reconciliationStatus: raw.reconciliationStatus || 'UNVERIFIED',
    createdAt: raw.createdAt || raw.observedAt || ''
  }, { asOf: raw.asOf || new Date(), defaultCreatedAt: raw.createdAt || raw.observedAt || '' });
}

function prepareFinancialFactAppend_(existingFacts, rawFacts, options) {
  var opts = options || {};
  var all = (existingFacts || []).slice();
  var existingIds = {};
  all.forEach(function(row) { existingIds[String(row.factId || '')] = row; });
  var appended = [];
  var duplicates = [];
  (rawFacts || []).forEach(function(raw) {
    var fact = normalizeFinancialFact_(raw, opts);
    if (existingIds[fact.factId]) {
      duplicates.push(fact.factId);
      return;
    }
    var prior = selectCurrentFinancialFact_(all, fact.stableInternalAccountId,
      fact.factType, opts.asOf || new Date()).fact;
    if (prior && !fact.supersedesFactId) {
      var sameEffective = prior.effectiveAsOf && fact.effectiveAsOf &&
        prior.effectiveAsOf === fact.effectiveAsOf;
      var conflicting = sameEffective &&
        financialFactValueKey_(prior) !== financialFactValueKey_(fact);
      if (conflicting) {
        fact.reconciliationStatus = 'CONFLICT';
      } else if (!prior.effectiveAsOf || !fact.effectiveAsOf ||
          new Date(fact.effectiveAsOf).getTime() >= new Date(prior.effectiveAsOf).getTime()) {
        fact.supersedesFactId = prior.factId;
      }
    }
    appended.push(fact);
    all.push(fact);
    existingIds[fact.factId] = fact;
  });
  return { appended: appended, duplicates: duplicates, allFacts: all };
}

function appendFinancialFacts_(optionalSs, rawFacts, options) {
  var ss = optionalSs || getUserSpreadsheet_();
  var existing = readFinancialFacts_(ss);
  var prepared = prepareFinancialFactAppend_(existing, rawFacts, options);
  if (!prepared.appended.length) {
    return { appended: 0, duplicates: prepared.duplicates.length,
      factIds: prepared.duplicates.slice() };
  }
  var sheet = ensureFinancialFactsSheet_(ss);
  var rows = prepared.appended.map(financialFactToRow_);
  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, FINANCIAL_FACT_HEADERS_.length)
    .setValues(rows);
  SpreadsheetApp.flush();
  return { appended: rows.length, duplicates: prepared.duplicates.length,
    factIds: prepared.appended.map(function(row) { return row.factId; }) };
}

function readFinancialFacts_(optionalSs) {
  var ss = optionalSs || getUserSpreadsheet_();
  var sheet = ss.getSheetByName(getSheetNames_().FINANCIAL_FACTS);
  if (!sheet || sheet.getLastRow() < 2) return [];
  financialFactsAssertHeaders_(sheet);
  var rows = sheet.getRange(2, 1, sheet.getLastRow() - 1,
    FINANCIAL_FACT_HEADERS_.length).getValues();
  return rows.filter(function(row) { return String(row[0] || '').trim(); })
    .map(financialFactFromRow_);
}

function financialFactToRow_(fact) {
  return [fact.factId, fact.stableInternalAccountId, fact.factType,
    fact.numericValue, fact.textValue, fact.currencyOrUnit, fact.effectiveAsOf,
    fact.observedAt, fact.sourceType, fact.sourceSystem, fact.importRunId,
    fact.sourceRecordKey, fact.authorityClass, fact.verificationStatus,
    fact.verifiedAt, fact.manualOverride ? 'Yes' : 'No', fact.supersedesFactId,
    fact.reconciliationStatus, fact.createdAt];
}

function financialFactTextValueFromCell_(value, factType) {
  if (FINANCIAL_FACT_TYPE_METADATA_[factType] &&
      FINANCIAL_FACT_TYPE_METADATA_[factType].valueKind === 'DATE' &&
      Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
    if (typeof Utilities !== 'undefined' && Utilities &&
        typeof Utilities.formatDate === 'function' && typeof Session !== 'undefined' &&
        Session && typeof Session.getScriptTimeZone === 'function') {
      return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    }
    var year = value.getFullYear();
    var month = String(value.getMonth() + 1).padStart(2, '0');
    var day = String(value.getDate()).padStart(2, '0');
    return year + '-' + month + '-' + day;
  }
  return String(value || '').trim();
}

function financialFactFromRow_(row) {
  var factType = String(row[2] || '').trim();
  return {
    factId: String(row[0] || '').trim(),
    stableInternalAccountId: String(row[1] || '').trim(),
    factType: factType,
    numericValue: row[3] === '' ? '' : Number(row[3]),
    textValue: financialFactTextValueFromCell_(row[4], factType),
    currencyOrUnit: String(row[5] || '').trim(),
    effectiveAsOf: financialFactIso_(row[6], 'Effective As Of'),
    observedAt: financialFactIso_(row[7], 'Observed At'),
    sourceType: String(row[8] || '').trim(), sourceSystem: String(row[9] || '').trim(),
    importRunId: String(row[10] || '').trim(), sourceRecordKey: String(row[11] || '').trim(),
    authorityClass: String(row[12] || '').trim(),
    verificationStatus: String(row[13] || '').trim(),
    verifiedAt: financialFactIso_(row[14], 'Verified At'),
    manualOverride: String(row[15] || '').trim().toLowerCase() === 'yes',
    supersedesFactId: String(row[16] || '').trim(),
    reconciliationStatus: String(row[17] || '').trim(),
    createdAt: financialFactIso_(row[18], 'Created At')
  };
}

/**
 * Shadow-only institution-neutral API. It bulk-reads the fact table once and
 * does not create sheets or change current Part 1 Planning authority.
 */
function readPlanningFinancialFacts_(requests, asOf, optionalSs) {
  var ss = optionalSs || getUserSpreadsheet_();
  var facts = readFinancialFacts_(ss);
  var index = indexFinancialFacts_(facts);
  var results = (requests || []).map(function(request) {
    return {
      stableInternalAccountId: request.stableInternalAccountId,
      factType: request.factType,
      selection: selectCurrentFinancialFactFromIndex_(index,
        request.stableInternalAccountId, request.factType, asOf)
    };
  });
  return { authority: 'SHADOW_ONLY', policyId: DATA_QUALITY_POLICY_V1_.policyId,
    factsRead: facts.length, results: results,
    diagnostics: buildFinancialFactDataQualityDiagnostics_(results) };
}

function buildFinancialFactDataQualityDiagnostics_(results) {
  var diagnostics = [];
  (results || []).forEach(function(result) {
    var selection = result && result.selection;
    var fact = selection && selection.fact;
    var status = selection && selection.freshness
      ? selection.freshness.status : 'MISSING';
    var type = String(result && result.factType || fact && fact.factType || '').toUpperCase();
    var accountId = result && result.stableInternalAccountId ||
      fact && fact.stableInternalAccountId || '';
    if (!accountId) {
      diagnostics.push(financialFactDiagnostic_('UNRESOLVED_IDENTITY', selection, accountId, type));
    }
    if (!fact) {
      diagnostics.push(financialFactDiagnostic_(
        type === 'CURRENT_BALANCE' || type === 'AVAILABLE_BALANCE'
          ? 'MISSING_BALANCE' : 'MISSING_FACT', selection, accountId, type));
      return;
    }
    if (selection.reconciliationStatus === 'CONFLICT') {
      diagnostics.push(financialFactDiagnostic_('CONFLICTING_FACTS', selection, accountId, type));
    }
    if (status === 'UNKNOWN') {
      diagnostics.push(financialFactDiagnostic_('UNKNOWN_TIMESTAMP', selection, accountId, type));
    } else if (status === 'STALE') {
      diagnostics.push(financialFactDiagnostic_(
        type.indexOf('BALANCE') !== -1 ? 'STALE_BALANCE' : 'STALE_FACT',
        selection, accountId, type));
    } else if (status === 'AGING') {
      diagnostics.push(financialFactDiagnostic_(type === 'APR' ? 'AGING_APR' : 'AGING_FACT',
        selection, accountId, type));
    }
    if ((fact.authorityClass === 'ESTIMATED' || fact.authorityClass === 'LEGACY_MANUAL') &&
        fact.verificationStatus !== 'VERIFIED') {
      diagnostics.push(financialFactDiagnostic_('UNVERIFIED_MANUAL_INPUT',
        selection, accountId, type));
    }
    if (selection.freshness.safeToModel && !selection.freshness.safeToAct) {
      diagnostics.push(financialFactDiagnostic_('SAFE_TO_MODEL_NOT_ACT',
        selection, accountId, type));
    }
  });
  return diagnostics;
}

function financialFactDiagnostic_(code, selection, optionalAccountId, optionalFactType) {
  var fact = selection && selection.fact;
  return {
    code: String(code || 'DATA_QUALITY_FINDING').replace(/[^A-Z0-9_:-]/gi, ''),
    stableInternalAccountId: financialFactSafeStableId_(optionalAccountId ||
      fact && fact.stableInternalAccountId),
    factType: FINANCIAL_FACT_TYPES_[String(optionalFactType || '').toUpperCase()]
      ? String(optionalFactType).toUpperCase()
      : fact && FINANCIAL_FACT_TYPES_[fact.factType] ? fact.factType : 'UNKNOWN',
    freshnessStatus: selection && selection.freshness
      ? selection.freshness.status : 'MISSING',
    safeToModel: !!(selection && selection.freshness && selection.freshness.safeToModel),
    safeToAct: !!(selection && selection.freshness && selection.freshness.safeToAct)
  };
}

function financialFactSafeStableId_(value) {
  var text = String(value || '').trim();
  return /^(CASH|DEBT|INV|RET|PROP)-[A-Za-z0-9-]+$/.test(text)
    ? text : (text ? 'ACCOUNT-' + financialFactDigest_(text).slice(0, 12) : '');
}
