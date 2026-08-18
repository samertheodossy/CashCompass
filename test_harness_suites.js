/**
 * test_harness_suites.js — Test Harness · suite registry + suite runner + suite
 * report (registered on-demand regression/safety suites).
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
      id: 'SUITE-PART-2A-STABLE-IDENTITY',
      label: 'Part 2A Stable Financial Identity',
      description: 'Validate the pure source-scoped identity matcher, rename survival, ambiguity refusal, owner separation, and masked identifiers on a marker-verified disposable workbook.',
      scenarioIds: ['REGRESSION-PART-2A-FINANCIAL-IDENTITY']
    },
    {
      id: 'SUITE-PART-2A-FINANCIAL-FACTS',
      label: 'Part 2A Financial Facts Foundation',
      description: 'Validate the typed fact contracts, provenance, Effective-As-Of freshness, policy-owned current selection, decision-specific actionability, append-only evidence, idempotency, and rebuildable shadow projection.',
      scenarioIds: [
        'REGRESSION-PART-2A-FINANCIAL-FACTS',
        'REGRESSION-PART-2A-FINANCIAL-FACTS-INTEGRATION'
      ]
    },
    {
      id: 'SUITE-PART-2A-AUTHORITATIVE-CASH-IMPORT',
      label: 'Part 2A Authoritative Cash Import',
      description: 'Validate source-neutral OFX/QFX cash evidence, protected identity matching, exact provenance and freshness, partial safe apply, duplicate no-op, shadow reconciliation, Planning isolation, and disposable cleanup.',
      scenarioIds: ['REGRESSION-PART-2A-AUTHORITATIVE-CASH-IMPORT']
    },
    {
      id: 'SUITE-PART-2A-AUTHORITATIVE-REVOLVING-DEBT',
      label: 'Part 2A Authoritative Revolving Debt Import',
      description: 'Validate source-neutral revolving-debt evidence, stable protected identity, fact-level freshness, manual supplements, APR ambiguity refusal, sanitized duplicate-safe apply, shadow reconciliation, weekly cash/debt readiness, and Planning isolation.',
      scenarioIds: ['REGRESSION-PART-2A-AUTHORITATIVE-REVOLVING-DEBT']
    },
    {
      id: 'SUITE-PART-2A-DATA-READINESS',
      label: 'Part 2A Data Refresh and Plan Readiness',
      description: 'Validate the shadow-only cash and credit-card readiness model, concise customer presentation, exact reconciliation, APR-review routing, Planning isolation, and disposable cleanup.',
      scenarioIds: ['REGRESSION-PART-2A-DATA-READINESS']
    },
    {
      id: 'SUITE-RFP-CAPITAL-ALLOCATION-FOUNDATION',
      label: 'Capital Allocation Foundation',
      description: 'Validate deterministic read-only household facts, required constraints, and the unranked in-memory candidate queue before recommendation policy is enabled.',
      scenarioIds: [
        'REGRESSION-RFP-CAPITAL-ALLOCATION-FOUNDATION',
        'REGRESSION-RFP-CAPITAL-ALLOCATION-WEEKLY-PLAN'
      ]
    },
    {
      id: 'SUITE-RFP-INVESTMENT-FOUNDATION',
      label: 'Income-Producing Investment Foundation',
      description: 'Validate stable Income-Producing designations plus preview-first broker activity import, exclusions, dedupe, and derived holdings on marker-verified disposable workbooks.',
      scenarioIds: [
        'REGRESSION-RFP-INVESTMENT-METADATA',
        'REGRESSION-RFP-INVESTMENT-ACTIVITY'
      ]
    },
    {
      id: 'SUITE-BILLS-REGRESSION',
      label: 'Bills Regression Suite',
      description: 'Implemented Bills recurrence, exact Edit linkage/rollback, AutoPay formatting, Weekly weekday authority, and AutoPay audit-rollback scenarios. Every writer runs in its own marker-verified disposable workbook.',
      scenarioIds: [
        // PURE — recurrence-engine math (each still gets its own disposable workbook).
        'REGRESSION-BILLS-MONTHLY',
        'REGRESSION-BILLS-NEW-CREATION-FLOOR',
        'REGRESSION-BILLS-WEEKLY',
        'REGRESSION-BILLS-WEEKLY-ON-DAY',
        'REGRESSION-BILLS-BIWEEKLY',
        'REGRESSION-BILLS-YEAR-BOUNDARY',
        'REGRESSION-BILLS-31ST',
        'REGRESSION-BILLS-LEAP-FEB29',
        'REGRESSION-BILLS-YEARLY',
        // INTEGRATION — visible, inspectable workbook artifacts.
        'REGRESSION-BILLS-MONTHLY-INTEGRATION',
        'REGRESSION-BILLS-MONTHLY-CASHFLOW',
        'REGRESSION-BILLS-EDIT-INTEGRITY',
        'REGRESSION-BILLS-AUTOPAY-FORMAT',
        'REGRESSION-BILLS-WEEKDAY-AUTOPAY-GUARD',
        'REGRESSION-BILLS-AUTOPAY-ROLLBACK'
      ]
    },
    {
      id: 'SUITE-RECOVERY-REGRESSION',
      label: 'Recovery Regression Suite',
      description: 'Permanent recovery decision guards, beginning with the silent-duplicate prevention matrix.',
      scenarioIds: [
        'REGRESSION-RECOVERY-DUPLICATE-GUARD'
      ]
    },
    {
      id: 'SUITE-QUICK-ADD-RELIABILITY',
      label: 'Quick Add Reliability Suite',
      description: 'Quick Add write verification, guarded restore, and immutable direct-entry correction safety.',
      scenarioIds: [
        'REGRESSION-QUICK-ADD-WRITE-GUARD',
        'REGRESSION-DIRECT-QUICK-ADD-CORRECTION',
        'REGRESSION-DONATION-CORRECTION',
        'REGRESSION-DONATION-COMMENTS-EDIT',
        'REGRESSION-DONATION-FULL-EDIT'
      ]
    },
    {
      id: 'SUITE-POPULATED-FIXTURE',
      label: 'Representative Populated Fixture',
      description: 'Central-created Restricted fixture with synthetic Bank, Investment, House, Debt, Bills, Income, Upcoming, and Retirement data; always verifies Trash cleanup.',
      scenarioIds: [
        'SMOKE-POPULATED-FIXTURE'
      ]
    },
    {
      id: 'SUITE-WORKBOOK-HEALTH',
      label: 'Workbook Health Validation',
      description: 'Run aggregate read-only Workbook Health—schema, formulas, conditional formatting, named ranges, Provisioning, and Drift—on the proven Restricted populated disposable fixture with verified Trash cleanup.',
      scenarioIds: [
        'SMOKE-POPULATED-FIXTURE'
      ]
    },
    {
      id: 'SUITE-CENTRAL-SAFETY',
      label: 'Central Safety Regression',
      description: 'On-demand recent-session guard pack: recovery duplicate prevention, Quick Add write integrity, and Restricted representative populated-fixture lifecycle.',
      scenarioIds: [
        'REGRESSION-RECOVERY-DUPLICATE-GUARD',
        'REGRESSION-QUICK-ADD-WRITE-GUARD',
        'REGRESSION-DIRECT-QUICK-ADD-CORRECTION',
        'REGRESSION-DONATION-CORRECTION',
        'REGRESSION-DONATION-FULL-EDIT',
        'SMOKE-POPULATED-FIXTURE'
      ]
    },
    {
      id: 'SUITE-HOUSE-FINANCIAL-ACCURACY',
      label: 'House Financial Accuracy',
      description: 'Validate styled Debts-to-property schema evolution plus actual linked-loan payments and Property Performance reconciliation on Restricted disposable workbooks.',
      scenarioIds: [
        'REGRESSION-HOUSE-DEBT-LINK-SCHEMA'
      ]
    },
    {
      id: 'SUITE-FINANCIAL-INTEGRITY-CANONICAL',
      label: 'Financial Integrity Canonical Snapshot',
      description: 'Validate the approved current-position read model, live consumers, read-only audits, canonical History capture/freshness, and fail-closed property financing on a Restricted disposable workbook.',
      scenarioIds: [
        'REGRESSION-FINANCIAL-INTEGRITY-CANONICAL'
      ]
    },
    {
      id: 'SUITE-FIRST-RUN-UX-E2E',
      label: 'First-Run UX E2E',
      description: 'Browser-driven fresh Central provisioning, Setup, navigation, gating, Retirement prerequisite guidance, Help, real Refresh state, clean-console checks, and verified Trash cleanup.',
      implemented: true,
      runner: 'browser',
      browserRoute: 'first-run-e2e',
      evidenceKey: 'FIRST_RUN_E2E_LATEST_EVIDENCE_V6',
      blocker: null,
      scenarioIds: []
    },
    {
      id: 'SUITE-POPULATED-DASHBOARD-E2E',
      label: 'Populated Dashboard E2E',
      description: 'Browser-driven populated KPI, selection/action, controlled loading, Bill Skip/Stop safety, Retirement ready results, equity, subtab, Help/Setup, real Refresh, customer-language, clean-console validation, and privacy-safe five-sample 4f ordinary-Save stage timing plus loaded-navigation and representative populated Overview timing.',
      implemented: true,
      runner: 'browser',
      browserRoute: 'populated-dashboard-e2e',
      evidenceKey: 'POPULATED_DASHBOARD_E2E_LATEST_EVIDENCE_V12',
      blocker: null,
      scenarioIds: []
    },
    {
      id: 'SUITE-RECOVERY-LIVE',
      label: 'Recovery Live',
      description: 'Authenticated disposable-account production recovery: confirmation, reconnect, stale/Trash routing, ambiguity, protected-target isolation, and verified cleanup.',
      implemented: true,
      runner: 'browser',
      browserRoute: 'recovery-test',
      evidenceKey: 'RECOVERY_LIVE_LATEST_EVIDENCE_V1',
      blocker: null,
      scenarioIds: []
    },
    {
      id: 'SUITE-PERFORMANCE-PLANNER',
      label: 'Performance Planner',
      description: 'Twenty independent real first/repeat planner pairs with Restricted fixtures, verified Trash, privacy-safe p50/p95 evidence, History retention, zero generated History/Dashboard charts, blank chart-support cells, and ratified budgets.',
      implemented: true,
      runner: 'browser',
      browserRoute: 'performance-test',
      evidenceKey: 'PERFORMANCE_PLANNER_LATEST_EVIDENCE_V1',
      blocker: null,
      scenarioIds: ['PERFORMANCE-PLANNER-FIRST-REPEAT']
    },
    {
      id: 'SUITE-BILLS-PAY-E2E',
      label: 'Bills Pay E2E',
      description: 'Planned Due → Pay → Cash Flow → Activity → duplicate-suppression workflow.',
      implemented: true,
      blocker: 'Synthetic server E2E does not replace separately required natural cohort proof.',
      scenarioIds: ['E2E-BILLS-DUE-PAY']
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
  if (suite.implemented === false) {
    throw new Error('Test Harness: suite "' + suite.id + '" is NOT IMPLEMENTED. ' + String(suite.blocker || 'Required execution seam is unavailable.'));
  }
  if (suite.runner === 'browser') {
    throw new Error('Test Harness: suite "' + suite.id +
      '" must run in its authenticated browser runner; the server suite runner cannot substitute for browser evidence.');
  }
  options = options || {};
  var mode = normalizeSuiteDisposition_(options.dispositionMode);
  var suiteRunId = harnessGenerateRunId_();
  var startedAt = Date.now();
  var progressToken = harnessProgressToken_(options.progressToken);

  var results = [];       // compact per-scenario summaries (readable)
  var reports = [];       // full per-scenario reports (JSON drill-down)
  var catastrophic = null;
  var suiteExpectedAssertions = 0;
  for (var ec = 0; ec < suite.scenarioIds.length; ec++) {
    var expectedScenario = getHarnessScenarioById_(suite.scenarioIds[ec]);
    if (!expectedScenario || !Number(expectedScenario.expectedAssertionCount)) {
      suiteExpectedAssertions = 0;
      break;
    }
    suiteExpectedAssertions += Number(expectedScenario.expectedAssertionCount);
  }

  function completedAssertionCounts_() {
    var counts = { completed: 0, pass: 0, fail: 0 };
    for (var c = 0; c < results.length; c++) {
      if (!results[c].functional) continue;
      counts.pass += Number(results[c].functional.pass) || 0;
      counts.fail += Number(results[c].functional.fail) || 0;
    }
    counts.completed = counts.pass + counts.fail;
    return counts;
  }

  function suiteProgress_(phase, message, currentScenario, assertionCounts) {
    if (!progressToken) return;
    var scenariosPassed = 0;
    for (var p = 0; p < results.length; p++) {
      if (results[p].overall === 'PASS') scenariosPassed++;
    }
    harnessWriteProgress_(progressToken, {
      kind: 'suite',
      suiteId: suite.id,
      scenarioId: currentScenario || '',
      scenarioIndex: Math.min(results.length + 1, suite.scenarioIds.length),
      scenarioTotal: suite.scenarioIds.length,
      scenariosCompleted: results.length,
      scenariosPassed: scenariosPassed,
      scenariosFailed: results.length - scenariosPassed,
      phase: phase,
      message: String(message || ''),
      startedAt: new Date(startedAt).toISOString(),
      expectedAssertions: suiteExpectedAssertions ||
        (assertionCounts ? assertionCounts.expected : 0),
      assertionsCompleted: assertionCounts ? assertionCounts.completed : 0,
      assertionsPassed: assertionCounts ? assertionCounts.pass : 0,
      assertionsFailed: assertionCounts ? assertionCounts.fail : 0
    });
  }

  suiteProgress_('STARTING', 'Starting suite…', '', {
    expected: suiteExpectedAssertions,
    completed: 0,
    pass: 0,
    fail: 0
  });

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
      var scenariosPassed = 0;
      for (var r = 0; r < results.length; r++) {
        if (results[r].overall === 'PASS') scenariosPassed++;
      }
      var assertionCountsBefore = completedAssertionCounts_();
      report = runScenario_(scenario, harnessGenerateRunId_(), {
        trash: trash,
        progress: progressToken ? {
          token: progressToken,
          kind: 'suite',
          suiteId: suite.id,
          scenarioIndex: i + 1,
          scenarioTotal: suite.scenarioIds.length,
          scenariosCompleted: results.length,
          scenariosPassed: scenariosPassed,
          scenariosFailed: results.length - scenariosPassed,
          startedAt: new Date(startedAt).toISOString(),
          expectedAssertions: suiteExpectedAssertions,
          assertionsCompletedBefore: assertionCountsBefore.completed,
          assertionsPassedBefore: assertionCountsBefore.pass,
          assertionsFailedBefore: assertionCountsBefore.fail
        } : null
      });
    } catch (e) {
      // A throw from runScenario_ is a catastrophic harness-level failure. Stop the
      // suite and mark the remaining scenarios NOT RUN (do not silently continue).
      catastrophic = { scenarioId: sid, error: (e && e.message) ? e.message : String(e) };
      break;
    }
    reports.push(report);
    results.push(harnessSuiteScenarioSummary_(report));
    var aggregateCounts = completedAssertionCounts_();
    suiteProgress_('SCENARIO_COMPLETE',
      'Scenario ' + (i + 1) + ' of ' + suite.scenarioIds.length + ' completed.',
      sid,
      {
        expected: suiteExpectedAssertions,
        completed: aggregateCounts.completed,
        pass: aggregateCounts.pass,
        fail: aggregateCounts.fail
      });
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
  var aggregateAssertions = suiteReport.assertions || {};
  suiteProgress_('COMPLETE', suiteReport.overall === 'PASS' ?
    'Suite completed successfully.' : 'Suite completed with failures.', '', {
    expected: aggregateAssertions.total || 0,
    completed: aggregateAssertions.total || 0,
    pass: aggregateAssertions.pass || 0,
    fail: aggregateAssertions.fail || 0
  });
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

/** Run the Quick Add Reliability Suite against disposable harness workbooks. */
function testRunQuickAddReliabilitySuite(options) {
  return testRunSuiteById_('SUITE-QUICK-ADD-RELIABILITY', options || {});
}

