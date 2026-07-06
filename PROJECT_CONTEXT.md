# Samer Financial Planner - Project Context

We are building **CashCompass** — a Google Apps Script web dashboard (and spreadsheet sidebar) for personal finance / property / debt planning. Tagline: *Guiding your money decisions.*

## Current Product Status (July 2026)

- **Stage:** **Stage 3 — Beta Readiness (current).** **Stage 1 (Core Platform) and Stage 2 (Product Hardening) are complete.** Maturity (estimated): **Family Beta Readiness ~97–98% · External / Public Beta Readiness ~92%**. The remaining pre-beta work is the **Beta Gate** — the **Validation Agent** (automated release gate), **Financial Integrity convergence**, and the remaining **Recovery adoption-path validation** — plus onboarding/UX polish; not major feature development. Authoritative stage roadmap (Stage 1–6) + Current Engineering Priorities + Beta Gate live in `TODO.md → Product Maturity Stages`; a high-level mirror is in `## Product Maturity Stages (high-level)` below.
- **Architecture:** Central App operational — **stable, family-beta capable**. The production / bound workbook remains protected (bound mode unchanged); the central architecture is operational and runtime-validated.
- **Completed (working in central mode):** Provisioning, Workbook Mapping, Dashboard, Planner, Assets, Properties, Cash Flow, Bills, Debts, Income, Activity, Email.
- **Recently completed (this initiative):**
  - **Diagnostics** — Phase 2A Admin Diagnostics (read-only workbook detection / classification / mapping + orphan audit, admin-gated).
  - **Debt parity** — Phase 3.1 TOTAL DEBT summary row.
  - **Bank Accounts parity** — Phase 3.2a Total Accounts row + Phase 3.2b Delta row.
  - **Add-New dropdown fix** — Bank Accounts / Debts Type dropdowns now merge canonical + server-provided options (no longer collapse after an add).
  - **Identity markers** — Phase 6A Workbook Identity & Recovery design + Phase 6B Workbook Identity Markers (durable identity markers + reverse index + `SYS - Meta`, with admin marker diagnostics; no provisioning/resolution behavior change).
  - **Recovery stack (shipped behind flags, default OFF):** Phase 6C.1 Adopt-Before-Create, Phase 6D.1 Recovery Page, Phase 6D.2a Reconnect, Phase 6E.1 Admin Inspect + Clear Mapping. All committed; **healthy-path validated (2026-06-09)** and **reconnect end-to-end validated (2026-06-11)** — a real stale mapping was induced, the recovery page rendered and blocked the dashboard, **Reconnect Existing Workbook executed and the dashboard reloaded successfully**, and Admin Diagnostics confirmed the live mapping + reverse index + real workbook. The blank-iframe reconnect reload bug was fixed (startup routing now re-runs in-app). The **executed Admin Clear Mapping** path was **validated end-to-end (2026-07-02)** — mapping removal, reverse-index removal, repair audit history, bootstrap reprovision after clear, Welcome routing, dashboard empty-state, Financial Integrity `NOT_INITIALIZED` handling, Central admin routing, and `ADMIN_EMAILS`. **Remaining recovery-validation paths** (Auto-Adopt, Ambiguous recovery, Name-only adoption, Orphan workbook) **still pending** — see `## Flag Registry`, `## Recovery Validation Inventory`, and `TODO.md → Open testing inventory`.
  - **Bills Due recurrence overhaul (2026-06-12, shipped + family-beta validated):** Weekly/Biweekly bills now use **true occurrence expansion** (individual occurrences at their normal per-occurrence amount on the Due Day anchor + 7/14-day steps; the rejected monthly-burden averaging was reverted), with **per-occurrence autopay accumulation/dedupe** into the single monthly Cash Flow cell (manual-protection preserved). **Skip suppression for expanded recurrence completed** — `skipDashboardBill` now logs the `bill_skip` event regardless of cell state (the `$0` write stays blank-guarded), so a skipped Weekly/Biweekly occurrence clears and stays gone while future occurrences remain. **AutoPay + overdue visual indicators completed** — gold ⭐ star on AutoPay cards, light-red styling on overdue cards. Weekday-based recurrence ("Repeat Day") remains a documented **future** enhancement, not implemented.
  - **Manage Debts (2026-06-15/16, shipped + runtime-validated):** A user-friendly debt-maintenance experience under Planning → Debts (mirrors Manage Bills) so users don't hand-edit the protected `INPUT - Debts` sheet. **Phase 1** — `[Update] [Add new] [Manage Debts]` toggle; sortable debt table; inline multi-field **Edit** (Type / Balance / Due Date / Credit Limit / Credit Left / Minimum Payment / Interest Rate; Account Name read-only; Acct PCT Avail recalculated server-side; one consolidated `debt_update` log); **Stop tracking** reuses `deactivateDebtFromDashboard`. **Phase 1.5 — Rename Debt** — a separate Rename modal performs a coordinated, lock-guarded rename of the `INPUT - Debts` row **and** the matching `Type = Expense` Payee cell across **all** `INPUT - Cash Flow YYYY` sheets (Payee cell only; month values/formulas untouched), with stale-row protection, **duplicate-name protection** (active + inactive, case-insensitive → *"Another debt account already uses this name. Rename was not completed."*), a TOTAL-DEBT/reserved guard, one `debt_rename` Activity Log row (no history rewrite), and best-effort revert on partial failure. No schema changes. **Merge Debt Accounts** is documented as a separate **future** enhancement (deliberately distinct from block-on-duplicate Rename).
- **Completed this stage (Stage 2 — Product Hardening, 2026-07-02):**
  - **Recovery (destructive/admin paths):** executed **Admin Clear** + mapping removal + reverse-index removal + repair audit history + bootstrap reprovision + Welcome routing + dashboard empty-state + recovery routing + Reconnect + **Central admin validation** + **`ADMIN_EMAILS` validation**. *(Recovery validation completed today.)*
  - **Financial Integrity (foundation):** **Audit Framework** (read-only, admin-gated) + **Debt Audit** + **shared debt Active helper (Phase 2)** + **`NOT_INITIALIZED`** state.
  - **Performance:** **Bills Due performance optimization (~51s → ~5.6s)** (per-request Cash Flow row-map + Activity Log dedupe caching).
- **Current focus — Stage 3 Beta Readiness (the Beta Gate):** (1) **Validation Agent** — the automated release gate (highest-priority build); (2) **Financial Integrity convergence** — canonical basis + Planner/Dashboard/Rolling convergence to $0.01 + Asset/Planner/Dashboard audit modules; (3) **Recovery Validation — remaining adoption paths** (Auto-Adopt + Ambiguous + Name-only adoption + Orphan on a disposable account, then flags OFF). Remaining recovery slices (Stage 4): 6D.2b Create New Workbook, 6E.2 Admin Set Mapping.
- **Status snapshot (2026-07-02):** Central Architecture ~95%+; Recovery Architecture ~90% implemented; **Recovery destructive/admin paths validated** (only Auto-Adopt / Ambiguous / Name-only adoption / Orphan remaining); **Financial Integrity foundation shipped** (Audit Framework + Debt Audit + shared Active helper + `NOT_INITIALIZED`; convergence remaining); **Validation Agent not started** (highest-priority Stage 3 build); Family Beta Readiness ~97–98%; External Beta Readiness ~92%.
- **Validation-surface note:** the Apps Script **Script Properties UI may not immediately reflect runtime mapping changes during active testing**; **Admin Diagnostics is the authoritative validation surface** for mapping/reverse-index state.
- **Future:** External beta readiness / hardening, family-beta expansion + user-lifecycle handling, Chat Assistant, Paid Product framework.

Roadmap: `## Launch Readiness Roadmap (high-level)` below (detail in `TODO.md → Launch Readiness Roadmap`). Live architecture: `## Current architecture — Central App (live)` below. Workbook recovery summary: `## Workbook Identity & Recovery (live + roadmap)` below.

> **Roadmap-label note (disambiguation):** the **Workbook Identity & Recovery** sub-series uses working labels **Phase 6A–6E**. These are the detailed expansion of the macro roadmap's **Phase 2 — Family Beta Hardening → 2B Workbook Recovery**, and are **not** the same as the macro **"Phase 6 — External Beta Readiness."** Where this doc says "Phase 6A/6B/6C…" it means the Identity & Recovery track.

## Domain Completion Matrix (snapshot 2026-07-02)

A high-level management/status dashboard. Percentages are rough completion estimates, not precise metrics. This is the at-a-glance view only — roadmap detail lives in `## Product Maturity Stages (high-level)` below and `TODO.md → Product Maturity Stages`.

### Core Finance Functionality — ~97%

Dashboard, planner, assets, properties, cash flow, bills, debts, income, activity, and email all work in central mode at production parity.

- Minor generated-sheet parity / formatting fixes
- Edge-case testing

### Central Architecture — ~96%

Central App operational and runtime-validated — per-user provisioning, workbook mapping, resolver routing, and allow-list gating are live; the bound / production workbook stays protected.

- Tier-2 `getActiveSpreadsheet()` migration cleanup (full dashboard)
- Bound deployment cleanup / manifest revert once central is primary
- Optional optimization

### Financial Integrity — foundation shipped · convergence remaining

Read-only, admin-gated **Audit Framework** + **Debt Audit** + **shared debt Active helper (Phase 2)** + the **`NOT_INITIALIZED`** state are shipped. The framework observes calc-basis differences neutrally; the convergence work (declaring a canonical basis and reconciling to it) is the remaining Beta-Gate item.

- Canonical financial basis (declare the authoritative model)
- Planner / Dashboard / Rolling Debt convergence to $0.01
- Asset audit · Planner audit · Dashboard audit modules

### Workbook Identity & Recovery — ~90% implemented · destructive/admin paths validated

Identity markers + reverse index + the recovery stack (adopt-before-create, recovery page, reconnect, admin inspect + clear) are implemented and committed behind flags. Validated: healthy-path load, disabled-path enforcement, recovery-page render from a real stale mapping, executed Reconnect (2026-06-11), and **executed Admin Clear + mapping/reverse-index removal + repair audit history + bootstrap reprovision + Welcome routing + empty-dashboard + Central admin routing + `ADMIN_EMAILS` (2026-07-02).**

- 6F Recovery Validation — remaining: Auto-Adopt, Ambiguous recovery, Name-only adoption, Orphan workbook *(destructive/admin paths validated 2026-07-02)*
- 6D.2b Create New Workbook (designed, not implemented)
- 6E.2 Admin Set Mapping (designed, not implemented)

### Family Beta Readiness — ~97–98%

Stable and family-beta capable; provisioning proven across multiple accounts; the recovery destructive/admin paths are validated; core + lifecycle workflows + Bills Due performance shipped. Remaining work is the Beta Gate, not features.

- Validation Agent (automated release gate)
- Financial Integrity convergence
- Remaining recovery adoption-path validation
- Onboarding polish + additional beta users

### External / Public Beta Readiness — ~92%

Architecture, recovery, and core/lifecycle workflows are built; remaining gaps are the Validation Agent, regression prevention, user-lifecycle handling, and operational support.

- Validation Agent + regression prevention
- User-lifecycle handling + invite flow
- Support workflows + operational monitoring

### Paid Product Readiness — ~15–20%

Early stage — no monetization infrastructure exists yet.

- Billing
- Plans / subscriptions
- Legal (privacy policy, ToS)
- Support operations

## Product Maturity Stages (high-level)

High-level mirror; **authoritative copy lives in `TODO.md → Product Maturity Stages`** (with `## Current Engineering Priorities`, `## Shared Lifecycle Framework`, and `## Beta Gate`). The Stage model is the at-a-glance roadmap; the `## Launch Readiness Roadmap (high-level)` below is the detailed Phase 1–7 expansion that maps onto these stages.

