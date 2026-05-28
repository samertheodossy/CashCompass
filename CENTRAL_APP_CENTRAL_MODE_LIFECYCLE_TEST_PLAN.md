# CENTRAL_APP_CENTRAL_MODE_LIFECYCLE_TEST_PLAN.md

Manual lifecycle hardening test plan for the first central-mode resolver + workbook
provisioning slice (commit `d952dfa`).

**Documentation / test planning only.** No Apps Script change, no HTML change, no
`appsscript.json` change, no deployment change, no implementation. Each test group
is observation-only. Code changes are only warranted if a test surfaces a confirmed
bug, and each such change requires its own implementation prompt.

Cross-references:
- `CENTRAL_APP_WORKBOOK_CREATION_FIRST_SLICE_PLAN.md → §11` — original acceptance
  criteria; §15 — runtime evidence to date; §15.5 — the four hardening tests this
  doc expands.
- `CENTRAL_APP_FAMILY_BETA_READINESS_CHECKPOINT.md → §7.6` — active recommendation
  ordering the four next test sessions.
- `CENTRAL_APP_NEXT_STEP_BASELINE.md → §7.bis` — two-mode operating model these
  tests validate.
- `central_provisioning.js` — the implementation under test (constants, allow-list,
  mapping, provisioning, lock, stale-mapping).
- `central_resolver.js` — `getUserSpreadsheet_()` router and `isCentralModeEnabled_()`.
- `webapp.js → doGet` — allow-list gate entry point.

---

## 1. Purpose and scope

### 1.1 Why this plan exists

