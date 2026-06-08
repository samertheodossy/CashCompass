# CENTRAL_APP_WORKBOOK_DIAGNOSTICS_PLAN.md

Design plan for **Phase 2A — Workbook Diagnostics**: read-only detection and
classification of Central App per-user workbooks, plus the admin audit surface
that reports duplicate / orphan / stale states. This is the diagnostic
foundation that a later **Phase 2B** recovery slice will build on.

**Documentation / design only.** No Apps Script change, no HTML change, no
`appsscript.json` change, no deployment change, no implementation. Nothing here
writes to Drive, to mappings, or to any user workbook. Each implementation slice
described below requires its own explicit Cursor prompt with user approval per
`CENTRAL_APP_IMPLEMENTATION_PLAN.md → §9`.

Cross-references:
- `PROJECT_CONTEXT.md` — live product state (Central App is live; family-beta ready).
- `TODO.md` — Launch Readiness Roadmap (this work is Phase 2 — Family Beta Hardening).
- `central_provisioning.js` — the live provisioning/mapping logic this design composes with.
- `central_resolver.js` — the resolver seam (`getUserSpreadsheet_()`).
- `appsscript.json` — manifest; source of the `drive.file` scope constraint (§3).
- `CENTRAL_APP_WORKBOOK_CREATION_FIRST_SLICE_PLAN.md` — the provisioning slice that shipped.

Status: **active design** for Phase 2A. The investigation that produced it is
summarized in §1–§3; the design proper is §4–§9; §10 records the deferred
Phase 2B recovery scope so it is not silently dropped.

---

## 1. Problem statement

Central App provisions exactly **one user-owned workbook per allow-listed user**,
keyed by `mapping::<sha256(email)>` in the central project's script properties.
During Central testing, a beta user accumulated **multiple Drive files named
`CashCompass — <email>`**.

The mapping — not Drive — is the only thing provisioning consults to decide
whether a user already has a workbook. As a result, whenever the mapping is
absent (cleared, lost, or not carried across the two-project migration) while a
workbook still exists in Drive, the next sign-in mints a **sibling** workbook and
the previous one becomes an unreferenced **orphan**.

Phase 2A does **not** fix or delete anything. Its goal is to make the real state
observable and classifiable so that:
- duplicates/orphans are **reported, never destroyed**;
- a later phase can make safe, explicit, admin-driven repair decisions on solid
  evidence rather than guessing.

Preferred direction (carried from the investigation): detection first; no
auto-delete; any repair or auto-adopt is a later, explicitly-gated slice.

---

## 2. Current lifecycle

Resolver seam (`central_resolver.js`): `getUserSpreadsheet_()` returns
`SpreadsheetApp.getActiveSpreadsheet()` in bound mode; in central mode it routes
to `getOrProvisionUserSpreadsheet_()`.

Central path (`central_provisioning.js`):

1. Resolve email via `Session.getEffectiveUser()` (lowercased). Empty ⇒ throw.
2. `lookupSpreadsheetIdForUser_(email)` reads `mapping::<sha256(email)>`.
   - **Mapping present:** `SpreadsheetApp.openById` → `cleanupDefaultSheet1_` →
     return. If open fails → `handleStaleMapping_` throws `StaleMappingError`
     (**no auto-reprovision**).
   - **Mapping absent:** `provisionWorkbookForUser_(email)`.
3. `provisionWorkbookForUser_`:
   1. `LockService.getUserLock().tryLock(30000)`; failure ⇒ throw (no file made).
   2. **Double-check** the mapping inside the lock; if present now, open & return.
   3. `Drive.Files.create({ name: 'CashCompass — <email>', mimeType: spreadsheet })`.
   4. `openById` → `runMinimalBootstrap_` (`ensureInputSettingsSheet_` +
      `cleanupDefaultSheet1_`) → `writeSpreadsheetIdForUser_`.
   5. Any failure **before** the mapping write → `trashFileQuietly_(fileId)`
      (soft delete) then throw.

Key property: a file becomes "the real one" only when the mapping write (the last
step) points at it. The `LockService` user lock + in-lock double-check already
prevent same-user concurrent provisioning from duplicating. What is **not**
guarded is the cross-session/over-time case where the mapping later disappears
while the file persists, and provisioning never asks Drive "do I already have a
workbook?" before creating.

---

## 3. `drive.file` limitations (decisive constraint)

