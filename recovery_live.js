/**
 * Authenticated Recovery Live validation for the permanent disposable account.
 *
 * Every invocation performs one bounded step and calls shipping recovery seams.
 * No email, workbook ID, or runtime flag is accepted from the browser.
 */
var RECOVERY_LIVE_TEST_EMAIL_ = 'cashcompass2026@gmail.com';
var RECOVERY_LIVE_STATE_KEY_ = 'RECOVERY_LIVE_ACTIVE_STATE_V1';
var RECOVERY_LIVE_EVIDENCE_KEY_ = 'RECOVERY_LIVE_LATEST_EVIDENCE_V1';
var RECOVERY_LIVE_SCENARIO_ID_ = 'E2E-RECOVERY-LIVE';
var RECOVERY_LIVE_FIXTURE_MARKER_KEY_ = 'cashcompass_recovery_live_fixture';
var RECOVERY_LIVE_FIXTURE_RUN_KEY_ = 'cashcompass_recovery_live_run';
var RECOVERY_LIVE_REQUIRED_ASSERTIONS_ = [
  'identity_boundary',
  'admin_immutable',
  'protected_targets_excluded',
  'restricted_sharing',
  'medium_requires_confirmation',
  'explicit_reconnect',
  'stale_trashed_fail_closed',
  'ambiguous_fail_closed',
  'verified_cleanup'
];

function recoveryLiveSafe_(fn) {
  try { return fn(); }
  catch (e) { return { ok: false, error: (e && e.message) ? e.message : String(e) }; }
}

function isRecoveryLiveUser_() {
  try {
    var email = getCurrentUserEmail_();
    return email === RECOVERY_LIVE_TEST_EMAIL_ &&
      !isAdminUser_() && isCentralModeEnabled_() && isAllowlistedUser_();
  } catch (_e) {
    return false;
  }
}

function assertRecoveryLiveAllowed_() {
  if (!isRecoveryLiveUser_()) {
    throw new Error('Recovery Live is disabled or this is not the disposable test account.');
  }
  return RECOVERY_LIVE_TEST_EMAIL_;
}

function recoveryLiveReadState_() {
  try {
    var raw = PropertiesService.getUserProperties().getProperty(RECOVERY_LIVE_STATE_KEY_);
    return raw ? JSON.parse(raw) : null;
  } catch (_e) {
    return null;
  }
}

function recoveryLiveWriteState_(state) {
  PropertiesService.getUserProperties().setProperty(RECOVERY_LIVE_STATE_KEY_, JSON.stringify(state));
}

function recoveryLiveFingerprint_(value) {
  var bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(value == null ? '' : value)
  );
  return bytes.map(function(b) {
    var n = b < 0 ? b + 256 : b;
    return (n < 16 ? '0' : '') + n.toString(16);
  }).join('');
}

function recoveryLiveAdminSnapshot_() {
  var props = PropertiesService.getScriptProperties();
  var raw = String(props.getProperty(ADMIN_EMAILS_KEY_) || '').trim();
  var configured = raw.split(',').map(function(value) {
    return String(value || '').trim().toLowerCase();
  }).filter(function(value) { return !!value; }).sort();
  var admins = readAdminEmails_().slice().sort();
  if (configured.length !== 1 || configured[0] !== 'samertheodossy@gmail.com' ||
      admins.length !== 1 || admins[0] !== 'samertheodossy@gmail.com') {
    throw new Error('Recovery Live refused: the immutable sole-admin configuration is not exact.');
  }
  return {
    fingerprint: recoveryLiveFingerprint_(raw),
    count: admins.length,
    soleAdminExact: true,
    adminMappingFingerprint: recoveryLiveFingerprint_(
      lookupSpreadsheetIdForUser_('samertheodossy@gmail.com') || ''
    )
  };
}

