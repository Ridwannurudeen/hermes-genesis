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
import httpx

GENESIS_API = "http://localhost:8003"
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


def execute_tool(name: str, args: dict) -> dict:
    """Execute a Genesis API tool call."""
    with httpx.Client(timeout=60.0) as client:
        if name == "genesis_list_worlds":
            r = client.get(f"{GENESIS_API}/api/worlds")
            worlds = r.json()
            return [{"id": w["id"], "name": w["name"], "day": w.get("current_day")} for w in worlds]

        elif name == "genesis_get_world":
            r = client.get(f"{GENESIS_API}/api/worlds/{args['world_id']}")
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
            r = client.post(f"{GENESIS_API}/api/worlds/{args['world_id']}/simulate")
            return r.json()

        elif name == "genesis_intervene":
            r = client.post(
                f"{GENESIS_API}/api/worlds/{args['world_id']}/intervene",
                json={"command": args["command"]},
            )
            return r.json()

        elif name == "genesis_agent_start":
            r = client.post(
                f"{GENESIS_API}/api/worlds/{args['world_id']}/agent/start",
                json={"interval": args.get("interval", 120)},
            )
            return r.json()

        elif name == "genesis_chat":
            r = client.post(
                f"{GENESIS_API}/api/worlds/{args['world_id']}/chat",
                json={"character_id": args["character_id"], "message": args["message"]},
            )
            return r.json()

        else:
            return {"error": f"Unknown tool: {name}"}


def run_agent(query: str):
    """Run one agent turn: prompt → tool calls → results → summary."""
    import os
    global LLM_KEY
    LLM_KEY = os.environ.get("NOUS_API_KEY") or open("/opt/genesis/.env").read().split("NOUS_API_KEY=")[1].split("\n")[0]

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
