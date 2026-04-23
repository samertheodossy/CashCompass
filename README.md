# CashCompass

A personal financial planning app built on Google Sheets + Google Apps Script, with a web dashboard (`doGet`) and a spreadsheet sidebar. Tagline: *Guiding your money decisions.*

This README is the entry point. It does not re-explain the app — it routes you to the right doc.

---

## Start here

1. **Read `WORKING_RULES.md` first.** It defines the current phase (V1.2 / controlled improvement mode; V1.1 closed out) and the rules every change must follow — one issue at a time, minimal/localized/safe, no large refactors or architecture changes without explicit approval, always consider both **blank** and **populated** workbooks.
2. **Then skim `PROJECT_CONTEXT.md → Current phase`** for the live product state and the canonical tab-by-tab behavior.
3. **Before starting any change,** check `TODO.md → V1.2 work queue` to see what's Active, what's a V1.2 candidate, and what's explicitly Later / future phase.
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

- `TODO.md` — V1.2 work queue (Active / Next / Later) + historical backlog.
- `ENHANCEMENTS.md` — product-level rationale, phase history, Active / Next / Later mirror.

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

## Current working mode

**V1.2 / controlled improvement mode (V1.1 closed out).** The V1 trust baseline is complete, and V1.1 shipped the retirement profile integration end-to-end (Profile DOB → derived current age, manual age removed from Retirement, DOB parser accepts Date objects + strings, display-only UI, cleaned sheet seed). Same rules apply to V1.2.

Rules for every change in this phase:

- One issue at a time. No large refactors. No architecture changes unless explicitly approved. No destructive sheet changes. Preserve existing populated-workbook behavior.
- Every fix is minimal, localized, and safe. Favor small diffs.
- Every fix is exercised against **both** a blank workbook and a populated workbook before being called done (see `TESTING_PLAN.md`).
- New work is pulled from `TODO.md → V1.2 work queue → V1.2 candidates`. Items under **Later** require an explicit product decision to move up.

Authoritative sources for these rules: `WORKING_RULES.md → Current phase` and `ENHANCEMENTS.md → § 0. Current phase`.

---

## Current V1.2 direction

Short mirror of `TODO.md → V1.2 work queue`. The live queue in `TODO.md` is the source of truth.

- **Active now:** nothing in flight — pick the next item from the candidates below.
- **V1.2 candidates (A — immediate follow-ups, low risk):** Profile DOB parser symmetry (accept Date objects on save-side validation), Overview Retirement Outlook copy alignment with `needsProfileDob`, blank-workbook empty-state consistency sweep, copy/Help polish sweep.
- **V1.2 candidates (B — product improvements):** Profile completeness indicator / badge, better Retirement setup guidance / linking to Profile, optional spouse UX clarity (single vs partnered).
- **V1.2 candidates (C — future ideas, do not act yet):** legacy sheet cleanup tool for inert retirement age rows, Profile → other modules integration, notifications / SMS using the existing Profile phone field.
- **Deferred from V1.1:** planner email guardrails telemetry (informational only), low-risk codebase cleanups, dead-code prune for the retirement profile integration helpers.
- **Later (post-V1.2 / future phase):** onboarding factory refactor, Activity smart-undo phases 2–4, Cash Strategy, HELOC advisor refinement, Plaid-style sync, broader regression / test harness, two-dashboards unification, and the larger product items captured in `TODO.md → Historical backlog`.

---

## Contributing

- Never commit or push unless explicitly asked (see `COMMIT_RULES.md` and the `git-no-autonomous-stage-commit` rule in `.cursor/rules/`).
- Keep user-facing copy aligned with the V1 copy consistency pass: short, trust-safe, no internal sheet names, no "Error:" prefixes on already-styled errors.
- When in doubt about scope, re-read `WORKING_RULES.md → Current phase` before writing code.
