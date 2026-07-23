# CashCompass Independent User Advocate

## Purpose

Use an independent, read-only product reviewer to experience CashCompass as a user and provide candid usability feedback. The advocate is evidence for the UX cleanup backlog; it does not approve releases, modify product code, change workbook data, or replace human review.

The advocate should report:

- what works well;
- what is confusing;
- what is difficult to complete;
- what does not make sense;
- which screens look visually wrong or inconsistent;
- whether navigation and page hierarchy are understandable;
- how easy the product is to use;
- whether the color, contrast, spacing, and typography support readability;
- whether loading, success, empty, stale, and failure states are trustworthy.

## Safety and evidence rules

- Never use the bounded workbook as a test target.
- Do not perform workbook writes during a read-only usability journey.
- Any journey that requires Save, Pay, Skip, Stop tracking, Add, Remove, or another writer must use a harness-created disposable workbook and separate implementation/test approval.
- Do not inspect browser cookies, passwords, storage, profiles, or unrelated tabs.
- Do not claim an interaction was tested when the evidence came only from screenshots or source inspection.
- Label evidence as one of:
  - **Interactive** — observed by navigating and using the rendered product.
  - **Screenshot** — assessed from supplied images.
  - **Source review** — inferred from code without rendered interaction.
- Preserve one common Central/bounded source path. UX recommendations must not introduce a bounded-only code path.

## Review journeys

Run each journey as a first-time user would, without relying on implementation knowledge.

1. **Orientation**
   - Open CashCompass.
   - Explain what the product is for and identify the first useful action.
   - Review Overview hierarchy, terminology, attention states, and navigation.
2. **Assets & Liabilities**
   - Find House values, Bank accounts, Investments, and Debt accounts.
   - Assess selection, empty states, update/add modes, summaries, and Stop tracking guidance.
   - Do not save changes outside a disposable writer run.
3. **Cash Flow**
   - Locate Quick add, Upcoming, Donations, Bills, and Income.
   - Explain the difference between recording money, paying/skipping a bill, and managing recurring definitions.
4. **Properties**
   - Find House expenses and Property performance.
   - Verify that property and period context remain clear.
5. **Planning**
   - Explain the difference between Debt overview, Rolling debt payoff, Retirement, and Purchase simulator.
   - Confirm that scenario adjustments remain separate from live financial position.
6. **Setup and Help**
   - Determine whether setup progress and the next action are obvious.
   - Find help for a task without needing spreadsheet terminology.
7. **Responsive and state review**
   - Repeat key navigation at supported desktop and narrow widths.
   - Observe loading, empty, success, stale, and failure states when safe evidence is available.

## Required report format

For every review, provide:

1. Overall impression and confidence level.
2. Scorecard with every criterion scored out of 10, the weighted overall score
   out of 10, evidence type, and a one-sentence rationale.
3. What is good.
4. What is confusing.
5. What is hard to do.
6. What does not make sense.
7. Screens or components that look wrong.
8. Navigation findings.
9. Ease-of-use assessment.
10. Color, contrast, spacing, and typography findings.
11. Trust and feedback-state findings.
12. Prioritized issues with severity, affected screen, evidence type, and recommendation.
13. Top three improvements.
14. Retest checklist.

### Required 10-point scorecard

Score the same eight criteria on every run so progress is comparable rather than
impressionistic:

| Criterion | Weight | A 10/10 means |
|---|---:|---|
| Errors and task completion | 20% | Reviewed tasks complete without broken, misleading, or unsafe behavior. |
| Ease and efficiency | 15% | A first-time user can complete the journey confidently with little friction. |
| Language and comprehension | 10% | Labels, instructions, and feedback use direct customer language without implementation jargon. |
| Transitions and feedback | 15% | Navigation handoffs, loading, success, empty, stale, and failure states clearly explain what happened and what comes next. |
| Visual design and readability | 10% | Color, contrast, spacing, typography, hierarchy, and density feel intentional and readable. |
| Navigation and discoverability | 10% | Destinations and relationships are easy to find and explain without product knowledge. |
| Trust and safety | 15% | Financial state, writer boundaries, confirmations, history preservation, and data consequences are trustworthy. |
| Responsive and accessibility | 5% | Supported desktop/narrow layouts, keyboard use, focus, names, targets, contrast, and reduced motion are usable. |

Calculate the weighted overall score to one decimal place:

`overall = Σ(criterion score × criterion weight)`

