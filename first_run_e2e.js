/**
 * Browser-backed First-Run UX E2E fixture lifecycle.
 *
 * This is intentionally separate from the server-only scenario runner: the
 * assertions must execute in the shipping dashboard DOM. The only permitted
 * caller is the permanent disposable non-admin identity below. Preparation
 * uses the real Central provisioning path; completion stores privacy-safe
 * evidence and optionally soft-trashes only the exact verified fixture.
 */
var FIRST_RUN_E2E_TEST_EMAIL_ = 'cashcompass2026@gmail.com';
var FIRST_RUN_E2E_STATE_KEY_ = 'FIRST_RUN_E2E_ACTIVE_STATE_V1';
var FIRST_RUN_E2E_EVIDENCE_KEY_ = 'FIRST_RUN_E2E_LATEST_EVIDENCE_V2';
var FIRST_RUN_E2E_SCENARIO_ID_ = 'E2E-FIRST-RUN-UX';
var FIRST_RUN_E2E_MODE_ = 'FIRST_RUN';
var FIRST_RUN_E2E_REQUIRED_ASSERTIONS_ = [
  'startup_welcome',
  'setup_copy',
  'first_run_guidance',
  'default_subtabs',
  'empty_action_gating',
  'help_wording',
  'customer_language',
  'refresh_button_state',
  'clean_console_navigation'
];

function frE2ESafe_(fn) {
  try { return fn(); }
  catch (e) { return { ok: false, error: (e && e.message) ? e.message : String(e) }; }
}

function isFirstRunE2EUser_() {
  try {
    var email = getCurrentUserEmail_();
    if (email !== FIRST_RUN_E2E_TEST_EMAIL_) return false;
    if (isAdminUser_()) return false;
    if (!isCentralModeEnabled_()) return false;
    if (!isAllowlistedUser_()) return false;
    return true;
  } catch (_e) {
    return false;
  }
}

function assertFirstRunE2EAllowed_() {
  if (!isFirstRunE2EUser_()) {
    throw new Error('First-Run UX E2E is disabled or this is not the disposable test account.');
  }
  return FIRST_RUN_E2E_TEST_EMAIL_;
}

function frE2EReadState_() {
  try {
    var raw = PropertiesService.getUserProperties().getProperty(FIRST_RUN_E2E_STATE_KEY_);
    return raw ? JSON.parse(raw) : null;
  } catch (_e) {
    return null;
  }
}

function frE2EWriteState_(state) {
  PropertiesService.getUserProperties().setProperty(FIRST_RUN_E2E_STATE_KEY_, JSON.stringify(state));
}

function frE2EFile_(id) {
  return Drive.Files.get(id, {
    fields: 'id,name,trashed,owners(emailAddress),appProperties'
  });
}

function frE2EInspectRestrictedSharing_(id) {
  var response = Drive.Permissions.list(id, { fields: 'permissions(type,role,deleted)' });
  var permissions = (response && response.permissions) ? response.permissions : [];
  if (!permissions.length) throw new Error('First-Run UX E2E could not verify Drive sharing.');
  var ownerCount = 0;
  var restricted = true;
  for (var i = 0; i < permissions.length; i++) {
    var permission = permissions[i] || {};
    if (permission.deleted === true) continue;
    if (String(permission.role || '').toLowerCase() === 'owner') ownerCount++;
    var type = String(permission.type || '').toLowerCase();
    if (type === 'anyone' || type === 'domain') restricted = false;
  }
  if (ownerCount < 1 || !restricted) {
    throw new Error('First-Run UX E2E refused: fixture sharing is not Restricted owner-only.');
  }
  return { overall: 'PASS', restricted: true, ownerCount: ownerCount, total: permissions.length };
}

/** Fail closed unless every identity signal points to the active test fixture. */
function assertFirstRunE2EFixture_(state, email, allowTrashed) {
  if (!state || state.status !== 'ACTIVE' || !state.workbookId || !state.runId) {
    throw new Error('First-Run UX E2E refused: no active fixture state.');
  }
  var expectedHash = buildMappingKey_(email).slice(MAPPING_KEY_PREFIX_.length);
  if (state.emailHash !== expectedHash) {
    throw new Error('First-Run UX E2E refused: fixture identity mismatch.');
  }
  var file = frE2EFile_(state.workbookId);
  if (!allowTrashed && file.trashed) {
    throw new Error('First-Run UX E2E refused: fixture is already in Trash.');
  }
  if (String(file.name || '') !== buildWorkbookName_(email)) {
    throw new Error('First-Run UX E2E refused: workbook name mismatch.');
  }
  var owners = file.owners || [];
  var owned = owners.some(function(owner) {
    return String((owner && owner.emailAddress) || '').trim().toLowerCase() === email;
  });
  if (!owned) throw new Error('First-Run UX E2E refused: caller is not the owner.');
  var marker = file.appProperties || {};
  if (marker.cashcompass_role !== 'user_workbook' ||
      marker.cashcompass_project !== CASHCOMPASS_PROJECT_TAG_ ||
      marker.cashcompass_email_hash !== expectedHash) {
    throw new Error('First-Run UX E2E refused: durable workbook marker mismatch.');
  }
  if (lookupSpreadsheetIdForUser_(email) !== state.workbookId) {
    throw new Error('First-Run UX E2E refused: forward mapping mismatch.');
  }
  if (lookupReverseIndex_(state.workbookId) !== expectedHash) {
    throw new Error('First-Run UX E2E refused: reverse index mismatch.');
  }
  return file;
}

