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

/* -------------------------------------------------------------------------- */
/*  Dashboard read profile — selected-workbook, getter-only diagnostics        */
/* -------------------------------------------------------------------------- */

/**
 * Fixed dashboard data families. These are intentionally sheet selectors, not
 * calls into production dashboard getters: several production getters include
 * legitimate self-heal writes that are unsafe for a read-only diagnostic.
 *
 * The report exposes only these fixed labels plus aggregate size/timing data.
 * It never returns sheet names or cell values from the selected workbook.
 */
function vtDashboardReadProfileSpecs_() {
  var year = new Date().getFullYear();
  return [
    { id: 'history', label: 'Overview history', exact: ['OUT - History'] },
    { id: 'cash_flow', label: 'Current-year Cash Flow', exact: ['INPUT - Cash Flow ' + year] },
    { id: 'bank', label: 'Bank accounts', exact: ['INPUT - Bank Accounts', 'SYS - Accounts'] },
    { id: 'investments', label: 'Investments', exact: ['INPUT - Investments', 'SYS - Assets'] },
    { id: 'properties', label: 'Properties', exact: ['INPUT - House Values', 'SYS - House Assets'] },
    { id: 'property_expenses', label: 'Property expenses', prefix: 'HOUSES - ' },
    { id: 'debts', label: 'Debts', exact: ['INPUT - Debts'] },
    { id: 'bills', label: 'Bills and activity', exact: ['INPUT - Bills', 'LOG - Activity'] },
    { id: 'upcoming', label: 'Upcoming expenses', exact: ['INPUT - Upcoming Expenses'] },
    { id: 'planning', label: 'Planning inputs', exact: ['INPUT - Retirement', 'INPUT - Settings'] }
  ];
}

/** @returns {!Array<!Object>} */
function vtDashboardReadProfileSheets_(sheets, spec) {
  var exact = {};
  (spec.exact || []).forEach(function(name) { exact[name] = true; });
  return sheets.filter(function(sheet) {
    var name = String(sheet.getName() || '');
    return !!exact[name] || (!!spec.prefix && name.indexOf(spec.prefix) === 0);
  });
}

/**
 * Read one fixed data family. Getter-only by construction.
 * Values are immediately discarded and never enter the returned report.
 */
function vtDashboardReadProfileStage_(sheets, spec, pass) {
  var matched = vtDashboardReadProfileSheets_(sheets, spec);
  var started = Date.now();
  var rows = 0;
  var columns = 0;
  var cells = 0;
  var outcome = matched.length ? 'ok' : 'missing';
  var error = '';

  try {
    matched.forEach(function(sheet) {
      var range = sheet.getDataRange();
      var rangeRows = range.getNumRows();
      var rangeColumns = range.getNumColumns();
      var raw = range.getValues();
      var displayed = range.getDisplayValues();
      rows += rangeRows;
      columns += rangeColumns;
      cells += rangeRows * rangeColumns;
      raw = null;
      displayed = null;
    });
  } catch (e) {
    outcome = 'error';
    // Do not return provider error text: it may contain a workbook-derived
    // sheet/range name. The fixed stage label is enough to locate the failure.
    error = 'Read failed for this data area.';
  }

  return {
    id: spec.id,
    label: spec.label,
    pass: pass,
    durationMs: Math.max(0, Date.now() - started),
    outcome: outcome,
    sheetCount: matched.length,
    rowCount: rows,
    columnCount: columns,
    cellCount: cells,
    error: error
  };
}

/**
 * Profile the workbook-read layer used to populate the dashboard.
 *
 * This action is safe for any admin-selected workbook, including a bounded
 * workbook: it uses only openById/getSheets/getName/getDataRange/range getters.
 * It never creates, repairs, formats, flushes, logs, caches, or persists data.
 * Two sequential passes distinguish first-read cost from an immediate repeat.
 */
