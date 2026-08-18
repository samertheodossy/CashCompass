/**
 * Part 2A-1 stable financial identity foundation.
 *
 * This module owns identity only. It never reads or writes current balances,
 * APRs, policies, recommendations, transactions, positions, or tax lots.
 * Existing domain sheets remain authoritative. Planning does not consume this
 * registry in Part 2A-1.
 */

var FINANCIAL_ACCOUNT_HEADERS_ = [
  'Stable Account Id', 'Domain', 'Display Name', 'Institution', 'Account Type',
  'Account Subtype', 'Owner Id', 'Registration Type', 'Currency', 'Last 4',
  'Active', 'Identity Status', 'Legacy Domain', 'Legacy Key', 'Created At',
  'Updated At'
];

var ACCOUNT_SOURCE_LINK_HEADERS_ = [
  'Source Link Id', 'Stable Account Id', 'Source Type', 'Source System',
  'Source Account Key', 'Masked Identifier', 'Institution',
  'Source Account Type', 'Link Status', 'Linked At', 'Verified At'
];

var FINANCIAL_IDENTITY_DOMAINS_ = {
  CASH: true, DEBT: true, INVESTMENT: true, RETIREMENT: true, PROPERTY: true
};
var FINANCIAL_IDENTITY_OWNER_IDS_ = {
  SAMER: true, LAITH: true, LUTFI: true, HOUSEHOLD_JOINT: true,
  UNKNOWN_REVIEW_REQUIRED: true
};
var FINANCIAL_IDENTITY_REGISTRATION_TYPES_ = {
  INDIVIDUAL: true, JOINT: true, CUSTODIAL: true, TAXABLE: true,
  '401K': true, IRA: true, '529': true, TRUST: true,
  PROPERTY_TITLE: true, UNKNOWN: true
};

function ensureFinancialAccountsSheet_(optionalSs) {
  var ss = optionalSs || getUserSpreadsheet_();
  return ensureFinancialIdentitySheet_(ss, getSheetNames_().FINANCIAL_ACCOUNTS,
    FINANCIAL_ACCOUNT_HEADERS_);
}

function ensureAccountSourceLinksSheet_(optionalSs) {
  var ss = optionalSs || getUserSpreadsheet_();
  return ensureFinancialIdentitySheet_(ss, getSheetNames_().ACCOUNT_SOURCE_LINKS,
    ACCOUNT_SOURCE_LINK_HEADERS_);
}

function ensureFinancialIdentitySheet_(ss, sheetName, headers) {
  var existing = ss.getSheetByName(sheetName);
  if (existing) {
    financialIdentityAssertHeaders_(existing, headers);
    return existing;
  }
  var sheet;
  try {
    sheet = ss.insertSheet(sheetName);
  } catch (e) {
    sheet = ss.getSheetByName(sheetName);
    if (!sheet) throw e;
    financialIdentityAssertHeaders_(sheet, headers);
    return sheet;
  }
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  try {
    sheet.getRange(1, 1, 1, headers.length)
      .setFontWeight('bold').setBackground('#ffe599')
      .setHorizontalAlignment('center');
    sheet.setFrozenRows(1);
  } catch (_formatErr) { /* first-create presentation only */ }
  return sheet;
}

function financialIdentityAssertHeaders_(sheet, expected) {
  var actual = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1))
    .getDisplayValues()[0] || [];
  for (var i = 0; i < expected.length; i++) {
    if (String(actual[i] || '').trim() !== expected[i]) {
      throw new Error(sheet.getName() + ' column ' + (i + 1) +
        ' must be "' + expected[i] + '". No changes were made.');
    }
  }
}

function financialIdentityNormalizeDomain_(value) {
  var key = String(value || '').trim().toUpperCase();
  if (!FINANCIAL_IDENTITY_DOMAINS_[key]) throw new Error('Unsupported financial account domain: ' + value);
  return key;
}

function financialIdentityNormalizeOwnerId_(value) {
  var key = String(value || '').trim().toUpperCase() || 'UNKNOWN_REVIEW_REQUIRED';
  return FINANCIAL_IDENTITY_OWNER_IDS_[key] ? key : 'UNKNOWN_REVIEW_REQUIRED';
}