The manifest grants `https://www.googleapis.com/auth/drive.file`, **not** full
`drive`. `drive.file` exposes only files **this app created or the user opened
with this app**. Implications for diagnostics:

- **Detectable:** workbooks **this project** provisioned (the app created them),
  so `Drive.Files.list` can enumerate app-made duplicates with no new scope.
- **Invisible:** (a) same-named files the user created by hand, and (b) files
  created by a **different Apps Script project**. Because the Central App was
  split into a **separate project**, any workbook made by the *old* project is
  not visible to the *new* project under `drive.file`.

Therefore every diagnostic output must label its coverage as
**`app_visible_only`** and must never claim completeness. Broadening to the full
`drive` scope would close the gap but breaks the minimal-scope privacy posture
and is **out of scope** without explicit product sign-off.

---

## 4. Marker strategy

Tag each provisioned workbook with Drive **file-level `appProperties`**
(app-private, invisible to other apps, survive renames — the right fit for
`drive.file`). Raw email is never stored; only its hash, identical to the mapping
hash so the two stores cross-check.

| Key | Example value | Purpose |
|---|---|---|
| `cashcompass_role` | `user_workbook` | Marks a CashCompass-provisioned per-user workbook. Constant. |
| `cashcompass_email_hash` | `8d2f…0a3b` (64-hex) | `sha256(lowercase email)` — links file ↔ user without raw email. Equals the `buildMappingKey_` hash minus the `mapping::` prefix. |
| `cashcompass_schema` | `1` | Marker schema version; lets later slices evolve the marker safely. |
| `cashcompass_project` | `central` | Which project created it (`central` vs `bound`). Disambiguates the two-project history. |
| `cashcompass_provisioned_at` | `2026-06-08T13:20:00Z` | ISO create time; age/tie-breaker signal for ambiguity diagnostics. Optional. |

Notes:
- The marker is **written only by later slices** (create-path stamp in 2A.1;
  lazy backfill in 2A.2). **Phase 2A reads the marker if present and falls back
  to name matching if absent**, so diagnostics ship with **zero writes**.
- Pure helper (design): `buildWorkbookAppProperties_(email)` returns the object
  above. Defined now for reuse by later slices; **not invoked** in Phase 2A.

---

## 5. Candidate detection (read-only)

Two-key strategy: marker first (durable), name fallback (legacy/unmarked). Both
constrained to the caller's own, app-visible, non-trashed spreadsheets.

Drive v3 queries (`fields:
files(id,name,owners(emailAddress),createdTime,modifiedTime,trashed,appProperties)`):

- **Marker path:**
  `mimeType='application/vnd.google-apps.spreadsheet' and trashed=false and 'me' in owners and appProperties has { key='cashcompass_email_hash' and value='<hash>' }`
- **Name fallback (unmarked legacy files):**
  `mimeType='application/vnd.google-apps.spreadsheet' and trashed=false and 'me' in owners and name='<buildWorkbookName_(email)>'`

Functions (design):
- `findCandidateWorkbooks_(email)` → `{ byMarker:[Candidate], byName:[Candidate], merged:[Candidate] }`.
- `normalizeDriveFile_(file, email)` → `Candidate` (pure).

`Candidate` descriptor:

```
{
  id, name,
  ownerEmail,            // owners[0].emailAddress (app-visible)
  ownedByCaller,         // ownerEmail === email
  createdTime, modifiedTime,
  hasMarker,             // cashcompass_email_hash present
  markerHashMatches,     // === sha256(email)
  markerProject,         // appProperties.cashcompass_project | null
  nameMatches,           // name === buildWorkbookName_(email)
  matchedBy              // 'marker' | 'name' | 'both'
}
```

`merged` = union of `byMarker` + `byName` deduped on `id`, sorted by
`createdTime` ascending (oldest first — relevant for "which is the original").

---

## 6. Classification model (read-only)

`classifyUserWorkbooks_(email)` composes the mapping (source of truth) with the
candidate set.

Primary status enum (`status` = highest-severity applicable):

| Status | Condition | Severity |
|---|---|---|
| `OK` | mapping set → opens, not trashed, owned by caller; ≤1 candidate (the active one). | ok |
| `NO_WORKBOOK` | no mapping and no candidates. | info |
| `UNMAPPED_SINGLE` | no mapping, exactly 1 strict candidate (adopt territory — flagged, not acted on). | warn |
| `UNMAPPED_MULTIPLE` | no mapping, ≥2 candidates (ambiguous). | action_needed |
| `STALE_MAPPING` | mapping set but target won't open / trashed / missing. | action_needed |
| `ORPHANS_PRESENT` | mapping healthy **and** ≥1 extra candidate beyond the active one. | warn |
| `NAME_MISMATCH` | mapping opens & owned by caller but `name !== buildWorkbookName_(email)` (cosmetic). | info |
| `NOT_OWNED` | mapped file opens but owner ≠ caller. | action_needed |