- **Stage 1 — Core Platform** *(✅ complete)* — Central App architecture, provisioning, workbook mapping, Dashboard, Planner, Bills, Debt Management (incl. lifecycle + Rename), House Expenses, Upcoming Expenses, Activity Log, Retirement, Money Plan Phase 1, Admin Diagnostics foundation, Bills Due recurrence overhaul + **Bills Due performance optimization (~51s → ~5.6s)**.
- **Stage 2 — Product Hardening** *(✅ complete)* — **Recovery destructive/admin paths validated** (Admin Clear + mapping/reverse-index removal + repair audit + bootstrap reprovision + Welcome routing + empty-dashboard + recovery routing + Reconnect + Central admin + `ADMIN_EMAILS`); **Financial Integrity foundation** (Audit Framework + Debt Audit + shared Active helper + `NOT_INITIALIZED`); Bills Due performance. *(Convergence + remaining recovery adoption paths carried into Stage 3.)*
- **Stage 3 — Beta Readiness** *(current)* — the **Beta Gate**: (1) **Validation Agent** (automated release gate — highest engineering priority), (2) **Financial Integrity convergence** (canonical basis + Planner/Dashboard/Rolling convergence + Asset/Planner/Dashboard audit modules), (3) **Workbook Formatting & Visual Parity** (P1, L — newly provisioned workbook visually indistinguishable from production, the **Golden Workbook** / visual source of truth; **first task = Golden Workbook Audit** before any styling code — see `GOLDEN_WORKBOOK.md` + `WORKBOOK_PARITY_CHECKLIST.md`; a Family Beta quality gate, not minor polish), (4) **Recovery Validation — remaining adoption paths** (Auto-Adopt / Ambiguous / Name-only / Orphan), (5) release + onboarding review. Goal: **Family Beta Release Candidate — provably correct, recoverable, and visually production-grade.**
- **Stage 4 — Family Beta** — limited trusted users: go/no-go, Web App UX polish + loading-experience consistency, recovery slices (6D.2b / 6E.2), Shared Lifecycle rollout (Bank Accounts), collect feedback, stabilize workflows.
- **Stage 5 — External Beta** — broader invited audience: **Money Plan Phase 2** (long-term/goal planning, recommendations, forecasting, retirement integration — major V1 differentiator) + **Income Expected/Due Workflow** (income symmetry with Bills Due); support workflows, feedback, invite flow, user-lifecycle handling, scalability, remaining Shared Lifecycle rollout (Investments / Houses / Income Sources), Shared Sheet Write Utilities, Tier-2 migration cleanup.
- **Stage 6 — Version 2 / Future Platform** — Chat / Assistant, Operations Dashboard, operational metrics, monitoring, analytics, Paid Product readiness, Account Aggregation & Transaction Import. **None required for Family or External Beta.**

**Current Engineering Priorities (ranked):** 1) **Validation Agent** *(highest engineering — automated release gate)* · 2) **Financial Integrity convergence** (foundation shipped) · 3) **Workbook Formatting & Visual Parity** *(highest UX/quality for Family Beta — production-indistinguishable provisioning)* · 4) **Recovery Validation — remaining adoption paths** · 5) **Shared Lifecycle Framework rollout** (Debt reference → Bank Accounts → Investments → Houses → Income Sources) · 6) **Product differentiators (V1, External Beta): Money Plan Phase 2 + Income Expected/Due Workflow** · 7) Remaining UX polish.

**Beta Gate (release-readiness target):** before broader beta every release must pass **Financial Integrity** (foundation shipped; convergence remaining), **Recovery Validation** (destructive/admin done; adoption paths remaining), the **Validation Agent** (not started), and a **runtime regression checklist** before deployment.

**UX Backlog (Version 1):** small product-quality improvements (loading standardization, empty-state standardization, UX consistency framework, workbook visual parity, Money Plan Phase 2) live in the permanent **`TODO.md → UX Backlog (Version 1)`** — intentionally separated from engineering priorities, completed opportunistically, and **reviewed before every Family Beta milestone and before External Beta**. It is cross-referenced from the Stage roadmap so these items never disappear during a roadmap reorganization.

**Shared Lifecycle Framework:** the Debt Lifecycle (`Create → Edit → Rename → Stop Tracking → Inactive → Reactivate`) is now the reference implementation; long-term goal is to share it across Debts, Bank Accounts, Investments, Houses, Bills, and Income Sources (detail: `## Future Feature — Shared Entity Lifecycle Framework`).

## Launch Readiness Roadmap (high-level)

**Historical phase view — superseded by `## Product Maturity Stages (high-level)` above.** The Stage model (Stage 1–6) is the authoritative roadmap; **where a Phase statement conflicts with it, the Stage model wins.** Retained for the per-phase rationale. Full historical detail: `TODO.md → Launch Readiness Roadmap`. Every phase ran under `WORKING_RULES.md → Current phase` and, for central-mode work, `→ Central App Transition Rules` (active).

**Priority scale:** P0 = now / in progress · P1 = next, gates family beta · P2 = high, needed before external beta · P3 = gates external beta · P4 = post-beta / longest horizon.

- **Phase 1 — Documentation Cleanup** *(P0, ✅ complete)* — `PROJECT_CONTEXT.md` + `TODO.md` are the single authoritative source of truth for architecture, status, and roadmap (kept current by ongoing doc passes).
- **Phase 2 — Family Beta Hardening** *(✅ complete — Stage 2)* — per-user provisioning made robust, recoverable, and observable. **2A — Workbook Diagnostics** ✅. **2B — Workbook Recovery** (Workbook Identity & Recovery series): 6A design ✅, 6B markers ✅, recovery stack (6C.1 / 6D.1 / 6D.2a / 6E.1) implemented + flag-gated OFF, with **destructive/admin paths validated** (healthy-path 2026-06-09, reconnect 2026-06-11, executed Admin Clear + audit + reprovision 2026-07-02). Remaining adoption-path validation (Auto-Adopt / Ambiguous / Name-only / Orphan) is a **Stage 3** Beta-Gate item; remaining slices 6D.2b + 6E.2 are **Stage 4**. Design in `CENTRAL_APP_WORKBOOK_DIAGNOSTICS_PLAN.md`.
- **Phase 3 — Workbook Totals Project** *(✅ complete for current scope — Stage 1)* — canonical summary rows: TOTAL DEBT (3.1), Bank Accounts Total Accounts (3.2a), Bank Accounts Delta (3.2b). Investments / House Values summary parity is a later follow-up if needed.
- **Phase 4 — Chat Assistant v1** *(→ Stage 6 — Version 2)* — read-only NL assistant over canonical read models (write-capable is later). **Not required for Family or External Beta.**
- **Phase 5 — Web App UX Improvements** *(Stage 4)* — onboarding, empty-states, error handling, guidance, dashboard + planner polish, and help/content cleanup to reduce cognitive load.
- **Phase 6 — External Beta Readiness** *(Stage 5)* — wider invited external beta (support, feedback, invite onboarding, recovery, diagnostics, beta-user management). *(Distinct from the Identity & Recovery "6A–6E" labels.)*
- **Phase 7 — Paid Product Readiness** *(Stage 6 — Version 2)* — monetize (pricing/subscription, entitlements, plan enforcement, privacy policy, ToS, support, monitoring).

**Workbook Identity & Recovery (6A–6F) — expansion of Phase 2B, the active near-term track:**

- **6A — Workbook Identity & Recovery design** *(✅ complete)* — identity-marker model, adopt-before-create decision tree, recovery UX, admin-repair safeguards, and migration strategy.
- **6B — Workbook Identity Markers** *(✅ complete)* — durable identity markers + reverse index + `SYS - Meta`, lazy backfill, admin marker diagnostics. **No provisioning/resolution behavior change.**
- **6C.1 — Adopt-Before-Create** *(✅ implemented, flag `CENTRAL_AUTO_ADOPT` default OFF)* — when a mapping is lost but exactly one strict candidate workbook exists, adopt it instead of silently creating a duplicate; ≥2 → `AmbiguousWorkbookError`.
- **6D.1 — Recovery Page** *(✅ implemented)* — display-only recovery screen for stale / ambiguous / unavailable resolution failures (no raw errors).
- **6D.2a — Reconnect** *(✅ implemented, flag `CENTRAL_RECOVERY_ACTIONS` default OFF)* — self-scoped, user-initiated relink to a single existing candidate.
- **6E.1 — Admin Inspect + Clear Mapping** *(✅ implemented, flag `CENTRAL_ADMIN_REPAIR` default OFF)* — admin-gated read-only inspect + guarded, audited, mapping-store-only clear (no Drive writes).
- **6F — Recovery Validation** *(current, P1)* — flag-on runtime validation of the full recovery stack on a disposable account, then flags OFF.
- **6D.2b — Create New Workbook** *(remaining, P1)* — self-service "start fresh" recovery action (designed; not implemented).
- **6E.2 — Admin Set Mapping** *(remaining, P2)* — guarded admin remap (designed; not implemented).

## Future Initiative — Account Aggregation & Transaction Import

A strategic, post-beta product direction captured here so it is not lost behind the current Recovery Validation work. **It is a future product capability, not a current blocker** — see the explicit note at the end of this section. Authoritative copy lives here; `README.md` and `TODO.md` mirror it.

**Foundational import infrastructure already in the codebase** (so this is an extension, not a green-field build): a **Bank Import workflow**, **account matching / linking**, **External ID support**, **balance-snapshot application**, and **import-staging concepts** (`bank_import.js`; review/Apply surface under Assets → Bank Accounts; see `TODO.md → Bank Import — status & resume plan`).

**Long-term vision (phased):**

- **Phase 1 — Connectivity & balances:** connect bank and credit-card accounts; discover accounts automatically; refresh balances; reduce manual account maintenance.
- **Phase 2 — Transactions:** import transactions; categorize transactions; suggest Cash Flow entries; detect recurring bills / subscriptions.
- **Phase 3 — Aggregation layer:** CashCompass becomes the primary financial aggregation layer — automated monthly updates, spending analysis, budget insights, net-worth automation.

**Status:** Concept validated. Partially scaffolded (Bank Import infrastructure exists). **Not actively in development.**

**Priority:** Post-Recovery Validation, Post-Family Beta, and **before Paid Product scaling** — the connectivity / import surface is the natural first paid-tier feature (see `ENHANCEMENTS.md → Future direction — Monetization` and `TODO.md → Monetization (future)`).

**Explicit note:** this is a strategic product initiative and is **NOT a current blocker** for **Recovery Validation (6F)**, **Family Beta**, or **External Beta**. Those tracks proceed independently.

## Future Enhancement — Weekly/Biweekly Weekday Recurrence Support

Authoritative copy lives here; `README.md` and `TODO.md` mirror it. **UX enhancement, not a blocker.** No implementation at this time.

**Background:** The current Weekly/Biweekly implementation generates occurrences using the existing **Due Day anchor model** (first occurrence each month = Due Day-of-month, then +7 / +14 days within the same month). This works for Family Beta but is **not weekday-aware** — it does not generate "every Sunday." It is not ideal for recurring items that are conceptually tied to a specific weekday (allowances, transfers, investments, etc.). Two identically-configured weekly bills will line up only when they share the same Due Day, and the occurrences will not land on a chosen weekday.

**Future goal:** Allow selected Weekly/Biweekly bills to recur on a specific weekday.

**Proposed design:**

- **Data model** — add an optional `Repeat Day` field on `INPUT - Bills`. Values: blank, Sunday, Monday, Tuesday, Wednesday, Thursday, Friday, Saturday.
- **Behavior:**
  - *Weekly + Repeat Day* → occurs every selected weekday.
  - *Biweekly + Repeat Day* → occurs every other selected weekday.
  - *Blank Repeat Day* → preserve current Due Day anchor behavior (backward compatible).
  - *Monthly / Quarterly / Yearly / Semi-annually / Bimonthly* → unchanged.
- **UI:**
  - Add Bill screen: show the `Repeat Day` dropdown only when Frequency = Weekly or Biweekly.
  - Edit Bill screen: allow `Repeat Day` updates.
  - Hide the field for all other frequencies.
- **Migration:**
  - Existing workbooks remain valid; existing bills continue working unchanged.
  - A new column/header may be required in `INPUT - Bills`.
  - **Workbook provisioning / header repair must be reviewed before implementation** (new-header seeding for fresh workbooks + repair for existing ones).

**Areas affected:** Bills UI; `INPUT - Bills` schema; `dashboard_data.js` recurrence expansion (`buildInputBillDueCandidates_`); Bills Due generation (`getInputBillsDueRows_`); Cash Flow autopay accumulation (weekly/biweekly branch); Activity Log dedupe validation (`buildBillAutopayDedupeKey_` already encodes the exact occurrence date, so it stays correct under weekday anchoring).

**Priority:** Post-Family Beta, Post-Recovery Validation. **UX enhancement, not a blocker.**

## Future UI Standardization — Manage Pattern Rollout

High-level mirror; **authoritative copy lives in `TODO.md → Future UI Standardization — Manage Pattern Rollout`** (backlog entry in `ENHANCEMENTS.md`). **Status: Bills = complete · Debts = complete · Bank Accounts = next likely candidate.** No implementation at this time.

**Pattern:** each major module exposes `[Primary View] [Manage]` — Primary View for daily usage / dashboard actions / updates / monitoring; Manage View for edit / rename / stop tracking / archive / maintenance / configuration. Manage Bills and Manage Debts proved this is far more user-friendly than direct sheet editing, so it is the preferred long-term UI pattern for module maintenance.

