// football_dash_frontend/src/pages/Scoreboard.tsx

import { useState, useMemo } from "react";
import useSWR from "swr";
import { Link } from "react-router-dom";
import { API } from "../api";

type Sport = "nfl" | "college-football";

type Props = {
  sport: Sport;
};

type Team = {
  team: {
    id?: string;
    name: string;
    abbreviation?: string;
    logo?: string;
    record?: string;
  };
  homeAway: "home" | "away";
  score?: number;
};

type Game = {
  id: string;
  startTime: string;
  status: string;
  venue?: string;
  competitors: Team[];
};

const fetcher = async (url: string) => {
  const res = await fetch(url);
  const contentType = res.headers.get("content-type") || "";
  const text = await res.text();

  let data: any = null;
  if (contentType.includes("application/json")) {
    try {
      data = text ? JSON.parse(text) : null;
    } catch (err) {
      console.error("Scoreboard JSON parse error:", err, text);
      throw new Error(
        "Backend returned malformed JSON. Snippet: " + text.slice(0, 200)
      );
    }
  }

  if (!res.ok) {
    const detail =
      (data && (data.detail || data.error || data.message)) || text || "";
    const msg = `HTTP ${res.status}${
      detail ? ` - ${String(detail).slice(0, 200)}` : ""
    }`;
    console.error("Scoreboard HTTP error:", msg);
    throw new Error(msg);
  }

  if (!contentType.includes("application/json")) {
    console.error(
      "Scoreboard non-JSON response:",
      contentType || "(no content-type)",
      text
    );
    throw new Error(
      "Backend did not return JSON. Snippet: " + text.slice(0, 200)
    );
  }

  return data;
};

// NFL 2025 season week definitions (approximate)
function getNflWeeks(year: number) {
  // Week 1 typically starts first Thursday after Labor Day
  // These are approximate date ranges for the 2025 season
  const weeks = [];
  const baseDate = new Date(year, 8, 4); // Sept 4, 2025 approx start

  for (let w = 1; w <= 18; w++) {
    const startOffset = (w - 1) * 7;
    const start = new Date(baseDate);
    start.setDate(start.getDate() + startOffset);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);

    weeks.push({
      week: w,
      label: `Week ${w}`,
      startDate: start,
      endDate: end,
      dateRange: `${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${end.toLocaleDateString("en-US", { day: "numeric" })}`,
    });
  }
  return weeks;
}

function getCurrentNflWeek(): number {
  const now = new Date();
  const year = now.getFullYear();
  const weeks = getNflWeeks(year);

  for (const w of weeks) {
    if (now >= w.startDate && now <= w.endDate) {
      return w.week;
    }
  }

  // If before season, return week 1; if after, return week 18
  if (now < weeks[0].startDate) return 1;
  return 18;
}

