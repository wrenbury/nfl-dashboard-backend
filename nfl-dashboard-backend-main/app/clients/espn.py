from typing import Dict, Any, Optional
from urllib.parse import urlencode
from ..config import settings
from ..utils.http import client
from ..utils.cache import cache

def _league(sport: str) -> str:
    return "nfl" if sport == "nfl" else "college-football"

def _base(sport: str) -> str:
    return f"{settings.ESPN_BASE}/{_league(sport)}"

def scoreboard(sport: str, date: Optional[str] = None, week: Optional[int] = None) -> Dict[str, Any]:
    params = {}
    if date:
        params["dates"] = date  # YYYYMMDD
    if week and sport != "nfl":
        params["week"] = week
    key = f"espn:scoreboard:{sport}:{date}:{week}"
    if (v := cache.get(key)) is not None:
        return v
    url = f"{_base(sport)}/scoreboard"
    if params:
        url += f"?{urlencode(params)}"
    with client() as c:
        r = c.get(url)
        r.raise_for_status()
        data = r.json()
        cache.set(key, data)
        return data

def summary(sport: str, event_id: str) -> Dict[str, Any]:
    key = f"espn:summary:{sport}:{event_id}"
    if (v := cache.get(key)) is not None:
        return v
    url = f"{_base(sport)}/summary?{urlencode({'event': event_id})}"
    with client() as c:
        r = c.get(url)
        r.raise_for_status()
        data = r.json()
        cache.set(key, data)
        return data
