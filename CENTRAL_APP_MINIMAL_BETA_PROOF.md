# CENTRAL_APP_MINIMAL_BETA_PROOF.md

Design analysis for the **smallest possible Central App proof-of-concept** that would allow one external family beta user to run CashCompass against centralized code and a user-owned spreadsheet — without copying the Apps Script project into the user's workbook.

**Analysis/design only.** No Apps Script code, no HTML/JS, no deployment changes, no implementation. Implementation requires its own Cursor prompt with explicit user approval per `CENTRAL_APP_IMPLEMENTATION_PLAN.md → §9` and `CENTRAL_APP_DESIGN.md → §9 Guardrails`.

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

## 3. Minimum viable proof definition

The smallest successful outcome that would count as proof. **All** of the following must hold, but no more:

1. **Beta user opens a single URL.** A URL the developer shares with one trusted family member. Not a Marketplace listing. Not a publicly discoverable address.
2. **Beta user authenticates with Google.** Standard Google OAuth consent surface. Beta user grants whatever minimum scopes the deployment requires. No invitation system, no separate sign-up form.
3. **A spreadsheet for the beta user is resolved.** One of:
   - the user previously had a CashCompass-shaped workbook the developer already shared with them, and a hardcoded or manual mapping points at it; **or**
   - a fresh workbook is created in (or shared with) the user during the proof setup, by means that need not be elegant (developer creates it in advance; developer shares it; user-side Drive API is not required for the very first proof).
4. **The dashboard loads.** Overview renders with the data from the beta user's workbook, even if some surfaces show "no data yet" because the workbook is fresh. No red banners. No "Sheet not found" exceptions. Phase 1–6 resolver seams route to that workbook for the migrated entry points; every other entry point keeps its bound-mode behavior (in this proof, "bound mode" means whatever spreadsheet the current execution context resolves to, with the minimal central-mode hack layered on top — see §5).
5. **No Apps Script source is copied into the user's workbook.** The beta user's workbook is a data spreadsheet only. The script lives in the central deployment. This is the defining success criterion of the proof — it is what makes it a *central* app.
6. **Existing bound mode still works for the developer's workbook.** The developer continues to use the bound editor or the existing bound deployment without regression. The minimal proof either runs alongside the existing bound deployment or temporarily replaces it with a one-toggle revert path.

A "minimum viable proof" run that **does not** include any of the items below is still a success:

- No user-driven workbook creation flow. The developer may create the beta user's workbook by hand and hand them a link.
- No `PropertiesService` mapping store. The proof may use a hardcoded mapping for one email → one spreadsheet ID.
- No "connect existing workbook" UI. The mapping is set by the developer outside the app.
- No first-run wizard. The beta user lands directly on the dashboard.
- No `SpreadsheetApp.openById()` *for the developer's workbook* — only for the beta user's workbook, behind a runtime check.
- No Drive API call from inside the script — the workbook exists before the proof runs.
- No multi-user support — the proof works for one beta user, period.
- No support tooling — debugging is verbal/screen-share with the beta user, plus existing `Logger.log` output.

This minimal definition deliberately violates many of the eventual lifecycle contracts in `CENTRAL_APP_ONBOARDING_AND_LIFECYCLE.md` — specifically, the proof skips bootstrap, validation, mapping store, recovery flows, and revocation. Those layers are deferred to §6; they are not part of the *first* experiment.

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
- **Verdict:** Strong candidate. Smallest credible scope. Best fit for the "one trusted family member" criterion.

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
  - Way too much surface area for a *minimum* proof. Adds: Drive API integration, scope-discipline decision, folder placement decision, filename decision, partial-bootstrap recovery, consent denial handling.
  - Almost every Decision Pending item from the lifecycle doc has to be resolved before this approach can ship.
  - Higher rollback cost than any of A / B / C.
- **Verdict:** Out of scope for the minimal proof. This is the second-or-third experiment after the minimal proof confirms the end-to-end shape works.

### 4.5 Approach E — Don't ship code; manually verify "in principle"

- **Shape:** Developer mentally simulates the central-app flow and concludes that the architecture is sound, without running any user-facing experiment.
- **Verdict:** Rejected. The whole point of a *proof* is to discover what the design docs missed. A paper exercise restates what the design docs already say.

---

## 5. Recommended first experiment

**Approach A — Hardcoded one-user mapping in the resolver.**

This is intentionally tiny. It is not the elegant Central App. It is the smallest possible thing that demonstrates the end-to-end shape works for one real user.

