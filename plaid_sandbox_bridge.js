/**
 * Central-only Plaid Sandbox bridge.
 *
 * The browser may supply only transient Link output and an opaque protected
 * connection key. Ownership is always derived from Session.getEffectiveUser()
 * through the Central allow-list gate and a server-only UserProperties key.
 * Plaid credentials never enter Apps Script or a workbook.
 */
var PLAID_SANDBOX_PROOF_TEST_EMAIL_ = 'cashcompass2026@gmail.com';
var PLAID_SANDBOX_PROOF_ENABLED_KEY_ = 'PLAID_SANDBOX_PROOF_ENABLED';
var PLAID_SANDBOX_BACKEND_URL_KEY_ = 'PLAID_SANDBOX_BACKEND_URL';
var PLAID_SANDBOX_ASSERTION_PRIVATE_KEY_KEY_ = 'PLAID_SANDBOX_ASSERTION_PRIVATE_KEY_PEM';
var PLAID_SANDBOX_ASSERTION_KEY_ID_KEY_ = 'PLAID_SANDBOX_ASSERTION_KEY_ID';
var PLAID_SANDBOX_USER_KEY_ = 'PLAID_SANDBOX_PROTECTED_USER_KEY_V1';
var PLAID_SANDBOX_PROOF_STATE_KEY_ = 'PLAID_SANDBOX_PROOF_STATE_V1';
var PLAID_SANDBOX_EVIDENCE_KEY_ = 'PLAID_SANDBOX_LATEST_EVIDENCE_V1';
var PLAID_SANDBOX_ASSERTION_ISSUER_ = 'cashcompass-central-app';
var PLAID_SANDBOX_ASSERTION_AUDIENCE_ = 'cashcompass-plaid-backend';

function plaidSandboxSafe_(fn) {
  try { return fn(); }
  catch (e) { return { ok: false, error: (e && e.message) ? e.message : String(e) }; }
}

function isPlaidSandboxProofUser_() {
  try {
    var props = PropertiesService.getScriptProperties();
    return getCurrentUserEmail_() === PLAID_SANDBOX_PROOF_TEST_EMAIL_ &&
      !isAdminUser_() && isCentralModeEnabled_() && isAllowlistedUser_() &&
      props.getProperty(PLAID_SANDBOX_PROOF_ENABLED_KEY_) === 'true';
  } catch (_e) {
    return false;
  }
}

function assertPlaidSandboxBridgeAllowed_() {
  if (!isPlaidSandboxProofUser_()) {
    throw new Error('Plaid Sandbox proof is disabled or unavailable for this account.');
  }
}

function plaidSandboxSetProofEnabled(enabled) {
  if (!isAdminUser_() || !isCentralModeEnabled_()) {
    throw new Error('Plaid Sandbox proof control is admin-only and Central-only.');
  }
  if (enabled !== true && enabled !== false) throw new Error('Plaid Sandbox proof state is invalid.');
  var props = PropertiesService.getScriptProperties();
  if (enabled) {
    var allowlist = readAllowlist_();
    if (allowlist.indexOf(PLAID_SANDBOX_PROOF_TEST_EMAIL_) === -1) {
      throw new Error('The disposable Plaid Sandbox proof identity is not allow-listed.');
    }
    if (!props.getProperty(PLAID_SANDBOX_BACKEND_URL_KEY_) ||
        !props.getProperty(PLAID_SANDBOX_ASSERTION_KEY_ID_KEY_) ||
        !props.getProperty(PLAID_SANDBOX_ASSERTION_PRIVATE_KEY_KEY_)) {
      throw new Error('Plaid Sandbox deployment configuration is incomplete.');
    }
  }
  props.setProperty(PLAID_SANDBOX_PROOF_ENABLED_KEY_, enabled ? 'true' : 'false');
  return { ok: true, proofEnabled: enabled };
}

function plaidSandboxProtectedUserKey_() {
  var props = PropertiesService.getUserProperties();
  var key = String(props.getProperty(PLAID_SANDBOX_USER_KEY_) || '').trim();
  if (!/^u_[A-Za-z0-9_-]{20,128}$/.test(key)) {
    key = 'u_' + Utilities.getUuid().replace(/-/g, '');
    props.setProperty(PLAID_SANDBOX_USER_KEY_, key);
  }
  return key;
}

function plaidSandboxSha256_(value) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(value || ''))
    .map(function(byte) {
      var n = byte < 0 ? byte + 256 : byte;
      return (n < 16 ? '0' : '') + n.toString(16);
    }).join('');
}

