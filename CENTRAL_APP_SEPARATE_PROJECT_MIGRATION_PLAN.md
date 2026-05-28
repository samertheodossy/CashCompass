# CENTRAL_APP_SEPARATE_PROJECT_MIGRATION_PLAN.md

Long-term architecture plan for separating the CashCompass bound/dev workflow from the Central App multi-user web application into two independent Apps Script projects.

**Documentation/planning only.** No Apps Script code change. No HTML change. No `appsscript.json` change. No deployment change. No implementation. This document gates the *decision* to proceed with a two-project architecture and defines every setup, migration, and operation detail required before any project-creation steps begin.

Cross-references:
- `CENTRAL_APP_DESIGN.md` — resolver seam concept and §9 guardrails.
- `CENTRAL_APP_DEPLOYMENT_OPTIONS.md` — deployment/auth posture analysis (Option B: `USER_ACCESSING` + per-user Drive workbooks).
- `CENTRAL_APP_DEPLOYMENT_PREPARATION_PLAN.md` — manifest/scope/access decisions, corrected `ANYONE` enum, Drive API enablement.
- `CENTRAL_APP_RESOLVER_PROVISIONING_IMPLEMENTATION_PROMPT.md` — provisioning code inventory (shipped in `d952dfa`).
- `CENTRAL_APP_WORKBOOK_CREATION_FIRST_SLICE_PLAN.md → §15` — runtime evidence from the first central-mode provisioning proof.
- `CENTRAL_APP_DOC_INDEX.md` — documentation set classification (the six-bucket taxonomy).
- `central_resolver.js` — the `getUserSpreadsheet_()` seam that will simplify to "always central" in the new project.
- `central_provisioning.js` — provisioning logic that moves wholesale to the new project.

---

## 1. Purpose — why a separate project is the correct long-term architecture

The central-mode experiment ran inside the existing bound Apps Script project. It demonstrated technical feasibility: `getUserSpreadsheet_()` routes correctly, provisioning creates user-owned workbooks, mapping persists, the allow-list gate works. But the experiment also exposed a structural problem that cannot be solved from within a single shared project.

### 1.1 The project-wide state problem

Apps Script has exactly one instance of each of the following per project, regardless of how many deployments exist:

| Resource | Scope | Consequence |
|---|---|---|
| Script properties (`PropertiesService.getScriptProperties()`) | Project-wide | `CENTRAL_MODE=true` affects every deployment simultaneously |
| `appsscript.json` manifest | Project-wide | `executeAs`, `access`, `oauthScopes`, `enabledAdvancedServices` all apply to every deployment that pins the current version |
| OAuth grant per user-account | Per `(account, deployment URL)` pair | Different URLs = different grants, but the *project* defines what scopes are available |
| GCP linked project | Project-wide | Drive API enablement, Cloud Logging, quota tracking, OAuth client ID are all shared |
| Execution quota | Per Google account across the project | Triggers, service calls, and web-app requests all draw from the same pool |

Today's manifest (`executeAs: USER_ACCESSING`, `access: ANYONE`, explicit `oauthScopes`, Drive Advanced Service v3) already affects the bound/dev deployment because it is the project-wide manifest. Any user who opens the developer's bound deployment URL is now subject to the "anyone with a Google account" posture and the full `USER_ACCESSING` consent screen — which is not what the bound deployment was designed for.

### 1.2 What "separation" solves

A dedicated Central App project permanently eliminates every cross-contamination vector:

| Problem today | Resolution in separate project |
|---|---|
| `CENTRAL_MODE` flag hijacks all deployments when toggled `true` | Flag is eliminated entirely — the central project *always* runs central mode |
| Bound `appsscript.json` must carry central manifest (wrong scopes, wrong `access`) | Each project has its own `appsscript.json`; bound project reverts to `USER_DEPLOYING` + `access: MYSELF` |
| Script properties (allow-list, mapping) exist in the same store accessed by bound-mode code | Central project has its own property store; no overlap |
| Deployment URL matching heuristics required to distinguish bound from central at runtime | Irrelevant — the projects are physically separate |
| GCP quota and OAuth client ID shared between dev workflow and beta users | Each project has its own GCP project option (or at minimum its own OAuth client) |

### 1.3 The flag was always a shim, not a design

