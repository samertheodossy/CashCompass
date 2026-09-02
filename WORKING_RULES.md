# Working Rules

## Current phase — Central App live + Family Beta readiness

The Central App architecture is **live** and **family-beta capable**. Recovery Validation 6F is complete: the full P0 matrix passed, all recovery flags are OFF, and the disposable fixture gate was removed. Read-only orphan detection remains P1. Bound safety and all commit/push/deploy approval rules below remain unchanged.

**Flag discipline (recovery stack):** the three recovery flags default OFF and **fail closed**. Do not turn any of them on except for a deliberate, scoped validation pass on a **disposable** account, and **set them back OFF** afterward. Never enable a recovery flag against the production / bound workbook.

**Immutable administrator rule:** `samertheodossy@gmail.com` is the sole CashCompass administrator. `cashcompass2026@gmail.com` is a non-admin disposable test identity. Never edit `ADMIN_EMAILS`, alter its fallback, or temporarily elevate a test/beta/project-owner account for validation. An admin-only test must run while authenticated as the sole administrator; otherwise it stops fail-closed.

**Unified-source rule:** deployment pinning is a temporary rollout/rollback tool, not the long-term compatibility model. Central and bounded deployments must be able to converge on the same reviewed source. The projects keep separate properties: Central requires `CENTRAL_MODE=true`; a bound project requires `CENTRAL_MODE` absent/false and test/recovery flags OFF. Before a unified-source deployment, prove that normal no-argument calls still resolve the existing bounded workbook exactly as before and that all test writers remain unreachable from normal runtime and refuse active, mapped, Golden, and configured-default workbooks.

**One-design rule:** CashCompass has one customer product design. Central and bounded must render the same pages, contextual sections, navigation, controls, terminology, and workflows from the same reviewed source. Differences in deployment, credentials, storage, or authentication are permitted only as invisible environment plumbing and may not create separate customer experiences. A proposed solution that sends one environment to a separate page, changes its navigation model, or otherwise forks the user journey is a material design decision and must stop for explicit owner approval before implementation.

The change discipline below (carried from V1.2) still governs **every** edit. For Central App work, the **`## Central App Transition Rules`** section is now the **active** governing policy (it is no longer conditional / future).

**No repeated permission rule:** Codex must not ask for approval to inspect, edit, test, self-review, or otherwise complete ordinary in-scope repository work. If the user has already authorized an action in the current task—including disposable validation after the owner has pushed Central when needed, commit, or push—execute it without asking again. Stop only for a genuinely new product decision or an authorization boundary that the user has not already crossed. A tool permission dialog is not a reason to leave the task waiting when the action is already user-authorized and covered by an approved command scope. **Clasp push/deploy is never in this set** — see Apps Script hard stop below.

Every new change must follow these rules unless the user explicitly approves otherwise:

