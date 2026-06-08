# CENTRAL_APP_RESOLVER_PROVISIONING_IMPLEMENTATION_PROMPT.md

> **Superseded / Historical — Central App migration document.**
>
> The Central App architecture described here is **now live** — the two-project central deployment has shipped and is in family-beta use. This file is retained as a historical migration record and is **not** the current source of truth. Specific internal details below (commit hashes, "one-line pass-through" resolver descriptions, and "planned/next" framing) reflect the state at the time of authoring and may be out of date.
>
> **Current sources of truth:** `PROJECT_CONTEXT.md` · `TODO.md` · `README.md` · `WORKING_RULES.md`
>
> _Banner added in the Documentation Archive Preparation pass; the document body below is unchanged._

The exact, implementation-ready prompt specification for the **second** central-mode implementation slice: the resolver branch, the allow-list gate, and the workbook provisioning sequence. This document is a prompt spec — it pins every concrete decision the implementation prompt must follow so the implementor produces a mechanical translation of this doc into code, not a fresh design pass.

**Planning only.** No Apps Script change, no HTML change, no `appsscript.json` change, no deployment change. This document is the implementation gate; the implementation prompt itself **may not run** until this spec is reviewed and committed.

Cross-references (commit hashes are the current state at authoring):
- `CENTRAL_APP_WORKBOOK_CREATION_FIRST_SLICE_PLAN.md` @ `cdd73c7` — architecture-side resolver / provisioning decisions; this prompt is the implementation translation of its §6–§11.
- `CENTRAL_APP_DEPLOYMENT_PREPARATION_PLAN.md` @ `f0a5b04` — manifest preparation prerequisite.
- `e2ebbbd` — the manifest commit (`executeAs: USER_ACCESSING`, `access: ANYONE` — manifest enum; deployment UI label is "Anyone with a Google account" — explicit `oauthScopes`, Drive v3 advanced service). **Required before this slice may ship.** Note: clasp's manifest validator rejects the string `ANYONE_WITH_GOOGLE_ACCOUNT` with `Invalid manifest: Expected one of [UNKNOWN_ACCESS, DOMAIN, ANYONE, ANYONE_ANONYMOUS, MYSELF] for webapp.access.` — the correct manifest enum for the family-beta posture is `ANYONE` (sign-in required, but any Google account; the app-layer allow-list does the actual gating).
- `central_resolver.js` — currently a 1-line `SpreadsheetApp.getActiveSpreadsheet()` pass-through. This slice extends it.
- `webapp.js` — currently a 6-line `doGet` that renders `PlannerDashboardWeb.html`. This slice adds an allow-list gate ahead of the render.
- `profile.js` — owns `ensureInputSettingsSheet_()`, the single bootstrap helper called during provisioning. **Refactor required (§4.4) so the helper accepts a spreadsheet handle.**

This prompt assumes the platform-layer runtime test from `CENTRAL_APP_DEPLOYMENT_PREPARATION_PLAN.md → §8` has passed. If it has not passed, the implementation prompt that consumes this spec **must refuse to run** and surface the unmet prerequisite.

---

## 1. Purpose

`CENTRAL_APP_WORKBOOK_CREATION_FIRST_SLICE_PLAN.md` pinned the architecture. `CENTRAL_APP_DEPLOYMENT_PREPARATION_PLAN.md` pinned the manifest. This document pins the **code-level** translation: which files change, which function signatures land, which script properties are read and written, what the lock semantics look like in actual JavaScript, what the allow-list rejection HTML says.

The implementation prompt that follows this doc:
- Reads this doc and the two cross-referenced plans by commit hash.
- Produces a diff against `central_resolver.js`, `webapp.js`, and `profile.js` only — plus exactly one new file (`central_provisioning.js`).
- Produces zero changes to any other `.js` file, zero changes to any `.html` file, zero changes to `appsscript.json`.
- Produces a runtime test report following the §11 checklist before declaring the slice done.

This is the implementation slice that turns the central deployment from "anyone can authenticate, nothing happens" into "allow-listed users get their own user-owned workbook automatically." It is the smallest slice that produces externally visible central-mode behavior.

---

## 2. Prerequisites (must be true before implementation begins)

Each prerequisite must be verified before the implementation prompt runs. If any is `false`, the prompt refuses and reports the gap.

| # | Prerequisite | How to verify |
|---|---|---|
| P1 | Manifest commit `e2ebbbd` is on `main` | `git log --oneline | grep e2ebbbd` |
| P2 | `appsscript.json` has `executeAs: USER_ACCESSING` and `access: ANYONE` (manifest enum; deployment UI label: "Anyone with a Google account") | Read file; confirm exact values |
| P3 | `appsscript.json` declares Drive v3 advanced service in `dependencies.enabledAdvancedServices` | Read file |
| P4 | `appsscript.json` declares the six `oauthScopes` from prep-plan §3.4 | Read file |
| P5 | `clasp push` has been executed against the script project after the manifest commit | Apps Script editor → Project Settings → confirm Drive advanced service is listed under Services |
| P6 | A new deployment named `CashCompass — Central Beta (Slice 1)` exists, distinct from the existing bound deployment | Apps Script editor → Manage Deployments |
| P7 | The GCP project's Drive API is enabled (one-time click-through) | GCP console → APIs & Services → Enabled APIs |
| P8 | Disposable-account runtime test from prep-plan §8 has passed with no FAIL rows | `SESSION_NOTES.md` entry confirming PASS |

