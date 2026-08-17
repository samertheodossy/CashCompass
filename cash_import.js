/**
 * Part 2A-3 authoritative cash evidence import.
 *
 * The adapter boundary is source-neutral. Raw files and raw account identifiers
 * are transient only. Apply appends identity links, facts, and a sanitized run
 * manifest; it never writes INPUT - Bank Accounts, SYS - Accounts policies, or
 * Planning output.
 */

var CASH_IMPORT_CONTRACT_VERSION_ = 'CASH_EVIDENCE_V1';
var CASH_IMPORT_OFX_ADAPTER_VERSION_ = 'OFX_QFX_CASH_V1';
var CASH_IMPORT_MANUAL_ADAPTER_VERSION_ = 'USER_VERIFIED_MANUAL_V1';
var CASH_IMPORT_RECONCILIATION_POLICY_V1_ = {
  policyId: 'CASH_SHADOW_EXACT_RECONCILIATION_V1',
  currencyMinorUnit: 0.01,
  explanation: 'Cash values are compared at currency-minor-unit precision; every non-zero difference remains visible.'
};
var CASH_IMPORT_MATERIALITY_POLICY_V1_ = {
  policyId: 'CASH_SHADOW_PLANNING_MATERIALITY_V1',
  status: 'NOT_YET_DECIDED',
  explanation: 'Planning materiality is intentionally deferred; no monetary difference is discarded.'
};

var CASH_IMPORT_RUN_HEADERS_ = [
  'Import Run Id', 'Evidence Fingerprint', 'Preview Digest', 'Source Type',
  'Source System', 'Adapter Id', 'Adapter Version', 'Observed At',
  'Source As Of Start', 'Source As Of End', 'Account Count', 'Matched Count',
  'Added Count', 'Ignored Count', 'Review Count', 'Conflict Count', 'Fact Count',
  'Duplicate Fact Count', 'Status', 'Created At'
];

function ensureCashImportRunsSheet_(optionalSs) {
  var ss = optionalSs || getUserSpreadsheet_();
  var name = getSheetNames_().IMPORT_RUNS;
  var existing = ss.getSheetByName(name);
  if (existing) {
    cashImportAssertHeaders_(existing, CASH_IMPORT_RUN_HEADERS_);
    return existing;
  }
  var sheet;
  try { sheet = ss.insertSheet(name); }
  catch (e) {
    sheet = ss.getSheetByName(name);
    if (!sheet) throw e;
    cashImportAssertHeaders_(sheet, CASH_IMPORT_RUN_HEADERS_);
    return sheet;
  }
  sheet.getRange(1, 1, 1, CASH_IMPORT_RUN_HEADERS_.length)
    .setValues([CASH_IMPORT_RUN_HEADERS_]);
  try {
    sheet.getRange(1, 1, 1, CASH_IMPORT_RUN_HEADERS_.length)
      .setFontWeight('bold').setBackground('#ffe599').setHorizontalAlignment('center');
    sheet.setFrozenRows(1);
  } catch (_formatErr) { /* presentation only */ }
  return sheet;
}

function cashImportAssertHeaders_(sheet, expected) {
  var headers = sheet.getRange(1, 1, 1, Math.max(1, sheet.getLastColumn()))
    .getDisplayValues()[0] || [];
  for (var i = 0; i < expected.length; i++) {
    if (String(headers[i] || '').trim() !== expected[i]) {
      throw new Error(sheet.getName() + ' column ' + (i + 1) +
        ' must be "' + expected[i] + '". No changes were made.');
    }
  }
}

