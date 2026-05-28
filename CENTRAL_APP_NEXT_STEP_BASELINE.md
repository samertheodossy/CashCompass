# CENTRAL_APP_NEXT_STEP_BASELINE.md

> **Status update (2026-05-28): the central-mode milestone has shipped its first runtime-proven slice.** The "next major milestone" framing below is the **pre-milestone** state of the document, preserved verbatim as the authorization record. The first central-mode resolver + workbook provisioning slice has been implemented (commit `d952dfa`), deployed to the `CashCompass — Central Beta (Slice 1)` deployment, and runtime-confirmed against the developer's primary Google account: a separate `CashCompass — samertheodossy@gmail.com` workbook was provisioned in the developer's Drive, `INPUT - Settings` was bootstrapped, the SHA-256 mapping persisted, and the original bound workbook remains untouched and continues to serve the live data path. The two-mode operating model is now in effect — see §7 for the post-milestone summary and `CENTRAL_APP_WORKBOOK_CREATION_FIRST_SLICE_PLAN.md → §15` for the runtime evidence.

A short baseline doc that establishes a single fact: **bound-mode onboarding is now sufficiently proven, and the next major Central App milestone is central-mode workbook creation + mapping.**

This doc is the connective tissue between the work that just closed (bound-mode onboarding runtime matrix, blank-workbook bootstrap coverage, planner runtime unknowns, the recurring-bill skip bug, the generated-sheet formatting polish workstream split) and the work that comes next (centrally-hosted code that creates and tracks per-user workbooks). It is deliberately concise — the supporting evidence lives in the docs cross-referenced from each section.

**Documentation only.** No Apps Script change, no HTML change, no deployment-setting change, no schema change. This doc authorizes no implementation; the next implementation step is a focused planning prompt, not code.

Cross-references:
- `CENTRAL_APP_FAMILY_BETA_READINESS_CHECKPOINT.md` — most recent synthesis after planner-page runtime closure.
- `CENTRAL_APP_BLANK_WORKBOOK_RUNTIME_REPORT.md` — completed blank-workbook runtime matrix.
- `CENTRAL_APP_BOOTSTRAP_COVERAGE_AUDIT.md` — bootstrap coverage audit, all gaps closed or reclassified.
- `CENTRAL_APP_MINIMAL_BETA_PROOF.md` — the onboarding-first product decision (Approach D) that supersedes the original hardcoded-mapping shortcut.
- `CENTRAL_APP_DEPLOYMENT_OPTIONS.md`, `CENTRAL_APP_DESIGN.md`, `CENTRAL_APP_ONBOARDING_AND_LIFECYCLE.md`, `CENTRAL_APP_FAMILY_BETA_PLAN.md`, `CENTRAL_APP_IMPLEMENTATION_PLAN.md` — pre-existing architecture / lifecycle / posture docs that the next planning step will draw from.
- `GENERATED_SHEET_FORMATTING_POLISH_PLAN.md` — confirms cosmetic polish is a separate non-central workstream.

---

## 1. Current proven baseline

Established by the blank-workbook runtime matrix (`CENTRAL_APP_BLANK_WORKBOOK_RUNTIME_REPORT.md`), the bootstrap audit (`CENTRAL_APP_BOOTSTRAP_COVERAGE_AUDIT.md`), the family-beta readiness checkpoint (`CENTRAL_APP_FAMILY_BETA_READINESS_CHECKPOINT.md`), and the post-checkpoint bug fixes (`a9b5e21` recurring-bill skip, `8b399f6` Donations bootstrap, `4e6af6d` Houses onboarding).

What is now runtime-confirmed working on a brand-new, disposable, zero-sheet Google Sheets workbook:

- First launch surfaces Setup / Review without a red banner; `INPUT - Settings` is created additively on first open.
- Setup / Review walks Bank Accounts → Debts → Bills → Cash Flow → Upcoming → Retirement, each of which creates its canonical sheet(s) via existing `ensure*` helpers without manual intervention.
- Overview degrades gracefully to `$0` / "not yet set up" states instead of throwing.
- Houses end-to-end onboarding succeeds: `INPUT - House Values`, `SYS - House Assets`, and per-house `HOUSES - <Name>` tabs are all created from the dashboard "Create house" path; the pre-validation-before-ensure failure that surfaced this gap is fixed.
- Investments / Donations open and accept first writes (Donations now lazy-creates `INPUT - Donation` on first read).
- Rolling Debt Payoff and Debt Payoff Projection render zero-state guidance with no banner and no unexpected sheet creation when prerequisites are absent.
- Bills Due "Recurring Bills (No Due Date)" Pay/Skip resolve correctly (the `dashboard_recurring_skip::` shape bug is fixed).