The report must also show the change from the previous comparable run. Use
**Baseline** when no comparable prior score exists. A criterion that was not
meaningfully exercised must be marked **Not fully evidenced** and cannot score
above 7/10. Do not award points based only on source intent when rendered behavior
was available for review.

Use these anchors consistently:

- **10 — Excellent:** no material issue or evidence gap in the reviewed scope.
- **8 — Good:** usable and trustworthy, with limited non-blocking friction.
- **6 — Mixed:** task is possible, but confusion or repeated friction is material.
- **4 — Poor:** major difficulty, misleading state, or unreliable feedback.
- **2 — Failing:** core task is blocked, unsafe, or substantially broken.

Severity constrains the overall result: any unresolved P0 caps the overall score at
5.9/10; any unresolved P1 in the reviewed scope caps it at 8.9/10. The score is
usability evidence, not a release approval, and it does not replace the stricter
Beta readiness scorecard or automated release gates.

### Score-to-10 execution order

Improve and rescore only one criterion at a time:

1. Errors and task completion.
2. Trust and safety.
3. Transitions and feedback.
4. Ease and efficiency.
5. Language and comprehension.
6. Navigation and discoverability.
7. Visual design and readability.
8. Responsive and accessibility.

For each criterion, the advocate must identify every confirmed defect and evidence
gap, state what a 10/10 requires, and refuse to award 10 while any material issue
or untested branch remains. Engineering then implements the smallest coherent
wave, adds permanent regression coverage, and produces isolated exact-candidate
runtime evidence before the advocate rescores. The detailed baseline deductions,
fix path, and closing evidence are maintained in
`TODO.md → Advocate 10/10 score-improvement program`.

Severity:

- **P0 — Blocking:** prevents a core task, risks data, or makes the product unsafe.
- **P1 — High:** repeated confusion or a major trust/navigation failure.
- **P2 — Medium:** meaningful friction, ambiguity, or readability problem.
- **P3 — Polish:** visual refinement that does not materially block a task.

## Initial independent review — 2026-07-23

**Evidence:** Screenshot review only.
**Confidence:** Provisional. The supplied screenshot showed the earlier Planning layout, before the final **Assets & Liabilities** relocation, so that finished navigation was not visually verified.

### What works

- The Planning **Start here** hierarchy is clearer than a flat collection of tools.
- **Do now** versus **Explore / model** gives users a useful decision boundary.
- Short tool descriptions help explain intent.
- Navy selected states are clear and consistent with the CashCompass visual language.
- White cards, blue accents, and restrained gray backgrounds feel calm and trustworthy.
- **Last updated** information supports confidence in freshness.
- Moving Debt accounts to **Assets & Liabilities** is conceptually stronger than treating debt maintenance as planning.

### Prioritized findings

| Priority | Area | Finding | Recommendation | Evidence |
|---|---|---|---|---|
| P1 | Assets & Liabilities → Planning | The handoff between **Debt accounts**, **Debt overview**, and **Rolling debt payoff** may remain unclear because the names are similar but the jobs differ. | Add concise contextual links and purpose copy: maintain live balances in Debt accounts, review the current position in Debt overview, and model payoff choices in Rolling debt payoff. | Screenshot |
| P1 | Debt accounts | With no account selected, an empty selector beside a large pale panel full of dashes can look broken. | Replace the dash-only panel with a guided empty state that tells the user to select an account or add the first one. | Screenshot |
| P1 | Feedback states | Save, Stop tracking, loading, stale-data, and failure feedback were not interactively verified. These are trust-critical for a financial product. | Require an interactive disposable-workbook journey before closing UX-05/UX-10. Record visible confirmation, error recovery, and history-preservation copy. | Evidence gap |
| P2 | Debt accounts | **Acct PCT Avail** is spreadsheet-style jargon. | Use **Available credit %**, **Credit available**, or equivalent plain language in visible UI only. | Screenshot |
| P2 | Debt accounts | **Manage debts** is ambiguous beside Update and Add new. | Prefer **Review tracked debts** or another outcome-oriented label, and explain that Stop tracking preserves history. | Screenshot |
| P2 | Responsive navigation | **Assets & Liabilities** is longer than the former **Assets** label. | Verify wrapping, height, and tap/click targets at supported narrow widths. | Retest |
| P3 | Visual system | Some secondary helper copy appears slightly light against white or pale-blue surfaces. | Increase contrast modestly without changing the established navy/blue/white palette. | Screenshot |

### Top three improvements