function financialIdentityNormalizeRegistrationType_(value) {
  var key = String(value || '').trim().toUpperCase() || 'UNKNOWN';
  return FINANCIAL_IDENTITY_REGISTRATION_TYPES_[key] ? key : 'UNKNOWN';
}

function financialIdentitySourceAccountKey_(sourceSystem, externalAccountId) {
  var system = String(sourceSystem || '').trim().toLowerCase();
  var external = String(externalAccountId || '').trim();
  if (!system || !external) return '';
  if (/^sha256:[a-f0-9]{64}$/i.test(external)) return external.toLowerCase();
  var bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    system + '\n' + external,
    Utilities.Charset.UTF_8
  );
  var hex = '';
  for (var i = 0; i < bytes.length; i++) {
    var unsigned = bytes[i] < 0 ? bytes[i] + 256 : bytes[i];
    var part = unsigned.toString(16);
    hex += part.length === 1 ? '0' + part : part;
  }
  return 'sha256:' + hex;
}

function financialIdentityMaskIdentifier_(externalAccountId, suppliedLast4) {
  var last4 = String(suppliedLast4 || '').replace(/\D/g, '').slice(-4);
  if (!last4) {
    var raw = String(externalAccountId || '').replace(/[^A-Za-z0-9]/g, '');
    if (!/^sha256/i.test(String(externalAccountId || ''))) last4 = raw.slice(-4);
  }
  return last4 ? '••••' + last4 : 'Identifier on file';
}

function normalizeFinancialIdentityAdapterRecord_(raw) {
  if (!raw || typeof raw !== 'object') throw new Error('Adapter identity record is required.');
  var sourceType = String(raw.sourceType || '').trim().toUpperCase();
  var sourceSystem = String(raw.sourceSystem || '').trim();
  var external = String(raw.externalAccountId || '').trim();
  if (!sourceType || !sourceSystem || !external) {
    throw new Error('Adapter identity requires sourceType, sourceSystem, and externalAccountId.');
  }
  var last4 = String(raw.last4 || '').replace(/\D/g, '').slice(-4);
  return {
    sourceType: sourceType,
    sourceSystem: sourceSystem,
    sourceAccountKey: financialIdentitySourceAccountKey_(sourceSystem, external),
    maskedIdentifier: financialIdentityMaskIdentifier_(external, last4),
    institution: String(raw.institution || '').trim(),
    displayName: String(raw.displayName || '').trim(),
    last4: last4,
    domain: financialIdentityNormalizeDomain_(raw.domain),
    accountType: String(raw.accountType || '').trim(),
    accountSubtype: String(raw.accountSubtype || '').trim(),
    ownerId: financialIdentityNormalizeOwnerId_(raw.ownerId),
    registrationType: financialIdentityNormalizeRegistrationType_(raw.registrationType),
    currency: String(raw.currency || '').trim().toUpperCase()
  };
}

function matchFinancialIdentityAdapterRecord_(raw, accounts, sourceLinks) {
  var incoming = normalizeFinancialIdentityAdapterRecord_(raw);
  var links = (sourceLinks || []).filter(function(link) {
    return String(link.sourceSystem || '').trim().toLowerCase() === incoming.sourceSystem.toLowerCase() &&
      String(link.sourceAccountKey || '').trim().toLowerCase() === incoming.sourceAccountKey &&
      String(link.linkStatus || '').trim().toUpperCase() === 'VERIFIED';
  });
  if (links.length > 1) return { outcome: 'AMBIGUOUS', candidates: [] };
  if (links.length === 1) {
    var account = (accounts || []).filter(function(row) {
      return row.stableAccountId === links[0].stableAccountId;
    })[0];
    if (!account) return { outcome: 'CONFLICT', reason: 'SOURCE_LINK_TARGET_MISSING', candidates: [] };
    var conflict = financialIdentityAccountConflict_(incoming, account);
    return conflict
      ? { outcome: 'CONFLICT', reason: conflict, candidates: [account.stableAccountId] }
      : { outcome: 'EXACT_LINK', stableAccountId: account.stableAccountId, candidates: [] };
  }

  var candidates = (accounts || []).filter(function(account) {
    if (String(account.domain || '').toUpperCase() !== incoming.domain) return false;
    var sameInstitution = incoming.institution && account.institution &&
      String(account.institution).trim().toLowerCase() === incoming.institution.toLowerCase();
    var sameLast4 = incoming.last4 && account.last4 && String(account.last4).slice(-4) === incoming.last4;
    return sameInstitution && sameLast4;
  });
  var safeCandidates = candidates.filter(function(account) {
    return !financialIdentityAccountConflict_(incoming, account);
  });
  if (candidates.length && !safeCandidates.length) {
    return { outcome: 'CONFLICT', reason: 'OWNER_OR_REGISTRATION_MISMATCH', candidates: [] };
  }
  if (safeCandidates.length > 1) {
    return { outcome: 'AMBIGUOUS', candidates: safeCandidates.map(function(row) { return row.stableAccountId; }) };
  }
  if (safeCandidates.length === 1) {
    return { outcome: 'REVIEW_CANDIDATE', candidates: [safeCandidates[0].stableAccountId] };
  }
  return { outcome: 'NO_MATCH', candidates: [] };
}

