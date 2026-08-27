# CashCompass Plaid Connectivity Runbook

## One-product design invariant

Plaid connectivity has one customer-visible CashCompass design across Central and bounded. Bank Accounts, Debts, and Investments must use the same inline Connected experience, navigation, controls, terminology, and review workflow from the same reviewed source. Environment-specific credentials, properties, authentication, and infrastructure may differ behind that shared interface, but they must never produce a second Plaid screen or a different user journey. If an environment constraint appears to require a design fork, implementation stops for an explicit owner decision.

**Status:** P1 Trial runtime plus real owner Chase and Bank of America connections
are proven. Dedicated project `cashcompass-plaid-trial` (`462665464202`) serves
revision `cashcompass-plaid-backend-00006-lgd`. The isolated Central candidate is
deployed at `@403`, visibly marked Trial/real-data and read-only. Connected
evidence now lives contextually inside Bank Accounts, Debts, and Investments;
there is no separate top-level Connected Accounts workspace. One BofA Item
exposed fourteen accounts through one login; the corrected preview attached all
evidence by protected account identity rather than provider array order. Twelve
depository accounts exposed current and available candidates, and two mortgages
exposed current-balance candidates that the owner successfully compared with
explicit active, verified CashCompass Debt identities. Central
remains on GCP Default, Beta remains `@106`, bounded is untouched, Sandbox
remains intact, and `cashcompass-application` remains **PREPARED BUT UNATTACHED /
PARKED**.

The current local candidate converges Central and bounded on that same native
inline experience. The bounded manifest adds the existing Google-supported
`script.external_request` scope exactly once so the bounded server can call the
same signed backend after one owner authorization. This convergence is local
only: no bounded source, deployment, Script Property, workbook, Plaid Item, or
provider connection changed.

**Current product milestone:** **COMMON INLINE CENTRAL/BOUNDED PLAID SOURCE
LOCALLY VALIDATED — BOUNDED CONFIGURATION AND OWNER PUSH REMAIN SEPARATE.**

**Environment allowed now:** **Trial infrastructure and the isolated read-only
preview are enabled. Retain the existing Chase and BofA Items; use Refresh for
evidence and Update Mode for reauthentication. Do not reconnect, disconnect, or
create another Item without a separate owner-approved reason. CashCompass
`PRODUCTION` remains disabled.**

# PLAID IS A REVIEWED IMPORT CHANNEL

Plaid retrieves candidate financial data. CashCompass previews normalized
evidence. The user decides in a later, separately approved Apply workflow what
becomes authoritative. Plaid never silently overwrites CashCompass data.

**Last reviewed:** 2026-08-25.

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
  `23da5580974bcf1c1eb87b5892356f825a0fe015`
- Commit subject: `docs: add Plaid connectivity runbook`
- Current provider-runtime projects: `cashcompass-plaid-sandbox`
  (`884544026781`) and `cashcompass-plaid-trial` (`462665464202`)
- Region: `us-west1`
- Current engineering phase: **Owner Real Data Accuracy Proof — Trial runtime
  and first owner connection checkpoint**

> These values must be verified before making changes. Do not trust this
> section blindly if Git or direct read-only infrastructure inspection
> disagrees.

Application-level Google Cloud administration is governed by
`CASHCOMPASS_APPLICATION_GCP.md`. The current protected topology is:

```text
CashCompass Central → Apps Script-managed default GCP project
Plaid Sandbox backend → cashcompass-plaid-sandbox
Plaid Trial backend → cashcompass-plaid-trial
cashcompass-application → PREPARED BUT UNATTACHED / PARKED
```

Central must never attach directly to the provider Sandbox project. It also
must not attach to the parked application project merely for Plaid. The sole
administrator authorized the existing external-request scope without a GCP
association or manifest change; this per-user consent did not immediately
change any other user's authorization. Provider credentials and connection
resources remain outside Apps Script.

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
| Protected-identity HMAC secret | **PROVISIONED** | Version 1 enabled; exact-resource runtime accessor only |
| Artifact Registry | **PROVISIONED** | Reviewed P1 images present |
| Cloud Run backend source | **IMPLEMENTED** | Local Node 22 candidate under `services/plaid-backend` |
| Cloud Run service | **DEPLOYED; HANDSHAKE VALIDATED** | Sandbox revision `cashcompass-plaid-backend-00004-l88`; Apps Script-origin signed runtime-status returned HTTP 200 |
| Apps Script Sandbox bridge | **IMPLEMENTED; SIGNING VALIDATED** | Central `@HEAD`; signing properties are present with proof OFF; no immutable deployment changed |
| Signing provisioning/rotation | **PROVISIONED; OFF** | Initial install verified; temporary page/public handlers removed; local key files deleted |
| Backend assertion public-key ring | **DEPLOYED** | Explicit one-to-three-key allowlist; currently accepts only `plaid-sandbox-assertion-20260824-v2` |
| Plaid Sandbox proof adapter | **IMPLEMENTED; NOT A PRODUCT MILESTONE** | Registered in the single Validation console; no synthetic Item was needed for the signed transport proof |
| Plaid Sandbox Item through CashCompass | **NOT CREATED** | Full fake-data lifecycle intentionally not required |
| Plaid Trial Item | **TWO ACTIVE / ONE ORPHANED** | One retained Chase Item and one retained BofA Item; the earlier Chase timeout left one non-restorable orphaned slot. Dashboard evidence showed 3/10 consumed and 7 remaining after BofA |
| Google Cloud Trial project | **PROVISIONED** | `cashcompass-plaid-trial` (`462665464202`), region `us-west1` |
| Trial runtime identity | **PROVISIONED; LEAST PRIVILEGE** | Dedicated runtime service account with exact secret/KMS grants plus datastore/logging roles |
| Trial Firestore/KMS/secrets | **PROVISIONED** | Isolated Native database, rotating credential key, and three enabled version-1 secret resources |
| Trial Cloud Run service | **DEPLOYED; REAL-DATA VALIDATED** | Revision `cashcompass-plaid-backend-00006-lgd`; Trial→Plaid Production fixed server-side; duplicate-institution prevention, multi-account discovery, mortgage current-balance normalization, and provider-timestamp normalization deployed |
| Trial signing identity | **PROVISIONED; VALIDATED** | Key ID `plaid-trial-assertion-20260824-v1`; private material remains only in Central Script Properties |
| Isolated Trial preview | **DEPLOYED; REAL-DATA VALIDATED** | Central isolated `@403`; protected runtime gate, read-only warning, identity-keyed multi-account rendering, explicit account selection, visible observation time, and no Apply/Save/Accept. Connected evidence is grouped contextually under Bank Accounts, Debts, and Investments instead of a standalone navigation destination; `@403` preserves the selected contextual mode across late manual-account reads and retains the Bank Accounts panel-structure correction from `@402` |
| Account/balance normalization | **IMPLEMENTED AND REAL-DATA VALIDATED** | BofA supplied current and available balance candidates for all twelve exposed depository accounts; provider-effective time remained missing and was not invented |
| Mortgage normalization | **IMPLEMENTED AND REAL-DATA VALIDATED** | BofA supplied current-balance candidates for two mortgage accounts; only `CURRENT_BALANCE` is exposed, available-balance semantics are excluded, and comparison requires an explicit active, verified CashCompass Debt identity |
| Liabilities normalization | **IMPLEMENTED; CHASE-VALIDATED** | Credit-card facts, timestamps, APR components, and read-only comparison; no BofA credit card was exposed by the selected login |
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
- Retained only for minimal automated connectivity checks; it is not a product
  milestone or financial-accuracy evidence source.
- Every identity, DTO, screen, fixture, and log context must be marked
  `SANDBOX` where environment ambiguity is possible.

## Trial

- Real institution connections for the owner-first accuracy proof.
- CashCompass environment name is explicit `TRIAL`. Plaid Trial uses Plaid's
  Production API endpoint (`https://production.plaid.com`), but this does not
  enable CashCompass's future `PRODUCTION` environment. The backend rejects the
  literal `PRODUCTION` environment and every unknown/mismatched pair.
  References: <https://plaid.com/docs/api/> and
  <https://plaid.com/docs/account/billing/>.