function recoveryLiveProtectedIds_() {
  var props = PropertiesService.getScriptProperties();
  var ids = {};
  var values = [
    props.getProperty('VALIDATOR_GOLDEN_WORKBOOK_ID'),
    props.getProperty('VALIDATOR_DEFAULT_CENTRAL_WORKBOOK_ID'),
    lookupSpreadsheetIdForUser_('samertheodossy@gmail.com')
  ];
  for (var i = 0; i < values.length; i++) {
    var id = String(values[i] || '').trim();
    if (id) ids[id] = true;
  }
  try {
    var active = SpreadsheetApp.getActiveSpreadsheet();
    if (active && active.getId()) ids[active.getId()] = true;
  } catch (_e) {}
  return ids;
}

function recoveryLiveFile_(id) {
  return Drive.Files.get(id, {
    fields: 'id,name,trashed,owners(emailAddress),appProperties'
  });
}

function assertRecoveryLiveFixture_(state, id, allowTrashed) {
  var email = assertRecoveryLiveAllowed_();
  if (!state || !state.runId || !id || state.fixtureIds.indexOf(id) === -1) {
    throw new Error('Recovery Live refused: fixture is not part of the active run.');
  }
  var file = recoveryLiveFile_(id);
  if (!allowTrashed && file.trashed) {
    throw new Error('Recovery Live refused: fixture is already in Trash.');
  }
  if (String(file.name || '') !== buildWorkbookName_(email)) {
    throw new Error('Recovery Live refused: fixture name mismatch.');
  }
  var owners = file.owners || [];
  var owned = owners.some(function(owner) {
    return String((owner && owner.emailAddress) || '').trim().toLowerCase() === email;
  });
  if (!owned) throw new Error('Recovery Live refused: disposable caller is not the fixture owner.');
  var marker = file.appProperties || {};
  if (marker[RECOVERY_LIVE_FIXTURE_MARKER_KEY_] !== state.emailHash ||
      marker[RECOVERY_LIVE_FIXTURE_RUN_KEY_] !== state.runId) {
    throw new Error('Recovery Live refused: owner-bound run marker mismatch.');
  }
  if (recoveryLiveProtectedIds_()[id]) {
    throw new Error('Recovery Live refused: fixture collides with a protected workbook ID.');
  }
  return file;
}

function recoveryLiveInspectSharing_(id) {
  var response = Drive.Permissions.list(id, { fields: 'permissions(type,role,deleted)' });
  var permissions = (response && response.permissions) ? response.permissions : [];
  var ownerCount = 0;
  var restricted = permissions.length > 0;
  for (var i = 0; i < permissions.length; i++) {
    var p = permissions[i] || {};
    if (p.deleted === true) continue;
    if (String(p.role || '').toLowerCase() === 'owner') ownerCount++;
    var type = String(p.type || '').toLowerCase();
    if (type === 'anyone' || type === 'domain') restricted = false;
  }
  if (!restricted || ownerCount !== 1) {
    throw new Error('Recovery Live refused: fixture sharing is not Restricted owner-only.');
  }
  return { overall: 'PASS', restricted: true, ownerCount: ownerCount, total: permissions.length };
}

function recoveryLiveCreateFixture_(state) {
  var email = assertRecoveryLiveAllowed_();
  if (lookupSpreadsheetIdForUser_(email)) {
    throw new Error('Recovery Live refused: disposable mapping must be empty before fixture creation.');
  }
  var appProperties = {};
  appProperties[RECOVERY_LIVE_FIXTURE_MARKER_KEY_] = state.emailHash;
  appProperties[RECOVERY_LIVE_FIXTURE_RUN_KEY_] = state.runId;
  var file = Drive.Files.create({
    name: buildWorkbookName_(email),
    mimeType: 'application/vnd.google-apps.spreadsheet',
    appProperties: appProperties
  });
  if (!file || !file.id) throw new Error('Recovery Live fixture creation returned no file ID.');
  state.fixtureIds.push(file.id);
  recoveryLiveWriteState_(state);
  assertRecoveryLiveFixture_(state, file.id, false);
  return { id: file.id, sharing: recoveryLiveInspectSharing_(file.id) };
}