function financialIdentityAccountConflict_(incoming, account) {
  if (String(account.domain || '').toUpperCase() !== incoming.domain) return 'DOMAIN_MISMATCH';
  var incomingOwner = incoming.ownerId;
  var accountOwner = financialIdentityNormalizeOwnerId_(account.ownerId);
  if (incomingOwner === 'UNKNOWN_REVIEW_REQUIRED' || accountOwner === 'UNKNOWN_REVIEW_REQUIRED') {
    return 'OWNER_REVIEW_REQUIRED';
  }
  if (incomingOwner !== accountOwner) return 'OWNER_MISMATCH';
  var incomingRegistration = incoming.registrationType;
  var accountRegistration = financialIdentityNormalizeRegistrationType_(account.registrationType);
  if (incomingRegistration === 'UNKNOWN' || accountRegistration === 'UNKNOWN') {
    return 'REGISTRATION_REVIEW_REQUIRED';
  }
  if (incomingRegistration !== accountRegistration) return 'REGISTRATION_MISMATCH';
  return '';
}

function financialIdentityGenerateStableAccountId_(domain) {
  var normalized = financialIdentityNormalizeDomain_(domain);
  var prefixes = { CASH: 'CASH', DEBT: 'DEBT', INVESTMENT: 'INV',
    RETIREMENT: 'RET', PROPERTY: 'PROP' };
  return prefixes[normalized] + '-' + Utilities.getUuid();
}

function financialIdentityInferOwnerId_(name) {
  var key = String(name || '').toLowerCase();
  if (/\blaith\b/.test(key)) return 'LAITH';
  if (/\blutfi\b/.test(key)) return 'LUTFI';
  if (/\bsamer\b/.test(key)) return 'SAMER';
  if (/\bjoint\b|\bhousehold\b/.test(key)) return 'HOUSEHOLD_JOINT';
  return 'UNKNOWN_REVIEW_REQUIRED';
}

function financialIdentityInferRegistration_(domain, name, type) {
  var text = (String(name || '') + ' ' + String(type || '')).toLowerCase();
  if (/\b529\b/.test(text)) return '529';
  if (/\bcustodial\b/.test(text)) return 'CUSTODIAL';
  if (/\b401\s*\(?k\)?\b/.test(text)) return '401K';
  if (/\bira\b/.test(text)) return 'IRA';
  if (/\bjoint\b/.test(text)) return 'JOINT';
  if (domain === 'PROPERTY') return 'PROPERTY_TITLE';
  if (domain === 'INVESTMENT') return 'TAXABLE';
  return 'UNKNOWN';
}

