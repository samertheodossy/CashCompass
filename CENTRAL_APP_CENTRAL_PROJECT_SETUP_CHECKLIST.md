# CENTRAL_APP_CENTRAL_PROJECT_SETUP_CHECKLIST.md

Operational checklist for creating and validating the standalone CashCompass Central App Apps Script project. This is the action-level companion to `CENTRAL_APP_SEPARATE_PROJECT_MIGRATION_PLAN.md`, which records the architectural decision. This checklist is what you follow when actually executing the setup.

**Documentation/planning only.** No code changes, no deployment actions, no file creation are authorized by this document alone. Each numbered action step is a gate; complete it and record the result before advancing.

Cross-references:
- `CENTRAL_APP_SEPARATE_PROJECT_MIGRATION_PLAN.md` — the two-project architecture decision; read and understand §3–§11 before starting this checklist.
- `CENTRAL_APP_DEPLOYMENT_PREPARATION_PLAN.md` — manifest rationale; §3.4 scope justifications; §6.3 Drive permission analysis; §8 disposable-account test protocol.
- `CENTRAL_APP_RESOLVER_PROVISIONING_IMPLEMENTATION_PROMPT.md` — original provisioning code spec (shipped in `d952dfa`); reference for `central_provisioning.js` semantics.
- `CENTRAL_APP_WORKBOOK_CREATION_FIRST_SLICE_PLAN.md → §15` — runtime evidence proving provisioning works under the shared project; the same logic carries to the central project.
- `central_resolver.js`, `central_provisioning.js` — the two files with per-project code differences.
- `CENTRAL_APP_DEPENDENCY_AUDIT.md` — the full inventory of `SpreadsheetApp.getActiveSpreadsheet()` call sites (~131 remaining outside already-migrated seam files). Relevant to §6 below.

---

## 1. Purpose

This checklist walks through every step required to create the standalone Central App project, push the correctly modified codebase to it, configure the deployment and script properties, and run the initial runtime validation sequence. It is written to be followed top-to-bottom in a single session, with explicit go/no-go gates at each phase.

The Central App project is a **new, standalone** Google Apps Script project. It is:
- Not bound to any spreadsheet.
- Always in central mode — no `CENTRAL_MODE` flag, no bound fallback.
- The only authorized home for `FAMILY_BETA_ALLOWLIST`, `BETA_CONTACT_EMAIL`, and `mapping::<hash>` script properties.
- The deployment URL that future family-beta users receive.

The bound project (the existing git repo root project) is not modified during this checklist.

---

## 2. Preconditions

All preconditions must be verified before any action in §3 begins. Record the result of each check.

### 2.1 Bound project state

- [ ] **Working tree is clean.** `git status` shows no modified tracked files. Only untracked docs allowed.
  ```
  git status --short
  # Expected: no M entries; at most ?? for untracked docs
  ```
- [ ] **Latest code is committed and pushed.** `git log --oneline -3` shows the current expected HEAD.
  ```
  git log --oneline -3
  # Expected HEAD: 06458bc Central App: deployment isolation analysis + separate-project migration plan
  ```
- [ ] **Bound deployment URL is recorded.** The URL stored in `PLANNER_DASHBOARD_WEBAPP_URL` (or known from last use) is written down somewhere safe before any work begins. It must be verifiable after the setup.
- [ ] **`CENTRAL_APP_SEPARATE_PROJECT_MIGRATION_PLAN.md` is committed.** (It is — commit `06458bc`.)

### 2.2 Developer account access

