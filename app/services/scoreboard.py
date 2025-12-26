# app/services/scoreboard.py

from typing import List, Optional
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

from ..models.schemas import *
from ..clients import espn, cfbd
from ..cfb_scoreboard import _get_week_for_date, _normalize_cfb_status
from ..utils.cfb_logos import get_cfb_logo


def _convert_utc_to_et_date(utc_timestamp: str) -> str:
    """
    Convert ESPN's UTC timestamp to ET date string.
    ESPN returns timestamps like "2025-12-03T05:00Z" which is UTC.
    NFL games are scheduled in ET, so we convert to ET before extracting the date.

    Example: "2025-12-06T01:20Z" (Fri 1:20 AM UTC) -> "2025-12-05" (Thu in ET)
    """
    if not utc_timestamp or "T" not in utc_timestamp:
        return utc_timestamp

    try:
        # Parse UTC timestamp
        utc_dt = datetime.fromisoformat(utc_timestamp.replace("Z", "+00:00"))
        # Convert to ET
        et_dt = utc_dt.astimezone(ZoneInfo("America/New_York"))
        # Return date string
        return et_dt.date().isoformat()
    except Exception:
        # Fallback to original behavior if parsing fails
        return utc_timestamp.split("T")[0]


def _convert_utc_timestamp_to_et(utc_timestamp: str) -> str:
    """
    Convert ESPN's UTC timestamp to ET timezone, keeping full ISO format.
    This is used for game startTime so the frontend can extract the correct date.

    Example: "2025-12-06T01:20Z" (Fri 1:20 AM UTC) -> "2025-12-05T20:20:00-05:00" (Thu 8:20 PM ET)
    """
    if not utc_timestamp:
        return utc_timestamp

    try:
        # Parse UTC timestamp (handle both "Z" and "+00:00" formats)
        utc_dt = datetime.fromisoformat(utc_timestamp.replace("Z", "+00:00"))
        # Convert to ET
        et_dt = utc_dt.astimezone(ZoneInfo("America/New_York"))
        # Return as ISO format string
        return et_dt.isoformat()
    except Exception:
        # Fallback to original timestamp if parsing fails
        return utc_timestamp


def get_nfl_weeks() -> List[Week]:
    """
    Get the NFL season weeks from ESPN calendar data.
    Returns a list of Week objects with week number, label, and date range.
    Includes both regular season and playoff weeks.
    """
    raw = espn.calendar("nfl")
    weeks: List[Week] = []

    # ESPN calendar data structure:
    # leagues[0].calendar[0] = preseason, [1] = regular season, [2] = postseason
    leagues = raw.get("leagues", [])
    if not leagues:
        return weeks

    calendar = leagues[0].get("calendar", [])

    # Mapping for playoff labels based on typical NFL playoff structure
    PLAYOFF_LABELS = {
        "Wild Card": "WILD CARD",
        "Wildcard": "WILD CARD",
        "WildCard": "WILD CARD",
        "Wild-Card": "WILD CARD",
        "Divisional": "DIVISIONAL ROUND",
        "Divisional Round": "DIVISIONAL ROUND",
        "Conference Championships": "CONFERENCE CHAMPIONSHIP",
        "Conference Championship": "CONFERENCE CHAMPIONSHIP",
        "Super Bowl": "SUPERBOWL",
        "SuperBowl": "SUPERBOWL",
        "Pro Bowl": "PRO BOWL",
    }

    # Process all calendar sections (regular season and postseason)
    for section_idx, cal_section in enumerate(calendar):
        # Determine season type based on calendar section index
        # ESPN structure: [0]=preseason, [1]=regular, [2]=postseason
        season_type = section_idx + 1  # 1=preseason, 2=regular, 3=postseason

        # Handle both list of entries and list of sections with entries
        entries = cal_section if isinstance(cal_section, list) else cal_section.get("entries", [])

        for entry in entries:
            if not isinstance(entry, dict):
                continue

            week_num = entry.get("value")
            label = entry.get("label", f"Week {week_num}")
            start_date = entry.get("startDate", "")
            end_date = entry.get("endDate", "")

            if week_num is not None:
                # Convert UTC dates to ET dates
                if start_date:
                    start_date = _convert_utc_to_et_date(start_date)
                if end_date:
                    end_date = _convert_utc_to_et_date(end_date)

                # Normalize playoff labels for postseason
                normalized_label = label
                if season_type == 3:  # Postseason
                    for playoff_key, playoff_value in PLAYOFF_LABELS.items():
                        if playoff_key.lower() in label.lower():
                            normalized_label = playoff_value
                            break

                weeks.append(Week(
                    number=int(week_num),
                    label=normalized_label,
                    startDate=start_date,
                    endDate=end_date,
                    seasonType=season_type,
                ))

    return weeks


