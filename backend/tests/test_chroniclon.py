import os
import sys
import tempfile
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

# Use a temp dir for chroniclon data so tests don't pollute real data
_TEST_DIR = tempfile.mkdtemp(prefix="chroniclon_test_")
os.environ["CHRONICLON_DIR"] = _TEST_DIR

import importlib
import chroniclon.store as store_mod
importlib.reload(store_mod)

from chroniclon.models import Era, WikiArticle, LinguisticEra, CanonSubmission
from chroniclon.article_writer import _slugify, _word_count, _extract_backlinks
from chroniclon.critics import apply_crosslinks


def test_slugify_basic():
    assert _slugify("The Salt Wars of the Cinder Era") == "the-salt-wars-of-the-cinder-era"


def test_slugify_strips_symbols():
    s = _slugify("Queen Aelis II!! Has   Spaces & symbols")
    assert s == "queen-aelis-ii-has-spaces-symbols"


def test_word_count_unwraps_crosslinks():
    md = "Some **markdown** body with [[queen-aelis]] link."
    # tokens: Some **markdown** body with queen-aelis link.
    assert _word_count(md) == 6


def test_word_count_strips_inline_code():
    md = "Use `inline code` and more text"
    assert _word_count(md) == 4  # Use, and, more, text


def test_extract_backlinks_dedups():
    md = "See [[queen-aelis]] and [[the-cinder-era]]. Also [[queen-aelis]] again."
    assert sorted(_extract_backlinks(md)) == ["queen-aelis", "the-cinder-era"]


def test_apply_crosslinks_inserts_first_only():
    md = "The queen rode forth at dawn. The queen returned at dusk."
    out = apply_crosslinks(md, [{"slug": "queen-aelis", "anchor_text": "The queen"}])
    assert out.count("[[queen-aelis]]") == 1
    assert out.startswith("[[queen-aelis]] rode")


def test_apply_crosslinks_skips_existing():
    md = "Already linked: [[queen-aelis]] here. The queen returns."
    out = apply_crosslinks(md, [{"slug": "queen-aelis", "anchor_text": "The queen"}])
    assert out.count("[[queen-aelis]]") == 1


def test_save_load_article_roundtrip():
    a = WikiArticle(
        article_id="art_test_001",
        slug="test-article",
        title="Test Article",
        kind="event",
        era_id="era_0",
        in_world_year=42,
        body_md="# Test Article\n\nBody text here.",
        word_count=4,
    )
    store_mod.save_article(a)
    loaded = store_mod.load_article("art_test_001")
    assert loaded is not None
    assert loaded.title == "Test Article"
    assert loaded.in_world_year == 42

    by_slug = store_mod.load_article_by_slug("test-article")
    assert by_slug is not None
    assert by_slug.article_id == "art_test_001"


def test_article_count_and_total_words():
    for i in range(3):
        a = WikiArticle(
            article_id=f"art_count_{i}",
            slug=f"count-{i}",
            title=f"Count {i}",
            kind="event",
            era_id="era_0" if i < 2 else "era_1",
            in_world_year=i,
            body_md="# x\n\n" + ("word " * 10),
            word_count=11,
        )
        store_mod.save_article(a)
    assert store_mod.article_count() >= 3
    assert store_mod.article_count(era_id="era_1") >= 1
    assert store_mod.total_word_count() >= 33


def test_save_load_era():
    e = Era(era_id="era_0", name="The Lunar Correspondence", ordinal=0, start_year=0, summary="founding")
    store_mod.save_era(e)
    eras = store_mod.list_eras()
    assert any(x.era_id == "era_0" for x in eras)


def test_submission_lifecycle():
    sub = CanonSubmission(
        submission_id="sub_test_001",
        contributor_handle="testuser",
        seed_text="A meteor lands in the eastern desert.",
    )
    store_mod.save_submission(sub)
    pending = store_mod.list_submissions("pending")
    assert any(s.submission_id == "sub_test_001" for s in pending)
    assert store_mod.contributor_count() == 0  # not canonized yet

    sub.canonized_article_id = "art_test_001"
    store_mod.save_submission(sub)
    assert store_mod.contributor_count() >= 1


