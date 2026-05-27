# CENTRAL_APP_DEPLOYMENT_PREPARATION_PLAN.md

The **deployment / auth preparation** plan for the first central-mode slice. Isolates manifest, OAuth-scope, Drive Advanced Service, and deployment-posture risk from the resolver/provisioning logic so each can be validated independently. This doc covers **only** the platform layer (`appsscript.json`, deployment dialog, OAuth consent screen, Drive API enablement). Resolver/provisioning behavior remains the concern of `CENTRAL_APP_WORKBOOK_CREATION_FIRST_SLICE_PLAN.md`.

**Documentation only.** No Apps Script change, no HTML change, no `appsscript.json` change, no deployment change, no implementation. This doc gates the **first** of two implementation sub-prompts (manifest/deployment) ahead of the second (resolver/provisioning). Neither sub-prompt may run until this doc is reviewed and committed.

Cross-references:
- `CENTRAL_APP_WORKBOOK_CREATION_FIRST_SLICE_PLAN.md` — the slice plan this preparation feeds. Pins resolver function inventory, allow-list, mapping, lock semantics, runtime acceptance.
- `CENTRAL_APP_WORKBOOK_CREATION_AND_MAPPING_PLAN.md` — upstream architecture decisions.
- `CENTRAL_APP_DEPLOYMENT_OPTIONS.md` — `executeAs` / `access` / ownership trade-off space; Option B is the preferred direction this slice instantiates.
- `CENTRAL_APP_NEXT_STEP_BASELINE.md` — milestone framing.
- `CENTRAL_APP_BLANK_WORKBOOK_RUNTIME_REPORT.md` — runtime evidence that the additive bootstrap chain is sufficient under any auth posture.
- `appsscript.json` — current manifest (`executeAs: USER_DEPLOYING`, `access: MYSELF`, no explicit `oauthScopes`, no advanced services).
- `central_resolver.js` — current 1-line pass-through; **does not change in this preparation slice**.
- `webapp.js` — current `doGet`; **does not change in this preparation slice** (gate hook is added in the resolver slice).

---

## 1. Purpose

The first-slice implementation plan (`CENTRAL_APP_WORKBOOK_CREATION_FIRST_SLICE_PLAN.md`) pins every decision needed to implement the central-mode resolver and provisioning logic, but conflates two risk surfaces:

1. **Platform-layer risk** — does the manifest flip, the explicit scope declaration, the Drive Advanced Service, and the new deployment actually authorize and execute correctly under both the developer's primary account and a disposable second Google account?
2. **Application-layer risk** — does the resolver pick the right workbook, does provisioning create exactly one file under lock, does the mapping persist across sessions, does stale-mapping surface the right error?

Bundling both into a single implementation prompt means a single failure (e.g., the consent screen rejects `drive.file` because some unrelated codepath silently triggered a wider scope grant) blocks runtime testing of either layer, and a single rollback (`git revert`) re-litigates both layers at once.

This doc isolates layer (1). The implementation prompt that follows this doc:

- Touches **only** `appsscript.json` and the deployment dialog.
- Adds **zero** new Apps Script functions.
- Does **not** change `central_resolver.js`, `webapp.js`, or any other code file.
- Is followed by a runtime test that validates only the platform layer — consent screen, Drive API availability, deployment isolation, second-account access — before any resolver/provisioning code is written.

The application-layer slice (resolver + provisioning) is the **next** implementation prompt after this one validates clean. Each slice rolls back independently. Each slice's failure mode is unambiguous about which layer broke.

This is the smallest possible bisection of the central-mode change. It exists because OAuth scope mistakes are the single highest-cost failure mode in Apps Script (every user re-consents, the consent screen text is partially baked into the OAuth grant, and rolling back a scope expansion mid-launch is visible to users).

---

## 2. Current deployment state

The exact baseline this preparation plan changes from. Captured here so the diff is unambiguous.

### 2.1 Current `appsscript.json`

```json
{
  "timeZone": "America/Los_Angeles",
  "dependencies": {},
  "exceptionLogging": "STACKDRIVER",
  "runtimeVersion": "V8",
  "webapp": {
    "executeAs": "USER_DEPLOYING",
    "access": "MYSELF"
  }
}
```

### 2.2 Current bound-deployment behavior

- The Apps Script project is bound to the developer's personal CashCompass spreadsheet.
- `SpreadsheetApp.getActiveSpreadsheet()` returns the bound spreadsheet — the resolver's 1-line pass-through (`central_resolver.js`) yields that handle to every caller.
- `doGet` renders `PlannerDashboardWeb.html` against that bound spreadsheet, and onboarding, planner output, debounce triggers, etc., all run against the same workbook.
- The deployment URL is a `/exec` link the developer stores in script properties (`PLANNER_DASHBOARD_WEBAPP_URL`) and opens via the spreadsheet-bound launcher `openPlannerDashboardWebLauncher()`.

### 2.3 Current `executeAs` posture

- `executeAs: USER_DEPLOYING`. Every request executes under the developer's Google identity, regardless of who hits the URL. This is the **Option A** posture from `CENTRAL_APP_DEPLOYMENT_OPTIONS.md` and is the only posture proven at runtime today.
- Consequence: `Session.getEffectiveUser().getEmail()` returns the **developer's** email, not the caller's. The codebase has never depended on `getEffectiveUser()` returning a non-developer identity, so the resolver has no per-user branch.

### 2.4 Current `access` posture

- `access: MYSELF`. Only the developer's Google account can invoke the deployment URL. Any other Google account hitting the URL is rejected by the platform before `doGet` runs.
- Consequence: no app-layer allow-list is required today, and the deployment has never seen a non-developer request.

### 2.5 Current scope behavior

The codebase's scope footprint is **auto-detected** by Apps Script at deploy time from static analysis of every `*.js` file. The current manifest has **no** `oauthScopes` block, so the runtime authorization screen shows whatever the editor inferred at the most recent re-authorization. Based on a static scan of the codebase, the auto-detected scope set is:

