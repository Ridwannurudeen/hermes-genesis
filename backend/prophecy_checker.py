import asyncio
import logging
from llm import chat_completion, extract_json
from models.world import World, Prophecy
from models.event import Event

logger = logging.getLogger(__name__)

PROPHECY_CHECK_SYSTEM = """You analyze whether world events have fulfilled ancient prophecies.
Given a prophecy text and recent events, determine if the prophecy has been fulfilled.
Respond with JSON: {"fulfilled": true/false, "confidence": 0.0-1.0, "explanation": "brief explanation of how/why"}
Be generous but not absurd. Partial fulfillment counts if the core meaning is met."""


async def check_prophecy_fulfillment(
    prophecy: Prophecy, recent_events: list[dict], world_name: str
) -> dict | None:
    """Check if recent events fulfill a prophecy. Returns fulfillment data or None."""
    if prophecy.fulfilled:
        return None

    event_summaries = "\n".join(
        [
            f"- Day {e.get('day', '?')}: [{e.get('type', '?')}] {e.get('title', '?')} — {e.get('narrative', e.get('description', ''))[:200]}"
            for e in recent_events[-10:]
        ]
    )

    prompt = f"""World: {world_name}

PROPHECY: "{prophecy.text}"
HINT: "{prophecy.hint}"

RECENT EVENTS:
{event_summaries}

Has this prophecy been fulfilled by these events? Respond with JSON."""

    try:
        raw = await chat_completion(
            PROPHECY_CHECK_SYSTEM, prompt, max_tokens=200, temperature=0.3
        )
        data = extract_json(raw)
        if data.get("fulfilled") and data.get("confidence", 0) >= 0.6:
            return data
    except Exception as e:
        logger.warning(f"Prophecy check failed for {prophecy.id}: {e}")
    return None


async def check_and_fulfill_prophecies(
    world: World, new_events: list[Event], day: int
) -> list[Event]:
    """Check all unfulfilled prophecies against recent events.
    Returns list of new prophecy_fulfilled events created."""
    fulfillment_events = []

    unfulfilled = [p for p in world.prophecies if not p.fulfilled]
    if not unfulfilled or not new_events:
        return fulfillment_events

    # Only check every 3 days to save LLM calls
    if day % 3 != 0:
        return fulfillment_events

    recent = [e.model_dump() for e in world.events[-15:]]

    # Check all prophecies in parallel
    results = await asyncio.gather(*[
        check_prophecy_fulfillment(prophecy, recent, world.name)
        for prophecy in unfulfilled
    ])

    for prophecy, result in zip(unfulfilled, results):
        if result:
            prophecy.fulfilled = True
            prophecy.fulfilled_day = day

            # Find the most relevant matching event if possible
            matching_event_id = ""
            if new_events:
                matching_event_id = new_events[-1].id

            prophecy.fulfilled_event_id = matching_event_id

            # Create a special prophecy fulfillment event
            fulfillment_event = Event(
                id=f"evt_{day:03d}_prophecy_{prophecy.id}",
                day=day,
                type="prophecy_fulfilled",
                title=f"Prophecy Fulfilled: {prophecy.text[:60]}...",
                description=result.get("explanation", ""),
                narrative=f'The ancient prophecy has come to pass: "{prophecy.text}" — {result.get("explanation", "")}',
            )
            fulfillment_events.append(fulfillment_event)
            logger.info(
                f"Prophecy {prophecy.id} fulfilled on day {day}: {result.get('explanation', '')[:100]}"
            )

    return fulfillment_events
