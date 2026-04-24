# Working Rules

## Current phase — V1.2 / controlled improvement mode (V1.1 closed out)

The V1 trust baseline is complete: blank workbooks are stable, the major missing-sheet crashes are fixed, misleading zero / fake states have been removed, the planner email is properly gated, and the bounded UI copy consistency pass has shipped. V1.1 closed with the retirement profile integration (Profile DOB → derived current age; manual age removed from Retirement; display-only UI; sheet seed cleanup; backward-compatible on populated workbooks). The project is no longer in blank-workbook stabilization mode. V1.2 rules below are identical to V1.1.

Every new change must follow these rules unless the user explicitly approves otherwise:

- **One issue at a time.** Pick the single highest-value issue, ship it, lock it, then pick the next.
- **No large refactors.** Additive, localized, minimal diffs only.
- **No architecture changes unless explicitly approved.** `doGet`, `includeHtml_`, snapshot shape, planner decomposition, and sheet/module boundaries are frozen.
- **No destructive sheet changes.** No header rewrites, no column removals, no reformatting of populated workbooks. New sheets created by helpers must stay idempotent no-ops on populated sheets.
- **Preserve existing populated-workbook behavior.** A real user workbook must render byte-for-byte the same unless the change was explicitly intended.
- **Always consider both workbook states:**
  1. **Blank / fresh workbook** — must degrade calmly with clear guidance; no red banners, no "Missing sheet (after retry+flush): …" exceptions.
  2. **Real populated workbook** — unchanged except for the intended polish; no regressions.
- **Every fix must be minimal, localized, and safe.** Prefer client-side fixes when the payload already exposes what you need (e.g. `snapshot.state`). Touch backend only when strictly necessary.
- **Favor small diffs.** Cursor / agent edits should not touch unrelated files.
- **After each implementation step, include exact manual test steps** for both the blank workbook and the populated workbook. See `TESTING_PLAN.md` → *Blank + populated two-track manual checks* for the canonical checklist.

Backlog candidates for V1.2 are tracked in `TODO.md → V1.2 work queue`, product shape in `PROJECT_CONTEXT.md → Current phase`, and ship-by-ship history in `SESSION_NOTES.md` (including the V1.1 close-out).

## HtmlService includes (`includeHtml_`)

`includeHtml_` in `html_includes.js` returns **`getRawContent()`** from `HtmlService.createTemplateFromFile(filename)` — the file is read as a **plain string** and spliced into the **parent** template. It is **not** evaluated as its own template pass.

**Implications for contributors**

- **Do not** put `<? … ?>`, `<?= … ?>`, or `<?!= … ?>` inside an included `Dashboard_*.html` fragment expecting it to run. Those tags will **not** execute; they are pasted verbatim (or break the page). Server-side logic and `includeHtml_('OtherFile')` calls belong in the **root** file Apps Script evaluates as the template (e.g. `PlannerDashboardWeb.html`).
- **Do** keep includes as static HTML, `<script>` blocks, and CSS fragments. Share data by passing values when the **parent** template runs, or use `google.script.run` from the client after load.
- **Why raw content:** Parsing included files as nested templates caused malformed HTML and duplicate-helper bugs in the past. Raw inclusion is intentional (see `PROJECT_CONTEXT.md` — resolved infra).

## Other rules

- **Help (`Dashboard_Help.html`):** When you ship or change **user-visible** dashboard behavior (new nav page, new fields, Bills Due rules, Activity log, etc.), update **Help** in the same effort: TOC link, section content, and **Sheet names** list when new tabs matter. Keep Help aligned with the app so users don’t rely on stale copy.
- **`PROJECT_CONTEXT.md` / `ONBOARDING_TODO.md`:** When you change **system overview** (major features, tab/sheet roles, Activity log rules, Cash Flow naming like Quick add vs payment, donation remove behavior), update these files in the **same change set** when practical—same idea as Help, but for **architecture** and **onboarding narrative**. If you defer, note it in **SESSION_NOTES.md** so the next pass can sync them.
- Make incremental changes only.
- Do not rewrite unrelated files.
- Preserve existing architecture unless necessary.
- Do not break existing features.
- For touched files, return full updated file contents.
- Prefer minimal diffs.
- Keep Google Apps Script compatibility.
- Do not introduce duplicate doGet().
- Do not introduce duplicate includeHtml_().
- Be careful with dashboard_data.js (core logic).

## Central App Transition Rules (apply when the Central App migration is approved)

These rules apply **only when** the Central App migration has been explicitly pulled into a roadmap phase. Until then, the work is captured in `PROJECT_CONTEXT.md → Future architecture — Central App`, `ENHANCEMENTS.md → Future direction — Central App`, and `TODO.md → Future Phases — VNext Central App Migration` and is **not active work**.

When the migration begins, every change must follow:

- **Do not refactor the entire app at once.** No single-PR rewrite that swaps every `SpreadsheetApp.getActiveSpreadsheet()` call site. The migration must be staged.
- **Migrate one module at a time.** Each pass converts a single backend module (e.g. dashboard, planner, debts, bills, retirement, activity log, bank import) to use the `getUserSpreadsheet_()` resolver. Each pass ships independently with its own manual test plan.
- **Always support the existing bound-sheet mode during transition.** Until the resolver is wired everywhere, both modes must coexist without regression:
  - existing bound-sheet users continue to work byte-for-byte unchanged,
  - new central-app users go through the bootstrap flow.
- **Test both flows on every migration pass:**
  1. **Legacy workbook (bound-sheet mode)** — the touched module still resolves the active spreadsheet correctly and behaves identically to pre-migration.
  2. **New user bootstrap flow** — a first-time user with no mapping lands on a freshly bootstrapped workbook, the touched module reads/writes against that workbook, and no admin-side or another user's data is touched.
- **No destructive sheet changes** during migration. The bootstrap path may create new sheets in a *new* user's workbook; it must never reformat or rewrite an existing populated workbook.
- Identity resolution lives in **one place** (the resolver helper). Modules must not call `Session.getEffectiveUser()` directly to look up workbooks.

## Monetization Rules (apply when feature gating is approved)

These rules apply **only when** the Monetization work has been explicitly pulled in. Until then, the plan is captured in `ENHANCEMENTS.md → Future direction — Monetization` and `TODO.md → Future Phases — VNext Monetization` and is **not active work**.

When monetization begins, every gated change must follow:

- **Never gate core functionality initially.** Cash Flow, Bills Due, Debts list, Quick Add, Activity log, planner email, and the existing dashboard surfaces stay free. Gating starts at the edges (e.g. bank import / sync, advanced planner features), not at the core.
- **Gate advanced features only.** A feature is a candidate for gating only if (a) it is meaningfully optional for the core decision flow, and (b) it has a clear paid-tier value proposition.
- **Always fail gracefully.** A failure in plan resolution (`getUserPlan_`, `isPaidUser_`, `SYS - Users` read errors, missing user record) must default to the free / unblocked path or a calm, user-visible "feature unavailable" state. **No crashes, no red banners, no exceptions surfaced to the user when plan lookup fails.**
- Plan helpers must be **defensive by design** — wrap reads in try/catch and return `'free'` on any error rather than propagating exceptions into existing free-tier flows.
- **Document each gate.** When a feature becomes gated, record the gate decision in `ENHANCEMENTS.md` (under the relevant phase) so the gating surface stays auditable.