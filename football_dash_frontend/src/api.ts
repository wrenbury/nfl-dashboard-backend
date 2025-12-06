// football_dash_frontend/src/api.ts

import {
  GamesTodayResponse,
  GameLiveResponse,
  CfbScoreboardResponse,
} from "./types/api";

async function handleJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `API error ${res.status}: ${text || res.statusText || "Unknown error"}`
    );
  }
  return (await res.json()) as T;
}

export async function fetchGamesToday(): Promise<GamesTodayResponse> {
  const res = await fetch("/games/today");
  return handleJson<GamesTodayResponse>(res);
}

export async function fetchGameLive(gameId: string): Promise<GameLiveResponse> {
  const res = await fetch(`/games/${encodeURIComponent(gameId)}/live`);
  return handleJson<GameLiveResponse>(res);
}

export async function fetchCfbScoreboard(
  year: number,
  week: number
): Promise<CfbScoreboardResponse> {
  const params = new URLSearchParams({
    year: String(year),
    week: String(week),
  });
  const res = await fetch(`/cfb/scoreboard?${params.toString()}`);
  return handleJson<CfbScoreboardResponse>(res);
}
