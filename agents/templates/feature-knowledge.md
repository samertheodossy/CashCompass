# CashCompass Feature Knowledge Template

Use this template for every CashCompass feature expert knowledge document.

Copy it to `agents/features/<feature-slug>.md`, replace all bracketed placeholders, and remove instructional text that does not belong in the completed document. Complete every required section; write `Not applicable` with a short reason when a section does not apply.

## Knowledge Contract

- Treat repository evidence and runtime-validated behavior as authoritative; do not present assumptions as facts.
- Cite exact files, functions, sheets, routes, tests, and decision records wherever practical.
- Link to volatile roadmap, release, and status documents instead of copying information that will drift.
- Distinguish current behavior, planned behavior, historical context, and unresolved questions.
- Preserve secrets and user privacy. Never include credentials, deployment secrets, personal financial data, user email addresses, or workbook identifiers.
- Update `agents/knowledge-map.md` when a new feature knowledge document is added.
- Mark the document `STALE` when material behavior changes and the document has not yet been re-verified.

---

# [Feature Name]

## 1. Knowledge Metadata

| Field | Value |
| --- | --- |
| Feature slug | `[feature-slug]` |
| Domain | [Bills / Debts / Cash Flow / Central App / other] |
| Knowledge status | `DRAFT` / `VERIFIED` / `STALE` / `DEPRECATED` |
| Product status | [Planned / Flagged / Beta / Shipped / Deprecated] |
| Feature expert | [Role or owner; do not include personal data unnecessarily] |
| Last verified date | `YYYY-MM-DD` |
| Last verified Git reference | [Commit SHA or branch reference] |
| Applies to | [Central App / bounded app / both] |
| Primary user surfaces | [Dashboard pages, dialogs, sheets, admin routes] |
| Canonical source documents | [Links to authoritative repository documents] |

### Knowledge status rules

- `DRAFT`: Discovery is incomplete or material claims remain unverified.
- `VERIFIED`: All required sections are supported by current repository evidence and relevant tests or runtime observations.
- `STALE`: A material implementation or product decision changed after the last verification.
- `DEPRECATED`: The feature is no longer active; the document remains only for historical or migration context.

## 2. Feature Summary

### User promise

[In one or two sentences, explain the user outcome this feature exists to provide.]

### Current behavior

[Describe what the feature does today. Do not mix planned behavior into this section.]

### Business and financial significance

[Explain why correctness matters, including any effect on financial decisions, user trust, or release readiness.]

## 3. Scope and Boundaries

### In scope

- [Capability]

### Out of scope

- [Explicit non-goal or adjacent feature]

### Planned but not implemented

- [Future behavior, linked to its authoritative roadmap or plan]

### Intentional constraints

- [Product or engineering constraint that must not be “fixed” accidentally]

## 4. Authoritative Evidence

List the minimum evidence needed to re-establish expertise without reading the whole repository.

| Subject | Authoritative source | Evidence type | Last verified |
| --- | --- | --- | --- |
| Product behavior | [File and section] | Decision / specification / runtime evidence | `YYYY-MM-DD` |
| Implementation | [File and function] | Source code | `YYYY-MM-DD` |
| Workbook contract | [File, sheet, or validator rule] | Schema / runtime evidence | `YYYY-MM-DD` |
| Tests | [Scenario, harness, or test file] | Automated / manual | `YYYY-MM-DD` |

When sources disagree, apply the instruction precedence in `AGENTS.md`, record the conflict under Open Questions, and do not silently choose a convenient interpretation.

## 5. User Experience and Workflows

### Entry points

| Entry point | User | Preconditions | Result |
| --- | --- | --- | --- |
| [Dashboard route, button, sheet, or admin URL] | [User type] | [Required state] | [Expected destination or action] |

### Primary workflow

1. [User action]
2. [System response]
3. [Persisted effect]
4. [Visible confirmation]

### Alternate and edge workflows

