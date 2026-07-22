# Financial Integrity Phase 3 — Canonical Basis and Convergence Plan

**Status:** `IMPLEMENTATION_IN_PROGRESS` — canonical snapshot and isolated regression evidence complete; consumer convergence awaits separate approval
**Inventory completed:** 2026-07-22
**ProductDecision approved:** 2026-07-22
**Tolerance:** `$0.01`
**Runtime impact of this document:** none — this is a read-only source inventory and proposed contract.

## 1. Objective

Make every release-critical CashCompass surface agree on the same current financial position, while keeping historical snapshots and forward-looking scenarios explicitly separate.

This phase closes only when:

- Dashboard, Planner, and the live anchor of Rolling Debt reconcile to `$0.01`;
- source ledgers and their `SYS -` mirrors reconcile or report a clear freshness problem;
- property financing is counted exactly once in household net worth;
- Asset, Planner, and Dashboard audit modules pass;
- every corrected discrepancy has a permanent regression; and
- aggregate Financial Integrity is a Release Readiness gate.

## 2. Safety boundaries

- Audits remain read-only and admin-gated.
- Tests create and continuously verify their own Restricted disposable workbooks.
- The bounded workbook, mapped user workbooks, configured Central default, and Golden workbook are never writer-test targets.
- No broad schema rewrite, formatting wash, workbook migration, deployment, commit, or push is authorized by this plan.
- `samertheodossy@gmail.com` remains the sole administrator. Test identities never become administrators.

## 3. Current basis inventory

### 3.1 Current-position surfaces

| Surface | Cash | Investments | Real estate | Liabilities | Net worth / start basis |
| --- | --- | --- | --- | --- | --- |
| Dashboard | Sums every named `SYS - Accounts` current balance | Sums every named `SYS - Assets` current balance | Sums every named `SYS - House Assets` current value | Sums active `INPUT - Debts` rows | Cash + investments + gross real estate − active debt |
| Planner | Pre-syncs current-year input ledgers into `SYS -` mirrors, then sums every normalized account | Sums every normalized asset | Sums every normalized house current value | Sums **all** normalized debt rows, including inactive rows | Cash + investments + gross real estate − all debt |
| Rolling Debt | Sums every normalized account; separately derives usable/deployable cash policy | Not part of the payoff model | Not part of the payoff model | Clones **all** normalized debts into the simulation; planned mapped card expenses may increase modeled debt | Modeled debt start includes all debt plus applicable planned-card impacts |
| `OUT - History` | Does not store total cash as a dedicated field | Stores Planner financial assets | Stores Planner gross real-estate assets | Stores Planner liability total | Stores Planner total assets and net worth at run time |

### 3.2 Source and mirror responsibilities

| Domain | User/source record | Runtime mirror | Current behavior and risk |
| --- | --- | --- | --- |
| Cash | Latest non-empty current-year value in `INPUT - Bank Accounts` | `SYS - Accounts` | Planner and save paths sync the mirror; Dashboard reads the mirror without forcing a sync. A failed or skipped sync can leave the Dashboard stale. |
| Investments | Latest non-empty current-year value in `INPUT - Investments` | `SYS - Assets` | Same mirror-freshness risk as cash. |
| Property value | Latest non-empty current-year value in `INPUT - House Values` | `SYS - House Assets.Current Value` | Planner syncs current value. Loan Amount Left is maintained separately. |
| Debt | Current rows in `INPUT - Debts` | None | Dashboard applies Active; Planner liability and Rolling modeled start do not. |
| Cash flow | Current-year `INPUT - Cash Flow <year>` actuals ledger | Planner/history outputs | Actuals are not a forecast. Rolling derives a separate forward model from history and planned obligations. |

### 3.3 Intentional differences that must remain distinct

These are not reconciliation defects:

- **Total cash vs usable/deployable cash:** total cash belongs in net worth; policy-restricted cash, buffers, and planned holds belong in decision support.
- **Gross real-estate value vs property equity:** gross value is an asset; financing is a liability. Household net worth must subtract financing only once.
- **Live debt vs Rolling modeled debt:** Rolling may add mapped planned card-funded expenses. It must expose a canonical live anchor first, then label the scenario adjustment.
- **Live Dashboard totals vs historical comparisons:** prior planner rows are baselines, not current truth.
- **Live totals vs health score:** Financial Health may use the latest completed planner run, but the UI and audit must expose its timestamp and material staleness.

## 4. Confirmed discrepancies and tightening opportunities