| Source in code | Scope inferred |
|---|---|
| `SpreadsheetApp.*` (every module) | `https://www.googleapis.com/auth/spreadsheets.currentonly` for bound use; for a web app, often promoted to `https://www.googleapis.com/auth/spreadsheets` |
| `MailApp.sendEmail(...)` in `planner_output.js` | `https://www.googleapis.com/auth/script.send_mail` |
| `ScriptApp.newTrigger(...)` / `ScriptApp.getProjectTriggers()` in `debounce_planner.js`, `dashboard_data.js` | `https://www.googleapis.com/auth/script.scriptapp` |
| `Session.getActiveUser()` / `Session.getEffectiveUser()` (any reference) | `https://www.googleapis.com/auth/userinfo.email` (auto-attached for web apps under most postures) |
| `HtmlService.*`, `PropertiesService.*`, `LockService.*`, `Utilities.*`, `CacheService.*` | No scope (in-script services) |
| Container-bound UI (`SpreadsheetApp.getUi()`, `ui.prompt`, `ui.alert`) in `webapp.js` | `https://www.googleapis.com/auth/script.container.ui` (only for editor-launched bound flows; not used by the web app `doGet`) |

What is **not** in the codebase today:

- No `UrlFetchApp.*` call → no `script.external_request` scope needed.
- No `DriveApp.*` or `Drive.*` (Advanced Drive) call → no Drive scope needed today.
- No `CalendarApp.*`, `GmailApp.*`, `ContactsApp.*`, `MapsApp.*`, `DocumentApp.*`, `FormApp.*`, `GroupsApp.*`, `LanguageApp.*`, `CardService.*`, `XmlService.*` calls.

### 2.6 Current lack of explicit manifest scopes

- No `oauthScopes` array exists in `appsscript.json`. Apps Script's auto-detection has been the sole source of truth for what the deployment requests.
- Consequence: the developer has never explicitly seen the full scope list, and the consent text shown to non-developer users is whatever Apps Script decides to render for the inferred scopes. This is acceptable under `access: MYSELF` (only the developer ever sees the consent screen) but is **not acceptable** under `ANYONE_WITH_GOOGLE_ACCOUNT` because the wording the disposable account sees would be left to inference. Explicit declaration is therefore a **prerequisite** for the central-mode deployment, independent of any new scope we want to add.

### 2.7 Current Drive Advanced Service state

- `dependencies` is `{}` in `appsscript.json`. No advanced services are enabled.
- `Drive.Files.create(...)` is therefore **not callable** today — the symbol `Drive` is undefined in the runtime.
- Consequence: workbook auto-creation cannot run until the Drive Advanced Service (v3) is enabled and the linked Google Cloud project has the Drive API enabled.

---

## 3. Planned deployment changes

The exact intended end-state for this preparation slice. **Only the manifest and deployment dialog change. No code is touched.**

### 3.1 Pinned manifest diff

The target `appsscript.json` after this slice (additions in context):

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
    "access": "ANYONE_WITH_GOOGLE_ACCOUNT"
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

Each field's rationale appears below. The exact final `oauthScopes` array must be reconciled against the editor's auto-detected list before flipping (§4.6); the array above is the **planned starting point**, not a frozen final value.

### 3.2 `executeAs` change

- **From** `USER_DEPLOYING` → **to** `USER_ACCESSING`.
- Required so `Session.getEffectiveUser().getEmail()` returns the **calling user's** email and so `Drive.Files.create(...)` creates files in the calling user's Drive.
- Side effect: per-user quotas apply (per `CENTRAL_APP_DEPLOYMENT_OPTIONS.md` §3); this is desired at family-beta scale because it isolates one user's heavy load from another's.

### 3.3 `access` change

- **From** `MYSELF` → **to** `ANYONE_WITH_GOOGLE_ACCOUNT`.
- Required so a Google account other than the developer's can hit the deployment URL. The app-layer `FAMILY_BETA_ALLOWLIST` gate (`CENTRAL_APP_WORKBOOK_CREATION_FIRST_SLICE_PLAN.md` §5) is what actually restricts who may use the deployment. Without `ANYONE_WITH_GOOGLE_ACCOUNT`, the disposable account is rejected by the platform before the allow-list code ever runs.
- Side effect: any Google account on the planet can reach the URL. The private-beta rejection message is therefore the **first thing** any unauthorized visitor sees. There is no longer any platform-level protection — the allow-list is the only barrier.

### 3.4 Explicit `oauthScopes`

The planned starting array:

| Scope | Why declared |
|---|---|
| `https://www.googleapis.com/auth/spreadsheets` | Replaces the auto-inferred `spreadsheets.currentonly`. `currentonly` only works for bound execution. Web-app + `openById` requires the full `spreadsheets` scope. |
| `https://www.googleapis.com/auth/drive.file` | Lets the script create new files in the user's Drive and access only those files. Strictly narrower than `https://www.googleapis.com/auth/drive` (no access to the user's other Drive content). |
| `https://www.googleapis.com/auth/userinfo.email` | Read the calling user's email for identification, allow-list check, and mapping key. |
| `https://www.googleapis.com/auth/script.send_mail` | Already used by `planner_output.js → MailApp.sendEmail`. Declared so the consent text is explicit, not inferred. |
| `https://www.googleapis.com/auth/script.scriptapp` | Already used by `debounce_planner.js → ScriptApp.newTrigger` / `getProjectTriggers`. Declared so consent text is explicit. |
| `https://www.googleapis.com/auth/script.container.ui` | Used by spreadsheet-bound UI in `webapp.js` (`SpreadsheetApp.getUi().prompt/alert` in `setPlannerDashboardWebAppUrl` / `clearPlannerDashboardWebAppUrl` / `openPlannerDashboardWebLauncher`). Web-app `doGet` does not require it, but the bound editor flows do, and the central deployment is the **same project**, so all scopes the project's code references must appear in the manifest or the project will fail to authorize on the bound side. |