- Blank or freshly provisioned workbook: [Expected behavior]
- Existing populated workbook: [Expected behavior and preservation requirements]
- Central App: [Behavior]
- Bounded app: [Behavior]
- Empty, stale, duplicate, or invalid input: [Behavior]
- Retry, concurrent action, or repeated execution: [Behavior]

## 6. Domain Vocabulary

| Term | Canonical meaning | Common confusion to avoid |
| --- | --- | --- |
| [Term] | [Definition] | [Incorrect interpretation] |

## 7. Architecture and Data Flow

### Component map

| Layer | Files / components | Responsibility |
| --- | --- | --- |
| UI | [Files] | [Responsibility] |
| Client logic | [Files/functions] | [Responsibility] |
| Server logic | [Files/functions] | [Responsibility] |
| Persistence | [Sheets/properties/Drive resources] | [Responsibility] |
| Diagnostics / validation | [Files/functions] | [Responsibility] |

### Request and write path

1. [Entry point]
2. [Client/server boundary]
3. [Resolver or service]
4. [Read/calculation/write]
5. [Response and UI update]

### Dependencies

- Upstream dependencies: [What must exist or be correct first]
- Downstream consumers: [What reads or relies on this feature]
- Shared helpers: [Existing infrastructure that must be reused]
- External services: [Apps Script services, APIs, or none]

## 8. Data and Workbook Contract

### Read/write inventory

| Store or sheet | Reads | Writes | Ownership | Safety notes |
| --- | --- | --- | --- | --- |
| [Sheet, property, cache, or Drive resource] | [Range/fields] | [Range/fields] | [Feature/shared/external] | [Mutation restrictions] |

### Schema and semantics

| Field / column | Type or format | Meaning | Required | Default / fallback | Validation |
| --- | --- | --- | --- | --- | --- |
| [Name] | [Type] | [Meaning] | Yes / No | [Value] | [Rule] |

### Workbook invariants

- [Data, formula, formatting, ordering, identity, or idempotency rule]
- [What must remain unchanged in populated workbooks]
- [First-create behavior versus safe schema-evolution behavior]

## 9. Behavioral and Financial Invariants

Number each invariant so reviews and tests can reference it.

1. **[Invariant name]:** [Rule that must always hold.]
2. **[Invariant name]:** [Rule that must always hold.]

For calculated features, include units, sign conventions, rounding, date/timezone rules, recurrence rules, deduplication, and the authoritative calculation basis.

## 10. State and Lifecycle

| State | Entry condition | Allowed actions | Exit condition | Persisted evidence |
| --- | --- | --- | --- | --- |
| [State] | [Condition] | [Actions] | [Transition] | [Marker/log/field] |

Document create, read, update, deactivate, reactivate, delete or soft-delete, recovery, and retry behavior when applicable.

## 11. Access, Configuration, and Feature Flags

| Control | Default | Scope | Failure mode | Safe operating rule |
| --- | --- | --- | --- | --- |
| [Flag, allow-list, admin check, script property] | [Value] | [Users/environment] | [Fail open/closed] | [Rule] |

Include authorization boundaries, Central-versus-bounded routing, deployment-specific configuration, and any disposable-account requirement.

## 12. Failure, Recovery, and Diagnostics

| Failure | User-visible behavior | Diagnostic evidence | Recovery | Data risk |
| --- | --- | --- | --- | --- |
| [Failure mode] | [Message/state] | [Log, validator, admin diagnostic] | [Safe recovery] | Low / Medium / High |

State which failures are retryable, which require user action, which require admin action, and which must stop the workflow.

## 13. Compatibility and Migration

- Previous behavior: [Summary]
- Current behavior: [Summary]
- Backward-compatibility contract: [Guarantee]
- Existing populated workbook impact: [None or explicitly approved change]
- Fresh workbook impact: [Behavior]
- Migration or self-heal behavior: [Additive, idempotent, narrowly scoped details]
- Rollback limitations: [What cannot be automatically reversed]

## 14. Testing and Validation

### Existing coverage

