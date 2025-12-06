# tests/test_cfb_scoreboard.py

import os
from typing import Any, Dict, List, Optional

import pytest
from fastapi.testclient import TestClient

from app.main import app  # main FastAPI app (should include the CFB router)
import app.cfb_scoreboard  # noqa: F401  # ensure router module is imported


class DummyResponse:
    def __init__(self, json_data: Any, status_code: int = 200):
        self._json_data = json_data
        self.status_code = status_code
        self.text = "" if isinstance(json_data, (dict, list)) else str(json_data)

    def json(self) -> Any:
        return self._json_data


@pytest.fixture(autouse=True)
def _set_cfbd_key_env(monkeypatch: pytest.MonkeyPatch):
    # Make sure the CFBD API key is set so header building code runs.
    monkeypatch.setenv("CFBD_API_KEY", "test-key")
    yield
    monkeypatch.delenv("CFBD_API_KEY", raising=False)


def test_cfb_scoreboard_happy_path(monkeypatch: pytest.MonkeyPatch):
    sample_games: List[Dict[str, Any]] = [
        {
            "id": 999001,
            "season": 2024,
            "week": 3,
            "season_type": "regular",
            "start_date": "2024-09-14T18:00:00.000Z",
            "neutral_site": False,
            "completed": True,
            "status": "completed",
            "home_id": 1,
            "home_team": "Texas",
            "home_conference": "Big 12",
            "home_points": 35,
            "away_id": 2,
            "away_team": "Alabama",
            "away_conference": "SEC",
            "away_points": 31,
            "venue": "DKR Memorial Stadium",
            "tv": "ESPN",
        }
    ]

    sample_teams: List[Dict[str, Any]] = [
        {
            "id": 1,
            "school": "Texas",
            "mascot": "Longhorns",
            "abbreviation": "TEX",
            "conference": "Big 12",
            "logos": ["https://img.example.com/texas.png"],
        },
        {
            "id": 2,
            "school": "Alabama",
            "mascot": "Crimson Tide",
            "abbreviation": "ALA",
            "conference": "SEC",
            "logos": ["https://img.example.com/alabama.png"],
        },
    ]

    sample_rankings: List[Dict[str, Any]] = [
        {
            "season": 2024,
            "seasonType": "regular",
            "week": 3,
            "poll": "AP Top 25",
            "ranks": [
                {"rank": 4, "school": "Texas", "conference": "Big 12"},
                {"rank": 1, "school": "Alabama", "conference": "SEC"},
            ],
        }
    ]

    def fake_cfbd_get(
        url: str,
        params: Optional[Dict[str, Any]] = None,
        headers: Optional[Dict[str, str]] = None,
        timeout: float = 8.0,
        **kwargs: Any,
    ):
        if "api.collegefootballdata.com/games" in url:
            return DummyResponse(sample_games, status_code=200)
        if "api.collegefootballdata.com/teams/fbs" in url:
            return DummyResponse(sample_teams, status_code=200)
        if "api.collegefootballdata.com/rankings" in url:
            return DummyResponse(sample_rankings, status_code=200)
        return DummyResponse({"error": "not found"}, status_code=404)

    monkeypatch.setattr("app.cfb_scoreboard.httpx.get", fake_cfbd_get)

    client = TestClient(app)
    resp = client.get("/cfb/scoreboard", params={"year": 2024, "week": 3})
    assert resp.status_code == 200

    data = resp.json()
    assert data["season"] == 2024
    assert data["week"] == 3
    assert "games" in data
    assert isinstance(data["games"], list)
    assert len(data["games"]) == 1

    g = data["games"][0]
    assert g["game_id"] == "999001"
    assert g["league"] == "CFB"
    assert g["status"] in {"final", "post"}  # depending on normalization choice

    home = g["home_team"]
    away = g["away_team"]

    assert home["name"] == "Texas"
    assert home["score"] == 35
    assert home["logo_url"] == "https://img.example.com/texas.png"
    assert home["rank"] == 4

    assert away["name"] == "Alabama"
    assert away["score"] == 31
    assert away["logo_url"] == "https://img.example.com/alabama.png"
    assert away["rank"] == 1

    # tv network, venue, kick time
    assert g["tv_network"] == "ESPN"
    assert g["venue_name"] == "DKR Memorial Stadium"
    assert g["kickoff_time_utc"] == "2024-09-14T18:00:00.000Z"


def test_cfb_scoreboard_upstream_error(monkeypatch: pytest.MonkeyPatch):
    def fake_cfbd_get_error(
        url: str,
        params: Optional[Dict[str, Any]] = None,
        headers: Optional[Dict[str, str]] = None,
        timeout: float = 8.0,
        **kwargs: Any,
    ):
        return DummyResponse({"error": "upstream fail"}, status_code=500)

    monkeypatch.setattr("app.cfb_scoreboard.httpx.get", fake_cfbd_get_error)

    client = TestClient(app)
    resp = client.get("/cfb/scoreboard", params={"year": 2024, "week": 3})
    assert resp.status_code == 502

    data = resp.json()
    assert data["error"] == "CollegeFootballData upstream error"
    assert "upstream" in data["message"]
