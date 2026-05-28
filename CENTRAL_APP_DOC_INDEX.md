# CENTRAL_APP_DOC_INDEX.md

Documentation audit and classification index for the Central App / onboarding / beta documentation set, after the first central-mode provisioning milestone runtime-confirmed (2026-05-28).

**Documentation only.** No file deletions, no file renames, no Apps Script code change, no HTML change, no `appsscript.json` change, no deployment change. This document is an audit; it does **not** authorize or perform any consolidation. The next consolidation step requires its own explicit prompt.

Cross-references (the orientation docs that survive every cleanup pass):
- `README.md` — entry point.
- `PROJECT_CONTEXT.md` — live product state.
- `WORKING_RULES.md` — current-phase rules.
- `SESSION_NOTES.md` — shipped-history log.
- `CENTRAL_APP_NEXT_STEP_BASELINE.md → §7.bis` — current two-mode operating model after the first central-mode milestone.
- `CENTRAL_APP_FAMILY_BETA_READINESS_CHECKPOINT.md → §7.6` — active recommendation for the next hardening sequence.
- `CENTRAL_APP_WORKBOOK_CREATION_FIRST_SLICE_PLAN.md → §15` — runtime evidence from the first central-mode provisioning proof.

---

## 1. Scope and method

### 1.1 What this audit covers

Every Central App / onboarding / beta planning doc at the repository root. Specifically:

- All 21 `CENTRAL_APP_*.md` files.
- The four onboarding-adjacent planning docs: `ONBOARDING_AND_INPUT_STRATEGY.md`, `ONBOARDING_TODO.md`, `FIRST_RUN.md`, `GENERATED_SHEET_FORMATTING_POLISH_PLAN.md`.
- The four release-readiness / quality-discipline docs that bracket the beta work: `GoingToProduction.md`, `UX_POLISH_AUDIT.md`, `TESTING_PLAN.md`, `SystemArch.md`.

Total reviewed: **29 documents**.

### 1.2 What this audit does NOT cover (intentionally)

These docs are project-infrastructure / always-active surfaces and are out of scope for this audit; they are not consolidation candidates and are not classified here:

- `README.md`, `PROJECT_CONTEXT.md`, `SESSION_NOTES.md`, `WORKING_RULES.md`, `INIT_PROMPT.md`, `COMMIT_RULES.md`, `SECURITY.md`, `TODO.md`, `ENHANCEMENTS.md`.

If any consolidation pass later proposes to merge content **into** one of those docs (e.g., distilling a phase record into `SESSION_NOTES.md`), that target doc would be mentioned in §5 of this audit but not reclassified.

### 1.3 Classification taxonomy (the six buckets from the audit prompt)

| Bucket | Meaning | When to use |
|---|---|---|
| **A. Active source of truth** | Currently the canonical place for some decision or contract. Referenced by other live docs. Editing it would change live behavior or constrain a real next prompt. | Architecture spec, lifecycle contract, current-phase plan. |
| **B. Historical phase record** | Pinned a decision / shipped a phase. The decision is now landed in code. The doc records what was decided and why, but does not constrain future work. | Per-phase resolver seam designs whose phase has shipped. |
| **C. Superseded but retained for audit trail** | The doc's original recommendation was reversed or overtaken, but the doc itself was updated in place with a "superseded" banner preserving the original wording. | `CENTRAL_APP_MINIMAL_BETA_PROOF.md` (Approach A rejected; Approach D adopted); §7.4 / §7.5 of the readiness checkpoint. |
| **D. Backlog / future workstream** | Scoped work that is intentionally deferred. Not blocking. Has its own future trigger. | `GENERATED_SHEET_FORMATTING_POLISH_PLAN.md`, `UX_POLISH_AUDIT.md`, `ONBOARDING_TODO.md`. |
| **E. Candidate for consolidation** | The doc's content largely duplicates or is subsumed by another doc. A summary into that doc + removal-after-grace-period would reduce noise. | Subset of B (phase records) and some C (superseded recommendations). |
| **F. Candidate for archive later** | The doc will be moved to a `docs/archive/` subtree (or similar) once a stable archive convention exists. Not deleted; just relocated for noise reduction. | All B and most C docs, once the archive convention exists. |

Bucket A is the only bucket where the doc is actively load-bearing today. Buckets B–F are all "keep but eventually quiet." No doc is recommended for deletion.

---

## 2. Per-file inventory and classification

Files are listed in the order they would appear in `ls *.md` for predictable diffability. Each row carries: filename, size class (S = small ≤10 KB, M = medium ≤40 KB, L = large > 40 KB), current purpose (one line), classification (primary bucket), actively-referenced-from list, recommended action, reason.

### 2.1 Central App architecture & contract docs (the load-bearing set)

