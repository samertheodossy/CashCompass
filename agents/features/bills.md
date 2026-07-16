# Bills

## 1. Knowledge Metadata

| Field | Value |
| --- | --- |
| Feature slug | `bills` |
| Domain | Bills / Cash Flow |
| Knowledge status | `DRAFT` |
| Product status | Shipped / Beta; Recurrence Engine V2 is shipped, while natural runtime validation of the expanded-occurrence Pay bridge remains recorded as pending |
| Feature expert | Bills feature expert |
| Last verified date | `2026-07-16` |
| Last verified Git reference | `a2b35f3` |
| Applies to | Central App and bounded app |
| Primary user surfaces | Cash Flow → Bills → Due this period; Cash Flow → Bills → Manage bills; Overview Bills cards; Quick add; `INPUT - Bills`; `INPUT - Cash Flow <year>`; `LOG - Activity` |
| Canonical source documents | [`PROJECT_CONTEXT.md`](../../PROJECT_CONTEXT.md) → “Weekly/Biweekly Weekday Recurrence Support” and “Cash Flow Semantics”; [`ENGINEERING_STANDARDS.md`](../../ENGINEERING_STANDARDS.md) → “Cash Flow Data Semantics — Actuals vs Projection”; [`Dashboard_Help.html`](../../Dashboard_Help.html) → Bills; [`REGRESSION_SUITE_PLAN.md`](../../REGRESSION_SUITE_PLAN.md) → Bills recurrence |

### Knowledge status rules

- `DRAFT`: Discovery is incomplete or material claims remain unverified.
- `VERIFIED`: All required sections are supported by current repository evidence and relevant tests or runtime observations.
- `STALE`: A material implementation or product decision changed after the last verification.
- `DEPRECATED`: The feature is no longer active; the document remains only for historical or migration context.

Current DRAFT rationale: test results were not executed during this documentation pass, natural runtime validation of the expanded-occurrence Pay bridge is still listed as pending, and Validator/test coverage gaps remain.

## 2. Feature Summary

### User promise

Bills helps a user track recurring obligations, see overdue and near-term occurrences, pay or skip individual occurrences, and maintain the underlying recurring-bill list without editing the workbook directly.

### Current behavior

The Bills page has two views. **Due this period** combines dated items from active debts and active `INPUT - Bills` rows into Overdue and Next 7 Days queues, plus a Cash-Flow-derived fallback list for recurring items without a mapped due date. **Manage bills** lists active `INPUT - Bills` rows and supports Add, Edit, and Stop tracking.

Recurring `INPUT - Bills` rows support Monthly, Weekly, Biweekly, Bimonthly, Quarterly, Semi-annually, and Yearly schedules in source and UI. Weekly can use a weekday; Biweekly can use a weekday plus an Anchor Date for a true 14-day cadence. Blank scheduling fields preserve legacy Due Day behavior; the recurrence reader also falls back safely on unusable legacy configuration, while Add/Edit rejects an inconsistent Biweekly weekday and anchor. Schedule edits are prospective when `Schedule Effective Date` is available.

Pay opens Quick add with bill details prefilled. Skip writes a zero only into a blank Cash Flow month cell and always records a deduplicated `bill_skip` marker. AutoPay records past-due actual activity, not forecasts. Weekly/Biweekly occurrences use per-occurrence activity markers because multiple occurrences share one monthly Cash Flow cell.

### Business and financial significance

Bills affects near-term cash decisions and the Cash Flow actuals ledger. Incorrect occurrence dates, duplicate AutoPay writes, lost Pay/Skip markers, or payee-link drift can overstate or understate cash obligations and erode user trust. The project therefore treats recurrence correctness, exactly-once writes, populated-workbook preservation, and the actuals-versus-projection boundary as financial invariants.

## 3. Scope and Boundaries

### In scope

- Add recurring bills to `INPUT - Bills` and seed a matching blank Cash Flow Expense row when possible.
- Read and manage active bill rows.
- Edit supported fields in place with stale-row protection and prospective schedule changes.
- Stop tracking by setting `Active = No`; preserve the row and history.
- Generate dated occurrences and split them into Overdue and Next 7 Days.
- Surface recurring Cash Flow items without a mapped due date.
- Route Pay through Quick add and preserve Payment Source → Flow Source.
- Record Skip, Pay, and AutoPay occurrence evidence in `LOG - Activity`.
- Support legacy Due Day, weekday Weekly, and anchor-driven Biweekly recurrence.

