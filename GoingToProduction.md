# Going to production — honest read

This note answers: **how far from a “productizable” product are we**, what **blocks** shipping to others, and what **version** label fits so you can build on it without kidding yourself.

---

## Two different “production” goals

**A — Production for the owner (you / one household)**  
A bound Google Sheet + deployed web app you trust with your own money data. Reliability and correctness matter; polish and onboarding can be “good enough for us.”

**B — Product for other people**  
Someone else can install, understand, and run it with **minimal hand-holding**: template workbook, setup path, permissions story, predictable updates, and support surface you can live with.

The codebase today is **much closer to A than to B**.

---

## What you can honestly call this version

**Suggested label: `v0.9 — household production` (or “personal GA”)**

- **Meaning:** Feature-rich, real workflows (overview, bills, cash flow touches, debts, assets, retirement, purchase sim, planner + OUT - History). Usable daily **if** the spreadsheet is already structured the way the scripts expect.
- **Why not 1.0 for the market:** No first-run story for a stranger, no multi-tenant isolation, deployment is still “bind script + deploy web app + know your tabs,” and several items in `TODO.md` are real product gaps (subscriptions, donations UI, tax, debt UI polish, etc.).
- **Build on it:** Treat **0.9** as the baseline: stable enough to commit to, with a written **contract** (tab names, columns) and `clasp` as source of truth. **1.0** could mean “documented template + validation scan + one happy-path setup for a second household,” not necessarily SaaS.

---

## How far from “productizable” (goal B)?

**Rough estimate: medium–large gap**, not because the app is thin—it isn’t—but because **productization is mostly everything around the spreadsheet**.

| Area | Today (typical) | What “product for others” usually needs |
|------|-----------------|----------------------------------------|
| **Onboarding** | Power-user setup; `ONBOARDING_TODO.md` is the roadmap, not shipped UX | Template sheet + “does my workbook pass?” validation + guided creation of missing tabs/headers |
| **Identity & access** | Web app `access: MYSELF`, `executeAs: USER_DEPLOYING` — effectively **one user, one deploy** | Clear story for “domain / anyone with link / per-user” and what each implies for who can see financial data |
| **Multi-household** | One spreadsheet = one household | Either one product per copy of the sheet, or explicit multi-tenant design (you are not doing the latter yet) |
| **Correctness & regressions** | Manual testing + planner runs | Smoke checklist, optional automated tests for pure functions, version notes per deploy |
| **Observability** | Stackdriver exception logging | For others: minimal “what failed and what to tell support” without exposing PII |
| **Updates** | `clasp push` + retest | Changelog + “breaking schema” policy (you already think about this in onboarding doc) |
| **Trust & legal** | Personal tool | If you ever charge or distribute widely: terms, privacy, “not financial advice,” data location (Google) |

**Bottom line:** The **application depth** is ahead of many MVP finance apps; the **packaging, onboarding, and operational** layer is what keeps this from being “download and run” for arbitrary users.

---

## What actually blocks broader use (prioritized)

**Hard blockers for strangers**

1. **Workbook contract** — Correct tabs and columns must exist; errors are still too easy if someone renames INPUT/SYS/OUT tabs or headers.
2. **No guided setup** — Without validation + repair or a wizard, support burden explodes.
3. **Single-user web deployment model** — Fine for personal use; must be **explicit** in any doc (“each household: copy template, bind script, deploy as yourself”).

**Soft blockers (quality / completeness)**

4. Open **TODO.md** product items (debt page UX, upcoming dropdowns, bills/debts cleanup, tax, etc.) — these don’t block *you* from daily use but block calling it “complete” for a general audience.
5. **Activity / HISTORY ledger** — Quick Pay, skip, autopay, and **house expenses** are logged; Activity UI supports filters, type-from-sheet, and paging. **Gaps** (upcoming lifecycle, manual Cash Flow edits, CSV export) still limit “full provenance” for strangers — soft quality gap, not a hard ship blocker for personal use.
6. **Two surfaces** (`PlannerDashboardWeb` vs sidebar `PlannerDashboard.html`) — maintainability risk when you promise updates to others.

**Non-blockers for a serious personal tool**

- Monte Carlo, purchase sim, property performance — depth is a strength, not a launch blocker for goal A.
- Perfect charting — explicitly long-term in TODO.

---

## Recommended plan (build on 0.9)

**Phase 1 — Lock “personal production” (short)**  
- Frozen **template** spreadsheet (even if manual): “known good” copy linked from README or `PROJECT_CONTEXT.md`.  
- Short **deploy checklist**: clasp push, deploy web app, set URL in script, smoke test Overview + Quick Pay + Bills Due + one planner run.  
- Keep **SESSION_NOTES.md** / commits disciplined around risky areas (per your `COMMIT_RULES.md`).

**Phase 2 — “Friend / family beta” (productization lite)**  
- **Validation-only** function: scan workbook, report missing tabs/headers (matches onboarding doc §2).  
- One-page **“First run”** doc: time zone, required tabs, never rename list.  
- **Activity log** is past phase 1 (see `TODO.md` / `SESSION_NOTES`); optional next steps: upcoming events, export, onEdit logging.

**Phase 3 — “1.0 template product”**  
- Guided tab/header creation (idempotent) from `ONBOARDING_TODO.md` rollout order.  
- Breaking-change process: schema version + “repair workbook” routine.  
- Revisit web app **access** settings only if you intentionally invite multiple Google accounts.

**Phase 4 — Only if you want a business**  
- Separate identity/billing, support channels, hardened security review, ToS/Privacy — a different project layer on top of the same core.

---

## Honest one-liner

**You already have a strong v0.9 personal finance command center** tied to Google Sheets; **productizing it for people you don’t know** is mostly **onboarding, validation, documentation, and operations**—not “one more feature.” Name the version, freeze a template, and treat everything in Phase 2+ as closing the gap to a real **1.0 distributable**, not as a prerequisite for **your** daily use.
