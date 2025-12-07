from typing import List, Optional, Literal
from pydantic import BaseModel

Sport = Literal["nfl", "college-football"]

class Team(BaseModel):
    id: str
    name: str
    nickname: Optional[str] = None
    abbreviation: Optional[str] = None
    color: Optional[str] = None
    logo: Optional[str] = None
    record: Optional[str] = None
    rank: Optional[int] = None

class Competitor(BaseModel):
    team: Team
    homeAway: Literal["home", "away"]
    score: Optional[int] = None

class GameSummary(BaseModel):
    id: str
    sport: Sport
    startTime: str
    status: str
    venue: Optional[str] = None
    competitors: List[Competitor]

class BoxScoreCategory(BaseModel):
    title: str
    rows: List[List[str]]

class GameDetails(BaseModel):
    summary: GameSummary
    boxscore: List[BoxScoreCategory] = []
    teamStats: List[BoxScoreCategory] = []
    plays: Optional[list] = None
    winProbability: Optional[list] = None