1. Clarify the relationship between Debt accounts, Debt overview, and Rolling debt payoff with contextual links and plain-language purpose text.
2. Replace dash-only debt panels and abbreviations with guided empty states and user language.
3. Verify explicit loading, save, stop-tracking, stale, and error feedback through an interactive disposable journey.

### Required retest

1. Navigate **Assets & Liabilities → Debt accounts → Planning → Debt overview → Rolling debt payoff** and explain each destination without implementation knowledge.
2. Repeat at desktop and narrow widths.
3. On a harness-created disposable workbook only, update one debt and assess loading, confirmation, error recovery, history-preservation messaging, and the transition into read-only planning.

## Interactive populated-workbook review — 2026-07-23

**Evidence:** Interactive and Screenshot review on the approved isolated Central
validation deployment. The writer journey used the guarded Populated Dashboard E2E
runner as `cashcompass2026@gmail.com`. The runner created and continuously verified a
Restricted synthetic workbook, exposed no arbitrary workbook ID, and finished with
`active: null` plus verified Trash cleanup. Beta, bounded, mapped-user, Golden, and
configured-default workbooks were not used.

**Confidence:** High for the reviewed Overview, Assets & Liabilities, Cash Flow,
Activity, Properties, Planning, Setup, Help, bank-save, and bill-payment paths.
Failure, stale-data, Skip, Stop tracking, and destructive management states remain
evidence gaps.

### 1. Overall impression

CashCompass feels calm, structured, and substantially easier to navigate than a
spreadsheet. Browsing is straightforward; writer workflows are less trustworthy.
The product is close to a strong beta experience, but the confirmed money-editor,
cross-surface truth, and Pay-handoff issues are release-relevant trust defects rather
than optional visual polish.

### 2. What is good

- **Interactive:** Overview has a strong hierarchy: Net Worth is prominent,
  supporting KPIs are clear, and attention states are separated from general
  information.
- **Interactive:** Planning's **Do now** versus **Explore / model** distinction is
  clear, and the tools include concise purpose statements.
- **Interactive:** Debt overview states that it does not change accounts; Purchase
  simulator states that it does not change saved accounts.
- **Interactive:** Property performance keeps the selected year, property, equity,
  operating results, and financing results understandable.
- **Interactive:** Payment completion used specific feedback:
  **Payment recorded — Jun-26 cash flow updated**.
- **Interactive:** Activity preserved the erroneous bank update and the correction,
  providing an auditable history instead of silently rewriting it.
- **Screenshot:** At 1440px the card hierarchy is balanced. At 390px the primary
  navigation wraps cleanly, **Assets & Liabilities** remains usable, and Assets
  subtabs stack without horizontal overflow.

### 3. What is confusing

- **Interactive:** **Pay** silently moves to Quick add and still requires
  **Add to Cash Flow**; the handoff does not state that the payment is not complete.
- **Interactive:** After paying the June bill occurrence, Bills still showed one
  overdue occurrence because July was also due. Without occurrence-specific
  confirmation, the successful payment can look unsuccessful.
- **Interactive:** Quick add says existing monthly entries “may be updated
  automatically” without explaining replacement, accumulation, or duplicate rules.
- **Interactive:** **Dismiss** on Upcoming does not explain whether it completes,
  hides, removes, or preserves the item.
- **Interactive:** `USE_FOR_BILLS` and **Acct PCT Avail** are implementation-oriented
  terms rather than user language.

### 4. What is hard to do

- **Interactive:** Replacing a formatted bank amount was unexpectedly difficult. A
  replace operation intended to change `$12,500` to `12600` produced
  `$1,250,012,600`. An explicit Select All followed by a second Save was required to
  correct the disposable value to `$12,600`.
- **Interactive:** Retirement presents a large wall of dash-only outputs before the
  minimum scenario inputs exist.
- **Interactive:** The distinction between recording money, paying a recurring bill,
  and maintaining the recurring definition becomes clear only after performing the
  workflow.

### 5. What does not make sense

- **Interactive:** Setup reported **1 recurring income · 0 other detected**, while
  Income reported **No recurring income yet** and placed **Test Salary** under
  **Other detected income**.
- **Interactive:** Help says **Pay records the payment**, but Pay only prepares the
  Quick add form.
- **Interactive:** Help references **Planning → Debts** even though debt maintenance
  now lives under **Assets & Liabilities → Debt accounts**.
- **Interactive:** Activity shows a **Remove (Donation)** column for Bank and Bill
  events.
- **Interactive:** Properties says it uses “the same house expense writer as the
  sidebar,” which is implementation language.

