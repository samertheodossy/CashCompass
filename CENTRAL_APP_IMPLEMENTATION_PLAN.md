# CENTRAL_APP_IMPLEMENTATION_PLAN.md

First safe implementation sequence for the Central App migration.

This document converts the existing Central App architecture documents into a staged implementation roadmap. It is **planning only**. No Apps Script code, no HTML/JS, no deployment changes, no implementation. This document **does not by itself authorize implementation**. Any actual code change requires its own Cursor implementation prompt with explicit user approval, per the gate in §9.

Cross-references:
- `CENTRAL_APP_DESIGN.md` — migration architecture, abstraction point, guardrails, operational mindset.
- `CENTRAL_APP_DEPLOYMENT_OPTIONS.md` — preferred direction: centralized code + user-owned spreadsheets + `executeAs: USER_ACCESSING`.
- `CENTRAL_APP_ONBOARDING_AND_LIFECYCLE.md` — user lifecycle contract, bootstrap and recovery semantics, backward-compatibility callout.
- `WORKING_RULES.md → Central App Transition Rules / Monetization Rules` — migration discipline.

---

## 1. Purpose

This plan converts the architecture documents into a staged implementation roadmap. It exists so that, when the Central App migration is eventually pulled into an active phase, the very first code change is small, safe, and reversible — and every subsequent change extends a known-good foundation rather than improvising one.

It is **planning only**:

- No section of this document authorizes coding work.
- Each implementation seam still requires its own Cursor implementation prompt (per §9) before any code is touched.
- All architectural decisions still bind. Any open question marked Decision Pending in the design docs remains Decision Pending here; this plan does not resolve them by sequencing them.

Out of scope:

- Architectural decisions already resolved in the design docs (deployment direction, ownership model, additive-upgrade contract).
- Specific code file names, function signatures, or test harness implementations — those belong to the implementation prompts that come later.
- Monetization, billing, or feature gating — explicitly out of the first implementation phase (see §7).

In scope:

- Identifying the smallest first abstraction seam (the resolver).
- Defining a minimum viable centralization phase.
- Proposing a cautious migration order across modules.
- Pinning the regression-testing posture for every step.
- Listing non-goals explicitly so the first phase stays narrow.

---

## 2. Primary principle

Two statements, taken directly from the architecture docs, govern everything below.

- **Centralization is an infrastructure migration, not a product rewrite.** The Central App migration changes who runs the code and which spreadsheet the code runs against. It does not change what the code does. Mirror of `CENTRAL_APP_DESIGN.md → §6 Migration philosophy`.
- **Continuity first, migration second.** Migrating the architecture is valuable. Keeping the app working for existing users is more valuable. When the two pull against each other, continuity wins. Mirror of `CENTRAL_APP_DESIGN.md → §11 Operational mindset`.

Every decision in this plan is checked against these two statements. A proposed step that fails either check is rejected, regardless of how convenient it would be otherwise.

---

## 3. First safe abstraction seam

### Where spreadsheet access is currently assumed

Today, every backend module assumes the active spreadsheet:

- Module entry points call `SpreadsheetApp.getActiveSpreadsheet()` directly (often into a local `ss` variable).
- Downstream helpers (`getSheet_`, header lookups, ensure-\* helpers, write paths) accept that `ss` and operate against it.
- The web app's `doGet`, the planner trigger, and time-driven triggers all run bound to the same active spreadsheet.

This is the implicit contract that the Central App migration must replace **without breaking**.

### The future seam, conceptually

The seam is a single resolver — a one-line replacement at the top of each module. Conceptual shape only, no implementation:

> *Where today a module begins by obtaining the spreadsheet via the active-spreadsheet API, the migrated version begins by obtaining it from the resolver. The remainder of the module is byte-for-byte unchanged.*

