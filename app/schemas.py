from typing import List, Optional, Literal
from pydantic import BaseModel


class TeamHeader(BaseModel):
    id: str
    name: str
    full_name: str
    abbreviation: str
    record: Optional[str] = None
    score: int


class Header(BaseModel):
    game_id: str
    league: Literal["NFL", "CFB"]
    season: int
    week: Optional[int] = None

    status: Literal["pre", "in", "post", "halftime", "final", "delayed"]
    kickoff_time_utc: str

    home_team: TeamHeader
    away_team: TeamHeader

    quarter: Optional[int] = None
    clock: Optional[str] = None
    possession: Optional[Literal["home", "away"]] = None
    down: Optional[int] = None
    distance: Optional[int] = None
    yard_line: Optional[int] = None
    red_zone: bool = False
    home_timeouts: Optional[int] = None
    away_timeouts: Optional[int] = None

    last_play_short: Optional[str] = None
    last_updated_utc: str


class DriveSummary(BaseModel):
    id: str
    team: Literal["home", "away"]
    quarter: int
    start_clock: str
    end_clock: str
    start_yard_line: Optional[int] = None
    end_yard_line: Optional[int] = None
    plays: int
    yards: int
    time_of_possession: str
    result: Literal["TD", "FG", "Punt", "Downs", "TO", "EndHalf", "MissedFG", "Other"]


class Play(BaseModel):
    play_id: str
    quarter: int
    clock: str
    down: Optional[int] = None
    distance: Optional[int] = None
    yard_line: Optional[int] = None
    description: str
    gained: Optional[int] = None
    result: Literal["normal", "TD", "FG", "TO", "Penalty", "Safety", "Other"]


class CurrentDrive(BaseModel):
    id: Optional[str] = None
    team: Optional[Literal["home", "away"]] = None
    plays: List[Play]


class Drives(BaseModel):
    current_drive_id: Optional[str] = None
    summary: List[DriveSummary]
    current: Optional[CurrentDrive] = None


class QuarterScoring(BaseModel):
    quarter: int
    home_points: int
    away_points: int


class ScoringPlay(BaseModel):
    id: str
    quarter: int
    clock: str
    team: Literal["home", "away"]
    type: Literal["TD", "FG", "Safety", "XP", "2PT", "Other"]
    description: str
    yards: Optional[int] = None
    player_primary: Optional[str] = None


class TouchdownScorer(BaseModel):
    player: str
    team: Literal["home", "away"]
    count: int


class Scoring(BaseModel):
    summary_by_quarter: List[QuarterScoring]
    plays: List[ScoringPlay]
    touchdown_scorers: List[TouchdownScorer]


class TeamStats(BaseModel):
    total_yards: Optional[int] = None
    plays: Optional[int] = None
    yards_per_play: Optional[float] = None
    passing_yards: Optional[int] = None
    rushing_yards: Optional[int] = None
    turnovers: Optional[int] = None
    penalties: Optional[int] = None
    penalty_yards: Optional[int] = None
    third_down_made: Optional[int] = None
    third_down_attempts: Optional[int] = None
    red_zone_trips: Optional[int] = None
    red_zone_tds: Optional[int] = None
    time_of_possession: Optional[str] = None


class TeamStatsWrapper(BaseModel):
    home: TeamStats
    away: TeamStats


class PassingStat(BaseModel):
    player: str
    team: Literal["home", "away"]
    completions: int
    attempts: int
    yards: int
    touchdowns: int
    interceptions: int


class RushingStat(BaseModel):
    player: str
    team: Literal["home", "away"]
    carries: int
    yards: int
    touchdowns: int


class ReceivingStat(BaseModel):
    player: str
    team: Literal["home", "away"]
    receptions: int
    yards: int
    touchdowns: int


class PlayerStats(BaseModel):
    passing: List[PassingStat]
    rushing: List[RushingStat]
    receiving: List[ReceivingStat]


class Boxscore(BaseModel):
    team_stats: TeamStatsWrapper
    player_stats: PlayerStats


class Venue(BaseModel):
    name: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    indoor: Optional[bool] = None


class Broadcast(BaseModel):
    network: Optional[str] = None
    stream: Optional[str] = None


class Weather(BaseModel):
    description: Optional[str] = None
    temperature_f: Optional[float] = None
    wind_mph: Optional[float] = None
    humidity_pct: Optional[float] = None


class Meta(BaseModel):
    venue: Venue
    broadcast: Broadcast
    weather: Weather


class WinProbability(BaseModel):
    home: Optional[float] = None
    away: Optional[float] = None
    last_updated_utc: Optional[str] = None


class RunPassProbabilities(BaseModel):
    run: Optional[float] = None
    pass_: Optional[float] = None


class CurrentSituation(BaseModel):
    recommended_decision: Optional[Literal["go_for_it", "punt", "field_goal"]] = None
    decision_confidence: Optional[float] = None
    notes: Optional[str] = None
    run_pass_probabilities: Optional[RunPassProbabilities] = None
    drive_score_probability: Optional[float] = None


class TeamSuccessRates(BaseModel):
    success_rate: Optional[float] = None
    explosive_play_rate: Optional[float] = None
    epa_per_play: Optional[float] = None


class TeamSuccessRatesWrapper(BaseModel):
    home: TeamSuccessRates
    away: TeamSuccessRates


class Analytics(BaseModel):
    win_probability: WinProbability
    current_situation: Optional[CurrentSituation] = None
    team_success_rates: TeamSuccessRatesWrapper


class GameLiveResponse(BaseModel):
    header: Header
    drives: Drives
    scoring: Scoring
    boxscore: Boxscore
    meta: Meta
    analytics: Analytics