The additive bootstrap contract has been re-verified across this work: every `ensure*` helper is idempotent, race-safe, and strictly additive — populated workbooks are unaffected by any first-create branch.

**Conclusion:** the onboarding architecture itself, in bound mode, is sufficient to take a brand-new workbook from empty to fully usable without a developer in the loop.

---

## 2. What is no longer blocking family beta

Each item below was a candidate blocker at some point in this workstream and has been closed:

| Was a blocker for | Status | Resolution |
|---|---|---|
| Blank-workbook first launch | ✅ Closed | Runtime-confirmed. `INPUT - Settings` self-creates; Overview gracefully degrades. |
| Setup / Review per-step bootstrap | ✅ Closed | Bank Accounts / Debts / Bills / Cash Flow / Upcoming / Retirement all create canonical sheets additively. |
| Houses onboarding | ✅ Closed | `4e6af6d` reordered ensure-block to run before name validation; per-house tab creation confirmed working. |
| Donations bootstrap | ✅ Closed | `8b399f6` added `ensureInputDonationSheet_`, replaced strict throw in `getDonationsSheet_`. |
| Planner runtime unknowns | ✅ Closed | Rolling Debt Payoff + Debt Payoff Projection render gracefully on a blank workbook. |
| Property Type dropdown empty on first-run Houses | ✅ Closed | First-run handoff in `onboardingOpenHousesPage` now calls `loadHouseSection`. |
| `HOUSES - <Name>` per-house tab creation | ✅ Closed | Reclassified as not a gap after runtime evidence; `createHousesExpenseSheet_` is the canonical creator. |
| Recurring Bills (No Due Date) Skip action | ✅ Closed | `a9b5e21` emits server-resolvable `skipKey` via existing `buildDashboardRecurringSkipKey_`. |

None of these are open. None of these blocks the central-mode milestone from starting.

---

## 3. Remaining non-central polish/hardening tracks

These exist but are deliberately scoped as **separate, parallel workstreams** that do not block central-mode planning or implementation.

- **Generated-sheet formatting polish** — tracked in `GENERATED_SHEET_FORMATTING_POLISH_PLAN.md`. Cosmetic only. First-create branches only. Tier 1 = Bank Accounts / Debts / Bills. Independent of central-mode work; can be done before, during, or after.
- **Defense-in-depth reorder for Debts / Investments** — `addDebtFromDashboard` and `addInvestmentAccountFromDashboard` have the same latent `pre-validation-before-ensure` shape that the Houses fix addressed, currently masked because the canonical sheets they read are already in the bootstrap registry. Optional hardening, not a known runtime failure.
- **`addHouseExpense` legacy strict read** — still throws on a missing `HOUSES - <Name>`. In normal flow `addHouseFromDashboard` creates the per-house tab first, so this is unreachable; documented as defense-in-depth only.
- **Schema-version marker** — no `INPUT - Settings` row records the schema version a given workbook was bootstrapped against. Useful future hardening for migrations, not a current blocker.
- **Cold-start perception polish** — first launch can feel slow because of the cascade of `ensure*` calls; not a correctness issue.
- **UX wording polish** — covered by the earlier `UX_POLISH_AUDIT.md` passes; remaining items are cosmetic.
- **Bank Import** — explicitly out of family-beta scope per `CENTRAL_APP_FAMILY_BETA_PLAN.md § Non-goals`; no central-mode dependency from this side either.

Every item in this list is intentionally **outside** the central-mode milestone. Each gets its own future prompt when it surfaces as priority.

---

## 4. Why central-mode workbook creation + mapping is now the next major milestone

Three converging reasons:

1. **The bound-mode onboarding chain is the load-bearing dependency for central mode.** Until the chain produced a fully-usable workbook from zero sheets with no developer intervention, central-mode workbook creation could not safely call into it — every bootstrap gap would manifest as a first-run failure for the very first real external user. That dependency is now satisfied (§1, §2).

2. **The original "hardcoded one-user mapping" shortcut has been explicitly rejected.** `CENTRAL_APP_MINIMAL_BETA_PROOF.md` was revised to retract Approach A (hardcoded mapping) and adopt Approach D (real onboarding-first). That product decision means the next step is not "ship the bound-mode app to one external user" — it is "build the smallest real central-mode flow that creates a user-owned workbook on first sign-in and remembers the mapping". The retraction is now ~1 month old and the supporting onboarding work to back it has shipped.

