# CENTRAL_APP_WORKBOOK_CREATION_AND_MAPPING_PLAN.md

The first focused architecture plan specifically for **central-mode workbook creation + user-to-workbook mapping**. Establishes preferred directions for the open decisions identified in `CENTRAL_APP_NEXT_STEP_BASELINE.md § 5`, and proposes the smallest end-to-end implementation slice that proves the design without committing to multi-tenant or GA-grade infrastructure.

**Documentation only.** No Apps Script change, no HTML change, no `appsscript.json` change, no deployment change, no OAuth scope change, no implementation. This doc gates the next implementation prompt; it does not authorize one.

Cross-references:
- `CENTRAL_APP_NEXT_STEP_BASELINE.md` — the baseline that produced this plan.
- `CENTRAL_APP_MINIMAL_BETA_PROOF.md` — the onboarding-first product decision (Approach D) that supersedes the original hardcoded-mapping shortcut.
- `CENTRAL_APP_DESIGN.md` — pre-existing architecture surface.
- `CENTRAL_APP_DEPLOYMENT_OPTIONS.md` — `executeAs` / `access` posture.
- `CENTRAL_APP_ONBOARDING_AND_LIFECYCLE.md` — lifecycle reference.
- `CENTRAL_APP_FAMILY_BETA_PLAN.md` — family-beta scope and non-goals.
- `CENTRAL_APP_IMPLEMENTATION_PLAN.md` — overall roadmap.
- `CENTRAL_APP_BOOTSTRAP_COVERAGE_AUDIT.md` — additive bootstrap evidence.
- `CENTRAL_APP_BLANK_WORKBOOK_RUNTIME_REPORT.md` — runtime matrix that proves onboarding from zero sheets.
- `central_resolver.js` — current 1-line pass-through resolver.
- `appsscript.json` — current manifest (`executeAs: USER_DEPLOYING`, `access: MYSELF`).

---

## 1. Purpose

This is the **first** planning pass that treats centralized code and per-user workbooks as the design problem. Earlier docs either described the destination architecture (`CENTRAL_APP_DESIGN.md`), audited a precondition (`CENTRAL_APP_BOOTSTRAP_COVERAGE_AUDIT.md`), or framed a beta-launch shape (`CENTRAL_APP_MINIMAL_BETA_PROOF.md`). None of them resolved the concrete questions a Cursor implementation prompt would need to answer.

Scope of this plan:

- **Centralized code.** A single Apps Script web-app deployment that every beta user invokes — no copied scripts, no per-user editor bindings.
- **Per-user workbooks.** Each user has their own Google Sheets file containing their financial data.
- **Automatic workbook creation / linking.** First-sign-in users get a new workbook created in their Drive (or, optionally, are given a path to link an existing one). No developer in the loop, no manual file copying.
- **Resolver-backed workbook routing.** `getUserSpreadsheet_()` becomes the single function that maps the current authenticated user to their workbook handle, replacing today's pass-through to the bound active spreadsheet.

Explicitly **not** in scope here:
- Multi-tenant SaaS architecture.
- Billing / monetization.
- Admin UI for managing users.
- Migration tooling for any existing developer-owned workbook into the central scheme.
- Bank Import re-enablement.
- Schema versioning beyond a single marker.

---

## 2. Proven assumptions from runtime testing

The runtime evidence accumulated through the blank-workbook matrix (`CENTRAL_APP_BLANK_WORKBOOK_RUNTIME_REPORT.md`) and follow-up fixes establishes the following facts that this plan can build on without re-litigating:

1. **Additive bootstrap works.** Every required sheet has an idempotent, race-safe `ensure*` helper. Populated workbooks are byte-for-byte unaffected by first-create branches.
2. **Onboarding-first flow works.** A user can land in Setup / Review on a fresh workbook and walk through Bank Accounts → Debts → Bills → Cash Flow → Upcoming → Retirement → Houses → Investments → Donations without manual sheet creation.
3. **Lazy creation works.** Surfaces that don't require Setup / Review (Donations, House Values, planner pages) lazy-create their sheets on first read/write or degrade gracefully when prerequisites are absent.
4. **Blank workbook survives.** First launch on a zero-sheet workbook surfaces Setup / Review (not a red banner). `INPUT - Settings` is created additively at the same time.
5. **Setup / Review orchestrates onboarding.** The existing client-side onboarding handoffs (`onboardingOpenBankPage`, `onboardingOpenHousesPage`, etc.) route the user through each section editor in Add-mode on first run.
6. **No copied Apps Script code desired.** The product decision is that beta users never see / never own a copy of the script — the script is centrally deployed once and runs against per-user workbooks the deployment opens by ID.

