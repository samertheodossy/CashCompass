# Release Readiness — Report & Workflow

*The pre-release go/no-go produced by the Test Harness running every scenario pack
and the Validator judging each result.*

**Status:** **Bounded runner source-ready; Validator/Workbook Health and all three authenticated browser suites runtime-proven through isolated Central `@135`; final runtime verdict pending.** The Validator
Phase 2 core (Provisioning / Drift / Schema Evolution), fail-closed disposable
workbook lifecycle, and populated-fixture hardening now exist. Eleven suites are
runtime-proven across server and authenticated-browser runners: the five foundation
suites, Workbook Health, Performance Planner, Bills Pay E2E, First-Run UX E2E,
Populated Dashboard E2E, and Recovery Live. The **aggregate Release Readiness report** — required
suites and Validator gates rolled into one go/no-go — is now implemented locally
by `release_readiness_runner.js`: one scenario per invocation, compact privacy-safe
evidence, archived final runs, and fail-closed READY/NOT READY rules. Performance
Planner and Bills Pay E2E are runtime-proven on disposable workbooks at isolated
`@120`: Bills Pay passed 3/3 functional assertions with Provisioning/Drift PASS and
verified Trash; Performance Planner passed 4/4 with first/repeat timings of
32.779 s / 31.901 s, retained History rows, zero History charts, Restricted
owner-only sharing, CURRENT schema, Provisioning/Drift PASS, and verified Trash.
Dedicated aggregate Workbook Health passed with zero warnings at isolated `@122`
after narrow validator-normalization and disposable-fixture corrections. First-Run UX
E2E V2 passed 9/9 at isolated `@129` in 85.864 s, including Restricted owner-only sharing,
a real planner Refresh, the whole-interface customer-language assertion, privacy-safe saved
evidence, clean console/navigation, and verified Trash cleanup. Persisted runner state confirmed
that no active fixture remained. Populated Dashboard E2E run `FR-19eb43ab-e8fe-4bc8-96a5-336afff43596`
passed 11/11 at isolated `@133` in 126.323 s, including deterministic KPIs, real
selection/navigation/Refresh paths, populated Setup/Help and customer language,
Restricted owner-only sharing, clean console/navigation, and verified Trash; saved
state also confirmed no active fixture. Recovery Live run
`RL-12557aaa-5e18-4d67-a567-6304a5b57542` passed 9/9 at isolated `@135`
in 42.071 s through production confirmation, self-reconnect, stale/Trash routing,
and ambiguity. Three Restricted owner-only fixtures were verified in Trash, no
mapping remained, no protected target matched, and sole-admin configuration and
mapping fingerprints were unchanged. Therefore the current P1 verdict remains
**NOT READY**; performance budgets remain unratified
because one passing timing sample is not percentile evidence. See
`P1_RELEASE_EVIDENCE_CONTRACT.md`.

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