### 6. Screens or components that look wrong

- **Interactive:** Bank actions appear while selected-account details still contain
  dashes and **Loading…**.
- **Interactive:** Activity's donation-removal column visually clutters unrelated
  events.
- **Interactive:** Retirement's dash-only results block looks unfinished.
- **Screenshot:** The desktop header contains considerable unused space between the
  brand and actions.
- **Screenshot:** Some secondary helper and change-detail text is small and light,
  especially at narrow widths.

### 7. Navigation findings

Primary navigation is understandable at desktop and narrow widths. Planning is
particularly strong because each destination explains its purpose. The main
navigation failures are contextual: Pay's transition into Quick add is unexplained,
and Help contains an outdated path to debt maintenance.

### 8. Ease-of-use assessment

**Moderately easy.** Browsing and understanding the major areas is easy. Completing
financial writes requires more caution than it should because formatted inputs,
handoffs, recurrence outcomes, and cross-surface state are not always explicit.

### 9. Color, contrast, spacing, and typography

- Navy, blue, white, and green create a credible financial-product tone.
- Selected navigation states have strong contrast.
- The 390px layout avoids horizontal overflow.
- Secondary helper text should receive a modest contrast and minimum-size increase.
- Desktop header spacing can be tightened without changing the visual system.

### 10. Trust and feedback-state findings

- Payment success feedback and Activity history are good.
- Bank Save accepted an extreme unintended value and still reported success.
- Loading-state gating is incomplete: actions become available before selected
  details finish loading.
- The Income/Setup disagreement undermines confidence in which state is authoritative.
- Failure, stale, Skip, and Stop-tracking feedback remain open evidence gaps.

### 11. Prioritized issues

| Priority | Screen | Finding | Recommendation | Evidence |
|---|---|---|---|---|
| P1 | Bank accounts | Replacing `$12,500` with `12600` produced `$1,250,012,600`; Save accepted it and reported success. | Keep raw numeric editing separate from display formatting, make replacement deterministic, and warn before extreme balance changes. Reproduce with normal typing, paste, and keyboard selection before closing. | Interactive |
| P1 | Income / Setup | Setup and Income disagree about recurring versus detected income. | Use one classification source and add a cross-surface regression assertion. | Interactive |
| P1 | Bills / Quick add / Help | Pay requires a second action while Help says Pay records immediately. | Use an explicit **Record payment** handoff, identify the bill occurrence, state that submission is still required, and align Help. | Interactive |
| P1 | Bills | Paying June immediately reveals July as overdue with no explanation, which can make the payment look unsuccessful. | Confirm the paid occurrence and name the next occurrence separately. | Interactive |
| P1 | Multiple | Customer UI leaks `INPUT - Cash Flow 2026`, “tab,” “section on sheet,” and “writer/sidebar.” | Replace normal-path implementation terminology with financial-product language; keep technical references in Advanced Help only. | Interactive |
| P2 | Bank / Debt | Actions become available while selected-account details are still loading. | Disable writers and Stop tracking until the selected record is fully loaded. | Interactive |
| P2 | Quick add | “May be updated automatically” does not explain duplicate behavior. | State precisely whether CashCompass replaces, adds to, or creates the monthly value. | Interactive |
| P2 | Activity | **Remove (Donation)** appears for Bank and Bill rows. | Render the action only for eligible donation events. | Interactive |
| P2 | Bank / Debt | `USE_FOR_BILLS` and **Acct PCT Avail** are internal or jargon-heavy. | Use **Used for bills** and **Available credit %** or equivalent user language. | Interactive |
| P2 | Retirement | Dash-heavy results dominate before setup. | Replace them with a guided empty state and reveal results after minimum inputs exist. | Interactive |
| P2 | Upcoming | **Dismiss** has an unclear outcome. | Use an outcome-oriented label and explain history preservation. | Interactive |
| P3 | Header | Desktop branding/action area contains excessive empty space. | Tighten the header grid while preserving the hierarchy. | Screenshot |
| P3 | General | Some helper text is small/light. | Modestly increase secondary-text contrast and minimum size. | Screenshot |

No confirmed P0 issue was recorded. The bank-value behavior is potentially
data-risking but requires normal human keyboard/paste reproduction before escalation
to P0.

