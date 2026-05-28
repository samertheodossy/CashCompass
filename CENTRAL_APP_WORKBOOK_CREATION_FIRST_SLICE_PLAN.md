# CENTRAL_APP_WORKBOOK_CREATION_FIRST_SLICE_PLAN.md

The **final** planning layer before the first central-mode implementation prompt. Pins every concrete decision the implementation prompt would otherwise have to make on the fly — manifest, OAuth scopes, feature flag name/default, allow-list shape, exact resolver function signatures, workbook creation step ordering, lock semantics, rollback steps, and runtime acceptance criteria.

This doc inherits its scope from `CENTRAL_APP_WORKBOOK_CREATION_AND_MAPPING_PLAN.md` and its baseline from `CENTRAL_APP_NEXT_STEP_BASELINE.md`. It does **not** re-relitigate decisions resolved upstream; it simply pins them in implementation-ready form.

**Documentation only.** No Apps Script change, no HTML change, no `appsscript.json` change, no deployment change, no implementation. This is the implementation gate; the next implementation prompt **may not run until this doc is reviewed and committed**.

Cross-references:
- `CENTRAL_APP_NEXT_STEP_BASELINE.md` — milestone framing.
- `CENTRAL_APP_WORKBOOK_CREATION_AND_MAPPING_PLAN.md` — architecture plan this slice instantiates.
- `CENTRAL_APP_MINIMAL_BETA_PROOF.md` — onboarding-first product decision (Approach D).
- `CENTRAL_APP_DEPLOYMENT_OPTIONS.md` — `executeAs`/`access` posture reference.
- `CENTRAL_APP_FAMILY_BETA_PLAN.md` — family-beta scope and non-goals.
- `CENTRAL_APP_BLANK_WORKBOOK_RUNTIME_REPORT.md` — runtime evidence the bootstrap chain is sufficient.
- `central_resolver.js` — current 1-line pass-through.
- `appsscript.json` — current manifest (`executeAs: USER_DEPLOYING`, `access: MYSELF`, no explicit `oauthScopes`).

---

## 1. Purpose

