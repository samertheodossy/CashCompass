Use this folder as the source of truth.

**Current phase — V1.1 / controlled improvement mode.** The V1 trust baseline is complete: blank workbooks are stable, the major missing-sheet crashes are fixed, misleading zero / fake states are gone, the planner email is gated on `INPUT - Settings.Email` + a meaningful summary, and the bounded UI copy consistency pass has shipped. Read `WORKING_RULES.md → Current phase` before proposing any change, and follow the V1.1 rules (one issue at a time, no large refactors, no architecture changes unless explicitly approved, minimal / localized / safe diffs, and ship each change with exact manual test steps for both a blank and a populated workbook — see `TESTING_PLAN.md → Blank + populated two-track manual checks`).

Before doing anything, read:

**Core (every session)**
- `WORKING_RULES.md` — V1.1 phase rules, HtmlService includes, Help/doc expectations
- `PROJECT_CONTEXT.md` — architecture, data flow, current phase summary
- `TODO.md` — open items and `Next phase / V1.1` candidates
- `SESSION_NOTES.md` — V1 trust baseline phase history + chronological change log

**Contextual (read only when relevant)**
- `ENHANCEMENTS.md` — durable backlog and prioritization
- `ONBOARDING_AND_INPUT_STRATEGY.md` — onboarding and input system
- `FIRST_RUN.md` — deployment and first-open expectations (V1 trust baseline)
- `SECURITY.md` — deployment and access control
- `TESTING_PLAN.md` — manual two-track test discipline for V1.1

Then:

- Summarize the project structure and key modules / entry points (`webapp.js` / `doGet`, `dashboard_data.js`, feature `*.js` + `Dashboard_*`).  
- If the user asks about production, testing strategy, or security, incorporate the matching doc above—not only `TODO.md`.  

**Rules**

- **Do not write code yet.** This pass is orientation and summary only.  
- **Do not commit** — **never** `git add` / `git commit` / `git push` unless the user **explicitly** asks in that conversation (see `COMMIT_RULES.md` and `.cursor/rules/git-no-autonomous-stage-commit.mdc`).  
- **Help:** User-visible changes should include updates to **`Dashboard_Help.html`** when appropriate (see `WORKING_RULES.md` / `COMMIT_RULES.md`).  
- **V1.1 discipline:** one issue at a time, minimal / localized / safe diffs, and always consider both a blank and a populated workbook. No architecture changes, no destructive sheet changes.

Return the full answer in one complete response.
