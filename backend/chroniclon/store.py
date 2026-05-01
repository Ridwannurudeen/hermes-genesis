"""Chroniclon persistence — atomic JSON writes with cross-process file locks.

Mirrors backend/store.py's approach. One file per article, one file per era,
one global lexicon file for the linguistic family tree.
"""
import asyncio
import json
import os
import re
import tempfile
from pathlib import Path
from filelock import FileLock, Timeout

import config
from chroniclon.models import Era, WikiArticle, LinguisticEra, CanonSubmission


_FILE_LOCK_TIMEOUT = 10
_article_locks: dict[str, asyncio.Lock] = {}
_era_locks: dict[str, asyncio.Lock] = {}
_slug_locks: dict[str, asyncio.Lock] = {}

# Top-level subdirs under CHRONICLON_DIR
_ARTICLES = "articles"
_ERAS = "eras"
_LEXICON = "lexicon"
_SUBMISSIONS = "submissions"
_SUBSCRIBERS = "subscribers"


def _safe(name: str) -> str:
    return re.sub(r"[^a-zA-Z0-9_\-]", "", name)


def _base_dir() -> Path:
    return Path(os.getenv("CHRONICLON_DIR") or config.CHRONICLON_DIR)


def _path(kind: str, key: str) -> Path:
    return _base_dir() / kind / f"{_safe(key)}.json"


def _lock_path(kind: str, key: str) -> Path:
    return _base_dir() / kind / f".{_safe(key)}.lock"


def _atomic_write(path: Path, data: str, lock: FileLock) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    try:
        with lock:
            fd, tmp = tempfile.mkstemp(dir=path.parent, suffix=".tmp")
            try:
                with os.fdopen(fd, "w", encoding="utf-8") as f:
                    f.write(data)
                os.replace(tmp, str(path))
            except Exception:
                try:
                    os.unlink(tmp)
                except OSError:
                    pass
                raise
    except Timeout:
        raise RuntimeError(f"file lock timeout: {path}")


def article_lock(article_id: str) -> asyncio.Lock:
    if article_id not in _article_locks:
        _article_locks[article_id] = asyncio.Lock()
    return _article_locks[article_id]


def article_lock_by_slug(slug: str) -> asyncio.Lock:
    """Per-slug asyncio lock for concurrent media updates on the same article.
    Image and audio render can fire in parallel; without this lock both load
    a stale copy then race-save, clobbering each other's url field.
    """
    if slug not in _slug_locks:
        _slug_locks[slug] = asyncio.Lock()
    return _slug_locks[slug]


def era_lock(era_id: str) -> asyncio.Lock:
    if era_id not in _era_locks:
        _era_locks[era_id] = asyncio.Lock()
    return _era_locks[era_id]


# ---------- articles ----------

def _resolve_unique_slug(desired: str, article_id: str) -> str:
    """Return `desired`, or `desired-2`, `desired-3`, … if a *different*
    article already owns the slug. Re-saving the same article (audio URL
    update, illustration backfill, era recalibration) keeps its existing
    slug. Without this guard the canon agent silently wrote dupes whenever
    two articles converged on the same title — 255 collisions in the live
    store before this landed."""
    d = _base_dir() / _ARTICLES
    if not d.exists():
        return desired
    used: dict[str, str] = {}  # slug -> article_id that owns it
    for f in d.glob("*.json"):
        if f.name.startswith("."):
            continue
        try:
            data = json.loads(f.read_text(encoding="utf-8"))
        except Exception:
            continue
        s = data.get("slug")
        if s and s not in used:
            used[s] = data.get("article_id", "")

    if used.get(desired) in (None, article_id):
        return desired

    n = 2
    while True:
        candidate = f"{desired}-{n}"
        if used.get(candidate) in (None, article_id):
            return candidate
        n += 1


