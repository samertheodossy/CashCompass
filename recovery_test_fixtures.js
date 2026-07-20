/**
 * recovery_test_fixtures.js — guarded live fixtures for Recovery Validation 6F.
 *
 * This is deliberately separate from the general Test Harness scenario runner:
 * the remaining 6F branches must execute as the disposable Central user so
 * candidate files are owned by that user and visible under drive.file.
 *
 * Gates (checked on route render AND every server action):
 *   - CENTRAL_MODE === "true"
 *   - TEST_HARNESS_ENABLED === "true"
 *   - effective user exactly matches RECOVERY_6F_TEST_EMAIL
 *   - effective user is not an admin
 *   - configured email is allow-listed
 *
 * Fixture files are exact-name, name-only/MEDIUM candidates. They intentionally
 * omit CashCompass identity markers, but carry an owner-bound 6F fixture marker.
 * Cleanup soft-trashes only IDs stored in the caller's UserProperties after the
 * marker, owner, and expected-name checks all pass. No hard delete exists here.
 */

var RECOVERY_6F_TEST_EMAIL_KEY_ = 'RECOVERY_6F_TEST_EMAIL';
var RECOVERY_6F_FIXTURE_IDS_KEY_ = 'RECOVERY_6F_FIXTURE_IDS';
var RECOVERY_6F_FAILURE_MODE_KEY_ = 'RECOVERY_6F_FAILURE_MODE';
var RECOVERY_6F_FIXTURE_PROP_KEY_ = 'cashcompass_6f_fixture';
var RECOVERY_6F_FIXTURE_KIND_KEY_ = 'cashcompass_6f_fixture_kind';
var RECOVERY_6F_FIXTURE_KIND_NAME_ONLY_ = 'name_only';

function r6fSafe_(fn) {
  try {
    return fn();
  } catch (e) {
    return { ok: false, error: (e && e.message) ? e.message : String(e) };
  }
}

function getRecovery6fConfiguredEmail_() {
  try {
    return String(PropertiesService.getScriptProperties()
      .getProperty(RECOVERY_6F_TEST_EMAIL_KEY_) || '').trim().toLowerCase();
  } catch (_e) {
    return '';
  }
}

function isRecovery6fFixtureUser_() {
  try {
    var email = getCurrentUserEmail_();
    var configured = getRecovery6fConfiguredEmail_();
    if (!email || !configured || email !== configured) return false;
    // The 6F fixture identity must be a non-admin disposable user. This keeps
    // fixture ownership and privileged operator capabilities separated.
    if (isAdminUser_()) return false;
    if (!isCentralModeEnabled_()) return false;
    if (String(PropertiesService.getScriptProperties()
      .getProperty('TEST_HARNESS_ENABLED') || '').trim() !== 'true') return false;
    return isAllowlistedUser_();
  } catch (_e) {
    return false;
  }
}

function assertRecovery6fFixtureAllowed_() {
  if (!isRecovery6fFixtureUser_()) {
    throw new Error(
      'Recovery 6F fixtures are disabled or this is not the configured disposable account.'
    );
  }
  return getCurrentUserEmail_();
}

function recovery6fOwnerMarker_(email) {
  return buildMappingKey_(email).slice(MAPPING_KEY_PREFIX_.length);
}

function recovery6fReadFixtureIds_() {
  try {
    var raw = String(PropertiesService.getUserProperties()
      .getProperty(RECOVERY_6F_FIXTURE_IDS_KEY_) || '').trim();
    if (!raw) return [];
    var parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(function(id) { return String(id || '').trim(); })
      .filter(function(id) { return !!id; });
  } catch (_e) {
    return [];
  }
}

function recovery6fWriteFixtureIds_(ids) {
  PropertiesService.getUserProperties().setProperty(
    RECOVERY_6F_FIXTURE_IDS_KEY_, JSON.stringify(ids || [])
  );
}

function recovery6fFailureMode_() {
  try {
    return String(PropertiesService.getUserProperties()
      .getProperty(RECOVERY_6F_FAILURE_MODE_KEY_) || '').trim();
  } catch (_e) {
    return '';
  }
}

function recovery6fFileDescriptor_(fileId) {
  return Drive.Files.get(fileId, {
    fields: 'id,name,trashed,owners(emailAddress),appProperties'
  });
}

