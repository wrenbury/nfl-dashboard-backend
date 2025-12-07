# app/services/games.py

from ..models.schemas import Sport, GameDetails, GameSummary, BoxScoreCategory
from ..clients import espn
from .scoreboard import _map_competitor


def _team_logo(team: dict) -> str | None:
    """Best-effort extraction of a team logo URL from ESPN summary payload."""
    if not isinstance(team, dict):
        return None
    if team.get("logo"):
        return team["logo"]
    logos = team.get("logos") or []
    if logos and isinstance(logos, list):
        first = logos[0] or {}
        return first.get("href")
    return None


def game_details(sport: Sport, event_id: str) -> GameDetails:
    """
    Normalize an ESPN game summary into our GameDetails schema.

    This function is intentionally defensive: it uses `.get()` everywhere so that
    missing keys in ESPN's payload (e.g. `shortDisplayName`) never raise KeyError.
    Any missing data simply degrades gracefully to empty strings / None.
    """
    raw = espn.summary(sport, event_id)

    header = raw.get("header", {}) or {}
    competitions = header.get("competitions") or [{}]
    comp0 = competitions[0] or {}

    raw_competitors = comp0.get("competitors") or []

    # High-level game summary
    summary = GameSummary(
        id=header.get("id") or str(event_id),
        sport=sport,
        startTime=comp0.get("date") or header.get("date"),
        status=((comp0.get("status") or {}).get("type") or {}).get(
            "description", ""
        ),
        venue=(comp0.get("venue") or {}).get("fullName"),
        competitors=[_map_competitor(c) for c in raw_competitors],
    )

    # --- Boxscore: player stats ---
    boxscore = raw.get("boxscore") or {}
    player_sides = boxscore.get("players") or []

    boxscore_categories: list[BoxScoreCategory] = []

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

            rows: list[list[str]] = []
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

    # --- Team stats (aggregate) ---
    team_stats_categories: list[BoxScoreCategory] = []
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

    return GameDetails(
        summary=summary,
        boxscore=boxscore_categories,
        teamStats=team_stats_categories,
        plays=((raw.get("drives") or {}).get("current") or {}).get("plays"),
        winProbability=raw.get("winprobability"),
    )