- **Current bound mode** uses the active spreadsheet via `SpreadsheetApp.getActiveSpreadsheet()`.
- **Future central mode** resolves the user's spreadsheet by identity → mapping → spreadsheet ID → opened spreadsheet handle.
- **Existing module behavior remains unchanged underneath.** Every helper, every header lookup, every ensure-\* call, every write path operates exactly as it does today against the spreadsheet handle the resolver returns.

### Properties the seam must have on day one

- **Backward-compatible default.** In its first incarnation, the resolver simply wraps `SpreadsheetApp.getActiveSpreadsheet()`. It introduces the abstraction without changing behavior.
- **Single point of replacement.** Modules call the resolver and only the resolver. No module independently inspects the user's identity or looks up a spreadsheet ID.
- **Reversible.** Removing the resolver call and restoring the active-spreadsheet call must produce the previous working state byte-for-byte. The seam is reversible by construction.

The first implementation work, when authorized, lives entirely inside this seam.

---

## 4. Minimum viable centralization phase

The smallest unit of future work that produces a real foundation without changing behavior.

### What the minimum viable phase includes

- **Introduce a resolver abstraction** (conceptual, no code in this document). The resolver is a single helper that returns the spreadsheet handle a module should operate against.
- **Support bound mode first.** The resolver's only implementation in this phase is the bound-mode path — return the active spreadsheet. Central mode is not implemented in the minimum viable phase.
- **Do not change module logic.** No backend module changes behavior. The migration of a module is limited to swapping its spreadsheet-obtaining call with a resolver call.
- **Do not change deployment mode yet.** The deployment remains `executeAs: USER_DEPLOYING`, `access: MYSELF` (per `CENTRAL_APP_DEPLOYMENT_OPTIONS.md → §7`). No deployment setting is touched.
- **Do not introduce monetization yet.** No `SYS - Users`, no `getUserPlan_`, no gating helpers, no plan-lookup plumbing. Monetization is explicitly out of the minimum viable phase (per §7).

### What the minimum viable phase produces

- A working app, byte-for-byte identical to today's behavior from the user's perspective.
- A single resolver helper in place across one (or a few) modules — enough to validate the seam without committing to a full sweep.
- A foundation that the next phase (central-mode implementation, then bootstrap, then onboarding, then monetization) extends one step at a time.

### What the minimum viable phase explicitly does not produce

- It does **not** produce a centralized deployment. The deployment stays bound.
- It does **not** produce a user-owned spreadsheet bootstrap. The bootstrap path is a later phase.
- It does **not** produce a `getUserSpreadsheet_()` that knows how to map identities to spreadsheets. The first resolver knows only the bound-mode case.

This is intentional. The first phase establishes the shape of the abstraction; later phases fill it in.

---

## 5. Migration order

Cautious ordering. Each step in the list is a separate future implementation pass with its own Cursor prompt and its own regression-testing pass. **The order is a proposal; it can be re-sequenced when each step is actually planned.**