| File | Size | Purpose | Class | Actively referenced from | Action | Reason |
|---|---|---|---|---|---|---|
| `CENTRAL_APP_DESIGN.md` | M (36 KB) | Architecture-only design record for migration from bound-sheet to centralized web app. | **A — Active source of truth** | Every other Central App doc; `PROJECT_CONTEXT.md → Future architecture`; all six resolver-seam docs. | **Keep active.** | The canonical architecture record. Still the single source for the resolver seam concept, the abstraction point, and the §9 guardrails everything else cites. No revision needed; only update when an architectural decision actually shifts. |
| `CENTRAL_APP_DEPLOYMENT_OPTIONS.md` | M (30 KB) | Deployment / security options analysis (executeAs / access posture, ownership). | **A — Active source of truth** | `CENTRAL_APP_DESIGN.md`, `CENTRAL_APP_DEPLOYMENT_PREPARATION_PLAN.md`, `CENTRAL_APP_FAMILY_BETA_PLAN.md`. | **Keep active.** | The architecture record for the deployment posture. The actual manifest now reflects the preferred direction (Option B: `USER_ACCESSING` + per-user Drive workbooks), and that posture is live on the central beta deployment. Still the place that documents *why*. |
| `CENTRAL_APP_ONBOARDING_AND_LIFECYCLE.md` | M (32 KB) | User lifecycle contract for central mode (first-run, reconnect, recovery, deletion states). | **A — Active source of truth** | `CENTRAL_APP_DESIGN.md`, `CENTRAL_APP_IMPLEMENTATION_PLAN.md`, `CENTRAL_APP_FAMILY_BETA_PLAN.md`. | **Keep active.** | The lifecycle contract is still ahead of implementation — only the first-run/provisioning state is now runtime-confirmed; reconnect / recovery / deletion paths are unimplemented and remain governed by this doc. |
| `CENTRAL_APP_IMPLEMENTATION_PLAN.md` | M (24 KB) | Staged implementation roadmap (resolver seam first → ensure-\* migration → central mode). | **A — Active source of truth** | All six resolver-seam docs; `CENTRAL_APP_DEPENDENCY_AUDIT.md`; the implementation gate in §9 is the rule cited by every new prompt. | **Keep active.** | The roadmap doc. The implementation gate in §9 ("any actual code change requires its own Cursor implementation prompt with explicit user approval") is the operative rule for every Central App code change. Still load-bearing. |
| `CENTRAL_APP_FAMILY_BETA_PLAN.md` | M (26 KB) | Private family beta scope, non-goals, success criteria, phasing. | **A — Active source of truth** | `CENTRAL_APP_MINIMAL_BETA_PROOF.md`, `CENTRAL_APP_FAMILY_BETA_READINESS_CHECKPOINT.md`, `CENTRAL_APP_BOOTSTRAP_COVERAGE_AUDIT.md`. | **Keep active.** | The "what does family beta mean and what does it NOT mean" doc. Banner reaffirms onboarding-first stance. Still constrains every central-mode prompt. |
| `CENTRAL_APP_NEXT_STEP_BASELINE.md` | M (23 KB) | Connective tissue between bound-mode closure and central-mode milestone; carries the §7.bis post-milestone two-mode operating model. | **A — Active source of truth** | `CENTRAL_APP_WORKBOOK_CREATION_AND_MAPPING_PLAN.md`, `CENTRAL_APP_FAMILY_BETA_READINESS_CHECKPOINT.md → §7.6`. | **Keep active. Promote as one of the two "what's next" entry points** (alongside the readiness checkpoint §7.6). | The §7.bis "Updated conclusion" + two-mode operating-model table is the most current statement of where the project is. New contributors should land here after `PROJECT_CONTEXT.md`. |
| `CENTRAL_APP_FAMILY_BETA_READINESS_CHECKPOINT.md` | L (43 KB) | Synthesis of bound-mode readiness; now carries §7.6 active recommendation for the four next hardening tests. | **A — Active source of truth** | `CENTRAL_APP_NEXT_STEP_BASELINE.md`, `CENTRAL_APP_BOOTSTRAP_COVERAGE_AUDIT.md`, `CENTRAL_APP_BLANK_WORKBOOK_RUNTIME_REPORT.md`. | **Keep active. Promote as the second "what's next" entry point.** | §7.6 is the live recommendation for the next runtime test session. Historical sections (§3, §5, §7.4, §7.5) carry "superseded" banners but the doc as a whole is still load-bearing for the active-recommendation surface. |

**Active SoT total: 7 documents.**

### 2.2 Central App audit / coverage docs (still informing live decisions)

