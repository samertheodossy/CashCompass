1. Change the files needed.
2. **clasp push** (sends this to Google Sheets).
3. **Test** the changes with Deploy in Google Sheets.
4. Update **SESSION_NOTES.md** with a short bullet summary (files + behavior) when you are ready to record the change — usually right before commit.
5. **Do not `git add` / `git commit` unless the user explicitly asks** (after they have tested). Never commit automatically as part of finishing a task.

When the user asks to commit: `git add .` then `git commit -m "Comment on changes"`.
