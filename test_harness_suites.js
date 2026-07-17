/**
 * test_harness_suites.js — Test Harness · suite registry + suite runner + suite
 * report (V1: the Bills Regression Suite).
 *
 * A SUITE runs a fixed, ordered list of registered scenarios as one action so a
 * whole pack (e.g. every Bills recurrence scenario) can be validated after any
 * Bills-related change without hand-running each scenario. Design of record:
 * TEST_HARNESS_ARCHITECTURE.md §7 and REGRESSION_SUITE_PLAN.md.
 *
 * INDEPENDENCE (non-negotiable): a suite is NOT a mega-workbook. Each scenario
 * still runs through the exact same run loop (runScenario_) and creates its OWN
 * disposable workbook with its OWN runId. The suite layer only ITERATES the
 * registry and AGGREGATES the per-scenario reports — it owns no scenario logic and
 * no workbook writes of its own.
 *
 * SAFETY: inherited wholesale from the scenario runner. Every scenario is guarded
 * by assertHarnessAllowed_() (once, at the suite entry) and every write/teardown
 * is gated by assertDisposableTarget_() inside runScenario_. The suite runner
 * never opens, resolves, or accepts a workbook id — it cannot touch the Central
 * default, a bounded/user workbook, or the canonical workbook.
 *
 * FAIL POLICY: one failing scenario does NOT stop the suite — the rest still run
 * (a regression suite must report ALL failures, not just the first). Overall suite
 * status is PASS only if every scenario PASSed and none were skipped. The ONLY
 * early-out is a CATASTROPHIC harness failure: runScenario_ is designed never to
 * throw (it captures scenario/validator errors into the report), so a thrown
 * exception here means a harness-level problem (e.g. workbook-create quota) — the
 * suite stops and marks the remaining scenarios NOT RUN.
 */

/* -------------------------------------------------------------------------- */
/*  Disposition policy                                                          */
/* -------------------------------------------------------------------------- */

/**
 * V1 disposition is UNIFORM: a suite applies the single disposition currently
 * selected in the panel to EVERY scenario — no mixed or per-execution-level policy.
 *   'keep'  — keep every scenario's disposable workbook for inspection (default).
 *   'trash' — trash every scenario's disposable workbook after validation.
 *
 * Deferred (documented, NOT implemented — see TEST_HARNESS_ARCHITECTURE.md §4.0.4):
 *   'keep-failures-only' — keep only workbooks whose scenario FAILed; trash passes.
 *   'trash-passed'       — trash workbooks whose scenario PASSed; keep failures.
 * These require the suite runner to defer teardown until AFTER the scenario verdict
 * is known, so they are intentionally left for a later slice.
 */
var HARNESS_SUITE_DISPOSITION_KEEP_ = 'keep';
var HARNESS_SUITE_DISPOSITION_TRASH_ = 'trash';

/** Normalize an incoming disposition-mode string; only 'trash' trashes, else keep. */
function normalizeSuiteDisposition_(mode) {
  return (String(mode || '').trim().toLowerCase() === HARNESS_SUITE_DISPOSITION_TRASH_)
    ? HARNESS_SUITE_DISPOSITION_TRASH_
    : HARNESS_SUITE_DISPOSITION_KEEP_;   // default keep (matches single-scenario default)
}

/**
 * Resolve whether a scenario's disposable workbook should be trashed. V1 is uniform:
 * every scenario honors the same suite disposition (mixed/per-level policies are
 * deferred). The `scenario` argument is accepted for a future per-scenario policy but
 * intentionally unused today.
 * @param {Object} scenario  a registered scenario descriptor (unused in V1)
 * @param {string} mode      a normalized disposition mode
 * @returns {boolean} true → trash after validation
 */
function harnessSuiteScenarioTrash_(scenario, mode) {
  return normalizeSuiteDisposition_(mode) === HARNESS_SUITE_DISPOSITION_TRASH_;
}

/* -------------------------------------------------------------------------- */
/*  Suite registry                                                              */
/* -------------------------------------------------------------------------- */

