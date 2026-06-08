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

- **Architecture:** Central App operational.
- **Family Beta readiness:** ~95%+.
- **Completed (working in central mode):** Provisioning, Workbook Mapping, Dashboard, Planner, Assets, Properties, Cash Flow, Bills, Debts, Income, Activity, Email.
- **Current focus:** Family Beta Hardening, Workbook Totals Project, Chat Assistant planning, External Beta preparation.

Full picture: `PROJECT_CONTEXT.md → Current Product Status (June 2026)`. Roadmap: `TODO.md → Launch Readiness Roadmap`.

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

- **Phase 1 — Documentation Cleanup** *(in progress, P0)* — sync all docs with live Central architecture; record Family Beta styling + deployment model.
- **Phase 2 — Family Beta Hardening** *(P1)* — **2A Workbook Diagnostics** (candidate detection, classification, mapping audit, orphan audit, duplicate visibility — read-only) then **2B Workbook Recovery** (auto-adopt, recovery/repair tools, stale-mapping recovery UX, rollout checklist). Design: `CENTRAL_APP_WORKBOOK_DIAGNOSTICS_PLAN.md`.
- **Phase 3 — Workbook Totals Project** *(P1–P2)* — TOTAL DEBT, Total Accounts, Delta (+ formula strategy, insert/update behavior, reader compatibility).
- **Phase 4 — Chat Assistant v1** *(P2)* — read-only assistant (spending/debt/retirement/cash-flow questions, planner + dashboard explanations). Write-capable assistant is future.
- **Phase 5 — Web App UX Improvements** *(P2)* — onboarding, empty-states, error handling, user guidance/help, dashboard + planner polish, help text & content cleanup (reduce cognitive load) (+ residual V1.2 polish backlog).
- **Phase 6 — External Beta Readiness** *(P3)* — support workflow, feedback collection, onboarding, recovery flows, diagnostics, beta-user management.
- **Phase 7 — Paid Product Readiness** *(P4)* — pricing/subscription model, entitlements + plan enforcement, privacy policy, terms of service, support process, operational monitoring.

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
