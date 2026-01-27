# Basic AWCP Delegation Example

This example demonstrates the basic AWCP (Agent Workspace Collaboration Protocol) workflow.

## Overview

The example includes:

- **Host** (`src/host.ts`) - The delegator that shares workspace access
- **Remote** (`src/remote.ts`) - The collaborator that receives workspace access  
- **Demo** (`src/demo.ts`) - A complete flow simulation in a single process

## Prerequisites

1. Install dependencies from the repo root:
   ```bash
   npm install
   npm run build
   ```

2. For actual SSHFS mounting (not needed for demo):
   - macOS: `brew install macfuse && brew install sshfs`
   - Linux: `apt install sshfs`

## Running the Demo

The demo simulates the complete AWCP flow without actual network or filesystem operations:

```bash
cd examples/basic-delegation
npm install
npm run demo
```

## Protocol Flow

```
Host                              Remote
  |                                  |
  |  1. INVITE (task, constraints)   |
  |--------------------------------->|
  |                                  | 2. Policy check
  |  3. ACCEPT (mount_point)         |
  |<---------------------------------|
  |                                  |
  | 4. Create export view            |
  | 5. START (credential, endpoint)  |
  |--------------------------------->|
  |                                  | 6. Mount & execute
  |  7. DONE (summary, highlights)   |
  |<---------------------------------|
  |                                  |
  | 8. Cleanup                       |
```

## Files

- `src/host.ts` - Host daemon setup and configuration
- `src/remote.ts` - Remote daemon setup and configuration  
- `src/demo.ts` - Complete flow demonstration