function plaidSandboxBase64Url_(value) {
  return Utilities.base64EncodeWebSafe(value).replace(/=+$/g, '');
}

function plaidSandboxAssertion_(action, rawBody) {
  var props = PropertiesService.getScriptProperties();
  var privateKey = String(props.getProperty(PLAID_SANDBOX_ASSERTION_PRIVATE_KEY_KEY_) || '')
    .replace(/\\n/g, '\n').trim();
  var keyId = String(props.getProperty(PLAID_SANDBOX_ASSERTION_KEY_ID_KEY_) || '').trim();
  if (!privateKey || !keyId) throw new Error('Plaid Sandbox bridge signing configuration is unavailable.');
  var now = Math.floor(Date.now() / 1000);
  var header = { alg: 'RS256', typ: 'CC-AUTH', kid: keyId };
  var claims = {
    iss: PLAID_SANDBOX_ASSERTION_ISSUER_,
    aud: PLAID_SANDBOX_ASSERTION_AUDIENCE_,
    env: 'SANDBOX',
    sub: plaidSandboxProtectedUserKey_(),
    action: action,
    bodySha256: plaidSandboxSha256_(rawBody),
    iat: now,
    exp: now + 60,
    jti: 'r_' + Utilities.getUuid().replace(/-/g, '')
  };
  var unsigned = plaidSandboxBase64Url_(Utilities.newBlob(JSON.stringify(header)).getBytes()) + '.' +
    plaidSandboxBase64Url_(Utilities.newBlob(JSON.stringify(claims)).getBytes());
  var signature = Utilities.computeRsaSha256Signature(unsigned, privateKey);
  return unsigned + '.' + plaidSandboxBase64Url_(signature);
}

function plaidSandboxBackendUrl_() {
  var value = String(PropertiesService.getScriptProperties().getProperty(PLAID_SANDBOX_BACKEND_URL_KEY_) || '').trim();
  if (!/^https:\/\/[a-z0-9-]+(?:-[a-z0-9]+)?\.[a-z0-9-]+\.run\.app$/i.test(value)) {
    throw new Error('Plaid Sandbox backend URL is unavailable.');
  }
  return value.replace(/\/$/, '');
}

function plaidSandboxRequest_(method, path, action, body) {
  assertPlaidSandboxBridgeAllowed_();
  var rawBody = method === 'GET' ? '' : JSON.stringify(body || {});
  var options = {
    method: method.toLowerCase(),
    muteHttpExceptions: true,
    headers: { 'X-CashCompass-Assertion': plaidSandboxAssertion_(action, rawBody) }
  };
  if (method !== 'GET') {
    options.contentType = 'application/json';
    options.payload = rawBody;
  }
  var response = UrlFetchApp.fetch(plaidSandboxBackendUrl_() + path, options);
  var status = response.getResponseCode();
  var parsed = null;
  try { parsed = JSON.parse(response.getContentText() || '{}'); } catch (_e) {}
  if (status < 200 || status >= 300 || !parsed || parsed.ok === false) {
    var reason = parsed && parsed.error ? String(parsed.error) : 'BACKEND_UNAVAILABLE';
    throw new Error('Plaid Sandbox request failed: ' + reason);
  }
  return parsed;
}

function plaidSandboxSanitizeAccount_(account) {
  return {
    protectedAccountKey: String(account && account.protectedAccountKey || ''),
    displayName: String(account && account.displayName || ''),
    officialName: String(account && account.officialName || ''),
    type: String(account && account.type || ''),
    subtype: String(account && account.subtype || ''),
    mask: String(account && account.mask || ''),
    lifecycleStatus: String(account && account.lifecycleStatus || '')
  };
}

function plaidSandboxSanitizeConnection_(connection) {
  return {
    environment: 'SANDBOX',
    protectedConnectionKey: String(connection && connection.protectedConnectionKey || ''),
    institutionName: String(connection && connection.institutionName || ''),
    lifecycleStatus: String(connection && connection.lifecycleStatus || ''),
    accounts: (connection && Array.isArray(connection.accounts) ? connection.accounts : [])
      .map(plaidSandboxSanitizeAccount_)
  };
}

function plaidSandboxReadProofState_() {
  try {
    var raw = PropertiesService.getUserProperties().getProperty(PLAID_SANDBOX_PROOF_STATE_KEY_);
    return raw ? JSON.parse(raw) : null;
  } catch (_e) {
    return null;
  }
}

function plaidSandboxWriteProofState_(state) {
  PropertiesService.getUserProperties().setProperty(PLAID_SANDBOX_PROOF_STATE_KEY_, JSON.stringify(state));
}

