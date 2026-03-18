#!/bin/bash
# Start WebDriverAgent + tunnel + port forwarding for mobile-mcp
# Usage: ./scripts/start-wda.sh

set -e

DEVICE_UDID="00008101-0008548422B9003A"
WDA_DIR="/tmp/WebDriverAgent"

echo "=== Starting iOS MCP infrastructure ==="

# 1. Start tunnel (if not running)
if ! pgrep -f "ios tunnel" > /dev/null; then
  echo "[1/3] Starting iOS tunnel..."
  ios tunnel start --userspace &
  sleep 3
else
  echo "[1/3] Tunnel already running"
fi

# 2. Start port forwarding (if not running)
if ! pgrep -f "ios forward 8100" > /dev/null; then
  echo "[2/3] Starting port forwarding 8100..."
  ios forward 8100 8100 &
  sleep 2
else
  echo "[2/3] Port forwarding already running"
fi

# 3. Start WebDriverAgent (if not running)
if ! curl -s http://localhost:8100/status > /dev/null 2>&1; then
  echo "[3/3] Starting WebDriverAgent..."
  cd "$WDA_DIR"
  nohup xcodebuild test-without-building \
    -project WebDriverAgent.xcodeproj \
    -scheme WebDriverAgentRunner \
    -destination "platform=iOS,id=$DEVICE_UDID" \
    > /tmp/wda.log 2>&1 &
  echo "    WDA PID: $!"
  echo "    Waiting for WDA to start..."
  for i in $(seq 1 30); do
    if curl -s http://localhost:8100/status > /dev/null 2>&1; then
      echo "    WDA ready!"
      break
    fi
    sleep 1
  done
else
  echo "[3/3] WDA already running"
fi

# Verify
echo ""
echo "=== Status ==="
curl -s http://localhost:8100/status | python3 -c "
import sys,json
d=json.load(sys.stdin)
v=d['value']
print(f\"WDA: {v['os']['name']} {v['os']['version']}\")
print(f\"Build: {v['build']['version']}\")
" 2>/dev/null || echo "WDA: NOT RESPONDING"
echo ""
echo "Ready for mobile-mcp! Use: mcp__mobile-mcp__mobile_take_screenshot"