function buildFinancialIdentityFoundationPreview_(ss) {
  var candidates = financialIdentityCollectLegacyCandidates_(ss);
  var investmentIdCounts = Object.create(null);
  var legacyKeyCounts = Object.create(null);
  var sourceKeyCounts = Object.create(null);
  candidates.forEach(function(row) {
    if (row.adoptedStableId) investmentIdCounts[row.adoptedStableId] =
      Number(investmentIdCounts[row.adoptedStableId] || 0) + 1;
    var legacyComposite = row.legacyDomain + '::' + row.legacyKey;
    legacyKeyCounts[legacyComposite] = Number(legacyKeyCounts[legacyComposite] || 0) + 1;
    if (row.sourceLink && row.sourceLink.sourceAccountKey) {
      var sourceComposite = String(row.sourceLink.sourceSystem).toLowerCase() + '::' +
        row.sourceLink.sourceAccountKey;
      sourceKeyCounts[sourceComposite] = Number(sourceKeyCounts[sourceComposite] || 0) + 1;
    }
  });
  var existing = financialIdentityReadRegistry_(ss);
  var existingByLegacy = Object.create(null);
  var existingById = Object.create(null);
  existing.accounts.forEach(function(row) {
    existingById[row.stableAccountId] = row;
    existingByLegacy[row.legacyDomain + '::' + row.legacyKey] = row;
  });

  var proposed = candidates.map(function(row) {
    var legacyMatch = existingByLegacy[row.legacyDomain + '::' + row.legacyKey];
    var idMatch = row.adoptedStableId ? existingById[row.adoptedStableId] : null;
    var duplicateInvestmentId = row.adoptedStableId && investmentIdCounts[row.adoptedStableId] > 1;
    var duplicateLegacyKey = legacyKeyCounts[row.legacyDomain + '::' + row.legacyKey] > 1;
    var sourceComposite = row.sourceLink && row.sourceLink.sourceAccountKey
      ? String(row.sourceLink.sourceSystem).toLowerCase() + '::' + row.sourceLink.sourceAccountKey : '';
    var duplicateSourceKey = sourceComposite && sourceKeyCounts[sourceComposite] > 1;
    var conflictReason = duplicateInvestmentId ? 'DUPLICATE_INVESTMENT_ID'
      : duplicateLegacyKey ? 'DUPLICATE_LEGACY_KEY'
      : duplicateSourceKey ? 'DUPLICATE_SOURCE_LINK' : '';
    var status = conflictReason ? 'CONFLICT'
      : (legacyMatch || idMatch) ? 'EXISTING'
      : row.adoptedStableId ? 'ADOPT_READY' : 'CREATE_READY';
    return {
      domain: row.domain, displayName: row.displayName, institution: row.institution,
      accountType: row.accountType, accountSubtype: row.accountSubtype,
      ownerId: row.ownerId, registrationType: row.registrationType,
      currency: row.currency, last4: row.last4, active: row.active,
      identityStatus: conflictReason ? 'CONFLICT'
        : (row.ownerId === 'UNKNOWN_REVIEW_REQUIRED' || row.registrationType === 'UNKNOWN')
          ? 'REVIEW_REQUIRED' : 'VERIFIED',
      legacyDomain: row.legacyDomain, legacyKey: row.legacyKey,
      adoptedStableId: conflictReason ? '' : row.adoptedStableId,
      existingStableId: (legacyMatch || idMatch) ? (legacyMatch || idMatch).stableAccountId : '',
      sourceLink: row.sourceLink || null,
      action: status,
      reason: conflictReason
    };
  }).sort(function(a, b) {
    return (a.domain + '|' + a.displayName).localeCompare(b.domain + '|' + b.displayName);
  });
  var digestMaterial = proposed.map(function(row) {
    return [row.domain, row.displayName, row.legacyDomain, row.legacyKey,
      row.adoptedStableId, row.action, row.reason,
      row.sourceLink ? row.sourceLink.sourceAccountKey : ''].join('|');
  }).join('\n');
  return {
    contractVersion: 1,
    digest: financialIdentityDigest_(digestMaterial),
    accounts: proposed,
    summary: {
      total: proposed.length,
      existing: proposed.filter(function(row) { return row.action === 'EXISTING'; }).length,
      adoptReady: proposed.filter(function(row) { return row.action === 'ADOPT_READY'; }).length,
      createReady: proposed.filter(function(row) { return row.action === 'CREATE_READY'; }).length,
      conflicts: proposed.filter(function(row) { return row.action === 'CONFLICT'; }).length
    }
  };
}

/** Read-only RPC. It never creates or repairs sheets. */
function getFinancialIdentityFoundationPreviewFromDashboard() {
  return buildFinancialIdentityFoundationPreview_(getUserSpreadsheet_());
}

/**
 * Explicit digest-guarded migration writer. No product UI invokes this in
 * Part 2A-1; the seam exists for disposable validation and a later reviewed
 * migration control. Planning remains unchanged.
 */
