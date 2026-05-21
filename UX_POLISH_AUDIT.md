# UX_POLISH_AUDIT.md

UI text polish audit ahead of family beta. **Analysis/documentation only.** No code, no HTML, no behavior change, no implementation. Implementation requires its own Cursor prompt with explicit user approval, one screen per pass.

Cross-references:
- `PROJECT_CONTEXT.md` — current phase + system inventory.
- `WORKING_RULES.md → Current phase` — V1.2 controlled-improvement constraints.
- `Dashboard_Help.html` — in-app help; some leaks here are intentional (developer-facing glossary).
- `ENHANCEMENTS.md` — feature backlog and shipped polish entries.

---

## 1. Purpose

CashCompass V1.2 is months from a family beta. Most user-visible text was written *for the developer*, in plain language about what the backend does — sheet names, year blocks, expense rows, Flow Source inference, machine-readable payloads. A new beta user has none of that mental model.

This audit catalogs every user-facing string that leaks developer / spreadsheet / planner-internal terminology, so a future implementation pass can rewrite each one to **describe the outcome the user cares about, not the mechanism that produces it**.

Scope is strict:

- **UI text only.** Labels, blue/info-panel helper text, mini-card titles, hover tooltips, status copy, empty-state placeholders.
- **No backend logic changes.** Validation rules, write paths, calculation order, sheet schemas all stay byte-for-byte identical.
- **No schema changes.** No new sheet, no new column, no renamed header. Existing sheet names (`INPUT - Bills`, `SYS - Accounts`, `OUT - History`, `HOUSES - {name}`, etc.) stay as-is on disk; only their appearance in user-visible *copy* is rewritten.
- **No Central App migration changes.** Resolver work continues per its own phase plan; this audit is orthogonal.
- **One screen per implementation pass.** Each rewrite is a separate Cursor prompt and a separate diff so any regression can be bisected back to a single screen.

What this document is **not**:

- Not a copy-edit pass on already-good text. The Phase 1 baseline copy pass (`SESSION_NOTES.md → V1 trust baseline → UI copy consistency pass`) covered ellipsis normalization, error-prefix removal, calm exception messages, and `No <things> yet.` empty states. That pass is finished. This document focuses on the *remaining* leaks specifically: developer terminology in user-visible surfaces.
- Not authorization for any of the listed rewrites. Each cleanup target needs its own implementation prompt.

---

## 2. Screens reviewed

Each screen was reviewed against the source HTML / templated copy. Leaks below are user-visible — they render on screen at runtime (not buried in `<!-- comments -->`, which are developer-only and intentionally untouched).

- **Dashboard Overview** (`Dashboard_Body.html → #page_overview`):
  - Snapshot grid, Suggested Actions, Operations Snapshot, Open Workspaces, Bills mini-card, Weekly net worth change, Issues.
- **House Expenses** (`Dashboard_Body.html → #houseExpenses`, `Dashboard_Script_PropertiesHouseExpenses.html`):
  - Add House Expense form + the right-side blue info panel + House Expense Summaries card.
- **Property Performance** (`Dashboard_Body.html → #propertyPerformance`, `Dashboard_Script_PropertyPerformance.html`):
  - Year selector, portfolio mini-grid, per-house table.
- **Upcoming Expenses** (`Dashboard_Body.html → #upcoming`, `Dashboard_Script_CashFlowUpcoming.html`):
  - Mini-grid (Next 7 / Next 30 / Overdue / Total Planned), Add / Edit form, `Account / Source` dropdown + Loan / Financing hint, board list.
- **Quick Add** (`Dashboard_Body.html → #payments`, `Dashboard_Script_Payments.html`):
  - Existing Payee / Type / Edit Payee, Amount, the right-side blue info panel ("Sheet / Month / Current value in cell / Existing row / Previous month").
