# Bills

## 1. Knowledge Metadata

| Field | Value |
| --- | --- |
| Feature slug | `bills` |
| Domain | Bills / Cash Flow |
| Template revision | `1.1` |
| Template completeness | `COMPLETE` |
| Knowledge status | `DRAFT` |
| Product status | Shipped / Beta; Stop/Reactivate recovery lifecycle and CashCompass confirmation are complete; Recurrence Engine V2 is shipped, while separate payment/correction coverage gaps remain tracked |
| Feature expert | Bills feature expert |
| Last verified date | `2026-08-23` |
| Last verified Git reference | `bb20008` (`unify confirmations and complete bill lifecycle`) and `cdbef99` (`complete income lifecycle and uniform recovery controls`) |
| Applies to | Central App and bounded app |
| Primary user surfaces | Cash Flow → Bills → Due this period; Cash Flow → Bills → Manage bills; Overview Bills cards; Quick add; `INPUT - Bills`; `INPUT - Cash Flow <year>`; `LOG - Activity` |
| Canonical source documents | [`PROJECT_CONTEXT.md`](../../PROJECT_CONTEXT.md) → “Weekly/Biweekly Weekday Recurrence Support” and “Cash Flow Semantics”; [`ENGINEERING_STANDARDS.md`](../../ENGINEERING_STANDARDS.md) → “Cash Flow Data Semantics — Actuals vs Projection”; [`Dashboard_Help.html`](../../Dashboard_Help.html) → Bills; [`REGRESSION_SUITE_PLAN.md`](../../REGRESSION_SUITE_PLAN.md) → Bills recurrence |

### Knowledge status rules

- `DRAFT`: Discovery is incomplete or material claims remain unverified.
- `VERIFIED`: All required sections are supported by current repository evidence and relevant tests or runtime observations.
- `STALE`: A material implementation or product decision changed after the last verification.
- `DEPRECATED`: The feature is no longer active; the document remains only for historical or migration context.

Current DRAFT rationale: the Bills lifecycle and confirmation claims are verified by source, permanent regressions, isolated `@387`, and owner evidence, but separate natural expanded-occurrence Pay, Validator, and correction coverage gaps remain.

## 2. Feature Summary

### User promise

Bills helps a user track recurring obligations, see overdue and near-term occurrences, pay or skip individual occurrences, and maintain the underlying recurring-bill list without editing the workbook directly.

### Current behavior

The Bills page has three views. **Due this period** combines dated items from active debts and active `INPUT - Bills` rows into Overdue and Next 7 Days queues, plus a Cash-Flow-derived fallback list for recurring items without a mapped due date. **Add bill** creates a new identity and refuses an existing active or inactive payee. **Manage bills** lists active rows for Edit/Stop tracking and exposes a counted inactive inventory whose Reactivate action restores the preserved row.

Recurring `INPUT - Bills` rows support Monthly, Weekly, Biweekly, Bimonthly, Quarterly, Semi-annually, and Yearly schedules in source and UI. Weekly can use a weekday; Biweekly can use a weekday plus an Anchor Date for a true 14-day cadence. Blank scheduling fields preserve legacy Due Day display behavior, but unattended Weekly AutoPay fails closed unless a recognized Weekday exists and the occurrence lands on it. Add/Edit rejects an inconsistent Biweekly weekday and anchor. Schedule edits are prospective when `Schedule Effective Date` is available.

Pay opens Quick add with bill details prefilled. Skip opens a CashCompass drawer that identifies the exact occurrence and explains that no payment will be recorded, the occurrence will leave Bills, and future occurrences remain active. Cancel, Escape, or a backdrop click closes the idle drawer without a server call; confirmation submits exactly once, keeps failures retryable in the drawer, and refreshes Bills and dashboard summaries after success. Skip writes a zero only into a resolved blank Cash Flow month cell and always records a deduplicated `bill_skip` marker; when an active tracked bill has no matching Cash Flow row, Skip records only the marker and never fabricates a ledger row. AutoPay records past-due actual activity, not forecasts. Monthly, Weekly, and Biweekly occurrences honor per-occurrence Skip markers; Weekly/Biweekly also use per-occurrence Pay/AutoPay markers because multiple occurrences share one monthly Cash Flow cell.

When an active debt and an active tracked Bill normalize to the same payee, the explicit tracked Bill is authoritative for the Bills Due queue. The debt-derived duplicate card is suppressed only from that combined queue; the debt account remains active and visible in Assets & Liabilities, Planning, and its source sheet. An inactive tracked Bill does not suppress the debt-derived card.

Bill Pay keeps the editable amount currency-formatted while focused. A successful manual payment remains two coordinated immutable audit records—a monetary `quick_pay` row and a non-monetary `bill_paid` occurrence marker—but the customer-facing Activity table hides the internal marker and presents the monetary row once as **Bill paid** with its amount.

### Business and financial significance

Bills affects near-term cash decisions and the Cash Flow actuals ledger. Incorrect occurrence dates, duplicate AutoPay writes, lost Pay/Skip markers, or payee-link drift can overstate or understate cash obligations and erode user trust. The project therefore treats recurrence correctness, exactly-once writes, populated-workbook preservation, and the actuals-versus-projection boundary as financial invariants.

## 3. Scope and Boundaries

### In scope

- Add recurring bills to `INPUT - Bills` and seed a matching blank Cash Flow Expense row when possible.
- Read and manage active and inactive bill rows.
- Edit supported fields in place with stale-row protection and prospective schedule changes.
- Coordinate a Payee rename with the one exact linked current-year Cash Flow Expense row, with collision refusal, verification, mandatory audit, and rollback.
- Stop tracking by setting `Active = No`; preserve the row and history; Reactivate the exact guarded row without duplication.
- Generate dated occurrences and split them into Overdue and Next 7 Days.
- Surface recurring Cash Flow items without a mapped due date.
- Route Pay through Quick add and preserve Payment Source → Flow Source.
- Record Skip, Pay, and AutoPay occurrence evidence in `LOG - Activity`.
- Support legacy Due Day, weekday Weekly, and anchor-driven Biweekly recurrence.

### Out of scope

- Hard deletion of bill rows.
- Historical-year Cash Flow renaming, Cash Flow row reclassification, and alias/merge repair.
- Forward projection of scheduled bill amounts into future Cash Flow months.
- Bank-payment execution, bank connectivity, or confirmation that an external payment cleared.
- Advanced alias-repair or merge workflows for duplicate/renamed payees.

### Planned but not implemented

- Cash Flow forward projection is planned separately; see [`PROJECT_CONTEXT.md`](../../PROJECT_CONTEXT.md) → “Cash Flow Semantics — Actuals, not Projection” and the linked `TODO.md` entry.
- A monthly Bills summary/calendar with grouped status rows and bill-click historical Cash Flow detail is deferred as a Phase 2 UX candidate in [`TODO.md`](../../TODO.md) → “UX-03 — Phase 2 candidate — Monthly Bills calendar and history.” Isolated visual experiments were rejected in favor of retaining the established **Due this period** experience; no experimental runtime code remains.
- Bills AutoPay, manual Pay, overdue, paid-occurrence, and performance/concurrency harness coverage listed without an implemented marker remains planned in [`REGRESSION_SUITE_PLAN.md`](../../REGRESSION_SUITE_PLAN.md).
- Bills-specific inclusion in the Phase 2 Validator canonical model and scoped Operational runner is not implemented in the reviewed code.

