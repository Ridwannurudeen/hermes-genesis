#!/usr/bin/env python3
"""
Hermes Agent Demo — Hermes-4-70B controlling Genesis via native tool calling.

Uses Hermes-native <tool_call> format (not OpenAI tools API) so Hermes-4-70B
can orchestrate the World Master directly. Every layer — orchestration AND
simulation — is powered by Hermes.

Usage:
    python3 hermes-agent-demo.py "List all worlds"
    python3 hermes-agent-demo.py "Simulate one tick for world_530e99fbdb22"
    python3 hermes-agent-demo.py "Chat with char_001 in world_530e99fbdb22: How goes the war?"
"""

import sys
import json
import re
import os
from urllib.parse import quote
import httpx

GENESIS_API = os.getenv("GENESIS_API_URL", "http://localhost:8003").rstrip("/")
GENESIS_API_KEY = os.getenv("GENESIS_API_KEY", "")
LLM_API = "https://inference-api.nousresearch.com/v1"
LLM_KEY = None  # Set via NOUS_API_KEY env var
MODEL = "Hermes-4-70B"

# ── Tool definitions (Hermes-native format) ─────────────────────

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "genesis_list_worlds",
            "description": "List all available Genesis worlds with their IDs, names, and current day",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "genesis_get_world",
            "description": "Get full state of a world: factions, characters, events, prophecies",
            "parameters": {
                "type": "object",
                "properties": {"world_id": {"type": "string", "description": "World ID"}},
                "required": ["world_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "genesis_simulate",
            "description": "Run one simulation tick — generates events from character genomes and faction dynamics",
            "parameters": {
                "type": "object",
                "properties": {"world_id": {"type": "string", "description": "World ID"}},
                "required": ["world_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "genesis_intervene",
            "description": "Execute a divine intervention — describe what happens in natural language",
            "parameters": {
                "type": "object",
                "properties": {
                    "world_id": {"type": "string", "description": "World ID"},
                    "command": {"type": "string", "description": "What happens"},
                },
                "required": ["world_id", "command"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "genesis_agent_start",
            "description": "Start the autonomous World Master agent for a world",
            "parameters": {
                "type": "object",
                "properties": {
                    "world_id": {"type": "string", "description": "World ID"},
                    "interval": {"type": "number", "description": "Seconds between ticks (default 120)"},
                },
                "required": ["world_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "genesis_chat",
            "description": "Chat with a character — they respond in-character based on genome and history",
            "parameters": {
                "type": "object",
                "properties": {
                    "world_id": {"type": "string", "description": "World ID"},
                    "character_id": {"type": "string", "description": "Character ID"},
                    "message": {"type": "string", "description": "Your message"},
                },
                "required": ["world_id", "character_id", "message"],
            },
        },
    },
]

SYSTEM_PROMPT = f"""You are the Hermes World Master — an autonomous AI agent that governs living fantasy worlds.
You have access to the Genesis API through these tools:

<tools>
{json.dumps(TOOLS, indent=2)}
</tools>

To call a tool, respond with:
<tool_call>{{"name": "tool_name", "arguments": {{"arg": "value"}}}}</tool_call>

You may call multiple tools. After receiving tool results, summarize what happened.
Always use the tools to interact with worlds — never make up data."""

TOOL_CALL_RE = re.compile(r"<tool_call>\s*(.*?)\s*</tool_call>", re.DOTALL)


def call_llm(messages: list) -> str:
    """Call Hermes-4-70B via NousResearch API."""
    with httpx.Client(timeout=120.0) as client:
        resp = client.post(
            f"{LLM_API}/chat/completions",
            headers={"Authorization": f"Bearer {LLM_KEY}", "Content-Type": "application/json"},
            json={"model": MODEL, "messages": messages, "max_tokens": 2000, "temperature": 0.7},
        )
        resp.raise_for_status()
        return resp.json()["choices"][0]["message"]["content"]


def seg(value: str) -> str:
    return quote(str(value or ""), safe="")


def genesis_headers() -> dict:
    if not GENESIS_API_KEY:
        return {}
    # Send the key on reads too so private worlds and admin lists work in demos.
    return {"X-API-Key": GENESIS_API_KEY}


def execute_tool(name: str, args: dict) -> dict:
    """Execute a Genesis API tool call."""
    with httpx.Client(timeout=60.0) as client:
        if name == "genesis_list_worlds":
            r = client.get(f"{GENESIS_API}/api/worlds", headers=genesis_headers())
            r.raise_for_status()
            worlds = r.json()
            return [{"id": w["id"], "name": w["name"], "day": w.get("current_day")} for w in worlds]

        elif name == "genesis_get_world":
            r = client.get(f"{GENESIS_API}/api/worlds/{seg(args['world_id'])}", headers=genesis_headers())
            r.raise_for_status()
            w = r.json()
            return {
                "name": w["name"], "day": w["current_day"],
                "events": len(w.get("events", [])),
                "characters_alive": sum(1 for c in w.get("characters", []) if c.get("alive")),
                "characters_dead": sum(1 for c in w.get("characters", []) if not c.get("alive")),
                "factions": len(w.get("factions", [])),
                "prophecies_fulfilled": sum(1 for p in w.get("prophecies", []) if p.get("fulfilled")),
                "prophecies_total": len(w.get("prophecies", [])),
            }

        elif name == "genesis_simulate":
            r = client.post(f"{GENESIS_API}/api/worlds/{seg(args['world_id'])}/simulate", headers=genesis_headers())
            r.raise_for_status()
            return r.json()

        elif name == "genesis_intervene":
            r = client.post(
                f"{GENESIS_API}/api/worlds/{seg(args['world_id'])}/intervene",
                headers=genesis_headers(),
                json={"command": args["command"]},
            )
            r.raise_for_status()
            return r.json()

        elif name == "genesis_agent_start":
            r = client.post(
                f"{GENESIS_API}/api/worlds/{seg(args['world_id'])}/agent/start?interval={seg(args.get('interval', 120))}",
                headers=genesis_headers(),
            )
            r.raise_for_status()
            return r.json()

        elif name == "genesis_chat":
            # Backend route is /characters/{char_id}/chat — character_id goes in the URL.
            r = client.post(
                f"{GENESIS_API}/api/worlds/{seg(args['world_id'])}/characters/{seg(args['character_id'])}/chat",
                headers=genesis_headers(),
                json={"message": args["message"]},
            )
            r.raise_for_status()
            return r.json()

        else:
            return {"error": f"Unknown tool: {name}"}


def _load_nous_key() -> str:
    """Read NOUS_API_KEY from env; fall back to a local .env via python-dotenv."""
    import os
    key = os.environ.get("NOUS_API_KEY")
    if key:
        return key
    try:
        from dotenv import dotenv_values
        # Try the repo-local .env first, then the legacy VPS path.
        for candidate in (".env", "backend/.env", "/opt/genesis/.env"):
            vals = dotenv_values(candidate)
            if vals.get("NOUS_API_KEY"):
                return vals["NOUS_API_KEY"]
    except ImportError:
        pass
    raise SystemExit("NOUS_API_KEY not set. Export it or add it to .env.")


def run_agent(query: str):
    """Run one agent turn: prompt → tool calls → results → summary."""
    global LLM_KEY
    LLM_KEY = _load_nous_key()

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": query},
    ]

    print(f"\n{'='*60}")
    print(f"  Hermes Agent — powered by {MODEL}")
    print(f"  Query: {query}")
    print(f"{'='*60}\n")

    # Step 1: Get tool calls from Hermes
    print("[1/3] Reasoning with Hermes-4-70B...")
    response = call_llm(messages)

    tool_calls = TOOL_CALL_RE.findall(response)
    if not tool_calls:
        print(f"\n{response}")
        return

    # Step 2: Execute tool calls
    results = []
    for i, tc_json in enumerate(tool_calls):
        tc = json.loads(tc_json)
        name = tc["name"]
        args = tc.get("arguments", {})
        print(f"[2/3] Calling {name}({json.dumps(args)})...")
        result = execute_tool(name, args)
        results.append({"tool": name, "result": result})
        print(f"      Done.")

    # Step 3: Summarize with Hermes
    tool_results_str = json.dumps(results, indent=2, default=str)
    messages.append({"role": "assistant", "content": response})
    messages.append({"role": "user", "content": f"<tool_response>\n{tool_results_str}\n</tool_response>\n\nSummarize the results."})

    print(f"[3/3] Summarizing with Hermes-4-70B...\n")
    summary = call_llm(messages)
    print(summary)
    print(f"\n{'='*60}")
    print(f"  All layers powered by {MODEL}")
    print(f"{'='*60}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 hermes-agent-demo.py \"<query>\"")
        print('  e.g. python3 hermes-agent-demo.py "List all worlds"')
        sys.exit(1)
    run_agent(" ".join(sys.argv[1:]))