- **Bills** (`Dashboard_Body.html → #billsDue`, `Dashboard_Script_BillsDue.html`):
  - Bills Due card, Recurring Bills (No Due Date) fallback, Add bill form, Manage bills table.
- **Debt Overview** (`Dashboard_Body.html → #debtPayoff`, `Dashboard_Script_PlanningDebtPayoff.html`) **and Debts** (`Dashboard_Body.html → #debts`):
  - Debt Overview summary, per-debt table, sort toolbar. Debts Update + Add new panels.
- **Rolling Debt Payoff** (`Dashboard_Body.html → #rollingDebtPayoff`, `Dashboard_Script_RollingDebtPayoff.html`, `RollingDebtPayoffDashboardBundle.html`):
  - Standard / Automation segment, Strategy dropdown, Raw JSON details, status row.
- **Setup / Review** (`Dashboard_Body.html → #page_onboarding`, `Dashboard_Script_Onboarding.html`):
  - Welcome card, step grid, per-step detail views (Bank Accounts, Debts, Bills, Upcoming, Income, Profile, House Values).
- **Help** (`Dashboard_Help.html`):
  - Reviewed for cross-reference accuracy only — `Dashboard_Help.html` is intentionally a developer-leaning glossary and is *out of scope* for this polish pass.

---

## 3. High-priority cleanup items

These leak developer / spreadsheet / planner-internal language directly into user-visible blue/info panels, mini-card titles, helper text, or tooltips. Highest leverage for the family beta.

### 3.1 House Expenses — right-side blue info panel (`Dashboard_Body.html:1048–1054`)

User-visible text today:
- `Selected house sheet:` (label)
- `Location preview:` (label)
- `Year from date:` (label)
- `Behavior: saves into the selected house sheet, uses the date to choose the year block, and creates the year section if missing.`
- `Cash Flow behavior: if checked, net amount = Cost + Service Fees Paid. Positive net adds as Expense, negative net adds as Income.`

Leaks: *house sheet*, *Year from date*, *year block*, *year section*, *net amount = formula*, *Positive net adds as Expense*. This is the most concentrated developer-copy bleed in the whole app — five separate leaks in one panel.

Suggested rewrite direction (not a final spec):
- `Selected house sheet` → `Property`.
- `Year from date` → `Year` (or remove — the form already shows the date).
- `Behavior:` paragraph → `When you save, this expense is added to the selected property's tracking sheet under the correct year.` (drop "year block" / "year section" mechanics; the user does not need to know rows are organized into year sections).
- `Cash Flow behavior:` paragraph → `When checked, this expense (plus any service fees) also appears on your Cash Flow. Negative amounts are recorded as income.` (drop the formula; the form already shows the inputs).

### 3.2 Bank Accounts / Investments / House Values Add panels — "Year block" leak

User-visible text today:
- Bank Accounts Add panel info box (`Dashboard_Body.html:432`): `Creates the account in the current year's Bank Accounts block. A Year block for the current calendar year must already exist.`
- Investments Add panel info box (`Dashboard_Body.html:542`): `Creates the account in the current year's Investments block. A Year block for the current calendar year must already exist.`
- House Values Add panel info box (`Dashboard_Body.html:318`): `Creates the house in the current year's House Values block and sets up a matching expense sheet with the standard expense-tracking columns.`

Leaks: *Bank Accounts block*, *Year block*, *Investments block*, *House Values block*, *matching expense sheet*, *expense-tracking columns*. The "year block" mental model is internal to how the spreadsheet stores annual history; the user only needs to know "the new account starts tracking this year".

Suggested rewrite direction:
- Drop "block" entirely. `Creates the account and starts tracking it from this year.` is enough.
- For House Values: `Creates the house and sets up a tracker for its expenses.` (drop "matching expense sheet" / "expense-tracking columns").

### 3.3 Health Score panel — `OUT - History` exposed (`Dashboard_Body.html:99`)

User-visible text today:
- `The score starts at 100 and applies deductions based on your latest planner run in **OUT - History**.`

