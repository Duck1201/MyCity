#!/usr/bin/env bash
set -euo pipefail

# Run after installing the signed APK on a test device.
package=br.edu.mycity.app
adb shell am start -S -W -n "$package/.MainActivity" >/dev/null
for ((i = 0; i < 20; i++)); do
    hierarchy=$(adb exec-out uiautomator dump /dev/tty)
    if [[ "$hierarchy" == *"package=\"$package\""* && ( "$hierarchy" == *'Entrar no MyCity'* || "$hierarchy" == *'Meus registros'* ) ]]; then
        exit 0
    fi
    if ! adb shell pidof "$package" >/dev/null; then
        echo 'Application exited before rendering the citizen screen.' >&2
        exit 1
    fi
    sleep 1
done
echo 'The citizen screen did not appear on the device.' >&2
exit 1
