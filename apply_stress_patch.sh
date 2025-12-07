#!/usr/bin/env bash
set -euo pipefail

ROOT="$(pwd)"
echo "Applying Football Dashboard stress-test patch in: $ROOT"

mkdir -p backend/app/{utils,clients,models,services,api} backend/tests

# ---------------- app/config.py ----------------
cat > backend/app/config.py <<'PY'
from pydantic import BaseSettings, Field

class Settings(BaseSettings):
    APP_NAME: str = "Football Dashboard API"
    ENV: str = "dev"
    ESPN_BASE: str = "https://site.web.api.espn.com/apis/v2/sports/football"
    CFBD_BASE: str = "https://api.collegefootballdata.com"
    CFBD_TOKEN: str = Field("", env="CFBD_TOKEN")
    CACHE_TTL: int = 60  # seconds
    TIMEOUT: int = 12

    class Config:
        env_file = ".env"

settings = Settings()
PY

# ---------------- app/utils/cache.py ----------------
cat > backend/app/utils/cache.py <<'PY'
import time
from typing import Any, Dict, Tuple
from ..config import settings

class TTLCache:
    def __init__(self, ttl: int = settings.CACHE_TTL):
        self.ttl = ttl
        self._data: Dict[str, Tuple[float, Any]] = {}

    def get(self, key: str):
        if key in self._data:
            ts, val = self._data[key]
            if time.time() - ts < self.ttl:
                return val
            del self._data[key]
        return None

    def set(self, key: str, value: Any):
        self._data[key] = (time.time(), value)

cache = TTLCache()
PY

# ---------------- app/utils/http.py ----------------
cat > backend/app/utils/http.py <<'PY'
import time
from typing import Optional, Dict, Any
import httpx

DEFAULT_HEADERS = {"User-Agent": "football-dashboard/1.0 (+raspberry-pi)"}
RETRY_STATUS = {408, 429, 500, 502, 503, 504}

def _sleep_for(retry_after: Optional[str], backoff: float) -> None:
    try:
        ra = float(retry_after) if retry_after is not None and retry_after != "" else 0.0
    except ValueError:
        ra = 0.0
    time.sleep(max(backoff, ra))

def fetch_json_with_retries(
    url: str,
    method: str = "GET",
    headers: Optional[Dict[str, str]] = None,
    timeout: int = 12,
    retries: int = 3,
    backoff_initial: float = 0.5,
) -> Any:
    hdrs = {**DEFAULT_HEADERS, **(headers or {})}
    b = backoff_initial
    last_exc: Optional[Exception] = None
    with httpx.Client(timeout=timeout, headers=hdrs) as c:
        for _ in range(retries):
            try:
                r = c.request(method, url)
                if r.status_code in RETRY_STATUS:
                    _sleep_for(r.headers.get("Retry-After"), b)
                    b *= 2
                    continue
                r.raise_for_status()
                return r.json()
            except Exception as exc:
                last_exc = exc
                _sleep_for(None, b)
                b *= 2
        if last_exc:
            raise last_exc
        raise RuntimeError("fetch_json_with_retries exhausted without exception?")
PY

# ---------------- app/models/schemas.py ----------------
cat > backend/app/models/schemas.py <<'PY'
from typing import List, Optional, Literal
from pydantic import BaseModel

Sport = Literal["nfl", "college-football"]

class Team(BaseModel):
    id: str
    name: str
    nickname: Optional[str] = None
    abbreviation: Optional[str] = None
    color: Optional[str] = None
    logo: Optional[str] = None
    record: Optional[str] = None
    rank: Optional[int] = None

class Competitor(BaseModel):
    team: Team
    homeAway: Literal["home", "away"]
    score: Optional[int] = None

class GameSummary(BaseModel):
    id: str
    sport: Sport
    startTime: str
    status: str
    venue: Optional[str] = None
    competitors: List[Competitor]

class BoxScoreCategory(BaseModel):
    title: str
    rows: List[List[str]]

