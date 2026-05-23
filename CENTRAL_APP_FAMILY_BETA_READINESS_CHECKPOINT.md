# CENTRAL_APP_FAMILY_BETA_READINESS_CHECKPOINT.md

A synthesis checkpoint taken **after** the first blank-workbook runtime matrix, the House onboarding fix (`4e6af6d`, 2026-05-22), and the planner-page runtime closure (2026-05-23) that resolved the last remaining runtime unknown. The purpose of this doc is to make the next category decision deliberately — closing the Donations bootstrap gap or beginning true central-mode workbook creation + mapping — rather than reflexively picking up the next fix.

> **Update (2026-05-23): Option B is complete.** The §4.2 planner-page runtime unknown (Rolling Debt Payoff / Debt Payoff Projection) has been resolved by runtime evidence per `CENTRAL_APP_BLANK_WORKBOOK_RUNTIME_REPORT.md → §4A.12`. Both pages are now runtime-confirmed working on a blank workbook across three reachable states. The blank-workbook runtime matrix is effectively complete. The recommendation in §7 collapses to Option A first, then Option C. Historical Option B framing is preserved below.

**Documentation only.** No code change, no HTML change, no schema change, no deployment change. This checkpoint authorizes no work; it only records what we now know and frames the choice.

Cross-references:
- `CENTRAL_APP_BLANK_WORKBOOK_RUNTIME_REPORT.md` — the runtime test that produced the evidence behind every claim below.
- `CENTRAL_APP_BOOTSTRAP_COVERAGE_AUDIT.md` — the static audit it falsified and refined.
- `CENTRAL_APP_MINIMAL_BETA_PROOF.md` — the onboarding-first family beta direction this checkpoint feeds into.
- `CENTRAL_APP_FAMILY_BETA_PLAN.md` — the broader family beta plan (non-goals, scope, testing posture).
- `CENTRAL_APP_IMPLEMENTATION_PLAN.md` — the resolver-seam migration plan.
- `sheet_bootstrap.js` — the additive bootstrap registry that owns the six canonical core sheets.

---

## 1. Purpose

This doc is the checkpoint after the first blank-workbook runtime matrix and the House onboarding fix. Before the runtime test, the audit's static analysis classified blank-workbook readiness as "moderately strong with several confirmed gaps." After the runtime test and the §5.6 fix:

- One static-analysis miss was found and fixed (House onboarding ordering, commit `4e6af6d`).
- A second static-analysis miss was reclassified by runtime evidence rather than by code change (`HOUSES - <Name>` per-house tab is auto-created by `addHouseFromDashboard` step 4 via `createHousesExpenseSheet_`).
- The onboarding architecture is **stronger than the static audit suggested** — most surfaces lazy-bootstrap calmly without a developer ever touching the workbook.

The natural temptation is to pick up the next narrow fix (Donations) and ship it. That is one valid next step. But this checkpoint exists to compare it against two other candidate next steps before committing: running the remaining runtime checks, or beginning true central-mode workbook creation + mapping. The recommendation in §7 is informed by §2–§6; readers who only want the conclusion can jump to §7 and §8.

This checkpoint **does not** widen the family beta scope, **does not** authorize any new ensure helper, **does not** authorize any deployment change, and **does not** change any prior plan-of-record. It is reflection, not authorization.

---

## 2. What is now runtime-confirmed working

Each row below has been observed on a disposable blank workbook during the runtime test session that produced `CENTRAL_APP_BLANK_WORKBOOK_RUNTIME_REPORT.md`, or has been observed during the House retest after commit `4e6af6d`. Static-only "should work" rows are explicitly excluded from this list; they live in §11 of the audit and the runtime report's per-surface notes.

### 2.1 App launch and routing

- **First launch on a brand-new Google Sheet** — bound script project loads, OAuth consent surface completes, custom menu appears, dashboard opens against a workbook whose only tab is `Sheet1`. No red banner.
- **Startup routing** — `getStartupRoutingFromDashboard()` correctly classifies the blank workbook (`isBlankWorkbook: true`, `existingCoreSheetCount: 0`) and routes the user into Setup / Review instead of the main dashboard.
- **`INPUT - Settings` is created on first launch** by the existing onboarding chain so Profile is reachable.
- **`LOG - Activity` is created on first Overview load** by `ensureActivityLogSheet_` called from `buildDashboardSnapshot_`. No spurious "ensure-helper" activity entries surface.

### 2.2 Setup / Review (Welcome) surface

