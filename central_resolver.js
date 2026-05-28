/**
 * Central App resolver — central-mode workbook routing seam.
 *
 * getUserSpreadsheet_() is the single seam through which a calling
 * module acquires a Spreadsheet handle. When CENTRAL_MODE is off
 * (default), it returns SpreadsheetApp.getActiveSpreadsheet() —
 * byte-for-byte identical to the pre-central behavior, so the bound
 * deployment continues to work unchanged.
 *
 * When CENTRAL_MODE is on, it routes into central_provisioning.js's
 * getOrProvisionUserSpreadsheet_() to look up (or create) the
 * calling user's own workbook in their Drive.
 *
 * Cross-references:
 *   - CENTRAL_APP_RESOLVER_PROVISIONING_IMPLEMENTATION_PROMPT.md
 *   - CENTRAL_APP_WORKBOOK_CREATION_FIRST_SLICE_PLAN.md
 *   - CENTRAL_APP_DESIGN.md
 *   - CENTRAL_APP_FIRST_RESOLVER_SEAM.md
 *   - CENTRAL_APP_IMPLEMENTATION_PLAN.md
 *
 * Do not extend this file with provisioning logic — that lives in
 * central_provisioning.js. Keep this file small and seam-like.
 */
function getUserSpreadsheet_() {
  if (!isCentralModeEnabled_()) {
    return SpreadsheetApp.getActiveSpreadsheet();
  }
  return getOrProvisionUserSpreadsheet_();
}

/**
 * Returns true when the CENTRAL_MODE script property is the literal
 * string "true". Any other value (including unset) returns false.
 *
 * Never throws. Read failures (e.g., PropertiesService is unavailable
 * for some catastrophic reason) are treated as "central mode off" —
 * the safest fail-closed posture for this flag.
 */
function isCentralModeEnabled_() {
  try {
    var v = PropertiesService.getScriptProperties().getProperty('CENTRAL_MODE');
    return v === 'true';
  } catch (_e) {
    return false;
  }
}

/**
 * Returns the calling user's email, lowercased and trimmed, or the
 * empty string if no email is available. Uses Session.getEffectiveUser
 * because under USER_ACCESSING that returns the actual caller's
 * identity (Session.getActiveUser returns empty for non-Workspace-
 * domain users — do not use it here).
 *
 * Never throws.
 */
function getCurrentUserEmail_() {
  try {
    var eu = Session.getEffectiveUser();
    if (!eu) return '';
    var email = String(eu.getEmail() || '').trim().toLowerCase();
    return email;
  } catch (_e) {
    return '';
  }
}
