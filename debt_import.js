/**
 * Part 2A-4 authoritative revolving-debt evidence import.
 *
 * This module is shadow-only. It appends protected identity links, versioned
 * Financial Facts, and sanitized Import Runs. It never writes INPUT - Debts,
 * never changes Part 1 Planning, and never releases a debt minimum.
 */

var DEBT_IMPORT_CONTRACT_VERSION_ = 'DEBT_EVIDENCE_V1';
var DEBT_IMPORT_OFX_ADAPTER_VERSION_ = 'OFX_QFX_REVOLVING_DEBT_V1';
var DEBT_IMPORT_STRUCTURED_ADAPTER_VERSION_ = 'STRUCTURED_DEBT_SNAPSHOT_V1';
var DEBT_IMPORT_MANUAL_ADAPTER_VERSION_ = 'USER_VERIFIED_MANUAL_DEBT_V1';
var DEBT_IMPORT_RECONCILIATION_POLICY_V1_ = {
  policyId: 'DEBT_SHADOW_EXACT_RECONCILIATION_V1',
  currencyMinorUnit: 0.01,
  percentagePrecision: 0.0001,
  explanation: 'Debt values compare at their declared unit precision; every non-zero difference remains visible.'
};
var DEBT_IMPORT_MATERIALITY_POLICY_V1_ = {
  policyId: 'DEBT_SHADOW_PLANNING_MATERIALITY_V1',
  status: 'NOT_YET_DECIDED',
  explanation: 'Planning materiality is intentionally deferred; no debt difference is discarded.'
};
var DEBT_IMPORT_FACT_TYPES_ = {
  CURRENT_BALANCE: true, APR: true, MINIMUM_PAYMENT: true,
  NEXT_PAYMENT_AMOUNT: true, NEXT_PAYMENT_DATE: true, CREDIT_LIMIT: true,
  AVAILABLE_CREDIT: true, DISCLOSED_APR: true, PURCHASE_APR: true, CASH_ADVANCE_APR: true,
  BALANCE_TRANSFER_APR: true, PROMOTIONAL_APR: true,
  PROMOTIONAL_APR_EXPIRATION: true, DEFERRED_INTEREST_STATUS: true,
  DEFERRED_INTEREST_EXPIRATION: true
};
var DEBT_IMPORT_CORE_SHADOW_FACT_TYPES_ = [
  'CURRENT_BALANCE', 'APR', 'MINIMUM_PAYMENT', 'NEXT_PAYMENT_DATE'
];

/** Parse explicit account-level aggregates from OFX/QFX credit-card statements. */
function adaptOfxRevolvingDebtEvidence_(rawText, options) {
  var opts = options || {};
  var raw = String(rawText || '');
  if (!raw.trim()) throw new Error('OFX/QFX debt file is required.');
  if (raw.length > 5000000) throw new Error('OFX/QFX debt file is too large.');
  var ofxStart = raw.toUpperCase().indexOf('<OFX');
  if (ofxStart === -1) throw new Error('This is not a recognizable OFX/QFX file.');
  var body = raw.slice(ofxStart);
  var org = cashImportOfxTag_(body, 'ORG');
  var fid = cashImportOfxTag_(body, 'FID');
  var sourceSystem = String(opts.sourceSystem || (fid ? 'OFX_FID_' + fid : '') || org || 'OFX_FILE').trim();
  var institution = String(opts.institution || org || '').trim();
  var observedAt = financialFactIso_(opts.observedAt || new Date(), 'observedAt');
  var blocks = cashImportOfxAggregates_(body, 'CCSTMTRS');
  if (!blocks.length) throw new Error('No credit-card statement account was found in the OFX/QFX file.');
  var records = blocks.map(function(block, index) {
    var accountBlock = cashImportOfxAggregate_(block, 'CCACCTFROM');
    var externalId = cashImportOfxTag_(accountBlock, 'ACCTID');
    if (!externalId) throw new Error('Credit-card account ' + (index + 1) + ' has no source account identifier.');
    var currency = cashImportOfxTag_(block, 'CURDEF').toUpperCase() || 'USD';
    var ledger = cashImportOfxAggregate_(block, 'LEDGERBAL');
    var balance = cashImportStrictNumber_(cashImportOfxTag_(ledger, 'BALAMT'));
    if (balance === null) throw new Error('Credit-card account ' + (index + 1) +
      ' has no authoritative ledger balance. Transaction rows are not a balance.');
    var balanceAsOf = cashImportOfxDate_(cashImportOfxTag_(ledger, 'DTASOF'));
    var statementAsOf = balanceAsOf || cashImportOfxDate_(cashImportOfxTag_(block, 'DTEND'));
    var facts = [debtImportNumericFact_('CURRENT_BALANCE', balance, currency, balanceAsOf)];
    debtImportPushNumericTagFact_(facts, block, 'MINPMTDUE', 'MINIMUM_PAYMENT', currency, statementAsOf);
    debtImportPushNumericTagFact_(facts, block, 'NEXTPMTAMT', 'NEXT_PAYMENT_AMOUNT', currency, statementAsOf);
    debtImportPushDateTagFact_(facts, block, 'DTPMTDUE', 'NEXT_PAYMENT_DATE', statementAsOf);
    debtImportPushNumericTagFact_(facts, block, 'CREDITLIMIT', 'CREDIT_LIMIT', currency, statementAsOf);
    debtImportPushNumericTagFact_(facts, block, 'AVAILCREDIT', 'AVAILABLE_CREDIT', currency, statementAsOf);
    var rateFacts = debtImportOfxRateFacts_(block, statementAsOf,
      !!opts.planningAprApplicableToCarriedBalance);
    facts = facts.concat(rateFacts.facts);
    debtImportPushDateTagFact_(facts, block, 'PROMOEXPDATE', 'PROMOTIONAL_APR_EXPIRATION', statementAsOf);
    var deferred = String(cashImportOfxTag_(block, 'DEFERREDINTEREST') || '').trim().toUpperCase();
    if (deferred) facts.push({ factType: 'DEFERRED_INTEREST_STATUS', textValue: deferred,
      currencyOrUnit: 'STATUS', effectiveAsOf: statementAsOf });
    debtImportPushDateTagFact_(facts, block, 'DEFERREDEXPDATE', 'DEFERRED_INTEREST_EXPIRATION', statementAsOf);
    return normalizeDebtEvidenceRecord_({
      sourceSystem: sourceSystem, sourceType: 'FILE_IMPORT', externalAccountId: externalId,
      last4: String(externalId).replace(/[^A-Za-z0-9]/g, '').slice(-4),
      institution: institution, displayName: String(opts.displayName || institution ||
        'Imported revolving account').trim(), accountType: 'CREDIT_CARD', currency: currency,
      ownerId: opts.ownerId || 'UNKNOWN_REVIEW_REQUIRED',
      registrationType: opts.registrationType || 'UNKNOWN', observedAt: observedAt,
      sourceRecordKey: cashImportDigest_([sourceSystem, externalId, statementAsOf,
        JSON.stringify(facts)].join('\n')), facts: facts,
      aprReviewStatus: rateFacts.reviewStatus,
      importEvidence: { adapterId: 'OFX_QFX_REVOLVING_DEBT',
        adapterVersion: DEBT_IMPORT_OFX_ADAPTER_VERSION_ }
    });
  });
  return debtImportAdapterOutput_('OFX_QFX_REVOLVING_DEBT',
    DEBT_IMPORT_OFX_ADAPTER_VERSION_, 'FILE_IMPORT', sourceSystem, observedAt, records);
}