- **Welcome / Setup / Review renders** without throwing. The blank-workbook router lands the user here intentionally.
- **All Setup / Review handoffs that have ensure-before-write coverage work end-to-end:**
  - Bank Accounts — `addBankAccountFromDashboard` runs ensure before validate (already correct prior to this session).
  - Debts — `addDebtFromDashboard` ensures `INPUT - Debts` via the core bootstrap registry's eager seeding before reaching the validator (latent shape, not currently a regression — see §5).
  - Bills — `addBillFromDashboard` writes against the core-bootstrap-seeded `INPUT - Bills`.
  - Cash Flow — `quickAddPayment` lazy-creates `INPUT - Cash Flow <year>` via `ensureCashFlowYearSheet_`.
  - Upcoming Expenses — `addUpcomingExpense` lazy-creates `INPUT - Upcoming Expenses` via `getOrCreateUpcomingExpensesSheet_`.
  - Retirement — Scenario save lazy-creates `INPUT - Retirement` via `getOrCreateRetirementSheet_`.
  - Houses — Create house creates all three House sheets (see §2.5).

### 2.3 Six canonical core sheets

The bootstrap registry in `sheet_bootstrap.js` materializes the six core sheets — `INPUT - Settings`, `INPUT - Bank Accounts`, `INPUT - Debts`, `INPUT - Bills`, `INPUT - Cash Flow <currentYear>`, `INPUT - Upcoming Expenses` — when Setup / Review needs them. Runtime-confirmed during the test; sheets appeared in the expected order and remained present across page reloads. Existing populated workbooks are byte-for-byte unaffected (every helper is idempotent and additive).

### 2.4 Dashboard Overview partial / blank states

- **`notSetUp` envelope** on the very first Overview load (before any core sheet exists) — no red banner; Setup / Review CTA visible.
- **`partial` envelope** after a few core sheets exist but no Cash Flow / Bills data — no false-confidence "all clear" copy.
- **`ready` envelope** after enough inputs exist to compute snapshot — Operations Snapshot KPIs degrade calmly through `$0.00` / `—` placeholders where applicable.
- **Buffer Runway, Suggested Actions, and Issues** all correctly route to Setup / Review on blank workbooks instead of falsely confident copy (the V1 stabilization work; re-verified during this session).

### 2.5 Houses end-to-end (post-fix)

This is the surface that drove the fix in commit `4e6af6d` and the §5.2 reclassification.

Confirmed on the blank-workbook retest after the fix:
- Setup / Review → Houses → Open Houses editor lands on the Add form.
- **Property type dropdown is populated** with the canonical defaults `Primary Residence`, `Vacation Home`, `Rental`, `Other (custom)…` (the second blocker, fixed by adding `loadHouseSection()` to `onboardingOpenHousesPage`).
- **Create house succeeds** in one transaction. `validateNewHouseName_` runs after the ensure block, so the missing-sheet throw that originally failed §4.9.2 no longer occurs.
- **All three House sheets are created automatically:**
  - `INPUT - House Values` via `ensureInputHouseValuesSheet_`.
  - `SYS - House Assets` via `ensureSysHouseAssetsSheet_`.
  - `HOUSES - <Name>` via `createHousesExpenseSheet_` (step 4 of the Add House transaction, with rollback if the create throws). This last creator was always present in the codebase — the static audit had simply missed it.
- One `house_add` Activity Log entry written. No red banner. No partial / rolled-back state.
- **Houses → Add Expense** for the just-created house works because `HOUSES - <Name>` already exists from step 4. The Listing surface (`getHouseExpenseUiData`) surfaces the house in the picker.

### 2.6 Other surfaces with no observed blank-workbook failure

- **Activity Log page** renders with the events accumulated during the test, in order, with no spurious entries.
- **Property Performance** has an explicit blank-workbook short-circuit and renders a zeroed envelope without throwing.
- **Quick Add** — payee dropdown, type / flow source dropdowns, and the $0 / negative-rejection rules all behave as designed; no race conditions surfaced.
- **Bills Due** — empty calm state on a fresh workbook; recurring-fallback path correctly excludes inactive debts.
- **Purchase Simulator, Next Actions** — calm empty states on a fresh workbook; no red banners.
- **Rolling Debt Payoff** (added 2026-05-23) — explicit not-set-up envelope with calm setup-message card when `INPUT - Debts` or `SYS - Accounts` is missing; populated path renders with no red banner once data exists. Runtime-confirmed across three reachable blank-workbook states per `CENTRAL_APP_BLANK_WORKBOOK_RUNTIME_REPORT.md → §4A.12`.
- **Debt Payoff Projection** (added 2026-05-23) — calm zeroed envelope when prerequisites are missing; populated path renders with rough-payoff estimates and non-zero summary card once data exists. Cash Flow read is wrapped in `try` / `catch` so missing Cash Flow year sheets do not leak a banner. Runtime-confirmed across three reachable blank-workbook states per `CENTRAL_APP_BLANK_WORKBOOK_RUNTIME_REPORT.md → §4A.12`.

