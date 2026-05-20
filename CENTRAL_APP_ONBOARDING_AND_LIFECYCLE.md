# CENTRAL_APP_ONBOARDING_AND_LIFECYCLE.md

User onboarding and spreadsheet lifecycle contract for the future CashCompass Central App.

This document defines how users, spreadsheets, bootstrap, upgrades, recovery, and migration should behave once the Central App migration is in place. It is **architecture and contract only**. No Apps Script code, no HTML/JS, no deployment settings, no implementation. All unresolved items are marked **Decision Pending**.

Cross-references:
- `CENTRAL_APP_DESIGN.md` — migration architecture, abstraction point, guardrails.
- `CENTRAL_APP_DEPLOYMENT_OPTIONS.md` — preferred direction: centralized code + user-owned spreadsheets + `executeAs: USER_ACCESSING`.
- `PROJECT_CONTEXT.md` — Setup / Review (Onboarding Phase 1, delivered); first-run self-heal already in place.
- `ENHANCEMENTS.md → Onboarding (Phase 1)` — Setup / Review delivered state and follow-ups.
- `WORKING_RULES.md → Central App Transition Rules` — migration discipline.
- `ONBOARDING_AND_INPUT_STRATEGY.md → Future Updates / Upgrade Strategy` — additive-upgrade principle.

---

## 1. Purpose

This document defines the **user-facing lifecycle contract** for the Central App: every state a user can be in, every transition between those states, and what the app guarantees in each one.

It exists because:

- The migration architecture (`CENTRAL_APP_DESIGN.md`) and the deployment model (`CENTRAL_APP_DEPLOYMENT_OPTIONS.md`) are decided in principle, but the lifecycle the user actually experiences — first run, reconnect, recovery, deletion — is not yet pinned.
- Implementation requires a single, written contract for what "new user," "existing bound-mode user," and "returning central-app user" each look like. Without it, the bootstrap and resolver code cannot be written safely.
- Lifecycle failures (deleted workbook, revoked access, partial bootstrap) are exactly the cases where users lose trust if behavior is improvised. Pinning them on paper now prevents improvisation later.

Out of scope for this document:

- Payment provider, billing flows, refund handling.
- Exact React/HTML UI mockups for the first-run wizard.
- Specific Drive API call sequences.

In scope:

- Lifecycle states and transitions.
- Bootstrap, upgrade, and recovery semantics under the preferred deployment model (`USER_ACCESSING` + user-owned spreadsheets).
- Bound-mode coexistence and migration path for existing users.
- Decision Pending checklist that gates implementation.

---

## 2. Lifecycle model

The target lifecycle for a user of the Central App.

### States

A user is always in exactly one of the following states from the app's perspective:

1. **Unauthenticated.** The user has reached the deployment URL but has not yet consented to the OAuth scopes the script needs.
2. **Authenticated, unmapped.** The user has consented; no `cashCompassWorkbookId` (or equivalent) mapping exists for them yet. They are a first-run user.
3. **Authenticated, mapping resolved, workbook accessible.** The normal steady state. The resolver returns a `Spreadsheet` handle; the app runs.
4. **Authenticated, mapping resolved, workbook missing or inaccessible.** Recovery state. The mapping points to a spreadsheet that has been deleted, moved, lost access, or otherwise cannot be opened. See §7.
5. **Authenticated, disconnected.** The user has explicitly disconnected the app or revoked the OAuth grant. The app cannot read or write their workbook. Their data stays in their Drive untouched.

### Transitions

- **Unauthenticated → Authenticated, unmapped.** User completes OAuth consent on first arrival.
- **Authenticated, unmapped → Authenticated, mapping resolved, workbook accessible.** Bootstrap creates a user-owned workbook in the user's Drive, the mapping is stored, the workbook is opened.
- **Authenticated, mapping resolved, workbook accessible → workbook missing or inaccessible.** Mapping still exists, but the workbook can no longer be opened. Triggered by user-side Drive actions (delete, move, share-then-revoke) or transient Drive errors.
- **Workbook missing or inaccessible → mapping resolved, workbook accessible.** Recovery flow: re-bootstrap (create a new workbook) or reconnect (point the mapping at an existing CashCompass-shaped workbook).
- **Any authenticated state → Disconnected.** User-initiated disconnect inside the app, or external OAuth grant revocation.
- **Disconnected → Authenticated, unmapped.** User re-consents. The previous mapping is honored (if the workbook still exists) or treated as recovery (§7) if not.