- The current Plaid Trial plan allows 10 Production Items. Every successfully
  created Production access token counts, and `/item/remove` does not restore
  capacity. Persist the encrypted access token and do not reconnect casually.
- The first connection requests only `liabilities`. Do not request Transactions,
  Statements, Auth, Identity, Investments, or Balance for the first Chase proof.
- **DO NOT CREATE THE FIRST REAL TRIAL ITEM until the read-only vertical slice
  passes review and the owner explicitly authorizes that specific connection.**

## Production

- Future broader/external customer environment.
- Requires separate infrastructure, credentials, operations, security review,
  billing controls, and provider-contract review.

Sandbox, Trial, and Production must never share access tokens, credential
resources, datastores, protected-identity namespaces, or environment
configuration. The explicit environment document namespace remains mandatory
defense in depth even in each isolated datastore. Trial requires its own Google
Cloud project/database configuration, Plaid secrets, identity-HMAC secret, KMS
configuration, backend runtime configuration, signing properties, and provider
profile.

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

Synthetic Plaid data only. Use only for a minimal automated connectivity check
when technically required; synthetic values are never financial-accuracy proof.

## TRIAL

Real owner/family institution data. Trial requires explicit authorization for
the first Item, and limited non-restorable Item capacity must not be consumed
casually.

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
| Plaid Sandbox | Synthetic | Minimal automated connectivity check only | **YES, when technically necessary** |
| Plaid Trial | Real owner/family data | Owner real-data import/accuracy proof | **NO — readiness implementation and explicit Item approval required** |
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
| `cashcompass-plaid-backend@cashcompass-plaid-sandbox.iam.gserviceaccount.com` | Google Cloud service account | Least-privilege Plaid Sandbox backend runtime identity | Deployed Cloud Run service; Firestore, scoped Secret Manager, scoped KMS, and Cloud Logging access |

- Name: `cashcompass-plaid-backend`
- It is not a human login.
- Do not use it interactively unless a deliberate administrative/debug task
  explicitly requires impersonation.
- Current project-level roles:
  - `roles/datastore.user`
  - `roles/logging.logWriter`
- KMS and Secret Manager access are deliberately **not** project-wide.

# 11. Firestore

**Status: PROVISIONED; nonce persistence/replay use VALIDATED; connection
registry IMPLEMENTED but no Item/connection record created.**

- Database: `(default)`
- Mode: Firestore Native
- Edition: Standard
- Region: `us-west1`
- Delete protection: enabled
- Free tier: reported enabled at creation
- Current data state: signed-handshake nonce evidence exists; no Plaid
  connection/account record has been created

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

**Status: PROVISIONED; credential-encryption code IMPLEMENTED; no real or
Sandbox Item credential has been encrypted.**

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

**Status: PROVISIONED; backend credential-read access VALIDATED without
retrieving values into inspection output.**

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

**Status: PROVISIONED; reviewed P1 images are present and the corrected image is deployed.**

- Repository: `cashcompass-plaid-backend`
- Format: Docker
- Region: `us-west1`
- URI:
  `us-west1-docker.pkg.dev/cashcompass-plaid-sandbox/cashcompass-plaid-backend`
- Current deployed tag: `p1-23da558-6581bdc6515a`
- Current deployed digest: `sha256:a49110d5d6a2e1ae91ddf79fa2d055e0d3cea7a4add06a422a9bff77b22fbfb8`
- Purpose: reviewed Cloud Run backend container images

Container vulnerability scanning was not enabled at this checkpoint. This is
not a Sandbox blocker, but it must be revisited before broader Beta or
Production.

# 15. Provisioned Resource Inventory

| Resource | Name | Region | Purpose | Current state |
| --- | --- | --- | --- | --- |
| Google Cloud project | `cashcompass-plaid-sandbox` (project number `884544026781`) | Project/global | Sandbox isolation boundary | **PROVISIONED**; billing linked |
| Budget | `CashCompass Plaid Sandbox - $10 Budget` | Billing account | 50/90/100% alerts | **PROVISIONED**; alert-only |
| Service account | `cashcompass-plaid-backend` | Project/global | Cloud Run runtime | **PROVISIONED**; attached to the deployed Sandbox service |
| Firestore | `(default)` | `us-west1` | Nonces plus encrypted connection registry | **PROVISIONED**; nonce evidence only; no connection record; delete protection enabled |
| KMS keyring | `cashcompass-plaid-sandbox` | `us-west1` | Holds Sandbox cryptographic key | **PROVISIONED** |
| KMS key | `plaid-connection-credentials` | `us-west1` | Encrypt/decrypt credential blobs | **PROVISIONED**; 90-day rotation; resource-scoped IAM |
| Secret | `plaid-sandbox-client-id` | Project/global | Plaid Sandbox application identifier | **PROVISIONED**; version 1 enabled; resource-scoped IAM |
| Secret | `plaid-sandbox-secret` | Project/global | Plaid Sandbox application secret | **PROVISIONED**; version 1 enabled; resource-scoped IAM |
| Secret | `plaid-sandbox-identity-hmac-key` | Project/global | Server-held protected Item/account identity key | **PROVISIONED**; version 1 enabled; exact-resource runtime grant only |
| Artifact Registry | `cashcompass-plaid-backend` (`us-west1-docker.pkg.dev/cashcompass-plaid-sandbox/cashcompass-plaid-backend`) | `us-west1` | Backend container images | **PROVISIONED**; reviewed P1 images present |
| Cloud Run | `cashcompass-plaid-backend` | `us-west1` | Narrow Plaid security backend | **DEPLOYED**; revision `cashcompass-plaid-backend-00004-l88`, Sandbox only |
| Plaid Sandbox Item through CashCompass | Not created | `SANDBOX` | Future synthetic connection proof | **NOT CREATED** |
| Plaid Trial Item | One retained; one orphaned | `TRIAL` | Owner real-source proof | **ACTIVE / CAPACITY INCIDENT UNDER REVIEW** |

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

**Status: P1 IMPLEMENTED; Sandbox backend DEPLOYED; customer connectivity not
enabled.**

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

## One product path: owner-first and multi-user ready

CashCompass uses one long-lived connectivity path:

```text
CashCompass
→ Connect financial accounts
→ authorize institution
→ review connected accounts and evidence
→ continue using CashCompass normally
```

The owner, family Beta users, and future external users must use the same Apps
Script bridge, assertion contract, backend routes, protected identity model,
encrypted credential model, and disconnect lifecycle. Sandbox, Trial, and
Production may use different infrastructure, provider credentials, data,
feature flags, and explicit approvals; those environment differences must not
create a product or business-logic fork.

The P1 exact-test-identity condition is a temporary activation gate around the
shared bridge and backend contracts, not a separate owner or Sandbox
implementation. Future eligibility broadening must replace that narrow gate
with reviewed per-user access configuration while preserving server-derived
identity and owner-scoped backend storage. A browser-supplied identity is never
accepted. Manual CashCompass workflows remain authoritative and Plaid remains
optional.

Long-term acceptance question: if the owner uses this path for years and later
5, 50, or more users use it, the core integration remains valid. Each user's
Item, encrypted access token, account mappings, refresh, re-authentication, and
disconnect state are rooted under that user's protected identity. Scaling the
eligible population changes configuration and capacity, not the core
integration.

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

**Status: RS256 RUNTIME PROTOCOL DEPLOYED; SIMPLE TEMPORARY
PROVISIONING/ROTATION AND PUBLIC-KEY RING IMPLEMENTED LOCALLY; SIGNING
PROPERTIES STILL ABSENT/OFF.**

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

P1 evaluated Google-native Cloud Run authentication first. Private Cloud Run
invocation requires a Google-signed identity token accepted for the service
audience plus an IAM principal with `run.invoker`. Apps Script's effective-user
OAuth token is an access token, not that audience-bound service token. Its OIDC
user token is audience-bound to an OAuth client, and using it for this flow
would add per-family-user Cloud Run IAM grants and a new OpenID consent surface.
It also would not bind the exact Link/exchange/disconnect action and request
body. Those constraints do not cleanly preserve CashCompass's application-owned
allow-list and short-lived request authorization model.