/** Parse OFX 1.x SGML or OFX 2.x XML statement aggregates. */
function adaptOfxCashEvidence_(rawText, options) {
  var opts = options || {};
  var raw = String(rawText || '');
  if (!raw.trim()) throw new Error('OFX/QFX file is required.');
  if (raw.length > 5000000) throw new Error('OFX/QFX file is too large.');
  var ofxStart = raw.toUpperCase().indexOf('<OFX');
  if (ofxStart === -1) throw new Error('This is not a recognizable OFX/QFX file.');
  var body = raw.slice(ofxStart);
  var currency = cashImportOfxTag_(body, 'CURDEF').toUpperCase() || 'USD';
  var org = cashImportOfxTag_(body, 'ORG');
  var fid = cashImportOfxTag_(body, 'FID');
  var sourceSystem = String(opts.sourceSystem || (fid ? 'OFX_FID_' + fid : '') || org || 'OFX_FILE').trim();
  var institution = String(opts.institution || org || '').trim();
  var observedAt = financialFactIso_(opts.observedAt || new Date(), 'observedAt');
  var blocks = cashImportOfxAggregates_(body, 'STMTRS');
  if (!blocks.length) throw new Error('No bank statement account was found in the OFX/QFX file.');
  var records = [];
  blocks.forEach(function(block, index) {
    var accountBlock = cashImportOfxAggregate_(block, 'BANKACCTFROM');
    var externalId = cashImportOfxTag_(accountBlock, 'ACCTID');
    var type = cashImportOfxTag_(accountBlock, 'ACCTTYPE') || 'BANK';
    var ledger = cashImportOfxAggregate_(block, 'LEDGERBAL');
    var ledgerAmount = cashImportStrictNumber_(cashImportOfxTag_(ledger, 'BALAMT'));
    if (ledgerAmount === null) {
      throw new Error('Account ' + (index + 1) + ' has no authoritative ledger balance. Transaction rows are not a balance.');
    }
    var ledgerAsOf = cashImportOfxDate_(cashImportOfxTag_(ledger, 'DTASOF'));
    var available = cashImportOfxAggregate_(block, 'AVAILBAL');
    var availableAmount = cashImportStrictNumber_(cashImportOfxTag_(available, 'BALAMT'));
    var availableAsOf = cashImportOfxDate_(cashImportOfxTag_(available, 'DTASOF')) || ledgerAsOf;
    var explicitApy = cashImportStrictNumber_(cashImportOfxTag_(block, 'APY'));
    records.push(normalizeCashEvidenceRecord_({
      sourceSystem: sourceSystem,
      sourceType: 'FILE_IMPORT',
      externalAccountId: externalId,
      last4: String(externalId || '').replace(/[^A-Za-z0-9]/g, '').slice(-4),
      maskedIdentifier: financialIdentityMaskIdentifier_(externalId, ''),
      institution: institution,
      displayName: String(opts.displayName || institution || 'Imported cash account').trim(),
      accountType: type,
      currency: currency,
      ownerId: opts.ownerId || 'UNKNOWN_REVIEW_REQUIRED',
      registrationType: opts.registrationType || 'UNKNOWN',
      facts: [
        { factType: 'CURRENT_BALANCE', numericValue: ledgerAmount,
          currencyOrUnit: currency, effectiveAsOf: ledgerAsOf },
        availableAmount === null ? null :
          { factType: 'AVAILABLE_BALANCE', numericValue: availableAmount,
            currencyOrUnit: currency, effectiveAsOf: availableAsOf },
        explicitApy === null ? null :
          { factType: 'APY', numericValue: explicitApy,
            currencyOrUnit: 'PERCENT', effectiveAsOf: ledgerAsOf }
      ].filter(function(value) { return !!value; }),
      sourceAsOf: ledgerAsOf,
      observedAt: observedAt,
      sourceRecordKey: cashImportDigest_([
        sourceSystem, externalId, ledgerAmount, ledgerAsOf,
        availableAmount, availableAsOf, explicitApy
      ].join('\n')),
      importEvidence: { adapterId: 'OFX_QFX', adapterVersion: CASH_IMPORT_OFX_ADAPTER_VERSION_ }
    }));
  });
  return {
    contractVersion: CASH_IMPORT_CONTRACT_VERSION_,
    adapterId: 'OFX_QFX', adapterVersion: CASH_IMPORT_OFX_ADAPTER_VERSION_,
    sourceType: 'FILE_IMPORT', sourceSystem: sourceSystem, observedAt: observedAt,
    evidenceFingerprint: cashImportDigest_(body), accounts: records
  };
}

function adaptVerifiedManualCashEvidence_(raw, options) {
  var input = raw || {};
  var opts = options || {};
  if (!String(input.stableAccountId || '').trim()) {
    throw new Error('A verified CashCompass account is required for manual cash evidence.');
  }
  if (!String(input.effectiveAsOf || '').trim()) {
    throw new Error('Balance effective date is required for verified manual evidence.');
  }
  var amount = cashImportStrictNumber_(input.currentBalance);
  if (amount === null) throw new Error('Current balance is required for verified manual evidence.');
  var observedAt = financialFactIso_(opts.observedAt || new Date(), 'observedAt');
  var effective = financialFactIso_(input.effectiveAsOf, 'effectiveAsOf');
  var stableId = String(input.stableAccountId).trim();
  var record = normalizeCashEvidenceRecord_({
    sourceSystem: 'USER_VERIFIED_MANUAL', sourceType: 'MANUAL',
    externalAccountId: stableId, maskedIdentifier: 'Verified CashCompass account',
    institution: String(input.institution || '').trim(),
    displayName: String(input.displayName || stableId).trim(), accountType: 'CASH',
    currency: String(input.currency || 'USD').trim().toUpperCase(),
    ownerId: input.ownerId || 'UNKNOWN_REVIEW_REQUIRED',
    registrationType: input.registrationType || 'UNKNOWN', stableAccountId: stableId,
    facts: [{ factType: 'CURRENT_BALANCE', numericValue: amount,
      currencyOrUnit: String(input.currency || 'USD').trim().toUpperCase(),
      effectiveAsOf: effective }],
    sourceAsOf: effective, observedAt: observedAt,
    sourceRecordKey: cashImportDigest_([stableId, amount, effective, observedAt].join('\n')),
    importEvidence: { adapterId: 'USER_VERIFIED_MANUAL',
      adapterVersion: CASH_IMPORT_MANUAL_ADAPTER_VERSION_ }
  });
  return { contractVersion: CASH_IMPORT_CONTRACT_VERSION_,
    adapterId: 'USER_VERIFIED_MANUAL', adapterVersion: CASH_IMPORT_MANUAL_ADAPTER_VERSION_,
    sourceType: 'MANUAL', sourceSystem: 'USER_VERIFIED_MANUAL', observedAt: observedAt,
    evidenceFingerprint: cashImportDigest_(JSON.stringify({ account: stableId,
      amount: amount, effectiveAsOf: effective, observedAt: observedAt })), accounts: [record] };
}

