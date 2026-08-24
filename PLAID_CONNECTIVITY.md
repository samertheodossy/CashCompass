# CashCompass Plaid Connectivity Runbook

**Status:** Plaid Sandbox infrastructure checkpoint established; no CashCompass Plaid runtime exists yet.

**Current milestone:** **P1 — Plaid Sandbox Connectivity Foundation**.

**Environment allowed now:** **Sandbox only**.

**Last reviewed:** 2026-08-24.

This is the authoritative operational and architectural handoff for the
CashCompass Plaid/Google Cloud integration. It is tool-neutral and intentionally
self-contained so a human engineer or coding agent can continue without access
to a prior conversation, IDE, or development-tool history. Update it whenever
the connectivity milestone, infrastructure, ownership, or deployment state
changes.

# Repository Is the Source of Truth

Repository documentation, current Git state, authoritative financial/identity
contracts, and direct read-only inspection of deployed infrastructure determine
the actual project state.

The following are convenience context only and are **not authoritative**:

- chat transcripts;
- screenshots;
- AI memory;
- previous agent summaries;
- local recollection; and
- stale handoff notes.

If sources disagree, use this precedence:

1. Authoritative contracts.
2. Current Git state and current source.
3. Direct read-only infrastructure inspection.
4. `PLAID_CONNECTIVITY.md`.
5. `PROJECT_CONTEXT.md`.
6. `ROADMAP.md`.
7. Historical notes or chat summaries.

If an apparent contradiction remains, stop and report it instead of guessing.

# Current Verified Checkpoint

- Repository: `/Users/stheodos/Desktop/Samer-Financial-Planner`
- Expected branch: `main`
- Current known committed checkpoint:
  `8d1686f14a24993c305911cb08b15ab0bd03b50d`
- Commit subject: `feat: establish Chase shadow import contracts`
- Current Google Cloud project: `cashcompass-plaid-sandbox`
- Project number: `884544026781`
- Region: `us-west1`
- Current engineering phase: **P1 — Plaid Sandbox Connectivity Foundation**

> These values must be verified before making changes. Do not trust this
> section blindly if Git or direct read-only infrastructure inspection
> disagrees.

# Component Status at This Checkpoint

Status terms are literal: **PLANNED**, **PROVISIONED**, **ENABLED**,
**IMPLEMENTED**, **DEPLOYED**, **VALIDATED**, **DEFERRED**, or the explicit
negative form shown below. Provisioned infrastructure does not imply that
application code exists or has been deployed.

| Component | Status | Notes |
| --- | --- | --- |
| Plaid developer Sandbox | **PROVISIONED** | Synthetic provider environment available |
| Google Cloud Sandbox project | **PROVISIONED** | `cashcompass-plaid-sandbox` |
| Billing linkage | **PROVISIONED** | Free Trial was active when provisioned |
| Budget alerts | **PROVISIONED** | $10 alert budget; not a hard cap |
| Required Google APIs | **ENABLED** | Six explicitly required integration services |
| Runtime service account | **PROVISIONED** | Least-privilege non-human identity |
| Firestore | **PROVISIONED** | Empty `(default)` Native database |
| KMS key | **PROVISIONED** | Resource-scoped credential-encryption key |
| Plaid Secret Manager resources/versions | **PROVISIONED** | Two resources; values are not documented |
| Artifact Registry | **PROVISIONED** | Empty Docker repository |
| Cloud Run backend source | **NOT IMPLEMENTED** | P1 work has not started |
| Cloud Run service | **NOT DEPLOYED** | No service exists |
| Plaid Sandbox Item through CashCompass | **NOT CREATED** | No connectivity flow exists |
| Plaid Trial Item | **NOT CREATED** | P3 only after explicit authorization |
| Liabilities normalization | **NOT IMPLEMENTED** | Deferred to P2 |
| Financial Facts Apply | **NOT IMPLEMENTED** | Shadow-apply authority not approved |
| Planning authority migration | **NOT IMPLEMENTED** | Requires a separate approval checkpoint |

# Starting From a New Development Environment or Agent

Do not start coding immediately.

1. Open or clone the repository.
2. Read `AGENTS.md`.
3. Read `PLAID_CONNECTIVITY.md` completely.
4. Read `PROJECT_CONTEXT.md`.
5. Read `ROADMAP.md`.
6. Read the financial and identity contracts referenced by this runbook.
7. Run `git status`.
8. Run `git log -5 --oneline`.
9. Run `gcloud auth list`.
10. Run `gcloud config get-value project`.
11. Verify that the project is `cashcompass-plaid-sandbox` before Sandbox work.
12. Run only commands classified **READ-ONLY** during orientation.
13. Determine the current milestone from actual Git and infrastructure state.
14. Do not retrieve secret values.
15. Do not change provider environment automatically.
16. Do not deploy automatically.
17. Do not modify populated bounded workbooks unless explicitly required.
18. Do not assume prior conversation history exists or is correct.

> Do not begin implementation until repository state, cloud identity, cloud
> project, and current milestone are reconciled.

# 1. Product Strategy

CashCompass remains fully usable without Plaid. Plaid is an **optional**
connected-data layer, not a requirement for using the product. Existing manual
workflows remain supported.

The intended customer journey is:

```text
CashCompass
→ Connect financial accounts
→ user authorizes an institution through Plaid
→ CashCompass receives reviewed and sanitized evidence
```

Plaid should eventually support connected evidence for:

- credit cards;
- bank accounts;
- investments; and
- mortgages.

Plaid is not the provider for house/property market value. A separate future
property-data/AVM provider is required for that purpose. Mortgage data is debt
evidence, not property valuation evidence.

QFX, PDF, and manual import remain supported fallback/manual evidence paths.

# 2. Architectural Principle

Plaid must never become CashCompass's internal financial model:

