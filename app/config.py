import os
from pathlib import Path
from pydantic import BaseModel, Field
from dotenv import load_dotenv

# Load .env file from the project root
env_path = Path(__file__).parent.parent / ".env"
load_dotenv(dotenv_path=env_path)


class Settings(BaseModel):
    """
    Lightweight settings object that works across Pydantic v1 and v2
    without requiring pydantic-settings. Values are primarily sourced
    from environment variables with sane defaults for local/dev usage.
    """

    APP_NAME: str = Field(default="Football Dashboard API")
    ENV: str = Field(default_factory=lambda: os.getenv("ENV", "dev"))

    # Base for generic ESPN APIs if you need it elsewhere.
    ESPN_BASE: str = Field(
        default_factory=lambda: os.getenv(
            "ESPN_BASE",
            "https://site.web.api.espn.com/apis/v2/sports/football",
        )
    )

    # CollegeFootballData.com base URL
    CFBD_BASE: str = Field(
        default_factory=lambda: os.getenv(
            "CFBD_BASE",
            "https://api.collegefootballdata.com",
        )
    )

    # CollegeFootballData.com API token.
    # On the Pi, set CFBD_TOKEN in the environment instead of hard-coding.
    CFBD_TOKEN: str = Field(
        default_factory=lambda: os.getenv("CFBD_TOKEN", "")
    )

    # Simple in-memory TTL cache + HTTP timeout (seconds)
    CACHE_TTL: int = Field(default_factory=lambda: int(os.getenv("CACHE_TTL", "60")))
    TIMEOUT: int = Field(default_factory=lambda: int(os.getenv("TIMEOUT", "12")))


settings = Settings()