Leaks: raw sheet name `OUT - History` rendered bold in a user-visible help panel. The user does not need to know which sheet stores planner runs.

Suggested rewrite:
- `The score starts at 100 and applies deductions based on your latest plan refresh.`

### 3.4 Overview Operations Snapshot — `INPUT Bills` and `house sheets` exposed (`Dashboard_Body.html:164–184`)

User-visible text today:
- `Cash Flow & INPUT Bills (same list as the Bills page)` (under *Bills Next 7 Days*).
- `Net total across all house sheets` (under *House Expenses This Month* and *House Expenses YTD*).

Leaks: *INPUT Bills* (raw sheet name), *house sheets* (internal data model).

Suggested rewrite:
- Drop the meta line entirely — the mini-card label ("Bills Next 7 Days", "House Expenses This Month") already says what the metric is. Or replace with `Same list as the Bills page.` / `Across all properties.`.

### 3.5 Property Performance — "HOUSES expenses" mini-card (`Dashboard_Body.html:1113`)

User-visible text today:
- Mini-card title `HOUSES expenses`.

Leaks: the all-caps `HOUSES` echoes the `HOUSES - {name}` sheet-name prefix and reads as a typo / shouting on first encounter.

Suggested rewrite:
- `Expenses (year)` (matches the existing `Rent (year)` neighbor) — drops the leak and aligns with the sibling card's tone.

### 3.6 House stop-tracking tooltip — `HOUSES sheet` exposed (`Dashboard_Body.html:278`)

User-visible text today:
- Tooltip on the **Stop tracking** button: `Mark this house inactive. History and the HOUSES sheet are preserved.`

Leak: raw sheet collection name `HOUSES sheet` in a tooltip the user actually reads.

Suggested rewrite:
- `Mark this house inactive. Existing history is kept.`

### 3.7 Quick Add right-side info panel — "Current value in cell" (`Dashboard_Body.html:588–595`)

User-visible text today:
- `Sheet:` / `Month:` / `Current value in cell:` / `Existing row:` / `Previous month (…):`.

Leaks: *Sheet*, *Current value in cell*, *Existing row* — the user is told they are editing a cell in a sheet, not "logging a payment".

Suggested rewrite:
- `Sheet:` → `Month sheet:` is *worse*; better is to drop the row entirely (the cash-flow context is implied by the page).
- `Current value in cell:` → `Currently recorded for this month:`.
- `Existing row:` → `Already on Cash Flow:` (Yes / No).

### 3.8 Rolling Debt Payoff — "Automation" segment + "Raw JSON" details

User-visible text today:
- Tooltip on **Standard** segment (`Dashboard_Body.html:1457`): `Clean decision view. Toggle Show details for audit panels.`
- Tooltip on **Automation** segment (`Dashboard_Body.html:1458`): `Plain-text machine-readable blocks (for scripts / LLMs)`.
- Details summary (`Dashboard_Body.html:1488`): `Raw JSON (export)`.
- Details lede (`Dashboard_Body.html:1490`): `Machine-readable plan payload (legacy trigger details omitted).`

Leaks: *audit panels*, *machine-readable blocks*, *for scripts / LLMs*, *plan payload*, *legacy trigger details*. Three separate developer-facing phrases inside one feature.

Suggested rewrite:
- Standard tooltip: `Recommended view for monthly decisions.`
- Automation tooltip: `Plain-text format for copying into other tools.` (drop "scripts / LLMs").
- Details summary: `Export plan as plain text.`
- Details lede: drop entirely, or replace with `Copy this to share or import elsewhere.`

### 3.9 Debts Update info panel — `Acct PCT Avail` (`Dashboard_Body.html:1205`)

User-visible text today:
- Label: `Acct PCT Avail:`.

Leak: abbreviation that reads as a column name in a power-user spreadsheet — not user copy.

Suggested rewrite:
- `Available credit (%):` or `Credit available:`.

