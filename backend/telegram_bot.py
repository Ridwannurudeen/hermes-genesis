import json
import os
import logging
from telegram import Update
from telegram.ext import Application, CommandHandler, ContextTypes
from config import DATA_DIR, TELEGRAM_BOT_TOKEN
from store import load_world

logger = logging.getLogger(__name__)

_bot_app: Application | None = None
_links_path = os.path.join(DATA_DIR, "telegram_links.json")

# Emoji mapping for event types — matches frontend EVENT_TYPE_ICONS
EVENT_TYPE_EMOJIS: dict[str, str] = {
    "military_conflict": "\u2694\ufe0f",
    "political_intrigue": "\U0001f3ad",
    "betrayal": "\U0001f5e1\ufe0f",
    "alliance": "\U0001f91d",
    "discovery": "\U0001f50d",
    "succession": "\U0001f451",
    "cultural_shift": "\U0001f30a",
    "natural_disaster": "\U0001f30b",
    "death": "\U0001f480",
    "birth": "\u2728",
    "divine_intervention": "\u26a1",
    "agent_intervention": "\U0001f9e0",
    "prophecy_fulfilled": "\U0001f52e",
}


def _escape_markdown(text: str) -> str:
    """Escape characters that break Telegram Markdown v1 parsing.

    Telegram Markdown v1 uses * _ ` [ for formatting.  We escape stray
    occurrences that are not part of our own formatting so Telegram
    doesn't choke.
    """
    # Replace backticks — they break code formatting
    text = text.replace("`", "'")
    # Escape square brackets not part of links
    text = text.replace("[", "(").replace("]", ")")
    return text


def _format_event_block(event) -> str:
    """Format a single event into a Telegram Markdown block."""
    emoji = EVENT_TYPE_EMOJIS.get(event.type, "\u26a0\ufe0f")
    title = _escape_markdown(event.title)
    lines = [f"{emoji} *{title}*"]

    # Narrative snippet (first 150 chars)
    narrative = event.narrative or event.description or ""
    if narrative:
        snippet = _escape_markdown(narrative[:150])
        if len(narrative) > 150:
            snippet += "..."
        lines.append(f"_{snippet}_")

    # Agent / causality markers
    if event.agent_triggered:
        lines.append("\U0001f9e0 _World Master action_")
    if event.caused_by:
        lines.append("\u26d3\ufe0f _Chain reaction_")

    return "\n".join(lines)


def _format_prophecy_fulfilled(prophecy_data: dict) -> str:
    """Format a dramatic prophecy fulfillment message."""
    text = _escape_markdown(prophecy_data.get("text", "Unknown prophecy"))
    explanation = _escape_markdown(prophecy_data.get("explanation", ""))
    day = prophecy_data.get("day", "?")

    lines = [
        "\U0001f52e\u2728 *PROPHECY FULFILLED* \u2728\U0001f52e",
        "",
        f"_{text}_",
        "",
    ]
    if explanation:
        lines.append(explanation)
        lines.append("")
    lines.append(f"Day {day} \u2014 The ancient words have come to pass.")
    return "\n".join(lines)


def load_links() -> dict[str, str]:
    """Load chat_id -> world_id mapping from disk."""
    if not os.path.exists(_links_path):
        return {}
    try:
        with open(_links_path, "r") as f:
            return json.load(f)
    except Exception:
        return {}


def save_links(links: dict[str, str]) -> None:
    """Persist chat_id -> world_id mapping to disk."""
    os.makedirs(os.path.dirname(_links_path), exist_ok=True)
    with open(_links_path, "w") as f:
        json.dump(links, f, indent=2)


async def start_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle /start command."""
    await update.message.reply_text(
        "Welcome to Hermes Genesis Bot!\n\n"
        "Commands:\n"
        "/link <world_id> - Link this chat to a world\n"
        "/status - Show linked world summary\n"
        "/simulate - Advance world by 1 day\n"
        "/unlink - Remove world link"
    )


async def link_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle /link <world_id> command."""
    if not context.args:
        await update.message.reply_text("Usage: /link <world_id>")
        return

    world_id = context.args[0]
    world = load_world(world_id)
    if not world:
        await update.message.reply_text(f"World '{world_id}' not found.")
        return

    links = load_links()
    chat_id = str(update.effective_chat.id)
    links[chat_id] = world_id
    save_links(links)
    await update.message.reply_text(f"Linked to world: {world.name} ({world_id})")


