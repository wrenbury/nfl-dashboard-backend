# app/cfb_scoreboard.py

from __future__ import annotations

import os
from functools import lru_cache
from typing import Any, Dict, List, Optional, Tuple

import httpx
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import JSONResponse

# NOTE:
# - This module is meant to be used alongside your existing `app/main.py`.
# - In `app/main.py`, wire it up with:
#       from .cfb_scoreboard import router as cfb_router
#       app.include_router(cfb_router)
#
# This keeps NFL and CFB concerns separated while sharing the same FastAPI app.

router = APIRouter()

CFBD_BASE_URL = "https://api.collegefootballdata.com"
CFBD_API_KEY_ENV = "CFBD_API_KEY"


StatusState = str  # "pre" | "in" | "post" | "halftime" | "final" | "delayed"


def _cfbd_headers() -> Dict[str, str]:
    """
    Build headers for CollegeFootballData API calls, including the API key
    if present in the environment.
    """
    headers: Dict[str, str] = {"accept": "application/json"}
    api_key = os.getenv(CFBD_API_KEY_ENV)
    if api_key:
        headers = 
            {"Authorization": f"Bearer {CFBD_API_KEY}",  # or settings.cfbd_api_key, etc.
            "Accept": "application/json",
            }
}

    return headers


def _cfbd_get(path: str, params: Dict[str, Any]) -> Any:
    """
    Thin wrapper around httpx.get with shared headers, error handling, and JSON parsing.
    Raises RuntimeError on any upstream / JSON issue so the route can convert it to 502.
    """
    url = f"{CFBD_BASE_URL}{path}"
    try:
        resp = httpx.get(url, params=params, headers=_cfbd_headers(), timeout=8.0)
    except httpx.RequestError as exc:  # network / timeout / DNS issues, etc.
        raise RuntimeError(f"CFBD request failed for {url}: {exc}") from exc

    if resp.status_code != 200:
        raise RuntimeError(
            f"CFBD returned status {resp.status_code} for {url}: {resp.text[:200]}"
        )

    try:
        return resp.json()
    except ValueError as exc:
        raise RuntimeError(f"Invalid JSON from CFBD for {url}") from exc


# ---------------------------------------------------------------------------
# Caching helpers (per-process in-memory, good enough for Pi dashboard)
# ---------------------------------------------------------------------------


@lru_cache(maxsize=8)
def _get_teams_for_year(year: int) -> Dict[str, Dict[str, Any]]:
    """
    Cache FBS team metadata for a season keyed by school name.

    Endpoint: GET /teams/fbs?year=YYYY
    """
    raw = _cfbd_get("/teams/fbs", {"year": year})
    teams_by_school: Dict[str, Dict[str, Any]] = {}

    if not isinstance(raw, list):
        return teams_by_school

    for t in raw:
        if not isinstance(t, dict):
            continue
        school = t.get("school")
        if not school:
            continue
        teams_by_school[school] = t

    return teams_by_school


@lru_cache(maxsize=32)
def _get_rankings_for_week(year: int, week: int) -> Dict[str, int]:
    """
    Cache rankings for a given year/week keyed by school name.

    Endpoint: GET /rankings?year=YYYY&week=WW
    We prefer AP Top 25 (or AP / CFP) if present, otherwise fall back to the first poll.
    """
    raw = _cfbd_get("/rankings", {"year": year, "week": week})
    ranks_by_school: Dict[str, int] = {}

    polls = raw if isinstance(raw, list) else []
    preferred_names = {"AP Top 25", "AP", "CFP Rankings", "CFP"}

    chosen_ranks: Optional[List[Dict[str, Any]]] = None

    for poll in polls:
        if not isinstance(poll, dict):
            continue
        poll_name = poll.get("poll")
        ranks = poll.get("ranks")
        if not isinstance(ranks, list):
            continue

        if poll_name in preferred_names:
            chosen_ranks = ranks
            break

        if chosen_ranks is None:
            chosen_ranks = ranks

    if not chosen_ranks:
        return ranks_by_school

    for r in chosen_ranks:
        if not isinstance(r, dict):
            continue
        team_name = r.get("school")
        rank_val = r.get("rank")
        if team_name and isinstance(rank_val, int):
            ranks_by_school[team_name] = rank_val

    return ranks_by_school


# ---------------------------------------------------------------------------
# Normalization helpers
# ---------------------------------------------------------------------------


def _normalize_cfb_status(raw_status: Optional[str], completed: Optional[bool]) -> StatusState:
    """
    Map CFBD's status strings + completed flag into our normalized StatusState.
    """
    s = (raw_status or "").lower().strip()

    if s in {"scheduled", "upcoming", "pre-game", "pregame"}:
        return "pre"
    if s in {"in progress", "in_progress", "live"}:
        return "in"
    if s in {"halftime", "half"}:
        return "halftime"
    if s in {"final", "completed", "end of game"}:
        return "final"
    if s in {"postgame", "post"}:
        return "post"
    if s in {"delayed", "postponed", "canceled", "cancelled"}:
        return "delayed"

    # Fall back based on the completed flag if status is missing / unknown.
    if completed is True:
        return "final"
    if completed is False:
        return "pre"

    # Default to pre.
    return "pre"