**Explicitly excluded scopes** (must not appear):
- `https://www.googleapis.com/auth/drive` (full Drive — too broad; the consent screen reads "See, edit, create, and delete **all** your Google Drive files"). Reason: §4.5.
- `https://www.googleapis.com/auth/drive.readonly` (not needed; we never read non-CashCompass files).
- `https://www.googleapis.com/auth/drive.metadata` (not needed).
- `https://www.googleapis.com/auth/script.external_request` (not needed; no `UrlFetchApp`). If a future scope-expansion adds `UrlFetchApp`, that is a separate review.
- `https://mail.google.com/` (full Gmail — not needed; we only use `MailApp.sendEmail`).
- `https://www.googleapis.com/auth/userinfo.profile` (not needed; email is sufficient identity).

### 3.5 Drive Advanced Service enablement

- Add to `appsscript.json` under `dependencies.enabledAdvancedServices`:
  ```json
  { "userSymbol": "Drive", "serviceId": "drive", "version": "v3" }
  ```
- This is the v3 Drive Advanced Service. Once added, `Drive.Files.create(...)` and `Drive.Files.update(...)` become callable.
- The Drive API itself must **also** be enabled in the linked Google Cloud project. Apps Script prompts this automatically on the first call after the manifest is updated (a one-time per-project click-through in the GCP console). This must happen **before** the first disposable-account test, because the prompt is interactive and cannot be satisfied mid-request.
- This preparation slice does **not** call `Drive.Files.create`. The advanced service is enabled here so the resolver-slice implementation prompt does not have to flip the manifest a second time.

### 3.6 Separate-deployment strategy

The central-mode flip happens on a **new dedicated web-app deployment**. The existing developer-bound deployment is **untouched**.

- New deployment name: `CashCompass — Central Beta (Slice 1)`.
- New deployment URL: distinct `/exec` from any prior deployment.
- The new deployment is created with the central-mode manifest values (`USER_ACCESSING`, `ANYONE_WITH_GOOGLE_ACCOUNT`, explicit scopes, Drive v3) at deploy time. The manifest changes in `appsscript.json` apply to **all** deployments of the project from this version forward; the existing deployment must be evaluated as well (§6.2).
- The existing bound launcher (`openPlannerDashboardWebLauncher` via `PLANNER_DASHBOARD_WEBAPP_URL`) continues to point at whichever URL the developer last stored — almost certainly the existing dev deployment. Switching the launcher to the central URL is a later (developer-choice) action; it does not happen in this preparation slice.
- Rationale: a new deployment lets the central slice be reverted by archiving it without touching the bound deployment, isolates the OAuth grant to a single URL (one consent dance to revoke), and lets developer dogfooding alternate between the two URLs during validation.

### 3.7 Deployment posture summary

| Field | Current (bound) | After this slice (central) |
|---|---|---|
| `executeAs` | `USER_DEPLOYING` | `USER_ACCESSING` |
| `access` | `MYSELF` | `ANYONE_WITH_GOOGLE_ACCOUNT` |
| `oauthScopes` | auto-detected | **explicit array (§3.4)** |
| `dependencies.enabledAdvancedServices` | `[]` / absent | `[{Drive v3}]` |
| Deployment | existing only | **new dedicated** (existing unchanged) |
| GCP project Drive API | not required | **enabled** (one-time consent) |
| App-layer gate | none (platform `MYSELF`) | **allow-list** (added in resolver slice — not here) |
| Code change | none | **none in this slice** |

---

## 4. Scope analysis

Per-scope justification, narrowing strategy, and "why not a wider scope" reasoning. This is the most reviewable part of the doc because scope text leaks into the consent screen verbatim.

### 4.1 `https://www.googleapis.com/auth/spreadsheets`

- **Consent text (typical):** "See, edit, create, and delete all your Google Sheets spreadsheets."
- **Why declared:** the central resolver calls `SpreadsheetApp.openById(spreadsheetId)` against a workbook the user owns. `spreadsheets.currentonly` only works for the bound active spreadsheet; web-app `openById` requires `spreadsheets`.
- **Narrowest sufficient:** there is no narrower Sheets scope that supports `openById` against an arbitrary user-owned file. `spreadsheets` is the floor.
- **Mitigation:** the script can only open spreadsheets the user has access to (which, for this slice, is the workbook the script just created in their Drive). The consent text is broad, but the effective access is bounded by the user's own Drive permissions.

### 4.2 `https://www.googleapis.com/auth/drive.file`

- **Consent text (typical):** "See, edit, create, and delete only the specific Google Drive files you use with this app."
- **Why declared:** required so `Drive.Files.create(...)` can create a new file in the user's Drive, and so subsequent `Drive.Files.*` operations (rename, trash) work on files the app created.
- **Narrowest sufficient:** `drive.file` is the narrowest Drive scope that supports file creation under the calling user's identity. It explicitly does **not** grant access to files the app did not create.
- **Why this over `drive`:** see §4.5.

### 4.3 `https://www.googleapis.com/auth/userinfo.email`

- **Consent text (typical):** "See your primary Google Account email address."
- **Why declared:** the resolver, allow-list, and mapping key all depend on `Session.getEffectiveUser().getEmail()` returning the calling user's email. Without this scope the call returns an empty string under `USER_ACCESSING` for non-domain users.
- **Narrowest sufficient:** there is no narrower scope. `userinfo.profile` would add name/photo access that we do not want. `openid` alone does not return an email claim usable from `Session`.

### 4.4 Existing auto-detected scopes (declared so consent text is explicit)

These three are not new — they are already inferred by Apps Script for the current bound deployment. Declaring them explicitly does not expand authorization; it just removes inference from the consent-screen render path.

