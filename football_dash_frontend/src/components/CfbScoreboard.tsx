// football_dash_frontend/src/components/CfbScoreboard.tsx

import React, { useEffect, useState } from "react";
import {
  CfbScoreboardGame,
  CfbScoreboardResponse,
  StatusState,
} from "../types/api";
import { fetchCfbScoreboard } from "../api";

interface CfbScoreboardProps {
  onSelectGame?: (gameId: string) => void;
}

const YEARS = [2023, 2024, 2025];
const WEEKS = Array.from({ length: 15 }, (_, i) => i + 1);

function formatGameStatus(game: CfbScoreboardGame): string {
  const { status, kickoff_time_utc, quarter, clock } = game;

  if (status === "pre") {
    if (kickoff_time_utc) {
      const d = new Date(kickoff_time_utc);
      return d.toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      });
    }
    return "Scheduled";
  }

  if (status === "final" || status === "post") {
    return "Final";
  }

  if (status === "halftime") {
    return "Halftime";
  }

  if (status === "in") {
    const q =
      quarter && quarter <= 4 ? `Q${quarter}` : quarter === 5 ? "OT" : "Live";
    return clock ? `${q} ${clock}` : q;
  }

  if (status === "delayed") {
    return "Delayed";
  }

  return status.toUpperCase();
}

const statusPillClasses: Record<StatusState, string> = {
  pre: "bg-slate-800 text-slate-100",
  in: "bg-emerald-500/90 text-white",
  halftime: "bg-amber-500/90 text-black",
  final: "bg-slate-900 text-slate-100",
  post: "bg-slate-900 text-slate-100",
  delayed: "bg-red-600/90 text-white",
};

export const CfbScoreboard: React.FC<CfbScoreboardProps> = ({
  onSelectGame,
}) => {
  const now = new Date();
  const currentYear = now.getFullYear();
  const [year, setYear] = useState<number>(
    YEARS.includes(currentYear) ? currentYear : YEARS[0]
  );
  const [week, setWeek] = useState<number>(1);

  const [data, setData] = useState<CfbScoreboardResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetchCfbScoreboard(year, week);
        if (!cancelled) {
          setData(res);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message ?? "Failed to load CFB scoreboard");
          setData(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [year, week]);

  const handlePrevWeek = () => {
    setWeek((w) => Math.max(1, w - 1));
  };

  const handleNextWeek = () => {
    setWeek((w) => Math.min(15, w + 1));
  };

  return (
    <div className="flex flex-col h-full gap-4">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-slate-50">
            College Football Scoreboard
          </h2>
          <p className="text-xs text-slate-400">
            Data from CollegeFootballData.com
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <select
            className="bg-slate-900/80 border border-slate-700 text-slate-100 rounded-md px-2 py-1"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          >
            {YEARS.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>

          <select
            className="bg-slate-900/80 border border-slate-700 text-slate-100 rounded-md px-2 py-1"
            value={week}
            onChange={(e) => setWeek(Number(e.target.value))}
          >
            {WEEKS.map((w) => (
              <option key={w} value={w}>
                Week {w}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handlePrevWeek}
              className="px-2 py-1 rounded-md border border-slate-700 text-slate-200 hover:bg-slate-800"
            >
              Prev
            </button>
            <button
              type="button"
              onClick={handleNextWeek}
              className="px-2 py-1 rounded-md border border-slate-700 text-slate-200 hover:bg-slate-800"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {loading && (
        <div className="flex-1 flex items-center justify-center text-slate-400 text-xs">
          Loading CFB games…
        </div>
      )}

      {error && !loading && (
        <div className="flex-1 flex items-center justify-center text-red-400 text-xs">
          {error}
        </div>
      )}

      {!loading && !error && data && data.games.length === 0 && (
        <div className="flex-1 flex items-center justify-center text-slate-400 text-xs">
          No games found for week {week}, {year}.
        </div>
      )}

      {!loading && !error && data && data.games.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 overflow-auto pb-2">
          {data.games.map((g) => (
            <button
              key={g.game_id}
              type="button"
              onClick={() => onSelectGame?.(g.game_id)}
              className="text-left rounded-2xl border border-slate-800 bg-slate-900/70 hover:bg-slate-800/80 transition shadow-sm px-3 py-2 flex flex-col gap-2"
            >
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="text-slate-300">
                  Week {g.week} • {g.season}
                </span>
                <span
                  className={`px-2 py-[2px] rounded-full font-medium ${
                    statusPillClasses[g.status]
                  }`}
                >
                  {formatGameStatus(g)}
                </span>
              </div>

              <div className="flex flex-col gap-1.5">
                {[g.away_team, g.home_team].map((team, idx) => (
                  <div
                    key={team.id + idx}
                    className="flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {team.rank && (
                        <span className="text-[11px] px-1.5 py-[1px] rounded-full bg-amber-500/90 text-slate-950 shrink-0">
                          #{team.rank}
                        </span>
                      )}
                      {team.logo_url ? (
                        <img
                          src={team.logo_url}
                          alt={team.name}
                          className="w-6 h-6 rounded-full bg-slate-800 object-contain shrink-0"
                        />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-slate-800 shrink-0" />
                      )}
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-medium text-slate-100 truncate">
                          {team.short_name || team.name}
                        </span>
                        {team.record && (
                          <span className="text-[10px] text-slate-400">
                            {team.record}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-semibold text-slate-50">
                        {team.score ?? (g.status === "pre" ? "–" : "0")}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between gap-2 mt-1 text-[10px] text-slate-400">
                <span className="truncate">{g.venue_name}</span>
                {g.tv_network && (
                  <span className="px-2 py-[1px] rounded-full border border-slate-700 text-slate-300">
                    {g.tv_network}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
