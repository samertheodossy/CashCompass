# CENTRAL_APP_DEPLOYMENT_OPTIONS.md

Deployment and security options analysis for the future CashCompass Central App.

This document evaluates the deployment / execution / ownership options available for the centralized Apps Script web app **before any implementation begins**. Every architectural choice that affects who runs code, who owns user data, and who can see what, lives here. Nothing is implemented. Nothing is decided unless explicitly marked. Pending items are marked **Decision Pending**.

Cross-references:
- `CENTRAL_APP_DESIGN.md → §7 Security and deployment decision — unresolved`
- `PROJECT_CONTEXT.md → Future architecture — Central App`
- `ENHANCEMENTS.md → Future direction — Central App / Monetization`
- `WORKING_RULES.md → Central App Transition Rules / Monetization Rules`
- `GoingToProduction.md → Identity & access, Multi-household`

---

## 1. Purpose

This document evaluates deployment and security choices for the future Central App. It is the companion to `CENTRAL_APP_DESIGN.md`, which captures the migration architecture but explicitly defers deployment/security choices.

It exists because:

- The deployment / execution mode and the spreadsheet ownership model are **the single largest blockers to implementation** of the Central App migration.
- Choosing wrong here forces rework across every module that touches user data, and shapes the privacy / support / monetization story for the life of the product.
- The choice must be made on paper, in writing, before any centralized-app code is written. This document is the place where the comparison lives durably.

Out of scope for this document:

- Specific payment-provider selection, billing flows, refund/dispute workflow.
- Marketplace listing mechanics (Google Workspace Marketplace, OAuth verification process).
- Specific Drive API code paths.

In scope:

- The Apps Script web app execution mode (`executeAs` setting).
- The access scope (`access` setting).
- Who owns each user's spreadsheet (user Drive vs developer Drive).
- The privacy, support, monetization, upgrade, and risk consequences of each combination.

---

## 2. Option A — Execute as developer

**Setting:** Apps Script web app deployed with `executeAs: USER_DEPLOYING`.

Every incoming request runs under the developer's Google identity. The developer's Drive credentials are used to read and write user data. Spreadsheets created by bootstrap are typically created in the developer's Drive (and shared with the user), though they could in principle be created in the user's Drive via Drive API on the user's behalf.

### Characteristics

- **Centralized app owns execution.** All Google API calls (`SpreadsheetApp`, `DriveApp`, `MailApp`, `UrlFetchApp`) execute with the developer's privileges. The user's Google session is irrelevant to authorization at the API layer.
- **Easier upgrades / operational control.** A single OAuth scope grant by the developer covers every user's runtime. Users do not have to consent to scopes individually; the developer handles all permission management.
- **Possible simpler monetization.** Because the developer's account is the canonical execution identity, feature gates can read centralized state (e.g. `SYS - Users`) without traversing per-user OAuth boundaries. Plan lookup is a developer-side read; no user consent dance.
- **Stable, predictable performance.** Apps Script quotas are per-effective-user; under `USER_DEPLOYING`, all traffic counts against the developer's quotas — easier to monitor, easier to alert on, but a single budget for everyone.

### Privacy and support implications

- **The developer can technically read every user's financial data.** Code running under `USER_DEPLOYING` has the developer's Drive permissions, which means any line of code, anywhere in the deployment, can open any user's workbook the developer's account has access to.
- This is a substantial trust and liability burden. Users must be told, in plain language, that the developer's account has technical access to their data, even if policy says otherwise.
- Support is easier in one sense: the developer can reproduce a user's issue directly. But every support action has the privacy implication above.
- Audit logging matters more under this mode. Every developer-side read of user data should be loggable, and the policy should constrain what the developer is allowed to look at.

### Spreadsheet ownership questions

