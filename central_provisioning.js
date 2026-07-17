/**
 * Central App provisioning — allow-list gate, per-user workbook
 * lookup / provisioning, mapping store, and partial-failure cleanup.
 *
 * This is the operational logic for the second central-mode
 * implementation slice. The resolver file (`central_resolver.js`)
 * stays small and seam-like; everything below lives here so revert
 * = delete this file + revert two small functions in
 * `central_resolver.js` and `webapp.js`.
 *
 * Cross-references:
 *   - CENTRAL_APP_RESOLVER_PROVISIONING_IMPLEMENTATION_PROMPT.md
 *   - CENTRAL_APP_WORKBOOK_CREATION_FIRST_SLICE_PLAN.md
 *   - CENTRAL_APP_DEPLOYMENT_PREPARATION_PLAN.md
 *
 * Invariants enforced here (do not extend without an explicit
 * follow-up planning doc):
 *   - CENTRAL_MODE defaults to off; behavior is fail-closed.
 *   - Allow-list runs on every doGet regardless of CENTRAL_MODE.
 *   - Empty allow-list = nobody allowed.
 *   - Mapping key is `mapping::` + SHA-256 hex of lowercase email.
 *     Raw emails are never stored in script properties.
 *   - User-owned workbook in Drive root only; no template copy, no
 *     folder placement.
 *   - LockService.getUserLock() serializes provisioning per user
 *     with a 30 s tryLock and a double-check inside the lock.
 *   - Partial-failure cleanup uses soft delete (setTrashed). Hard
 *     delete is intentionally forbidden in the first slice.
 *   - Missing/stale mappings always run candidate detection before any create
 *     decision. Search uncertainty never falls through to Drive create.
 *   - Bootstrap is exactly one call: ensureInputSettingsSheet_(ss).
 *     Every other ensure helper is invoked lazily as the user
 *     navigates the dashboard.
 */

/* -------------------------------------------------------------------------- */
/*  Constants                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Script-property keys. All keys live in
 * PropertiesService.getScriptProperties().
 */
var CENTRAL_MODE_KEY_ = 'CENTRAL_MODE';
var FAMILY_BETA_ALLOWLIST_KEY_ = 'FAMILY_BETA_ALLOWLIST';
var BETA_CONTACT_EMAIL_KEY_ = 'BETA_CONTACT_EMAIL';
var MAPPING_KEY_PREFIX_ = 'mapping::';

/**
 * Single-candidate auto-adopt flag (Phase 6C / recovery completion). Candidate
 * detection is unconditional; this flag controls only whether a single
 * MEDIUM-confidence, name-only candidate is adopted automatically or requires
 * an explicit user confirmation. HIGH-confidence marker candidates are safe to
 * relink automatically. Read by isAutoAdoptEnabled_().
 *
 * Fail-closed, exactly like CENTRAL_MODE: only the literal string "true"
 * enables it; unset / anything else = OFF. OFF never disables candidate
 * detection and never permits a silent duplicate.
 */
var CENTRAL_AUTO_ADOPT_KEY_ = 'CENTRAL_AUTO_ADOPT';

/**
 * Recovery actions flag (Phase 6D.2a). Controls whether the user-initiated,
 * self-scoped reconnect action is offered on general recovery pages. The
 * explicit one-candidate confirmation path is always available in central mode.
 * Read by isRecoveryActionsEnabled_().
 *
 * Fail-closed, exactly like CENTRAL_MODE / CENTRAL_AUTO_ADOPT: only the literal
 * string "true" enables it; unset / anything else = OFF. While OFF, general
 * recovery pages stay display-only; this does not disable the self-scoped
 * confirmation endpoint.
 */
var CENTRAL_RECOVERY_ACTIONS_KEY_ = 'CENTRAL_RECOVERY_ACTIONS';

/**
 * Admin repair flag (Phase 6E.1). Gates admin-initiated repair WRITES (clearing
 * a stale mapping). Independent of every other flag: admin read-only inspection
 * is governed only by isAdminUser_; this flag adds a second, separately
 * flippable gate in front of the mutating action.
 *
 * Fail-closed, exactly like the other central flags: only the literal string
 * "true" enables it; unset / anything else = OFF. While OFF, adminClearMapping
 * refuses and the repair card stays preview-only — dark until flipped on a test
 * deployment.
 */
var CENTRAL_ADMIN_REPAIR_KEY_ = 'CENTRAL_ADMIN_REPAIR';

/**
 * Reverse-index key prefix (Phase 6B). Maps a spreadsheet ID back to the
 * owning user's email hash: `wbid::<spreadsheetId>` -> <email_hash>. This is
 * a SUPPLEMENTARY trace aid only — the forward `mapping::` store remains the
 * single source of truth for "which workbook is active". The reverse index is
 * written best-effort and its absence never affects resolution.
 */
var REVERSE_INDEX_KEY_PREFIX_ = 'wbid::';

/**
 * Name of the hidden in-workbook identity marker sheet (Phase 6B). Holds a
 * small key/value copy of the durable identity fields so identity survives
 * even if Drive file-level appProperties are stripped, and so a Drive "Make a
 * copy" (which copies sheet content but NOT appProperties) can later be
 * recognized as a duplicate. Follows the existing `SYS - …` reserved-sheet
 * convention. Cosmetic/metadata only — no reader depends on it.
 */
var SYS_META_SHEET_NAME_ = 'SYS - Meta';

/**
 * Lock semantics. 30 seconds is long enough for a single provisioning
 * pass (Drive create + openById + ensureInputSettingsSheet_ +
 * properties write); short enough that a stuck lock surfaces fast.
 */
var PROVISIONING_LOCK_TIMEOUT_MS_ = 30000;

/**
 * Workbook naming. The user's email appears in the title so the file
 * is recognizable in their Drive. A later slice may switch to a
 * generic "CashCompass" title if privacy considerations change.
 *
 * The em dash is U+2014 (UTF-8 bytes e2 80 94), matching the
 * naming convention pinned in
 * CENTRAL_APP_WORKBOOK_CREATION_FIRST_SLICE_PLAN.md § 7.2.
 */
