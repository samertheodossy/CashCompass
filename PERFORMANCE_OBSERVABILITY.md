# CashCompass Performance Observability

**Status:** Reusable timing helper and permanent percentile suite implemented. The 20-pair campaign is intentionally paused after six confirmed pairs; no percentile budget is ratified yet.

## Purpose

CashCompass keeps privacy-safe stage timing in the normal codebase so slow paths can be measured before they are optimized. Timing is operational evidence, not financial analytics.

The implementation lives in `performance_timing.js` and is:

- disabled by default;
- enabled only when the `PERFORMANCE_TIMING_ENABLED` Script Property equals the literal string `true`;
- fail-closed when the property is missing, malformed, or unavailable;
- inert when disabled, apart from one flag read when an instrumented operation starts;
- non-persistent: it writes no workbook cells, Activity rows, User Properties, Document Properties, or Script Properties;
- privacy-safe by contract: records contain only allow-listed operation/stage names, durations, outcome, schema version, and timestamp.

Never pass user identity, workbook IDs, sheet names derived from user data, account/payee names, balances, transaction content, email addresses, or exception messages into the timing helper.

## Timing envelope

One completed trace emits one structured server log line prefixed with `[PERF]`. An enabled dashboard RPC may also return the same envelope to the browser, where the manual planner refresh prints it as `[CashCompass performance]` in the developer console.

```json
{
  "schemaVersion": 1,
  "operation": "planner.manual_refresh",
  "outcome": "ok",
  "recordedAt": "2026-07-20T00:00:00.000Z",
  "totalMs": 143000,
  "measuredStageMs": 142900,
  "unattributedMs": 100,
  "slowestStage": "write_history",
  "slowestStageMs": 70000,
  "stages": [
    { "name": "sync_inputs", "durationMs": 1200 },
    { "name": "read_inputs", "durationMs": 900 }
  ]
}
```

The example values are illustrative, not measured results.

## Current planner coverage

The following operations are instrumented:

- `planner.manual_refresh` — top-bar **Refresh Financial Plan** end to end;
- `planner.save_refresh` — background planner and snapshot refresh after a save;
- `planner.run` — direct/menu/editor planner execution.

The current planner stages are:

1. `sync_inputs`
2. `read_inputs`
3. `build_payment_windows`
4. `calculate_plan`
5. `write_history`
6. `cleanup_history_charts`
7. `write_dashboard_data`
8. `format_dashboard`
9. `build_dashboard_charts`
10. `email`
11. `touch_source` *(dashboard wrapper only)*
12. `build_snapshot` *(dashboard wrapper only)*
13. `save_baseline` *(dashboard wrapper only)*

Stage names are stable report contracts. Rename or split them deliberately and update tests and this document in the same change.

## Isolated planner baseline — 2026-07-20

Central version `115` was published only to isolated deployment `AKfycbz…UlWZQ`.
The exact `runPlannerAndRefreshDashboard` server path was executed twice as
`cashcompass2026@gmail.com` against its restored Central-created disposable
workbook. The owner/bounded workbook was not touched. Both runs completed with
`outcome: ok`; the flag was restored to `false`, and the disposable workbook was
returned to Drive Trash after the measurements.

| Stage | First run | Immediate repeat |
| --- | ---: | ---: |
| `sync_inputs` | 7.553 s | 6.759 s |
| `read_inputs` | 1.231 s | 1.169 s |
| `build_payment_windows` | 2.935 s | 3.353 s |
| `calculate_plan` | 0.032 s | 0.029 s |
| `write_history` | 4.053 s | 1.282 s |
| `build_history_charts` | 7.728 s | 11.507 s |
| `write_dashboard_data` | 2.014 s | 0.308 s |
| `format_dashboard` | 26.323 s | 25.761 s |
| `build_dashboard_charts` | 11.736 s | 9.425 s |
| `email` | 0.734 s | 0.698 s |
| `touch_source` | 0.120 s | 0.097 s |
| `build_snapshot` | 16.935 s | 16.836 s |
| `save_baseline` | 0.060 s | 0.051 s |
| **Total server time** | **81.455 s** | **77.275 s** |

The baseline table preserves the original `build_history_charts` stage name
because those measurements preceded the History-chart retirement change.

