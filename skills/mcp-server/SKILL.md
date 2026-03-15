---
name: mcp-server
description: MCP server configuration to connect hermes-agent to the Genesis World Master API — enables autonomous world orchestration through hermes-agent tools
version: 1.0.0
metadata:
  hermes:
    tags: [mcp, integration, tools]
    category: integration
---

# Genesis MCP Server — Hermes Agent Integration

## When to Use
When configuring hermes-agent to orchestrate Hermes Genesis worlds through its native tool system. This MCP server exposes world creation, simulation, intervention, chat, and export as hermes-agent tools.

## Setup

### Step 1: Start the Genesis Backend
```bash
cd hermes-genesis
docker compose up -d
# Or manually: cd backend && uvicorn main:app --port 8003
```

### Step 2: Configure hermes-agent
Add to `~/.hermes/config.yaml`:
```yaml
mcp_servers:
  genesis:
    command: "node"
    args: ["path/to/hermes-genesis/mcp-bridge/server.mjs"]
    env:
      GENESIS_API_URL: "http://localhost:8003"
```

Or for a remote server:
```yaml
mcp_servers:
  genesis:
    command: "node"
    args: ["path/to/hermes-genesis/mcp-bridge/server.mjs"]
    env:
      GENESIS_API_URL: "http://75.119.153.252:8003"
```

### Step 3: Verify
```bash
hermes tools  # Should show genesis_* tools
```

## Available MCP Tools

| Tool | Description |
|------|-------------|
| `genesis_create_world` | Generate a world from a seed sentence |
| `genesis_get_world` | Read full world state |
| `genesis_simulate` | Run one simulation tick |
| `genesis_intervene` | Execute a divine intervention |
| `genesis_agent_start` | Start autonomous World Master |
| `genesis_agent_stop` | Stop autonomous World Master |
| `genesis_agent_status` | Check agent status and logs |
| `genesis_chat` | Chat with a character |
| `genesis_council` | Hold a faction council debate |
| `genesis_chronicle` | Export world history |

## Pitfalls
- The MCP server requires Node.js 18+
- The Genesis backend must be running before connecting
- Tool results return JSON — hermes-agent will parse and reason over them

## Verification
- `hermes tools` lists genesis_* tools
- `hermes chat "Create a world about Viking raiders"` triggers genesis_create_world