- **`https://www.googleapis.com/auth/script.send_mail`** — `MailApp.sendEmail` in `planner_output.js`. Consent text: "Send email as you." Note: this sends mail **as the calling user** under `USER_ACCESSING`, not as the developer. This is a meaningful change from the current `USER_DEPLOYING` posture, where planner emails are sent from the developer's account. **Runtime verification item:** observe whether the disposable account's planner-output email is sent from the disposable account's address (expected) or fails because the disposable account has no Gmail enabled. Document the result.
- **`https://www.googleapis.com/auth/script.scriptapp`** — `ScriptApp.newTrigger` / `getProjectTriggers` in `debounce_planner.js`. Consent text: "Allow this application to run when you are not present." Required for the debounce trigger machinery. Under `USER_ACCESSING`, the trigger is owned by the calling user, not the developer — this changes the quota and execution-attribution model for triggers (see §6.5).
- **`https://www.googleapis.com/auth/script.container.ui`** — `SpreadsheetApp.getUi().prompt/alert` in `webapp.js`. Consent text: "Display and run third-party web content in prompts and sidebars inside Google applications." Only triggers in the spreadsheet-bound editor flow (`setPlannerDashboardWebAppUrl` etc.), never in the web-app `doGet`. The disposable account will not exercise this scope unless they also open the spreadsheet in the Sheets editor and run the menu — which they should not do in the first-slice runtime test.

### 4.5 Why full Drive scope is intentionally avoided

The contrast that drives the choice:

| Scope | Consent text (paraphrased) | What the user signs up for |
|---|---|---|
| `auth/drive` | "See, edit, create, and **delete all your Drive files**." | Unbounded access to every file the user owns or has been shared, forever, until revoked. |
| `auth/drive.file` | "See, edit, create, and delete **only the files you use with this app**." | Access bounded to files the app itself creates (and any the user explicitly opens via the Drive picker, which we do not implement). |

`drive.file` is sufficient for the first slice because:

1. The script only ever needs to create one file per user (`Drive.Files.create`) and operate on it (`openById`, `Drive.Files.update` for rename, `setTrashed` for partial-failure cleanup). All these operations are permitted under `drive.file` on files the app created.
2. The script never needs to read or write any other Drive content — no folder traversal, no search, no shared-with-me access, no template lookup (per `CENTRAL_APP_WORKBOOK_CREATION_FIRST_SLICE_PLAN.md` §9.1, "no template copy").
3. The privacy story is meaningfully stronger under `drive.file`: the user can read the consent screen, see "only the files you use with this app," and verify in their Drive that exactly one new file appeared. The trust pitch from `CENTRAL_APP_DEPLOYMENT_OPTIONS.md` §3 ("your data lives in your Drive") survives review.
4. If a later slice ever requires broader Drive access (e.g., placing the workbook in a `CashCompass` folder that the script also creates), the scope expansion forces every user to re-consent, which is a deliberate user-visible event and the correct moment to also update the privacy policy.

`drive` is rejected outright. `drive.metadata` and `drive.readonly` are unnecessary and would also widen the consent text. There is no middle ground we want.

### 4.6 Scope reconciliation step (runtime verification)

Before the manifest is flipped, the developer must:

1. Open the Apps Script editor → Project Settings → Scopes.
2. Capture the current auto-detected scope list (the list Apps Script computed from the existing codebase).
3. Diff that list against §3.4. For each scope:
   - In auto-detected but not in §3.4: add to §3.4 unless there is an explicit reason to drop the underlying code (which would be a separate slice).
   - In §3.4 but not auto-detected: keep — these are forward-looking for the resolver slice (`drive.file`, possibly `userinfo.email` if not inferred).
4. Commit the reconciled §3.4 array back into this document **before** updating `appsscript.json`.

The reconciliation step is the single hard runtime-verification gate in this slice. It cannot be done from documentation alone.

---

## 5. Consent-screen expectations

What the developer should expect to see, in what order, on which account, after the manifest flip.

### 5.1 Developer's primary account, first hit on the new deployment URL

1. Browser opens the `/exec` URL.
2. If the developer is not currently signed in to Google: Google sign-in prompt.
3. **Consent screen renders with the full §3.4 scope list.** Even though the developer authored the script, switching to `USER_ACCESSING` + new explicit scopes triggers re-consent — the existing OAuth grant on the developer's account is for the **old** scope set under the **old** deployment, not this one.
4. Developer accepts. Page loads.

Expected: clean consent flow, no errors, no missing scopes.

### 5.2 Developer's primary account, hitting the existing (bound) deployment

- Should be unaffected at runtime — same URL, same execution context.
- **Caveat:** because the manifest now declares explicit scopes that include scopes the bound deployment was previously running implicitly (`script.container.ui`, `script.send_mail`, `script.scriptapp`), the developer **may** see a re-consent prompt the next time they hit the bound deployment. This is one-time and benign as long as the scope set is a superset of the old auto-detected set.
- **Runtime verification item:** observe whether the bound deployment re-consents, and that it succeeds without scope errors.

### 5.3 Disposable second account, first hit on the new deployment URL

1. Browser opens the `/exec` URL in a fresh browser profile / incognito window with the disposable account already signed in.
2. Google interstitial: "CashCompass wants access to your Google Account."
3. The consent body lists exactly the §3.4 scopes, in human-readable form (paraphrased in §4.4).
4. Either:
   - **Verified app:** standard consent flow.
   - **Unverified app:** Google's "This app isn't verified" interstitial appears with an "Advanced → Go to CashCompass (unsafe)" link. This is **expected** for a private-beta deployment that has never been through OAuth verification. The disposable account must explicitly click through.
5. Disposable account accepts. `doGet` runs. Because `CENTRAL_MODE` is `false` (default, set in the resolver slice — not here), the resolver returns whatever the deployment is bound to. **In this preparation slice, since there is no resolver change yet, `doGet` runs the existing `PlannerDashboardWeb` template against `SpreadsheetApp.getActiveSpreadsheet()` — which under `USER_ACCESSING` on a new deployment may return `null` or throw.**