1. **Resolver abstraction.** Introduce the resolver in bound-mode-only form. Apply it to one or two low-risk module entry points (likely the dashboard snapshot read path, since it is high-traffic but read-only). Validate that the app's behavior is byte-for-byte unchanged. **(Phase 1 — shipped in `b2798a7`.)** Helper `getUserSpreadsheet_()` lives in the new `central_resolver.js` file as a one-line pass-through to `SpreadsheetApp.getActiveSpreadsheet()`. First migrated call site is `getCashToUse()` in `cash_to_use.js:77` (read-only, single call site, hardened with `state` field — see `CENTRAL_APP_FIRST_RESOLVER_SEAM.md → §6`). Smoke test against the bound workbook passed; the dashboard Bills "Recurring Bills (No Due Date)" empty-state concern raised during testing was investigated separately and found unrelated to the seam. No deployment change, no `PropertiesService`, no `openById`, no user mapping. **(Phase 2 — shipped in `1b68c71`.)** Read-only Cash Flow → Quick Add hydration entry `getQuickAddPaymentUiData()` in `quick_add_payment.js:35` migrated under the same invariants. Single line, single file. Write entries at lines 185 and 248 of the same file remain unchanged (deferred to §5 step 4). Smoke test passed; cross-module behavior proved. See `CENTRAL_APP_SECOND_RESOLVER_SEAM.md`. **(Phase 3 — shipped in `72d82b1`.)** Read-only Debt Overview entry `getDebtPayoffReadData()` in `debt_payoff_projection.js:17` migrated. This phase produced the project's **first fully resolver-routed production module** — `debt_payoff_projection.js` had exactly one production `SpreadsheetApp.getActiveSpreadsheet()` call site, so the file is now completely behind the seam. Uniform `ss` flow downstream (every helper consumes `ss` explicitly). Smoke test passed; Phase 1 and Phase 2 invariants both preserved. See `CENTRAL_APP_THIRD_RESOLVER_SEAM.md`. **After Phase 3: 3 production call sites migrated / 132 remaining across 26 modules, all intentionally unchanged. Resolver body is still the one-line pass-through. No deployment change, no `PropertiesService`, no `openById`, no identity helper, no user mapping.**
2. **Bootstrap and ensure-\* paths.** Route the existing ensure-\* helpers (`ensureOnboardingBankAccountsSheetFromDashboard`, `ensureOnboardingBillsSheetFromDashboard`, `ensureOnboardingDebtsSheetFromDashboard`, `ensureSysAccountsSheet_`, etc.) through the resolver. No new bootstrap behavior — only re-route the existing additive helpers through the abstraction. Bound mode continues to use the active spreadsheet under the hood.
3. **Read-only dashboard paths.** Migrate the remaining dashboard read paths (Overview snapshot, Bills Due, Cash Flow read, Debts read, Retirement read, Activity log read, Donations read) to the resolver. One module per pass; each pass ships independently with its own regression suite.
4. **Low-risk write paths.** Migrate Quick Add Payment, Donations save, Income save, Profile save, Upcoming Expenses add/edit/dismiss, House Values save, and similar contained write surfaces. Each pass migrates a single module; behavior is unchanged.
5. **Higher-risk write paths.** Migrate the planner trigger, Bills add/edit/stop-tracking, Debts add/update, Retirement save, Property Performance, Investments save, and the rolling debt payoff write surfaces. These are higher-risk because they have downstream effects (planner email, snapshot regeneration, Cash Flow writes). Each pass is preceded by an explicit regression plan.
6. **Bank Import pipeline.** Migrate the existing Bank Import staging / review / apply pipeline through the resolver. The pipeline is large but well-isolated; treat it as a single migration pass.
7. **Onboarding and first-run.** Implement the user-side onboarding lifecycle defined in `CENTRAL_APP_ONBOARDING_AND_LIFECYCLE.md`. At this point the resolver gains its central-mode implementation; bootstrap creates user-owned spreadsheets; mapping is stored. **This is the first phase where the deployment posture genuinely changes** and requires the most careful regression testing.
8. **Monetization / feature gating.** Implement `SYS - Users` schema, `getUserPlan_`, `isPaidUser_`, and the first gated feature (Bank Import per `ENHANCEMENTS.md → Future direction — Monetization`). Strictly after all of the above are stable. Per `WORKING_RULES.md → Monetization Rules`: gating per-copy installs is not enforceable, so this step cannot start until Central App mode is the canonical mode.

### Sequencing rationale

- Read paths before write paths — a broken read regresses to a `state` field and a calm empty UI; a broken write can corrupt data.
- Low-risk writes before high-risk writes — Quick Add against one cell is a smaller blast radius than the planner regenerating multiple sheets.
- Bank Import after the rest because it is the largest single subsystem and the first gating candidate; migrating it last lets gating land on a known-stable surface.
- Onboarding migrates *after* most modules already use the resolver. By that point, swapping the resolver's bound-mode default for central-mode is a small change at the seam, not a sweep across the app.