function applyFinancialIdentityFoundationFromDashboard(payload) {
  if (!payload || typeof payload !== 'object') throw new Error('Missing identity migration payload.');
  var expectedDigest = String(payload.previewDigest || '').trim();
  if (!expectedDigest) throw new Error('previewDigest is required.');
  var lock = LockService.getDocumentLock();
  try { lock.waitLock(30000); } catch (lockErr) {
    throw new Error('Could not acquire document lock: ' + (lockErr && lockErr.message || lockErr));
  }
  try {
    return applyFinancialIdentityFoundation_(getUserSpreadsheet_(), expectedDigest);
  } finally {
    try { lock.releaseLock(); } catch (_releaseErr) { /* best effort */ }
  }
}

function applyFinancialIdentityFoundation_(ss, expectedDigest) {
  var preview = buildFinancialIdentityFoundationPreview_(ss);
  if (!expectedDigest || expectedDigest !== preview.digest) {
    throw new Error('Identity preview changed. Review the latest preview before applying.');
  }
  var accountSheet = ensureFinancialAccountsSheet_(ss);
  var linkSheet = ensureAccountSourceLinksSheet_(ss);
  var now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
  var created = 0;
  var adopted = 0;
  var linksCreated = 0;
  preview.accounts.forEach(function(row) {
    if (row.action === 'EXISTING' || row.action === 'CONFLICT') return;
    var stableId = row.adoptedStableId || financialIdentityGenerateStableAccountId_(row.domain);
    accountSheet.appendRow([
      stableId, row.domain, row.displayName, row.institution, row.accountType,
      row.accountSubtype, row.ownerId, row.registrationType, row.currency,
      row.last4, row.active ? 'Yes' : 'No', row.identityStatus,
      row.legacyDomain, row.legacyKey, now, now
    ]);
    if (row.adoptedStableId) adopted++; else created++;
    if (row.sourceLink && row.sourceLink.sourceAccountKey) {
      linkSheet.appendRow([
        'LINK-' + Utilities.getUuid(), stableId, row.sourceLink.sourceType,
        row.sourceLink.sourceSystem, row.sourceLink.sourceAccountKey,
        row.sourceLink.maskedIdentifier, row.sourceLink.institution,
        row.sourceLink.sourceAccountType, row.sourceLink.linkStatus, now,
        row.sourceLink.linkStatus === 'VERIFIED' ? now : ''
      ]);
      linksCreated++;
    }
  });
  SpreadsheetApp.flush();
  return { ok: true, created: created, adopted: adopted,
    conflicts: preview.summary.conflicts, linksCreated: linksCreated };
}

function financialIdentityReadRegistry_(ss) {
  var sheet = ss.getSheetByName(getSheetNames_().FINANCIAL_ACCOUNTS);
  var accounts = [];
  if (sheet && sheet.getLastRow() >= 2) {
    financialIdentityAssertHeaders_(sheet, FINANCIAL_ACCOUNT_HEADERS_);
    var display = sheet.getDataRange().getDisplayValues();
    for (var r = 1; r < display.length; r++) {
      if (!String(display[r][0] || '').trim()) continue;
      accounts.push({
        stableAccountId: String(display[r][0] || '').trim(),
        domain: String(display[r][1] || '').trim(), displayName: String(display[r][2] || '').trim(),
        institution: String(display[r][3] || '').trim(), accountType: String(display[r][4] || '').trim(),
        accountSubtype: String(display[r][5] || '').trim(),
        ownerId: String(display[r][6] || '').trim(), registrationType: String(display[r][7] || '').trim(),
        currency: String(display[r][8] || '').trim(),
        last4: String(display[r][9] || '').trim(), active: String(display[r][10] || '').trim(),
        identityStatus: String(display[r][11] || '').trim(),
        legacyDomain: String(display[r][12] || '').trim(),
        legacyKey: String(display[r][13] || '').trim()
      });
    }
  }
  return { accounts: accounts };
}