### Intentional constraints

- Cash Flow is an actuals ledger. Adding a bill seeds structure but no monthly amounts.
- AutoPay requires the due date to have passed; it must not fill future months.
- Blank Weekday/Anchor Date preserves legacy Due Day occurrence display and manual handling; Weekly unattended AutoPay requires a recognized, matching Weekday and never writes from the fallback.
- An invalid Biweekly weekday/anchor combination is rejected by Add/Edit; the recurrence reader defensively falls back to legacy behavior rather than silently snapping the date.
- Payee edits rename only the exact current-year linked Expense Payee cell; after the verified audit succeeds, every Bills column changed by that edit and the linked Cash Flow Payee column use the shared best-effort content fit. Historical Cash Flow years and prior Activity rows remain unchanged.
- Stop tracking is a soft deactivate and never reverses payments.
- Monthly and other one-occurrence-per-month high Due Days clamp to the last valid calendar day, matching Weekly/Biweekly anchor behavior.

## 4. Authoritative Evidence

| Subject | Authoritative source | Evidence type | Verification state | Last verified |
| --- | --- | --- | --- | --- |
| Product behavior | `Dashboard_Help.html` → Bills; `PROJECT_CONTEXT.md` → Recurrence Engine V2 and actuals semantics | User documentation and decision record | `SOURCE-INSPECTED` | `2026-07-16` |
| Add/Edit/Deactivate | `bills.js` → `addBillFromDashboard`, `updateTrackedBillFromDashboard`, `deactivateBillFromDashboard` | Source code | `SOURCE-INSPECTED` | `2026-07-16` |
| Occurrence and queue behavior | `dashboard_data.js` → `getBillsDueFromCashFlowForDashboard`, `getInputBillsDueRows_`, `buildRuleFromBillRow_`, `generateOccurrences_` | Source code | `SOURCE-INSPECTED` | `2026-07-16` |
| Pay/Skip/AutoPay | `Dashboard_Script_BillsDue.html`, `Dashboard_Script_Payments.html`, `quick_add_payment.js`, `dashboard_data.js` | Client/server source code | `SOURCE-INSPECTED` | `2026-07-16` |
| Workbook contract | `onboarding.js` → `ensureOnboardingBillsSheetFromDashboard`; `bills.js` → `ensureBillsSheetSchema_`, `applyBillsSheetStyling_` | Schema and creation source | `SOURCE-INSPECTED` | `2026-07-16` |
| Activity contract | `activity_log.js`; Bills write paths in `bills.js` and `dashboard_data.js` | Source code | `SOURCE-INSPECTED` | `2026-07-16` |
| Test coverage | `test_harness_scenarios_bills.js`; `test_harness_scenarios_maintenance.js`; `test_harness_suites.js`; `REGRESSION_SCENARIOS.md`; `REGRESSION_SUITE_PLAN.md` | Automated scenario definitions and plans; local source gates passed, disposable scenarios not executed in this pass | `SOURCE-INSPECTED` | `2026-08-03` |
| Validator coverage | `validator_snapshot.js`, `validator_core.js`, `validator_rules.js`, `VALIDATOR_ARCHITECTURE.md` | Read-only Validator implementation/design; Validator not executed in this pass | `SOURCE-INSPECTED` | `2026-07-16` |

When sources disagree, this DRAFT follows executable behavior and higher-precedence Engineering OS instructions, while recording the disagreement under Source and Documentation Conflicts. It does not silently rewrite historical documentation.

## 5. User Experience and Workflows

### Entry points

| Entry point | User | Preconditions | Result |
| --- | --- | --- | --- |
| Cash Flow → Bills → Due this period | Authorized CashCompass user | User workbook resolves; current Cash Flow year can be ensured | Shows counts and cards for Overdue, Next 7 Days, and recurring items without a mapped due date |
| Overview Bills cards | Authorized CashCompass user | Dashboard snapshot/Bills RPC succeeds | Shows due-soon/overdue summary and routes to Bills |
| Cash Flow → Bills → Manage bills | Authorized CashCompass user | User workbook resolves | Lists active `INPUT - Bills` rows; may perform additive, anchor-positioned optional-column self-heal that preserves existing cell data |
| Manage bills → Add bill | Authorized CashCompass user | Required form values valid | Creates a bill row, best-effort Activity entry, and matching blank Cash Flow Expense row |
| Manage bills → Edit | Authorized CashCompass user | Active row and stale-row payee reference still match | Writes only changed fields in place; scheduling changes stamp an effective date when supported |
| Manage bills → Stop tracking | Authorized CashCompass user | Active row and stale-row payee reference still match | Sets `Active = No` and preserves history |
| Manage bills → Show inactive → Reactivate | Authorized CashCompass user | Inactive row and stale-row payee reference still match; no active duplicate exists | Sets the existing row to `Active = Yes`, preserves its definition/history, and records `bill_reactivate` |
| Due card → Pay | Authorized CashCompass user | Card exists | Opens Quick add with Expense/payee/date/amount/Flow Source; save writes Cash Flow and Activity |
| Due card → Skip | Authorized CashCompass user | Occurrence resolves; a missing Cash Flow target is accepted only for a verified active tracked bill | Opens an accessible consequence drawer; confirmation records the occurrence marker, writes zero only to a resolved blank target, and keeps future occurrences active |

### Primary workflow

1. The user opens Bills; the client calls `getBillsDueFromCashFlowForDashboard`, `getRecurringBillsWithoutDueDateForDashboard`, and `getActiveBillsForManagementFromDashboard`.
2. The server resolves the correct workbook, ensures required lazy-created support where applicable, reads debts/bills/Cash Flow/activity evidence, generates occurrences, and returns queues and management rows.
3. The user selects Pay or Skip, or maintains the recurring bill through Manage bills.
4. The relevant server path writes only the scoped bill, Cash Flow, and/or Activity data, then the client refreshes Bills and dashboard summaries.

### Alternate and edge workflows

- Blank or freshly provisioned workbook: Missing `INPUT - Bills` reads return empty lists. Add can create the canonical 14-column sheet. Opening Bills Due ensures `LOG - Activity` and best-effort ensures the current Cash Flow year, then renders calm empty states.
- Existing populated workbook: Add/Edit/Manage use header-based reads. Missing optional Bills columns may self-heal additively; populated rows are not rewritten or restyled broadly.
- Central App: Bills server entry points resolve the mapped per-user workbook via `getUserSpreadsheet_`.
- Bounded app: The same resolver preserves active-spreadsheet behavior when Central mode is off.
- Empty, stale, duplicate, or invalid input: Required values fail with explicit errors. Edit/Deactivate compare row number plus expected payee to prevent writing a shifted row. Duplicate-payee Add behavior is `UNKNOWN`; no explicit duplicate guard was found in `addBillFromDashboard`. On the Bills Due read model, however, an active tracked Bill suppresses a normalized matching debt-derived card even when the Bill's current occurrence is already handled or outside the visible window.
- Retry, concurrent action, or repeated execution: Activity dedupe keys suppress repeated occurrence markers. AutoPay uses a per-user lock; if unavailable, writes are deferred but cards still load. A repeated deactivate returns “Already not tracked.” A no-change edit does not write or log.

## 6. Domain Vocabulary

