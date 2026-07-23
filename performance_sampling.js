/**
 * Guarded Performance Planner sampling campaign.
 *
 * Runs the registered PERFORMANCE-PLANNER-FIRST-REPEAT scenario unchanged on
 * independent disposable workbooks owned by the permanent non-admin test
 * account. Each invocation performs one pair so Apps Script executions stay
 * bounded. The browser resumes until 20 independent pairs are complete.
 */
var PERFORMANCE_SAMPLING_STATE_KEY_ = 'PERFORMANCE_SAMPLING_ACTIVE_V1';
var PERFORMANCE_SAMPLING_EVIDENCE_KEY_ = 'PERFORMANCE_PLANNER_LATEST_EVIDENCE_V1';
var PERFORMANCE_SAMPLING_TARGET_PAIRS_ = 20;
var PERFORMANCE_REFRESH_P50_BUDGET_MS_ = 30000;
var PERFORMANCE_REFRESH_P95_BUDGET_MS_ = 60000;

function psSafe_(fn) {
  try { return fn(); }
  catch (e) { return { ok: false, error: (e && e.message) ? e.message : String(e) }; }
}
function isPerformanceSamplingUser_() {
  return typeof isFirstRunE2EUser_ === 'function' && isFirstRunE2EUser_();
}

function assertPerformanceSamplingAllowed_() {
  if (!isPerformanceSamplingUser_()) {
    throw new Error('Performance sampling is disabled or this is not the disposable test account.');
  }
  return FIRST_RUN_E2E_TEST_EMAIL_;
}

function psReadState_() {
  var raw = PropertiesService.getUserProperties().getProperty(PERFORMANCE_SAMPLING_STATE_KEY_);
  return raw ? JSON.parse(raw) : null;
}

function psWriteState_(state) {
  PropertiesService.getUserProperties().setProperty(PERFORMANCE_SAMPLING_STATE_KEY_, JSON.stringify(state));
}

function psLatestEvidence_() {
  try {
    var raw = PropertiesService.getScriptProperties().getProperty(PERFORMANCE_SAMPLING_EVIDENCE_KEY_);
    return raw ? JSON.parse(raw) : null;
  } catch (_e) {
    return null;
  }
}

function psPublicState_() {
  var state = psReadState_();
  return {
    active: state ? {
      campaignId: state.campaignId,
      status: state.status,
      startedAt: state.startedAt,
      completedPairs: state.samples.length,
      targetPairs: PERFORMANCE_SAMPLING_TARGET_PAIRS_,
      lastSample: state.samples.length ? state.samples[state.samples.length - 1] : null
    } : null,
    latestEvidence: psLatestEvidence_(),
    budget: {
      flow: 'Financial Plan refresh',
      p50Ms: PERFORMANCE_REFRESH_P50_BUDGET_MS_,
      p95Ms: PERFORMANCE_REFRESH_P95_BUDGET_MS_,
      method: '20 independent first/repeat pairs; nearest-rank percentile; first, repeat, and combined populations must pass'
    }
  };
}

function psGetState() {
  return psSafe_(function() {
    assertPerformanceSamplingAllowed_();
    return { ok: true, state: psPublicState_() };
  });
}

function psStartCampaign(confirmed) {
  return psSafe_(function() {
    assertPerformanceSamplingAllowed_();
    if (confirmed !== true) throw new Error('Disposable-account confirmation is required.');
    var prior = psReadState_();
    if (prior && prior.status === 'IN_PROGRESS') {
      return { ok: true, state: psPublicState_(), resumed: true };
    }
    var props = PropertiesService.getScriptProperties();
    props.deleteProperty(PERFORMANCE_SAMPLING_EVIDENCE_KEY_);
    props.setProperty(RELEASE_PERFORMANCE_BUDGET_RATIFIED_KEY_, 'false');
    var state = {
      version: 1,
      campaignId: 'PERF-' + Utilities.getUuid(),
      status: 'IN_PROGRESS',
      startedAt: new Date().toISOString(),
      samples: [],
      releaseEvidenceContext: releaseBrowserEvidenceContext_()
    };
    psWriteState_(state);
    return { ok: true, state: psPublicState_(), resumed: false };
  });
}

function psPercentileNearestRank_(values, percentile) {
  if (!values || !values.length) return null;
  var sorted = values.slice().sort(function(a, b) { return a - b; });
  var rank = Math.ceil(percentile * sorted.length);
  return sorted[Math.max(0, Math.min(sorted.length - 1, rank - 1))];
}

