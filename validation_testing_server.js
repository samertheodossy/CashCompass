/**
 * validation_testing_server.js — server API for the Validation & Testing admin
 * console (V1: Validator results only). READ-ONLY.
 *
 * Design of record: VALIDATION_TESTING_CONSOLE.md. This is the only new server
 * surface for the console; it owns NO validation logic — it resolves a target
 * workbook, calls the existing pure Validator seams (validateProvisioning_(ss) /
 * validateDrift_(ss)), and returns STRUCTURED OBJECTS (never logs) for the client
 * to render.
 *
 * Guard: every function calls assertValidatorAllowed_() first — VALIDATOR_ENABLED
 * === "true" AND isAdminUser_(). Disabled by default.
 *
 * Safety: read-only. The Validator performs no mutation; this layer opens the
 * target workbook read-only (openById + getters) and never writes. The console
 * exposes only Validator actions in V1 — no Test Harness, no repair.
 *
 * Envelope: every function returns { ok: true, ... } on success or
 * { ok: false, error: <message> } on failure (including guard failures), so the
 * client can render errors inline without withFailureHandler heuristics.
 */

/** Constant safety readout — the Validator never mutates. */
var VT_SAFETY_READONLY_ = 'Read-only — the Validator performs no mutation.';

/**
 * Run fn inside a structured try/catch envelope. Guard/throw becomes
 * { ok:false, error }.
 * @param {function(): !Object} fn
 * @returns {!Object}
 */
function vtSafe_(fn) {
  try {
    return fn();
  } catch (e) {
    return { ok: false, error: (e && e.message) ? e.message : String(e) };
  }
}

/**
 * Resolve the target workbook from an optional explicit ID.
 *   - explicit ID given  → open that workbook            (targetType EXPLICIT_ID)
 *   - omitted/blank      → VALIDATOR_DEFAULT_CENTRAL_WORKBOOK_ID
 *                          via getValidatorDefaultCentralWorkbookId_ (throws if
 *                          unset)                          (targetType CONFIGURED_DEFAULT)
 * Read-only: openById only.
 * @param {string=} spreadsheetId
 * @returns {{ id: string, ss: !Object, targetType: string }}
 */
function vtResolveTarget_(spreadsheetId) {
  var explicit = (spreadsheetId && String(spreadsheetId).trim())
    ? String(spreadsheetId).trim()
    : '';
  var id = explicit || getValidatorDefaultCentralWorkbookId_();
  var ss = SpreadsheetApp.openById(id);
  if (!ss) {
    throw new Error('Could not open workbook for ID: ' + id);
  }
  return { id: id, ss: ss, targetType: explicit ? 'EXPLICIT_ID' : 'CONFIGURED_DEFAULT' };
}

/**
 * Structured target descriptor for the UI. Reuses safeName_ / safeId_ from
 * validator_provisioning.js (defensive getters).
 * @param {{ id: string, ss: !Object, targetType: string }} t
 * @returns {!Object}
 */
function vtTargetInfo_(t) {
  return {
    spreadsheetId: t.id,
    name: safeName_(t.ss),
    targetType: t.targetType,
    safety: VT_SAFETY_READONLY_
  };
}

/**
 * The configured default target (VALIDATOR_DEFAULT_CENTRAL_WORKBOOK_ID), inspected.
 * @returns {!Object} { ok, target } | { ok:false, error }
 */
function vtGetDefaultTarget() {
  return vtSafe_(function() {
    assertValidatorAllowed_();
    var t = vtResolveTarget_('');
    return { ok: true, target: vtTargetInfo_(t) };
  });
}

/**
 * Inspect a target (explicit ID, or the configured default when blank) without
 * running any checks. Confirms the workbook opens and reports its name/ID/type/safety.
 * @param {string=} spreadsheetId
 * @returns {!Object} { ok, target } | { ok:false, error }
 */
function vtInspectTarget(spreadsheetId) {
  return vtSafe_(function() {
    assertValidatorAllowed_();
    var t = vtResolveTarget_(spreadsheetId);
    return { ok: true, target: vtTargetInfo_(t) };
  });
}

/**
 * Run Provisioning Validation (structural gate) against the target. Reuses the
 * pure seam validateProvisioning_(ss); returns its structured report.
 * @param {string=} spreadsheetId
 * @returns {!Object} { ok, target, report } | { ok:false, error }
 */
function vtRunProvisioning(spreadsheetId) {
  return vtSafe_(function() {
    assertValidatorAllowed_();
    var t = vtResolveTarget_(spreadsheetId);
    var report = validateProvisioning_(t.ss);
    return { ok: true, target: vtTargetInfo_(t), report: report };
  });
}

/**
 * Run Workbook Drift Validation (advisory) against the target. Reuses the pure
 * seam validateDrift_(ss); returns its structured report. Advisory — the report's
 * overall is only ever 'PASS' or 'DRIFT', never 'FAIL'.
 * @param {string=} spreadsheetId
 * @returns {!Object} { ok, target, report } | { ok:false, error }
 */
function vtRunWorkbookDrift(spreadsheetId) {
  return vtSafe_(function() {
    assertValidatorAllowed_();
    var t = vtResolveTarget_(spreadsheetId);
    var report = validateDrift_(t.ss);
    return { ok: true, target: vtTargetInfo_(t), report: report };
  });
}
