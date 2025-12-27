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
from .scoreboard import _map_competitor, _normalize_cfb_status, _convert_utc_timestamp_to_et, get_cfb_weeks
from ..utils.cfb_logos import get_cfb_logo
from datetime import datetime


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


def _build_cfb_boxscore(player_stats: list, home_team_name: str, away_team_name: str) -> list:
    """Build boxscore categories from CFBD player stats."""
    if not player_stats:
        return []

    categories = []

    # Group stats by team and category
    passing = {"home": [], "away": []}
    rushing = {"home": [], "away": []}
    receiving = {"home": [], "away": []}

    for team_data in player_stats:
        team_name = team_data.get("team") or ""
        side = "home" if team_name == home_team_name else "away"
        categories_data = team_data.get("categories") or []

        for cat in categories_data:
            cat_name = cat.get("name", "")
            types = cat.get("types") or []

            for type_data in types:
                type_name = type_data.get("name", "")
                athletes = type_data.get("athletes") or []

                for athlete in athletes:
                    name = athlete.get("name", "")
                    stat = athlete.get("stat", "")

                    if cat_name == "passing":
                        passing[side].append([name, stat])
                    elif cat_name == "rushing":
                        rushing[side].append([name, stat])
                    elif cat_name == "receiving":
                        receiving[side].append([name, stat])

    # Build categories
    if passing["home"] or passing["away"]:
        rows = []
        rows.extend([[f"{home_team_name} {p[0]}", p[1]] for p in passing["home"][:5]])
        rows.extend([[f"{away_team_name} {p[0]}", p[1]] for p in passing["away"][:5]])
        if rows:
            categories.append(BoxScoreCategory(title="Passing", rows=rows))

    if rushing["home"] or rushing["away"]:
        rows = []
        rows.extend([[f"{home_team_name} {r[0]}", r[1]] for r in rushing["home"][:5]])
        rows.extend([[f"{away_team_name} {r[0]}", r[1]] for r in rushing["away"][:5]])
        if rows:
            categories.append(BoxScoreCategory(title="Rushing", rows=rows))

    if receiving["home"] or receiving["away"]:
        rows = []
        rows.extend([[f"{home_team_name} {r[0]}", r[1]] for r in receiving["home"][:5]])
        rows.extend([[f"{away_team_name} {r[0]}", r[1]] for r in receiving["away"][:5]])
        if rows:
            categories.append(BoxScoreCategory(title="Receiving", rows=rows))

    return categories


def _build_cfb_team_stats(team_stats: list) -> list:
    """Build team stats categories from CFBD team stats."""
    if not team_stats:
        print("[_build_cfb_team_stats] No team stats provided")
        return []

    # CFBD returns [{ id: game_id, teams: [...] }]
    # Extract the teams array from the first element
    if len(team_stats) > 0 and isinstance(team_stats[0], dict) and "teams" in team_stats[0]:
        teams = team_stats[0]["teams"]
        print(f"[_build_cfb_team_stats] Extracted {len(teams)} teams from game object")
    else:
        print(f"[_build_cfb_team_stats] Unexpected structure, expected game object with teams")
        return []

    if len(teams) < 2:
        print(f"[_build_cfb_team_stats] Only {len(teams)} team(s) found, need 2")
        return []

    categories = []

    # Convert stats array to dict for easier access
    def stats_array_to_dict(stats_array):
        """Convert [{ category: 'totalYards', stat: '334' }, ...] to { 'totalYards': '334', ... }"""
        if not isinstance(stats_array, list):
            return {}
        return {item.get("category", ""): item.get("stat", "") for item in stats_array}

    # Determine which team is home/away
    team1 = teams[0]
    team2 = teams[1]

    home_team = team1 if team1.get("homeAway") == "home" else team2
    away_team = team2 if team2.get("homeAway") == "away" else team1

    # Convert stats arrays to dicts
    home_stats_dict = stats_array_to_dict(home_team.get("stats", []))
    away_stats_dict = stats_array_to_dict(away_team.get("stats", []))

    print(f"[_build_cfb_team_stats] Home: {home_team.get('team')}, Away: {away_team.get('team')}")

    # Build basic stats category
    stats_rows = []

    # Map common stat fields (using CFBD category names)
    stat_mappings = [
        ("First Downs", "firstDowns"),
        ("Total Yards", "totalYards"),
        ("Passing Yards", "netPassingYards"),
        ("Rushing Yards", "rushingYards"),
        ("Turnovers", "turnovers"),
        ("Penalties-Yards", "totalPenaltiesYards"),
        ("Time of Possession", "possessionTime"),
    ]

    for label, field in stat_mappings:
        home_val = home_stats_dict.get(field, "-")
        away_val = away_stats_dict.get(field, "-")
        if home_val != "-" or away_val != "-":
            stats_rows.append([label, str(away_val), str(home_val)])

    print(f"[_build_cfb_team_stats] Built {len(stats_rows)} stat rows")

    if stats_rows:
        categories.append(BoxScoreCategory(title="Team Stats", headers=["Stat", "Away", "Home"], rows=stats_rows))

    return categories


