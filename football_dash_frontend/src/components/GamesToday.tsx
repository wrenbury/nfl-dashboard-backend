import React, { useEffect, useState } from "react";
import { GamesTodayResponse, TodayGame } from "../types/api";

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
        import { fetchGamesToday } from "../api";
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const json: GamesTodayResponse = await res.json();
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

    return () => {
      cancelled = true;
    };
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
          <p className="text-red-400 text-sm">
            Failed to load games: {state.error}
          </p>
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
          <h2 className="text-base font-semibold tracking-tight">
            Today&apos;s Games
          </h2>
          <p className="text-xs text-slate-400">
            Tap a game to open the live dashboard.
          </p>
        </div>
      </div>
      {renderBody()}
    </section>
  );
};

interface GameCardProps {
  game: TodayGame;
  isSelected: boolean;
  onClick: () => void;
}

const statusLabel = (status: TodayGame["status"], quarter: number | null, clock: string | null) => {
  switch (status) {
    case "pre":
      return "Pre-game";
    case "in":
      if (quarter) {
        return `Q${quarter} ${clock ?? ""}`.trim();
      }
      return "In Progress";
    case "halftime":
      return "Halftime";
    case "final":
      return "Final";
    case "post":
      return "Post-game";
    case "delayed":
      return "Delayed";
    default:
      return status;
  }
};

const GameCard: React.FC<GameCardProps> = ({ game, isSelected, onClick }) => {
  const home = game.home_team;
  const away = game.away_team;

  const label = statusLabel(game.status, game.quarter, game.clock);

  return (
    <button
      onClick={onClick}
      className={`group flex flex-col rounded-2xl border bg-slate-900/60 p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-900 hover:shadow-md ${
        isSelected
          ? "border-emerald-500/70 shadow-emerald-500/10"
          : "border-slate-800"
      }`}
    >
      <div className="mb-3 flex items-center justify-between text-xs">
        <span className="rounded-full bg-slate-800 px-2 py-0.5 font-medium text-slate-200">
          {label}
        </span>
        {game.red_zone && (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-[11px] font-semibold text-red-400">
            <span className="h-1.5 w-1.5 rounded-full bg-red-400 animate-pulse" />
            RED ZONE
          </span>
        )}
      </div>

      <div className="flex items-center justify-between gap-3">
        <TeamRow team={away} isHome={false} />
        <div className="flex flex-col items-center justify-center px-2">
          <span className="text-xs text-slate-500">at</span>
        </div>
        <TeamRow team={home} isHome />
      </div>

      <div className="mt-4 flex items-center justify-between text-[11px] text-slate-400">
        <span>
          {game.season ?? "—"} • Week {game.week ?? "—"}
        </span>
        <span className="truncate max-w-[60%] text-right">
          {home.record ?? "—"} • {away.record ?? "—"}
        </span>
      </div>
    </button>
  );
};

const TeamRow: React.FC<{ team: TodayGame["home_team"]; isHome: boolean }> = ({
  team,
  isHome
}) => {
  return (
    <div className="flex flex-1 flex-col gap-1">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-800 text-xs font-bold">
            {team.abbreviation}
          </div>
          <div className="leading-tight">
            <div className="text-[11px] uppercase tracking-wide text-slate-500">
              {isHome ? "Home" : "Away"}
            </div>
            <div className="text-sm font-semibold line-clamp-1">
              {team.full_name}
            </div>
          </div>
        </div>
        <div className="min-w-[2.5rem] text-right text-lg font-semibold">
          {team.score}
        </div>
      </div>
    </div>
  );
};