| Coverage type | Identifier / file | What it proves | Current result |
| --- | --- | --- | --- |
| Validator | [Rule/runner] | [Invariant] | PASS / FAIL / Not run |
| Regression | [REG-###] | [Historical bug or workflow] | PASS / FAIL / Not run |
| Harness | [Scenario] | [Integration behavior] | PASS / FAIL / Not run |
| Manual | [Checklist/report] | [Runtime behavior] | PASS / FAIL / Not run |

### Minimum change test matrix

- Blank or freshly provisioned workbook
- Existing populated workbook
- Central App and bounded app when both are affected
- Happy path, edge cases, failure path, and retry/idempotency
- Financial invariant or reconciliation checks when calculations are involved
- Permission and feature-flag checks when access controls are involved

### Known coverage gaps

- [Gap, risk, and planned owner/source-of-truth link]

## 15. Operations, Release, and Rollback

- Pre-release checks: [Validator, harness, runtime, documentation]
- Push target: [Bound / Central / Git only / Not applicable]
- Deployment target: [Target or Not applicable]
- Post-deployment smoke checks: [Checks]
- Observability: [Logs, diagnostics, reports]
- Rollback procedure: [Revert, flag-off, deployment rollback, or data repair]
- Actions requiring separate approval: [Workbook mutation / commit / push / deployment]

Do not treat readiness as approval. Report commit, push, and deployment readiness separately under the Engineering OS.

## 16. Decisions and Rejected Alternatives

| Decision | Rationale | Rejected alternative | Source |
| --- | --- | --- | --- |
| [Decision] | [Why] | [Alternative and why rejected] | [Decision record] |

Record only decisions needed to prevent future regressions or repeated debate. Keep general history in the existing project history sources.

## 17. Risks, Assumptions, and Open Questions

### Risks

- [Risk, likelihood, impact, mitigation]

### Assumptions requiring verification

- [Assumption and evidence needed]

### Open questions

- [Question, decision owner, and blocking status]

## 18. Change Impact Checklist

Before changing this feature, determine whether the change affects:

- [ ] User-visible behavior or Help content
- [ ] Central App behavior
- [ ] Bounded app behavior
- [ ] Existing populated workbooks
- [ ] Fresh provisioning or first-create behavior
- [ ] Workbook schema, formulas, formatting, or validation
- [ ] Financial calculations or reconciliation
- [ ] Activity Log or audit history
- [ ] Permissions, feature flags, or admin controls
- [ ] Validators, regression scenarios, or test harness coverage
- [ ] Documentation, roadmap, release readiness, or rollback notes

## 19. Feature Expert Answer Contract

When answering questions or handing off work, the feature expert must:

1. Lead with the current verified behavior.
2. Cite the supporting file, function, sheet, scenario, or runtime evidence.
3. Label planned behavior and assumptions explicitly.
4. State Central App, bounded app, and workbook impact when relevant.
5. Identify safety risks and approval gates before proposing mutation.
6. Call out stale or conflicting knowledge instead of guessing.
7. Recommend the smallest safe next step and the existing coverage to reuse.

## 20. Maintenance and Completion

### Refresh triggers

Re-verify this document when any of the following changes:

- User workflow or UI entry point
- Source files, public functions, or data flow
- Workbook schema, formulas, formatting, or ownership
- Financial semantics or invariants
- Feature flags, permissions, provisioning, or recovery behavior
- Validator, regression, harness, or release requirements
- Product decision, compatibility contract, or deprecation status

### Verification checklist

- [ ] All bracketed placeholders are replaced.
- [ ] Every required section is complete or explains why it is not applicable.
- [ ] Current and planned behavior are separated.
- [ ] Material claims cite repository or runtime evidence.
- [ ] Central and bounded behavior are addressed.
- [ ] Populated-workbook safety and first-create behavior are addressed.
- [ ] Invariants map to tests or explicitly listed coverage gaps.
- [ ] Failure, recovery, diagnostics, and rollback are documented.
- [ ] Secrets and user data are absent.
- [ ] Metadata contains a verification date and Git reference.
- [ ] `agents/knowledge-map.md` links to the completed feature document.

Knowledge status may be set to `VERIFIED` only after this checklist passes.
