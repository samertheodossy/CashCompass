/**
 * Central App workbook diagnostics — Phase 2A, Slice 1 (read-only).
 *
 * This file is the diagnostics foundation described in
 * CENTRAL_APP_WORKBOOK_DIAGNOSTICS_PLAN.md. Slice 1 is intentionally
 * inert and read-only:
 *
 *   - It performs NO create / update / trash operations.
 *   - It changes NO mappings and NO workbooks.
 *   - It changes NO provisioning behavior.
 *   - It adds NO menu items, UI, or deployment logic.
 *
 * It contains exactly three functions:
 *   1. adminDiagnosticsSelfTest()       — environment / scope self-check.
 *   2. buildWorkbookAppProperties_(...)  — pure marker builder (NOT wired
 *                                          into any write path yet).
 *   3. normalizeDriveFile_(file, email)  — pure Drive-file → Candidate
 *                                          descriptor.
 *
 * Cross-references:
 *   - CENTRAL_APP_WORKBOOK_DIAGNOSTICS_PLAN.md (§4 marker, §5 candidate,
 *     §6 classification, §7 admin functions)
 *   - central_provisioning.js (buildMappingKey_, buildWorkbookName_,
 *     readAllowlist_, MAPPING_KEY_PREFIX_, FAMILY_BETA_ALLOWLIST_KEY_,
 *     CENTRAL_MODE_KEY_)
 *   - central_resolver.js (isCentralModeEnabled_, getCurrentUserEmail_)
 *
 * Revert = delete this file. Nothing else references it.
 */

/* -------------------------------------------------------------------------- */
/*  Constants (marker schema)                                                 */
/* -------------------------------------------------------------------------- */

/**
 * appProperties marker schema version. Lets later slices evolve the
 * marker shape without breaking older-tagged workbooks. See plan § 4.
 */
var CASHCOMPASS_MARKER_SCHEMA_ = '1';

/**
 * Which Apps Script project created the workbook. Disambiguates the
 * two-project history (central vs the original bound project). See plan § 3.
 */
var CASHCOMPASS_PROJECT_TAG_ = 'central';

/* -------------------------------------------------------------------------- */
/*  Admin access control                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Script-property key holding the CSV of admin emails. Optional — when unset,
 * readAdminEmails_ falls back to BETA_CONTACT_EMAIL (defined in
 * central_provisioning.js) so the project owner is always an admin.
 */
var ADMIN_EMAILS_KEY_ = 'ADMIN_EMAILS';

/**
 * Returns the set of admin emails (lowercased, trimmed) as an array.
 *
 * Source order:
 *   1. ADMIN_EMAILS (CSV) if set.
 *   2. else BETA_CONTACT_EMAIL (single email) if set.
 *   3. else [] — fail-closed: nobody is admin.
 *
 * Never throws.
 *
 * @returns {!Array<string>}
 */
function readAdminEmails_() {
  try {
    var props = PropertiesService.getScriptProperties();
    var raw = String(props.getProperty(ADMIN_EMAILS_KEY_) || '').trim();
    if (!raw) {
      raw = String(props.getProperty(BETA_CONTACT_EMAIL_KEY_) || '').trim();
    }
    if (!raw) return [];
    return raw.split(',')
      .map(function(s) { return String(s || '').trim().toLowerCase(); })
      .filter(function(s) { return s.length > 0; });
  } catch (_e) {
    return [];
  }
}

/**
 * Returns true iff the current executing user is an admin. An empty caller
 * email always returns false (fail-closed). Never throws.
 *
 * @returns {boolean}
 */
function isAdminUser_() {
  var email = getCurrentUserEmail_();
  if (!email) return false;
  var admins = readAdminEmails_();
  for (var i = 0; i < admins.length; i++) {
    if (admins[i] === email) return true;
  }
  return false;
}

/**
 * Guard for admin-only entry points. Throws a generic error if the caller is
 * not an admin. The message intentionally leaks nothing (no allow-list, no
 * admin list, no diagnostic detail).
 */
function assertAdmin_() {
  if (!isAdminUser_()) {
    throw new Error('Admin access required.');
  }
}

/* -------------------------------------------------------------------------- */
/*  Pure helper — appProperties marker builder                               */
/* -------------------------------------------------------------------------- */

/**
 * Builds the Drive file-level appProperties marker for a user workbook.
 *
 * PURE / DESIGN HELPER — Slice 1 does NOT call this from any write path.
 * It is defined now so the future create-path stamp (2A.1) and lazy
 * backfill (2A.2) reuse one definition. It performs no I/O.
 *
 * The email hash is derived from buildMappingKey_ (minus the
 * "mapping::" prefix) so it is byte-identical to the mapping key's hash,
 * which lets diagnostics cross-check the marker against the mapping store.
 * Raw email is never included — only its SHA-256 hash.
 *
 * @param {string} email Caller email (case-insensitive; lowercased internally).
 * @param {string=} nowIso Optional ISO timestamp; defaults to now. Present so
 *   callers/tests can supply a deterministic value.
 * @returns {!Object<string,string>} appProperties marker object.
 */
function buildWorkbookAppProperties_(email, nowIso) {
  if (!email) {
    throw new Error('buildWorkbookAppProperties_ requires a non-empty email.');
  }
  var hash = buildMappingKey_(email).slice(MAPPING_KEY_PREFIX_.length);
  return {
    cashcompass_role: 'user_workbook',
    cashcompass_email_hash: hash,
    cashcompass_schema: CASHCOMPASS_MARKER_SCHEMA_,
    cashcompass_project: CASHCOMPASS_PROJECT_TAG_,
    cashcompass_provisioned_at: nowIso || new Date().toISOString()
  };
}

/* -------------------------------------------------------------------------- */
/*  Pure helper — Drive file → Candidate descriptor                          */
/* -------------------------------------------------------------------------- */

/**
 * Normalizes a Drive v3 Files resource into the Candidate descriptor from
 * the plan (§ 5). PURE — no I/O; safe to call on any file object.
 *
 * Expects the file to have been fetched with at least:
 *   files(id,name,owners(emailAddress),createdTime,modifiedTime,trashed,appProperties)
 *
 * @param {Object} file A Drive v3 Files resource (or null).
 * @param {string} email The caller email the candidate is being matched for.
 * @returns {?Object} Candidate descriptor, or null if `file` is unusable.
 */
function normalizeDriveFile_(file, email) {
  if (!file || !file.id) return null;

  var emailLower = String(email == null ? '' : email).trim().toLowerCase();
  var expectedHash = emailLower
    ? buildMappingKey_(emailLower).slice(MAPPING_KEY_PREFIX_.length)
    : '';
  var expectedName = emailLower ? buildWorkbookName_(emailLower) : null;

  var ownerEmail = null;
  if (file.owners && file.owners.length > 0 &&
      file.owners[0] && file.owners[0].emailAddress) {
    ownerEmail = String(file.owners[0].emailAddress).trim().toLowerCase();
  }
  var ownedByCaller = !!(ownerEmail && emailLower && ownerEmail === emailLower);

  var appProps = file.appProperties || {};
  var markerHash = appProps.cashcompass_email_hash || null;
  var hasMarker = !!markerHash;
  var markerHashMatches = !!(hasMarker && expectedHash && markerHash === expectedHash);
  var markerProject = appProps.cashcompass_project || null;

  var nameMatches = !!(expectedName && file.name === expectedName);

  var matchedBy = null;
  if (markerHashMatches && nameMatches) {
    matchedBy = 'both';
  } else if (markerHashMatches) {
    matchedBy = 'marker';
  } else if (nameMatches) {
    matchedBy = 'name';
  }

  return {
    id: file.id,
    name: (file.name == null ? null : file.name),
    ownerEmail: ownerEmail,
    ownedByCaller: ownedByCaller,
    createdTime: (file.createdTime == null ? null : file.createdTime),
    modifiedTime: (file.modifiedTime == null ? null : file.modifiedTime),
    trashed: (file.trashed === true),
    hasMarker: hasMarker,
    markerHashMatches: markerHashMatches,
    markerProject: markerProject,
    nameMatches: nameMatches,
    matchedBy: matchedBy
  };
}

/* -------------------------------------------------------------------------- */
/*  Admin self-test (read-only)                                              */
/* -------------------------------------------------------------------------- */

