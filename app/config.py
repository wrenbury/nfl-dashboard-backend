from pydantic import BaseSettings, Field

class Settings(BaseSettings):
    APP_NAME: str = "Football Dashboard API"
    ENV: str = "dev"
    ESPN_BASE: str = "https://site.web.api.espn.com/apis/v2/sports/football"
    CFBD_BASE: str = "https://api.collegefootballdata.com"
    CFBD_TOKEN: str = Field("", env="CFBD_TOKEN")
    CACHE_TTL: int = 60  # seconds
    TIMEOUT: int = 12

    class Config:
        env_file = ".env"

settings = Settings()
