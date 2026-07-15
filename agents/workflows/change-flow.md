# CashCompass Change Flow

Use this flow for non-trivial CashCompass changes.

## Flow

1. Engineer
2. Reviewer
3. Tester
4. Validator

## Engineer Phase

Purpose:
- Understand the issue.
- Identify affected files and docs.
- Find root cause before editing.
- Propose the smallest safe fix.
- Implement only approved scope.

Output:
- Root cause
- Proposed fix
- Files changed
- Known risks
- Test notes

## Reviewer Phase

Purpose:
- Review the diff, not the intent.
- Challenge assumptions.
- Look for regressions, data loss, formatting drift, schema risk, and Central/bounded behavior changes.
- Identify must-fix issues before testing.

Output:
- Must-fix issues
- Should-fix issues
- Questions
- Safe-to-test assessment

## Tester Phase

Purpose:
- Convert the change into executable manual or automated test coverage.
- Cover Central and bounded behavior when relevant.
- Include regression and edge cases.

Output:
- Test matrix
- Manual test steps
- Automated test candidates
- Pass/fail criteria

## Validator Phase

Purpose:
- Decide whether the change is ready for commit or deploy.
- Confirm safety rules were followed.
- Confirm docs, tests, rollback notes, and deployment risk are understood.

Output:
- Commit readiness
- Deploy readiness
- Remaining risks
- Required follow-ups

## Hard Rule

Do not skip directly from Engineer to commit or deploy unless explicitly approved.