```text
Plaid
→ isolated provider adapter
→ normalized provider evidence
→ CashCompass Financial Facts and domain contracts
→ customer/system review
→ optional future authority approved separately
```

Provider field names must remain inside the provider adapter. CashCompass
identity, provenance, freshness, review, and authority contracts remain
authoritative. Imported/provider data begins as shadow evidence. Planning
remains unchanged unless a later task explicitly approves an authority change.

# 3. Administrative Identities and Trust Domains

| Identity | Trust domain | Role |
| --- | --- | --- |
| `cashcompass2026@gmail.com` | Plaid / Google Cloud infrastructure | Primary Plaid developer and Google Cloud infrastructure administrator |
| `samertheodossy@gmail.com` | CashCompass application | Sole CashCompass application administrator; also current backup/secondary Google Cloud project Owner |
| `cashcompass-plaid-backend@cashcompass-plaid-sandbox.iam.gserviceaccount.com` | Google Cloud runtime | Non-human future Cloud Run runtime identity |

Trust-domain rules:

- `cashcompass2026@gmail.com` owning Plaid/GCP does **not** make it a
  CashCompass application administrator. Never add or elevate it through
  `ADMIN_EMAILS` or its fallback.
- `samertheodossy@gmail.com` being the sole CashCompass application
  administrator does **not** imply exclusive provider/GCP ownership.
- Google Cloud IAM Owner is different from CashCompass application
  administrator.
- End users do not create Plaid developer accounts.
- End users authenticate to their own financial institutions only through
  Plaid Link.
- Plaid-connected institution credentials are not developer credentials and
  must never be exposed to CashCompass.
- Do not remove either current human Google Cloud Owner without an explicit
  ownership-transfer/security task.

# 4. Plaid Developer Account

**Status: PROVISIONED.**

- Developer team/application name: **Cash Compass**
- Use case: **Personal finances**
- Administrative Google/email identity: `cashcompass2026@gmail.com`
- Dashboard: <https://dashboard.plaid.com/>

Do not record Plaid Client ID or Secret values here. Sandbox credential values
are stored only in Google Secret Manager.

# 5. Plaid Environments

## Sandbox

- Synthetic data only.
- Free development/proof environment.
- Does not consume Production Trial Items.
- Current active development environment.
- Every identity, DTO, screen, fixture, and log context must be marked
  `SANDBOX` where environment ambiguity is possible.

## Trial

- Real institution connections for a carefully controlled owner/family proof.
- Reserved for P3, after Sandbox connectivity and liabilities preview are fully
  working.
- The currently selected Plaid Trial model allows up to 10 Production Items.
  Confirm then-current Plaid terms before P3 and do not waste Items on repeated
  or redundant connection experiments.
- **DO NOT CREATE A REAL TRIAL ITEM UNTIL P3 and explicit authorization.**

## Production

- Future broader/external customer environment.
- Requires separate infrastructure, credentials, operations, security review,
  billing controls, and provider-contract review.

Sandbox, Trial, and Production must never share access tokens, credentials,
datastores, protected-identity namespaces, or environment configuration.

# Sensitive Data That Must Never Be Copied Into Repository Documentation

Do not copy any of the following into repository documentation, source, tests,
logs, screenshots, issue text, or handoff notes:

- Plaid Client ID values, which this project treats as credential material;
- Plaid Secret values;
- Plaid access tokens;
- Plaid public tokens;
- raw Plaid Item IDs;
- raw Plaid account IDs;
- raw financial-institution credentials;
- raw QFX/PDF source files or private filenames;
- real statement text;
- real transaction data or merchant histories;
- real financial values used during source proof;
- raw FITIDs;
- KMS plaintext;
- Firestore encrypted credential blobs;
- payment-card or payment-method details;
- Google Cloud payment information;
- secret values from Secret Manager; or
- screenshots containing visible credentials or financial data.

Resource names, project IDs, service-account identities, deployment references,
and secret **resource names** are safe to document. Secret values are not.

# Environment Promotion Rules

## SANDBOX

Synthetic Plaid data only. This is the only currently allowed provider
environment for implementation and proof.

## TRIAL

Real owner/family institution data. Trial requires explicit authorization, and
limited Item capacity must not be consumed casually.

## PRODUCTION

Future broader/external use. Production requires separate explicit security,
privacy, operations, billing, support, and provider approval.

Promotion rules:

- Never promote Sandbox work to Trial automatically.
- Never promote Trial work to Production automatically.
- Never reuse tokens, credentials, protected identities, provider connection
  records, datastores, or cryptographic namespaces across environments.
- Environment must participate in every protected-identity namespace.
- A developer or coding agent must stop if asked to use a different provider
  environment without explicit task authorization.

# 6. Environment Safety Matrix

| Environment | Data | Purpose | Allowed now? |
| --- | --- | --- | --- |
| Plaid Sandbox | Synthetic | Development and connectivity proof | **YES** |
| Plaid Trial | Real owner/family data | P3 provider proof | **NO — not until explicitly authorized** |
| Plaid Production | Real external customer data | Future broader use | **NO** |
| Bounded CashCompass | Real owner workbook | Production-like personal application data | **NO Plaid changes unless explicitly authorized** |
| Central Beta | Shared/family test application | Controlled Beta application | **Do not deploy Plaid changes automatically** |

# 7. Current Google Cloud Sandbox Project

**Status: PROVISIONED.**

- Project ID: `cashcompass-plaid-sandbox`
- Project name: **CashCompass Plaid Sandbox**
- Project number: `884544026781`
- Region: `us-west1`
- Primary provider/infrastructure administrative identity:
  `cashcompass2026@gmail.com`
- Backup/current additional owner: `samertheodossy@gmail.com`

Do not remove the backup owner during current Sandbox development.

# 8. Billing and Cost Guardrail

**Status: PROVISIONED.**

