// football_dash_frontend/src/api.ts

// Central place to build URLs for the FastAPI backend.
//
// In dev (Vite @ :5173) we bypass the Vite proxy and talk directly
// to FastAPI on :8000 to avoid proxy HTML/text errors.
// In "prod" (served behind the same origin as the backend) we fall
// back to relative paths (API_BASE = "").

const DEV_BACKEND_PORT = "8000";

function getApiBase(): string {
  if (typeof window === "undefined") return "";

  const { protocol, hostname, port } = window.location;

  // Vite dev server default
  if (port === "5173") {
    return `${protocol}//${hostname}:${DEV_BACKEND_PORT}`;
  }

  // Same-origin in prod / on the Pi; use relative URLs.
  return "";
}

const API_BASE = getApiBase();

function buildUrl(path: string): string {
  return `${API_BASE}${path}`;
}

export const API = {
  /**
   * Scoreboard for a given sport.
   *
   * Backend routes:
   *   - /api/scoreboard/nfl              -> ESPN NFL
   *   - /api/scoreboard/college-football -> CollegeFootballData
   *
   * Optional query params:
   *   - date: YYYYMMDD
   *   - week: number (CFB convenience)
   */
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

  /**
   * Game details (bento view).
   *
   * Backend routes:
   *   - /api/game/nfl/{event_id}
   *   - /api/game/college-football/{event_id}  (reserved for future CFBD wiring)
   */
  game(sport: "nfl" | "college-football", eventId: string): string {
    const path = `/api/game/${sport}/${encodeURIComponent(eventId)}`;
    return buildUrl(path);
  },
};
