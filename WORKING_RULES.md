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