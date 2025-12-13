from typing import Any, Optional
import httpx
from ..config import settings
from ..utils.cache import cache

HEADERS = {"Authorization": f"Bearer {settings.CFBD_TOKEN}"} if settings.CFBD_TOKEN else {}
BASE = settings.CFBD_BASE

def games(year: int, week: Optional[int] = None, seasonType: str = "regular", conference: Optional[str] = None) -> Any:
    params = {"year": year, "seasonType": seasonType}
    if week:
        params["week"] = week
    if conference:
        params["conference"] = conference
    key = f"cfbd:games:{year}:{week}:{seasonType}:{conference}"
    if (v := cache.get(key)) is not None:
        return v
    with httpx.Client(timeout=12, headers=HEADERS) as c:
        r = c.get(f"{BASE}/games", params=params)
        r.raise_for_status()
        data = r.json()
        cache.set(key, data)
        return data

def calendar(year: int) -> Any:
    """Get the calendar/weeks information for a given CFB season."""
    key = f"cfbd:calendar:{year}"
    if (v := cache.get(key)) is not None:
        return v
    with httpx.Client(timeout=12, headers=HEADERS) as c:
        r = c.get(f"{BASE}/calendar", params={"year": year})
        r.raise_for_status()
        data = r.json()
        cache.set(key, data)
        return data

def conferences() -> Any:
    """Get list of FBS conferences."""
    key = "cfbd:conferences"
    if (v := cache.get(key)) is not None:
        return v
    with httpx.Client(timeout=12, headers=HEADERS) as c:
        r = c.get(f"{BASE}/conferences")
        r.raise_for_status()
        data = r.json()
        cache.set(key, data)
        return data

def game_details(game_id: int) -> Any:
    """Get detailed game information including plays and situation."""
    key = f"cfbd:game:{game_id}"
    if (v := cache.get(key)) is not None:
        return v
    with httpx.Client(timeout=12, headers=HEADERS) as c:
        # CFBD has /plays endpoint for play-by-play data
        plays_response = c.get(f"{BASE}/plays", params={"gameId": game_id})
        plays_data = plays_response.json() if plays_response.status_code == 200 else []

        # Note: CFBD doesn't have a unified "game summary" endpoint like ESPN
        # We'll need to combine data from /games and /plays
        result = {"plays": plays_data}
        cache.set(key, result)
        return result

def team_game_stats(game_id: int) -> Any:
    """Get team statistics for a specific game."""
    key = f"cfbd:team_stats:{game_id}"
    if (v := cache.get(key)) is not None:
        return v
    with httpx.Client(timeout=12, headers=HEADERS) as c:
        r = c.get(f"{BASE}/games/teams", params={"id": game_id})
        if r.status_code == 200:
            data = r.json()
            cache.set(key, data)
            return data
        return None

def advanced_game_stats(game_id: int) -> Any:
    """Get advanced box score stats (EPA, success rate, explosiveness) for a game."""
    key = f"cfbd:advanced_stats:{game_id}"
    if (v := cache.get(key)) is not None:
        return v
    with httpx.Client(timeout=12, headers=HEADERS) as c:
        r = c.get(f"{BASE}/game/box/advanced", params={"gameId": game_id})
        if r.status_code == 200:
            data = r.json()
            cache.set(key, data)
            return data
        return None

def player_game_stats(game_id: int) -> Any:
    """Get player statistics for a specific game."""
    key = f"cfbd:player_stats:{game_id}"
    if (v := cache.get(key)) is not None:
        return v
    with httpx.Client(timeout=12, headers=HEADERS) as c:
        r = c.get(f"{BASE}/games/players", params={"gameId": game_id})
        if r.status_code == 200:
            data = r.json()
            cache.set(key, data)
            return data
        return None

def game_drives(game_id: int) -> Any:
    """Get drive information for a specific game."""
    key = f"cfbd:drives:{game_id}"
    if (v := cache.get(key)) is not None:
        return v
    with httpx.Client(timeout=12, headers=HEADERS) as c:
        r = c.get(f"{BASE}/drives", params={"gameId": game_id})
        if r.status_code == 200:
            data = r.json()
            cache.set(key, data)
            return data
        return None