function psMedian_(values) {
  if (!values || !values.length) return null;
  var sorted = values.slice().sort(function(a, b) { return a - b; });
  var middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

function psDistribution_(values) {
  return {
    count: values.length,
    minMs: Math.min.apply(null, values),
    p50Ms: psMedian_(values),
    p95Ms: psPercentileNearestRank_(values, 0.95),
    maxMs: Math.max.apply(null, values)
  };
}

function psDistributionPasses_(distribution) {
  return distribution && distribution.p50Ms <= PERFORMANCE_REFRESH_P50_BUDGET_MS_ &&
    distribution.p95Ms <= PERFORMANCE_REFRESH_P95_BUDGET_MS_;
}

function psFinalize_(state) {
  var successful = state.samples.filter(function(sample) { return sample.overall === 'PASS'; });
  var first = successful.map(function(sample) { return sample.firstMs; });
  var repeat = successful.map(function(sample) { return sample.repeatMs; });
  var combined = first.concat(repeat);
  var allRunsPassed = successful.length === PERFORMANCE_SAMPLING_TARGET_PAIRS_ &&
    state.samples.length === PERFORMANCE_SAMPLING_TARGET_PAIRS_;
  var firstStats = first.length ? psDistribution_(first) : null;
  var repeatStats = repeat.length ? psDistribution_(repeat) : null;
  var combinedStats = combined.length ? psDistribution_(combined) : null;
  var budgetPass = allRunsPassed && psDistributionPasses_(firstStats) &&
    psDistributionPasses_(repeatStats) && psDistributionPasses_(combinedStats);
  var evidenceContext = releaseValidateBrowserEvidenceContext_(state.releaseEvidenceContext);
  var report = {
    version: 1,
    type: 'performanceSampling',
    suiteId: 'SUITE-PERFORMANCE-PLANNER',
    scenarioId: 'PERFORMANCE-PLANNER-FIRST-REPEAT',
    runId: state.campaignId,
    candidate: evidenceContext.candidate,
    releaseEligible: evidenceContext.releaseEligible,
    releaseRunId: evidenceContext.releaseRunId,
    evidenceNote: evidenceContext.reason,
    startedAt: state.startedAt,
    finishedAt: new Date().toISOString(),
    overall: budgetPass ? 'PASS' : 'FAIL',
    decision: budgetPass ? 'ACCEPT' : 'OPTIMIZE',
    budgetRatified: evidenceContext.releaseEligible,
    budget: {
      p50Ms: PERFORMANCE_REFRESH_P50_BUDGET_MS_,
      p95Ms: PERFORMANCE_REFRESH_P95_BUDGET_MS_,
      percentileMethod: 'nearest-rank',
      populationRule: 'first, repeat, and combined must each pass'
    },
    samplePairs: state.samples.length,
    plannerExecutions: state.samples.length * 2,
    distributions: { first: firstStats, repeat: repeatStats, combined: combinedStats },
    samples: state.samples,
    cleanup: {
      requested: true,
      verified: state.samples.every(function(sample) { return sample.cleanupVerified === true; }),
      count: state.samples.length
    },
    sharing: {
      restricted: state.samples.every(function(sample) { return sample.restricted === true; }),
      count: state.samples.length
    }
  };
  state.status = 'COMPLETE';
  state.finishedAt = report.finishedAt;
  psWriteState_(state);
  var props = PropertiesService.getScriptProperties();
  props.setProperty(PERFORMANCE_SAMPLING_EVIDENCE_KEY_, JSON.stringify(report));
  props.setProperty(RELEASE_PERFORMANCE_BUDGET_RATIFIED_KEY_,
    evidenceContext.releaseEligible ? 'true' : 'false');
  return report;
}

/** Run exactly one registered scenario pair and persist compact evidence. */
function psRunNextSample(confirmed) {
  return psSafe_(function() {
    assertPerformanceSamplingAllowed_();
    if (confirmed !== true) throw new Error('Disposable-account confirmation is required.');
    var lock = LockService.getUserLock();
    if (!lock.tryLock(1000)) throw new Error('A performance sample is already running.');
    try {
      var state = psReadState_();
      if (!state || state.status !== 'IN_PROGRESS') throw new Error('No active performance sampling campaign.');
      if (state.samples.length >= PERFORMANCE_SAMPLING_TARGET_PAIRS_) {
        return { ok: true, report: psFinalize_(state), state: psPublicState_() };
      }
      var report = runScenario_(
        getHarnessPerformancePlannerScenario_(),
        harnessGenerateRunId_(),
        { trash: true }
      );
      var timing = report.performance || {};
      var sample = {
        index: state.samples.length + 1,
        runId: report.runId,
        finishedAt: report.finishedAt,
        overall: report.overall,
        firstMs: Number(timing.firstMs) || null,
        repeatMs: Number(timing.repeatMs) || null,
        restricted: !!(report.sharing && report.sharing.restricted),
        cleanupVerified: !!(report.cleanup && report.cleanup.verified),
        error: report.error ? String(report.error).slice(0, 300) : null
      };
      if (!sample.firstMs || !sample.repeatMs) sample.overall = 'FAIL';
      state.samples.push(sample);
      psWriteState_(state);
      if (state.samples.length >= PERFORMANCE_SAMPLING_TARGET_PAIRS_) {
        return { ok: true, report: psFinalize_(state), state: psPublicState_() };
      }
      return { ok: true, sample: sample, state: psPublicState_() };
    } finally {
      lock.releaseLock();
    }
  });
}