- Google Cloud Free Trial was activated under the Cash Compass account.
- The $300 credit / 90-day trial was active when the project was provisioned.
- The Sandbox project is linked to the billing account displayed as
  **My Billing Account**.
- Do not record full payment details.
- Monthly alert budget: **CashCompass Plaid Sandbox - $10 Budget**.
- Alert thresholds: **50%**, **90%**, and **100%**.

The budget is an alerting mechanism, not a hard spending cap. A future engineer
must still review usage, logs, Cloud Run scaling, and provider activity.

Expected owner/family traffic should be low: Cloud Run can scale to zero,
Firestore usage is small, Secret Manager/KMS calls are infrequent, and logs
should contain only sanitized operational metadata. This is not a price
guarantee.

# 9. Enabled Google Services

**Status: ENABLED.**

The explicitly enabled integration services are:

- `run.googleapis.com`
- `secretmanager.googleapis.com`
- `cloudkms.googleapis.com`
- `firestore.googleapis.com`
- `artifactregistry.googleapis.com`
- `cloudbuild.googleapis.com`

The project also has Google-default APIs enabled. Those were not intentionally
disabled and should not be broadly disabled as part of Plaid work.

# 10. Runtime Service Account

**Status: PROVISIONED; not attached to a deployed Cloud Run service.**

| Identity | Type | Purpose | Where used |
| --- | --- | --- | --- |
| `cashcompass-plaid-backend@cashcompass-plaid-sandbox.iam.gserviceaccount.com` | Google Cloud service account | Least-privilege Plaid Sandbox backend runtime identity | Future Cloud Run service; Firestore, scoped Secret Manager, scoped KMS, and Cloud Logging access |

- Name: `cashcompass-plaid-backend`
- It is not a human login.
- Do not use it interactively unless a deliberate administrative/debug task
  explicitly requires impersonation.
- Current project-level roles:
  - `roles/datastore.user`
  - `roles/logging.logWriter`
- KMS and Secret Manager access are deliberately **not** project-wide.

# 11. Firestore

**Status: PROVISIONED and empty; application use is NOT IMPLEMENTED.**

- Database: `(default)`
- Mode: Firestore Native
- Edition: Standard
- Region: `us-west1`
- Delete protection: enabled
- Free tier: reported enabled at creation
- Current data state: no application collections/documents created

Purpose: encrypted per-user Plaid connection registry plus sanitized connection
and account lifecycle metadata.

Future conceptual hierarchy:

```text
environment
→ protected user
→ connection
→ protected accounts
```

Raw provider credentials and identifiers must never be stored unencrypted.
Firestore storage encryption is supplemented by application-layer Cloud KMS
encryption of the persistent credential blob.

# 12. Cloud KMS

**Status: PROVISIONED; application encryption use is NOT IMPLEMENTED.**

- Keyring: `cashcompass-plaid-sandbox`
- Region: `us-west1`
- Key: `plaid-connection-credentials`
- Rotation: 90 days
- Purpose: encrypt/decrypt persistent Plaid credential blobs before Firestore
  storage.

The backend service account has
`roles/cloudkms.cryptoKeyEncrypterDecrypter` **only on this key**. The
project-wide KMS role was deliberately removed.

# 13. Secret Manager

**Status: PROVISIONED; backend access is NOT IMPLEMENTED.**

Secret resource names only:

- `plaid-sandbox-client-id` — version 1 enabled
- `plaid-sandbox-secret` — version 1 enabled

The backend service account has `roles/secretmanager.secretAccessor` **only on
these two secrets**. The project-wide Secret Manager accessor role was
deliberately removed.

Never place Plaid credential values in:

- Git;
- source code;
- Markdown files;
- workbook cells;
- Apps Script Script Properties;
- browser JavaScript;
- logs;
- tests;
- screenshots; or
- chat prompts.

# 14. Artifact Registry

**Status: PROVISIONED and empty; no image is DEPLOYED.**

- Repository: `cashcompass-plaid-backend`
- Format: Docker
- Region: `us-west1`
- URI:
  `us-west1-docker.pkg.dev/cashcompass-plaid-sandbox/cashcompass-plaid-backend`
- Current state: empty; no container image has been deployed
- Purpose: future Cloud Run backend container images

Container vulnerability scanning was not enabled at this checkpoint. This is
not a Sandbox blocker, but it must be revisited before broader Beta or
Production.

# 15. Provisioned Resource Inventory

| Resource | Name | Region | Purpose | Current state |
| --- | --- | --- | --- | --- |
| Google Cloud project | `cashcompass-plaid-sandbox` (project number `884544026781`) | Project/global | Sandbox isolation boundary | **PROVISIONED**; billing linked |
| Budget | `CashCompass Plaid Sandbox - $10 Budget` | Billing account | 50/90/100% alerts | **PROVISIONED**; alert-only |
| Service account | `cashcompass-plaid-backend` | Project/global | Future Cloud Run runtime | **PROVISIONED**; not attached to a deployed service |
| Firestore | `(default)` | `us-west1` | Encrypted connection registry | **PROVISIONED**; empty; delete protection enabled |
| KMS keyring | `cashcompass-plaid-sandbox` | `us-west1` | Holds Sandbox cryptographic key | **PROVISIONED** |
| KMS key | `plaid-connection-credentials` | `us-west1` | Encrypt/decrypt credential blobs | **PROVISIONED**; 90-day rotation; resource-scoped IAM |
| Secret | `plaid-sandbox-client-id` | Project/global | Plaid Sandbox application identifier | **PROVISIONED**; version 1 enabled; resource-scoped IAM |
| Secret | `plaid-sandbox-secret` | Project/global | Plaid Sandbox application secret | **PROVISIONED**; version 1 enabled; resource-scoped IAM |
| Artifact Registry | `cashcompass-plaid-backend` (`us-west1-docker.pkg.dev/cashcompass-plaid-sandbox/cashcompass-plaid-backend`) | `us-west1` | Backend container images | **PROVISIONED**; empty |
| Cloud Run | Not created | `us-west1` planned | Narrow Plaid security backend | **NOT DEPLOYED** |
| Plaid Sandbox Item through CashCompass | Not created | `SANDBOX` | Future synthetic connection proof | **NOT CREATED** |
| Plaid Trial Item | Not created | `TRIAL` | Future one-Item real-source proof | **NOT CREATED** |