class GameDetails(BaseModel):
    summary: GameSummary
    boxscore: List[BoxScoreCategory] = []
    teamStats: List[BoxScoreCategory] = []
    plays: Optional[list] = None
    winProbability: Optional[list] = None
PY

# ---------------- app/clients/espn.py ----------------
cat > backend/app/clients/espn.py <<'PY'
from typing import Dict, Any, Optional
from urllib.parse import urlencode
from ..config import settings
from ..utils.cache import cache
from ..utils.http import fetch_json_with_retries

def _league(sport: str) -> str:
    return "nfl" if sport == "nfl" else "college-football"

def _base(sport: str) -> str:
    return f"{settings.ESPN_BASE}/{_league(sport)}"

def scoreboard(sport: str, date: Optional[str] = None, week: Optional[int] = None) -> Dict[str, Any]:
    params = {}
    if date:
        params["dates"] = date
    if week and sport != "nfl":
        params["week"] = week
    key = f"espn:scoreboard:{sport}:{date}:{week}"
    if (v := cache.get(key)) is not None:
        return v
    url = f"{_base(sport)}/scoreboard"
    if params:
        url += f"?{urlencode(params)}"
    data = fetch_json_with_retries(url, timeout=settings.TIMEOUT, retries=4)
    cache.set(key, data)
    return data

def summary(sport: str, event_id: str) -> Dict[str, Any]:
    key = f"espn:summary:{sport}:{event_id}"
    if (v := cache.get(key)) is not None:
        return v
    url = f"{_base(sport)}/summary?{urlencode({'event': event_id})}"
    data = fetch_json_with_retries(url, timeout=settings.TIMEOUT, retries=4)
    cache.set(key, data)
    return data
PY

# ---------------- app/clients/cfbd.py ----------------
cat > backend/app/clients/cfbd.py <<'PY'
from typing import Any, Optional
from ..config import settings
from ..utils.cache import cache
from ..utils.http import fetch_json_with_retries
import urllib.parse as _u

HEADERS = {"Authorization": f"Bearer {settings.CFBD_TOKEN}"} if settings.CFBD_TOKEN else {}
BASE = settings.CFBD_BASE

def games(year: int, week: Optional[int] = None, seasonType: str = "regular") -> Any:
    params = {"year": year, "seasonType": seasonType}
    if week:
        params["week"] = week
    key = f"cfbd:games:{year}:{week}:{seasonType}"
    if (v := cache.get(key)) is not None:
        return v
    url = f"{BASE}/games?{_u.urlencode(params)}"
    data = fetch_json_with_retries(url, headers=HEADERS, timeout=12, retries=4)
    cache.set(key, data)
    return data
PY

# ---------------- app/services/scoreboard.py ----------------
cat > backend/app/services/scoreboard.py <<'PY'
from typing import List
from ..models.schemas import *
from ..clients import espn

def _map_competitor(raw) -> Competitor:
    t = raw["team"]
    logo = None
    if t.get("logo"):
        logo = t["logo"]
    elif t.get("logos"):
        logos = t["logos"] or []
        if logos:
            logo = logos[0].get("href")
    return Competitor(
        team=Team(
            id=t.get("id", ""),
            name=t.get("displayName") or t.get("name"),
            nickname=t.get("shortDisplayName"),
            abbreviation=t.get("abbreviation"),
            color=t.get("color"),
            logo=logo,
            record=(raw.get("record") or [{}])[0].get("summary"),
            rank=raw.get("rank"),
        ),
        homeAway=raw.get("homeAway"),
        score=int(raw["score"]) if (s := raw.get("score")) and str(s).isdigit() else None,
    )

def parse_scoreboard(sport: Sport, data) -> List[GameSummary]:
    events = data.get("events", [])
    out: List[GameSummary] = []
    for e in events:
        comp = e["competitions"][0]["competitors"]
        status = e["status"]["type"]["description"]
        venue = e["competitions"][0].get("venue", {}).get("fullName")
        out.append(
            GameSummary(
                id=e["id"],
                sport=sport,
                startTime=e.get("date"),
                status=status,
                venue=venue,
                competitors=[_map_competitor(c) for c in sorted(comp, key=lambda x: x["homeAway"])],
            )
        )
    return out

