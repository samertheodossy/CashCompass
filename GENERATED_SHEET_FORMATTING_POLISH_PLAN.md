# GENERATED_SHEET_FORMATTING_POLISH_PLAN.md

> **Superseded (2026-07-06) for framing/status by the Golden Workbook initiative.** The visual source of truth is now the production workbook ("the Golden Workbook") — see **`GOLDEN_WORKBOOK.md`** and the per-sheet **`WORKBOOK_PARITY_CHECKLIST.md`**. Parts of this doc are stale (e.g., it states Bank Accounts / Debts / Bills have "no styling helper" — they now do). This doc is retained for its additive-implementation strategy (§6) and non-goals (§5); use the checklist for current per-sheet status and the **Golden Workbook Audit** as the first task before any styling code changes.

A dedicated tracking doc for the generated-sheet formatting / readability polish workstream that fell out of the blank-workbook onboarding runtime test. Onboarding correctness is now broadly proven (see `CENTRAL_APP_FAMILY_BETA_READINESS_CHECKPOINT.md`); the remaining first-create rough edges are cosmetic / UX concerns, not onboarding blockers, and deserve their own scoped surface so they do not get smuggled into onboarding, schema, or central-app prompts.

**Documentation only.** No Apps Script code change, no HTML change, no schema change, no formula change, no deployment change. This doc authorizes no implementation; it scopes a future implementation pass.

Cross-references:
- `CENTRAL_APP_BLANK_WORKBOOK_RUNTIME_REPORT.md → §6 row 4` — cosmetic House Values / House Assets first-create polish was tracked there as the original surface. This doc absorbs that row and extends it across the rest of the generated-sheet inventory.
- `CENTRAL_APP_BOOTSTRAP_COVERAGE_AUDIT.md → §6.5 "Still needed" optional cosmetic item` and `§11 "Optional / not blocking" item (b)`.
- `CENTRAL_APP_FAMILY_BETA_READINESS_CHECKPOINT.md → §5.1` — the "non-blocker" list this work belongs to.
- `CENTRAL_APP_DESIGN.md → §9 Guardrails` — the additive contract any future helper here must satisfy.

---

## 1. Purpose

The blank-workbook runtime test proved the onboarding chain works end-to-end on a fresh workbook — every required sheet is created, every form saves, every dashboard surface renders calmly. The tester also observed that several freshly-created sheets are **structurally correct but visually rough**: cramped column widths, no frozen header rows, no banded styling, year-block boundaries that are hard to scan visually.