3. **Every other candidate next-step is either decoratively scoped or unblocked by central mode.** Formatting polish is cosmetic. Defense-in-depth reorders are optional. Schema-version markers help migrations that do not yet exist. Bank Import is out of scope. The only step that materially changes what the product is — moving from "a Sheets-bound app the developer copies for each user" to "a centrally-hosted app each user gets their own workbook from" — is the central-mode milestone. Nothing else moves the architecture forward.

What the milestone is **not**:
- Not the final shipped multi-tenant SaaS architecture.
- Not the family beta launch event itself.
- Not a public/monetized launch.
- Not a rewrite of the existing resolver seam work (Phases 1–6 stay in pass-through mode until the milestone explicitly flips them).

What the milestone **is**:
- The smallest end-to-end flow where: (a) a user signs in to the deployed web app, (b) the app creates a new Google Sheets workbook in that user's Drive, (c) the canonical bootstrap chain runs against that workbook to make it usable, (d) the resolver remembers which workbook belongs to which user across sessions, (e) the user can come back tomorrow and land in the same workbook without re-onboarding.

Once this milestone closes, the family beta has a real onboarding path — no developer-copied workbook, no manual setup, no hand-maintained mapping list.

---

## 5. Decision Pending items

These are the open questions the next planning doc must answer before any code is written. None is decided here. Each is listed with the surface area it touches so the planning prompt can route into the right pre-existing reference doc (`CENTRAL_APP_DESIGN.md`, `CENTRAL_APP_DEPLOYMENT_OPTIONS.md`, `CENTRAL_APP_ONBOARDING_AND_LIFECYCLE.md`, `CENTRAL_APP_MINIMAL_BETA_PROOF.md`).

