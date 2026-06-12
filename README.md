# CashCompass

A personal financial planning app built on Google Sheets + Google Apps Script, with a web dashboard (`doGet`) and a spreadsheet sidebar. Tagline: *Guiding your money decisions.*

This README is the entry point. It does not re-explain the app — it routes you to the right doc.

---

## Start here

1. **Read `WORKING_RULES.md` first.** It defines the current phase (Central App live + Family Beta readiness) and the rules every change must follow — one issue at a time, minimal/localized/safe, no `doGet`/`includeHtml_`/snapshot-shape or destructive sheet changes without explicit approval, always consider both **blank** and **populated** workbooks, and (for Central App work) the active Central App Transition Rules.
2. **Then skim `PROJECT_CONTEXT.md → Current phase`** for the live product state and the canonical tab-by-tab behavior.
3. **Before starting any change,** check `TODO.md → Launch Readiness Roadmap` for the active phase, and `TODO.md → V1.2 polish backlog` for small-polish picks.
4. **After each implementation step,** run the blank + populated manual checks in `TESTING_PLAN.md`.

If you are onboarding a contributor (or yourself after a break), `INIT_PROMPT.md` is the minimal reading list; `FIRST_RUN.md` is the smoke check.

---

## Documentation map

### Core (read these; they reflect the current state)

- `WORKING_RULES.md` — working rules + current phase.
- `PROJECT_CONTEXT.md` — live architecture, tab behavior, current phase.
- `TESTING_PLAN.md` — manual test discipline (blank + populated two-track).
- `FIRST_RUN.md` — first-open smoke check.
- `INIT_PROMPT.md` — agent / contributor bootstrap reading list.

### Planning (what's next)

- `TODO.md` — Launch Readiness Roadmap (Phase 1–7) + V1.2 polish backlog + historical backlog.
- `ENHANCEMENTS.md` — product-level rationale, phase history, Active / Next / Later mirror.
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

## Current Product Status (June 2026)

- **Architecture:** Central App operational — **stable, family-beta capable**; production / bound workbook remains protected.
- **Completed (working in central mode):** Provisioning, Workbook Mapping, Dashboard, Planner, Assets, Properties, Cash Flow, Bills, Debts, Income, Activity, Email.
- **Recently completed:** Diagnostics (Phase 2A Admin Diagnostics), Debt parity (Phase 3.1 TOTAL DEBT), Bank Accounts parity (Phase 3.2a Total Accounts + Phase 3.2b Delta), Bank/Debts Add-New dropdown fix, Identity markers (Phase 6A design + Phase 6B Workbook Identity Markers).
- **Recovery stack (shipped behind flags, default OFF; healthy-path validated 2026-06-09, reconnect + recovery-page render validated 2026-06-11):** Phase 6C.1 Adopt-Before-Create (`CENTRAL_AUTO_ADOPT` — implemented, not fully validated), Phase 6D.1 Recovery Page (real-failure render validated), Phase 6D.2a Reconnect (`CENTRAL_RECOVERY_ACTIONS` — validated end-to-end), Phase 6E.1 Admin Inspect + Clear Mapping (`CENTRAL_ADMIN_REPAIR` — healthy-path + disabled-path validated, executed clear pending). See `PROJECT_CONTEXT.md → Flag Registry` + `→ Recovery Validation Inventory`.
- **Current focus — Recovery Validation (6F, ~80–85%):** reconnect + recovery-page render validated; remaining = executed admin clear + audit log + adopt + ambiguous handling on a disposable account, then flags OFF. Remaining slices: 6D.2b Create New Workbook, 6E.2 Admin Set Mapping.
- **Status snapshot (2026-06-11):** Central Architecture ~95%+ · Recovery Architecture ~90% implemented · Recovery Validation ~80–85% · Family Beta Readiness improving · External Beta Readiness dependent on recovery validation.
- **Validation-surface note:** the Script Properties UI may lag runtime mapping changes during active testing; **Admin Diagnostics is the authoritative validation surface**.
- **Bound safety:** **SAFE TO PUSH TO BOUND** — recovery code is `CENTRAL_MODE`-gated and fail-closed; bound workbook unaffected. Precondition: verify allow-list + bound deployment config before any future bound deploy. See `PROJECT_CONTEXT.md → Bound Project Safety`.
- **Future:** External beta readiness/hardening, family-beta expansion + user-lifecycle handling, Chat Assistant, Paid Product framework.

Full picture: `PROJECT_CONTEXT.md → Current Product Status (June 2026)`, `→ Workbook Identity & Recovery (live + roadmap)`, `→ Flag Registry`, `→ Recovery Validation Inventory`, and `→ Bound Project Safety`. Roadmap: `TODO.md → Launch Readiness Roadmap`.

> **Roadmap-label note:** the Identity & Recovery sub-series **Phase 6A–6F** is the detailed expansion of the macro roadmap's **Phase 2B — Workbook Recovery** — it is *not* the macro **"Phase 6 — External Beta Readiness."**

---

## Current working mode