function normalizeCashEvidenceRecord_(raw) {
  if (!raw || typeof raw !== 'object') throw new Error('Cash evidence record is required.');
  var sourceSystem = String(raw.sourceSystem || '').trim();
  var externalId = String(raw.externalAccountId || '').trim();
  var suppliedProtectedKey = String(raw.sourceAccountKey || '').trim().toLowerCase();
  if (!sourceSystem || (!externalId && !/^sha256:[a-f0-9]{64}$/.test(suppliedProtectedKey))) {
    throw new Error('Cash evidence requires sourceSystem and source account identity.');
  }
  var facts = (raw.facts || []).map(function(fact) {
    var type = String(fact.factType || '').trim().toUpperCase();
    if (['CURRENT_BALANCE', 'AVAILABLE_BALANCE', 'APY'].indexOf(type) === -1) {
      throw new Error('Unsupported cash fact: ' + type);
    }
    var number = cashImportStrictNumber_(fact.numericValue);
    if (number === null) throw new Error(type + ' requires a numeric value.');
    return { factType: type, numericValue: number,
      currencyOrUnit: String(fact.currencyOrUnit || (type === 'APY' ? 'PERCENT' : raw.currency || 'USD')).trim().toUpperCase(),
      effectiveAsOf: fact.effectiveAsOf ? financialFactIso_(fact.effectiveAsOf, 'effectiveAsOf') : '' };
  });
  if (!facts.some(function(fact) { return fact.factType === 'CURRENT_BALANCE'; })) {
    throw new Error('Authoritative cash evidence requires CURRENT_BALANCE.');
  }
  return {
    sourceSystem: sourceSystem, sourceType: String(raw.sourceType || 'FILE_IMPORT').trim().toUpperCase(),
    sourceAccountKey: suppliedProtectedKey || financialIdentitySourceAccountKey_(sourceSystem, externalId),
    maskedIdentifier: String(raw.maskedIdentifier || financialIdentityMaskIdentifier_(externalId, raw.last4)).trim(),
    institution: String(raw.institution || '').trim(), displayName: String(raw.displayName || '').trim(),
    last4: String(raw.last4 || '').replace(/[^A-Za-z0-9]/g, '').slice(-4),
    accountType: String(raw.accountType || 'CASH').trim(), currency: String(raw.currency || 'USD').trim().toUpperCase(),
    ownerId: financialIdentityNormalizeOwnerId_(raw.ownerId),
    registrationType: financialIdentityNormalizeRegistrationType_(raw.registrationType),
    stableAccountId: String(raw.stableAccountId || '').trim(), facts: facts,
    sourceAsOf: raw.sourceAsOf ? financialFactIso_(raw.sourceAsOf, 'sourceAsOf') : '',
    observedAt: financialFactIso_(raw.observedAt || new Date(), 'observedAt'),
    sourceRecordKey: cashImportProtectedKey_(raw.sourceRecordKey || [sourceSystem, externalId, raw.sourceAsOf].join('\n')),
    importEvidence: { adapterId: String(raw.importEvidence && raw.importEvidence.adapterId || '').trim(),
      adapterVersion: String(raw.importEvidence && raw.importEvidence.adapterVersion || '').trim() }
  };
}

function previewAuthoritativeCashImport_(ss, adapterOutput, decisions, asOf) {
  var normalized = cashImportNormalizeAdapterOutput_(adapterOutput);
  var registry = financialIdentityReadRegistry_(ss);
  var links = cashImportReadSourceLinks_(ss);
  var facts = readFinancialFacts_(ss);
  var factIndex = indexFinancialFacts_(facts);
  var legacyIndex = cashImportLegacyBalanceIndex_(ss, registry.accounts);
  var decisionMap = decisions || {};
  var comparisonAt = financialFactIso_(asOf || new Date(), 'asOf');
  var rows = normalized.accounts.map(function(record) {
    var decision = decisionMap[record.sourceAccountKey] || {};
    var match = cashImportMatchRecord_(record, registry.accounts, links, decision);
    var stableId = match.stableAccountId || '';
    var action = cashImportPreviewAction_(match, decision, record);
    var currentImported = record.facts.filter(function(fact) { return fact.factType === 'CURRENT_BALANCE'; })[0];
    var selected = stableId ? selectCurrentFinancialFactFromIndex_(factIndex, stableId, 'CURRENT_BALANCE', comparisonAt) : null;
    var legacy = stableId && Object.prototype.hasOwnProperty.call(legacyIndex, stableId)
      ? legacyIndex[stableId] : null;
    var prospective = null;
    if (stableId && currentImported) {
      var candidate = cashImportFinancialFact_(record, currentImported, stableId,
        'PREVIEW', normalized.sourceType === 'MANUAL');
      var factKey = stableId + '\nCURRENT_BALANCE';
      var accountFacts = (factIndex.factsByKey[factKey] || []).slice();
      prospective = selectCurrentFinancialFact_(accountFacts.concat([normalizeFinancialFact_(candidate,
        { asOf: comparisonAt, defaultCreatedAt: record.observedAt })]), stableId,
        'CURRENT_BALANCE', comparisonAt);
    }
    var reconciliation = cashImportReconcileValues_(legacy,
      currentImported ? currentImported.numericValue : null);
    var difference = reconciliation.difference;
    var percent = difference === null || legacy === 0 ? null :
      Math.round((difference / Math.abs(legacy)) * 1000000) / 10000;
    return {
      sourceAccountKey: record.sourceAccountKey,
      institution: record.institution, maskedIdentifier: record.maskedIdentifier,
      displayName: record.displayName, accountType: record.accountType,
      stableAccountId: stableId, matchedAccountName: cashImportAccountName_(registry.accounts, stableId),
      matchStatus: match.outcome, matchReason: match.reason || '', candidates: match.candidates || [],
      action: action, existingSelectedBalance: selected && selected.fact ? selected.fact.numericValue : null,
      legacyBalance: legacy, importedBalance: currentImported ? currentImported.numericValue : null,
      effectiveAsOf: currentImported ? currentImported.effectiveAsOf : '',
      currentFreshness: selected ? selected.freshness.status : 'UNKNOWN',
      resultingFreshness: prospective ? prospective.freshness.status : 'UNKNOWN',
      resultingSafeToModel: prospective ? prospective.freshness.safeToModel : false,
      resultingSafeToAct: prospective ? prospective.freshness.safeToAct : false,
      reconciliation: reconciliation.exactStatus,
      reconciliationStatus: reconciliation.exactStatus,
      materialityStatus: reconciliation.materialityStatus,
      difference: difference, differencePercent: percent,
      diagnostics: cashImportRecordDiagnostics_(record, match, currentImported)
    };
  });
  rows.sort(function(a, b) { return a.sourceAccountKey.localeCompare(b.sourceAccountKey); });
  var digestPayload = { contractVersion: normalized.contractVersion,
    evidenceFingerprint: normalized.evidenceFingerprint,
    accounts: rows.map(function(row) { return { sourceAccountKey: row.sourceAccountKey,
      stableAccountId: row.stableAccountId, action: row.action, matchStatus: row.matchStatus,
      importedBalance: row.importedBalance, effectiveAsOf: row.effectiveAsOf }; }) };
  return { ok: true, previewDigest: cashImportDigest_(JSON.stringify(digestPayload)),
    evidenceFingerprint: normalized.evidenceFingerprint, adapterId: normalized.adapterId,
    adapterVersion: normalized.adapterVersion, sourceType: normalized.sourceType,
    sourceSystem: normalized.sourceSystem, observedAt: normalized.observedAt,
    reconciliationPolicy: CASH_IMPORT_RECONCILIATION_POLICY_V1_,
    materialityPolicy: CASH_IMPORT_MATERIALITY_POLICY_V1_, accounts: rows,
    summary: cashImportPreviewSummary_(rows),
    dataQuality: cashImportPreviewDataQuality_(rows) };
}

