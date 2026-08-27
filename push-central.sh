#!/bin/bash
# Push the same reviewed source to CashCompass Central while substituting only
# Central's capability manifest. The bounded manifest remains untouched.
set -euo pipefail

repo_root="$(cd "$(dirname "$0")" && pwd)"
stage_root="$repo_root/.cashcompass-push/central"
stage_marker="$stage_root/.cashcompass-central-push-stage"

if [[ -e "$stage_root" && ! -f "$stage_marker" ]]; then
  echo "Refusing to replace unverified Central push staging directory: $stage_root" >&2
  exit 1
fi

mkdir -p "$stage_root"
touch "$stage_marker"
rsync -a --delete \
  --exclude '.git/' \
  --exclude '.cashcompass-push/' \
  --exclude '.cashcompass-central-push-stage' \
  --exclude '.cashcompass-admin/' \
  --exclude 'node_modules/' \
  --exclude 'dist/' \
  --exclude 'services/' \
  "$repo_root/" "$stage_root/"
cp "$repo_root/appsscript.central.json" "$stage_root/appsscript.json"
cp "$repo_root/.clasp-central.json" "$stage_root/.clasp.json"

(
  cd "$stage_root"
  clasp push
)