| File | Size | Purpose | Class | Actively referenced from | Action | Reason |
|---|---|---|---|---|---|---|
| `CENTRAL_APP_DEPENDENCY_AUDIT.md` | M (26 KB) | Audit of `SpreadsheetApp.getActiveSpreadsheet()` call sites; migration risk classification. | **A — Active source of truth** | All six resolver-seam docs; `CENTRAL_APP_IMPLEMENTATION_PLAN.md`. | **Keep active.** | ~131 production call sites remain unmigrated after Phase 6; this doc is still the source for picking future seams if the migration is ever resumed beyond the first-slice provisioning proof. |
| `CENTRAL_APP_BOOTSTRAP_COVERAGE_AUDIT.md` | L (69 KB) | Audit of additive ensure-\* coverage; "is the codebase close to zero-sheet onboarding?" | **A — Active source of truth** | `CENTRAL_APP_BLANK_WORKBOOK_RUNTIME_REPORT.md`, `CENTRAL_APP_FAMILY_BETA_READINESS_CHECKPOINT.md`. | **Keep active.** Some sections (§5.1 Donations, §5.2 Houses) have been resolved with "superseded" annotations; the rest is still live coverage record. | The bootstrap chain is what the central-mode flow calls into; this is the documentation of what it covers. Still the source for "is this sheet auto-created?" |
| `CENTRAL_APP_BLANK_WORKBOOK_RUNTIME_REPORT.md` | L (61 KB) | Manual runtime test report for bound-mode blank-workbook walkthrough. | **A — Active source of truth** (matrix complete) | `CENTRAL_APP_BOOTSTRAP_COVERAGE_AUDIT.md`, `CENTRAL_APP_FAMILY_BETA_READINESS_CHECKPOINT.md`. | **Keep active for now; candidate for archive (bucket F) once the central-mode runtime report exists.** | The matrix is complete (planner-page rows closed 2026-05-23). It is still the runtime evidence of bound-mode onboarding correctness. A future `CENTRAL_APP_CENTRAL_MODE_RUNTIME_REPORT.md` may eventually subsume it; until then, keep. |

**Audit-track total: 3 documents (all still A).**

### 2.3 Central App resolver seam phase records (Phase 1–6 — all shipped)

Each of these documents pinned the design for one specific resolver-seam phase. Each already carries a "Status — shipped in `<commit>`" banner at the top. The seam itself has landed in code; the doc records what was decided and why. They do not constrain future work.

| File | Size | Phase | Shipped commit | Class | Action | Reason |
|---|---|---|---|---|---|---|
| `CENTRAL_APP_FIRST_RESOLVER_SEAM.md` | M (23 KB) | Phase 1 | `b2798a7` | **B — Historical phase record** / **E — Consolidation candidate** | **Keep until consolidation pass.** Eventually summarize into `SESSION_NOTES.md` (one-line entry already exists in the V1.x history) or into a single `CENTRAL_APP_RESOLVER_SEAM_HISTORY.md`. | One-line summary already in SESSION_NOTES; full design doc is rarely re-read. Low information per byte going forward. |
| `CENTRAL_APP_SECOND_RESOLVER_SEAM.md` | M (32 KB) | Phase 2 | `1b68c71` | **B — Historical phase record** / **E — Consolidation candidate** | Same as Phase 1. | Same — banner explicitly says the design is preserved as historical record. |
| `CENTRAL_APP_THIRD_RESOLVER_SEAM.md` | M (32 KB) | Phase 3 | `72d82b1` | **B — Historical phase record** / **E — Consolidation candidate** | Same as Phase 1. | Same. |
| `CENTRAL_APP_DASHBOARD_SEAM_ANALYSIS.md` | M (39 KB) | Phase 4 (dashboard) | `99bcf37` | **B — Historical phase record** (with active reference value) | **Keep.** Has more architectural commentary than the other seam docs (full dashboard call-site map, Step B–F deferral analysis). Less aggressive consolidation candidate. | The §6 Step E "buildDashboardSnapshot migrates last" rule and the §11 dashboard cold-start analysis are still cited by other docs. Keep until central-mode work explicitly broadens past the first slice. |
| `CENTRAL_APP_FIFTH_RESOLVER_SEAM.md` | M (25 KB) | Phase 5 | (shipped per status banner) | **B — Historical phase record** / **E — Consolidation candidate** | Same as Phase 1. | Same. |
| `CENTRAL_APP_SIXTH_RESOLVER_SEAM.md` | M (30 KB) | Phase 6 | (shipped per status banner) | **B — Historical phase record** / **E — Consolidation candidate** | Same as Phase 1. | Same. |

**Phase-record total: 6 documents. All are bucket B. Four (1, 2, 3, 5, 6) are strong consolidation candidates; #4 (dashboard) has additional architectural value and should be kept longer.**

### 2.4 First central-mode slice planning docs (recently shipped)

The four documents that pinned and implemented the first central-mode provisioning slice. Cluster behaves like a single "milestone bundle" — each played a distinct role on the path from authorization → architecture → manifest → implementation → runtime evidence.