These assumptions remove the most common architectural risks from the design space — we are not designing "how to bootstrap a workbook" (already proven) but "how to give each user a workbook to bootstrap into".

---

## 3. Required future flow

The target end-to-end first-sign-in flow, expressed as a sequence the central app implements:

```
1.  User opens the central web-app deployment URL.
    ↓
2.  Google OAuth authenticates the user (USER_ACCESSING).
    ↓
3.  Resolver identifies the user via Session.getEffectiveUser().getEmail().
    ↓
4.  Resolver consults the mapping store (PropertiesService).
    ↓
5a. Mapping exists  ─────────────────────────────────┐
    └── Resolver calls SpreadsheetApp.openById(...). │
                                                     │
5b. Mapping missing ─────────────────┐               │
    └── Workbook-create flow:        │               │
        - Drive API: create file in user's Drive.   │
        - Drive API: optionally place in            │
          "CashCompass" subfolder.                  │
        - SpreadsheetApp.openById(newId).           │
        - Run additive bootstrap chain              │
          (ensureInputSettingsSheet_ +              │
          minimal core sheets — already exists).    │
        - Persist mapping in PropertiesService.     │
                                                     │
6.  Resolver returns the resolved Spreadsheet handle.◀
    ↓
7.  Web app renders dashboard:
    - Existing workbook: dashboard or last-visited section.
    - Newly-created workbook: Setup / Review landing surface
      (because Settings is the only sheet with content).
    ↓
8.  User onboards normally via the existing additive bootstrap chain.
    ↓
9.  On second / subsequent sessions, step 5a fires directly.
```

This flow's load-bearing change vs today is **steps 4–5**. Everything before (auth) and after (bootstrap, dashboard rendering) already works in bound mode. The plan below is almost entirely about making steps 4–5 exist.

---

## 4. Candidate workbook creation approaches

Four candidates, evaluated against ownership, permissions, scalability, rollback, onboarding UX, and complexity.

### 4.1 `SpreadsheetApp.create(name)`

