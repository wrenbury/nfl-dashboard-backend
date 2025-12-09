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


def _safe_get(d: Dict[str, Any], *keys: str, default=None):
    cur: Any = d
    for k in keys:
        if not isinstance(cur, dict):
            return default
        cur = cur.get(k)
    return cur if cur is not None else default


def game_details(sport: Sport, event_id: str) -> GameDetails:
    """
    Build a rich GameDetails payload for a single event, powered by ESPN summary.

    This is used by the NFL game page and must remain backwards compatible
    with existing GameDetails consumers.
    """
    raw: Dict[str, Any] = espn.summary(sport, event_id)

    header = raw.get("header") or {}
    competitions = header.get("competitions") or []
    comp0: Dict[str, Any] = competitions[0] if competitions else {}
    raw_competitors = comp0.get("competitors") or []

    # --- High-level game summary -------------------------------------------------
    # Prefer ESPN's shortDetail (e.g. "1:10 - 2nd") when available; otherwise fall back
    # to the more generic description (e.g. "In Progress").
    status_type = (comp0.get("status") or {}).get("type") or {}
    status_short = status_type.get("shortDetail")
    status_desc = status_type.get("description") or ""
    status = status_short or status_desc or ""

    summary = GameSummary(
        id=str(header.get("id") or event_id),
        sport=sport,
        startTime=comp0.get("date") or header.get("date") or "",
        status=status,
        venue=(comp0.get("venue") or {}).get("fullName"),
        competitors=[_map_competitor(c) for c in raw_competitors],
    )

    # --- Boxscore: player stats --------------------------------------------------
    boxscore_categories: List[BoxScoreCategory] = []
    boxscore = raw.get("boxscore") or {}

    for team_block in boxscore.get("players") or []:
        title = (
            (team_block.get("team") or {}).get("displayName")
            or team_block.get("name")
            or "Players"
        )
        rows: List[List[str]] = []

        for stat_group in team_block.get("statistics") or []:
            for stat in stat_group.get("stats") or []:
                label = stat.get("label") or ""
                val = stat.get("displayValue") or ""
                if label or val:
                    rows.append([label, val])

        if rows:
            boxscore_categories.append(BoxScoreCategory(title=title, rows=rows))

    # --- Team stats --------------------------------------------------------------
    team_stats_categories: List[BoxScoreCategory] = []

    for team_stat in boxscore.get("teams") or []:
        name = (team_stat.get("team") or {}).get("displayName") or "Team"
        rows: List[List[str]] = []

        for s in team_stat.get("statistics") or []:
            label = s.get("label") or ""
            val = s.get("displayValue") or ""
            if label or val:
                rows.append([label, val])

        if rows:
            team_stats_categories.append(
                BoxScoreCategory(title=f"{name} Team Stats", rows=rows)
            )

    # --- Situation: clock + down & distance -------------------------------------
    raw_situation = comp0.get("situation") or {}
    situation = None
    if raw_situation:
        period = (
            _safe_get(comp0, "status", "period")
            or _safe_get(header, "status", "period")
        )
        situation = GameSituation(
            clock=raw_situation.get("clock"),
            period=period if isinstance(period, int) else None,
            down=raw_situation.get("down"),
            distance=raw_situation.get("distance"),
            downDistanceText=raw_situation.get("downDistanceText"),
            shortDownDistanceText=raw_situation.get("shortDownDistanceText"),
            yardLine=raw_situation.get("yardLine"),
            possessionText=raw_situation.get("possessionText"),
            isRedZone=raw_situation.get("isRedZone"),
        )

    # --- Plays + win probability -------------------------------------------------
    current_drive = (raw.get("drives") or {}).get("current") or {}
    plays = current_drive.get("plays")

    return GameDetails(
        summary=summary,
        boxscore=boxscore_categories,
        teamStats=team_stats_categories,
        plays=plays,
        winProbability=raw.get("winprobability"),
        situation=situation,
    )