function assertRecovery6fFixtureFile_(fileId, email) {
  if (!fileId) throw new Error('Recovery 6F fixture refused: missing file ID.');
  var file = recovery6fFileDescriptor_(fileId);
  var props = (file && file.appProperties) ? file.appProperties : {};
  if (props[RECOVERY_6F_FIXTURE_PROP_KEY_] !== recovery6fOwnerMarker_(email)) {
    throw new Error('Recovery 6F fixture refused: owner-bound fixture marker mismatch.');
  }
  if (props[RECOVERY_6F_FIXTURE_KIND_KEY_] !== RECOVERY_6F_FIXTURE_KIND_NAME_ONLY_) {
    throw new Error('Recovery 6F fixture refused: fixture kind mismatch.');
  }
  if (String(file.name || '') !== buildWorkbookName_(email)) {
    throw new Error('Recovery 6F fixture refused: workbook name mismatch.');
  }
  var owners = file.owners || [];
  var owned = owners.some(function(owner) {
    return String((owner && owner.emailAddress) || '').trim().toLowerCase() === email;
  });
  if (!owned) throw new Error('Recovery 6F fixture refused: caller is not the owner.');
  return file;
}

/**
 * Production recovery hook. Returns true only for verify-mode injection; search
 * mode throws. Every other situation returns false without changing behavior.
 */
function maybeInjectRecovery6fFailure_(stage, email, cand) {
  var mode = recovery6fFailureMode_();
  if (!mode || mode !== stage) return false;
  if (!isRecovery6fFixtureUser_()) return false;

  var current = getCurrentUserEmail_();
  var normalizedEmail = String(email || '').trim().toLowerCase();
  if (!current || current !== normalizedEmail) return false;

  if (stage === 'search') {
    throw new Error('RECOVERY_6F_TEST_INJECTED_SEARCH_FAILURE');
  }
  if (stage === 'verify') {
    if (!cand || !cand.id) return false;
    try {
      assertRecovery6fFixtureFile_(cand.id, current);
      return true;
    } catch (_e) {
      return false;
    }
  }
  return false;
}

function recovery6fState_() {
  var email = assertRecovery6fFixtureAllowed_();
  var mode = recovery6fFailureMode_();
  var ids = recovery6fReadFixtureIds_();
  var fixtureFiles = ids.map(function(id) {
    try {
      var f = assertRecovery6fFixtureFile_(id, email);
      return { id: id, name: f.name, trashed: !!f.trashed, verified: true };
    } catch (e) {
      return { id: id, name: '', trashed: null, verified: false,
        error: (e && e.message) ? e.message : String(e) };
    }
  });
  var candidateCount = null;
  var candidateError = '';
  if (mode === 'search') {
    candidateError = 'Search failure injection is active.';
  } else {
    try {
      candidateCount = findCandidateWorkbooks_(email).merged.length;
    } catch (e) {
      candidateError = (e && e.message) ? e.message : String(e);
    }
  }
  return {
    email: email,
    mappingId: lookupSpreadsheetIdForUser_(email) || '',
    fixtureFiles: fixtureFiles,
    candidateCount: candidateCount,
    candidateError: candidateError,
    failureMode: mode || 'none',
    expectedName: buildWorkbookName_(email)
  };
}

function r6fGetState() {
  return r6fSafe_(function() {
    return { ok: true, state: recovery6fState_() };
  });
}

