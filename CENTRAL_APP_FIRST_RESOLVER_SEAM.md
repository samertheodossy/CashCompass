# CENTRAL_APP_FIRST_RESOLVER_SEAM.md

Design analysis for the **first** Central App resolver introduction. Analysis only. No code changes, no HTML/JS changes, no deployment changes, no implementation.

This document is the bridge between the audit (`CENTRAL_APP_DEPENDENCY_AUDIT.md`) and the eventual first implementation prompt. Its purpose is to make the smallest possible first step concrete enough to execute confidently — and reversible enough to abandon at the first sign of trouble.

Cross-references:
- `CENTRAL_APP_DESIGN.md` — overall migration architecture.
- `CENTRAL_APP_DEPLOYMENT_OPTIONS.md` — preferred deployment direction (Option B, Execute as user).
- `CENTRAL_APP_ONBOARDING_AND_LIFECYCLE.md` — lifecycle contract and backward compatibility rule.
- `CENTRAL_APP_IMPLEMENTATION_PLAN.md` — staged roadmap and implementation gate.
- `CENTRAL_APP_FAMILY_BETA_PLAN.md` — family beta scope.
- `CENTRAL_APP_DEPENDENCY_AUDIT.md` — call-site inventory and risk classification.

---

## 1. Proposed resolver function name

**Proposed name:** `getUserSpreadsheet_()`

Naming rationale:

- It already appears as the candidate name throughout `CENTRAL_APP_DESIGN.md` and `CENTRAL_APP_IMPLEMENTATION_PLAN.md`, so adopting it keeps the docs and the code aligned without needing a follow-up rename.
- The trailing underscore matches the codebase convention for private helpers (e.g. `getSheet_`, `getInactiveBankAccountsSet_`, `ensureSysAccountsSheet_`).
- The name is honest about its eventual role: in the future it resolves *the calling user's* spreadsheet. In its first incarnation it resolves the active spreadsheet — which, in bound mode, is the same workbook for the same user. The name does not need to change between phases; only its body does.
- Alternative names considered and rejected:
  - `getActiveSpreadsheet_()` — too close to the platform API; obscures the migration intent and makes future grep harder.
  - `getWorkbook_()` — short, but loses the user-binding signal that matters for Phase 2+.
  - `resolveSpreadsheet_()` — verb-first, but the codebase prefers noun-first getters.

The function takes **no arguments** in its first incarnation. Whether a future signature should accept an optional test override is recorded as Decision Pending in §10.

---

## 2. Proposed resolver location/file

**Proposed location:** new file at the repo root — `central_resolver.js`.

Rationale for a new file (vs adding to `config.js`):

- `config.js` is already overloaded with sheet-name constants (`getSheetNames_`) and the universal sheet opener (`getSheet_`). Adding spreadsheet-identity resolution to it conflates two different concerns: sheet-name configuration and workbook-identity resolution.
- A dedicated file makes the migration self-contained: when Phase 2+ adds Central-mode behavior (PropertiesService lookup, `openById`, error handling, user-mapping concerns), all of that logic lands in one file rather than bloating `config.js`.
- The audit (`§10`, "Resolver location") records this choice as Decision Pending. The recommendation here is `central_resolver.js`; the design accepts that the implementation prompt may override this with `config.js` if the user prefers minimum file-count churn.
- The new file would also be the natural home, in later phases, for a `getCurrentUserEmail_()` helper that consolidates the three `Session.getActiveUser()` call sites flagged in the audit.

Rationale against placing it inside `cash_to_use.js`:

- The resolver must be globally available (every module will eventually call it). Putting it inside the consumer file makes the abstraction look local when it is in fact platform-wide.

---

## 3. Proposed initial behavior

The resolver, in its first incarnation, does one thing: it returns the same `Spreadsheet` object that `SpreadsheetApp.getActiveSpreadsheet()` would return.

In pseudocode (descriptive only, not production code):

```
getUserSpreadsheet_():
    return SpreadsheetApp.getActiveSpreadsheet()
```

That is the entire body. There is:

- No `PropertiesService` lookup.
- No `openById`.
- No identity/email resolution.
- No `LockService`.
- No caching layer.
- No mode switch (bound vs central).
- No fallback or recovery logic.
- No logging.
- No throw.