`CENTRAL_MODE` was introduced as a controlled-experiment switch: "let's test central routing inside the existing project before committing to a full separation." That experiment has now produced sufficient evidence — provisioning works, mapping works, `USER_ACCESSING` works, allow-list works. The shim has served its purpose. The correct next step is to operationalize the knowledge, not to harden the shim.

---

## 2. Current state

### 2.1 Bound project baseline

- **Script type:** Bound to the developer's personal CashCompass spreadsheet.
- **Deployment URL:** One or more `/exec` URLs stored in `PLANNER_DASHBOARD_WEBAPP_URL` script property; opened via `openPlannerDashboardWebLauncher()`.
- **Manifest (current `appsscript.json`):**
  ```json
  {
    "executeAs": "USER_ACCESSING",
    "access": "ANYONE",
    "oauthScopes": ["...six scopes..."],
    "dependencies": { "enabledAdvancedServices": [{"Drive", "drive", "v3"}] }
  }
  ```
  This is **already the central-mode manifest**, applied project-wide because the manifest was changed in the shared project to support the central beta deployment. The bound workflow now operates under a manifest intended for multi-user central mode — which is wrong for a personal dev tool.
- **Source files:** 37 `.js` files + 30 `.html` files + 1 `appsscript.json`. All live in a single flat directory at the repo root.
- **CENTRAL_MODE script property:** Currently `false` (reset after regression testing). The central beta deployment is paused.
- **Central-mode provisioning:** Shipped in commit `d952dfa`. Code is in `central_provisioning.js` and `central_resolver.js`. Runtime-confirmed for the developer's account. Second-user routing is still under investigation/iteration.
- **Startup routing fixes:** An uncommitted set of changes to `sheet_bootstrap.js`, `dashboard_data.js`, `config.js`, `onboarding.js`, `profile.js`, `house_values.js` that routes all startup RPCs through `getUserSpreadsheet_()` with a central-mode-aware blank formula. These are presently in the working tree but not committed.

### 2.2 Known risks of continuing in the shared project

1. **Every `CENTRAL_MODE` toggle is a production risk.** Setting `CENTRAL_MODE=true` for central testing immediately routes the developer's bound workflow into the central provisioning path. There is no safe way to have `CENTRAL_MODE=true` and simultaneously use the bound development workflow.
2. **The manifest is already wrong for the bound deployment.** `access: ANYONE` means any Google-account holder can reach the bound deployment URL. The old `access: MYSELF` barrier is gone project-wide.
3. **Startup routing fix cannot be safely committed.** The uncommitted fixes in the working tree are designed for `USER_ACCESSING` behavior. Committing them while the bound deployment runs under `USER_DEPLOYING` context causes undefined behavior on the bound path.
4. **Script property namespace collision.** The allow-list, mapping keys, and `CENTRAL_MODE` all live in the same property store as every other developer tool (e.g., `PLANNER_DASHBOARD_WEBAPP_URL`, debounce trigger IDs). One property write error in central code could corrupt bound-mode configuration.

---

## 3. Target architecture

### 3.1 Two-project model

```
┌─────────────────────────────────────────────────┐
│  BOUND PROJECT (unchanged from original design)  │
│                                                  │
│  Bound to: developer's personal CashCompass SS   │
│  executeAs: USER_DEPLOYING                       │
│  access: MYSELF                                  │
│  No oauthScopes block (auto-detect)              │
│  No Drive Advanced Service                       │
│  No CENTRAL_MODE flag                            │
│  No allow-list, no mapping keys                  │
│                                                  │
│  getUserSpreadsheet_() → getActiveSpreadsheet()  │
│  Always, unconditionally, forever                │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│  CENTRAL APP PROJECT (new, standalone)           │
│                                                  │
│  Not bound to any spreadsheet                    │
│  executeAs: USER_ACCESSING                       │
│  access: ANYONE                                  │
│  oauthScopes: explicit 6-scope array             │
│  Drive Advanced Service v3                       │
│  No CENTRAL_MODE flag (always central)           │
│  Script properties: allow-list, mapping only     │
│                                                  │
│  getUserSpreadsheet_() →                         │
│    getOrProvisionUserSpreadsheet_() always       │
└─────────────────────────────────────────────────┘
```

### 3.2 What this means for each project