| Term | Canonical meaning | Common confusion to avoid |
| --- | --- | --- |
| Bill | A recurring obligation primarily configured in `INPUT - Bills`; the Bills Due queue also includes active debt-derived payment items | Not every Bills card originates in `INPUT - Bills` |
| Occurrence | One scheduled due date for a recurring bill | Weekly/Biweekly occurrences are not a monthly average |
| Due this period | Overdue plus dates from today through the next seven days | It is not a full future forecast |
| Recurring Bills (No Due Date) | Active Cash Flow Expense rows with handled values in at least two distinct months and no matching Bills, Debts, or Upcoming Expenses payee | Not the same as an `INPUT - Bills` row with a Due Day, and not intended for one-time project expenses |
| Handled | An occurrence suppressed by a populated monthly cell or an occurrence marker, depending on recurrence mode | A shared Weekly/Biweekly month cell alone cannot identify which occurrence was handled |
| AutoPay | An internal actuals write triggered after a configured due date passes | It does not send money externally and does not forecast future payments |
| Payment Source | Bills value normalized to `CASH` or `CREDIT_CARD` | It becomes Cash Flow `Flow Source`; it is not a bank account identifier |
| Start Month | The recurrence eligibility anchor/month | It does not populate all Cash Flow months |
| Weekday | Optional Weekly/Biweekly scheduling field | Blank means legacy Due Day display/manual handling; Weekly AutoPay fails closed |
| Anchor Date | The parity origin for true Biweekly 14-day cadence | It must fall on the selected weekday; it is not silently corrected |
| Schedule Effective Date | Prospective floor stamped when scheduling fields change | It does not rewrite historical occurrences |
| Stop tracking / Reactivate | Toggle the guarded existing row between inactive and active while preserving its definition and history | It is not deletion, recreation, or reversal of money movement |

## 7. Architecture and Data Flow

### Component map

| Layer | Files / components | Responsibility |
| --- | --- | --- |
| UI | `Dashboard_Body.html`, `Dashboard_Help.html`, `Dashboard_Styles.html` | Bills markup, help, status and visual presentation |
| Client logic | `Dashboard_Script_BillsDue.html`, `Dashboard_Script_Payments.html`, `Dashboard_Script_Render.html` | Load/render views; Add/Edit/Deactivate calls; Pay/Skip bridges; refresh behavior |
| Server management | `bills.js` | Validate and write Bills rows; management reads; schema self-heal; styling |
| Server queue/recurrence | `dashboard_data.js` | Merge debt/bill rows; generate occurrences; AutoPay; Pay/Skip markers; queue buckets |
| Payment integration | `quick_add_payment.js` | Write actual payments to Cash Flow; seed/resolve Flow Source; log `quick_pay` |
| Persistence | `INPUT - Bills`, `INPUT - Cash Flow <year>`, `LOG - Activity`; adjacent reads from `INPUT - Debts` and `INPUT - Upcoming Expenses` | Configuration, actuals, occurrence evidence, and exclusion/deduplication inputs |
| Provisioning | `onboarding.js`, `cashflow_setup.js` | First-create Bills and Cash Flow structures |
| Diagnostics / validation | `validator_snapshot.js`, `validator_core.js`, `validator_rules.js`, `test_harness_scenarios_bills.js`, `test_harness_suites.js` | Formatting snapshots, partial structural validation, recurrence and workbook scenarios |

### Callable, scheduled, and downstream entry points

| Function or trigger | Caller / invocation | Side effects | Downstream consumers |
| --- | --- | --- | --- |
| `getBillsDueFromCashFlowForDashboard` | Bills UI, next-actions logic, planner/email overdue path | Reads Bills, Debts, Cash Flow, and Activity; may lazily ensure Activity/Cash Flow and post eligible AutoPay actuals | Bills queues, Overview, next actions, planner/email |
| `getRecurringBillsWithoutDueDateForDashboard` | Bills UI | Reads Cash Flow, Bills, Debts, and Upcoming Expenses; may lazily ensure the current Cash Flow year | Recurring Bills (No Due Date) cards |
| `getActiveBillsForManagementFromDashboard` | Manage bills load | Reads active Bills rows; may perform best-effort optional-column schema self-heal | Manage bills table and Edit/Stop actions |
| `getBillCategoriesFromDashboard` | Add/Edit category controls | Reads exact-case `Category` values; no persistent writes | Bills form category suggestions |
| `addBillFromDashboard`, `updateTrackedBillFromDashboard`, `deactivateBillFromDashboard` | Manage bills actions | Mutate Bills rows, append best-effort Activity evidence, and refresh source state; Add also best-effort seeds Cash Flow | Bills management, Bills Due, Activity, Cash Flow |
| `skipDashboardBill`, `markDashboardBillOccurrencePaid` | Bills Due Skip and post-Quick-add Pay bridge | Write occurrence evidence; Skip may also write a Cash Flow zero | Occurrence suppression, Activity, Bills refresh |
| `buildInputBillPlannerPaymentWindows_` | `code.js` planner/email generation | Reads input-bill occurrences through `getInputBillsDueRows_`; may inherit eligible AutoPay writes | Planner/email Pay now and Pay soon windows |
| `resolveFlowSourceFromBillOrDebt_` | Quick add when creating a new Expense row | Best-effort read of Bills/Debts; no direct writes | Cash Flow Flow Source inference |

### Request and write path

1. `loadDashboardActionSections` starts the three Bills reads.
2. Server entry points call `getUserSpreadsheet_` and read Bills, Debts, Cash Flow, Upcoming, and Activity state as required.
3. `getInputBillsDueRows_` converts each active Bills row into a recurrence rule, generates the prior/current/next-month window, resolves handled evidence, and may AutoPay past-due occurrences.
4. `getBillsDueFromCashFlowForDashboard` builds the active tracked-Bill payee authority map, removes normalized matching debt-derived duplicates from this queue only, merges the remaining debt rows with input-bill occurrences, and buckets them into Overdue or Next 7 Days.
5. Pay routes through Quick add; Skip records the exact occurrence marker and optionally resolves a blank Cash Flow target; Manage actions write Bills rows. Newest-request gating prevents an older Bills response from restoring a cleared card.

### Dependencies

- Upstream dependencies: Workbook resolution, current-year Cash Flow structure, Activity Log helpers, sheet-name registry, date/timezone helpers, Cash Flow row maps, and debt active-state rules.
- Downstream consumers: Overview Bills summaries, Bills UI, planner/email payment windows, Quick add, Activity UI, Cash Flow actuals, and any logic using Bills categories or Payment Source.
- Shared helpers: `getUserSpreadsheet_`, `ensureCashFlowYearSheet_`, `appendActivityLog_`, `touchDashboardSourceUpdated_`, Cash Flow row insert/write helpers, `applyOperationalFlatSheetStyling_`, and harness/validator infrastructure.
- External services: Google Apps Script Spreadsheet, Utilities, Session timezone, Logger, and `LockService`; no external bill-payment API was found.

## 8. Data and Workbook Contract

### Read/write inventory

