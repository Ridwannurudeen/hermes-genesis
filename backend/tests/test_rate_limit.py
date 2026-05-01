import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from rate_limit import _limit_for_path


def test_rate_limit_covers_expensive_generation_routes():
    assert _limit_for_path("/api/worlds") == 6
    assert _limit_for_path("/api/worlds/stream") == 6
    assert _limit_for_path("/api/chronicle/regen/stream") == 3
    assert _limit_for_path("/api/chronicle/submit") == 6


def test_rate_limit_uses_specific_suffix_before_general_suffix():
    assert _limit_for_path("/api/worlds/world_123/simulate/stream") == 12
    assert _limit_for_path("/api/worlds/world_123/simulate/quick") == 20
    assert _limit_for_path("/api/worlds/world_123/simulate") == 12


def test_rate_limit_covers_media_cost_routes():
    assert _limit_for_path("/api/scene-image") == 10
    assert _limit_for_path("/api/chronicle/images/render") == 10
    assert _limit_for_path("/api/chronicle/audio/render") == 10


def test_rate_limit_ignores_read_only_routes():
    assert _limit_for_path("/api/chronicle/articles") is None
    assert _limit_for_path("/api/health") is None
