## Purpose of this file

TODO.md is a working list of ideas, bugs, and tasks.

- It may contain unstructured, exploratory, or incomplete items.
- It is not the authoritative roadmap.

Only items that are refined, structured, and prioritized should be promoted to `ENHANCEMENTS.md`.

---

## Current stage — Stage 3: Beta Readiness

**Maturity (estimated):** Family Beta Readiness **~97–98% · External / Public Beta Readiness ~92%** under the prior capability-oriented estimate; the last formal quality score remains **7.5/10** from the 2026-07-20 two-track validation and has not yet been rescored. **Stage 1 (Core Platform), Stage 2 (Product Hardening), P0 Project Stabilization, the non-performance P1 Release Readiness engineering, and House Financial Accuracy V1 are complete**, and **Recurrence Engine V2 (Weekday & Biweekly scheduling) shipped 2026-07-09.** House Financial Accuracy V1 is committed as `96d0ebe` and exact isolated `@145` evidence passed 27/27. Current ordering authority is `ROADMAP.md`: **Financial Integrity Phase 3 → P3 finished-feeling UX/performance → exact-candidate Performance and final Release Readiness verdict → supervised cohort proof → 10/10 Beta Release Candidate**. `BETA_10_OUT_OF_10_PLAN.md` defines the measurable release and monetization-readiness gates.

`ROADMAP.md` is authoritative for **priority and sequence**. The `## Product Maturity Stages` section below supplies detailed stages, tasks, dependencies, testing inventory, and history; `PROJECT_CONTEXT.md` is authoritative for current technical status. The older `## Launch Readiness Roadmap` (Phase 1–7) is retained further below as historical phase expansion; where it conflicts with current ordering, `ROADMAP.md` wins.

**What is done (reconciled 2026-07-02).** The Central App is live and operational (CENTRAL_MODE routing, per-user provisioning, workbook mapping — runtime-validated) and family-beta capable. **Product Hardening (Stage 2) is complete**, delivering:

- **Recovery — destructive/admin paths validated:** executed **Admin Clear**, **mapping removal**, **reverse-index removal**, **repair audit history**, **bootstrap reprovision**, **Welcome routing**, **empty-dashboard validation**, **recovery routing**, **Reconnect**, **Central admin validation**, **`ADMIN_EMAILS` validation**. (Recovery validation completed today.)
- **Financial Integrity — foundation shipped:** **Financial Integrity Audit Framework** (read-only, admin-gated), **Debt Audit**, **shared debt Active helper (Phase 2)**, and the **`NOT_INITIALIZED`** state.
- **Performance:** **Bills Due performance optimization (~51s → ~5.6s)** (per-request Cash Flow row-map + Activity Log dedupe caching).
- **Recurrence Engine V2 — Weekday & Biweekly scheduling (✅ shipped 2026-07-09):** pure recurrence refactor (`buildRuleFromBillRow_` + `generateOccurrences_` seam) · **Weekly weekday** scheduling · **Biweekly weekday** anchor-driven 14-day cadence · **Weekday UI** · **Anchor Date** (schema + UI + validation, no silent correction) · **Schedule Effective Date** (prospective-only schedule changes) · **AutoPay concurrency hardening** (`LockService`) · **Bills schema evolution** (Weekday / Anchor Date / Schedule Effective Date columns + self-heal + formatting parity). Runtime validated (Laith, Lutfi, M1, Robinhood, San Jose House Cleaning). Legacy Weekly/Biweekly/Monthly behavior preserved.

**Recovery Validation 6F is complete.** The full P0 matrix passed 2026-07-20, all recovery flags are OFF, and the disposable fixture gate was removed. Read-only Orphan detection is a separate P1 follow-up.

The V1 trust baseline (blank-workbook stability, no fake states, gated planner email, UI copy consistency pass) and the V1.1 retirement profile integration remain the stable foundation. The **change discipline still applies to every edit** (`WORKING_RULES.md → Current phase` + `→ Central App Transition Rules`): one issue at a time, minimal / localized / safe diff, blank + populated workbook manual test steps. See `SESSION_NOTES.md → Current State — Post V1.2 Prep` for the chronological record.

The older "V1.2 work queue" candidates are retained below under `## V1.2 polish backlog` — still valid small-polish picks, but not *the* roadmap.

---

## Priority-Ranked Roadmap (P0–P4) → see `ROADMAP.md`

**The current at-a-glance priority stack now lives in its own document: `ROADMAP.md`** (created 2026-07-12, after the Validator-driven Golden/Canonical convergence milestone closed). `ROADMAP.md` is the authoritative **priority and sequence** view: P0 is complete; non-performance P1 Release Readiness engineering is complete; P2 **House Financial Accuracy V1** is complete; **Financial Integrity Phase 3 is the active remaining financial-truth gate**; P3 experience/performance follows; and the exact-candidate Performance/final-verdict gate returns before broad Beta. The roadmap carries the full House Financial Accuracy spec.

**House Financial Accuracy execution plan:** `HOUSE_FINANCIAL_ACCURACY_PLAN.md` records the completed V1 additive direction: append `Linked Property` as the final `INPUT - Debts` column; preserve the operating result internally; add actual selected-year loan payments and after-financing net cash flow; and fail closed on ambiguous matches. The isolated suite and user-approved backed-up bounded comparison passed. Canonical fresh/evolved behavior is implemented; manual Golden workbook alignment remains separately approval-gated and was not run.

The `## Product Maturity Stages` section below remains the detailed **Stage 1–6** roadmap (per-item effort, dependencies, history, Beta Gate). `ROADMAP.md` and the Stage model describe the same work — where they conflict on **ordering**, `ROADMAP.md` reflects the latest intent. Follow **Milestone Discipline** (`ENGINEERING_STANDARDS.md → §11`): finish the current milestone before starting the next.

---

## Product Maturity Stages

**Detailed maturity model and work inventory.** `ROADMAP.md` controls current priority and sequence; this section records stages, tasks, dependencies, testing inventory, and history. Each stage below lists **remaining work** with **Priority** (P0 = now/current · P1 = next, gates the following stage · P2 = high · P3 = gates external beta · P4 = V2/future), **Dependencies**, and **Estimated effort** (XS `<0.5d` · S `0.5–1d` · M `1–3d` · L `3–5d` · XL `>5d`). Completed stages list what closed them.

> **Companion: `## UX Backlog (Version 1)`** (below) is the permanent home for small product-quality improvements (polish, loading, empty-states, consistency, wording). It is cross-referenced from Stage 3–5 so these items **never disappear during a roadmap reorganization**. Review it before every Family Beta milestone and before External Beta.

**Maturity (estimated):** Family Beta Readiness **~97–98%** · External / Public Beta Readiness **~92%**. Remaining pre-beta work is the Beta Gate — including Golden Workbook convergence, Financial Integrity Phase 3, exact-candidate Performance and final Release Readiness evidence, runtime regression evidence, and Workbook/UX polish. Recovery Validation and the non-performance Release Readiness path are complete. This is **not major feature development**. `ROADMAP.md` controls the current order.

### Stage 1 — Core Platform *(✅ Complete)*

Completed architecture and core capabilities: Central App architecture · Provisioning · Workbook mapping · Dashboard · Planner · Bills · Debt Management (incl. lifecycle: Stop Tracking / Reactivate / Rename) · House Expenses · Upcoming Expenses · Activity Log · Retirement · Money Plan Phase 1 (10/70/20 dashboard card) · Admin Diagnostics foundation · Bills Due recurrence overhaul · **Bills Due performance optimization (~51s → ~5.6s)**.

**Remaining work:** None.

### Stage 2 — Product Hardening *(✅ Complete)*

Made the built capabilities provably correct and recoverable. **Completed this stage:**

- **Recovery (destructive/admin paths):** executed **Admin Clear**, **mapping removal**, **reverse-index removal**, **repair audit history**, **bootstrap reprovision**, **Welcome routing**, **empty-dashboard validation**, **recovery routing**, **Reconnect**, **Central admin validation**, **`ADMIN_EMAILS` validation**. *(Recovery validation completed today — 2026-07-02.)*
- **Financial Integrity (foundation):** **Audit Framework** (read-only, admin-gated) · **Debt Audit** · **shared debt Active helper (Phase 2)** · **`NOT_INITIALIZED` state**.
- **Performance:** Bills Due optimization (~51s → ~5.6s).

**Remaining work:** None in-stage. Financial Integrity *convergence* is carried forward into Stage 3 as a Beta Gate item. The Recovery adoption-path matrix carried into Stage 3 is now complete.

### Stage 3 — Beta Readiness *(current stage)*

Assemble the **Beta Gate** and reach a **Family Beta Release Candidate**. Remaining work.

> **Historical execution order (recorded 2026-07-09):** **1) Bills Due Pay runtime validation · 2) Investments cleanup · 3) Recovery implementation · 4) Validation Agent · 5) Golden Workbook polish · 6) Family Beta.** Retained for planning history only. It is not the current work sequence and does not override `ROADMAP.md`.
>
> **Beta-Gate workstreams (lettered A–F below) are organized by workstream, not execution order.** All must be satisfied before the Beta Release Candidate can broaden beyond supervised validation. `ROADMAP.md` controls current sequencing. **Financial Integrity — Phase 3 (workstream B)** remains a Beta-Gate requirement — *the numbers must reconcile* before release broadens. Strategic rationale: *trust before features; the numbers must reconcile; converge the workbook before broad release; automated validation protects trust* (see `PRODUCT_VISION.md → §11 Version 1 Guiding Conclusions`).