If P1–P4 pass but P5–P8 do not, the implementation prompt **may still produce the diff** but the runtime test plan in §11 cannot run, and the slice is not complete until P5–P8 are also true.

---

## 3. Files expected to change

Exact and exhaustive list. No other file is touched.

| File | Status | Change scope |
|---|---|---|
| `central_resolver.js` | **modified** | Replace 1-line body with the resolver branch (§4.1). Add `isCentralModeEnabled_()` and `getCurrentUserEmail_()`. |
| `webapp.js` | **modified** | `doGet` gets an allow-list gate (§4.2) before the existing `HtmlService.createTemplateFromFile('PlannerDashboardWeb')` render. The render path itself is unchanged. |
| `profile.js` | **modified, surgically** | `ensureInputSettingsSheet_()` refactored to accept an optional `ss` parameter (§4.4). Backwards-compatible. No other change to the file. |
| `central_provisioning.js` | **NEW** | All provisioning + mapping + lock + allow-list logic. The largest single file in this slice (~250 LOC estimated). |
| `SESSION_NOTES.md` | **modified** | One new top-bullet in the post-V1.1 "Shipped" list recording the slice. |

**No other file is opened for write.** Specifically not touched:
- `appsscript.json` (already committed in `e2ebbbd`)
- Any `Dashboard_Script_*.html`, `Dashboard_Body.html`, `Dashboard_Styles.html`, `PlannerDashboardWeb.html`, etc.
- Any other `.js` file (`bank_accounts.js`, `debts.js`, etc. — all dashboard data modules continue to call `getUserSpreadsheet_()` and silently switch to the central-mode workbook when `CENTRAL_MODE=true`).
- `code.js` (bound spreadsheet `onOpen` menu — irrelevant to the central deployment).

### 3.1 File-creation rationale: `central_provisioning.js`

Rather than overload `central_resolver.js` with ~250 LOC of provisioning + mapping + lock + allow-list logic, the implementation prompt creates a new file dedicated to provisioning concerns. The resolver file stays small and reads as the seam it is. The provisioning file holds the operational logic — easy to revert by deleting the file plus reverting `central_resolver.js` and `webapp.js`.

Naming convention follows the existing `central_resolver.js` ("central_<noun>.js"). No existing file is renamed.

---

## 4. Exact functions to add

Every function landed in this slice, with pinned signatures, pinned return contracts, and pinned bodies (pseudocode → JS).

### 4.1 `central_resolver.js` (modified)

The file goes from a 1-line body to a small router. After this slice it owns three functions:

```javascript
/**
 * Central App resolver — Phase: central-mode workbook routing.
 *
 * getUserSpreadsheet_() is the single seam through which a calling
 * module acquires a Spreadsheet handle. When CENTRAL_MODE is off
 * (default), it returns SpreadsheetApp.getActiveSpreadsheet() — byte-
 * for-byte identical to the pre-central behavior, so the bound
 * deployment continues to work unchanged.
 *
 * When CENTRAL_MODE is on, it routes into central_provisioning.js's
 * getOrProvisionUserSpreadsheet_() to look up (or create) the
 * calling user's own workbook in their Drive.
 *
 * Cross-references:
 *   - CENTRAL_APP_RESOLVER_PROVISIONING_IMPLEMENTATION_PROMPT.md
 *   - CENTRAL_APP_WORKBOOK_CREATION_FIRST_SLICE_PLAN.md
 *
 * Do not extend this file with provisioning logic — that lives in
 * central_provisioning.js. Keep this file small and seam-like.
 */
function getUserSpreadsheet_() {
  if (!isCentralModeEnabled_()) {
    return SpreadsheetApp.getActiveSpreadsheet();
  }
  return getOrProvisionUserSpreadsheet_();
}

/**
 * Returns true when the CENTRAL_MODE script property is the literal
 * string "true". Any other value (including unset) returns false.
 *
 * Never throws. Read failures (e.g., PropertiesService is unavailable
 * for some catastrophic reason) are treated as "central mode off"
 * — the safest fail-closed posture for this flag.
 */
function isCentralModeEnabled_() {
  try {
    var v = PropertiesService.getScriptProperties().getProperty('CENTRAL_MODE');
    return v === 'true';
  } catch (_e) {
    return false;
  }
}

/**
 * Returns the calling user's email, lowercased and trimmed, or the
 * empty string if no email is available. Uses Session.getEffectiveUser
 * because under USER_ACCESSING that returns the actual caller's
 * identity (Session.getActiveUser returns empty for non-Workspace-
 * domain users — do not use it here).
 *
 * Never throws.
 */
function getCurrentUserEmail_() {
  try {
    var eu = Session.getEffectiveUser();
    if (!eu) return '';
    var email = String(eu.getEmail() || '').trim().toLowerCase();
    return email;
  } catch (_e) {
    return '';
  }
}
```

### 4.2 `webapp.js` (modified)

The existing `doGet` body grows from 4 lines to ~12 lines. The render path is preserved verbatim — only an allow-list gate is added in front of it. Existing menu / launcher functions (`setPlannerDashboardWebAppUrl`, `clearPlannerDashboardWebAppUrl`, `getPlannerDashboardWebAppUrl_`, `openPlannerDashboardWebLauncher`) are **unchanged**.