/**
 * All Test Harness suites available to the runners/console, in a stable order.
 * A suite is a { id, label, description, scenarioIds[] } descriptor — scenarioIds
 * reference registered scenarios (getHarnessScenarioById_) by id, so a suite never
 * duplicates scenario definitions. New packs (Income / Houses / Retirement /
 * System Integrity / Release Readiness) register here by adding a descriptor; the
 * runner and console pick them up with no other wiring (mirrors the scenario
 * registry pattern in test_harness_scenarios.js).
 *
 * @returns {Array<Object>} suite descriptors
 */
function getHarnessSuites_() {
  return [
    {
      id: 'SUITE-BILLS-REGRESSION',
      label: 'Bills Regression Suite',
      description: 'Every implemented Bills recurrence scenario (8 PURE engine cases + 2 workbook-integration cases). Run after any Bills-related logic change.',
      scenarioIds: [
        // PURE — recurrence-engine math (each still gets its own disposable workbook).
        'REGRESSION-BILLS-MONTHLY',
        'REGRESSION-BILLS-WEEKLY',
        'REGRESSION-BILLS-WEEKLY-ON-DAY',
        'REGRESSION-BILLS-BIWEEKLY',
        'REGRESSION-BILLS-YEAR-BOUNDARY',
        'REGRESSION-BILLS-31ST',
        'REGRESSION-BILLS-LEAP-FEB29',
        'REGRESSION-BILLS-YEARLY',
        // INTEGRATION — visible, inspectable workbook artifacts.
        'REGRESSION-BILLS-MONTHLY-INTEGRATION',
        'REGRESSION-BILLS-MONTHLY-CASHFLOW'
      ]
    },
    {
      id: 'SUITE-RECOVERY-REGRESSION',
      label: 'Recovery Regression Suite',
      description: 'Permanent recovery decision guards, beginning with the silent-duplicate prevention matrix.',
      scenarioIds: [
        'REGRESSION-RECOVERY-DUPLICATE-GUARD'
      ]
    }
  ];
}

/**
 * Look up a suite by id. Returns null if unknown (callers fail-closed on null
 * before any scenario runs).
 * @param {string} id
 * @returns {Object|null}
 */
function getHarnessSuiteById_(id) {
  var wanted = String(id || '').trim();
  var all = getHarnessSuites_();
  for (var i = 0; i < all.length; i++) {
    if (all[i] && all[i].id === wanted) return all[i];
  }
  return null;
}

/* -------------------------------------------------------------------------- */
/*  Public (guarded) suite runners                                             */
/* -------------------------------------------------------------------------- */

/**
 * PUBLIC (guarded) EDITOR RUNNER — run every scenario in a registered suite,
 * each in its OWN disposable workbook, and return the aggregated suite report.
 * Guarded once here; each scenario re-enters the same guarded-by-construction run
 * loop. Fail-closed on an unknown suite id BEFORE any workbook is created.
 *
 * @param {string} suiteId  a registered suite id (see getHarnessSuites_)
 * @param {Object=} options { dispositionMode?: 'keep'|'trash' } (default keep;
 *                            applied UNIFORMLY to every scenario in V1)
 * @returns {Object} the suite report (see buildHarnessSuiteReport_)
 */