**Central App live + Family Beta readiness.** The Central App architecture is operational — `getUserSpreadsheet_()` is a real resolver that, in central mode (`CENTRAL_MODE`), provisions each allow-listed user their own Drive-owned workbook on first access (runtime-validated). Family Beta styling has shipped for Bank Accounts, Debts, Bills, and Upcoming Expenses. The V1 trust baseline and V1.1 retirement profile integration remain the stable foundation.

The V1.2 change discipline still applies to every edit, plus the now-active Central App migration discipline:

- One issue at a time. No large refactors. No `doGet` / `includeHtml_` / snapshot-shape changes unless explicitly approved. No destructive sheet changes. Preserve existing populated-workbook behavior.
- Central App changes follow `WORKING_RULES.md → Central App Transition Rules` (active): one module at a time, bound + central modes coexist, no reformatting of existing workbooks.
- Every fix is minimal, localized, safe, and exercised against **both** a blank and a populated workbook (see `TESTING_PLAN.md`).
- New work is pulled from `TODO.md → Launch Readiness Roadmap`.

Authoritative sources: `WORKING_RULES.md → Current phase` + `→ Central App Transition Rules`, `PROJECT_CONTEXT.md → Current architecture — Central App (live)`, and `ENHANCEMENTS.md → § 0. Current phase`.

---

## Launch Readiness Roadmap

Detailed source of truth: `TODO.md → Launch Readiness Roadmap` (objective, why it matters, deliverables, dependencies, priority per phase). High-level summary: `PROJECT_CONTEXT.md → Launch Readiness Roadmap (high-level)`. Short mirror:

- **Phase 1 — Documentation Cleanup** *(✅ complete, P0)* — docs synced with live Central architecture; Family Beta styling + deployment model recorded; kept current by ongoing doc passes.
- **Phase 2 — Family Beta Hardening** *(P1, in progress)* — **2A Workbook Diagnostics** ✅ (read-only candidate detection, classification, mapping/orphan audit, duplicate visibility). **2B Workbook Recovery** is expanded as the **Workbook Identity & Recovery** series — the recovery stack (6C.1/6D.1/6D.2a/6E.1) is **implemented and committed, flag-gated OFF, and healthy-path validated (2026-06-09) — destructive/edge paths pending**; the active step is **Recovery Validation (6F)** (see below). Design: `CENTRAL_APP_WORKBOOK_DIAGNOSTICS_PLAN.md`.
- **Phase 3 — Workbook Totals Project** *(✅ complete for current scope, P1–P2)* — TOTAL DEBT (3.1), Bank Accounts Total Accounts (3.2a), Bank Accounts Delta (3.2b). Investments / House Values parity is a later follow-up if needed.
- **Phase 4 — Chat Assistant v1** *(P2, future)* — read-only assistant (spending/debt/retirement/cash-flow questions, planner + dashboard explanations). Write-capable assistant is future.
- **Phase 5 — Web App UX Improvements** *(P2)* — onboarding, empty-states, error handling, user guidance/help, dashboard + planner polish, help text & content cleanup (reduce cognitive load) (+ residual V1.2 polish backlog).
- **Phase 6 — External Beta Readiness** *(P3, future)* — support workflow, feedback collection, onboarding, recovery flows, diagnostics, beta-user management.
- **Phase 7 — Paid Product Readiness** *(P4, future)* — pricing/subscription model, entitlements + plan enforcement, privacy policy, terms of service, support process, operational monitoring.

**Workbook Identity & Recovery (6A–6F) — active near-term track, expansion of Phase 2B:**

- **6A — Identity & Recovery design** *(✅)* and **6B — Workbook Identity Markers** *(✅, markers only, no behavior change)*.
- **6C.1 — Adopt-Before-Create** *(✅, `CENTRAL_AUTO_ADOPT` OFF)*, **6D.1 — Recovery Page** *(✅, real-failure render validated)*, **6D.2a — Reconnect** *(✅, `CENTRAL_RECOVERY_ACTIONS` OFF; validated end-to-end 2026-06-11)*, **6E.1 — Admin Inspect + Clear Mapping** *(✅, `CENTRAL_ADMIN_REPAIR` OFF)*. All **implemented, flag-gated OFF; healthy-path validated (2026-06-09), reconnect + recovery-page render validated (2026-06-11), remaining destructive paths pending**.
- **6F — Recovery Validation** *(current, P1, ~80–85%)* — healthy-path + reconnect + recovery-page render validated; remaining = executed admin clear + audit log + adopt + ambiguous handling, then flags OFF. Remaining slices: **6D.2b — Create New Workbook** *(P1, designed)*, **6E.2 — Admin Set Mapping** *(P2, designed)*.
- Flags: see `PROJECT_CONTEXT.md → Flag Registry` (`CENTRAL_AUTO_ADOPT`, `CENTRAL_RECOVERY_ACTIONS`, `CENTRAL_ADMIN_REPAIR` — all default OFF).

Small-polish picks (Profile DOB parser symmetry, empty-state sweeps, etc.) are retained in `TODO.md → V1.2 polish backlog` and fold into Phase 5.

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
