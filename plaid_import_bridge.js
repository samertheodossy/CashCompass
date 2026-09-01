/**
 * Read-only Plaid import bridge for the normal CashCompass user path.
 *
 * Environment and signing configuration are server-only Script Properties.
 * Browser input may select an already-owned CashCompass debt identity for
 * comparison, but the server re-validates and validates it before reading.
 * The only workbook write on this path is the canonical Part 2A identity
 * foundation self-init when Connected Accounts needs stableAccountId targets.
 *
 * Product contract:
 *   Import Data (plaidImportPreviewMapped) = read-only provider retrieval and
 *   comparison; performs zero CashCompass financial writes and must not create
 *   Activity Log financial-update entries.
 *   Apply Selected Updates (plaidImportApplyDebtUpdates / plaidImportApplyCashUpdates)
 *   = explicit Debt or Bank Account mutation via updateDebtField /
 *   updateBankAccountValueByDate_ after server-side revalidation; records Activity
 *   Log provenance source=PLAID. Investment Apply is out of scope.
 */
var PLAID_IMPORT_ENABLED_KEY_ = 'PLAID_IMPORT_ENABLED';
var PLAID_IMPORT_REVIEW_BASELINE_KEY_PREFIX_ = 'PLAID_IMPORT_REVIEW_BASELINE_V1_';
var PLAID_IMPORT_DEBT_APPLY_KEYS_ = {
  CURRENT_BALANCE: true, CREDIT_LIMIT: true, MINIMUM_PAYMENT: true,
  NEXT_PAYMENT_DATE: true, INT_RATE: true
};
var PLAID_IMPORT_CASH_APPLY_KEYS_ = {
  CURRENT_BALANCE: true
};
var PLAID_IMPORT_DEBT_APPLY_WRITERS_ = {
  CURRENT_BALANCE: 'Account Balance',
  CREDIT_LIMIT: 'Credit Limit',
  MINIMUM_PAYMENT: 'Minimum Payment',
  NEXT_PAYMENT_DATE: 'Due Date',
  INT_RATE: 'Int Rate'
};
var PLAID_IMPORT_ENVIRONMENT_KEY_ = 'PLAID_IMPORT_ENVIRONMENT';
var PLAID_IMPORT_LEGACY_USER_KEY_PREFIX_ = 'PLAID_IMPORT_PROTECTED_USER_KEY_V1_';
var PLAID_IMPORT_LEGACY_MAPPING_KEY_PREFIX_ = 'PLAID_IMPORT_ACCOUNT_MAPPINGS_V1_';
var PLAID_IMPORT_APR_SOURCE_KEY_PREFIX_ = 'PLAID_IMPORT_APR_SOURCE_V1_';
var PLAID_IMPORT_APR_SOURCE_SEMANTICS_ = {
  PURCHASE_APR: true, DISCLOSED_APR: true, CASH_ADVANCE_APR: true,
  BALANCE_TRANSFER_APR: true, PROMOTIONAL_APR: true
};
/**
 * Canonical Debt import comparison contract (review-only in this bridge).
 * Future Apply must route each approved field through the existing Debt writer
 * for writerField — never a Plaid-specific spreadsheet writer.
 *   CURRENT_BALANCE → Account Balance
 *   CREDIT_LIMIT → Credit Limit
 *   MINIMUM_PAYMENT → Minimum Payment
 *   NEXT_PAYMENT_DATE → Due Date (recurring day-of-month)
 *   AVAILABLE_CREDIT → Provider Available Credit (informational only)
 *   Credit Left review value is derived as Credit Limit − Account Balance
 *   Int Rate → selected Plaid APR sourceSemantic after explicit user choice
 * Statement Balance / Statement Date remain informational until separately approved.
 */
var PLAID_IMPORT_PUBLIC_ERROR_ = 'Connected data is temporarily unavailable.';
var PLAID_IMPORT_IDENTITY_REVIEW_ERROR_ =
  'CashCompass account identity needs review before Connected accounts can be matched.';
var PLAID_IMPORT_SOLE_ADMIN_EMAIL_ = 'samertheodossy@gmail.com';
var PLAID_IMPORT_ALLOWLISTED_CONNECTION_ERROR_CODES_ = {
  CONNECT_IN_PROGRESS: true,
  LINK_COMPLETION_REVIEW_REQUIRED: true
};

function plaidImportSafe_(fn) {
  try { return fn(); }
  catch (e) {
    if (String(e && e.message || '') === 'FINANCIAL_IDENTITY_REVIEW_REQUIRED') {
      return { ok: false, error: PLAID_IMPORT_IDENTITY_REVIEW_ERROR_ };
    }
    return { ok: false, error: PLAID_IMPORT_PUBLIC_ERROR_ };
  }
}

function plaidImportExtractRequestErrorCode_(error) {
  var message = String(error && error.message || '');
  var prefix = 'Plaid import request failed: ';
  if (message.indexOf(prefix) !== 0) return '';
  var code = message.slice(prefix.length).trim();
  return /^[A-Z0-9_]+$/.test(code) ? code : '';
}

function plaidImportSafeConnection_(fn) {
  try { return fn(); }
  catch (e) {
    if (String(e && e.message || '') === 'FINANCIAL_IDENTITY_REVIEW_REQUIRED') {
      return { ok: false, error: PLAID_IMPORT_IDENTITY_REVIEW_ERROR_ };
    }
    var code = plaidImportExtractRequestErrorCode_(e);
    var out = { ok: false, error: PLAID_IMPORT_PUBLIC_ERROR_ };
    if (PLAID_IMPORT_ALLOWLISTED_CONNECTION_ERROR_CODES_[code]) out.connectionErrorCode = code;
    return out;
  }
}

function plaidImportRuntimeMode_() {
  var raw = PropertiesService.getScriptProperties().getProperty('CENTRAL_MODE');
  if (raw === 'true') return 'CENTRAL';
  if (raw === null || raw === '' || raw === 'false') return 'BOUNDED';
  throw new Error('Unsupported CashCompass runtime.');
}

function plaidImportRuntimeContext_() {
  var mode = plaidImportRuntimeMode_();
  var email = getCurrentUserEmail_();
  if (!email || !isAllowlistedUser_()) throw new Error('Authenticated CashCompass user is unavailable.');
  var workbook = getUserSpreadsheet_();
  if (!workbook || !workbook.getId || !String(workbook.getId() || '')) {
    throw new Error('CashCompass workbook is unavailable.');
  }
  return { mode: mode, email: email, workbook: workbook };
}

function plaidImportEnvironment_() {
  var value = String(PropertiesService.getScriptProperties()
    .getProperty(PLAID_IMPORT_ENVIRONMENT_KEY_) || '').trim().toUpperCase();
  if (value !== 'SANDBOX' && value !== 'TRIAL') {
    throw new Error('Plaid import environment is unavailable.');
  }
  return value;
}

function isPlaidImportUser_() {
  try {
    var props = PropertiesService.getScriptProperties();
    var context = plaidImportRuntimeContext_();
    return (context.mode === 'CENTRAL' || context.mode === 'BOUNDED') &&
      props.getProperty(PLAID_IMPORT_ENABLED_KEY_) === 'true' &&
      (plaidImportEnvironment_() === 'SANDBOX' || plaidImportEnvironment_() === 'TRIAL');
  } catch (_e) { return false; }
}

function plaidImportAssertAllowed_() {
  if (!isPlaidImportUser_()) throw new Error('Plaid import is unavailable for this account.');
  return plaidImportRuntimeContext_();
}

function plaidImportWorkbook_() {
  return plaidImportAssertAllowed_().workbook;
}

var PLAID_IMPORT_REQUEST_SESSION_ = null;

function plaidImportBeginRequestSession_() {
  PLAID_IMPORT_REQUEST_SESSION_ = {
    workbook: null,
    registry: null,
    debtLegacyIndex: null,
    cashLegacyIndex: null,
    existingFactsCache: {}
  };
}

function plaidImportEndRequestSession_() {
  PLAID_IMPORT_REQUEST_SESSION_ = null;
}

function plaidImportRequestWorkbook_() {
  var session = PLAID_IMPORT_REQUEST_SESSION_;
  if (session) {
    if (!session.workbook) session.workbook = plaidImportWorkbook_();
    return session.workbook;
  }
  return plaidImportWorkbook_();
}

function plaidImportRequestRegistry_() {
  var session = PLAID_IMPORT_REQUEST_SESSION_;
  var ss = plaidImportRequestWorkbook_();
  if (session) {
    if (!session.registry) session.registry = financialIdentityReadExplicitComparisonAccounts_(ss);
    return session.registry;
  }
  return financialIdentityReadExplicitComparisonAccounts_(ss);
}

function plaidImportRequestDebtLegacyIndex_() {
  var session = PLAID_IMPORT_REQUEST_SESSION_;
  if (session) {
    if (!session.debtLegacyIndex) {
      session.debtLegacyIndex = debtImportLegacyIndex_(plaidImportRequestWorkbook_(),
        plaidImportRequestRegistry_().accounts || []);
    }
    return session.debtLegacyIndex;
  }
  return debtImportLegacyIndex_(plaidImportRequestWorkbook_(),
    plaidImportRequestRegistry_().accounts || []);
}

function plaidImportRequestCashLegacyIndex_() {
  var session = PLAID_IMPORT_REQUEST_SESSION_;
  if (session) {
    if (!session.cashLegacyIndex) {
      session.cashLegacyIndex = cashImportLegacyBalanceIndex_(plaidImportRequestWorkbook_(),
        plaidImportRequestRegistry_().accounts || []);
    }
    return session.cashLegacyIndex;
  }
  return cashImportLegacyBalanceIndex_(plaidImportRequestWorkbook_(),
    plaidImportRequestRegistry_().accounts || []);
}

function plaidImportStageMark_(timing, stageName) {
  if (timing && typeof timing.mark === 'function') timing.mark(stageName);
}

function plaidImportRejectBrowserAuthority_(input) {
  ['owner', 'email', 'userKey', 'workbookId', 'spreadsheetId'].forEach(function(field) {
    if (Object.prototype.hasOwnProperty.call(input || {}, field)) {
      throw new Error('Browser-provided ownership is not accepted.');
    }
  });
}

function plaidImportProperty_(suffix) {
  var environment = plaidImportEnvironment_();
  var value = String(PropertiesService.getScriptProperties()
    .getProperty('PLAID_' + environment + '_' + suffix) || '').trim();
  if (!value) throw new Error('Plaid import deployment configuration is incomplete.');
  return value;
}

function plaidImportNormalizePrivateKeyPem_(value) {
  var privateKey = String(value || '').replace(/\\n/g, '\n').trim();
  if (/-----BEGIN RSA PRIVATE KEY-----/.test(privateKey) ||
      !/-----BEGIN PRIVATE KEY-----/.test(privateKey)) {
    throw new Error('Plaid import assertion private key is invalid.');
  }
  if (/^-----BEGIN PRIVATE KEY-----[^\n\r]/.test(privateKey)) {
    privateKey = privateKey.replace(/^-----BEGIN PRIVATE KEY-----/, '-----BEGIN PRIVATE KEY-----\n');
  }
  if (/[^\n\r]-----END PRIVATE KEY-----$/.test(privateKey)) {
    privateKey = privateKey.replace(/-----END PRIVATE KEY-----$/, '\n-----END PRIVATE KEY-----');
  }
  var match = privateKey.match(
    /^-----BEGIN PRIVATE KEY-----\n([A-Za-z0-9+/=\n\r]+)\n-----END PRIVATE KEY-----$/
  );
  if (!match) throw new Error('Plaid import assertion private key is invalid.');
  try {
    var der = Utilities.base64Decode(match[1].replace(/\s+/g, ''));
    var hex = der.map(function(byte) {
      var n = byte < 0 ? byte + 256 : byte;
      return (n < 16 ? '0' : '') + n.toString(16);
    }).join('');
    if (der.length < 128 || der[0] !== 48 ||
        hex.indexOf('06092a864886f70d010101') === -1) {
      throw new Error('invalid');
    }
    Utilities.computeRsaSha256Signature('cashcompass-plaid-key-validation', privateKey);
  } catch (_error) {
    throw new Error('Plaid import assertion private key is invalid.');
  }
  return privateKey;
}

