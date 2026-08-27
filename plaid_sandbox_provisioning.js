/**
 * Reusable internal P1 Sandbox signing-property validation and rotation logic.
 *
 * No public provisioning entry point or customer route remains. A future
 * approved rotation may temporarily wrap these underscored helpers in the
 * reviewed editor-only administrator surface, then remove that surface again.
 */
var PLAID_SANDBOX_PROVISION_ADMIN_EMAIL_ = 'samertheodossy@gmail.com';
var PLAID_SANDBOX_PROVISION_CENTRAL_SCRIPT_ID_ =
  '153TEsXfVu4fwwToMj1-CvdOScj_vNJKBLTgSTejHZSTOUI89xHzgHt4_';

function plaidSandboxProvisionPropertyNames_() {
  return [
    PLAID_SANDBOX_PROOF_ENABLED_KEY_,
    PLAID_SANDBOX_BACKEND_URL_KEY_,
    PLAID_SANDBOX_ASSERTION_KEY_ID_KEY_,
    PLAID_SANDBOX_ASSERTION_PRIVATE_KEY_KEY_
  ];
}

function plaidSandboxProvisionAssertExactKeys_(value, expected, message) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(message);
  }
  var actual = Object.keys(value).sort();
  var wanted = expected.slice().sort();
  if (actual.length !== wanted.length) throw new Error(message);
  for (var i = 0; i < wanted.length; i++) {
    if (actual[i] !== wanted[i]) throw new Error(message);
  }
}

function plaidSandboxProvisionNormalizeBackendUrl_(value) {
  var url = String(value || '').trim().replace(/\/$/, '');
  if (!/^https:\/\/[a-z0-9-]+(?:-[a-z0-9]+)?\.[a-z0-9-]+\.run\.app$/i.test(url)) {
    throw new Error('Plaid Sandbox backend URL is invalid.');
  }
  return url;
}

function plaidSandboxProvisionNormalizeKeyId_(value) {
  var keyId = String(value || '').trim();
  if (!/^[A-Za-z0-9_-]{8,80}$/.test(keyId) ||
      keyId === '__proto__' || keyId === 'prototype' || keyId === 'constructor') {
    throw new Error('Plaid Sandbox assertion key ID is invalid.');
  }
  return keyId;
}

function plaidSandboxProvisionNormalizePrivateKey_(value, deps) {
  var privateKey = String(value || '').replace(/\\n/g, '\n').trim();
  var match = privateKey.match(
    /^-----BEGIN PRIVATE KEY-----\n([A-Za-z0-9+/=\n\r]+)\n-----END PRIVATE KEY-----$/
  );
  if (!match) throw new Error('Plaid Sandbox assertion private key is invalid.');
  var utilities = deps && deps.utilities ? deps.utilities : Utilities;
  try {
    var der = utilities.base64Decode(match[1].replace(/\s+/g, ''));
    var hex = der.map(function(byte) {
      var n = byte < 0 ? byte + 256 : byte;
      return (n < 16 ? '0' : '') + n.toString(16);
    }).join('');
    if (der.length < 128 || der[0] !== 48 ||
        hex.indexOf('06092a864886f70d010101') === -1) {
      throw new Error('invalid');
    }
    utilities.computeRsaSha256Signature(
      'cashcompass-provisioning-key-validation',
      privateKey
    );
  } catch (_error) {
    throw new Error('Plaid Sandbox assertion private key is invalid.');
  }
  return privateKey;
}

function plaidSandboxAssertProvisioningAdmin_(deps) {
  var context = deps || {};
  var email = context.currentUserEmail
    ? context.currentUserEmail() : getCurrentUserEmail_();
  var admin = context.isAdmin ? context.isAdmin() : isAdminUser_();
  var central = context.isCentral ? context.isCentral() : isCentralModeEnabled_();
  var scriptId = context.scriptId ? context.scriptId() : ScriptApp.getScriptId();
  if (email !== PLAID_SANDBOX_PROVISION_ADMIN_EMAIL_ || !admin) {
    throw new Error('Plaid Sandbox provisioning is restricted to the sole administrator.');
  }
  if (!central) throw new Error('Plaid Sandbox provisioning requires Central mode.');
  if (scriptId !== PLAID_SANDBOX_PROVISION_CENTRAL_SCRIPT_ID_) {
    throw new Error('Plaid Sandbox provisioning Central Script ID is invalid.');
  }
}

function isPlaidSandboxProvisioningAdmin_() {
  try {
    plaidSandboxAssertProvisioningAdmin_({});
    return true;
  } catch (_error) {
    return false;
  }
}

function plaidSandboxProvisionConfiguration_(payload, deps) {
  plaidSandboxProvisionAssertExactKeys_(payload, [
    'backendUrl', 'keyId', 'privateKeyPem'
  ], 'Plaid Sandbox provisioning fields are invalid.');
  return {
    backendUrl: plaidSandboxProvisionNormalizeBackendUrl_(payload.backendUrl),
    keyId: plaidSandboxProvisionNormalizeKeyId_(payload.keyId),
    privateKeyPem: plaidSandboxProvisionNormalizePrivateKey_(payload.privateKeyPem, deps)
  };
}