The function is a one-liner pass-through. Its only purpose at this stage is to **exist** so that downstream call sites can reach it instead of reaching `SpreadsheetApp` directly.

---

## 4. Why initial behavior should still return the active spreadsheet

The single most important constraint of the migration (per `CENTRAL_APP_DESIGN.md → §6` and `CENTRAL_APP_ONBOARDING_AND_LIFECYCLE.md`) is **backward compatibility byte-for-byte**. Every dashboard load, every Cash Flow write, every Bills Due banner, every Activity entry must produce the same output before and after the seam is introduced.

There is exactly one way to guarantee that: the resolver, in its first version, returns the same object the platform call returns. If the body is `return SpreadsheetApp.getActiveSpreadsheet();`, then any caller that previously called `SpreadsheetApp.getActiveSpreadsheet()` directly will receive an identical handle. Reads, writes, range references, sheet lookups, and stale-handle retries all behave identically.

This matters specifically because:

- `getSheet_` (config.js:26) accepts the `ss` it is given. If the `ss` from the resolver is the same `ss` it used to receive, `getSheet_` is unaffected. No need to touch `getSheet_`.
- `getSheet_` *also* contains its own stale-handle retry that calls `SpreadsheetApp.getActiveSpreadsheet()` directly (config.js:52). That call is **not** going through the resolver in the first phase, and that is correct: the retry is a platform-level diagnostic, and routing it through the resolver in Phase 1 would risk circular semantics. In bound mode the two calls return the same workbook, so the retry path is identical.
- Every helper that today receives `ss` from its caller will receive the same handle from the same caller, just via the resolver. There is no observable difference in the call graph.

If the resolver did *anything else* — even something defensive, like caching the result, wrapping it in a try/catch, or normalizing the return on error — it would introduce a divergence from the baseline and violate the "byte-for-byte" rule. The first version must be deliberately, almost stupidly, simple.

The point of Phase 1 is not to add behavior. The point is to add a **place** where behavior can later live.

---

## 5. Why this preserves backward compatibility

The seam is backward compatible in the strongest possible sense: the only observable change to the running app is that one named function exists where it did not before. The seam preserves backward compatibility along four orthogonal axes:

1. **Return value identity.** `getUserSpreadsheet_()` returns the same `Spreadsheet` object that `SpreadsheetApp.getActiveSpreadsheet()` would return. Any code that compares `ss` handles, holds references across helper calls, or depends on the platform's stale-handle behavior continues to work without change.
2. **Call graph shape.** Only one call site is migrated (`cash_to_use.js:77`). All other modules continue to call `SpreadsheetApp.getActiveSpreadsheet()` exactly as they do today. The shape of the call graph is unchanged everywhere except one line.
3. **Deployment posture.** No `appsscript.json` changes. No new OAuth scopes. No web-app redeploy required. Existing bound deployments continue to serve.
4. **Schema and data.** No sheet is created, deleted, or modified. No `PropertiesService` keys are read or written. No new rows are appended to any sheet. The seam is invisible to the data layer.

The seam also preserves backward compatibility in the operational sense defined by `CENTRAL_APP_ONBOARDING_AND_LIFECYCLE.md`: the bound-workbook user opens the workbook on day N+1 and sees exactly what they saw on day N. No banner, no migration prompt, no schema upgrade, no behavior change. The seam is invisible to the user.

This is the entire point of doing it this way. Later phases will introduce real behavior. Phase 1's job is to prove that the seam itself is invisible.

---

## 6. Why `getCashToUse()` is the safest first migration target

The audit (`CENTRAL_APP_DEPENDENCY_AUDIT.md → §7`) already nominated `getCashToUse()` as the recommended first seam. This section unpacks the safety properties that make it the right pick.

