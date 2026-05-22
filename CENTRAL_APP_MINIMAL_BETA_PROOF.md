# CENTRAL_APP_MINIMAL_BETA_PROOF.md

Design analysis for the **smallest possible Central App proof-of-concept** that would allow one external family beta user to run CashCompass against centralized code and a user-owned spreadsheet — without copying the Apps Script project into the user's workbook.

**Analysis/design only.** No Apps Script code, no HTML/JS, no deployment changes, no implementation. Implementation requires its own Cursor prompt with explicit user approval per `CENTRAL_APP_IMPLEMENTATION_PLAN.md → §9` and `CENTRAL_APP_DESIGN.md → §9 Guardrails`.

---

> **Status — REVISED. Manual developer-created beta workbook (original §5 Approach A) is REJECTED for family beta readiness.**
>
> By explicit product decision, the original recommendation — *developer pre-creates the beta workbook and the resolver hardcodes a one-user identity branch* (former §5 / §4.1 Approach A) — is **rejected as the family beta path**. The reasoning, captured in §5.bis below, is straightforward:
>
> - It does **not** validate the real onboarding experience. Family beta exists precisely to surface whatever breaks during a first-time user's first-run flow. Pre-creating the workbook skips that flow.
> - It does **not** scale even to friends and family. Each new beta user would require another manual developer-side setup step.
> - It creates unacceptable operational burden — the developer is on the hook for every workbook creation, every share grant, every recovery event.
> - It pushes the actual onboarding work outside the proof, so the proof teaches nothing about whether the onboarding works.
>
> Approach A may still be acceptable as an **internal platform spike** the developer runs against a second Google account for the explicit and narrow purpose of testing the `executeAs: USER_ACCESSING` deployment posture in isolation, **but not as the family beta readiness gate**.
>
> The revised recommendation in §5.bis is an **onboarding-first proof**: the family beta user must arrive at the central app URL with zero CashCompass infrastructure, authenticate, and watch the app create or initialize their own workbook through real bootstrap code paths. Approach D (Drive-API workbook creation on first run + per-user mapping store) is the new family beta direction.
>
> §10 is updated accordingly. The recommended next implementation work is **not** to ship Approach A. It is to run an analysis-only pass to audit the existing ensure-\* bootstrap coverage and identify what would still be missing for a real first-run flow.
>
> §1–§4 below are preserved for historical context (the candidate analysis is still valid; only the *pick* changes). §5, §6, §9, §10, and §11 are revised. §7 (deferred) and §8 (risks) are augmented with onboarding-first additions. §2 constraints remain in force.

Cross-references:
- `CENTRAL_APP_DESIGN.md` — migration architecture, abstraction point, guardrails.
- `CENTRAL_APP_DEPLOYMENT_OPTIONS.md` — preferred direction (Option B: `executeAs: USER_ACCESSING` + user-owned spreadsheets).
- `CENTRAL_APP_ONBOARDING_AND_LIFECYCLE.md` — lifecycle states, recovery semantics, additive bootstrap contract.
- `CENTRAL_APP_DEPENDENCY_AUDIT.md` — call-site inventory; remaining platform call sites that block a true central-mode flip.
- `CENTRAL_APP_IMPLEMENTATION_PLAN.md` — staged roadmap.
- `CENTRAL_APP_FAMILY_BETA_PLAN.md` — private family beta scope and posture.
- `CENTRAL_APP_FIRST_RESOLVER_SEAM.md` … `CENTRAL_APP_SIXTH_RESOLVER_SEAM.md` — per-phase resolver seam designs.

---

## 1. Purpose

This document defines the **first possible minimal central-mode experiment** for one trusted beta user — likely a family member already comfortable with the app — and assesses how close the codebase actually is to running that experiment today.

It exists because:

- The migration to date has produced six resolver seams, two fully resolver-routed modules, and a stable pass-through resolver. That is real architectural progress. But it does **not** yet demonstrate the end-to-end central flow: *external user opens a single URL, lands in their own workbook, runs the dashboard.*
- The remaining design docs (`CENTRAL_APP_DESIGN.md` / `_DEPLOYMENT_OPTIONS.md` / `_ONBOARDING_AND_LIFECYCLE.md`) describe the target state in detail, but leave many items as **Decision Pending**. A minimal proof is the right way to discover which Decision Pending items actually block the smallest credible experiment and which can stay deferred until much later.
- A successful minimal proof — even a small, ugly, manual one — converts the migration from "we have seams" to "we have an end-to-end flow working for one real user." That milestone is the right inflection for deciding whether to keep investing in resolver seams or pivot the implementation effort to the central-mode plumbing.

This document is **analysis only**. It does not authorize:

- a deployment-settings change,
- a switch to central mode for any user (including the developer),
- a `PropertiesService` write,
- introduction of `SpreadsheetApp.openById`,
- a Drive API call,
- any HTML change,
- any modification of the resolver body (which remains the one-line pass-through, unchanged since Phase 1 `b2798a7`).

---

## 2. Constraints

The minimal proof must honor every constraint that has governed Phases 1–6:

- **Preserve bound-workbook mode for the developer.** The developer's existing workbook continues to work byte-for-byte. The minimal proof does not change the developer's daily-use environment. Per `CENTRAL_APP_DESIGN.md → §6 Backward compatibility as a primary requirement`.
- **No broad rewrite.** No module is refactored to support the proof. No write-path migration. No `buildDashboardSnapshot_()` migration. No ensure-\* helper migration. Per `WORKING_RULES.md → Central App Transition Rules` (one module per pass) and `CENTRAL_APP_DESIGN.md → §9 Guardrails`.
- **Additive only.** Anything the proof needs that does not exist today is added; nothing existing is removed, renamed, or reformatted. The bootstrap contract from `CENTRAL_APP_ONBOARDING_AND_LIFECYCLE.md → §6` applies in full.
- **Rollback simplicity.** The proof must be revertible by a small, identifiable set of diffs (ideally a single deployment-settings toggle and an additive resolver code path). If the proof goes badly, the developer returns to today's posture without touching user data.
- **No monetization yet.** No `SYS - Users`, no `getUserPlan_`, no entitlement enforcement, no Bank Import gating. Per `CENTRAL_APP_DESIGN.md → §8` ("Monetization is meaningful only after Central App migration is in place"). The proof predates monetization by intent.
- **No public launch.** The beta user is one trusted person; the deployment URL is shared 1:1 in person. No Marketplace listing, no OAuth verification, no public scopes, no privacy-policy publication beyond what the beta user is told verbally. Per `CENTRAL_APP_FAMILY_BETA_PLAN.md`.
- **Identity resolution lives in one place.** If the proof needs to identify the caller, that lookup happens inside the resolver (or a single helper called by the resolver), not scattered across modules. Per `CENTRAL_APP_DESIGN.md → §3` ("Identity resolution lives in exactly one place").
- **No destructive sheet changes for the beta user.** Bootstrap may create the beta user's workbook fresh; it must not reformat, rename, or rewrite any sheet the beta user already has. Per `CENTRAL_APP_ONBOARDING_AND_LIFECYCLE.md → §6`.
- **No commit until tested.** Same discipline that has governed every prior phase: implement → user tests in the UI → user requests commit → commit and push. Per `WORKING_RULES.md → Git`.

---

## 3. Minimum viable proof definition (REVISED)

