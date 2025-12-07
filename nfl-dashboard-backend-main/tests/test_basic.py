# tests/test_basic.py
import sys
import pathlib
from typing import Any, Dict

# Ensure the project root (containing the `app` package) is on sys.path
sys.path.append(str(pathlib.Path(__file__).resolve().parents[1]))

import httpx
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


class DummyESPNResponse:
    """Simple stand-in for httpx.Response for our tests."""
    def __init__(self, json_data: Dict[str, Any], status_code: int = 200):
        self._json_data = json_data
        self.status_code = status_code

    def json(self) -> Dict[str, Any]:
        return self._json_data


def _build_sample_espn_summary(event_id: str) -> Dict[str, Any]:
    """Minimal but representative slice of the real ESPN summary structure.

    This is our contract: app.main should be able to turn this into a full
    GameLiveResponse according to app/schemas.py.
    """
    return {
        "header": {
            "id": event_id,
            "season": {"year": 2025, "type": 2},
            "week": {"number": 8},
            "competitions": [
                {
                    "date": "2025-10-19T20:25:00Z",
                    "status": {
                        "type": {
                            "id": "2",
                            "name": "STATUS_IN_PROGRESS",
                            "state": "in",
                            "completed": False,
                            "description": "2nd Quarter",
                            "detail": "2nd Qtr 10:23",
                            "shortDetail": "2nd 10:23",
                            "period": 2,
                            "displayClock": "10:23",
                        }
                    },
                    "competitors": [
                        {
                            "homeAway": "home",
                            "score": "14",
                            "team": {
                                "id": "12",
                                "location": "Kansas City",
                                "name": "Chiefs",
                                "displayName": "Kansas City Chiefs",
                                "abbreviation": "KC",
                            },
                            "records": [{"summary": "4-3"}],
                            "linescores": [
                                {"period": 1, "value": 7},
                                {"period": 2, "value": 7},
                            ],
                        },
                        {
                            "homeAway": "away",
                            "score": "10",
                            "team": {
                                "id": "8",
                                "location": "Cincinnati",
                                "name": "Bengals",
                                "displayName": "Cincinnati Bengals",
                                "abbreviation": "CIN",
                            },
                            "records": [{"summary": "3-4"}],
                            "linescores": [
                                {"period": 1, "value": 3},
                                {"period": 2, "value": 7},
                            ],
                        },
                    ],
                    "venue": {
                        "fullName": "GEHA Field at Arrowhead Stadium",
                        "address": {"city": "Kansas City", "state": "MO"},
                        "indoor": False,
                    },
                    "broadcasts": [
                        {
                            "names": ["CBS"],
                        }
                    ],
                    "situation": {
                        "possession": "12",
                        "down": 2,
                        "distance": 5,
                        "yardLine": 75,
                        "isRedZone": False,
                        "homeTimeouts": 3,
                        "awayTimeouts": 2,
                        "lastPlay": {
                            "text": "Mahomes pass short right to Kelce for 5 yards",
                        },
                    },
                }
            ],
        },
        "scoringPlays": [
            {
                "id": "1",
                "period": {"number": 1},
                "clock": {"displayValue": "10:15"},
                "team": {"id": "12"},
                "scoringType": {"shortDisplayName": "TD"},
                "text": "Patrick Mahomes pass deep left to Travis Kelce for 20 yards, TOUCHDOWN.",
                "statYardage": 20,
                "scoreValue": 7,
                "athletesInvolved": [
                    {"athlete": {"displayName": "Travis Kelce"}},
                ],
            },
            {
                "id": "2",
                "period": {"number": 2},
                "clock": {"displayValue": "05:30"},
                "team": {"id": "8"},
                "scoringType": {"shortDisplayName": "FG"},
                "text": "Evan McPherson kicks a 42-yard field goal.",
                "statYardage": 42,
                "scoreValue": 3,
                "athletesInvolved": [
                    {"athlete": {"displayName": "Evan McPherson"}},
                ],
            },
        ],
        "boxscore": {
            "teams": [
                {
                    "team": {"id": "12"},
                    "statistics": [
                        {"name": "totalYards", "value": 380},
                        {"name": "totalPlays", "value": 65},
                        {"name": "yardsPerPlay", "value": 5.8},
                        {"name": "passingYards", "value": 300},
                        {"name": "rushingYards", "value": 80},
                        {"name": "turnovers", "value": 1},
                        {"name": "totalPenaltiesYards", "displayValue": "5-45"},
                        {"name": "thirdDownEff", "displayValue": "6-12"},
                        {"name": "redZoneEff", "displayValue": "3-4"},
                        {"name": "timeOfPossession", "displayValue": "32:15"},
                    ],
                },
                {
                    "team": {"id": "8"},
                    "statistics": [
                        {"name": "totalYards", "value": 310},
                        {"name": "totalPlays", "value": 58},
                        {"name": "yardsPerPlay", "value": 5.3},
                        {"name": "passingYards", "value": 245},
                        {"name": "rushingYards", "value": 65},
                        {"name": "turnovers", "value": 2},
                        {"name": "totalPenaltiesYards", "displayValue": "7-60"},
                        {"name": "thirdDownEff", "displayValue": "4-11"},
                        {"name": "redZoneEff", "displayValue": "2-3"},
                        {"name": "timeOfPossession", "displayValue": "27:45"},
                    ],
                },
            ],
            "players": [
                {
                    "team": {"id": "12"},
                    "statistics": [
                        {
                            "name": "passing",
                            "athletes": [
                                {
                                    "athlete": {"displayName": "Patrick Mahomes"},
                                    "stats": {
                                        "completions": 21,
                                        "attempts": 30,
                                        "yards": 285,
                                        "touchdowns": 3,
                                        "interceptions": 1,
                                    },
                                }
                            ],
                        },
                        {
                            "name": "rushing",
                            "athletes": [
                                {
                                    "athlete": {"displayName": "Isiah Pacheco"},
                                    "stats": {
                                        "carries": 15,
                                        "yards": 72,
                                        "touchdowns": 1,
                                    },
                                }
                            ],
                        },
                        {
                            "name": "receiving",
                            "athletes": [
                                {
                                    "athlete": {"displayName": "Travis Kelce"},
                                    "stats": {
                                        "receptions": 8,
                                        "yards": 102,
                                        "touchdowns": 1,
                                    },
                                }
                            ],
                        },
                    ],
                },
                {
                    "team": {"id": "8"},
                    "statistics": [
                        {
                            "name": "passing",
                            "athletes": [
                                {
                                    "athlete": {"displayName": "Joe Burrow"},
                                    "stats": {
                                        "completions": 18,
                                        "attempts": 28,
                                        "yards": 230,
                                        "touchdowns": 1,
                                        "interceptions": 1,
                                    },
                                }
                            ],
                        },
                        {
                            "name": "rushing",
                            "athletes": [
                                {
                                    "athlete": {"displayName": "Joe Mixon"},
                                    "stats": {
                                        "carries": 14,
                                        "yards": 60,
                                        "touchdowns": 0,
                                    },
                                }
                            ],
                        },
                        {
                            "name": "receiving",
                            "athletes": [
                                {
                                    "athlete": {"displayName": "Ja'Marr Chase"},
                                    "stats": {
                                        "receptions": 6,
                                        "yards": 88,
                                        "touchdowns": 1,
                                    },
                                }
                            ],
                        },
                    ],
                },
            ],
        },
    }


