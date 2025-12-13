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
    headers: Optional[List[str]] = None
    rows: List[List[str]]


class GameSituation(BaseModel):
    # e.g. "13:10"
    clock: Optional[str] = None
    # quarter / period number, 1–4, OT etc.
    period: Optional[int] = None
    # 1–4
    down: Optional[int] = None
    # yards to go
    distance: Optional[int] = None
    # yard line number (e.g. 44)
    yardLine: Optional[int] = None
    # "3rd & 7"
    shortDownDistanceText: Optional[str] = None
    # "3rd & 7 at LAC 44"
    downDistanceText: Optional[str] = None
    # ESPN team id that currently has possession
    possessionTeamId: Optional[str] = None
    # Human-readable "PHI ball on LAC 44"
    possessionText: Optional[str] = None
    # In the red zone
    isRedZone: Optional[bool] = None


class GameDetails(BaseModel):
    summary: GameSummary
    boxscore: List[BoxScoreCategory] = []
    teamStats: List[BoxScoreCategory] = []
    plays: Optional[list] = None
    winProbability: Optional[list] = None
    # NEW, backwards-compatible extension
    situation: Optional[GameSituation] = None
    # CFB-specific analytics from CollegeFootballData API
    cfbAnalytics: Optional[dict] = None
    # Debug info for troubleshooting
    debug: Optional[dict] = None


class Week(BaseModel):
    number: int
    label: str  # e.g. "Week 14" or "WILD CARD"
    startDate: str  # e.g. "2025-12-03"
    endDate: str  # e.g. "2025-12-09"
    seasonType: int = 2  # 1=preseason, 2=regular, 3=postseason


class BoxScoreCategoryWithHeaders(BaseModel):
    title: str
    headers: List[str]
    rows: List[List[str]]
