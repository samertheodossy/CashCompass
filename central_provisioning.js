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
 *   - Stale mapping throws StaleMappingError; auto-reprovisioning
 *     is intentionally deferred.
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
/*  Resolver branch                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Central-mode branch of getUserSpreadsheet_(). Looks up the
 * caller's mapping, opens the workbook if present, or provisions a
 * new one if absent. Throws StaleMappingError if the mapping exists
 * but openById fails (manual recovery only — no auto-reprovision in
 * the first slice per first-slice plan § 6.5).
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
      var existingSs = SpreadsheetApp.openById(existingId);
      // Same non-fatal cleanup as the pre-lock branch: a workbook
      // provisioned by the winning execution (or a manually reset one)
      // may still carry the default blank "Sheet1".
      cleanupDefaultSheet1_(existingSs);
      // Phase 6B lazy backfill (race branch): idempotent + best-effort.
      try { ensureWorkbookIdentityMarkers_(existingSs, existingId, email); } catch (_bf) {}
      return existingSs;
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
 * Called when lookupSpreadsheetIdForUser_ returned a non-null id but
 * SpreadsheetApp.openById(id) threw. First-slice behavior: surface
 * a clear error and require manual recovery. Auto-reprovisioning is
 * intentionally deferred to a later slice (first-slice plan § 6.5).
 *
 * Throws an Error with name='StaleMappingError' so the caller
 * (getOrProvisionUserSpreadsheet_, ultimately doGet) could choose
 * to render a recovery message if a recovery surface is later
 * added. The first slice surfaces the raw error to the user via
 * the dashboard render path — acceptable because the user is in
 * the private-beta allow-list and can ping the developer.
 */
function handleStaleMapping_(email, mappedId, openErr) {
  var msg =
    'Your CashCompass workbook could not be opened. It may have been ' +
    'deleted or moved out of access. Contact the project owner to ' +
    're-provision. Mapped ID: ' + mappedId +
    '. Underlying error: ' +
    (openErr && openErr.message ? openErr.message : String(openErr));
  var err = new Error(msg);
  err.name = 'StaleMappingError';
  throw err;
}