def get_current_nfl_week() -> int | None:
    """
    Determine the current NFL week based on today's date in ET.
    Since NFL games are scheduled in ET, we use ET timezone for comparison.
    """
    weeks = get_nfl_weeks()
    if not weeks:
        return None

    # Get current date in ET (where NFL games are scheduled)
    today = datetime.now(ZoneInfo("America/New_York")).date()
    today_str = today.isoformat()

    for week in weeks:
        if week.startDate and week.endDate:
            if week.startDate <= today_str <= week.endDate:
                return week.number

    # If not in any week range, return the latest week
    return weeks[-1].number if weeks else None


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

        # Convert game start time from UTC to ET for correct date grouping in frontend
        start_time = e.get("date")
        if start_time:
            start_time = _convert_utc_timestamp_to_et(start_time)

        out.append(
            GameSummary(
                id=e["id"],
                sport=sport,
                startTime=start_time,
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
    """
    Pick the first usable numeric score from a list of possible fields.

    CFBD v2 uses camelCase (homePoints/awayPoints). Older clients and some
    exports may use snake_case (home_points/away_points) or Score variants.
    """
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
    conference: str | None = None,
    season_type: int = 2,
) -> List[GameSummary]:
    """
    Build a GameSummary-style scoreboard for college football using CFBD.

    This keeps the same GameSummary shape used for NFL so the frontend can treat
    both leagues uniformly while sourcing data from different providers.

    Args:
        date: Date string in YYYY-MM-DD format
        week: Week number
        conference: Conference filter
        season_type: Season type (2=regular, 3=postseason)
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

    # Map season type integer to CFBD season type string
    season_type_str = "regular"
    if season_type == 3:
        season_type_str = "postseason"

    # CFBD /games -> "Games and results" (includes points in v2).
    # Pass conference filter to only show games from selected conference
    raw_games = cfbd.games(year=year, week=cfbd_week, seasonType=season_type_str, conference=conference) or []
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

        # Filter to only FBS and FCS games (exclude D-II and D-III)
        home_class = (g.get("homeClassification") or "").lower()
        away_class = (g.get("awayClassification") or "").lower()

        # Skip if either team is D-II, D-III, or unknown
        if home_class in ("ii", "iii", "") or away_class in ("ii", "iii", ""):
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

        # Try CFBD v2 camelCase first (homePoints/awayPoints) then snake_case.
        home_points = _pick_score(
            g.get("homePoints"),
            g.get("home_points"),
            g.get("homeScore"),
            g.get("home_score"),
        )
        away_points = _pick_score(
            g.get("awayPoints"),
            g.get("away_points"),
            g.get("awayScore"),
            g.get("away_score"),
        )

        # Normalize CFBD status into a simple state, then map to a human label.
        raw_status = g.get("status") or g.get("status_name")
        state = _normalize_cfb_status(raw_status, g.get("completed"))
        status_desc = STATUS_LABELS.get(state, "Scheduled")

        venue = g.get("venue") or g.get("venue_name")

        home_logo = get_cfb_logo(str(home_team_name))
        away_logo = get_cfb_logo(str(away_team_name))

        # Extract rankings if available (CFBD includes rankings in some responses)
        home_rank = g.get("homeRank") or g.get("home_rank")
        away_rank = g.get("awayRank") or g.get("away_rank")

        home_comp = Competitor(
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
            score=home_points,
        )

        away_comp = Competitor(
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
            score=away_points,
        )

        # CFBD may use different fields for time; fall back to empty string if missing.
        # CFBD API v2 uses camelCase: startDate
        start_time = (
            g.get("startDate")       # CFBD v2 camelCase
            or g.get("start_date")   # Legacy snake_case
            or g.get("startTime")
            or g.get("start_time")
            or g.get("game_date")
            or ""
        )

        # Convert to ET timezone for correct date grouping in frontend
        if start_time:
            start_time = _convert_utc_timestamp_to_et(start_time)

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


def get_cfb_weeks() -> List[Week]:
    """
    Get CFB season weeks from ESPN calendar data.
    Returns a list of Week objects with week number, label, and date range.
    Includes both regular season and postseason weeks (Bowl Games, CFP).
    """
    raw = espn.calendar("college-football")
    weeks: List[Week] = []

    # ESPN calendar data structure:
    # leagues[0].calendar[0] = regular season, [1] = postseason
    leagues = raw.get("leagues", [])
    if not leagues:
        return weeks

    calendar = leagues[0].get("calendar", [])

    # Mapping for postseason labels
    POSTSEASON_LABELS = {
        "Bowl Games": "BOWL GAMES",
        "Bowls": "BOWL GAMES",
        "Bowl": "BOWL GAMES",
        "College Football Playoff": "CFP",
        "CFP": "CFP",
        "Playoff": "CFP",
    }

    # Process all calendar sections (regular season and postseason)
    for section_idx, cal_section in enumerate(calendar):
        # Determine season type based on calendar section index
        # ESPN structure: [0]=regular, [1]=postseason (CFB doesn't have preseason)
        season_type = section_idx + 2  # 2=regular, 3=postseason

        # Handle both list of entries and list of sections with entries
        entries = cal_section if isinstance(cal_section, list) else cal_section.get("entries", [])

        for entry in entries:
            if not isinstance(entry, dict):
                continue

            week_num = entry.get("value")
            label = entry.get("label", f"Week {week_num}")
            start_date = entry.get("startDate", "")
            end_date = entry.get("endDate", "")

            if week_num is not None:
                # Convert UTC dates to ET dates
                if start_date:
                    start_date = _convert_utc_to_et_date(start_date)
                if end_date:
                    end_date = _convert_utc_to_et_date(end_date)

                # Normalize postseason labels
                normalized_label = label
                if season_type == 3:  # Postseason
                    for postseason_key, postseason_value in POSTSEASON_LABELS.items():
                        if postseason_key.lower() in label.lower():
                            normalized_label = postseason_value
                            break

                weeks.append(Week(
                    number=int(week_num),
                    label=normalized_label,
                    startDate=start_date,
                    endDate=end_date,
                    seasonType=season_type,
                ))

    return weeks


def get_cfb_conferences() -> List[dict]:
    """
    Get list of FBS and FCS conferences from CFBD.
    Returns a list of conference objects with id, name, abbreviation.
    Includes special options like "Top 25" and "FBS".
    """
    raw = cfbd.conferences()

    if not isinstance(raw, list):
        return []

    # Add special filter options
    conferences = [
        {"id": 0, "name": "Top 25", "abbreviation": "Top 25"},
        {"id": 1, "name": "FBS", "abbreviation": "FBS"},
    ]

    # Allowed conference list based on user requirements
    allowed_conferences = {
        "ACC", "American", "Big 12", "Big Ten", "Big 12",
        "CUSA", "FBS Indep.", "MAC", "Mountain West", "Pac-12",
        "SEC", "Sun Belt", "FCS"
    }

    # Filter to only FBS and FCS conferences in the allowed list
    for conf in raw:
        if not isinstance(conf, dict):
            continue

        classification = (conf.get("classification") or "").lower()
        conf_name = conf.get("name") or ""
        conf_abbr = conf.get("abbreviation") or ""

        # Only include FBS and FCS conferences
        if classification not in ("fbs", "fcs"):
            continue

        # Check if conference is in allowed list
        if conf_name in allowed_conferences or conf_abbr in allowed_conferences:
            conferences.append({
                "id": conf.get("id"),
                "name": conf_name,
                "abbreviation": conf_abbr,
            })

    return conferences


def get_scoreboard(sport: Sport, date: str | None, week: int | None, conference: str | None = None, season_type: int | None = None, groups: int | None = None):
    """Route both NFL and CFB to ESPN."""
    if sport == "nfl":
        # Look up season type for the requested week
        seasontype = None
        if week is not None:
            weeks = get_nfl_weeks()
            for w in weeks:
                if w.number == week:
                    seasontype = w.seasonType
                    break

        raw = espn.scoreboard(sport, date=date, week=week, seasontype=seasontype)
        return parse_scoreboard(sport, raw)

    if sport == "college-football":
        # Look up season type for the requested week if not provided
        seasontype = season_type
        if seasontype is None and week is not None:
            weeks = get_cfb_weeks()
            for w in weeks:
                if w.number == week:
                    seasontype = w.seasonType
                    break

        # Use groups parameter for CFB conference filtering
        # Default to groups=80 (all FBS games) if no filter specified
        cfb_groups = groups
        if cfb_groups is None and conference is None:
            cfb_groups = 80  # All FBS games

        raw = espn.scoreboard(sport, date=date, week=week, seasontype=seasontype, groups=cfb_groups)
        return parse_scoreboard(sport, raw)

    # Unknown sport -> empty board (defensive default)
    return []
