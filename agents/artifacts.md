# CashCompass Agent Artifacts

This document defines the structured outputs passed between agents.

Agents should preserve context from earlier phases instead of rediscovering everything from scratch.

---

# Planner Artifact

Produced by: Planner  
Consumed by: Engineer

Must include:

- Task summary
- Relevant docs reviewed
- Affected features
- Affected files / sheets / workflows
- Existing validator or test harness coverage
- Proposed implementation plan
- Risks / assumptions / open questions
- Recommended next phase

---

# Engineer Artifact

Produced by: Engineer  
Consumed by: Reviewer

Must include:

- Root cause
- Implementation summary
- Files changed
- Functions / workflows changed
- Behavior before
- Behavior after
- Existing infrastructure reused
- Known risks
- Suggested next phase

---

# Review Artifact

Produced by: Reviewer  
Consumed by: Tester

Must include:

- Must-fix issues
- Should-fix issues
- Regression risks
- Workbook safety concerns
- Central App / bounded app concerns
- Safe-to-test assessment
- Suggested next phase

---

# Test Artifact

Produced by: Tester  
Consumed by: Validator

Must include:

- Affected workflows
- Existing tests / validators reused
- Manual test steps
- Automated test candidates
- Pass/fail criteria
- Test results when available
- Remaining test gaps
- Suggested next phase

---

# Validation Artifact

Produced by: Validator  
Consumed by: User

Must include:

- Commit readiness
- Push readiness
- Deploy readiness
- Evidence reviewed
- Required follow-ups
- Remaining risks
- Rollback considerations
- Final recommendation

---

# Handoff Rule

Each agent must clearly state:

- Phase status: COMPLETE / BLOCKED / NEEDS_USER_DECISION
- Suggested next phase
- What information should be passed forward

Phase statuses route according to `agents/orchestrator.md` and must not be treated as interchangeable.
