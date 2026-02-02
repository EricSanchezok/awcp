# OpenClaw Executor

AWCP Executor powered by [OpenClaw](https://github.com/openclaw/openclaw) - an open-source AI assistant.

## Overview

This executor wraps OpenClaw to work as an AWCP-compatible agent that can receive delegated coding tasks from a Delegator agent.

```
┌─────────────────────────────────────────────────────────────────┐
│                     OpenClaw Executor                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌───────────────┐    ┌───────────────────────────────────┐   │
│   │ Express Server│    │ OpenClaw Gateway                  │   │
│   │               │    │                                   │   │
│   │ • A2A         │───►│ • OpenAI-compatible HTTP API      │   │
│   │ • AWCP        │    │ • SSE streaming                   │   │
│   │ • Health      │    │ • Session isolation               │   │
│   └───────────────┘    └───────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Prerequisites

- Node.js >= 22
- OpenClaw installed globally:
  ```bash
  npm install -g openclaw@latest
  ```
- AI API key (one of):
  - `ANTHROPIC_API_KEY`
  - `OPENAI_API_KEY`
  - `OPENROUTER_API_KEY` (supports DeepSeek, Llama, Mistral, etc.)
  - `DEEPSEEK_API_KEY` (direct DeepSeek API)

## Quick Start

```bash
# Set your API key
export ANTHROPIC_API_KEY="your-key-here"

# Run the executor
./run.sh
```

### Using DeepSeek (via OpenRouter)

```bash
export OPENROUTER_API_KEY="sk-or-v1-xxx"
./run.sh
```

Then configure the model in `~/.openclaw/openclaw.json`:

```json5
{
  agents: {
    defaults: {
      model: {
        primary: "openrouter/deepseek/deepseek-chat"
      }
    }
  }
}
```

### Using DeepSeek (direct API)

```bash
export DEEPSEEK_API_KEY="sk-xxx"
./run.sh
```

Configure in `~/.openclaw/openclaw.json`:

```json5
{
  models: {
    providers: {
      deepseek: {
        type: "openai-compatible",
        baseUrl: "https://api.deepseek.com/v1",
        apiKey: "${DEEPSEEK_API_KEY}"
      }
    }
  },
  agents: {
    defaults: {
      model: { primary: "deepseek/deepseek-chat" }
    }
  }
}
```

The executor will:
1. Start an OpenClaw Gateway on port 18789
2. Start the Executor Agent on port 10200
3. Expose A2A and AWCP endpoints

## Endpoints

| Endpoint | Description |
|----------|-------------|
| `/.well-known/agent-card.json` | A2A Agent Card |
| `/a2a` | A2A JSON-RPC endpoint |
| `/awcp` | AWCP protocol endpoint |
| `/health` | Health check |

## Configuration

Environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `10200` | Executor agent port |
| `OPENCLAW_PORT` | `18789` | OpenClaw Gateway port |
| `OPENCLAW_GATEWAY_TOKEN` | auto-generated | Gateway authentication token |
| `AWCP_TRANSPORT` | `archive` | Transport type (`archive` or `sshfs`) |

## How It Works

1. **AWCP Integration**: When a Delegator sends an INVITE, this executor accepts and receives the workspace files via Archive transport.

2. **OpenClaw Gateway**: A local OpenClaw Gateway instance handles AI inference with the configured model provider.

3. **Workspace Isolation**: Each delegation task gets its own session with OpenClaw, ensuring isolation.

4. **HTTP API**: Uses OpenClaw's OpenAI-compatible `/v1/chat/completions` endpoint for task execution with SSE streaming.

## Architecture

```
Delegator                    OpenClaw Executor
    │                              │
    │── INVITE ───────────────────►│
    │◄── ACCEPT ───────────────────│
    │                              │
    │── START (workspace ZIP) ────►│
    │                              │
    │                    ┌─────────┴─────────┐
    │                    │ 1. Extract ZIP    │
    │                    │ 2. Update config  │
    │                    │ 3. Call OpenClaw  │
    │                    │    HTTP API       │
    │                    │ 4. Stream result  │
    │                    └─────────┬─────────┘
    │                              │
    │◄── SSE events ───────────────│
    │◄── DONE (result) ────────────│
```

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run in development mode
npm run dev
```

## Troubleshooting

### OpenClaw not found
```bash
npm install -g openclaw@latest
```

### Gateway fails to start
Check logs:
```bash
cat logs/openclaw-gateway.log
```

### API key issues
Ensure your API key is set:
```bash
export ANTHROPIC_API_KEY="sk-ant-..."
# or
export OPENAI_API_KEY="sk-..."
```

## License

MIT
