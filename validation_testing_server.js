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
 * Produce a browser-safe copy of a value for return through google.script.run.
 *
 * WHY: google.script.run cannot reliably deliver JavaScript `Date` objects in a
 * return payload. The Harness's rich in-memory report embeds Dates in
 * `functional.results[].expected` / `.actual` as soon as a temporal comparator
 * (e.g. `dateEquals`) is used, which broke delivery of REGRESSION-BILLS-MONTHLY
 * even though it PASSes server-side. This helper normalizes the value for the wire.
 *
 * The current normalization is a JSON round-trip: Dates become ISO strings, and any
 * non-JSON value is dropped — which is exactly what the client already renders
 * (status cards show counts; the JSON viewer shows the normalized object). The rich
 * in-memory report is NOT mutated; this returns a deep copy. This is the single
 * place to evolve wire-safety later (e.g. a smarter Date encoding) — keep such
 * changes HERE, inside the browser adapter, never in the canonical report/harness.
 *
 * @param {*} value the rich in-memory value (e.g. a harness report)
 * @returns {*} a JSON-normalized deep copy safe to return to the browser
 */
function makeWireSafe_(value) {
  return JSON.parse(JSON.stringify(value));
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

/**
 * Run Schema Evolution (advisory, version-aware) against the target. Reuses the
 * pure seam validateSchemaEvolution_(ss); returns its structured report — which
 * carries the derived Workbook Type + Compatibility, a RECONCILED provisioning
 * report (supported legacy differences removed), and a schema section holding
 * those differences as INFO. Advisory — never FAILs on its own.
 * @param {string=} spreadsheetId
 * @returns {!Object} { ok, target, report } | { ok:false, error }
 */
function vtRunSchemaEvolution(spreadsheetId) {
  return vtSafe_(function() {
    assertValidatorAllowed_();
    var t = vtResolveTarget_(spreadsheetId);
    var report = validateSchemaEvolution_(t.ss);
    return { ok: true, target: vtTargetInfo_(t), report: report };
  });
}

function vtRunWorkbookHealth(spreadsheetId) {
  return vtSafe_(function() {
    assertValidatorAllowed_();
    var t = vtResolveTarget_(spreadsheetId);
    return { ok: true, target: vtTargetInfo_(t), report: makeWireSafe_(validateWorkbookHealth_(t.ss)) };
  });
}

function vtRunFormulaValidation(spreadsheetId) {
  return vtSafe_(function() {
    assertValidatorAllowed_();
    var t = vtResolveTarget_(spreadsheetId);
    return { ok: true, target: vtTargetInfo_(t), report: makeWireSafe_(validateFormulas_(t.ss)) };
  });
}

function vtRunConditionalFormatting(spreadsheetId) {
  return vtSafe_(function() {
    assertValidatorAllowed_();
    var t = vtResolveTarget_(spreadsheetId);
    return { ok: true, target: vtTargetInfo_(t), report: makeWireSafe_(validateConditionalFormatting_(t.ss)) };
  });
}

function vtRunNamedRanges(spreadsheetId) {
  return vtSafe_(function() {
    assertValidatorAllowed_();
    var t = vtResolveTarget_(spreadsheetId);
    return { ok: true, target: vtTargetInfo_(t), report: makeWireSafe_(validateNamedRanges_(t.ss)) };
  });
}

/* -------------------------------------------------------------------------- */
/*  Test Harness (WRITER) — thin wrappers over the guarded harness runner       */
/*                                                                              */
/*  DIFFERENT trust model from the Validator functions above: these are guarded */
/*  by assertHarnessAllowed_() (TEST_HARNESS_ENABLED + admin), NOT the Validator */
/*  guard. They own NO harness logic — they list the scenario descriptor and    */
/*  delegate execution to the registered scenario runner. The harness ALWAYS     */
/*  creates its OWN disposable workbook; these functions NEVER accept a workbook */
/*  ID from the client and NEVER use the Target selector, so no client input can */
/*  redirect a write. assertDisposableTarget_ (inside runScenario_) stays the    */
/*  authoritative gate for the optional trash.                                   */
/* -------------------------------------------------------------------------- */

/**
 * List the Test Harness scenarios available to the UI, from the harness registry
 * (`getHarnessScenarios_`). Guarded by the WRITER guard. Read-only listing — surfaces scenario
 * descriptors only; no workbook is created. The console dropdown populates from
 * this list, so new registered scenarios appear with no HTML change.
 * @returns {!Object} { ok, scenarios:[{id,category,executionLevel,executionExpectation,description,expectedSheets}] } | {ok:false,error}
 */
function vtListHarnessScenarios() {
  return vtSafe_(function() {
    assertHarnessAllowed_();
    var all = getHarnessScenarios_();
    var scenarios = [];
    for (var i = 0; i < all.length; i++) {
      var s = all[i];
      var lvl = (typeof harnessExecutionLevelInfo_ === 'function')
        ? harnessExecutionLevelInfo_(s.executionLevel)
        : { label: s.executionLevel || 'UNKNOWN', expectation: '' };
      scenarios.push({
        id: s.id,
        category: s.category,
        executionLevel: lvl.label,
        executionExpectation: lvl.expectation,
        description: s.description,
        implemented: s.implemented !== false,
        blocker: s.blocker || null,
        expectedSheets: (s.expectedSheets && s.expectedSheets.length) ? s.expectedSheets.slice() : null
      });
    }
    return { ok: true, scenarios: scenarios };
  });
}

/**
 * Run ONE registered Test Harness scenario and return its structured report.
 * Accepts only ids present in the harness registry (getHarnessScenarioById_) and
 * rejects any other id fail-closed BEFORE any write. Delegates to
 * testRunScenarioById_(id, options) — which creates the disposable workbook, runs
 * the scenario, has the read-only Validator judge it, and honors options.trash
 * (soft-delete after validation, only after re-passing the disposable gate). Never
 * accepts/uses a client workbook ID.
 * @param {string} scenarioId  a registered scenario id
 * @param {Object=} options     { trash: boolean } (default: keep)
 * @returns {!Object} { ok, report } | { ok:false, error }
 */
function vtRunHarnessScenario(scenarioId, options) {
  return vtSafe_(function() {
    assertHarnessAllowed_();
    var id = String(scenarioId || '').trim();
    if (!getHarnessScenarioById_(id)) {
      throw new Error('Unknown or unsupported scenario: "' + id + '".');
    }
    var trash = !!(options && options.trash === true);
    // testRunScenarioById_ returns the RICH in-memory report (may embed Date objects
    // from temporal comparators). Normalize to a wire-safe copy ONLY for the browser
    // return — the editor runners keep receiving the rich object unchanged.
    var report = testRunScenarioById_(id, { trash: trash });
    return { ok: true, report: makeWireSafe_(report) };
  });
}

/**
 * List the Test Harness SUITES available to the UI, from the suite registry
 * (`getHarnessSuites_`). Guarded by the WRITER
 * guard. Read-only listing — surfaces suite descriptors only; no workbook is
 * created. The console suite dropdown populates from this list, so new registered
 * suites appear with no HTML change.
 * @returns {!Object} { ok, suites:[{id,label,description,scenarioIds,count}] } | {ok:false,error}
 */
function vtListHarnessSuites() {
  return vtSafe_(function() {
    assertHarnessAllowed_();
    var all = getHarnessSuites_();
    var suites = [];
    for (var i = 0; i < all.length; i++) {
      var s = all[i];
      var latestEvidence = null;
      if (s.runner === 'browser' && s.evidenceKey) {
        try {
          var rawEvidence = PropertiesService.getScriptProperties().getProperty(s.evidenceKey);
          var parsedEvidence = rawEvidence ? JSON.parse(rawEvidence) : null;
          if (parsedEvidence && parsedEvidence.suiteId === s.id) {
            latestEvidence = {
              overall: parsedEvidence.overall,
              finishedAt: parsedEvidence.finishedAt,
              cleanupVerified: !!(parsedEvidence.cleanup && parsedEvidence.cleanup.verified)
            };
          }
        } catch (_e) {}
      }
      suites.push({
        id: s.id,
        label: s.label,
        description: s.description,
        implemented: s.implemented !== false,
        blocker: s.blocker || null,
        runner: s.runner || 'server',
        launchUrl: s.runner === 'browser' && s.browserRoute
          ? String(ScriptApp.getService().getUrl() || '').replace(/\?.*$/, '') + '?view=' + encodeURIComponent(s.browserRoute)
          : null,
        latestEvidence: latestEvidence,
        scenarioIds: (s.scenarioIds && s.scenarioIds.length) ? s.scenarioIds.slice() : [],
        count: (s.scenarioIds && s.scenarioIds.length) ? s.scenarioIds.length : 0
      });
    }
    return { ok: true, suites: suites };
  });
}

/**
 * Run every scenario in a registered SUITE (each in its own disposable workbook)
 * and return the aggregated suite report. Accepts only ids present in the suite
 * registry (getHarnessSuiteById_) and rejects any other id fail-closed BEFORE any
 * write. Delegates to testRunSuiteById_(id, { dispositionMode }) — which iterates
 * the scenario runner (creating one disposable workbook per scenario, honoring the
 * disposition policy, and re-passing the disposable gate before every teardown).
 * Never accepts/uses a client workbook ID.
 * @param {string} suiteId  a registered suite id
 * @param {Object=} options { dispositionMode: 'keep'|'trash' } (default keep;
 *                            applied uniformly to every scenario)
 * @returns {!Object} { ok, report } | { ok:false, error }
 */
function vtRunHarnessSuite(suiteId, options) {
  return vtSafe_(function() {
    assertHarnessAllowed_();
    var id = String(suiteId || '').trim();
    if (!getHarnessSuiteById_(id)) {
      throw new Error('Unknown or unsupported suite: "' + id + '".');
    }
    var suite = getHarnessSuiteById_(id);
    if (suite.runner === 'browser') {
      throw new Error('This suite requires its authenticated browser runner. Use the Open Browser Runner action.');
    }
    var mode = (options && options.dispositionMode) ? String(options.dispositionMode) : 'keep';
    // Rich in-memory report may embed Date objects (temporal comparators inside the
    // per-scenario functional results) — normalize to a wire-safe copy for the browser.
    var report = testRunSuiteById_(id, { dispositionMode: mode });
    return { ok: true, report: makeWireSafe_(report) };
  });
}

/**
 * Return the authenticated browser-suite launcher. Admin-only through the
 * Validator guard. The returned URL contains no token; the browser route
 * independently requires the exact disposable non-admin identity.
 */
function vtOpenHarnessBrowserRunner(suiteId) {
  return vtSafe_(function() {
    assertValidatorAllowed_();
    var suite = getHarnessSuiteById_(String(suiteId || '').trim());
    if (!suite || suite.runner !== 'browser') {
      throw new Error('Unknown or unsupported browser suite.');
    }
    if (!suite.browserRoute) {
      throw new Error('This browser suite does not yet have an approved launcher.');
    }
    return {
      ok: true,
      launchUrl: String(ScriptApp.getService().getUrl() || '').replace(/\?.*$/, '') +
        '?view=' + encodeURIComponent(suite.browserRoute)
    };
  });
}
