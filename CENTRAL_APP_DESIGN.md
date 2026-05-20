# CENTRAL_APP_DESIGN.md

Central App Migration Design Pass.

This document is the durable design record for moving CashCompass from a bound-sheet / copy-per-workbook deployment model to a centralized Apps Script web app. It is **architecture only**. No Apps Script code, no deployment changes, and no implementation work is performed here. All open architectural questions are listed explicitly and marked **Decision Pending**; they must be resolved before any central-app coding begins.

Cross-references:
- `PROJECT_CONTEXT.md → Future architecture — Central App (post-V1.2)`
- `ENHANCEMENTS.md → Future direction — Central App / Future direction — Monetization`
- `TODO.md → Future Phases (VNext) — Central App Migration / Monetization`
- `WORKING_RULES.md → Central App Transition Rules / Monetization Rules`
- `README.md → Future Direction`
- `ONBOARDING_AND_INPUT_STRATEGY.md → Future Updates / Upgrade Strategy`
- `GoingToProduction.md → Goal A vs Goal B, multi-tenant notes`

---

## 1. Purpose

CashCompass is today a **bound-sheet, copy-per-workbook Apps Script + Google Sheets app**. Each user runs their own copy of the script bound to their own spreadsheet via `SpreadsheetApp.getActiveSpreadsheet()`. Code updates currently require re-copying the script into each user's workbook, which produces version drift and makes broad distribution impractical.

The goal of this document is to **define the future centralized web app migration design before any implementation begins**. It exists so that:

- The product direction is durable across chat sessions and contributors.
- Every architectural decision required for the migration is either pinned here or marked explicitly as **Decision Pending**.
- The eventual implementation can proceed module-by-module without rewriting design choices mid-migration.
- The migration discipline laid out in `WORKING_RULES.md → Central App Transition Rules` has a single source of truth to validate against.

This document does **not** authorize implementation. Pulling the Central App migration into an active phase still requires an explicit product decision per `WORKING_RULES.md → Current phase`.

---

## 2. Current architecture

The state of CashCompass as of this design pass.

### Code distribution
- One Apps Script project per user, bound to that user's Google Sheets workbook.
- Updates require re-copying the script (or re-running `clasp push` against each bound project). No automatic propagation.
- Deployment today: `access: MYSELF`, `executeAs: USER_DEPLOYING` (per `GoingToProduction.md`). Effectively single-user, single-deploy.

### Data location
- All user data lives inside the bound spreadsheet: `INPUT - *`, `SYS - *`, `OUT - *`, `LOG - *` tabs.
- No external database. No cross-user data. No admin-side data store.
- `LOG - Activity` is per-workbook. Planner debounce state is per-workbook via `DocumentProperties` — already structured in a way that is forward-compatible with multi-tenant deployment (see `ENHANCEMENTS.md`).

### Spreadsheet resolution
- Backend modules resolve the active spreadsheet via direct calls to `SpreadsheetApp.getActiveSpreadsheet()`. There is **no central resolver helper today**.
- Identity (`Session.getEffectiveUser().getEmail()`) is read only where strictly necessary (e.g. planner email recipient resolution). It is **not** used to look up workbooks.

### Bootstrap and resilience
- The app already has additive **ensure-* helpers** (`ensureOnboardingBankAccountsSheetFromDashboard`, `ensureOnboardingBillsSheetFromDashboard`, `ensureOnboardingDebtsSheetFromDashboard`, `ensureSysAccountsSheet_`, etc.). They are idempotent: no-ops when the sheet exists, additive creation with canonical headers when it does not.
- First-run add flows (Bank Accounts → Add new, Debts → Add new, Bills → Add new) already call their corresponding ensure-* helper before the first `getSheet_` read, so blank-workbook adds succeed without "Missing sheet" errors.
- Read paths in `dashboard_data.js`, `cash_to_use.js`, planner, and several other modules have been hardened to **tolerate missing sheets** and return a `state` field (`notSetUp` / `partial` / `ready`) instead of throwing red banners.
- **Blank-workbook resilience is mandatory** and will remain so after the migration.

### Constraints inherited from the current architecture
- **Bound-workbook mode must remain supported during the entire migration.** Existing users must not regress.
- **No destructive sheet changes.** Ensure-* helpers only add — they never reformat, rename, or delete existing tabs/columns/rows.
- **No broad refactors.** Migration is staged, module by module, with bound mode and central mode coexisting.

