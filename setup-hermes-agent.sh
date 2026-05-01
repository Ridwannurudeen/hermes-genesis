#!/bin/bash
# ============================================================================
# Hermes Genesis — hermes-agent Setup
# ============================================================================
# Installs hermes-agent, configures MCP bridge to Genesis API,
# and copies custom skills. After running this, hermes-agent can
# create worlds, run simulations, intervene, chat, and export
# chronicles — all through natural conversation.
#
# Usage:
#   ./setup-hermes-agent.sh [GENESIS_API_URL]
#
# Default API URL: http://localhost:8003
# ============================================================================

set -e

GENESIS_API="${1:-http://localhost:8003}"
HERMES_HOME="$HOME/.hermes"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "=== Hermes Genesis — hermes-agent Setup ==="
echo "Genesis API: $GENESIS_API"
echo ""

# Step 1: Install hermes-agent (if not already installed)
if command -v hermes &>/dev/null || [ -f "$HERMES_HOME/hermes-agent/venv/bin/hermes" ]; then
    echo "[✓] hermes-agent already installed"
    HERMES_BIN="$(command -v hermes 2>/dev/null || echo "$HERMES_HOME/hermes-agent/venv/bin/hermes")"
else
    echo "[1/4] Installing hermes-agent..."
    curl -fsSL https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.sh | bash -s -- --skip-setup
    HERMES_BIN="$HERMES_HOME/hermes-agent/venv/bin/hermes"
    echo "[✓] hermes-agent installed"
fi

echo ""
echo "Version: $($HERMES_BIN --version 2>&1 | head -1)"

# Step 2: Install MCP bridge dependencies
echo ""
echo "[2/4] Installing MCP bridge dependencies..."
if [ -d "$SCRIPT_DIR/mcp-bridge" ]; then
    cd "$SCRIPT_DIR/mcp-bridge"
    npm install --silent 2>&1
    echo "[✓] MCP bridge ready"
else
    echo "[!] mcp-bridge/ directory not found — skipping"
fi

# Step 3: Copy custom skills
echo ""
echo "[3/4] Installing Genesis skills..."
SKILLS_SRC="$SCRIPT_DIR/skills"
SKILLS_DST="$HERMES_HOME/skills"
mkdir -p "$SKILLS_DST"

for skill_dir in "$SKILLS_SRC"/*/; do
    skill_name=$(basename "$skill_dir")
    cp -r "$skill_dir" "$SKILLS_DST/$skill_name"
    echo "  + $skill_name"
done
echo "[✓] Skills installed"

# Step 4: Configure MCP server
echo ""
echo "[4/4] Configuring MCP bridge..."
MCP_SERVER_PATH="$SCRIPT_DIR/mcp-bridge/server.mjs"
export MCP_SERVER_PATH GENESIS_API GENESIS_API_KEY

python3 <<'PY'
import yaml, os

config_path = os.path.expanduser('~/.hermes/config.yaml')
with open(config_path) as f:
    config = yaml.safe_load(f) or {}

config.setdefault('mcp_servers', {})

env = {'GENESIS_API_URL': os.environ['GENESIS_API']}
if os.environ.get('GENESIS_API_KEY'):
    env['GENESIS_API_KEY'] = os.environ['GENESIS_API_KEY']

config['mcp_servers']['genesis'] = {
    'command': 'node',
    'args': [os.environ['MCP_SERVER_PATH']],
    'env': env,
}

with open(config_path, 'w') as f:
    yaml.dump(config, f, default_flow_style=False, sort_keys=False)

print('[✓] MCP bridge configured in ~/.hermes/config.yaml')
PY

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Usage:"
echo "  $HERMES_BIN chat"
echo ""
echo "Try:"
echo '  > Use genesis tools to create a world about "Viking raiders battling sea serpents"'
echo '  > Simulate 10 days on world_530e99fbdb22'
echo '  > Chat with the faction leader of faction_01'
echo ""
echo "Available MCP tools: genesis_create_world, genesis_simulate,"
echo "  genesis_intervene, genesis_chat, genesis_council, genesis_chronicle,"
echo "  genesis_agent_start, genesis_agent_stop, genesis_agent_status,"
echo "  genesis_list_worlds, genesis_get_world"