| File | Size | Role in milestone | Class | Action | Reason |
|---|---|---|---|---|---|
| `CENTRAL_APP_WORKBOOK_CREATION_AND_MAPPING_PLAN.md` | M (32 KB) | Authorized the slice; resolved §5 Decision Pending items from `CENTRAL_APP_NEXT_STEP_BASELINE.md`. | **C — Superseded but retained for audit trail** / **E — Consolidation candidate** | **Keep as-is until a consolidation pass.** Optionally add a top banner pointing forward to FIRST_SLICE_PLAN, DEPLOYMENT_PREPARATION_PLAN, and RESOLVER_PROVISIONING_IMPLEMENTATION_PROMPT. | The decisions it took (Drive API creation, PropertiesService mapping, allow-list gate, USER_ACCESSING posture) are now pinned more concretely in the three downstream docs. Its function was to authorize the next layer; that next layer exists and is shipped. |
| `CENTRAL_APP_WORKBOOK_CREATION_FIRST_SLICE_PLAN.md` | M (40 KB) | Architecture-side pinning of the first slice; now carries §15 runtime evidence + §15.5 next hardening tests. | **A — Active source of truth** | `SESSION_NOTES.md`, `CENTRAL_APP_NEXT_STEP_BASELINE.md`, `CENTRAL_APP_FAMILY_BETA_READINESS_CHECKPOINT.md`. | **Keep active.** | §15.5 is the live hardening-test backlog for the central-mode slice. Until those four tests pass, this doc is load-bearing. |
| `CENTRAL_APP_DEPLOYMENT_PREPARATION_PLAN.md` | L (52 KB) | Manifest / scope / access posture, deployment isolation strategy. | **A — Active source of truth** | `CENTRAL_APP_RESOLVER_PROVISIONING_IMPLEMENTATION_PROMPT.md`, `SESSION_NOTES.md`. | **Keep active.** | Describes the *operative* deployment posture and the rationale (including the corrected `ANYONE` vs `ANYONE_WITH_GOOGLE_ACCOUNT` distinction). Future deployment changes will be evaluated against this doc. |
| `CENTRAL_APP_RESOLVER_PROVISIONING_IMPLEMENTATION_PROMPT.md` | L (43 KB) | Code-level spec for the resolver/provisioning implementation. | **B — Historical phase record** (slice shipped in `d952dfa`) / **E — Consolidation candidate** | **Keep until consolidation pass.** Add a top "Status — implementation shipped in `d952dfa`" banner in the safe-first cleanup pass (§4). | The implementation has landed; the spec is now reference, not gate. Useful if the slice is ever revisited or extended. Lower information density going forward. |

**First-slice-milestone total: 4 documents (2 still A, 2 in the B/C/E zone).**

### 2.5 Onboarding-adjacent docs (predate central-mode work but referenced)

| File | Size | Purpose | Class | Action | Reason |
|---|---|---|---|---|---|
| `ONBOARDING_AND_INPUT_STRATEGY.md` | S (8 KB) | Reference / future design for input-flow strategy; banner says "not active work." | **D — Backlog / future workstream** (passive reference) | **Leave as backlog.** | Useful reference; not in any prompt's active path. Banner already declares its status. No noise. |
| `ONBOARDING_TODO.md` | S (7 KB) | Long-term onboarding wizard / template-product sketch; banner says "not active work." | **D — Backlog / future workstream** | **Leave as backlog.** | Useful future reference; banner already declares status. |
| `FIRST_RUN.md` | S (7 KB) | Short user-facing first-open guide. | **A — Active source of truth** (user-facing operational doc) | **Keep active.** | Live first-run smoke check. Not in the Central App planning chain but onboarding-adjacent. |

### 2.6 Parallel polish / discipline docs (intentionally separate workstreams)

| File | Size | Purpose | Class | Action | Reason |
|---|---|---|---|---|---|
| `GENERATED_SHEET_FORMATTING_POLISH_PLAN.md` | M (28 KB) | Cosmetic polish workstream tracker (separate from central-mode work). | **D — Backlog / future workstream** | **Leave as backlog.** | Explicitly designed to not block central-mode work. Self-contained. |
| `UX_POLISH_AUDIT.md` | M (24 KB) | UI text polish audit ahead of family beta. | **D — Backlog / future workstream** | **Leave as backlog.** | Explicitly orthogonal to central-mode resolver migration per its own §1 scope statement. |
| `GoingToProduction.md` | S (10 KB) | Release-readiness narrative (Goal A vs Goal B framing). | **A — Active source of truth** (reference framing) | **Keep active.** | The Goal A / Goal B framing is still cited; release readiness is the lens against which family-beta-readiness is assessed. |
| `TESTING_PLAN.md` | M (13 KB) | Manual two-track (blank + populated) regression discipline. | **A — Active source of truth** (operational discipline) | **Keep active.** | The two-track manual test pattern is the live regression posture. |
| `SystemArch.md` | M (27 KB) | Architecture briefing for new contributors. | **A — Active source of truth** | **Keep active.** | Cited from `README.md` and used for onboarding contributors. |