### What the proof actually does

- The developer creates a fresh workbook in their own Drive ahead of time (call it the "beta workbook"). The developer can either: (a) share the beta workbook with the beta user at read+write, leaving developer-owned per `CENTRAL_APP_DEPLOYMENT_OPTIONS.md → Option A1`, or (b) transfer ownership to the beta user so the beta workbook lives in their Drive per Option B. Choice **(b)** is the preferred direction; choice **(a)** is acceptable for the first proof and is the simpler setup. **Decision pending for the implementation prompt.**
- The developer extends the resolver, additively, with a runtime check that returns the beta workbook for the one beta user and continues to pass through for everyone else (specifically: for the developer).
- The deployment is updated to `executeAs: USER_ACCESSING` and an access scope that lets the beta user reach the URL. The exact `access:` value (`DOMAIN` vs `ANYONE`) depends on whether developer and beta user share a Google Workspace domain — **Decision Pending for the implementation prompt**.
- The beta user receives the URL, completes Google OAuth consent, and lands on the dashboard reading their beta workbook.
- The developer continues using their existing bound deployment / editor. If the deployment is shared between developer and beta user, the developer's identity falls through the new resolver check and gets `SpreadsheetApp.getActiveSpreadsheet()` — which under `USER_ACCESSING` returns whatever spreadsheet the developer last had open, or the deployment's bound spreadsheet, depending on Apps Script semantics. If this turns out to be flaky in practice, the resolver branch is widened to give the developer an explicit hardcoded workbook ID too — same shape, two entries in the conditional.

### Why this is the right first experiment

- **Smallest credible scope.** The resolver is the only code change. The deployment-settings change is one toggle. The mapping is two constants (email + spreadsheet ID).
- **Resolver remains a pass-through for the developer.** The Phase 1–6 invariant ("resolver body unchanged since Phase 1") evolves into a more nuanced statement: *resolver body is a pass-through for all callers except the one branch that handles the beta user*. The Phase 1–6 callers route through unchanged.
- **Honors `executeAs: USER_ACCESSING` posture.** Per `CENTRAL_APP_DEPLOYMENT_OPTIONS.md → §7`. The proof does not require the developer-as-runtime-identity model. It explicitly chooses the preferred direction.
- **No `SpreadsheetApp.openById` for the developer.** The proof introduces `openById` *only* on the beta-user branch. The developer's branch remains on `getActiveSpreadsheet()`. This keeps the developer's code path identical to today.
- **No `PropertiesService`.** The mapping is in source. `PropertiesService` is the *second* experiment.
- **No Drive API.** The workbook exists before the proof runs.
- **No bootstrap.** The workbook is hand-curated.
- **No first-run UI.** The beta user lands on the dashboard.
- **Reversible.** Two diffs: the resolver branch, and the deployment settings. Either one can be reverted independently.

### What the first proof must measure

- **Does the dashboard load for the beta user without red banners?**
- **Are the Phase 1–6 resolver seams routing to the beta workbook?** Smoke-test the five resolver-routed entry points (Overview cash-to-use card, Quick Add, Debt Overview, Bills Due debt-payment breakdown, Property Performance) — they should read from the beta workbook for the beta user, and the developer workbook for the developer.
- **Does the existing dashboard work for the developer at the same URL?** This is what the §3 success criterion ("bound mode still works for the developer") tests under the central deployment.
- **What latency does first-render show?** Cold-start under `USER_ACCESSING` is unknown; the only way to measure is to run the proof. Per the Phase 4 cold-start investigation pattern.
- **What happens to non-resolver-routed entry points?** Most modules still call `SpreadsheetApp.getActiveSpreadsheet()` directly. Under the new deployment, that returns whatever the platform decides — which is a behavior we genuinely do not know without running the experiment. This is the **single most important observation the proof produces**, and is the reason the proof is worth running before more resolver seams ship.

---

## 6. Required future implementation layers

Even the minimal proof in §5 requires real additive scaffolding. The list below is intentionally complete: it is the floor of what must exist before *any* version of the central flow runs end-to-end, even the tiniest one.

### 6.1 Spreadsheet resolution
- **Already exists (additively):** `getUserSpreadsheet_()` in `central_resolver.js`. Used by six call sites.
- **Still missing for the minimal proof:** the identity branch — a small extension to `getUserSpreadsheet_()` that calls `Session.getEffectiveUser().getEmail()` and routes the beta user to a different workbook. This is the only code change for the minimal proof.
- **Still missing for any real version:** a generalized mapping resolution (per-user mapping store, fallback to active spreadsheet for bound users, recovery semantics when the mapping breaks).