function vtRunDashboardReadProfile(spreadsheetId) {
  return vtSafe_(function() {
    assertValidatorAllowed_();
    var t = vtResolveTarget_(spreadsheetId);
    var sheets = t.ss.getSheets();
    var specs = vtDashboardReadProfileSpecs_();
    var passes = [];

    [1, 2].forEach(function(pass) {
      var stages = specs.map(function(spec) {
        return vtDashboardReadProfileStage_(sheets, spec, pass);
      });
      passes.push({
        pass: pass,
        totalMs: stages.reduce(function(total, stage) { return total + stage.durationMs; }, 0),
        stages: stages
      });
    });

    var firstById = {};
    passes[0].stages.forEach(function(stage) { firstById[stage.id] = stage; });
    var comparison = passes[1].stages.map(function(repeat) {
      var first = firstById[repeat.id];
      return {
        id: repeat.id,
        label: repeat.label,
        firstMs: first.durationMs,
        repeatMs: repeat.durationMs,
        outcome: repeat.outcome === 'error' || first.outcome === 'error'
          ? 'error'
          : (repeat.outcome === 'missing' && first.outcome === 'missing' ? 'missing' : 'ok'),
        sheetCount: repeat.sheetCount,
        rowCount: repeat.rowCount,
        columnCount: repeat.columnCount,
        cellCount: repeat.cellCount,
        error: repeat.error || first.error || ''
      };
    }).sort(function(a, b) { return b.repeatMs - a.repeatMs; });

    var errorCount = comparison.filter(function(stage) { return stage.outcome === 'error'; }).length;
    var missingCount = comparison.filter(function(stage) { return stage.outcome === 'missing'; }).length;
    return {
      ok: true,
      target: vtTargetInfo_(t),
      report: {
        operation: 'dashboard_read_profile',
        safety: VT_SAFETY_READONLY_,
        collectedAt: new Date().toISOString(),
        overall: errorCount ? 'COMPLETE_WITH_ERRORS' : (missingCount ? 'COMPLETE_WITH_GAPS' : 'COMPLETE'),
        firstTotalMs: passes[0].totalMs,
        repeatTotalMs: passes[1].totalMs,
        slowestStage: comparison.length ? comparison[0].label : '',
        errorCount: errorCount,
        missingCount: missingCount,
        comparison: comparison
      }
    };
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
        expectedAssertionCount: Number(s.expectedAssertionCount) || 0,
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
    var progressToken = harnessProgressToken_(options && options.progressToken);
    // testRunScenarioById_ returns the RICH in-memory report (may embed Date objects
    // from temporal comparators). Normalize to a wire-safe copy ONLY for the browser
    // return — the editor runners keep receiving the rich object unchanged.
    var report = testRunScenarioById_(id, {
      trash: trash,
      progress: progressToken ? {
        token: progressToken,
        kind: 'scenario',
        scenarioIndex: 1,
        scenarioTotal: 1,
        startedAt: new Date().toISOString()
      } : null
    });
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
              runId: parsedEvidence.runId || null,
              overall: parsedEvidence.overall,
              finishedAt: parsedEvidence.finishedAt,
              cleanupVerified: !!(parsedEvidence.cleanup && parsedEvidence.cleanup.verified),
              releaseEligible: parsedEvidence.releaseEligible === true,
              releaseRunId: parsedEvidence.releaseRunId || null
            };
          }
        } catch (_e) {}
      }
      var expectedAssertionCount = 0;
      var assertionCountKnown = true;
      var suiteScenarioIds = (s.scenarioIds && s.scenarioIds.length)
        ? s.scenarioIds.slice() : [];
      for (var j = 0; j < suiteScenarioIds.length; j++) {
        var scenario = getHarnessScenarioById_(suiteScenarioIds[j]);
        if (!scenario || !Number(scenario.expectedAssertionCount)) {
          assertionCountKnown = false;
          break;
        }
        expectedAssertionCount += Number(scenario.expectedAssertionCount);
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
        scenarioIds: suiteScenarioIds,
        count: suiteScenarioIds.length,
        expectedAssertionCount: assertionCountKnown ? expectedAssertionCount : 0
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
    var progressToken = harnessProgressToken_(options && options.progressToken);
    var report = testRunSuiteById_(id, {
      dispositionMode: mode,
      progressToken: progressToken
    });
    return { ok: true, report: makeWireSafe_(report) };
  });
}

/**
 * Poll one privacy-safe, user-scoped Harness progress snapshot. The payload has
 * phase/timing/count metadata only—never workbook ids, names, or financial data.
 */
function vtGetHarnessRunProgress(progressToken) {
  return vtSafe_(function() {
    assertHarnessAllowed_();
    var token = harnessProgressToken_(progressToken);
    if (!token) throw new Error('Invalid Harness progress token.');
    return { ok: true, progress: harnessReadProgress_(token) };
  });
}

