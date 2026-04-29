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
const API_KEY = process.env.GENESIS_API_KEY || "";

async function api(method, path, body) {
  const headers = { "Content-Type": "application/json" };
  // Forward API key on mutating routes when configured. Reads (GET) are public.
  if (API_KEY && method !== "GET") {
    headers["X-API-Key"] = API_KEY;
  }
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${API}${path}`, opts);
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`API ${method} ${path} → ${res.status}: ${detail.slice(0, 200)}`);
  }
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
      "Hold a faction council — all leaders debate the world's current tensions based on their positions and dynamics.",
    inputSchema: {
      type: "object",
      properties: {
        world_id: { type: "string", description: "World ID" },
      },
      required: ["world_id"],
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
  // ─── Chroniclon (the autonomous wiki engine) ──────────────────────────
  {
    name: "chronicle_stats",
    description:
      "Snapshot of the autonomous canon: article_count, total_words, era_count, current_era, linguistic_eras, contributor_count.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "chronicle_list_articles",
    description:
      "List wiki articles in the canon, optionally filtered by era_id or kind. Useful to find slugs before fetching full bodies.",
    inputSchema: {
      type: "object",
      properties: {
        era_id: { type: "string", description: "Filter by era (e.g. 'era_1')" },
        kind: {
          type: "string",
          description: "Filter by kind: event, person, faction, place, language, concept, artifact, prophecy",
        },
        limit: { type: "number", description: "Max articles to return (default 50, max 500)" },
        offset: { type: "number", description: "Pagination offset" },
      },
    },
  },
  {
    name: "chronicle_get_article",
    description:
      "Fetch one article by slug — full body markdown, kind, voice, scores, backlinks, audio_url.",
    inputSchema: {
      type: "object",
      properties: {
        slug: { type: "string", description: "Article slug (e.g. 'the-lunar-epistle')" },
      },
      required: ["slug"],
    },
  },
  {
    name: "chronicle_render_audio",
    description:
      "Render TTS audio for an article (genome-aware archetype). Requires TTS_PROVIDER configured on the backend. Returns audio_url, archetype, char_count.",
    inputSchema: {
      type: "object",
      properties: {
        slug: { type: "string", description: "Article slug" },
      },
      required: ["slug"],
    },
  },
  {
    name: "chronicle_render_image",
    description:
      "Render a hero image for an article — grounded in the article's era art style and character genome. Requires IMAGE_API_KEY on the backend. Returns url, prompt summary, byte_size.",
    inputSchema: {
      type: "object",
      properties: {
        slug: { type: "string", description: "Article slug" },
      },
      required: ["slug"],
    },
  },
  {
    name: "chronicle_control_backlog",
    description:
      "Recent canonization phase events from the Control Room — useful for debugging the agent pipeline (decision/writing/critic/crosslink/publish/audio per pipeline_id).",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Max events to return (default 50, max 80)" },
      },
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
        // Backend route is POST /api/worlds (not /api/worlds/generate).
        result = await api("POST", "/api/worlds", {
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
        // Backend route is /characters/{char_id}/chat — character_id goes in the URL,
        // body carries only the message.
        result = await api(
          "POST",
          `/api/worlds/${args.world_id}/characters/${args.character_id}/chat`,
          { message: args.message }
        );
        break;

      case "genesis_council":
        // Backend council takes no topic — it debates current world tensions.
        result = await api(
          "POST",
          `/api/worlds/${args.world_id}/council`
        );
        break;

      case "genesis_chronicle":
        result = await api(
          "POST",
          `/api/worlds/${args.world_id}/chronicle`
        );
        break;

      // ─── Chroniclon ──────────────────────────────────────────────────
      case "chronicle_stats":
        result = await api("GET", "/api/chronicle/stats");
        break;

      case "chronicle_list_articles": {
        const params = new URLSearchParams();
        if (args.era_id) params.set("era_id", args.era_id);
        if (args.kind) params.set("kind", args.kind);
        if (args.limit !== undefined) params.set("limit", String(args.limit));
        if (args.offset !== undefined) params.set("offset", String(args.offset));
        const qs = params.toString();
        result = await api("GET", `/api/chronicle/articles${qs ? `?${qs}` : ""}`);
        break;
      }

      case "chronicle_get_article":
        result = await api("GET", `/api/chronicle/articles/${args.slug}`);
        break;

      case "chronicle_render_audio":
        result = await api("POST", "/api/chronicle/audio/render", { slug: args.slug });
        break;

      case "chronicle_render_image":
        result = await api("POST", "/api/chronicle/images/render", { slug: args.slug });
        break;

      case "chronicle_control_backlog": {
        const limit = args.limit !== undefined ? `?limit=${args.limit}` : "";
        result = await api("GET", `/api/chronicle/control/backlog${limit}`);
        break;
      }

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
