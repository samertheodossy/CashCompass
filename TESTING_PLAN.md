# Automated testing plan (no code yet)

Goal: **build confidence for production-style releases** without pointing tests at your **live** financial workbook or changing how you use the app day to day.

This complements `GoingToProduction.md`: validation/onboarding reduce user error; **automated tests** reduce regression risk when you change `dashboard_data.js`, bills logic, Quick Pay, etc.

---

## Why this matters

- The app is **large and interconnected** (Cash Flow, Debts, Bills Due, planner, dashboard). A small change in one helper can break another path.
- **Manual smoke tests** after every `clasp push` do not scale if you ship to a second household or increase change frequency.
- Tests should run in **CI or locally** against **fixtures**, not against the spreadsheet where you record real money.

---

## Principle: never bind tests to the live sheet

| Risk | Mitigation |
|------|------------|
| Tests overwrite real INPUT/OUT | Use a **dedicated test spreadsheet** (copy of template), or **no spreadsheet at all** for unit tests. |
| Tests delete rows | Test code only touches sheets created for tests, or uses **rollback** (copy-once workbook, reset from copy). |
| Same script project hits prod | Optional: **separate Apps Script project** bound only to the test spreadsheet; same repo, second `.clasp.json` / deployment alias (operational choice). |

**Your daily workflow stays:** push to your real project, open real sheet, run planner. Tests are a **parallel lane**.

---

## Three layers (build in this order)

### 1. Unit tests — pure logic (highest ROI, zero sheet risk)

**What:** Functions that only take primitives/objects and return results — no `SpreadsheetApp`, no `Session`.

**Examples in this codebase (illustrative):** frequency normalization, due-date math, bill “applies this month?” rules, number parsing/rounding helpers, skip-key formats, retirement validation that is already isolated.

**How (conceptually):**  
- **Extract** or **identify** pure functions (small refactors over time; each refactor can add a test the same week).  
- Run them under a **JavaScript test runner in Node** (fast, free CI) *if* the code uses only ES features that match what you extract, **or** run tests inside Apps Script with a minimal harness (slower, closer to runtime).  
- **No live sheet**; no breakage to workflows.

**Production value:** Catches most regressions in bills/cash-flow **logic** without touching Google APIs.

---

### 2. Integration tests — fake or clone spreadsheet (controlled writes)

**What:** Functions that **must** call `SpreadsheetApp` — e.g. “given this tab layout, `quickAddPayment` writes the right cell.”

**How (conceptually):**  
- Maintain a **Test workbook** (template copy): known tabs, a few rows, **non-sensitive** numbers.  
- Script entry point: `runIntegrationTests()` (or similar) that **only runs when explicitly invoked** (menu item in test spreadsheet, or parameter guard), never on normal `doGet`.  
- Each test: **setup** (optional row/cell), **call production function**, **assert** cell value / thrown error, **teardown** reset row or restore from snapshot tab.  
- Prefer **idempotent** tests: same test twice still passes.

**Production value:** Proves wiring between UI payloads and sheets; catches renames of headers, wrong column indexes.

**Cost:** Slower, flakier if Google latency varies; worth fewer, broader tests than hundreds of unit tests.

---

### 3. Smoke / E2E — human or semi-automated checklist

**What:** “Deploy web app → open Overview → Quick Pay → Bills Due → Run Planner” — things that need HtmlService or full stack.

**How:**  
- Keep a **short checklist** in repo (could live at the end of this file later): 10–15 steps, 5 minutes.  
- Optionally **Playwright** or similar against deployed URL is possible but **heavy** for Apps Script (auth, Google login); usually **not** the first investment.

**Production value:** Confidence after releases; required for “we shipped” even when unit + integration coverage is good.

---

## Light safety net — after risky dashboard changes

Use this when you touch **`PlannerDashboardWeb.html`**, **`Dashboard_Body.html`**, **`Dashboard_Script_*.html`**, or **`html_includes.js`**. It complements automated tests (still optional); it is cheap and catches common foot-guns.

### Manual checklist (about 5 minutes after `clasp push`)