To remove every remaining ambiguity from the upstream architecture plan so the first central-mode implementation prompt can be a mechanical translation of this doc into code. Every "TBD" in the architecture plan that could be decided without runtime evidence is pinned here. Items that genuinely require runtime evidence (e.g., the exact text of Google's consent screen for the chosen `oauthScopes`) are flagged as runtime-verification items, not decision items, so the implementation prompt knows to observe them rather than invent them.

This is the **last** doc-only step before code touches central mode. The next artifact after this one is an implementation prompt.

---

## 2. Exact scope of the first slice

The first slice is intentionally minimal and is bounded by every item in the lists below. Anything not in §2.1 is out of scope and must be deferred to a later slice.

### 2.1 In scope

- One **disposable second Google account** (a throwaway personal Gmail held by the developer for testing purposes, never used for real data).
- One **central web-app deployment** of the existing CashCompass Apps Script project.
- One **auto-created spreadsheet** in the disposable account's Drive, named per the convention in §7.2.
- One **`PropertiesService.getScriptProperties()` mapping entry** of the shape `mapping::<sha256(email)>` → `<spreadsheetId>` (see §6.4 for the keying rationale).
- One **end-to-end onboarding flow** from first sign-in through Setup / Review, identical to the runtime-verified blank-workbook bound-mode flow.
- The developer's primary Google account, also gated through the same allow-list, so the developer can dogfood the central-mode deployment.

### 2.2 Out of scope (deferred to later slices)

- Any second / third / Nth user beyond the two accounts above.
- Public onboarding.
- Monetization or paid tiers.
- Marketplace listing or any public promotion.
- Migration of the developer's existing bound-mode workbook into the central scheme.
- Admin UI for managing the allow-list or the mapping store.
- Audit-log sheet mirror of `PropertiesService` (the §5.4 hybrid from the architecture plan).
- Auto-reprovisioning on stale mapping (manual re-create only).
- Cold-start performance tuning.
- Generated-sheet formatting polish (separate workstream — `GENERATED_SHEET_FORMATTING_POLISH_PLAN.md`).
- Bank Import (out of family-beta scope per `CENTRAL_APP_FAMILY_BETA_PLAN.md`).
- Schema-version marker beyond what the existing `ensure*` chain produces.

---

## 3. Manifest / deployment changes

The exact `appsscript.json` shape required for the first slice.

### 3.1 Pinned manifest fields

- **`executeAs`** = `USER_ACCESSING`. Required so `Session.getEffectiveUser()` returns the calling user and so `Drive.Files.create()` creates the file in the calling user's Drive.
- **`access`** = `ANYONE` (manifest enum; deployment UI label: "Anyone with a Google account"). Clasp's manifest validator rejects `ANYONE_WITH_GOOGLE_ACCOUNT` — the accepted enum set is `[UNKNOWN_ACCESS, DOMAIN, ANYONE, ANYONE_ANONYMOUS, MYSELF]`, so `ANYONE` is the correct token for the "any signed-in Google account" posture (`ANYONE_ANONYMOUS` would additionally allow truly anonymous unauthenticated hits, which is not what we want). Required so the disposable second account can invoke the deployment without the developer pre-sharing access. **App-layer allow-list (§5) is what actually gates use.**
- **`oauthScopes`** explicitly declared. The implementation prompt must add:
  - `https://www.googleapis.com/auth/spreadsheets` — read/write user's spreadsheet (already used implicitly).
  - `https://www.googleapis.com/auth/drive.file` — minimum-permission scope for creating new files in user's Drive and accessing only files the app created. **Preferred over `drive`** because the consent screen is much friendlier ("access files this app creates" vs "access all your Drive files").
  - `https://www.googleapis.com/auth/userinfo.email` — read the calling user's email for identification.
  - Any additional scope Apps Script auto-detects from existing code (e.g., `script.scriptapp`, `script.external_request` if used). Implementation prompt must compare the auto-detected list (visible in the Apps Script editor → Project Settings → Scopes) against this declared list and add any missing scopes the existing codebase relies on so authorization does not regress for already-working features.

### 3.2 Drive Advanced Service requirement

- **`Drive`** advanced service must be enabled in the Apps Script project (Services menu → add `Drive API v3`) so `Drive.Files.create(...)` is available. The implementation prompt must update `appsscript.json` to add the `dependencies.enabledAdvancedServices` entry, e.g.:
  ```json
  "dependencies": {
    "enabledAdvancedServices": [
      { "userSymbol": "Drive", "serviceId": "drive", "version": "v3" }
    ]
  }
  ```
- The Drive API itself must also be enabled in the **linked Google Cloud project** (Apps Script will prompt this automatically the first time a user authorizes the new manifest). This is a one-time per-project setup.

### 3.3 Deployment isolation strategy

- **Use a NEW dedicated web-app deployment** for the first slice. Do **not** modify the existing developer-bound deployment.
- Naming convention: `CashCompass — Central Beta (Slice 1)` so it is visually distinct from any existing deployment in the Apps Script Deployments dialog.
- The new deployment gets its own deployment URL. The developer-bound deployment (if any) continues to work unchanged for any existing developer flows.
- Rationale: a separate deployment lets us revert the central slice by deleting/disabling the deployment without touching the bound-mode deployment, and isolates the OAuth consent grant to a single URL.

### 3.4 Deployment posture summary

| Field | Current (bound) | First slice (central) |
|---|---|---|
| `executeAs` | `USER_DEPLOYING` | `USER_ACCESSING` |
| `access` | `MYSELF` | `ANYONE` (UI: "Anyone with a Google account") |
| `oauthScopes` | (auto-detected) | explicitly declared (§3.1) |
| Drive advanced service | not enabled | **enabled v3** |
| Deployment | existing | **new, dedicated** |
| App-layer gate | none | email allow-list (§5) |

---

## 4. Feature-flag strategy

The single mechanism by which central-mode code is enabled or rolled back without redeploying.

### 4.1 Flag name and storage

- **Name:** `CENTRAL_MODE`.
- **Storage:** `PropertiesService.getScriptProperties()`. Set/read via the Apps Script editor's Project Settings → Script Properties UI.
- **Type:** string `"true"` / `"false"`. Anything other than the literal string `"true"` is treated as `false`.

### 4.2 Default value

- **Default:** `false` (i.e., the property is unset, or set to `"false"`). When unset, the resolver behaves exactly as today — `SpreadsheetApp.getActiveSpreadsheet()` pass-through.
- This default is the rollback (§10) and the safety net during development.

### 4.3 Behavior when `false`

- `isCentralModeEnabled_()` returns `false`.
- `getUserSpreadsheet_()` returns `SpreadsheetApp.getActiveSpreadsheet()`, byte-for-byte identical to today.
- All other central-mode functions (`provisionWorkbookForUser_`, etc.) exist in the codebase but are never reached.
- The allow-list gate on `doGet` (§5) **still runs** even when `CENTRAL_MODE=false`, because the new deployment is `access: ANYONE` (UI: "Anyone with a Google account") and we don't want non-allow-listed Google accounts hitting the URL even in a degraded state. (The bound deployment is unaffected — its `access: MYSELF` still gates it.)

### 4.4 Behavior when `true`

- `isCentralModeEnabled_()` returns `true`.
- `getUserSpreadsheet_()` routes into `getOrProvisionUserSpreadsheet_()` (§6).
- All other central-mode functions are reachable.
- The allow-list gate still runs (as it should at any time).

### 4.5 Flag flip procedure

- **Enable:** Apps Script editor → Project Settings → Script Properties → set `CENTRAL_MODE` = `true`. No redeploy required. Effect is immediate on next invocation.
- **Disable:** Set `CENTRAL_MODE` = `false` (or delete the property). No redeploy required. Effect is immediate on next invocation.

---

## 5. Allow-list strategy

How the deployment enforces "only these two emails may use it" while the manifest is `access: ANYONE` (UI: "Anyone with a Google account").

### 5.1 Allowed beta-user emails

For the first slice, the allow-list contains exactly two emails:

1. The developer's primary Google account email.
2. The disposable second Google account email.

Stored as a script property:

- **Property name:** `FAMILY_BETA_ALLOWLIST`.
- **Property value:** comma-separated, case-insensitive, whitespace-tolerant. Example: `developer@example.com, throwaway-cashcompass@gmail.com`.

### 5.2 Behavior for unauthorized users

- The `doGet` (and any `doPost`) entry point calls a new `isAllowlistedUser_()` helper before any other work.
- `isAllowlistedUser_()` reads `FAMILY_BETA_ALLOWLIST`, splits on commas, trims whitespace, lowercases, and compares against `Session.getEffectiveUser().getEmail().toLowerCase()`.
- If the calling user is not on the list: return a minimal `HtmlOutput` containing the message:

  ```
  CashCompass is currently in private beta.
  If you believe you should have access, please contact <developer email>.
  ```

  No data is loaded, no resolver is called, no Drive write happens. The unauthorized user simply sees the message.

- If the calling user **is** on the list: control proceeds to the existing dashboard rendering / resolver path.

### 5.3 Allow-list storage location

- **Script properties** only, as above. No sheet, no separate file.
- Rationale: family-beta scale is ~10 users at the absolute outside; script properties are the lightest possible store. Migrating to a sheet or a database is a later-slice concern.

### 5.4 Temporary vs future approach

- **Temporary (first slice):** flat string in script properties, manually edited by the developer in the Apps Script editor.
- **Future (deferred):** a small admin sheet (e.g., `CashCompass — Admin Allowlist`) with per-row metadata (email, added date, status, notes), read by the same `isAllowlistedUser_()` helper. Not for this slice.

---

## 6. Resolver evolution

Exact function signatures and behavior for the first slice's central-mode resolver.

### 6.1 Pinned function inventory

The implementation prompt must produce exactly these functions (in `central_resolver.js`, the existing file). Names are pinned; signatures are pinned.

| Function | Returns | Throws | Notes |
|---|---|---|---|
| `isCentralModeEnabled_()` | `boolean` | never | Reads `CENTRAL_MODE` script property. |
| `getCurrentUserEmail_()` | `string` (lowercase) or empty string | never | `Session.getEffectiveUser().getEmail() \|\| ''`, lowercased. |
| `getUserSpreadsheet_()` | `Spreadsheet` | only if no recovery is possible | Top-level entry, replaces today's body. |
| `getOrProvisionUserSpreadsheet_()` | `Spreadsheet` | as above | Central-mode branch of `getUserSpreadsheet_`. |
| `lookupSpreadsheetIdForUser_(email)` | `string \| null` | never | Reads `PropertiesService.getScriptProperties()`. |
| `writeSpreadsheetIdForUser_(email, spreadsheetId)` | `void` | only on PropertiesService failure | Writes the mapping. |
| `provisionWorkbookForUser_(email)` | `Spreadsheet` | on Drive API failure or bootstrap failure (after cleanup) | The transactional create+bootstrap+persist sequence. |
| `runMinimalBootstrap_(ss)` | `void` | only on `ensureInputSettingsSheet_` failure | Wraps the single existing helper. |
| `handleStaleMapping_(email, mappedId, openErr)` | `Spreadsheet` (never, in first slice) — actually throws `StaleMappingError` | yes | First slice surfaces a user-visible error; no auto-reprovision. |
| `clearMappingForUser_(email)` | `void` | never | Used by manual recovery only; not auto-called in first slice. |

### 6.2 `getUserSpreadsheet_()` body (pinned)

The first slice replaces the current 1-line body with exactly this shape (pseudocode-precise, the implementation prompt will translate to JS):

```javascript
function getUserSpreadsheet_() {
  if (!isCentralModeEnabled_()) {
    return SpreadsheetApp.getActiveSpreadsheet();
  }
  return getOrProvisionUserSpreadsheet_();
}
```

No execution-level caching in the first slice — keep behavior easy to reason about and easy to revert. Per-execution caching is a later optional refinement.

### 6.3 `getOrProvisionUserSpreadsheet_()` body (pinned)

```javascript
function getOrProvisionUserSpreadsheet_() {
  const email = getCurrentUserEmail_();
  if (!email) {
    throw new Error('Central mode requires an identified user (Session.getEffectiveUser returned empty).');
  }

  const mappedId = lookupSpreadsheetIdForUser_(email);
  if (mappedId) {
    try {
      return SpreadsheetApp.openById(mappedId);
    } catch (openErr) {
      return handleStaleMapping_(email, mappedId, openErr);
    }
  }

  return provisionWorkbookForUser_(email);
}
```

### 6.4 Mapping key shape

To avoid putting raw email addresses into script properties (a soft privacy improvement and a quota-friendly choice), keys are hashed:

- **Key:** `mapping::` + lowercase hex SHA-256 of the lowercase email. Apps Script provides `Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, email)` which returns a byte array; convert to hex.
- **Value:** the spreadsheet ID string.
- **Optional sibling key (audit only):** `mapping_email_hint::<sha256>` = first character of email + `***` + `@<domain>` (e.g., `s***@gmail.com`) so the developer can recognize a mapping without storing the full email. Defer to a later slice if useful.

Rationale: avoids storing the full email in plaintext in `getScriptProperties()` while keeping the lookup deterministic. Implementation cost is one extra `Utilities.computeDigest` call per resolver invocation — negligible.

### 6.5 Fallback behavior

- **No email available** (anonymous session): throw with a clear message. This should never happen under `USER_ACCESSING` + allow-listed access, so reaching this branch is a real bug worth surfacing loudly.
- **Mapping missing**: `provisionWorkbookForUser_` creates new workbook.
- **Mapping stale** (`openById` throws): `handleStaleMapping_` throws `StaleMappingError` (subclass via a `.name = 'StaleMappingError'` marker, since JS has no native subclassing required here). `doGet` catches `StaleMappingError` specifically and renders a recovery message:

  ```
  We couldn't open your CashCompass workbook. It may have been deleted
  or moved out of access. Contact <developer email> to re-provision.
  ```

  Do **not** auto-reprovision in the first slice. Manual recovery only — the developer clears the property via the Apps Script editor and the next sign-in re-provisions.

### 6.6 Stale-mapping behavior summary

| Situation | First-slice behavior | Later slice (deferred) |
|---|---|---|
| Mapping → openById succeeds | Resolve normally | (same) |
| Mapping → openById fails | Surface clear error, no auto-create | Optional auto-reprovision behind opt-in |
| No mapping | Provision new workbook | (same) |
| Provisioning partially fails | Rollback (delete file), re-throw | (same) |
| Two browser tabs concurrent first sign-in | LockService serializes (§8) | (same) |

---

## 7. Workbook creation flow

The exact ordered sequence the first slice implements.

### 7.1 Sequence

```
1.  User opens central deployment URL.
2.  Google OAuth authenticates (deferred to platform).
3.  doGet entry runs:
    3a. isAllowlistedUser_() check.
        - false → return private-beta HtmlOutput, stop.
        - true → continue.
    3b. Call getUserSpreadsheet_() to resolve the user's workbook.
        - CENTRAL_MODE=false → returns active bound spreadsheet (legacy path).
        - CENTRAL_MODE=true → routes through getOrProvisionUserSpreadsheet_().
    3c. Render dashboard (existing code path, unchanged).
4.  Inside getOrProvisionUserSpreadsheet_():
    4a. email = getCurrentUserEmail_().
    4b. mappedId = lookupSpreadsheetIdForUser_(email).
    4c. If mappedId exists:
        - Try openById(mappedId). On success, return.
        - On failure, route to handleStaleMapping_().
    4d. If mappedId missing:
        - Call provisionWorkbookForUser_(email).
5.  Inside provisionWorkbookForUser_(email):
    5a. Acquire LockService.getUserLock() with 30-second timeout.
        - On timeout, throw "Provisioning timed out; please reload."
    5b. Re-check the mapping inside the lock (double-check pattern).
        - If now present, release lock, return openById result.
    5c. Drive.Files.create({ name, mimeType: 'application/vnd.google-apps.spreadsheet' }).
        - On failure, release lock, re-throw.
    5d. const ss = SpreadsheetApp.openById(file.id).
        - On failure: Drive.Files.remove(file.id); release lock; re-throw.
    5e. runMinimalBootstrap_(ss).
        - On failure: Drive.Files.remove(file.id); release lock; re-throw.
    5f. writeSpreadsheetIdForUser_(email, file.id).
        - On failure: Drive.Files.remove(file.id); release lock; re-throw.
    5g. Release lock.
    5h. Return ss.
6.  Inside runMinimalBootstrap_(ss):
    6a. Call ensureInputSettingsSheet_(ss) (the existing helper).
    6b. Nothing else. Every other sheet is created lazily by its
        existing ensure* helper as the user navigates the dashboard.
7.  Dashboard renders. Because INPUT - Settings is the only sheet
    with content, the existing first-launch routing surfaces
    Setup / Review (identical to runtime-verified blank-workbook
    bound-mode flow).
8.  User completes Setup / Review. All subsequent ensure* helpers
    create their canonical sheets in the user-owned workbook.
9.  User closes browser.
10. User returns next day:
    10a. doGet → isAllowlistedUser_() → true.
    10b. getUserSpreadsheet_() → getOrProvisionUserSpreadsheet_().
    10c. lookupSpreadsheetIdForUser_ returns the persisted ID.
    10d. openById succeeds → returns the same workbook.
    10e. Dashboard renders with populated data.
```

### 7.2 Workbook naming convention

- **Name:** `CashCompass — <user-email>` (e.g., `CashCompass — throwaway-cashcompass@gmail.com`).
- Rationale: the email in the name lets the user recognize the file in their Drive; for the first slice with two known accounts, this is acceptable. A later slice may switch to `CashCompass` (no suffix) if privacy/UX considerations change.
- **Folder placement:** Drive root for the first slice (no folder creation). Folder placement adds complexity (resolve-or-create folder, propagate folder ID) that the first slice does not need. Defer to a later optional refinement.

### 7.3 `ensureInputSettingsSheet_` integration

- Already exists in `profile.js`. Already idempotent and additive. The first slice calls it exactly once during provisioning and exactly once on every dashboard render that touches Settings (existing behavior — unchanged).
- No new helper is created. No bootstrap registry change.

---

## 8. Locking / race behavior

### 8.1 Why locking matters

A first-sign-in user with two browser tabs (or a user double-clicking the deployment URL) can fire two `provisionWorkbookForUser_` executions in parallel. Without locking:

- Both create a spreadsheet (two files in Drive).
- Whichever writes the mapping last wins; the other file is orphaned.

Locking serializes the provisioning step per-user.

### 8.2 LockService usage

- **Lock type:** `LockService.getUserLock()` (per-user lock, scoped to the calling user, automatically released on script exit).
- **Acquire:** `lock.tryLock(30000)` — 30 seconds. Long enough for one provisioning execution; short enough to fail fast on a stuck lock.
- **On timeout:** throw `"Provisioning is already in progress. Please reload the page in a few seconds."` — the second tab sees this and the user reloads.
- **Release:** explicit `lock.releaseLock()` in every exit path (success and every error branch). Apps Script's auto-release on script exit is a safety net, not the primary release mechanism.

### 8.3 Duplicate-create prevention (double-check pattern)

Inside the lock, **re-read the mapping** before creating. Another execution that acquired the lock first may have already provisioned:

```
acquire lock
  mappedId = lookupSpreadsheetIdForUser_(email)
  if mappedId:
    release lock
    return openById(mappedId)
  // else, proceed with creation
```

This is the canonical double-check-locking pattern and prevents the duplicate-file scenario above.

### 8.4 Partial-failure cleanup

Every failure branch inside `provisionWorkbookForUser_` between file creation and mapping persistence must call `Drive.Files.remove(file.id)` (or `DriveApp.getFileById(file.id).setTrashed(true)` as a softer alternative — see §10) before re-throwing. The pseudocode in §7.1 step 5 enumerates each branch.

Rationale: a failure after file create but before mapping write leaves an orphaned spreadsheet in the user's Drive that the central app has no record of. On next sign-in, the resolver sees no mapping and creates another file. The user accumulates orphans. Cleanup eliminates this.

**Soft delete vs hard delete:** the first slice uses **soft delete** (`setTrashed(true)`) so the user can recover the file from Drive's Trash if cleanup happened due to a transient error and the user actually wanted that file. Hard delete (`Drive.Files.remove`) is a later-slice consideration.

---

## 9. Workbook ownership model

### 9.1 Pinned decision

- **User-owned.** The spreadsheet is created in the calling user's Drive (because `executeAs: USER_ACCESSING` + `Drive.Files.create()` runs under the user's identity).
- **No developer-owned workbook.** The developer's Drive never gets a copy of any beta user's workbook.
- **No template copy.** The first slice creates an empty spreadsheet and additively bootstraps it, per the architecture plan's §4.4 preference. Template-copy is explicitly rejected because it bypasses the additive bootstrap contract.