function plaidSandboxProvisionVerifyInstalled_(props, config) {
  var privateKey = String(
    props.getProperty(PLAID_SANDBOX_ASSERTION_PRIVATE_KEY_KEY_) || ''
  );
  if (props.getProperty(PLAID_SANDBOX_PROOF_ENABLED_KEY_) !== 'false' ||
      props.getProperty(PLAID_SANDBOX_BACKEND_URL_KEY_) !== config.backendUrl ||
      props.getProperty(PLAID_SANDBOX_ASSERTION_KEY_ID_KEY_) !== config.keyId ||
      privateKey !== config.privateKeyPem ||
      !/^-----BEGIN PRIVATE KEY-----[\s\S]+-----END PRIVATE KEY-----$/.test(privateKey)) {
    throw new Error('Plaid Sandbox provisioning verification failed.');
  }
  return {
    installed: true,
    propertyNames: plaidSandboxProvisionPropertyNames_(),
    proofEnabled: false,
    keyId: config.keyId,
    privateKeyPresent: true
  };
}

function plaidSandboxProvisionWrite_(props, config) {
  var values = {};
  values[PLAID_SANDBOX_PROOF_ENABLED_KEY_] = 'false';
  values[PLAID_SANDBOX_BACKEND_URL_KEY_] = config.backendUrl;
  values[PLAID_SANDBOX_ASSERTION_KEY_ID_KEY_] = config.keyId;
  values[PLAID_SANDBOX_ASSERTION_PRIVATE_KEY_KEY_] = config.privateKeyPem;
  props.setProperties(values, false);
  return plaidSandboxProvisionVerifyInstalled_(props, config);
}

function plaidSandboxWithProvisioningLock_(fn, deps) {
  var lock = deps && deps.lock ? deps.lock : LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    throw new Error('Plaid Sandbox provisioning is already in progress.');
  }
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

function plaidSandboxProvisionInitialInternal_(payload, deps) {
  var context = deps || {};
  plaidSandboxAssertProvisioningAdmin_(context);
  return plaidSandboxWithProvisioningLock_(function() {
    var props = context.properties || PropertiesService.getScriptProperties();
    var names = plaidSandboxProvisionPropertyNames_();
    for (var i = 0; i < names.length; i++) {
      if (props.getProperty(names[i]) !== null) {
        throw new Error('Plaid Sandbox initial provisioning is not empty.');
      }
    }
    return plaidSandboxProvisionWrite_(
      props,
      plaidSandboxProvisionConfiguration_(payload, context)
    );
  }, context);
}

function plaidSandboxRotateProvisioningInternal_(payload, deps) {
  var context = deps || {};
  plaidSandboxAssertProvisioningAdmin_(context);
  plaidSandboxProvisionAssertExactKeys_(payload, [
    'expectedCurrentBackendUrl',
    'expectedCurrentKeyId',
    'backendUrl',
    'keyId',
    'privateKeyPem'
  ], 'Plaid Sandbox rotation fields are invalid.');
  return plaidSandboxWithProvisioningLock_(function() {
    var props = context.properties || PropertiesService.getScriptProperties();
    var expectedBackendUrl = plaidSandboxProvisionNormalizeBackendUrl_(
      payload.expectedCurrentBackendUrl
    );
    var expectedKeyId = plaidSandboxProvisionNormalizeKeyId_(
      payload.expectedCurrentKeyId
    );
    var config = plaidSandboxProvisionConfiguration_({
      backendUrl: payload.backendUrl,
      keyId: payload.keyId,
      privateKeyPem: payload.privateKeyPem
    }, context);
    var currentPrivateKey = String(
      props.getProperty(PLAID_SANDBOX_ASSERTION_PRIVATE_KEY_KEY_) || ''
    );
    if (props.getProperty(PLAID_SANDBOX_PROOF_ENABLED_KEY_) !== 'false' ||
        props.getProperty(PLAID_SANDBOX_BACKEND_URL_KEY_) !== expectedBackendUrl ||
        props.getProperty(PLAID_SANDBOX_ASSERTION_KEY_ID_KEY_) !== expectedKeyId ||
        !/^-----BEGIN PRIVATE KEY-----[\s\S]+-----END PRIVATE KEY-----$/.test(currentPrivateKey)) {
      throw new Error('Plaid Sandbox rotation refused stale current configuration.');
    }
    if (config.keyId === expectedKeyId) {
      throw new Error('Plaid Sandbox rotation requires a new immutable key ID.');
    }
    return plaidSandboxProvisionWrite_(props, config);
  }, context);
}

function plaidSandboxProvisionFailure_(authorized) {
  if (authorized) {
    try {
      PropertiesService.getScriptProperties()
        .setProperty(PLAID_SANDBOX_PROOF_ENABLED_KEY_, 'false');
    } catch (_offError) {}
  }
  return {
    installed: false,
    propertyNames: plaidSandboxProvisionPropertyNames_(),
    proofEnabled: false,
    keyId: '',
    privateKeyPresent: false,
    error: 'Plaid Sandbox provisioning was refused.'
  };
}