# Resource Lifecycle and Recovery

| Resource | Recreate safely? | Required guardrail |
| --- | --- | --- |
| Google Cloud project | No, not as routine recovery | Project deletion is broadly destructive and requires explicit approval, dependency inventory, export/retention review, and a recovery plan |
| Firestore | Only before durable connection state exists, or through an approved migration | Do not delete casually once real connection state exists; preserve ownership, lifecycle, tombstone, and encrypted-credential dependencies |
| KMS key/keyring | No while any ciphertext depends on it | Never disable or destroy a key until every dependent credential blob has been revoked, removed, migrated, or proven disposable |
| Plaid credential secrets | Rotatable, not casually recreatable | Coordinate provider credential rotation with deployed revision configuration; never expose old or new values |
| Artifact Registry | Images are reproducible from reviewed source | Check Cloud Run revision/image references before cleanup; never remove an image used by an active deployment |
| Future Cloud Run service | Re-deployable from reviewed source/configuration | Inventory ingress, IAM, secrets, service account, datastore schema, and active revision before deletion or replacement |
| Future Plaid Item/connection | No, not as authentication repair | Prefer Plaid Update Mode for reauthentication/consent changes; do not create duplicates |
| Future Trial Item | Capacity may not be recoverable by deletion | Do not delete/recreate casually; deleting an Item may not restore Trial capacity |

Disconnect is complete only after Plaid access is revoked and local credential
material is deleted. A provider revocation failure leaves the connection in
`DISCONNECT_PENDING` with normal refresh prohibited.

# 16. Planned Minimal Backend

**Status: PLANNED; source is NOT IMPLEMENTED and no service is DEPLOYED.**

Approved architecture:

```text
CashCompass browser
→ google.script.run
→ Apps Script server
→ authenticated/signed backend request
→ Cloud Run
→ Plaid

Cloud Run
→ Secret Manager
→ Firestore
→ Cloud KMS
```

The browser must never receive:

- Plaid secret;
- Plaid access token;
- raw Plaid Item ID;
- raw Plaid account ID; or
- another user's connection identity.

Apps Script and workbook state must never contain access tokens, raw Item IDs,
raw account IDs, or raw Plaid liability payloads. Apps Script may transiently
relay only a short-lived Link token and one-time public token through a reviewed
server path. Browser output is limited to sanitized candidates, protected
CashCompass identity, normalized preview evidence, and safe status/error codes.

# 17. P0 Architecture Decision

Cloud Run was selected over Apps Script-only, Cloud Functions as the primary
shape, and a larger Firebase-style application framework.

CashCompass needs one small secure HTTPS service for:

- Link-token creation;
- public-token exchange;
- encrypted credential storage;
- sanitized account discovery;
- disconnect/revocation; and
- later webhook support.

This backend must remain a narrow provider-security boundary. It is not a
second CashCompass application and must not duplicate Financial Facts, Planning,
or workbook business logic.

# Connectivity Architecture Decision Log

## Plaid primary / file fallback

**Decision:** Plaid is primary for connected financial accounts. QFX, PDF, and
manual workflows remain fallback/manual evidence paths.

**Why:** This reduces customer friction and avoids making institution-specific
file export workflows the normal connected experience.

## Plaid optional

**Decision:** CashCompass remains fully functional without Plaid.

**Why:** Users retain manual control and are never forced to connect provider
accounts.

## CashCompass Financial Facts remain the internal authority boundary

**Decision:** Plaid data passes through provider adapters and normalized
evidence contracts.

**Why:** Provider schema, availability, or commercial changes must not redefine
CashCompass identity, provenance, freshness, review, or Planning semantics.

## Cloud Run rather than Apps Script-only

**Decision:** Use one narrow Cloud Run backend.

**Why:** Long-lived token custody, authenticated provider calls, encrypted
storage, disconnect/revocation, arbitrary webhook headers, and future webhook
verification require a stronger backend boundary.

## Firestore plus Cloud KMS

**Decision:** Use Firestore for per-user connection lifecycle records and Cloud
KMS for application-layer encryption of credential material.

**Why:** Connection ownership/lifecycle needs a queryable datastore; durable
token material requires encryption beyond ordinary application fields.

## Resource-scoped IAM

**Decision:** KMS and Secret Manager roles are granted on exact resources, not
across the project.

**Why:** A runtime compromise should expose no more infrastructure authority
than the backend needs.

## Manual refresh initially

**Decision:** Owner/family Beta starts with manual refresh.

**Why:** It keeps early operation explicit and avoids premature scheduler and
webhook complexity.

## Canonical APR remains review-required

**Decision:** Plaid component APR fields do not automatically establish one
canonical applicable APR.

**Why:** Purchase, cash-advance, balance-transfer, promotional, and carried
balance semantics may differ; incorrect automatic selection would change debt
ranking.

## Property AVM separate from Plaid

**Decision:** Use a separate future property-data provider for house market
value.

**Why:** Plaid mortgage information is liability evidence, not defensible
residential property valuation.

## Houses and mortgages remain separate identities

**Decision:** Mortgage debt identity never substitutes for property identity.

**Why:** A property can have zero, one, or multiple related loans, and each has
different lifecycle, authority, and valuation semantics.

# 18. Authentication Design Status

**Status: PLANNED; NOT IMPLEMENTED or VALIDATED.**