function buildWorkbookName_(email) {
  return 'CashCompass — ' + email;
}

/* -------------------------------------------------------------------------- */
/*  Allow-list                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Reads FAMILY_BETA_ALLOWLIST from script properties, splits on
 * commas, trims, lowercases, and returns the resulting array. An
 * unset / empty property returns an empty array (which causes
 * isAllowlistedUser_ to return false for every caller — fail-closed).
 *
 * Never throws.
 */
function readAllowlist_() {
  try {
    var raw = PropertiesService.getScriptProperties()
      .getProperty(FAMILY_BETA_ALLOWLIST_KEY_) || '';
    return raw.split(',')
      .map(function(s) { return String(s || '').trim().toLowerCase(); })
      .filter(function(s) { return s.length > 0; });
  } catch (_e) {
    return [];
  }
}

/**
 * Returns true iff getCurrentUserEmail_() is on the allow-list. An
 * empty caller email always returns false. Never throws.
 */
function isAllowlistedUser_() {
  var email = getCurrentUserEmail_();
  if (!email) return false;
  var list = readAllowlist_();
  for (var i = 0; i < list.length; i++) {
    if (list[i] === email) return true;
  }
  return false;
}

/**
 * Renders the private-beta rejection HtmlOutput shown to any caller
 * not on the allow-list. No data is loaded, no resolver is called,
 * no Drive write happens. The output is intentionally bland — no
 * branding, no email collection form, no "contact us" link.
 *
 * The developer's contact email is read from the optional
 * BETA_CONTACT_EMAIL script property so the message can be updated
 * without a code change. If the property is unset, falls back to a
 * generic message.
 *
 * The contact email is HTML-escaped before being interpolated into
 * the response body.
 */
function renderAllowlistRejection_() {
  var contact = '';
  try {
    contact = String(PropertiesService.getScriptProperties()
      .getProperty(BETA_CONTACT_EMAIL_KEY_) || '').trim();
  } catch (_e) {
    contact = '';
  }

  var contactSafe = contact
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  var html = '<!DOCTYPE html><html><head>' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<base target="_top">' +
    '<title>CashCompass — Private Beta</title>' +
    '<style>' +
    'body{font-family:Arial,sans-serif;padding:32px;max-width:480px;' +
    'margin:48px auto;color:#222;line-height:1.5;}' +
    'h1{font-size:18px;margin:0 0 12px 0;}' +
    'p{margin:0 0 12px 0;}' +
    '</style></head><body>' +
    '<h1>CashCompass — Private Beta</h1>' +
    '<p>CashCompass is currently in private beta and is not yet open to ' +
    'new users.</p>' +
    (contactSafe
      ? '<p>If you believe you should have access, please contact ' +
        contactSafe + '.</p>'
      : '<p>If you believe you should have access, please contact the ' +
        'project owner.</p>') +
    '</body></html>';

  return HtmlService.createHtmlOutput(html)
    .setTitle('CashCompass — Private Beta');
}

/* -------------------------------------------------------------------------- */
/*  Mapping key + storage                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Computes the script-property key for a given email. Uses SHA-256
 * over the lowercase email and prefixes with "mapping::". This
 * avoids storing the full email in plaintext in script properties
 * while keeping the lookup deterministic.
 *
 * Throws if email is empty (which would always be a programmer
 * error — callers must check getCurrentUserEmail_() first).
 */
function buildMappingKey_(email) {
  if (!email) {
    throw new Error('buildMappingKey_ requires a non-empty email.');
  }
  var bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(email).toLowerCase()
  );
  var hex = '';
  for (var i = 0; i < bytes.length; i++) {
    var b = bytes[i];
    if (b < 0) b += 256;
    var s = b.toString(16);
    hex += (s.length === 1 ? '0' : '') + s;
  }
  return MAPPING_KEY_PREFIX_ + hex;
}

/**
 * Looks up the persisted spreadsheet ID for the given email.
 * Returns the ID string, or null if no mapping exists.
 * Never throws.
 */
function lookupSpreadsheetIdForUser_(email) {
  try {
    var key = buildMappingKey_(email);
    var id = PropertiesService.getScriptProperties().getProperty(key);
    return id || null;
  } catch (_e) {
    return null;
  }
}

/**
 * Persists the spreadsheet ID for the given email. Throws on
 * PropertiesService failure so callers (provisionWorkbookForUser_)
 * can roll back the just-created file.
 */
function writeSpreadsheetIdForUser_(email, spreadsheetId) {
  if (!spreadsheetId) {
    throw new Error('writeSpreadsheetIdForUser_ requires a non-empty id.');
  }
  var key = buildMappingKey_(email);
  PropertiesService.getScriptProperties().setProperty(key, spreadsheetId);
}

/**
 * Deletes the mapping for the given email. Exposed for manual
 * recovery (e.g., developer clearing a stale mapping from the
 * Apps Script editor's Run dialog). NOT called automatically in
 * the first slice. Never throws.
 */
function clearMappingForUser_(email) {
  try {
    var key = buildMappingKey_(email);
    PropertiesService.getScriptProperties().deleteProperty(key);
  } catch (_e) {
    // swallow
  }
}

/* -------------------------------------------------------------------------- */
/*  Reverse index (Phase 6B — supplementary trace, never authoritative)       */
/* -------------------------------------------------------------------------- */

/**
 * Builds the reverse-index script-property key for a spreadsheet ID.
 * Throws on empty id (always a programmer error).
 *
 * @param {string} spreadsheetId
 * @returns {string} `wbid::<spreadsheetId>`
 */
function buildReverseIndexKey_(spreadsheetId) {
  if (!spreadsheetId) {
    throw new Error('buildReverseIndexKey_ requires a non-empty spreadsheet id.');
  }
  return REVERSE_INDEX_KEY_PREFIX_ + String(spreadsheetId);
}

