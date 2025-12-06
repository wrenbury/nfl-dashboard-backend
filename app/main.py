# app/main.py
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import httpx
from fastapi import FastAPI
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from .schemas import (
    Analytics,
    Boxscore,
    Broadcast,
    Drives,
    GameLiveResponse,
    Header,
    Meta,
    PlayerStats,
    Scoring,
    TeamHeader,
    TeamStats,
    TeamStatsWrapper,
    TeamSuccessRates,
    TeamSuccessRatesWrapper,
    Venue,
    Weather,
    WinProbability,
)

ESPN_NFL_SUMMARY_URL = "https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary"
ESPN_NFL_SCOREBOARD_URL = "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard"
ESPN_NFL_CORE_EVENT_BASE = (
    "https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/events"
)

app = FastAPI(title="Football Dashboard API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # ok for LAN / dev
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> Dict[str, str]:
    return {"status": "ok"}


def _normalize_game_status(status: Dict[str, Any]) -> Dict[str, Any]:
    """
    Normalize ESPN status.type into our canonical state/period/clock trio.

    ESPN usually looks like:
      "status": {
        "type": {
          "id": "2",
          "name": "STATUS_IN_PROGRESS",
          "state": "in",
          "completed": False,
          "description": "...",
          "detail": "...",
          "shortDetail": "...",
          "period": 2,
          "displayClock": "10:23",
        }
      }
    """
    if not isinstance(status, dict):
        status = {}

    state = (status.get("state") or "").lower()
    completed = bool(status.get("completed"))
    name = (status.get("name") or "").lower()
    description = (status.get("description") or "").lower()

    allowed_states = {"pre", "in", "post", "halftime", "final", "delayed"}

    if state not in allowed_states:
        if "halftime" in name or "halftime" in description:
            state = "halftime"
        elif "delayed" in name or "delayed" in description:
            state = "delayed"
        elif completed:
            state = "final" if "final" in description or "final" in name else "post"
        elif state in {"", None}:
            if "scheduled" in name or "pregame" in name:
                state = "pre"
            else:
                state = "in"

    return {
        "status": state,
        "period": status.get("period"),
        "clock": status.get("displayClock"),
    }


def _http_get_json(url: str, *, timeout: float = 5.0) -> Dict[str, Any]:
    """
    Helper used by the Core API fallback to fetch JSON or raise a RuntimeError.
    """
    try:
        resp = httpx.get(url, timeout=timeout)
    except httpx.RequestError as exc:
        raise RuntimeError(f"HTTP request to {url} failed: {exc}") from exc

    status_code = getattr(resp, "status_code", 500)
    if status_code != 200:
        raise RuntimeError(f"HTTP request to {url} returned {status_code}")

    try:
        return resp.json()
    except Exception as exc:  # pragma: no cover - defensive
        raise RuntimeError(f"Invalid JSON from {url}: {exc}") from exc


def _get_ref_url(obj: Any) -> Optional[str]:
    """
    Extract a reference URL from an ESPN Core object.

    Handles Core-style {"$ref": "..."} and generic {"href": "..."} forms.
    """
    if not isinstance(obj, dict):
        return None
    for key in ("$ref", "href"):
        val = obj.get(key)
        if isinstance(val, str) and val:
            return val
    return None


def _build_summary_like_payload_from_core(game_id: str) -> Dict[str, Any]:
    """
    Build a payload that looks like the Site summary JSON using the ESPN Core API.

    This allows us to re-use the existing _map_header/_map_scoring/_map_boxscore/_map_meta
    logic without needing a separate code path for Core.
    """
    event_url = f"{ESPN_NFL_CORE_EVENT_BASE}/{game_id}"
    event = _http_get_json(event_url)

    competitions_meta = event.get("competitions") or []
    if not competitions_meta:
        raise RuntimeError("Core event has no competitions")

    comp_meta = competitions_meta[0]
    comp_url = _get_ref_url(comp_meta)
    if comp_url:
        comp = _http_get_json(comp_url)
    elif isinstance(comp_meta, dict):
        comp = comp_meta
    else:
        raise RuntimeError(f"Unsupported competitions element type: {type(comp_meta)}")

    # Season / week (may be dicts or just integer IDs)
    season_core_raw = event.get("season") or comp.get("season") or {}
    if not isinstance(season_core_raw, dict):
        season_core = {}
    else:
        season_core = season_core_raw

    week_core_raw = event.get("week") or comp.get("week") or {}
    if not isinstance(week_core_raw, dict):
        week_core = {}
    else:
        week_core = week_core_raw

    season = {"year": season_core.get("year")}
    week = {"number": week_core.get("number")}

    # Status
    status_container = comp.get("status")
    if isinstance(status_container, dict):
        status = status_container.get("type") or {}
    else:
        status = {}

    # Competitors -> synthesize Site-style competitors list
    competitors_core: List[Dict[str, Any]] = comp.get("competitors") or []
    competitors_synth: List[Dict[str, Any]] = []

    for c in competitors_core:
        if not isinstance(c, dict):
            continue

        side = (c.get("homeAway") or "").lower() or None

        # Team: may be inline or a Core $ref to the team resource
        team_meta = c.get("team") or {}
        team_url = _get_ref_url(team_meta)
        team_data: Dict[str, Any] = {}
        if team_url:
            try:
                team_data = _http_get_json(team_url)
            except RuntimeError:
                team_data = {}
        elif isinstance(team_meta, dict):
            team_data = team_meta

        team_obj = {
            "id": str(team_data.get("id") or c.get("id") or ""),
            "displayName": team_data.get("displayName")
            or team_data.get("name")
            or "",
            "name": team_data.get("name") or "",
            "abbreviation": team_data.get("abbreviation") or "",
            "location": team_data.get("location"),
        }

        score_core = c.get("score") or {}
        if isinstance(score_core, dict):
            score_val = score_core.get("value") or score_core.get("displayValue") or 0
        else:
            score_val = score_core or 0

        records_core = c.get("records") or []
        linescores_core = c.get("linescores") or []

        competitors_synth.append(
            {
                "homeAway": side,
                "team": team_obj,
                "score": str(score_val),
                "records": records_core,
                "linescores": linescores_core,
            }
        )

    # Situation (downs, distance, yard line, possession, timeouts, last play)
    situation: Dict[str, Any] = {}
    situation_meta = comp.get("situation") or event.get("situation") or {}
    situation_url = _get_ref_url(situation_meta)

    situation_core: Dict[str, Any] = {}
    if situation_url:
        try:
            situation_core = _http_get_json(situation_url)
        except RuntimeError:
            situation_core = {}
    elif isinstance(situation_meta, dict):
        situation_core = situation_meta

    if situation_core:
        situation["down"] = situation_core.get("down")
        situation["distance"] = situation_core.get("distance")
        situation["yardLine"] = situation_core.get("yardLine")
        situation["isRedZone"] = situation_core.get("isRedZone")
        situation["homeTimeouts"] = situation_core.get("homeTimeouts")
        situation["awayTimeouts"] = situation_core.get("awayTimeouts")

        # Possession can be a team id or an embedded object; handle both.
        possession_val: Optional[str] = None
        poss = situation_core.get("possession")
        if isinstance(poss, dict):
            possession_val = str(
                poss.get("id")
                or (
                    (poss.get("team") or {}).get("id")
                    if isinstance(poss.get("team"), dict)
                    else ""
                )
            )
        elif isinstance(poss, (str, int)):
            possession_val = str(poss)
        if possession_val:
            situation["possession"] = possession_val

        last_play = situation_core.get("lastPlay") or situation_core.get("play") or {}
        if isinstance(last_play, dict):
            text = last_play.get("text") or last_play.get("shortText")
            if text:
                situation["lastPlay"] = {"text": text}

    # Venue
    venue_meta = comp.get("venue") or event.get("venue") or {}
    venue_url = _get_ref_url(venue_meta)
    venue_core: Dict[str, Any] = {}
    if venue_url:
        try:
            venue_core = _http_get_json(venue_url)
        except RuntimeError:
            venue_core = {}
    elif isinstance(venue_meta, dict):
        venue_core = venue_meta

    address_core = venue_core.get("address") or {}
    venue = {
        "fullName": venue_core.get("fullName") or venue_core.get("name"),
        "name": venue_core.get("name"),
        "indoor": venue_core.get("indoor"),
        "address": {
            "city": address_core.get("city") or venue_core.get("city"),
            "state": address_core.get("state") or venue_core.get("state"),
        },
    }

    # Broadcasts
    broadcasts_core: List[Dict[str, Any]] = comp.get("broadcasts") or []
    broadcasts_synth: List[Dict[str, Any]] = []

    for b_meta in broadcasts_core:
        b_url = _get_ref_url(b_meta)
        b_data: Dict[str, Any] = {}
        if b_url:
            try:
                b_data = _http_get_json(b_url)
            except RuntimeError:
                b_data = {}
        elif isinstance(b_meta, dict):
            b_data = b_meta

        network: Optional[str] = None
        names = b_data.get("names")
        if isinstance(names, list) and names:
            network = names[0]
        else:
            network = (
                b_data.get("shortName")
                or b_data.get("name")
                or b_data.get("network")
            )

        if network:
            broadcasts_synth.append({"names": [network], "network": network})
        elif b_data:
            broadcasts_synth.append(b_data)

    # NOTE: For now we do not attempt to hydrate scoringPlays or boxscore from Core.
    # The existing mappers will gracefully fall back to empty scoring / stats if
    # those sections are missing. This still gives a useful header/meta view for
    # archived games where the Site summary 404s.

    payload: Dict[str, Any] = {
        "header": {
            "season": season,
            "week": week,
            "competitions": [
                {
                    "date": comp.get("date") or event.get("date"),
                    "status": {"type": status},
                    "competitors": competitors_synth,
                    "situation": situation,
                    "venue": venue,
                    "broadcasts": broadcasts_synth,
                }
            ],
        }
    }

    return payload


def _map_team_header(raw_competitor: Dict[str, Any]) -> TeamHeader:
    team = (raw_competitor or {}).get("team") or {}
    records = (raw_competitor or {}).get("records") or (raw_competitor or {}).get("record") or []
    record_str: Optional[str] = None

    if isinstance(records, list) and records:
        record_str = records[0].get("summary")
    elif isinstance(records, dict):
        record_str = records.get("summary")

    score_str = (raw_competitor or {}).get("score") or "0"
    try:
        score = int(score_str)
    except (TypeError, ValueError):
        score = 0

    full_name = (
        team.get("displayName")
        or " ".join(part for part in [team.get("location"), team.get("name")] if part)
        or team.get("name")
        or ""
    )

    return TeamHeader(
        id=str(team.get("id") or ""),
        name=team.get("name") or team.get("nickname") or full_name,
        full_name=full_name,
        abbreviation=team.get("abbreviation") or "",
        record=record_str,
        score=score,
    )


def _map_header(payload: Dict[str, Any], game_id: str) -> Header:
    header = payload.get("header") or {}
    competitions: List[Dict[str, Any]] = header.get("competitions") or []
    if not competitions:
        raise KeyError("header.competitions missing in ESPN response")

    comp = competitions[0]

    season = header.get("season") or {}
    week = header.get("week") or {}

    if not isinstance(season, dict):
        season = {}
    if not isinstance(week, dict):
        week = {}

    raw_status = comp.get("status")
    if isinstance(raw_status, dict):
        status_type = raw_status.get("type") or {}
    else:
        status_type = {}
    normalized = _normalize_game_status(status_type)
    state = normalized["status"]

    kickoff_time = comp.get("date") or ""

    competitors: List[Dict[str, Any]] = comp.get("competitors") or []
    home_comp: Optional[Dict[str, Any]] = None
    away_comp: Optional[Dict[str, Any]] = None
    for c in competitors:
        side = (c.get("homeAway") or "").lower()
        if side == "home":
            home_comp = c
        elif side == "away":
            away_comp = c

    if home_comp is None or away_comp is None:
        raise KeyError("home/away competitors missing in ESPN response")

    status_period = normalized["period"]
    status_clock = normalized["clock"]

    # Situation details: possession, downs, distance, yard line, timeouts, last play
    situation = (comp.get("situation") or {}) if isinstance(comp, dict) else {}
    possession_side: Optional[str] = None
    down: Optional[int] = None
    distance: Optional[int] = None
    yard_line: Optional[int] = None
    red_zone = False
    home_timeouts: Optional[int] = None
    away_timeouts: Optional[int] = None
    last_play_short: Optional[str] = None

    try:
        possession_team_id = str((situation.get("possession") or "")).strip()
        home_team_id = str(((home_comp or {}).get("team") or {}).get("id") or "")
        away_team_id = str(((away_comp or {}).get("team") or {}).get("id") or "")
        if possession_team_id:
            if possession_team_id == home_team_id:
                possession_side = "home"
            elif possession_team_id == away_team_id:
                possession_side = "away"
    except Exception:
        possession_side = None

    if isinstance(situation.get("down"), int):
        down = situation.get("down")
    if isinstance(situation.get("distance"), int):
        distance = situation.get("distance")

    yl = situation.get("yardLine")
    if isinstance(yl, int):
        yard_line = yl
        # Treat yardline 80+ as red zone (inside opponent 20) when possible.
        red_zone = yard_line >= 80
    else:
        # Fallback to ESPN's own red-zone flag if present.
        red_zone = bool(situation.get("isRedZone"))

    if isinstance(situation.get("homeTimeouts"), int):
        home_timeouts = situation.get("homeTimeouts")
    if isinstance(situation.get("awayTimeouts"), int):
        away_timeouts = situation.get("awayTimeouts")

    last_play = situation.get("lastPlay") or {}
    if isinstance(last_play, dict):
        last_play_short = last_play.get("text") or last_play.get("shortText")

    header_obj = Header(
        game_id=game_id,
        league="NFL",
        season=int(season.get("year") or datetime.now().year),
        week=week.get("number"),
        status=state,  # type: ignore[arg-type]
        kickoff_time_utc=kickoff_time,
        home_team=_map_team_header(home_comp),
        away_team=_map_team_header(away_comp),
        quarter=status_period,
        clock=status_clock,
        possession=possession_side,  # type: ignore[arg-type]
        down=down,
        distance=distance,
        yard_line=yard_line,
        red_zone=red_zone,
        home_timeouts=home_timeouts,
        away_timeouts=away_timeouts,
        last_play_short=last_play_short,
        last_updated_utc=datetime.now(timezone.utc).isoformat(),
    )
    return header_obj


def _map_drives(payload: Dict[str, Any]) -> Drives:
    # Minimal valid structure for now. Can be expanded later with real drive data.
    return Drives(
        current_drive_id=None,
        summary=[],  # type: ignore[list-item]
        current=None,
    )


def _extract_linescore_points(comp: Dict[str, Any], side_key: str) -> Dict[int, int]:
    """Extract points by quarter for a given competitor side ('home' or 'away')."""
    competitors: List[Dict[str, Any]] = comp.get("competitors") or []
    for c in competitors:
        if (c.get("homeAway") or "").lower() == side_key:
            linescores = c.get("linescores") or []
            points_by_q: Dict[int, int] = {}
            for ls in linescores:
                period = ls.get("period") or ls.get("number") or ls.get("sequence")

                raw_value = ls.get("value")
                if not isinstance(raw_value, (int, float)):
                    raw_value = ls.get("displayValue")

                value_int: Optional[int] = None
                if isinstance(raw_value, (int, float)):
                    value_int = int(raw_value)
                elif isinstance(raw_value, str):
                    try:
                        value_int = int(float(raw_value))
                    except ValueError:
                        value_int = None

                if isinstance(period, int) and value_int is not None:
                    points_by_q[period] = value_int
            return points_by_q
    return {}


def _map_scoring(payload: Dict[str, Any], header_obj: Header) -> Scoring:
    header = payload.get("header") or {}
    competitions: List[Dict[str, Any]] = header.get("competitions") or []
    comp = competitions[0] if competitions else {}

    # summary_by_quarter from linescores when available
    home_points_by_q = _extract_linescore_points(comp, "home")
    away_points_by_q = _extract_linescore_points(comp, "away")

    quarters: List[int] = sorted(set(home_points_by_q.keys()) | set(away_points_by_q.keys()))
    summary_by_quarter: List[Dict[str, Any]] = []
    for q in quarters:
        summary_by_quarter.append(
            {
                "quarter": q,
                "home_points": home_points_by_q.get(q, 0),
                "away_points": away_points_by_q.get(q, 0),
            }
        )

    # Fallback: build quarter scoring from scoringPlays if linescores are missing
    scoring_plays_raw: List[Dict[str, Any]] = payload.get("scoringPlays") or []
    if not summary_by_quarter and scoring_plays_raw:
        home_id = header_obj.home_team.id
        away_id = header_obj.away_team.id
        tmp_home: Dict[int, int] = {}
        tmp_away: Dict[int, int] = {}
        for p in scoring_plays_raw:
            team = p.get("team") or {}
            team_id = str(team.get("id") or "")
            period_info = p.get("period") or {}
            q = period_info.get("number") or period_info.get("value")
            if not isinstance(q, int):
                continue
            points = p.get("scoreValue") or p.get("value")
            if not isinstance(points, int):
                continue
            if team_id == home_id:
                tmp_home[q] = tmp_home.get(q, 0) + points
            elif team_id == away_id:
                tmp_away[q] = tmp_away.get(q, 0) + points
        quarters = sorted(set(tmp_home.keys()) | set(tmp_away.keys()))
        for q in quarters:
            summary_by_quarter.append(
                {
                    "quarter": q,
                    "home_points": tmp_home.get(q, 0),
                    "away_points": tmp_away.get(q, 0),
                }
            )

    # scoring.plays and touchdown_scorers
    home_id = header_obj.home_team.id
    away_id = header_obj.away_team.id

    plays: List[Dict[str, Any]] = []
    td_counts: Dict[tuple, int] = {}

    for p in scoring_plays_raw:
        team_info = p.get("team") or {}
        team_id = str(team_info.get("id") or "")
        if team_id == home_id:
            team_side = "home"
        elif team_id == away_id:
            team_side = "away"
        else:
            # Skip scores from neutral/unknown teams (should be rare)
            continue

        period_info = p.get("period") or {}
        quarter = period_info.get("number") or period_info.get("value") or 0
        if not isinstance(quarter, int):
            quarter = 0

        clock_info = p.get("clock") or {}
        clock = clock_info.get("displayValue") or clock_info.get("value") or ""

        description = p.get("text") or p.get("description") or ""

        scoring_type = (p.get("scoringType") or p.get("type") or {}) or {}
        type_name = (scoring_type.get("shortDisplayName") or scoring_type.get("name") or "").lower()

        if "touchdown" in type_name or type_name == "td":
            play_type = "TD"
        elif "field goal" in type_name or type_name == "fg":
            play_type = "FG"
        elif "safety" in type_name:
            play_type = "Safety"
        elif "extra point" in type_name or "xp" in type_name:
            play_type = "XP"
        elif "two-point" in type_name or "two point" in type_name or "2pt" in type_name:
            play_type = "2PT"
        else:
            play_type = "Other"

        yards_val = p.get("statYardage") or p.get("yards")
        yards: Optional[int] = None
        if isinstance(yards_val, (int, float)):
            yards = int(yards_val)
        elif isinstance(yards_val, str):
            try:
                yards = int(yards_val)
            except ValueError:
                yards = None

        athletes = p.get("athletesInvolved") or p.get("players") or []
        player_primary: Optional[str] = None
        if isinstance(athletes, list) and athletes:
            a0 = athletes[0] or {}
            athlete_info = a0.get("athlete") or a0
            if isinstance(athlete_info, dict):
                player_primary = (
                    athlete_info.get("displayName")
                    or athlete_info.get("shortName")
                    or athlete_info.get("name")
                )

        play_id = str(p.get("id") or f"{quarter}-{clock}-{team_side}")

        plays.append(
            {
                "id": play_id,
                "quarter": int(quarter),
                "clock": clock,
                "team": team_side,
                "type": play_type,
                "description": description,
                "yards": yards,
                "player_primary": player_primary,
            }
        )

        if play_type == "TD" and player_primary:
            key = (player_primary, team_side)
            td_counts[key] = td_counts.get(key, 0) + 1

    touchdown_scorers: List[Dict[str, Any]] = [
        {"player": player, "team": team, "count": count}
        for (player, team), count in td_counts.items()
    ]

    return Scoring(
        summary_by_quarter=summary_by_quarter,  # type: ignore[list-item]
        plays=plays,  # type: ignore[list-item]
        touchdown_scorers=touchdown_scorers,  # type: ignore[list-item]
    )


def _parse_team_statistics(stats_list: List[Dict[str, Any]]) -> TeamStats:
    team_stats = TeamStats()

    for s in stats_list or []:
        if not isinstance(s, dict):
            continue

        name = s.get("name")
        value = s.get("value", s.get("displayValue"))

        if value in (None, ""):
            continue

        # Normalise value to string for parsing where needed
        value_str = str(value)

        try:
            if name == "totalYards":
                team_stats.total_yards = int(value)
            elif name in {"totalPlays", "plays"}:
                team_stats.plays = int(value)
            elif name == "yardsPerPlay":
                team_stats.yards_per_play = float(value)
            elif name in {"passingYards", "netPassingYards"}:
                team_stats.passing_yards = int(value)
            elif name == "rushingYards":
                team_stats.rushing_yards = int(value)
            elif name == "turnovers":
                team_stats.turnovers = int(value)
            elif name in {"totalPenaltiesYards", "totalPenalties"}:
                # ESPN often encodes as "5-45" (penalties-yards)
                parts = value_str.replace(" ", "").split("-")
                if len(parts) == 2:
                    team_stats.penalties = int(parts[0])
                    team_stats.penalty_yards = int(parts[1])
            elif name in {"thirdDownEff", "thirdDownEfficiency"}:
                # "6-12" -> 6 of 12
                parts = value_str.replace(" ", "").split("-")
                if len(parts) == 2:
                    team_stats.third_down_made = int(parts[0])
                    team_stats.third_down_attempts = int(parts[1])
            elif name in {"redZoneEff", "redZoneEfficiency"}:
                # "3-4" -> 3 TDs on 4 trips
                parts = value_str.replace(" ", "").split("-")
                if len(parts) == 2:
                    team_stats.red_zone_tds = int(parts[0])
                    team_stats.red_zone_trips = int(parts[1])
            elif name in {"timeOfPossession", "possessionTime"}:
                team_stats.time_of_possession = value_str
        except (TypeError, ValueError):
            # If any parsing fails, skip that particular stat but keep others.
            continue

    return team_stats


def _map_boxscore(payload: Dict[str, Any], header_obj: Header) -> Boxscore:
    box = payload.get("boxscore") or {}
    teams: List[Dict[str, Any]] = box.get("teams") or []

    home_team_id = header_obj.home_team.id
    away_team_id = header_obj.away_team.id

    home_team_stats = TeamStats()
    away_team_stats = TeamStats()

    for t in teams:
        team_info = t.get("team") or {}
        team_id = str(team_info.get("id") or "")
        stats_list = t.get("statistics") or []
        if team_id == home_team_id:
            home_team_stats = _parse_team_statistics(stats_list)
        elif team_id == away_team_id:
            away_team_stats = _parse_team_statistics(stats_list)

    # Player stats: designed to work with a simplified representation
    # (dict-based 'stats' per athlete); if the real ESPN shape doesn't match,
    # this will simply yield empty lists rather than failing.
    players_sections: List[Dict[str, Any]] = box.get("players") or []
    passing_stats: List[Dict[str, Any]] = []
    rushing_stats: List[Dict[str, Any]] = []
    receiving_stats: List[Dict[str, Any]] = []

    def _side_for_team(team_id: str) -> Optional[str]:
        if team_id == home_team_id:
            return "home"
        if team_id == away_team_id:
            return "away"
        return None

    for team_section in players_sections:
        team_info = team_section.get("team") or {}
        team_id = str(team_info.get("id") or "")
        side = _side_for_team(team_id)
        if side is None:
            continue

        for group in team_section.get("statistics") or []:
            group_name = group.get("name")
            athletes = group.get("athletes") or []
            if not isinstance(athletes, list):
                continue

            for athlete in athletes:
                athlete_info = (athlete.get("athlete") or {}) if isinstance(athlete, dict) else {}
                stats = athlete.get("stats") if isinstance(athlete, dict) else None
                if not isinstance(stats, dict):
                    # If stats aren't a mapping (e.g. ESPN's native list form),
                    # we skip rather than guessing index positions.
                    continue

                player_name = (
                    athlete_info.get("displayName")
                    or athlete_info.get("shortName")
                    or athlete_info.get("name")
                )
                if not player_name:
                    continue

                if group_name == "passing":
                    required = ["completions", "attempts", "yards", "touchdowns", "interceptions"]
                    if not all(k in stats for k in required):
                        continue
                    passing_stats.append(
                        {
                            "player": player_name,
                            "team": side,
                            "completions": int(stats["completions"]),
                            "attempts": int(stats["attempts"]),
                            "yards": int(stats["yards"]),
                            "touchdowns": int(stats["touchdowns"]),
                            "interceptions": int(stats["interceptions"]),
                        }
                    )
                elif group_name == "rushing":
                    required = ["carries", "yards", "touchdowns"]
                    if not all(k in stats for k in required):
                        continue
                    rushing_stats.append(
                        {
                            "player": player_name,
                            "team": side,
                            "carries": int(stats["carries"]),
                            "yards": int(stats["yards"]),
                            "touchdowns": int(stats["touchdowns"]),
                        }
                    )
                elif group_name == "receiving":
                    required = ["receptions", "yards", "touchdowns"]
                    if not all(k in stats for k in required):
                        continue
                    receiving_stats.append(
                        {
                            "player": player_name,
                            "team": side,
                            "receptions": int(stats["receptions"]),
                            "yards": int(stats["yards"]),
                            "touchdowns": int(stats["touchdowns"]),
                        }
                    )

    # Take the top 1–3 for each category by yards.
    passing_stats_sorted = sorted(passing_stats, key=lambda s: s["yards"], reverse=True)[:3]
    rushing_stats_sorted = sorted(rushing_stats, key=lambda s: s["yards"], reverse=True)[:3]
    receiving_stats_sorted = sorted(receiving_stats, key=lambda s: s["yards"], reverse=True)[:3]

    player_stats = PlayerStats(
        passing=passing_stats_sorted,  # type: ignore[list-item]
        rushing=rushing_stats_sorted,  # type: ignore[list-item]
        receiving=receiving_stats_sorted,  # type: ignore[list-item]
    )

    team_stats_wrapper = TeamStatsWrapper(
        home=home_team_stats,
        away=away_team_stats,
    )

    return Boxscore(team_stats=team_stats_wrapper, player_stats=player_stats)


def _map_meta(payload: Dict[str, Any]) -> Meta:
    header = payload.get("header") or {}
    competitions: List[Dict[str, Any]] = header.get("competitions") or []
    comp = competitions[0] if competitions else {}

    venue_raw = comp.get("venue") or {}
    address = venue_raw.get("address") or {}

    venue = Venue(
        name=venue_raw.get("fullName") or venue_raw.get("name"),
        city=address.get("city"),
        state=address.get("state"),
        indoor=venue_raw.get("indoor"),
    )

    broadcasts: List[Dict[str, Any]] = comp.get("broadcasts") or comp.get("geoBroadcasts") or []
    network: Optional[str] = None
    if broadcasts:
        b0 = broadcasts[0]
        names = b0.get("names")
        if isinstance(names, list) and names:
            network = names[0]
        else:
            network = b0.get("network")

    broadcast = Broadcast(
        network=network,
        stream=None,
    )

    # Weather stub – this can be extended later.
    weather = Weather(
        description="Unavailable",
        temperature_f=None,
        wind_mph=None,
        humidity_pct=None,
    )

    return Meta(venue=venue, broadcast=broadcast, weather=weather)


def _map_analytics(payload: Dict[str, Any]) -> Analytics:
    # Minimal but valid analytics structure. No real win probability yet.
    win_prob = WinProbability(
        home=None,
        away=None,
        last_updated_utc=None,
    )

    team_success_rates = TeamSuccessRatesWrapper(
        home=TeamSuccessRates(
            success_rate=None,
            explosive_play_rate=None,
            epa_per_play=None,
        ),
        away=TeamSuccessRates(
            success_rate=None,
            explosive_play_rate=None,
            epa_per_play=None,
        ),
    )

    return Analytics(
        win_probability=win_prob,
        current_situation=None,
        team_success_rates=team_success_rates,
    )


@app.get("/games/today")
def get_games_today():
    """
    Return a lightweight list of today's NFL games using the ESPN scoreboard API.

    Response shape:
      { "games": [ { game_id, league, season, week, status, quarter, clock,
                     kickoff_time_utc, home_team, away_team, red_zone } ] }
    """
    url = ESPN_NFL_SCOREBOARD_URL

    try:
        response = httpx.get(url, timeout=5.0)
    except httpx.RequestError as exc:
        return JSONResponse(
            status_code=502,
            content={
                "error": "Failed to reach ESPN API",
                "endpoint": "scoreboard",
                "message": str(exc),
            },
        )

    if getattr(response, "status_code", 500) != 200:
        return JSONResponse(
            status_code=502,
            content={
                "error": "ESPN API returned non-200 status",
                "endpoint": "scoreboard",
                "status_code": getattr(response, "status_code", None),
            },
        )

    try:
        payload = response.json()
    except Exception as exc:
        return JSONResponse(
            status_code=502,
            content={
                "error": "Invalid JSON from ESPN API",
                "endpoint": "scoreboard",
                "message": str(exc),
            },
        )

    try:
        events = payload.get("events") or []
        games: List[Dict[str, Any]] = []

        # Top-level season/week can be weird (e.g. "2025-12-05" when you force a date),
        # so only treat them as dicts if they actually are dicts.
        season_info_raw = payload.get("season") or {}
        season_info = season_info_raw if isinstance(season_info_raw, dict) else {}
        week_info_raw = payload.get("week") or {}
        week_info = week_info_raw if isinstance(week_info_raw, dict) else {}

        for event in events:
            event_id = str(event.get("id") or "")
            competitions = event.get("competitions") or []
            if not competitions:
                continue
            comp = competitions[0]

            raw_status = comp.get("status")
            if isinstance(raw_status, dict):
                status_type = raw_status.get("type") or {}
            else:
                status_type = {}
            normalized = _normalize_game_status(status_type)

            competitors = comp.get("competitors") or []
            home_comp: Optional[Dict[str, Any]] = None
            away_comp: Optional[Dict[str, Any]] = None
            for c in competitors:
                side = (c.get("homeAway") or "").lower()
                if side == "home":
                    home_comp = c
                elif side == "away":
                    away_comp = c

            if home_comp is None or away_comp is None:
                # Skip malformed entries rather than failing the whole response.
                continue

            # Reuse our existing team header mapper for consistency.
            home_header = _map_team_header(home_comp)
            away_header = _map_team_header(away_comp)

            situation = comp.get("situation") or {}
            yl = situation.get("yardLine")
            is_red = bool(situation.get("isRedZone"))
            if isinstance(yl, int):
                is_red = is_red or yl >= 80

            # Event-level season/week can *also* be non-dicts, so guard them.
            event_season_raw = event.get("season") or {}
            event_season = event_season_raw if isinstance(event_season_raw, dict) else {}
            event_week_raw = event.get("week") or {}
            event_week = event_week_raw if isinstance(event_week_raw, dict) else {}

            # Normalize kickoff_time_utc so it always has seconds, e.g. 2025-12-07T18:00:00Z
            raw_date = comp.get("date")
            kickoff_time_utc: Optional[str] = None
            if isinstance(raw_date, str):
                # If it's like 2025-12-07T18:00Z (no seconds), turn it into 2025-12-07T18:00:00Z
                if raw_date.endswith("Z") and raw_date.count(":") == 1:
                    kickoff_time_utc = raw_date.replace("Z", ":00Z")
                else:
                    kickoff_time_utc = raw_date

            game_obj: Dict[str, Any] = {
                "game_id": event_id,
                "league": "NFL",
                "season": season_info.get("year") or event_season.get("year"),
                "week": week_info.get("number") or event_week.get("number"),
                "status": normalized["status"],
                "quarter": normalized["period"],
                "clock": normalized["clock"],
                "kickoff_time_utc": kickoff_time_utc,
                "home_team": home_header.dict(),
                "away_team": away_header.dict(),
                "red_zone": is_red,
            }
            games.append(game_obj)
    except Exception as exc:
        return JSONResponse(
            status_code=502,
            content={
                "error": "Unexpected ESPN response structure",
                "endpoint": "scoreboard",
                "message": str(exc),
            },
        )

    return {"games": games}


@app.get("/games/{game_id}/live", response_model=GameLiveResponse)
def get_game_live(game_id: str):
    """
    Fetch live game data from ESPN and project it into our GameLiveResponse schema.

    Behaviour:
    - First try the Site summary endpoint.
    - If that returns 404, fall back to the ESPN Core API event resource.
    """
    summary_url = f"{ESPN_NFL_SUMMARY_URL}?event={game_id}"

    try:
        response = httpx.get(summary_url, timeout=5.0)
    except httpx.RequestError as exc:
        # Network or connection-related error
        return JSONResponse(
            status_code=502,
            content={
                "error": "Failed to reach ESPN API",
                "game_id": game_id,
                "endpoint": "summary",
                "message": str(exc),
            },
        )

    status_code = getattr(response, "status_code", 500)

    # Primary path: Site summary (unchanged behaviour on 200)
    if status_code == 200:
        try:
            payload = response.json()
        except Exception as exc:
            return JSONResponse(
                status_code=502,
                content={
                    "error": "Invalid JSON from ESPN API",
                    "game_id": game_id,
                    "endpoint": "summary",
                    "message": str(exc),
                },
            )

    # Fallback path: Site summary 404 -> ESPN Core API event tree
    elif status_code == 404:
        try:
            payload = _build_summary_like_payload_from_core(game_id)
        except Exception as exc:
            return JSONResponse(
                status_code=502,
                content={
                    "error": "ESPN Core API fallback failed",
                    "game_id": game_id,
                    "endpoint": "core-event",
                    "message": str(exc),
                },
            )

    # Any other non-200 remains a hard failure
    else:
        return JSONResponse(
            status_code=502,
            content={
                "error": "ESPN API returned non-200 status",
                "game_id": game_id,
                "endpoint": "summary",
                "status_code": status_code,
            },
        )

    # Common mapping path regardless of summary vs. Core fallback
    try:
        header_obj = _map_header(payload, game_id)
        drives = _map_drives(payload)
        scoring = _map_scoring(payload, header_obj)
        boxscore = _map_boxscore(payload, header_obj)
        meta = _map_meta(payload)
        analytics = _map_analytics(payload)
    except Exception as exc:
        # If the upstream response shape changes in a way we don't expect,
        # surface that as a bad gateway rather than a 500.
        return JSONResponse(
            status_code=502,
            content={
                "error": "Unexpected ESPN response structure",
                "game_id": game_id,
                "message": str(exc),
            },
        )

    return GameLiveResponse(
        header=header_obj,
        drives=drives,
        scoring=scoring,
        boxscore=boxscore,
        meta=meta,
        analytics=analytics,
    )
