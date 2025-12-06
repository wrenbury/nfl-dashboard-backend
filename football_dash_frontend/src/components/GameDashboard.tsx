// football_dash_frontend/src/components/GameDashboard.tsx

import React, { useEffect, useState } from "react";
import { fetchGameLive } from "../api";
import { GameLiveResponse, League } from "../types/api";

interface GameDashboardProps {
  gameId: string;
  league?: League; // "NFL" | "CFB" (CFB detail wiring can be added later)
}

export const GameDashboard: React.FC<GameDashboardProps> = ({
  gameId,
  league = "NFL",
}) => {
  const [data, setData] = useState<GameLiveResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!gameId || league !== "NFL") {
      // For now, only NFL live endpoint is implemented.
      setData(null);
      setError(
        league === "CFB"
          ? "CFB live game view not yet implemented."
          : "No game selected."
      );
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetchGameLive(gameId);
        if (!cancelled) {
          setData(res);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message ?? "Failed to load live game data");
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
  }, [gameId, league]);

  if (!gameId) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-500 text-xs">
        Select a game to see details.
      </div>
    );
  }

  if (league === "CFB") {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-400 text-xs">
        CFB live game dashboard coming soon.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-400 text-xs">
        Loading game dashboard…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center text-red-400 text-xs px-4 text-center">
        {error}
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const { header, scoring, boxscore } = data;

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Top header card */}
      <div className="rounded-2xl border border-slate-800 bg-slate-950/80 px-4 py-3 flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>
            Week {header.week ?? "–"} • {header.season}
          </span>
          <span>{header.venue_name}</span>
        </div>

        <div className="grid grid-cols-3 items-center gap-2">
          <div className="flex flex-col gap-1">
            <span className="text-[11px] text-slate-400 uppercase">Away</span>
            <span className="text-sm font-medium text-slate-50">
              {header.away_team.shortName}
            </span>
            <span className="text-2xl font-semibold text-slate-50">
              {header.away_team.score ?? 0}
            </span>
          </div>

          <div className="flex flex-col items-center gap-1">
            <span className="text-xs text-slate-300 uppercase">
              {header.state.toUpperCase()}
            </span>
            <span className="text-lg font-semibold text-slate-50">
              {header.quarter ? `Q${header.quarter}` : ""}
            </span>
            <span className="text-xs text-slate-300">
              {header.clock ?? header.scheduled_utc}
            </span>
          </div>

          <div className="flex flex-col items-end gap-1">
            <span className="text-[11px] text-slate-400 uppercase">Home</span>
            <span className="text-sm font-medium text-slate-50">
              {header.home_team.shortName}
            </span>
            <span className="text-2xl font-semibold text-slate-50">
              {header.home_team.score ?? 0}
            </span>
          </div>
        </div>
      </div>

      {/* Bento layout: scoring + stats */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 flex-1 overflow-auto pb-4">
        <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3 flex flex-col gap-2">
          <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wide">
            Scoring Summary
          </h3>
          <div className="flex flex-col gap-1 text-xs text-slate-300">
            {scoring.summary_by_quarter.map((q) => (
              <div
                key={q.quarter ?? "ot"}
                className="flex items-center justify-between"
              >
                <span className="text-slate-400">
                  {q.quarter && q.quarter <= 4
                    ? `Q${q.quarter}`
                    : q.quarter === 5
                    ? "OT"
                    : "Total"}
                </span>
                <span>
                  {q.away_points} – {q.home_points}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-2 border-t border-slate-800 pt-2 space-y-1 max-h-40 overflow-auto">
            {scoring.plays.map((p) => (
              <div key={p.id} className="text-[11px] text-slate-300">
                <span className="text-slate-400 mr-1">
                  {p.quarter && p.quarter <= 4
                    ? `Q${p.quarter}`
                    : p.quarter === 5
                    ? "OT"
                    : ""}
                  {p.clock ? ` ${p.clock}` : ""}
                </span>
                <span className="font-semibold mr-1">{p.type}</span>
                <span>{p.description}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3 flex flex-col gap-2">
          <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wide">
            Team Stats
          </h3>
          <div className="grid grid-cols-[2fr_1fr_1fr] text-[11px] text-slate-300 gap-y-1">
            <div />
            <div className="text-right text-slate-400 uppercase">
              {header.away_team.shortName}
            </div>
            <div className="text-right text-slate-400 uppercase">
              {header.home_team.shortName}
            </div>

            {[
              ["Total Yards", "total_yards"],
              ["Plays", "plays"],
              ["Yards/Play", "yards_per_play"],
              ["Pass Yards", "passing_yards"],
              ["Rush Yards", "rushing_yards"],
              ["Turnovers", "turnovers"],
              ["Penalties", "penalties"],
              ["Penalty Yards", "penalty_yards"],
            ].map(([label, key]) => (
              <React.Fragment key={key}>
                <div className="text-slate-400">{label}</div>
                <div className="text-right">
                  {(boxscore.team_stats.away as any)[key] ?? "–"}
                </div>
                <div className="text-right">
                  {(boxscore.team_stats.home as any)[key] ?? "–"}
                </div>
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
