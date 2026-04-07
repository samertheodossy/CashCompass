# Working Rules

## HtmlService includes (`includeHtml_`)

`includeHtml_` in `html_includes.js` returns **`getRawContent()`** from `HtmlService.createTemplateFromFile(filename)` — the file is read as a **plain string** and spliced into the **parent** template. It is **not** evaluated as its own template pass.

**Implications for contributors**

- **Do not** put `<? … ?>`, `<?= … ?>`, or `<?!= … ?>` inside an included `Dashboard_*.html` fragment expecting it to run. Those tags will **not** execute; they are pasted verbatim (or break the page). Server-side logic and `includeHtml_('OtherFile')` calls belong in the **root** file Apps Script evaluates as the template (e.g. `PlannerDashboardWeb.html`).
- **Do** keep includes as static HTML, `<script>` blocks, and CSS fragments. Share data by passing values when the **parent** template runs, or use `google.script.run` from the client after load.
- **Why raw content:** Parsing included files as nested templates caused malformed HTML and duplicate-helper bugs in the past. Raw inclusion is intentional (see `PROJECT_CONTEXT.md` — resolved infra).

## Other rules

- **Help (`Dashboard_Help.html`):** When you ship or change **user-visible** dashboard behavior (new nav page, new fields, Bills Due rules, Activity log, etc.), update **Help** in the same effort: TOC link, section content, and **Sheet names** list when new tabs matter. Keep Help aligned with the app so users don’t rely on stale copy.
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