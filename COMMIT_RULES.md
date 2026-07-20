# Git & release workflow

## Rule — commits (non-negotiable)

**Do not run `git add`, `git commit`, or `git push` unless the user explicitly asks to commit in that conversation** (e.g. “commit this”, “commit it”, “stage and commit”). Finishing a task, fixing lints, or updating docs **does not** imply permission. If unsure, leave the working tree unstaged and summarize what changed.

Once the user has approved a commit and the commit succeeded, **also push it to `origin`** on the branch that was just committed, in the same action, so `origin/main` stays in sync. Only push when the branch already has an upstream configured; never force-push without an explicit request; on any push failure, report it and stop (do not retry with `--force`, do not rebase, do not reset).

## Commit message format

Use a concise, specific subject line followed by a useful commit body for every meaningful commit. Do not rely on a one-line message alone.

The commit body should explain, as applicable:

- Why the change was needed or what problem it addresses.
- What changed, including the important files or components.
- Safety and compatibility considerations, especially Central versus bounded workbook impact.
- Tests and validation performed, plus anything that was not tested.
- Deployment, migration, or rollback notes when relevant.

Keep the details relevant and concrete. Documentation-only commits should still state their scope and confirm whether runtime behavior, workbooks, or deployment were affected.

Example:

```bash
git commit -m "Document paid-bill correction roadmap item" \
  -m "Adds the requested ability to correct a previously recorded bill payment to the roadmap, including adjustment, reversal, and duplicate-prevention requirements." \
  -m "Scope: ROADMAP.md only. No runtime behavior, workbook data, or deployment changed."
```

---

1. Change the files needed.
2. **clasp push** (sends this to Google Sheets).
3. **Test** the changes with Deploy in Google Sheets.
4. Update **SESSION_NOTES.md** with a short bullet summary (files + behavior) when you are ready to record the change — usually right before commit.
5. **User-facing dashboard / Help:** When you add or change something users see or need to understand (new page, filters, bills behavior, etc.), update **`Dashboard_Help.html`** (table of contents + section text) in the same change set unless the user says to skip documentation.
6. **Context docs:** When the change affects **high-level product shape** (features list, sheet roles, Activity behavior, Cash Flow naming), update **`PROJECT_CONTEXT.md`** and, if onboarding copy is affected, **`ONBOARDING_TODO.md`**, in the same effort—or leave an explicit note in **SESSION_NOTES.md** to sync next time.
7. **Never commit without explicit approval** — same as the rule at the top; do not commit automatically as part of “done”.

When the user **explicitly** asks to commit: stage only the scoped files, review the staged diff, create a concise subject plus a detailed body following the format above, and then push to the configured upstream.