def test_linguistic_era():
    le = LinguisticEra(
        era_id="lang_0",
        era_name="Old Lunar",
        in_world_year=0,
        sample_lexicon={"moon": "vael", "queen": "aelin"},
        sample_text="Vael spoke to aelin in the long dark.",
    )
    store_mod.save_linguistic_era(le)
    out = store_mod.list_linguistic_eras()
    assert any(x.era_id == "lang_0" for x in out)


def test_era_close_thresholds():
    """should_review_close + must_close fire at correct article counts."""
    from chroniclon.era import should_review_close, must_close, ERA_REVIEW_AFTER, ERA_HARD_CLOSE_AT
    e = Era(era_id="era_thresh", name="Thresh Era", ordinal=99, start_year=0)
    store_mod.save_era(e)
    # No articles yet
    assert not should_review_close(e)
    assert not must_close(e)
    # Add ERA_REVIEW_AFTER articles to this era
    for i in range(ERA_REVIEW_AFTER):
        store_mod.save_article(WikiArticle(
            article_id=f"art_thresh_{i}",
            slug=f"thresh-{i}",
            title=f"Thresh {i}",
            kind="event",
            era_id="era_thresh",
            in_world_year=i,
            body_md="x",
            word_count=1,
        ))
    assert should_review_close(e)
    assert not must_close(e)
    # Hit hard ceiling
    for i in range(ERA_REVIEW_AFTER, ERA_HARD_CLOSE_AT):
        store_mod.save_article(WikiArticle(
            article_id=f"art_thresh_{i}",
            slug=f"thresh-{i}",
            title=f"Thresh {i}",
            kind="event",
            era_id="era_thresh",
            in_world_year=i,
            body_md="x",
            word_count=1,
        ))
    assert must_close(e)


def test_ordinal_word():
    from chroniclon.era import ordinal_word
    assert ordinal_word(0) == "founding"
    assert ordinal_word(1) == "second"
    assert ordinal_word(99) == "99th"


def test_runner_cursor_advances_after_match():
    from chroniclon.runner import _new_events_since
    class W:
        events = [
            {"id": "e1", "day": 1},
            {"id": "e2", "day": 2},
            {"id": "e3", "day": 3},
        ]
    assert len(_new_events_since(W, None)) == 3
    assert [e["id"] for e in _new_events_since(W, "e1")] == ["e2", "e3"]
    # Cursor refers to a missing event — replay everything
    assert len(_new_events_since(W, "e_missing")) == 3


def test_voice_archetype_mapping():
    from chroniclon.voices import voice_archetype_from_genome
    warrior = {"courage": 0.9, "cunning": 0.3, "loyalty": 0.5, "ambition": 0.5, "empathy": 0.3, "resilience": 0.8}
    assert voice_archetype_from_genome(warrior) == "warrior"
    schemer = {"courage": 0.4, "cunning": 0.85, "loyalty": 0.3, "ambition": 0.8, "empathy": 0.3, "resilience": 0.4}
    assert voice_archetype_from_genome(schemer) == "schemer"
    scholar = {"courage": 0.4, "cunning": 0.5, "loyalty": 0.8, "ambition": 0.3, "empathy": 0.85, "resilience": 0.4}
    assert voice_archetype_from_genome(scholar) == "scholar"
    mid = {"courage": 0.5, "cunning": 0.5, "loyalty": 0.5, "ambition": 0.5, "empathy": 0.5, "resilience": 0.5}
    assert voice_archetype_from_genome(mid) == "narrator"


def test_voices_provider_switch():
    import os
    from chroniclon.voices import get_provider, voice_id_for, _ELEVENLABS_DEFAULTS, _OPENAI_DEFAULTS
    os.environ.pop("TTS_PROVIDER", None)
    assert get_provider() == "none"
    os.environ["TTS_PROVIDER"] = "openai"
    assert get_provider() == "openai"
    assert voice_id_for("warrior") == _OPENAI_DEFAULTS["warrior"]
    os.environ["TTS_PROVIDER"] = "elevenlabs"
    assert get_provider() == "elevenlabs"
    assert voice_id_for("mystic") == _ELEVENLABS_DEFAULTS["mystic"]
    os.environ.pop("TTS_PROVIDER", None)


