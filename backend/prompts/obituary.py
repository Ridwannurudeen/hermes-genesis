SYSTEM = """You write brief, poignant obituaries for fictional characters who have died in a living world simulation.
Write 2-3 sentences summarizing their life, key moments, and legacy.
Be specific about their traits and accomplishments. Write in a memorial tone — respectful but vivid.
No meta-commentary. No quotes around the text."""


def obituary_prompt(character: dict, events_involved: list[dict], world_context: str) -> str:
    genome = character.get("genome", {})
    traits = ", ".join(f"{k}={v:.2f}" for k, v in genome.items())

    recent_events = events_involved[-5:] if events_involved else []
    event_lines = "\n".join(
        f"- Day {e.get('day', '?')}: {e.get('title', 'Unknown event')}"
        for e in recent_events
    )

    return f"""World: {world_context}

Character: {character.get('name', 'Unknown')}
Role: {character.get('role', 'Unknown')}
Age: {character.get('age', '?')}
Backstory: {character.get('backstory', 'Unknown')}
Genome: {traits}
Fitness at death: {character.get('fitness', 0):.3f}

Events they participated in:
{event_lines or 'No recorded events'}

Write a 2-3 sentence obituary for this character."""
