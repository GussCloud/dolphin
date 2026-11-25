#!/usr/bin/env bash
set -euo pipefail
# Why wait: xvfb-run can return before Xvfb accepts clients; openbox then exits at once with
# "Failed to open the display" and the whole shard dies before any test runs.
display_ready=false
for attempt in {1..100}; do
  if xprop -root >/dev/null 2>&1; then
    display_ready=true
    break
  fi
  sleep 0.1
done
if [ "$display_ready" != true ]; then
  echo "Xvfb display $DISPLAY never accepted connections" >&2
  exit 1
fi
openbox --sm-disable > /tmp/dolphin-e2e-window-manager.log 2>&1 &
wm_pid=$!
cleanup() {
  kill "$wm_pid" 2>/dev/null || true
  wait "$wm_pid" 2>/dev/null || true
}
trap cleanup EXIT
ready=false
for attempt in {1..100}; do
  if xprop -root _NET_SUPPORTING_WM_CHECK 2>/dev/null | rg -q 'window id # 0x[1-9a-fA-F]'; then
    ready=true
    break
  fi
  if ! kill -0 "$wm_pid" 2>/dev/null; then
    cat /tmp/dolphin-e2e-window-manager.log
    exit 1
  fi
  sleep 0.1
done
if [ "$ready" != true ]; then
  echo 'Window manager did not acquire the Xvfb root window' >&2
  exit 1
fi
"$@"
