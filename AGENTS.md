# CashCompass AI Agent Entry Point

This repository supports tool-neutral AI agents for engineering, review, testing, and validation.

These files are instructions only. They must not change runtime behavior, deployment behavior, workbook schemas, or user data by themselves.

## Agent Files

- Shared rules: `agents/shared.md`
- Engineering philosophy: `agents/engineering-philosophy.md`
- Knowledge map: `agents/knowledge-map.md`
- Orchestrator: `agents/orchestrator.md`
- Artifact definitions: `agents/artifacts.md`
- Planner role: `agents/planner.md`
- Engineer role: `agents/engineer.md`
- Reviewer role: `agents/reviewer.md`
- Tester role: `agents/tester.md`
- Validator role: `agents/validator.md`

## Default Startup

Before doing work:

1. Read `agents/shared.md`.
2. Read `agents/engineering-philosophy.md`.
3. Read `agents/knowledge-map.md`.
4. Read `agents/orchestrator.md` for end-to-end tasks.
5. Read `agents/artifacts.md` for phase handoffs.
6. Read `agents/workflows/change-flow.md` for non-trivial changes.
7. Read the role-specific file if a role is named.
8. If no role is named, default to `agents/engineer.md`.
9. Discover relevant project documentation before making assumptions.

## Knowledge Discovery

Start with:
- `PROJECT_CONTEXT.md`
- `ENGINEERING_STANDARDS.md`
- `WORKING_RULES.md`

Then read only task-relevant documents, such as:
- `CENTRAL_APP_*.md` for Central App work
- `VALIDATOR_*.md` for validator work
- `REGRESSION_*.md` for regression work
- `TEST_HARNESS_*.md` or `TESTING_PLAN.md` for testing work
- `COMMIT_RULES.md` and `RELEASE_READINESS.md` for commit/deploy readiness

Do not blindly read or rewrite every Markdown file.

## Hard Stops

- No commits unless explicitly approved.
- No deploys unless explicitly approved.
- No destructive workbook changes unless explicitly approved.
- No schema rewrites, formatting washes, or broad migrations unless explicitly approved.