/** Source-neutral structured snapshot seam for reviewed CSV/export mappings. */
function adaptStructuredDebtEvidence_(raw, options) {
  var opts = options || {};
  if (!raw || !Array.isArray(raw.accounts) || !raw.accounts.length) {
    throw new Error('Structured debt evidence requires at least one account.');
  }
  var observedAt = financialFactIso_(raw.observedAt || opts.observedAt || new Date(), 'observedAt');
  var sourceSystem = String(raw.sourceSystem || opts.sourceSystem || '').trim();
  if (!sourceSystem) throw new Error('Structured debt evidence requires sourceSystem.');
  var records = raw.accounts.map(function(account) {
    var effective = financialFactIso_(account.effectiveAsOf || raw.effectiveAsOf, 'effectiveAsOf');
    var currency = String(account.currency || 'USD').trim().toUpperCase();
    var facts = [];
    debtImportAddStructuredNumeric_(facts, account, 'currentBalance', 'CURRENT_BALANCE', currency, effective);
    debtImportAddStructuredNumeric_(facts, account, 'minimumPayment', 'MINIMUM_PAYMENT', currency, effective);
    debtImportAddStructuredNumeric_(facts, account, 'nextPaymentAmount', 'NEXT_PAYMENT_AMOUNT', currency, effective);
    debtImportAddStructuredDate_(facts, account, 'nextPaymentDate', 'NEXT_PAYMENT_DATE', effective);
    debtImportAddStructuredNumeric_(facts, account, 'creditLimit', 'CREDIT_LIMIT', currency, effective);
    debtImportAddStructuredNumeric_(facts, account, 'availableCredit', 'AVAILABLE_CREDIT', currency, effective);
    var rateResult = debtImportStructuredRateFacts_(account.rates || [], effective);
    facts = facts.concat(rateResult.facts);
    if (account.promotionalExpiration) facts.push(debtImportDateFact_(
      'PROMOTIONAL_APR_EXPIRATION', account.promotionalExpiration, effective));
    if (account.deferredInterestStatus) facts.push({ factType: 'DEFERRED_INTEREST_STATUS',
      textValue: String(account.deferredInterestStatus).trim().toUpperCase(),
      currencyOrUnit: 'STATUS', effectiveAsOf: effective });
    if (account.deferredInterestExpiration) facts.push(debtImportDateFact_(
      'DEFERRED_INTEREST_EXPIRATION', account.deferredInterestExpiration, effective));
    return normalizeDebtEvidenceRecord_({ sourceSystem: sourceSystem,
      sourceType: String(raw.sourceType || 'FILE_IMPORT').toUpperCase(),
      externalAccountId: String(account.externalAccountId || ''), last4: account.last4,
      institution: account.institution || raw.institution || '', displayName: account.displayName,
      accountType: account.accountType || 'CREDIT_CARD', currency: currency,
      ownerId: account.ownerId || 'UNKNOWN_REVIEW_REQUIRED',
      registrationType: account.registrationType || 'UNKNOWN', observedAt: observedAt,
      sourceRecordKey: cashImportDigest_([sourceSystem, account.externalAccountId,
        effective, JSON.stringify(facts)].join('\n')), facts: facts,
      aprReviewStatus: rateResult.reviewStatus,
      importEvidence: { adapterId: 'STRUCTURED_DEBT_SNAPSHOT',
        adapterVersion: DEBT_IMPORT_STRUCTURED_ADAPTER_VERSION_ } });
  });
  return debtImportAdapterOutput_('STRUCTURED_DEBT_SNAPSHOT',
    DEBT_IMPORT_STRUCTURED_ADAPTER_VERSION_, String(raw.sourceType || 'FILE_IMPORT').toUpperCase(),
    sourceSystem, observedAt, records);
}

/** Explicit verified-manual supplement. Every supplied fact keeps manual provenance. */
function adaptVerifiedManualDebtEvidence_(raw, options) {
  var input = raw || {};
  var opts = options || {};
  var stableId = String(input.stableAccountId || '').trim();
  if (!/^DEBT-[A-Za-z0-9-]+$/.test(stableId)) {
    throw new Error('Verified manual debt evidence requires a protected DEBT account ID.');
  }
  var effective = financialFactIso_(input.effectiveAsOf, 'effectiveAsOf');
  if (!effective) throw new Error('Verified manual debt evidence requires an effective date.');
  var observedAt = financialFactIso_(opts.observedAt || new Date(), 'observedAt');
  var currency = String(input.currency || 'USD').trim().toUpperCase();
  var facts = [];
  debtImportAddStructuredNumeric_(facts, input, 'currentBalance', 'CURRENT_BALANCE', currency, effective);
  debtImportAddStructuredNumeric_(facts, input, 'apr', 'APR',
    String(input.rateType || 'PERCENT').trim().toUpperCase(), effective);
  debtImportAddStructuredNumeric_(facts, input, 'minimumPayment', 'MINIMUM_PAYMENT', currency, effective);
  debtImportAddStructuredNumeric_(facts, input, 'nextPaymentAmount', 'NEXT_PAYMENT_AMOUNT', currency, effective);
  debtImportAddStructuredDate_(facts, input, 'nextPaymentDate', 'NEXT_PAYMENT_DATE', effective);
  debtImportAddStructuredNumeric_(facts, input, 'creditLimit', 'CREDIT_LIMIT', currency, effective);
  debtImportAddStructuredNumeric_(facts, input, 'availableCredit', 'AVAILABLE_CREDIT', currency, effective);
  if (!facts.length) throw new Error('Verified manual debt evidence requires at least one supported fact.');
  var record = normalizeDebtEvidenceRecord_({ sourceSystem: 'USER_VERIFIED_MANUAL',
    sourceType: 'MANUAL', externalAccountId: stableId,
    maskedIdentifier: 'Verified CashCompass debt account',
    institution: String(input.institution || '').trim(),
    displayName: String(input.displayName || stableId).trim(), accountType: 'CREDIT_CARD',
    currency: currency, ownerId: input.ownerId || 'UNKNOWN_REVIEW_REQUIRED',
    registrationType: input.registrationType || 'UNKNOWN', stableAccountId: stableId,
    observedAt: observedAt, sourceRecordKey: cashImportDigest_([stableId, effective,
      observedAt, JSON.stringify(facts)].join('\n')), facts: facts,
    importEvidence: { adapterId: 'USER_VERIFIED_MANUAL_DEBT',
      adapterVersion: DEBT_IMPORT_MANUAL_ADAPTER_VERSION_ } });
  return debtImportAdapterOutput_('USER_VERIFIED_MANUAL_DEBT',
    DEBT_IMPORT_MANUAL_ADAPTER_VERSION_, 'MANUAL', 'USER_VERIFIED_MANUAL', observedAt, [record]);
}

function debtImportAdapterOutput_(adapterId, version, sourceType, sourceSystem, observedAt, records) {
  var sanitized = records.map(function(record) {
    return { sourceAccountKey: record.sourceAccountKey, sourceRecordKey: record.sourceRecordKey,
      facts: record.facts, aprReviewStatus: record.aprReviewStatus };
  });
  return { contractVersion: DEBT_IMPORT_CONTRACT_VERSION_, adapterId: adapterId,
    adapterVersion: version, sourceType: sourceType, sourceSystem: sourceSystem,
    observedAt: observedAt, evidenceFingerprint: cashImportDigest_(JSON.stringify(sanitized)),
    accounts: records };
}

