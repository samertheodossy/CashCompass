# CashCompass URL Registry

This is the authoritative human-readable index of CashCompass application and
validation entry-point URLs. The **Validation & Testing console is the only test
URL an operator should retain**. Account-specific browser execution adapters are
launched from that console and intentionally are not cataloged as separate
operator destinations.

## Current applications

| Surface | URL | Account / purpose |
| --- | --- | --- |
| Personal bounded dashboard | https://script.google.com/macros/s/AKfycby9dt2uLRkaCwtTn9-SI2PnHKYmsSRWfqnSCmxaNt_qY1hTP2daoTWyL0LpUgwF4d08ew/exec | Owner-only daily workbook, user-pushed and user-deployed on 2026-08-14 for RFP-6a bounded acceptance. Never use for Harness or destructive validation. The owner previewed and saved the supplied Robinhood export: 104 activities were imported for Samer Robinhood and the resulting four-holding reconciliation matched the broker's later displayed quantities after accounting for the next weekly buys and dividend reinvestment. In a later owner-controlled bounded redeploy, the same CSV was previewed and saved again to exercise the duplicate-safe path; the owner confirmed that both `SYS - Investment Activity` and `SYS - Investment Holdings` then content-fitted their columns correctly. |
| Central Beta | https://script.google.com/macros/s/AKfycbyq_OGiupdGO79GMOImkIgYv19hqlN1JuJfieuDlkXH6Rp637MhZc6jz9uRW2ZxANBlPA/exec | Family-beta deployment, currently pinned at version 106. Do not update during isolated validation. |
| Isolated Central validation | https://script.google.com/macros/s/AKfycbzMaD3Ur0H3VmatL4W2vVHlYhFOXF4cZSSjIcn3SwggbTCs9Q9F1_PH74F16lAFkUlWZQ/exec | Disposable runtime-validation deployment, currently version 369. Part 2A-5 run `20260817-102843-e241` passed 1/1 scenario and 35/35 assertions in 29.8 s; companion Capital Allocation run `20260817-102943-17fd` passed 2/2 scenarios and 99/99 assertions in 17.3 s. Both had Restricted sharing, Provisioning/Drift PASS, all marker-verified fixtures verified TRASHED, and the disposable runner returned OFF. Central Beta remains version 106. |

Part 2A-3 suite `SUITE-PART-2A-AUTHORITATIVE-CASH-IMPORT` is runtime-proven on
isolated Central `@358` by run `20260816-200938-c001`. Its only fixture was
marker-verified and verified TRASHED; no bounded workbook was used.

Part 2A-4 suite `SUITE-PART-2A-AUTHORITATIVE-REVOLVING-DEBT` is runtime-proven
on isolated Central `@363` by run `20260817-074631-0fb6`. Its only fixture was
marker-verified and verified TRASHED; no bounded workbook was used. The suite
passed 33/33 functional assertions, including exact Planning byte-equivalence.

Part 2A-5 suite `SUITE-PART-2A-DATA-READINESS` is runtime-proven on isolated
Central `@369` by run `20260817-102843-e241`. Its only Restricted, marker-verified
fixture passed 35/35 functional assertions with Provisioning and Drift PASS and
was verified TRASHED. The expanded suite proves that zero connected cash/card
domains are **Not connected**, partial domain coverage is **More data needed**,
complete but actionable data is **Needs review**, and complete clean data is
**Ready for review**; no `Ready 0 / 0` state remains. The disposable runner was
returned OFF. No bounded workbook was used and Central Beta remained `@106`.
Companion run `20260817-102943-17fd` passed both Capital Allocation scenarios
and 99/99 assertions, proving that the presentation cleanup did not change the
approved reserve, Robinhood floor, or debt-allocation mathematics.

## Validation entry point

| Surface | URL | Account / purpose |
| --- | --- | --- |
| Validation & Testing console | https://script.google.com/macros/s/AKfycbzMaD3Ur0H3VmatL4W2vVHlYhFOXF4cZSSjIcn3SwggbTCs9Q9F1_PH74F16lAFkUlWZQ/exec?view=validation | Sign in as samertheodossy@gmail.com. Consolidated Validator, suite inventory, latest saved evidence, cleanup status, and browser-runner launch controls. |

The Validation console is the source of truth for every suite's launch, latest
PASS/FAIL evidence, and cleanup status. Server suites run in place. Browser suites
run in a dedicated persistent browser identity authenticated only as
`cashcompass2026@gmail.com`; the Validation console stays in a separate persistent
administrator identity. Their internal routes accept no email or workbook ID,
self-start only when the server-rendered unattended flag is present, save evidence
back to the console, and should not be bookmarked or tracked separately. The agent
opens and monitors those routes directly, avoiding cross-account popup redirects.
Google password and 2FA remain a human boundary only when that dedicated session
expires.

## Deployment identifiers

| Environment | Deployment ID | Rule |
| --- | --- | --- |
| Personal bounded production | AKfycbzSeG-MpuoxqM4FFdv5stdyoazZ0BTfva8lRTpJqPrlpcqR0LF-tTnCwN72CY5mqrYjRw | Current bounded deployment at version 555. Update this existing deployment for future reviewed releases; never create another bounded production URL. |
| Central Beta | AKfycbyq_OGiupdGO79GMOImkIgYv19hqlN1JuJfieuDlkXH6Rp637MhZc6jz9uRW2ZxANBlPA | Keep pinned until an explicit Beta promotion decision. |
| Isolated Central validation | AKfycbzMaD3Ur0H3VmatL4W2vVHlYhFOXF4cZSSjIcn3SwggbTCs9Q9F1_PH74F16lAFkUlWZQ | Safe target for approved isolated deployment updates. |

Do not use **New deployment** for routine releases. Update the existing deployment
ID so bookmarks cannot keep running obsolete recurrence or financial-write code.
Post-release inventory must contain only bounded HEAD + the one production ID,
and Central HEAD + isolated + Beta. Any exception requires an explicit documented
approval. If a deployment is intentionally replaced, update this registry,
PROJECT_CONTEXT.md, and the deployment checklist in the same change.

**Deployment cleanup completed (2026-08-04):** after an obsolete `@551` URL
remained capable of running the pre-Weekday-guard Weekly AutoPay path, the user
approved retiring bounded deployments `@551`, `@552`, `@553`, and `@554`.
Post-cleanup inventory was verified as exactly bounded `@HEAD` plus production
`@555`. Old URLs must not be used or recreated.
