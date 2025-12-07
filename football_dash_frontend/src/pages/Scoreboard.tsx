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

  // ---- CFB: use explicit year + week so we see real games ----
  // Adjust these to whatever slate you want to look at
  const cfbYear = 2024;
  const cfbWeek = 1;

  const endpoint = isCfb
    // CollegeFootballData scoreboard (our FastAPI router under /cfb)
    ? `/cfb/scoreboard?year=${cfbYear}&week=${cfbWeek}`
    // NFL scoreboard from ESPN (our FastAPI /api router)
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
        {isCfb ? (
          <>Showing: COLLEGE-FOOTBALL — Season {cfbYear}, Week {cfbWeek}</>
        ) : (
          <>Showing: {sport.toUpperCase()} — {date}</>
        )}
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