function testRunSuiteById_(suiteId, options) {
  assertHarnessAllowed_();
  var suite = getHarnessSuiteById_(suiteId);
  if (!suite) {
    throw new Error('Test Harness: unknown suite "' + String(suiteId) + '".');
  }
  options = options || {};
  var mode = normalizeSuiteDisposition_(options.dispositionMode);
  var suiteRunId = harnessGenerateRunId_();
  var startedAt = Date.now();

  var results = [];       // compact per-scenario summaries (readable)
  var reports = [];       // full per-scenario reports (JSON drill-down)
  var catastrophic = null;

  for (var i = 0; i < suite.scenarioIds.length; i++) {
    var sid = suite.scenarioIds[i];
    var scenario = getHarnessScenarioById_(sid);
    if (!scenario) {
      // A suite listing an unregistered scenario id is a config error, not a
      // harness failure — record a FAIL summary and keep going.
      results.push(harnessSuiteMissingScenario_(sid));
      continue;
    }
    var trash = harnessSuiteScenarioTrash_(scenario, mode);
    var report;
    try {
      // Each scenario gets its OWN runId → its OWN disposable workbook. runScenario_
      // is the same run loop used by single-scenario runs; it never throws.
      report = runScenario_(scenario, harnessGenerateRunId_(), { trash: trash });
    } catch (e) {
      // A throw from runScenario_ is a catastrophic harness-level failure. Stop the
      // suite and mark the remaining scenarios NOT RUN (do not silently continue).
      catastrophic = { scenarioId: sid, error: (e && e.message) ? e.message : String(e) };
      break;
    }
    reports.push(report);
    results.push(harnessSuiteScenarioSummary_(report));
  }

  var finishedAt = Date.now();
  var suiteReport = buildHarnessSuiteReport_({
    suite: suite,
    suiteRunId: suiteRunId,
    mode: mode,
    results: results,
    reports: reports,
    catastrophic: catastrophic,
    startedAt: startedAt,
    finishedAt: finishedAt
  });
  harnessLogSuiteReport_(suiteReport);
  return suiteReport;
}

/**
 * PUBLIC (guarded) EDITOR RUNNER — convenience wrapper: run the Bills Regression
 * Suite. Adds no logic; forwards to testRunSuiteById_.
 * @param {Object=} options { dispositionMode?: 'keep'|'trash' }
 * @returns {Object} the suite report
 */
function testRunBillsSuite(options) {
  return testRunSuiteById_('SUITE-BILLS-REGRESSION', options || {});
}

/** Run the Recovery Regression Suite against disposable harness workbooks. */
function testRunRecoverySuite(options) {
  return testRunSuiteById_('SUITE-RECOVERY-REGRESSION', options || {});
}

/* -------------------------------------------------------------------------- */
/*  Suite report shaping                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Compact per-scenario summary derived from a full scenario report — the readable
 * row a suite report lists. Pulls only summary fields; the full report is kept
 * separately in the suite report's `reports` array for JSON drill-down.
 * @param {Object} report a scenario report (buildHarnessScenarioReport_)
 * @returns {Object}
 */
function harnessSuiteScenarioSummary_(report) {
  var v = report.validators || {};
  return {
    id: report.scenario ? report.scenario.id : null,
    executionLevel: report.scenario ? (report.scenario.executionLevel || null) : null,
    overall: report.overall,
    functional: report.functional
      ? { pass: report.functional.counts.pass, fail: report.functional.counts.fail }
      : null,
    provisioning: v.provisioning ? v.provisioning.overall : 'NOT RUN',
    provisioningCounts: v.provisioning ? v.provisioning.counts : null,
    schema: v.schema
      ? { workbookType: v.schema.workbookType, compatibility: v.schema.compatibility }
      : null,
    drift: v.drift ? v.drift.overall : 'NOT RUN',
    driftCounts: v.drift ? v.drift.counts : null,
    workbook: report.workbook || { id: null, name: null, url: null },
    disposition: report.disposition || null,
    error: report.error || null,
    durationMs: report.durationMs != null ? report.durationMs : null
  };
}

/** Synthetic FAIL summary for a suite entry whose scenario id is not registered. */
function harnessSuiteMissingScenario_(scenarioId) {
  return {
    id: scenarioId,
    executionLevel: null,
    overall: 'FAIL',
    functional: null,
    provisioning: 'NOT RUN',
    provisioningCounts: null,
    schema: null,
    drift: 'NOT RUN',
    driftCounts: null,
    workbook: { id: null, name: null, url: null },
    disposition: 'NOT RUN',
    error: 'Scenario not registered in getHarnessScenarios_.',
    durationMs: null
  };
}

