import React, { useEffect, useState } from "react";
import { GamesTodayResponse, TodayGame } from "../types/api";
import { fetchGamesToday } from "../api";

interface GamesTodayProps {
  onSelectGame: (gameId: string) => void;
  selectedGameId: string | null;
}

type FetchState<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; error: string }
  | { status: "success"; data: T };

export const GamesToday: React.FC<GamesTodayProps> = ({
  onSelectGame,
  selectedGameId
}) => {
  const [state, setState] = useState<FetchState<GamesTodayResponse>>({
    status: "idle"
  });

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setState({ status: "loading" });
      try {
        const json = await fetchGamesToday();
        if (!cancelled) {
          setState({ status: "success", data: json });
        }
      } catch (err) {
        if (!cancelled) {
          setState({
            status: "error",
            error: err instanceof Error ? err.message : "Unknown error"
          });
        }
      }
    };

    load();
    return () => { cancelled = true; };
  }, []);

  const renderBody = () => {
    if (state.status === "loading" || state.status === "idle") {
      return (
        <div className="flex items-center justify-center py-16 text-slate-400">
          Loading today&apos;s games...
        </div>
      );
    }

    if (state.status === "error") {
      return (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <p className="text-red-400 text-sm">Failed to load games: {state.error}</p>
          <button
            onClick={() => window.location.reload()}
            className="rounded-full bg-slate-800 px-4 py-1.5 text-sm text-slate-100 hover:bg-slate-700"
          >
            Retry
          </button>
        </div>
      );
    }

    const games = state.data.games;

    if (!games.length) {
      return (
        <div className="flex items-center justify-center py-16 text-slate-400">
          No NFL games found for today.
        </div>
      );
    }

    return (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {games.map((game) => (
          <GameCard
            key={game.game_id}
            game={game}
            isSelected={selectedGameId === game.game_id}
            onClick={() => onSelectGame(game.game_id)}
          />
        ))}
      </div>
    );
  };

  return (
    <section className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold tracking-tight">Today&apos;s Games</h2>
          <p className="text-xs text-slate-400">
            Tap a game to open the live dashboard.
          </p>
        </div>
      </div>
      {renderBody()}
    </section>
  );
};

// ---- GameCard and TeamRow remain unchanged ----