| Store or sheet | Reads | Writes | Ownership | Safety notes |
| --- | --- | --- | --- | --- |
| `INPUT - Bills` | Header-driven bill fields and active rows | Add row; changed Edit cells; `Active = No`; optional schema headers | Bills | No hard delete; Edit does not re-sort; schema self-heal is additive and anchor-positioned, preserves existing cell data, and may shift existing column positions |
| `INPUT - Cash Flow <year>` | Expense payee rows, monthly handled values, Flow Source | Blank Expense row on Add; Pay amount accumulation; AutoPay amounts; Skip zero only when blank | Shared Cash Flow | Actuals only; never prefill future months; preserve existing user values/formats |
| `LOG - Activity` | Dedupe markers for AutoPay/Pay/Skip | `bill_add`, `bill_update`, `bill_deactivate`, `bill_skip`, `bill_autopay`, `bill_paid`, plus `quick_pay` | Shared Activity | Activity writes are best-effort for Add/Edit/Deactivate; AutoPay requires a newly written and verified marker or restores its Cash Flow mutation |
| `INPUT - Debts` | Active debt items, payment-source inference, recurring-fallback exclusions | None from Bills management | Debts | Debt-backed cards are adjacent Bills Due inputs, not Bills rows |
| `INPUT - Upcoming Expenses` | Payee exclusion for no-due-date recurrence fallback | None from Bills | Upcoming Expenses | Prevents project spend from being misclassified as a recurring bill |

### Read-path mutations

| Read path | Possible mutation | Trigger / guard | Idempotency and safety |
| --- | --- | --- | --- |
| `getBillsDueFromCashFlowForDashboard` | Ensure `LOG - Activity`; best-effort ensure current Cash Flow year; post eligible AutoPay Cash Flow values and markers | Runs during Bills/Overview/next-action/email reads; AutoPay requires lock, configured fixed amount, a past-due unhandled occurrence, and a valid Weekly weekday identity | Lazy ensures are intended to be idempotent; AutoPay verifies value/format and marker, restoring the exact prior cell when the marker is not committed |
| `getRecurringBillsWithoutDueDateForDashboard` | Best-effort ensure current Cash Flow year | Runs before fallback discovery | Year ensure is intended to be idempotent; failure falls through to downstream error/empty handling |
| `getActiveBillsForManagementFromDashboard` | Add missing optional Bills columns and format new columns | Runs when Manage bills opens; best-effort on failure | Additive, anchor-positioned, and data-preserving, but can shift existing column positions |
| `buildInputBillPlannerPaymentWindows_` | Eligible AutoPay writes inherited from `getInputBillsDueRows_` | Runs during planner/email generation | Same lock, weekday guard, verified marker, and compensating rollback as Bills Due AutoPay |
| `getBillCategoriesFromDashboard`, `resolveFlowSourceFromBillOrDebt_` | None found | Read-only lookup paths | Missing sheets/headers return fallback values; no persistent mutation found |

### Schema and semantics

| Field / column | Type or format | Meaning | Required | Default / fallback | Validation |
| --- | --- | --- | --- | --- | --- |
| Payee | Text, max 200 | Bill identity/display name and Cash Flow match key | Yes | None | Non-empty |
| Category | Text, max 200 | Reporting/category suggestion value | Yes for Add/Edit | None | Non-empty; free-form Other accepted |
| Due Day | Integer 1–31 | Legacy day-of-month anchor and non-weekday schedule day | Yes | None | Integer range |
| Default Amount | Currency/number stored non-negative, rounded to cents | Normal per-occurrence amount | Required header; value optional | `0` | Must parse as a number |
| Varies | Yes/No | Prevents fixed-amount AutoPay when Yes | Optional | `No` | Yes/No normalization |
| Autopay | Yes/No | Allows internal past-due actuals posting | Optional | `No` | Yes/No normalization |
| Active | Yes/No | Controls whether the bill is managed/generated | Yes | Add defaults `Yes` | Normalized active rows only |
| Payment Source | `CASH` / `CREDIT_CARD` | Cash Flow Flow Source hint | Required by Add/Edit payload; optional legacy header | None | Canonical enum |
| Frequency | Canonical label | Recurrence cadence | Required by Add/Edit payload; optional legacy header | Unsupported or blank normalizes to `unknown` and never falls through to Monthly | Accepted-label allow-list on writes; forecast fails closed until supported schedule evidence exists |
| Start Month | Integer 1–12 | Eligibility/cadence anchor | Optional | Current month on Add; reader fallback `1` | Integer range |
| Notes | Text, max 500 | User context | Optional | Blank | Trim/truncate |
| Weekday | Full weekday label | Weekly weekday; Biweekly weekday partner | Optional | Blank → legacy Due Day display/manual handling; no Weekly AutoPay | Recognized label on write normalization |
| Anchor Date | `yyyy-MM-dd` or parseable Date | Biweekly parity origin | Optional | Blank → legacy Due Day | Must match Weekday on Add/Edit |
| Schedule Effective Date | Date/`yyyy-MM-dd` | Floor for prospective schedule changes | Optional | Blank → no clamp/legacy | Written as today when schedule fields change and header exists |

### Workbook invariants

- Canonical first-create order is the 14 columns listed above; `INPUT - Bills` is a flat Operational sheet with a frozen header and no totals.
- Required read anchors are Payee, Due Day, Default Amount, and Active.
- Optional schema evolution is idempotent and header-scoped. `ensureBillsSheetSchema_` detects existing headers case-insensitively, inserts missing columns after a canonical anchor or at the sheet end, and preserves existing cell data even when insertion shifts existing column positions.
- Fresh-sheet styling is first-create only. Schema evolution formats only the new column and applies widen-only canonical widths.
- Add inserts in Due Day order; same-day rows follow existing same-day rows and blank Due Day legacy rows remain at the bottom.
- Edit updates in place and never changes row order.
- Add leaves an existing same-payee Expense row untouched. A later Payee edit changes only one exact linked current-year Expense Payee after collision checks; payment-source edits do not rewrite Cash Flow metadata.

## 9. Behavioral and Financial Invariants

1. **Actuals, not projection:** Add creates a blank Cash Flow Expense row but never seeds scheduled future month amounts.
2. **Expense sign:** Pay and AutoPay write expenses as negative Cash Flow amounts; configured Default Amount and UI amounts remain non-negative magnitudes rounded to cents.
3. **Due window:** Occurrence generation covers prior, current, and next month; the visible queue includes overdue dates and dates zero through seven days ahead.
4. **Start Month:** A bill must not generate or AutoPay before its Start Month in the current year; recurring eligibility continues in later years.
5. **Weekly weekday:** A recognized Weekday produces a continuous seven-day cadence across month boundaries and ignores Due Day for occurrence placement.
6. **Biweekly anchor:** A valid Weekday plus Anchor Date produces a DST-safe 14-calendar-day cadence across month/year boundaries and never emits before the anchor.
7. **Legacy compatibility:** Missing/blank/unrecognized weekday data, or unusable Biweekly anchor data on the read path, preserves legacy Due Day occurrence display/manual handling. Weekly unattended AutoPay remains governed by invariant 12 and fails closed.
8. **Prospective changes:** Schedule edits stamp an effective-date floor when the column exists; prior Cash Flow and Activity history are not rewritten.
9. **Monthly handled evidence:** A populated numeric Cash Flow month cell on any normalized matching Expense row suppresses the monthly occurrence; zero counts as handled.
10. **Expanded-occurrence evidence:** Weekly/Biweekly Pay, Skip, and AutoPay are resolved per occurrence by dedupe markers because one Cash Flow month cell represents multiple occurrences.
11. **Exactly-once AutoPay:** Per-user locking plus dedupe keys prevent repeated application. Lock contention defers writes without blocking the due-card response.
12. **AutoPay eligibility:** AutoPay requires AutoPay Yes, Varies not Yes, Default Amount greater than zero, a matching Cash Flow Expense row, and a due date strictly before today. Weekly AutoPay additionally requires a recognized Weekday and an occurrence whose calendar weekday matches it; Due Day is never an unattended fallback.
13. **Skip preservation:** Skip writes zero only to a resolved blank target cell; it never overwrites a populated amount or creates a missing Cash Flow row. Marker-only fallback is allowed only for a verified active tracked bill, and monthly/expanded recurrence honor the exact marker.
14. **Soft lifecycle:** Stop tracking changes only Active; Reactivate restores that same stale-guarded row, refuses an active duplicate, preserves payment history, and does not reverse Cash Flow.
15. **Timezone/date basis:** User-facing and marker occurrence dates are date-only values built directly from recurrence year/month/day components; they are not converted through another timezone. Recurrence steps use calendar-date construction rather than fixed milliseconds where DST matters.
16. **Month-end clamping:** Monthly/non-expanded Due Days 29/30/31 remain in their logical month and clamp to its final valid calendar day; they never overflow into the following month.
17. **Payee-rename atomicity:** A Bill Payee rename requires one exact current-year Expense link, no Bill or Cash Flow destination collision, verified Bill/Cash Flow writes, and a successful immutable `bill_update` audit; otherwise all accompanying Bill fields and the linked Payee are restored. Once the audit is durable, every Bills column changed by the edit and the linked Cash Flow Payee column use the shared best-effort content fit; sizing failure never changes the saved result.
18. **AutoPay presentation and commit:** Every monthly or expanded-occurrence AutoPay write verifies its numeric value and `CASH_FLOW_MONEY_FORMAT_`, then requires a newly written and verified immutable marker. Marker failure restores and verifies the exact prior value/formula and number format before the occurrence is returned for reconciliation.

