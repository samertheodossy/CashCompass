/**
 * Bounded Release Readiness orchestration. One scenario per invocation; compact,
 * privacy-safe state in Script Properties. Default-off through the existing
 * Validator + Harness guards. Every workbook used by this workflow is disposable.
 */
var RELEASE_READINESS_STATE_KEY_ = 'RELEASE_READINESS_ACTIVE_RUN_V1';
var RELEASE_READINESS_ARCHIVE_INDEX_KEY_ = 'RELEASE_READINESS_ARCHIVE_INDEX_V1';
var RELEASE_PERFORMANCE_BUDGET_RATIFIED_KEY_ = 'PERFORMANCE_BUDGETS_RATIFIED';
var RELEASE_CANDIDATE_SOURCE_KEY_ = 'RELEASE_CANDIDATE_SOURCE_VERSION_V1';
var RELEASE_CANDIDATE_DEPLOYMENT_KEY_ = 'RELEASE_CANDIDATE_DEPLOYMENT_V1';
var RELEASE_OWNS_HARNESS_FLAG_KEY_ = 'RELEASE_READINESS_OWNS_HARNESS_FLAG_V1';
var RELEASE_REQUIRED_SUITES_ = [
  'SUITE-BILLS-REGRESSION',
  'SUITE-RECOVERY-REGRESSION',
  'SUITE-QUICK-ADD-RELIABILITY',
  'SUITE-POPULATED-FIXTURE',
  'SUITE-CENTRAL-SAFETY',
  'SUITE-HOUSE-FINANCIAL-ACCURACY',
  'SUITE-FIRST-RUN-UX-E2E',
  'SUITE-POPULATED-DASHBOARD-E2E',
  'SUITE-RECOVERY-LIVE',
  'SUITE-PERFORMANCE-PLANNER',
  'SUITE-BILLS-PAY-E2E'
];