---

## 3. What was discovered and fixed

### 3.1 Pre-validation-before-ensure failure in `addHouseFromDashboard`

- **Observed in runtime test §4.9.2** — Setup / Review → Houses → Open Houses editor → Create house threw `Missing sheet (after retry+flush): INPUT - House Values`.
- **Root cause** — `addHouseFromDashboard` called `validateNewHouseName_(payload.houseName)` before its ensure-before-write block. `validateNewHouseName_` strictly read `INPUT - House Values` and threw on the missing sheet, aborting the function before the ensure helpers could run.
- **Why the static audit missed it** — the audit traced the explicit ensure-before-write block at lines 1539–1555 but did not trace the pre-validation read path on line 1489.

### 3.2 Empty Property type dropdown on the Setup / Review handoff

- **Observed during the retest of the §3.1 fix** — the validate-order fix unblocked Create house, but the form still rejected save with `Property type is required.`
- **Root cause** — `onboardingOpenHousesPage()` ran `enterSetupEditorMode(...)` and `setHousePanelMode('add')` but did **not** call `loadHouseSection()`. On a blank workbook the normal `initDashboard()` is skipped (the router goes straight to Setup / Review), so `populateHouseAddDatalists_` never ran and the `<select id="house_add_type">` retained only its static `— Select type —` placeholder option.
- **Why the static audit missed it** — the audit covered server-side ensure coverage, not the client-side first-run navigation chain. The same pattern was already in place for Bank Accounts (`onboardingOpenBankPage` calls `loadBankSection()`); Houses was simply missing the call.

### 3.3 Fix shipped — commit `4e6af6d` (2026-05-22)

Two changes, one commit, no schema / deployment / write-logic changes:

- **`house_values.js`** — `addHouseFromDashboard` now runs the ensure block (`ensureInputHouseValuesSheet_` → `ensureSysHouseAssetsSheet_` → `SpreadsheetApp.flush()`) **before** `validateNewHouseName_`. Ordering is ensure → validate → write, matching the convention `addBankAccountFromDashboard` already uses.
- **`Dashboard_Script_Onboarding.html`** — `onboardingOpenHousesPage` now calls `loadHouseSection()` after `enterSetupEditorMode(...)` so the Add-form Property type dropdown is populated on first-run navigation. Idempotent on populated workbooks.

Static recheck of every other Add path was performed as part of the fix: `addBankAccountFromDashboard` is SAFE; `addDebtFromDashboard` and `addInvestmentAccountFromDashboard` carry the **same latent pre-validation-before-ensure shape** but are not currently a runtime regression (see §5.2).

### 3.4 Retest result

- Blank workbook → Setup / Review → Houses → Open Houses editor → Create Test House: **PASS**.
- All three House sheets created (`INPUT - House Values`, `SYS - House Assets`, `HOUSES - Test House`).
- One `house_add` activity entry. No red banner.
- Per-house tab creation is from the existing `createHousesExpenseSheet_` — the audit's prior §5.2 "no canonical creator" claim was a static-analysis miss; runtime evidence reclassified it.
- Tracked in `CENTRAL_APP_BLANK_WORKBOOK_RUNTIME_REPORT.md → §4.9.2` retest row and `CENTRAL_APP_BOOTSTRAP_COVERAGE_AUDIT.md → §4.9 / §5.2` superseded annotations.

### 3.5 Static-analysis lessons recorded

Two distinct miss patterns surfaced in this session, both now documented in the audit's §11 summary:

1. **Cross-line ordering missed (§5.6).** The ensure block looked correct in isolation; the static trace did not check that nothing strict-reads the canonical sheet earlier in the same function.
2. **Cross-module creator call missed (§5.2).** The static trace stopped at `house_expenses.js` (which does not lazy-create) and missed the `createHousesExpenseSheet_` call inside the Add House transaction in `house_values.js`.

These are exactly the kind of finding runtime testing is supposed to produce. Both are now annotations in the audit, preserved verbatim above the corrected wording so future contributors see the lesson, not just the conclusion.

---

## 4. Remaining true onboarding blockers

A "blocker" here means: a first-time user on a blank workbook, following the documented Setup / Review path, would hit a red banner or be unable to complete the step. Optional / defense-in-depth / cosmetic items are listed in §5.

