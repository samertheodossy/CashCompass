Use this folder as the source of truth.

Before doing anything, read:

**Core (every session)**
- `PROJECT_CONTEXT.md` — architecture, data flow
- `TODO.md` — current work and issues
- `SESSION_NOTES.md` — recent changes

**Contextual (read only when relevant)**
- `ENHANCEMENTS.md` — roadmap and prioritization
- `ONBOARDING_AND_INPUT_STRATEGY.md` — onboarding and input system
- `FIRST_RUN.md` — deployment and setup
- `SECURITY.md` — deployment and access control
- `TESTING_PLAN.md` — testing strategy

Then:

- Summarize the project structure and key modules / entry points (`webapp.js` / `doGet`, `dashboard_data.js`, feature `*.js` + `Dashboard_*`).  
- If the user asks about production, testing strategy, or security, incorporate the matching doc above—not only `TODO.md`.  

**Rules**

- **Do not write code yet.** This pass is orientation and summary only.  
- **Do not commit** — **never** `git add` / `git commit` / `git push` unless the user **explicitly** asks in that conversation (see `COMMIT_RULES.md` and `.cursor/rules/git-no-autonomous-stage-commit.mdc`).  
- **Help:** User-visible changes should include updates to **`Dashboard_Help.html`** when appropriate (see `WORKING_RULES.md` / `COMMIT_RULES.md`).  

Return the full answer in one complete response.