def get_scoreboard(sport: Sport, date: str | None, week: int | None):
    raw = espn.scoreboard(sport, date=date, week=week)
    return parse_scoreboard(sport, raw)
PY

# ---------------- app/services/games.py ----------------
cat > backend/app/services/games.py <<'PY'
from ..models.schemas import *
from ..clients import espn

def game_details(sport: Sport, event_id: str) -> GameDetails:
    raw = espn.summary(sport, event_id)
    header = raw.get("header", {})
    comp = header.get("competitions", [{}])[0].get("competitors", [])
    def team_logo(t: dict):
        if t.get("logo"): return t["logo"]
        logos = t.get("logos") or []
        return logos[0]["href"] if logos else None

    summary = GameSummary(
        id=header.get("id") or event_id,
        sport=sport,
        startTime=header.get("competitions", [{}])[0].get("date"),
        status=header.get("competitions", [{}])[0].get("status", {}).get("type", {}).get("description", ""),
        venue=header.get("competitions", [{}])[0].get("venue", {}).get("fullName"),
        competitors=[ 
            Competitor(
                team=Team(
                    id=c.get("id") or c.get("team",{}).get("id",""),
                    name=c["team"]["displayName"],
                    nickname=c["team"]["shortDisplayName"],
                    abbreviation=c["team"].get("abbreviation"),
                    color=c["team"].get("color"),
                    logo=team_logo(c["team"]),
                    record=(c.get("records") or [{}])[0].get("summary"),
                    rank=c.get("rank"),
                ),
                homeAway=c["homeAway"],
                score=int(c["score"]) if c.get("score") and str(c["score"]).isdigit() else None,
            )
            for c in comp
        ],
    )

    cats = []
    for side in raw.get("boxscore", {}).get("players", []):
        team_name = side.get("team", {}).get("displayName", "")
        for cat in side.get("statistics", []):
            rows = [[ath.get("athlete", {}).get("displayName",""), *[s.get("displayValue","") for s in ath.get("stats", [])]] for ath in cat.get("athletes", [])]
            cats.append(BoxScoreCategory(title=f"{team_name} {cat.get('name','').title()}", rows=rows))

    team_stats = []
    for stat in raw.get("boxscore", {}).get("teams", []):
        rows = [[s.get("label",""), s.get("displayValue","")] for s in stat.get("statistics",[])]
        n = stat.get("team", {}).get("displayName","Team")
        team_stats.append(BoxScoreCategory(title=f"{n} Team Stats", rows=rows))

    return GameDetails(
        summary=summary,
        boxscore=cats,
        teamStats=team_stats,
        plays=raw.get("drives",{}).get("current",{}).get("plays"),
        winProbability=raw.get("winprobability")
    )
PY

# ---------------- app/api/routers.py ----------------
cat > backend/app/api/routers.py <<'PY'
from fastapi import APIRouter, HTTPException
from ..models.schemas import *
from ..services import scoreboard as sb, games

router = APIRouter()

@router.get("/scoreboard/{sport}", response_model=list[GameSummary])
def get_scoreboard(sport: Sport, date: str | None = None, week: int | None = None):
    try:
        return sb.get_scoreboard(sport, date=date, week=week)
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

@router.get("/game/{sport}/{event_id}", response_model=GameDetails)
def get_game(sport: Sport, event_id: str):
    try:
        return games.game_details(sport, event_id)
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))
PY

# ---------------- app/main.py ----------------
cat > backend/app/main.py <<'PY'
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .config import settings
from .api.routers import router

app = FastAPI(title=settings.APP_NAME)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_methods=["*"], allow_headers=["*"]
)
app.include_router(router, prefix="/api")

@app.get("/healthz")
def health():
    return {"ok": True}
PY

