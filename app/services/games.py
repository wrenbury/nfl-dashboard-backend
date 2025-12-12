# app/services/games.py

from typing import Any, Dict, List

from ..models.schemas import (
    Sport,
    GameDetails,
    GameSummary,
    BoxScoreCategory,
    GameSituation,
    Competitor,
    Team,
)
from ..clients import espn, cfbd
from .scoreboard import _map_competitor, _normalize_cfb_status, _convert_utc_timestamp_to_et
from ..utils.cfb_logos import get_cfb_logo


def _get_status_text(comp: Dict[str, Any], header: Dict[str, Any]) -> str:
    status_type = (comp.get("status") or {}).get("type") or {}
    short = status_type.get("shortDetail")
    desc = status_type.get("description")
    if short:
        return short
    if desc:
        return desc
    # fallback: header.status if needed
    header_type = (header.get("status") or {}).get("type") or {}
    return header_type.get("shortDetail") or header_type.get("description") or ""


def _extract_period(comp: Dict[str, Any], header: Dict[str, Any]) -> int | None:
    period = (comp.get("status") or {}).get("period")
    if isinstance(period, int):
        return period
    period = (header.get("status") or {}).get("period")
    if isinstance(period, int):
        return period
    return None


def _extract_possession_team_id(raw_situation: Dict[str, Any]) -> str | None:
    """
    ESPN usually exposes possession as either:
      - a team id (string / int), or
      - an object with id / uid fields.
    Be tolerant and stringify whatever we get.
    """
    possession = raw_situation.get("possession")

    if possession is None:
        return None

    if isinstance(possession, dict):
        team_id = possession.get("id") or possession.get("uid")
        if team_id is None:
            return None
        return str(team_id)

    # scalar id
    return str(possession)


def _cfb_game_details(event_id: str) -> GameDetails:
    """
    Build GameDetails for CFB using CollegeFootballData API.

    Note: CFBD doesn't have all the same data as ESPN (no win probability, limited play-by-play),
    but we can provide the basic game summary and available stats.
    """
    # CFBD uses integer game IDs
    game_id = int(event_id)

    # Get game info from CFBD /games endpoint
    # We need to figure out which year/week to fetch - for now we'll try recent weeks
    # This is a limitation of CFBD API - it doesn't have a single game endpoint like ESPN
    # In practice, we'll need to search for the game
    raw_game = None

    # Try current year and previous year
    from datetime import datetime
    current_year = datetime.now().year

    for year in [current_year, current_year - 1]:
        for week in range(1, 17):  # Try all weeks
            try:
                games = cfbd.games(year=year, week=week, seasonType="regular")
                if games:
                    for g in games:
                        if g.get("id") == game_id:
                            raw_game = g
                            break
                if raw_game:
                    break
            except:
                continue
        if raw_game:
            break

    if not raw_game:
        # Fallback: create minimal game details
        return GameDetails(
            summary=GameSummary(
                id=event_id,
                sport="college-football",
                startTime="",
                status="Game not found",
                venue=None,
                competitors=[],
            ),
            boxscore=[],
            teamStats=[],
            plays=None,
            winProbability=None,
            situation=None,
        )

    # Build game summary
    home_team_name = raw_game.get("homeTeam") or raw_game.get("home_team") or "Home"
    away_team_name = raw_game.get("awayTeam") or raw_game.get("away_team") or "Away"
    home_team_id = raw_game.get("homeId") or raw_game.get("home_id") or home_team_name
    away_team_id = raw_game.get("awayId") or raw_game.get("away_id") or away_team_name

    home_points = raw_game.get("homePoints") or raw_game.get("home_points") or 0
    away_points = raw_game.get("awayPoints") or raw_game.get("away_points") or 0

    home_rank = raw_game.get("homeRank") or raw_game.get("home_rank")
    away_rank = raw_game.get("awayRank") or raw_game.get("away_rank")

    home_logo = get_cfb_logo(str(home_team_name))
    away_logo = get_cfb_logo(str(away_team_name))

    # Determine status
    raw_status = raw_game.get("status") or raw_game.get("status_name")
    completed = raw_game.get("completed", False)
    state = _normalize_cfb_status(raw_status, completed)

    STATUS_LABELS = {
        "pre": "Scheduled",
        "in": "In Progress",
        "post": "Postgame",
        "halftime": "Halftime",
        "final": "Final",
        "delayed": "Delayed",
        "canceled": "Canceled",
    }
    status_text = STATUS_LABELS.get(state, "Scheduled")

    start_time = raw_game.get("startDate") or raw_game.get("start_date") or ""
    if start_time:
        start_time = _convert_utc_timestamp_to_et(start_time)

    venue = raw_game.get("venue") or raw_game.get("venue_name")

    summary = GameSummary(
        id=event_id,
        sport="college-football",
        startTime=start_time,
        status=status_text,
        venue=venue,
        competitors=[
            Competitor(
                team=Team(
                    id=str(away_team_id),
                    name=str(away_team_name),
                    nickname=None,
                    abbreviation=None,
                    color=None,
                    logo=away_logo,
                    record=None,
                    rank=away_rank,
                ),
                homeAway="away",
                score=int(away_points) if away_points else 0,
            ),
            Competitor(
                team=Team(
                    id=str(home_team_id),
                    name=str(home_team_name),
                    nickname=None,
                    abbreviation=None,
                    color=None,
                    logo=home_logo,
                    record=None,
                    rank=home_rank,
                ),
                homeAway="home",
                score=int(home_points) if home_points else 0,
            ),
        ],
    )

    # Try to get plays data from CFBD
    plays = None
    try:
        plays_data = cfbd.game_details(game_id)
        if plays_data and plays_data.get("plays"):
            plays = plays_data["plays"]
    except:
        pass

    # CFBD doesn't provide win probability or detailed box scores like ESPN
    # Return minimal game details
    return GameDetails(
        summary=summary,
        boxscore=[],
        teamStats=[],
        plays=plays,
        winProbability=None,
        situation=None,
    )