- **What it does:** Creates a new spreadsheet in the **effective user's** Drive when running under `USER_ACCESSING`.
- **Ownership:** User-owned (when run as the user). User-owned by the deployer (when run as deployer) — wrong for our use case.
- **Permissions:** No extra OAuth scope beyond the script's own Sheets/Drive defaults.
- **Scalability:** Trivial. One call per first-sign-in user.
- **Rollback:** Easy — orphan a file in the user's Drive (the user can delete it).
- **Onboarding UX:** Invisible to the user except a new file appearing in their Drive.
- **Complexity:** Lowest possible. Single API call.
- **Downside:** Limited control over file location (lands in user's Drive root). No `parents` parameter.

### 4.2 Drive API `Drive.Files.create()` (advanced service)

- **What it does:** Creates a Google Sheets MIME-type file with explicit `parents`, `name`, optional folder placement.
- **Ownership:** User-owned (when run as user via `USER_ACCESSING`).
- **Permissions:** Requires explicit Drive scope (`https://www.googleapis.com/auth/drive.file` is the minimum-permission choice — gives the app access only to files it creates).
- **Scalability:** Same as 4.1.
- **Rollback:** Same as 4.1.
- **Onboarding UX:** Can place the file in a "CashCompass" folder in the user's Drive — nicer than dropping it in root.
- **Complexity:** Slightly higher (advanced Drive service must be enabled in `appsscript.json`).
- **Downside:** One extra OAuth scope to declare. Drive advanced service must be enabled in the script project.

### 4.3 Template-copy approach (`DriveApp.getFileById(templateId).makeCopy(...)`)

- **What it does:** Copy a developer-owned "golden master" workbook into the user's Drive.
- **Ownership:** User-owned after copy.
- **Permissions:** Requires `drive` scope. Template must be readable by the user (typically "Anyone with link" — privacy-noisy).
- **Scalability:** Acceptable but introduces a coupling to a specific template file ID.
- **Rollback:** User can delete the file; but rolling back a broken template means re-copying every existing workbook.
- **Onboarding UX:** Workbook arrives pre-populated, which the user may find confusing if the data isn't theirs.
- **Complexity:** Medium. Requires versioning the template and keeping it in sync with the additive bootstrap chain.
- **Downside:** **Conflicts with the existing additive bootstrap contract.** Today's `ensure*` helpers assume they are creating sheets, not inheriting them; a template-copy flow would silently produce workbooks that bypass every defensive `ensure*` guard. This would re-introduce schema drift the additive contract was designed to prevent.

### 4.4 Empty-sheet + additive bootstrap (recommended)

- **What it does:** Create a fully empty spreadsheet (4.1 or 4.2), then immediately run the existing additive bootstrap chain to seed canonical structure. Identical to what a blank-workbook bound-mode user already experiences today.
- **Ownership:** User-owned (when run as user).
- **Permissions:** Same as the underlying create call (4.1 or 4.2).
- **Scalability:** Same as 4.1 / 4.2.
- **Rollback:** Trivial — orphan the file.
- **Onboarding UX:** Identical to the runtime-tested blank-workbook flow. User sees Setup / Review on first land. **This is already the runtime-verified path.**
- **Complexity:** Lowest end-to-end risk because the bootstrap chain is the same one that has been validated against runtime evidence.
- **Downside:** None vs. the alternatives.

**Preferred direction:** **4.4 — empty-sheet + additive bootstrap**, using **4.2 Drive API `Drive.Files.create()`** under the hood (rather than `SpreadsheetApp.create()`) so the file can be placed in a "CashCompass" folder in the user's Drive and so we use the minimum-permission `drive.file` scope. If folder placement turns out to be a complication, fall back to 4.1 — that is a one-line swap.

---

## 5. Candidate mapping approaches

The mapping stores `effectiveUserEmail → spreadsheetId`. Evaluated against scale, privacy, recovery, and stale-mapping handling.

### 5.1 `PropertiesService.getUserProperties()`

- **Scope:** Per-user. Each user reading their own properties.
- **Scale:** Trivially scalable for family beta (≤10 users). Stays scalable to thousands.
- **Privacy:** Strongest — no central audit log of who has been provisioned. Each user's properties are isolated.
- **Recovery:** **Weakest** — if a user clears their browser/Google session, the per-user property is still in Apps Script's properties store keyed by user, but there is no centralized way for the developer to inspect/repair mappings.
- **Stale handling:** Stale ID → resolver opens it → `openById` throws → recovery path (see §8) attempts re-provisioning.

### 5.2 `PropertiesService.getScriptProperties()` (central registry)

- **Scope:** Single global key-value store accessible to all executions of the deployment.
- **Scale:** ~9KB total / 500KB document-properties cap (per Apps Script quotas). Per-key 9KB cap. Workable for hundreds of users; needs sharding/migration beyond that.
- **Privacy:** Centralized — the script properties dict contains every user's email + workbook ID. Acceptable for family beta; needs revisiting for any public phase.
- **Recovery:** **Strongest** — the developer can inspect / edit / rebuild the mapping table from Apps Script editor.
- **Stale handling:** Same shape as 5.1.

### 5.3 Central registry sheet (separate spreadsheet)

- **Scope:** A dedicated developer-owned spreadsheet (`CashCompass — Admin Registry`) with one row per user.
- **Scale:** Effectively unlimited (Sheets row caps).
- **Privacy:** Centralized, human-auditable. Same family-beta-acceptable / public-rethink shape as 5.2.
- **Recovery:** Strongest of all — directly editable by a human, supports notes/timestamps/status fields.
- **Stale handling:** Same shape as 5.1 / 5.2.
- **Downside:** Introduces a second always-on file the project must own; failure to access it (rare but possible) becomes a single-point-of-failure for the whole deployment.

### 5.4 Hybrid (recommended)

- **Read path:** `PropertiesService.getScriptProperties()` for low-latency reads on every resolver call.
- **Audit / write path:** Mirror writes to the admin registry sheet so the developer always has a human-auditable view.
- **Failure mode:** If the admin sheet is unavailable on write, **do not fail** — log a warning and continue. PropertiesService is the source of truth; the sheet is the audit log.
- **Privacy / scale / recovery:** Inherits the best of 5.2 (fast + recoverable) and 5.3 (auditable).
- **Downside:** Two stores to keep in sync; reconciliation tool needed if they diverge.

### 5.5 Future database / external service

- Out of scope for this plan. Re-evaluate only if the project moves beyond family beta into a multi-tenant SaaS posture. Apps Script's PropertiesService comfortably covers family beta.

**Preferred direction:** **5.4 — hybrid PropertiesService.getScriptProperties() (read/write source of truth) + admin registry sheet (audit log, best-effort)**. For the very first implementation slice (§10), drop the admin sheet entirely and use **5.2 only** — adding the audit sheet is a small follow-up and removing it later if 5.2 is sufficient is also small. Starting without the audit sheet keeps the first slice as narrow as possible.

---

## 6. Resolver evolution

How `getUserSpreadsheet_()` evolves from today's 1-line pass-through to the central-mode shape. Each step is independently shippable.

### 6.1 Today (Phase 1 — pass-through)

```javascript
function getUserSpreadsheet_() {
  return SpreadsheetApp.getActiveSpreadsheet();
}
```

Returns the active bound spreadsheet. Used by every migrated module (resolver phases 2–6 / `quick_add_payment.js`, `debt_payoff_projection.js`, `dashboard_data.js`, `property_performance.js`). Works under `executeAs: USER_DEPLOYING` against the developer-bound spreadsheet.

### 6.2 Step A — feature-flagged central mode

```javascript
function getUserSpreadsheet_() {
  if (!isCentralModeEnabled_()) {
    return SpreadsheetApp.getActiveSpreadsheet();
  }
  return getOrProvisionUserSpreadsheet_();
}
```

Behind a feature flag (script property `CENTRAL_MODE` = `true|false`). When off, byte-for-byte identical to today. When on, branches into the central-mode logic. The feature flag is the rollback mechanism for the entire central-mode milestone.

### 6.3 Step B — mapping lookup

```javascript
function getOrProvisionUserSpreadsheet_() {
  const email = getCurrentUserEmail_();
  if (!email) throw new Error('Central mode requires an identified user.');

  const cached = getCachedSpreadsheetForUser_(email);
  if (cached) return cached;

  const mappedId = lookupSpreadsheetIdForUser_(email);
  if (mappedId) {
    try {
      const ss = SpreadsheetApp.openById(mappedId);
      cacheSpreadsheetForUser_(email, ss);
      return ss;
    } catch (openErr) {
      // Stale / deleted mapping. See §8 for recovery policy.
      return handleStaleMapping_(email, mappedId, openErr);
    }
  }

  return provisionWorkbookForUser_(email);
}
```

`getCurrentUserEmail_()` calls `Session.getEffectiveUser().getEmail()`. `lookupSpreadsheetIdForUser_` reads from PropertiesService (§5.4). `provisionWorkbookForUser_` creates a new file (§4.4) and bootstraps it.

### 6.4 Step C — workbook creation

```javascript
function provisionWorkbookForUser_(email) {
  const file = Drive.Files.create({
    name: 'CashCompass — ' + email,
    mimeType: 'application/vnd.google-apps.spreadsheet'
    // optional: parents: [resolveCashCompassFolderForUser_(email)]
  });

  const ss = SpreadsheetApp.openById(file.id);
  runMinimalBootstrap_(ss); // ensureInputSettingsSheet_ + cosmetics
  writeSpreadsheetIdForUser_(email, file.id);
  cacheSpreadsheetForUser_(email, ss);
  return ss;
}
```

`runMinimalBootstrap_` does **not** seed every canonical sheet — just `INPUT - Settings` (so the runtime-verified blank-workbook flow takes over from the first dashboard render). Every other sheet creates lazily through its existing `ensure*` helper. This avoids duplicating bootstrap logic in two places.

### 6.5 Step D — execution-scoped caching

Cache the resolved Spreadsheet object **per execution**, not per session. Apps Script V8 executions are short-lived; per-execution caching avoids repeated PropertiesService lookups inside a single dashboard load without persisting stale handles across executions.

### 6.6 Resolver contract invariants

For every step above:

1. **The resolver never throws on a recoverable condition.** Stale mapping, deleted workbook, blank mapping — all route into clear recovery paths (§8). It only throws when there is no recovery (e.g., user is anonymous).
2. **Pass-through behavior is preserved under the feature flag.** Bound-mode developers can disable central mode by setting `CENTRAL_MODE=false` and continue developing against the bound spreadsheet with zero behavior change.
3. **No caller is expected to know whether central mode is on.** Every existing caller of `getUserSpreadsheet_()` continues to work without modification.

---

## 7. Workbook ownership model

### 7.1 User-owned workbook (recommended)

The spreadsheet is created in the user's Drive (running under `USER_ACCESSING`).

**Pros:**
- User retains all their data forever, independent of whether they keep using CashCompass.
- Matches Google's user-data-portability norms.
- No data-residency concern for the project — we never hold the user's financial data on our infrastructure.
- Cleanest privacy posture for family beta.
- Cleanest for any future "remove from CashCompass" flow — user just removes our app's access; their file stays.

**Cons:**
- User can rename / move / share the file, which the central app must tolerate (resolver opens by ID, so renames are invisible — already handled).
- If the user deletes the file, the mapping goes stale (§8).

### 7.2 Developer / app-owned workbook (shared with user)

The spreadsheet is created in the developer's Drive (running under `USER_DEPLOYING`) and shared with the user.

**Pros:**
- Centralized data backup is simpler (developer has access to every workbook).

**Cons:**
- Concentrates every user's financial data under the developer's Google account — a data-residency liability the project has explicitly chosen to avoid.
- Quota concentration (developer's Drive holds N user workbooks).
- Doesn't survive the developer being unavailable / leaving / suspended.
- Doesn't compose with any future privacy posture.

### 7.3 Shared ownership

Not supported by Google Drive in the form we'd want. Files have a single owner. Skip.

**Current preferred direction:** **7.1 — user-owned.** This was already the implicit decision in `CENTRAL_APP_MINIMAL_BETA_PROOF.md`'s Approach D adoption; this plan affirms it.

---

## 8. Failure / recovery scenarios

How the resolver and provisioning code handle each adverse case.

### 8.1 Workbook deleted (user emptied their Drive trash)

- Symptom: `SpreadsheetApp.openById(mappedId)` throws.
- Detection: `handleStaleMapping_` catches the open error.
- Recovery: Two options, both surfaced in the planning prompt:
  - **Auto-reprovision** — delete the stale mapping, create a new workbook, persist the new mapping. Pro: invisible to user. Con: the user may have deleted intentionally and now has two empty workbooks if they recover the deleted one.
  - **Show clear message** — surface a dashboard banner "Your CashCompass workbook is no longer available. [Create new workbook]" and require explicit confirmation.
- **Recommended:** show the clear message for the first implementation slice. Auto-reprovision can be added later behind a per-user opt-in.

### 8.2 Permissions revoked (user removed app access)

- Symptom: `SpreadsheetApp.openById` throws an authorization error.
- Detection: Same path as 8.1; distinguish via the error code.
- Recovery: Cannot recover from within the app — user must re-authorize. Show a "Please re-authorize CashCompass to access your data" message with the OAuth re-consent link.

### 8.3 Partial workbook creation

- Symptom: `Drive.Files.create()` succeeds but `runMinimalBootstrap_` or `writeSpreadsheetIdForUser_` fails partway.
- Recovery: The file exists but no mapping was persisted. On the **next** sign-in, the resolver sees no mapping → creates another file → orphans the first.
- Mitigation: Make `provisionWorkbookForUser_` **transactional**:
  1. Create file → record file ID in a local variable.
  2. Run minimal bootstrap → on failure, delete the file (`Drive.Files.remove(fileId)`) and throw.
  3. Write mapping → on failure, delete the file and throw.
  4. Cache and return only after all three succeed.
- Operationally cheap because the bootstrap is small.

### 8.4 Mapping corruption

- Symptom: Mapping value is non-empty but not a valid spreadsheet ID.
- Detection: `openById` throws on the first attempt.
- Recovery: Same as 8.1 — delete the corrupted mapping, surface the clear message.

### 8.5 Stale workbook IDs (mapping survived but workbook was archived/moved)

- Symptom: `openById` succeeds — moving / archiving in Drive doesn't change the ID.
- Recovery: No action needed. The resolver opens the file by ID; the user sees their data regardless of where they moved it.

### 8.6 Bootstrap interruption

- Symptom: First-sign-in user's `runMinimalBootstrap_` partially completes, then fails (network blip, transient API error).
- Recovery: Because the additive bootstrap is idempotent, the **next** sign-in resumes safely. Even if `INPUT - Settings` is half-written, the next `ensureInputSettingsSheet_` call repairs it. No manual intervention required.
- This is the principal reason the additive bootstrap contract is load-bearing for central mode.

### 8.7 Concurrent first-sign-in (two browser tabs)

- Symptom: User opens two tabs of the deployment URL before either finishes provisioning.
- Recovery: Use `LockService.getUserLock()` around `provisionWorkbookForUser_` so only one execution provisions per user. The second waits and then reads the mapping the first wrote.

---

## 9. Deployment / auth considerations

### 9.1 Execute-as posture

- **Required:** `executeAs: USER_ACCESSING`. The file must be created in the user's Drive and the resolver must identify the calling user via `Session.getEffectiveUser()`. Both require `USER_ACCESSING`.
- **Current state:** `appsscript.json` has `executeAs: USER_DEPLOYING`. **Must be flipped** as part of the central-mode rollout — this is the single biggest manifest change required.

### 9.2 OAuth scopes likely needed

The current manifest declares no `oauthScopes`. Apps Script auto-detects scopes from code usage, but auto-detection sometimes over-grants. The central-mode rollout should declare scopes explicitly:

- `https://www.googleapis.com/auth/spreadsheets` — read/write the user's spreadsheet (already implicitly used).
- `https://www.googleapis.com/auth/drive.file` — create new files in user's Drive and access only files the app created (minimum-permission for §4.2).
- `https://www.googleapis.com/auth/userinfo.email` — read the user's email for identification.
- `https://www.googleapis.com/auth/script.scriptapp` (probably auto-detected) — for Apps Script internals.

**Important:** `drive.file` is preferred over `drive` because it limits the app's Drive access to files it created. Family-beta users will see "CashCompass wants access to files it creates" rather than "CashCompass wants access to all your Drive files" — much friendlier consent screen.

### 9.3 Drive permissions

- Files created via Drive API under `USER_ACCESSING` are owned by the user — no extra permission grants needed.
- The script does **not** need access to the user's broader Drive (no `drive` scope), just the files it creates.

### 9.4 Deployment visibility

- **Current state:** `access: MYSELF`. Only the developer can invoke the deployment.
- **Required for family beta:** `access: ANYONE_WITH_GOOGLE_ACCOUNT`. The deployment is invokable by any Google-account holder.
- **Required gating:** Application-level allow-list. The web app's `doGet`/`doPost` entry points should check `Session.getEffectiveUser().getEmail()` against an allow-list (e.g., a script property `FAMILY_BETA_ALLOWLIST` = comma-separated emails) and reject everyone else with a clear "CashCompass is in private beta" message.
- This combination — `ANYONE_WITH_GOOGLE_ACCOUNT` at the platform layer + email allow-list at the app layer — is the family-beta posture.

### 9.5 Private family beta posture

- Deployment runs as each invoking user, gated to an explicit email allow-list.
- No public launch, no marketplace listing, no monetization, no anonymous access.
- The allow-list is human-managed via a script property; no admin UI is built for it yet.

---

## 10. Recommended first implementation slice

Intentionally tiny. One disposable beta account, one created workbook, one persisted mapping, one resumed second-session open. Nothing else.

### 10.1 Slice scope

1. Flip `appsscript.json` to `executeAs: USER_ACCESSING`, `access: ANYONE_WITH_GOOGLE_ACCOUNT`, with explicit `oauthScopes` declared (§9.2).
2. Add allow-list gate on `doGet` — reject everyone except the developer's primary account and one disposable beta account (held in a script property).
3. Add `isCentralModeEnabled_()` feature flag reading a script property; default off so bound-mode dev continues unchanged.
4. Extend `getUserSpreadsheet_()` to the §6.3 / §6.4 shape **behind the feature flag**.
5. Add `provisionWorkbookForUser_` using `Drive.Files.create` + minimal-bootstrap (just `ensureInputSettingsSheet_`).
6. Add `lookupSpreadsheetIdForUser_` / `writeSpreadsheetIdForUser_` using `PropertiesService.getScriptProperties()` (§5.2 only — no admin sheet yet).
7. Add `LockService.getUserLock()` around `provisionWorkbookForUser_` (§8.7).
8. Add transactional file cleanup on bootstrap/mapping write failure (§8.3).
9. Surface a "your workbook is no longer available" message on stale-mapping detection (§8.1) — do not auto-reprovision.

That is the whole slice. No admin UI, no audit log, no recovery automation, no migration tooling, no public access.

### 10.2 Validation

- Disposable second Google account signs in to the deployment URL.
- Observes: web app opens, creates a new spreadsheet in the disposable account's Drive, lands on Setup / Review (because `INPUT - Settings` is the only sheet — same runtime-verified state as bound-mode blank workbook).
- Disposable account completes Setup / Review (Bank Accounts, Debts, Bills, Cash Flow). Data writes succeed.
- Disposable account closes browser, returns next day, signs in: lands directly in the dashboard with their data intact. **This is the success criterion for the entire milestone.**
- Developer signs in to the same deployment URL: lands in **their own** newly-created workbook (or the existing one if a developer mapping has been persisted earlier). Data isolation verified.
- Anonymous Google account not on the allow-list: receives the "private beta" rejection message.

### 10.3 Rollback

- Set `CENTRAL_MODE=false` in script properties → resolver reverts to pass-through.
- Revert `appsscript.json` manifest changes via git.
- Disposable account's workbook remains in their Drive (independently usable as a bound-mode workbook if needed).
- No data is lost; no user is stranded.

### 10.4 Out of scope for this slice

- Audit-log mirror to admin sheet (§5.3 / §5.4 hybrid). Add in a later slice.
- Auto-reprovisioning on stale mapping (§8.1 auto path). Add later.
- Admin UI / allow-list management surface.
- Migration of any existing developer-owned workbook into the central scheme.
- Bank Import.
- Schema-version marker.
- Cold-start performance tuning.
- Generated-sheet formatting polish (covered by `GENERATED_SHEET_FORMATTING_POLISH_PLAN.md`).

---

## 11. Explicit non-goals

For absolute clarity, this plan does **not** cover and the next implementation prompt **must not** include:

- Billing / monetization / paid tiers.
- GA launch / public marketing.
- Google Workspace Marketplace listing.
- Advanced admin tooling (user dashboards, usage analytics, billing console, etc.).
- Analytics / telemetry collection beyond Apps Script's built-in Stackdriver logging.
- Multi-tenant scaling beyond ~10 users in family beta.
- Enterprise compliance concerns (SOC 2, HIPAA, GDPR data-subject-rights tooling, etc.).
- Migrating the developer's existing bound-mode workbook into the central scheme — the developer simply gets a new central-mode workbook on first sign-in (or has theirs pre-provisioned manually via script property edit if desired).
- Cross-user data sharing / collaboration features.
- Mobile-specific UX.

---

## 12. Recommended next step after this doc

The next deliberate step is **one focused implementation planning pass**, not the implementation itself. That planning pass should:

1. Take the §10 slice and break it into ordered sub-slices (e.g., manifest flip → allow-list gate → feature flag → resolver branch → provisioning → mapping persistence → stale-mapping handler → lock).
2. For each sub-slice, define the test that proves it works in isolation.
3. Identify which sub-slices can ship to a bound-mode-only environment (because the feature flag stays off) and which require the manifest flip + allow-list to be live.
4. Sequence the sub-slices so each one is independently shippable and revertible.
5. Re-confirm the OAuth scopes by manually inspecting the Apps Script editor's auto-detected scopes against the §9.2 declared list.

Suggested filename for that doc:

```
CENTRAL_APP_WORKBOOK_CREATION_FIRST_SLICE_PLAN.md
```

That doc, once written and approved, gates the first central-mode implementation prompt. **No central-mode code ships before it exists.**

---

## 13. Sign-off

This is the first focused architecture plan for central-mode workbook creation + per-user mapping. It establishes preferred directions, evaluates alternatives, and proposes the smallest end-to-end slice. It authorizes no implementation; the next required artifact is `CENTRAL_APP_WORKBOOK_CREATION_FIRST_SLICE_PLAN.md` (planning), not code.

End of document.