function normalizeDebtEvidenceRecord_(raw) {
  if (!raw || typeof raw !== 'object') throw new Error('Debt evidence record is required.');
  var sourceSystem = String(raw.sourceSystem || '').trim();
  var external = String(raw.externalAccountId || '').trim();
  var protectedKey = String(raw.sourceAccountKey || '').trim().toLowerCase();
  if (!sourceSystem || (!external && !protectedKey)) {
    throw new Error('Debt evidence requires sourceSystem and a source account identity.');
  }
  if (!protectedKey) protectedKey = financialIdentitySourceAccountKey_(sourceSystem, external);
  if (!/^sha256:[a-f0-9]{64}$/.test(protectedKey)) {
    throw new Error('Debt source account key must be protected.');
  }
  var observedAt = financialFactIso_(raw.observedAt, 'observedAt');
  var facts = (raw.facts || []).filter(Boolean).map(function(fact) {
    var type = String(fact.factType || '').trim().toUpperCase();
    if (!DEBT_IMPORT_FACT_TYPES_[type]) throw new Error('Unsupported debt fact type: ' + type);
    return { factType: type,
      numericValue: fact.numericValue === null || typeof fact.numericValue === 'undefined' ? '' : fact.numericValue,
      textValue: String(fact.textValue || '').trim(),
      currencyOrUnit: String(fact.currencyOrUnit || '').trim().toUpperCase(),
      effectiveAsOf: financialFactIso_(fact.effectiveAsOf, 'effectiveAsOf') };
  });
  if (String(raw.sourceType || '').trim().toUpperCase() !== 'MANUAL' &&
      !facts.some(function(fact) { return fact.factType === 'CURRENT_BALANCE'; })) {
    throw new Error('Authoritative debt evidence requires CURRENT_BALANCE.');
  }
  return { sourceSystem: sourceSystem, sourceType: String(raw.sourceType || '').trim().toUpperCase(),
    sourceAccountKey: protectedKey,
    maskedIdentifier: String(raw.maskedIdentifier ||
      financialIdentityMaskIdentifier_(external, raw.last4)).trim(),
    institution: String(raw.institution || '').trim(), displayName: String(raw.displayName || '').trim(),
    accountType: String(raw.accountType || 'CREDIT_CARD').trim(),
    currency: String(raw.currency || 'USD').trim().toUpperCase(),
    ownerId: financialIdentityNormalizeOwnerId_(raw.ownerId),
    registrationType: financialIdentityNormalizeRegistrationType_(raw.registrationType),
    stableAccountId: String(raw.stableAccountId || '').trim(), observedAt: observedAt,
    sourceRecordKey: cashImportProtectedKey_(raw.sourceRecordKey || JSON.stringify(facts)),
    facts: facts, aprReviewStatus: String(raw.aprReviewStatus || '').trim().toUpperCase(),
    importEvidence: raw.importEvidence || {} };
}

function debtImportNormalizeAdapterOutput_(raw) {
  if (!raw || raw.contractVersion !== DEBT_IMPORT_CONTRACT_VERSION_ ||
      !Array.isArray(raw.accounts) || !raw.accounts.length) {
    throw new Error('Normalized debt adapter output requires DEBT_EVIDENCE_V1 accounts.');
  }
  return { contractVersion: raw.contractVersion, adapterId: String(raw.adapterId || '').trim(),
    adapterVersion: String(raw.adapterVersion || '').trim(),
    sourceType: String(raw.sourceType || '').trim().toUpperCase(),
    sourceSystem: String(raw.sourceSystem || '').trim(),
    observedAt: financialFactIso_(raw.observedAt, 'observedAt'),
    evidenceFingerprint: cashImportProtectedKey_(raw.evidenceFingerprint),
    accounts: raw.accounts.map(normalizeDebtEvidenceRecord_) };
}

function previewAuthoritativeDebtImport_(ss, adapterOutput, decisions, asOf) {
  var normalized = debtImportNormalizeAdapterOutput_(adapterOutput);
  var registry = financialIdentityReadRegistry_(ss);
  var links = cashImportReadSourceLinks_(ss);
  var facts = readFinancialFacts_(ss);
  var factIndex = indexFinancialFacts_(facts);
  var legacyIndex = debtImportLegacyIndex_(ss, registry.accounts);
  var decisionMap = decisions || {};
  var comparisonAt = financialFactIso_(asOf || new Date(), 'asOf');
  var rows = normalized.accounts.map(function(record) {
    var decision = decisionMap[record.sourceAccountKey] || {};
    var match = debtImportMatchRecord_(record, registry.accounts, links, decision);
    var stableId = match.stableAccountId || '';
    var action = debtImportPreviewAction_(match, decision, record);
    var comparisons = {};
    DEBT_IMPORT_CORE_SHADOW_FACT_TYPES_.concat(['NEXT_PAYMENT_AMOUNT', 'CREDIT_LIMIT',
      'AVAILABLE_CREDIT']).forEach(function(type) {
      comparisons[type] = debtImportPreviewFact_(record, stableId, type, factIndex,
        legacyIndex[stableId] || {}, comparisonAt, normalized.sourceType === 'MANUAL');
    });
    var diagnostics = debtImportRecordDiagnostics_(record, match, comparisons);
    var actionability = evaluateRevolvingDebtActionabilityFromComparisons_(comparisons,
      [], diagnostics);
    return { sourceAccountKey: record.sourceAccountKey, institution: record.institution,
      maskedIdentifier: record.maskedIdentifier, displayName: record.displayName,
      accountType: record.accountType, stableAccountId: stableId,
      matchedAccountName: cashImportAccountName_(registry.accounts, stableId),
      matchStatus: match.outcome, matchReason: match.reason || '',
      candidates: match.candidates || [], action: action, facts: comparisons,
      effectiveAsOf: debtImportRecordEffectiveRange_(record).end,
      diagnostics: diagnostics, safeToModel: actionability.safeToModel,
      safeToAct: actionability.safeToAct, actionability: actionability };
  });
  rows.sort(function(a, b) { return a.sourceAccountKey.localeCompare(b.sourceAccountKey); });
  var digestPayload = { contractVersion: normalized.contractVersion,
    evidenceFingerprint: normalized.evidenceFingerprint,
    accounts: rows.map(function(row) { return { sourceAccountKey: row.sourceAccountKey,
      stableAccountId: row.stableAccountId, action: row.action, matchStatus: row.matchStatus,
      facts: Object.keys(row.facts).sort().map(function(type) {
        var fact = row.facts[type].importedFact;
        return { factType: type, numericValue: fact ? fact.numericValue : null,
          textValue: fact ? fact.textValue : '', effectiveAsOf: fact ? fact.effectiveAsOf : '' };
      }) }; }) };
  return { ok: true, previewDigest: cashImportDigest_(JSON.stringify(digestPayload)),
    evidenceFingerprint: normalized.evidenceFingerprint, adapterId: normalized.adapterId,
    adapterVersion: normalized.adapterVersion, sourceType: normalized.sourceType,
    sourceSystem: normalized.sourceSystem, observedAt: normalized.observedAt,
    reconciliationPolicy: DEBT_IMPORT_RECONCILIATION_POLICY_V1_,
    materialityPolicy: DEBT_IMPORT_MATERIALITY_POLICY_V1_, accounts: rows,
    summary: cashImportPreviewSummary_(rows), dataQuality: debtImportPreviewQuality_(rows) };
}

