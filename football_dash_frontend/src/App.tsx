import React, { useState } from "react";
import { GamesToday } from "./components/GamesToday";
import { GameDashboard } from "./components/GameDashboard";

type View = "today" | "game";

export const App: React.FC = () => {
  const [view, setView] = useState<View>("today");
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);

  const handleSelectGame = (gameId: string) => {
    setSelectedGameId(gameId);
    setView("game");
  };

  const handleBackToToday = () => {
    setView("today");
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 text-xl font-bold">
              🏈
            </span>
            <div>
              <h1 className="text-lg font-semibold tracking-tight">
                Football Live Dashboard
              </h1>
              <p className="text-xs text-slate-400">
                NFL realtime scoreboard & game view
              </p>
            </div>
          </div>

          <nav className="flex items-center gap-2 text-sm">
            <button
              onClick={() => setView("today")}
              className={`rounded-full px-3 py-1 transition ${
                view === "today"
                  ? "bg-slate-700 text-white"
                  : "text-slate-300 hover:bg-slate-800"
              }`}
            >
              Today&apos;s Games
            </button>
            <button
              onClick={() => selectedGameId && setView("game")}
              disabled={!selectedGameId}
              className={`rounded-full px-3 py-1 transition ${
                view === "game"
                  ? "bg-slate-700 text-white"
                  : "text-slate-300 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
              }`}
            >
              Game Dashboard
            </button>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {view === "today" && (
          <GamesToday onSelectGame={handleSelectGame} selectedGameId={selectedGameId} />
        )}

        {view === "game" && selectedGameId && (
          <GameDashboard
            gameId={selectedGameId}
            onBack={handleBackToToday}
          />
        )}

        {view === "game" && !selectedGameId && (
          <div className="mx-auto max-w-5xl px-4 py-8 text-center text-slate-400">
            <p>Select a game from Today&apos;s Games to open the dashboard.</p>
          </div>
        )}
      </main>
    </div>
  );
};