function plaidImportAuthenticatedIdentity_() {
  var context = plaidImportRuntimeContext_();
  var email = String(context.email || '').trim().toLowerCase();
  if (!email || email.length > 254 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    throw new Error('Authenticated CashCompass user identity is unavailable.');
  }
  return { email: email, subject: 'u_' + plaidSandboxSha256_(email) };
}

function plaidImportAssertion_(action, rawBody) {
  var environment = plaidImportEnvironment_();
  var privateKey = plaidImportNormalizePrivateKeyPem_(plaidImportProperty_('ASSERTION_PRIVATE_KEY_PEM'));
  var keyId = plaidImportProperty_('ASSERTION_KEY_ID');
  var identity = plaidImportAuthenticatedIdentity_();
  var now = Math.floor(Date.now() / 1000);
  var header = { alg: 'RS256', typ: 'CC-AUTH', kid: keyId };
  var claims = {
    iss: 'cashcompass-central-app', aud: 'cashcompass-plaid-backend',
    env: environment, sub: identity.subject, usr: identity.email, action: action,
    bodySha256: plaidSandboxSha256_(rawBody), iat: now, exp: now + 60,
    jti: 'r_' + Utilities.getUuid().replace(/-/g, '')
  };
  var unsigned = plaidSandboxBase64Url_(Utilities.newBlob(JSON.stringify(header)).getBytes()) + '.' +
    plaidSandboxBase64Url_(Utilities.newBlob(JSON.stringify(claims)).getBytes());
  return unsigned + '.' + plaidSandboxBase64Url_(
    Utilities.computeRsaSha256Signature(unsigned, privateKey));
}

function plaidImportBackendUrl_() {
  var backendUrl = plaidImportProperty_('BACKEND_URL');
  if (!/^https:\/\/[a-z0-9-]+(?:-[a-z0-9]+)?\.[a-z0-9-]+\.run\.app$/i.test(backendUrl)) {
    throw new Error('Plaid import backend URL is invalid.');
  }
  return backendUrl.replace(/\/$/, '');
}

function plaidImportParseBackendResponse_(response) {
  var parsed = null;
  try { parsed = JSON.parse(response.getContentText() || '{}'); } catch (_e) {}
  if (response.getResponseCode() < 200 || response.getResponseCode() >= 300 || !parsed || parsed.ok === false) {
    throw new Error('Plaid import request failed: ' + String(parsed && parsed.error || 'BACKEND_UNAVAILABLE'));
  }
  return parsed;
}

function plaidImportRequest_(method, path, action, body) {
  plaidImportAssertAllowed_();
  var rawBody = method === 'GET' ? '' : JSON.stringify(body || {});
  var options = { method: method.toLowerCase(), muteHttpExceptions: true,
    headers: { 'X-CashCompass-Assertion': plaidImportAssertion_(action, rawBody) } };
  if (method !== 'GET') { options.contentType = 'application/json'; options.payload = rawBody; }
  return plaidImportParseBackendResponse_(UrlFetchApp.fetch(plaidImportBackendUrl_() + path, options));
}

function plaidImportRequestBatch_(specs) {
  plaidImportAssertAllowed_();
  var backendUrl = plaidImportBackendUrl_();
  var requests = (specs || []).map(function(spec) {
    var method = String(spec.method || 'GET').toUpperCase();
    var rawBody = method === 'GET' ? '' : JSON.stringify(spec.body || {});
    var req = {
      url: backendUrl + spec.path,
      method: method.toLowerCase(),
      muteHttpExceptions: true,
      headers: { 'X-CashCompass-Assertion': plaidImportAssertion_(spec.action, rawBody) }
    };
    if (method !== 'GET') {
      req.contentType = 'application/json';
      req.payload = rawBody;
    }
    return req;
  });
  return UrlFetchApp.fetchAll(requests).map(function(response) {
    return plaidImportParseBackendResponse_(response);
  });
}

function plaidImportMappingsIndex_(mappingRows) {
  var mappings = {};
  (mappingRows || []).forEach(function(mapping) {
    mappings[plaidImportMappingKey_(mapping.protectedConnectionKey,
      mapping.protectedAccountKey)] = mapping;
  });
  return mappings;
}

function plaidImportFetchConnectedBackendMetadata_() {
  var results = plaidImportRequestBatch_([
    { method: 'GET', path: '/v1/connections', action: 'CONNECTIONS_LIST' },
    { method: 'GET', path: '/v1/mappings', action: 'MAPPINGS_LIST' }
  ]);
  return {
    connections: results[0],
    mappings: plaidImportMappingsIndex_(results[1].mappings || [])
  };
}

function plaidImportSanitizeConnection_(connection) {
  return {
    environment: String(connection && connection.environment || ''),
    protectedConnectionKey: String(connection && connection.protectedConnectionKey || ''),
    institutionName: String(connection && connection.institutionName || ''),
    lifecycleStatus: String(connection && connection.lifecycleStatus || ''),
    lastObservedAt: String(connection && connection.lastObservedAt || ''),
    accounts: (connection && Array.isArray(connection.accounts) ? connection.accounts : [])
      .map(plaidSandboxSanitizeAccount_)
  };
}

function plaidImportInitializeConnection() {
  return plaidImportSafeConnection_(function() {
    var result = plaidImportRequest_('POST', '/v1/link-token', 'LINK_TOKEN_CREATE', {});
    return { ok: true, environment: plaidImportEnvironment_(), linkToken: String(result.linkToken || ''),
      correlationId: String(result.correlationId || ''), expiresAt: String(result.expiresAt || '') };
  });
}

function plaidImportAbandonConnection(payload) {
  return plaidImportSafeConnection_(function() {
    var input = payload && typeof payload === 'object' ? payload : {};
    plaidImportRejectBrowserAuthority_(input);
    plaidImportRequest_('POST', '/v1/link-session/abandon', 'LINK_SESSION_ABANDON', {
      correlationId: String(input.correlationId || '')
    });
    return { ok: true };
  });
}

function plaidImportExchangePublicToken(payload) {
  return plaidImportSafeConnection_(function() {
    var input = payload && typeof payload === 'object' ? payload : {};
    plaidImportRejectBrowserAuthority_(input);
    var result = plaidImportRequest_('POST', '/v1/exchange', 'PUBLIC_TOKEN_EXCHANGE', {
      publicToken: String(input.publicToken || ''), correlationId: String(input.correlationId || ''),
      institutionId: String(input.institutionId || '')
    });
    return { ok: true, connection: plaidImportSanitizeConnection_(result) };
  });
}

function plaidImportListConnections() {
  return plaidImportSafe_(function() {
    var result = plaidImportRequest_('GET', '/v1/connections', 'CONNECTIONS_LIST', null);
    return { ok: true, environment: plaidImportEnvironment_(),
      connections: (result.connections || []).map(plaidImportSanitizeConnection_) };
  });
}

function plaidImportRuntimeStatus() {
  return plaidImportSafe_(function() {
    var result = plaidImportRequest_('POST', '/v1/runtime-status', 'RUNTIME_STATUS', {});
    var secrets = result && result.secrets || {};
    if (result.environment !== plaidImportEnvironment_() ||
        result.firestoreNonceConsumed !== true || result.kmsEncryptDecrypt !== true ||
        secrets.clientIdReadable !== true || secrets.providerSecretReadable !== true) {
      throw new Error('Plaid import runtime is not ready.');
    }
    return { ok: true, environment: plaidImportEnvironment_(), ready: true };
  });
}

function plaidImportReconnect(payload) {
  return plaidImportSafe_(function() {
    var input = payload && typeof payload === 'object' ? payload : {};
    plaidImportRejectBrowserAuthority_(input);
    var key = String(input.protectedConnectionKey || '');
    var result = plaidImportRequest_('POST', '/v1/update-link-token', 'UPDATE_LINK_TOKEN_CREATE',
      { protectedConnectionKey: key });
    return { ok: true, environment: plaidImportEnvironment_(), linkToken: String(result.linkToken || ''),
      correlationId: String(result.correlationId || ''), protectedConnectionKey: key };
  });
}

function plaidImportCompleteReconnect(payload) {
  return plaidImportSafe_(function() {
    var input = payload && typeof payload === 'object' ? payload : {};
    plaidImportRejectBrowserAuthority_(input);
    return plaidImportRequest_('POST', '/v1/update-complete', 'UPDATE_COMPLETE', {
      protectedConnectionKey: String(input.protectedConnectionKey || ''),
      correlationId: String(input.correlationId || '')
    });
  });
}

function plaidImportRegistryIndex_(accounts) {
  var byLegacy = Object.create(null);
  (accounts || []).forEach(function(row) {
    var legacyDomain = String(row.legacyDomain || '').trim().toUpperCase();
    var legacyKey = String(row.legacyKey || '').trim();
    if (legacyDomain && legacyKey) byLegacy[legacyDomain + '::' + legacyKey] = row;
  });
  return byLegacy;
}

function plaidImportEligibleRegistryAccounts_(ss) {
  return (financialIdentityReadExplicitComparisonAccounts_(ss).accounts || []).filter(function(account) {
    return debtImportAccountActive_(account) &&
      financialIdentityIsEligibleExplicitComparisonTarget_(account);
  });
}

function plaidImportLookupRegistryRow_(index, legacyDomain, legacyKeys) {
  var domain = String(legacyDomain || '').trim().toUpperCase();
  for (var i = 0; i < (legacyKeys || []).length; i++) {
    var key = String(legacyKeys[i] || '').trim();
    if (!key) continue;
    var row = index[domain + '::' + key];
    if (row) return row;
  }
  return null;
}

function plaidImportPushManualComparisonTarget_(targets, seen, row, accountName) {
  if (!row || !accountName) return;
  var stableAccountId = String(row.stableAccountId || '').trim();
  if (!stableAccountId || seen[stableAccountId]) return;
  seen[stableAccountId] = true;
  targets.push({
    stableAccountId: stableAccountId,
    domain: String(row.domain || '').toUpperCase(),
    accountName: accountName
  });
}

function plaidImportBuildManualComparisonTargets_(ss) {
  var eligible = plaidImportEligibleRegistryAccounts_(ss);
  var index = plaidImportRegistryIndex_(eligible);
  var targets = [];
  var seen = Object.create(null);

  (getDebtsUiData().debts || []).forEach(function(debt) {
    var accountName = String(debt && debt.accountName || '').trim();
    if (!accountName) return;
    plaidImportPushManualComparisonTarget_(targets, seen,
      plaidImportLookupRegistryRow_(index, 'INPUT_DEBTS', [accountName]), accountName);
  });

  (getBankAccountUiData().accounts || []).forEach(function(accountName) {
    accountName = String(accountName || '').trim();
    if (!accountName) return;
    plaidImportPushManualComparisonTarget_(targets, seen,
      plaidImportLookupRegistryRow_(index, 'SYS_ACCOUNTS', [accountName]), accountName);
  });

  var investmentUi = getInvestmentUiData();
  var managementByName = Object.create(null);
  (investmentUi.managementAccounts || []).forEach(function(row) {
    var name = String(row && row.accountName || '').trim();
    if (name) managementByName[name.toLowerCase()] = row;
  });
  (investmentUi.accounts || []).forEach(function(accountName) {
    accountName = String(accountName || '').trim();
    if (!accountName) return;
    var management = managementByName[accountName.toLowerCase()] || null;
    var legacyKeys = [management && management.investmentId, accountName].filter(function(key) {
      return !!String(key || '').trim();
    });
    plaidImportPushManualComparisonTarget_(targets, seen,
      plaidImportLookupRegistryRow_(index, 'SYS_ASSETS', legacyKeys), accountName);
  });

  return targets;
}

function plaidImportEnsureIdentityFoundationForConnected_(ss) {
  var result = ensureFinancialIdentityFoundationForConnectedAccounts_(ss);
  if (!result || result.ok !== true) {
    throw new Error('CashCompass account identity is unavailable.');
  }
  return result;
}

function plaidImportResolveComparisonTargets_(ss) {
  var workbook = ss || plaidImportWorkbook_();
  plaidImportEnsureIdentityFoundationForConnected_(workbook);
  return plaidImportBuildManualComparisonTargets_(workbook);
}

function plaidImportComparisonTargets() {
  return plaidImportSafe_(function() {
    return { ok: true, targets: plaidImportResolveComparisonTargets_() };
  });
}

