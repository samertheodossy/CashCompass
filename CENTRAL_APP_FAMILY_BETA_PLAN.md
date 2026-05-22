# CENTRAL_APP_FAMILY_BETA_PLAN.md

Private family beta plan for CashCompass Central App.

This document defines the minimum safe path to make CashCompass usable by **one trusted family beta user** (the first external user) while preserving existing bound-workbook functionality. It is **planning only**. No Apps Script code, no HTML/JS, no deployment changes, no implementation. All open items are marked **Decision Pending**.

---

> **Reaffirmed — onboarding-first family beta.** A shortcut proof in which the developer manually pre-creates the beta workbook and the resolver hardcodes a one-user identity mapping (the original recommendation in `CENTRAL_APP_MINIMAL_BETA_PROOF.md → §5`) is **rejected** as the family beta readiness path. Family beta must validate the real first-run flow — Drive-API workbook creation under user identity, per-user mapping store, additive ensure-\* chain on a fresh workbook — and reach the dashboard hands-off. The success criteria in §2 below and the Phase 3 bootstrap requirement in §6 already encode this stance; the rejection is captured durably in `CENTRAL_APP_MINIMAL_BETA_PROOF.md → top-of-document Status banner and §5.bis`. The next implementation-or-analysis pass is the ensure-\* bootstrap coverage audit recommended in `CENTRAL_APP_MINIMAL_BETA_PROOF.md → §10.2`.

Cross-references:
- `CENTRAL_APP_DESIGN.md` — migration architecture, abstraction point, guardrails, operational mindset.
- `CENTRAL_APP_DEPLOYMENT_OPTIONS.md` — preferred direction: centralized code + user-owned spreadsheets + `executeAs: USER_ACCESSING`.
- `CENTRAL_APP_ONBOARDING_AND_LIFECYCLE.md` — user lifecycle contract, recovery states, backward-compatibility callout.
- `CENTRAL_APP_IMPLEMENTATION_PLAN.md` — staged migration roadmap and implementation gate.
- `WORKING_RULES.md` / `TESTING_PLAN.md` — migration discipline and two-track regression posture.

---

## 1. Purpose

This is a **private beta plan, not a public launch plan**. It exists to define what "ready enough to invite one trusted family member" looks like — and nothing more.

It exists because:

- The architecture and implementation roadmap docs define the full migration shape, but the first external user does not need the full migration. They need a deliberately narrow slice that proves the centralized model works for one real household.
- A private family beta forces every interesting question — auth, ownership, bootstrap, recovery, support — to be answered for one user, in writing, before they apply to anyone else.
- The goal is to learn from a trusted user without putting their data, or the developer's other commitments, at risk.

What this plan is **not**:

- Not a launch readiness checklist for general availability.
- Not a marketing plan.
- Not a billing rollout. Monetization is explicitly out of scope (see §3).
- Not authorization to ship. Implementation still requires the gate in `CENTRAL_APP_IMPLEMENTATION_PLAN.md → §9` — each step needs its own Cursor implementation prompt with explicit user approval.

---

## 2. Beta success definition

The beta is successful when the family beta user can do all of the following, end-to-end, against the deployed Central App URL, against their own spreadsheet:

- **Open the central app URL.** A single deployment URL is the entry point. No Apps Script editor, no script copy, no spreadsheet binding by hand.
- **Authorize access.** Standard Google OAuth consent flow. The user grants the minimum scopes the app needs.
- **Create or connect their own spreadsheet.** Either: (a) the bootstrap path creates a fresh user-owned workbook in their Drive, or (b) the connect-existing path links a workbook they already have. Decision Pending which is offered first.
- **Complete basic Setup / Review.** The existing Setup / Review surface (already delivered) walks them through the input areas. It is read-only and never writes to their workbook.
- **Load the dashboard.** Overview, Bills, Cash Flow, Planning, Assets, Activity all open and render without red banners against a blank or partially-populated workbook.
- **Use core tracking flows.** Quick Add Payment, Bill Pay, Bills Add/Edit/Stop tracking, Debts Add, Bank Account Add, Cash Flow Upcoming Add, Donations Add — each completes against their own workbook and updates the dashboard correctly.
- **Keep data in their own spreadsheet.** The user's financial data lives in their own Google Drive under their own ownership. The developer does not technically have access to it through the script (per the preferred deployment direction).
- **Receive centralized code updates without owning or copying source code.** When the developer pushes a fix, the user sees it on next page load. They never run `clasp push`, never bind a script, never see the Apps Script editor.

