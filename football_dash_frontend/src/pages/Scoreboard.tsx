// football_dash_frontend/src/pages/Scoreboard.tsx

import { useState, useEffect } from "react";
import useSWR from "swr";
import { API } from "../api";
import type { Week } from "../api";
import WeekSelector from "../components/WeekSelector";
import NFLGameCard from "../components/NFLGameCard";
import GameList from "../components/GameList";

type Sport = "nfl" | "college-football";

type Props = {
  sport: Sport;
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
      detail ? ` – ${String(detail).slice(0, 200)}` : ""
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

function getLocalYyyyMmDd(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

// Group games by date for display
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
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);

  // Fetch NFL weeks for the week selector
  const { data: weeksData } = useSWR(
    sport === "nfl" ? API.nflWeeks() : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  // Fetch current week to set initial selection
  const { data: currentWeekData } = useSWR(
    sport === "nfl" ? API.nflCurrentWeek() : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  // Set initial week when data loads
  useEffect(() => {
    if (currentWeekData?.week && selectedWeek === null) {
      setSelectedWeek(currentWeekData.week);
    }
  }, [currentWeekData, selectedWeek]);

  const weeks: Week[] = Array.isArray(weeksData) ? weeksData : [];

  // Build endpoint based on sport
  const endpoint =
    sport === "nfl" && selectedWeek !== null
      ? API.scoreboard(sport, { week: selectedWeek })
      : sport === "college-football"
      ? API.scoreboard(sport, { date: getLocalYyyyMmDd() })
      : null;

  const { data, error, isLoading } = useSWR(endpoint, fetcher, {
    revalidateOnFocus: false,
  });

  const games = Array.isArray(data) ? data : [];
  const gamesByDate = groupGamesByDate(games);

  // Sort dates chronologically
  const sortedDates = Array.from(gamesByDate.keys()).sort();

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
            onWeekChange={setSelectedWeek}
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

  // College football view (unchanged - date based)
  const date = getLocalYyyyMmDd();

  return (
    <section className="space-y-4">
      <div className="flex items-baseline justify-between">
        <div className="text-sm opacity-70">
          Showing:{" "}
          <span className="font-semibold">COLLEGE-FOOTBALL</span> — {date}
        </div>
      </div>

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

      {!isLoading && !error && (
        <div className="space-y-3">
          <GameList games={games} />
        </div>
      )}
    </section>
  );
}
