#!/bin/sh
# cowork-plugin-shim.sh — Plugin permission bridge for Cowork sessions
#
# Called by plugin code inside a session to request tool permissions.
# Communicates with the host via filesystem IPC:
#   writes JSON request  -> .cowork-perm-req/<id>
#   reads  text response <- .cowork-perm-resp/<id>
#
# Usage: shim.sh <plugin> <op> <argv>
# Exit: 0 = allow, 1 = deny/timeout

set -e

PLUGIN="$1"
OP="$2"
shift 2
ARGV="$*"

if [ -z "$PLUGIN" ] || [ -z "$OP" ]; then
  echo "Usage: $0 <plugin> <op> [argv...]" >&2
  exit 1
fi

# Resolve request/response dirs relative to the script's location.
# The script lives at .cowork-lib/shim.sh inside the session mnt/.
# Sibling mounts: .cowork-perm-req/ and .cowork-perm-resp/
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REQ_DIR="$SCRIPT_DIR/../.cowork-perm-req"
RESP_DIR="$SCRIPT_DIR/../.cowork-perm-resp"

# Generate a unique request ID
if [ -f /proc/sys/kernel/random/uuid ]; then
  REQ_ID=$(cat /proc/sys/kernel/random/uuid)
else
  REQ_ID="$(date +%s)-$$-$(od -An -N8 -tx1 /dev/urandom 2>/dev/null | tr -d ' \n' || echo fallback)"
fi

# Escape strings for JSON (handle backslash, double-quote, newline)
json_escape() {
  printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g' -e ':a' -e 'N' -e '$!ba' -e 's/\n/\\n/g'
}

PLUGIN_ESC=$(json_escape "$PLUGIN")
OP_ESC=$(json_escape "$OP")
ARGV_ESC=$(json_escape "$ARGV")

# Write the request
printf '{"plugin":"%s","op":"%s","argv":"%s"}\n' "$PLUGIN_ESC" "$OP_ESC" "$ARGV_ESC" > "$REQ_DIR/$REQ_ID"

# Poll for response (timeout after 30s)
TIMEOUT=30
ELAPSED=0
while [ $ELAPSED -lt $TIMEOUT ]; do
  if [ -f "$RESP_DIR/$REQ_ID" ]; then
    RESPONSE=$(cat "$RESP_DIR/$REQ_ID" 2>/dev/null || echo "deny")
    # First line is the decision
    DECISION=$(echo "$RESPONSE" | head -n1)
    if [ "$DECISION" = "allow" ]; then
      exit 0
    else
      exit 1
    fi
  fi
  sleep 0.1
  ELAPSED=$((ELAPSED + 1))
done

# Timeout — deny by default
echo "shim: permission request timed out" >&2
exit 1
