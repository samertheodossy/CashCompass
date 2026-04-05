Use this folder as the source of truth.

Before doing anything, read:

**Core (every session)**  
- `PROJECT_CONTEXT.md` — architecture, tabs, bills/cash-flow rules  
- `WORKING_RULES.md` — HtmlService/includes, gotchas  
- `NEXT_TASK.md` — immediate focus  
- `TODO.md` — open work, important Activity/HISTORY item, codebase backlog  
- `SESSION_NOTES.md` — what changed recently  

**Strategic / planning (read or skim when the task touches roadmap, shipping, tests, or security)**  
- `GoingToProduction.md` — v0.9 framing, gap to “product for others,” phased rollout  
- `TESTING_PLAN.md` — automated testing layers; keep tests off the live sheet  
- `SECURITY.md` — web app access (`MYSELF`), XSS/secrets/sharing, checklists  
- `ONBOARDING_TODO.md` — long-term workbook setup for other users  

Then:

- Summarize the project structure and key modules / entry points (`webapp.js` / `doGet`, `dashboard_data.js`, feature `*.js` + `Dashboard_*`).  
- If the user asks about production, testing strategy, or security, incorporate the matching doc above—not only `TODO.md`.  

**Rules**

- **Do not write code yet.** This pass is orientation and summary only.  
- **Do not commit** (`git add` / `git commit`) **unless the user explicitly asks** to commit (same idea as `COMMIT_RULES.md`).  

Return the full answer in one complete response.