---

## 3. Target architecture

The intended future state.

### Code distribution
- **One centralized Apps Script web app deployment.** Single URL for all users. No script copying. No per-user Apps Script project.
- A single deployed script version is the source of truth. A fix shipped once reaches every user immediately. No version drift.
- React/UI bundles (the rolling debt dashboard and any future React surfaces) are rebuilt and deployed centrally; users do not deploy anything.

### Data isolation
- **One spreadsheet per user.** Each user's financial data continues to live in their own Google Sheets workbook, never commingled with other users' data.
- User data isolation is enforced at the spreadsheet boundary — the same boundary the bound-sheet model relies on today. The Central App model does **not** introduce a shared user-data store.

### Spreadsheet resolution
- All backend modules open the caller's workbook via a single resolver: **`getUserSpreadsheet_()`** (or equivalent).
- The resolver:
  1. Identifies the caller (typically via `Session.getEffectiveUser().getEmail()`, see §7 for the access-model decision).
  2. Looks up the caller's spreadsheet ID in the user-to-spreadsheet mapping (see §4).
  3. If no mapping exists, triggers the bootstrap flow (see §5) to create a fresh workbook and persist the mapping.
  4. Returns the bound `Spreadsheet` object.
- Identity resolution lives in **exactly one place** — the resolver helper. Modules never call `Session.getEffectiveUser()` directly for workbook lookup. This guarantee already appears in `WORKING_RULES.md → Central App Transition Rules`.

### Upgrade model
- **Centralized code + additive workbook bootstrap.**
- Pure code changes (UI wording, planner logic, presentation, calculation refinements) propagate automatically the moment a new version is deployed — users do not edit their sheets.
- Schema-level changes (new sheets, new columns, new named ranges, new defaults) are applied via the existing additive ensure-* helper pattern, executed lazily on first read/write that needs the new structure. Existing user data is preserved.
- A workbook version marker (see §10, Decision Pending) will eventually let the app refuse to read workbooks below a minimum-required version and guide the user through a safe upgrade.

---

## 4. User-to-spreadsheet mapping

The mapping records, for each user, which spreadsheet ID belongs to them.

### Likely first approach: `PropertiesService.getUserProperties()`

The lightest viable mapping:

- Key: stable mapping key, e.g. `cashCompassWorkbookId`.
- Value: the spreadsheet ID returned by `SpreadsheetApp.openById(...)`.
- Scope: per-user. Each user reads/writes only their own value. No admin spreadsheet, no shared registry, no extra single point of failure.

Flow:

1. Resolver reads `cashCompassWorkbookId` from `UserProperties`.
2. If present and the spreadsheet still opens cleanly, return it.
3. If absent (or the spreadsheet has been deleted / access revoked), trigger the bootstrap path: create a fresh workbook, store its ID under `cashCompassWorkbookId`, and continue.

Why this is the likely first approach:

- Zero admin infrastructure. No `SYS - User Workbooks` admin spreadsheet to maintain or back up.
- Naturally scoped per user — no cross-user query, no shared lock, no leakage risk.
- Matches the existing precedent of `DocumentProperties` for per-spreadsheet state.
- Aligns with the existing rule that identity resolution lives in one place.

### What this approach does **not** give us

- No queryable "list of all users" for support or analytics.
- No natural place to record per-user plan / entitlements (Monetization, §8) — that would need its own location (likely a small admin spreadsheet keyed by email).
- No central audit trail of workbook creation events.

### Unresolved concerns (carried as Decision Pending in §10)

- **Mapping location final choice.** `UserProperties` (per-user, lightweight) vs a central registry sheet (e.g. `SYS - User Workbooks`) inside an admin spreadsheet. Likely first approach is `UserProperties`; the alternative is recorded so the trade-off is explicit.
- **Recovery semantics.** What happens if the mapping points to a spreadsheet ID the user has deleted, lost access to, or moved out of Drive? Bootstrap a new one? Surface a recovery wizard? **Decision Pending.**
- **Cross-device / cross-account behavior.** A user signed in to two different Google accounts would receive two different workbooks because identity is keyed by email. This is the intended isolation model; it is documented here to remove ambiguity later.
- **Mapping migration tooling.** If we later move from `UserProperties` to a registry sheet (or vice versa), how do we backfill existing users without disrupting them? **Decision Pending.**

---