- **Single call site.** Exactly one line (`cash_to_use.js:77`) is touched. The smaller the diff, the smaller the surface area for a regression.
- **Read-only.** `getCashToUse()` does not write to any cell. The worst-case failure mode is "returns a wrong number" — not "corrupts a year-block in `INPUT - Bank Accounts`." This is the most important single property of a safe first seam.
- **Pre-hardened against missing data.** The function already tolerates a malformed or absent SYS - Accounts sheet by returning an empty result (cash_to_use.js:94–95) and a missing inactive set by treating everything as active (cash_to_use.js:103–104). Even if the resolver were to misbehave catastrophically (it cannot in Phase 1, but conceptually), the function's existing guards degrade gracefully.
- **Returns a `state` field on the snapshot side.** The dashboard's consumer of `getCashToUse()` knows how to render a `notSetUp` state cleanly without a red banner. This is a documented hardening from `SESSION_NOTES.md` (Phase A3).
- **High traffic.** The function is invoked on every dashboard load via `buildDashboardSnapshot_()`. That means real-traffic exercise of the resolver begins on the first save-and-reload after the seam lands, with no synthetic testing required to validate it.
- **No coupling to writes.** `getCashToUse()` does not feed Cash Flow, Activity, Bills Due, Planner OUT - History, or any other write surface. A regression here cannot cascade into write paths.
- **No coupling to identity.** `getCashToUse()` does not call `Session.getActiveUser()` or `Session.getEffectiveUser()`. The seam does not interact with the identity layer, which is correct for Phase 1 (identity routing is a Phase 2+ concern).
- **One-line reversibility.** Restoring the original `const ss = SpreadsheetApp.getActiveSpreadsheet();` is a one-line change. The blast radius of the rollback equals the blast radius of the change.

By contrast, the alternates considered in the audit (`buildDashboardSnapshot_()`, `getQuickAddPaymentUiData()`) exercise the resolver against broader pipelines. They are acceptable second targets, but `getCashToUse()` minimizes blast radius first.

---

## 7. Exact expected code touch surface

This is the full, exact list of expected changes for the Phase 1 implementation. Anything outside this list is out of scope for Phase 1.

### Files created
- **`central_resolver.js`** (new file at repo root).
  - Contains exactly one function: `getUserSpreadsheet_()`.
  - The body is a one-line pass-through to `SpreadsheetApp.getActiveSpreadsheet()`.
  - Optional: a short top-of-file comment describing the contract and the intentionally narrow scope ("Phase 1: bound-mode pass-through. Do not extend without an explicit migration prompt.").

### Files modified
- **`cash_to_use.js`**.
  - Exactly one line changed.
  - Line 77 changes from `const ss = SpreadsheetApp.getActiveSpreadsheet();` to `const ss = getUserSpreadsheet_();`.
  - No other change to `cash_to_use.js`.

### Files not modified
- `config.js` — `getSheet_` is unaffected. Its internal stale-handle retry at line 52 continues to call `SpreadsheetApp.getActiveSpreadsheet()` directly, by design.
- Every other `.js` file — unchanged. The audit shows ~135 production call sites of `SpreadsheetApp.getActiveSpreadsheet()`. After Phase 1, 134 remain unchanged.
- Every `.html` file — unchanged. The seam is server-side only.
- `appsscript.json` — unchanged. No new scopes, no deployment posture change.

### Files possibly touched for documentation
- `SESSION_NOTES.md` — one new "Current State" bullet noting the seam landed and the regression baseline matched.
- `PROJECT_CONTEXT.md` — possibly a single bullet under file index for `central_resolver.js`.
- These doc touches are part of the regular update-docs discipline, not part of the seam itself.

### Total
- **1 new file** (`central_resolver.js`, ~10 lines including comments).
- **1 modified file** (`cash_to_use.js`, 1 line changed).
- **0 deployment changes.**
- **0 HTML changes.**
- **0 schema changes.**

---

## 8. Regression risks

The regression surface for Phase 1 is small but worth enumerating explicitly so the implementation pass can verify each item against the pre-change baseline.

### Negligible-risk items (the seam essentially cannot break these)
- **Bound mode return-value identity.** `SpreadsheetApp.getActiveSpreadsheet()` is documented to return the workbook hosting the script. Calling it from inside a one-liner returns the same object. There is no execution path where the resolver's first version returns something different.
- **`getSheet_` behavior.** `getSheet_(ss, key)` operates on whatever `ss` it receives. The `ss` it receives in Phase 1 is identical to the `ss` it received before Phase 1.
- **Stale-handle retry.** The retry in `getSheet_` is not routed through the resolver, by design. It continues to call `SpreadsheetApp.getActiveSpreadsheet()` directly. No change to retry semantics.