function frE2EBaseUrl_() {
  return String(ScriptApp.getService().getUrl() || '').replace(/\?.*$/, '');
}

function frE2EPublicState_() {
  var state = frE2EReadState_();
  var latestRaw = PropertiesService.getScriptProperties().getProperty(FIRST_RUN_E2E_EVIDENCE_KEY_);
  var latest = null;
  try { latest = latestRaw ? JSON.parse(latestRaw) : null; } catch (_e) {}
  var active = null;
  if (state) {
    try {
      var file = assertFirstRunE2EFixture_(state, FIRST_RUN_E2E_TEST_EMAIL_, true);
      var route = state.mode === 'POPULATED_DASHBOARD'
        ? 'populated-dashboard-e2e-run'
        : 'first-run-e2e-run';
      active = {
        runId: state.runId,
        createdAt: state.createdAt,
        trashed: !!file.trashed,
        mode: state.mode || FIRST_RUN_E2E_MODE_,
        runUrl: frE2EBaseUrl_() + '?view=' + route + '&runId=' + encodeURIComponent(state.runId)
      };
    } catch (e) {
      active = { runId: state.runId || '', invalid: true,
        error: (e && e.message) ? e.message : String(e) };
    }
  }
  return { active: active, latestEvidence: latest };
}

function frE2EGetState() {
  return frE2ESafe_(function() {
    assertFirstRunE2EAllowed_();
    return { ok: true, state: frE2EPublicState_() };
  });
}

/** Create one genuinely fresh Central workbook through the production path. */
function frE2EPrepare(confirmed) {
  return frE2ESafe_(function() {
    var email = assertFirstRunE2EAllowed_();
    if (confirmed !== true) throw new Error('Disposable-account confirmation is required.');
    if (frE2EReadState_()) throw new Error('An E2E fixture is already active. Finish or clean it first.');
    var preflightCleanup = null;
    var priorId = lookupSpreadsheetIdForUser_(email);
    if (priorId) {
      // The account is permanently disposable, but cleanup is still allowed
      // only after the old mapping passes the same owner/name/marker/forward/
      // reverse checks as a fixture created by this runner. Any mismatch stops.
      var priorState = {
        version: 1,
        status: 'ACTIVE',
        runId: 'PREFLIGHT-RECYCLE',
        workbookId: priorId,
        emailHash: buildMappingKey_(email).slice(MAPPING_KEY_PREFIX_.length),
        createdAt: new Date().toISOString()
      };
      preflightCleanup = frE2ECleanupVerified_(priorState, email);
    }
    var candidates = findCandidateWorkbooks_(email).merged;
    if (candidates.length) {
      throw new Error('Refused: the disposable account already has an active CashCompass workbook candidate.');
    }

    var ss = provisionWorkbookForUser_(email);
    var id = ss && ss.getId ? ss.getId() : '';
    if (!id) throw new Error('Provisioning did not return a workbook ID.');
    var state = {
      version: 2,
      status: 'ACTIVE',
      mode: FIRST_RUN_E2E_MODE_,
      runId: 'FR-' + Utilities.getUuid(),
      workbookId: id,
      emailHash: buildMappingKey_(email).slice(MAPPING_KEY_PREFIX_.length),
      createdAt: new Date().toISOString(),
      sharing: null
    };
    try {
      state.sharing = frE2EInspectRestrictedSharing_(id);
      frE2EWriteState_(state);
      assertFirstRunE2EFixture_(state, email, false);
    } catch (stateErr) {
      // Roll back only the exact file returned by this provisioning call and
      // only when its owner/name/marker/mapping all still match this caller.
      try {
        var file = frE2EFile_(id);
        var marker = (file && file.appProperties) ? file.appProperties : {};
        var owned = (file.owners || []).some(function(owner) {
          return String((owner && owner.emailAddress) || '').trim().toLowerCase() === email;
        });
        if (owned && file.name === buildWorkbookName_(email) &&
            marker.cashcompass_email_hash === state.emailHash &&
            lookupSpreadsheetIdForUser_(email) === id) {
          Drive.Files.update({ trashed: true }, id);
          clearMappingForUser_(email);
          clearReverseIndexForWorkbook_(id);
        }
      } catch (_rollbackErr) {}
      PropertiesService.getUserProperties().deleteProperty(FIRST_RUN_E2E_STATE_KEY_);
      throw stateErr;
    }
    return {
      ok: true,
      runId: state.runId,
      runUrl: frE2EBaseUrl_() + '?view=first-run-e2e-run&runId=' + encodeURIComponent(state.runId),
      preflightCleanup: preflightCleanup,
      state: frE2EPublicState_()
    };
  });
}

