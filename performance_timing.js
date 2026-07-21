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