async def status_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle /status command — rich world summary."""
    links = load_links()
    chat_id = str(update.effective_chat.id)
    world_id = links.get(chat_id)
    if not world_id:
        await update.message.reply_text("No world linked. Use /link <world_id> first.")
        return

    world = load_world(world_id)
    if not world:
        await update.message.reply_text(f"Linked world '{world_id}' no longer exists.")
        return

    alive = sum(1 for c in world.characters if c.alive)
    dead = sum(1 for c in world.characters if not c.alive)

    # Faction details with territory counts
    faction_lines = []
    for f in world.factions:
        terr = len(f.territory) if f.territory else 0
        faction_lines.append(f"  {_escape_markdown(f.name)}: {terr} territories, morale {f.morale}")

    # Recent notable events (last 3)
    recent_events = world.events[-3:] if world.events else []
    event_lines = []
    for ev in recent_events:
        emoji = EVENT_TYPE_EMOJIS.get(ev.type, "\u26a0\ufe0f")
        title = _escape_markdown(ev.title)
        event_lines.append(f"  {emoji} {title}")

    # Unfulfilled prophecies count
    prophecies = getattr(world, "prophecies", [])
    unfulfilled = sum(1 for p in prophecies if not p.fulfilled)
    fulfilled = sum(1 for p in prophecies if p.fulfilled)

    msg_parts = [
        f"\U0001f30d *{_escape_markdown(world.name)}*",
        f"Day {world.current_day}",
        "",
        f"*Factions* ({len(world.factions)}):",
    ]
    msg_parts.extend(faction_lines)
    msg_parts.append("")
    msg_parts.append(f"*Characters*: {alive} alive / {dead} dead")

    if event_lines:
        msg_parts.append("")
        msg_parts.append("*Recent Events*:")
        msg_parts.extend(event_lines)

    if prophecies:
        msg_parts.append("")
        msg_parts.append(f"\U0001f52e Prophecies: {fulfilled} fulfilled / {unfulfilled} awaiting")

    try:
        await update.message.reply_text(
            "\n".join(msg_parts), parse_mode="Markdown"
        )
    except Exception:
        # Fallback to plain text if Markdown parsing fails
        await update.message.reply_text("\n".join(msg_parts))


async def simulate_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle /simulate command — advance 1 day with full narrative, obituaries, and prophecy checks."""
    links = load_links()
    chat_id = str(update.effective_chat.id)
    world_id = links.get(chat_id)
    if not world_id:
        await update.message.reply_text("No world linked. Use /link <world_id> first.")
        return

    world = load_world(world_id)
    if not world:
        await update.message.reply_text(f"Linked world '{world_id}' no longer exists.")
        return

    await update.message.reply_text("Simulating... (generating narratives)")

    # Use the rich simulation path (narrator + obituary + prophecy)
    from simulation_rich import simulate_rich_tick
    world, events, prophecy_fulfilled_data = await simulate_rich_tick(world_id)
    if not world:
        await update.message.reply_text("Simulation failed — world could not be loaded.")
        return

    # Header
    msg_parts = [
        f"\u2694\ufe0f *Day {world.current_day} Complete* \u2014 {len(events)} events",
        "",
    ]

    # Events with narrative snippets
    deaths = []
    births = []
    prophecy_events = []
    for ev in events:
        if ev.type == "death":
            deaths.append(ev)
        elif ev.type == "birth":
            births.append(ev)
        elif ev.type == "prophecy_fulfilled":
            prophecy_events.append(ev)
        msg_parts.append(_format_event_block(ev))
        msg_parts.append("")  # blank line between events

    # Summary footer
    footer = []
    if deaths:
        names = ", ".join(_escape_markdown(d.title.replace("Death of ", "")) for d in deaths[:3])
        footer.append(f"\U0001f480 Deaths: {names}")
    if births:
        names = ", ".join(_escape_markdown(b.title) for b in births[:3])
        footer.append(f"\u2728 Births: {names}")
    if prophecy_events:
        footer.append(f"\U0001f52e Prophecy fulfilled this day!")

    if footer:
        msg_parts.append("\u2014\u2014\u2014")  # separator
        msg_parts.extend(footer)

    full_msg = "\n".join(msg_parts)

    # Telegram has a 4096 char limit
    if len(full_msg) > 4000:
        full_msg = full_msg[:3990] + "\n..."

    try:
        await update.message.reply_text(full_msg, parse_mode="Markdown")
    except Exception:
        # Fallback to plain text if Markdown parsing fails
        await update.message.reply_text(full_msg)

    # Send dramatic prophecy alert if one was fulfilled
    if prophecy_fulfilled_data:
        prophecy_msg = _format_prophecy_fulfilled(prophecy_fulfilled_data)
        try:
            await update.message.reply_text(prophecy_msg, parse_mode="Markdown")
        except Exception:
            await update.message.reply_text(prophecy_msg)