**Bound project after separation:**
- The manifest reverts to its pre-central state: `executeAs: USER_DEPLOYING`, `access: MYSELF`, no explicit `oauthScopes`, no Drive Advanced Service.
- `central_resolver.js::getUserSpreadsheet_()` becomes a one-liner: `return SpreadsheetApp.getActiveSpreadsheet();` with no flag check.
- `isCentralModeEnabled_()` is eliminated entirely (no CENTRAL_MODE concept needed).
- `central_provisioning.js` is deleted from the bound project (or retained as a tombstone with a comment "moved to central project").
- The startup routing fix (currently uncommitted) is never committed to the bound project — it was always for the central path only.
- The bound project is stable, isolated, and exactly what it was before the central-mode experiment began.

**Central App project:**
- Standalone web app — not bound to any spreadsheet. `SpreadsheetApp.getActiveSpreadsheet()` is never called because there is no active spreadsheet in a standalone project.
- `getUserSpreadsheet_()` in `central_resolver.js` calls `getOrProvisionUserSpreadsheet_()` unconditionally. The `if (!isCentralModeEnabled_())` branch is removed — there is no bound fallback in this project.
- `isCentralModeEnabled_()` is eliminated — always "true" by project definition, not by flag.
- All startup RPCs (`getStartupRoutingFromDashboard`, `buildDashboardSnapshot_`, etc.) are committed with the `getUserSpreadsheet_()` replacements (the uncommitted working-tree changes) because in this project those replacements are always correct.
- The `CENTRAL_MODE_KEY_` constant in `central_provisioning.js` is removed. The property it references (`CENTRAL_MODE`) has no meaning in a project where central mode is a structural invariant.
- Script properties contain only: `FAMILY_BETA_ALLOWLIST`, `BETA_CONTACT_EMAIL`, and `mapping::<sha256(email)>` keys. No `PLANNER_DASHBOARD_WEBAPP_URL`, no `CENTRAL_MODE`.

### 3.3 Resolver simplification in the central project

Current `central_resolver.js` (shared project):
```javascript
function getUserSpreadsheet_() {
  if (!isCentralModeEnabled_()) {
    return SpreadsheetApp.getActiveSpreadsheet();  // bound fallback
  }
  return getOrProvisionUserSpreadsheet_();
}

function isCentralModeEnabled_() {
  var v = PropertiesService.getScriptProperties().getProperty('CENTRAL_MODE');
  return v === 'true';
}
```

Target `central_resolver.js` (central project only — this is not a change to the bound project):
```javascript
function getUserSpreadsheet_() {
  return getOrProvisionUserSpreadsheet_();
  // No flag check. No bound fallback. This project is always central.
}
// isCentralModeEnabled_() does not exist in this project.
```

The bound project's `central_resolver.js` becomes:
```javascript
function getUserSpreadsheet_() {
  return SpreadsheetApp.getActiveSpreadsheet();
  // No central mode. No flag. No provisioning. This project is always bound.
}
```

---

## 4. What gets copied/migrated to the Central App project

### 4.1 Files that copy wholesale (no central-mode edits required in them)

The vast majority of the application code is domain logic that is identical in both projects. These files are copied verbatim from the bound project to the central project:

| File category | Count | Files |
|---|---|---|
| Domain logic | ~30 | `bank_accounts.js`, `bank_import.js`, `bills.js`, `cash_to_use.js`, `cashflow_setup.js`, `code.js`, `dashboard.js`, `dashboard_data.js`, `debounce_planner.js`, `debt_payoff_projection.js`, `debts.js`, `donations.js`, `home.js`, `house_expenses.js`, `house_values.js`, `income_sources.js`, `investments.js`, `next_actions.js`, `planner_core.js`, `planner_helpers.js`, `planner_output.js`, `profile.js`, `property_performance.js`, `purchase_simulator.js`, `quick_add_payment.js`, `retirement.js`, `rolling_debt_payoff.js`, `upcoming_expenses.js`, `activity_log.js` |
| Shared utilities | ~3 | `config.js`, `sortSheets.js`, `html_includes.js` |
| Bootstrap / sheet setup | ~2 | `sheet_bootstrap.js`, `onboarding.js` |
| HTML templates | 30 | All `*.html` files |

*Note on the startup routing fix:* The uncommitted changes to `sheet_bootstrap.js`, `dashboard_data.js`, `config.js`, `onboarding.js`, `profile.js`, `house_values.js` replace `SpreadsheetApp.getActiveSpreadsheet()` with `getUserSpreadsheet_()`. In the central project, these changes are **always correct** (there is no active spreadsheet). These uncommitted changes go into the central project directly as the committed baseline; they are never committed to the bound project.