- **Completed:** ✅ Bills (Manage Bills, Edit, Stop Tracking, Add) · ✅ Debts (Manage Debts, Edit, Rename, Stop Tracking).
- **Planned candidates:** **Bank Accounts (High — next likely rollout;** still relies on backend sheet maintenance: rename account, change institution, change type, fix metadata, stop tracking), Income Sources (Medium), Investments (Medium), Properties (Medium), Donations (Lower).
- **Framework opportunity:** after ≥3 modules use the pattern (Bills, Debts, Bank Accounts), investigate extracting a reusable management framework (shared table, edit-form, stop-tracking, stale-row protection, activity logging). Do not extract before three real consumers exist.

**Priority:** sequenced after 6F Recovery Validation closes; Bank Accounts first. UX enhancement, not a blocker.

## Future Feature — Shared Entity Lifecycle Framework

High-level mirror; **authoritative copy lives in `TODO.md → Future Feature — Shared Entity Lifecycle Framework`** (backlog entry in `ENHANCEMENTS.md`). **Status: documented, not implemented. Reference implementation: the Debt lifecycle (`Active → Stop Tracking → Inactive → Reactivate`, commit `893d50d`).**

The **lifecycle** companion to Manage Pattern Rollout above. Make the active/inactive lifecycle consistent across long-lived entities (Debts, Bank Accounts, Investments, Houses, Bills, Income Sources, Properties) by extracting shared pieces: UI language (Active/Inactive sections, "Show inactive" toggle with count, Danger Zone, common empty state), button styles (Edit/Rename neutral, Reactivate positive, Stop Tracking destructive), confirmation copy, server lifecycle helpers (deactivate/reactivate existing row, block duplicate active names, preserve history, allow-list guard on generic update endpoints), activity events (`<entity>_deactivate` / `<entity>_reactivate` → "Tracking stopped" / "Tracking resumed"), and lifecycle diagnostics. Phased: document Debt as reference → inventory other modules → extract CSS/copy → extract server helpers → migrate one module at a time with validation.

**Priority:** Medium — after Financial Integrity reconciliation, before broader external beta if time allows. Not a blocker.

## Future Feature — Shared Sheet Write Utilities

High-level mirror; **authoritative copy lives in `TODO.md → Future Feature — Shared Sheet Write Utilities`** (backlog summary in `ENHANCEMENTS.md`). **Status: documented, not implemented. Priority: Medium — after Financial Integrity, Recovery Validation, and the Validation Agent; before broader public beta. Not a blocker.**

The **data-write** companion to the Shared Entity Lifecycle Framework above (same Shared Component direction, applied to the sheet-write path). Many modules write back to Google Sheets — Bills, Debt updates, Bank Accounts, Investments, Houses, House Expenses, Cash Flow, Planner outputs — and each re-implements its own value+format write logic, so formatting-preservation bugs recur (e.g. the Debt Credit Limit cell losing its green font from a row-neighbor format paste; blank Cash Flow autopay cells rendering `-3` instead of red `-$3.00`). **Goal:** a shared Sheet Write utility layer (`writeCellPreserveFormatting_`, `writeRangePreserveFormatting_`, `updateCurrencyCell_`, `updatePercentCell_`, `updateDateCell_`) that preserves number format / font color / weight / alignment / borders / background and formulas, centralizes currency + percentage formatting, and reduces duplicated write logic so a formatting fix made once applies everywhere. **Architectural principle:** business logic decides *what* value to write; shared helpers decide *how* — with "preserve the cell's own look" (per-column, e.g. Debts) vs "match the row" (row-uniform, e.g. Cash Flow) as explicit named behaviors. **Phased, not an immediate refactor:** inventory write helpers → identify duplication → introduce shared helper(s) → migrate modules one at a time as they are touched, each with runtime validation.

## Future Feature — Income Expected / Due Workflow

High-level mirror; **authoritative copy lives in `TODO.md → Future Feature — Income Expected / Due Workflow`** (backlog entry in `ENHANCEMENTS.md`). **Status: documented, not implemented. Priority: Medium-high, after current Central stabilization.**

Make income **symmetrical with Bills Due**: track income sources with frequency/date rules, surface **expected income** on the dashboard (Overdue / Next-7-days style), let the user **record/confirm** receipt (writing the *actual* amount to Cash Flow), and handle **variable income** (expected ≠ actual). Must **avoid double-counting** when income already exists in Cash Flow for that month/date — reuse the Bills Due handled-cell + dedupe-suppression model. Reuses the Bills Due recurrence-expansion logic and the `[Primary View] [Manage]` Manage Pattern (absorbs the "Income Sources — Medium" Manage candidate). Possible UI under Cash Flow → Income: **Manage Income Sources**, **Income Expected / Due**, **Record Income**, and later **Skip / Not received / Delay**. **Out of scope for now:** bank import automation, payroll integrations, advanced forecasting.

## Future Feature — Money Plan (Income Allocation) Page

High-level mirror; **authoritative copy lives in `TODO.md → Future Feature — Money Plan (Income Allocation) Page`** (backlog entry in `ENHANCEMENTS.md`). **Status: Phase 1 dashboard card implemented (pending commit); Phase 2 Money Plan page = documented design direction, not implemented — separate approval required.**

A simple **10/70/20** money plan (Save 10% / Living 70% / Debt Payoff 20%). The dashboard keeps only a **summary card** (Income, Save / Living / Debt targets, Status, **Open Money Plan** button → `showPage('moneyPlan')`). Phase 2 adds a **dedicated top-level Money Plan page** that is **read-only and fully derived** (no new sheets, no writes, no transfers/payments/debt automation): current-month plan vs actual; Save / Living / Debt cards; a status badge; recommendations; a month history table; and later selectable strategies (10/70/20, 50/30/20, custom). Calc model: income (same basis as the card); **debt actual** from Cash Flow expense rows matched to active debts (reuse existing debt attribution); **living actual** = total expenses − debt actual; **savings actual headline = residual** (income − living − debt) — investment-account movement is deliberately **not** the headline savings figure (market noise).

## Future Enhancement — Debt Payee Aliases

High-level mirror; **authoritative copy lives in `TODO.md → Future Enhancement — Debt Payee Aliases`** (backlog entry in `ENHANCEMENTS.md`). **Status: documented, not implemented. Long-term enhancement — not part of current Central stabilization work. No implementation at this time.**

Automatic debt payment detection currently requires the Cash Flow payee to **normalize-match the tracked debt Account Name exactly**, so a payment payee of `Meriwest` is never attributed to the debt `Meriwest Credit Union Loan` (the exact mismatch seen in the Meriwest HELOC investigation). The enhancement lets each tracked debt carry **one or more optional payment aliases** (e.g. `Meriwest`, `Meriwest CU`, `Meriwest HELOC`) used **only for payment recognition and reporting** — feeding debt payment recognition, Loan/HELOC messaging, a future principal-payment workflow, Rolling Debt payoff attribution, Money Plan debt-actual calculations, and bank import reconciliation. **Design guardrails:** Account Name stays the canonical identifier; aliases are optional; matching stays **deterministic** (normalized exact alias match, no fuzzy/AI); multiple aliases per debt supported; existing behavior preserved when no aliases are configured. UX enhancement, not a blocker.

## Future UX Enhancement — Google Sheets Refresh Awareness

High-level mirror; **authoritative copy lives in `TODO.md → Future UX Enhancement — Google Sheets Refresh Awareness`** (backlog entry in `ENHANCEMENTS.md`). **Status: documented, not implemented. Priority: Low — UX only, not a Central architecture blocker and not a data-integrity issue.**

When CashCompass writes to the workbook via Apps Script (House Expenses, Quick Add, Bills Due, AutoPay, etc.), an **already-open native Google Sheets browser tab** may not show the updated row/cell until it is refreshed. The data is written correctly (the web app and server reads return the right values); this looks like **Google Sheets client/UI caching**, not a write failure. Future ideas (none committed): probe whether `SpreadsheetApp.flush()` / flush timing improves live visibility; consider `SpreadsheetApp.toast()` or a lightweight post-write web-app note (*"Saved successfully. If your Google Sheet is already open, you may need to refresh it to see the latest changes."*); explore whether any write path can nudge a Sheets client refresh without a full reload. **Do not** add artificial delays or repeated flushes without a measured benefit. Pursue only after Central stabilization and broader beta testing.

## Current phase — Central App live + Family Beta readiness

The app has moved beyond the V1.2 "controlled improvement" framing. **The Central App architecture is live**, and the active work is hardening it toward a Family Beta. Two foundations carry forward from earlier phases (V1 trust baseline, V1.1 retirement profile integration) and remain true, but they are no longer the headline.

**What is live now (see `## Current architecture — Central App (live)` below for the full picture):**

- **Central App is operational.** `getUserSpreadsheet_()` is a real resolver (not a pass-through). It branches on the `CENTRAL_MODE` script property and, in central mode, routes to per-user workbook provisioning in `central_provisioning.js`.
- **Per-user workbook provisioning works** end-to-end — runtime-validated against the developer account (Phase A) and a disposable second account (Phase B). Each allow-listed user gets their own Drive-owned `CashCompass — <email>` workbook on first access.
- **Workbook mapping works** — `mapping::<sha256(email)>` keys in the central project's script properties (raw emails never stored).
- **Family Beta styling shipped** for four input sheets — Bank Accounts, Debts, Bills, Upcoming Expenses (see `## Family Beta workbook styling` below).
- The high-level roadmap is in `## Launch Readiness Roadmap (high-level)` above; the detailed roadmap is authoritative in `TODO.md → Launch Readiness Roadmap`. The forward queue is no longer "V1.2 candidates."

Full migration history (per-slice, with commit/run evidence) lives in `SESSION_NOTES.md → Current State — Post V1.2 Prep` and the `CENTRAL_APP_*.md` planning docs. The legacy V1 / V1.1 narrative below is preserved as the stability foundation the Central App builds on.

### Foundation — V1 trust baseline + V1.1 (preserved history)

The V1 trust baseline shipped, and V1.1 closed out with the retirement profile integration. These are complete and stable. Concretely:

- V1 trust baseline is complete.
- Blank / fresh workbooks are stable end-to-end (dashboard, Setup / Review, Planning tabs, Assets, Cash Flow, Activity).
- The major "Missing sheet …" and "(after retry+flush)" crashes across dashboard and planner modules are fixed.
- Misleading zero / fake states were removed — panels either show real data, a calm empty state, or a setup-aware CTA to Setup / Review.
- The planner email is properly gated: it sends only when the recipient is explicitly configured in `INPUT - Settings.Email` **and** the planner summary is meaningful (has at least one of: debts, assets, scheduled payments, or a recommendation). No more silent "owner got an email from a blank workbook" behavior.
- The bounded UI copy consistency pass is complete (ellipses, error tone, calm exception messages, empty/setup wording, sheet-name leakage removed from user-facing strings).

**V1.1 shipped — retirement profile integration.** Profile is now the single source of truth for **Date of Birth**, and Retirement derives current age from it automatically. The Retirement Basics edit form was removed; per-scenario age fields are display-only. A new `needsProfileDob` readiness state routes users to **Open Profile** when DOB is missing, and the DOB parser accepts both Date objects and `YYYY-MM-DD` strings. Populated workbooks are preserved byte-for-byte — legacy age rows on existing retirement sheets are left inert. Full phase summary in `SESSION_NOTES.md → V1.1 — Retirement Profile Integration (DOB Source of Truth)`.

Working rules are in `WORKING_RULES.md → Current phase` (the V1.2 change discipline still applies — one issue at a time, minimal/localized/safe, both workbook states), plus `WORKING_RULES.md → Central App Transition Rules` which is now the **active** policy governing the migration. Completed items are captured chronologically in `SESSION_NOTES.md`. Forward-looking work lives under `## Launch Readiness Roadmap (high-level)` above, with full detail in `TODO.md → Launch Readiness Roadmap`.

## Decision Layer (product framing)

The app has two layers. Do not conflate them:

- **Input / execution layer** — source-of-truth editors and ledgers. Bills, Upcoming, Debts, Bank Accounts, Investments, House Values / Expenses, Donations, Cash Flow (Quick Add), LOG - Activity. These own the data; they are the only places that write canonical rows.
- **Decision layer (Planning tab)** — answers *"what should I do next?"* by interpreting data from Bills, Upcoming, Debts, Bank Accounts, and Cash Flow. It is **not** a source-of-truth editor and **not** a ledger; it reads existing sources and does not create new data.

### Next Actions (primary entry point, v1 delivered)

- **"Next Actions"** is the featured sub-tab inside Planning and the primary entry point for users. It is the default landing view inside Planning.
- Action-first (no editing), short lists (3–5 items per section). Urgent is uncapped in the backend so `urgentTotal` always reconciles with the visible list; the UI groups the tail into a single "Other bills due soon" row for readability.
- The single payment path remains **Cash Flow → Quick Add**; Next Actions routes the user there (and to source pages) rather than duplicating detail.