### Low-risk items (worth verifying once)
- **Caller observability.** `getCashToUse()`'s return shape (`cashToUse` numeric, `accounts` array, optional `included`/`excludedReason` fields) is consumed by the dashboard snapshot. Verify the returned shape and values match the pre-change baseline on a populated workbook.
- **Blank-workbook posture.** On an empty workbook with no SYS - Accounts sheet, the function already returns an empty result. Verify the same empty result still comes back after the seam lands. (The `notSetUp` state surfaced by the snapshot should remain stable.)
- **Header-map failure path.** When `getAccountsHeaderMap_` throws, the function logs and returns `{cashToUse: 0, accounts: []}`. This path does not touch the resolver. Verify it still returns the same shape.
- **Hot-load behavior.** `getCashToUse()` is on the snapshot hot path. Verify a typical dashboard load on a populated workbook does not show measurably different latency. The expectation is "no change" — the resolver adds one function call frame, which is below any reasonable noise floor.

### Zero-impact items (explicitly out of scope, listed for completeness)
- Cash Flow writes: not touched.
- Bills Due / Bills CRUD: not touched.
- Quick Add Payment: not touched.
- Planner OUT - History: not touched.
- Activity Log: not touched.
- Bank Import: not touched.
- Onboarding: not touched.
- Investments / House Values / Bank Accounts manual updates: not touched.

### Risks that are *not* introduced by Phase 1 (recorded so they can be addressed in later phases)
- The 134 other call sites of `SpreadsheetApp.getActiveSpreadsheet()` are *not* affected by Phase 1. They remain as they are. The migration is staged precisely so that any future phase can affect them one at a time.
- `Session.getActiveUser()` is *not* called by Phase 1. Identity routing is deferred to a later phase per `CENTRAL_APP_IMPLEMENTATION_PLAN.md`.
- `executeAs` deployment posture is *not* changed. Phase 1 ships under whatever execution mode is currently deployed.

---

## 9. Rollback simplicity

The seam is reversible by the same diff that introduced it.

### Forward direction (implementation)
1. Add `central_resolver.js` (one function).
2. Change one line in `cash_to_use.js`.

### Reverse direction (rollback)
1. Revert the single line in `cash_to_use.js` back to `const ss = SpreadsheetApp.getActiveSpreadsheet();`.
2. Optionally delete `central_resolver.js`. (Leaving the file in place is also safe; the function exists but is no longer called. Deleting is cleaner; both options are acceptable.)

That's it. There is no schema to migrate back. There are no rows to delete. There are no `PropertiesService` keys to clear. There are no users to notify.

Rollback methods, in increasing order of severity:

- **Soft rollback (preferred):** `git revert` the implementation commit. One commit, two files, clean revert.
- **Manual rollback:** edit `cash_to_use.js:77` back to the platform call. Take 30 seconds.
- **Emergency rollback:** redeploy the prior Apps Script version from the deployment history. Apps Script keeps versions; restoring to the version immediately before the seam landed undoes the change without touching source control.

In all three cases the running app returns to the exact pre-seam state. There is no transitional state where the workbook is "half-migrated."

This reversibility is the primary safety property of Phase 1. The seam can be tried, observed, and abandoned without any cleanup obligation.

---

## 10. Future expansion path toward Central App mode

Phase 1 introduces an empty seam. Each subsequent phase adds behavior **inside** the resolver, not outside it. This section sketches the expansion path so the Phase 1 design can be reviewed in context — it is not a commitment to execute these phases.

### Phase 2 — Migrate additional read-only modules through the seam
Per `CENTRAL_APP_IMPLEMENTATION_PLAN.md`, the second phase swaps additional read-only entry points to use `getUserSpreadsheet_()`. Candidates include `buildDashboardSnapshot_()`, `getQuickAddPaymentUiData()`, `getDebtPaymentBreakdownForDashboard()`, and other dashboard-snapshot read paths. The resolver body still returns the active spreadsheet. The migration is purely about increasing seam coverage.