- **Developer-owned, shared with user (Option A1).** Bootstrap creates the workbook in the developer Drive and shares it with the user. The developer is the canonical owner. Pros: simpler bootstrap permissions, consistent storage account, easier centralized backup if desired. Cons: developer technically owns user financial data, harder clean exit, raises trust questions for users.
- **User-owned via Drive API (Option A2).** Bootstrap uses Drive API as the user to create a spreadsheet in the user's Drive (requires the script to have Drive scope and to act on the user's behalf — but under `USER_DEPLOYING` the script acts as the developer, not the user, so this would require some additional consent flow). Pros: matches the "your data lives in your Drive" trust pitch. Cons: significantly more complex; partially defeats the simplicity benefit of `USER_DEPLOYING`.
- The simpler combination is A1 (developer-owned). It is also the one with the heaviest trust consequence.

### Risk: developer account is too powerful

- Under `USER_DEPLOYING`, the developer account becomes a high-value target. A single compromise of that account exposes every user's financial data.
- Compensating controls (2FA, key rotation, audit logging) become operational requirements, not nice-to-haves.
- This is not a reason to reject `USER_DEPLOYING` outright, but the operational cost of running it safely is meaningfully higher than running `USER_ACCESSING` safely.

### Where Option A fits

- Strong fit when: monetization is a near-term priority, support burden must be minimized, the developer is willing to take on the trust/liability profile of holding user data, and clear privacy policy + audit controls are in place.
- Weak fit when: user trust ("my financial data is in my Drive, not yours") is a primary product value, or the developer wants to minimize liability exposure to compromised credentials.

---

## 3. Option B — Execute as user *(Preferred Direction)*

**Setting:** Apps Script web app deployed with `executeAs: USER_ACCESSING`.

**Status:** This is the **preferred current direction** for the Central App migration. See §7 for the rationale. Options A and C remain documented as alternatives so the trade-off stays visible and can be revisited if the operating context changes.

Every incoming request runs under the calling user's Google identity. The user's Drive credentials are used to read and write their own data. Spreadsheets created by bootstrap live in the user's Drive.

### Characteristics

- **Actions run under user identity.** All Google API calls execute with the user's privileges. The developer's identity is not used to read or write user data at runtime.
- **Clearer user ownership model.** The user owns their own spreadsheet, in their own Drive. The developer does not technically have access to it unless the user explicitly shares it.
- **Drive / spreadsheet access follows user permissions.** If a user revokes the script's OAuth grant, or removes the script from their Drive, the script can no longer touch their data. Revocation is clean.
- **More consent / auth complexity.** Each user must individually consent to the OAuth scopes the script needs. If a new feature later requires a new scope, every user must re-consent.

### Privacy implications

- **The developer cannot read user data through the script.** This is the strongest privacy posture available without leaving Apps Script.
- The privacy policy can truthfully say "your data lives in your Drive, and the developer cannot read it." That is a meaningful product differentiator.
- Email leakage is limited to whatever the user explicitly sees (e.g. planner email; the user is the sender under `USER_ACCESSING`).

### Support and upgrade-control implications

- **Support is harder.** The developer cannot reproduce a user's issue by opening their workbook. Debugging relies on: user-reported logs, user-exported workbooks shared manually with the developer, or screen-share sessions. None of these scale well.
- **Upgrades remain centralized at the code layer.** The deployed script version is still the source of truth — pure code/UI fixes propagate automatically.
- **Schema upgrades still work additively.** Ensure-* helpers run under the user's identity, so they create missing structure inside the user's own workbook. This is functionally identical to bound-sheet behavior today.
- **Quota model changes.** Under `USER_ACCESSING`, quotas are per-user. This is healthier at scale (one heavy user does not starve other users) but harder to monitor centrally.

### Monetization implications

- **Centralized feature gating still works.** Gating decisions live in code, which is centralized. The deployed code is the same for everyone; gating reads a centralized record of who is paying.
- **However, the gating read is more complex.** Under `USER_ACCESSING`, the script's Drive credentials are the user's, not the developer's. Reading `SYS - Users` (which would live in a developer-controlled admin spreadsheet) requires the developer's admin spreadsheet to be **shared with every user** at least at read level — which leaks plan data and is fragile.
- The workable pattern is: a small **proxy** read of `SYS - Users` through a developer-owned Apps Script library or a `URLFetch` to a developer-controlled bridge endpoint. This is more moving parts than Option A, but it preserves the privacy guarantee.
- **Alternative pattern:** plan state is encoded in a signed token (e.g. JWT) issued by a developer-controlled bridge and stored in the user's `UserProperties`. The script verifies the token without reading any admin sheet. Defers operational complexity but adds cryptographic key management.