```javascript
function doGet() {
  // Allow-list gate: rejects any caller not in FAMILY_BETA_ALLOWLIST.
  // Runs regardless of CENTRAL_MODE so the central deployment URL
  // is never reachable by anonymous Google accounts. The bound
  // deployment is unaffected because access:MYSELF gates it at
  // the platform layer.
  if (!isAllowlistedUser_()) {
    return renderAllowlistRejection_();
  }

  return HtmlService.createTemplateFromFile('PlannerDashboardWeb')
    .evaluate()
    .setTitle('CashCompass')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
```

`isAllowlistedUser_()` and `renderAllowlistRejection_()` live in `central_provisioning.js` (§4.3).

### 4.3 `central_provisioning.js` (new file)

The full surface of the slice. Sections below are listed in dependency order — each function may call any function declared above it.

#### 4.3.1 Constants

```javascript
/**
 * Script-property keys. All keys live in
 * PropertiesService.getScriptProperties().
 */
var CENTRAL_MODE_KEY_ = 'CENTRAL_MODE';
var FAMILY_BETA_ALLOWLIST_KEY_ = 'FAMILY_BETA_ALLOWLIST';
var MAPPING_KEY_PREFIX_ = 'mapping::';

/**
 * Lock semantics. 30 seconds is long enough for a single provisioning
 * pass (Drive create + openById + ensureInputSettingsSheet_ +
 * properties write); short enough that a stuck lock surfaces fast.
 */
var PROVISIONING_LOCK_TIMEOUT_MS_ = 30000;

/**
 * Workbook naming. The user's email appears in the title so the
 * file is recognizable in their Drive. A later slice may switch to
 * a generic "CashCompass" title if privacy considerations change.
 */
function buildWorkbookName_(email) {
  return 'CashCompass — ' + email;
}
```

#### 4.3.2 Allow-list

```javascript
/**
 * Reads FAMILY_BETA_ALLOWLIST from script properties, splits on
 * commas, trims, lowercases, and returns the resulting array. An
 * unset / empty property returns an empty array (which causes
 * isAllowlistedUser_ to return false for every caller — fail-closed).
 *
 * Never throws.
 */
function readAllowlist_() {
  try {
    var raw = PropertiesService.getScriptProperties()
      .getProperty(FAMILY_BETA_ALLOWLIST_KEY_) || '';
    return raw.split(',')
      .map(function(s) { return String(s || '').trim().toLowerCase(); })
      .filter(function(s) { return s.length > 0; });
  } catch (_e) {
    return [];
  }
}

/**
 * Returns true iff getCurrentUserEmail_() is on the allow-list. An
 * empty caller email always returns false. Never throws.
 */
function isAllowlistedUser_() {
  var email = getCurrentUserEmail_();
  if (!email) return false;
  var list = readAllowlist_();
  for (var i = 0; i < list.length; i++) {
    if (list[i] === email) return true;
  }
  return false;
}

/**
 * Renders the private-beta rejection HtmlOutput shown to any caller
 * not on the allow-list. No data is loaded, no resolver is called,
 * no Drive write happens. The output is intentionally bland — no
 * branding, no email collection form, no "contact us" link.
 *
 * The developer's email is hard-coded into the message body via
 * a script-property lookup so the message can be updated without
 * a code change. If the property is unset, falls back to a generic
 * message.
 */
function renderAllowlistRejection_() {
  var contact = '';
  try {
    contact = String(PropertiesService.getScriptProperties()
      .getProperty('BETA_CONTACT_EMAIL') || '').trim();
  } catch (_e) {
    contact = '';
  }

  var html = '<!DOCTYPE html><html><head>' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<base target="_top">' +
    '<title>CashCompass — Private Beta</title>' +
    '<style>' +
    'body{font-family:Arial,sans-serif;padding:32px;max-width:480px;' +
    'margin:48px auto;color:#222;line-height:1.5;}' +
    'h1{font-size:18px;margin:0 0 12px 0;}' +
    'p{margin:0 0 12px 0;}' +
    '</style></head><body>' +
    '<h1>CashCompass — Private Beta</h1>' +
    '<p>CashCompass is currently in private beta and is not yet open to ' +
    'new users.</p>' +
    (contact
      ? '<p>If you believe you should have access, please contact ' +
        contact.replace(/</g, '&lt;').replace(/>/g, '&gt;') + '.</p>'
      : '<p>If you believe you should have access, please contact the ' +
        'project owner.</p>') +
    '</body></html>';

  return HtmlService.createHtmlOutput(html)
    .setTitle('CashCompass — Private Beta');
}
```

#### 4.3.3 Mapping key + storage