These observations are not regressions; they are pre-existing rough edges that the runtime test exposed because it was the first time anyone has watched a brand-new workbook materialize from zero sheets. On a populated workbook (the developer's production workbook) the user never sees the first-create state — only the polished state that results from months of manual width-tuning and styling.

This doc exists so the polish work:
1. Has a single home — instead of being mentioned in passing in three different audit / runtime / checkpoint docs.
2. Is explicitly scoped as a separate workstream — not a Central App phase, not an onboarding fix, not a schema change, not part of the family beta proof.
3. Has a documented priority order and implementation strategy before any polish-pass prompt is written.
4. Has explicit non-goals so the polish prompts cannot drift into adjacent work.

**This doc does not authorize any code change.** A future implementation prompt with explicit user approval is required for each polish pass listed below.

---

## 2. Sheets in scope (current first-create polish state)

The runtime test surfaced first-create readability problems on the sheets below. The "current styling state" column reflects the audit at `2026-05-23` against `donations.js`, `house_values.js`, `investments.js`, `bank_accounts.js`, `onboarding.js`, `profile.js`, `cashflow_setup.js`, `upcoming_expenses.js`, `retirement.js`, `activity_log.js`.

| Sheet | Canonical creator | Current first-create styling | Observed readability problem |
|---|---|---|---|
| `INPUT - Donation` | `ensureInputDonationSheet_` (donations.js:44) | `setFrozenRows(2)` + `autoResizeColumns`. **No banded styling, no header weight, no column width tuning.** | Columns too narrow on first create; header row visually indistinct from data rows; Year banner row not visually distinguished from the header row below it. |
| `INPUT - Debts` | `ensureOnboardingDebtsSheetFromDashboard` (onboarding.js) | Canonical headers seeded; **no dedicated styling helper observed in the domain file**. | Header density / cramped spacing reported. Likely no frozen header, no column-width tuning, no header weight. |
| `INPUT - Bank Accounts` | `ensureOnboardingBankAccountsSheetFromDashboard` (onboarding.js) | Year block + canonical headers seeded; **no dedicated styling helper observed in the domain file**. | Readability rough — likely same shape as Debts (no frozen row, no tuned widths). |
| `INPUT - House Values` | `ensureInputHouseValuesSheet_` (house_values.js:35) | Calls `applyHouseValuesSheetStyling_` (house_values.js:1398), `setFrozenRows(2)`, `autoResizeColumns`. **Helper exists; output still reported rough.** | Year banner row + MMM-YY headers are present, but the visual hierarchy (Year row > header row > data rows) is hard to scan; column widths from `autoResizeColumns` collapse for empty data columns. |
| `SYS - House Assets` | `ensureSysHouseAssetsSheet_` (house_values.js:98) | Calls `applyHouseAssetsSheetStyling_` (house_values.js:1176), pre-formats money columns. **Helper exists; output still reported rough.** | Similar shape to House Values — helper exists but tuning is insufficient for the first-create state. |
| `HOUSES - <Name>` | `createHousesExpenseSheet_` (house_values.js:1249, invoked from `addHouseFromDashboard` step 4) | Clones row heights / column widths from an existing `HOUSES - *` template when one exists; falls back to `applyHousesYearRowFallbackFormat_` / `applyHousesHeaderRowFallbackFormat_` on a truly blank workbook. **The fallback path is what runs on first-ever house creation.** | Fallback formatting is functional but visually unpolished — the template-clone branch produces nicer output on subsequent house creates but is unreachable for the very first house. |
| `INPUT - Investments` | `ensureInputInvestmentsSheet_` (investments.js:52) | Calls `applyInvestmentsSheetStyling_` (investments.js:1053). **Helper exists.** | Not flagged in the runtime test, but listed here for parity since the styling helper exists. Likely benefits from any width / banding tweaks applied to House Values. |
| `SYS - Assets` | `ensureSysAssetsSheet_` (investments.js:124) | Calls `applyAssetsSheetStyling_` (investments.js:1193). **Helper exists.** | Not flagged; included for parity. |
| `INPUT - Cash Flow <year>` | `ensureCashFlowYearSheet_` (cashflow_setup.js:473) | Calls `applyCashFlowSheetStyling_` + `applyCashFlowSummaryRowStyling_`. **Helper exists, well-tuned (warm-yellow header + light-gray Summary).** | Not flagged in the runtime test — current styling is acceptable. Included as the reference standard the other sheets should converge toward. |
| `SYS - Accounts` | `ensureSysAccountsSheet_` (bank_accounts.js:24) | Canonical headers seeded; **no dedicated styling helper observed in the domain file**. | Not flagged in the runtime test, but listed for parity. |
| `INPUT - Settings` | `ensureInputSettingsSheet_` (profile.js:166) | Key/Value table; self-heals. | Not flagged — small table, low visual surface. Included for inventory completeness. |
| `INPUT - Bills` | `ensureOnboardingBillsSheetFromDashboard` (onboarding.js) | Canonical headers seeded; **no dedicated styling helper observed in the domain file**. | Not flagged but likely benefits from the same standards. |
| `INPUT - Upcoming Expenses` | `getOrCreateUpcomingExpensesSheet_` (upcoming_expenses.js:678) | Canonical headers seeded. | Not flagged. |
| `INPUT - Retirement` | `getOrCreateRetirementSheet_` (retirement.js:722) | Scenario template rows seeded. | Not flagged. |
| `LOG - Activity` | `getOrCreateActivityLogSheet_` (activity_log.js:60) | Canonical headers seeded. | Not flagged. |

**Two distinct shapes of polish work emerge from the inventory:**

1. **Sheets with a styling helper that still produces rough first-create output** — the helper exists, the tuning is insufficient. Examples: House Values, House Assets, House Expenses fallback path. Work shape: tune the existing helper.
2. **Sheets with no styling helper at all** — canonical headers exist but no banding / no frozen rows / no column-width tuning. Examples: Donation, Debts, Bank Accounts, SYS - Accounts, Bills. Work shape: add a styling helper.

Both shapes are strictly additive on the first-create branch and have **zero effect on populated workbooks**.

---

## 3. Common readability problems observed

Synthesized from the runtime test session. Each problem is observable on a blank workbook the moment the relevant sheet is first created; none of them are observable on the developer's production workbook because months of manual tuning have papered over them.

### 3.1 No frozen header row on data sheets
- Default behavior: scrolling past the first ~20 rows hides the canonical header row.
- Affects: `INPUT - Donation`, `INPUT - Debts`, `INPUT - Bank Accounts`, `SYS - Accounts`, `INPUT - Bills`, `INPUT - Upcoming Expenses`, `LOG - Activity`, `INPUT - Retirement`.
- Sheets that already get this right: `INPUT - House Values`, `SYS - House Assets`, `INPUT - Cash Flow <year>` (via their dedicated styling helpers), `INPUT - Donation` (added in this turn's bootstrap fix — `setFrozenRows(2)`).

### 3.2 Default column widths collapse for empty data columns
- `autoResizeColumns` shrinks an empty column to roughly the width of its header text. On a freshly created sheet with no data, this produces unreadably narrow columns (especially for date / amount columns where the header text is short but the eventual cell content is wider).
- Affects all freshly created data sheets that use `autoResizeColumns` as their only width-tuning step.

### 3.3 Header row visually indistinct from data rows
- Without `setFontWeight('bold')` / `setBackground(...)` / `setBorder(...)` on the header range, the canonical header row is the same visual weight as the data rows below it.
- Affects every sheet without a dedicated styling helper.

### 3.4 Year-block separation is hard to scan
- For sheets with per-year blocks (`INPUT - Donation`, `INPUT - Bank Accounts`, `INPUT - Investments`, `INPUT - House Values`), the visual boundary between one year's block and the next is currently just an empty row. Distinguishing the `Year` banner row from the header row below it requires squinting.
- The existing House Values / House Assets styling helpers attempt this but the contrast is too subtle on first-create.

### 3.5 No banded styling on data rows
- Apps Script supports `range.applyRowBanding(SpreadsheetApp.BandingTheme.LIGHT_GREY)` (or similar). None of the current helpers use this.
- Banded data rows would make every multi-row data sheet immediately more scannable.

### 3.6 Number formats applied only on write, not on the sheet structure
- `addDonation`, the bank-account writers, the debts writers, and the house-values writers all apply number formats per-cell at write time. A freshly created sheet has no number formats pre-applied on the data range (except for `SYS - House Assets` which pre-formats columns 3 and 4 as money).
- Net effect: between sheet creation and the first write, any user inspection of the sheet shows raw numbers without currency / percentage / date formatting.

### 3.7 Header-row text wrapping
- Long header labels (`Use Policy`, `Available Now`, `Min Buffer`, `External Account Id`, `Payment Links`, etc.) wrap awkwardly inside narrow auto-sized columns. `setWrap(true)` on the header range plus a minimum column width per column would resolve this.

---

## 4. Desired formatting standards (target for any future polish pass)

A consistent set of formatting conventions every generated sheet should meet on first create. None of these are settled until a future polish-pass prompt explicitly adopts them; they are the candidate standard this doc proposes.

### 4.1 Frozen rows
- Single-block flat tables (`INPUT - Debts`, `INPUT - Bills`, `INPUT - Upcoming Expenses`, `SYS - Accounts`, `SYS - Assets`, `SYS - House Assets`, `LOG - Activity`): freeze 1 row (the canonical header row).
- Year-block tables (`INPUT - Bank Accounts`, `INPUT - Investments`, `INPUT - House Values`, `INPUT - Donation`): freeze 2 rows (Year banner + header) **on the topmost block only**. Year banners for later blocks are not frozen — that is intentional and matches the existing pattern.
- Key/Value (`INPUT - Settings`): freeze 1 row.

### 4.2 Column widths
- Minimum width per column: ~110px (Apps Script default is ~100px; below this, header labels wrap awkwardly).
- Money / amount columns: ~120px.
- Date columns: ~110px.
- Long-text columns (`Notes`, `Comments`, `Payee`, `Name of Charity`): ~200px.
- Boolean / Yes/No columns (`Active`, `Autopay`, `Varies`): ~80px.
- Year columns inside year blocks (`Jan-26`, `Feb-26`, …): ~100px (currently `autoResizeColumns` produces ~70px which is too narrow for `$1,234.56`).

### 4.3 Header row styling
- Background: a single shared "header" background color (e.g., `#f3f3f3` light gray, or the warm-yellow already used by Cash Flow for consistency). Decision pending — see §5.
- Font: `setFontWeight('bold')`, `setVerticalAlignment('middle')`, `setHorizontalAlignment('left')` for text columns, `setHorizontalAlignment('center')` for date / boolean columns.
- Border: a single bottom border (`SpreadsheetApp.BorderStyle.SOLID`) on the header row to separate it from data.
- Wrap: `setWrap(true)` so long header labels can wrap to two lines instead of overflowing.

### 4.4 Year banner row styling (year-block sheets only)
- Background: a second, more saturated color (e.g., `#e0e0e0` or a thematic per-domain color — Cash Flow already uses warm yellow on its data area; year banners could use a slightly stronger version).
- Font: `setFontWeight('bold')`, slightly larger font size (`setFontSize(11)` vs default 10).
- Border: bottom + top border on the year banner row so it visibly separates from any preceding year block's data.

### 4.5 Data row banding
- `range.applyRowBanding(SpreadsheetApp.BandingTheme.LIGHT_GREY, /*showHeader=*/ true, /*showFooter=*/ false)` on the data range. The `showHeader` parameter coordinates with the header row styling so the banding does not visually conflict with §4.3.
- Applied only on first-create. On populated workbooks, banding state must be left untouched (any user-applied banding overrides the default).

### 4.6 Number formats pre-applied on the data range
- Money columns: `$#,##0.00;-$#,##0.00` (or `$#,##0.00` if negative values are impossible for the column).
- Percentage columns: `0.00%`.
- Date columns: `M/d/yyyy`.
- Bounded to `sheet.getMaxRows() - <header offset>` so the format applies to the data area only, not to row 1 / row 2.
- Pattern already used in `ensureSysHouseAssetsSheet_:120–128` — adopt the same pattern across the inventory.

### 4.7 Section separation (year-block sheets only)
- A single blank styled row between year blocks, with a thicker bottom border. Adopted from the convention some manually-tuned sheets already use.
- This is the most invasive convention and may need a per-domain decision; see §5 non-goals.

### 4.8 Header row text alignment + tooltip
- For columns whose name is non-obvious (e.g., `Use Policy`, `Available Now`, `Min Buffer`, `Dedupe Key`): consider `cell.setNote('<one-line explanation>')` so hover surfaces a tooltip without changing the visible cell content.
- Strictly additive on first create; never overwritten on populated sheets.

---

## 5. Non-goals (explicit)

This polish workstream **does not** change any of the following. Any future polish-pass prompt that drifts into these areas is out of scope and must be rejected.

- **No schema rewrites.** Header names, column counts, column order, year-block layout, sheet names — all unchanged.
- **No onboarding logic changes.** The `ensureOnboarding*FromDashboard` chain, the bootstrap registry, the validate-before-write order, the lazy-create-on-first-read path — none of these change. Polish helpers run only on the first-create branch of each canonical creator.
- **No formula rewrites.** Existing formulas in Cash Flow Summary rows, planner outputs, year-block aggregates — untouched.
- **No broad UI redesign.** This is sheet-level formatting only. No changes to `Dashboard_Body.html`, `Dashboard_Help.html`, or any `Dashboard_Script_*.html`. Web-app rendering is not in scope.
- **No populated-workbook overwrite.** Every formatting call must be inside an `if (sheet was just created in this execution)` guard, gated by the existing `if (existing) return existing` short-circuit at the top of every canonical creator. Populated workbooks remain byte-for-byte unchanged. This is the strongest contract in the additive bootstrap chain and must be preserved.
- **No central-app deployment work.** Polish does not depend on resolver migration, on `executeAs: USER_ACCESSING`, on per-user mapping, or on Drive API workbook creation. Bound-mode only.
- **No new dependencies / no third-party libraries.** Apps Script `Range` / `Sheet` / `Banding` / `BorderStyle` / `BandingTheme` only.
- **No bootstrap-registry expansion.** Polish does not add new keys to `BOOTSTRAP_CORE_KEYS_` or any other registry.
- **No header background color change on existing helpers** (House Values, House Assets, Investments, Assets, Cash Flow) without an explicit design decision — those helpers already chose their colors and the choice was deliberate. If a single shared header background color is adopted (§4.3), it must include the existing helpers in the migration; if not, each helper keeps its own color. This is the one polish decision that **does** require a design-pass prompt before implementation, not just an additive prompt.
- **No automated screenshot testing / no visual-regression harness.** Verification is manual.

---

## 6. Recommended implementation strategy

Each polish pass should:

1. **Be one sheet at a time.** A single polish-pass prompt covers exactly one canonical creator. No bulk passes across multiple sheets in one commit.
2. **Be strictly additive on first-create.** Every formatting call must be reachable only when the sheet was just created in the current execution. The existing race-safe insert pattern (`if (existing) return existing` → `try { insertSheet } catch (e) { return racedSheet }`) already provides this gate; the polish call appears after the insert succeeds, before the `return sheet` line.
3. **Mirror the existing helper convention.** For sheets that already have a styling helper (House Values, House Assets, Investments, Assets, Cash Flow), the polish pass tunes the existing helper. For sheets that do not, the polish pass adds a new `apply<Sheet>Styling_(sheet)` helper next to the creator and calls it on first create only.
4. **Wrap every styling call in `try { ... } catch (_styleErr) { /* cosmetic only */ }`.** Already the convention in `ensureInputHouseValuesSheet_` and `ensureSysHouseAssetsSheet_`. A styling failure must never abort sheet creation; the canonical headers + structural content are the load-bearing part, and styling is decoration.
5. **No populated-workbook write path.** Polish must not run on the existing populated developer workbook. Verified by: (a) populated workbook still passes the canonical creator's `if (existing) return existing` short-circuit at the top, so the polish code below is never reached; (b) manual confirmation by reloading the developer workbook and observing zero sheet changes.
6. **Verify against the runtime test setup.** Each polish pass is verified by creating the relevant sheet on a disposable blank workbook (the existing test workbook from the onboarding runtime test) and observing the first-create state. PASS criteria: the §4 standards are met for the touched sheet; no red banner; no destructive overwrite on a second open of the same sheet.
7. **Reversible in one commit.** Each polish pass is a single file change (or a single file + one helper extraction). Revert is one `git revert <sha>` away.

The single-sheet, single-prompt cadence is deliberate: it bounds review effort, makes each commit independently shippable, and prevents accidental schema / onboarding drift.

---

## 7. Priority ordering

Highest-impact first. "Impact" here is a function of (a) how often a family beta user sees the freshly-created sheet, (b) how rough the current state is, (c) how cheap the fix is.

### 7.1 Tier 1 — immediate user-visible surfaces (recommended first)

1. **`INPUT - Bank Accounts`** — every family beta user adds their first bank account during Setup / Review. The fresh Year block + cramped MMM-YY columns are one of the first non-Settings sheets the user will inspect manually. **Highest impact per minute of work.**
2. **`INPUT - Debts`** — same logic as Bank Accounts: every user who completes Setup / Review will touch this within the first session.
3. **`INPUT - Bills`** — every user who completes Setup / Review hits this. Currently bare headers.

### 7.2 Tier 2 — secondary surfaces seen during normal use

4. **`INPUT - House Values`** — already has a styling helper; needs tuning (column widths, year-banner contrast, banding). Lower priority because not every user owns a house.
5. **`SYS - House Assets`** — same as above; tune the existing helper.
6. **`HOUSES - <Name>` first-create fallback path** — the template-clone path produces nice output, but the fallback `applyHousesYearRowFallbackFormat_` / `applyHousesHeaderRowFallbackFormat_` path that runs on the very first house creation is rough. Tune the fallback.
7. **`INPUT - Donation`** — just shipped with `setFrozenRows(2) + autoResizeColumns` and nothing else. Add a styling helper that meets the §4 standards. Lower priority because Donations is an opt-in surface (not every family beta user will touch it).

### 7.3 Tier 3 — lower-impact / inventory polish

8. **`SYS - Accounts`** — backing table, less visually prominent than the Bank Accounts INPUT sheet.
9. **`SYS - Assets`** — same as SYS - Accounts.
10. **`INPUT - Investments`** — already has a styling helper; tune for parity with House Values.
11. **`INPUT - Upcoming Expenses`** — small flat table, low row count.
12. **`INPUT - Retirement`** — scenario template; low row count.
13. **`LOG - Activity`** — append-only audit log. Most users will not inspect it directly, but the columns are wide (Type / Action / Amount / Details / etc.) and benefit from header-bold + frozen row.
14. **`INPUT - Settings`** — Key/Value table. Smallest surface.

### 7.4 Out of priority

- **`OUT - Dashboard`, `OUT - History`** — planner-owned and already destructively rebuilt by `writeRecommendations_` / `ensureHistorySheet_`. Polishing their first-create state is out of scope; the planner re-applies its own formatting on every run.
- **`HOME` admin tab** — developer-facing only, never on a family-beta user flow.
- **Bank Import SYS sheets** (`SYS - Import Staging — Bank Accounts`, `SYS - Import Ignored — Bank Accounts`) — Bank Import is explicitly out of family beta scope per `CENTRAL_APP_FAMILY_BETA_PLAN.md → §3 Non-goals`. Polish for these waits until Bank Import re-enters scope.

---

## 8. Runtime findings (from the onboarding test session)

Summary of the cosmetic / readability observations captured during the blank-workbook runtime test session(s) culminating in the 2026-05-23 closure. None of these were classified as onboarding blockers; all are tracked here so they are not lost.

| Sheet | Surfaced in | Symptom | Severity |
|---|---|---|---|
| `INPUT - House Values` | Runtime report §4.9.2 retest + §6 row 4 | Header widths, alignment, banded styling rough on first create; downstream readers unaffected. | Low — cosmetic only. |
| `SYS - House Assets` | Runtime report §4.9.2 retest + §6 row 4 | Same shape as House Values; existing helper produces rough output. | Low. |
| `HOUSES - <Name>` first-create | Runtime report §4.9.2 retest | Fallback formatting path runs on first-ever house creation (no template available to clone); visibly less polished than the template-clone branch. | Low. |
| `INPUT - Donation` | This turn's `8b399f6` bootstrap-fix commit + the runtime polish-observation pass | Columns too narrow; header row visually indistinct; Year banner row not visually distinguished. | Low. |
| `INPUT - Debts` | User polish-observation pass | Header density / cramped spacing reported. | Low. |
| `INPUT - Bank Accounts` | User polish-observation pass | Readability rough — no frozen row, no tuned widths. | Low. |

No red-banner / no functional failure / no data-integrity concern is associated with any item in this table. Downstream readers (`getHouseUiData`, `getDonationsFormData`, `getBankAccountsForOverview`, etc.) round-trip correctly through every affected sheet because data column layout is byte-for-byte correct — only the *visual presentation* is rough.

---

## 9. Suggested future implementation sequencing

Each row below is a candidate single-sheet polish prompt. Each is independently shippable. None blocks any other. None blocks the central-app workstream (Option C in `CENTRAL_APP_FAMILY_BETA_READINESS_CHECKPOINT.md → §7.5`).

| # | Polish pass | Scope | Estimated cost | Blocks anything? |
|---|---|---|---|---|
| 1 | `INPUT - Bank Accounts` first-create styling | Add `applyBankAccountsSheetStyling_` (or extend the onboarding helper); apply on first-create only. | Single Cursor prompt; ~1 hr review. | No. |
| 2 | `INPUT - Debts` first-create styling | Add `applyDebtsSheetStyling_`; apply on first-create only. | Single prompt; ~1 hr. | No. |
| 3 | `INPUT - Bills` first-create styling | Add `applyBillsSheetStyling_`; apply on first-create only. | Single prompt; ~1 hr. | No. |
| 4 | `INPUT - House Values` styling tune | Tune `applyHouseValuesSheetStyling_` against the §4 standards. | Single prompt; ~1 hr. | No. |
| 5 | `SYS - House Assets` styling tune | Tune `applyHouseAssetsSheetStyling_`. | Single prompt; ~1 hr. | No. |
| 6 | `HOUSES - <Name>` first-create fallback tune | Tune `applyHousesYearRowFallbackFormat_` / `applyHousesHeaderRowFallbackFormat_`. | Single prompt; ~1 hr. | No. |
| 7 | `INPUT - Donation` styling | Add `applyDonationsSheetStyling_`; apply on first-create only. | Single prompt; ~1 hr. | No. |
| 8 | `SYS - Accounts` styling | Add `applySysAccountsSheetStyling_`. | Single prompt; ~30 min. | No. |
| 9 | `INPUT - Investments` / `SYS - Assets` styling tune | Tune the existing helpers for parity with House Values. | Single prompt covering both; ~1 hr. | No. |
| 10 | `INPUT - Upcoming Expenses` / `INPUT - Retirement` / `LOG - Activity` styling | One small pass per sheet, or one combined pass if standards are stable by then. | Single prompt(s); ~30 min each. | No. |
| 11 | `INPUT - Settings` styling | Last on the list; smallest surface. | Single prompt; ~15 min. | No. |

**Suggested cadence:** one polish pass per session, in priority order. After each pass, the previous pass's standards are observed in the wild; if a standard needs to be tweaked, the next pass picks up the revised standard. This avoids committing to a single canonical "polish helper" abstraction before the standards are stable.

**Optional consolidation (not recommended yet):** if all 11 passes adopt the same §4.1 / §4.2 / §4.3 / §4.5 / §4.6 conventions verbatim, the pattern can be factored into a shared `applySheetStylingStandard_(sheet, options)` helper. This is an explicit follow-up decision, not an upfront design — picking the abstraction before seeing it instantiated 5+ times is premature.

---

## 10. Sign-off

This doc is documentation-only and authorizes no implementation. Each polish pass in §9 is its own future Cursor prompt with explicit user approval. The first implementation prompt should adopt §4 as the standard (or explicitly amend it) and walk Tier 1 (Bank Accounts → Debts → Bills) before any other tier.

End of document.