### Out of scope

- Hard deletion of bill rows.
- Automatic renaming or reclassification of existing Cash Flow rows when a bill is edited.
- A dedicated Bills reactivation workflow; current source directs users to re-add an inactive bill.
- Forward projection of scheduled bill amounts into future Cash Flow months.
- Bank-payment execution, bank connectivity, or confirmation that an external payment cleared.
- Advanced alias-repair or merge workflows for duplicate/renamed payees.

### Planned but not implemented

- Cash Flow forward projection is planned separately; see [`PROJECT_CONTEXT.md`](../../PROJECT_CONTEXT.md) → “Cash Flow Semantics — Actuals, not Projection” and the linked `TODO.md` entry.
- Dedicated Bills lifecycle consistency/reactivation is part of the future Shared Entity Lifecycle Framework in [`PROJECT_CONTEXT.md`](../../PROJECT_CONTEXT.md).
- Bills AutoPay, manual Pay, overdue, paid-occurrence, and performance/concurrency harness coverage listed without an implemented marker remains planned in [`REGRESSION_SUITE_PLAN.md`](../../REGRESSION_SUITE_PLAN.md).
- Bills-specific inclusion in the Phase 2 Validator canonical model and scoped Operational runner is not implemented in the reviewed code.

### Intentional constraints

- Cash Flow is an actuals ledger. Adding a bill seeds structure but no monthly amounts.
- AutoPay requires the due date to have passed; it must not fill future months.
- Blank Weekday/Anchor Date preserves legacy Due Day scheduling.
- An invalid Biweekly weekday/anchor combination is rejected by Add/Edit; the recurrence reader defensively falls back to legacy behavior rather than silently snapping the date.
- Payee edits never rewrite historical Cash Flow payee text or Activity entries.
- Stop tracking is a soft deactivate and never reverses payments.
- Monthly high Due Days currently use JavaScript date overflow rather than month-end clamping; this is characterized, not approved as a final product decision.

## 4. Authoritative Evidence

| Subject | Authoritative source | Evidence type | Last verified |
| --- | --- | --- | --- |
| Product behavior | `Dashboard_Help.html` → Bills; `PROJECT_CONTEXT.md` → Recurrence Engine V2 and actuals semantics | User documentation and decision record | `2026-07-16` |
| Add/Edit/Deactivate | `bills.js` → `addBillFromDashboard`, `updateTrackedBillFromDashboard`, `deactivateBillFromDashboard` | Source code | `2026-07-16` |
| Occurrence and queue behavior | `dashboard_data.js` → `getBillsDueFromCashFlowForDashboard`, `getInputBillsDueRows_`, `buildRuleFromBillRow_`, `generateOccurrences_` | Source code | `2026-07-16` |
| Pay/Skip/AutoPay | `Dashboard_Script_BillsDue.html`, `Dashboard_Script_Payments.html`, `quick_add_payment.js`, `dashboard_data.js` | Client/server source code | `2026-07-16` |
| Workbook contract | `onboarding.js` → `ensureOnboardingBillsSheetFromDashboard`; `bills.js` → `ensureBillsSheetSchema_`, `applyBillsSheetStyling_` | Schema and creation source | `2026-07-16` |
| Activity contract | `activity_log.js`; Bills write paths in `bills.js` and `dashboard_data.js` | Source code | `2026-07-16` |
| Test coverage | `test_harness_scenarios_bills.js`; `test_harness_suites.js`; `REGRESSION_SCENARIOS.md`; `REGRESSION_SUITE_PLAN.md` | Automated scenario definitions and plans | `2026-07-16` |
| Validator coverage | `validator_snapshot.js`, `validator_core.js`, `validator_rules.js`, `VALIDATOR_ARCHITECTURE.md` | Read-only Validator implementation/design | `2026-07-16` |

When sources disagree, this DRAFT follows executable behavior and higher-precedence Engineering OS instructions, while recording the disagreement under Open Questions. It does not silently rewrite historical documentation.

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
| Due card → Pay | Authorized CashCompass user | Card exists | Opens Quick add with Expense/payee/date/amount/Flow Source; save writes Cash Flow and Activity |
| Due card → Skip | Authorized CashCompass user | Skip target resolves to a Cash Flow cell | Records the occurrence skipped and writes zero only if the cell is blank |

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
- Empty, stale, duplicate, or invalid input: Required values fail with explicit errors. Edit/Deactivate compare row number plus expected payee to prevent writing a shifted row. Duplicate-payee Add behavior is `UNKNOWN`; no explicit duplicate guard was found in `addBillFromDashboard`.
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
| Weekday | Optional Weekly/Biweekly scheduling field | Blank means legacy Due Day behavior |
| Anchor Date | The parity origin for true Biweekly 14-day cadence | It must fall on the selected weekday; it is not silently corrected |
| Schedule Effective Date | Prospective floor stamped when scheduling fields change | It does not rewrite historical occurrences |
| Stop tracking | Set `Active = No` while preserving the row and history | It is not deletion and does not reverse money movement |

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