The first central-mode provisioning milestone (2026-05-28) confirmed the happy path for
one account (the developer's primary) against one new workbook. Six lifecycle scenarios
were **not** exercised in that session and remain open:

1. Returning user with an existing mapping (second-session open).
2. Separate account provisioning (multi-account isolation proof).
3. Unauthorized account rejection (security gate proof).
4. `CENTRAL_MODE=false` flag rollback (escape hatch proof).
5. Stale-mapping behavior (safe error surface + manual recovery).
6. Mapping key correctness (SHA-256 hash; no raw email in keys).
7. Drive ownership verification (workbook owned by calling user).
8. Bound-mode separation (original workbook untouched end-to-end).

This plan turns each of those into a concrete, step-by-step manual test session.

### 1.2 What "PASS" means for each test group

Every test group has an explicit pass criterion. A test group is **PASS** only when
every row in its acceptance table has the observed value matching the expected value
with no manual recovery required beyond the deliberate setup steps. Any unexplained
deviation is a **FAIL** for that row; if the row is load-bearing for the next session
(e.g., a mapping must exist before the stale-mapping test can run), record the failure
and do not proceed to the next session.

### 1.3 Execution order

The recommended order follows the dependency graph of the tests:

```
Group 2 (disposable provisioning)
  → Group 3 (unauthorized rejection, using the disposable as the "third account")
  → Group 1 (return-to-mapping, using the disposable account's just-created workbook)
  → Group 5 (stale mapping, trashing the developer's workbook and re-hitting)
  → Group 4 (CENTRAL_MODE=false rollback, observed against both accounts)
  → Group 6 (mapping inspection, read-only audit of script properties)
  → Group 7 (Drive ownership, verified during Groups 2 + 5)
  → Group 8 (bound-mode separation, verified throughout all groups)
```

Groups 6, 7, and 8 produce observations that arise naturally inside earlier groups;
their rows are redundant cross-checks rather than standalone sessions.

### 1.4 Prerequisites (must be true before any session)

| # | Prerequisite | How to verify |
|---|---|---|
| P1 | Implementation slice `d952dfa` is on `main` and pushed | `git log --oneline` |
| P2 | `clasp push` has been executed to sync the latest code to the Apps Script project | Apps Script editor → last-modified timestamp on any file |
| P3 | Central deployment `CashCompass — Central Beta (Slice 1)` exists and is live | Apps Script editor → Manage Deployments |
| P4 | `CENTRAL_MODE` = `true` in Script Properties | Apps Script editor → Project Settings → Script Properties |
| P5 | `FAMILY_BETA_ALLOWLIST` contains at least the developer's primary email | Script Properties |
| P6 | Developer's primary Google account has a provisioned `CashCompass — <dev email>` workbook in Drive from the 2026-05-28 session | Drive search |
| P7 | `mapping::<sha256(dev email)>` exists in Script Properties pointing to that workbook's ID | Script Properties |
| P8 | The original (bound) production workbook is **not** modified during any test session | Open it in a separate tab before each session; note the current sheet/row count as a baseline |

---

## 2. Test group inventory

| # | Group name | Maps to §1.1 scenario | Required prior groups | Risk level |
|---|---|---|---|---|
| 1 | Existing mapped user returns | Scenario 1 | Group 2 (disposable account must exist first) or the dev account (already provisioned) | **HIGH** — most common user path; regression here silently creates duplicate workbooks |
| 2 | Disposable second-account provisioning | Scenario 2 | None | **HIGH** — multi-account isolation is the core architectural claim |
| 3 | Unauthorized account rejection | Scenario 3 | Group 2 (use disposable email then remove it from allow-list, or use a third account) | **HIGH** — security gate; failure means any Google user can reach provisioning |
| 4 | `CENTRAL_MODE=false` rollback | Scenario 4 | None (can run standalone) | **MEDIUM** — escape hatch; failure means the rollback path is broken |
| 5 | Stale-mapping behavior | Scenario 5 | P6 + P7 (developer workbook + mapping must exist) | **MEDIUM** — user-visible error surface; failure means corrupted state with no recovery path |
| 6 | Mapping key inspection | Scenario 6 | P7 | **LOW** — audit only; directly observable in Script Properties |
| 7 | Drive workbook ownership | Scenario 7 | Groups 2 + 5 | **LOW** — observable in Drive UI; failure would be visible in other groups |
| 8 | Bound-mode separation | Scenario 8 | None (cross-group invariant) | **MEDIUM** — the two-mode boundary; failure affects the developer's live data |

---

## 3. Group 1 — Existing mapped user returns

**Goal:** prove that a user who was provisioned in a previous session returns to the
**same** workbook with no duplicate file created and no second `Drive.Files.create`
call.

**Dependency:** The developer's account already satisfies this after the 2026-05-28
session (mapping + workbook exist). Alternatively, run Groups 2 then 1 against the
disposable account for a cleaner isolated proof.

**Setup:**
1. Confirm P6 and P7 are true (mapping and workbook exist for the test account).
2. Optionally note the Drive file ID from the workbook's URL before the session.
3. Optionally clear the Apps Script Executions log so the new session is easy to read.

**Session:** open the central deployment URL from the mapped account's browser.

| Row | Step | Expected result | PASS / FAIL / Notes |
|---|---|---|---|
| 1.1 | Open central URL in the mapped account's browser. | Page loads normally (Setup / Review or dashboard — whichever state it was left in). No OAuth re-consent if the grant is still valid. |  |
| 1.2 | Observe the Apps Script Executions log while the page loads. | `lookupSpreadsheetIdForUser_` returns a non-null value; `SpreadsheetApp.openById` is called; `provisionWorkbookForUser_` is **not** called. Confirm by checking the execution trace — `provisionWorkbookForUser_` should not appear. |  |
| 1.3 | Check the account's Drive for `CashCompass — <email>`. | Exactly **one** workbook exists — the same file from the original provisioning session. No second `CashCompass — <email>` file. Drive file ID is unchanged. |  |
| 1.4 | Check Script Properties for `mapping::<sha256(email)>`. | Exactly **one** entry for this email hash. Value is the same spreadsheet ID as before. No duplicate or modified entry. |  |
| 1.5 | Repeat row 1.1–1.4 with a fresh incognito window (forces a cold re-execution). | Same results — no duplicate workbook, no re-provisioning. |  |

**Pass criterion:** all five rows observed as expected. No new Drive file created. No
second `Drive.Files.create` appears in the Executions log.

---

## 4. Group 2 — Disposable second-account provisioning

**Goal:** prove that a second, distinct Google account gets its **own** user-owned
workbook in its **own** Drive, and that the developer's workbook is unaffected.

**Setup:**
1. Create (or identify) a disposable Google account that has **never** interacted with
   the central deployment URL before. Call it `<disposable email>`.
2. Add `<disposable email>` to `FAMILY_BETA_ALLOWLIST` via Script Properties (append to
   the existing CSV — e.g., `samertheodossy@gmail.com, <disposable email>`).
3. Prepare a **clean browser profile** (Chrome profile or Firefox container) signed
   into the disposable account only, with no prior CashCompass interaction.
4. Note that the developer's existing `CashCompass — samertheodossy@gmail.com` workbook
   and its mapping entry are the **baseline** — they must be unchanged after this session.

**Session:** open the central deployment URL in the disposable account's clean browser profile.

| Row | Step | Expected result | PASS / FAIL / Notes |
|---|---|---|---|
| 2.1 | Open central URL in the disposable account's browser profile. | OAuth consent screen appears, listing the scopes from `appsscript.json` (`spreadsheets`, `drive.file`, `userinfo.email`, etc.). Consent screen title: project name, not "CashCompass — Private Beta" rejection page. |  |
| 2.2 | Accept consent. | Page loads to Setup / Review (fresh first-run state — no existing data, so setup probes are all `missing`). No red banner. |  |
| 2.3 | Open the disposable account's Google Drive (in the same or a second tab). | A spreadsheet named `CashCompass — <disposable email>` exists in the Drive **root** (not in any subfolder). **Owned by the disposable account** (ownership shown in Drive file info — right-click → File information → Details → Owner). Contains exactly one sheet: `INPUT - Settings`. |  |
| 2.4 | Open Apps Script editor → Script Properties. | A new entry `mapping::<sha256(<disposable email>)>` exists. Its value is the spreadsheet ID of the workbook seen in row 2.3. |  |
| 2.5 | Check that the developer's mapping entry is unchanged. | `mapping::<sha256(samertheodossy@gmail.com)>` still exists and its value is the original workbook ID from P7 — **not** changed, **not** removed. |  |
| 2.6 | Open the developer's `CashCompass — samertheodossy@gmail.com` workbook in Drive. | Workbook is untouched — same sheets, same data, same last-modified timestamp as before this session. |  |
| 2.7 | Check the Apps Script Executions log for this session. | `provisionWorkbookForUser_` was called once (for the disposable account). `LockService.getUserLock()` was acquired and released. `Drive.Files.create` appeared once. `writeSpreadsheetIdForUser_` appeared once. No call for the developer's email. |  |
| 2.8 | Walk Setup / Review on the disposable account: add a bank account. | `INPUT - Bank Accounts` is created additively in the **disposable account's** workbook. The developer's workbook is unaffected (re-check row 2.6). No red banner. |  |

**Pass criterion:** all eight rows observed as expected. Two distinct workbooks exist
in two distinct Drives. Two distinct mapping entries exist in Script Properties. Developer's
workbook untouched.

---

## 5. Group 3 — Unauthorized account rejection

**Goal:** prove that an account not on `FAMILY_BETA_ALLOWLIST` is rejected by the
allow-list gate in `doGet` **before** any provisioning, mapping write, or Drive
access occurs.

**Setup (option A — use a third Google account):**
1. Identify a third Google account that is **not** listed in `FAMILY_BETA_ALLOWLIST`.
2. Prepare a clean browser profile signed into that account.
3. Verify that `FAMILY_BETA_ALLOWLIST` does **not** contain that account's email.

**Setup (option B — temporarily remove the disposable account from the allow-list):**
1. After completing Group 2, edit `FAMILY_BETA_ALLOWLIST` to remove `<disposable email>`.
2. Use the disposable account's browser profile for this test.
3. After the test, restore `<disposable email>` to the allow-list.

Option B is cheaper (no new account needed) but requires careful allow-list editing.
Option A is cleaner for long-term test repeatability.

**Session:** open the central deployment URL from the unauthorized account's browser.

| Row | Step | Expected result | PASS / FAIL / Notes |
|---|---|---|---|
| 3.1 | Open central URL in the unauthorized account's browser. If the account has never hit this URL, OAuth consent may appear first — accept it. | After consent (or immediately if grant already exists): the private-beta rejection HTML renders. Title: "CashCompass — Private Beta". Body includes "CashCompass is currently in private beta and is not yet open to new users." No dashboard content is visible. |  |
| 3.2 | Check the unauthorized account's Google Drive. | **No** new `CashCompass — *` file exists. Drive is unchanged. |  |
| 3.3 | Check Script Properties for any new mapping entry. | No `mapping::*` entry was added during this session. The count of `mapping::` keys is the same as before. |  |
| 3.4 | Check Apps Script Executions log for this session. | `doGet` ran. `isAllowlistedUser_()` returned `false`. `renderAllowlistRejection_()` was called. **Neither** `getUserSpreadsheet_()` **nor** `getOrProvisionUserSpreadsheet_()` **nor** `Drive.Files.create` appears in the execution trace. |  |
| 3.5 | Verify that `BETA_CONTACT_EMAIL` contact information appears in the rejection page (if the property is set). | If `BETA_CONTACT_EMAIL` is set: the contact appears in the rejection body, HTML-escaped (no raw `<` / `>` / `&` characters unescaped). If not set: a generic fallback message appears ("contact the project owner"). Neither case leaks internal details. |  |
| 3.6 | Repeat with an empty `FAMILY_BETA_ALLOWLIST` (temporarily clear the property — then restore). | All rows above hold with an empty allow-list. The developer's own account is also rejected (fail-closed on empty list). Restore allow-list after confirming. |  |

**Pass criterion:** all six rows observed as expected. No Drive write, no mapping
write, no resolver invocation for the unauthorized account.

**Important note on row 3.6:** temporarily clearing `FAMILY_BETA_ALLOWLIST` will
cause the developer's central deployment URL to reject the developer as well. This is
correct and expected ("fail-closed"). Restore the property immediately after confirming.

---

## 6. Group 4 — `CENTRAL_MODE=false` rollback

**Goal:** prove that flipping `CENTRAL_MODE` to `false` in Script Properties immediately
reverts the resolver to legacy `SpreadsheetApp.getActiveSpreadsheet()` pass-through
behavior, with no Drive access, no mapping lookup, and no provisioning.

**Setup:**
1. Flip `CENTRAL_MODE` to `false` in Script Properties (no redeploy needed).
2. Keep `FAMILY_BETA_ALLOWLIST` populated — the allow-list gate still runs on every
   `doGet` regardless of `CENTRAL_MODE`, so the developer must still be listed.
3. Open the central deployment URL from an allow-listed account.

| Row | Step | Expected result | PASS / FAIL / Notes |
|---|---|---|---|
| 4.1 | Flip `CENTRAL_MODE` to `false` in Script Properties. | Property saved. No deployment change needed — the next request picks up the new value because `isCentralModeEnabled_()` reads the property on each call. |  |
| 4.2 | Open the central deployment URL from the developer's allow-listed account. | Allow-list gate passes (developer is listed). Page load proceeds. |  |
| 4.3 | Check the Apps Script Executions log. | `isCentralModeEnabled_()` returned `false`. `getUserSpreadsheet_()` returned `SpreadsheetApp.getActiveSpreadsheet()` — the legacy pass-through. `getOrProvisionUserSpreadsheet_()` was **not** called. `Drive.Files.create` was **not** called. `lookupSpreadsheetIdForUser_` was **not** called. |  |
| 4.4 | Observe what spreadsheet the dashboard tried to open. | Under `USER_ACCESSING` with the legacy pass-through, `getActiveSpreadsheet()` returns `null` (no active spreadsheet for a web-app context). The page will likely surface an error — this is expected and is the correct behavior when `CENTRAL_MODE=false` is used on the central deployment (the legacy path is designed for the **bound** deployment, not the central one). The error must be a clean error, not an uncaught exception that exposes stack traces. |  |
| 4.5 | Check the developer's `CashCompass — samertheodossy@gmail.com` workbook in Drive. | Workbook is **unchanged** — no writes, no new sheets, same last-modified timestamp. |  |
| 4.6 | Check Script Properties for any new mapping entry. | No new `mapping::` key was added during this rollback session. |  |
| 4.7 | Flip `CENTRAL_MODE` back to `true` and re-open the central URL. | Normal central-mode behavior resumes — `lookupSpreadsheetIdForUser_` finds the existing mapping, `SpreadsheetApp.openById` opens the developer's workbook, dashboard loads normally. |  |
| 4.8 | Verify the **bound** deployment is unaffected throughout. | Open the bound deployment URL (the original, pre-central-mode URL). It loads the developer's bound workbook normally regardless of the `CENTRAL_MODE` flag value. `CENTRAL_MODE` is a script property shared across all execution contexts, but the bound deployment's pinned script version predates `isCentralModeEnabled_()` entirely — it runs older code and the property is never read. |  |

**Pass criterion:** all eight rows observed as expected. `CENTRAL_MODE=false` is a
clean, immediate, zero-redeploy rollback for the central deployment. The bound
deployment is unaffected by any value of `CENTRAL_MODE`.

**Note on row 4.4:** the `getActiveSpreadsheet()` returning `null` under `USER_ACCESSING`
is a known behavior of the central deployment in legacy-pass-through mode. It is not
a bug in the rollback; it is the correct indication that the central deployment should
not be used with `CENTRAL_MODE=false` for normal operation. The bound deployment is
where legacy-pass-through belongs.

---

## 7. Group 5 — Stale-mapping behavior

**Goal:** prove that when a mapping entry exists but the mapped workbook is inaccessible
(e.g., trashed by the user), the system surfaces a clear, human-readable `StaleMappingError`
and does **not** auto-reprovision.

**Setup:**
1. Confirm P6 and P7 are true (developer's mapping + workbook exist).
2. **Soft-delete the developer's `CashCompass — samertheodossy@gmail.com` workbook** by
   sending it to Drive Trash (right-click in Drive → Move to Trash). Do **not** permanently
   delete it — the test plan's cleanup step will restore it.
3. Confirm the mapping entry `mapping::<sha256(samertheodossy@gmail.com)>` still exists
   in Script Properties (soft-delete does not clear it).
4. `CENTRAL_MODE` must be `true`.

**Session:** open the central deployment URL from the developer's account immediately after
soft-deleting the workbook.

| Row | Step | Expected result | PASS / FAIL / Notes |
|---|---|---|---|
| 5.1 | Open the central deployment URL from the developer's account (workbook is in Trash). | The allow-list gate passes. The resolver calls `lookupSpreadsheetIdForUser_`, gets the stale ID, calls `SpreadsheetApp.openById(staleId)`, which throws because the file is in Trash. `handleStaleMapping_` is invoked. |  |
| 5.2 | Observe what the user sees in the browser. | An error is surfaced — either a red banner, a raw error message, or a blank page with an error indicator. The error message includes the text "Your CashCompass workbook could not be opened" (from `handleStaleMapping_`) and the stale mapped ID. **No** "CashCompass — Private Beta" rejection page (that is the allow-list rejection, not the stale-mapping path). |  |
| 5.3 | Check the developer's Drive for new workbooks. | **No** new `CashCompass — *` file was created during this session. `Drive.Files.create` was **not** called. Auto-reprovisioning does not occur. |  |
| 5.4 | Check Script Properties. | `mapping::<sha256(samertheodossy@gmail.com)>` still exists with the **original** (stale) ID. The entry is **not** cleared or replaced automatically. |  |
| 5.5 | Check Apps Script Executions log. | `handleStaleMapping_` was called with the stale ID and the `openById` error. `StaleMappingError` was thrown. `provisionWorkbookForUser_` was **not** called. `Drive.Files.create` was **not** called. |  |
| 5.6 | **Manual recovery — step 1:** restore the workbook from Drive Trash (right-click in Trash → Restore). | Workbook is back in Drive root. `SpreadsheetApp.openById` would now succeed again. |  |
| 5.7 | **Manual recovery — step 2:** re-open the central deployment URL. | The stale mapping now resolves correctly — the restored workbook opens, dashboard loads normally. No re-provisioning needed when the file is restored. |  |
| 5.8 | **Alternative manual recovery:** instead of restoring, clear the mapping via `clearMappingForUser_('samertheodossy@gmail.com')` from the Apps Script editor's Run dialog (with the workbook still in Trash). | The mapping entry is deleted. On the next central URL hit, `lookupSpreadsheetIdForUser_` returns `null`, and `provisionWorkbookForUser_` creates a **new** workbook. The trashed workbook is abandoned in Trash (user can recover it manually if desired). |  |

**Pass criterion:** rows 5.1–5.5 all confirmed (stale mapping surfaces error, no
auto-reprovision). At least one of 5.6–5.7 or 5.8 confirmed (manual recovery works).
Note the actual observed behavior of row 5.2 for documentation.

**Cleanup after this group:** ensure the developer's mapping is in a clean state
(either the workbook restored with mapping intact, or the mapping cleared and workbook
re-provisioned) before proceeding to Group 6.

---

## 8. Group 6 — Mapping key inspection

**Goal:** confirm directly that the `mapping::` keys in Script Properties use SHA-256
hashes of the lowercased email — never the raw email string as a key.

**Setup:** Script Properties must contain at least one `mapping::` entry (from Groups 2
and/or 5 restoration).

**Session:** open Apps Script editor → Project Settings → Script Properties. Examine
the keys and values in the table.

| Row | Step | Expected result | PASS / FAIL / Notes |
|---|---|---|---|
| 6.1 | In Script Properties, look for any key that contains `@` or a recognizable email-format substring. | **No** key contains `@` or a recognizable email address. All `mapping::` keys are of the form `mapping::<64 hex characters>`. |  |
| 6.2 | Locate the entry for the developer's account. Key format: `mapping::` followed by a 64-character lowercase hex string. | Key is `mapping::<64-hex>`. Example: `mapping::a1b2c3...` (64 chars). Value is the spreadsheet ID (44-character alphanumeric string). |  |
| 6.3 | Manually compute the expected key for `samertheodossy@gmail.com`. In any online SHA-256 tool or in the Apps Script editor's Run dialog: `Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, 'samertheodossy@gmail.com')` → convert bytes to lowercase hex. Compare to the Script Properties key. | The computed hex matches the `<64-hex>` part of the `mapping::` key. |  |
| 6.4 | Locate the entry for the disposable account (from Group 2). Same format check. | Key is `mapping::<64-hex>` (different hash from row 6.2). Value is the disposable workbook's spreadsheet ID. |  |
| 6.5 | Confirm that the `FAMILY_BETA_ALLOWLIST` property value is the only place a plaintext email appears in Script Properties. | The `FAMILY_BETA_ALLOWLIST` value contains the raw emails (correct — this is the allow-list the developer manages). No `mapping::` key contains a raw email. |  |
| 6.6 | Confirm `CENTRAL_MODE_KEY_`, `FAMILY_BETA_ALLOWLIST_KEY_`, and `BETA_CONTACT_EMAIL_KEY_` property names match the constants in `central_provisioning.js` (lines 44–46). | `CENTRAL_MODE` = `true` (or `false` during rollback test). `FAMILY_BETA_ALLOWLIST` = CSV of allow-listed emails. `BETA_CONTACT_EMAIL` = developer's contact email (or empty/absent). |  |

**Pass criterion:** all six rows confirmed. No raw email appears as a `mapping::` key.
The SHA-256 hash matches the independently computed value.

---

## 9. Group 7 — Drive workbook ownership

**Goal:** confirm that each provisioned workbook is **owned by the Google account that
triggered provisioning**, not by the developer or any service account.

**Setup:** Groups 2 and 5 must have completed successfully. There should be at least one
workbook in the developer's Drive and one in the disposable account's Drive.

**Session:** inspect the Drive ownership of each provisioned workbook.

| Row | Step | Expected result | PASS / FAIL / Notes |
|---|---|---|---|
| 7.1 | In the **developer's** Drive, open the file info for `CashCompass — samertheodossy@gmail.com`. | Ownership: `samertheodossy@gmail.com` (the developer's own account). **Not** any other account, service account, or email. |  |
| 7.2 | In the **disposable account's** Drive, open the file info for `CashCompass — <disposable email>`. | Ownership: `<disposable email>`. **Not** the developer's email. |  |
| 7.3 | Confirm neither workbook is shared with the developer's account (assuming they were not explicitly shared). | Developer's Drive search for `<disposable email>`-named files returns no results (the disposable workbook is not shared with the developer by default). |  |
| 7.4 | Confirm the workbook is in the Drive **root** (not in a subfolder). | Both workbooks appear in the "My Drive" root — no parent folder. (This is the current first-slice behavior: `Drive.Files.create` was called with no `parents` field.) |  |

**Pass criterion:** all four rows confirmed. Each workbook is owned by the calling user.
No cross-ownership or sharing side-effects.

---

## 10. Group 8 — Bound-mode separation

**Goal:** prove that the original (pre-central-mode) bound workbook and the bound
deployment are completely unaffected by the central-mode system across all test sessions.

This group is a **cross-session invariant** rather than a standalone test. The rows
below should be checked at the start and end of each other group's session.

**Setup:** the developer's production (bound) workbook baseline — note the sheet names,
row count in `LOG - Activity`, and last-modified timestamp before each test session.

| Row | Step | Expected result | PASS / FAIL / Notes |
|---|---|---|---|
| 8.1 | Open the **bound deployment URL** (original, pre-central-mode URL) at any point during or after the hardening sessions. | The bound deployment loads the developer's bound workbook. All existing sheets and data are intact. The allow-list gate does not run (pinned script version predates it). No Setup / Review re-prompt. Dashboard renders exactly as it did before the central-mode work began. |  |
| 8.2 | Check the bound workbook in Drive after Groups 2, 3, 4, 5. | No new sheets created. No new rows in `LOG - Activity`. No new data in `INPUT - Settings` or any other sheet. Last-modified timestamp unchanged from the pre-session baseline. |  |
| 8.3 | Confirm no `mapping::` entry was written for the bound deployment's session. | The Script Properties audit from Group 6 should show no mapping entry created by the bound deployment's execution context. |  |
| 8.4 | Confirm the bound workbook is distinct from the central-mode workbook. | The bound workbook is **not** the same file as `CashCompass — samertheodossy@gmail.com`. Different spreadsheet ID, different URL, different Drive location. |  |
| 8.5 | With `CENTRAL_MODE=true`, open the bound deployment URL. | Bound deployment still runs the old pinned script (which does not read `CENTRAL_MODE`). The bound deployment is unaffected by the flag. |  |

**Pass criterion:** all five rows confirmed across all test sessions. The bound workbook
is byte-for-byte identical before and after each central-mode hardening session.

---

## 11. Executions-log observation guide

Each test session should include a check of the Apps Script Executions log. Here is
what to look for in each scenario:

| Scenario | Expected entries in Executions log | What would indicate a problem |
|---|---|---|
| Return mapped user (Group 1) | `getUserSpreadsheet_`, `isCentralModeEnabled_` (true), `lookupSpreadsheetIdForUser_` (non-null), `SpreadsheetApp.openById`. **No** `provisionWorkbookForUser_`, **no** `Drive.Files.create`. | Seeing `provisionWorkbookForUser_` means the mapping lookup failed silently — a duplicate workbook risk. |
| New user provisioning (Group 2) | `doGet`, `isAllowlistedUser_` (true), `getUserSpreadsheet_`, `isCentralModeEnabled_` (true), `getOrProvisionUserSpreadsheet_`, `lookupSpreadsheetIdForUser_` (null), `provisionWorkbookForUser_`, `LockService.getUserLock` (acquired), `Drive.Files.create`, `SpreadsheetApp.openById`, `runMinimalBootstrap_`, `ensureInputSettingsSheet_`, `writeSpreadsheetIdForUser_`, lock released. | Missing `writeSpreadsheetIdForUser_` after `Drive.Files.create` means mapping was not persisted — workbook exists but will be re-provisioned on next hit. |
| Unauthorized rejection (Group 3) | `doGet`, `isAllowlistedUser_` (false), `renderAllowlistRejection_`. **Nothing else.** | Any entry after `renderAllowlistRejection_` (especially `Drive.Files.create` or `lookupSpreadsheetIdForUser_`) is a security failure. |
| Stale mapping (Group 5) | `getUserSpreadsheet_`, `lookupSpreadsheetIdForUser_` (non-null), `SpreadsheetApp.openById` (throws), `handleStaleMapping_` (throws `StaleMappingError`). **No** `provisionWorkbookForUser_`, **no** `Drive.Files.create`. | Seeing `provisionWorkbookForUser_` after a stale-mapping path means auto-reprovision is happening — a violation of the first-slice invariant. |
| `CENTRAL_MODE=false` rollback (Group 4) | `doGet`, `isAllowlistedUser_` (true), `getUserSpreadsheet_`, `isCentralModeEnabled_` (false), `SpreadsheetApp.getActiveSpreadsheet`. **No** `lookupSpreadsheetIdForUser_`, **no** `Drive.Files.create`. | Any provisioning function appearing when `CENTRAL_MODE=false` means the flag check is broken. |

---

## 12. Known constraints and non-goals for the first-slice tests

These items are **not** tested by this plan. Each is a deliberate first-slice non-goal
per `CENTRAL_APP_WORKBOOK_CREATION_FIRST_SLICE_PLAN.md → §12`:

- Auto-reprovisioning when a stale mapping is detected (tested as absent — **must not** occur).
- Concurrent provisioning for the same user (lock behavior is tested implicitly via Group 2 but a true parallel-request test requires tooling outside this manual plan).
- Migration of the developer's bound workbook into the central system.
- Billing, public onboarding, admin portal, quota management.
- Per-execution resolver caching.
- Bank Import, schema versioning, audit-log sheet.

---

## 13. Results tracking

Fill this table after each group completes. Link to the `SESSION_NOTES.md` entry
for each session.

| Group | Date run | Result | PASS rows | FAIL rows | SESSION_NOTES entry |
|---|---|---|---|---|---|
| 1 — Return mapped user | | | | | |
| 2 — Disposable provisioning | | | | | |
| 3 — Unauthorized rejection | | | | | |
| 4 — Rollback `CENTRAL_MODE=false` | | | | | |
| 5 — Stale mapping | | | | | |
| 6 — Mapping inspection | | | | | |
| 7 — Drive ownership | | | | | |
| 8 — Bound separation | cross-group | | | | multiple |

**Slice §11.4 status:**
- PARTIAL PASS (developer-account path only) as of 2026-05-28.
- Full PASS requires Groups 1–8 with no FAIL rows.

---

## 14. Recommended first manual test session

**Run Group 2 (disposable second-account provisioning) first.**

Rationale:
- It is the highest-information test on the board. The entire central-mode architecture's
  core claim is "each Google account gets its own isolated workbook." Group 2 directly
  validates or falsifies that claim for the first time with a non-developer account.
- It naturally generates the state that Groups 3, 1, 5, 6, and 7 depend on (a second
  provisioned mapping, a second user-owned workbook, a second email hash in Script
  Properties).
- It is the only group that requires adding a second email to `FAMILY_BETA_ALLOWLIST` —
  a change that must be made before any family beta invitee can use the deployment.
- Risk profile: if Group 2 fails, the architectural claim is invalidated and the slice
  should not be broadened to other beta users until the failure is diagnosed.

End of document.