### Where Option B fits

- Strong fit when: user trust is a primary product value, the developer wants minimum liability exposure, and the support team is willing to take on the cost of "cannot reproduce without the user's help."
- Weak fit when: monetization must ship quickly with a centralized plan lookup, or support burden is the deciding factor.

---

## 4. Option C — Hybrid model

A split where centralized state lives in a developer-controlled location and user-owned spreadsheets live in user Drives, joined by a thin developer-controlled service layer (Apps Script library, web app bridge, or similar).

### What "hybrid" means in this context

There are several flavors. The shared idea is: **execution mode is `USER_ACCESSING`** (so user data stays in user Drive under user credentials), **plus** a separate developer-controlled surface for the metadata that genuinely needs to be centralized (plan lookups, mapping registry, optional audit logging).

### Possible shapes

- **C1 — Per-user execution + developer Apps Script library.** The user-facing web app runs `USER_ACCESSING`; it calls into a developer-owned Apps Script library to read centralized plan state. The library executes under the developer's identity for the duration of that call. Risk: library calls inherit the developer's privileges, which partially reintroduces Option A's trust profile for those calls — must be scoped tightly.
- **C2 — Per-user execution + external bridge.** The user-facing web app runs `USER_ACCESSING`; for plan lookups, it calls a developer-controlled HTTPS endpoint (Cloud Run, Cloud Functions, or a separate Apps Script web app deployed `USER_DEPLOYING`) via `UrlFetchApp` with a shared secret. The bridge owns plan state and exposes a narrow read API. Risk: introduces a non-Apps-Script dependency; the bridge becomes its own deployable.
- **C3 — Per-user execution + signed entitlement tokens.** The user-facing web app runs `USER_ACCESSING`. A developer-controlled service (run rarely, e.g. on payment events) issues signed tokens describing the user's plan. The token is stored in the user's `UserProperties` and verified locally without calling out. Risk: key management; revocation latency (tokens are valid until they expire).

### Why this may or may not fit Apps Script

- **Fits well:** Apps Script supports `UrlFetchApp`, signed-token verification via crypto utilities, and library inclusion. None of the hybrid shapes require capabilities Apps Script lacks.
- **Friction points:**
  - Apps Script libraries run as the developer when imported by a `USER_ACCESSING` script — that boundary is exactly the privacy concern Option B is meant to avoid. Tight scoping of library calls is mandatory.
  - External bridges (C2) introduce another deployable, another set of secrets, and another failure mode.
  - Signed-token approaches (C3) require key rotation discipline that is currently not in the project.

### What must be verified before relying on hybrid

- **Library boundary behavior** under `USER_ACCESSING` must be verified empirically. Specifically: when a `USER_ACCESSING` script imports a developer-owned Apps Script library, which identity runs the library code, and what scopes does the library inherit? **Decision Pending.**
- **Quota implications.** Library calls and `UrlFetchApp` calls have their own quota envelopes. The combined budget under typical traffic patterns must be sized before committing.
- **Failure modes.** If the bridge or library is down, the user-facing app must fail gracefully to the free tier per `WORKING_RULES.md → Monetization Rules`. The hybrid path must be tested under bridge-down conditions before launch.

### Where Option C fits

- Strong fit when: the project wants Option B's privacy posture *and* Option A's centralized monetization ergonomics, and is willing to take on the operational complexity of one extra deployable / one extra key.
- Weak fit when: the project wants to minimize the number of moving parts.

---

## 5. Comparison table

