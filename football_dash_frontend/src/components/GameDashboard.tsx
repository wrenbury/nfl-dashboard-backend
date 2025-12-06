import React, { useEffect, useState } from "react";
import type { GameLiveResponse } from "../types/api";

const API_BASE =
  window.location.protocol.replace(":", "") === "https"
    ? `https://${window.location.hostname}:8000`
    : `http://${window.location.hostname}:8000`;

interface Props {
  gameId: string;
}

export const GameDashboard: React.FC<Props> = ({ gameId }) => {
  const [data, setData] = useState<GameLiveResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadGame() {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(
          `${API_BASE}/games/${encodeURIComponent(gameId)}/live`
        );

        if (!res.ok) {
          const text = await res.text();
          throw new Error(
            `HTTP ${res.status} from /games/${gameId}/live: ${text.slice(
              0,
              200
            )}`
          );
        }

        const json: GameLiveResponse = await res.json();
        if (!cancelled) {
          setData(json);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || String(err));
          setData(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    if (gameId) {
      loadGame();
      const id = setInterval(loadGame, 15_000); // refresh every 15s
      return () => {
        cancelled = true;
        clearInterval(id);
      };
    }
  }, [gameId]);

  if (!gameId) {
    return <div>Select a game from the left to view details.</div>;
  }

  if (loading) {
    return <div>Loading game {gameId}…</div>;
  }

  if (error) {
    return (
      <div style={{ color: "red" }}>
        Failed to load game {gameId}: {error}
      </div>
    );
  }

  if (!data) {
    return <div>No data for game {gameId}.</div>;
  }

  const { header, scoring, boxscore } = data;

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <div className="md:col-span-2 space-y-3">
        <div className="border rounded-xl p-4">
          <div className="text-xs uppercase text-gray-500">
            {header.league} • Season {header.season} • Week{" "}
            {header.week ?? "?"}
          </div>
          <div className="mt-1 text-sm text-gray-600">
            {header.status.toUpperCase()}{" "}
            {header.quarter ? `Q${header.quarter}` : ""}{" "}
            {header.clock ? `• ${header.clock}` : ""}
          </div>
          <div className="mt-2 text-xl font-semibold">
            {header.away_team.full_name} @ {header.home_team.full_name}
          </div>
          <div className="mt-1 text-2xl font-bold">
            {header.away_team.score} - {header.home_team.score}
          </div>
          {header.last_play_short && (
            <div className="mt-2 text-sm text-gray-700">
              Last play: {header.last_play_short}
            </div>
          )}
        </div>

        <div className="border rounded-xl p-4">
          <h3 className="font-semibold mb-2">Scoring Summary</h3>
          {scoring.summary_by_quarter.length === 0 ? (
            <div className="text-sm text-gray-500">
              No quarter-by-quarter scoring available.
            </div>
          ) : (
            <ul className="text-sm space-y-1">
              {scoring.summary_by_quarter.map((q) => (
                <li key={q.quarter}>
                  Q{q.quarter}: {q.away_points} - {q.home_points}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="space-y-3">
        <div className="border rounded-xl p-4">
          <h3 className="font-semibold mb-2">Team Stats</h3>
          <div className="text-sm">
            <div>Total yards:</div>
            <div>
              {boxscore.team_stats.away.total_yards ?? "-"} (away) /{" "}
              {boxscore.team_stats.home.total_yards ?? "-"} (home)
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
