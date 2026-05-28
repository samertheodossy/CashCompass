# Central-Mode Startup Routing — Diagnostic Plan

**Status:** Diagnostic planning only — no code changes yet  
**Prepared:** 2026-05-28  
**Precondition:** All uncommitted routing fixes reverted. Working tree is clean at `d952dfa`.

---

## 1. Why the previous fix was unsafe

### 1.1 Two separate failure modes in the reverted fix

**Failure A — Wrong `isBlankWorkbook` formula (first-round fix, `sheet_bootstrap.js`)**

The first-round fix changed `getStartupRoutingFromDashboard()` to use
`getUserSpreadsheet_()` and also changed the blank-detection formula to:

```javascript
// WRONG for returning users
var isBlankWorkbook = (sheets.length > 0 &&
  (isCentral ? existing <= 1 : (existing === 0 && !hasAnyAppSheet)));
```

The `existing <= 1` branch is wrong because:

- `BOOTSTRAP_CORE_KEYS_` contains 6 keys; the first is `BOOTSTRAP_KEY_SETTINGS_` = `"INPUT - Settings"`
- `runMinimalBootstrap_()` creates exactly `INPUT - Settings` — so any provisioned central workbook has `existing = 1`
- `existing <= 1` is therefore TRUE for every provisioned central workbook
- **Both** a fresh user and a returning user evaluate to `isBlankWorkbook = true`
- This routed samertheodossy (returning user, central workbook with 1 core sheet) to Welcome incorrectly

**Failure B — The original formula fails for fresh central users (structural problem that predates the fix)**

The original committed formula:

```javascript
isBlankWorkbook: (sheets.length > 0 && existing === 0 && !hasAnyAppSheet)
```

With the current committed code all functions use `getActiveSpreadsheet()` (bound
workbook). For the bound workbook `existing` is large (5–6) so this is always false —
correct for the developer.

If we naively swap `getActiveSpreadsheet()` → `getUserSpreadsheet_()` without touching
the formula, fresh user2's central workbook evaluates as:

| Variable         | Value                                    |
|------------------|------------------------------------------|
| `existing`       | 1 (`INPUT - Settings` is core key #0)   |
| `hasAnyAppSheet` | `true` ("INPUT - " prefix match)         |
| `isBlankWorkbook`| `(6>0 && 1===0 && !true)` = **false**   |

Result: fresh user2 routes to **Overview**, not Welcome. This is wrong — user2 has done
no setup. Both the reverted fix and a naive re-fix share this problem if only the
spreadsheet-handle source is changed.

### 1.2 Root cause summary

There are two distinct bugs that must be fixed together:

| Bug | Location | Effect |
|-----|----------|--------|
| All startup RPCs read `getActiveSpreadsheet()` (bound workbook) | `sheet_bootstrap.js`, `dashboard_data.js`, `onboarding.js`, `profile.js`, `house_values.js` | User2 gets permission error or sees developer's data |
| `isBlankWorkbook` formula does not have a valid central-mode branch | `sheet_bootstrap.js` `getStartupRoutingFromDashboard()` | Fresh central user routes to Overview; patched `existing <= 1` over-corrects and routes returning user to Welcome |

The diagnostic must **measure** the exact values (`existing`, `hasAnyAppSheet`,
all-sheet count, profile status, spreadsheet ID) for both users so the fix can be
written with real numbers, not guesses.

---

## 2. Full startup RPC inventory (committed state)

The table below shows the call chain, current spreadsheet source, and the fix needed.

| # | Function | File | Current SS source | Called by |
|---|----------|------|-------------------|-----------|
| 0 | `doGet()` | `webapp.js` | none (no SS read) | browser GET |
| 1 | `getStartupRoutingFromDashboard()` | `sheet_bootstrap.js:526` | `getActiveSpreadsheet()` line 528 | client JS `google.script.run` |
| 2 | `getOnboardingBootstrapStatusFromDashboard()` | `sheet_bootstrap.js:424` | `getActiveSpreadsheet()` line 425 | called by #1 |
| 3 | `ensureBootstrapSheet_()` (per key) | `sheet_bootstrap.js:256` | `getActiveSpreadsheet()` line 256 | called by #2 registry |
| 4 | `getDashboardSnapshot()` | `dashboard_data.js:1` | delegates to #5 | client JS (after Overview route) |
| 5 | `buildDashboardSnapshot_()` | `dashboard_data.js:72` | `getActiveSpreadsheet()` line 73 | called by #4 |
| 6 | `getOnboardingStatusFromDashboard()` | `onboarding.js:638` | `getActiveSpreadsheet()` line 640 | client JS (after Setup/Review route) |
| 7 | `probeProfileStatus_()` | `profile.js:470` | via `getProfileSettings()` → `readAllSettingsMap_()` → `ensureInputSettingsSheet_(ss)` → `ss \|\| getActiveSpreadsheet()` | called by #6 |
| 8 | `getOnboardingUpcomingFromDashboard()` | `onboarding.js:1289` | `getActiveSpreadsheet()` line 1291 | client JS (onboarding section loader) |
| 9 | `getOnboardingHousesFromDashboard()` | `onboarding.js:1644` | `getActiveSpreadsheet()` line 1646 | client JS (onboarding section loader) |
| 10 | `getHousesFromHouseValues_()` | `house_values.js:271` | `getActiveSpreadsheet()` line 272 | called by #9 |

**Critical startup path (always executed on page load):** #1 → #2 → #3  
**Post-routing paths:** #4/#5 (Overview), #6/#7/#8/#9/#10 (Setup/Review)

---

## 3. What the diagnostic must measure

For each RPC, we need:

| Field | Rationale |
|-------|-----------|
| `user` | `getCurrentUserEmail_()` — confirms which identity is executing |
| `fn` | function name — identifies which log line came from which RPC |
| `ssId` | `ss.getId()` — exact spreadsheet being read |
| `ssName` | `ss.getName()` — human-readable confirmation |
| `ssSource` | literal string `"active"` or `"resolver"` — distinguishes the code path |
| `centralMode` | `isCentralModeEnabled_()` — confirms flag state |
| `mappingExists` | `lookupSpreadsheetIdForUser_(email) !== null` — confirms mapping state |

Additional fields **only for `getStartupRoutingFromDashboard()`**:

| Field | Source |
|-------|--------|
| `allSheetCount` | `ss.getSheets().length` |
| `existing` | count of core keys where `exists: true` |
| `coreCount` | `sheets.length` (= 6 currently) |
| `hasAnyAppSheet` | result of `workbookHasAnyAppSheet_(ss)` |
| `isBlankWorkbook` | final computed value |

Additional field **only for `probeProfileStatus_()`**:

| Field | Source |
|-------|--------|
| `profileStatus` | `'complete'` / `'missing'` |
| `profileNote` | the `note` string from the probe result |

---

## 4. Proposed diagnostic helper

**Name:** `debugLogStartup_(fields)`  
**Location:** add to `central_resolver.js` (already imported everywhere; no circular dep risk)  
**Removal:** delete the entire function and all call sites — one grep suffices

```javascript
// DIAGNOSTIC ONLY — remove before production
function debugLogStartup_(fields) {
  try {
    console.log('[STARTUP-DIAG] ' + JSON.stringify(fields));
  } catch (_e) {
    // never throw from a diagnostic helper
  }
}
```

**Why `console.log` and not `Logger.log`:**  
`console.log` output appears in the Executions log in the Apps Script editor and is
available in real time without needing the editor to be open. It also produces
structured JSON that is easy to grep across multiple concurrent runs.

---

## 5. Call-site instrumentation plan

Instrument ONLY the functions that are in the critical first-load path. Section loaders
(#8, #9, #10) are post-routing and can be added in a second pass if needed.

### 5.1 `getStartupRoutingFromDashboard()` — highest priority

Add two `debugLogStartup_()` calls:

**Call A** — immediately after `var ss = SpreadsheetApp.getActiveSpreadsheet();`:
```javascript
debugLogStartup_({
  fn: 'getStartupRoutingFromDashboard/ss',
  user: getCurrentUserEmail_(),
  ssId: ss ? ss.getId() : null,
  ssName: ss ? ss.getName() : null,
  ssSource: 'active',
  centralMode: isCentralModeEnabled_(),
  mappingExists: (function() {
    try {
      var e = getCurrentUserEmail_();
      return e ? lookupSpreadsheetIdForUser_(e) !== null : null;
    } catch (_) { return null; }
  })()
});
```

**Call B** — immediately before `return { ok: true, ... }`:
```javascript
debugLogStartup_({
  fn: 'getStartupRoutingFromDashboard/result',
  user: getCurrentUserEmail_(),
  ssId: ss ? ss.getId() : null,
  allSheetCount: ss ? ss.getSheets().length : null,
  existing: existing,
  coreCount: sheets.length,
  hasAnyAppSheet: hasAnyAppSheet,
  isBlankWorkbook: (sheets.length > 0 && existing === 0 && !hasAnyAppSheet)
});
```

### 5.2 `getOnboardingBootstrapStatusFromDashboard()`

Add one call immediately after `var ss = SpreadsheetApp.getActiveSpreadsheet();`:
```javascript
debugLogStartup_({
  fn: 'getOnboardingBootstrapStatusFromDashboard/ss',
  user: getCurrentUserEmail_(),
  ssId: ss ? ss.getId() : null,
  ssName: ss ? ss.getName() : null,
  ssSource: 'active'
});
```

### 5.3 `getOnboardingStatusFromDashboard()` (post-routing, if route = Setup/Review)

Add one call at the top of the function:
```javascript
debugLogStartup_({
  fn: 'getOnboardingStatusFromDashboard/ss',
  user: getCurrentUserEmail_(),
  ssId: ss ? ss.getId() : null,
  ssName: ss ? ss.getName() : null,
  ssSource: 'active'
});
```

### 5.4 `probeProfileStatus_()` (post-routing)

Add one call immediately before the `return` in each branch:
```javascript
debugLogStartup_({
  fn: 'probeProfileStatus_/result',
  user: getCurrentUserEmail_(),
  profileStatus: result.status,
  profileNote: result.note
});
```

---

## 6. Expected output — correct behavior

### 6.1 samertheodossy@gmail.com — bound deployment (CENTRAL_MODE=false)

```json
{"fn":"getStartupRoutingFromDashboard/ss","user":"samertheodossy@gmail.com","ssId":"<PRODUCTION_WB_ID>","ssName":"CashCompass","ssSource":"active","centralMode":false}
{"fn":"getOnboardingBootstrapStatusFromDashboard/ss","user":"samertheodossy@gmail.com","ssId":"<PRODUCTION_WB_ID>","ssSource":"active"}
{"fn":"getStartupRoutingFromDashboard/result","existing":5,"coreCount":6,"hasAnyAppSheet":true,"isBlankWorkbook":false}
```
→ Routes to Overview (isBlankWorkbook = false). ✓

### 6.2 samertheodossy@gmail.com — central deployment (CENTRAL_MODE=true) — desired

```json
{"fn":"getStartupRoutingFromDashboard/ss","user":"samertheodossy@gmail.com","ssId":"<CENTRAL_WB_ID>","ssName":"CashCompass — samertheodossy@gmail.com","ssSource":"resolver","centralMode":true}
{"fn":"getStartupRoutingFromDashboard/result","existing":1,"allSheetCount":2,"coreCount":6,"hasAnyAppSheet":true,"isBlankWorkbook":???}
```

The `isBlankWorkbook` value is the open question. After diagnostic, we will know:
- `allSheetCount` = 2 (Sheet1 + INPUT - Settings, assuming no setup done)
- `existing` = 1 (INPUT - Settings only)
- `hasAnyAppSheet` = true

If samertheodossy has done NO setup in their central workbook → Welcome is CORRECT.  
If they have done setup → `existing` > 1, `allSheetCount` > 2 → Overview is correct.

### 6.3 cashcompass2026@gmail.com — central deployment (CENTRAL_MODE=true) — desired

```json
{"fn":"getStartupRoutingFromDashboard/ss","user":"cashcompass2026@gmail.com","ssId":"<USER2_WB_ID>","ssName":"CashCompass — cashcompass2026@gmail.com","ssSource":"resolver","centralMode":true}
{"fn":"getStartupRoutingFromDashboard/result","existing":1,"allSheetCount":2,"coreCount":6,"hasAnyAppSheet":true,"isBlankWorkbook":true}
```
→ Routes to Setup/Review → Welcome. No developer data. ✓

### 6.4 Current broken output (CENTRAL_MODE=true, no fix applied)

```json
{"fn":"getStartupRoutingFromDashboard/ss","user":"cashcompass2026@gmail.com","ssId":"<PRODUCTION_WB_ID>","ssName":"CashCompass","ssSource":"active","centralMode":true}
```
→ Reading wrong workbook. Permission error may follow. ✗

```json
{"fn":"probeProfileStatus_/result","user":"cashcompass2026@gmail.com","profileStatus":"complete","profileNote":"Samer Theodossy · samertheodossy@gmail.com"}
```
→ Developer's profile leaking from bound workbook. ✗

---

## 7. Hypotheses to confirm via diagnostic

| # | Hypothesis | Confirmed by |
|---|-----------|--------------|
| H1 | All startup RPCs read `<PRODUCTION_WB_ID>` regardless of user when `CENTRAL_MODE=true` | ssId in all log lines |
| H2 | `isBlankWorkbook=false` for bound workbook (current), so routing to Overview is accidental | `existing` and `hasAnyAppSheet` in result log |
| H3 | Fresh central workbook has `allSheetCount=2`, `existing=1`, `hasAnyAppSheet=true` | result log after fix |
| H4 | `probeProfileStatus_` returns developer name/email for user2 | profileNote log |
| H5 | `getOnboardingUpcomingFromDashboard` and `getOnboardingHousesFromDashboard` read `<PRODUCTION_WB_ID>` | ssId in those log lines |

---

## 8. Correct `isBlankWorkbook` formula for central mode

Based on the code analysis (before diagnostic run), the correct central-mode blank test is:

```javascript
// Central-mode: workbook is "blank" iff it is in the minimal bootstrap state.
// Minimal bootstrap = exactly the sheets created by runMinimalBootstrap_:
//   - Sheet1 (default Google Sheets tab, always present)
//   - INPUT - Settings (added by ensureInputSettingsSheet_)
// Any setup action (bank accounts, debts, etc.) creates a third sheet.
// allSheetCount <= 2 is therefore a reliable minimal-bootstrap indicator.
var isBlankWorkbook = isCentral
  ? (allSheetCount <= 2)
  : (sheets.length > 0 && existing === 0 && !hasAnyAppSheet);
```

Where `allSheetCount = ss.getSheets().length`.

**Why `allSheetCount <= 2` is safer than `existing <= 1`:**

| Scenario | `existing` | `allSheetCount` | `existing <= 1` | `allSheetCount <= 2` |
|----------|-----------|-----------------|-----------------|----------------------|
| Fresh central workbook | 1 | 2 | true ✓ | true ✓ |
| Central workbook after adding bank accounts | 2 | 3+ | false ✓ | false ✓ |
| Central workbook (samer, no setup done) | 1 | 2 | true ← was wrong | true (Welcome is correct) |
| Central workbook (samer, has done setup) | 2+ | 3+ | false ✓ | false ✓ |

The `existing <= 1` formula was wrong because the user believed samertheodossy had done
setup in their central workbook; the diagnostic will clarify. If `allSheetCount = 2`
for samertheodossy's central workbook, Welcome is correct and the fix was right but
unexpected.

**The diagnostic must confirm `allSheetCount` for samertheodossy's central workbook**
before we decide whether "samertheodossy sees Welcome" is a bug or expected behavior.

---

## 9. Files that would need temporary logging

| File | Lines to instrument | Removal signal |
|------|---------------------|----------------|
| `central_resolver.js` | Add `debugLogStartup_()` helper | Delete entire function |
| `sheet_bootstrap.js` | 2 calls in `getStartupRoutingFromDashboard`, 1 in `getOnboardingBootstrapStatusFromDashboard` | Grep `debugLogStartup_` |
| `onboarding.js` | 1 call in `getOnboardingStatusFromDashboard` | Same grep |
| `profile.js` | 1 call in `probeProfileStatus_` | Same grep |

Total: 5 call sites + 1 helper. All removable with a single `grep -n debugLogStartup_`.

---

## 10. Safest test order

```
Phase 0 — Verify baseline (CENTRAL_MODE=false)
  1. Confirm CENTRAL_MODE=false in Script Properties.
  2. Open bound URL as samertheodossy.
  3. Confirm Executions log shows PRODUCTION_WB_ID in all log lines.
  4. Confirm isBlankWorkbook=false → Overview loads. ✓

Phase 1 — Central mode, developer account (CENTRAL_MODE=true)
  5. Set CENTRAL_MODE=true.
  6. Open central URL as samertheodossy in a normal window.
  7. Read Executions log.
  8. Record: ssId, allSheetCount, existing, hasAnyAppSheet, isBlankWorkbook.
  9. Confirm ssId = <CENTRAL_WB_ID> (not PRODUCTION_WB_ID). <- KEY CHECK
  10. If ssId = PRODUCTION_WB_ID → all startup functions still use getActiveSpreadsheet() ← confirms H1.

Phase 2 — Central mode, second user (CENTRAL_MODE=true)
  11. Open central URL as cashcompass2026 in a private window.
  12. Read Executions log (separate execution from Phase 1).
  13. Record: ssId, allSheetCount, existing, isBlankWorkbook.
  14. Confirm ssId = <USER2_WB_ID> (not PRODUCTION_WB_ID) ← KEY CHECK
  15. If probeProfileStatus_ log shows developer name → confirms H4 (data leak still present).

Phase 3 — Validate hypotheses and write fix
  16. Review diagnostic output.
  17. Confirm allSheetCount for both users.
  18. Confirm whether "Welcome for samertheodossy" is a bug or expected.
  19. Write targeted fix with exact formula values.
  20. Re-run diagnostic to verify.
  21. Remove all diagnostic logging.
  22. Final manual test of both users.
```

---

## 11. Recommended first manual test

**Before adding any diagnostic logging:** navigate to the Apps Script editor and run
`getCurrentUserEmail_()` and `lookupSpreadsheetIdForUser_(getCurrentUserEmail_())`
directly from the Run dialog. This is zero-risk and immediately confirms:

1. Whether the developer email is correctly resolved by the resolver
2. Whether a mapping exists for both test accounts
3. What the mapped spreadsheet IDs are

This takes 2 minutes and answers H1 and H3 before a single line of diagnostic code
is written.

---

## 12. Proposed next prompt (after diagnostic confirms hypotheses)

```
We are continuing CashCompass.

Confirmed diagnostic findings: [paste log output here]

Task: Fix central-mode startup routing using the confirmed values.

Changes allowed:
- sheet_bootstrap.js: getStartupRoutingFromDashboard — swap getActiveSpreadsheet()
  → getUserSpreadsheet_(), fix isBlankWorkbook formula to use allSheetCount <= 2
  for central mode
- sheet_bootstrap.js: getOnboardingBootstrapStatusFromDashboard — swap
  getActiveSpreadsheet() → getUserSpreadsheet_()
- onboarding.js: getOnboardingStatusFromDashboard — swap → getUserSpreadsheet_()
- profile.js: thread ss through probeProfileStatus_ → getProfileSettings →
  readAllSettingsMap_ → readProfileDobRawValues_ → ensureInputSettingsSheet_(ss)
- onboarding.js: getOnboardingUpcomingFromDashboard — swap → getUserSpreadsheet_()
- onboarding.js: getOnboardingHousesFromDashboard — swap → getUserSpreadsheet_()
- house_values.js: getHousesFromHouseValues_ — swap → getUserSpreadsheet_()

Do not change appsscript.json.
Do not change HTML.
Do not commit.
```

---

*Confirm no code changed. Confirm no commit performed.*