function applyAuthoritativeCashImport_(ss, adapterOutput, decisions, expectedDigest, asOf) {
  var preview = previewAuthoritativeCashImport_(ss, adapterOutput, decisions, asOf);
  if (!expectedDigest || expectedDigest !== preview.previewDigest) {
    throw new Error('Cash import preview changed. Review the latest preview before applying.');
  }
  var normalized = cashImportNormalizeAdapterOutput_(adapterOutput);
  var prior = cashImportFindRun_(ss, preview.evidenceFingerprint, preview.previewDigest);
  if (prior) return { ok: true, status: 'DUPLICATE_NOOP', importRunId: prior.importRunId,
    appendedFacts: 0, duplicateFacts: 0, preview: preview };
  var registry = financialIdentityReadRegistry_(ss);
  var links = cashImportReadSourceLinks_(ss);
  var decisionMap = decisions || {};
  var now = financialFactIso_(new Date(), 'createdAt');
  var importRunId = 'IMPORT-' + cashImportDigest_([
    preview.evidenceFingerprint, preview.previewDigest
  ].join('\n')).slice(7, 39);
  var rawFacts = [];
  var counts = { matched: 0, added: 0, ignored: 0, review: 0, conflict: 0 };
  normalized.accounts.forEach(function(record) {
    var decision = decisionMap[record.sourceAccountKey] || {};
    var match = cashImportMatchRecord_(record, registry.accounts, links, decision);
    var action = cashImportPreviewAction_(match, decision, record);
    if (action === 'IGNORE') { counts.ignored++; return; }
    if (action === 'REVIEW_REQUIRED') {
      if (match.outcome === 'CONFLICT') counts.conflict++; else counts.review++;
      return;
    }
    var stableId = match.stableAccountId || '';
    if (action === 'ADD') {
      stableId = cashImportCreateAccount_(ss, record, now);
      registry.accounts.push({ stableAccountId: stableId, domain: 'CASH',
        displayName: record.displayName, institution: record.institution,
        accountType: record.accountType, ownerId: record.ownerId,
        registrationType: record.registrationType, last4: '' });
      cashImportCreateVerifiedLink_(ss, record, stableId, now, links);
      counts.added++;
    } else {
      if (!cashImportHasVerifiedLink_(links, record.sourceSystem, record.sourceAccountKey, stableId)) {
        cashImportCreateVerifiedLink_(ss, record, stableId, now, links);
      }
      counts.matched++;
    }
    record.facts.forEach(function(fact) {
      rawFacts.push(cashImportFinancialFact_(record, fact, stableId, importRunId,
        normalized.sourceType === 'MANUAL'));
    });
  });
  var append = appendFinancialFacts_(ss, rawFacts, { asOf: asOf || new Date(), defaultCreatedAt: now });
  var status = counts.review || counts.conflict ? 'PARTIAL_REVIEW_REQUIRED' : 'APPLIED';
  cashImportAppendRun_(ss, preview, importRunId, counts, append, status, now);
  SpreadsheetApp.flush();
  return { ok: true, status: status, importRunId: importRunId,
    appendedFacts: append.appended, duplicateFacts: append.duplicates,
    counts: counts, preview: preview };
}