Secondary observations go in `flags[]` (e.g., an `OK` active file may also carry
`flags: ['NAME_MISMATCH']`).

`ClassificationReport` shape:

```
{
  emailHash,             // never raw email in the persisted/logged object
  status,                // enum above
  severity,              // 'ok' | 'info' | 'warn' | 'action_needed'
  flags: [],
  mapping: { present, id, opened, trashed, ownedByCaller, nameMatches } | null,
  active: Candidate | null,
  candidates: [Candidate],
  orphans: [Candidate],   // candidates ≠ active
  coverage: 'app_visible_only',
  generatedAt
}
```

Safe definitions used by the model:
- **Active** = file whose id == mapping value, opens via `openById`, not trashed,
  owned by caller. Exactly one per user. The mapping is authoritative — *not* the
  Drive name.
- **Stale mapped** = mapping present but its target won't open / is trashed / missing.
- **Candidate** = any app-visible spreadsheet matching the user's signature
  (marker hash, or exact name), owned by caller, not trashed.
- **Orphan** = candidate that is not the active file and not referenced by any mapping.
- **Duplicate** = the *set condition* where ≥2 candidates exist for one user
  (active + ≥1 orphan, or ≥2 orphans with no mapping).

---

## 7. Admin audit functions (read-only, editor-run, not web-exposed)

- `adminAuditUserWorkbook(email)` — one user → logs + returns `ClassificationReport`.
- `adminAuditAllAllowlisted()` — iterate `FAMILY_BETA_ALLOWLIST` (recompute each
  hash locally), run the above per user, emit a rollup + per-user reports.
- `adminDumpUserCandidates(email)` — raw Drive query dump (ids, `appProperties`,
  timestamps) for debugging.
- `adminDiagnosticsSelfTest()` — confirms the Drive service is reachable, the
  scope is present, and the allow-list is non-empty.

Constraints: **no web surface, no new scope, no writes.** Run from the Apps
Script editor; output via `Logger`/`console`. None call create / trash / update /
`clearMappingForUser_`.

Expected output — object return is the `ClassificationReport` (single user) or, for
the all-allowlisted run:

```
{
  generatedAt,
  coverage: 'app_visible_only',
  totals: { OK, NO_WORKBOOK, UNMAPPED_SINGLE, UNMAPPED_MULTIPLE,
            STALE_MAPPING, ORPHANS_PRESENT, NAME_MISMATCH, NOT_OWNED },
  reports: [ClassificationReport, ...]
}
```

Human-readable Logger table the admin actually reads:

```
CashCompass Workbook Audit — 2026-06-08T13:20Z  (coverage: app-visible only)
EMAIL                         STATUS              SEV            ACTIVE_ID      #CAND  NOTES
----------------------------- ------------------- -------------- -------------- ----- ----------------------
alice@example.com             OK                  ok             1AbC…             1
bob@example.com               ORPHANS_PRESENT     warn           1XyZ…             3   2 orphans (older)
carol@example.com             UNMAPPED_MULTIPLE   action_needed  —                 2   adopt blocked: ambiguous
dave@example.com              STALE_MAPPING       action_needed  (1QrS… trashed)   0   mapping target gone
----------------------------- ------------------- -------------- -------------- ----- ----------------------
Totals: OK 1 | ORPHANS 1 | UNMAPPED_MULTIPLE 1 | STALE 1     (allowlisted: 4)
```

Output rules: truncate IDs in the table (full IDs only in the object /
`adminDumpUserCandidates`); never store raw email in the persisted object (the
ephemeral editor log may show email for the operator).

---

## 8. Migration strategy for existing workbooks

Phase 2A needs **no migration to function**:

1. **Now (2A.0): name-fallback only.** Unmarked legacy workbooks are found via
   `name = buildWorkbookName_(email)`. Zero writes; works on current beta data.
2. **2A.1 (later, create-path slice): self-marking.** New provisions stamp
   `appProperties` at `Drive.Files.create`. No backfill needed for new users.