function plaidImportExistingFacts_(stableAccountId) {
  var cacheKey = String(stableAccountId || '');
  var session = PLAID_IMPORT_REQUEST_SESSION_;
  if (session && session.existingFactsCache[cacheKey]) {
    return session.existingFactsCache[cacheKey];
  }
  var registry = plaidImportRequestRegistry_();
  var account = (registry.accounts || []).filter(function(row) {
    return row.stableAccountId === stableAccountId && debtImportAccountActive_(row) &&
      financialIdentityIsEligibleExplicitComparisonTarget_(row);
  })[0];
  if (!account) throw new Error('Comparison account is unavailable.');
  var domain = String(account.domain || '').toUpperCase();
  var legacy = domain === 'CASH'
    ? { CURRENT_BALANCE: plaidImportRequestCashLegacyIndex_()[stableAccountId] }
    : (plaidImportRequestDebtLegacyIndex_()[stableAccountId] || {});
  var output = {};
  Object.keys(legacy).forEach(function(type) {
    if (legacy[type] !== null && legacy[type] !== '') output[type] = { value: legacy[type] };
  });
  if (session) session.existingFactsCache[cacheKey] = output;
  return output;
}

function plaidImportIsMortgageType_(accountType) {
  return /(?:^|\b)(?:mortgage|home loan|property loan)(?:\b|$)/i.test(String(accountType || ''));
}

function plaidImportReadMappings_() {
  var result = plaidImportRequest_('GET', '/v1/mappings', 'MAPPINGS_LIST', null);
  return plaidImportMappingsIndex_(result.mappings || []);
}

function plaidImportOwnedAccount_(protectedConnectionKey, protectedAccountKey) {
  var result = plaidImportRequest_('GET', '/v1/connections', 'CONNECTIONS_LIST', null);
  var connection = (result.connections || []).filter(function(row) {
    return String(row.protectedConnectionKey || '') === protectedConnectionKey;
  })[0];
  if (!connection || String(connection.lifecycleStatus || '') !== 'ACTIVE') {
    throw new Error('Connected institution is unavailable.');
  }
  var account = (connection.accounts || []).filter(function(row) {
    return String(row.protectedAccountKey || '') === protectedAccountKey;
  })[0];
  if (!account) throw new Error('Connected account is unavailable.');
  return { connection: connection, account: account };
}

function plaidImportCanonicalTarget_(stableAccountId, providerAccount, registry) {
  var rows = registry || plaidImportRequestRegistry_();
  var target = (rows.accounts || []).filter(function(row) {
    return String(row.stableAccountId || '') === stableAccountId;
  })[0];
  if (!target || !debtImportAccountActive_(target) ||
      !financialIdentityIsEligibleExplicitComparisonTarget_(target)) {
    throw new Error('CashCompass target is unavailable.');
  }
  var domain = String(target.domain || '').toUpperCase();
  var type = String(providerAccount && providerAccount.type || '').toLowerCase();
  var subtype = String(providerAccount && providerAccount.subtype || '').toLowerCase();
  var expected = type === 'depository' ? 'CASH' :
    (type === 'credit' || (type === 'loan' && subtype === 'mortgage')) ? 'DEBT' : '';
  if (!expected || domain !== expected) throw new Error('CashCompass target type does not match.');
  if (domain === 'CASH' &&
      (String(target.legacyDomain || '').toUpperCase() !== 'SYS_ACCOUNTS' || !String(target.legacyKey || '').trim())) {
    throw new Error('Canonical Bank Account target is unavailable.');
  }
  return target;
}

function plaidImportReviewAnchorDate_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function plaidImportMappingKey_(connectionKey, accountKey) {
  return connectionKey + '|' + accountKey;
}

function plaidImportAprSourceStorageKey_(connectionKey, accountKey, stableAccountId) {
  var identity = plaidImportAuthenticatedIdentity_();
  return PLAID_IMPORT_APR_SOURCE_KEY_PREFIX_ + plaidImportEnvironment_() + '|' +
    identity.subject + '|' + String(connectionKey || '') + '|' +
    String(accountKey || '') + '|' + String(stableAccountId || '');
}

function plaidImportReadAprSourcePreference_(connectionKey, accountKey, stableAccountId) {
  var raw = PropertiesService.getUserProperties().getProperty(
    plaidImportAprSourceStorageKey_(connectionKey, accountKey, stableAccountId));
  if (!raw) return null;
  try {
    var parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    var semantic = String(parsed.sourceSemantic || '').toUpperCase();
    if (!PLAID_IMPORT_APR_SOURCE_SEMANTICS_[semantic]) return null;
    return {
      sourceSemantic: semantic,
      selectedAt: String(parsed.selectedAt || '')
    };
  } catch (_e) {
    return null;
  }
}

function plaidImportReadAprSourcePreferencesForConnection_(connection, mappings) {
  var out = {};
  (connection.accounts || []).forEach(function(account) {
    var mapping = plaidImportMappingState_(connection, account, mappings);
    if (mapping.status !== 'CONFIRMED') return;
    var pref = plaidImportReadAprSourcePreference_(connection.protectedConnectionKey,
      account.protectedAccountKey, mapping.stableAccountId);
    if (pref) out[account.protectedAccountKey] = pref;
  });
  return out;
}

function plaidImportSaveAprSourcePreference(payload) {
  return plaidImportSafe_(function() {
    var input = payload && typeof payload === 'object' ? payload : {};
    plaidImportRejectBrowserAuthority_(input);
    plaidImportAssertAllowed_();
    var connectionKey = String(input.protectedConnectionKey || '');
    var accountKey = String(input.protectedAccountKey || '');
    var stableAccountId = String(input.stableAccountId || '');
    var semantic = String(input.sourceSemantic || '').toUpperCase();
    if (!connectionKey || !accountKey || !stableAccountId) {
      throw new Error('CashCompass account association is unavailable.');
    }
    if (!PLAID_IMPORT_APR_SOURCE_SEMANTICS_[semantic]) {
      throw new Error('APR source is invalid.');
    }
    plaidImportOwnedAccount_(connectionKey, accountKey);
    var mapping = plaidImportReadMappings_()[plaidImportMappingKey_(connectionKey, accountKey)];
    if (!mapping || mapping.status !== 'CONFIRMED' ||
        String(mapping.stableAccountId || '') !== stableAccountId) {
      throw new Error('CashCompass account association is unavailable.');
    }
    PropertiesService.getUserProperties().setProperty(
      plaidImportAprSourceStorageKey_(connectionKey, accountKey, stableAccountId),
      JSON.stringify({ sourceSemantic: semantic, selectedAt: new Date().toISOString() }));
    return { ok: true, preference: { sourceSemantic: semantic } };
  });
}

function plaidImportSaveMapping(payload) {
  return plaidImportSafe_(function() {
    var input = payload && typeof payload === 'object' ? payload : {};
    plaidImportRejectBrowserAuthority_(input);
    plaidImportAssertAllowed_();
    plaidImportEnsureIdentityFoundationForConnected_(plaidImportWorkbook_());
    var connectionKey = String(input.protectedConnectionKey || '');
    var accountKey = String(input.protectedAccountKey || '');
    var status = String(input.status || '').toUpperCase();
    var owned = plaidImportOwnedAccount_(connectionKey, accountKey);
    var previous = plaidImportReadMappings_()[plaidImportMappingKey_(connectionKey, accountKey)] || {};
    var request = { protectedConnectionKey: connectionKey, protectedAccountKey: accountKey,
      expectedRevision: Number(previous.revision || 0) };
    if (status === 'IGNORED') {
      request.stableAccountId = '';
      request.status = 'IGNORED';
    } else if (status === 'CONFIRMED') {
      var stableAccountId = String(input.stableAccountId || '');
      plaidImportCanonicalTarget_(stableAccountId, owned.account);
      request.stableAccountId = stableAccountId;
      request.status = 'CONFIRMED';
    } else {
      throw new Error('Mapping status is invalid.');
    }
    var result = plaidImportRequest_('POST', '/v1/mappings/save', 'MAPPING_SAVE', request);
    return { ok: true, mapping: result.mapping };
  });
}

function plaidImportInvalidateMapping(payload) {
  return plaidImportSafe_(function() {
    var input = payload && typeof payload === 'object' ? payload : {};
    plaidImportRejectBrowserAuthority_(input);
    var connectionKey = String(input.protectedConnectionKey || '');
    var accountKey = String(input.protectedAccountKey || '');
    plaidImportOwnedAccount_(connectionKey, accountKey);
    var previous = plaidImportReadMappings_()[plaidImportMappingKey_(connectionKey, accountKey)];
    if (!previous) throw new Error('Mapping is unavailable.');
    var result = plaidImportRequest_('POST', '/v1/mappings/invalidate', 'MAPPING_INVALIDATE', {
      protectedConnectionKey: connectionKey,
      protectedAccountKey: accountKey,
      expectedRevision: Number(previous.revision || 0)
    });
    return { ok: true, mapping: result.mapping };
  });
}

function plaidImportLegacyMappingProperty_() {
  return PLAID_IMPORT_LEGACY_MAPPING_KEY_PREFIX_ + plaidImportEnvironment_();
}

function plaidImportReadLegacyMappings_() {
  var environment = plaidImportEnvironment_();
  var mappings = {};
  var baselineRaw = String(PropertiesService.getScriptProperties()
    .getProperty('PLAID_' + environment + '_ACCOUNT_MAPPINGS_JSON') || '').trim();
  var userRaw = String(PropertiesService.getUserProperties()
    .getProperty(plaidImportLegacyMappingProperty_()) || '').trim();
  [baselineRaw, userRaw].forEach(function(raw) {
    if (!raw) return;
    var parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Legacy Plaid mapping source is invalid.');
    }
    Object.keys(parsed).forEach(function(key) { mappings[key] = parsed[key]; });
  });
  return mappings;
}

function plaidImportLegacyUserKey_() {
  var environment = plaidImportEnvironment_();
  var configured = String(PropertiesService.getScriptProperties()
    .getProperty('PLAID_' + environment + '_PROTECTED_USER_KEY') || '').trim();
  var stored = String(PropertiesService.getUserProperties()
    .getProperty(PLAID_IMPORT_LEGACY_USER_KEY_PREFIX_ + environment) || '').trim();
  var value = configured || stored;
  if (!/^[A-Za-z0-9_-]{20,128}$/.test(value)) {
    throw new Error('Legacy Plaid owner identity is unavailable.');
  }
  return value;
}

function plaidImportMigrateLegacyMappingsToBackend() {
  return plaidImportSafe_(function() {
    var context = plaidImportAssertAllowed_();
    var identity = plaidImportAuthenticatedIdentity_();
    if (context.mode !== 'CENTRAL' || plaidImportEnvironment_() !== 'TRIAL' ||
        identity.email !== PLAID_IMPORT_SOLE_ADMIN_EMAIL_) {
      throw new Error('Legacy Plaid migration is restricted to the sole Central Trial administrator.');
    }
    var source = plaidImportReadLegacyMappings_();
    var mappings = Object.keys(source).map(function(key) {
      var value = source[key] || {};
      return {
        protectedConnectionKey: String(value.protectedConnectionKey || key.split('|')[0] || ''),
        protectedAccountKey: String(value.protectedAccountKey || key.split('|')[1] || ''),
        stableAccountId: String(value.stableAccountId || ''),
        status: String(value.status || '').toUpperCase()
      };
    });
    var result = plaidImportRequest_('POST', '/v1/mappings/migrate', 'MAPPINGS_MIGRATE', {
      legacyUserKey: plaidImportLegacyUserKey_(), mappings: mappings
    });
    var backendMappings = plaidImportReadMappings_();
    mappings.forEach(function(mapping) {
      var persisted = backendMappings[plaidImportMappingKey_(mapping.protectedConnectionKey,
        mapping.protectedAccountKey)];
      if (!persisted || persisted.status !== mapping.status ||
          String(persisted.stableAccountId || '') !== mapping.stableAccountId) {
        throw new Error('Legacy Plaid mapping verification failed.');
      }
    });
    var connections = plaidImportRequest_('GET', '/v1/connections', 'CONNECTIONS_LIST', null);
    if (!Array.isArray(connections.connections) || connections.connections.length < 1) {
      throw new Error('Legacy Plaid connection verification failed.');
    }
    return { ok: true, migrated: result.migrated === true, idempotent: result.idempotent === true,
      mappingCount: mappings.length, connectionCount: connections.connections.length,
      legacySourcePreserved: true };
  });
}

