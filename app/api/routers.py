from fastapi import APIRouter, HTTPException
from ..models.schemas import *
from ..services import scoreboard as sb, games

router = APIRouter()


@router.get("/nfl/weeks", response_model=list[Week])
def get_nfl_weeks():
    """Get all NFL season weeks with date ranges."""
    try:
        return sb.get_nfl_weeks()
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.get("/nfl/current-week")
def get_current_week():
    """Get the current NFL week number."""
    try:
        week = sb.get_current_nfl_week()
        return {"week": week}
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.get("/cfb/weeks")
def get_cfb_weeks(year: int = 2025):
    """Get all CFB season weeks for a given year."""
    try:
        return sb.get_cfb_weeks(year)
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.get("/cfb/conferences")
def get_cfb_conferences():
    """Get list of FBS conferences."""
    try:
        return sb.get_cfb_conferences()
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.get("/scoreboard/{sport}", response_model=list[GameSummary])
def get_scoreboard(sport: Sport, date: str | None = None, week: int | None = None, conference: str | None = None, season_type: int | None = None):
    try:
        return sb.get_scoreboard(sport, date=date, week=week, conference=conference, season_type=season_type)
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.get("/game/{sport}/{event_id}", response_model=GameDetails)
def get_game(sport: Sport, event_id: str):
    try:
        return games.game_details(sport, event_id)
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))
