# app/services/games.py

from typing import Any, Dict, List

from ..models.schemas import (
    Sport,
    GameDetails,
    GameSummary,
    BoxScoreCategory,
    GameSituation,
)
from ..clients import espn
from .scoreboard import _map_competitor


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


def game_details(sport: Sport, event_id: str) -> GameDetails:
    """
    Build a rich GameDetails payload for a single event, powered by ESPN summary.

    This must remain backwards compatible with existing GameDetails consumers:
    - summary
    - boxscore
    - teamStats
    - plays
    - winProbability

    New:
    - situation (clock, period, down & distance, possession, red zone)
    """
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
