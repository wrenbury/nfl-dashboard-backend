// football_dash_frontend/src/pages/Scoreboard.tsx

import { useState, useMemo, useEffect } from "react";
import useSWR from "swr";
import { Link, useSearchParams } from "react-router-dom";
import { API } from "../api";
import type { Week, Conference } from "../api";
import WeekSelector from "../components/WeekSelector";
import NFLGameCard from "../components/NFLGameCard";

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
function getNflWeeks(year: number): Week[] {
  // Week 1 typically starts first Thursday after Labor Day
  // These are approximate date ranges for the 2025 season
  const weeks: Week[] = [];
  const baseDate = new Date(year, 8, 4); // Sept 4, 2025 approx start

  for (let w = 1; w <= 18; w++) {
    const startOffset = (w - 1) * 7;
    const start = new Date(baseDate);
    start.setDate(start.getDate() + startOffset);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);

    // Format dates as YYYY-MM-DD strings
    const startDate = start.toISOString().split('T')[0];
    const endDate = end.toISOString().split('T')[0];

    weeks.push({
      number: w,
      label: `Week ${w}`,
      startDate,
      endDate,
      seasonType: 2, // Regular season
    });
  }
  return weeks;
}

function getCurrentNflWeek(): number {
  const now = new Date();
  const year = now.getFullYear();
  const weeks = getNflWeeks(year);

  for (const w of weeks) {
    const start = new Date(w.startDate + 'T00:00:00');
    const end = new Date(w.endDate + 'T23:59:59');
    if (now >= start && now <= end) {
      return w.number;
    }
  }

  // If before season, return week 1; if after, return week 18
  const firstStart = new Date(weeks[0].startDate + 'T00:00:00');
  if (now < firstStart) return 1;
  return 18;
}

// Group games by date for display
function getCurrentCFBYear(): number {
  const now = new Date();
  const month = now.getMonth(); // 0-11 (0 = January)
  const year = now.getFullYear();

  // CFB season runs from August (month 7) to January (month 0)
  // If we're in Jan-July, the current CFB season is from the previous year
  // If we're in Aug-Dec, the current CFB season is from this year
  return month >= 7 ? year : year - 1;
}

// Helper function to determine game status category for sorting
function getGameStatusPriority(status: string): number {
  const statusLower = status.toLowerCase();

  // Ongoing games (highest priority)
  if (statusLower.includes("progress") ||
      statusLower.includes("half") ||
      statusLower.includes("quarter") ||
      statusLower.includes("qtr") ||
      statusLower.includes("overtime") ||
      statusLower.includes("delay")) {
    return 1;
  }

  // Upcoming/scheduled games
  if (statusLower.includes("scheduled") ||
      statusLower.includes("pre") ||
      /^\d{1,2}:\d{2}\s*(am|pm)?$/i.test(statusLower)) {
    return 2;
  }

  // Completed games (lowest priority)
  if (statusLower.includes("final") ||
      statusLower.includes("complete") ||
      statusLower.includes("postgame")) {
    return 3;
  }

  // Default to upcoming if unclear
  return 2;
}

function groupGamesByDate(games: any[]): Map<string, any[]> {
  const grouped = new Map<string, any[]>();

  for (const game of games) {
    const startTime = game.startTime;
    if (!startTime) continue;

    // Parse ISO date string to get just the date part
    const dateStr = startTime.split("T")[0];
    const existing = grouped.get(dateStr) || [];
    existing.push(game);
    grouped.set(dateStr, existing);
  }

  // Sort games within each date group: ongoing → upcoming → completed
  for (const [date, dateGames] of grouped.entries()) {
    dateGames.sort((a, b) => {
      const priorityA = getGameStatusPriority(a.status || '');
      const priorityB = getGameStatusPriority(b.status || '');

      if (priorityA !== priorityB) {
        return priorityA - priorityB; // Lower priority number = shown first
      }

      // Within same status category, sort by start time
      const timeA = new Date(a.startTime).getTime();
      const timeB = new Date(b.startTime).getTime();
      return timeA - timeB;
    });
    grouped.set(date, dateGames);
  }

  return grouped;
}