The smallest successful outcome that would count as a family beta proof, after the product decision rejecting the manual shortcut. **All** of the following must hold:

1. **Beta user opens a single URL.** A URL the developer shares with one trusted family member. Not a Marketplace listing. Not a publicly discoverable address.
2. **Beta user authenticates with Google.** Standard Google OAuth consent surface. Beta user grants the minimum scopes the deployment requires — including whatever Drive scope is needed to create their workbook. No invitation system, no separate sign-up form.
3. **The app creates or initializes the beta user's workbook automatically.** On first arrival with no mapping for the beta user, the app calls Drive (under user identity) and creates a fresh workbook in the user's Drive. The developer does **not** pre-create the workbook. The developer does **not** share a hand-curated workbook. The Apps Script project is **not** copied into the user's workbook. This is the defining property the product decision pins: the family beta validates real onboarding, not a curated stand-in.
4. **A per-user mapping survives across sessions.** After bootstrap, the mapping (likely `PropertiesService.getUserProperties()` key `cashCompassWorkbookId`) records the beta user's workbook ID. The next page load resolves the same workbook, not a new one. Refreshes do not bootstrap again.
5. **Additive ensure-\* helpers create canonical structure on demand.** As the beta user touches features (Setup / Review, Quick Add, Bills, Debts, etc.), the existing ensure-\* helpers create the canonical sheets and headers additively against the freshly created workbook. No new bootstrap content is invented for the proof.
6. **The dashboard loads against the freshly bootstrapped workbook with no red banners.** Overview renders. Every other tab opens with valid `state` semantics — empty surfaces show calm "no data yet" copy, not exceptions or broken layouts.
7. **The beta user can complete first writes end-to-end.** First Quick Add Payment, first Bill add, first Debt add, first Bank Account add — each exercises a different ensure-\* helper and completes against the user's own workbook with the activity log recording correctly.
8. **No Apps Script source is copied into the beta user's workbook.** The script lives in the central deployment only. The beta user never opens the Apps Script editor, never runs `clasp push`, never binds anything.
9. **Existing bound mode still works for the developer.** The developer continues using their existing bound deployment / editor without regression. The family beta deployment is a **separate deployment** from the developer's daily-use bound deployment per `CENTRAL_APP_FAMILY_BETA_PLAN.md → §5`.

The following deliberately remain out of scope even under the revised stance (they belong to later phases):

- No "connect existing workbook" flow. The first family beta user has no pre-existing CashCompass workbook to connect; the proof only exercises the create-fresh path. Per `CENTRAL_APP_ONBOARDING_AND_LIFECYCLE.md → §4`, the connect-existing path is a documented future option but is not required for the first family beta proof.
- No multi-user support. The proof is for one user.
- No monetization, no feature gating, no admin tooling, no public listing — see §7.
- No advanced support tooling beyond the basic recovery surfaces in §6.7.

This revised definition aligns with `CENTRAL_APP_FAMILY_BETA_PLAN.md → §2 Beta success definition` and `CENTRAL_APP_ONBOARDING_AND_LIFECYCLE.md → §3 New user onboarding`. The family beta proof does not violate the lifecycle contracts; it exercises the central path of each one.

---

## 4. Candidate architectural approaches

Five candidate shapes for the first experiment, ordered from most-manual to most-automatic. Each is evaluated on three axes: **smallest credible test scope**, **rollback simplicity**, and **distance from the Phase 1–6 resolver seam invariant**.

### 4.1 Approach A — Hardcoded one-user mapping in the resolver