/**
 * Verifies that the diagnostics surface has everything it needs to run,
 * without changing anything. Intended to be run from the Apps Script
 * editor by the developer/admin.
 *
 * Read-only: the only Drive call is a 1-file Files.list (a read), used to
 * confirm the Drive advanced service is enabled and authorized. No file is
 * created, updated, or trashed; no mapping is written.
 *
 * Privacy: the allow-list is reported as a count only (never the member
 * emails). The single email surfaced is the operator's own
 * (getCurrentUserEmail_()), which is acceptable for an operator-run check.
 *
 * @returns {!Object} Structured diagnostic result (also written to Logger).
 */
function adminDiagnosticsSelfTest() {
  assertAdmin_();
  var result = {
    ok: false,
    generatedAt: new Date().toISOString(),
    checks: {
      driveAdvancedService: { ok: false, detail: '' },
      scriptProperties: { ok: false, detail: '' },
      allowlist: { ok: false, present: false, count: 0, detail: '' },
      spreadsheetService: { ok: false, detail: '' },
      sessionService: { ok: false, detail: '' },
      executionContext: {
        centralModeEnabled: false,
        currentUserEmailPresent: false,
        currentUserEmail: ''
      }
    },
    failures: []
  };

  // 1. Drive advanced service — confirm reachable + authorized via a read.
  try {
    if (typeof Drive === 'undefined' || !Drive.Files) {
      result.checks.driveAdvancedService.detail =
        'Drive advanced service symbol not available (check appsscript.json ' +
        'enabledAdvancedServices).';
      result.failures.push('driveAdvancedService: not available');
    } else {
      Drive.Files.list({ pageSize: 1, fields: 'files(id)' });
      result.checks.driveAdvancedService.ok = true;
      result.checks.driveAdvancedService.detail = 'Drive v3 list reachable.';
    }
  } catch (driveErr) {
    result.checks.driveAdvancedService.detail =
      'Drive list failed: ' +
      (driveErr && driveErr.message ? driveErr.message : String(driveErr));
    result.failures.push('driveAdvancedService: ' +
      result.checks.driveAdvancedService.detail);
  }

  // 2. Script properties — confirm read access.
  try {
    PropertiesService.getScriptProperties().getProperty(CENTRAL_MODE_KEY_);
    result.checks.scriptProperties.ok = true;
    result.checks.scriptProperties.detail = 'Script properties readable.';
  } catch (propErr) {
    result.checks.scriptProperties.detail =
      'Script properties read failed: ' +
      (propErr && propErr.message ? propErr.message : String(propErr));
    result.failures.push('scriptProperties: ' +
      result.checks.scriptProperties.detail);
  }

  // 3. Allow-list — confirm present and non-empty (count only, no emails).
  try {
    var list = readAllowlist_();
    var count = list.length;
    result.checks.allowlist.count = count;
    result.checks.allowlist.present = count > 0;
    result.checks.allowlist.ok = count > 0;
    result.checks.allowlist.detail = count > 0
      ? (count + ' entr' + (count === 1 ? 'y' : 'ies') + ' configured.')
      : 'FAMILY_BETA_ALLOWLIST is empty/unset (fail-closed: nobody allowed).';
    if (count === 0) {
      result.failures.push('allowlist: empty/unset');
    }
  } catch (allowErr) {
    result.checks.allowlist.detail =
      'Allow-list read failed: ' +
      (allowErr && allowErr.message ? allowErr.message : String(allowErr));
    result.failures.push('allowlist: ' + result.checks.allowlist.detail);
  }

  // 4. Core services present.
  try {
    result.checks.spreadsheetService.ok = (typeof SpreadsheetApp !== 'undefined');
    result.checks.spreadsheetService.detail =
      result.checks.spreadsheetService.ok ? 'Available.' : 'Missing.';
    if (!result.checks.spreadsheetService.ok) {
      result.failures.push('spreadsheetService: missing');
    }
  } catch (ssErr) {
    result.checks.spreadsheetService.detail = String(ssErr);
    result.failures.push('spreadsheetService: ' + String(ssErr));
  }

  try {
    result.checks.sessionService.ok = (typeof Session !== 'undefined');
    result.checks.sessionService.detail =
      result.checks.sessionService.ok ? 'Available.' : 'Missing.';
    if (!result.checks.sessionService.ok) {
      result.failures.push('sessionService: missing');
    }
  } catch (sessErr) {
    result.checks.sessionService.detail = String(sessErr);
    result.failures.push('sessionService: ' + String(sessErr));
  }

  // 5. Execution context assumptions (informational, never fails the test).
  try {
    result.checks.executionContext.centralModeEnabled = isCentralModeEnabled_();
  } catch (_cmErr) {
    result.checks.executionContext.centralModeEnabled = false;
  }
  try {
    var email = getCurrentUserEmail_();
    result.checks.executionContext.currentUserEmailPresent = !!email;
    result.checks.executionContext.currentUserEmail = email || '';
  } catch (_emErr) {
    result.checks.executionContext.currentUserEmailPresent = false;
    result.checks.executionContext.currentUserEmail = '';
  }

  // Overall OK = all critical checks pass. Execution-context fields are
  // informational and do not gate `ok`.
  result.ok =
    result.checks.driveAdvancedService.ok &&
    result.checks.scriptProperties.ok &&
    result.checks.allowlist.ok &&
    result.checks.spreadsheetService.ok &&
    result.checks.sessionService.ok;

  logDiagnosticsSelfTest_(result);
  return result;
}

/**
 * Human-readable Logger rendering of the self-test result. Read-only.
 * Kept separate so the structured object stays the single return value.
 *
 * @param {!Object} result Output of adminDiagnosticsSelfTest().
 */
function logDiagnosticsSelfTest_(result) {
  var lines = [];
  lines.push('CashCompass Diagnostics Self-Test — ' + result.generatedAt);
  lines.push('OVERALL: ' + (result.ok ? 'PASS' : 'FAIL'));
  lines.push('-----------------------------------------------------------');
  lines.push(fmtCheckLine_('Drive advanced service', result.checks.driveAdvancedService.ok,
    result.checks.driveAdvancedService.detail));
  lines.push(fmtCheckLine_('Script properties', result.checks.scriptProperties.ok,
    result.checks.scriptProperties.detail));
  lines.push(fmtCheckLine_('FAMILY_BETA_ALLOWLIST', result.checks.allowlist.ok,
    result.checks.allowlist.detail));
  lines.push(fmtCheckLine_('SpreadsheetApp', result.checks.spreadsheetService.ok,
    result.checks.spreadsheetService.detail));
  lines.push(fmtCheckLine_('Session', result.checks.sessionService.ok,
    result.checks.sessionService.detail));
  lines.push('-----------------------------------------------------------');
  lines.push('Context: centralMode=' +
    result.checks.executionContext.centralModeEnabled +
    ' | userEmailPresent=' +
    result.checks.executionContext.currentUserEmailPresent +
    ' | user=' + (result.checks.executionContext.currentUserEmail || '(none)'));
  if (result.failures.length > 0) {
    lines.push('-----------------------------------------------------------');
    lines.push('FAILURES (' + result.failures.length + '):');
    for (var i = 0; i < result.failures.length; i++) {
      lines.push('  - ' + result.failures[i]);
    }
  }
  Logger.log(lines.join('\n'));
}

/**
 * Formats one "[PASS]/[FAIL] Label — detail" line. Pure.
 *
 * @param {string} label
 * @param {boolean} ok
 * @param {string} detail
 * @returns {string}
 */
function fmtCheckLine_(label, ok, detail) {
  return (ok ? '[PASS] ' : '[FAIL] ') + label + (detail ? ' — ' + detail : '');
}

/* -------------------------------------------------------------------------- */
/*  Constants (candidate detection + classification)                          */
/* -------------------------------------------------------------------------- */

/**
 * Coverage label stamped on every detection/classification result. Under the
 * `drive.file` scope, Drive only exposes files this app created or the user
 * opened with this app — never the whole Drive. Outputs must never imply
 * complete coverage. See plan § 3.
 */
var CANDIDATE_COVERAGE_ = 'app_visible_only';

/** Drive v3 field projection for a single file. */
var CANDIDATE_FIELDS_SINGLE_ =
  'id,name,owners(emailAddress),createdTime,modifiedTime,trashed,appProperties';