### Invariants

Independent of state:

- **User data isolation.** Each user's workbook is opened only on their own request, under their own credentials. No cross-user access at runtime.
- **No data destruction by lifecycle transitions.** No transition deletes user financial data. Bootstrap creates a new workbook; recovery may create a fresh workbook alongside the old one (Decision Pending whether the old one is auto-archived); disconnect leaves the user's workbook untouched in their Drive.
- **Blank-workbook resilience continues to apply.** Every read path tolerates missing structure even in the steady state, so partial bootstrap or partial upgrade never produces a red banner.

---

## 3. New user onboarding

The first-run path for a user who has never used CashCompass before.

### First-run detection

A user is detected as first-run when:

- They are authenticated, **and**
- The resolver finds no `cashCompassWorkbookId` (or equivalent mapping) for them, **and**
- They have not opted into a "connect existing workbook" path (see §4).

The detection happens inside the resolver. The user-facing entry point does not need to know about it.

### Consent and authentication requirements

- The deployment runs `executeAs: USER_ACCESSING` (per `CENTRAL_APP_DEPLOYMENT_OPTIONS.md` §7). Every user consents individually on first arrival.
- The OAuth scope set must be the **minimum** required for the features the user touches. Specific scopes are Decision Pending; the principle is scope discipline — request only what each feature genuinely needs.
- If the user denies consent, the app surfaces a calm "CashCompass needs permission to create your workbook" message with a clear retry path. It does not loop them through consent silently.

### Spreadsheet creation

- A fresh spreadsheet is created in the **user's own Drive** under the user's identity.
- The exact creation mechanism (Drive API vs `SpreadsheetApp.create()`), the folder placement, and the file naming convention are Decision Pending (§11).
- The mapping (`cashCompassWorkbookId` or equivalent) is written immediately after successful creation, so a refresh re-uses the same workbook rather than creating another one.

### Initial bootstrap

- Bootstrap is **additive** and uses the existing **ensure-\* helper** pattern: `ensureOnboardingBankAccountsSheetFromDashboard`, `ensureOnboardingDebtsSheetFromDashboard`, `ensureOnboardingBillsSheetFromDashboard`, `ensureSysAccountsSheet_`, etc. Each helper is idempotent and additive.
- Initial bootstrap does **not** pre-create every possible tab on day one. Tabs are created lazily as features touch them, the same pattern the bound-sheet app already uses.
- Bootstrap may seed canonical headers, named ranges, and basic styling. It does **not** seed example data, demo rows, or fake transactions.

### Setup / Review handoff

- After the workbook is created and the mapping stored, the user lands on the **Setup / Review** surface (already delivered, per `PROJECT_CONTEXT.md` §"Setup / Review (Onboarding Phase 1, delivered)").
- Setup / Review remains a **read-only** walkthrough of the five input areas. It never writes, never touches `SYS -` sheets, never writes to `LOG - Activity`.
- The user can also bypass Setup / Review and go directly to Overview; the app must remain graceful in that case (the Welcome gate already handles it).

### Graceful failure modes

The first-run flow must handle these failures without losing user trust:

- **Drive quota exhausted on the user's side.** Surface a clear "Google Drive is full; please free space" message. Do not retry silently in a loop.
- **Drive scope denied.** Re-prompt for consent with a clear explanation of why the scope is needed. Do not pretend the workbook was created.
- **Transient Drive API error.** Retry with exponential backoff, capped. Surface a friendly error after the cap.
- **Workbook created but mapping write failed.** Treat as a first-run state on the next request; the orphaned workbook is the user's to keep or delete (it's in their Drive).
- **Mapping write succeeded but bootstrap failed mid-way.** Ensure-\* helpers are idempotent; the next request resumes bootstrap. No partial state is destructive.