## 5. Bootstrap and upgrade philosophy

The principle that governs every change to user workbooks.

### Core principles

- **Additive only.** Bootstrap and upgrade flows may add sheets, columns, named ranges, defaults, formats, and seeded rows. They must **never** rename, delete, reformat, reorder, or rewrite existing user content.
- **Idempotent.** Every ensure-* helper is a no-op when the target structure already exists with the canonical shape. Calling it twice produces the same end state as calling it once.
- **Lazy.** Bootstrap and upgrade work happens at the moment a feature actually needs the new structure (the first time a user opens a tab, runs a save, etc.). The app does not perform "big migration" sweeps across all users.
- **Defensive.** Helpers tolerate partially-applied prior runs. They detect what is present, fill in what is missing, and leave the rest alone.

### Existing helpers that already follow this pattern

- `ensureOnboardingBankAccountsSheetFromDashboard`
- `ensureOnboardingBillsSheetFromDashboard`
- `ensureOnboardingDebtsSheetFromDashboard`
- `ensureSysAccountsSheet_`
- The Cash Flow year-sheet styling helpers (`applyCashFlowSheetStyling_`, `applyCashFlowSummaryRowStyling_`) — they upgrade legacy unstyled sheets transparently on the next Quick Add / debt seed / bill seed run.

These helpers are the **template** for every future schema-level upgrade.

### What bootstrap creates on first run

For a brand-new user with no existing CashCompass workbook:

- A fresh spreadsheet (creation method is Decision Pending — see §5 *Bootstrap creation strategy* and §10).
- Canonical empty `INPUT - *` / `SYS - *` tabs only as features touch them, via the existing ensure-* pattern. The bootstrap does **not** pre-create every possible tab on day one; that would slow first run and create empty surfaces the user has not yet been guided to.
- The dashboard's Welcome gate (already implemented in `Dashboard_Script_Onboarding.html`) handles the empty-state UX. Setup / Review (already delivered, see `PROJECT_CONTEXT.md`) is the user-facing guided flow.

### Bootstrap creation strategy — two options, Decision Pending

- **Option A — Frozen template workbook.** A known-good template spreadsheet exists at a stable ID; bootstrap copies it via Drive API for each new user. Pros: visual styling and headers are guaranteed identical to the reference. Cons: requires maintaining a separate canonical template; template drift becomes its own problem.
- **Option B — Programmatic seed.** Bootstrap creates an empty spreadsheet and relies entirely on existing ensure-* helpers to add structure on demand. Pros: no template artifact to maintain; the code that creates the structure is the same code that already exists and is exercised continuously. Cons: visual styling decisions live entirely in code.

`PROJECT_CONTEXT.md` line 336 explicitly leaves the template link blank: *"Template link: (none yet — add when ready.)"* — a deliberate non-decision today.

### Upgrade preservation rules

- **Existing user data must be preserved bit-for-bit.** Upgrades may add nearby columns, fill defaults in newly-added cells, and create new sheets. They may not touch values the user has already entered.
- **Workbook version marker.** A small marker (location TBD — script property, named range, or a SYS / Meta sheet — see §10) will record what schema version a workbook is on. Features that need new structure compare the workbook version to a minimum-required version and either silently upgrade additively or guide the user through a controlled migration helper. No feature is allowed to assume the user has already upgraded.
- **Blank-workbook resilience remains mandatory.** Every read path must continue to return a `state` field and never throw on missing structure.

---

## 6. Migration strategy

How we get from bound-sheet mode to Central App mode without breaking existing users.

### Staging principle

- **No big-bang migration.** A single PR that rewrites every `getActiveSpreadsheet()` call site is explicitly forbidden by `WORKING_RULES.md → Central App Transition Rules`.
- **Both modes coexist for the full duration of the migration.** Bound-workbook users continue to work byte-for-byte unchanged. New users hit the central-app bootstrap.

### Abstraction point

- The single abstraction is the resolver: **`getUserSpreadsheet_()`** (or equivalent).
- In bound-sheet mode, the resolver returns `SpreadsheetApp.getActiveSpreadsheet()`.
- In central-app mode, the resolver returns the user's mapped workbook (see §4) or triggers bootstrap (see §5).
- Modules call only the resolver. They do **not** know which mode they are in.

### Module-by-module migration

Each migration pass converts one backend module to use the resolver:

- One module per pass.
- Each pass ships independently, with its own manual test plan.
- Modules affected (per `TODO.md → VNext Central App Migration`): planner, dashboard, debts, bills, accounts, retirement, activity log, bank import, plus any module that calls `SpreadsheetApp.getActiveSpreadsheet()` today.
- **Migration order is Decision Pending** (§10). Recommended sequencing principle: highest-traffic read paths first (so the resolver gets exercised early), write paths in lowest-risk → highest-risk order.

### Per-pass test matrix

Every module migration pass must validate **both modes** before being considered done:

1. **Legacy workbook (bound-sheet mode).** Open the touched module against an existing populated user workbook. Behavior must be byte-for-byte identical to pre-migration: same outputs, same activity log entries, same planner email, same UI.
2. **New user bootstrap flow.** A first-time user with no mapping lands on a freshly bootstrapped workbook. The touched module reads/writes against that workbook. No other user's data is touched. No admin-side state is touched (beyond the mapping write).

### Regression discipline

- **Bound-sheet mode must not regress at any point during the migration.** If a migration pass would force bound-sheet users to change anything about their setup, the pass is wrong and must be redesigned.
- **No destructive sheet changes during migration.** Bootstrap may create new sheets in a new user's workbook; it must never reformat or rewrite an existing populated workbook.
- **No identity resolution outside the resolver.** Modules must not start calling `Session.getEffectiveUser()` directly for workbook lookup; doing so spreads identity logic and breaks the single-point-of-resolution rule.

---

## 7. Security and deployment decision — unresolved

**This entire section is Decision Pending.** It is intentionally separated because it is the single largest blocker to implementation. Every question below must be answered explicitly before any central-app code is written.

### Execution mode

- **Decision Pending: `executeAs: USER_ACCESSING` vs `executeAs: USER_DEPLOYING`.**
- Today's deploy uses `USER_DEPLOYING` (per `GoingToProduction.md`), which is appropriate for a single-user app.
- For a centralized multi-tenant app, **`USER_ACCESSING`** is the natural choice: every user's request runs as themselves, accesses only their own Drive / Sheets, and the developer's identity is never used to read user data. This is the model with the lowest privacy and support-burden profile.
- `USER_DEPLOYING` in a multi-tenant context would mean the script runs with the developer's privileges and reads/writes other users' data on the developer's behalf. The privacy / security / liability profile of this option must be explicitly understood and rejected (or accepted with documented compensating controls) before adoption.

### Access scope

- **Decision Pending: `access: MYSELF` vs `access: DOMAIN` vs `access: ANYONE` vs `access: ANYONE_ANONYMOUS`.**
- Personal-use today: `MYSELF`.
- For Central App with `USER_ACCESSING`, the access scope determines who can reach the URL. Anything broader than `MYSELF` requires an explicit decision on identity capture, abuse prevention, and (eventually) monetization gating.

### User identity determination

- **Decision Pending.**
- Likely: `Session.getEffectiveUser().getEmail()` when running with `USER_ACCESSING` against Google-authenticated users.
- Edge cases to resolve: anonymous access (not supported in `USER_ACCESSING`), email-unavailable consumer Gmail rate-limit cases, future non-Google identity providers if the app ever moves off Apps Script for the front door.

### Spreadsheet ownership and sharing

- **Decision Pending.**
- **Option A — User-owned.** Bootstrap creates the spreadsheet in the user's Drive (via Drive API), making the user the canonical owner of their own data. Pros: matches the "your data lives in your Drive" trust pitch; clean revocation when a user leaves. Cons: more complex bootstrap permissions; relies on the user's Drive quota.
- **Option B — Developer-owned, shared with user.** Bootstrap creates the spreadsheet in the developer account's Drive and shares it with the user. Pros: easier centralized backup/visibility; consistent storage account. Cons: the developer technically owns user financial data — a major trust and liability concern; harder to fully transfer to the user later; harder to make a clean exit if the developer account is deprecated.
- The choice is the single most consequential trust decision in the entire migration.

### Privacy and support implications

- **Decision Pending.**
- Each of the four execution-mode / ownership combinations produces a different answer to: "Can the developer read user data?", "What do we tell users about who can see their numbers?", "What does support need to access to debug a user-reported issue?", "How do we respond to a deletion request?"
- A written stance is required before any user other than the developer gets a URL.

### Monetization implications