### 4.1 `INPUT - Donation` has no ensure helper — confirmed blocker

- **Surface:** Cash Flow → Donations.
- **Behavior:** `getDonationsSheet_()` (`donations.js:17`) throws `Missing sheet "INPUT - Donation". Add it to this spreadsheet with Year sections (see Help → Donations).` This surfaces as a red banner.
- **Why it is a blocker:** Donations is reachable from a top-level navigation surface that a first-run user will touch.
- **Recommended fix:** add `ensureInputDonationSheet_` in `donations.js`, register under a new key in `sheet_bootstrap.js`, and replace `getDonationsSheet_`'s throw with a lazy create. Year sections appear as the user adds rows; only the header row pattern needs seeding.
- **Severity:** medium — Donations is optional for most users, but the throw is loud and the help text leaks an internal sheet name (`INPUT - Donation`). Not life-or-death for the family beta proof, but the only remaining surface that produces a red banner on first run.

### 4.2 Rolling Debt Payoff / Debt Payoff Projection — ✅ **resolved (was the last runtime unknown)**

- **Status (2026-05-23):** ✅ runtime-confirmed working on a blank workbook. Both pages were verified across three reachable states (fully blank, partial Setup / Review, both prerequisites present) per `CENTRAL_APP_BLANK_WORKBOOK_RUNTIME_REPORT.md → §4A.3 / §4A.4 / §4A.5`. Closure record at `CENTRAL_APP_BLANK_WORKBOOK_RUNTIME_REPORT.md → §4A.12`. No code change required; the defensive guards in `rolling_debt_payoff.js:2862–2924` and `debt_payoff_projection.js:16–51` already cover every blank-workbook state. No red banner, no sheet writes from the page-open paths, no planner execution side-effect.
- **Severity reclassification:** unknown → **zero**. The static analysis hypothesis (calm empty state) was confirmed by runtime evidence.
- **Original wording (preserved verbatim):**
  - **Surface:** Planning → Rolling Debt Payoff, Planning → Debt Payoff Projection.
  - **Why this is here:** both modules read `INPUT - Debts` and Cash Flow year sheets. The bootstrap registry seeds `INPUT - Debts` eagerly, so behavior **should** be calm — but this has not been verified end-to-end on a fully blank workbook.
  - **Why it matters for the readiness call:** static analysis cannot prove these are safe (the audit explicitly marked them "Unknown / likely partial" at §5.3). The cheapest path to certainty is a runtime check, not a code change.
  - **Recommended action:** add `§4.15.1`, `§4.15.2`, `§4.16.1`, `§4.16.2` to the next runtime test pass and fill in the result column. If either surface throws, file as a new gap; otherwise mark as Works.
  - **Severity:** unknown — could be zero (calm empty state), could surface a red banner. The lifetime-runtime cost to find out is small (≤15 minutes on the existing blank workbook).
  - _Predicted outcome (above) was observed; result is Works._

### 4.3 Anything else?

No other confirmed blocker is currently known. All other surfaces enumerated in the runtime report fall into one of three buckets: runtime-confirmed working (§2 above), defense-in-depth / cosmetic (§5 below), or explicitly out of family beta scope (e.g. Bank Import per `CENTRAL_APP_FAMILY_BETA_PLAN.md → §3 Non-goals`).

---

## 5. Not blockers / separate tracks

Each item below is real but does **not** block the family beta proof and should not delay the central-mode work. They are kept here so they are not forgotten, not because they are urgent.

### 5.1 Generated `INPUT - House Values` / `SYS - House Assets` sheet formatting on first creation is unpolished

- **What it is:** functional but visually rough (header widths, alignment, banded styling).
- **Why it does not block:** downstream readers are unaffected; data round-trips correctly through `getHouseUiData`, `getHousesFromHouseValues_`, `getHouseAssetsHeaderMap_`. The user can use the workbook.
- **Track:** optional cosmetic Pass 2 (tighten default column widths / freeze row / banded styling inside `ensureInputHouseValuesSheet_` and `ensureSysHouseAssetsSheet_` first-create branches, guarded by `created === true` so populated workbooks stay byte-for-byte unchanged). Tracked as `CENTRAL_APP_BLANK_WORKBOOK_RUNTIME_REPORT.md → §6 row 4`.

### 5.2 Pre-validation-before-ensure shape in `addDebtFromDashboard` / `addInvestmentAccountFromDashboard`