### 4.2 Files that require central-mode edits before copy

| File | What changes | Why |
|---|---|---|
| `central_resolver.js` | Remove `isCentralModeEnabled_()` and bound fallback; `getUserSpreadsheet_()` becomes unconditional | Central project is always central; no flag needed |
| `central_provisioning.js` | Remove `CENTRAL_MODE_KEY_` constant; remove any `CENTRAL_MODE` property read/write | Flag concept does not exist in the central project |
| `webapp.js` | No CENTRAL_MODE check required in `doGet`; simplify `doGet(e)` to accept `e` parameter (needed for future URL/parameter work) | `doGet` always runs central path |
| `appsscript.json` | New central-project manifest (§7.1 below); not a copy of the bound manifest | Different project, different identity |

### 4.3 Files that do NOT go to the central project

| File | Reason |
|---|---|
| The bound project's personal data (`PLANNER_DASHBOARD_WEBAPP_URL`, trigger IDs, etc.) | Script properties are per-project; the central project starts with a clean property store |
| `sortSheets.js` (possibly) | This utility is only meaningful in a bound context where the developer manually reorders sheets; review before copying |
| Bound-mode deployment history | Deployments are per-project artifacts; the central project starts with zero deployments |

---

## 5. What does NOT migrate

| Item | Stays where | Notes |
|---|---|---|
| Developer's production workbook data | Developer's Google Drive | The CashCompass spreadsheet bound to the bound project is not touched |
| Bound project deployment | Bound project | URL(s) stored in `PLANNER_DASHBOARD_WEBAPP_URL` continue pointing to bound project; no change |
| Developer's personal workflow | Bound project | `openPlannerDashboardWebLauncher`, sidebar, debounce triggers, sheet-bound menus — all stay in the bound project |
| Old workbook scripts | Bound project | The Apps Script project stays bound to the developer's spreadsheet unless the developer explicitly transfers it later |
| Bound project git history | Git repo root | Both projects share the same git repository; only one `.clasp.json` changes |

---

## 6. How development works after split

### 6.1 Three options, compared

#### Option A — Manual copy/push (initial / simplest)

Two separate clasp configurations in the same repository:

```
.clasp.json          ← active clasp target (bound project, default)
.clasp-central.json  ← central project clasp config
```

To push to central: `clasp push --project .clasp-central.json` (or swap the files temporarily).

**Pros:** No infrastructure. Works today. Each push is an explicit developer choice.
**Cons:** Easy to forget to push to the second project after a change. Changes must be manually reviewed for "is this change safe for both projects, or only one?" before each push. Risk of the two projects diverging silently.

**Recommended for:** initial beta setup (first family member access). Fast and low-ceremony.

#### Option B — Shared git repo, two clasp configs, explicit push workflow

Same as Option A but with a documented convention:
- All changes commit to the single git repo on `main`.
- A `push-central.sh` script (one line: `clasp push --project .clasp-central.json`) is committed to the repo.
- The developer runs `push-central.sh` explicitly when a change should reach the central project.
- CI (if/when added) validates that both clasp targets are in sync.

**Pros:** Low friction. Explicit push is self-documenting. Git history is the single source of truth for both projects.
**Cons:** Still a manual two-step. A forgotten push means two projects diverge. No automated enforcement.

**Recommended for:** ongoing family beta after initial setup.

#### Option C — Shared source with per-project entry-point files (long-term)

The codebase is refactored so that project-specific files (the two different `central_resolver.js` variants, the two different `appsscript.json` manifests) live in separate subdirectories:

```
src/shared/           ← all domain logic (the ~35 common files)
src/bound/            ← bound-project-specific files only
  central_resolver.js ← always-bound version
  appsscript.json     ← USER_DEPLOYING, MYSELF
src/central/          ← central-project-specific files only
  central_resolver.js ← always-central version
  central_provisioning.js
  appsscript.json     ← USER_ACCESSING, ANYONE, Drive
```

A build step copies `src/shared/` + the appropriate `src/<project>/` into a per-project push directory before `clasp push`.

