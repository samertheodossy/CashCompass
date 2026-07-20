# CENTRAL_APP_RECOVERY_COMPLETION_PLAN.md

**Status:** Ratified architecture (Version 1). P0 duplicate-prevention decision tree implemented 2026-07-16; HIGH-marker Admin Clear → automatic relink runtime-validated across two accounts 2026-07-17; full disposable-account matrix pending.
**Owner area:** Central App — workbook resolution, provisioning, and recovery.
**Related code:** `central_provisioning.js`, `central_diagnostics.js`, `central_resolver.js`, `sheet_bootstrap.js`, recovery client (`Dashboard_Body.html → #page_recovery`).
**Ratified:** 2026-07-07.

---

## Purpose

This document defines the **Version 1 Recovery Architecture** for the Central App: how the
system resolves, adopts, reconnects, or (only as a last resort) creates a user's CashCompass
workbook. It exists because Golden Workbook Convergence testing on `cashcompass2026@gmail.com`
exposed a structural problem — **clearing a mapping while `CENTRAL_AUTO_ADOPT` was OFF could
create duplicate CashCompass workbooks.** The P0 implementation now blocks that path. The exact
Admin Clear → one HIGH-marker candidate → same-workbook relink path passed isolated Central runtime
validation on 2026-07-17; the remaining decision-tree branches still require the disposable-account
matrix before Family Beta reliance.

This is the **authoritative recovery specification for Version 1**. All Stage 3 Recovery
Completion work (Auto-Adopt, Ambiguous recovery, Name-only adoption, Orphan handling, and the
provision-after-recovery duplicate guard) **must be implemented against this document.** Where
code and this document disagree, this document is correct and the code must change.

This is **not** a Golden Workbook issue; the convergence test merely reproduced the exact risk
the recovery paths are meant to handle.

---

## Product Principles

1. **Trust before convenience.** The system optimizes for the user never losing or duplicating
   their financial data, even when that means asking a question instead of guessing. A slightly
   more manual recovery is always preferable to a silent wrong outcome.
2. **Never duplicate user data.** A user must never end up with two CashCompass workbooks because
   the app created one while another viable workbook already existed. Duplicate workbooks split
   history, confuse totals, and destroy trust.
3. **Never provision while uncertainty exists.** Creating a new workbook is only correct when the
   system has *positively confirmed* there is nothing to adopt (zero candidates). Any uncertainty
   — multiple candidates, a failed search, or a candidate that will not verify — must route to a
   human decision or a safe hold, never to creation.
4. **Candidate detection is mandatory.** Searching the user's Drive for existing CashCompass
   workbooks is a **precondition of every provisioning decision**, not an optional feature behind
   a flag. The only question the system asks is *"what action?"* — never *"should we search?"*.
5. **Recovery decisions must be deterministic.** Given the same inputs (mapping state, candidate
   count, verification result), the system always reaches the same terminal action. No randomness,
   no order-dependence, no silent fall-through. Every path in the tree below is total and named.

---

## Recovery Decision Tree

Detection (`findCandidateWorkbooks_`) runs **unconditionally** on every resolution where the
mapping does not cleanly open. `CENTRAL_AUTO_ADOPT` does **not** gate whether detection occurs.

```
resolve(email)
│
└─ mapping present?
   │
   ├─ YES → openById(mappedId)
   │        ├─ opens OK ───────────────────────────────────────► USE MAPPED (normal path)
   │        └─ open FAILS → [STALE]  → SEARCH ──────────────┐
   │
   └─ NO  → [NO-MAPPING]              → SEARCH ──────────────┤
                                                             │
                          SEARCH = findCandidateWorkbooks_(email)   (ALWAYS)
                                                             │
                          ┌──────────────────────────────────┴──────────────────────────────┐
                          │ search threw (Drive failure)?  → UNAVAILABLE (retry)              │
                          │ never create, never adopt                                          │
                          └───────────────────────────────────────────────────────────────────┘

[NO-MAPPING] candidate count
   ├─ 0                         ─────────────────────────────► CREATE       (only safe create)
   ├─ 1 → re-verify openById
   │       ├─ ok                ─────────────────────────────► ADOPT        (relink → candidate)
   │       └─ fail (verify)     ─────────────────────────────► UNAVAILABLE  (retry; NOT create)
   └─ 2+                        ─────────────────────────────► AMBIGUOUS    (user selects)

[STALE] candidate count
   ├─ 0                         ─────────────────────────────► UNAVAILABLE  (mapped file gone)
   ├─ 1 → re-verify openById
   │       ├─ ok                ─────────────────────────────► RECONNECT    (relink → candidate)
   │       └─ fail (verify)     ─────────────────────────────► UNAVAILABLE  (retry)
   └─ 2+                        ─────────────────────────────► AMBIGUOUS    (user selects)
```