# ---------------- tests ----------------
cat > backend/tests/conftest.py <<'PY'
import pytest
import respx
import httpx

@pytest.fixture
def mock_http():
    with respx.mock(assert_all_called=False) as res:
        yield res
PY

cat > backend/tests/test_clients_espn.py <<'PY'
import httpx
from app.clients import espn
from app.config import settings

def test_scoreboard_fetch(mock_http):
    url = f"{settings.ESPN_BASE}/nfl/scoreboard?dates=20250101"
    mock_http.get(url).mock(return_value=httpx.Response(200, json={"events":[
        {
          "id":"123",
          "date":"2025-01-01T17:00Z",
          "status":{"type":{"description":"Final"}},
          "competitions":[{
            "competitors":[
              {"homeAway":"away","score":"21","team":{"id":"1","displayName":"A","shortDisplayName":"A","abbreviation":"A","logos":[{"href":"a.png"}]}},
              {"homeAway":"home","score":"24","team":{"id":"2","displayName":"B","shortDisplayName":"B","abbreviation":"B","logos":[{"href":"b.png"}]}}
            ]
          }]
        }
    ]}))
    data = espn.scoreboard("nfl", date="20250101")
    assert data["events"][0]["id"] == "123"
PY

cat > backend/tests/test_clients_espn_retries.py <<'PY'
import httpx
from app.clients import espn
from app.config import settings

def test_espn_scoreboard_retries_on_500_then_succeeds(mock_http):
    url = f"{settings.ESPN_BASE}/nfl/scoreboard?dates=20250101"
    mock_http.get(url).mock(side_effect=[
        httpx.Response(500),
        httpx.Response(200, json={"events":[{"id":"X"}]})
    ])
    data = espn.scoreboard("nfl", date="20250101")
    assert data["events"][0]["id"] == "X"

def test_espn_scoreboard_retries_on_429(mock_http):
    url = f"{settings.ESPN_BASE}/nfl/scoreboard?dates=20250102"
    mock_http.get(url).mock(side_effect=[
        httpx.Response(429, headers={"Retry-After":"0"}),
        httpx.Response(200, json={"events":[{"id":"Y"}]})
    ])
    data = espn.scoreboard("nfl", date="20250102")
    assert data["events"][0]["id"] == "Y"
PY

cat > backend/tests/test_services_scoreboard_parse.py <<'PY'
from app.services.scoreboard import parse_scoreboard
from app.models.schemas import GameSummary

def test_parse_empty_events():
    out = parse_scoreboard("nfl", {"events":[]})
    assert out == []

def test_parse_handles_missing_logo_and_non_numeric_score():
    raw = {
        "events":[
            {
                "id":"1",
                "date":"2025-01-01T00:00Z",
                "status":{"type":{"description":"Scheduled"}},
                "competitions":[{"competitors":[
                    {"homeAway":"away","score":"","team":{"id":"a","displayName":"Team A","shortDisplayName":"A","abbreviation":"A"}},
                    {"homeAway":"home","score":"14","team":{"id":"b","displayName":"Team B","shortDisplayName":"B","abbreviation":"B","logos":[{"href":"b.png"}]}}
                ], "venue":{"fullName":"Stadium"}}]
            }
        ]
    }
    out = parse_scoreboard("nfl", raw)
    assert len(out) == 1
    g: GameSummary = out[0]
    assert g.competitors[0].score is None
    assert g.competitors[1].team.logo == "b.png"
PY

cat > backend/tests/test_cache_ttl.py <<'PY'
import time
from app.utils.cache import cache

def test_cache_expiry_manipulated_timestamp():
    key = "k"
    cache.set(key, {"v":1})
    ts, val = cache._data[key]  # type: ignore[attr-defined]
    cache._data[key] = (ts - 3600, val)  # type: ignore[attr-defined]
    assert cache.get(key) is None
PY

cat > backend/tests/test_clients_cfbd_retries.py <<'PY'
import httpx
from app.clients import cfbd