### 3.10 Debts Add panel blue box — Flow Source inference + Active column (`Dashboard_Body.html:1235–1238`)

User-visible text today:
- `A matching expense row is also seeded on the current year's Cash Flow so the new debt shows up in Bills Due and Upcoming right away.`
- `Flow Source is inferred from Type — Credit Card pays on a card, everything else pays from cash. If an expense row for the same payee already exists it is left alone.`
- `Existing debts keep working. Stop tracking uses the Active column — rows are never deleted so history and the account name stay reserved.`

Leaks: *matching expense row is also seeded*, *Flow Source is inferred from Type*, *expense row for the same payee*, *Active column*, *rows are never deleted*. The blue box explains the storage mechanism, not the user-visible outcome.

Suggested rewrite:
- `The new debt is added to your Bills Due and Upcoming lists automatically.`
- `Payment source is set based on the debt type: credit cards pay from the card, everything else pays from cash.`
- `Stop tracking marks a debt inactive — history is kept and the account name stays reserved.`

### 3.11 Donations recent panel — "tax-year blocks" (`Dashboard_Body.html:729`)

User-visible text today:
- `Newest rows across your sheet (all tax-year blocks), same idea as recent house expenses.`

Leaks: *rows across your sheet*, *tax-year blocks*.

Suggested rewrite:
- `Your most recent donations from any tax year.`

---

## 4. Medium-priority cleanup items

These are quieter leaks. Worth fixing eventually but not blocking the family beta.

### 4.1 House Values Update info panel — `Stored value for selected month`

`Dashboard_Body.html:283` shows `Stored value for selected month:`. Mechanical but understandable. Could become `Recorded value for that month:`.

### 4.2 House Values info — `Current House Assets value`

`Dashboard_Body.html:284` shows `Current House Assets value:`. *House Assets* is the SYS sheet's collection name. Could become `Latest tracked value:`.

### 4.3 Investments Add panel helper hints

Multiple short hints (`Dashboard_Body.html:535, 538`) currently read `Enter 0 if unknown. Cannot be empty.` — fine but blunt; could soften to `If you don't know, enter 0.`

### 4.4 Bank Accounts Add panel — Use Policy explanation block

`Dashboard_Body.html:396–402` describes Use policy in four short bullets. Each starts with `<strong>Use for bills</strong> —` style. The content is good; the framing `How the planner should use this account's balance` mentions "the planner" in user copy. Could become `How CashCompass should treat this account.`

### 4.5 Property Performance — `pp_message` plumbing

The `Cash Flow sheet "INPUT - Cash Flow YYYY" not found; rent totals are $0.` message at `property_performance.js:40` surfaces a raw sheet name when the year-sheet is missing. Not exercised on the bound developer workbook today but family-beta users on partial setups will see it. Rewrite to `Cash Flow data for {year} not available yet; rent totals show as $0.`

### 4.6 Rolling Debt Payoff — `Strategy: Standard payoff` mode line

`Dashboard_Body.html:1467`. Fine, but the word "payoff" appears 3× in the same control row ("Rolling Debt Payoff" / "Standard payoff" / "Aggressive payoff"). Could compress to `Strategy: Standard.` Optional.

### 4.7 Bills Due — "What needs attention now" lede

`Dashboard_Body.html:762`: `What needs attention now — use Pay or Skip to clear items.` Already user-friendly; lede line for the panel. Could shorten to `What needs attention now.` (drop the trailing instructional clause — the buttons make their own affordance).

### 4.8 Quick Add — Create row if payee is missing

`Dashboard_Body.html:583` checkbox label: `Create row if payee is missing`. *Row* leaks the spreadsheet model. `Add payee to Cash Flow if new.` or `Create a new payee entry if needed.`

### 4.9 Setup / Review per-step detail screens

The four onboarding detail views (Bank Accounts, Debts, Bills, Upcoming) intentionally lean on the same form descriptions as the main panels, so any blue-panel cleanup in §3 propagates here automatically without a separate pass.