### Request and write path

1. `loadDashboardActionSections` starts the three Bills reads.
2. Server entry points call `getUserSpreadsheet_` and read Bills, Debts, Cash Flow, Upcoming, and Activity state as required.
3. `getInputBillsDueRows_` converts each active Bills row into a recurrence rule, generates the prior/current/next-month window, resolves handled evidence, and may AutoPay past-due occurrences.
4. `getBillsDueFromCashFlowForDashboard` merges debt and input-bill rows and buckets them into Overdue or Next 7 Days.
5. Pay routes through Quick add; Skip resolves the target Cash Flow cell; Manage actions write Bills rows. Success handlers refresh the affected views.

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
| `LOG - Activity` | Dedupe markers for AutoPay/Pay/Skip | `bill_add`, `bill_update`, `bill_deactivate`, `bill_skip`, `bill_autopay`, `bill_paid`, plus `quick_pay` | Shared Activity | Activity writes are best-effort for Add/Edit/Deactivate; occurrence handling relies on markers for expanded recurrence |
| `INPUT - Debts` | Active debt items, payment-source inference, recurring-fallback exclusions | None from Bills management | Debts | Debt-backed cards are adjacent Bills Due inputs, not Bills rows |
| `INPUT - Upcoming Expenses` | Payee exclusion for no-due-date recurrence fallback | None from Bills | Upcoming Expenses | Prevents project spend from being misclassified as a recurring bill |

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
| Frequency | Canonical label | Recurrence cadence | Required by Add/Edit payload; optional legacy header | Reader normalization defaults unknown to Monthly | Accepted-label allow-list on writes |
| Start Month | Integer 1–12 | Eligibility/cadence anchor | Optional | Current month on Add; reader fallback `1` | Integer range |
| Notes | Text, max 500 | User context | Optional | Blank | Trim/truncate |
| Weekday | Full weekday label | Weekly weekday; Biweekly weekday partner | Optional | Blank → legacy Due Day | Recognized label on write normalization |
| Anchor Date | `yyyy-MM-dd` or parseable Date | Biweekly parity origin | Optional | Blank → legacy Due Day | Must match Weekday on Add/Edit |
| Schedule Effective Date | Date/`yyyy-MM-dd` | Floor for prospective schedule changes | Optional | Blank → no clamp/legacy | Written as today when schedule fields change and header exists |

### Workbook invariants

- Canonical first-create order is the 14 columns listed above; `INPUT - Bills` is a flat Operational sheet with a frozen header and no totals.
- Required read anchors are Payee, Due Day, Default Amount, and Active.
- Optional schema evolution is idempotent and header-scoped. `ensureBillsSheetSchema_` detects existing headers case-insensitively, inserts missing columns after a canonical anchor or at the sheet end, and preserves existing cell data even when insertion shifts existing column positions.
- Fresh-sheet styling is first-create only. Schema evolution formats only the new column and applies widen-only canonical widths.
- Add inserts in Due Day order; same-day rows follow existing same-day rows and blank Due Day legacy rows remain at the bottom.
- Edit updates in place and never changes row order.
- Existing Cash Flow rows are left untouched when Add finds the same Expense payee, or when a bill payee/payment source changes later.

## 9. Behavioral and Financial Invariants

