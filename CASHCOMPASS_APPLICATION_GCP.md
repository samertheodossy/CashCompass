# CashCompass Application Google Cloud Runbook

**Status:** **PREPARED BUT UNATTACHED / PARKED.** The permanent standard Google
Cloud project exists, but Central Apps Script remains a protected compatibility
boundary on its Apps Script-managed default project.

**Last verified:** 2026-08-24.

This is the tool-neutral source of truth for the Google Cloud control plane of
the existing CashCompass Central application. It is usable by a human engineer
or any coding agent. It contains resource identities and operating procedure,
never credential values.

## 1. Permanent purpose and boundary

The existing product follows one application path. The parked project is not
currently in that runtime path:

```text
CashCompass Central Apps Script
→ Apps Script-managed default Google Cloud project (unchanged)
```

`cashcompass-application` is permanent, provider-neutral, environment-neutral,
and parked. It is not a second CashCompass application or a Plaid environment.
Do not attach Central merely to enable Plaid P1. Do not continue OAuth setup,
delete the project, or repurpose it as Plaid Sandbox infrastructure without a
new owner-approved task.

Potential future uses, each requiring separate justification and approval, are
OAuth verification, application-level logging, or another Google integration
that cannot safely use the existing default-project boundary.

Provider infrastructure stays separate:

```text
CashCompass Application GCP project: cashcompass-application
Plaid Sandbox provider project:     cashcompass-plaid-sandbox
Future Plaid Trial project:         separate and not provisioned
Future Plaid Production project:    separate and not provisioned
```

Never associate Central directly with `cashcompass-plaid-sandbox`. Never store
Plaid access tokens, Item identifiers, provider credentials, or connection
records in `cashcompass-application` merely because it hosts the application
control plane.

## 2. Resource identity

| Field | Verified value |
| --- | --- |
| Project name | `CashCompass Application` |
| Project ID | `cashcompass-application` |
| Project number | `498289193120` |
| Lifecycle state | `ACTIVE` |
| Billing | **NOT LINKED / NOT REQUIRED YET** |
| Central association | **GCP Default — NOT CHANGED** |

The preferred global ID `cashcompass-app` was unavailable. The only approved
fallback, `cashcompass-application`, was created.

## 3. Human ownership and trust domains

Google Cloud IAM does not grant CashCompass application-admin authority.

### Sole CashCompass application administrator

`samertheodossy@gmail.com`

| Role | Purpose |
| --- | --- |
| `roles/browser` | Locate and associate the standard project |
| `roles/oauthconfig.editor` | Configure OAuth branding, audience, clients, and verification |
| `roles/serviceusage.serviceUsageViewer` | Inspect enabled APIs without changing them |
| `roles/logging.viewer` | Read application logs after association |
| `roles/errorreporting.viewer` | Read application error reports after association |

This identity remains the sole CashCompass administrator. Never change
`ADMIN_EMAILS` or its fallback to elevate another account.

### Infrastructure administrator

`cashcompass2026@gmail.com`

| Role | Purpose |
| --- | --- |
| `roles/owner` | Bootstrap owner retained until replacement/recovery is independently proven |
| `roles/resourcemanager.projectIamAdmin` | Manage reviewed project IAM |
| `roles/serviceusage.serviceUsageAdmin` | Enable reviewed APIs |
| `roles/oauthconfig.editor` | Infrastructure recovery for OAuth configuration |
| `roles/billing.projectManager` | Link/unlink billing only after separate approval |
| `roles/browser` | Locate the project |

This identity remains a non-admin CashCompass test/infrastructure identity.
Project ownership, OAuth editing, or provider administration never makes it a
CashCompass application administrator.

Do not remove bootstrap Owner until both replacement IAM and a recovery path
have been verified in a separately reviewed task.

## 4. Billing state

Billing is not linked. Apps Script association, OAuth configuration, Apps Script
API, and Drive API preparation did not require it.

If a future application service proves billing is required:

1. stop and identify the concrete service;
2. obtain separate approval to link the existing CashCompass billing account;
3. create a project-specific budget alert distinct from Plaid Sandbox; and
4. record the linkage and alert without fabricating expected cost.

Do not create a budget while billing remains unlinked.

## 5. Enabled APIs

The only task-directed application APIs enabled during Phase A were:

| API | Reason |
| --- | --- |
| `script.googleapis.com` | API executable and `scripts.run` administration |
| `drive.googleapis.com` | Existing Drive v3 advanced service and user-owned workbook lifecycle |

Google automatically enabled its normal new-project service bundle during
project creation. The verified enabled-service inventory was:

- `analyticshub.googleapis.com`
- `bigquery.googleapis.com`
- `bigqueryconnection.googleapis.com`
- `bigquerydatapolicy.googleapis.com`
- `bigquerydatatransfer.googleapis.com`
- `bigquerymigration.googleapis.com`
- `bigqueryreservation.googleapis.com`
- `bigquerystorage.googleapis.com`
- `cloudapis.googleapis.com`
- `cloudtrace.googleapis.com`
- `dataform.googleapis.com`
- `dataplex.googleapis.com`
- `datastore.googleapis.com`
- `drive.googleapis.com`
- `logging.googleapis.com`
- `monitoring.googleapis.com`
- `script.googleapis.com`
- `servicemanagement.googleapis.com`
- `serviceusage.googleapis.com`
- `sql-component.googleapis.com`
- `storage-api.googleapis.com`
- `storage-component.googleapis.com`
- `storage.googleapis.com`
- `telemetry.googleapis.com`

No Cloud Run, Secret Manager, KMS, Firestore, or provider API was explicitly
enabled for this application project. Do not broadly disable Google's default
services as part of the migration; review any cleanup separately.

## 6. OAuth architecture and current parked state

The following historical target was prepared before the owner selected the
Central-unchanged P1 provisioning path. It is not an active implementation plan:

| Field | Target |
| --- | --- |
| App name | `CashCompass` |
| Audience | `External` |
| User support email | `samertheodossy@gmail.com` |
| Developer contacts | `samertheodossy@gmail.com`, `cashcompass2026@gmail.com` |
| Owner publishing state before reassociation | `In Production` |

Current state: **Google Auth Platform is not configured and must remain
unconfigured unless a new owner approval explicitly resumes this work.** The initial wizard
was inspected but not submitted because its final step requires explicit
agreement to the Google API Services User Data Policy. No agent may accept that
policy on behalf of the owner without explicit authorization.

The initial wizard does not require homepage, privacy-policy, or authorized-
domain values. Those become production/verification gates. Before setting In
Production or seeking verification, CashCompass must have:

- a publicly accessible CashCompass homepage on a verified domain the owner
  controls;
- an accurate description of application functionality and Google-data use;
- a privacy policy on the same verified domain, linked from the homepage and
  the OAuth branding configuration;
- authorized-domain ownership verified through Google Search Console;
- a Terms of Service link if adopted; and
- reviewed sensitive-scope explanations and verification evidence.

Do not invent URLs or publish placeholder policy pages. Testing mode is not a
permanent-owner solution because test authorizations expire after seven days.
Before verification, external users may see an unverified-app warning and the
project is subject to Google's unverified new-user cap.

## 7. Current Apps Script OAuth scopes

Migration must reproduce these seven explicit scopes without adding or removing
any scope:

1. `https://www.googleapis.com/auth/spreadsheets`
2. `https://www.googleapis.com/auth/drive.file`
3. `https://www.googleapis.com/auth/userinfo.email`
4. `https://www.googleapis.com/auth/script.external_request`
5. `https://www.googleapis.com/auth/script.send_mail`
6. `https://www.googleapis.com/auth/script.scriptapp`
7. `https://www.googleapis.com/auth/script.container.ui`

The Google Auth Platform Data Access screen is the authority for the sensitive
or restricted classification presented by Google. Do not change scopes during
the GCP association migration.

## 8. Parked desktop-administration design

