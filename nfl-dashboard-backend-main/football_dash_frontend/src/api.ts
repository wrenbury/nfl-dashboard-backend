// football_dash_frontend/src/api.ts

import {
  StatusState,
  Quarter,
  TeamSummary,
  TodayGame,
  GamesTodayResponse,
  GameLiveResponse,
  CfbScoreboardResponse,
} from "./types/api";

// ---------------------------
// Helpers
// ---------------------------

const STATUS_VALUES: StatusState[] = [
  "pre",
  "in",
  "post",
  "halftime",
  "final",
  "delayed",
];

function normalizeStatus(raw: any): StatusState {
  const s = typeof raw === "string" ? raw.toLowerCase() : "pre";
  if (STATUS_VALUES.includes(s as StatusState)) {
    return s as StatusState;
  }
  return "pre";
}

function normalizeQuarter(raw: any): Quarter {
  if (typeof raw !== "number") return null;
  if (raw >= 1 && raw <= 4) return raw as Quarter;
  if (raw >= 5) return 5; // treat all OT as 5
  return null;
}

// ---------------------------
// Backend → frontend mapping
// ---------------------------

// Shape coming from the backend for /games/today
interface BackendTeamSummary {
  id: string | number;
  name: string;
  full_name?: string;
  abbreviation?: string | null;
  record?: string | null;
  score?: number | null;
}

interface BackendTodayGame {
  game_id: string;
  league: string;
  season: number;
  week: number;
  status: StatusState | string;
  quarter: number | null;
  clock: string | null;
  kickoff_time_utc: string | null;
  neutral_site?: boolean;

  home_team: BackendTeamSummary;
  away_team: BackendTeamSummary;

  venue_name?: string | null;
  tv_network?: string | null;
}

interface BackendGamesTodayResponse {
  games: BackendTodayGame[];
}

function mapBackendTeamToTeamSummary(team: BackendTeamSummary): TeamSummary {
  const id = String(team.id ?? "");
  const fullName = team.full_name || team.name || "";
  const abbr = team.abbreviation ?? null;

  return {
    id,
    name: fullName,
    shortName: abbr || team.name || fullName || id,
    abbreviation: abbr,
    logoUrl: null, // ESPN logo URLs aren't coming from backend yet
    record: team.record ?? null,
    score: typeof team.score === "number" ? team.score : null,
    conference: null,
  };
}

function mapBackendTodayGame(game: BackendTodayGame): TodayGame {
  const status = normalizeStatus(game.status);
  const quarter = normalizeQuarter(game.quarter);

  return {
    game_id: game.game_id,
    league: "NFL",
    season: game.season,
    week: game.week,
    status,
    quarter,
    clock: game.clock ?? null,
    kickoff_time_utc: game.kickoff_time_utc ?? null,
    neutral_site: Boolean(game.neutral_site),

    home_team: mapBackendTeamToTeamSummary(game.home_team),
    away_team: mapBackendTeamToTeamSummary(game.away_team),

    venue_name: game.venue_name ?? null,
    tv_network: game.tv_network ?? null,
  };
}

// ---------------------------
// Public API functions
// ---------------------------

export async function fetchGamesToday(): Promise<GamesTodayResponse> {
  const res = await fetch("/games/today");
  if (!res.ok) {
    throw new Error(`Failed to load games: ${res.status} ${res.statusText}`);
  }

  const raw = (await res.json()) as BackendGamesTodayResponse;

  const mappedGames: TodayGame[] = Array.isArray(raw.games)
    ? raw.games.map(mapBackendTodayGame)
    : [];

  return { games: mappedGames };
}

export async function fetchGameLive(
  gameId: string
): Promise<GameLiveResponse> {
  const res = await fetch(`/games/${encodeURIComponent(gameId)}/live`);
  if (!res.ok) {
    throw new Error(
      `Failed to load game ${gameId}: ${res.status} ${res.statusText}`
    );
  }

  // For now we assume the backend's shape matches the GameLiveResponse types.
  // If we later change the backend, we can add a mapping layer like we did
  // for /games/today.
  const data = (await res.json()) as GameLiveResponse;
  return data;
}

export async function fetchCfbScoreboard(
  season?: number,
  week?: number
): Promise<CfbScoreboardResponse> {
  const params = new URLSearchParams();
  if (season != null) params.set("season", String(season));
  if (week != null) params.set("week", String(week));

  const qs = params.toString();
  const url = qs ? `/cfb/scoreboard?${qs}` : "/cfb/scoreboard";

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(
      `Failed to load CFB scoreboard: ${res.status} ${res.statusText}`
    );
  }

  const data = (await res.json()) as CfbScoreboardResponse;
  return data;
}
