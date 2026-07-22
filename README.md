# CashCompass

A personal financial planning app built on Google Sheets + Google Apps Script, with a web dashboard (`doGet`) and a spreadsheet sidebar. Tagline: *Guiding your money decisions.*

This README is the entry point. It does not re-explain the app — it routes you to the right doc.

---

## Start here

1. **Read `WORKING_RULES.md` first.** It defines the current phase (Central App live + Family Beta readiness) and the rules every change must follow — one issue at a time, minimal/localized/safe, no `doGet`/`includeHtml_`/snapshot-shape or destructive sheet changes without explicit approval, always consider both **blank** and **populated** workbooks, and (for Central App work) the active Central App Transition Rules.
2. **Then skim `PROJECT_CONTEXT.md → Current phase`** for the live product state and the canonical tab-by-tab behavior.
3. **Before starting any change,** check `ROADMAP.md` for the current priority stack (P0–P4), then `TODO.md → Product Maturity Stages` for the detailed stage + engineering priorities (detailed phases in `→ Launch Readiness Roadmap`), and `TODO.md → V1.2 polish backlog` for small-polish picks.
4. **After each implementation step,** run the blank + populated manual checks in `TESTING_PLAN.md`.
5. **Work one milestone at a time** — see **Milestone Discipline** (`ENGINEERING_STANDARDS.md → §11`): finish the current milestone before starting the next; record discoveries in `ROADMAP.md` instead of implementing them immediately.

If you are onboarding a contributor (or yourself after a break), `INIT_PROMPT.md` is the minimal reading list; `FIRST_RUN.md` is the smoke check.

---

## Documentation map

### Primary documentation hierarchy

These four documents are the project's top-level reference set. Read them top-down: vision → sequencing → current work → current state.

- **`PRODUCT_VISION.md`** — defines the **long-term product**: why CashCompass exists, where it is going, its differentiators, principles, and the Version 1 vs Version 2 boundary. The highest-level product document.
- **`ROADMAP.md`** — the **priority stack (P0–P4)**: the authoritative view of what comes next and in what order.
- **`BETA_10_OUT_OF_10_PLAN.md`** — the quality-first scorecard and release map: measurable financial, safety, UX, performance, evidence, operations, and monetization-readiness gates.
- **`TODO.md → Product Maturity Stages`** — the detailed **stage roadmap**: implementation order (Stage 1–6, priorities, dependencies, effort).
- **`TODO.md`** (current work + backlog) — defines the **current engineering work**.
- **`PROJECT_CONTEXT.md`** — defines the **current technical state** (live architecture, tab behavior, phase).

`PRODUCT_VISION` explains *why*; `ROADMAP.md` explains *priority*; the stage roadmap explains *what order in detail*; `TODO` is *what we're building now*; `PROJECT_CONTEXT` is *where things stand technically*. Together they are the primary documentation hierarchy; everything below adds detail.

### Core (read these; they reflect the current state)

- `PRODUCT_VISION.md` — long-term product vision, positioning, principles, Version 1 definition.
- `WORKING_RULES.md` — working rules + current phase.
- `PROJECT_CONTEXT.md` — live architecture, tab behavior, current phase.
- `TESTING_PLAN.md` — manual test discipline (blank + populated two-track).
- `FIRST_RUN.md` — first-open smoke check.
- `INIT_PROMPT.md` — agent / contributor bootstrap reading list.

### Planning (what's next)

