import time
from typing import Any, Dict, Tuple
from ..config import settings

class TTLCache:
    def __init__(self, ttl: int = settings.CACHE_TTL):
        self.ttl = ttl
        self._data: Dict[str, Tuple[float, Any]] = {}

    def get(self, key: str):
        if key in self._data:
            ts, val = self._data[key]
            if time.time() - ts < self.ttl:
                return val
            del self._data[key]
        return None

    def set(self, key: str, value: Any):
        self._data[key] = (time.time(), value)

cache = TTLCache()