function previewOfxCashImportFromDashboard(payload) {
  var p = payload || {};
  return previewAuthoritativeCashImport_(getUserSpreadsheet_(),
    adaptOfxCashEvidence_(p.rawFile, p.options || {}), p.decisions || {}, p.asOf || new Date());
}

function applyOfxCashImportFromDashboard(payload) {
  var p = payload || {};
  return withScriptLock_(function() {
    return applyAuthoritativeCashImport_(getUserSpreadsheet_(),
      adaptOfxCashEvidence_(p.rawFile, p.options || {}), p.decisions || {},
      String(p.previewDigest || '').trim(), p.asOf || new Date());
  }, { timeoutMs: 30000, context: 'apply authoritative cash import' });
}

function previewVerifiedManualCashImportFromDashboard(payload) {
  var p = payload || {};
  var adapter = adaptVerifiedManualCashEvidence_(p.record || {}, p.options || {});
  var key = adapter.accounts[0].sourceAccountKey;
  var decisions = {}; decisions[key] = { action: 'MATCH',
    stableAccountId: String(p.record && p.record.stableAccountId || '').trim() };
  return previewAuthoritativeCashImport_(getUserSpreadsheet_(), adapter, decisions, p.asOf || new Date());
}

function applyVerifiedManualCashImportFromDashboard(payload) {
  var p = payload || {};
  return withScriptLock_(function() {
    var adapter = adaptVerifiedManualCashEvidence_(p.record || {}, p.options || {});
    var key = adapter.accounts[0].sourceAccountKey;
    var decisions = {}; decisions[key] = { action: 'MATCH',
      stableAccountId: String(p.record && p.record.stableAccountId || '').trim() };
    return applyAuthoritativeCashImport_(getUserSpreadsheet_(), adapter, decisions,
      String(p.previewDigest || '').trim(), p.asOf || new Date());
  }, { timeoutMs: 30000, context: 'apply verified manual cash evidence' });
}

/** Rebuildable shadow report. It never writes and never feeds Planning. */
function getCashImportShadowComparison_(ss, sourceAccountKeys, asOf) {
  var comparisonAt = financialFactIso_(asOf || new Date(), 'asOf');
  var registry = financialIdentityReadRegistry_(ss);
  var links = cashImportReadSourceLinks_(ss);
  var facts = readFinancialFacts_(ss);
  var factIndex = indexFinancialFacts_(facts);
  var legacyIndex = cashImportLegacyBalanceIndex_(ss, registry.accounts);
  var requested = {};
  (sourceAccountKeys || []).forEach(function(key) { requested[String(key || '').toLowerCase()] = true; });
  var seen = {};
  return links.filter(function(link) {
    if (String(link.linkStatus || '').toUpperCase() !== 'VERIFIED') return false;
    if (Object.keys(requested).length && !requested[String(link.sourceAccountKey || '').toLowerCase()]) return false;
    var account = (registry.accounts || []).filter(function(row) {
      return row.stableAccountId === link.stableAccountId && String(row.domain || '').toUpperCase() === 'CASH';
    })[0];
    if (!account || seen[account.stableAccountId]) return false;
    seen[account.stableAccountId] = true;
    return true;
  }).map(function(link) {
    var account = (registry.accounts || []).filter(function(row) {
      return row.stableAccountId === link.stableAccountId;
    })[0];
    var selection = selectCurrentFinancialFactFromIndex_(factIndex,
      account.stableAccountId, 'CURRENT_BALANCE', comparisonAt);
    var legacy = Object.prototype.hasOwnProperty.call(legacyIndex, account.stableAccountId)
      ? legacyIndex[account.stableAccountId] : null;
    var normalized = selection.fact ? Number(selection.fact.numericValue) : null;
    var reconciliation = cashImportReconcileValues_(legacy, normalized);
    var difference = reconciliation.difference;
    return { stableAccountId: account.stableAccountId, accountName: account.displayName,
      sourceSystem: link.sourceSystem, sourceAccountKey: link.sourceAccountKey,
      maskedIdentifier: link.maskedIdentifier, legacyValue: legacy,
      legacyProvenance: legacy === null ? 'UNAVAILABLE' : 'SYS - Accounts',
      normalizedValue: normalized,
      difference: difference,
      differencePercent: difference === null || legacy === 0 ? null :
        Math.round((difference / Math.abs(legacy)) * 1000000) / 10000,
      normalizedProvenance: selection.fact ? selection.fact.sourceSystem : '',
      effectiveAsOf: selection.fact ? selection.fact.effectiveAsOf : '',
      freshness: selection.freshness.status, safeToModel: selection.freshness.safeToModel,
      safeToAct: selection.freshness.safeToAct, confidence: selection.confidence,
      reconciliationStatus: reconciliation.exactStatus,
      materialityStatus: reconciliation.materialityStatus };
  }).sort(function(a, b) { return a.stableAccountId.localeCompare(b.stableAccountId); });
}

function getCashImportShadowComparisonFromDashboard(payload) {
  var p = payload || {};
  return getCashImportShadowComparison_(getUserSpreadsheet_(),
    p.sourceAccountKeys || [], p.asOf || new Date());
}