async def unlink_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle /unlink command."""
    links = load_links()
    chat_id = str(update.effective_chat.id)
    if chat_id not in links:
        await update.message.reply_text("No world linked to this chat.")
        return

    del links[chat_id]
    save_links(links)
    await update.message.reply_text("World unlinked from this chat.")


async def notify_linked_chats(
    world_id: str,
    message: str = "",
    events: list = None,
    prophecy_fulfilled: dict = None,
) -> None:
    """Send rich narrative notifications to all Telegram chats linked to this world.

    Args:
        world_id: The world to notify about.
        message: Plain text fallback / header message.
        events: List of Event objects to format with narrative detail.
        prophecy_fulfilled: Dict with prophecy data (text, explanation, day).
    """
    if not _bot_app:
        return

    links = load_links()
    targets = [cid for cid, wid in links.items() if wid == world_id]
    if not targets:
        return

    # Build the message parts
    parts = []

    # Header / plain message
    if message:
        parts.append(_escape_markdown(message))

    # Rich event formatting
    if events:
        parts.append("")  # separator
        for ev in events[:6]:  # cap at 6 events to avoid hitting Telegram limits
            parts.append(_format_event_block(ev))
            parts.append("")

    # Prophecy fulfillment — dramatic standalone section
    if prophecy_fulfilled:
        parts.append("")
        parts.append(_format_prophecy_fulfilled(prophecy_fulfilled))

    full_msg = "\n".join(parts).strip()

    if not full_msg:
        return

    # Enforce Telegram 4096 char limit
    if len(full_msg) > 4000:
        full_msg = full_msg[:3990] + "\n..."

    for chat_id in targets:
        try:
            await _bot_app.bot.send_message(
                chat_id=int(chat_id),
                text=full_msg,
                parse_mode="Markdown",
            )
        except Exception as e:
            # Retry without Markdown if formatting fails
            logger.debug(f"Markdown send failed for chat {chat_id}: {e}")
            try:
                # Strip markdown formatting for plain text fallback
                plain = full_msg.replace("*", "").replace("_", "")
                await _bot_app.bot.send_message(
                    chat_id=int(chat_id), text=plain
                )
            except Exception as e2:
                logger.warning(f"Failed to notify chat {chat_id}: {e2}")


def create_bot() -> Application | None:
    """Create and configure the Telegram bot. Returns Application or None if no token."""
    global _bot_app
    if not TELEGRAM_BOT_TOKEN:
        return None
    app = Application.builder().token(TELEGRAM_BOT_TOKEN).build()
    app.add_handler(CommandHandler("start", start_cmd))
    app.add_handler(CommandHandler("link", link_cmd))
    app.add_handler(CommandHandler("status", status_cmd))
    app.add_handler(CommandHandler("simulate", simulate_cmd))
    app.add_handler(CommandHandler("unlink", unlink_cmd))
    _bot_app = app
    return app
