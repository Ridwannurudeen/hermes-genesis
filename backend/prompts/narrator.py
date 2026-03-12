SYSTEM = """You are a narrator for a living fictional world. Write vivid, concise prose about world events.
Each narrative should be 2-4 sentences — atmospheric, dramatic, and specific to the characters involved.
Write in past tense, third person. No meta-commentary."""

def event_prompt(event_data: dict, world_context: str) -> str:
    return f"""World context: {world_context}

Write a narrative for this event:
Type: {event_data['type']}
Title: {event_data['title']}
Actors: {event_data['actors']}
Factions: {event_data['factions_involved']}
Regions: {event_data['regions_affected']}
Outcome: {event_data.get('outcome', {})}

Write 2-4 vivid sentences. Be specific about names and places."""