def _cfb_game_details(event_id: str) -> GameDetails:
    """
    Build GameDetails for CFB using CollegeFootballData API.

    Note: CFBD doesn't have all the same data as ESPN (no win probability, limited play-by-play),
    but we can provide the basic game summary and available stats.
    """
    # CFBD uses integer game IDs
    game_id = int(event_id)
    print(f"[CFB Game Details] Loading game_id: {game_id}")

    # Get game info from CFBD /games endpoint
    # We need to figure out which year/week to fetch - for now we'll try recent weeks
    # This is a limitation of CFBD API - it doesn't have a single game endpoint like ESPN
    # In practice, we'll need to search for the game
    raw_game = None

    # Try current year and previous year, including postseason
    from datetime import datetime
    current_year = datetime.now().year

    for year in [current_year, current_year - 1, current_year - 2]:
        print(f"[CFB Game Details] Searching year {year}...")
        for season_type in ["regular", "postseason"]:
            week_range = range(1, 17) if season_type == "regular" else range(1, 6)
            for week in week_range:
                try:
                    games = cfbd.games(year=year, week=week, seasonType=season_type)
                    if games:
                        print(f"[CFB Game Details] Checking {len(games)} games in year {year}, week {week}, {season_type}")
                        for g in games:
                            if g.get("id") == game_id:
                                raw_game = g
                                print(f"[CFB Game Details] ✓ Found game in year {year}, week {week}, {season_type}")
                                break
                    if raw_game:
                        break
                except Exception as e:
                    print(f"[CFB Game Details] Error checking year {year}, week {week}, {season_type}: {e}")
                    continue
            if raw_game:
                break
        if raw_game:
            break

    if not raw_game:
        print(f"[CFB Game Details] Game {game_id} not found in CFBD /games endpoint")

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

    # Debug tracking
    debug_info = {
        "game_id": game_id,
        "game_found": raw_game is not None,
        "errors": [],
        "api_calls": {}
    }

    # Get advanced analytics from CFBD
    advanced_stats = None
    try:
        print(f"[CFB Analytics] Fetching advanced stats for game_id: {game_id}")
        advanced_stats = cfbd.advanced_game_stats(game_id)
        debug_info["api_calls"]["advanced_stats"] = {
            "success": advanced_stats is not None,
            "has_data": bool(advanced_stats),
            "type": str(type(advanced_stats).__name__) if advanced_stats else None
        }
        print(f"[CFB Analytics] Advanced stats: {advanced_stats is not None}, type: {type(advanced_stats)}")
        if advanced_stats:
            print(f"[CFB Analytics] Advanced stats data: {str(advanced_stats)[:200]}")
    except Exception as e:
        error_msg = f"Error fetching advanced stats: {str(e)}"
        print(f"[CFB Analytics] {error_msg}")
        debug_info["errors"].append(error_msg)
        debug_info["api_calls"]["advanced_stats"] = {"error": str(e)}

    # Get player stats from CFBD
    player_stats = None
    try:
        print(f"[CFB Analytics] Fetching player stats for game_id: {game_id}")
        player_stats = cfbd.player_game_stats(game_id)
        debug_info["api_calls"]["player_stats"] = {
            "success": player_stats is not None,
            "has_data": bool(player_stats),
            "count": len(player_stats) if isinstance(player_stats, list) else 0
        }
        print(f"[CFB Analytics] Player stats: {player_stats is not None}")
    except Exception as e:
        error_msg = f"Error fetching player stats: {str(e)}"
        print(f"[CFB Analytics] {error_msg}")
        debug_info["errors"].append(error_msg)
        debug_info["api_calls"]["player_stats"] = {"error": str(e)}

    # Get team stats from CFBD
    team_stats_raw = None
    try:
        print(f"[CFB Analytics] Fetching team stats for game_id: {game_id}")
        team_stats_raw = cfbd.team_game_stats(game_id)
        debug_info["api_calls"]["team_stats"] = {
            "success": team_stats_raw is not None,
            "has_data": bool(team_stats_raw),
            "count": len(team_stats_raw) if isinstance(team_stats_raw, list) else 0,
            "raw_data": team_stats_raw  # Include raw data for debugging
        }
        print(f"[CFB Analytics] Team stats: {team_stats_raw is not None}")
        if team_stats_raw:
            print(f"[CFB Analytics] Team stats structure: {str(team_stats_raw)[:500]}")
    except Exception as e:
        error_msg = f"Error fetching team stats: {str(e)}"
        print(f"[CFB Analytics] {error_msg}")
        debug_info["errors"].append(error_msg)
        debug_info["api_calls"]["team_stats"] = {"error": str(e)}

    # Get drives data from CFBD
    drives = None
    try:
        print(f"[CFB Analytics] Fetching drives for game_id: {game_id}")
        drives = cfbd.game_drives(game_id)
        debug_info["api_calls"]["drives"] = {
            "success": drives is not None,
            "has_data": bool(drives),
            "count": len(drives) if isinstance(drives, list) else 0
        }
        print(f"[CFB Analytics] Drives: {drives is not None}, count: {len(drives) if drives and isinstance(drives, list) else 0}")
    except Exception as e:
        error_msg = f"Error fetching drives: {str(e)}"
        print(f"[CFB Analytics] {error_msg}")
        debug_info["errors"].append(error_msg)
        debug_info["api_calls"]["drives"] = {"error": str(e)}

    # Build box score categories from available data
    boxscore = []
    team_stats_categories = []

    # Add player stats if available
    if player_stats:
        boxscore.extend(_build_cfb_boxscore(player_stats, home_team_name, away_team_name))

    # Add team stats if available
    if team_stats_raw:
        team_stats_categories.extend(_build_cfb_team_stats(team_stats_raw))

    # Return comprehensive game details with CFB analytics
    has_analytics = advanced_stats is not None or drives is not None
    print(f"[CFB Analytics] Returning cfbAnalytics: {has_analytics}, advanced: {advanced_stats is not None}, drives: {drives is not None}")

    # Add debug summary
    debug_info["summary"] = {
        "boxscore_count": len(boxscore),
        "teamStats_count": len(team_stats_categories),
        "has_cfbAnalytics": has_analytics,
    }

    return GameDetails(
        summary=summary,
        boxscore=boxscore,
        teamStats=team_stats_categories,
        plays=plays,
        winProbability=None,
        situation=None,
        cfbAnalytics={
            "advanced": advanced_stats,
            "drives": drives,
        } if advanced_stats or drives else None,
        debug=debug_info,
    )