/**
 * Return the authenticated browser-suite launcher. Admin-only through the
 * Validator guard. An optional non-secret Release Readiness run id identifies
 * evidence ownership; it is not an authorization token. The browser route still
 * independently requires the exact disposable non-admin identity.
 */
function vtOpenHarnessBrowserRunner(suiteId, requestedReleaseRunId) {
  return vtSafe_(function() {
    assertValidatorAllowed_();
    var suite = getHarnessSuiteById_(String(suiteId || '').trim());
    if (!suite || suite.runner !== 'browser') {
      throw new Error('Unknown or unsupported browser suite.');
    }
    if (!suite.browserRoute) {
      throw new Error('This browser suite does not yet have an approved launcher.');
    }
    var releaseRunId = releaseSanitizeMetadata_(requestedReleaseRunId);
    if (releaseRunId) {
      var owner = releaseBrowserEvidenceContext_(releaseRunId);
      if (!owner.releaseEligible) {
        throw new Error('The requested Release Readiness run is not the active browser-evidence owner.');
      }
    }
    return {
      ok: true,
      launchUrl: String(ScriptApp.getService().getUrl() || '').replace(/\?.*$/, '') +
        '?view=' + encodeURIComponent(suite.browserRoute) +
        (releaseRunId ? '&releaseRunId=' + encodeURIComponent(releaseRunId) : ''),
      releaseOwned: !!releaseRunId
    };
  });
}

/* -------------------------------------------------------------------------- */
/*  Release Readiness — bounded orchestration adapters                         */
/*                                                                              */
/*  Release Readiness never resolves or opens the selected workbook. Workbook   */
/*  Health and every workflow check create their own disposable workbook through */
/*  runScenario_.                                                               */
/* -------------------------------------------------------------------------- */

function vtReleaseReadinessStart(spreadsheetId, metadata) {
  return vtSafe_(function() {
    assertValidatorAllowed_();
    assertHarnessAllowed_();
    // spreadsheetId is intentionally ignored for backward-compatible clients.
    // The release workflow must never resolve or open a selected/bounded target.
    var state = releaseReadinessStart(metadata || {});
    return { ok: true, state: makeWireSafe_(state) };
  });
}

function vtReleaseReadinessRunNextChunk() {
  return vtSafe_(function() {
    assertValidatorAllowed_();
    assertHarnessAllowed_();
    return { ok: true, progress: makeWireSafe_(releaseReadinessRunNextChunk()),
      state: makeWireSafe_(releaseReadinessGetStatus()) };
  });
}

function vtReleaseReadinessGetStatus() {
  return vtSafe_(function() {
    assertValidatorAllowed_();
    return { ok: true, state: makeWireSafe_(releaseReadinessGetStatus()),
      archives: makeWireSafe_(releaseReadinessListArchives()) };
  });
}

function vtReleaseReadinessFinalize() {
  return vtSafe_(function() {
    assertValidatorAllowed_();
    return { ok: true, state: makeWireSafe_(releaseReadinessFinalize()),
      archives: makeWireSafe_(releaseReadinessListArchives()) };
  });
}

/** Admin-only explicit control for the default-OFF disposable test writer. */
function vtSetReleaseHarnessEnabled(enabled, confirmed) {
  return vtSafe_(function() {
    assertValidatorAllowed_();
    if (confirmed !== true) throw new Error('Explicit confirmation is required to change the disposable test runner flag.');
    var props = PropertiesService.getScriptProperties();
    if (enabled === true) {
      props.setProperty(TEST_HARNESS_ENABLED_KEY_, 'true');
      props.setProperty(RELEASE_OWNS_HARNESS_FLAG_KEY_, 'true');
    } else {
      props.deleteProperty(TEST_HARNESS_ENABLED_KEY_);
      props.deleteProperty(RELEASE_OWNS_HARNESS_FLAG_KEY_);
    }
    return { ok: true, enabled: enabled === true };
  });
}

function vtGetReleaseHarnessEnabled() {
  return vtSafe_(function() {
    assertValidatorAllowed_();
    return { ok: true, enabled: PropertiesService.getScriptProperties()
      .getProperty(TEST_HARNESS_ENABLED_KEY_) === 'true' };
  });
}