function financialIdentityCollectLegacyCandidates_(ss) {
  var out = [];
  financialIdentityCollectFlatSheet_(ss, getSheetNames_().ACCOUNTS, 'Account Name', 'CASH',
    'SYS_ACCOUNTS', out, { typeHeader: 'Type', activeHeader: 'Active', externalHeader: 'External Account Id' });
  financialIdentityCollectFlatSheet_(ss, getSheetNames_().DEBTS, 'Account Name', 'DEBT',
    'INPUT_DEBTS', out, { typeHeader: 'Type', activeHeader: 'Active' });
  financialIdentityCollectFlatSheet_(ss, getSheetNames_().HOUSE_ASSETS, 'House', 'PROPERTY',
    'SYS_HOUSE_ASSETS', out, { typeHeader: 'Type', activeHeader: 'Active' });

  var assets = ss.getSheetByName(getSheetNames_().ASSETS);
  if (assets) {
    var values = assets.getDataRange().getDisplayValues();
    if (values.length) {
      var h = values[0] || [];
      var nameCol = h.indexOf('Account Name');
      var typeCol = h.indexOf('Type');
      var activeCol = h.indexOf('Active');
      var idCol = h.indexOf('Investment Id');
      for (var r = 1; r < values.length; r++) {
        var name = nameCol === -1 ? '' : String(values[r][nameCol] || '').trim();
        if (!name || /^(account totals|delta|year)$/i.test(name)) continue;
        var type = typeCol === -1 ? '' : String(values[r][typeCol] || '').trim();
        var registration = financialIdentityInferRegistration_('INVESTMENT', name, type);
        var domain = registration === '401K' || registration === 'IRA' || registration === '529' ||
          registration === 'CUSTODIAL' ? 'RETIREMENT' : 'INVESTMENT';
        var investmentId = idCol === -1 ? '' : String(values[r][idCol] || '').trim();
        out.push(financialIdentityLegacyCandidate_(domain, 'SYS_ASSETS',
          investmentId || name, name, type,
          activeCol === -1 ? true : !financialIdentityInactive_(values[r][activeCol]),
          investmentId, '', '', ''));
      }
    }
  }
  return out;
}

function financialIdentityCollectFlatSheet_(ss, sheetName, nameHeader, domain,
    legacyDomain, out, options) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return;
  var display = sheet.getDataRange().getDisplayValues();
  if (!display.length) return;
  var headers = display[0] || [];
  var nameCol = headers.indexOf(nameHeader);
  var typeCol = headers.indexOf(options.typeHeader);
  var activeCol = headers.indexOf(options.activeHeader);
  var extCol = options.externalHeader ? headers.indexOf(options.externalHeader) : -1;
  for (var r = 1; r < display.length; r++) {
    var name = nameCol === -1 ? '' : String(display[r][nameCol] || '').trim();
    if (!name || /^(total accounts|total debt|total values|house assets|delta|year)$/i.test(name)) continue;
    var type = typeCol === -1 ? '' : String(display[r][typeCol] || '').trim();
    var external = extCol === -1 ? '' : String(display[r][extCol] || '').trim();
    out.push(financialIdentityLegacyCandidate_(domain, legacyDomain, name, name, type,
      activeCol === -1 ? true : !financialIdentityInactive_(display[r][activeCol]),
      '', external, '', ''));
  }
}

function financialIdentityLegacyCandidate_(domain, legacyDomain, legacyKey, name,
    type, active, adoptedStableId, externalId, institution, last4) {
  var owner = financialIdentityInferOwnerId_(name);
  var registration = financialIdentityInferRegistration_(domain, name, type);
  var sourceSystem = institution || legacyDomain;
  var link = externalId ? {
    sourceType: 'LEGACY', sourceSystem: sourceSystem,
    sourceAccountKey: financialIdentitySourceAccountKey_(sourceSystem, externalId),
    maskedIdentifier: financialIdentityMaskIdentifier_(externalId, last4),
    institution: institution || '', sourceAccountType: type || '',
    linkStatus: owner === 'UNKNOWN_REVIEW_REQUIRED' || registration === 'UNKNOWN'
      ? 'REVIEW_REQUIRED' : 'VERIFIED'
  } : null;
  return {
    domain: domain, legacyDomain: legacyDomain, legacyKey: legacyKey,
    displayName: name, institution: institution || '', accountType: type || '',
    accountSubtype: '', ownerId: owner, registrationType: registration,
    currency: 'USD', last4: String(last4 || '').slice(-4), active: !!active,
    adoptedStableId: adoptedStableId || '', sourceLink: link
  };
}

function financialIdentityInactive_(value) {
  return ['no', 'n', 'false', 'inactive'].indexOf(String(value || '').trim().toLowerCase()) !== -1;
}

function financialIdentityDigest_(value) {
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
