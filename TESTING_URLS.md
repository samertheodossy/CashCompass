# CashCompass URL Registry

This is the authoritative human-readable index of CashCompass application and
validation entry-point URLs. The **Validation & Testing console is the only test
URL an operator should retain**. Account-specific browser execution adapters are
launched from that console and intentionally are not cataloged as separate
operator destinations.

## Current applications

| Surface | URL | Account / purpose |
| --- | --- | --- |
| Personal bounded dashboard | https://script.google.com/macros/s/AKfycbxDrscovPbwivU8Bjudh1QOZPSrZGwFiuTiwPRVb4da8w7EqsgRVyslT98istFtE61Zzw/exec | Owner-only daily workbook, currently version 551. Never use for Harness or destructive validation. |
| Central Beta | https://script.google.com/macros/s/AKfycbyq_OGiupdGO79GMOImkIgYv19hqlN1JuJfieuDlkXH6Rp637MhZc6jz9uRW2ZxANBlPA/exec | Family-beta deployment, currently pinned at version 106. Do not update during isolated validation. |
| Isolated Central validation | https://script.google.com/macros/s/AKfycbzMaD3Ur0H3VmatL4W2vVHlYhFOXF4cZSSjIcn3SwggbTCs9Q9F1_PH74F16lAFkUlWZQ/exec | Disposable runtime-validation deployment, currently version 305. This is the only Central deployment updated during pre-release test work. |

## Validation entry point

| Surface | URL | Account / purpose |
| --- | --- | --- |
| Validation & Testing console | https://script.google.com/macros/s/AKfycbzMaD3Ur0H3VmatL4W2vVHlYhFOXF4cZSSjIcn3SwggbTCs9Q9F1_PH74F16lAFkUlWZQ/exec?view=validation | Sign in as samertheodossy@gmail.com. Consolidated Validator, suite inventory, latest saved evidence, cleanup status, and browser-runner launch controls. |

The Validation console is the source of truth for every suite's launch, latest
PASS/FAIL evidence, and cleanup status. Server suites run in place. Browser suites
run in a dedicated browser session authenticated only as
`cashcompass2026@gmail.com`. Their internal routes accept no email or workbook ID,
self-start only when the server-rendered unattended flag is present, save evidence
back to the console, and should not be bookmarked or tracked separately. The agent
opens and monitors those routes directly, avoiding cross-account popup redirects.
Google password and 2FA remain a human boundary only when that dedicated session
expires.

## Deployment identifiers

| Environment | Deployment ID | Rule |
| --- | --- | --- |
| Personal bounded production | AKfycbxDrscovPbwivU8Bjudh1QOZPSrZGwFiuTiwPRVb4da8w7EqsgRVyslT98istFtE61Zzw | The user updates this existing deployment to a reviewed version; never create a second bounded production URL. |
| Central Beta | AKfycbyq_OGiupdGO79GMOImkIgYv19hqlN1JuJfieuDlkXH6Rp637MhZc6jz9uRW2ZxANBlPA | Keep pinned until an explicit Beta promotion decision. |
| Isolated Central validation | AKfycbzMaD3Ur0H3VmatL4W2vVHlYhFOXF4cZSSjIcn3SwggbTCs9Q9F1_PH74F16lAFkUlWZQ | Safe target for approved isolated deployment updates. |

Do not use **New deployment** for routine releases. Update the existing deployment
ID so bookmarks cannot keep running obsolete recurrence or financial-write code.
Post-release inventory must contain only bounded HEAD + the one production ID,
and Central HEAD + isolated + Beta. Any exception requires an explicit documented
approval. If a deployment is intentionally replaced, update this registry,
PROJECT_CONTEXT.md, and the deployment checklist in the same change.