Decision references:

- <https://developers.google.com/apps-script/reference/script/script-app>
- <https://cloud.google.com/run/docs/authenticating/service-to-service>
- <https://cloud.google.com/docs/authentication/token-types>

The local P1 candidate therefore uses an RS256 CashCompass assertion signed only
by Apps Script server code. It includes issuer, audience, `SANDBOX`, opaque
user-scoped identity, permitted action, exact request-body SHA-256, issued-at,
60-second expiration, key ID, and one-time nonce. The backend verifies all
claims and records the nonce transactionally in Firestore before dispatch.
The private signing key is a Central Script Property and never reaches a normal
customer browser. The trusted administrator's browser handles it briefly during
the temporary provisioning operation. Cloud Run receives only the public
verification key as non-secret configuration. Functional Cloud Run routes
require this assertion. Because
Apps Script cannot present a service-account identity token, the deployment
must be network-reachable with application-level authentication; that exposure
is bounded by the signed assertion, short lifetime, body/action binding, replay
guard, request-size limit, fail-closed Sandbox configuration, and conservative
Cloud Run scaling.

## Protected-Central decision

The owner selected **KEEP CENTRAL UNCHANGED — SIMPLE SAFE PROVISIONING**.
Existing Central is a protected compatibility boundary:

- keep its Apps Script-managed default GCP association;
- keep its Script ID and deployment IDs;
- add no OAuth scope;
- require no user reauthorization;
- keep Beta `@106` and bounded unchanged; and
- keep `cashcompass-application` prepared but unattached/parked.

RS256 is retained. Script Properties are accepted as custody for one
application signing private key under restricted Apps Script editor trust. Any
project editor must be treated as capable of running code that reads Script
Properties; therefore editor access is production-privileged and must never be
given to ordinary customers. Cloud Run receives public keys only.

## Temporary `/dev` administrator provisioner

Provisioning is administrator setup, not customer functionality. The temporary
surface consists only of `PlaidSandboxProvisioningUI.html`, its guarded route,
and narrowly scoped initial/rotation handlers. It is never linked from normal
CashCompass navigation and must never enter an immutable Beta version. Google
documents the `/dev` test deployment as editor-only and always running current
saved source:

- <https://developers.google.com/apps-script/guides/web#test_a_web_app_deployment>

The page accepts exactly:

- Sandbox backend URL;
- immutable assertion key ID; and
- PKCS#8 RSA private key.

Proof is not browser input and is always installed as literal `false`. The
administrator browser temporarily holds plaintext in the local key file,
clipboard, page memory, HTTPS request, and Apps Script server execution. This is
accepted because the sole administrator already controls the Apps Script
project. The page contains no customer navigation, does not retrieve or display
existing values, clears the private-key field after submission, and never
receives the key back.

Every handler independently requires:

1. server-derived effective user exactly `samertheodossy@gmail.com`;
2. the existing `isAdminUser_()` gate;
3. Central mode;
4. the exact Central Script ID;
5. proof absent or literal `false`;
6. a Script lock;
7. all four target properties absent for first install;
8. exact input fields only—no identity, Script ID, property names, proof value,
   or arbitrary property map;
9. valid HTTPS `run.app` backend URL;
10. bounded URL-safe key ID; and
11. structurally valid, signing-capable PKCS#8 RSA private key.

## Fail-safe property installation

First install requires all four target properties to be absent. Rotation
requires all four to exist, proof to equal literal `false`, and both expected
current values to match. A Script lock serializes provisioning/rotation so two
administrator executions cannot race the stale-state checks. The writer uses
`setProperties(values, false)` so
unrelated Script Properties remain intact, then re-reads and verifies safe
public values plus private-key presence/shape. It returns only installed status,
property names, proof status, key ID, and a private-key-present boolean.

The exact property set is:

- `PLAID_SANDBOX_PROOF_ENABLED=false`
- `PLAID_SANDBOX_BACKEND_URL`
- `PLAID_SANDBOX_ASSERTION_KEY_ID`
- `PLAID_SANDBOX_ASSERTION_PRIVATE_KEY_PEM`

Any write or verification failure attempts to force proof OFF and returns only
a sanitized failure. Apps Script Properties does not provide a transactional
database commit; the OFF-first/re-read design makes any partial result inert and
requires explicit recovery rather than an automatic overwrite.

## Initial setup and cleanup

1. Generate one keypair outside Git and configure its public key/key ID on the
   Sandbox backend.
2. Temporarily enable the reviewed administrator provisioner on Central HEAD.
3. Open the `/dev` route as the sole administrator.
4. Submit the backend URL, key ID, and private key; install with proof OFF.
5. Verify the sanitized result and run the signed proof-OFF handshake.
6. Remove the temporary HTML, route, and public handlers from Central HEAD.
7. Clear the clipboard, close the page, and securely delete local key files.
8. Confirm proof remains false, Beta remains `@106`, and unrelated Script
   Properties remain unchanged.

## Reversibility

- Before property installation, abort and cleanup leave CashCompass unchanged.
- After installation, literal proof `false` keeps Plaid inert until a separate
  enablement decision.
- Removing the temporary provisioner does not remove or alter stored Script
  Properties.
- Existing immutable Apps Script versions remain usable because no Beta version
  is created during transport.
- Cloud Run public-key changes remain immutable-revision deployments with
  rollback to the prior revision.
- Normal CashCompass startup has no dependency on the provisioner, Plaid
  properties, or Cloud Run; a Plaid failure cannot break manual workflows.

## Rotation and backend key ring

Cloud Run configuration accepts an explicit one-to-three-entry public-key map
through `CASHCOMPASS_ASSERTION_PUBLIC_KEYS_JSON`. Each map key is an immutable
allowed key ID and each value is an RSA public PEM. The request `kid` selects
only from this map; unknown or removed IDs fail closed. The legacy single public
key/key-ID variables remain a one-key compatibility input until the next
reviewed backend deployment.

For Sandbox, the ring is reviewed non-secret Cloud Run revision configuration.
Deployment IAM protects configuration integrity; the runtime service account
needs no new permission to read it. Public keys do not justify a new Secret
Manager resource or broader runtime IAM. Every change still creates a reviewed
immutable revision so the accepted key IDs remain auditable and rollbackable.

Rotation sequence:

1. turn proof OFF;
2. deploy Cloud Run with current and next public keys;
3. temporarily restore the administrator `/dev` provisioner and require the
   exact current key ID/backend URL before installing the new key;
4. verify a signed Sandbox handshake while proof remains OFF;
5. enable proof only after review;
6. after the assertion lifetime plus operational margin, redeploy without the
   retired public key; and
7. delete local plaintext and remove the temporary page/handlers from Central
   `@HEAD`.

Sandbox, Trial, and Production must use separate environment-specific key
rings and key IDs. No private signing key belongs in Cloud Run, Secret Manager
for the provider backend, a customer page, a CashCompass user workbook, Git,
logs, or documentation. The trusted administrator browser handles plaintext
only during the temporary provisioning session.

# 19. Protected Identity and Normalization

**Status: DISCONNECT AND UPDATE MODE IMPLEMENTED LOCALLY; NOT DEPLOYED OR
PROVIDER-VALIDATED.**

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

# 20. Signed Connectivity Foundation

**Status: COMPLETE FOR THE REAL-DATA READINESS GATE.**

The implemented foundation provides:

```text
Plaid Link contract
→ one-time public-token exchange
→ encrypted connection storage
→ sanitized account discovery
→ disconnect
```

The Apps Script-origin proof completed this path without creating a synthetic
Item: server-derived user → RS256 signing → `UrlFetchApp` → Cloud Run signature
verification → transactional nonce consumption → sanitized runtime status.
No additional Sandbox lifecycle is required before the real-data vertical
slice unless a specific implementation defect requires one minimal automated
call.

The foundation explicitly excludes:

- `/liabilities/get` normalization;
- Financial Facts writes;
- Planning or Data Readiness authority;
- investment, mortgage, or bank facts;
- transactions;
- webhooks;
- scheduled refresh;
- real Trial connections; and
- any real Chase connection.

# 21. Owner Real Plaid Data Import / Accuracy Proof