- **What it is:** the same shape that caused §5.6. `validateNewDebtAccountName_` strictly reads `INPUT - Debts`; `validateNewInvestmentAccountName_` strictly reads `INPUT - Investments` / `SYS - Assets`. Both run before the in-function ensure block.
- **Why it does not block:** masked today by the bootstrap registry's eager seeding of `INPUT - Debts`, and by the typical user flow reaching Investments after Bank Accounts have lazy-created their canonical sheets. No current runtime regression.
- **Track:** optional defense-in-depth Pass 2 (mirror the Houses fix in `debts.js` and `investments.js`). Each is a one-file change with no schema or contract change. Tracked as `CENTRAL_APP_BLANK_WORKBOOK_RUNTIME_REPORT.md → §6 row 5`.

### 5.3 `addHouseExpense` does not lazy-create the per-house tab

- **What it is:** if a `SYS - House Assets` row exists for a house but `HOUSES - <Name>` does not (only reachable via hand-edits or a future import that bypasses `addHouseFromDashboard`), `addHouseExpense` throws.
- **Why it does not block:** not reachable via the normal Add House flow. The normal flow always creates `HOUSES - <Name>` as step 4 of `addHouseFromDashboard`.
- **Track:** optional defense-in-depth hardening (call the existing `createHousesExpenseSheet_` inside `addHouseExpense` when `ss.getSheetByName(payload.house)` is null). Tracked as `CENTRAL_APP_BLANK_WORKBOOK_RUNTIME_REPORT.md → §6 row 2` (reframed) and `CENTRAL_APP_BOOTSTRAP_COVERAGE_AUDIT.md → §5.2` residual concern.

### 5.4 Schema-version marker

- **What it is:** there is no `SYS - Version` sheet or equivalent recording which schema version a workbook was bootstrapped against.
- **Why it does not block:** the additive contract today means there is no schema drift to detect — every helper is idempotent and additive. Future schema migrations would need a marker, but none are currently planned in the family beta scope.
- **Track:** Decision Pending per `CENTRAL_APP_BOOTSTRAP_COVERAGE_AUDIT.md → §9.4`. Three candidate locations evaluated there; not blocking.

### 5.5 Performance / cold-start perception

- **What it is:** Apps Script web-app cold starts are slow. A first-time user on a blank workbook may see an empty Overview placeholder for several seconds before the snapshot fills in.
- **Why it does not block:** behavior is calm (no red banner); the underlying ensure helpers are bounded; subsequent loads are normal speed. Already observed during Phase 4 dashboard seam testing and traced to platform latency, not the seam.
- **Track:** monitor during family beta proof; revisit only if a beta tester reports it as a blocker.

### 5.6 UX wording polish

- **What it is:** the `UX_POLISH_AUDIT.md` and the three completed UX cleanup passes already shipped the highest-value wording changes. Residual items are minor.
- **Why it does not block:** none of the residual items leak internal sheet names or block any action.
- **Track:** ongoing as needed; not part of any Central App pass.

### 5.7 Bank Import

- **What it is:** the largest non-onboarding subsystem; explicitly out of family beta scope per `CENTRAL_APP_FAMILY_BETA_PLAN.md → §3 Non-goals`.
- **Why it does not block:** not on the first-run path. The pipeline lazy-creates its own SYS sheets on demand and does not affect the onboarding flow.
- **Track:** continues on its own roadmap; will not be enabled for family beta testers.

---

## 6. Family beta readiness assessment

### 6.1 Direct answer

**What blocks the family beta proof today (post-2026-05-23 closure of §4.2):**
1. The Donations bootstrap gap (§4.1) is the **only** confirmed red banner a first-run user can hit on the documented Setup / Review path. **Severity: medium.** Small additive ensure helper closes it.

There are **no remaining runtime unknowns** on the family beta first-run path. The §4.2 planner-page unknown was resolved on 2026-05-23 by runtime evidence per `CENTRAL_APP_BLANK_WORKBOOK_RUNTIME_REPORT.md → §4A.12` — both pages render calm zero-states on a blank workbook and require no code change.

**What does not block the family beta proof today:**
- Every surface that has shipped, lazy-bootstraps, or has been runtime-confirmed (§2).
- Every item in §5 (cosmetic, defense-in-depth, legacy, performance, polish, Bank Import).
- The previously-confirmed §5.6 House Values pre-validation gap (fixed in `4e6af6d`).
- The previously-confirmed §5.2 per-house tab gap (reclassified — `createHousesExpenseSheet_` already covers it, runtime-confirmed).
- The previously-unknown §4.2 planner-page surfaces (resolved by runtime evidence on 2026-05-23 — no code change needed).

**Is the onboarding architecture proven enough to move toward central-mode workbook creation + mapping?**