```javascript
/**
 * Computes the script-property key for a given email. Uses
 * SHA-256 over the lowercase email and prefixes with "mapping::".
 * This avoids storing the full email in plaintext in script
 * properties while keeping the lookup deterministic.
 *
 * Throws if email is empty (which would always be a programmer
 * error — callers must check getCurrentUserEmail_() first).
 */
function buildMappingKey_(email) {
  if (!email) {
    throw new Error('buildMappingKey_ requires a non-empty email.');
  }
  var bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(email).toLowerCase()
  );
  var hex = '';
  for (var i = 0; i < bytes.length; i++) {
    var b = bytes[i];
    if (b < 0) b += 256;
    var s = b.toString(16);
    hex += (s.length === 1 ? '0' : '') + s;
  }
  return MAPPING_KEY_PREFIX_ + hex;
}

/**
 * Looks up the persisted spreadsheet ID for the given email.
 * Returns the ID string, or null if no mapping exists.
 * Never throws.
 */
function lookupSpreadsheetIdForUser_(email) {
  try {
    var key = buildMappingKey_(email);
    var id = PropertiesService.getScriptProperties().getProperty(key);
    return id || null;
  } catch (_e) {
    return null;
  }
}

/**
 * Persists the spreadsheet ID for the given email. Throws on
 * PropertiesService failure so callers (provisionWorkbookForUser_)
 * can roll back the just-created file.
 */
function writeSpreadsheetIdForUser_(email, spreadsheetId) {
  if (!spreadsheetId) {
    throw new Error('writeSpreadsheetIdForUser_ requires a non-empty id.');
  }
  var key = buildMappingKey_(email);
  PropertiesService.getScriptProperties().setProperty(key, spreadsheetId);
}

/**
 * Deletes the mapping for the given email. Exposed for manual
 * recovery (e.g., developer clearing a stale mapping from the
 * Apps Script editor's Run dialog). NOT called automatically in
 * the first slice. Never throws.
 */
function clearMappingForUser_(email) {
  try {
    var key = buildMappingKey_(email);
    PropertiesService.getScriptProperties().deleteProperty(key);
  } catch (_e) {
    // swallow
  }
}
```

#### 4.3.4 Resolver branch

```javascript
/**
 * Central-mode branch of getUserSpreadsheet_(). Looks up the
 * caller's mapping, opens the workbook if present, or provisions
 * a new one if absent. Throws StaleMappingError if the mapping
 * exists but openById fails (manual recovery only — no auto-
 * reprovision in the first slice per first-slice plan §6.5).
 */
function getOrProvisionUserSpreadsheet_() {
  var email = getCurrentUserEmail_();
  if (!email) {
    throw new Error(
      'Central mode requires an identified user. ' +
      'Session.getEffectiveUser returned empty — check userinfo.email ' +
      'scope and USER_ACCESSING posture.'
    );
  }

  var mappedId = lookupSpreadsheetIdForUser_(email);
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

#### 4.3.5 Provisioning sequence

```javascript
/**
 * Creates a new spreadsheet in the caller's Drive, runs the minimal
 * bootstrap, persists the mapping, and returns the new Spreadsheet
 * handle. Serialized per-user via LockService; double-checks the
 * mapping inside the lock to prevent duplicate files.
 *
 * On any partial failure between Drive create and mapping write,
 * trashes the just-created file (soft delete via setTrashed) so
 * the user can recover it from Drive's Trash if the failure was
 * transient and they actually wanted that file.
 */
function provisionWorkbookForUser_(email) {
  var lock = LockService.getUserLock();
  var acquired = false;
  try {
    acquired = lock.tryLock(PROVISIONING_LOCK_TIMEOUT_MS_);
  } catch (_e) {
    acquired = false;
  }
  if (!acquired) {
    throw new Error(
      'Provisioning is already in progress for this account. ' +
      'Please reload the page in a few seconds.'
    );
  }

  try {
    // Double-check inside the lock: another execution may have
    // provisioned while we were waiting.
    var existingId = lookupSpreadsheetIdForUser_(email);
    if (existingId) {
      return SpreadsheetApp.openById(existingId);
    }

    var fileId = null;
    var ss = null;
    try {
      var file = Drive.Files.create({
        name: buildWorkbookName_(email),
        mimeType: 'application/vnd.google-apps.spreadsheet'
      });
      fileId = file.id;
    } catch (createErr) {
      throw new Error(
        'Could not create your CashCompass workbook (Drive.Files.create ' +
        'failed): ' + (createErr && createErr.message ? createErr.message : createErr)
      );
    }

    try {
      ss = SpreadsheetApp.openById(fileId);
    } catch (openErr) {
      trashFileQuietly_(fileId);
      throw new Error(
        'Created workbook but could not open it (openById failed): ' +
        (openErr && openErr.message ? openErr.message : openErr)
      );
    }

    try {
      runMinimalBootstrap_(ss);
    } catch (bootErr) {
      trashFileQuietly_(fileId);
      throw new Error(
        'Workbook bootstrap failed: ' +
        (bootErr && bootErr.message ? bootErr.message : bootErr)
      );
    }

    try {
      writeSpreadsheetIdForUser_(email, fileId);
    } catch (mapErr) {
      trashFileQuietly_(fileId);
      throw new Error(
        'Could not persist workbook mapping: ' +
        (mapErr && mapErr.message ? mapErr.message : mapErr)
      );
    }

    return ss;
  } finally {
    try { lock.releaseLock(); } catch (_e) { /* swallow */ }
  }
}

/**
 * Soft-deletes a file by trashing it. Never throws. Used by the
 * partial-failure cleanup path so a half-created workbook does not
 * accumulate in the user's Drive. Soft delete (vs hard delete) so
 * the user can recover from Trash if the failure was transient.
 */
function trashFileQuietly_(fileId) {
  if (!fileId) return;
  try {
    DriveApp.getFileById(fileId).setTrashed(true);
  } catch (_e) {
    // swallow — best-effort cleanup
  }
}

/**
 * Runs the minimal bootstrap on a freshly-created workbook so the
 * Setup / Review path can engage. The first slice's "minimal"
 * bootstrap is exactly one call: ensureInputSettingsSheet_(ss).
 * Every other sheet is created lazily by its existing ensure*
 * helper as the user navigates the dashboard.
 *
 * Throws on bootstrap failure so the caller can clean up the file.
 */
