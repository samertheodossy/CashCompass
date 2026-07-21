/**
 * Bounded Release Readiness orchestration. One scenario per invocation; compact,
 * privacy-safe state in Script Properties. Default-off through the existing
 * Validator + Harness guards. No workbook ID is ever passed to a writer.
 */
var RELEASE_READINESS_STATE_KEY_ = 'RELEASE_READINESS_ACTIVE_RUN_V1';
var RELEASE_READINESS_ARCHIVE_INDEX_KEY_ = 'RELEASE_READINESS_ARCHIVE_INDEX_V1';
var RELEASE_PERFORMANCE_BUDGET_RATIFIED_KEY_ = 'PERFORMANCE_BUDGETS_RATIFIED';
var RELEASE_REQUIRED_SUITES_ = [
  'SUITE-BILLS-REGRESSION',
  'SUITE-RECOVERY-REGRESSION',
  'SUITE-QUICK-ADD-RELIABILITY',
  'SUITE-POPULATED-FIXTURE',
  'SUITE-CENTRAL-SAFETY',
  'SUITE-FIRST-RUN-UX-E2E',
  'SUITE-POPULATED-DASHBOARD-E2E',
  'SUITE-RECOVERY-LIVE',
  'SUITE-PERFORMANCE-PLANNER',
  'SUITE-BILLS-PAY-E2E'
];

function releaseReadinessStart(candidateSpreadsheetId, metadata) {
  assertValidatorAllowed_();
  assertHarnessAllowed_();
  var id = String(candidateSpreadsheetId || '').trim();
  if (!id) throw new Error('Release Readiness requires the exact candidate workbook ID for read-only Workbook Health.');
  var prior = releaseLoadState_();
  if (prior && prior.status === 'IN_PROGRESS') {
    throw new Error('Release Readiness run ' + prior.runId + ' is still IN_PROGRESS. Finish it before starting another.');
  }
  var health = validateWorkbookHealth_(SpreadsheetApp.openById(id));
  var inventory = releaseBuildInventory_();
  metadata = metadata || {};
  var state = {
    version: 1, runId: 'RR-' + Utilities.getUuid(), startedAt: new Date().toISOString(),
    candidate: { workbookId: id,
      sourceVersion: releaseSanitizeMetadata_(metadata.sourceVersion),
      deployment: releaseSanitizeMetadata_(metadata.deployment) },
    openIssues: {
      severity1: Number(metadata.openSeverity1),
      severity2: Number(metadata.openSeverity2),
      declared: isFinite(Number(metadata.openSeverity1)) && isFinite(Number(metadata.openSeverity2))
    },
    health: releaseCompactHealth_(health), inventory: inventory, cursor: 0, results: [], status: 'IN_PROGRESS'
  };
  releaseSaveState_(state);
  return state;
}

function releaseReadinessRunNextChunk() {
  assertHarnessAllowed_();
  assertValidatorAllowed_();
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) throw new Error('Another Release Readiness chunk is already running.');
  try {
    var state = releaseLoadState_();
    if (!state || state.status !== 'IN_PROGRESS') throw new Error('No active Release Readiness run.');
    if (state.cursor >= state.inventory.scenarioIds.length) return releaseReadinessFinalize();
    var scenarioId = state.inventory.scenarioIds[state.cursor];
    var scenario = getHarnessScenarioById_(scenarioId);
    if (!scenario) throw new Error('Release inventory changed: missing scenario ' + scenarioId + '.');
    var report = runScenario_(scenario, harnessGenerateRunId_(), { trash: true });
    state.results.push(releaseCompactScenario_(report));
    state.cursor++;
    state.updatedAt = new Date().toISOString();
    releaseSaveState_(state);
    return { runId: state.runId, status: state.status, completed: state.cursor,
      total: state.inventory.scenarioIds.length, last: state.results[state.results.length - 1] };
  } finally {
    lock.releaseLock();
  }
}

function releaseReadinessGetStatus() {
  assertValidatorAllowed_();
  return releaseLoadState_();
}