### Terminal actions

| Action | When | Mechanism |
|---|---|---|
| **USE MAPPED** | mapping present and `openById` succeeds | normal path (`cleanupDefaultSheet1_` + `ensureWorkbookIdentityMarkers_`) |
| **CREATE** | **`[NO-MAPPING]` and exactly 0 candidates** | `Drive.Files.create` → bootstrap → write mapping. **The only create path in the system.** |
| **ADOPT** | `[NO-MAPPING]` and exactly 1 verified candidate | `relinkSingleCandidate_` (verify open → cleanup → write mapping → stamp markers) |
| **RECONNECT** | `[STALE]` and exactly 1 verified candidate | `relinkSingleCandidate_` — same mechanism as ADOPT, surfaced on the recovery page |
| **AMBIGUOUS** | either state, 2+ candidates | `AmbiguousWorkbookError` → ambiguous recovery screen; user picks one → relink; optional **explicit, confirmed** "create new" |
| **UNAVAILABLE** | `[STALE]` + 0 candidates; **any** search failure; **any** single-candidate verify failure | recovery "unavailable" screen (retry + support contact). **Never creates.** |

### Failure branches (explicit)

- **Drive search failure** (`findCandidateWorkbooks_` / `Drive.Files.list` throws) → **UNAVAILABLE (retry)**.
  This is a deliberate change from the current *availability-first* behavior, which falls through
  to CREATE and is the exact source of duplicates. Trade-off: a brand-new user hitting a transient
  Drive error is briefly blocked from onboarding rather than risking a duplicate — acceptable under
  "trust before convenience." Retry with backoff before surfacing UNAVAILABLE.
- **Candidate verification failure** (candidate appears in the Drive list but `openById` throws) →
  **UNAVAILABLE (retry)**, never CREATE — the file likely exists but is transiently unopenable, and
  creating would duplicate it.
- **Stale mapped id also appears as a candidate** (owner still lists an inaccessible file): count = 1
  → RECONNECT attempts relink to it → if it still will not open, verify-fail → UNAVAILABLE. No loop,
  no duplicate.

**Invariant:** the system **never silently creates** a workbook while another viable workbook
exists. CREATE is reachable only from a positively confirmed zero-candidate state; the only other
way a new workbook can appear is an **explicit, user-confirmed** "create new" from the AMBIGUOUS
screen (which is, by definition, not silent).

---

## Design Decisions

1. **Candidate detection is unconditional.** Detection runs before any provisioning decision on
   every non-clean-open resolution. "Should we search?" is removed as a question. Only a Drive-list
   *exception* short-circuits — and to UNAVAILABLE, never to CREATE.

2. **`CENTRAL_AUTO_ADOPT` no longer controls whether searching occurs.** It controls only the
   **MEDIUM-confidence, name-only single-candidate branch**:
   - HIGH marker candidate → **ADOPT/RECONNECT automatically**, regardless of the flag.
   - MEDIUM name-only + `true` → **ADOPT/RECONNECT automatically**.
   - MEDIUM name-only + `false` → route to a **confirm-adopt prompt**.
   In **neither** setting does it disable detection or permit a silent duplicate. `0 → CREATE` and
   `2+ → AMBIGUOUS` are invariant regardless of the flag.