**Pros:** Makes the per-project diffs explicit and auditable. Eliminates accidental cross-contamination in shared files. Easy to see "what is different between the two projects" at a glance.
**Cons:** Requires a build step (even a trivial shell script) that must be maintained. More complex than Option A/B. Overkill for a family beta with 2–5 users.

**Recommended for:** public/GA release if the project reaches that milestone.

### 6.2 Recommendation for the current phase

Start with **Option B** (shared repo, two clasp configs, explicit push script). The discipline cost is one shell script and a convention. The risk of forgetting a push is low at family-beta scale where changes are infrequent and deliberate. Upgrade to Option C if/when the codebase is used by more than one developer.

---

## 7. Deployment and auth model for the central project

### 7.1 Central project `appsscript.json` (target manifest)

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

This is identical to the rationale in `CENTRAL_APP_DEPLOYMENT_PREPARATION_PLAN.md §3`. It is correct for a standalone central project. The distinction is that this manifest only affects the central project — it no longer contaminates the bound project.

### 7.2 Bound project `appsscript.json` after separation (revert target)

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

No `oauthScopes` block (auto-detect is fine for a personal tool). No Drive Advanced Service (the bound project never calls `Drive.Files.create`). This is the manifest the bound project had before the central-mode experiment began (§2.1 of `CENTRAL_APP_DEPLOYMENT_PREPARATION_PLAN.md`).

### 7.3 Allow-list and beta posture

- `FAMILY_BETA_ALLOWLIST` script property lives only in the central project.
- The bound project has no allow-list and no allow-list check in `doGet`.
- For the initial family beta: allow-list contains the developer's email + invited family members.
- For public/GA: the allow-list is either expanded to `*` (any Google account) or removed. This decision belongs to a later planning slice.

### 7.4 OAuth verification posture

The central project will display Google's "This app isn't verified" interstitial to every new user until the OAuth verification process is completed with Google. This is a known and accepted limitation for the beta phase (see `CENTRAL_APP_DEPLOYMENT_PREPARATION_PLAN.md §8.4` for the disposable-account test protocol). OAuth verification is deferred to a post-beta planning slice.

---

## 8. Mapping and storage model

### 8.1 Script properties in the central project (only)

| Property key | Value format | Purpose |
|---|---|---|
| `FAMILY_BETA_ALLOWLIST` | `email1,email2,...` | Comma-separated allow-list |
| `BETA_CONTACT_EMAIL` | single email | Contact address shown in rejection messages |
| `mapping::<sha256(email)>` | Google Sheets spreadsheet ID | User → workbook mapping (one per user) |

Nothing else. No `CENTRAL_MODE`. No `PLANNER_DASHBOARD_WEBAPP_URL`. No trigger IDs belonging to the developer's bound workflow.

### 8.2 Script properties in the bound project (only)

| Property key | Value format | Purpose |
|---|---|---|
| `PLANNER_DASHBOARD_WEBAPP_URL` | URL | Bound deployment URL opened by the launcher |
| Debounce trigger IDs | internal | Set by `debounce_planner.js` |

No `CENTRAL_MODE`. No allow-list. No mapping keys.

### 8.3 No cross-contamination by structural guarantee

Because the projects are separate, `PropertiesService.getScriptProperties()` in the central project never reads the bound project's properties, and vice versa. This is a hard Google platform boundary — project properties are not shared across projects regardless of any code or configuration.

The current risk (central-mode script property writes corrupting bound-mode configuration) is eliminated at the platform level, not by code discipline.

### 8.4 User workbooks remain user-owned

User workbooks (created by `Drive.Files.create` under `USER_ACCESSING`) are owned by the calling user, not by the developer. This invariant is unchanged. The central project's property store holds only the mapping from `sha256(email)` → spreadsheet ID; it does not hold the workbook itself. The workbook lives in the user's Drive and belongs to them.

---

## 9. Migration and testing sequence

The sequence below is ordered to maintain a working bound workflow throughout. At no point does the migration require disabling or modifying the existing bound deployment.

### Phase 0 — Prerequisites (documentation only, before any action)

- [ ] This document is reviewed and committed.
- [ ] Uncommitted startup-routing fixes in the working tree are reviewed and their correctness for the central-only context is confirmed.
- [ ] The bound project's git working tree is clean (all changes committed or stashed).
- [ ] The developer's bound deployment URL is recorded (for verification post-separation).

### Phase 1 — Create the central Apps Script project