**Yes — broadly proven, with one narrow remaining gap.** The additive bootstrap chain (`ensureOnboardingCoreSheetsFromDashboard` for the six core sheets, plus per-domain lazy-create helpers for everything else, plus `createHousesExpenseSheet_` for per-house tabs, plus the per-module blank-workbook short-circuits on Rolling Debt Payoff and Debt Payoff Projection) is now demonstrated to materialize a complete, usable workbook from a blank `Sheet1`-only starting point **without manual developer intervention** on every surface in scope for the family beta first-run path — except for the Donations surface (§4.1), which is one small additive ensure helper away from closure.

Pre-runtime-test the qualifier was "yes, conditionally — with one open gap and one unknown." Post-runtime-test (2026-05-23) the qualifier is "yes — broadly proven, with one narrow remaining gap (§4.1 Donations)." The path forward is deterministic: close §4.1 with the additive Donations ensure helper, then begin central-mode planning (Option C) from a confirmed-zero-blocker baseline.

Compared to the pre-runtime-test belief that **three** confirmed gaps stood between us and a family beta proof, the post-runtime-test picture (now also incorporating the 2026-05-23 planner-page closure) is:
- Original confirmed gaps: 3 (§5.1, §5.2, §5.6).
- Now closed by code fix: 1 (§5.6, shipped in `4e6af6d`).
- Now reclassified, no fix needed: 1 (§5.2, reframed by runtime evidence).
- Now resolved by runtime evidence: 1 (§4.2 / audit §5.3, runtime-confirmed working 2026-05-23 — no code change required).
- Still open: 1 (§5.1 Donations).

That is the cheapest possible delta between "moderately strong" and "proven enough" — one small ensure helper.

### 6.4 Additive bootstrap contract validation (added 2026-05-23)

The 2026-05-23 planner-page runtime closure also validates the additive bootstrap contract at the level it most matters: **reading dashboard pages on a blank workbook does not trigger sheet creation, does not leak red banners, and does not invoke the planner.** Every surface in scope for the family beta first-run path now has an observed (or already-shipped-and-tested) calm zero-state. The dashboard's `notSetUp` / `partial` / `ready` semantics, combined with the per-domain ensure helpers, combined with the per-module blank-workbook short-circuits on the planner pages, materialize a complete usable workbook from zero sheets without manual developer intervention on every surface except Donations.

The contract holds.

### 6.2 Confidence in the onboarding contract

The additive contract (every helper is idempotent, no helper deletes or rewrites existing user data, every creator returns immediately if the sheet exists) was reviewed during the audit (§7.5) and again during the §5.6 fix's static recheck. No non-additive helper has surfaced on any onboarding path. The contract holds.

The two static-analysis misses surfaced by the runtime test (§3.5) were both **ordering / cross-module** issues, not contract violations. The contract itself is intact; future audits should explicitly trace pre-validation reads and cross-module creator calls, but the underlying behavior is sound.

### 6.3 What the runtime test changed about our belief

Before the runtime test, the audit estimated blank-workbook readiness as "moderately strong with three confirmed gaps and one unknown." After the runtime test (initial session 2026-05-22 + planner-page closure 2026-05-23):

- **Strength is higher than the audit suggested.** Most surfaces lazy-bootstrap calmly. The dashboard's `notSetUp` / `partial` / `ready` semantics, combined with the per-domain ensure helpers and the per-module blank-workbook short-circuits, materialize a usable workbook from zero sheets without a developer's intervention.
- **The shape of the remaining gaps is narrower.** Three confirmed gaps + one unknown became one open + one reclassified + one fixed + one runtime-confirmed. The remaining open gap (Donations) is small and additive.
- **The static-audit method itself has known blind spots.** Cross-line ordering and cross-module integration are not reliably caught by static trace. Runtime test is required for these — both to falsify incorrect "lazy-bootstraps" classifications (the §5.6 / §5.2 lesson) and to confirm correct defensive-short-circuit hypotheses (the §5.3 lesson). That lesson is recorded in the audit's §11.

The headline finding: **the onboarding architecture was already much closer to family-beta-ready than we believed, and the 2026-05-23 closure confirmed there are no remaining runtime unknowns.** The runtime test was cheap and high-value; the fixes that fell out of it were small and reversible; the remaining open work is one additive helper away.

---

## 7. Recommended next category

> **Update (2026-05-23): Option B is complete.** The §4.2 planner-page runtime unknown was resolved on 2026-05-23. The original three-option framing is preserved verbatim below for historical record; the active recommendation collapses to "Option A first, then Option C." See §7.5 for the revised recommendation.

Three candidate next steps, evaluated against (a) cost, (b) impact on the family beta readiness call, and (c) compounding effect on the remaining roadmap.