/** Route guard used by doGet before exposing the instrumented dashboard. */
function frE2ERenderContext_(runId) {
  if (!isFirstRunE2EUser_()) return null;
  var state = frE2EReadState_();
  if (!state || state.mode !== FIRST_RUN_E2E_MODE_ || String(runId || '') !== state.runId) return null;
  try {
    assertFirstRunE2EFixture_(state, FIRST_RUN_E2E_TEST_EMAIL_, false);
    return { runId: state.runId };
  } catch (_e) {
    return null;
  }
}

function frE2ENormalizeEvidenceFor_(payload, requiredAssertions) {
  payload = payload || {};
  requiredAssertions = requiredAssertions || [];
  var incoming = Array.isArray(payload.assertions) ? payload.assertions : [];
  var byId = {};
  for (var i = 0; i < incoming.length; i++) {
    var item = incoming[i] || {};
    var id = String(item.id || '');
    if (requiredAssertions.indexOf(id) === -1 || byId[id]) continue;
    byId[id] = {
      id: id,
      pass: item.pass === true,
      detail: String(item.detail || '').replace(/[\r\n\t]/g, ' ').slice(0, 240)
    };
  }
  var assertions = requiredAssertions.map(function(id) {
    return byId[id] || { id: id, pass: false, detail: 'Required browser assertion was not reported.' };
  });
  var errors = Array.isArray(payload.errors) ? payload.errors.slice(0, 10).map(function(value) {
    return releaseSanitizeError_(value);
  }) : [];
  return {
    assertions: assertions,
    errors: errors,
    durationMs: Math.max(0, Math.min(Number(payload.durationMs) || 0, 900000))
  };
}

function frE2ENormalizeEvidence_(payload) {
  return frE2ENormalizeEvidenceFor_(payload, FIRST_RUN_E2E_REQUIRED_ASSERTIONS_);
}

function frE2ECleanupVerified_(state, email) {
  var file = assertFirstRunE2EFixture_(state, email, true);
  if (!file.trashed) Drive.Files.update({ trashed: true }, state.workbookId);
  var after = frE2EFile_(state.workbookId);
  if (!after || after.trashed !== true) {
    throw new Error('First-Run UX E2E cleanup could not verify Trash. Mapping was preserved.');
  }
  clearMappingForUser_(email);
  clearReverseIndexForWorkbook_(state.workbookId);
  if (lookupSpreadsheetIdForUser_(email) || lookupReverseIndex_(state.workbookId)) {
    throw new Error('First-Run UX E2E cleanup could not verify mapping removal.');
  }
  PropertiesService.getUserProperties().deleteProperty(FIRST_RUN_E2E_STATE_KEY_);
  return { requested: true, trashed: true, verified: true };
}

/** Save browser evidence, then perform exact guarded soft-Trash cleanup. */
function frE2EComplete(runId, payload, trashAfter) {
  return frE2ESafe_(function() {
    var email = assertFirstRunE2EAllowed_();
    var state = frE2EReadState_();
    if (!state || String(runId || '') !== state.runId) {
      throw new Error('First-Run UX E2E refused: run token mismatch.');
    }
    assertFirstRunE2EFixture_(state, email, false);
    var normalized = frE2ENormalizeEvidence_(payload);
    var pass = normalized.assertions.every(function(item) { return item.pass; }) && !normalized.errors.length;
    var report = {
      version: 1,
      type: 'browserE2E',
      suiteId: 'SUITE-FIRST-RUN-UX-E2E',
      scenarioId: FIRST_RUN_E2E_SCENARIO_ID_,
      runId: state.runId,
      candidate: releaseCurrentCandidateMetadata_(),
      startedAt: state.createdAt,
      finishedAt: new Date().toISOString(),
      overall: pass ? 'PASS' : 'FAIL',
      durationMs: normalized.durationMs,
      sharing: state.sharing || null,
      assertions: normalized.assertions,
      errors: normalized.errors,
      cleanup: { requested: trashAfter === true, trashed: false, verified: false }
    };
    // Preserve the browser result even if cleanup later fails; the release
    // gate still refuses it because cleanup.verified remains false.
    PropertiesService.getScriptProperties().setProperty(FIRST_RUN_E2E_EVIDENCE_KEY_, JSON.stringify(report));
    if (trashAfter === true) {
      report.cleanup = frE2ECleanupVerified_(state, email);
      PropertiesService.getScriptProperties().setProperty(FIRST_RUN_E2E_EVIDENCE_KEY_, JSON.stringify(report));
    }
    return { ok: true, report: report };
  });
}

function frE2ECleanup(confirmed) {
  return frE2ESafe_(function() {
    var email = assertFirstRunE2EAllowed_();
    if (confirmed !== true) throw new Error('Disposable-account confirmation is required.');
    var state = frE2EReadState_();
    if (!state) return { ok: true, cleanup: { requested: true, trashed: false, verified: true }, state: frE2EPublicState_() };
    var cleanup = frE2ECleanupVerified_(state, email);
    return { ok: true, cleanup: cleanup, state: frE2EPublicState_() };
  });
}