## 10. State and Lifecycle

| State | Entry condition | Allowed actions | Exit condition | Persisted evidence |
| --- | --- | --- | --- | --- |
| Missing/uninitialized | No `INPUT - Bills` sheet | Open empty views; Add | First Add/ensure creates sheet | Canonical header row |
| Active | `Active` normalizes to Yes | Display, generate, Pay, Skip, Edit, Stop tracking | Stop tracking or manual sheet change | Active row in `INPUT - Bills` |
| Schedule-updated | An Edit changes Due Day, Frequency, Weekday, or Anchor Date | Generate only on/after effective floor | Later schedule edit | `Schedule Effective Date`; `bill_update` details |
| Occurrence pending | Generated occurrence lacks handled evidence | Pay, Skip, eligible AutoPay | Payment/skip/autopay evidence appears | Cash Flow cell and/or Activity dedupe marker |
| Occurrence paid manually | Quick add succeeds; expanded occurrences also get `bill_paid` | Historical/read-only for that occurrence | Not applicable | `quick_pay`; expanded recurrence `bill_paid` marker |
| Occurrence skipped | Exact marker is recorded; missing Cash Flow target is active-bill-gated | Historical/read-only for that occurrence | Not applicable | Optional zero Cash Flow value plus required `bill_skip` marker |
| Occurrence autopaid | Eligible past-due AutoPay succeeds | Historical/read-only for that occurrence | Not applicable | Negative Cash Flow amount plus `bill_autopay` marker |
| Inactive | `Active` normalizes to No | Show in inactive inventory; Reactivate | Guarded existing row returns to Active | `Active = No`; `bill_deactivate`; later `bill_reactivate` |

Hard delete is not part of the feature. Add is never a recovery mechanism: it refuses matching active and inactive identities and directs inactive recovery through Reactivate.

## 11. Access, Configuration, and Feature Flags

| Control | Default | Scope | Failure mode | Safe operating rule |
| --- | --- | --- | --- | --- |
| `getUserSpreadsheet_` resolver | Bound-compatible; Central mapping when Central mode is active | All Bills server entry points reviewed | Missing/unresolved workbook causes explicit failure or empty first-run handling | Never substitute an unrelated active workbook in Central mode |
| Central allow-list/mapping | Project configuration | Central users | Upstream access/provisioning failure | Bills must operate only on the resolved user workbook |
| AutoPay `LockService.getUserLock()` | Lock attempted for each Bills Due read | Per user | Lock unavailable → AutoPay writes skipped for that pass; display still returned | Prefer deferred AutoPay to duplicate writes or a blocked dashboard |
| Bills-specific feature flag | `UNKNOWN`; none found in reviewed Bills paths | Bills | Not applicable | Treat changes as live behavior once deployed; verify broader configuration before release |
| Validator guard | `VALIDATOR_ENABLED` plus admin | Developer validation only | Fails closed | Validator reads must never mutate a user workbook |
| Test Harness guard | Harness allow flag and disposable-target assertion | Developer tests only | Fails closed | Never run Bills scenarios against bound, Central-default, canonical, or user workbooks |

Bills has no Bills-specific admin role in the reviewed implementation. Deployment target selection and Central/bounded safety remain governed by `PROJECT_CONTEXT.md`, `WORKING_RULES.md`, and the Engineering OS approval model.

## 12. Failure, Recovery, and Diagnostics

| Failure | User-visible behavior | Diagnostic evidence | Recovery | Data risk |
| --- | --- | --- | --- | --- |
| Bills queue RPC fails | Error under Bills heading and Overview summary | Client failure handler; Apps Script logs | Retry/refresh; inspect workbook structure and logs | Low unless a prior write partially succeeded |
| Missing Bills sheet on read | Calm empty lists | No rows returned | Add bill or run normal ensure path | Low |
| Missing required Bills header | Add/read may throw a named missing-header error; management may return empty | Error/log and sheet header inspection | Explicit schema repair after review | Medium |
| Optional schema self-heal fails | Management continues with available columns; a log entry is written | Apps Script Logger | Correct permissions/schema, then reopen Manage bills | Low to Medium |
| Add Cash Flow seed fails | Bill remains added; success message includes warning | Return fields and Logger | Create/repair Cash Flow row manually or retry safe ensure | Medium: bill may not surface as expected |
| Activity logging fails during Add/Edit/Deactivate | Primary Bills write still succeeds; failure logged | Apps Script Logger | Repair log path; add audit note only through an approved process | Medium: audit gap |
| AutoPay lock unavailable | Cards load; AutoPay deferred | Logger message | Later Bills load retries | Low |
| Weekly/Biweekly Pay marker follow-up fails | Cash Flow payment is saved; UI shows marker failure; occurrence may reappear | Client error and missing `bill_paid` marker | Retry/repair marker carefully without duplicating payment | High reconciliation risk |
| Skip target cannot resolve | Skip returns an error when neither a Cash Flow target nor a verified active tracked bill exists | Error plus workbook/payee inspection | Refresh; repair Bills identity/linkage | Medium |
| Stale Edit/Deactivate row | Explicit moved-row/payee mismatch error | Server error | Refresh management list and retry | Low; guard prevents wrong-row mutation |
| Invalid Biweekly anchor | Client/server asks user to correct it | Validation message | Choose an anchor on the selected weekday or leave optional fields blank for legacy mode | Low |
| Duplicate/variant payee linkage | Monthly matching normalizes some punctuation/case; exact write target may be absent | Bills cards, Cash Flow rows, logs | Manual review; alias repair is not implemented | Medium to High |