function plaidImportMappingState_(connection, account, mappings, registry) {
  var key = plaidImportMappingKey_(connection.protectedConnectionKey, account.protectedAccountKey);
  var mapping = mappings[key];
  if (!mapping) return { status: 'UNMATCHED', stableAccountId: '', revision: 0 };
  if (mapping.status === 'IGNORED') return mapping;
  try {
    plaidImportCanonicalTarget_(String(mapping.stableAccountId || ''), account, registry);
    return mapping;
  } catch (error) {
    return { status: /type does not match/i.test(String(error && error.message || ''))
        ? 'MAPPING_REVIEW_REQUIRED' : 'INVALID_TARGET',
      stableAccountId: String(mapping.stableAccountId || ''),
      revision: Number(mapping.revision || 0) };
  }
}

function plaidImportNormalizeConnectedDomain_(domain) {
  var normalized = String(domain || '').trim().toUpperCase();
  return normalized === 'DEBT' || normalized === 'INVESTMENT' ? normalized : 'CASH';
}

function plaidImportEnsureIdentityReadyForConnected_(ss) {
  var workbook = ss || plaidImportWorkbook_();
  var registry = financialIdentityReadRegistry_(workbook);
  if ((registry.accounts || []).length > 0) return registry;
  plaidImportEnsureIdentityFoundationForConnected_(workbook);
  return financialIdentityReadRegistry_(workbook);
}

var PLAID_CONNECTED_METADATA_SESSION_ = null;

function plaidImportBeginConnectedMetadataSession_() {
  PLAID_CONNECTED_METADATA_SESSION_ = { registry: null };
}

function plaidImportEndConnectedMetadataSession_() {
  PLAID_CONNECTED_METADATA_SESSION_ = null;
}

function plaidImportConnectedMetadataRegistry_(ss) {
  var session = PLAID_CONNECTED_METADATA_SESSION_;
  if (session && session.registry) return session.registry;
  var registry = plaidImportEnsureIdentityReadyForConnected_(ss);
  if (session) session.registry = registry;
  return registry;
}

function plaidImportConnectedTargetEligible_(row, domain) {
  if (!row || !debtImportAccountActive_(row)) return false;
  var rowDomain = String(row.domain || '').toUpperCase();
  var normalized = plaidImportNormalizeConnectedDomain_(domain);
  if (normalized === 'INVESTMENT') {
    return rowDomain === 'INVESTMENT' || rowDomain === 'RETIREMENT';
  }
  if (normalized === 'DEBT') return rowDomain === 'DEBT';
  return rowDomain === 'CASH';
}

function plaidImportBuildConnectedDisplayTargetsFromRegistry_(registry, domain) {
  var targets = [];
  var seen = Object.create(null);
  (registry.accounts || []).forEach(function(row) {
    if (!plaidImportConnectedTargetEligible_(row, domain)) return;
    var stableAccountId = String(row.stableAccountId || '').trim();
    if (!stableAccountId || seen[stableAccountId]) return;
    seen[stableAccountId] = true;
    var accountName = String(row.displayName || row.legacyKey || '').trim();
    if (!accountName) return;
    targets.push({
      stableAccountId: stableAccountId,
      domain: String(row.domain || '').toUpperCase(),
      accountName: accountName
    });
  });
  targets.sort(function(a, b) {
    return String(a.accountName || '').localeCompare(String(b.accountName || ''), undefined, {
      sensitivity: 'base'
    });
  });
  return targets;
}

function plaidImportLogConnectedLoadTiming_(stageTimingMs, domain) {
  try {
    var parts = ['PLAID_CONNECTED_LOAD_TIMING domain=' + String(domain || 'ALL')];
    Object.keys(stageTimingMs || {}).sort().forEach(function(key) {
      parts.push(key + 'Ms=' + String(stageTimingMs[key]));
    });
    Logger.log(parts.join(' '));
  } catch (_e) { /* owner diagnostics only */ }
}

function plaidImportBuildConnectedDisplayTargets_(ss, domain, registry) {
  return plaidImportBuildConnectedDisplayTargetsFromRegistry_(
    registry || plaidImportConnectedMetadataRegistry_(ss), domain);
}

function plaidImportConnectedAccountsState(payload) {
  return plaidImportSafe_(function() {
    var input = payload && typeof payload === 'object' ? payload : {};
    plaidImportRejectBrowserAuthority_(input);
    var domain = String(input.domain || '').trim().toUpperCase();
    var timing = plaidImportStageTimingCreate_();
    plaidImportStageMark_(timing, 'entry');
    plaidImportAssertAllowed_();
    plaidImportStageMark_(timing, 'auth');
    var ss = plaidImportWorkbook_();
    try {
      plaidImportBeginConnectedMetadataSession_();
      var registry = plaidImportConnectedMetadataRegistry_(ss);
      plaidImportStageMark_(timing, 'identity');
      var backendMeta = plaidImportFetchConnectedBackendMetadata_();
      plaidImportStageMark_(timing, 'backendMetadata');
      var mappings = backendMeta.mappings;
      var result = backendMeta.connections;
      var targetRows = domain
        ? plaidImportBuildConnectedDisplayTargetsFromRegistry_(registry, domain)
        : plaidImportResolveComparisonTargets_(ss);
      plaidImportStageMark_(timing, 'displayTargets');
      var response = {
        ok: true,
        environment: plaidImportEnvironment_(),
        metadataOnly: true,
        targets: targetRows,
        connections: (result.connections || []).map(function(raw) {
          var connection = plaidImportSanitizeConnection_(raw);
          connection.accounts = connection.accounts.map(function(account) {
            account.mapping = plaidImportMappingState_(connection, account, mappings, registry);
            return account;
          });
          return connection;
        })
      };
      plaidImportStageMark_(timing, 'response');
      var stageTimingMs = timing.finish();
      response.stageTimingMs = stageTimingMs;
      plaidImportLogConnectedLoadTiming_(stageTimingMs, domain);
      return response;
    } finally {
      plaidImportEndConnectedMetadataSession_();
    }
  });
}

function plaidImportConfirmedFacts_(connection, mappings, targetAccountKey) {
  var existing = {};
  var scopedKey = String(targetAccountKey || '');
  (connection.accounts || []).forEach(function(account) {
    if (scopedKey && scopedKey !== String(account.protectedAccountKey || '')) return;
    var mapping = plaidImportMappingState_(connection, account, mappings);
    if (mapping.status === 'CONFIRMED') {
      existing[account.protectedAccountKey] = plaidImportExistingFacts_(mapping.stableAccountId);
    }
  });
  return existing;
}

function plaidImportFetchPreviewMappedCore_(connectionKey, options) {
  options = options || {};
  var timing = options.timing || null;
  var targetAccountKey = String(options.targetProtectedAccountKey || '');
  var mappings = options.mappings || plaidImportReadMappings_();
  plaidImportStageMark_(timing, 'mappingLoad');
  var connection = options.connection || null;
  if (!connection) {
    var owned = plaidImportRequest_('GET', '/v1/connections', 'CONNECTIONS_LIST', null);
    connection = (owned.connections || []).map(plaidImportSanitizeConnection_).filter(function(row) {
      return row.protectedConnectionKey === connectionKey && row.lifecycleStatus === 'ACTIVE';
    })[0];
  }
  plaidImportStageMark_(timing, 'connectionLoad');
  if (!connection) throw new Error('Connected institution is unavailable.');
  var existing = plaidImportConfirmedFacts_(connection, mappings, targetAccountKey);
  plaidImportStageMark_(timing, 'canonicalReads');
  var previewBody = { protectedConnectionKey: connectionKey, existingFactsByProtectedAccountKey: existing };
  if (targetAccountKey) previewBody.targetProtectedAccountKey = targetAccountKey;
  var result = plaidImportRequest_('POST', '/v1/preview', 'LIABILITIES_PREVIEW', previewBody);
  plaidImportStageMark_(timing, 'backendPreview');
  var aprPrefForTarget = null;
  if (targetAccountKey) {
    var targetConnAccount = (connection.accounts || []).filter(function(row) {
      return String(row.protectedAccountKey || '') === targetAccountKey;
    })[0];
    var targetMapping = targetConnAccount
      ? plaidImportMappingState_(connection, targetConnAccount, mappings) : null;
    if (targetMapping && targetMapping.status === 'CONFIRMED' && targetMapping.stableAccountId) {
      aprPrefForTarget = plaidImportReadAprSourcePreference_(connectionKey, targetAccountKey,
        targetMapping.stableAccountId);
    }
  }
  var aprPreferences = options.aprPreferences ||
    (targetAccountKey
      ? (aprPrefForTarget ? (function() {
        var out = {}; out[targetAccountKey] = aprPrefForTarget; return out;
      })() : {})
      : plaidImportReadAprSourcePreferencesForConnection_(connection, mappings));
  var observedAt = String(result.observedAt || '');
  var confirmedFactsByKey = existing;
  (result.accounts || []).forEach(function(accountPreview) {
    if (targetAccountKey &&
        targetAccountKey !== String(accountPreview.protectedAccountKey || '')) {
      return;
    }
    var account = (connection.accounts || []).filter(function(row) {
      return row.protectedAccountKey === accountPreview.protectedAccountKey;
    })[0];
    if (!account) return;
    var mapping = plaidImportMappingState_(connection, account, mappings);
    accountPreview.mapping = mapping;
    if (mapping.status === 'CONFIRMED') {
      accountPreview.cashCompassLegacy = confirmedFactsByKey[accountPreview.protectedAccountKey] ||
        plaidImportExistingFacts_(mapping.stableAccountId);
      accountPreview.aprSourcePreference = aprPreferences[accountPreview.protectedAccountKey] || null;
      var reviewDomain = '';
      try {
        reviewDomain = plaidImportReviewDomainForStableAccount_(mapping.stableAccountId, account);
      } catch (_domainErr) {
        reviewDomain = '';
      }
      if (reviewDomain === 'CASH') {
        plaidImportEnrichCashApplyContext_(accountPreview, {
          reviewAnchorDate: plaidImportReviewAnchorDate_()
        });
      }
      if (options.persistBaselines !== false) {
        if (!targetAccountKey ||
            targetAccountKey !== String(accountPreview.protectedAccountKey || '')) {
          return;
        }
        if (reviewDomain === 'DEBT' || reviewDomain === 'CASH') {
          var baseline = plaidImportCreateReviewBaseline_(
            accountPreview, accountPreview.aprSourcePreference, observedAt, reviewDomain,
            accountPreview.protectedAccountKey);
          accountPreview.reviewObservedAt = baseline.observedAt;
          plaidImportStoreReviewBaseline_(connectionKey, accountPreview.protectedAccountKey,
            mapping.stableAccountId, baseline);
        }
      } else {
        var storedBaseline = plaidImportLoadReviewBaseline_(
          connectionKey, accountPreview.protectedAccountKey, mapping.stableAccountId);
        accountPreview.reviewObservedAt = storedBaseline && storedBaseline.observedAt
          ? storedBaseline.observedAt
          : observedAt;
      }
    }
  });
  plaidImportStageMark_(timing, 'baselinePersist');
  var accounts = result.accounts || [];
  if (targetAccountKey) {
    accounts = accounts.filter(function(row) {
      return String(row.protectedAccountKey || '') === targetAccountKey;
    });
  }
  return {
    ok: true,
    connection: connection,
    mappings: mappings,
    environment: plaidImportEnvironment_(),
    readOnly: true,
    authority: 'SHADOW_ONLY',
    observedAt: observedAt,
    reviewAnchorDate: plaidImportReviewAnchorDate_(),
    aprSourcePreferences: aprPreferences,
    accounts: accounts
  };
}

function plaidImportRefreshPreviewAccountAfterApply_(previewResult, connectionKey, accountKey,
  stableAccountId, connection, mappings) {
  var accountPreview = (previewResult.accounts || []).filter(function(row) {
    return String(row.protectedAccountKey || '') === accountKey;
  })[0];
  if (!accountPreview) return previewResult;
  var account = (connection.accounts || []).filter(function(row) {
    return String(row.protectedAccountKey || '') === accountKey;
  })[0];
  if (!account) return previewResult;
  var aprPref = accountPreview.aprSourcePreference || null;
  var reviewDomain = plaidImportReviewDomainForStableAccount_(stableAccountId, account);
  accountPreview.cashCompassLegacy = plaidImportExistingFacts_(stableAccountId);
  if (reviewDomain === 'CASH') {
    plaidImportEnrichCashApplyContext_(accountPreview, previewResult);
  }
  var baseline = plaidImportCreateReviewBaseline_(
    accountPreview, aprPref, previewResult.observedAt, reviewDomain, accountKey);
  accountPreview.reviewObservedAt = baseline.observedAt;
  plaidImportStoreReviewBaseline_(connectionKey, accountKey, stableAccountId, baseline);
  return previewResult;
}

