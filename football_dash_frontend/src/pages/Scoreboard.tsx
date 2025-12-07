import useSWR from "swr";
import GameList from "../components/GameList";
import { API } from "../api";

const fetcher = async (url: string) => {
  const res = await fetch(url);
  // Log and throw on non-2xx so SWR shows an error *and* we can debug in the console
  if (!res.ok) {
    const text = await res.text();
    console.error("Scoreboard fetch error:", res.status, text);
    throw new Error(`HTTP ${res.status}`);
  }
  return res.json();
};

// Use LOCAL time instead of UTC so we don't roll over to "tomorrow" at night.
function getLocalYyyyMmDd(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

export default function Scoreboard({
  sport,
}: {
  sport: "nfl" | "college-football";
}) {
  const date = getLocalYyyyMmDd();

  // ✅ Unified backend: /api/scoreboard/{sport}?date=YYYYMMDD
  const endpoint = API.scoreboard(sport, { date });

  const { data, error, isLoading } = useSWR(endpoint, fetcher, {
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