If any one of these fails consistently, the beta is not ready to be widened.

---

## 3. Non-goals

The private family beta explicitly does **not** include:

- **Public launch.** No general invite, no Workspace Marketplace listing, no public-facing announcement.
- **Monetization.** No payment provider integration, no plan checkout, no upgrade prompts, no `SYS - Users` schema yet (per `CENTRAL_APP_IMPLEMENTATION_PLAN.md → §7`).
- **Stripe / billing infrastructure.** No webhook endpoints, no subscription state, no trial-window logic.
- **App Marketplace listing.** No Google Workspace Marketplace submission, no OAuth verification, no privacy-policy / terms-of-service publication.
- **Feature gating.** No paid-vs-free toggles. Every feature the beta user sees is unconditionally available to them.
- **Admin portal.** No developer-facing UI for user management, plan management, or support inspection.
- **Mobile app.** No native mobile target. The web app remains the only surface.
- **Broad UI redesign.** No visual refresh, no React-rewrite of additional surfaces, no information-architecture changes. The existing dashboard is the dashboard.
- **Full Bank Import UI unless separately prioritized.** The Bank Import staging / review / apply pipeline exists today but is large and the first gating candidate. Whether it appears in the beta is **Decision Pending** (see §10). Default assumption: hidden for the family beta.

If a proposed beta task would do any of the above, it is out of scope and is deferred.

---

## 4. Minimum feature set

Required functionality for the family beta user. Each item must work end-to-end against a user-owned spreadsheet under `executeAs: USER_ACCESSING`.

### Onboarding and start flow
- First-run detection (per `CENTRAL_APP_ONBOARDING_AND_LIFECYCLE.md → §3`).
- OAuth consent prompt with minimum scopes.
- Calm, single-screen welcome on first arrival.
- Hand-off to spreadsheet creation/linking and then to Setup / Review.

### Spreadsheet creation or linking
- A clear choice: "Create a new CashCompass workbook" or "Connect an existing workbook."
- Creation places the workbook in the user's own Drive.
- Linking accepts a workbook the user already owns and validates it (per `CENTRAL_APP_ONBOARDING_AND_LIFECYCLE.md → §4`).
- The mapping (`cashCompassWorkbookId` or equivalent) is stored per-user.

### Additive bootstrap
- The existing ensure-\* helpers populate canonical sheets and headers as features touch them.
- No new schema work. No new bootstrap content invented for the beta.
- Idempotent and additive only — same contract as bound mode today.

### Dashboard load
- Overview tab renders against the user's workbook with valid `state` semantics (`notSetUp` / `partial` / `ready`).
- All other tabs (Bills, Cash Flow, Planning, Assets, Activity) open without red banners on a blank workbook.

### Cash Flow
- Quick Add Payment writes to the correct year sheet, correct month column, correct row. The activity log records a `quick_pay` entry. Status banner reads `Payment recorded — <Month-YY> cash flow updated`.
- Upcoming Expenses add, edit (planned rows only), dismiss, and Quick Add-from-Upcoming all work.

### Bills
- Bills Due renders correctly against blank and populated workbooks.
- Add bill, Edit bill, Stop tracking, Pay (deep-links to Quick Add), and Skip all work.
- The Bills Due fix (normalized-payee handling) shipped in the prior phase remains intact.

### Debts
- Debts Add and Update flows work.
- Bills generated from Debts continue to surface in Bills Due correctly.
- Rolling debt payoff dashboard renders (no logic changes for the beta).