### 9.2 Implications

- The user retains their data forever, independent of the CashCompass deployment's existence.
- If the user revokes the app's OAuth grant, their file remains in their Drive and is usable directly via Google Sheets.
- If the central deployment is shut down, every existing user-owned workbook continues to work standalone (bound-mode-style) if the user re-opens it directly in Sheets.
- The developer never has access to any beta user's financial data unless that user explicitly shares the file back.

---

## 10. Rollback procedure

The exact, ordered steps to roll back the first slice if anything goes wrong post-deployment. Designed so each step is independently survivable.

### 10.1 Immediate rollback (no redeploy)

1. **Flip `CENTRAL_MODE` to `false`** via Apps Script editor → Project Settings → Script Properties.
2. Next invocation of the central deployment: `getUserSpreadsheet_()` routes back to `SpreadsheetApp.getActiveSpreadsheet()` pass-through.
3. Allow-listed users hitting the central deployment now resolve against the deployment's bound spreadsheet (which is whatever the central deployment was bound to at deploy time — likely the developer's project workbook). They lose access to their user-owned workbook **via this URL** but **not in reality** — their workbook is still in their Drive.

### 10.2 Full rollback (revert deployment)

1. Apps Script editor → Deploy → Manage Deployments → archive the central deployment (the one named `CashCompass — Central Beta (Slice 1)`).
2. `git revert` the commit(s) that flipped `appsscript.json`. Re-deploy any other (bound) deployment with the original manifest.
3. Optionally clear the `CENTRAL_MODE`, `FAMILY_BETA_ALLOWLIST`, and `mapping::*` script properties for cleanliness. **Do not delete** the mappings if there is any chance you'll re-enable central mode — the mappings are the source of truth for "which workbook belongs to which user".