function applyAuthoritativeDebtImport_(ss, adapterOutput, decisions, expectedDigest, asOf) {
  var preview = previewAuthoritativeDebtImport_(ss, adapterOutput, decisions, asOf);
  if (!expectedDigest || expectedDigest !== preview.previewDigest) {
    throw new Error('Debt import preview changed. Review the latest preview before applying.');
  }
  var normalized = debtImportNormalizeAdapterOutput_(adapterOutput);
  var prior = cashImportFindRun_(ss, preview.evidenceFingerprint, preview.previewDigest);
  if (prior) return { ok: true, status: 'DUPLICATE_NOOP', importRunId: prior.importRunId,
    appendedFacts: 0, duplicateFacts: 0, preview: preview };
  var registry = financialIdentityReadRegistry_(ss);
  var links = cashImportReadSourceLinks_(ss);
  var decisionMap = decisions || {};
  var now = financialFactIso_(new Date(), 'createdAt');
  var importRunId = 'IMPORT-' + cashImportDigest_([preview.evidenceFingerprint,
    preview.previewDigest].join('\n')).slice(7, 39);
  var rawFacts = [];
  var counts = { matched: 0, added: 0, ignored: 0, review: 0, conflict: 0 };
  normalized.accounts.forEach(function(record) {
    var decision = decisionMap[record.sourceAccountKey] || {};
    var match = debtImportMatchRecord_(record, registry.accounts, links, decision);
    var action = debtImportPreviewAction_(match, decision, record);
    if (action === 'IGNORE') { counts.ignored++; return; }
    if (action === 'REVIEW_REQUIRED') {
      if (match.outcome === 'CONFLICT') counts.conflict++; else counts.review++;
      return;
    }
    var stableId = match.stableAccountId || '';
    if (action === 'ADD') {
      stableId = debtImportCreateAccount_(ss, record, now);
      registry.accounts.push({ stableAccountId: stableId, domain: 'DEBT',
        displayName: record.displayName, institution: record.institution,
        accountType: record.accountType, ownerId: record.ownerId,
        registrationType: record.registrationType });
      cashImportCreateVerifiedLink_(ss, record, stableId, now, links);
      counts.added++;
    } else {
      if (!cashImportHasVerifiedLink_(links, record.sourceSystem, record.sourceAccountKey, stableId)) {
        cashImportCreateVerifiedLink_(ss, record, stableId, now, links);
      }
      counts.matched++;
    }
    record.facts.forEach(function(fact) {
      rawFacts.push(debtImportFinancialFact_(record, fact, stableId, importRunId,
        normalized.sourceType === 'MANUAL'));
    });
  });
  var append = appendFinancialFacts_(ss, rawFacts, { asOf: asOf || new Date(), defaultCreatedAt: now });
  var status = counts.review || counts.conflict ? 'PARTIAL_REVIEW_REQUIRED' : 'APPLIED';
  debtImportAppendRun_(ss, preview, normalized, importRunId, counts, append, status, now);
  SpreadsheetApp.flush();
  return { ok: true, status: status, importRunId: importRunId,
    appendedFacts: append.appended, duplicateFacts: append.duplicates,
    counts: counts, preview: preview };
}

function previewOfxDebtImportFromDashboard(payload) {
  var p = payload || {};
  return previewAuthoritativeDebtImport_(getUserSpreadsheet_(),
    adaptOfxRevolvingDebtEvidence_(p.rawFile, p.options || {}), p.decisions || {}, p.asOf || new Date());
}

function applyOfxDebtImportFromDashboard(payload) {
  var p = payload || {};
  return withScriptLock_(function() {
    return applyAuthoritativeDebtImport_(getUserSpreadsheet_(),
      adaptOfxRevolvingDebtEvidence_(p.rawFile, p.options || {}), p.decisions || {},
      String(p.previewDigest || '').trim(), p.asOf || new Date());
  }, { timeoutMs: 30000, context: 'apply authoritative revolving debt import' });
}

function previewVerifiedManualDebtImportFromDashboard(payload) {
  var p = payload || {};
  var adapter = adaptVerifiedManualDebtEvidence_(p.record || {}, p.options || {});
  var key = adapter.accounts[0].sourceAccountKey;
  var decisions = {}; decisions[key] = { action: 'MATCH',
    stableAccountId: String(p.record && p.record.stableAccountId || '').trim() };
  return previewAuthoritativeDebtImport_(getUserSpreadsheet_(), adapter, decisions, p.asOf || new Date());
}

function applyVerifiedManualDebtImportFromDashboard(payload) {
  var p = payload || {};
  return withScriptLock_(function() {
    var adapter = adaptVerifiedManualDebtEvidence_(p.record || {}, p.options || {});
    var key = adapter.accounts[0].sourceAccountKey;
    var decisions = {}; decisions[key] = { action: 'MATCH',
      stableAccountId: String(p.record && p.record.stableAccountId || '').trim() };
    return applyAuthoritativeDebtImport_(getUserSpreadsheet_(), adapter, decisions,
      String(p.previewDigest || '').trim(), p.asOf || new Date());
  }, { timeoutMs: 30000, context: 'apply verified manual revolving debt evidence' });
}

/** Rebuildable per-fact shadow report. It never writes and never feeds Planning. */
function getDebtImportShadowComparison_(ss, sourceAccountKeys, asOf) {
  var comparisonAt = financialFactIso_(asOf || new Date(), 'asOf');
  var registry = financialIdentityReadRegistry_(ss);
  var links = cashImportReadSourceLinks_(ss);
  var facts = readFinancialFacts_(ss);
  var factIndex = indexFinancialFacts_(facts);
  var legacyIndex = debtImportLegacyIndex_(ss, registry.accounts);
  var requested = {};
  (sourceAccountKeys || []).forEach(function(key) { requested[String(key || '').toLowerCase()] = true; });
  var seen = {};
  return links.filter(function(link) {
    if (String(link.linkStatus || '').toUpperCase() !== 'VERIFIED') return false;
    if (Object.keys(requested).length && !requested[String(link.sourceAccountKey || '').toLowerCase()]) return false;
    var account = debtImportFindAccount_(registry.accounts, link.stableAccountId);
    if (!account || String(account.domain || '').toUpperCase() !== 'DEBT' || seen[account.stableAccountId]) return false;
    seen[account.stableAccountId] = true;
    return true;
  }).map(function(link) {
    var account = debtImportFindAccount_(registry.accounts, link.stableAccountId);
    var legacy = legacyIndex[account.stableAccountId] || {};
    var comparisons = {};
    DEBT_IMPORT_CORE_SHADOW_FACT_TYPES_.forEach(function(type) {
      comparisons[type] = debtImportSelectedShadowFact_(factIndex, account.stableAccountId,
        type, legacy, comparisonAt);
    });
    var diagnostics = debtImportSelectedDiagnostics_(factIndex, account.stableAccountId,
      comparisons, comparisonAt);
    var quality = evaluateRevolvingDebtActionabilityFromComparisons_(comparisons, [], diagnostics);
    return { stableAccountId: account.stableAccountId, accountName: account.displayName,
      sourceSystem: link.sourceSystem, sourceAccountKey: link.sourceAccountKey,
      maskedIdentifier: link.maskedIdentifier, facts: comparisons,
      safeToModel: quality.safeToModel, safeToAct: quality.safeToAct,
      confidence: quality.confidence, diagnostics: quality.reasons };
  }).sort(function(a, b) { return a.stableAccountId.localeCompare(b.stableAccountId); });
}

function getDebtImportShadowComparisonFromDashboard(payload) {
  var p = payload || {};
  return getDebtImportShadowComparison_(getUserSpreadsheet_(), p.sourceAccountKeys || [], p.asOf || new Date());
}

/** First operational cash + revolving-debt milestone; shadow-only. */
function evaluateWeeklyPlanDataReadiness_(ss, asOf) {
  var comparisonAt = financialFactIso_(asOf || new Date(), 'asOf');
  var registry = financialIdentityReadRegistry_(ss);
  var facts = readFinancialFacts_(ss);
  var index = indexFinancialFacts_(facts);
  return evaluateWeeklyPlanDataReadinessFromState_(registry.accounts, index, comparisonAt);
}