function runMinimalBootstrap_(ss) {
  if (!ss) throw new Error('runMinimalBootstrap_ requires a spreadsheet handle.');
  ensureInputSettingsSheet_(ss);
}
```

#### 4.3.6 Stale-mapping handling

```javascript
/**
 * Called when lookupSpreadsheetIdForUser_ returned a non-null id but
 * SpreadsheetApp.openById(id) threw. First-slice behavior: surface a
 * clear error and require manual recovery. Auto-reprovisioning is
 * intentionally deferred to a later slice (first-slice plan §6.5).
 *
 * Throws an Error with name='StaleMappingError' so the caller
 * (getOrProvisionUserSpreadsheet_, ultimately doGet) could choose
 * to render a recovery message if a recovery surface is later added.
 * The first slice surfaces the raw error to the user via the
 * dashboard render path — acceptable because the user is in the
 * private-beta allow-list and can ping the developer.
 */
function handleStaleMapping_(email, mappedId, openErr) {
  var msg =
    'Your CashCompass workbook could not be opened. It may have been ' +
    'deleted or moved out of access. Contact the project owner to ' +
    're-provision. Mapped ID: ' + mappedId +
    '. Underlying error: ' +
    (openErr && openErr.message ? openErr.message : String(openErr));
  var err = new Error(msg);
  err.name = 'StaleMappingError';
  throw err;
}
```

### 4.4 `profile.js` refactor (surgical)

The provisioning flow requires `ensureInputSettingsSheet_()` to operate on a freshly-created workbook that is **not** the active spreadsheet (Apps Script's `SpreadsheetApp.openById` does not change the active spreadsheet, and under `USER_ACCESSING` web-app execution `getActiveSpreadsheet()` may return null for non-developer callers).

The implementation prompt must refactor `profile.js:166` to accept an optional `ss` parameter, defaulting to the existing `getActiveSpreadsheet()` behavior so every existing caller continues to work unchanged.

**Pinned signature:**

```javascript
function ensureInputSettingsSheet_(ss) {
  ss = ss || SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(PROFILE_SETTINGS_SHEET_NAME_);
  if (sheet) {
    // ... existing body unchanged, but every reference to
    // SpreadsheetApp.getActiveSpreadsheet() inside this function
    // is replaced with the local `ss` variable.
  }
  // ... etc.
}
```

**Scope of refactor:**
- Add the optional `ss` parameter.
- Replace every internal `SpreadsheetApp.getActiveSpreadsheet()` reference inside the function body with the local `ss` variable.
- No other function in `profile.js` is touched.
- Every existing caller (no-arg) continues to work because the default preserves the old behavior.

**Verification step before commit:** `git diff profile.js` shows changes only inside `ensureInputSettingsSheet_`. No other function in the file is in the diff.

---

## 5. Exact script property names

Every script property the slice reads or writes, with type, default, and writer.

| Property | Type | Default | Read by | Written by | Notes |
|---|---|---|---|---|---|
| `CENTRAL_MODE` | string | unset / `"false"` | `isCentralModeEnabled_()` | **Developer, manually** (Apps Script editor → Project Settings → Script Properties) | Only the literal string `"true"` enables central mode. Anything else (including unset) = off. |
| `FAMILY_BETA_ALLOWLIST` | string (CSV) | unset (empty) | `readAllowlist_()` | **Developer, manually** | Comma-separated emails. Case-insensitive, whitespace-tolerant. Empty = no one allowed (fail-closed). |
| `BETA_CONTACT_EMAIL` | string | unset | `renderAllowlistRejection_()` | **Developer, manually** | Optional. If set, appears in the rejection HTML body. If unset, a generic "contact the project owner" message is shown. |
| `mapping::<sha256(email)>` | string | absent | `lookupSpreadsheetIdForUser_(email)` | `writeSpreadsheetIdForUser_(email, id)` | Written by provisioning; manually deleted by developer for re-provisioning. SHA-256 hex of lowercase email. |

**No other script property is read or written by this slice.** The existing `PLANNER_DASHBOARD_WEBAPP_URL` property (read/written by `webapp.js` menu functions) is untouched.

### 5.1 Developer setup checklist (post-implementation, pre-runtime-test)

In the Apps Script editor → Project Settings → Script Properties, the developer must set:

1. `CENTRAL_MODE` = `true`
2. `FAMILY_BETA_ALLOWLIST` = `developer@example.com, throwaway-cashcompass@gmail.com` (exact emails; developer fills in)
3. `BETA_CONTACT_EMAIL` = `developer@example.com` (optional)

Setting these is **not** part of the code diff; it is a manual setup step recorded in `SESSION_NOTES.md`.

---

## 6. Allow-list behavior

Detailed in §4.3.2 above. Key invariants restated:

- **Allow-list runs on every `doGet`**, regardless of `CENTRAL_MODE` value. The central deployment URL must never serve dashboard HTML to anyone not on the list, even if central mode is off.
- **Empty allow-list = nobody allowed.** Fail-closed.
- **Case-insensitive matching.** `Developer@Example.COM` on the allow-list matches `developer@example.com` from the session.
- **Whitespace-tolerant.** Trailing spaces, leading spaces, and stray whitespace inside the CSV are all stripped.
- **No data is loaded for unauthorized callers.** `doGet` returns the rejection HtmlOutput immediately. No resolver call, no Drive call, no script property write.
- **The bound deployment is unaffected.** Bound is `access: MYSELF`, so platform-level gating happens before `doGet` runs. The allow-list code is dead-code on the bound path.

---

## 7. CENTRAL_MODE behavior

Detailed in §4.1 above. Key invariants:

- **Default = off.** The script property is unset; `isCentralModeEnabled_()` returns `false`.
- **Off = byte-for-byte legacy.** `getUserSpreadsheet_()` returns `SpreadsheetApp.getActiveSpreadsheet()`. Every existing module that calls `getUserSpreadsheet_()` continues to resolve to the bound workbook (on the bound deployment) or to whatever `getActiveSpreadsheet()` returns under `USER_ACCESSING` on the central deployment (likely null for non-developers — which is fine, because they would have been rejected by the allow-list before reaching this code path on the central deployment, and the bound deployment is `MYSELF`-only).
- **On = central routing.** `getUserSpreadsheet_()` routes to `getOrProvisionUserSpreadsheet_()`.
- **The flag is read on every resolver invocation.** No caching. Flipping the flag in the Apps Script editor's Script Properties UI takes effect immediately on the next request — no redeploy needed.

This is the rollback lever. Flipping the flag to `false` instantly restores legacy resolver behavior across the entire deployment.

---

## 8. Drive.Files.create workbook creation

Detailed in §4.3.5. Key invariants:

- **Single API call, no folder traversal.** `Drive.Files.create({ name, mimeType: 'application/vnd.google-apps.spreadsheet' })`. No `parents`, no folder ID, no folder creation. The file lands in the user's Drive root.
- **Name format:** `CashCompass — <user-email>`, e.g., `CashCompass — throwaway-cashcompass@gmail.com`. Includes a U+2014 em dash (UTF-8 bytes `e2 80 94`).
- **Mime type:** `application/vnd.google-apps.spreadsheet` — the standard mime for a Google Sheets file. This is what makes the file open in Sheets when the user clicks it from Drive.
- **No template copy.** The first slice creates an empty spreadsheet and bootstraps it additively. Template-copy is explicitly rejected per first-slice plan §9.1.
- **Drive Advanced Service v3 is the only API used.** No `DriveApp.createFile` (which has different semantics around mime). No `SpreadsheetApp.create` (which creates the file but does not let us name it cleanly in one call and triggers a different permission path).
- **Failure handling:** any throw from `Drive.Files.create` propagates up to `doGet`, which is intentional — the user sees the error and contacts the developer. No silent retry.

---

## 9. Mapping key format

Detailed in §4.3.3. Key invariants:

- **Format:** `mapping::` + lowercase hex SHA-256 of the lowercase email. Total key length: `9 + 64 = 73` characters.
- **Example:** for email `throwaway@gmail.com`, the key is `mapping::8d2f...64chars...0a3b`.
- **Implementation:** `Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, email.toLowerCase())` returns a byte array; convert each byte to two-character hex (with leading-zero padding).
- **Value:** the spreadsheet ID string (typically 44 characters, e.g., `1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789aBcDeFgH`).
- **No raw email is ever stored in script properties.** This is a soft privacy improvement — a developer scrolling the Script Properties UI sees opaque hashes, not user emails.
- **Key collisions:** SHA-256 collision risk for the family-beta scale (at most ~10 emails) is effectively zero (collision probability ~10^-77 at this scale).

---

## 10. LockService + stale mapping + rollback behavior

### 10.1 LockService

Detailed in §4.3.5. Key invariants:

- **Lock scope:** `LockService.getUserLock()` — per-user lock. Two requests for the same user serialize; requests for different users do not block each other.
- **Acquire:** `lock.tryLock(30000)` — 30 seconds. Long enough for one provisioning pass (Drive create ~1s + openById ~0.5s + bootstrap ~0.5s + properties write ~0.1s = ~2s typical, with comfortable headroom). Short enough that a stuck lock surfaces fast.
- **On timeout:** throw a user-readable message asking them to reload.
- **Release:** explicit `lock.releaseLock()` in the `finally` block. Apps Script's auto-release on script exit is a safety net.
- **Double-check inside the lock:** after acquiring the lock, re-read `lookupSpreadsheetIdForUser_`. If another execution provisioned while we waited, open and return the existing workbook instead of creating a second one. This is the canonical double-check-locking pattern.

### 10.2 Stale mapping

Detailed in §4.3.6. Key invariants:

- **Detection:** `SpreadsheetApp.openById(mappedId)` throws (file deleted, file permissions revoked, file moved out of access).
- **First-slice behavior:** surface a clear error with the mapped ID, the underlying error, and a recovery instruction. **No auto-reprovision.**
- **Recovery (manual):** developer clears the `mapping::<hash>` property from the Apps Script editor → Project Settings → Script Properties. The next sign-in for that user provisions a new workbook.
- **Error name:** `StaleMappingError` (via `err.name = 'StaleMappingError'`) so a future slice can catch it specifically in `doGet` and render a friendlier recovery page without changing the rest of the code.

### 10.3 Partial-failure cleanup

Detailed in §4.3.5. Key invariants:

- Every failure branch between `Drive.Files.create` and `writeSpreadsheetIdForUser_` calls `trashFileQuietly_(fileId)` before re-throwing.
- `trashFileQuietly_` uses `DriveApp.getFileById(fileId).setTrashed(true)` — **soft delete**, recoverable from Drive Trash.
- **Hard delete (`Drive.Files.remove`) is explicitly avoided** for the first slice. If the failure was transient and the user actually wanted that workbook, they can recover it from Trash.
- A failure between `Drive.Files.create` and `writeSpreadsheetIdForUser_` that bypasses cleanup (e.g., script execution killed mid-flow by Apps Script's 6-minute limit) leaves an orphaned file in the user's Drive. The user can manually trash it; the next sign-in creates a fresh file because no mapping exists.

### 10.4 Rollback behavior

The flag flip is the primary rollback lever:

1. **Immediate:** Apps Script editor → Project Settings → Script Properties → set `CENTRAL_MODE` = `false` (or delete the property). Effect is immediate on next request. `getUserSpreadsheet_()` reverts to legacy pass-through.
2. **Deployment-level:** archive the `CashCompass — Central Beta (Slice 1)` deployment in Manage Deployments. URL stops responding. Bound deployment unaffected.
3. **Code-level:** `git revert` the slice commit. `central_provisioning.js` is deleted, `central_resolver.js` reverts to 1-line pass-through, `webapp.js` reverts to no allow-list gate, `profile.js` reverts to the no-arg `ensureInputSettingsSheet_`. Existing mappings remain in script properties (preserved for re-enable). Existing user-owned workbooks remain in user Drives (never deleted).
4. **Mapping cleanup:** `clearMappingForUser_(email)` is exposed for single-user manual cleanup. Bulk cleanup is done via the Script Properties UI.

**Critical invariant: under no rollback path is a user-owned workbook hard-deleted.** Mappings can be cleared (which simply means the next sign-in creates a new file), but workbooks already in user Drives are the user's property and are preserved.

---

## 11. Runtime test checklist (acceptance)

This is the 10-row checklist from `CENTRAL_APP_WORKBOOK_CREATION_FIRST_SLICE_PLAN.md → §11.2`, plus three implementation-layer rows specific to this slice.

### 11.1 Pre-test setup

- All §2 prerequisites are true.
- Code from this slice is `clasp push`ed to the project.
- `CENTRAL_MODE` script property set to `true`.
- `FAMILY_BETA_ALLOWLIST` populated with developer's primary email and the disposable account's email.
- `BETA_CONTACT_EMAIL` optionally set.
- Disposable account signed in to a separate browser profile / incognito.

### 11.2 Test rows

| # | Step | Acceptance criterion |
|---|---|---|
| **A1** | In Apps Script editor → Project Settings → Scopes, confirm Drive v3 advanced service is listed under Services. | Listed. |
| **A2** | Apps Script editor → Executions tab, run `getCurrentUserEmail_()` from the developer's primary account via the Run dialog. | Returns the developer's email, lowercased. |
| **A3** | Apps Script editor → Run dialog, run `buildMappingKey_('test@example.com')`. | Returns a 73-char string starting with `mapping::` followed by 64 lowercase hex characters. |
| 1 | Disposable account opens the central deployment URL. | Consent screen lists exactly the six §3.4 scopes (from prep plan). Accept. |
| 2 | Page renders. | Setup / Review surface (not red banner, not blank). |
| 3 | Disposable account's Drive. | A new file `CashCompass — <disposable-email>` exists, owned by disposable account. Contains exactly one sheet: `INPUT - Settings`. |
| 4 | Walk Setup / Review on disposable: Bank Account, Debt, Bill, Cash Flow. | Each step's existing onboarding handoff fires; canonical sheets created additively. No red banner. |
| 5 | Close browser entirely. | (No action.) |
| 6 | Wait ≥1 hour, re-open the deployment URL in the same disposable profile. | Page loads directly to populated dashboard, same spreadsheet ID (no new file in Drive). |
| 7 | Apps Script editor → Project Settings → Script Properties. | `mapping::<hash>` entry exists with the disposable's workbook ID as value. |
| 8 | Sign in to the central URL from the developer's primary account in a separate browser. | A second workbook appears in the developer's Drive named `CashCompass — <developer-email>`. The disposable's workbook is unchanged. |
| 9 | Sign in to the central URL from a third account **not** on `FAMILY_BETA_ALLOWLIST`. | Private-beta rejection HTML renders. **No Drive write.** **No script property write.** Verify via Drive check and Script Properties tab. |
| 10 | Verify the existing bound deployment is unaffected. | Loads exactly as before. Bound spreadsheet untouched. No central-mode artifacts leaked into it. |
| **B1** | Apps Script editor → Executions tab, observe the disposable account's recent runs. | "User" column shows the disposable's email (proves `USER_ACCESSING` is in effect for the central flow). |
| **B2** | With `CENTRAL_MODE=false` (flip the property), hit the central URL from the developer's account. | Allow-list still gates (developer passes). Resolver returns whatever `getActiveSpreadsheet()` returns under `USER_ACCESSING` (may be null → error, may be the bound spreadsheet — both acceptable, proves the flag flips behavior). Re-set `CENTRAL_MODE=true` after the test. |
| **B3** | Trigger a deliberate stale mapping: in Script Properties, replace the disposable's mapping value with a known-bad ID (e.g., `INVALID_ID_FOR_TEST`). Hit the central URL. | An error renders mentioning `StaleMappingError`-like wording (or the underlying openById failure). **No new workbook is created.** Reset the mapping to the real ID after the test. |

### 11.3 Pass / fail

- **PASS:** every row in §11.2 succeeds. The disposable account is fully onboarded end-to-end through central mode without developer intervention. The bound deployment is unaffected. The allow-list rejects unauthorized accounts cleanly. The stale-mapping path surfaces an error without creating an orphan workbook.
- **PARTIAL:** any cosmetic issue (e.g., onboarding wording is awkward in central mode, the rejection HTML's CSS renders differently than expected, the consent screen wording is slightly off). Document and ship with known issues.
- **FAIL:** any of:
  - The disposable account cannot complete onboarding.
  - A workbook is created for the unauthorized third account.
  - The bound deployment breaks.
  - Mappings are written for unauthorized accounts.
  - Stale-mapping path silently creates a duplicate workbook (would prove auto-reprovision logic leaked in despite §6.5 saying not to).
  - The lock is not released, causing the next request from the same user to time out.
- A FAIL triggers immediate rollback per §10.4 step 1 (flip `CENTRAL_MODE` to `false`).

---

## 12. Explicit non-goals

Restated from `CENTRAL_APP_WORKBOOK_CREATION_FIRST_SLICE_PLAN.md → §12` for the implementor's reference. The implementation prompt **must refuse** to include any of these:

- Billing / monetization / paid tiers.
- Public onboarding (anyone outside the allow-list).
- Admin portal / UI for managing users, mappings, or allow-list.
- GA-scale architecture (no horizontal sharding of script properties, no rate-limit infrastructure beyond Apps Script defaults).
- Analytics / telemetry collection beyond Apps Script's built-in Stackdriver logging.
- Multi-user support tooling (help desk surface, ticket creation, etc.).
- Auto-reprovision on stale mapping. Manual recovery only.
- Snapshot / backup rollback tooling.
- Audit-log sheet mirror of the script-properties mapping.
- Migration of the developer's existing bound-mode workbook into the central scheme.
- Schema versioning beyond what the existing additive bootstrap chain produces.
- Generated-sheet formatting polish (separate workstream — `GENERATED_SHEET_FORMATTING_POLISH_PLAN.md`).
- Bank Import (out of family-beta scope per `CENTRAL_APP_FAMILY_BETA_PLAN.md`).
- Per-execution caching of the resolved spreadsheet handle (later refinement).
- Subfolder / folder placement for the user-owned workbook (Drive root for first slice).
- Sending a "welcome" email on first provision.
- Recording provision events to the user's Activity Log sheet (the sheet does not exist yet on a fresh workbook; provisioning runs before bootstrap completes).
- Changing the existing `central_resolver.js` 1-line pass-through behavior when `CENTRAL_MODE` is off.
- Touching any `.html` file.

If the implementation prompt proposes any item from this list, it must explicitly refuse with "out of scope; deferred" rather than silently include.

---

## 13. Implementation guardrails (summary for the prompt)

A condensed summary the implementation prompt must follow:

1. **Files touched:** `central_resolver.js` (modified), `webapp.js` (modified), `profile.js` (modified surgically), `central_provisioning.js` (new), `SESSION_NOTES.md` (appended). **No other file.**
2. **Functions added:** §4 lists every function. No additional helpers, no convenience wrappers.
3. **Script properties read/written:** §5 lists every property. No additional properties.
4. **`CENTRAL_MODE` default:** `false`. Off = byte-for-byte legacy.
5. **Allow-list gate:** runs on every `doGet`, regardless of `CENTRAL_MODE`.
6. **Mapping key:** `mapping::` + SHA-256 hex of lowercase email. No other format.
7. **Lock:** `LockService.getUserLock()`, 30s, double-check inside.
8. **Cleanup:** soft delete (`setTrashed`) on partial failure. **Never** hard delete a user-owned file.
9. **Stale mapping:** throw `StaleMappingError`. **Never** auto-reprovision.
10. **Workbook ownership:** user-owned, Drive root, no template copy, no folder.
11. **Bootstrap:** `runMinimalBootstrap_(ss)` calls only `ensureInputSettingsSheet_(ss)`. **No other ensure helper.**
12. **Refactor:** `ensureInputSettingsSheet_` gets an optional `ss` parameter; every other function in `profile.js` is untouched.
13. **No `.html` change.** **No `appsscript.json` change.** **No deployment change.**
14. **SESSION_NOTES.md:** one new bullet describing the slice, the developer's manual setup steps (set `CENTRAL_MODE`, set `FAMILY_BETA_ALLOWLIST`, optionally set `BETA_CONTACT_EMAIL`), and the rollback procedure.

---

## 14. Implementation gate

**No implementation may begin until this prompt spec is reviewed and committed.**

The implementation prompt that consumes this spec:
- Must reference this doc and the two cross-referenced plans by commit hash.
- Must produce a diff matching exactly §3 (no extra files, no missing files).
- Must implement exactly the §4 function inventory with exactly the §4 signatures.
- Must read/write exactly the §5 script properties.
- Must follow the §10 lock and cleanup semantics.
- Must produce a runtime test report following §11 before declaring the slice done.
- Must respect every §12 non-goal.

After the runtime test passes, the slice is complete and the next planning artifact is whichever item from `CENTRAL_APP_NEXT_STEP_BASELINE.md` is now at the front of the queue (likely auto-reprovision on stale mapping, an admin allowlist UI, or the OAuth verification workstream).

---

## 15. Sign-off

This is the implementation-ready prompt spec for the resolver/provisioning slice. Every decision the implementation prompt would otherwise make on the fly is pinned here. The next artifact is the implementation prompt itself, not another planning doc.

End of document.