### 4.10 Bills Add helper hint on Notes

`Dashboard_Body.html` Bills add form has `Optional notes` placeholders that match the rest of the app — fine, but the Manage panel column header for the same field reads `Notes` with no helper. Consistent already; flagging only to note no cleanup needed.

---

## 5. Items to leave alone for now

These read like potential leaks but are either *established product language* or have a deliberate developer-facing purpose. Touching them in the polish pass risks regressing user expectations or breaking documented workflows.

### 5.1 Established product names — do not rename

- **Cash Flow** — the name of the sheet *and* the user-facing surface. Renaming would cascade into help docs, planner email subject lines, Activity log labels.
- **Bills Due / Upcoming / Quick Add / Rolling Debt Payoff / Debt Overview / Next Actions / Operations Snapshot** — all established tab / panel names referenced throughout `Dashboard_Help.html`. Stay as-is.
- **Snapshot** (as in "Operations Snapshot", "Snapshot refreshed", "Refresh Snapshot") — established product vocabulary. The user-facing meaning ("a fresh look at your current numbers") is reasonable.
- **Planner** (as in "Run Planner + Refresh Snapshot", "the planner") — established. Renaming risks orphaning planner-email language, Activity event names, Help anchors.
- **Setup / Review** — established onboarding surface name.

### 5.2 Internal diagnostic surfaces hidden by default

- **Why this cash amount? (debug disclosure)** under Next Actions — gated behind `isDebugMode()`. Not shown to family-beta users.
- **Bank Import dev tools** (`bank_import_dev_callout` / *Load sample import data (dev)*) — gated behind `BANK_IMPORT_DEV_TOOLS_ENABLED = false`. Not shown to family-beta users.
- **Bank Import CSV-paste** under Assets → Bank Accounts → Import segment — gated behind `BANK_IMPORT_CSV_PASTE_ENABLED = false`. Not shown to family-beta users by default.

These are all flag-gated and invisible to a family-beta build. Leave them.

### 5.3 Status row / loading / error copy

The V1 trust-baseline UI copy pass already normalized status row wording (`Saving…` / `Saved.` / `Couldn't load — please try again.`). Reviewing those again in this pass would re-litigate finished work.

### 5.4 Help (`Dashboard_Help.html`)

`Dashboard_Help.html` is deliberately a power-user / developer-leaning glossary that explains *how* the app stores data — `INPUT - Bills`, `LOG - Activity` event types, `Flow Source` semantics, etc. Family-beta users encounter Help only after they have built some mental model. This audit excludes Help on purpose: leaving the leaks here lets developers / power users explain themselves to the app without weakening the *primary* user-facing surfaces.

### 5.5 Sheet identifiers in friendly errors

A small set of friendly error messages mention sheet names because the user has to *fix the sheet* (Setup / Review CTAs, "Open Setup / Review" buttons, error banners that route to specific sheets). Those references are intentional and tested; leave alone.

### 5.6 Activity log event-type names

Activity event names (`quick_pay`, `bill_skip`, `bank_import_apply_balance`, etc.) are visible in the Activity tab. They are documented in Help and used by Activity filter and dedupe machinery. Rewriting them is out of scope; their display labels (`Payment recorded`, `Bill skipped`, `Applied imported balance`) are already user-friendly and unchanged.

---

## 6. Recommended first cleanup pass

**House Expenses blue-panel cleanup only.** (`Dashboard_Body.html:1048–1054`.)

Why first:

- **Single screen, single block.** Six adjacent lines of copy in one `<div class="info">`. The diff is one HTML block and zero JS changes.
- **Highest leak density in the app.** Five distinct developer-terminology leaks in one panel — see §3.1 above. No other screen has anywhere near this concentration in one place.
- **No upstream coupling.** The blue panel is descriptive copy only. None of the values it displays (`hx_sheetName`, `hx_locationPreview`, `hx_yearPreview`) require a label change — only the surrounding `<strong>…</strong>` text and the two paragraph leads (`Behavior:` and `Cash Flow behavior:`). The IDs, the form behavior, the save handler, and the helper-script bindings all stay untouched.
- **No backend code touched.** The pass is HTML-only (specifically `Dashboard_Body.html`); `house_expenses.js`, `dashboard_data.js`, `central_resolver.js`, `appsscript.json` are not touched.
- **No schema change.** No sheet rename. No column rename. The user-visible *copy* changes; the storage stays.
- **No regression risk to behavior.** Pure descriptive text. If any user notices a regression, they notice copy, not data.
- **Reusable pattern for subsequent passes.** Once the House Expenses pass lands, the same rewrite shape (drop sheet names / drop "block" / drop spreadsheet mechanics from the right-side blue panel) applies straightforwardly to Bank Accounts (§3.2), Investments (§3.2), House Values (§3.2), Debts Add (§3.10), Quick Add (§3.7), and the Overview Operations Snapshot meta lines (§3.4). Each is its own future single-screen pass.

Out of scope for this first pass:

- Property Performance mini-card label (§3.5) — different file/region.
- Health Score panel rewrite (§3.3) — different file/region.
- Rolling Debt Payoff tooltips (§3.8) — separate feature surface.
- Debts info panel `Acct PCT Avail` label (§3.9) — separate panel.
- Any §4 medium-priority item.

After the House Expenses pass ships and proves the shape, the natural follow-ups (in order of leverage) are: §3.4 (Overview meta lines, one-line copy edits), §3.6 (House stop-tracking tooltip), §3.5 (Property Performance mini-card), §3.2 (Bank Accounts blue panel), §3.2 (Investments blue panel), §3.2 (House Values blue panel), §3.3 (Health Score blue panel), §3.7 (Quick Add right-side panel), §3.10 (Debts Add blue panel), §3.8 (Rolling Debt Payoff tooltips), §3.9 (Debts `Acct PCT Avail` label), §3.11 (Donations recent meta line).

---

## 7. Guardrails (apply to every cleanup pass derived from this audit)

- **UI text only.** No JS handler change. No HTML structure change beyond the minimal `<strong>` / `<p>` / `<span>` reshuffles needed for the new copy. No new CSS class. No new id.
- **No backend logic changes.** No `house_expenses.js`, `dashboard_data.js`, `bills.js`, `debts.js`, `quick_add_payment.js`, `central_resolver.js`, `activity_log.js`, or planner-output file touched in any UI cleanup pass.
- **No schema changes.** Sheet names, column headers, value formats, and row order on disk stay identical. The *copy* changes; the *storage* does not.
- **No Central App migration changes.** The resolver migration proceeds on its own phase plan (`CENTRAL_APP_IMPLEMENTATION_PLAN.md`). UI-copy passes do not touch `central_resolver.js`, do not migrate any `SpreadsheetApp.getActiveSpreadsheet()` call site, do not modify any per-phase resolver design doc.
- **One screen per implementation pass.** Each rewrite is one Cursor prompt, one file diff (typically `Dashboard_Body.html` only), one regression run, one commit. No bundling.
- **Help is out of scope.** `Dashboard_Help.html` stays as-is. The developer-facing glossary there is intentional.
- **Status / loading / error copy is out of scope.** The V1 trust-baseline pass already normalized those.
- **No tooltip-only "fixes" without verifying the user sees them.** Tooltips on disabled / hidden controls don't count.
- **Stop-on-regression.** If a copy change causes any test in the relevant tab's regression checklist to fail (rendering broken, screen-reader pronunciation regression, mini-card layout change), revert the diff and re-plan. Do not patch in place.
- **Each cleanup pass adds its own SESSION_NOTES bullet** describing what shipped, which screen, and the leak categories removed.

---

End of document.
