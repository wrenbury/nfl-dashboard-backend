"""
Main FastAPI application for the Football Dashboard.

This module wires together:
- Core JSON API used by the React frontend (`/api/...`).
- High-level NFL convenience endpoints (`/games/today`, `/games/{id}/live`).
- CollegeFootballData-powered CFB scoreboard endpoints (`/cfb/scoreboard`).

It also contains the logic to normalize ESPN NFL summary/scoreboard payloads
into the richer GameLiveResponse / GamesTodayResponse shapes defined in
`app/schemas.py`.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import settings
from .api.routers import router as api_router
from .cfb_scoreboard import router as cfb_router
from .schemas import (
    GameLiveResponse,
    Header,
    TeamHeader,
    Drives,
    DriveSummary,
    CurrentDrive,
    Play,
    Scoring,
    QuarterScoring,
    ScoringPlay,
    TouchdownScorer,
    TeamStats,
    TeamStatsWrapper,
    PlayerStats,
    PassingStat,
    RushingStat,
    ReceivingStat,
    Boxscore,
    Venue,
    Broadcast,
    Weather,
    Meta,
    WinProbability,
    TeamSuccessRates,
    TeamSuccessRatesWrapper,
    Analytics,
)

app = FastAPI(title=settings.APP_NAME)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# ESPN endpoints & constants
# ---------------------------------------------------------------------------

ESPN_SITE_NFL_SUMMARY_BASE = (
    "https://site.web.api.espn.com/apis/site/v2/sports/football/nfl/summary"
)
ESPN_SITE_NFL_SCOREBOARD_BASE = (
    "https://site.web.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard"
)

# Exported constant used by tests to ensure the Core fallback is exercised.
ESPN_NFL_CORE_EVENT_BASE = (
    "https://sports.core.api.espn.com/v2/sports/football/nfl/events"
)


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace(
        "+00:00", "Z"
    )


def _map_status_state(raw_state: Optional[str]) -> str:
    """
    Map ESPN state strings into our normalized StatusState union.
    """
    if not raw_state:
        return "pre"
    raw = raw_state.lower()
    if raw in {"pre", "in", "post", "halftime", "final", "delayed"}:
        return raw
    # Fallbacks
    if "half" in raw:
        return "halftime"
    if "final" in raw or "post" in raw:
        return "final"
    return "in"


def _extract_competition_from_header(header: Dict[str, Any]) -> Dict[str, Any]:
    comps = header.get("competitions") or []
    return comps[0] if comps else {}


def _split_home_away(
    competitors: List[Dict[str, Any]]
) -> Tuple[Dict[str, Any], Dict[str, Any]]:
    home = away = {}
    for c in competitors:
        if c.get("homeAway") == "home":
            home = c
        elif c.get("homeAway") == "away":
            away = c
    # In case flags are missing, fall back to first/second.
    if not home and competitors:
        home = competitors[0]
    if not away and len(competitors) > 1:
        away = competitors[1]
    return home, away


def _team_header_from_comp(
    comp: Dict[str, Any], default_score: int = 0
) -> TeamHeader:
    team = comp.get("team") or {}
    records = comp.get("records") or []
    record = None
    if records:
        record = records[0].get("summary")
    score_raw = comp.get("score") or comp.get("scoreValue") or comp.get("score", {})
    if isinstance(score_raw, dict):
        score_val = score_raw.get("value", default_score)
    else:
        try:
            score_val = int(score_raw)
        except (TypeError, ValueError):
            score_val = default_score

    return TeamHeader(
        id=str(team.get("id", "")),
        name=team.get("displayName") or team.get("nickname") or team.get("name", ""),
        full_name=team.get("name") or team.get("displayName", ""),
        abbreviation=team.get("abbreviation") or "",
        record=record,
        score=score_val,
    )


def _header_from_espn(
    raw: Dict[str, Any], league: str = "NFL"
) -> Tuple[Header, Dict[str, Any], Dict[str, Any], Dict[str, Any]]:
    """
    Build our Header model from either:
    - Site summary payload, where the interesting bits live in raw["header"], or
    - Core fallback payload, where they live at the top level.
    Returns (header_model, header_raw, competition_raw, situation_raw).
    """
    if "header" in raw:
        header_raw = raw["header"]
    else:
        header_raw = raw

    comp = _extract_competition_from_header(header_raw)
    status = comp.get("status", {})
    status_type = status.get("type", {})
    situation = comp.get("situation") or header_raw.get("situation") or {}

    competitors = comp.get("competitors") or []
    home_raw, away_raw = _split_home_away(competitors)
    home_team = _team_header_from_comp(home_raw)
    away_team = _team_header_from_comp(away_raw)

    season = header_raw.get("season", {}).get("year") or raw.get("season", {}).get(
        "year", 0
    )
    week = header_raw.get("week", {}).get("number") or raw.get("week", {}).get(
        "number"
    )

    # Status / clock / quarter
    state = _map_status_state(status_type.get("state") or status_type.get("name"))
    quarter = status.get("period")
    clock = status.get("displayClock") or status_type.get("shortDetail")

    kickoff_time_utc = comp.get("date") or header_raw.get("competitions", [{}])[0].get(
        "date", _utc_now_iso()
    )

    # Situation-derived bits
    yard_line = situation.get("yardLine")
    red_zone = bool(situation.get("isRedZone"))
    possession_team_id = situation.get("possession")
    possession: Optional[str] = None
    if possession_team_id:
        if str(possession_team_id) == home_team.id:
            possession = "home"
        elif str(possession_team_id) == away_team.id:
            possession = "away"

    header = Header(
        game_id=str(header_raw.get("id") or raw.get("id", "")),
        league="NFL" if league.upper() == "NFL" else "CFB",
        season=int(season or 0),
        week=int(week) if week is not None else None,
        status=state,  # type: ignore[arg-type]
        kickoff_time_utc=kickoff_time_utc,
        home_team=home_team,
        away_team=away_team,
        quarter=quarter,
        clock=clock,
        possession=possession,  # type: ignore[arg-type]
        down=situation.get("down"),
        distance=situation.get("distance"),
        yard_line=yard_line,
        red_zone=red_zone,
        home_timeouts=situation.get("homeTimeouts"),
        away_timeouts=situation.get("awayTimeouts"),
        last_play_short=(situation.get("lastPlay") or {}).get("text"),
        last_updated_utc=_utc_now_iso(),
    )

    return header, header_raw, comp, situation


def _drives_from_espn(
    raw: Dict[str, Any], home_id: str, away_id: str
) -> Drives:
    drives_raw = raw.get("drives") or {}
    previous = drives_raw.get("previous") or []
    current_raw = drives_raw.get("current") or {}

    summary: List[DriveSummary] = []
    for d in previous:
        team_id = str((d.get("team") or {}).get("id", ""))
        team = "home" if team_id == home_id else "away"
        start = d.get("start") or {}
        end = d.get("end") or {}
        start_clock = (start.get("clock") or {}).get("displayValue", "")
        end_clock = (end.get("clock") or {}).get("displayValue", "")
        start_yard = start.get("yardLine")
        end_yard = end.get("yardLine")
        result_text = (d.get("result") or d.get("displayResult") or "").lower()

        if "touchdown" in result_text or result_text == "td":
            result = "TD"
        elif "field goal" in result_text or result_text == "fg":
            result = "FG"
        elif "punt" in result_text:
            result = "Punt"
        elif "interception" in result_text or "fumble" in result_text or "turnover" in result_text:
            result = "TO"
        elif "downs" in result_text:
            result = "Downs"
        elif "missed field goal" in result_text:
            result = "MissedFG"
        elif "end" in result_text and "half" in result_text:
            result = "EndHalf"
        else:
            result = "Other"

        summary.append(
            DriveSummary(
                id=str(d.get("id", "")),
                team=team,  # type: ignore[arg-type]
                quarter=(end.get("period") or {}).get("number", 0),
                start_clock=start_clock,
                end_clock=end_clock,
                start_yard_line=start_yard,
                end_yard_line=end_yard,
                plays=d.get("offensivePlays") or d.get("plays", 0),
                yards=d.get("yards", 0),
                time_of_possession=(d.get("timeElapsed") or {}).get(
                    "displayValue", ""
                ),
                result=result,  # type: ignore[arg-type]
            )
        )

    # Current drive / plays
    plays: List[Play] = []
    for p in current_raw.get("plays") or []:
        start = p.get("start") or {}
        result_type = (p.get("type") or {}).get("text", "").lower()
        if "touchdown" in result_type:
            result = "TD"
        elif "field goal" in result_type:
            result = "FG"
        elif any(t in result_type for t in ["interception", "fumble", "turnover"]):
            result = "TO"
        elif "safety" in result_type:
            result = "Safety"
        elif "penalty" in result_type:
            result = "Penalty"
        else:
            result = "normal"

        plays.append(
            Play(
                play_id=str(p.get("id", "")),
                quarter=(p.get("period") or {}).get("number", 0),
                clock=(p.get("clock") or {}).get("displayValue", ""),
                down=start.get("down"),
                distance=start.get("distance"),
                yard_line=start.get("yardLine"),
                description=p.get("text", ""),
                gained=p.get("statYardage"),
                result=result,  # type: ignore[arg-type]
            )
        )

    current_drive = None
    if current_raw:
        team_id = str((current_raw.get("team") or {}).get("id", ""))
        team: Optional[str] = None
        if team_id == home_id:
            team = "home"
        elif team_id == away_id:
            team = "away"

        current_drive = CurrentDrive(
            id=str(current_raw.get("id", "")),
            team=team,  # type: ignore[arg-type]
            plays=plays,
        )

    return Drives(
        current_drive_id=str(current_raw.get("id")) if current_raw else None,
        summary=summary,
        current=current_drive,
    )


def _scoring_from_espn(
    raw: Dict[str, Any], home_id: str, away_id: str
) -> Scoring:
    header_raw = raw.get("header") or raw
    comp = _extract_competition_from_header(header_raw)
    competitors = comp.get("competitors") or []
    home_raw, away_raw = _split_home_away(competitors)

    # Summary by quarter from linescores
    summary_by_quarter: List[QuarterScoring] = []
    home_lines = {
        ls.get("period"): ls.get("value", 0)
        for ls in home_raw.get("linescores", [])
    }
    away_lines = {
        ls.get("period"): ls.get("value", 0)
        for ls in away_raw.get("linescores", [])
    }
    all_periods = sorted(set(home_lines.keys()) | set(away_lines.keys()))
    for q in all_periods:
        summary_by_quarter.append(
            QuarterScoring(
                quarter=int(q),
                home_points=int(home_lines.get(q, 0) or 0),
                away_points=int(away_lines.get(q, 0) or 0),
            )
        )

    scoring_plays_raw = raw.get("scoringPlays") or []
    plays: List[ScoringPlay] = []
    td_scorers: List[TouchdownScorer] = []

    for sp in scoring_plays_raw:
        team_id = str((sp.get("team") or {}).get("id", ""))
        team = "home" if team_id == home_id else "away"
        text = sp.get("text", "")
        scoring_type = (sp.get("scoringType") or {}).get("displayName", "").lower()

        # Classify scoring play type
        st_lower = scoring_type or text.lower()
        if "touchdown" in st_lower:
            ptype = "TD"
        elif "field goal" in st_lower:
            ptype = "FG"
        elif "safety" in st_lower:
            ptype = "Safety"
        elif "extra point" in st_lower or "pat" in st_lower:
            ptype = "XP"
        elif "two-point" in st_lower or "2pt" in st_lower:
            ptype = "2PT"
        else:
            ptype = "Other"

        # Attempt to extract a primary player name from text (first two tokens)
        player_primary: Optional[str] = None
        tokens = text.split()
        if len(tokens) >= 2:
            player_primary = f"{tokens[0]} {tokens[1]}"

        # Simple yard extraction
        yards: Optional[int] = None
        for tok in tokens:
            try:
                yards = int(tok)
                break
            except ValueError:
                continue

        plays.append(
            ScoringPlay(
                id=str(sp.get("id", "")),
                quarter=(sp.get("period") or {}).get("number", 0),
                clock=(sp.get("clock") or {}).get("displayValue", ""),
                team=team,  # type: ignore[arg-type]
                type=ptype,  # type: ignore[arg-type]
                description=text,
                yards=yards,
                player_primary=player_primary,
            )
        )

        if ptype == "TD" and player_primary:
            td_scorers.append(
                TouchdownScorer(
                    player=player_primary,
                    team=team,  # type: ignore[arg-type]
                    count=1,
                )
            )

    # Aggregate duplicate TD scorers by player+team
    agg: Dict[Tuple[str, str], int] = {}
    for ts in td_scorers:
        key = (ts.player, ts.team)
        agg[key] = agg.get(key, 0) + ts.count
    td_scorers_agg = [
        TouchdownScorer(player=p, team=t, count=c) for (p, t), c in agg.items()
    ]

    return Scoring(
        summary_by_quarter=summary_by_quarter,
        plays=plays,
        touchdown_scorers=td_scorers_agg,
    )


def _boxscore_from_espn(raw: Dict[str, Any], home_id: str, away_id: str) -> Boxscore:
    # For now we expose empty team stats (all keys present, values None) and a single
    # placeholder player per category so the UI/tests have something to render.
    home_stats = TeamStats()
    away_stats = TeamStats()

    # Minimal player stats stub – real mapping from raw["boxscore"]["players"]
    # can be added later without breaking the schema.
    passing = [
        PassingStat(
            player="Placeholder QB",
            team="home",
            completions=0,
            attempts=0,
            yards=0,
            touchdowns=0,
            interceptions=0,
        )
    ]
    rushing = [
        RushingStat(
            player="Placeholder RB",
            team="home",
            carries=0,
            yards=0,
            touchdowns=0,
        )
    ]
    receiving = [
        ReceivingStat(
            player="Placeholder WR",
            team="home",
            receptions=0,
            yards=0,
            touchdowns=0,
        )
    ]

    player_stats = PlayerStats(
        passing=passing,
        rushing=rushing,
        receiving=receiving,
    )

    return Boxscore(
        team_stats=TeamStatsWrapper(home=home_stats, away=away_stats),
        player_stats=player_stats,
    )


def _meta_from_espn(raw: Dict[str, Any]) -> Meta:
    header_raw = raw.get("header") or raw
    comp = _extract_competition_from_header(header_raw)
    venue_raw = comp.get("venue") or {}
    venue_addr = venue_raw.get("address") or {}
    broadcasts = comp.get("broadcasts") or []
    broadcast_raw = broadcasts[0] if broadcasts else {}

    venue = Venue(
        name=venue_raw.get("fullName") or venue_raw.get("name"),
        city=venue_addr.get("city"),
        state=venue_addr.get("state"),
        indoor=venue_raw.get("indoor"),
    )
    broadcast = Broadcast(
        network=(
            (broadcast_raw.get("names") or [None])[0]
            if isinstance(broadcast_raw.get("names"), list)
            else broadcast_raw.get("shortName")
        ),
        stream=None,
    )
    # Weather is not present in the sample fixtures; fill with Nones for now.
    weather = Weather()

    return Meta(venue=venue, broadcast=broadcast, weather=weather)


def _analytics_from_espn(raw: Dict[str, Any], header: Header) -> Analytics:
    # ESPN summary includes "winprobability" in some cases; we will fall back to
    # an even 50/50 split when absent.
    wp_raw = raw.get("winprobability") or []
    if wp_raw:
        last = wp_raw[-1]
        home_wp = float(last.get("homeWinPercentage", 0.5))
        away_wp = 1.0 - home_wp
    else:
        home_wp = away_wp = 0.5

    win_probability = WinProbability(
        home=home_wp,
        away=away_wp,
        last_updated_utc=_utc_now_iso(),
    )

    # Placeholder team_success_rates based on score differential
    diff = header.home_team.score - header.away_team.score
    base = 0.45
    bump = min(max(diff / 50.0, -0.1), 0.1)
    home_success = base + bump
    away_success = base - bump

    team_success_rates = TeamSuccessRatesWrapper(
        home=TeamSuccessRates(
            success_rate=home_success,
            explosive_play_rate=0.1,
            epa_per_play=0.0,
        ),
        away=TeamSuccessRates(
            success_rate=away_success,
            explosive_play_rate=0.1,
            epa_per_play=0.0,
        ),
    )

    return Analytics(
        win_probability=win_probability,
        current_situation=None,
        team_success_rates=team_success_rates,
    )


def build_game_live_from_espn(raw: Dict[str, Any]) -> GameLiveResponse:
    """
    Convert an ESPN summary-like payload into our GameLiveResponse model.

    This is intentionally defensive and works for both the Site summary
    response (which has a top-level "header") and the Core fallback fixture
    used in tests (where competition data lives at the top level).
    """
    header, header_raw, comp, _situation = _header_from_espn(raw, league="NFL")
    home_id = header.home_team.id
    away_id = header.away_team.id

    # When coming from the Core fallback, we won't have drives/scoring/boxscore.
    # In that case we just construct empty shells.
    has_site_detail = "header" in raw and any(
        k in raw for k in ["drives", "scoringPlays", "boxscore"]
    )

    if has_site_detail:
        drives = _drives_from_espn(raw, home_id=home_id, away_id=away_id)
        scoring = _scoring_from_espn(raw, home_id=home_id, away_id=away_id)
        boxscore = _boxscore_from_espn(raw, home_id=home_id, away_id=away_id)
    else:
        drives = Drives(current_drive_id=None, summary=[], current=None)
        scoring = Scoring(summary_by_quarter=[], plays=[], touchdown_scorers=[])
        boxscore = _boxscore_from_espn(raw, home_id=home_id, away_id=away_id)

    meta = _meta_from_espn(raw)
    analytics = _analytics_from_espn(raw, header=header)

    return GameLiveResponse(
        header=header,
        drives=drives,
        scoring=scoring,
        boxscore=boxscore,
        meta=meta,
        analytics=analytics,
    )


# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------

# Core API routes (NFL + CFB unified models)
app.include_router(api_router, prefix="/api")

# Dedicated CollegeFootballData-powered scoreboard routes
app.include_router(cfb_router)


# ---------------------------------------------------------------------------
# Health & utility endpoints
# ---------------------------------------------------------------------------


@app.get("/health")
def health_root():
    return {"status": "ok"}


@app.get("/healthz")
def healthz():
    return {"ok": True}


# ---------------------------------------------------------------------------
# NFL convenience endpoints used by the React dashboard
# ---------------------------------------------------------------------------


@app.get("/games/today")
def games_today() -> JSONResponse:
    """
    Return a simplified list of today's NFL games.

    This is built directly from the ESPN NFL scoreboard endpoint and shaped into
    a list of objects compatible with the TodayGame interface in the frontend.
    """
    today = datetime.now(timezone.utc).strftime("%Y%m%d")
    params = {"dates": today}

    try:
        resp = httpx.get(
            ESPN_SITE_NFL_SCOREBOARD_BASE,
            params=params,
            timeout=settings.TIMEOUT,
        )
    except httpx.RequestError as exc:
        return JSONResponse(
            status_code=502,
            content={"error": "ESPN scoreboard request failed", "message": str(exc)},
        )

    if resp.status_code != 200:
        return JSONResponse(
            status_code=502,
            content={
                "error": "ESPN scoreboard upstream error",
                "status_code": resp.status_code,
            },
        )

    data = resp.json()
    season_year = (data.get("season") or {}).get("year")

    games_out: List[Dict[str, Any]] = []

    for event in data.get("events", []):
        header_raw = event
        comp = _extract_competition_from_header(header_raw)
        competitors = comp.get("competitors") or []
        home_raw, away_raw = _split_home_away(competitors)

        home_team = _team_header_from_comp(home_raw)
        away_team = _team_header_from_comp(away_raw)

        status = comp.get("status", {})
        status_type = status.get("type", {})
        state = _map_status_state(status_type.get("state"))
        quarter = status.get("period")
        clock = status.get("displayClock")

        situation = comp.get("situation") or {}
        red_zone = bool(situation.get("isRedZone"))

        game = {
            "game_id": str(event.get("id")),
            "league": "NFL",
            "season": (event.get("season") or {}).get("year", season_year),
            "week": (event.get("week") or {}).get("number"),
            "status": state,
            "quarter": quarter,
            "clock": clock,
            "kickoff_time_utc": comp.get("date"),
            "red_zone": red_zone,
            "home_team": home_team.model_dump(),
            "away_team": away_team.model_dump(),
        }
        games_out.append(game)

    return JSONResponse(content={"games": games_out})


@app.get("/games/{game_id}/live")
def game_live(game_id: str) -> JSONResponse:
    """
    High-detail view of a single NFL game.

    Primary source is the ESPN Site summary endpoint; if that returns 404
    we fall back to the Core events API while still returning a valid
    GameLiveResponse shape.
    """
    params = {"event": game_id}

    # 1) Try Site summary first
    try:
        resp = httpx.get(
            ESPN_SITE_NFL_SUMMARY_BASE,
            params=params,
            timeout=settings.TIMEOUT,
        )
    except httpx.RequestError as exc:
        return JSONResponse(
            status_code=502,
            content={"error": "ESPN summary request failed", "message": str(exc)},
        )

    if resp.status_code == 404:
        # 2) Core fallback
        core_url = f"{ESPN_NFL_CORE_EVENT_BASE}/{game_id}"
        try:
            core_resp = httpx.get(core_url, timeout=settings.TIMEOUT)
        except httpx.RequestError as exc:
            return JSONResponse(
                status_code=502,
                content={"error": "ESPN core request failed", "message": str(exc)},
            )

        if core_resp.status_code != 200:
            return JSONResponse(
                status_code=502,
                content={
                    "error": "ESPN core upstream error",
                    "status_code": core_resp.status_code,
                },
            )

        raw = core_resp.json()
        live = build_game_live_from_espn(raw)
        return JSONResponse(content=live.model_dump())

    if resp.status_code != 200:
        return JSONResponse(
            status_code=502,
            content={
                "error": "ESPN summary upstream error",
                "status_code": resp.status_code,
            },
        )

    raw = resp.json()
    live = build_game_live_from_espn(raw)
    return JSONResponse(content=live.model_dump())
