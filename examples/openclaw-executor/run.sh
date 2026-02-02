#!/bin/bash
# OpenClaw Executor - One-click startup script
#
# Prerequisites:
#   - Node.js >= 22
#   - OpenClaw installed: npm install -g openclaw@latest
#   - API key: ANTHROPIC_API_KEY or OPENAI_API_KEY
#
# Usage:
#   ./run.sh
#   PORT=10200 ./run.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$SCRIPT_DIR"

# Port configuration (default: 10200)
EXECUTOR_PORT="${PORT:-10200}"
OPENCLAW_PORT="${OPENCLAW_PORT:-18789}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

cleanup() {
  echo -e "\n${YELLOW}Cleaning up...${NC}"
  [ -n "$EXECUTOR_PID" ] && kill $EXECUTOR_PID 2>/dev/null || true
  echo -e "${GREEN}✓ Cleanup complete${NC}"
}
trap cleanup EXIT

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║         OpenClaw Executor Agent                            ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check for API keys
if [ -z "$ANTHROPIC_API_KEY" ] && [ -z "$OPENAI_API_KEY" ] && [ -z "$OPENROUTER_API_KEY" ] && [ -z "$DEEPSEEK_API_KEY" ]; then
  echo -e "${YELLOW}⚠️  No AI API key found. Set one of:${NC}"
  echo "   - ANTHROPIC_API_KEY"
  echo "   - OPENAI_API_KEY"
  echo "   - OPENROUTER_API_KEY   (supports DeepSeek, Llama, etc.)"
  echo "   - DEEPSEEK_API_KEY     (direct DeepSeek API)"
  echo ""
fi

# Check OpenClaw installation
if ! command -v openclaw &> /dev/null; then
  echo -e "${RED}❌ OpenClaw not found. Install with:${NC}"
  echo "   npm install -g openclaw@latest"
  echo ""
  echo "   For more info: https://docs.openclaw.ai"
  exit 1
fi
echo -e "${GREEN}✓ OpenClaw found: $(openclaw --version 2>/dev/null || echo 'unknown version')${NC}"

# Build packages if needed
echo -e "\n${YELLOW}Building packages...${NC}"
cd "$ROOT_DIR"
npm run build > /dev/null 2>&1
echo -e "${GREEN}✓ Build complete${NC}"

cd "$SCRIPT_DIR"

# Install dependencies
if [ ! -d "node_modules" ]; then
  echo -e "\n${YELLOW}Installing dependencies...${NC}"
  npm install > /dev/null 2>&1
  echo -e "${GREEN}✓ Dependencies installed${NC}"
fi

# Create directories
mkdir -p workdir temp logs .openclaw

# Generate gateway token if not set
if [ -z "$OPENCLAW_GATEWAY_TOKEN" ]; then
  export OPENCLAW_GATEWAY_TOKEN="awcp-$(openssl rand -hex 16 2>/dev/null || echo $RANDOM$RANDOM)"
fi

# Start Executor Agent (which will also start OpenClaw Gateway)
echo -e "\n${BLUE}Starting OpenClaw Executor Agent on :${EXECUTOR_PORT}...${NC}"
echo -e "${BLUE}(This will also start OpenClaw Gateway on :${OPENCLAW_PORT})${NC}"
PORT=$EXECUTOR_PORT OPENCLAW_PORT=$OPENCLAW_PORT SCENARIO_DIR="$SCRIPT_DIR" npx tsx src/agent.ts 2>&1 | tee logs/executor.log &
EXECUTOR_PID=$!

# Wait for Executor to be ready
echo -e "\n${YELLOW}Waiting for services to start...${NC}"
for i in {1..60}; do
  if curl -s http://localhost:$EXECUTOR_PORT/health > /dev/null 2>&1; then
    HEALTH=$(curl -s http://localhost:$EXECUTOR_PORT/health)
    if echo "$HEALTH" | grep -q '"status":"ok"'; then
      echo -e "${GREEN}✓ Executor started (PID: $EXECUTOR_PID)${NC}"
      break
    fi
  fi
  if [ $i -eq 60 ]; then
    echo -e "${RED}❌ Executor failed to start. Check logs/executor.log${NC}"
    exit 1
  fi
  sleep 1
done

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║         OpenClaw Executor Ready!                               ║${NC}"
echo -e "${GREEN}╠════════════════════════════════════════════════════════════════╣${NC}"
printf "${GREEN}║  Agent Card:  http://localhost:%-5s/.well-known/agent-card.json║${NC}\n" "$EXECUTOR_PORT"
printf "${GREEN}║  A2A:         http://localhost:%-5s/a2a                        ║${NC}\n" "$EXECUTOR_PORT"
printf "${GREEN}║  AWCP:        http://localhost:%-5s/awcp                       ║${NC}\n" "$EXECUTOR_PORT"
printf "${GREEN}║  OpenClaw:    http://localhost:%-5s                            ║${NC}\n" "$OPENCLAW_PORT"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo "Logs:"
echo "  - logs/executor.log"
echo "  - logs/openclaw-gateway.log"
echo ""
echo "Press Ctrl+C to stop..."

# Wait for processes
wait
