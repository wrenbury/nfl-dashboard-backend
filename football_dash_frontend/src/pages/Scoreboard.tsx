import useSWR from "swr";
import GameList from "../components/GameList";
import { API } from "../../lib/api";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function Scoreboard({
  sport,
}: {
  sport: "nfl" | "college-football";
}) {
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", ""); // YYYYMMDD
  const { data, error, isLoading } = useSWR(
    API.scoreboard(sport, { date }),
    fetcher,
    { revalidateOnFocus: false }
  );

  return (
    <div>
      <div className="mb-3 text-sm opacity-70">
        Showing: {sport.toUpperCase()} — {date}
      </div>
      {isLoading && <div>Loading…</div>}
      {error && <div className="text-red-400">Failed to load.</div>}
      {data && <GameList games={data} />}
    </div>
  );
}