def test_cfbd_games_retry_success(mock_http):
    url = "https://api.collegefootballdata.com/games?year=2025&seasonType=regular"
    mock_http.get(url).mock(side_effect=[
        httpx.Response(502),
        httpx.Response(200, json=[{"id":1}])
    ])
    data = cfbd.games(2025)
    assert isinstance(data, list) and data[0]["id"] == 1
PY

cat > backend/tests/test_game_details_mapping.py <<'PY'
import httpx
from app.services.games import game_details
from app.config import settings
import respx

def test_game_details_maps_boxscore_and_stats():
    url = f"{settings.ESPN_BASE}/nfl/summary?event=999"
    with respx.mock() as mock:
        mock.get(url).mock(return_value=httpx.Response(200, json={
            "header": {
                "id":"999",
                "competitions": [{
                    "date":"2025-01-01T00:00Z",
                    "status":{"type":{"description":"Final"}},
                    "venue":{"fullName":"The Dome"},
                    "competitors":[
                        {"id":"1","homeAway":"away","score":"7","team":{"id":"1","displayName":"Away Team","shortDisplayName":"AT","abbreviation":"AT","logos":[{"href":"a.png"}]},"records":[{"summary":"10-2"}]},
                        {"id":"2","homeAway":"home","score":"14","team":{"id":"2","displayName":"Home Team","shortDisplayName":"HT","abbreviation":"HT","logos":[{"href":"h.png"}]},"records":[{"summary":"9-3"}]}
                    ]
                }]
            },
            "boxscore":{
                "players":[
                    {"team":{"displayName":"Away Team"}, "statistics":[
                        {"name":"passing","athletes":[{"athlete":{"displayName":"QB A"},"stats":[{"displayValue":"10/20"}, {"displayValue":"120"}]}]}
                    ]},
                    {"team":{"displayName":"Home Team"}, "statistics":[
                        {"name":"rushing","athletes":[{"athlete":{"displayName":"RB H"},"stats":[{"displayValue":"18"}, {"displayValue":"95"}]}]}
                    ]}
                ],
                "teams":[
                    {"team":{"displayName":"Away Team"}, "statistics":[{"label":"Total Yards","displayValue":"250"}]},
                    {"team":{"displayName":"Home Team"}, "statistics":[{"label":"Total Yards","displayValue":"310"}]}
                ]
            },
            "drives":{"current":{"plays":[{"text":"Play 1"},{"text":"Play 2"}]}},
            "winprobability":[{"homeWinPercentage":0.65}]
        }))
        details = game_details("nfl", "999")
        assert details.summary.id == "999"
        assert details.boxscore and details.teamStats
        assert details.winProbability[-1]["homeWinPercentage"] == 0.65
PY

cat > backend/tests/test_scoreboard_routes_error_handling.py <<'PY'
from fastapi.testclient import TestClient
import httpx
from app.main import app
from app.config import settings
import respx

def test_scoreboard_route_handles_upstream_error():
    client = TestClient(app)
    url = f"{settings.ESPN_BASE}/nfl/scoreboard?dates=20250103"
    with respx.mock() as rs:
        rs.get(url).mock(return_value=httpx.Response(500))
        r = client.get("/api/scoreboard/nfl?date=20250103")
        assert r.status_code == 502
PY

cat > backend/tests/test_scoreboard_large_payload.py <<'PY'
from app.services.scoreboard import parse_scoreboard

def test_parse_large_event_list_performance():
    events = []
    for i in range(250):
        events.append({
            "id": str(i),
            "date": "2025-01-01T00:00Z",
            "status": {"type":{"description":"In Progress"}},
            "competitions": [{
                "venue": {"fullName": f"V{i}"},
                "competitors": [
                    {"homeAway":"away","score":"7","team":{"id":f"a{i}","displayName":f"A{i}","shortDisplayName":f"A{i}","abbreviation":"A"}},
                    {"homeAway":"home","score":"14","team":{"id":f"h{i}","displayName":f"H{i}","shortDisplayName":f"H{i}","abbreviation":"H"}}
                ]
            }]
        })
    out = parse_scoreboard("nfl", {"events": events})
    assert len(out) == 250