1. **Actuals, not projection:** Add creates a blank Cash Flow Expense row but never seeds scheduled future month amounts.
2. **Expense sign:** Pay and AutoPay write expenses as negative Cash Flow amounts; configured Default Amount and UI amounts remain non-negative magnitudes rounded to cents.
3. **Due window:** Occurrence generation covers prior, current, and next month; the visible queue includes overdue dates and dates zero through seven days ahead.
4. **Start Month:** A bill must not generate or AutoPay before its Start Month in the current year; recurring eligibility continues in later years.
5. **Weekly weekday:** A recognized Weekday produces a continuous seven-day cadence across month boundaries and ignores Due Day for occurrence placement.
6. **Biweekly anchor:** A valid Weekday plus Anchor Date produces a DST-safe 14-calendar-day cadence across month/year boundaries and never emits before the anchor.
7. **Legacy compatibility:** Missing/blank/unrecognized weekday data, or unusable Biweekly anchor data on the read path, preserves legacy Due Day scheduling.
8. **Prospective changes:** Schedule edits stamp an effective-date floor when the column exists; prior Cash Flow and Activity history are not rewritten.
9. **Monthly handled evidence:** A populated numeric Cash Flow month cell on any normalized matching Expense row suppresses the monthly occurrence; zero counts as handled.
10. **Expanded-occurrence evidence:** Weekly/Biweekly Pay, Skip, and AutoPay are resolved per occurrence by dedupe markers because one Cash Flow month cell represents multiple occurrences.
11. **Exactly-once AutoPay:** Per-user locking plus dedupe keys prevent repeated application. Lock contention defers writes without blocking the due-card response.
12. **AutoPay eligibility:** AutoPay requires AutoPay Yes, Varies not Yes, Default Amount greater than zero, a matching Cash Flow Expense row, and a due date strictly before today.
13. **Skip preservation:** Skip writes zero only to a blank target cell; it never overwrites a populated amount and always attempts to record the exact occurrence marker.
14. **Soft lifecycle:** Stop tracking changes only Active, preserves the row and payment history, and does not reverse Cash Flow.
15. **Timezone/date basis:** User-facing and marker dates are date-only values formatted using the Apps Script timezone; recurrence steps use calendar-date construction rather than fixed milliseconds where DST matters.
16. **Current monthly overflow characterization:** Monthly/non-expanded `new Date(year, month, dueDay)` can overflow Due Day 29/30/31 into the next month instead of clamping. Tests characterize this behavior; product intent is UNKNOWN.

## 10. State and Lifecycle

| State | Entry condition | Allowed actions | Exit condition | Persisted evidence |
| --- | --- | --- | --- | --- |
| Missing/uninitialized | No `INPUT - Bills` sheet | Open empty views; Add | First Add/ensure creates sheet | Canonical header row |
| Active | `Active` normalizes to Yes | Display, generate, Pay, Skip, Edit, Stop tracking | Stop tracking or manual sheet change | Active row in `INPUT - Bills` |
| Schedule-updated | An Edit changes Due Day, Frequency, Weekday, or Anchor Date | Generate only on/after effective floor | Later schedule edit | `Schedule Effective Date`; `bill_update` details |
| Occurrence pending | Generated occurrence lacks handled evidence | Pay, Skip, eligible AutoPay | Payment/skip/autopay evidence appears | Cash Flow cell and/or Activity dedupe marker |
| Occurrence paid manually | Quick add succeeds; expanded occurrences also get `bill_paid` | Historical/read-only for that occurrence | Not applicable | `quick_pay`; expanded recurrence `bill_paid` marker |
| Occurrence skipped | Skip target resolves | Historical/read-only for that occurrence | Not applicable | Optional zero Cash Flow value plus `bill_skip` marker |
| Occurrence autopaid | Eligible past-due AutoPay succeeds | Historical/read-only for that occurrence | Not applicable | Negative Cash Flow amount plus `bill_autopay` marker |
| Inactive | `Active` normalizes to No | Preserved in sheet/history; excluded from management and generation | Dedicated reactivation is not implemented; source says re-add | `Active = No`; `bill_deactivate` |

Hard delete is not part of the feature. Dedicated Bills reactivation semantics, including duplicate-row behavior when re-adding, remain DRAFT/UNKNOWN.

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
| Skip target cannot resolve | Skip returns an error and should not write | Error plus workbook/payee inspection | Refresh; repair Bills↔Cash Flow mapping | Medium |
| Stale Edit/Deactivate row | Explicit moved-row/payee mismatch error | Server error | Refresh management list and retry | Low; guard prevents wrong-row mutation |
| Invalid Biweekly anchor | Client/server asks user to correct it | Validation message | Choose an anchor on the selected weekday or leave optional fields blank for legacy mode | Low |
| Duplicate/variant payee linkage | Monthly matching normalizes some punctuation/case; exact write target may be absent | Bills cards, Cash Flow rows, logs | Manual review; alias repair is not implemented | Medium to High |