| ID | Severity | Finding | Consumer risk | Required response |
| --- | --- | --- | --- | --- |
| FI-01 | P0 | Dashboard excludes inactive debts; Planner liability and Rolling modeled start include them. | Net worth, history, health, and payoff views can disagree when an inactive debt retains a balance. | Converge all live anchors on one Active rule and add an inactive-with-balance regression. |
| FI-02 | P0 decision | Bank, investment, and property “Stop tracking” preserves balances and current totals continue counting them; debt deactivation behaves differently. | A sold/closed asset may remain indefinitely in current net worth, and “Active” has inconsistent meaning. | Ratify whether Active controls current-position inclusion. Recommended: active-only current position; history remains intact. |
| FI-03 | P0 decision | `SYS - House Assets.Loan Amount Left` and linked active `INPUT - Debts` balances are separate property-financing bases. | Property equity and household liabilities can silently disagree; a mortgage can be omitted or represented twice across surfaces. | Ratify linked active debt as the authority when present; retain the property loan field as a legacy/unlinked fallback with an explicit variance. |
| FI-04 | P1 | Dashboard consumes mirrors while Planner first refreshes them from source ledgers. | Dashboard can be stale after an interrupted/failed mirror update even though the source ledger is correct. | Add read-only source-vs-mirror freshness checks; do not hide the discrepancy by silently writing during an audit. |
| FI-05 | P1 | Rolling exposes an adjusted scenario start but lacks a lightweight canonical live-debt accessor used by Financial Integrity. | A valid forecast adjustment can look like a current-total mismatch. | Add a production read-model seam that returns both canonical live anchor and labeled scenario adjustments. |
| FI-06 | P1 | Dashboard headlines are live, while Financial Health and historical comparisons use the latest Planner history row. | Users can assume every card was calculated at the same moment. | Preserve timestamps and add a material-staleness diagnostic; do not force historical data to masquerade as live. |
| FI-07 | P1 | The sheet `TOTAL DEBT` row is a gross formula, while the Dashboard total is active-only. | The visible workbook total may differ from the product total when inactive debt carries a balance. | Treat the gross row as a diagnostic basis until the canonical decision is implemented; never silently rewrite a populated custom formula. |
| FI-08 | P1 compatibility | Legacy workbooks without an Active column use different debt fallbacks in Planner and Dashboard. | Older workbooks can diverge even without an explicit inactive value. | Use one legacy fallback in the canonical read model and surface a compatibility warning until schema evolution is safely applied. |

## 5. Recommended canonical contract

### Decision A — current financial position

**Approved:** an explicitly inactive row is excluded from the current financial position across cash, investments, properties, and debts. Blank Active values remain active for backward compatibility. Historical ledger values and previously saved history rows are never deleted or rewritten.

Why: “Stop tracking” should not leave a stale asset or liability in today’s consumer-facing net worth. A user who still owns an account should keep it active; zero-balance closed accounts can be stopped while their history remains.

### Decision B — authoritative source chain

**Approved:** input ledgers are authoritative; `SYS -` sheets are validated runtime mirrors/read models, not independent financial truth.

- Cash: latest current-year active Bank Account value.
- Investments: latest current-year active Investment value.
- Real estate: latest current-year active House Value.
- Liabilities: active non-summary Debt rows.
- Current assets: cash + investments + gross real estate.
- Current liabilities: active debt balances exactly once.
- Net worth: current assets − current liabilities.

Dashboard and Planner may continue reading performant mirrors only when the audit can prove those mirrors match their source basis to `$0.01`.

### Decision C — property financing

**Approved:** for a property with one or more active linked debts, their summed balance is the authoritative current property loan balance. The current-year `INPUT - House Values.Loan Amount Left` value is the authoritative legacy property-equity fallback for an unlinked property; its `SYS - House Assets` copy remains only a mirror. The fallback must not be silently added to household liabilities because it could duplicate an existing unlinked debt row. An unlinked non-zero legacy loan balance blocks Financial Integrity reconciliation until the financing is linked or explicitly resolved. When linked debt and the legacy field both exist, a difference greater than `$0.01` is also a gated Financial Integrity discrepancy.

The linked debt remains part of household liabilities and is never subtracted a second time from household net worth. Property equity is property value minus its authoritative property loan balance.

### Decision D — Rolling Debt

**Approved:** Rolling Debt must publish two separate values:

1. canonical live debt anchor — exactly equal to the current liability basis; and
2. modeled starting debt — live anchor plus clearly itemized scenario adjustments.

Only the first participates in cross-surface `$0.01` reconciliation.

### Decision E — history and health freshness

**Approved:** `OUT - History` remains an immutable snapshot of the canonical basis at Planner run time. Dashboard health may use the last Planner snapshot, provided its captured time is visible and the audit reports when it materially differs from the live current position.

