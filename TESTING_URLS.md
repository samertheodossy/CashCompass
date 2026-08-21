# CashCompass URL Registry

This is the authoritative human-readable index of CashCompass application and
validation entry-point URLs. The **Validation & Testing console is the only test
URL an operator should retain**. Account-specific browser execution adapters are
launched from that console and intentionally are not cataloged as separate
operator destinations.

## Current applications

| Surface | URL | Account / purpose |
| --- | --- | --- |
| Personal bounded dashboard | https://script.google.com/macros/s/AKfycbycMA4qlzDASi3OWp650_kzg91ReoXC9xK78o2HerCtwFfQjnej6zJq_MpTxppKM44L/exec | Owner-only daily-workbook endpoint from the 2026-08-21 defect report, confirmed read-only as `@626`. Never use it for Harness or destructive validation. The owner performed bounded deployment/validation of the reviewed source and confirmed Anthropic Claude - Laith appears once as `$20` in August and the false July overdue card is gone. Post-validation inventory also contains a newly created owner-controlled `AKfycbwf66…RlvA` at `@627`; the owner-used singleton should be explicitly selected before the next routine bounded release. This remains customer-facing bounded evidence, not Codex workbook-writer evidence. The common-source 30/90-day financial-safety proof and creation-floor fix passed on isolated Central `@387`; Codex performed no bounded deployment or workbook write. |
| Central Beta | https://script.google.com/macros/s/AKfycbyq_OGiupdGO79GMOImkIgYv19hqlN1JuJfieuDlkXH6Rp637MhZc6jz9uRW2ZxANBlPA/exec | Family-beta deployment, currently pinned at version 106. Do not update during isolated validation. |
| Isolated Central validation | https://script.google.com/macros/s/AKfycbzMaD3Ur0H3VmatL4W2vVHlYhFOXF4cZSSjIcn3SwggbTCs9Q9F1_PH74F16lAFkUlWZQ/exec | Disposable runtime-validation deployment is currently `@387`. Capital Allocation Foundation passed 2/2 scenarios and 124/124 assertions with Restricted Provisioning and Drift PASS. Bills Regression passed 15/15 scenarios and 123/123 assertions; the exact new-bill creation-floor scenario passed 7/7. Every marker-verified Restricted fixture was verified TRASHED and the runner returned OFF. The Bills Edit Integrity fixture had one advisory Drift result while functional and Provisioning gates passed. Central Beta remains version 106. |

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

Planning checkpoint source `9a6cb966ee1bb2c5192b04f2a27723e889e4fc7b` is on
`main` and `origin/main`. Overview and Debt are frozen, and 30/90-day safety is
proven. This evidence certifies calculation semantics, not institution-current
balances; the next Cash + Credit Card Import / Refresh phase remains
shadow-only until a separate authority checkpoint.

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
| Personal bounded production | AKfycbycMA4qlzDASi3OWp650_kzg91ReoXC9xK78o2HerCtwFfQjnej6zJq_MpTxppKM44L | Defect-screenshot endpoint observed at `@626`. Owner validation subsequently created `AKfycbwf66qdm1AMzvHu3pnxIMw3xLynHavHKFSj-QtwFmeKYr3n1O-9lH2z_F3tVqoPU-RIvA` at `@627`; select one owner-used singleton before the next release rather than creating another URL. |
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

**Current bounded inventory drift (2026-08-21):** the pre-validation read-only
inventory contained 73 entries. The post-validation inventory contains 74,
including the defect-screenshot endpoint `AKfycbycMA…KM44L` still at `@626` and
a newly created owner-controlled `AKfycbwf66…RlvA` at `@627`. The owner reported
the reviewed bill fix passed bounded validation. Codex did not deploy bounded
source, create or retire a bounded deployment, or write to the bounded workbook.
Selecting the future singleton and retiring superseded entries are destructive
release administration and remain a separate, explicitly approved action.