/** Drive v3 field projection for a list (adds the page token). */
var CANDIDATE_FIELDS_LIST_ = 'files(' + CANDIDATE_FIELDS_SINGLE_ + '),nextPageToken';

/** Status → severity bucket (see plan § 6). */
var STATUS_SEVERITY_ = {
  OK: 'ok',
  NO_WORKBOOK: 'info',
  NAME_MISMATCH: 'info',
  // Non-self rows: the operator cannot inspect another user's workbook under
  // executeAs USER_ACCESSING + drive.file, so these are informational only.
  MAPPING_PRESENT_UNVERIFIABLE: 'info',
  NO_MAPPING_UNVERIFIABLE: 'info',
  UNMAPPED_SINGLE: 'warn',
  ORPHANS_PRESENT: 'warn',
  UNMAPPED_MULTIPLE: 'action_needed',
  STALE_MAPPING: 'action_needed',
  NOT_OWNED: 'action_needed'
};

/** Severity ordering for "highest severity wins" status selection. */
var SEVERITY_RANK_ = { ok: 0, info: 1, warn: 2, action_needed: 3 };

/* -------------------------------------------------------------------------- */
/*  Small private helpers                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Escapes a value for safe inclusion inside a single-quoted Drive query
 * literal (escapes backslash and single quote). Pure.
 *
 * @param {string} v
 * @returns {string}
 */
