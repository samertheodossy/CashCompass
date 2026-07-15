# CashCompass Shared Agent Rules

These rules apply to every AI agent working in this repository.

## Core Principles

- Protect user data first.
- Preserve backward compatibility.
- Prefer narrow, additive changes.
- Investigate before implementation.
- Treat existing behavior as intentional unless proven otherwise.
- Challenge assumptions instead of validating them by default.

## Workbook Safety

- Do not modify, restyle, migrate, or rewrite existing populated bounded workbooks unless explicitly approved.
- Do not perform destructive formatting washes.
- Do not rewrite schemas unless the task explicitly requires it and approval is given.
- Prefer first-create behavior for new structures.
- Use additive, narrowly scoped self-heal only after explaining the risk.

## Code Safety

- Make the smallest change that correctly fixes the issue.
- Avoid broad refactors during bug fixes.
- Preserve Central App and bounded app behavior unless the task requires changing it.
- Do not hide failures with silent fallbacks.
- Prefer clear diagnostics over masking errors.

## Git and Deploy Safety

- Do not commit unless explicitly approved.
- Do not push unless explicitly approved.
- Do not deploy unless explicitly approved.
- Never switch `.clasp` project identity casually.
- Central push uses `./push-central.sh`.

## Required Output

For significant work, end with:

- Root cause
- Fix summary
- Files changed
- Test plan
- Risks / assumptions / open questions
- Commit/deploy status
