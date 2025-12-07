from typing import Any, Optional
import httpx
from ..config import settings
from ..utils.cache import cache

HEADERS = {"Authorization": f"Bearer {settings.CFBD_TOKEN}"} if settings.CFBD_TOKEN else {}
BASE = settings.CFBD_BASE

def games(year: int, week: Optional[int] = None, seasonType: str = "regular") -> Any:
    params = {"year": year, "seasonType": seasonType}
    if week:
        params["week"] = week
    key = f"cfbd:games:{year}:{week}:{seasonType}"
    if (v := cache.get(key)) is not None:
        return v
    with httpx.Client(timeout=12, headers=HEADERS) as c:
        r = c.get(f"{BASE}/games", params=params)
        r.raise_for_status()
        data = r.json()
        cache.set(key, data)
        return data