### 10.3 Mapping cleanup

- `clearMappingForUser_(email)` exists for manual single-user cleanup.
- Bulk cleanup is done via the Apps Script editor's Script Properties UI by deleting `mapping::<hash>` entries.
- **Do not** programmatically clear all mappings in a single call from production code. If a bulk clear is ever needed, run it from the Apps Script editor's Execution UI explicitly.

### 10.4 Workbook retention policy

- **Never destructively delete** a user-owned workbook during rollback. The workbooks belong to the users, not to CashCompass.
- The only destructive action the first slice may take on a user-owned file is the **partial-creation cleanup** of §8.4 (soft delete via `setTrashed(true)`) during a failed provisioning, and even that goes to the user's Drive Trash where they can recover it.
- Mapping rollback / deletion is non-destructive on user data — it just means the next sign-in will create a new workbook instead of opening the old one. If a user reports "my data is gone", the developer can manually look up the previous mapping (in git history if it was committed, or from memory) and re-write it.

### 10.5 No destructive deletes

To restate clearly: under no rollback path does the first slice or its rollback procedure hard-delete a user-owned spreadsheet. The strongest action permitted is `setTrashed(true)`, and only on workbooks that were never successfully provisioned (i.e., the user never saw them in their dashboard).

---

## 11. Disposable-account runtime test (acceptance criteria)