function cashImportNormalizeAdapterOutput_(raw) {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.accounts) || !raw.accounts.length) {
    throw new Error('Normalized cash adapter output requires at least one account.');
  }
  return { contractVersion: String(raw.contractVersion || CASH_IMPORT_CONTRACT_VERSION_),
    adapterId: String(raw.adapterId || '').trim(), adapterVersion: String(raw.adapterVersion || '').trim(),
    sourceType: String(raw.sourceType || '').trim().toUpperCase(),
    sourceSystem: String(raw.sourceSystem || '').trim(),
    observedAt: financialFactIso_(raw.observedAt || new Date(), 'observedAt'),
    evidenceFingerprint: cashImportProtectedKey_(raw.evidenceFingerprint || JSON.stringify(raw.accounts)),
    accounts: raw.accounts.map(normalizeCashEvidenceRecord_) };
}

function cashImportReadSourceLinks_(ss) {
  var sheet = ss.getSheetByName(getSheetNames_().ACCOUNT_SOURCE_LINKS);
  if (!sheet || sheet.getLastRow() < 2) return [];
  financialIdentityAssertHeaders_(sheet, ACCOUNT_SOURCE_LINK_HEADERS_);
  var values = sheet.getRange(2, 1, sheet.getLastRow() - 1,
    ACCOUNT_SOURCE_LINK_HEADERS_.length).getDisplayValues();
  return values.filter(function(row) { return String(row[0] || '').trim(); }).map(function(row) {
    return { sourceLinkId: String(row[0] || '').trim(), stableAccountId: String(row[1] || '').trim(),
      sourceType: String(row[2] || '').trim(), sourceSystem: String(row[3] || '').trim(),
      sourceAccountKey: String(row[4] || '').trim().toLowerCase(),
      maskedIdentifier: String(row[5] || '').trim(), institution: String(row[6] || '').trim(),
      sourceAccountType: String(row[7] || '').trim(), linkStatus: String(row[8] || '').trim() };
  });
}

function cashImportMatchRecord_(record, accounts, links, decision) {
  if (record.stableAccountId) {
    return cashImportValidateExplicitMatch_(record, record.stableAccountId, accounts);
  }
  var exact = (links || []).filter(function(link) {
    return link.sourceSystem.toLowerCase() === record.sourceSystem.toLowerCase() &&
      link.sourceAccountKey === record.sourceAccountKey &&
      String(link.linkStatus || '').toUpperCase() === 'VERIFIED';
  });
  if (exact.length > 1) return { outcome: 'AMBIGUOUS', candidates: [] };
  if (exact.length === 1) {
    var verified = cashImportValidateExplicitMatch_(record, exact[0].stableAccountId, accounts, true);
    if (verified.outcome === 'EXPLICIT_MATCH') verified.outcome = 'EXACT_LINK';
    return verified;
  }
  var protectedCandidates = (links || []).filter(function(link) {
    return link.sourceSystem.toLowerCase() === record.sourceSystem.toLowerCase() &&
      link.sourceAccountKey === record.sourceAccountKey;
  });
  if (decision && String(decision.action || '').toUpperCase() === 'MATCH') {
    return cashImportValidateExplicitMatch_(record, decision.stableAccountId, accounts);
  }
  if (protectedCandidates.length === 1) {
    var protectedReview = cashImportValidateExplicitMatch_(record,
      protectedCandidates[0].stableAccountId, accounts);
    if (protectedReview.outcome === 'EXPLICIT_MATCH') {
      return { outcome: 'REVIEW_CANDIDATE',
        candidates: [protectedCandidates[0].stableAccountId],
        reason: 'SOURCE_LINK_VERIFICATION_REQUIRED' };
    }
    return protectedReview;
  }
  if (protectedCandidates.length > 1) return { outcome: 'AMBIGUOUS', candidates: [] };
  return matchFinancialIdentityAdapterRecord_({ sourceType: record.sourceType,
    sourceSystem: record.sourceSystem, externalAccountId: record.sourceAccountKey,
    last4: record.last4, institution: record.institution, displayName: record.displayName,
    domain: 'CASH', accountType: record.accountType, ownerId: record.ownerId,
    registrationType: record.registrationType, currency: record.currency }, accounts, []);
}

function cashImportValidateExplicitMatch_(record, stableId, accounts, verifiedLink) {
  var account = (accounts || []).filter(function(row) {
    return row.stableAccountId === String(stableId || '').trim();
  })[0];
  if (!account) return { outcome: 'CONFLICT', reason: 'MATCH_TARGET_MISSING', candidates: [] };
  if (String(account.domain || '').toUpperCase() !== 'CASH') {
    return { outcome: 'CONFLICT', reason: 'DOMAIN_MISMATCH', candidates: [account.stableAccountId] };
  }
  var incomingOwner = record.ownerId;
  var accountOwner = financialIdentityNormalizeOwnerId_(account.ownerId);
  if (incomingOwner !== 'UNKNOWN_REVIEW_REQUIRED' && accountOwner !== 'UNKNOWN_REVIEW_REQUIRED' &&
      incomingOwner !== accountOwner) {
    return { outcome: 'CONFLICT', reason: 'OWNER_MISMATCH', candidates: [account.stableAccountId] };
  }
  var incomingRegistration = record.registrationType;
  var accountRegistration = financialIdentityNormalizeRegistrationType_(account.registrationType);
  if (incomingRegistration !== 'UNKNOWN' && accountRegistration !== 'UNKNOWN' &&
      incomingRegistration !== accountRegistration) {
    return { outcome: 'CONFLICT', reason: 'REGISTRATION_MISMATCH', candidates: [account.stableAccountId] };
  }
  return { outcome: verifiedLink ? 'EXACT_LINK' : 'EXPLICIT_MATCH',
    stableAccountId: account.stableAccountId, candidates: [] };
}

