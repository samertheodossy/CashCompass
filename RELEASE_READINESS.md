# Release Readiness — Report & Workflow

*The pre-release go/no-go produced by the Test Harness running every scenario pack
and the Validator judging each result.*

**Status:** **Release Readiness orchestration and console controls are implemented,
committed at `a4f6ddf`, and runtime-proven on isolated Central `@141`; the saved
run remains `IN_PROGRESS` because Performance is intentionally parked.** The
single Validation console creates a disposable Workbook Health preflight, runs one
bounded server scenario per invocation, saves resumable progress, accepts browser
evidence only for the exact source/deployment candidate, archives privacy-safe
verdicts, and restores a console-owned Harness flag to OFF when finalized.
The `REG-015` correction now makes ownership explicit: generic/direct
browser runs are diagnostic-only, while only a dedicated action in the active
Release Readiness browser-evidence table supplies and server-validates the exact
owning run id. Isolated `@178` runtime evidence proves the standalone fail-closed
path even while the older `@141` run remains parked: the final full Populated
Dashboard run passed 12/12 with `releaseEligible: false`, no candidate or release
run id, zero captured errors, and verified Trash cleanup. Candidate-bound runtime
proof of the dedicated exact-owner action remains pending.

Financial Integrity is now included in the required server-suite inventory through
`SUITE-FINANCIAL-INTEGRITY-CANONICAL`. Runs `20260722-151535-b8f9` (`@151`),
`20260722-154257-86fc` (`@152`), and `20260722-155409-43d5` (`@153`) passed the
45 existing financial assertions but failed the eight new History checks. Because
the production-writer change on `@153` did not alter the result, that change was
reverted. Reopen-after-write (`@154`) and pre-create-then-reopen (`@155`, suite
`20260722-162550-8fa6`, scenario `20260722-162550-bf3c`) also retained 45/53,
proving a persistent same-execution Spreadsheet-level cache in the disposable
fixture rather than a production calculation defect. The local correction reads
the row through the exact `Sheet` returned by the established writer and supplies
that already-read snapshot only through an explicit read-only audit option. Normal
no-argument Central/bounded behavior is unchanged. Local syntax, full regression,
production-path, harness-safety, and diff checks pass. Isolated Validation `@156`
suite `20260722-164849-6081` / scenario `20260722-164849-bc33` passed 53/53 in
154.569 s with CURRENT/FULLY_CURRENT schema, Provisioning and Drift PASS,
Restricted owner-only sharing, and verified Trash cleanup. Financial Integrity
Release Readiness wiring is therefore runtime-proven. Beta remains `@106`; the
bounded deployment and workbook were untouched. The historical
`@141` result below predates this gate.

The exact `@141` run passed aggregate Workbook Health and all 13/13 server checks.
First-Run UX E2E (`FR-0c415ac6-cfea-4525-8bf2-766086ce83e9`), Populated Dashboard
E2E (`FR-263dfd04-4166-454b-8f95-2db2f26613d9`), and Recovery Live
(`RL-099c9c9c-c090-46d7-9d4b-84d7b8af14df`) also passed against the exact
candidate. All writer fixtures were Restricted and verified in Trash. Recovery
Live passed 9/9 in 44.060 s, matched zero protected targets, and preserved the
sole-admin configuration and mapping fingerprints. No bounded workbook was used.

The current run must not be finalized as READY yet. The permanent Performance
Planner percentile suite has seven historical diagnostic pairs, but that campaign
began before `@141` and cannot qualify as exact-candidate evidence. Performance is
deferred—not waived—while House Financial Accuracy proceeds. Before broad Beta,
run a complete candidate-bound campaign, ratify p50/p95 budgets, finalize this
bounded gate, and run the full 10/10 scorecard. Until then, the automated release
state is **IN_PROGRESS** and the product-level broad-Beta decision remains **NOT
READY**. See `P1_RELEASE_EVIDENCE_CONTRACT.md`.

**Related docs:** `TEST_HARNESS_ARCHITECTURE.md` (the runner),
`VALIDATOR_ARCHITECTURE.md` (the read-only judge), `REGRESSION_SCENARIOS.md` (the
regression pack), `ROADMAP.md` (P1 sequencing), and
`TEST_PRODUCTION_PATH_AUDIT.md` (the real-code-first test inventory), and
`BETA_10_OUT_OF_10_PLAN.md` (the full product-quality and monetization-readiness
gate).

---

## 1. What it is

A single aggregated verdict across the dimensions the Harness + Validator can
assert. Each **line** = the worst severity across the scenarios that exercise that
dimension. The **Overall** gate summarizes them into a release decision.

Lines are grouped by **class** (see `VALIDATOR_ARCHITECTURE.md → §10.0a`):
**gating** lines can block the release; **advisory** (Workbook Drift) lines report
divergence from the canonical standard but **never** force NOT READY.