- `ROADMAP.md` — **the authoritative at-a-glance priority stack (P0–P4)**: P0 Project stabilization → P1 Validator Phase 2 → P2 Financial Model Accuracy (**House Financial Accuracy**) → P3 Performance → P4 Future features. Sets **priority and sequence**; carries the full House Financial Accuracy spec.
- `TODO.md` — Product Maturity Stages (detailed **Stage 1–6** roadmap + Current Engineering Priorities + Beta Gate) → **UX Backlog (Version 1)** (permanent home for opportunistic product-quality polish) → Launch Readiness Roadmap (historical Phase 1–7 detail) + V1.2 polish backlog + historical backlog. (Priority ordering: see `ROADMAP.md`.)
- `ENHANCEMENTS.md` — product-level rationale, phase history, Active / Next / Later mirror.
- `GOLDEN_WORKBOOK.md` — the **Golden Workbook** standard: the production workbook is the visual source of truth; the four **design families**; how convergence decisions are made and maintained.
- `WORKBOOK_PARITY_CHECKLIST.md` — per-sheet **Golden Workbook Convergence** status (audit ratings ★★★★★ Golden Reference / ★★★★☆ Production Ready, plus COMPLETE / MINOR / MAJOR / UNKNOWN), design family, gaps, effort, priority, and the Golden Workbook Audit screenshot list. First audit complete 2026-07-06 (ten core sheets); Validator-driven engineering convergence complete for the Operational / Financial Ledger / SYS / Special families (2026-07-12). Supersedes the (stale) `GENERATED_SHEET_FORMATTING_POLISH_PLAN.md`.
- `VALIDATOR_ARCHITECTURE.md` — the read-only **Validator** subsystem (admin-gated, default-off): Golden↔Central formatting parity, the **recommendation engine**, scoped family runners, and **Phase 2 Workbook Health**. Provisioning, Workbook Drift, Schema Evolution V1, Formula, Conditional Formatting, Named Ranges, the formal schema registry, and aggregate Workbook Health are implemented and runtime-proven on a Restricted populated disposable workbook at isolated Central `@122`.
- `TEST_HARNESS_ARCHITECTURE.md` — the developer-only **Test Harness / Regression Runner** (the writer counterpart; default-off): disposable-workbook lifecycle, fail-closed target guard, scenario packs, and release evidence. First-Run UX E2E, Populated Dashboard E2E, and Recovery Live are runtime-proven through isolated `@135`; the Validation console is the consolidated suite/evidence surface. `TEST_PRODUCTION_PATH_AUDIT.md` enforces the real-code-first test policy.
- `TESTING_URLS.md` — authoritative URL registry for the bounded dashboard, Central Beta, isolated validation deployment, consolidated Validation console, and guarded disposable-account browser runners.
- `REGRESSION_SUITE_PLAN.md` — the **forward-looking end-to-end test-suite roadmap** (plan only): **eighteen packs** in four bands (Foundational · Whole-system · Non-functional · Recovery & gates — incl. Bills Recurrence, Income, Investments, Retirement, Houses, Dashboard E2E, System Integrity, Multi-Year, Edit/Delete, Performance, UI, Security/Safety, Recovery, Import/Migration, Release Certification), per-module coverage matrices, reusable fixture families, the scenario-model contract, recommended build order, and the two enablers (functional-assertion capability + ss-injection refactor). The suite is the intended required release gate.
- `REGRESSION_SCENARIOS.md` — the **historical-bug registry** (permanent project memory): every fixed production bug becomes a permanent `REG-###` regression scenario (a subset of `REGRESSION_SUITE_PLAN.md`'s REGRESSION level).
- `FUNCTIONAL_ASSERTION_ARCHITECTURE.md` — **design only:** the Test Harness **functional-assertion framework** (enabler E0a) — the numeric/business-logic counterpart to the read-only Validator: sources (read) + pure comparators (`equals` / `near` / `dateEquals` / `reconciles` / …) + a per-module result envelope, `expectedOutcome(ctx)` scenario integration, the gate/aggregation model, and the recommended first slice.
- `RELEASE_READINESS.md` — the pre-release **go/no-go report** format + bounded workflow (`Release Readiness gate = Harness × Validator`); all required suites are implemented and runtime-proven, but the verdict remains NOT READY pending performance-budget ratification, console controls, and final orchestration proof.
- `VALIDATION_TESTING_CONSOLE.md` — the admin-only **Validation & Testing** page (route `?view=validation`): the sole operator console for Validator / Workbook Health checks, all eleven registered Test-Harness suites, and the Release Readiness verdict, with an explicit per-target safety readout. Server functions return structured report objects; account-specific browser routes are temporary guarded execution adapters, not separate test dashboards. **V1 implemented and Workbook Health runtime-proven**; bounded aggregate Release Readiness controls/verdict remain future.
- `CENTRAL_APP_WORKBOOK_DIAGNOSTICS_PLAN.md` — active Phase 2 design: read-only duplicate / orphan / stale workbook detection, classification, and admin audit (Phase 2A), with Phase 2B recovery scope in its `§10`.

### History (what shipped)

- `SESSION_NOTES.md` — V1 trust baseline summary at the top, then the V1.1 retirement profile integration close-out; older phase notes live under `## Archive (historical notes)`.

### Reference (durable design / policy — not active work)

- `SystemArch.md` — one-read system briefing for new contributors.
- `GoingToProduction.md` — release-readiness strategy (Goal A vs Goal B, "three bars of 1.0").
- `SECURITY.md` — deployment + threat-model checklist.
- `ONBOARDING_AND_INPUT_STRATEGY.md`, `ONBOARDING_TODO.md` — long-term onboarding / wizard design (Setup / Review is already shipped).
- `COMMIT_RULES.md` — commit policy.
- `Dashboard_Help.html` — in-app user-facing help.

---

## Current Product Status (July 2026)

- **Stage:** **Stage 3 — Beta Readiness (current).** **Stage 1 (Core Platform), Stage 2 (Product Hardening), and P0 Project Stabilization are complete**, and **Recurrence Engine V2 (Weekday & Biweekly scheduling) shipped 2026-07-09.** Maturity (estimated): **Family Beta Readiness ~97–98% · External / Public Beta Readiness ~92%**. Recovery Validation 6F is complete. The current engineering milestone is the **remaining P1 Validator/Test Harness/Release Readiness scope**; `ROADMAP.md` is authoritative for sequence, with detailed Beta Gate work in `TODO.md → Product Maturity Stages`.
- **Architecture:** Central App operational — **stable, family-beta capable**; production / bound workbook remains protected.
- **Completed (working in central mode):** Provisioning, Workbook Mapping, Dashboard, Planner, Assets, Properties, Cash Flow, Bills, Debts, Income, Activity, Email.
- **Completed this stage (Stage 2 — Product Hardening, 2026-07-02):**
  - **Recovery — destructive/admin paths validated:** executed **Admin Clear**, **mapping removal**, **reverse-index removal**, **repair audit history**, **bootstrap reprovision**, **Welcome routing**, **empty-dashboard validation**, **recovery routing**, **Reconnect**, **Central admin validation**, **`ADMIN_EMAILS` validation**. *(Recovery validation completed today.)*
  - **Financial Integrity — foundation:** **Audit Framework** (read-only, admin-gated) + **Debt Audit** + **shared debt Active helper (Phase 2)** + **`NOT_INITIALIZED`** state.
  - **Performance:** **Bills Due performance optimization (~51s → ~5.6s)**.
- **Earlier completed:** Diagnostics (Phase 2A), Debt parity (3.1 TOTAL DEBT), Bank Accounts parity (3.2a Total Accounts + 3.2b Delta), Add-New dropdown fix, Identity markers (6A/6B), Bills Due recurrence overhaul (Weekly/Biweekly occurrence expansion, AutoPay star, overdue styling, skip fix), **Bills Due performance optimization (~51s → ~5.6s)**, **Recurrence Engine V2 — Weekday & Biweekly scheduling** (weekday-aware Weekly + anchor-driven Biweekly, `Weekday`/`Anchor Date`/`Schedule Effective Date` columns, prospective-only schedule changes, AutoPay `LockService` hardening), **Bills Due → Pay occurrence bridge**.
- **Current active work:** P0 Project Stabilization closed after isolated `@114` passed both blank/fresh and representative populated-workbook validation. Populated-fixture hardening passed on `@117`; Bills Pay E2E and Performance Planner passed at `@120`; Workbook Health passed at `@122`; First-Run UX E2E passed at `@129`; Populated Dashboard E2E passed at `@133`; and Recovery Live passed 9/9 at `@135`. A permanent 20-pair Performance Planner percentile suite is available on isolated `@136`; its campaign is paused after six confirmed pairs and its budget remains unratified. Beta remains pinned to `@106`; `TEST_HARNESS_ENABLED` and performance timing are OFF, and the sole admin remains unchanged. The next active P1 item is Release Readiness console controls, followed by completing performance-budget ratification and the final bounded verdict. P2 financial truth and beta-critical P3 UX/performance follow. The quality baseline is 7.5/10; broad or monetized beta waits for the ≥95/100 gate in `BETA_10_OUT_OF_10_PLAN.md`. Bills Due → Pay natural cohort evidence remains pending; do not create fake financial activity to force it.
- **Beta Gate criteria (unordered requirements — all must pass before broad beta):** Golden Workbook Convergence · **Financial Integrity Phase 3** (canonical basis + Planner/Dashboard/Rolling convergence to $0.01 + Asset/Planner/Dashboard audit modules — *the numbers must reconcile*) · Validator/Test Harness/Release Readiness · Recovery completion ✅ · runtime regression evidence · Workbook/UX/performance polish · privacy/support/operations readiness · supervised-cohort proof. Remaining recovery slices: 6D.2b Create New Workbook, 6E.2 Admin Set Mapping.
- **Validation-surface note:** the Script Properties UI may lag runtime mapping changes during active testing; **Admin Diagnostics is the authoritative validation surface**.
- **Bound safety:** **SAFE TO PUSH TO BOUND** — recovery code is `CENTRAL_MODE`-gated and fail-closed; bound workbook unaffected. Precondition: verify allow-list + bound deployment config before any future bound deploy. See `PROJECT_CONTEXT.md → Bound Project Safety`.
- **Version 2 / Future Platform (Stage 6, not required for beta):** Chat / Assistant, Operations Dashboard, operational metrics, monitoring, analytics, Paid Product framework.

Full picture: `PROJECT_CONTEXT.md → Current Product Status (July 2026)`, `→ Workbook Identity & Recovery (live + roadmap)`, `→ Flag Registry`, `→ Recovery Validation Inventory`, and `→ Bound Project Safety`. Roadmap: `TODO.md → Product Maturity Stages`.

> **Roadmap-label note:** the Identity & Recovery sub-series **Phase 6A–6F** is the detailed expansion of the macro roadmap's **Phase 2B — Workbook Recovery** — it is *not* the macro **"Phase 6 — External Beta Readiness"** (now Stage 5).

---

## Current working mode

**Central App live + Family Beta readiness.** The Central App architecture is operational — `getUserSpreadsheet_()` is a real resolver that, in central mode (`CENTRAL_MODE`), provisions each allow-listed user their own Drive-owned workbook on first access (runtime-validated). Family Beta styling has shipped across the audited families — Bank Accounts, Debts, Bills, Upcoming Expenses, Cash Flow, SYS - Accounts, Settings, Donation, LOG - Activity — via the **Validator-driven Golden Workbook convergence milestone** (2026-07-12; see `VALIDATOR_ARCHITECTURE.md` + `WORKBOOK_PARITY_CHECKLIST.md`). The V1 trust baseline and V1.1 retirement profile integration remain the stable foundation.

The V1.2 change discipline still applies to every edit, plus the now-active Central App migration discipline:

- One issue at a time. No large refactors. No `doGet` / `includeHtml_` / snapshot-shape changes unless explicitly approved. No destructive sheet changes. Preserve existing populated-workbook behavior.
- Central App changes follow `WORKING_RULES.md → Central App Transition Rules` (active): one module at a time, bound + central modes coexist, no reformatting of existing workbooks.
- Every fix is minimal, localized, safe, and exercised against **both** a blank and a populated workbook (see `TESTING_PLAN.md`).
- New work is pulled from `TODO.md → Launch Readiness Roadmap`.

Authoritative sources: `WORKING_RULES.md → Current phase` + `→ Central App Transition Rules`, `PROJECT_CONTEXT.md → Current architecture — Central App (live)`, and `ENHANCEMENTS.md → § 0. Current phase`.

---

## Roadmap (Stage model — authoritative)

Authoritative source: `TODO.md → Product Maturity Stages` (Stage 1–6, with per-stage remaining work, priority, dependencies, effort). High-level mirror: `PROJECT_CONTEXT.md → Product Maturity Stages (high-level)`. Short mirror:

- **Stage 1 — Core Platform** *(✅ complete)* — Central App, provisioning, mapping, all core modules + lifecycle, Bills Due recurrence + **performance (~51s → ~5.6s)**.
- **Stage 2 — Product Hardening** *(✅ complete)* — Recovery destructive/admin paths validated (Admin Clear + mapping/reverse-index removal + repair audit + bootstrap reprovision + Welcome routing + empty-dashboard + recovery routing + Reconnect + Central admin + `ADMIN_EMAILS`); Financial Integrity foundation (Audit Framework + Debt Audit + shared Active helper + `NOT_INITIALIZED`).
- **Stage 3 — Beta Readiness** *(current)* — Recovery Validation 6F is complete; full P0 matrix passed with flags OFF. Read-only Orphan detection is P1. The broader Beta Gate still includes beta-readiness evidence, remaining Validator/Release Readiness work, and Financial Integrity convergence.
- **Stage 4 — Supervised Family Validation Cohort** — limited, consented users; close support; UX/loading feedback; recovery slices (6D.2b / 6E.2); workflow stabilization. This is learning evidence, not broad-release authorization.
- **Stage 5 — 10/10 Beta Release Candidate and External Beta** — exact-candidate quality gate; support, privacy, operations, invite onboarding, user lifecycle, scalability, and monetization foundations; then broader invited use. Money Plan Phase 2 and Income Expected/Due remain Version 1 differentiators.
- **Stage 6 — Version 2 / Future Platform** — Chat / Assistant, Operations Dashboard, expanded monitoring/analytics, billing activation, Account Aggregation, and other product expansion. The foundations needed to enable these safely are established before broad beta.

**Recovery flags:** `CENTRAL_AUTO_ADOPT`, `CENTRAL_RECOVERY_ACTIONS`, `CENTRAL_ADMIN_REPAIR` — all default OFF (see `PROJECT_CONTEXT.md → Flag Registry`). Small-polish picks are retained in `TODO.md → V1.2 polish backlog` and fold into Stage 4 UX polish.

---

## Contributing

- Never commit or push unless explicitly asked (see `COMMIT_RULES.md` and the `git-no-autonomous-stage-commit` rule in `.cursor/rules/`).
- Keep user-facing copy aligned with the V1 copy consistency pass: short, trust-safe, no internal sheet names, no "Error:" prefixes on already-styled errors.
- When in doubt about scope, re-read `WORKING_RULES.md → Current phase` before writing code.

---

## Architecture direction (Central App — live)

CashCompass now runs as a **centralized service** alongside the legacy bound mode. In central mode, users access a single deployed web app and each allow-listed user gets their own Drive-owned workbook provisioned automatically on first run — no script copying, automatic updates, no version drift. This is **operational and runtime-validated**, not a future aspiration. The two modes coexist via the `CENTRAL_MODE` flag and deployment-pinning.

Current description: `PROJECT_CONTEXT.md → Current architecture — Central App (live)`. Per-slice history: `SESSION_NOTES.md → Current State — Post V1.2 Prep` and the `CENTRAL_APP_*.md` docs. The migration discipline is now the **active** policy in `WORKING_RULES.md → Central App Transition Rules`.

A free + paid tier model (gating advanced features like bank import / sync while keeping core planning free) remains **future** — scheduled as **Phase 7 — Paid Product Readiness**. See `ENHANCEMENTS.md → Future direction — Monetization` and `WORKING_RULES.md → Monetization Rules`.

---

## Future Initiative — Account Aggregation & Transaction Import

A strategic, post-beta product direction that extends the existing Bank Import infrastructure (account matching/linking, External ID support, balance-snapshot application, import staging). **Vision:** Phase 1 — connect bank/credit-card accounts, auto-discover accounts, refresh balances; Phase 2 — import + categorize transactions, suggest Cash Flow entries, detect recurring bills; Phase 3 — CashCompass as the primary financial aggregation layer (automated monthly updates, spending analysis, budget insights, net-worth automation).

**Status:** concept validated, partially scaffolded, **not actively in development.** **Priority:** Post-Recovery Validation, Post-Family Beta, before Paid Product scaling. **Not a blocker** for Recovery Validation, Family Beta, or External Beta. Full detail: `PROJECT_CONTEXT.md → Future Initiative — Account Aggregation & Transaction Import` and `TODO.md → Future Initiative — Account Aggregation & Transaction Import`.

---

## Weekly/Biweekly Weekday Recurrence Support — ✅ DELIVERED (Recurrence Engine V2, 2026-07-09)

**Status: shipped and runtime-validated.** True weekday-aware recurrence for Weekly and Biweekly bills. The original single-`Repeat Day`-field proposal was implemented as separate **`Weekday`** + **`Anchor Date`** columns (anchor-driven true 14-day Biweekly cadence), plus a **`Schedule Effective Date`** column so schedule changes apply going forward only. Includes weekday UI (Weekly + Biweekly), Anchor Date validation (must fall on the selected weekday, no silent correction), Bills schema self-heal + formatting parity, and AutoPay `LockService` concurrency hardening. Backward compatible — blank fields fall back to the legacy Due Day behavior; Monthly and other frequencies unchanged.

Full detail: `PROJECT_CONTEXT.md → Weekly/Biweekly Weekday Recurrence Support — DELIVERED` and `ENHANCEMENTS.md → Delivered — Recurrence Engine V2`. Small non-blocking follow-ups: `TODO.md → UX Backlog (Version 1) → Bills Scheduling UX`.
