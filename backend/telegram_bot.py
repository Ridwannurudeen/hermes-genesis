import json
import os
import logging
from telegram import Update
from telegram.ext import Application, CommandHandler, ContextTypes
from config import DATA_DIR, TELEGRAM_BOT_TOKEN
from store import load_world
from simulation import simulate_tick

logger = logging.getLogger(__name__)

_bot_app: Application | None = None
_links_path = os.path.join(DATA_DIR, "telegram_links.json")


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
    """Handle /status command."""
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

    faction_count = len(world.factions) if world.factions else 0
    alive = sum(1 for c in world.characters if c.alive)
    dead = sum(1 for c in world.characters if not c.alive)

    await update.message.reply_text(
        f"World: {world.name}\n"
        f"Day: {world.current_day}\n"
        f"Factions: {faction_count}\n"
        f"Characters: {alive} alive / {dead} dead"
    )


async def simulate_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle /simulate command — advance 1 day."""
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

    events = simulate_tick(world)
    world = load_world(world_id)

    # Count events by type
    type_counts: dict[str, int] = {}
    for ev in events:
        type_counts[ev.type] = type_counts.get(ev.type, 0) + 1

    summary = f"Day {world.current_day} complete — {len(events)} events\n\n"
    for etype, count in type_counts.items():
        summary += f"  {etype}: {count}\n"
    summary += "\nEvents:\n"
    for ev in events:
        summary += f"  - {ev.title}\n"

    await update.message.reply_text(summary)


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


async def notify_linked_chats(world_id: str, message: str) -> None:
    """Send a message to all Telegram chats linked to this world."""
    if not _bot_app:
        return
    links = load_links()
    for chat_id, linked_world_id in links.items():
        if linked_world_id == world_id:
            try:
                await _bot_app.bot.send_message(chat_id=int(chat_id), text=message)
            except Exception as e:
                logger.warning(f"Failed to notify chat {chat_id}: {e}")


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