/**
 * Reads the reverse-index entry (email hash) for a spreadsheet ID, or null.
 * Never throws.
 *
 * @param {string} spreadsheetId
 * @returns {?string} email hash, or null when no entry exists.
 */
function lookupReverseIndex_(spreadsheetId) {
  try {
    return PropertiesService.getScriptProperties()
      .getProperty(buildReverseIndexKey_(spreadsheetId)) || null;
  } catch (_e) {
    return null;
  }
}

/**
 * Writes the reverse-index entry `wbid::<id>` -> <email_hash> if absent.
 * Idempotent (no-op when already present). Best-effort: never throws — the
 * reverse index is supplementary and must never break provisioning or
 * resolution.
 *
 * @param {string} spreadsheetId
 * @param {string} email
 * @returns {boolean} true if a new entry was written, false on no-op/failure.
 */
function ensureReverseIndexForWorkbook_(spreadsheetId, email) {
  try {
    if (!spreadsheetId || !email) return false;
    var key = buildReverseIndexKey_(spreadsheetId);
    var props = PropertiesService.getScriptProperties();
    if (props.getProperty(key)) return false;
    var hash = buildMappingKey_(email).slice(MAPPING_KEY_PREFIX_.length);
    props.setProperty(key, hash);
    return true;
  } catch (_e) {
    return false;
  }
}

/**
 * Deletes the reverse-index entry `wbid::<id>` if present (Phase 6E.1). Pairs
 * with clearMappingForUser_ so an admin clearing a stale mapping can also remove
 * the supplementary reverse-index trace. Touches only a script property — no
 * Drive access, no file mutation. Never throws.
 *
 * @param {string} spreadsheetId
 * @returns {boolean} true if an entry was deleted, false on no-op/failure.
 */
function clearReverseIndexForWorkbook_(spreadsheetId) {
  try {
    if (!spreadsheetId) return false;
    var key = buildReverseIndexKey_(spreadsheetId);
    var props = PropertiesService.getScriptProperties();
    if (!props.getProperty(key)) return false;
    props.deleteProperty(key);
    return true;
  } catch (_e) {
    return false;
  }
}

/* -------------------------------------------------------------------------- */
/*  Workbook identity markers (Phase 6B — additive, best-effort, idempotent)  */
/* -------------------------------------------------------------------------- */

/**
 * Stamps the durable Drive file-level appProperties identity marker
 * (buildWorkbookAppProperties_) if it is not already present. Idempotent: a
 * file that already carries `cashcompass_email_hash` is left untouched.
 *
 * Drive v3 appProperties writes MERGE — only the provided keys are set, so any
 * other appProperties on the file are preserved. Best-effort: never throws.
 *
 * @param {string} fileId
 * @param {string} email
 * @param {string=} nowIso Shared timestamp (so all markers agree).
 * @returns {boolean} true if newly stamped, false on no-op/failure.
 */
function ensureWorkbookAppPropertiesMarker_(fileId, email, nowIso) {
  try {
    if (!fileId || !email) return false;
    var existing = {};
    try {
      var meta = Drive.Files.get(fileId, { fields: 'appProperties' });
      existing = (meta && meta.appProperties) ? meta.appProperties : {};
    } catch (_getErr) {
      existing = {};
    }
    if (existing.cashcompass_email_hash) return false; // already marked
    var marker = buildWorkbookAppProperties_(email, nowIso);
    Drive.Files.update({ appProperties: marker }, fileId);
    return true;
  } catch (_e) {
    return false;
  }
}

/**
 * Writes the hidden in-workbook `SYS - Meta` identity marker if absent.
 * Idempotent: if the sheet already carries a `cashcompass_email_hash` row this
 * is a no-op. Reuses buildWorkbookAppProperties_ so the in-sheet values match
 * the Drive marker exactly. Best-effort: never throws.
 *
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss
 * @param {string} email
 * @param {string=} nowIso Shared timestamp (so all markers agree).
 * @returns {boolean} true if newly written, false on no-op/failure.
 */
function ensureSysMetaMarker_(ss, email, nowIso) {
  try {
    if (!ss || !email) return false;

    var sheet = ss.getSheetByName(SYS_META_SHEET_NAME_);
    if (sheet) {
      try {
        var lastRow = Math.max(1, sheet.getLastRow());
        var colA = sheet.getRange(1, 1, lastRow, 1).getDisplayValues();
        for (var i = 0; i < colA.length; i++) {
          if (String(colA[i][0] || '').trim() === 'cashcompass_email_hash') {
            return false; // already marked
          }
        }
      } catch (_scanErr) { /* fall through and (re)write */ }
    } else {
      // Append at the end so we never disturb sheet ordering the user sees.
      sheet = ss.insertSheet(SYS_META_SHEET_NAME_, ss.getNumSheets());
    }

    var marker = buildWorkbookAppProperties_(email, nowIso);
    var rows = [
      ['cashcompass_role', marker.cashcompass_role],
      ['cashcompass_email_hash', marker.cashcompass_email_hash],
      ['cashcompass_schema', marker.cashcompass_schema],
      ['cashcompass_project', marker.cashcompass_project],
      ['cashcompass_provisioned_at', marker.cashcompass_provisioned_at]
    ];
    sheet.getRange(1, 1, rows.length, 2).setValues(rows);
    try { sheet.hideSheet(); } catch (_hideErr) { /* cosmetic */ }
    return true;
  } catch (_e) {
    return false;
  }
}