function plaidSandboxInitializeConnection() {
  return plaidSandboxSafe_(function() {
    var result = plaidSandboxRequest_('POST', '/v1/link-token', 'LINK_TOKEN_CREATE', {});
    var state = {
      runId: 'PLAID-' + Utilities.getUuid(),
      status: 'LINK_TOKEN_CREATED',
      startedAt: new Date().toISOString(),
      correlationId: String(result.correlationId || '')
    };
    plaidSandboxWriteProofState_(state);
    return {
      ok: true,
      environment: 'SANDBOX',
      linkToken: String(result.linkToken || ''),
      correlationId: state.correlationId,
      expiresAt: String(result.expiresAt || '')
    };
  });
}

function plaidSandboxExchangePublicToken(payload) {
  return plaidSandboxSafe_(function() {
    var input = payload && typeof payload === 'object' ? payload : {};
    if ('owner' in input || 'email' in input || 'userKey' in input || 'workbookId' in input) {
      throw new Error('Browser-provided ownership is not accepted.');
    }
    var publicToken = String(input.publicToken || '').trim();
    var correlationId = String(input.correlationId || '').trim();
    var state = plaidSandboxReadProofState_();
    if (!publicToken || !correlationId || !state || state.correlationId !== correlationId) {
      throw new Error('Plaid Link result is missing or does not match this session.');
    }
    var result = plaidSandboxRequest_('POST', '/v1/exchange', 'PUBLIC_TOKEN_EXCHANGE', {
      publicToken: publicToken,
      correlationId: correlationId
    });
    var sanitized = plaidSandboxSanitizeConnection_(result);
    state.status = 'CONNECTED';
    state.protectedConnectionKey = sanitized.protectedConnectionKey;
    state.accountCount = sanitized.accounts.length;
    state.connectedAt = new Date().toISOString();
    plaidSandboxWriteProofState_(state);
    return { ok: true, connection: sanitized };
  });
}

function plaidSandboxListConnections() {
  return plaidSandboxSafe_(function() {
    var result = plaidSandboxRequest_('GET', '/v1/connections', 'CONNECTIONS_LIST', null);
    return {
      ok: true,
      environment: 'SANDBOX',
      connections: (Array.isArray(result.connections) ? result.connections : [])
        .map(plaidSandboxSanitizeConnection_)
    };
  });
}

function plaidSandboxDisconnect(payload) {
  return plaidSandboxSafe_(function() {
    var input = payload && typeof payload === 'object' ? payload : {};
    if ('owner' in input || 'email' in input || 'userKey' in input || 'workbookId' in input) {
      throw new Error('Browser-provided ownership is not accepted.');
    }
    var protectedConnectionKey = String(input.protectedConnectionKey || '').trim();
    if (!protectedConnectionKey) throw new Error('Connection is required.');
    var result = plaidSandboxRequest_('POST', '/v1/disconnect', 'DISCONNECT', {
      protectedConnectionKey: protectedConnectionKey
    });
    var state = plaidSandboxReadProofState_();
    if (state && state.protectedConnectionKey === protectedConnectionKey && result.lifecycleStatus === 'DISCONNECTED') {
      state.status = 'DISCONNECTED';
      state.disconnectedAt = new Date().toISOString();
      plaidSandboxWriteProofState_(state);
      PropertiesService.getScriptProperties().setProperty(PLAID_SANDBOX_EVIDENCE_KEY_, JSON.stringify({
        suiteId: 'SUITE-PLAID-SANDBOX-CONNECTIVITY',
        runId: state.runId,
        overall: 'PASS',
        environment: 'SANDBOX',
        accountCount: Number(state.accountCount || 0),
        finishedAt: state.disconnectedAt,
        cleanup: { verified: true, result: 'DISCONNECTED' },
        releaseEligible: false
      }));
    }
    return {
      ok: true,
      environment: 'SANDBOX',
      protectedConnectionKey: protectedConnectionKey,
      lifecycleStatus: String(result.lifecycleStatus || '')
    };
  });
}

function plaidSandboxRuntimeStatus() {
  return plaidSandboxSafe_(function() {
    var result = plaidSandboxRequest_('POST', '/v1/runtime-status', 'RUNTIME_STATUS', {});
    return {
      ok: true,
      environment: 'SANDBOX',
      clientIdReadable: result.secrets && result.secrets.clientIdReadable === true,
      sandboxSecretReadable: result.secrets && result.secrets.sandboxSecretReadable === true
    };
  });
}