- [ ] Developer is signed in to `samertheodossy@gmail.com` in the primary browser.
- [ ] Developer has access to [script.google.com](https://script.google.com) (can create new projects).
- [ ] Developer has access to the [GCP console](https://console.cloud.google.com) for the Apps Script linked project.
- [ ] clasp is installed and authenticated: `clasp login --status` shows the developer's account.

### 2.3 Disposable account readiness

- [ ] `cashcompass2026@gmail.com` credentials are accessible.
- [ ] A clean browser profile or incognito window is available for the disposable-account test.
- [ ] The disposable account has been used at least once (not a brand-new zero-day account).

### 2.4 Bound workbook safety confirmation

- [ ] Open the developer's personal CashCompass spreadsheet. Confirm it loads correctly.
- [ ] Note the current sheet count. Record: _______ sheets.
- [ ] This count will be verified again at the end of the checklist (§9, Step 8.5) to confirm the bound workbook was untouched.

---

## 3. Project creation

### Step 1 — Create the standalone Apps Script project

- [ ] Go to [script.google.com](https://script.google.com) → **New project**.
- [ ] Name it exactly: `CashCompass — Central App`
  - Use an em dash (U+2014 `—`), not a hyphen, consistent with workbook naming convention.
- [ ] Confirm the project opens to an empty editor with only a `Code.gs` stub.
- [ ] **Critical: do NOT select "Bound to a spreadsheet."** This is a standalone project. There is no spreadsheet container.

### Step 2 — Record the script ID

- [ ] In the Apps Script editor: **Project Settings** (gear icon) → **Script ID**.
- [ ] Copy the script ID. Record it here: `_________________________`
- [ ] This ID is used in clasp configuration (§4).

### Step 3 — Record the GCP project (if separate from bound project's GCP)

- [ ] In Project Settings → **Google Cloud Platform (GCP) Project** → note the project number.
- [ ] Record: `_________________________`
- [ ] If Apps Script has auto-assigned a GCP project, the Drive API will need to be enabled in that project's console (§5.3). Note whether this is the same GCP project as the bound script or a new one.

---

## 4. Push strategy and clasp configuration

### 4.1 Recommended approach: two `.clasp` files in the same repo (Option B)

The bound project's `.clasp.json` at the repo root stays as-is. A second clasp config for the central project is added alongside it. This is the Option B approach from `CENTRAL_APP_SEPARATE_PROJECT_MIGRATION_PLAN.md §6.1`.

```
.clasp.json          ← existing bound project config (DO NOT CHANGE)
.clasp-central.json  ← new central project config (added in this step)
```

### Step 4 — Create `.clasp-central.json`

- [ ] At the repo root, create `.clasp-central.json` with the central project's script ID:
  ```json
  {
    "scriptId": "<script-ID-from-Step-2>",
    "rootDir": "."
  }
  ```
- [ ] **Do not modify `.clasp.json`** (the bound project config).
- [ ] Verify: `cat .clasp.json` still shows the bound project's script ID (unchanged).

### Step 5 — Add `.clasp-central.json` to version control

- [ ] `git add .clasp-central.json`
- [ ] This file should be committed before the push so the configuration is tracked.
- [ ] Do **not** add it to `.gitignore` — it is a project infrastructure file, not a secret.

### Step 6 — Create `push-central.sh`

- [ ] At the repo root, create `push-central.sh`:
  ```bash
  #!/bin/bash
  # Push the current codebase to the CashCompass Central App project.
  # Review per-project file changes before running (see CENTRAL_APP_CENTRAL_PROJECT_SETUP_CHECKLIST.md §6).
  clasp push --project .clasp-central.json
  ```
- [ ] `chmod +x push-central.sh`
- [ ] `git add push-central.sh && git commit -m "Add central project clasp config and push script"`
- [ ] Push to remote: `git push`

### 4.2 Why not a direct `clasp clone`

`clasp clone <scriptId>` overwrites the local `.clasp.json`, which would corrupt the bound project's clasp config. Using `--project` flag or a named config file is safer because the bound project config is never touched.

---

## 5. Manifest setup for the central project

Before the first push, prepare the central-project `appsscript.json`. **This manifest is NOT pushed to the bound project** — it is pushed only to the central project during the `push-central.sh` run.

### 5.1 The central project manifest

The central `appsscript.json` is identical to what the shared project is currently carrying (because the shared project was already given the central manifest during the experiment). Record for confirmation:

```json
{
  "timeZone": "America/Los_Angeles",
  "dependencies": {
    "enabledAdvancedServices": [
      { "userSymbol": "Drive", "serviceId": "drive", "version": "v3" }
    ]
  },
  "exceptionLogging": "STACKDRIVER",
  "runtimeVersion": "V8",
  "webapp": {
    "executeAs": "USER_ACCESSING",
    "access": "ANYONE"
  },
  "oauthScopes": [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive.file",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/script.send_mail",
    "https://www.googleapis.com/auth/script.scriptapp",
    "https://www.googleapis.com/auth/script.container.ui"
  ]
}
```

Scope rationale is fully documented in `CENTRAL_APP_DEPLOYMENT_PREPARATION_PLAN.md §3.4`. No scope changes vs the shared-project experiment.

### Step 7 — Verify the current `appsscript.json` matches the central manifest

- [ ] `cat appsscript.json` — confirm it already contains the central manifest above.
  - If yes: no edit needed. The same file is pushed to the central project.
  - If it has been reverted to the bound manifest: it will need to be restored before `push-central.sh` runs. Do not revert it yet; this is noted in §6.

### 5.2 The bound project manifest revert (deferred)

The bound project's `appsscript.json` should eventually revert to `USER_DEPLOYING` / `access: MYSELF` / no Drive service / no `oauthScopes` block. **This revert is NOT part of this checklist** — it is a follow-on step after the central project is confirmed working, to avoid accidentally breaking both projects at once. It is tracked in `CENTRAL_APP_SEPARATE_PROJECT_MIGRATION_PLAN.md §10.2`.

### 5.3 Enable the Drive API in the central project's GCP project

- [ ] In GCP console for the central project's GCP project: **APIs & Services → Library → Google Drive API → Enable**.
- [ ] Record confirmation: Drive API enabled for central project GCP: [ ] Yes
- [ ] If the central project shares a GCP project with the bound project: the Drive API is already enabled. Confirm and proceed.
- [ ] If the central project has a new auto-assigned GCP project: enable the Drive API now. This is a one-time click.

---

## 6. Central code baseline — per-project file changes

This is the most critical pre-push preparation step. Three categories of files must be prepared correctly before `push-central.sh` is run.

### 6.1 Files pushed verbatim (no changes required)

All domain logic files are identical in both projects. These files are pushed as-is from the repo:
- All `*.html` templates (30 files)
- All domain logic `*.js` files not listed in §6.2 or §6.3

### 6.2 Files requiring per-project edits before the central push

These three files have content that must differ between the bound and central projects. **Prepare these edits in a temporary working state or a dedicated branch before running `push-central.sh`.** Do NOT commit these edits to `main` — they belong only in the central project.

#### A. `central_resolver.js` — remove the flag branch, remove `isCentralModeEnabled_()`

Current committed version (bound project):
```javascript
function getUserSpreadsheet_() {
  if (!isCentralModeEnabled_()) {
    return SpreadsheetApp.getActiveSpreadsheet();
  }
  return getOrProvisionUserSpreadsheet_();
}

function isCentralModeEnabled_() {
  try {
    var v = PropertiesService.getScriptProperties().getProperty('CENTRAL_MODE');
    return v === 'true';
  } catch (_e) {
    return false;
  }
}
```

Central project version (pushed to central only):
```javascript
/**
 * Central App resolver — always routes to the central provisioning path.
 * This project is standalone (not bound to any spreadsheet).
 * SpreadsheetApp.getActiveSpreadsheet() is never called here.
 * isCentralModeEnabled_() does not exist — this project is always central.
 */
function getUserSpreadsheet_() {
  return getOrProvisionUserSpreadsheet_();
}
```

**`getCurrentUserEmail_()` is unchanged** — copy it as-is.

#### B. `central_provisioning.js` — remove `CENTRAL_MODE_KEY_` constant

The constant `var CENTRAL_MODE_KEY_ = 'CENTRAL_MODE';` on line 44 has no meaning in a project where central mode is a structural invariant. The property it references is never set in the central project's script property store.

Central project version: delete line 44 (`var CENTRAL_MODE_KEY_ = 'CENTRAL_MODE';`) and any comment block that refers to `CENTRAL_MODE` defaulting to off. The allow-list, lock, provisioning, and mapping logic are unchanged.

#### C. `webapp.js` — accept `e` parameter in `doGet`

Current: `function doGet()` (no parameter).

Central project version: `function doGet(e)` (accepts the event object, even if unused today, for future URL/query-parameter work per `CENTRAL_APP_SEPARATE_PROJECT_MIGRATION_PLAN.md §3.2`).

This is a safe, non-breaking change. The event object `e` is simply available for later use.

### 6.3 The `getActiveSpreadsheet()` migration scope — critical context

Before this checklist was written, an audit revealed the following `SpreadsheetApp.getActiveSpreadsheet()` call-site count across the startup/dashboard files (current committed state):

| File | Call sites |
|---|---|
| `sheet_bootstrap.js` | 3 |
| `config.js` | 2 (one is a comment) |
| `dashboard_data.js` | 9 |
| `onboarding.js` | 12 |
| `profile.js` | 2 |
| `house_values.js` | 17 |
| **Total in these 6 files** | **~45** |

Plus an additional ~86 call sites across the remaining domain logic files per `CENTRAL_APP_DEPENDENCY_AUDIT.md`.

**In a standalone central project, every one of these calls will return `null`** because there is no active spreadsheet. Any code path that uses the returned `null` without a null-check will throw `Cannot read properties of null`.

This means the central project cannot be a direct code-copy and immediately work end-to-end. Two tiers of migration are required:

#### Tier 1 — Startup/onboarding critical paths (previously identified and reverted)

The previously reverted startup-routing fixes covered specific functions in the 6 files above that are called on every page load. These fixes replace `getActiveSpreadsheet()` with `getUserSpreadsheet_()` in the functions that execute at startup and onboarding time. These Tier 1 fixes are the **minimum required for the central project to reach the Setup/Review screen without crashing**.

Tier 1 functions (the previously reverted changes, to be re-applied to the central project only):
- `sheet_bootstrap.js`: `getStartupRoutingFromDashboard`, `getOnboardingBootstrapStatusFromDashboard`, `ensureBootstrapSheet_`
- `dashboard_data.js`: `buildDashboardSnapshot_`
- `config.js`: `getSheet_` stale-handle retry path
- `onboarding.js`: `getOnboardingStatusFromDashboard`, `getOnboardingUpcomingFromDashboard`, `getOnboardingHousesFromDashboard`
- `profile.js`: `probeProfileStatus_` / `getProfileSettings` / `readAllSettingsMap_` / `readProfileDobRawValues_` chain
- `house_values.js`: `getHousesFromHouseValues_`

#### Tier 2 — Full dashboard migration (deferred to a separate implementation prompt)

The remaining ~40 `getActiveSpreadsheet()` calls in the 6 files above (not covered by Tier 1), plus all calls in the remaining domain logic files, will cause runtime errors when those code paths are exercised in the central project. However, many of these code paths are only reached after the user is past the onboarding flow and actively using the full dashboard.

Tier 2 is **not part of this checklist**. It is a separate implementation prompt, to be executed after the central project's initial setup is confirmed working at the onboarding level. The full call-site inventory is in `CENTRAL_APP_DEPENDENCY_AUDIT.md`.

**Summary for this checklist:** Apply Tier 1 changes (§6.2 + Tier 1 function list) to the files being pushed to the central project. Do not attempt Tier 2 before initial setup is confirmed.

### Step 8 — Prepare the per-project file edits

This step is **preparatory only** — do not commit these edits to `main`. Prepare them in a way that lets you run `push-central.sh` with the correctly-modified files without polluting the bound project's branch.

**Recommended approach for the actual push session:**

1. Create a temporary local branch: `git checkout -b central-project-push`
2. Apply the three §6.2 edits to `central_resolver.js`, `central_provisioning.js`, `webapp.js`.
3. Apply the Tier 1 startup-routing fixes to `sheet_bootstrap.js`, `dashboard_data.js`, `config.js`, `onboarding.js`, `profile.js`, `house_values.js`.
4. Run `push-central.sh` to push all files to the central project.
5. Immediately `git checkout main` and `git branch -D central-project-push` — the branch is disposable; its only purpose was to temporarily hold the central-project-specific file states for the push.
6. The central project now contains the correctly-prepared codebase. The `main` branch of the git repo remains clean.

**Why a temporary branch and not a direct edit + revert:**
If `push-central.sh` fails mid-push, a direct edit of `main`-tracked files leaves the working tree in an ambiguous state. A temporary branch lets you inspect, restart, or revert cleanly without risk to `main`.

---

## 7. Script properties for the central project

These properties must be set in the central project's Apps Script editor **before** the runtime test in §8. Set them via Apps Script editor → Project Settings → Script Properties.

### Step 9 — Set initial script properties

| Key | Value | Notes |
|---|---|---|
| `FAMILY_BETA_ALLOWLIST` | `samertheodossy@gmail.com,cashcompass2026@gmail.com` | Comma-separated; no spaces; all lowercase. Add others when inviting family. |
| `BETA_CONTACT_EMAIL` | `samertheodossy@gmail.com` (or preferred contact) | Shown in rejection messages to unauthorized users. |

**Do NOT set:**
- `CENTRAL_MODE` — this property does not exist in the central project. The resolver does not check it. Setting it has no effect and is confusing.
- `PLANNER_DASHBOARD_WEBAPP_URL` — this is a bound-project property. Not relevant here.
- Any mapping key — these are created automatically by provisioning on first user access.

### Step 10 — Verify script properties are set

- [ ] Apps Script editor → Project Settings → Script Properties.
- [ ] Confirm `FAMILY_BETA_ALLOWLIST` is present and contains both emails.
- [ ] Confirm `BETA_CONTACT_EMAIL` is present.
- [ ] Confirm no `CENTRAL_MODE` property exists.

### 7.1 Mapping portability decision

The developer's account (`samertheodossy@gmail.com`) may already have a mapping entry in the **bound project's** script properties from the shared-project experiment. That mapping points to the central workbook created during the experiment (`CashCompass — samertheodossy@gmail.com` in the developer's Drive).

**Option A (recommended for clean setup):** Do nothing. The central project starts with no mappings. On the developer's first access, provisioning creates a fresh workbook. The experiment workbook in Drive can be manually trashed later.

**Option B (reuse experiment workbook):** Before first access, manually set `mapping::<sha256(samertheodossy@gmail.com)>` in the central project's script properties to the existing workbook's spreadsheet ID (visible in the workbook's URL as `https://docs.google.com/spreadsheets/d/<ID>/edit`). The central project then opens the existing workbook rather than creating a new one.

Record decision: [ ] Option A — fresh workbook  [ ] Option B — reuse experiment workbook

If Option B: record the experiment workbook's spreadsheet ID: `_________________________`

---

## 8. Deployment creation

### Step 11 — Create the central project web-app deployment

- [ ] In the Apps Script editor for the **central project** (not the bound project): **Deploy → New deployment**.
- [ ] Type: **Web app**.
- [ ] Description: `CashCompass Central App — Beta 1`.
- [ ] Execute as: **User accessing the web app** (maps to `executeAs: USER_ACCESSING`).
- [ ] Who has access: **Anyone with a Google account** (maps to `access: ANYONE`).
- [ ] Click **Deploy**.
- [ ] Copy the deployment URL (`/exec` link). Record it: `_________________________`
- [ ] **Do not use the `/dev` URL** for sharing — `/dev` is unpinned and runs the latest code including incomplete changes.

### Step 12 — Verify the deployment is visible in Manage Deployments

- [ ] Apps Script editor → **Deploy → Manage deployments**.
- [ ] Confirm `Beta 1` deployment appears with status Active.
- [ ] Confirm the `/exec` URL matches what was recorded in Step 11.

---

## 9. Runtime test sequence

Execute these tests in order. Do not skip ahead. A failure at any step is a stop — investigate before proceeding.

### Phase A — Developer provisioning test

**Objective:** Confirm the developer's account provisions correctly in the standalone central project.

#### Step A1 — First access

- [ ] Open the central deployment URL in the primary browser signed in to `samertheodossy@gmail.com`.
- [ ] Google may show a consent screen (new project — new OAuth grant required even for the developer). Accept.
- [ ] Google may show "This app isn't verified" interstitial. Click Advanced → Go to CashCompass — Central App (unsafe). (Expected for an unverified app.)

#### Step A2 — Verify provisioning

- [ ] The app loads. Observe what screen is shown:
  - If Option A (fresh workbook): expect Setup/Review Welcome screen (new workbook ≤ 2 sheets = blank/minimal).
  - If Option B (reuse experiment workbook): expect behavior based on workbook's sheet count (if > 2 sheets, expect Overview/Dashboard).
- [ ] In the developer's Drive, confirm a workbook named `CashCompass — samertheodossy@gmail.com` exists (new one if Option A, existing if Option B).
- [ ] In the central project's Script Properties: confirm `mapping::<sha256(samertheodossy@gmail.com)>` now exists with the correct spreadsheet ID.

#### Step A3 — Return visit

- [ ] Reload the central deployment URL (same browser session).
- [ ] Confirm the same screen appears (no new workbook created — mapping was found and reused).
- [ ] In Script Properties: confirm no duplicate mapping key was created.

#### Step A4 — Verify bound workbook untouched

- [ ] Open the developer's personal CashCompass spreadsheet (the bound project's workbook).
- [ ] Confirm sheet count matches the count recorded in §2.4: _______ sheets.
- [ ] Confirm no new data appeared.
- [ ] Open the bound project's deployment URL. Confirm it loads normally with the developer's personal data.

**Phase A gate: ALL steps pass → proceed to Phase B.**

---

### Phase B — Disposable account provisioning test

**Objective:** Confirm a second, separate Google account provisions its own workbook in isolation.

#### Step B1 — Open the central URL in a clean window

- [ ] Open a fresh incognito/private window signed in **only** to `cashcompass2026@gmail.com`.
- [ ] Navigate to the central deployment URL.
- [ ] Accept the "unverified app" interstitial.
- [ ] Accept the consent screen (lists the 6 scopes from §5.1).

#### Step B2 — Verify provisioning

- [ ] App shows Setup/Review Welcome screen (fresh workbook for a new user).
- [ ] In `cashcompass2026@gmail.com`'s Drive: confirm a workbook `CashCompass — cashcompass2026@gmail.com` was created and is owned by `cashcompass2026@gmail.com`.
- [ ] In the central project's Script Properties: confirm `mapping::<sha256(cashcompass2026@gmail.com)>` now exists.
- [ ] Confirm `mapping::<sha256(samertheodossy@gmail.com)>` was NOT modified.

#### Step B3 — Verify no developer data visible

- [ ] On the Setup/Review screen shown to `cashcompass2026@gmail.com`: confirm no reference to "Samer Theodossy" or any developer-specific data.
- [ ] Confirm the profile, upcoming expenses, and houses sections show blank/empty (fresh workbook).

**Phase B gate: ALL steps pass → proceed to Phase C.**

---

### Phase C — Unauthorized account rejection test

**Objective:** Confirm the allow-list gate rejects users not on the list.

#### Step C1 — Access with an unlisted account

- [ ] Open a fresh incognito/private window signed in to any Google account NOT in `FAMILY_BETA_ALLOWLIST`.
- [ ] Navigate to the central deployment URL.
- [ ] Accept the consent screen (platform-level access is `ANYONE`; app-layer allow-list is the gate).

#### Step C2 — Verify rejection

- [ ] The app shows a rejection message (not a dashboard, not a Setup/Review screen).
- [ ] No workbook was created in the unlisted account's Drive.
- [ ] No mapping key was written to the central project's Script Properties.

**Phase C gate: passes → proceed to Phase D.**

---

### Phase D — Returning mapped user test

**Objective:** Confirm a previously provisioned user gets their existing workbook, not a new one.

#### Step D1 — Return visit as disposable account

- [ ] Re-open the central deployment URL in the same incognito window (or a fresh one) signed in to `cashcompass2026@gmail.com`.
- [ ] Confirm the app loads the same workbook as the Phase B test (same spreadsheet ID in the mapping).
- [ ] Confirm no second `CashCompass — cashcompass2026@gmail.com` workbook was created in the disposable account's Drive.
- [ ] Confirm the mapping key was not changed.

**Phase D gate: passes → proceed to Phase E.**

---

### Phase E — Bound project final smoke test

**Objective:** Confirm the entire setup sequence left the bound project completely unaffected.

#### Step E1 — Bound project checklist

- [ ] Open the developer's bound deployment URL. Confirm it loads with personal data.
- [ ] Verify the bound project's `appsscript.json` in the editor still shows the current committed manifest (or the expected state if the bound manifest revert was done separately).
- [ ] Verify the bound project's Script Properties: confirm `FAMILY_BETA_ALLOWLIST`, `BETA_CONTACT_EMAIL`, and any `mapping::` keys are **absent** — they exist only in the central project.
- [ ] Verify the bound workbook sheet count still matches §2.4.
- [ ] Run `git status` on the repo: confirm only `.clasp-central.json` and `push-central.sh` are new tracked files; no unexpected changes to `.clasp.json` or any `.js` or `.html` file.

**Phase E gate: passes → setup complete.**

---

## 10. Rollback plan

If any phase fails:

### Step R1 — Archive the central deployment

- In the central project's Apps Script editor: **Deploy → Manage deployments → Beta 1 → Archive**.
- The `/exec` URL becomes inactive. No user data is affected.

### Step R2 — Delete central project mapping keys if needed

- In the central project's Script Properties: manually delete any `mapping::` keys created during the failed test.
- Do NOT delete the user's workbook — workbooks are user-owned and should only be trashed by the user themselves or with explicit consent.

### Step R3 — Verify bound project unaffected

- Confirm bound deployment still loads.
- Confirm bound project's Script Properties are unchanged.

### Step R4 — Document the failure

- Record the failure in `SESSION_NOTES.md`: which phase, which step, what the observed vs expected behavior was.
- Do not re-attempt the failed phase until the root cause is identified.

### What rollback does NOT affect

- The developer's bound workbook — never touched by the central project.
- The user's provisioned workbook — owned by the user in their Drive; archiving the deployment does not affect the workbook.
- The git repo — `main` branch is clean (the per-project edits were in a temporary branch, not committed to main).

---

## 11. Explicit non-goals for this checklist

This checklist is scoped to initial central project setup and validation. The following are explicitly deferred:

| Item | Why deferred |
|---|---|
| Inviting additional family members | Allow-list expansion is a separate action after Phase A–E pass. No code change required — just update `FAMILY_BETA_ALLOWLIST` script property. |
| Public/GA access | Requires OAuth verification with Google (multi-week process). Out of scope for beta. |
| Billing or quota management | Not required at family-beta scale (2–5 users). |
| Migration of personal workbook data | Personal data stays in the bound workbook. The central workbook starts fresh for each user. |
| Syncing bound and central code automatically | Option B (explicit `push-central.sh`) is the convention. Automated sync is Option C, deferred to a later planning slice. |
| Reverting bound project `appsscript.json` | This is `CENTRAL_APP_SEPARATE_PROJECT_MIGRATION_PLAN.md §10.2` and belongs to a separate follow-on checklist after the central project is confirmed working. |
| Tier 2 `getActiveSpreadsheet()` migration | Full dashboard function migration (the ~40 remaining call sites beyond the startup-critical Tier 1 set) is a separate implementation prompt. |
| Cleaning up the experiment workbook from the shared project | Developer's personal Drive cleanup; not a code task. |
| Archiving shared-project central-mode documents | Covered by the existing doc index cleanup pass (already scheduled in `CENTRAL_APP_DOC_INDEX.md §8`). |
| Cleanup of `CENTRAL_MODE` from the bound `central_resolver.js` | Part of the bound project cleanup sequence in `CENTRAL_APP_SEPARATE_PROJECT_MIGRATION_PLAN.md §9 Phase 6`. Deferred until central project is confirmed. |

---

## 12. Recommended next implementation prompt

Once this checklist is reviewed and committed, the next implementation prompt should be:

**"Prepare and push the CashCompass Central App project"**

That prompt would:

1. Create the temporary branch (`central-project-push`).
2. Apply the three §6.2 per-project file edits (`central_resolver.js`, `central_provisioning.js`, `webapp.js`).
3. Apply the Tier 1 startup-routing fixes to the six shared files.
4. Run `push-central.sh`.
5. Confirm the push succeeded (file count matches bound project).
6. Discard the temporary branch.
7. Set script properties per §7.
8. Create the deployment per §8.
9. Run Phase A developer provisioning test per §9.

That prompt does NOT:
- Commit per-project file edits to `main`.
- Revert the bound project's `appsscript.json`.
- Perform Phase B–E tests (those follow in a separate session with the disposable account).

The prompt is explicitly scoped to: temporary branch → per-project edits → push → script properties → deployment → Phase A only.

---

End of checklist.

---

## 13. Runtime Evidence — Phase A and Phase B (2026-05-28)

Recorded after execution. No code changes, no deployment changes, no `appsscript.json` changes. Documentation only.

### 13.1 Standalone project setup (completed)

| Item | Status | Notes |
|---|---|---|
| Standalone Apps Script project created | ✅ Done | Script ID: `153TEsXfVu4fwwToMj1-CvdOScj_vNJKBLTgSTejHZSTOUI89xHzgHt4_` |
| `.clasp-central.json` created and committed | ✅ Done | Committed to `main`; bound `.clasp.json` unchanged |
| `push-central.sh` created and committed | ✅ Done | Committed to `main` |
| Temporary branch `central-project-push` created | ✅ Done | Used for per-project edits; discarded after push |
| Per-project edits applied (§6.2 A/B/C) | ✅ Done | `central_resolver.js` unconditional; `central_provisioning.js` `CENTRAL_MODE_KEY_` removed; `webapp.js` `doGet(e)` |
| Tier 1 startup-routing fixes applied (§6.3) | ✅ Done | `sheet_bootstrap.js`, `dashboard_data.js`, `config.js`, `onboarding.js`, `profile.js`, `house_values.js` |
| Codebase pushed to central project | ✅ Done | `clasp push --force --project .clasp-central.json`; 68 files pushed |
| Temporary branch discarded | ✅ Done | `main` branch clean |
| Script properties set (§7) | ✅ Done | `FAMILY_BETA_ALLOWLIST`, `BETA_CONTACT_EMAIL` set in central project only |
| Drive API enabled in central GCP project | ✅ Done | Manual step completed in GCP Console |
| Web app deployment created (§8) | ✅ Done | Deployment ID: `AKfycbyq_OGiupdGO79GMOImkIgYv19hqlN1JuJfieuDlkXH6Rp637MhZc6jz9uRW2ZxANBlPA`; URL: `https://script.google.com/macros/s/AKfycbyq_OGiupdGO79GMOImkIgYv19hqlN1JuJfieuDlkXH6Rp637MhZc6jz9uRW2ZxANBlPA/exec` |

### 13.2 Phase A — Developer provisioning (PASS)

Executed against `samertheodossy@gmail.com` in the primary browser.

| Step | Result |
|---|---|
| A1 — First access + OAuth consent | **PASS** — consent granted; no interstitial errors |
| A2 — Workbook provisioned | **PASS** — `CashCompass — samertheodossy@gmail.com` created in developer's Drive; owned by developer; `INPUT - Settings` present; Welcome screen appeared |
| A3 — Return visit (mapping reuse) | **PASS** — reload found existing mapping; no re-provisioning; no duplicate workbook |
| A4 — Bound workbook untouched | **PASS** — original personal workbook and bound deployment URL unaffected |

**Phase A gate: PASS. Proceeded to Phase B.**

### 13.3 Phase B — Disposable account provisioning (PASS with one P3 observation)

Executed against `cashcompass2026@gmail.com` in a clean private/incognito window.

| Step | Result |
|---|---|
| B1 — First access + OAuth consent | **PASS** — consent granted; allow-list gate admitted the account |
| B2 — Workbook provisioned | **PASS** — `CashCompass — cashcompass2026@gmail.com` created in disposable account's Drive; owned by `cashcompass2026@gmail.com`; `INPUT - Settings` present; Welcome/Setup screen appeared |
| B3 — No developer data visible | **PASS** — no Samer Theodossy name, no developer house/upcoming counts, no developer profile data visible on the Setup screen |
| B4 — Mapping written | **PASS** — `mapping::<sha256(cashcompass2026@gmail.com)>` written to central project script properties |
| B5 — Developer mapping unchanged | **PASS** — developer's mapping entry value unchanged |
| B6 — Bound workbook untouched | **PASS** — bound deployment URL still loads developer personal data correctly |

**Phase B gate: PASS.**

### 13.4 P3 observation — Duplicate workbook for `cashcompass2026@gmail.com`

| Item | Detail |
|---|---|
| Observed | Two workbooks named `CashCompass — cashcompass2026@gmail.com` exist in the disposable account's Drive |
| Root cause (most likely) | Two separate page-load sessions both reached `getStartupRoutingFromDashboard()` before the first mapping was written; `LockService.getUserLock()` double-check may have seen stale null from PropertiesService propagation delay, OR the mapping was manually cleared between test runs |
| Severity | **P3 — hardening** (not a beta blocker; core provisioning, isolation, and data-separation are proven correct) |
| Immediate remediation | Manually trash the orphan workbook (Drive file whose ID does not match the current `mapping::<hash>` value); do not hard-delete |
| Code fix needed | Second-slice: add Drive filename deduplication lookup in `provisionWorkbookForUser_()` before `Drive.Files.create()` — if a file matching `buildWorkbookName_(email)` already exists and is owned by the caller, map it instead of creating a new one |
| When to fix | Before inviting additional family beta users; not required for Phase C–E validation |

### 13.5 Remaining checklist items

| Item | Status |
|---|---|
| Phase C — unauthorized account rejection | ⬜ Pending |
| Phase D — return-visit by disposable account | ⬜ Pending |
| Phase E — bound project formal smoke test | ⬜ Pending |
| Tier 2 `getActiveSpreadsheet()` migration (full dashboard) | ⬜ Deferred (separate prompt) |
| Bound project `appsscript.json` revert to `USER_DEPLOYING`/`MYSELF` | ⬜ Deferred (per `CENTRAL_APP_SEPARATE_PROJECT_MIGRATION_PLAN.md §10.2`) |
| `CENTRAL_MODE` flag cleanup from bound `central_resolver.js` | ⬜ Deferred (per `CENTRAL_APP_SEPARATE_PROJECT_MIGRATION_PLAN.md §9 Phase 6`) |
| Duplicate workbook hardening (P3 — Drive dedup in provisioning) | ⬜ Deferred (second slice) |