### Relationship to existing Planning tabs

All current Planning sub-tabs stay as they are and are re-framed as **tools / deep dives**:

- **Debts**, **Retirement**, **Purchase Sim**, **Debt Overview**, **Rolling Debt Payoff**

Intended flow: **Next Actions → drill into these tabs**. No new top-level tabs; no new dashboards stacked on top of Planning.

### Design principles

- Do not add multiple new top-level tabs.
- Do not overload Planning with dashboards.
- Keep Next Actions simple (3–5 items per section).
- Single payment path remains Quick Add.
- Decision layer does not create new data; it reads existing sources.

### Roadmap

- **Phase 1 — Next Actions (v1)** ✅ Delivered as the featured Planning entry point.
- **Phase 2 — Cash Strategy** (later).
- **Phase 3 — HELOC Advisor refinement** (later).

See `ENHANCEMENTS.md` for the backlog entry and `SESSION_NOTES.md` for the shift summary. End-user documentation lives in the in-app Help page under **Planning → Next Actions** (`#help-next-actions`).

### Setup / Review (Onboarding Phase 1, delivered)

- **"Setup / Review"** is the top-right entry in the dashboard header. It opens a focused, **read-only** walkthrough of the five input areas Next Actions reads: Bank Accounts, Debts, Bills, Upcoming Expenses, Income — plus a Finish summary.
- Flow: **Welcome → status grid → per-step detail screen → (optional) editor in Setup mode**. Each step has a status badge (*Setup complete* / *Not set up*), a short product-language summary, and a primary action.
- **Setup-mode editor handoff** — detail CTAs open the existing editor in a simplified shell: main top nav, page sub-tabs, *Setup / Review*, and *Run Planner + Refresh Snapshot* are hidden; a **Back to Setup** bar appears. Normal navigation to the same editor is unchanged.
- **Income** is derived from the latest `INPUT - Cash Flow <year>` — there is **no** `INPUT - Income Sources` sheet. Recurring income is grouped conservatively (e.g. *Cisco Pay 1/2/3 → Cisco Salary*); excluded categories (Bonus, RSU, ESPP, Refund, …) are surfaced separately as "Other detected income".
- **Sheet safeguards** — Setup ensures `INPUT - Bank Accounts`, `INPUT - Debts`, `INPUT - Bills`, and `INPUT - Upcoming Expenses` exist with the canonical headers before opening their editor. It does **not** create Cash Flow year sheets.
- Read-only guarantee: viewing Setup never writes, never touches `SYS -` sheets, never writes to `LOG - Activity`.
- End-user documentation lives in `Dashboard_Help.html` under **Setup / Review** (`#help-setup`). Full phase notes and remaining follow-ups are in `ENHANCEMENTS.md → § 4 → Onboarding (Phase 1)`.
- **Startup routing & Welcome gate** — `getStartupRoutingFromDashboard` in `sheet_bootstrap.js` classifies a workbook as blank only when it has no `INPUT -`, `SYS -`, `OUT -`, or `LOG -` sheets via `workbookHasAnyAppSheet_`; populated workbooks land on the normal dashboard and `initDashboard()` sets `window.__cashCompassDashboardInited = true`. The Welcome screen inside **Setup / Review** is gated separately and is driven purely by the six Setup probes: `loadOnboardingSection()` in `Dashboard_Script_Onboarding.html` renders the status grid whenever any step reports `status !== 'missing'`, and renders Welcome only when every step is `missing`. The gate deliberately ignores `sheetExists` and `window.__cashCompassDashboardInited` because scaffold sheets (empty `INPUT - Cash Flow <year>`, empty `INPUT - Upcoming Expenses`, bootstrapped during first-run flows) would otherwise suppress Welcome on a freshly deployed workbook even though Setup itself is empty. Probe failures (malformed payload or server error) fail closed to the grid, which surfaces the error inline and exposes Refresh + Back to Dashboard — Welcome has neither. Both **Back to Dashboard** on Welcome and **Back to Dashboard** on the status grid call `onboardingBackToDashboard()`, which runs `window.initDashboard()` when needed and switches to `overview` — the grid's Back intentionally exits Setup instead of bouncing back to Welcome, so showing Welcome on a genuinely empty workbook is never a loop.
- **First-run bank account creation** — `addBankAccountFromDashboard` (bank_accounts.js) calls `ensureOnboardingBankAccountsSheetFromDashboard('normal')` and `ensureSysAccountsSheet_()` before any `getSheet_()` read, so the Assets → Bank Accounts → Add new flow works on a completely blank workbook instead of throwing *Missing sheet: INPUT - Bank Accounts* / *Missing sheet: SYS - Accounts*. Both helpers are idempotent no-ops when the sheet already exists; the INPUT creator writes the same Year-block structure (`Year | <year>` on row 1, `Account Name | Jan-YY … Dec-YY | Total` on row 2) that `getBankAccountsYearBlock_` parses on the very next line, so the first save's opening-balance write works without any extra self-heal step.

### Queued product work (post Next Actions stabilization)

Captured-but-not-scheduled. Intent only — full specs live in `ENHANCEMENTS.md → § 4 → Queued — post Next Actions stabilization`:

- **Debug mode control** — delivered (see above). Retained here for historical priority ordering.
- **Income Sources (new input surface)** — **superseded.** Income is now derived from the latest `INPUT - Cash Flow <year>` inside Setup / Review; no separate `INPUT - Income Sources` sheet will be reintroduced.
- **TEST mode retirement** — the `?onboarding=test` path and `TEST -` sheet fallbacks in `onboarding.js` are in light deprecation. New work should target the live path only; existing TEST code stays until it is removed in a dedicated cleanup pass.
- **Onboarding factory refactor** — consolidate the five per-step `*SetStatus_` / `*LoadDetail_` / `*RenderDetail_` / `*Open*Page` groups in `Dashboard_Script_Onboarding.html` into a shared factory once the flow has been exercised in real use.

Intended order: **(1) finish overlap cleanup → (2) stabilize Next Actions → (3) debug mode → (4) onboarding (delivered) → (5) TEST mode retirement → (6) onboarding factory refactor.** Do not reorder without an explicit product decision.

### Next Actions v1 — decision logic (delivered)

Locks the backend decision logic and product rules. Implemented by `next_actions.js::getNextActionsData()` and consumed by `Dashboard_Script_PlanningNextActions.html`.

**1. Purpose**
- Answers: *"What should I do next, in priority order?"*
- Interprets existing data only. No writes. Not a replacement for source-of-truth pages.

**2. v1 output model (compact action object)**
Each action is a plain object with:
- `priorityBucket` — `urgent` | `recommended` | `optimize`
- `actionType` — one of the types in §6
- `title` — short imperative label (e.g. *"Pay PG&E bill"*)
- `reason` — one-sentence justification built from current data (see §7)
- `amount` — dollar amount (may be 0 when N/A, e.g. `review_cash_gap`)
- `dueDate` — ISO date or null
- `sourceEntity` — `{ type, name }` where `type` ∈ `bill | upcoming | debt | bank_account | heloc | cash_plan`
- `target` — `{ page, tab }` the user is routed to (Quick Add stays the single payment path)

**3. v1 data sources (no new sources)**
- `INPUT - Bills` (active)
- `INPUT - Upcoming Expenses` — **remaining balance only** (the live `Amount` column)
- `INPUT - Debts` (active; balance / min payment / due day)
- Bank Accounts / usable cash — via the existing liquidity model (`SYS - Accounts` → Safe-to-use / Available Now / Min Buffer)
- Rolling Debt Payoff recommendation — reuse `getRollingDebtPayoffPlan` output; do not re-run the engine

**4. v1 priority buckets**
- **Urgent** — overdue items, due soon, unpaid debt minimums for the current cycle, near-term obligations (next ~7 days), and any detected cash gap. Must be addressed before anything else is surfaced as money-movement.
- **Recommended** — next best moves once urgent items are covered (typical case: extra payment toward the Rolling Debt Payoff focus debt; finishing a partially-paid Upcoming).
- **Optimize** — optional improvements that only make sense once urgent items are safe (sparse by design; usually empty). HELOC strategy is **not** surfaced here — it lives on the Rolling Debt Payoff *HELOC strategy* card.

**5. v1 deterministic rules**
- Build the **urgent obligations** list first, from Bills + Debts + Upcoming + near-term windows.
- Compare `sum(urgent obligations)` vs **cash-to-use** (Safe-to-use from the liquidity model).
- If obligations exceed cash-to-use, emit `review_cash_gap` at the top of `urgent` — recommending / pay_extra actions are **suppressed** until the gap is resolved.
- Only emit `pay_extra_debt` (and other `recommended` money-movement) **after** urgent obligations are covered.
- When recommending an extra debt payment, use the **Rolling Debt Payoff** recommendation as the preferred target; do not invent a new waterfall.
- All rules are deterministic over the current snapshot — same inputs, same output.

**6. v1 action types**
- `pay_bill` — active bill due in the current cycle, unhandled in Cash Flow.
- `pay_debt_minimum` — debt with unpaid minimum for the current cycle.
- `pay_upcoming` — Upcoming row with remaining > 0 and due within the urgent window.
- `finish_upcoming` — partially-paid Upcoming row (remaining > 0, already touched) worth closing out.
- `review_cash_gap` — informational; shown when obligations exceed cash-to-use.
- `pay_extra_debt` — extra principal toward the Rolling Debt Payoff focus debt once urgent is clear. Reason is intentionally short (*"Confirm in Rolling Debt Payoff"*) so Next Actions does not duplicate the Rolling Debt Payoff Focus-debt narrative.

HELOC strategy is intentionally **not** a Next Actions action type. It lives on the Rolling Debt Payoff *HELOC strategy* card (single source of truth for HELOC recommendations).

**7. Explainability rule**
Every emitted action must be explainable in **one sentence** built entirely from current snapshot data (amount, due date, remaining balance, bucket rule, or Rolling Debt Payoff reason code). If an action can't be explained that way, it is not emitted.

**8. Non-goals for v1**
- Retirement optimization
- Investment allocation advice
- Purchase simulation outputs
- Scenario / what-if planning
- Automatic execution (Quick Add remains the single payment path; Next Actions only routes)

### Liquidity model v1 — `cash_to_use` (delivered)

Defines the safe, conservative "how much can I actually act on right now" number consumed by Next Actions v1. This is an explicit contract, not a re-derivation of the Rolling Debt Payoff *Safe-to-use* math — Next Actions uses this simpler model directly.

**1. Definition**
- `cash_to_use` = total amount of money **safely available right now** across active bank accounts.
- Conservative, buffer-respecting, **current-state only** — no forecasts, no future income, no credit lines, no investments.

**2. Data sources**
- Bank Accounts only (canonical: `INPUT - Bank Accounts` + the `SYS - Accounts` mirror already read by the dashboard).
- Per-account fields consumed:
  - `balance` (current balance — same field the Bank Accounts panel surfaces)
  - `minBuffer` (Min Buffer)
  - `active` flag (shared filter: explicit `No / n / false / inactive` = inactive; blank = active)
  - `usePolicy` (existing Use Policy column)

**3. Core formula**
- Per account: `usable = max(0, balance - minBuffer)` — never negative.
- Total: `cash_to_use = Σ usable` across eligible accounts (§4).
- Round to cents at the total; per-account values render at cents too.

**4. Eligibility rules**
- **Include** only accounts where `active !== inactive` (shared rule).
- **Exclude** accounts flagged as restricted / do-not-use.
- **Use Policy** (v1 simplified): include most policies; exclude only accounts with an explicit "do not use" / restricted policy. More granular policies (spend-first, reserve, etc.) stay for a later phase — v1 either counts an account fully eligible or fully excluded.

**5. Output model**
Single object returned by the liquidity reader:
- `cashToUse` — total dollars, rounded to cents.
- `accounts` — array of `{ name, balance, minBuffer, usable, included, excludedReason? }` for every considered row, so the UI can show the breakdown and the reason any account was skipped.

**6. Usage in Next Actions**
- Compare `cashToUse` vs `sum(urgent obligations)` (from the Next Actions v1 rules).
- If `cashToUse < sum(urgent)`, emit **`review_cash_gap`** at the top of `urgent` and suppress `recommended` money-movement until resolved.
- Otherwise, use `cashToUse − sum(urgent handled)` as the pool for `recommended` actions (e.g. `pay_extra_debt` against the Rolling Debt Payoff focus debt).

