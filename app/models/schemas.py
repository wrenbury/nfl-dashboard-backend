# app/models/schemas.py

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
    winner: Optional[bool] = None


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


class GameSituation(BaseModel):
    # e.g. "1:10"
    clock: Optional[str] = None
    # quarter / period number, 1–4, OT etc.
    period: Optional[int] = None
    # 1–4
    down: Optional[int] = None
    # yards to go
    distance: Optional[int] = None
    # "3rd & 7 at LAC 42"
    downDistanceText: Optional[str] = None
    # "3rd & 7"
    shortDownDistanceText: Optional[str] = None
    yardLine: Optional[int] = None
    possessionText: Optional[str] = None
    isRedZone: Optional[bool] = None


class GameDetails(BaseModel):
    summary: GameSummary
    boxscore: List[BoxScoreCategory] = []
    teamStats: List[BoxScoreCategory] = []
    plays: Optional[list] = None
    winProbability: Optional[list] = None
    # NEW, backwards-compatible
    situation: Optional[GameSituation] = None
