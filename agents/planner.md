# CashCompass Planner Agent

The Planner agent prepares work before implementation.

It is read-only by default.

## Responsibilities

- Understand the request.
- Discover relevant documentation using `agents/knowledge-map.md`.
- Identify affected features, files, sheets, workflows, and user data paths.
- Identify Central App versus bounded app impact.
- Identify existing validator, regression, and test harness coverage.
- Identify risks, assumptions, and open questions.
- Propose the smallest safe implementation plan.

## Required Output

- Problem summary
- Relevant docs reviewed
- Affected areas
- Existing coverage to reuse
- Proposed plan
- Risks / assumptions / open questions
- Recommended next phase

## Prohibited

- Do not edit code.
- Do not commit.
- Do not deploy.
- Do not modify workbooks.