**Status: READ-ONLY VERTICAL SLICE IMPLEMENTED AND SYNTHETICALLY VALIDATED
LOCALLY; NOT DEPLOYED; REAL ITEM NOT AUTHORIZED.**

The first vertical slice serves the owner through the normal CashCompass
application and later serves family/external users through the same contracts:

```text
Connect Chase
→ request only Plaid Liabilities
→ exchange and encrypt one Item credential
→ fetch account + credit-card liability data
→ normalize candidate evidence
→ show read-only comparison
→ owner reviews
```

The comparison surface is:

| Fact | Existing CashCompass | Plaid Import | As Of | Status |
| --- | --- | --- | --- | --- |
| One supported fact per row | Existing value or missing | Candidate value or missing | Provider/source timestamp when supplied; otherwise observed-at time labeled as such | `MATCH`, `DIFFERENT`, `PLAID_MISSING`, `EXISTING_MISSING`, `STALE`, or `SEMANTIC_REVIEW_REQUIRED` |

The first Chase proof evaluates, where actually supplied: institution and
protected account identity, display/official name, type/subtype, current
balance, available credit, credit limit, last statement balance and issue date,
minimum payment, next payment due date, APR components, and source/effective
timestamps. Plaid's ordinary cached balance has no guaranteed Chase-specific
source timestamp; an application observation time must never be mislabeled as
the institution's effective time.

`CURRENT_BALANCE` and `STATEMENT_BALANCE` remain distinct. APR rows preserve
`apr_type`, percentage, balance subject to APR, and interest charge when
provided. Components never manufacture canonical applicable APR, which remains
`SEMANTIC_REVIEW_REQUIRED`.

Before the first Item, the implementation must:

1. isolate Trial/Production credentials, datastore namespace, protected
   identity namespace, and runtime configuration from Sandbox without changing
   Central's GCP association;
2. request exactly `liabilities` with credit-card account filtering where
   supported;
3. enforce one in-flight connection intent per CashCompass user and reject a
   new user/institution connection when an active mapping already exists;
4. use Link update mode for `ITEM_LOGIN_REQUIRED`, pending expiration, consent
   renewal, and account/permission maintenance instead of creating another
   Item; and
5. make Disconnect call `/item/remove`, invalidate the stored credential, mark
   the connection disconnected, and explain that the consumed Trial slot is not
   restored and institution-side OAuth permission may still require separate
   revocation.

The local candidate now implements those code contracts. A normal create is
refused when the protected user already has any `ACTIVE`, `REAUTH_REQUIRED`,
`DISCONNECTING`, or `DISCONNECT_PENDING` connection; this deliberately
conservative V1 guard
prevents accidental Trial consumption before institution identity is known.
One in-flight Link intent is serialized per protected user. Public-token and
Link-session replay fail closed. The post-exchange protected Item identity is
unique. Update Mode decrypts only the owner's existing credential, supplies its
access token to `/link/token/create`, omits `products`, and completes without a
public-token exchange or replacement credential.

The unavoidable pre-Link limitation is explicit: Plaid does not reveal the
selected institution until Link progresses, so a new connection cannot be
authoritatively classified by institution before Link. V1 therefore favors
Item conservation and requires the existing connection to be resolved first.
A later multi-institution enhancement may introduce server-issued institution
selection context, but may not trust mask, display name, or suffix as identity.

`/liabilities/get` remains the only refresh product call. The adapter returns
protected account identity, sanitized display metadata, and candidate rows for
`CURRENT_BALANCE`, `AVAILABLE_CREDIT`, `CREDIT_LIMIT`, `STATEMENT_BALANCE`,
statement-date source metadata, `MINIMUM_PAYMENT`, `NEXT_PAYMENT_DATE`, and
typed APR components when supplied. It never creates canonical `APR`. Every
candidate has an actual CashCompass `Observed At`; provider effective time is
blank unless Plaid supplies applicable source-date evidence.

The normal CashCompass dashboard provides the one supported Plaid surface.
Bank Accounts, Debts, and Investments each expose the same native inline
Connected mode from the same reviewed source. There is no iframe, separate
Plaid page, redirect, second tab, or environment-specific customer journey.
The panels support Connect, Reconnect, Refresh evidence, Disconnect, mapping,
Connected, Needs Reconnect, Disconnected, and last-observed state. Each panel
shows only accounts belonging to its CashCompass domain.

Every bridge call resolves the authenticated CashCompass user, allowlist,
runtime mode, environment, and workbook on the server. In bounded mode, the
active container workbook must match `getUserSpreadsheet_()` or the request
fails closed. Browser-supplied owner, email, user key, workbook ID, or
spreadsheet ID is rejected. Comparison remains limited to server-resolved
active, VERIFIED canonical identities in that workbook. The browser may select
an eligible stable identity, but cannot provide existing values or ownership.
No Apply/Save/Accept control or financial writer exists.

Connected-panel failures are isolated from normal CashCompass loading. The
dashboard stays usable and the affected panel shows only:
`Connected data is temporarily unavailable.` Raw backend, authorization,
identity, workbook, credential, and provider errors must not reach the normal
user interface.

No Plaid candidate may write to `INPUT - Debts`, authoritative Financial Facts,
Planning, Bank Accounts, Investments, or Houses. Apply remains a later,
separately reviewed milestone: Plaid fetch → candidate evidence → preview → user
review → explicit approval → later Apply.

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
- No assertion private key in source, browser/customer UI, logs, user
  workbooks, or Cloud Run. Only the approved short-lived disposable bootstrap
  Sheet may carry it before verified cleanup.
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

**Status: DISCONNECT DEPLOYED BUT NOT ITEM-VALIDATED; UPDATE MODE IMPLEMENTED
LOCALLY, NOT DEPLOYED OR PROVIDER-VALIDATED.**

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

**Status: read-only manual liabilities refresh is IMPLEMENTED LOCALLY;
webhooks and scheduling are DEFERRED.**

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
| Trial/Production access | Use the Plaid Dashboard's Production/plan/access area when the owner-real-data slice is approved | Production access status, exact available products, and remaining Trial capacity | **DO NOT CREATE THE FIRST REAL TRIAL ITEM until readiness/security review and explicit owner approval**; do not change plan/access configuration without approval |

Credential values are stored only in Google Secret Manager.

## Google Cloud

| Service | Link | Used for / expected state | Do not change casually |
| --- | --- | --- | --- |
| Project dashboard | <https://console.cloud.google.com/home/dashboard?project=cashcompass-plaid-sandbox> | Confirm project identity, health, and resource context | Project, region strategy, ownership, or environment |
| IAM | <https://console.cloud.google.com/iam-admin/iam?project=cashcompass-plaid-sandbox> | Owners plus project-level runtime roles | Owners, broad roles, or admin grants |
| APIs & Services | <https://console.cloud.google.com/apis/dashboard?project=cashcompass-plaid-sandbox> | Six integration APIs plus Google defaults | Disable APIs or enable unrelated services |
| Cloud Run | <https://console.cloud.google.com/run?project=cashcompass-plaid-sandbox> | Currently no service; future P1 backend | Deploy, expose, delete, or change scaling/IAM without approval |
| Firestore | <https://console.cloud.google.com/firestore/databases?project=cashcompass-plaid-sandbox> | `(default)`, Native/Standard, `us-west1`; nonce evidence only, no connection record | Delete protection, location, data, indexes, or rules casually |
| Secret Manager | <https://console.cloud.google.com/security/secret-manager?project=cashcompass-plaid-sandbox> | Two Sandbox secret resources, version 1 enabled | Never reveal values; do not broaden IAM or create ad hoc copies |
| Cloud KMS | <https://console.cloud.google.com/security/kms?project=cashcompass-plaid-sandbox> | Sandbox keyring and 90-day rotating credential key | Disable/destroy keys, change rotation, or broaden IAM |
| Artifact Registry | <https://console.cloud.google.com/artifacts?project=cashcompass-plaid-sandbox> | Reviewed P1 backend images | Delete repository or push unreviewed images |
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

