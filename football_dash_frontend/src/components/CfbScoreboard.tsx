// football_dash_frontend/src/components/CfbScoreboard.tsx

import React, { useEffect, useState } from "react";
import { API, Week } from "../api";

interface Team {
  id: string;
  name: string;
  nickname?: string;
  abbreviation?: string;
  color?: string;
  logo?: string;
  record?: string;
  rank?: number;
}

interface Competitor {
  team: Team;
  homeAway: string;
  score?: number;
}

interface CfbScoreboardGame {
  id: string;
  sport: string;
  startTime?: string;
  status: string;
  venue?: string;
  competitors: Competitor[];
}

interface CfbScoreboardResponse {
  games?: CfbScoreboardGame[];
}

interface CfbScoreboardProps {
  onSelectGame?: (gameId: string) => void;
}

const YEARS = [2023, 2024, 2025];

function formatGameStatus(status: string, startTime?: string): string {
  const statusLower = status.toLowerCase();

  if (statusLower === "scheduled" || statusLower === "pre") {
    if (startTime) {
      const d = new Date(startTime);
      return d.toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      });
    }
    return "Scheduled";
  }

  if (statusLower === "final" || statusLower === "postgame") {
    return "Final";
  }

  if (statusLower === "halftime") {
    return "Halftime";
  }

  if (statusLower === "in progress") {
    return "Live";
  }

  if (statusLower === "delayed") {
    return "Delayed";
  }

  return status;
}

const statusPillClasses: Record<string, string> = {
  scheduled: "bg-slate-800 text-slate-100",
  pre: "bg-slate-800 text-slate-100",
  "in progress": "bg-emerald-500/90 text-white",
  halftime: "bg-amber-500/90 text-black",
  final: "bg-slate-900 text-slate-100",
  postgame: "bg-slate-900 text-slate-100",
  delayed: "bg-red-600/90 text-white",
};

