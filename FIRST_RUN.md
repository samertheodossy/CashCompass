# First run — get **CashCompass** working

Short path from **zero** to **deployed web app + working Overview**. For architecture, security detail, and long-term onboarding product work, see the linked docs at the end—this page stays **action-oriented**.

**Audience:** You or another household with a **copy of a valid workbook** (or your existing bound sheet) and this Apps Script project.

> Current phase: **V1.1 / controlled improvement mode.** The V1 trust baseline is complete — a **blank / fresh workbook is now stable end-to-end**. The dashboard, Setup / Review, Planning tabs, Assets, Cash Flow, and Activity all render calm empty states instead of `Missing sheet …` crashes, and the planner email only sends when a recipient is explicitly configured in `INPUT - Settings.Email` and the planner summary is meaningful. A known-good template copy is still the fastest path to useful numbers, but it is no longer required to avoid crashes.
>
> For first-time users starting from scratch, see **`ONBOARDING_AND_INPUT_STRATEGY.md`** — and inside the app, **Setup / Review** (top-right of the header) walks you through the five input areas the dashboard needs.

---

## 1. Prerequisites

- A **Google account** that owns or can edit the **spreadsheet** bound to this script project.
- The script project **container-bound** to that spreadsheet (typical setup: Extensions → Apps Script from the sheet).
- Optional: **[clasp](https://github.com/google/clasp)** if you deploy from this repo; otherwise use the **Apps Script editor** in the browser.
- Do **not** commit **live spreadsheet IDs**, deployment secrets, or personal URLs into a **public** git remote. Keep those in private notes or Script Properties.

---

## 2. Time zone

Server-side date logic uses the project **time zone** (see `appsscript.json` → `timeZone`, and **File → Project settings** in Apps Script). Bills Due, month columns, and “today” in scripts follow that setting.

Set it to the **household’s** primary time zone before you rely on due dates and month boundaries. If you change it later, re-check Bills Due and Cash Flow month alignment.

---

## 3. Workbook (spreadsheet)

**Recommended:** Start from a **known-good template**—a copy of a workbook that already has the tabs and column headers this codebase expects.

- When you have a canonical copy, record its link in **`PROJECT_CONTEXT.md`** (section **First-time setup**) or in a private note—**not** in public repos unless you are comfortable exposing that URL.
- **Advanced:** Using an existing workbook that was **not** built from your template still works for the initial open — the V1 trust baseline makes the dashboard render calmly even when most sheets are missing. You will see empty states and CTAs to **Setup / Review** rather than crashes. To get meaningful numbers, tab names and headers eventually need to match what the scripts assume; high-level areas are listed in **`PROJECT_CONTEXT.md`** (INPUT / SYS / HOUSES / Cash Flow years, OUT tabs, etc.). A future **validation scan** (see **`GoingToProduction.md`**) will make gaps obvious.

---

## 4. Put code in Apps Script

- **With clasp:** From this repo, `clasp push` to the project bound to your spreadsheet (see your `.clasp.json` and Google’s clasp docs).
- **Without clasp:** Copy or merge files into the Apps Script project attached to the sheet (error-prone for large projects—clasp is preferred for this repo).

After a push, refresh the Apps Script editor and fix any **syntax errors** before deploying.

---

## 5. Deploy the web app

1. In **Apps Script**: **Deploy → New deployment**.
2. Type: **Web app**.
3. **Execute as:** **Me** (maps to `USER_DEPLOYING` — the account that publishes runs server code against the bound sheet).
4. **Who has access:** Start with **Only myself** (maps to `MYSELF`) unless you have read **`SECURITY.md`** and intentionally chose a wider audience—broader access effectively widens who can trigger **full spreadsheet access** as the deploying user.
5. Deploy and copy the **Web app URL**. It should look like  
   `https://script.google.com/macros/s/…/exec`

Defaults in **`appsscript.json`** should match the above; the deployment dialog can override them—**confirm both match intent** after each new deployment.

**Full security implications:** **`SECURITY.md`**.

---

## 6. Save the URL for the sheet menu (optional but convenient)

The project includes helpers in **`webapp.js`** so the spreadsheet can open the dashboard:

- In the spreadsheet, open the **Debt Planner** menu (`onOpen` in `code.js`) → **Set CashCompass Web App URL**, then **paste the `/exec` URL** once. That stores `PLANNER_DASHBOARD_WEBAPP_URL` in Script Properties for **Open CashCompass Web**.

If that property is not set, **Open CashCompass Web** will error until you save the URL—opening the deployment link **directly in the browser** always works.

---

## 7. First open and smoke check

1. Open the **Web app URL** in a browser (same Google account as **Only myself**, if applicable).
2. Approve **spreadsheet access** if Google prompts you.
3. Confirm **Overview** loads without a red error banner. On a blank / fresh workbook you will see calm empty states and a visible **Setup / Review** entry in the header — that is expected.
4. Click through a few **top-nav** areas (e.g. **Activity**, **Cash Flow → Bills**, **Cash Flow → Quick add**, **Planning → Next Actions**) to ensure panels render. Blank workbooks should degrade to `No <things> yet.` / `Add your <things> in Setup / Review …`, never to a red exception.
5. Open **Setup / Review** from the header — Welcome renders for a completely empty workbook, the status grid renders as soon as any input area has data.

A slightly longer **manual checklist** after risky changes lives in **`TESTING_PLAN.md`** → **Blank + populated two-track manual checks** (canonical) and **Light safety net** (legacy).

---

## 8. Do not (common breakages)

- **Do not rename** core tabs the code expects (examples: **`INPUT - Cash Flow`**, **`INPUT - Debts`**, **`INPUT - Bills`**, **`SYS - House Assets`**, **`OUT - History`**, **`HOUSES - …`**, **`LOG - Activity`**) or their **header row** labels unless you know the code was updated to match.
- **Do not** widen web app access to **Anyone** / **Anyone with Google account** without reading **`SECURITY.md`** and accepting the privacy tradeoff.
- **Do not** treat **`PlannerDashboard.html`** (sidebar HTML) and **`PlannerDashboardWeb.html`** (main web app) as automatically in sync—see **`TODO.md`** (two dashboards) if you change both.

---

## 9. Where to go next

| Need | Doc |
|------|-----|
| In-app explanations | Open **Help** in the web dashboard (`Dashboard_Help.html`) |
| Architecture & tabs | **`PROJECT_CONTEXT.md`** |
| Security & deployment posture | **`SECURITY.md`** |
| Smoke / future automated tests | **`TESTING_PLAN.md`** |
| Roadmap & “1.0” framing | **`GoingToProduction.md`**, **`TODO.md`** |
| Future wizard / full onboarding | **`ONBOARDING_TODO.md`** (long-term; not required for your first run) |
| HtmlService includes / contributor rules | **`WORKING_RULES.md`** |

---

*This file does not change app behavior; it is documentation only.*
