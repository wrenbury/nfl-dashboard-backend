from fastapi import APIRouter, HTTPException
from ..models.schemas import *
from ..services import scoreboard as sb, games

router = APIRouter()

@router.get("/scoreboard/{sport}", response_model=list[GameSummary])
def get_scoreboard(sport: Sport, date: str | None = None, week: int | None = None):
    try:
        return sb.get_scoreboard(sport, date=date, week=week)
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

@router.get("/game/{sport}/{event_id}", response_model=GameDetails)
def get_game(sport: Sport, event_id: str):
    try:
        return games.game_details(sport, event_id)
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))