Cloud Run service `cashcompass-plaid-backend` is deployed in `us-west1` on the
least-privilege runtime service account. Functional routes require the signed
CashCompass assertion. The public health route is `/health`; Cloud Run reserves
some paths ending in `z`, so `/healthz` must not be used.

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
- Firestore: **PROVISIONED**; nonce persistence/replay validated; one encrypted,
  owner-scoped Trial connection record exists.
- KMS key: **PROVISIONED** with resource-scoped IAM.
- Two Plaid Sandbox secret resources: **PROVISIONED** with resource-scoped IAM.
- Protected-identity HMAC secret: **PROVISIONED**, version 1 enabled, with an
  exact-resource runtime accessor grant.
- Artifact Registry: **PROVISIONED** with the reviewed P1 images.
- Cloud Run backend source: **IMPLEMENTED LOCALLY** under `services/plaid-backend`.
- Cloud Run service: **DEPLOYED** as revision
  `cashcompass-plaid-backend-00004-l88`, serving the reviewed key-ring digest.

## Plaid

- Developer Sandbox: **PROVISIONED**.
- Sandbox credential resources: **PROVISIONED** in Secret Manager.
- CashCompass-created Plaid Sandbox Item: **NOT CREATED**.
- Trial Items: **THREE CAPACITY SLOTS CONSUMED**; one retained Chase connection,
  one retained BofA connection, and one orphaned first Chase attempt. Seven
  Trial slots remain.

## CashCompass

- Plaid backend source: **IMPLEMENTED LOCALLY**; Node 22, native HTTP, official Google Cloud clients.
- Apps Script Plaid bridge: **PUSHED TO CENTRAL `@HEAD`**; Central-only signed
  assertions. The four signing properties are present and proof is literal
  `false`.
- Simple administrator provisioning/rotation: **INITIAL INSTALL COMPLETE**;
  sanitized verification confirmed all four target properties and preserved
  unrelated settings. The temporary `/dev` page and public handlers are removed;
  only underscored validation/rotation helpers remain.
- Backend public-key ring: **DEPLOYED**; explicit key-ID allowlist accepts only
  `plaid-sandbox-assertion-20260824-v2` at this checkpoint.
- Plaid UI: **PUSHED TO CENTRAL `@HEAD` AND ISOLATED `@403`** as the protected,
  read-only contextual connected-account candidate under Bank Accounts, Debts,
  and Investments; Beta remains `@106`.
- Plaid Financial Facts writes: **NOT IMPLEMENTED**.
- Planning behavior/authority migration: **NOT IMPLEMENTED**.
- Bounded workbook changes: **NONE**.
- Trial backend and normal-user preview: **DEPLOYED AND REAL-DATA VALIDATED**.
  Trial revision `cashcompass-plaid-backend-00006-lgd` and isolated Central
  `@403` expose identity-keyed deposit, credit-card, and mortgage evidence while
  preserving the read-only/no-Apply boundary.
- Trial runtime credentials, KMS/identity resources, backend configuration, and
  Central environment-specific signing properties: **PROVISIONED AND ENABLED**.
  Secret values remain outside source, documentation, and logs.

### Common inline bounded candidate — local only

- Common Central/bounded native inline source: **IMPLEMENTED AND LOCALLY
  VALIDATED; NOT PUSHED OR DEPLOYED TO BOUNDED**.
- The bounded manifest contains `script.external_request` exactly once. After a
  separately approved owner-only bounded HEAD push, the sole administrator must
  authorize that additional external-service capability once through bounded
  `/dev`.
- Central isolated `@403`, Central Beta `@106`, the bounded `/exec` deployment,
  retained provider connections, and Trial capacity are unchanged by this
  local checkpoint.

#### Minimum bounded runtime configuration

The bounded script project has its own Script Property store. Reusing the
shared backend requires these bounded properties before connected evidence can
load:

- `PLAID_IMPORT_ENABLED` — literal `true` only when the bounded bridge is ready;
- `PLAID_IMPORT_ENVIRONMENT` — `TRIAL` for this checkpoint;
- `PLAID_TRIAL_BACKEND_URL` — the reviewed shared Trial backend URL;
- `PLAID_TRIAL_ASSERTION_KEY_ID` — the immutable bounded signing-key ID;
- `PLAID_TRIAL_ASSERTION_PRIVATE_KEY_PEM` — the bounded private signing key.

The authenticated CashCompass email is server-derived and the shared backend
resolves it to the canonical protected owner. The signing key authenticates the
calling application; it is not owner identity. Bounded must not contain a
protected-user key or account-mapping JSON. Existing Central mappings migrate
once to the backend mapping authority, remain server-owned, and are then
immediately reusable from either Central or bounded without reconnecting the
institution or creating another Plaid Item.

Do not copy Plaid Client ID, Production Secret, access tokens, Item IDs, raw
account IDs, KMS material, or provider credentials into bounded. The private
assertion key is application transport custody, not a Plaid credential; it must
never enter Git, a workbook, documentation, logs, or browser output. Provision
these values only through a separately reviewed sole-administrator operation.
Until their presence is verified without retrieving their values, bounded
configuration status is **UNVERIFIED / NOT READY FOR REAL CONNECTED DATA**.

#### Shared connection and mapping authority

- The Trial backend is the canonical authority for connection ownership and
  account-to-CashCompass mappings. Script Properties and User Properties are not
  normal-runtime mapping stores.
- Ownership is derived from the authenticated CashCompass user and environment;
  browser input cannot select or override it.
- Mapping operations support list, confirm/remap, ignore/unignore, invalidate,
  and canonical ownership resolution. They validate that the connected account
  belongs to the protected user and that the target CashCompass identity is
  active, verified, and type-compatible.
- The sole administrator may run the one-time Central Trial legacy migration.
  It is idempotent, preserves the legacy source for rollback, and fails closed
  on owner, source, connection, or mapping conflicts.
- Central and bounded use the same APIs and therefore have no mapping sync lag.
  A separately allowlisted bounded signing key does not create a second owner,
  mapping namespace, connection, or product path.

#### Future approved-Apply Activity Log contract

There is no Apply writer at this checkpoint. If a later milestone separately
approves a canonical mutation from Plaid evidence, the successful mutation must
append a sanitized Activity Log entry containing the canonical entity and
field, prior value, new value, mutation timestamp, source `PLAID`, explicit
user-approval marker, provider observed time, and provider effective time when
one exists. It must never record Plaid credentials, access tokens, Item IDs,
raw account IDs, raw provider payloads, or other secret material. Refreshes,
ignored candidates, rejected candidates, failed previews, and comparison-only
mapping changes must not be logged as financial updates.

## Local and Sandbox runtime evidence — 2026-08-24

- Read-only gcloud inspection confirmed the active infrastructure administrator,
  project ID/number, enabled APIs, runtime service account, Firestore location
  and delete protection, KMS rotation/key-scoped IAM, both enabled Plaid secret
  versions with resource-scoped IAM, project-scoped datastore/logging roles, and
  the empty Artifact Registry. No secret value was retrieved.
- Backend unit suite: **24/24 PASS** using only local fakes/mocks.
- Apps Script Plaid bridge regression: **PASS**.
- Full root `npm test`: **PASS**, including every existing CashCompass suite.
- Runtime dependency audit: **0 known vulnerabilities** after locking the
  current official Google Cloud library majors.
- Syntax checks: backend source/tests, Apps Script bridge, and proof UI scripts
  parse successfully.
- `git diff --check`: **PASS**.
- Identity-HMAC secret version 1 was created and received only the exact runtime
  accessor grant. No secret value was retrieved.
- Image `p1-provision-23da558-20260824` built successfully with digest
  `sha256:ca73579f386a5dc0e4b3020e72c056510fadb60111aa934c3f20db33e2bef08a`.
- Cloud Run revision `cashcompass-plaid-backend-00004-l88` serves 100% of
  traffic. `/health` passed with a sanitized Sandbox response.
- RSA-3072 key ID `plaid-sandbox-assertion-20260824-v2` was installed through
  the sole-administrator `/dev` page. Proof is literal `false`; backend URL,
  key ID, and private-key structural presence were verified without printing
  private material. The temporary page/public handlers and all local key files
  were then deleted.
