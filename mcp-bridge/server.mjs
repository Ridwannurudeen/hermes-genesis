#!/usr/bin/env node
/**
 * MCP Bridge Server — Exposes Hermes Genesis API as MCP tools
 * for hermes-agent integration.
 *
 * Usage:
 *   node server.mjs
 *
 * Environment:
 *   GENESIS_API_URL  — Backend URL (default: http://localhost:8003)
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const API = process.env.GENESIS_API_URL || "http://localhost:8003";

async function api(method, path, body) {
  const opts = { method, headers: { "Content-Type": "application/json" } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${API}${path}`, opts);
  return res.json();
}

const TOOLS = [
  {
    name: "genesis_create_world",
    description:
      "Create a living world from a seed sentence. Returns world ID and full state.",
    inputSchema: {
      type: "object",
      properties: {
        seed: {
          type: "string",
          description:
            'Natural language world description, e.g. "Norse mythology where Ragnarok approaches"',
        },
      },
      required: ["seed"],
    },
  },
  {
    name: "genesis_list_worlds",
    description: "List all existing worlds with their IDs and names.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "genesis_get_world",
    description:
      "Get full world state: factions, characters, events, prophecies, geography.",
    inputSchema: {
      type: "object",
      properties: {
        world_id: { type: "string", description: "World ID" },
      },
      required: ["world_id"],
    },
  },
  {
    name: "genesis_simulate",
    description:
      "Run one simulation tick — generates events from character genomes and faction dynamics.",
    inputSchema: {
      type: "object",
      properties: {
        world_id: { type: "string", description: "World ID" },
      },
      required: ["world_id"],
    },
  },
  {
    name: "genesis_intervene",
    description:
      'Execute a divine intervention — describe what happens in natural language, e.g. "A great flood destroys the southern farmlands".',
    inputSchema: {
      type: "object",
      properties: {
        world_id: { type: "string", description: "World ID" },
        command: {
          type: "string",
          description: "Natural language description of the intervention",
        },
      },
      required: ["world_id", "command"],
    },
  },
  {
    name: "genesis_agent_start",
    description:
      "Start the autonomous World Master agent for a world. It will observe, reason, and act on its own.",
    inputSchema: {
      type: "object",
      properties: {
        world_id: { type: "string", description: "World ID" },
        interval: {
          type: "number",
          description: "Seconds between agent ticks (default: 120)",
        },
      },
      required: ["world_id"],
    },
  },
  {
    name: "genesis_agent_stop",
    description: "Stop the autonomous World Master agent for a world.",
    inputSchema: {
      type: "object",
      properties: {
        world_id: { type: "string", description: "World ID" },
      },
      required: ["world_id"],
    },
  },
  {
    name: "genesis_agent_status",
    description:
      "Get agent status, logs, and reasoning history for a world.",
    inputSchema: {
      type: "object",
      properties: {
        world_id: { type: "string", description: "World ID" },
      },
      required: ["world_id"],
    },
  },
  {
    name: "genesis_chat",
    description:
      "Chat with a character — they respond in-character based on genome, faction, and history.",
    inputSchema: {
      type: "object",
      properties: {
        world_id: { type: "string", description: "World ID" },
        character_id: { type: "string", description: "Character ID" },
        message: { type: "string", description: "Your message to the character" },
      },
      required: ["world_id", "character_id", "message"],
    },
  },
  {
    name: "genesis_council",
    description:
      "Hold a faction council — all leaders debate a topic based on their positions and dynamics.",
    inputSchema: {
      type: "object",
      properties: {
        world_id: { type: "string", description: "World ID" },
        topic: { type: "string", description: "Topic for the council to debate" },
      },
      required: ["world_id", "topic"],
    },
  },
  {
    name: "genesis_chronicle",
    description:
      "Export the world's history as a publishable chronicle narrative.",
    inputSchema: {
      type: "object",
      properties: {
        world_id: { type: "string", description: "World ID" },
      },
      required: ["world_id"],
    },
  },
];

const server = new Server(
  { name: "hermes-genesis", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS,
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result;

    switch (name) {
      case "genesis_create_world":
        result = await api("POST", "/api/worlds/generate", {
          seed: args.seed,
        });
        break;

      case "genesis_list_worlds":
        result = await api("GET", "/api/worlds");
        break;

      case "genesis_get_world":
        result = await api("GET", `/api/worlds/${args.world_id}`);
        break;

      case "genesis_simulate":
        result = await api(
          "POST",
          `/api/worlds/${args.world_id}/simulate`
        );
        break;

      case "genesis_intervene":
        result = await api(
          "POST",
          `/api/worlds/${args.world_id}/intervene`,
          { command: args.command }
        );
        break;

      case "genesis_agent_start":
        result = await api(
          "POST",
          `/api/worlds/${args.world_id}/agent/start`,
          { interval: args.interval || 120 }
        );
        break;

      case "genesis_agent_stop":
        result = await api(
          "POST",
          `/api/worlds/${args.world_id}/agent/stop`
        );
        break;

      case "genesis_agent_status":
        result = await api(
          "GET",
          `/api/worlds/${args.world_id}/agent/status`
        );
        break;

      case "genesis_chat":
        result = await api(
          "POST",
          `/api/worlds/${args.world_id}/chat`,
          { character_id: args.character_id, message: args.message }
        );
        break;

      case "genesis_council":
        result = await api(
          "POST",
          `/api/worlds/${args.world_id}/council`,
          { topic: args.topic }
        );
        break;

      case "genesis_chronicle":
        result = await api(
          "POST",
          `/api/worlds/${args.world_id}/chronicle`
        );
        break;

      default:
        return {
          content: [
            { type: "text", text: `Unknown tool: ${name}` },
          ],
          isError: true,
        };
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