function r6fStageNameOnlyCandidates(count, confirmed) {
  return r6fSafe_(function() {
    var email = assertRecovery6fFixtureAllowed_();
    if (confirmed !== true) throw new Error('Explicit disposable-account confirmation is required.');
    var n = Number(count);
    if (n !== 1 && n !== 2) throw new Error('Fixture count must be exactly 1 or 2.');
    if (lookupSpreadsheetIdForUser_(email)) {
      throw new Error('Refused: clear the disposable account mapping before staging candidates.');
    }
    if (recovery6fReadFixtureIds_().length) {
      throw new Error('Refused: clean up the existing 6F fixture set first.');
    }
    PropertiesService.getUserProperties().deleteProperty(RECOVERY_6F_FAILURE_MODE_KEY_);
    var existing = findCandidateWorkbooks_(email).merged;
    if (existing.length) {
      throw new Error('Refused: ' + existing.length + ' active recovery candidate(s) already exist.');
    }

    var marker = recovery6fOwnerMarker_(email);
    var created = [];
    try {
      for (var i = 0; i < n; i++) {
        var appProperties = {};
        appProperties[RECOVERY_6F_FIXTURE_PROP_KEY_] = marker;
        appProperties[RECOVERY_6F_FIXTURE_KIND_KEY_] = RECOVERY_6F_FIXTURE_KIND_NAME_ONLY_;
        var file = Drive.Files.create({
          name: buildWorkbookName_(email),
          mimeType: 'application/vnd.google-apps.spreadsheet',
          appProperties: appProperties
        });
        if (!file || !file.id) throw new Error('Drive did not return a fixture file ID.');
        created.push(file.id);
      }
      recovery6fWriteFixtureIds_(created);
    } catch (e) {
      for (var j = 0; j < created.length; j++) {
        try {
          assertRecovery6fFixtureFile_(created[j], email);
          // Central declares drive.file, under which DriveApp.getFileById is
          // not permitted. Advanced Drive update honors the per-file grant.
          Drive.Files.update({ trashed: true }, created[j]);
        } catch (_cleanupErr) {}
      }
      PropertiesService.getUserProperties().deleteProperty(RECOVERY_6F_FIXTURE_IDS_KEY_);
      throw e;
    }
    return { ok: true, state: recovery6fState_() };
  });
}

function r6fSetFailureMode(mode, confirmed) {
  return r6fSafe_(function() {
    var email = assertRecovery6fFixtureAllowed_();
    if (confirmed !== true) throw new Error('Explicit disposable-account confirmation is required.');
    var normalized = String(mode || '').trim().toLowerCase();
    if (normalized !== 'search' && normalized !== 'verify' && normalized !== 'none') {
      throw new Error('Unsupported failure mode.');
    }
    if (normalized !== 'none' && lookupSpreadsheetIdForUser_(email)) {
      throw new Error('Refused: clear the disposable account mapping before injecting failure.');
    }
    if (normalized === 'verify') {
      var found = findCandidateWorkbooks_(email).merged;
      if (found.length !== 1) {
        throw new Error('Verify failure requires exactly one active candidate.');
      }
      assertRecovery6fFixtureFile_(found[0].id, email);
    }
    var userProps = PropertiesService.getUserProperties();
    if (normalized === 'none') {
      userProps.deleteProperty(RECOVERY_6F_FAILURE_MODE_KEY_);
    } else {
      userProps.setProperty(RECOVERY_6F_FAILURE_MODE_KEY_, normalized);
    }
    return { ok: true, state: recovery6fState_() };
  });
}

function r6fCleanupFixtures(confirmed) {
  return r6fSafe_(function() {
    var email = assertRecovery6fFixtureAllowed_();
    if (confirmed !== true) throw new Error('Explicit disposable-account confirmation is required.');
    var ids = recovery6fReadFixtureIds_();
    var mappedId = lookupSpreadsheetIdForUser_(email) || '';
    var trashed = [];
    var refused = [];
    for (var i = 0; i < ids.length; i++) {
      var id = ids[i];
      try {
        var file = assertRecovery6fFixtureFile_(id, email);
        // Central declares drive.file, under which DriveApp.getFileById is
        // not permitted. Advanced Drive update honors the per-file grant.
        if (!file.trashed) Drive.Files.update({ trashed: true }, id);
        trashed.push(id);
        clearReverseIndexForWorkbook_(id);
      } catch (e) {
        refused.push({ id: id, error: (e && e.message) ? e.message : String(e) });
      }
    }
    if (mappedId && trashed.indexOf(mappedId) !== -1) {
      clearMappingForUser_(email);
    }
    var userProps = PropertiesService.getUserProperties();
    userProps.deleteProperty(RECOVERY_6F_FAILURE_MODE_KEY_);
    if (!refused.length) userProps.deleteProperty(RECOVERY_6F_FIXTURE_IDS_KEY_);
    var state = recovery6fState_();
    if (refused.length) {
      return {
        ok: false,
        error: 'Cleanup refused ' + refused.length + ' fixture file(s): ' +
          refused.map(function(item) { return item.error; }).join(' | '),
        trashedCount: trashed.length,
        refused: refused,
        state: state
      };
    }
    return { ok: true, trashedCount: trashed.length, refused: [], state: state };
  });
}
