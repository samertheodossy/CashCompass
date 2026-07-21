# CashCompass URL Registry

This is the authoritative human-readable index of CashCompass dashboard,
validation, and authenticated test-runner URLs. Start from the **Validation &
Testing console** for test work. Individual browser-runner routes are listed for
recovery and troubleshooting and should normally be launched from the console.

## Current applications

| Surface | URL | Account / purpose |
| --- | --- | --- |
| Personal bounded dashboard | https://script.google.com/macros/s/AKfycbzJLU-EiHeVHuwrR1IryNzhCyqAw7rrseRvt3gdxW8GFqazYOwW-Dz_IXtx_A9e-0ZASg/exec | Owner-only daily workbook. Never use for Harness or destructive validation. |
| Central Beta | https://script.google.com/macros/s/AKfycbyq_OGiupdGO79GMOImkIgYv19hqlN1JuJfieuDlkXH6Rp637MhZc6jz9uRW2ZxANBlPA/exec | Family-beta deployment, currently pinned at version 106. Do not update during isolated validation. |
| Isolated Central validation | https://script.google.com/macros/s/AKfycbzMaD3Ur0H3VmatL4W2vVHlYhFOXF4cZSSjIcn3SwggbTCs9Q9F1_PH74F16lAFkUlWZQ/exec | Disposable runtime-validation deployment, currently version 135. This is the only Central deployment updated during pre-release test work. |

## Validation entry point

| Surface | URL | Account / purpose |
| --- | --- | --- |
| Validation & Testing console | https://script.google.com/macros/s/AKfycbzMaD3Ur0H3VmatL4W2vVHlYhFOXF4cZSSjIcn3SwggbTCs9Q9F1_PH74F16lAFkUlWZQ/exec?view=validation | Sign in as samertheodossy@gmail.com. Consolidated Validator, suite inventory, latest saved evidence, cleanup status, and browser-runner launch controls. |

The Validation console is the source of truth for all suite status. Server suites
run directly there. Browser suites open a guarded adapter because they must
execute as cashcompass2026@gmail.com, which is permanently non-admin.

## Authenticated disposable-account runners

| Suite | URL | What it validates |
| --- | --- | --- |
| First-Run UX E2E | https://script.google.com/macros/s/AKfycbzMaD3Ur0H3VmatL4W2vVHlYhFOXF4cZSSjIcn3SwggbTCs9Q9F1_PH74F16lAFkUlWZQ/exec?view=first-run-e2e | Fresh provisioning, onboarding, real Refresh, navigation, customer wording, Restricted sharing, and verified Trash. |
| Populated Dashboard E2E | https://script.google.com/macros/s/AKfycbzMaD3Ur0H3VmatL4W2vVHlYhFOXF4cZSSjIcn3SwggbTCs9Q9F1_PH74F16lAFkUlWZQ/exec?view=populated-dashboard-e2e | Representative populated KPIs, workspaces, selectors/actions, navigation, Refresh, language, Restricted sharing, and verified Trash. |
| Recovery Live | https://script.google.com/macros/s/AKfycbzMaD3Ur0H3VmatL4W2vVHlYhFOXF4cZSSjIcn3SwggbTCs9Q9F1_PH74F16lAFkUlWZQ/exec?view=recovery-test | Production candidate detection, explicit reconnect, stale/Trash routing, ambiguity, admin immutability, protected-target exclusion, Restricted sharing, and verified cleanup. |

These routes accept no email or workbook ID. They are invisible to other
identities and must be opened as cashcompass2026@gmail.com.

## Deployment identifiers

| Environment | Deployment ID | Rule |
| --- | --- | --- |
| Central Beta | AKfycbyq_OGiupdGO79GMOImkIgYv19hqlN1JuJfieuDlkXH6Rp637MhZc6jz9uRW2ZxANBlPA | Keep pinned until an explicit Beta promotion decision. |
| Isolated Central validation | AKfycbzMaD3Ur0H3VmatL4W2vVHlYhFOXF4cZSSjIcn3SwggbTCs9Q9F1_PH74F16lAFkUlWZQ | Safe target for approved isolated deployment updates. |

If a deployment is replaced rather than version-updated, update this registry,
PROJECT_CONTEXT.md, and the deployment checklist in the same change.