| Dimension | Option A — Execute as developer | Option B — Execute as user | Option C — Hybrid |
|---|---|---|---|
| **User identity at runtime** | Developer (single identity for all requests) | Calling user (per-request identity via `Session.getEffectiveUser()`) | Calling user for user data; developer for centralized metadata calls only |
| **Spreadsheet ownership** | Typically developer-owned, shared with user (A1); user-owned via Drive API possible but complex (A2) | User-owned in user Drive | User-owned in user Drive |
| **Drive permissions model** | Developer Drive credentials for all reads/writes | User Drive credentials for all reads/writes | User Drive for user data; developer-controlled surface for plan/metadata |
| **Privacy posture** | Developer technically has access to all user data; policy required | Developer cannot read user data through the script | Developer cannot read user data through the script; can read centralized metadata only |
| **Support / debugging** | Developer can reproduce user issues directly (with policy controls) | Developer cannot reproduce without user help (export, screen-share) | Same as Option B for user data; centralized metadata is debuggable |
| **Monetization (plan lookup)** | Simple: centralized read inside developer identity | More complex: requires admin spreadsheet shared with all users, a library call, a bridge, or signed tokens | Designed for this: developer-controlled bridge/library handles plan lookup |
| **Upgrade control (code)** | Centralized — single deploy reaches everyone | Centralized — single deploy reaches everyone | Centralized — single deploy reaches everyone (plus separate bridge deploy if used) |
| **Upgrade control (schema)** | Additive ensure-* helpers run as developer against user workbooks | Additive ensure-* helpers run as user against their own workbook | Same as Option B for user workbooks |
| **OAuth consent flow** | Developer consents once; users see no scope prompt | Each user consents individually on first run; re-consent on scope changes | Each user consents individually (same as B) |
| **Revocation when user leaves** | Developer must explicitly remove access; data can persist in developer Drive | User can revoke OAuth grant cleanly; their workbook stays in their Drive | Same as Option B for user data |
| **Quota model** | Single developer-side budget for everyone | Per-user budgets (healthier at scale) | Per-user for user-facing; separate budget for bridge |
| **Risk profile (compromise impact)** | High — developer account compromise exposes all users | Lower — compromise of one user account exposes only that user | Lower for user data; bridge/library is a separate (smaller) attack surface |
| **Operational complexity** | Lowest — one deployable | Low — one deployable, but harder support | Highest — two deployables and/or key management |
| **Marketplace / public distribution readiness** | Requires explicit privacy policy and audit controls | Cleanest story to publish ("your data stays in your Drive") | Cleanest story, with caveats about the bridge |

---

## 6. Decision criteria

What CashCompass needs most, derived from the existing project docs. The chosen option must satisfy these in priority order.

1. **Per-user spreadsheet isolation.** Each user's financial data must live in a separate spreadsheet, never commingled with other users'. This is non-negotiable and is met by all three options at the spreadsheet layer.
2. **Blank-workbook resilience.** Every read path must tolerate missing structure and surface a `state` field, never throw red banners. Met by all three options because the ensure-* helper pattern is identity-agnostic.
3. **Safe additive upgrades.** Bootstrap and upgrade flows must never reformat or rewrite existing user content. Met by all three options because the rule lives in the ensure-* helpers, not in the execution mode.
4. **Low support burden.** Support must be able to help a user without an excessive ceremony. Option A is strongest here; Option B is weakest. Option C is between them.
5. **Future paid feature gating.** Plan state must be centrally controllable. Option A is simplest; Option C is designed for it; Option B needs extra plumbing.
6. **User trust and privacy.** Users should be able to trust that the developer cannot casually read their data. Option B is strongest; Option C inherits Option B's posture for user data; Option A requires explicit policy.
7. **Staged migration from bound mode.** Both modes must coexist for the full duration of the migration without regressing existing users. All three options support staged migration because the bound-sheet code path is preserved by the resolver abstraction (`CENTRAL_APP_DESIGN.md → §6`).
8. **Operational simplicity.** Fewer moving parts is better, all else equal. Option A wins on this dimension; Option C loses.

### Weighting

The project documents repeatedly emphasize **user trust** (`README.md → Future Direction`: "your data lives in your Drive") and **defense by design** (`WORKING_RULES.md → Monetization Rules`: "always fail gracefully"). They also emphasize **minimum moving parts** during V1.2 (`WORKING_RULES.md → Current phase`).

These pull in opposite directions. Weighing them in writing is what §7 does: trust is the deciding criterion for a personal finance product, so user-ownership and `USER_ACCESSING` are preferred even though they cost some operational simplicity. Implementation details (especially how centralized plan lookup is plumbed under `USER_ACCESSING`) remain Decision Pending in §8.

