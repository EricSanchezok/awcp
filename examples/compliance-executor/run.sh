#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

export SCENARIO_DIR="${SCENARIO_DIR:-$SCRIPT_DIR}"
export PORT="${PORT:-10300}"
export SYNERGY_URL="${SYNERGY_URL:-http://localhost:2026}"
export LOG_FILE="${LOG_FILE:-$SCRIPT_DIR/logs/executor.log}"
export STAMP_IMAGE="${STAMP_IMAGE:-$SCRIPT_DIR/assets/official_stamp.png}"

mkdir -p "$SCRIPT_DIR/logs" "$SCRIPT_DIR/workdir" "$SCRIPT_DIR/temp"

echo "Starting Compliance Executor..."
echo "  Port:    $PORT"
echo "  Synergy: $SYNERGY_URL"
echo "  Stamp:   $STAMP_IMAGE"
echo "  Log:     $LOG_FILE"

node dist/agent.js