/**
 * Build the aggregated suite report. Overall PASS iff there was no catastrophic
 * failure, every RUN scenario PASSed, and none were skipped.
 *
 * @param {Object} p {
 *   suite:{id,label,description,scenarioIds},
 *   suiteRunId:string, mode:string,
 *   results:Array<Object> (compact summaries),
 *   reports:Array<Object> (full scenario reports),
 *   catastrophic:{scenarioId,error}|null,
 *   startedAt:number, finishedAt:number
 * }
 * @returns {Object} suite report
 */
function buildHarnessSuiteReport_(p) {
  var total = p.suite.scenarioIds.length;
  var pass = 0, fail = 0;
  for (var i = 0; i < p.results.length; i++) {
    if (p.results[i].overall === 'PASS') pass++; else fail++;
  }
  var notRun = total - p.results.length;   // > 0 only after a catastrophic break
  var overall = (!p.catastrophic && fail === 0 && notRun === 0) ? 'PASS' : 'FAIL';

  return {
    type: 'harnessSuite',
    suite: { id: p.suite.id, label: p.suite.label, description: p.suite.description },
    runId: p.suiteRunId,
    dispositionMode: p.mode,
    overall: overall,
    counts: { total: total, pass: pass, fail: fail, notRun: notRun },
    scenarios: p.results,          // readable compact summaries (in run order)
    catastrophic: p.catastrophic || null,
    startedAt: p.startedAt ? new Date(p.startedAt).toISOString() : null,
    finishedAt: p.finishedAt ? new Date(p.finishedAt).toISOString() : null,
    durationMs: (p.startedAt && p.finishedAt) ? (p.finishedAt - p.startedAt) : null,
    // Full per-scenario reports for programmatic callers / JSON drill-down (not
    // printed in the human log).
    reports: p.reports || []
  };
}

/** Human-readable suite report for the execution log. */
function formatHarnessSuiteReport_(report) {
  var c = report.counts || {};
  var lines = [];
  lines.push('===== TEST HARNESS — SUITE RESULT =====');
  lines.push('Suite        : ' + (report.suite.label || report.suite.id) + '  [' + report.suite.id + ']');
  lines.push('Run ID       : ' + report.runId);
  lines.push('Disposition  : ' + report.dispositionMode);
  if (report.durationMs != null) {
    lines.push('Duration     : ' + (report.durationMs / 1000).toFixed(1) + ' s');
  }
  lines.push('Scenarios    : ' + (c.total || 0) + '  (' + (c.pass || 0) + ' pass, ' +
    (c.fail || 0) + ' fail' + (c.notRun ? ', ' + c.notRun + ' not run' : '') + ')');
  lines.push('');
  for (var i = 0; i < report.scenarios.length; i++) {
    var s = report.scenarios[i];
    var lvl = s.executionLevel ? ' [' + s.executionLevel + ']' : '';
    var fn = s.functional ? ('  fn ' + s.functional.pass + '/' + (s.functional.pass + s.functional.fail)) : '';
    var line = '  ' + (s.overall === 'PASS' ? 'PASS' : 'FAIL') + '  ' + s.id + lvl +
      '  (prov ' + s.provisioning + ', drift ' + s.drift + fn + ', ' + s.disposition + ')';
    lines.push(line);
    if (s.error) lines.push('        ERROR: ' + s.error);
  }
  if (report.catastrophic) {
    lines.push('');
    lines.push('CATASTROPHIC : ' + report.catastrophic.scenarioId + ' — ' + report.catastrophic.error);
    lines.push('               remaining scenarios NOT RUN.');
  }
  lines.push('');
  lines.push('OVERALL      : ' + report.overall);
  lines.push('===== END SUITE (' + report.overall + ') =====');
  return lines.join('\n');
}

/** Log a suite report: human summary + chunked JSON (full detail). */
function harnessLogSuiteReport_(report) {
  Logger.log(formatHarnessSuiteReport_(report));
  try {
    if (typeof validatorLogChunked_ === 'function') {
      validatorLogChunked_('TEST HARNESS SUITE (JSON)', JSON.stringify(report, null, 2));
    }
  } catch (_e) { /* logging is best-effort */ }
}
