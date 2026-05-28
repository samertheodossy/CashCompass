#!/bin/bash
# Push the current working tree to the CashCompass Central App project.
# The central project uses .clasp-central.json instead of .clasp.json.
#
# IMPORTANT: before running, ensure the working tree contains the
# central-project-specific file variants (see CENTRAL_APP_CENTRAL_PROJECT_SETUP_CHECKLIST.md §6).
# Do NOT run this script from main without first applying per-project edits.
#
# Recommended workflow:
#   git checkout -b central-project-push
#   # apply per-project edits
#   bash push-central.sh
#   git checkout main && git branch -D central-project-push
set -e
clasp push --project .clasp-central.json
