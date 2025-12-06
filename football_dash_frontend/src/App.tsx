// football_dash_frontend/src/App.tsx

import React, { useState } from "react";
import { GamesToday } from "./components/GamesToday";
import { GameDashboard } from "./components/GameDashboard";
import { CfbScoreboard } from "./components/CfbScoreboard";
import { League } from "./types/api";

type ScoreboardMode = "NFL" | "CFB";

const App: React.FC = () => {
  const [mode, setMode] = useState<ScoreboardMode>("NFL");
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
  const [selectedLeague, setSelectedLeague] = useState<League>("NFL");

  const handleSelectNflGame = (gameId: string) => {
    setSelectedGameId(gameId);
    setSelectedLeague("NFL");
  };

  const handleSelectCfbGame = (gameId: string) => {
    setSelectedGameId(gameId);
    setSelectedLeague("CFB");
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <div className="max-w-6xl mx-auto px-4 py-4 flex flex-col gap-4 h-screen">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              Football Dashboard
            </h1>
            <p className="text-xs text-slate-400">
              NFL live games + College Football scoreboard
            </p>
          </div>

          <div className="inline-flex items-center rounded-full bg-slate-900/70 p-1 text-xs border border-slate-800">
            <button
              type="button"
              onClick={() => {
                setMode("NFL");
                setSelectedGameId(null);
                setSelectedLeague("NFL");
              }}
              className={`px-3 py-1 rounded-full transition ${
                mode === "NFL"
                  ? "bg-slate-100 text-slate-900 shadow-sm"
                  : "text-slate-300"
              }`}
            >
              NFL
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("CFB");
                setSelectedGameId(null);
                setSelectedLeague("CFB");
              }}
              className={`px-3 py-1 rounded-full transition ${
                mode === "CFB"
                  ? "bg-slate-100 text-slate-900 shadow-sm"
                  : "text-slate-300"
              }`}
            >
              CFB
            </button>
          </div>
        </header>

        <main className="flex-1 grid grid-cols-1 lg:grid-cols-[minmax(0,2.2fr)_minmax(0,3fr)] gap-4 min-h-0">
          <section className="min-h-0">
            {mode === "NFL" ? (
              <GamesToday onSelectGame={handleSelectNflGame} />
            ) : (
              <CfbScoreboard onSelectGame={handleSelectCfbGame} />
            )}
          </section>

          <section className="hidden lg:block min-h-0">
            {selectedGameId ? (
              <GameDashboard
                gameId={selectedGameId}
                league={selectedLeague}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-slate-500">
                Select a game from the left to view details.
              </div>
            )}
          </section>
        </main>

        <footer className="text-[10px] text-slate-500 flex items-center justify-between">
          <span>Backend: FastAPI • Frontend: React + Vite + Tailwind</span>
          <span>NFL data: ESPN • CFB data: CollegeFootballData.com</span>
        </footer>
      </div>
    </div>
  );
};

export default App;
