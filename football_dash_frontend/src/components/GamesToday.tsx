// football_dash_frontend/src/components/GamesToday.tsx

import React, { useEffect, useState } from "react";
import { fetchGamesToday } from "../api";
import { GamesTodayResponse, TodayGame, StatusState } from "../types/api";

interface GamesTodayProps {
  onSelectGame?: (gameId: string) => void;
}

const statusPillClasses: Record<StatusState, string> = {
  pre: "bg-slate-800 text-slate-100",
  in: "bg-emerald-500/90 text-white",
  halftime: "bg-amber-500/90 text-black",
  final: "bg-slate-900 text-slate-100",
  post: "bg-slate-900 text-slate-100",
  delayed: "bg-red-600/90 text-white",
};

function formatNflStatus(game: TodayGame): string {
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

export const GamesToday: React.FC<GamesTodayProps> = ({ onSelectGame }) => {
  const [data, setData] = useState<GamesTodayResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetchGamesToday();
        if (!cancelled) {
          setData(res);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message ?? "Failed to load games");
          setData(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex flex-col h-full gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-50">NFL Games Today</h2>
        <span className="text-xs text-slate-400">
          {data?.games?.length ?? 0} games
        </span>
      </div>

      {loading && (
        <div className="flex-1 flex items-center justify-center text-slate-400 text-xs">
          Loading NFL games…
        </div>
      )}

      {error && !loading && (
        <div className="flex-1 flex items-center justify-center text-red-400 text-xs">
          {error}
        </div>
      )}

      {!loading && !error && data && data.games.length === 0 && (
        <div className="flex-1 flex items-center justify-center text-slate-400 text-xs">
          No NFL games found for today.
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
                  {formatNflStatus(g)}
                </span>
              </div>

              <div className="flex flex-col gap-1.5">
                {[g.away_team, g.home_team].map((team, idx) => (
                  <div
                    key={team.id + idx}
                    className="flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {team.logoUrl ? (
                        <img
                          src={team.logoUrl}
                          alt={team.name}
                          className="w-6 h-6 rounded-full bg-slate-800 object-contain shrink-0"
                        />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-slate-800 shrink-0" />
                      )}
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-medium text-slate-100 truncate">
                          {team.shortName}
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