function releaseReadinessFinalize() {
  assertValidatorAllowed_();
  var state = releaseLoadState_();
  if (!state) throw new Error('No active Release Readiness run.');
  var failures = [];
  if (state.health.overall === 'FAIL') failures.push('Workbook Health gating failure.');
  if (!state.candidate.sourceVersion || !state.candidate.deployment) failures.push('Exact source version and deployment identity were not recorded.');
  if (!state.openIssues || !state.openIssues.declared) failures.push('Severity 1/2 issue counts were not explicitly declared.');
  else if (state.openIssues.severity1 > 0 || state.openIssues.severity2 > 0) failures.push('Open Severity 1 or Severity 2 issues remain.');
  for (var i = 0; i < state.inventory.missingSuites.length; i++) failures.push('Required suite not implemented: ' + state.inventory.missingSuites[i]);
  if (state.cursor < state.inventory.scenarioIds.length) failures.push('Required scenarios remain NOT RUN.');
  for (var r = 0; r < state.results.length; r++) if (state.results[r].overall !== 'PASS') failures.push('Scenario failed: ' + state.results[r].scenarioId);
  if (PropertiesService.getScriptProperties().getProperty(RELEASE_PERFORMANCE_BUDGET_RATIFIED_KEY_) !== 'true') {
    failures.push('Performance p50/p95 budgets are not ratified.');
  }
  state.status = failures.length ? 'NOT_READY' : 'READY';
  state.finalizedAt = new Date().toISOString();
  state.failures = failures;
  releaseSaveState_(state);
  releaseArchiveState_(state);
  return state;
}

function releaseBuildInventory_() {
  var missing = [], ids = [], seen = {};
  for (var i = 0; i < RELEASE_REQUIRED_SUITES_.length; i++) {
    var suite = getHarnessSuiteById_(RELEASE_REQUIRED_SUITES_[i]);
    if (!suite || suite.implemented === false) { missing.push(RELEASE_REQUIRED_SUITES_[i]); continue; }
    for (var j = 0; j < suite.scenarioIds.length; j++) {
      var id = suite.scenarioIds[j];
      if (!seen[id]) { seen[id] = true; ids.push(id); }
    }
  }
  return { requiredSuites: RELEASE_REQUIRED_SUITES_.slice(), missingSuites: missing, scenarioIds: ids };
}

function releaseCompactHealth_(h) {
  return { capturedAt: h.capturedAt, overall: h.overall, schemaVersion: h.schemaVersion,
    workbookType: h.workbookType, compatibility: h.compatibility, gate: h.gate, advisory: h.advisory };
}

function releaseCompactScenario_(r) {
  return { scenarioId: r.scenario.id, runId: r.runId, overall: r.overall,
    startedAt: r.startedAt, finishedAt: r.finishedAt, durationMs: r.durationMs,
    sharing: r.gate.sharing, provisioning: r.gate.provisioning, functional: r.gate.functional,
    cleanup: r.gate.cleanup, error: releaseSanitizeError_(r.error) };
}

function releaseSanitizeError_(error) {
  if (!error) return null;
  return String(error)
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[REDACTED_EMAIL]')
    .replace(/https?:\/\/\S+/gi, '[REDACTED_URL]')
    .slice(0, 500);
}

function releaseSanitizeMetadata_(value) {
  return String(value || '').replace(/[\r\n\t]/g, ' ').trim().slice(0, 120);
}

function releaseSaveState_(state) {
  var json = JSON.stringify(state);
  if (json.length > 8500) throw new Error('Release Readiness compact state exceeded the Script Properties safety limit.');
  PropertiesService.getScriptProperties().setProperty(RELEASE_READINESS_STATE_KEY_, json);
}

function releaseLoadState_() {
  var raw = PropertiesService.getScriptProperties().getProperty(RELEASE_READINESS_STATE_KEY_);
  return raw ? JSON.parse(raw) : null;
}

function releaseArchiveState_(state) {
  var props = PropertiesService.getScriptProperties();
  var key = 'RELEASE_READINESS_RUN_' + String(state.runId).replace(/[^A-Za-z0-9_-]/g, '_');
  var json = JSON.stringify(state);
  if (json.length > 8500) throw new Error('Final Release Readiness evidence exceeded the Script Properties safety limit.');
  props.setProperty(key, json);
  var raw = props.getProperty(RELEASE_READINESS_ARCHIVE_INDEX_KEY_);
  var index = raw ? JSON.parse(raw) : [];
  index.unshift({ runId: state.runId, key: key, finalizedAt: state.finalizedAt, status: state.status });
  var evicted = index.slice(20);
  index = index.slice(0, 20);
  props.setProperty(RELEASE_READINESS_ARCHIVE_INDEX_KEY_, JSON.stringify(index));
  for (var i = 0; i < evicted.length; i++) if (evicted[i] && evicted[i].key) props.deleteProperty(evicted[i].key);
}