/**
 * Idempotent, best-effort orchestrator: ensures all three Phase 6B identity
 * markers are present on a workbook — Drive appProperties, the in-sheet
 * SYS - Meta marker, and the reverse index. Used by BOTH the fresh-provision
 * path (stamp at create) and the mapped-open path (lazy backfill). A shared
 * `nowIso` keeps the timestamps consistent across markers.
 *
 * Each marker is independently wrapped: one marker failing never blocks the
 * others, and the whole call is non-fatal — it must never change provisioning
 * or resolution behavior.
 *
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss
 * @param {string} fileId
 * @param {string} email
 * @returns {{appProperties: boolean, sysMeta: boolean, reverseIndex: boolean}}
 *   Which markers were newly written this call (false = already present/failed).
 */
function ensureWorkbookIdentityMarkers_(ss, fileId, email) {
  var result = { appProperties: false, sysMeta: false, reverseIndex: false };
  var nowIso = new Date().toISOString();
  try { result.appProperties = ensureWorkbookAppPropertiesMarker_(fileId, email, nowIso); } catch (_a) {}
  try { result.sysMeta = ensureSysMetaMarker_(ss, email, nowIso); } catch (_s) {}
  try { result.reverseIndex = ensureReverseIndexForWorkbook_(fileId, email); } catch (_r) {}
  return result;
}

/* -------------------------------------------------------------------------- */
/*  Adopt-before-create (Phase 6C — flag-gated, default OFF)                   */
/* -------------------------------------------------------------------------- */

/**
 * Returns true only when the CENTRAL_AUTO_ADOPT script property is the literal
 * string "true". Any other value (including unset) returns false. Never throws
 * — read failures fail closed (adoption off), the safest posture: a failed
 * read simply means "behave as before and create".
 *
 * @returns {boolean}
 */
function isAutoAdoptEnabled_() {
  try {
    return PropertiesService.getScriptProperties()
      .getProperty(CENTRAL_AUTO_ADOPT_KEY_) === 'true';
  } catch (_e) {
    return false;
  }
}

/**
 * Returns true only when the CENTRAL_RECOVERY_ACTIONS script property is the
 * literal string "true" (Phase 6D.2a). Any other value (including unset)
 * returns false. Never throws — read failures fail closed, so optional actions
 * on general recovery pages stay hidden.
 *
 * @returns {boolean}
 */
function isRecoveryActionsEnabled_() {
  try {
    return PropertiesService.getScriptProperties()
      .getProperty(CENTRAL_RECOVERY_ACTIONS_KEY_) === 'true';
  } catch (_e) {
    return false;
  }
}

/**
 * Returns true only when the CENTRAL_ADMIN_REPAIR script property is the literal
 * string "true" (Phase 6E.1). Any other value (including unset) returns false.
 * Never throws — read failures fail closed (admin repair writes off), so a
 * failed read keeps the toolkit preview-only.
 *
 * @returns {boolean}
 */
function isAdminRepairEnabled_() {
  try {
    return PropertiesService.getScriptProperties()
      .getProperty(CENTRAL_ADMIN_REPAIR_KEY_) === 'true';
  } catch (_e) {
    return false;
  }
}

/**
 * Builds a name-tagged Error for the ambiguous case (≥2 strict candidates).
 * The recovery router detects the error name and renders it specially.
 * Adoption is impossible here because
 * "which workbook holds the real data?" is a human decision; we deliberately
 * create nothing and trash nothing.
 *
 * @param {!Array<string>} candidateIds Full candidate IDs (for the message).
 * @returns {!Error}
 */
function buildAmbiguousWorkbookError_(candidateIds) {
  var ids = (candidateIds || []).map(function(id) { return truncateId_(id); });
  var err = new Error(
    'Multiple CashCompass workbooks were found for your account and none is ' +
    'currently linked. To avoid picking the wrong one automatically, ' +
    'CashCompass stopped instead of creating another copy. Contact the ' +
    'project owner to choose the correct workbook. Candidates: ' +
    ids.join(', ')
  );
  err.name = 'AmbiguousWorkbookError';
  return err;
}

/**
 * Builds a recovery error for a single MEDIUM-confidence name-only candidate.
 * The candidate is viable enough to block creation but not strong enough to
 * relink silently while CENTRAL_AUTO_ADOPT is off.
 *
 * @returns {!Error}
 */
function buildConfirmAdoptWorkbookError_() {
  var err = new Error(
    'An existing CashCompass workbook was found by its expected name. ' +
    'CashCompass stopped before creating another copy and needs your ' +
    'confirmation before reconnecting it.'
  );
  err.name = 'ConfirmAdoptWorkbookError';
  return err;
}

/**
 * Builds a fail-closed recovery error for candidate-search or verification
 * uncertainty. This error must never be treated as confirmation that zero
 * candidates exist.
 *
 * @param {string} reason Internal diagnostic reason (not rendered directly).
 * @returns {!Error}
 */
function buildWorkbookRecoveryUnavailableError_(reason) {
  var err = new Error(
    'CashCompass could not safely verify your workbook right now. It stopped ' +
    'before creating or linking another workbook. Please try again.'
  );
  err.name = 'WorkbookRecoveryUnavailableError';
  err.recoveryReason = String(reason || 'unknown');
  return err;
}

/**
 * Pure recovery decision seam. It classifies an already-successful candidate
 * search without performing Drive, Spreadsheet, mapping, or workbook writes.
 *
 * @param {string} recoveryState 'no_mapping' or 'stale'.
 * @param {!Array<Object>} candidates Candidate descriptors.
 * @param {boolean} autoAdoptMedium Whether a name-only candidate may relink
 *   without confirmation.
 * @returns {{action:string, confidence:string}}
 */
function decideRecoveryCandidateAction_(recoveryState, candidates, autoAdoptMedium) {
  var state = recoveryState === 'stale' ? 'stale' : 'no_mapping';
  var list = candidates || [];

  if (list.length === 0) {
    return {
      action: state === 'no_mapping' ? 'create' : 'unavailable',
      confidence: 'NONE'
    };
  }
  if (list.length >= 2) {
    return { action: 'ambiguous', confidence: 'MULTIPLE' };
  }

  var confidence = list[0] && list[0].matchedBy === 'name'
    ? 'MEDIUM'
    : 'HIGH';
  if (confidence === 'MEDIUM' && !autoAdoptMedium) {
    return { action: 'confirm', confidence: confidence };
  }
  return { action: 'relink', confidence: confidence };
}

