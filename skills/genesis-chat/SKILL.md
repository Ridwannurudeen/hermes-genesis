---
name: genesis-chat
description: Chat with any character in a living world — responses shaped by their genome, faction loyalty, personal history, and current mood
version: 1.0.0
metadata:
  hermes:
    tags: [roleplay, character, chat, interactive]
    category: simulation
    requires_toolsets: [terminal, web]
---

# Genesis Chat — In-Character Conversations

## When to Use
When the user wants to talk to a character in the world. Characters respond in-character based on their genetic traits, faction allegiance, personal history, and relationships.

## Procedure

### Step 1: List Available Characters
```bash
curl http://localhost:8003/api/worlds/{world_id} | jq '.characters[] | {id, name, role, faction_id, alive}'
```

### Step 2: Chat with a Character
```bash
curl -X POST http://localhost:8003/api/worlds/{world_id}/chat \
  -H "Content-Type: application/json" \
  -d '{"character_id": "char_001", "message": "What do you think of the recent battle?"}'
```

### Step 3: Hold a Faction Council
All faction leaders debate a topic together:
```bash
curl -X POST http://localhost:8003/api/worlds/{world_id}/council \
  -H "Content-Type: application/json" \
  -d '{"topic": "Should we form an alliance against the northern raiders?"}'
```

## How Characters Respond

Character responses are shaped by their **genome**:
- **High courage** → bold, direct, confrontational
- **High cunning** → evasive, strategic, manipulative
- **High loyalty** → devoted to faction, suspicious of outsiders
- **High ambition** → power-hungry, scheming, opportunistic
- **High empathy** → compassionate, diplomatic, peace-seeking
- **High resilience** → stoic, pragmatic, survivor mentality

Plus their **context**:
- Recent events they witnessed or participated in
- Their faction's current political situation
- Their relationships with other characters
- Their role (leader, warrior, advisor, spy, etc.)

## Pitfalls
- Dead characters cannot be chatted with (check `alive: true`)
- Character responses may reference events the user hasn't seen yet
- Council debates require at least 2 living faction leaders

## Verification
- Response is in-character prose (not generic AI output)
- Response references the character's specific traits and situation
- Council responses show distinct perspectives from each faction leader