/**
 * PUBLIC (guarded) EDITOR RUNNER — Part 2A authoritative revolving-debt import.
 * Defaults to verified Trash cleanup so an argument-free isolated-Central run
 * cannot leave its disposable fixture behind.
 * @param {Object=} options optional suite options
 * @returns {Object} aggregate suite report
 */
function testRunPart2aAuthoritativeDebtSuite(options) {
  var requested = options || {};
  if (!requested.dispositionMode) requested.dispositionMode = 'trash';
  return testRunSuiteById_('SUITE-PART-2A-AUTHORITATIVE-REVOLVING-DEBT', requested);
}

/** Guarded disposable runner for the Part 2A-5 customer-facing readiness slice. */
function testRunPart2aDataReadinessSuite(options) {
  var requested = options || {};
  if (!requested.dispositionMode) requested.dispositionMode = 'trash';
  return testRunSuiteById_('SUITE-PART-2A-DATA-READINESS', requested);
}

/** Run the representative populated fixture; the scenario always verifies Trash. */
function testRunPopulatedFixtureSuite(options) {
  return testRunSuiteById_('SUITE-POPULATED-FIXTURE', options || {});
}

/** Run the recent-session Central safety pack; pass dispositionMode:'trash'. */
function testRunCentralSafetySuite(options) {
  return testRunSuiteById_('SUITE-CENTRAL-SAFETY', options || {});
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
  var assertionPass = 0, assertionFail = 0;
  for (var a = 0; a < p.results.length; a++) {
    if (!p.results[a].functional) continue;
    assertionPass += Number(p.results[a].functional.pass) || 0;
    assertionFail += Number(p.results[a].functional.fail) || 0;
  }

  return {
    type: 'harnessSuite',
    suite: { id: p.suite.id, label: p.suite.label, description: p.suite.description },
    runId: p.suiteRunId,
    dispositionMode: p.mode,
    overall: overall,
    counts: { total: total, pass: pass, fail: fail, notRun: notRun },
    assertions: {
      total: assertionPass + assertionFail,
      pass: assertionPass,
      fail: assertionFail
    },
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

/** Log a suite report: human summary + compact failures + chunked JSON (full detail). */
function harnessLogSuiteReport_(report) {
  Logger.log(formatHarnessSuiteReport_(report));
  var failures = [];
  var reports = report && report.reports ? report.reports : [];
  for (var r = 0; r < reports.length; r++) {
    var results = reports[r] && reports[r].functional && reports[r].functional.results
      ? reports[r].functional.results : [];
    for (var i = 0; i < results.length; i++) {
      if (results[i] && !results[i].pass) {
        failures.push({
          scenarioId: reports[r].scenario ? reports[r].scenario.id : null,
          assertionId: results[i].id,
          label: results[i].label,
          expected: results[i].expected,
          actual: results[i].actual,
          reason: results[i].reason
        });
      }
    }
  }
  if (failures.length) {
    Logger.log('FAILED ASSERTIONS (COMPACT): ' + JSON.stringify(failures));
  }
  try {
    if (typeof validatorLogChunked_ === 'function') {
      validatorLogChunked_('TEST HARNESS SUITE (JSON)', JSON.stringify(report, null, 2));
    }
  } catch (_e) { /* logging is best-effort */ }
}