- [ ] In Google Drive or at [script.google.com](https://script.google.com), create a **new Apps Script project** (not bound to any spreadsheet). Name it: `CashCompass — Central App`.
- [ ] In clasp: `clasp clone <new-project-script-id>` to retrieve the new project's `.clasp.json`.
- [ ] Rename the retrieved `.clasp.json` to `.clasp-central.json` in the repo root.
- [ ] Add `.clasp-central.json` to version control.
- [ ] Verify the new project is empty (only the default `Code.gs` stub).
- [ ] **Do not push anything yet.**

### Phase 2 — Push the codebase to the central project

- [ ] Prepare the central-project variants of `central_resolver.js` and `central_provisioning.js` (unconditional routing, no `CENTRAL_MODE` flag). These are the only files that differ from the shared project.
- [ ] Prepare the central-project `appsscript.json` (§7.1).
- [ ] Apply the startup-routing fixes (currently uncommitted) to the working tree's shared files. These will be committed to the bound project's working tree as a *central-project-only* set — or, more cleanly, applied as a separate commit that clearly marks them as "for central project propagation."
- [ ] Push all files to the central project: `clasp push --project .clasp-central.json` (or equivalent with the renamed config).
- [ ] Verify in the Apps Script editor that all files appear correctly in the central project.

### Phase 3 — Enable GCP services and create the deployment

- [ ] In the central project's GCP project: enable the Google Drive API (same one-time console click as in the original shared-project experiment).
- [ ] In the Apps Script editor for the central project: Manage Deployments → New deployment → Web app → set `executeAs: USER_ACCESSING`, `access: ANYONE` (UI label: "Anyone with a Google account").
- [ ] Record the new central deployment's `/exec` URL.
- [ ] Set the central project's script properties:
  - `FAMILY_BETA_ALLOWLIST` = `samertheodossy@gmail.com,cashcompass2026@gmail.com` (initial beta set)
  - `BETA_CONTACT_EMAIL` = developer's contact email

### Phase 4 — Developer self-test on the central project

- [ ] Open the central deployment URL in a browser signed in to `samertheodossy@gmail.com`.
- [ ] Consent to the central project's OAuth grant (this is a different project — a new consent is required even for the developer's account).
- [ ] Confirm:
  - [ ] A new workbook `CashCompass — samertheodossy@gmail.com` is created in the developer's Drive (or the existing mapping is found if the mapping was copied across).
  - [ ] The startup routing correctly goes to the Overview/Dashboard (not the Welcome screen) if the workbook has > 2 sheets, or to Setup/Review if the workbook has ≤ 2 sheets.
  - [ ] No data from the bound workbook leaks into the central deployment view.
  - [ ] The executions log in the central project shows the developer's email as the running user.

### Phase 5 — Second-user test on the central project

- [ ] Open the central deployment URL in a fresh incognito/private window signed in to `cashcompass2026@gmail.com`.
- [ ] Accept the "unverified app" interstitial.
- [ ] Confirm:
  - [ ] A new workbook `CashCompass — cashcompass2026@gmail.com` is created in `cashcompass2026@gmail.com`'s Drive.
  - [ ] The startup routing shows Setup/Review (fresh workbook with ≤ 2 sheets).
  - [ ] No developer data is visible.
  - [ ] The mapping key `mapping::<sha256(cashcompass2026@gmail.com)>` exists in the central project's script properties.
  - [ ] The bound project's script properties are untouched.

### Phase 6 — Bound project cleanup

Once Phase 5 is confirmed passing:

- [ ] Revert the bound project's `appsscript.json` to the pre-central manifest (§7.2).
- [ ] Simplify `central_resolver.js` in the bound project: `getUserSpreadsheet_()` returns `getActiveSpreadsheet()` unconditionally; remove `isCentralModeEnabled_()`.
- [ ] Delete or tombstone `central_provisioning.js` in the bound project (it is now a dead file in the bound context).
- [ ] Delete `CENTRAL_MODE` from the bound project's script properties if it exists.
- [ ] Verify the bound deployment still loads correctly.
- [ ] Commit the bound project cleanup as a separate, clearly labeled commit ("Revert bound project to pre-central state after central project separation").

### Phase 7 — Unauthorized-account test

- [ ] Open the central deployment URL from a Google account not on the allow-list.
- [ ] Confirm a rejection message is shown (no workbook created, no data visible).