Expected outcome in this preparation slice: the disposable account reaches `doGet`, consents to the listed scopes, and either:
- Sees a working (but bound-spreadsheet) dashboard if Apps Script's `getActiveSpreadsheet()` resolves to the developer-bound workbook even under `USER_ACCESSING` (possible — this is a documented quirk of bound web apps); **or**
- Sees an error from `SpreadsheetApp.getActiveSpreadsheet()` returning null because there is no "active" spreadsheet for a `USER_ACCESSING` web-app call against a workbook the calling user does not own.

**Either outcome is acceptable for this preparation slice** because we are only validating the platform layer. The resolver slice (next) replaces `getActiveSpreadsheet()` with the central-mode branch and removes any dependency on a bound spreadsheet for non-developer users. The error case (if it occurs) actually **proves** the new deployment is correctly running under the calling user's identity, which is what we want to validate here.

### 5.4 Re-consent behavior

- Any future change to `oauthScopes` forces every user (developer included) to re-consent on next request. This is a Google guarantee.
- Removing a scope from `oauthScopes` does **not** automatically revoke the existing grant — the user keeps the broader grant until they manually revoke at https://myaccount.google.com/permissions. The script may not call any API associated with the removed scope, but the residual grant is harmless.
- Adding a scope **does** force re-consent. This is the planned behavior the first time the disposable account hits the deployment, and is the reason §4.6 reconciliation must be done correctly the first time — scope thrash is user-visible.

### 5.5 Developer-account effects (summary)

| Where | Effect |
|---|---|
| Existing bound deployment (`access: MYSELF`) | One-time re-consent on next hit (additive scopes). Then normal operation. |
| New central deployment (`access: ANYONE_WITH_GOOGLE_ACCOUNT`) | Full consent flow on first hit (new URL, new grant). Then normal operation. |
| `openPlannerDashboardWebLauncher` from the bound spreadsheet editor | Continues to open the URL stored in `PLANNER_DASHBOARD_WEBAPP_URL` (probably the dev deployment). No automatic switch. |
| `MailApp.sendEmail` from `planner_output.js` | **Now sends as the developer** on the bound deployment (unchanged), but on the central deployment will send as **the calling user**. |

### 5.6 Disposable-account test expectations (summary)

| Step | Expectation |
|---|---|
| Open central URL in disposable account's incognito session | Sign-in prompt → consent prompt → "unverified app" interstitial (advanced click-through) → consent accepted |
| Consent screen scope list | Exactly the §3.4 scopes (post-reconciliation), no more, no less |
| After consent | `doGet` runs under the disposable account's identity; either a (bound-spreadsheet) dashboard renders, or an error visibly attributable to "no active spreadsheet for this user" — **both are acceptable in this preparation slice** |
| Disposable account's Drive | **No new file should be created in this slice** (no `Drive.Files.create` call exists yet). If a new file appears, that is a bug. |
| Disposable account's script properties | **No script property should be written** (no code path writes properties from `doGet` today). |
| Developer's bound spreadsheet | **Untouched.** No new sheet, no new row, no data change. |

The test in this preparation slice is intentionally minimal: it validates that the platform accepts the new manifest and that the consent screen says the right thing. It does **not** validate provisioning, mapping, or onboarding — those are the resolver slice's tests (`CENTRAL_APP_WORKBOOK_CREATION_FIRST_SLICE_PLAN.md` §11).

---

## 6. Risk analysis

The platform-layer failure modes this slice intentionally surfaces in isolation. Each risk has a detection signal, a mitigation, and a rollback step.

### 6.1 Unexpected scope expansion

- **Risk:** the editor's auto-detected scope list includes a scope §3.4 did not declare (e.g., `script.external_request` because some module added a `UrlFetchApp` call we did not catch, or `drive` because a stray `DriveApp` reference exists somewhere).
- **Detection:** §4.6 reconciliation step before flip; if not caught there, the consent screen on first run renders broader text than §4.4 expects.
- **Mitigation:** if reconciliation finds an unexpected scope, **stop** and investigate the underlying code. Do not silently widen `oauthScopes` to match. If the code that triggers the scope is dead, remove it in a separate commit. If the code is live, add the scope to §3.4 with a written explanation in this doc before flipping.
- **Rollback:** if the consent screen renders broader-than-expected text after flip, the user can decline consent and the developer reverts `appsscript.json` (§7).

### 6.2 Deployment contamination (manifest changes affect bound deployment too)

- **Risk:** the manifest is a project-wide artifact. Flipping `executeAs` / `access` in `appsscript.json` and saving creates a new version. Subsequent **redeploys** of the bound deployment will pick up the new manifest unless explicitly pinned to a prior version.
- **Detection:** check the bound deployment's "Version" in the Deployments dialog after the manifest change; confirm it is still pinned to a pre-flip version, not auto-bumped.
- **Mitigation:** **do not redeploy the existing bound deployment** as part of this slice. Use "Manage Deployments → New deployment" for the central deployment so the bound deployment's version remains pinned to its current version.
- **Rollback:** if the bound deployment accidentally picks up the new manifest, redeploy it back to its prior version from the version history (Apps Script keeps every prior version, accessible via "Manage Deployments → Version → select older version").

### 6.3 Drive permission surprises

- **Risk 1:** `drive.file` is narrower than expected — e.g., `SpreadsheetApp.openById` on a file the script previously created fails because the file's `appProperties` flag (set by Drive automatically) was lost when the file was renamed by the user.
- **Detection:** later, in the resolver slice's runtime test (§11 of the first-slice plan), the "open existing workbook next day" step.
- **Mitigation:** if discovered, do **not** widen scope to `drive`. Instead, document the failure and decide whether to switch to `spreadsheets` + explicit ID storage (which sidesteps Drive scope entirely for the open path) or to add a small recovery flow.
- **Risk 2:** the linked GCP project's Drive API was never enabled, so the first `Drive.Files.create` throws "Drive API has not been used in project ..." with a console URL. This is non-fatal — the developer clicks the URL once, enables the API, and retries — but it is a runtime-only confirmable item.
- **Detection:** first call to `Drive.Files.create` after the resolver slice ships.
- **Mitigation:** enable the GCP Drive API as part of this preparation slice's runtime test, **even though no call to `Drive.Files.create` is made here**. The advanced-service-enable click-through prompts the GCP API enable. Do it now so the resolver slice does not encounter it.
- **Rollback:** disabling the GCP Drive API is reversible (re-enable button in console). No data loss.

