// football_dash_frontend/src/api.ts

const DEV_BACKEND_PORT = "8000";

function getApiBase(): string {
  if (typeof window === "undefined") return "";
  const { protocol, hostname, port } = window.location;

  if (port === "5173") {
    return `${protocol}//${hostname}:${DEV_BACKEND_PORT}`;
  }

  // Same-origin in "prod" on the Pi
  return "";
}

const API_BASE = getApiBase();

function buildUrl(path: string): string {
  return `${API_BASE}${path}`;
}

export type Week = {
  number: number;
  label: string;
  startDate: string;
  endDate: string;
  seasonType: number; // 1=preseason, 2=regular, 3=postseason
};

export const API = {
  scoreboard(
    sport: "nfl" | "college-football",
    opts: { date?: string; week?: number } = {}
  ): string {
    const params = new URLSearchParams();
    if (opts.date) params.set("date", opts.date);
    if (typeof opts.week === "number") params.set("week", String(opts.week));
    const qs = params.toString();
    const path = `/api/scoreboard/${sport}${qs ? `?${qs}` : ""}`;
    return buildUrl(path);
  },

  game(sport: "nfl" | "college-football", eventId: string): string {
    const path = `/api/game/${sport}/${encodeURIComponent(eventId)}`;
    return buildUrl(path);
  },

  nflWeeks(): string {
    return buildUrl("/api/nfl/weeks");
  },

  nflCurrentWeek(): string {
    return buildUrl("/api/nfl/current-week");
  },
};