function plaidImportRefreshPreviewAccountAfterApplySafe_(previewResult, connectionKey, accountKey,
  stableAccountId, connection, mappings) {
  try {
    plaidImportRefreshPreviewAccountAfterApply_(previewResult, connectionKey, accountKey,
      stableAccountId, connection, mappings);
    return '';
  } catch (_refreshErr) {
    return 'Update applied. Import Data again to refresh this review.';
  }
}

function plaidImportApplyTimingCreate_() {
  return plaidImportStageTimingCreate_();
}

function plaidImportStageTimingCreate_() {
  var startedAt = Date.now();
  var lastMarkAt = startedAt;
  var stages = {};
  return {
    mark: function(stageName) {
      var now = Date.now();
      stages[String(stageName || 'unknown')] = now - lastMarkAt;
      lastMarkAt = now;
    },
    finish: function() {
      stages.total = Date.now() - startedAt;
      return stages;
    }
  };
}

var PLAID_IMPORT_DEBT_APPLY_WRITE_SESSION_ = null;

function plaidImportBeginDebtApplyWriteSession_(accountName) {
  const ss = getUserSpreadsheet_();
  const sheet = getSheet_(ss, 'DEBTS');
  var display = sheet.getDataRange().getDisplayValues();
  if (display.length < 2) throw new Error('Debts list is empty.');
  var headerMap = getDebtsHeaderMap_(sheet);
  var targetRow = findDebtRow_(sheet, accountName);
  if (targetRow === -1) throw new Error('Debt account not found: ' + accountName);
  PLAID_IMPORT_DEBT_APPLY_WRITE_SESSION_ = {
    accountName: accountName,
    ss: ss,
    sheet: sheet,
    display: display,
    headerMap: headerMap,
    targetRow: targetRow
  };
}

function plaidImportEndDebtApplyWriteSession_() {
  PLAID_IMPORT_DEBT_APPLY_WRITE_SESSION_ = null;
}

function plaidImportDebtApplyWriteSession_() {
  return PLAID_IMPORT_DEBT_APPLY_WRITE_SESSION_;
}

function plaidImportPreviewMapped(payload) {
  return plaidImportSafe_(function() {
    var timing = plaidImportStageTimingCreate_();
    var input = payload && typeof payload === 'object' ? payload : {};
    plaidImportRejectBrowserAuthority_(input);
    timing.mark('entryAuth');
    var connectionKey = String(input.protectedConnectionKey || '');
    var targetAccountKey = String(input.protectedAccountKey || '');
    try {
      plaidImportBeginRequestSession_();
      var preview = plaidImportFetchPreviewMappedCore_(connectionKey, {
        persistBaselines: true,
        targetProtectedAccountKey: targetAccountKey,
        timing: timing
      });
      timing.mark('responseBuild');
      return {
        ok: preview.ok,
        environment: preview.environment,
        readOnly: preview.readOnly,
        authority: preview.authority,
        observedAt: preview.observedAt,
        reviewAnchorDate: preview.reviewAnchorDate,
        aprSourcePreferences: preview.aprSourcePreferences,
        accounts: preview.accounts || [],
        stageTimingMs: timing.finish()
      };
    } finally {
      plaidImportEndRequestSession_();
    }
  });
}

function plaidImportIsDebtConfirmedAccount_(connection, account, mappings) {
  var mapping = plaidImportMappingState_(connection, account, mappings);
  if (mapping.status !== 'CONFIRMED' || !mapping.stableAccountId) return false;
  try {
    var target = plaidImportCanonicalTarget_(mapping.stableAccountId, account);
    return String(target.domain || '').toUpperCase() === 'DEBT';
  } catch (_e) {
    return false;
  }
}

function plaidImportIsCashConfirmedAccount_(connection, account, mappings) {
  var mapping = plaidImportMappingState_(connection, account, mappings);
  if (mapping.status !== 'CONFIRMED' || !mapping.stableAccountId) return false;
  try {
    var target = plaidImportCanonicalTarget_(mapping.stableAccountId, account);
    return String(target.domain || '').toUpperCase() === 'CASH';
  } catch (_e) {
    return false;
  }
}

function plaidImportReviewDomainForStableAccount_(stableAccountId, account) {
  var target = plaidImportCanonicalTarget_(stableAccountId, account);
  return String(target.domain || '').toUpperCase();
}

function plaidImportReviewBaselineStorageKey_(connectionKey, accountKey, stableAccountId) {
  var identity = plaidImportAuthenticatedIdentity_();
  return PLAID_IMPORT_REVIEW_BASELINE_KEY_PREFIX_ + plaidImportEnvironment_() + '|' +
    identity.subject + '|' + String(connectionKey || '') + '|' +
    String(accountKey || '') + '|' + String(stableAccountId || '');
}

function plaidImportStableJsonHash_(value) {
  return plaidSandboxSha256_(JSON.stringify(value));
}

function plaidImportFactsHashPayload_(legacy) {
  var out = {};
  ['CURRENT_BALANCE', 'CREDIT_LIMIT', 'MINIMUM_PAYMENT', 'APR', 'NEXT_PAYMENT_DATE'].forEach(function(key) {
    var entry = legacy && legacy[key];
    var val = entry && Object.prototype.hasOwnProperty.call(entry, 'value') ? entry.value : entry;
    if (val !== null && val !== undefined && val !== '') out[key] = val;
  });
  return out;
}

function plaidImportCashFactsHashPayload_(legacy, applyContext) {
  applyContext = applyContext || null;
  if (applyContext && applyContext.balanceMonthKey) {
    return {
      APPLY_MONTH: String(applyContext.balanceMonthKey || ''),
      CURRENT_BALANCE: applyContext.hasMonthValue ? applyContext.monthBalance : 0
    };
  }
  var entry = legacy && legacy.CURRENT_BALANCE;
  var val = entry && Object.prototype.hasOwnProperty.call(entry, 'value') ? entry.value : entry;
  if (val !== null && val !== undefined && val !== '') return { CURRENT_BALANCE: val };
  return {};
}

function plaidImportEnrichCashApplyContext_(accountPreview, previewMeta) {
  accountPreview = accountPreview || {};
  previewMeta = previewMeta || {};
  var stableAccountId = String(accountPreview.mapping && accountPreview.mapping.stableAccountId || '');
  if (!stableAccountId) return;
  var balanceRow = plaidImportFindPreviewRow_(accountPreview.rows || [], 'CURRENT_BALANCE');
  var balanceDate = plaidImportBalanceDateFromPreview_(balanceRow, previewMeta);
  var accountName = plaidImportResolveCashAccountName_(stableAccountId);
  var monthRead = readBankAccountMonthBalanceForDate_(accountName, balanceDate);
  accountPreview.cashCompassApplyContext = {
    balanceDate: balanceDate,
    monthLabel: monthRead.monthLabel,
    monthBalance: monthRead.monthBalance,
    hasMonthValue: !!monthRead.hasMonthValue,
    balanceMonthKey: monthRead.balanceMonthKey
  };
}

function plaidImportCurrentCashApplyValue_(legacy, applyContext, applyKey) {
  if (String(applyKey || '') === 'CURRENT_BALANCE' && applyContext) {
    return applyContext.hasMonthValue ? applyContext.monthBalance : 0;
  }
  return plaidImportCurrentLegacyValue_(legacy, applyKey);
}

function plaidImportCashCandidatesHashPayload_(accountPreview) {
  var row = plaidImportFindPreviewRow_(accountPreview.rows || [], 'CURRENT_BALANCE');
  if (!row || !row.candidate) return {};
  return { CURRENT_BALANCE: row.candidate.numericValue };
}

function plaidImportCandidatesHashPayload_(accountPreview, aprPref, domain) {
  if (String(domain || '').toUpperCase() === 'CASH') {
    return plaidImportCashCandidatesHashPayload_(accountPreview);
  }
  var rows = accountPreview.rows || [];
  var byType = {};
  rows.forEach(function(row) {
    if (row && row.factType && row.candidate) byType[row.factType] = row.candidate;
  });
  var out = {};
  ['CURRENT_BALANCE', 'CREDIT_LIMIT', 'MINIMUM_PAYMENT', 'NEXT_PAYMENT_DATE'].forEach(function(key) {
    if (!byType[key]) return;
    var candidate = byType[key];
    out[key] = candidate.numericValue !== undefined && candidate.numericValue !== null
      ? candidate.numericValue
      : (candidate.textValue || candidate.value || '');
  });
  if (aprPref && aprPref.sourceSemantic && byType[aprPref.sourceSemantic]) {
    out.INT_RATE = {
      semantic: aprPref.sourceSemantic,
      value: byType[aprPref.sourceSemantic].numericValue
    };
  }
  return out;
}

function plaidImportFactsHashPayloadForDomain_(legacy, domain, applyContext) {
  if (String(domain || '').toUpperCase() === 'CASH') {
    return plaidImportCashFactsHashPayload_(legacy, applyContext);
  }
  return plaidImportFactsHashPayload_(legacy);
}

function plaidImportAccountReviewObservedAt_(connectionObservedAt, accountKey, stableAccountId,
  candidateHash, baselineFactsHash) {
  return plaidImportStableJsonHash_({
    v: 1,
    connectionObservedAt: String(connectionObservedAt || ''),
    protectedAccountKey: String(accountKey || ''),
    stableAccountId: String(stableAccountId || ''),
    candidateHash: String(candidateHash || ''),
    baselineFactsHash: String(baselineFactsHash || '')
  });
}

function plaidImportCreateReviewBaseline_(accountPreview, aprPref, connectionObservedAt, domain,
  accountKey) {
  var reviewDomain = String(domain || '').toUpperCase();
  var legacy = accountPreview.cashCompassLegacy || {};
  var stableAccountId = String(accountPreview.mapping && accountPreview.mapping.stableAccountId || '');
  var resolvedAccountKey = String(accountKey || accountPreview.protectedAccountKey || '');
  var baselineFactsHash = plaidImportStableJsonHash_(
    plaidImportFactsHashPayloadForDomain_(legacy, reviewDomain,
      accountPreview.cashCompassApplyContext || null));
  var candidateHash = plaidImportStableJsonHash_(
    plaidImportCandidatesHashPayload_(accountPreview, aprPref, reviewDomain));
  return {
    observedAt: plaidImportAccountReviewObservedAt_(connectionObservedAt, resolvedAccountKey,
      stableAccountId, candidateHash, baselineFactsHash),
    stableAccountId: stableAccountId,
    baselineFactsHash: baselineFactsHash,
    candidateHash: candidateHash
  };
}

function plaidImportStoreReviewBaseline_(connectionKey, accountKey, stableAccountId, baseline) {
  var existing = plaidImportLoadReviewBaseline_(connectionKey, accountKey, stableAccountId);
  if (existing && existing.observedAt === baseline.observedAt &&
      existing.baselineFactsHash === baseline.baselineFactsHash &&
      existing.candidateHash === baseline.candidateHash &&
      String(existing.stableAccountId || '') === String(baseline.stableAccountId || '')) {
    return;
  }
  PropertiesService.getUserProperties().setProperty(
    plaidImportReviewBaselineStorageKey_(connectionKey, accountKey, stableAccountId),
    JSON.stringify(baseline));
}