### 6.4 Apps Script auth quirks

- **Risk:** under `USER_ACCESSING` with `access: ANYONE_WITH_GOOGLE_ACCOUNT`, `Session.getActiveUser().getEmail()` returns an empty string for accounts outside the script owner's Workspace domain — only `Session.getEffectiveUser().getEmail()` is reliable (and only with the `userinfo.email` scope).
- **Detection:** the resolver slice depends on `getEffectiveUser`, not `getActiveUser`. This preparation slice doesn't read user identity at all. The risk surfaces only in the resolver slice.
- **Mitigation:** the first-slice plan already pins `getCurrentUserEmail_()` to use `Session.getEffectiveUser().getEmail()`. Reaffirmed here.
- **Related quirk:** Apps Script web apps cache the OAuth grant per `(account, deployment URL)` tuple. If the developer signs out / signs in, the grant persists. To force a clean re-consent for testing, revoke the grant at https://myaccount.google.com/permissions before re-testing.

### 6.5 Manifest mismatch (declared vs effective scopes)

- **Risk:** `oauthScopes` in the manifest is declared, but the editor's "Project Settings → Scopes" still shows a different list. Apps Script merges declared and auto-detected on save in some cases.
- **Detection:** after editing `appsscript.json`, re-open Project Settings → Scopes and confirm the displayed list matches §3.4. If extra scopes appear, the auto-detector added them — go back to §4.6 reconciliation.
- **Mitigation:** re-run reconciliation. Do not deploy until the displayed list is exactly the declared list.

### 6.6 Trigger / quota attribution change

- **Risk:** under `USER_ACCESSING`, triggers installed by `ScriptApp.newTrigger` are owned by the calling user, not the developer. The disposable account's quota for time-driven triggers (20/user/script/day) is now the relevant quota. Same for `MailApp.sendEmail` (the calling user's daily mail quota — 100/day for consumer accounts, 1500/day for Workspace).
- **Detection:** this slice does not exercise triggers or planner email. The resolver slice does not change trigger behavior either — triggers continue to be installed by whoever invokes the debounce path. The risk surfaces only when a non-developer user hits a trigger-installing code path.
- **Mitigation:** out of scope for this slice. The resolver slice should not install triggers in the bootstrap. Trigger behavior under `USER_ACCESSING` is a known-and-deferred consideration documented in `CENTRAL_APP_DEPLOYMENT_OPTIONS.md` §3.
- **Rollback:** N/A for this slice.

### 6.7 Rollout / rollback timing

- **Risk:** the manifest change is committed but the new deployment is not yet created. Anyone hitting the existing (bound) deployment now sees a re-consent prompt (additive scopes) but might be confused by the wording.
- **Detection:** developer dogfooding immediately after commit.
- **Mitigation:** make the manifest commit and the new-deployment creation a single linear sequence. Do not commit the manifest if the deployment dialog will be closed before creating the central deployment.
- **Rollback:** revert the manifest commit; the bound deployment's existing version is unaffected (deployments are pinned to versions, not to the head manifest).

### 6.8 Unverified-app interstitial

- **Risk:** the disposable account sees Google's "This app isn't verified" warning before consent, which is frightening UX for a real user and could cause the account to bail.
- **Detection:** known and expected for any non-Workspace, unverified app. Always shows for the second account.
- **Mitigation:** for the first slice (family beta, two accounts, both controlled by the developer), the developer accepts the interstitial knowingly. OAuth verification is deferred to a later slice (`CENTRAL_APP_DEPLOYMENT_OPTIONS.md` cross-reference) and is a multi-week process with Google.
- **Rollback:** N/A — the interstitial is a Google-imposed UX element; the only way to remove it is OAuth verification.

### 6.9 Drive file appears in unexpected location

- **Risk:** even though this slice does **not** call `Drive.Files.create`, enabling the Drive Advanced Service may trigger a `My Drive → Apps Script` folder or similar metadata in the GCP project. Verify no surprise files appear.
- **Detection:** check the disposable account's Drive after consent (before any resolver slice runs). Expect zero new files.
- **Mitigation:** if any file appears, it is a platform-side effect of consent and is acceptable. If a CashCompass-named file appears without any `Drive.Files.create` call, that is a bug — investigate before continuing.

### 6.10 Risk summary table

| ID | Risk | Severity | Detection | Mitigation | Rollback |
|---|---|---|---|---|---|
| 6.1 | Unexpected scope expansion | High | §4.6 reconciliation | Investigate code; do not widen silently | Revert manifest |
| 6.2 | Bound deployment contamination | High | Deployment version check | Do not redeploy bound; pin version | Restore prior version |
| 6.3 | Drive permission surprise | Medium | Resolver-slice test | Document; consider scope shift to `spreadsheets`-only | N/A here; resolver-slice concern |
| 6.4 | `getActiveUser` empty | Low | Resolver-slice test | Already mitigated by using `getEffectiveUser` | N/A |
| 6.5 | Manifest vs editor mismatch | Medium | Re-open Project Settings → Scopes | Re-reconcile | Edit manifest until match |
| 6.6 | Trigger / mail quota change | Low (deferred) | Resolver-slice / later | Do not install triggers in bootstrap | N/A here |
| 6.7 | Rollout timing | Low | Dogfooding | Commit + deploy as one sequence | Revert manifest commit |
| 6.8 | Unverified-app interstitial | Low | First disposable test | Accept; defer OAuth verification | N/A |
| 6.9 | Surprise Drive file | Low | Disposable-account Drive check | Investigate before resolver slice | Trash unexpected files |

