/**
 * CashCompass performance timing — privacy-safe, flag-gated observability.
 *
 * Set the PERFORMANCE_TIMING_ENABLED Script Property to the literal string
 * "true" to enable. Any other value, an unavailable PropertiesService, or an
 * unexpected error fails closed: callers receive null and no timing record is
 * emitted.
 *
 * Timing records contain operational metadata only: operation/stage names,
 * durations, outcome, and timestamp. Never pass user identity, workbook IDs,
 * sheet values, account names, balances, or error messages as names/metadata.
 */

var PERFORMANCE_TIMING_ENABLED_KEY_ = 'PERFORMANCE_TIMING_ENABLED';
var PERFORMANCE_TIMING_SCHEMA_VERSION_ = 1;
var DASHBOARD_CLIENT_PERFORMANCE_OPERATION_ = 'dashboard.initial_load';
var DASHBOARD_CLIENT_PERFORMANCE_CACHE_KEY_ = 'DASHBOARD_CLIENT_PERFORMANCE_LATEST_V1';
var DASHBOARD_CLIENT_PERFORMANCE_CACHE_SECONDS_ = 21600;
var DASHBOARD_CLIENT_PERFORMANCE_STAGES_ = [
  'startup_routing', 'snapshot', 'overview_details', 'overview_bills',
  'overview_upcoming', 'overview_house_expenses',
  'houses', 'house_expenses', 'house_expense_recent',
  'house_expense_summary', 'bank_accounts', 'investments',
  'debts', 'quick_add', 'upcoming', 'retirement', 'purchase_simulator',
  'bills_due', 'recurring_bills', 'manage_bills', 'income_sources'
];
var DASHBOARD_CLIENT_INITIAL_PERFORMANCE_STAGES_ = [
  'startup_routing', 'snapshot', 'overview_details', 'overview_bills',
  'overview_upcoming', 'overview_house_expenses'
];

function isPerformanceTimingEnabled_() {
  try {
    return PropertiesService.getScriptProperties()
      .getProperty(PERFORMANCE_TIMING_ENABLED_KEY_) === 'true';
  } catch (_e) {
    return false;
  }
}

function sanitizePerformanceTimingName_(value, fallback) {
  var candidate = String(value || '');
  return /^[A-Za-z][A-Za-z0-9_.:-]{0,79}$/.test(candidate)
    ? candidate
    : fallback;
}

function startPerformanceTrace_(operationName) {
  if (!isPerformanceTimingEnabled_()) return null;

  return createPerformanceTrace_(operationName);
}

/** Internal constructor used by guarded disposable performance scenarios. */
function createPerformanceTrace_(operationName) {

  var now = Date.now();
  return {
    operation: sanitizePerformanceTimingName_(operationName, 'operation'),
    startedAtMs: now,
    lastMarkMs: now,
    stages: [],
    finished: false,
    report: null
  };
}

function markPerformanceTrace_(trace, stageName) {
  if (!trace || trace.finished) return trace;

  var now = Date.now();
  trace.stages.push({
    name: sanitizePerformanceTimingName_(stageName, 'stage'),
    durationMs: Math.max(0, now - trace.lastMarkMs)
  });
  trace.lastMarkMs = now;
  return trace;
}

function finishPerformanceTrace_(trace, options) {
  if (!trace) return null;
  if (trace.finished) return trace.report;

  options = options || {};
  var finishedAtMs = Date.now();
  var totalMs = Math.max(0, finishedAtMs - trace.startedAtMs);
  var stageTotalMs = trace.stages.reduce(function(sum, stage) {
    return sum + Number(stage.durationMs || 0);
  }, 0);
  var slowest = trace.stages.reduce(function(current, stage) {
    if (!current || stage.durationMs > current.durationMs) return stage;
    return current;
  }, null);

  var report = {
    schemaVersion: PERFORMANCE_TIMING_SCHEMA_VERSION_,
    operation: trace.operation,
    outcome: options.outcome === 'error' ? 'error' : 'ok',
    recordedAt: new Date(finishedAtMs).toISOString(),
    totalMs: totalMs,
    measuredStageMs: stageTotalMs,
    unattributedMs: Math.max(0, totalMs - stageTotalMs),
    slowestStage: slowest ? slowest.name : null,
    slowestStageMs: slowest ? slowest.durationMs : 0,
    stages: trace.stages.slice()
  };

  if (report.outcome === 'error') {
    report.failedStage = sanitizePerformanceTimingName_(options.failedStage, 'unknown');
  }

  trace.finished = true;
  trace.report = report;

  // One structured record per traced operation. Do not log error text or any
  // caller-provided metadata: those can contain private financial/user data.
  try {
    console.log('[PERF] ' + JSON.stringify(report));
  } catch (_consoleErr) {
    try { Logger.log('[PERF] ' + JSON.stringify(report)); } catch (_loggerErr) {}
  }

  return report;
}

