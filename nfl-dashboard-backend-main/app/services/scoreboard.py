from typing import List
from ..models.schemas import *
from ..clients import espn

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
                competitors=[_map_competitor(c) for c in sorted(comp, key=lambda x: x["homeAway"])],
            )
        )
    return out

def get_scoreboard(sport: Sport, date: str | None, week: int | None):
    raw = espn.scoreboard(sport, date=date, week=week)
    return parse_scoreboard(sport, raw)