/** Shared evaluator for callers that already bulk-read identity and facts. */
function evaluateWeeklyPlanDataReadinessFromState_(accounts, index, comparisonAt) {
  var cashAccounts = (accounts || []).filter(function(row) {
    return String(row.domain || '').toUpperCase() === 'CASH' && debtImportAccountActive_(row);
  });
  var debtAccounts = (accounts || []).filter(function(row) {
    return String(row.domain || '').toUpperCase() === 'DEBT' && debtImportAccountActive_(row) &&
      debtImportIsRevolvingType_(row.accountType);
  });
  var cash = debtImportReadinessDimension_(cashAccounts, index, 'CURRENT_BALANCE', comparisonAt,
    'CASH_BALANCE_DATA_REQUIRED');
  var balances = debtImportReadinessDimension_(debtAccounts, index, 'CURRENT_BALANCE', comparisonAt,
    'DEBT_BALANCE_DATA_REQUIRED');
  var positiveDebts = debtAccounts.filter(function(account) {
    var selected = selectCurrentFinancialFactFromIndex_(index, account.stableAccountId,
      'CURRENT_BALANCE', comparisonAt);
    return !selected.fact || Number(selected.fact.numericValue || 0) > 0;
  });
  var interestRanking = debtImportCompositeReadiness_(positiveDebts, index,
    ['CURRENT_BALANCE', 'APR'], comparisonAt,
    { CURRENT_BALANCE: 'DEBT_BALANCE_DATA_REQUIRED', APR: 'APR_DATA_REQUIRED' });
  var paymentObligation = debtImportCompositeReadiness_(positiveDebts, index,
    ['CURRENT_BALANCE', 'MINIMUM_PAYMENT', 'NEXT_PAYMENT_DATE'], comparisonAt,
    { CURRENT_BALANCE: 'DEBT_BALANCE_DATA_REQUIRED',
      MINIMUM_PAYMENT: 'MINIMUM_PAYMENT_DATA_REQUIRED',
      NEXT_PAYMENT_DATE: 'NEXT_PAYMENT_DATE_DATA_REQUIRED' });
  var exactPayoff = debtImportCompositeReadiness_(positiveDebts, index,
    ['CURRENT_BALANCE', 'APR', 'MINIMUM_PAYMENT', 'NEXT_PAYMENT_DATE'], comparisonAt,
    { CURRENT_BALANCE: 'DEBT_BALANCE_DATA_REQUIRED', APR: 'APR_DATA_REQUIRED',
      MINIMUM_PAYMENT: 'MINIMUM_PAYMENT_DATA_REQUIRED',
      NEXT_PAYMENT_DATE: 'NEXT_PAYMENT_DATE_DATA_REQUIRED' });
  if (cash.status !== 'READY') {
    exactPayoff.status = exactPayoff.status === 'READY' ? 'NOT_READY' : exactPayoff.status;
    exactPayoff.reasons = exactPayoff.reasons.concat(['CASH_DATA_REQUIRED']);
  }
  if (!cashAccounts.length) {
    cash = debtImportNotConnectedDimension_('CASH_DATA_NOT_CONNECTED');
    if (debtAccounts.length) {
      exactPayoff.status = 'NOT_READY';
      exactPayoff.reasons = financialFactUnique_(exactPayoff.reasons.concat(['CASH_DATA_REQUIRED']));
    }
  }
  if (!debtAccounts.length) {
    balances = debtImportNotConnectedDimension_('DEBT_DATA_NOT_CONNECTED');
    interestRanking = debtImportNotConnectedDimension_('DEBT_DATA_NOT_CONNECTED');
    paymentObligation = debtImportNotConnectedDimension_('DEBT_DATA_NOT_CONNECTED');
    exactPayoff = debtImportNotConnectedDimension_('DEBT_DATA_NOT_CONNECTED');
  }
  var dimensions = { cash: cash, balanceReadiness: balances,
    interestRankingReadiness: interestRanking,
    paymentObligationReadiness: paymentObligation,
    exactPayoffReadiness: exactPayoff };
  var ready = Object.keys(dimensions).every(function(key) { return dimensions[key].status === 'READY'; });
  var reasons = [];
  Object.keys(dimensions).forEach(function(key) {
    dimensions[key].reasons.forEach(function(reason) { reasons.push(key + ':' + reason); });
  });
  return { evaluation: 'WEEKLY_PLAN_DATA_READINESS', asOf: comparisonAt,
    scope: 'CURRENT_CASH_AND_REVOLVING_DEBT_ONLY', dimensions: dimensions,
    overall: ready ? 'READY_FOR_AUTHORITY_SWITCH_REVIEW' : 'NOT_READY_FOR_AUTHORITY_SWITCH',
    authoritySwitched: false, reasons: financialFactUnique_(reasons) };
}

function debtImportNotConnectedDimension_(reason) {
  return { status: 'NOT_CONNECTED', readyCount: 0, accountCount: 0,
    reasons: [reason] };
}

function getWeeklyPlanDataReadinessFromDashboard(payload) {
  var p = payload || {};
  return evaluateWeeklyPlanDataReadiness_(getUserSpreadsheet_(), p.asOf || new Date());
}

function evaluateRevolvingDebtActionabilityFromComparisons_(comparisons, cashSelections, diagnostics) {
  var requiredModel = ['CURRENT_BALANCE', 'APR', 'MINIMUM_PAYMENT'];
  var requiredAct = requiredModel.concat(['NEXT_PAYMENT_DATE']);
  var reasons = (diagnostics || []).slice();
  var safeToModel = requiredModel.every(function(type) {
    var row = comparisons[type];
    if (!row || !row.selection || !row.selection.fact) {
      reasons.push(debtImportRequiredCode_(type)); return false;
    }
    if (!row.selection.freshness.safeToModel) reasons.push(type + ':' + row.selection.freshness.status);
    return row.selection.freshness.safeToModel;
  });
  var safeToAct = safeToModel && requiredAct.every(function(type) {
    var row = comparisons[type];
    if (!row || !row.selection || !row.selection.fact) {
      reasons.push(debtImportRequiredCode_(type)); return false;
    }
    if (!row.selection.freshness.safeToAct) reasons.push(type + ':' + row.selection.freshness.status);
    return row.selection.freshness.safeToAct;
  });
  if ((cashSelections || []).length) {
    cashSelections.forEach(function(selection) {
      if (!selection || !selection.fact || !selection.freshness.safeToAct) {
        safeToAct = false; reasons.push('CASH_DATA_REQUIRED');
      }
    });
  }
  if (reasons.indexOf('MULTIPLE_APR_REVIEW_REQUIRED') !== -1 ||
      reasons.indexOf('DEFERRED_INTEREST_REVIEW_REQUIRED') !== -1) {
    safeToAct = false;
  }
  var balanceReady = !!(comparisons.CURRENT_BALANCE && comparisons.CURRENT_BALANCE.selection &&
    comparisons.CURRENT_BALANCE.selection.fact &&
    comparisons.CURRENT_BALANCE.selection.freshness.safeToModel);
  var interestReady = balanceReady && !!(comparisons.APR && comparisons.APR.selection &&
    comparisons.APR.selection.fact && comparisons.APR.selection.freshness.safeToModel);
  var paymentReady = balanceReady && !!(comparisons.MINIMUM_PAYMENT &&
    comparisons.MINIMUM_PAYMENT.selection && comparisons.MINIMUM_PAYMENT.selection.fact &&
    comparisons.MINIMUM_PAYMENT.selection.freshness.safeToModel) &&
    !!(comparisons.NEXT_PAYMENT_DATE && comparisons.NEXT_PAYMENT_DATE.selection &&
      comparisons.NEXT_PAYMENT_DATE.selection.fact &&
      comparisons.NEXT_PAYMENT_DATE.selection.freshness.safeToModel);
  var zeroBalance = balanceReady && Number(comparisons.CURRENT_BALANCE.selection.fact.numericValue || 0) === 0;
  return { decisionType: 'PAY_DEBT', safeToModel: safeToModel,
    safeToAct: safeToAct, confidence: safeToAct ? 'HIGH' : safeToModel ? 'MEDIUM' : 'LOW',
    reasons: financialFactUnique_(reasons),
    balanceReadiness: balanceReady ? 'READY' : 'NOT_READY',
    interestRankingReadiness: interestReady ? 'READY' : 'NOT_READY',
    paymentObligationReadiness: paymentReady ? 'READY' : 'NOT_READY',
    exactPayoffReadiness: safeToAct ? 'READY' : 'NOT_READY',
    exactPayoffActionable: safeToAct,
    zeroBalanceShadowOnly: zeroBalance };
}