### 7.1 Option A — close the Donations bootstrap gap (`§5.1`)

- **Cost:** small. One ensure helper (`ensureInputDonationSheet_`), one bootstrap registry entry, one throw → lazy create swap in `getDonationsSheet_`. One Cursor prompt; one commit; matches the canonical creator pattern already used for `INPUT - Cash Flow <year>`.
- **Impact on the family beta readiness call:** closes the only remaining confirmed red-banner surface. After this, the family beta first-run path has zero confirmed blockers and the next deliberate step is Option C.
- **Compounding effect:** removes the last "before central-mode" prerequisite. Does not unlock any new architectural work on its own, but it converts the readiness call from "broadly proven, with one narrow remaining gap" to "fully proven, no remaining gaps."
- **Risk:** very low. Strictly additive. Reversible. No schema change.

### 7.2 Option B — run the remaining runtime checks for Rolling Debt Payoff / Debt Payoff Projection (`§4.2`) — ✅ **complete (2026-05-23)**

- **Status:** ✅ done. The runtime checks were executed against a disposable blank workbook on 2026-05-23 per `CENTRAL_APP_BLANK_WORKBOOK_RUNTIME_REPORT.md → §4A.12`. Both surfaces resolved PASS across all three reachable states. No code change required; both pages render calm zero-states. The §4A addendum predicted the most-likely outcome ("both surfaces are calm"); that prediction was confirmed.
- **Original framing (preserved verbatim):**
  - **Cost:** minimal. The disposable blank workbook from the previous session can be reused (or recreated cheaply). Add four rows to the runtime test matrix (§4.15.1, §4.15.2, §4.16.1, §4.16.2) and fill in observations. Estimated 15 minutes of clicks + 15 minutes of doc updates.
  - **Impact on the family beta readiness call:** resolves the only remaining runtime unknown. Either both surfaces are calm (most likely), in which case the readiness picture is "Donations only" and the path to family beta clarifies; or one surfaces a new gap, in which case the gap list grows by one before any central-mode work begins.
  - **Compounding effect:** in either outcome, the readiness call becomes deterministic instead of conditional. This unlocks a confident decision about whether to begin central-mode work or close one more gap first.
  - **Risk:** none — it is observation-only.
- **Actual outcome:** the predicted "both surfaces are calm" outcome was observed. The readiness picture is now "Donations only" as predicted; the path to family beta is correspondingly clarified.

### 7.3 Option C — begin planning true central-mode workbook creation + mapping

- **Cost:** large. Per `CENTRAL_APP_MINIMAL_BETA_PROOF.md → §6`, this means Drive API workbook creation, per-user mapping store via `PropertiesService.getUserProperties()`, deployment posture change (`executeAs: USER_ACCESSING`, OAuth Drive scope), first-run UX surfaces, recovery surfaces, rollback procedure. Each is its own Cursor prompt; the chain is multi-week, not single-session.
- **Impact on the family beta readiness call (revised 2026-05-23):** this is the actual family beta proof work. After Option B's closure (done) and Option A's closure (recommended next), the onboarding architecture will have zero confirmed blockers, and the presupposition that Option C requires ("the onboarding architecture is proven enough to support a hands-off first-run") will hold without qualification. Starting Option C from a confirmed zero-blocker baseline is strictly safer than starting it from a "broadly proven, with one narrow remaining gap" baseline.
- **Compounding effect:** unblocks every downstream Central App phase (resolver migration of write paths, deployment posture spike, family beta proof itself). After Option A ships, premature-start risk collapses to near-zero.
- **Risk:** moderate. The risk is rework / context switching, not data loss — the additive contract still holds, and any central-mode work continues to run against a developer-owned workbook until the family beta is explicitly turned on.
- **Original framing (preserved verbatim):** "this is the actual family beta proof work, but it presupposes the onboarding architecture is proven enough to support a hands-off first-run. With one open gap (Donations) and one runtime unknown, that presupposition is 'conditionally yes.' Starting central-mode planning here is defensible — but riskier than closing the cheap remaining items first." — The runtime unknown is now resolved; the "conditionally yes" qualifier has been removed for everything except the Donations surface.

### 7.4 Recommendation (original — superseded 2026-05-23)

> **Superseded by §7.5.** The original recommendation called for Option B → A → C in that order. Option B is now complete (2026-05-23). The original wording is preserved below.

**Run Option B first, then Option A, then Option C — in that order, ideally in a single session.**