/**
 * Accept one debug-only browser hydration trace and emit it to Apps Script
 * execution logs. Validation rebuilds the envelope from a fixed allow-list;
 * arbitrary metadata, workbook values, and error text are never logged.
 */
function recordDashboardClientPerformance(input) {
  var source = input && typeof input === 'object' ? input : {};
  var runId = String(source.runId || '');
  if (source.schemaVersion !== 1 ||
      source.operation !== DASHBOARD_CLIENT_PERFORMANCE_OPERATION_ ||
      !/^load-[a-z0-9]+-[a-z0-9]{1,16}$/i.test(runId)) {
    return { ok: false };
  }

  var allowed = {};
  DASHBOARD_CLIENT_INITIAL_PERFORMANCE_STAGES_.forEach(function(name) { allowed[name] = true; });
  var seen = {};
  var stages = Array.isArray(source.stages) ? source.stages : [];
  if (stages.length !== DASHBOARD_CLIENT_INITIAL_PERFORMANCE_STAGES_.length) {
    return { ok: false };
  }
  var sanitizedStages = [];
  for (var i = 0; i < stages.length; i += 1) {
    var raw = stages[i] && typeof stages[i] === 'object' ? stages[i] : {};
    var name = String(raw.name || '');
    var durationMs = raw.durationMs;
    var outcome = String(raw.outcome || '');
    if (!allowed[name] || seen[name] || typeof durationMs !== 'number' || !isFinite(durationMs) ||
        durationMs < 0 || durationMs > 120000 ||
        ['ok', 'error', 'timeout'].indexOf(outcome) < 0) {
      return { ok: false };
    }
    seen[name] = true;
    sanitizedStages.push({
      name: name,
      durationMs: Math.round(durationMs),
      outcome: outcome
    });
  }

  var totalMs = source.totalMs;
  if (typeof totalMs !== 'number' || !isFinite(totalMs) || totalMs < 0 || totalMs > 120000) {
    return { ok: false };
  }
  var overallOutcome = sanitizedStages.some(function(stage) {
    return stage.outcome === 'timeout';
  }) ? 'timeout' : (sanitizedStages.some(function(stage) {
    return stage.outcome === 'error';
  }) ? 'error' : 'ok');

  var report = {
    schemaVersion: 1,
    operation: DASHBOARD_CLIENT_PERFORMANCE_OPERATION_,
    runId: runId,
    outcome: overallOutcome,
    recordedAt: new Date().toISOString(),
    totalMs: Math.round(totalMs),
    stages: sanitizedStages
  };
  try {
    console.log('[PERF-CLIENT] ' + JSON.stringify(report));
  } catch (_consoleErr) {
    try { Logger.log('[PERF-CLIENT] ' + JSON.stringify(report)); } catch (_loggerErr) {}
  }
  // Temporary, per-user retrieval seam for Apps Script projects that are not
  // connected to a standard GCP project (where `clasp logs` is unavailable).
  // Cache expiry is six hours; no workbook or persistent property is written.
  try {
    CacheService.getUserCache().put(
      DASHBOARD_CLIENT_PERFORMANCE_CACHE_KEY_,
      JSON.stringify(report),
      DASHBOARD_CLIENT_PERFORMANCE_CACHE_SECONDS_
    );
  } catch (_cacheErr) {}
  return { ok: true, runId: runId };
}

/** Admin-gated, read-only retrieval of the caller's latest temporary trace. */
function getLatestDashboardClientPerformance() {
  if (!isAdminUser_()) {
    return { ok: false, error: 'Administrator access is required.' };
  }
  try {
    var raw = CacheService.getUserCache().get(DASHBOARD_CLIENT_PERFORMANCE_CACHE_KEY_);
    if (!raw) return { ok: false, error: 'No recent dashboard load trace is available.' };
    return { ok: true, report: JSON.parse(raw) };
  } catch (_e) {
    return { ok: false, error: 'The recent dashboard load trace is unavailable.' };
  }
}