Retryable failures include transient reads, lock contention, and stale UI after refresh. User action is required for invalid fields. Admin/developer action may be required for malformed schema, access, or validator configuration. A payment saved without its expanded-occurrence marker must stop automated retry of the payment itself until reconciliation proves whether money was already recorded.

### Multi-step writes and partial success

| Workflow | Write sequence | Atomicity | Possible partial-success state | Safe recovery |
| --- | --- | --- | --- | --- |
| Add bill | Bills row → best-effort `bill_add` Activity → best-effort Cash Flow year/Expense row → dashboard freshness | Non-atomic | Bill exists without Activity evidence or matching Cash Flow row | Preserve the Bills row; repair/seed the Cash Flow row after inspection and add audit evidence only through an approved process |
| Non-rename Edit or Stop tracking | One or more Bills cell changes → best-effort Activity → dashboard freshness | Non-atomic | Edit fields may be partially changed, or the final bill state may lack corresponding audit evidence | Do not repeat the action blindly; refresh and inspect every affected field plus Activity before an approved repair |
| Payee rename | Lock → collision/exact-link preflight → Bill and current-year Cash Flow Payee writes → flush/verify → mandatory `bill_update` audit | Compensating transaction | Apps Script cannot provide a cross-sheet transaction; rollback is best-effort if an API write itself becomes unavailable | Refresh and inspect both exact Payee cells plus Activity before any manual repair |
| Monthly or expanded AutoPay | Lock → Cash Flow amount/format → flush/verify → mandatory new `bill_autopay` marker → verify → freshness | Compensating transaction | Apps Script has no cross-sheet transaction; a failed marker append triggers exact cell restore and verification | The occurrence remains visible after a verified restore; a rollback-verification failure throws and requires inspection before retry |
| Expanded-occurrence Pay | Quick add Cash Flow/`quick_pay` write → separate client RPC for `bill_paid` marker | Non-atomic | Payment is recorded but the occurrence remains visible and may be paid again | Treat Cash Flow as authoritative; do not repay, then reconcile or repair the missing marker |
| Skip | Optional blank-cell zero/format → `bill_skip` Activity marker | Non-atomic | Cash Flow may contain zero without the occurrence marker | Inspect the target cell and Activity; retry only the missing marker path without overwriting a real amount |

## 13. Compatibility and Migration

- Previous behavior: Legacy Weekly/Biweekly schedules used Due Day as a per-month anchor with 7/14-day stepping. Earlier workbooks lacked Weekday, Anchor Date, Schedule Effective Date, and possibly other optional metadata columns.
- Current behavior: Weekday Weekly and anchor-driven Biweekly scheduling are opt-in; blank additions preserve legacy occurrence display/manual handling. Weekly unattended AutoPay requires a recognized matching Weekday. Scheduling edits are prospective when the effective-date column exists.
- Backward-compatibility contract: Bound mode remains unchanged through the shared resolver. `addBillFromDashboard`, `updateTrackedBillFromDashboard`, and `ensureBillsSheetSchema_` normalize header casing in their header maps. `deactivateBillFromDashboard`, `getBillCategoriesFromDashboard`, and `getActiveBillsForManagementFromDashboard` require canonical exact-case header labels, which is a compatibility risk for legacy sheets with casing drift. Blank optional scheduling fields preserve legacy recurrence display/manual handling; Weekly unattended AutoPay fails closed.
- Existing populated workbook impact: Manage/Add can insert missing optional headers after canonical anchors, or at the sheet end when an anchor is unavailable, and format the new columns. Existing cell data is preserved, although anchored insertion can shift existing column positions. Add/Edit/Deactivate/Pay/Skip/AutoPay perform their explicitly scoped writes; no broad restyle or migration is allowed.
- Fresh workbook impact: First Add can create the 14-column Bills sheet and current Cash Flow year, then seed a blank Expense row.
- Migration or self-heal behavior: `ensureBillsSheetSchema_` performs additive, anchor-positioned schema evolution for missing Payment Source, Category, Frequency, Start Month, Notes, Weekday, Anchor Date, and Schedule Effective Date columns. It preserves existing cell data, may shift existing column positions, is best-effort on Manage, and is enforced before Add.
- Rollback limitations: Cash Flow and Activity writes are historical financial evidence and should not be deleted automatically. Code rollback does not undo bills, payments, skips, AutoPay totals, or schema columns already written.

## 14. Testing and Validation

### Existing coverage

| Coverage type | Identifier / file | What it proves | Current result |
| --- | --- | --- | --- |
| Validator | `validatorRunGoldenParity()` / `validator_snapshot.js` | Full parity can classify and compare `INPUT - Bills` formatting when present in both workbooks | `UNKNOWN` — not run in this documentation task; no Bills-specific scoped runner |
| Validator | `getValidatorCanonicalModel_()` / Provisioning Validation | Current Phase 2 structural model | Coverage gap: `INPUT - Bills` is absent from the reviewed canonical model |
| Regression | `REG-007` | Bills Due performance regression is permanently registered | Fixed per documentation; stress reproduction remains planned |
| Regression | `REG-008` | AutoPay concurrency double-post race is permanently registered | Fixed per documentation; overlapping-run harness reproduction remains planned |
| Harness | `REGRESSION-BILLS-EDIT-INTEGRITY` | Exact linked rename, changed text/currency-column sizing, exact 24 px gutter, collisions, category omission fallback, immutable audit, and audit-failure rollback on a disposable workbook | PASS 14/14 on isolated `@341`, run `20260807-154251-d5e9`; fixture `TRASHED`, runner OFF |
| Harness | `SUITE-BILLS-REGRESSION` / `REGRESSION-BILLS-STOP-REACTIVATE` | Stop preserves the row/history, counted inactive discovery, exact stale/duplicate-safe Reactivate, Add refusal for inactive identity, lifecycle Activity, and no false prior-month occurrence after Add | PASS 15/15 scenarios and 123/123 assertions on isolated `@387`; Restricted fixtures TRASHED, runner OFF |
| Regression | `scripts/checkDashboardUxRegressions.mjs` | Shared CashCompass confirmation, no browser-native customer dialog, positive-only inactive count, zero/error hidden state, and final-item collapse | PASS in the `cdbef99` exact local/full candidate |
| Harness | `REGRESSION-BILLS-AUTOPAY-FORMAT` | Real monthly AutoPay writes `-75` with canonical red negative-currency format | Implemented; runtime not yet run |
| Harness | `REGRESSION-BILLS-WEEKDAY-AUTOPAY-GUARD` | Due Day 1 cannot override Sunday/Monday; calendar identity stays stable; missing Weekday fails closed | Implemented; runtime not yet run |
| Harness | `REGRESSION-BILLS-AUTOPAY-ROLLBACK` | Forced Activity failure restores prior Cash Flow value/format and leaves occurrence visible | Implemented; runtime not yet run |
| Harness | `REGRESSION-BILLS-MONTHLY`, `WEEKLY`, `WEEKLY-ON-DAY`, `BIWEEKLY`, `YEAR-BOUNDARY`, `31ST`, `LEAP-FEB29`, `YEARLY` | Pure recurrence math and current edge behavior | Implemented; `NOT RUN` in this documentation task |
| Harness | `REGRESSION-BILLS-MONTHLY-INTEGRATION` | Canonical Bills row plus mandatory `bill_add` Activity evidence | Implemented; `NOT RUN` in this documentation task |
| Harness | `REGRESSION-BILLS-MONTHLY-CASHFLOW` | Bills↔Cash Flow structural payee linkage with blank amounts | Implemented; `NOT RUN` in this documentation task |
| Manual | Bounded user validation on reviewed `456c988` + `faae64a` source | Bill rename/category, Donation management, AutoPay formatting, and Laith/Lutfi/M1 Weekday authority behaved as intended | User-confirmed PASS on `2026-08-03`; no automated writer targeted the bounded workbook |
| Manual | `PROJECT_CONTEXT.md` → Recurrence Engine V2 runtime validation | Named Weekly/Biweekly schedules behaved correctly in runtime observations | Recorded PASS on `2026-07-09`; not independently rerun here |
| Manual | `PROJECT_CONTEXT.md` → Bills Due Pay occurrence bridge | Natural weekly/biweekly Pay flow | `UNKNOWN` / recorded as pending natural runtime validation |

