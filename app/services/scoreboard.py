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
# Helpers for CFBD scoreboard
# ---------------------------------------------------------------------------

def _pick_score(*values: object) -> int:
    """Pick the first usable numeric score from a list of possible fields."""
    for v in values:
        if isinstance(v, bool):
            # avoid treating True/False as 1/0
            continue
        if isinstance(v, (int, float)):
            return int(v)
        if isinstance(v, str):
            s = v.strip()
            if s.isdigit():
                return int(s)
            # handle strings like "21.0"
            try:
                return int(float(s))
            except ValueError:
                continue
    return 0


# ---------------------------------------------------------------------------
# College Football scoreboard via CollegeFootballData
# ---------------------------------------------------------------------------

def _build_cfb_scoreboard_from_cfbd(
    date: str | None,
    week: int | None,
) -> List[GameSummary]:
    """
    Build a GameSummary-style scoreboard for college football using CFBD.

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

        # Game id
        game_id = str(g.get("id") or g.get("game_id") or "")
        if not game_id:
            continue

        # Try multiple possible field names for teams (handle schema variants)
        home_team_name = (
            g.get("home_team")
            or g.get("homeTeam")
            or g.get("home_team_name")
            or g.get("home")
        )
        away_team_name = (
            g.get("away_team")
            or g.get("awayTeam")
            or g.get("away_team_name")
            or g.get("away")
        )

        # If CFBD hasn't populated team names yet, skip this game entirely.
        if not home_team_name or not away_team_name:
            continue

        home_team_id = (
            g.get("home_id")
            or g.get("home_team_id")
            or home_team_name
        )
        away_team_id = (
            g.get("away_id")
            or g.get("away_team_id")
            or away_team_name
        )

        home_points = _pick_score(
            g.get("home_points"),
            g.get("homeScore"),
            g.get("home_score"),
        )
        away_points = _pick_score(
            g.get("away_points"),
            g.get("awayScore"),
            g.get("away_score"),
        )

        # Normalize CFBD status into a simple state, then map to a human label.
        raw_status = g.get("status") or g.get("status_name")
        state = _normalize_cfb_status(raw_status, g.get("completed"))
        status_desc = STATUS_LABELS.get(state, "Scheduled")

        venue = g.get("venue") or g.get("venue_name")

        home_comp = Competitor(
            team=Team(
                id=str(home_team_id),
                name=str(home_team_name),
                nickname=None,
                abbreviation=None,
                color=None,
                logo=None,
                record=None,
                rank=None,
            ),
            homeAway="home",
            score=home_points,
        )

        away_comp = Competitor(
            team=Team(
                id=str(away_team_id),
                name=str(away_team_name),
                nickname=None,
                abbreviation=None,
                color=None,
                logo=None,
                record=None,
                rank=None,
            ),
            homeAway="away",
            score=away_points,
        )

        # CFBD may use different fields for time; fall back to empty string if missing.
        start_time = (
            g.get("start_date")
            or g.get("start_time")
            or g.get("game_date")
            or ""
        )

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