### 6.2 Spreadsheet ownership model
- **Already decided in principle:** user-owned spreadsheets in the user's Drive per `CENTRAL_APP_DEPLOYMENT_OPTIONS.md → §7`.
- **Still missing for the minimal proof:** the actual ownership decision for the beta user's workbook. Per §5, this is a Decision Pending for the implementation prompt — developer-owned-and-shared is acceptable for the first proof; transferred-to-user is preferred but adds steps.
- **Still missing for any real version:** Drive API call surface, folder placement, filename convention, sharing defaults.

### 6.3 Onboarding / create-or-connect flow
- **Already decided in principle:** additive bootstrap via existing ensure-\* helpers per `CENTRAL_APP_ONBOARDING_AND_LIFECYCLE.md → §3`.
- **Still missing for the minimal proof:** none. The proof skips user-driven onboarding entirely. The developer hand-bootstraps.
- **Still missing for the second experiment (post-minimal-proof):** a "Link existing workbook" helper, or an automatic create-on-first-run path.

### 6.4 Deployment / auth settings
- **Already decided in principle:** `executeAs: USER_ACCESSING`, `access:` to be chosen per `CENTRAL_APP_DEPLOYMENT_OPTIONS.md → §8` (Decision Pending).
- **Still missing for the minimal proof:** the actual deployment-settings change in `appsscript.json` (or in the Apps Script deployment UI). The proof is unrunnable without it.
- **Still missing for any real version:** OAuth scope discipline (only what each feature needs); scope versioning and re-consent handling; verified OAuth (for any deployment broader than family).

### 6.5 Basic failure handling
- **Already decided in principle:** every read path returns a `state` field; ensure-\* helpers are idempotent; no red banners. Per `CENTRAL_APP_DESIGN.md → §2` and `CENTRAL_APP_ONBOARDING_AND_LIFECYCLE.md → §6`.
- **Still missing for the minimal proof:** none. The proof's failure modes are: workbook not shared (visible immediately to the developer), OAuth scope denial (visible to the beta user), Apps Script execution error (visible in `Logger.log`). All are debuggable verbally.
- **Still missing for any real version:** structured error surface for "workbook gone," "OAuth revoked," "Drive scope denied," etc. per `CENTRAL_APP_ONBOARDING_AND_LIFECYCLE.md → §7`.

### 6.6 Fallback / rollback
- **Still missing for the minimal proof:** a documented rollback procedure. The minimal proof's rollback is: (a) revert the resolver branch, (b) revert the deployment settings to the prior `executeAs: USER_DEPLOYING` / `access: MYSELF`. Both reverts are one-step. The proof should not run until that procedure is written down — possibly inline in the implementation prompt that authorizes the proof.
- **Still missing for any real version:** automated tests for the rollback path; clear "is the central deployment up?" health check; a way for the beta user to fall back to a bound copy if the central deployment breaks during the proof window.

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

### Soft-deferred (not in this proof, but plausibly in the next experiment)

- **`PropertiesService` mapping store** (Approach C). The natural follow-up experiment.
- **Drive API workbook creation on first run** (Approach D). The third experiment after the mapping store is proven.
- **Recovery flows** ("workbook deleted," "OAuth revoked," "scope denied"). Designed in `CENTRAL_APP_ONBOARDING_AND_LIFECYCLE.md → §7`; implementable as a layered set of additive ensure-\*-like recovery helpers after the minimal proof has demonstrated the steady-state flow works.
- **Multi-user support.** Approach A's hardcoded mapping is for one user. The first time more than one user reaches the URL, the mapping store has to land (Approach C minimum).
- **Bound-mode → central-mode migration helper.** For the developer themselves, plus any family member who already has a bound copy. The minimal proof side-steps this because the beta user has no bound copy.

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

Now that the minimal proof is scoped, the implementation team has a real choice about where to spend the next pass: continue widening resolver coverage, or pivot to the proof.

### 10.1 Option — More resolver seams

- **Next candidate (per Phase 6 design):** `nextActionsPickRollingDebtTarget_()` in `next_actions.js` — would make `next_actions.js` the third fully resolver-routed module.
- **Pros:** continues the pattern that has worked. Every seam shipped reduces the risk surface that the minimal proof might surface in §8.3. Module coverage widens.
- **Cons:** seams in isolation cannot prove the central flow works. The flip-the-deployment moment is still required at some point.