function recoveryLiveTrashFixture_(state, id) {
  var file = assertRecoveryLiveFixture_(state, id, true);
  if (!file.trashed) Drive.Files.update({ trashed: true }, id);
  var after = assertRecoveryLiveFixture_(state, id, true);
  if (!after.trashed) throw new Error('Recovery Live cleanup could not verify Trash.');
  if (lookupSpreadsheetIdForUser_(RECOVERY_LIVE_TEST_EMAIL_) === id) {
    clearMappingForUser_(RECOVERY_LIVE_TEST_EMAIL_);
  }
  clearReverseIndexForWorkbook_(id);
  return true;
}

function recoveryLiveAddAssertion_(state, id, pass, detail) {
  state.assertions.push({
    id: id,
    pass: pass === true,
    detail: String(detail || '').replace(/[\r\n\t]/g, ' ').slice(0, 240)
  });
}

function recoveryLivePublicState_() {
  var state = recoveryLiveReadState_();
  var raw = PropertiesService.getScriptProperties().getProperty(RECOVERY_LIVE_EVIDENCE_KEY_);
  var latest = null;
  try { latest = raw ? JSON.parse(raw) : null; } catch (_e) {}
  return {
    active: state ? {
      runId: state.runId,
      status: state.status,
      step: state.step,
      completed: state.assertions.length,
      total: RECOVERY_LIVE_REQUIRED_ASSERTIONS_.length,
      startedAt: state.startedAt
    } : null,
    latestEvidence: latest
  };
}

function recoveryLiveGetState() {
  return recoveryLiveSafe_(function() {
    assertRecoveryLiveAllowed_();
    return { ok: true, state: recoveryLivePublicState_() };
  });
}

function recoveryLiveStart(confirmed) {
  return recoveryLiveSafe_(function() {
    var email = assertRecoveryLiveAllowed_();
    if (confirmed !== true) throw new Error('Disposable-account confirmation is required.');
    if (recoveryLiveReadState_()) throw new Error('A Recovery Live run is already active.');
    var preflightCleanup = null;
    var priorId = lookupSpreadsheetIdForUser_(email);
    if (priorId) {
      var priorState = {
        version: 1,
        status: 'ACTIVE',
        runId: 'RECOVERY-LIVE-PREFLIGHT',
        workbookId: priorId,
        emailHash: buildMappingKey_(email).slice(MAPPING_KEY_PREFIX_.length),
        createdAt: new Date().toISOString()
      };
      preflightCleanup = frE2ECleanupVerified_(priorState, email);
    }
    if (findCandidateWorkbooks_(email).merged.length) {
      throw new Error('Recovery Live refused: active workbook candidates already exist for the disposable account.');
    }
    if (isAutoAdoptEnabled_()) {
      throw new Error('Recovery Live refused: CENTRAL_AUTO_ADOPT must remain OFF for the confirmation test.');
    }
    var admin = recoveryLiveAdminSnapshot_();
    var state = {
      version: 1,
      status: 'IN_PROGRESS',
      runId: 'RL-' + Utilities.getUuid(),
      startedAt: new Date().toISOString(),
      step: 'stage_single',
      emailHash: buildMappingKey_(email).slice(MAPPING_KEY_PREFIX_.length),
      adminBefore: admin,
      protectedCount: Object.keys(recoveryLiveProtectedIds_()).length,
      preflightCleanup: preflightCleanup,
      fixtureIds: [],
      assertions: [],
      sharing: []
    };
    recoveryLiveAddAssertion_(state, 'identity_boundary', true,
      'Exact allow-listed disposable non-admin Central identity; no caller-supplied email or workbook ID.');
    recoveryLiveWriteState_(state);
    return { ok: true, runId: state.runId, state: recoveryLivePublicState_() };
  });
}

