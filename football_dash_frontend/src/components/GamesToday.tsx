import React, { useEffect, useState } from "react";
import type { TodayGame, GamesTodayResponse } from "../types/api";

const API_BASE =
  window.location.protocol.replace(":", "") === "https"
    ? `https://${window.location.hostname}:8000`
    : `http://${window.location.hostname}:8000`;

export const GamesToday: React.FC<{
  onSelectGame: (gameId: string) => void;
}> = ({ onSelectGame }) => {
  const [games, setGames] = useState<TodayGame[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadGames() {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`${API_BASE}/games/today`);

        if (!res.ok) {
          const text = await res.text();
          throw new Error(
            `HTTP ${res.status} from /games/today: ${text.slice(0, 200)}`
          );
        }

        const data: GamesTodayResponse = await res.json();
        if (!cancelled) {
          setGames(data.games ?? []);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || String(err));
          setGames([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadGames();

    const id = setInterval(loadGames, 30_000); // refresh every 30s
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  if (loading) {
    return <div>Loading today&apos;s games…</div>;
  }

  if (error) {
    return <div style={{ color: "red" }}>Failed to load games: {error}</div>;
  }

  if (!games.length) {
    return <div>No games found for today.</div>;
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {games.map((g) => (
        <button
          key={g.game_id}
          onClick={() => onSelectGame(g.game_id)}
          className="border rounded-xl p-4 text-left hover:shadow-md transition"
        >
          <div className="text-xs uppercase text-gray-500">
            {g.league} • Week {g.week ?? "?"}
          </div>
          <div className="mt-1 text-sm text-gray-600">
            {g.status.toUpperCase()}{" "}
            {g.quarter ? `Q${g.quarter}` : ""}{" "}
            {g.clock ? `• ${g.clock}` : ""}
          </div>
          <div className="mt-2 font-semibold">
            {g.away_team.full_name} @ {g.home_team.full_name}
          </div>
          <div className="mt-1 text-lg font-bold">
            {g.away_team.score} - {g.home_team.score}
          </div>
          {g.red_zone && (
            <div className="mt-1 inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-full bg-red-100 text-red-800">
              Red Zone
            </div>
          )}
        </button>
      ))}
    </div>
  );
};
