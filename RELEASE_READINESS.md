# Release Readiness — Report & Workflow

*The pre-release go/no-go produced by the Test Harness running every scenario pack
and the Validator judging each result.*

**Status:** **Design + template. Not implemented.** The Test Harness *foundation
V1* and the Validator Phase 2 core (Provisioning / Drift / Schema Evolution) now
exist, but the **aggregate Release Readiness report** — every scenario pack across
all families rolled into one go/no-go — is not built yet. It will be produced by
`test_harness_report.js` (see `TEST_HARNESS_ARCHITECTURE.md`) once the scenario
packs land. This file is the report format and the release workflow; the harness is
the producer.

**Related docs:** `TEST_HARNESS_ARCHITECTURE.md` (the runner),
`VALIDATOR_ARCHITECTURE.md` (the read-only judge), `REGRESSION_SCENARIOS.md` (the
regression pack), `ROADMAP.md` (P1 sequencing).

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

---

## 4. Release workflow

```
Before a major change or a beta release:

  Enable TEST_HARNESS_ENABLED + VALIDATOR_ENABLED (admin, dev only)
        ↓
  runRegressionSuite({ enabledPacks: ALL })
        ↓
  Harness: per scenario → provision disposable wb → run workflow → Validator health check
        ↓
  test_harness_report.js aggregates → Release Readiness report
        ↓
  Overall READY?  ──no──►  fix failing scenarios (each links to findings) ──► re-run
        │yes
        ▼
  Proceed with the change / release; archive the report with the release notes
  Disable the flags again (default-off)
```

- Run the **SMOKE + REGRESSION** packs before any major change; run **ALL** packs
  before a beta release.
- Archive each Release Readiness report alongside the release (or in
  `SESSION_NOTES.md`) so the go/no-go decision is auditable.

---

## 5. Output form

- `outputMode`: `'log' | 'json' | 'both'` (reuses `validator_report.js` shaping).
- Values **redacted by default** (`redactValues: true`) — the report is structural,
  not a data dump.
- A future admin-gated Admin Diagnostics action can render the report as a card
  (score + failing scenarios), read-only, never auto-repairing.