- **Shape:** The resolver is extended to check if the caller is the one beta user. If yes, return `SpreadsheetApp.openById('<hardcoded-id>')`. Otherwise, return `SpreadsheetApp.getActiveSpreadsheet()` (the current pass-through behavior).
- **Mapping store:** none. The spreadsheet ID and the beta user's email are constants in the resolver source.
- **Bootstrap:** developer creates the beta user's workbook manually and shares it with the beta user.
- **Deployment:** the existing deployment is updated to `executeAs: USER_ACCESSING` for the proof window, with `access: ANYONE` (or `DOMAIN`, depending on the user's account) so the beta user can reach the URL.
- **Rollback:** one-line revert in the resolver + revert deployment settings.
- **Pros:**
  - Smallest possible code change. No new helpers, no new modules, no schema change.
  - Mapping is in source — visible in code review.
  - Branching on `Session.getEffectiveUser().getEmail()` is contained to one function.
  - Resolver body still acts as a pass-through for everyone except the one hardcoded beta user.
- **Cons:**
  - Hardcoded credentials-adjacent values (email + spreadsheet ID) live in source. Acceptable for the developer-and-one-family-member context per `codeguard-1-hardcoded-credentials` (spreadsheet IDs are not secrets, but they should not stay in source after the proof).
  - No path to more than one beta user without another code change.
  - Identity check inside the resolver pulls `Session.getEffectiveUser()` for the first time in the codebase. That call is new architectural surface.
  - Forces the deployment-settings change to ship at the same time as a code change. Two-variable rollback.
- **Verdict (original):** ~~Strong candidate. Smallest credible scope. Best fit for the "one trusted family member" criterion.~~
- **Verdict (REVISED):** **REJECTED for family beta readiness.** Acceptable only as an internal platform spike the developer runs against a second Google account to test the deployment posture in isolation. Does not validate real onboarding, does not scale, and forces ongoing manual operational burden. See top-of-document banner and §5.bis.

### 4.2 Approach B — Manual mapping in a developer-owned `SYS - User Workbooks` sheet

- **Shape:** Resolver reads a small admin spreadsheet (`SYS - User Workbooks`, owned by the developer) that has rows like `<email>` → `<spreadsheet-id>`. Beta user is added by appending one row by hand.
- **Mapping store:** central registry sheet in a developer-owned admin spreadsheet.
- **Bootstrap:** developer creates the beta user's workbook manually; appends a row.
- **Deployment:** same as Approach A.
- **Rollback:** clear the admin spreadsheet + revert deployment settings + revert resolver.
- **Pros:**
  - Mapping store is editable without a deploy. Adding a second beta user later is a row append, not a code push.
  - Establishes the central-registry pattern early. Aligns with `CENTRAL_APP_DESIGN.md → §4` ("alternative: a central registry sheet").
- **Cons:**
  - Requires the admin spreadsheet to be **readable by the beta user** under `USER_ACCESSING` — which leaks every other beta user's email and spreadsheet ID. Per `CENTRAL_APP_DEPLOYMENT_OPTIONS.md → §3` ("admin spreadsheet shared with all users — fragile, leaks plan data").
  - The bridge / library / signed-token plumbing that resolves this leak is out of scope for a minimal proof. Pulling it forward inflates the scope dramatically.
  - More moving parts than necessary for one user.
- **Verdict:** Defer. The central-registry pattern is a real future option, but it does not belong in the minimal proof because the privacy-correct implementation requires a bridge/library, which is itself a separate experiment.

### 4.3 Approach C — `PropertiesService.getUserProperties()` mapping with manual seed

- **Shape:** Resolver reads `cashCompassWorkbookId` from `UserProperties`. If present, opens that workbook. If absent, falls back to `SpreadsheetApp.getActiveSpreadsheet()` (pass-through). For the proof, the developer manually seeds the beta user's `UserProperties` by having them run a one-off helper (or by running it on their behalf — though under `USER_ACCESSING` only the user themselves can write their own `UserProperties`).
- **Mapping store:** `PropertiesService.getUserProperties()` per `CENTRAL_APP_DESIGN.md → §4` likely first approach.
- **Bootstrap:** developer creates the workbook in advance and shares it; beta user runs a "Link my workbook" helper that writes `cashCompassWorkbookId`.
- **Deployment:** same as Approach A.
- **Rollback:** beta user clears the property (or the developer ships a one-off "Unlink" helper); revert deployment + resolver.
- **Pros:**
  - Matches the documented preferred mapping store from `CENTRAL_APP_DESIGN.md → §4`.
  - Per-user mapping; no admin spreadsheet leak.
  - The "Link" helper exercises a tiny slice of the eventual bootstrap path.
- **Cons:**
  - Requires a "Link" helper UI surface (or a Script Editor invocation) that the beta user must run. That is more friction than the developer pre-sharing a workbook.
  - Introduces `PropertiesService` to the codebase for the first time in this domain. Outside the constraint set of the proof.
  - The beta user has to do something other than click the URL on first run. That breaks the §3 success criterion ("Beta user opens a single URL → dashboard loads").
- **Verdict:** Strong candidate **for the second experiment**, not the first. The minimal proof should not require the beta user to run a manual link step before reaching the dashboard.

### 4.4 Approach D — Drive-API workbook creation on first run (true bootstrap)

- **Shape:** Resolver detects "no mapping for this user yet," calls Drive API under the user's identity to create a fresh workbook, writes the mapping, and returns the new workbook.
- **Mapping store:** `PropertiesService.getUserProperties()` (or central registry).
- **Bootstrap:** automatic, on first request.
- **Deployment:** `executeAs: USER_ACCESSING`, plus Drive scope requested at OAuth consent.
- **Rollback:** complex. If the proof fails mid-bootstrap, the orphaned workbook is in the user's Drive.
- **Pros:**
  - This is the actual target state of `CENTRAL_APP_ONBOARDING_AND_LIFECYCLE.md → §3`.
- **Cons:**
  - Significant surface area. Adds: Drive API integration, scope-discipline decision, folder placement decision, filename decision, partial-bootstrap recovery, consent denial handling.
  - Almost every Decision Pending item from the lifecycle doc has to be resolved before this approach can ship.
  - Higher rollback cost than any of A / B / C.
- **Verdict (original):** ~~Out of scope for the minimal proof. This is the second-or-third experiment after the minimal proof confirms the end-to-end shape works.~~
- **Verdict (REVISED):** **RECOMMENDED for family beta readiness.** The added surface area is exactly what family beta needs to validate. Skipping it produces a proof that teaches nothing about real first-run behavior, which is precisely the failure mode the user's product decision rejects. The Decision Pending items below (§5.bis) must be answered before any Approach D implementation prompt — those decisions are the substance of the proof, not preconditions to it. See §5.bis for the proof shape and §6 for the layered implementation roadmap.

### 4.5 Approach E — Don't ship code; manually verify "in principle"

- **Shape:** Developer mentally simulates the central-app flow and concludes that the architecture is sound, without running any user-facing experiment.
- **Verdict:** Rejected. The whole point of a *proof* is to discover what the design docs missed. A paper exercise restates what the design docs already say.

---

## 5. Recommended first experiment (RETRACTED)

> **RETRACTED.** The original recommendation in this section selected Approach A — hardcoded one-user mapping in the resolver, with the developer pre-creating the beta workbook. That recommendation is rejected for family beta readiness by explicit product decision. See §5.bis for the active recommendation. The original analysis is preserved below for the audit trail and to keep the trade-off visible.

### Original recommendation (no longer in force)

The original §5 selected **Approach A — Hardcoded one-user mapping in the resolver.** The reasoning was:

- Smallest credible code change (one resolver branch).
- Smallest deployment toggle.
- One-line reversible per change.
- Preserves the developer's bound experience.

### Why the original recommendation is rejected

The original recommendation optimized for *smallest diff*. Family beta optimizes for *real onboarding fidelity*. Those goals are in direct conflict, and the product decision is that fidelity wins:

- **Approach A does not validate first-run flow.** The defining purpose of family beta is to surface whatever breaks during a first-time user's first-run flow. A hand-created beta workbook is a steady-state setup, not a first-run flow. Approach A could pass cleanly while the actual onboarding the next user hits remains entirely unproven.
- **Approach A does not scale even to friends and family.** Every additional beta user requires another developer-side workbook creation, another share grant, another resolver code edit (under Approach A's hardcoded model), and a redeploy. That is operationally untenable for even five users.
- **Approach A pushes onboarding work outside the proof.** The Drive-API integration, scope-discipline decision, folder placement, filename convention, partial-bootstrap recovery, consent denial handling — all the items that genuinely *can* break for a real user — sit outside the experiment. A passing Approach A proof gives the team no information about any of them.
- **Approach A puts the developer in the support critical path.** Every workbook creation, every share grant, every "I can't access my workbook" recovery event becomes a developer task. The product can't move forward under that operational model.

### Where Approach A is still acceptable

Approach A may be appropriate as an **internal platform spike** — a narrow, time-boxed test the developer runs against their own second Google account, for the sole purpose of confirming that `executeAs: USER_ACCESSING` deployments behave the way the design docs assume. Specifically:

- It can confirm the new deployment posture loads at all.
- It can confirm the Phase 1–6 resolver seams route correctly under `USER_ACCESSING`.
- It can surface what the 129 remaining direct `SpreadsheetApp.getActiveSpreadsheet()` call sites do under the new posture.

Used in that narrow scope, Approach A is a **deployment posture test**, not a family beta readiness test. The platform spike does not constitute family beta readiness and does not authorize inviting an external user. If the spike runs and produces clean results, the team still needs the §5.bis proof before any family beta user is invited.

---

## 5.bis Revised recommendation — onboarding-first proof (ACTIVE)

**The family beta proof must validate the real onboarding flow end-to-end.** The recommended shape is **Approach D — Drive-API workbook creation on first run + per-user mapping store**, scoped to one family beta user.

This is intentionally larger than Approach A. It is the smallest credible shape that demonstrates a real user can become a CashCompass user without the developer touching their workbook or their machine.

### What the family beta proof actually does

1. **Beta user opens the central app URL.** Single deployment URL, shared 1:1 with the beta user, not publicly listed.
2. **Beta user authenticates with Google.** Standard OAuth consent surface. The deployment requests the **minimum** scopes required for the first-run flow: a Sheets scope for read/write of the user's own workbook, and a Drive scope sufficient to create one new file in the user's Drive. Specific scope set is **Decision Pending** for the implementation prompt.
3. **Resolver detects no mapping.** Inside `getUserSpreadsheet_()`, after the resolver reads the caller's identity, it checks the per-user mapping store. For a first-time user, no mapping exists. The resolver hands off to a bootstrap helper (see §6).
4. **Bootstrap creates a workbook in the user's own Drive.** Drive API is called under the user's identity (`executeAs: USER_ACCESSING`). The workbook is created in the user's Drive (location and filename are **Decision Pending**). The mapping is written to the per-user mapping store as soon as the workbook exists.
5. **Additive ensure-\* helpers run against the fresh workbook.** The existing `ensureOnboardingBankAccountsSheetFromDashboard`, `ensureOnboardingBillsSheetFromDashboard`, `ensureOnboardingDebtsSheetFromDashboard`, `ensureSysAccountsSheet_`, etc., create the canonical structure lazily as features touch it — same contract as bound mode today. **No new bootstrap code is invented for the proof.** Whatever ensure-\* coverage exists is what runs.
6. **Beta user lands on Setup / Review (already delivered).** Read-only walkthrough of the input areas. The user understands what the app expects them to enter.
7. **Beta user reaches the dashboard.** Overview renders. All other tabs (Bills, Cash Flow, Planning, Assets, Activity) open without red banners against the freshly bootstrapped workbook. The `state` field correctly identifies "notSetUp" surfaces.
8. **Beta user adds first real data.** The first Quick Add Payment, first Bill add, first Debt add, first Bank Account add all complete end-to-end. Each one exercises a different ensure-\* helper. The activity log records each entry.
9. **No Apps Script source is in the beta user's workbook.** The script lives in the central deployment only. The beta user never sees the Apps Script editor.
10. **Developer's bound experience is unchanged.** Per §2 constraint set, the developer continues to use their existing bound deployment. The beta proof runs on a separate Apps Script deployment, not the developer's daily-use deployment.

### Why this is the right family beta proof

- **It validates the real product path.** Every step the next non-developer user will take is exercised. Whatever breaks for the beta user breaks for the next user; whatever works, works.
- **It exercises the actual onboarding code.** Drive API call, mapping write, ensure-\* helper chain, blank-workbook resilience, Setup / Review handoff — all live code paths, not pre-curated state.
- **It produces a meaningful "is this product real?" signal.** A passing proof means CashCompass can take a brand-new user through onboarding without the developer in the loop. That is the difference between "we have a developer tool" and "we have a product."
- **It surfaces operational issues early, not at scale.** Drive quota failures, consent denials, partial-bootstrap recovery, scope-discipline mistakes — all of these appear during the one-user proof, when the developer can iterate on them in real time. They do *not* appear after five users are stuck.
- **It is still a private beta.** One user, URL shared out of band, no public discovery, no monetization, no marketplace. The fidelity gain does not require launching publicly.

### What the family beta proof must measure

- **Does the entire first-run flow work end-to-end, hands-off?** From URL click to dashboard render, with zero developer intervention. This is the critical pass/fail.
- **Are all required sheets created additively as the user touches features?** Specifically: when the user opens Bank Accounts → Add new for the first time, does the ensure-helper chain create `INPUT - Bank Accounts`, `SYS - Accounts`, the canonical year block, and the LOG sheet — all without throwing? Each ensure-\* helper exercised in real-world conditions counts as a separate observation.
- **Does the user-to-workbook mapping survive a refresh?** The next page load must find the same workbook, not bootstrap a new one. This is the test that `PropertiesService` (or the chosen mapping store) is actually working.
- **What happens under each recovery scenario?** (a) User denies OAuth scope. (b) Drive quota is exhausted. (c) User accidentally deletes the workbook from their Drive between sessions. (d) Bootstrap is interrupted mid-flow. Each scenario must produce a calm, recoverable surface.
- **How long does first-run feel?** Drive workbook creation is not instant. The bootstrap latency, observed end-to-end, sets the bar for what loading-state UX must cover.

### Why this is bigger than Approach A — and why that is the right size

Approach D is unambiguously more work than Approach A. It introduces Drive API, the mapping store, and the bootstrap orchestration in one experiment. The product decision is that the additional work is the *point* of the experiment — not a cost paid to reach it.

The §6 "Required future implementation layers" section is updated accordingly: layers the original §5 deferred (mapping store, Drive-API workbook creation, first-run UI, partial-bootstrap recovery) are now in scope for the family beta proof. Layers that remain out of scope are listed in §7.

---

## 6. Required future implementation layers

The onboarding-first proof in §5.bis requires substantial additive scaffolding. The list below is intentionally complete: it is the floor of what must exist before the family beta proof can run end-to-end. Each layer is its own implementation prompt (or small group of prompts); none is implemented yet.

### 6.1 Spreadsheet resolution
- **Already exists (additively):** `getUserSpreadsheet_()` in `central_resolver.js`. Used by six call sites. Resolver body is the one-line pass-through, unchanged since Phase 1 `b2798a7`.
- **Required for the family beta proof:** a generalized resolution path inside `getUserSpreadsheet_()`. On bound deployments the resolver continues to pass through to `SpreadsheetApp.getActiveSpreadsheet()`. On the central deployment, the resolver consults the per-user mapping store; if no mapping exists, it invokes bootstrap (6.3); if a mapping exists, it opens the workbook by ID and returns it. The bound-mode path remains the default for the developer's deployment.
- **Decision Pending:** whether the resolver detects "central mode" by deployment ID, by `Session.getEffectiveUser()` shape, by an `appsscript.json` flag, or by an environment-style script property. The detection mechanism must be one of these — not multiple — to keep identity logic concentrated.

### 6.2 User-to-workbook mapping store
- **Required for the family beta proof.** This is a new layer with no current code.
- **Preferred mechanism:** `PropertiesService.getUserProperties()`, key `cashCompassWorkbookId`, value = spreadsheet ID. Per-user, naturally scoped, no admin-spreadsheet leak. Documented as the likely first approach in `CENTRAL_APP_DESIGN.md → §4` and `CENTRAL_APP_ONBOARDING_AND_LIFECYCLE.md → §5`.
- **Decision Pending:** confirmation of `PropertiesService.getUserProperties()` over the central-registry alternative. The trade-off is recorded in `CENTRAL_APP_DEPLOYMENT_OPTIONS.md → §3` (central registry leaks plan/identity data under `USER_ACCESSING` unless a bridge or library is involved — which is itself a much larger scope).
- **Decision Pending:** recovery semantics when the mapping points to a deleted or inaccessible workbook. Three options sketched in `CENTRAL_APP_ONBOARDING_AND_LIFECYCLE.md → §7` ("Spreadsheet deleted" — create new / link existing / cancel). One must be picked for the family beta proof; the other two can be deferred.

### 6.3 Spreadsheet bootstrap (Drive-API workbook creation)
- **Required for the family beta proof.** Largest single new layer.
- **What it must do:** under `executeAs: USER_ACCESSING`, call the Drive API (or `SpreadsheetApp.create()` if its semantics suffice under user identity) to create a fresh workbook in the user's Drive. Write the spreadsheet ID into the mapping store before returning. Surface a calm loading state during creation (latency is not instant).
- **Decision Pending:** Drive API surface vs `SpreadsheetApp.create()`. Both are options under user identity; the Drive API path is more flexible (folder placement, sharing defaults) but requires Drive scope and more setup.
- **Decision Pending:** where in the user's Drive the workbook lives (Drive root, a dedicated "CashCompass" folder, user-chosen). Per `CENTRAL_APP_ONBOARDING_AND_LIFECYCLE.md → §11`.
- **Decision Pending:** filename convention (`CashCompass Workbook`, `CashCompass — <email>`, user-customizable).
- **Decision Pending:** default sharing on creation (likely: not shared with anyone; the user is the sole owner).
- **Failure handling required:** Drive quota exhausted, scope denied, transient Drive API error, mapping write failure after creation. Each must produce a recoverable surface, not a red banner.

### 6.4 Additive ensure-\* helper chain on a fresh workbook
- **Already exists (largely).** This is the project's most valuable existing asset for the central app proof. Phases of CashCompass have already shipped: `ensureOnboardingBankAccountsSheetFromDashboard`, `ensureOnboardingBillsSheetFromDashboard`, `ensureOnboardingDebtsSheetFromDashboard`, `ensureSysAccountsSheet_`, the Cash Flow year-sheet stylers, and many more. Each first-write surface defensively creates the sheet it needs.
- **Required for the family beta proof:** confidence that the ensure-\* coverage is *complete enough* that a freshly bootstrapped workbook reaches Setup / Review and the dashboard without a red banner, and that every core flow in `CENTRAL_APP_FAMILY_BETA_PLAN.md → §4` can complete its first write without exception.
- **Unknown:** whether the existing ensure-\* coverage is in fact complete. This is the **recommended next analysis pass** — see §10.
- **No new ensure-\* helpers should be invented for the proof.** If the audit (§10) surfaces a gap, that gap is its own implementation prompt under the existing ensure-\* pattern, not part of the proof itself.

### 6.5 Deployment / auth settings
- **Required for the family beta proof.** Separate deployment from the developer's bound deployment.
- **What it must do:** stand up an Apps Script web app deployment with `executeAs: USER_ACCESSING` and an `access:` scope sufficient for the beta user to reach the URL (likely `ANYONE_WITH_GOOGLE`, possibly `DOMAIN` if developer and beta user share a Workspace domain). The bound developer deployment is untouched.
- **Decision Pending:** OAuth scope list — minimum required for first-run (Sheets + Drive create), plus whatever the existing app already requires. Scope discipline matters because every additional scope is something the beta user must consent to.
- **Decision Pending:** whether the proof deployment is a copy of the production script project or the same project with a second deployment. The "same project, two deployments" path is simpler and is the preferred direction unless something blocks it.

### 6.6 First-run UI
- **Already exists (partial):** Setup / Review (`Dashboard_Script_Onboarding.html`) is delivered and is the natural landing surface once the workbook exists.
- **Required for the family beta proof:** a calm "creating your CashCompass workbook…" intermediate surface displayed during bootstrap latency. Either a dedicated loading screen, or a Setup / Review pre-state. **Decision Pending** which.
- **Required:** OAuth consent surface (controlled by Google, not by the app) plus a clear "this is what we need access to" plain-language note before the user clicks consent. The note's wording is **Decision Pending** for the implementation prompt.

### 6.7 Basic failure handling
- **Already exists (philosophy):** every read path returns a `state` field; ensure-\* helpers are idempotent; no red banners. Per `CENTRAL_APP_DESIGN.md → §2`.
- **Required for the family beta proof:** wire structured user-facing surfaces for the four critical first-run failures — (a) OAuth scope denied, (b) Drive quota exhausted, (c) Drive API transient error, (d) mapping read succeeded but workbook is gone. Each produces a calm message and a clear next action per `CENTRAL_APP_ONBOARDING_AND_LIFECYCLE.md → §7`.
- **Decision Pending:** wording for each surface (the design doc describes the response semantics; the actual user-visible copy is not yet written).

### 6.8 Fallback / rollback
- **Required for the family beta proof:** a documented rollback procedure before the deployment goes live to the beta user. At minimum: (a) revert the deployment to its prior posture (or take down the central deployment URL), (b) ensure the developer's bound deployment is untouched so the developer continues working, (c) define what happens to the beta user's already-created workbook (the user keeps it in their Drive — the script no longer touches it).
- **Required:** a known-good fallback path for the beta user if the central deployment breaks during the proof — "you can keep using the workbook in your Drive directly, even without CashCompass" is the minimum truthful statement, and is true under the user-owned model.

### Layered implementation order

The §6 layers are not all built in a single pass. The recommended sequence (subject to its own per-layer implementation prompts) is:

1. **§10 audit pass (next step).** Identify ensure-\* coverage gaps and decisions to pin before any code is written.
2. **§6.5 — Stand up the proof deployment** (`USER_ACCESSING`, restricted access) as a separate deployment from the developer's bound deployment. Confirm the deployment loads against the developer's own second Google account. This is the internal platform spike (former Approach A scope) used as a deployment-posture smoke test, not as the family beta gate.
3. **§6.2 — Add the per-user mapping store** with a "no mapping → return null" stub. Confirm reads under `USER_ACCESSING`.
4. **§6.3 — Add the bootstrap helper** that creates the workbook in the user's Drive and writes the mapping. Confirm against the developer's second Google account first.
5. **§6.4 — Confirm the ensure-\* chain** carries the freshly bootstrapped workbook all the way to the dashboard, against the developer's second Google account. Iterate on any audit gaps surfaced in step 1.
6. **§6.6 / §6.7 — Wire the first-run loading UX and recovery surfaces.** Confirm each recovery state against the developer's second Google account.
7. **§6.8 — Document the rollback procedure.** Verify the developer's bound deployment is unaffected.
8. **Family beta proof itself.** Invite the family beta user. Per `CENTRAL_APP_FAMILY_BETA_PLAN.md → §5`.

Each step is its own implementation prompt. The audit in step 1 is the next implementation-or-analysis pass; nothing past step 1 is authorized until the audit completes.

---

## 7. What should remain deferred

The list of things that absolutely should **not** be in the minimal proof, even if they are technically possible. Pulling any of these forward inflates the proof beyond "minimal" and breaks the §2 constraint set.

### Hard-deferred (not in this proof, not in the next experiment either)

- **Monetization.** No `SYS - Users`, no `getUserPlan_`, no `isPaidUser_`, no Bank Import gating, no payment provider, no entitlement enforcement. Per `CENTRAL_APP_DESIGN.md → §8` ordering ("Central App migration lands → SYS - Users schema → first gated feature").
- **Feature gating.** Same reason. The beta user gets the full feature surface (modulo Bank Import being hidden, which is already the default for family beta per `CENTRAL_APP_FAMILY_BETA_PLAN.md → §10`).
- **Public onboarding.** No sign-up form, no waitlist, no public URL. The beta user receives the URL out of band.
- **Marketplace distribution.** No Workspace Marketplace listing, no public discovery, no verified OAuth.
- **Billing.** No payment surface anywhere.
- **Advanced permissions / admin tooling.** No admin dashboard, no support console, no user lookup. The "admin tool" is the developer's text-edit access to the resolver.
- **Large-scale migration of existing users.** No "connect existing workbook" wizard for the family or anyone else. The minimal proof is *one* user with *one* pre-shared workbook.
- **Full write-path migration.** Per `CENTRAL_APP_IMPLEMENTATION_PLAN.md → §5 steps 4–5`. Quick Add Payment writes, planner output writes, Bills/Debts/Assets/Property writes — all stay on the platform call. The minimal proof works because writes go to whichever spreadsheet the platform routes them to, which in this case is the beta workbook (the only workbook the beta user's session sees under `USER_ACCESSING`).

### In scope for the family beta proof (no longer "soft-deferred")

The product decision moves the following items into the proof itself. They are listed here so the §7 deferred boundary is unambiguous:

- **`PropertiesService` mapping store** (formerly Approach C). Required — §6.2.
- **Drive API workbook creation on first run** (formerly Approach D). Required — §6.3.
- **First-run UX (loading state during bootstrap + post-bootstrap landing on Setup / Review).** Required — §6.6.
- **Recovery surfaces for the four critical first-run failures** (scope denied, Drive quota, transient Drive error, missing-workbook recovery). Required — §6.7.

### Still soft-deferred (not in this proof)

- **Multi-user support.** Family beta proof is one user. The mapping store is per-user from day one, so adding more users later is a coordination problem, not an architectural one — but it is explicitly not part of the first proof.
- **"Connect existing workbook" flow.** The first beta user has no pre-existing CashCompass workbook to connect; the proof exercises only the create-fresh path. The connect-existing path is documented in `CENTRAL_APP_ONBOARDING_AND_LIFECYCLE.md → §4` for later phases.
- **Bound-mode → central-mode migration helper.** For the developer themselves, plus any family member who already has a bound copy. The first family beta proof side-steps this because the beta user has no bound copy.
- **Advanced recovery flows beyond the four critical first-run failures.** Examples: a user moving the workbook to a Shared Drive, a user accidentally re-running the bootstrap and producing two workbooks. Designed in `CENTRAL_APP_ONBOARDING_AND_LIFECYCLE.md → §7`; out of scope for the first proof.
- **Verified OAuth / Workspace Marketplace publication.** Required only when the deployment is broadened beyond the immediate family. Out of scope here.

---

## 8. Risks

The minimal proof's risks ordered by likelihood × impact. Each risk has a defined response so the proof can ship without surprise.

### 8.1 Deployment / auth complexity (likely × moderate)

- `executeAs: USER_ACCESSING` has not been used by this deployment before. The flip from `USER_DEPLOYING` could surface platform behaviors that don't show up in `executeAs: USER_DEPLOYING` (e.g., quota behavior, missing scopes, different time zone resolution).
- Once `access:` is widened from `MYSELF`, Google may prompt for OAuth verification depending on which scopes are requested.
- **Response:** test the deployment change on a *separate Apps Script project* first if practical (a "throwaway" copy used only for this experiment). The current bound deployment is not touched until the throwaway has demonstrated the auth flow works. Acceptable to do this experiment on the production deployment if the developer and beta user can coordinate a small maintenance window.

### 8.2 Spreadsheet permission edge cases (likely × moderate)

- If the beta workbook is developer-owned and shared with the beta user, the beta user's `SpreadsheetApp.openById(beta-workbook-id)` call may behave subtly differently from "I own this" (cache freshness, ownership-only operations, etc.).
- If the beta workbook is transferred to the beta user, the developer can no longer read it without re-sharing — which means support debugging requires the beta user to re-share temporarily.
- **Response:** start with developer-owned + shared. If permission edge cases surface, evaluate ownership transfer as a second step. Document the chosen path in the implementation prompt.

### 8.3 Apps Script execution quirks (moderate × moderate)

- `SpreadsheetApp.getActiveSpreadsheet()` under `USER_ACCESSING` with no bound spreadsheet may return `null` or throw. Every module that still calls it directly (129 sites post-Phase 6) could behave differently than expected.
- The dashboard snapshot wrapper (`buildDashboardSnapshot_` at `dashboard_data.js:73`) is the highest-stakes example — it is the entry point most users would hit first.
- **Response:** this is the **single largest known risk** of the proof and is precisely why the proof is worth running. If the `getActiveSpreadsheet()` call sites break under the new posture, the implementation team learns *immediately* what blocks central mode at the platform layer. That information is more valuable than additional resolver seams. If breakage occurs, fall back to the developer-only bound deployment (rollback is one toggle).

### 8.4 Onboarding confusion (moderate × low)

- The beta user is a family member, but they are not the developer. They may click "deny" on OAuth consent, may not understand the scope prompt, or may end up on a different Google account than expected.
- **Response:** the developer walks the beta user through the proof in person or on a call. The proof is not designed for self-service.

### 8.5 Latency / performance regression (moderate × low)

- Cold-start under `USER_ACCESSING` is unknown. The dashboard already cold-starts in the 1–4 second range under `USER_DEPLOYING`; the new posture could be slower.
- **Response:** measure. The Phase 4 cold-start investigation pattern applies (`CENTRAL_APP_DASHBOARD_SEAM_ANALYSIS.md → §11.4`). If first render is noticeably slower than the developer's bound experience, accept it as a known-cost data point; do not block the proof on this.

### 8.6 Partial bootstrap state (low × low)

- The beta workbook is hand-curated, so partial bootstrap is unlikely. But it's possible the developer forgets a sheet, and the beta user's first-render shows a "no data yet" surface for a feature they expected to see.
- **Response:** the developer creates the beta workbook using either: (a) a copy of the developer's reference workbook, structurally cleaned but with no personal data (Option A from `CENTRAL_APP_DESIGN.md → §5`), or (b) a fresh empty workbook that lets the existing ensure-\* helpers create structure on first read (Option B). Choice is a Decision Pending for the implementation prompt.

### 8.7 Support / debug visibility (low × low for the family beta context)

- Under `USER_ACCESSING`, the developer cannot read the beta user's `Logger.log` output unless the beta user shares it. For a family member, this is fine — the developer can ask.
- **Response:** explicit during the proof. The beta user agrees to share screenshots / verbal observations.

### 8.8 Inflight Phase 7+ resolver seams (low × low)

- The migration was about to continue with Phase 7 (Candidate B from `CENTRAL_APP_SIXTH_RESOLVER_SEAM.md → §8`). The minimal proof is orthogonal — it does not block future resolver seams, and future resolver seams do not block the proof.
- **Response:** the proof can land in parallel with continued resolver seams. They are independent workstreams. The decision about which to prioritize is the §10 question, not a sequencing risk.

---

## 9. Readiness assessment

Where the codebase actually stands today, against what the minimal proof requires.

### 9.1 What already exists today

- **Resolver function** (`getUserSpreadsheet_()` in `central_resolver.js`). Already deployed, already exercised by six call sites across five modules (post-Phase 6). Resolver body is the one-line pass-through, unchanged since Phase 1 `b2798a7`.
- **Resolver-routed entry points.** Five distinct read paths route through the resolver: Overview cash-to-use card, Quick Add UI data, Debt Overview, Bills Due debt-payment breakdown, Property Performance (incl. now `getHouseNamesFromHouseAssets_` inside the same module). These will route correctly to the beta user's workbook under the minimal proof.
- **Two fully resolver-routed modules.** `debt_payoff_projection.js` (Phase 3) and `property_performance.js` (Phase 6). Both have zero residual `SpreadsheetApp.getActiveSpreadsheet()` calls.
- **Blank-workbook resilience across the dashboard.** Every read path returns a `state` field or an empty envelope. The beta workbook can be wholly empty without producing red banners. This is the single most important pre-existing property of the minimal proof — it means the beta user can run against an empty workbook without the dashboard appearing broken.
- **Additive ensure-\* helpers.** Every first-write surface defensively creates the sheet it needs. Quick Add, debt seeding, bills, accounts — all of them work additively against an empty workbook. The beta user can add their first row without setup.
- **Setup / Review (read-only walkthrough).** Already shipped per `PROJECT_CONTEXT.md`. Available to the beta user as the natural onboarding surface even though the proof does not require it.
- **Pass-through resolver as the proof's safe default.** Anything the minimal proof does *not* explicitly handle continues to fall through `getUserSpreadsheet_()` to `SpreadsheetApp.getActiveSpreadsheet()`, which is exactly the behavior that already exists today.

### 9.2 What is still missing

- **Identity branch in the resolver.** Approximately 4–8 lines of code (depending on style): `const email = Session.getEffectiveUser().getEmail();` plus a hardcoded `if (email === BETA_USER_EMAIL) return SpreadsheetApp.openById(BETA_WORKBOOK_ID);`. Minimal but new.
- **Deployment-settings change.** `executeAs: USER_DEPLOYING` → `executeAs: USER_ACCESSING`, `access: MYSELF` → `access: ANYONE_WITH_GOOGLE` (or `DOMAIN`). One change in `appsscript.json` (or the Apps Script deployment UI).
- **The beta workbook itself.** Has to be created and shared by the developer before the proof runs.
- **A written rollback procedure.** Sentence-level. Documented in the implementation prompt.
- **A `Logger.log` smoke trace.** Useful but not blocking — the resolver branch should log the resolved email and the resolved workbook ID for the first run so the developer can debug from the Apps Script execution log after the beta user's first session.

### 9.3 What is not missing but is fragile

- **The 129 remaining direct `SpreadsheetApp.getActiveSpreadsheet()` call sites.** These will execute under `USER_ACCESSING` for the first time during the proof. Their behavior is unknown and is the proof's main risk surface (per §8.3). Not a blocker — but the proof's *result* may surface a list of "modules that need a resolver seam before the central flow is usable end-to-end."

### 9.4 Rough distance from first trusted family beta

**Days, not weeks, of focused implementation work** — provided the Decision Pending items for the implementation prompt (ownership model, `access:` value, rollback procedure) are decided up front.

Concretely:

- **~1 day:** finalize the implementation prompt — pin ownership model, pin `access:` value, write rollback procedure, write smoke-test checklist.
- **~½ day:** implement the resolver branch + log statements.
- **~½ day:** create the beta workbook, share it, walk through the OAuth consent flow with a developer-side test account (a second Google account) before involving the beta user.
- **~½ day:** flip the deployment settings, smoke-test with the developer-side test account, document any platform surprises.
- **~½ day:** run the proof with the actual beta user. Capture observations. Either ship or rollback.

Total: **~3 days of work spread across however long it takes to get the family member in front of a screen with the developer.** Most of the calendar time is coordination, not implementation.

The codebase itself is closer to ready than the design docs suggest — Phases 1–6 have done the foundational work. The remaining 129 direct call sites do not block the *minimal* proof because the proof works on a fresh workbook where everything is resolver-routed-or-irrelevant.

---

## 10. Recommended next implementation category

The original §10 recommended pivoting to a small Approach A experiment. That recommendation is retracted along with §5. The revised next step is **analysis-only**, not implementation.

### 10.1 Options reviewed

- **More resolver seams** (e.g., Phase 7 against `nextActionsPickRollingDebtTarget_`). Still safe to ship in parallel with the next analysis pass; no longer the primary work, but no longer blocked either.
- **Approach A platform spike** (former §5 recommendation). Acceptable only as a deployment-posture smoke test against the developer's second Google account; explicitly not a family beta gate.
- **Approach C mapping-store implementation** (Decision Pending: `PropertiesService` vs central registry). Cannot land cleanly until the audit in §10.2 confirms what ensure-\* coverage exists for the workbook the mapping points at.
- **Approach D family beta proof implementation.** Cannot land cleanly until the audit in §10.2 plus the §6 Decision Pending items are answered.

### 10.2 Recommended next step — ensure-\* bootstrap audit (analysis only)

**The next pass should be an analysis-only audit of existing ensure-\* bootstrap coverage.** Specifically, a new design doc that answers:

1. **Which sheets does the existing codebase create automatically today?** For each entry point (Quick Add, Bill add, Bills Due render, Debt add, Bank Account add, House Values add, Investments add, Cash Flow Upcoming add, Donations add, Setup / Review, Property Performance, Retirement save, Profile save), enumerate which ensure-\* helper runs and which sheet(s) it creates on a blank workbook.
2. **Which required sheets are missing from automatic bootstrap?** Specifically: are there sheets the dashboard expects to read but that no ensure-\* helper creates? If yes, what is the user-visible behavior today on a blank workbook (state field, calm empty surface, red banner)?
3. **What blank-workbook path already works end-to-end?** Map the journey a brand-new user takes through the dashboard against a fully empty workbook: which tabs render cleanly, which tabs render a calm "no data yet," which tabs surface anything resembling an error.
4. **What would the first-run Central App bootstrap need to add on top of what already exists?** Specifically: with the existing ensure-\* coverage as the floor, what additional bootstrap step (if any) is required so that a freshly created workbook reaches Setup / Review without intermediate state?
5. **Which Decision Pending items from `CENTRAL_APP_ONBOARDING_AND_LIFECYCLE.md` are actually blocking?** The lifecycle doc has many Decision Pending items; the audit should classify them as (a) blocking the first family beta proof, (b) deferrable to a later phase. The list of "blocking" items becomes the input to the implementation prompts that follow.

The audit should produce a new document — proposed name `CENTRAL_APP_BOOTSTRAP_COVERAGE_AUDIT.md` — that mirrors the structure of `CENTRAL_APP_DEPENDENCY_AUDIT.md`. Like the dependency audit, it is **inventory + analysis**, not implementation.

### 10.3 Why analysis comes before implementation here

- **The family beta proof's foundation is the ensure-\* chain.** The product decision is that family beta validates real onboarding. Real onboarding rides on the existing ensure-\* coverage. We do not actually know today whether that coverage is sufficient.
- **The audit is fast and reversible.** A document pass produces no code change, no deployment change, no risk to the developer's bound experience. It establishes the floor we are building from.
- **Implementation prompts that follow the audit will be smaller and safer.** Once we know exactly which ensure-\* helpers exist and which gaps remain, each gap can be its own narrow ensure-\* helper implementation prompt — same shape as the existing helpers, with the same additive contract. That is a smaller, more reversible series of implementation prompts than "build the bootstrap path" as a single large pass.
- **The Decision Pending items in §6 are answered with better information after the audit.** Specifically: §6.4 ("ensure-\* coverage on a fresh workbook") goes from speculation to known state. §6.7 ("recovery surfaces") gets concrete examples to design against. §6.8 ("rollback") gets a concrete fallback path: "if the central deployment breaks, the beta user still has a workbook in their Drive with the canonical structure already created."

### 10.4 What happens if the audit finds significant gaps

- **Each gap becomes its own implementation prompt under the existing ensure-\* pattern.** No new architectural surface, no new helpers invented for the proof; just extensions of the additive coverage that already exists. Each prompt is small, reversible, and testable against the developer's bound workbook before it ever touches the central deployment.
- **Gaps are filled before the family beta proof, not during it.** The proof is not the place to discover that Bills Due crashes on a workbook without `INPUT - Bills`. That has to be ensure-\*-covered first.

### 10.5 What happens in parallel

- **Phase 7 resolver seams remain valid and parallel-shippable.** Per `CENTRAL_APP_SIXTH_RESOLVER_SEAM.md → §8`, Candidate B (`nextActionsPickRollingDebtTarget_`) is the next resolver-seam candidate. It does not interact with the bootstrap audit; both can be in flight simultaneously without conflict. Whether to prioritize a Phase 7 seam in parallel with the audit is a separate scheduling question for the next implementation prompt.
- **No deployment-settings change happens during the audit.** The developer's bound deployment stays exactly as it is today. The audit is paper only.

### 10.6 Summary of revised stance

- **Approach A (manual hardcoded shortcut):** rejected for family beta. Acceptable as a deployment-posture spike against the developer's second Google account, narrowly scoped.
- **Approach D (Drive-API workbook creation + per-user mapping store + ensure-\* chain):** recommended direction for family beta proof. Implementation is layered (§6 sequence), not single-pass.
- **Next implementation-or-analysis pass:** ensure-\* bootstrap coverage audit (§10.2). Analysis only. No code.
- **After the audit:** decisions in §6 are pinned; gaps are filled with narrow additive ensure-\* implementation prompts; the proof deployment is stood up; the family beta proof runs.

---

## 11. Architectural boundaries reaffirmed for the revised proof

### Now in scope (no longer prohibited) for the family beta proof

- **Resolver body extension.** The Phase 1–6 invariant ("resolver body is a one-line pass-through") evolves to "resolver body is a pass-through on bound deployments; on the central deployment, it consults the per-user mapping and invokes bootstrap when needed." The bound deployment's behavior is unchanged. The central deployment's resolver path is new.
- **`PropertiesService.getUserProperties()`.** Required for the mapping store (§6.2). The resolver is the only code in the project that reads `cashCompassWorkbookId`; the bootstrap helper is the only code that writes it.
- **`Session.getEffectiveUser()`.** Required by the resolver to identify the caller before consulting the mapping. Identity logic stays concentrated in the resolver — no module calls `Session.getEffectiveUser()` directly for workbook lookup. Per `CENTRAL_APP_DESIGN.md → §3`.
- **`SpreadsheetApp.openById(...)`.** Required by the resolver to open the user's workbook by ID once the mapping is resolved. The resolver remains the only code in the project that calls `openById`.
- **Drive API** (or `SpreadsheetApp.create()` if its semantics under user identity suffice). Required by the bootstrap helper (§6.3) to create the workbook in the user's Drive.
- **`appsscript.json` change for the central deployment.** Required to set `executeAs: USER_ACCESSING` and the appropriate `access:` scope, plus declare the OAuth scopes the bootstrap needs. Per `CENTRAL_APP_DEPLOYMENT_OPTIONS.md → §7`. The developer's bound deployment is **not** touched.
- **First-run UI surfaces.** A loading state during bootstrap latency, plus the recovery surfaces for the four critical first-run failures (§6.7). HTML changes are in scope for these surfaces.

### Still out of scope for the family beta proof

- **No ensure-\* helper migration to the resolver.** The ensure-\* helpers continue to call `SpreadsheetApp.getActiveSpreadsheet()` directly inside their own bodies. Under `executeAs: USER_ACCESSING`, this returns the workbook the resolver just opened by ID (because that becomes the "active" spreadsheet in the request context). If the audit in §10.2 surfaces ensure-\* helpers that misbehave under this assumption, that becomes a separate per-helper implementation prompt.
- **No write-path migration to the resolver.** Quick Add Payment writes, planner output writes, Bills / Debts / Assets / Property writes — all stay on the platform call. Same reasoning as above: they run against whatever workbook the request resolved to.
- **No `buildDashboardSnapshot_()` migration.** Deferred per `CENTRAL_APP_DASHBOARD_SEAM_ANALYSIS.md → §6 Step E`.
- **No `LOG - Activity` write inside the resolver.** The resolver's logging is `Logger.log` only. The activity log is reserved for user-visible events.
- **No `Session.getActiveUser()`** — only `Session.getEffectiveUser()`, which under `USER_ACCESSING` returns the calling user's email.
- **No central mode for the developer's deployment.** The developer's bound deployment remains `executeAs: USER_DEPLOYING`, `access: MYSELF`. The family beta deployment is a separate Apps Script deployment that runs in central mode.
- **No published privacy policy or terms of service.** The beta user is briefed verbally and 1:1. Public publication is a later phase.
- **No `SYS - Users` schema, no `getUserPlan_`, no `isPaidUser_`, no monetization scaffolding of any kind.** Per §7.

### Invariants that survive the revision

- **Bound mode is preserved byte-for-byte for the developer.** The product decision does not change this. The family beta proof runs on a separate deployment; the developer's daily-use deployment is untouched.
- **One module per pass for resolver seam work.** Phase 7+ resolver seams (e.g., `nextActionsPickRollingDebtTarget_`) remain valid and parallel-shippable; they are independent of the family beta proof scope.
- **Identity resolution lives in one place.** The resolver. Modules do not call `Session.getEffectiveUser()` for workbook lookup.
- **Additive-only bootstrap.** Ensure-\* helpers create what is missing; they never rewrite what is present. The bootstrap helper that creates the workbook never reformats an existing workbook.
- **Blank-workbook resilience.** Every read path returns a `state` field; no red banners on a fresh workbook.

---

## 12. Closing notes

This document does **not** authorize implementation.

The next Cursor prompt to act on this document is **analysis only** — the ensure-\* bootstrap coverage audit described in §10.2. That audit produces a new doc (proposed name `CENTRAL_APP_BOOTSTRAP_COVERAGE_AUDIT.md`) inventorying which sheets the existing ensure-\* chain creates, which gaps remain, and which Decision Pending items in `CENTRAL_APP_ONBOARDING_AND_LIFECYCLE.md` are actually blocking the family beta proof.

The audit must be complete before any implementation prompt is written for the family beta proof. Specifically: §6's Decision Pending items (mapping store mechanism, Drive API surface, folder placement, filename convention, default sharing, scope list, recovery wording) are pinned in writing by the audit and its follow-up decision pass — not improvised during implementation.

After the audit:

1. The Decision Pending items pinned by the audit drive a small set of additive ensure-\* implementation prompts for any coverage gaps. Each is narrow, reversible, and testable against the developer's bound workbook before touching the central deployment.
2. A separate Apps Script deployment is stood up with `executeAs: USER_ACCESSING` and the agreed `access:` scope. This is the "internal platform spike" the developer runs against their own second Google account to confirm the deployment posture works. Approach A's hardcoded mapping is acceptable inside this spike only as a temporary scaffold; it is removed before the family beta user is invited.
3. The mapping store (§6.2) and bootstrap helper (§6.3) are implemented as their own prompts. Each is tested against the developer's second Google account.
4. First-run UX (§6.6) and recovery surfaces (§6.7) are wired and tested.
5. The rollback procedure (§6.8) is documented before the deployment is shared with the family beta user.
6. The family beta user is invited per `CENTRAL_APP_FAMILY_BETA_PLAN.md → §6 Phase 5`.

Until the audit is run, the migration remains design work. The resolver body still contains exactly the pass-through it had at the end of Phase 1 `b2798a7`. No central mode. No `PropertiesService`. No `openById`. No identity helper. No user mapping. No deployment change.

The family beta proof is **possible**. It is **not small**. The product decision is that real onboarding fidelity is worth the additional scope — and the audit in §10.2 is the cheapest way to scope it accurately before any code is written.

---

End of document.