### Minimum change test matrix

- Blank workbook: open Bills, Add first bill, verify 14-column Bills sheet, empty-state behavior, Cash Flow year/row creation, and no future month amounts.
- Existing populated workbook: confirm no data/format wash; only missing optional headers are added; existing rows and user widths are preserved.
- Central App and bounded app: run the same read/Add/Edit/Stop/Pay/Skip flows against explicitly selected safe targets.
- Recurrence: Monthly; legacy Weekly/Biweekly; weekday Weekly; anchored Biweekly; Bimonthly; Quarterly; Semi-annually; Yearly; Start Month; year boundary; short-month month-end clamping.
- Handling: Pay, Skip, AutoPay, Varies, zero/blank cells, repeated refresh, marker failure, and lock contention.
- Data linkage: exact and normalized payees, missing Cash Flow row, Payment Source/Flow Source, inactive debts/bills, and no-due-date fallback exclusions.
- Audit: expected Activity event, dedupe key, non-monetary labels, and no duplicate marker.
- Performance: representative large Bills and Activity fixtures with an agreed threshold.

### Known coverage gaps

- No implemented Bills suite scenario was found for manual Pay, overdue bucketing, per-occurrence paid suppression, per-occurrence Skip, or lock contention. Monthly AutoPay value/format, Weekly weekday authority, stable calendar identity, and audit-failure rollback now have focused coverage.
- Add validation, Deactivate/Reactivate, inactive duplicate refusal, preserved-row recovery, and creation-month floor now have permanent suite coverage and isolated `@387` proof. Optional-column self-heal and broad preservation of every legacy populated Bills variant remain separate coverage gaps.
- No implemented Bills suite scenario was found for the no-due-date fallback/exclusion path, Bimonthly, Quarterly, Semi-annual, or first-run lazy-provisioning and partial-failure behavior.
- No current Central-versus-bounded Bills execution matrix result was found; the same workflows remain to be exercised against explicitly selected safe targets in both modes.
- No implemented stress scenario was found for REG-007 or REG-008 despite their planned reproductions.
- Focused maintenance and full local `npm test` gates passed during the 2026-08-03 reconciliation; the marked-disposable Apps Script scenarios were not runtime-executed.
- The Bills → Pay natural runtime validation remains pending in current project status documentation.
- Bills is absent from `VALIDATOR_SCOPE_OPERATIONAL_` and the Phase 2 canonical provisioning model; dedicated schema/frozen-pane coverage is therefore incomplete.
- Bimonthly behavior is supported by code/UI but omitted from the reviewed Help schedule lists.

## 15. Operations, Release, and Rollback

- Pre-release checks: Run `SUITE-BILLS-REGRESSION`; execute missing manual Pay/Skip/AutoPay checks; inspect `INPUT - Bills`, Cash Flow, and Activity evidence; run applicable Golden parity and release readiness checks; confirm flags/configuration and both app modes when affected.
- Push target: Git source plus the explicitly approved Apps Script target. Bound and Central pushes are separate approval targets.
- Deployment target: Explicitly named bound or Central deployment only; never infer from the current `.clasp` context.
- Post-deployment smoke checks: Open Bills; verify counts; Add/Edit/Stop a disposable test bill; Pay and Skip safe test occurrences; confirm Cash Flow and Activity; confirm repeated refresh does not duplicate AutoPay.
- Observability: Bills status line, Overview summary, `LOG - Activity`, Apps Script Logger, Validator reports, Test Harness reports, and release-readiness evidence.
- Rollback procedure: Revert source/deployment or restore the prior deployment version. Turn off only relevant approved flags. Reconcile any Cash Flow/Activity data created during testing manually; code rollback must not erase financial history.
- Actions requiring separate approval: Any workbook mutation, commit, Git/Apps Script push, or deployment under `agents/orchestrator.md`.

Do not treat readiness as approval. Report commit, push, and deployment readiness separately under the Engineering OS.

## 16. Decisions and Rejected Alternatives

| Decision | Rationale | Rejected alternative | Source |
| --- | --- | --- | --- |
| Cash Flow remains actuals-only | Prevent forecasts from appearing as settled financial history | Fill every future month when a bill is added | `ENGINEERING_STANDARDS.md`; `PROJECT_CONTEXT.md` |
| Weekly/Biweekly use true occurrences at normal amount | Preserves real payment cadence and user actions | Monthly-burden averaging | `PROJECT_CONTEXT.md` → recurrence overhaul |
| Weekday/Anchor scheduling is opt-in | Preserves existing workbook behavior | Automatic migration of every legacy bill | `PROJECT_CONTEXT.md` → Recurrence Engine V2 |
| Invalid Biweekly anchor is not silently corrected | Avoids changing a user-selected schedule without consent | Snap Anchor Date to the selected weekday | `bills.js`; `dashboard_data.js`; `Dashboard_Help.html` |
| Schedule edits are prospective | Preserves Cash Flow and Activity history | Regenerate or rewrite prior occurrences | `bills.js` → `updateTrackedBillFromDashboard`; `PROJECT_CONTEXT.md` |
| Stop tracking is soft deactivate | Retains auditable history | Delete the row | `bills.js`; `Dashboard_Help.html` |
| Expanded occurrences use markers | One monthly Cash Flow cell cannot identify individual weekly/biweekly occurrences | Treat any populated month cell as proof every occurrence was handled | `dashboard_data.js`; `Dashboard_Script_Payments.html` |
| AutoPay lock contention defers writes | Duplicate prevention and responsive UI are higher priority than immediate posting | Block the dashboard or write without a lock | `dashboard_data.js` → `getInputBillsDueRows_` |
| Short-month Due Days clamp to month end | Match user expectations and prevent logical-month/date disagreement | JavaScript overflow into the following month | `REGRESSION_SUITE_PLAN.md` → 31st/leap scenarios; ratified 2026-07-30 |

## 17. Risks, Assumptions, and Open Questions

### Risks