**Implementation follow-up:** A narrow local fix now makes the Bank balance editor
select the complete loaded value on focus, while every other currency editor preserves
its existing caret behavior. Focused and full local regression suites pass. On
isolated Central `@175`, a fresh marker-verified Restricted fixture passed both
interactive writer replays: normal typing replaced `$12,500.00` with `$12,600.00`,
and the paste-like fill path then replaced it with `$12,700.00`; both exact values
were saved and read back without concatenation. The core replacement defect is
closed. Extreme-change protection remains a separate ProductDecision, and the
390px input-path replay remains part of the responsive closeout.

**New Interactive / Source review finding (`P1`, test trust):** the completed
Populated Dashboard E2E PASS generated while the isolated deployment was `@175`
was saved with candidate metadata `Central Apps Script version 141` /
`isolated @141`. Source review shows the browser report reads the previously saved
Release Readiness candidate metadata. A standalone browser run must not be allowed
to make new evidence look attributable to an older candidate; require an
exact-candidate handoff from the owning Validation-console run or mark/refuse the
evidence as non-release-eligible. Tracked as `REG-015`.

**Implementation follow-up:** `@177` proved that merely capturing whichever
Release Readiness state was `IN_PROGRESS` was insufficient because the parked
`@141` run still looked like an owner. The corrected local contract now requires
an explicit run id supplied only by a dedicated action in the active Release
Readiness evidence table. The admin launcher validates that id; campaign
preparation captures it; completion revalidates it. Generic/direct launches supply
no owner and save `releaseEligible: false`, a null candidate, and no release run
id even while an older run remains active. Performance cannot ratify a budget in
that state. P1 evidence, production-path, syntax, and full local regressions pass;
isolated runtime replay remains pending.

**Income / Setup follow-up:** the local fix replaces the duplicated thresholds
with one shared classification path. A non-excluded active salary with one
positive month is immediately tracked on both Income and Setup; excluded,
negative, and non-positive groups remain Other detected. Behavior and static
regressions pass, and the permanent Populated Dashboard browser contract requires
the two surfaces to agree. **Interactive:** isolated Central `@176` confirmed the
two surfaces agree, closing `REG-016`.

**Contained visibility-wave follow-up (Source review; runtime replay pending):**
the confirmed customer-language leaks now render as **Tax year**, customer-facing
property-expense guidance, friendly Bank policy labels, and **Available credit %**
without changing stored identifiers or workbook schema. Bank and Debt Save /
Stop-tracking actions now remain unavailable until the matching selected-record
details load, with request-generation guards preventing stale responses from
re-enabling the wrong selection. Retirement hides unavailable result cards while
guidance is shown. The narrow layout uses compact two-column header actions and
primary navigation, while the muted-text token and minimum helper size receive a
modest contrast/readability increase. Exact assertions were added to the existing
dashboard UX regression suite; focused local checks pass. These findings are not
closed until the isolated desktop and 390px visual/interactive replay confirms
the rendered behavior.

## Scored advocate replay — isolated Central `@177`

**Evidence:** Interactive and Screenshot review on the approved isolated Central
validation deployment, plus Source review only where explicitly noted. Two guarded
Populated Dashboard E2E journeys ran on newly provisioned Restricted synthetic
workbooks: the default-width run `FR-178f624b-8b46-4897-a6ea-cf966f4f657a` and a
separate 390px run starting `2026-07-23T20:26:39.599Z`. Both reported PASS and
verified Trash cleanup. No Beta, bounded, mapped-user, Golden, configured-default,
or manually supplied workbook was used.

**Confidence:** High for the automated populated journey and the rendered Overview,
Properties, Cash Flow, navigation, loading transitions, and 390px layout. Medium
for Bank/Debt pre-load gating because the permanent source contract and automated
safe-action assertion passed but failure/stale responses were not deliberately
induced. Retirement's new guidance state remains Source review in this replay.

### 1–2. Overall impression and scorecard

CashCompass now looks intentionally responsive rather than merely stacked at
390px. The compact brand/actions area, two-column navigation, stronger helper text,
and clearer customer wording materially improve first-glance confidence. The
product remains below a 9 because Bills handoff/occurrence feedback is unresolved,
failure-state evidence is incomplete, and `REG-015` still makes runtime evidence
look attributable to the wrong candidate.