def save_article(article: WikiArticle) -> None:
    article.slug = _resolve_unique_slug(article.slug, article.article_id)
    path = _path(_ARTICLES, article.article_id)
    flock = FileLock(str(_lock_path(_ARTICLES, article.article_id)), timeout=_FILE_LOCK_TIMEOUT)
    _atomic_write(path, json.dumps(article.model_dump(mode="json"), indent=2, default=str), flock)


def load_article(article_id: str) -> WikiArticle | None:
    path = _path(_ARTICLES, article_id)
    if not path.exists():
        return None
    flock = FileLock(str(_lock_path(_ARTICLES, article_id)), timeout=_FILE_LOCK_TIMEOUT)
    with flock:
        return WikiArticle.model_validate(json.loads(path.read_text(encoding="utf-8")))


def load_article_by_slug(slug: str) -> WikiArticle | None:
    d = _base_dir() / _ARTICLES
    if not d.exists():
        return None
    for f in d.glob("*.json"):
        if f.name.startswith("."):
            continue
        try:
            data = json.loads(f.read_text(encoding="utf-8"))
            if data.get("slug") == slug:
                return WikiArticle.model_validate(data)
        except Exception:
            continue
    return None


def list_articles(
    era_id: str | None = None,
    kind: str | None = None,
    limit: int = 100,
    offset: int = 0,
) -> list[dict]:
    """Most-recent-first article list. Slug-deduped at this layer because
    the live data has 255 collisions (separate canonization runs producing
    the same title); without dedupe the same article appears twice in
    Chronicle. The first occurrence (most recent by mtime) wins. Also
    surfaces anti_slop_score + fact_check_score so the frontend can curate
    by quality, not just recency."""
    d = _base_dir() / _ARTICLES
    if not d.exists():
        return []
    rows: list[dict] = []
    seen_slugs: set[str] = set()
    for f in sorted(d.glob("*.json"), key=lambda p: p.stat().st_mtime, reverse=True):
        if f.name.startswith("."):
            continue
        try:
            a = json.loads(f.read_text(encoding="utf-8"))
        except Exception:
            continue
        if era_id and a.get("era_id") != era_id:
            continue
        if kind and a.get("kind") != kind:
            continue
        slug = a.get("slug")
        if slug in seen_slugs:
            continue
        seen_slugs.add(slug)
        rows.append({
            "article_id": a["article_id"],
            "slug": a["slug"],
            "title": a["title"],
            "kind": a["kind"],
            "era_id": a["era_id"],
            "in_world_year": a["in_world_year"],
            "voice": a.get("voice", "scholarly"),
            "word_count": a.get("word_count", 0),
            "contributor": a.get("contributor"),
            "audio_url": a.get("audio_url"),
            "illustration_url": a.get("illustration_url"),
            "anti_slop_score": a.get("anti_slop_score"),
            "fact_check_score": a.get("fact_check_score"),
            "updated_at": a.get("updated_at"),
        })
    return rows[offset : offset + limit]


