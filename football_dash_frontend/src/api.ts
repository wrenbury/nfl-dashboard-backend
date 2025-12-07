// football_dash_frontend/src/api.ts

// Central place to build URLs for the FastAPI backend.
// We keep this tiny and focused so the rest of the app just calls API.*.

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
    return qs ? `/api/scoreboard/${sport}?${qs}` : `/api/scoreboard/${sport}`;
  },

  /**
   * Game details (bento view).
   *
   * Backend routes:
   *   - /api/game/nfl/{event_id}
   *   - /api/game/college-football/{event_id}  (reserved for future CFBD wiring)
   */
  game(sport: "nfl" | "college-football", eventId: string): string {
    return `/api/game/${sport}/${encodeURIComponent(eventId)}`;
  },
};
