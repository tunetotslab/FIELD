#!/bin/bash
set -euo pipefail
# Fresh CI Simulator only: never launch this against a user's installed app.
: "${RUNNER_TEMP:?GitHub runner temp directory required}"
app="$RUNNER_TEMP/FieldBuild/Build/Products/Debug-iphonesimulator/App.app"
runtime=$(xcrun simctl list runtimes --json | python3 -c 'import json,sys; r=[x for x in json.load(sys.stdin)["runtimes"] if x.get("isAvailable") and x["identifier"].startswith("com.apple.CoreSimulator.SimRuntime.iOS-")]; assert r,"No iOS Simulator runtime"; print(r[-1]["identifier"])')
device_type=$(xcrun simctl list devicetypes --json | python3 -c 'import json,sys; r=[x for x in json.load(sys.stdin)["devicetypes"] if x["name"].startswith("iPhone")]; assert r; print(r[-1]["identifier"])')
simulator=$(xcrun simctl create 'FIELD CI verification' "$device_type" "$runtime")
trap 'xcrun simctl shutdown "$simulator" >/dev/null 2>&1 || true; xcrun simctl delete "$simulator" >/dev/null 2>&1 || true' EXIT
xcrun simctl boot "$simulator"
xcrun simctl bootstatus "$simulator" -b
xcrun simctl install "$simulator" "$app"
xcrun simctl launch "$simulator" lab.tunetots.field --field-ci-smoke
container=$(xcrun simctl get_app_container "$simulator" lab.tunetots.field data)
report="$container/Library/Application Support/FIELD-ci-smoke.json"
for attempt in {1..60}; do
  if [ -f "$report" ]; then
    cp "$report" "$RUNNER_TEMP/FIELD-ci-smoke.json"
    xcrun simctl io "$simulator" screenshot "$RUNNER_TEMP/FIELD-simulator.png"
    python3 -c 'import json,sys; data=json.load(open(sys.argv[1])); print(data); assert data.get("ok"),data' "$report"
    exit 0
  fi
  sleep 2
done
xcrun simctl io "$simulator" screenshot "$RUNNER_TEMP/FIELD-simulator.png"
echo 'FIELD Simulator bridge/UI smoke timed out' >&2
exit 1
