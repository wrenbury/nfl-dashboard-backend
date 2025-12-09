# tests/test_games_situation.py

import pytest

from app.models.schemas import GameSituation
from app.services import games


def make_fake_summary_with_situation() -> dict:
  return {
      "header": {
          "id": "401234567",
          "date": "2025-12-09T01:15:00Z",
          "status": {
              "period": 3,
              "type": {
                  "shortDetail": "13:10 - 3rd",
                  "description": "In Progress",
              },
          },
          "competitions": [
              {
                  "date": "2025-12-09T01:15:00Z",
                  "status": {
                      "period": 3,
                      "type": {
                          "shortDetail": "13:10 - 3rd",
                          "description": "In Progress",
                      },
                  },
                  "venue": {"fullName": "Fake Stadium"},
                  "competitors": [
                      {
                          "homeAway": "home",
                          "score": "10",
                          "team": {
                              "id": "1",
                              "displayName": "Home Team",
                          },
                      },
                      {
                          "homeAway": "away",
                          "score": "6",
                          "team": {
                              "id": "2",
                              "displayName": "Away Team",
                          },
                      },
                  ],
                  "situation": {
                      "clock": "13:10",
                      "down": 3,
                      "distance": 7,
                      "yardLine": 44,
                      "shortDownDistanceText": "3rd & 7",
                      "downDistanceText": "3rd & 7 at LAC 44",
                      "possession": {"id": "1"},
                      "possessionText": "LAC ball on LAC 44",
                      "isRedZone": False,
                  },
              }
          ],
      },
      "boxscore": {
          "players": [],
          "teams": [],
      },
      "drives": {"current": {"plays": []}},
      "winprobability": [],
  }


def make_fake_summary_without_situation() -> dict:
  base = make_fake_summary_with_situation()
  base["header"]["competitions"][0].pop("situation", None)
  return base


def test_game_details_parses_situation(monkeypatch):
  def fake_summary(sport: str, event_id: str) -> dict:
      assert sport == "nfl"
      assert event_id == "401234567"
      return make_fake_summary_with_situation()

  monkeypatch.setattr(games.espn, "summary", fake_summary)

  details = games.game_details("nfl", "401234567")

  assert isinstance(details.situation, GameSituation)
  s = details.situation
  assert s.clock == "13:10"
  assert s.period == 3
  assert s.down == 3
  assert s.distance == 7
  assert s.yardLine == 44
  assert s.shortDownDistanceText == "3rd & 7"
  assert s.downDistanceText == "3rd & 7 at LAC 44"
  assert s.possessionTeamId == "1"
  assert s.possessionText == "LAC ball on LAC 44"
  assert s.isRedZone is False

  # Ensure serialization to dict/json does not drop fields
  serialized = details.dict()
  assert "situation" in serialized
  assert serialized["situation"]["clock"] == "13:10"
  assert serialized["situation"]["possessionTeamId"] == "1"


def test_game_details_missing_situation_is_robust(monkeypatch):
  def fake_summary(sport: str, event_id: str) -> dict:
      return make_fake_summary_without_situation()

  monkeypatch.setattr(games.espn, "summary", fake_summary)

  details = games.game_details("nfl", "401234567")

  # situation should simply be None when ESPN omits it
  assert details.situation is None