---

## 4. Existing user migration

How users who today run the bound-sheet copy-per-workbook model move (or don't move) to the Central App.

### Principles

- **No forced destructive migration.** Existing bound-sheet users continue to work byte-for-byte. The Central App does not unilaterally rewrite their workbook.
- **Bound mode remains supported during the entire transition.** Per `WORKING_RULES.md → Central App Transition Rules`, both modes coexist. Existing users must not regress at any point.
- **Staged migration only.** Each backend module migrates one at a time via the `getUserSpreadsheet_()` resolver abstraction (per `CENTRAL_APP_DESIGN.md → §6`). The user-side migration path is layered on top of that abstraction.

### Possible "connect existing workbook" flow

Many existing users already have a populated workbook they trust. The Central App should offer a path for them to **link their existing workbook** rather than starting from a fresh bootstrap. This flow is a **Decision Pending design**; the principles below define the contract.

- The user provides their existing workbook (by URL, by Drive picker, or by sharing it with the app).
- The app **validates** the workbook before linking (see "Validation before linking" below).
- On successful validation, the mapping is written pointing at the existing workbook ID. No new workbook is created.
- On failed validation, the app **does not auto-repair**. It surfaces what is missing and offers either (a) link anyway and run additive repair, or (b) cancel and start fresh.

### Validation before linking

Before accepting an existing workbook as a CashCompass workbook, the app should verify:

- The user can access it (read/write permission).
- It is not already linked to a different user (Decision Pending whether this is even detectable under `USER_ACCESSING`; see §7).
- It contains **at least one** recognizable CashCompass tab (e.g. an `INPUT -` or `SYS -` sheet) so the app is confident this is a CashCompass workbook and not an unrelated spreadsheet.
- It is not below the minimum required schema version (when the version marker is defined; Decision Pending).

The principle: **never link blind**. The user must know what they are connecting.

### Additive repair after linking

Once linked, the same ensure-\* helpers used at first run are used to bring the workbook up to current structure. **Additive only.** No renames, no deletions, no reformatting of existing user content. If the workbook lacks a tab a current feature needs, the helper creates it. If the workbook has an older tab structure that is still compatible, it stays.

### Bound mode is unaffected

A user who never opts into the Central App continues to use their bound copy indefinitely. The bound copy continues to receive code updates the manual way (the contributor pushes via `clasp`, the user re-binds or pulls). Whether bound mode is eventually deprecated is a separate product decision and is not made in this document.

### Backward compatibility as a primary requirement

The migration path described above is built on the same first-class requirement that governs the rest of the Central App work (`CENTRAL_APP_DESIGN.md → §6 Backward compatibility as a primary requirement`).

- **Existing bound-workbook functionality must continue working** during every phase of the migration. Any pass that breaks an existing user workflow is rejected, even if it advances the Central App story.
- **Existing calculations, dashboards, onboarding flows, and additive bootstrap behavior are preserved** unless they are intentionally replaced through their own product decision. The migration moves the spreadsheet-resolution layer underneath; it does not rewrite what runs on top.
- **No forced cutover.** Existing users are never auto-moved into Central App mode. They opt in via the "connect existing workbook" flow described above, or they stay on bound mode indefinitely.

---

## 5. User-to-spreadsheet linking

How a user identity is bound to a specific spreadsheet ID, looked up, and unbound.

### Mapping concept

The resolver (`getUserSpreadsheet_()` or equivalent, per `CENTRAL_APP_DESIGN.md → §3`) needs to answer one question: *"Which spreadsheet ID belongs to the calling user?"*. The mapping store is the place this question is answered.

### Likely first approach: `PropertiesService.getUserProperties()`

Per `CENTRAL_APP_DESIGN.md → §4`:

- Key: a stable mapping key (e.g. `cashCompassWorkbookId`).
- Value: the spreadsheet ID returned by Drive at workbook creation.
- Scope: per-user. Each user reads and writes only their own value. No admin spreadsheet required.

Why this is the likely first approach: zero admin infrastructure, naturally per-user, no cross-user query, no shared lock, matches the existing precedent of `DocumentProperties` for per-spreadsheet state.

### Mapping storage — Decision Pending

The alternative is a central registry sheet (e.g. `SYS - User Workbooks` in an admin spreadsheet) owned by the developer. Trade-offs are recorded in `CENTRAL_APP_DESIGN.md → §4` and `CENTRAL_APP_DEPLOYMENT_OPTIONS.md`. **The final choice is Decision Pending.**

### Relink

The user may want to point CashCompass at a different workbook (e.g. they accidentally let it create a new one when they meant to use their existing one).

- A user-visible **Relink** action lets the user choose a different workbook by URL or Drive picker.
- The same validation rules as §4 apply.
- The new mapping replaces the old mapping. The previously linked workbook is **not** deleted, modified, or archived — it stays in the user's Drive as-is.

### Disconnect

The user may want to disconnect CashCompass entirely.

- A user-visible **Disconnect** action clears the mapping (and, ideally, prompts the user to also revoke the OAuth grant via Google account settings — link out, do not attempt to revoke from inside the app).
- The user's workbook is **not** deleted, modified, or archived. It stays in their Drive as-is.
- On the next visit, the user lands in "Authenticated, unmapped" state and either bootstraps fresh, links an existing workbook, or leaves.

### Duplicate or ambiguous workbooks

The user may have multiple workbooks that look like CashCompass workbooks (e.g. an old bound copy and a Central-App-created one). The mapping resolves this by being explicit: exactly one workbook ID is mapped at a time. **The app does not auto-discover and pick.** If the user has multiple, they choose via the Relink flow.

---

## 6. Bootstrap and upgrades

The contract that governs every structural change the app makes to a user's workbook.

### Core principles (carried from `CENTRAL_APP_DESIGN.md → §5`)

- **Additive only.** Bootstrap and upgrade flows may add sheets, columns, named ranges, defaults, formats, and seeded canonical headers. They must **never** rename, delete, reformat, reorder, or rewrite existing user content.
- **Idempotent.** Each ensure-\* helper is a no-op when the target structure already exists. Calling it twice produces the same end state as calling it once.
- **Lazy.** Bootstrap and upgrade work happens when a feature actually needs the new structure. No sweep-everywhere migration runs across all users.
- **Defensive.** Helpers tolerate partially-applied prior runs. They detect what is present, fill in what is missing, leave the rest alone.

### No user data deletion

- No upgrade may delete a row, column, sheet, or named range the user has populated.
- "Cleanup" of obviously inert legacy structure (e.g. the legacy `Your Current Age` row mentioned in `ENHANCEMENTS.md`) is allowed **only** as an opt-in tool the user runs, never as an automatic upgrade step.

### No destructive schema changes

- A schema-level change that would require restructuring existing user data is, by definition, a destructive change and is forbidden under the additive-upgrade contract.
- If a future feature genuinely requires destructive restructuring, it is handled outside the upgrade path as a one-time, user-initiated migration helper with an explicit confirmation step — never as a silent on-load action.

### Versioning strategy — Decision Pending

A workbook version marker is the long-term mechanism that lets the app compare the user's workbook version to a minimum-required version and either silently upgrade additively or guide the user through a migration helper. The exact mechanism is **Decision Pending**:

- Location: script property, named range in a SYS / Meta sheet, or a dedicated cell in an existing SYS sheet.
- Starting value, increment policy, and minimum-required-version contract.
- How the app behaves when the workbook version is *higher* than the running code expects (downgrade case — should generally be tolerated since changes are additive, but the failure mode must be defined).

The principle remains: **no feature assumes the user has already upgraded**. Every read path tolerates the legacy shape.

### Blank-workbook resilience remains mandatory

- Every read path returns a `state` field (`notSetUp` / `partial` / `ready`) and never throws on missing structure.
- This rule already applies in bound mode and continues unchanged in Central App mode.

---

## 7. Recovery and failure scenarios

How the app behaves when the steady state breaks. Each scenario must have a defined response before any centralized-app code is written; many specifics are Decision Pending.

### Spreadsheet deleted

- The mapping points at an ID that no longer resolves.
- Response: surface a clear "Your CashCompass workbook can't be found" message with three explicit options:
  1. Create a new workbook (re-bootstrap; the old data is gone from the user's Drive — by their own action).
  2. Link an existing workbook (Relink flow, §5).
  3. Cancel and exit.
- The app **does not** silently re-bootstrap. The user must approve the path.

### User revokes OAuth access

- The app cannot call any Drive/Sheets API on the user's behalf. Every call fails with an authorization error.
- Response: detect the auth failure and surface a "CashCompass access has been revoked. Re-authorize to continue" message with a clear re-consent path. Do not retry in a loop.
- The user's workbook is untouched in their Drive.

### Spreadsheet moved within the user's Drive

- A Drive-level move (folder change, rename) does not change the spreadsheet ID. The mapping still resolves.
- Response: no special handling needed. The app continues to work normally.

### Spreadsheet moved to a Shared Drive or shared with others

- The mapping still resolves; the user retains access.
- Response: no special handling at the app layer. Shared-Drive interactions and multi-user editing are the user's responsibility and outside the Central App contract.

### Permission denied (user lost access to their own workbook)

- Unusual but possible — for example, the user moved the workbook into a Shared Drive they no longer have access to.
- Response: same as "spreadsheet deleted" from the app's perspective — clear message, three explicit options, no silent re-bootstrap.

### Partial bootstrap failure

- Workbook created; some ensure-\* helpers succeeded; one failed mid-way (e.g. Drive transient error during a header write).
- Response: ensure-\* helpers are idempotent. The next request resumes from where it stopped. No user-visible inconsistency unless multiple attempts continue to fail — in which case the standard error surface applies.

### Corrupted or missing sheets after the fact

- A user deletes a sheet manually inside their workbook; the next feature that needs it fails to find it.
- Response: the corresponding ensure-\* helper detects the missing sheet on the next read path and recreates it additively. User data on that sheet is gone (the user deleted it); the canonical headers and structure are restored.
- The app does **not** restore data from any source. It is not a backup service.

### Duplicate spreadsheets found

- Not auto-detected by the app under `USER_ACCESSING` (no scan of the user's Drive). If the user manually links the wrong workbook via Relink, the same workbook can effectively be "linked twice" if their previous mapping was lost.
- Response: this is a user-driven situation handled via the Relink flow (§5). The app does not deduplicate workbooks.

### Payment / feature status unavailable

- The plan-lookup mechanism (per `CENTRAL_APP_DEPLOYMENT_OPTIONS.md`, the specific mechanism is Decision Pending) cannot be reached or returns an error.
- Response: per `WORKING_RULES.md → Monetization Rules`, default to the **free / unblocked** path. The app continues to function with the core feature set. Paid-only surfaces show a calm "this feature is temporarily unavailable" state.
- **No crashes, no red banners, no exceptions surfaced** when plan lookup fails.

### Bootstrap during recovery cycles

- A user oscillating between deleted-workbook and re-bootstrap states should not pile up orphaned workbooks. Whether the app prompts to clean up previous workbooks during recovery, or simply leaves them in the user's Drive, is **Decision Pending**.

---

## 8. Backup and export philosophy

Design-level only. Exact implementation is Decision Pending.

### Principles

- **User-owned data should remain portable.** The user's workbook is already a Google Sheet in their own Drive (under the preferred deployment model); Google Sheets' built-in Download As (XLSX, CSV per tab, ODS, PDF) is the baseline export path.
- **Export must not depend on paid status.** Per `WORKING_RULES.md → Monetization Rules`, gating starts at the edges, not at the core. Data portability is core. A user must be able to take their data with them regardless of plan state.
- **Backups are design-level only for now.** The Central App does not commit to running scheduled backups, maintaining backup snapshots, or shadowing user workbooks to a developer-controlled store. If those features ever ship, they ship as opt-in.
- **The developer is not a backup service.** Under the preferred deployment model (`USER_ACCESSING`, user-owned spreadsheets), the developer cannot read user data through the script. A developer-side backup would require a separate trust model and is explicitly out of scope here.

### Open implementation details — Decision Pending

- Whether the app surfaces an in-app **Export** button (which would, under `USER_ACCESSING`, simply deep-link to the user's workbook with the standard Google Sheets export menu).
- Whether the app supports CSV export of specific structured data sets (e.g. all activity log entries for a tax year) as a convenience over the raw spreadsheet.
- Whether the app exposes a structured JSON export for users who want to take their data to another tool.

These are user-experience decisions, not architectural ones. They can be designed later without changing the deployment model.

---

## 9. Deletion, archive, and disconnect

The contract for ending or pausing a user's relationship with CashCompass.

### Disconnect ≠ delete

- A **Disconnect** action (per §5) clears the app's mapping for that user. It does **not** delete their workbook, modify their data, or revoke their OAuth grant on its own.
- The user's financial data remains in their Drive, fully under their control. They can keep it, export it, archive it, or delete it themselves.

### Account deletion

- "Account deletion" in the Central App context means: clear the mapping, clear any plan record (if monetization has shipped by then), and link out to Google Account settings for the user to revoke the OAuth grant.
- The app **does not** delete the user's workbook on account deletion. The workbook is the user's property in their Drive.
- The full account-deletion flow is **Decision Pending** — exact UI, exact data scrubbed, and whether a confirmation/grace period applies all need design.

### Spreadsheet deletion remains user-controlled

- Only the user can delete their workbook (it's in their Drive). The app never deletes a user's workbook under any circumstance — not on disconnect, not on account deletion, not on plan downgrade.
- If the user deletes the workbook themselves, the app falls into the "spreadsheet deleted" recovery scenario (§7).

### Monetization status must not destroy or corrupt data

- Downgrading from paid to free does not remove, modify, or restrict access to existing user data.
- Plan-lookup failure defaults to free (per `WORKING_RULES.md`); this means a transient failure never causes data loss because data isn't touched by plan state.
- The principle: **plan state controls features, not data**. Per `CENTRAL_APP_DESIGN.md → §8`: *"Gating controls features, UI, and actions — not raw spreadsheet ownership."*

### Archive

- "Archive" (a soft state between active and deleted) is **not** part of the lifecycle defined here. If a user wants to archive their work, they archive their workbook inside Google Drive themselves.
- Whether the app ever offers a "Pause CashCompass for a month" UX is a future product question, not a current architectural one.

---

## 10. Operational guardrails

Hard rules that govern every step of designing and implementing the Central App lifecycle. These mirror and extend the guardrails in `CENTRAL_APP_DESIGN.md → §9` and `WORKING_RULES.md → Central App Transition Rules`.

- **No implementation before lifecycle decisions are documented.** Every Decision Pending item in §11 must be resolved in writing before the corresponding code is written. The point of this document is to prevent improvisation during implementation.
- **Preserve bound-workbook compatibility.** Bound-sheet users must not regress at any point during the migration. Lifecycle design must work alongside bound mode, not replace it.
- **One module at a time.** Per `WORKING_RULES.md → Central App Transition Rules`, each migration pass converts a single backend module to use the resolver. The lifecycle contract is enforced module-by-module, not in a sweeping rewrite.
- **No broad refactors.** No "while we're in there" rewrites. Lifecycle work touches the resolver and the bootstrap path; it does not touch unrelated modules.
- **Test both modes on every pass.** Per `WORKING_RULES.md`, every migration pass validates (1) legacy bound-workbook still works byte-for-byte, and (2) new-user bootstrap creates a fresh workbook correctly and isolates per user.
- **No commit until runtime testing is confirmed.** Per `WORKING_RULES.md → Git — no autonomous staging or commits`: changes are not committed until the user has tested in the UI and explicitly asked for the commit. Documentation passes (like this one) follow the same rule — the contributor does not stage or commit on the user's behalf.
- **Develop through Cursor with clean boundaries.** Every pass is structured as: inspect → propose smallest design → implement → test in UI → user requests commit → commit and push. No skipping steps.

### Operational mindset

- **Continuity first, migration second.** Migrating the lifecycle is valuable. Keeping the app working for existing users is more valuable. When the two pull against each other, continuity wins. Mirror of `CENTRAL_APP_DESIGN.md → §11 Operational mindset`.
- **Stability and user trust outweigh migration speed.** There is no calendar pressure on this work. A smaller, safer step next month is preferable to a larger, riskier step next week.
- **A lifecycle pass is judged by what it preserves.** A successful lifecycle pass leaves bound-sheet users with the exact app they had yesterday, and gives central-app users a clearly defined first-run path. Both halves apply to every pass.

---

## 11. Open questions

Decision Pending checklist. Every item must be resolved (in writing) before the corresponding implementation work begins.

### Exact first-run UI — Decision Pending
- Layout, copy, and progression of the first-run flow (consent → workbook creation → Setup / Review).
- Whether the first-run UI is a dedicated wizard surface or reuses the existing Setup / Review.
- What is shown during bootstrap latency (creating the workbook is not instantaneous; loading-state design is undefined).
- Mobile-vs-desktop differences on first run.

### Spreadsheet creation location and folder — Decision Pending
- Where in the user's Drive the workbook is created (Drive root, a "CashCompass" folder, a folder picked by the user).
- File-name convention (e.g. `CashCompass Workbook`, `CashCompass — <user email>`, user-customizable).
- Default sharing settings on creation (likely: not shared with anyone; the user is the sole owner).
- Drive API surface and required OAuth scope to create the workbook under `USER_ACCESSING`.

### Mapping storage — Decision Pending
- `PropertiesService.getUserProperties()` vs central registry sheet (`SYS - User Workbooks`).
- Recovery semantics when the mapping points to a missing or inaccessible workbook.
- Whether a "secondary" mapping is allowed (e.g. for a user with two workbooks they alternate between) — likely no for v1; record explicitly.

### Reconnect / Relink flow — Decision Pending
- UI for selecting an existing workbook (Drive picker vs URL paste).
- Validation rules (see §4 — must contain at least one CashCompass tab, must not be below minimum schema version, etc.).
- Behavior when the user attempts to link a workbook already mapped to another user identity (likely not detectable under `USER_ACCESSING`; record the limitation).

### Migration validation rules — Decision Pending
- Minimum required tabs/columns for an existing workbook to qualify for linking without forced repair.
- Whether ambiguous structure (e.g. some tabs missing) should block linking or surface as warnings.
- How the user is informed about what additive repair will do before they confirm.

### Workbook versioning marker — Decision Pending
- Location (script property vs SYS sheet vs named range).
- Starting value and increment policy.
- Minimum-required-version contract.
- Behavior when workbook version is higher than running code expects.

### Backup / export implementation — Decision Pending
- Whether an in-app Export action exists (probably yes, deep-linked to Google Sheets export).
- Whether structured exports (CSV per dataset, JSON dump) are part of v1.
- Whether the app offers any backup affordance (snapshots, scheduled copies); design-level only for now.

### Revocation behavior — Decision Pending
- UI for user-initiated Disconnect.
- Detection of external OAuth revocation (the app cannot prevent it; detection on next request must be defined).
- Whether Disconnect prompts the user to also revoke at the Google Account level (recommended: yes, with a clear link-out).
- Account-deletion flow (separate from Disconnect; needs its own design).

### Support and admin visibility — Decision Pending
- Under `USER_ACCESSING`, the developer cannot read user data through the script. Support channels (user-shared exports, screen-share sessions, detailed user logs) must be defined.
- Whether the app surfaces a "Generate a support diagnostic" action that produces a structured, redacted snapshot for the user to share manually.
- Written policy on developer access to user data (regardless of what is technically possible).

### Feature gating during onboarding — Decision Pending
- Whether paid-only features are visible-but-locked during the first-run flow, or hidden until upgrade.
- How a free-tier user discovers paid features without being pressured during onboarding.
- Behavior when a user upgrades or downgrades mid-session.

### Bootstrap during recovery cycles — Decision Pending
- Whether the app prompts to clean up previous orphaned workbooks during recovery, or leaves them in the user's Drive untouched.
- How many recovery cycles are tolerated before the app suggests the user contact support.

---

End of document.