- **One issue at a time.** Pick the single highest-value issue, ship it, lock it, then pick the next.
- **Close the coherent product rule, not only the reported symptom.** Before implementation, translate the example into its general user-facing rule and audit equivalent workflows, mutable field types, authoritative/linked sheet copies, add/edit/rename/reactivate/ordinary-save paths, blank and populated workbooks, and performance consequences. Challenge an incomplete requested scope and state any intentionally excluded cases with reasons. Keep one numbered roadmap item as the delivery boundary, but finish its justified adjacent cases and regression matrix in the same change set so the team does not churn through avoidable symptom-sized follow-ups.
- **Keep the user workflow simple.** One user intent should have one obvious action. Do not expose internal coordination, linked-reference maintenance, audit logging, or safety mechanics as extra buttons or sequential steps when CashCompass can perform them safely behind one action. Challenge designs that make the user understand implementation boundaries; prefer the fewest clear decisions and clicks consistent with financial safety.
- **Keep CashCompass UI uniform.** Before changing a web surface, inventory equivalent CashCompass surfaces and reuse their established component, placement, wording, interaction, responsive, focus, and state patterns. Any divergence needs a documented product reason and a regression that protects the intended shared rule; see `ENGINEERING_STANDARDS.md → §5.1`.
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
- **Regression-First Development.** Every significant change must leave the project with **equal or greater** regression coverage; coverage is never intentionally reduced. Consider whether new regression scenarios are required (bug fix / feature / architecture / schema / dashboard / financial-calculation change) and run the **Regression Discovery** checklist. See `ENGINEERING_STANDARDS.md → §12` (principle), `REGRESSION_SUITE_PLAN.md → Regression Discovery Policy + §A` (how).
- **Milestone commit checkpoint.** Finish exactly one numbered roadmap item, run its focused regressions plus the full local suite, reconcile blank/fresh and representative-populated behavior, and summarize the scoped diff and runtime evidence. Then **stop** with the working tree unstaged and ask the user to approve commit/push. Do not begin implementation of the next numbered item until that checkpoint is approved and the prior item is committed and pushed. Planning or recording later work is allowed, but its runtime implementation must not overlap the active item.
- **Detailed commit records are mandatory.** Every meaningful commit must use a concise, specific subject followed by a concrete body; a subject-only one-line commit is not acceptable. The body must record why the change was needed, the important behavior/components changed, Central-versus-bounded safety and compatibility, tests and runtime evidence, and deployment/migration/rollback impact when applicable. Documentation-only commits must still state their scope and confirm that runtime behavior, workbooks, and deployments were unaffected. Follow `COMMIT_RULES.md → Commit message format` at every approved Git checkpoint.
- **Apps Script push and deployment hard stop.** Codex must never run `clasp push`, `clasp deploy`, `clasp undeploy`, `./push-central.sh`, or any other source/deployment mutation against **either** the Central or bounded Apps Script project. This restriction is permanent and is not lifted by general push/deployment approval or task wording such as “test in Central.” The owner alone performs every Central push, Central deployment, bounded push, bounded deployment, and bounded visual check. Codex prepares and locally validates source, then gives the owner the exact clasp step (for example `./push-central.sh` for Central). Codex must also never run a Harness writer against the bounded or mapped-user workbook or use that workbook for automated mutation testing. Automated writers may target only their own continuously re-verified marked disposable workbook.
- **Standing isolated-Central validation authorization (approved 2026-07-27; clasp remains owner-only).** After the active numbered item's focused and full local regressions pass, Codex may run the item's guarded disposable-workbook/read-only runtime checks against the isolated validation deployment without asking again, **but only after the owner has pushed Central source and advanced the isolated deployment.** This standing authorization never includes `clasp push`, `clasp deploy`, `./push-central.sh`, Central Beta, the bounded Apps Script project, the bounded/mapped-user workbook, Golden/configured-default workbooks, Git staging/commit/push, schema migration, or unrelated deployment changes. Report the exact isolated version and runtime evidence at the milestone checkpoint.
- **Central clasp targeting (owner operations).** When the owner pushes or deploys Central, every `clasp version`, `clasp deploy`, and `clasp deployments` command must include `--project .clasp-central.json`; never rely on the repository-default `.clasp.json`. Before an isolated deploy, inventory Central with that explicit project argument and resolve the exact isolated deployment ID.
- **Deployment URLs are singletons, not release artifacts.** Routine bounded releases must update the one production deployment ID recorded in `TESTING_URLS.md`; never create a new bounded deployment URL for each version. Central likewise retains only HEAD, the isolated-validation ID, and the explicitly pinned Beta ID. Re-inventory both projects after every approved deployment and remove a superseded endpoint only with explicit authorization. This prevents bookmarks or open tabs from continuing to execute obsolete financial-write code.
- **Regression handoff evidence.** Before requesting the milestone commit, report: touched files, intended behavior, regression coverage added or reused for the exact failure, focused/full test results, isolated runtime evidence when approved, workbook cleanup, deployment versions, and confirmation that Beta and bounded targets were untouched. Any failed or missing gate keeps the item open.
- **Bounded impact assessment at every checkpoint.** Before requesting commit/push approval, explicitly report whether the item changes (a) workbook formulas or calculated cells, (b) financial/business rules or displayed interpretations, (c) workbook schema, provisioning, migrations, or formatting, and (d) any production write path. Classify pre-commit bounded validation as **Required**, **Recommended**, or **Not needed**, explain why, and provide the smallest exact bounded checks with expected results. Codex never performs the bounded deployment or bounded validation; the user does both. A Required bounded check must pass before commit. A Recommended check may be waived only by the user. If no bounded check is needed, permanent unified-source/bounded-safety regressions must still be identified.