def test_moon_dry_run_defaults():
    from chroniclon import moon
    assert moon.MOON_X_DRY_RUN is True
    assert moon.MOON_X_LIVE is False


def test_moon_safety_prompt_shape():
    from chroniclon.moon import _safety_prompt
    p = _safety_prompt("a small post")
    assert "Candidate Moon post" in p
    assert "approve" in p
    assert '"approve":' in p


def test_extract_tool_call_args_happy_path():
    from llm import extract_tool_call_args
    raw = '<tool_call>{"name": "submit_x", "arguments": {"score": 0.9, "verdict": "approve"}}</tool_call>'
    args = extract_tool_call_args(raw, "submit_x")
    assert args == {"score": 0.9, "verdict": "approve"}


def test_extract_tool_call_args_with_prose():
    from llm import extract_tool_call_args
    raw = 'Reasoning... \n\n<tool_call>{"name": "x", "arguments": {"a": 1}}</tool_call>\nDone.'
    assert extract_tool_call_args(raw, "x") == {"a": 1}


def test_extract_tool_call_args_wrong_name():
    from llm import extract_tool_call_args
    raw = '<tool_call>{"name": "other_tool", "arguments": {}}</tool_call>'
    assert extract_tool_call_args(raw, "expected_tool") is None


def test_extract_tool_call_args_malformed_json():
    from llm import extract_tool_call_args
    raw = '<tool_call>{"name": "x", "arguments": {invalid}}</tool_call>'
    assert extract_tool_call_args(raw, "x") is None


def test_extract_tool_call_args_no_envelope():
    from llm import extract_tool_call_args
    assert extract_tool_call_args('{"a": 1}', "x") is None
    assert extract_tool_call_args("", "x") is None


def test_diversity_hint_fires_on_dominant_voice():
    from chroniclon.canon_agent import _diversity_hint
    recent = [{"voice": "scholarly"}] * 9 + [{"voice": "newspaper"}] * 3
    hint = _diversity_hint(recent)
    assert "scholarly" in hint
    assert "Reach for a different register" in hint


def test_diversity_hint_quiet_when_diverse():
    from chroniclon.canon_agent import _diversity_hint
    recent = [{"voice": v} for v in ["scholarly", "newspaper", "court", "diary", "scripture", "scholarly"]]
    assert _diversity_hint(recent) == ""


def test_fallback_voice_distribution():
    from collections import Counter
    from chroniclon.canon_agent import _pick_fallback_voice, _VOICE_POOL
    samples = Counter(_pick_fallback_voice() for _ in range(2000))
    # Every legal voice must appear at least once across 2000 draws.
    for v in _VOICE_POOL:
        assert samples[v] > 0, f"{v} never picked in 2000 draws"
    # No voice runs away with more than 50% of mass.
    assert max(samples.values()) < 1000


def test_illustration_prompt_grounds_era_and_character():
    from chroniclon.illustrations import build_prompt
    char = {
        "name": "Aelis",
        "role": "Queen",
        "genome": {
            "courage": 0.9, "cunning": 0.4, "loyalty": 0.6,
            "ambition": 0.7, "empathy": 0.4, "resilience": 0.85,
        },
    }
    p = build_prompt(
        kind="person",
        title="Queen Aelis the Younger",
        era_art_style="charcoal woodcut, sepia tones, smoke-stained vellum",
        character=char,
    )
    assert "Aelis" in p
    assert "Queen" in p
    # Warrior descriptor (high courage + resilience) leaks into prompt.
    assert "warrior" in p.lower() or "scarred" in p.lower()
    assert "charcoal" in p
    assert "no text" in p.lower()


def test_illustration_prompt_no_character():
    from chroniclon.illustrations import build_prompt
    p = build_prompt(
        kind="artifact",
        title="The Lunar Epistle",
        era_art_style="hand-illuminated manuscript, parchment tones",
        character=None,
    )
    assert "Lunar Epistle" in p
    assert "Featured" not in p  # no character → no Featured: clause