---

## 6. Regression testing strategy

Every implementation step in §5 — every single one — runs the regression suite below before and after the change. The "before" run establishes the baseline that the "after" run must match.

### Tests required around every implementation step

- **Existing dashboard loads.** Overview, Bills Due, Cash Flow tabs, Planning tabs, Assets tabs, Activity tab. Each tab loads, renders without red banners, and shows the same values as today.
- **Setup / Review still works.** The Setup / Review surface opens, walks through the five input areas, and returns to the dashboard without writing to any sheet (it is read-only by contract).
- **Blank-workbook bootstrap.** A first-run user (or a wiped reference workbook) opens the app, hits an Add new flow (Bank Accounts, Debts, or Bills), and the corresponding ensure-\* helper creates the canonical sheet without throwing.
- **Existing workbook with populated data.** A real, populated workbook loads, all calculations match prior values, all activity log entries are visible, planner email reflects the same recipients.
- **Cash Flow writes.** Quick Add Payment to a current-month cell writes the value, updates the activity log with a `quick_pay` entry, and shows the expected status banner ("Payment recorded — <Month-YY> cash flow updated").
- **Bills / Debts / Assets / Property / Retirement modules.** Add, edit, and stop-tracking flows in each module work end-to-end against the reference workbook.
- **Bank Import existing pipeline.** Stage → review → link → apply → ignore flow completes without regression against a known-good import set.
- **Bound mode remains functional.** This is the canonical regression. After the change, an existing bound-sheet user opening their own workbook sees identical behavior to before the change.

### Regression posture

- **Both before and after.** Every test is run before the change to capture the baseline and run again after the change to confirm match. A test that was flaky before is fixed in its own pass, not silently shifted in this one.
- **Two-track regression.** Per `TESTING_PLAN.md`, every pass runs the blank-workbook track and the populated-workbook track. The Central App migration does not relax this rule.
- **Stop on first regression.** If any of the tests fail against the changed app, the migration pass is reverted and re-planned. The pass is not patched to "fix" the regression as part of the same change; the change set is kept tight.

---

## 7. Explicit non-goals

The first implementation phase (and the resolver-introduction step in particular) **must not**:

- **Rewrite dashboards.** No tab is rewritten, no panel is restructured, no React surface is re-rendered. UI changes belong to their own product decisions.
- **Rewrite business logic.** Planner calculations, Bills Due logic, Cash Flow normalization, payee matching, debt amortization — none of these are touched in the first phase.
- **Change sheet schemas destructively.** No column rename, no sheet rename, no row reorder. Schemas continue to evolve only through additive ensure-\* helpers, per `CENTRAL_APP_DESIGN.md → §5`.
- **Add billing.** No payment provider integration, no plan checkout, no upgrade prompts. Billing is post-monetization-phase work.
- **Add feature flags beyond what already exists.** The current dashboard already uses small UI flags (e.g. `BANK_IMPORT_DEV_TOOLS_ENABLED`, `BANK_IMPORT_CSV_PASTE_ENABLED`). The first phase does not introduce a new feature-flag framework or runtime configuration surface.
- **Change deployment settings.** The deployment stays `executeAs: USER_DEPLOYING`, `access: MYSELF` throughout the first phase. Deployment changes are reserved for the onboarding phase (step 7 in §5) and require their own product decision.
- **Remove bound mode.** Bound mode stays the default behavior of the resolver in every phase prior to step 7. Even after step 7, bound mode is not removed until central mode is exercised against real workflows long enough to trust.

If a proposed implementation step would do any of the above, the step is out of scope for the first phase and is deferred.

---

## 8. Decision Pending items