### Phase 8 — Smoke test the bound project is unaffected

- [ ] Open the bound deployment URL.
- [ ] Confirm the developer's personal workbook data loads correctly.
- [ ] Confirm no new sheets were created in the bound workbook.
- [ ] Confirm no new script properties were written to the bound project.
- [ ] Confirm the bound project's executions log shows only bound-mode function runs.

---

## 10. Cleanup implications for the bound project

### 10.1 Resolver simplification

After the split, the bound `central_resolver.js` is a 4-line file:
```javascript
function getUserSpreadsheet_() {
  return SpreadsheetApp.getActiveSpreadsheet();
}
function getCurrentUserEmail_() { ... }  // unchanged
```

The `isCentralModeEnabled_()` function is removed. The `CENTRAL_MODE` constant is removed from `central_provisioning.js` (which is itself removed or tombstoned from the bound project).

### 10.2 Manifest revert

The bound `appsscript.json` loses:
- `oauthScopes` block (back to auto-detect, sufficient for personal dev tool)
- `dependencies.enabledAdvancedServices` Drive v3 entry (bound project never calls `Drive.Files.create`)
- `executeAs: USER_ACCESSING` → back to `USER_DEPLOYING`
- `access: ANYONE` → back to `access: MYSELF`

This manifest revert is safe because the bound deployment has its own version pinning in the Deployments dialog; the manifest revert only affects future redeploys of the bound deployment.

### 10.3 Working-tree changes that resolve naturally

The uncommitted changes in `sheet_bootstrap.js`, `dashboard_data.js`, `config.js`, `onboarding.js`, `profile.js`, `house_values.js` — which replace `getActiveSpreadsheet()` with `getUserSpreadsheet_()` — are:
- **Committed to the central project** as its baseline (correct, because the central project is always central mode).
- **Discarded from the bound project's working tree** (the bound project's `getUserSpreadsheet_()` already returns `getActiveSpreadsheet()`, so these replacements are identity transforms in the bound context and not needed there).

This resolution is clean: the uncommitted changes stop being a source of regression risk in the bound project and become the committed baseline in the central project.

### 10.4 Historical central-mode docs

The planning docs that chronicle the shared-project experiment (`CENTRAL_APP_WORKBOOK_CREATION_FIRST_SLICE_PLAN.md`, `CENTRAL_APP_DEPLOYMENT_PREPARATION_PLAN.md`, `CENTRAL_APP_RESOLVER_PROVISIONING_IMPLEMENTATION_PROMPT.md`, `CENTRAL_APP_DOC_INDEX.md`, the startup-routing diagnostic plans) are retained as historical records per the doc index (bucket B or C). They document why the shared-project approach was chosen first, what it proved, and why separation was the natural next step.

After the migration is complete, the following new docs become the active source of truth for the central project:
- **This document** — the migration/architecture decision.
- A new `CENTRAL_APP_CENTRAL_PROJECT_SETUP_CHECKLIST.md` (the zero-code setup checklist for Phase 1–3 above, if a more detailed step-by-step is needed).
- A runtime test report capturing the Phase 4–8 results.

---

## 11. Risks

### 11.1 Keeping two projects in sync

**Risk:** A fix is committed to the bound project's `main` branch but never pushed to the central project. Users on the central project are running an older version.

**Mitigation:**
- Option B's explicit `push-central.sh` script makes each push a deliberate action.
- Before each push to central, the developer reviews whether the change applies to the central project (domain logic: yes; bound-project-specific files: no).
- For features that only belong in the central project (e.g., the unconditional central resolver, the allow-list gate), those files are only edited in the central context and never applied to the bound project.

**Residual risk:** Low at family-beta scale (infrequent changes, single developer). Elevated if the codebase is actively developed across both projects simultaneously.

### 11.2 Deployment and version management

**Risk:** The central project accumulates multiple deployments as the app iterates. Old URLs given to family members may point at stale versions.

**Mitigation:**
- Create a new deployment for each breaking change; archive old deployments.
- Document the current "live" central deployment URL in a script property or session notes so the developer always knows which URL to give to family members.
- Avoid giving family members the `/dev` URL (always unpinned to latest code, including half-finished changes).

### 11.3 OAuth consent repeats on scope changes