Rationale:
- **Option B is observation-only.** The cost is minutes, the information is high-value (it removes the last runtime unknown), and it makes the subsequent decisions deterministic. There is no scenario in which doing this first is wrong.
- **Option A is the smallest additive fix on the roadmap.** Closing it after Option B confirms either (a) it is the only remaining gap (likely), or (b) the planner runtime check found a second one and they can be queued together. Either way, the central-mode work that follows starts from a confirmed zero-blocker baseline rather than a conditional one.
- **Option C should follow B + A, not precede them.** The central-mode planning work is large enough that starting it with one open gap (Donations) and one unknown (planner) creates compounding interruption risk. Closing both first costs ~30 minutes and ~1 commit; deferring them costs a context switch in the middle of a multi-week effort.

The pragmatic next session: a single Cursor session that (1) extends the runtime test matrix to cover the two planner surfaces, (2) reports findings, (3) if the result is calm, queues the Donations ensure helper as the next narrow implementation prompt, (4) updates `CENTRAL_APP_BOOTSTRAP_COVERAGE_AUDIT.md` and the runtime report once Donations ships, and (5) explicitly transitions to central-mode planning per `CENTRAL_APP_MINIMAL_BETA_PROOF.md → §6` with a clean baseline.

**If forced to pick exactly one of A / B / C as the very next category, pick B** — it is the cheapest, lowest-risk, most-information-per-minute step on the board, and it is the only step that strictly precedes the others.

### 7.5 Recommendation (active, 2026-05-23)

With Option B complete and step (1)–(2) of the §7.4 pragmatic next session already done, the active recommendation collapses to two steps:

**Run Option A first, then Option C.**

Rationale:
- **Option A is the smallest additive fix remaining on the roadmap and the last confirmed onboarding blocker.** One ensure helper (`ensureInputDonationSheet_`), one bootstrap registry entry, one throw → lazy create swap in `getDonationsSheet_`. Strictly additive, reversible, no schema change. After Option A ships, the family beta first-run path has zero confirmed blockers.
- **Option C is the actual family beta proof work** and now starts from a confirmed-zero-blocker baseline. Beginning central-mode planning at this point is strictly less risky than beginning it before Option A — the Donations gap would be exactly the kind of mid-implementation context switch the original §7.4 framing warned against.
- **Both options share a single pragmatic next session:** (1) close Donations as a narrow Cursor prompt, (2) update the audit and runtime report to mark §5.1 resolved, (3) transition explicitly to central-mode planning per `CENTRAL_APP_MINIMAL_BETA_PROOF.md → §6`.

**If forced to pick exactly one of A / C as the very next category, pick A** — it is now the cheapest, lowest-risk, smallest-additive step on the board, and it is the only confirmed blocker between the current state and the central-mode work.

---

## 8. Guardrails

This checkpoint and any work that follows it must hold the following lines. None of these are new — they are restated here so the readiness picture above cannot be misread as an invitation to shortcuts.

- **Full GA-direction only.** No "hardcoded one-user mapping," no "internal platform shortcut," no developer-curated mapping table. The retracted Approach A in `CENTRAL_APP_MINIMAL_BETA_PROOF.md → §5` stays retracted; the onboarding-first approach in `§5.bis` / `§6` is the path of record.
- **No manual developer-created family workbook.** The whole point of the runtime test, the §5.6 fix, the §5.2 reclassification, and the §5.1 Donations work that follows is that a beta tester ends up with a workbook they own, created without the developer ever opening or pre-populating it.
- **No copied code.** The script project is a single source of truth; every beta user runs the same deployed code with their own bound or central-mode workbook. No per-user forks; no per-user manual installs.
- **No public launch yet.** Family beta means the developer's family. Wider beta requires the deployment-posture spike, the per-user mapping store, the recovery / rollback surfaces, and explicit policy / privacy review — none of which are in scope today.
- **No monetization yet.** Explicit non-goal per `CENTRAL_APP_FAMILY_BETA_PLAN.md → §3`. Plan gating, billing, marketplace listing, GA onboarding, admin portal — all deferred.
- **No new ensure helper invented beyond what the audit / runtime test identifies.** The remaining work (Donations, optional defense-in-depth, optional cosmetic) is exactly what the docs name. Anything beyond that is its own design pass, not a quiet expansion.
- **Bound-mode parity preserved.** Every change so far — the §5.6 fix, the docs corrections — has held bound-mode behavior byte-for-byte unchanged on the developer's populated workbook. Future changes hold the same line until central mode is explicitly turned on.

---

## 9. Sign-off

This checkpoint is documentation-only and authorizes no implementation. The next implementation prompt — Option B, Option A, or Option C above — must be its own explicit Cursor session with explicit user approval.

End of document.