- **Decision Pending.**
- Feature gating (see §8) lives in centralized code regardless of execution mode, so monetization is workable under either mode.
- However, ownership model (A vs B above) affects what "revocation" means for a paid user who stops paying. Under A, revocation is feature-level (the developer cannot delete user data; the data simply stops being readable through the paid features). Under B, revocation could in principle include data lockdown, which raises consumer-protection questions.

### Revocation, export, and data lifecycle

- **Decision Pending.**
- How does a user delete their account?
- How does a user export their data when leaving?
- What happens to the mapping (`UserProperties`) when a user is removed?
- What is the developer's retention policy for the mapping registry?

**Until every question in §7 is answered in writing, no central-app code is written.**

---

## 8. Monetization / feature gating

Design-level considerations only. Exact payment-provider and billing-flow implementation is out of scope for this document.

### What centralized code enables

- **Single point for feature gating.** A gated feature lives in one place in code; gating decisions live next to the feature implementation (per `WORKING_RULES.md → Monetization Rules`). The fact that all users run the same deployed code is what makes gating meaningful — gating a per-copy install is not enforceable.
- **Single source of plan / entitlement records.** The most natural location for plan records is a small admin spreadsheet keyed by email (likely `SYS - Users` with `Email | Plan | CreatedAt` per `ENHANCEMENTS.md → Future direction — Monetization`). It can live alongside any central registry that may later replace `UserProperties` for the workbook mapping.

### Data isolation guarantees under gating

- **Per-user data remains separate.** Gating may hide UI surfaces, refuse to perform paid actions, or short-circuit advanced calculations. It must never touch user financial data.
- **Monetization must not corrupt or remove user data.** Free-tier downgrade, paid-tier expiry, and plan-lookup failure all default to "feature unavailable" — never to "data altered or removed."
- **Gating controls features, UI, and actions — not raw spreadsheet ownership.** A user's spreadsheet remains theirs regardless of plan state.

### Gating rules (already documented, restated here for completeness)

- **Never gate core functionality initially.** Cash Flow, Bills Due, Debts list, Quick Add, Activity log, planner email, and the existing dashboard surfaces stay free. Gating starts at the edges (Bank Import / sync, advanced planner features), not at the core.
- **Gate advanced features only.** A feature is a gating candidate only if (a) it is meaningfully optional for core decisions, and (b) it has a clear paid-tier value proposition.
- **Always fail gracefully.** Any failure in plan resolution must default to the free / unblocked path or a calm "feature unavailable" state. No crashes, no red banners, no exceptions surfaced to the user.
- **Plan helpers are defensive by design.** `getUserPlan_(email)` and `isPaidUser_()` wrap reads in try/catch and return `'free'` on any error.
- **Document each gate.** When a feature becomes gated, the gate is recorded in `ENHANCEMENTS.md` so the gating surface stays auditable.

### Sequencing relative to the migration

The order is fixed in `ENHANCEMENTS.md` and `TODO.md`:

1. Central App migration lands (`getUserSpreadsheet_()` resolver, bootstrap flow, modules migrated).
2. `SYS - Users` schema + helpers (`getUserPlan_`, `isPaidUser_`) ship as additive scaffolding.
3. Bank Import becomes the first gated feature.

Monetization is meaningful only **after** Central App migration is in place.

### Out of scope for this document

- Payment provider selection.
- Billing webhook handling.
- Trial-window logic (the `CreatedAt` column exists for this, but the rules are not written yet).
- Refund and dispute workflow.
- Per-day / per-month usage caps on heavy operations for the free tier (a candidate, not a commitment).

---

## 9. Guardrails

Hard rules that govern every step of the migration. These are non-negotiable and mirror existing rules in `WORKING_RULES.md`.

- **No implementation until design decisions are documented.** Every Decision Pending item in §10 must be resolved in writing before the corresponding code is written. Resolving them as we go is forbidden — that is the failure mode this document exists to prevent.
- **No broad refactors.** Module-by-module migration only. No "while we're in there" rewrites of adjacent code.
- **Preserve bound-sheet compatibility for the full duration of the migration.** Existing users must not regress at any point.
- **No destructive sheet changes.** Additive only. Ensure-* helpers create what is missing; they never rewrite what is present.
- **Identity resolution lives in exactly one place.** Modules never call `Session.getEffectiveUser()` directly for workbook lookup.
- **Test both flows on every migration pass.** Legacy bound-workbook *and* new-user bootstrap. Both must pass before the pass is considered done.
- **No commit until runtime testing is confirmed.** Per `WORKING_RULES.md → Git — no autonomous staging or commits`: code changes are not committed until the user has tested in the UI and explicitly asked for the commit. Documentation passes (like this one) follow the same rule — the contributor does not stage or commit on the user's behalf.
- **Changes are developed through Cursor with clear analysis / implementation / testing / commit boundaries.** Every pass is structured as: inspect → propose smallest design → implement → test in UI → user requests commit → commit and push. No skipping steps.