Retryable failures include transient reads, lock contention, and stale UI after refresh. User action is required for invalid fields. Admin/developer action may be required for malformed schema, access, or validator configuration. A payment saved without its expanded-occurrence marker must stop automated retry of the payment itself until reconciliation proves whether money was already recorded.

## 13. Compatibility and Migration

- Previous behavior: Legacy Weekly/Biweekly schedules used Due Day as a per-month anchor with 7/14-day stepping. Earlier workbooks lacked Weekday, Anchor Date, Schedule Effective Date, and possibly other optional metadata columns.
- Current behavior: Weekday Weekly and anchor-driven Biweekly scheduling are opt-in; blank additions preserve legacy. Scheduling edits are prospective when the effective-date column exists.
- Backward-compatibility contract: Bound mode remains unchanged through the shared resolver. `addBillFromDashboard`, `updateTrackedBillFromDashboard`, and `ensureBillsSheetSchema_` normalize header casing in their header maps. `deactivateBillFromDashboard`, `getBillCategoriesFromDashboard`, and `getActiveBillsForManagementFromDashboard` require canonical exact-case header labels, which is a compatibility risk for legacy sheets with casing drift. Blank optional scheduling fields preserve legacy recurrence.
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
| Harness | `SUITE-BILLS-REGRESSION` | Eight pure recurrence scenarios plus two workbook-integration scenarios | Implemented; `NOT RUN` in this documentation task |
| Harness | `REGRESSION-BILLS-MONTHLY`, `WEEKLY`, `WEEKLY-ON-DAY`, `BIWEEKLY`, `YEAR-BOUNDARY`, `31ST`, `LEAP-FEB29`, `YEARLY` | Pure recurrence math and current edge behavior | Implemented; `NOT RUN` in this documentation task |
| Harness | `REGRESSION-BILLS-MONTHLY-INTEGRATION` | Canonical Bills row plus mandatory `bill_add` Activity evidence | Implemented; `NOT RUN` in this documentation task |
| Harness | `REGRESSION-BILLS-MONTHLY-CASHFLOW` | Bills↔Cash Flow structural payee linkage with blank amounts | Implemented; `NOT RUN` in this documentation task |
| Manual | `PROJECT_CONTEXT.md` → Recurrence Engine V2 runtime validation | Named Weekly/Biweekly schedules behaved correctly in runtime observations | Recorded PASS on `2026-07-09`; not independently rerun here |
| Manual | `PROJECT_CONTEXT.md` → Bills Due Pay occurrence bridge | Natural weekly/biweekly Pay flow | `UNKNOWN` / recorded as pending natural runtime validation |

### Minimum change test matrix

- Blank workbook: open Bills, Add first bill, verify 14-column Bills sheet, empty-state behavior, Cash Flow year/row creation, and no future month amounts.
- Existing populated workbook: confirm no data/format wash; only missing optional headers are added; existing rows and user widths are preserved.
- Central App and bounded app: run the same read/Add/Edit/Stop/Pay/Skip flows against explicitly selected safe targets.
- Recurrence: Monthly; legacy Weekly/Biweekly; weekday Weekly; anchored Biweekly; Bimonthly; Quarterly; Semi-annually; Yearly; Start Month; year boundary; short-month overflow.
- Handling: Pay, Skip, AutoPay, Varies, zero/blank cells, repeated refresh, marker failure, and lock contention.
- Data linkage: exact and normalized payees, missing Cash Flow row, Payment Source/Flow Source, inactive debts/bills, and no-due-date fallback exclusions.
- Audit: expected Activity event, dedupe key, non-monetary labels, and no duplicate marker.
- Performance: representative large Bills and Activity fixtures with an agreed threshold.

### Known coverage gaps

- No implemented Bills suite scenario was found for AutoPay, manual Pay, overdue bucketing, per-occurrence paid suppression, per-occurrence Skip, or lock contention.
- No implemented stress scenario was found for REG-007 or REG-008 despite their planned reproductions.
- No test result was executed during this documentation-only task.
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
| Short-month overflow remains characterized | Avoid an unapproved behavior change | Clamp Monthly Due Day to month end | `REGRESSION_SUITE_PLAN.md` → 31st/leap scenarios |

## 17. Risks, Assumptions, and Open Questions

### Risks