The repeat run proves the latency is not merely cold-start cost. Dashboard
formatting, dashboard snapshot construction, and the two chart-rebuild stages
consume **63.529 s (82.2%)** of the 77.275-second repeat. Calculation itself is
only 29 ms. Optimization should therefore begin with `format_dashboard`, then
eliminate unnecessary chart teardown/recreation and duplicate snapshot reads.

### History-chart retirement — isolated runtime PASS

Central version `116` was published only to isolated deployment `AKfycbz…UlWZQ`.
The underlying History rows remained intact and appended during both runs, the
legacy chart area was visibly clear after cleanup, and the History-backed snapshot
path completed successfully. `buildHistoryCharts_` remains temporarily as
deprecated rollback-only code and is not called by the planner.

| Metric | `@115` baseline first | `@116` first | `@115` baseline repeat | `@116` repeat |
| --- | ---: | ---: | ---: | ---: |
| History chart work / cleanup | 7.728 s | 0.650 s | 11.507 s | 0.165 s |
| Total server time | 81.455 s | 42.378 s | 77.275 s | 43.946 s |

The repeat History stage improved by **11.342 s (98.6%)**. Total repeat server
time improved by **33.329 s (43.1%)**, but only the History-stage reduction is
directly attributable to this change because other Apps Script stages also varied
between runs. Both `@116` measurements were below the proposed 60-second p95
budget; more samples are required before treating that as a ratified percentile.
After validation, `PERFORMANCE_TIMING_ENABLED=false` was reconfirmed and the
disposable workbook was returned to Drive Trash.

The editor execution log validated the server `[PERF]` envelope and its privacy
contract. The browser-console echo was not separately validated because the
nested Apps Script dashboard frame did not remain controllable during this pass;
that does not affect the server-stage measurements above.

## Resumable percentile campaign — paused 2026-07-21

`SUITE-PERFORMANCE-PLANNER` is the permanent on-demand regression suite for
release-percentile evidence. It reuses the registered real
`PERFORMANCE-PLANNER-FIRST-REPEAT` scenario for 20 independent first/repeat
pairs, saves progress between invocations, and calculates nearest-rank p50/p95
for first, repeat, and combined samples. Candidate budgets remain p50 ≤ 30 s and
p95 ≤ 60 s; neither is ratified until all 20 pairs complete.

The isolated `@136` campaign was intentionally paused after six confirmed pairs.
Repeats were generally near 27 seconds, most first runs were slightly above 30
seconds, and one first-run outlier was about 136 seconds. This is insufficient to
publish percentiles or make an accept/optimize ProductDecision. Every confirmed
pair used the fixed disposable non-admin identity, verified Restricted sharing,
and verified Trash cleanup. Resume the saved campaign later from the Validation
& Testing console; do not restart it merely to obtain a cleaner distribution.

## Safe runtime procedure

1. Use an isolated deployment and a disposable Central-created workbook. Never use the owner/bounded workbook merely to collect timings.
2. Set `PERFORMANCE_TIMING_ENABLED=true` in the Central project's Script Properties. This is project-wide and affects every deployment backed by that Apps Script project, so use a short controlled window.
3. Run one first-time planner refresh, then one immediate repeat refresh.
4. Capture the browser-console `[CashCompass performance]` object and the Apps Script execution-log `[PERF]` record.
5. Verify the envelope contains no user/workbook/financial content.
6. Restore `PERFORMANCE_TIMING_ENABLED=false` or remove the property.
7. Compare the stage breakdown before selecting an optimization.

`clasp logs` requires an associated standard Google Cloud project. When it is unavailable, use the Apps Script editor's **Executions** view and the returned browser-console envelope.

## Reuse pattern

```javascript
var trace = startPerformanceTrace_('module.operation');

doFirstStage();
markPerformanceTrace_(trace, 'first_stage');

doSecondStage();
markPerformanceTrace_(trace, 'second_stage');

var report = finishPerformanceTrace_(trace, { outcome: 'ok' });
```

For a failure, call `finishPerformanceTrace_(trace, { outcome: 'error', failedStage: 'stable_stage_name' })` before rethrowing. Never include the error message in the timing record.

## Regression contract

- `npm run test:performance-timing` verifies default-OFF behavior, fail-closed property access, stable duration math, sanitization, one-log-per-trace behavior, idempotent completion, and error-envelope privacy.
- `REGRESSION_SUITE_PLAN.md → PERF-PLANNER-STAGES` records the disposable runtime scenario.
- Runtime performance thresholds remain governed by `BETA_10_OUT_OF_10_PLAN.md` and Release Readiness.