PY

cat > backend/tests/test_end_to_end_scoreboard_smoke.py <<'PY'
from fastapi.testclient import TestClient
import httpx
import respx
from app.main import app
from app.config import settings

def test_e2e_scoreboard_smoke():
    client = TestClient(app)
    url = f"{settings.ESPN_BASE}/college-football/scoreboard?dates=20250104"
    with respx.mock() as rs:
        rs.get(url).mock(return_value=httpx.Response(200, json={
            "events":[
                {
                    "id":"cfb-1",
                    "date":"2025-01-04T20:00Z",
                    "status":{"type":{"description":"Final"}},
                    "competitions":[{
                        "venue":{"fullName":"Rose"},
                        "competitors":[
                            {"homeAway":"away","score":"21","team":{"id":"1","displayName":"Away","shortDisplayName":"AWY","abbreviation":"AWY"}},
                            {"homeAway":"home","score":"24","team":{"id":"2","displayName":"Home","shortDisplayName":"HME","abbreviation":"HME"}}
                        ]
                    }]
                }
            ]
        }))
        r = client.get("/api/scoreboard/college-football?date=20250104")
        assert r.status_code == 200
        js = r.json()
        assert js and js[0]["id"] == "cfb-1"
PY

cat > backend/tests/test_summary_route_smoke.py <<'PY'
from fastapi.testclient import TestClient
import httpx
import respx
from app.main import app
from app.config import settings

def test_game_route_bento_fields_present():
    client = TestClient(app)
    url = f"{settings.ESPN_BASE}/nfl/summary?event=abc123"
    with respx.mock() as rs:
        rs.get(url).mock(return_value=httpx.Response(200, json={
            "header": {"id":"abc123","competitions":[{"date":"2025-01-01","status":{"type":{"description":"Final"}},"venue":{"fullName":"Stadium"},"competitors":[
                {"id":"1","homeAway":"away","score":"10","team":{"id":"1","displayName":"X","shortDisplayName":"X","abbreviation":"X"}},
                {"id":"2","homeAway":"home","score":"14","team":{"id":"2","displayName":"Y","shortDisplayName":"Y","abbreviation":"Y"}}
            ]}]},
            "boxscore":{"players":[], "teams":[]},
            "drives":{"current":{"plays":[{"text":"Run"}]}},
            "winprobability":[{"homeWinPercentage":0.51}]
        }))
        r = client.get("/api/game/nfl/abc123")
        assert r.status_code == 200
        body = r.json()
        assert body["summary"]["id"] == "abc123"
        assert "boxscore" in body and "teamStats" in body and "winProbability" in body
PY

# ---------------- pyproject / pytest / env ----------------
cat > backend/pyproject.toml <<'TOML'
[project]
name = "football-dashboard"
version = "0.1.0"
requires-python = ">=3.10"
dependencies = [
  "fastapi>=0.115.0",
  "uvicorn[standard]>=0.30.0",
  "httpx>=0.27.0",
  "pydantic>=2.8.0",
]

[project.optional-dependencies]
dev = ["pytest>=8.0.0","pytest-asyncio>=0.23.0","pytest-mock>=3.12.0","respx>=0.21.1"]

[tool.pytest.ini_options]
testpaths = ["backend/tests"]
TOML

cat > backend/pytest.ini <<'INI'
[pytest]
addopts = -q
INI

cat > backend/.env.example <<'ENV'
CFBD_TOKEN=gaXcbzCOvKIe4B0dETF+6znjGtb6U+rODm6d1LvoV/VMz+T4p9huzB6hvajKHwNr
ENV

# zip it up for convenience
ZIP="backend_refactor_stress_tests.zip"
rm -f "$ZIP"
zip -r "$ZIP" backend/app backend/tests backend/pyproject.toml backend/pytest.ini backend/.env.example >/dev/null
echo "Created $ZIP"
echo "Done."