- **High — payment saved but expanded marker missing:** The Cash Flow actual exists while the occurrence may reappear. Mitigation: do not repay automatically; reconcile Activity marker evidence first.
- **High — AutoPay duplicate or missed write:** Concurrency, marker, or payee-link defects can corrupt actuals. Mitigation: lock, dedupe, regression coverage, and manual reconciliation.
- **Medium — duplicate/renamed payees:** Add has no explicit duplicate guard, and Edit intentionally does not rename Cash Flow rows. Mitigation: inspect matching rows and avoid casual renames.
- **Medium — schema drift:** Bills is not yet in the Phase 2 canonical model. Mitigation: retain narrowly scoped, additive, anchor-positioned self-heal and add read-only Validator coverage.
- **Medium — stale documentation/comments:** Historical comments contradict current behavior. Mitigation: use executable evidence and record conflicts until cleaned up.
- **Medium — expanded AutoPay versus manual totals:** Current source adds an unmarked due occurrence to whatever value the shared monthly cell holds, while project documentation says manual protection is preserved. Mitigation: treat this as an unresolved semantic conflict and validate before changing or relying on it.
- **Low to Medium — read path mutation:** Opening Manage bills can insert missing optional columns after canonical anchors or at the sheet end. Mitigation: keep it idempotent, additive, data-preserving, and formatting-scoped; treat it as a schema-evolution write in reviews.

### Assumptions requiring verification

- `DRAFT`: Recurrence Engine V2 runtime results recorded in `PROJECT_CONTEXT.md` still reflect the current deployed build.
- `DRAFT`: The current Bills Due performance remains near the documented ~5.6 seconds on representative mature workbooks.
- `UNKNOWN`: Re-adding an inactive payee is the intended long-term Bills reactivation behavior rather than a temporary workaround.
- `UNKNOWN`: The full Golden parity runner currently compares a representative `INPUT - Bills` in both configured workbooks and has a known latest result.
- `UNKNOWN`: Activity-log failure during AutoPay/Skip cannot leave a Cash Flow write without durable handled evidence in all exception paths.

### Open questions

- **Blocking verification:** Has the weekly/biweekly Bills → Pay bridge now passed the natural runtime validation still marked pending in `PROJECT_CONTEXT.md`?
- **Product decision:** Should Monthly Due Day 29/30/31 clamp to month end or retain JavaScript overflow?
- **Documentation inconsistency:** Should Bimonthly be added to Help schedule lists, or is it intentionally being retired despite source/UI support?
- **Source-comment inconsistency:** `bills.js` still labels Cash Flow auto-row creation out of scope even though `addBillFromDashboard` now performs it. Which comments should be updated?
- **Source-comment inconsistency:** `ensureBillsSheetSchema_` comments describe self-heal as “append-only” and as not moving existing columns, while the implementation can use `insertColumnBefore` at a canonical anchor and therefore shift existing column positions. Should the source comments and return-value wording be corrected to describe additive, anchor-positioned schema evolution?
- **Source-comment inconsistency:** Some `onboarding.js`/`ensureBillsSheetSchema_` comments say scheduling columns are schema-only and unpopulated, while current Add/Edit/recurrence code uses them. Should these comments be refreshed?
- **Behavior/documentation conflict:** `PROJECT_CONTEXT.md` says expanded AutoPay preserves manual values, while the current weekly/biweekly source deliberately accumulates onto any existing monthly value when no occurrence marker exists. What is the intended protection rule when a manual total may already include the occurrence?
- **Coverage ownership:** When will Bills be added to `VALIDATOR_SCOPE_OPERATIONAL_` and `getValidatorCanonicalModel_` with a shared header constant?
- **Lifecycle:** Should Bills gain a dedicated Reactivate flow and duplicate-name protection under the Shared Entity Lifecycle Framework?
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

### Verification checklist

- [x] All template placeholders are replaced with evidence, `DRAFT`, `UNKNOWN`, or a reasoned Not applicable statement.
- [x] Every required section is present.
- [x] Current and planned behavior are separated.
- [x] Material claims cite repository or recorded runtime evidence.
- [x] Central and bounded behavior are addressed.
- [x] Populated-workbook safety and first-create behavior are addressed.
- [ ] Every invariant maps to executed current tests; known gaps remain in AutoPay, Pay, Skip, overdue, performance, and concurrency coverage.
- [x] Failure, recovery, diagnostics, and rollback are documented at DRAFT depth.
- [x] Secrets and user data are absent.
- [x] Metadata contains a verification date and Git reference.
- [x] `agents/knowledge-map.md` links to this feature document.

Knowledge status remains `DRAFT` until the unchecked evidence requirement and the blocking verification questions are resolved.