| Criterion | Score | Weight | Evidence | Rationale |
|---|---:|---:|---|---|
| Errors and task completion | 8.0/10 | 20% | Interactive | Both populated journeys passed, but `REG-015` still saved stale candidate metadata as release-eligible evidence. |
| Ease and efficiency | 8.3/10 | 15% | Interactive / Screenshot | Core destinations are easy to reach; Bills payment still has an unclear two-step handoff. |
| Language and comprehension | 8.5/10 | 10% | Interactive / Source review | Properties and traversed normal paths read naturally; remaining ambiguous Quick add/Bills semantics are separate open work. |
| Transitions and feedback | 7.5/10 | 15% | Interactive / Source review | Loading locks and refresh feedback improved, while Bills next-occurrence, stale, failure, Skip, and Stop-tracking evidence remain incomplete. |
| Visual design and readability | 8.7/10 | 10% | Screenshot | 390px hierarchy, contrast, spacing, and density are notably better; the medium-width header still leaves excessive unused space. |
| Navigation and discoverability | 8.8/10 | 10% | Interactive | The stable two-column primary navigation and clear page/subtab hierarchy are strong. |
| Trust and safety | 7.8/10 | 15% | Interactive / Source review | Guarded fixtures, action gating, and cleanup are trustworthy; stale release attribution and the unresolved Bills handoff reduce confidence. |
| Responsive and accessibility | 7.0/10 | 5% | Screenshot / evidence gap | 390px had no horizontal overflow and good targets, but keyboard, focus, accessible-name, and reduced-motion checks were not fully exercised. |

**Weighted overall: 8.1/10 — Baseline.** The unresolved P1 findings would cap the
score at 8.9 even if the weighted result were higher. This is usability evidence,
not release approval.

### Isolated `@178` full rerun — 2026-07-23

**Interactive result:** full Populated Dashboard E2E PASS. Run
`FR-c298ef4e-77a3-4e06-8917-3e76aba0c1df` passed all 12 required browser
assertions, captured zero errors, used Restricted owner-only sharing, and
completed verified Trash cleanup. The standalone report correctly remained
diagnostic-only with `releaseEligible: false`, `candidate: null`, and no release
run id despite the parked `@141` state. This runtime-closes the standalone half of
`REG-015`; the dedicated exact-owner Release Readiness action still needs
candidate-bound runtime proof.

**Interactive reliability caveat:** this was the third attempt. The first stopped
at the Debt-selection step and the second exposed a visible Apps Script
`NetworkError: Connection failure due to HTTP 0`; both still cleaned up and failed
closed. The final PASS means there is no consistently reproducible functional
regression in the covered journey, but a two-failures-before-pass pattern is a
real reliability regression candidate and remains a P1 investigation item.

| Criterion | `@177` baseline | `@178` score | Evidence | Rationale |
|---|---:|---:|---|---|
| Errors and task completion | 8.0/10 | **8.0/10** | Interactive | The final 12/12 run proves the feature path, but the preceding Debt timeout and visible HTTP 0 failure prevent a reliability increase. |
| Ease and efficiency | 8.3/10 | **8.3/10** | Interactive / Screenshot | Core traversal remains straightforward; Bills still has an unclear two-step completion contract. |
| Language and comprehension | 8.5/10 | **8.5/10** | Interactive / Source review | The covered normal paths remain readable; Bills/Quick add and Upcoming semantics are still unresolved. |
| Transitions and feedback | 7.5/10 | **7.5/10** | Interactive / Source review | Refresh feedback passed, but Bills occurrence, stale/failure, Skip, Stop-tracking, and HTTP 0 recovery remain incomplete. |
| Visual design and readability | 8.7/10 | **8.7/10** | Screenshot | The visual system remains clear; the medium-width header imbalance is unchanged. |
| Navigation and discoverability | 8.8/10 | **8.8/10** | Interactive | Primary destinations, workspaces, and retained Assets subtab all passed. |
| Trust and safety | 7.8/10 | **8.2/10** | Interactive / Source review | Standalone evidence now fails closed and cleanup is proven; dedicated-owner proof and Bills/recovery consequences remain open. |
| Responsive and accessibility | 7.0/10 | **7.0/10** | Prior Screenshot / evidence gap | This default-width rerun adds no new keyboard, focus, semantics, reduced-motion, or narrow-width evidence. |

**Weighted overall: 8.2/10 — provisional improvement from 8.1.** The increase is
limited to the runtime-proven standalone evidence-attribution correction. The
score is not 10/10 and is not release approval.

### Isolated `@179` REG-017 rerun — 2026-07-23

**Interactive result:** full Populated Dashboard E2E PASS. Run
`FR-3f6f2cf7-f823-4b74-a033-5e964f66b05e` passed all 12 required browser
assertions, including `debt_selection_actions`, with zero captured errors,
Restricted owner-only sharing, and verified Trash cleanup. This runtime-closes
the overlapping Debt-section response defect recorded as `REG-017`.