def _build_team(
    team_name: str,
    team_id: Optional[int],
    conference: Optional[str],
    score: Optional[int],
    teams_meta: Dict[str, Dict[str, Any]],
    ranks_meta: Dict[str, int],
) -> Dict[str, Any]:
    """
    Build a CfbScoreboardGameTeam object from CFBD game row + team metadata + rankings.
    """
    meta = teams_meta.get(team_name, {})
    logos = meta.get("logos") or []

    if isinstance(logos, list) and logos:
        logo_url = logos[0]
    else:
        logo_url = None

    name = meta.get("school") or team_name
    short_name = meta.get("abbreviation") or meta.get("mascot") or name
    abbreviation = meta.get("abbreviation")
    record = None  # would need /records or /games aggregation; keep null for now.
    rank = ranks_meta.get(name) or ranks_meta.get(team_name)

    return {
        "id": str(team_id or meta.get("id") or team_name),
        "name": name,
        "short_name": short_name,
        "abbreviation": abbreviation,
        "logo_url": logo_url,
        "rank": rank,
        "record": record,
        "score": score if isinstance(score, int) else None,
        "conference": conference or meta.get("conference"),
    }


def _map_cfb_game(
    game: Dict[str, Any],
    teams_meta: Dict[str, Dict[str, Any]],
    ranks_meta: Dict[str, int],
) -> Dict[str, Any]:
    """
    Map a CFBD /games row into our CfbScoreboardGame shape.
    """
    game_id = str(game.get("id"))
    season = game.get("season")
    week = game.get("week")

    # Status normalization
    raw_status = game.get("status")
    completed = game.get("completed")
    status: StatusState = _normalize_cfb_status(raw_status, completed)

    # Period / clock (not always present in CFBD /games; may be null most of the time)
    period = game.get("period")
    quarter = period if isinstance(period, int) else None

    clock_val = game.get("clock")
    clock = clock_val if isinstance(clock_val, str) else None

    kickoff_time_utc = game.get("start_date")
    neutral_site = bool(game.get("neutral_site"))

    home_team_name = game.get("home_team")
    away_team_name = game.get("away_team")

    home_team_id = game.get("home_id")
    away_team_id = game.get("away_id")

    home_conf = game.get("home_conference")
    away_conf = game.get("away_conference")

    home_points = game.get("home_points")
    away_points = game.get("away_points")

    venue_name = game.get("venue")
    tv_network = game.get("tv") or game.get("tv_network") or game.get("television")

    home_team = _build_team(
        team_name=home_team_name,
        team_id=home_team_id,
        conference=home_conf,
        score=home_points,
        teams_meta=teams_meta,
        ranks_meta=ranks_meta,
    )

    away_team = _build_team(
        team_name=away_team_name,
        team_id=away_team_id,
        conference=away_conf,
        score=away_points,
        teams_meta=teams_meta,
        ranks_meta=ranks_meta,
    )

    return {
        "game_id": game_id,
        "league": "CFB",
        "season": season,
        "week": week,
        "status": status,
        "quarter": quarter,
        "clock": clock,
        "kickoff_time_utc": kickoff_time_utc,
        "neutral_site": neutral_site,
        "home_team": home_team,
        "away_team": away_team,
        "venue_name": venue_name,
        "tv_network": tv_network,
    }


# ---------------------------------------------------------------------------
# Public route
# ---------------------------------------------------------------------------


@router.get("/cfb/scoreboard")
def get_cfb_scoreboard(
    year: int = Query(..., ge=2000, le=2100, description="Season year"),
    week: int = Query(..., ge=1, le=20, description="Week number"),
):
    """
    College Football scoreboard for a given year/week using the CollegeFootballData API.

    Returns:
        {
          "season": number,
          "week": number,
          "games": CfbScoreboardGame[]
        }
    """
    try:
        games_raw = _cfbd_get(
            "/games",
            {
                "year": year,
                "week": week,
                "seasonType": "regular",
            },
        )

        if not isinstance(games_raw, list):
            raise RuntimeError("Unexpected CFBD /games response (expected list)")

        teams_meta = _get_teams_for_year(year)
        ranks_meta = _get_rankings_for_week(year, week)

        games: List[Dict[str, Any]] = []
        for g in games_raw:
            if not isinstance(g, dict):
                continue
            try:
                games.append(_map_cfb_game(g, teams_meta, ranks_meta))
            except Exception:
                # Don't let a single bad game blow up the entire response.
                continue

        payload = {
            "season": year,
            "week": week,
            "games": games,
        }
        return JSONResponse(payload)

    except RuntimeError as exc:
        # Upstream / JSON error -> 502
        return JSONResponse(
            status_code=502,
            content={
                "error": "CollegeFootballData upstream error",
                "message": str(exc),
                "provider": "CollegeFootballData API",
            },
        )

    except Exception as exc:  # pragma: no cover - generic safety net
        return JSONResponse(
            status_code=502,
            content={
                "error": "Unexpected CFB scoreboard error",
                "message": str(exc),
            },
        )