3. **Admin Clear Mapping stays mapping-store-only and flows through the tree.** `adminClearMapping`
   deletes the forward mapping + reverse-index trace (audited, no Drive writes, no file deletion).
   After a clear, the mapping is absent → the next request enters `[NO-MAPPING] → SEARCH` and the
   tree decides (adopt the existing workbook, or ambiguous). Admin Clear must **never** be a shortcut
   to CREATE. Admin Inspect should surface the candidate count so an operator knows, before clearing,
   that a workbook still exists.

4. **ADOPT and RECONNECT are one mechanism.** Both use `relinkSingleCandidate_`; they differ only in
   entry point and UX (ADOPT may be silent from the no-mapping path; RECONNECT is surfaced on the
   stale recovery page).

This is the intended **Version 1 behavior**.

---

## Implementation Plan

| Phase | Work | Notes |
|---|---|---|
| **Phase 1 — Ratify architecture** | This document. | ✅ Done (2026-07-07). |
| **Phase 2 — Unconditional candidate detection** | Move `findCandidateWorkbooks_` out from behind `isAutoAdoptEnabled_()` in `provisionWorkbookForUser_`; wire `0→CREATE · 1→ADOPT · 2+→AmbiguousWorkbookError` on every no-mapping/stale resolution. Change the Drive-failure and verify-failure leaves from "fall through to create" to **UNAVAILABLE**. | ✅ Implemented 2026-07-16; HIGH-marker Admin Clear/relink path runtime-validated 2026-07-17; remaining matrix pending. |
| **Phase 3 — Repurpose AUTO_ADOPT semantics** | `isAutoAdoptEnabled_()` now gates only MEDIUM/name-only single-candidate auto-adopt vs confirm-prompt. HIGH/marker candidates relink automatically; detection / ambiguous / create remain invariant. | ✅ Implemented 2026-07-16; HIGH relink with flag OFF runtime-validated 2026-07-17; MEDIUM OFF/ON paths pending. |
| **Phase 4 — Ambiguous selection UI** | Make the `ambiguous` recovery screen list candidates and let the user pick one → relink (reuse `relinkSingleCandidate_`); add explicit confirmed "create new." Ensure `buildRecoveryRouting_` carries candidate data. | Client: `Dashboard_Body.html → #page_recovery` + recovery script. |
| **Phase 5 — Admin enhancements** | Surface candidate count in `adminInspectUser`; keep `adminClearMapping` mapping-only; document `adminTrashOrphan` (soft-delete, id-in-hand). | No bulk operations. |
| **Phase 6 — Validation** | Run the Testing Matrix on a disposable account; then choose the Family Beta flag posture from evidence. | Record evidence in `SESSION_NOTES.md`. |

---

## Testing Matrix

Run on a **disposable** account, flags isolated, bound deployment untouched.

| # | Scenario | Precondition | Expected terminal action |
|---|---|---|---|
| 1 | No mapping, 0 candidates | fresh account | **CREATE** (exactly one workbook; mapping written) |
| 2 | No mapping, 1 candidate (marker/HIGH) | existing app-created workbook | **ADOPT** (verified relink regardless of auto-adopt flag) |
| 3 | No mapping, 1 candidate (name-only/MEDIUM) | owned + exact name | **ADOPT** (ON) / **confirm-adopt prompt** (OFF) |
| 4 | No mapping, 2+ candidates | two workbooks | **AMBIGUOUS** — no file created, none auto-picked; selection relinks |
| 5 | Stale mapping, 0 candidates | mapped file trashed/deleted | **UNAVAILABLE** (recovery screen) |
| 6 | Stale mapping, 1 candidate | real workbook still present | **RECONNECT** (relink; dashboard loads) |
| 7 | Stale mapping, 2+ candidates | multiple present | **AMBIGUOUS** — user selects |
| 8 | Drive search failure | simulate `Drive.Files.list` throw | **UNAVAILABLE/retry** — **never CREATE** |
| 9 | Candidate verification failure | candidate lists but `openById` throws | **UNAVAILABLE/retry** — **never CREATE** |
| 10 | Admin Clear → reload | existing workbook present | flows through tree → **ADOPT** (no duplicate). *Exact `cashcompass2026` reproduction.* |
| 11 | Flag semantics | 1 MEDIUM/name-only candidate, flag ON vs OFF | ON → silent adopt; OFF → confirm-adopt prompt; HIGH/ambiguous/create invariants do not change |
| 12 | Regression | bound (non-central) deployment | unaffected; `getUserSpreadsheet_` returns active spreadsheet |
| 13 | No cross-user leakage | second account's files exist | candidate queries scoped to `'me' in owners`; never appear |
| 14 | drive.file coverage | workbook app never created/opened | (acceptably) not a candidate; limitation documented |