The runtime proof that closes the first slice. Performed once, by the developer, after deployment.

### 11.1 Prerequisites

- Central deployment shipped (manifest flipped, deployment created).
- `CENTRAL_MODE` = `true`.
- `FAMILY_BETA_ALLOWLIST` contains both the developer's primary email and the disposable account's email.
- Disposable account exists and is signed in to a separate browser profile (or incognito session) with no prior CashCompass interaction.

### 11.2 Test steps and acceptance criteria

| # | Step | Acceptance criterion |
|---|---|---|
| 1 | Open the central deployment URL in the disposable account's browser profile. | OAuth consent screen appears, lists the §3.1 scopes (`spreadsheets`, `drive.file`, `userinfo.email` at minimum). Consent screen wording is reasonable for a private-beta user. |
| 2 | Accept consent. | Page loads to Setup / Review (not a red banner, not a blank screen). |
| 3 | Check the disposable account's Drive. | A spreadsheet named `CashCompass — throwaway-cashcompass@gmail.com` (or per §7.2) exists in the Drive root, owned by the disposable account. Contains exactly one sheet: `INPUT - Settings`. |
| 4 | Walk Setup / Review on the disposable account: add a bank account, a debt, a bill, a cash-flow entry. | Each step's existing onboarding handoff fires; canonical sheets (`INPUT - Bank Accounts`, `INPUT - Debts`, etc.) are created additively in the user-owned workbook. No red banner. |
| 5 | Close the browser entirely. | (No action — confirmation that the test is end-to-end across sessions.) |
| 6 | Wait ~1 hour (or next day) and re-open the deployment URL in the same disposable account profile. | Page loads directly to the dashboard (no Setup / Review re-prompt), populated with the data entered in step 4. The same workbook is opened (verifiable by spreadsheet ID being unchanged in the Drive). |
| 7 | Open Apps Script editor → Project Settings → Script Properties. | An entry `mapping::<hash>` exists with the disposable account's workbook ID as its value. |
| 8 | Sign in to the same deployment URL from the developer's primary Google account (separate browser). | OAuth consent → Setup / Review → a **second** workbook appears in the developer's Drive, named `CashCompass — <developer email>`. The disposable account's workbook is unchanged and unaffected. |
| 9 | Sign in to the same deployment URL from a third Google account that is **not** on the allow-list. | The private-beta rejection message renders. No workbook is created in that account's Drive. No script property is written. |
| 10 | Verify the developer's existing bound-mode deployment (if any). | Still works exactly as before. Bound-mode workbook is unaffected. No central-mode artifacts leaked into it. |

