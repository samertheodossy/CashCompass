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
2. What is good.
3. What is confusing.
4. What is hard to do.
5. What does not make sense.
6. Screens or components that look wrong.
7. Navigation findings.
8. Ease-of-use assessment.
9. Color, contrast, spacing, and typography findings.
10. Trust and feedback-state findings.
11. Prioritized issues with severity, affected screen, evidence type, and recommendation.
12. Top three improvements.
13. Retest checklist.

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