| Criterion | `@178` score | `@179` score | Evidence | Rationale |
|---|---:|---:|---|---|
| Errors and task completion | 8.0/10 | **8.3/10** | Interactive | The previously timing-sensitive Debt selection now completed correctly under the full journey. HTTP 0 recovery, Bills completion semantics, and remaining controlled failure branches prevent a higher score. |
| Ease and efficiency | 8.3/10 | **8.3/10** | Interactive / Screenshot | Covered traversal remains straightforward; Bills still has an unclear two-step completion contract. |
| Language and comprehension | 8.5/10 | **8.5/10** | Interactive / Source review | Covered normal paths remain readable; unresolved Bills/Quick add and Upcoming semantics are unchanged. |
| Transitions and feedback | 7.5/10 | **7.5/10** | Interactive / Source review | Refresh completed without error, but HTTP 0 recovery and several success/failure transitions remain incomplete. |
| Visual design and readability | 8.7/10 | **8.7/10** | Screenshot | The established visual system remains clear; no new medium/narrow visual evidence was added. |
| Navigation and discoverability | 8.8/10 | **8.8/10** | Interactive | Primary destinations and retained Assets subtab passed again. |
| Trust and safety | 8.2/10 | **8.2/10** | Interactive / Source review | Restricted sharing, diagnostic-only evidence, and cleanup passed; dedicated exact-owner proof remains open. |
| Responsive and accessibility | 7.0/10 | **7.0/10** | Prior Screenshot / evidence gap | This replay adds no keyboard, focus, semantics, reduced-motion, or narrow-width evidence. |

**Weighted overall: 8.2/10 — unchanged after rounding.** Task reliability improved,
but the remaining open categories still control the overall score. This is
usability evidence, not release approval.

### 3–11. Findings

- **What is good — Interactive / Screenshot:** Both runs completed the populated
  workflow. At 390px, Help and Setup share a balanced row, Refresh spans the width,
  primary navigation remains a clean two-column grid, and Properties/Cash Flow
  content stays inside the viewport.
- **What is confusing — Interactive:** The existing Bills Pay handoff and
  occurrence explanation remain unresolved and were deliberately not changed in
  this wave.
- **What is hard — Evidence gap:** Failure, stale, Skip, and Stop-tracking recovery
  were not deliberately induced. Retirement's guidance state was not reached
  interactively before fixture cleanup.
- **What does not make sense — Interactive:** Both `@177` PASS reports still claim
  `Central Apps Script version 141` / `isolated @141`, reuse Release Readiness run
  `RR-d307848c-bbba-49a2-807d-088c0cae0095`, and save
  `releaseEligible: true`. This reconfirms `REG-015`.
- **Looks wrong — Screenshot:** The default/medium-width header still concentrates
  actions on the left and leaves a large unused area. This is polish rather than a
  task blocker.
- **Navigation — Interactive:** Primary destinations and subtabs are discoverable
  and stable at 390px; **Assets & Liabilities** wraps without overflow.
- **Ease of use — Interactive:** Orientation and browsing are good. The remaining
  ease penalty comes mainly from Bills semantics rather than navigation.
- **Color/contrast/spacing/type — Screenshot:** Stronger secondary text is easier
  to read without losing hierarchy. Cards and selected navy states remain calm and
  consistent.
- **Trust/feedback — Interactive / Source review:** Refresh/loading states are
  visible and Bank/Debt actions are contractually gated until matching data loads.
  The evidence-attribution bug and untested recovery branches remain trust gaps.

### 12. Prioritized issues

| Priority | Screen | Finding | Recommendation | Evidence |
|---|---|---|---|---|
| P1 | Runtime reliability | Two of three isolated `@178` attempts failed before the final 12/12 PASS. The Debt-selection failure is traced to overlapping section requests and has a local `REG-017` stale-response guard; visible Apps Script HTTP 0 recovery remains open. | Runtime-replay the Debt fix, then add bounded retry/recovery behavior for transport failures where the application controls it. | Interactive / Source review |
| P1 | Test evidence | Standalone `REG-015` behavior is runtime-closed; the dedicated exact-owner path is not yet runtime-proven. | Prove the Release Readiness-owned launcher against an exact candidate before accepting its browser evidence. | Interactive / Source review |
| P1 | Bills / Quick add | Payment handoff and next-occurrence confirmation remain ambiguous. | Discuss the intended product behavior, then align UI and Help before implementation. | Prior Interactive; unchanged |
| P2 | Retirement | Guidance/result visibility passed Source review but was not interactively reached in this replay. | Add Retirement state coverage to the guarded browser journey or run a focused read-only fixture replay. | Source review / evidence gap |
| P2 | State recovery | Stale, failure, Skip, and Stop-tracking feedback remain unverified. | Use a separately approved guarded disposable writer journey with controlled failures. | Evidence gap |
| P3 | Header | Medium-width layout retains excessive unused header space. | Add a tablet/medium breakpoint that balances brand, actions, and freshness without weakening the 390px result. | Screenshot |