function escapeDriveQueryValue_(v) {
  return String(v == null ? '' : v).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

/**
 * Drive v3 read-only list with pagination. Returns the raw Files resources.
 * The ONLY Drive call here is Files.list (a read). Never writes.
 *
 * @param {string} q Drive query string.
 * @returns {!Array<Object>} Raw Drive Files resources.
 */
function driveListAll_(q) {
  var files = [];
  var pageToken = null;
  do {
    var resp = Drive.Files.list({
      q: q,
      pageSize: 100,
      fields: CANDIDATE_FIELDS_LIST_,
      pageToken: pageToken || undefined
    });
    if (resp && resp.files) {
      for (var i = 0; i < resp.files.length; i++) {
        files.push(resp.files[i]);
      }
    }
    pageToken = resp ? resp.nextPageToken : null;
  } while (pageToken);
  return files;
}

/**
 * Normalizes a list of raw Drive files into Candidate descriptors,
 * dropping any that normalize to null. Pure.
 *
 * @param {!Array<Object>} rawFiles
 * @param {string} email
 * @returns {!Array<Object>} Candidate descriptors.
 */
function normalizeList_(rawFiles, email) {
  var out = [];
  for (var i = 0; i < rawFiles.length; i++) {
    var cand = normalizeDriveFile_(rawFiles[i], email);
    if (cand) out.push(cand);
  }
  return out;
}

/**
 * De-duplicates Candidate descriptors by id, preserving first-seen order.
 * Pure.
 *
 * @param {!Array<Object>} candidates
 * @returns {!Array<Object>}
 */
function dedupeById_(candidates) {
  var seen = {};
  var out = [];
  for (var i = 0; i < candidates.length; i++) {
    var c = candidates[i];
    if (c && c.id && !seen[c.id]) {
      seen[c.id] = true;
      out.push(c);
    }
  }
  return out;
}

/**
 * Returns a predicate that keeps candidates whose id !== the given id. Pure.
 *
 * @param {string} id
 * @returns {function(Object):boolean}
 */
function notId_(id) {
  return function(c) { return c && c.id !== id; };
}

/**
 * Finds a candidate by id, or null. Pure.
 *
 * @param {!Array<Object>} candidates
 * @param {string} id
 * @returns {?Object}
 */
function findById_(candidates, id) {
  for (var i = 0; i < candidates.length; i++) {
    if (candidates[i] && candidates[i].id === id) return candidates[i];
  }
  return null;
}

/**
 * Truncates a long Drive ID for compact log lines (full IDs stay in the
 * structured object). Pure. Provided for the audit-logging slice.
 *
 * @param {string} id
 * @returns {string}
 */
function truncateId_(id) {
  var s = String(id == null ? '' : id);
  return s.length <= 8 ? s : (s.slice(0, 6) + '…');
}

/**
 * Sets status + derived severity on a report object. Mutates the report.
 *
 * @param {!Object} report
 * @param {string} status
 */
function setStatus_(report, status) {
  report.status = status;
  report.severity = STATUS_SEVERITY_[status] || 'info';
}

/**
 * Severity rank for a status (for "highest severity wins"). Pure.
 *
 * @param {string} status
 * @returns {number}
 */
function severityRank_(status) {
  return SEVERITY_RANK_[STATUS_SEVERITY_[status] || 'info'];
}

/* -------------------------------------------------------------------------- */
/*  Candidate detection (read-only)                                           */
/* -------------------------------------------------------------------------- */

/**
 * Finds app-visible candidate workbooks for a user via two read-only Drive
 * queries: marker-based (durable `cashcompass_email_hash`) and a name
 * fallback (`buildWorkbookName_(email)`), both constrained to the caller's
 * own, non-trashed Google spreadsheets.
 *
 * Read-only: the only Drive calls are Files.list (reads). No create/update/
 * trash. Coverage is `app_visible_only` (see plan § 3) — this is NOT a
 * complete view of the user's Drive.
 *
 * Drive infrastructure failures from Files.list are intentionally allowed to
 * propagate (loud) rather than being masked as "no candidates".
 *
 * @param {string} email Caller email (case-insensitive).
 * @returns {{byMarker: !Array<Object>, byName: !Array<Object>,
 *            merged: !Array<Object>, coverage: string}}
 */
function findCandidateWorkbooks_(email) {
  var emailLower = String(email == null ? '' : email).trim().toLowerCase();
  if (!emailLower) {
    return { byMarker: [], byName: [], merged: [], coverage: CANDIDATE_COVERAGE_ };
  }

  // Test-only 6F failure injection. This is inert unless the exact configured
  // disposable caller has enabled a per-user failure mode through the guarded
  // recovery fixture page.
  maybeInjectRecovery6fFailure_('search', emailLower, null);

  var expectedHash = buildMappingKey_(emailLower).slice(MAPPING_KEY_PREFIX_.length);
  var expectedName = buildWorkbookName_(emailLower);

  var base =
    "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false " +
    "and 'me' in owners";
  var markerQ = base +
    " and appProperties has { key='cashcompass_email_hash' and value='" +
    escapeDriveQueryValue_(expectedHash) + "' }";
  var nameQ = base + " and name='" + escapeDriveQueryValue_(expectedName) + "'";

  var byMarker = normalizeList_(driveListAll_(markerQ), emailLower);
  var byName = normalizeList_(driveListAll_(nameQ), emailLower);
  var merged = dedupeById_(byMarker.concat(byName));

  return {
    byMarker: byMarker,
    byName: byName,
    merged: merged,
    coverage: CANDIDATE_COVERAGE_
  };
}

/* -------------------------------------------------------------------------- */
/*  Mapped-workbook descriptor (read-only)                                    */
/* -------------------------------------------------------------------------- */

/**
 * Describes the workbook a mapping points at, using read-only calls only:
 * SpreadsheetApp.openById (the canonical "opens" test, matching the live
 * resolver) and Drive.Files.get for owner / trashed / name metadata. Expected
 * per-file failures (deleted / inaccessible target) are caught and reported as
 * not-opened — that is the STALE_MAPPING signal, not an error.
 *
 * @param {string} email
 * @param {string} mappedId
 * @returns {{present: boolean, id: string, opened: boolean, trashed: boolean,
 *            ownedByCaller: boolean, nameMatches: boolean, candidate: ?Object}}
 */
function describeMappedWorkbook_(email, mappedId) {
  var emailLower = String(email == null ? '' : email).trim().toLowerCase();
  var desc = {
    present: true,
    id: mappedId,
    opened: false,
    trashed: false,
    ownedByCaller: false,
    nameMatches: false,
    candidate: null
  };

  var meta = null;
  try {
    meta = Drive.Files.get(mappedId, { fields: CANDIDATE_FIELDS_SINGLE_ });
  } catch (_getErr) {
    meta = null;
  }

  try {
    var ss = SpreadsheetApp.openById(mappedId);
    desc.opened = !!ss;
    if (!meta && ss) {
      var expectedName = emailLower ? buildWorkbookName_(emailLower) : null;
      desc.nameMatches = !!(expectedName && ss.getName() === expectedName);
    }
  } catch (_openErr) {
    desc.opened = false;
  }

  if (meta) {
    var cand = normalizeDriveFile_(meta, emailLower);
    desc.candidate = cand;
    if (cand) {
      desc.trashed = cand.trashed;
      desc.ownedByCaller = cand.ownedByCaller;
      desc.nameMatches = cand.nameMatches;
    }
  }

  return desc;
}

/* -------------------------------------------------------------------------- */
/*  Classification (read-only)                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Classifies a user's workbook state by composing the mapping (source of
 * truth) with the app-visible candidate set. Read-only. Returns a
 * ClassificationReport (see plan § 6).
 *
 * The mapping is authoritative for "active" — never the Drive name. Statuses:
 * OK, NO_WORKBOOK, UNMAPPED_SINGLE, UNMAPPED_MULTIPLE, STALE_MAPPING,
 * ORPHANS_PRESENT, NAME_MISMATCH, NOT_OWNED. The highest-severity applicable
 * status is primary; lower-severity observations go in `flags`.
 *
 * @param {string} email Caller email (case-insensitive).
 * @returns {!Object} ClassificationReport.
 */
function classifyUserWorkbooks_(email) {
  var emailLower = String(email == null ? '' : email).trim().toLowerCase();
  if (!emailLower) {
    throw new Error('classifyUserWorkbooks_ requires a non-empty email.');
  }

  var emailHash = buildMappingKey_(emailLower).slice(MAPPING_KEY_PREFIX_.length);
  var report = {
    emailHash: emailHash,
    status: null,
    severity: null,
    flags: [],
    mapping: null,
    active: null,
    candidates: [],
    orphans: [],
    coverage: CANDIDATE_COVERAGE_,
    generatedAt: new Date().toISOString()
  };

  // Drive infra failures here propagate intentionally (see findCandidateWorkbooks_).
  var found = findCandidateWorkbooks_(emailLower);
  var candidates = found.merged;
  report.candidates = candidates;

  var mappedId = lookupSpreadsheetIdForUser_(emailLower);

  // --- No mapping -----------------------------------------------------------
  if (!mappedId) {
    report.mapping = {
      present: false, id: null, opened: false,
      trashed: false, ownedByCaller: false, nameMatches: false
    };
    report.orphans = candidates.slice();
    if (candidates.length === 0) {
      setStatus_(report, 'NO_WORKBOOK');
    } else if (candidates.length === 1) {
      setStatus_(report, 'UNMAPPED_SINGLE');
    } else {
      setStatus_(report, 'UNMAPPED_MULTIPLE');
    }
    return report;
  }

  // --- Mapping present ------------------------------------------------------
  var mapped = describeMappedWorkbook_(emailLower, mappedId);
  report.mapping = {
    present: true,
    id: mappedId,
    opened: mapped.opened,
    trashed: mapped.trashed,
    ownedByCaller: mapped.ownedByCaller,
    nameMatches: mapped.nameMatches
  };

  // Stale: mapped target won't open or is trashed.
  if (!mapped.opened || mapped.trashed) {
    report.orphans = candidates.filter(notId_(mappedId));
    setStatus_(report, 'STALE_MAPPING');
    return report;
  }

  // Opens & not trashed but owned by someone else.
  if (!mapped.ownedByCaller) {
    report.orphans = candidates.filter(notId_(mappedId));
    setStatus_(report, 'NOT_OWNED');
    return report;
  }

  // Healthy active workbook. Mapping is authoritative for "active".
  report.active = findById_(candidates, mappedId) || mapped.candidate || {
    id: mappedId, name: null, ownerEmail: null, ownedByCaller: true,
    createdTime: null, modifiedTime: null, trashed: false,
    hasMarker: false, markerHashMatches: false, markerProject: null,
    nameMatches: mapped.nameMatches, matchedBy: null
  };
  report.orphans = candidates.filter(notId_(mappedId));

  var observed = [];
  if (report.orphans.length >= 1) observed.push('ORPHANS_PRESENT');
  if (!mapped.nameMatches) observed.push('NAME_MISMATCH');
  if (observed.length === 0) observed.push('OK');

  observed.sort(function(a, b) { return severityRank_(b) - severityRank_(a); });
  setStatus_(report, observed[0]);
  for (var i = 1; i < observed.length; i++) {
    report.flags.push(observed[i]);
  }

  return report;
}

/**
 * Mapping-presence-only classification for a NON-self user. Read-only and
 * Drive-free: the ONLY data access is lookupSpreadsheetIdForUser_ (a script-
 * property read). It deliberately does NOT call findCandidateWorkbooks_,
 * describeMappedWorkbook_, SpreadsheetApp.openById, or Drive.Files.get.
 *
 * Rationale: under executeAs USER_ACCESSING + the drive.file scope, every
 * Drive/Sheets call runs as the operator, who has no access grant to another
 * user's workbook ID. Attempting inspection both fails ("permission to access
 * the requested document") and yields a false STALE_MAPPING. For non-self rows
 * the only honest, knowable fact is whether a mapping exists.
 *
 * @param {string} email Audited (non-self) email.
 * @returns {!Object} ClassificationReport-shaped object (Drive fields empty).
 */
function classifyNonSelfMappingOnly_(email) {
  var emailLower = String(email == null ? '' : email).trim().toLowerCase();
  var emailHash = emailLower
    ? buildMappingKey_(emailLower).slice(MAPPING_KEY_PREFIX_.length)
    : '';
  var report = {
    emailHash: emailHash,
    status: null,
    severity: null,
    flags: [],
    mapping: null,
    active: null,
    candidates: [],
    orphans: [],
    coverage: CANDIDATE_COVERAGE_,
    generatedAt: new Date().toISOString(),
    note: ''
  };

  var mappedId = lookupSpreadsheetIdForUser_(emailLower); // property read only

  if (mappedId) {
    report.mapping = {
      present: true, id: mappedId, opened: false,
      trashed: false, ownedByCaller: false, nameMatches: false
    };
    setStatus_(report, 'MAPPING_PRESENT_UNVERIFIABLE');
    report.note =
      'mapping present; workbook not operator-verifiable under drive.file';
  } else {
    report.mapping = {
      present: false, id: null, opened: false,
      trashed: false, ownedByCaller: false, nameMatches: false
    };
    setStatus_(report, 'NO_MAPPING_UNVERIFIABLE');
    report.note = 'no mapping found; Drive not inspected for non-self row';
  }

  return report;
}

/* -------------------------------------------------------------------------- */
/*  Admin audit wrappers (read-only, editor-run)                              */
/* -------------------------------------------------------------------------- */

/**
 * All eight classification statuses, used to seed totals and render the
 * all-allowlisted summary.
 */
var ALL_STATUSES_ = [
  'OK', 'NO_WORKBOOK', 'UNMAPPED_SINGLE', 'UNMAPPED_MULTIPLE',
  'STALE_MAPPING', 'ORPHANS_PRESENT', 'NAME_MISMATCH', 'NOT_OWNED',
  'MAPPING_PRESENT_UNVERIFIABLE', 'NO_MAPPING_UNVERIFIABLE'
];

/**
 * Audits a single user's workbook state. Read-only. Logs a readable summary
 * and returns the full ClassificationReport.
 *
 * Requires an EXPLICIT email — it intentionally does NOT default to the
 * current user. Rationale: the Drive-side portions of classification
 * (candidate detection, mapped-workbook open) run as the *executing* account,
 * so results are only Drive-accurate for whoever runs the script. Requiring an
 * explicit argument forces the operator to be deliberate about whose state
 * they are inspecting and avoids a silent "looks like it audited X but the
 * Drive view was actually mine" trap.
 *
 * @param {string} email Explicit caller email to audit.
 * @returns {!Object} ClassificationReport.
 */
function adminAuditUserWorkbook(email) {
  assertAdmin_();
  var emailLower = String(email == null ? '' : email).trim().toLowerCase();
  if (!emailLower) {
    throw new Error(
      'adminAuditUserWorkbook requires an explicit email argument, e.g. ' +
      'adminAuditUserWorkbook("user@example.com").'
    );
  }
  var report = classifyUserWorkbooks_(emailLower);
  logUserAuditReport_(emailLower, report);
  return report;
}

/**
 * Audits every allow-listed user. Read-only. Reads FAMILY_BETA_ALLOWLIST,
 * classifies each entry, logs a readable table, and returns a rollup.
 *
 * Drive coverage rule: only the row matching the EXECUTING operator is fully
 * classified (full classifyUserWorkbooks_). Every NON-self row is handled by
 * classifyNonSelfMappingOnly_ — a Drive-free, mapping-presence-only check —
 * because the operator cannot inspect another user's workbook under executeAs
 * USER_ACCESSING + drive.file. Non-self rows therefore never call
 * describeMappedWorkbook_ / findCandidateWorkbooks_ / openById / Drive.Files.get,
 * which removes both the false STALE_MAPPING and the permission error it caused.
 * Each report carries `driveAccurate` (true only for the self row).
 *
 * @returns {{generatedAt: string, coverage: string, executingUser: string,
 *            allowlistCount: number, totals: !Object<string,number>,
 *            errors: number, reports: !Array<Object>}}
 */
function adminAuditAllAllowlisted() {
  assertAdmin_();
  var execEmail = '';
  try { execEmail = getCurrentUserEmail_(); } catch (_e) { execEmail = ''; }

  var list = readAllowlist_();
  var totals = newStatusTotals_();
  var reports = [];
  var errors = 0;

  for (var i = 0; i < list.length; i++) {
    var email = list[i];
    var isSelf = (!!execEmail && email === execEmail);
    var driveAccurate = isSelf;
    try {
      // Self row: full Drive-backed classification. Non-self rows: mapping
      // presence only (no Drive/Sheets access — invalid under USER_ACCESSING).
      var report = isSelf
        ? classifyUserWorkbooks_(email)
        : classifyNonSelfMappingOnly_(email);
      report.auditedEmail = email;
      report.driveAccurate = driveAccurate;
      if (totals.hasOwnProperty(report.status)) {
        totals[report.status]++;
      }
      reports.push(report);
    } catch (rowErr) {
      errors++;
      reports.push({
        auditedEmail: email,
        driveAccurate: driveAccurate,
        status: 'ERROR',
        severity: 'action_needed',
        flags: [],
        candidates: [],
        orphans: [],
        active: null,
        error: (rowErr && rowErr.message ? rowErr.message : String(rowErr)),
        coverage: CANDIDATE_COVERAGE_,
        generatedAt: new Date().toISOString()
      });
    }
  }

  var result = {
    generatedAt: new Date().toISOString(),
    coverage: CANDIDATE_COVERAGE_,
    executingUser: execEmail || '(unknown)',
    allowlistCount: list.length,
    totals: totals,
    errors: errors,
    reports: reports
  };

  logAllowlistAuditTable_(result);
  return result;
}

/**
 * Raw candidate dump for one user (debugging). Read-only. Logs the full
 * candidate details (full IDs + normalized fields) and returns the
 * findCandidateWorkbooks_ object unchanged.
 *
 * @param {string} email Explicit caller email.
 * @returns {{byMarker: !Array<Object>, byName: !Array<Object>,
 *            merged: !Array<Object>, coverage: string}}
 */
function adminDumpUserCandidates(email) {
  assertAdmin_();
  var emailLower = String(email == null ? '' : email).trim().toLowerCase();
  if (!emailLower) {
    throw new Error(
      'adminDumpUserCandidates requires an explicit email argument, e.g. ' +
      'adminDumpUserCandidates("user@example.com").'
    );
  }
  var found = findCandidateWorkbooks_(emailLower);
  logCandidateDump_(emailLower, found);
  return found;
}

/* -------------------------------------------------------------------------- */
/*  Admin UI endpoints (gated, read-only — called via google.script.run)       */
/* -------------------------------------------------------------------------- */

/**
 * UI endpoint: compact self-test view model for the admin diagnostics page.
 * Gated by assertAdmin_(). Read-only. Returns a small JSON-friendly object
 * (no Drive writes, no mapping writes).
 *
 * @returns {{ok: boolean, generatedAt: string,
 *            rows: !Array<{label: string, ok: boolean, detail: string}>,
 *            failures: !Array<string>,
 *            executionContext: {centralModeEnabled: boolean,
 *                               currentUserEmailPresent: boolean}}}
 */
function adminUiGetSelfTest() {
  assertAdmin_();
  var res = adminDiagnosticsSelfTest();
  var c = res.checks || {};
  function row_(label, node) {
    node = node || {};
    return { label: label, ok: !!node.ok, detail: String(node.detail || '') };
  }
  return {
    ok: !!res.ok,
    generatedAt: String(res.generatedAt || ''),
    rows: [
      row_('Drive advanced service', c.driveAdvancedService),
      row_('Script properties', c.scriptProperties),
      row_('Allow-list', c.allowlist),
      row_('SpreadsheetApp service', c.spreadsheetService),
      row_('Session service', c.sessionService)
    ],
    failures: (res.failures || []).map(function(f) { return String(f); }),
    executionContext: {
      centralModeEnabled: !!(c.executionContext &&
        c.executionContext.centralModeEnabled),
      currentUserEmailPresent: !!(c.executionContext &&
        c.executionContext.currentUserEmailPresent)
    }
  };
}

/**
 * UI endpoint: allow-list audit table view model. Gated by assertAdmin_().
 * Read-only. Reuses adminAuditAllAllowlisted() and flattens each report into
 * a row the admin table can render directly.
 *
 * Coverage caveat is carried verbatim on the result and per-row via
 * `driveAccurate` — Drive-side fields are only accurate for the row matching
 * the executing operator.
 *
 * @returns {{generatedAt: string, coverage: string, executingUser: string,
 *            allowlistCount: number, errors: number,
 *            totals: !Object<string,number>,
 *            rows: !Array<Object>}}
 */
function adminUiGetWorkbookAudit() {
  assertAdmin_();

  // Defense-in-depth: if anything unexpected throws inside the audit, return a
  // sanitized failure payload (plain primitives) rather than failing the
  // google.script.run call with an opaque client-side error. Admin-gated, so
  // the error string is only ever seen by an admin.
  var res;
  try {
    res = adminAuditAllAllowlisted();
  } catch (auditErr) {
    return {
      generatedAt: new Date().toISOString(),
      coverage: CANDIDATE_COVERAGE_,
      executingUser: '',
      allowlistCount: 0,
      errors: 1,
      totals: {},
      rows: [],
      error: String(auditErr && auditErr.message ? auditErr.message : auditErr)
    };
  }

  // Treat `res` as untrusted: extract ONLY primitives into a fresh payload so
  // no ClassificationReport / Drive / Spreadsheet sub-object ever reaches the
  // google.script.run serializer (which surfaces as a misleading
  // "permission to access the requested document" failure on the client).
  var reports = (res && res.reports) ? res.reports : [];
  var rows = [];
  for (var i = 0; i < reports.length; i++) {
    rows.push(sanitizeAuditRow_(reports[i]));
  }

  var totalsOut = {};
  var rawTotals = (res && res.totals) ? res.totals : {};
  var keys = Object.keys(rawTotals);
  for (var k = 0; k < keys.length; k++) {
    totalsOut[String(keys[k])] = Number(rawTotals[keys[k]]) || 0;
  }

  return {
    generatedAt: String((res && res.generatedAt) || ''),
    coverage: String((res && res.coverage) || CANDIDATE_COVERAGE_),
    executingUser: String((res && res.executingUser) || ''),
    allowlistCount: Number((res && res.allowlistCount) || 0) || 0,
    errors: Number((res && res.errors) || 0) || 0,
    totals: totalsOut,
    rows: rows
  };
}

/**
 * Flattens a single (possibly partial/error) ClassificationReport into a plain
 * row of primitive strings/numbers/booleans only. PURE — no I/O. Never throws;
 * on any failure returns a sanitized ERROR row that still carries the email
 * when it could be read. Never includes full candidates, the active object,
 * the mapping object, full Drive IDs, or raw service/error objects.
 *
 * @param {Object} report
 * @returns {{user: string, status: string, severity: string,
 *            activeIdTrunc: string, candidateCount: number,
 *            orphanCount: number, driveAccurate: boolean, notes: string}}
 */
function sanitizeAuditRow_(report) {
  var r = report || {};
  var user = '';
  try { user = String(r.auditedEmail || ''); } catch (_e) { user = ''; }
  try {
    var activeId = (r.active && r.active.id) ? String(r.active.id) : '';
    var candN = (r.candidates && typeof r.candidates.length === 'number')
      ? r.candidates.length : 0;
    var orphN = (r.orphans && typeof r.orphans.length === 'number')
      ? r.orphans.length : 0;
    return {
      user: user,
      status: String(r.status || ''),
      severity: String(r.severity || ''),
      activeIdTrunc: activeId ? String(truncateId_(activeId)) : '-',
      candidateCount: Number(candN) || 0,
      orphanCount: Number(orphN) || 0,
      driveAccurate: (r.driveAccurate === true),
      notes: String(formatNotes_(r) || '-')
    };
  } catch (rowErr) {
    return {
      user: user,
      status: 'ERROR',
      severity: 'action_needed',
      activeIdTrunc: '-',
      candidateCount: 0,
      orphanCount: 0,
      driveAccurate: false,
      notes: 'row unavailable'
    };
  }
}

/**
 * UI endpoint (optional): compact single-user report view model. Gated by
 * assertAdmin_(). Read-only. Requires an explicit, non-empty email; throws a
 * generic error otherwise (no usage hints leaked to the client).
 *
 * @param {string} email Email to audit.
 * @returns {!Object} Compact report view model.
 */
function adminUiGetUserReport(email) {
  assertAdmin_();
  var emailLower = String(email == null ? '' : email).trim().toLowerCase();
  if (!emailLower) {
    throw new Error('A user email is required.');
  }
  // Treat the report as untrusted: emit ONLY primitives (no candidates,
  // active, mapping, full IDs, or service/error objects).
  var r = adminAuditUserWorkbook(emailLower) || {};
  var activeId = (r.active && r.active.id) ? String(r.active.id) : '';
  var candN = (r.candidates && typeof r.candidates.length === 'number')
    ? r.candidates.length : 0;
  var orphN = (r.orphans && typeof r.orphans.length === 'number')
    ? r.orphans.length : 0;
  var flags = [];
  if (r.flags && r.flags.length) {
    for (var i = 0; i < r.flags.length; i++) flags.push(String(r.flags[i]));
  }
  return {
    user: emailLower,
    generatedAt: String(r.generatedAt || ''),
    coverage: String(r.coverage || CANDIDATE_COVERAGE_),
    status: String(r.status || ''),
    severity: String(r.severity || ''),
    activeIdTrunc: activeId ? String(truncateId_(activeId)) : '-',
    candidateCount: Number(candN) || 0,
    orphanCount: Number(orphN) || 0,
    mappingPresent: !!(r.mapping && r.mapping.present),
    flags: flags,
    notes: String(formatNotes_(r) || '-')
  };
}

/* -------------------------------------------------------------------------- */
/*  Identity marker visibility (Phase 6B — read-only)                          */
/* -------------------------------------------------------------------------- */

/**
 * Read-only: reports whether the Phase 6B identity markers are present for a
 * user's mapped workbook — the Drive appProperties marker, the in-workbook
 * SYS - Meta marker, and the reverse index — plus whether each hash matches
 * the expected email hash. Pure-read; writes nothing.
 *
 * Coverage caveat: under executeAs USER_ACCESSING + drive.file, the Drive /
 * Sheets reads (appProperties, SYS - Meta) are only accurate for the row
 * matching the EXECUTING operator. The reverse-index check is a script-property
 * read and is accurate for any user. Drive/Sheets read failures are reported as
 * "not present/readable" rather than thrown.
 *
 * @param {string} email
 * @returns {!Object} presence/match flags (all primitives).
 */
function describeWorkbookIdentityMarkers_(email) {
  var emailLower = String(email == null ? '' : email).trim().toLowerCase();
  var out = {
    email: emailLower,
    mappingPresent: false,
    mappedIdTrunc: '-',
    appPropertiesMarkerPresent: false,
    appPropertiesHashMatches: false,
    sysMetaMarkerPresent: false,
    sysMetaHashMatches: false,
    reverseIndexPresent: false,
    reverseIndexHashMatches: false,
    note: ''
  };
  if (!emailLower) { out.note = 'empty email'; return out; }

  var expectedHash = buildMappingKey_(emailLower).slice(MAPPING_KEY_PREFIX_.length);
  var mappedId = lookupSpreadsheetIdForUser_(emailLower);
  if (!mappedId) { out.note = 'no mapping'; return out; }
  out.mappingPresent = true;
  out.mappedIdTrunc = truncateId_(mappedId);

  // Reverse index — pure property read (accurate for any user).
  var rev = lookupReverseIndex_(mappedId);
  out.reverseIndexPresent = !!rev;
  out.reverseIndexHashMatches = !!(rev && rev === expectedHash);

  // appProperties — operator-self accurate only.
  try {
    var meta = Drive.Files.get(mappedId, { fields: 'appProperties' });
    var ap = (meta && meta.appProperties) ? meta.appProperties : {};
    out.appPropertiesMarkerPresent = !!ap.cashcompass_email_hash;
    out.appPropertiesHashMatches =
      !!(ap.cashcompass_email_hash && ap.cashcompass_email_hash === expectedHash);
  } catch (_apErr) {
    out.note += (out.note ? '; ' : '') + 'appProperties not readable';
  }

  // In-sheet SYS - Meta — operator-self accurate only.
  try {
    var ss = SpreadsheetApp.openById(mappedId);
    var sheet = ss.getSheetByName(SYS_META_SHEET_NAME_);
    if (sheet) {
      var lastRow = Math.max(1, sheet.getLastRow());
      var vals = sheet.getRange(1, 1, lastRow, 2).getDisplayValues();
      for (var i = 0; i < vals.length; i++) {
        if (String(vals[i][0] || '').trim() === 'cashcompass_email_hash') {
          out.sysMetaMarkerPresent = true;
          out.sysMetaHashMatches = (String(vals[i][1] || '').trim() === expectedHash);
          break;
        }
      }
    }
  } catch (_smErr) {
    out.note += (out.note ? '; ' : '') + 'sys-meta not readable';
  }

  if (!out.note) out.note = '-';
  return out;
}

/**
 * Admin-gated, read-only marker check for a single user. Logs a readable
 * summary and returns the primitive flags from describeWorkbookIdentityMarkers_.
 * Requires an explicit email (same rationale as adminAuditUserWorkbook: Drive
 * reads run as the operator, so be deliberate about whose state is inspected).
 *
 * @param {string} email
 * @returns {!Object}
 */
function adminCheckWorkbookMarkers(email) {
  assertAdmin_();
  var emailLower = String(email == null ? '' : email).trim().toLowerCase();
  if (!emailLower) {
    throw new Error(
      'adminCheckWorkbookMarkers requires an explicit email argument, e.g. ' +
      'adminCheckWorkbookMarkers("user@example.com").'
    );
  }
  var d = describeWorkbookIdentityMarkers_(emailLower);
  var lines = [];
  lines.push('CashCompass Identity Markers — ' + emailLower +
    ' — ' + new Date().toISOString());
  lines.push('Coverage: ' + CANDIDATE_COVERAGE_ +
    ' (appProperties/SYS-Meta accurate for operator-self only)');
  lines.push('Mapping: present=' + d.mappingPresent + ' id=' + d.mappedIdTrunc);
  lines.push('appProperties: present=' + d.appPropertiesMarkerPresent +
    ' hashMatch=' + d.appPropertiesHashMatches);
  lines.push('SYS - Meta:    present=' + d.sysMetaMarkerPresent +
    ' hashMatch=' + d.sysMetaHashMatches);
  lines.push('Reverse index: present=' + d.reverseIndexPresent +
    ' hashMatch=' + d.reverseIndexHashMatches);
  lines.push('Note: ' + d.note);
  Logger.log(lines.join('\n'));
  return d;
}

/* -------------------------------------------------------------------------- */
/*  Admin repair toolkit (Phase 6E.1 — admin + flag gated, mapping-store only) */
/* -------------------------------------------------------------------------- */

/**
 * Script-property key holding the bounded admin audit ring buffer (a JSON array,
 * newest-first, capped at ADMIN_AUDIT_MAX_ENTRIES_). Lightweight + durable; no
 * workbook or Drive storage involved.
 */
var ADMIN_AUDIT_KEY_ = 'adminlog::entries';
var ADMIN_AUDIT_MAX_ENTRIES_ = 50;

/**
 * Truncated email hash for audit/inspection output. Derives the SHA-256 email
 * hash (same as the mapping key) and truncates it. Never emits a raw email.
 *
 * @param {string} email
 * @returns {string} truncated hash, or '-' when empty/unavailable.
 */
function adminAuditHashTrunc_(email) {
  var e = String(email == null ? '' : email).trim().toLowerCase();
  if (!e) return '-';
  try {
    return truncateId_(buildMappingKey_(e).slice(MAPPING_KEY_PREFIX_.length));
  } catch (_e) {
    return '-';
  }
}

/**
 * Appends one entry to the bounded admin audit ring buffer (Phase 6E.1). Best-
 * effort: never throws and never blocks the calling action — on any failure it
 * falls back to Logger only. Stores ONLY non-sensitive primitives: timestamp,
 * truncated admin hash, truncated target hash, action, result, and an optional
 * already-truncated detail string (never a raw ID or email).
 *
 * @param {string} action e.g. 'clear_mapping'.
 * @param {string} targetEmail Target user email (hashed+truncated before store).
 * @param {string} result e.g. 'cleared' | 'noop' | 'error'.
 * @param {string=} detail Optional already-truncated detail (e.g. mapped id trunc).
 */
function appendAdminAudit_(action, targetEmail, result, detail) {
  try {
    var operatorEmail = '';
    try { operatorEmail = getCurrentUserEmail_(); } catch (_o) { operatorEmail = ''; }

    var entry = {
      ts: new Date().toISOString(),
      adminHash: adminAuditHashTrunc_(operatorEmail),
      targetHash: adminAuditHashTrunc_(targetEmail),
      action: String(action || ''),
      result: String(result || ''),
      detail: String(detail || '')
    };

    var props = PropertiesService.getScriptProperties();
    var arr = [];
    try {
      var raw = props.getProperty(ADMIN_AUDIT_KEY_);
      if (raw) arr = JSON.parse(raw);
      if (!Array.isArray(arr)) arr = [];
    } catch (_p) {
      arr = [];
    }
    arr.unshift(entry);
    if (arr.length > ADMIN_AUDIT_MAX_ENTRIES_) {
      arr = arr.slice(0, ADMIN_AUDIT_MAX_ENTRIES_);
    }
    props.setProperty(ADMIN_AUDIT_KEY_, JSON.stringify(arr));

    Logger.log('[6E1] audit ' + entry.action + ' result=' + entry.result +
      ' admin=' + entry.adminHash + ' target=' + entry.targetHash +
      (entry.detail ? ' detail=' + entry.detail : ''));
  } catch (e) {
    try {
      Logger.log('[6E1] audit append failed: ' +
        (e && e.message ? e.message : String(e)));
    } catch (_l) { /* swallow */ }
  }
}

/**
 * Admin-gated, read-only accessor for the audit ring buffer (Phase 6E.1).
 * Returns primitives only (already truncated hashes / details).
 *
 * @returns {{entries: !Array<Object>, max: number}}
 */
function adminGetAuditLog() {
  assertAdmin_();
  var props = PropertiesService.getScriptProperties();
  var arr = [];
  try {
    var raw = props.getProperty(ADMIN_AUDIT_KEY_);
    if (raw) arr = JSON.parse(raw);
    if (!Array.isArray(arr)) arr = [];
  } catch (_p) {
    arr = [];
  }
  var out = [];
  for (var i = 0; i < arr.length; i++) {
    var e = arr[i] || {};
    out.push({
      ts: String(e.ts || ''),
      adminHash: String(e.adminHash || '-'),
      targetHash: String(e.targetHash || '-'),
      action: String(e.action || ''),
      result: String(e.result || ''),
      detail: String(e.detail || '')
    });
  }
  return { entries: out, max: ADMIN_AUDIT_MAX_ENTRIES_ };
}

/**
 * Admin-gated, read-only inspection of a user's mapping/recovery state
 * (Phase 6E.1). The mandatory preview before any clear.
 *
 * Self (operator IS the target): full Drive-accurate classification (status,
 * severity, candidate/orphan counts) plus identity-marker flags.
 *
 * Other user: mapping presence + truncated mapped ID + reverse-index
 * consistency only — all pure script-property reads. Deliberately does NOT
 * openById the workbook or enumerate the operator's Drive on their behalf
 * (cross-user Drive access is impossible under drive.file and would mislead).
 *
 * Returns primitives only — no raw spreadsheet IDs, no candidate objects.
 *
 * @param {string} email
 * @returns {!Object}
 */
function adminInspectUser(email) {
  assertAdmin_();
  var emailLower = String(email == null ? '' : email).trim().toLowerCase();
  if (!emailLower) {
    throw new Error('A user email is required.');
  }

  var selfEmail = '';
  try { selfEmail = getCurrentUserEmail_(); } catch (_s) { selfEmail = ''; }
  var isSelf = !!selfEmail && (selfEmail === emailLower);

  var out = {
    user: emailLower,
    isSelf: isSelf,
    mappingPresent: false,
    mappedIdTrunc: '-',
    reverseIndexPresent: false,
    reverseIndexHashMatches: false,
    status: '',
    severity: '',
    candidateCount: 0,
    orphanCount: 0,
    markers: {
      appPropertiesMarkerPresent: false,
      appPropertiesHashMatches: false,
      sysMetaMarkerPresent: false,
      sysMetaHashMatches: false
    },
    coverage: CANDIDATE_COVERAGE_,
    note: '',
    generatedAt: new Date().toISOString()
  };

  // Mapping + reverse index are pure script-property reads — accurate for ANY
  // user and never touch Drive.
  var expectedHash = buildMappingKey_(emailLower).slice(MAPPING_KEY_PREFIX_.length);
  var mappedId = lookupSpreadsheetIdForUser_(emailLower);
  out.mappingPresent = !!mappedId;
  if (mappedId) {
    out.mappedIdTrunc = truncateId_(mappedId);
    var rev = lookupReverseIndex_(mappedId);
    out.reverseIndexPresent = !!rev;
    out.reverseIndexHashMatches = !!(rev && rev === expectedHash);
  }

  if (isSelf) {
    try {
      var rep = classifyUserWorkbooks_(emailLower);
      out.status = String(rep.status || '');
      out.severity = String(rep.severity || '');
      out.candidateCount = (rep.candidates && rep.candidates.length) || 0;
      out.orphanCount = (rep.orphans && rep.orphans.length) || 0;
    } catch (_cErr) {
      out.note = 'self classification unavailable';
    }
    try {
      var m = describeWorkbookIdentityMarkers_(emailLower);
      out.markers.appPropertiesMarkerPresent = !!m.appPropertiesMarkerPresent;
      out.markers.appPropertiesHashMatches = !!m.appPropertiesHashMatches;
      out.markers.sysMetaMarkerPresent = !!m.sysMetaMarkerPresent;
      out.markers.sysMetaHashMatches = !!m.sysMetaHashMatches;
    } catch (_mErr) { /* leave marker flags false */ }
  } else {
    var rep2 = classifyNonSelfMappingOnly_(emailLower);
    out.status = String(rep2.status || '');
    out.severity = String(rep2.severity || '');
    out.note = 'cross-user: Drive not inspected (drive.file scope)';
  }

  return out;
}

/**
 * Admin-gated, flag-gated, confirm-gated repair WRITE (Phase 6E.1): clears a
 * user's mapping (and its supplementary reverse-index trace). Mapping-store
 * ONLY — it deletes script properties and performs NO Drive access, NO file
 * deletion, and NO workbook modification. The workbook (if any) remains intact
 * in the owner's Drive; clearing the mapping merely lets the user's next open
 * re-provision/adopt (per flags) or reach the recovery page.
 *
 * assertAdmin_ runs first and throws for non-admins (consistent with the other
 * admin endpoints). Everything else returns primitive status values:
 *   - { status: 'cleared', mappedIdTrunc } : a mapping existed and was removed.
 *   - { status: 'noop' }                   : no mapping to clear.
 *   - { status: 'disabled' }               : central mode off or repair flag off.
 *   - { status: 'error' }                  : empty email, missing confirm, or
 *                                            unexpected failure.
 *
 * @param {string} email Target user email (admin-typed; never client-trusted
 *   for authorization — authorization is assertAdmin_).
 * @param {string} confirm Must equal the literal 'CONFIRM'.
 * @returns {{status: string, mappedIdTrunc: (string|undefined)}}
 */
function adminClearMapping(email, confirm) {
  assertAdmin_();
  try {
    if (!isCentralModeEnabled_()) {
      return { status: 'disabled' };
    }
    if (!isAdminRepairEnabled_()) {
      return { status: 'disabled' };
    }

    var emailLower = String(email == null ? '' : email).trim().toLowerCase();
    if (!emailLower) {
      return { status: 'error' };
    }

    // Explicit confirm token required — a stray or accidental call cannot mutate.
    if (String(confirm) !== 'CONFIRM') {
      return { status: 'error' };
    }

    var mappedId = lookupSpreadsheetIdForUser_(emailLower);
    if (!mappedId) {
      appendAdminAudit_('clear_mapping', emailLower, 'noop', 'no-map');
      return { status: 'noop' };
    }

    var mappedIdTrunc = truncateId_(mappedId);

    // Mapping-store only: forward mapping + supplementary reverse-index trace.
    clearMappingForUser_(emailLower);
    var revCleared = clearReverseIndexForWorkbook_(mappedId);

    appendAdminAudit_('clear_mapping', emailLower, 'cleared',
      mappedIdTrunc + (revCleared ? '+rev' : ''));
    return { status: 'cleared', mappedIdTrunc: mappedIdTrunc };
  } catch (e) {
    try { appendAdminAudit_('clear_mapping', email, 'error', ''); } catch (_a) {}
    return { status: 'error' };
  }
}

/* -------------------------------------------------------------------------- */
/*  Logger helpers (read-only formatting)                                      */
/* -------------------------------------------------------------------------- */

/** Builds a fresh {status: 0} totals object covering all statuses. */
function newStatusTotals_() {
  var t = {};
  for (var i = 0; i < ALL_STATUSES_.length; i++) {
    t[ALL_STATUSES_[i]] = 0;
  }
  return t;
}

/** Right-pads a string to width n (for fixed-width table columns). Pure. */
function padRight_(s, n) {
  s = String(s == null ? '' : s);
  if (s.length >= n) return s;
  return s + new Array(n - s.length + 1).join(' ');
}

/** Repeats a character n times. Pure. */
function repeat_(ch, n) {
  return new Array(n + 1).join(ch);
}

/**
 * Builds the compact NOTES string for a table row. Pure; tolerant of
 * partial/error report objects.
 *
 * @param {!Object} report
 * @returns {string}
 */
function formatNotes_(report) {
  // An explicit note (set by the non-self mapping-only path) is authoritative.
  if (report.note) return String(report.note);
  var parts = [];
  if (report.error) parts.push('ERROR: ' + report.error);
  if (report.flags && report.flags.length) {
    parts.push('flags: ' + report.flags.join(','));
  }
  var orphanN = report.orphans ? report.orphans.length : 0;
  if (orphanN) parts.push(orphanN + ' orphan' + (orphanN === 1 ? '' : 's'));
  if (report.status === 'STALE_MAPPING') parts.push('mapped target unopenable/trashed');
  if (report.status === 'NOT_OWNED') parts.push('owner != caller');
  if (report.hasOwnProperty('driveAccurate') && !report.driveAccurate) {
    parts.push('drive=operator');
  }
  return parts.length ? parts.join('; ') : '-';
}

/**
 * Logs a readable single-user audit summary. Read-only. IDs are truncated in
 * the log; full IDs remain in the returned object.
 *
 * @param {string} email
 * @param {!Object} report
 */
function logUserAuditReport_(email, report) {
  var lines = [];
  lines.push('CashCompass Workbook Audit (single user) — ' + report.generatedAt);
  lines.push('Coverage: ' + report.coverage +
    ' (drive.file — NOT a complete view of Drive)');
  lines.push('Email: ' + email + '   (hash ' + truncateId_(report.emailHash) + ')');
  lines.push('Status: ' + report.status + '   Severity: ' + report.severity);
  lines.push('Flags: ' +
    ((report.flags && report.flags.length) ? report.flags.join(', ') : '-'));

  var m = report.mapping || {};
  lines.push('Mapping: present=' + !!m.present +
    ' id=' + (m.id ? truncateId_(m.id) : '—') +
    ' opened=' + !!m.opened +
    ' trashed=' + !!m.trashed +
    ' owned=' + !!m.ownedByCaller +
    ' nameMatch=' + !!m.nameMatches);

  if (report.active) {
    lines.push('Active: ' + truncateId_(report.active.id) +
      '  name=' + (report.active.name || '(unknown)') +
      '  matchedBy=' + (report.active.matchedBy || '-'));
  } else {
    lines.push('Active: (none)');
  }

  lines.push('Candidates (' + report.candidates.length + '):');
  for (var i = 0; i < report.candidates.length; i++) {
    lines.push('  - ' + fmtCandidateLine_(report.candidates[i]));
  }
  lines.push('Orphans (' + report.orphans.length + '):');
  for (var j = 0; j < report.orphans.length; j++) {
    lines.push('  - ' + fmtCandidateLine_(report.orphans[j]));
  }

  Logger.log(lines.join('\n'));
}

/** One-line candidate summary for the single-user log (truncated id). Pure. */
function fmtCandidateLine_(c) {
  if (!c) return '(null)';
  return truncateId_(c.id) +
    '  matchedBy=' + (c.matchedBy || '-') +
    ' owned=' + !!c.ownedByCaller +
    ' marker=' + !!c.hasMarker +
    ' name=' + (c.name || '(unknown)');
}

/**
 * Logs the all-allowlisted audit table. Read-only.
 *
 * @param {!Object} result Output of adminAuditAllAllowlisted().
 */
function logAllowlistAuditTable_(result) {
  var lines = [];
  lines.push('CashCompass Workbook Audit — all allow-listed — ' + result.generatedAt);
  lines.push('Coverage: ' + result.coverage +
    ' (drive.file — NOT a complete view of Drive)');
  lines.push('Executing as: ' + result.executingUser +
    '  (Drive-side fields accurate only for this row; other rows = mapping ' +
    'presence + this operator\'s Drive view)');
  lines.push('Allow-listed: ' + result.allowlistCount + '   Errors: ' + result.errors);
  lines.push(repeat_('-', 110));
  lines.push(
    padRight_('EMAIL', 30) + ' ' +
    padRight_('STATUS', 18) + ' ' +
    padRight_('SEVERITY', 14) + ' ' +
    padRight_('ACTIVE_ID', 10) + ' ' +
    padRight_('#CAND', 6) + ' NOTES'
  );
  lines.push(repeat_('-', 110));

  for (var i = 0; i < result.reports.length; i++) {
    var r = result.reports[i];
    var activeId = (r.active && r.active.id) ? truncateId_(r.active.id) : '—';
    var candN = r.candidates ? r.candidates.length : 0;
    lines.push(
      padRight_(r.auditedEmail, 30) + ' ' +
      padRight_(r.status, 18) + ' ' +
      padRight_(r.severity || '', 14) + ' ' +
      padRight_(activeId, 10) + ' ' +
      padRight_(String(candN), 6) + ' ' +
      formatNotes_(r)
    );
  }

  lines.push(repeat_('-', 110));
  var totalParts = [];
  for (var s = 0; s < ALL_STATUSES_.length; s++) {
    totalParts.push(ALL_STATUSES_[s] + ' ' + result.totals[ALL_STATUSES_[s]]);
  }
  var totalsLine = 'Totals: ' + totalParts.join(' | ');
  if (result.errors) totalsLine += ' | ERROR ' + result.errors;
  lines.push(totalsLine);

  Logger.log(lines.join('\n'));
}

/**
 * Logs the raw candidate dump for one user (debugging). Read-only. Uses full
 * IDs via JSON for copy/paste investigation.
 *
 * @param {string} email
 * @param {!Object} found Output of findCandidateWorkbooks_.
 */
function logCandidateDump_(email, found) {
  var lines = [];
  lines.push('CashCompass Candidate Dump — ' + email + ' — ' +
    new Date().toISOString());
  lines.push('Coverage: ' + found.coverage +
    ' (drive.file — NOT a complete view of Drive)');
  lines.push('byMarker=' + found.byMarker.length +
    ' byName=' + found.byName.length +
    ' merged=' + found.merged.length);
  lines.push('-- merged (normalized, full IDs) --');
  for (var i = 0; i < found.merged.length; i++) {
    lines.push('  ' + JSON.stringify(found.merged[i]));
  }
  Logger.log(lines.join('\n'));
}