- **High — payment saved but expanded marker missing:** The Cash Flow actual exists while the occurrence may reappear. Mitigation: do not repay automatically; reconcile Activity marker evidence first.
- **High — AutoPay duplicate or missed write:** Concurrency, marker, or payee-link defects can corrupt actuals. Mitigation: lock, dedupe, regression coverage, and manual reconciliation.
- **Medium — duplicate/renamed payees:** Add now refuses matching active and inactive identities under the user lock; Reactivate refuses an active duplicate; Edit renames only its exact linked current-year Cash Flow Expense row under lock and rejects collisions or ambiguous links. Advanced alias/merge repair remains outside this lifecycle slice.
- **Medium — schema drift:** Bills is not yet in the Phase 2 canonical model. Mitigation: retain narrowly scoped, additive, anchor-positioned self-heal and add read-only Validator coverage.
- **Medium — stale documentation/comments:** Historical comments contradict current behavior. Mitigation: use executable evidence and record conflicts until cleaned up.
- **Medium — expanded AutoPay versus manual totals:** Current source adds an unmarked due occurrence to whatever value the shared monthly cell holds, while project documentation says manual protection is preserved. Mitigation: treat this as an unresolved semantic conflict and validate before changing or relying on it.
- **Low to Medium — read path mutation:** Opening Manage bills can insert missing optional columns after canonical anchors or at the sheet end. Mitigation: keep it idempotent, additive, data-preserving, and formatting-scoped; treat it as a schema-evolution write in reviews.

### Assumptions requiring verification

- `DRAFT`: Recurrence Engine V2 runtime results recorded in `PROJECT_CONTEXT.md` still reflect the current deployed build.
- `DRAFT`: The current Bills Due performance remains near the documented ~5.6 seconds on representative mature workbooks.
- `VERIFIED`: Inactive recovery uses Show inactive bills → Reactivate on the guarded preserved row; Add refuses re-add-as-recovery. Isolated `@387` and owner evidence close this lifecycle claim.
- `UNKNOWN`: The full Golden parity runner currently compares a representative `INPUT - Bills` in both configured workbooks and has a known latest result.
- `FIXED LOCALLY`: AutoPay Activity failure restores and verifies the prior Cash Flow cell; Skip remains a separate non-atomic path requiring its existing reconciliation guidance.

### Source and documentation conflicts

| Conflict | Sources | Current executable behavior | Decision / owner / status |
| --- | --- | --- | --- |
| Cash Flow row creation is described as out of scope | `bills.js` top-level comments versus `addBillFromDashboard` | Add best-effort ensures the current Cash Flow year and seeds a matching blank Expense row | Owner: `UNKNOWN`; source-comment cleanup needed; non-blocking for this DRAFT |
| Schema self-heal is described as append-only and as not moving columns | `ensureBillsSheetSchema_` comments versus its `insertColumnBefore` path | Missing columns may be inserted after canonical anchors and shift existing column positions while preserving cell data | Owner: `UNKNOWN`; source-comment and return-wording cleanup needed; non-blocking for this DRAFT |
| Scheduling columns are described as schema-only/unpopulated | `onboarding.js` and `ensureBillsSheetSchema_` comments versus current Add/Edit/recurrence paths | Weekday, Anchor Date, and Schedule Effective Date are actively written/read when configured | Owner: `UNKNOWN`; source-comment cleanup needed; non-blocking for this DRAFT |
| Expanded AutoPay is described as preserving manual totals | `PROJECT_CONTEXT.md` versus expanded-occurrence logic in `getInputBillsDueRows_` | Source accumulates an unmarked eligible occurrence onto the existing monthly value | Owner: `UNKNOWN`; product/financial semantics decision required before relying on or changing this behavior; potentially blocking relevant implementation |
| Bimonthly appears in source/UI but not Help schedule lists | `billAppliesInMonth_` and Bills form versus `Dashboard_Help.html` | Source implements every-two-month cadence | Owner: `UNKNOWN`; product/documentation decision needed; non-blocking for this DRAFT |

### Open questions

- **Blocking verification:** Has the weekly/biweekly Bills → Pay bridge now passed the natural runtime validation still marked pending in `PROJECT_CONTEXT.md`?
- **Resolved 2026-07-30:** Monthly Due Day 29/30/31 clamps to month end; JavaScript overflow is not supported product behavior.
- **Coverage ownership:** When will Bills be added to `VALIDATOR_SCOPE_OPERATIONAL_` and `getValidatorCanonicalModel_` with a shared header constant?
- **Failure atomicity:** Should expanded-occurrence Pay marker creation be moved into the same server transaction/path as the Cash Flow write to reduce partial-success risk?
- **Frequency semantics:** Is the label “Bimonthly” unambiguously intended to mean every two months, as `billAppliesInMonth_` implements?

## 18. Change Impact Checklist

Before changing this feature, determine whether the change affects:

- [ ] User-visible behavior or Help content
- [ ] Central App behavior
- [ ] Bounded app behavior
- [ ] Existing populated workbooks
- [ ] Fresh provisioning or first-create behavior
- [ ] Workbook schema, formulas, formatting, or validation
- [ ] Financial calculations or reconciliation
- [ ] Activity Log or audit history
- [ ] Permissions, feature flags, or admin controls
- [ ] Validators, regression scenarios, or test harness coverage
- [ ] Documentation, roadmap, release readiness, or rollback notes

All items are intentionally left unchecked in this DRAFT; the expert must evaluate them for each concrete Bills change.

## 19. Feature Expert Answer Contract

When answering questions or handing off work, the Bills feature expert must:

1. Lead with the current verified behavior.
2. Cite the supporting file, function, sheet, scenario, or runtime evidence.
3. Label planned behavior and assumptions explicitly.
4. State Central App, bounded app, and workbook impact when relevant.
5. Identify safety risks and approval gates before proposing mutation.
6. Call out stale or conflicting knowledge instead of guessing.
7. Recommend the smallest safe next step and the existing coverage to reuse.

## 20. Maintenance and Completion

### Refresh triggers

Re-verify this document when any of the following changes:

- Bills user workflow, navigation, form, or card behavior
- `bills.js`, Bills-related `dashboard_data.js`, Quick add bridge, or Activity semantics
- `INPUT - Bills` or Cash Flow schema, formulas, formatting, or ownership
- Recurrence, handled-cell, AutoPay, Skip, Pay, amount, date, or timezone semantics
- Central/bounded resolution, feature flags, permissions, provisioning, or recovery behavior
- Bills Validator, regression, harness, runtime validation, or release requirements
- Product decision, compatibility contract, or deprecation status

### Structural completion checklist

- [x] All template placeholders are replaced with evidence, `DRAFT`, `UNKNOWN`, or a reasoned Not applicable statement.
- [x] Every required section is present.
- [x] Current and planned behavior are separated.
- [x] Central and bounded behavior are addressed.
- [x] Populated-workbook safety and first-create behavior are addressed.
- [x] Secrets and user data are absent.
- [x] Metadata contains template revision `1.1`, a verification date, and the source Git reference reviewed.
- [x] `agents/knowledge-map.md` links to this feature document and mirrors its `DRAFT` status.

`Template completeness` is `COMPLETE` because the structural checklist passes.

### Behavioral verification checklist

- [x] Material claims cite repository or recorded runtime evidence with an explicit verification state in the evidence inventory.
- [x] Callable, scheduled, and downstream entry points and consumers are inventoried at DRAFT depth.
- [x] Read-path mutations are documented.
- [ ] Every invariant maps to executed current tests; known gaps remain in AutoPay, Pay, Skip, overdue, performance, and concurrency coverage.
- [x] Multi-step writes, partial-success states, and safe recovery are documented at DRAFT depth.
- [x] Failure, recovery, diagnostics, and rollback are documented at DRAFT depth.
- [x] Source/documentation conflicts are explicitly tracked with current behavior, status, and ownership (`UNKNOWN` where not established).

Knowledge status remains `DRAFT` until the unchecked behavioral-verification requirement and the blocking verification questions are resolved.
