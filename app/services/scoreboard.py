from typing import List, Optional
from datetime import datetime, timezone

from ..models.schemas import *
from ..clients import espn, cfbd
from ..cfb_scoreboard import _get_week_for_date, _normalize_cfb_status


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
                competitors=[
                    _map_competitor(c)
                    for c in sorted(comp, key=lambda x: x["homeAway"])
                ],
            )
        )
    return out


# ---------------------------------------------------------------------------
# College Football scoreboard via CollegeFootballData
# ---------------------------------------------------------------------------

def _build_cfb_scoreboard_from_cfbd(
    date: str | None,
    week: int | None,
) -> List[GameSummary]:
    """Build a GameSummary-style scoreboard for college football using CFBD.

    This keeps the same GameSummary shape used for NFL so the frontend can treat
    both leagues uniformly while sourcing data from different providers.
    """
    # Derive season year from date if present, otherwise fall back to current year.
    year: Optional[int] = None
    if date and len(date) >= 4 and date[:4].isdigit():
        year = int(date[:4])
    if year is None:
        year = datetime.now(timezone.utc).year

    cfbd_week: Optional[int] = week
    if cfbd_week is None and date:
        # Uses CFBD /calendar under the hood via app.cfb_scoreboard._get_week_for_date
        cfbd_week = _get_week_for_date(year, date)

    # If we still don't have a week, return an empty board rather than erroring.
    if cfbd_week is None:
        return []

    raw_games = cfbd.games(year=year, week=cfbd_week, seasonType="regular") or []
    out: List[GameSummary] = []

    STATUS_LABELS = {
        "pre": "Scheduled",
        "in": "In Progress",
        "post": "Postgame",
        "halftime": "Halftime",
        "final": "Final",
        "delayed": "Delayed",
        "canceled": "Canceled",
    }

    for g in raw_games:
        if not isinstance(g, dict):
            continue

        game_id = str(g.get("id") or "")
        if not game_id:
            continue

        home_team_name = g.get("home_team") or "Home"
        away_team_name = g.get("away_team") or "Away"

        home_points = g.get("home_points")
        away_points = g.get("away_points")

        # Normalize CFBD status into a simple state, then map to a human label
        state = _normalize_cfb_status(g.get("status"), g.get("completed"))
        status_desc = STATUS_LABELS.get(state, "Scheduled")

        venue = g.get("venue")

        home_comp = Competitor(
            team=Team(
                id=str(g.get("home_id") or home_team_name),
                name=home_team_name,
                nickname=None,
                abbreviation=None,
                color=None,
                logo=None,
                record=None,
                rank=None,
            ),
            homeAway="home",
            score=home_points if isinstance(home_points, int) else 0,
        )

        away_comp = Competitor(
            team=Team(
                id=str(g.get("away_id") or away_team_name),
                name=away_team_name,
                nickname=None,
                abbreviation=None,
                color=None,
                logo=None,
                record=None,
                rank=None,
            ),
            homeAway="away",
            score=away_points if isinstance(away_points, int) else 0,
        )

        start_time = g.get("start_date")  # CFBD uses ISO 8601-like timestamps

        # Keep away/home ordering consistent with ESPN mapping (away first).
        competitors = [away_comp, home_comp]

        out.append(
            GameSummary(
                id=game_id,
                sport="college-football",
                startTime=start_time,
                status=status_desc,
                venue=venue,
                competitors=competitors,
            )
        )

    return out


def get_scoreboard(sport: Sport, date: str | None, week: int | None):
    """Route NFL to ESPN, CFB to CFBD."""
    if sport == "nfl":
        raw = espn.scoreboard(sport, date=date, week=week)
        return parse_scoreboard(sport, raw)

    if sport == "college-football":
        return _build_cfb_scoreboard_from_cfbd(date=date, week=week)

    # Unknown sport -> empty board (defensive default)
    return []
