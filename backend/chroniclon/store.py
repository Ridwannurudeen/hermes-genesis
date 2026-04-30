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

def save_article(article: WikiArticle) -> None:
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
    d = _base_dir() / _ARTICLES
    if not d.exists():
        return []
    rows: list[dict] = []
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
            "updated_at": a.get("updated_at"),
        })
    return rows[offset : offset + limit]


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
