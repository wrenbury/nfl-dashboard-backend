import httpx
DEFAULT_HEADERS = {"User-Agent": "football-dashboard/1.0 (+raspberry-pi)"}

def client(timeout: int = 12) -> httpx.Client:
    return httpx.Client(timeout=timeout, headers=DEFAULT_HEADERS)