The items below are still open and must be resolved (in writing) before the corresponding implementation step is run. This is a sequencing-level checklist; the deeper Decision Pending lists live in `CENTRAL_APP_DESIGN.md → §10`, `CENTRAL_APP_DEPLOYMENT_OPTIONS.md → §8`, and `CENTRAL_APP_ONBOARDING_AND_LIFECYCLE.md → §11`.

### Exact resolver name and signature — Resolved (Phase 1)
- Resolver is named **`getUserSpreadsheet_()`** in `central_resolver.js`. Returns a bare `Spreadsheet` handle (not a wrapper struct). Nullary signature — no parameters in Phase 1.
- A future test-mode override (optional argument) is still possible but is intentionally deferred until a phase needs it. Phase 1's invariant is that the resolver is a one-line pass-through to `SpreadsheetApp.getActiveSpreadsheet()` with no parameters and no behavior beyond that.

### Mapping storage — Decision Pending
- `PropertiesService.getUserProperties()` vs central registry sheet (`SYS - User Workbooks`). Likely first approach is `UserProperties` per `CENTRAL_APP_DESIGN.md → §4`. The final choice gates the resolver's central-mode implementation (step 7 in §5).

### First central-mode test harness — Decision Pending
- How central mode is exercised during development without a real deployment change. Options: a dev-only flag inside the resolver, a separate non-production deployment URL, a parameterized resolver that accepts a target spreadsheet ID during tests. **Decision Pending.**

### Onboarding UI — Decision Pending
- The exact first-run UI (consent → bootstrap → Setup / Review handoff) is **Decision Pending** per `CENTRAL_APP_ONBOARDING_AND_LIFECYCLE.md → §11`. The UI design must be settled before step 7 in §5 is planned.

### Workbook version marker — Decision Pending
- Location (script property vs SYS sheet vs named range), starting value, minimum-required-version contract. Per `CENTRAL_APP_DESIGN.md → §10` and `CENTRAL_APP_ONBOARDING_AND_LIFECYCLE.md → §11`. Required before the first schema change that depends on a new column or sheet.

### Entitlement model — Decision Pending
- Where plan state lives (small admin spreadsheet, external bridge, signed token), how it is read under `USER_ACCESSING`, cache strategy, latency budget. Per `CENTRAL_APP_DEPLOYMENT_OPTIONS.md → §8`. Required before step 8 in §5.

### Deployment settings timing — Decision Pending
- When the deployment posture changes from `executeAs: USER_DEPLOYING, access: MYSELF` to the central-app posture (`executeAs: USER_ACCESSING`, broader `access` scope) is **Decision Pending**. Per §7 here and `CENTRAL_APP_DEPLOYMENT_OPTIONS.md → §7`, this change is reserved for step 7 in §5 and requires its own product decision in writing.

---

## 9. Implementation gate

This document does not authorize implementation.

- **Actual coding requires a separate Cursor implementation prompt.** Each prompt names exactly which seam is being implemented, references the relevant Decision Pending items that must be resolved first, and limits the scope to one small seam at a time.
- **One small seam at a time.** Per `WORKING_RULES.md → Central App Transition Rules` and `CENTRAL_APP_DESIGN.md → §11 Operational mindset`, no implementation pass bundles multiple seams. A pass either swaps the resolver call in one module, or routes ensure-\* helpers through the resolver, or implements the central-mode branch of the resolver — never two of those in the same pass.
- **Each pass follows the standard Cursor flow:** inspect → propose smallest design → implement → test in UI → user requests commit → commit and push. No step is skipped.
- **No pass starts until its Decision Pending items are resolved.** The §8 checklist above is the gate. A pass blocked on a Decision Pending item is not started; the item is resolved in writing first, then the pass is planned.
- **The first authorized implementation prompt** — when it eventually arrives — should be the smallest possible step from §5: introducing the resolver in bound-mode-only form against a single module entry point. Nothing larger should be the first move.

Until that prompt arrives, the migration remains design work, captured here and in the linked architecture documents. No code is touched.

---

End of document.