### 11.3 Definition of "no copied Apps Script code"

- The disposable account never opens the Apps Script editor.
- The disposable account never copies / imports / pastes any script.
- The disposable account interacts only with the deployment URL.
- The Apps Script project bound to the disposable account's workbook (if any auto-generated one appears) is empty — the workbook is just a data spreadsheet.

### 11.4 Pass / fail criteria

- **PASS:** every row in §11.2 succeeds with no manual recovery. **All 10 rows must pass.**
- **PARTIAL:** any row fails but the slice is still recoverable (e.g., consent screen wording needs refinement, but the flow still works end-to-end). Documented as a known issue; slice still ships pending the refinement.
- **FAIL:** the disposable account cannot complete onboarding without developer intervention, or the developer's bound deployment is affected, or unauthorized accounts can write to script properties / Drive. The slice does not ship; the implementation is rolled back per §10.

---

## 12. Explicit non-goals

For absolute clarity, the first slice and its implementation prompt **must not** include:

- Billing / monetization / paid tiers.
- Public onboarding (anyone outside the allow-list).
- Admin portal / UI for managing users, mappings, or allow-list.
- GA-scale architecture (no horizontal sharding of script properties, no rate-limit infrastructure, no quota management beyond Apps Script defaults).
- Analytics / telemetry collection beyond Apps Script's built-in Stackdriver logging.
- Multi-user support tooling (a "help desk" surface, ticket creation, etc.).
- Advanced recovery tooling (auto-reprovision, snapshot rollback, etc.).
- Audit-log sheet mirror of the script-properties mapping.
- Migration of the developer's existing bound-mode workbook into the central scheme.
- Schema versioning beyond what the existing additive bootstrap chain produces.
- Generated-sheet formatting polish (separate workstream).
- Bank Import (out of family-beta scope).
- Per-execution caching of the resolved spreadsheet handle (later refinement).