def search_articles(query: str, limit: int = 20) -> list[dict]:
    """Substring match on title (priority) + body_md. Lightweight scan over
    the JSON store — fine for ~thousands of articles. For larger corpora,
    swap in SQLite FTS or a real index."""
    q = query.strip().lower()
    if not q:
        return []
    d = _base_dir() / _ARTICLES
    if not d.exists():
        return []
    # (-title_len, filename) is the sort key — the JSON filename is the only
    # truly unique tiebreaker (slugs collide in the live store), so Python
    # never falls back to comparing dict bodies (which raises TypeError).
    # Also dedupe by slug so the same article doesn't show up twice in results.
    title_hits: list[tuple[int, str, dict]] = []
    body_hits: list[tuple[int, str, dict]] = []
    for f in d.glob("*.json"):
        if f.name.startswith("."):
            continue
        try:
            a = json.loads(f.read_text(encoding="utf-8"))
        except Exception:
            continue
        title = (a.get("title") or "").lower()
        body = (a.get("body_md") or "").lower()
        row = {
            "slug": a["slug"],
            "title": a["title"],
            "kind": a["kind"],
            "in_world_year": a.get("in_world_year"),
            "voice": a.get("voice", "scholarly"),
            "snippet": "",
        }
        if q in title:
            row["snippet"] = (a.get("body_md") or "")[:160].replace("\n", " ")
            title_hits.append((-len(title), f.name, row))
        elif q in body:
            idx = body.find(q)
            start = max(0, idx - 60)
            end = min(len(body), idx + len(q) + 100)
            row["snippet"] = ("…" if start > 0 else "") + (a.get("body_md") or "")[start:end].replace("\n", " ")
            body_hits.append((-len(title), f.name, row))
    title_hits.sort()
    body_hits.sort()
    seen_slugs: set[str] = set()
    out: list[dict] = []
    for _, _, r in title_hits + body_hits:
        if r["slug"] in seen_slugs:
            continue
        seen_slugs.add(r["slug"])
        out.append(r)
        if len(out) >= limit:
            break
    return out


def article_count(era_id: str | None = None) -> int:
    d = _base_dir() / _ARTICLES
    if not d.exists():
        return 0
    if era_id is None:
        return sum(1 for f in d.glob("*.json") if not f.name.startswith("."))
    n = 0
    for f in d.glob("*.json"):
        if f.name.startswith("."):
            continue
        try:
            a = json.loads(f.read_text(encoding="utf-8"))
            if a.get("era_id") == era_id:
                n += 1
        except Exception:
            continue
    return n


def total_word_count() -> int:
    d = _base_dir() / _ARTICLES
    if not d.exists():
        return 0
    total = 0
    for f in d.glob("*.json"):
        if f.name.startswith("."):
            continue
        try:
            a = json.loads(f.read_text(encoding="utf-8"))
            total += int(a.get("word_count", 0))
        except Exception:
            continue
    return total


# ---------- eras ----------

def save_era(era: Era) -> None:
    path = _path(_ERAS, era.era_id)
    flock = FileLock(str(_lock_path(_ERAS, era.era_id)), timeout=_FILE_LOCK_TIMEOUT)
    _atomic_write(path, json.dumps(era.model_dump(mode="json"), indent=2, default=str), flock)


def load_era(era_id: str) -> Era | None:
    path = _path(_ERAS, era_id)
    if not path.exists():
        return None
    return Era.model_validate(json.loads(path.read_text(encoding="utf-8")))


def list_eras() -> list[Era]:
    d = _base_dir() / _ERAS
    if not d.exists():
        return []
    eras: list[Era] = []
    for f in d.glob("*.json"):
        if f.name.startswith("."):
            continue
        try:
            eras.append(Era.model_validate(json.loads(f.read_text(encoding="utf-8"))))
        except Exception:
            continue
    eras.sort(key=lambda e: e.ordinal)
    return eras


# ---------- lexicon (linguistic family tree) ----------

def save_linguistic_era(le: LinguisticEra) -> None:
    path = _path(_LEXICON, le.era_id)
    flock = FileLock(str(_lock_path(_LEXICON, le.era_id)), timeout=_FILE_LOCK_TIMEOUT)
    _atomic_write(path, json.dumps(le.model_dump(mode="json"), indent=2, default=str), flock)


def list_linguistic_eras() -> list[LinguisticEra]:
    d = _base_dir() / _LEXICON
    if not d.exists():
        return []
    out: list[LinguisticEra] = []
    for f in d.glob("*.json"):
        if f.name.startswith("."):
            continue
        try:
            out.append(LinguisticEra.model_validate(json.loads(f.read_text(encoding="utf-8"))))
        except Exception:
            continue
    out.sort(key=lambda x: x.in_world_year)
    return out


# ---------- audience submissions ----------