function releaseReadinessStart(metadata) {
  assertValidatorAllowed_();
  assertHarnessAllowed_();
  var prior = releaseLoadState_();
  if (prior && prior.status === 'IN_PROGRESS') {
    throw new Error('Release Readiness run ' + prior.runId + ' is still IN_PROGRESS. Finish it before starting another.');
  }
  metadata = metadata || {};
  var sourceVersion = releaseSanitizeMetadata_(metadata.sourceVersion);
  var deployment = releaseSanitizeMetadata_(metadata.deployment);
  var rawSeverity1 = String(metadata.openSeverity1 == null ? '' : metadata.openSeverity1).trim();
  var rawSeverity2 = String(metadata.openSeverity2 == null ? '' : metadata.openSeverity2).trim();
  var severity1 = Number(metadata.openSeverity1);
  var severity2 = Number(metadata.openSeverity2);
  if (!sourceVersion || !deployment) {
    throw new Error('Release Readiness requires the exact source version and deployment identity.');
  }
  if (!rawSeverity1 || !rawSeverity2 || !isFinite(severity1) || !isFinite(severity2) || severity1 < 0 || severity2 < 0 ||
      Math.floor(severity1) !== severity1 || Math.floor(severity2) !== severity2) {
    throw new Error('Severity 1 and Severity 2 issue counts must be declared as whole numbers zero or greater.');
  }
  var inventory = releaseBuildInventory_();
  var healthScenario = getHarnessScenarioById_('SMOKE-POPULATED-FIXTURE');
  if (!healthScenario) throw new Error('Release Readiness disposable Workbook Health scenario is unavailable.');
  var healthReport = runScenario_(healthScenario, harnessGenerateRunId_(), { trash: true });
  if (!healthReport || !healthReport.workbook || !healthReport.workbook.id ||
      !healthReport.full || !healthReport.full.health) {
    throw new Error('Release Readiness could not produce disposable Workbook Health evidence.');
  }
  // The preflight fixture already proves the populated-fixture scenario, so do
  // not create a duplicate workbook when the remaining inventory is executed.
  inventory.scenarioIds = inventory.scenarioIds.filter(function(scenarioId) {
    return scenarioId !== healthScenario.id;
  });
  var candidate = { workbookFingerprint: releaseWorkbookFingerprint_(healthReport.workbook.id),
    sourceVersion: sourceVersion, deployment: deployment };
  releaseSaveCurrentCandidateMetadata_(candidate);
  var state = {
    version: 1, runId: 'RR-' + Utilities.getUuid(), startedAt: new Date().toISOString(),
    candidate: candidate,
    openIssues: {
      severity1: severity1,
      severity2: severity2,
      declared: true
    },
    health: releaseCompactHealth_(healthReport.full.health), inventory: inventory,
    externalEvidence: releaseLoadExternalEvidence_(inventory.externalSuites, candidate),
    cursor: 0, results: [releaseCompactScenario_(healthReport)], status: 'IN_PROGRESS'
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
  if (state.status !== 'IN_PROGRESS') return state;
  // Browser-backed suites may finish after this bounded run started. Refresh
  // their compact saved evidence at finalization so the console can resume a
  // run without requiring a restart, while still refusing missing/failed data.
  state.externalEvidence = releaseLoadExternalEvidence_(state.inventory.externalSuites, state.candidate);
  var failures = [];
  if (state.health.overall === 'FAIL') failures.push('Workbook Health gating failure.');
  if (!state.candidate.sourceVersion || !state.candidate.deployment) failures.push('Exact source version and deployment identity were not recorded.');
  if (!state.openIssues || !state.openIssues.declared) failures.push('Severity 1/2 issue counts were not explicitly declared.');
  else if (state.openIssues.severity1 > 0 || state.openIssues.severity2 > 0) failures.push('Open Severity 1 or Severity 2 issues remain.');
  for (var i = 0; i < state.inventory.missingSuites.length; i++) failures.push('Required suite not implemented: ' + state.inventory.missingSuites[i]);
  var externalSuites = state.inventory.externalSuites || [];
  var externalEvidence = state.externalEvidence || {};
  for (var e = 0; e < externalSuites.length; e++) {
    var suiteId = externalSuites[e];
    if (!externalEvidence[suiteId] || externalEvidence[suiteId].overall !== 'PASS' ||
        externalEvidence[suiteId].cleanupVerified !== true) {
      failures.push('Required browser evidence missing or not PASS: ' + suiteId);
    }
  }
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
  releaseRestoreHarnessFlagIfOwned_();
  return state;
}

function releaseBuildInventory_() {
  var missing = [], ids = [], seen = {}, external = [];
  for (var i = 0; i < RELEASE_REQUIRED_SUITES_.length; i++) {
    var suite = getHarnessSuiteById_(RELEASE_REQUIRED_SUITES_[i]);
    if (!suite || suite.implemented === false) { missing.push(RELEASE_REQUIRED_SUITES_[i]); continue; }
    if (suite.runner === 'browser') { external.push(suite.id); continue; }
    for (var j = 0; j < suite.scenarioIds.length; j++) {
      var id = suite.scenarioIds[j];
      if (!seen[id]) { seen[id] = true; ids.push(id); }
    }
  }
  return { requiredSuites: RELEASE_REQUIRED_SUITES_.slice(), missingSuites: missing,
    externalSuites: external, scenarioIds: ids };
}

/** Snapshot compact browser evidence when a bounded release run begins. */
function releaseLoadExternalEvidence_(suiteIds, candidate) {
  var out = {};
  var ids = suiteIds || [];
  var props = PropertiesService.getScriptProperties();
  for (var i = 0; i < ids.length; i++) {
    var suite = getHarnessSuiteById_(ids[i]);
    if (!suite || !suite.evidenceKey) continue;
    try {
      var raw = props.getProperty(suite.evidenceKey);
      var report = raw ? JSON.parse(raw) : null;
      if (!report || report.suiteId !== suite.id ||
          !releaseEvidenceMatchesCandidate_(report.candidate, candidate)) continue;
      out[suite.id] = {
        overall: report.overall,
        runId: releaseSanitizeMetadata_(report.runId),
        finishedAt: report.finishedAt,
        durationMs: Number(report.durationMs) || 0,
        cleanupVerified: !!(report.cleanup && report.cleanup.verified)
      };
    } catch (_e) {}
  }
  return out;
}

function releaseEvidenceMatchesCandidate_(evidenceCandidate, expectedCandidate) {
  return !!(evidenceCandidate && expectedCandidate &&
    evidenceCandidate.sourceVersion === expectedCandidate.sourceVersion &&
    evidenceCandidate.deployment === expectedCandidate.deployment);
}

function releaseSaveCurrentCandidateMetadata_(candidate) {
  var props = PropertiesService.getScriptProperties();
  props.setProperty(RELEASE_CANDIDATE_SOURCE_KEY_, releaseSanitizeMetadata_(candidate.sourceVersion));
  props.setProperty(RELEASE_CANDIDATE_DEPLOYMENT_KEY_, releaseSanitizeMetadata_(candidate.deployment));
}

/** Candidate metadata attached to browser evidence; contains no workbook id. */
function releaseCurrentCandidateMetadata_() {
  var props = PropertiesService.getScriptProperties();
  return {
    sourceVersion: releaseSanitizeMetadata_(props.getProperty(RELEASE_CANDIDATE_SOURCE_KEY_)),
    deployment: releaseSanitizeMetadata_(props.getProperty(RELEASE_CANDIDATE_DEPLOYMENT_KEY_))
  };
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

/** Privacy-safe stable identifier for the exact read-only candidate workbook. */
function releaseWorkbookFingerprint_(spreadsheetId) {
  var digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(spreadsheetId || ''),
    Utilities.Charset.UTF_8
  );
  var hex = digest.map(function(value) {
    var normalized = value < 0 ? value + 256 : value;
    return ('0' + normalized.toString(16)).slice(-2);
  }).join('');
  return hex.slice(0, 16);
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

/** Compact archive index for the admin console; no workbook ids or cell data. */
function releaseReadinessListArchives() {
  assertValidatorAllowed_();
  var raw = PropertiesService.getScriptProperties().getProperty(RELEASE_READINESS_ARCHIVE_INDEX_KEY_);
  var index = raw ? JSON.parse(raw) : [];
  return index.slice(0, 20).map(function(item) {
    return { runId: item.runId, finalizedAt: item.finalizedAt, status: item.status };
  });
}

/** Restore the Harness default-OFF boundary after a console-owned run closes. */
function releaseRestoreHarnessFlagIfOwned_() {
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty(RELEASE_OWNS_HARNESS_FLAG_KEY_) !== 'true') return;
  props.deleteProperty(TEST_HARNESS_ENABLED_KEY_);
  props.deleteProperty(RELEASE_OWNS_HARNESS_FLAG_KEY_);
}
