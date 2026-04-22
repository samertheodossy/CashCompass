# Going to production — honest read

> **Reference document — release-readiness strategy.**
> This note pre-dates the V1 trust baseline. Current status is captured in `PROJECT_CONTEXT.md → Current phase` and `SESSION_NOTES.md → V1 trust baseline — complete`; current scope discipline lives in `WORKING_RULES.md → Current phase`. The version label, goal-A / goal-B framing, and “three bars” interpretation below are still useful for thinking about what "1.0 for strangers" would take — update the position read only when the readiness story actually shifts.

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

## Interpreting “1.0” — three bars (keep this; don’t re-derive each time)

**Canonical place for “how far are we from 1.0?”** — this section plus **`TODO.md`** (concrete backlog) and **`PROJECT_CONTEXT.md`** (what exists). Update the table when scope or reality shifts.

| If “1.0” means… | Rough position today |
|-----------------|------------------------|
| **Daily personal use** — one household, you own the spreadsheet and web deploy | **There** for core paths, with known gaps in **`TODO.md`** (e.g. debt panel polish, two-HTML drift, product wishlist). |
| **“We’d call it 1.0 on a changelog”** — agreed scope done: nagging TODO UX items, web/sidebar **parity** where you care, documented **golden-path** smoke after deploy | **About 1–3 focused iterations**, not months of greenfield. |
| **Commercial SaaS / multi-tenant / bank sync (Plaid) / full undo** | **Different product** — not required for an honest household **1.0**; see **Goal B** and **`TODO.md`** research items. |

### Already strong (household production)

- **Breadth** — Overview; Assets (houses, banks, investments); Cash Flow (Quick add, Upcoming, Donations, Bills Due); Activity; Properties; Planning (debts, retirement, purchase sim); planner + **OUT - History**.
- **Discipline** — **LOG - Activity** for major script-driven flows; duplicate logging avoided where wired; **Help** tracks behavior; infra gotchas in **`WORKING_RULES.md`**.
- **Sheets as source of truth** — right model for Apps Script + HtmlService; the app is a **control surface**, not a second database.

### Still shy of a crisp “product 1.0” label

- **Open product/testing items** in **`TODO.md`** (not blockers for *your* daily use if you accept them).
- **Two HTML surfaces** (`PlannerDashboardWeb` + modular `Dashboard_*` vs sidebar **`PlannerDashboard.html`**) — drift risk until one is canonical or parity is routine; see **`TODO.md`** item 16 and **Easy wins**.
- **Activity undo** — dashboard **Remove** is safe for **donations**; other event types are audit + sheet edits until phased undo ships.
- **Little automated regression** — normal for Apps Script; production confidence = **`TESTING_PLAN.md`** + disciplined manual smoke after **`clasp push`**.

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
5. **Activity / HISTORY ledger** — **Quick add** (`quick_pay`), skip, autopay, **donations**, **house expenses**, and **Upcoming** (`upcoming_add` / `upcoming_status` / `upcoming_cashflow`, with no duplicate **`quick_pay`** when posting CF from Upcoming) are logged; Activity UI supports filters, type-from-sheet, paging, and **Remove** (donation-only from the dashboard for now). **Gaps** — optional **OUT - History** correlation (Phase 5), manual Cash Flow **onEdit** logging, CSV export — soft quality for “full provenance,” not a hard ship blocker for personal use.
6. **Two surfaces** (`PlannerDashboardWeb` vs sidebar `PlannerDashboard.html`) — maintainability risk when you promise updates to others.

**Non-blockers for a serious personal tool**

- Monte Carlo, purchase sim, property performance — depth is a strength, not a launch blocker for goal A.
- Perfect charting — explicitly long-term in TODO.

---

## Recommended plan (build on 0.9)

**Phase 1 — Lock “personal production” (short)**  
- Frozen **template** spreadsheet (even if manual): “known good” copy linked from README or `PROJECT_CONTEXT.md`.  
- **First-time setup steps:** `FIRST_RUN.md` (deploy URL, timezone, smoke check).  
- Short **deploy checklist**: clasp push, deploy web app, set URL in script, smoke test Overview + **Quick add** + Bills Due + one planner run.  
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
