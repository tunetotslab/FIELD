#!/bin/bash
set -euo pipefail
# Fresh CI Simulator only: never launch this against a user's installed app.
: "${RUNNER_TEMP:?GitHub runner temp directory required}"
app="$RUNNER_TEMP/FieldBuild/Build/Products/Debug-iphonesimulator/App.app"
# Choose an already available runtime/device pairing. Picking the newest device
# type independently can select hardware unsupported by the installed runtime.
xcrun simctl list devices available --json > "$RUNNER_TEMP/field-simulators.json"
pair=$(python3 - "$RUNNER_TEMP/field-simulators.json" <<'PYTHON'
import json,sys
catalogue=json.load(open(sys.argv[1]))["devices"]
for runtime,devices in reversed(list(catalogue.items())):
    if not runtime.startswith("com.apple.CoreSimulator.SimRuntime.iOS-"):continue
    for device in devices:
        if device.get("isAvailable") and device.get("name","").startswith("iPhone") and device.get("deviceTypeIdentifier"):
            print(runtime,device["deviceTypeIdentifier"]);raise SystemExit(0)
raise SystemExit("No compatible installed iPhone Simulator pairing")
PYTHON
)
read -r runtime device_type <<< "$pair"
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