- Missing assertion, malformed signature, unknown key, wrong audience, wrong
  action, wrong environment, wrong body hash, expired assertion, and replay all
  failed closed. A locally signed first request succeeded before its replay was
  rejected, proving the installed public-key ring matches the generated pair.
- The exact `script.external_request` scope was already declared once; the
  manifest was not changed. Through the normal Apps Script editor flow, the
  sole administrator authorized only the additional ability to connect to an
  external service. Central remained on GCP Default and no other user's consent
  changed immediately.
- A temporary editor-only function, restricted to the sole administrator,
  exact Central Script ID, Central mode, and proof literal `false`, sent the
  signed runtime-status request. Apps Script completed successfully; Cloud Run
  recorded the Google Apps Script-origin POST as HTTP 200 and
  `RUNTIME_STATUS` / `SANDBOX` / `OK`. Verification and transactional nonce
  consumption occur before the service result and success log. The temporary
  function was removed from local source and Central `@HEAD`; a regression now
  rejects its return. No Link token or Item was created.
- No assertion, malformed, expired, wrong audience, wrong action, wrong
  environment, body-hash mismatch, and replay cases all failed closed. The
  first valid signed runtime-status call proved the Client ID and Sandbox
  secret readable; nonce persistence/replay rejection proved Firestore access.
- With explicit owner approval, the 100 oldest unreferenced Central versions
  were removed: versions `107`–`112` and `200`–`293`. Deployed Beta `@106` and
  the then-current isolated `@392` were preserved; 100 versions remained.
- Central source was pushed to `@HEAD`, version `393` was created, and only the
  existing isolated deployment was updated to `@393`. Beta remains `@106`, and
  bounded source/deployment was not touched.
- The manifest now exposes a deployer-only (`MYSELF`) API executable, but Central
  still uses a default GCP project. Google requires `scripts.run`, its OAuth
  client, and the script to share a standard GCP project, so the guarded
  property-provisioning call was denied. Changing Central's GCP trust domain was
  not authorized and was not attempted. Therefore the private signing key was
  not installed, the proof flag remains absent/OFF, and no Plaid Link token or
  Item was created.
- A follow-up authenticated Project Settings inspection confirmed the exact
  Central Script ID and sole-administrator session, but Google makes the Script
  Properties list read-only when the project has more than 50 properties. The
  isolated and Beta deployments share this Central Apps Script project, so
  attaching it to a standard GCP project would also change Beta's trust domain.
  That shared-project mutation was outside the isolated-only boundary and was
  not attempted. A fresh local RSA-2048 keypair was generated only in an ignored
  workspace scratch directory to validate the proposed procedure, was never
  printed or installed, and was deleted immediately after this hard stop.
- A one-real-path review confirmed that installing the four properties with the
  proof flag `false` would be inert: Beta `@106` does not contain the P1 bridge,
  and the candidate bridge checks the flag, Central mode, exact disposable
  identity, non-admin status, and allow-list membership before any
  `UrlFetchApp` call. Assertion signing and HTTPS calls do not require changing
  the Apps Script GCP association. Only remote `scripts.run` provisioning
  requires a shared standard GCP project. No separate Apps Script project or
  duplicate Plaid implementation is permitted as a workaround.
- No workbook access, Financial Facts/INPUT/Planning write, Trial call, real
  provider data, or bounded/Central Beta deployment occurred.

# 32. Sandbox Cloud Run Deployment Plan

**Status: BACKEND DEPLOYED; SIMPLE ADMIN PROVISIONING LOCALLY VALIDATED;
REAL KEY INSTALLATION AND UPDATED BACKEND DEPLOYMENT REQUIRE SEPARATE APPROVAL.**

Deployment target:

| Setting | Exact value |
| --- | --- |
| Service | `cashcompass-plaid-backend` |
| Runtime | Node.js 22 container from `services/plaid-backend/Dockerfile` |
| Project | `cashcompass-plaid-sandbox` |
| Region | `us-west1` |
| Runtime service account | `cashcompass-plaid-backend@cashcompass-plaid-sandbox.iam.gserviceaccount.com` |
| Image repository | `us-west1-docker.pkg.dev/cashcompass-plaid-sandbox/cashcompass-plaid-backend` |
| Minimum/maximum instances | `0` / `2` |
| Concurrency / timeout | `20` / `30s` |
| Memory / CPU | `512Mi` / `1` |
| Ingress | `all` because Apps Script is outside the project network |
| Cloud Run IAM | Allow network invocation; every functional route enforces the short-lived signed CashCompass assertion in application code |

Required non-secret Cloud Run configuration:

- `CASHCOMPASS_ENVIRONMENT=SANDBOX`
- `PLAID_ENVIRONMENT=SANDBOX`
- `GOOGLE_CLOUD_PROJECT=cashcompass-plaid-sandbox`
- `FIRESTORE_DATABASE=(default)`
- `KMS_CREDENTIAL_KEY=projects/cashcompass-plaid-sandbox/locations/us-west1/keyRings/cashcompass-plaid-sandbox/cryptoKeys/plaid-connection-credentials`
- `PLAID_CLIENT_ID_SECRET=plaid-sandbox-client-id`
- `PLAID_SANDBOX_SECRET=plaid-sandbox-secret`
- `PLAID_IDENTITY_HMAC_SECRET=plaid-sandbox-identity-hmac-key`
- `PLAID_PROVIDER_PROFILE=PLAID_SANDBOX_V1`
- `CASHCOMPASS_ASSERTION_ISSUER=cashcompass-central-app`
- `CASHCOMPASS_ASSERTION_AUDIENCE=cashcompass-plaid-backend`
- `CASHCOMPASS_ASSERTION_PUBLIC_KEYS_JSON=<reviewed key-ID to public-PEM map>`

The existing single `CASHCOMPASS_ASSERTION_KEY_ID` plus
`CASHCOMPASS_ASSERTION_PUBLIC_KEY_PEM` remains a compatibility input for a
one-key deployment. Rotation must use the explicit key-ring variable.

Required Central Script Properties after the service URL exists:

- `PLAID_SANDBOX_PROOF_ENABLED=false` initially;
- `PLAID_SANDBOX_BACKEND_URL=<exact run.app service URL>`;
- `PLAID_SANDBOX_ASSERTION_KEY_ID=<same reviewed key version label>`; and
- `PLAID_SANDBOX_ASSERTION_PRIVATE_KEY_PEM=<private signing key>`.

Provision these only through the temporary `/dev` administrator page while
authenticated as the sole CashCompass administrator. Keep proof OFF until the
signed handshake matrix passes. The administrator browser temporarily handles
plaintext; never paste it into chat, source, logs, a customer-facing page, Cloud
Run, or a CashCompass user workbook. Do not create a second Apps Script project,
duplicate bridge, permanent admin console, or change Central's GCP association.
After installation, verify sanitized status, remove the temporary page/handlers,
and delete local plaintext. Rotation uses the same temporary procedure with a
new immutable key ID while proof is OFF.

The assertion private key is not a Plaid credential and never reaches Cloud Run
or a customer browser. Plaid Client ID, Plaid Sandbox Secret, access tokens, raw
Item IDs, and raw account IDs remain prohibited from Script Properties.

Additional pre-deployment resource/IAM mutation requiring approval:

1. Create `plaid-sandbox-identity-hmac-key` with one enabled random secret
   version; never print or document its value.
2. Grant the runtime service account `roles/secretmanager.secretAccessor` on
   that exact new secret only.
3. Build the reviewed image and push it to the existing Artifact Registry.
4. Deploy the service with the exact runtime identity/configuration above.
5. Permit unauthenticated network invocation only because signed
   application-level authentication is mandatory for all functional routes.
6. Configure Central Script Properties, push/deploy only the separately approved
   isolated Central target, and keep the proof flag OFF until configuration is
   complete.

Build/deploy authority is separate from runtime authority. The deploying
principal needs Cloud Build submit permission, Artifact Registry upload access,
Cloud Run Admin, and `iam.serviceAccounts.actAs` on the exact runtime service
account. The Cloud Build service identity needs Artifact Registry Writer for
the exact repository plus build-log access. The runtime identity must retain
only project `roles/datastore.user` and `roles/logging.logWriter`, exact-key
KMS encrypter/decrypter, and exact-secret accessor grants. It must not receive
Owner, Editor, Secret Manager Admin, KMS Admin, or broad project-wide secret/KMS
access.