---

## Runtime Evidence — 2026-07-17

- Central-only source push completed through `./push-central.sh`; isolated deployment version 107 was created without updating the existing Beta deployment.
- Script-property separation was verified before testing: Central `CENTRAL_MODE=true`; real bounded project `CENTRAL_MODE=false`.
- `REGRESSION-RECOVERY-DUPLICATE-GUARD` passed in Apps Script with 7/7 functional assertions; `SUITE-RECOVERY-REGRESSION` passed 1/1. Both disposable harness workbooks were trashed automatically.
- Isolated Central healthy load reached the dashboard without a recovery error.
- Admin Diagnostics before the clear showed one mapped HIGH-confidence workbook, one candidate, both identity markers present, and zero orphans.
- The mapping-only Admin Clear was executed. Reloading the isolated Central app automatically relinked the same workbook and loaded the dashboard; follow-up inspection showed the mapping and reverse index restored, one candidate, and zero orphans. No duplicate workbook was created.
- The same mapping-clear/reload path was then repeated while signed in as `cashcompass2026@gmail.com`. A distinctive `$10,000` cash value was written to its existing workbook before the mapping was cleared; after reload, Central automatically relinked that workbook and the `$10,000` value returned on the dashboard. No recreate/start-page flow or duplicate workbook appeared.
- The real bounded `Expenses/Payments` workbook was then inspected independently; its sheets and populated Overview remained intact and correct.
- This closes matrix rows 2, 10, and 12 for the tested HIGH-marker path and adds multi-account isolation evidence for row 13. Rows 1, 3–9, 11, 13, and 14 remain part of the formal isolated disposable-account matrix.

### Isolated rerun + Central health evidence — 2026-07-20

- Central-only source was pushed and isolated deployment version 109 was created without updating the existing Beta or bounded deployments.
- `SUITE-RECOVERY-REGRESSION` passed 1/1 with 7/7 functional assertions. Its disposable workbook was retained long enough to inspect the newly ratified `INPUT - Settings` formatting (16pt header, 14pt body, `#ffe599` header), then moved to trash.
- The configured Central default passed the read-only Provisioning health gate 8/8. Workbook Drift reported six advisory width findings only: one on `LOG - Activity` and five on `INPUT - Upcoming Expenses`; drift is non-blocking by design.
- This rerun reconfirms the synthetic duplicate guard and Central structural health. It does **not** close the still-pending live Recovery Validation 6F rows listed above.

---

## Documentation

Cross-references (this document is the implementation spec they point to):

- **`PRODUCT_VISION.md → §11 Version 1 Guiding Conclusions`** — already states *"recovery must not
  create silent duplicates."* This plan is the concrete realization of that conclusion.
- **`TODO.md → Stage 3 → D. Recovery completion`** — the Auto-Adopt / Ambiguous / Name-only / Orphan
  items and the 2026-07-07 provision-after-recovery duplicate-guard row are implemented against this
  document.
- **`PROJECT_CONTEXT.md`** — provisioning/recovery description (`getOrProvisionUserSpreadsheet_`,
  `provisionWorkbookForUser_`, `handleStaleMapping_`, `clearMappingForUser_`) will be updated to
  reflect unconditional detection and the repurposed flag semantics when implemented.

**Core statement:** *Recovery must never create silent duplicates.* A new workbook is created only
when candidate detection has positively confirmed zero existing candidates.

---

## Roadmap

No priority reordering. Stage 3 Recovery Completion remains **priority #4** in the agreed Stage 3
order. This document is referenced as the **implementation specification** for that work; see
`TODO.md → Stage 3 → D. Recovery completion`.