/**
 * Resolves an existing workbook before create/recovery. Called from inside a
 * per-user lock after the mapping state has been checked.
 *
 * Behavior (approved decision tree):
 *   - Detection failure → UNAVAILABLE; never create.
 *   - 0 candidates → null only for no_mapping; stale → UNAVAILABLE.
 *   - exactly 1 HIGH candidate → verified relink.
 *   - exactly 1 MEDIUM name-only candidate → verified relink only when
 *     CENTRAL_AUTO_ADOPT is true; otherwise require explicit confirmation.
 *   - candidate verification failure → UNAVAILABLE; never create.
 *   - ≥2 candidates → throw AmbiguousWorkbookError (adopt/create nothing).
 *
 * LOW-confidence files cannot appear here: findCandidateWorkbooks_ only matches
 * the exact marker hash or the exact workbook name, constrained to the caller's
 * own non-trashed spreadsheets, so every merged candidate is HIGH or MEDIUM.
 *
 * @param {string} email Caller email (already validated non-empty by caller).
 * @param {string=} recoveryState 'no_mapping' or 'stale'.
 * @returns {?GoogleAppsScript.Spreadsheet.Spreadsheet} Adopted workbook, or
 *   null only when a successful no-mapping search found zero candidates.
 */
function resolveExistingWorkbookForRecovery_(email, recoveryState) {
  var state = recoveryState === 'stale' ? 'stale' : 'no_mapping';
  var found;
  try {
    found = findCandidateWorkbooks_(email);
  } catch (detectErr) {
    Logger.log('[recovery] candidate detection failed; create blocked: ' +
      (detectErr && detectErr.message ? detectErr.message : String(detectErr)));
    throw buildWorkbookRecoveryUnavailableError_('candidate_search_failed');
  }

  var merged = (found && found.merged) ? found.merged : [];
  var decision = decideRecoveryCandidateAction_(
    state,
    merged,
    isAutoAdoptEnabled_()
  );

  if (decision.action === 'create') {
    Logger.log('[recovery] no mapping + confirmed zero candidates → create allowed');
    return null;
  }
  if (decision.action === 'unavailable') {
    Logger.log('[recovery] stale mapping + zero candidates → unavailable');
    throw buildWorkbookRecoveryUnavailableError_('stale_mapping_no_candidate');
  }
  if (decision.action === 'ambiguous') {
    var ids = merged.map(function(c) { return c.id; });
    Logger.log('[recovery] ambiguous: ' + merged.length +
      ' candidates, adopting none. ids=' +
      ids.map(function(id) { return truncateId_(id); }).join(','));
    throw buildAmbiguousWorkbookError_(ids);
  }
  if (decision.action === 'confirm') {
    Logger.log('[recovery] one name-only candidate requires explicit confirmation');
    throw buildConfirmAdoptWorkbookError_();
  }

  // Exactly one approved candidate. Relink via the shared helper, which
  // mirrors mapped-open post-steps (verify → cleanup → mapping → markers).
  var cand = merged[0];
  var relink = relinkSingleCandidate_(email, cand);
  if (!relink.ok) {
    Logger.log('[recovery] candidate verification failed; create blocked. id=' +
      truncateId_(cand.id));
    throw buildWorkbookRecoveryUnavailableError_('candidate_verify_failed');
  }

  Logger.log('[recovery] relinked workbook id=' + truncateId_(cand.id) +
    ' state=' + state +
    ' confidence=' + relink.confidence + ' matchedBy=' + relink.matchedBy);
  return relink.ss;
}

/**
 * Backward-compatible no-mapping wrapper retained for diagnostics/tests.
 * Candidate detection is unconditional at its provisioning call site.
 *
 * @param {string} email
 * @returns {?GoogleAppsScript.Spreadsheet.Spreadsheet}
 */
function tryAdoptWorkbookBeforeCreate_(email) {
  return resolveExistingWorkbookForRecovery_(email, 'no_mapping');
}

/**
 * Shared single-candidate relink core (extracted in Phase 6D.2a so both the
 * automatic adopt path (tryAdoptWorkbookBeforeCreate_) and the user-initiated
 * reconnect endpoint (recoveryReconnectSelf) use one verified-relink routine).
 *
 * Mirrors the mapped-open post-steps exactly and nothing else: re-verify the
 * candidate still opens, run the non-fatal default-Sheet1 cleanup, write the
 * caller's mapping to the candidate, and stamp identity markers (best-effort).
 * The candidate holds the user's real data — it is never bootstrapped or
 * rewritten. Performs NO Drive create and NO hard delete.
 *
 * Pure with respect to logging: callers emit their own context logs.
 *
 * @param {string} email Caller email (already validated non-empty by caller).
 * @param {?Object} cand Candidate descriptor from findCandidateWorkbooks_.
 * @returns {{ok: boolean, ss: ?GoogleAppsScript.Spreadsheet.Spreadsheet,
 *            confidence: string, matchedBy: string, reason: string}}
 *   ok=true with the opened Spreadsheet on success; ok=false (reason
 *   'no_candidate' | 'verify_failed') when the candidate is missing or no
 *   longer openable. Never throws for the expected verify-failure case.
 */