## 6. ProductDecision options

| Option | Description | Benefit | Risk |
| --- | --- | --- | --- |
| **A — Active owned position + linked-debt authority (approved 2026-07-22)** | Adopt Decisions A–E above, with fail-closed handling for unlinked property financing. | Clearest consumer meaning; prevents stale inactive holdings; makes property financing explainable and reconciled. | Requires carefully staged read-model changes, legacy/fallback regressions, and explicit resolution of unlinked non-zero property loans. |
| B — Preserve the existing hybrid | Keep gross cash/investment/property totals, active-only Dashboard debt, and separate property loan references. | Lowest immediate code change. | Leaves known cross-surface disagreement and ambiguous “Stop tracking” semantics; not suitable for the 10/10 financial-truth gate. |
| C — Make `SYS -` mirrors independently canonical | Treat current mirror values as the authority even when input ledgers differ. | Simple and fast runtime reads. | Cache/mirror staleness becomes financial truth; weak auditability and recovery semantics. |

## 7. Safe implementation sequence after approval

1. **Complete locally:** add pure/read-only canonical row inclusion helpers and `readCanonicalFinancialSnapshot_(ss)`; no UI or consumer-calculation changes.
2. **Complete with isolated runtime evidence:** regressions for active, inactive-with-balance, blank-Active legacy, summary-row exclusion, property linked/unlinked/mismatch, and mirror freshness passed 21/21 on isolated Central `@147` (`20260722-133952-4f0a`) with CURRENT/FULLY_CURRENT schema, Provisioning and Drift PASS, Restricted sharing, and verified Trash cleanup.
3. Converge Planner liability/net worth and Rolling live anchor first; retain separately labeled scenario adjustments.
4. Converge Dashboard and historical snapshot writes on the same canonical read model.
5. Add Asset, Planner, and Dashboard audit modules plus property-financing reconciliation.
6. Add disposable populated-workbook cross-surface tests at `$0.01`; never use the bounded workbook.
7. Promote aggregate Financial Integrity to a Release Readiness gate only after runtime evidence passes.

Each step receives its own review, tests, and approval gates. Existing populated workbooks receive additive, compatibility-preserving evolution only; no bulk restyling or destructive rewrite is permitted.

## 8. Required regression inventory

- Inactive debt with non-zero balance does not enter any live total or Rolling live anchor.
- Inactive bank, investment, and property rows follow the ratified current-position rule while history remains.
- Blank Active remains active on an evolved workbook.
- Missing Active follows one documented legacy fallback and emits a compatibility observation.
- Summary rows (`TOTAL DEBT`, `TOTAL ACCOUNTS`, `DELTA`, and equivalent totals) never enter canonical totals.
- Source and mirror totals match to `$0.01`, with a clear stale-mirror report when they do not.
- Linked property debt is counted once globally and reconciles to property financing.
- Unlinked legacy property loans remain visible and explicitly classified as fallback.
- Rolling live anchor equals canonical liabilities; planned-card adjustments appear only in modeled start.
- Planner history stores the same assets, liabilities, and net worth as the canonical snapshot at that run.
- Dashboard live totals match the canonical snapshot; health/history timestamps remain explicit.

## 9. Current phase verdict

**Planner phase: `COMPLETE`.** On 2026-07-22 the user approved **Option A — Active owned position + linked-debt authority**, with fail-closed handling for unlinked property financing. Explicitly inactive rows are excluded from the current position; blank Active values remain active; history is preserved; input ledgers are authoritative; linked active debts determine property financing and are counted once; unlinked legacy loan balances remain visible but block Financial Integrity reconciliation until resolved; and Rolling live debt must equal canonical liabilities while scenario adjustments remain separate.

**Engineer slice 1: `COMPLETE` with isolated evidence.** The approved pure/read-only snapshot and registered disposable regression are implemented without switching Dashboard, Planner, Rolling Debt, History, or any UI consumer. Local static, in-memory numeric, safety, production-path, and full `npm test` checks pass. Corrected isolated Central `@147` run `20260722-133952-4f0a` passed all 21 functional assertions plus Provisioning, Drift, Restricted sharing, and verified Trash cleanup. The earlier `@146` fixture-only failure ran no functional assertions and also verified Restricted sharing and Trash cleanup.

**Next gate:** separate implementation approval before any Planner, Dashboard, Rolling Debt, History, audit-module, or other consumer calculation changes. Commit, Git push, workbook migration, Beta/bounded deployment, and bounded-workbook testing remain unauthorized.