function debtImportPreviewFact_(record, stableId, type, factIndex, legacy, asOf, manual) {
  var imported = record.facts.filter(function(fact) { return fact.factType === type; })[0] || null;
  var selected = stableId ? selectCurrentFinancialFactFromIndex_(factIndex, stableId, type, asOf) : null;
  var prospective = null;
  if (stableId && imported) {
    var candidate = normalizeFinancialFact_(debtImportFinancialFact_(record, imported, stableId,
      'PREVIEW', manual), { asOf: asOf, defaultCreatedAt: record.observedAt });
    var key = stableId + '\n' + type;
    prospective = selectCurrentFinancialFact_((factIndex.factsByKey[key] || []).concat([candidate]),
      stableId, type, asOf);
  }
  var legacyValue = debtImportLegacyValue_(legacy, type);
  var importedValue = debtImportFactValue_(imported);
  var reconciliation = debtImportReconcileFact_(type, legacyValue, importedValue);
  return { factType: type, importedFact: imported, importedValue: importedValue,
    legacyValue: legacyValue, currentSelection: selected,
    selection: prospective || selected || { fact: null,
      freshness: evaluateFinancialFactFreshness_(null, asOf), confidence: 'LOW' },
    difference: reconciliation.difference, reconciliationStatus: reconciliation.exactStatus,
    materialityStatus: reconciliation.materialityStatus };
}

function debtImportSelectedShadowFact_(factIndex, stableId, type, legacy, asOf) {
  var selection = selectCurrentFinancialFactFromIndex_(factIndex, stableId, type, asOf);
  var normalized = selection.fact ? debtImportFactValue_(selection.fact) : null;
  var legacyValue = debtImportLegacyValue_(legacy, type);
  var reconciliation = debtImportReconcileFact_(type, legacyValue, normalized);
  return { factType: type, legacyValue: legacyValue, legacyAuthority: 'INPUT - Debts',
    normalizedValue: normalized, normalizedAuthority: selection.fact ? selection.fact.authorityClass : '',
    difference: reconciliation.difference, reconciliationStatus: reconciliation.exactStatus,
    materialityStatus: reconciliation.materialityStatus,
    effectiveAsOf: selection.fact ? selection.fact.effectiveAsOf : '',
    freshness: selection.freshness.status, safeToModel: selection.freshness.safeToModel,
    safeToAct: selection.freshness.safeToAct, selection: selection };
}

function debtImportSelectedDiagnostics_(index, stableId, comparisons, asOf) {
  var out = [];
  if (!comparisons.APR.selection.fact) {
    var components = ['DISCLOSED_APR', 'PURCHASE_APR', 'CASH_ADVANCE_APR',
      'BALANCE_TRANSFER_APR', 'PROMOTIONAL_APR']
      .filter(function(type) { return !!selectCurrentFinancialFactFromIndex_(index, stableId, type, asOf).fact; });
    out.push(components.length > 1 ? 'MULTIPLE_APR_REVIEW_REQUIRED' : 'APR_DATA_REQUIRED');
  }
  if (!comparisons.MINIMUM_PAYMENT.selection.fact) out.push('MINIMUM_PAYMENT_DATA_REQUIRED');
  if (!comparisons.NEXT_PAYMENT_DATE.selection.fact) out.push('NEXT_PAYMENT_DATE_DATA_REQUIRED');
  var deferred = selectCurrentFinancialFactFromIndex_(index, stableId,
    'DEFERRED_INTEREST_STATUS', asOf);
  if (deferred.fact && String(deferred.fact.textValue || '').toUpperCase() === 'ACTIVE') {
    out.push('DEFERRED_INTEREST_REVIEW_REQUIRED');
  }
  return out;
}

function debtImportRecordDiagnostics_(record, match, comparisons) {
  var out = [];
  var balance = comparisons.CURRENT_BALANCE && comparisons.CURRENT_BALANCE.importedFact;
  if (!balance || !balance.effectiveAsOf) out.push('BALANCE_EFFECTIVE_DATE_REQUIRED');
  if (record.aprReviewStatus) out.push(record.aprReviewStatus);
  if (!comparisons.APR.importedFact && !record.aprReviewStatus) {
    out.push('APR_DATA_REQUIRED');
  }
  if (!comparisons.MINIMUM_PAYMENT.importedFact) out.push('MINIMUM_PAYMENT_DATA_REQUIRED');
  if (!comparisons.NEXT_PAYMENT_DATE.importedFact) out.push('NEXT_PAYMENT_DATE_DATA_REQUIRED');
  if (record.facts.some(function(fact) {
    return fact.factType === 'DEFERRED_INTEREST_STATUS' &&
      String(fact.textValue || '').toUpperCase() === 'ACTIVE';
  })) out.push('DEFERRED_INTEREST_REVIEW_REQUIRED');
  if (match.outcome === 'CONFLICT') out.push(match.reason || 'IDENTITY_CONFLICT');
  if (['AMBIGUOUS', 'REVIEW_CANDIDATE', 'NO_MATCH'].indexOf(match.outcome) !== -1) {
    out.push('IDENTITY_REVIEW_REQUIRED');
  }
  return financialFactUnique_(out);
}

function debtImportMatchRecord_(record, accounts, links, decision) {
  if (record.stableAccountId) return debtImportValidateExplicitMatch_(record,
    record.stableAccountId, accounts);
  var exact = (links || []).filter(function(link) {
    return String(link.sourceSystem || '').toLowerCase() === record.sourceSystem.toLowerCase() &&
      String(link.sourceAccountKey || '').toLowerCase() === record.sourceAccountKey &&
      String(link.linkStatus || '').toUpperCase() === 'VERIFIED';
  });
  if (exact.length > 1) return { outcome: 'AMBIGUOUS', candidates: [] };
  if (exact.length === 1) {
    var verified = debtImportValidateExplicitMatch_(record, exact[0].stableAccountId, accounts, true);
    if (verified.outcome === 'EXPLICIT_MATCH') verified.outcome = 'EXACT_LINK';
    return verified;
  }
  if (decision && String(decision.action || '').toUpperCase() === 'MATCH') {
    return debtImportValidateExplicitMatch_(record, decision.stableAccountId, accounts);
  }
  return matchFinancialIdentityAdapterRecord_({ sourceType: record.sourceType,
    sourceSystem: record.sourceSystem, externalAccountId: record.sourceAccountKey,
    last4: String(record.maskedIdentifier || '').replace(/\D/g, '').slice(-4),
    institution: record.institution, displayName: record.displayName, domain: 'DEBT',
    accountType: record.accountType, ownerId: record.ownerId,
    registrationType: record.registrationType, currency: record.currency }, accounts, []);
}

function debtImportValidateExplicitMatch_(record, stableId, accounts, verifiedLink) {
  var account = debtImportFindAccount_(accounts, stableId);
  if (!account) return { outcome: 'CONFLICT', reason: 'MATCH_TARGET_MISSING', candidates: [] };
  if (String(account.domain || '').toUpperCase() !== 'DEBT') {
    return { outcome: 'CONFLICT', reason: 'DOMAIN_MISMATCH', candidates: [account.stableAccountId] };
  }
  var incomingOwner = financialIdentityNormalizeOwnerId_(record.ownerId);
  var targetOwner = financialIdentityNormalizeOwnerId_(account.ownerId);
  if (incomingOwner !== 'UNKNOWN_REVIEW_REQUIRED' && targetOwner !== 'UNKNOWN_REVIEW_REQUIRED' &&
      incomingOwner !== targetOwner) {
    return { outcome: 'CONFLICT', reason: 'OWNER_MISMATCH', candidates: [account.stableAccountId] };
  }
  var incomingRegistration = financialIdentityNormalizeRegistrationType_(record.registrationType);
  var targetRegistration = financialIdentityNormalizeRegistrationType_(account.registrationType);
  if (incomingRegistration !== 'UNKNOWN' && targetRegistration !== 'UNKNOWN' &&
      incomingRegistration !== targetRegistration) {
    return { outcome: 'CONFLICT', reason: 'REGISTRATION_MISMATCH', candidates: [account.stableAccountId] };
  }
  return { outcome: verifiedLink ? 'EXACT_LINK' : 'EXPLICIT_MATCH',
    stableAccountId: account.stableAccountId, candidates: [] };
}