function cashImportPreviewAction_(match, decision, record) {
  var requested = String(decision && decision.action || '').trim().toUpperCase();
  if (requested === 'IGNORE') return 'IGNORE';
  if (match.outcome === 'EXACT_LINK' || match.outcome === 'EXPLICIT_MATCH') return 'MATCH';
  if (requested === 'ADD' && match.outcome === 'NO_MATCH' && record &&
      record.ownerId !== 'UNKNOWN_REVIEW_REQUIRED' && record.registrationType !== 'UNKNOWN') {
    return 'ADD';
  }
  return 'REVIEW_REQUIRED';
}

function cashImportCreateAccount_(ss, record, now) {
  if (record.ownerId === 'UNKNOWN_REVIEW_REQUIRED' || record.registrationType === 'UNKNOWN') {
    throw new Error('Owner and registration must be confirmed before adding a cash account.');
  }
  var stableId = financialIdentityGenerateStableAccountId_('CASH');
  ensureFinancialAccountsSheet_(ss).appendRow([stableId, 'CASH', record.displayName,
    record.institution, record.accountType, '', record.ownerId, record.registrationType,
    record.currency, '', 'Yes', 'VERIFIED', '', '', now, now]);
  return stableId;
}

function cashImportCreateVerifiedLink_(ss, record, stableId, now, links) {
  ensureAccountSourceLinksSheet_(ss).appendRow(['LINK-' + Utilities.getUuid(), stableId,
    record.sourceType, record.sourceSystem, record.sourceAccountKey,
    record.maskedIdentifier, record.institution, record.accountType, 'VERIFIED', now, now]);
  links.push({ stableAccountId: stableId, sourceSystem: record.sourceSystem,
    sourceAccountKey: record.sourceAccountKey, linkStatus: 'VERIFIED' });
}

function cashImportHasVerifiedLink_(links, sourceSystem, sourceAccountKey, stableId) {
  return (links || []).some(function(link) {
    return String(link.sourceSystem || '').toLowerCase() === String(sourceSystem || '').toLowerCase() &&
      String(link.sourceAccountKey || '').toLowerCase() === String(sourceAccountKey || '').toLowerCase() &&
      link.stableAccountId === stableId && String(link.linkStatus || '').toUpperCase() === 'VERIFIED';
  });
}

function cashImportFinancialFact_(record, fact, stableId, importRunId, manual) {
  var hasEffective = !!fact.effectiveAsOf;
  return { stableInternalAccountId: stableId, factType: fact.factType,
    numericValue: fact.numericValue, currencyOrUnit: fact.currencyOrUnit,
    effectiveAsOf: fact.effectiveAsOf, observedAt: record.observedAt,
    sourceType: manual ? 'MANUAL' : record.sourceType, sourceSystem: record.sourceSystem,
    importRunId: importRunId,
    sourceRecordKey: cashImportDigest_([record.sourceRecordKey, fact.factType,
      fact.numericValue, fact.effectiveAsOf].join('\n')),
    authorityClass: manual ? 'USER_VERIFIED_MANUAL' :
      (hasEffective ? 'INSTITUTION_AUTHORITATIVE' : 'FILE_IMPORTED'),
    verificationStatus: hasEffective ? 'VERIFIED' : 'REVIEW_REQUIRED',
    verifiedAt: hasEffective ? record.observedAt : '', manualOverride: !!manual,
    reconciliationStatus: hasEffective ? 'MATCHED' : 'REVIEW_REQUIRED' };
}

function cashImportLegacyBalanceIndex_(ss, accounts) {
  var out = {};
  var sheet = ss.getSheetByName(getSheetNames_().ACCOUNTS);
  if (!sheet || sheet.getLastRow() < 2) return out;
  var values = sheet.getDataRange().getValues();
  var display = sheet.getDataRange().getDisplayValues();
  var headers = display[0] || [];
  var nameCol = headers.indexOf('Account Name');
  var balanceCol = headers.indexOf('Current Balance');
  if (nameCol === -1 || balanceCol === -1) return out;
  var byName = {};
  for (var r = 1; r < display.length; r++) {
    var name = String(display[r][nameCol] || '').trim();
    var value = Number(values[r][balanceCol]);
    if (name && isFinite(value)) byName[name] = cashImportMoney_(value);
  }
  (accounts || []).forEach(function(account) {
    if (account.legacyDomain === 'SYS_ACCOUNTS' && account.legacyKey &&
        Object.prototype.hasOwnProperty.call(byName, account.legacyKey)) {
      out[account.stableAccountId] = byName[account.legacyKey];
    }
  });
  return out;
}

function cashImportAccountName_(accounts, stableId) {
  var row = (accounts || []).filter(function(account) { return account.stableAccountId === stableId; })[0];
  return row ? row.displayName : '';
}

function cashImportRecordDiagnostics_(record, match, currentFact) {
  var out = [];
  if (!currentFact || !currentFact.effectiveAsOf) out.push('BALANCE_EFFECTIVE_DATE_REQUIRED');
  if (!record.facts.some(function(fact) { return fact.factType === 'APY'; })) out.push('CASH_YIELD_DATA_REQUIRED');
  if (match.outcome === 'CONFLICT') out.push(match.reason || 'IDENTITY_CONFLICT');
  if (match.outcome === 'AMBIGUOUS' || match.outcome === 'REVIEW_CANDIDATE' || match.outcome === 'NO_MATCH') {
    out.push('IDENTITY_REVIEW_REQUIRED');
  }
  return out;
}

