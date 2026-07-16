# CashCompass Initiative Knowledge Template

Use this template for CashCompass initiative documents that connect roadmap priorities to designs, features, validation evidence, and executable work.

Copy it to `agents/initiatives/<initiative-slug>.md`, replace every bracketed placeholder, and update `agents/knowledge-map.md`. Initiative documents are navigation and coordination artifacts. They must link to authoritative sources instead of duplicating volatile roadmaps, task lists, implementation status, or release evidence.

## Operating Rules

- `ROADMAP.md` controls current priority and sequence.
- `TODO.md` controls detailed maturity-stage work items and testing inventories.
- `PROJECT_CONTEXT.md` controls current technical status.
- Design documents control approved architecture and implementation intent.
- Feature knowledge documents describe how individual features currently work.
- Initiative documents summarize relationships among those sources; they do not replace them.
- Do not invent completion percentages, dates, owners, blockers, or readiness claims.
- When sources disagree, record the conflict and follow the instruction precedence in `AGENTS.md`.
- Initiative readiness never implies authorization to edit code, mutate workbooks, commit, push, or deploy.

---

## 1. Initiative Metadata

| Field | Value |
| --- | --- |
| Initiative | [Name] |
| Initiative slug | `[initiative-slug]` |
| Priority | [P0 / P1 / P2 / P3 / P4] |
| Initiative status | `PLANNED` / `ACTIVE` / `BLOCKED` / `COMPLETE` / `DEFERRED` |
| Knowledge status | `DRAFT` / `VERIFIED` / `STALE` / `DEPRECATED` |
| Last reviewed date | `YYYY-MM-DD` |
| Last reviewed Git reference | `[commit]` |
| Authoritative priority source | [`ROADMAP.md`](../../ROADMAP.md) → [section] |

## 2. Mission and Outcome

### Mission

[Why this initiative exists.]

### Intended outcome

[Observable result that closes the initiative.]

### Why now

[Roadmap reason this initiative has its current priority.]

## 3. Scope and Boundaries

### In scope

- [Workstream or outcome]

### Out of scope

- [Related work intentionally deferred]

## 4. Source-of-Truth Map

| Subject | Authoritative source | What it controls |
| --- | --- | --- |
| Priority and sequence | [`ROADMAP.md`](../../ROADMAP.md) → [section] | [Authority] |
| Detailed work | [`TODO.md`](../../TODO.md) → [section] | [Authority] |
| Technical status | [`PROJECT_CONTEXT.md`](../../PROJECT_CONTEXT.md) → [section] | [Authority] |
| Architecture / design | [Linked design document] | [Authority] |
| Validation / release evidence | [Linked validation document] | [Authority] |

## 5. Workstreams and Roadmap Links

Keep this table concise. Link to detailed work instead of copying its entire checklist.

| Workstream | Source | Source-reported status | Completion evidence |
| --- | --- | --- | --- |
| [Workstream] | [Document and section] | `PLANNED` / `ACTIVE` / `IN_PROGRESS` / `BLOCKED` / `COMPLETE` / `UNKNOWN` | [Required evidence or source] |

Use `ACTIVE` when the authoritative roadmap places a workstream inside the current initiative but does not report that its execution is underway. Use `IN_PROGRESS` only when an authoritative source explicitly reports active execution.

## 6. Related Designs and Decisions

| Document | Relationship | Status or decision needed |
| --- | --- | --- |
| [Design document] | [Why it matters] | [Current / planned / conflict / unknown] |

## 7. Related Features

| Feature | Knowledge document | Initiative relationship |
| --- | --- | --- |
| [Feature] | [Feature knowledge link or `Not yet created`] | [Dependency or outcome] |

## 8. Dependencies and Sequencing

- Upstream dependencies: [What must be complete first]
- Downstream initiatives: [What this initiative unlocks]
- Required ordering: [Milestone or workstream sequence]
- Parallel work allowed: [Only explicitly compatible work]

## 9. Risks, Blockers, and Source Conflicts

### Risks and blockers

- [Risk or blocker, evidence, and mitigation]

### Source conflicts

| Conflict | Sources | Governing interpretation | Follow-up |
| --- | --- | --- | --- |
| [Conflict or `None found`] | [Sources] | [Interpretation under precedence rules] | [Action or none] |

## 10. Completion Criteria

- [ ] [Criterion tied to authoritative evidence]
- [ ] Roadmap and technical-status documents agree that the initiative is complete.
- [ ] Required validation and release evidence is recorded.
- [ ] Deferred work is explicitly routed to its next authoritative milestone.

Do not mark the initiative `COMPLETE` solely because its coordination document is structurally complete.

## 11. Recommended Next Task

- Task: [Smallest safe next task]
- Why this task: [Priority/dependency rationale]
- Required role flow: [Planner → Engineer → Reviewer → Tester → Validator, or justified shortcut]
- Approval gates: [Any workbook, commit, push, or deployment approvals]

## 12. Maintenance

Re-review this document when:

- `ROADMAP.md` changes initiative priority or sequence.
- `TODO.md` changes a linked work item or maturity stage.
- `PROJECT_CONTEXT.md` changes current technical status.
- A related design, feature, Validator, harness, or release artifact changes materially.
- The initiative becomes blocked, completes, or hands off to the next milestone.