Any item in this list that the implementation prompt proposes to include must trigger an explicit "out of scope; deferred" response from the implementor, not silent inclusion.

---

## 13. Implementation gate

**No central-mode implementation may begin until this document is reviewed and committed.**

The implementation prompt that follows this doc:

- Must reference this doc by name and commit hash.
- Must implement exactly the §6 function inventory with exactly the §6.2 / §6.3 signatures.
- Must follow the §7.1 step ordering for `provisionWorkbookForUser_`.
- Must use the §8 lock semantics.
- Must respect every §12 non-goal.
- Must not flip the manifest until the developer has explicitly observed (and committed back to the repo) the runtime-verification items in §3 — specifically the auto-detected scopes from the existing codebase reconciled against the §3.1 declared list.
- Must produce the §11 runtime test plan and run it before declaring the slice done.

The implementation may proceed in sub-slices (e.g., `appsscript.json` change first, allow-list gate second, resolver branch third, provisioning fourth) at the developer's discretion, but the slice is not complete until every §11 acceptance criterion passes.

---

## 14. Sign-off

This is the final planning layer before the first central-mode implementation slice. Every decision the implementation prompt would have to make on the fly is pinned here. The next artifact is an implementation prompt, not another planning doc.

---

## 15. Runtime evidence — first central-mode provisioning milestone (2026-05-28)

> **Status update — partial PASS, developer-account path only.** The first central-mode provisioning flow has been runtime-confirmed end-to-end against the developer's primary Google account on the `CashCompass — Central Beta (Slice 1)` deployment. The disposable-account, unauthorized-account, stale-mapping, and return-to-existing-mapping rows from §11.2 remain to be exercised; they are the next hardening tests (see §15.5).

### 15.1 Test conditions

