// football_dash_frontend/src/pages/Scoreboard.tsx

import useSWR from "swr";
import GameList from "../components/GameList";
import { API } from "../api";

type Sport = "nfl" | "college-football";

type Props = {
  sport: Sport;
};

const fetcher = async (url: string) => {
  const res = await fetch(url);

  // Always read the raw text so we can safely parse / log
  const text = await res.text();
  let data: any = null;

  if (text) {
    try {
      data = JSON.parse(text);
    } catch (err) {
      // If backend ever returns non-JSON (proxy error, HTML, etc.), surface that clearly.
      console.error("Scoreboard JSON parse error:", err, text);
      throw new Error("Invalid JSON received from backend");
    }
  }

  if (!res.ok) {
    const detail =
      (data && (data.detail || data.error || data.message)) || text || "";
    const msg = `HTTP ${res.status}${
      detail ? ` – ${String(detail).slice(0, 200)}` : ""
    }`;
    console.error("Scoreboard HTTP error:", msg);
    throw new Error(msg);
  }

  return data;
};

// Use LOCAL time instead of UTC so we don't roll over to "tomorrow" at night.
function getLocalYyyyMmDd(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

export default function Scoreboard({ sport }: Props) {
  const date = getLocalYyyyMmDd();

  // Unified backend: /api/scoreboard/{sport}?date=YYYYMMDD
  // NFL -> ESPN, CFB -> CollegeFootballData (implemented in app.services.scoreboard)
  const endpoint = API.scoreboard(sport, { date });

  const {
    data,
    error,
    isLoading,
  } = useSWR(endpoint, fetcher, {
    revalidateOnFocus: false,
  });

  // Backend returns List[GameSummary] for both NFL & CFB
  const games = Array.isArray(data) ? data : [];

  return (
    <div>
      <div className="mb-3 text-sm opacity-70">
        <>Showing: {sport.toUpperCase()} — {date}</>
      </div>

      {isLoading && <div>Loading…</div>}

      {error && (
        <div className="text-red-400 text-sm">
          Failed to load scoreboard.
        </div>
      )}

      {!isLoading && !error && <GameList games={games} />}
    </div>
  );
}