P0 proposed:

```text
Browser
→ Apps Script
→ authenticated Cloud Run
```

Apps Script obtains authoritative CashCompass identity using
`Session.getEffectiveUser()`. Browser-supplied email or user ID must never be
trusted. Backend ownership lookups must always be rooted in authenticated,
protected user identity; cross-user connection lookup is prohibited.

Before custom assertion signing is implemented, P1 must evaluate whether a
Google-native Cloud Run authentication mechanism can meet the actual
`USER_ACCESSING` Apps Script execution constraints.

Preferred hierarchy:

1. Google-native service authentication, if it works safely without giving end
   users infrastructure roles or exposing a service credential.
2. Otherwise, short-lived CashCompass signed assertions containing audience,
   environment, protected user, action, body hash, expiry, and one-time nonce.

Neither mechanism is implemented or approved as complete yet.

# 19. Protected Identity and Normalization

**Status: PLANNED; NOT IMPLEMENTED.**

- Raw `item_id`, raw `account_id`, and access token remain backend-only.
- Protected Item/account keys are generated in the secure backend.
- Environment is part of every protected-identity namespace.
- Institution metadata is sanitized.
- Account mask/last four is display-only and cannot authorize matching.
- Name, mask, and institution may suggest a review candidate but cannot create
  or silently merge a source link.
- Account continuity changes must route to review rather than silent remapping.

Normalization boundary:

```text
Plaid raw response
→ Plaid provider adapter
→ normalized provider evidence
→ CashCompass preview DTO
→ existing identity/fact contracts
```

Provider-specific fields must not leak through the application.

# 20. P1 Scope — Sandbox Connectivity Foundation

**Status: CURRENT NEXT ACTION; NOT IMPLEMENTED.**

P1 implements only:

```text
Plaid Sandbox Link
→ one-time public-token exchange
→ encrypted connection storage
→ sanitized account discovery
→ disconnect
```

P1 explicitly excludes:

- `/liabilities/get` normalization;
- Financial Facts writes;
- Planning or Data Readiness authority;
- investment, mortgage, or bank facts;
- transactions;
- webhooks;
- scheduled refresh;
- real Trial connections; and
- any real Chase connection.

# 21. P2 and P3 Roadmap

**Status: DEFERRED.**

## P2 — Sandbox credit-card Liabilities preview

Add a read-only, normalized preview for current balance, available credit,
credit limit, statement balance/date, minimum payment, due date, APR components,
last-payment evidence, and overdue evidence where actually supplied. Do not
create canonical APR, payment status, Financial Facts, or Planning authority.

## P3 — One carefully reserved real Chase Trial Item

Use one explicitly authorized Trial Item to compare actual Plaid Chase liability
coverage against the already verified Chase QFX/PDF evidence. Avoid redundant
connections because removing/reconnecting does not restore Trial capacity.

Only after real provider proof and a separate approval may shadow Financial
Facts Apply be designed or enabled.

# 22. Existing Chase QFX/PDF Evidence

Real-source Chase research already established the following sanitized source
knowledge.

QFX evidence can supply:

- protected account identity;
- current balance;
- available credit for the reviewed Chase FID profile; and
- stable transaction-replay identity on overlapping FITID evidence.

PDF evidence can supply:

- statement balance;
- minimum payment;
- exact due date;
- credit limit;
- statement available credit; and
- component APR evidence.

This remains valuable fallback/manual-source knowledge, but Plaid is now the
primary connected-data path. Never place real filenames, account suffixes,
FITIDs, merchants, transaction details, values, or owner financial information
in fixtures or this runbook.

# 23. Financial Facts Rules Preserved

- `STATEMENT_BALANCE` is provider-independent.
- `CURRENT_BALANCE` is not `STATEMENT_BALANCE`.
- Component APR evidence is not canonical applicable `APR`.
- Canonical APR cannot be manufactured automatically from provider ordering,
  a headline/purchase rate, or caller/client flags.
- Missing evidence stays unknown; missing does not mean zero.
- Explicit zero can be valid evidence.
- `Effective As Of` is not `Observed At`.
- Inactive or review-required identity fails closed.
- Last four/account mask is display-only.
- Provider evidence remains shadow-only until separately approved.
- Historical evidence is append-only; replay and conflicts do not silently
  overwrite history.

Authoritative detail remains in `PART_2A_FINANCIAL_FACTS_CONTRACT.md`,
`PART_2A_IDENTITY_CONTRACT.md`, and
`PART_2A_AUTHORITATIVE_REVOLVING_DEBT_CONTRACT.md`.

# 24. Security MUST NOT Rules

- No raw provider IDs in a workbook.
- No tokens or credentials in Git.
- No Plaid secrets or access tokens in Apps Script Script Properties.
- No raw Plaid payload logging.
- No browser authority over identity.
- No cross-user connection lookup.
- No silent account matching by mask, name, or institution.
- No Planning writes from a connected-data proof.
- No Trial/Production credential, token, datastore, or identity reuse.
- No real customer source copied into fixtures.
- No browser exposure of another user's provider/account identity.
- No silent overwrite of customer/manual data.

# 25. Disconnect and Update Lifecycle

**Status: PLANNED; NOT IMPLEMENTED.**

Planned disconnect behavior:

```text
Disconnect requested
→ verify authenticated owner
→ mark DISCONNECTING
→ revoke Plaid Item
→ delete local credential material
→ retain sanitized DISCONNECTED historical identity/tombstone
→ prohibit future refresh
```

Historical Financial Facts remain historical evidence and are not silently
deleted. If provider revocation fails transiently, record
`DISCONNECT_PENDING`, prohibit normal refresh, retain encrypted credential
material only as long as required to retry revocation, and do not claim that
disconnect completed.