- Implementation slice committed in `d952dfa` (resolver + workbook provisioning, code + docs).
- Manifest from `e2ebbbd` (`executeAs: USER_ACCESSING`, `access: ANYONE`, explicit `oauthScopes`, Drive v3 advanced service) live on the central deployment.
- Script properties set manually in the Apps Script editor:
  - `CENTRAL_MODE` = `true`
  - `FAMILY_BETA_ALLOWLIST` = `samertheodossy@gmail.com` (developer's primary account)
  - `BETA_CONTACT_EMAIL` = developer's contact email
- Central deployment URL opened in the developer's primary browser session.

### 15.2 Observed behavior (rows mapped to §11.2)

| §11.2 row | Step (as written) | Observed result |
|---|---|---|
| 1 | OAuth consent on first hit | Consent screen appeared, listed the §3.1 scopes; accepted cleanly |
| 2 | Page loads to Setup / Review | Loaded without a red banner |
| 3 | New workbook in caller's Drive | `CashCompass — samertheodossy@gmail.com` created in the developer's Drive root, owned by the developer, containing exactly one sheet: `INPUT - Settings` (Key / Value header row) |
| 4 | Walk Setup / Review on the central account | Not yet exercised — pending hardening session |
| 5 | Close browser | Not exercised |
| 6 | Re-open next day | Not exercised — covered by hardening test §15.5 row 4 (return-to-existing-mapping) |
| 7 | Apps Script editor → Script Properties shows `mapping::<hash>` | Confirmed: a `mapping::<sha256(samertheodossy@gmail.com)>` entry exists, value is the new workbook's spreadsheet ID |
| 8 | Developer's primary account sees a workbook | Confirmed (this was the test session itself) |
| 9 | Third (unauthorized) Google account → rejection | Not yet exercised — covered by hardening test §15.5 row 2 |
| 10 | Bound deployment still works exactly as before | Confirmed: the developer's existing bound deployment continues to serve the bound workbook unchanged. No central-mode artifacts leaked into the bound workbook. No new sheets, rows, or data changes in the bound workbook. |

### 15.3 What was proven

- The `appsscript.json` posture from `e2ebbbd` (`USER_ACCESSING` + `ANYONE` + explicit scopes + Drive v3) is accepted by the platform end-to-end.
- The allow-list gate in `webapp.js → doGet` admits an allow-listed caller and reaches the dashboard render.
- The resolver branch in `central_resolver.js → getUserSpreadsheet_()` correctly routes to `getOrProvisionUserSpreadsheet_()` when `CENTRAL_MODE=true`.
- `Drive.Files.create` runs under the calling user's identity and creates the workbook in their Drive root (user-owned ownership model from §9 is validated for the developer-as-user case).
- `runMinimalBootstrap_(ss)` correctly bootstraps the new workbook with `INPUT - Settings` only, with no other ensure helper executed (additive bootstrap discipline from §7.3 holds).
- `writeSpreadsheetIdForUser_` persists the mapping under the SHA-256 hashed key shape from §6.4; raw emails do not appear as property keys.
- The bound deployment, pinned to a pre-central-mode script version, continues to serve the developer's bound workbook with byte-for-byte legacy behavior. Two-mode coexistence works.

### 15.4 What was not exercised in this milestone

- Disposable-account first-run (separate Google account, separate Drive).
- Unauthorized-account rejection (`renderAllowlistRejection_` HTML render).
- Stale-mapping behavior (`StaleMappingError` surface, manual recovery via `clearMappingForUser_`).
- Return-to-existing-mapping (second-session open via `lookupSpreadsheetIdForUser_` + `SpreadsheetApp.openById`).
- Setup / Review walkthrough on the central-mode workbook to confirm lazy creation of `INPUT - Bank Accounts`, `INPUT - Debts`, etc., against a user-owned workbook context.

### 15.5 Next hardening tests (in suggested order)

Each is its own discrete runtime session and its own SESSION_NOTES entry when complete. None require code changes; all are observation-only against the deployed slice.

1. **Disposable-account provisioning.** Add a disposable second Google account to `FAMILY_BETA_ALLOWLIST`. Sign in to the central deployment URL from that account in a clean browser profile. Expected: a separate `CashCompass — <disposable email>` workbook is created in the disposable account's Drive, owned by the disposable account; `INPUT - Settings` is created; a second `mapping::<sha256>` entry appears in script properties; the developer's `CashCompass — samertheodossy@gmail.com` workbook is unaffected.
2. **Unauthorized-account rejection.** Sign in from a third Google account that is **not** on `FAMILY_BETA_ALLOWLIST`. Expected: the static private-beta HTML from `renderAllowlistRejection_()` renders; no workbook is created in that account's Drive; no script property is written; no `Drive.Files.create` call appears in the Executions log; no spreadsheet data access happens.
3. **Stale mapping behavior.** Manually trash (soft delete via Drive UI) the developer's `CashCompass — samertheodossy@gmail.com` workbook. Re-hit the central deployment URL from the developer's primary account. Expected: `handleStaleMapping_` throws `StaleMappingError` with the mapped ID and underlying error message visible; **no** auto-reprovision occurs (the mapping is preserved); the developer manually clears the mapping by running `clearMappingForUser_('samertheodossy@gmail.com')` from the Apps Script editor's Run dialog; a subsequent hit then re-provisions cleanly via the §15.2 row-3 path.
4. **Return-to-existing-mapping.** After the developer's mapping is restored (either by undoing the trash from test 3 or by re-provisioning), close the browser and re-hit the central deployment URL the next day from the same developer account. Expected: `lookupSpreadsheetIdForUser_` returns the persisted ID; `SpreadsheetApp.openById` succeeds; no new workbook is created; no second `Drive.Files.create` call appears in the Executions log; the dashboard renders against the existing workbook.

The slice §11.4 pass / fail criteria evolves to: **PARTIAL PASS (developer-account row only) as of 2026-05-28; full PASS pending the four §15.5 hardening tests.**

End of document.