export const CfbScoreboard: React.FC<CfbScoreboardProps> = ({
  onSelectGame,
}) => {
  const now = new Date();
  const currentYear = now.getFullYear();
  const [year, setYear] = useState<number>(
    YEARS.includes(currentYear) ? currentYear : YEARS[YEARS.length - 1]
  );

  const [weeks, setWeeks] = useState<Week[]>([]);
  const [selectedWeek, setSelectedWeek] = useState<Week | null>(null);
  const [data, setData] = useState<CfbScoreboardGame[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch weeks when year changes
  useEffect(() => {
    (async () => {
      try {
        const url = API.cfbWeeks(year);
        const res = await fetch(url);
        if (!res.ok) throw new Error("Failed to fetch CFB weeks");
        const weeksData: Week[] = await res.json();
        setWeeks(weeksData);

        // Default to first week if available
        if (weeksData.length > 0 && !selectedWeek) {
          setSelectedWeek(weeksData[0]);
        }
      } catch (err: any) {
        console.error("Error fetching CFB weeks:", err);
        setWeeks([]);
      }
    })();
  }, [year]);

  // Fetch games when week changes
  useEffect(() => {
    if (!selectedWeek) return;

    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);

        const url = API.scoreboard("college-football", {
          week: selectedWeek.number,
          seasonType: selectedWeek.seasonType,
        });

        const res = await fetch(url);
        if (!res.ok) throw new Error("Failed to load CFB scoreboard");

        const games: CfbScoreboardGame[] = await res.json();
        if (!cancelled) {
          setData(games || []);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message ?? "Failed to load CFB scoreboard");
          setData([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedWeek]);

  const handlePrevWeek = () => {
    if (!selectedWeek || weeks.length === 0) return;
    const currentIndex = weeks.findIndex(w => w.number === selectedWeek.number && w.seasonType === selectedWeek.seasonType);
    if (currentIndex > 0) {
      setSelectedWeek(weeks[currentIndex - 1]);
    }
  };

  const handleNextWeek = () => {
    if (!selectedWeek || weeks.length === 0) return;
    const currentIndex = weeks.findIndex(w => w.number === selectedWeek.number && w.seasonType === selectedWeek.seasonType);
    if (currentIndex < weeks.length - 1) {
      setSelectedWeek(weeks[currentIndex + 1]);
    }
  };

  // Group weeks by season type
  const regularSeasonWeeks = weeks.filter(w => w.seasonType === 2);
  const postseasonWeeks = weeks.filter(w => w.seasonType === 3);

  return (
    <div className="flex flex-col h-full gap-4">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-slate-50">
            CFB Scoreboard
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
            className="bg-slate-900/80 border border-slate-700 text-slate-100 rounded-md px-2 py-1 min-w-[120px]"
            value={selectedWeek ? `${selectedWeek.seasonType}-${selectedWeek.number}` : ""}
            onChange={(e) => {
              const [seasonType, weekNum] = e.target.value.split("-").map(Number);
              const week = weeks.find(w => w.seasonType === seasonType && w.number === weekNum);
              if (week) setSelectedWeek(week);
            }}
          >
            {regularSeasonWeeks.length > 0 && (
              <optgroup label="Regular Season">
                {regularSeasonWeeks.map((w) => (
                  <option key={`${w.seasonType}-${w.number}`} value={`${w.seasonType}-${w.number}`}>
                    {w.label}
                  </option>
                ))}
              </optgroup>
            )}
            {postseasonWeeks.length > 0 && (
              <optgroup label="Postseason">
                {postseasonWeeks.map((w) => (
                  <option key={`${w.seasonType}-${w.number}`} value={`${w.seasonType}-${w.number}`}>
                    {w.label}
                  </option>
                ))}
              </optgroup>
            )}
          </select>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handlePrevWeek}
              disabled={!selectedWeek || weeks.findIndex(w => w.number === selectedWeek.number && w.seasonType === selectedWeek.seasonType) === 0}
              className="px-2 py-1 rounded-md border border-slate-700 text-slate-200 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Prev
            </button>
            <button
              type="button"
              onClick={handleNextWeek}
              disabled={!selectedWeek || weeks.findIndex(w => w.number === selectedWeek.number && w.seasonType === selectedWeek.seasonType) === weeks.length - 1}
              className="px-2 py-1 rounded-md border border-slate-700 text-slate-200 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
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

      {!loading && !error && data.length === 0 && selectedWeek && (
        <div className="flex-1 flex items-center justify-center text-slate-400 text-xs">
          No games scheduled for {selectedWeek.label}, {year}.
        </div>
      )}

      {!loading && !error && data.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 overflow-auto pb-2">
          {data.map((g) => {
            const homeTeam = g.competitors.find(c => c.homeAway === "home");
            const awayTeam = g.competitors.find(c => c.homeAway === "away");

            if (!homeTeam || !awayTeam) return null;

            return (
              <button
                key={g.id}
                type="button"
                onClick={() => onSelectGame?.(g.id)}
                className="text-left rounded-2xl border border-slate-800 bg-slate-900/70 hover:bg-slate-800/80 transition shadow-sm px-3 py-2 flex flex-col gap-2"
              >
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-slate-300">
                    {selectedWeek?.label} • {year}
                  </span>
                  <span
                    className={`px-2 py-[2px] rounded-full font-medium ${
                      statusPillClasses[g.status.toLowerCase()] || "bg-slate-800 text-slate-100"
                    }`}
                  >
                    {formatGameStatus(g.status, g.startTime)}
                  </span>
                </div>

                <div className="flex flex-col gap-1.5">
                  {[awayTeam, homeTeam].map((competitor, idx) => (
                    <div
                      key={competitor.team.id + idx}
                      className="flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {competitor.team.rank && (
                          <span className="text-[11px] px-1.5 py-[1px] rounded-full bg-amber-500/90 text-slate-950 shrink-0">
                            #{competitor.team.rank}
                          </span>
                        )}
                        {competitor.team.logo ? (
                          <img
                            src={competitor.team.logo}
                            alt={competitor.team.name}
                            className="w-6 h-6 rounded-full bg-slate-800 object-contain shrink-0"
                          />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-slate-800 shrink-0" />
                        )}
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs font-medium text-slate-100 truncate">
                            {competitor.team.nickname || competitor.team.name}
                          </span>
                          {competitor.team.record && (
                            <span className="text-[10px] text-slate-400">
                              {competitor.team.record}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-semibold text-slate-50">
                          {competitor.score ?? (g.status.toLowerCase() === "scheduled" ? "–" : "0")}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between gap-2 mt-1 text-[10px] text-slate-400">
                  <span className="truncate">{g.venue}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