Future `ITEM_LOGIN_REQUIRED`, consent expiration, institution OAuth changes,
and account-selection changes should use Plaid Update Mode rather than creating
duplicate Items where appropriate.

# 26. Manual Refresh and Future Webhooks

**Status: manual refresh is PLANNED; webhooks and scheduling are DEFERRED.**

Owner/family Beta begins with manual refresh. P1 has no refresh scheduler and no
webhook implementation. Later infrastructure may add a dedicated Cloud Run
webhook route that can access arbitrary headers, verify Plaid's signed webhook,
deduplicate events, map protected Item identity to its owner, and avoid token
exposure.

# 27. Canonical Links and Navigation

## Plaid

| Destination | Link/navigation | Used for / expected state | Do not change casually |
| --- | --- | --- | --- |
| Plaid Dashboard | <https://dashboard.plaid.com/> | Open the Cash Compass developer team/application | Team ownership, use case, and environment configuration |
| Sandbox | Dashboard → **Developers → Sandbox** | Synthetic institutions, Items, and Sandbox tooling; no CashCompass-created Item exists yet | Do not mistake synthetic results for institution proof |
| Keys | Dashboard → **Developers → Keys** | Credential metadata and environment keys | Never copy credential values into Git, docs, screenshots, logs, prompts, or Apps Script |
| Trial/Production access | Use the Plaid Dashboard's Production/plan/access area when P3 is approved | Production access status and Trial capacity | **DO NOT CREATE A REAL TRIAL ITEM UNTIL P3**; do not change plan/access configuration without approval |

Credential values are stored only in Google Secret Manager.

## Google Cloud

| Service | Link | Used for / expected state | Do not change casually |
| --- | --- | --- | --- |
| Project dashboard | <https://console.cloud.google.com/home/dashboard?project=cashcompass-plaid-sandbox> | Confirm project identity, health, and resource context | Project, region strategy, ownership, or environment |
| IAM | <https://console.cloud.google.com/iam-admin/iam?project=cashcompass-plaid-sandbox> | Owners plus project-level runtime roles | Owners, broad roles, or admin grants |
| APIs & Services | <https://console.cloud.google.com/apis/dashboard?project=cashcompass-plaid-sandbox> | Six integration APIs plus Google defaults | Disable APIs or enable unrelated services |
| Cloud Run | <https://console.cloud.google.com/run?project=cashcompass-plaid-sandbox> | Currently no service; future P1 backend | Deploy, expose, delete, or change scaling/IAM without approval |
| Firestore | <https://console.cloud.google.com/firestore/databases?project=cashcompass-plaid-sandbox> | `(default)`, Native/Standard, `us-west1`, empty | Delete protection, location, data, indexes, or rules casually |
| Secret Manager | <https://console.cloud.google.com/security/secret-manager?project=cashcompass-plaid-sandbox> | Two Sandbox secret resources, version 1 enabled | Never reveal values; do not broaden IAM or create ad hoc copies |
| Cloud KMS | <https://console.cloud.google.com/security/kms?project=cashcompass-plaid-sandbox> | Sandbox keyring and 90-day rotating credential key | Disable/destroy keys, change rotation, or broaden IAM |
| Artifact Registry | <https://console.cloud.google.com/artifacts?project=cashcompass-plaid-sandbox> | Empty Docker repository | Delete repository or push unreviewed images |
| Cloud Build | <https://console.cloud.google.com/cloud-build/builds?project=cashcompass-plaid-sandbox> | Future reviewed container-build history; currently no backend build | Add triggers, permissions, or builds without implementation approval |
| Service accounts | <https://console.cloud.google.com/iam-admin/serviceaccounts?project=cashcompass-plaid-sandbox> | Least-privilege backend runtime identity | Create keys, impersonate interactively, or broaden roles |
| Billing | <https://console.cloud.google.com/billing> | Billing account and project linkage | Payment/account settings or project linkage |
| Budgets | <https://console.cloud.google.com/billing/budgets> | $10 monthly alert budget with 50/90/100% alerts | Delete alerts or assume they cap spending |
| Logging | <https://console.cloud.google.com/logs/query?project=cashcompass-plaid-sandbox> | Sanitized future operational logs | Enable raw request/payload/token logging or excessive retention |
| Monitoring | <https://console.cloud.google.com/monitoring?project=cashcompass-plaid-sandbox> | Future service health, errors, latency, and cost signals | Add noisy/expensive policies without review |

## CashCompass and repository

`TESTING_URLS.md` is the authoritative live URL registry. If its values change,
update this runbook rather than guessing.

| Surface | Link/reference | Purpose and safety rule |
| --- | --- | --- |
| GitHub repository | <https://github.com/samertheodossy/CashCompass> | Authoritative Git remote; do not commit/push without explicit approval |
| Central Beta | <https://script.google.com/macros/s/AKfycbyq_OGiupdGO79GMOImkIgYv19hqlN1JuJfieuDlkXH6Rp637MhZc6jz9uRW2ZxANBlPA/exec> | Family Beta, currently pinned at `@106`; do not update during isolated validation or Plaid work without explicit promotion approval |
| Isolated Central validation | <https://script.google.com/macros/s/AKfycbzMaD3Ur0H3VmatL4W2vVHlYhFOXF4cZSSjIcn3SwggbTCs9Q9F1_PH74F16lAFkUlWZQ/exec> | Approved disposable/read-only validation target only when deployment is authorized; current authoritative version is in `TESTING_URLS.md` |
| Validation & Testing console | <https://script.google.com/macros/s/AKfycbzMaD3Ur0H3VmatL4W2vVHlYhFOXF4cZSSjIcn3SwggbTCs9Q9F1_PH74F16lAFkUlWZQ/exec?view=validation> | Sole operator-facing validation surface; sign in as the sole CashCompass app administrator |
| Personal bounded dashboard | <https://script.google.com/macros/s/AKfycbycMA4qlzDASi3OWp650_kzg91ReoXC9xK78o2HerCtwFfQjnej6zJq_MpTxppKM44L/exec> | Owner-controlled real workbook application; never use for Harness/writer validation or Plaid proof. `TESTING_URLS.md` records current bounded deployment-inventory ambiguity, so confirm the owner-selected singleton there before any release action |
| Central Apps Script project | `.clasp-central.json` and `PROJECT_CONTEXT.md → Deployment & Push Workflows` | Separate standalone Central target; use `./push-central.sh` only after explicit approval |
| Bounded Apps Script project | `.clasp.json` and `PROJECT_CONTEXT.md → Deployment & Push Workflows` | Separate bound target; never switch or deploy casually |