```
CashCompass — Release Readiness
Run: <runId>   Packs: SMOKE, REGRESSION, RECOVERY, STRESS   Scenarios: <n passed>/<n>

── Gating ─────────────────────────────
Provisioning            PASS      (sheets, headers, frozen, hidden, SYS - Meta markers)
Schema                  PASS
Named Ranges            PASS
Regression              PASS
Financial Integrity     PASS      (canonical position, History freshness, property financing)
Recovery                PASS
Performance             PASS
── Advisory (Workbook Drift) ──────────
Workbook Drift          PASS      (widths, row heights, styling, product-decision colors)
Formula                 PASS
Conditional Formatting  PASS
──────────────────────────────────────
Overall                 READY FOR BETA
```

---

## 2. Where each line comes from

| Report line | Class | Source | Asserted by |
|---|---|---|---|
| Provisioning | **Gating** | `validateProvisioning_` (sheets, headers, frozen, hidden, `SYS - Meta` markers) | every scenario's post-check |
| Schema | **Gating** | Validator Module 2 (headers/schema) | every scenario's post-check |
| Named Ranges | **Gating** | Validator Module 5 (thin check today) | all |
| Workbook Drift | **Advisory** | `validateDrift_` (canonical widths, row heights, styling, product-decision colors) | scenarios on freshly provisioned workbooks |
| Formula | **Advisory** | Validator Module 3 (Drift-class) | scenarios that write formulas |
| Conditional Formatting | **Advisory** | Validator Module 4 (Drift-class) | Cash Flow / colored-row scenarios |
| Regression | **Gating** | `REGRESSION` pack | one scenario per historical bug |
| Financial Integrity | **Gating** | `SUITE-FINANCIAL-INTEGRITY-CANONICAL` | canonical current position, History freshness, and fail-closed financing |
| Recovery | **Gating** | `RECOVERY` pack | damage → detect → heal → PASS |
| Performance | **Gating** | `STRESS` pack timings | scenarios that record runtime |

**Gating** lines can trip the Overall gate to NOT READY. **Advisory (Workbook
Drift)** lines report divergence from the evolving canonical standard and are
informational — a drift WARN never blocks a release (drift is expected on lived-in
workbooks; see `VALIDATOR_ARCHITECTURE.md → §10.0a`).

---

## 3. Severity → line status

- **PASS** — no scenario in that dimension produced a WARN or ERROR.
- **WARN** — at least one WARN, no ERROR (allowed into beta only with explicit
  sign-off, recorded in the report).
- **FAIL** — at least one ERROR (or, for Performance, a timing over the agreed
  threshold).

### Overall gate

| Overall | Condition |
|---|---|
| **READY FOR BETA** | no **gating** line is FAIL; any gating WARN lines are signed off |
| **NOT READY** | any **gating** line is FAIL |

**Advisory (Workbook Drift) lines never change the Overall verdict** — they surface
divergence for awareness only. A workbook can be READY FOR BETA with drift WARNs
outstanding.

The report lists **every failed scenario** with its Validator findings so the
failures are actionable, not just a red light.

### Automated READY is necessary, not sufficient

This report answers whether the automated Harness + Validator evidence is ready.
It does **not**, by itself, authorize a broad beta. The exact release candidate must
also pass the human/product gates in `BETA_10_OUT_OF_10_PLAN.md`:

- weighted readiness score at least 95/100, with no dimension below 9/10;
- no unresolved Severity 1 or Severity 2 defect;
- financial truth reconciled to $0.01 across release-critical surfaces;
- ratified performance budgets passing, including long-running workflows;
- core task/usability, responsive/accessibility, privacy, support, and operations
  evidence complete;
- supervised-cohort evidence without a financial-integrity, recovery, privacy, or
  data-loss incident;
- monetization foundations ready before payment collection.

The automated report may say **READY FOR BETA** while the full product gate still
says **NOT READY**. The stricter verdict controls release.

---

## 4. Release workflow

```
Before a major change or a beta release:

  Enable TEST_HARNESS_ENABLED + VALIDATOR_ENABLED (admin, dev only)
        ↓
  Run the required suites in bounded chunks
        ↓
  Harness: per scenario → provision disposable wb → run workflow → Validator health check
        ↓
  Persist each chunk's evidence; test_harness_report.js aggregates → Release Readiness report
        ↓
  Overall READY?  ──no──►  fix failing scenarios (each links to findings) ──► re-run
        │yes
        ▼
  Proceed with the change / release; archive the report with the release notes
  Disable the flags again (default-off)
```

The admin identity is not a test setting: only `samertheodossy@gmail.com` may run
the guarded evidence. `cashcompass2026@gmail.com` stays a normal disposable test
user. Never modify `ADMIN_EMAILS` to work around authentication; switch the
operator session to the administrator or stop.

- Run the applicable fast regression suites before a major change. Before a beta
  release, execute every required suite in bounded chunks and aggregate the saved
  evidence; do not depend on one execution exceeding Apps Script runtime limits.
- Archive each Release Readiness report alongside the release (or in
  `SESSION_NOTES.md`) so the go/no-go decision is auditable.

---

## 5. Output form

- `outputMode`: `'log' | 'json' | 'both'` (reuses `validator_report.js` shaping).
- Values **redacted by default** (`redactValues: true`) — the report is structural,
  not a data dump.
- A future admin-gated Admin Diagnostics action can render the report as a card
  (score + failing scenarios), read-only, never auto-repairing.
