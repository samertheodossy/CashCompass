# CashCompass URL Registry

This is the authoritative human-readable index of CashCompass application and
validation entry-point URLs. The **Validation & Testing console is the only test
URL an operator should retain**. Account-specific browser execution adapters are
launched from that console and intentionally are not cataloged as separate
operator destinations.

## Current applications

| Surface | URL | Account / purpose |
| --- | --- | --- |
| Personal bounded dashboard | https://script.google.com/macros/s/AKfycbzJLU-EiHeVHuwrR1IryNzhCyqAw7rrseRvt3gdxW8GFqazYOwW-Dz_IXtx_A9e-0ZASg/exec | Owner-only daily workbook. Never use for Harness or destructive validation. |
| Central Beta | https://script.google.com/macros/s/AKfycbyq_OGiupdGO79GMOImkIgYv19hqlN1JuJfieuDlkXH6Rp637MhZc6jz9uRW2ZxANBlPA/exec | Family-beta deployment, currently pinned at version 106. Do not update during isolated validation. |
| Isolated Central validation | https://script.google.com/macros/s/AKfycbzMaD3Ur0H3VmatL4W2vVHlYhFOXF4cZSSjIcn3SwggbTCs9Q9F1_PH74F16lAFkUlWZQ/exec | Disposable runtime-validation deployment, currently version 174. This is the only Central deployment updated during pre-release test work. |

## Validation entry point

| Surface | URL | Account / purpose |
| --- | --- | --- |
| Validation & Testing console | https://script.google.com/macros/s/AKfycbzMaD3Ur0H3VmatL4W2vVHlYhFOXF4cZSSjIcn3SwggbTCs9Q9F1_PH74F16lAFkUlWZQ/exec?view=validation | Sign in as samertheodossy@gmail.com. Consolidated Validator, suite inventory, latest saved evidence, cleanup status, and browser-runner launch controls. |

The Validation console is the source of truth for every suite's launch, latest
PASS/FAIL evidence, and cleanup status. Server suites run in place. Browser suites
may open a guarded execution window as `cashcompass2026@gmail.com`, but the route
is an internal adapter: it accepts no email or workbook ID, saves evidence back to
the console, and should not be bookmarked or tracked separately.

## Deployment identifiers

| Environment | Deployment ID | Rule |
| --- | --- | --- |
| Central Beta | AKfycbyq_OGiupdGO79GMOImkIgYv19hqlN1JuJfieuDlkXH6Rp637MhZc6jz9uRW2ZxANBlPA | Keep pinned until an explicit Beta promotion decision. |
| Isolated Central validation | AKfycbzMaD3Ur0H3VmatL4W2vVHlYhFOXF4cZSSjIcn3SwggbTCs9Q9F1_PH74F16lAFkUlWZQ | Safe target for approved isolated deployment updates. |

If a deployment is replaced rather than version-updated, update this registry,
PROJECT_CONTEXT.md, and the deployment checklist in the same change.