def game_details(sport: Sport, event_id: str) -> GameDetails:
    """
    Build a rich GameDetails payload for a single event.

    Routes both NFL and CFB to ESPN API for live data.

    This must remain backwards compatible with existing GameDetails consumers:
    - summary
    - boxscore
    - teamStats
    - plays
    - winProbability

    New:
    - situation (clock, period, down & distance, possession, red zone)
    """
    # Both NFL and CFB now use ESPN for live data
    raw: Dict[str, Any] = espn.summary(sport, event_id)

    # For live games, also fetch from scoreboard to get real-time situation data
    # The summary endpoint doesn't include live situation updates
    scoreboard_situation = None
    scoreboard_week = None
    try:
        scoreboard_data = espn.scoreboard(sport)
        events = scoreboard_data.get("events") or []
        for event in events:
            if str(event.get("id")) == str(event_id):
                # Extract week from scoreboard event (this has the absolute week number)
                week_data = event.get("week")
                if isinstance(week_data, dict):
                    scoreboard_week = week_data.get("number")
                elif isinstance(week_data, int):
                    scoreboard_week = week_data
                else:
                    scoreboard_week = None
                print(f"[{sport.upper()} Game Details] Week from scoreboard event: {scoreboard_week}")

                competitions = event.get("competitions") or [{}]
                if competitions:
                    scoreboard_situation = competitions[0].get("situation")
                    print(f"[{sport.upper()} Game Details] Found situation in scoreboard: {scoreboard_situation}")
                break
    except Exception as e:
        print(f"[{sport.upper()} Game Details] Error fetching scoreboard for situation: {e}")

    header = raw.get("header") or {}
    competitions = header.get("competitions") or [{}]
    comp0: Dict[str, Any] = competitions[0] or {}
    raw_competitors = comp0.get("competitors") or []

    # --- High-level game summary -------------------------------------------------
    # Extract week and seasonType for back navigation
    # For CFB, ESPN returns relative postseason week numbers (week 1, 2 of postseason)
    # but we need absolute week numbers (week 16, 17 for bowl games) to match the scoreboard
    # So we need to match the game's date to the calendar weeks
    week = None
    season_type = None
    game_date = comp0.get("date") or header.get("date") or ""

    # Check if this is a CFP game by looking at game note or competition labels
    is_cfp_game = False
    game_note = header.get("gameNote", "")
    comp_notes = comp0.get("notes", [])

    # Check for CFP indicators in game note or competition notes
    cfp_indicators = ["playoff", "cfp", "championship", "semifinal", "national championship"]
    if game_note:
        is_cfp_game = any(indicator in game_note.lower() for indicator in cfp_indicators)

    if not is_cfp_game and comp_notes:
        for note in comp_notes:
            if isinstance(note, dict):
                headline = note.get("headline", "")
                if headline and any(indicator in headline.lower() for indicator in cfp_indicators):
                    is_cfp_game = True
                    break

    print(f"[{sport.upper()} Game Details] Game note: {game_note}, Is CFP: {is_cfp_game}")

    if sport == "college-football" and game_date:
        try:
            # Get all CFB weeks from calendar (has absolute week numbers and date ranges)
            cfb_weeks = get_cfb_weeks()
            # Parse game date (format: 2024-12-27T19:00Z)
            game_datetime = datetime.fromisoformat(game_date.replace('Z', '+00:00'))
            game_date_str = game_datetime.strftime('%Y-%m-%d')

            print(f"[{sport.upper()} Game Details] Game date: {game_date_str}")

            # Find which week this game falls into based on date range
            # For CFP games, specifically look for week 999 or CFP label
            matched_weeks = []
            for w in cfb_weeks:
                if w.startDate and w.endDate:
                    # Check if game date falls within this week's range
                    if w.startDate <= game_date_str <= w.endDate:
                        matched_weeks.append(w)

            # If multiple weeks match (e.g., BOWL GAMES and CFP have overlapping dates)
            # prefer CFP week if this is identified as a CFP game
            if matched_weeks:
                if is_cfp_game:
                    # Look for CFP week (usually week 999 or labeled "CFP")
                    cfp_week = next((w for w in matched_weeks if w.number == 999 or "CFP" in w.label.upper()), None)
                    if cfp_week:
                        week = cfp_week.number
                        season_type = cfp_week.seasonType
                        print(f"[{sport.upper()} Game Details] CFP game matched to week {week} ({cfp_week.label}, seasonType {season_type})")
                    else:
                        # Fallback to first match
                        week = matched_weeks[0].number
                        season_type = matched_weeks[0].seasonType
                        print(f"[{sport.upper()} Game Details] CFP game but no CFP week found, using week {week} ({matched_weeks[0].label}, seasonType {season_type})")
                else:
                    # Not a CFP game, use first matching week
                    week = matched_weeks[0].number
                    season_type = matched_weeks[0].seasonType
                    print(f"[{sport.upper()} Game Details] Matched to week {week} ({matched_weeks[0].label}, seasonType {season_type}) based on date range {matched_weeks[0].startDate} to {matched_weeks[0].endDate}")
        except Exception as e:
            print(f"[{sport.upper()} Game Details] Error matching week by date: {e}")

    # Fallback to scoreboard week or header week if date matching didn't work
    if week is None:
        week = scoreboard_week or header.get("week")
        print(f"[{sport.upper()} Game Details] Using fallback week: {week}")

    # Try to extract season type from header if not found from calendar
    if season_type is None:
        header_season = header.get("season")
        if isinstance(header_season, dict):
            season_type = header_season.get("type")

    print(f"[{sport.upper()} Game Details] Final week for back navigation: week={week}, seasonType={season_type}")

    summary = GameSummary(
        id=str(header.get("id") or event_id),
        sport=sport,
        startTime=comp0.get("date") or header.get("date") or "",
        status=_get_status_text(comp0, header),
        venue=(comp0.get("venue") or {}).get("fullName"),
        competitors=[_map_competitor(c) for c in raw_competitors],
        week=week,  # Add week for back navigation
        seasonType=season_type,  # Add seasonType for back navigation (needed for postseason)
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
    # Prefer scoreboard situation (live data) over summary situation
    raw_situation = scoreboard_situation if scoreboard_situation else (comp0.get("situation") or {})
    print(f"[{sport.upper()} Game Details] Raw situation data from {'scoreboard' if scoreboard_situation else 'summary'}: {raw_situation}")
    situation: GameSituation | None = None

    # Debug info
    debug_info = {
        "sport": sport,
        "raw_situation": raw_situation,
        "has_situation_data": bool(raw_situation),
        "situation_source": "scoreboard" if scoreboard_situation else "summary",
    }

    if raw_situation:
        yard_line = raw_situation.get("yardLine")
        print(f"[{sport.upper()} Game Details] Extracted yardLine: {yard_line} (type: {type(yard_line)})")
        debug_info["yardLine_extracted"] = yard_line
        debug_info["yardLine_type"] = str(type(yard_line).__name__)

        situation = GameSituation(
            clock=raw_situation.get("clock"),
            period=_extract_period(comp0, header),
            down=raw_situation.get("down"),
            distance=raw_situation.get("distance"),
            yardLine=yard_line,
            shortDownDistanceText=raw_situation.get("shortDownDistanceText"),
            downDistanceText=raw_situation.get("downDistanceText"),
            possessionTeamId=_extract_possession_team_id(raw_situation),
            possessionText=raw_situation.get("possessionText"),
            isRedZone=raw_situation.get("isRedZone"),
        )
        print(f"[{sport.upper()} Game Details] Created situation with yardLine: {situation.yardLine}")
        debug_info["situation_created"] = True
    else:
        print(f"[{sport.upper()} Game Details] No situation data available (game may not be live)")
        debug_info["situation_created"] = False

    # --- Plays + win probability ------------------------------------
    plays = ((raw.get("drives") or {}).get("current") or {}).get("plays")
    win_probability = raw.get("winprobability")

    # Filter win probability data to only show up to current period for live games
    # This prevents showing "future" quarters that haven't been played yet
    if win_probability and isinstance(win_probability, list) and situation and situation.period:
        current_period = situation.period
        total_plays = len(win_probability)

        print(f"[{sport.upper()} Game Details] Filtering win probability - current period: {current_period}, total plays: {total_plays}")

        # Check if plays have period information
        has_period_info = False
        if total_plays > 0:
            sample_play = win_probability[0]
            if isinstance(sample_play, dict):
                has_period_info = 'period' in sample_play or 'qtr' in sample_play
                print(f"[{sport.upper()} Game Details] Sample play keys: {list(sample_play.keys())[:5]}, has period info: {has_period_info}")

        if has_period_info:
            # NFL-style filtering: use period field
            filtered_plays = []
            for play in win_probability:
                if isinstance(play, dict):
                    play_period = None
                    if 'period' in play:
                        period_val = play['period']
                        if isinstance(period_val, int):
                            play_period = period_val
                        elif isinstance(period_val, dict) and 'number' in period_val:
                            play_period = period_val['number']
                    if play_period is None and 'qtr' in play:
                        play_period = play['qtr']

                    if play_period is not None and play_period <= current_period:
                        filtered_plays.append(play)

            if filtered_plays:
                win_probability = filtered_plays
                print(f"[{sport.upper()} Game Details] Filtered by period: {len(filtered_plays)} plays")
        else:
            # CFB-style filtering: estimate based on game progress
            # Quarters are roughly equal, so estimate play index based on period
            # Period 1: 0-25%, Period 2: 25-50%, Period 3: 50-75%, Period 4: 75-100%
            estimated_progress = current_period / 4.0
            cutoff_index = int(total_plays * estimated_progress)

            # Add a small buffer to account for variance in play distribution
            # (some quarters have more plays than others)
            buffer = int(total_plays * 0.05)  # 5% buffer
            cutoff_index = min(cutoff_index + buffer, total_plays)

            win_probability = win_probability[:cutoff_index]
            print(f"[{sport.upper()} Game Details] Filtered by estimated progress ({estimated_progress:.1%}): {cutoff_index}/{total_plays} plays (removed {total_plays - cutoff_index})")

    return GameDetails(
        summary=summary,
        boxscore=boxscore_categories,
        teamStats=team_stats_categories,
        plays=plays,
        winProbability=win_probability,
        situation=situation,
        debug=debug_info,
    )