function debtImportPreviewAction_(match, decision, record) {
  var requested = String(decision && decision.action || '').trim().toUpperCase();
  if (requested === 'IGNORE') return 'IGNORE';
  if (match.outcome === 'EXACT_LINK' || match.outcome === 'EXPLICIT_MATCH') return 'MATCH';
  if (requested === 'ADD' && match.outcome === 'NO_MATCH' && record &&
      record.ownerId !== 'UNKNOWN_REVIEW_REQUIRED' && record.registrationType !== 'UNKNOWN') return 'ADD';
  return 'REVIEW_REQUIRED';
}

function debtImportCreateAccount_(ss, record, now) {
  if (record.ownerId === 'UNKNOWN_REVIEW_REQUIRED' || record.registrationType === 'UNKNOWN') {
    throw new Error('Owner and registration must be confirmed before adding a debt account.');
  }
  var stableId = financialIdentityGenerateStableAccountId_('DEBT');
  ensureFinancialAccountsSheet_(ss).appendRow([stableId, 'DEBT', record.displayName,
    record.institution, record.accountType, 'REVOLVING', record.ownerId,
    record.registrationType, record.currency, '', 'Yes', 'VERIFIED', '', '', now, now]);
  return stableId;
}

function debtImportFinancialFact_(record, fact, stableId, importRunId, manual) {
  var hasEffective = !!fact.effectiveAsOf;
  return { stableInternalAccountId: stableId, factType: fact.factType,
    numericValue: fact.numericValue, textValue: fact.textValue,
    currencyOrUnit: fact.currencyOrUnit, effectiveAsOf: fact.effectiveAsOf,
    observedAt: record.observedAt, sourceType: manual ? 'MANUAL' : record.sourceType,
    sourceSystem: record.sourceSystem, importRunId: importRunId,
    sourceRecordKey: cashImportDigest_([record.sourceRecordKey, fact.factType,
      fact.numericValue, fact.textValue, fact.effectiveAsOf].join('\n')),
    authorityClass: manual ? 'USER_VERIFIED_MANUAL' :
      (hasEffective ? 'INSTITUTION_AUTHORITATIVE' : 'FILE_IMPORTED'),
    verificationStatus: hasEffective ? 'VERIFIED' : 'REVIEW_REQUIRED',
    verifiedAt: hasEffective ? record.observedAt : '', manualOverride: !!manual,
    reconciliationStatus: hasEffective ? 'MATCHED' : 'REVIEW_REQUIRED' };
}

function debtImportLegacyIndex_(ss, accounts) {
  var out = {};
  var sheet = ss.getSheetByName(getSheetNames_().DEBTS);
  if (!sheet || sheet.getLastRow() < 2) return out;
  var values = sheet.getDataRange().getValues();
  var display = sheet.getDataRange().getDisplayValues();
  var headers = display[0] || [];
  var cols = { name: headers.indexOf('Account Name'), balance: headers.indexOf('Account Balance'),
    apr: headers.indexOf('Int Rate'), minimum: headers.indexOf('Minimum Payment'),
    due: headers.indexOf('Due Date'), limit: headers.indexOf('Credit Limit'),
    available: headers.indexOf('Credit Left') };
  var byName = {};
  for (var r = 1; r < display.length; r++) {
    var name = cols.name === -1 ? '' : String(display[r][cols.name] || '').trim();
    if (!name || /^total debt$/i.test(name)) continue;
    byName[name] = { CURRENT_BALANCE: debtImportCellNumber_(values[r], cols.balance),
      APR: debtImportCellNumber_(values[r], cols.apr),
      MINIMUM_PAYMENT: debtImportCellNumber_(values[r], cols.minimum),
      NEXT_PAYMENT_DATE: cols.due === -1 ? null : String(display[r][cols.due] || '').trim(),
      CREDIT_LIMIT: debtImportCellNumber_(values[r], cols.limit),
      AVAILABLE_CREDIT: debtImportCellNumber_(values[r], cols.available) };
  }
  (accounts || []).forEach(function(account) {
    if (account.legacyDomain === 'INPUT_DEBTS' && account.legacyKey && byName[account.legacyKey]) {
      out[account.stableAccountId] = byName[account.legacyKey];
    }
  });
  return out;
}

function debtImportAppendRun_(ss, preview, normalized, importRunId, counts, append, status, now) {
  var ranges = normalized.accounts.map(debtImportRecordEffectiveRange_);
  var dates = [];
  ranges.forEach(function(range) { if (range.start) dates.push(range.start); if (range.end) dates.push(range.end); });
  dates.sort();
  ensureCashImportRunsSheet_(ss).appendRow([importRunId, preview.evidenceFingerprint,
    preview.previewDigest, preview.sourceType, preview.sourceSystem, preview.adapterId,
    preview.adapterVersion, preview.observedAt, dates[0] || '', dates[dates.length - 1] || '',
    preview.accounts.length, counts.matched, counts.added, counts.ignored, counts.review,
    counts.conflict, append.appended, append.duplicates, status, now]);
}

function debtImportPreviewQuality_(rows) {
  var diagnostics = [];
  (rows || []).forEach(function(row) {
    (row.diagnostics || []).forEach(function(code) {
      diagnostics.push({ sourceAccountKey: row.sourceAccountKey, code: code });
    });
  });
  return { safeToModel: rows.length > 0 && rows.every(function(row) { return row.safeToModel; }),
    safeToAct: rows.length > 0 && rows.every(function(row) { return row.safeToAct; }),
    diagnostics: diagnostics };
}

function debtImportReadinessDimension_(accounts, index, factType, asOf, missingCode) {
  var reasons = [];
  var ready = 0;
  (accounts || []).forEach(function(account) {
    var selection = selectCurrentFinancialFactFromIndex_(index, account.stableAccountId, factType, asOf);
    if (selection.fact && selection.freshness.safeToAct) ready++;
    else reasons.push(account.stableAccountId + ':' + (selection.fact
      ? factType + '_' + selection.freshness.status : missingCode));
  });
  var total = (accounts || []).length;
  return { status: total > 0 && ready === total ? 'READY' : ready > 0 ? 'PARTIAL' : 'NOT_READY',
    readyCount: ready, accountCount: total, reasons: reasons };
}

function debtImportCompositeReadiness_(accounts, index, factTypes, asOf, missingCodes) {
  var reasons = [];
  var ready = 0;
  (accounts || []).forEach(function(account) {
    var accountReady = true;
    (factTypes || []).forEach(function(type) {
      var selection = selectCurrentFinancialFactFromIndex_(index, account.stableAccountId, type, asOf);
      if (!selection.fact || !selection.freshness.safeToAct) {
        accountReady = false;
        reasons.push(account.stableAccountId + ':' + (selection.fact
          ? type + '_' + selection.freshness.status : missingCodes[type] || type + '_DATA_REQUIRED'));
      }
    });
    if (accountReady) ready++;
  });
  var total = (accounts || []).length;
  return { status: total === 0 || ready === total ? 'READY' : ready > 0 ? 'PARTIAL' : 'NOT_READY',
    readyCount: ready, accountCount: total, reasons: reasons };
}

