#!/usr/bin/env bash
# READ-ONLY production cutover preflight. No deployments, writes or deletions.
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ -n "${FIRESTORE_EMULATOR_HOST:-}" || -n "${FIREBASE_AUTH_EMULATOR_HOST:-}" ]]; then
  echo "STOP: unset emulator environment variables before auditing production."
  exit 1
fi
python3 <<'PY'
import datetime
import json
import os
import pathlib
import subprocess
import urllib.error
import urllib.request

PROJECT = "timbersmithapp"
API = "https://firebaserules.googleapis.com/v1/"
os.umask(0o077)
token = subprocess.check_output(
    ["gcloud", "auth", "print-access-token", "--quiet"], text=True
).strip()
if not token:
    raise SystemExit("Could not obtain a Google Cloud access token.")

def get(path):
    req = urllib.request.Request(
        API + path,
        headers={"Authorization": "Bearer " + token, "Accept": "application/json"},
        method="GET",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            return json.load(response)
    except urllib.error.HTTPError as error:
        raise SystemExit(f"Rules read failed: HTTP {error.code}. Check Rules Viewer permissions.") from None

release = get(f"projects/{PROJECT}/releases/cloud.firestore")
ruleset_name = release.get("rulesetName", "")
if not ruleset_name.startswith(f"projects/{PROJECT}/rulesets/"):
    raise SystemExit("Unexpected ruleset project; stopping.")
ruleset = get(ruleset_name)
sources = ruleset.get("source", {}).get("files", [])
if not sources:
    raise SystemExit("No source files in the active ruleset.")
stamp = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%d-%H%M%S")
backup = pathlib.Path.home() / "TSJ-Backups" / ("managed-rules-" + stamp)
backup.mkdir(parents=True, exist_ok=False)
(backup / "release.json").write_text(json.dumps(release, indent=2))
(backup / "ruleset.json").write_text(json.dumps(ruleset, indent=2))
print("=== ACTIVE PRODUCTION FIRESTORE RULES ===")
print("Project:", PROJECT)
print("Ruleset:", ruleset_name)
print("Backup:", backup)
for i, source in enumerate(sources, 1):
    name = pathlib.Path(source.get("name") or f"source-{i}.rules").name
    text = source.get("content", "")
    (backup / f"{i}-{name}").write_text(text)
    print(f"\n--- {name} ---\n{text}")
print("\n=== RULES READ COMPLETE; NO FIREBASE DATA CHANGED ===")
PY
printf '\n=== CANONICAL USER MIGRATION READ-ONLY AUDIT ===\n'
GOOGLE_CLOUD_PROJECT_ID=timbersmithapp FIREBASE_PROJECT_ID=timbersmithapp \
  ./node_modules/.bin/tsx scripts/audit-managed-user-migration.ts
printf '\n=== PREFLIGHT COMPLETE: NO PRODUCTION WRITES ===\n'