The signed transport, `/health`, assertion rejection, safe runtime-secret
booleans, and nonce consumption are proven. Do not spend more product time on a
full synthetic lifecycle. Retain Sandbox only for a smallest-necessary
automated call if a concrete implementation defect requires it.

## Trial runtime inventory — provisioned 2026-08-24

| Resource | Exact non-secret state |
| --- | --- |
| Google Cloud project | `cashcompass-plaid-trial`; name **CashCompass Plaid Trial**; immutable number `462665464202`; billing enabled; $10 alert budget at 50/90/100% |
| Runtime service account | `cashcompass-plaid-backend@cashcompass-plaid-trial.iam.gserviceaccount.com`; datastore user and log writer plus exact-resource secret/KMS grants; no Owner, Editor, Run Admin, or broad secret/KMS access |
| Firestore | `(default)` Native database in `us-west1`; delete protection enabled; environment-isolated Trial namespace |
| KMS | `projects/cashcompass-plaid-trial/locations/us-west1/keyRings/cashcompass-plaid-trial/cryptoKeys/plaid-connection-credentials`; `ENCRYPT_DECRYPT`; 90-day rotation |
| Secret Manager | `plaid-trial-client-id`, `plaid-trial-production-secret`, and `plaid-trial-identity-hmac-key`; version 1 enabled for each; values never documented or retrieved into logs |
| Artifact Registry | `us-west1-docker.pkg.dev/cashcompass-plaid-trial/cashcompass-plaid-backend`; Trial-specific repository |
| Cloud Run | Service `cashcompass-plaid-backend`, revision `cashcompass-plaid-backend-00006-lgd`, URL `https://cashcompass-plaid-backend-462665464202.us-west1.run.app`; 100% traffic, Ready/Healthy |
| Reviewed image | Tag `bofa-mortgage-preview-20260825-v1`; digest `sha256:df56c2d18a9f552238f01656d773b639c35c8f08b29e28b3578643cf36d907d3` |
| Trial signing identity | Key ID `plaid-trial-assertion-20260824-v1`; private key only in Central Script Properties; matching public key only in Cloud Run configuration |
| Isolated candidate | Central `@403`; normal app `?build=403`; two retained owner connections; visible Trial/real-data read-only warning; contextual Bank Accounts, Debts, and Investments views; no Apply/Save/Accept |
| Trial capacity | 10 total / 3 consumed / 7 remaining; two retained connections and one orphaned first-attempt Item |

Current local candidate evidence: backend **50/50 PASS**; full root `npm test`
PASS; bridge/import/provisioning, production-path, Financial Facts, and
financial identity regressions PASS; syntax and `git diff --check` PASS. The
owner validated identity-keyed deposit evidence and explicit mortgage-to-Debt
comparison on isolated `@399`. The contextual main-app candidate at `@403`
passed the focused Plaid main-app regression and the complete local test suite.
Validation performed no Financial Facts,
Planning, workbook, payment, transfer, trade, or transaction write.

## Trial readiness packet — deployed isolated runtime

| Field | Exact pre-Item state |
| --- | --- |
| CashCompass environment | `TRIAL`; explicit; no default |
| Plaid API environment | `PLAID_ENVIRONMENT=PRODUCTION` through `https://production.plaid.com`; `CASHCOMPASS_ENVIRONMENT=PRODUCTION` remains rejected |
| Products | Normal Link uses `assets` plus additionally consented `liabilities`; Update Mode omits products. Refresh always uses `/accounts/get` and calls `/liabilities/get` only when a discovered credit-card account requires it |
| Owner identity | Server-derived protected CashCompass user; first real run intended for the sole application administrator |
| Duplicate guard | One intent per user; any reusable/pending-disconnect connection blocks another normal Link; Link/public-token replay rejected; protected Item identity unique after exchange |
| Existing Trial connections | One owner-scoped retained Chase connection and one retained BofA connection; another normal Link for either institution is blocked while reusable |
| Expected capacity | One Item if and only if public-token exchange succeeds; disconnect does not restore the slot |
| Link | US, English, CashCompass client name, multi-account discovery enabled without broad transaction or investment ingestion |
| Update Mode | Existing owner credential decrypted backend-side; same Item/access token retained; no exchange |
| Disconnect | `/item/remove`, then credential deletion and sanitized tombstone; failure becomes `DISCONNECT_PENDING` |
| Deployed backend | Trial revision `cashcompass-plaid-backend-00006-lgd`; duplicate prevention, identity-keyed preview, mortgage current-balance normalization, and provider-timestamp normalization deployed |
| Apps Script target | Central `@HEAD`; Beta `@106`, isolated `@403`, and bounded unchanged |
| Product route | Normal CashCompass app at `?build=403`; connected evidence is grouped under Bank Accounts, Debts, and Investments, feature/config gated, visibly Trial/real-data, and read-only |

Trial capacity is 10 total / 3 consumed / 7 remaining. Two connections are
retained by CashCompass. The first completed Chase OAuth flow exceeded CashCompass's
former 15-minute local correlation cap; a successful retry created the retained
connection and consumed a second slot. Deleting an Item does not restore Trial
capacity. Human case submission is unavailable on this Trial account without
full Production access. Do not initiate another connection as a workaround.

## Link timeout and duplicate-prevention correction — deployed candidate

- Initial Link now honors the provider-returned expiration, bounded by the
  documented four-hour maximum. Update Mode uses its separate 30-minute maximum.
- Missing, elapsed, or invalid provider expiration fails closed without creating
  a local Link session.
- A CREATE success callback received after the true session window becomes
  `COMPLETION_REVIEW_REQUIRED`; another normal Link is blocked before a provider
  Link-token call.
- A session still marked `EXCHANGING` also blocks another normal Link, so a page
  reload or second tab cannot bypass the ambiguous-completion guard.
- The browser prevents re-entrant Connect and leaves Connect disabled after an
  ambiguous post-authorization exchange failure.
- Permanent `REG-074` backend and browser-source regressions cover the exact
  failure.
- Focused validation and the full root `npm test` suite pass locally, including
  all 50 backend tests and the Plaid import source regressions.
- The correction is deployed to Trial and isolated Central, but remains
  uncommitted and unpushed in Git. No workbook or Financial Facts write was used
  to validate it.

# 33. Current Next Action

Next product milestone:

**COMPLETE THE BOUNDED CONFIGURATION GATE, THEN OWNER-TEST THE COMMON INLINE
READ-ONLY CANDIDATE**

Provisioning, signed transport, duplicate prevention, Chase credit-card proof,
BofA multi-account deposit proof, and BofA mortgage comparison proof are
complete. Next:

1. Read this runbook.
2. Verify the existing dirty Plaid candidate and preserve all unrelated work.
3. Verify the required bounded Script Property names are present without
   retrieving or displaying their values. If absent, stop for a separately
   reviewed sole-administrator provisioning action.
4. After configuration is ready, the owner may perform the separately approved
   bounded HEAD-only push, authorize the one external-service scope in bounded
   `/dev`, and review the native inline Connected mode under Bank Accounts,
   Debts, and Investments. Do not restore a standalone Connected Accounts
   destination, iframe, or redirect.
5. Keep provider credentials and account mappings isolated per CashCompass user.
6. Preserve explicit active/verified identity selection and fail-closed
   comparison behavior.
7. Keep Apply, Financial Facts writes, Planning authority changes, broad
   transaction ingestion, payments, transfers, and trades out of scope.
8. Do not create, reconnect, disconnect, or consume another Trial Item merely to
   validate the integration shell.

# Explicit Non-Goals at This Checkpoint

Do not start:

- another Trial connection or reconnection;
- any Production connection;
- any liabilities evidence beyond the implemented credit-card and mortgage
  read-only adapters;