### 10.2 Option — Minimal beta proof (this document)

- **Action:** ship the §5 experiment with the family beta user.
- **Pros:** converts the migration from "we have seams" to "we have an end-to-end flow." Produces a real risk register (which call sites break under `USER_ACCESSING`). Unblocks every subsequent monetization / lifecycle question by establishing the platform actually works.
- **Cons:** higher coordination cost (involves a real human family member). Requires three Decision Pending items decided up front. Surfaces unknown platform behaviors with no advance warning.

### 10.3 Option — Mapping store proof (Approach C)

- **Action:** build the `PropertiesService` "link my workbook" helper before running the URL proof.
- **Pros:** establishes the next architectural layer.
- **Cons:** premature. The §5 minimal proof has not yet confirmed the end-to-end shape works at all. Building the mapping store before knowing whether the end-to-end shape works is the wrong order.

### 10.4 Option — Onboarding / bootstrap proof (Approach D)

- **Action:** build a Drive-API-backed automatic workbook creation flow.
- **Pros:** would be the most "elegant" demonstration.
- **Cons:** way premature. Requires every Decision Pending item from `CENTRAL_APP_ONBOARDING_AND_LIFECYCLE.md` to be resolved. Not the right next step.

### 10.5 Recommendation

**Pivot to the minimal beta proof.** Specifically:

- The next implementation prompt should authorize the §5 experiment, not the next resolver seam.
- The Phase 7 resolver seam (Candidate B from `CENTRAL_APP_SIXTH_RESOLVER_SEAM.md → §8`) is **not blocked** by this pivot — it can ship in parallel with no interaction. But it is no longer the highest-value next step.
- The reason: the resolver seam program is producing strong, reproducible results. The minimal proof is producing zero results because it has not been attempted. Every additional resolver seam past Phase 6 produces incrementally smaller marginal value than the very first attempted central-mode experiment.
- **The biggest open question of the whole migration is: does the platform actually behave the way we think it does under `executeAs: USER_ACCESSING`?** No amount of resolver seam work answers that. Only the minimal proof does.

If the minimal proof succeeds, the implementation roadmap re-converges on the order in `CENTRAL_APP_DESIGN.md → §8` (central app stable → monetization → first gate). If it fails, the resolver seam program inherits a precise list of "things that broke under `USER_ACCESSING` that need a seam before we try again."

Either outcome is more useful than another resolver seam in isolation.

---

## 11. Architectural boundaries reaffirmed for the minimal proof

- **Resolver body becomes:** pass-through + a single hardcoded identity branch for the beta user. The pass-through behavior is unchanged for every non-beta caller, including the developer. The Phase 1–6 invariant ("resolver body is a one-line pass-through") evolves to "resolver body is a pass-through plus exactly one identity branch, and the resolver is the only code in the project that calls `SpreadsheetApp.openById(...)`."
- **No `PropertiesService`** at any point in the minimal proof.
- **No `Session.getActiveUser()`** — only `Session.getEffectiveUser()`, which under `USER_ACCESSING` returns the calling user's email.
- **No user mapping store.** The mapping is two constants in source.
- **No Drive API.**
- **No ensure-\* helper migration.**
- **No write-path migration.**
- **No `buildDashboardSnapshot_()` migration.**
- **No `appsscript.json` change** until the implementation prompt for the minimal proof explicitly authorizes it.
- **No HTML / CSS / schema change.**
- **No `LOG - Activity` write inside the resolver.** The proof's logging is `Logger.log` only.
- **No published privacy policy, no terms of service.** The beta user is briefed verbally.

---

## 12. Closing notes

This document does **not** authorize implementation.

The next Cursor prompt to act on this document should be the implementation prompt for the §5 minimal proof, which must:

- pin the three Decision Pending items (ownership model, `access:` value, rollback procedure),
- name the additive resolver changes precisely,
- specify the `appsscript.json` change precisely,
- specify the smoke-test checklist precisely,
- explicitly mark the rollback path,
- and reaffirm the constraint set in §2 of this document.

Until then, the migration remains design work. The resolver body still contains exactly the pass-through it had at the end of Phase 1 `b2798a7`. No central mode. No `PropertiesService`. No `openById`. No identity helper. No user mapping. No deployment change.

The minimal proof is **possible** today. Whether it is **right** today is the question the next implementation prompt answers.

---

End of document.
