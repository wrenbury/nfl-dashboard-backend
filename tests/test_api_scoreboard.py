from fastapi.testclient import TestClient

from app.main import app
from app.services import scoreboard as sb
from app.models.schemas import GameSummary, Competitor, Team, Sport

client = TestClient(app)


def _fake_games(sport: Sport):
  return [
      GameSummary(
          id="test-1",
          sport=sport,
          startTime="2024-01-01T00:00:00Z",
          status="final",
          venue="Test Stadium",
          competitors=[
              Competitor(
                  team=Team(id="H", name="Home", abbreviation="H"),
                  homeAway="home",
                  score=24,
              ),
              Competitor(
                  team=Team(id="A", name="Away", abbreviation="A"),
                  homeAway="away",
                  score=17,
              ),
          ],
      )
  ]


def test_api_scoreboard_nfl(monkeypatch):
  monkeypatch.setattr(
      sb, "get_scoreboard", lambda sport, date=None, week=None: _fake_games(sport)
  )
  with TestClient(app) as c:
      r = c.get("/api/scoreboard/nfl")
  assert r.status_code == 200
  data = r.json()
  assert isinstance(data, list)
  assert data[0]["sport"] == "nfl"
  assert len(data[0]["competitors"]) == 2


def test_api_scoreboard_cfb(monkeypatch):
  monkeypatch.setattr(
      sb, "get_scoreboard", lambda sport, date=None, week=None: _fake_games(sport)
  )
  with TestClient(app) as c:
      r = c.get("/api/scoreboard/college-football")
  assert r.status_code == 200
  data = r.json()
  assert isinstance(data, list)
  assert data[0]["sport"] == "college-football"
