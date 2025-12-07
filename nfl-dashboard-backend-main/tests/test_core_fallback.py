# tests/test_core_fallback.py
from typing import Any, Dict, List

from fastapi.testclient import TestClient

from app.main import app, ESPN_NFL_CORE_EVENT_BASE

client = TestClient(app)


class DummyESPNResponse:
    def __init__(self, data: Dict[str, Any], status_code: int = 200):
        self._data = data
        self.status_code = status_code

    def json(self) -> Dict[str, Any]:
        return self._data


def test_core_fallback_used_when_summary_404(monkeypatch):
    """
    When the Site summary endpoint returns 404, /games/{id}/live should fall back
    to the ESPN Core API and still return a valid GameLiveResponse.
    """
    calls: List[str] = []

    def fake_get(url: str, *args, **kwargs):
        calls.append(url)

        # First call: Site summary 404
        if "apis/site/v2/sports/football/nfl/summary" in url:
            return DummyESPNResponse({"error": "not found"}, status_code=404)

        # Core event base: inline a single competition with summary-like structure
        if ESPN_NFL_CORE_EVENT_BASE in url:
            return DummyESPNResponse(
                {
                    "id": "TEST_ARCHIVE",
                    "date": "2023-01-01T00:00Z",
                    "season": {"year": 2022},
                    "week": {"number": 18},
                    "competitions": [
                        {
                            "id": "COMP1",
                            "date": "2023-01-01T00:00Z",
                            "status": {
                                "type": {
                                    "id": "3",
                                    "name": "STATUS_FINAL",
                                    "state": "final",
                                    "completed": True,
                                    "description": "Final",
                                    "detail": "Final",
                                    "shortDetail": "Final",
                                    "period": 4,
                                    "displayClock": "0:00",
                                }
                            },
                            "competitors": [
                                {
                                    "id": "1",
                                    "homeAway": "home",
                                    "team": {
                                        "id": "1",
                                        "displayName": "Home Team",
                                        "name": "Home",
                                        "abbreviation": "HOM",
                                    },
                                    "score": {"value": 27},
                                    "records": [{"summary": "10-7"}],
                                },
                                {
                                    "id": "2",
                                    "homeAway": "away",
                                    "team": {
                                        "id": "2",
                                        "displayName": "Away Team",
                                        "name": "Away",
                                        "abbreviation": "AWY",
                                    },
                                    "score": {"value": 21},
                                    "records": [{"summary": "9-8"}],
                                },
                            ],
                            "venue": {
                                "fullName": "Some Stadium",
                                "name": "Some Stadium",
                                "indoor": False,
                                "address": {"city": "City", "state": "ST"},
                            },
                            "broadcasts": [
                                {
                                    "names": ["ESPN"],
                                }
                            ],
                            "situation": {
                                "down": 1,
                                "distance": 10,
                                "yardLine": 25,
                                "isRedZone": False,
                                "homeTimeouts": 3,
                                "awayTimeouts": 3,
                                "possession": "1",
                                "lastPlay": {"text": "End of game"},
                            },
                        }
                    ],
                }
            )

        raise AssertionError(f"Unexpected URL called in core fallback test: {url}")

    # Patch httpx.get used inside app.main
    monkeypatch.setattr("app.main.httpx.get", fake_get)

    resp = client.get("/games/TEST_ARCHIVE/live")
    assert resp.status_code == 200

    data = resp.json()
    header = data["header"]

    # Ensure we used Core fallback (event base URL was called)
    assert any(ESPN_NFL_CORE_EVENT_BASE in url for url in calls)

    # Basic header correctness
    assert header["game_id"] == "TEST_ARCHIVE"
    assert header["league"] == "NFL"
    assert header["season"] == 2022
    assert header["week"] == 18
    assert header["status"] in ("final", "post")  # final maps to "final"
    assert header["home_team"]["name"] == "Home"
    assert header["away_team"]["name"] == "Away"
    assert header["home_team"]["score"] == 27
    assert header["away_team"]["score"] == 21

    # Situation-mapped fields come through from synthetic Core payload
    assert header["down"] == 1
    assert header["distance"] == 10
    assert header["yard_line"] == 25
    assert header["red_zone"] is False
    assert header["home_timeouts"] == 3
    assert header["away_timeouts"] == 3
    assert header["last_play_short"] == "End of game"
