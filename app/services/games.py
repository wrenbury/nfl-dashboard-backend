from ..models.schemas import *
from ..clients import espn

def game_details(sport: Sport, event_id: str) -> GameDetails:
    raw = espn.summary(sport, event_id)
    header = raw.get("header", {})
    comp = header.get("competitions", [{}])[0].get("competitors", [])
    def team_logo(t: dict):
        if t.get("logo"): return t["logo"]
        logos = t.get("logos") or []
        return logos[0]["href"] if logos else None

    summary = GameSummary(
        id=header.get("id") or event_id,
        sport=sport,
        startTime=header.get("competitions", [{}])[0].get("date"),
        status=header.get("competitions", [{}])[0].get("status", {}).get("type", {}).get("description", ""),
        venue=header.get("competitions", [{}])[0].get("venue", {}).get("fullName"),
        competitors=[ 
            Competitor(
                team=Team(
                    id=c.get("id") or c.get("team",{}).get("id",""),
                    name=c["team"]["displayName"],
                    nickname=c["team"]["shortDisplayName"],
                    abbreviation=c["team"].get("abbreviation"),
                    color=c["team"].get("color"),
                    logo=team_logo(c["team"]),
                    record=(c.get("records") or [{}])[0].get("summary"),
                    rank=c.get("rank"),
                ),
                homeAway=c["homeAway"],
                score=int(c["score"]) if c.get("score") and str(c["score"]).isdigit() else None,
            )
            for c in comp
        ],
    )

    # boxscore tables
    cats = []
    for side in raw.get("boxscore", {}).get("players", []):
        team_name = side.get("team", {}).get("displayName", "")
        for cat in side.get("statistics", []):
            rows = [[ath.get("athlete", {}).get("displayName",""), *[s.get("displayValue","") for s in ath.get("stats", [])]] for ath in cat.get("athletes", [])]
            cats.append(BoxScoreCategory(title=f"{team_name} {cat.get('name','').title()}", rows=rows))

    team_stats = []
    for stat in raw.get("boxscore", {}).get("teams", []):
        rows = [[s.get("label",""), s.get("displayValue","")] for s in stat.get("statistics",[])]
        n = stat.get("team", {}).get("displayName","Team")
        team_stats.append(BoxScoreCategory(title=f"{n} Team Stats", rows=rows))

    return GameDetails(
        summary=summary,
        boxscore=cats,
        teamStats=team_stats,
        plays=raw.get("drives",{}).get("current",{}).get("plays"),
        winProbability=raw.get("winprobability")
    )