function recoveryLiveRunNext(runId) {
  return recoveryLiveSafe_(function() {
    var email = assertRecoveryLiveAllowed_();
    var state = recoveryLiveReadState_();
    if (!state || state.status !== 'IN_PROGRESS' || String(runId || '') !== state.runId) {
      throw new Error('Recovery Live refused: active run token mismatch.');
    }

    if (state.step === 'stage_single') {
      var created = recoveryLiveCreateFixture_(state);
      state.singleId = created.id;
      state.sharing.push(created.sharing);
      recoveryLiveAddAssertion_(state, 'protected_targets_excluded', true,
        'Fixture is caller-owned, exact-name, run-marked, and distinct from canonical/default/admin/bounded targets.');
      recoveryLiveAddAssertion_(state, 'restricted_sharing', true,
        'Recovery candidate is Restricted with exactly one owner.');
      state.step = 'confirm_required';
    } else if (state.step === 'confirm_required') {
      var confirmCaught = false;
      try {
        resolveExistingWorkbookForRecovery_(email, 'no_mapping');
      } catch (e) {
        confirmCaught = !!(e && e.name === 'ConfirmAdoptWorkbookError');
      }
      if (!confirmCaught || lookupSpreadsheetIdForUser_(email)) {
        throw new Error('Production recovery did not stop for MEDIUM-candidate confirmation.');
      }
      recoveryLiveAddAssertion_(state, 'medium_requires_confirmation', true,
        'Production resolver found one MEDIUM candidate, created nothing, and required confirmation.');
      state.step = 'explicit_reconnect';
    } else if (state.step === 'explicit_reconnect') {
      var reconnect = recoveryReconnectSelf();
      if (!reconnect || reconnect.status !== 'reconnected' ||
          lookupSpreadsheetIdForUser_(email) !== state.singleId ||
          lookupReverseIndex_(state.singleId) !== state.emailHash) {
        throw new Error('Production self-reconnect did not establish the exact disposable mapping.');
      }
      assertRecoveryLiveFixture_(state, state.singleId, false);
      recoveryLiveAddAssertion_(state, 'explicit_reconnect', true,
        'Production self-reconnect linked exactly the sole caller-owned candidate and wrote matching indexes.');
      state.step = 'stale_trash';
    } else if (state.step === 'stale_trash') {
      var file = assertRecoveryLiveFixture_(state, state.singleId, false);
      if (!file.trashed) Drive.Files.update({ trashed: true }, state.singleId);
      var staleCaught = false;
      try {
        getUserSpreadsheet_();
      } catch (e) {
        staleCaught = !!(e && e.name === 'WorkbookRecoveryUnavailableError' &&
          e.recoveryReason === 'mapped_workbook_trashed');
      }
      if (!staleCaught || lookupSpreadsheetIdForUser_(email) !== state.singleId ||
          findCandidateWorkbooks_(email).merged.length !== 0) {
        throw new Error('Production stale-mapping recovery did not fail closed without replacement.');
      }
      recoveryLiveAddAssertion_(state, 'stale_trashed_fail_closed', true,
        'Trashed mapped workbook routed to recovery unavailable; mapping stayed and no replacement was created.');
      clearMappingForUser_(email);
      clearReverseIndexForWorkbook_(state.singleId);
      state.step = 'stage_ambiguous';
    } else if (state.step === 'stage_ambiguous') {
      var first = recoveryLiveCreateFixture_(state);
      var second = recoveryLiveCreateFixture_(state);
      state.ambiguousIds = [first.id, second.id];
      state.sharing.push(first.sharing, second.sharing);
      state.step = 'ambiguous';
    } else if (state.step === 'ambiguous') {
      var result = recoveryReconnectSelf();
      if (!result || result.status !== 'ambiguous' || lookupSpreadsheetIdForUser_(email) ||
          findCandidateWorkbooks_(email).merged.length !== 2) {
        throw new Error('Production reconnect did not refuse the ambiguous candidate set.');
      }
      recoveryLiveAddAssertion_(state, 'ambiguous_fail_closed', true,
        'Production reconnect detected two owned candidates, selected neither, and created no mapping.');
      state.step = 'cleanup';
    } else if (state.step === 'cleanup') {
      for (var i = 0; i < state.fixtureIds.length; i++) {
        recoveryLiveTrashFixture_(state, state.fixtureIds[i]);
      }
      if (lookupSpreadsheetIdForUser_(email)) {
        throw new Error('Recovery Live cleanup left a disposable mapping behind.');
      }
      var adminAfter = recoveryLiveAdminSnapshot_();
      if (adminAfter.fingerprint !== state.adminBefore.fingerprint ||
          adminAfter.adminMappingFingerprint !== state.adminBefore.adminMappingFingerprint) {
        throw new Error('Recovery Live refused final evidence: admin configuration or mapping changed.');
      }
      recoveryLiveAddAssertion_(state, 'admin_immutable', true,
        'Sole-admin configuration and administrator mapping fingerprints are unchanged.');
      recoveryLiveAddAssertion_(state, 'verified_cleanup', true,
        'Every run-marked fixture is verified in Trash; disposable mapping and reverse indexes are cleared.');
      return recoveryLiveFinalize_(state);
    } else {
      throw new Error('Recovery Live encountered an unknown step.');
    }

    recoveryLiveWriteState_(state);
    return { ok: true, done: false, runId: state.runId, state: recoveryLivePublicState_() };
  });
}