**Risk:** Any change to `oauthScopes` in the central project forces every user to re-consent on next visit. For family-beta users, this may be confusing without advance warning.

**Mitigation:**
- Plan scope changes ahead of time. Do not add new scopes casually.
- Warn family-beta users via a separate channel (message) before deploying a scope-changing update.
- The six-scope set in §7.1 is complete for all current functionality; no new scopes are expected to be needed until a future feature expansion.

### 11.4 Accidental copy errors during migration

**Risk:** During Phase 2 (push to central project), a file is accidentally pushed in its bound-project form (e.g., `central_resolver.js` with the `isCentralModeEnabled_()` branch still present), causing the central project to behave like the shared project.

**Mitigation:**
- Review `central_resolver.js` and `central_provisioning.js` diffs before pushing.
- The Phase 4 self-test will catch this: if `isCentralModeEnabled_()` still exists in the central project and `CENTRAL_MODE` property is not set (or is `false`), the central project would fall back to `getActiveSpreadsheet()` — which returns null in a standalone context and immediately throws. This is detectable in the executions log.

### 11.5 GCP project linkage

**Risk:** The new Apps Script project may not automatically have the Drive API enabled in its linked GCP project.

**Mitigation:** Phase 3 explicitly includes the GCP Drive API enable step. This is a known one-time action documented in `CENTRAL_APP_DEPLOYMENT_PREPARATION_PLAN.md §3.5`.

### 11.6 Mapping portability

**Risk:** The existing `mapping::<sha256(samertheodossy@gmail.com)>` script property (pointing to the developer's central workbook, created during the shared-project experiment) lives in the shared project's property store. It does not exist in the new central project's property store.

**Impact:** When the developer first opens the new central project's deployment URL, the mapping will not be found. The provisioning path will create a **new workbook** for `samertheodossy@gmail.com` in the developer's Drive. This is safe (it does not affect the bound workbook), but it means the developer will have two "central" workbooks in their Drive: the one created during the experiment and the one created by the new project.

**Mitigation:**
- Before Phase 4, decide whether to:
  - **A. Accept a second workbook:** let provisioning create a fresh workbook in the new project. This is the simplest path. The experiment workbook can be trashed manually.
  - **B. Copy the mapping property:** manually set `mapping::<sha256(samertheodossy@gmail.com)>` in the new project's script properties to the existing workbook's spreadsheet ID. This lets the developer continue using the same workbook without re-bootstrapping. Requires knowing the workbook's ID (visible in its URL).
- Option B is recommended if the developer has begun entering personal data into the central workbook during the experiment phase. Option A is cleaner if the workbook contains only bootstrap data (Sheet1 + INPUT - Settings).

---

## 12. Recommended next step

Before any project-creation action, define and commit the **zero-code setup checklist** for the new Central App project. This checklist is the Phase 1–3 sequence from §9 expanded into exact, ordered, individually-verifiable steps:

1. Create the Apps Script project in the Google Drive UI.
2. Clone it via clasp and save `.clasp-central.json`.
3. Prepare the three per-project-specific files (`central_resolver.js` central variant, `central_provisioning.js` without `CENTRAL_MODE`, `appsscript.json` central manifest).
4. Apply the startup-routing fixes to the shared files.
5. Run the push.
6. Enable GCP Drive API.
7. Create the deployment.
8. Set script properties.
9. Run the Phase 4 developer self-test.

This checklist (not the implementation) is the next artifact. Once the checklist is reviewed and committed, the actual project creation and push can proceed as a single short session.

**Recommended document to create next:** `CENTRAL_APP_CENTRAL_PROJECT_SETUP_CHECKLIST.md`

---

## 13. Long-term posture (post-GA)

Once the family beta succeeds and the product approaches public availability:

1. **OAuth verification:** submit the central project for Google's OAuth app verification. This removes the "unverified app" interstitial for new users. This is a multi-week process requiring a privacy policy, app justification, and possibly a security assessment.
2. **Allow-list removal:** once verified, the allow-list gate can be removed or replaced with a self-service invitation flow.
3. **Source model upgrade:** consider Option C (§6.1) for source management — separate subdirectories for per-project files, a build step for `clasp push`, CI enforcement that both projects are in sync.
4. **Bound project deprecation:** at GA, the bound project becomes purely a developer workflow tool. It may be archived or kept as the developer's personal instance. The central project is the live user-facing product.

---

End of document.