1. Open the **deployed web app** (or latest test deployment), hard-refresh.
2. **Overview** loads without console errors; snapshot numbers appear.
3. Switch **top nav** pages: **Activity**, **Bills Due**, **Cash Flow → Upcoming**, **Planning → Debts**, **Properties → House Expenses** — each panel should render (no blank white main area).
4. If you added a **new** `Dashboard_Script_*.html`, confirm it is **included from `PlannerDashboardWeb.html`** (see grep below) and that the fragment has **no** nested `<?!= … ?>` (see `WORKING_RULES.md`).

### Grep — include graph vs orphan scripts

**List every dashboard include** (canonical web app shell):

```bash
grep -n "includeHtml_('" PlannerDashboardWeb.html
```

**Find `Dashboard_Script_` files that nothing includes** (possible orphans — verify before deleting):

```bash
for f in Dashboard_Script_*.html; do
  base="${f%.html}"
  grep -rq "includeHtml_('$base')" --include='*.html' . || echo "ORPHAN? $f"
done
```

Run from the repo root. Each shipped script fragment should appear in **at least one** `includeHtml_('…')` in `PlannerDashboardWeb.html` (the root template for `doGet`).

If you use **ripgrep**, the same checks are `rg "includeHtml_\('" PlannerDashboardWeb.html` and `rg -l "includeHtml_\('$base'\)"` inside the loop.

**Sidebar / second surface:** `PlannerDashboard.html` is a separate HTML entry (spreadsheet sidebar). If you change behavior there and in the web app, compare both manually — there is no automatic sync (see `TODO.md` item 16).

---

## What *not* to do first

- Do **not** point a cloud CI job at your **personal** spreadsheet ID.  
- Do **not** require every developer to have your real workbook.  
- Do **not** block `clasp push` on a test run until layer 1 exists and is fast; introduce **optional** then **required** CI when stable.

---

## Suggested rollout (next weeks)

1. **Inventory pure functions** — 30-minute pass through `dashboard_data.js`, `quick_add_payment.js`, `planner_helpers.js`, etc.; list candidates for unit tests (frequency, dates, bill keys, parsing).  
2. **Pick one runner strategy** — Node for extracted modules *or* in-script harness; choose based on how much you want to avoid extract-vs-duplicate tension.  
3. **Add 5–10 unit tests** for the riskiest pure paths (bills frequency / `billAppliesInMonth_`-style behavior, amount sign rules).  
4. **Create Test spreadsheet + one integration test** for Quick Pay or a read-only “load dashboard data” path.  
5. **Document** in `SESSION_NOTES` or README: “Run tests X before release”; optional GitHub Action **only** if tests run without Google secrets (unit-only CI is easy; full integration CI needs encrypted service account or is manual).

---

## Is automated testing “required” for production?

- **For your household (goal A in `GoingToProduction.md`):** Strongly recommended; not legally required. A disciplined **smoke checklist** plus occasional manual runs can suffice if change volume is low.  
- **For others (goal B):** Automated tests (at least **layer 1** + a few **layer 2** checks) are **expected** before you promise updates or support; they reduce panic after a “small” fix.

---

## Relationship to Activity log / validation work

- **Workbook validation** (“scan tabs/headers”) is **not** the same as regression tests; both help production. Validation answers “is this workbook structurally valid?” Tests answer “does our code still behave as intended on valid structures?”  
- Order: you can start **unit tests** immediately; **validation** can land in parallel per onboarding plan.

**Manual smoke (Activity / house expense)** — when exercising layer 3: open **Activity**, set **from/to**, **Payee**, **Type**, amount min/max; **Apply** and confirm rows match **LOG - Activity**; confirm **Type** options reflect distinct kinds in the sheet. Sort a column; use **Previous/Next** (20 per page); if you have more than 500 matches, confirm the summary notes truncation. Save a **House Expense** with **Add to Cash Flow** and confirm **one** new ledger row (`house_expense`), not an extra `quick_pay`.

---

*This file is planning only; implementation choices (Node vs GAS runner, file layout) are intentionally left open until you start layer 1.*
