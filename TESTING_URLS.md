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
| Isolated Central validation | https://script.google.com/macros/s/AKfycbzMaD3Ur0H3VmatL4W2vVHlYhFOXF4cZSSjIcn3SwggbTCs9Q9F1_PH74F16lAFkUlWZQ/exec | Disposable runtime-validation deployment, currently version 357. Part 2A Financial Facts Foundation passed both registered scenarios and 25/25 assertions in 18.8 s with Provisioning PASS, Drift PASS, both marker-verified fixtures verified TRASHED, and the disposable runner returned OFF. Central Beta remains version 106. |

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