def game_details(sport: Sport, event_id: str) -> GameDetails:
    """
    Build a rich GameDetails payload for a single event.

    Routes to appropriate data source:
    - NFL: ESPN API
    - CFB: CollegeFootballData API

    This must remain backwards compatible with existing GameDetails consumers:
    - summary
    - boxscore
    - teamStats
    - plays
    - winProbability

    New:
    - situation (clock, period, down & distance, possession, red zone)
    """
    # Route CFB to CFBD API
    if sport == "college-football":
        return _cfb_game_details(event_id)

    # NFL uses ESPN
    raw: Dict[str, Any] = espn.summary(sport, event_id)

    header = raw.get("header") or {}
    competitions = header.get("competitions") or [{}]
    comp0: Dict[str, Any] = competitions[0] or {}
    raw_competitors = comp0.get("competitors") or []

    # --- High-level game summary -------------------------------------------------
    summary = GameSummary(
        id=str(header.get("id") or event_id),
        sport=sport,
        startTime=comp0.get("date") or header.get("date") or "",
        status=_get_status_text(comp0, header),
        venue=(comp0.get("venue") or {}).get("fullName"),
        competitors=[_map_competitor(c) for c in raw_competitors],
    )

    # --- Boxscore: player stats --------------------------------------------------
    boxscore = raw.get("boxscore") or {}
    player_sides = boxscore.get("players") or []
    boxscore_categories: List[BoxScoreCategory] = []

    for side in player_sides:
        team = side.get("team") or {}
        team_name = (
            team.get("displayName")
            or team.get("name")
            or team.get("shortDisplayName")
            or ""
        )

        for cat in side.get("statistics") or []:
            cat_title = (
                cat.get("name")
                or cat.get("displayName")
                or cat.get("shortDisplayName")
                or ""
            )

            # Extract column headers from ESPN data
            raw_labels = cat.get("labels") or cat.get("keys") or []
            headers = ["Player"] + [str(lbl) for lbl in raw_labels]

            rows: List[List[str]] = []
            for athlete in cat.get("athletes") or []:
                athlete_info = athlete.get("athlete") or {}
                label = (
                    athlete_info.get("displayName")
                    or athlete_info.get("shortName")
                    or ""
                )
                stats = [str(s) for s in (athlete.get("stats") or [])]
                if not label and not stats:
                    continue
                rows.append([label] + stats)

            if rows:
                title = f"{team_name} {cat_title}".strip()
                boxscore_categories.append(BoxScoreCategory(
                    title=title,
                    headers=headers if len(headers) > 1 else None,
                    rows=rows
                ))

    # --- Team stats --------------------------------------------------------------
    team_stats_categories: List[BoxScoreCategory] = []
    for stat in boxscore.get("teams") or []:
        team = stat.get("team") or {}
        name = (
            team.get("displayName")
            or team.get("name")
            or team.get("shortDisplayName")
            or "Team"
        )
        rows = [
            [s.get("label") or "", s.get("displayValue") or ""]
            for s in (stat.get("statistics") or [])
        ]
        if rows:
            team_stats_categories.append(
                BoxScoreCategory(title=f"{name} Team Stats", rows=rows)
            )

    # --- Situation: clock + period + down & distance + possession ---------------
    raw_situation = comp0.get("situation") or {}
    situation: GameSituation | None = None
    if raw_situation:
        situation = GameSituation(
            clock=raw_situation.get("clock"),
            period=_extract_period(comp0, header),
            down=raw_situation.get("down"),
            distance=raw_situation.get("distance"),
            yardLine=raw_situation.get("yardLine"),
            shortDownDistanceText=raw_situation.get("shortDownDistanceText"),
            downDistanceText=raw_situation.get("downDistanceText"),
            possessionTeamId=_extract_possession_team_id(raw_situation),
            possessionText=raw_situation.get("possessionText"),
            isRedZone=raw_situation.get("isRedZone"),
        )

    # --- Plays + win probability (unchanged) ------------------------------------
    plays = ((raw.get("drives") or {}).get("current") or {}).get("plays")
    win_probability = raw.get("winprobability")

    return GameDetails(
        summary=summary,
        boxscore=boxscore_categories,
        teamStats=team_stats_categories,
        plays=plays,
        winProbability=win_probability,
        situation=situation,
    )