# 28. Command Risk Classification

During orientation, run only **READ-ONLY** commands. Do not run a mutating,
destructive, or sensitive operation merely because it appears in a historical
note or terminal history.

## READ-ONLY

These commands inspect local Git, CLI configuration, or infrastructure metadata.
None prints secret values.

```bash
git status
git log -5 --oneline
gcloud config get-value project
gcloud auth list
gcloud billing projects describe cashcompass-plaid-sandbox
gcloud services list --enabled --project=cashcompass-plaid-sandbox
gcloud iam service-accounts list --project=cashcompass-plaid-sandbox
```

```bash
gcloud firestore databases describe \
  --database="(default)" \
  --project=cashcompass-plaid-sandbox
```

```bash
gcloud kms keys describe plaid-connection-credentials \
  --keyring=cashcompass-plaid-sandbox \
  --location=us-west1 \
  --project=cashcompass-plaid-sandbox

gcloud kms keys get-iam-policy plaid-connection-credentials \
  --keyring=cashcompass-plaid-sandbox \
  --location=us-west1 \
  --project=cashcompass-plaid-sandbox
```

```bash
gcloud secrets list \
  --project=cashcompass-plaid-sandbox \
  --format="table(name)"

gcloud secrets versions list plaid-sandbox-client-id \
  --project=cashcompass-plaid-sandbox \
  --format="table(name,state)"

gcloud secrets versions list plaid-sandbox-secret \
  --project=cashcompass-plaid-sandbox \
  --format="table(name,state)"
```

```bash
gcloud artifacts repositories describe cashcompass-plaid-backend \
  --location=us-west1 \
  --project=cashcompass-plaid-sandbox
```

## MUTATING / ADMIN ACTION

Examples include:

- changing the active gcloud account or project;
- enabling/disabling APIs;
- creating or modifying IAM policies;
- creating secrets, keys, databases, repositories, or service accounts;
- building/pushing images; and
- deploying or changing Cloud Run.

Run these only with explicit task intent and authorization. Configuration
correction examples appear in Recovery and Troubleshooting and are labeled
accordingly.

## DESTRUCTIVE / SENSITIVE

Examples include:

- retrieving any secret value;
- destroying/disabling KMS keys;
- deleting Firestore or its data;
- calling Plaid Item removal;
- deleting the Google Cloud project;
- rotating credentials;
- deleting active Artifact Registry images;
- removing project owners; and
- promoting from Sandbox to Trial or Production.

These require explicit scope, target verification, impact analysis, and
authorization. Never add `versions access`, `secrets versions access`, payload
output, or another command that reveals credential values to ordinary runbook
verification steps.

# 29. Recovery and Troubleshooting

## Wrong gcloud account

**READ-ONLY:**

```bash
gcloud auth list
```

Expected active account: `cashcompass2026@gmail.com`.

If deliberately correcting the provider-infrastructure CLI context, the
following is a **MUTATING / ADMIN ACTION**:

```bash
gcloud config set account cashcompass2026@gmail.com
```

Do not switch automatically; first confirm that the task is a Plaid Sandbox
infrastructure task.

## Wrong project

**READ-ONLY:**

```bash
gcloud config get-value project
```

Expected: `cashcompass-plaid-sandbox`.

If deliberately correcting the project, the following is a
**MUTATING / ADMIN ACTION**:

```bash
gcloud config set project cashcompass-plaid-sandbox
```

## Cannot access the project

Check <https://console.cloud.google.com/iam-admin/iam?project=cashcompass-plaid-sandbox>.
Expected owners include `cashcompass2026@gmail.com` and
`samertheodossy@gmail.com`. Do not remove either owner as an access fix.

## Billing problems

**READ-ONLY:**

```bash
gcloud billing projects describe cashcompass-plaid-sandbox
```

Expected: `billingEnabled: true`. Do not expose payment details.

## Secret access

**READ-ONLY metadata inspection only.** Do not print a secret. Use only the
`gcloud secrets list` and
`gcloud secrets versions list ... --format="table(name,state)"` metadata
commands above.

## KMS permission

**READ-ONLY:** use `gcloud kms keys get-iam-policy ...` from the command
reference. Verify
that the backend service account's encrypter/decrypter role is scoped to the
named key. Do not encrypt/decrypt sample real credentials merely to test IAM.

## Firestore

**READ-ONLY:** use `gcloud firestore databases describe` from the command
reference. Expect Native
Standard `(default)` in `us-west1`, with delete protection enabled.

## Artifact Registry

**READ-ONLY:** use the repository `describe` command from the command reference.
Expect the Docker repository
in `us-west1`; it is empty at this checkpoint.

## Backend deployment

There is no Cloud Run service yet. Do not waste time searching for an existing
deployment and do not create one unless P1 implementation/deployment is
explicitly authorized.

# 30. Central Development and Deployment Context

Cross-reference rather than duplicate these authorities:

- `PROJECT_CONTEXT.md`
- `ROADMAP.md`
- `PART_2A_FINANCIAL_FACTS_CONTRACT.md`
- `PART_2A_IDENTITY_CONTRACT.md`
- `PART_2A_AUTHORITATIVE_REVOLVING_DEBT_CONTRACT.md`
- `ENGINEERING_STANDARDS.md`
- `AGENTS.md`
- `TESTING_URLS.md`

