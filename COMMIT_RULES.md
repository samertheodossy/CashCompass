# Git & release workflow

## Rule — commits (non-negotiable)

**Do not run `git add`, `git commit`, or `git push` unless the user explicitly asks to commit in that conversation** (e.g. “commit this”, “commit it”, “stage and commit”). Finishing a task, fixing lints, or updating docs **does not** imply permission. If unsure, leave the working tree unstaged and summarize what changed.

---

1. Change the files needed.
2. **clasp push** (sends this to Google Sheets).
3. **Test** the changes with Deploy in Google Sheets.
4. Update **SESSION_NOTES.md** with a short bullet summary (files + behavior) when you are ready to record the change — usually right before commit.
5. **User-facing dashboard / Help:** When you add or change something users see or need to understand (new page, filters, bills behavior, etc.), update **`Dashboard_Help.html`** (table of contents + section text) in the same change set unless the user says to skip documentation.
6. **Context docs:** When the change affects **high-level product shape** (features list, sheet roles, Activity behavior, Cash Flow naming), update **`PROJECT_CONTEXT.md`** and, if onboarding copy is affected, **`ONBOARDING_TODO.md`**, in the same effort—or leave an explicit note in **SESSION_NOTES.md** to sync next time.
7. **Never commit without explicit approval** — same as the rule at the top; do not commit automatically as part of “done”.

When the user **explicitly** asks to commit: `git add` (scoped files as appropriate) then `git commit -m "Comment on changes"`.