### Phase 3 — Migrate write paths through the seam
After read paths are stable, the seam extends to write paths: `quick_add_payment.js`, `bills.js`, `bank_accounts.js`, `investments.js`, `house_values.js`, `debts.js`, `planner_output.js`. Each module migrates as a separate, reviewed pass. The resolver body still returns the active spreadsheet.

### Phase 4 — Migrate ensure-\* and onboarding paths
The ensure-* helpers identified in the audit (`§4`) either acquire `ss` via the resolver or have their signatures extended to accept an optional `ss`. Onboarding paths in `onboarding.js` and `sheet_bootstrap.js` migrate after the steady-state surfaces.

### Phase 5 — Introduce identity helper
A `getCurrentUserEmail_()` helper consolidates the three `Session.getActiveUser()` call sites flagged in the audit. The resolver body still returns the active spreadsheet; identity is queried but not yet used to vary the workbook.

### Phase 6 — Introduce PropertiesService-backed mapping
The resolver body changes for the first time. It consults `PropertiesService.getUserProperties()` for a stored spreadsheet ID. If found, it opens that workbook via `openById`. If not found, it falls back to `getActiveSpreadsheet()` to preserve bound-mode behavior. The fallback is the bridge between modes; bound-mode users continue to work exactly as before.

### Phase 7 — Onboarding and bootstrap
First-run users get a workbook provisioned and stored in their `UserProperties`. This phase only affects new users; existing bound-mode users continue to be served by the fallback in Phase 6.

### Phase 8 — Switch deployment to Option B (Execute as user)
Per `CENTRAL_APP_DEPLOYMENT_OPTIONS.md`, the preferred posture is `executeAs: USER_ACCESSING`. The deployment switch is the final step that converts the app from a bound deployment into a true central web app. It is gated on every prior phase being stable.

### Phase 9 and beyond — Monetization, feature gating, multi-user operations
Per `CENTRAL_APP_DESIGN.md → §9` and `CENTRAL_APP_FAMILY_BETA_PLAN.md`, post-launch concerns: SYS - Users sheet, feature flags, plan tiers, beta cohort management. None of these are in scope for the resolver itself; they live in the modules that consume the resolver.

### Why the expansion path validates the Phase 1 design

The fact that Phase 1's resolver body — `return SpreadsheetApp.getActiveSpreadsheet();` — survives unchanged through Phase 5 (five future phases) confirms the seam is in the right place. The seam exists precisely to make Phase 6's body change a one-function edit. Without the seam, Phase 6 would have to touch every one of the 135 call sites simultaneously. With the seam, it touches one.

That is the asymmetry the seam is designed to capture.

---

## Decision Pending items (Phase 1 specific)

These are open questions that the eventual implementation prompt must resolve before Phase 1 is authorized.

- **Resolver name.** `getUserSpreadsheet_()` is recommended (§1). The implementation prompt may override with another name; if so, the design docs must be updated for consistency.
- **Resolver location.** `central_resolver.js` is recommended (§2). Alternative: appending to `config.js`. Either is acceptable; both are reversible.
- **First migrated function.** `getCashToUse()` is recommended (§6). Alternative: `buildDashboardSnapshot_()` for broader exercise. Either is acceptable; both are reversible.
- **Test-mode override.** Whether `getUserSpreadsheet_()` should accept an optional `Spreadsheet` override for unit-test scaffolding. Recommendation: **no** in Phase 1; add later if Phase 5+ needs it. Test-mode wiring is its own design problem and should not blur Phase 1's invariant.
- **Baseline capture.** Whether the pre-change baseline is captured as written notes, screenshots, or a structured JSON snapshot of `buildDashboardSnapshot_()`. Recommendation: structured snapshot if it is cheap to produce; written notes are acceptable for Phase 1 given the resolver's pass-through nature.
- **Doc update scope.** Whether `SESSION_NOTES.md` and `PROJECT_CONTEXT.md` are touched in the same implementation pass as the seam, or in a follow-up pass. Recommendation: same pass — one DONE entry, one Current State bullet, one file-index note.

---

End of document.