### 13. Top three improvements

1. Runtime-replay the local `REG-017` Debt race fix, address HTTP 0 recovery, and
   runtime-prove the dedicated exact-owner half of `REG-015`.
2. Decide and then clarify the Bills Pay → Quick add → next-occurrence journey.
3. Add focused Retirement and failure-state interactive coverage, then refine the
   medium-width header.

### 14. Retest checklist

1. Confirm standalone `@candidate` browser evidence is diagnostic-only and cannot
   inherit or claim an older Release Readiness candidate.
2. Revisit Retirement with missing minimum inputs and verify the result wall stays
   hidden until ready.
3. Exercise Bank/Debt loading failure and stale-response paths on a guarded
   disposable fixture.
4. After the Bills decision, verify Pay handoff, completion, next occurrence, and
   Help as one journey.
5. Repeat default, medium, and 390px screenshots plus keyboard/focus checks.

### 12. Top three improvements

1. Harden every formatted money editor against concatenation and extreme unintended
   values.
2. Make the Bills → payment → next-occurrence journey explicit and align Help with
   actual behavior.
3. Eliminate source terminology and resolve the Income/Setup state contradiction.

### 13. Retest checklist

1. Replace `$12,500` with `$12,600` using typing, paste, Select All, deletion, and a
   narrow/mobile input path; verify extreme changes receive protective feedback.
2. Confirm Bank/Debt actions remain disabled until the selected record finishes
   loading.
3. Pay one recurring occurrence and verify that completion names both the paid and
   next occurrences.
4. Confirm Help describes the real payment workflow and points to
   **Assets & Liabilities → Debt accounts**.
5. Confirm Setup and Income report identical classifications.
6. Verify no workbook names, sheet names, “tab,” “writer,” or sidebar implementation
   language remains on normal paths.
7. Retest Activity without irrelevant donation actions.
8. Exercise Skip, Stop tracking, loading failure, stale data, and server-error
   recovery on a new harness-created disposable workbook.
9. Repeat supported desktop and 390px responsive checks.

## Browser access for the independent advocate

The temporary advocate must receive the Browser capability in its Codex task and connect to an active browser session. Browser access is an execution capability, not something CashCompass code or an agent prompt can grant.

Current setup:

- The Browser capability is installed in this Codex environment.
- The primary Codex task can connect to the in-app browser.
- The temporary collaboration advocate was tested on 2026-07-23 and returned **No browser is available**. It cannot currently inherit the primary task's browser backend or list, open, or claim tabs.
- The browser session must already be signed in to the appropriate Google identity if authentication is required.
- Use the non-admin disposable identity for ordinary journeys. Administrator-only checks must use `samertheodossy@gmail.com` or stop; never elevate another identity.
- The target must be the approved Central/isolated validation URL or a harness-created disposable workbook, never the bounded workbook.
- Keep the review tab dedicated to CashCompass and do not inspect unrelated tabs or browser storage.

For a full independent review:

1. Open a dedicated, user-owned Codex task with the Browser capability enabled. The current temporary collaboration advocate is not sufficient because browser access is not delegated to it.
2. In the Codex in-app browser—not Firefox or another external browser—open only the approved CashCompass validation URL.
3. Sign in manually if the page requests authentication, keep the tab open, and tell the dedicated advocate task that the session is ready.
4. Provide the exact journey scope and evidence boundary: read-only Central review, or separately approved disposable writer review.
5. Have the advocate capture findings in the required report format above.
6. Add confirmed issues to `TODO.md → UX Backlog (Version 1)` and retain screenshots or validation evidence where appropriate.

If the dedicated task reports **No browser is available**, the Browser capability or in-app Browser backend is not enabled for that task/account. Enable or attach Browser in the task and retry; CashCompass code cannot grant this permission.

When Workspace Agents become enabled, migrate this charter into the dedicated agent configuration and attach the Browser capability there. Until then, the temporary Codex advocate remains an independent review process rather than a persistent Workspace Agent.
