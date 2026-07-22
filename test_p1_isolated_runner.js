/**
 * One-click developer runners for the approved P1 isolated validation pass.
 *
 * These functions are intentionally not wired to doGet, menus, or triggers. They
 * run only from the Central Apps Script editor as an allow-listed admin. Every
 * workbook written is created by the Test Harness, re-passes the disposable
 * target gate before each write, and is verified in Drive Trash. Both feature
 * flags are restored to their exact prior values in a finally block.
 */

function testRunP1WorkbookHealthAndRelease() {
  return p1WithTemporaryTestFlags_(function() {
    var metadata = p1ReadRequiredReleaseMetadata_();
    var base = getHarnessPopulatedFixtureScenario_();
    var scenario = {};
    for (var key in base) if (base.hasOwnProperty(key)) scenario[key] = base[key];
    scenario.id = 'P1-WORKBOOK-HEALTH-RELEASE';
    scenario.description = 'Validate aggregate Workbook Health and bounded NOT_READY release evidence on a populated disposable workbook.';
    scenario.requiresTrashCleanup = false;

    var runId = harnessGenerateRunId_();
    var report = null;
    var cleanup = null;
    try {
      report = runScenario_(scenario, runId, { trash: false });
      if (!report || !report.workbook || !report.workbook.id) {
        throw new Error('P1 validation fixture was not created.');
      }

      var started = releaseReadinessStart({
        sourceVersion: metadata.sourceVersion,
        deployment: metadata.deployment,
        openSeverity1: 0,
        openSeverity2: 0
      });
      var finalized = releaseReadinessFinalize();
      if (finalized.status !== 'NOT_READY') {
        throw new Error('P1 release verdict must remain NOT_READY until the missing suites and performance budgets are complete.');
      }

      cleanup = teardownDisposableWorkbook_(SpreadsheetApp.openById(report.workbook.id), runId, { trash: true });
      var result = {
        overall: report.overall,
        workbookHealth: report.full && report.full.health ? {
          overall: report.full.health.overall,
          gate: report.full.health.gate,
          advisory: report.full.health.advisory
        } : null,
        functional: report.functional ? report.functional.counts : null,
        sharing: report.sharing,
        cleanup: cleanup,
        releaseReadiness: {
          runId: started.runId,
          status: finalized.status,
          failures: finalized.failures,
          archiveExpected: true
        }
      };
      Logger.log(JSON.stringify(result));
      return result;
    } finally {
      if (report && report.workbook && report.workbook.id && (!cleanup || cleanup.verified !== true)) {
        try {
          teardownDisposableWorkbook_(SpreadsheetApp.openById(report.workbook.id), runId, { trash: true });
        } catch (cleanupError) {
          Logger.log('P1 cleanup retry failed: ' + String(cleanupError && cleanupError.message || cleanupError));
        }
      }
    }
  });
}

function p1ReadRequiredReleaseMetadata_() {
  var props = PropertiesService.getScriptProperties();
  var sourceVersion = String(props.getProperty('RELEASE_TEST_SOURCE_VERSION') || '').trim();
  var deployment = String(props.getProperty('RELEASE_TEST_DEPLOYMENT') || '').trim();
  if (!sourceVersion || !deployment) {
    throw new Error('Set RELEASE_TEST_SOURCE_VERSION and RELEASE_TEST_DEPLOYMENT to the exact candidate before running P1 evidence.');
  }
  return { sourceVersion: sourceVersion, deployment: deployment };
}

function testRunP1PerformancePlanner() {
  return p1WithTemporaryTestFlags_(function() {
    var report = testRunSuiteById_('SUITE-PERFORMANCE-PLANNER', { dispositionMode: 'trash' });
    var result = p1CompactSuiteResult_(report);
    Logger.log(JSON.stringify(result));
    return result;
  });
}

function testRunP1BillsPayE2E() {
  return p1WithTemporaryTestFlags_(function() {
    var report = testRunSuiteById_('SUITE-BILLS-PAY-E2E', { dispositionMode: 'trash' });
    var result = p1CompactSuiteResult_(report);
    Logger.log(JSON.stringify(result));
    return result;
  });
}

function p1WithTemporaryTestFlags_(fn) {
  if (typeof isAdminUser_ !== 'function' || !isAdminUser_()) {
    throw new Error('P1 isolated validation is admin-only.');
  }
  if (typeof isCentralModeEnabled_ !== 'function' || !isCentralModeEnabled_()) {
    throw new Error('P1 isolated validation requires CENTRAL_MODE=true.');
  }
  var props = PropertiesService.getScriptProperties();
  var previousHarness = props.getProperty(TEST_HARNESS_ENABLED_KEY_);
  var previousValidator = props.getProperty(VALIDATOR_ENABLED_KEY_);
  try {
    props.setProperty(TEST_HARNESS_ENABLED_KEY_, 'true');
    props.setProperty(VALIDATOR_ENABLED_KEY_, 'true');
    assertHarnessAllowed_();
    assertValidatorAllowed_();
    return fn();
  } finally {
    p1RestoreProperty_(props, TEST_HARNESS_ENABLED_KEY_, previousHarness);
    p1RestoreProperty_(props, VALIDATOR_ENABLED_KEY_, previousValidator);
  }
}

function p1RestoreProperty_(props, key, previousValue) {
  if (previousValue === null) props.deleteProperty(key);
  else props.setProperty(key, previousValue);
}

function p1CompactSuiteResult_(report) {
  var rows = [];
  var results = report && report.results ? report.results : [];
  for (var i = 0; i < results.length; i++) {
    rows.push({
      id: results[i].id,
      overall: results[i].overall,
      functional: results[i].functional,
      workbookHealth: results[i].workbookHealth || null,
      disposition: results[i].disposition,
      durationMs: results[i].durationMs,
      error: results[i].error
    });
  }
  return {
    suiteId: report && report.suite ? report.suite.id : null,
    overall: report ? report.overall : 'FAIL',
    counts: report ? report.counts : null,
    durationMs: report ? report.durationMs : null,
    results: rows
  };
}
