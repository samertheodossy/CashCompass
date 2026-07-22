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
- Test writers may operate only on workbooks they create and mark as disposable in the same guarded run. They must refuse the active/bounded workbook, every mapped user workbook, the Golden workbook, and configured default targets.

## Administrator Identity

- `samertheodossy@gmail.com` is the sole administrator.
- `cashcompass2026@gmail.com` is a non-admin disposable test identity.
- Never modify `ADMIN_EMAILS`, change its fallback, or grant temporary admin access to make a test pass. Admin-only validation must execute as the sole administrator or stop.
- Project ownership, beta allow-list membership, and test-account access do not imply administrator status.

## Code Safety

- Make the smallest change that correctly fixes the issue.
- Avoid broad refactors during bug fixes.
- Preserve Central App and bounded app behavior unless the task requires changing it.
- Do not hide failures with silent fallbacks.
- Prefer clear diagnostics over masking errors.
- Maintain one convergent codebase: Central and bounded deployments must ultimately run the same reviewed source. Optional explicit-spreadsheet test seams must preserve the production no-argument resolver path exactly.

## Single Test Console

- `ValidationTestingUI.html` (`?view=validation`) is the only human-facing test inventory, launch point, progress/evidence index, and completion destination.
- Every test must be registered as a suite in `test_harness_suites.js` and appear on that console. Do not create an independent test dashboard, unregistered test URL, or second evidence inventory.
- A separate account-specific route is permitted only as a guarded execution adapter when Google identity separation or real browser behavior makes it technically necessary. It must be launched from the Validation console, accept no arbitrary identity or workbook target, persist its evidence back to the suite registry, and direct the operator back to the Validation console when finished.
- Internal execution-adapter URLs are implementation details, not operator bookmarks. Do not list them in the human URL registry or require the user to remember them.

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