---

## 7. Preferred Direction

**Status: Preferred Direction — Option B (Execute as user) with centralized code and user-owned spreadsheets.**

The Central App migration will be designed against this combination:

- **Centralized code.** One Apps Script web app deployment is the source of truth. Upgrades and feature gating decisions live in code that ships once and reaches everyone immediately.
- **User-owned spreadsheets.** Each user's workbook is created in (or already lives in) the user's own Google Drive. The user is the canonical owner of their financial data.
- **Execute as user (`executeAs: USER_ACCESSING`).** Every request runs under the calling user's identity. The script reads and writes only what the user has consented to.

### Why this is the preferred direction

- **Stronger user-ownership and privacy boundary.** User data lives in the user's Drive under the user's credentials. The developer does not technically have access to user spreadsheets through the script's runtime identity.
- **Better trust story for finance data.** "Your financial data lives in your Google Drive — we cannot read it through the script" is a meaningful, defensible claim. For a personal finance product, this is a primary product value rather than a nice-to-have.
- **Drive access follows user permissions.** Authorization is a natural by-product of the user's own OAuth grant. There is no parallel permission model to keep in sync. Revocation is clean: when a user withdraws the OAuth grant or deletes their workbook, the script's access ends with it.
- **Lower risk of developer account having broad access.** Compromise of the developer account does not expose user financial data, because the developer's identity is not used to read or write user workbooks at runtime. The blast radius of a credential compromise is dramatically smaller than under `USER_DEPLOYING`.
- **Still supports centralized upgrades and feature gating at the app layer.** The deployed code is centralized regardless of execution mode. Pure code/UI fixes propagate automatically. Schema upgrades remain additive via the existing ensure-* helper pattern, executing under the user's identity against the user's own workbook (functionally identical to today's bound-sheet behavior). Feature gating decisions live in code; the *plumbing* for plan lookup needs to be designed around `USER_ACCESSING` (see Decision Pending items in §8), but the *capability* to gate is preserved.

### Trade-offs accepted by this direction

- **Higher support burden.** The developer cannot reproduce a user issue by opening their workbook directly. Support relies on user-driven channels: exported workbooks shared on request, screen-share sessions, or detailed user logs. This is accepted as the cost of the stronger privacy posture.
- **More OAuth consent surface.** Each user consents individually on first run, and any new scope added later forces a re-consent. This is accepted; scope discipline becomes part of the design (request only what each feature genuinely needs).
- **Centralized plan lookup needs extra plumbing.** Reading entitlement state from a developer-controlled location under `USER_ACCESSING` is not a single-line operation. The exact mechanism (proxy library, external bridge, signed token) is a Decision Pending item in §8; the *capability* is preserved, but the implementation will be more involved than under Option A.

### Why Options A and C remain documented

Options A (Execute as developer) and C (Hybrid) stay in this document as live alternatives, not historical artifacts. They are retained because:

- The trade-off is real and can re-balance if the operating context changes — for example, if support volume becomes the dominant pressure, or if a marketplace listing review forces a specific execution mode.
- Pieces of Option C (specifically C2 — external bridge, or C3 — signed entitlement tokens) are the most likely implementation patterns for the centralized plan-lookup plumbing that Option B needs. Option C is not just an alternative; parts of it may become tactical building blocks under the Option B umbrella.
- Per `CENTRAL_APP_DESIGN.md → §9 Guardrails`, the project does not erase considered alternatives. They remain visible so the next contributor sees what was weighed.

### What this preference does **not** authorize

- No implementation begins on the basis of this preference. The Decision Pending items in §8 must still be answered in writing before any centralized-app code is written. Per `CENTRAL_APP_DESIGN.md → §9 Guardrails`: *"No implementation until design decisions are documented."*
- No deployment settings change. The active deployment remains `executeAs: USER_DEPLOYING`, `access: MYSELF` (single-user / household mode) until the migration is explicitly approved and pulled into a roadmap phase.

---

## 8. Open questions

Final checklist. Every item here must be resolved (in writing) before any centralized-app code is written.

### Spreadsheet ownership — Top-level Preferred (user-owned); implementation details Decision Pending
- **Top-level direction (per §7):** user-owned — the workbook created at bootstrap lives in the user's own Drive.
- **Decision Pending:** Which Drive API surface and which OAuth scope is used at first run to create the workbook in the user's Drive under `USER_ACCESSING`?
- **Decision Pending:** What is the fallback if a user does not consent to the Drive scope required for workbook creation? (Graceful "feature unavailable" message vs blocking the app entirely.)
- **Decision Pending:** Does the bootstrap place the workbook in a CashCompass-named Drive folder, at the Drive root, or let the user pick?

### First-run onboarding flow — Decision Pending
- What is the user-visible sequence on first run under `USER_ACCESSING`? (OAuth consent → create workbook → land on Setup / Review → first save.)
- How does the existing Setup / Review surface (`Dashboard_Script_Onboarding.html`) integrate with the central-app bootstrap? Today it runs after the user already has a workbook; in central-app mode it runs immediately after bootstrap completes.
- How are bootstrap failures surfaced (Drive quota exhausted, scope denied, transient Drive API error)?
- Cross-reference: `CENTRAL_APP_DESIGN.md → §5 Bootstrap creation strategy` (frozen template vs programmatic seed) — that choice and this onboarding flow must be designed together.

### Mapping storage — Decision Pending
- Where are user-to-spreadsheet ID mappings stored: `PropertiesService.getUserProperties()` (per-user, lightweight) or a central registry sheet (`SYS - User Workbooks` in an admin spreadsheet)?
- If `UserProperties`: what is the recovery semantics when the mapping points to a deleted / inaccessible spreadsheet?
- If central registry: where does that registry live, who owns it, and how is it backed up?

### User identity resolution — Decision Pending
- Under which execution mode (A / B / C) does the resolver run?
- Which identity source: `Session.getEffectiveUser().getEmail()` or `Session.getActiveUser().getEmail()`?
- What is the documented behavior when the email is unavailable (consumer Gmail rate-limit edge cases, anonymous access if `access: ANYONE_ANONYMOUS` ever applies)?

### Revocation behavior — Decision Pending
- What happens if a user revokes the script's OAuth grant?
- What happens if a user deletes the spreadsheet the mapping points to?
- What happens if a user shares their spreadsheet with someone else, or moves it to a Shared Drive?
- Is there a "leave CashCompass" flow that proactively cleans the mapping, or is it lazy?

### Paid feature enforcement — Decision Pending
- Where does plan state live: `SYS - Users` in an admin spreadsheet, an external bridge, a signed token in `UserProperties`?
- How does the gating helper read it under the chosen execution mode without leaking plan data to other users?
- What is the failure-mode default when plan lookup fails? (`WORKING_RULES.md → Monetization Rules` requires defaulting to `'free'`; this confirms the rule applies here.)
- What is the latency budget on plan lookup? Cached per request, per session, or uncached?

### Support visibility — Decision Pending
- Under the chosen execution mode, what can a support contact see when a user reports an issue?
- What channels exist for the user to share enough context to debug (export workbook? share read access on request? screen-share?).
- What is the written policy on developer access to user data, regardless of what is technically possible under the chosen mode?

### Marketplace / public distribution readiness — Decision Pending
- If/when CashCompass goes on the Google Workspace Marketplace, which execution mode is acceptable to Google's review process for a finance app?
- Which scopes are required, and which can be deferred via incremental authorization?
- What documentation, privacy policy, and terms-of-service language is required to publish?
- Is verified OAuth required, and what is the cost (time, security review) of verification?

### Cross-cutting trust posture — Resolved (per §7)
- **Resolved:** the documented product value is "your financial data lives in your Drive, the developer cannot read it through the script." Option B (`USER_ACCESSING`) with user-owned spreadsheets is the preferred direction.
- This resolution unlocks the remaining Decision Pending items above — they can now be answered against a single assumed execution mode and ownership model.
- Options A and C remain documented as alternatives (per §7) so the trade-off stays visible if the operating context changes.

---

End of document.