---

## 10. Open questions

Final checklist of unresolved architectural questions. Each must be resolved (in writing, in this document or a linked document) before the corresponding implementation work begins.

### Deployment execution mode — Decision Pending
- `executeAs: USER_ACCESSING` vs `executeAs: USER_DEPLOYING` for the centralized web app.
- `access` scope (`MYSELF` / `DOMAIN` / `ANYONE` / `ANYONE_ANONYMOUS`).
- Required answer before: any code that depends on knowing whose Drive credentials run a request.

### Spreadsheet ownership model — Decision Pending
- User-owned (created in the user's Drive) vs developer-owned (created in the developer Drive and shared with the user).
- Drive API permissions required for the chosen model.
- Required answer before: bootstrap implementation.

### First-run onboarding flow — Decision Pending
- Bootstrap creation strategy: frozen template workbook vs programmatic seed (see §5).
- Where Setup / Review (already shipped) fits in the central-app first-run path. Today it runs *after* the user already has a workbook; in central-app mode it runs immediately after bootstrap.
- Required answer before: bootstrap implementation.

### Migration path for existing bound-sheet users — Decision Pending
- Does an existing bound-sheet user with their own workbook migrate to the central app by registering their existing spreadsheet ID under `UserProperties`?
- Or do they continue to run their bound copy indefinitely (and only new users are central-app users)?
- Or is there a one-time migration tool that ingests their bound workbook?
- Required answer before: announcing the central app to existing users.

### Upgrade versioning — Decision Pending
- Where the workbook version marker lives: script property, named range in a SYS / Meta sheet, or dedicated cell in an existing SYS sheet.
- Starting value and minimum-required-version contract.
- How features compare current vs required version and whether they auto-upgrade additively or surface a "your workbook needs to be upgraded" UI.
- Required answer before: shipping the first schema change that depends on a new column / sheet / structure.

### Feature gate storage and enforcement — Decision Pending
- Where `SYS - Users` lives (admin spreadsheet location, ID stability, backup).
- How `getUserPlan_(email)` reads the gate without introducing a cross-user lock on every request.
- Cache strategy (script-level cache vs uncached read per request).
- Required answer before: shipping the first gated feature.

### Mapping location — Decision Pending
- `PropertiesService.getUserProperties()` (likely first approach, see §4) vs a central registry sheet (`SYS - User Workbooks` in an admin spreadsheet).
- Migration path if we move from one to the other later.
- Required answer before: any resolver implementation.

### Backup and export strategy — Decision Pending
- How a user exports their data when leaving (their workbook is in Drive, so download-as-XLSX is the default, but is anything else needed?).
- Whether the developer keeps any backup of user workbooks (under either ownership model).
- Required answer before: the first non-developer user gets a URL.

### Admin / support visibility limits — Decision Pending
- Under `USER_ACCESSING`, the developer cannot read user data through the script. What channels exist for support? (User screen-share? User exports their workbook and shares it manually?)
- Under `USER_DEPLOYING` or developer-owned spreadsheets, the developer *can* read user data — and must define explicit limits in policy.
- Required answer before: published privacy policy or terms.

### Identity edge cases — Decision Pending
- Anonymous / unauthenticated access (not supported under `USER_ACCESSING`, but the failure mode must be defined).
- Email-unavailable consumer Gmail accounts (rare but possible).
- Users with multiple Google accounts (intended isolation behavior; documented in §4, but the UX implication is unspecified).
- Required answer before: production launch.

### Two-dashboards drift — Decision Pending (cross-reference)
- `PlannerDashboard.html` (sidebar) and `PlannerDashboardWeb.html` (web) are separate today (`ENHANCEMENTS.md → Larger workflow unification`). The Central App migration effectively retires the sidebar (or forces it to also call the resolver). Sequencing of unification vs central-app migration is not pinned.

---

End of document.