---

## 7. Rollback plan

The exact ordered steps to undo this preparation slice if anything in §6 fires. Each step is independently survivable.

### 7.1 Revert deployment posture (immediate)

1. Apps Script editor → Manage Deployments → select `CashCompass — Central Beta (Slice 1)` → **Archive**. The URL stops responding (returns Apps Script's standard "this deployment is archived" page).
2. The existing bound deployment is unaffected by archive (different deployment, different URL).
3. No code touched. No data touched.

### 7.2 Disable central mode safely

- **This slice does not introduce a `CENTRAL_MODE` flag** — the flag is introduced in the resolver slice. There is no central-mode code path to disable in this preparation slice.
- The functional equivalent here is "archive the central deployment" (§7.1) — without the deployment URL, no one can exercise the central-mode posture.
- Once the resolver slice ships, the flag flip from §4 of the first-slice plan becomes available as a finer-grained disable lever.

### 7.3 Archive bad deployments

1. Apps Script editor → Manage Deployments → select the deployment to archive → Archive.
2. Archived deployments retain their version history; they can be un-archived if needed.
3. If the central deployment was created with a wrong manifest version, archive it and create a fresh one pinned to the correct version — do not edit-in-place.

### 7.4 Revert manifest

1. `git revert <commit-hash-of-manifest-change>` on `main`.
2. The reverted manifest restores `executeAs: USER_DEPLOYING`, `access: MYSELF`, no `oauthScopes` block, no `dependencies` block.
3. Re-deploying the bound deployment from the reverted manifest restores the original behavior.
4. **Do not delete** the central deployment's URL from anywhere just because the manifest reverted — the deployment is its own artifact and is archived separately (§7.1 / §7.3). Two reversions, two artifacts, two steps. This is deliberate.

### 7.5 Disable Drive Advanced Service / GCP API

- Removing the `enabledAdvancedServices` entry from `appsscript.json` disables `Drive.*` calls at the script level.
- Disabling the Drive API in the linked GCP console is **reversible** but should not be done casually — the toggle is in the GCP console under APIs & Services → Library → Drive API → Disable.
- For rollback purposes, leaving the GCP Drive API enabled even after manifest revert is fine — it costs nothing and removes a step from the next re-attempt.

### 7.6 Preserve user-owned workbooks

- **No workbooks exist for any non-developer user as of this slice.** No `Drive.Files.create` call has run; the disposable account's Drive contains zero CashCompass artifacts.
- Therefore, "preserve user-owned workbooks" in this slice means: **do not** add any code or workflow that creates files in the disposable account's Drive during this slice. The preservation policy is fully covered by the absence of provisioning code.
- The policy becomes load-bearing in the resolver slice and is pinned in `CENTRAL_APP_WORKBOOK_CREATION_FIRST_SLICE_PLAN.md` §10.4 / §10.5.

### 7.7 Rollback timing

The cleanest rollback sequence, if a fatal issue is found during the §8 test:

1. **Archive the central deployment.** (Stops further access. ~5 seconds.)
2. **Revoke OAuth grants** on any account that consented during the test: https://myaccount.google.com/permissions on each account → CashCompass → Remove access. (Optional but tidy. ~30 seconds per account.)
3. **Revert the manifest commit.** (~10 seconds.)
4. **Confirm bound deployment unaffected** by hitting its URL from the developer's primary account. (~10 seconds.)
5. **Document the failure** in `SESSION_NOTES.md` so the next attempt knows what to avoid. (Time-bounded by the issue.)

Total rollback time for a healthy failure: under 2 minutes. This is intentional and is one of the reasons this preparation slice exists as its own artifact.

---

## 8. Disposable-account test protocol

The minimal runtime test that closes this preparation slice. Performed exactly once by the developer immediately after creating the central deployment.

### 8.1 Prerequisites

- Disposable second Google account exists and has been used at least once (a non-zero-day account so Google's "new account" friction is past).
- A clean browser profile (Chrome profile, Firefox container, or incognito window) signed in only to the disposable account. Do **not** test in a browser session that is also signed in to the developer account, because Apps Script picks the first signed-in account and the test result becomes ambiguous.
- The developer has just:
  - Committed the manifest changes from §3.1 to `main`.
  - Pushed via `clasp push` so the editor reflects the manifest.
  - Created a fresh deployment named `CashCompass — Central Beta (Slice 1)` with the new manifest values.
  - Recorded the new deployment's `/exec` URL.

### 8.2 Clean-browser requirement (explicit)

- Open a fresh incognito window (or a dedicated Chrome profile) before each test attempt.
- Sign in to **only** the disposable account in that window.
- Do **not** import bookmarks, passwords, or session state from the developer profile.
- Reason: Apps Script's OAuth grant cache is keyed on `(account, deployment URL)`. Cross-contamination from a developer session can mask the disposable account's first-consent behavior.

### 8.3 Test steps

| # | Step | Acceptance criterion |
|---|---|---|
| 1 | In the developer's primary account, open Apps Script editor → Project Settings → Scopes. | The displayed scope list **exactly matches** §3.4 (post-reconciliation). No extras, no omissions. |
| 2 | In the developer's primary account, open the **central deployment URL** (`/exec`). | Re-consent prompt appears (because scopes are now explicit). Consent screen lists exactly §3.4. Accept. Page loads (some valid HTML response, may or may not be the full dashboard depending on bound-spreadsheet quirk — both outcomes pass for this slice). |
| 3 | In the developer's primary account, open the **existing bound deployment URL**. | Either (a) loads normally, or (b) shows a one-time additive re-consent for the now-explicit existing scopes, then loads normally. **No error.** |
| 4 | In the developer's primary account, open the bound spreadsheet directly in Sheets. | Spreadsheet opens normally. Custom menu (if any) loads. No new sheets appear. No data is altered. |
| 5 | Open a fresh incognito window, sign in to the disposable account, navigate to the central deployment URL. | Google sign-in (if needed), then "This app isn't verified" interstitial. Click `Advanced → Go to CashCompass (unsafe)`. |
| 6 | On the consent screen. | Scope list shown to the disposable account **exactly matches** §3.4. Accept. |
| 7 | After consent, observe what renders. | `doGet` runs. Either the bound-spreadsheet dashboard renders (acceptable quirk), or an error/blank page renders attributable to no-active-spreadsheet under `USER_ACCESSING` (also acceptable — proves the user identity flipped). **Either is PASS for this slice.** A redirect to the developer's Drive, a Drive-permission error, or any reference to the developer's email in the page output is **FAIL**. |
| 8 | Check the disposable account's Drive. | **Zero new files.** No `CashCompass — …` spreadsheet, no `Apps Script` folder with project content, no shared file. |
| 9 | Check the disposable account's `https://myaccount.google.com/permissions`. | An entry for the CashCompass app exists, listing exactly §3.4 scopes. |
| 10 | Apps Script editor → Project Settings → Script Properties. | No new property has been written by this test. (Verify against the property list captured before the test.) |
| 11 | Apps Script editor → Executions tab. | Executions from the test runs are visible. Each entry's "User" column shows the **calling user's email** (developer for steps 2/3, disposable for steps 5/6/7). This proves `USER_ACCESSING` is in effect. |
| 12 | Open the GCP console for the linked project → APIs & Services → Enabled APIs. | Google Drive API is **enabled** (one-time enable was triggered by adding the Drive advanced service). |

### 8.4 Expected workbook ownership result

- **Zero workbooks should be owned by the disposable account as a result of this test.**
- **Zero workbooks should be owned by the developer as a result of this test** (no new workbooks; existing bound workbook untouched).
- If a workbook appears in either account's Drive, it is a bug — the resolver code that would create one does not exist in this slice. Stop and investigate before proceeding to the resolver slice.

### 8.5 Pass / fail criteria

- **PASS:** all 12 rows in §8.3 succeed. Specifically: §3.4 scopes match exactly; no surprise Drive files; no surprise script properties; executions tab attributes the disposable's runs to the disposable account; GCP Drive API enabled.
- **PARTIAL:** one cosmetic failure (e.g., consent text wording is awkward but lists the right scopes; bound deployment re-consents on a scope the developer wants to investigate). Documented as a known issue; slice still proceeds, with the issue logged in `SESSION_NOTES.md`.
- **FAIL:** any of:
  - The consent screen lists a scope not in §3.4 (e.g., `drive` instead of `drive.file`, or `script.external_request` appears unexpectedly).
  - A new file appears in either account's Drive.
  - The Executions tab shows the disposable account's runs attributed to the developer's email (proves `USER_ACCESSING` did not take effect).
  - The bound deployment breaks under any code path.
  - GCP Drive API enablement requires multiple manual interventions or fails to enable.
- A FAIL triggers immediate rollback per §7.7. Do not proceed to the resolver slice until the platform layer is clean.

---

## 9. Explicit implementation separation

The hard rule that makes this whole plan worth doing.

- **No resolver provisioning code may be written until this deployment / auth layer is reviewed and observed to pass §8.**
- Deployment/auth validation (this slice) and resolver provisioning (next slice) are **separate implementation phases**, with separate commits, separate runtime tests, and separate rollbacks.
- The implementation prompt for **this** slice produces a diff containing **only** changes to `appsscript.json` and (optionally) a single SESSION_NOTES entry describing the deployment-dialog steps the developer performed. It produces **zero** changes to `*.js` files and **zero** changes to `*.html` files.
- The implementation prompt for the **resolver** slice (the one after this) produces changes to `central_resolver.js`, `webapp.js`, and possibly a small new file (e.g., `central_allowlist.js`). It must reference both this doc and `CENTRAL_APP_WORKBOOK_CREATION_FIRST_SLICE_PLAN.md` by name and commit hash, and must not run until §8 of this doc has passed.
- If the resolver-slice implementation prompt is run before §8 passes, the resolver-slice runtime test (`CENTRAL_APP_WORKBOOK_CREATION_FIRST_SLICE_PLAN.md` §11) will mix application-layer and platform-layer failures, making bisection harder. **This is the failure mode this whole document exists to prevent.**

---

## 10. Recommended next implementation slice

**Manifest + deployment preparation only.**

That is: an implementation prompt whose diff contains, at most:

1. The full `appsscript.json` replacement per §3.1 (with the reconciled scope list per §4.6).
2. A `SESSION_NOTES.md` entry describing:
   - The reconciliation result (auto-detected scopes diffed against §3.4, with any deltas explained).
   - The new deployment's name, URL, and the date created.
   - The result of running §8 (PASS / PARTIAL / FAIL with details).
   - Any one-time GCP console click-through performed (Drive API enablement).

And then **stops**.

The implementation prompt for resolver provisioning logic — the §6 function inventory from `CENTRAL_APP_WORKBOOK_CREATION_FIRST_SLICE_PLAN.md`, the §7 provisioning flow, the §8 lock semantics, the allow-list gate — is the **next** prompt after this one, with its own review gate, its own runtime test, and its own rollback.

Two slices. Two commits. Two test runs. Two independent rollbacks. One clean bisection if either fails.

---

## 11. Sign-off

This is the deployment/auth preparation layer. It exists between `CENTRAL_APP_WORKBOOK_CREATION_FIRST_SLICE_PLAN.md` (which assumed the platform layer was a single atomic step) and the first implementation prompt (which will now touch only the platform layer).

The next artifact after this one is an implementation prompt scoped to `appsscript.json` and the deployment dialog. The artifact after that is a runtime test report. The artifact after that is the resolver-slice implementation prompt.

End of document.