export default function Scoreboard({ sport }: Props) {
  const currentYear = new Date().getFullYear();
  const [selectedWeek, setSelectedWeek] = useState(getCurrentNflWeek());

  const weeks = useMemo(() => getNflWeeks(currentYear), [currentYear]);
  const currentWeekData = weeks.find((w) => w.week === selectedWeek);

  // Use week parameter for NFL
  const endpoint = API.scoreboard(sport, { week: selectedWeek });

  const { data, error, isLoading } = useSWR(endpoint, fetcher, {
    revalidateOnFocus: false,
  });

  const games = Array.isArray(data) ? data : [];

  // Group games by date
  const gamesByDate = useMemo(() => {
    const grouped: Record<string, Game[]> = {};
    for (const game of games) {
      const date = game.startTime
        ? new Date(game.startTime).toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric",
          })
        : "TBD";
      if (!grouped[date]) grouped[date] = [];
      grouped[date].push(game);
    }
    return grouped;
  }, [games]);

  const handleWeekChange = (delta: number) => {
    setSelectedWeek((prev) => Math.max(1, Math.min(18, prev + delta)));
  };

  return (
    <section className="space-y-5">
      {/* Week Selector Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">NFL Scoreboard</h1>
      </div>

      {/* Week Navigation Bar */}
      <div className="card p-0 overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-700/50">
          {/* Left arrow */}
          <button
            onClick={() => handleWeekChange(-1)}
            disabled={selectedWeek <= 1}
            className="p-3 hover:bg-slate-800/50 disabled:opacity-30 disabled:cursor-not-allowed transition"
          >
            <span className="text-lg">←</span>
          </button>

          {/* Week tabs */}
          <div className="flex-1 overflow-x-auto scrollbar-hide">
            <div className="flex items-center justify-center gap-1 py-2 px-2 min-w-max">
              {weeks.slice(Math.max(0, selectedWeek - 4), selectedWeek + 3).map((w) => (
                <button
                  key={w.week}
                  onClick={() => setSelectedWeek(w.week)}
                  className={`px-3 py-1.5 rounded text-sm whitespace-nowrap transition ${
                    w.week === selectedWeek
                      ? "bg-blue-600 text-white font-semibold"
                      : "hover:bg-slate-800/50 text-slate-400"
                  }`}
                >
                  <div className="font-medium">Week {w.week}</div>
                  <div className="text-[10px] opacity-70">{w.dateRange}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Right arrow */}
          <button
            onClick={() => handleWeekChange(1)}
            disabled={selectedWeek >= 18}
            className="p-3 hover:bg-slate-800/50 disabled:opacity-30 disabled:cursor-not-allowed transition"
          >
            <span className="text-lg">→</span>
          </button>
        </div>

        {/* Current week info */}
        <div className="px-4 py-2 bg-slate-900/50 text-center text-sm text-slate-400">
          {currentWeekData?.label} • {currentWeekData?.dateRange}
        </div>
      </div>

      {/* Loading / Error States */}
      {isLoading && (
        <div className="text-sm opacity-80 text-center py-8">Loading games...</div>
      )}

      {error && (
        <div className="text-sm text-red-400 whitespace-pre-wrap card">
          Failed to load scoreboard.
          {"\n"}
          {(error as Error).message}
        </div>
      )}

      {/* Games List */}
      {!isLoading && !error && (
        <div className="space-y-6">
          {Object.entries(gamesByDate).length === 0 ? (
            <div className="text-center text-slate-400 py-8">
              No games scheduled for Week {selectedWeek}
            </div>
          ) : (
            Object.entries(gamesByDate).map(([date, dateGames]) => (
              <div key={date} className="space-y-3">
                {/* Date header */}
                <div className="text-sm font-medium text-slate-400 border-b border-slate-800 pb-2">
                  {date}
                </div>

                {/* Game cards */}
                <div className="grid gap-3 md:grid-cols-2">
                  {dateGames.map((game) => (
                    <GameCard key={game.id} game={game} sport={sport} />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </section>
  );
}

function GameCard({ game, sport }: { game: Game; sport: Sport }) {
  const [away, home] =
    game.competitors[0]?.homeAway === "away"
      ? game.competitors
      : [game.competitors[1], game.competitors[0]];

  const awayTeam = away?.team ?? { name: "Away" };
  const homeTeam = home?.team ?? { name: "Home" };

  const isFinal = game.status?.toLowerCase().includes("final");
  const isInProgress =
    game.status?.toLowerCase().includes("progress") ||
    game.status?.toLowerCase().includes("half");

  // Determine winner for final games
  const awayScore = away?.score ?? 0;
  const homeScore = home?.score ?? 0;
  const awayWins = isFinal && awayScore > homeScore;
  const homeWins = isFinal && homeScore > awayScore;

  // Format game time
  const gameTime = game.startTime
    ? new Date(game.startTime).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      })
    : "";

  return (
    <Link
      to={`/${sport}/game/${game.id}`}
      className="card p-4 hover:bg-slate-800/50 transition block"
    >
      {/* Status row */}
      <div className="flex items-center justify-between mb-3 text-xs">
        <span
          className={`px-2 py-0.5 rounded-full font-medium ${
            isFinal
              ? "bg-slate-700 text-slate-300"
              : isInProgress
              ? "bg-green-900/50 text-green-400"
              : "bg-slate-800 text-slate-400"
          }`}
        >
          {game.status}
        </span>
        {!isFinal && !isInProgress && gameTime && (
          <span className="text-slate-500">{gameTime}</span>
        )}
        {game.venue && (
          <span className="text-slate-500 truncate max-w-[150px]" title={game.venue}>
            {game.venue}
          </span>
        )}
      </div>

      {/* Teams */}
      <div className="space-y-2">
        {/* Away team */}
        <div className={`flex items-center gap-3 ${awayWins ? "" : homeWins ? "opacity-60" : ""}`}>
          {awayTeam.logo ? (
            <img
              src={awayTeam.logo}
              alt={awayTeam.name}
              className="w-8 h-8 rounded-full object-contain bg-slate-800/50"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold">
              {awayTeam.abbreviation?.slice(0, 3) || awayTeam.name?.slice(0, 3)}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="font-medium truncate">{awayTeam.name}</div>
            <div className="text-xs text-slate-500">{awayTeam.record || "Away"}</div>
          </div>
          <div className={`text-xl font-bold tabular-nums ${awayWins ? "text-green-400" : ""}`}>
            {away?.score ?? "-"}
          </div>
          {awayWins && <span className="text-green-400 text-xs ml-1">W</span>}
        </div>

        {/* Home team */}
        <div className={`flex items-center gap-3 ${homeWins ? "" : awayWins ? "opacity-60" : ""}`}>
          {homeTeam.logo ? (
            <img
              src={homeTeam.logo}
              alt={homeTeam.name}
              className="w-8 h-8 rounded-full object-contain bg-slate-800/50"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold">
              {homeTeam.abbreviation?.slice(0, 3) || homeTeam.name?.slice(0, 3)}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="font-medium truncate">{homeTeam.name}</div>
            <div className="text-xs text-slate-500">{homeTeam.record || "Home"}</div>
          </div>
          <div className={`text-xl font-bold tabular-nums ${homeWins ? "text-green-400" : ""}`}>
            {home?.score ?? "-"}
          </div>
          {homeWins && <span className="text-green-400 text-xs ml-1">W</span>}
        </div>
      </div>

      {/* Action buttons */}
      <div className="mt-3 pt-3 border-t border-slate-700/50 flex gap-2">
        <span className="text-xs px-2 py-1 rounded bg-slate-800 text-slate-400 hover:bg-slate-700 transition">
          Gamecast
        </span>
        <span className="text-xs px-2 py-1 rounded bg-slate-800 text-slate-400 hover:bg-slate-700 transition">
          Box Score
        </span>
      </div>
    </Link>
  );
}