function relinkSingleCandidate_(email, cand) {
  var confidence = (cand && cand.matchedBy === 'name') ? 'MEDIUM' : 'HIGH';
  var matchedBy = (cand && cand.matchedBy) ? cand.matchedBy : '-';

  if (!cand || !cand.id) {
    return { ok: false, ss: null, confidence: confidence, matchedBy: matchedBy,
             reason: 'no_candidate' };
  }

  var ss;
  try {
    ss = SpreadsheetApp.openById(cand.id);
  } catch (openErr) {
    return { ok: false, ss: null, confidence: confidence, matchedBy: matchedBy,
             reason: 'verify_failed' };
  }

  cleanupDefaultSheet1_(ss);
  writeSpreadsheetIdForUser_(email, cand.id);
  Logger.log('[relink] mapping write OK id=' + truncateId_(cand.id) +
    ' matchedBy=' + matchedBy + ' confidence=' + confidence);
  try {
    ensureWorkbookIdentityMarkers_(ss, cand.id, email);
    Logger.log('[relink] marker stamping attempted (best-effort) id=' +
      truncateId_(cand.id));
  } catch (_mk) {
    Logger.log('[relink] marker stamping failed (non-fatal) id=' +
      truncateId_(cand.id));
  }

  return { ok: true, ss: ss, confidence: confidence, matchedBy: matchedBy,
           reason: 'ok' };
}

/* -------------------------------------------------------------------------- */
/*  Recovery actions (Phase 6D.2a — self-scoped explicit confirmation)        */
/* -------------------------------------------------------------------------- */

/**
 * User-initiated "Reconnect existing workbook" recovery action (Phase 6D.2a).
 *
 * Strictly self-scoped: the target user is derived from getCurrentUserEmail_()
 * — there is NO email parameter and NO spreadsheet-ID parameter, so a caller
 * can only ever relink their OWN mapping to a workbook they OWN (candidate
 * detection is owner-constrained and non-trashed by construction). This is the
 * IDOR guard; the bound/production workbook is unreachable from here.
 *
 * Gated by central mode. The endpoint itself is always available because it is
 * the explicit confirmation path for a single name-only candidate while
 * CENTRAL_AUTO_ADOPT is off. CENTRAL_RECOVERY_ACTIONS still controls whether
 * the optional action appears on other recovery screens. Runs under the
 * per-user lock to serialize against concurrent resolution/provisioning.
 *
 * Returns ONLY primitives — never raw exceptions, spreadsheet IDs, email
 * addresses, or internal error names:
 *   - { status: 'reconnected' } : exactly one candidate, verified + relinked.
 *   - { status: 'ambiguous' }   : ≥2 candidates; never auto-picks.
 *   - { status: 'none' }        : no candidate to reconnect to.
 *   - { status: 'disabled' }    : central mode off.
 *   - { status: 'error' }       : no identified user, lock busy, detection
 *                                 failure, verify failure, or anything
 *                                 unexpected.
 *
 * Writes nothing but the caller's own mapping (via relinkSingleCandidate_).
 * Creates no workbook, clears no mapping directly, deletes nothing.
 *
 * @returns {{status: string}}
 */
function recoveryReconnectSelf() {
  try {
    if (!isCentralModeEnabled_()) {
      Logger.log('[6D2a] reconnect disabled: central mode off → status=disabled');
      return { status: 'disabled' };
    }
    var email = getCurrentUserEmail_();
    if (!email) {
      Logger.log('[6D2a] reconnect no identified user → status=error');
      return { status: 'error' };
    }

    var lock = LockService.getUserLock();
    var acquired = false;
    try {
      acquired = lock.tryLock(PROVISIONING_LOCK_TIMEOUT_MS_);
    } catch (_lockErr) {
      acquired = false;
    }
    if (!acquired) {
      Logger.log('[6D2a] reconnect lock busy → status=error');
      return { status: 'error' };
    }

    try {
      // A concurrent reconnect/admin repair may have restored a healthy mapping
      // while this recovery screen was open. Preserve it rather than replacing
      // it with a newly discovered candidate.
      var currentId = lookupSpreadsheetIdForUser_(email);
      if (currentId) {
        try {
          var currentSs = SpreadsheetApp.openById(currentId);
          cleanupDefaultSheet1_(currentSs);
          try { ensureWorkbookIdentityMarkers_(currentSs, currentId, email); } catch (_mk) {}
          Logger.log('[6D2a] mapping already healthy → status=reconnected');
          return { status: 'reconnected' };
        } catch (_mappedOpenErr) {
          Logger.log('[6D2a] current mapping still unavailable; continuing candidate search');
        }
      }

      var found;
      try {
        found = findCandidateWorkbooks_(email);
      } catch (_detectErr) {
        Logger.log('[6D2a] reconnect detection failed.');
        return { status: 'error' };
      }

      var merged = (found && found.merged) ? found.merged : [];
      Logger.log('[6D2a] reconnect candidates=' + merged.length +
        ' matchedBy=' + (merged[0] && merged[0].matchedBy ? merged[0].matchedBy : '-'));

      if (merged.length === 0) {
        Logger.log('[6D2a] reconnect candidates=0 → status=none');
        return { status: 'none' };
      }
      if (merged.length >= 2) {
        Logger.log('[6D2a] reconnect ambiguous: ' + merged.length +
          ' candidates; relinking none. → status=ambiguous');
        return { status: 'ambiguous' };
      }

      var relink = relinkSingleCandidate_(email, merged[0]);
      if (!relink.ok) {
        Logger.log('[6D2a] reconnect candidate re-verify failed (reason=' +
          (relink.reason || '-') + ') → status=error');
        return { status: 'error' };
      }

      Logger.log('[6D2a] reconnected workbook confidence=' + relink.confidence +
        ' matchedBy=' + relink.matchedBy + ' → status=reconnected');
      return { status: 'reconnected' };
    } finally {
      try { lock.releaseLock(); } catch (_releaseErr) {}
    }
  } catch (_e) {
    Logger.log('[6D2a] reconnect unexpected failure.');
    return { status: 'error' };
  }
}

/* -------------------------------------------------------------------------- */
/*  Resolver branch                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Central-mode branch of getUserSpreadsheet_(). Looks up the
 * caller's mapping and opens it when healthy. Missing or stale mappings enter
 * the locked recovery decision tree; only a no-mapping search that positively
 * confirms zero candidates may provision a new workbook.
 */