Plaid work must preserve the rule that existing populated bounded workbooks are
not modified or restyled unless a task explicitly requires bounded changes.
Automated writers must never target a bounded, mapped-user, Golden, or
configured-default workbook. No commit, push, or deployment occurs by default
without explicit approval.

# 31. Current Deployment State

This section must be updated at every future connectivity milestone.

## Google Cloud

- Required integration APIs: **ENABLED**.
- Firestore: **PROVISIONED** and empty.
- KMS key: **PROVISIONED** with resource-scoped IAM.
- Two Sandbox secret resources: **PROVISIONED** with resource-scoped IAM.
- Artifact Registry: **PROVISIONED** and empty.
- Cloud Run backend source: **NOT IMPLEMENTED**.
- Cloud Run service: **NOT DEPLOYED**.

## Plaid

- Developer Sandbox: **PROVISIONED**.
- Sandbox credential resources: **PROVISIONED** in Secret Manager.
- CashCompass-created Plaid Sandbox Item: **NOT CREATED**.
- Trial Item: **NOT CREATED**.

## CashCompass

- Plaid backend source: **NOT IMPLEMENTED**.
- Apps Script Plaid bridge: **NOT IMPLEMENTED**.
- Plaid UI: **NOT IMPLEMENTED**.
- Plaid Financial Facts writes: **NOT IMPLEMENTED**.
- Planning behavior/authority migration: **NOT IMPLEMENTED**.
- Bounded workbook changes: **NONE**.

# 32. Current Next Action

Next engineering milestone:

**P1 — Plaid Sandbox Connectivity Foundation**

Before P1 implementation:

1. Read this runbook.
2. Verify Git is clean and synchronized.
3. Verify the active gcloud account and project.
4. Verify no credential exposure.
5. Decide Google-native versus signed-assertion backend authentication under
   the real Apps Script execution constraints.
6. Implement the narrow backend plus minimal Apps Script bridge.
7. Stop before commit, deployment, or any Item creation unless those actions are
   explicitly authorized.

# Explicit Non-Goals at This Checkpoint

Do not start:

- a Trial Chase connection;
- any Production connection;
- `/liabilities/get` normalization;
- Financial Facts Apply;
- Planning authority changes;
- bank-fact ingestion;
- investment connectivity or facts;
- mortgage connectivity or facts;
- transactions or recurring-bill discovery;
- property AVM integration;
- webhooks or scheduled refresh;
- the Chase QFX parser; or
- the Chase PDF parser.

# 33. Do Not Forget

- Plaid is optional for users.
- Existing CashCompass manual workflows remain valid.
- Never silently overwrite manual/customer data.
- Imported/provider data starts as shadow evidence.
- Missing is not zero (`missing != zero`).
- `CURRENT_BALANCE != STATEMENT_BALANCE`.
- APR components are not canonical APR.
- Account mask/last four is not identity.
- Trial Items are limited; do not waste them.
- QFX/PDF work remains useful fallback evidence.
- Houses need a separate AVM provider for market value.
- Plaid mortgage data is debt evidence, not house valuation.
- Do not store provider credentials in workbook or Git.
- Plaid schema is not the CashCompass internal model.
- Raw provider IDs and tokens do not belong in workbooks, Git, or logs.
- Update this runbook whenever infrastructure or milestone state changes.

# 34. New Development Session Handoff Template

This template is tool-neutral and can be given to a human engineer or coding
agent in any development environment:

```text
Continue development of CashCompass.

Repository:
/Users/stheodos/Desktop/Samer-Financial-Planner

Before doing anything:

1. Read AGENTS.md.
2. Read PLAID_CONNECTIVITY.md completely.
3. Read PROJECT_CONTEXT.md.
4. Read ROADMAP.md.
5. Read the contracts referenced by PLAID_CONNECTIVITY.md.
6. Run git status and inspect recent commits.
7. Verify the active Google account and Google Cloud project using the read-only
   commands in PLAID_CONNECTIVITY.md.
8. Determine the current Plaid milestone from repository and infrastructure state.

Do not rely on previous conversation history.
Do not retrieve or expose secrets.
Do not use Trial or Production unless explicitly authorized.
Do not modify populated bounded workbooks unless explicitly authorized.
Do not commit, push, or deploy unless explicitly authorized.

Continue only from the repository-documented and independently verified current
checkpoint.
```

# 35. Documentation Definition of Done

A Plaid/connectivity milestone is not complete until:

- this runbook reflects actual infrastructure state;
- the current milestone is updated;
- component-status and resource-inventory tables are updated;
- deployment state is updated;
- canonical links remain correct;
- the architecture decision log is updated if a decision changed;
- the change log receives an entry;
- direct inspection evidence and validation are recorded where required; and
- a sensitive-data review confirms that no secrets or private financial data
  were introduced.

# 36. Connectivity Runbook Change Log

| Date | Milestone | Git commit | Infrastructure resources created/changed | Deployment state | Provider environment | Next step |
| --- | --- | --- | --- | --- | --- | --- |
| 2026-08-24 | P0 security/backend architecture and Sandbox infrastructure checkpoint | Baseline `8d1686f`; runbook uncommitted | Sandbox project, budget, APIs, service account, Firestore, KMS, Secret Manager, and Artifact Registry documented | No Cloud Run service, image, CashCompass Item, Trial Item, workbook write, or Plaid runtime | `SANDBOX`; no Item created | P1 Sandbox Link, exchange, encrypted storage, sanitized discovery, and disconnect |

Every later milestone must record its date, milestone, Git commit,
infrastructure resources created/changed, deployment state, provider
environment, and next step without including secret values.