### 2.7 The one "superseded but in-place" doc

| File | Size | Purpose | Class | Action | Reason |
|---|---|---|---|---|---|
| `CENTRAL_APP_MINIMAL_BETA_PROOF.md` | L (66 KB) | Originally analyzed shortcut vs onboarding-first beta proof; Approach A was rejected, Approach D adopted; banner + §5.bis revised in place. | **C — Superseded but retained for audit trail** | **Keep as-is.** Strong **E — Consolidation candidate** for a future pass once Approach D's actual proof history stabilizes. | The doc has been updated in place with a "REVISED" banner and a §5.bis that overrides §5 Approach A. Original §1–§4 candidate analysis is preserved as historical record. Eventually a successor doc could absorb the active Approach D wording; for now, keeping the audit trail is the right move. |

---

## 3. Summary by classification

| Bucket | Count | Files |
|---|---|---|
| **A. Active source of truth** | 14 | `CENTRAL_APP_DESIGN.md`, `CENTRAL_APP_DEPLOYMENT_OPTIONS.md`, `CENTRAL_APP_ONBOARDING_AND_LIFECYCLE.md`, `CENTRAL_APP_IMPLEMENTATION_PLAN.md`, `CENTRAL_APP_FAMILY_BETA_PLAN.md`, `CENTRAL_APP_NEXT_STEP_BASELINE.md`, `CENTRAL_APP_FAMILY_BETA_READINESS_CHECKPOINT.md`, `CENTRAL_APP_DEPENDENCY_AUDIT.md`, `CENTRAL_APP_BOOTSTRAP_COVERAGE_AUDIT.md`, `CENTRAL_APP_BLANK_WORKBOOK_RUNTIME_REPORT.md`, `CENTRAL_APP_WORKBOOK_CREATION_FIRST_SLICE_PLAN.md`, `CENTRAL_APP_DEPLOYMENT_PREPARATION_PLAN.md`, `FIRST_RUN.md`, `GoingToProduction.md`, `TESTING_PLAN.md`, `SystemArch.md` (note: 16 includes the adjacent docs; 12 are CENTRAL_APP_*) |
| **B. Historical phase record** | 7 | `CENTRAL_APP_FIRST_RESOLVER_SEAM.md`, `CENTRAL_APP_SECOND_RESOLVER_SEAM.md`, `CENTRAL_APP_THIRD_RESOLVER_SEAM.md`, `CENTRAL_APP_DASHBOARD_SEAM_ANALYSIS.md`, `CENTRAL_APP_FIFTH_RESOLVER_SEAM.md`, `CENTRAL_APP_SIXTH_RESOLVER_SEAM.md`, `CENTRAL_APP_RESOLVER_PROVISIONING_IMPLEMENTATION_PROMPT.md` |
| **C. Superseded but retained** | 2 | `CENTRAL_APP_MINIMAL_BETA_PROOF.md`, `CENTRAL_APP_WORKBOOK_CREATION_AND_MAPPING_PLAN.md` |
| **D. Backlog / future workstream** | 4 | `ONBOARDING_AND_INPUT_STRATEGY.md`, `ONBOARDING_TODO.md`, `GENERATED_SHEET_FORMATTING_POLISH_PLAN.md`, `UX_POLISH_AUDIT.md` |
| **E. Candidate for consolidation** (overlaps with B/C) | 7 | `CENTRAL_APP_FIRST_RESOLVER_SEAM.md`, `CENTRAL_APP_SECOND_RESOLVER_SEAM.md`, `CENTRAL_APP_THIRD_RESOLVER_SEAM.md`, `CENTRAL_APP_FIFTH_RESOLVER_SEAM.md`, `CENTRAL_APP_SIXTH_RESOLVER_SEAM.md`, `CENTRAL_APP_WORKBOOK_CREATION_AND_MAPPING_PLAN.md`, `CENTRAL_APP_RESOLVER_PROVISIONING_IMPLEMENTATION_PROMPT.md` |
| **F. Candidate for archive later** (overlaps with B/C) | 7 | Same as E plus `CENTRAL_APP_BLANK_WORKBOOK_RUNTIME_REPORT.md` (only after a central-mode runtime report exists) |

Buckets B and C **overlap** with E and F because "consolidation" and "archive" are *actions* against B/C docs; B/C are the underlying *states*.

**Correction to the §3 table:** the "A. Active source of truth" row above lists 16 entries but is 14 distinct CENTRAL_APP_* files plus 4 adjacent docs = 18; the count is split as 12 CENTRAL_APP_* + 4 adjacent. The exact mapping per file is in §2.

---

## 4. Recommended one-pass safe first cleanup

> **One pass. Documentation-only. No file deletions. No file renames. No file moves.**