function getOrProvisionUserSpreadsheet_() {
  var email = getCurrentUserEmail_();
  if (!email) {
    throw new Error(
      'Central mode requires an identified user. ' +
      'Session.getEffectiveUser returned empty — check userinfo.email ' +
      'scope and USER_ACCESSING posture.'
    );
  }

  var mappedId = lookupSpreadsheetIdForUser_(email);
  if (mappedId) {
    try {
      var mappedSs = SpreadsheetApp.openById(mappedId);
      // Existing mapped workbook: a manually reset/emptied workbook can
      // still carry the default blank "Sheet1". This branch skips
      // runMinimalBootstrap_, so reuse the same non-fatal cleanup here.
      cleanupDefaultSheet1_(mappedSs);
      // Phase 6B lazy backfill: stamp identity markers if missing. Best-effort
      // and idempotent — does NOT change which workbook is resolved or any
      // observable behavior; pre-marker beta workbooks pick up identity on
      // their next open.
      try { ensureWorkbookIdentityMarkers_(mappedSs, mappedId, email); } catch (_bf) {}
      return mappedSs;
    } catch (openErr) {
      return handleStaleMapping_(email, mappedId, openErr);
    }
  }

  return provisionWorkbookForUser_(email);
}

/* -------------------------------------------------------------------------- */
/*  Provisioning sequence                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Creates a new spreadsheet in the caller's Drive, runs the minimal
 * bootstrap, persists the mapping, and returns the new Spreadsheet
 * handle. Serialized per-user via LockService; double-checks the
 * mapping inside the lock to prevent duplicate files.
 *
 * On any partial failure between Drive create and mapping write,
 * trashes the just-created file (soft delete via setTrashed) so the
 * user can recover it from Drive's Trash if the failure was
 * transient and they actually wanted that file. Hard delete is
 * intentionally not used in the first slice.
 */
function provisionWorkbookForUser_(email) {
  var lock = LockService.getUserLock();
  var acquired = false;
  try {
    acquired = lock.tryLock(PROVISIONING_LOCK_TIMEOUT_MS_);
  } catch (_e) {
    acquired = false;
  }
  if (!acquired) {
    throw new Error(
      'Provisioning is already in progress for this account. ' +
      'Please reload the page in a few seconds.'
    );
  }

  try {
    // Double-check inside the lock: another execution may have
    // provisioned while we were waiting.
    var existingId = lookupSpreadsheetIdForUser_(email);
    if (existingId) {
      try {
        var existingSs = SpreadsheetApp.openById(existingId);
        // Same non-fatal cleanup as the pre-lock branch: a workbook
        // provisioned by the winning execution (or a manually reset one)
        // may still carry the default blank "Sheet1".
        cleanupDefaultSheet1_(existingSs);
        // Phase 6B lazy backfill (race branch): idempotent + best-effort.
        try { ensureWorkbookIdentityMarkers_(existingSs, existingId, email); } catch (_bf) {}
        return existingSs;
      } catch (_existingOpenErr) {
        // The mapping appeared while this request waited but is stale. We
        // already hold the user lock, so enter the stale decision tree directly
        // rather than calling handleStaleMapping_ (which would re-lock).
        return resolveExistingWorkbookForRecovery_(email, 'stale');
      }
    }

    // Unconditional candidate detection is the duplicate-prevention gate.
    // CREATE is reachable only after a successful Drive search positively
    // confirms zero app-visible candidates. Search/verify uncertainty,
    // ambiguity, and unconfirmed name-only candidates all stop here.
    var adopted = tryAdoptWorkbookBeforeCreate_(email);
    if (adopted) {
      return adopted;
    }

    var fileId = null;
    var ss = null;
    try {
      var file = Drive.Files.create({
        name: buildWorkbookName_(email),
        mimeType: 'application/vnd.google-apps.spreadsheet'
      });
      fileId = file.id;
    } catch (createErr) {
      throw new Error(
        'Could not create your CashCompass workbook (Drive.Files.create ' +
        'failed): ' +
        (createErr && createErr.message ? createErr.message : createErr)
      );
    }

    try {
      ss = SpreadsheetApp.openById(fileId);
    } catch (openErr) {
      trashFileQuietly_(fileId);
      throw new Error(
        'Created workbook but could not open it (openById failed): ' +
        (openErr && openErr.message ? openErr.message : openErr)
      );
    }

    try {
      runMinimalBootstrap_(ss);
    } catch (bootErr) {
      trashFileQuietly_(fileId);
      throw new Error(
        'Workbook bootstrap failed: ' +
        (bootErr && bootErr.message ? bootErr.message : bootErr)
      );
    }

    try {
      writeSpreadsheetIdForUser_(email, fileId);
    } catch (mapErr) {
      trashFileQuietly_(fileId);
      throw new Error(
        'Could not persist workbook mapping: ' +
        (mapErr && mapErr.message ? mapErr.message : mapErr)
      );
    }

    // Phase 6B: stamp identity markers on the freshly mapped workbook. Runs
    // AFTER the mapping write so it is outside the rollback window — the
    // workbook is already live and authoritative, and marker stamping is
    // supplementary. Best-effort + idempotent: a failure here never aborts a
    // successful provision (lazy backfill will complete it on the next open).
    try { ensureWorkbookIdentityMarkers_(ss, fileId, email); } catch (_mk) {}

    return ss;
  } finally {
    try { lock.releaseLock(); } catch (_e) { /* swallow */ }
  }
}

/**
 * Soft-deletes a file by trashing it. Never throws. Used by the
 * partial-failure cleanup path so a half-created workbook does not
 * accumulate in the user's Drive. Soft delete (vs hard delete) so
 * the user can recover from Trash if the failure was transient.
 */
function trashFileQuietly_(fileId) {
  if (!fileId) return;
  try {
    DriveApp.getFileById(fileId).setTrashed(true);
  } catch (_e) {
    // swallow — best-effort cleanup
  }
}