**7. Guardrails**
- Never allow negative contributions from any single account (`max(0, …)` clamp).
- Always respect `minBuffer` — buffer is sacred in v1.
- No future-income assumptions, no pending transfers, no optimistic timing.
- No credit lines, no investments, no HELOC draw counted as "cash_to_use". HELOC strategy is a separate surface (Rolling Debt Payoff *HELOC strategy* card), not a Next Actions signal.

**8. Non-goals (v1)**
- No forecasting (no 7-day / 30-day projection of cash).
- No time-based modeling (same number whether asked at 8 AM or 5 PM on the same day).
- No optimization across accounts (no "drain this one first" logic — that's a later phase paired with Cash Strategy).

## Overall system areas already in the app
- Dashboard snapshot / overview
- **Bills** (Cash Flow tab) — Internal two-view panel: **Due this period** (dated Pay / Skip cards) and **Manage bills** (table over **INPUT - Bills** with inline sort on **Payee** / **Due Day**, **Add bill**, **Edit** (in-place dual-mode reuse of the Add form — Payee / Default Amount / Due Day / Frequency / Payment Source / Category / Autopay / Varies / Notes; **Start Month** and **Active** are hidden in edit mode), and **Stop tracking** which sets **Active = No**). Server entry points: `addBillFromDashboard`, `updateTrackedBillFromDashboard`, `deactivateBillFromDashboard` in `bills.js`. Category is a required field on Add bill. Edit refuses inactive bills, never moves the row in **INPUT - Bills**, and never retroactively renames the Cash Flow row seeded at Add time (a Payee rename leaves the old Cash Flow row in place — history is preserved on purpose). A save with no diff returns **No changes.** and is not logged.
- **Quick add** (Cash Flow tab) — expense/income lines to **INPUT - Cash Flow** (UI wording; activity log event type remains **`quick_pay`**)
- **Upcoming Expenses** (Cash Flow tab) — Add / Edit / Quick-pay / Dismiss against **INPUT - Upcoming Expenses**. `Account / Source` on the Add+Edit form is a controlled dropdown with canonical funding options **Cash / Credit Card / Cash + Credit Card / Loan / Financing / Other / Unknown** plus an **Other (custom)…** sentinel that toggles a sibling text input (matches the Bank Accounts → Use Policy "Other (custom)…" pattern; legacy free-text values hydrate through the custom sentinel without data loss). The picked value is what the Rolling Debt Payoff planner reads to classify each row's funding type — see the Rolling Debt Payoff bullet for what each option does to the liquidity model. No schema change: column stays a single free-text "Account / Source" cell on **INPUT - Upcoming Expenses**; the dropdown only constrains *new* input.
- House values — **Update** / **Add new** / **Stop tracking** (soft deactivate via `deactivateHouseFromDashboard` in `house_values.js`: sets **Active = No** on every **INPUT - House Values** row for the house and on the mirror **SYS - House Assets** row; preserves history, the **HOUSES - {House}** sheet, and name reservation. Logs **`house_deactivate`**. Inactive houses drop out of the House Values dropdown, House Expenses selector, and Property Performance rows/cards — all via the shared `getInactiveHousesSet_` rule: explicit `No / n / false / inactive` = inactive; blank = active.)
- House expenses
- Bank accounts — **Update** / **Add new** / **Stop tracking** (soft deactivate via `deactivateBankAccountFromDashboard` in `bank_accounts.js`: sets **Active = No** on every **INPUT - Bank Accounts** row for the account across all year blocks and on the mirror **SYS - Accounts** row; preserves month history, totals / delta, **Current Balance**, **Available Now**, **Min Buffer**, **Type**, **Use Policy**, **Priority**, and reserves the name. Logs **`bank_account_deactivate`**. `addBankAccountFromDashboard` appends a row to **INPUT - Bank Accounts** (current year block) and **SYS - Accounts** with `Active = Yes` and seeds the (required) opening balance into the matching month when non-zero; Type is chosen from a controlled dropdown of existing types in **SYS - Accounts**; **Use Policy** is a dropdown of canonical tokens (`DO_NOT_TOUCH` / `USE_FOR_BILLS` / `USE_FOR_DEBT` / `USE_WITH_CAUTION`) plus an **Other (custom)…** sentinel that stores a user-typed string (planner treats unmapped policies like `DO_NOT_TOUCH`); **Priority** is a dropdown of **Use first (1)** / **Use after others (5)** / **Use last (9)** that defaults to **Use last** and writes the numeric value to the canonical **SYS - Accounts → Priority** column consumed by `planner_core.js → normalizeAccounts_`; new **SYS - Accounts** rows inherit neighbor row formatting (borders, font, number formats, row height) via `findAccountsTemplateRow_` + `PASTE_FORMAT`; logs **`bank_account_add`** with Amount = opening balance. Opening balance is required on the Add-new form (prefilled to 0.00; 0 is allowed); **Also set Available Now to opening amount** and **Also set Min Buffer to opening amount** both default to checked. First-run safe: `ensureSysAccountsSheet_` creates **SYS - Accounts** with canonical headers on blank workbooks without touching any pre-existing sheet. Inactive accounts drop out of the Bank Account dropdown via the shared filter: explicit `No / n / false / inactive` = inactive; blank = active.)
- Investments — **Update** / **Add new** / **Stop tracking** (soft deactivate via `deactivateInvestmentAccountFromDashboard` in `investments.js`: sets **Active = No** on every **INPUT - Investments** row for the account across all year blocks and on the mirror **SYS - Assets** row; preserves month history, totals / delta, Current Balance, and reserves the name. Logs **`investment_deactivate`**. `addInvestmentAccountFromDashboard` appends a row to **INPUT - Investments** (current year block) and **SYS - Assets** with `Active = Yes`; **Starting value** is required on the Add-new form (prefilled to 0.00; 0 is allowed). **Starting value date** stays optional — blank resolves to today server-side so the amount always lands in a real month column; month cells are left empty when the amount is 0. Type is a dropdown merging existing **SYS - Assets** types with fallback options (*Brokerage*, *Retirement*, *Education*) plus an **Other (custom)…** sentinel that stores a user-typed string. Logs **`investment_add`**. Inactive accounts drop out of the Investment Account dropdown via the shared filter: explicit `No / n / false / inactive` = inactive; blank = active.)
- Debts — **Update** / **Add new** / **Stop tracking** (soft deactivate via `deactivateDebtFromDashboard` in `debts.js`: sets **Active = No** on the matching **INPUT - Debts** row; the row is never deleted so balance / minimum payment / credit limit / interest rate / due day and the name all stay intact for history. Logs **`debt_deactivate`**. `addDebtFromDashboard` appends a row to **INPUT - Debts** only — there is no **SYS - Debts** mirror — with `Active = Yes`; logs **`debt_add`** with Amount = opening balance (or 0 when not supplied). Active semantics: for UI / dashboard / Cash Flow readers, only explicit `No / n / false / inactive` on the **Active** column counts as inactive — blank / missing column = active, so legacy workbooks show every debt in the dropdown exactly like pre-Active-column builds. The planner (`planner_core.js → normalizeDebts_`) additionally applies the legacy `balance > 0 || minPayment > 0` fallback when the column is absent, so rolling payoff still skips dormant debts. The column is self-healed on the first add/stop-tracking write. Inactive debts drop out of the Planning Debts selector, `normalizeDebts_()` (so Rolling Debt Payoff waterfall / HELOC gate / focus/next-debt / payment windows), Debt Overview, Bills Due (debt matching), Quick add Flow Source inference, high-utilization issues, and debt-balance totals. Historical `LOG - Activity` classification is intentionally NOT filtered by Active so old quick_pay rows tied to a now-inactive debt still render with the right **Type / Kind**.)
- **Debt Overview** (Planning tab) — Read-only reference view of debt structure (balances, minimums, APRs, estimated payoff at current minimums) from **INPUT - Debts** plus **CF paid** trailing-two-year sums from **INPUT - Cash Flow**. Renamed from the older "Payoff Path"; not an action planner.
- **Rolling Debt Payoff** (Planning tab) — Monthly decision engine. Standalone React bundle (`components/RollingDebtPayoffDashboard.tsx` → `RollingDebtPayoffDashboardBundle.html`). Opens in **Standard** mode (Cash-to-use-now input, narrative Decision card with Recommendation/Why/Caution, HELOC strategy card with *What would change this?* levers, compact Payment result table using **Small balance / Focus debt / Next debt / Excess** role labels and **Paid off (this month) / Partially paid** actions, per-row **[Add payment]** pill that calls host `window.prefillQuickPayment` to open **Cash Flow → Quick add** pre-filled, **Why not more?** breakdown whose `[View]` pills route to **Cash Flow → Upcoming**). A single **Show details / Hide details** toggle reveals the full planner output (cash bridge audit, allocation audit, 12-month cash table, yearly projection, diagnostics, JSON). Liquidity model is calculated from **SYS - Accounts** (Safe-to-use = Total cash − Reserve − Buffer − Near-term hold − Unmapped card risk hold); legacy $100k/$100k hardcoded constants retained for audit only. Planned Upcoming Expenses are classified by `Account / Source` (see Upcoming Expenses bullet) before they hit the holds: **Cash** subtracts from deployable cash via the near-term hold; **Credit Card** maps to a specific card debt via `rollingResolveCcDebtNameForPlannedExpense_` when a match exists, otherwise reserves the amount as an unmapped card-risk hold; **Cash + Credit Card** intentionally routes through the card branch (conservative — no split-funding in v1); **Loan / Financing** is excluded from both cash and card-risk holds (the financed purchase price doesn't reduce deployable cash today and isn't modeled as a card balance — surfaced separately as a `loan_funded_near_term_total` aggregate in the Why-not-more breakdown); **Other / Unknown** and blank fall back to the cash branch.
- Retirement planner
- Monte Carlo / retirement success
- Purchase simulator / big purchase sim
- Planner run + OUT history snapshot logic
- **LOG - Activity** — Ledger of script actions (**quick_pay**, bill skip, bill autopay, **bill_add**, **bill_update**, **bill_deactivate**, **house_expense**, **house_add**, **house_deactivate**, **investment_add**, **investment_deactivate**, **bank_account_add**, **bank_account_deactivate**, **debt_add**, **debt_deactivate**, **donation**, upcoming lifecycle, the Bank Import family — **bank_import_auto_matched** / **bank_import_pending** / **bank_import_ignored_hit** / **bank_import_row_error** (Step 2a ingestion) and **bank_import_review_add_new** / **bank_import_review_match** / **bank_import_review_unlink_match** / **bank_import_review_ignore** / **bank_import_apply_balance** (Step 2b / 2d review + Apply) — and the Planner email family **planner_email_sent** / **planner_email_invalid_recipient** (per-save defers are no longer logged — the count is rolled up onto the next `planner_email_sent` row as `(N saves batched)` via `details.deferredSaveCount`; legacy `planner_email_deferred` rows already on the sheet still render); when **Quick add** runs inside house expense with **`suppressActivityLog`**, the extra **`quick_pay`** row is omitted because **`house_expense`** already logged the save). Rows can be removed from the **Activity** page: dashboard **Remove** is enabled for **`donation`** only (may also delete a matching **INPUT - Donation** row when the fingerprint matches); other event types are sheet-only for now. Not a substitute for **OUT - History** (planner snapshots). Created automatically if missing (`activity_log.js`). **Activity** page: **getActivityDashboardData** — filters, sort, up to **500** matches, **20** per page. **Tracking stopped** rows render with **—** in Amount since no money moved.
- **INPUT - Donation** — Charitable giving by tax-year blocks (`Year` row + header row + data). **Cash Flow → Donations** appends rows (`donations.js`); does not write **INPUT - Cash Flow**.
- **Car / vehicle expenses** — Often a **separate dedicated sheet** in the workbook today; **not** integrated in the dashboard yet. See **`TODO.md`** (Product / testing) for the open design item.

## Current architecture

### Main web app
- PlannerDashboardWeb.html = main wrapper
- Dashboard_Styles.html
- Dashboard_Body.html
- Dashboard_Script_Render.html (overview + shared globals/helpers)
- Dashboard_Script_AssetsHouseValues.html
- Dashboard_Script_PropertiesHouseExpenses.html
- Dashboard_Script_AssetsBankInvestments.html
- Dashboard_Script_PlanningDebts.html
- Dashboard_Script_CashFlowUpcoming.html
- Dashboard_Script_Donations.html
- Dashboard_Script_PlanningRetirement.html
- Dashboard_Script_PlanningPurchaseSim.html
- Dashboard_Script_PropertyPerformance.html
- Dashboard_Script_Payments.html
- Dashboard_Script_BillsDue.html
- Dashboard_Script_Activity.html
- RollingDebtPayoffDashboardBundle.html — prebuilt React bundle for the **Rolling Debt Payoff** tab (source: `components/RollingDebtPayoffDashboard.tsx`; build: `npm run build:rolling-dashboard`; typecheck: `npx tsc --noEmit -p tsconfig.rolling-dashboard.json`). Calls host globals `window.prefillQuickPayment`, `window.showPage`, `window.showTab` with defensive guards for standalone environments.

### Backend files
- webapp.js = main doGet()
- html_includes.js = `includeHtml_()` — **raw** file content only; nested `<?!= … ?>` inside included files does **not** run (see `WORKING_RULES.md` § HtmlService includes).
- central_resolver.js = Central App resolver seam (**live — no longer a pass-through**). `getUserSpreadsheet_()` branches on `isCentralModeEnabled_()` (the `CENTRAL_MODE` script property): when off (default, bound mode) it returns `SpreadsheetApp.getActiveSpreadsheet()` byte-for-byte; when on (central mode) it routes to `getOrProvisionUserSpreadsheet_()` in `central_provisioning.js`. The file also owns `isCentralModeEnabled_()` (fail-closed script-property read) and `getCurrentUserEmail_()` (identity via `Session.getEffectiveUser()` — `getActiveUser()` is deliberately avoided because it returns empty for non-Workspace users under `USER_ACCESSING`). Provisioning logic lives in `central_provisioning.js`, not here — this file stays small and seam-like. See `## Current architecture — Central App (live)` below. Historical per-slice migration detail (Phases 1–4 resolver seams, the standalone-project build, runtime evidence) is preserved in `SESSION_NOTES.md → Current State — Post V1.2 Prep` and the `CENTRAL_APP_*.md` planning docs.
- central_provisioning.js = Central App provisioning + mapping (the workbook lifecycle behind the resolver). Allow-list (`FAMILY_BETA_ALLOWLIST`), mapping store (`mapping::<sha256(email)>` script-property keys), `getOrProvisionUserSpreadsheet_`, `provisionWorkbookForUser_` (creates `CashCompass — <email>` in the caller's Drive via `Drive.Files.create` under `LockService`, bootstraps `INPUT - Settings`, writes the mapping), `handleStaleMapping_` (throws `StaleMappingError`, never auto-reprovisions), and `clearMappingForUser_` (manual recovery). Soft-delete (`setTrashed`) is the only file-modifying action ever taken on a user-owned workbook, and only before the mapping write.
- dashboard_data.js = main dashboard snapshot + bills due backend (case/whitespace-tolerant `INPUT - Bills` header lookup in `getInputBillsDueRows_`)
- activity_log.js = LOG - Activity (`appendActivityLog_`, `deleteActivityLogRow` donation-only from web UI, dedupe keys for bill autopay, `getActivityDashboardData` / `getActivityLogForDashboard`, house expense + suppress duplicate **`quick_pay`** when CF is posted from the same save, `bill_add` / `bill_update` / `bill_deactivate` / `house_add` / `house_deactivate` / `investment_add` / `investment_deactivate` / `bank_account_deactivate` classification; `bill_update`, `bill_deactivate`, `house_deactivate`, `investment_deactivate`, and `bank_account_deactivate` marked non-monetary so Amount renders as **—**. `bill_update` carries an inline label (`Updated Default Amount to $X.XX` / `Updated Due Day to N` / `Updated <Field>` / `Updated N fields`) via `billUpdateActionLabel_`. `bank_account_add` is monetary — Amount shows the supplied opening balance, or 0 when none was provided.)
- investments.js = `addInvestmentAccountFromDashboard`, `deactivateInvestmentAccountFromDashboard`, `getInvestmentUiData` (active-only accounts + Type dropdown options). Self-heals the **Active** column on every **INPUT - Investments** year block and on **SYS - Assets**; preserves totals / delta rows when inserting new account rows.
- bank_accounts.js = `addBankAccountFromDashboard`, `deactivateBankAccountFromDashboard`, `getBankAccountUiData` (active-only accounts + Type dropdown options + Use Policy datalist). Self-heals the **Active** column on every **INPUT - Bank Accounts** year block and on **SYS - Accounts**; preserves totals / delta rows; appended **SYS - Accounts** rows inherit neighbor row formatting (borders, font, number formats, row height) via `findAccountsTemplateRow_` + `PASTE_FORMAT`. Writes **Priority** (default 9, range 1–99) to the canonical **SYS - Accounts → Priority** column when present.
- bank_import.js = Bank Import pipeline. **Step 2a** ingestion (`processBankImportBatch_(payload)`): ignored-check, exact-`External Account Id` auto-match against **SYS - Accounts**, pending staging upserts on **SYS - Import Staging — Bank Accounts** with `Status = pending` and a fixed `Pending Reason` enum, balance-fingerprint dedupe. **Step 2b / 2d** review + Apply public entry points (all `LockService.getDocumentLock()` wrapped): `getBankImportReviewData()`, `addStagedBankAccountAsNew(payload)` (link-only — no opening balance written), `matchStagedBankAccountToExisting(payload)` (writes only the External Account Id cell; refuses cross-link overwrites), `unlinkMatchedStagedBankAccount(payload)` (Change match — clears External Account Id, flips Status back to `pending`), `ignoreStagedBankAccount(payload)` (appends to **SYS - Import Ignored — Bank Accounts** with `Scope = permanent`), and `applyStagedBankAccountBalance(payload)` (writes the staged snapshot to the matching month on **INPUT - Bank Accounts** using the same write path Bank → Update uses; mirrors **SYS - Accounts.Current Balance**; refuses on `stale_balance` / `currency_mismatch` / `type_conflict` / inactive linked account / missing Year block; `bankImportEnsureInputRowForApply_` auto-creates a missing **INPUT - Bank Accounts** row when the year block exists but the account row is absent, logged as `autoCreatedInputRow: true` on the apply activity row). **Step 3a** CSV-paste backend wrapper (`processBankImportCsvPasteBatchFromDashboard(payload)`, gated behind UI flag `BANK_IMPORT_CSV_PASTE_ENABLED`, default `false`) routes through `processBankImportBatch_` with `source = 'csv_paste_v1'`. **Dev harness** (`devRunBankImportSampleFromDashboard()`, `_devRunBankImportSample()`, `_devRunBankImportCustom_(payload)`) gated by UI flag `BANK_IMPORT_DEV_TOOLS_ENABLED`, default `false`. Activity events all go through `bankImportLogActivity_` / `bankImportLogApplyBalanceActivity_`; classification falls under the **Bank Import** kind via the `bank_import_*` prefix rule in `activity_log.js`.
- debounce_planner.js = Planner email debounce queue (`ensureDebouncePlannerTrigger_()` registers a 5-minute time-driven trigger from `getDashboardSnapshot()`; `bumpDebouncePlannerLastSaveAt_()` / `bumpDebouncePlannerDeferredCount_()` update `DocumentProperties` on every deferred save; `debouncePlannerEmailRun()` fires after a 10-minute quiet window and runs `runDebtPlanner({ emailMode: 'send' })` once; `readDebouncePlannerDeferredCount_()` returns the rolled-up `deferredSaveCount` so the `planner_email_sent` row reports `(N saves batched)`; `markDebouncePlannerEmailSettled_()` clears the queue and the deferred-count after every `'send'` run — even when the meaningfulness gate or no-recipients gate skips actual mail).
- bills.js = `addBillFromDashboard`, `updateTrackedBillFromDashboard` (in-place edit on an active row — Payee / Default Amount / Due Day / Frequency / Payment Source / Category / Autopay / Varies / Notes; per-field diff with **only changed cells** written; refuses inactive rows and stale `expectedPayee`; no-op saves return `No changes.` without logging; never moves the row, never touches Active / Start Month, never retroactively rewrites Cash Flow rows), `deactivateBillFromDashboard`; case/whitespace-tolerant header lookup; self-heals **INPUT - Bills** by auto-adding missing optional columns (Payment Source, Category, Frequency, Start Month, Notes) before append. `getActiveBillsForManagementFromDashboard` returns `notes` so the Edit form can pre-fill it.
- quick_add_payment.js = `quickAddPayment`, `getQuickAddPreview`, prefill API; `resolveFlowSourceFromBillOrDebt_` server-side fallback populates **Flow Source** on newly created Cash Flow rows from **INPUT - Bills.Payment Source** (or inferred CREDIT_CARD / CASH from **INPUT - Debts**) when the caller doesn't pass one
- donations.js = **INPUT - Donation** append (`getDonationsFormData`, `addDonation`)
- other feature files exist for house, debts, payments, retirement, etc.

## Current architecture — Central App (live)

CashCompass now runs in **two coexisting shapes** that share one codebase. The boundary is enforced by the `CENTRAL_MODE` script property and by deployment-pinning. The Central App is no longer a "future direction" — it is operational and runtime-validated; the migration discipline in `WORKING_RULES.md → Central App Transition Rules` is the **active** governing policy.

### Two projects / two modes

- **Bound Project (legacy / developer data path).** The original Apps Script project bound to the developer's personal workbook. With `CENTRAL_MODE` unset/off (the default), `getUserSpreadsheet_()` returns `SpreadsheetApp.getActiveSpreadsheet()` byte-for-byte — existing bound behavior is fully preserved. Its deployment is pinned to a pre-central script version so the developer's live data keeps working unchanged.
- **Central App Project (standalone).** A separate Apps Script project, `CashCompass — Central App` (not bound to any spreadsheet), with its own deployment URL. It **always runs central mode** as a structural invariant (no flag branch in that project's resolver). Each allow-listed Google account that opens the deployment gets its own Drive-owned workbook provisioned on first access.

### CENTRAL_MODE

- Script property read by `isCentralModeEnabled_()` in `central_resolver.js`. Only the literal string `"true"` enables central mode; anything else (including unset) is bound mode. Reads fail closed (any error → off).
- In the bound project the flag is the live switch between legacy and central behavior; in the standalone central project central mode is unconditional.
- **Rollback is tier-1 immediate:** flipping `CENTRAL_MODE` back to off reverts the resolver to the legacy `getActiveSpreadsheet()` pass-through across every execution context, no redeploy required, no user workbook deleted.

### Provisioning

- Lives in `central_provisioning.js`, behind `getOrProvisionUserSpreadsheet_()`.
- `doGet` enforces the **allow-list gate** (`FAMILY_BETA_ALLOWLIST`, CSV of emails; empty = nobody → fail closed) before render; unauthorized callers see `renderAllowlistRejection_()` with no Drive create, no mapping write, no data access.
- First access with no mapping → `provisionWorkbookForUser_(email)` acquires `LockService.getUserLock().tryLock(30000)`, double-checks inside the lock, then `Drive.Files.create({ name: 'CashCompass — <email>', mimeType: 'application/vnd.google-apps.spreadsheet' })` in the caller's Drive root, `SpreadsheetApp.openById(fileId)`, `runMinimalBootstrap_(ss)` (creates the canonical `INPUT - Settings` tab; all other sheets are created lazily on dashboard render), then `writeSpreadsheetIdForUser_(email, fileId)`. Any failure before the mapping write soft-deletes the orphan file (`setTrashed`) — **never a hard delete** of a user-owned workbook.
- **Stale mapping** (mapped workbook trashed/unreachable) → `handleStaleMapping_` throws `StaleMappingError` with a human-readable message; **no auto-reprovision**. Manual recovery is `clearMappingForUser_(email)`.

### Workbook mapping

- Stored as `mapping::<sha256(email)>` keys in the **central project's** script properties (raw emails are never stored). Bound mode does not use the mapping store.

### Family Beta readiness

- Provisioning runtime-validated: **Phase A** (developer account) and **Phase B** (disposable second account) both PASS — separate user-owned workbooks, `INPUT - Settings` bootstrapped, mappings written, no cross-user data leakage, bound deployment unaffected.
- Current maturity: **stable and family-beta capable.** Read-only admin diagnostics (Phase 2A) and durable workbook identity markers (Phase 6B) are live; the recovery stack (6C.1 / 6D.1 / 6D.2a / 6E.1) is implemented and **flag-gated OFF**, with **healthy-path validation done (2026-06-09)**, **recovery-page render + executed Reconnect validated (2026-06-11)**, and **executed Admin Clear (+ mapping/reverse-index removal, repair audit history, bootstrap reprovision) validated (2026-07-02)**; the remaining paths (Auto-Adopt, ambiguous, name-only adoption, orphan workbook) are still pending. The production / bound workbook stays protected throughout.
- **Known hardening items (Phase 2 — Family Beta Hardening, see `TODO.md → Roadmap` and `CENTRAL_APP_WORKBOOK_DIAGNOSTICS_PLAN.md`):** read-only diagnostics (Phase 2A) ✅ and identity markers (Phase 6B) ✅ are done; the recovery stack is **built, healthy-path validated, reconnect-validated (2026-06-11), and executed-Admin-Clear-validated (2026-07-02)** — remaining paths are Auto-Adopt (6C.1), ambiguous handling, name-only adoption, and orphan workbook. The active step is **Recovery Validation (6F)** (remaining adoption/ambiguous/orphan pass). Remaining slices: 6D.2b Create New Workbook, 6E.2 Admin Set Mapping. Also remaining: Tier 2 `getActiveSpreadsheet()` migration of the full dashboard, and the bound project's manifest revert once central is primary.
- Full per-slice migration history (manifest prep, resolver/provisioning slice, standalone project build, runtime evidence) is in `SESSION_NOTES.md → Current State — Post V1.2 Prep` and the `CENTRAL_APP_*.md` planning docs (`CENTRAL_APP_DESIGN.md`, `CENTRAL_APP_CENTRAL_PROJECT_SETUP_CHECKLIST.md`, `CENTRAL_APP_WORKBOOK_CREATION_FIRST_SLICE_PLAN.md`, `CENTRAL_APP_FAMILY_BETA_READINESS_CHECKPOINT.md`, others).
- **Active Phase 2 design:** `CENTRAL_APP_WORKBOOK_DIAGNOSTICS_PLAN.md` — read-only duplicate / orphan / stale workbook detection, classification, marker strategy, and admin audit functions (Phase 2A), with Phase 2B recovery scope recorded in its `§10`.

### Benefits (now being realized)

- **Instant updates for all users** — the deployed script version is the single source of truth; no per-copy redeploys.
- **No version drift** — every central user runs the same code at the same time.
- **Easier support** — one canonical code path; user-specific issues isolate to data, not code.
- **Foundation for monetization** — the mapping store is the natural anchor for per-user plan / entitlement records (see `ENHANCEMENTS.md → Future direction — Monetization` and `TODO.md → Monetization`).

## Workbook Identity & Recovery (live + roadmap)

The Central App can lose track of a user's workbook (cleared/lost mapping, trashed workbook, two-project migration, manual edits). To make recovery safe and prevent silent duplicate provisioning, each workbook now carries **durable identity markers** and the central project keeps a **reverse index**. This section is intentionally high-level — implementation detail lives in `central_provisioning.js`, `central_diagnostics.js`, and `CENTRAL_APP_WORKBOOK_DIAGNOSTICS_PLAN.md` so it does not go stale here.

**What's live — identity (Phase 6B, no behavior change):**

- **Identity markers** — a workbook is stamped with a durable identity marker at create time, with **lazy backfill** when a mapped workbook opens without one. The markers let diagnostics and recovery confidently confirm "this workbook belongs to this user."
- **Reverse index** — the central project keeps a `spreadsheetId → user` index so a found workbook can be traced back to its owner without opening it as that user.
- **`SYS - Meta` sheet** — a lightweight, hidden in-workbook marker sheet that survives Drive-level metadata loss (e.g. file copy), as a secondary identity signal.
- **Admin marker diagnostics** — read-only, admin-gated visibility into which markers are present / matching for a given user.

**What's implemented — recovery stack (shipped behind flags, default OFF; healthy-path validated 2026-06-09, reconnect + recovery-page render validated 2026-06-11, executed admin clear + audit + reprovision validated 2026-07-02, remaining adoption/ambiguous/orphan paths pending — see `## Recovery Validation Inventory`):**

- **6C.1 Adopt-Before-Create** (`CENTRAL_AUTO_ADOPT`) — at provisioning time, with no mapping: 1 strict candidate → adopt; ≥2 → `AmbiguousWorkbookError`; 0 → create. Creates/deletes nothing when adopting.
- **6D.1 Recovery Page** — display-only recovery screen (stale / ambiguous / unavailable) instead of raw errors; routed from the startup gate.
- **6D.2a Reconnect** (`CENTRAL_RECOVERY_ACTIONS`) — self-scoped, user-initiated relink to a single existing candidate (no Drive create). **Validated end-to-end (2026-06-11):** executed reconnect from a real recovery page → dashboard reloaded; reconnect reload bug fixed (startup routing re-runs in-app instead of a blank iframe).
- **6E.1 Admin Inspect + Clear Mapping** (`CENTRAL_ADMIN_REPAIR`) — admin read-only inspect + guarded, audited, mapping-store-only clear (deletes mapping + reverse-index property; **no Drive writes, no file deletion**). **Validated end-to-end (2026-07-02):** an executed clear removed the mapping + reverse index, wrote the expected repair audit entry, and the next load reprovisioned a fresh workbook (Welcome routing + dashboard empty-state correct).

Because every recovery/adopt/repair write is behind a fail-closed flag (default OFF) and the central-mode gate, **steady-state behavior is unchanged until a flag is turned on** for testing. See `## Flag Registry`.

**Recovery roadmap (remaining):**

- **6F — Recovery Validation** *(current, ~94–96%)* — healthy-path load validated (2026-06-09); **recovery-page render from a real stale mapping + executed Reconnect validated (2026-06-11)**; **executed admin clear + mapping/reverse-index removal + repair audit history + bootstrap reprovision + Welcome routing + dashboard empty-state + Financial Integrity `NOT_INITIALIZED` + Central admin routing + `ADMIN_EMAILS` validated (2026-07-02)**; remaining = Auto-Adopt + Ambiguous recovery + Name-only adoption + Orphan workbook validation on a disposable account, then flags OFF.
- **6D.2b — Create New Workbook** — self-service "start fresh" action (designed; not implemented). Separate flag, confirm, duplicate-avoidance-first.
- **6E.2 — Admin Set Mapping** — guarded admin remap to an admin-supplied ID (designed; not implemented).

## Flag Registry

Feature flags are central-project **script properties** (`PropertiesService`), read at runtime, **default OFF**, and **fail closed** (absent / unparseable → treated as OFF). They gate the recovery stack so it can ship dark and be enabled only for a controlled validation pass. Set a value to `true` (string) to enable; delete or set anything else to disable.

| Flag | Default | Status | Gates | Behavior when OFF |
| --- | --- | --- | --- | --- |
| `CENTRAL_AUTO_ADOPT` | OFF | Implemented, **not fully runtime-validated** | 6C.1 Adopt-Before-Create at provisioning time (`tryAdoptWorkbookBeforeCreate_`) | No adoption; provisioning creates a new workbook as before. |
| `CENTRAL_RECOVERY_ACTIONS` | OFF | Implemented, **validated end-to-end (2026-06-11)** | 6D.2a user-initiated Reconnect action on the recovery page (`recoveryReconnectSelf`) | Recovery page is display-only; the Reconnect button is hidden. |
| `CENTRAL_ADMIN_REPAIR` | OFF | Implemented, **validated end-to-end (2026-07-02)** — executed clear + audit + reprovision | 6E.1 admin Inspect + Clear Mapping (`adminInspectUser`, `adminClearMapping`) | Admin repair endpoints return disabled / no-op; no mapping writes. |

**Healthy-path validation note (2026-06-09):** the central dashboard was loaded with `CENTRAL_RECOVERY_ACTIONS=true` + `CENTRAL_ADMIN_REPAIR=true` + `CENTRAL_AUTO_ADOPT=false`. The existing workbook resolved correctly, no recovery page triggered, no regression. Admin Diagnostics loaded with the Repair Toolkit visible; Inspect User, mapping preview, reverse-index visibility, and the confirm-before-clear UI all rendered.

**Reconnect validation note (2026-06-11):** with `CENTRAL_RECOVERY_ACTIONS=true`, a **real stale mapping was induced** (the `mapping::<sha256(test-user)>` key was set to an invalid workbook ID). The recovery page rendered correctly and **blocked** normal dashboard access; **Reconnect Existing Workbook executed and the dashboard reloaded successfully**. An empty duplicate/orphan workbook (same name; only `Sheet1` + `INPUT - Settings`; no user data) was found and safely moved to Drive Trash. The previous blank-iframe-after-reconnect bug was fixed (startup routing now re-runs in-app). **Validation-surface note:** the Script Properties UI may not immediately reflect runtime mapping changes during active testing — **Admin Diagnostics is the authoritative validation surface**, and it showed the correct live mapping.

**Executed Admin Clear validation note (2026-07-02):** with `CENTRAL_ADMIN_REPAIR=true`, an **executed Admin Clear Mapping** removed the mapping + reverse-index property and wrote the expected repair audit-ring entry; the **next load reprovisioned** a fresh workbook (Welcome routing + dashboard empty-state correct), and the Financial Integrity Audit correctly reported `NOT_INITIALIZED` on the bootstrap-only workbook. Central admin routing (`?view=admin` → Admin Diagnostics for an admin, dashboard for non-admins) and `ADMIN_EMAILS` resolution were also validated. Flag returned OFF afterward. **Still not yet exercised:** a real adopt with `CENTRAL_AUTO_ADOPT=true`, ambiguous-candidate handling, name-only adoption, and orphan-workbook detection. See `## Recovery Validation Inventory`.

Per-flag detail:

- **`CENTRAL_AUTO_ADOPT`**
  - **Purpose:** at provisioning time with no mapping, adopt a single strict candidate workbook instead of silently creating a duplicate (≥2 candidates → `AmbiguousWorkbookError`).
  - **Risk:** **High** — it is the only flag that changes the provisioning/create path and can relink a user to a workbook automatically. A wrong adopt would point a user at the wrong workbook.
  - **Recommended usage:** keep OFF until the 6F validation pass exercises adopt + ambiguous handling on a disposable account; do not enable in family beta until validated.
- **`CENTRAL_RECOVERY_ACTIONS`**
  - **Purpose:** show the self-service "Reconnect existing workbook" action on the recovery page so a user can relink a single candidate themselves.
  - **Risk:** **Medium** — user-initiated and self-scoped, but it does write a mapping. **Validated end-to-end on a disposable account (2026-06-11):** a real stale mapping was induced, the recovery page rendered, Reconnect executed, and the dashboard reloaded (Admin Diagnostics confirmed the live mapping).
  - **Recommended usage:** validated for the reconnect path; keep OFF in steady state and enable only for controlled testing.
- **`CENTRAL_ADMIN_REPAIR`**
  - **Purpose:** expose the admin Repair Toolkit — read-only Inspect User + a guarded, audited Clear Mapping (mapping store + reverse index only).
  - **Risk:** **Medium** — Inspect is read-only and admin-gated; Clear Mapping is a guarded write to the mapping store only (**no Drive writes, no file deletion**), but clearing the wrong user's mapping would force a re-provision/recovery on their next visit. **Validated end-to-end (2026-07-02):** an executed clear removed the mapping + reverse index, wrote the audit entry, and the next load reprovisioned.
  - **Recommended usage:** validated for the executed-clear path; keep OFF in steady state and only run an actual Clear Mapping against a disposable test user.

Notes:

- These are **independent** of `CENTRAL_MODE` (which selects central vs bound) and of the existing `FAMILY_BETA_ALLOWLIST` / `ADMIN_EMAILS` properties.
- The **Recovery Page (6D.1)** itself is **not** flag-gated — it always replaces a raw resolution error with a friendly screen. Only the *self-service action* on it (Reconnect) is gated by `CENTRAL_RECOVERY_ACTIONS`.
- All three flags are **OFF in the committed state**; the recovery stack is inert until deliberately enabled. Healthy-path load was validated on 2026-06-09, **reconnect + recovery-page render on 2026-06-11**, and **executed admin clear + audit + reprovision on 2026-07-02**; the remaining paths (Auto-Adopt, ambiguous, name-only adoption, orphan workbook) still need the **Recovery Validation (6F)** pass, after which flags return OFF for steady state.

## Recovery Validation Inventory

Tracks how far each recovery-stack capability has actually been **runtime-validated** (vs merely implemented). As of **2026-06-09** a healthy-path validation pass ran with `CENTRAL_RECOVERY_ACTIONS=true` + `CENTRAL_ADMIN_REPAIR=true` + `CENTRAL_AUTO_ADOPT=false`. **6F Part 2 (2026-06-10)** additionally validated the **Admin Repair disabled-path** (all flags OFF → clicked Clear returns "Repair is disabled (flag off)." with no writes). **6F reconnect validation (2026-06-11)** validated the **recovery page from a real stale mapping** and an **executed Reconnect** (dashboard reloaded; reconnect reload bug fixed). **6F progress (2026-06-24)** re-confirmed the **Admin Diagnostics + inspection + feature-flag enforcement** surface (config `CENTRAL_ADMIN_REPAIR=false`): Diagnostics loads; mapping inspection, reverse-index inspection, user lookup, and repair-toolkit inspection all work; mapping/reverse-index consistency is verifiable through Diagnostics; the safety confirmation checkbox works; and Clear Mapping correctly returns "Repair is disabled (flag off)" — Admin inspection / mapping lookup / reverse-index lookup / repair feature-flag enforcement all **PASS**. Separately, `cashcompass2026@gmail.com` opened its existing provisioned workbook with data intact and **no duplicate workbook was created** (not a full Adopt-Before-Create validation — no mapping removal performed). **6F executed-Admin-Clear validation (2026-07-02):** with `CENTRAL_ADMIN_REPAIR=true`, an **executed Admin Clear Mapping** was validated end-to-end — mapping removal, reverse-index removal, repair audit history, bootstrap reprovision after clear, Welcome routing, dashboard empty-state, Financial Integrity `NOT_INITIALIZED` handling, Central admin routing, and `ADMIN_EMAILS`; flag returned OFF afterward. The remaining work is the **adoption/ambiguous/orphan pass with `CENTRAL_AUTO_ADOPT` ON** (Auto-Adopt, ambiguous handling, name-only adoption, orphan-workbook detection — **6F**), on a disposable account. Risk = blast radius if the path misbehaves. **Validation-surface note:** the Script Properties UI may lag runtime mapping changes during active testing; **Admin Diagnostics is the authoritative validation surface.**

**Implemented + tested (validated):**

- **Identity markers (6B)** — Status: validated (in use since 6B; markers/reverse-index/`SYS - Meta` written + read). Risk: Low. Timing: done.
- **Admin Inspect User (6E.1, read-only)** — Status: validated — Diagnostics page + Repair Toolkit load, Inspect User works, mapping preview + reverse-index visibility render. Risk: Low (read-only, admin-gated). Timing: done.
- **Recovery flags healthy-path load** — Status: validated — dashboard loads normally with recovery + admin-repair flags ON and auto-adopt OFF; existing workbook resolves; no recovery page; no regression. Risk: Low. Timing: done.
- **Confirm-before-clear UI (6E.1)** — Status: validated — the confirmation UI renders (the *prompt*, not an executed clear). Risk: Low (UI only). Timing: done.
- **Admin Repair disabled-path enforcement (6E.1)** — Status: validated (6F Part 2, 2026-06-10; **re-confirmed 2026-06-24**) — with `CENTRAL_ADMIN_REPAIR=false`, Inspect/preview work but a clicked **Clear Mapping** returns "Repair is disabled (flag off)." with **no** mapping / reverse-index / workbook change. Confirms the server-side flag gate fails closed. Risk: Low. Timing: done.
- **Admin mapping / reverse-index consistency inspection (6E.1)** — Status: validated (2026-06-24) — mapping inspection, reverse-index inspection, user lookup, and repair-toolkit inspection all work; mapping/reverse-index consistency is verifiable via Admin Diagnostics; the safety confirmation checkbox works. Risk: Low (read-only). Timing: done.
- **Existing-workbook open without duplication** — Status: observed (2026-06-24) — `cashcompass2026@gmail.com` opened its existing provisioned workbook with data intact; no duplicate workbook created. **Not** a full Adopt-Before-Create validation (no mapping removal performed). Risk: Low. Timing: partial.
- **Recovery Page (6D.1) — real-failure render** — Status: validated (2026-06-11) — a real stale mapping (invalid workbook ID) caused the recovery page to render correctly and **block** normal dashboard access. Risk: Medium (user-facing failure surface). Timing: done.
- **Reconnect action (6D.2a)** — Status: validated end-to-end (2026-06-11) — executed Reconnect from the recovery page relinked the user and the dashboard reloaded successfully; the reconnect reload bug (blank iframe) was fixed (startup routing re-runs in-app). Risk: Medium (writes a mapping). Timing: done.
- **Admin Clear Mapping action (executed with flag ON) (6E.1)** — Status: **validated end-to-end (2026-07-02)** — with `CENTRAL_ADMIN_REPAIR=true`, an executed clear removed the mapping + reverse-index property and wrote the expected repair audit entry; flag returned OFF afterward. Risk: Medium (mapping-store write; wrong target forces re-provision/recovery). Timing: done.
- **Mapping + reverse-index removal (6E.1)** — Status: validated (2026-07-02) — both properties removed by the executed clear. Risk: Medium. Timing: done.
- **Repair audit history (6E.1)** — Status: validated (2026-07-02) — the executed clear wrote the expected admin audit-ring entry. Risk: Low. Timing: done.
- **Bootstrap reprovision after clear** — Status: validated (2026-07-02) — the next load provisioned a fresh workbook; Welcome routing + dashboard empty-state correct. Risk: Medium. Timing: done.
- **Financial Integrity `NOT_INITIALIZED` handling** — Status: validated (2026-07-02) — a bootstrap-only workbook reports the informational state, not FAIL. Risk: Low. Timing: done.
- **Central admin routing + `ADMIN_EMAILS`** — Status: validated (2026-07-02) — `?view=admin` renders Admin Diagnostics for an admin, dashboard for non-admins; admin identity resolves against `ADMIN_EMAILS`. Risk: Low. Timing: done.

**Implemented + not yet tested:**

- **Auto-Adopt with `CENTRAL_AUTO_ADOPT=true` (6C.1)** — Status: not tested (flag was OFF during validation). Risk: **High** (changes the provisioning/create path; can auto-relink). Timing: 6F, isolated, disposable account only.
- **Ambiguous-candidate handling (≥2 → `AmbiguousWorkbookError`)** — Status: not tested. Risk: Medium. Timing: 6F.
- **Name-only adoption (MEDIUM-confidence single candidate)** — Status: not tested; confirm MEDIUM adoption is acceptable for beta. Risk: Medium. Timing: 6F.
- **Orphan workbook detection (`ORPHANS_PRESENT`)** — Status: not exercised end-to-end; surfacing-only, manual cleanup. Risk: Low. Timing: 6F.

## Bound Project Safety

**Current conclusion: SAFE TO PUSH TO BOUND.** The recovery stack does not change bound-mode behavior, because:

- **Central code is gated by `CENTRAL_MODE`** — the resolver routes to provisioning/recovery only in central mode; in bound mode `getUserSpreadsheet_()` returns the active spreadsheet as before.
- **Recovery actions fail closed** — all three flags default OFF and unparseable/absent → OFF; adopt/reconnect/admin-repair write paths are unreachable when OFF.
- **`SYS - Meta` creation is downstream of Central provisioning** — markers are written on the central create/adopt path, not on any bound write path.
- **Bound workbook is unaffected** — no recovery/adopt/repair code runs against the bound workbook; the production data path is untouched.

**Operational precondition (before any future bound deployment):** verify the **allow-list** (`FAMILY_BETA_ALLOWLIST`) and the **bound deployment configuration** (manifest `executeAs` / `access`, pinned vs head version) before redeploying the bound URL to head — a fail-closed allow-list means an unset property would show the rejection page on the bound URL too.

## Family Beta workbook styling

> **Roadmap status:** completing this is the **Workbook Formatting & Visual Parity** objective — **Stage 3 (Beta Readiness), P1, effort L** — a **first-class Family Beta quality gate**, not minor polish. **Goal: a newly provisioned workbook is visually indistinguishable from the mature production workbook** (styling, column widths, row heights, freeze rows, hidden helper columns, colors, fonts, conditional formatting, number formats, total rows, notes, filters, sheet ordering; plus Retirement / Investments / House Values / Cash Flow parity). The **production workbook is the visual source of truth (the "Golden Workbook")** — spec: `GOLDEN_WORKBOOK.md`; per-sheet status/gaps: `WORKBOOK_PARITY_CHECKLIST.md`. **First task: the Golden Workbook Audit** (production screenshots — styling is *observed*, not inferred from code) before any styling code changes. See `TODO.md → Stage 3 → D. Workbook Formatting & Visual Parity`.

Newly provisioned (and first-create) workbooks are styled to a shared **Family Beta** standard so they visually match the production/bound workbook. Styling is **first-create-only** and uses **widen-only** column logic, so it never reformats or shrinks an existing populated sheet (honors `WORKING_RULES.md → No destructive sheet changes`).

**Family Beta standard:** yellow header band (`#ffe599`, bold, 16pt, ~40px height, vertical-middle); white body (14pt); subtle gray section/year rows (`#d9d9d9` with a `#999999` bottom border); defensive green totals (`#b6d7a8`, applied only if a total row is present); defensive tan delta (`#fce5cd`); frozen header/year rows + first column; widen-only widths tuned for the 16pt header.

**Completed (helpers + first-create wiring):**

- **Bank Accounts** — `applyBankAccountsSheetStyling_` (bank_accounts.js). Gray Year banner, yellow header, white data rows; includes the empty-block **first-account-row** fix in `insertNewBankAccountHistoryRow_` (the first account in a fresh block no longer inherits header styling).
- **Debts** — `applyDebtsSheetStyling_` (debts.js). Yellow header, white body, tuned widths, defensive green `TOTAL DEBT` band when present.
- **Bills** — `applyBillsSheetStyling_` (bills.js). Yellow header, white body, tuned widths.
- **Upcoming Expenses** — `applyUpcomingExpensesSheetStyling_` (upcoming_expenses.js), wired in `getOrCreateUpcomingExpensesSheet_`'s create branch.

**Remaining for full visual parity (Stage 3, P1 — the Workbook Formatting & Visual Parity objective):** Investments, House Values, and Cash Flow palette migration (their existing styling helpers run on bound-mode write paths, so they must be gated to first-create only); Retirement bespoke section-aware styling; an optional shared `applyReadableColumnWidths_` helper; and a full sweep of the remaining visual attributes (row heights, hidden helper columns, conditional formatting, number formats, notes, filters, sheet ordering) against production. Detailed plans live in `CENTRAL_APP_FAMILY_BETA_PLAN.md` and `GENERATED_SHEET_FORMATTING_POLISH_PLAN.md`. The **Workbook Totals Project** (TOTAL DEBT / Total Accounts / Delta row generation) is complete (Stage 1).

## Important resolved infra issues
- Duplicate doGet() caused template problems before. Only keep one active doGet().
- Duplicate includeHtml_() caused malformed HTML/script include problems before.
- Correct include helper should use raw content, not HTML parsing, for included script files. **Contributor detail:** `WORKING_RULES.md` explains why included fragments cannot contain their own template tags.
- The dashboard now renders correctly again.

## Current business rules for bills / cash flow
- Blank Cash Flow cell = due / unhandled
- 0 in Cash Flow = skipped / handled
- Non-zero value in Cash Flow = paid / handled

## Bills Due design now

### Debt bills
- come from DEBTS

### Mapped recurring non-debt bills
- come from INPUT - Bills

### Fallback recurring bills
- should remain visible in the Recurring Bills (No Due Date) section until they are migrated into INPUT - Bills

## INPUT - Bills structure
Columns (header lookup is **case- and whitespace-tolerant** — `PAYMENT SOURCE` and `Payment Source ` with a trailing space both match):
- Payee
- Category *(required for new bills via Add bill)*
- Due Day
- Default Amount
- Varies
- Autopay
- Active *(Stop tracking sets this to `No`)*
- Payment Source *(CASH | CREDIT_CARD — drives **Flow Source** on Cash Flow rows created from Bills → Pay)*
- Frequency
- Start Month *(rows created from Bills → Pay leave months before this blank)*
- Notes

Missing optional columns (Payment Source, Category, Frequency, Start Month, Notes) are auto-added by `addBillFromDashboard` before writing a new row.

## Bills behavior wanted
- If current month due date passed and Cash Flow cell is blank, show overdue
- If current month is handled, roll forward and show next cycle when appropriate
- Quarterly bills should only apply in scheduled months
- Autopay = Yes and Varies = No → okay to auto-write
- Autopay = Yes and Varies = Yes → do not auto-write
- Default Amount = 0 → still list in Bills Due when unhandled; autopay does not write (use Pay / manual Cash Flow for the amount)
- Fallback recurring bills should show overdue or upcoming correctly

## Current UI state
- Bills Due is rendering
- Labels exist: category, autopay, varies, source
- Some fallback recurring bills are missing and need fixing

## Important files most likely to edit next
- dashboard_data.js
- Dashboard_Script_BillsDue.html

## Next task
See **`TODO.md`** for current priorities (there is no separate next-task file).

## Release / “how far from 1.0?”
See **`GoingToProduction.md`** — Goal A vs B, suggested **v0.9** label, three-bar interpretation of **1.0**, and what blocks broader distribution. Update that file when the readiness story changes so chat sessions don’t re-derive it.

## First-time setup
- Step-by-step (workbook, deploy web app, smoke check): **`FIRST_RUN.md`**.  
- **Canonical template workbook (optional):** Add a “known good” Google Sheets link here when you freeze one for your household—omit from public repos if the URL is sensitive.  
  - *Template link: (none yet — add when ready.)*