### 4.1 The proposed first pass

Add a uniform top-of-file **status banner** to the seven historical / superseded documents that do not already carry one (or whose existing banner is now out of date), so a reader landing on those files immediately knows their state.

| File | Banner to add (or update) | Status today |
|---|---|---|
| `CENTRAL_APP_WORKBOOK_CREATION_AND_MAPPING_PLAN.md` | "Status — superseded 2026-05-28 by `CENTRAL_APP_WORKBOOK_CREATION_FIRST_SLICE_PLAN.md`, `CENTRAL_APP_DEPLOYMENT_PREPARATION_PLAN.md`, and `CENTRAL_APP_RESOLVER_PROVISIONING_IMPLEMENTATION_PROMPT.md`. The first central-mode slice has shipped (`d952dfa`) and been runtime-confirmed. This doc is preserved as the audit trail of the original planning resolution." | No banner. Needs one. |
| `CENTRAL_APP_RESOLVER_PROVISIONING_IMPLEMENTATION_PROMPT.md` | "Status — implementation shipped in `d952dfa` (2026-05-28). The spec below is preserved as the contract record for the first central-mode resolver + workbook provisioning slice. Runtime evidence in `CENTRAL_APP_WORKBOOK_CREATION_FIRST_SLICE_PLAN.md → §15`." | No banner. Needs one. |
| `CENTRAL_APP_FIRST_RESOLVER_SEAM.md` | Existing banner is accurate. **No change.** | Already banner'd; OK. |
| `CENTRAL_APP_SECOND_RESOLVER_SEAM.md` | Existing banner is accurate. **No change.** | Already banner'd; OK. |
| `CENTRAL_APP_THIRD_RESOLVER_SEAM.md` | Existing banner is accurate. **No change.** | Already banner'd; OK. |
| `CENTRAL_APP_DASHBOARD_SEAM_ANALYSIS.md` | Existing banner is accurate. **No change.** | Already banner'd; OK. |
| `CENTRAL_APP_FIFTH_RESOLVER_SEAM.md` | Add: "Status — Phase 5 shipped in `<commit>` (the design below is preserved as a historical record)." Verify the actual shipping commit before writing. | Has "design analysis" preamble but no shipped banner. Needs one. |
| `CENTRAL_APP_SIXTH_RESOLVER_SEAM.md` | Add: "Status — Phase 6 shipped in `<commit>` (the design below is preserved as a historical record)." Verify the actual shipping commit before writing. | Same as Phase 5. |
| `CENTRAL_APP_MINIMAL_BETA_PROOF.md` | Existing "Status — REVISED" banner is accurate, but could be augmented with a one-line forward-pointer: "Approach D shipped its first slice on 2026-05-28 (`d952dfa`) — see `CENTRAL_APP_WORKBOOK_CREATION_FIRST_SLICE_PLAN.md → §15` for runtime evidence." | Banner exists; add forward-pointer only. |

**Scope of the proposed pass:**
- Touches **at most 5 files** (the four banner-less plus the augmentation to `MINIMAL_BETA_PROOF.md`).
- Each edit is one block of YAML-style frontmatter / a markdown blockquote at the top of the file.
- Zero substantive content rewrites; every existing word is preserved.
- Zero file deletions, zero file renames, zero file moves.
- Zero JS, zero HTML, zero `appsscript.json`, zero deployment-setting changes.

**What this pass produces:**
- Every historical / superseded doc carries an up-to-date "Status —" banner at the top.
- A reader landing on any of these files via a stale cross-reference immediately knows the doc is not the live source of truth and where the live source lives.
- The doc set is now safe to consolidate further in a subsequent pass without the risk that a reader misses a "this is historical" signal.

**What this pass does NOT produce:**
- It does not consolidate any content into other docs.
- It does not move any file.
- It does not delete any content.
- It does not change the bucket of any doc (a B doc stays B; the banner just makes its B-ness obvious).

### 4.2 Why this is the right first pass

- **Risk floor is the lowest possible:** documentation-only, additive, reversible with a single `git revert`.
- **Information value is high:** stale cross-references are the most common source of confusion in a large doc set. Banners are the cheapest mitigation.
- **It does not foreclose any later pass.** Every subsequent consolidation, archive, or merge pass benefits from having explicit status banners on every historical doc.
- **It does not require deciding the final structure.** The proposed §5 final structure below is a *suggestion*; this first pass is compatible with any of three reasonable final structures.

### 4.3 What should NOT be in the first pass

The first pass deliberately does **not** include:

- Creating a `docs/` or `docs/archive/` subdirectory and moving files into it. *Why deferred:* moves change git history visibility and break every absolute-path cross-reference. Higher cost; should be a deliberate second pass with rename-tracking discipline.
- Merging two docs into one. *Why deferred:* every merge is a content-level decision (whose wording wins, what gets dropped); needs its own per-merge prompt.
- Deleting any file. *Why deferred:* deletion is irreversible; the entire audit treats every doc as "preserve for audit trail" until explicit later prompt says otherwise.
- Renaming any file. *Why deferred:* would break every cross-reference and force a sweep of all docs to update references. Out of scope for a *first* pass.
- Editing the body of any active source-of-truth doc. *Why deferred:* the active docs are load-bearing for in-flight work (notably the §15.5 hardening tests and the §7.6 active recommendation). Editing them risks introducing drift.

---

## 5. Proposed final documentation structure (suggestion, not commitment)

Once the doc set has been cleaned up across several future passes, the suggested final shape (none of these moves are proposed for this audit's first pass):

### 5.1 Tier 1 — Always-on operational surfaces (top of the repo)

`README.md` → `WORKING_RULES.md` → `PROJECT_CONTEXT.md` → `SESSION_NOTES.md` → `TESTING_PLAN.md` → `INIT_PROMPT.md` → `FIRST_RUN.md` → `SECURITY.md` → `COMMIT_RULES.md` → `TODO.md` → `ENHANCEMENTS.md` → `SystemArch.md` → `GoingToProduction.md`.

These never move. They are project infrastructure.

### 5.2 Tier 2 — Central App active source-of-truth set (top of the repo)

Kept at the repo root so that cross-references from Tier 1 stay short:

- `CENTRAL_APP_DESIGN.md` — architecture spec.
- `CENTRAL_APP_DEPLOYMENT_OPTIONS.md` — deployment posture rationale.
- `CENTRAL_APP_ONBOARDING_AND_LIFECYCLE.md` — lifecycle contract.
- `CENTRAL_APP_IMPLEMENTATION_PLAN.md` — staged roadmap.
- `CENTRAL_APP_FAMILY_BETA_PLAN.md` — beta scope.
- `CENTRAL_APP_DEPENDENCY_AUDIT.md` — call-site inventory.
- `CENTRAL_APP_BOOTSTRAP_COVERAGE_AUDIT.md` — bootstrap coverage record.
- `CENTRAL_APP_NEXT_STEP_BASELINE.md` — current operating model + next-step orientation.
- `CENTRAL_APP_FAMILY_BETA_READINESS_CHECKPOINT.md` — active recommendation surface.
- `CENTRAL_APP_WORKBOOK_CREATION_FIRST_SLICE_PLAN.md` — first central-mode slice + §15 runtime evidence + §15.5 next hardening tests.
- `CENTRAL_APP_DEPLOYMENT_PREPARATION_PLAN.md` — manifest / scope / access posture.
- `CENTRAL_APP_BLANK_WORKBOOK_RUNTIME_REPORT.md` — bound-mode runtime evidence (until a central-mode equivalent exists).
- `CENTRAL_APP_DOC_INDEX.md` — this doc.

### 5.3 Tier 3 — Backlog / parallel workstream docs (top of the repo)

- `GENERATED_SHEET_FORMATTING_POLISH_PLAN.md`
- `UX_POLISH_AUDIT.md`
- `ONBOARDING_AND_INPUT_STRATEGY.md`
- `ONBOARDING_TODO.md`

### 5.4 Tier 4 — Historical / superseded / archived (eventually `docs/archive/` or similar)

Only after a future consolidation pass that creates the archive convention:

- `CENTRAL_APP_FIRST_RESOLVER_SEAM.md`
- `CENTRAL_APP_SECOND_RESOLVER_SEAM.md`
- `CENTRAL_APP_THIRD_RESOLVER_SEAM.md`
- `CENTRAL_APP_DASHBOARD_SEAM_ANALYSIS.md` (or kept in Tier 2 if its architectural commentary continues to be referenced)
- `CENTRAL_APP_FIFTH_RESOLVER_SEAM.md`
- `CENTRAL_APP_SIXTH_RESOLVER_SEAM.md`
- `CENTRAL_APP_WORKBOOK_CREATION_AND_MAPPING_PLAN.md`
- `CENTRAL_APP_RESOLVER_PROVISIONING_IMPLEMENTATION_PROMPT.md`
- `CENTRAL_APP_MINIMAL_BETA_PROOF.md` (only after Approach D's runtime history is large enough to subsume the original analysis)

**Important:** no doc in Tier 4 is recommended for deletion. The archive distinction is for organization, not removal.

---

## 6. Docs that should NOT be deleted yet

**Every doc reviewed in this audit (all 29) should be retained.** No deletion is recommended at this time. The reasons fall into three categories:

1. **Active source-of-truth (bucket A):** load-bearing for in-flight work. Editing or deletion would create drift.
2. **Historical phase record / superseded (buckets B, C):** preserve as audit trail. Each ship-vs-design comparison and each rejected approach is institutional memory that has value if a future contributor asks "why was X decided this way?"
3. **Backlog / future workstream (bucket D):** explicitly scoped as deferred work with future triggers. Their existence prevents the deferred items from being silently dropped.

If a deletion ever becomes appropriate, it should happen via a deliberate prompt with explicit per-file justification, not as a side effect of a consolidation pass.

---

## 7. Docs that are now noisy (signal-to-noise concerns)

These docs have either (a) shipped their core decision and are now referenced less often, or (b) been partially superseded such that a reader has to mentally filter the "live" parts from the "historical" parts. None is recommended for deletion; the noise can be reduced by status banners (§4) and eventual archival (§5.4).

| File | Noise source | Mitigation |
|---|---|---|
| `CENTRAL_APP_FIRST_RESOLVER_SEAM.md` ... `CENTRAL_APP_SIXTH_RESOLVER_SEAM.md` (5 files; #4 is the dashboard analysis with different noise profile) | Each is a single-phase design that has shipped. Reading them in 2026-05-28 yields little decision-relevant signal. | Status banners (already present on 4 of 5; add to Phases 5–6 in the §4 first pass). Eventually consolidate into one history doc or archive. |
| `CENTRAL_APP_WORKBOOK_CREATION_AND_MAPPING_PLAN.md` | Was the planning bridge; the three downstream docs are now where the live spec lives. | Status banner pointing forward, per §4. |
| `CENTRAL_APP_RESOLVER_PROVISIONING_IMPLEMENTATION_PROMPT.md` | Implementation has shipped; reader has to know to consult `central_provisioning.js` for the actual code rather than this spec. | Status banner per §4. |
| `CENTRAL_APP_MINIMAL_BETA_PROOF.md` | Reader has to apply the §5.bis override mentally to every reference to "Approach A" in §1–§4. | The existing REVISED banner already mitigates this; §4 proposes a small forward-pointer augmentation. |
| `CENTRAL_APP_BLANK_WORKBOOK_RUNTIME_REPORT.md` | Bound-mode focused; central-mode runtime evidence now lives in a different doc (`CENTRAL_APP_WORKBOOK_CREATION_FIRST_SLICE_PLAN.md → §15`). Reader has to know to consult both. | A small cross-reference at the top of the runtime report pointing to the central-mode §15. Not in the §4 first pass; deferred. |

---

## 8. Suggested cleanup sequence (multi-pass)

The §4 first pass is the only pass authorized by this audit. The sequence below is **not** authorization for any subsequent pass; each requires its own explicit prompt.

| Pass | Scope | Authorization |
|---|---|---|
| **Pass 1 (§4 — first safe pass)** | Add / update status banners on the 4–5 historical-but-banner-less docs. | Authorized by this audit's §4. Requires a separate prompt to actually execute. |
| **Pass 2 (later)** | Add a small "see also" cross-reference block to active docs that have stale outbound references. | Requires its own prompt. |
| **Pass 3 (later)** | Create a `docs/archive/` subdirectory; move the Tier 4 historical docs into it with `git mv` to preserve rename tracking. Update every cross-reference. | Requires its own prompt with explicit per-file move list. Highest-cost pass; should not happen until at least one more central-mode milestone ships (so the archived set is "the previous era" cleanly). |
| **Pass 4 (later)** | Per-doc consolidation: e.g., distill resolver-seam Phases 1, 2, 3, 5, 6 into a single `CENTRAL_APP_RESOLVER_SEAM_HISTORY.md` and archive the originals. | Requires its own prompt with the merge target and the original-doc fate (archive vs absorb) made explicit per file. |
| **Pass 5 (later, optional)** | If the central-mode runtime evidence accumulates beyond §15 (multiple hardening test sessions), spin off a `CENTRAL_APP_CENTRAL_MODE_RUNTIME_REPORT.md` that parallels the bound-mode runtime report. | Requires its own prompt. |

---

## 9. Index conclusion

The Central App / onboarding / beta documentation set has grown organically through six resolver-seam phases, a bootstrap-coverage audit, a runtime-test track, and a four-document central-mode slice authorization. After the 2026-05-28 first-slice runtime confirmation, the set splits cleanly into:

- **14 active sources of truth** that load-bear in-flight work (architecture, contracts, audits still being consulted, planning docs whose next steps are still open).
- **7 historical phase records** that document shipped decisions and should eventually be archived but should not be deleted.
- **2 in-place superseded docs** with audit-trail banners.
- **4 backlog / parallel workstream docs** that are intentionally separate from central-mode work.

The recommended **safe first cleanup pass** adds status banners to the 4–5 historical / superseded docs that don't already carry an accurate one. This is the lowest-risk pass that produces real signal-to-noise improvement and does not foreclose any later pass.

**No file should be deleted at this time. No file should be renamed at this time. No file should be moved at this time.** Every consolidation, archive, or merge decision belongs to its own future prompt.

End of document.
