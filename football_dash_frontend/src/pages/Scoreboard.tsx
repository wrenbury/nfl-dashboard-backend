import useSWR from "swr";
import GameList from "../components/GameList";
import { API } from "../api";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

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
  const isCfb = sport === "college-football";

  // NFL → ESPN via /api/scoreboard/nfl
  // CFB → CollegeFootballData via /cfb/scoreboard
  const endpoint = isCfb
    ? `/cfb/scoreboard?date=${date}`
    : API.scoreboard(sport, { date });

  const { data, error, isLoading } = useSWR(endpoint, fetcher, {
    revalidateOnFocus: false,
  });

  // Normalize shape into a flat games array regardless of source
  const games = Array.isArray(data)
    ? data
    : data?.games ?? data?.events ?? [];

  return (
    <div>
      <div className="mb-3 text-sm opacity-70">
        Showing: {sport.toUpperCase()} — {date}
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