function cashImportPreviewDataQuality_(rows) {
  var diagnostics = [];
  rows.forEach(function(row) {
    (row.diagnostics || []).forEach(function(code) {
      diagnostics.push({ sourceAccountKey: row.sourceAccountKey, code: code });
    });
  });
  return { safeToModel: rows.every(function(row) { return row.resultingSafeToModel; }),
    safeToAct: rows.every(function(row) { return row.resultingSafeToAct; }),
    diagnostics: diagnostics };
}

function cashImportPreviewSummary_(rows) {
  var out = { accounts: rows.length, matched: 0, added: 0, ignored: 0,
    reviewRequired: 0, conflicts: 0 };
  rows.forEach(function(row) {
    if (row.action === 'MATCH') out.matched++;
    else if (row.action === 'ADD') out.added++;
    else if (row.action === 'IGNORE') out.ignored++;
    else out.reviewRequired++;
    if (row.matchStatus === 'CONFLICT') out.conflicts++;
  });
  return out;
}

function cashImportFindRun_(ss, fingerprint, previewDigest) {
  var sheet = ss.getSheetByName(getSheetNames_().IMPORT_RUNS);
  if (!sheet || sheet.getLastRow() < 2) return null;
  cashImportAssertHeaders_(sheet, CASH_IMPORT_RUN_HEADERS_);
  var values = sheet.getRange(2, 1, sheet.getLastRow() - 1,
    CASH_IMPORT_RUN_HEADERS_.length).getDisplayValues();
  for (var i = 0; i < values.length; i++) {
    if (String(values[i][1] || '') === fingerprint && String(values[i][2] || '') === previewDigest) {
      return { importRunId: String(values[i][0] || ''), status: String(values[i][18] || '') };
    }
  }
  return null;
}

function cashImportAppendRun_(ss, preview, importRunId, counts, append, status, now) {
  var dates = preview.accounts.map(function(row) { return row.effectiveAsOf; }).filter(Boolean).sort();
  ensureCashImportRunsSheet_(ss).appendRow([importRunId, preview.evidenceFingerprint,
    preview.previewDigest, preview.sourceType, preview.sourceSystem, preview.adapterId,
    preview.adapterVersion, preview.observedAt, dates[0] || '', dates[dates.length - 1] || '',
    preview.accounts.length, counts.matched, counts.added, counts.ignored, counts.review,
    counts.conflict, append.appended, append.duplicates, status, now]);
}

function cashImportOfxAggregates_(text, tag) {
  var out = [];
  var rx = new RegExp('<' + tag + '(?:\\s[^>]*)?>([\\s\\S]*?)<\\/' + tag + '>', 'ig');
  var match;
  while ((match = rx.exec(String(text || '')))) out.push(match[1]);
  return out;
}

function cashImportOfxAggregate_(text, tag) {
  return cashImportOfxAggregates_(text, tag)[0] || '';
}

function cashImportOfxTag_(text, tag) {
  var rx = new RegExp('<' + tag + '(?:\\s[^>]*)?>\\s*([^<\\r\\n]+)', 'i');
  var match = rx.exec(String(text || ''));
  return match ? String(match[1] || '').trim() : '';
}

function cashImportOfxDate_(value) {
  var raw = String(value || '').trim();
  if (!raw) return '';
  var match = /^(\d{4})(\d{2})(\d{2})(?:(\d{2})(\d{2})(\d{2}))?(?:\.\d+)?(?:\[([+-]?\d+)(?::[^\]]+)?\])?/.exec(raw);
  if (!match) return '';
  var utc = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]),
    Number(match[4] || 0), Number(match[5] || 0), Number(match[6] || 0));
  if (match[7]) utc -= Number(match[7]) * 60 * 60 * 1000;
  return new Date(utc).toISOString();
}

function cashImportStrictNumber_(value) {
  if (value === null || typeof value === 'undefined' || String(value).trim() === '') return null;
  var normalized = String(value).replace(/[$,%\s,]/g, '');
  if (!/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(normalized)) return null;
  var number = Number(normalized);
  return isFinite(number) ? number : null;
}

function cashImportProtectedKey_(value) {
  var raw = String(value || '').trim();
  return /^sha256:[a-f0-9]{64}$/i.test(raw) ? raw.toLowerCase() : cashImportDigest_(raw);
}

function cashImportDigest_(value) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,
    String(value || ''), Utilities.Charset.UTF_8);
  var hex = '';
  for (var i = 0; i < bytes.length; i++) {
    var unsigned = bytes[i] < 0 ? bytes[i] + 256 : bytes[i];
    var part = unsigned.toString(16);
    hex += part.length === 1 ? '0' + part : part;
  }
  return 'sha256:' + hex;
}

function cashImportMoney_(value) { return Math.round(Number(value || 0) * 100) / 100; }

function cashImportReconcileValues_(legacyValue, normalizedValue) {
  if (legacyValue === null || typeof legacyValue === 'undefined' ||
      normalizedValue === null || typeof normalizedValue === 'undefined') {
    return { difference: null, exactStatus: 'UNAVAILABLE',
      materialityStatus: 'NOT_EVALUATED' };
  }
  var difference = cashImportMoney_(Number(normalizedValue) - Number(legacyValue));
  return { difference: difference,
    exactStatus: difference === 0 ? 'EXACT_MATCH' : 'DIFFERENCE_DETECTED',
    materialityStatus: CASH_IMPORT_MATERIALITY_POLICY_V1_.status };
}