### Assets
- Bank Accounts Add new and Update flows work, creating canonical year blocks via the existing ensure-\* helper.
- House Values Add and Edit work.
- Investments Add works.

### Property
- Property Performance tab renders against the user's workbook (read-only for the beta unless the user has data; no new edit surfaces required).

### Retirement profile and assumptions
- Profile DOB is the source of truth for derived ages.
- Retirement scenario save and the Retirement Outlook card on Overview both refresh against the user's workbook.

### Setup / Review
- Read-only walkthrough of the five input areas, exactly as it ships today.
- Welcome gate triggers correctly on a fresh workbook.

### Basic recovery messages
- "Workbook not found — create a new one or link an existing one" surface for the deleted-spreadsheet case.
- "Access has been revoked — re-authorize to continue" surface for the OAuth-revoked case.
- "Couldn't reach Google Drive — please try again" for transient errors.
- No silent retries that loop the user. Each recovery surface gives them a clear action.

Anything beyond this list is explicitly out of beta scope.

---

## 5. Protected existing behavior

Bound-workbook mode is **the fallback** during the entire beta. It is not deprecated, replaced, or removed by anything in this plan.

- **Bound mode continues to work for the developer's own workbook** through the entire beta. The developer is not migrated to the beta deployment; the developer keeps their bound copy running as today.
- **Bound mode continues to work for anyone else who is on it.** Any existing bound-sheet user (today, only the developer's household) continues to operate exactly as they do now.
- **The Central App migration does not change deployment for bound users.** The active deployment for bound users remains `executeAs: USER_DEPLOYING`, `access: MYSELF`. The family beta runs as a **separate deployment** (Decision Pending in §10: which deployment URL the beta uses).
- **Rollback to bound mode is always an option.** If the beta surfaces an issue the developer cannot diagnose in time, the family beta user can be offered a bound-copy fallback (the existing bound-sheet model they would have used if the beta did not exist). This is a deliberate safety net.
- **No code path is allowed to assume "central mode only."** Until step 7 of `CENTRAL_APP_IMPLEMENTATION_PLAN.md → §5` ships and is stable, bound mode is the default path of the resolver and every module supports it.

Per `CENTRAL_APP_DESIGN.md → §11 Operational mindset`: continuity first, migration second. The beta does not get to break this rule.

---

## 6. Beta implementation phases

Each phase below is a separate future implementation pass. Each pass requires its own Cursor implementation prompt with explicit user approval, per `CENTRAL_APP_IMPLEMENTATION_PLAN.md → §9`. This plan does **not** by itself authorize any of them.

### Phase 0 — Baseline regression test in bound mode
- Run the existing two-track regression (blank workbook + populated workbook) against the current bound-mode app.
- Capture the baseline: what every dashboard tab shows, what every core flow returns, what every status banner says.
- This is the reference every subsequent phase must match for bound users.
- No code change in this phase.

### Phase 1 — Resolver seam in bound-compatible mode
- Per `CENTRAL_APP_IMPLEMENTATION_PLAN.md → §3` and §4. Introduce the resolver in bound-mode-only form. Apply it to a small number of module entry points.
- Validate that bound mode behaves byte-for-byte identically against the Phase 0 baseline.
- This phase changes code in the production deployment (the bound-mode app), so it must be done with care and reverted on any regression.
- No central-mode behavior implemented yet.

### Phase 2 — Central App deployment sandbox / private test
- Stand up a **separate Apps Script deployment** for the beta, with `executeAs: USER_ACCESSING` and `access` scope set to the minimum required to invite the family beta user (likely `ANYONE` with manual share, or `DOMAIN` if applicable — Decision Pending in §10).
- The deployment is not announced anywhere. Only the developer and (later) the family beta user have the URL.
- This phase introduces the **central-mode branch** of the resolver, but only against the sandbox deployment. Bound users are unaffected.
- Test the deployment URL against the developer's own Google account first (which has zero CashCompass workbooks under that identity, so it is effectively a "new user" test against the developer themselves).

### Phase 3 — First-run spreadsheet create/link flow
- Implement the bootstrap path: create a user-owned workbook in the user's Drive, store the mapping, hand off to Setup / Review.
- Implement the connect-existing-workbook path with the validation rules from `CENTRAL_APP_ONBOARDING_AND_LIFECYCLE.md → §4`.
- All recovery messages from §4 here ("workbook not found," "access revoked," etc.) are surfaced calmly.
- This phase is exercised exclusively against the sandbox deployment.

### Phase 4 — Core module verification in central mode
- Walk through every item in the Minimum feature set (§4) against the sandbox deployment, using the developer's "new user" identity from Phase 2.
- Capture any regression vs the Phase 0 baseline.
- Iterate until the minimum feature set is end-to-end stable.
- Bound mode is re-validated at the end of this phase to confirm it has not been disturbed.

### Phase 5 — Invite the family beta user
- The family beta user (son) is given the sandbox deployment URL and a short, plain-language onboarding note.
- They go through their own first-run flow: consent → bootstrap → Setup / Review → dashboard.
- The developer does not touch their workbook directly (cannot, under `USER_ACCESSING`). Support runs through the user-shared channels defined in `CENTRAL_APP_DEPLOYMENT_OPTIONS.md → §8 Support visibility`.
- Decision Pending: whether they create a fresh workbook or connect a template/sample workbook the developer shares with them.

### Phase 6 — Feedback and fix loop
- The beta user reports issues through a defined channel (Decision Pending — email, chat, structured form).
- Each fix runs through the standard Cursor flow: inspect → propose smallest design → implement → test in UI → user requests commit → commit and push.
- Each fix is validated against both the sandbox deployment **and** the bound-mode baseline before being merged.
- This loop continues until the success definition (§2) is satisfied for the beta user.

---

## 7. Testing checklist

Every phase change in §6 is validated against this checklist. Phase 0 establishes the baseline; later phases are checked against it.

### Workbook states
- [ ] **Blank workbook.** A fresh, empty workbook bootstraps additively when the user touches the first Add flow.
- [ ] **Existing populated workbook.** A real workbook with months of data loads, all calculations match prior values, all activity log entries are visible.

### Dashboard sections
- [ ] **Overview** loads, renders the snapshot, shows correct `state` field.
- [ ] **Bills** (Bills Due, Manage Bills) loads and renders.
- [ ] **Cash Flow** (Cash Flow, Donations, Upcoming) loads and renders.
- [ ] **Planning** (Next Actions, Debts, Debt Payoff, Purchase Sim, Retirement) loads and renders.
- [ ] **Assets** (Bank Accounts, House Values, Investments) loads and renders.
- [ ] **Activity** loads, default filter shows recent entries, filter UI works.

### Onboarding
- [ ] **Setup / Review** opens, walks through input areas, returns to dashboard without writes.
- [ ] **Welcome gate** correctly triggers on a fresh workbook and does not trigger on a populated one.

### Core writes
- [ ] **Cash Flow write** — Quick Add Payment writes to the correct year/month/row; activity log entry written; status banner matches expectation.
- [ ] **Bill payment / write** — Pay from Bills Due deep-links to Quick Add; save writes the value; Bills Due updates to suppress the paid bill.
- [ ] **Bill skip** — Skip writes a 0 (or marks handled) without surprises.
- [ ] **Bill add / edit / stop tracking** — each completes end-to-end.

### Asset / debt / property / retirement
- [ ] **Bank Account Add new** — creates year block, writes opening balance, snapshot reflects the new account.
- [ ] **Bank Account Update** — month write succeeds, prior months unaffected.
- [ ] **Debt Add** — sorted insertion, planner output reflects the new debt on the next run.
- [ ] **House Values Add/Edit** — values reflect on Property Performance.
- [ ] **Investments Add** — investment list updates.
- [ ] **Retirement scenario save** — Retirement Outlook card on Overview refreshes.
- [ ] **Profile save** — derived ages refresh on Retirement and Overview.

### Recovery and lifecycle
- [ ] **Permission revoked** — next request surfaces "access has been revoked — re-authorize" without a red banner or loop.
- [ ] **Spreadsheet deleted / missing** — surface offers create / link / cancel; no silent re-bootstrap.
- [ ] **Reconnect flow** — user can switch the mapping to a different workbook; old workbook is untouched.
- [ ] **Partial bootstrap recovery** — interrupting bootstrap mid-flow and retrying resumes correctly (ensure-\* helpers are idempotent).

### Bound-mode parity (the canonical regression)
- [ ] **Bound mode developer workbook** behaves byte-for-byte identically to Phase 0 baseline at every phase boundary.

---

## 8. Risk register

Risks that must be acknowledged and mitigated before the family beta user is invited (Phase 5).

### Hidden `SpreadsheetApp.getActiveSpreadsheet()` assumptions
- **Risk:** modules or helpers that bypass the resolver and call the active-spreadsheet API directly. Under `executeAs: USER_ACCESSING` with a non-bound deployment, this either fails outright or returns the wrong workbook.
- **Mitigation:** Phase 1 audits and routes high-traffic call sites through the resolver. Phase 4 catches whatever Phase 1 missed by exercising every flow.

### Auth and permission issues
- **Risk:** OAuth scope set is too broad (scares the user) or too narrow (feature fails mid-flow). Drive-create permission, Sheets read/write permission, and any send-mail permission must each be justified.
- **Mitigation:** decide the scope set explicitly before Phase 2 (Decision Pending in §10).

### Drive file ownership confusion
- **Risk:** the family beta user expects their workbook to be in their own Drive but it ends up in the developer's. Or vice versa. Or it ends up in a Shared Drive they cannot easily find.
- **Mitigation:** the bootstrap implementation pins the creation location and surfaces it to the user ("Your workbook is in your Drive at: …"). Tested in Phase 3.

### Partial bootstrap failures
- **Risk:** workbook created, mapping written, but some ensure-\* call fails mid-way, leaving the user in an ambiguous state.
- **Mitigation:** ensure-\* helpers are idempotent; the next request resumes. Verified in Phase 4 by deliberately interrupting a bootstrap.

### Central mode breaking bound mode
- **Risk:** a code change made for central mode subtly breaks bound mode (e.g. by introducing a code path the resolver chooses based on identity, but where the bound case incorrectly falls through to central handling).
- **Mitigation:** every phase boundary re-runs the bound-mode regression checklist before being declared done.

### Unclear recovery paths
- **Risk:** an error surface (workbook deleted, access revoked, Drive transient error) shows a developer-y message the family beta user cannot act on.
- **Mitigation:** all recovery surfaces tested in Phase 3 and Phase 4 against deliberately broken states. Wording is plain-language and gives the user a specific next action.

### Support and debug visibility limitations
- **Risk:** under `USER_ACCESSING`, the developer cannot read the family beta user's workbook directly to debug an issue. If the user can't articulate the problem, the developer can't fix it.
- **Mitigation:** define the support channel before Phase 5 (Decision Pending in §10). Likely: a "Generate a support diagnostic" action that produces a redacted snapshot the user shares manually. Without that, support relies on screen-share.

### Quota / latency surprises
- **Risk:** Apps Script per-user quotas are different from the developer's per-deployer quotas. Operations that are fast for the developer may be slower or rate-limited for the family beta user.
- **Mitigation:** Phase 4 includes performance smoke tests under the beta user's identity. Anything unexpectedly slow is flagged before Phase 5.

### Family relationship risk
- **Risk:** a beta failure with a family member is not just a product failure — it is a trust failure. The first external user is family, which raises the stakes.
- **Mitigation:** be explicit with the beta user that this is a beta, that bugs are expected, and that they can hand the workbook back to bound mode at any time. Set expectations before Phase 5, not during.

---

## 9. Exit criteria

The family beta user is invited (Phase 5) **only when all of the following are true and verified in writing**:

- [ ] **Bound mode passes baseline.** The Phase 0 regression checklist passes against the bound-mode app, end-to-end, with no regressions vs the captured baseline.
- [ ] **Central mode creates / links a spreadsheet** under the developer's "new user" identity in the sandbox deployment. Either the bootstrap path or the connect-existing path is functional (Decision Pending which one the beta user is offered first).
- [ ] **Dashboard loads** in central mode against a freshly bootstrapped workbook with no red banners. Every tab in §7 renders with valid `state` semantics.
- [ ] **Core flows pass** the testing checklist (§7) in central mode under the developer's new-user identity.
- [ ] **Recovery states are understandable** — the four states in §4 (workbook deleted, access revoked, transient Drive error, partial bootstrap) each produce a plain-language message with a clear next action.
- [ ] **No copied source code exists in the beta user's workbook.** The beta user's workbook is pure data — no bound Apps Script project, no script copy, no manual binding. They run against the central deployment URL only.
- [ ] **Rollback / fallback path exists.** If the beta deployment surfaces a critical bug, the developer can offer the beta user a bound-copy fallback (a standard bound-sheet copy of CashCompass) within a defined turnaround time. The fallback path is documented before the invite goes out.

If any item is unchecked, the beta user is not invited. The invite goes out only when the full checklist is green.

---

## 10. Open questions

Decision Pending checklist. Every item must be resolved (in writing) before its corresponding phase begins. Deeper Decision Pending lists live in the design / deployment / lifecycle / implementation-plan docs; this list is sequencing-specific.

### Exact first-run UI — Decision Pending
- Layout, copy, and progression of the central-app first-run flow (consent → bootstrap → Setup / Review).
- Whether the first-run UI is a dedicated wizard or reuses Setup / Review.
- Loading-state design during workbook creation.

### Whether the first beta creates a new workbook or connects a template — Decision Pending
- Option A: bootstrap creates a fresh empty workbook (relying on additive ensure-\* helpers).
- Option B: connect-existing flow links a template workbook the developer has pre-populated and shared with the beta user.
- Option C: offer both and let the user choose at first run.
- Each has different testing implications for Phase 3 and Phase 4.

### Deployment access settings for private beta — Decision Pending
- `access` scope for the sandbox deployment (`ANYONE`, `ANYONE_ANONYMOUS`, `DOMAIN`, `MYSELF`).
- The `MYSELF` setting will not work for an external user; one of the broader scopes is required for Phase 5.
- Implications for OAuth verification, Workspace Marketplace eligibility (out of scope but worth noting), and privacy posture.

### Invite / authorization instructions — Decision Pending
- The plain-language onboarding note the family beta user receives before clicking the URL.
- What they need to know about consent, scopes, and what the app will create in their Drive.
- A fallback path written into the note ("if anything looks wrong, close the tab and message me").

### Logging / support strategy — Decision Pending
- How the developer learns about errors the beta user hits (per `CENTRAL_APP_DEPLOYMENT_OPTIONS.md → §8 Support visibility`).
- Whether the app surfaces a "Generate a support diagnostic" action.
- Whether Stackdriver / Cloud Logging is configured for the beta deployment and what gets logged (no PII).

### Which modules are required on day one — Decision Pending
- The Minimum feature set in §4 is a proposal. The final scoped list of modules that **must** work before Phase 5 may be smaller (e.g. omit Investments if the beta user does not need it on day one).
- The minimum-required cut is decided when Phase 4 is planned.

### Whether Bank Import is hidden or included — Decision Pending
- Default assumption (per §3): hidden for the family beta.
- The beta user is unlikely to need Bank Import on day one; it is the largest single subsystem and the first gating candidate post-monetization.
- Whether the menu items / panels are simply hidden, or whether the entire pipeline is left intact but unlinked from the UI, is a sub-decision.

### Beta-to-prod promotion path — Decision Pending
- When the family beta succeeds, what changes between the beta sandbox deployment and a "ready for the next user" state.
- Whether the sandbox deployment becomes the production deployment, or whether a fresh deployment is created from the beta-validated code.
- Out of scope for this plan but worth noting so it does not surprise the next phase.

---

End of document.