/**
 * Runs the minimal bootstrap on a freshly-created workbook so the
 * Setup / Review path can engage. The first slice's "minimal"
 * bootstrap is exactly one call: ensureInputSettingsSheet_(ss).
 * Every other sheet is created lazily by its existing ensure*
 * helper as the user navigates the dashboard.
 *
 * Throws on bootstrap failure so the caller can clean up the file.
 */
function runMinimalBootstrap_(ss) {
  if (!ss) {
    throw new Error('runMinimalBootstrap_ requires a spreadsheet handle.');
  }
  ensureInputSettingsSheet_(ss);

  // Drive.Files.create seeds every new spreadsheet with an empty default
  // "Sheet1" tab. Now that INPUT - Settings exists we can safely drop that
  // leftover so the provisioned workbook does not lead with a stray blank
  // tab. Strictly cleanup — wrapped non-fatally so a removal hiccup never
  // aborts provisioning (the workbook is already usable without it).
  cleanupDefaultSheet1_(ss);
}

/**
 * Removes the default empty "Sheet1" left by Drive.Files.create from a
 * Central workbook. Called on both the fresh-provision path
 * (runMinimalBootstrap_) and the existing-mapping open path
 * (getOrProvisionUserSpreadsheet_) so a workbook that was manually
 * reset/emptied and re-enters onboarding also sheds its stray blank tab.
 * Intentionally conservative — it only ever removes a sheet that is
 * unmistakably the untouched Google default:
 *
 *   - named exactly "Sheet1" (case-sensitive),
 *   - not the only sheet in the workbook (never delete the last sheet),
 *   - has no meaningful content — every cell in getDataRange() is a blank
 *     value, a blank formula, and a blank note. We do NOT rely on
 *     getLastRow()/getLastColumn() here: a brand-new blank Google sheet
 *     reports those as 1 (the always-present A1 cell), not 0, so the old
 *     numeric check skipped deletion. The content scan below treats a
 *     single-empty-cell grid as deletable while still refusing to drop a
 *     tab that holds any value, formula, or note.
 *
 * All failures are swallowed: this runs only during Central provisioning
 * bootstrap, the workbook is already functional without the cleanup, and
 * an aborted provision would be a far worse outcome than a leftover blank
 * tab. Operates on the passed-in `ss` directly (the user→workbook mapping
 * is not written yet at this point, so the user-scoped resolver cannot be
 * used here).
 *
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss
 */
function cleanupDefaultSheet1_(ss) {
  try {
    if (!ss) return;

    var sheet = ss.getSheetByName('Sheet1');
    if (!sheet) return;

    // Never delete the last remaining sheet (Apps Script forbids it and we
    // must always leave at least INPUT - Settings behind).
    if (ss.getSheets().length <= 1) return;

    // Content-based emptiness check. A blank Google default sheet reports
    // getLastRow()/getLastColumn() as 1 (cell A1 always exists), so a
    // numeric "=== 0" guard never fires. Instead, scan the data range and
    // bail if ANY cell carries a value, a formula, or a note.
    var dataRange = sheet.getDataRange();
    if (!sheetDataRangeIsBlank_(dataRange)) return;

    ss.deleteSheet(sheet);
  } catch (_cleanupErr) {
    // Cleanup only — leftover Sheet1 is harmless, an aborted provision is not.
  }
}

/**
 * Returns true only when every cell in the given data range is blank —
 * no value, no formula, and no note. Used by
 * cleanupDefaultSheet1_ to decide whether a "Sheet1" tab is
 * the untouched Google default (safe to delete) versus a tab that holds
 * real content (must be preserved). Conservative: any single non-blank
 * value/formula/note returns false.
 *
 * @param {GoogleAppsScript.Spreadsheet.Range} range
 * @returns {boolean}
 */
function sheetDataRangeIsBlank_(range) {
  if (!range) return false;

  var grids = [range.getValues(), range.getFormulas(), range.getNotes()];
  for (var g = 0; g < grids.length; g++) {
    var grid = grids[g];
    for (var r = 0; r < grid.length; r++) {
      var row = grid[r];
      for (var c = 0; c < row.length; c++) {
        if (String(row[c] == null ? '' : row[c]).trim() !== '') {
          return false;
        }
      }
    }
  }
  return true;
}

/* -------------------------------------------------------------------------- */
/*  Stale-mapping handling                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Called when a mapped workbook could not be opened. Re-checks under the user
 * lock, then runs the same unconditional candidate decision tree used before
 * create. Stale recovery never creates a workbook.
 */
function handleStaleMapping_(email, mappedId, openErr) {
  Logger.log('[recovery] mapped open failed id=' + truncateId_(mappedId) +
    ' reason=' + (openErr && openErr.message ? openErr.message : String(openErr)));

  var lock = LockService.getUserLock();
  var acquired = false;
  try {
    acquired = lock.tryLock(PROVISIONING_LOCK_TIMEOUT_MS_);
  } catch (_lockErr) {
    acquired = false;
  }
  if (!acquired) {
    throw buildWorkbookRecoveryUnavailableError_('stale_mapping_lock_busy');
  }

  try {
    // Another execution may have repaired/replaced the mapping while this
    // request waited. Re-read it and prefer a clean mapped open if available.
    var latestId = lookupSpreadsheetIdForUser_(email);
    if (latestId) {
      try {
        var latestSs = SpreadsheetApp.openById(latestId);
        cleanupDefaultSheet1_(latestSs);
        try { ensureWorkbookIdentityMarkers_(latestSs, latestId, email); } catch (_mk) {}
        return latestSs;
      } catch (_latestOpenErr) {
        Logger.log('[recovery] mapped re-check still unavailable id=' +
          truncateId_(latestId));
      }
    }

    return resolveExistingWorkbookForRecovery_(email, 'stale');
  } finally {
    try { lock.releaseLock(); } catch (_releaseErr) {}
  }
}
