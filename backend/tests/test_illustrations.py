"""Showcase-illustration ranker — pure logic, no LLM calls."""

import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from chroniclon.illustrations import _showcase_score


def test_showcase_score_prefers_long_articles():
    short = {"word_count": 200}
    long = {"word_count": 2000}
    assert _showcase_score(long) > _showcase_score(short)


def test_showcase_score_rewards_audio():
    plain = {"word_count": 1000}
    with_audio = {"word_count": 1000, "audio_url": "/api/chronicle/audio/x"}
    assert _showcase_score(with_audio) > _showcase_score(plain)


def test_showcase_score_rewards_kimi_writer():
    nous = {"word_count": 1000, "writer_label": "Hermes-4-70B"}
    kimi = {"word_count": 1000, "writer_label": "Kimi K2.6"}
    assert _showcase_score(kimi) > _showcase_score(nous)


def test_showcase_score_demotes_already_illustrated():
    fresh = {"word_count": 800}
    used = {"word_count": 5000, "illustration_url": "/api/chronicle/images/x"}
    # Even with way more words, an already-illustrated article scores below
    # a fresh candidate (the demotion is large enough to dominate).
    assert _showcase_score(fresh) > _showcase_score(used)


def test_showcase_score_combines_signals():
    a = {"word_count": 600, "writer_label": "Kimi K2.6", "audio_url": "x", "anti_slop_score": 0.9}
    b = {"word_count": 1500}
    # a stacks every bonus → still beats a longer plain article.
    assert _showcase_score(a) > _showcase_score(b)
