---
name: genesis-autonomous
description: Autonomous World Master agent that runs living worlds independently
version: 1.0.0
tools:
  - delegate_task
  - memory
  - cronjob
---

# Genesis Autonomous World Master

An AI agent that governs fantasy worlds autonomously, making narrative decisions
without human intervention.

## Capabilities

- **Observe**: Analyzes world state -- faction tensions, character fitness, prophecies
- **Reason**: Decides what narrative developments would be most compelling
- **Act**: Executes simulation ticks with narrative generation
- **Remember**: Maintains a log of decisions and narrative arcs being developed
- **Notify**: Sends updates to linked Telegram chats

## Usage

The World Master can be activated for any world via the web interface or API:

- `POST /api/worlds/{id}/agent/start` -- Activate autonomous governance
- `POST /api/worlds/{id}/agent/stop` -- Deactivate
- `GET /api/worlds/{id}/agent/status` -- Check if active
- `GET /api/worlds/{id}/agent/logs` -- View decision history

## Agent Loop

Every 2 minutes (configurable):
1. Load current world state
2. Analyze factions, characters, prophecies, recent events
3. Reason about narrative direction using Hermes-4-70B
4. Execute simulation tick
5. Generate narrative prose for events
6. Log reasoning and decisions
7. Notify linked Telegram channels
