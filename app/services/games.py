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
    - situation (clock, period, down & distance)
    """
    raw: Dict[str, Any] = espn.summary(sport, event_id)

    header = raw.get("header", {}) or {}
    competitions = header.get("competitions") or [{}]
    comp0: Dict[str, Any] = competitions[0] or {}

    raw_competitors = comp0.get("competitors") or []

    # --- High-level game summary -------------------------------------------------
    status_type = (comp0.get("status") or {}).get("type") or {}
    # Prefer shortDetail (e.g. "13:10 - 3rd") then description (e.g. "In Progress")
    status = (
        status_type.get("shortDetail")
        or status_type.get("description")
        or ""
    )

    summary = GameSummary(
        id=header.get("id") or str(event_id),
        sport=sport,
        startTime=comp0.get("date") or header.get("date") or "",
        status=status,
        venue=(comp0.get("venue") or {}).get("fullName"),
        competitors=[_map_competitor(c) for c in raw_competitors],
    )

    # --- Boxscore: player stats (unchanged logic so Box Score stays working) ----
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
            # ESPN usually uses `name` but we fall back to any reasonable label.
            cat_title = (
                cat.get("name")
                or cat.get("displayName")
                or cat.get("shortDisplayName")
                or ""
            )

            rows: List[List[str]] = []
            for athlete in cat.get("athletes") or []:
                athlete_info = athlete.get("athlete") or {}
                label = (
                    athlete_info.get("displayName")
                    or athlete_info.get("shortName")
                    or ""
                )
                stats = athlete.get("stats") or []
                row = [label] + [str(s) for s in stats]
                rows.append(row)

            if rows:
                title = f"{team_name} {cat_title.title()}".strip()
                boxscore_categories.append(
                    BoxScoreCategory(title=title, rows=rows)
                )

    # --- Team stats (aggregate, unchanged) --------------------------------------
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
            [s.get("label", ""), s.get("displayValue", "")]
            for s in (stat.get("statistics") or [])
        ]
        if rows:
            team_stats_categories.append(
                BoxScoreCategory(title=f"{name} Team Stats", rows=rows)
            )

    # --- Situation: clock + period + down & distance ----------------------------
    raw_situation = comp0.get("situation") or {}
    situation: GameSituation | None = None
    if raw_situation:
        # period can live under competition.status.period or header.status.period
        status_period = (comp0.get("status") or {}).get("period")
        if not isinstance(status_period, int):
            status_period = (header.get("status") or {}).get("period")
        if not isinstance(status_period, int):
            status_period = None

        situation = GameSituation(
            clock=raw_situation.get("clock"),
            period=status_period,
            down=raw_situation.get("down"),
            distance=raw_situation.get("distance"),
            downDistanceText=raw_situation.get("downDistanceText"),
            shortDownDistanceText=raw_situation.get("shortDownDistanceText"),
            yardLine=raw_situation.get("yardLine"),
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
