# tests/test_games_today.py
import sys
import pathlib
from typing import Any, Dict, List

# Ensure project root is on sys.path so `app` can be imported
sys.path.append(str(pathlib.Path(__file__).resolve().parents[1]))

import httpx
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


class DummyESPNResponse:
    """Simple stand-in for httpx.Response used by /games/today tests."""

    def __init__(self, json_data: Dict[str, Any], status_code: int = 200):
        self._json_data = json_data
        self.status_code = status_code

    def json(self) -> Dict[str, Any]:
        return self._json_data


def _build_sample_scoreboard() -> Dict[str, Any]:
    """Minimal but representative slice of the real ESPN scoreboard structure."""
    return {
        "season": {"year": 2025},
        "week": {"number": 8},
        "events": [
            {
                "id": "GAME123",
                "season": {"year": 2025},
                "week": {"number": 8},
                "competitions": [
                    {
                        "date": "2025-10-19T17:00:00Z",
                        "status": {
                            "type": {
                                "id": "2",
                                "name": "STATUS_IN_PROGRESS",
                                "state": "in",
                                "completed": False,
                                "description": "2nd Quarter",
                                "detail": "2nd Qtr 07:12",
                                "shortDetail": "2nd 7:12",
                                "period": 2,
                                "displayClock": "7:12",
                            }
                        },
                        "competitors": [
                            {
                                "homeAway": "home",
                                "score": "21",
                                "team": {
                                    "id": "12",
                                    "location": "Kansas City",
                                    "name": "Chiefs",
                                    "displayName": "Kansas City Chiefs",
                                    "abbreviation": "KC",
                                },
                                "records": [{"summary": "4-3"}],
                            },
                            {
                                "homeAway": "away",
                                "score": "14",
                                "team": {
                                    "id": "8",
                                    "location": "Cincinnati",
                                    "name": "Bengals",
                                    "displayName": "Cincinnati Bengals",
                                    "abbreviation": "CIN",
                                },
                                "records": [{"summary": "3-4"}],
                            },
                        ],
                        "situation": {
                            "yardLine": 82,
                            "isRedZone": True,
                        },
                    }
                ],
            }
        ],
    }


def test_games_today_happy_path(monkeypatch):
    """Happy-path test for /games/today.

    Ensures that:
    - We call the ESPN scoreboard endpoint.
    - We map events into a list of game objects with the expected shape.
    - Red zone flag is derived from the situation.
    """
    sample_json = _build_sample_scoreboard()

    def fake_get(url: str, *args, **kwargs):
        # We don't care about exact params, just that it's the scoreboard endpoint.
        assert "scoreboard" in url
        return DummyESPNResponse(sample_json)

    monkeypatch.setattr(httpx, "get", fake_get)

    resp = client.get("/games/today")
    assert resp.status_code == 200

    data = resp.json()
    assert "games" in data
    games: List[Dict[str, Any]] = data["games"]
    assert isinstance(games, list)
    assert len(games) >= 1

    g0 = games[0]
    # Core keys we expect on each game object
    for key in [
        "game_id",
        "league",
        "season",
        "week",
        "status",
        "quarter",
        "clock",
        "kickoff_time_utc",
        "home_team",
        "away_team",
        "red_zone",
    ]:
        assert key in g0

    assert g0["game_id"] == "GAME123"
    assert g0["league"] == "NFL"
    assert g0["season"] == 2025
    assert g0["week"] == 8
    assert g0["status"] in ["in", "pre", "post", "halftime", "final", "delayed"]
    assert g0["quarter"] == 2
    assert g0["clock"] == "7:12"
    assert g0["kickoff_time_utc"] == "2025-10-19T17:00:00Z"
    assert g0["red_zone"] is True

    # Team objects should be shaped like our Header team mapping
    home = g0["home_team"]
    away = g0["away_team"]
    for team in (home, away):
        for key in ["id", "name", "full_name", "abbreviation", "record", "score"]:
            assert key in team

    assert home["id"] == "12"
    assert away["id"] == "8"


def test_games_today_handles_espn_error(monkeypatch):
    """If ESPN scoreboard returns non-200, we should respond with 502 + JSON error."""

    def fake_get_error(url: str, *args, **kwargs):
        return DummyESPNResponse({"error": "upstream fail"}, status_code=500)

    monkeypatch.setattr(httpx, "get", fake_get_error)

    resp = client.get("/games/today")
    assert resp.status_code == 502
    data = resp.json()
    assert "error" in data