3. **2A.2 (later, opportunistic backfill):** when `getOrProvisionUserSpreadsheet_`
   successfully opens a mapped workbook lacking a marker, stamp it then (one
   metadata `Drive.Files.update`, allowed under `drive.file` because the app
   opened the file). Self-healing, no bulk job. **Deferred — it is a write.**
4. **Cross-project legacy files:** workbooks created by the *old* project are
   invisible to the new project under `drive.file`; they cannot be marked or
   detected from the new project. Reconciling those is a separate manual/admin
   track (run diagnostics from the old project, or accept the blind spot) and is
   **out of scope**; every report flags `coverage: app_visible_only`.

Net: name-fallback covers 2A.0; markers accrue passively in later slices; no
migration job is required to start auditing.

---

## 9. Rollout plan

| Stage | Content | Writes? | Gate |
|---|---|---|---|
| **2A.0** | `findCandidateWorkbooks_`, `normalizeDriveFile_`, `classifyUserWorkbooks_`, the 4 admin functions, name-fallback detection. | **None** | Editor-run only; inert until run. Own approved prompt. |
| 2A.1 | `buildWorkbookAppProperties_` (defined) + create-path marker stamp. | metadata on **new** files | Separate approved prompt (touches provisioning). |
| 2A.2 | Lazy marker backfill on successful open. | metadata on opened files | Separate approved prompt. |
| 2B | Auto-adopt + repair/trash tooling (see §10). | yes | **Deferred**; separate prompt(s). |

Exact function list for the 2A.0 implementation prompt:
- `buildWorkbookAppProperties_(email)` — pure marker builder (defined, unused in 2A.0).
- `findCandidateWorkbooks_(email)` — read-only Drive query (marker + name fallback).
- `normalizeDriveFile_(file, email)` — pure → `Candidate`.
- `classifyUserWorkbooks_(email)` — compose → `ClassificationReport`.
- `adminAuditUserWorkbook(email)` — editor-run, logs + returns report.
- `adminAuditAllAllowlisted()` — editor-run, rollup + per-user.
- `adminDumpUserCandidates(email)` — editor-run, raw debug dump.
- `adminDiagnosticsSelfTest()` — editor-run, environment/scope check.

All read-only; none mutate Drive, mappings, or the production workbook.

Validation for 2A.0 (manual, throwaway/test accounts only — never production):
- healthy user → `OK`;
- mapping cleared with file present → `UNMAPPED_SINGLE`;
- two same-named files → `UNMAPPED_MULTIPLE`;
- trashed mapped file → `STALE_MAPPING`;
- renamed mapped file → `OK` + `NAME_MISMATCH`;
- confirm `adminAuditAllAllowlisted` rollup;
- confirm **no** create/update/trash call occurs (verify Drive activity).

---

## 10. Future Phase 2B — recovery tooling (deferred; design intent only)

Phase 2B is **not** in scope here and must not be implemented until its own
approved prompt. Recorded so the deferred work is not lost.

Principles (carried from the investigation):
- **Detection first; report, never auto-destroy.**
- The only permissible automatic write is **safe auto-map (adopt)** of an
  exactly-one strict candidate when no mapping exists — flag-gated
  (`CENTRAL_AUTO_ADOPT`, default off), inside the user lock, re-verifying
  `openById`, and creating/deleting **nothing**.
- All other actions are **explicit, admin-driven, id-in-hand** (no scan-and-act).
- Multiple-candidate disambiguation is always a human decision ("which one holds
  the real data?"). The production workbook is never touched.

Anticipated 2B surfaces (design intent, signatures may change):
- Provisioning-time gate (replaces the unconditional create, inside the lock,
  after the mapping double-check):
  - `|candidates| = 0` → create new (current behavior) + stamp marker;
  - `|candidates| = 1` strict → adopt (write mapping), if `CENTRAL_AUTO_ADOPT` on;
  - `|candidates| ≥ 2` → `AmbiguousWorkbookError`, admin-log ids, calm user page.
- Explicit admin repair helpers, each requiring an explicit id:
  - `adminAdoptWorkbook(email, fileId)` — point mapping at a chosen file;
  - `clearMappingForUser_(email)` — already exists;
  - `adminTrashOrphan(fileId)` — soft delete only (`setTrashed`), echoes the
    target, never bulk.
- User-facing copy (aligns with Phase 5 help-text cleanup): calm, non-technical,
  no `Error:` prefixes, no internal ids/sheet names; ambiguity message points to
  `BETA_CONTACT_EMAIL`.

End of document.