def save_submission(sub: CanonSubmission) -> None:
    path = _path(_SUBMISSIONS, sub.submission_id)
    flock = FileLock(str(_lock_path(_SUBMISSIONS, sub.submission_id)), timeout=_FILE_LOCK_TIMEOUT)
    _atomic_write(path, json.dumps(sub.model_dump(mode="json"), indent=2, default=str), flock)


def list_submissions(status: str | None = None) -> list[CanonSubmission]:
    d = _base_dir() / _SUBMISSIONS
    if not d.exists():
        return []
    out: list[CanonSubmission] = []
    for f in d.glob("*.json"):
        if f.name.startswith("."):
            continue
        try:
            sub = CanonSubmission.model_validate(json.loads(f.read_text(encoding="utf-8")))
            if status is None or sub.moderation == status:
                out.append(sub)
        except Exception:
            continue
    out.sort(key=lambda s: s.submitted_at, reverse=True)
    return out


def contributor_count() -> int:
    handles = set()
    for s in list_submissions():
        if s.canonized_article_id:
            handles.add(s.contributor_handle)
    return len(handles)


# ---------- canon subscribers ----------

import hashlib
from datetime import datetime, timezone


def _subscriber_key(email: str) -> str:
    """Deterministic, filename-safe key from email — also serves as the
    dedupe key so two POSTs from the same address overwrite, not append."""
    return hashlib.sha256(email.strip().lower().encode("utf-8")).hexdigest()[:24]


def add_subscriber(email: str, source: str | None = None) -> bool:
    """Add an email to the canon subscriber list. Returns True if newly
    added, False if already subscribed (idempotent)."""
    key = _subscriber_key(email)
    path = _path(_SUBSCRIBERS, key)
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists():
        return False
    flock = FileLock(str(_lock_path(_SUBSCRIBERS, key)), timeout=_FILE_LOCK_TIMEOUT)
    payload = {
        "email": email.strip().lower(),
        "subscribed_at": datetime.now(timezone.utc).isoformat(),
        "source": source or "site",
        "token": _subscriber_unsubscribe_token(email),
    }
    _atomic_write(path, json.dumps(payload, indent=2), flock)
    return True


def _subscriber_unsubscribe_token(email: str) -> str:
    """Per-email opaque token for one-click unsubscribe. Derived from the
    email + a server secret so it's unguessable without server access."""
    secret = os.getenv("UNSUBSCRIBE_SECRET", "chroniclon-default-secret-change-me")
    return hashlib.sha256(f"{email.strip().lower()}::{secret}".encode("utf-8")).hexdigest()[:32]


def remove_subscriber_by_token(token: str) -> str | None:
    """Remove the subscriber whose unsubscribe token matches. Returns the
    email that was removed, or None if no match."""
    d = _base_dir() / _SUBSCRIBERS
    if not d.exists():
        return None
    for f in d.glob("*.json"):
        if f.name.startswith("."):
            continue
        try:
            data = json.loads(f.read_text(encoding="utf-8"))
        except Exception:
            continue
        if data.get("token") == token:
            email = data.get("email")
            try:
                f.unlink()
            except OSError:
                return None
            return email
    return None


def subscriber_count() -> int:
    d = _base_dir() / _SUBSCRIBERS
    if not d.exists():
        return 0
    return sum(1 for f in d.glob("*.json") if not f.name.startswith("."))


def last_article_mtime_iso() -> str | None:
    """ISO timestamp of the most-recently-saved article. Powers the Masthead
    freshness pill ('last canon write 4 minutes ago') and any UI that needs
    to show 'the publication is alive' without a full poll cycle."""
    d = _base_dir() / _ARTICLES
    if not d.exists():
        return None
    latest = 0.0
    for f in d.glob("*.json"):
        if f.name.startswith("."):
            continue
        try:
            m = f.stat().st_mtime
            if m > latest:
                latest = m
        except OSError:
            continue
    if latest == 0.0:
        return None
    return datetime.fromtimestamp(latest, tz=timezone.utc).isoformat()