### 5.1 Workbook ownership
- Who owns the per-user Spreadsheet file in Google Drive?
  - User-owned (created in the user's My Drive via Drive API while running as the user) — required for the user to retain data if the central app is ever uninstalled.
  - Service-account-owned with shared access — easier to administrate but creates a privacy / data-ownership concern the project has already chosen to avoid.
- What folder, if any, in the user's Drive does the file live in? (Root, "CashCompass" subfolder, no preference?)
- What is the canonical filename? (`CashCompass — <user email>`, `CashCompass`, user-chosen?)

### 5.2 Create vs link flow
- First sign-in: does the app **always** create a new workbook, or does it offer a "I already have a CashCompass workbook, link it" path?
- If link is supported, how is the existing workbook validated (schema marker, sheet inventory, owner check)?
- Is there a "reset / start over" path, and does it create-new or wipe-existing?
- What happens if the user manually creates the file themselves via Google Drive UI before signing in?

### 5.3 Mapping storage
- Where does the `email → spreadsheetId` mapping live?
  - `PropertiesService.getScriptProperties()` — simplest, single-tenant-friendly, opaque to the user.
  - A dedicated central admin sheet in a separate spreadsheet — auditable, but introduces another file the project must own.
  - Both (PropertiesService as the read path, admin sheet as the human-auditable log)?
- How is the mapping populated initially (just-in-time on first sign-in, vs pre-provisioned)?
- How is the mapping rotated if a user's spreadsheet is deleted, renamed, or transferred?

### 5.4 Resolver behavior
- `getUserSpreadsheet_()` is currently a pass-through to `SpreadsheetApp.getActiveSpreadsheet()`. In central mode, when does it flip to `SpreadsheetApp.openById(<mappedId>)`?
- Is the flip gated by a feature flag (env / property) so bound-mode developers keep working unchanged?
- What is the fallback path when the mapping lookup fails (user has not been provisioned yet, mapping is stale, spreadsheet was deleted)?
- Caching strategy: cache the resolved spreadsheet handle per execution, per session, or recompute every call?

### 5.5 Deployment / auth posture
- `executeAs: USER_ACCESSING` vs `executeAs: USER_DEPLOYING` — central mode requires `USER_ACCESSING` so each user's invocations run with their own Drive scope and the workbook is created in their Drive. This decision has implications already documented in `CENTRAL_APP_DEPLOYMENT_OPTIONS.md`; the planning doc should re-affirm it.
- `access: ANYONE` (manifest enum; deployment UI label: "Anyone with a Google account") vs allow-list. Family beta wants allow-list only at the app layer; the manifest enum `ANYONE_WITH_GOOGLE_ACCOUNT` referenced in earlier drafts is **not** a valid clasp manifest token — the accepted set is `[UNKNOWN_ACCESS, DOMAIN, ANYONE, ANYONE_ANONYMOUS, MYSELF]`, and `ANYONE` is the correct token (sign-in required, but any Google account).
- What OAuth scopes are required in `appsscript.json` for Drive API workbook creation? (Likely `https://www.googleapis.com/auth/drive.file` or `drive`.)
- Consent prompts: which first-sign-in user sees what? Test on a fresh non-developer Google account.

### 5.6 Rollback
- If the milestone ships and something goes wrong, what is the rollback?
  - Feature flag off → resolver returns to pass-through → users with a mapped workbook revert to using the bound spreadsheet of the deployment? (Probably not the right answer; their data is in their own workbook now.)
  - Or: the central deployment is replaced with the prior bound-mode version, and any user-owned workbooks are abandoned in place but recoverable when the user opens them directly?
- What audit trail does the central app keep so a rollback can identify "which users were affected, what state were they in"?
- What is the manual recovery path if a single user's mapping is corrupted?

---

## 6. Recommended next planning doc

The next deliberate step is **one focused planning doc**, not implementation. The doc should answer every Decision Pending item in §5 with a recommended choice (and rationale), and propose the smallest possible implementation slice that produces a working end-to-end central-mode flow for one user.

Target filename:

```
CENTRAL_APP_WORKBOOK_CREATION_AND_MAPPING_PLAN.md
```

Suggested structure for that doc when it is written:

1. Recap and scope statement (one paragraph, no synthesis).
2. Decision Pending § resolution — each §5 item gets a recommended answer with rationale and a "what changes if we pick differently" alternative.
3. Required components — Drive API workbook creation, mapping store, resolver flip, feature flag, OAuth scopes, admin tooling.
4. Smallest end-to-end slice — one user, one sign-in, one created workbook, one mapping write, one resolved second-session open. No multi-user yet, no admin UI yet, no error-recovery UX yet beyond a clear error message.
5. Sequencing — which slice ships first, which slice ships second, how each slice is independently revertible.
6. Test plan — pre-implementation manual test plan against a disposable second Google account.
7. Risk register — what can go wrong, what the mitigation is, what the rollback is.
8. Out-of-scope (explicit) — everything the planning doc is **not** committing to (no monetization, no multi-tenant SaaS, no migration of existing developer workbook, no Bank Import re-enablement, no schema rewrites, etc.).

This planning doc, once written and approved, is the gate to the first central-mode implementation prompt. No central-mode code ships before it exists.

---

## 7. Baseline conclusion

> **Original conclusion (preserved verbatim — superseded 2026-05-28 by §7.bis):**

Bound-mode onboarding has been runtime-validated end-to-end on a brand-new, zero-sheet Google Sheets workbook with no developer intervention. The only remaining items are decoratively scoped (formatting polish), defense-in-depth (Debts/Investments reorder, addHouseExpense), or out of scope (Bank Import). None of them block central-mode work.

The next major Central App milestone is **central-mode workbook creation + per-user mapping**, and the next deliberate step toward that milestone is writing `CENTRAL_APP_WORKBOOK_CREATION_AND_MAPPING_PLAN.md` — not code.

---

## 7.bis Updated conclusion (2026-05-28) — first central-mode milestone runtime-proven

The "next major milestone" identified in §7 (now superseded) has shipped its first runtime-proven slice and is in production-shape on a private deployment.

### 7.bis.1 What shipped between §7's authorization and today

In sequence:
1. `CENTRAL_APP_WORKBOOK_CREATION_AND_MAPPING_PLAN.md` (commit `4b02ff8`) — the planning doc §7 authorized.
2. `CENTRAL_APP_WORKBOOK_CREATION_FIRST_SLICE_PLAN.md` (commit `cdd73c7`) — the architecture-side first-slice plan, pinning manifest, allow-list, resolver function inventory, locking, ownership, and rollback decisions.
3. `CENTRAL_APP_DEPLOYMENT_PREPARATION_PLAN.md` (commit `f0a5b04`) — the platform-layer plan for manifest, OAuth scopes, advanced services, and deployment isolation.
4. `CENTRAL_APP_RESOLVER_PROVISIONING_IMPLEMENTATION_PROMPT.md` (commit `e7e5317`) — the code-level implementation spec.
5. Manifest preparation (commit `e2ebbbd`) — `appsscript.json` only: `executeAs: USER_ACCESSING`, `access: ANYONE`, explicit `oauthScopes`, Drive v3 advanced service. Validated against clasp's manifest validator (which rejects `ANYONE_WITH_GOOGLE_ACCOUNT` — `ANYONE` is the correct enum for "any signed-in Google account"; the planning-doc wording was corrected in the same wave per the §15 SESSION_NOTES entry).
6. Resolver + workbook provisioning implementation slice (commit `d952dfa`) — `central_provisioning.js` (new), `central_resolver.js`, `webapp.js`, `profile.js`, plus the five planning-doc access-enum wording corrections.
7. First runtime proof (2026-05-28, developer's primary account): central deployment URL hit, allow-list gate admitted the developer, `Drive.Files.create` created `CashCompass — samertheodossy@gmail.com` in the developer's Drive, `INPUT - Settings` was bootstrapped, the `mapping::<sha256>` entry persisted, the original bound workbook was untouched, and the bound deployment continues to serve the live data path because it stays pinned to a pre-central-mode script version. Detailed evidence in `CENTRAL_APP_WORKBOOK_CREATION_FIRST_SLICE_PLAN.md → §15`.

### 7.bis.2 Current two-mode operating model

| Mode | Deployment | Workbook | Resolver routing | Allow-list | Use |
|---|---|---|---|---|---|
| Bound | Existing bound deployment URL, **pinned to pre-central-mode script version** | Developer's bound workbook (the historical production workbook) | `getActiveSpreadsheet()` (legacy code in the pinned version) | Not reached (legacy `doGet` predates the gate) | **Active live data + ongoing bound-spreadsheet development** |
| Central | `CashCompass — Central Beta (Slice 1)` deployment URL, on the latest script version | One user-owned `CashCompass — <user email>` workbook per allow-listed Google account | `getUserSpreadsheet_() → getOrProvisionUserSpreadsheet_()` when `CENTRAL_MODE=true` | Enforced in `doGet` against `FAMILY_BETA_ALLOWLIST`; unauthorized callers get `renderAllowlistRejection_()` HTML and never reach the resolver | **New-user provisioning sandbox + future family beta**; currently only the developer's own account has been provisioned |

Boundary enforcement is mechanical and double-layered: **deployment pinning** keeps the bound deployment running an older script version (so its `doGet` predates the allow-list gate and the resolver still pass-throughs), and the **`CENTRAL_MODE` script property** controls whether the central deployment's resolver routes to provisioning or to legacy pass-through. The two modes coexist in the same script project but never collide because they read different code (bound deployment) or different flag state (central deployment).

### 7.bis.3 Rollback posture (unchanged from the implementation spec)

- **Tier 1 — immediate, no redeploy:** flip `CENTRAL_MODE` script property from `true` to `false`. The central deployment's `getUserSpreadsheet_()` instantly reverts to legacy `SpreadsheetApp.getActiveSpreadsheet()` pass-through on the next request. No user-owned workbook is deleted; the `mapping::<sha256>` entries remain in script properties; re-enable is one property flip.
- **Tier 2 — archive central deployment:** Manage Deployments → archive the `CashCompass — Central Beta (Slice 1)` entry. The URL stops responding; the bound deployment is unaffected because it stays pinned.
- **Tier 3 — git revert:** revert `d952dfa` to remove `central_provisioning.js`, the resolver router, the allow-list gate, and the `ensureInputSettingsSheet_(ss)` refactor. The bound deployment continues working from its pinned version; subsequent re-deploys from `main` would restore the original posture.
- **Tier 4 — per-user manual cleanup:** `clearMappingForUser_(email)` from the Apps Script editor's Run dialog deletes the `mapping::<sha256(email)>` property for a single user. The user's workbook is preserved in their Drive (no hard delete — the only file-modifying call in the slice is `setTrashed(true)`, which moves files to the user's Drive Trash where they can be recovered).

### 7.bis.4 Next deliberate steps

In order:
1. **Disposable-account provisioning test** — `CENTRAL_APP_WORKBOOK_CREATION_FIRST_SLICE_PLAN.md → §15.5 row 1`.
2. **Unauthorized-account rejection test** — `§15.5 row 2`.
3. **Stale mapping behavior test** — `§15.5 row 3`.
4. **Return-to-existing-mapping test** — `§15.5 row 4`.
5. After all four hardening tests pass, decide whether to broaden the family beta allow-list or to spend a slice on Setup / Review walkthrough validation against a user-owned workbook (currently the central-mode workbook only has `INPUT - Settings`; lazy creation of the other canonical sheets needs runtime confirmation under the new ownership context).

What is **not** in scope for the next deliberate steps: any code change (the slice is implemented and proven for the developer-account row); any `appsscript.json` or deployment change; any UI redesign; any new ensure helper; any Bank Import re-enablement; any monetization or admin-portal work. All of these stay deferred per the §12 non-goals in the first-slice plan.

End of document.