- Financial Facts Apply;
- Planning authority changes;
- bank-fact ingestion;
- investment connectivity or facts;
- mortgage Financial Facts writes or Planning authority changes;
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
| 2026-08-24 | P1 local Sandbox connectivity candidate | Working tree based on `23da558`; uncommitted | No cloud mutation; one protected-identity HMAC secret identified as deployment prerequisite | Node 22 backend, Central bridge, and restricted proof adapter implemented locally; no Cloud Run/Apps Script deployment | `SANDBOX`; no Item created | Approve exact Sandbox deployment plan, then prove runtime secrets and one synthetic lifecycle |
| 2026-08-24 | P1 isolated Sandbox deployment/security gate | Working tree based on `23da558`; uncommitted | Created identity-HMAC secret version 1 and exact accessor grant; built reviewed images; deployed Cloud Run; owner-approved deletion of 100 unreferenced Central versions | Revision `cashcompass-plaid-backend-00003-752`; Central source at `@HEAD`; isolated advanced to `@393`; Beta `@106` and bounded unchanged | `SANDBOX`; no Link token or Item created | Resolve the standard-GCP/API-executable property-provisioning boundary, configure signing properties, then run one synthetic lifecycle |
| 2026-08-24 | P1 safe-property-bootstrap authentication rework | Working tree based on `23da558`; uncommitted | No cloud, OAuth, property, Sheet, key, workbook, or provider mutation | Local private bootstrap/rotation contract and backend public-key ring implemented; deployed revision and Apps Script deployments unchanged | `SANDBOX`; no Link token or Item created | Review controlled bootstrap approval packet; keep Central GCP Default and application project parked |
| 2026-08-24 | P1 controlled-bootstrap live execution attempt | Working tree based on `23da558`; uncommitted | Created one local RSA-3072 keypair and one Restricted disposable Sheet, then deleted/trashed both before any key entered Drive or Script Properties; no backend or OAuth mutation | Central `@HEAD` was temporarily bound to the exact empty Sheet, then restored; Apps Script editor omitted the private trailing-underscore wrapper from its runnable-function selector; Beta `@106`, isolated `@393`, Cloud Run `00003-752`, and bounded unchanged | `SANDBOX`; no Link token or Item created | Design and locally regress an executable non-browser bootstrap seam before another controlled attempt |
| 2026-08-24 | P1 temporary administrative bootstrap wrapper | Working tree based on `23da558`; uncommitted | No key, Sheet, property, cloud, OAuth, workbook, or provider mutation | Added a local zero-argument wrapper with server-derived authorization and disabled-by-default source gates; no Apps Script or Cloud Run deployment changed | `SANDBOX`; no Link token or Item created | Review for a separately approved controlled-bootstrap retry; remove wrapper/binding immediately after that operation |
| 2026-08-24 | P1 simple administrator provisioner | Working tree based on `23da558`; uncommitted | No key, property, cloud, OAuth, workbook, or provider mutation | Replaced the obsolete Sheet/bootstrap wrapper with a temporary `/dev` page and server-authorized initial/rotation handlers; deployments unchanged | `SANDBOX`; no Link token or Item created | Review for a separately approved real-key install; remove the temporary provisioner immediately after handshake |
| 2026-08-24 | P1 signing identity provisioned; Apps Script handshake blocked | Working tree based on `23da558`; uncommitted | Deployed one reviewed public-key-ring image/revision and installed four Central Script Properties with proof OFF; no OAuth, workbook, or provider mutation | Cloud Run `00004-l88`; Central `@HEAD` cleaned of the temporary page/public handlers; Beta `@106`, isolated `@393`, and bounded unchanged | `SANDBOX`; no Link token or Item created | Separately decide the administrator `UrlFetchApp` authorization boundary, then complete the Apps Script-origin handshake before owner acceptance |
| 2026-08-24 | Signed Apps Script transport proven; real-data accuracy proof becomes next milestone | Working tree based on `23da558`; uncommitted | Sole administrator authorized the already-declared external-request capability through normal Apps Script consent; no manifest, GCP association, workbook, credential, or provider mutation | Apps Script-origin signed runtime-status reached Cloud Run `00004-l88`, returned HTTP 200 after verification/nonce consumption; temporary handshake function removed from Central `@HEAD`; Beta `@106`, isolated `@393`, and bounded unchanged | `SANDBOX` transport proof only; no Link token or Item created | Implement/review the `liabilities`-only Trial vertical slice and read-only Chase comparison, then request separate approval for the first real Item |
| 2026-08-24 | Trial-readiness liabilities preview implemented locally | Working tree based on `23da558`; uncommitted | No cloud, credential, property, workbook, provider, or Item mutation | Explicit Sandbox/Trial config, Item conservation, Update Mode, `/liabilities/get` adapter, and read-only normal-user preview are local only; deployed revision, Beta `@106`, isolated `@393`, and bounded unchanged | No provider call; no Trial Item created | Review/commit separately, then authorize isolated Trial configuration and deployment before any Item approval |
| 2026-08-24 | Trial runtime provisioned and isolated preview validated | Working tree based on `23da558`; uncommitted | Created dedicated Trial project `cashcompass-plaid-trial` (`462665464202`), budget, minimum APIs, runtime identity/IAM, Firestore, KMS, three secret resources, Artifact Registry, Cloud Run, and separate Trial signing identity | Trial revision `cashcompass-plaid-backend-00002-pj9`; isolated Central `@396`; Beta `@106`; bounded unchanged; temporary provisioner removed | `TRIAL` runtime uses Plaid Production API; capacity 10/0/10; zero Items and owner state `NONE` | Separately approve and perform the first real Chase connection; keep preview read-only and do not implement Apply |
| 2026-08-25 | First Chase connection and local Link-timeout correction | Working tree based on `23da558`; uncommitted | No infrastructure added by the correction; one retained Trial connection and one orphaned first-attempt Item exist from the owner flow | Deployed Trial remains `00003-wqc` and isolated Central remains `@396`; timeout/duplicate-prevention correction is local only; Beta `@106` and bounded unchanged | `TRIAL`; capacity 10/2/8 | Review local validation, then request separate deployment approval; do not create/reconnect/refresh/disconnect another Item |
| 2026-08-25 | BofA one-Item multi-account value proof | Working tree based on `23da558`; uncommitted | No new infrastructure; one owner-approved BofA Item added after deploying duplicate prevention | Trial revision `00004-9fn`; isolated Central `@398`; Beta `@106`; bounded unchanged | `TRIAL`; one BofA connection exposed fourteen accounts; capacity 10/3/7 | Preserve both retained connections; correct mortgage comparison without creating another Item |
| 2026-08-25 | BofA mortgage read-only comparison proof | Working tree based on `23da558`; uncommitted | No new cloud resource or Item; deployed a reviewed backend image and advanced only the existing isolated deployment | Trial revision `00005-tqj`; isolated Central `@399`; Beta `@106`; bounded unchanged | `TRIAL`; capacity remains 10/3/7 | Design the main-app Connected Accounts integration; keep Apply and Planning authority out of scope |
| 2026-08-25 | Contextual main-app connected-account candidate, Bank panel correction, and async mode preservation | Working tree based on `23da558`; uncommitted | No new cloud resource, Item, workbook write, or authority change; advanced the existing backend and isolated deployments only | Trial revision `00006-lgd`; isolated Central `@403`; Beta `@106`; bounded unchanged | `TRIAL`; retained Items unchanged and capacity remains 10/3/7 | Owner-review that Bank Accounts, Debts, and Investments stay in Connected on the first click while background reads finish; keep Apply and Planning authority out of scope |
| 2026-08-25 | One-product Central/bounded inline convergence candidate | Working tree based on `23da558`; uncommitted | Added the bounded external-request scope exactly once and one shared native inline bridge/UI; removed separate-page, redirect, and iframe workarounds; added server-derived bounded authority, generic panel failure isolation, and permanent regressions; no clasp, deployment, property, workbook, provider, or Item mutation | Local source only; Trial revision remains `00006-lgd`, isolated Central `@403`, Beta `@106`, and bounded `/exec` unchanged | `TRIAL`; retained Chase/BofA Items and 10/3/7 capacity unchanged | Verify/provision the minimum bounded Script Properties separately, then owner-push bounded HEAD and authorize/test through bounded `/dev` |

Every later milestone must record its date, milestone, Git commit,
infrastructure resources created/changed, deployment state, provider
environment, and next step without including secret values.