function formatDateHeader(dateStr: string): string {
  const date = new Date(dateStr + "T12:00:00");
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default function Scoreboard({ sport }: Props) {
  const currentYear = new Date().getFullYear();
  const cfbYear = getCurrentCFBYear();
  const [searchParams] = useSearchParams();

  // Check if week is in URL params (for back navigation from game page)
  const weekFromUrl = searchParams.get('week');
  const initialWeek = weekFromUrl ? parseInt(weekFromUrl, 10) : (sport === "nfl" ? getCurrentNflWeek() : 1);

  const [selectedWeek, setSelectedWeek] = useState(initialWeek);
  const [selectedSeasonType, setSelectedSeasonType] = useState<number>(2); // 2=regular, 3=postseason
  const [selectedConference, setSelectedConference] = useState<number>(80); // 80 = All FBS games

  // Fetch weeks from backend for both NFL and CFB
  const weeksEndpoint = sport === "nfl"
    ? API.nflWeeks()
    : API.cfbWeeks();

  const { data: weeksData } = useSWR(weeksEndpoint, fetcher, {
    revalidateOnFocus: false,
  });

  const weeks: Week[] = Array.isArray(weeksData) ? weeksData : (sport === "nfl" ? getNflWeeks(currentYear) : []);
  const currentWeekData = weeks.find((w) => w.number === selectedWeek && w.seasonType === selectedSeasonType);

  // Build endpoint with appropriate parameters
  const endpoint = API.scoreboard(sport, {
    week: selectedWeek,
    ...(sport === "college-football" && {
      seasonType: selectedSeasonType,
      groups: selectedConference
    })
  });

  const { data, error, isLoading } = useSWR(endpoint, fetcher, {
    revalidateOnFocus: false,
  });

  const games = Array.isArray(data) ? data : [];
  const gamesByDate = groupGamesByDate(games);

  // Sort dates chronologically
  const sortedDates = Array.from(gamesByDate.keys()).sort();

  // Update selectedWeek and seasonType when week changes
  const handleWeekChange = (weekNum: number, newSeasonType?: number) => {
    setSelectedWeek(weekNum);

    // If seasonType was provided (from clicking a specific week), use it
    if (newSeasonType !== undefined) {
      setSelectedSeasonType(newSeasonType);
    } else {
      // Otherwise, try to find the week with the current seasonType, or fallback to any match
      const week = weeks.find(w => w.number === weekNum && w.seasonType === selectedSeasonType) ||
                   weeks.find(w => w.number === weekNum);
      if (week) {
        setSelectedSeasonType(week.seasonType);
      }
    }
  };

  // NFL-specific view with week selector
  if (sport === "nfl") {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-bold">NFL Scoreboard</h1>

        {/* Week selector */}
        {weeks.length > 0 && selectedWeek !== null && (
          <WeekSelector
            weeks={weeks}
            selectedWeek={selectedWeek}
            onWeekChange={handleWeekChange}
          />
        )}

        {isLoading && (
          <div className="text-sm opacity-80">Loading scoreboard...</div>
        )}

        {error && (
          <div className="text-sm text-red-400 whitespace-pre-wrap card">
            Failed to load scoreboard.
            {"\n"}
            {(error as Error).message}
          </div>
        )}

        {!isLoading && !error && games.length === 0 && (
          <div className="text-sm opacity-70 card">
            No games scheduled for this week.
          </div>
        )}

        {!isLoading && !error && games.length > 0 && (
          <div className="space-y-6">
            {sortedDates.map((dateStr) => {
              const dateGames = gamesByDate.get(dateStr) || [];
              return (
                <div key={dateStr}>
                  <h2 className="text-sm font-semibold text-slate-400 mb-3 uppercase tracking-wide">
                    {formatDateHeader(dateStr)}
                  </h2>
                  <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-2">
                    {dateGames.map((game: any) => (
                      <NFLGameCard key={game.id} game={game} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    );
  }

  // College football view - simple week selector like NFL
  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-bold">CFB Scoreboard</h1>

      {/* Conference selector */}
      <div className="flex items-center gap-3">
        <label htmlFor="conference-select" className="text-sm font-medium text-slate-400">
          Conference:
        </label>
        <select
          id="conference-select"
          value={selectedConference}
          onChange={(e) => setSelectedConference(Number(e.target.value))}
          className="px-3 py-1.5 rounded bg-slate-800 border border-slate-700 text-sm focus:outline-none focus:border-slate-600"
        >
          <option value={80}>All FBS</option>
          <option value={25}>Top 25</option>
          <option value={1}>ACC</option>
          <option value={151}>American (AAC)</option>
          <option value={4}>Big 12</option>
          <option value={5}>Big Ten</option>
          <option value={12}>Conference USA</option>
          <option value={18}>FBS Independents</option>
          <option value={15}>MAC</option>
          <option value={17}>Mountain West</option>
          <option value={9}>Pac-12</option>
          <option value={8}>SEC</option>
          <option value={37}>Sun Belt</option>
        </select>
      </div>

      {/* Week selector */}
      {weeks.length > 0 && selectedWeek !== null && (
        <WeekSelector
          weeks={weeks}
          selectedWeek={selectedWeek}
          onWeekChange={handleWeekChange}
          seasonType={selectedSeasonType}
        />
      )}

      {isLoading && (
        <div className="text-sm opacity-80">Loading scoreboard...</div>
      )}

      {error && (
        <div className="text-sm text-red-400 whitespace-pre-wrap card">
          Failed to load scoreboard.
          {"\n"}
          {(error as Error).message}
        </div>
      )}

      {!isLoading && !error && games.length === 0 && (
        <div className="text-sm opacity-70 card">
          No games scheduled for this week.
        </div>
      )}

      {!isLoading && !error && games.length > 0 && (
        <div className="space-y-6">
          {sortedDates.map((dateStr) => {
            const dateGames = gamesByDate.get(dateStr) || [];
            return (
              <div key={dateStr}>
                <h2 className="text-sm font-semibold text-slate-400 mb-3 uppercase tracking-wide">
                  {formatDateHeader(dateStr)}
                </h2>
                <div className="grid gap-3 md:grid-cols-2">
                  {dateGames.map((game: any) => (
                    <GameCard key={game.id} game={game} sport={sport} />
                  ))}
                </div>
              </div>
            );
          })}
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