The forward plan is `TODO.md → Launch Readiness Roadmap`; small-polish picks are in `TODO.md → V1.2 polish backlog`; product shape is in `PROJECT_CONTEXT.md → Current phase`; ship-by-ship history is in `SESSION_NOTES.md`.

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

## Central App Transition Rules (ACTIVE — the migration is live)

These rules are **active**. The Central App migration has landed (live resolver + provisioning + mapping; see `PROJECT_CONTEXT.md → Current architecture — Central App (live)`). The remaining tail — Tier 2 full-dashboard `getActiveSpreadsheet()` migration and the hardening items in `TODO.md → Launch Readiness Roadmap` (Phase 2 — Family Beta Hardening; Phase 6 — External Beta Readiness) — must continue to follow this discipline.

Every Central App change must follow:

- **Do not refactor the entire app at once.** No single-PR rewrite that swaps every `SpreadsheetApp.getActiveSpreadsheet()` call site. The migration must be staged.
- **Migrate one module at a time.** Each pass converts a single backend module (e.g. dashboard, planner, debts, bills, retirement, activity log, bank import) to use the `getUserSpreadsheet_()` resolver. Each pass ships independently with its own manual test plan.
- **Always support the existing bound-sheet mode during transition.** Until the resolver is wired everywhere, both modes must coexist without regression:
  - existing bound-sheet users continue to work byte-for-byte unchanged,
  - new central-app users go through the bootstrap flow.
- **Converge the source, separate the context.** Do not preserve bounded safety by leaving it indefinitely on old code. Shared production functions keep their normal no-argument resolver behavior; test-only explicit-spreadsheet seams are additive, guarded, and never runtime-wired.
- **Test both flows on every migration pass:**
  1. **Legacy workbook (bound-sheet mode)** — the touched module still resolves the active spreadsheet correctly and behaves identically to pre-migration.
  2. **New user bootstrap flow** — a first-time user with no mapping lands on a freshly bootstrapped workbook, the touched module reads/writes against that workbook, and no admin-side or another user's data is touched.
- **No destructive sheet changes** during migration. The bootstrap path may create new sheets in a *new* user's workbook; it must never reformat or rewrite an existing populated workbook.
- Identity resolution lives in **one place** (the resolver helper). Modules must not call `Session.getEffectiveUser()` directly to look up workbooks.

## Monetization Rules (apply when feature gating is approved)

These rules apply **only when** the Monetization work has been explicitly pulled in (scheduled as **Phase 7 — Paid Product Readiness**). Until then, the plan is captured in `ENHANCEMENTS.md → Future direction — Monetization` and `TODO.md → Monetization (future)` and is **not active work**.

When monetization begins, every gated change must follow:

- **Never gate core functionality initially.** Cash Flow, Bills Due, Debts list, Quick Add, Activity log, planner email, and the existing dashboard surfaces stay free. Gating starts at the edges (e.g. bank import / sync, advanced planner features), not at the core.
- **Gate advanced features only.** A feature is a candidate for gating only if (a) it is meaningfully optional for the core decision flow, and (b) it has a clear paid-tier value proposition.
- **Always fail gracefully.** A failure in plan resolution (`getUserPlan_`, `isPaidUser_`, `SYS - Users` read errors, missing user record) must default to the free / unblocked path or a calm, user-visible "feature unavailable" state. **No crashes, no red banners, no exceptions surfaced to the user when plan lookup fails.**
- Plan helpers must be **defensive by design** — wrap reads in try/catch and return `'free'` on any error rather than propagating exceptions into existing free-tier flows.
- **Document each gate.** When a feature becomes gated, record the gate decision in `ENHANCEMENTS.md` (under the relevant phase) so the gating surface stays auditable.
