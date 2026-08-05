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

`build_dashboard_charts` is retained as a comparison-compatible stage name after
`REG-054` passed isolated disposable runtime validation on Central `@308`. Current source performs
only exact-title retirement of the six former planner-owned `OUT - Dashboard`
charts in that stage; it no longer writes O:Z chart-support tables or builds
Dashboard charts. Unknown customer-added charts are preserved. After exact-source
additional stage-level evidence is captured, the stage may be renamed deliberately if that
improves the long-term reporting contract.

## Isolated Dashboard-chart retirement validation — 2026-08-05

Central version `308` was published only to isolated deployment `AKfycbz…UlWZQ`.
One real first/repeat pair ran on a marker-verified Restricted disposable workbook
and verified Trash cleanup. The planner retained `OUT - History` rows, produced
zero generated charts on both OUT sheets, and left the retired History Y:BB and
Dashboard O:Z support ranges blank. Provisioning and all seven functional
assertions passed with no execution error.

| Metric | Central `@308` |
| --- | ---: |
| First planner run | 38.614 s |
| Repeat planner run | 40.605 s |
| Functional assertions | 7 / 7 PASS |
| Restricted sharing / Trash cleanup | PASS / PASS |

The repeat is 3.341 seconds below the earlier `@116` repeat total of 43.946
seconds. This single standalone pair confirms correctness and provides a useful
directional measurement, but it does not ratify the 20-pair p50/p95 release
budget or isolate the former chart stage from ordinary Apps Script variance.

## Dashboard formatting batching — isolated runtime PASS

`REG-056` addresses the largest remaining profiled stage: `format_dashboard`
was 18.303 seconds on the `@116` repeat. The formatter now derives every section,
header, label, stability, and table-number-format target from the normalized row
matrix already held in memory. It performs no post-write cell reads and no
per-section full-sheet reads, groups repeated styles through `RangeList`, and
batches equal-width columns. The generated values, labels, row locations,
formats, widths, colors, and title treatment remain unchanged.

Focused dynamic coverage verifies the formatting plan and permanently rejects
restoring individual cell reads, full-sheet formatting reads, or the former
eight-pass `formatSectionTable_` path. Isolated Central `@310` then ran the exact
production planner seam twice on one marker-verified Restricted disposable
workbook. All 14 functional and formatting read-back assertions passed, sharing
remained Restricted, and Drive Trash cleanup was verified.

| Metric | First run | Immediate repeat |
| --- | ---: | ---: |
| Direct planner time | 12.364 s | 14.369 s |
| `format_dashboard` | 0.428 s | 0.378 s |
| Functional/format assertions | 14 / 14 PASS | 14 / 14 PASS |
| Restricted sharing / Trash cleanup | PASS | PASS |

Against the `@116` repeat `format_dashboard` stage of 18.303 seconds, the
`@310` repeat took 0.378 seconds: a 17.925-second (97.9%) reduction. The direct
planner totals exclude the separate web-dashboard snapshot refresh and are not
comparable to the older end-to-end `runPlannerAndRefreshDashboard` total. This
single pair closes `4a` correctness and stage timing, but it does not ratify the
20-pair p50/p95 release budget.

## Dashboard snapshot read/calculation pass — isolated runtime PASS

`REG-057` gives `buildDashboardSnapshot_` an exact-workbook seam and dedicated
privacy-safe stages. One History grid now serves snapshot deltas, planner
metrics, and health trends; prior-month Bank, Investment, and House readers use
batched grids; Upcoming and Retirement remain on the explicit target workbook.
Overview calculates only its selected retirement scenario. The Retirement
workspace still calculates all three scenarios when opened, so no comparison
capability is removed and non-visible scenarios do not compete with Overview.

Isolated `@315` identified Income as the only material Setup-readiness probe.
`@316` then reused one Cash Flow grid for header validation and classification
and removed the full-profile/DOB read from the Name + Email readiness check.
`@317` reused Planner's fresh canonical position in the same refresh call and
made legacy debt/property fallbacks lazy when their canonical domains are
available. No global or cross-request cache is used. All guarded samples passed
functional assertions, Restricted sharing, and verified Trash cleanup.

| Directional snapshot stage | `@315` | `@316` | `@317` |
| --- | ---: | ---: | ---: |
| Current position | 6.068 s | 5.508 s | 0.128 s |
| Retirement (selected scenario) | 0.434 s | 0.693 s | 0.462 s |
| Income readiness | 1.675 s | 1.078 s | 0.177 s |
| Total snapshot | 12.884 s | 13.026 s | 4.867 s |

The `@317` directional sample reduced current-position construction by 5.380 s
(97.7%) and total snapshot construction by 8.159 s (62.6%) versus `@316`.
This closes `4b` behavior and directional timing, but one sample does not ratify
the 20-pair p50/p95 release budget.

## Populated dashboard initial-load diagnostic