def test_health():
    resp = client.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"


def test_game_live_enhanced_shape(monkeypatch):
    """Main "happy path" /games/{id}/live test.

    Asserts that:
    - ESPN summary JSON is transformed into a rich GameLiveResponse shape.
    - Header, scoring, boxscore, analytics have the expected keys populated.
    """
    sample_json = _build_sample_espn_summary("TEST123")

    def fake_get(url: str, *args, **kwargs):
        # We don't care about the exact URL beyond it containing "summary" and correct event id.
        assert "summary" in url
        assert "event=TEST123" in url
        return DummyESPNResponse(sample_json)

    # Patch the httpx client used by our route handler.
    monkeypatch.setattr(httpx, "get", fake_get)

    resp = client.get("/games/TEST123/live")
    assert resp.status_code == 200

    data = resp.json()

    # Top-level keys
    for key in ["header", "drives", "scoring", "boxscore", "meta", "analytics"]:
        assert key in data

    header = data["header"]
    assert header["game_id"] == "TEST123"
    assert header["league"] in ["NFL", "CFB"]
    assert "home_team" in header and "away_team" in header

    # Enhanced header fields
    assert "possession" in header
    assert header["possession"] in [None, "home", "away"]
    assert header["down"] == 2
    assert header["distance"] == 5
    assert header["yard_line"] == 75
    assert header["red_zone"] in [True, False]
    assert header["home_timeouts"] == 3
    assert header["away_timeouts"] == 2
    assert header["last_play_short"] is not None

    # Scoring shape
    scoring = data["scoring"]
    assert isinstance(scoring["summary_by_quarter"], list)
    assert len(scoring["summary_by_quarter"]) >= 1
    first_q = scoring["summary_by_quarter"][0]
    assert "quarter" in first_q and "home_points" in first_q and "away_points" in first_q

    assert isinstance(scoring["plays"], list)
    assert len(scoring["plays"]) >= 2
    play0 = scoring["plays"][0]
    for key in ["id", "quarter", "clock", "team", "type", "description"]:
        assert key in play0
    assert play0["type"] in ["TD", "FG", "Safety", "XP", "2PT", "Other"]

    # TD scorers aggregated
    td_scorers = scoring["touchdown_scorers"]
    assert isinstance(td_scorers, list)
    assert any(
        s["player"] == "Travis Kelce" and s["team"] == "home"
        for s in td_scorers
    )

    # Boxscore team stats
    boxscore = data["boxscore"]
    home_stats = boxscore["team_stats"]["home"]
    away_stats = boxscore["team_stats"]["away"]

    for stats in (home_stats, away_stats):
        for key in [
            "total_yards",
            "plays",
            "yards_per_play",
            "passing_yards",
            "rushing_yards",
            "turnovers",
            "penalties",
            "penalty_yards",
            "third_down_made",
            "third_down_attempts",
            "red_zone_trips",
            "red_zone_tds",
            "time_of_possession",
        ]:
            assert key in stats

    # Player stats lists populated
    player_stats = boxscore["player_stats"]
    for key in ["passing", "rushing", "receiving"]:
        assert key in player_stats
        assert isinstance(player_stats[key], list)
        assert len(player_stats[key]) >= 1

    passer = player_stats["passing"][0]
    for key in [
        "player",
        "team",
        "completions",
        "attempts",
        "yards",
        "touchdowns",
        "interceptions",
    ]:
        assert key in passer

    # Analytics team_success_rates has explicit keys
    analytics = data["analytics"]
    tsr_home = analytics["team_success_rates"]["home"]
    tsr_away = analytics["team_success_rates"]["away"]
    for tsr in (tsr_home, tsr_away):
        for key in ["success_rate", "explosive_play_rate", "epa_per_play"]:
            assert key in tsr


def test_game_live_handles_espn_error(monkeypatch):
    """If ESPN returns a non-200 status, the route should respond with 502 and a JSON error."""

    def fake_get_error(url: str, *args, **kwargs):
        return DummyESPNResponse({"error": "upstream fail"}, status_code=500)

    monkeypatch.setattr(httpx, "get", fake_get_error)

    resp = client.get("/games/TEST123/live")
    assert resp.status_code == 502
    data = resp.json()
    assert "error" in data