function recoveryLiveFinalize_(state) {
  var required = {};
  for (var i = 0; i < RECOVERY_LIVE_REQUIRED_ASSERTIONS_.length; i++) {
    required[RECOVERY_LIVE_REQUIRED_ASSERTIONS_[i]] = false;
  }
  for (var j = 0; j < state.assertions.length; j++) {
    if (state.assertions[j].pass === true) required[state.assertions[j].id] = true;
  }
  var pass = Object.keys(required).every(function(id) { return required[id] === true; });
  var report = {
    version: 1,
    type: 'browserE2E',
    suiteId: 'SUITE-RECOVERY-LIVE',
    scenarioId: RECOVERY_LIVE_SCENARIO_ID_,
    runId: state.runId,
    startedAt: state.startedAt,
    finishedAt: new Date().toISOString(),
    durationMs: Math.max(0, new Date().getTime() - new Date(state.startedAt).getTime()),
    overall: pass ? 'PASS' : 'FAIL',
    target: { disposableNonAdmin: true, callerScoped: true, protectedTargetsMatched: 0 },
    sharing: { overall: 'PASS', restricted: true, ownerCount: 1, fixturesChecked: state.sharing.length },
    assertions: state.assertions,
    cleanup: { requested: true, trashed: true, verified: true, fixtureCount: state.fixtureIds.length }
  };
  PropertiesService.getScriptProperties().setProperty(
    RECOVERY_LIVE_EVIDENCE_KEY_, JSON.stringify(report)
  );
  PropertiesService.getUserProperties().deleteProperty(RECOVERY_LIVE_STATE_KEY_);
  return { ok: true, done: true, report: report, state: recoveryLivePublicState_() };
}

function recoveryLiveCleanup(confirmed) {
  return recoveryLiveSafe_(function() {
    assertRecoveryLiveAllowed_();
    if (confirmed !== true) throw new Error('Disposable-account confirmation is required.');
    var state = recoveryLiveReadState_();
    if (!state) return { ok: true, state: recoveryLivePublicState_() };
    for (var i = 0; i < state.fixtureIds.length; i++) {
      recoveryLiveTrashFixture_(state, state.fixtureIds[i]);
    }
    clearMappingForUser_(RECOVERY_LIVE_TEST_EMAIL_);
    PropertiesService.getUserProperties().deleteProperty(RECOVERY_LIVE_STATE_KEY_);
    return { ok: true, state: recoveryLivePublicState_() };
  });
}