function debtImportStructuredRateFacts_(rates, effective) {
  var facts = [];
  var planningCandidates = [];
  (rates || []).forEach(function(rate) {
    var type = String(rate.type || 'GENERAL').trim().toUpperCase();
    var value = cashImportStrictNumber_(rate.apr);
    if (value === null) return;
    var factType = { GENERAL: 'DISCLOSED_APR', PURCHASE: 'PURCHASE_APR', CASH_ADVANCE: 'CASH_ADVANCE_APR',
      BALANCE_TRANSFER: 'BALANCE_TRANSFER_APR', PROMOTIONAL: 'PROMOTIONAL_APR' }[type];
    if (!factType) return;
    var unit = String(rate.rateType || 'PERCENT').trim().toUpperCase();
    facts.push(debtImportNumericFact_(factType, value, unit, effective));
    if (rate.appliesToCarriedBalance === true) {
      planningCandidates.push({ type: type, value: value, unit: unit });
    }
  });
  var economicRates = facts.filter(function(fact) {
    return ['DISCLOSED_APR', 'PURCHASE_APR', 'CASH_ADVANCE_APR', 'BALANCE_TRANSFER_APR',
      'PROMOTIONAL_APR'].indexOf(fact.factType) !== -1;
  });
  var review = planningCandidates.length > 1 ||
    (planningCandidates.length === 0 && economicRates.length > 1) ?
      'MULTIPLE_APR_REVIEW_REQUIRED' :
    planningCandidates.length === 0 && economicRates.length > 0 ?
      'APR_APPLICABILITY_REVIEW_REQUIRED' : '';
  if (planningCandidates.length === 1) {
    facts.push(debtImportNumericFact_('APR', planningCandidates[0].value,
      planningCandidates[0].unit, effective));
  }
  if (planningCandidates.length !== 1) facts = facts.filter(function(fact) { return fact.factType !== 'APR'; });
  return { facts: facts, reviewStatus: review };
}

function debtImportOfxRateFacts_(block, effective, carriedBalanceApplicable) {
  var rates = [];
  [['APR', 'GENERAL'], ['PURCHASEAPR', 'PURCHASE'], ['CASHADVAPR', 'CASH_ADVANCE'],
    ['BALANCETRANSFERAPR', 'BALANCE_TRANSFER'], ['PROMOAPR', 'PROMOTIONAL']]
    .forEach(function(pair) {
      var value = cashImportStrictNumber_(cashImportOfxTag_(block, pair[0]));
      if (value !== null) rates.push({ type: pair[1], apr: value,
        appliesToCarriedBalance: carriedBalanceApplicable && pair[1] === 'GENERAL',
        rateType: String(cashImportOfxTag_(block, pair[0] + 'TYPE') || 'PERCENT').toUpperCase() });
    });
  return debtImportStructuredRateFacts_(rates, effective);
}

function debtImportReconcileFact_(type, legacy, normalized) {
  if (legacy === null || typeof legacy === 'undefined' || normalized === null ||
      typeof normalized === 'undefined' || normalized === '') {
    return { difference: null, exactStatus: 'UNAVAILABLE', materialityStatus: 'NOT_EVALUATED' };
  }
  if (type === 'NEXT_PAYMENT_DATE') {
    var legacyText = String(legacy || '').trim();
    var normalizedText = String(normalized || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(legacyText)) {
      return { difference: null, exactStatus: 'UNAVAILABLE',
        materialityStatus: DEBT_IMPORT_MATERIALITY_POLICY_V1_.status };
    }
    return { difference: legacyText === normalizedText ? 0 : null,
      exactStatus: legacyText === normalizedText ? 'EXACT_MATCH' : 'DIFFERENCE_DETECTED',
      materialityStatus: DEBT_IMPORT_MATERIALITY_POLICY_V1_.status };
  }
  var precision = type.indexOf('APR') !== -1 ? 10000 : 100;
  var difference = Math.round((Number(normalized) - Number(legacy)) * precision) / precision;
  return { difference: difference, exactStatus: difference === 0 ? 'EXACT_MATCH' : 'DIFFERENCE_DETECTED',
    materialityStatus: DEBT_IMPORT_MATERIALITY_POLICY_V1_.status };
}

function debtImportRequiredCode_(type) {
  return { CURRENT_BALANCE: 'DEBT_BALANCE_DATA_REQUIRED', APR: 'APR_DATA_REQUIRED',
    MINIMUM_PAYMENT: 'MINIMUM_PAYMENT_DATA_REQUIRED',
    NEXT_PAYMENT_DATE: 'NEXT_PAYMENT_DATE_DATA_REQUIRED' }[type] || type + '_DATA_REQUIRED';
}

function debtImportRecordEffectiveRange_(record) {
  var dates = (record.facts || []).map(function(fact) { return fact.effectiveAsOf; }).filter(Boolean).sort();
  return { start: dates[0] || '', end: dates[dates.length - 1] || '' };
}

function debtImportFindAccount_(accounts, stableId) {
  return (accounts || []).filter(function(row) {
    return row.stableAccountId === String(stableId || '').trim();
  })[0] || null;
}

function debtImportAccountActive_(row) {
  return ['no', 'n', 'false', 'inactive'].indexOf(String(row.active || '').trim().toLowerCase()) === -1;
}

function debtImportIsRevolvingType_(type) {
  return /credit card|credit_card|creditcard|charge card|revolving|line of credit/i.test(String(type || '')) &&
    !/mortgage|auto|student|property|heloc|margin/i.test(String(type || ''));
}

function debtImportCellNumber_(row, col) {
  if (col === -1) return null;
  var value = Number(row[col]);
  return isFinite(value) ? Math.round(value * 10000) / 10000 : null;
}

function debtImportLegacyValue_(legacy, type) {
  return Object.prototype.hasOwnProperty.call(legacy || {}, type) ? legacy[type] : null;
}

function debtImportFactValue_(fact) {
  if (!fact) return null;
  return fact.numericValue !== '' && fact.numericValue !== null &&
    typeof fact.numericValue !== 'undefined' ? Number(fact.numericValue) : String(fact.textValue || '');
}

function debtImportNumericFact_(type, value, unit, effective) {
  return { factType: type, numericValue: value, currencyOrUnit: unit,
    effectiveAsOf: financialFactIso_(effective, 'effectiveAsOf') };
}

function debtImportDateFact_(type, value, effective) {
  var canonical = financialFactCanonicalDateValue_(value);
  return { factType: type, textValue: canonical, currencyOrUnit: 'DATE',
    effectiveAsOf: financialFactIso_(effective, 'effectiveAsOf') };
}

function debtImportPushNumericTagFact_(facts, block, tag, type, unit, effective) {
  var value = cashImportStrictNumber_(cashImportOfxTag_(block, tag));
  if (value !== null) facts.push(debtImportNumericFact_(type, value, unit, effective));
}

function debtImportPushDateTagFact_(facts, block, tag, type, effective) {
  var raw = cashImportOfxTag_(block, tag);
  if (!raw) return;
  var iso = cashImportOfxDate_(raw);
  if (!iso) throw new Error(type + ' source date is invalid.');
  facts.push({ factType: type, textValue: iso.slice(0, 10), currencyOrUnit: 'DATE',
    effectiveAsOf: financialFactIso_(effective, 'effectiveAsOf') });
}

function debtImportAddStructuredNumeric_(facts, source, field, type, unit, effective) {
  if (!Object.prototype.hasOwnProperty.call(source || {}, field) || source[field] === '') return;
  var value = cashImportStrictNumber_(source[field]);
  if (value === null) throw new Error(field + ' must be numeric.');
  facts.push(debtImportNumericFact_(type, value, unit, effective));
}

function debtImportAddStructuredDate_(facts, source, field, type, effective) {
  if (!Object.prototype.hasOwnProperty.call(source || {}, field) || !source[field]) return;
  facts.push(debtImportDateFact_(type, source[field], effective));
}