The primary repeatable workbook-scale diagnostic is **Validation & Testing →
Dashboard read profile**. Select the configured default or paste any explicit
workbook ID—including the bounded workbook—then click once. The admin-gated
server action reads the selected workbook twice and ranks fixed dashboard data
families by immediate-repeat time. It returns only durations, outcomes, and
aggregate sheet/row/column/cell counts; it never returns cell values or
workbook-derived sheet names and performs no write, repair, formatting, trigger,
cache, log, or property operation. Missing sheets appear as gaps rather than
being created. Because both passes run in one server execution, this safely
isolates workbook read/scale cost; it does not measure browser rendering or
network latency.

The browser trace below remains an optional deeper diagnostic when client RPC
or rendering behavior—not raw workbook reads—is suspected.

The normal dashboard accepts an explicit `?debug=1` query parameter for one
privacy-safe browser hydration trace. The flag is server-rendered before the
dashboard bundles execute, so it works inside the Apps Script iframe without a
Script Property change. Debug mode remains off for ordinary URLs.

The progressive Overview core read has one narrowly bounded recovery attempt
for the exact Apps Script `reading from storage` / `FAILED_PRECONDITION`
signature observed during an immediate repeat load. This recovery does not
apply to writers, ordinary business/precondition errors, full snapshot refreshes,
or post-render maintenance. A persistent failure stops after two total attempts;
the 45-second client trace continues to make that failure visible instead of
looping or masking it.

One page load measures the wall-clock time from startup routing through the
visible Overview core renderer. The core response contains the canonical Cash,
Investments, Real Estate, Debt, and Net Worth cards. After those cards paint,
the browser requests History deltas, health, attribution, runway, retirement,
income allocation, issues, and suggested actions in the background. Existing
Activity-sheet and planner-trigger maintenance runs only after that full
response is applied. A random, single-use continuation token lets that
background request reuse the core response's server-verified aggregate totals
without repeating its canonical input/mirror reads. The aggregate-only payload
is held in the caller's user cache for at most two minutes, is bound to the
resolved workbook, and is never logged or returned as account-level data; a
missing or invalid continuation falls back to the full canonical calculation.
Hidden workspaces do not compete with the critical path: they load only when the
user opens their page or tab. When all six Overview stages settle—or after the
45-second diagnostic timeout—the browser emits one console object prefixed
`[CashCompass load performance]` and sends the same allow-listed envelope to the
server log as `[PERF-CLIENT]`.

The server rebuilds the report rather than logging the caller payload. It
accepts only the fixed operation/stage names, a random diagnostic run ID,
durations, outcomes, and a server timestamp. Workbook IDs, user identity,
account/payee names, balances, sheet values, and error messages are discarded
and cannot enter the log envelope. The sanitized latest report is also retained
in the caller's Apps Script user cache for at most six hours. The cache is not a
workbook or persistent property, and retrieval is read-only and admin-gated.

For an explicitly approved read-only populated-workbook diagnostic:

1. Load the normal web-app URL once with `?debug=1` (or `&debug=1` when the URL
   already has a query string). Do not click a writer merely for timing.
2. Wait until the five top Overview cards and the visible Bills, Upcoming, and
   house-expense summaries settle, or until the 45-second diagnostic timeout.
   One aggregate six-stage trace is sent automatically. Hidden tab workspaces
   remain outside this Overview-load trace.
3. In a second tab on the **same deployment and Apps Script project**, open
   `?view=validation`, find **Latest Overview load trace**, and click **Load
   latest Overview trace**. Use **Copy** under **View raw JSON** to capture the
   exact privacy-safe report. The same-project requirement matters because the
   temporary report uses the caller's Apps Script user cache; a trace captured
   by the bounded deployment cannot be retrieved from the separate Central
   validation project, or vice versa. As fallbacks, use
   `clasp run getLatestDashboardClientPerformance`, a standard-Cloud-project
   `clasp logs` query for the latest `[PERF-CLIENT]` record/run ID, Apps Script
   **Executions**, or the browser console.
4. Compare the slowest successful stages and any `timeout`/`error` stages before
   choosing the next optimization.
5. On the same Validation page, optionally run **Dashboard read profile** for
   the explicitly selected workbook and copy its raw JSON. This separate,
   read-only two-pass report isolates workbook read/scale cost; it does not
   measure browser rendering or network latency.
6. Return to the ordinary URL without `debug=1`; no workbook cleanup or Script
   Property reset is needed because neither diagnostic writes workbook data or
   persistent configuration.

This read-only populated diagnostic is separate from the writer-inclusive
planner percentile campaign. Automated writers remain restricted to their own
marker-verified disposable workbooks.

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
path completed successfully. The temporary `buildHistoryCharts_` rollback code
was later removed after the product decision to keep generated backend sheets
chart-free; current local cleanup also clears recognized legacy Y:BB support
tables without touching canonical History columns A:U.

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
- The same focused suite verifies server-rendered debug gating, complete
  visible-startup coverage, deferred-tab instrumentation, one aggregate client
  report per load, strict server allow-list reconstruction, private-metadata
  exclusion, malformed-report rejection, and admin-gated per-user cache
  retrieval.
- `REGRESSION_SUITE_PLAN.md → PERF-PLANNER-STAGES` records the disposable runtime scenario.
- Runtime performance thresholds remain governed by `BETA_10_OUT_OF_10_PLAN.md` and Release Readiness.