The following path was designed for a future standard-project association, but
is not required for Plaid P1 and must not be activated now:

```text
samertheodossy@gmail.com
→ private desktop OAuth client
→ Apps Script API
→ scripts.run
→ narrowly guarded server-side administrative function
```

Local credentials belong under repository-local `.cashcompass-admin/`, which is
excluded by both `.gitignore` and `.claspignore`.

- directory mode: `0700`;
- credential/token file mode: `0600`;
- never commit, print, log, or push credential contents;
- never place credentials in `/private/tmp` as the durable operating path;
- never use a browser/customer route for administrative payloads; and
- never create a generic arbitrary-property administration function.

No credential directory, OAuth client, client secret, or token exists yet. Do
not create them for Plaid P1. Creation requires a later, independently approved
Google-application administration task.

Every remote administrative function must enforce `isAdminUser_()` and Central
mode internally, ignore caller-supplied identity, avoid logging payloads, and
return sanitized status only.

## 9. Immutable Central migration inventory

| Surface | Deployment ID | Version / state | URL |
| --- | --- | --- | --- |
| Central Script | `153TEsXfVu4fwwToMj1-CvdOScj_vNJKBLTgSTejHZSTOUI89xHzgHt4_` | GCP Default | [Project Settings](https://script.google.com/home/projects/153TEsXfVu4fwwToMj1-CvdOScj_vNJKBLTgSTejHZSTOUI89xHzgHt4_/settings) |
| HEAD/API-executable path | `AKfycbx7VzD91bNo4bNRPLi_pOqK1VAR34Yr3pdlj4rnNeFz` | `@HEAD` | Deployment resource; no customer URL retained |
| Isolated validation | `AKfycbzMaD3Ur0H3VmatL4W2vVHlYhFOXF4cZSSjIcn3SwggbTCs9Q9F1_PH74F16lAFkUlWZQ` | `@393` | <https://script.google.com/macros/s/AKfycbzMaD3Ur0H3VmatL4W2vVHlYhFOXF4cZSSjIcn3SwggbTCs9Q9F1_PH74F16lAFkUlWZQ/exec> |
| Central Beta | `AKfycbyq_OGiupdGO79GMOImkIgYv19hqlN1JuJfieuDlkXH6Rp637MhZc6jz9uRW2ZxANBlPA` | `@106` | <https://script.google.com/macros/s/AKfycbyq_OGiupdGO79GMOImkIgYv19hqlN1JuJfieuDlkXH6Rp637MhZc6jz9uRW2ZxANBlPA/exec> |

Read-only bounded inventory captured 2026-08-24:

| Deployment ID | Version |
| --- | --- |
| `AKfycbypqusrnr15I0W0w_lCkk6GLhjvIes2rSYUo-4f-w9B` | `@HEAD` |
| `AKfycbyRIAxEOhRFdbgYzD8GQ6PJQ1tpK9NyzKOmxXVk41s4AZj5pkn_MzuZJ1Ac0FLSORx6dQ` | `@636` |
| `AKfycbyE6a9YEG5GGl-vMlukVrzyhuTGpoJN8J09Uy5eSvkb5aQ4d74yOOZWIKEuiE6MFQ3DgQ` | `@637` |
| `AKfycbxGXTsTks4AAaqCcAYAjD25cHNgOF2y-5ryNsFd5x06QPc1LS1Kz3ttWtwfQ6_aQ2Va` | `@638` |
| `AKfycbweu1LDjYaXA5zKPTRl6TEapA8271kfPQOQUfsUHyBW3s10xA8Fqta73lP2NBzW0jbqxw` | `@639` |

This capture is read-only evidence, not authorization to identify or retire a
bounded production singleton.

## 10. Historical reassociation procedure — inactive and separately approved only

The owner has decided that Plaid P1 will not use this procedure. Do not execute
it without a new explicit approval based on a future non-Plaid requirement.

1. Re-verify repository, current association, IAM, billing, APIs, OAuth state,
   scope inventory, Script ID, and every deployment ID/URL.
2. Confirm OAuth is External and In Production, with required public assets and
   policy acceptance complete.
3. Confirm the desktop OAuth client exists and its files are private/ignored.
4. Record a clean Git state or the exact reviewed candidate.
5. In Central Apps Script Project Settings, choose **Change project**.
6. Enter standard project number `498289193120` and set the project.
7. Do not update any deployment merely because association changed.
8. Confirm Script ID and deployment inventory are unchanged.
9. Reauthorize first as `samertheodossy@gmail.com`.
10. Open isolated validation first and perform a read-only smoke test.
11. Verify no workbook was provisioned or modified by the migration itself.
12. Verify the normal non-admin path separately.
13. Verify Central Beta remains `@106` only after isolated validation passes.
14. Keep bounded completely untouched.

## 11. Irreversibility and rollback reality

After moving from the Apps Script-managed default project, Central cannot be
switched back to that original default project. Google deletes the default
project and its project-tied settings. All previously authorized Central users
must reauthorize.

Reversible:

- OAuth configuration errors;
- API enablement;
- desktop client configuration;
- billing linkage;
- code versions and deployment pointers; and
- switching later to another standard project, with another reauthorization.

Not trivially reversible:

- the original default-project association;
- old OAuth grants; and
- a reauthorization-free migration.

Never use deployment rollback as a substitute for a failed GCP association
plan. Deployment version rollback does not restore the old OAuth trust domain.

## 12. Historical pre-association checklist — parked

- [x] Permanent project exists; ID/name/number recorded.
- [x] Human IAM grants verified; bootstrap Owner retained.
- [x] Apps Script API enabled.
- [x] Drive API enabled.
- [x] Billing unlinked because it is not required yet.
- [ ] Owner explicitly accepts the Google API Services User Data Policy.
- [ ] OAuth External configuration created.
- [ ] Public homepage/privacy policy and verified domain ready.
- [ ] OAuth switched to In Production before owner reassociation.
- [ ] Seven exact scopes reviewed in Google Auth Platform Data Access.
- [ ] Desktop OAuth client created and stored privately.
- [x] Local credential exclusions installed.
- [x] Central Script and deployment inventory captured.
- [x] Bounded inventory captured read-only.
- [x] Isolated registry corrected to `@393`.
- [x] Git baseline and exact P1 candidate captured.
- [ ] Owner accepts the one-time reauthorization impact.
- [ ] Final recovery and isolated-first validation packet reviewed.
- [x] Plaid signing properties are installed and proof remains OFF; this parked
  project was not attached or used for provisioning.

Unchecked items are intentionally parked, not current P1 blockers. Central
reassociation remains prohibited unless the owner opens a new migration task.

## 13. Historical post-association validation

Pass criteria only if a future, separately approved reassociation task is ever
reopened:

1. Central Project Settings shows project number `498289193120`.
2. Central Script ID is unchanged.
3. HEAD, isolated `@393`, and Beta `@106` deployment IDs remain unchanged.
4. Owner authorization succeeds using the exact seven scopes.
5. Isolated read-only dashboard/identity smoke passes.
6. No unexpected workbook creation, write, or modified timestamp occurs.
7. Non-admin allowlist behavior remains fail-closed and isolated per user.
8. Beta opens only after isolated passes and remains `@106`.
9. Bounded inventory and workbook state remain unchanged.
10. No Plaid property is installed until a later explicit gate.

## 14. Plaid administration relationship

Plaid P1 does not require association with this project. The accepted path keeps
Central on GCP Default and provisions the four reviewed Sandbox properties with
proof OFF through the temporary administrator-only `/dev` procedure defined in
`PLAID_CONNECTIVITY.md`. Future rotation requires exact expected-current values
and never exposes a generic property setter.

Provider secrets and user connection material stay in provider-environment
projects. See `PLAID_CONNECTIVITY.md` for the Sandbox backend and lifecycle.

## 15. Canonical links

| Surface | Link |
| --- | --- |
| Project dashboard | <https://console.cloud.google.com/home/dashboard?project=cashcompass-application> |
| IAM | <https://console.cloud.google.com/iam-admin/iam?project=cashcompass-application> |
| Enabled APIs | <https://console.cloud.google.com/apis/dashboard?project=cashcompass-application> |
| Google Auth overview | <https://console.cloud.google.com/auth/overview?project=cashcompass-application> |
| OAuth branding | <https://console.cloud.google.com/auth/branding?project=cashcompass-application> |
| OAuth audience | <https://console.cloud.google.com/auth/audience?project=cashcompass-application> |
| OAuth clients | <https://console.cloud.google.com/auth/clients?project=cashcompass-application> |
| OAuth data access | <https://console.cloud.google.com/auth/scopes?project=cashcompass-application> |
| OAuth verification | <https://console.cloud.google.com/auth/verification?project=cashcompass-application> |
| Logs Explorer | <https://console.cloud.google.com/logs/query?project=cashcompass-application> |
| Error Reporting | <https://console.cloud.google.com/errors?project=cashcompass-application> |

## 16. Safe command catalog

Read-only orientation:

```sh
gcloud auth list
gcloud projects describe cashcompass-application
gcloud billing projects describe cashcompass-application
gcloud services list --enabled --project=cashcompass-application
gcloud projects get-iam-policy cashcompass-application
clasp deployments --project .clasp-central.json
clasp deployments --project .clasp.json
git status --short --branch
git diff --check
```

Mutating commands requiring an explicit task authorization:

```sh
gcloud services enable SERVICE --project=cashcompass-application
gcloud projects add-iam-policy-binding cashcompass-application ...
gcloud billing projects link cashcompass-application ...
```

Changing the Apps Script GCP project, creating OAuth clients, accepting Google
policies, publishing OAuth, changing deployment versions, or installing Script
Properties are separate mutations and require their corresponding approval.

## 17. Troubleshooting

| Symptom | Safe response |
| --- | --- |
| `scripts.run` reports project mismatch | Verify Central and desktop client share project number `498289193120`; do not create another Script project |
| Drive advanced service fails after association | Verify `drive.googleapis.com` is enabled and the exact manifest scope remains present |
| Owner sees authorization required | Expected once after association; confirm app identity/scopes before consenting |
| User sees unverified warning | Do not bypass as a release strategy; complete branding/domain/privacy/scope verification |
| Testing authorization expires | Move through the reviewed In Production gate before permanent owner use |
| Deployment URL missing | Stop; compare Script ID and captured deployment inventory before changing anything |
| Plaid properties already exist unexpectedly | Keep proof OFF and stop; do not overwrite or expose values |
| Billing prompt appears | Stop and identify the concrete billable prerequisite before linking billing |

## 18. Next step

Keep this project **PREPARED BUT UNATTACHED / PARKED** while Plaid P1 proceeds
through the Central-unchanged administrator-provisioning path. Do not continue OAuth preparation,
create a desktop client, attach Central, link billing, or delete the project.
Any future use must start with a new purpose/risk review and explicit approval.

## 19. Change log

| Date | Change | Safety boundary |
| --- | --- | --- |
| 2026-08-24 | Created permanent project `cashcompass-application`; retained bootstrap Owner; applied reviewed IAM; enabled Apps Script and Drive APIs; left billing unlinked; prepared local credential exclusions; captured Central/bounded inventory | Central remained GCP Default; no OAuth config/client, reauthorization, deployment, workbook, Plaid property, Trial, or Production change |
| 2026-08-24 | Parked the prepared project after selecting the Plaid P1 safe-property-bootstrap architecture | No deletion, association, OAuth continuation, billing, IAM, deployment, or runtime change; Central remains GCP Default |
| 2026-08-24 | Superseded the Sheet bootstrap with simple temporary administrator provisioning | No application-project, OAuth, billing, IAM, deployment, property, or runtime change; project remains parked and Central remains GCP Default |