**A. Golden Workbook Convergence** *(Beta-Gate workstream · execution item #5 — a **convergence project, not a redesign**; the production workbook is the **visual source of truth**; full inventory in `## UX Backlog (Version 1)`)*

> **Goal:** a **freshly provisioned workbook converges toward the Golden Workbook visual standard** until it is visually indistinguishable from the mature production workbook. This is one of the highest-impact Family Beta items — a beta user's first impression is the workbook itself. The **production workbook is the visual source of truth (the "Golden Workbook")** and defines the design language — see `GOLDEN_WORKBOOK.md`; per-sheet status + gaps live in `WORKBOOK_PARITY_CHECKLIST.md`.

> **First audit complete (2026-07-06).** The Golden Workbook Audit verified ten core user-facing sheets against the bound production workbook and organized them into **four design families**: **Financial Ledger** (Cash Flow, Bank Accounts, Investments, House Values) and **Operational** (Debts, Bills) are **★★★★★ Golden Reference**; **Operational Planning** (Upcoming Expenses, Donations) and **Analytical / Configuration** (Retirement, Settings) are **★★★★☆ Production Ready**. The families are intentional visual languages — the goal is not to make every sheet identical. Styling is **observed from the Golden Workbook, not inferred from code**; no convergence pass is written for a sheet until its checklist row is out of **UNKNOWN**.

| Item | Priority | Dependencies | Effort |
|---|---|---|---|
| **Golden Workbook Audit — first pass** ✓ *(2026-07-06)* — ten core sheets verified + rated by design family in `WORKBOOK_PARITY_CHECKLIST.md` | P0 | — | Done |
| Golden Workbook Audit — remaining sheets (HOUSES, LOG - Activity, OUT sheets, SYS backing, cross-cutting items) out of UNKNOWN | P0 | — | S |
| Golden Workbook Convergence pass — converge fresh provisioning toward each audited family standard (widths, row heights, freeze rows, hidden helper columns, colors, fonts, conditional formatting, number formats, totals, notes, filters, sheet ordering) | P0 | Audit rows resolved · Provisioning ✓ · styling helpers ✓ | L |
| Cash Flow convergence (Financial Ledger family — palette, negatives, headers) | P0 | Convergence pass | (incl. in L) |
| Investments convergence (Financial Ledger family) | P0 | Convergence pass | (incl. in L) |
| House Values convergence (Financial Ledger family) | P0 | Convergence pass | (incl. in L) |
| Retirement convergence (Analytical / Configuration family) | P1 | Convergence pass | (incl. in L) |
| Any remaining convergence gaps vs the Golden Workbook | P1 | Convergence pass | (incl. in L) |

**B. Financial Integrity — Phase 3 (convergence)** *(Beta-Gate workstream · sequenced alongside execution items #3–5 — foundation shipped in Stage 2: Audit Framework · Debt Audit · shared Active helper · `NOT_INITIALIZED`)*

> **Completed (Phase 1–2):** Audit Framework (read-only, admin-gated) · Debt Audit · shared debt Active helper · `NOT_INITIALIZED` state. **Remaining (Phase 3):** the canonical basis, cross-surface convergence, and the Asset / Planner / Dashboard audit modules below. Strategic anchor: *the numbers must reconcile* — this is the product's core trust claim.

| Item | Priority | Dependencies | Effort |
|---|---|---|---|
| ✅ Runtime-validate approved canonical snapshot — isolated Central `@147` run `20260722-133952-4f0a` passed 21/21 plus Provisioning/Drift/Restricted/Trash; consumer convergence remains separately gated (`FINANCIAL_INTEGRITY_PHASE_3_PLAN.md`) | P0 | Audit Framework ✓ | Complete |
| ✅ Planner / Rolling Debt convergence to within $0.01 — shared Central/bounded implementation passed isolated `@148` run `20260722-140739-190f` 27/27. Dashboard remains separate. | P0 | Canonical basis ✓ | Complete |
| ✅ Dashboard canonical totals convergence — shared Central/bounded implementation passed isolated `@149` run `20260722-143242-d150` 34/34 | P0 | Planner/Rolling convergence ✓ | Complete |
| Asset audit module (`runAssetAudit`) | P1 | Framework ✓ | M |
| Planner audit module (`runPlannerAudit`) | P1 | Framework ✓ | M |
| Dashboard audit module (`runDashboardAudit`) | P1 | Framework ✓ | M |
| Permanent reconciliation diagnostic wired into release | P1 | Convergence + audit modules | M |

**C. Validator / Test Harness / Release Readiness** *(Beta-Gate evidence workstream; foundation shipped, remaining scope follows P0)*

| Item | Priority | Dependencies | Effort |
|---|---|---|---|
| **Aggregate Release Readiness orchestration and console controls — ✅ COMPLETE**; final exact-candidate verdict remains parked behind Performance percentile evidence | P1 | Stable read models ✓ + required Validator/Harness coverage ✓ | — |
| **Validator Phase 2 runtime evidence — ✅ COMPLETE** — isolated Central `@122` aggregate Workbook Health PASS: Formula / Conditional Formatting / Named Ranges / formal schema registry / Provisioning / Drift clean, zero warnings after correcting validator normalization and fixture debt ordering; Restricted + 9/9 functional + verified Trash | P1 | Run `20260721-120759-5dc2` | — |
| **Disposable populated-fixture hardening** — ✅ isolated Central `@117` PASS: Central-created fixture, representative eight-domain data seeding, Restricted-sharing assertion, `drive.file`-compatible access, and verified Trash cleanup | P1 | Test Harness Foundation V1 ✓ | M |
| Runtime regression checklist (interim manual gate) | P1 | — | M |
| **Recent-session permanent regression packs** — Performance Planner smoke and Bills Pay E2E PASS at `@120`; exact-candidate `@141` Workbook Health + 13/13 server checks + First-Run UX + Populated Dashboard + Recovery Live PASS; production-path audit enforced; percentile campaign parked | P1–P3 by dependency | Central Safety suite + real browser/disposable-account seams | L–XL |
| Financial-integrity gate wiring into release | P1 | FI Phase 3 convergence | S |
| Deployment checklist | P2 | — | S |

> **Validator Phase 2, scenario packs, and Release Readiness controls completed 2026-07-21.** On isolated Central `@141`, aggregate Workbook Health, all 13/13 bounded server checks, First-Run UX E2E, Populated Dashboard E2E, and Recovery Live passed with Restricted fixtures and verified cleanup. The permanent 20-pair Performance Planner percentile gate is intentionally parked; seven historical pairs are diagnostic only because they predate the exact `@141` candidate. No budget is ratified from partial evidence. The Validator remains read-only. House Financial Accuracy is the next active milestone; Performance and the final verdict must close before broad Beta.

**D. Recovery completion — ✅ P0 complete 2026-07-20**

> **Implementation specification:** `CENTRAL_APP_RECOVERY_COMPLETION_PLAN.md` is the **ratified Version 1 Recovery Architecture** (decision tree, unconditional candidate detection, `CENTRAL_AUTO_ADOPT` repurposed to MEDIUM/name-only auto-adopt vs prompt, failure branches → Unavailable, testing matrix). All items in this section are implemented against that document. Core rule: *recovery must never create silent duplicates.*

| Item | Priority | Dependencies | Effort |
|---|---|---|---|
| Auto-Adopt validation (`CENTRAL_AUTO_ADOPT=true`, disposable account) | ✅ Complete | Disposable account | — |
| Ambiguous validation (≥2 candidates → `AmbiguousWorkbookError`) | ✅ Complete | Auto-Adopt pass | — |
| Name-only confirmation/adoption validation (MEDIUM-confidence single candidate; OFF-confirm + ON-auto paths) | ✅ Complete | Disposable account | — |
| Orphan validation (`ORPHANS_PRESENT` surfaced + cleanup doc) | P1 | Auto-Adopt pass | XS–S |
| **Provision-after-recovery duplicate guard** — unconditional candidate detection before create/recovery; safe stop on ambiguity/search/verify failure; HIGH relink and MEDIUM confirmation *(implemented 2026-07-16; full disposable matrix runtime-validated 2026-07-20)* | ✅ Complete | Disposable recovery matrix | — |

> **Recovery/adoption defect (closed 2026-07-20).** Candidate detection is unconditional and only confirmed zero can create. The full runtime matrix passed, including MEDIUM auto-adopt ON; no tested branch created a duplicate.

> **P0/P1 disposition (2026-07-20).** P0 recovery is complete. Read-only Orphan detection remains P1. Recovery flags are OFF and `RECOVERY_6F_TEST_EMAIL` is removed.

**E. Workbook / UX polish** *(Beta-Gate workstream · execution item #6 / Family Beta polish — loading, empty-states, consistency, onboarding; opportunistic — see `## UX Backlog (Version 1)`)*

| Item | Priority | Dependencies | Effort |
|---|---|---|---|
| Loading Experience Standardization (remaining slots — Planner, pickers, onboarding) | P2 | — | S–M |
| Empty State Standardization (one styled box + consistent wording) | P2 | — | S–M |
| UX Consistency Framework (wording / spacing / typography) | P2 | — | M |

**F. Release readiness**

| Item | Priority | Dependencies | Effort |
|---|---|---|---|
| Beta Gate assembly (Golden Workbook · FI Phase 3 · Validation Agent · Recovery · regression checklist) | P1 | A–D | Dependent |
| 10/10 Beta scorecard + product gate (≥95/100; no dimension <9/10; all non-negotiable gates PASS) | P1–P3 | Automated READY + financial truth + performance/UX + operations | Dependent |
| Documentation + onboarding review | P2 | — | S |

**Goal:** 10/10 Beta Release Candidate — **provably correct, recoverable, responsive, understandable, private, and supportable.**

### Stage 4 — Supervised Family Validation Cohort

Limited trusted users; stabilize real-world workflows while P1–P3 quality work continues. This is a learning cohort, not authorization for broad or monetized beta. Remaining work:

| Item | Priority | Dependencies | Effort |
|---|---|---|---|
| Cohort go/no-go pass *(includes a `## UX Backlog (Version 1)` review and strict workbook/data-safety checks)* | P1 | Safe candidate + support coverage | S |
| Onboard trusted users · collect usability feedback | P1 | Go/no-go | Ongoing |
| Identify workflow gaps + missing diagnostics | P2 | Beta usage | M |
| 6D.2b Create New Workbook (self-service "start fresh") | P1 | 6F closed | M |
| 6E.2 Admin Set Mapping (guarded remap, preview + audit) | P2 | 6F closed | M |
| Web App UX polish (onboarding, empty-states, error handling, Help/content cleanup) — *see `## UX Backlog (Version 1)`* | P2 | — | M–L |
| Loading-experience polish pass (unify spinner/labels, Overview + Admin loading states) — *`## UX Backlog → Loading Experience Standardization`* | P2 | — | M |
| Shared Lifecycle rollout — **Bank Accounts** (Manage pattern + lifecycle) | P2 | Debt reference ✓ | M |

*(Golden Workbook Convergence was elevated to Stage 3 — it is a Family Beta quality gate, not a follow-up. The full opportunistic UX list lives in `## UX Backlog (Version 1)`, reviewed before this milestone.)*

### Stage 5 — 10/10 Beta Release Candidate and External Beta

Broader invited audience only after the full `BETA_10_OUT_OF_10_PLAN.md` gate passes on the exact candidate. Operate many users safely and prepare monetization foundations before collecting payment. **Review `## UX Backlog (Version 1)` before entering this stage.** Remaining work:

| Item | Priority | Dependencies | Effort |
|---|---|---|---|
| **Money Plan Phase 2** — long-term planning, goal planning, recommendation engine, cash-allocation guidance, retirement integration, forecasting, long-term financial insights *(major differentiator; Version 1 objective; Phase 1 10/70/20 card shipped; also in `## UX Backlog`)* | P2 | Money Plan Phase 1 ✓ · retirement model ✓ | L–XL |
| **Income Expected / Due Workflow** — income symmetry with Bills Due (expected income surfaced, record/confirm receipt, variable income, no double-count) *(product differentiator; restored)* | P2 | Bills Due recurrence ✓ | L |
| Support workflow (intake, triage, runbooks) | P3 | — | M |
| Feedback collection | P3 | — | S–M |
| User onboarding: allow-list → invite flow | P3 | User lifecycle | M |
| Beta-user management at scale (add/remove, status, mapping health) | P3 | Admin tooling | M |
| User Lifecycle Handling (onboarding/offboarding, ownership changes, re-provision) | P3 | — | L |
| Scalability review (provisioning, locks, quotas) | P3 | — | M |
| Shared Lifecycle rollout — **Investments · Houses · Income Sources** | P3 | Bank Accounts pattern | M each |
| Shared Sheet Write Utilities | P3 | — | L |
| Admin tooling: `adminAdoptWorkbook`, `adminTrashOrphan` (soft-delete only) | P3 | 6E.2 | M |
| Tier-2 `getActiveSpreadsheet()` user-facing sweep | P3 | — | ✅ Closed by source inspection 2026-07-20 — residual calls are resolver fallback, bound/dev utilities, or harness safety only |
| Bound deployment cleanup / manifest revert once central is primary | P3 | Central primary | S |
| **10/10 Beta Release Candidate gate** — score ≥95/100, no dimension below 9/10, automated READY, no Sev-1/Sev-2, financial/performance/UX/privacy/operations/cohort gates PASS | P1–P3 | Stages 3–4 evidence | M |
| **Monetization foundation** — customer/value proposition, packaging hypotheses, entitlement seams, owned-data guarantees, privacy/terms/support/refunds, unit-cost metrics, billing/tax architecture decision | P3 | Trust + cohort evidence | L |

Actual payment collection remains later and requires demonstrated repeated value, supportability, safe cancellation/export behavior, and a separate explicit launch decision.

### Stage 6 — Version 2 / Future Platform

Differentiators and expanded platform/operations maturity. Their **full implementations** are not required for the 10/10 Beta Release Candidate; the privacy, support, measurement, entitlement, and architecture foundations named in its gate are required. Remaining work:

| Item | Priority | Dependencies | Effort |
|---|---|---|---|
| **Chat / Assistant** — read-only NL assistant (v1), then write-capable (later) | P4 | Stable read models ✓ | XL |
| **Operations Dashboard** (admin ops view of fleet health) | P4 | External beta ops | L |
| **Operational metrics** (provisioning / mapping / usage counters) | P4 | Monitoring | M |
| **Monitoring / alerting** (proactive failure detection) | P4 | — | M |
| **Analytics** (product / usage analytics) | P4 | — | M |
| **Billing activation and paid-product expansion** (provider integration, subscription lifecycle, production webhooks, tax, failed payment, refunds, pricing launch) | P4 | 10/10 gate + monetization foundation | XL |
| Account Aggregation & Transaction Import (Plaid-style) | P4 | Paid tier | XL |
| Merge Debt Accounts · Debt Payee Aliases · Google Sheets refresh awareness | P4 | — | S–L each |
| **Cash Flow Forward Projection** — explicit forward-only bill projection, separate from AutoPay actuals *(future product feature, not unfinished work — see `## Future Feature — Cash Flow Forward Projection` below)* | P4 | — | M–L |

*(Money Plan Phase 2 and the Income Expected/Due Workflow were elevated to Stage 5 — they are Version 1 differentiators, not Version 2 platform work.)*

#### Future Feature — Cash Flow Forward Projection

> **This is a future product feature, NOT unfinished functionality.** Today's Cash Flow behavior is **working as designed**: it is an **actuals** ledger (AutoPay settles occurrences as they come due; adding a bill seeds the row only; `Start Month` controls recurrence eligibility, not month population). See `ENGINEERING_STANDARDS.md → Cash Flow Data Semantics — Actuals vs Projection`, `PROJECT_CONTEXT.md → Cash Flow Semantics — Actuals, not Projection`, and `GOLDEN_WORKBOOK.md → Financial Ledger family`. **Do not "fix" the actuals behavior into a projection.**

Proposed behavior for a *future* projection feature (forecasting-adjacent; relates to Money Plan Phase 2 forecasting but is independently scopable):

- **Explicit feature** — user-triggered/opt-in; never triggered implicitly on a dashboard read.
- **Not AutoPay** — must **never reuse the AutoPay pipeline**. AutoPay settles actuals; projection forecasts. These are separate concepts.
- **Forward-only** — never back-fill history (writing past months rewrites financial history and inflates past spending).
- **Never overwrite populated cells** — manual protection; only ever fill blank future month cells.
- **Skip `Varies = Yes`** — no fixed amount to project.
- **Separate from actuals** — projected values carry **no `bill_autopay` markers** and never suppress the Bills Due card.
- **Visually distinguished** — projected values must be visibly distinct from settled/actual values so they are never mistaken for real payments.

---

## Historical Beta-Gate Queue (2026-07-09)

This queue records the July 9 plan and is **not the current ordering authority**. Use `ROADMAP.md` for current priority and sequence. The entries below are retained to preserve the origin of still-open validation questions and must be interpreted using the status notes added here and in `PROJECT_CONTEXT.md`.

1. **Bills Due Pay runtime validation** — the occurrence bridge is committed (`fdf4a30`); natural runtime evidence remains pending. Commit only if that validation produces a documentation or code change. *(Evidence gap; XS)*
2. **Investments cleanup** — the recorded local WIP is no longer current; Investments convergence was committed (`85fafc3`, with later related convergence commits). Any remaining runtime or footer work must be re-established from current evidence before planning. *(Remaining scope: UNKNOWN)*
3. **Recovery completion** — ✅ P0 complete; read-only Orphan detection follows in P1.
4. **Validator / Test Harness / Release Readiness** — Validator Phase 2, Test Harness Foundation V1, required non-performance scenario packs, and bounded console orchestration are runtime-proven through isolated `@141`; exact-candidate Performance and the final verdict remain parked gates.
5. **Golden Workbook polish** — a newly provisioned workbook must **converge toward the Golden Workbook** (the **visual source of truth**) until **visually indistinguishable from production** (styling, widths, freezes, conditional formats, number formats, totals, notes, filters, sheet order; Cash Flow / Investments / House Values / Retirement). A **convergence project, not a redesign.** First audit complete (2026-07-06, ten core sheets across four design families). *(P0/P1; L)*
6. **Family Beta polish** — Workbook / UX polish sweep (onboarding, empty-states, loading-experience consistency, messaging, Help/content cleanup — see `## UX Backlog (Version 1)`), Beta Gate assembly, release-readiness review, Stage 4 go/no-go.

> **Also a Beta-Gate requirement (not in the numbered execution queue above): Financial Integrity — Phase 3 (convergence)** — declare the **canonical financial basis**, converge **Planner / Dashboard / Rolling Debt** to within $0.01, add the **Asset / Planner / Dashboard audit modules**. *(Completed foundation: Audit Framework, Debt Audit, shared Active helper, `NOT_INITIALIZED`.)* Strategic anchor: **the numbers must reconcile** — the product's core trust claim. It must be satisfied before release broadens beyond supervised validation; sequence it alongside items 3–5.

**Longer-horizon (post-Beta-Gate, not near-term):**

- **Shared Lifecycle Framework rollout** — Debt is the reference implementation; roll out to **Bank Accounts → Investments → Houses → Income Sources** (see `## Shared Lifecycle Framework` below).
- **Product differentiators (Version 1, External Beta)** — **Money Plan Phase 2** (long-term/goal planning, recommendations, forecasting, retirement integration) and the **Income Expected/Due Workflow** (income symmetry with Bills Due).

---

## Shared Lifecycle Framework

The **Debt Lifecycle is now the reference implementation** (shipped 2026-06-29, commit `893d50d`). Detailed design + migration plan: `## Future Feature — Shared Entity Lifecycle Framework` below.

**Long-term goal:** all tracked entities eventually share the same lifecycle:

```
Create → Edit → Rename → Stop Tracking → Inactive → Reactivate
```

**Rollout order (remaining):** **Bank Accounts** (next; Stage 4) → **Investments · Houses · Income Sources** (Stage 5). Debt is the shipped reference; Bills already uses the Manage pattern.

This is a **long-term architecture goal**, sequenced after the Beta Gate and before broader external beta if time allows. Not a blocker.

---

## Beta Gate

Before broader beta, **every release must pass** the following before deployment. These are **unordered gate criteria** — all must be satisfied. Current implementation order comes from `ROADMAP.md`; the historical July 9 queue above no longer controls sequence. Criteria:

- **Golden Workbook Convergence** — freshly provisioned workbook is visually convergent with the Golden/Canonical Workbook for the core sheets. *(First audit complete; **Validator-driven engineering convergence complete for the Operational / Financial Ledger / SYS / Special families incl. Cash Flow, 2026-07-12** — remaining diffs are KeepCentral/ProductDecision/IgnoreNoise; convergence passes remaining for Investments / House Values / Retirement + the unaudited sheets. See `VALIDATOR_ARCHITECTURE.md`.)*
- **Financial Integrity** — Dashboard / Planner / active source-sheet totals reconcile within $0.01. *(Audit Framework + Debt Audit shipped; canonical basis + Planner/Dashboard/Rolling convergence + Asset/Planner/Dashboard audit modules remaining — Phase 3.)*
- **Validator / Test Harness / Release Readiness** — required automated evidence passes. *(Validator Phase 2, Test Harness Foundation V1, required non-performance scenario packs, and bounded Release Readiness controls are complete and runtime-proven through isolated `@141`. Exact-candidate Performance percentile evidence and the final archived verdict remain mandatory before broad Beta. See `VALIDATOR_ARCHITECTURE.md`.)*
- **Recovery Validation** — ✅ full P0 matrix validated; read-only Orphan detection remains P1.
- **Runtime regression checklist** — core workflows + edge cases verified. *(Automated bounded and browser evidence now covers the required non-performance inventory; final-candidate Performance and product/human gates remain.)*

This gate is the release-readiness target for **Stage 3 (Beta Readiness, current)**.

---

## UX Backlog (Version 1)

**Purpose.** A permanent home for small product-quality improvements — polish, consistency, loading, empty-states, wording — that are **too small for the main Stage roadmap but too important to lose.** They increase *perceived* quality and are **intentionally separated from engineering priorities**: they are completed **opportunistically** (whenever a related file is already open), not scheduled in strict order.

**This section is permanent.** It is cross-referenced from the Stage roadmap (Stage 3 → Stage 5) so these items survive any future roadmap reorganization. New polish opportunities discovered during investigations should be **appended here** rather than dropped.

> **Note on the two P1 items below (Golden Workbook Convergence, Money Plan Phase 2):** these are *also* first-class Stage roadmap items — Golden Workbook Convergence is **Stage 3 → D** (P1, L) and Money Plan Phase 2 is **Stage 5** (P2, L–XL). They are listed here too so the UX Backlog is a complete quality inventory; the Stage roadmap remains their authoritative scheduling home.

### Current UX Backlog

#### Blank/fresh Central runtime findings — **runtime-validated fixes + performance follow-up** *(2026-07-20)*

The isolated `@113` pass found two P0 defects and four polish gaps. The source fixes were pushed to Central, isolated deployment `@113` was updated to immutable version `@114`, and the canonical blank/fresh rerun passed functionally:

- **P0 — remove internal sheet-name leakage from Setup / Review.** **PASS on isolated `@114`.** Status cards use calm product guidance, omit internal sheet identifiers, and fail closed with a retry message instead of raw server error text.
- **P0 — render a default panel on top-level workspace entry.** **PASS on isolated `@114`.** Assets → House Values, Cash Flow → Quick add, Properties → House Expenses, and Planning → Next Actions select safe defaults without replacing an already active subtab.
- **P1 — gate empty editor actions.** **PASS on isolated `@114`.** Bank Accounts, Investments, and Debts disable Save/Stop Tracking until an entity is selected; House Expenses disables Add until a house exists; each surface shows Add/select guidance.
- **P1 — correct first-run add-new copy.** **PASS on isolated `@114`.** Bank Accounts, Investments, Houses, and matching Help text explain that CashCompass prepares current-year tracking structure automatically.
- **P2 — simplify Help for Family Beta.** **PASS for the approved Setup scope on isolated `@114`; broader content pass remains optional.** Setup flow/safety use user language; the sheet-name section remains available but is explicitly labeled an advanced reference.
- **P2 — improve Refresh Financial Plan feedback/performance.** **Feedback PASS; profiling PASS; optimization OPEN.** The button disabled in flight, re-enabled on completion, and left `Financial plan refreshed at 6:11 PM`. The blank-workbook refresh succeeded but took **143 seconds**. Isolated Central `@115` first/repeat server profiling measured **81.455 s / 77.275 s**; 82.2% of repeat time was dashboard formatting, snapshot construction, and History/Dashboard chart rebuilding. The privacy-safe flag was restored OFF after testing.

Reusable coverage: `npm run test:dashboard-ux`. **Two-track validation is complete and P0 Project Stabilization closed 2026-07-20.** The blank/fresh fixture passed the six approved rows. A separate Central-owned representative populated fixture then passed Bank/Investment/Debt selection gating, populated balances and totals, House Expenses enablement, Property Performance equity, Setup/Help language, active-subtab retention, and broad navigation with no console warnings. The populated fixture was returned to Drive Trash. The owner copy and main bounded workbook were not touched. Only the isolated deployment moved to `@114`; Beta remains pinned to `@106` and no bound deployment changed.

**Milestone boundary decision:** `ROADMAP.md` controls execution order. Remaining Golden Workbook, Financial Integrity, Validator/Test Harness, Release Readiness, and natural Bills Due → Pay evidence remain Beta-Gate work, but they do not keep the narrower P0 Project Stabilization milestone open. The measured 143-second refresh is routed to P3 Performance.

**Follow-ups discovered during the populated pass, in execution order:**

1. **P1 — disposable populated-fixture hardening. ✅ Complete on isolated Central `@117` (2026-07-21).** The 119.7-second run created a Central-owned fixture under `drive.file`, confirmed Restricted owner-only sharing before seeding, populated Bank / Investment / House / Debt / Bills / Income / Upcoming / Retirement, passed 9/9 functional assertions plus Validator checks, and confirmed Trash by Drive read-back. `TEST_HARNESS_ENABLED=false` was restored; Beta `@106` and owner/bounded workbooks were untouched.
2. **P2 UX polish — debt due-day wording.** The value is a day number, but user-facing surfaces alternate between **Due Date**, **Due Date (day of month)**, and **Due day of month**. Standardize the dashboard and Help wording on **Due day of month** without renaming the existing sheet header/schema.
3. **P2 UX polish — optional Setup loading state.** Houses and Upcoming Expenses currently show a calm `—` while their asynchronous summaries load, which can briefly look like missing populated data. Use a small **Checking…** state, then render the count / **None yet** / failure fallback.
4. **P3 Performance — Financial Plan refresh latency.** **Profiling complete; first optimization isolated PASS.** Central `@116` preserved/appended `OUT - History` rows and completed History-backed snapshot comparisons while removing the six unused embedded charts. Repeat History work fell from **11.507 s to 0.165 s** and total repeat server time from **77.275 s to 43.946 s**. Next address per-cell Dashboard formatting, Dashboard chart churn, and duplicate snapshot reads. Rerun the same `PERFORMANCE_TIMING_ENABLED` first/repeat scenario after each safe optimization while preserving correctness, email gating, and durable completion feedback.

#### Loading Experience Standardization — **P1 · effort S–M**

From the 2026-07-02 loading-experience audit (`SESSION_NOTES.md`). Unify every async surface on the shared `dash-loading` spinner + one wording standard.

- Overview snapshot loading indicator (`refreshSnapshot()` currently loads silently)
- Bills Due descriptive loading text (instead of generic "Loading…")
- Replace generic `Loading…` with contextual `Loading <thing>…`
- Remove raw `...` placeholders (e.g. `ov_bills_next7`)
- Remove `&hellip;` HTML-entity variants (onboarding)
- Standardize loading wording (one pattern, real Unicode ellipsis)
- Admin Diagnostics loading spinner (currently 4 bare muted "Loading…")
- Planner loading consistency (migrate `muted "Loading…"` slots → `loadingBlockHtml()`)
- Bank / Investment / House / Debt picker loading indicators (currently load with no indicator)
- Onboarding loading consistency (accounts / debts / bills / upcoming)

#### Empty State Standardization — **P2 · effort S–M**

One standard styled empty box + consistent wording (`No <things> yet.` / `Add your <things> …`) everywhere.

- No Bank Accounts · No Bills · No Investments · No Donations
- Empty Dashboard · Empty Retirement · Empty Planner
- Standard "couldn't load — try again" fallback in the same slot

#### UX Consistency Framework — **P2 · effort M**

A shared vocabulary + spacing/typography pass so every surface feels the same.

- Success messages · Error wording · Empty-state wording · Loading wording
- Toast consistency · Button spacing · Typography · Dialog widths · Card spacing · Badge styling

#### Web Dashboard page-by-page polish — **P3 beta-critical · effort M–L** *(audited 2026-07-21)*

**Goal:** turn the working dashboard into a clear, balanced, professional product without changing calculations, workbook schemas, or write behavior. This is an **ordered set of small implementation passes**: complete, review, and validate one ID at a time. Do not bundle the entire list into one broad redesign.

**Ordering rule:** begin with `UX-01` and proceed in ID order unless a related P1/P2 change makes a later item safer to complete opportunistically. Each pass must preserve Central and bounded behavior, use existing components/styles where practical, and receive focused desktop + responsive regression validation before it closes.

**Opportunistic polish completed 2026-07-21:** shared signed-currency formatting now places the negative sign before the currency symbol (`-$68.00`, not `$-68.00`) across the web and standalone dashboards. Positive (`+$…`) and zero (`$0.00`) behavior is preserved. Focused/full local regressions and a bounded Overview runtime check passed.

##### UX-01 — Overview information architecture and balanced grid *(first)*

- Replace the generic three-column rows that currently hold four, one, and two cards with intentional filled rows (or an explicit 12-column Overview grid). Eliminate orphan cards and unused columns.
- Organize the page in this reading order: **At a glance → What needs your attention → Financial outlook → This week → More insights**.
- Emphasize Net Worth as the primary KPI; keep Cash, Investments, Real Estate, and Debt as supporting KPIs.
- Place Suggested Actions beside Issues near the top. When there are no issues, render a compact positive state rather than a full empty card.
- Condense Retirement Outlook to its three most decision-useful values plus **View retirement details**.
- Pair Bills with Weekly Net Worth Change in one balanced two-column row.
- Move 10/70/20 Plan and Operations Snapshot into a visually quieter **More insights** section; evaluate collapsing the section.
- Remove the large Open Workspaces card because it duplicates top navigation, or replace it with a compact Quick links row only if user testing proves it useful.
- Add a visible affordance (chevron or **View details**) to cards that are clickable.

**Acceptance:** no unexplained desktop gaps or orphan rows at supported widths; the first screen answers current position and required attention; all existing card destinations and values remain correct; responsive stacking is deliberate; loading, empty, issue, and healthy states are validated.

##### UX-02 — Global visual and interaction consistency

- Standardize section spacing, card padding, headings, button gaps, badges, and dialog widths.
- Use sentence case consistently for visible labels and actions.
- Keep one visually dominant action per form; separate destructive / Stop tracking actions from the primary action.
- Standardize loading, empty, success, and error states using the existing shared patterns rather than adding a parallel component system.
- Shorten long information panels to concise outcome-focused guidance, with detailed mechanics in Help.
- Add a short purpose line to pages where a new user may not understand the workspace immediately.

**Acceptance:** the same visual role looks and behaves consistently across pages; no spreadsheet/schema labels are renamed by this pass; existing loading and empty-state backlog items are either reused or explicitly cross-referenced rather than duplicated.

##### UX-03 — Cash Flow daily-use polish

- Keep Quick add visually primary and make recent completion feedback easy to notice.
- Distinguish the daily **Due this period** queue from **Manage bills** configuration.
- Standardize visible debt/bill wording on **Due day of month** without renaming sheet headers or schemas.
- Reveal Weekday, Anchor Date, and other recurrence details only when the selected frequency requires them; preserve the separate Bills Scheduling UX safeguards below.
- Align Upcoming, Donations, Bills, and Income on the same add/list/status pattern where their workflows permit it.

**Acceptance:** users can identify where to record money versus where to maintain recurring definitions; recurrence behavior is unchanged; Quick Add remains the single payment path; terminology is consistent in Dashboard and Help.

##### UX-04 — Planning hierarchy and progressive disclosure

- Keep Next Actions as the default and clearly separate **Do now** tools from **Explore / model** tools.
- Improve cross-links between Debts, Debt Overview, and Rolling Debt Payoff so their distinct purposes are clear.
- Keep automation presentation, raw JSON, and advanced assumptions visually secondary or collapsed.
- Condense dense Retirement and Purchase result panels into headline outputs with optional supporting detail.
- Preserve the existing separation between read-only planning and explicit Cash Flow write paths.

**Acceptance:** a new user can explain which Planning tool to open for an action, a reference view, or a scenario; no planner calculations or payment routes change.

##### UX-05 — Assets workflow consistency

- Give House Values, Bank Accounts, and Investments the same visual sequence: select entity → current summary → update form → one primary Save action.
- Make Update / Add new / Review imports modes unambiguous and keep their selected state visible.
- Shorten developer-oriented helper copy and use outcome-focused language; route mechanics to Help.
- Keep selected-month, current-value, and prior-month-change summaries aligned across all three asset types.
- Review Stop tracking placement and confirmation language for consistent safety cues.

**Acceptance:** equivalent asset tasks appear in the same place and order; empty selection and first-account states remain safely gated; no asset writer, lifecycle, import, or year-block behavior changes.

##### UX-06 — Properties context and form polish

- Keep the selected property and year/context visible when moving between House Expenses and Property performance.
- Simplify the House Expense guidance panel and explain **Also add to Cash Flow** by its user-visible outcome.
- Align property summary cards and period labels; make equity, income, expenses, and net result easy to scan.
- Retain explicit disabled/empty guidance when no active house exists.

**Acceptance:** users always know which property and period they are editing or reviewing; Cash Flow posting semantics and property calculations remain unchanged.

##### UX-07 — Activity review polish

- Show active filters as compact chips or an equally clear summary and provide **Clear filters**.
- Keep the filter controls compact (and evaluate a sticky filter bar on long result sets).
- Use a responsive card/list presentation when the full table cannot remain readable.
- Make donation-only Remove behavior and unavailable actions understandable without exposing event internals.

**Acceptance:** active filtering is obvious and reversible; desktop sorting/paging remains correct; mobile content is readable; Activity remains an audit surface and no undo/delete scope expands.

##### UX-08 — Setup / Review completion guidance

- Add visible required-step progress (for example, **4 of 5 complete**) and identify one recommended next step.
- Replace temporary `—` values on asynchronous optional cards with **Checking…**, then show count / **None yet** / failure fallback.
- Keep optional areas clearly separated from required setup.
- Preserve the read-only Setup promise and explicit handoff into editors.

**Acceptance:** loading cannot be mistaken for missing data; completion and next action are obvious; opening Setup alone performs no writes.

##### UX-09 — Help and contextual guidance

- Put Getting Started and common tasks before implementation detail.
- Keep spreadsheet/internal references under a clearly marked **Advanced** section.
- Add concise contextual Help links from complex pages where users are likely to need them.
- Remove normal-path internal terminology while retaining the technical reference needed by developers and power users.

**Acceptance:** common-task guidance is discoverable without reading the advanced reference; existing Help anchors and cross-links remain valid.

##### UX-10 — Responsive, accessibility, and compatibility closeout

- Validate supported desktop and narrow widths after `UX-01`–`UX-09`; fix overflow, cramped navigation, and unintentionally stretched cards.
- Verify keyboard order, visible focus, semantic tab state, accessible names, reduced motion, and contrast.
- Run task-based usability checks across Overview, Quick Add, Bills, Assets, Planning, Setup, and Help; fix repeated confusion rather than isolated preference.
- Record browser/runtime evidence and add targeted automated checks only where the existing dashboard UX coverage is insufficient.

**Acceptance:** core tasks pass on supported desktop and narrow layouts, keyboard-only navigation is usable, no critical contrast/focus issue remains, and the exact beta candidate satisfies the Core Experience gate in `BETA_10_OUT_OF_10_PLAN.md`.

**Program completion:** all ten passes reviewed and validated; no unresolved Severity 1/2 UX defect; loading/empty/terminology findings reconciled with the adjacent UX backlog; final task-based evidence linked from the Release Readiness gate.

#### Golden Workbook Convergence — **P1 · effort L** *(also Stage 3 → D)*

**Goal:** freshly provisioned workbooks **converge toward the Golden Workbook** (the production workbook — visual source of truth) until they are visually indistinguishable from it. A **convergence project, not a redesign.** Spec: `GOLDEN_WORKBOOK.md` (incl. the four **design families**). Engineering checklist + per-sheet status: `WORKBOOK_PARITY_CHECKLIST.md`. **First audit complete (2026-07-06)** — ten core sheets rated by family; remaining sheets audited before their convergence pass.

- Formatting · widths · heights · colors · conditional formatting · sheet ordering · totals · notes · hidden helper columns · filters · freeze rows · number formats
- Retirement · Investments · House Values · Cash Flow convergence (each toward its design-family standard)

#### Money Plan — Phase 2 — **P2 · effort L–XL** *(also Stage 5)*

Long-term planning · goal planning · recommendation engine · cash-allocation guidance · retirement integration · forecasting · long-term financial insights. *(Phase 1 10/70/20 dashboard card ✓ complete.)*

#### Bills Scheduling UX — **P2/P3 · effort S–M** *(follow-ups to Recurrence Engine V2, shipped 2026-07-09)*

Opportunistic polish for the Weekday / Biweekly scheduling feature. None are blockers — the feature is shipped and runtime-validated.

- **Reorder scheduling fields in the Bills edit dialog** — group Frequency → Due Day → Weekday → Anchor Date in a natural reading order.
- **Inline Anchor Date validation** — surface the "Anchor Date must fall on the selected weekday" check as live inline feedback (not only on save).
- **Derived Schedule column evaluation** — evaluate a single read-only "Schedule" summary column (e.g. "Every other Monday from 7/6") derived from Frequency / Weekday / Anchor Date, for at-a-glance clarity.
- **Helper-text review** — review the Weekday / Anchor Date / schedule-change helper copy for consistency and clarity.
- **Formatting parity review** — re-verify Weekday / Anchor Date / Schedule Effective Date column formatting matches neighboring Bills columns on both new provisioning and self-heal.

### General Rules

The UX Backlog is:

- **not required to be completed in order** — pick items opportunistically;
- **intended for opportunistic improvements** — do a backlog item when you're already in the relevant file;
- **reviewed before every Family Beta milestone**;
- **reviewed before External Beta**;
- **allowed to accumulate throughout development** — appending is expected, not a sign of drift.

New UX/polish/consistency/loading/empty-state/wording findings go **here** (append), and any that grow large enough get promoted to a Stage in `## Product Maturity Stages`.

---

## Historical Next-Session Queue (2026-07-09)

This section preserves the July 9 handoff and is not the current starting-point recommendation. Use `ROADMAP.md` for current priority and sequence. Status corrections below prevent this historical queue from being mistaken for live work:

1. **Bills Due Pay runtime validation** — bridge committed (`fdf4a30`); natural runtime evidence remains pending. *(No fake data — validate on a real payable occurrence.)*
2. **Investments cleanup** — prior WIP was committed (`85fafc3`, with later related convergence commits); any remaining scope is UNKNOWN until re-established from current evidence.
3. **Recovery implementation** — ✅ completed and full P0 matrix runtime-validated 2026-07-20. Read-only Orphan detection remains P1.
4. **Validator / Test Harness / Release Readiness** — ✅ non-performance engineering and runtime evidence complete through isolated `@141`; exact-candidate Performance and the final verdict remain parked pre-Beta gates.
5. **Golden Workbook polish** — converge fresh provisioning toward the Golden Workbook (visual source of truth); first audit complete (ten sheets, four design families), so write the additive first-create passes for the diverging sheets.
6. **Family Beta** — once 1–5 are green, do the UX polish sweep (incl. `## UX Backlog (Version 1)` review), Beta Gate assembly, release-readiness review, and the Stage 4 go/no-go pass.

> **Note:** **Financial Integrity Phase 3** (canonical basis · Planner/Dashboard/Rolling convergence to $0.01 · Asset/Planner/Dashboard audit modules) remains a **Beta Gate requirement** (`Stage 3 → B`) even though it is not in the immediate active queue above — *the numbers must reconcile* before release broadens beyond supervised validation.

(Validation-surface reminder: the Script Properties UI may lag runtime mapping changes during testing — **Admin Diagnostics is authoritative**. All `CENTRAL_*` flags return OFF in steady state.)

---

## Launch Readiness Roadmap

**Historical phase detail (Phase 1–7) — superseded by the current P0–P4 ordering in `ROADMAP.md`.** This section is retained for the per-phase rationale (objective, why it matters, deliverables, dependencies) that shaped the current state. Where historical ordering conflicts with current priority, `ROADMAP.md` wins. Every phase runs under `WORKING_RULES.md → Current phase` and, for central-mode work, `→ Central App Transition Rules` (active).

**Stage ↔ Phase mapping:** **Stage 1 — Core Platform** *(✅ complete)* = Phase 1 (Documentation Cleanup) + Phase 3 (Workbook Totals) + shipped core/Manage/lifecycle + Bills Due performance. **Stage 2 — Product Hardening** *(✅ complete)* = Phase 2 (Family Beta Hardening incl. the recovery stack + destructive/admin validation) + the Financial Integrity foundation (Audit Framework + Debt Audit + shared Active helper + `NOT_INITIALIZED`). **Stage 3 — Beta Readiness** *(current)* = the Beta Gate (Golden Workbook Convergence · Financial Integrity Phase 3 · Validation Agent · completed Recovery Validation · Workbook/UX polish · runtime regression checklist) + release-readiness review. **Stage 4 — Family Beta** = go/no-go + Phase 5 (Web App UX) + recovery slices 6D.2b / 6E.2 + Shared Lifecycle (Bank Accounts). **Stage 5 — External Beta** = Phase 6 (External Beta Readiness) + user-lifecycle + remaining Shared Lifecycle rollout. **Stage 6 — Version 2 / Future Platform** = Phase 4 (Chat Assistant) + Phase 7 (Paid Product) + Operations Dashboard / metrics / monitoring / analytics.

**Priority scale:** P0 = now / in progress · P1 = next, gates family beta · P2 = high, needed before external beta · P3 = gates external beta · P4 = post-beta / longest horizon. Phases are roughly sequential; where noted, some can overlap.

### Phase 1 — Documentation Cleanup *(✅ complete)*

- **Objective:** Make `PROJECT_CONTEXT.md` + `TODO.md` the single authoritative, current source of truth for architecture, status, and roadmap.
- **Why it matters:** The docs had drifted far behind the code (Central App described as "future / not active," resolver as a "pass-through"). Stale docs cause re-derivation, wrong assumptions, and risky changes — and they block safe onboarding of contributors and beta support. Accurate docs are the prerequisite for everything after.
- **Major deliverables:** Bring all docs in sync with the live Central architecture; archive completed migration work (history preserved in `SESSION_NOTES.md` + `CENTRAL_APP_*.md`); record Family Beta styling status; record current architecture + deployment model (two projects / `CENTRAL_MODE` / provisioning / mapping); this Launch Readiness Roadmap.
- **Status:** ✅ Complete. Kept current by ongoing documentation passes (most recent: the June 2026 Documentation Sync reflecting Phase 2A / 3.1 / 3.2a / 3.2b / 6A / 6B / 6C.1 / 6D.1 / 6D.2a / 6E.1 completion + Flag Registry).
- **Dependencies:** None — foundation phase.
- **Estimated priority:** **P0** (complete).

### Phase 2 — Family Beta Hardening

- **Objective:** Make per-user provisioning robust, recoverable, and observable enough to safely onboard a small family beta.
- **Why it matters:** Provisioning works, but known edge cases exist (duplicate workbooks when a mapping is lost/cleared or not carried across the two-project migration, stale mappings when a mapped workbook is trashed). Without detection, recovery, and diagnostics, a single edge case becomes a blind support fire. This phase converts "works in testing" into "safe with real users."
- **Detailed design:** `CENTRAL_APP_WORKBOOK_DIAGNOSTICS_PLAN.md` — Phase 2A diagnostics design in full; Phase 2B recovery scope recorded in its `§10`.
- **Dependencies:** Phase 1 (accurate architecture docs); live provisioning + mapping (done).
- **Estimated priority:** **P1** — gates the family beta; the immediate next phase.

This phase splits into two sub-phases — **2A (diagnostics, read-only)** ships first; **2B (recovery)** builds on its evidence.

#### Phase 2A — Workbook Diagnostics *(✅ complete)*

Read-only detection and classification of Central App per-user workbooks. No repair, no auto-adopt, no writes to user Drive. Full design: `CENTRAL_APP_WORKBOOK_DIAGNOSTICS_PLAN.md`. **Shipped** as admin-gated diagnostics: candidate detection, classification (incl. cross-user `MAPPING_PRESENT_UNVERIFIABLE` / `NO_MAPPING_UNVERIFIABLE`), mapping + orphan audit, and the admin diagnostics UI.

- **Workbook Diagnostics**
  - **Candidate workbook detection** — `findCandidateWorkbooks_` (marker + name fallback; `drive.file`-visible only).
  - **Workbook classification** — `classifyUserWorkbooks_` → `OK` / `NO_WORKBOOK` / `UNMAPPED_SINGLE` / `UNMAPPED_MULTIPLE` / `STALE_MAPPING` / `ORPHANS_PRESENT` / `NAME_MISMATCH` / `NOT_OWNED`.
  - **Mapping audit** — `adminAuditUserWorkbook` / `adminAuditAllAllowlisted` (mapping present? opens? trashed? owned by caller? name match?).
  - **Orphan workbook audit** — candidates that are not the active/mapped workbook.
  - **Duplicate workbook visibility** — report (never destroy) when ≥2 candidates exist for one user.
- Supporting: `appProperties` marker strategy (read-now / write-later), `adminDiagnosticsSelfTest`, and rollout 2A.0 (zero writes) → 2A.1 (create-path marker) → 2A.2 (lazy backfill). All detail in `CENTRAL_APP_WORKBOOK_DIAGNOSTICS_PLAN.md`.

#### Phase 2B — Workbook Recovery → expanded as **Workbook Identity & Recovery (6A–6F)**

Explicit, admin-driven and self-service repair built on 2A's evidence. This is the **active near-term track**; it was designed in detail (Phase 6A) and now carries finer-grained working labels **6A–6F**. The recovery stack (6C.1 / 6D.1 / 6D.2a / 6E.1) is **implemented and committed, flag-gated OFF, and healthy-path validated (2026-06-09) — destructive/edge-path validation is 6F**. Design intent: `CENTRAL_APP_WORKBOOK_DIAGNOSTICS_PLAN.md → §10` plus the Phase 6A design pass. Flags: see `## Flag Registry`.

> **Label note:** "Phase 6A–6F" here is the detailed expansion of **2B Workbook Recovery**. It is **not** the macro **Phase 6 — External Beta Readiness** below. The two "6"s mean different things; resolve by reading the surrounding context (Identity & Recovery vs External Beta).

- **6A — Workbook Identity & Recovery design** *(✅ complete)* — identity-marker model (primary Drive `appProperties`, secondary in-workbook `SYS - Meta`, Script-Properties reverse index), adopt-before-create decision tree + confidence/safety rules, recovery UX, admin-repair safeguards + audit logging, and existing-workbook migration strategy.
- **6B — Workbook Identity Markers** *(✅ complete)* — durable identity markers stamped at create + lazy backfill on mapped-open, reverse index (`wbid::<spreadsheetId> → user`), hidden `SYS - Meta` marker sheet, and read-only admin marker diagnostics. **No provisioning/resolution behavior change.**
- **6C.1 — Adopt-Before-Create / duplicate guard** *(✅ implemented + fully runtime-validated)* — no-mapping and stale-mapping resolution always search under the user lock. Confirmed zero is the only create path; HIGH relinks; MEDIUM confirms while OFF or auto-relinks while ON; ambiguity and search/verify failures stop safely.
- **6D.1 — Recovery Page** *(✅ implemented; real-failure render validated 2026-06-11)* — calm screen for confirm / stale / ambiguous / unavailable resolution failures, routed from the startup gate instead of a raw error. No raw IDs or internal errors. Functions: `buildRecoveryRouting_`, `showRecoveryPage` / `recoveryReload`, `#page_recovery`.
- **6D.2a — Reconnect / confirm** *(✅ implemented; reconnect validated end-to-end 2026-06-11)* — self-scoped, user-initiated relink to a single existing candidate (reuses `relinkSingleCandidate_`); ambiguous/none/error handled in UI; no Drive create. `CENTRAL_RECOVERY_ACTIONS` controls optional action visibility on general recovery pages; the MEDIUM/name-only confirmation path is available regardless. Functions: `isRecoveryActionsEnabled_`, `recoveryReconnectSelf`, client `recoveryReconnect`.
- **6E.1 — Admin Inspect + Clear Mapping** *(✅ implemented; flag `CENTRAL_ADMIN_REPAIR`, default OFF; **validated end-to-end 2026-07-02** — Inspect/preview/reverse-index/confirm UI work **and executed clear runtime-validated**: mapping removal + reverse-index removal + repair audit history + bootstrap reprovision after clear)* — admin-gated read-only `adminInspectUser` (full for self, mapping-only for others — `drive.file` scope limits cross-user Drive reads) + guarded, audited `adminClearMapping` (deletes mapping + reverse-index property only; **no Drive writes, no file deletion**). Bounded admin audit ring buffer (`appendAdminAudit_` / `adminGetAuditLog`, hashed/truncated). Functions in `central_diagnostics.js` + `clearReverseIndexForWorkbook_` in `central_provisioning.js`.
- **6F — Recovery Validation** *(✅ P0 complete 2026-07-20)* — full matrix passed, including MEDIUM automatic adoption with auto-adopt ON. Final cleanup soft-trashed the fixture, cleared mapping/reverse index, returned candidate count to zero, restored all recovery flags OFF, and removed the fixture email gate. Read-only Orphan detection remains P1.
- **6D.2b — Create New Workbook** *(remaining, P1; designed, not implemented)* — self-service "start fresh" recovery action; separate flag, explicit confirm, duplicate-avoidance-first, self-scoped.
- **6E.2 — Admin Set Mapping** *(remaining, P2; designed, not implemented)* — guarded admin remap to an admin-supplied spreadsheet ID (preview-before-write, audited). Future admin tooling also: `adminAdoptWorkbook`, `adminTrashOrphan` (soft delete only, id-in-hand, never bulk) + family-beta rollout checklist.

### Phase 3 — Workbook Totals Project *(✅ complete for current scope)*

- **Objective:** Bring newly provisioned workbooks to visual + functional parity with the production workbook by generating canonical summary rows on first-create.
- **Why it matters:** Fresh workbooks previously lacked the `TOTAL DEBT` / `Total Accounts` / `Delta` rows users expect and that some readers/UX assume. Parity reduces confusion and support load, and makes the beta experience feel finished.
- **Delivered:**
  - **3.1 — TOTAL DEBT** ✅ — summary row on `INPUT - Debts` that sums the financial columns; matcher fix so single-cell `=SUM(C2)` (auto-normalized by Sheets) refreshes correctly.
  - **3.2a — Bank Accounts Total Accounts** ✅ — per-year-block per-month + Total-column SUM row on `INPUT - Bank Accounts`.
  - **3.2b — Bank Accounts Delta** ✅ — month-over-month change row (display-only; January blank/0 logic with cross-year chaining; Total column sums the month cells).
  - Bank/Debts **Add-New dropdown fix** ✅ — Type dropdowns merge canonical + server options (deduped union) so they don't collapse after an add.
- **Formula strategy / insert behavior / reader compatibility** preserved — insert-proof SUM formulas, new rows route above the totals band, existing total/delta skip logic in dashboard + planner readers preserved (no double-counting).
- **Later follow-up (if needed):** Investments / House Values summary-row parity (not yet required by readers).
- **Dependencies:** Phase 1; the Family Beta styling helpers (done) to style the generated rows.
- **Estimated priority:** **P1–P2** — complete for the current scope.

### Phase 4 — Chat Assistant v1 *(→ moved to Stage 6 — Version 2 / Future Platform)*

> **Reconciled:** Chat Assistant is a differentiator but is **not required for Family Beta or External Beta**. It now lives in **Stage 6 — Version 2 / Future Platform** (P4). The rationale below is retained.

- **Objective:** Ship a **read-only** natural-language assistant over the existing canonical read models.
- **Why it matters:** A differentiator that reduces "where do I find X / what does this mean" friction. Read-only keeps it safe (no write-path risk) and aligns with the decision-layer principle (reads existing sources, never creates data).
- **Major deliverables (read-only v1):** Spending questions; debt questions; retirement questions; cash-flow questions; planner explanations; dashboard explanations. Routes to existing pages; never a write surface. (Constraints + phased rollout already drafted in `ENHANCEMENTS.md → Chat-based Finance Assistant (detailed)`.)
- **Future (explicitly out of v1):** Write-capable assistant; goal creation; bill creation; cash-flow updates — all deferred until the read-only assistant is trusted and the write-path safety model is designed.
- **Dependencies:** Stable read helpers (done); accurate docs (Phase 1). Independent of Phases 2/3 but lower launch-criticality.
- **Estimated priority:** **P2** — valuable, not a beta blocker; can slot flexibly.

### Phase 5 — Web App UX Improvements

- **Objective:** Polish the central web-app experience for both first-time (freshly provisioned) and ongoing users, and cut the text/messaging down to a calm, low-cognitive-load surface.
- **Why it matters:** Provisioned users land in an empty workbook; onboarding, empty-states, and error handling decide whether a beta user succeeds or churns on day one. This is where hardening (Phase 2) becomes a good user experience. Verbose, duplicated instructional copy is a major source of cognitive load that competes with the actual data.
- **Major deliverables:** Onboarding improvements; empty-state improvements; error-handling improvements; user guidance / help; dashboard polish; planner polish; **Help Text & Content Cleanup** (see below). (Absorbs the residual `## V1.2 polish backlog` items below.)
- **Help Text & Content Cleanup:**
  - Remove verbose instructional text.
  - Remove duplicated explanations (same guidance repeated across panels/help).
  - Simplify onboarding language (Setup / Review, Welcome gate).
  - Simplify dashboard messaging (Overview cards, status lines).
  - Simplify planner messaging (Next Actions, Rolling Debt Payoff, Debt Overview).
  - Improve empty states (standard `No <things> yet.` / `Add your <things> …` pattern everywhere).
  - Standardize success messages (consistent tone + wording across all save paths).
  - Standardize error messages (calm, trust-safe phrasing; no `Error:` prefixes or internal sheet names).
  - Move advanced explanations behind help / info links instead of inline blocks.
  - Reduce cognitive load (fewer words on screen; progressive disclosure; let the data lead).
- **Dependencies:** Phase 2 (provisioning + recovery flows feed onboarding/error UX); Phase 1. Help/content cleanup builds on the V1 UI copy consistency pass and the `UX_POLISH_AUDIT.md` backlog.
- **Estimated priority:** **P2** — important before external beta.

### Phase 6 — External Beta Readiness

> **Label note:** this macro **Phase 6** is the **External Beta** phase. It is distinct from the **Workbook Identity & Recovery "6A–6E"** working labels under Phase 2B above (those expand 2B Workbook Recovery, not this phase).

- **Objective:** Move from a small family beta to a wider invited external beta.
- **Why it matters:** External users need support, feedback channels, smooth onboarding, recovery flows, diagnostics, and user management. Without these, scaling beyond a handful of trusted users is unmanageable and reputationally risky.
- **Major deliverables:** Support workflow; feedback collection; user onboarding (allow-list → invite flow); recovery flows; diagnostics; beta-user management (add/remove, status, mapping health at scale).
- **Dependencies:** Phases 2 & 5 (hardening + UX); Phase 1. Benefits from Phase 3 parity.
- **Estimated priority:** **P3** — gates the external (public-ish) beta.

### Phase 7 — Paid Product Readiness

- **Objective:** Prepare to monetize (free + paid tiers) with the legal and operational readiness a paid product requires.
- **Why it matters:** Monetization is only enforceable on the central model (now live). Before charging, the product needs entitlements, plan enforcement that fails open, legal docs, a real support process, and operational monitoring — gating per-copy installs was never possible, but charging without these would be premature.
- **Major deliverables:** Pricing model; subscription model; entitlements (`SYS - Users` schema, `getUserPlan_` / `isPaidUser_` helpers); plan enforcement (gate advanced features only, fail open per `WORKING_RULES.md → Monetization Rules`); privacy policy; terms of service; support process; operational monitoring.
- **Dependencies:** Phase 6 (stable external beta + support/monitoring baseline). Follows `WORKING_RULES.md → Monetization Rules`.
- **Estimated priority:** **P4** — last; longest horizon (6–12 months out).

---

## Historical Known Priorities (ranked, 2026-07-09)

Historical ranked detail retained for traceability. It does not override the current P0–P4 ordering in `ROADMAP.md`. Diagnostics, Debt parity, Bank Accounts parity, Identity markers, the recovery destructive/admin paths, the Financial Integrity Audit Framework + Debt Audit + shared Active helper + `NOT_INITIALIZED`, and the Bills Due performance optimization were already complete when this queue was recorded.

**Stage 3 — Beta Readiness (current):** *(confirmed near-term execution order — 2026-07-09)*

1. **Bills Due Pay runtime validation** — bridge committed (`fdf4a30`); natural runtime evidence remains pending. *(Evidence gap; XS)*
2. **Investments cleanup** — prior WIP was committed (`85fafc3`, with later related convergence commits); remaining scope is UNKNOWN until re-established.
3. **Recovery completion** *(6F)* — ✅ P0 complete; read-only Orphan detection follows in P1.
4. **Validator / Test Harness / Release Readiness** — ✅ non-performance engineering and runtime evidence complete through isolated `@141`; exact-candidate Performance and the final verdict remain parked pre-Beta gates under `ROADMAP.md`.
5. **Golden Workbook polish (Convergence)** — newly provisioned workbook converges toward the Golden Workbook (visual source of truth) until visually indistinguishable from production (Cash Flow / Investments / House Values / Retirement + all visual attributes). First audit complete (2026-07-06). *(P0/P1, L — convergence, not redesign)*
6. **Family Beta polish** — Workbook / UX polish sweep (loading-experience consistency, empty-state standardization, UX consistency, onboarding — see `## UX Backlog (Version 1)`) + Beta Gate assembly + go/no-go. *(P2)*

> **Beta-Gate requirement, sequenced alongside items 3–5 (not a numbered slot above): Financial Integrity — Phase 3 (convergence)** — canonical basis → Planner/Dashboard/Rolling convergence to $0.01 → Asset/Planner/Dashboard audit modules. Foundation shipped (Audit Framework · Debt Audit · shared Active helper · `NOT_INITIALIZED`). *The numbers must reconcile* before the Beta Release Candidate broadens beyond supervised validation. *(P0–P2)*

**Stage 4 — Family Beta:**

5. **Family Beta go/no-go + Web App UX polish** — onboarding, empty-states, loading-experience consistency, Help/content cleanup.
6. **Create New Workbook recovery action** *(6D.2b)* + **Admin Set Mapping** *(6E.2)* — designed, not implemented.
7. **Shared Lifecycle rollout — Bank Accounts** (Manage pattern + lifecycle).

**Stage 5 — External Beta:**

8. **Money Plan Phase 2** *(major V1 differentiator)* + **Income Expected/Due Workflow** *(product symmetry with Bills Due)*.
9. **External Beta Hardening** — support, feedback, onboarding invite flow, beta-user management at scale.
10. **User Lifecycle Handling** — onboarding/offboarding, ownership changes, re-provisioning, allow-list removal, mapping health at scale.
11. **Shared Lifecycle rollout — Investments · Houses · Income Sources**; Shared Sheet Write Utilities; bound-deployment cleanup once Central is primary. *(The user-facing Tier-2 `getActiveSpreadsheet()` sweep closed by source inspection 2026-07-20.)*

**Stage 6 — Version 2 / Future Platform:**

12. **Chat / Assistant** (read-only v1 → write-capable later).
13. **Operations Dashboard · operational metrics · monitoring · analytics**.
14. **Paid Product Readiness** — pricing/subscription, entitlements, plan enforcement (fail open), legal docs, support, monitoring; then Account Aggregation & Transaction Import.

---

## Flag Registry

Central-project **script properties** (`PropertiesService`), read at runtime, **default OFF**, **fail closed** (absent/unparseable → OFF). They let the recovery stack ship dark; enable only for validation, then disable. Set to `true` (string) to enable. Authoritative copy: `PROJECT_CONTEXT.md → Flag Registry`.

| Flag | Default | Status | Risk | Gates | When OFF |
| --- | --- | --- | --- | --- | --- |
| `CENTRAL_AUTO_ADOPT` | OFF | OFF-confirm + ON-auto runtime-validated; restored OFF | High | Automatic adoption of a single MEDIUM/name-only candidate | Candidate detection remains active; HIGH candidates relink; MEDIUM candidates require explicit confirmation; no silent create. |
| `CENTRAL_RECOVERY_ACTIONS` | OFF | Implemented, validated end-to-end (2026-06-11) | Medium | Optional Reconnect action on general recovery pages | General recovery pages stay display-only; the required MEDIUM-candidate confirmation action remains available. |
| `CENTRAL_ADMIN_REPAIR` | OFF | Implemented, validated end-to-end (2026-07-02) | Medium | 6E.1 admin Inspect + Clear Mapping (`adminInspectUser` / `adminClearMapping`) | Admin repair endpoints disabled / no-op. |

**Recommended usage:** keep all three recovery flags OFF in steady state. `CENTRAL_AUTO_ADOPT` is runtime-validated but remains High risk because it automatically relinks one MEDIUM candidate; enable it only for a deliberate disposable-account pass. `CENTRAL_RECOVERY_ACTIONS` / `CENTRAL_ADMIN_REPAIR` are validated for controlled testing; run any actual repair only against a disposable test user.

**Healthy-path validation (2026-06-09):** dashboard loaded with `CENTRAL_RECOVERY_ACTIONS=true` + `CENTRAL_ADMIN_REPAIR=true` + `CENTRAL_AUTO_ADOPT=false` — existing workbook resolved, no recovery page, no regression; Admin Diagnostics + Repair Toolkit + Inspect/mapping-preview/reverse-index/confirm-before-clear UI all worked.

**Reconnect validation (2026-06-11):** with `CENTRAL_RECOVERY_ACTIONS=true`, a real stale mapping (invalid workbook ID) rendered the recovery page and blocked the dashboard; **Reconnect executed and the dashboard reloaded** (reconnect reload bug fixed). An empty orphan workbook (same name; only `Sheet1` + `INPUT - Settings`; no data) was found and trashed. **Admin Diagnostics is the authoritative validation surface** — the Script Properties UI may lag runtime mapping changes during testing.

**Recovery validation closure (2026-07-20):** Admin Clear and every duplicate-prevention branch passed, including MEDIUM auto-adopt ON. Read-only Orphan detection remains P1.

- Independent of `CENTRAL_MODE`, `FAMILY_BETA_ALLOWLIST`, and `ADMIN_EMAILS`.
- The **Recovery Page (6D.1)** is **not** flag-gated — it always replaces a raw error with a friendly screen; only the Reconnect action on it is gated.
- All three are **OFF in the committed state**, so the recovery stack is inert until deliberately enabled; after the 6F destructive-path pass, return flags OFF for steady state.

---

## Open testing inventory

The full P0 recovery matrix is validated. The final MEDIUM auto-adopt-ON run silently relinked the exact single candidate, created no duplicate, and reached Welcome. Cleanup returned mapping/candidate count to zero, restored all recovery flags OFF, and removed `RECOVERY_6F_TEST_EMAIL`. Read-only Orphan detection remains P1.

### Recovery Validation Progress (2026-06-24)

Latest 6F pass — Admin Diagnostics + inspection + feature-flag enforcement re-confirmed (config: `CENTRAL_ADMIN_REPAIR=false`).

**Validated:**

- Admin Diagnostics page loads successfully.
- Mapping inspection works.
- Reverse index inspection works.
- User lookup works.
- Repair toolkit inspection works.
- Mapping and reverse-index consistency can be verified through Admin Diagnostics.
- Safety confirmation checkbox works.
- Repair action correctly respects feature flags.

**Observed:**

- Clear Mapping action displays "Repair is disabled (flag off)" — matches current configuration `CENTRAL_ADMIN_REPAIR=false`.

**Result:**

- Admin inspection workflow: **PASS**
- Mapping lookup workflow: **PASS**
- Reverse index lookup workflow: **PASS**
- Repair feature-flag enforcement: **PASS**

**Validated 2026-07-02 (executed Admin Clear pass):**

- ✓ Executed Admin Clear Mapping (flag ON).
- ✓ Mapping removal.
- ✓ Reverse-index removal.
- ✓ Repair audit history after execution.
- ✓ Bootstrap reprovision after clear.
- ✓ Welcome routing.
- ✓ Dashboard empty-state validation.
- ✓ Financial Integrity `NOT_INITIALIZED` handling.
- ✓ Central admin routing validation.
- ✓ `ADMIN_EMAILS` validation.

**Validated 2026-07-20 (disposable decision-tree pass):**

- ✓ Confirmed-zero create (exactly one workbook + mapping).
- ✓ MEDIUM/name-only explicit confirmation with `CENTRAL_AUTO_ADOPT=false`.
- ✓ Ambiguous candidate routing (no auto-pick, no create).
- ✓ Injected search and verification failures (unavailable, no create).
- ✓ Stale invalid-ID and mapped-workbook-in-Trash variants.
- ✓ Cross-user candidate isolation.
- ✓ Fixture cleanup and recovery flags restored OFF.

**Not yet validated:**

- **P1 (non-blocking):** read-only Orphan workbook validation.

**Readiness note:** The no-duplicate tree has live evidence for every P0 branch, including automatic MEDIUM/name-only adoption. `CENTRAL_AUTO_ADOPT` was restored to `false` after the isolated pass.

**Implemented + tested (validated):**

| Item | Flag | Risk | Status / timing |
| --- | --- | --- | --- |
| Identity markers (6B) | — | Low | Validated (in use since 6B). |
| Admin Inspect User — read-only (6E.1) | `CENTRAL_ADMIN_REPAIR` | Low | Validated — Diagnostics + Repair Toolkit load, Inspect + mapping preview + reverse-index visibility work. |
| Recovery flags healthy-path load | recovery + admin-repair ON | Low | Validated — dashboard loads, existing workbook resolves, no recovery page, no regression. |
| Confirm-before-clear UI (6E.1) | `CENTRAL_ADMIN_REPAIR` | Low | Validated (prompt renders; clear not executed). |
| Admin Repair disabled-path enforcement (6E.1) | `CENTRAL_ADMIN_REPAIR`=OFF | Low | Validated (6F Part 2, 2026-06-10) — clicked Clear returns "Repair is disabled (flag off)."; no mapping/reverse-index/workbook change. Server-side gate fails closed. |
| Recovery Page (6D.1) — real-failure render | — | Medium | Validated (2026-06-11) — a real stale mapping rendered the page and blocked the dashboard. |
| Reconnect action (6D.2a) | `CENTRAL_RECOVERY_ACTIONS` | Medium | Validated end-to-end (2026-06-11) — executed reconnect relinked the user; dashboard reloaded; reconnect reload bug fixed. |
| Admin Clear Mapping — executed with flag ON (6E.1) | `CENTRAL_ADMIN_REPAIR` | Medium | **Validated end-to-end (2026-07-02)** — executed clear removed the mapping + reverse index; next load reprovisioned; flag OFF afterward. |
| Mapping + reverse-index removal (6E.1) | `CENTRAL_ADMIN_REPAIR` | Medium | **Validated (2026-07-02)** — both properties removed by the executed clear. |
| Admin audit ring buffer (append/read, hashed) | `CENTRAL_ADMIN_REPAIR` | Low | **Validated (2026-07-02)** — the executed clear wrote the expected repair audit entry. |
| Bootstrap reprovision after clear | — | Medium | **Validated (2026-07-02)** — next load provisioned a fresh workbook; Welcome routing + dashboard empty-state correct. |
| Financial Integrity `NOT_INITIALIZED` handling | — | Low | **Validated (2026-07-02)** — bootstrap-only workbook reports the informational state, not FAIL. |
| Central admin routing + `ADMIN_EMAILS` | — | Low | **Validated (2026-07-02)** — `?view=admin` renders Admin Diagnostics for an admin, dashboard for non-admins. |

**Recovery decision-tree closeout and later follow-up:**

| Item | Flag | Risk | Status / timing |
| --- | --- | --- | --- |
| P0 duplicate-prevention decision tree | — | High | Local tests PASS; Apps Script scenario 7/7 + Recovery suite 1/1 PASS; full P0 runtime matrix PASS. |
| Auto-Adopt with flag ON (6C.1) | `CENTRAL_AUTO_ADOPT` | High | Runtime-validated 2026-07-20 on the isolated disposable account; exact MEDIUM candidate relinked, no duplicate, flag restored OFF. |
| Ambiguous recovery (≥2 → `AmbiguousWorkbookError`) | — | Medium | Runtime-validated 2026-07-20 — no auto-pick and no create. |
| Name-only confirm/adopt (MEDIUM-confidence single candidate) | `CENTRAL_AUTO_ADOPT` | Medium | OFF-confirm + ON-auto runtime PASS; flag restored OFF. |
| Orphan workbook detection (`ORPHANS_PRESENT`) | — | Low | Not exercised end-to-end; P1 follow-up after the P0 6F matrix; surfacing-only, manual cleanup; does not block P0 closure. |

**6F — COMPLETE:** full P0 matrix passed on the isolated disposable Central account. Read-only Orphan detection is a separate P1 follow-up.

---

## V1.2 polish backlog — small picks (not the roadmap)

These are still-valid small-polish items, retained for continuity. They are **not** the current roadmap (see `## Launch Readiness Roadmap` above) — most fold naturally into **Phase 5 — Web App UX Improvements**. Pull **one** at a time under the V1.2 working rules (`WORKING_RULES.md → Current phase`). Completed items move into `## DONE (history)` at the bottom.

### V1.2 candidates

#### A. Immediate follow-ups (low risk)

Small, localized polish. Must pass the blank + populated two-track manual checks in `TESTING_PLAN.md`.

- **Profile DOB parser symmetry** — `profile.js::isValidProfileDateString_` still assumes strict `YYYY-MM-DD` text. Retirement's `computeAgeFromDob_` was widened to also accept Date objects (`6d25c0e`); apply the same normalization on the Profile save-side so a Sheets-auto-coerced DOB cell does not fail re-save validation. Tiny diff.
- **Overview Retirement copy alignment** — verify the Retirement Outlook card copy routes users to Profile (for DOB) when `analysis` is null, aligning with the new `needsProfileDob` framing on the Retirement tab.
- **Blank-workbook empty-state consistency pass** — final sweep across any panel that still renders a blank table instead of the standard `No <things> yet.` / `Add your <things> in Setup / Review …` pattern.
- **Copy & Help polish sweep** — any residual user-facing wording that still reads `"error:"` / `"please fix …"` / `"Missing sheet …"` / sheet-internal names should be normalized to the V1 trust-safe phrasing from the UI copy consistency pass.

#### B. Product improvements

Slightly larger than A but still bounded. Each must have a clear user-visible benefit.

- **Profile completeness indicator / badge** — a small signal on Overview / Retirement cards showing *why* a section is gated (e.g. "Profile complete", or "Add DOB in Profile"). Pure UX, no math change.
- **Better Retirement setup guidance / linking to Profile** — deeper cross-linking from Retirement and Overview empty states back into the specific Profile field the user needs to fill, building on the new **Open Profile** CTA.
- **Optional spouse UX clarity (single vs partnered)** — wording + layout pass on the Profile spouse section and the Retirement spouse-age display so users know spouse fields are optional and what happens when they're left blank.

#### C. Future ideas (do not act yet)

Captured so the idea isn't lost. Require an explicit product decision before being pulled up.

- **Legacy sheet cleanup tool** — one-shot tidy for populated workbooks that still carry the inert `Household Input` header + `Your Current Age` / `Spouse Current Age` rows on `INPUT - Retirement`. Current design leaves them alone (safe); a later opt-in tool could remove them with user confirmation.
- **Profile → other modules integration** — extend the Profile-as-source-of-truth pattern to other modules where identity data is manually re-entered (name, email, address).
- **Notifications / SMS** — uses the existing Profile phone field to send planner reminders / alerts via SMS or similar. Infrastructure-heavy; treat as a separate product conversation.

### Deferred from V1.1 (re-qualify before pulling)

Residual V1.1 candidates that did not ship and were not promoted into V1.2 A/B/C. Re-evaluate each under V1.2 rules before picking.

- **Planner email guardrails telemetry** — optional, informational only: surface a small neutral status line when the planner run was meaningful but email was skipped because no recipient is configured. No behavior change.
- **Low-risk codebase cleanups** — `status / planner_status` audit, Help cross-links, A11y tightening. See the historical `Codebase cleanups` subsection for detail. Anything touching `doGet`, `includeHtml_`, or snapshot shape stays **Later**.
- **Dead-code prune from retirement profile integration** — `readRetirementHouseholdSafe_`, `getRetirementHouseholdInputs_`, `writeRetirementHouseholdInputs_`, and the `saveRetirementBasics` stub in `retirement.js` are now unused. Safe to remove in a future cleanup pass; keeping them one more release cycle so any stale cached client that still calls `saveRetirementBasics` gets the friendly error rather than a silent crash.

### Later (post-V1.2 / future phase)

Captured so the idea isn't lost; **not** in scope for V1.2. Requires an explicit product decision before being pulled up.

- **Onboarding factory refactor** — consolidate the per-step Setup / Review helpers (see `PROJECT_CONTEXT.md → Queued product work`). Touches onboarding shape.
- **Activity log — smart undo Phases 2–4** — Phase 1 (donation) is shipped. Phases 2 (`quick_pay`), 3 (`house_expense`), and 4 (bill skip / autopay) require logging upgrades first. See historical "Activity — Smart undo / reverse transaction" section below.
- **Larger product work** — Cash Strategy, HELOC advisor refinement, Plaid-style bank / card / loan sync, car / vehicle expenses as a first-class dashboard surface, subscriptions, income / expense classification, tax workflow, credit-card segmentation, etc. See the historical body below for full design notes.
- **Two dashboards unification** — `PlannerDashboard.html` (sidebar) vs `PlannerDashboardWeb.html` (web) shared-source strategy.
- **Broader regression / test harness** — automated unit / integration tests per `TESTING_PLAN.md`.

---

## Future Phases (VNext)

Forward-looking phases captured so the long-term direction is durable. The Central App migration that used to live here is **no longer future work** — it is live (see `## Launch Readiness Roadmap` above and `PROJECT_CONTEXT.md → Current architecture — Central App (live)`). Monetization remains future and is captured below. Pulling future work in requires the migration discipline in `WORKING_RULES.md → Central App Transition Rules` (now active) and `WORKING_RULES.md → Monetization Rules`.

### Central App Migration — DELIVERED (history)

> **Status: live.** Implemented and runtime-validated; this entry is kept for continuity. The original goal — move from a per-copy app to one centralized Apps Script web app where each user gets their own provisioned workbook — has been achieved.
>
> - **`getUserSpreadsheet_()`** is a real resolver (`central_resolver.js`): bound mode returns `getActiveSpreadsheet()`; central mode (via the `CENTRAL_MODE` flag) routes to `getOrProvisionUserSpreadsheet_()`. Identity via `Session.getEffectiveUser().getEmail()`.
> - **Per-user provisioning** (`central_provisioning.js`) creates a Drive-owned `CashCompass — <email>` workbook on first access, bootstraps `INPUT - Settings`, and writes the mapping — runtime-validated Phase A (developer) + Phase B (disposable account).
> - **Module migration** of startup/onboarding + many read/write paths to the resolver is done (Tier 1 complete; Tier 2 full-dashboard migration tracked under Phase 2/Phase 6).
> - **Backward compatibility preserved** — bound users run unchanged with `CENTRAL_MODE` off.
> - **Mapping location decided** — `mapping::<sha256(email)>` in the central project's script properties (raw emails never stored).
>
> Remaining hardening (duplicate-workbook protection, stale-mapping recovery, admin diagnostics, Tier 2 migration) is scheduled as **Phase 2 — Family Beta Hardening** (split into **2A — Workbook Diagnostics** and **2B — Workbook Recovery**; design in `CENTRAL_APP_WORKBOOK_DIAGNOSTICS_PLAN.md`) and **Phase 6 — External Beta Readiness** in the roadmap above. Full history: `SESSION_NOTES.md → Current State — Post V1.2 Prep` and the `CENTRAL_APP_*.md` docs.

### Monetization (future)

Goal: introduce free + paid tiers with feature gating inside the codebase. Scheduled as **Phase 7 — Paid Product Readiness**. Mirror of `ENHANCEMENTS.md → Future direction — Monetization`.

- **Add `SYS - Users` sheet** with columns: `Email | Plan | CreatedAt`.
  - `Email` — canonical user identifier (matches the Central App identity resolver).
  - `Plan` — short string, e.g. `free`, `paid`, `trial`. Free is default and assumed when missing.
  - `CreatedAt` — first-seen timestamp; useful for trial-window logic later.
- **Implement plan checks** with two helpers:
  - `getUserPlan_(email)` — returns the plan string; defaults to `'free'` when no record exists.
  - `isPaidUser_()` — convenience boolean built on top of `getUserPlan_()`.
  - Both helpers must be **defensive**: any error reading `SYS - Users` returns the free / unblocked default, never an exception that breaks an existing free-tier user.
- **Gate the first feature: bank import.** Initial gating candidate is the in-flight Bank Import work — once Step 2a (and later steps) ship, the import / sync entry point becomes the first paid-tier feature.
- Additional gating candidates (not commitments): advanced planner features (multi-scenario retirement, premium reports), usage limits on heavy operations.
- Gating must follow `WORKING_RULES.md → Monetization Rules`: never gate core functionality, always fail gracefully, only paid-tier features may be gated.

### Sequencing

Monetization is meaningful only **after** the Central App migration is in place — gating per-copy installs is not enforceable. The Central App migration has now landed, so the remaining order is:

1. ~~Central App migration lands (`getUserSpreadsheet_()` resolver, bootstrap flow, key modules migrated).~~ **Done** — see *Central App Migration — DELIVERED* above.
2. `SYS - Users` schema + helpers (`getUserPlan_`, `isPaidUser_`) ship as additive scaffolding (Phase 7).
3. Bank import becomes the first gated feature (Phase 7).

### Future Initiative — Account Aggregation & Transaction Import (future)

Strategic product direction that builds on the existing Bank Import infrastructure. Authoritative copy: `PROJECT_CONTEXT.md → Future Initiative — Account Aggregation & Transaction Import`. **Status:** concept validated, partially scaffolded, **not actively in development.** **This is NOT a current blocker for Recovery Validation, Family Beta, or External Beta.**

**Existing foundation (already in the codebase):** Bank Import workflow, account matching/linking, External ID support, balance-snapshot application, and import-staging concepts (`bank_import.js`; see `## Bank Import — status & resume plan` below).

**Long-term vision:**

- **Phase 1 — Connectivity & balances:** connect bank and credit-card accounts; discover accounts automatically; refresh balances; reduce manual account maintenance.
- **Phase 2 — Transactions:** import transactions; categorize transactions; suggest Cash Flow entries; detect recurring bills/subscriptions.
- **Phase 3 — Aggregation layer:** CashCompass becomes the primary financial aggregation layer — automated monthly updates, spending analysis, budget insights, net-worth automation.

**Priority:** Post-Recovery Validation, Post-Family Beta, **before Paid Product scaling** (the connectivity/import surface is the natural first paid-tier feature — see *Monetization (future)* above, "Gate the first feature: bank import").

**Related existing items to link here (not new work):** the in-flight Bank Import steps (`## Bank Import — status & resume plan`) and Tier 1 "Auto-reconciliation view" / "What changed? insights" (`## Future Enhancements (Post-Core)`) are precursors that feed this initiative.

---

### Weekly/Biweekly Weekday Recurrence Support — ✅ DELIVERED (2026-07-09)

**Status:** **shipped and runtime-validated** (was: documented / not implemented). Delivered as **Recurrence Engine V2**. The original proposal (an optional `Repeat Day` field) was implemented as separate **`Weekday`** + **`Anchor Date`** columns plus a **`Schedule Effective Date`** column for prospective-only changes.

**Background:** Weekly/Biweekly occurrences were generated from the **Due Day anchor model** (Due Day-of-month + 7/14-day steps within the month) — not weekday-aware. Recurrence Engine V2 adds true weekday scheduling while preserving that legacy model as the default.

**What shipped:**

- **Recurrence refactor:** extracted `buildRuleFromBillRow_` + `generateOccurrences_` (pure rule → occurrences seam).
- **Weekly weekday:** continuous 7-day cadence across month boundaries when a `Weekday` is set.
- **Biweekly weekday:** anchor-driven true 14-day cadence (`Anchor Date` + 14-day steps, cross-month/cross-year, no monthly re-anchoring).
- **Data model:** `Weekday`, `Anchor Date`, and `Schedule Effective Date` columns on `INPUT - Bills` — provisioned for new workbooks and back-filled by schema self-heal (`ensureBillsSheetSchema_`) with formatting parity.
- **UI:** `Weekday` shown for Weekly + Biweekly; `Anchor Date` shown for Biweekly only; hidden for other frequencies; Anchor Date convenience prefill.
- **Validation:** client + server enforce that the Anchor Date falls on the selected Weekday — **no silent correction** (`isAnchorDateValidForWeekday_`).
- **Prospective schedule changes:** editing a scheduling field stamps `Schedule Effective Date = today`; occurrences before it are never generated/autopaid (no retroactive Cash Flow accumulation, no history rewrite).
- **AutoPay concurrency hardening:** `LockService` guards autopay writes (exactly-once accumulation).

**Backward compatibility:** blank `Weekday` / `Anchor Date` → legacy Due Day behavior. Monthly, Weekly (legacy), and all other frequencies unchanged.

**Files:** `dashboard_data.js`, `bills.js`, `onboarding.js`, `Dashboard_Body.html`, `Dashboard_Script_BillsDue.html` (commit *Add biweekly weekday scheduling*).

**Remaining (small, tracked in `## UX Backlog (Version 1) → Bills Scheduling UX`):** field-order polish in the edit dialog, inline Anchor Date validation, derived Schedule column evaluation, helper-text review, formatting parity review. **Not a blocker** for Family Beta or External Beta.

---

### Future Enhancement — Merge Debt Accounts (future)

**Status:** documented, **not implemented.** Follow-on to **Manage Debts Phase 1.5 (Rename Debt)**, which is delivered. Rename is intentionally **block-on-duplicate** (a rename onto an existing active/inactive name is rejected) — Merge is the separate, opt-in workflow for *intentionally* combining two accounts (e.g. `Credit Card - Marriott` + `Marriott Bonvoy Visa` → one account).

**Why it is a separate feature (not part of Rename):** Merge is multi-decision and lossy, where Rename is a pure relabel. Each of these needs an explicit rule before it is safe:

- **Surviving row:** which `INPUT - Debts` row is kept vs. retired (likely user-chosen "merge into").
- **Account Balance:** keep target, keep source, or sum? (Summing is usually wrong for the same real-world debt seen twice.)
- **Minimum Payment / Interest Rate / Credit Limit / Due Date:** which row's values win.
- **Cash Flow Expense rows:** the two payees must be **coalesced** per year tab — and if both have a value in the same month cell, the month values may need to be combined (a value change, unlike Rename which never touches month values).
- **Activity Log:** history under both old names is preserved (no rewrite), plus one new `debt_merge` audit row.
- **Downstream:** Debt Overview, Rolling Debt Payoff, Bills Due, and Planner must re-link to the surviving name afterward.

**Reuse opportunity:** Merge can reuse the Phase 1.5 rename infrastructure — `LockService`, stale-row guard, the cross-year Cash Flow payee scan, and best-effort revert — but adds a coalescing/conflict-resolution step and a `debt_merge` activity kind.

**Priority:** Post-Family Beta. UX enhancement, not a blocker.

---

### Future Enhancement — Debt Payee Aliases (future)

Authoritative copy lives here; `PROJECT_CONTEXT.md` and `ENHANCEMENTS.md` mirror it. **Status:** documented, **not implemented.** **Long-term enhancement — not part of the current Central stabilization work. No implementation at this time.**

**Problem:** Automatic debt payment detection currently requires the Cash Flow payee name to **normalize-match the tracked debt Account Name exactly** (via `normalizeBillName_`). When the real payment payee differs from the canonical account name, the payment cannot be attributed to the debt.

- **Tracked debt:** `Meriwest Credit Union Loan`
- **Real payment payee:** `Meriwest`

These do not match today, so automatic debt detection (the Loan/HELOC balance-adjustment messaging shipped via `adjustDebtsBalanceAfterQuickPayment_`, and any future automation) cannot identify the payment. (This is the exact mismatch observed during the Meriwest HELOC investigation — the payee `"Meriwest"` never reached the matched-debt branch.)

**Future goal:** Allow each tracked debt to have **one or more optional payment aliases** used only for payment recognition and reporting.

- **Account Name:** `Meriwest Credit Union Loan`
- **Aliases:** `Meriwest`, `Meriwest CU`, `Meriwest HELOC`

**Potential future uses:**

- Debt payment recognition.
- Loan/HELOC informational messaging.
- Future principal-payment workflow.
- Rolling Debt payoff attribution.
- Money Plan debt-actual calculations.
- Imported bank transaction matching.
- Future bank import reconciliation.

**Design notes:**

- **Account Name remains the canonical identifier.** Aliases never replace it; they are an additional match surface.
- **Aliases are optional.** Preserve existing behavior exactly when no aliases are configured.
- **Matching stays deterministic** — no fuzzy / AI matching. Prefer **normalized exact alias matching** (reuse `normalizeBillName_`), checking the canonical name first, then the alias set.
- **Multiple aliases per debt** must be supported.
- **Data model (to be reviewed):** likely an optional `Aliases` column on `INPUT - Debts` (delimited list) or a small mapping store; **workbook provisioning / header repair must be reviewed before implementation** (new-header seeding for fresh workbooks + repair for existing ones).

**Areas likely affected (for later investigation, not commitments):** `INPUT - Debts` schema; debt payee matching helpers (`adjustDebtsBalanceAfterQuickPayment_`, `getDebtPayeeMap*` builders in `dashboard_data.js`); Rolling Debt payoff attribution; Money Plan debt-actual attribution; bank import reconciliation matching; Manage Debts UI (configure aliases).

**Priority:** Long-term enhancement. Post-Central stabilization. UX enhancement, not a blocker.

---

### Future UX Enhancement — Google Sheets Refresh Awareness (future)

Authoritative copy lives here; `PROJECT_CONTEXT.md` and `ENHANCEMENTS.md` mirror it. **Status:** documented, **not implemented.** **Priority: Low. UX enhancement only — not a Central architecture blocker and not a data-integrity issue.**

**Observed:** When CashCompass writes successfully to the workbook via Apps Script (e.g. House Expenses, Quick Add, Bills Due, AutoPay), an **already-open Google Sheets browser tab** may not immediately display the updated row/cell. The data is written correctly — refreshing the Google Sheets tab shows the change right away.

**Current assessment:** This looks like **Google Sheets client/UI caching**, not a CashCompass write failure. The web app and server-side reads return the correct values; only a separately-open native Sheets tab lags until reloaded.

**Future enhancement ideas (none committed):**

- Investigate whether `SpreadsheetApp.flush()` or existing flush timing can improve live visibility in an open Sheets tab.
- Investigate whether `SpreadsheetApp.toast()` (or another Sheets-side notification) is appropriate to signal a write landed.
- Consider a lightweight post-write message in the web app, e.g. *"Saved successfully. If your Google Sheet is already open, you may need to refresh it to see the latest changes."*
- Investigate whether any write paths can better trigger a Google Sheets client refresh without a full browser reload.
- **Do not** introduce artificial delays or repeated flushes unless a measurable benefit is demonstrated.

**Priority:** Low. Pursue only after Central stabilization and broader beta testing. UX enhancement, not a blocker.

---

## Future UI Standardization — Manage Pattern Rollout

**Status:** documented, **not implemented** (authoritative copy; high-level mirror in `PROJECT_CONTEXT.md`, backlog entry in `ENHANCEMENTS.md`). **Current status: Bills = complete · Debts = complete · Bank Accounts = next likely candidate.**

**Background.** Bills and Debts now have dedicated management workflows — **Manage Bills** and **Manage Debts** — which have proven significantly more user-friendly than direct sheet editing. They establish the **preferred long-term UI pattern** for module maintenance, and each major module should eventually adopt it.

**Standard pattern.** Each major module exposes a `[Primary View] [Manage]` toggle:

- **Primary View** — daily usage, dashboard actions, updates, monitoring.
- **Manage View** — edit, rename, stop tracking, archive, maintenance, configuration.

**Completed:**

- ✅ **Bills** — Manage Bills, Edit Bill, Stop Tracking, Add Bill.
- ✅ **Debts** — Manage Debts, Edit Debt, Rename Debt, Stop Tracking.

**Planned candidates (no work scheduled):**

1. **Bank Accounts — Priority: High.** Future: Manage Accounts, Rename Account, Edit Institution, Edit Type, Edit Credit Limit, Stop Tracking. *Reason:* currently still relies heavily on backend sheet maintenance — the exact same pain that Manage Debts removed (rename account, change institution, change type, fix account metadata, stop tracking). **Recommended as the next Manage rollout** — much lower risk than Recovery changes, so a good feature stream once recovery work is closed.
2. **Income Sources — Priority: Medium.** Future: Manage Income, Edit Source, Rename Source, Frequency Changes, Stop Tracking.
3. **Investments — Priority: Medium.** Future: Manage Investments, Rename Account, Edit Type, Stop Tracking.
4. **Properties — Priority: Medium.** Future: Manage Properties, Rename Property, Edit Ownership, Edit Property Metadata, Stop Tracking.
5. **Donations — Priority: Lower.** Future: Manage Donations, Edit Donation Source, Stop Tracking.

**Future framework opportunity.** After at least **three** modules use the pattern (Bills, Debts, Bank Accounts), investigate extracting a reusable management framework: shared table component, shared edit-form pattern, shared stop-tracking workflow, shared stale-row protection, shared activity logging. **Do not implement now** — extract only once three real consumers exist so the abstraction is grounded.

**Priority:** Sequenced **after** 6F Recovery Validation closes; Bank Accounts first. UX enhancement, not a blocker.

---

## Future Feature — Shared Entity Lifecycle Framework

**Status:** documented, **not implemented** (authoritative copy; high-level mirror in `PROJECT_CONTEXT.md`, backlog entry in `ENHANCEMENTS.md`). **Reference implementation: the Debt lifecycle** (`Active → Stop Tracking → Inactive → Reactivate`), shipped in commit `893d50d`.

**Related (do not duplicate):** this is the **lifecycle** companion to `## Future UI Standardization — Manage Pattern Rollout` (the *Manage view* pattern) and its "Future framework opportunity" note. Manage Pattern Rollout covers the management surface (table + edit form); this item covers the **active/inactive lifecycle** (stop/reactivate, danger zone, inactive section, lifecycle activity events, server guardrails). They should be extracted together once enough consumers exist.

**Context.** The Debt lifecycle flow is now the desired product pattern and should eventually be **consistent across long-lived CashCompass entities**: Debts, Bank Accounts, Investments, House / Real Estate values, Bills, Income Sources, Properties, and any future recurring or tracked financial object.

**Goal.** Avoid each module reinventing its own lifecycle UI, labels, colors, confirm dialogs, activity logging, and server guardrails. Build shared, reusable lifecycle utilities/components so future changes apply everywhere.

**Possible shared pieces:**

1. **Shared UI language** — Active section, Inactive section, "Show inactive" toggle with count, Reactivate button, Danger Zone, Stop Tracking button, common empty state ("No inactive *<entities>*."), common helper text.
2. **Shared button styles** — Edit = neutral · Rename = neutral/secondary · Reactivate = positive (green) · Stop Tracking = destructive (red). (Already realized as `.small-btn.success` / `.small-btn.danger` + `.debt-danger-zone` / `.debt-inactive-section` in `Dashboard_Styles.html` — generalize the class names when extracting.)
3. **Shared confirmation copy pattern** — Stop Tracking must clearly state: the item **remains in history**, is **excluded from live calculations**, and **can be restored** from the Inactive section.
4. **Shared server lifecycle helpers** — reusable pattern to: deactivate an existing row, reactivate an existing row, block duplicate **active** names, preserve all historical data, **prevent direct editing of `Active` via generic update endpoints** (allow-list guard), and emit activity-log events. (Debt reference: `deactivateDebtFromDashboard`, `reactivateDebtFromDashboard`, `getInactiveDebtsForManagementFromDashboard`, and the `updateDebtField` allow-list in `debts.js`.)
5. **Shared activity event pattern** — consistent event names `<entity>_deactivate` / `<entity>_reactivate`; consistent labels **"Tracking stopped" / "Tracking resumed"**; consistent JSON details: `previousActive`, `newActive`, `sheetRow`, `entityName`/`accountName`/`payee`/`propertyName`, `reason`. (Debt reference: `debt_deactivate` / `debt_reactivate` classified in `activity_log.js`.)
6. **Shared audit / diagnostics** — Admin Diagnostics should eventually surface lifecycle exceptions: inactive-with-balance, duplicate active names, entities with inconsistent `Active` values, and lifecycle audit-trail gaps.

**Migration strategy (phased — do not refactor everything at once):**

- **Phase 1** — Document the **Debt lifecycle as the reference implementation** (this entry).
- **Phase 2** — Inventory existing lifecycle behavior in Bank Accounts, Investments, Houses, Bills, Income Sources.
- **Phase 3** — Extract common CSS / UI copy / button styles.
- **Phase 4** — Extract common server helper patterns where safe.
- **Phase 5** — Migrate one module at a time, each with runtime validation.

**Priority:** **Medium.** Do **after** Financial Integrity reconciliation and **before** broader external beta if time allows. **Not a blocker** for the current debt lifecycle commit.

---

## Future Feature — Shared Sheet Write Utilities

**Status:** documented, **not implemented** (authoritative copy; high-level architectural note in `PROJECT_CONTEXT.md`, backlog summary in `ENHANCEMENTS.md`).

**Related (do not duplicate):** this is the **data-write** companion to `## Future Feature — Shared Entity Lifecycle Framework` and `## Future UI Standardization — Manage Pattern Rollout`. Lifecycle/Manage standardize *workflow and UI*; this item standardizes *how values land in the sheet*. It aligns with the broader Shared Lifecycle / Shared Component direction — same principle (extract a reusable layer once enough real consumers exist), applied to the write path.

**Context.** Many modules now write values back into Google Sheets — Bills, Debt updates, Bank Accounts, Investments, Houses, House Expenses, Cash Flow, and Planner outputs. Formatting-preservation bugs have recurred across several of these modules over time (most recently the Debt **Credit Limit** cell losing its green font because the write path pasted a row neighbor's format via `copyNeighborFormatInRow_`; earlier, blank Cash Flow autopay cells rendering `-3` instead of red `-$3.00`). The root problem: each module re-implements its own "set value + fix formatting" logic, so a formatting fix in one place doesn't propagate, and the wrong helper is easy to reach for (e.g. the row-uniform Cash Flow neighbor-copy is wrong for the per-column Debts sheet).

**Goal.** Introduce a shared **Sheet Write utility layer** so all writes behave consistently, and a formatting fix made once applies everywhere.

**Potential shared helpers:**

- `writeCellPreserveFormatting_()` — set a value while preserving the cell's own format.
- `writeRangePreserveFormatting_()` — range equivalent.
- `updateCurrencyCell_()` — centralized currency write + format.
- `updatePercentCell_()` — centralized percentage write + format.
- `updateDateCell_()` — centralized date/integer-date write + format.

**Responsibilities:**

- Preserve: **number format, font color, font weight, alignment, borders**, and **background where appropriate**.
- Preserve **formulas** when not intentionally replacing them.
- Centralize **currency** formatting.
- Centralize **percentage** formatting.
- Reduce duplicated write logic.
- Make formatting fixes apply everywhere.

**Design principles.** **Business logic decides WHAT value to write; shared write helpers decide HOW it is written.** Avoid every module implementing its own formatting logic. Distinguish "preserve the cell's own look" (the Debts/per-column case) from "match the row" (the Cash Flow/row-uniform case) as explicit, named behaviors rather than a single ambiguous helper.

**Current write helpers to inventory / rationalize (starting set, not exhaustive):** `applyCurrencyFormat_`, `setCurrencyPreserveFormat_`, `setCurrencyCellPreserveRowFormat_`, `copyNeighborFormatInRow_`, `copyNearestAmountFormatInRow_`, `setCashFlowMoneyCellPreserveRowFormat_` / `addCashFlowMoneyToCellPreserveRowFormat_` / `applyCashFlowMoneyFormat_` (all `planner_helpers.js`), `writeDashboardBillValuePreserveFormat_` (`dashboard_data.js`), and the `PASTE_FORMAT` template-row copy in `bank_accounts.js` (`findAccountsTemplateRow_`). Note the two distinct number-format conventions (black negatives for Debts/etc. vs `[Red]` negatives for Cash Flow) that the shared layer must keep separable.

**Migration strategy (phased — do NOT refactor immediately):**

- **Phase 1** — Inventory all current write helpers (list above is the seed).
- **Phase 2** — Identify duplicated formatting code and the distinct format conventions.
- **Phase 3** — Introduce shared helper(s) with the responsibilities above.
- **Phase 4** — Gradually migrate modules one at a time, **as they are touched**, each with runtime validation.

**Priority:** **Medium.** After **Financial Integrity**, **Recovery Validation**, and the **Validation Agent**; before broader public beta. **Not a blocker.**

---

## Future Feature — Income Expected / Due Workflow

**Status:** documented, **not implemented** (authoritative copy; high-level mirrors in `PROJECT_CONTEXT.md` and `ENHANCEMENTS.md`).

**Need.** Income should support **expected recurring income**, symmetrical to **Bills Due**. Today income exists mostly as Cash Flow rows / sources, so users have no clear view of what income is *expected*, *when it is due*, and *whether it has been recorded yet*.

**Desired behavior.**

- Track income sources with **frequency / date rules** (same recurrence vocabulary as bills: Weekly / Biweekly / Monthly / Quarterly / Yearly, Due Day anchor — reuse the Bills Due expansion logic where possible).
- Show **expected income items** on the dashboard, similar to expenses / Bills Due (Overdue / Next 7 days style sections).
- Let the user **record / confirm** income when received, writing the **actual amount** to Cash Flow (Income row for that month).
- Support recurring income: paycheck, rent, reimbursements, child support, transfers, investment distributions, etc.
- Handle **variable income** where expected ≠ actual (mirror the Bills `Varies` treatment — show expected, record actual).
- **Avoid double-counting:** if income already exists in Cash Flow for that month/date, suppress or reconcile the expected item (mirror the Bills Due handled-cell + `bill_skip`/dedupe suppression model, e.g. an `income_received` dedupe key per source + occurrence date).

**Possible UI (Cash Flow → Income).**

- **Manage Income Sources** (fits the `[Primary View] [Manage]` Manage Pattern Rollout — see above; this is the same "Income Sources — Medium" candidate, expanded).
- **Income Expected / Due** (the new dashboard surface, mirroring Bills Due).
- **Record Income** (confirm received → write actual to Cash Flow + Activity Log).
- **Skip / Not received / Delay** — optional, later.

**Areas likely affected (for later investigation, not commitments).** Income source schema (`INPUT - Income` / equivalent — may need frequency / Due Day / Varies columns + provisioning/header-repair review), `dashboard_data.js` recurrence expansion (reuse Bills Due occurrence logic), a new Income Due generation path, Cash Flow income write + double-count suppression, Activity Log (`income_received` / dedupe), and the Income section UI.

**Priority:** **Medium-high**, sequenced **after current Central stabilization** — it improves day-to-day cash planning and makes income symmetrical with bills/expenses.

**Out of scope (for now):** bank import automation, payroll integrations, advanced forecasting.

---

## Future Feature — Money Plan (Income Allocation) Page

**Status:** **Phase 1 dashboard card implemented** (10/70/20 summary card — in working tree, not yet committed); **Phase 2 Money Plan page = documented design direction, not implemented** (authoritative copy; high-level mirrors in `PROJECT_CONTEXT.md` and `ENHANCEMENTS.md`). **Phase 2 implementation requires separate approval.**

**Concept.** A simple "Money Plan" that shows users how their monthly income should be allocated and how their actuals compare. Default strategy is **10/70/20** — Save 10%, Living 70%, Debt Payoff 20%.

### Phase 1 — Dashboard summary card *(implemented; pending commit)*

A read-only dashboard card ("10/70/20 Plan") that reads the current month's income from Cash Flow and shows the Save / Living / Debt **targets** (income × 10% / 70% / 20%), with a calm "Add income to see your 10/70/20 plan." empty state. Server: `buildIncomeAllocation_(ss)` + `incomeAllocation` on the dashboard snapshot (`dashboard_data.js`); client: `renderIncomeAllocation` (`Dashboard_Script_Render.html`) + card markup (`Dashboard_Body.html`). Income basis: current calendar month's active Income, falling back to the most recent month with income. Read-only — no writes.

### Decision (this direction)

- Create a **dedicated top-level Money Plan page** (nav item: **Money Plan**), not an expanded dashboard panel.
- Keep the dashboard 10/70/20 card as a **summary only** — Income, Save target, Living target, Debt target, Status, and an **"Open Money Plan"** button (`showPage('moneyPlan')`).
- **Do not** expand detailed actuals directly on the dashboard.
- The Money Plan page is **read-only and fully derived from existing data** — no new sheets, no writes, no auto-created transfers / payments / debt actions.

### Phase 2 — Money Plan page (initial calculation model)

- **Income** — same month basis as the dashboard allocation card (`buildIncomeAllocation_` / `listActiveIncomeMonthlyTotals_`).
- **Plan (targets):** Save = income × 10% · Living = income × 70% · Debt = income × 20%.
- **Debt actual** — Cash Flow Expense rows that match active debt accounts, **reusing the existing debt-attribution logic** where possible (`buildAnchorMonthCfPaidByDebtName_` + `expensePayeeMapFromRawRows_` in `rolling_debt_payoff.js` — normalized payee matching, alias maps, loan-merge groups).
- **Living actual** — total Cash Flow expenses for the month **minus** debt actual.
- **Savings actual (headline)** — **residual**: `income − living actual − debt actual`.
  - **Do NOT** use investment-account movement as the headline savings number yet — market changes distort it. (An "estimated saved" secondary metric from investments / savings-account deltas may be considered later.)

### Page should eventually show

1. Current month **plan vs actual**.
2. **Save / Living / Debt** cards (each with plan, actual, variance, progress).
3. **Status badge:** on track / warning / off track.
4. **Recommendations** (e.g. "add ~$X to the highest-APR debt to hit 20%" — reuse rolling-debt avalanche; "trim living to 70%"; "set aside $Y to reach 10% save").
5. **Month history table** (trailing months, derived per month from Cash Flow).
6. **Future strategy settings:** selectable allocation model — **10/70/20**, **50/30/20**, or **custom** (custom percentages are a later sub-phase; Phase 2 ships 10/70/20 only).

### Architecture notes (for later investigation, not commitments)

- New top-level page `page_moneyPlan` + a `.page-btn[data-page="moneyPlan"]` nav button + a `showPage` loader hook (mirrors `activity` / `onboarding`). One read-only RPC `getMoneyPlan(monthHeader?)` returning `{ monthHeader, income, plan{…}, actual{…}, status{…}, recommendations[], history[] }`.
- Reuses: income scan (`dashboard_data.js`), debt attribution (`rolling_debt_payoff.js`), debt list (`readSheetAsObjects_(ss,'DEBTS')`), Cash Flow header/month parsing (`getCashFlowHeaderMap_`, `parseMonthHeader_`). Central-safe via `getUserSpreadsheet_()`; bound behavior unchanged.

**Open design question (resolve before Phase 2 build):** confirm the **Savings actual** definition — residual is the agreed Phase 2 headline; explicit savings/transfer detection is a later enhancement (ties into the Income Expected / Due workflow).

**Out of scope (for now):** custom-percentage editor, explicit savings/transfer detection, any writes, transfers, or debt/payment automation.

---

## Future Enhancements (Post-Core)

Forward-looking product ideas captured in prioritized tiers so the long-term direction is durable. **None of this is on the current roadmap** and all of it is **lower priority than the in-flight Bank Import completion and the ongoing Bills / planner / Cash Flow accuracy work.** Pulling any item up requires an explicit product decision under `WORKING_RULES.md → Current phase`.

### Tier 1 — High Impact (do after Bank Import + Bills)

Highest-value next moves once the current priorities are stable. Pull in **after** Bank Import is fully delivered and Bills / planner / Cash Flow accuracy is locked.

1. **Auto-reconciliation view.** Side-by-side imported bank balance vs current planned balance per active account, with a clear per-account delta. Read-only; reuses the Step 2d staged + Apply state.
2. **Cash safety alerts.** Proactive warnings for low buffer, upcoming bill pressure exceeding available cash, and a single safe / at-risk state indicator. Derived from existing planner + Cash Flow data; no new sheets.
3. **Bulk "Apply all" flow.** Apply multiple already-linked staged balances for the same month in one click. Still respects Step 2d strict approval — never auto-applies unlinked or blocked rows.
4. **"What changed?" insights.** Explain the difference between the latest import and the prior import per account; highlight the biggest drivers (bills paid, large transfers, large new charges).

### Tier 2 — UX / Insight Improvements

Bigger product-shape changes once Tier 1 is stable.

5. **Account grouping.** Group accounts on Bank Accounts / Overview by type (Checking / Savings / etc.) and optional user-defined groups. UI only; canonical sheets unchanged.
6. **Scenario / simulation mode.** Read-only "what if" overlay (extra debt payment, paused income, larger expense) that runs against a copy of the planner inputs without writing back.
7. **Historical trends (lightweight).** Per-account balance history line / sparkline derived from the year-block month columns already on `INPUT - Bank Accounts`. No new storage.

### Tier 3 — Advanced / AI / Future

Reserved for after Tier 1 + Tier 2 ship cleanly. All items in this tier are strictly read-only and must respect the same constraints as the Chat-based Finance Assistant subsection below.

8. **Chat-based Finance Assistant.** Natural-language read-only assistant. See the **Chat-based Finance Assistant** subsection below for the full constraints and phased rollout — not duplicated here.
9. **Explain my finances (narrative insights).** Plain-language summary of the current state (e.g. *"You're safe because cash covers bills through next month"*, *"Cash dropped because of the property-tax payment on May 1"*). Generated from existing planner outputs; strictly read-only.
10. **Root-cause queries.** Targeted answers to questions like *"Why is my balance lower?"* by diffing recent Cash Flow + Activity rows against the prior reference point. Read-only, deterministic in v1.
11. **Guided suggestions.** Recommend next actions (e.g. *"Move $X from Savings to Checking"*) without auto-execution. Quick Add stays the only write path.

### Chat-based Finance Assistant

Goal: let users ask natural-language questions about their finances directly inside the app (e.g. *"How much cash do I have available?"*, *"What bills are due this month?"*, *"What are my account balances?"*) without leaving the dashboard.

**Hard constraints (apply to every phase)**

- **Strict read-only.** The assistant must never write or modify financial data, never mutate any `INPUT - *` / `SYS - *` / `LOG - *` sheet, and never bypass the existing Quick Add / Setup / Review write paths.
- **Reuses existing data sources only.** `SYS - Accounts`, `INPUT - Bank Accounts`, Cash Flow / Bills, planner outputs. No new sheets, no shadow stores, no caching that can drift from the canonical workbook.
- **Tool-based access only (no raw spreadsheet exposure).** When AI is involved, the model must talk to a curated set of read helpers (the same ones the dashboard reads from) — never receive raw sheet content as context.
- **Respect privacy and cost.** Any external API call must be opt-in, scoped, and rate-limited; no PII / account numbers / balances may leave the workbook without an explicit design + privacy pass.

**Phased approach** (each phase ships standalone; later phases can be skipped without breaking earlier ones)

1. **Phase 1 — Deterministic queries (no AI).** Predefined / keyword-based questions wired to the existing read helpers — e.g. `getCashToUse`, `getBillsDueFromCashFlowForDashboard`, `getNextActionsData`, `getRollingDebtPayoffPlan`, `getDashboardSnapshot`. Demonstrates the surface end-to-end with zero external dependencies and zero LLM cost.
2. **Phase 2 — Natural-language parser.** Map free-text input → the known queries from Phase 1. Still no external API; the parser can live entirely in Apps Script (regex / keyword extraction) or in a small bundled NLU module. Same read-only surface.
3. **Phase 3 — AI-assisted chat (optional).** External LLM (e.g. OpenAI) called from a small backend / Apps Script proxy holding the API key in `PropertiesService.getScriptProperties()` — never on the client. Strictly **tool-based**: the model issues calls to the curated read helpers; it does **not** see raw sheet content. Still strictly read-only and still subject to all of the constraints above.

**Sequencing / non-goals**

- **Lower priority than Bank Import + Bills / planner / Cash Flow accuracy.** Do not pull this in while those tracks are open.
- **No money-movement actions.** Even with future write paths, the assistant must not be the surface that initiates a payment, status change, or planner mutation. Quick Add stays the only payment path.
- **No automatic posting.** The assistant does not append rows to Cash Flow / Activity / Bills / Upcoming.
- **Privacy-by-default.** Phase 3 requires its own product + privacy review before implementation begins, including a written list of fields permitted to leave the workbook (none of which can be account numbers or raw balances tied to identity).

### Product Direction Ideas (optional)

Captured for future product conversations; not committed work and not slotted into a tier.

12. **Financial state indicator.** Single-glance label on Overview — *Stable / Tight / Risk* — backed by the same signals as the Tier 1 Cash safety alerts.
13. **Weekly snapshot email.** Opt-in weekly summary covering balances, bills due, and any active alerts. Reuses the planner-email multi-recipient + debounce pipeline.
14. **Account health score.** Per-account composite score from volatility, buffer usage, and trend direction. Visualized as a small badge on Bank Accounts.

---

## Bank Import — status & resume plan

Captured so work can resume cleanly from a pause. This section is deliberately self-contained — read it first when returning to Bank Import work.

### Bank Import — Step 1 Complete

Scaffold shipped in commit `8ced838`:

- **`SYS - Import Staging — Bank Accounts`** — ensure helper creates the sheet with the full 13-column staging header (bold, frozen, no data rows): `Staging Id | First Seen | Last Seen | External Account Id | External Institution | Display Name | Last 4 | Type | Currency | Latest Balance | Latest Balance As Of | Status | Pending Reason`.
- **`SYS - Import Ignored — Bank Accounts`** — ensure helper creates the 7-column ignore registry (bold, frozen, no data rows): `External Account Id | Institution | Display Name | Last 4 | Ignored At | Ignored By | Scope`.
- **`External Account Id` column on `SYS - Accounts`** — ensure helper appends the header flush to the last non-empty header cell. Never reorders existing columns. Never writes to data rows.

What Step 1 explicitly **did not** ship:

- No ingestion logic.
- No UI.
- No planner impact — the new sheets are inert and no existing module calls the helpers.

### Next Step — Step 2a (not started)

Ingestion pipeline only. Scope is intentionally narrow:

- Exact-id auto-match against `SYS - Accounts.External Account Id`.
- Ignored handling — **permanent only** (no until-changed logic yet, even if the `Scope` column exists for future compatibility).
- Pending staging — unmatched accounts land in `SYS - Import Staging — Bank Accounts` with `Status = pending review`.
- Activity logging for each ingestion outcome (events such as `bank_import_auto_matched`, `bank_import_pending`, `bank_import_ignored`).
- Dev harness only for invocation (no menu, no dashboard button, no web UI).

Explicitly **out of scope for Step 2a**:

- No UI (review screen, suggestion scoring, edit flows, etc.).
- No external sync (Plaid / Finicity / aggregator calls).
- No planner integration — pending rows do not affect planner math; this is enforced by pending rows living only in the staging sheet, which no existing module reads.

### Rules to resume work

Apply to every Bank Import step from 2a onward. These are the V1.2 working rules with extra emphasis for this feature:

- **One step at a time.** Do not bundle Step 2a with Step 2b, UI, or sync in a single pass.
- **No bundling changes.** Each step must stand on its own and pass manual tests before the next one begins.
- **Test before commit** — run the blank + populated workbook manual checks (see `TESTING_PLAN.md` and the Step 1 / 2a test checklist) before staging anything.
- **No UI until ingestion logic is stable** and has shipped at least one clean test run against a real payload in the dev harness.
- **No planner integration until a review system exists.** Pending rows stay invisible to planner math until a human-visible review surface has been added.
- **Additive only.** No edits to existing module files unless strictly required; no reordering of existing sheet columns; no destructive migrations.

### How to resume

When the next session starts:

1. *(Optional)* Run the scaffold ensure helpers from the Apps Script editor on the target workbook to confirm the schema is in place:
   - `ensureImportStagingBankAccountsSheet_()`
   - `ensureImportIgnoredBankAccountsSheet_()`
   - `ensureAccountsExternalIdColumn_(SpreadsheetApp.getActiveSpreadsheet().getSheetByName('SYS - Accounts'))`
2. Implement **Step 2a** exactly per the scope above. Do not broaden.
3. Run the Step 2a manual test checklist (A–E) before committing:
   - **A.** Exact-id auto-match against `SYS - Accounts.External Account Id` — incoming row matches, no staging row added, activity row logged, `SYS - Accounts` data rows untouched.
   - **B.** New unknown account → pending row lands in `SYS - Import Staging — Bank Accounts` with `Status = pending review`; planner, overview, and cash flow unchanged.
   - **C.** Ignored account (`External Account Id` present in `SYS - Import Ignored — Bank Accounts`) → no staging row written; activity row `bank_import_ignored` logged.
   - **D.** Blank workbook — ensure helpers run clean on first call, idempotent on second call, no regressions in bootstrap or onboarding.
   - **E.** Manual account flow unchanged — existing Bank Accounts Add new / Update / Stop tracking paths still work byte-for-byte.

---

## Historical backlog (pre-V1.2 context)

Everything below this line is preserved as reference. Use it for background and rationale only — do not pull items directly from here without re-qualifying them against the V1.2 queue above.

SAMER Financial Planner

TO DO and issues I see in the testing

*(Numbers below keep the original list IDs; gaps **5**, **9**, **11** in the product list and **17** in codebase items are recorded under **DONE** at the bottom.)*

---

## Open items (not done)

### Open — Autopay: should it create a missing exact-text Cash Flow Expense row? (investigate, higher risk)

**Status:** **OPEN — investigate.** Separate, higher-risk follow-on to the **weekly/biweekly manual-Pay suppression fix (2026-06-23, Fix B)**, which is implemented.

**Background.** Autopay write-back in `getInputBillsDueRows_` (`dashboard_data.js`) only fires when the bill already has a matching **exact-text Cash Flow Expense row** (`hasCashFlowRow`). For a freshly-added autopay bill — or one whose payee text hasn't been mirrored onto the Cash Flow grid — autopay silently does nothing and the occurrence just shows as a due card until paid manually. This is the most likely reason the Robinhood 2026-06-18 occurrence did not auto-record.

**Question.** Should autopay **create** the missing Expense row (the way Quick Add does) for an eligible autopay bill (`Autopay = Yes`, `Varies ≠ Yes`, `Active`, amount > 0, due has passed) and then write into it, instead of skipping?

**Why it's higher risk / separate:** creating Cash Flow rows is a write/structural change (vs. the suppression fix, which only reads/marks). It must respect row insertion ordering, Flow Source seeding, formatting, the monthly vs. weekly accumulation paths, and must not fabricate rows from payee-text drift (could create a duplicate of an existing variant row). Also intersects the lazy-autopay timing (no scheduled job) and the due-today (`<` strict) edge.

**Out of scope of the 2026-06-23 fix; do not bundle.** Decide separately whether the create-row behavior is worth the risk or whether the current "show as card until manually paid" is acceptable for unmirrored autopay bills.

### Open — Central debounce trigger noise (`debouncePlannerEmailRun`) — fix reverted, revisit

**Status:** **OPEN.** Investigated + a fix was implemented and then **reverted** (2026-06-19) — code is back to the committed baseline; **we will get back to it.** No fix is currently in place.

**Symptom.** The CashCompass Central App **Executions** page accumulates many `debouncePlannerEmailRun` (Time-Driven) runs that **fail instantly (0s)**; some complete; "View Trigger" shows **No results** for the developer.

**Root cause (confirmed from code).** The planner-email debounce was designed for the **bound, single-user** model. In Central App mode the web app runs `executeAs USER_ACCESSING`, and `getDashboardSnapshot()` (`dashboard_data.js`) calls `ensureDebouncePlannerTrigger_()` (`debounce_planner.js`) **unconditionally**. So every beta user who loads the dashboard mints their **own** 5-minute `debouncePlannerEmailRun` trigger on the Central project. Those per-user triggers (a) fail instantly with an authorization error when the owner hasn't authorized the current Central scope set, and (b) read debounce state from `PropertiesService.getDocumentProperties()`, which is **null in a standalone project** — so the feature is **inert in Central** regardless. `ScriptApp.getProjectTriggers()` only returns the caller's own triggers, so the existence check never dedupes across users (duplicates accumulate, one per user).

**Why a code change alone won't quiet the live noise.** The noise comes from triggers **already created** on the Central project. Removing/disabling the create path stops *new* triggers but does not delete existing ones — those only drain when each owning user reloads the app (after a fix is deployed), via manual deletion in the **Triggers UI** (developer's own only — you can't delete other users' triggers), or via Apps Script **auto-disabling** triggers that keep failing.

**Reverted fix (for reference when we resume).** The implemented-then-reverted approach was: in `ensureDebouncePlannerTrigger_()`, when `isCentralModeEnabled_()` is true, **delete the caller's own** `debouncePlannerEmailRun` triggers and **do not create** a new one (self-healing as each user returns); plus a null-guard in `debouncePlannerEmailRun()` so any still-firing standalone trigger no-ops cleanly. Bound-mode behavior unchanged.

**Out of scope (deferred to a real Central design later):** a proper Central planner-email debounce — e.g. `ScriptProperties` (or per-user-email) state instead of `DocumentProperties`, and/or a single owner-owned fan-out timer that iterates mapped users — rather than per-user triggers.

**Next time:** decide between (a) re-applying the reverted self-heal fix + deploying, then deleting/draining existing triggers, or (b) removing the `ensureDebouncePlannerTrigger_()` call from the snapshot path entirely in Central and shipping the real Central debounce design. Either way, plan a one-time cleanup of existing triggers (Triggers UI for owned ones; user revisits / auto-disable for the rest). **Affects family beta:** no data impact; the debounced batched email simply does not function in Central today, and execution-log noise scales with beta-user count.

### Easy wins (quick fixes)

Small HTML/docs/a11y tasks; check off when shipped. *(Unnumbered — pick in any order.)*

- [ ] **Bank Add new — sidebar hint** — Add a short muted note next to the **Add new** form in **`PlannerDashboard.html`** (parity with the web app’s **`Dashboard_Body.html`** info column) so spreadsheet-menu users see the same “where rows go / year block” context.
- [ ] **Bank Add new — DRY inline copy** — On **`Dashboard_Body.html`**, replace the two-paragraph right-column blurb with **one line** plus **Help → Assets** so the canonical detail stays in **`Dashboard_Help.html`**.
- [ ] **Docs — Bank add one-liner** — Add a single bullet to **`PROJECT_CONTEXT.md`** and/or **`SESSION_NOTES.md`**: Assets → Bank Accounts → Add new (INPUT + SYS rows, no full planner on save, run **Run Planner + Refresh Snapshot** after).
- [ ] **Status lines (item 19 sweep)** — Grep for **`setStatus('planner_status', …)`**; move any remaining **panel-specific** errors to the same pattern as Bills Due / Quick add (see **Codebase cleanups → 19** below). Keep truly global init errors on **`planner_status`**.
- [ ] **Help — cross-link to Assets** — In **`Dashboard_Help.html`** **Introduction** or **Overview**, add one sentence with a link to **`#help-assets`** so “create / edit bank accounts” is discoverable from the top of Help.
- [ ] **A11y — Bank mode segment** — For **Update \| Add new**, tighten **`role` / `aria-selected`** (already partly there) with **`aria-controls`** on the tab buttons pointing at the two mode wraps, or a visible **`fieldset` / `legend`**, in **`Dashboard_Body.html`** and **`PlannerDashboard.html`**.

### Important — Activity / HISTORY flow (LOG - Activity vs OUT - History)

**LOG - Activity** = **event** ledger (who/when/amount); dashboard **Remove** is **donation-only** for now (**`deleteActivityLogRow`**); donations may also remove a matching **INPUT - Donation** row. Other event types: greyed UI + delete on the sheet if needed. **Smart undo** for **Quick add** (`quick_pay`) / house expense / bills — phased list below. **OUT - History** = **planner run** snapshots. Implementation: **`activity_log.js`**, **`appendActivityLog_`**, Help **Activity log**.

**Done (recent)**  
- **Phase 3 — Upcoming** — **`upcoming_add`** / **`upcoming_status`** / **`upcoming_cashflow`** in **`upcoming_expenses.js`**; Cash Flow from Upcoming uses **`quickAddPayment`** with **`suppressActivityLog: true`** so **`quick_pay`** is not duplicated; **`quick_add_payment.js`** returns **`activitySnapshot`** for callers.  
- **Phase 4 — House expenses** — **`house_expense`** after **`addHouseExpense`**; if the form also posts to Cash Flow, **`quickAddPayment`** runs with **`suppressActivityLog: true`** so you do not get a second **`quick_pay`** row for the same save. Activity **Type** uses the House Expenses form type (Repair, **Maintenance**, Utilities, etc.; stored **Tax** displays as **Property Tax**).  
- **Activity page UI** — Logged **date range** (from/to on one row in the toolbar), **Payee** contains, **Type** dropdown (options computed from all rows in **LOG - Activity**, same rules as the Type column), **Amount** min/max, sortable table, **20 rows per page** with Previous/Next (**500** matching rows max per Apply; summary notes if truncated). Backend: **`getActivityDashboardData`**.  
- **Debt Planner email** — Short action block (overdue, pay‑now / pay‑soon line items), debts omitted when the current Cash Flow month is already “handled,” definitions in Help **Debt Planner email** (not repeated in the email body).  
- **Assets → Bank Accounts — Add new** — **`addBankAccountFromDashboard`** (**`bank_accounts.js`**): rows on **INPUT - Bank Accounts** (current year block) + **SYS - Accounts**; **`bank_account_add`** on **LOG - Activity**; UI **Update \| Add new**; stable **Bank Accounts** heading; Help **Assets** subsection updated.
- **Assets → Bank Accounts — Final cleanup (SYS row formatting + Priority + activity Amount)** — `appendAccountsRowForNewBank_` (`bank_accounts.js`) now clones neighbor-row formatting (borders, font, number formats, row height) onto newly appended **SYS - Accounts** rows via a new `findAccountsTemplateRow_` helper + `PASTE_FORMAT`, matching the Investments pattern. New **Priority** field (`<input type="number">`, range **1–99**, default **9**) on the Add form in both `Dashboard_Body.html` and `PlannerDashboard.html`; `createBankAccount` validates and sends it; `addBankAccountFromDashboard` writes it to the canonical **SYS - Accounts → Priority** column consumed by `planner_core.js → normalizeAccounts_` (no schema change to **INPUT - Bank Accounts**, which has no Priority column). `bank_account_add` removed from `activityLogIsNonMonetaryEvent_` so **Amount** now shows the supplied opening balance in **LOG - Activity** (or $0.00 when none was provided); `bank_account_deactivate` stays non-monetary with Amount as **—**. Help, `PROJECT_CONTEXT.md`, and `SESSION_NOTES.md` updated.
- **Assets → Bank Accounts — Stop tracking + Active + UX parity** — **`deactivateBankAccountFromDashboard`** (**`bank_accounts.js`**): flips **Active = No** on every **INPUT - Bank Accounts** row across year blocks (self-heals the Active column at col 14 per block) + mirror **SYS - Accounts** row; preserves month history, Available Now, Min Buffer, Type, Use Policy, and reserves the name. **`bank_account_deactivate`** on **LOG - Activity** (Type: **Bank**, Action: **Tracking stopped**, Amount: **—**). UI is a secondary **Stop tracking** button in **Update** mode on web + sidebar with inline confirm; Add-new Type is a controlled `<select>` populated from existing **SYS - Accounts** types; inline name-error slot replaces popups; create/stop flows show action-specific status text ("Creating bank account…" / "Stopping tracking…"). Inactive accounts drop out of the Bank Account dropdown via shared `getInactiveBankAccountsSet_` (blank / missing / unknown = active for backward compatibility). Active writes inherit row formatting via `writeActiveCellWithRowFormat_` (retrofitted into the add-account writers too). Help **Bank Accounts** + **Bank Accounts Stop tracking** subsections updated.
- **Assets → House Values — Add new** — **`addHouseFromDashboard`** (**`house_values.js`**): rows on **INPUT - House Values** (Loan Amount Left in col 2) + **SYS - House Assets** (neighbor row formatting copied), plus auto-creation of **HOUSES - {House}** with canonical headers + column widths copied from an existing HOUSES sheet; transactional rollback on any write failure. **`house_add`** on **LOG - Activity** (Type: **House Expenses**, Action: **House added**). UI **Update \| Add new** on web + sidebar; inline **`.field-error`** under the House name field for duplicate/invalid names (focuses + selects). **Properties → House Expenses** selector refreshes on every tab nav (`Dashboard_Script_Render.html`), so new houses are usable immediately. Help **Assets → House Values**, **Activity log**, **Properties**, **HOUSES sheet**, and **Sheet names** sections updated.
- **Assets → House Values — Stop tracking (soft sale)** — **`deactivateHouseFromDashboard`** (**`house_values.js`**): flips **Active = No** on every **INPUT - House Values** row for the house across all year blocks (canonical source; self-heals the Active column per block) and mirrors the same flag on **SYS - House Assets**. Preserves history (month values, Loan Amount Left, Current Value, Type) and the **HOUSES - {House}** sheet; name stays reserved so it can't be reused. **`house_deactivate`** on **LOG - Activity** (Type: **House Expenses**, Action: **Tracking stopped**, Amount: **—**). UI is a secondary **Stop tracking** button in **Update** mode on web + sidebar with an inline confirm; on success, the Update dropdown, House Expenses selector, and Property Performance rows/cards drop the house immediately via the shared `getInactiveHousesSet_` rule (reused by `getHouseUiData`, `getHouseExpenseUiData`, and now `getHouseNamesFromHouseAssets_` in `property_performance.js`). New **Yes / No** writes inherit row text formatting via `writeActiveCellWithRowFormat_` (retrofitted into the add-house writers too). Help **House Values → Stop tracking**, **Activity log**, and **Property performance → Active houses only** sections added.
- **Planning → Debts — Consistency pass: Active + Add new + Stop tracking** — **`addDebtFromDashboard`** / **`deactivateDebtFromDashboard`** (**`debts.js`**) on the canonical **INPUT - Debts** sheet only (no `SYS - Debts` mirror). Self-healing `Active` column via `ensureDebtsActiveColumn_`; `TOTAL DEBT` summary row is never stamped/touched and is rejected as a reserved name on Add. Shared active rule: explicit `No / n / false / inactive` = inactive; blank / missing / unknown = active; legacy fallback (`balance > 0 || minPayment > 0`) used only when the Active column is absent. Duplicate-name validation spans active + inactive debts via `getAllDebtAccountNamesIncludingInactive_`. New rows inherit neighbor row formatting (borders/font/number formats/row height) via `findDebtTemplateRow_` + `PASTE_FORMAT`; Active cell written via `writeActiveCellWithRowFormat_`. Filtered readers now skip inactive debts: `getDebtsUiData` / `getDebtRows_`, `planner_core.js → normalizeDebts_` (so Rolling Debt Payoff waterfall, HELOC gate, focus/next-debt, payment windows, and liability summary), `dashboard_data.js` (`sumDebtBalances_`, `getHighUtilizationDebtIssues_`, `getDebtBillsDueRows_`, `getDebtPayeeMap_`), `quick_add_payment.js` (`adjustDebtsBalanceAfterQuickPayment_`, `resolveFlowSourceFromBillOrDebt_`). `activity_log.js → buildActivityKindLookup_` intentionally does NOT filter by Active so historical `quick_pay` / bill rows keep their **Debt** classification after a debt is stop-tracked. New activity events: **`debt_add`** (Type **Debt**, Action **Account added**, Amount = opening balance or 0) and **`debt_deactivate`** (Type **Debt**, Action **Tracking stopped**, Amount **—**; added to `activityLogIsNonMonetaryEvent_`). UI parity with Bank Accounts / Investments / House Values: `Dashboard_Body.html` Debts panel is a segmented **Update | Add new** switch with a secondary **Stop tracking** button in Update mode; inline name-error slot; action-specific status text ("Creating debt account…" / "Stopping tracking…"). Sidebar `DebtsUI.html` stays update-only (inactive debts auto-drop via filtered `getDebtsUiData`). Help **Planning → Debts** subsections and Activity bullets updated.

**Still open**  
- **Phase 5 (optional)** — Correlate events to **OUT - History** / planner run.  
- **Optional:** Activity **CSV export**; **last N events** on Overview; **onEdit** logging for manual Cash Flow typing.

**Pattern (reference)**  
- Audit after successful writes; log rows removable from UI for mistakes; deeper “reverse transaction” only when phased preconditions are met. **v1:** script-driven paths. **Later:** onEdit, etc.

| Flow | Status |
|------|--------|
| Quick add | **Done** — `quick_pay` at end of **`quickAddPayment`**. |
| Bills Due → Skip | **Done** — **`skipDashboardBill`**. |
| Bills Due → Autopay | **Done** — dedupe key on refresh. |
| Bills → Pay (Flow Source) | **Done** — new Cash Flow rows populate **Flow Source** from **INPUT - Bills.Payment Source**, with server-side fallback (`resolveFlowSourceFromBillOrDebt_`) + case/whitespace-tolerant header lookup. |
| Manage bills → Add bill | **Done** — `bill_add` after **`addBillFromDashboard`** (`bills.js`); Category required. |
| Manage bills → Edit bill | **Done** — `bill_update` after **`updateTrackedBillFromDashboard`** (`bills.js`); reuses the Add form in dual-mode; Payee / Default Amount / Due Day / Frequency / Payment Source / Category / Autopay / Varies / Notes; refuses inactive rows; in-place write (no row move); no-op saves return *No changes.* without logging. |
| Manage bills → Stop tracking | **Done** — `bill_deactivate` after **`deactivateBillFromDashboard`** (`bills.js`); sets **Active = No** on INPUT - Bills, shows **—** in Activity Amount. |
| Upcoming expenses | **Done** — Action-model cleanup: Upcoming is now an open-obligations board. Status is display-only (`Planned` / `Paid` / `Dismissed`; legacy `Skipped` sorts/filters the same as `Dismissed`); two actions per row — **Quick add payment** (single payment path, opens Quick Add with payee / due date / **remaining amount** / optional `CASH` / `CREDIT_CARD` flow-source hint pre-filled) and **Dismiss** (soft-deactivate preserving the row). Partial payments decrement the `Amount` column and keep the row on the board; full payments clamp remaining to 0, flip Status → `Paid`, and drop the row off the active board. `applyPaymentToUpcomingExpense` is called by `savePayment` after a successful Quick Add when `window.__pendingUpcomingPaymentId` is set. Activity: `upcoming_add` (monetary original planned amount), `upcoming_payment` (**non-monetary** audit trail — the money row is the paired `quick_pay`), `upcoming_status` (Dismiss), legacy `upcoming_cashflow` still rendered but no longer emitted. Action labels: **Upcoming added** / **Applied $X.XX (Remaining $Y.YY)** or **Applied $X.XX (Fully paid)** (falls back to **Payment applied** for legacy rows) / **Dismissed** / **Pushed to cash flow**. Retired: `updateUpcomingExpenseStatus`, `markUpcomingExpensePaid_`, `addUpcomingExpenseToCashFlow`, and the client's `setUpcomingStatus` / `addUpcomingToCashFlow` / `openUpcomingInQuickPayment`. |
| House expenses | **Done** — **`addHouseExpense`** → `house_expense`; CF via **Quick add** + **`suppressActivityLog`**. |
| Bank Accounts → Add new | **Done** — `bank_account_add` after **`addBankAccountFromDashboard`** (`bank_accounts.js`); INPUT + SYS rows (with `Active = Yes` stamped via `writeActiveCellWithRowFormat_`); Type is a controlled `<select>` from existing **SYS - Accounts** types; **Priority** numeric input (1–99, default 9) writes the canonical **SYS - Accounts → Priority** column; new **SYS - Accounts** rows inherit neighbor row formatting (borders/font/number formats/row height) via `findAccountsTemplateRow_` + `PASTE_FORMAT`; does not re-run full planner. **Amount in LOG - Activity** now shows the opening balance when provided (or $0.00 when blank) — no longer rendered as —. |
| Bank Accounts → Stop tracking | **Done** — `bank_account_deactivate` after **`deactivateBankAccountFromDashboard`** (`bank_accounts.js`); sets **Active = No** on every **INPUT - Bank Accounts** row across year blocks (self-heals the Active column per block at col 14) + mirror **SYS - Accounts**; preserves month history, Available Now, Min Buffer, Type, Use Policy, Priority, and reserves the name. Inactive accounts drop out of the Bank Account dropdown via `getInactiveBankAccountsSet_` (shared rule). Amount shows **—** in Activity. |
| House Values → Add new | **Done** — `house_add` after **`addHouseFromDashboard`** (`house_values.js`); INPUT + SYS rows + auto-created **HOUSES - {House}** sheet (canonical headers + column widths copied from an existing HOUSES tab); transactional rollback on partial failure. |
| House Values → Stop tracking | **Done** — `house_deactivate` after **`deactivateHouseFromDashboard`** (`house_values.js`); sets **Active = No** on every **INPUT - House Values** row (across year blocks) + mirror **SYS - House Assets**; preserves history + **HOUSES - {House}** sheet + name reservation. Inactive houses filtered out of House Values dropdown, House Expenses selector, and Property Performance via shared `getInactiveHousesSet_`. Amount shows **—** in Activity. |
| Investments → Add new | **Done** — `investment_add` after **`addInvestmentAccountFromDashboard`** (`investments.js`); INPUT - Investments row in the current-year block (with self-healed `Active` column) + mirror **SYS - Assets** row with neighbor-row formatting + optional month-seeded starting value; Type is a controlled `<select>` from existing **SYS - Assets** types. Transactional rollback on any write failure. Duplicate-name validation spans all year blocks (active + inactive) and SYS. Activity Type: **Investment**, Action: **Account added**. |
| Investments → Stop tracking | **Done** — `investment_deactivate` after **`deactivateInvestmentAccountFromDashboard`** (`investments.js`); sets **Active = No** on every **INPUT - Investments** row across year blocks + mirror **SYS - Assets**; preserves month history, Current Balance, Type, totals / delta, and reserves the name. Inactive accounts drop out of the Investment Account dropdown via `getInactiveInvestmentsSet_` (shared rule). Amount shows **—** in Activity. |
| Debts → Add new | **Done** — `debt_add` after **`addDebtFromDashboard`** (`debts.js`); appends a row to **INPUT - Debts** only (no `SYS - Debts` mirror) with `Active = Yes` stamped via `writeActiveCellWithRowFormat_`; neighbor-row formatting inherited via `findDebtTemplateRow_` + `PASTE_FORMAT`; `Acct PCT Avail` recomputed; `TOTAL DEBT` rejected as reserved; duplicate check spans active + inactive. Amount shows opening balance (or $0.00 when blank) in Activity. |
| Debts → Stop tracking | **Done** — `debt_deactivate` after **`deactivateDebtFromDashboard`** (`debts.js`); sets **Active = No** on the matching **INPUT - Debts** row only (never deletes, never renames, never touches `TOTAL DEBT`). Inactive debts drop out of the Debts dropdown (web + sidebar), `planner_core.js → normalizeDebts_` (Rolling Debt Payoff waterfall / HELOC gate / focus/next-debt / payment windows), Debt Overview, Bills Due debt matching, Quick add Flow Source inference, high-utilization issues, and debt-balance totals via the shared explicit-wins-with-fallback rule. Historical activity classification is intentionally preserved. Amount shows **—** in Activity. |

**Phased rollout**  
1. **Phase 1 — Quick add** (`quick_pay`) — **Done**  
2. **Phase 2 — Skip + autopay** — **Done**  
3. **Phase 3 — Upcoming** — **Done**  
4. **Phase 4 — House expenses** — **Done**  
5. **Phase 5 — OUT - History tie-in** — **Open** (optional)  
6. **Activity UI** — **Done** (filters, type from sheet, paging, sort); **CSV export** optional later

### Activity — Smart undo / “reverse transaction”

**Context:** Activity **Remove** always deletes the **LOG - Activity** row. **Phase 1 (donation)** is **implemented**: see **`tryDeleteDonationRowForActivityUndo_`** in **`donations.js`** and **`deleteActivityLogRow`** in **`activity_log.js`**. Phases 2–4 below are still optional follow-ons.

**Fool-proof principles (apply to any phase)**

1. **No guessing** — Never infer missing prior state (e.g. cell value before a skip wrote `0`); only use what was stored in log **Details** (consider `detailsVersion` if shape evolves).
2. **Precondition gate** — Before mutating INPUT/SYS: e.g. current cell **===** logged `newValue` (with same rounding rules as writes); donation row still matches a **fingerprint** of logged fields + `sheetRow`.
3. **UX** — Keep **Remove log only**; add a **separate** explicit action for “Reverse transaction and remove log” with a **second** confirmation listing exact sheet / row / cell / values.
4. **Idempotent / safe failure** — If the sheet changed since the log row was written, **abort** with a clear message (no partial silent fixes).
5. **Audit** — Prefer explicit success text listing what changed; optional future `activity_undo` log row if you want a paper trail.

**Phased implementation (in order)**

| Phase | Event type(s) | Risk | What it entails |
|-------|----------------|------|------------------|
| **1 — Done** | **`donation`** | **Lowest** | **Shipped:** Details carry **`sheetRow`** + fingerprint fields; **`deleteActivityLogRow`** calls **`tryDeleteDonationRowForActivityUndo_`** when safe, then deletes the log row. Older donation logs without **`sheetRow`** only remove the log line. |
| **2** | **`quick_pay`** | Medium | Details must include **`previousValue` / `newValue`** (and stable CF sheet + row + month resolution). Reverse **only if** current cell matches logged `newValue`. Debt balance change: undo only if Details allow **verification** of post-state, or **exclude** from v1 and document manual **INPUT - Debts**. |
| **3** | **`house_expense`** | Higher | Log must store house sheet, inserted row, and if CF was touched the same previous/new gates as Phase 2. Dual preconditions. |
| **4** | **`bill_skip` / `bill_autopay`** | High until logging fixed | **First** extend writers to log **previousValue**, **newValue**, and coordinates; **then** same cell-match reversal as Phase 2. **Do not** ship auto-undo for these without that logging. |

**Explicit non-goals**

- Generic undo from payee + amount + date alone.
- “Subtract logged amount from current cell” without proving current value still equals logged **newValue**.

**Activity Remove — dashboard scope (temporary)**  
- **Remove** in the web UI is **enabled only for `donation`** rows (`eventType` **donation**). Other types show a **greyed-out** control; **`deleteActivityLogRow`** rejects non-donation with a clear error (sheet-only delete still works). **Re-enable per type** as Phases 2–4 ship: set **`quick_pay`**, **`house_expense`**, then skip/autopay after logging upgrades—each needs UI enable + server gate + undo implementation.

---

### Next big item — Planning: Debt payoff projection (“path out of debt”)

**Status — Shipped (split into two Planning tabs).** The original scope landed as two products: **Debt Overview** (read-only reference view, renamed from the earlier working name "Payoff Path") and **Rolling Debt Payoff** (monthly decision engine with Standard / Details modes, narrative decision card, HELOC advisor, Payment result table with `[Add payment]` → Cash Flow → Quick add, and the "Why not more?" explainer). See **Help → Debt Overview** and **Help → Rolling Debt Payoff**, plus **SESSION_NOTES.md § Rolling Debt Payoff: Standard-mode UX sweep**. The design notes below are kept for historical context.

**Intent:** One **Planning** tab with **real projections** grounded in **sheet data**: **INPUT - Debts** (balances, APRs, minimums, active flags) plus **INPUT - Cash Flow** across **2025 / 2026** (and later years) to infer **typical payment pace** toward debt-linked payees. **Simulation** on top: **“If I pay $X more per month to account Y, how does the story change?”** (timeline, interest, ordering). **Read-only** for early phases — no writes to INPUT from this feature until explicitly scoped. Complements **Run Planner** (now-centric) with a **trajectory** view.

**Why Cash Flow over OUT - History for pace:** **OUT - History** is sparse (per planner run). **INPUT - Cash Flow** month columns hold **realized** payments — better for **median / typical** paydown and variability. **OUT - History** stays an **optional** default or sanity check, not the primary source.

**Caveats:** Revolving assumptions (no new charges, simplified interest/minimums), **payee → debt** mapping via alias rules, **scenario math** — document in Help.

#### Where it fits in the planner (UI)

**Planning → fourth tab** (“Payoff path” / “Debt projection”) — **`Dashboard_Body.html`** `#page_planning`, **`Dashboard_Script_PlanningDebtPayoff.html`**, **`PlannerDashboardWeb.html`** include. Optional: Overview link to this tab.

#### Data inputs (by role)

| Role | Source | Use |
|------|--------|-----|
| **Levels / rates** | **INPUT - Debts** + **`normalizeDebts_`** / alias map | Starting balances, APR, minimums, allocation |
| **Historical payment pace** | **INPUT - Cash Flow** (per-year sheets, e.g. 2025–2026) | Aggregate per month for lines mapped to debts; derive **typical monthly $** + date range for provenance |
| **Optional** | **OUT - History** | Fallback when CF coverage is thin |

#### Backend shape (stable core)

1. **`simulateDebtPayoffSchedule_(normalizedDebts, monthlyTotalToDebt, strategy, options)`** — month loop; minimums + extra (**avalanche** / **snowball** / **minimum-only**); accrue interest (document simplification); cap months (e.g. 600) and payload size.
2. **`getDebtPayoffProjection(payload)`** — load debts, run simulator, return JSON `{ summary, byMonth[], perDebtPayoffMonth, … }`; payload selects **manual** vs **inferred** monthly total when Phase 2 exists.
3. **Phase 2+** — **`inferDebtPaymentPaceFromCashFlow_(ss, years, aliasMap)`** (name TBD): roll Cash Flow rows into mapped buckets → **median** (or trimmed) monthly payment + metadata for UI (“Based on CF **…**”).

#### Phased delivery — **start Phase 1** to see shape end-to-end

| Phase | Scope | Purpose |
|-------|--------|---------|
| **1 — Core sim + shell** | Fourth tab + **`getDebtPayoffProjection`** + **manual** monthly $ to debt + strategy + **Run projection** → table + summary (payoff month per account, approximate interest, debt-free month). **`debt_payoff_projection.js`** (split with **`planner_core.js`** as needed). Help stub. | **Visible vertical slice** without CF ingestion. |
| **2 — Real sheet defaults** | Infer pace from **2025/2026** (configurable) **INPUT - Cash Flow**; default monthly $ with **override**; **provenance** + low-coverage warning. | **Projections tied to actual payments.** |
| **3 — Outlined plan** | Milestone narrative from the same schedule object the table uses (single source of truth). | Readable “plan” beside numbers. |
| **4 — What-if** | +$X/mo to account **Y** vs baseline; **delta** (months, interest, outline). | Show how paying more changes the story. |
| **5 — Polish** | Chart, CSV, optional OUT - History line for defaults, edge rules (promo APR, HELOC) if needed. | Depth. |

**Order:** Engine + UI **first** (Phase **1**); then **real data** ( **2** ), **outline** ( **3** ), **simulation** ( **4** ).

**Frontend:** Reuse **`fmtCurrency`**, **`setStatus`**, Planning patterns; extend controls after Phase 1.

**Testing / docs:** **`TESTING_PLAN.md`** (avalanche/snowball, inactive, zero APR, **sparse CF**); **`PROJECT_CONTEXT.md`** when Phase 1 ships; **`SESSION_NOTES.md`** per phase.

**Explicit non-goals (early phases):** Auto-posting results to Cash Flow / **INPUT - Debts**; full issuer minimum engines.

**Related code:** **`code.js`** (`runDebtPlanner`, `buildUpcomingPayments_`); **`planner_core.js`** (`normalizeDebts_`); **`readCashFlowSheetAsObjects_`** / year tabs; **`Dashboard_Script_PlanningDebts.html`**; **`PlannerDashboardWeb.html`** includes.

---

### Rolling debt payoff (new Planning tab — separate from Debt Overview)

**Status — Shipped.** Now the **Rolling Debt Payoff** Planning tab (sibling to **Debt Overview**, which was the working name "Payoff Path" in this design note). Implementation lives in `components/RollingDebtPayoffDashboard.tsx` → `RollingDebtPayoffDashboardBundle.html`. Standard-mode UX (Cash-to-use-now, Decision card, HELOC card, Payment result table with **Small balance / Focus debt / Next debt / Excess** roles and **Paid off (this month) / Partially paid** actions, per-row **[Add payment]** → Cash Flow → Quick add, "Why not more?" breakdown → Cash Flow → Upcoming) and a single **Show details** toggle for the full planner output. The locked defaults below were preserved end-to-end; see **Help → Rolling Debt Payoff** and **SESSION_NOTES.md**. Historical design notes kept below.

**UI:** New sub-tab **next to** Debt Overview: **“Rolling debt payoff”** — own panel + script + server function; do **not** merge with Debt Overview.

**Locked defaults (implementation)**

1. **Mortgage / loan cash out vs debt mins**  
   - **Required expenses:** **INPUT - Cash Flow** Expense lines = source of truth for **actual cash out** (including mortgage/loan payments if present that month).  
   - **Minimum debt payments:** from **INPUT - Debts** only — **metadata / strategy context** in output; **do not add** to total required expenses (no double count).  
   - If CF has the mortgage/loan payment for that month, that amount is the required expense for that cash out.

2. **Stable vs variable rent**  
   - **Stable (recurring rent):** `Rent Mo House`, `Rent Oakley House - Section 8`, `Rent Oakley House - Tenant Part 1`, `Rent Oakley House - Tenant Part 2`, `Rent Oakley House - Tenant Part 3`, `Rent San Diego House`, `Rent MN House`.  
   - **Variable / non-recurring:** `Deposit San Diego House`, `Rent Oakley House - Section 8 Extra`, one-time catch-up rent, late fees, reimbursements, deposit-related amounts.  
   - **Tahoe:** do **not** treat as rent unless explicit Tahoe rental income is added later.

3. **San Jose low-rate “keep last”**  
   - Exact **INPUT - Debts** account name: **`Loan Depot - San Jose House`**.  
   - Add debts helper **`Priority Class`** (or equivalent): auto **`LOW_RATE_KEEP_LAST`** when account name is `Loan Depot - San Jose House` **or** APR **≤ 2.25%**.

4. **Minimum cash reserve**  
   - Default **`100000`**.  
   - Target: **assumptions/config sheet**; until it exists, **hardcode 100000** with a single constant / TODO to migrate to config.

5. **First month anchor**  
   - **Not** system date: anchor = **latest month column present** on **INPUT - Cash Flow** (e.g. `Apr-26` → that month is “this month”; next projected month is `May-26`).

6. **Credit card spend spike**  
   - **Primary:** per CC payee (match debt/card payees): current month vs **trailing 6-month median** for that payee — spike if **> 150%** of median **and** **≥ $500** above median.  
   - **Fallback** if **&lt; 3** months history: total CC spend vs **trailing 3-month average** of total CC — spike if **> 125%** of that average.  
   - **Portfolio:** total monthly CC spend **> 130%** of trailing 6-month median of **total** CC spend.  
   - Prefer distinguishing **new card spend** vs **payments**; if only net cash out, use expense as card cash out but **label confidence lower**.

8. **Credit card spend estimation (critical)**  
   - **Problem:** CF expense lines for cards may be **payments**, not true new spend.  
   - **If statement balance data exists:**  
     `New Spend = Current Statement Balance − Previous Statement Balance + Payments`  
   - **If only payments exist (no balance tracking):** treat CF card expense as **cash out**, **not** true spend; set **`credit_card_spend_confidence = LOW`**.  
   - **Optional:** track monthly card balances in a **separate table** for accurate spend.  
   - **Planning:** never assume **payment = overspending** automatically; **spike detection = warning**, not a hard constraint.

9. **RSU / stock income smoothing**  
   - **Do not** treat RSU as stable income; tag RSU / stock sales as **variable**.  
   - **RSU monthly baseline** = trailing **12-month average** of RSU sales (for projection context only).  
   - **Base plan:** ignore RSU baseline (**conservative**).  
   - **Projection (optional):** may include **50%** of RSU baseline.  
   - **Label:** `RSU income confidence = MEDIUM` (depends on company / vesting).

10. **Irregular expense smoothing**  
   - For any expense category: if **monthly value > 2× trailing 6-month median** → classify **irregular spike**.  
   - **Smoothed monthly expense** = **median of last 6 months** (use for **forward projections**).  
   - **Keep actual** value in historical / audit trail.  
   - **Examples:** Federal taxes, property taxes, large maintenance, one-time travel.

11. **Rental income normalization**  
   - **Per rental:** trailing **3-month average** rent.  
   - If **variance > 20%**, mark rental **unstable**.  
   - **Planning:** use **lower of** (trailing 3-month average, last known stable rent).  
   - **Confidence:** Section 8 rent = **HIGH**; market rent (San Diego, MO, etc.) = **MEDIUM**.

12. **Cash buffer accuracy**  
   - **Total cash** = all liquid accounts.  
   - **Available cash** = Total cash − **reserved buckets** (earmarked taxes, repairs, etc.).  
   - If reserved buckets **not** tracked: **`Available Cash = 85%` of total cash** (conservative haircut).  
   - **Planning:** use **Available cash** for decisions, not total cash.

13. **Debt paydown accuracy**  
   - If sheet balances **updated:** use directly.  
   - If **not:** estimate  
     `New Balance ≈ Prior Balance − Principal portion of payment`  
   - If principal unknown:  
     `Principal ≈ Payment − (Balance × APR / 12)`  
   - Mark **estimated balances** = **MEDIUM** confidence.

14. **Monthly plan stability guardrail**  
   - **Do not** shift long-term trajectory on **one** good/bad month.  
   - Require **2–3 consecutive** months of signal before adjusting projection / trajectory.  
   - **Example:** one bad month → ignore for projection shift; three bad months → adjust plan.

15. **San Diego property monitoring**  
   - **Monthly loss** = expenses − rent (per agreed definitions).  
   - If **trailing 6-month average loss > $1,500/month** → trigger **`REVIEW`**.  
   - If loss **persists 12 months** **and** **appreciation < 3%** → trigger **`CONSIDER_SALE`** (advisory only; **do not** force).

16. **Confidence scoring**  
   - Each **major number** in the plan should carry a **per-field confidence**: `HIGH` | `MEDIUM` | `LOW`.  
   - **Defaults by category:**  
     - **HIGH:** salary / payroll, mortgage payments (from CF as agreed), Section 8 rent.  
     - **MEDIUM:** market rent, RSU (and similar) **smoothed averages**, estimated loan balances when not sheet-updated.  
     - **LOW:** credit card “spend” when **no** statement balance data (payment-only / net cash out), highly irregular expenses.  
   - **Output:** include an **`overall_plan_confidence`** (aggregate score or label, e.g. weighted or worst-of-critical-path — **define in implementation** with a short rubric in Help) so the UI and JSON show how much to trust the month’s recommendations.

**Income buckets**

- **Variable income:** RSU sales, ESPP sales, bonus, tax refunds, other stock sales.  
- **Stable income:** **Cisco regular pay** + **recurring rents** (list above) only.

**Lump-sum split (variable inflows)**  
- **50%** debt · **30%** reserve/cash · **20%** flexible (configurable later).

**Extra debt payoff order (after CCs cleared by highest APR)**  
1. HELOC  
2. Tahoe mortgage  
3. San Diego mortgage  
4. MO mortgage  
5. San Jose mortgage **last** (`Loan Depot - San Jose House` / `LOW_RATE_KEEP_LAST`)

**Property stance**  
- **San Diego:** **HOLD / REVIEW** — flag persistent negative cash flow; **do not** force sale.  
- **Tahoe:** **protected lifestyle asset** — do **not** recommend sale.

**Output shape (reminder):** executive summary, **12-month** detail table, **84-month** roll with lighter long-range + annual debt totals, alerts/triggers, suggested actions, **per-field confidence** + **`overall_plan_confidence`**, **machine-readable JSON** (see prior chat schema).

---

### Consider — Bank / card / loan sync (Plaid or similar)

**Question:** How hard is it to hook **Plaid** (or **Finicity**, **MX**, **Yodlee**, etc.) into this app so **bank, credit card, and loan balances** land directly in the workbook / dashboard?

**Context (today’s stack):** **Google Sheets** is the system of record; **Apps Script** reads **`ACCOUNTS`**, **`DEBTS`**, **`BANK_ACCOUNTS`** / year blocks (`readSheetAsObjects_`, `bank_accounts.js`, `dashboard_data.js`, `runDebtPlanner` in **`code.js`**). Any aggregator should **still end by writing normalized rows** into those tabs (or a **staging** tab + merge) so the **rest of the planner stays unchanged**.

#### Short answer

**Not “drop-in easy” in Apps Script alone.** These APIs expect a **backend you control** that holds **`client_id` / `secret`**, creates **link tokens**, exchanges **public_token** for **access_token**, and optionally handles **webhooks**. That does not map cleanly to “only GAS + spreadsheet” because:

- **Secrets** must not live in the browser; **Script Properties** help in GAS, but you still need a **safe Plaid Link** flow and **token lifecycle** (refresh, revoke). **Webhooks** want an always-on HTTPS endpoint — awkward for GAS unless you add another service.
- **Plaid Link** runs in the **browser**; your dashboard is **HtmlService** — doable, but the real work is **Link → bridge → Sheets**, not a single REST call from the sheet.

**Practical shape:** **moderate effort with a small bridge service**; **high effort** if you insist on **100% Apps Script** with no other infra and production-grade behavior.

#### Architecture that fits this app

1. **Tiny backend** (common choices: **Node** on **Cloud Run**, **Cloud Functions**, **Firebase**) — stores Plaid secrets; implements e.g. **`/api/create-link-token`**, **`/api/exchange-token`**, optional **`/webhooks/plaid`**.
2. **Web dashboard** — loads **Plaid Link** (JS), receives **`public_token`**, sends it to the bridge; bridge stores **`access_token`** keyed to **user id** (not in the spreadsheet).
3. **Sync job** — schedule or **“Sync balances”** button: bridge calls **Plaid** (balances / liabilities), **maps** institutions → your **`Account Name`** / debt rows, **writes** via **Google Sheets API** *or* calls an **Apps Script web app** `doPost` with a shared secret (weaker pattern; document risk).

Apps Script can stay **consumer-only** (reads sheet after sync) or **orchestrator** that calls the bridge with **`UrlFetchApp`** + **Script Properties** (`BRIDGE_URL`, `BRIDGE_API_KEY`).

#### Effort rough cut

| Approach | Difficulty | Notes |
|----------|------------|--------|
| **Manual / CSV / OFX** | Low | No aggregator; bank export → import. |
| **Plaid + small bridge + sheet writes** | **Medium** | Usual “right” first production shape; mapping + secrets + Link + one sync path. |
| **Plaid entirely in GAS** | Medium–high | Secrets + Link + refresh + errors in one place; webhooks harder; tighter security review. |
| **Full bidirectional + reconciliation UI** | High | Payee matching, duplicates, pending vs posted, multi-currency, liability fields vs custom **DEBTS** columns. |

#### Product / risk notes

- **Matching** — Plaid names **≠** your **`ACCOUNTS`** / **`DEBTS`** labels; need a **mapping table** (e.g. Plaid `account_id` → sheet row) and **merge rules** (overwrite balance only vs full row).
- **Liabilities** — Plaid **liabilities** help for cards; **loans** may still need **manual** planner fields (min payment rules, promo APR) unless you invest in normalization.
- **Compliance** — Provider **developer agreement**, **use case** review, **data retention**; not “just an API key.”
- **Multi-user** — Single household today is simpler; **per-user tokens** + auth is a large scope jump.

#### Alternatives to Plaid (same problem space)

- **Spreadsheet-first aggregators** (e.g. Tiller-style) that already write to Google Sheets.
- **Bank “export to Sheets”** or scheduled **CSV** import — low tech, no aggregator contract.
- **Finicity / MX / Yodlee** — same class: still want a **bridge** pattern and mapping.

#### Bottom line (planning)

Treat **aggregator → Sheets** as a **small sidecar + mapping layer**; keep the app **sheet-driven**. Reasonable to design and estimate; **not a trivial Apps Script–only weekend** if you want it **safe and maintainable**.

---

### Product / testing

**Car expenses (dedicated sheet today)**  
- **Open — design only for now:** Vehicle costs live on **their own sheet** in the workbook (not yet first-class in the web dashboard like **HOUSES - …** / house expenses). **Decide later:** integrate into the app (which nav tab, mirror house-expense pattern, tie to Cash Flow or not), keep as sheet-only with optional **LOG - Activity** later, or fold into another category. Capture requirements before building.

1. Subscriptions

3. Income/Expense Classification

4. Recurring Payments

6. Add ability to add new cards/loans etc to Debts Pages

7. ~~Add new bills to INPUT - Bills~~ — **Done.** Cash Flow → **Bills** → **Manage bills** → **Add bill** writes to **INPUT - Bills** via **`addBillFromDashboard`** (`bills.js`). Required: Payee, Category, Due Day, Default Amount, Payment Source. **Stop tracking** sets **Active = No** (never deletes). Activity events: **`bill_add`** / **`bill_deactivate`**. Header lookup is case/whitespace tolerant; missing optional columns (Payment Source, Category, Frequency, Start Month, Notes) are auto-added before write. See **SESSION_NOTES.md § Bills page: Manage bills, Flow Source, header tolerance**.

8. Cleanup the Debts/Bills sheets now that we have the other stuff
   - Only Debts should be here and other move to Bills

10. ~~On the Debt update page we should update the screen on the bottom and right like we did for **Quick add**~~ — **Done.** Planning → Debts → Update now shows a proper `Saving…` → `Saved.` status row below the button (same pattern as Quick add), optimistically repaints the right-hand info panel with the saved value, refreshes the Overview snapshot, and kicks off the debt planner as a silent background RPC so the save feels instant while Rolling Debt Payoff catches up shortly after. Also logs every field edit to **LOG - Activity** as a new `debt_update` event with a dynamic action label (e.g. *Updated Account Balance to $54,000.00*), classified as **Debt**, amount `—`, and previous / new values preserved in the event details JSON. Server-side `updateDebtField` no longer runs the planner inline. See **SESSION_NOTES.md § Debts — fast save + activity log + background planner** and Help **Activity log → `debt_update`**. Shipped in `c26c11c`.

12. On Upcoming bills additions - Few changes
   - Bring a list of categories from a pull down menu
   - A2. If other - provide a field to add your own
   - B. Acount/Source
   - Make it a pull down from the list of Accounts or Credit Cards

13. We should split credit card into 2 parts
   - Normal ones I can use for everything
   - Merchant Specific like HD/Lowes/Macys etc…

14. tune loans/HELOC (principal vs interest, or partial paydown rules) to reduce from Debts

15. Need to hook up Tax workflow into the system

### Codebase cleanups (do over time)

Technical debt and consistency work suggested from repo review; no rush—pick off incrementally.

16. **Two dashboards** — `PlannerDashboardWeb` + modular `Dashboard_*` is canonical (`doGet`). `PlannerDashboard.html` is sidebar HTML from the spreadsheet menu. Decide: Web-only maintenance, or one shared source of scripts/styles so fixes aren’t duplicated.

19. **Status / `planner_status` audit** — After Bills Due → `bills_due_status`, move remaining global status to panel-specific elements where it makes UX sense. **Inventory (repo scan — update if code moves):**
   - **`Dashboard_Body.html`** — Markup: `#planner_status` container in the top bar (no `setStatus` here; anchor for all writers).
   - **`Dashboard_Script_Render.html`** — `runPlannerNow`: `setStatusLoading` / `setStatus('planner_status', …)` for planner run (success/error). *Expected:* stays near **Run Planner** in top bar.
   - **`Dashboard_Script_BillsDue.html`** — **Done:** `loadBillsDueUi_` **failure** → `bills_due_status` when `getBillsDueFromCashFlowForDashboard` fails.
   - **`Dashboard_Script_Payments.html`** — **Done:** `runDebtPlannerAfterQuickPayment_` failure → `pay_status` for `runDebtPlanner` errors.
   - **`PlannerDashboardWeb.html`** — `window.onerror` and `initDashboard` catch → write to `planner_status` (global init/JS errors). *Reasonable to keep global.*
   - **`PlannerDashboard.html`** (sidebar) — same pattern if still maintained (`TODO` item 16).

20. **Large `dashboard_data.js`** — Optional long-term split by feature (bills, snapshot, etc.) behind stable exported function names if that file keeps growing.

21. **Client globals** — `window.__dashboardBills` / `__dashboardRecurring`; optional single namespace object to avoid future collisions.

22. **Help vs inline UI** — Keep dense explanations in Help (pattern used for Bills Due); Bank Accounts add flow is covered in Help **Assets**; optional same pass for other tabs (Quick add edge cases, etc.).

24. **Dashboard charts (long term)** — Add trends without cluttering the UI. **Effort:** moderate; drawing is easy, the real work is **clean time series** from the backend (e.g. roll `OUT - History` or per-tab monthly series in `dashboard_data.js`). **Keep calm:** prefer **sparklines** in snapshot cards; at most **one** larger chart above the fold per page; extra charts behind **“Show trend”** or on **detail tabs** (e.g. full retirement chart on Planning, not Overview). **Good targets:** optional sparkline under **Net Worth** (or Cash) on Overview; health **score-over-time** inside **“Why this score?”**; **Buffer Runway** vs months; **Assets** panels (house/bank/investments) for **selected** entity only; **Debts** balance over time; **Cash Flow** income vs expenses if monthly history exists. **Skip / low value:** charting every row in Bills Due or dense forms.

---

## DONE (history)

Completed items kept for reference (original list numbers preserved).

**Bank Import — Apply auto-creates a missing INPUT row inside an existing Year block (V1.2)** — shipped in `0a9968e`. User asked: "Make Apply more robust by auto-creating the missing **INPUT - Bank Accounts** row when needed." Previously `applyStagedBankAccountBalance` would refuse with *INPUT - Bank Accounts has no Year block for the snapshot's year* whenever the linked account had no row inside an otherwise-existing year block — the common case after **Add as new** against a prior year you haven't backfilled. Fix adds the new helper `bankImportEnsureInputRowForApply_(bankSheet, accountName, year)` in `bank_import.js` which: (1) locates the year block via `getBankAccountsYearBlock_`; (2) early-returns `false` if the year block itself is missing (Step 2d still refuses — no auto-create of year blocks from import data); (3) early-returns `false` if `findBankAccountRowInBlock_` already finds the account row (idempotent); (4) calls `insertNewBankAccountHistoryRow_` (the same row-insert primitive the manual Add new flow uses) to insert a blank row inside the year block; (5) returns `true` so `applyStagedBankAccountBalance` can carry the boolean through to the activity log + the user-facing success message. Apply now appends *Created INPUT - Bank Accounts row for YYYY.* to the success message when auto-create fired, and `bankImportLogApplyBalanceActivity_` stamps `autoCreatedInputRow: true` into the event's `details` JSON so the audit trail records exactly which Apply rows synthesized their own input row. **No new SYS - Accounts row**, **no new year block**, **no balance write during row creation** (the row insert and the snapshot write are two separate operations — the snapshot still goes through the existing month-write path immediately after). Refuses unchanged: stale_balance / currency_mismatch / type_conflict / inactive linked account / unmatched External Account Id / missing year block. Files touched: `bank_import.js`. Help updated (`Dashboard_Help.html` → Apply balance bullet + `bank_import_apply_balance` activity-log glossary).

**Planner email log — roll up deferred saves onto the `planner_email_sent` row (V1.2)** — shipped in `12e62e9`. User reported: "email deferred messages are too much in the log — can we reduce those or not log them?" The earlier debounce work (`82c52f7`) wrote one `planner_email_deferred` row to `LOG - Activity` per background save during a 10-minute quiet window, which on a 50-save month-start crowded out every real money event behind redundant *Email deferred* lines. Fix removes the per-defer Activity write entirely. In `planner_output.js` (where the deferred branch lives), the call to `appendActivityLog_('planner_email_deferred', ...)` is replaced with `bumpDebouncePlannerDeferredCount_()` (new) — same `DocumentProperties` store as `LAST_SAVE_AT`, just a separate counter key. When `debouncePlannerEmailRun` fires after the quiet window, it calls `readDebouncePlannerDeferredCount_()` immediately before sending and threads the returned count through `runDebtPlanner({ emailMode: 'send' })` → `sendPlannerEmailIfConfigured_(summary, options)` → `appendActivityLog_('planner_email_sent', ..., { details: { recipientCount, recipientFields, deferredSaveCount: N } })`. `plannerEmailSentActionLabel_` in `activity_log.js` now reads `deferredSaveCount` from details and appends `(N saves batched)` to the action sub-label — e.g. *Email sent to 2 recipients (12 saves batched)*. `markDebouncePlannerEmailSettled_` clears both `LAST_PLANNER_EMAIL_AT`-tracking state and the deferred counter so the next session starts at zero. **Legacy `planner_email_deferred` rows already on the sheet still render correctly** (action label / kind classification / non-monetary flag unchanged in `activity_log.js` — they remain searchable under the Planner type filter). Manual **Run Planner + Refresh Snapshot** still sends immediately with `deferredSaveCount = 0` (no `(N saves batched)` suffix in that case). The counter is approximate under rapid concurrent saves — telemetry, not money. Files touched: `planner_output.js` (defer branch swap), `debounce_planner.js` (+ deferred counter helpers + settled-clears), `activity_log.js` (`plannerEmailSentActionLabel_` reads `deferredSaveCount`). Help updated (`Dashboard_Help.html` → Debt Planner email → "When the email is sent (debounce)" + `planner_email_sent` activity log entry + `planner_email_deferred` legacy note).

**Roadmap — capture Future Enhancements (Post-Core) tiers + Chat assistant (V1.2)** — shipped in `f0bb0dd`. Documentation-only update. `TODO.md` and `ENHANCEMENTS.md` now both carry the **Future Enhancements (Post-Core)** section laid out across three priority tiers — Tier 1 (high impact, gated behind Bank Import + Bills completion): auto-reconciliation view, cash safety alerts, bulk Apply-all flow, "What changed?" insights. Tier 2 (UX / insight): account grouping, scenario simulation, lightweight historical trends. Tier 3 (advanced / AI / future): Chat-based Finance Assistant (read-only; phased deterministic → NL parser → AI-assisted), "Explain my finances" narrative insights, root-cause queries, guided suggestions. Plus a small **Product Direction Ideas** appendix (financial state indicator, weekly snapshot email, account health score). Explicit ordering note throughout: all tiers remain **lower priority than Bank Import completion and Bills / planner accuracy** — nothing here can be pulled into an active phase without an explicit product decision first. No code changes.

**Bank Import — Steps 3a + 3b: CSV paste input + suggested match by last 4 (V1.2)** — shipped in `a9ab162`. Two related additions to the review surface. **(Step 3a — CSV paste.)** New segmented panel **Import** under **Assets → Bank Accounts**, gated behind UI flag `BANK_IMPORT_CSV_PASTE_ENABLED` (default `false`, lives in `Dashboard_Script_AssetsBankInvestments.html`). Lets the user paste up to **200 rows** of CSV against a documented CashCompass template (required columns: `institution`, `displayName`, `last4`, `type`, `balance`, `balanceAsOf`, `currency`; optional `externalAccountId` — a deterministic fingerprint is generated when blank). Header lookup is case-insensitive + trimmed. Client-side parser handles BOM, quoted cells with commas, and CR/LF normalization. **Layered validation** before staging — required-fields, numeric balance, ISO `balanceAsOf`, type allow-list, transaction-CSV heuristic (hard block when amount/debit/credit columns are present *and* `balance` is absent). **Errors block the entire batch** — no "skip rows" toggle in v1; preview is the confirmation surface. New server wrapper `processBankImportCsvPasteBatchFromDashboard(payload)` calls the existing `processBankImportBatch_(payload)` with `source = 'csv_paste_v1'` so staging/review/apply pipelines are unchanged — pasted rows route through the same Step 2a auto-match / pending / ignored / dedupe logic as the dev harness. **(Step 3b — suggested match by last 4.)** For unlinked staged rows that carry an exact 4-digit `last4`, the review card now offers a primary **Match to &lt;account&gt;** button when **exactly one** active **SYS - Accounts** row's Account Name contains those 4 digits as a digit-boundary-bounded substring. Suppressed when: the candidate already has any External Account Id, the candidate's Type conflicts, more than one active account matches, or `last4` is missing / not exactly 4 digits. Confirming a suggestion routes through the same locked `matchStagedBankAccountToExisting` path — no new linking code path, no auto-match. Account names are looked up by `stagingId` from `__bankImportReviewState.suggestionByStagingId` (built during render) — the inline `onclick` only carries the staging id, so account names containing double quotes can never break the attribute. No `activity_log.js` changes; both paths still log under the existing `bank_import_review_add_new` / `bank_import_review_match` / `bank_import_review_ignore` events. Help updated (`Dashboard_Help.html` → Bank Accounts — Import (CSV paste), Bank Accounts — Review imports → Suggested match by last 4).

**Bank Import — gate dev/sample button + simplify Review panel copy (V1.2)** — shipped in `2a9972b`. Two small UI-only changes. **(1) Gate dev/sample button.** Added UI flag `BANK_IMPORT_DEV_TOOLS_ENABLED` (default `false`) in `Dashboard_Script_AssetsBankInvestments.html`. The yellow *Load sample import data (dev)* callout + button inside the Review imports panel renders only when the flag is `true`; the backend dev harness (`devRunBankImportSampleFromDashboard`, `_devRunBankImportSample`, `_devRunBankImportCustom_`) is preserved unchanged. Production users no longer see the developer-only entry point. **(2) Simplify Review panel copy.** The descriptive paragraph above the review list was reduced to one actionable sentence: *Review imported accounts. Link first (Add or Match), then Apply to update this month's balance.* No layout / button / logic changes. Files touched: `Dashboard_Body.html` + `Dashboard_Script_AssetsBankInvestments.html` only.

**Bank Import — Step 2d strict approval flow with Apply + Unlink safety (V1.2)** — shipped in `bc695e6`. The product goal that drove everything else in the Bank Import series: **no imported balance ever lands on `INPUT - Bank Accounts` without explicit user approval**, including for rows that match a known External Account Id. Previously Step 2a's auto-match path wrote balances silently through the existing Bank → Update primitive whenever an exact `External Account Id` match was found, and Step 2b's **Add as new** routed the staged opening balance through `addBankAccountFromDashboard` to seed the new account's first month. Both behaviors are now explicit-approval-only. **(1) Auto-match no longer writes balances.** Step 2a's matched branch routes to pending with new Pending Reason `auto_match_awaiting_apply` instead of calling the Bank → Update write path. The row appears on the Review imports list with `linkState = 'auto_pending'` and the user must click **Apply balance** to commit it. **(2) Add as new is link-only.** Opening-balance inputs are removed from the Add-as-new inline form. The action only inserts the **SYS - Accounts** row (with Use policy + Priority + Type) and the current-Year-block row on **INPUT - Bank Accounts** (no month written), then stamps the staged External Account Id onto the new SYS row. The staged row stays on the Review imports list with `linkState = 'linked_added'`. **(3) Match is link-only.** Same as before — only the External Account Id cell is written, never balances. Status flips to `linked_matched`. **(4) Apply balance is the new explicit second step.** New server entry point `applyStagedBankAccountBalance(payload)` writes the staged snapshot to the matching month cell using the same path Bank → Update uses, mirrors `SYS - Accounts.Current Balance`, invalidates the dashboard snapshot, and flips Status to `resolved_applied`. The apply is refused (with the staged row preserved so the user can fix the underlying issue and re-click) when: row is not linked yet, Pending Reason is `stale_balance` / `currency_mismatch` / `type_conflict`, the linked SYS row is inactive, the External Account Id no longer matches any active SYS row, or the snapshot's Year block is missing on **INPUT - Bank Accounts** (year blocks are not auto-created from import data). New activity event `bank_import_apply_balance` classified as **Bank Import** kind, non-monetary, ineligible for the Activity Remove button; details JSON carries `monthLabel` / `previousRaw` / `previousDisplay` / `newRaw` / `linkStateAtApply` and the apply fingerprint as the row's `dedupeKey` so an identical re-import is silently no-oped at ingestion. **(5) Change match / Unlink** for `linked_matched` rows only. New server entry point `unlinkMatchedStagedBankAccount(payload)` clears the External Account Id cell on the previously-matched SYS row, returns the staged row to `pending` with reason `no_exact_id_match`, and never touches balances / Active / Use Policy / Priority / Type. New activity event `bank_import_review_unlink_match` (non-monetary, **Bank Import** kind, details carry `previousAccountName`). Intentionally **not** offered on `linked_added` rows (which created their own SYS row at link time) or on auto-pending rows that were never user-matched. **(6) Apply badge counter** on the Review imports segment now reports `pending + linked_added + linked_matched + auto_pending` so the user sees one number for "actionable rows" without a split badge. All entry points are `LockService.getDocumentLock()` wrapped (30s wait). Concurrency: stale "already-pending in tab A but resolved in tab B" returns the canonical friendly *"Staged row is no longer pending. It may have been resolved in another tab."* message, not a hard error. Files touched: `bank_import.js` (+ `applyStagedBankAccountBalance` + `unlinkMatchedStagedBankAccount` + ~6 helpers + ~3 new status / reason constants + ~3 new event constants), `activity_log.js` (+ 2 label cases + 2 non-monetary entries), `Dashboard_Body.html` (unchanged), `Dashboard_Script_AssetsBankInvestments.html` (+ extended `renderBankImportReviewCard_` to render `linkState`-aware buttons + `confirmBankImportReviewApplyBalance_` + `confirmBankImportReviewUnlinkMatch_` + Apply form), `Dashboard_Help.html` (+ Apply balance / Change match / Apply-refused list / linked status rows / `bank_import_apply_balance` + `bank_import_review_unlink_match` glossary). No schema changes (only `Status` / `Pending Reason` writes on staging, only `External Account Id` writes on Accounts, snapshot writes via the existing Bank → Update path). See **SESSION_NOTES.md → Bank Import — Step 2d strict approval flow with Apply + Unlink safety** for the implementation rationale.

**Bills — bounded edit mode for active tracked rows (V1.2)** — uncommitted at the time of writing. User asked: "Add edit support for tracked recurring bills" with an explicit one-bounded-change scope ("reuse existing Add bill form where possible", refuse inactive bills, keep Payee rename in scope without retroactive Cash Flow rewrites, no re-sort on Due Day change, no new fields). Previously the Manage bills table action column only offered **Stop tracking**, so fixing a typo / re-budgeting / re-categorizing a bill required Stop tracking + Add new (which broke history continuity and required users to retype every field). Fix adds an **Edit** action to every Manage row that reuses the existing **Add bill** form in **dual-mode** — same form ids, same validation, same Cancel surface — flips the heading to **Edit bill**, the Save button to **Save changes**, and the Cancel button to **Cancel edit**, and hides **Start Month** + **Active** (Active is owned by Stop tracking; Start Month is Add-only in v1). New server function `updateTrackedBillFromDashboard(payload)` in `bills.js` runs the same Add-style validation on `payee` / `dueDay` / `frequency` / `paymentSource` / `category` / `defaultAmount` / `notes` / `autopay` / `varies`, re-reads the target row to verify `expectedPayee` matches (stale-row guard mirrored from `deactivateBillFromDashboard` — "Bill has moved on the sheet …"), refuses inactive rows ("Bill is inactive. Use Add bill to re-add it."), then **diffs each editable field against the current sheet value** (raw numbers for Due Day / Default Amount, normalized Yes/No for Autopay / Varies, trimmed display for text). Only the cells that actually changed are written via per-cell `setValue` — typical 1-field edit fires 1 round-trip instead of an 11-column row write. **No-change save** path returns `{ ok: true, message: 'No changes.', changedFields: [] }` without touching the sheet, without bumping `touchDashboardSourceUpdated_`, and without writing an Activity row. **No re-sort** on Due Day edits in v1 — the bill row stays in place in `INPUT - Bills`; the Manage table sorts client-side so the displayed order stays correct. **No retroactive Cash Flow rewrites** even on Payee rename — the Expense row seeded on `INPUT - Cash Flow <year>` at Add time keeps the old Payee (history preserved on purpose; future bill matches use the new values). New activity event **`bill_update`** classified as **Bill** kind (via existing `etEarly === 'bill_update' → 'Bill'` branch), marked non-monetary so Amount renders `—`, ineligible for the Activity Remove button. Action-label helper `billUpdateActionLabel_` renders `Updated Default Amount to $X.XX` / `Updated Due Day to N` / `Updated <Field>` for single-field edits and `Updated N fields` for multi-field, with a defensive `Updated bill` fallback. Details JSON carries `payeeBefore` / `payeeAfter` (readable on Payee renames), `changedFields` array, plus `old` + `new` per-field snapshots for future undo tooling. **Manage list extension**: `getActiveBillsForManagementFromDashboard` now also returns `notes` so the Edit form can pre-fill it without a separate fetch — without this the Notes input would have read blank and silently cleared the Notes cell on save. **Edit-success refresh** matches the Add path (`loadDashboardActionSections` + `refreshSnapshot`) so the Manage list, Due-this-period queue, and Overview snapshot all reflect the new values immediately. **Files touched**: `bills.js` (+ `updateTrackedBillFromDashboard` + `notes` field on the management reader, ~270 lines), `activity_log.js` (+ `bill_update` to docstring, `kindLabel_`, `activityLogActionLabel_` switch, `activityLogIsNonMonetaryEvent_`, + `billUpdateActionLabel_` / `billUpdateFieldDisplayName_` helpers, ~90 lines), `Dashboard_Body.html` (+ `#bills_form_title` + `#bills_form_save_btn` / `#bills_form_cancel_btn` ids, Save button onclick switched from `submitNewBill()` to `submitBillsForm()`), `Dashboard_Script_BillsDue.html` (+ Edit button in the Manage table action cell + `__billsFormMode` module state + `setBillsFormModeToAdd_` / `setBillsFormModeToEdit_` / `applyBillsFormModeUi_` / `setBillFieldVisibilityForEdit_` / `openBillEditForm` / `setInputValue_` / `setSelectValue_` / `prefillBillCategoryForEdit_` / `submitBillsForm` / `cancelBillsForm` / `submitBillEdit_`, ~290 lines), `Dashboard_Help.html` (+ Edit bullet under Manage bills, + `bill_update` glossary entry, + `bill_update` added to the non-monetary Amount note). **No schema changes**, **no planner changes**, **no Cash Flow write changes**.

**Bank Import — Step 2b Review UI for staged bank accounts (V1.2)** — uncommitted at the time of writing. User asked: "Add a safe review UI for staged bank accounts so the user can review pending imported bank accounts and choose: Add as new account / Match to existing account / Ignore." Step 2a (`processBankImportBatch_`) already stages unknown bank accounts on `SYS - Import Staging — Bank Accounts` with `Status = 'pending'`, but there was no UI to resolve them — they just sat on the sheet. Implementation adds a third **Review imports** segment to the existing Bank panel (alongside Update / Add new), lazy-loaded on entry, with a `(N)` count badge. Each pending row renders as a card showing institution / displayName / ••••last4 / type / currency / balanceAsOf / pendingReason / latest balance, with three inline-expand actions: **Add as new** (reuses `addBankAccountFromDashboard` with the staged snapshot as opening balance + date, then stamps `External Account Id` onto the new SYS row), **Match to existing** (writes only the External Account Id cell of the chosen active account; refuses with `That account is already linked to a different external id. Match aborted.` if the target already has a different non-blank id — no overwrite, no confirmation), **Ignore** (appends a permanent-scope row to `SYS - Import Ignored — Bank Accounts`; idempotent via existing-entry check). All three flip the staging row's `Status` from `pending` to `resolved_added` / `resolved_matched` / `resolved_ignored` — no new resolution column on the staging sheet, the existing Status column is repurposed. Concurrency: every entry point takes a 30s document lock; if two tabs race, the second returns the canonical friendly `'Staged row is no longer pending. It may have been resolved in another tab.'`. New activity events `bank_import_review_add_new` / `_match` / `_ignore` (all classified as **Bank Import** kind via a single new `bank_import_*` prefix rule that also covers the four pre-existing Step 2a events, all marked non-monetary so Amount renders `—`, all ineligible for the Activity Remove button). Files touched: `bank_import.js` (+ 4 public entry points + 9 helpers, ~430 lines), `activity_log.js` (+ classification prefix + 3 label cases + 3 non-monetary entries, ~20 lines), `Dashboard_Body.html` (+ 1 segment button + 1 wrap div, ~12 lines), `Dashboard_Script_AssetsBankInvestments.html` (+ ~250 lines: extended `setBankPanelMode` + 13 client helpers + 1 module state object), `Dashboard_Help.html` (+ 1 user-guide subsection + 3 activity-log bullets). No schema changes (only `Status` writes on staging, only `External Account Id` writes on Accounts, only appends to Ignored). Pending rows still never affect the planner / Overview / `SYS - Accounts.Current Balance` until reviewed. See **SESSION_NOTES.md → Bank Import — Step 2b Review UI for staged bank accounts** for the full implementation rationale.

**Upcoming Expenses — bounded edit mode for Planned rows (V1.2)** — shipped in `af438a1`. User asked from the Cash Flow → Upcoming page: "I need a way to edit the upcoming events like the date etc..." Previously the only per-card actions were **Quick add payment** and **Dismiss** — there was no path to fix a typo, change a Due Date, or re-budget the Amount on an existing Upcoming row. Fix adds an **Edit** button to every Planned card (Paid / Dismissed rows are intentionally locked — use the lifecycle paths to change them, or re-add a fresh row) that hydrates the existing **Add Upcoming Expense** form with the row's values, flips the Save button label to `Save changes`, shows a `Cancel edit` link, and surfaces an `Editing: <expense name>` banner above the inputs. New server function `updateUpcomingExpenseFromDashboard(payload)` in `upcoming_expenses.js` reuses `findUpcomingExpenseRowById_`, status-guards that current `Status === 'Planned'` (throws `Only active (Planned) upcoming expenses can be edited.` otherwise), validates the same `expenseName / dueDate / amount > 0` contract `addUpcomingExpense` uses, and writes only the **8 user-input columns** (Expense Name, Category, Payee, Due Date, Amount, Account / Source, Auto Add To Cash Flow, Notes) via per-cell setValue calls — ID, Status, and Added To Cash Flow are intentionally never touched so the `upcoming_payment` / `upcoming_status` lifecycle events stay consistent. **No-change saves** (user opened Edit, hit Save without changing anything) return `{ ok: true, message: 'No changes.', changedFields: [] }` without touching the sheet or writing an Activity row. New activity event **`upcoming_update`** is classified as **Upcoming** kind (via the existing `upcoming_*` prefix rule), marked non-monetary so Amount renders `—`, and ineligible for the Activity Remove button. Action label rendering: `Updated Due Date to YYYY-MM-DD` / `Updated Amount to $X.XX` / `Updated <Field>` for single-field edits, `Updated N fields` for multi-field, defensive `Updated` fallback for legacy rows. Details JSON carries the full `previous` + `new` snapshots of all 8 fields + a `changedFields` array for future undo tooling. **Edit-success refresh** is intentionally narrow: only `loadUpcomingSection()` runs (which re-paints both the in-page mini-cards and the Overview `ov_upcoming_*` KPIs because `renderUpcomingSummary` fills both); no `loadDashboardActionSections` / `refreshSnapshot` / silent planner because Upcoming Expenses aren't in the debt planner's input set. Add path is unchanged (still calls the full refresh chain). UI reuses the existing Add form deliberately — no new modal, no inline-card editor — so there's only one validation + status surface to maintain. Files touched: `upcoming_expenses.js` (+ `updateUpcomingExpenseFromDashboard`, + `appendUpcomingActivityUpdate_`), `activity_log.js` (+ `upcoming_update` switch case + `upcomingUpdateActionLabel_` / `upcomingUpdateFieldDisplayName_` helpers + `activityLogIsNonMonetaryEvent_` entry), `Dashboard_Body.html` (+ `#up_form_mode` banner + `#up_save_btn` id + hidden `#up_cancel_btn`; no CSS — reuses `.muted` / `.small-btn`), `Dashboard_Script_CashFlowUpcoming.html` (+ module-level `__upcomingEditingId` + `enterUpcomingEditMode_` / `resetUpcomingFormToAddMode_` / `editUpcoming(id)` / `cancelUpcomingEdit()` helpers + Edit button in `renderUpcomingList` + dual-mode branch in `saveUpcomingExpense()`), `Dashboard_Help.html` (+ Edit bullet under Upcoming Expenses → Actions, + `upcoming_update` description in Activity log, + cross-reference). No schema changes, no planner changes, no Cash Flow write changes. See **SESSION_NOTES.md → Upcoming Expenses — bounded edit mode for Planned rows** for the implementation rationale.

**Bills + Debts — insert new rows sorted by Due Day (V1.2)** — shipped in `484db5c`. User asked: "when adding a new bill to the table can we make sure it is inserted sorted based on the due date? same applies for debts." Previously `addBillFromDashboard` appended at the bottom of `INPUT - Bills`, and `addDebtFromDashboard` always landed just above `TOTAL DEBT` regardless of Due Day, so the underlying sheet drifted out of Due-Day order even though the dashboard sorts by Due Day for display. Fix inserts each new row in Due-Day-ascending order. Insertion rule (mirrored across both files): scan top-down, insert **before** the first row with a strictly greater Due Day; same-day ties land **after** existing same-day rows; any legacy rows with a blank Due Day sink to the bottom. **Bills** scan covers rows 2..lastRow (full data region); **Debts** scan is constrained to the active region (rows 2..templateRow) above `TOTAL DEBT` so stop-tracked rows below the summary are intentionally not considered, and `findDebtsSortedInsertRow_` returns `templateRow + 1` when the new debt belongs at the end of the active region — preserving the legacy placement and keeping `TOTAL DEBT` + the blank buffer untouched. New helpers: `findBillsSortedInsertRow_` + `copyBillsRowFormattingFromInsertSiblingRow_` in `bills.js`; `findDebtsSortedInsertRow_` in `debts.js` (alongside existing `findDebtTemplateRow_`). Format-copy logic is sibling-aware: prefer the row immediately below the insert (it was at the insert position before the shift and is already styled like the rest of the data region), fall back to the row above when the insert lands at the very end of the active region (where the row below would now be buffer / `TOTAL DEBT`). Defensive guards: missing `Due Day` / `Due Date` header falls back to legacy append; non-numeric Due Day (already rejected by the form validators upstream) also falls back rather than scrambling order. **Safe diff** — every read path elsewhere joins by name (`findRowByName_`, `getInputBillsDueRows_`, `lookupRowByName_`, `getDebtsHeaderMap_`, `normalizeDebts_`, `getDebtBillsDueRows_`), so shifting row positions has no row-number-keyed callers to update. Help updated (`Dashboard_Help.html` → Cash Flow → Add bill, Activity log → `bill_add` and `debt_add`, Planning → Debts → Add new). See **SESSION_NOTES.md → Bills + Debts — insert new rows sorted by Due Day**.

**Quick Add — Activity row appears instantly via optimistic prepend (V1.2)** — shipped in `f66bed4`. Saving income/expense via Quick Add visibly took "forever" to show on the Activity tab — only appearing after the full planner run completed. Root cause: success handler fired five concurrent RPCs (activity reload + snapshot + upcoming + actions + planner) and meanwhile wrote `Loading activity…` over the table; whenever planner queued ahead the user stared at "Loading…" for ~10s. Fix: new client-side helper `prependOptimisticQuickPayActivityRow_(snapshot)` constructs a row from `res.activitySnapshot` (which the server already returns) and prepends it to `window.__activityRows` + re-renders, so the new row appears in <100ms with no RPC. New `loadActivitySection({ quiet: true })` mode skips the `Loading activity…` placeholder so the optimistic row stays visible while the server reconcile is in flight — when the server reload returns it replaces `window.__activityRows` with the authoritative list (containing the same event from `appendActivityLog_`'s synchronous write inside `quickAddPayment`) so no flicker. Other callers (Apply button, tab navigation, post-delete) keep the original placeholder behavior because `opts.quiet` defaults to false. See **SESSION_NOTES.md → Quick Add — Activity row now appears instantly**.

**Planner email — debounce per-save runs + send to spouse too (V1.2)** — shipped in `82c52f7`. User reported "I do 50 saves at month-start and get 50 emails" plus "not sure spouse gets the email today." Fixed both in one pass. **(1) Multi-recipient resolution.** New `readPlannerEmailRecipientsStrict_()` in `planner_output.js` reads both `Email` and `Spouse Email` from `INPUT - Settings`, validates each against `PROFILE_EMAIL_REGEX_`, dedupes case-insensitive, and returns `{ valid, fields, invalidFields }`. `sendPlannerEmailIfConfigured_(summary, options)` joins valid addresses on the `To:` line in a single `MailApp.sendEmail` so spouse always gets the same copy. Legacy single-recipient `readPlannerEmailFromSettingsStrict_` removed. **(2) Debounce.** Per-save background planner runs are now invoked with `runDebtPlanner({ emailMode: 'defer' })` — they still re-run the planner and refresh Overview / Rolling Debt Payoff in the background, but they bump a `LAST_SAVE_AT` timestamp in `DocumentProperties` and log `planner_email_deferred` instead of sending. New file `debounce_planner.js` owns the queue (constants `DEBOUNCE_QUIET_WINDOW_MS_ = 10 min`, `DEBOUNCE_TRIGGER_INTERVAL_MIN_ = 5`). Time-driven trigger `debouncePlannerEmailRun` registered idempotently from `getDashboardSnapshot()` via `ensureDebouncePlannerTrigger_()`; on each fire it checks whether `now - LAST_SAVE_AT >= 10 min` and `LAST_PLANNER_EMAIL_AT < LAST_SAVE_AT`, and if so runs `runDebtPlanner({ emailMode: 'send' })` once to flush a single email. `markDebouncePlannerEmailSettled_()` (called whenever a `'send'` run completes — even when the meaningfulness gate or no-recipients gate skips actual mail) clears the queue so the trigger doesn't keep polling. **Manual button** (`Run Planner + Refresh Snapshot`) keeps sending immediately because `runPlannerAndRefreshDashboard()` defaults to `emailMode === 'send'`. New save-flow RPC `runPlannerAndRefreshDashboardFromSave()` defers; five client save sites in `Dashboard_Script_AssetsBankInvestments.html` (×2), `Dashboard_Script_AssetsHouseValues.html`, `Dashboard_Script_PlanningDebts.html`, `Dashboard_Script_Payments.html` switched to it. `house_expenses.js` server-side `runDebtPlanner()` call now passes `{ emailMode: 'defer' }`. New activity events `planner_email_deferred` / `planner_email_sent` / `planner_email_invalid_recipient` (classified as **Planner** kind, all non-monetary, all ineligible for the Activity Remove button); details JSON for `planner_email_sent` includes `recipientCount` and `recipientFields` (field names only — the addresses themselves are deliberately never logged so a typo can't leak into Activity). Worst-case email latency from a final save is ~10–15 minutes (10 min quiet window + up to 5 min until the next trigger fire). Help updated (`Dashboard_Help.html` → Debt Planner email → "Who gets the email" + "When the email is sent (debounce)" sections + Activity log new event descriptions + Remove button greyed list).

**Asset save sync — stop hanging on every save (V1.2)** — shipped in `fe02299`; sibling commits `f13d928` (asset activity logs + fast save) and `6c0953d` (collapse repeat reads + Saving label) shipped earlier in the session. Saving an Investment value held the UI on `Saving…` for tens of seconds on populated workbooks. Root cause: `syncAllAssetsFromLatestCurrentYear_` (and the matching bank / house siblings) walked the year block with ~4 Sheets API round-trips per row to compute the latest-value map, then unconditionally re-wrote every SYS row through the format-preserving `setCurrencyCellPreserveRowFormat_`. For ~15–20 investments that produced 100+ round-trips per save. Fix in `investments.js`, `bank_accounts.js`, `house_values.js`: (1) rewrite `getLatest*ValuesForYear_` to do **2 round-trips total** (one full-sheet display, one batched data-range `getValues()`) and resolve the latest non-empty month in memory; (2) skip the format-preserving SYS write when the new value equals the existing rounded value, collapsing N writes to 1 in the common single-account-edit case; (3) reuse the already-loaded display when calling the header-map helpers. Same latest-value math, same activity logging, planner still runs in the background as a silent RPC. Bank Account and House Value saves get the same fix as defense-in-depth. See **SESSION_NOTES.md § Current State — Post V1.2 Prep → Asset save sync — stop hanging on every save**.

**Asset updates — activity log + fast save without waiting on planner (V1.2)** — shipped in `f13d928`. Bank Account, House Value, and Investment balance updates now log `bank_account_update` / `house_value_update` / `investment_update` events to `LOG - Activity` (previously these manual updates produced no audit entry at all), and the client-side save flows now decouple the UI refresh + activity log from the full planner run, mirroring the Debts pattern from `c26c11c`. Status flips through `Saving… → Saved.`, summary panel and activity log update immediately, and `runPlannerAndRefreshDashboard()` runs as a silent background RPC. Action labels include the month and new balance (e.g. *Updated May-26 balance to $1,234.56*); **Amount** renders `—` (non-monetary). Help updated.

**Asset pages — collapse repeat sheet reads + show "Saving…" instead of "Loading…" (V1.2)** — shipped in `6c0953d`. Two related fixes. (1) Performance: Bank Accounts / Investments / House Values / Debts page-load and dropdown-selection RPCs each made 2–4 full-sheet reads; consolidated to a single `getDataRange().getDisplayValues()` per RPC and threaded into helpers via new optional `display` / `headers` parameters (backward compatible). Per-row `getRange(row, col).getDisplayValue()` loops in the row-finder helpers were replaced with single batched range reads. (2) UX: after the asset fast-save fix, the load helpers were re-triggering `setStatusLoading()` and clobbering the `Saved.` message with `Loading…`. Save handlers now pass an explicit `'Saving…'` label, and `loadBankData / loadHouseData / loadInvestmentData` accept a `quiet` parameter that skips status updates so the `Saved.` message survives the post-save refresh.

**Quick Add — instant Activity ledger refresh + background planner (V1.2)** — shipped in `d743458`. Saving a Quick Add payment now calls `loadActivitySection()` immediately on success and fires the planner as a silent background RPC, so the new row appears on the Activity tab without waiting for the planner. Mirrors the Debts pattern.

**Quick Add — Bill Pay prefill race + explicit Other payee option (V1.2)** — shipped in `1305c40`. (1) Launching Quick Add from a bill on a cold tab failed to populate the **Existing Payee** dropdown because the prefill ran before `paymentPayees` finished loading. Fix stashes the wanted payee in `window.__pendingQuickAddPayee` and applies it from `loadPaymentSection`'s success handler with a guard that won't overwrite a user edit. (2) Added an explicit **Other (type new payee)** sentinel option (`__OTHER__`) at the bottom of the Existing Payee dropdown for adding a payee that isn't in the list yet; selecting it clears + focuses the typed input. Help updated.

**Bank Import — Step 2a ingestion pipeline (V1.2)** — shipped in `03d2c4a`. First server-side ingestion built on the Step 1 scaffold. `processBankImportBatch_(payload)` handles ignored checks (permanent only), exact-id auto-match against `SYS - Accounts.External Account Id`, pending staging upserts for everything else, balance-fingerprint dedupe against recent `LOG - Activity`, and four new event types (`bank_import_auto_matched` / `bank_import_pending` / `bank_import_ignored_hit` / `bank_import_row_error`). Dev/test harness only — no UI, no external sync, no planner impact. Strict deviations recorded: blank `currency` is `currency_mismatch`, `BANK_IMPORT_STALE_BALANCE_DAYS = 90` (future-dated `balanceAsOf` always stale), planner intentionally not called from auto-match.

**Planner email — handled-this-month check now uses each debt's next-due month (V1.2)** — shipped in `bae82c9`. The Debt Planner email's *Pay now* / *Pay soon* sections were silently dropping loan payments due in the next calendar month if the user had already paid the *current* month. Root cause: `buildUpcomingPayments_` checked the "handled" flag against the current calendar month's Cash Flow cell even when the payment's `nextDueDate` fell in a different month. Fix: `buildDebtMinimumHandledMap_` now returns a month-keyed nested map; `isDebtMinimumHandledThisMonth_` accepts a `monthHeader`; `buildUpcomingPayments_` resolves the correct month header for each upcoming payment before checking handled status. `runDebtPlanner` passes `[currentMonth, nextMonth]` so both months are pre-built.

**Bills Due — inactive debts and inactive Cash Flow rows no longer leak into the recurring fallback (V1.2)** — shipped in `9bf3234`. `Recurring Bills (No Due Date)` on the Bills Due page was showing debts marked `Active = No` in `INPUT - Debts` (reproduced with *Laith VCS Account*). Root cause: `getRecurringBillsWithoutDueDateForDashboard()` in `dashboard_data.js` only excluded payees present in the active-only `debtBills` map and never checked the Cash Flow row's own `Active` column, so deactivating a debt actually *promoted* its still-present Cash Flow row into the fallback list. Fix adds two guards inside the existing loop: (1) skip Cash Flow rows explicitly marked `Active = No` (accepts `no / n / false / inactive`; blank still means active, matching the `getCashFlowHeaderMap_` convention), and (2) a new sibling helper `getDebtPayeeMapAllStatuses_(ss)` — name-reservation only, no totals/planner impact — so any payee that appears in `INPUT - Debts` (regardless of status) is excluded from the fallback. Scope: `dashboard_data.js` only; the recurring-fallback function is consumed exclusively by `Dashboard_Script_BillsDue.html` (line 324). Planner math, Overview snapshot, Retirement, credit-card totals, Debts list, and the active Bills Due (Next 7 / Overdue) paths are untouched — they already filter inactive debts via `isDebtSheetRowInactive_`. See **SESSION_NOTES.md § Current State — Post V1.2 Prep → Bills Due — inactive debts and inactive Cash Flow rows no longer leak into the recurring fallback**.

**Debts — fast save + activity log + background planner (V1.2)** — shipped in `c26c11c`. Planning → Debts → Update now shows a proper `Saving… → Saved.` status row, optimistically repaints the right-hand info panel with the saved value, refreshes the Overview snapshot, and fires `runPlannerAndRefreshDashboard()` as a silent background RPC so Rolling Debt Payoff catches up shortly after without blocking the save. Server-side `updateDebtField` no longer runs the debt planner inline — that inline call used to hang the UI on `Saving…` for several seconds on large workbooks. Every field edit also writes a new `debt_update` event to **LOG - Activity** with a dynamic action label (e.g. *Updated Account Balance to $54,000.00*, *Updated Int Rate to 7.50%*, *Updated Due Day to 15*). Classified as **Debt** kind; **Amount** renders `—` (non-monetary) so field edits don’t double-count; previous / new raw + display values and `fieldKind` preserved in the event `details` JSON for future undo tooling. See **SESSION_NOTES.md § Current State — Post V1.2 Prep → Debts — fast save + activity log + background planner** and Help **Activity log → `debt_update`**.

**Quick Add — robust Saving… indicator + $0 allowed (V1.2)** — shipped in `098fef0` → `29f29a2`. Cash Flow → Quick add → Add to Cash Flow now reliably shows `Saving…` between click and `Saved to Cash Flow.` — `savePayment()` layers plain-text `setStatus` under `setStatusLoading` so the label survives deploy / CSS state drift, mirroring the proven legacy sidebar pattern. Server-side `quickAddPayment` amount validator relaxed from `amount <= 0` to `isNaN(amount) || amount < 0` with new error string *Amount must be a valid number.*; users can now save $0 on Quick add to zero out a month cell, correct a bad entry, or seed a placeholder row so the payee shows up in Bills Due / Upcoming before the first real payment. Upcoming Expenses, Income Sources, and Purchase Simulator still require `> 0` (different semantics, intentionally left alone). See **SESSION_NOTES.md § Current State — Post V1.2 Prep → Quick Add — robust Saving… indicator + $0 allowed** and Help **Cash Flow → Quick add**.

**V1.1 — Retirement Profile Integration (DOB source of truth)** — shipped end-to-end (commits `92c8673` → `6d25c0e`). Profile gained **Date of Birth** + full spouse/partner block (`Spouse Name / Email / Phone / Address / Date of Birth`) in the flat `INPUT - Settings` store. Retirement current ages are now **display-only** and derived **only** from Profile DOB: the editable Retirement Basics form was removed, the `needsProfileDob` readiness state replaces the old `needsHouseholdBasics` gate, the **Open Profile** CTA routes users to the missing input, the DOB parser accepts both Date objects and `YYYY-MM-DD` strings (fixing the silent Sheets-auto-date coercion), spinner arrows are gone (plain read-only divs with DOB hint text), and new `INPUT - Retirement` sheets no longer seed the now-unused `Your Current Age` / `Spouse Current Age` rows. Populated workbooks are preserved byte-for-byte: legacy age rows are left inert, no forced migration, and the hardcoded retirement-sheet formatting ranges were shifted to match the new layout. Backend `saveRetirementBasics` is a friendly-error stub for stale clients. See `SESSION_NOTES.md → V1.1 — Retirement Profile Integration (DOB Source of Truth)` for the detailed phase record.

**Activity ledger / UI (unnumbered)** — `house_expense` logging; no double ledger row when House Expense also writes Cash Flow; Activity **Type** filter + **getActivityDashboardData**; 20-row paging; inline date fields; Debt Planner email + Help **Debt Planner email**; Pay now/soon respect Cash Flow “handled” for current month; **Phase 3 Upcoming** activity events + no duplicate **`quick_pay`** when pushing from Upcoming.

**Bank Accounts (unnumbered)** — **Add new** path shipped (**`bank_accounts.js`**, dashboard + sidebar HTML/JS); **`bank_account_add`** activity; Help + panel title cleanup (see **Done (recent)** above for pointers).

**House Values (unnumbered)** — **Add new house** path shipped (**`house_values.js`**, dashboard + sidebar HTML/JS). Writes **INPUT - House Values** + **SYS - House Assets** (neighbor row formatting copied) and auto-creates **HOUSES - {House}** with canonical expense headers + column widths cloned from an existing HOUSES tab. Transactional rollback on partial failure. **`house_add`** activity event (Type **House Expenses**, sub-label **House added**). Duplicate-name validation is inline with a **`.field-error`** block under the House name input and focuses + selects the field. **Properties → House Expenses** selector refreshes on every navigation (`Dashboard_Script_Render.html`) so new houses are immediately usable. See **SESSION_NOTES.md § Assets → House Values: Add new house + integration polish** and Help **Assets → House Values** / **Activity log** / **HOUSES sheets** / **Sheet names**.

**5.** Fix SKIP issue in the Due Payments — adds 0 but does not refresh the screen (BUG). *(Marked done in prior testing; skip flow + UI refresh addressed.)*

**9.** Credit card should always list regardless of value in the Input Debts since we might have charged to them but not showing up or is that already there? *(Marked done.)*

**11.** New request on anything in debt other than the loans we should subtract that amount from the balance as long as it does not go < 0. If <0 then set that value to 0 after the payment is done. *(Marked done.)*

**17.** **Codebase — removed unused HTML** (done in repo): `Dashboard_Script_DueCards.html`, `Dashboard_Script_Core.html`, `Dashboard_Script_Utils.html` — were not referenced by any `includeHtml_` or `createHtmlOutputFromFile`. *Revert from git if a mirror is needed again.*

**18.** **HtmlService includes** — Documented in `WORKING_RULES.md` § HtmlService includes (`includeHtml_` + `getRawContent()`; no nested template tags in fragments). Cross-reference in `PROJECT_CONTEXT.md`.

**23.** **Light safety net** — Manual checklist + `rg` include/orphan checks in `TESTING_PLAN.md` § Light safety net; notes on `PlannerDashboard.html` vs web app drift.

**2.** **Donations UI** — **Cash Flow → Donations** tab: append rows to **INPUT - Donation** by tax-year block (`donations.js`, `Dashboard_Script_Donations.html`, Help **Donations**). *(Sidebar-only UI not required for this item.)*