function plaidImportLoadReviewBaseline_(connectionKey, accountKey, stableAccountId) {
  var raw = PropertiesService.getUserProperties().getProperty(
    plaidImportReviewBaselineStorageKey_(connectionKey, accountKey, stableAccountId));
  if (!raw) return null;
  try {
    var parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (_e) {
    return null;
  }
}

function plaidImportFindPreviewRow_(rows, factType) {
  return (rows || []).filter(function(row) {
    return row && String(row.factType || '') === String(factType || '');
  })[0] || null;
}

function plaidImportDueDayFromIso_(value) {
  var match = String(value || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  var day = parseInt(match[3], 10);
  return day >= 1 && day <= 31 ? day : null;
}

function plaidImportParseDueDayFromLegacy_(value) {
  if (value === null || value === undefined || value === '') return null;
  var str = String(value).trim();
  var plain = str.match(/^(\d{1,2})(?:st|nd|rd|th)?$/i);
  if (plain) {
    var day = parseInt(plain[1], 10);
    if (day >= 1 && day <= 31) return day;
  }
  var asNum = parseInt(str, 10);
  if (!isNaN(asNum) && asNum >= 1 && asNum <= 31 && String(asNum) === str) return asNum;
  var iso = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return parseInt(iso[3], 10);
  return null;
}

function plaidImportDebtApplyValuesEqual_(applyKey, currentRaw, proposedValue) {
  if (applyKey === 'NEXT_PAYMENT_DATE') {
    return plaidImportParseDueDayFromLegacy_(currentRaw) === proposedValue;
  }
  if (applyKey === 'INT_RATE') {
    return round2_(toNumber_(currentRaw)) === round2_(toNumber_(proposedValue));
  }
  return round2_(toNumber_(currentRaw)) === round2_(toNumber_(proposedValue));
}

function plaidImportResolveDebtAccountName_(stableAccountId) {
  var registry = plaidImportRequestRegistry_();
  var target = (registry.accounts || []).filter(function(row) {
    return String(row.stableAccountId || '') === stableAccountId;
  })[0];
  if (!target || String(target.legacyDomain || '').toUpperCase() !== 'INPUT_DEBTS') {
    throw new Error('CashCompass debt account is unavailable.');
  }
  var accountName = String(target.legacyKey || '').trim();
  if (!accountName) throw new Error('CashCompass debt account is unavailable.');
  return accountName;
}

function plaidImportResolveDebtApplyValue_(applyKey, accountPreview, aprPref) {
  var rows = accountPreview.rows || [];
  if (applyKey === 'INT_RATE') {
    if (!aprPref || !aprPref.sourceSemantic) {
      throw new Error('APR source must be selected before applying Int Rate.');
    }
    var aprRow = plaidImportFindPreviewRow_(rows, aprPref.sourceSemantic);
    if (!aprRow || !aprRow.candidate) {
      throw new Error('Selected APR source is unavailable. Import Data again.');
    }
    return {
      value: Number(aprRow.candidate.numericValue),
      sourceSemantic: aprPref.sourceSemantic
    };
  }
  if (applyKey === 'NEXT_PAYMENT_DATE') {
    var dateRow = plaidImportFindPreviewRow_(rows, 'NEXT_PAYMENT_DATE');
    if (!dateRow || !dateRow.candidate) throw new Error('Due Date import is unavailable.');
    var day = plaidImportDueDayFromIso_(dateRow.candidate.textValue || dateRow.candidate.value);
    if (day === null) throw new Error('Due Date import is unavailable.');
    return { value: day };
  }
  var row = plaidImportFindPreviewRow_(rows, applyKey);
  if (!row || !row.candidate) throw new Error('Imported value is unavailable.');
  return { value: Number(row.candidate.numericValue) };
}

function plaidImportCurrentLegacyValue_(legacy, applyKey) {
  if (applyKey === 'INT_RATE') {
    var apr = legacy && legacy.APR;
    return apr && Object.prototype.hasOwnProperty.call(apr, 'value') ? apr.value : apr;
  }
  if (applyKey === 'NEXT_PAYMENT_DATE') {
    var due = legacy && legacy.NEXT_PAYMENT_DATE;
    var raw = due && Object.prototype.hasOwnProperty.call(due, 'value') ? due.value : due;
    return plaidImportParseDueDayFromLegacy_(raw);
  }
  var entry = legacy && legacy[applyKey];
  return entry && Object.prototype.hasOwnProperty.call(entry, 'value') ? entry.value : entry;
}

function plaidImportFormatApplyDisplay_(applyKey, value, sourceSemantic) {
  if (applyKey === 'INT_RATE') {
    return round2_(toNumber_(value)).toFixed(2) + '%';
  }
  if (applyKey === 'NEXT_PAYMENT_DATE') {
    return String(value);
  }
  var num = round2_(toNumber_(value));
  return '$' + num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function plaidImportRejectApplyFinancialAuthority_(input) {
  ['value', 'values', 'accountName', 'fieldName', 'newValue', 'previousValue',
    'rowNumber', 'sheetRow', 'providerAccountId', 'itemId', 'accessToken'].forEach(function(field) {
    if (Object.prototype.hasOwnProperty.call(input || {}, field)) {
      throw new Error('Browser-provided financial values are not accepted.');
    }
  });
}

function plaidImportApplyDebtUpdates(payload) {
  try {
    var input = payload && typeof payload === 'object' ? payload : {};
    plaidImportRejectBrowserAuthority_(input);
    return plaidImportApplyDebtUpdates_(payload);
  } catch (error) {
    var message = String(error && error.message || '');
    if (/Browser-provided|Import Data again|APR source must be selected|cannot be applied|not accepted|unavailable for apply/i.test(message)) {
      return { ok: false, error: message };
    }
    if (message === 'FINANCIAL_IDENTITY_REVIEW_REQUIRED') {
      return { ok: false, error: PLAID_IMPORT_IDENTITY_REVIEW_ERROR_ };
    }
    return { ok: false, error: PLAID_IMPORT_PUBLIC_ERROR_ };
  }
}

function plaidImportApplyDebtUpdates_(payload) {
  var timing = plaidImportApplyTimingCreate_();
  var input = payload && typeof payload === 'object' ? payload : {};
  plaidImportRejectBrowserAuthority_(input);
  plaidImportRejectApplyFinancialAuthority_(input);
  plaidImportAssertAllowed_();
  timing.mark('entryAuth');
  var connectionKey = String(input.protectedConnectionKey || '');
  var accountKey = String(input.protectedAccountKey || '');
  var stableAccountId = String(input.stableAccountId || '');
  var reviewObservedAt = String(input.reviewObservedAt || '');
  var selectedKeys = Array.isArray(input.selectedApplyKeys) ? input.selectedApplyKeys : [];
  if (!connectionKey || !accountKey || !stableAccountId || !reviewObservedAt) {
    throw new Error('Apply request is incomplete. Import Data again.');
  }
  if (!selectedKeys.length) throw new Error('Select at least one field to apply.');
  selectedKeys.forEach(function(key) {
    if (!PLAID_IMPORT_DEBT_APPLY_KEYS_[String(key || '')]) {
      throw new Error('Selected field cannot be applied: ' + key);
    }
  });
  try {
    plaidImportBeginRequestSession_();
    var mappings = plaidImportReadMappings_();
    timing.mark('mappingLoad');
    var previewResult = plaidImportFetchPreviewMappedCore_(connectionKey, {
      mappings: mappings,
      persistBaselines: false,
      targetProtectedAccountKey: accountKey,
      timing: timing
    });
    timing.mark('previewRevalidation');
    var connection = previewResult.connection;
    var account = (connection.accounts || []).filter(function(row) {
      return String(row.protectedAccountKey || '') === accountKey;
    })[0];
    if (!account || String(connection.lifecycleStatus || '') !== 'ACTIVE') {
      throw new Error('Connected account is unavailable.');
    }
    var mapping = plaidImportMappingState_(connection, account, mappings);
    if (mapping.status !== 'CONFIRMED' || String(mapping.stableAccountId || '') !== stableAccountId) {
      throw new Error('CashCompass account association must be confirmed before Apply.');
    }
    var canonicalTarget = plaidImportCanonicalTarget_(stableAccountId, account);
    if (String(canonicalTarget.domain || '').toUpperCase() !== 'DEBT') {
      throw new Error('Apply is available for Debt accounts only.');
    }
    timing.mark('accountValidation');
    var baseline = plaidImportLoadReviewBaseline_(connectionKey, accountKey, stableAccountId);
    if (!baseline || baseline.observedAt !== reviewObservedAt ||
        String(baseline.stableAccountId || '') !== stableAccountId) {
      throw new Error('Review is stale. Import Data again.');
    }
    var accountPreview = (previewResult.accounts || []).filter(function(row) {
      return String(row.protectedAccountKey || '') === accountKey;
    })[0];
    if (!accountPreview) throw new Error('Imported preview is unavailable. Import Data again.');
    var aprPref = accountPreview.aprSourcePreference || null;
    var currentLegacy = accountPreview.cashCompassLegacy || {};
    if (plaidImportStableJsonHash_(plaidImportFactsHashPayloadForDomain_(currentLegacy, 'DEBT')) !== baseline.baselineFactsHash) {
      throw new Error('CashCompass values changed since review. Import Data again.');
    }
    if (plaidImportStableJsonHash_(plaidImportCandidatesHashPayload_(accountPreview, aprPref, 'DEBT')) !== baseline.candidateHash) {
      throw new Error('Imported values changed since review. Import Data again.');
    }
    timing.mark('freshnessValidation');
    var accountName = String(canonicalTarget.legacyKey || '').trim();
    if (!accountName) throw new Error('CashCompass debt account is unavailable.');
    var plan = [];
    selectedKeys.forEach(function(applyKey) {
      var resolved = plaidImportResolveDebtApplyValue_(applyKey, accountPreview, aprPref);
      var currentRaw = plaidImportCurrentLegacyValue_(currentLegacy, applyKey);
      if (plaidImportDebtApplyValuesEqual_(applyKey, currentRaw, resolved.value)) return;
      var fieldName = PLAID_IMPORT_DEBT_APPLY_WRITERS_[applyKey];
      plan.push({
        applyKey: applyKey,
        fieldName: fieldName,
        value: resolved.value,
        sourceSemantic: resolved.sourceSemantic || '',
        previousDisplay: plaidImportFormatApplyDisplay_(applyKey, currentRaw, resolved.sourceSemantic),
        newDisplay: plaidImportFormatApplyDisplay_(applyKey, resolved.value, resolved.sourceSemantic)
      });
    });
    if (!plan.length) throw new Error('No changes are available to apply.');
    timing.mark('planBuild');
    var applied = [];
    plaidImportBeginDebtApplyWriteSession_(accountName);
    try {
      for (var i = 0; i < plan.length; i++) {
        var item = plan[i];
        try {
          updateDebtField({
            accountName: accountName,
            fieldName: item.fieldName,
            value: item.value,
            plaidImportApplyBatch: true,
            importProvenance: {
              source: 'PLAID',
              sourceSemantic: item.sourceSemantic || ''
            }
          });
          applied.push({
            applyKey: item.applyKey,
            fieldName: item.fieldName,
            previousDisplay: item.previousDisplay,
            newDisplay: item.newDisplay,
            sourceSemantic: item.sourceSemantic || ''
          });
        } catch (writeError) {
          var partialMessage = applied.length
            ? 'Apply stopped after updating ' + applied.length + ' field(s). Import Data and review again.'
            : String(writeError && writeError.message || PLAID_IMPORT_PUBLIC_ERROR_);
          return {
            ok: false,
            error: partialMessage,
            partialApplied: applied,
            stageTimingMs: timing.finish()
          };
        }
      }
    } finally {
      plaidImportEndDebtApplyWriteSession_();
    }
    timing.mark('canonicalWrites');
    var refreshNotice = plaidImportRefreshPreviewAccountAfterApplySafe_(previewResult, connectionKey,
      accountKey, stableAccountId, connection, mappings);
    timing.mark('postWritePreviewPatch');
    return {
      ok: true,
      appliedCount: applied.length,
      applied: applied,
      preview: previewResult,
      refreshNotice: refreshNotice || undefined,
      stageTimingMs: timing.finish()
    };
  } finally {
    plaidImportEndRequestSession_();
  }
}

function plaidImportBalanceDateFromPreview_(balanceRow, previewResult) {
  var raw = balanceRow && (balanceRow.effectiveAsOf ||
    (balanceRow.candidate && balanceRow.candidate.providerEffectiveAsOf) || '');
  var match = String(raw || '').trim().match(/^(\d{4}-\d{2}-\d{2})/);
  if (match) return match[1];
  return previewResult.reviewAnchorDate || plaidImportReviewAnchorDate_();
}

function plaidImportResolveCashApplyValue_(accountPreview) {
  var row = plaidImportFindPreviewRow_(accountPreview.rows || [], 'CURRENT_BALANCE');
  if (!row || !row.candidate) throw new Error('Imported value is unavailable.');
  return {
    value: Number(row.candidate.numericValue),
    observedAt: String(row.candidate.observedAt || row.observedAt || ''),
    effectiveAsOf: String(row.effectiveAsOf || row.candidate.providerEffectiveAsOf || '')
  };
}

function plaidImportResolveCashAccountName_(stableAccountId) {
  var registry = plaidImportRequestRegistry_();
  var target = (registry.accounts || []).filter(function(row) {
    return String(row.stableAccountId || '') === stableAccountId;
  })[0];
  if (!target || String(target.legacyDomain || '').toUpperCase() !== 'SYS_ACCOUNTS') {
    throw new Error('CashCompass bank account is unavailable.');
  }
  var accountName = String(target.legacyKey || '').trim();
  if (!accountName) throw new Error('CashCompass bank account is unavailable.');
  return accountName;
}

function plaidImportCashApplyValuesEqual_(currentRaw, proposedValue) {
  return round2_(toNumber_(currentRaw)) === round2_(toNumber_(proposedValue));
}

function plaidImportApplyCashUpdates(payload) {
  try {
    var input = payload && typeof payload === 'object' ? payload : {};
    plaidImportRejectBrowserAuthority_(input);
    return plaidImportApplyCashUpdates_(payload);
  } catch (error) {
    var message = String(error && error.message || '');
    if (/Browser-provided|Import Data again|cannot be applied|not accepted|unavailable for apply/i.test(message)) {
      return { ok: false, error: message };
    }
    if (message === 'FINANCIAL_IDENTITY_REVIEW_REQUIRED') {
      return { ok: false, error: PLAID_IMPORT_IDENTITY_REVIEW_ERROR_ };
    }
    return { ok: false, error: PLAID_IMPORT_PUBLIC_ERROR_ };
  }
}

function plaidImportApplyCashUpdates_(payload) {
  var timing = plaidImportApplyTimingCreate_();
  var input = payload && typeof payload === 'object' ? payload : {};
  plaidImportRejectBrowserAuthority_(input);
  plaidImportRejectApplyFinancialAuthority_(input);
  plaidImportAssertAllowed_();
  timing.mark('entryAuth');
  var connectionKey = String(input.protectedConnectionKey || '');
  var accountKey = String(input.protectedAccountKey || '');
  var stableAccountId = String(input.stableAccountId || '');
  var reviewObservedAt = String(input.reviewObservedAt || '');
  var selectedKeys = Array.isArray(input.selectedApplyKeys) ? input.selectedApplyKeys : [];
  if (!connectionKey || !accountKey || !stableAccountId || !reviewObservedAt) {
    throw new Error('Apply request is incomplete. Import Data again.');
  }
  if (!selectedKeys.length) throw new Error('Select at least one field to apply.');
  selectedKeys.forEach(function(key) {
    if (!PLAID_IMPORT_CASH_APPLY_KEYS_[String(key || '')]) {
      throw new Error('Selected field cannot be applied: ' + key);
    }
  });
  try {
    plaidImportBeginRequestSession_();
    var mappings = plaidImportReadMappings_();
    timing.mark('mappingLoad');
    var previewResult = plaidImportFetchPreviewMappedCore_(connectionKey, {
      mappings: mappings,
      persistBaselines: false,
      targetProtectedAccountKey: accountKey,
      timing: timing
    });
    timing.mark('previewRevalidation');
    var connection = previewResult.connection;
  var account = (connection.accounts || []).filter(function(row) {
    return String(row.protectedAccountKey || '') === accountKey;
  })[0];
  if (!account || String(connection.lifecycleStatus || '') !== 'ACTIVE') {
    throw new Error('Connected account is unavailable.');
  }
  var mapping = plaidImportMappingState_(connection, account, mappings);
  if (mapping.status !== 'CONFIRMED' || String(mapping.stableAccountId || '') !== stableAccountId) {
    throw new Error('CashCompass account association must be confirmed before Apply.');
  }
  var canonicalTarget = plaidImportCanonicalTarget_(stableAccountId, account);
  if (String(canonicalTarget.domain || '').toUpperCase() !== 'CASH') {
    throw new Error('Apply is available for Bank accounts only.');
  }
  timing.mark('accountValidation');
  var baseline = plaidImportLoadReviewBaseline_(connectionKey, accountKey, stableAccountId);
  if (!baseline || baseline.observedAt !== reviewObservedAt ||
      String(baseline.stableAccountId || '') !== stableAccountId) {
    throw new Error('Review is stale. Import Data again.');
  }
  var accountPreview = (previewResult.accounts || []).filter(function(row) {
    return String(row.protectedAccountKey || '') === accountKey;
  })[0];
  if (!accountPreview) throw new Error('Imported preview is unavailable. Import Data again.');
  var currentLegacy = accountPreview.cashCompassLegacy || {};
  if (plaidImportStableJsonHash_(plaidImportFactsHashPayloadForDomain_(currentLegacy, 'CASH',
      accountPreview.cashCompassApplyContext || null)) !== baseline.baselineFactsHash) {
    throw new Error('CashCompass values changed since review. Import Data again.');
  }
  if (plaidImportStableJsonHash_(plaidImportCandidatesHashPayload_(accountPreview, null, 'CASH')) !== baseline.candidateHash) {
    throw new Error('Imported values changed since review. Import Data again.');
  }
  timing.mark('freshnessValidation');
  var accountName = plaidImportResolveCashAccountName_(stableAccountId);
  var plan = [];
  selectedKeys.forEach(function(applyKey) {
    var resolved = plaidImportResolveCashApplyValue_(accountPreview);
    var currentRaw = plaidImportCurrentCashApplyValue_(currentLegacy,
      accountPreview.cashCompassApplyContext || null, applyKey);
    if (plaidImportCashApplyValuesEqual_(currentRaw, resolved.value)) return;
    var balanceRow = plaidImportFindPreviewRow_(accountPreview.rows || [], 'CURRENT_BALANCE');
    plan.push({
      applyKey: applyKey,
      fieldName: 'Current Balance',
      value: resolved.value,
      balanceDate: plaidImportBalanceDateFromPreview_(balanceRow, previewResult),
      previousDisplay: plaidImportFormatApplyDisplay_(applyKey, currentRaw),
      newDisplay: plaidImportFormatApplyDisplay_(applyKey, resolved.value),
      observedAt: resolved.observedAt,
      effectiveAsOf: resolved.effectiveAsOf
    });
  });
  if (!plan.length) throw new Error('No changes are available to apply.');
  timing.mark('planBuild');
  var applied = [];
  for (var i = 0; i < plan.length; i++) {
    var item = plan[i];
    try {
      updateBankAccountValueByDate_({
        accountName: accountName,
        balanceDate: item.balanceDate,
        currentValue: item.value,
        updateAvailableNow: false,
        updateMinBuffer: false
      }, {
        source: 'PLAID',
        environment: plaidImportEnvironment_(),
        provider: 'PLAID',
        factType: item.applyKey,
        observedAt: item.observedAt,
        effectiveAsOf: item.effectiveAsOf,
        protectedExternalAccountIdentity: ''
      });
      applied.push({
        applyKey: item.applyKey,
        fieldName: item.fieldName,
        previousDisplay: item.previousDisplay,
        newDisplay: item.newDisplay
      });
    } catch (writeError) {
      var partialMessage = applied.length
        ? 'Apply stopped after updating ' + applied.length + ' field(s). Import Data and review again.'
        : String(writeError && writeError.message || PLAID_IMPORT_PUBLIC_ERROR_);
      return {
        ok: false,
        error: partialMessage,
        partialApplied: applied,
        stageTimingMs: timing.finish()
      };
    }
  }
    timing.mark('canonicalWrites');
    var refreshNotice = plaidImportRefreshPreviewAccountAfterApplySafe_(previewResult, connectionKey,
      accountKey, stableAccountId, connection, mappings);
    timing.mark('postWritePreviewPatch');
    return {
      ok: true,
      appliedCount: applied.length,
      applied: applied,
      preview: previewResult,
      refreshNotice: refreshNotice || undefined,
      stageTimingMs: timing.finish()
    };
  } finally {
    plaidImportEndRequestSession_();
  }
}

function plaidImportDisconnect(payload) {
  return plaidImportSafe_(function() {
    var input = payload && typeof payload === 'object' ? payload : {};
    plaidImportRejectBrowserAuthority_(input);
    return plaidImportRequest_('POST', '/v1/disconnect', 'DISCONNECT', {
      protectedConnectionKey: String(input.protectedConnectionKey || '')
    });
  });
}

function plaidImportDiagnosticAssertAdmin_() {
  var email = String(getCurrentUserEmail_() || '').trim().toLowerCase();
  if (email !== PLAID_IMPORT_SOLE_ADMIN_EMAIL_ || !isAdminUser_()) {
    throw new Error('Plaid import diagnostics are restricted to the sole administrator.');
  }
}

function plaidImportDiagnosticFail_(stage, code) {
  return {
    ok: false,
    stage: String(stage || 'UNKNOWN'),
    code: String(code || 'UNKNOWN'),
    PLAID_DIAGNOSTIC_STAGE: String(stage || 'UNKNOWN'),
    PLAID_DIAGNOSTIC_CODE: String(code || 'UNKNOWN')
  };
}

function plaidImportDiagnosticSanitizeCode_(message) {
  var text = String(message || '');
  if (/unavailable for this account/i.test(text)) return 'IMPORT_UNAVAILABLE';
  if (/workbook is unavailable/i.test(text)) return 'WORKBOOK_UNAVAILABLE';
  if (/user is unavailable|user identity is unavailable/i.test(text)) return 'OWNER_IDENTITY';
  if (/environment is unavailable/i.test(text)) return 'ENVIRONMENT_INVALID';
  if (/deployment configuration is incomplete/i.test(text)) return 'CONFIG_INCOMPLETE';
  if (/backend URL is invalid/i.test(text)) return 'BACKEND_URL_INVALID';
  if (/do not have permission to call urlfetchapp/i.test(text)) return 'EXTERNAL_REQUEST_DENIED';
  if (/request failed/i.test(text)) return 'BACKEND_REQUEST_FAILED';
  if (/signature|private key|invalid key/i.test(text)) return 'SIGNING_KEY_INVALID';
  return 'UNCLASSIFIED';
}

function plaidImportBoundedDiagnostic_() {
  try {
    plaidImportDiagnosticAssertAdmin_();
  } catch (_e) {
    return plaidImportDiagnosticFail_('ADMIN_ONLY', 'ADMIN_DENIED');
  }

  var props = PropertiesService.getScriptProperties();
  if (props.getProperty(PLAID_IMPORT_ENABLED_KEY_) !== 'true') {
    return plaidImportDiagnosticFail_('CONFIG_ENABLED', 'IMPORT_DISABLED');
  }

  try {
    plaidImportRuntimeMode_();
  } catch (_e) {
    return plaidImportDiagnosticFail_('CONFIG_ENVIRONMENT', 'RUNTIME_UNSUPPORTED');
  }

  try {
    var context = plaidImportRuntimeContext_();
    if (context.mode !== 'BOUNDED' && context.mode !== 'CENTRAL') {
      return plaidImportDiagnosticFail_('CONFIG_ENVIRONMENT', 'RUNTIME_UNSUPPORTED');
    }
  } catch (error) {
    var contextCode = plaidImportDiagnosticSanitizeCode_(error && error.message);
    var contextStage = /workbook/i.test(String(error && error.message || ''))
      ? 'WORKBOOK' : 'OWNER_IDENTITY';
    return plaidImportDiagnosticFail_(contextStage, contextCode);
  }

  try {
    plaidImportEnvironment_();
  } catch (_e) {
    return plaidImportDiagnosticFail_('CONFIG_ENVIRONMENT', 'ENVIRONMENT_INVALID');
  }

  var environment = plaidImportEnvironment_();
  var keyId = String(props.getProperty('PLAID_' + environment + '_ASSERTION_KEY_ID') || '').trim();
  var privateKeyRaw = String(props.getProperty('PLAID_' + environment + '_ASSERTION_PRIVATE_KEY_PEM') || '').trim();
  var backendUrl = String(props.getProperty('PLAID_' + environment + '_BACKEND_URL') || '').trim();
  if (!keyId) return plaidImportDiagnosticFail_('CONFIG_SIGNING_KEY', 'KEY_ID_MISSING');
  if (!privateKeyRaw) return plaidImportDiagnosticFail_('CONFIG_SIGNING_KEY', 'PRIVATE_KEY_MISSING');
  if (!backendUrl) return plaidImportDiagnosticFail_('CONFIG_BACKEND_URL', 'BACKEND_URL_MISSING');
  if (!/^https:\/\/[a-z0-9-]+(?:-[a-z0-9]+)?\.[a-z0-9-]+\.run\.app$/i.test(backendUrl)) {
    return plaidImportDiagnosticFail_('CONFIG_BACKEND_URL', 'BACKEND_URL_INVALID');
  }

  var privateKey = '';
  try {
    privateKey = plaidImportNormalizePrivateKeyPem_(privateKeyRaw);
  } catch (_e) {
    return plaidImportDiagnosticFail_('ASSERTION_CREATE', 'SIGNING_KEY_INVALID');
  }

  var assertion = '';
  try {
    assertion = plaidImportAssertion_('CONNECTIONS_LIST', '');
  } catch (error) {
    return plaidImportDiagnosticFail_('ASSERTION_CREATE',
      plaidImportDiagnosticSanitizeCode_(error && error.message));
  }

  var response = null;
  try {
    response = UrlFetchApp.fetch(backendUrl.replace(/\/$/, '') + '/v1/connections', {
      method: 'get',
      muteHttpExceptions: true,
      headers: { 'X-CashCompass-Assertion': assertion }
    });
  } catch (error) {
    var fetchCode = plaidImportDiagnosticSanitizeCode_(error && error.message);
    var fetchStage = fetchCode === 'EXTERNAL_REQUEST_DENIED' ? 'EXTERNAL_REQUEST' : 'BACKEND_REQUEST';
    return plaidImportDiagnosticFail_(fetchStage, fetchCode);
  }

  var status = response.getResponseCode();
  var parsed = null;
  try { parsed = JSON.parse(response.getContentText() || '{}'); } catch (_e) {}
  if (status < 200 || status >= 300 || !parsed || parsed.ok === false) {
    var backendCode = String(parsed && parsed.error || parsed && parsed.reasonCode || ('HTTP_' + status));
    backendCode = backendCode.replace(/[^A-Z0-9_]/gi, '_').slice(0, 64) || ('HTTP_' + status);
    return plaidImportDiagnosticFail_(status === 401 || status === 403 ? 'BACKEND_AUTH' : 'CONNECTION_LIST',
      backendCode);
  }

  try {
    var mappings = plaidImportRequest_('GET', '/v1/mappings', 'MAPPINGS_LIST', null);
    if (!mappings || mappings.ok === false) {
      return plaidImportDiagnosticFail_('MAPPING_LIST', 'MAPPINGS_UNAVAILABLE');
    }
  } catch (error) {
    return plaidImportDiagnosticFail_('MAPPING_LIST', plaidImportDiagnosticSanitizeCode_(error && error.message));
  }

  try {
    var targets = plaidImportComparisonTargets();
    if (!targets || targets.ok !== true) {
      return plaidImportDiagnosticFail_('COMPARISON_TARGETS', 'TARGETS_UNAVAILABLE');
    }
  } catch (error) {
    return plaidImportDiagnosticFail_('COMPARISON_TARGETS', plaidImportDiagnosticSanitizeCode_(error && error.message));
  }

  return {
    ok: true,
    stage: 'READY',
    code: 'OK',
    PLAID_DIAGNOSTIC_STAGE: 'READY',
    PLAID_DIAGNOSTIC_CODE: 'OK',
    BACKEND_REACHED: 'YES',
    comparisonTargetCount: (targets.targets || []).length,
    registryAccountCount: (financialIdentityReadExplicitComparisonAccounts_(plaidImportWorkbook_()).accounts || []).length,
    inputDebtsActiveCount: plaidImportActiveInputDebtCount_(plaidImportWorkbook_())
  };
}

function plaidImportActiveInputDebtCount_() {
  var ss = arguments[0] || plaidImportWorkbook_();
  var sheet = ss.getSheetByName(getSheetNames_().DEBTS);
  if (!sheet || sheet.getLastRow() < 2) return 0;
  var display = sheet.getDataRange().getDisplayValues();
  var headers = display[0] || [];
  var nameCol = headers.indexOf('Account Name');
  var activeCol = headers.indexOf('Active');
  var count = 0;
  for (var r = 1; r < display.length; r++) {
    var name = nameCol === -1 ? '' : String(display[r][nameCol] || '').trim();
    if (!name || /^total debt$/i.test(name)) continue;
    var active = activeCol === -1 ? '' : String(display[r][activeCol] || '').trim();
    if (['no', 'n', 'false', 'inactive'].indexOf(active.toLowerCase()) !== -1) continue;
    count += 1;
  }
  return count;
}

function runPlaidImportComparisonTargetAudit() {
  if (String(getCurrentUserEmail_() || '').toLowerCase() !== PLAID_IMPORT_SOLE_ADMIN_EMAIL_) {
    throw new Error('Comparison target audit is unavailable.');
  }
  plaidImportAssertAllowed_();
  var ss = plaidImportWorkbook_();
  var registry = financialIdentityReadExplicitComparisonAccounts_(ss);
  var targets = plaidImportComparisonTargets();
  var manualTargetIds = Object.create(null);
  (targets.targets || []).forEach(function(target) {
    manualTargetIds[String(target.stableAccountId || '')] = true;
  });
  var result = {
    ok: true,
    comparisonTargetCount: (targets.targets || []).length,
    registryAccountCount: (registry.accounts || []).length,
    inputDebtsActiveCount: plaidImportActiveInputDebtCount_(ss),
    manualDebtCount: (getDebtsUiData().debts || []).length,
    manualBankCount: (getBankAccountUiData().accounts || []).length,
    manualInvestmentCount: (getInvestmentUiData().accounts || []).length,
    accounts: (registry.accounts || []).map(function(account) {
      return {
        stableAccountId: account.stableAccountId,
        domain: String(account.domain || '').toUpperCase(),
        accountType: account.accountType || '',
        ownerId: account.ownerId || '',
        identityStatus: account.identityStatus || '',
        legacyDomain: account.legacyDomain || '',
        active: account.active || '',
        eligible: !!manualTargetIds[String(account.stableAccountId || '')]
      };
    })
  };
  console.log(JSON.stringify(result));
  return result;
}

function runPlaidImportBoundedDiagnostic() {
  var result = plaidImportBoundedDiagnostic_();
  console.log(JSON.stringify(result));
  return result;
}

function plaidImportIdentitySelfInitSanitizeCode_(message) {
  var text = String(message || '');
  if (text === 'FINANCIAL_IDENTITY_REVIEW_REQUIRED') return 'IDENTITY_REVIEW_REQUIRED';
  if (/Identity preview changed/i.test(text)) return 'IDENTITY_PREVIEW_CHANGED';
  if (/must be "/.test(text) && /No changes were made/.test(text)) return 'IDENTITY_SHEET_HEADER_MISMATCH';
  if (/workbook is unavailable/i.test(text)) return 'WORKBOOK_UNAVAILABLE';
  if (/account identity is unavailable/i.test(text)) return 'IDENTITY_LOCK_UNAVAILABLE';
  return 'UNCLASSIFIED';
}

function runPlaidImportIdentitySelfInitDiagnostic() {
  try {
    plaidImportDiagnosticAssertAdmin_();
  } catch (_e) {
    return plaidImportDiagnosticFail_('ADMIN_ONLY', 'ADMIN_DENIED');
  }
  var ss = plaidImportWorkbook_();
  var out = {
    ok: true,
    stage: 'READY',
    code: 'OK',
    registryAccountCount: 0,
    financialAccountsExists: false,
    financialAccountsLastRow: 0,
    accountSourceLinksExists: false,
    accountSourceLinksLastRow: 0,
    previewDigest: '',
    previewPendingCount: 0,
    previewConflictCount: 0,
    previewSourceLinkCount: 0,
    digestChangedUnderLock: false,
    headerCreationInvalidatesDigest: false
  };
  var accountsSheet = ss.getSheetByName(getSheetNames_().FINANCIAL_ACCOUNTS);
  var linksSheet = ss.getSheetByName(getSheetNames_().ACCOUNT_SOURCE_LINKS);
  out.financialAccountsExists = !!accountsSheet;
  out.financialAccountsLastRow = accountsSheet ? accountsSheet.getLastRow() : 0;
  out.accountSourceLinksExists = !!linksSheet;
  out.accountSourceLinksLastRow = linksSheet ? linksSheet.getLastRow() : 0;
  out.registryAccountCount = (financialIdentityReadRegistry_(ss).accounts || []).length;

  var preview = null;
  try {
    preview = buildFinancialIdentityFoundationPreview_(ss);
    out.previewDigest = String(preview.digest || '');
    out.previewPendingCount = financialIdentityFoundationPendingCount_(preview.summary);
    out.previewConflictCount = Number(preview.summary && preview.summary.conflicts || 0);
    out.previewSourceLinkCount = (preview.accounts || []).filter(function(row) {
      return row.action !== 'EXISTING' && row.action !== 'CONFLICT' &&
        row.sourceLink && row.sourceLink.sourceAccountKey;
    }).length;
  } catch (error) {
    return Object.assign(out, plaidImportDiagnosticFail_('IDENTITY_PREVIEW',
      plaidImportIdentitySelfInitSanitizeCode_(error && error.message)));
  }

  if (!accountsSheet) {
    try {
      ensureFinancialAccountsSheet_(ss);
      var afterHeaderPreview = buildFinancialIdentityFoundationPreview_(ss);
      out.headerCreationInvalidatesDigest =
        String(afterHeaderPreview.digest || '') !== out.previewDigest;
    } catch (error) {
      return Object.assign(out, plaidImportDiagnosticFail_('IDENTITY_ENSURE_ACCOUNTS',
        plaidImportIdentitySelfInitSanitizeCode_(error && error.message)));
    } finally {
      var probeSheet = ss.getSheetByName(getSheetNames_().FINANCIAL_ACCOUNTS);
      if (probeSheet && probeSheet.getLastRow() < 2) {
        try { ss.deleteSheet(probeSheet); } catch (_deleteErr) { /* diagnostic probe only */ }
      }
    }
  } else {
    try {
      ensureFinancialAccountsSheet_(ss);
    } catch (error) {
      return Object.assign(out, plaidImportDiagnosticFail_('IDENTITY_ENSURE_ACCOUNTS',
        plaidImportIdentitySelfInitSanitizeCode_(error && error.message)));
    }
  }

  try {
    var lock = LockService.getDocumentLock();
    lock.waitLock(30000);
    try {
      var lockedPreview = buildFinancialIdentityFoundationPreview_(ss);
      out.digestChangedUnderLock =
        String(lockedPreview.digest || '') !== out.previewDigest;
      preview = lockedPreview;
    } finally {
      lock.releaseLock();
    }
  } catch (error) {
    return Object.assign(out, plaidImportDiagnosticFail_('IDENTITY_LOCK',
      plaidImportIdentitySelfInitSanitizeCode_(error && error.message)));
  }

  if (out.previewConflictCount > 0) {
    return Object.assign(out, plaidImportDiagnosticFail_('IDENTITY_PREVIEW', 'IDENTITY_REVIEW_REQUIRED'));
  }

  if (out.previewSourceLinkCount > 0) {
    try {
      ensureAccountSourceLinksSheet_(ss);
    } catch (error) {
      return Object.assign(out, plaidImportDiagnosticFail_('IDENTITY_ENSURE_LINKS',
        plaidImportIdentitySelfInitSanitizeCode_(error && error.message)));
    }
  }

  try {
    var targets = plaidImportBuildManualComparisonTargets_(ss);
    out.comparisonTargetCount = targets.length;
  } catch (error) {
    return Object.assign(out, plaidImportDiagnosticFail_('COMPARISON_TARGETS',
      plaidImportIdentitySelfInitSanitizeCode_(error && error.message)));
  }

  if (out.previewPendingCount <= 0 && out.registryAccountCount > 0) {
    out.stage = 'ALREADY_INITIALIZED';
    out.code = 'ALREADY_INITIALIZED';
  }
  console.log(JSON.stringify(out));
  return out;
}

function authorizeBoundedExternalRequest() {
  var response = UrlFetchApp.fetch('https://www.google.com/generate_204', {
    method: 'get',
    muteHttpExceptions: true
  });
  var status = response.getResponseCode();
  console.log('bounded external_request authorization probe status=' + status);
  return { ok: status >= 200 && status < 400, status: status };
}
